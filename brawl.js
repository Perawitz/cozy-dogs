// Cozy Dogs - Dog Brawl rules engine (server side). Pure functions: no sockets, no clock - so it can be unit-tested and simulated.
// The room code in arcade.js collects one move per dog each round, calls resolve(), and broadcasts the returned event list.
'use strict';
const D=require('./brawl_data');
const {SK,CFG}=D;
const rint=(rng,n)=>Math.floor(rng()*n);

function mkFighter(id,r,size){const s=D.statsFor(id,r,size);
 return{id,arch:s.arch,hp:s.hp,max:s.hp,atk:s.atk,def:s.def,spd:s.spd,en:s.en0,sk:s.sk,alive:true,
  sh:0,shT:0,         // shield points / rounds left
  up:1,upT:0,         // attack multiplier / rounds left
  half:0,             // rounds left with halved defence (Mad Dog)
  wk:0,wkN:0,         // weakened (-30% ATK): now / from next round
  sc:0,scN:0,scF:1,wkF:1,   // scared (next attack reduced to scF) / weakened (wkF): now / from next round
  guard:false,dodge:false,eyes:0,   // this round only (eyes = chance that an attacker melts)
  dealt:0,ko:0}}     // total damage dealt; order of death (1 = first to fall)

const dodgeChance=(g,f)=>Math.min(.22,.05+.012*Math.max(0,g.spd-f.spd));

// one hit of damage from f onto g (does not apply it)
function hitDamage(f,g,mult,sk,rng){
 let a=f.atk*(f.upT>0?f.up:1)*(f.wk>0?f.wkF:1)*(f.sc>0?f.scF:1)*mult*(.9+rng()*.2);
 const crit=rng()<.08+f.spd*.004;if(crit)a*=1.5;
 a*=1-Math.min(.5,g.def*(g.half>0?.5:1)*.03);
 if(g.guard)a*=(sk&&sk.pierce)?.75:.5;
 return{d:Math.max(1,Math.round(a)),crit}}

// A move is {a:'atk'|'grd'|'s0'|'s1', t:targetIndex}. Anything illegal is replaced by a plain attack on a random foe.
function normalise(F,i,p,rng){
 const f=F[i];p=p||{};let a=p.a,sk=null,sid=null,t=Number.isInteger(p.t)?p.t:-1;
 if(a=='s0'||a=='s1'){sid=f.sk[a=='s0'?0:1];sk=SK[sid];if(!sk||f.en<sk.cost){a='atk';sk=null;sid=null}}
 else if(a!='grd')a='atk';
 if(a=='atk'||(sk&&sk.tgt=='one')){if(!(t!==i&&t>=0&&t<F.length&&F[t].alive)){const fo=[];F.forEach((g,j)=>{if(j!==i&&g.alive)fo.push(j)});t=fo.length?fo[rint(rng,fo.length)]:-1}}
 return{i,a,sk,sid,t}}

function selfSkill(f,i,sid,ev){const k=SK[sid];
 if(k.shield){f.sh=Math.min(k.shield*2,f.sh+k.shield);f.shT=3;ev.push({k:'shield',i,v:f.sh})}
 if(k.heal){const h=Math.min(f.max-f.hp,Math.round(f.max*k.heal));f.hp+=h;if(h>0)ev.push({k:'heal',i,d:h})}
 if(sid=='zoom'){f.dodge=true;ev.push({k:'buff',i,s:'zoom'})}
 if(sid=='eyes'){f.eyes=k.p;ev.push({k:'buff',i,s:'eyes'})}
 if(k.up){f.up=Math.max(f.up,k.up);f.upT=3;if(sid!='zoom')ev.push({k:'buff',i,s:sid=='rage'?'rage':'up'})}
 if(sid=='rage')f.half=3}

// Resolve one round. F = fighters (mutated), picks = one move per fighter index. Returns the list of events to animate.
function resolve(F,picks,rng){
 rng=rng||Math.random;F.seq=F.seq||0;const ev=[],N=F.length;
 const foes=i=>{const a=[];for(let j=0;j<N;j++)if(j!==i&&F[j].alive)a.push(j);return a};
 // 1. normalise every living dog's move and pay the energy
 const acts=[];for(let i=0;i<N;i++)if(F[i].alive){const x=normalise(F,i,picks&&picks[i],rng);if(x.sk)F[i].en-=x.sk.cost;acts.push(x)}
 // 2. guards and self skills happen first, together
 for(const x of acts){const f=F[x.i];
  if(x.a=='grd'){f.guard=true;ev.push({k:'act',i:x.i,a:'grd'})}
  else if(x.sk&&x.sk.tgt=='self'){ev.push({k:'act',i:x.i,a:'sk',s:x.sid});selfSkill(f,x.i,x.sid,ev)}}
 // 3. attacks, fastest dog first (Quick Pounce goes before everybody)
 const att=acts.filter(x=>x.a=='atk'||(x.sk&&x.sk.tgt!='self'));
 att.forEach(x=>{x.o=(x.sk&&x.sk.pri?100:0)+F[x.i].spd+rng()*.9});att.sort((p,q)=>q.o-p.o||p.i-q.i);
 for(const x of att){const f=F[x.i];
  if(!f.alive){ev.push({k:'fizzle',i:x.i});continue}
  ev.push(x.sk?{k:'act',i:x.i,a:'sk',s:x.sid}:{k:'act',i:x.i,a:'atk',t:x.t});
  let tg;if(x.sk&&x.sk.tgt=='all')tg=foes(x.i);else{let t=x.t;if(t<0||!F[t].alive){const fo=foes(x.i);t=fo.length?fo[rint(rng,fo.length)]:-1}tg=t>=0?[t]:[]}
  const mult=x.sk?x.sk.mult:1,hits=x.sk&&x.sk.hits||1;
  for(const t of tg){const g=F[t];if(!g.alive)continue;
   if(g.eyes&&rng()<g.eyes){ev.push({k:'cancel',i:x.i,t});continue}
   for(let h=0;h<hits&&g.alive;h++){
    if(g.dodge||rng()<dodgeChance(g,f)){ev.push({k:'miss',i:x.i,t});continue}
    const r=hitDamage(f,g,mult,x.sk,rng);let d=r.d,ab=0;
    if(g.sh>0){ab=Math.min(g.sh,d);g.sh-=ab;d-=ab}
    g.hp=Math.max(0,g.hp-d);f.dealt+=d;
    ev.push({k:'hit',i:x.i,t,d,c:r.crit?1:0,ab});
    if(g.hp<=0){g.alive=false;g.ko=++F.seq;ev.push({k:'ko',t})}}
   if(g.alive&&x.sk&&x.sk.sc){g.scN=1;g.scF=x.sk.sc;ev.push({k:'debuff',t,s:'scared'})}
   if(g.alive&&x.sk&&x.sk.wk){g.wkN=1;g.wkF=x.sk.wk;ev.push({k:'debuff',t,s:'weak'})}
   if(x.sk&&x.sk.take){const n=Math.min(x.sk.take,g.en);if(n>0){g.en-=n;f.en=Math.min(CFG.maxEn+1,f.en+n);ev.push({k:'steal',i:x.i,t,n})}}}}
 // 4. end of the round: energy comes back, timers tick down, "next round" effects switch on
 for(const f of F){if(!f.alive)continue;
  f.en=Math.min(CFG.maxEn,f.en+1+(f.guard?1:0));
  if(f.shT>0&&--f.shT==0)f.sh=0;
  if(f.upT>0&&--f.upT==0)f.up=1;
  if(f.half>0)f.half--;
  f.wk=f.wkN;f.wkN=0;f.sc=f.scN;f.scN=0;
  f.guard=f.dodge=false;f.eyes=0}
 return{ev}}

// ---- what the clients see after every round
const snap=F=>({hp:F.map(f=>f.hp),en:F.map(f=>f.en),al:F.map(f=>f.alive?1:0),
 st:F.map(f=>({sh:f.sh,u:f.upT>0&&f.up>1?1:0,w:f.wk>0?1:0,s:f.sc>0?1:0,r:f.half>0?1:0})),dm:F.map(f=>f.dealt)});

// ---- bot brain: heal when hurt, otherwise mix attacks, skills and the odd guard; likes to finish the weakest dog
function botPick(F,i,rng){
 rng=rng||Math.random;const f=F[i],fo=[];F.forEach((g,j)=>{if(j!==i&&g.alive)fo.push(j)});
 if(!fo.length)return{a:'grd',t:-1};
 const weakest=fo.map(j=>[F[j].hp+rng()*8,j]).sort((a,b)=>a[0]-b[0])[0][1],tgt=()=>rng()<.45?weakest:fo[rint(rng,fo.length)];   // (random tie-break: equal HP must not always mean 'the first dog')
 const aff=[0,1].filter(k=>SK[f.sk[k]]&&f.en>=SK[f.sk[k]].cost);
 if(f.hp<f.max*.4)for(const k of aff){const id=f.sk[k];if((id=='nap'||id=='fluff'||id=='eyes')&&rng()<.8)return{a:'s'+k,t:-1}}
 const useful=aff.filter(k=>{const id=f.sk[k];if(id=='nap')return f.hp<f.max*.75;if(id=='fluff')return f.sh<10;return true});
 if(useful.length&&rng()<.55){const k=useful[rint(rng,useful.length)];return{a:'s'+k,t:SK[f.sk[k]].tgt=='one'?tgt():-1}}
 if(rng()<.1)return{a:'grd',t:-1};
 return{a:'atk',t:tgt()}}

// ---- final ordering: survivors by HP (then damage dealt), the fallen by how late they fell
function rankKey(f){return f.alive?1e5+f.hp*100+Math.min(99,f.dealt/10):f.ko}
const aliveCount=F=>F.filter(f=>f.alive).length;

module.exports={D,mkFighter,resolve,snap,botPick,rankKey,aliveCount,normalise,hitDamage,dodgeChance};
