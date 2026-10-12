// @ts-nocheck
// STREET FB player rig. Front of the player is local +z (matches the sim's facing vector).
// Joint convention: rotation.x > 0 swings the limb's far end BACKWARD (-z).
//   thigh/upper arm: negative = forward. shin: positive = knee bend (foot back). forearm: negative = elbow bend (hand forward).
import * as THREE from 'three';

const HAIR = [0x0d0d0d, 0x14100c, 0x1a1008, 0x0d0d0d, 0x2a1a10];
export const BOOTS = [0x101010, 0xFF5A1F, 0xf2f2f2, 0x101010, 0xFFCA58];
const IRIS = [0x4a2c1a, 0x2a2018, 0x3a281a, 0x2a1c12, 0x4a3020];
export const SCALE = 1.34; // players stand clearly taller than the ball
export const HIP = 1.64; // hip height: legs are ~47% of the body, like a real footballer

const std = (c: number, r = .8) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0 });
const lathe = (pts: number[][], seg = 20) => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg);

// rounded tapered limb segment: top at y=0, bottom at y=-len, slight muscle belly
function limb(r1: number, r2: number, len: number, belly = .1, seg = 16) {
  const pts: number[][] = [], cap = 6;
  for (let i = 0; i <= cap; i++) { const a = i / cap * Math.PI / 2; pts.push([r1 * Math.sin(a), -r1 + r1 * Math.cos(a)]); }
  const n = 8, y0 = -r1, y1 = -(len - r2);
  for (let i = 1; i < n; i++) { const t = i / n; pts.push([r1 + (r2 - r1) * t + belly * Math.sin(Math.PI * t) * Math.max(r1, r2), y0 + (y1 - y0) * t]); }
  for (let i = 0; i <= cap; i++) { const a = i / cap * Math.PI / 2; pts.push([r2 * Math.cos(a), y1 - r2 * Math.sin(a)]); }
  return lathe(pts.reverse(), seg);
}
const mesh = (g: any, m: any, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); return o; };
const ball = (r: number, m: any, sx = 1, sy = 1, sz = 1, x = 0, y = 0, z = 0) => { const o = mesh(new THREE.SphereGeometry(r, 18, 14), m, x, y, z); o.scale.set(sx, sy, sz); return o; };

export function makeRig(k: number, o: { skin: number, num: any }) {
  const skinDark = new THREE.Color(o.skin).multiplyScalar(.62).getHex();
  const m = {
    shirt: std(0xffffff, .78), short: std(0x222222, .8), sock: std(0xffffff, .9), skin: std(o.skin, .62),
    hair: std(HAIR[k % 5], .9), boot: std(BOOTS[k % 5], .45), trim: std(0xFF5A1F, .7), eye: std(0x10131e, .3),
    white: std(0xf4eadf, .35), iris: std(IRIS[k % 5], .3), lip: std(skinDark, .5), sole: std(0xefefef, .6)
  };
  const g = new THREE.Group();
  g.scale.set(SCALE * (.97 + (k % 3) * .035), SCALE * (.95 + (k % 4) * .03), SCALE * (.97 + (k % 3) * .035));

  // ---------- legs (pivot at hip; children of g so the torso can lean independently) ----------
  const legs = [-1, 1].map(sd => {
    const l = new THREE.Group(); l.position.set(sd * .2, HIP, 0);
    const thigh = mesh(limb(.185, .128, .82, .14), m.skin);
    const shortLeg = mesh(new THREE.CylinderGeometry(.19, .212, .46, 18, 1, false), m.short, 0, -.23, 0);
    const knee = ball(.135, m.skin, 1, 1.05, 1.05, 0, -.8, .01);
    const shin = new THREE.Group(); shin.position.y = -.8;
    const calf = mesh(limb(.13, .082, .74, .12), m.skin, 0, 0, -.005);
    const gastroc = ball(.1, m.skin, .95, 2.7, 1, 0, -.2, -.04);
    const sock = mesh(new THREE.CylinderGeometry(.118, .092, .56, 16), m.sock, 0, -.4, 0);
    const sockTop = mesh(new THREE.CylinderGeometry(.122, .122, .05, 16), m.trim, 0, -.14, 0);
    // boot: toe points +z
    const heel = ball(.115, m.boot, 1, .95, 1.15, 0, -.72, -.02);
    const toe = ball(.11, m.boot, .98, .62, 1.7, 0, -.76, .2);
    const sole = mesh(new THREE.BoxGeometry(.21, .05, .62), m.sole, 0, -.8, .1);
    const stripeL = mesh(new THREE.BoxGeometry(.012, .05, .26), m.trim, -.105, -.74, .06), stripeR = stripeL.clone(); stripeR.position.x = .105;
    const laces = mesh(new THREE.BoxGeometry(.09, .018, .22), m.white, 0, -.7, .15); laces.rotation.x = -.35;
    [[-.07, .3], [.07, .3], [-.07, -.05], [.07, -.05]].forEach(([x, z]) => shin.add(mesh(new THREE.CylinderGeometry(.022, .022, .04, 6), m.sole, x, -.84, z)));
    shin.add(calf, gastroc, sock, sockTop, heel, toe, sole, stripeL, stripeR, laces);
    l.add(thigh, shortLeg, knee, shin); l.userData.shin = shin; g.add(l); return l;
  });

  // ---------- body (pivot at the pelvis) ----------
  const body = new THREE.Group(); body.position.y = HIP; g.add(body);
  const torsoScale = (o2: any) => { o2.scale.set(1.2, 1, .76); return o2; };
  const pelvis = torsoScale(mesh(lathe([[0, -.14], [.2, -.12], [.26, -.02], [.27, .1], [.26, .2], [0, .2]]), m.short));
  const shirtBody = torsoScale(mesh(lathe([[.27, .02], [.262, .16], [.252, .4], [.292, .66], [.345, .88], [.348, .98], [.28, 1.07], [.16, 1.12], [.125, 1.14]], 24), m.shirt));
  shirtBody.material.side = THREE.DoubleSide;
  const waist = new THREE.Mesh(new THREE.TorusGeometry(.268, .022, 6, 24), m.trim); waist.position.y = .12; waist.rotation.x = Math.PI / 2; waist.scale.set(1.2, .76, 1);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(.13, .026, 6, 18), m.trim); collar.position.set(0, 1.11, .01); collar.rotation.x = Math.PI / 2 - .25; collar.scale.set(1.05, .9, 1);
  const band = torsoScale(mesh(lathe([[.288, .6], [.294, .6], [.3, .7], [.294, .7]], 24), m.trim)); band.visible = k % 3 === 1;
  const sideStripes = [-1, 1].map(sd => { const v = mesh(new THREE.BoxGeometry(.03, .78, .16), m.trim, sd * .335, .55, 0); v.visible = k % 3 === 0; return v; });
  const badge = new THREE.Mesh(new THREE.CircleGeometry(.07, 8), m.trim); badge.position.set(.16, .8, .272);
  const num = new THREE.Mesh(new THREE.PlaneGeometry(.5, .5), new THREE.MeshBasicMaterial({ map: o.num, transparent: true })); num.position.set(0, .62, -.26); num.rotation.y = Math.PI;
  const neck = mesh(new THREE.CylinderGeometry(.1, .125, .26, 14), m.skin, 0, 1.2, .01);
  const traps = [-1, 1].map(sd => { const o2 = ball(.13, m.shirt, 1.5, .6, 1, sd * .17, 1.07, 0); return o2; });

  // ---------- head (faces +z) ----------
  const head = new THREE.Group(); head.position.y = 1.52; head.scale.setScalar(.92); body.add(head);
  const cranium = ball(.27, m.skin, .92, 1.05, 1.0, 0, .02, 0);
  const jaw = ball(.2, m.skin, .95, .82, .92, 0, -.14, .045);
  const ears = [-1, 1].map(sd => ball(.06, m.skin, .5, 1, .85, sd * .245, -.02, -.01));
  const nose = ball(.05, m.skin, .75, .9, 1.2, 0, -.045, .262);
  const eyes = [-1, 1].flatMap(sd => [ball(.045, m.white, 1, .8, .55, sd * .1, .035, .232), ball(.026, m.iris, 1, 1, .5, sd * .1, .035, .252), ball(.013, m.eye, 1, 1, .5, sd * .1, .035, .261)]);
  const brows = [-1, 1].map(sd => { const b = mesh(new THREE.BoxGeometry(.105, .024, .03), m.hair, sd * .1, .1, .245); b.rotation.z = sd * -.12; return b; });
  const mouth = mesh(new THREE.BoxGeometry(.1, .018, .02), m.lip, 0, -.145, .245);
  const hs = k % 5; const hairParts: any[] = [];
  const cap = (sc: number, tl: number, y: number, tilt: number) => { const c = mesh(new THREE.SphereGeometry(.285 * sc, 20, 14, 0, Math.PI * 2, 0, tl), m.hair, 0, y, -.005); c.rotation.x = tilt; c.scale.set(.94, 1.06, 1.02); return c; };
  if (hs === 0) hairParts.push(cap(1, 1.42, .03, -.2));                       // low fade
  else if (hs === 1) hairParts.push(ball(.37, m.hair, 1.04, .92, 1.0, 0, .12, -.075)); // afro
  else if (hs === 2) {                                                          // twists
    hairParts.push(cap(1.02, 1.38, .03, -.2));
    for (let i = 0; i < 14; i++) { const a = -Math.PI * .72 + i / 13 * Math.PI * 1.44 + Math.PI; const t = mesh(new THREE.CylinderGeometry(.03, .022, .36, 6), m.hair, Math.sin(a) * .235, .02, Math.cos(a) * .2 - .02); t.rotation.set(Math.cos(a) * .25, 0, -Math.sin(a) * .25); if (Math.cos(a) > .75) t.visible = false; hairParts.push(t); }
  }
  else if (hs === 3) hairParts.push(cap(.99, 1.2, .04, -.28));                  // close crop
  else { hairParts.push(cap(1, 1.4, .03, -.2)); hairParts.push(mesh(new THREE.CylinderGeometry(.17, .21, .08, 14), m.hair, 0, .245, -.03)); } // flat top
  if (hs === 3 || k % 7 === 2) { const beard = ball(.19, m.hair, .92, .7, .72, 0, -.17, .1); const stache = mesh(new THREE.BoxGeometry(.11, .02, .03), m.hair, 0, -.115, .252); hairParts.push(beard, stache); }
  if (k % 4 === 0) { const hb = new THREE.Mesh(new THREE.TorusGeometry(.27, .026, 6, 20), m.trim); hb.position.y = .1; hb.rotation.x = Math.PI / 2; hb.scale.set(.96, 1.03, 1); hairParts.push(hb); }
  head.add(cranium, jaw, nose, mouth, ...ears, ...eyes, ...brows, ...hairParts);

  // ---------- arms (pivot at shoulder) ----------
  const arms = [-1, 1].map(sd => {
    const a = new THREE.Group(); a.position.set(sd * .5, 1.0, 0);
    const cuffBall = ball(.15, m.shirt, 1, 1.05, 1.02, sd * .02, -.05, 0);
    const sleeve = mesh(limb(.135, .125, .32, .04), m.shirt, 0, .0, 0);
    const sleeveEdge = mesh(new THREE.CylinderGeometry(.128, .128, .03, 14), m.trim, 0, -.27, 0);
    const upper = mesh(limb(.105, .09, .56, .08), m.skin, 0, -.02, 0);
    const lower = new THREE.Group(); lower.position.y = -.54;
    const fore = mesh(limb(.095, .066, .54, .1), m.skin, 0, 0, 0), forearmBulk = ball(.07, m.skin, 1, 2.3, 1, 0, -.15, 0);
    const hand = ball(.075, m.skin, .8, 1.25, .62, 0, -.58, .01), thumb = ball(.026, m.skin, 1, 1.6, 1, sd * -.052, -.55, .035);
    lower.add(fore, forearmBulk, hand, thumb); a.add(cuffBall, upper, sleeve, sleeveEdge, lower); a.userData.lower = lower; body.add(a); return a;
  });

  body.add(pelvis, shirtBody, waist, collar, band, ...sideStripes, badge, num, neck, ...traps);
  const cast = [shirtBody, pelvis, neck, cranium, jaw, ...hairParts, ...traps];
  legs.forEach(l => { l.children.forEach((c: any) => { if (c.isMesh) cast.push(c); }); l.userData.shin.children.forEach((c: any) => { if (c.isMesh && c.geometry.type !== 'CylinderGeometry') cast.push(c); }); });
  arms.forEach(a => { cast.push(a.children[0], a.children[1], a.children[2]); a.userData.lower.children.slice(0, 2).forEach((c: any) => cast.push(c)); });
  cast.forEach((c: any) => { c.castShadow = true; });
  return { g, legs, arms, body, head, m };
}

const ease = (t: number) => t * t * (3 - 2 * t);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

// c: { sp, slide, run, cel, tt, k, bx, bz, ang, dt }
// computePose returns joint angles in the shared convention, so both the built-in rig and the glb skeleton use the same motion.
export function computePose(r: any, p: any, c: any) {
  const { run, slide, cel, tt, k } = c, ph = r.ph, s = Math.sin(ph), cs = Math.cos(ph), up = 1 - slide, idle = 1 - run;
  let hip0 = s * .8 * run * up, hip1 = -s * .8 * run * up;
  let kn0 = run * up * (.18 + 1.0 * Math.max(0, -cs)), kn1 = run * up * (.18 + 1.0 * Math.max(0, cs));
  hip0 += Math.sin(tt * 1.7 + k) * .02 * idle; hip1 -= Math.sin(tt * 1.7 + k) * .02 * idle; kn0 += .05 * idle; kn1 += .05 * idle;
  if (p.kk > 0) { const u = ease(1 - p.kk / .25); hip1 = (1 - u) * .9 + u * -1.45; kn1 = (1 - u) * 1.15 + u * .12; hip0 = .15; }
  if (slide > 0) { hip1 = hip1 * up - 1.45 * slide; kn1 *= up; hip0 = hip0 * up + .55 * slide; kn0 = kn0 * up + 1.3 * slide; }
  const lean = Math.min(.3, c.sp / 700) * up;
  const bodyY = Math.abs(Math.sin(ph * 2)) * .07 * run * up - slide * .78 + Math.sin(tt * 2.2 + k) * .012 * idle; // offset from hip height
  const tiltX = lean - slide * 1.0 + (p.kk > 0 ? -.12 : 0);
  const twist = s * .24 * run * up + (cel ? Math.sin(tt * 9 + k) * .25 : 0);
  const roll = Math.max(-.14, Math.min(.14, -p.vy / 1900)) + Math.max(-.4, Math.min(.4, r.turn)) * .28 + s * .035 * run;
  const sw = s * .95 * run * up;
  let a0 = -sw, a1 = sw, f0 = -(.25 + .95 * run) - Math.max(0, sw) * .3, f1 = -(.25 + .95 * run) - Math.max(0, -sw) * .3;
  a0 += .08 * idle * Math.sin(tt * 1.7 + k); a1 -= .08 * idle * Math.sin(tt * 1.7 + k);
  if (slide > 0) { a0 = a0 * up + .9 * slide; a1 = a1 * up - 1.1 * slide; f0 *= up; f1 *= up; }
  if (cel) { a0 = a1 = -2.9 - Math.sin(tt * 12 + k) * .12; f0 = f1 = -.5; }
  const az0 = -.07 - slide * .4 - (cel ? .25 : 0), az1 = .07 + slide * .4 + (cel ? .25 : 0);
  // head tracks the ball
  const dx = c.bx - r.g.position.x, dz = c.bz - r.g.position.z, d = Math.hypot(dx, dz);
  const want = Math.max(-.85, Math.min(.85, wrap(Math.atan2(dx, dz) - r.ang) * .75));
  const tgt = Math.max(-.95, Math.min(.95, want - twist));
  const hy = (r.headY ?? 0) + (tgt - (r.headY ?? 0)) * Math.min(1, c.dt * 9);
  const hx = cel ? -.35 : (.1 + (d < 6 ? .22 : 0)) * up - lean * .6 + slide * .5;
  r.headY = hy;
  return { hip0, hip1, kn0, kn1, a0, a1, f0, f1, az0, az1, bodyY, tiltX, twist, roll, hy, hx, slide };
}

export function animRig(r: any, p: any, c: any) {
  const q = computePose(r, p, c), L0 = r.legs[0], L1 = r.legs[1];
  L0.rotation.x = q.hip0; L1.rotation.x = q.hip1; L0.userData.shin.rotation.x = q.kn0; L1.userData.shin.rotation.x = q.kn1;
  L0.position.y = L1.position.y = HIP - q.slide * .78;
  r.body.position.y = HIP + q.bodyY; r.body.rotation.x = q.tiltX; r.body.rotation.y = q.twist; r.body.rotation.z = q.roll;
  const A0 = r.arms[0], A1 = r.arms[1];
  A0.rotation.x = q.a0; A1.rotation.x = q.a1; A0.userData.lower.rotation.x = q.f0; A1.userData.lower.rotation.x = q.f1;
  A0.rotation.z = q.az0; A1.rotation.z = q.az1;
  r.head.rotation.y = q.hy; r.head.rotation.x = q.hx;
}
