// Cozy Dogs - "home" gameplay (all server-authoritative):
//   dog wishes, fetch, furniture sets / cozy score / house levels, party mode, guestbook + likes + weekly contest,
//   mailbox, daily lucky wheel, starter missions.  Messages are routed here from server.js via F.handle().
'use strict';
module.exports=function(X){
const {db,conns,send,wsOf,player,give,clamp,rnd,pick,rid,today,lvl,sendMe,pushDogs,houseDogs,pub,decide,posOf,addXp,C,dirty,bump,own,cat,safe,toView,maxItems,maxDogs,hlOf,isGuestName,realName}=X;
const toast=(ws,m)=>send(ws,{t:'toast',m});
const DAY=864e5, st=(p,k)=>p.stats[k]||0;
const evMul=()=>C.season()?1.25:1, WFIRST=process.env.CD_WISH?[1,3]:[15,60];
const ctrl=new RegExp('[\\u0000-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u2028-\\u202e<>]','g');
const clean=(s,n)=>String(s==null?'':s).replace(ctrl,'').replace(/\s+/g,' ').trim().slice(0,n);

// =====================================================================  furniture sets, perks, cozy score
function setsDone(p){const have=new Set(p.items.map(i=>i.type));return C.SETS.filter(s=>s.need.every(id=>have.has(id)))}
const perks=p=>new Set(setsDone(p).map(s=>s.perk));
function cozy(p){let pts=0;for(const i of p.items){const d=cat(C.ITEMS,i.type);if(d)pts+=Math.floor(d.p/40)+1}
 const sets=setsDone(p);for(const s of sets)pts+=s.pts;
 pts+=Math.floor((cat(C.WALLS,p.deco.wall)||0)/50)+Math.floor((cat(C.FLOORS,p.deco.floor)||0)/50)+Math.floor((cat(C.LIGHTS,p.deco.light)||0)/50);
 pts+=p.dogs.filter(d=>!d.away).length*3;
 return{score:pts,sets:sets.map(s=>s.id)}}

// =====================================================================  wishes
const WPERS={PLAYFUL:[['play',2]],LAZY:[['pet',3]],ENERGETIC:[['play',3]],SHY:[['pet',3]],FRIENDLY:[['pet',4]],FOODIE:[['feed',1,'fav']],CURIOUS:[['train',1]],CLINGY:[['pet',5]],BRAVE:[['train',2]],SLEEPY:[['brush',2]],MISCHIEVOUS:[['bath',1]]};
const WALT=[['pet',3],['play',2],['brush',2],['bath',1],['train',1],['feed',1,'rand']];
function mkWish(d,now){const [k,need,f]=Math.random()<.7?pick(WPERS[d.pers]||WALT):pick(WALT);let food=null;
 if(k=='feed'){food=f=='fav'?String(d.favFood).toLowerCase():pick(['kibble','treat','cookie',String(d.favFood).toLowerCase()]);if(!own(C.FOOD,food))food='kibble'}
 return{k,f:food,need,got:0,exp:now+15*60e3}}
function wish(p,d,kind,food,ws,name){const w=d.wish;if(!w||w.k!=kind)return;if(kind=='feed'&&w.f&&food!==w.f)return;
 if(++w.got<w.need)return;                                              // progress travels with the caller's next 'dogs' push
 const pk=perks(p),r={c:Math.round((12+w.need*5)*(pk.has('coin')?1.1:1)*(pk.has('wish')?1.25:1)*(1+X.TRD.buff(d,'wish'))*evMul())};if(Math.random()<.1)r.g=1;
 give(p,r);d.bond=clamp(d.bond+3);d.happy=clamp(d.happy+10);addXp(p,6,ws);d.wish=null;d.wishNext=Date.now()+rnd(90,200)*1000;dirty();
 bump(name,'wish',1,ws);toView(name,{t:'fx',e:'💖',dog:d.id});if(ws)send(ws,{t:'wish_done',dog:d.id,name:d.name,r})}
setInterval(safe('wishes',()=>{const now=Date.now();
 for(const [ws,c] of conns){const p=player(c.name),dogs=houseDogs(p);let active=dogs.filter(d=>d.wish).length;
  for(const d of dogs){
   if(d.wish){if(d.wish.exp<now){d.wish=null;d.wishNext=now+rnd(60,150)*1000;active--;dirty();toView(c.name,{t:'dogs',dogs:[pub(d,now)]})}continue}
   if(d.wishNext===undefined){d.wishNext=now+rnd(...WFIRST)*1000;continue}
   if(active>=2||now<d.wishNext)continue;
   d.wish=mkWish(d,now);active++;dirty();toView(c.name,{t:'dogs',dogs:[pub(d,now)]});send(ws,{t:'wish_new',dog:d.id,name:d.name,w:{k:d.wish.k,f:d.wish.f,need:d.wish.need}})}
  if(p.party&&p.party.until&&p.party.until<=now&&!p.party.ended){p.party.ended=true;toView(c.name,{t:'party',owner:c.name,ms:0})}}}),5000);

// =====================================================================  fetch (house)
const fetching=new Set();
function doFetch(ws,c,m){const p=player(c.name),now=Date.now();if(c.view!=c.name||now-(c.lastFetch||0)<1200)return;
 const dogs=houseDogs(p);let d=dogs.find(x=>x.id===m.dog&&!x.fetch);
 if(!d)d=dogs.filter(x=>!x.fetch&&x.state!='SLEEP').sort(()=>Math.random()-.5)[0]||dogs.find(x=>!x.fetch);if(!d)return;
 if(d.energy<10)return toast(ws,d.name+' เหนื่อยแล้ว ให้พักก่อนนะ 💤');
 c.lastFetch=now;const lx=clamp(+m.x||400,70,730),ly=clamp(+m.y||450,350,556),[x,y]=posOf(d,now),dist=Math.hypot(lx-x,ly-y),dur=Math.max(500,dist/190*1000);
 Object.assign(d,{fx:x,fy:y,tx:lx,ty:ly,t0:now,dur,until:now+1e7,state:'RUN',trick:null});
 d.fetch={st:1,bx:lx,by:ly,t0:now,t1:now+dur+350,t2:0};fetching.add(c.name);toView(c.name,{t:'dogs',dogs:[pub(d,now)]})}
setInterval(safe('fetch',()=>{const now=Date.now();
 for(const name of [...fetching]){const p=db.players[name];if(!p){fetching.delete(name);continue}let any=false;const dogs=houseDogs(p);
  for(const d of dogs){const f=d.fetch;if(!f)continue;any=true;
   if(now-f.t0>20000){d.fetch=null;decide(p,d,dogs,now);toView(name,{t:'dogs',dogs:[pub(d,now)]});continue}
   if(f.st==1&&now>=f.t1){const [x,y]=posOf(d,now),ox=400+rnd(-40,40),oy=548+rnd(-8,8),dist=Math.hypot(ox-x,oy-y),dur=Math.max(500,dist/175*1000);
    Object.assign(d,{fx:x,fy:y,tx:ox,ty:oy,t0:now,dur,state:'WALK',until:now+1e7});f.st=2;f.t0=now;f.t2=now+dur+250;toView(name,{t:'dogs',dogs:[pub(d,now)]})}
   else if(f.st==2&&now>=f.t2){d.fetch=null;const ws=wsOf(name);
    d.bond=clamp(d.bond+2);d.happy=clamp(d.happy+7);d.energy=clamp(d.energy-6);addXp(p,2,ws);
    if(!p.fe||p.fe.date!=today())p.fe={date:today(),n:0};if(++p.fe.n<=20)p.coins+=2;dirty();bump(name,'fetch',1,ws);
    decide(p,d,dogs,now,'SIT');toView(name,{t:'dogs',dogs:[pub(d,now)]});toView(name,{t:'fx',e:'🎾',dog:d.id});if(ws)sendMe(ws)}}
  if(!any)fetching.delete(name)}}),250);

// =====================================================================  lucky wheel
const WHEEL=[{r:{c:20},w:24,l:'💰 20'},{r:{c:50},w:20,l:'💰 50'},{r:{c:100},w:12,l:'💰 100'},{r:{g:1},w:12,l:'💎 1'},{r:{tk:1},w:12,l:'🎟 1'},{r:{c:250},w:5,l:'💰 250'},{r:{g:3},w:4,l:'💎 3'},{r:{inv:{cake:2}},w:11,l:'🎂 ×2'}];
const SPINMAX=4;
const spinState=p=>p.spin&&p.spin.date==today()?p.spin:(p.spin={date:today(),n:0});
const spinInfo=p=>{const sp=spinState(p);return{t:'spin_info',wheel:WHEEL.map(w=>w.l),free:sp.n==0,left:Math.max(0,SPINMAX-sp.n),tk:p.tickets}};
function doSpin(ws,c){const p=player(c.name),sp=spinState(p);if(sp.n>=SPINMAX)return toast(ws,'วันนี้หมุนครบแล้ว พรุ่งนี้มาใหม่นะ');
 if(sp.n>0){if(p.tickets<1)return toast(ws,'Tickets ไม่พอสำหรับหมุนเพิ่ม');p.tickets--}
 let x=Math.random()*WHEEL.reduce((a,w)=>a+w.w,0),idx=0;for(let i=0;i<WHEEL.length;i++){x-=WHEEL[i].w;if(x<=0){idx=i;break}}
 const w=WHEEL[idx],r={...w.r};if(r.c)r.c=Math.round(r.c*evMul());give(p,r);if(r.inv)for(const id in r.inv)p.inv[id]=Math.min(99,(p.inv[id]||0)+r.inv[id]);
 sp.n++;dirty();bump(c.name,'spin',1,ws);send(ws,{t:'spin_r',idx,r});send(ws,spinInfo(p));sendMe(ws)}

// =====================================================================  starter missions
const STARTER=[{k:'feed',n:1,r:{c:30},t:'Feed a dog'},{k:'pet',n:5,r:{c:30},t:'Pet your dogs 5 times'},{k:'buy',n:1,r:{tk:1},t:'Buy something in the Shop'},{k:'place',n:1,r:{c:40},t:'Place a furniture item'},
 {k:'train',n:1,r:{c:40},t:'Train a trick'},{k:'caps',n:1,r:{g:2},t:'Open a capsule'},{k:'wish',n:1,r:{c:50},t:'Grant a dog wish'},{k:'parkjoin',n:1,r:{c:40},t:'Visit the dog park'},
 {k:'visit',n:1,r:{c:40},t:"Visit a friend's house"},{k:'mp',n:1,r:{g:3},t:'Play an online mini-game'},
 // v7.2: the "explorer" missions - one-time, they walk a player through the v7 features and pay a few free gems (the only free gem source besides achievements, the daily wheel and the 7th login day)
 {k:'hatch',n:1,r:{g:2},t:'Hatch your first dog egg'},{k:'breed',n:1,r:{g:3},t:'Breed two dogs in the Nursery'},{k:'show',n:1,r:{g:2},t:'Enter a dog in the Dog Show'},
 {k:'vote',n:1,r:{g:1,c:50},t:'Vote in a Dog Show'},{k:'buydog',n:1,r:{g:2,c:100},t:'Adopt a dog from the Pet Shop'},{k:'dm',n:1,r:{g:1},t:'Send a private message to a friend'}];
const WN=72;          // "what's new" version: a player who has not seen it (p.wn<WN) gets the one-time tour; new players learn it in the tutorial instead
const STBONUS={g:10,tk:3,c:300};
const starterList=p=>STARTER.map((s,i)=>({i,t:s.t,goal:s.n,prog:Math.min(s.n,st(p,s.k)),r:s.r,claimed:!!p.starter.claimed[i]}));
const starterMsg=p=>{const l=starterList(p);return{t:'starter',list:l,bonus:{ready:l.every(x=>x.claimed),claimed:!!p.starter.bonus,r:STBONUS}}};
const starterReady=p=>{const l=starterList(p);return l.filter(x=>x.prog>=x.goal&&!x.claimed).length+(l.every(x=>x.claimed)&&!p.starter.bonus?1:0)};

// =====================================================================  house level
function houseInfo(p){const have=new Set(p.items.map(i=>i.type)),hl=hlOf(p),nx=C.HOUSE[hl+1];
 return{t:'house_info',hl,items:p.items.length,maxItems:maxItems(p),maxDogs:maxDogs(p),next:nx?{items:nx.items,dogs:nx.dogs,c:nx.c,g:nx.g,lvl:nx.lvl}:null,cozy:cozy(p),
  sets:C.SETS.map(s=>({id:s.id,have:s.need.filter(i=>have.has(i)).length,total:s.need.length,done:s.need.every(i=>have.has(i))})),perks:[...perks(p)],likes:p.likes|0}}
function houseUp(ws,c){const p=player(c.name),hl=hlOf(p),nx=C.HOUSE[hl+1];if(!nx)return toast(ws,'บ้านของคุณอัปเกรดสูงสุดแล้ว!');
 if(lvl(p)<nx.lvl)return toast(ws,'ต้องเลเวล '+nx.lvl+' ก่อนถึงจะอัปเกรดได้');if(p.coins<nx.c||p.gems<(nx.g||0))return toast(ws,'Coins/Gems ไม่พอสำหรับอัปเกรด');
 p.coins-=nx.c;p.gems-=nx.g||0;p.hl=hl+1;dirty();toast(ws,'🏡 อัปเกรดบ้านเป็นระดับ '+(p.hl+1)+' แล้ว!');send(ws,houseInfo(p));sendMe(ws);X.sendHouse(ws,c.name)}

// =====================================================================  mailbox
const mailUnread=p=>p.mail.filter(m=>!m.seen||(m.r&&!m.claimed)).length;
function mailTo(name,row){const p=db.players[name];if(!p||isGuestName(name))return;row=Object.assign({id:rid(),t:Date.now(),seen:false,claimed:false},row);p.mail.push(row);
 if(p.mail.length>30){const i=p.mail.findIndex(m=>!m.r||m.claimed);p.mail.splice(i>=0?i:0,1)}dirty();const ow=wsOf(name);if(ow){send(ow,{t:'ev',k:'mail',from:row.from||''});sendMe(ow)}}
const mailMsg=p=>{for(const m of p.mail)if(!m.r)m.seen=true;return{t:'mail',list:p.mail.slice().reverse().slice(0,30)}};

// =====================================================================  party
function partyStart(ws,c){const p=player(c.name),now=Date.now();if(c.view!=c.name)return toast(ws,'ต้องอยู่ที่บ้านตัวเองถึงจะจัดปาร์ตี้ได้');
 if(p.party&&p.party.until>now)return toast(ws,'กำลังมีปาร์ตี้อยู่แล้ว 🎉');
 if(p.party&&now-p.party.last<20*60e3)return toast(ws,'จัดปาร์ตี้ได้อีกครั้งในอีก '+Math.ceil((20*60e3-(now-p.party.last))/60e3)+' นาที');
 if(p.coins<40)return toast(ws,'Coins ไม่พอ (ค่าจัดปาร์ตี้ 40💰)');
 p.coins-=40;p.party={until:now+5*60e3,last:now,guests:[],ended:false};dirty();bump(c.name,'party',1,ws);
 toView(c.name,{t:'party',owner:c.name,ms:5*60e3});sendMe(ws);
 for(const f of p.friends){const ow=wsOf(f);if(ow)send(ow,{t:'party_inv',from:c.name,ms:5*60e3})}}
function onVisit(ws,c,owner){const o=db.players[owner];if(!o||owner==c.name)return;const now=Date.now(),p=player(c.name);
 if(o.party&&o.party.until>now&&!o.party.guests.includes(c.name)&&o.party.guests.length<12){o.party.guests.push(c.name);
  if(!p.pg||p.pg.date!=today())p.pg={date:today(),n:0};if(p.pg.n<5){p.pg.n++;give(p,{c:8});send(ws,{t:'toast',m:'🎉 ร่วมปาร์ตี้ของ '+owner+' +8💰'})}
  if(o.party.guests.length<=10){o.coins+=2}bump(c.name,'partyguest',1,ws);const ow=wsOf(owner);if(ow){send(ow,{t:'ev',k:'guest',n:c.name});sendMe(ow)};dirty();sendMe(ws)}
 if(!wsOf(owner)&&!c.guest){const day=today();if(!o.mail.some(m=>m.k=='visit'&&m.from==c.name&&m.day==day))mailTo(owner,{k:'visit',from:c.name,day})}}

// =====================================================================  guestbook, likes, weekly contest
const gbCool=new Map();
const gbMsg=(p,owner,me)=>({t:'gb',owner,list:p.gb.slice(-30).reverse(),likes:p.likes|0,liked:!!(me.likedDay==today()&&me.liked&&me.liked[owner]),cozy:cozy(p).score});
const weekId=()=>Math.floor((Math.floor(Date.now()/DAY)+3)/7),weekEnd=wk=>(wk*7-3)*DAY+7*DAY;
function contestTop(wk){return Object.entries(db.players).filter(([n,p])=>p.lk&&p.lk.wk==wk&&p.lk.n>0&&!isGuestName(n)).map(([n,p])=>({n,v:p.lk.n,cozy:cozy(p).score})).sort((a,b)=>b.v-a.v||b.cozy-a.cozy||(a.n<b.n?-1:1))}
const PRIZES=[{g:10,c:500},{g:5,c:300},{g:3,c:150}];
function contestRoll(){const wk=weekId(),cur=db.contest;if(cur&&cur.wk==wk)return cur;const prev=cur?cur.wk:wk-1,top=contestTop(prev).slice(0,3);
 top.forEach((e,i)=>mailTo(e.n,{k:'contest',rank:i+1,r:PRIZES[i],from:''}));db.contest={wk,prev:top.map(e=>({n:e.n,v:e.v}))};dirty();return db.contest}
setInterval(safe('contest',contestRoll),36e5);
function doLike(ws,c,m){const owner=m.owner;if(!own(db.players,owner)||c.view!==owner||owner==c.name||c.guest)return;const p=player(c.name),o=db.players[owner];
 if(p.likedDay!=today()){p.liked={};p.likedDay=today();p.likedN=0}
 if(p.liked[owner])return toast(ws,'วันนี้กดหัวใจบ้านนี้ไปแล้ว ❤️');if(p.likedN>=10)return toast(ws,'วันนี้กดหัวใจครบ 10 ครั้งแล้ว');
 p.liked[owner]=1;p.likedN++;o.likes=(o.likes|0)+1;const wk=weekId();if(!o.lk||o.lk.wk!=wk)o.lk={wk,n:0};o.lk.n++;
 if(p.likedN<=5){give(p,{c:2})}dirty();bump(c.name,'like',1,ws);
 const day=today();if(!o.mail.some(x=>x.k=='like'&&x.from==c.name&&x.day==day))mailTo(owner,{k:'like',from:c.name,day});
 toView(owner,{t:'fx',e:'❤️',x:rnd(200,600),y:rnd(260,380)});toView(owner,gbMsg(o,owner,p));sendMe(ws)}
function doPost(ws,c,m){const owner=m.owner;if(!own(db.players,owner)||c.view!==owner||owner==c.name||c.guest)return toast(ws,'ต้องไปเยี่ยมบ้านเพื่อนก่อนถึงจะเขียนสมุดเยี่ยมได้');
 const txt=clean(m.text,60);if(!txt)return;const now=Date.now(),k=c.name+'|'+owner;if(now-(gbCool.get(k)||0)<5*60e3)return toast(ws,'เขียนได้อีกครั้งในอีกสักครู่นะ ✍️');
 gbCool.set(k,now);if(gbCool.size>5000)for(const [kk,v] of gbCool)if(now-v>3e5)gbCool.delete(kk);
 const p=player(c.name),o=db.players[owner];o.gb.push({id:rid(),n:c.name,m:txt,t:now});if(o.gb.length>30)o.gb.shift();
 if(!p.gbr||p.gbr.date!=today())p.gbr={date:today(),n:0};if(p.gbr.n++<3)give(p,{c:3});dirty();
 const day=today();if(!o.mail.some(x=>x.k=='gb'&&x.from==c.name&&x.day==day))mailTo(owner,{k:'gb',from:c.name,day,text:txt.slice(0,40)});
 toView(owner,gbMsg(o,owner,p));sendMe(ws)}

// =====================================================================  message routing
const HND=Object.create(null);
HND.fetch=(ws,c,m)=>doFetch(ws,c,m);
HND.spin_get=(ws,c)=>send(ws,spinInfo(player(c.name)));
HND.spin=(ws,c)=>doSpin(ws,c);
HND.starter=(ws,c)=>send(ws,starterMsg(player(c.name)));
HND.starter_claim=(ws,c,m)=>{const p=player(c.name),l=starterList(p),e=l[m.i|0];if(!e||e.claimed||e.prog<e.goal)return;p.starter.claimed[e.i]=true;give(p,e.r);dirty();toast(ws,'🎁 +'+X.rtxt(e.r));send(ws,starterMsg(p));sendMe(ws)};
HND.starter_bonus=(ws,c)=>{const p=player(c.name);if(p.starter.bonus||!starterList(p).every(x=>x.claimed))return;p.starter.bonus=true;give(p,STBONUS);dirty();toast(ws,'🎉 ภารกิจมือใหม่ครบแล้ว! +'+X.rtxt(STBONUS));send(ws,starterMsg(p));sendMe(ws)};
HND.tutorial=(ws,c)=>{const p=player(c.name);p.tut=1;p.wn=WN;dirty()};
HND.whatsnew=(ws,c)=>{const p=player(c.name);if((p.wn|0)<WN){p.wn=WN;dirty()}};
HND.house_info=(ws,c)=>send(ws,houseInfo(player(c.name)));
HND.house_up=(ws,c)=>houseUp(ws,c);
HND.party_start=(ws,c)=>partyStart(ws,c);
HND.gb_get=(ws,c,m)=>{if(!own(db.players,m.owner))return;send(ws,gbMsg(db.players[m.owner],m.owner,player(c.name)))};
HND.gb_post=(ws,c,m)=>doPost(ws,c,m);
HND.gb_del=(ws,c,m)=>{const p=player(c.name),i=p.gb.findIndex(x=>x.id===m.id);if(i<0)return;p.gb.splice(i,1);dirty();send(ws,gbMsg(p,c.name,p))};
HND.like=(ws,c,m)=>doLike(ws,c,m);
HND.contest_get=(ws,c)=>{const cr=contestRoll(),wk=weekId(),top=contestTop(wk),i=top.findIndex(e=>e.n==c.name);send(ws,{t:'contest',wk,ends:weekEnd(wk),top:top.slice(0,10),prev:cr.prev||[],me:{v:i>=0?top[i].v:0,rank:i+1},prizes:PRIZES})};
HND.mail_get=(ws,c)=>{const p=player(c.name);send(ws,mailMsg(p));sendMe(ws)};
HND.mail_claim=(ws,c,m)=>{const p=player(c.name),e=p.mail.find(x=>x.id===m.id);if(!e||!e.r||e.claimed)return;e.claimed=true;e.seen=true;give(p,e.r);dirty();toast(ws,'🎁 +'+X.rtxt(e.r));send(ws,mailMsg(p));sendMe(ws)};
HND.mail_claim_all=(ws,c)=>{const p=player(c.name),tot={};for(const e of p.mail)if(e.r&&!e.claimed){e.claimed=true;e.seen=true;for(const k in e.r)tot[k]=(tot[k]||0)+e.r[k]}
 if(Object.keys(tot).length){give(p,tot);dirty();toast(ws,'🎁 +'+X.rtxt(tot))}send(ws,mailMsg(p));sendMe(ws)};
HND.mail_del=(ws,c,m)=>{const p=player(c.name),i=p.mail.findIndex(x=>x.id===m.id);if(i<0||(p.mail[i].r&&!p.mail[i].claimed))return;p.mail.splice(i,1);dirty();send(ws,mailMsg(p));sendMe(ws)};
HND.mail_clear=(ws,c)=>{const p=player(c.name);p.mail=p.mail.filter(x=>x.r&&!x.claimed);dirty();send(ws,mailMsg(p));sendMe(ws)};
if(process.env.CD_TEST){      // test-only helpers; never enabled unless the server is started with CD_TEST=1
 HND.dbg_wn=(ws,c)=>{const p=player(c.name);p.tut=1;p.wn=0;dirty();sendMe(ws)};      // pretend to be a player from before v7.2 (finished the tutorial, never saw the tour)
 HND.dbg_give=(ws,c,m)=>{const p=player(c.name);p.xp+=m.xp|0;p.coins+=m.c|0;p.gems+=m.g|0;p.tickets+=m.tk|0;dirty();sendMe(ws)};
 HND.dbg_mail=(ws,c,m)=>mailTo(c.name,{k:'sys',from:'',r:{c:+m.c||50}});
 HND.dbg_week=(ws,c,m)=>{const o=db.players[m.n];if(o)o.lk={wk:weekId()-1,n:+m.v||1};db.contest.wk=weekId()-1;dirty();contestRoll();send(ws,{t:'toast',m:'dbg week'})};
}
function handle(ws,c,m){const f=HND[m.t];if(!f)return false;f(ws,c,m);return true}

function onEnter(ws,c,p){const now=Date.now();for(const d of p.dogs){if(d.fetch){d.fetch=null;d.until=0}if(d.wish&&d.wish.exp<now)d.wish=null;if(d.wishNext===undefined||d.wishNext>now+4e5)d.wishNext=now+rnd(...WFIRST)*1000}
 contestRoll();if(p.party&&p.party.until<=now)p.party.ended=true;
 const e=C.season();if(e)send(ws,{t:'ev',k:'season',id:e})}
const onClose=()=>{};
const meExtra=p=>{const now=Date.now(),cz=cozy(p);return{hl:hlOf(p),maxItems:maxItems(p),maxDogs:maxDogs(p),mail:mailUnread(p),tut:!!p.tut,cozy:cz.score,sets:cz.sets,perks:[...perks(p)],likes:p.likes|0,ev:C.season()||null,
 party:p.party&&p.party.until>now?p.party.until-now:0,spinFree:!(p.spin&&p.spin.date==today()&&p.spin.n>0),stReady:starterReady(p),stDone:p.starter.bonus&&starterList(p).every(x=>x.claimed)?1:0,wn:p.wn|0}};

return{handle,onEnter,onClose,onVisit,wish,perks,cozy,setsDone,meExtra,mailTo,contestRoll,houseInfo,evMul,WHEEL,STARTER};
};
