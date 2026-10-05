// Dog Brawl rules tests - pure functions, no server needed:  node brawl_test.js
const B=require('./brawl'),D=B.D,BREEDS=require('./breeds');
let pass=0,fail=0;const ok=(c,n)=>{c?pass++:fail++;console.log(c?'PASS':'FAIL',n)};
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const row=id=>BREEDS.find(b=>b[0]==id);
const mk=(id,over)=>{const r=row(id),f=B.mkFighter(r[0],r[2],r[6]);return Object.assign(f,over||{})};
const fixed=v=>()=>v;                      // rng that always returns v

// ---------- data: every breed has stats, a style and two different valid skills
const SKIDS=Object.keys(D.SK);
let allOk=true,seen=new Set(),arch=new Set();
for(const r of BREEDS){const s=D.statsFor(r[0],r[2],r[6]);
 if(!(s.hp>=70&&s.hp<=130&&s.atk>=15&&s.atk<=45&&s.def>=1&&s.def<=9&&s.spd>=2&&s.spd<=12&&s.sk.length==2&&s.sk[0]!=s.sk[1]&&s.sk.every(k=>SKIDS.includes(k))&&D.ARCH_OF[r[0]]))allOk=false;
 s.sk.forEach(k=>seen.add(k));arch.add(s.arch)}
ok(allOk,'all '+BREEDS.length+' breeds have sane stats, a hand-picked style and 2 different valid skills');
ok(seen.size==SKIDS.length,'every one of the '+SKIDS.length+' skills is owned by at least one breed (used: '+seen.size+')');
ok(arch.size==4,'all four fighting styles are in use');
ok(D.statsFor('greatdane','L',1.4).atk>D.statsFor('chihuahua','C',.7).atk&&D.statsFor('mastiff','L',1.35).def>D.statsFor('beagle','C',.85).def,'rarer / bigger / tankier dogs really have higher numbers');
ok(D.statsFor('greyhound','E',1.15).spd>D.statsFor('mastiff','L',1.35).spd,'a speedster is faster than a tank');
ok(D.statsFor('unknownbreed','C',1.3).arch=='tank'&&D.statsFor('unknownbreed','C',.7).arch=='speedy','an unlisted breed gets a style from its size');
ok(Object.values(D.SK).every(k=>k.ic&&k.n.length==2&&k.d.length==2&&k.cost>=1&&k.cost<=3&&['one','all','self'].includes(k.tgt)),'every skill has icon, EN+TH name, EN+TH description, cost 1-3 and a target kind');
ok(new Set(BREEDS.map(r=>D.statsFor(r[0],r[2],r[6]).hp+'/'+D.statsFor(r[0],r[2],r[6]).atk+'/'+D.statsFor(r[0],r[2],r[6]).spd)).size>=12,'dogs have clearly different stat lines');

// ---------- a plain attack
{const F=[mk('corgi'),mk('pug')];F[0].atk=30;F[1].def=0;F[1].spd=2;F[0].spd=9;const hp0=F[1].hp;
 const {ev}=B.resolve(F,[{a:'atk',t:1},{a:'grd'}],fixed(.5));
 const hit=ev.find(e=>e.k=='hit');ok(hit&&hit.i==0&&hit.t==1&&hit.d>0&&F[1].hp==hp0-hit.d,'attack hits for the reported damage');
 ok(hit.d>=Math.round(30*.9*.5)&&hit.d<=Math.round(30*1.1*.5*1.5),'guarded damage is about half of 30 ATK ('+hit.d+')');
 ok(F[0].dealt==hit.d,'damage dealt is tracked for the score');}
{const F=[mk('corgi'),mk('pug')];F[0].atk=30;F[1].def=0;F[1].spd=2;F[0].spd=9;const a=B.resolve(F,[{a:'atk',t:1},{a:'atk',t:0}],fixed(.5)).ev.filter(e=>e.k=='hit').find(e=>e.i==0).d;
 const G=[mk('corgi'),mk('pug')];G[0].atk=30;G[1].def=0;G[1].spd=2;G[0].spd=9;const b=B.resolve(G,[{a:'atk',t:1},{a:'grd'}],fixed(.5)).ev.find(e=>e.k=='hit').d;
 ok(b<a&&Math.abs(b*2-a)<=2,'guard halves the damage ('+a+' -> '+b+')');}
// ---------- order: the faster dog strikes first and a KO stops the slower one
{const F=[mk('corgi',{spd:9,atk:200,hp:100}),mk('pug',{spd:3,atk:200,hp:100})];const {ev}=B.resolve(F,[{a:'atk',t:1},{a:'atk',t:0}],fixed(.5));
 ok(ev.find(e=>e.k=='hit').i==0,'faster dog hits first');ok(!F[1].alive&&F[0].alive&&F[0].hp==100,'the KO\'d dog never gets to strike back');ok(ev.some(e=>e.k=='ko'&&e.t==1)&&ev.some(e=>e.k=='fizzle'&&e.i==1),'KO and fizzle events are sent');
 ok(F[1].ko==1,'first KO has death order 1');}
// ---------- energy and skills
{const F=[mk('corgi',{en:1,sk:['smash','nap']}),mk('pug')];const {ev}=B.resolve(F,[{a:'s0',t:1},{a:'grd'}],fixed(.5));
 ok(ev.find(e=>e.k=='act'&&e.i==0).a=='atk','a skill without enough energy turns into a normal attack');}
{const F=[mk('corgi',{en:5,sk:['smash','nap'],atk:30,spd:9}),mk('pug',{def:0,spd:2})];const hp0=F[1].hp;B.resolve(F,[{a:'s0',t:1},{a:'grd'}],fixed(.5));
 ok(F[0].en==5-3+1,'Bone Smash costs 3 energy, +1 regained ('+F[0].en+')');ok(F[1].hp<hp0,'smash damages');}
{const F=[mk('corgi',{en:5,sk:['bite','nap'],atk:30,spd:9}),mk('pug',{def:0,spd:2})];const {ev}=B.resolve(F,[{a:'s0',t:1},{a:'grd'}],fixed(.99));
 ok(ev.filter(e=>e.k=='hit').length+ev.filter(e=>e.k=='miss').length==3,'Frenzy Bite makes 3 strikes');}
{const F=[mk('corgi',{en:5,sk:['whip','nap'],atk:30,spd:9}),mk('pug',{def:0,spd:2}),mk('beagle',{def:0,spd:2})];const {ev}=B.resolve(F,[{a:'s0',t:1},{a:'grd'},{a:'grd'}],fixed(.5));
 ok(ev.filter(e=>e.k=='hit').length==2&&new Set(ev.filter(e=>e.k=='hit').map(e=>e.t)).size==2,'Tail Whip hits every enemy');}
{const F=[mk('corgi',{en:5,sk:['nap','zoom'],hp:100,atk:5}),mk('pug',{atk:5})];F[0].max=100;F[0].hp=40;const {ev}=B.resolve(F,[{a:'s0'},{a:'grd'}],fixed(.5));
 ok(ev.some(e=>e.k=='heal'&&e.i==0&&e.d>0)&&F[0].hp>40&&F[0].hp<=100,'Power Nap heals');}
{const F=[mk('corgi',{en:5,sk:['fluff','nap'],atk:5,hp:100}),mk('pug',{atk:30,spd:2})];F[0].max=100;const {ev}=B.resolve(F,[{a:'s0'},{a:'atk',t:0}],fixed(.5));
 const h=ev.find(e=>e.k=='hit');ok(h&&h.ab>0&&F[0].sh<D.SK.fluff.shield,'Fluffy Shield soaks damage first ('+(h&&h.ab)+' absorbed)');}
{const F=[mk('corgi',{en:5,sk:['zoom','nap']}),mk('pug',{atk:50,spd:2})];const hp0=F[0].hp;const {ev}=B.resolve(F,[{a:'s0'},{a:'atk',t:0}],fixed(.0));
 ok(F[0].hp==hp0&&ev.some(e=>e.k=='miss'),'Zoomies dodges every attack');}
{const F=[mk('corgi',{en:5,sk:['eyes','nap']}),mk('pug',{atk:50,spd:2})];const hp0=F[0].hp;const {ev}=B.resolve(F,[{a:'s0'},{a:'atk',t:0}],fixed(.0));
 ok(F[0].hp==hp0&&ev.some(e=>e.k=='cancel'),'Puppy Eyes can make the attacker hesitate');}
{const F=[mk('corgi',{en:5,sk:['rage','nap'],atk:20}),mk('pug',{def:0,spd:2})];B.resolve(F,[{a:'s0'},{a:'grd'}],fixed(.5));
 ok(F[0].upT>0&&F[0].up>1&&F[0].half>0,'Mad Dog raises ATK and halves DEF for a while');
 const F2=[mk('corgi',{atk:20,spd:9}),mk('pug',{def:0,spd:2,hp:999})];F2[0].up=2;F2[0].upT=2;const h2=B.resolve(F2,[{a:'atk',t:1},{a:'grd'}],fixed(.5)).ev.find(e=>e.k=='hit').d;
 const F3=[mk('corgi',{atk:20,spd:9}),mk('pug',{def:0,spd:2,hp:999})];const h3=B.resolve(F3,[{a:'atk',t:1},{a:'grd'}],fixed(.5)).ev.find(e=>e.k=='hit').d;ok(h2>=h3*1.9,'ATK buff doubles the damage ('+h3+' -> '+h2+')');}
{const F=[mk('corgi',{en:5,sk:['steal','nap'],atk:20,spd:9}),mk('pug',{def:0,spd:2,en:4})];const {ev}=B.resolve(F,[{a:'s0',t:1},{a:'grd'}],fixed(.5));
 ok(ev.some(e=>e.k=='steal'&&e.n==2),'Bone Thief steals 2 energy');}
{const F=[mk('corgi',{en:5,sk:['bark','nap'],atk:20,spd:9}),mk('pug',{def:0,spd:2,hp:999,atk:20})];B.resolve(F,[{a:'s0',t:1},{a:'grd'}],fixed(.5));
 ok(F[1].sc==1,'Scary Bark scares the target for the next round');
 const g1=B.resolve(F,[{a:'grd'},{a:'atk',t:0}],fixed(.5)).ev.find(e=>e.k=='hit');const H=[mk('corgi',{atk:20}),mk('pug',{atk:20,spd:2,hp:999})];H[0].spd=9;const g0=B.resolve(H,[{a:'grd'},{a:'atk',t:0}],fixed(.5)).ev.find(e=>e.k=='hit');
 ok(g1&&g0&&g1.d<g0.d,'a scared dog hits softer ('+g0.d+' -> '+g1.d+')');}
{const F=[mk('corgi',{en:5,sk:['pounce','nap'],spd:2,atk:30}),mk('pug',{spd:12,atk:30})];const {ev}=B.resolve(F,[{a:'s0',t:1},{a:'atk',t:0}],fixed(.5));
 ok(ev.find(e=>e.k=='hit').i==0,'Quick Pounce strikes before a much faster dog');}
// ---------- end of round bookkeeping
{const F=[mk('corgi',{en:1}),mk('pug',{en:1})];B.resolve(F,[{a:'atk',t:1},{a:'grd'}],fixed(.5));ok(F[0].en==2&&F[1].en==3,'energy: +1 per round, +1 extra for guarding');
 for(let i=0;i<10;i++)B.resolve(F,[{a:'grd'},{a:'grd'}],fixed(.5));ok(F[0].en<=D.CFG.maxEn&&F[1].en<=D.CFG.maxEn,'energy is capped at '+D.CFG.maxEn);}
// ---------- bad input can never break a round
{const F=[mk('corgi'),mk('pug'),mk('beagle')];const bad=[null,undefined,{},{a:'nuke',t:99},{a:'atk',t:-5},{a:'atk',t:0},{a:'s9',t:1},{a:'atk',t:NaN},{a:'atk',t:'1'},{a:'s0',t:'x'},{a:'atk',t:1.5}];let fine=true;
 for(const b of bad){const G=[mk('corgi'),mk('pug'),mk('beagle')];try{const {ev}=B.resolve(G,[b,b,b],mulberry(3));if(!G.every(f=>Number.isFinite(f.hp)&&f.hp>=0&&f.hp<=f.max&&Number.isFinite(f.en)&&f.en>=0)||!Array.isArray(ev))fine=false;if(ev.some(e=>e.k=='hit'&&(e.t===e.i||!Number.isFinite(e.d)||e.d<1)))fine=false}catch(e){fine=false;console.log(e)}}
 ok(fine,'garbage moves become plain attacks and never produce NaN / negative HP / self-hits');
 const G=[mk('corgi'),mk('pug')];G[1].alive=false;G[1].hp=0;const {ev}=B.resolve(G,[{a:'atk',t:1},null],mulberry(1));ok(!ev.some(e=>e.k=='hit'),'dead dogs are never targeted and do not act');}
// ---------- full random fights: invariants hold and every fight ends
{let bad=0,maxRounds=0,kos=0;const rng=mulberry(2024);
 for(let m=0;m<1500;m++){const n=2+Math.floor(rng()*3),F=Array.from({length:n},()=>{const r=BREEDS[Math.floor(rng()*BREEDS.length)];return B.mkFighter(r[0],r[2],r[6])});let rounds=0;
  while(rounds<D.CFG.rounds&&B.aliveCount(F)>1){rounds++;const picks=F.map((f,i)=>f.alive?B.botPick(F,i,rng):null);const {ev}=B.resolve(F,picks,rng);
   for(const f of F)if(!(Number.isFinite(f.hp)&&f.hp>=0&&f.hp<=f.max&&f.en>=0&&f.en<=D.CFG.maxEn+1&&f.sh>=0&&(f.alive?f.hp>0:f.hp==0)))bad++;
   const s=B.snap(F);if(s.hp.length!=n||s.al.length!=n||s.st.length!=n)bad++;
   if(D.evTime(ev)<=0)bad++;kos+=ev.filter(e=>e.k=='ko').length}
  maxRounds=Math.max(maxRounds,rounds);const keys=F.map(f=>B.rankKey(f));if(new Set(keys).size!=keys.length&&B.aliveCount(F)<n-1)bad++}
 ok(bad==0,'1500 random fights: HP/energy/shield invariants hold, snapshots well-formed, KOs get distinct ranks');ok(maxRounds<=D.CFG.rounds&&kos>1000,'fights end within '+D.CFG.rounds+' rounds and dogs do get knocked out ('+kos+' KOs)');}
// ---------- energy accounting, replayed from the events: after every round  energy = min(cap, before - skill cost - stolen + gained by stealing + 1 + 1 if guarding)
{let bad=0,steals=0,checked=0;const rng=mulberry(99);
 for(let m=0;m<800;m++){const n=2+Math.floor(rng()*3),F=Array.from({length:n},()=>{const r=BREEDS[Math.floor(rng()*BREEDS.length)];return B.mkFighter(r[0],r[2],r[6])});let rounds=0;
  while(rounds<D.CFG.rounds&&B.aliveCount(F)>1){rounds++;const before=F.map(f=>f.en),alive=F.map(f=>f.alive),picks=F.map((f,i)=>f.alive?B.botPick(F,i,rng):null),{ev}=B.resolve(F,picks,rng);
   for(const e of ev)if(e.k=='steal')steals++;
   F.forEach((f,i)=>{if(!alive[i]||!f.alive)return;let en=before[i];const act=ev.find(e=>e.k=='act'&&e.i==i);if(act&&act.a=='sk')en-=D.SK[act.s].cost;
    for(const e of ev)if(e.k=='steal'){if(e.t==i)en-=e.n;if(e.i==i)en=Math.min(D.CFG.maxEn+1,en+e.n)}
    checked++;if(f.en!==Math.min(D.CFG.maxEn,en+1+(act&&act.a=='grd'?1:0)))bad++})}}
 ok(bad==0&&steals>100,'energy bookkeeping matches the events in '+checked+' dog-rounds, including '+steals+' energy thefts (a guarding dog that gets robbed does not end up with +2)');}
// ---------- bots play sensible moves
{const rng=mulberry(7);let legal=true,usedSkill=0,usedGuard=0,total=0;
 for(let m=0;m<400;m++){const F=[mk('akita',{en:5}),mk('pug'),mk('beagle')];for(let k=0;k<3;k++){const p=B.botPick(F,0,rng);total++;if(p.a=='s0'||p.a=='s1')usedSkill++;if(p.a=='grd')usedGuard++;
  if(!['atk','grd','s0','s1'].includes(p.a)||(p.a=='atk'&&!(p.t==1||p.t==2)))legal=false}}
 ok(legal&&usedSkill>total*.25&&usedSkill<total*.8&&usedGuard>0,'bots pick legal moves and mix skills ('+Math.round(usedSkill/total*100)+'%) with the odd guard');}
console.log(`\nPASS ${pass} FAIL ${fail}`);process.exit(fail?1:0);
