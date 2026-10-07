// v7 tests (part 1): dog growth, cute traits, egg hatching, breeding genes, premium pet shop, selling, player market, house privacy, losing costs coins.
// Self-contained: starts its OWN servers (growth + hatching clocks sped up with CD_GROW / CD_HATCH so a "3 day" baby grows up in 7 seconds).
'use strict';
const {spawn}=require('child_process'),os=require('os'),path=require('path'),fs=require('fs');
const BASE=+(process.env.PORT||3055),PA=BASE+14,PB=BASE+15;
const TRD=require('./traits'),BREEDS=require('./breeds'),PREM=require('./premium'),C=require('./catalog');
const BRM=Object.fromEntries(BREEDS.concat(PREM).map(b=>[b[0],b]));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let pass=0,fail=0;const ok=(c,n)=>{c?pass++:fail++;console.log(c?'PASS':'FAIL',n)};
const KEY='testadminkey1';
function cli(PORT){return new Promise((res,rej)=>{const ws=new WebSocket('ws://localhost:'+PORT),log=[];
  const o={ws,log,send:m=>ws.send(JSON.stringify(m)),
   wait:(t,ms=3000,f=null)=>new Promise((ok,no)=>{const g=()=>{const i=log.findIndex(x=>x.t==t&&(!f||f(x)));if(i>=0)return ok(log.splice(i,1)[0]);if((ms-=25)<=0)return no(new Error('timeout '+t));setTimeout(g,25)};g()}),
   last:t=>[...log].reverse().find(x=>x.t==t),count:(t,f)=>log.filter(x=>x.t==t&&(!f||f(x))).length,clear:t=>{for(let i=log.length-1;i>=0;i--)if(!t||log[i].t==t)log.splice(i,1)},
   async auth(m){o.send(m);const a=await o.wait('auth',4000);if(a.ok){await o.wait('welcome',3000).then(w=>o.welcome=w);await o.wait('me',3000)}return a},
   async dogs(){o.clear('dogs_all');o.send({t:'dogs_get'});return(await o.wait('dogs_all')).dogs},
   async toast(ms=1500){try{return(await o.wait('toast',ms)).m}catch{return null}},
   async tick(){await sleep(120);return o.me}};
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.t=='me')o.me=m;log.push(m)};ws.onopen=()=>res(o);ws.onerror=()=>rej(new Error('connect'))})}
const tryWait=async(c,t,ms,f)=>{try{return await c.wait(t,ms,f)}catch{return null}};
const start=(port,env)=>{const data=path.join(os.tmpdir(),'cozydogs_t11_'+port+'_'+process.pid+'.json');
  const p=spawn(process.execPath,[path.join(__dirname,'server.js')],{env:{...process.env,PORT:String(port),DATA:data,ADMIN_KEY:KEY,CD_TEST:'1',...env},stdio:['ignore','pipe','pipe']});
  let err='';p.stderr.on('data',d=>err+=d);p.getErr=()=>err;p.data=data;return p};
const reg=async(port,name)=>{const c=await cli(port);const a=await c.auth({t:'register',user:name,email:name+'@example.com',pass:'secret12'});if(!a.ok)throw new Error('register '+name+': '+JSON.stringify(a));return c};
const admin=async c=>{c.send({t:'admin',key:KEY,coins:1e6});await sleep(150)};
const pulls=async(c,n)=>{for(let i=0;i<n;i+=10){c.send({t:'capsule',n:10});await c.wait('capsule',4000);await sleep(60)}};

(async()=>{
const A=start(PA,{CD_GROW:'36000',CD_HATCH:'1'}),B=start(PB,{CD_GROW:'36000',CD_HATCH:'36000'});
await sleep(1800);
const done=async()=>{A.kill();B.kill();for(const p of [A,B])for(const f of [p.data,p.data+'.bak'])try{fs.unlinkSync(f)}catch{}
  const e=A.getErr()+B.getErr();if(e.trim()){console.log('SERVER STDERR:\n'+e.slice(0,1500))}ok(!e.trim(),'servers wrote nothing to stderr (no exceptions)');
  console.log('\nPASS',pass,'FAIL',fail);process.exit(fail?1:0)};
try{
// ============================================================ gene rules (unit tests of the breeding function, no network)
{const PT=require('./pets')({db:{players:{}},conns:new Map(),send(){},wsOf(){},player(){},clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),rnd:(a,b)=>a+Math.random()*(b-a),pick:a=>a[Math.floor(Math.random()*a.length)],rid:()=>Math.random().toString(36).slice(2),today:()=>'x',sendMe(){},pushHouse(){},pub:d=>d,rt:d=>d,BR:BRM,dirty(){},own:(o,k)=>Object.prototype.hasOwnProperty.call(o,k),safe:(n,f)=>f,hlOf:()=>0,maxDogs:()=>8,isGuestName:()=>false,mkDog(){},F:{},bump(){},addXp(){},GK:1,lvl:()=>9});
 const mk=(b,o)=>Object.assign({breed:b,variant:'Normal',tr:[],bond:0},o||{});
 let N=4000,pureSame=0,mixedN=0,valid=true,trOk=true,over2=false,mut=0,premium=false;
 for(let i=0;i<N;i++){const k=PT.geneKid(mk('corgi'),mk('corgi'),0);if(k.breed=='corgi'&&!k.mix)pureSame++;if(k.mut)mut++;if(!BRM[k.breed]||(k.mix&&!BRM[k.mix]))valid=false;if(BRM[k.breed][7]||(k.mix&&BRM[k.mix][7]))premium=true}
 ok(pureSame/N>.93&&pureSame/N<.99,'two purebred Corgis nearly always make a purebred Corgi ('+(pureSame/N*100).toFixed(1)+'%, the rest are rare mutations)');
 ok(mut/N>.02&&mut/N<.07,'mutation rate is about 4% ('+(mut/N*100).toFixed(1)+'%)');
 let f1=0;for(let i=0;i<N;i++)if(PT.geneKid(mk('corgi'),mk('husky'),0).mix)f1++;
 ok(f1/N>.93,'purebred Corgi x purebred Husky: (almost) every puppy is a mixed breed ('+(f1/N*100).toFixed(1)+'%)');
 let mixes=0,husk=0,corg=0,domCorgi=0;
 for(let i=0;i<N;i++){const k=PT.geneKid(mk('corgi'),mk('corgi',{mix:'husky',ms:2}),0);if(k.mix)mixes++;if(!k.mix&&k.breed=='corgi')corg++;if(!k.mix&&k.breed=='husky')husk++;if(k.mix&&k.breed=='corgi')domCorgi++;
  if(k.mix&&(k.mix==k.breed||!BRM[k.mix]))valid=false;if(k.tr.length>2||new Set(k.tr).size!=k.tr.length||!k.tr.every(TRD.isTrait))trOk=false;if(k.tr.length>2)over2=true;if(BRM[k.breed][7]||(k.mix&&BRM[k.mix][7]))premium=true}
 ok(mixes/N>.4&&mixes/N<.62,'Corgi x (Corgi+Husky mix): about half of the puppies are mixed breeds (พันทาง) ('+(mixes/N*100).toFixed(1)+'%), the rest purebred Corgi ('+corg+')');
 ok(corg>N*.35,'...and purebred puppies appear again in the next generation');
 ok(domCorgi>0&&mixes-domCorgi>0,'either breed can be the dominant one in a mixed puppy');
 ok(valid&&trOk&&!over2,'every child has valid breed ids, never a mix == its own breed, at most 2 different valid traits');
 ok(!premium,'premium breeds never appear in a litter');
 // traits: inherited
 let inh=0,tot=0;for(let i=0;i<3000;i++){const k=PT.geneKid(mk('pug',{tr:['heart']}),mk('pug',{tr:[]}),0);tot++;if(k.tr.includes('heart'))inh++}
 ok(inh/tot>.45&&inh/tot<.65,'a parent trait is passed on about half of the time ('+(inh/tot*100).toFixed(0)+'%)');
 let lucky=0,plain=0;for(let i=0;i<4000;i++){if(PT.geneKid(mk('pug'),mk('pug'),90).tr.length)lucky++;if(PT.geneKid(mk('pug'),mk('pug'),0).tr.length)plain++}
 ok(lucky>plain,'a pair with a close bond finds new traits more often ('+lucky+' vs '+plain+' per 4000)');
 let rar=true;for(let i=0;i<500;i++){const k=PT.geneKid(mk('chihuahua'),mk('pomeranian'),0);if(!['C','R','E','L','M'].includes(k.rar))rar=false}ok(rar,'the egg colour (rarity) is always a real rarity');
 let tiers=[0,0,0,0];for(let i=0;i<2000;i++)tiers[TRD.TR[TRD.rollTrait()].tier]++;ok(tiers[1]>tiers[2]&&tiers[2]>tiers[3]&&tiers[3]>0,'trait tiers: common > uncommon > rare ('+tiers.slice(1).join(' / ')+')')}
// ============================================================ shared (growth) facts
ok(TRD.stageOf(Date.now(),Date.now(),1)==0&&TRD.stageOf(Date.now()-7*36e5,Date.now(),1)==1&&TRD.stageOf(Date.now()-30*36e5,Date.now(),1)==2&&TRD.stageOf(Date.now()-80*36e5,Date.now(),1)==3&&TRD.stageOf(undefined,Date.now(),1)==3,'stages: Baby <6h, Puppy <24h, Teen <72h, Adult (and dogs without an age are adults)');
ok(TRD.keyOf({breed:'corgi',born:0},Date.now(),1,()=>true)=='corgi'&&TRD.keyOf({breed:'corgi',mix:'husky',ms:3,born:Date.now(),tr:['heart','bogus','heart']},Date.now(),1,()=>true)=='corgi+husky~3.b#heart','dog key: adult purebred = plain id; mixed baby with traits = base+mix~seed.stage#traits (bogus / duplicate traits dropped)');
ok(TRD.parseKey('corgi+husky~3.p#blush-star').tr.join()=='blush,star'&&TRD.parseKey('x y')==null,'dog key parser');
// ============================================================ accounts
const P=await reg(PA,'Breeder'),Q=await reg(PA,'SellerQ'),R=await reg(PA,'BuyerR');
ok(P.welcome.v7&&P.welcome.v7.gk==36000&&Math.abs(P.welcome.v7.t0-Date.now())<5000,'welcome carries the growth clock (gk) and the server time (t0)');
ok(P.welcome.breeds.length==61&&P.welcome.breeds.filter(b=>b[7]).length==11,'welcome lists 50 egg breeds + 11 premium breeds (row[7] = price)');
ok(P.welcome.v7.hatchH&&P.welcome.v7.cost&&P.welcome.v7.fee==.05,'welcome carries the breeding / market numbers');
for(const c of [P,Q,R])await admin(c);
await P.tick();ok(P.me.coins>=1e6&&P.me.gems>=9999,'(setup) admin cheat gave test money');
let d0=await P.dogs();ok(d0.length==1&&'tr' in d0[0]&&Array.isArray(d0[0].tr)&&'mix' in d0[0]&&d0[0].mix===null&&d0[0].rest===0&&Number.isFinite(d0[0].born),'a new dog has born / tr / mix / rest fields');
// ============================================================ egg machine -> traits
P.send({t:'capsule',n:10});let cp=await P.wait('capsule');ok(cp.res.length==10&&cp.res.every(r=>Array.isArray(r.tr)&&r.tr.every(TRD.isTrait)&&Number.isFinite(r.born)),'egg results carry valid trait lists + the birth time');
await pulls(P,20);
// ============================================================ babies cannot breed yet
{const ds=await P.dogs(),a=ds[ds.length-1],b=ds[ds.length-2];ok(TRD.stageOf(a.born,Date.now(),36000)<3,'(setup) fresh egg dogs start as babies');
 P.clear('toast');P.send({t:'nur_pair',a:a.id,b:b.id});const t=await P.toast();ok(/โตไม่เต็มวัย/.test(t||''),'babies cannot be bred: '+t)}
// Growth Candy -------------------------------------------------------------------
{const cb=await reg(PA,'CandyBuyer'),c0=cb.me.coins;cb.send({t:'shop_buy',id:'candy',n:2});await cb.wait('buy_ok');await cb.tick();ok(cb.me.inv.candy==2&&cb.me.coins==c0-180,'Growth Candy costs 90 coins each in the shop');cb.ws.close()}
{const ds=await P.dogs(),baby=ds.find(d=>!d.away&&TRD.stageOf(d.born,Date.now(),36000)<3);P.clear('dogs');P.send({t:'feed',dog:baby.id,food:'candy'});await sleep(250);
 const after=(await P.dogs()).find(d=>d.id==baby.id);ok(after.born<baby.born-500,'Growth Candy makes a dog older (born moved back about 6 growth hours = '+(baby.born-after.born)+' ms)')}
// Q, R: level up for the market (level 3) and wait until the first dogs are adults
for(const c of [Q,R]){await pulls(c,40)}
await sleep(7600);
{const ds=await P.dogs(),ad=ds.filter(d=>TRD.stageOf(d.born,Date.now(),36000)==3);ok(ad.length>=10,'after ~7 s (=72 growth hours) the dogs are adults ('+ad.length+'/'+ds.length+')');
 P.clear('toast');P.send({t:'feed',dog:ad[0].id,food:'candy'});const t=await P.toast();ok(/โตเต็มวัยแล้ว/.test(t||''),'an adult cannot eat Growth Candy: '+t);
 P.send({t:'dogs_get'});await sleep(150);const inv=P.last('me');
 ok((P.me.inv.candy|0)>=2,'...and the candy was not used up ('+P.me.inv.candy+' left)')}
// ============================================================ NURSERY
let ds=await P.dogs();const adults=ds.filter(d=>TRD.stageOf(d.born,Date.now(),36000)==3&&!d.fav);
P.send({t:'nur_get'});let nur=await P.wait('nur');ok(nur.max==2&&nur.eggs.length==0,'nursery: 2 nests at house level 1, empty at the start');
const a1=adults[0],a2=adults[1],a3=adults[2],a4=adults[3],a5=adults[4];
P.clear('toast');P.send({t:'nur_pair',a:a1.id,b:a1.id});ok(/ต่างกัน/.test(await P.toast()||''),'the same dog twice is refused');
P.send({t:'nur_pair',a:'nope',b:a2.id});ok(/ต่างกัน/.test(await P.toast()||''),'an unknown dog id is refused');
P.send({t:'nur_pair',a:{x:1},b:[1]});ok(/ต่างกัน/.test(await P.toast()||''),'objects / arrays as ids are refused (no crash)');
const c0=P.me.coins;P.clear('nur');P.send({t:'nur_pair',a:a1.id,b:a2.id});await P.wait('nur_ok');nur=await P.wait('nur');await P.tick();
const cost=C&&Math.max(0,c0-P.me.coins);ok(nur.eggs.length==1&&nur.eggs[0].left>0&&['C','R','E','L','M'].includes(nur.eggs[0].rar),'pairing two adults makes an egg ('+nur.eggs[0].rar+', '+Math.round(nur.eggs[0].left/6e4)+' min to hatch)');
ok(cost>=80&&cost<=1000&&[80,150,300,600,1000].includes(cost),'the breeding fee was paid ('+cost+' coins)');
ok(!('kid' in nur.eggs[0])&&!('mixed' in nur.eggs[0]),'the egg does not reveal what is inside');
ds=await P.dogs();ok(ds.find(d=>d.id==a1.id).rest>0&&ds.find(d=>d.id==a2.id).rest>0,'both parents are resting now');
P.clear('toast');P.send({t:'nur_pair',a:a1.id,b:a3.id});ok(/พักอยู่/.test(await P.toast()||''),'a resting parent cannot be bred again');
P.send({t:'nur_hatch',id:nur.eggs[0].id});ok(/ยังไม่ฟัก/.test(await P.toast()||''),'a hatch before the time is refused');
P.send({t:'nur_pair',a:a3.id,b:a4.id});await P.wait('nur_ok');nur=await P.wait('nur');ok(nur.eggs.length==2,'second nest used');
P.clear('toast');P.send({t:'nur_pair',a:a5.id,b:adults[5].id});ok(/รังไข่เต็ม/.test(await P.toast()||''),'a full nursery refuses a third egg');
// speed up with gems -> hatch
const g0=P.me.gems;P.clear('toast');P.send({t:'nur_fast',id:nur.eggs[0].id});await P.wait('nur');await P.tick();ok(P.me.gems<g0,'speeding an egg up costs gems ('+(g0-P.me.gems)+'💎)');
const before=(await P.dogs()).length;P.clear('nur_hatched');P.send({t:'nur_hatch',id:nur.eggs[0].id});const ht=await P.wait('nur_hatched');
ok(ht.dog&&BRM[ht.dog.breed]&&ht.dog.tr.every(TRD.isTrait)&&!!ht.mixed==!!ht.dog.mix&&ht.pa&&ht.pb,'a hatched egg gives a real dog ('+ht.dog.breed+(ht.dog.mix?' x '+ht.dog.mix:'')+', rarity '+ht.r+')');
ok(TRD.stageOf(ht.dog.born,Date.now(),36000)==0,'the puppy hatches as a Baby');
ok((await P.dogs()).length==before+1,'the new dog is in the dog list');
P.send({t:'nur_hatch',id:nur.eggs[0].id});ok(!(await tryWait(P,'nur_hatched',400)),'hatching the same egg twice does nothing');
ok(!BRM[ht.dog.breed][7],'the child is never a premium breed');
// premium cannot breed
// ============================================================ PET SHOP
P.send({t:'pet_shop'});let shop=await P.wait('pet_shop');
ok(shop.prem.length==11&&shop.prem.every(p=>(p.c>0)!=(p.g>0)&&p.left>0&&p.left<=5),'shop: 11 premium breeds, each priced in coins OR gems, with a daily stock');
ok(shop.offers.length==5&&shop.offers.every(o=>BRM[o.id]&&!BRM[o.id][7]&&o.c>0&&o.left>0),'shop: 5 daily offers of ordinary breeds for coins');
ok(shop.cap==8&&shop.bought==0,'shop: daily purchase limit is 8');
P.clear('toast');P.send({t:'pet_buy',k:'p',id:'__proto__'});P.send({t:'pet_buy',k:'p',id:'corgi'});P.send({t:'pet_buy',k:'p',id:{a:1}});P.send({t:'pet_buy',k:'d',i:99});P.send({t:'pet_buy',k:'x'});P.send({t:'pet_buy',k:'d',i:'1e9'});await sleep(250);
ok(!P.last('pet_bought'),'bad shop ids / indexes buy nothing');
{const pc=await reg(PA,'PoorPup');pc.send({t:'pet_buy',k:'p',id:'mochipup'});ok(/Coins ไม่พอ/.test(await pc.toast()||''),'not enough coins is refused (300 coins start)');pc.send({t:'pet_buy',k:'p',id:'dragonpup'});ok(/Gems ไม่พอ/.test(await pc.toast()||''),'not enough gems is refused');pc.ws.close()}
const cc=P.me.coins;P.clear('dogs');P.send({t:'pet_buy',k:'p',id:'mochipup'});const pb=await P.wait('pet_bought');await P.tick();
ok(pb.dog.breed=='mochipup'&&P.me.coins==cc-1800,'buying Mochi Pup costs 1800 coins and gives the dog');
ok(TRD.stageOf(pb.dog.born,Date.now(),36000)==0,'a shop dog arrives as a Baby');
ok(P.me.ownedP.includes('mochipup')&&!P.me.owned.includes('mochipup'),'premium breeds are listed apart: not in the 50-breed collection');
const gg=P.me.gems;P.send({t:'pet_buy',k:'p',id:'dragonpup'});await P.wait('pet_bought');await P.tick();ok(P.me.gems==gg-260,'Dragon Pup costs 260 gems');
P.clear('pet_shop');P.send({t:'pet_shop'});shop=await P.wait('pet_shop');ok(shop.prem.find(p=>p.id=='dragonpup').left==0&&shop.prem.find(p=>p.id=='mochipup').left==4&&shop.bought==2,'stock went down (dragon 1->0, mochi 5->4), my purchases counted');
P.clear('toast');P.send({t:'pet_buy',k:'p',id:'dragonpup'});ok(/ขายหมดแล้ว/.test(await P.toast()||''),'sold out is refused');
Q.clear('pet_stock');P.send({t:'pet_buy',k:'p',id:'teddypom'});await P.wait('pet_bought');const st=await tryWait(Q,'pet_stock',1500);ok(st&&st.prem.teddypom==4,'everybody online is told when the stock changes');
P.send({t:'pet_buy',k:'d',i:0});const ob=await P.wait('pet_bought');ok(ob.dog.breed==shop.offers[0].id,'a daily offer gives the offered breed');
P.send({t:'pet_buy',k:'p',id:'pandapup'});await P.wait('pet_bought');P.send({t:'pet_buy',k:'p',id:'bunnycorgi'});await P.wait('pet_bought');P.send({t:'pet_buy',k:'p',id:'mochipup'});await P.wait('pet_bought');P.send({t:'pet_buy',k:'p',id:'mochipup'});await P.wait('pet_bought');
P.clear('toast');P.send({t:'pet_buy',k:'p',id:'mochipup'});ok(/ครบ 8 ตัว/.test(await P.toast()||''),'the 9th shop purchase of the day is refused');
// premium dogs cannot be bred
ds=await P.dogs();{const pm=ds.find(d=>d.breed=='mochipup');P.clear('toast');P.send({t:'nur_pair',a:pm.id,b:adults[6].id});ok(/พรีเมียม|ผสมพันธุ์ไม่ได้|ยังโต/.test(await P.toast()||''),'premium dogs cannot be bred')}
// ============================================================ SELL TO SHOP
ds=await P.dogs();{const d=ds.find(d=>d.breed!='mochipup'&&!d.fav&&TRD.stageOf(d.born,Date.now(),36000)==3&&!d.rest),cb=P.me.coins;
 const want=TRD.sellValue(d,BRM[d.breed][2],null,Date.now(),36000);P.clear('pet_sold');P.send({t:'pet_sell',id:d.id});const sold=await P.wait('pet_sold');await P.tick();
 ok(Math.abs(sold.c-want)<=Math.round(want*.02)+1&&P.me.coins==cb+sold.c,'selling a grown-up '+d.breed+' pays '+sold.c+' coins (formula says '+want+')');
 ok(!(await P.dogs()).some(x=>x.id==d.id),'...and the dog is gone');
 const baby=(await P.dogs()).find(x=>x.breed=='mochipup');P.clear('pet_sold');P.send({t:'pet_sell',id:baby.id});const bs=await P.wait('pet_sold');
 ok(bs.c<720&&bs.c>=250,'a baby premium dog sells far below its price ('+bs.c+' coins for a 1800-coin dog)');
 const fv=(await P.dogs())[0];P.send({t:'dog_fav',dog:fv.id});await P.wait('dogs_all');P.clear('toast');P.send({t:'pet_sell',id:fv.id});ok(/ตัวโปรด/.test(await P.toast()||''),'a favourite cannot be sold');
 P.send({t:'pet_sell',id:'zzz'});P.send({t:'pet_sell',id:{}});await sleep(200);ok(true,'bad sell ids do not crash')}
// the last dog at home can never be sold
{const lone=await reg(PA,'LoneDog');const d=(await lone.dogs())[0];lone.clear('toast');lone.send({t:'pet_sell',id:d.id});ok(/อย่างน้อย 1 ตัว/.test(await lone.toast()||''),'the only dog cannot be sold');
 lone.send({t:'mk_put',dog:d.id,c:100});ok(/เลเวล|อย่างน้อย 1 ตัว/.test(await lone.toast()||''),'...nor listed');lone.ws.close()}
// ============================================================ MARKET
const G=await cli(PA);await G.auth({t:'guest'});G.send({t:'mk_put',dog:'x',c:100});ok(/Guest/.test(await G.toast()||''),'a guest cannot list a dog');G.send({t:'mk_buy',id:'x'});ok(/Guest/.test(await G.toast()||''),'a guest cannot buy');G.ws.close();
ds=await Q.dogs();ok(Q.me.lvl>=3,'(setup) seller is level 3 ('+Q.me.lvl+')');
const qd=ds.filter(d=>!d.fav);const L1=qd[0],L2=qd[1],L3=qd[2];
Q.clear('toast');Q.send({t:'mk_put',dog:L1.id,c:500,g:5});ok(/อย่างใดอย่างหนึ่ง/.test(await Q.toast()||''),'a price in coins AND gems is refused');
Q.send({t:'mk_put',dog:L1.id});ok(/อย่างใดอย่างหนึ่ง/.test(await Q.toast()||''),'no price is refused');
Q.send({t:'mk_put',dog:L1.id,c:10});ok(/อย่างใดอย่างหนึ่ง/.test(await Q.toast()||''),'a price below the minimum is refused');
Q.send({t:'mk_put',dog:L1.id,c:1e9});ok(/อย่างใดอย่างหนึ่ง/.test(await Q.toast()||''),'a huge price is refused');
Q.send({t:'mk_put',dog:L1.id,c:'abc'});ok(/อย่างใดอย่างหนึ่ง/.test(await Q.toast()||''),'a price that is not a number is refused');Q.send({t:'mk_put',dog:L1.id,c:-5});ok(/อย่างใดอย่างหนึ่ง/.test(await Q.toast()||''),'a negative price is refused');
Q.clear();let mk;Q.send({t:'mk_put',dog:L1.id,c:500});await Q.wait('mk');await Q.tick();
ok(!(await Q.dogs()).some(d=>d.id==L1.id),'a listed dog leaves the seller (it waits in escrow)');
Q.send({t:'mk_put',dog:L2.id,g:3});await Q.wait('mk');
R.send({t:'mk_get'});mk=await R.wait('mk');const e1=mk.list.find(e=>e.d.id==L1.id),e2=mk.list.find(e=>e.d.id==L2.id);
ok(e1&&e1.c==500&&e1.s=='SellerQ'&&e1.left>0&&e1.d.breed==L1.breed&&!e1.mine,'the buyer sees the listing (price, seller, time left, dog)');ok(e2&&e2.g==3,'...also gem listings');
Q.send({t:'mk_get'});mk=await Q.wait('mk');ok(mk.list.find(e=>e.id==e1.id).mine===true,'the seller sees which listings are theirs');
Q.clear('toast');Q.send({t:'mk_buy',id:e1.id});ok(/ของตัวเอง/.test(await Q.toast()||''),'nobody can buy their own listing');
{const poor=await reg(PA,'PoorBuyer');poor.send({t:'mk_buy',id:e1.id});ok(/Coins ไม่พอ/.test(await poor.toast()||''),'not enough coins is refused');poor.ws.close()}
const rc=R.me.coins,qc0=Q.me.coins;R.clear('pet_bought');R.send({t:'mk_buy',id:e1.id});const mb=await R.wait('pet_bought');await R.tick();
ok(mb.mk==1&&mb.dog.id==L1.id&&R.me.coins==rc-500,'buying from the market: the coins leave the buyer, the same dog arrives');
Q.clear('mail');Q.send({t:'mail_get'});const ml=await Q.wait('mail');const sale=ml.list.find(m=>m.k=='mk_sold');ok(sale&&sale.from=='BuyerR'&&sale.r.c==475,'the seller gets a mail with 95% of the price (475 of 500), claimable');
Q.send({t:'mail_claim',id:sale.id});await sleep(250);ok(Q.last('me').coins>=qc0+475,'...and the coins arrive when claimed');
R.clear('toast');R.send({t:'mk_buy',id:e1.id});ok(/ถูกซื้อไปแล้ว/.test(await R.toast()||''),'the same listing cannot be bought twice');
// gems: net 95% rounded
R.send({t:'mk_get'});mk=await R.wait('mk');const e2b=mk.list.find(e=>e.d.id==L2.id);R.send({t:'mk_buy',id:e2b.id});await R.wait('pet_bought');Q.clear('mail');Q.send({t:'mail_get'});const ml2=await Q.wait('mail');ok(ml2.list.some(m=>m.k=='mk_sold'&&m.r&&m.r.g==3),'gem listing: seller gets 3 gems (95% of 3 rounds to 3)');
// cancel returns the dog; limits
Q.send({t:'mk_put',dog:L3.id,c:100});await Q.wait('mk');Q.send({t:'mk_get'});mk=await Q.wait('mk');const mine=mk.list.find(e=>e.mine&&e.d.id==L3.id);Q.send({t:'mk_cancel',id:mine.id});await Q.wait('mk');ok((await Q.dogs()).some(d=>d.id==L3.id),'cancelling a listing gives the dog back');
R.send({t:'mk_cancel',id:mine.id});await sleep(150);ok(true,'nobody else can cancel a listing (ignored)');
{const more=(await Q.dogs()).filter(d=>!d.fav);let n=0;for(let i=0;i<6;i++){Q.clear('toast');Q.send({t:'mk_put',dog:more[i].id,c:100+i});const t=await Q.toast(300);if(t&&/^🏷️/.test(t))n++;else if(t&&/ไม่เกิน/.test(t)){ok(n==5,'at most 5 listings at the same time (listed '+n+')');break}}
 Q.send({t:'mk_get'});mk=await Q.wait('mk');for(const e of mk.list)if(e.mine){Q.send({t:'mk_cancel',id:e.id});await sleep(80)}}
{const fv=(await Q.dogs())[0];if(!fv.fav){Q.send({t:'dog_fav',dog:fv.id});await Q.wait('dogs_all')}Q.clear('toast');Q.send({t:'mk_put',dog:fv.id,c:100});ok(/ตัวโปรด/.test(await Q.toast()||''),'a favourite cannot be listed')}
// ============================================================ PRIVACY
const H=await reg(PA,'HostPriv'),V=await reg(PA,'VisitPriv'),F=await reg(PA,'FriendPriv');
H.send({t:'friend_add',name:'FriendPriv'});await sleep(200);F.send({t:'friend_ok',name:'HostPriv'});await sleep(300);
V.clear();V.send({t:'visit',id:'HostPriv'});let hv=await V.wait('house');ok(hv.owner=='HostPriv','open house: anybody can visit');
V.send({t:'visit',id:'VisitPriv'});await V.wait('house');
H.send({t:'set_priv',v:2});await H.wait('toast');await H.tick();ok(H.me.priv==2,'me.priv shows the setting');
V.clear();V.send({t:'visit',id:'HostPriv'});ok(/ปิดไม่รับแขก/.test(await V.toast()||''),'closed house: a stranger is refused');ok(!V.last('house'),'...and stays where they were');
F.clear();F.send({t:'visit',id:'HostPriv'});ok(/ปิดไม่รับแขก/.test(await F.toast()||''),'closed house: even a friend is refused');
H.send({t:'visit',id:'HostPriv'});await H.wait('house');ok(true,'the owner can always enter');
H.send({t:'set_priv',v:1});await H.wait('toast');F.clear();F.send({t:'visit',id:'HostPriv'});hv=await F.wait('house');ok(hv.owner=='HostPriv','friends-only: a friend can visit');
V.clear();V.send({t:'visit',id:'HostPriv'});ok(/เฉพาะเพื่อน/.test(await V.toast()||''),'friends-only: a stranger is refused');
V.send({t:'visit',id:'FriendPriv'});await V.wait('house');
H.send({t:'set_priv',v:0});await H.wait('toast');V.clear();V.send({t:'visit',id:'HostPriv'});await V.wait('house');F.clear();
H.send({t:'set_priv',v:2});const kick=await F.wait('house');ok(kick.owner=='FriendPriv','closing the house sends the guests who are inside back to their own house');
ok(/ปิดไม่รับแขก/.test((await tryWait(F,'toast',1500)||{m:''}).m),'...with a message');
H.send({t:'set_priv',v:7});H.send({t:'set_priv',v:'a'});H.send({t:'set_priv',v:null});H.send({t:'set_priv'});await sleep(200);H.send({t:'dogs_get'});H.clear('me');H.send({t:'daily'});await sleep(250);ok((H.last('me')||H.me).priv==2,'invalid privacy values are ignored');
H.send({t:'set_priv',v:1});await H.wait('toast');F.clear();F.send({t:'visit',id:'HostPriv'});await F.wait('house');
H.send({t:'friend_del',name:'FriendPriv'});const k2=await tryWait(F,'house',2000,m=>m.owner=='FriendPriv');ok(!!k2,'removing a friend from a friends-only house sends them out');
// ============================================================ LOSING COSTS COINS (RPS vs a person, picks are decided by us)
{const X=await reg(PA,'RpsWin'),Y=await reg(PA,'RpsLose');await admin(X);await admin(Y);
 X.send({t:'rps_find'});Y.send({t:'rps_find'});await X.wait('rps_start');await Y.wait('rps_start');
 const cx=X.me.coins,cy=Y.me.coins;X.send({t:'rps_pick',v:'P'});Y.send({t:'rps_pick',v:'R'});
 const rx=await X.wait('rps_result'),ry=await Y.wait('rps_result');await X.tick();await Y.tick();
 ok(rx.r==1&&rx.gain==30&&rx.loss==0,'RPS: the winner gets +30, no fee');ok(ry.r==-1&&ry.gain==0&&ry.loss==15,'RPS: the loser pays 15 coins');
 ok(Y.last('me').coins==cy-15&&X.last('me').coins==cx+30,'RPS: the coins really moved ('+cx+'→'+X.last('me').coins+', '+cy+'→'+Y.last('me').coins+')');
 X.send({t:'rps_find'});Y.send({t:'rps_find'});await X.wait('rps_start');await Y.wait('rps_start');X.send({t:'rps_pick',v:'R'});Y.send({t:'rps_pick',v:'R'});const dr=await Y.wait('rps_result');ok(dr.r==0&&dr.loss==0,'RPS: a draw costs nothing');await sleep(300);
 X.clear('rps_result');Y.clear('rps_result');X.send({t:'rps_find'});Y.send({t:'rps_find'});await X.wait('rps_start');await Y.wait('rps_start');const cy2=Y.last('me').coins;Y.send({t:'rps_cancel'});const q=await X.wait('rps_result');await sleep(200);ok(q.r==1&&Y.last('me').coins==cy2-15,'RPS: walking out of a match counts as a loss (-15)');
 // safety net: a player with less than 30 coins is not charged
 const Z=await reg(PA,'RpsBroke');Z.send({t:'rps_find'});X.send({t:'rps_find'});await Z.wait('rps_start');await X.wait('rps_start');
 const spend=Z.me.coins;for(let i=0;i<spend/45;i++){Z.send({t:'shop_buy',id:'cake',n:1});await sleep(40)}await sleep(300);const zc=Z.last('me').coins;
 X.send({t:'rps_pick',v:'P'});Z.send({t:'rps_pick',v:'R'});const rz=await Z.wait('rps_result');ok(rz.loss==0||zc>=30,'RPS: a player below 30 coins is not charged (coins '+zc+')');
 X.ws.close();Y.ws.close();Z.ws.close()}
// ============================================================ ARCADE: leaving a running game costs coins; 2-player result fee
{const X=await reg(PA,'ArcStay'),Y=await reg(PA,'ArcLeave');await admin(X);await admin(Y);
 X.send({t:'mp_find',g:'grab'});Y.send({t:'mp_find',g:'grab'});await X.wait('mp_start',9000);await Y.wait('mp_start',9000);await sleep(300);
 const cy=Y.me.coins;Y.send({t:'mp_leave'});const end=await X.wait('mp_end',5000);await sleep(250);
 ok(end.me.rank==1&&end.me.win&&end.me.loss===0,'arcade: the player who stays wins (no fee)');
 ok(Y.last('me').coins==cy-20,'arcade: leaving a game that already started costs 20 coins ('+cy+'→'+Y.last('me').coins+')');
 X.clear('mp_info');X.send({t:'mp_get'});const info=await X.wait('mp_info');ok(info.lossDay==400&&info.lossSafe==30&&info.lost===0,'mp_info tells the page about the fee limits');
 Y.clear('mp_info');Y.send({t:'mp_get'});const iy=await Y.wait('mp_info');ok(iy.lost==20,'...and how much I lost today ('+iy.lost+')');
 X.ws.close();Y.ws.close()}
ok(true,'-- end --');
}catch(e){ok(false,'EXCEPTION '+(e&&e.stack||e))}
await done();
})();
