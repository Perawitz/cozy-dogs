// Cozy Dogs - online features (all server-authoritative):
//   1. Park      shared outdoor map. Server simulates every dog's position (speed-capped), a physics ball, and spawning treats (10 Hz tick).
//   2. Trading   two-player trade window: offers are validated, both sides confirm, then the swap is executed atomically.
//   3. Community weekly goal: everybody's actions add to one shared progress bar, milestones pay out to contributors.
'use strict';
module.exports=function(X){
const {db,conns,send,sendAll,wsOf,player,give,rtxt,clamp,rnd,pick,today,lvl,sendMe,pushDogs,pushHouse,C,BR,dirty,bump,realName,maxDogs}=X;
const toast=(ws,m)=>send(ws,{t:'toast',m});
const own=(o,k)=>typeof k=='string'&&Object.prototype.hasOwnProperty.call(o,k), cat=(T,k)=>own(T,k)?T[k]:undefined;
const safe=(name,f)=>(...a)=>{try{return f(...a)}catch(e){console.error('['+name+']',e&&e.stack||e)}};

// =====================================================================  PARK
const PK={x0:34,y0:262,x1:766,y1:530,WALK:120,RUN:205,MAX:40,TICK:100,CAP:250};
const park={m:new Map(),ball:{x:400,y:430,vx:0,vy:0,mv:false},items:[],last:Date.now(),nextSpawn:0,full:0,id:1,tr:null,nextTr:Date.now()+20000,fb:null,nextFb:Date.now()+30000};
const TREATS=[{k:'cookie',w:58,r:{c:3}},{k:'bone',w:26,r:{c:5}},{k:'meat',w:12,r:{c:8}},{k:'star',w:4,r:{g:1}}];
const EMOTES=['👋','❤️','😂','🎉','😴','❓','😋','👍'],POSES=['sit','sleep','bark'];
const bcast=(o,except)=>{for(const w of park.m.keys())if(w!==except)send(w,o)};
function dogOf(p,id){return p.dogs.find(d=>d.id===id)||p.dogs.find(d=>!d.away)||p.dogs[0]}
function entry(m){const p=player(m.n),d=dogOf(p,m.dog);if(!d)return null;m.dog=d.id;
 return{n:m.n,lvl:lvl(p),breed:d.breed,variant:d.variant,acc:d.acc,dn:d.name,av:p.av||null,tricks:d.tricks||[],x:+m.x.toFixed(1),y:+m.y.toFixed(1),tx:m.tx|0,ty:m.ty|0,st:m.st,run:m.run?1:0,pose:m.pose||''}}
function parkJoin(ws,c,dogId){
 if(park.m.has(ws)) return; if(c.mp) return toast(ws,'จบเกมออนไลน์ก่อนถึงจะเข้าสวนได้'); if(park.m.size>=PK.MAX) return toast(ws,'สวนสาธารณะเต็มแล้ว (สูงสุด '+PK.MAX+' คน)');
 const p=player(c.name);if(!p.dogs.length) return;
 const m={n:c.name,dog:dogId||null,x:rnd(360,440),y:rnd(480,515),vx:0,vy:0,tx:0,ty:0,st:'idle',run:false,pose:null,lastEmote:0,lastTrick:0,lastKick:0};m.tx=m.x;m.ty=m.y;
 const e=entry(m);if(!e) return;
 park.m.set(ws,m);c.park=m;park.last=Date.now();
 send(ws,{t:'park_init',me:c.name,members:[...park.m.values()].map(entry).filter(Boolean),ball:{x:+park.ball.x.toFixed(1),y:+park.ball.y.toFixed(1),vx:park.ball.vx|0,vy:park.ball.vy|0},items:park.items.map(i=>({id:i.id,x:i.x,y:i.y,k:i.k})),tr:park.tr?1:0,fb:park.fb&&Date.now()<park.fb.exp?{x:park.fb.x,y:park.fb.y,ms:Math.max(0,park.fb.t-Date.now())}:null,cfg:{x0:PK.x0,y0:PK.y0,x1:PK.x1,y1:PK.y1,walk:PK.WALK,run:PK.RUN,tick:PK.TICK,emotes:EMOTES}});
 bcast({t:'park_in',m:e},ws);bump(c.name,'parkjoin',1,ws);X.sendPlayers();
}
function parkLeave(ws,quiet){const m=park.m.get(ws);if(!m)return;park.m.delete(ws);const c=conns.get(ws);if(c)c.park=null;bcast({t:'park_out',n:m.n});if(!quiet)X.sendPlayers()}
function spawnTreat(now){let x=0,y=0;for(let i=0;i<8;i++){x=rnd(PK.x0+30,PK.x1-30);y=rnd(PK.y0+20,PK.y1-10);if(!(x>520&&x<700&&y>380&&y<480))break}   // keep treats off the pond
 let r=Math.random()*100,k='cookie';for(const t of TREATS){r-=t.w;if(r<=0){k=t.k;break}}
 const it={id:park.id++,x:Math.round(x),y:Math.round(y),k,exp:now+45000};park.items.push(it);bcast({t:'park_item',add:{id:it.id,x:it.x,y:it.y,k:it.k}})}
function pickup(ws,m,it){const c=conns.get(ws);if(!c)return;const p=player(m.n),T=TREATS.find(t=>t.k==it.k).r;
 if(!p.park||p.park.date!=today())p.park={date:today(),coins:0};
 const r={...T};if(r.c){r.c=clamp(Math.round(r.c*(C.season()?1.25:1)),0,Math.max(0,PK.CAP-p.park.coins));p.park.coins+=r.c}
 give(p,r);dirty();bump(m.n,'park',1,ws);
 bcast({t:'park_item',del:it.id,by:m.n,r,k:it.k});sendMe(ws)}
function parkTick(){
 if(!park.m.size){park.last=Date.now();return}
 const now=Date.now(),dt=Math.min(.25,(now-park.last)/1000);park.last=now;
 const moved=new Set();
 for(const [ws,m] of park.m){
  if(m.x!=m.tx||m.y!=m.ty){const dx=m.tx-m.x,dy=m.ty-m.y,d=Math.hypot(dx,dy),sp=m.run?PK.RUN:PK.WALK,step=sp*dt;
   if(d<=step){m.x=m.tx;m.y=m.ty;m.st='idle';m.vx=m.vy=0}else{m.x+=dx/d*step;m.y+=dy/d*step;m.vx=dx/d*sp;m.vy=dy/d*sp;m.st=m.run?'run':'walk'}
   moved.add(m)}}
 // ---- ball (shared physics)
 const b=park.ball;let bChanged=false;
 for(const [ws,m] of park.m){const dx=b.x-m.x,dy=b.y-m.y,d=Math.hypot(dx,dy);
  if(d<30){const nx=d>.5?dx/d:1,ny=d>.5?dy/d:0;
   if(m.st=='walk'||m.st=='run'){const sp=m.run?330:230;b.vx=nx*sp+m.vx*.35;b.vy=ny*sp+m.vy*.35;b.mv=true;bChanged=true;if(now-m.lastKick>700){m.lastKick=now;bump(m.n,'kick',1,ws)}}
   else if(d<22){b.x=m.x+nx*24;b.y=m.y+ny*24;bChanged=true}}}
 if(b.mv){b.x+=b.vx*dt;b.y+=b.vy*dt;if(b.x<PK.x0){b.x=PK.x0;b.vx=Math.abs(b.vx)*.72}if(b.x>PK.x1){b.x=PK.x1;b.vx=-Math.abs(b.vx)*.72}
  if(b.y<PK.y0){b.y=PK.y0;b.vy=Math.abs(b.vy)*.72}if(b.y>PK.y1){b.y=PK.y1;b.vy=-Math.abs(b.vy)*.72}
  const f=Math.pow(.1,dt);b.vx*=f;b.vy*=f;if(Math.hypot(b.vx,b.vy)<9){b.vx=b.vy=0;b.mv=false}bChanged=true}
 // ---- treats: spawn, expire, collect (the first dog to touch one gets it)
 const want=Math.min(10,4+Math.floor(park.m.size/2));
 if(now>=park.nextSpawn&&park.items.length<want){spawnTreat(now);park.nextSpawn=now+rnd(3500,7000)/Math.max(1,Math.min(2,park.m.size/3))}
 for(let i=park.items.length-1;i>=0;i--){const it=park.items[i];
  if(now>it.exp){park.items.splice(i,1);bcast({t:'park_item',del:it.id});continue}
  for(const [ws,m] of park.m){if(Math.hypot(m.x-it.x,m.y-it.y)<30){park.items.splice(i,1);pickup(ws,m,it);break}}}
 // ---- treasure hunt + frisbee events (shared, first come first served)
 if(!park.tr&&now>=park.nextTr){let x=0,y=0;for(let i=0;i<10;i++){x=rnd(PK.x0+40,PK.x1-40);y=rnd(PK.y0+30,PK.y1-20);if(!(x>520&&x<700&&y>380&&y<480))break}
  park.tr={x:Math.round(x),y:Math.round(y),exp:now+4*60e3};bcast({t:'park_fx',n:'',k:'tr_new'})}
 if(park.tr&&now>park.tr.exp){park.tr=null;park.nextTr=now+rnd(30,70)*1000;bcast({t:'park_fx',n:'',k:'tr_gone'})}
 if(!park.fb&&now>=park.nextFb){const x=rnd(PK.x0+50,PK.x1-50),y=rnd(PK.y0+30,PK.y1-30);park.fb={x:Math.round(x),y:Math.round(y),t:now+1700,exp:now+9000};bcast({t:'park_fx',n:'',k:'fb_new',x:park.fb.x,y:park.fb.y,ms:1700})}
 if(park.fb&&now>=park.fb.t){let got=null;for(const [ws,m] of park.m)if(Math.hypot(m.x-park.fb.x,m.y-park.fb.y)<42){got=[ws,m];break}
  if(got){const [ws,m]=got,p=player(m.n);if(!p.park||p.park.date!=today())p.park={date:today(),coins:0};
   const c=clamp(Math.round(12*(C.season()?1.25:1)),0,Math.max(0,PK.CAP-p.park.coins));p.park.coins+=c;give(p,{c});dirty();bump(m.n,'park',2,ws);bump(m.n,'frisbee',1,ws);sendMe(ws);
   bcast({t:'park_fx',n:m.n,k:'fb_got',c});park.fb=null;park.nextFb=now+rnd(40,80)*1000}
  else if(now>park.fb.exp){park.fb=null;park.nextFb=now+rnd(30,60)*1000;bcast({t:'park_fx',n:'',k:'fb_gone'})}}
 // ---- snapshot (10 Hz, only what changed; a full one every 3 s so clients self-correct)
 const full=now-park.full>3000;if(full)park.full=now;
 if(!full&&!moved.size&&!bChanged) return;
 const src=full?[...park.m.values()]:[...moved];
 bcast({t:'park_s',m:src.map(m=>[m.n,+m.x.toFixed(1),+m.y.toFixed(1),m.tx|0,m.ty|0,m.st,m.run?1:0,m.pose||'']),b:(bChanged||full)?[+b.x.toFixed(1),+b.y.toFixed(1),b.vx|0,b.vy|0]:null,full:full?1:0,ts:now});
}
setInterval(safe('parkTick',parkTick),PK.TICK);

const LOOT=[{w:48,k:'dirt'},{w:25,k:'coin'},{w:10,k:'bone'},{w:7,k:'boot'},{w:7,k:'cookie'},{w:2,k:'gem'},{w:1,k:'ticket'}];
function digResult(ws,pm,px,py){const c=conns.get(ws);if(!c)return;const p=player(pm.n),now=Date.now();if(!p.dg||p.dg.date!=today())p.dg={date:today(),n:0};
 bump(pm.n,'dig',1,ws);const out={t:'park_dig_r',k:'dirt',hint:null,found:false};
 if(park.tr){const d=Math.hypot(px-park.tr.x,py-park.tr.y);
  if(d<=50){const r={c:100,g:2,tk:1};give(p,r);dirty();bump(pm.n,'treasure',1,ws);park.tr=null;park.nextTr=now+rnd(40,80)*1000;out.found=true;out.k='treasure';out.r=r;bcast({t:'park_fx',n:pm.n,k:'tr_found'});send(ws,out);sendMe(ws);return}
  out.hint=d<120?'hot':d<240?'warm':d<400?'cool':'cold'}
 if(p.dg.n<25){p.dg.n++;let x=Math.random()*100,k='dirt';for(const l of LOOT){x-=l.w;if(x<=0){k=l.k;break}}
  if(k=='coin'){const c2=Math.round(rnd(2,6)*(C.season()?1.25:1));give(p,{c:c2});out.r={c:c2}}
  else if(k=='gem'){give(p,{g:1});out.r={g:1}}else if(k=='ticket'){give(p,{tk:1});out.r={tk:1}}
  else if(k=='bone'||k=='cookie'){p.inv[k]=Math.min(99,(p.inv[k]||0)+1);out.r={item:k}}
  out.k=k;dirty()}
 send(ws,out);sendMe(ws)}
function parkMsg(ws,c,m){const pm=park.m.get(ws),now=Date.now();
 switch(m.t){
  case 'park_join':parkJoin(ws,c,m.dog?String(m.dog):null);return true;
  case 'park_leave':parkLeave(ws);return true;
  case 'park_move':{if(!pm)return true;const x=+m.x,y=+m.y;if(!isFinite(x)||!isFinite(y))return true;
   pm.tx=clamp(x,PK.x0,PK.x1);pm.ty=clamp(y,PK.y0,PK.y1);pm.run=!!m.run;if(pm.pose){pm.pose=null}return true}
  case 'park_pose':{if(!pm)return true;const p=m.p==null?null:String(m.p);if(p&&!POSES.includes(p))return true;pm.pose=p;if(p){pm.tx=pm.x;pm.ty=pm.y;pm.st='idle'}bcast({t:'park_fx',n:pm.n,k:'pose',v:p||''});return true}
  case 'park_emote':{if(!pm||now-pm.lastEmote<700||!EMOTES.includes(m.e))return true;pm.lastEmote=now;bcast({t:'park_fx',n:pm.n,k:'emote',v:m.e});return true}
  case 'park_trick':{if(!pm||now-pm.lastTrick<2600)return true;const d=dogOf(player(pm.n),pm.dog);if(!d||!(d.tricks||[]).includes(String(m.k)))return true;
   pm.lastTrick=now;pm.tx=pm.x;pm.ty=pm.y;pm.st='idle';pm.pose=null;bcast({t:'park_fx',n:pm.n,k:'trick',v:String(m.k)});return true}
  case 'park_dig':{if(!pm||now-(pm.lastDig||0)<4000)return true;pm.lastDig=now;pm.tx=pm.x;pm.ty=pm.y;pm.st='idle';pm.pose=null;bcast({t:'park_fx',n:pm.n,k:'dig'});
   const px=pm.x,py=pm.y;setTimeout(()=>{if(park.m.get(ws)!==pm)return;try{digResult(ws,pm,px,py)}catch(e){console.error('[dig]',e)}},1200);return true}
  case 'park_dbg_tr':if(process.env.CD_TEST&&pm){park.tr={x:Math.round(pm.x),y:Math.round(pm.y),exp:now+60000};bcast({t:'park_fx',n:'',k:'tr_new'});return true}return false;
  case 'park_dbg_fb':if(process.env.CD_TEST&&pm){park.fb={x:Math.round(Math.min(PK.x1-40,pm.x+(+m.dx||0))),y:Math.round(pm.y),t:now+(+m.ms||300),exp:now+9000};bcast({t:'park_fx',n:'',k:'fb_new',x:park.fb.x,y:park.fb.y,ms:park.fb.t-now});return true}return false;
  case 'park_dog':{if(!pm)return true;const p=player(pm.n);if(!p.dogs.some(d=>d.id===m.dog))return true;pm.dog=String(m.dog);const e=entry(pm);if(e)bcast({t:'park_in',m:e});return true}
 }return false}

// =====================================================================  COMMUNITY GOAL
const GOALS=[
 {id:'pet',ts:['pet'],n:'Pet dogs together',e:'🤚',per:60},{id:'park',ts:['park'],n:'Collect park treats',e:'🦴',per:45},
 {id:'mg',ts:['mg'],n:'Play mini games',e:'🎮',per:18},{id:'social',ts:['visit','gift'],n:'Visit & gift friends',e:'🎁',per:14},
 {id:'caps',ts:['caps'],n:'Open capsules',e:'🎰',per:12},{id:'feed',ts:['feed'],n:'Feed dogs',e:'🍖',per:40},{id:'trade',ts:['trade'],n:'Complete trades',e:'🔁',per:3},
 {id:'mp',ts:['mp'],n:'Play online games',e:'🏁',per:10},{id:'wish',ts:['wish'],n:'Grant dog wishes',e:'💭',per:20},{id:'dig',ts:['dig'],n:'Dig up the park',e:'⛏️',per:25}];
const TIERS=[{at:.34,r:{c:100}},{at:.67,r:{c:200,tk:1}},{at:1,r:{g:8,c:300,tk:2}}],MINC=3,DAYCAP=300,DAY=864e5;
const weekId=()=>Math.floor((Math.floor(Date.now()/DAY)+3)/7),weekEnd=wk=>(wk*7-3)*DAY+7*DAY;
function ensureGoal(){const wk=weekId();if(db.goal&&db.goal.wk==wk)return db.goal;
 const def=GOALS.find(x=>x.id==process.env.CD_GOAL)||GOALS[wk%GOALS.length],act=Object.values(db.players).filter(p=>p.seen&&Date.now()-p.seen<7*DAY).length;
 db.goal={wk,id:def.id,target:Math.round(clamp(def.per*Math.max(2,act),def.per*2,def.per*60)/5)*5,total:0,contrib:{},claimed:{}};dirty();return db.goal}
let goalDirty=false;
function goalAdd(name,type,n){const g=ensureGoal(),def=GOALS.find(x=>x.id==g.id);if(!def||!def.ts.includes(type))return;
 const p=player(name);if(!p.gd||p.gd.date!=today())p.gd={date:today(),n:0};if(p.gd.n>=DAYCAP)return;n=Math.min(n,DAYCAP-p.gd.n);p.gd.n+=n;
 const before=g.total/g.target;g.total+=n;g.contrib[name]=(g.contrib[name]||0)+n;dirty();goalDirty=true;
 const after=g.total/g.target;for(const t of TIERS)if(before<t.at&&after>=t.at)sendAll({t:'notify',m:'🌍 เป้าหมายร่วม '+Math.round(t.at*100)+'% สำเร็จแล้ว! ไปรับรางวัลที่ปุ่ม Community'})}
function goalMsg(name){const g=ensureGoal(),def=GOALS.find(x=>x.id==g.id)||GOALS[0],me=g.contrib[name]||0,cl=g.claimed[name]||[];
 return{t:'goal',id:g.id,n:def.n,e:def.e,target:g.target,total:g.total,me,min:MINC,ends:weekEnd(g.wk),
  tiers:TIERS.map((t,i)=>({at:t.at,r:t.r,ok:g.total>=g.target*t.at,claimed:cl.includes(i),can:g.total>=g.target*t.at&&me>=MINC&&!cl.includes(i)})),
  top:Object.entries(g.contrib).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([n,v])=>({n,v}))}}
setInterval(safe('goalcast',()=>{if(!goalDirty)return;goalDirty=false;for(const [w,c] of conns)send(w,goalMsg(c.name))}),3000);
function goalMsgs(ws,c,m){
 if(m.t=='goal'){send(ws,goalMsg(c.name));return true}
 if(m.t=='goal_claim'){const g=ensureGoal(),i=m.i|0,t=TIERS[i];if(!t)return true;const cl=g.claimed[c.name]||(g.claimed[c.name]=[]);
  if(cl.includes(i)||g.total<g.target*t.at||(g.contrib[c.name]||0)<MINC) return toast(ws,'ยังรับรางวัลนี้ไม่ได้ (ต้องช่วยอย่างน้อย '+MINC+' ครั้ง)'),true;
  cl.push(i);give(player(c.name),t.r);dirty();toast(ws,'🌍 +'+rtxt(t.r));send(ws,goalMsg(c.name));sendMe(ws);return true}
 return false}

// =====================================================================  TRADING
const trades=new Map(),invites=new Map();let tid=1;
const CAPS=id=>own(C.FOOD,id)?99:own(C.ACC,id)?1:10;
const known=id=>own(C.ITEMS,id)||own(C.FOOD,id)||own(C.ACC,id);
const placedN=(p,id)=>p.items.filter(i=>i.type==id).length;
function avail(p){const o={};for(const id of Object.keys(p.inv)){if(!known(id))continue;let n=+p.inv[id]||0;if(own(C.ITEMS,id))n-=placedN(p,id);else if(own(C.ACC,id))n-=p.dogs.filter(d=>d.acc==id).length;if(n>0)o[id]=n}return o}
const tradableDogs=p=>p.dogs.length>1?p.dogs.filter(d=>!d.fav).map(d=>({id:d.id,breed:d.breed,variant:d.variant,name:d.name,acc:d.acc,away:!!d.away,bond:d.bond|0})):[];
const dogCard=d=>({id:d.id,breed:d.breed,variant:d.variant,name:d.name,bond:d.bond|0,pers:d.pers});
function sideOf(t,ws){return t.a.ws===ws?t.a:t.b.ws===ws?t.b:null}
function view(t,me){const o=me===t.a?t.b:t.a,mp=player(me.name),op=player(o.name),dd=(s,p)=>s.off.dogs.map(id=>p.dogs.find(d=>d.id===id)).filter(Boolean).map(dogCard);
 return{t:'trade',id:t.id,with:o.name,wlvl:lvl(op),ver:t.ver,mine:{inv:me.off.inv,coins:me.off.coins,dogs:dd(me,mp)},theirs:{inv:o.off.inv,coins:o.off.coins,dogs:dd(o,op)},
  myOk:me.ok,theirOk:o.ok,av:avail(mp),coins:mp.coins,dogs:tradableDogs(mp)}}
const pushTrade=t=>{send(t.a.ws,view(t,t.a));send(t.b.ws,view(t,t.b))};
function endTrade(t,why){trades.delete(t.id);for(const s of [t.a,t.b]){const c=conns.get(s.ws);if(c&&c.trade==t.id)c.trade=null;if(s.ws.readyState==1&&why)send(s.ws,{t:'trade_end',ok:false,why})}}
function validOffer(p,off){const av=avail(p);for(const id in off.inv)if((off.inv[id]|0)>(own(av,id)?av[id]:0))return'ไอเทมในกระเป๋าไม่พอ';
 if(off.coins>p.coins)return'Coins ไม่พอ';
 const mineIds=tradableDogs(p).map(d=>d.id);for(const id of off.dogs)if(!mineIds.includes(id))return'แลกหมาตัวนี้ไม่ได้ (ตัวโปรด/ตัวสุดท้ายแลกไม่ได้)';
 if(off.dogs.length>=p.dogs.length)return'ต้องเหลือหมาอย่างน้อย 1 ตัว';return null}
function execTrade(t){
 const A=t.a,B=t.b,pa=player(A.name),pb=player(B.name);
 for(const [s,p] of [[A,pa],[B,pb]]){const e=validOffer(p,s.off);if(e){A.ok=B.ok=false;t.ver++;pushTrade(t);return send(s.ws,{t:'toast',m:'⚠️ '+e})&&0}}
 for(const [from,to,pf,pt] of [[A,B,pa,pb],[B,A,pb,pa]]){for(const id in from.off.inv){if((pt.inv[id]||0)+from.off.inv[id]>CAPS(id)){A.ok=B.ok=false;t.ver++;pushTrade(t);const nm=(cat(C.ITEMS,id)||cat(C.FOOD,id)||cat(C.ACC,id)||{n:id}).n;
   toast(A.ws,'⚠️ '+to.name+' ถือ '+nm+' ได้ไม่เกิน '+CAPS(id)+' ชิ้น');toast(B.ws,'⚠️ '+to.name+' ถือ '+nm+' ได้ไม่เกิน '+CAPS(id)+' ชิ้น');return}}}
 for(const [from,to,pf,pt] of [[A,B,pa,pb],[B,A,pb,pa]]){
  for(const id in from.off.inv){const n=from.off.inv[id]|0;pf.inv[id]-=n;if(pf.inv[id]<=0)delete pf.inv[id];pt.inv[id]=(pt.inv[id]||0)+n}
  pf.coins-=from.off.coins;pt.coins+=from.off.coins;
  for(const id of from.off.dogs){const i=pf.dogs.findIndex(d=>d.id==id);if(i<0)continue;const [d]=pf.dogs.splice(i,1);d.acc=null;d.fav=false;d.away=pt.dogs.filter(x=>!x.away).length>=maxDogs(pt);pt.dogs.push(d)}
  if(!pf.dogs.some(d=>!d.away)&&pf.dogs.length)pf.dogs[0].away=false}
 dirty();
 for(const s of [A,B]){const q=player(s.name);if(!q.tr||q.tr.date!=today())q.tr={date:today(),n:0};if(q.tr.n<5){q.tr.n++;bump(s.name,'trade',1,s.ws)}   // max 5 counted trades/day (anti-farming)
  send(s.ws,{t:'trade_end',ok:true,with:s===A?B.name:A.name});const c=conns.get(s.ws);if(c)c.trade=null;sendMe(s.ws);pushHouse(s.name)}
 trades.delete(t.id);console.log('trade',A.name,'<->',B.name)}
function sanitize(m,p){const inv={};let n=0;for(const [id,v] of Object.entries(m.inv&&typeof m.inv=='object'&&!Array.isArray(m.inv)?m.inv:{})){if(++n>12)break;if(!known(id))continue;const q=Math.floor(+v);if(q>0)inv[id]=Math.min(q,99)}
 const coins=clamp(Math.floor(+m.coins)||0,0,1e6),dogs=(Array.isArray(m.dogs)?m.dogs:[]).slice(0,3).map(String).filter((d,i,a)=>a.indexOf(d)==i);return{inv,coins,dogs}}
function tradeMsg(ws,c,m){const now=Date.now();
 switch(m.t){
  case 'trade_req':{if(c.guest)return toast(ws,'Guest แลกของไม่ได้ — สมัครบัญชีก่อนนะ'),true;const n=realName(m.name),ow=n&&wsOf(n),oc=ow&&conns.get(ow);
   if(!oc||n==c.name)return toast(ws,'ผู้เล่นคนนั้นไม่ได้ออนไลน์'),true;if(oc.guest)return toast(ws,'Guest แลกของไม่ได้'),true;
   if(c.mp||c.game||oc.mp||oc.game)return toast(ws,'ตอนนี้ผู้เล่นคนใดคนหนึ่งกำลังเล่นเกมอยู่ ลองใหม่ทีหลังนะ'),true;
   if(c.trade||oc.trade)return toast(ws,'มีคนกำลังแลกของอยู่'),true;if(now-(c.lastReq||0)<3000)return true;c.lastReq=now;
   for(const [k,v] of invites)if(now-v.t>60000)invites.delete(k);const iv=invites.get(n);if(iv&&now-iv.t<30000&&iv.from!=c.name)return toast(ws,n+' กำลังมีคำขออื่นอยู่'),true;
   invites.set(n,{from:c.name,t:now});send(ow,{t:'trade_inv',from:c.name,lvl:lvl(player(c.name))});toast(ws,'📨 ส่งคำขอแลกของถึง '+n+' แล้ว');return true}
  case 'trade_ans':{const iv=invites.get(c.name);if(!iv||iv.from!=m.from||now-iv.t>45000)return true;invites.delete(c.name);const ow=wsOf(iv.from),oc=ow&&conns.get(ow);
   if(!m.ok){if(ow)toast(ow,c.name+' ปฏิเสธการแลกของ');return true}
   if(!oc||c.trade||oc.trade||c.guest)return toast(ws,'แลกของไม่ได้ในตอนนี้'),true;
   const t={id:tid++,ver:0,a:{ws:ow,name:oc.name,off:{inv:{},coins:0,dogs:[]},ok:false},b:{ws,name:c.name,off:{inv:{},coins:0,dogs:[]},ok:false}};
   trades.set(t.id,t);c.trade=oc.trade=t.id;pushTrade(t);return true}
  case 'trade_set':{const t=trades.get(c.trade);if(!t)return true;const me=sideOf(t,ws);if(!me)return true;const off=sanitize(m,player(c.name)),e=validOffer(player(c.name),off);
   if(e){toast(ws,'⚠️ '+e);send(ws,view(t,me));return true}
   me.off=off;t.a.ok=t.b.ok=false;t.ver++;pushTrade(t);return true}
  case 'trade_ok':{const t=trades.get(c.trade);if(!t)return true;const me=sideOf(t,ws);if(!me||(m.ver|0)!==t.ver){if(t&&me)send(ws,view(t,me));return true}
   if(m.v){const em=o=>!Object.keys(o.inv).length&&!o.coins&&!o.dogs.length,oth=me===t.a?t.b:t.a;if(em(me.off)&&em(oth.off))return toast(ws,'ยังไม่มีอะไรให้แลก'),true}
   me.ok=!!m.v;if(t.a.ok&&t.b.ok)execTrade(t);else pushTrade(t);return true}
  case 'trade_cancel':{const t=trades.get(c.trade);if(!t)return true;const me=sideOf(t,ws),o=me===t.a?t.b:t.a;endTrade(t);send(ws,{t:'trade_end',ok:false,why:'ยกเลิกการแลกของแล้ว'});send(o.ws,{t:'trade_end',ok:false,why:c.name+' ยกเลิกการแลกของ'});return true}
 }return false}

// =====================================================================  glue
function handle(ws,c,m){
 if(m.t=='ping'){send(ws,{t:'pong',c:+m.c||0});return true}
 if(m.t.startsWith('park_'))return parkMsg(ws,c,m);
 if(m.t.startsWith('goal'))return goalMsgs(ws,c,m);
 if(m.t.startsWith('trade_'))return tradeMsg(ws,c,m);
 return false}
function onClose(ws){parkLeave(ws,true);for(const t of [...trades.values()]){const s=sideOf(t,ws);if(s){const o=s===t.a?t.b:t.a;endTrade(t);send(o.ws,{t:'trade_end',ok:false,why:s.name+' ออกจากเกมแล้ว'})}}}
function touch(name){player(name).seen=Date.now()}
// a player changed their look: tell everybody in the park (the owner's own client included)
function avChanged(ws,name,av){if(park.m.has(ws))bcast({t:'park_av',n:name,av})}
return{handle,onClose,goalAdd,goalMsg,touch,avChanged,leavePark:parkLeave,inPark:ws=>park.m.has(ws)};
};
