// @ts-nocheck
// Street FB: glb character (Mixamo skeleton). Kit colours, skin tone and boots are tinted in a shader so one texture serves every team.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SkeletonUtils } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { computePose, SCALE } from './rig';

export const MODEL_H = 4.8;            // world height of the player
let base: any = null;
export const modelReady = () => !!base;
export function loadModel(url: string) {
  return new Promise((res, rej) => new GLTFLoader().load(url, (g: any) => { g.scene.updateMatrixWorld(true); base = g; res(g); }, undefined, rej));
}

const FRAG_HEAD = 'varying vec3 vRP;uniform vec3 uShirt,uShort,uSock,uTrim,uBoot,uSkin;uniform float uBootOn;';
const FRAG_BODY = `
  vec3 tc=diffuseColor.rgb;float mx=max(tc.r,max(tc.g,tc.b)),lum=dot(tc,vec3(.2126,.7152,.0722)),skn=(tc.r-tc.b)/max(mx,1e-4);
  float yy=vRP.y,ax=abs(vRP.x);
  float cloth=(1.-smoothstep(.12,.40,skn))*smoothstep(.10,.22,lum)*(1.-smoothstep(.345,.36,yy));
  float skinM=smoothstep(.45,.7,skn)*(1.-cloth)*smoothstep(.014,.03,lum);
  vec3 zone=yy>-0.035?uShirt:(yy>-0.19?uShort:uSock);
  float cuff=step(.2,yy)*step(yy,.255)*smoothstep(.158,.165,ax)*(1.-smoothstep(.172,.18,ax));
  float sockTop=step(-.255,yy)*step(yy,-.215);
  zone=mix(zone,uTrim,max(cuff,sockTop));
  vec3 o=tc;
  o=mix(o,zone*clamp(lum/.45,.35,1.3),cloth);
  o=mix(o,uSkin*clamp(lum/.032,.35,1.7),skinM);
  float bm=(1.-smoothstep(.03,.1,lum))*(1.-smoothstep(-.42,-.40,yy))*uBootOn;
  o=mix(o,uBoot*clamp(.45+lum*9.,.35,1.3),bm);
  diffuseColor.rgb=o;`;

export function makeModel(k: number, o: { skin: number, num: any, scaleVar?: number }) {
  const root = SkeletonUtils.clone(base.scene);
  const bones: any = {}; let skinned: any = null;
  root.traverse((n: any) => {
    if (n.isBone) bones[n.name.replace('mixamorig', '')] = n;
    if (n.isSkinnedMesh) { skinned = n; n.frustumCulled = false; n.castShadow = true; }
  });
  const mat = skinned.material = skinned.material.clone();
  mat.metalness = 0; mat.roughness = .82; mat.metalnessMap = null; mat.roughnessMap = null;
  const U: any = { shirt: new THREE.Color(0xffffff), short: new THREE.Color(0x222222), sock: new THREE.Color(0xffffff), trim: new THREE.Color(0xFF5A1F), boot: new THREE.Color(0x111111), skin: new THREE.Color(o.skin).convertSRGBToLinear() };
  const bootOn = { value: 0 };
  mat.onBeforeCompile = (sh: any) => {
    sh.uniforms.uShirt = { value: U.shirt }; sh.uniforms.uShort = { value: U.short }; sh.uniforms.uSock = { value: U.sock };
    sh.uniforms.uTrim = { value: U.trim }; sh.uniforms.uBoot = { value: U.boot }; sh.uniforms.uSkin = { value: U.skin }; sh.uniforms.uBootOn = bootOn;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvRP=position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + FRAG_HEAD).replace('#include <map_fragment>', '#include <map_fragment>\n' + FRAG_BODY);
  };
  mat.customProgramCacheKey = () => 'sfb-kit';
  // same interface the kit() code already uses: m.shirt.color.setHex(...)
  const wrap = (c: any, boot = false) => ({ color: { setHex: (h: number) => { c.setHex(h).convertSRGBToLinear(); if (boot) bootOn.value = h === 0x101010 ? 0 : 1; return c; } } });
  const m = { shirt: wrap(U.shirt), short: wrap(U.short), sock: wrap(U.sock), trim: wrap(U.trim), boot: wrap(U.boot, true) };
  m.boot.color.setHex(0x101010);

  // rest pose (all bone rotations are identity, so local axes == model axes)
  const rest: any = {}; Object.keys(bones).forEach(n => { rest[n] = bones[n].position.clone(); });
  // back number: floats on the spine so it moves with the torso
  const g = new THREE.Group(); g.add(root);
  const s = (MODEL_H) * (o.scaleVar || 1); root.scale.setScalar(s); root.position.y = .4992 * s;
  const num = new THREE.Mesh(new THREE.PlaneGeometry(.2, .2), new THREE.MeshBasicMaterial({ map: o.num, transparent: true, depthWrite: false }));
  num.position.set(0, .2, -.092); num.rotation.y = Math.PI; root.add(num); g.updateMatrixWorld(true); bones.Spine2.attach(num);
  return { g, bones, rest, m, s, mat };
}

const ang = (x: number, y = 0, z = 0) => new THREE.Euler(x, y, z, 'XYZ');
const setQ = (b: any, x: number, y = 0, z = 0) => b.quaternion.setFromEuler(ang(x, y, z));

// shared pose -> skeleton. Index 0 = character's right (-x), index 1 = left (+x).
export function animModel(r: any, p: any, c: any) {
  const q = computePose(r, p, c), B = r.bones, K = SCALE / r.s;
  const R = r.rest;
  B.Hips.position.set(R.Hips.x, R.Hips.y + q.bodyY * K, R.Hips.z);
  // legs: hip swing, knee fold, foot kept roughly level
  setQ(B.RightUpLeg, q.hip0, 0, 0); setQ(B.LeftUpLeg, q.hip1, 0, 0);
  setQ(B.RightLeg, q.kn0); setQ(B.LeftLeg, q.kn1);
  setQ(B.RightFoot, -(q.hip0 + q.kn0) * .55 + .1); setQ(B.LeftFoot, -(q.hip1 + q.kn1) * .55 + .1);
  // torso: lean/slide tilt, counter-rotation and roll shared over three spine bones
  const t = q.tiltX / 3, w = q.twist / 3, z = q.roll / 3;
  setQ(B.Spine, t, w, z); setQ(B.Spine1, t, w, z); setQ(B.Spine2, t, w, z);
  setQ(B.Neck, q.hx * .4, q.hy * .45, -q.roll * .3); setQ(B.Head, q.hx * .6, q.hy * .55, -q.roll * .3);
  // arms: model rests in an A-pose, so lower them first, then swing
  const low = .74;
  setQ(B.RightArm, q.a0, 0, low + q.az0); setQ(B.LeftArm, q.a1, 0, -(low - q.az1));
  setQ(B.RightForeArm, q.f0 * .9); setQ(B.LeftForeArm, q.f1 * .9);
  setQ(B.RightShoulder, 0); setQ(B.LeftShoulder, 0);
}
