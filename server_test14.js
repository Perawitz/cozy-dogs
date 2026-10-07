// v7 tests (part 4): pet shop + player market rules that server_test11.js does not cover.
//   market expiry (CD_HATCH speeds the 48 h up to 4.8 s) + the "your dog came home" mail, seller payout mail with the 5% fee,
//   double-buy / buy-vs-cancel / put-vs-sell races, insufficient funds, 100-dog limit, selling to the shop (edge cases),
//   the per-player daily cap, premium stock shared by two players, the midnight restock (server restart with an old date),
//   and hostile / malformed input for every shop + market message.
// Self-contained: starts its OWN servers on PORT+17 and PORT+18 (PORT env, default 3055).  Exit code 1 when anything FAILs.
'use strict';
const {spawn}=require('child_process'),os=require('os'),path=require('path'),fs=require('fs');
const BASE=+(process.env.PORT||3055),PA=BASE+17,PB=BASE+18;
const TRD=require('./traits'),BREEDS=require('./breeds'),PREM=require('./premium');
const BRM=Object.fromEntries(BREEDS.concat(PREM).map(b=>[b[0],b]));
const PRICE=Object.fromEntries(PREM.map(r=>[r[0],r[7]]));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let pass=0,fail=0;const ok=(c,n)=>{c?pass++:fail++;console.log(c?'PASS':'FAIL',n)};
const KEY='testadminkey1',PW='secret12';
function cli(PORT){return new Promise((res,rej)=>{const ws=new WebSocket('ws://localhost:'+PORT),log=[];
  const o={ws,log,send:m=>ws.send(JSON.stringify(m)),raw:s=>ws.send(s),
   wait:(t,ms=3000,f=null)=>new Promise((ok,no)=>{const g=()=>{const i=log.findIndex(x=>x.t==t&&(!f||f(x)));if(i>=0)return ok(log.splice(i,1)[0]);if((ms-=25)<=0)return no(new Error('timeout '+t));setTimeout(g,25)};g()}),
   last:t=>[...log].reverse().find(x=>x.t==t),count:(t,f)=>log.filter(x=>x.t==t&&(!f||f(x))).length,clear:t=>{for(let i=log.length-1;i>=0;i--)if(!t||log[i].t==t)log.splice(i,1)},
   async auth(m){o.send(m);const a=await o.wait('auth',4000);if(a.ok){await o.wait('welcome',3000).then(w=>o.welcome=w);await o.wait('me',3000)}return a},
   async dogs(){o.clear('dogs_all');o.send({t:'dogs_get'});return(await o.wait('dogs_all')).dogs},
   async toast(ms=1500){try{return(await o.wait('toast',ms)).m}catch{return null}},
   async tick(){await sleep(150);return o.me},
   async mk(){o.clear('mk');o.send({t:'mk_get'});return(await o.wait('mk')).list},
   async shop(){o.clear('pet_shop');o.send({t:'pet_shop'});return o.wait('pet_shop')},
   async mail(){o.clear('mail');o.send({t:'mail_get'});return(await o.wait('mail')).list}};
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.t=='me')o.me=m;log.push(m)};ws.onopen=()=>res(o);ws.onerror=()=>rej(new Error('connect'))})}
const tryWait=async(c,t,ms,f)=>{try{return await c.wait(t,ms,f)}catch{return null}};
const procs=[];
const start=(port,env,data)=>{data=data||path.join(os.tmpdir(),'cozydogs_t14_'+port+'_'+process.pid+'.json');
  const p=spawn(process.execPath,[path.join(__dirname,'server.js')],{env:{...process.env,PORT:String(port),DATA:data,ADMIN_KEY:KEY,CD_TEST:'1',...env},stdio:['ignore','pipe','pipe']});
  let err='';p.stderr.on('data',d=>err+=d);p.getErr=()=>err;p.data=data;p.exited=new Promise(r=>p.on('exit',r));procs.push(p);return p};
const stop=async p=>{p.kill('SIGTERM');await Promise.race([p.exited,sleep(4000)])};
const reg=async(port,name)=>{const c=await cli(port);const a=await c.auth({t:'register',user:name,email:name+'@example.com',pass:PW});if(!a.ok)throw new Error('register '+name+': '+JSON.stringify(a));c.name=name;return c};
const login=async(port,name)=>{const c=await cli(port);const a=await c.auth({t:'login',user:name,pass:PW});if(!a.ok)throw new Error('login '+name+': '+JSON.stringify(a));c.name=name;return c};
const admin=async c=>{c.send({t:'admin',key:KEY,coins:1e6});await sleep(150)};
const pulls=async(c,n)=>{for(let i=0;i<n;i+=10){c.send({t:'capsule',n:10});await c.wait('capsule',4000);await sleep(60)}};
const rich=async(port,name,n=0)=>{const c=await reg(port,name);await admin(c);if(n)await pulls(c,n);await c.tick();return c};
const net=p=>Math.max(1,Math.round(p*(1-.05)));
const today7=()=>new Date(Date.now()+7*36e5).toISOString().slice(0,10);
// list one dog and return its listing row
const put=async(c,dog,price,cur='c')=>{const id=dog.id||dog;c.clear('mk');c.send({t:'mk_put',dog:id,[cur]:price});const t=await tryWait(c,'mk',1500,x=>x.list.some(e=>e.mine&&e.d.id==id));return t?t.list.find(e=>e.mine&&e.d.id==id):null};
const spare=async(c,n=1)=>{const ds=(await c.dogs()).filter(d=>!d.fav);return n==1?ds[ds.length-1]:ds.slice(-n)};   // newest dogs are the least precious
const coins=c=>c.me.coins,gems=c=>c.me.gems;
const seen=new WeakMap();                                           // dog names are not unique, so sale mails are told apart by id: "the ones that are new since the last call"
const fresh=async(c,k)=>{const s=seen.get(c)||new Set();seen.set(c,s);const l=(await c.mail()).filter(m=>m.k==k&&!s.has(m.id));l.forEach(m=>s.add(m.id));return l};

(async()=>{
const A=start(PA,{CD_RATE:'100000'}),B=start(PB,{CD_HATCH:'36000',CD_RATE:'100000'});     // (the default is 20 messages / s per connection; raised so the tests can send bursts)         // A: real clocks.  B: market listings last 4.8 s
await sleep(1800);
const done=async()=>{for(const p of procs){try{p.kill()}catch{}}await sleep(200);for(const p of procs)for(const f of [p.data,p.data+'.bak',p.data+'.tmp'])try{fs.unlinkSync(f)}catch{}
  const e=procs.map(p=>p.getErr()).join('');if(e.trim()){console.log('SERVER STDERR:\n'+e.slice(0,1500))}ok(!e.trim(),'servers wrote nothing to stderr (no exceptions)');
  console.log('\nPASS',pass,'FAIL',fail);process.exit(fail?1:0)};
try{
// ============================================================ A. expiry: the listing times out and the dog goes home (server B, listings last 4.8 s)
{const SE=await rich(PB,'ExpSeller',40),BU=await reg(PB,'ExpBuyer');
 ok(SE.me.lvl>=3,'(setup) seller is level '+SE.me.lvl);
 const ds=await spare(SE,3),n0=(await SE.dogs()).length;
 const e1=await put(SE,ds[0],500);ok(e1&&e1.left>0&&e1.left<=4800,'a listing lasts 48 h / CD_HATCH = 4.8 s ('+(e1&&e1.left)+' ms left)');
 const e2=await put(SE,ds[1],5,'g'),e3=await put(SE,ds[2],700);
 ok((await SE.dogs()).length==n0-3,'3 dogs are in escrow');
 SE.clear();await sleep(5500);
 // an expired but not yet swept listing can not be bought: the buy sweeps first, the dog goes home
 const bc=coins(BU);BU.clear();BU.send({t:'mk_buy',id:e1.id});const tb=await BU.toast();await BU.tick();
 ok(/ถูกซื้อไปแล้ว|หมดเวลา/.test(tb||'')&&!BU.last('pet_bought')&&coins(BU)==bc,'buying a timed-out listing is refused and costs nothing: '+tb);
 ok(!!SE.last('dogs_all')&&!!SE.last('mk')&&!SE.last('mk').list.some(e=>e.mine),'the online seller is pushed the new dog list and an empty market');
 const back=await SE.dogs();ok(back.length==n0&&[ds[0],ds[1],ds[2]].every(d=>back.some(x=>x.id==d.id)),'all 3 dogs are home again (no dog lost, none duplicated: '+back.length+'/'+n0+')');
 const ml=(await SE.mail()).filter(m=>m.k=='mk_back');ok(ml.length==3&&ml.every(m=>!m.r&&m.dn)&&ds.every(d=>ml.some(m=>m.dn==d.name)),'3 "mk_back" mails name the dogs that came home ('+ml.map(m=>m.dn).join(', ')+')');
 SE.clear('toast');SE.send({t:'mk_cancel',id:e1.id});await sleep(250);ok((await SE.dogs()).length==n0,'cancelling a listing that already expired is ignored (no duplicate dog)');
 ok(!(await BU.mk()).some(e=>e.s=='ExpSeller'),'expired listings are gone from the market');
 // a timed-out listing does not block the 5-listing limit
 const five=await spare(SE,5);let n=0;for(const d of five)if(await put(SE,d,100))n++;ok(n==5,'5 listings are fine ('+n+')');
 const six=(await SE.dogs()).filter(d=>!d.fav).pop();SE.clear('toast');SE.send({t:'mk_put',dog:six.id,c:100});ok(/ไม่เกิน/.test(await SE.toast()||''),'the 6th live listing is refused');
 await sleep(5500);SE.clear();const r6=await put(SE,six,100);ok(!!r6,'...but once the 5 timed out the seller can list again (sweep runs before the limit check)');
 ok((await SE.dogs()).length==n0-1,'(and the 5 dogs came home: '+((await SE.dogs()).length)+')');
 // seller offline while the listing expires
 const OF=await rich(PB,'OfflineSeller',40),od=await spare(OF),on=(await OF.dogs()).length;await put(OF,od,900);OF.ws.close();await sleep(5600);
 await BU.mk();const OF2=await login(PB,'OfflineSeller'),od2=await OF2.dogs();
 ok(od2.length==on&&od2.some(d=>d.id==od.id),'offline seller: the dog is waiting at home after login ('+od2.length+'/'+on+')');
 ok((await OF2.mail()).some(m=>m.k=='mk_back'&&m.dn==od.name),'...with the "mk_back" mail');
 for(const c of [SE,BU,OF2])c.ws.close()}
// ============================================================ B. the fee, the payout mail, the dog arrives unchanged (server A)
const SELL=await rich(PA,'FeeSeller',40),BUY=await rich(PA,'FeeBuyer');
ok(SELL.me.lvl>=3,'(setup) FeeSeller is level '+SELL.me.lvl);
{const cases=[[1001,'c',951],[99999,'c',94999],[50,'c',48],[51,'c',48],[1,'g',1],[10,'g',10],[30,'g',29],[9999,'g',9499]];
 for(const [p,cur,want] of cases)ok(net(p)==want,'(formula) '+p+(cur=='c'?' coins':' gems')+' -> seller gets '+want);
 const dogs=await spare(SELL,cases.length>5?5:cases.length);let i=0;
 for(const [p,cur,want] of cases.slice(0,5)){
  const d=dogs[i++],before=(await SELL.dogs()).find(x=>x.id==d.id);
  const e=await put(SELL,d,p,cur);ok(e&&(cur=='c'?e.c==p&&!e.g:e.g==p&&!e.c)&&e.s==SELL.name&&e.mine,'listed for '+p+(cur=='c'?' coins':' gems'));
  const c0=coins(BUY),g0=gems(BUY),sc=coins(SELL),sg=gems(SELL);
  if(i==1){const rows=await BUY.mk();ok(rows.find(r=>r.id==e.id)&&!rows.find(r=>r.id==e.id).mine,'(buyer sees it, not as his own)');
   ok(rows.find(r=>r.id==e.id).left>172e6&&rows.find(r=>r.id==e.id).left<=172.8e6,'listing lasts 48 h')}
  BUY.clear('pet_bought');BUY.clear('mail');BUY.send({t:'mk_buy',id:e.id});const pb=await BUY.wait('pet_bought');await BUY.tick();await SELL.tick();
  ok(pb.mk==1&&pb.dog.id==d.id&&pb.dog.breed==before.breed&&pb.dog.name==before.name&&pb.dog.variant==before.variant&&pb.dog.born==before.born&&JSON.stringify(pb.dog.tr)==JSON.stringify(before.tr)&&(pb.dog.mix||null)==(before.mix||null),'the dog arrives unchanged (name, breed, mix, variant, age, traits)');
  ok(cur=='c'?coins(BUY)==c0-p&&gems(BUY)==g0:gems(BUY)==g0-p&&coins(BUY)==c0,'the buyer pays the full '+p+(cur=='c'?' coins':' gems')+', nothing else');
  ok(coins(SELL)==sc&&gems(SELL)==sg,'the seller is not paid until the mail is claimed');
  const sale=(await fresh(SELL,'mk_sold'))[0];
  ok(sale&&sale.from==BUY.name&&(cur=='c'?sale.r.c==want&&!sale.r.g:sale.r.g==want&&!sale.r.c),'mail "mk_sold" from '+BUY.name+' carries '+want+(cur=='c'?' coins':' gems')+' (5% fee, minimum 1)');
  SELL.clear('toast');SELL.send({t:'mail_claim',id:sale.id});await SELL.tick();SELL.send({t:'mail_claim',id:sale.id});await SELL.tick();
  ok(cur=='c'?coins(SELL)==sc+want:gems(SELL)==sg+want,'claiming pays '+want+' once (a second claim pays nothing)');
  ok(!(await BUY.dogs()).find(x=>x.id==d.id).fav,'a bought dog is never a favourite')}
 // newest first
 const two=await spare(SELL,2);await put(SELL,two[0],111);await sleep(30);await put(SELL,two[1],222);
 const rows=(await BUY.mk()).filter(e=>e.s==SELL.name);ok(rows.length==2&&rows[0].c==222&&rows[1].c==111,'market list is newest first');
 for(const r of (await SELL.mk()).filter(e=>e.mine)){SELL.send({t:'mk_cancel',id:r.id});await sleep(80)}}
// ============================================================ C. races
{const X=await rich(PA,'RaceSeller',40),B1=await rich(PA,'RaceBuyer1'),B2=await rich(PA,'RaceBuyer2');
 let wins=0,rounds=4,money=true,mails=true;
 for(let r=0;r<rounds;r++){
  const d=await spare(X),e=await put(X,d,1000);const c1=coins(B1),c2=coins(B2),x0=coins(X);
  for(const b of [B1,B2]){b.clear('pet_bought');b.clear('toast')}
  B1.send({t:'mk_buy',id:e.id});B2.send({t:'mk_buy',id:e.id});await sleep(500);await B1.tick();await B2.tick();
  const w1=B1.count('pet_bought')==1,w2=B2.count('pet_bought')==1;if(w1!=w2)wins++;
  const paid=(c1-coins(B1))+(c2-coins(B2));if(paid!=1000)money=false;
  if((await fresh(X,'mk_sold')).length!=1)mails=false}
 ok(wins==rounds,'two buyers in the same tick: exactly one gets the dog, '+wins+'/'+rounds+' rounds');
 ok(money,'...and only one of them is charged (1000 coins in total each round)');ok(mails,'...and the seller gets exactly one sale mail each round');
 // one buyer clicks twice
 {const d=await spare(X),e=await put(X,d,400),c0=coins(B1),n0=(await B1.dogs()).length;B1.clear('pet_bought');B1.send({t:'mk_buy',id:e.id});B1.send({t:'mk_buy',id:e.id});B1.send({t:'mk_buy',id:e.id});await sleep(400);await B1.tick();
  ok(B1.count('pet_bought')==1&&(await B1.dogs()).length==n0+1&&coins(B1)==c0-400,'a triple click on "buy" buys once and charges once');await fresh(X,'mk_sold')}
 // buy vs cancel
 let split=[0,0],cons=true;
 for(let r=0;r<6;r++){const d=await spare(X),e=await put(X,d,300),n0=(await X.dogs()).length+(await B2.dogs()).length;B2.clear('pet_bought');
  if(r%2){X.send({t:'mk_cancel',id:e.id});B2.send({t:'mk_buy',id:e.id})}else{B2.send({t:'mk_buy',id:e.id});X.send({t:'mk_cancel',id:e.id})}
  await sleep(450);const inX=(await X.dogs()).some(x=>x.id==d.id),inB=(await B2.dogs()).some(x=>x.id==d.id);
  if(inX==inB)cons=false;split[inB?1:0]++;
  const sm=(await fresh(X,'mk_sold')).length;if(sm!=(inB?1:0))cons=false;
  if(inX&&B2.count('pet_bought'))cons=false;
  const left=(await X.mk()).some(l=>l.mine&&l.d.id==d.id);if(left)cons=false}
 ok(cons,'buy and cancel at the same moment: the dog ends up with exactly one of them, never both, never lost ('+split[0]+' cancelled / '+split[1]+' bought)');
 // list the same dog twice at once / list and sell at once
 {const d=await spare(X),n0=(await X.dogs()).length;X.clear('mk');X.send({t:'mk_put',dog:d.id,c:200});X.send({t:'mk_put',dog:d.id,c:300});await sleep(400);
  const mine=(await X.mk()).filter(l=>l.mine&&l.d.id==d.id);ok(mine.length==1&&(await X.dogs()).length==n0-1,'listing the same dog twice at once makes ONE listing');
  const cx=coins(X);X.clear('pet_sold');X.send({t:'pet_sell',id:d.id});await sleep(250);ok(!X.last('pet_sold')&&coins(X)==cx,'a dog in escrow can not be sold to the shop');
  X.send({t:'mk_cancel',id:mine[0].id});await sleep(150)}
 {const d=await spare(X),n0=(await X.dogs()).length,c0=coins(X);X.clear('pet_sold');X.clear('mk');X.send({t:'pet_sell',id:d.id});X.send({t:'mk_put',dog:d.id,c:250});await sleep(450);await X.tick();
  const sold=X.count('pet_sold'),listed=(await X.mk()).filter(l=>l.mine&&l.d.id==d.id).length;
  ok(sold+listed==1,'sell-to-shop and list at the same moment: one wins (sold '+sold+', listed '+listed+')');
  ok((await X.dogs()).length==n0-1&&(sold?coins(X)>c0:coins(X)==c0),'...the dog is gone once, and coins are paid only if it was sold');
  for(const l of (await X.mk()).filter(l=>l.mine)){X.send({t:'mk_cancel',id:l.id});await sleep(80)}}
 for(const c of [X,B1,B2])c.ws.close()}
// ============================================================ D. funds, limits
{const S=await rich(PA,'FundsSeller',40);
 const P=await reg(PA,'PoorBuyer');                                  // 300 coins, 10 gems, level 1
 ok(coins(P)==300&&gems(P)==10,'(setup) a new player starts with 300 coins + 10 gems');
 let d=await spare(S),e=await put(S,d,301);P.clear();P.send({t:'mk_buy',id:e.id});ok(/Coins ไม่พอ/.test(await P.toast()||'')&&!P.last('pet_bought'),'one coin short: refused');await P.tick();ok(coins(P)==300&&(await P.dogs()).length==1,'...nothing was charged, no dog arrived');
 ok((await S.mk()).some(l=>l.id==e.id),'...and the listing is still there');S.send({t:'mk_cancel',id:e.id});await sleep(120);
 d=await spare(S);e=await put(S,d,300);P.send({t:'mk_buy',id:e.id});await P.wait('pet_bought');await P.tick();ok(coins(P)==0,'exactly enough coins: bought, 0 coins left (a level 1 player may buy)');
 d=await spare(S);e=await put(S,d,50);P.clear('toast');P.send({t:'mk_buy',id:e.id});ok(/Coins ไม่พอ/.test(await P.toast()||''),'0 coins: even the cheapest listing is refused');S.send({t:'mk_cancel',id:e.id});await sleep(120);
 d=await spare(S);e=await put(S,d,11,'g');P.clear('toast');P.send({t:'mk_buy',id:e.id});ok(/Gems ไม่พอ/.test(await P.toast()||''),'11 gems with 10 gems: refused');await P.tick();ok(gems(P)==10,'...no gems charged');
 S.send({t:'mk_cancel',id:e.id});await sleep(120);d=await spare(S);e=await put(S,d,10,'g');P.send({t:'mk_buy',id:e.id});await P.wait('pet_bought');await P.tick();ok(gems(P)==0,'10 gems for 10 gems: bought, 0 gems left (coins now '+coins(P)+', gems '+gems(P)+')');
 // plenty of gems does not pay a coin price
 const G=await reg(PA,'GemOnly');d=await spare(S);e=await put(S,d,5000);G.clear('toast');G.send({t:'mk_buy',id:e.id});ok(/Coins ไม่พอ/.test(await G.toast()||''),'a coin price needs coins, gems do not count');S.send({t:'mk_cancel',id:e.id});await sleep(120);
 // level too low to sell
 const L=await reg(PA,'LowLevel');await admin(L);await pulls(L,10);await L.tick();const ld=await L.dogs();
 ok(L.me.lvl<3&&ld.length>2,'(setup) a level '+L.me.lvl+' player with '+ld.length+' dogs');L.clear();L.send({t:'mk_put',dog:ld[1].id,c:100});ok(/เลเวล 3/.test(await L.toast()||''),'a seller below level 3 is refused');await sleep(150);ok((await L.dogs()).length==ld.length&&!(await P.mk()).some(l=>l.s=='LowLevel'),'...the dog stays home');
 // storage full (100 dogs): shop and market buys are refused, selling one frees a slot
 const F=await rich(PA,'FullHouse',0);for(let i=0;i<9;i++)await pulls(F,10);F.send({t:'dogs_get'});const fd=(await F.wait('dogs_all')).dogs;
 if(fd.length<100){for(let i=0;i<(100-fd.length);i++){F.send({t:'capsule',n:1});await sleep(30)}await sleep(300)}
 const nf=(await F.dogs()).length;ok(nf>=100,'(setup) FullHouse owns '+nf+' dogs');
 d=await spare(S);e=await put(S,d,100);F.clear();const cf=coins(F);F.send({t:'mk_buy',id:e.id});ok(/เต็มแล้ว/.test(await F.toast()||'')&&!F.last('pet_bought'),'with 100 dogs a market purchase is refused');
 F.send({t:'pet_buy',k:'p',id:'mochipup'});ok(/เต็มแล้ว/.test(await F.toast()||''),'...and a shop purchase too');F.send({t:'pet_buy',k:'d',i:0});await sleep(200);
 await F.tick();ok(coins(F)==cf&&(await F.dogs()).length==nf&&(await S.mk()).some(l=>l.id==e.id),'...nothing charged, nothing moved');
 for(const sd of (await F.dogs()).filter(x=>!x.fav).slice(-(nf-99))){F.send({t:'pet_sell',id:sd.id});await F.wait('pet_sold')}F.send({t:'mk_buy',id:e.id});await tryWait(F,'pet_bought',1500)?ok(true,'selling one dog makes room again'):ok(false,'selling one dog makes room again');
 for(const c of [S,P,G,L,F])c.ws.close()}
// ============================================================ F. shop: stock shared by two players, per-player cap, restock at midnight
const SA=await rich(PA,'ShopA'),SB=await rich(PA,'ShopB');
const row=(s,id)=>s.prem.find(p=>p.id==id);
{let sa=await SA.shop(),sb=await SB.shop();
 ok(sa.prem.length==11&&sa.cap==8&&sa.bought==0&&sa.offers.length==5&&PREM.every(r=>row(sa,r[0])&&row(sa,r[0]).c==(r[7].c||0)&&row(sa,r[0]).g==(r[7].g||0)),'pet_shop lists 11 premium breeds with their prices, 5 offers and the cap 8');
 ok(sa.prem.every(p=>p.left==p.max&&p.max==(p.c?5:p.g<=70?3:p.g<=120?2:1)),'stock at the start of the day: coin breeds 5, gem breeds 3 / 2 / 1');
 ok(JSON.stringify(sa.offers.map(o=>o.left))=='[3,3,2,2,1]'&&sa.offers.every(o=>BRM[o.id]&&!BRM[o.id][7]&&o.c>0),'daily offers: 3,3,2,2,1 ordinary breeds with a coin price');
 // premium stock goes down for everybody
 SB.clear('pet_stock');SA.clear('pet_bought');let c0=coins(SA);SA.send({t:'pet_buy',k:'p',id:'mochipup'});await SA.wait('pet_bought');await SA.tick();
 ok(coins(SA)==c0-1800,'Mochi Pup costs 1800 coins');
 const st=await tryWait(SB,'pet_stock',1500);ok(st&&st.prem.mochipup==4,'ShopB is told: 4 left');
 sb=await SB.shop();ok(row(sb,'mochipup').left==4&&sb.bought==0,'ShopB sees 4 left, and his own cap counter is still 0 (the cap is per player)');
 c0=coins(SB);SB.send({t:'pet_buy',k:'p',id:'mochipup'});await SB.wait('pet_bought');await SB.tick();sa=await SA.shop();ok(row(sa,'mochipup').left==3&&coins(SB)==c0-1800&&sa.bought==1,'ShopB buys one too: stock 3 for both');
 // the last gem breed
 let g0=gems(SA);SA.send({t:'pet_buy',k:'p',id:'dragonpup'});await SA.wait('pet_bought');await SA.tick();ok(gems(SA)==g0-260,'Dragon Pup costs 260 gems');
 g0=gems(SB);const nb=(await SB.dogs()).length;SB.clear('toast');SB.clear('pet_bought');SB.send({t:'pet_buy',k:'p',id:'dragonpup'});ok(/ขายหมดแล้ว/.test(await SB.toast()||''),'the only Dragon Pup is gone for the other player: sold out');
 await SB.tick();sb=await SB.shop();ok(gems(SB)==g0&&(await SB.dogs()).length==nb&&!SB.last('pet_bought')&&sb.bought==1&&row(sb,'dragonpup').left==0,'...nothing charged, nothing counted');
 // offers: 3 -> 0
 c0=coins(SA);const o0=sa.offers[0];for(let i=0;i<3;i++){SA.send({t:'pet_buy',k:'d',i:0});await SA.wait('pet_bought')}await SA.tick();
 ok(coins(SA)==c0-3*o0.c,'offer 0 costs '+o0.c+' coins each');sa=await SA.shop();ok(sa.offers[0].left==0&&sa.bought==5,'offer 0 is sold out after 3, and 5 purchases are counted');
 c0=coins(SA);SA.clear('toast');SA.clear('pet_bought');SA.send({t:'pet_buy',k:'d',i:0});ok(/ขายหมดแล้ว/.test(await SA.toast()||'')&&!SA.last('pet_bought'),'a sold-out offer is refused');await SA.tick();sa=await SA.shop();ok(coins(SA)==c0&&sa.bought==5,'...nothing charged, nothing counted');
 // up to the cap
 SA.send({t:'pet_buy',k:'p',id:'mochipup'});await SA.wait('pet_bought');SA.send({t:'pet_buy',k:'p',id:'mochipup'});await SA.wait('pet_bought');SA.send({t:'pet_buy',k:'p',id:'teddypom'});await SA.wait('pet_bought');sa=await SA.shop();ok(sa.bought==8,'8 purchases made');
 c0=coins(SA);const n9=(await SA.dogs()).length;SA.clear('toast');SA.clear('pet_bought');SA.send({t:'pet_buy',k:'p',id:'mochipup'});ok(/ครบ 8 ตัว/.test(await SA.toast()||''),'the 9th shop purchase of the day is refused');
 SA.send({t:'pet_buy',k:'d',i:1});SA.send({t:'pet_buy',k:'p',id:'dragonpup'});await sleep(250);await SA.tick();sa=await SA.shop();
 ok(!SA.last('pet_bought')&&coins(SA)==c0&&(await SA.dogs()).length==n9&&sa.bought==8&&row(sa,'mochipup').left==1&&sa.offers[1].left==3,'...whatever he tries (offer, premium): nothing charged, stock untouched, counter stays at 8');
 // market purchases are not shop purchases
 const MS=await rich(PA,'CapSeller',40),md=await spare(MS),me=await put(MS,md,500);c0=coins(SA);SA.send({t:'mk_buy',id:me.id});await SA.wait('pet_bought');await SA.tick();sa=await SA.shop();
 ok(coins(SA)==c0-500&&sa.bought==8,'at the cap the market still works, and market buys do not count towards the cap');
 MS.ws.close();
 // the other player is not capped
 SB.send({t:'pet_buy',k:'p',id:'teddypom'});await SB.wait('pet_bought',2000).then(()=>ok(true,'the cap is per player: ShopB can still buy'),()=>ok(false,'the cap is per player: ShopB can still buy'))}
// a daily offer is chosen by an integer index: anything else buys nothing (it used to be coerced to offer 0)
{const IX=await rich(PA,'IndexJunk'),c0=coins(IX);IX.clear();for(const i of ['abc','0','1',null,{},[],[0],1.5,-1,5,99,1e9,true,'','NaN'])IX.send({t:'pet_buy',k:'d',i});await sleep(500);await IX.tick();
 ok(!IX.last('pet_bought')&&coins(IX)==c0&&(await IX.dogs()).length==1,'offer index "abc", "0", null, {}, [0], 1.5, -1, 5, 1e9, true ... buys nothing and costs nothing');IX.ws.close()}
// ============================================================ F2. persistence + midnight restock (restart the server on an "old" save)
{const Z=await rich(PA,'KeepSeller',40),zd=await spare(Z),ze=await put(Z,zd,777),zn=(await Z.dogs()).length;
 for(const c of [Z,SA,SB])c.ws.close();await sleep(300);await stop(A);
 const db=JSON.parse(fs.readFileSync(A.data,'utf8'));ok(db.shop&&db.shop.date==today7()&&Array.isArray(db.market)&&db.market.some(e=>e.id==ze.id),'the shop day and the market listing are in the save file');
 const oldExp=db.market.find(e=>e.id==ze.id).exp;db.shop.date='2000-01-01';for(const n in db.players)if(db.players[n].sb)db.players[n].sb.d='2000-01-01';fs.writeFileSync(A.data,JSON.stringify(db));
 const A2=start(PA,{CD_RATE:'100000'},A.data);await sleep(1800);
 const Z2=await login(PA,'KeepSeller'),rows=await Z2.mk(),back=rows.find(e=>e.id==ze.id);
 ok(back&&back.mine&&back.c==777&&back.left>0&&Math.abs((Date.now()+back.left)-oldExp)<3000,'after a restart the listing is still there, with the same expiry');ok((await Z2.dogs()).length==zn,'...and its dog is still in escrow, not at home');
 const SA2=await login(PA,'ShopA'),s=await SA2.shop();
 ok(s.date==today7()&&s.bought==0&&s.prem.every(p=>p.left==p.max)&&JSON.stringify(s.offers.map(o=>o.left))=='[3,3,2,2,1]','a new day: stock refilled, offers renewed, the daily counter is back to 0');
 SA2.send({t:'pet_buy',k:'p',id:'dragonpup'});await SA2.wait('pet_bought',2000).then(()=>ok(true,'...and yesterday\'s sold-out Dragon Pup can be bought again'),()=>ok(false,'...and yesterday\'s sold-out Dragon Pup can be bought again'));
 SA2.ws.close();Z2.ws.close()}
// ============================================================ E. selling to the shop: edge cases
{const Q=await rich(PA,'SellEdge',10);const ds=await Q.dogs();ok(ds.length==11&&ds.some(d=>d.away),'(setup) 11 dogs, the extra ones live "away" (house holds 8)');
 const away=ds.find(d=>d.away&&!d.fav),want=TRD.sellValue(away,BRM[away.breed][2],BRM[away.breed][7]||null,Date.now(),1);
 let c0=coins(Q);Q.clear('pet_sold');Q.send({t:'pet_sell',id:away.id});Q.send({t:'pet_sell',id:away.id});const sold=await Q.wait('pet_sold');await Q.tick();
 ok(sold.c==want&&sold.name==away.name&&coins(Q)==c0+want,'selling an away dog pays exactly TRD.sellValue = '+want+' coins ('+sold.c+')');
 await sleep(200);ok(Q.count('pet_sold')==0&&coins(Q)==c0+want,'a double click sells once and pays once');
 // favourite
 const home=(await Q.dogs()).filter(d=>!d.away);Q.send({t:'dog_fav',dog:home[0].id});await Q.wait('dogs_all');Q.clear('toast');Q.send({t:'pet_sell',id:home[0].id});ok(/ตัวโปรด/.test(await Q.toast()||''),'a favourite can not be sold');
 Q.send({t:'mk_put',dog:home[0].id,c:100});ok(/ตัวโปรด|เลเวล/.test(await Q.toast()||''),'...nor listed');Q.send({t:'dog_fav',dog:home[0].id});await Q.wait('dogs_all');
 // other player's dogs and junk ids
 const Y=await reg(PA,'OtherOwner'),yd=(await Y.dogs())[0],c1=coins(Q);Q.clear('pet_sold');Q.send({t:'pet_sell',id:yd.id});Q.send({t:'mk_put',dog:yd.id,c:100});await sleep(300);
 ok(!Q.last('pet_sold')&&coins(Q)==c1&&(await Y.dogs()).some(d=>d.id==yd.id)&&!(await Y.mk()).some(l=>l.d.id==yd.id),"somebody else's dog id: not sold, not listed, still theirs");
 const n1=(await Q.dogs()).length;for(const id of [undefined,null,'',' ','0',0,-1,1e308,true,false,[],{},[1],{a:1},'__proto__','constructor','x'.repeat(5000),'\u0000'])Q.send({t:'pet_sell',id});await sleep(300);
 ok(!Q.last('pet_sold')&&(await Q.dogs()).length==n1,'18 junk ids sell nothing');
 // visiting another house
 Q.send({t:'visit',id:Y.name});await sleep(300);const vd=(await Q.dogs()).filter(d=>!d.fav).pop();Q.clear('toast');Q.send({t:'pet_sell',id:vd.id});ok(/บ้านตัวเอง/.test(await Q.toast()||''),'at somebody else\'s house you can not sell');
 Q.send({t:'mk_put',dog:vd.id,c:100});ok(/บ้านตัวเอง|เลเวล/.test(await Q.toast()||''),'...nor list');
 Q.send({t:'visit',id:Q.name});await sleep(300);Q.clear('pet_sold');Q.send({t:'pet_sell',id:vd.id});await Q.wait('pet_sold',2000).then(()=>ok(true,'back home you can sell again'),()=>ok(false,'back home you can sell again'));
 // the last dog
 const T=await reg(PA,'TwoDogs');await admin(T);T.send({t:'pet_buy',k:'d',i:0});await T.wait('pet_bought');const td=await T.dogs();ok(td.length==2,'(setup) 2 dogs');
 T.send({t:'pet_sell',id:td[0].id});await T.wait('pet_sold');T.clear('toast');T.send({t:'pet_sell',id:td[1].id});ok(/อย่างน้อย 1 ตัว/.test(await T.toast()||'')&&(await T.dogs()).length==1,'the last dog can not be sold');
 // premium + baby prices come from the same formula the page shows
 const pm=(await T.shop(),T.send({t:'pet_buy',k:'p',id:'mochipup'}),await T.wait('pet_bought')).dog;await T.tick();const pd=(await T.dogs()).find(d=>d.id==pm.id),pw=TRD.sellValue(pd,'M',PRICE.mochipup,Date.now(),1);
 T.clear('pet_sold');T.send({t:'pet_sell',id:pd.id});const ps=await T.wait('pet_sold');ok(ps.c==pw&&pw>=200&&pw<=1000,'a fresh premium dog sells for the formula value ('+ps.c+' of its 1800 coin price)');
 for(const c of [Q,Y,T])c.ws.close()}
// ============================================================ G. hostile input for every shop / market message (on server A: listings last 48 h here)
{const H=await rich(PA,'Hostile',40),V=await rich(PA,'Victim',40);
 const sum=async()=>{const own=(await H.dogs()).length,listed=(await H.mk()).filter(l=>l.mine).length,vown=(await V.dogs()).length,vl=(await V.mk()).filter(l=>l.mine).length;return{dogs:own+listed,vdogs:vown+vl,v:vown}};
 const vd=(await V.dogs()).filter(d=>!d.fav),hd=(await H.dogs()).filter(d=>!d.fav)[3];
 const vdog=vd[0].id,vl=await put(V,vd[1],5000);            // somebody else's dog and listing
 await H.tick();const base=await sum(),h0=coins(H),hg=gems(H);
 const JUNK=[undefined,null,'','abc','NaN','Infinity','-Infinity',' ',[],{},[1,2],{a:1},true,false,0,-0,-1,1.5,-1.5,49,99999.9,100000,1e9,1e15,1e308,2**53,-(2**53),'0','-1','1e9','0x10','9'.repeat(400),'x'.repeat(5000),'__proto__','constructor','toString','hasOwnProperty','\u0000','😀','<img src=x onerror=1>',vdog];
 const MSGS={pet_shop:[],pet_buy:['k','id','i'],pet_sell:['id'],mk_get:[],mk_put:['dog','c','g'],mk_buy:['id'],mk_cancel:['id']};
 let sent=0;
 for(const t in MSGS){H.send({t});sent++;for(const f of MSGS[t]){for(const v of JUNK){const m={t};m[f]=v;if(t=='mk_put'&&f!='dog')m.dog=hd.id;if(t=='pet_buy'&&f!='k')m.k=f=='i'?'d':'p';if(t=='pet_buy'&&f=='k'){m.id='mochipup';m.i=0}H.send(m);sent++}}}
 // a frame bigger than the server accepts: the connection is dropped, the server lives on (tested on a throw-away connection)
 {const T=await reg(PA,'BigFrame');T.send({t:'mk_put',dog:'x'.repeat(100000),c:100});await sleep(500);ok(T.ws.readyState>=2,'a 100 kB frame gets the connection closed');const T2=await login(PA,'BigFrame');ok((await T2.dogs()).length>=1,'...and the player simply logs in again');T2.ws.close()}
 // two junk fields at once, plus a few raw frames the JSON helper can not produce
 for(const a of JUNK.slice(0,25))for(const b of [null,'x',-1,{},[]]){H.send({t:'mk_put',dog:a,c:b,g:b});H.send({t:'pet_buy',k:a,id:b,i:b});H.send({t:'mk_buy',id:a,c:b});sent+=2}
 for(const r of ['{"t":"mk_put","dog":"'+hd.id+'","c":1e999}','{"t":"mk_put","dog":"'+hd.id+'","g":1e999}','{"t":"mk_put","dog":"'+hd.id+'","c":-1e999}','{"t":"pet_buy","k":"d","i":1e999}','{"t":"__proto__"}','{"t":"constructor"}','{"t":"pet_sell","__proto__":{"id":"x"}}','{"t":"mk_buy","id":{"toString":1}}','[]','null','5','"pet_shop"','{"t":["pet_shop"]}','{"t":{"a":1}}','{','not json at all'])H.raw(r);
 await sleep(1500);
 await H.tick();await V.tick();const bought=H.count('pet_bought');
 const now=await sum();
 ok(now.dogs==base.dogs+bought&&bought<=3,'after ~'+sent+' hostile frames: my dogs + listings are conserved; the only change are '+bought+' legal purchases of daily offer 0 (index 0 / -0) ('+base.dogs+' -> '+now.dogs+')');
 ok(now.vdogs==base.vdogs&&now.v==base.v&&(await V.mk()).some(l=>l.id==vl.id&&l.mine),"...and the other player's dogs and listing were not touched");
 ok(Number.isFinite(coins(H))&&Number.isFinite(gems(H))&&coins(H)>=0&&gems(H)>=0&&coins(H)<=h0+1e6,'my coins / gems are still sane numbers ('+coins(H)+' / '+gems(H)+')');
 ok(coins(V)>=0&&gems(V)>=0,"the other player's money is intact");
 // prices that must be refused, for both currencies, with a real dog
 H.clear();const bads=['abc','',null,[],{},'NaN','Infinity',-1,0,'-5',100000,1e9,1e308,2**53,'1e9'],badc=bads.concat([49]),badg=bads.concat([10000]);const hd2=await spare(H),nd=(await H.dogs()).length;
 for(const v of badc)H.send({t:'mk_put',dog:hd2.id,c:v});for(const v of badg)H.send({t:'mk_put',dog:hd2.id,g:v});for(const v of bads)H.send({t:'mk_put',dog:hd2.id,c:v,g:v})
 await sleep(500);const hl=(await H.mk()).filter(l=>l.mine&&l.d.id==hd2.id).length;const nd2=(await H.dogs()).length;
 ok(hl==0&&nd2==nd,'46 bad prices (as coins, as gems, as both) never list the dog ('+hl+' listings)');
 // good prices at the edges list fine
 const edge=(await spare(H,4));let e1=await put(H,edge[0],50),e2=await put(H,edge[1],99999),e3=await put(H,edge[2],1,'g'),e4=await put(H,edge[3],9999,'g');
 ok(e1&&e2&&e3&&e4,'the edge prices 50 / 99999 coins and 1 / 9999 gems are accepted');
 H.clear('toast');const more=(await spare(H));H.send({t:'mk_put',dog:more.id,c:100000});H.send({t:'mk_put',dog:more.id,c:49});H.send({t:'mk_put',dog:more.id,g:10000});H.send({t:'mk_put',dog:more.id,g:0});await sleep(300);
 ok(!(await H.mk()).some(l=>l.mine&&l.d.id==more.id),'...and one past each edge (100000 / 49 coins, 10000 / 0 gems) is refused');
 // somebody else's listing can not be cancelled, bought for free, or guessed
 H.send({t:'mk_cancel',id:vl.id});H.send({t:'mk_buy',id:[vl.id].concat([1])});H.send({t:'mk_cancel',id:{id:vl.id}});await sleep(250);ok((await V.mk()).some(l=>l.id==vl.id&&l.mine),"another player's listing can not be cancelled");
 const cp=coins(H);H.clear('pet_bought');H.send({t:'mk_buy',id:vl.id});H.send({t:'mk_buy',id:vl.id});await sleep(300);await H.tick();ok(H.count('pet_bought')==1&&coins(H)==cp-5000,'a real buy still works after all the junk, and costs exactly the price ('+(cp-coins(H))+')');
 // the server still answers
 const sh=await H.shop();ok(sh.prem.length==11&&sh.offers.length==5,'the server is still up and answers pet_shop');
 for(const c of [H,V])c.ws.close()}
}catch(e){ok(false,'EXCEPTION '+(e&&e.stack||e))}
await done();
})();
