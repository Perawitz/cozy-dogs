// Cozy Dogs v7 - the "dog life" module (all server-authoritative):
//   NURSERY    two grown-up dogs -> an egg -> a puppy. Genes: every dog carries two breed alleles; purebred (same twice) or mixed (พันทาง, two different).
//              A child takes one allele from each parent (+ a small mutation chance), may inherit / mutate cute traits, and hatches after a few hours.
//   PET SHOP   premium cute breeds (coins or gems, small daily stock) + 5 daily offers of ordinary breeds; "sell to shop" for any dog.
//   MARKET     players list dogs (escrow), others buy them; 5% fee; unsold dogs come back after 48 h.
// Messages (client -> server): nur_get nur_pair nur_hatch nur_fast · pet_shop pet_buy pet_sell · mk_get mk_put mk_buy mk_cancel
'use strict';
const TRD=require('./traits'),PREM=require('./premium'),BREEDS=require('./breeds');
module.exports=function(X){
const {db,conns,send,wsOf,player,clamp,rnd,pick,rid,today,sendMe,pushHouse,pub,rt,BR,dirty,own,safe,maxDogs,hlOf,isGuestName,mkDog,F,bump,addXp,GK,lvl}=X;
const toast=(ws,m)=>send(ws,{t:'toast',m});
const HK=Math.max(1,+process.env.CD_HATCH||1);                 // hatching / resting speed-up for demos & tests (CD_HATCH=600: a 1-hour egg takes 6 s)
const MAXDOGS=100,RORD={C:0,R:1,E:2,L:3,M:4},RLET=['C','R','E','L','M'];
const HATCH_H={C:.5,R:1,E:2,L:4,M:6},BREED_COST={C:80,R:150,E:300,L:600,M:1000},REST_H=12;
const VARS=['Snow','Chocolate','Golden','Galaxy','Rainbow'];
const MK={fee:.05,max:5,hours:48,lvl:3,c:[50,99999],g:[1,9999]};
const DAILY_PRICE={C:150,R:420,E:1000,L:2600},SHOP_CAP=8;
const num=(v,lo,hi)=>{v=Math.floor(+v);return Number.isFinite(v)&&v>=lo&&v<=hi?v:0};
const str=v=>typeof v=='string'?v.slice(0,40):'';
const premOf=id=>own(BR,id)&&BR[id][7]||null;                  // price object of a premium breed, or null
const nestMax=p=>2+hlOf(p);
const cfg=()=>({hatchH:HATCH_H,cost:BREED_COST,restH:REST_H,hk:HK,fee:MK.fee,mkMax:MK.max,mkH:MK.hours,mkLvl:MK.lvl,priceC:MK.c,priceG:MK.g,maxDogs:MAXDOGS,shopCap:SHOP_CAP});
const stageOf=d=>TRD.stageOf(d.born,Date.now(),GK);
const homeCount=p=>p.dogs.filter(d=>!d.away).length;
const dogsAll=(ws,p)=>send(ws,{t:'dogs_all',dogs:p.dogs.map(x=>pub(rt(x),Date.now()))});
const small=d=>({id:d.id,breed:d.breed,mix:d.mix||null,ms:d.ms|0,tr:TRD.cleanTraits(d.tr),variant:d.variant,name:d.name,pers:d.pers,bond:d.bond|0,born:d.born,acc:d.acc||null,tricks:(d.tricks||[]).length});
function addDog(p,d){d.away=homeCount(p)>=maxDogs(p);if(!d.away)rt(d);p.dogs.push(d);dirty();return d}
function runtimeFree(d){for(const k of ['fx','fy','tx','ty','t0','dur','until','state','trick','wish','wishNext','fetch','nt','el'])delete d[k];return d}
const refresh=(ws,c,p)=>{sendMe(ws);dogsAll(ws,p);pushHouse(c.name)};

// =====================================================================  NURSERY & GENES
const pick2=a=>a[Math.random()<.5?0:1];
function geneKid(a,b,bond){
 const ga=TRD.alleles(a),gb=TRD.alleles(b);let x=pick2(ga),y=pick2(gb),mut=false;
 const top=Math.max(...[...ga,...gb].map(g=>RORD[BR[g][2]]));
 if(Math.random()<.04){const tier=Math.min(4,top+1),pool=BREEDS.filter(r=>RORD[r[2]]==tier);if(pool.length){const m=pick(pool)[0];if(Math.random()<.5)x=m;else y=m;mut=true}}      // rare "mutation": a breed one rarity step above the parents
 let breed=x,mix=null,ms=0;
 if(x!=y){const rx=RORD[BR[x][2]],ry=RORD[BR[y][2]];breed=Math.random()<clamp(.5+.06*(rx-ry),.25,.75)?x:y;mix=breed==x?y:x;ms=Math.floor(Math.random()*8)}      // dominant allele decides the name / rarity; the other shows in the look
 let variant=pick([a.variant,b.variant]);if(Math.random()<.07)variant=pick(VARS);
 let tr=[];for(const t of [...TRD.cleanTraits(a.tr),...TRD.cleanTraits(b.tr)])if(!tr.includes(t)&&Math.random()<.5)tr.push(t);      // each parent trait: 50% inherited
 const chance=(mix?.30:.12)+(bond>=80?.10:bond>=50?.05:0);                                                                       // new trait: mixed breeds & close pairs are luckier
 if(Math.random()<chance){const t=TRD.rollTrait(Math.random,bond>=80?[45,40,15]:[60,32,8],tr);if(t)tr.push(t)}
 tr.sort((p,q)=>TRD.TR[q].tier-TRD.TR[p].tier);tr=tr.slice(0,2);
 const rar=RLET[Math.max(RORD[BR[x][2]],RORD[BR[y][2]])];
 return{breed,mix,ms,variant,tr,mut,rar}}
const nurMsg=(p,now)=>({t:'nur',now,max:nestMax(p),eggs:p.nest.map(e=>({id:e.id,rar:e.rar,left:Math.max(0,e.at-now),total:e.at-e.t0,pa:e.pa,pb:e.pb,cm:e.cm}))});
const parentCard=d=>({n:d.name,b:d.breed,m:d.mix||null,v:d.variant});
function pairErr(p,a,b,now){
 if(!a||!b||a===b)return'เลือกหมา 2 ตัวที่ต่างกันก่อนนะ';
 for(const d of [a,b]){
  if(premOf(d.breed))return d.name+' เป็นสายพันธุ์พรีเมียม ผสมพันธุ์ไม่ได้';
  if(TRD.stageOf(d.born,now,GK)<3)return d.name+' ยังโตไม่เต็มวัย (ผสมพันธุ์ได้เมื่อเป็นหมาโต)';
  if(d.rest>now){const ms=d.rest-now;return d.name+' ยังพักอยู่ (อีก '+(ms<36e5?Math.max(1,Math.ceil(ms/6e4))+' นาที':Math.ceil(ms/36e5)+' ชม.')+')'}}
 if(p.nest.length>=nestMax(p))return'รังไข่เต็มแล้ว (อัปเกรดบ้านเพื่อเพิ่มช่อง)';
 return null}
function nurPair(ws,c,m){
 const p=player(c.name),now=Date.now(),a=p.dogs.find(d=>d.id===String(m.a)),b=p.dogs.find(d=>d.id===String(m.b)),e1=pairErr(p,a,b,now);if(e1)return toast(ws,e1);
 const rar=RLET[Math.max(RORD[BR[a.breed][2]],RORD[BR[b.breed][2]],a.mix?RORD[BR[a.mix][2]]:0,b.mix?RORD[BR[b.mix][2]]:0)],cost=BREED_COST[rar];
 if(p.coins<cost)return toast(ws,'Coins ไม่พอ (ค่าผสมพันธุ์ '+cost+'💰)');
 const bond=((a.bond|0)+(b.bond|0))/2,kid=geneKid(a,b,bond),dur=HATCH_H[kid.rar]*36e5/HK*(1-.25*bond/100);
 p.coins-=cost;a.rest=b.rest=now+REST_H*36e5/HK;
 p.nest.push({id:rid(),t0:now,at:now+dur,rar:kid.rar,kid,pa:parentCard(a),pb:parentCard(b),cm:Math.round(bond)});
 bump(c.name,'breed',1,ws);dirty();send(ws,{t:'nur_ok'});send(ws,nurMsg(p,now));refresh(ws,c,p)}
function nurHatch(ws,c,m){
 const p=player(c.name),now=Date.now(),i=p.nest.findIndex(e=>e.id===String(m.id));if(i<0)return;const e=p.nest[i];
 if(e.at>now)return toast(ws,'ไข่ยังไม่ฟัก รออีกนิดนะ 🥚');
 if(p.dogs.length>=MAXDOGS)return toast(ws,'ที่เก็บหมาเต็มแล้ว ('+MAXDOGS+' ตัว) — ขายหรือปล่อยบางตัวก่อนนะ');
 const k=e.kid,d=mkDog(k.breed,k.variant);if(k.mix){d.mix=k.mix;d.ms=k.ms|0}d.tr=TRD.cleanTraits(k.tr);d.bond=Math.round(((e.cm|0)||0)/10);
 p.nest.splice(i,1);addDog(p,d);addXp(p,10,ws);bump(c.name,'hatch',1,ws);
 send(ws,{t:'nur_hatched',dog:pub(rt(d),now),r:BR[d.breed][2],mut:!!k.mut,mixed:!!k.mix,pa:e.pa,pb:e.pb});send(ws,nurMsg(p,now));refresh(ws,c,p)}
function nurFast(ws,c,m){
 const p=player(c.name),now=Date.now(),e=p.nest.find(e=>e.id===String(m.id));if(!e||e.at<=now)return;
 const gems=clamp(Math.ceil((e.at-now)*HK/9e5),1,24);      // 1 gem per 15 minutes left (real clock), at most 24
 if(p.gems<gems)return toast(ws,'Gems ไม่พอ (ต้องใช้ '+gems+'💎)');
 p.gems-=gems;e.at=now;dirty();send(ws,nurMsg(p,now));sendMe(ws);toast(ws,'⚡ ไข่ฟักเร็วขึ้น! ใช้ '+gems+'💎')}

// =====================================================================  PET SHOP
function shopDay(){
 const t=today();if(db.shop&&db.shop.date==t)return db.shop;
 const prem={};for(const r of PREM){const pr=r[7];prem[r[0]]=pr.c?5:pr.g<=70?3:pr.g<=120?2:1}
 const offers=[],used=new Set();
 for(const [rar,left] of [['C',3],['C',3],['R',2],['E',2],['L',1]]){const pool=BREEDS.filter(b=>b[2]==rar&&!used.has(b[0]));const b=pick(pool.length?pool:BREEDS.filter(b=>b[2]==rar));used.add(b[0]);
  const v=Math.random()<.2?pick(VARS):'Normal';offers.push({id:b[0],v,c:Math.round(DAILY_PRICE[rar]*(v=='Normal'?1:1.4)),left})}
 db.shop={date:t,prem,offers};dirty();return db.shop}
const shopMsg=p=>{const S=shopDay();if(!p.sb||p.sb.d!=today())p.sb={d:today(),n:0};
 return{t:'pet_shop',date:S.date,prem:PREM.map(r=>({id:r[0],c:r[7].c||0,g:r[7].g||0,left:S.prem[r[0]]|0,max:r[7].c?5:r[7].g<=70?3:r[7].g<=120?2:1})),offers:S.offers.map((o,i)=>({i,id:o.id,v:o.v,c:o.c,left:o.left})),bought:p.sb.n,cap:SHOP_CAP}};
const stockMsg=()=>{const S=shopDay();return{t:'pet_stock',prem:S.prem,offers:S.offers.map(o=>o.left)}};
function petBuy(ws,c,m){
 const p=player(c.name),S=shopDay(),now=Date.now();if(!p.sb||p.sb.d!=today())p.sb={d:today(),n:0};
 if(p.sb.n>=SHOP_CAP)return toast(ws,'วันนี้ซื้อหมาจากร้านครบ '+SHOP_CAP+' ตัวแล้ว พรุ่งนี้มาใหม่นะ');
 if(p.dogs.length>=MAXDOGS)return toast(ws,'ที่เก็บหมาเต็มแล้ว ('+MAXDOGS+' ตัว)');
 let breed,variant='Normal',price;
 if(m.k=='p'){const id=str(m.id);price=premOf(id);if(!price||!own(S.prem,id))return;if(!(S.prem[id]>0))return toast(ws,'ขายหมดแล้ววันนี้ 😢 พรุ่งนี้มีของใหม่!');breed=id}
 else if(m.k=='d'){const o=Number.isInteger(m.i)?S.offers[m.i]:null;if(!o)return;if(!(o.left>0))return toast(ws,'ขายหมดแล้ว 😢');breed=o.id;variant=o.v;price={c:o.c}}
 else return;
 if(price.c?p.coins<price.c:p.gems<price.g)return toast(ws,price.c?'Coins ไม่พอ':'Gems ไม่พอ');
 if(price.c)p.coins-=price.c;else p.gems-=price.g;
 if(m.k=='p')S.prem[breed]--;else S.offers[m.i].left--;
 p.sb.n++;const d=addDog(p,mkDog(breed,variant));bump(c.name,'buydog',1,ws);dirty();
 send(ws,{t:'pet_bought',dog:pub(rt(d),now)});send(ws,shopMsg(p));for(const [w] of conns)if(w!==ws)send(w,stockMsg());refresh(ws,c,p)}
function petSell(ws,c,m){
 const p=player(c.name),now=Date.now(),i=p.dogs.findIndex(d=>d.id===String(m.id));if(i<0)return;const d=p.dogs[i];
 if(c.view!=c.name)return toast(ws,'ทำได้เฉพาะตอนอยู่บ้านตัวเองนะ');
 if(d.fav)return toast(ws,'⭐ ขายตัวโปรดไม่ได้ (เอาดาวออกก่อน)');
 if(p.dogs.length<=1||(!d.away&&homeCount(p)<=1))return toast(ws,'ต้องมีหมาอยู่บ้านอย่างน้อย 1 ตัวนะ');
 const v=TRD.sellValue(d,BR[d.breed][2],premOf(d.breed),now,GK);p.dogs.splice(i,1);p.coins+=v;bump(c.name,'sell',1,ws);dirty();
 send(ws,{t:'pet_sold',name:d.name,c:v});refresh(ws,c,p)}

// =====================================================================  PLAYER MARKET
const market=()=>db.market??=[];
const mkRow=(e,now,me)=>({id:e.id,s:e.s,d:small(e.d),c:e.c|0,g:e.g|0,left:Math.max(0,e.exp-now),mine:e.s==me});
function mkMsg(c){const now=Date.now();return{t:'mk',fee:MK.fee,list:market().slice().sort((a,b)=>b.t-a.t).slice(0,80).map(e=>mkRow(e,now,c.name))}}
function backToOwner(e,why){const p=db.players[e.s];if(!p)return;const d=runtimeFree(e.d);d.away=homeCount(p)>=maxDogs(p);p.dogs.push(d);dirty();
 F.mailTo(e.s,{k:why,from:'',dn:d.name});const w=wsOf(e.s);if(w){const c=conns.get(w);sendMe(w);dogsAll(w,p);if(c)pushHouse(c.name);send(w,mkMsg(c))}}
function mkSweep(){const now=Date.now(),L=market();let n=0;for(let i=L.length-1;i>=0;i--)if(L[i].exp<=now){const e=L.splice(i,1)[0];backToOwner(e,'mk_back');n++}if(n)dirty()}
setInterval(safe('market',mkSweep),3e5);
function mkPut(ws,c,m){
 if(c.guest)return toast(ws,'ผู้เล่น Guest ลงขายไม่ได้ — สมัครสมาชิกก่อนนะ');
 mkSweep();      // expired listings must not count against the 5-listing limit
 const p=player(c.name),L=market();if(lvl(p)<MK.lvl)return toast(ws,'ต้องเลเวล '+MK.lvl+' ขึ้นไปถึงจะลงขายได้');
 if(c.view!=c.name)return toast(ws,'ทำได้เฉพาะตอนอยู่บ้านตัวเองนะ');
 const i=p.dogs.findIndex(d=>d.id===String(m.dog));if(i<0)return;const d=p.dogs[i];
 if(d.fav)return toast(ws,'⭐ ขายตัวโปรดไม่ได้ (เอาดาวออกก่อน)');
 if(p.dogs.length<=1||(!d.away&&homeCount(p)<=1))return toast(ws,'ต้องมีหมาอยู่บ้านอย่างน้อย 1 ตัวนะ');
 if(L.filter(e=>e.s==c.name).length>=MK.max)return toast(ws,'ลงขายได้พร้อมกันไม่เกิน '+MK.max+' ตัว');
 const cc=num(m.c,MK.c[0],MK.c[1]),gg=num(m.g,MK.g[0],MK.g[1]);if(!!cc==!!gg)return toast(ws,'ตั้งราคาเป็นเหรียญ หรือ เพชร อย่างใดอย่างหนึ่ง (เหรียญ '+MK.c[0]+'-'+MK.c[1]+' / เพชร '+MK.g[0]+'-'+MK.g[1]+')');
 p.dogs.splice(i,1);const now=Date.now();L.push({id:rid(),s:c.name,d:runtimeFree(d),c:cc,g:gg,t:now,exp:now+MK.hours*36e5/HK});dirty();
 toast(ws,'🏷️ ลงขาย '+d.name+' แล้ว (ค้างได้ '+MK.hours+' ชม.)');send(ws,mkMsg(c));refresh(ws,c,p)}
function mkBuy(ws,c,m){
 if(c.guest)return toast(ws,'ผู้เล่น Guest ซื้อจากตลาดไม่ได้ — สมัครสมาชิกก่อนนะ');
 mkSweep();      // an expired listing that nobody swept yet can not be bought any more (its dog goes home first)
 const p=player(c.name),L=market(),i=L.findIndex(e=>e.id===String(m.id));if(i<0){toast(ws,'ตัวนี้ถูกซื้อไปแล้ว หรือหมดเวลา');return send(ws,mkMsg(c))}
 const e=L[i];if(e.s==c.name)return toast(ws,'ซื้อของตัวเองไม่ได้นะ');
 if(p.dogs.length>=MAXDOGS)return toast(ws,'ที่เก็บหมาเต็มแล้ว ('+MAXDOGS+' ตัว)');
 if(e.c?p.coins<e.c:p.gems<e.g)return toast(ws,e.c?'Coins ไม่พอ':'Gems ไม่พอ');
 if(e.c)p.coins-=e.c;else p.gems-=e.g;L.splice(i,1);
 const net=Math.max(1,Math.round((e.c||e.g)*(1-MK.fee))),d=runtimeFree(e.d);d.fav=false;addDog(p,d);
 F.mailTo(e.s,{k:'mk_sold',from:c.name,dn:d.name,r:e.c?{c:net}:{g:net}});bump(e.s,'sell',1);bump(c.name,'buydog',1,ws);dirty();
 send(ws,{t:'pet_bought',dog:pub(rt(d),Date.now()),mk:1});send(ws,mkMsg(c));refresh(ws,c,p)}
function mkCancel(ws,c,m){
 const p=player(c.name),L=market(),i=L.findIndex(e=>e.id===String(m.id)&&e.s==c.name);if(i<0)return;const e=L.splice(i,1)[0];
 const d=runtimeFree(e.d);addDog(p,d);dirty();toast(ws,'↩️ เอา '+d.name+' กลับมาแล้ว');send(ws,mkMsg(c));refresh(ws,c,p)}

// =====================================================================  routing, badges, "egg is ready" notices
const HND={
 nur_get:(ws,c)=>send(ws,nurMsg(player(c.name),Date.now())),nur_pair:nurPair,nur_hatch:nurHatch,nur_fast:nurFast,
 pet_shop:(ws,c)=>send(ws,shopMsg(player(c.name))),pet_buy:petBuy,pet_sell:petSell,
 mk_get:(ws,c)=>{mkSweep();send(ws,mkMsg(c))},mk_put:mkPut,mk_buy:mkBuy,mk_cancel:mkCancel};
function handle(ws,c,m){const f=own(HND,m.t)?HND[m.t]:null;if(!f)return false;f(ws,c,m);return true}
setInterval(safe('eggs',()=>{const now=Date.now();for(const [ws,c] of conns){const p=db.players[c.name];if(!p||!p.nest)continue;
 for(const e of p.nest)if(e.at<=now&&!e.nt){e.nt=1;dirty();send(ws,{t:'notify',m:'🥚 ไข่ฟักแล้ว! ไปรับน้องหมาที่บ้านเลี้ยงลูกได้เลย'});send(ws,nurMsg(p,now));sendMe(ws)}}}),10000);
const meExtra=p=>{const now=Date.now();return{eggs:(p.nest||[]).filter(e=>e.at<=now).length,eggsAll:(p.nest||[]).length}};
return{handle,meExtra,cfg,shopDay,nestMax,geneKid,market,mkSweep,HATCH_H,BREED_COST,MK,premOf,MAXDOGS};
};
