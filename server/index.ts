import { Server, Room, Client } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { mk, step, ai, NOACT, summary } from '../shared/sim';
import { TEAMS, FIELDS } from '../shared/data';
import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';

// Vite reads .env.local for the client, but this separate server process must load it itself.
if (typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile('.env.local'); }
  catch (error: any) { if (error?.code !== 'ENOENT') throw error; }
}

// Two kinds of room:
//  quick   : phase wait (countdown, bots fill in) -> play. Late joiners can take over a bot slot.
//  private : phase lobby (code/link, ready check, host picks mode + moves players) -> [coin toss if humans on both sides] -> setup (stadium + kits) -> play -> back to lobby
const LAG = Number(process.env.LAG) || 0; // dev only: LAG=100 simulates ~200ms round trip
const later = (f: () => void) => (LAG ? setTimeout(f, LAG) : f());
const QUICK_WAIT = 12000, LEN = Number(process.env.LEN) || 150;
const activeRooms = new Set<any>();
const bootedAt = Date.now();
let joinsSinceBoot = 0, matchesSinceBoot = 0;
class MatchRoom extends Room {
  maxClients = 10;
  s: any; afk = new Set<number>(); disconnected = new Set<string>(); slots = new Map<string, number>(); order: string[] = []; ready = new Set<string>(); rdy = new Set<string>();
  held: any[] = []; latch: any[] = []; nicks: string[] = Array(10).fill(''); overAt = 0; nk = 0; nsig = ''; code = 'QUICK'; waitUntil = 0; lastPub = 0;
  cfg: any = { kind: 'private', phase: 'lobby', mode: 'versus', field: 'street', teams: [0, 2], caps: [-1, -1], chooser: -1, caller: -1, toss: null, host: -1, eta: 0 };
  names() { return this.cfg.teams.map((i: number) => TEAMS[i].sh); }
  free(t: number) { const taken = new Set(this.slots.values()); return [4, 3, 2, 1, 0].find(i => !taken.has(t * 5 + i)); }
  assign(id: string) {
    const cnt = [0, 0]; for (const k of this.slots.values()) cnt[k < 5 ? 0 : 1]++;
    let t = this.cfg.kind === 'private' && this.cfg.mode === 'coop' ? 0 : (cnt[0] <= cnt[1] ? 0 : 1);
    let i = this.free(t); if (i === undefined) { t = 1 - t; i = this.free(t); }
    const k = t * 5 + i!; this.slots.set(id, k); this.held[k] = {}; this.latch[k] = {}; return k;
  }
  captain(side: number) { for (const id of this.order) { const k = this.slots.get(id); if (k !== undefined && (k < 5 ? 0 : 1) === side) return k; } return -1; }
  byIdx(idx: number) { for (const [id, k] of this.slots) if (k === idx) return id; return undefined; }
  pub() {
    const c = this.cfg, h = this.order[0];
    c.host = h ? this.slots.get(h) : -1;
    const pl = this.order.map(id => { const k = this.slots.get(id)!; return { idx: k, nick: this.nicks[k], ready: id === h || this.rdy.has(id), connected: !this.disconnected.has(id) }; });
    for (const cl of this.clients) if (this.ready.has(cl.sessionId)) cl.send('cfg', { ...c, code: this.code, pl });
  }
  reconf() {
    const c = this.cfg, a = this.captain(0), b = this.captain(1); c.caps = [a, b];
    if (c.phase === 'toss' || c.phase === 'setup') {
      if (a >= 0 && b >= 0) { if (!c.toss) { c.phase = 'toss'; c.caller = a; } else { c.phase = 'setup'; c.chooser = c.toss.winner === 0 ? a : b; } }
      else { c.phase = 'setup'; c.toss = null; c.caller = -1; c.chooser = Math.max(a, b); }
    }
    this.pub();
  }
  regroup() { const ids = [...this.order]; const old = [...this.nicks]; const o = new Map(this.slots); this.slots.clear(); this.nicks = Array(10).fill('');
    for (const id of ids) { const k = this.assign(id); this.nicks[k] = old[o.get(id)!]; this.clients.find(c => c.sessionId === id)?.send('you', { idx: k }); } }
  startMatch() { this.s = mk({ len: LEN, names: this.names() }); this.cfg.phase = 'play'; this.overAt = 0; for (const id of this.disconnected) { const k = this.slots.get(id); if (k !== undefined) this.afk.add(k); } matchesSinceBoot++; }
  startQuick() { const c = this.cfg, r = () => Math.random() * TEAMS.length | 0; c.field = FIELDS[Math.random() * FIELDS.length | 0].id; const a = r(); let b = r(); if (b === a) b = (a + 1) % TEAMS.length; c.teams = [a, b]; this.startMatch(); this.pub(); }
  onCreate(o: any) {
    activeRooms.add(this);
    this.code = String(o.code || 'QUICK'); this.cfg.kind = o.kind === 'quick' ? 'quick' : 'private'; this.cfg.phase = this.cfg.kind === 'quick' ? 'wait' : 'lobby';
    this.setMetadata({ code: this.code }); this.s = mk({ len: LEN, names: this.names() });
    for (let i = 0; i < 10; i++) { this.held[i] = {}; this.latch[i] = {}; }
    const me = (c: Client) => this.slots.get(c.sessionId);
    this.onMessage('ready', (c) => { this.ready.add(c.sessionId); c.send('you', { idx: me(c) }); this.pub(); });
    this.onMessage('in', (c, m) => {
      const k = me(c); if (k === undefined || !m) return;
      const n = (v: any) => Math.max(-1, Math.min(1, Number(v) || 0));
      later(() => {
      this.held[k] = { mx: n(m.mx), my: n(m.my), sprint: m.sprint ? 1 : 0, shield: m.shield ? 1 : 0, press: m.press ? 1 : 0 };
      for (const a of ['pass', 'lob', 'thru', 'tackle', 'slide', 'skill', 'call']) if (m[a]) this.latch[k][a] = 1;
      if (m.shoot) this.latch[k].shoot = Math.max(0.4, Math.min(1, Number(m.shoot) || 0.4));
      });
    });
    this.onMessage('p', (c, m) => later(() => later(() => c.send('q', { t: m?.t })))); // ping -> pong, for the ping display and prediction
    this.onMessage('afk', (c, m) => { const k = me(c); if (k === undefined) return; if (m?.on) this.afk.add(k); else this.afk.delete(k); }); // menu open: a bot plays for you
    // ---- private lobby controls
    this.onMessage('rdy', (c) => { if (this.cfg.phase !== 'lobby') return; this.rdy.has(c.sessionId) ? this.rdy.delete(c.sessionId) : this.rdy.add(c.sessionId); this.pub(); });
    this.onMessage('mode', (c, m) => { if (this.cfg.phase !== 'lobby' || c.sessionId !== this.order[0] || !['coop', 'versus'].includes(m?.m)) return; this.cfg.mode = m.m; this.regroup(); this.reconf(); });
    this.onMessage('side', (c) => { const k = me(c); if (this.cfg.phase !== 'lobby' || this.cfg.mode !== 'versus' || k === undefined) return;
      const i = this.free(k < 5 ? 1 : 0); if (i === undefined) return; const nk = (k < 5 ? 1 : 0) * 5 + i;
      this.slots.set(c.sessionId, nk); this.nicks[nk] = this.nicks[k]; this.nicks[k] = ''; this.held[nk] = {}; this.latch[nk] = {}; c.send('you', { idx: nk }); this.reconf(); });
    this.onMessage('kick', (c, m) => { if (this.cfg.phase !== 'lobby' || c.sessionId !== this.order[0]) return; const id = this.byIdx(Number(m?.idx)); if (!id || id === c.sessionId) return;
      const target = this.clients.find(x => x.sessionId === id); if (target) target.leave(); else if (this.disconnected.has(id)) { const k = this.slots.get(id); this.slots.delete(id); this.ready.delete(id); this.rdy.delete(id); this.disconnected.delete(id); this.order = this.order.filter(x => x !== id); if (k !== undefined) { this.nicks[k] = ''; this.afk.delete(k); } this.reconf(); }
    });
    this.onMessage('host', (c, m) => { if (c.sessionId !== this.order[0]) return; const id = this.byIdx(Number(m?.idx)); if (!id || this.disconnected.has(id)) return; this.order = [id, ...this.order.filter(x => x !== id)]; this.reconf(); });
    // ---- coin toss + stadium/kit setup (see reconf)
    this.onMessage('call', (c, m) => { // heads/tails: caller wins if the coin matches, otherwise the other captain
      const k = me(c), g = this.cfg; if (g.phase !== 'toss' || k !== g.caller || !['H', 'T'].includes(m?.c)) return;
      const result = Math.random() < .5 ? 'H' : 'T', side = k < 5 ? 0 : 1;
      g.toss = { call: m.c, result, winner: m.c === result ? side : 1 - side }; this.reconf();
    });
    this.onMessage('cfg', (c, m) => {
      const k = me(c), g = this.cfg; if (k === undefined || g.phase !== 'setup' && g.phase !== 'toss') return;
      if (m?.field && k === g.chooser && FIELDS.some(f => f.id === m.field)) g.field = m.field;
      const both = g.caps[0] >= 0 && g.caps[1] >= 0, tm = Number(m?.team);
      const side = both ? (k === g.caps[0] ? 0 : k === g.caps[1] ? 1 : -1) : (k === g.chooser ? Number(m?.side) : -1);
      if ((side === 0 || side === 1) && Number.isInteger(tm) && TEAMS[tm]) g.teams[side] = tm;
      this.pub();
    });
    this.onMessage('start', (c) => {
      const g = this.cfg, k = me(c);
      if (g.phase === 'lobby') { if (c.sessionId !== this.order[0] || !this.order.slice(1).every(x => this.rdy.has(x) || this.disconnected.has(x))) return; g.phase = 'setup'; g.toss = null; this.lock(); this.reconf(); return; }
      if (g.phase !== 'setup' || k !== g.chooser) return; this.startMatch(); this.pub();
    });
    let acc = 0, snap = 0;
    this.setSimulationInterval((ms) => {
      const c = this.cfg, now = Date.now(); if (!this.slots.size) return;
      if (c.kind === 'quick' && c.phase === 'wait') {
        if (!this.waitUntil) this.waitUntil = now + QUICK_WAIT; c.eta = Math.max(0, Math.ceil((this.waitUntil - now) / 1000));
        if (now >= this.waitUntil || this.slots.size >= 10) this.startQuick(); else if (now - this.lastPub > 1000) { this.lastPub = now; this.pub(); }
        return;
      }
      if (c.phase !== 'play') return;
      acc += Math.min(ms, 100) / 1000; snap += ms;
      while (acc >= 1 / 60) { this.tick(); acc -= 1 / 60; }
      if (snap >= 50) { snap = 0; const sn = this.snap(); later(() => this.broadcast('s', sn)); later(() => this.sendCalls()); }
    }, 1000 / 60);
  }
  tick() {
    const s = this.s, c = this.cfg, hum = new Set([...this.slots.values()].filter(k => !this.afk.has(k)));
    if (s.over) {
      if (!this.overAt) { this.overAt = Date.now(); this.broadcast('sum', summary(s)); } // full-time report, then back to the lobby after 20s
      else if (Date.now() - this.overAt > 20000) {
        this.overAt = 0;
        if (c.kind === 'quick') { this.s = mk({ len: LEN, names: this.names() }); matchesSinceBoot++; }
        else { c.phase = 'lobby'; c.toss = null; this.rdy.clear(); this.afk.clear(); this.s = mk({ len: LEN, names: this.names() }); this.unlock(); this.pub(); } // rematch: back to the waiting room
      }
      return;
    }
    const inp = s.ps.map((p: any, k: number) => hum.has(k) ? { ...NOACT, ...this.held[k], ...this.latch[k], h: 1 } : ai(s, k)); // empty slots = AI
    step(s, inp, 1 / 60);
    for (const k of hum) this.latch[k] = {};
  }
  onJoin(c: Client, o: any) {
    joinsSinceBoot++;
    const k = this.assign(c.sessionId); this.order.push(c.sessionId);
    if (this.disconnected.has(this.order[0])) this.order = [c.sessionId, ...this.order.filter(id => id !== c.sessionId)];
    let nm = String(o?.nick || 'PLAYER').replace(/[^\w ]/g, '').trim().slice(0, 14).toUpperCase() || 'PLAYER'; const base = nm; let n = 2;
    while (this.nicks.includes(nm)) nm = base.slice(0, 12) + ' ' + n++; // two players can't share a name in one match
    this.nicks[k] = nm;
    this.reconf();
  }
  onDispose() { activeRooms.delete(this); }
  async onLeave(c: Client, consented: boolean) { // hold a dropped player's seat for up to 60 seconds
    const k = this.slots.get(c.sessionId);
    if (!consented && k !== undefined) {
      this.disconnected.add(c.sessionId);
      if (this.cfg.phase === 'play') this.afk.add(k);
      else {
        const nextHost = this.order.find(id => id !== c.sessionId && !this.disconnected.has(id));
        if (this.order[0] === c.sessionId && nextHost) this.order = [nextHost, ...this.order.filter(id => id !== nextHost)];
        this.pub();
      }
      try { await this.allowReconnection(c, 60); this.disconnected.delete(c.sessionId); this.afk.delete(k); if (this.cfg.phase !== 'play') this.pub(); return; } catch { }
    }
    this.disconnected.delete(c.sessionId); this.slots.delete(c.sessionId); this.ready.delete(c.sessionId); this.rdy.delete(c.sessionId); this.order = this.order.filter(x => x !== c.sessionId);
    if (k !== undefined) { this.nicks[k] = ''; this.afk.delete(k); }
    this.reconf();
  }
  // pass calls go ONLY to the caller's own team, so opponents never receive them
  sendCalls() { const calls: number[][] = [[], []]; this.s.ps.forEach((p: any, k: number) => { if (p.cl > 0) calls[p.t].push(k); });
    for (const c of this.clients) { const k = this.slots.get(c.sessionId); if (k !== undefined && this.ready.has(c.sessionId)) c.send('c', calls[k < 5 ? 0 : 1]); } }
  nickPart() { const sig = this.nicks.join('|'); const send = sig !== this.nsig || this.nk++ % 40 === 0; if (send) this.nsig = sig; return send ? this.nicks : undefined; } // names only when they change
  snap() {
    const s = this.s, r = (v: number) => Math.round(v * 10) / 10;
    return { t: r(s.time), h: s.half, sc: s.score, m: s.msg, k: s.kind, u: s.sub, gt: s.gt, z: s.freeze > 0 ? 1 : 0, tk: s.taker, gk: s.gk, x: s.sc, y: s.as, og: s.og, mn: s.mn, pa: s.pause > 0 ? 1 : 0, ov: s.over ? 1 : 0, o: s.own,
      b: [r(s.ball.x), r(s.ball.y), r(s.ball.vx), r(s.ball.vy), r(s.ball.h)],
      p: s.ps.map((p: any) => [r(p.x), r(p.y), r(p.vx), r(p.vy), +p.fx.toFixed(2), +p.fy.toFixed(2), p.stun > 0 ? 1 : 0, p.sh ? 1 : 0, p.run ? 1 : 0, +p.st.toFixed(2), (p.sl > 0 ? 1 : 0) + (p.kk > 0 ? 2 : 0)]), n: this.nickPart() };
  }
}
function adminStats() {
  const rooms = [...activeRooms].map((room: any) => ({
    roomId: room.roomId,
    type: room.cfg.kind === 'quick' ? 'Quick match' : 'Private room',
    phase: room.cfg.phase,
    players: room.clients.length,
    capacity: room.maxClients,
    field: room.cfg.field,
    mode: room.cfg.mode,
  }));
  return {
    capturedAt: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - bootedAt) / 1000),
    onlinePlayers: rooms.reduce((sum, room) => sum + room.players, 0),
    activeRooms: rooms.length,
    matchesInProgress: rooms.filter(room => room.phase === 'play').length,
    playersInMatches: rooms.filter(room => room.phase === 'play').reduce((sum, room) => sum + room.players, 0),
    waitingRooms: rooms.filter(room => room.phase !== 'play').length,
    joinsSinceBoot,
    matchesStartedSinceBoot: matchesSinceBoot,
    rooms,
  };
}

const adminToken = process.env.ADMIN_TOKEN || '';
const adminOrigin = process.env.ADMIN_ORIGIN || '';
const httpServer = createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (url.pathname !== '/admin/analytics') return;

  const origin = req.headers.origin || '';
  const devOrigin = process.env.NODE_ENV !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1):5173$/.test(origin);
  const originAllowed = !origin || origin === adminOrigin || devOrigin;
  if (origin && originAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  }
  res.setHeader('Cache-Control', 'no-store');
  if (!originAllowed) { res.writeHead(403); res.end('Origin not allowed'); return; }
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method !== 'GET') { res.writeHead(405, { Allow: 'GET, OPTIONS' }); res.end(); return; }
  if (!adminToken) { res.writeHead(503, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Admin analytics are disabled. Configure ADMIN_TOKEN on the game server.' })); return; }
  const supplied = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(supplied), b = Buffer.from(adminToken);
  if (a.length !== b.length || !timingSafeEqual(a, b)) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Invalid admin token.' })); return; }
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(adminStats()));
});
const server = new Server({ transport: new WebSocketTransport({ server: httpServer }) });
server.define('match', MatchRoom).filterBy(['code']);
server.listen(Number(process.env.PORT) || 2567).then(() => console.log('Street FB server listening on :' + (process.env.PORT || 2567)));
