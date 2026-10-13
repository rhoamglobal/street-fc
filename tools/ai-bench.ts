import {mk,step,ai,aiClassic,NOACT} from '../shared/sim';
function rng(seed:number){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function play(aiA:any,aiB:any,seed:number,len=150){
  (Math as any).random=rng(seed);
  const s:any=mk({len});const fn=(k:number)=>s.ps[k].t===0?aiA:aiB;
  let n=0,spread=[0,0],spreadN=0,depth=[0,0],oob=0,nan=0;const idle=new Array(10).fill(0),lastPos=s.ps.map((p:any)=>[p.x,p.y]);let stuck=0;
  while(!s.over&&n<60*420){
    const inp=s.ps.map((p:any,k:number)=>p.off?NOACT:fn(k)(s,k));step(s,inp,1/60);n++;
    if(n%30===0&&s.pause<=0){for(let t=0;t<2;t++){const m=s.ps.filter((p:any)=>p.t===t);let sum=0,c=0;for(let i=0;i<5;i++)for(let j=i+1;j<5;j++){sum+=Math.hypot(m[i].x-m[j].x,m[i].y-m[j].y);c++}spread[t]+=sum/c;const xs=m.map((p:any)=>p.x);depth[t]+=Math.max(...xs)-Math.min(...xs)}spreadN++}
    s.ps.forEach((p:any)=>{if(!isFinite(p.x)||!isFinite(p.y))nan++;if(p.x<0||p.x>1000||p.y<0||p.y>560)oob++});
    if(n%180===0){s.ps.forEach((p:any,k:number)=>{const d=Math.hypot(p.x-lastPos[k][0],p.y-lastPos[k][1]);if(d<6&&s.pause<=0&&s.own!==k)stuck++;lastPos[k]=[p.x,p.y]})}
  }
  const tot=(t:number,f:string)=>s.ps.reduce((a:number,p:any,k:number)=>a+(p.t===t?s.st[k][f]:0),0);
  return {score:s.score,sh:[tot(0,'sh'),tot(1,'sh')],pa:[tot(0,'pa'),tot(1,'pa')],pc:[tot(0,'pc'),tot(1,'pc')],tk:[tot(0,'tk'),tot(1,'tk')],ic:[tot(0,'ic'),tot(1,'ic')],fl:[tot(0,'fl'),tot(1,'fl')],poss:s.poss,spread:[spread[0]/spreadN,spread[1]/spreadN],depth:[depth[0]/spreadN,depth[1]/spreadN],nan,oob,stuck,steps:n,over:s.over}
}
const mode=process.argv[2]||'vs';const N=+(process.argv[3]||4);
const A=mode==='old'?aiClassic:ai,B=mode==='vs'||mode==='old'?aiClassic:ai;
const agg:any={g:[0,0],sh:[0,0],pa:[0,0],pc:[0,0],tk:[0,0],ic:[0,0],fl:[0,0],poss:[0,0],spread:[0,0],depth:[0,0],nan:0,oob:0,stuck:0,wins:[0,0,0]};
for(let i=0;i<N;i++){
  const swap=i%2===1;const r=play(swap?B:A,swap?A:B,1000+i);
  const o=swap?[1,0]:[0,1];// o[0]=index of team "A"
  const add=(key:string,arr:number[])=>{agg[key][0]+=arr[o[0]];agg[key][1]+=arr[o[1]]};
  add('g',r.score);add('sh',r.sh);add('pa',r.pa);add('pc',r.pc);add('tk',r.tk);add('ic',r.ic);add('fl',r.fl);add('poss',r.poss);add('spread',r.spread);add('depth',r.depth);
  agg.nan+=r.nan;agg.oob+=r.oob;agg.stuck+=r.stuck;
  const ga=r.score[o[0]],gb=r.score[o[1]];agg.wins[ga>gb?0:ga<gb?2:1]++;
  console.log(`match ${i+1}: A ${ga}-${gb} B | shots ${r.sh[o[0]]}-${r.sh[o[1]]} | passes ${r.pc[o[0]]}/${r.pa[o[0]]} v ${r.pc[o[1]]}/${r.pa[o[1]]} | fouls ${r.fl[o[0]]}-${r.fl[o[1]]} | steps ${r.steps}`);
}
const f=(a:number[],n=1)=>a.map(x=>(x/N).toFixed(n)).join(' - ');
console.log('--- mode',mode,'N',N);
console.log('avg goals A-B',f(agg.g),'| shots',f(agg.sh),'| passes done/att A',(agg.pc[0]/Math.max(1,agg.pa[0])*100).toFixed(0)+'%','B',(agg.pc[1]/Math.max(1,agg.pa[1])*100).toFixed(0)+'%','| att/match',f(agg.pa));
console.log('tackles won',f(agg.tk),'| intercepts',f(agg.ic),'| fouls',f(agg.fl),'| possession(s)',f(agg.poss,0));
console.log('team spread(px avg pair dist)',f(agg.spread,0),'| depth',f(agg.depth,0),'| W-D-L (A)',agg.wins.join('-'),'| NaN',agg.nan,'OOB',agg.oob,'stuck',agg.stuck);
