// @ts-nocheck
import * as THREE from 'three';
import './style.css';
import {W,H,GOAL,R,BR,clamp,mk,step,ai,NOACT,summary} from '../shared/sim';
import {connect,reconnect,applySnap,netTick,resetNet,net} from './net';
import {TEAMS,FIELDS} from '../shared/data';
// ===== 3D RENDER (Three.js): sim x,y -> world x,z at 0.1 scale =====
const $=id=>document.getElementById(id),K=.1;
const ren=new THREE.WebGLRenderer({canvas:$('gl'),antialias:true});ren.setPixelRatio(Math.min(devicePixelRatio||1,1.5));ren.outputEncoding=THREE.sRGBEncoding;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x9fd0ee);scene.fog=new THREE.Fog(0x9fd0ee,80,190);
const cam=new THREE.PerspectiveCamera(45,1,.5,300);
scene.add(new THREE.HemisphereLight(0xffffff,0xb89a6a,.95));const dl=new THREE.DirectionalLight(0xfff0d0,.6);dl.position.set(-20,40,20);scene.add(dl);
const mat=c=>new THREE.MeshLambertMaterial({color:c});
const playerMat=c=>new THREE.MeshStandardMaterial({color:c,roughness:.82,metalness:0});
const box=(w,h,d,c,x,y,z)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(c));m.position.set(x,y,z);scene.add(m);return m};
function pitchTex(){const c=document.createElement('canvas');c.width=2000;c.height=1120;const g=c.getContext('2d'),r=Math.random;
 g.fillStyle='#b9ae9b';g.fillRect(0,0,2000,1120);
 for(let i=0;i<900;i++){g.fillStyle=`rgba(${r()<.5?'90,80,65':'230,220,200'},.12)`;g.fillRect(r()*2000,r()*1120,4+r()*14,3+r()*8)}
 g.fillStyle='rgba(224,178,58,.55)';[[420,300,230,130],[1500,820,260,140],[900,900,150,90]].forEach(e=>{g.beginPath();g.ellipse(e[0],e[1],e[2],e[3],.3,0,7);g.fill()});
 g.fillStyle='rgba(62,154,78,.6)';g.beginPath();g.moveTo(1180,380);g.lineTo(1420,340);g.lineTo(1520,480);g.lineTo(1400,640);g.lineTo(1260,600);g.closePath();g.fill();
 g.fillStyle='rgba(210,70,60,.5)';g.beginPath();g.ellipse(1330,500,60,45,0,0,7);g.fill();
 g.strokeStyle='rgba(60,50,40,.35)';g.lineWidth=3;for(let i=0;i<26;i++){g.beginPath();let x=r()*2000,y=r()*1120;g.moveTo(x,y);for(let j=0;j<6;j++){x+=(r()-.5)*160;y+=(r()-.5)*160;g.lineTo(x,y)}g.stroke()}
 g.strokeStyle='rgba(255,255,255,.9)';g.lineWidth=8;g.strokeRect(4,4,1992,1112);g.beginPath();g.moveTo(1000,0);g.lineTo(1000,1120);g.stroke();
 g.beginPath();g.arc(1000,560,140,0,7);g.stroke();g.strokeRect(4,300,260,520);g.strokeRect(1736,300,260,520);
 const t=new THREE.CanvasTexture(c);t.anisotropy=4;t.encoding=THREE.sRGBEncoding;return t}
// ===== FIELDS: street court / dust pitch / synthetic arena (rebuilt on demand) =====
const env=new THREE.Group();scene.add(env);
const crowdRows:any[]=[];let crowdCheering=false;
const add=(o,x,y,z)=>{o.position.set(x,y,z);env.add(o);return o};
const bx=(w,h,d,c,x,y,z)=>add(new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(c)),x,y,z);
const LINES=g=>{g.strokeStyle='rgba(255,255,255,.92)';g.lineWidth=8;g.strokeRect(4,4,1992,1112);g.beginPath();g.moveTo(1000,0);g.lineTo(1000,1120);g.stroke();g.beginPath();g.arc(1000,560,140,0,7);g.stroke();g.strokeRect(4,300,260,520);g.strokeRect(1736,300,260,520)};
function texOf(kind){const c=document.createElement('canvas');c.width=2000;c.height=1120;const g=c.getContext('2d'),r=Math.random;
 if(kind==='arena'){for(let i=0;i<10;i++){g.fillStyle=i%2?'#2f9d4d':'#38ab58';g.fillRect(i*200,0,200,1120)}for(let i=0;i<1800;i++){g.fillStyle='rgba(0,0,0,.05)';g.fillRect(r()*2000,r()*1120,3,7)}}
 else{g.fillStyle='#b9824f';g.fillRect(0,0,2000,1120);for(let i=0;i<1400;i++){g.fillStyle=`rgba(${r()<.5?'120,70,35':'235,190,140'},.13)`;g.beginPath();g.ellipse(r()*2000,r()*1120,6+r()*34,4+r()*16,r(),0,7);g.fill()}
  g.fillStyle='rgba(90,55,30,.25)';for(let i=0;i<9;i++){g.beginPath();g.ellipse(r()*2000,r()*1120,60+r()*80,30+r()*40,r(),0,7);g.fill()}}
 LINES(g);const t=new THREE.CanvasTexture(c);t.anisotropy=4;t.encoding=THREE.sRGBEncoding;return t}
const FLD={street:{sky:0x9fd0ee,gnd:0xc9a56d,tex:()=>pitchTex()},dust:{sky:0xf0b27a,gnd:0xb9824f,tex:()=>texOf('dust')},arena:{sky:0x16224a,gnd:0x1c2b45,tex:()=>texOf('arena')}};
const PAL=[0xe86f9a,0xf2c14e,0x5ec4b6,0xf4a259,0x8ecae6,0xe9a6c7,0xb7d968],AWN=[0xd62828,0x2a9d4f,0xf77f00,0x1d6fd6,0xf5c518];
function buildField(id){const f=FLD[id]||FLD.street;while(env.children.length)env.remove(env.children[0]);crowdRows.length=0;crowdCheering=false;scene.background.set(f.sky);scene.fog.color.set(f.sky);
 add(new THREE.Mesh(new THREE.PlaneGeometry(W*K,H*K),new THREE.MeshBasicMaterial({map:f.tex()})),0,0,0).rotation.x=-Math.PI/2;
 add(new THREE.Mesh(new THREE.PlaneGeometry(500,500),mat(f.gnd)),0,-.03,0).rotation.x=-Math.PI/2;
 const crowd=(n,x0,x1,z0,z1,y)=>{const im=new THREE.InstancedMesh(new THREE.CylinderGeometry(.45,.45,2,6),new THREE.MeshLambertMaterial({color:0xffffff}),n),M=new THREE.Matrix4(),C=new THREE.Color(),points:number[][]=[];for(let i=0;i<n;i++){const x=x0+Math.random()*(x1-x0),z=z0+Math.random()*(z1-z0);points.push([x,y,z]);M.setPosition(x,y,z);im.setMatrixAt(i,M);im.setColorAt(i,C.setHSL(Math.random(),.65,.55))}im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);env.add(im);crowdRows.push({im,points})};
 if(id==='arena'){for(let i=0;i<5;i++){bx(112,1.2,3,i%2?0x2b3a67:0x233057,0,.6+i*1.2,-33-i*3);crowd(26,-52,52,-33-i*3,-33-i*3,1.2*i+1.8)}
  for(let i=0;i<10;i++){const c=[0xff2e88,0x2a6fdb,0xc6ff3d,0xf6c90e,0xffffff][i%5];bx(10,1.5,.3,c,-45+i*10,.75,-29.5);bx(10,1.5,.3,c,-45+i*10,.75,29.5)}
  [-1,1].forEach(sx=>[-26,26].forEach(z=>{bx(.5,18,.5,0x888888,sx*54,9,z);bx(4,1,1,0xfff6c4,sx*54,18.2,z)}))}
 else if(id==='dust'){bx(130,5,1,0xc9a173,0,2.5,-33);for(let i=0;i<9;i++){const x=-60+i*15;bx(9,6+(i%3),6,[0xd9b38c,0xc79a6c,0xe5c9a5][i%3],x,3.5,-39);bx(10,.4,7,0x8b4b2a,x,7,-39)}
  [-48,-30,-12,16,38,54].forEach(x=>{add(new THREE.Mesh(new THREE.CylinderGeometry(.3,.45,8,6),mat(0x6b4a2b)),x,4,-31);for(let j=0;j<5;j++){const l=add(new THREE.Mesh(new THREE.ConeGeometry(.6,5,4),mat(0x2f7d32)),x+Math.cos(j*1.26)*2,8.5,-31+Math.sin(j*1.26)*2);l.rotation.z=Math.cos(j*1.26)*1.2;l.rotation.x=Math.sin(j*1.26)*1.2}});crowd(36,-45,45,-35.5,-35.5,1.2)}
 else{bx(W*K+8,.5,.8,0xf5c518,0,.25,-H*K/2-.6);
  for(let x=-80,i=0;x<80;i++){const w=11+(i*7%6),h=14+(i*5%9);bx(w,h,8,PAL[i%7],x+w/2,h/2,-46);bx(w-1.5,.35,3.2,AWN[i%5],x+w/2,7,-41.6);bx(2.4,4.5,.3,0x2b2118,x+w/2,2.3,-41.9);x+=w+.4}
  crowd(80,-55,55,-37,-33.5,1.2);add(new THREE.Mesh(new THREE.PlaneGeometry(W*K+8,3.2,70,4),new THREE.MeshBasicMaterial({color:0x444444,wireframe:true})),0,1.6,H*K/2+1.5)}
 const wc=id==='street'?[0xe07a1f,0x2f8f6a]:id==='dust'?[0xb08a5e,0xa07a50]:[0x1a2a55,0x1a2a55];
 [-1,1].forEach((sd,i)=>{bx(1,id==='arena'?3:5,H*K+4,wc[i],sd*(W*K/2+3.4),id==='arena'?1.5:2.5,0);[-1,1].forEach(g=>bx(.35,4,.35,0xffffff,sd*W*K/2,2,g*GOAL*K/2));bx(.35,.35,GOAL*K+.35,0xffffff,sd*W*K/2,4,0);
  add(new THREE.Mesh(new THREE.BoxGeometry(2.6,4,GOAL*K),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.14})),sd*(W*K/2+1.3),2,0)})}
// players: low-poly rig (swap for GLB models later)
const SK=[0x8d5524,0x5c3a21,0x3b2314,0xa86b3c,0x6f4426];
const shMat=new THREE.MeshBasicMaterial({color:0,transparent:true,opacity:.3}),shGeo=new THREE.CircleGeometry(1,16);
function blob(sc){const m=new THREE.Mesh(shGeo,shMat);m.rotation.x=-Math.PI/2;m.position.y=.04;m.scale.set(sc,sc,1);scene.add(m);return m}
let s=mk(),me=4,nick='KAZZ',inMenu=true;let lob:any=null,online:any=null,lastIn='',lastSend=0;
const HAIR=[0x111111,0x1a1008,0x2b1b10,0x111111,0x3b2314],BOOTS=[0x111111,0x171d2d,0x242018,0x101820,0x252525],NUMS=[4,8,7,11,9];
const numTex=n=>{const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');g.font='900 44px Impact,Arial';g.textAlign='center';g.fillStyle='#fff';g.strokeStyle='rgba(0,0,0,.5)';g.lineWidth=4;g.strokeText(n,32,50);g.fillText(n,32,50);return new THREE.CanvasTexture(c)};
const rigs=s.ps.map((p,k)=>{const g=new THREE.Group(),m={shirt:playerMat(0xffffff),short:playerMat(0x222222),sock:playerMat(0xffffff),skin:playerMat(SK[k%5]),hair:playerMat(HAIR[k%5]),boot:playerMat(BOOTS[k%5]),trim:playerMat(0xc6ff3d),eye:playerMat(0x10131e),white:playerMat(0xf4eadf),iris:playerMat([0x5c3623,0x302820,0x4a3428,0x332319,0x553722][k%5])};
 g.scale.set(1,.94+(k%4)*.035,1);
 const legs=[-.32,.32].map(ox=>{const l=new THREE.Group();l.position.set(ox,1.45,0);const th=new THREE.Mesh(new THREE.CylinderGeometry(.25,.21,.7,10),m.short),knee=new THREE.Mesh(new THREE.SphereGeometry(.19,9,7),m.short),shin=new THREE.Group(),sh=new THREE.Mesh(new THREE.CylinderGeometry(.145,.19,.58,10),m.sock),band=new THREE.Mesh(new THREE.CylinderGeometry(.194,.194,.1,10),m.trim),sole=new THREE.Mesh(new THREE.BoxGeometry(.42,.1,.7),m.boot),bt=new THREE.Mesh(new THREE.SphereGeometry(.23,9,7),m.boot),laces=new THREE.Mesh(new THREE.BoxGeometry(.1,.025,.26),m.white),studs=[-.14,0,.14].map(x=>new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.07,6),m.trim));th.position.y=-.35;knee.position.y=-.68;shin.position.y=-.7;sh.position.y=-.29;band.position.y=-.08;sole.position.set(0,-.73,.12);bt.position.set(0,-.65,.14);bt.scale.set(1,.55,1.5);laces.position.set(0,-.62,-.07);laces.rotation.x=-.18;studs.forEach((v,i)=>{v.position.set((i-1)*.12,-.79,.27);shin.add(v)});shin.add(sh,band,sole,bt,laces);l.add(th,knee,shin);l.userData.shin=shin;g.add(l);return l});
 const body=new THREE.Group();body.position.y=1.45;g.add(body);
 const tor=new THREE.Mesh(new THREE.CylinderGeometry(.58,.48,1.3,10),m.shirt);tor.position.y=.62;const chest=new THREE.Mesh(new THREE.SphereGeometry(1,10,8),m.shirt);chest.position.set(0,.84,-.015);chest.scale.set(.55,.42,.3);const sh2=new THREE.Mesh(new THREE.CylinderGeometry(.53,.58,.4,10),m.short);sh2.position.y=-.1;
 const collar=new THREE.Mesh(new THREE.TorusGeometry(.22,.055,5,10),m.trim);collar.position.set(0,1.26,0);collar.rotation.x=Math.PI/2;
 const chestStripe=new THREE.Mesh(new THREE.BoxGeometry(.12,.92,.035),m.trim);chestStripe.position.set(-.34,.66,-.53);chestStripe.visible=k%3===0;const kitBand=new THREE.Mesh(new THREE.BoxGeometry(.82,.1,.04),m.trim);kitBand.position.set(0,.64,-.54);kitBand.visible=k%3===1;const shoulderPipes=[-1,1].map(x=>{const v=new THREE.Mesh(new THREE.BoxGeometry(.12,.45,.04),m.trim);v.position.set(x*.48,1.04,-.08);v.rotation.z=x*.2;return v});const waist=new THREE.Mesh(new THREE.TorusGeometry(.49,.035,5,12),m.trim);waist.position.y=.05;waist.rotation.x=Math.PI/2;
 const badge=new THREE.Mesh(new THREE.CircleGeometry(.1,6),m.trim);badge.position.set(.32,.92,-.55);badge.rotation.y=Math.PI;
 const neck=new THREE.Mesh(new THREE.CylinderGeometry(.18,.2,.28,7),m.skin);neck.position.y=1.38;
 const hd=new THREE.Mesh(new THREE.SphereGeometry(.5,10,8),m.skin);hd.position.y=1.72;
 const eyes=[-.14,.14].map(x=>{const eye=new THREE.Mesh(new THREE.SphereGeometry(.075,9,7),m.white);eye.position.set(x,1.78,-.435);const iris=new THREE.Mesh(new THREE.SphereGeometry(.041,8,6),m.iris);iris.position.set(x,1.78,-.498);const pupil=new THREE.Mesh(new THREE.SphereGeometry(.022,7,5),m.eye);pupil.position.set(x,1.78,-.533);return[eye,iris,pupil]}).flat();
 const brows=[-.14,.14].map(x=>{const e=new THREE.Mesh(new THREE.BoxGeometry(.13,.035,.035),m.hair);e.position.set(x,1.91,-.45);return e});
 const ears=[-1,1].map(x=>{const e=new THREE.Mesh(new THREE.SphereGeometry(.12,6,5),m.skin);e.position.set(x*.49,1.72,0);return e});
 const nose=new THREE.Mesh(new THREE.SphereGeometry(.085,7,6),m.skin);nose.position.set(0,1.69,-.49);nose.scale.set(.72,.78,1.15);
 const mouth=new THREE.Mesh(new THREE.BoxGeometry(.14,.025,.025),m.eye);mouth.position.set(0,1.56,-.475);
 const shoulders=[-1,1].map(x=>{const e=new THREE.Mesh(new THREE.SphereGeometry(.28,7,6),m.shirt);e.position.set(x*.48,.98,0);e.scale.set(1,.72,1);return e});
 const hs=k%5,hr=new THREE.Mesh(new THREE.SphereGeometry(.53,8,6,0,6.3,0,hs===1?1.1:hs===2?.68:hs===3?.82:hs===4?1.7:1.35),m.hair);hr.position.y=hs===2?1.88:hs===3?1.8:1.76;hr.scale.set(hs===2?.92:hs===3?.62:hs===4?1.06:1,hs===2?.9:hs===3?1.35:hs===4?.68:1,hs===3?.75:1);
 const hairBand=new THREE.Mesh(new THREE.TorusGeometry(.45,.045,5,12),m.trim);hairBand.position.y=1.68;hairBand.rotation.x=Math.PI/2;hairBand.visible=k%4===0;
 const num=new THREE.Mesh(new THREE.PlaneGeometry(.7,.7),new THREE.MeshBasicMaterial({map:numTex(NUMS[p.i]),transparent:true}));num.position.set(0,.7,-.57);num.rotation.y=Math.PI;
 const arms=[-1,1].map(sd=>{const a=new THREE.Group();a.position.set(sd*.8,1.15,0);const sl=new THREE.Mesh(new THREE.CylinderGeometry(.16,.22,.42,10),m.shirt),cuff=new THREE.Mesh(new THREE.CylinderGeometry(.17,.17,.09,10),m.trim),elbow=new THREE.Mesh(new THREE.SphereGeometry(.145,9,7),m.skin),lower=new THREE.Group(),ar=new THREE.Mesh(new THREE.CylinderGeometry(.105,.145,.52,10),m.skin),hand=new THREE.Mesh(new THREE.SphereGeometry(.13,8,6),m.skin);sl.position.y=-.17;cuff.position.y=-.38;elbow.position.y=-.43;lower.position.y=-.43;ar.position.y=-.25;hand.position.set(0,-.51,-.015);hand.scale.set(.78,1.15,.72);lower.add(ar,hand);a.add(sl,cuff,elbow,lower);a.userData.lower=lower;body.add(a);return a});
 body.add(tor,chest,sh2,collar,chestStripe,kitBand,...shoulderPipes,waist,badge,neck,hd,hr,hairBand,nose,mouth,...eyes,...brows,...ears,...shoulders,num);scene.add(g);const skid=new THREE.Mesh(new THREE.CircleGeometry(.48,14),new THREE.MeshBasicMaterial({color:0x5b4932,transparent:true,opacity:.38,depthWrite:false}));skid.rotation.x=-Math.PI/2;skid.scale.set(.85,2.4,1);skid.position.y=.055;scene.add(skid);return{g,legs,arms,body,m,sh:blob(1.1),skid,ph:0,ang:0,turn:0}});
// kits: shirt colour clashes are resolved by giving the second team its away shirt
const hex=c=>'#'+c.toString(16).padStart(6,'0'),far=(a,b)=>Math.hypot((a>>16)-(b>>16),((a>>8)&255)-((b>>8)&255),(a&255)-(b&255))>120;
const shirts=t=>{const a=TEAMS[t[0]],b=TEAMS[t[1]];return[a.c,far(a.c,b.c)?b.c:b.a]};
function kit(t){const sc=shirts(t);s.ps.forEach((p,k)=>{const T=TEAMS[t[p.t]],q=rigs[k].m,away=p.t&&sc[1]===T.a;q.shirt.color.setHex(sc[p.t]);q.short.color.setHex(away?T.c:T.s);q.sock.color.setHex(away?T.c:T.k);q.trim.color.setHex(sc[p.t]===0xc6ff3d?0xffffff:0xc6ff3d)})}
function board(t){const sc=shirts(t),lum=c=>(c>>16)*.3+((c>>8)&255)*.59+(c&255)*.11;[['nm',0],['nr',1]].forEach(([id,i])=>{const e=$(id);e.textContent=TEAMS[t[i]].sh;e.style.background=hex(sc[i]);e.style.color=lum(sc[i])>150?'#0b1226':'#fff'})}
let curTeams=[0,2];const look=(f,t)=>{curTeams=t;buildField(f);kit(t);board(t)};
// name tags for every real player (team coloured) + "PASS!" call bubbles (own team only)
const tagCache={},tags=s.ps.map(()=>{const sp=new THREE.Sprite(new THREE.SpriteMaterial({transparent:true,depthTest:false}));sp.scale.set(6,1.5,1);sp.visible=false;scene.add(sp);return{sp,key:''}});
function tagTex(txt,col,fg){const key=txt+col+fg;if(tagCache[key])return tagCache[key];const c=document.createElement('canvas');c.width=256;c.height=64;const g=c.getContext('2d');g.fillStyle=col;g.beginPath();g.roundRect?g.roundRect(8,10,240,44,22):g.rect(8,10,240,44);g.fill();g.font='900 30px Impact,Arial Narrow,sans-serif';g.textAlign='center';g.fillStyle=fg;g.fillText(txt,128,44,220);return tagCache[key]=new THREE.CanvasTexture(c)}
const callTex=(()=>{const c=document.createElement('canvas');c.width=256;c.height=96;const g=c.getContext('2d');g.fillStyle='#ff2e88';g.beginPath();g.moveTo(20,10);g.lineTo(236,10);g.lineTo(236,60);g.lineTo(140,60);g.lineTo(128,84);g.lineTo(116,60);g.lineTo(20,60);g.closePath();g.fill();g.font='900 40px Impact,Arial';g.textAlign='center';g.fillStyle='#fff';g.fillText('PASS!',128,50);return new THREE.CanvasTexture(c)})();
const calls=s.ps.map(()=>{const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:callTex,transparent:true,depthTest:false}));sp.scale.set(5,1.9,1);sp.visible=false;scene.add(sp);return sp});
function tagsUpdate(){const myT=s.ps[me].t,sc=shirts(curTeams);s.ps.forEach((p,k)=>{const g=rigs[k].g.position,tg=tags[k],nm=p.off?'':online?(s.nicks&&s.nicks[k]):(k===me?nick:'');
 if(nm){const col=hex(sc[p.t]),fg=((sc[p.t]>>16)*.3+((sc[p.t]>>8)&255)*.59+(sc[p.t]&255)*.11)>150?'#0b1226':'#fff',key=nm+col;if(tg.key!==key){tg.key=key;tg.sp.material.map=tagTex(nm,col,fg);tg.sp.material.needsUpdate=true}tg.sp.visible=true;tg.sp.position.set(g.x,k===me?6.4:5.6,g.z)}else tg.sp.visible=false;
 const on=!p.off&&p.t===myT&&(online?s.calls&&s.calls.has(k):p.cl>0),c=calls[k];c.visible=!!on;if(on)c.position.set(g.x,7.4+Math.abs(Math.sin(tt*8))*.5,g.z)})}

const ballM=new THREE.Mesh(new THREE.SphereGeometry(.55,12,10),new THREE.MeshLambertMaterial({color:0xffffff}));scene.add(ballM);const ballSh=blob(.6);
const mark=new THREE.Mesh(new THREE.ConeGeometry(.5,1,4),new THREE.MeshBasicMaterial({color:0x35e0ff}));mark.rotation.x=Math.PI;scene.add(mark);
let cx=0,cz=0,tt=0;
function render(dt){tt+=dt;
 const cheering=!rep&&s.kind==='goal'&&s.pause>0;if(cheering||crowdCheering){crowdCheering=cheering;const M=new THREE.Matrix4();crowdRows.forEach(({im,points})=>{points.forEach(([x,y,z],i)=>{M.makeTranslation(x,y+(cheering?(Math.sin(tt*16+i*1.7)+1)*.42:0),z);im.setMatrixAt(i,M)});im.instanceMatrix.needsUpdate=true})}
 s.ps.forEach((p,k)=>{const r=rigs[k],sp=Math.hypot(p.vx,p.vy),slide=clamp(p.sl*2,0,1);r.g.visible=r.sh.visible=!p.off;r.skid.visible=!p.off&&slide>.02;r.g.position.set((p.x-W/2)*K,0,(p.y-H/2)*K);
  let da=Math.atan2(p.fx,p.fy)-r.ang;da=Math.atan2(Math.sin(da),Math.cos(da));r.turn=da;r.ang+=da*Math.min(1,dt*14);r.g.rotation.y=r.ang;r.skid.position.set(r.g.position.x,.055,r.g.position.z);r.skid.rotation.set(-Math.PI/2,0,r.ang);(r.skid.material as THREE.MeshBasicMaterial).opacity=.38*slide;
  r.ph+=sp*dt*.09;const run=clamp(sp/150,0,1),w=Math.sin(r.ph)*.9*run*(1-slide);const cel=!rep&&s.kind==='goal'&&s.pause>0&&p.t===s.gt;
  r.legs[0].rotation.x=w+(p.kk>0?-1.2:0)+slide*.9;r.legs[1].rotation.x=-w-slide*.35;r.legs[0].userData.shin.rotation.x=Math.max(0,Math.sin(r.ph))*.62*run*(1-slide);r.legs[1].userData.shin.rotation.x=Math.max(0,-Math.sin(r.ph))*.62*run*(1-slide);r.arms[0].rotation.x=cel?-2.8:slide?-1.35:-w*.9;r.arms[1].rotation.x=cel?-2.8:slide?-.95:w*.9;r.arms[0].userData.lower.rotation.x=cel?-.85:slide?-.5:Math.max(0,-w)*.55;r.arms[1].userData.lower.rotation.x=cel?-.85:slide?-.35:Math.max(0,w)*.55;
  const bob=Math.abs(Math.sin(r.ph*2))*.065*Math.min(1,sp/120)*(1-slide);r.body.position.y=1.45+bob-slide*.62;r.body.rotation.x=-slide*.95+(1-slide)*Math.min(.34,sp/650);r.body.rotation.z=clamp(-p.vy/1900,-.13,.13)+clamp(r.turn,-.4,.4)*.28;r.g.rotation.z=p.stun>0?.5:0;r.g.position.y=-slide*.06+(cel?Math.abs(Math.sin(tt*10+k))*1.1:0);
  r.sh.position.x=r.g.position.x;r.sh.position.z=r.g.position.z});
 const b=s.ball,bx=(b.x-W/2)*K,bz=(b.y-H/2)*K;ballM.position.set(bx,.55+b.h*K,bz);ballM.rotation.z-=b.vx*dt*K/.55;ballM.rotation.x+=b.vy*dt*K/.55;ballSh.position.set(bx,.04,bz);ballSh.scale.setScalar(.6/(1+b.h*.02));
 const mg=rigs[me].g.position;mark.position.set(mg.x,5+Math.sin(tt*5)*.25,mg.z);tagsUpdate();
 const k=1.2*Math.max(1,1.9/cam.aspect);const fx0=online&&!rep?mg.x:bx,fz0=online&&!rep?mg.z:bz; // online: the camera follows YOUR player, not the ball
 cx+=(clamp(fx0,-30,30)-cx)*Math.min(1,dt*(online?4:3));cz+=(fz0*(online?.7:.5)-cz)*Math.min(1,dt*3);
 cam.position.set(cx,30*k,cz+26*k);cam.lookAt(cx,0,cz);ren.render(scene,cam)}
function resize(){ren.setSize(innerWidth,innerHeight,false);cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix()}addEventListener('resize',resize);resize();
const mmc=$('mm'),mx_=mmc.getContext('2d');
function minimap(){const w=260,h=148,sx=w/W,sy=h/H;mx_.clearRect(0,0,w,h);mx_.fillStyle='rgba(30,30,25,.55)';mx_.fillRect(0,0,w,h);mx_.strokeStyle='rgba(255,255,255,.5)';mx_.strokeRect(2,2,w-4,h-4);mx_.beginPath();mx_.moveTo(w/2,0);mx_.lineTo(w/2,h);mx_.stroke();
 s.ps.forEach((p,k)=>{mx_.fillStyle=k===me?'#35e0ff':p.t?'#4d8cff':'#f0e6c8';mx_.beginPath();mx_.arc(p.x*sx,p.y*sy,k===me?6:4.5,0,7);mx_.fill()});mx_.fillStyle='#fff';mx_.beginPath();mx_.arc(s.ball.x*sx,s.ball.y*sy,3.5,0,7);mx_.fill()}
// ===== INPUT =====
const keys={},btn={},press={},stick={x:0,y:0};let paused=false;
const KM={' ':'shoot',e:'pass',r:'thru',f:'lob',shift:'sprint',c:'shield',v:'skill',q:'tackle'};
addEventListener('keydown',e=>{if(e.target.tagName==='INPUT')return;const k=e.key.toLowerCase();keys[k]=1;if(KM[k])press[KM[k]]=1;if(k==='x')sw();if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault()});
addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=0});
function sw(){if(online)return;let best=-1,bd=1e9;s.ps.forEach((q,j)=>{if(q.t===0&&!q.off&&j!==me){const d=Math.hypot(q.x-s.ball.x,q.y-s.ball.y);if(d<bd){bd=d;best=j}}});if(best>=0)me=best}
$('sw').onpointerdown=sw;$('pz').onclick=()=>{paused=!paused;$('pz').textContent=paused?'>':'II'};
const zone=$('zone'),ring=zone.querySelector('i'),knob=$('knob');let sid=null,ox=0,oy=0;
function sv(e){let dx=e.clientX-ox,dy=e.clientY-oy;const m=Math.hypot(dx,dy);if(m>55){dx*=55/m;dy*=55/m}stick.x=dx/55;stick.y=dy/55;knob.style.transform=`translate(${dx}px,${dy}px)`}
zone.onpointerdown=e=>{sid=e.pointerId;zone.setPointerCapture(sid);ox=e.clientX;oy=e.clientY;ring.style.cssText=`display:block;left:${ox-55}px;top:${oy-55}px`;sv(e)};
zone.onpointermove=e=>{if(e.pointerId===sid)sv(e)};
zone.onpointerup=zone.onpointercancel=()=>{sid=null;stick.x=stick.y=0;knob.style.transform='';ring.style.display='none'};
document.querySelectorAll('#btns button').forEach(b=>{const k=b.dataset.k;b.onpointerdown=e=>{btn[k]=1;press[k]=1;b.setPointerCapture(e.pointerId)};b.onpointerup=b.onpointercancel=()=>{btn[k]=0}});
addEventListener('contextmenu',e=>e.preventDefault());
let chg=0,wasDown=0,fdt=0,pgSw=0,pgSt=0;
function gp(){const g=navigator.getGamepads?[...navigator.getGamepads()].find(x=>x&&x.connected):null;if(!g)return null;const dz=v=>Math.abs(v)>.18?v:0,B=i=>!!(g.buttons[i]&&g.buttons[i].pressed);let mx=dz(g.axes[0]||0),my=dz(g.axes[1]||0);if(B(14))mx-=1;if(B(15))mx+=1;if(B(12))my-=1;if(B(13))my+=1;
 return{mx,my,pass:B(0),lob:B(1),shoot:B(2),thru:B(3),sw:B(4),sprint:B(5),shield:B(6),skill:B(7),start:B(9)}}
function human(){const g=gp(),o={mx:stick.x+(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0),my:stick.y+(keys.s||keys.arrowdown?1:0)-(keys.w||keys.arrowup?1:0)};
 const on=k=>btn[k]||press[k]||Object.keys(KM).some(c=>KM[c]===k&&keys[c])||(g&&g[k]);
 if(g){o.mx+=g.mx;o.my+=g.my;if(g.sw&&!pgSw)sw();pgSw=g.sw;if(g.start&&!pgSt){$('mb').click()}pgSt=g.start}
 for(const k of['sprint','pass','lob','thru','shield','skill','tackle'])o[k]=on(k)?1:0;
 const opp=s.own>=0&&s.ps[s.own].t!==s.ps[me].t,down=!opp&&on('shoot');if(down)chg+=fdt;o.shoot=0;if(!down&&wasDown){o.shoot=clamp(.4+chg*.75,.4,1);chg=0}wasDown=down;
 $('pwr').style.display=down?'block':'none';$('pwr').firstChild.style.width=Math.min(100,(.4+chg*.75)*100)+'%';
 if(opp){o.press=o.pass;o.pass=0;if(on('shoot'))o.tackle=1;if(o.lob){o.slide=1;o.lob=0}}else if(s.own>=0&&s.own!==me&&s.ps[s.own].t===s.ps[me].t&&o.pass){o.call=1;o.pass=0}else if(s.own!==me&&o.pass&&!(s.own<0&&Math.hypot(s.ball.x-s.ps[me].x,s.ball.y-s.ps[me].y)<75)){o.tackle=1;o.pass=0}o.h=1;return o} // defending: X press, Square tackle, Circle slide
// ===== UI + LOOP =====
function auto(){if(s.mode==='shootout'||s.pause>0)return;if(s.own>=0&&s.ps[s.own].t===0){me=s.own;return}if(s.own<0&&s.rcv>=0&&s.rcvT>0&&s.ps[s.rcv].t===0){me=s.rcv;return}
 let bd=Math.hypot(s.ps[me].x-s.ball.x,s.ps[me].y-s.ball.y),bi=me;s.ps.forEach((q,j)=>{if(q.t===0&&!q.off){const d=Math.hypot(q.x-s.ball.x,q.y-s.ball.y);if(d<bd-25){bd=d;bi=j}}});me=bi}
const portrait=()=>matchMedia('(orientation:portrait) and (pointer:coarse)').matches;
function lockLand(){const e=document.documentElement;try{(e.requestFullscreen?e.requestFullscreen():Promise.reject()).then(()=>screen.orientation&&screen.orientation.lock&&screen.orientation.lock('landscape')).catch(()=>{})}catch(x){}}
let shown='',connectionNotice='',last=performance.now(),acc=0,loaded=false;
// ===== SOUND (synthesised, no files) + VIBRATION =====
const AU:any={ctx:null,on:localStorage.getItem('sfc-snd')!=='0'};
function audioInit(){if(AU.ctx){AU.ctx.resume&&AU.ctx.resume();return}const C=(window as any).AudioContext||(window as any).webkitAudioContext;if(!C)return;const x=new C();AU.ctx=x;AU.m=x.createGain();AU.m.gain.value=.55;AU.m.connect(x.destination);
 const n=x.sampleRate*2,b=x.createBuffer(1,n,x.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;AU.nb=b}
['pointerdown','keydown','touchstart'].forEach(e=>addEventListener(e,audioInit,{once:true,passive:true}));
function tone(f0:number,f1:number,dur:number,type:any,vol:number,delay=0){if(!AU.ctx||!AU.on)return;const x=AU.ctx,t=x.currentTime+delay,o=x.createOscillator(),g=x.createGain();o.type=type;o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur);g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);o.connect(g);g.connect(AU.m);o.start(t);o.stop(t+dur+.02)}
function burst(dur:number,freq:number,vol:number,delay=0){if(!AU.ctx||!AU.on)return;const x=AU.ctx,t=x.currentTime+delay,s0=x.createBufferSource(),f=x.createBiquadFilter(),g=x.createGain();s0.buffer=AU.nb;f.type='lowpass';f.frequency.value=freq;g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);s0.connect(f);f.connect(g);g.connect(AU.m);s0.start(t,Math.random());s0.stop(t+dur)}
const sfx:any={kick:()=>{tone(170,55,.12,'sine',.5);burst(.05,900,.25)},tackle:()=>{burst(.16,500,.5);tone(90,40,.18,'sine',.45)},click:()=>tone(660,880,.05,'square',.08),
 whistle:()=>{tone(2300,2200,.35,'sine',.18);tone(2310,2210,.35,'sine',.12,.4)},step:()=>{tone(520,780,.12,'triangle',.22);tone(780,1040,.14,'triangle',.22,.12)},
 goal:()=>{sfx.whistle();burst(1.6,1800,.25)}};
const vib=(p:any)=>{if(AU.on&&navigator.vibrate)navigator.vibrate(p)};
const sndBtn=document.createElement('button');sndBtn.id='snd';sndBtn.textContent=AU.on?'Sound on':'Muted';document.body.appendChild(sndBtn);
sndBtn.onclick=()=>{AU.on=!AU.on;try{localStorage.setItem('sfc-snd',AU.on?'1':'0')}catch(e){}sndBtn.textContent=AU.on?'Sound on':'Muted';audioInit();sfx.click()};
const pk:number[]=Array(10).fill(0),psl:number[]=Array(10).fill(0);let pGoal=false,pFoul=false,pOver=false,pOwnT=-1;
function sfxWatch(){if(!AU.ctx||!AU.on)return;
 s.ps.forEach((p:any,k:number)=>{const a=p.kk>0?1:0,b=p.sl>0?1:0;if(a&&!pk[k]){sfx.kick();if(k===me)vib(12)}if(b&&!psl[k]){sfx.tackle();if(k===me)vib(35)}pk[k]=a;psl[k]=b});
 const ot=s.own>=0?s.ps[s.own].t:-1;if(ot>=0){if(pOwnT>=0&&ot!==pOwnT){sfx.tackle();if(s.own===me)vib(30)}pOwnT=ot}
 const g=s.kind==='goal'&&s.pause>0&&s.msg&&s.msg!=='Kickoff';if(g&&!pGoal){sfx.goal();vib(s.gt===s.ps[me].t?[80,40,200]:[60])}pGoal=g;
 const f=(s.kind==='foul'||s.kind==='pen')&&s.pause>0;if(f&&!pFoul){sfx.whistle();vib(70)}pFoul=f;
 if(s.over&&!pOver){sfx.whistle();sfx.whistle()}pOver=s.over}
// ===== INSTALL AS AN APP (PWA) =====
let deferredInstall:any=null;addEventListener('beforeinstallprompt',(e:any)=>{e.preventDefault();deferredInstall=e});
const standalone=matchMedia('(display-mode: standalone)').matches||(navigator as any).standalone;
if('serviceWorker' in navigator&&(import.meta as any).env?.PROD)navigator.serviceWorker.register('/sw.js').catch(()=>{});
// ===== CAREER (saved on this phone) =====
const career:any=(()=>{try{return JSON.parse(localStorage.getItem('sfc-career')||'')}catch(e){return null}})()||{m:0,w:0,d:0,l:0,g:0,a:0,motm:0,cups:0};
const saveCar=()=>{try{localStorage.setItem('sfc-career',JSON.stringify(career))}catch(e){}};
function recordMatch(d:any){const rows=online?(d.rows[me]?[d.rows[me]]:[]):d.rows.filter((r:any)=>r.hu&&r.t===0);if(online&&!rows.length)return;const t=online?rows[0].t:0;
 career.m++;const gf=d.score[t],ga=d.score[1-t];if(gf>ga)career.w++;else if(gf===ga)career.d++;else career.l++;
 rows.forEach((r:any)=>{career.g+=r.g;career.a+=r.a;if(d.rows[d.motm]&&d.rows[d.motm].k===r.k)career.motm++});saveCar()}
// ===== STREET CUP: quarter-final, semi-final, final (progress saved) =====
let cup:any=(()=>{try{return JSON.parse(localStorage.getItem('sfc-cup')||'')}catch(e){return null}})();let curCup:any=null;
const saveCup=()=>{try{cup?localStorage.setItem('sfc-cup',JSON.stringify(cup)):localStorage.removeItem('sfc-cup')}catch(e){}};
const RND=['Quarter-final','Semi-final','Final'],RD=[.9,1,1.12];
function cupNew(){const t=cfg.teams[0],pool=TEAMS.map((_:any,i:number)=>i).filter((i:number)=>i!==t).sort(()=>Math.random()-.5).slice(0,3);cup={team:t,opps:pool,round:0,out:false};saveCup();show('cup')}
function cupScreen(){const m=$('menu');
 if(cup.round>=3){m.innerHTML=`<h2>Champions!</h2><div class="big">&#127942;</div><small>${TEAMS[cup.team].n} won the Street Cup</small><div class="row"><button class="go" id="cn">New cup</button><button class="chip" data-to="modes">Menu</button></div>`;return}
 if(cup.out){m.innerHTML=`<h2>Knocked out</h2><small>${RND[cup.round]} - lost to ${TEAMS[cup.opps[cup.round]].n}</small><div class="row"><button class="go" id="cr">Try again</button><button class="chip" data-to="modes">Menu</button></div>`;return}
 m.innerHTML=`<h2>Street Cup</h2><div class="stp" style="grid-template-columns:repeat(3,1fr)">${[0,1,2].map(i=>{const T=TEAMS[cup.opps[i]];return`<div class="sp${i<cup.round?' off':''}"><small class="lb">${RND[i]}</small><div class="c2">${jersey(T.c,T.s)}<b>${T.n}</b><span>${i<cup.round?'won':i===cup.round?'next match':'locked'}</span></div></div>`}).join('')}</div><div class="row"><button class="go" id="cg">Play ${RND[cup.round]}</button><button class="chip" id="cn">Restart cup</button><button class="chip" data-to="modes">Menu</button></div>`}
function cupPlay(){cfg.teams=[cup.team,cup.opps[cup.round]];curCup={golden:false};start({mode:'match',len:90,diff:RD[cup.round]})}
function cupAfter(){const win=s.score[0]>s.score[1],draw=s.score[0]===s.score[1];
 if(curCup&&!curCup.golden&&draw){curCup={golden:true};start({mode:'match',len:60,diff:RD[cup.round],golden:true});return}
 let won=win;if(draw){won=Math.random()<.5;flash('Still level - decided on a coin toss')}
 curCup=null;if(won){cup.round++;if(cup.round>=3){career.cups++;saveCar()}}else cup.out=true;saveCup();show('cup')}
// ===== GUIDED TUTORIAL + SHORT TRAINING DRILLS =====
let tut:any=null,drill:any=null;const tutEl=document.createElement('div');tutEl.id='tut';document.body.appendChild(tutEl);
const isTouch=matchMedia('(pointer:coarse)').matches;let touchLeft=false;try{touchLeft=localStorage.getItem('sfc-touch-layout')==='left'}catch(e){}document.body.classList.toggle('touch-left',touchLeft);
const lab=(a:string):string=>{const P:any={pass:'X (cross)',shoot:'Square',sprint:'R1',move:'the left stick'},T:any={pass:'the Pass button',shoot:'the Shoot button',sprint:'Sprint',move:'the left half of the screen as a stick'},K:any={pass:'E',shoot:'Space',sprint:'Shift',move:'W A S D'};return document.body.classList.contains('pad')?P[a]:isTouch?T[a]:K[a]};
const teamSum=(k:string)=>s.st.slice(0,5).reduce((a:number,x:any)=>a+x[k],0);
const TUT=[{t:()=>`Run: use ${lab('move')} to move around`,ok:()=>tut.dist>160},{t:()=>`Sprint: hold ${lab('sprint')} while you run`,ok:()=>tut.spr>1.2},
 {t:()=>`Pass: press ${lab('pass')} to pass to a teammate`,ok:()=>teamSum('pa')>tut.pa0},{t:()=>`Shoot: hold ${lab('shoot')}, release to shoot. Longer hold = harder shot`,ok:()=>teamSum('sh')>tut.sh0},{t:()=>`Now score a goal!`,ok:()=>s.score[0]>=1}];
function tutShow(){if(!tut){tutEl.style.display='none';return}tutEl.style.display='block';tutEl.innerHTML=tut.done?`<div><b>You're ready!</b> Open Menu and play a match.</div><button type="button" id="tut-done">Continue</button>`:`<div><b>Step ${tut.i+1}/${TUT.length}</b> ${TUT[tut.i].t()}</div><button type="button" id="tut-skip">Skip tutorial</button>`}
function tutStart(){tut={i:0,dist:0,spr:0,pa0:teamSum('pa'),sh0:teamSum('sh'),done:false};tutShow()}
function startTraining(id:string){start({mode:'training'});tut=null;const defs:any={passing:{title:'PASSING RUN',goal:'Complete 5 passes',base:teamSum('pc')},finishing:{title:'FINISHING',goal:'Score 3 goals',base:0},control:{title:'BALL CONTROL',goal:'Accumulate 8 seconds of team possession',base:0}};drill={id,...defs[id],progress:0,done:false};drillShow()}
function drillShow(){if(!drill)return;const p=Math.min(drill.progress,drill.id==='passing'?5:drill.id==='finishing'?3:8),target=drill.id==='passing'?5:drill.id==='finishing'?3:8;tutEl.style.display='block';tutEl.innerHTML=drill.done?`<div><b>${drill.title} COMPLETE</b><br>Nice work.</div><button type="button" id="drill-done">Menu</button>`:`<div><b>${drill.title}</b><br>${drill.goal}<small class="drill-progress">${drill.id==='control'?p.toFixed(1):Math.floor(p)} / ${target}</small></div><button type="button" id="drill-exit">Exit drill</button>`}
function tutWatch(dt:number,hu:any){if(s.mode!=='training')return;if(drill&&!drill.done){if(drill.id==='passing')drill.progress=teamSum('pc')-drill.base;else if(drill.id==='finishing')drill.progress=s.score[0];else if(s.own>=0&&s.ps[s.own].t===0)drill.progress+=dt;
 const target=drill.id==='passing'?5:drill.id==='finishing'?3:8;if(drill.progress>=target){drill.done=true;sfx.step();vib(35)}if(Math.floor(drill.progress*2)!==drill.lastDraw||drill.done){drill.lastDraw=Math.floor(drill.progress*2);drillShow()}return}if(!tut||tut.done)return;const p=s.ps[me],v=Math.hypot(p.vx,p.vy);tut.dist+=v*dt;if(hu&&hu.sprint&&v>150)tut.spr+=dt;
 if(TUT[tut.i].ok()){tut.i++;sfx.step();vib(25);flash('Nice!');if(tut.i>=TUT.length){tut.done=true;try{localStorage.setItem('sfc-tut','1')}catch(e){}}tutShow()}}
function trainingIdle(p:any){return p.off||(s.mode==='training'&&p.t&&!(drill?.id==='finishing'&&p.i<2||drill?.id==='control'&&p.i===0))}
tutEl.addEventListener('click',e=>{const id=(e.target as HTMLElement).id;if(id==='drill-exit'||id==='drill-done'){drill=null;tutEl.style.display='none';show('modes')}else if(id==='tut-skip'){tut.done=true;try{localStorage.setItem('sfc-tut','1')}catch(e){}tutShow()}else if(id==='tut-done'){tut=null;tutShow();show('modes')}});
// ===== GOAL REPLAY (slow motion, client side) =====
const REC:any[]=[];let recT=0,rep:any=null,repSaved:any=null,repBall:any=null,repArm=false,repAt=0,repDone=false;
const repEl=document.createElement('div');repEl.id='rep';repEl.innerHTML='<i></i>REPLAY <button id="repskip">Skip</button>';document.body.appendChild(repEl);
(repEl.querySelector('#repskip') as any).onclick=()=>{rep=null;repDone=true};
function recFrame(now:number){if(rep||s.pause>0||inMenu||s.over||now-recT<33)return;recT=now;REC.push({t:now,p:s.ps.map((p:any)=>[p.x,p.y,p.fx,p.fy,p.vx,p.vy,p.sl,p.kk,p.stun]),b:[s.ball.x,s.ball.y,s.ball.h]});while(REC.length&&now-REC[0].t>3000)REC.shift()}
function repTick(now:number){const g=s.kind==='goal'&&s.pause>0&&s.mode==='match'&&!s.over;
 if(g&&!repArm){repArm=true;repAt=now+1500;repDone=false}if(!g){repArm=false;if(rep)rep=null}
 if(g&&!rep&&!repDone&&now>=repAt&&REC.length>12){const last=REC[REC.length-1].t;rep={f:REC.filter(f=>f.t>last-2400),t0:now}}
 repEl.style.display=rep?'flex':'none';if(!rep)return;
 const F=rep.f,e=(now-rep.t0)*.65,span=F[F.length-1].t-F[0].t;if(e>=span){rep=null;repDone=true;repEl.style.display='none';return}
 let i=0;while(i<F.length-1&&F[i+1].t-F[0].t<=e)i++;const A=F[i],B=F[Math.min(i+1,F.length-1)],sp=B.t-A.t,f=sp>0?Math.min(1,(F[0].t+e-A.t)/sp):0;
 repSaved=s.ps.map((p:any)=>[p.x,p.y,p.fx,p.fy,p.vx,p.vy,p.sl,p.kk,p.stun]);repBall=[s.ball.x,s.ball.y,s.ball.h];
 s.ps.forEach((p:any,k:number)=>{const a=A.p[k],b=B.p[k];p.x=a[0]+(b[0]-a[0])*f;p.y=a[1]+(b[1]-a[1])*f;p.fx=a[2];p.fy=a[3];p.vx=a[4];p.vy=a[5];p.sl=a[6];p.kk=a[7];p.stun=0});
 s.ball.x=A.b[0]+(B.b[0]-A.b[0])*f;s.ball.y=A.b[1]+(B.b[1]-A.b[1])*f;s.ball.h=A.b[2]}
function repRestore(){if(!repSaved)return;s.ps.forEach((p:any,k:number)=>{const a=repSaved[k];p.x=a[0];p.y=a[1];p.fx=a[2];p.fy=a[3];p.vx=a[4];p.vy=a[5];p.sl=a[6];p.kk=a[7];p.stun=a[8]});s.ball.x=repBall[0];s.ball.y=repBall[1];s.ball.h=repBall[2];repSaved=null}
let curScreen='',padUsed=false,padPrev:any={},padT=0,padKeep='';
// ===== GAMEPAD IN MENUS: d-pad / left stick moves the highlight, A (cross) selects, B (circle) goes back, Start resumes =====
const padEls=()=>[...document.querySelectorAll('#menu button:not([disabled]),#menu input')].filter((e:any)=>e.offsetParent!==null);
function padFocus(e:any){document.querySelectorAll('#menu .pf').forEach((x:any)=>x.classList.remove('pf'));e.classList.add('pf');e.scrollIntoView({block:'nearest',inline:'nearest'})}
function padNav(dir:string){const els:any[]=padEls();if(!els.length)return;const cur:any=els.find(e=>e.classList.contains('pf'));if(!cur){padFocus(els[0]);return}
 const sp:any=cur.closest&&cur.closest('.sp');if(sp&&(dir==='l'||dir==='r')){const a:any=sp.querySelector('.ar[data-d="'+(dir==='l'?-1:1)+'"]');if(a&&!a.disabled){a.click();return}}
 const r=cur.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let best:any=null,bs=1e9;
 els.forEach(e=>{if(e===cur)return;const q=e.getBoundingClientRect(),dx=q.left+q.width/2-cx,dy=q.top+q.height/2-cy,h=dir==='r'||dir==='l';
  if(!(dir==='r'?dx>4:dir==='l'?dx<-4:dir==='d'?dy>4:dy<-4))return;const sc=(h?Math.abs(dx):Math.abs(dy))+(h?Math.abs(dy):Math.abs(dx))*2.5;if(sc<bs){bs=sc;best=e}});
 if(best)padFocus(best)}
function padPoll(now:number){const g:any=navigator.getGamepads?[...navigator.getGamepads()].find((x:any)=>x&&x.connected):null;
 document.body.classList.toggle('inm',inMenu);if(!g)return;
 const B=(i:number)=>!!(g.buttons[i]&&g.buttons[i].pressed),ax=g.axes[0]||0,ay=g.axes[1]||0;
 const st:any={a:B(0),b:B(1),s:B(9),dir:B(12)||ay<-.6?'u':B(13)||ay>.6?'d':B(14)||ax<-.6?'l':B(15)||ax>.6?'r':''};
 if(st.a||st.b||st.s||st.dir)padUsed=true;
 if(!inMenu){padPrev=st;return}
 const pd=padPrev.dir||'';if(st.dir){if(st.dir!==pd){padNav(st.dir);padT=now+380}else if(now>=padT){padNav(st.dir);padT=now+140}}
 if(st.a&&!padPrev.a){const f:any=document.querySelector('#menu .pf');if(f&&f.offsetParent!==null){f.tagName==='INPUT'?f.focus():f.click()}else{const e:any=padEls();if(e[0])padFocus(e[0])}}
 if(st.b&&!padPrev.b){const t:any=document.querySelector('#menu [data-to]')||document.getElementById('rsm')||document.getElementById('lv');if(t)t.click()}
 if(st.s&&!padPrev.s&&curScreen==='pause')$('rsm').click();
 padPrev=st;
 if(padUsed&&!document.querySelector('#menu .pf')){const e:any[]=padEls();let f:any=padKeep&&document.querySelector('#menu .sp[data-sp="'+padKeep+'"] .ar:not([disabled])');padKeep='';f=f||e.find(x=>x.classList.contains('go'))||e[0];if(f)padFocus(f)}}
const pg=document.createElement('div');pg.id='ping';pg.setAttribute('role','status');pg.setAttribute('aria-live','polite');document.body.appendChild(pg);let pgT=0;
function pingHud(now:number){if(now<pgT)return;pgT=now+1000;if(!online){pg.style.display='none';return}pg.style.display='block';if(!net.rtt){pg.textContent='NETWORK · CONNECTING';pg.style.color='#eef3ff';return}const r=Math.round(net.rtt),quality=r<80?'GOOD':r<150?'FAIR':'WEAK';pg.textContent=`${quality} · ${r} ms`;pg.style.color=r<80?'#c6ff3d':r<150?'#ffd24d':'#ff4d5e'}
let fpsN=0,fpsT=0,pr=Math.min(devicePixelRatio||1,1.5); // slow phone? drop the render resolution automatically
function fpsWatch(now:number){fpsN++;if(now-fpsT>2500){const f=fpsN*1000/(now-fpsT);fpsN=0;fpsT=now;if(f<38&&pr>1){pr=1;ren.setPixelRatio(1);resize()}}}
const pt=document.createElement('div');pt.id='pt';document.body.appendChild(pt);const ph=document.createElement('div');ph.id='padhint';ph.textContent='A select  -  B back  -  Start pause';document.body.appendChild(ph);
function flash(t:string){pt.textContent=t;pt.style.display='block';setTimeout(()=>{pt.style.display='none'},2500)}
addEventListener('gamepadconnected',()=>{document.body.classList.add('pad');padUsed=true;flash('Gamepad connected')});
addEventListener('gamepaddisconnected',()=>{document.body.classList.remove('pad');flash('Gamepad disconnected')});
let sumT:any=0,sumData:any=null;let lastOpp=null;
const POOL=['Chidi','Tunde','Emeka','Musa','Bashir','Segun','Ifeanyi','Yusuf','Kelechi','Ayo'];
const nm=(k:number,h?:any)=>online?((s.nicks&&s.nicks[k])||POOL[k%10]):(h?nick:POOL[k%10]); // humans by name, bots by pool name
function showSummary(){const m=$('menu');inMenu=true;m.className='sumv';
 if(s.mode!=='match'){m.innerHTML=`<h2>${s.mode==='shootout'?'Shootout':'Training'}</h2><div class="big">${s.score[0]}${s.mode==='shootout'?' / 5':''}</div>`+(online?'':`<div class="row"><button class="go" id="rs">Play again</button><button class="chip" id="mn">Menu</button></div>`);return}
 const d=online?sumData:summary(s);if(!d)return;const rk:any=online?d:s;if(!rk.rec){rk.rec=1;recordMatch(d)}
 const hu=(k:number)=>d.rows[k]&&d.rows[k].hu,N=(k:number)=>nm(k,hu(k)),T=d.names;
 const sc=[0,1].map(t=>d.ev.filter((e:any)=>e.t===t).map((e:any)=>`<div>${e.mn}' ${e.k>=0?N(e.k):''}${e.og?' (OG)':''}${e.as>=0?` <small>(${N(e.as)})</small>`:''}</div>`).join('')||'<div><small>-</small></div>');
 const bar=(l:string,a:number,b:number)=>{const p=a+b?a/(a+b)*100:50;return`<div class="st"><span>${a}</span><i><u style="width:${p}%"></u></i><span>${b}</span><em>${l}</em></div>`};
 const tm=d.team,mv=d.rows[d.motm],top=d.rows.slice().sort((a:any,b:any)=>b.r-a.r).slice(0,5);
 m.innerHTML=`<div class="sg"><div><div class="sc"><b>${T[0]}</b> <span class="big">${d.score[0]} - ${d.score[1]}</span> <b>${T[1]}</b></div><div class="two"><div>${sc[0]}</div><div>${sc[1]}</div></div>${bar('Possession %',tm[0].poss,tm[1].poss)}${bar('Shots',tm[0].sh,tm[1].sh)}${bar('Pass accuracy %',tm[0].pacc,tm[1].pacc)}${bar('Fouls',tm[0].fl,tm[1].fl)}</div>
 <div><div class="motm"><small>MAN OF THE MATCH</small><b>${N(mv.k)}</b><span>${T[mv.t]} - rated ${mv.r.toFixed(1)}</span><small>${mv.g} goal${mv.g===1?'':'s'}, ${mv.a} assist${mv.a===1?'':'s'}, ${mv.tk} tackle${mv.tk===1?'':'s'}</small></div><div class="rt">${top.map((r:any)=>`<div><span>${N(r.k)} <small>${T[r.t]}</small></span><b>${r.r.toFixed(1)}</b></div>`).join('')}</div></div></div>`+(online?`<small>Back to the waiting room shortly...</small><button class="chip" id="lv">Leave</button>`:(curCup?`<div class="row"><button class="go" id="cc">Continue</button></div>`:`<div class="row"><button class="go" id="rs">Play again</button><button class="chip" id="mn">Menu</button></div>`))}
const lb=(k,t)=>{document.querySelector('[data-k='+k+'] small').textContent=t};
function ui(){const opp=s.own>=0&&s.ps[me]&&s.ps[s.own].t!==s.ps[me].t;const md=opp?1:(s.own>=0&&s.own!==me&&s.ps[s.own].t===s.ps[me].t)?2:0;if(md!==lastOpp){lastOpp=md;lb('pass',['Pass','Press','Call'][md]);lb('shoot',opp?'Tackle':'Shoot');lb('lob',opp?'Slide':'Lob');lb('thru',opp?'-':'Through')}const sh=s.mode==='shootout',tr=s.mode==='training',m=Math.max(0,Math.ceil(s.time));$('sa').textContent=s.score[0];$('sb').textContent=s.score[1];
 $('tm').textContent=tr?'FREE':Math.floor(m/60)+':'+String(m%60).padStart(2,'0');$('hf').textContent=sh?'ROUND '+Math.min(s.round,5)+' OF 5':tr?'TRAINING':s.golden?'GOLDEN GOAL':s.half===1?'1ST HALF':'2ND HALF';
 $('toast').style.display=s.pause>0&&s.msg==='Kickoff'?'block':'none';
 const txt=connectionNotice|| (rep?'':s.over?'FULL TIME':(s.msg==='Kickoff'?'':s.msg));let sub=s.over?(sh?`${s.score[0]} / 5`:`${s.score[0]} - ${s.score[1]}`):(s.pause>0?s.sub||'':'');
 if(!s.over&&s.kind==='goal'&&s.pause>0&&s.sc>=0&&s.mode==='match')sub=`${nm(s.sc,s.st&&s.st[s.sc]&&s.st[s.sc].hu>10)}${s.og?' (OG)':''} ${s.mn}'${s.as>=0?' - assist '+nm(s.as,s.st&&s.st[s.as]&&s.st[s.as].hu>10):''} - ${s.sub}`;
 const key=txt+'|'+sub+'|'+s.kind+s.over;
 if(key!==shown){shown=key;const mg=$('msg');mg.className='k-'+(connectionNotice||s.over?'info':s.kind||'info');mg.innerHTML=txt?`<span class="pop">${txt}</span><small>${sub}</small>`:'';const board=$('sbd');board.classList.remove('goal-flash','foul-flash');if(s.pause>0&&(s.kind==='goal'||s.kind==='foul'||s.kind==='pen')){void board.offsetWidth;board.classList.add(s.kind==='goal'?'goal-flash':'foul-flash')}}
 if(s.over&&!sumT){sumT=setTimeout(()=>{if(s.over)showSummary()},2300)}else if(!s.over&&sumT){clearTimeout(sumT);sumT=0}}
// ===== APP FLOW: name -> modes -> settings -> match =====
const roomParam=new URLSearchParams(location.search).get('room');let roomUsed=false;const cfg={len:150,diff:1,field:'street',teams:[0,2]},CH=['KAZZ','Sharp Boy','Jagaban','Small Pele','Oga Striker','Zaki','Baller','Golden Boy'];
const chips=(a,key,cur)=>a.map(([v,l])=>`<button class="chip${cur===v?' on':''}" data-${key}="${v}">${l}</button>`).join('');
const helpAction=(keyboard:string,gamepad:string,touch:string)=>document.body.classList.contains('pad')?gamepad:isTouch?touch:keyboard;
const touchLayoutLabel=()=>touchLeft?'Touch: left handed':'Touch: right handed';
function show(n){curScreen=n;inMenu=true;if(n==='modes'){curCup=null;tut=null;tutShow()}const m=$('menu');m.className='';
 if(n==='name')m.innerHTML=`<small>GUEST PLAYER</small><h2>Pick your street name</h2><input id="ni" maxlength="14" placeholder="KAZZ" value="${nick}" aria-label="Nickname"><div class="row">${CH.map(c=>`<button class="chip" data-n="${c}">${c}</button>`).join('')}</div><small>This shows above your player.</small><button class="go" id="gn">Continue</button>`;
 else if(n==='online')m.innerHTML=`<h2>Play online</h2><div class="row"><button class="card" id="oq">Quick match<span>Find players; bots fill open spots</span></button><button class="card" id="op">Private room<span>Create a room and share its code</span></button></div><small>Joining a friend's room?</small><input id="oc" maxlength="6" placeholder="ROOM CODE" aria-label="Room code"><div class="row"><button class="go" id="oj">Join room</button></div><small id="oe" role="status" aria-live="polite">If connecting fails, check that the game server is live.</small><button class="chip" data-to="modes">Back</button>`;
 else if(n==='modes')m.innerHTML=`<small>${career.m?`Played ${career.m} - Won ${career.w} - Goals ${career.g} - Man of the match ${career.motm}${career.cups?' - Cups '+career.cups:''}`:'Welcome, '+nick}</small><h2>Pick your game</h2><div class="row"><button class="card" id="qm">Quick match<span>5v5 vs CPU</span></button><button class="card" id="cp">Street Cup<span>Win 3 matches, lift the trophy</span></button><button class="card" id="tr">Training<span>Drills and practice</span></button><button class="card" id="so">Shootout<span>5 rounds vs a defender</span></button><button class="card" id="ol">Play online<span>Live match with friends</span></button></div><div class="row"><button class="chip" data-to="controls">Controls &amp; help</button>${isTouch?`<button class="chip" id="layout">${touchLayoutLabel()}</button>`:''}<button class="chip" data-to="name">Change name</button><button class="chip" id="sndm">Sound: ${AU.on?'on':'off'}</button>${standalone?'':'<button class="chip" id="inst">Install app</button>'}</div>`;
 else if(n==='drills')m.innerHTML=`<small>SHORT PRACTICE CHALLENGES</small><h2>Choose a drill</h2><div class="row"><button class="card" id="dr-pass">Passing<span>Complete five passes</span></button><button class="card" id="dr-finish">Finishing<span>Score three goals</span></button><button class="card" id="dr-control">Ball control<span>Keep possession for eight seconds</span></button></div><div class="row"><button class="chip" id="tutr">Full tutorial</button><button class="chip" data-to="modes">Back</button></div>`;
 else if(n==='controls')m.innerHTML=`<small>STREET FB · QUICK GUIDE</small><h2>How to play</h2><div class="help-grid"><section><b>MOVE</b><span>${lab('move')}</span><b>SPRINT</b><span>${lab('sprint')}</span><b>PASS / TACKLE</b><span>${lab('pass')}</span><b>SHOOT</b><span>${lab('shoot')} — hold, then release to charge</span></section><section><b>THROUGH BALL</b><span>${helpAction('R','Triangle','Through button')}</span><b>LOB / SLIDE</b><span>${helpAction('F','Circle','Lob button')}</span><b>SWITCH PLAYER</b><span>${helpAction('X','L1','Switch button')}</span><b>SHIELD / SKILL</b><span>${helpAction('C / V','L2 / R2','Action buttons')}</span></section></div><div class="row"><button class="go" id="tutr">Practice controls</button><button class="chip" data-to="modes">Back</button></div>`;
 else if(n==='cupsetup')m.innerHTML=`<h2>Street Cup</h2><small>Pick your club, then win the quarter-final, semi-final and final.</small><div class="stp" style="grid-template-columns:1fr">${spTeam('t0',cfg.teams[0],[cfg.teams[0],(cfg.teams[0]+1)%TEAMS.length],1,'Your club')}</div><div class="row"><button class="go" id="cst">Start the cup</button><button class="chip" data-to="modes">Back</button></div>`;
 else if(n==='cup')cupScreen();
 else if(n==='pause'){m.className='ov';m.innerHTML=`<h2>Paused</h2><small>${online?'A bot plays for you while this menu is open':'Match paused'}</small><button class="go" id="rsm">Resume</button><button class="chip" id="lvm">Leave match</button>`;if(online)online.send('afk',{on:1})}
 else if(n==='lobby')lobby();
 else m.innerHTML=`<h2>Match setup</h2><div class="stp">${spTeam('t0',cfg.teams[0],cfg.teams,1,'Your team')}${spField(cfg.field,1)}${spTeam('t1',cfg.teams[1],cfg.teams,1,'Opponent')}</div><div class="opts"><span>Half</span>${chips([[60,'1:00'],[150,'2:30'],[300,'5:00']],'l',cfg.len)}<span>CPU</span>${chips([[.85,'Easy'],[1,'Normal'],[1.12,'Hard']],'d',cfg.diff)}</div><div class="row"><button class="go" id="st">Kick off</button><button class="chip" data-to="modes">Back</button></div>`}
const jersey=(c:number,s:number)=>`<svg class="jy" viewBox="0 0 64 64"><path d="M20 6 6 14l6 12 6-3v31h28V23l6 3 6-12-14-8c-2 5-6 7-12 7S22 11 20 6z" fill="${hex(c)}" stroke="rgba(255,255,255,.4)" stroke-width="1.5"/><rect x="21" y="47" width="22" height="12" rx="2" fill="${hex(s)}"/></svg>`;
const arrows=(on:boolean,body:string)=>`<div class="rw"><button class="ar" data-d="-1" ${on?'':'disabled'} aria-label="Previous">&#8249;</button><div class="c2">${body}</div><button class="ar" data-d="1" ${on?'':'disabled'} aria-label="Next">&#8250;</button></div>`;
const spTeam=(key:string,idx:number,ids:number[],on:any,label:string)=>{const T=TEAMS[idx],side=key==='t0'?0:1,sc=shirts(ids),away=side===1&&sc[1]!==T.c;
 return`<div class="sp${on?'':' off'}" data-sp="${key}"><small class="lb">${label}</small>${arrows(!!on,`${jersey(sc[side],away?T.c:T.s)}<b>${T.n}</b><span>${away?'away kit':on?'tap < > to change':'picked by captain'}</span>`)}</div>`};
const spField=(cur:string,on:any)=>{const F=FIELDS.find(f=>f.id===cur)||FIELDS[0];return`<div class="sp${on?'':' off'}" data-sp="fd"><small class="lb">Stadium</small>${arrows(!!on,`<div class="th ${F.id}"></div><b>${F.n}</b><span>${on?'tap < > to change':'picked by captain'}</span>`)}</div>`};
function spinStep(key:string,dir:number,onl:boolean){const T=TEAMS.length,F=FIELDS.length;
 if(key==='fd'){const cur=onl?lob.field:cfg.field,i=FIELDS.findIndex(f=>f.id===cur),nx=FIELDS[(i+dir+F)%F].id;if(onl)online.send('cfg',{field:nx});else{cfg.field=nx;show(curScreen==='cupsetup'?'cupsetup':'set')}}
 else{const sd=key==='t0'?0:1,tm=onl?lob.teams:cfg.teams;let v=(tm[sd]+dir+T)%T;if(v===tm[1-sd])v=(v+dir+T)%T;if(onl)online.send('cfg',{team:v,side:sd});else{cfg.teams[sd]=v;show(curScreen==='cupsetup'?'cupsetup':'set')}}
 padKeep=key}
const dot=c=>`<i class="dt" style="background:${hex(c)}"></i>`;
const fieldRow=(cur,on)=>FIELDS.map(f=>`<button class="chip${cur===f.id?' on':''}" ${on?`data-fd="${f.id}"`:'disabled'}>${f.n}</button>`).join('');
const teamRow=(side,cur,on)=>TEAMS.map((t,i)=>`<button class="chip${cur===i?' on':''}" ${on?`data-t${side}="${i}"`:'disabled'}>${dot(t.c)}${t.n}</button>`).join('');
// online lobby: coin toss between the two captains, winner picks the stadium; captains pick their own kit
function lobby(){const c=lob,both=c.caps[0]>=0&&c.caps[1]>=0,chooser=me===c.chooser,host=me===c.host,mine=c.pl.find(p=>p.idx===me);
 let h=`<small>ROOM ${c.code}</small>`;
 if(c.phase==='wait')h+=`<h2>Finding players</h2><small>${c.pl.length}/10 in the room. Starting in ${c.eta}s, bots fill the empty spots.</small><div class="row">${c.pl.map(p=>`<span class="chip on${p.connected===false?' offl':''}">${p.nick}${p.connected===false?' · reconnecting':''}</span>`).join('')}</div>`;
 else if(c.phase==='lobby'){
  const ready=c.pl.filter((p:any)=>p.idx!==c.host&&p.ready).length,needed=c.pl.filter((p:any)=>p.idx!==c.host).length;
  const invite=location.origin+location.pathname+'?room='+encodeURIComponent(c.code);
  h+=`<h2>Waiting room</h2><small class="ready-count">${needed?`${ready} / ${needed} players ready`:'Invite friends to join your match'}</small><div class="invite-row"><button class="chip" id="cl">Share invite link</button><span>${invite}</span></div>`;
  h+=host?`<div class="row">${[['versus','Against each other'],['coop','Together vs bots']].map(([v,l])=>`<button class="chip${c.mode===v?' on':''}" data-mode="${v}">${l}</button>`).join('')}</div>`:`<small>${c.mode==='coop'?'Together vs bots':'Against each other'}</small>`;
  const pr=(p:any)=>`<div class="pl${p.ready?' rd':''}${p.idx===me?' me':''}${p.connected===false?' offl':''}"><span>${p.idx===c.host?'&#9733; ':''}${p.nick}${p.connected===false?' · reconnecting':''}</span>${host&&p.idx!==me?`<button class="ic" data-host="${p.idx}" aria-label="Make host">&#9733;</button><button class="ic" data-kick="${p.idx}" aria-label="Kick">&#10005;</button>`:''}</div>`;
  h+=`<div class="wr">${[0,1].map(sd=>`<div><small>${c.mode==='coop'?(sd?'Bots':'Your team'):'Team '+(sd?'B':'A')}</small>${c.mode==='coop'&&sd?'<div class="pl"><span>5 bots</span></div>':(c.pl.filter((p:any)=>(p.idx<5?0:1)===sd).map(pr).join('')||'<div class="pl"><span>-</span></div>')}</div>`).join('')}</div>`;
  if(c.mode==='versus')h+=`<button class="chip" id="sd">Switch my side</button>`;
  h+=host?`<button class="go" id="ls">Start match</button><small>Everyone else must tap Ready first.</small>`:`<button class="go" id="rd">${mine&&mine.ready?'Not ready':"I'm ready"}</button>`}
 else if(c.phase==='toss')h+=`<h2>Coin toss</h2>`+(me===c.caller?`<small>You are captain. Call it!</small><div class="row"><button class="go" data-call="H">Heads</button><button class="go" data-call="T">Tails</button></div>`:`<small>The captain is calling the coin...</small>`);
 else{h+=`<h2>Match setup</h2>`;if(c.toss)h+=`<small>It landed ${c.toss.result==='H'?'heads':'tails'}. ${TEAMS[c.teams[c.toss.winner]].sh} captain picks the stadium.</small>`;
  const on=i=>both?me===c.caps[i]:chooser;
  h+=`<div class="stp">${spTeam('t0',c.teams[0],c.teams,on(0),'Team A')}${spField(c.field,chooser)}${spTeam('t1',c.teams[1],c.teams,on(1),'Team B')}</div>`;
  h+=chooser?`<button class="go" id="ls">Kick off</button>`:`<small>Waiting for the captain to start...</small>`}
 $('menu').innerHTML=h+`<button class="chip" id="lv">Leave</button>`}
function lobbyClick(b,d){if(d.d!==undefined){spinStep(b.closest('.sp').dataset.sp,+d.d,true);return true}if(d.fd)online.send('cfg',{field:d.fd});else if(d.t0!==undefined)online.send('cfg',{team:+d.t0,side:0});else if(d.t1!==undefined)online.send('cfg',{team:+d.t1,side:1});else if(d.call)online.send('call',{c:d.call});
 else if(d.mode)online.send('mode',{m:d.mode});else if(d.kick)online.send('kick',{idx:+d.kick});else if(d.host)online.send('host',{idx:+d.host});else if(b.id==='rd')online.send('rdy');else if(b.id==='sd')online.send('side');
 else if(b.id==='cl'){const url=location.origin+location.pathname+'?room='+encodeURIComponent(lob.code),done=()=>{b.textContent='Link copied!';setTimeout(()=>{if(b.isConnected)b.textContent='Share invite link'},2200)},copy=()=>{if(navigator.clipboard?.writeText)navigator.clipboard.writeText(url).then(done).catch(()=>window.prompt('Copy this Street FB invite link',url));else window.prompt('Copy this Street FB invite link',url)};if(navigator.share)navigator.share({title:'Join my Street FB room',text:'Join my Street FB match',url}).then(()=>{b.textContent='Invite shared'}).catch(copy);else copy()}
 else if(b.id==='ls')online.send('start');else if(b.id==='lv'){const r=online;online=null;lob=null;r.leave();show('modes')}else return false;return true}
$('menu').onclick=e=>{lockLand();audioInit();sfx.click();const b=e.target.closest('button');if(!b||b.disabled)return;const d=b.dataset;if(online&&lob&&lobbyClick(b,d))return;
 if(d.d!==undefined)spinStep(b.closest('.sp').dataset.sp,+d.d,false);else if(d.n)$('ni').value=d.n.toUpperCase();else if(d.l){cfg.len=+d.l;show('set')}else if(d.fd){cfg.field=d.fd;show('set')}else if(d.t0!==undefined){cfg.teams[0]=+d.t0;show('set')}else if(d.t1!==undefined){cfg.teams[1]=+d.t1;show('set')}else if(d.d){cfg.diff=+d.d;show('set')}else if(d.to)show(d.to);
 else if(b.id==='gn'){nick=($('ni').value.replace(/[^\w ]/g,'').trim().toUpperCase().slice(0,14))||'KAZZ';if(roomParam&&!roomUsed){roomUsed=true;goOnline(roomParam,'join')}else if(!localStorage.getItem('sfc-tut')){start({mode:'training'});tutStart()}else show('modes')}
 else if(b.id==='rs')start({mode:s.mode,len:s.len,diff:s.diff});else if(b.id==='mn')show('modes');else if(b.id==='rsm'){$('menu').className='hide';inMenu=false;if(online)online.send('afk',{on:0})}else if(b.id==='lvm'){if(online){online.leave();online=null}show('modes')}else if(b.id==='ol')show('online');else if(b.id==='oq')goOnline('QUICK','quick');else if(b.id==='op')goOnline(Math.random().toString(36).slice(2,7).toUpperCase(),'create');else if(b.id==='oj')goOnline($('oc').value,'join');else if(b.id==='qm')show('set');else if(b.id==='tr')show('drills');else if(b.id==='dr-pass')startTraining('passing');else if(b.id==='dr-finish')startTraining('finishing');else if(b.id==='dr-control')startTraining('control');else if(b.id==='tutr'){drill=null;start({mode:'training'});tutStart()}else if(b.id==='layout'){touchLeft=!touchLeft;document.body.classList.toggle('touch-left',touchLeft);try{localStorage.setItem('sfc-touch-layout',touchLeft?'left':'right')}catch(e){}show('modes')}else if(b.id==='cp'){cup?show('cup'):show('cupsetup')}else if(b.id==='cst')cupNew();else if(b.id==='cg')cupPlay();else if(b.id==='cc')cupAfter();else if(b.id==='cn'){cup=null;saveCup();show('cupsetup')}else if(b.id==='cr'){cfg.teams[0]=cup.team;cupNew()}else if(b.id==='sndm'){AU.on=!AU.on;try{localStorage.setItem('sfc-snd',AU.on?'1':'0')}catch(e){}sndBtn.textContent=AU.on?'Sound on':'Muted';show('modes')}else if(b.id==='inst'){if(deferredInstall)deferredInstall.prompt();else flash('Open your browser menu, then Add to Home Screen')}else if(b.id==='so')start({mode:'shootout',diff:cfg.diff});else if(b.id==='st')start({mode:'match',len:cfg.len,diff:cfg.diff})};
function start(o){o={...o,names:[TEAMS[cfg.teams[0]].sh,TEAMS[cfg.teams[1]].sh]};s=mk(o);look(cfg.field,cfg.teams);me=4;shown='';acc=0;paused=false;tut=null;drill=null;tutShow();REC.length=0;rep=null;repDone=false;$('pz').textContent='II';$('menu').className='hide';inMenu=false}
$('mb').onclick=()=>show('pause');look(cfg.field,cfg.teams);show('name');const dbg=new URLSearchParams(location.search).get('screen');if(dbg==='set')show('set');
function loop(n){const dt=Math.min(.1,(n-last)/1000);last=n;padPoll(n);pingHud(n);fpsWatch(n);
 if(online){fdt=dt;let hu:any=null;if(!inMenu&&!portrait()){hu=human();sendIn(hu,n);for(const k in press)press[k]=0}netTick(s,dt,hu,me)}else if(!paused&&!inMenu&&!portrait()){acc+=dt;auto();fdt=dt;const hu=human();tutWatch(dt,hu);while(acc>=1/60){step(s,s.ps.map((p,k)=>k===me?hu:(trainingIdle(p)?NOACT:ai(s,k))),1/60);acc-=1/60}for(const k in press)press[k]=0}
 recFrame(n);repTick(n);render(dt);repRestore();minimap();ui();sfxWatch();
 if(!loaded){loaded=true;$('lp').textContent='Setting up the street... 99%';$('lb').style.width='99%';setTimeout(()=>{$('load').style.opacity=0;setTimeout(()=>$('load').remove(),450)},700)}
 requestAnimationFrame(loop)}
// ===== ONLINE: the server runs the sim; we send inputs and render its snapshots =====
function wire(room:any){online=room;connectionNotice='';shown='';resetNet();const pi=setInterval(()=>{if(online===room)room.send('p',{t:performance.now(),r:net.rtt});else clearInterval(pi)},1500);room.send('p',{t:performance.now(),r:net.rtt});
 room.onMessage('you',(m:any)=>{me=m.idx});room.onMessage('s',(m:any)=>applySnap(s,m,me));room.onMessage('q',(m:any)=>{const r=performance.now()-m.t;net.rtt=net.rtt?net.rtt*.7+r*.3:r});room.onMessage('c',(a:number[])=>{s.calls=new Set(a)});room.onMessage('sum',(d:any)=>{sumData=d;if(s.over)showSummary()});
 room.onMessage('cfg',(c:any)=>{lob=c;if(c.phase==='play'){look(c.field,c.teams);$('menu').className='hide';inMenu=false}else{inMenu=true;show('lobby')}});
 room.onLeave(async(code:number)=>{if(online!==room)return;net.rtt=0;if(code===1000||code===4000){online=null;lob=null;show('modes');return}
  for(let i=0;i<24;i++){connectionNotice=`RECONNECTING · ${Math.max(0,Math.ceil(60-i*2.5))}s`;shown='';try{wire(await reconnect());return}catch(e){if(i<23)await new Promise(r=>setTimeout(r,2500))}}
  connectionNotice='';shown='';online=null;lob=null;show('modes')});
 room.send('ready')}
async function goOnline(code:string,how:string){let e:any=document.getElementById('oe'),timer:any,expired=false;if(e)e.textContent='Connecting to Street FB… keep this page open.';
 try{s=mk();const pending=connect(nick,(code||'').toUpperCase().replace(/[^A-Z0-9]/g,'')||'QUICK',how).then((room:any)=>{if(expired){room.leave();throw new Error('Connection timed out')}return room});const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;reject(new Error('Connection timed out'))},18000)});wire(await Promise.race([pending,timeout]) as any)}
 catch(x){if(!document.getElementById('oe'))show('online');e=document.getElementById('oe');const why=String((x as any)?.message||x||'');if(e)e.textContent=how==='join'&&/not found|room/i.test(why)?'Room code not found, or the match has already started. Check the code and try again.':/timed out/i.test(why)?'The server did not respond in time. Check that the Render service is live, then try again.':'Could not connect. Check your internet connection and the game server URL, then retry.'}finally{clearTimeout(timer)}}
function sendIn(o:any,t:number){const j=JSON.stringify(o);if(j!==lastIn||t-lastSend>100||o.shoot){lastIn=j;lastSend=t;online.send('in',o)}}
if(location.search.includes('debug'))(window as any).__sfc={start,showSummary,get s(){return s},get me(){return me},get rep(){return rep},get tut(){return tut},get cup(){return cup},career,net}; // debug hook for automated screenshots (only with ?debug)
requestAnimationFrame(loop);
