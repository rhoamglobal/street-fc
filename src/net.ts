import { Client } from 'colyseus.js';
import { moveStep } from '../shared/sim';
let client: any;
// net.rtt: smoothed round trip (ms). net.pp: locally predicted state of YOUR player. net.buf: recent snapshots for interpolation.
export const net: any = { rtt: 0, pp: null, buf: [], INTERP: 100, predict: !location.search.includes('nopredict') };
export async function connect(nick: string, code: string, how: string) {
  const url = (import.meta as any).env?.VITE_SERVER_URL || `ws://${location.hostname}:2567`; client = new Client(url);
  const o = { nick, code, kind: how === 'quick' ? 'quick' : 'private' };
  const room = how === 'quick' ? await client.joinOrCreate('match', o) : how === 'create' ? await client.create('match', o) : await client.join('match', o);
  try { sessionStorage.setItem('sfc-token', room.reconnectionToken); } catch { }
  return room;
}
export async function reconnect() { const t = sessionStorage.getItem('sfc-token'); if (!client || !t) throw new Error('no token'); const r = await client.reconnect(t); sessionStorage.setItem('sfc-token', r.reconnectionToken); return r; }
export function resetNet() { net.buf.length = 0; net.pp = null; }
export function applySnap(s: any, m: any, me: number) {
  net.buf.push({ t: performance.now(), p: m.p, b: m.b }); while (net.buf.length > 14) net.buf.shift();
  s.time = m.t; s.half = m.h; s.score = m.sc; s.msg = m.m; s.pause = m.pa; s.over = !!m.ov; s.own = m.o; if (m.n) s.nicks = m.n;
  s.kind = m.k; s.sub = m.u; s.gt = m.gt; s.sc = m.x; s.as = m.y; s.og = m.og; s.mn = m.mn; s.freeze = m.z; s.taker = m.tk; s.gk = m.gk;
  const b = s.ball; b.vx = m.b[2]; b.vy = m.b[3]; b.h = m.b[4];
  m.p.forEach((a: number[], i: number) => { const p = s.ps[i];
    p.vx = a[2]; p.vy = a[3]; p.fx = a[4]; p.fy = a[5]; p.stun = a[6] ? .5 : 0; p.sh = !!a[7]; p.run = !!a[8]; p.st = a[9]; p.sl = a[10] & 1 ? .5 : 0; p.kk = a[10] & 2 ? .2 : 0; });
  if (!s.synced) { s.synced = true; m.p.forEach((a: number[], i: number) => { s.ps[i].x = a[0]; s.ps[i].y = a[1]; }); b.x = m.b[0]; b.y = m.b[1]; }
  // reconcile the prediction: the server's answer is about half a round trip old, so compare against where it says we are NOW
  const a = m.p[me]; if (!a) return; let pp = net.pp;
  if (!pp || m.pa || s.over) { net.pp = { x: a[0], y: a[1], vx: a[2], vy: a[3], fx: a[4], fy: a[5], st: a[9], stun: a[6] ? .5 : 0 }; return; }
  const d = (net.rtt / 2 + 30) / 1000, ex = a[0] + a[2] * d, ey = a[1] + a[3] * d;
  if (Math.hypot(ex - pp.x, ey - pp.y) > 90) { pp.x = ex; pp.y = ey; pp.vx = a[2]; pp.vy = a[3]; }
  else { pp.x += (ex - pp.x) * .25; pp.y += (ey - pp.y) * .25; pp.vx += (a[2] - pp.vx) * .25; pp.vy += (a[3] - pp.vy) * .25; }
  pp.st = a[9]; pp.stun = a[6] ? .5 : 0;
}
// Each frame: other players + ball are drawn ~100ms in the past, interpolated between snapshots (smooth even when packets arrive unevenly).
// Your own player uses the prediction, so it responds to the stick immediately.
export function netTick(s: any, dt: number, hu: any, me: number) {
  const buf = net.buf, n = buf.length; if (!n) return;
  const rt = performance.now() - net.INTERP; let i = 0; while (i < n - 1 && buf[i + 1].t <= rt) i++;
  const A = buf[i], B = buf[Math.min(i + 1, n - 1)], span = B.t - A.t, f = span > 0 ? Math.max(0, Math.min(1.4, (rt - A.t) / span)) : 0;
  const pp = net.pp, frozen = s.freeze > 0 && me !== s.taker && me !== s.gk, predict = !!(net.predict && pp && hu && !s.pause && !s.over && !frozen);
  s.ps.forEach((p: any, k: number) => { if (k === me && predict) return; const a = A.p[k], b = B.p[k]; p.x = a[0] + (b[0] - a[0]) * f; p.y = a[1] + (b[1] - a[1]) * f; });
  const mp = s.ps[me];
  if (predict) { moveStep(pp, hu, s, dt, me); mp.x = pp.x; mp.y = pp.y; mp.vx = pp.vx; mp.vy = pp.vy; mp.fx = pp.fx; mp.fy = pp.fy; }
  else if (pp) { pp.x = mp.x; pp.y = mp.y; }
  const bb = s.ball; let tx = A.b[0] + (B.b[0] - A.b[0]) * f, ty = A.b[1] + (B.b[1] - A.b[1]) * f;
  if (predict && s.own === me) { const lead = 23 + (hu.sprint ? 9 : 3); tx = mp.x + mp.fx * lead; ty = mp.y + mp.fy * lead; } // ball stays glued to your feet
  const kk = Math.min(1, dt * 20); bb.x += (tx - bb.x) * kk; bb.y += (ty - bb.y) * kk;
}
