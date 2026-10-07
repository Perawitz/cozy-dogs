// v7 tests (part 3): the Dog Nursery (breeding) in depth.
//   nur_get / nur_pair / nur_hatch / nur_fast: whole pair -> wait -> hatch flow, rest cooldown, nest slots (+ house level), fee by parent rarity,
//   bond makes eggs hatch sooner, gem speed-up price + cap, early hatch refused, baby / premium / same dog / other player's dog / away / favourite dogs,
//   the 100-dog limit with eggs waiting, double-click / spam safety, hostile inputs, egg contents never leave the server,
//   and statistical gene checks (geneKid directly) compared with the odds the nursery window shows (nurCalc from src/nursery.js).
// Self-contained: starts its OWN servers. N (PORT+19) runs in real time; F (PORT+20) runs with CD_HATCH=36000 (a 30 min egg hatches in 50 ms, rest lasts 1.2 s).
// Accounts are registered first, then the servers are stopped, the data files are patched (dogs of every rarity, bonds, eggs, house levels) and restarted.
'use strict';
const {spawn}=require('child_process'),os=require('os'),path=require('path'),fs=require('fs');
const BASE=+(process.env.PORT||3055),PN=BASE+19,PF=BASE+20;
const TRD=require('./traits'),BREEDS=require('./breeds'),PREM=require('./premium');
const BRM=Object.fromEntries(BREEDS.concat(PREM).map(b=>[b[0],b]));
const RL=['C','R','E','L','M'],RO={C:0,R:1,E:2,L:3,M:4};
const HATCH_H={C:.5,R:1,E:2,L:4,M:6},COST={C:80,R:150,E:300,L:600,M:1000};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let pass=0,fail=0;const ok=(c,n)=>{c?pass++:fail++;console.log(c?'PASS':'FAIL',n)};const note=n=>console.log('INFO',n);
const KEY='testadminkey1';
const ALL=[];   // every message every client ever received (raw text), to prove nothing secret is ever sent
function cli(PORT){return new Promise((res,rej)=>{const ws=new WebSocket('ws://localhost:'+PORT),log=[];
  const o={ws,log,send:m=>ws.send(JSON.stringify(m)),raw:s=>ws.send(s),
   wait:(t,ms=3000,f=null)=>new Promise((ok,no)=>{const g=()=>{const i=log.findIndex(x=>x.t==t&&(!f||f(x)));if(i>=0)return ok(log.splice(i,1)[0]);if((ms-=25)<=0)return no(new Error('timeout '+t));setTimeout(g,25)};g()}),
   last:t=>[...log].reverse().find(x=>x.t==t),count:(t,f)=>log.filter(x=>x.t==t&&(!f||f(x))).length,clear:t=>{for(let i=log.length-1;i>=0;i--)if(!t||log[i].t==t)log.splice(i,1)},
   async auth(m){o.send(m);const a=await o.wait('auth',4000);if(a.ok){await o.wait('welcome',3000).then(w=>o.welcome=w);await o.wait('me',3000)}return a},
   async dogs(){o.clear('dogs_all');o.send({t:'dogs_get'});return(await o.wait('dogs_all')).dogs},
   async nur(){o.clear('nur');o.send({t:'nur_get'});return o.wait('nur')},
   async toast(ms=1500){try{return(await o.wait('toast',ms)).m}catch{return null}},
   async tick(){await sleep(150);return o.me}};
  ws.onmessage=e=>{ALL.push(String(e.data));const m=JSON.parse(e.data);if(m.t=='me')o.me=m;log.push(m)};ws.onopen=()=>res(o);ws.onerror=()=>rej(new Error('connect'))})}
const tryWait=async(c,t,ms,f)=>{try{return await c.wait(t,ms,f)}catch{return null}};
const mkData=port=>path.join(os.tmpdir(),'cozydogs_t13_'+port+'_'+process.pid+'.json');
const start=(port,data,env)=>{
  const p=spawn(process.execPath,[path.join(__dirname,'server.js')],{env:{...process.env,PORT:String(port),DATA:data,ADMIN_KEY:KEY,CD_TEST:'1',...env},stdio:['ignore','pipe','pipe']});
  let err='';p.stderr.on('data',d=>err+=d);p.getErr=()=>err;p.data=data;p.exited=new Promise(r=>p.on('exit',r));return p};
const reg=async(port,name)=>{const c=await cli(port);const a=await c.auth({t:'register',user:name,email:name+'@example.com',pass:'secret12'});if(!a.ok)throw new Error('register '+name+': '+JSON.stringify(a));return c};
const login=async(port,name)=>{const c=await cli(port);const a=await c.auth({t:'login',user:name,pass:'secret12'});if(!a.ok)throw new Error('login '+name+': '+JSON.stringify(a));return c};
const admin=async c=>{c.send({t:'admin',key:KEY,coins:1e6});await sleep(200)};

// ---------------------------------------------------------------- seed data (patched into the saved json while the server is stopped)
let SEQ=0;const NOW0=Date.now();
const mkDog=(tpl,breed,o)=>Object.assign({id:'sd'+(++SEQ)+'x'+Math.random().toString(36).slice(2,6),breed,variant:'Normal',name:'Pup'+SEQ,pers:tpl.pers,bond:0,hunger:80,energy:80,happy:70,clean:80,
  favFood:tpl.favFood,favToy:tpl.favToy,born:NOW0-1e10,gv:1,tr:[],tricks:[],acc:null,fav:false,away:false},o||{});
const mkEgg=(o)=>Object.assign({id:'eg'+(++SEQ)+Math.random().toString(36).slice(2,6),t0:NOW0-1000,at:NOW0+36e5,rar:'C',kid:{breed:'corgi',mix:null,ms:0,variant:'Normal',tr:[],mut:false,rar:'C'},
  pa:{n:'Mum',b:'corgi',m:null,v:'Normal'},pb:{n:'Dad',b:'pug',m:null,v:'Normal'},cm:0},o||{});
const SEED={};   // name -> {server:'N'|'F', build:(p,mk,mkE)=>void}
const reserve=(name,server,build)=>SEED[name]={server,build};
// ---- N (real time)
reserve('NurA','N',(p,d)=>{p.dogs.push(
  d('corgi',{name:'CorgiA',id:'A_corgi'}),d('pug',{name:'PugA',id:'A_pug'}),d('beagle',{name:'FavA',fav:true,id:'A_fav'}),d('dachshund',{name:'AwayA',away:true,id:'A_away'}),
  d('mochipup',{name:'MochiA',id:'A_prem'}),d('chihuahua',{name:'ChiA',id:'A_chi'}),d('pomeranian',{name:'PomA',id:'A_pom'}),d('husky',{name:'HuskyA',id:'A_husky'}),d('shiba',{name:'ShibaA',id:'A_shiba'}))});
reserve('NurB','N',(p,d)=>{p.dogs.push(d('corgi',{name:'CorgiB',id:'B_corgi'}),d('pug',{name:'PugB',id:'B_pug'}))});
reserve('NurBond','N',(p,d)=>{p.dogs.push(d('corgi',{id:'K_a',bond:100}),d('pug',{id:'K_b',bond:100}),d('shihtzu',{id:'K_c',bond:100}),d('maltese',{id:'K_d',bond:0}),d('yorkie',{id:'K_e',bond:60}),d('bichon',{id:'K_f',bond:100}))});
reserve('NurHouse','N',(p,d)=>{p.xp=5000;for(let i=1;i<=10;i++)p.dogs.push(d(['corgi','pug','beagle','dachshund','maltese'][i%5],{id:'H_'+i}))});
reserve('NurCap','N',(p,d,e)=>{p.gems=36;p.hl=2;p.nest=[e({id:'CAP_far',at:NOW0+30*864e5,t0:NOW0-1000,cm:40,kid:{breed:'corgi',mix:null,ms:0,variant:'Normal',tr:['heart'],mut:false,rar:'C'}}),
  e({id:'CAP_3h',at:NOW0+3*36e5,t0:NOW0-1000}),e({id:'CAP_3h2',at:NOW0+3*36e5,t0:NOW0-1000})]});
reserve('NurPoor','N',(p,d)=>{p.coins=100;p.gems=0;p.dogs.push(d('husky',{id:'P_h'}),d('shiba',{id:'P_s'}),d('corgi',{id:'P_c'}),d('pug',{id:'P_p'}))});
// ---- F (hatching x36000)
reserve('FastA','F',(p,d)=>{p.hl=3;p.dogs.push(d('corgi',{id:'F_c1',bond:20}),d('pug',{id:'F_c2',bond:20}),
  d('chihuahua',{id:'F_C1'}),d('pomeranian',{id:'F_C2'}),d('husky',{id:'F_R1'}),d('shiba',{id:'F_R2'}),d('akita',{id:'F_E1'}),d('chowchow',{id:'F_E2'}),
  d('malamute',{id:'F_L1'}),d('saintbernard',{id:'F_L2'}),d('galaxyhusky',{id:'F_M1'}),d('rainbowcorgi',{id:'F_M2'}),
  d('corgi',{id:'F_X1',mix:'husky',ms:2}),d('pug',{id:'F_X2'}),                          // a mixed dog counts with BOTH breeds: R
  d('beagle',{id:'F_Y1'}),d('starpuppy',{id:'F_Y2'}),                                     // common x mythic: the fee follows the rarest breed (M)
  d('boston',{id:'F_Z1',mix:'akita',ms:1}),d('jackrussell',{id:'F_Z2'}),                    // common dog carrying an Epic gene: E
  d('maltese',{id:'F_T1',tr:['heart','star'],bond:90}),d('yorkie',{id:'F_T2',tr:['heart'],bond:90}))});
reserve('FastFull','F',(p,d,e)=>{p.hl=1;p.gems=500;p.dogs.push(d('corgi',{id:'FU_p1'}),d('pug',{id:'FU_p2'}));for(let i=0;i<97;i++)p.dogs.push(d('corgi',{id:'FU_f'+i}));
  p.nest=[e({id:'FU_e1',at:NOW0-5000,kid:{breed:'pug',mix:null,ms:0,variant:'Normal',tr:[],mut:false,rar:'C'},rar:'C'}),e({id:'FU_e2',at:NOW0-5000,rar:'C'})]});
reserve('FastSpam','F',(p,d,e)=>{p.gems=100;p.hl=1;p.dogs.push(d('corgi',{id:'S_a'}),d('pug',{id:'S_b'}),d('beagle',{id:'S_c'}),d('maltese',{id:'S_d'}));
  p.nest=[e({id:'SP_far',at:NOW0+30*864e5,t0:NOW0-1000,rar:'M'})]});
reserve('FastHostile','F',(p,d,e)=>{p.coins=1000;p.gems=50;p.hl=1;p.dogs.push(d('corgi',{id:'X_a'}),d('pug',{id:'X_b'}),d('beagle',{id:'X_baby',born:NOW0}));
  p.nest=[e({id:'HO_egg',at:NOW0+36500*864e5,t0:NOW0-1000,rar:'L'})]});
reserve('FastHatchOnly','F',(p,d,e)=>{p.dogs.push(d('corgi',{id:'HC_a'}));p.nest=[e({id:'HC_e',at:NOW0-5000})]});

// ================================================================= main
(async()=>{
const dN=mkData(PN),dF=mkData(PF);
const envN={},envF={CD_HATCH:'36000',CD_RATE:'3000'};
let N=start(PN,dN,envN),F=start(PF,dF,envF);await sleep(1800);
const servers=[];
const done=async()=>{for(const p of [N,F])try{p.kill()}catch{}for(const f of [dN,dF])for(const x of [f,f+'.bak'])try{fs.unlinkSync(x)}catch{}
  const e=(N.getErr()+F.getErr()+(servers.map(s=>s.getErr()).join('')));if(e.trim())console.log('SERVER STDERR:\n'+e.slice(0,1500));ok(!e.trim(),'servers wrote nothing to stderr (no exceptions)');
  console.log('\nPASS',pass,'FAIL',fail);process.exit(fail?1:0)};
try{
// ============================================================ 1. gene maths (no network): geneKid vs the odds the nursery window shows
const PT=require('./pets')({db:{players:{}},conns:new Map(),send(){},wsOf(){},player(){},clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),rnd:(a,b)=>a+Math.random()*(b-a),pick:a=>a[Math.floor(Math.random()*a.length)],rid:()=>Math.random().toString(36).slice(2),today:()=>'x',sendMe(){},pushHouse(){},pub:d=>d,rt:d=>d,BR:BRM,dirty(){},own:(o,k)=>Object.prototype.hasOwnProperty.call(o,k),safe:(n,f)=>f,hlOf:()=>0,maxDogs:()=>8,isGuestName:()=>false,mkDog(){},F:{},bump(){},addXp(){},GK:1,lvl:()=>9});
const src=fs.readFileSync(path.join(__dirname,'src','nursery.js'),'utf8');
const calcSrc=src.slice(src.indexOf('//#calc-begin'),src.indexOf('//#calc-end'));
const {nurCalc,NR}=new Function('TRD',calcSrc+';return{nurCalc,NR}')(TRD);
const defM=src.match(/const DEF=(\{[^\n]*\});/);const DEF=defM?new Function('return '+defM[1])():null;
ok(DEF&&JSON.stringify(DEF.hatchH)==JSON.stringify(PT.HATCH_H)&&JSON.stringify(DEF.cost)==JSON.stringify(PT.BREED_COST)&&DEF.maxDogs==PT.MAXDOGS,'the window\'s fallback numbers (hatch hours, fees, 100 dogs) equal the server\'s');
const RORD=n=>RO[BRM[n][2]];
const EN=hk=>({ro:RORD,pool:t=>BREEDS.filter(b=>RO[b[2]]==t).map(b=>b[0]),hatchH:PT.HATCH_H,cost:PT.BREED_COST,hk});
const mk=(b,o)=>Object.assign({breed:b,variant:'Normal',tr:[],bond:0},o||{});
const near=(x,y,tol)=>Math.abs(x-y)<=tol;
const CASES=[
 ['Corgi x Corgi (pure)',mk('corgi'),mk('corgi')],
 ['Corgi x Husky',mk('corgi'),mk('husky')],
 ['Corgi(+Husky) x Pug',mk('corgi',{mix:'husky',ms:2}),mk('pug')],
 ['Husky(+Akita) x Shiba(+Chow Chow), bond 90',mk('husky',{mix:'akita',ms:1,bond:90}),mk('shiba',{mix:'chowchow',ms:3,bond:90})],
 ['Galaxy Husky x Galaxy Husky (Mythic)',mk('galaxyhusky'),mk('galaxyhusky')],
 ['Pug x Starpuppy (C x M)',mk('pug'),mk('starpuppy')],
 ['Akita x Malamute, bond 60',mk('akita',{bond:60}),mk('malamute',{bond:60})]];
const NS=30000;
for(const [nm,a,b] of CASES){
  const cal=nurCalc(a,b,EN(1)),bond=cal.bond;let mixed=0,mutN=0;const egg={},valid={ok:true};
  for(let i=0;i<NS;i++){const k=PT.geneKid(a,b,bond);if(k.mix)mixed++;if(k.mut)mutN++;egg[k.rar]=(egg[k.rar]|0)+1;
    const rr=RL[Math.max(RORD(k.breed),k.mix?RORD(k.mix):0)];if(rr!=k.rar||!BRM[k.breed]||BRM[k.breed][7]||(k.mix&&(!BRM[k.mix]||k.mix==k.breed||BRM[k.mix][7]))||k.tr.length>2||new Set(k.tr).size!=k.tr.length||!k.tr.every(TRD.isTrait))valid.ok=false}
  ok(valid.ok,nm+': every kid is valid (real non-premium breeds, mix != breed, egg rarity = rarest of its two breeds, <=2 distinct traits)');
  ok(near(mixed/NS,cal.mixP,.015),nm+': mixed-breed chance '+(mixed/NS*100).toFixed(1)+'% vs window '+(cal.mixP*100).toFixed(1)+'%');
  ok(RL.every(R=>near((egg[R]|0)/NS,cal.eggP[R]||0,.015)),nm+': egg colours '+RL.map(R=>R+' '+((egg[R]|0)/NS*100).toFixed(1)+'/'+((cal.eggP[R]||0)*100).toFixed(1)).join('  '));
  ok(near(mutN/NS,cal.mut?cal.mut.p:0,.01),nm+': mutation chance '+(mutN/NS*100).toFixed(1)+'% vs '+((cal.mut?cal.mut.p:0)*100).toFixed(1)+'%');
  ok(cal.cost==COST[RL[Math.max(...[a.breed,a.mix,b.breed,b.mix].filter(Boolean).map(RORD))]],nm+': window fee '+cal.cost+' follows all four genes')}
{ // traits, new trait chance, tiers, bond bonus
 const T=async(a,b,id)=>{const cal=nurCalc(a,b,EN(1));let hit=0,any=0;const tiers=[0,0,0,0];for(let i=0;i<NS;i++){const k=PT.geneKid(a,b,cal.bond);if(id&&k.tr.includes(id))hit++;if(k.tr.length)any++;if(!id&&k.tr.length)tiers[TRD.TR[k.tr[0]].tier]++}return{cal,hit:hit/NS,any:any/NS,tiers}};
 let r=await T(mk('pug',{tr:['heart']}),mk('pug'),'heart');ok(near(r.hit,.5,.015)&&near(r.cal.parentTr[0].p,.5,1e-9),'one parent carries a trait: passed on '+(r.hit*100).toFixed(1)+'% (window 50%)');
 r=await T(mk('pug',{tr:['heart']}),mk('pug',{tr:['heart']}),'heart');ok(near(r.hit,.75,.015)&&near(r.cal.parentTr[0].p,.75,1e-9),'both parents carry it: '+(r.hit*100).toFixed(1)+'% (window 75%, two rolls)');
 for(const bd of [0,55,85]){r=await T(mk('pug',{bond:bd}),mk('pug',{bond:bd}),null);ok(near(r.any,r.cal.newP,.015),'no parent traits, bond '+bd+': a new trait appears '+(r.any*100).toFixed(1)+'% (window '+(r.cal.newP*100).toFixed(1)+'%)');
  const n=r.tiers[1]+r.tiers[2]+r.tiers[3];ok(r.cal.tierP.every((p,i)=>near(r.tiers[i+1]/n,p,.025)),'  ...tier mix common/uncommon/rare '+r.tiers.slice(1).map(x=>(x/n*100).toFixed(0)).join('/')+'% vs window '+r.cal.tierP.map(x=>(x*100).toFixed(0)).join('/')+'%')}
 const lo=nurCalc(mk('pug'),mk('pug'),EN(1)),hi=nurCalc(mk('pug',{bond:90}),mk('pug',{bond:90}),EN(1));ok(hi.newP>lo.newP&&hi.mul<lo.mul&&Math.abs(hi.mul-.775)<1e-9,'the window agrees: close bond = more new traits and eggs hatch 22.5% sooner');
 let big=true;for(let i=0;i<4000;i++){const k=PT.geneKid(mk('pug',{tr:['heart','star']}),mk('pug',{tr:['halo','wings']}),100);if(k.tr.length>2||!k.tr.every(TRD.isTrait))big=false}ok(big,'4 parent traits never produce more than 2 traits in a kid');
}

// ============================================================ 2. seed the data files
const names={N:['NurA','NurB','NurBond','NurHouse','NurCap','NurPoor','NurVis'],F:['FastA','FastFull','FastSpam','FastHostile','FastHatchOnly']};
for(const c of await Promise.all([...names.N.map(n=>reg(PN,n)),])){c.ws.close()}
for(const n of names.F){const c=await reg(PF,n);c.ws.close()}
await sleep(300);
for(const p of [N,F])p.kill('SIGTERM');await Promise.all([N.exited,F.exited]);
for(const [file,srv] of [[dN,'N'],[dF,'F']]){const db=JSON.parse(fs.readFileSync(file,'utf8'));
  for(const [nm,s] of Object.entries(SEED)){if(s.server!=srv)continue;const p=db.players[nm];if(!p)throw new Error('seed: no player '+nm);const tpl=p.dogs[0];
    const d=(b,o)=>mkDog(tpl,b,o),e=o=>mkEgg(o);s.build(p,d,e)}
  fs.writeFileSync(file,JSON.stringify(db))}
N=start(PN,dN,envN);F=start(PF,dF,envF);await sleep(1800);

// ============================================================ 3. N: real-time server
const A=await login(PN,'NurA'),B=await login(PN,'NurB');await admin(A);await admin(B);
const nv=A.welcome.v7;ok(nv.hatchH.M==6&&nv.cost.M==1000&&nv.restH==12&&nv.hk==1&&nv.maxDogs==100,'welcome.v7 carries hatch hours, fees, rest hours, the 100-dog limit');
ok(JSON.stringify(nv.hatchH)==JSON.stringify(DEF.hatchH)&&JSON.stringify(nv.cost)==JSON.stringify(DEF.cost)&&nv.restH==DEF.restH,'...and they match the window\'s fallback numbers');
let nu=await A.nur();ok(nu.max==2&&nu.eggs.length==0&&Number.isFinite(nu.now),'level-1 house: 2 nests, none used');
ok(A.me.eggs===0&&A.me.eggsAll===0,'me.eggs / me.eggsAll are 0 (dock badge)');
let ds=await A.dogs();const dOf=id=>ds.find(d=>d.id==id);
const A0=A.me.coins;
// --- refusals (nest empty, so each refusal is about the dogs)
const refuse=async(c,msg,re,why)=>{c.clear('toast');c.clear('nur_ok');const m0=c.me.coins,g0=c.me.gems;c.send(msg);const t=await c.toast();await c.tick();const e=await c.nur();
  ok(re.test(t||'')&&!c.last('nur_ok')&&e.eggs.length==(c.expectEggs|0)&&c.me.coins==m0&&c.me.gems==g0,why+(t?' -> '+t:' -> (no message)'))};
A.expectEggs=0;
await refuse(A,{t:'nur_pair',a:'A_corgi',b:'A_corgi'},/ต่างกัน/,'the same dog twice is refused');
await refuse(A,{t:'nur_pair',a:'A_corgi'},/ต่างกัน/,'a missing second dog is refused');
await refuse(A,{t:'nur_pair',a:'A_corgi',b:'B_corgi'},/ต่างกัน/,'another player\'s dog cannot be used');
await refuse(A,{t:'nur_pair',a:'B_pug',b:'A_pug'},/ต่างกัน/,'...in either slot');
await refuse(A,{t:'nur_pair',a:'A_corgi',b:'A_prem'},/พรีเมียม/,'a premium dog cannot be bred');
await refuse(A,{t:'nur_pair',a:'A_prem',b:'A_corgi'},/พรีเมียม/,'...in either slot');
{const baby=ds.find(d=>TRD.stageOf(d.born,Date.now(),1)<3);ok(!!baby,'(setup) the starter dog of a new account is still a baby');
 await refuse(A,{t:'nur_pair',a:baby.id,b:'A_corgi'},/โตไม่เต็มวัย/,'a baby cannot be bred');await refuse(A,{t:'nur_pair',a:'A_corgi',b:baby.id},/โตไม่เต็มวัย/,'...in either slot')}
// --- the first egg, no bond: cost, hatch time, hidden contents
const bef=A.me.coins;A.clear('nur');A.clear('nur_ok');A.send({t:'nur_pair',a:'A_corgi',b:'A_pug'});await A.wait('nur_ok');nu=await A.wait('nur');await A.tick();
const e1=nu.eggs[0];
ok(nu.eggs.length==1&&A.me.coins==bef-80,'Corgi x Pug (common): fee 80 coins');
ok(Object.keys(e1).sort().join()=='cm,id,left,pa,pb,rar,total'&&RL.includes(e1.rar),'an egg shows only id, colour, time, parents and bond: '+Object.keys(e1).sort().join(','));
ok(e1.pa.b=='corgi'&&e1.pb.b=='pug'&&e1.cm===0&&Math.abs(e1.total-HATCH_H[e1.rar]*36e5)<5&&e1.left<=e1.total&&e1.left>e1.total-3000,'hatch time = '+HATCH_H[e1.rar]+' h for a '+e1.rar+' egg (bond 0), parent cards ok');
ok(A.me.eggsAll==1&&A.me.eggs==0,'me.eggsAll=1, me.eggs=0 (not ready yet)');
ds=await A.dogs();ok(dOf('A_corgi').rest>11.9*36e5&&dOf('A_corgi').rest<=12*36e5&&dOf('A_pug').rest>11.9*36e5,'both parents now rest 12 hours');
A.expectEggs=1;await refuse(A,{t:'nur_pair',a:'A_corgi',b:'A_chi'},/พักอยู่/,'a resting parent cannot be bred again (slot 1)');
await refuse(A,{t:'nur_pair',a:'A_chi',b:'A_pug'},/พักอยู่/,'...(slot 2)');
// --- early hatch refused
A.clear('toast');A.clear('nur_hatched');A.send({t:'nur_hatch',id:e1.id});ok(/ยังไม่ฟัก/.test(await A.toast()||'')&&!(await tryWait(A,'nur_hatched',300)),'hatching before the time is refused');
nu=await A.nur();ok(nu.eggs.length==1&&nu.eggs[0].id==e1.id,'...and the egg is still there');
// --- away and favourite dogs may breed (nursery works on the whole collection); they stay what they were
A.clear('nur_ok');const bf=A.me.coins;A.send({t:'nur_pair',a:'A_fav',b:'A_away'});const okp=await tryWait(A,'nur_ok',1500);await A.tick();ds=await A.dogs();
ok(!!okp&&A.me.coins==bf-80&&dOf('A_fav').fav===true&&dOf('A_away').away===true&&dOf('A_fav').rest>0,'favourite + away dogs can be bred (they keep their fav / away flag)');
note('server: nur_pair does not check away / fav / the dog cap; the window treats them as allowed');
// --- both nests used: a 3rd egg is refused, nothing is charged
A.expectEggs=2;await refuse(A,{t:'nur_pair',a:'A_husky',b:'A_shiba'},/รังไข่เต็ม/,'a full nursery refuses another egg');
// --- gem speed up: price formula + exactly once
nu=await A.nur();const eg=nu.eggs.find(e=>e.id==e1.id);const want=Math.min(24,Math.max(1,Math.ceil(eg.left/9e5)));
const g0=A.me.gems;A.clear('toast');A.send({t:'nur_fast',id:e1.id});await A.wait('nur');await A.tick();
ok(g0-A.me.gems==want&&want>=1,'speed-up price = 1 gem per 15 real minutes left ('+want+' gems for '+Math.round(eg.left/6e4)+' min)');
nu=await A.nur();ok(nu.eggs.find(e=>e.id==e1.id).left===0&&A.me.eggs==1,'the egg is ready now (me.eggs=1)');
const g1=A.me.gems;A.send({t:'nur_fast',id:e1.id});A.send({t:'nur_fast',id:e1.id});await A.tick();ok(A.me.gems==g1,'speeding up a ready egg costs nothing');
// --- hatch
const nd=(await A.dogs()).length,xp0=A.me.xp;A.clear('nur_hatched');A.send({t:'nur_hatch',id:e1.id});const ht=await A.wait('nur_hatched');await A.tick();
ok(ht.dog&&BRM[ht.dog.breed]&&!BRM[ht.dog.breed][7]&&ht.dog.tr.every(TRD.isTrait)&&!!ht.mixed==!!ht.dog.mix&&ht.r==BRM[ht.dog.breed][2]&&ht.pa.b=='corgi'&&ht.pb.b=='pug'&&ht.mut===!!ht.mut,'hatching gives a real dog ('+ht.dog.breed+(ht.dog.mix?' x '+ht.dog.mix:'')+', '+ht.r+') + parents');
ok(TRD.stageOf(ht.dog.born,Date.now(),1)==0&&ht.dog.bond===0,'the puppy is a Baby with bond 0');
ok((await A.dogs()).length==nd+1,'the puppy is in the dog list');
nu=await A.nur();ok(nu.eggs.length==1&&A.me.eggsAll==1,'the nest slot is free again (1 egg left)');
A.send({t:'nur_hatch',id:e1.id});ok(!(await tryWait(A,'nur_hatched',400)),'hatching the same egg twice does nothing');
// --- other player cannot touch my egg
{const B0=B.me.gems,aeg=(await A.nur()).eggs[0];B.clear('nur_hatched');B.send({t:'nur_hatch',id:aeg.id});B.send({t:'nur_fast',id:aeg.id});await B.tick();
 const after=(await A.nur()).eggs.find(e=>e.id==aeg.id);ok(B.me.gems==B0&&!B.last('nur_hatched')&&after&&after.left>=aeg.left-5000&&after.left<=aeg.left,"another player cannot hatch or speed up my egg (and is not charged)")}
// --- house visitor / me / dogs_all never see egg contents
{const V=await login(PN,'NurVis');V.send({t:'visit',id:'NurA'});await V.wait('house');V.send({t:'visit',id:'NurB'});await V.wait('house');await sleep(300);V.ws.close()}
// ---- bond: eggs hatch sooner
const K=await login(PN,'NurBond');await admin(K);
K.clear('nur');K.send({t:'nur_pair',a:'K_a',b:'K_b'});await K.wait('nur_ok');let kn=await K.wait('nur');const ka=kn.eggs[0];
K.send({t:'nur_pair',a:'K_c',b:'K_d'});await K.wait('nur_ok');kn=await K.nur();const kb=kn.eggs.find(e=>e.id!=ka.id);
const ratio=e=>e.total/(HATCH_H[e.rar]*36e5);
ok(near(ratio(ka),.75,.001)&&ka.cm==100,'bond 100 + 100: the egg hatches in 75% of the time ('+ratio(ka).toFixed(3)+')');
ok(near(ratio(kb),.875,.001)&&kb.cm==50,'bond 100 + 0 (average 50): 87.5% of the time ('+ratio(kb).toFixed(3)+')');
ok(near(e1.total/(HATCH_H[e1.rar]*36e5),1,.001),'bond 0: 100% of the time');
{const cal=nurCalc({breed:'corgi',mix:null,tr:[],bond:100},{breed:'pug',mix:null,tr:[],bond:100},EN(1));ok(near(cal.time[ka.rar],ka.total,2),'the window\'s hatch time equals the server\'s ('+Math.round(ka.total/6e4)+' min)')}
{K.send({t:'nur_fast',id:ka.id});await K.wait('nur');K.clear('nur_hatched');K.send({t:'nur_hatch',id:ka.id});const h=await K.wait('nur_hatched');ok(h.dog.bond==10,'a puppy of a bond-100 pair starts with bond 10 (cm/10)')}
{K.send({t:'nur_fast',id:kb.id});await K.wait('nur');K.clear('nur_hatched');K.send({t:'nur_hatch',id:kb.id});const h=await K.wait('nur_hatched');ok(h.dog.bond==5,'bond avg 50 -> puppy bond 5')}
// ---- slots grow with the house level
const H=await login(PN,'NurHouse');await admin(H);
let hn=await H.nur();ok(hn.max==2,'house level 1: 2 nests');
const lay=async(c,a,b)=>{c.clear('nur_ok');c.clear('toast');c.send({t:'nur_pair',a,b});const o=await tryWait(c,'nur_ok',1200);return{ok:!!o,toast:o?null:await c.toast(500)}};
let r1=await lay(H,'H_1','H_2'),r2=await lay(H,'H_3','H_4'),r3=await lay(H,'H_5','H_6');ok(r1.ok&&r2.ok&&!r3.ok&&/รังไข่เต็ม/.test(r3.toast||''),'2 nests: the 3rd egg is refused');
H.clear('me');H.send({t:'house_up'});await H.wait('house_info',2000).catch(()=>{});await H.tick();hn=await H.nur();ok(hn.max==3&&(H.me.hl|0)==1,'after one house upgrade: 3 nests (house level '+(H.me.hl+1)+')');
r3=await lay(H,'H_5','H_6');let r4=await lay(H,'H_7','H_8');ok(r3.ok&&!r4.ok,'...the 3rd egg works, a 4th is refused');
H.send({t:'house_up'});await H.tick();H.send({t:'house_up'});await H.tick();hn=await H.nur();ok(hn.max==5&&(H.me.hl|0)==3,'max house: 5 nests ('+hn.max+')');
r4=await lay(H,'H_7','H_8');const r5=await lay(H,'H_9','H_10');hn=await H.nur();ok(r4.ok&&r5.ok&&hn.eggs.length==5,'5 eggs fit at the top house level');
// ---- gem cap + not enough gems (seeded eggs far in the future)
const Cp=await login(PN,'NurCap');cn=await Cp.nur();ok(cn.eggs.length==3&&Cp.me.gems==36,'(setup) seeded account: 3 eggs, 36 gems');
var cn;
Cp.send({t:'nur_fast',id:'CAP_far'});await Cp.wait('nur');await Cp.tick();ok(Cp.me.gems==12,'an egg 30 days away costs at most 24 gems (the cap): 36 -> '+Cp.me.gems);
Cp.send({t:'nur_fast',id:'CAP_3h'});await Cp.wait('nur');await Cp.tick();ok(Cp.me.gems==0,'an egg with 3 h left costs 12 gems (1 per 15 min): 12 -> '+Cp.me.gems);
Cp.clear('toast');Cp.send({t:'nur_fast',id:'CAP_3h2'});ok(/Gems ไม่พอ/.test(await Cp.toast()||''),'not enough gems: refused with a message');
cn=await Cp.nur();ok(cn.eggs.find(e=>e.id=='CAP_3h2').left>10000&&Cp.me.gems==0,'...and the egg was not touched');
Cp.clear('nur_hatched');Cp.send({t:'nur_hatch',id:'CAP_far'});const ch=await Cp.wait('nur_hatched');ok(ch.dog.breed=='corgi'&&ch.dog.tr.join()=='heart'&&ch.dog.bond==4&&!ch.mixed&&!ch.mut&&ch.r=='C','a seeded egg hatches into exactly what was inside (corgi + heart, bond 4)');
// ---- poor player
const Po=await login(PN,'NurPoor');Po.clear('toast');Po.send({t:'nur_pair',a:'P_h',b:'P_s'});ok(/Coins ไม่พอ.*150/.test(await Po.toast()||''),'Rare pair costs 150: not enough coins is refused and tells the price');
await Po.tick();ok(Po.me.coins==100&&(await Po.nur()).eggs.length==0,'...nothing was charged and no egg was made');
Po.send({t:'nur_pair',a:'P_c',b:'P_p'});await Po.wait('nur_ok');await Po.tick();ok(Po.me.coins==20,'a Common pair (80) is still affordable: 100 -> 20');
Po.clear('toast');Po.send({t:'nur_fast',id:(await Po.nur()).eggs[0].id});ok(/Gems ไม่พอ/.test(await Po.toast()||'')&&Po.me.gems==0,'no gems: speed-up refused');

// ============================================================ 4. F: fast server
const FA=await login(PF,'FastA');await admin(FA);
// ---- full flow: pair -> wait -> hatch, rest released
{FA.clear('nur_ok');FA.send({t:'nur_pair',a:'F_c1',b:'F_c2'});await FA.wait('nur_ok');let n=await FA.wait('nur');const e=n.eggs[0];
 ok(near(e.total,HATCH_H[e.rar]*36e5/36000*.95,3),'(fast server) egg time = real time / 36000 ('+Math.round(e.total)+' ms, bond 20)');
 ok(FA.welcome.v7.hk==36000,'welcome.v7.hk carries the speed factor (36000) for the window\'s countdown');
 const t0=Date.now();let left=1;while(left>0&&Date.now()-t0<4000){await sleep(60);left=(await FA.nur()).eggs[0].left}
 ok(left===0,'the countdown ends: egg ready, me.eggs=1 ('+(Date.now()-t0)+' ms)');
 FA.clear('nur_hatched');FA.send({t:'nur_hatch',id:e.id});const h=await FA.wait('nur_hatched');ok(h.dog&&h.dog.bond==Math.round(e.cm/10)&&BRM[h.dog.breed],'pair -> wait -> hatch works end to end ('+h.dog.breed+')');
 const dd=await FA.dogs();ok(dd.find(d=>d.id=='F_c1').rest>0,'parents are resting right after laying (rest ms left reported in dogs_all)');
 FA.clear('toast');FA.send({t:'nur_pair',a:'F_c1',b:'F_c2'});ok(/พักอยู่/.test(await FA.toast()||''),'...so another egg is refused while they rest');
 await sleep(1500);const dd2=await FA.dogs();ok(dd2.find(d=>d.id=='F_c1').rest===0&&dd2.find(d=>d.id=='F_c2').rest===0,'after the rest time (12 h / 36000 = 1.2 s) the parents are free');
 FA.clear('nur_ok');FA.send({t:'nur_pair',a:'F_c1',b:'F_c2'});ok(!!(await tryWait(FA,'nur_ok',1500)),'...and can lay again');
 const eg2=(await FA.nur()).eggs[0];await sleep(700);FA.send({t:'nur_hatch',id:eg2.id});await FA.wait('nur_hatched',2000)}
// ---- fee by parent rarity (all four genes count)
const CASESF=[['F_C1','F_C2','C'],['F_R1','F_R2','R'],['F_E1','F_E2','E'],['F_L1','F_L2','L'],['F_M1','F_M2','M'],['F_X1','F_X2','R'],['F_Y1','F_Y2','M'],['F_Z1','F_Z2','E']];
for(const [a,b,R] of CASESF){await FA.tick();const c0=FA.me.coins;FA.clear('nur_ok');FA.clear('toast');FA.send({t:'nur_pair',a,b});const o=await tryWait(FA,'nur_ok',1500);await FA.tick();const paid=c0-FA.me.coins;
  const dd=await FA.dogs(),da=dd.find(d=>d.id==a),db=dd.find(d=>d.id==b),cal=nurCalc(da,db,EN(36000));
  ok(!!o&&paid==COST[R]&&cal.cost==paid&&cal.costR==R,'fee for '+da.breed+(da.mix?'+'+da.mix:'')+' x '+db.breed+': '+paid+' coins = '+R+' (the window said '+cal.cost+')');
  const e=(await FA.nur()).eggs.find(x=>x.pa.n==da.name&&x.pb.n==db.name)||(await FA.nur()).eggs[0];
  ok(RO[e.rar]<=RO[R]+1&&near(e.total,HATCH_H[e.rar]*36e5/36000*(1-.25*(((da.bond|0)+(db.bond|0))/2)/100),3),'  its egg is '+e.rar+' and hatches in '+Math.round(e.total)+' ms');
  const t0=Date.now();while(Date.now()-t0<3000){const n=await FA.nur();const x=n.eggs.find(y=>y.id==e.id);if(!x||x.left===0)break;await sleep(80)}
  FA.clear('nur_hatched');FA.send({t:'nur_hatch',id:e.id});await tryWait(FA,'nur_hatched',1500)}
// ---- traits through the real server (heart/star parents, bond 90)
{await FA.tick();const eggsBefore=(await FA.nur()).eggs.length;FA.send({t:'nur_pair',a:'F_T1',b:'F_T2'});await FA.wait('nur_ok');const e=(await FA.nur()).eggs.at(-1);ok(e.cm==90&&e.total<HATCH_H[e.rar]*36e5/36000*.78+3,'bond 90 pair: egg time is 22.5% shorter, cm=90');
 const t0=Date.now();while(Date.now()-t0<3000){const x=(await FA.nur()).eggs.find(y=>y.id==e.id);if(x.left===0)break;await sleep(80)}FA.send({t:'nur_hatch',id:e.id});const h=await FA.wait('nur_hatched',2000);ok(h.dog.tr.length<=2&&h.dog.tr.every(TRD.isTrait)&&h.dog.bond==9,'the kid has valid traits and bond 9')}
// ---- 100-dog limit with eggs waiting
const Fu=await login(PF,'FastFull');await Fu.dogs();let fd=await Fu.dogs();ok(fd.length==100,'(setup) 100 dogs');
let fn=await Fu.nur();ok(fn.eggs.length==2&&fn.eggs.every(e=>e.left===0)&&Fu.me.eggs==2,'two eggs are waiting and ready (me.eggs=2)');
Fu.clear('toast');Fu.clear('nur_hatched');Fu.send({t:'nur_hatch',id:'FU_e1'});ok(/ที่เก็บหมาเต็ม/.test(await Fu.toast()||'')&&!(await tryWait(Fu,'nur_hatched',300)),'with 100 dogs the egg cannot hatch (message tells why)');
fn=await Fu.nur();fd=await Fu.dogs();ok(fn.eggs.length==2&&fd.length==100,'...the egg stays in the nest, still 100 dogs');
Fu.send({t:'nur_pair',a:'FU_p1',b:'FU_p2'});const lp=await tryWait(Fu,'nur_ok',1200);note('server: nur_pair at 100 dogs is allowed (egg laid: '+!!lp+'); only hatching checks the limit');
{Fu.clear('pet_sold');Fu.send({t:'pet_sell',id:'FU_f0'});await Fu.wait('pet_sold');fd=await Fu.dogs();ok(fd.length==99,'selling one dog makes room (99)');
 Fu.clear('nur_hatched');Fu.send({t:'nur_hatch',id:'FU_e1'});const h=await Fu.wait('nur_hatched');fd=await Fu.dogs();ok(h.dog.breed=='pug'&&fd.length==100,'now the waiting egg hatches (the seeded egg held a pug) -> 100 dogs');
 Fu.clear('toast');Fu.send({t:'nur_hatch',id:'FU_e2'});ok(/ที่เก็บหมาเต็ม/.test(await Fu.toast()||'')&&(await Fu.nur()).eggs.some(e=>e.id=='FU_e2'),'the second egg waits again')}
{Fu.clear('capsule');Fu.send({t:'capsule',n:1});const cp=await tryWait(Fu,'capsule',1500);fd=await Fu.dogs();note('server: a capsule pull at 100 dogs gives a dog anyway ('+(cp?'yes':'no')+', dogs='+fd.length+'); the 100 limit is only enforced for hatching / shop / market')}
// ---- double click / spam safety
const Sp=await login(PF,'FastSpam');await Sp.dogs();
{await Sp.tick();const c0=Sp.me.coins;Sp.clear('nur_ok');for(let i=0;i<120;i++)Sp.send({t:'nur_pair',a:'S_a',b:'S_b'});await sleep(500);await Sp.tick();const n=await Sp.nur();
 ok(Sp.count('nur_ok')==1&&n.eggs.length==2&&c0-Sp.me.coins==80,'120 pair clicks in a burst: ONE egg, ONE fee ('+(c0-Sp.me.coins)+' coins)');
 const mixedBurst=[];for(let i=0;i<60;i++){mixedBurst.push({t:'nur_pair',a:'S_c',b:'S_d'},{t:'nur_pair',a:'S_d',b:'S_c'})}for(const m of mixedBurst)Sp.send(m);await sleep(400);await Sp.tick();
 const n2=await Sp.nur();ok(n2.eggs.length==3&&(c0-Sp.me.coins)==160,'120 more clicks with the dogs in swapped order: one more egg, one more fee');
 const g0=Sp.me.gems;Sp.clear('nur');for(let i=0;i<50;i++)Sp.send({t:'nur_fast',id:'SP_far'});await sleep(400);await Sp.tick();ok(g0-Sp.me.gems==24,'50 speed-up clicks on one far-away egg: charged once, 24 gems ('+(g0-Sp.me.gems)+')');
 const ready=(await Sp.nur()).eggs.filter(e=>e.left===0).map(e=>e.id);const nd0=(await Sp.dogs()).length;Sp.clear('nur_hatched');
 for(let i=0;i<80;i++)Sp.send({t:'nur_hatch',id:'SP_far'});await sleep(500);const nd1=(await Sp.dogs()).length;
 ok(Sp.count('nur_hatched')==1&&nd1==nd0+1,'80 hatch clicks: exactly ONE puppy ('+(nd1-nd0)+')');
 ok(ready.includes('SP_far'),'(the seeded egg was ready after the speed-up)')}
// ---- a hatch-only account: egg that was ready at start (offline hatching)
{const Hc=await login(PF,'FastHatchOnly');const n=await Hc.nur();ok(n.eggs.length==1&&n.eggs[0].left===0&&Hc.me.eggs==1&&Hc.me.eggsAll==1,'an egg that finished while offline is ready on login');
 Hc.send({t:'nur_hatch',id:'HC_e'});const h=await Hc.wait('nur_hatched');ok(h.dog&&h.pa.n=='Mum','...and hatches (parent names kept)')}
// ============================================================ hostile inputs
{const X=await login(PF,'FastHostile');await X.dogs();await X.tick();const snap=async()=>{const n=await X.nur();const ds=await X.dogs();return JSON.stringify({c:X.me.coins,g:X.me.gems,e:n.eggs.map(e=>[e.id,e.rar,e.total]),d:ds.map(d=>[d.id,d.rest>0,d.bond,d.fav,d.away]).sort(),n:ds.length})};
 const before=await snap();
 const big='x'.repeat(3500),deep=JSON.parse('['.repeat(200)+']'.repeat(200));
 const BAD=[undefined,null,true,false,0,1,-1,1e308,-1e308,'',' ','__proto__','constructor','toString','hasOwnProperty','0','NaN','Infinity','../../etc/passwd','<script>',big,{},{a:1},{__proto__:{id:1}},[],[[]],[{}],deep,{toString:1},'HO_egg\u0000','ho_egg','HO_EGG',' HO_egg'];
 let sent=0;const S2=m=>{X.send(m);sent++};
 for(const v of BAD){S2({t:'nur_pair',a:v,b:v});S2({t:'nur_pair',a:v,b:'X_b'});S2({t:'nur_pair',a:'X_a',b:v});S2({t:'nur_hatch',id:v});S2({t:'nur_fast',id:v});S2({t:'nur_get',id:v,x:v})}
 for(const v of BAD){const o={t:'nur_pair'};o.a=v;if(v!==undefined)S2(o)}
 X.raw('{"t":"nur_pair","__proto__":{"a":"X_a","b":"X_b"},"a":"X_a"}');X.raw('{"t":"nur_hatch","id":"HO_egg","__proto__":{"polluted":1}}');X.raw('{"t":"nur_fast"}');X.raw('{"t":"nur_hatch"}');X.raw('{"t":"nur_pair"}');X.raw('{"t":"nur_get","t":"nur_get"}');
 S2({t:'nur_pair',a:'X_a',b:'X_baby'});S2({t:'nur_pair',a:'X_baby',b:'X_a'});S2({t:'nur_hatch',id:'HO_egg'});S2({t:'nur_hatch',id:'HO_egg',force:true,at:0});
 await sleep(1500);const after=await snap();
 ok(before==after,'~'+sent+' hostile nur_pair / nur_hatch / nur_fast / nur_get messages (wrong types, huge numbers, __proto__, nested, missing ids, a 3.5 KB id): coins, gems, eggs and dogs all unchanged');
 const alive=await X.nur();ok(alive.eggs.length==1&&X.ws.readyState==1,'the connection and the server are still fine');
 // spam a valid pair on a baby + same-dog flood: still nothing
 for(let i=0;i<300;i++){X.send({t:'nur_pair',a:'X_a',b:'X_a'});X.send({t:'nur_pair',a:'X_baby',b:'X_b'})}await sleep(800);ok((await snap())==before,'300 + 300 refused pair requests change nothing');
 // after all that a normal pair still works once
 X.send({t:'nur_pair',a:'X_a',b:'X_b'});ok(!!(await tryWait(X,'nur_ok',1500)),'...and a normal pair still works (the account was not locked or corrupted)')}
// ---- default rate limit on the real-time server (20 msg/s): a flood is dropped / the connection is closed, the nursery stays consistent
{const bef=A.me.coins,n0=(await A.nur()).eggs.length;A.clear('nur_ok');for(let i=0;i<400;i++)A.send({t:'nur_pair',a:'A_chi',b:'A_pom'});await sleep(1500);const oks=A.count('nur_ok');
 note('rate limit: '+oks+' of 400 flooded pair messages produced an egg; connection '+(A.ws.readyState==1?'kept':'closed by the server'));
 const A2=await login(PN,'NurA');const n1=(await A2.nur()).eggs.length;await A2.tick();ok(oks<=1&&n1==n0+oks&&bef-A2.me.coins==80*oks,'400 flooded pair clicks: at most one egg, one fee ('+oks+' egg, '+(bef-A2.me.coins)+' coins)');
 // 8 KB limit: an oversized message closes only that connection
 const J=await login(PN,'NurVis');J.send({t:'nur_pair',a:'x'.repeat(9000),b:'y'});await sleep(500);ok(J.ws.readyState!=1,'an oversized message (>8 KB) makes the server drop that connection');
 ok((await A2.nur()).eggs.length==n1,'...and everybody else is unaffected')}
// ============================================================ nothing secret on the wire
{const all=ALL.join('\n');
 ok(!/"kid"\s*:/.test(all),'no message to any client ever contained an egg\'s hidden "kid" (breed / traits inside the egg)');
 ok(!/"nest"\s*:/.test(all),'the raw nest array is never sent either');
 const nurMsgs=ALL.filter(s=>s.startsWith('{"t":"nur","')).map(s=>JSON.parse(s));ok(nurMsgs.length>100&&nurMsgs.every(m=>m.eggs.every(e=>Object.keys(e).sort().join()=='cm,id,left,pa,pb,rar,total')),'all '+nurMsgs.length+' "nur" pushes carry only id / rar / left / total / pa / pb / cm per egg');
 const dogMsgs=ALL.filter(s=>s.startsWith('{"t":"dogs_all"')||s.startsWith('{"t":"house"'));ok(dogMsgs.length>10&&dogMsgs.every(s=>!/"kid"|"eggs":\[\{/.test(s)),'dogs_all / house pushes carry no egg data')}
}catch(e){ok(false,'EXCEPTION '+(e&&e.stack||e))}
await done();
})();
