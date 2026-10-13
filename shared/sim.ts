// @ts-nocheck
// Shared game simulation. The server runs this for real; the client runs it only offline.
// ===== SHARED SIM (no DOM): moves to /shared/sim.ts for the server in step 3 =====
import {GOALS,FOULS,PENS,MISS} from './data';
const pick=a=>a[Math.random()*a.length|0];
export const W=1000,H=560,GOAL=90,R=15,BR=8;
export const HOME=[[160,.5],[290,.2],[290,.8],[430,.35],[430,.65]]; // no keepers
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function norm(x,y){const m=Math.hypot(x,y)||1;return[x/m,y/m]}
export function mk(o){o=o||{};const ps=[];for(let t=0;t<2;t++)HOME.forEach((h,i)=>{const hx=t?W-h[0]:h[0],hy=h[1]*H;ps.push({t,i,x:hx,y:hy,hx,hy,vx:0,vy:0,fx:t?-1:1,fy:0,cd:0,stun:0,st:1,sh:false,off:false,pk:0,run:false,sl:0,kk:0,cl:0,firstTouch:1,firstTouchT:0})});
 const s={ps,ball:{x:W/2,y:H/2,vx:0,vy:0,h:0,vh:0},score:[0,0],half:1,pause:2,over:false,msg:'Kickoff',kind:'info',sub:'',gt:-1,freeze:0,taker:-1,gk:-1,gkT:0,fcd:0,names:o.names||['HOME','AWAY'],golden:!!o.golden,rcvH:1,rcv:-1,rcvT:0,trap:0,st:ps.map(()=>({g:0,a:0,sh:0,pa:0,pc:0,tk:0,ic:0,fl:0,og:0,hu:0})),poss:[0,0],ev:[],last:-1,prev:-1,pend:-1,po:-1,sc:-1,as:-1,og:0,mn:0,mode:o.mode||'match',len:o.len||150,diff:o.diff||1,round:1,me:4,own:-1};
 s.time=s.len;if(s.golden)s.half=2;if(s.mode==='shootout'){s.time=8;skpos(s);s.msg='Round 1'}if(s.mode==='training')s.time=1e9;return s}
export function skpos(s){s.ps.forEach((p,k)=>{p.off=!(k===s.me||k===5);p.vx=p.vy=0;p.stun=0;p.cd=0});const m=s.ps[s.me],d=s.ps[5];m.x=W*.58;m.y=H/2+(Math.random()-.5)*220;m.fx=1;m.fy=0;d.x=W-230;d.y=H/2;Object.assign(s.ball,{x:m.x+22,y:m.y,vx:0,vy:0});s.own=s.me}
export function rnd(s,msg,kind){s.round++;if(s.round>5){s.over=true;return}s.time=8;skpos(s);s.msg=msg;s.kind=kind||'info';s.pause=1.6}
export function reset(s){s.own=-1;s.last=s.prev=s.pend=s.po=-1;s.freeze=0;s.gkT=0;s.ps.forEach(p=>{p.x=p.hx;p.y=p.hy;p.vx=p.vy=0;p.stun=0;p.cd=0});Object.assign(s.ball,{x:W/2,y:H/2,vx:0,vy:0,h:0,vh:0})}
export function goal(s,t){s.gt=t;
 if(s.mode==='shootout'){if(!t)s.score[0]++;return rnd(s,t?pick(MISS):'GOALLLLLL!',t?'info':'goal')}
 const k=s.last,og=k>=0&&s.ps[k].t!==t,as=!og&&k>=0&&s.prev>=0&&s.prev!==k&&s.ps[s.prev].t===t?s.prev:-1;
 const el=s.half===1?s.len-s.time:s.len+(s.len-s.time),mn=Math.max(1,Math.min(90,Math.round(el/(2*s.len)*90)));
 if(k>=0){if(og)s.st[k].og++;else{s.st[k].g++;if(as>=0)s.st[as].a++}}
 s.ev.push({t,k,as,og:og?1:0,mn});s.sc=k;s.as=as;s.og=og?1:0;s.mn=mn;
 s.score[t]++;s.msg='GOALLLLLL!';s.kind='goal';s.sub='';reset(s);s.pause=s.mode==='match'?5:2.4;if(s.golden)s.over=true}
export function shootDir(p,assist){if(!assist)return[p.fx,p.fy];const[tx,ty]=norm((p.t?0:W)-p.x,H/2-p.y);return norm(p.fx+tx*.6,p.fy+ty*.6)} // only bots get aim assist on shots
export function pickMate(p,s){let best=null,bs=.35;s.ps.forEach(q=>{if(q.t!==p.t||q===p||q.off)return;const d=Math.hypot(q.x-p.x,q.y-p.y),[nx,ny]=norm(q.x-p.x,q.y-p.y),marked=s.ps.some(o=>o.t!==p.t&&!o.off&&Math.hypot(o.x-q.x,o.y-q.y)<50),sc=nx*p.fx+ny*p.fy-d/2500-(marked?.25:0);if(sc>bs){bs=sc;best=q}});return best} // assisted pass: best open mate in the direction you push
export function touch(s,k){if(s.last!==k){s.prev=s.last;s.last=k}}
// Full-time report: team stats, per-player ratings and man of the match
export function summary(s){const res=s.score[0]>s.score[1]?0:s.score[1]>s.score[0]?1:-1,tot=s.poss[0]+s.poss[1]||1;
 const rows=s.ps.map((p,k)=>{const x=s.st[k],bonus=res<0?.1:res===p.t?.4:-.2;let r=6+x.g*1.3+x.a*.8+x.sh*.1+x.pc*.05-(x.pa-x.pc)*.05+x.tk*.3+x.ic*.25-x.fl*.4-x.og*.6+bonus;
  return{k,t:p.t,i:p.i,g:x.g,a:x.a,sh:x.sh,pa:x.pa,pc:x.pc,tk:x.tk,fl:x.fl,hu:x.hu>10?1:0,r:Math.round(Math.max(3,Math.min(10,r))*10)/10}});
 let mv=rows[0];rows.forEach(r=>{if(r.r>mv.r||(r.r===mv.r&&r.g>mv.g))mv=r});
 const team=t=>{const q=rows.filter(r=>r.t===t),f=n=>q.reduce((a,r)=>a+r[n],0),pa=f('pa');return{poss:Math.round(s.poss[t]/tot*100),sh:f('sh'),pacc:pa?Math.round(f('pc')/pa*100):0,fl:f('fl')}};
 return{score:s.score,names:s.names,ev:s.ev,rows,motm:mv.k,team:[team(0),team(1)]}}
// Set pieces: free kick at the foul spot, or a penalty (defender nearest goal stands in as keeper). The whistle pause handles the brief stoppage.
// Local-player movement for client-side prediction: same maths as the movement part of step()
export function moveStep(p,u,s,dt,k){let mx=u.mx||0,my=u.my||0,m=Math.hypot(mx,my);if(m>1){mx/=m;my/=m}
 const car=s.own>=0?s.ps[s.own]:null;
 if(u.press&&car&&car.t!==s.ps[k].t){const[ex,ey]=norm(car.x-p.x,car.y-p.y);mx=ex*.8+mx*.4;my=ey*.8+my*.4;m=Math.hypot(mx,my);if(m>1){mx/=m;my/=m}}
 const run=!!(u.sprint&&p.st>.05&&m>.2),has=s.own===k,sp=(run?250:u.press?215:180)*(has?.93:1)*(p.stun>0?.3:1)*(u.shield?.55:1),a=Math.min(1,dt*(has?7:10));
 p.vx+=(mx*sp-p.vx)*a;p.vy+=(my*sp-p.vy)*a;if(m>.2){p.fx=mx/m;p.fy=my/m}
 p.x=clamp(p.x+p.vx*dt,R,W-R);p.y=clamp(p.y+p.vy*dt,R,H-R)}
export function setPiece(s,type,ko){const q=s.ps[ko],t=q.t,d=t?-1:1,gx=t?0:W,pen=type==='pen',b=s.ball;
 const bx=pen?gx-d*140:clamp(q.x,40,W-40),by=pen?H/2:clamp(q.y,40,H-40);
 Object.assign(b,{x:bx,y:by,vx:0,vy:0,h:0,vh:0});q.x=clamp(bx-d*26,R,W-R);q.y=by;q.vx=q.vy=0;q.fx=d;q.fy=0;s.pend=-1;s.own=ko;s.taker=ko;s.gk=-1;
 if(pen){let bi=-1,bd=1e9;s.ps.forEach((p,k)=>{if(p.t!==t&&!p.off){const dd=Math.abs(p.x-gx);if(dd<bd){bd=dd;bi=k}}});s.gk=bi;if(bi>=0){const g=s.ps[bi];g.x=gx-d*14;g.y=H/2;g.vx=g.vy=0}s.gkT=4}
 s.ps.forEach((p,k)=>{if(k===ko||k===s.gk||p.off)return;const dx=p.x-bx,dy=p.y-by,m=Math.hypot(dx,dy)||1,mn=pen?220:130;if(m<mn){p.x=clamp(bx+dx/m*mn,R,W-R);p.y=clamp(by+dy/m*mn,R,H-R)}});
 s.pause=2.6;s.freeze=0;s.fcd=8}
export function callFoul(s,fk,fouled){s.st[fk].fl++;const o=s.ps[fouled],gx=o.t?0:W,box=Math.abs(o.x-gx)<170&&Math.abs(o.y-H/2)<150;
 s.kind=box?'pen':'foul';s.msg=pick(box?PENS:FOULS);s.sub=(box?'PENALTY - ':'FREE KICK - ')+s.names[o.t];setPiece(s,box?'pen':'fk',fouled)}
export function step(s,inp,dt){
 if(s.over)return;
 if(s.pause>0){s.pause-=dt;if(s.pause<=0)s.msg='';return}
 s.time-=dt;if(s.freeze>0)s.freeze-=dt;if(s.gkT>0)s.gkT-=dt;s.fcd=Math.max(0,s.fcd-dt);if(s.rcvT>0)s.rcvT-=dt;if(s.trap>0)s.trap-=dt;
 if(s.time<=0){if(s.mode==='shootout')return rnd(s,pick(MISS),'info');if(s.half===1){s.half=2;s.time=s.len;s.msg='Half time';reset(s);s.pause=2.5}else{s.time=0;s.over=true}return}
 const b=s.ball;
 s.ps.forEach((p,k)=>{if(p.off)return;p.sl=Math.max(0,p.sl-dt);p.cl=Math.max(0,p.cl-dt);p.kk=Math.max(0,p.kk-dt);p.firstTouchT=Math.max(0,(p.firstTouchT||0)-dt);if(s.freeze>0&&k!==s.taker&&k!==s.gk){p.vx=p.vy=0;return}const u=inp[k];if(u.h)s.st[k].hu+=dt;if(u.call&&s.own>=0&&s.own!==k&&s.ps[s.own].t===p.t)p.cl=1.4,p.ca=u.ai?1:0;p.cd=Math.max(0,p.cd-dt);p.pk=Math.max(0,p.pk-dt);p.stun=Math.max(0,p.stun-dt);
  let mx=u.mx,my=u.my;let m=Math.hypot(mx,my);if(m>1){mx/=m;my/=m}if(u.press&&s.own>=0&&s.ps[s.own].t!==p.t){const c=s.ps[s.own],[ex,ey]=norm(c.x-p.x,c.y-p.y);mx=ex*.8+mx*.4;my=ey*.8+my*.4;m=Math.hypot(mx,my);if(m>1){mx/=m;my/=m}} // press: auto-close the carrier
  const run=!!(u.sprint&&p.st>.05&&m>.2),has=s.own===k;p.run=run;p.st=clamp(p.st+(run?-.35:.12)*dt,0,1);p.sh=!!u.shield;
  const sp=(run?250:u.press?215:180)*(has?.93:1)*(u.h?1:.94)*(p.t?s.diff:1)*(p.stun>0?.3:1)*(u.shield?.55:1),a=Math.min(1,dt*(has?7:10));
  p.vx+=(mx*sp-p.vx)*a;p.vy+=(my*sp-p.vy)*a;if(m>.2){p.fx=mx/m;p.fy=my/m}
  p.x=clamp(p.x+p.vx*dt,R,W-R);p.y=clamp(p.y+p.vy*dt,R,H-R);
  const d=Math.hypot(b.x-p.x,b.y-p.y);
  if(p.stun<=0&&p.cd<=0){
   const act=u.shoot?1:u.pass?3:u.lob?4:u.thru?5:0;
   if((has||d<R+BR+(s.own<0?24:10))&&act){let ax,ay,pw;
    if(act===1){[ax,ay]=shootDir(p,!u.h);const e=(Math.random()-.5)*(run?.16:.08)*(1+u.shoot*.8),c=Math.cos(e),sn=Math.sin(e);[ax,ay]=[ax*c-ay*sn,ax*sn+ay*c];pw=480+470*u.shoot}
    else{const t=u.to||pickMate(p,s);if(t){s.rcv=s.ps.indexOf(t);s.rcvT=2.4;s.rcvH=act===5?.35:1}let X,Y;if(t){const l=act===5?.9:act===4?.5:.3;X=t.x+t.vx*l;Y=t.y+t.vy*l;if(act===5&&Math.hypot(t.vx,t.vy)<30)X+=(p.t?-1:1)*70}else{X=p.x+p.fx*160;Y=p.y+p.fy*160}
     const dd=Math.hypot(X-p.x,Y-p.y);[ax,ay]=norm(X-p.x,Y-p.y);pw=act===3?clamp(dd*2.4,300,500):act===5?clamp(dd*2.6,380,640):clamp(dd*2.8,420,760);if(act===4)b.vh=Math.min(300,150+dd*.6);const err=(Math.random()-.5)*(act===4?.12:act===5?.065:.035)*(1+dd/500),co=Math.cos(err),sn=Math.sin(err);[ax,ay]=[ax*co-ay*sn,ax*sn+ay*co]}
    b.vx=ax*pw;b.vy=ay*pw;p.cd=.4;p.pk=.35;p.kk=.25;s.own=-1;touch(s,k);s.po=-1;if(act===1){s.st[k].sh++;s.pend=-2}else{s.st[k].pa++;s.pend=k}}
   else if(u.skill){p.cd=1.2;p.vx+=p.fx*320;p.vy+=p.fy*320;if(has){s.own=-1;p.pk=.12;b.vx=p.fx*360;b.vy=p.fy*360}}
   else if(u.slide){p.cd=1.1;p.sl=.5;p.vx+=p.fx*430;p.vy+=p.fy*430;const o=s.own>=0?s.ps[s.own]:null; // slide: long reach, risky, can be a foul
    if(o&&o.t!==p.t&&Math.hypot(o.x-p.x,o.y-p.y)<2*R+48){const won=Math.random()<(o.sh?.3:.75);if(s.mode==='match'&&s.fcd<=0&&p.fx*o.fx+p.fy*o.fy>.5&&Math.random()<.9){p.stun=.8;callFoul(s,k,s.own);return}if(won){s.own=k;o.stun=.5;o.pk=.6;p.pk=0}else p.stun=.6}else p.stun=.6}
   else if(u.tackle){p.cd=.7;p.vx+=p.fx*240;p.vy+=p.fy*240;const o=s.own>=0?s.ps[s.own]:null;
    if(o&&o.t!==p.t){if(Math.hypot(o.x-p.x,o.y-p.y)<2*R+24){const behind=p.fx*o.fx+p.fy*o.fy>.6,blk=Math.random()<(o.sh?.7:.12),won=Math.random()<(behind?.72:.9);
      if(blk){p.stun=.4;o.stun=.15}else if(won){s.own=k;o.stun=.45;o.pk=.6;p.pk=0}else{p.stun=.28}}}
    else if(!o&&b.h<20&&d<R+BR+26){s.own=k}} // poke a loose ball

  }
 });
 // A foul can be called from inside the player loop. Stop this simulation
 // tick immediately so the set piece and whistle pause remain intact.
 if(s.pause>0)return;
 for(let i=0;i<10;i++)for(let j=i+1;j<10;j++){const a=s.ps[i],c=s.ps[j];if(a.off||c.off)continue;let dx=c.x-a.x,dy=c.y-a.y;const d=Math.hypot(dx,dy);if(d>0&&d<2*R){const o=(2*R-d)/2;dx/=d;dy/=d;a.x-=dx*o;a.y-=dy*o;c.x+=dx*o;c.y+=dy*o}}
 // Keep possession at the player's feet; sprinting moves the ball slightly farther ahead.
 if(s.own>=0){const o=s.ps[s.own];if(o.off||o.stun>0)s.own=-1;else{const quality=o.firstTouchT>0?o.firstTouch:1,lead=R+BR+(o.run?9:3)+(1-quality)*24,k2=Math.min(1,dt*(s.trap>0?9:16)*(.72+.28*quality));b.x+=(o.x+o.fx*lead-b.x)*k2;b.y+=(o.y+o.fy*lead-b.y)*k2;b.vx=o.vx;b.vy=o.vy;b.h=b.vh=0}}
 if(s.own<0&&(b.h>0||b.vh>0)){b.vh-=720*dt;b.h+=b.vh*dt;if(b.h<=0){b.h=0;b.vh=b.vh<-140?-b.vh*.3:0}}
 if(s.own<0){const bs=Math.hypot(b.vx,b.vy);let bi=-1,bd=1e9;
  s.ps.forEach((p,k)=>{const rc=k===s.rcv&&s.rcvT>0;if(p.off||(p.pk>0&&!rc)||p.stun>0)return;const d=Math.hypot(b.x-p.x,b.y-p.y),dd=rc?d-10:d;if(b.h<24&&d<R+BR+(rc?16:8)&&dd<bd){bd=dd;bi=k}}); // the intended receiver gets a small first-touch allowance
  if(bi>=0&&(bs<520||(bi===s.rcv&&bs<650))){const p=s.ps[bi],incoming=bs?((b.vx*p.fx+b.vy*p.fy)/bs):0,control=clamp(1-(bs-160)/560+(incoming<0?.14:0)+(p.sh?.12:0)-(p.run?.18:0),.2,.96);p.firstTouch=control;p.firstTouchT=.24;if(bi===s.rcv)s.trap=.3;s.own=bi;s.rcv=-1}if(bi>=0&&bs<520)s.own=bi;
  else s.ps.forEach(p=>{if(p.off)return;const dx=b.x-p.x,dy=b.y-p.y,d=Math.hypot(dx,dy)||1;if(d<R+BR&&b.h<24){const nx=dx/d,ny=dy/d;b.x=p.x+nx*(R+BR);b.y=p.y+ny*(R+BR);const rel=(b.vx-p.vx)*nx+(b.vy-p.vy)*ny;if(rel<0){b.vx-=rel*nx*1.3;b.vy-=rel*ny*1.3}}});
  if(s.rcv>=0&&s.rcvT>0){const q=s.ps[s.rcv],sp0=Math.hypot(b.vx,b.vy);if(!q.off&&sp0>120){ // assisted pass: the ball bends toward its receiver, so moving off before it arrives doesn't lose it
   const ld=s.rcvH<1?.9:.25,[dx0,dy0]=norm(q.x+q.vx*ld-b.x,q.y+q.vy*ld-b.y),dq=Math.hypot(q.x-b.x,q.y-b.y),near=dq<95,ux=b.vx/sp0,uy=b.vy/sp0,path=clamp(ux*dx0+uy*dy0,0,1),assist=s.rcvH*(.08+.42*path),kk=Math.min(1,dt*(near?11:4)*assist);let nx=ux+(dx0-ux)*kk,ny=uy+(dy0-uy)*kk;const nn=Math.hypot(nx,ny)||1,sp1=near?Math.max(170,Math.min(sp0,dq*5)):Math.max(sp0,200);b.vx=nx/nn*sp1;b.vy=ny/nn*sp1}}
 b.x+=b.vx*dt;b.y+=b.vy*dt;const f=Math.pow(.3,dt);b.vx*=f;b.vy*=f}
 if(s.own>=0&&s.own!==s.po){const o=s.own,po=s.po;touch(s,o); // new owner: pass completed / intercepted / tackle won
  if(s.pend>=0&&o!==s.pend){if(s.ps[s.pend].t===s.ps[o].t)s.st[s.pend].pc++;else s.st[o].ic++}
  else if(s.pend===-1&&po>=0&&s.ps[po].t!==s.ps[o].t)s.st[o].tk++;
  s.pend=-1;s.po=o}
 if(s.own>=0)s.poss[s.ps[s.own].t]+=dt;
 if(b.y<BR){b.y=BR;b.vy*=-.8}if(b.y>H-BR){b.y=H-BR;b.vy*=-.8}
 const gy=Math.abs(b.y-H/2)<GOAL/2;
 if(b.x<BR){if(gy){if(b.x<-4)return goal(s,1)}else{b.x=BR;b.vx*=-.8}}
 if(b.x>W-BR){if(gy){if(b.x>W+4)return goal(s,0)}else{b.x=W-BR;b.vx*=-.8}}
}
export const NOACT={mx:0,my:0,sprint:0,press:0,slide:0,call:0,pass:0,lob:0,thru:0,shoot:0,shield:0,skill:0,tackle:0};
// AI: attackers dribble, dodge, pass to free runners and shoot; defenders press, cover and mark goal-side
export function aiClassic(s,k){const p=s.ps[k],b=s.ball,u={...NOACT},d=p.t?-1:1,gx=p.t?0:W,ogx=p.t?W:0;
 const mates=s.ps.filter(q=>q.t===p.t&&!q.off),opps=s.ps.filter(q=>q.t!==p.t&&!q.off),car=s.own>=0?s.ps[s.own]:null;
 const dist=(a,x,y)=>Math.hypot(a.x-x,a.y-y),by=(x,y)=>mates.slice().sort((a,c)=>dist(a,x,y)-dist(c,x,y));let tx=p.hx,ty=p.hy;
 if(s.gk===k&&s.gkT>0){tx=ogx+d*14;ty=clamp(b.y,H/2-GOAL/2+8,H/2+GOAL/2-8);if(dist(p,b.x,b.y)<45){tx=b.x;ty=b.y}}
 else if(car===p){const dg=dist(p,gx,H/2);let o=opps[0];opps.forEach(c=>{if(dist(c,p.x,p.y)<dist(o,p.x,p.y))o=c});const near=o?dist(o,p.x,p.y):1e9;
  tx=gx;ty=H/2+(p.y<H/2?-30:30);if(near<90){ty=p.y+(p.y>o.y?90:-90);tx=p.x+d*50}
  u.sprint=near>80?1:0;if(dg<360&&(near>45||dg<200||Math.random()<.04))u.shoot=.6;
  const free=mates.filter(q=>q!==p&&(q.x-p.x)*d>-20&&dist(q,p.x,p.y)>90&&dist(q,p.x,p.y)<380&&opps.every(c=>dist(c,q.x,q.y)>60)).sort((a,c)=>(c.x-a.x)*d);
  const cal=mates.filter(q=>q!==p&&q.cl>0&&!q.ca&&dist(q,p.x,p.y)>60).sort((a,c)=>dist(a,p.x,p.y)-dist(c,p.x,p.y));if(cal.length&&Math.random()<.06){u.pass=1;u.to=cal[0]}else if(free.length&&near<75&&Math.random()<.05){u.pass=1;u.to=free[0]}}
 else if(car&&car.t===p.t){tx=clamp(p.hx+(car.x-W/2)*.55+d*70,60,W-60);ty=clamp(p.hy+(car.y-H/2)*.35,40,H-40);u.sprint=dist(p,tx,ty)>120?1:0;if(dist(p,car.x,car.y)<300&&(p.x-car.x)*d>40&&opps.every(o=>dist(o,p.x,p.y)>70)&&Math.random()<.01){u.call=1;u.ai=1}}
 else if(car){const rank=by(car.x,car.y).indexOf(p);
  if(rank===0&&dist(p,car.x,car.y)<320){tx=car.x;ty=car.y;const dc=dist(p,car.x,car.y);u.sprint=dc>90?1:0;if(dc<2*R+12&&Math.random()<.018)u.tackle=1}
  else if(rank===1){const options=opps.filter(q=>q!==car),target=options.sort((a,c)=>{const open=q=>Math.min(...mates.map(m=>dist(m,q.x,q.y)));return(dist(a,car.x,car.y)-open(a)*.35)-(dist(c,car.x,car.y)-open(c)*.35)})[0];if(target){tx=(car.x+target.x)*.5;ty=(car.y+target.y)*.5+(H/2-target.y)*.08}else{tx=car.x+(ogx-car.x)*.3;ty=car.y+(H/2-car.y)*.3}}
  else{const ms=opps.filter(o=>o!==car),ordered=ms.slice().sort((a,c)=>dist(a,p.x,p.y)-dist(c,p.x,p.y)),o=ordered[0]||car;tx=o.x+(ogx-o.x)*.25;ty=o.y+(H/2-o.y)*.1}}
 else{if(by(b.x,b.y)[0]===p||(s.rcv===k&&s.rcvT>0)){tx=b.x+b.vx*.2;ty=b.y+b.vy*.2;u.sprint=dist(p,b.x,b.y)>60?1:0}else{tx=p.hx+(b.x-W/2)*.4;ty=p.hy+(b.y-H/2)*.3}}
 const dx=tx-p.x,dy=ty-p.y,dd=Math.hypot(dx,dy);if(dd>8){u.mx=dx/dd;u.my=dy/dd}return u}

// =====================================================================================================
// STREET FB team AI (FC-style): shape and spacing, passing lanes, through balls, jockeying defence,
// timed tackles, counter-press, runs in behind. Decisions are made on a short human-like cadence (not every frame).
// Same inputs as a human player, so it works for CPU teams, bots in online rooms and AI teammates alike.
// =====================================================================================================
const AIM = new WeakMap(), AIT = new WeakMap();
const LAMB = -Math.log(.3);                                   // the ball loses 70% of its speed per second
const sgd = (ax, ay, bx, by, px, py) => { const vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy || 1, t = clamp(((px - ax) * vx + (py - ay) * vy) / l2, 0, 1); return [Math.hypot(px - (ax + vx * t), py - (ay + vy * t)), t] };
const laneRisk = (ax, ay, bx, by, opps) => { let r = 0; for (const o of opps) { const [dd, t] = sgd(ax, ay, bx, by, o.x, o.y); if (t < .06) continue; const w = dd < 46 ? 1 - dd / 46 : 0; if (w > r) r = w } return r };
const oppGap = (x, y, opps) => { let m = 1e9; for (const o of opps) { const d = Math.hypot(o.x - x, o.y - y); if (d < m) m = d } return m };
const ballAt = (b, t) => { const f = (1 - Math.exp(-LAMB * t)) / LAMB; return [b.x + b.vx * f, b.y + b.vy * f] };
function interceptPt(p, b, spd) { for (let t = .08; t < 1.9; t += .08) { const [x, y] = ballAt(b, t); if (Math.hypot(p.x - x, p.y - y) <= spd * t + R) return [x, y, t] } const [x, y] = ballAt(b, 1.9); return [x, y, 1.9] }
const aiMem = p => { let m = AIM.get(p); if (!m) { m = { lt: null, dec: 0, pt: 0, tx: p.x, ty: p.y, mx: 0, my: 0, dir: [p.fx || 1, p.fy || 0], ownT: 0, tk: 0, call: 0, spr: 0, runT: 0, sk: .84 + ((p.i * 7 + p.t * 3) % 5) * .035, hold: 0 }; AIM.set(p, m) } return m };

// Team plan: who presses, who covers, who marks whom, who chases a loose ball. Recomputed a few times per second.
function aiPlan(s, t) {
  let T = AIT.get(s); if (!T) { T = { plan: [null, null], at: [1e9, 1e9], own: -2, since: [-1e9, -1e9], lastTeam: -1 }; AIT.set(s, T) }
  const own = s.own >= 0 ? s.ps[s.own] : null, ot = own ? own.t : -1;
  if (ot !== T.lastTeam && ot >= 0) { if (T.lastTeam >= 0) T.since[ot] = s.time; T.lastTeam = ot }
  if (T.plan[t] && Math.abs(T.at[t] - s.time) < .1) return T.plan[t];
  const d = t ? -1 : 1, ogx = t ? W : 0, gx = t ? 0 : W, b = s.ball, ks = [], oks = [];
  s.ps.forEach((q, k) => { if (q.off) return; (q.t === t ? ks : oks).push(k) });
  const pl = { phase: 'loose', car: null, press: -1, cover: -1, tg: {}, chase: -1, chase2: -1, since: Math.abs(T.since[t] - s.time) };
  const rcvK = s.own < 0 && s.rcv >= 0 && s.rcvT > 0 ? s.rcv : -1;
  if (own && own.t === t) { pl.phase = 'att'; pl.car = s.own }
  else if (own) { pl.phase = 'def'; pl.car = s.own }
  else if (rcvK >= 0 && s.ps[rcvK].t === t) { pl.phase = 'att'; pl.car = rcvK }
  else if (rcvK >= 0) { pl.phase = 'def'; pl.car = rcvK }
  if (pl.phase === 'def') {
    const C = s.ps[pl.car], gd = (x, y) => norm(ogx - x, H / 2 - y), prevP = T.plan[t] && T.plan[t].press;
    const rank = ks.map(k => { const q = s.ps[k]; return [k, Math.hypot(q.x - C.x, q.y - C.y) + (q.i === 0 ? 38 : 0) + (q.stun > 0 ? 220 : 0) - (k === prevP ? 28 : 0)] }).sort((a, c) => a[1] - c[1]).map(a => a[0]);
    pl.press = rank[0]; pl.cover = rank[1] ?? -1;
    const atk = oks.filter(k => k !== pl.car).map(k => { const o = s.ps[k]; return [k, (1 - Math.hypot(o.x - ogx, o.y - H / 2) / W) * 1.1 + Math.min(1, oppGap(o.x, o.y, ks.map(j => s.ps[j])) / 120) * .5] }).sort((a, c) => c[1] - a[1]);
    const left = ks.filter(k => k !== pl.press && k !== pl.cover);
    if (pl.cover >= 0) { const th = atk[0] ? s.ps[atk[0][0]] : null, gdv = gd(C.x, C.y); pl.tg[pl.cover] = th ? { x: C.x + (th.x - C.x) * .42 + gdv[0] * 26, y: C.y + (th.y - C.y) * .42 + gdv[1] * 26 } : { x: C.x + gdv[0] * 120, y: C.y + gdv[1] * 120 } }
    const used = new Set();
    atk.forEach(([ok]) => { const o = s.ps[ok], g = gd(o.x, o.y); let bk = -1, bd = 1e9; left.forEach(k => { if (used.has(k)) return; const q = s.ps[k], dd = Math.hypot(q.x - (o.x + g[0] * 40), q.y - (o.y + g[1] * 40)) + (q.i === 0 ? -30 : 0); if (dd < bd) { bd = dd; bk = k } }); if (bk < 0) return; used.add(bk); const far = Math.hypot(o.x - ogx, o.y - H / 2) > 540, cx = C.x - o.x, cy = C.y - o.y, cl = Math.hypot(cx, cy) || 1;
      pl.tg[bk] = { x: o.x + g[0] * (far ? 90 : 40) + cx / cl * 10, y: o.y + g[1] * (far ? 90 : 40) + cy / cl * 10, mark: ok } });
    left.forEach(k => { if (used.has(k)) return; const q = s.ps[k]; pl.tg[k] = { x: clamp(q.hx + (C.x - W / 2) * .35, 60, W - 60), y: clamp(q.hy + (C.y - H / 2) * .4, 50, H - 50) } });
    // the anchor sits between the ball and goal when the carrier is dangerous
    const an = ks.find(k => s.ps[k].i === 0); if (an !== undefined && an !== pl.press && Math.hypot(C.x - ogx, C.y - H / 2) < 520) { const gdv = gd(C.x, C.y); pl.tg[an] = { x: C.x + gdv[0] * 135, y: clamp(C.y + gdv[1] * 135 * .6 + (H / 2 - C.y) * .15, 50, H - 50) } }
  } else if (pl.phase === 'loose') {
    const spd = 215, times = ks.map(k => { const q = s.ps[k], [, , tt] = interceptPt(q, b, spd); return [k, tt + (q.stun > 0 ? 1 : 0) + (q.cd > 0 ? .1 : 0)] }).sort((a, c) => a[1] - c[1]);
    pl.chase = times[0] ? times[0][0] : -1; pl.chase2 = times[1] && times[1][1] < (times[0][1] + .35) ? times[1][0] : -1;
  }
  T.plan[t] = pl; T.at[t] = s.time; return pl;
}

export function ai(s, k) {
  if (s.mode === 'shootout') return aiClassic(s, k);
  const p = s.ps[k], b = s.ball, u = { ...NOACT }, d = p.t ? -1 : 1, gx = p.t ? 0 : W, ogx = p.t ? W : 0, m = aiMem(p);
  const mates = s.ps.filter(q => q.t === p.t && !q.off), opps = s.ps.filter(q => q.t !== p.t && !q.off), car = s.own >= 0 ? s.ps[s.own] : null;
  const dt = m.lt == null ? 0 : clamp(m.lt - s.time, 0, .1); m.lt = s.time; m.dec -= dt; m.pt -= dt; m.tk -= dt; m.call -= dt; m.runT -= dt;
  const lvl = clamp(s.diff || 1, .75, 1.3), dist = (a, x, y) => Math.hypot(a.x - x, a.y - y);
  // penalty keeper keeps the old behaviour; everybody else holds still during a penalty
  if (s.gk === k && s.gkT > 0) return aiClassic(s, k);
  if (s.gkT > 0 && s.own >= 0 && s.own === s.taker && s.own !== k) return u;   // everyone else waits for the penalty to be taken
  const pl = aiPlan(s, p.t); let tx = p.x, ty = p.y, spr = 0, speed = 1;
  const mkSafe = (x, y) => [clamp(x, R + 8, W - R - 8), clamp(y, R + 8, H - R - 8)];
  if (car === p) {
    // ---------------- ball carrier ----------------
    m.ownT += dt || .016; const dg = dist(p, gx, H / 2), near = oppGap(p.x, p.y, opps);
    let nearO = null, nd = 1e9; opps.forEach(o => { const dd = dist(o, p.x, p.y); if (dd < nd) { nd = dd; nearO = o } });
    const pressed = near < 82, back = nearO && ((nearO.x - p.x) * d < 0);
    if (m.dec <= 0) {
      m.dec = (.14 + Math.random() * .12) / lvl;
      // 1) carry direction: sample angles around the goal line, prefer open space and progress
      let bestDir = m.dir, bsc = -1e9;
      const gdir = norm(gx - p.x, H / 2 + (p.y < H / 2 ? 35 : -35) * (dg < 380 ? 1 : 0) - p.y);
      for (let a = -1.15; a <= 1.16; a += .23) { const c = Math.cos(a), sn = Math.sin(a), dx = gdir[0] * c - gdir[1] * sn, dy = gdir[0] * sn + gdir[1] * c; let sc = (dx * d) * .6 + Math.abs(a) * -.08;
        const px = p.x + dx * 130, py = p.y + dy * 130; sc += Math.min(1, oppGap(px, py, opps) / 130) * 1.1; if (py < 40 || py > H - 40) sc -= .5; if (px < 40 || px > W - 40) sc -= .5; sc += laneRisk(p.x, p.y, px, py, opps) * -.9; if (sc > bsc) { bsc = sc; bestDir = [dx, dy] } }
      m.dir = bestDir;
      // 2) shot value (no keepers: a clean lane to the goal is a goal)
      const post = H / 2 + (p.y < H / 2 ? 24 : -24), blk = laneRisk(p.x, p.y, gx, H / 2, opps), ang = Math.abs(Math.atan2(H / 2 + GOAL / 2 - p.y, Math.abs(gx - p.x)) - Math.atan2(H / 2 - GOAL / 2 - p.y, Math.abs(gx - p.x)));
      const xg = clamp(ang * 3.0, 0, 1) * clamp(1.2 - dg / 420, 0, 1) * (1 - .8 * blk);
      // 3) pass options
      let best = null, bv = -9;
      mates.forEach(q => { if (q === p) return; const dd = dist(q, p.x, p.y); if (dd < 55) return; const kq = s.ps.indexOf(q), lx = q.x + q.vx * .3, ly = q.y + q.vy * .3, prog = (q.x - p.x) * d / W, open = clamp((oppGap(q.x, q.y, opps) - 28) / 85, 0, 1), risk = laneRisk(p.x, p.y, lx, ly, opps);
        const qdg = dist(q, gx, H / 2), qxg = clamp(1.2 - qdg / 420, 0, 1) * open, called = q.cl > 0 && !q.ca ? .55 : 0, distF = dd < 95 ? -.3 : dd > 360 ? -(dd - 360) / 320 : 0, backP = prog < 0 ? (pressed ? .05 : .32) : 0;
        let v = prog * 1.05 + open * .6 + qxg * .5 - risk * 2.1 + distF - backP + called, kind = 3;
        // through ball: receiver already moving into space behind the line
        const sp = Math.hypot(q.vx, q.vy), fwd = (q.vx * d) / (sp || 1);
        if (sp > 110 && fwd > .5 && (q.x - p.x) * d > 70) { const tX = q.x + q.vx * .9, tY = q.y + q.vy * .9, r2 = laneRisk(p.x, p.y, tX, tY, opps), v2 = prog * 1.3 + .5 + qxg * .6 - r2 * 1.7 + .22 + called; if (v2 > v && r2 < .45) { v = v2; kind = 5 } }
        // lob over a blocked lane to a free man
        if (risk > .45 && open > .55 && dd > 150 && dd < 380 && kind === 3) { const v3 = prog * 1.0 + open * .5 + qxg * .4 - .28 + distF + called; if (v3 > v) { v = v3; kind = 4 } }
        v += (Math.random() - .5) * .08 * (1.2 - m.sk);
        if (v > bv) { bv = v; best = { q, kind, v } } });
      const space = clamp(bsc, -1, 1), carryV = .32 * Math.max(0, space) + (dg < 460 ? .1 : 0) - (pressed ? .38 : 0) - (back ? .06 : 0);
      const ownThird = Math.abs(p.x - ogx) < 230, hog = m.ownT > 3.2;
      m.act = null;
      if (dg < 380 && xg > .28 && (xg > .4 || near > 62 || dg < 200) && !(best && bv > .95 && xg < .45) && Math.random() < .9) { const sig = dg * .4 * (pressed ? 1.5 : 1) * (p.run ? 1.2 : 1); let aimY = post + (Math.random() + Math.random() + Math.random() - 1.5) * 2 * sig; m.act = { k: 1, pw: clamp((dg + 40) * LAMB * 1.35, 480, 900), aim: aimY } }
      else if (best && (bv > carryV + .12 || (pressed && bv > -.12) || (hog && bv > -.25))) { m.act = { k: best.kind, to: best.q } }
      else if (ownThird && pressed && !best) { m.act = { k: 1, pw: 520, aim: H / 2 + (p.y < H / 2 ? -150 : 150), clear: 1 } }
      else if (nearO && nd < 78 && nd > 40 && !back && dg < 560 && p.cd <= 0 && Math.random() < .22 * m.sk && oppGap(p.x + gdir[0] * 110, p.y + gdir[1] * 110, opps.filter(o => o !== nearO)) > 80) { m.act = { k: 6 } }
      m.sh = pressed && back && !best ? 1 : 0;
    }
    // movement of the carrier
    const dir = m.dir; tx = p.x + dir[0] * 120; ty = p.y + dir[1] * 120;
    const clearAhead = oppGap(p.x + dir[0] * 90, p.y + dir[1] * 90, opps) > 105;
    spr = clearAhead && p.st > .22 ? 1 : 0; if (m.sh) { u.shield = 1; spr = 0 }
    const a = m.act; m.act = null;
    if (a) {
      m.ownT = 0; // (reset on any action; ownT counts time since last decision window)
      if (a.k === 1) { const aimY = a.aim, [ax, ay] = norm(gx - p.x, aimY - p.y); u.mx = ax; u.my = ay; u.shoot = Math.max(.08, a.clear ? .2 : (a.pw - 480) / 470); return u }
      if (a.k === 3 || a.k === 4 || a.k === 5) { u.to = a.to; if (a.k === 3) u.pass = 1; else if (a.k === 4) u.lob = 1; else u.thru = 1; const [ax, ay] = norm(a.to.x - p.x, a.to.y - p.y); u.mx = ax; u.my = ay; return u }
      if (a.k === 6) { u.skill = 1; u.mx = m.dir[0]; u.my = m.dir[1]; return u }
    }
    const mm = Math.hypot(dir[0], dir[1]) || 1; u.mx = dir[0] / mm; u.my = dir[1] / mm; u.sprint = spr; return u;
  }
  m.ownT = 0;
  const ct = pl.tg[k];
  if (pl.phase === 'att') {
    const C = s.ps[pl.car], isRcv = pl.car === k;
    if (isRcv) {                                     // pass incoming: go and meet it, show a good first touch
      const [ix, iy] = interceptPt(p, b, 225); tx = ix; ty = iy; spr = dist(p, ix, iy) > 70 ? 1 : 0; speed = 1;
    } else {
      // off-ball: pick a space to attack (runs in behind, width, support angles), re-evaluated on a short timer with hysteresis
      if (m.pt <= 0) {
        m.pt = .3 + Math.random() * .15;
        const bp = clamp((C.x - W / 2) * d / (W / 2), -1, 1), anchor = p.i === 0, sx = d * ((anchor ? 35 : 95) + (anchor ? 60 : 125) * Math.max(0, bp)) + (bp < 0 ? d * 40 * bp : 0);
        const fbx = clamp(p.hx + sx, 70, W - 70), fby = clamp(p.hy + (C.y - H / 2) * .3, 50, H - 50);
        const lineX = d > 0 ? Math.max(...opps.map(o => o.x), 0) : Math.min(...opps.map(o => o.x), W), role = [.15, .5, .5, .95, .95][p.i], isFwd = p.i >= 3;
        const score = (cx, cy) => { cx = clamp(cx, 50, W - 50); cy = clamp(cy, 36, H - 36); const risk = laneRisk(C.x, C.y, cx, cy, opps), open = clamp((oppGap(cx, cy, opps) - 25) / 90, 0, 1), prog = (cx - C.x) * d / W;
          let sc = (1 - risk) * 1.0 + open * .8 + prog * role * 1.25;
          if (isFwd) { sc += clamp(1 - Math.hypot(cx - gx, cy - H / 2) / 460, 0, 1) * .75; if ((cx - lineX) * d > -45 && open > .4) sc += .3 }
          sc -= Math.hypot(cx - fbx, cy - fby) / 310 * .95; sc -= Math.hypot(p.x - cx, p.y - cy) / 520 * .45;
          const dc = Math.hypot(cx - C.x, cy - C.y); if (dc < 110) sc -= .45; if (dc > 430) sc -= (dc - 430) / 300; if (cy < 55 || cy > H - 55) sc -= .15;
          mates.forEach(q => { if (q === p) return; const qm = AIM.get(q), qx = qm ? qm.tx : q.x, qy = qm ? qm.ty : q.y, dd = Math.hypot(cx - qx, cy - qy); if (dd < 95) sc -= .55 * (1 - dd / 95) });
          return sc };
        let bx = fbx, by = fby, bs = -1e9;
        for (const ax of [0, 70, 140, 220]) for (const ay of [-150, -75, 0, 75, 150]) { const cx = fbx + d * ax - (anchor ? d * 60 : 0), cy = fby + ay, sc = score(cx, cy); if (sc > bs) { bs = sc; bx = cx; by = cy } }
        if (score(m.tx, m.ty) < bs - .14) { m.tx = clamp(bx, 50, W - 50); m.ty = clamp(by, 36, H - 36); if (isFwd && (m.tx - p.x) * d > 120) m.runT = 1.1 }
      }
      tx = m.tx; ty = m.ty; const dd = dist(p, tx, ty);
      spr = (m.runT > 0 || dd > 190) && p.st > .25 ? 1 : 0; speed = clamp(dd / 55, .35, 1);
      // call for the ball when clear and ahead of play
      if (m.call <= 0 && dist(p, C.x, C.y) < 440 && laneRisk(C.x, C.y, p.x, p.y, opps) < .2 && oppGap(p.x, p.y, opps) > 70 && (p.x - C.x) * d > -30) { u.call = 1; u.ai = 1; m.call = 1.6 + Math.random() }
    }
  } else if (pl.phase === 'def') {
    const C = s.ps[pl.car], gdv = norm(ogx - C.x, H / 2 - C.y), dc = dist(p, C.x, C.y);
    if (k === pl.press) {
      // jockey: stay goal-side, close the gap, then time the tackle
      const lead = .22, px = C.x + C.vx * lead, py = C.y + C.vy * lead, side = C.t === 0 ? 1 : -1;
      if (dc > 120) { tx = px + gdv[0] * 30; ty = py + gdv[1] * 30; spr = p.st > .2 ? 1 : 0 }
      else { const gap = 58 + (C.sh ? 8 : 0); tx = px + gdv[0] * gap; ty = py + gdv[1] * gap; speed = clamp(dist(p, tx, ty) / 38, .4, 1); spr = dc > 80 && (C.vx * C.fx + C.vy * C.fy) > 200 ? 1 : 0 }
      if (m.tk <= 0 && p.cd <= 0 && p.stun <= 0 && dc < 2 * R + 22) {
        m.tk = (.11 + Math.random() * .09) / lvl; const frontal = (p.fx * C.fx + p.fy * C.fy) < .35, loose = dist(C, b.x, b.y) > 34, pr = (loose ? .6 : .34) * (C.sh ? .45 : 1) * (frontal ? 1 : .55) * m.sk;
        if (Math.random() < pr) u.tackle = 1;
      } else if (m.tk <= 0 && p.cd <= 0 && p.stun <= 0 && dc > 62 && dc < 100 && (C.vx * -gdv[0] + C.vy * -gdv[1]) < -150 === false && Math.hypot(C.x - ogx, C.y - H / 2) < 250 && (p.fx * C.fx + p.fy * C.fy) < .15 && Math.random() < .035 * m.sk) { u.slide = 1; m.tk = .5 }
    } else if (ct) { tx = ct.x; ty = ct.y; const dd = dist(p, tx, ty); spr = dd > 170 && p.st > .25 ? 1 : 0; speed = clamp(dd / 50, .3, 1);
      // opportunistic tackle if the carrier runs into us
      if (m.tk <= 0 && p.cd <= 0 && p.stun <= 0 && dc < 2 * R + 14 && Math.random() < .3) { u.tackle = 1; m.tk = .25 } }
    // counter-press: right after losing it the nearest two close down hard
    if (pl.since > 0 && pl.since < 1.6 && (k === pl.press || k === pl.cover) && dc < 260) { const gp = norm(C.x - p.x, C.y - p.y); tx = C.x + C.vx * .2; ty = C.y + C.vy * .2; spr = p.st > .15 ? 1 : 0; speed = 1; void gp }
  } else {
    // loose ball
    const rcvK = s.rcv >= 0 && s.rcvT > 0 ? s.rcv : -1;
    if (k === pl.chase || k === pl.chase2) { const [ix, iy] = interceptPt(p, b, 215); tx = ix; ty = iy; spr = dist(p, ix, iy) > 60 && p.st > .12 ? 1 : 0;
      if (k === pl.chase && p.cd <= 0 && p.stun <= 0 && dist(p, b.x, b.y) < R + BR + 28 && b.h < 20 && Math.random() < .5) u.tackle = 1 }
    else { const bp = clamp((b.x - W / 2) * d / (W / 2), -1, 1), anchor = p.i === 0; tx = p.hx + d * (bp * 90 + (anchor ? 0 : 40)) + (b.x - W / 2) * .12; ty = p.hy + (b.y - H / 2) * .35; const dd = dist(p, tx, ty); speed = clamp(dd / 60, .3, 1); spr = dd > 200 ? 1 : 0 }
    void rcvK;
  }
  [tx, ty] = mkSafe(tx, ty);
  // spacing: don't stack on a team-mate
  let sx = 0, sy = 0; mates.forEach(q => { if (q === p) return; const dx = p.x - q.x, dy = p.y - q.y, dd = Math.hypot(dx, dy) || 1; if (dd < 62) { sx += dx / dd * (1 - dd / 62); sy += dy / dd * (1 - dd / 62) } });
  const dx = tx - p.x, dy = ty - p.y, dd = Math.hypot(dx, dy);
  let mx = 0, my = 0; if (dd > 7) { mx = dx / dd * speed; my = dy / dd * speed }
  mx += sx * .5; my += sy * .5; const mg = Math.hypot(mx, my); if (mg > 1) { mx /= mg; my /= mg }
  m.mx += (mx - m.mx) * Math.min(1, (dt || .016) * 12); m.my += (my - m.my) * Math.min(1, (dt || .016) * 12);
  u.mx = m.mx; u.my = m.my;
  // stamina management: don't sprint when tired, recover
  if (p.st < .08) m.tired = true; else if (p.st > .45) m.tired = false;
  u.sprint = spr && !m.tired ? 1 : 0;
  return u;
}
