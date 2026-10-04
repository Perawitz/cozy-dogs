// Cozy Dogs - online mini-game arcade (server-authoritative real-time rooms):
//   race  Dog Race        2-4 players, alternate left/right taps, 10 Hz progress broadcast
//   grab  Bone Grab       2 players, reaction duel (first to 3), latency-compensated
//   duel  Breed Duel      2-4 players, 5 quiz rounds with a speed bonus
//   rush  Treat Frenzy    2-4 players, 24 s of treats popping up on a shared field - first tap wins it, avoid the boots
//   odd   Odd Pup Out     2-4 players, 6 rounds of 'spot the different dog' in a growing grid
// A lobby waits ~8 s for other players; if nobody joins, bots fill the room so the game is always playable (and pays half).
'use strict';
module.exports=function(X){
const {db,conns,send,player,clamp,rnd,pick,today,lvl,sendMe,addXp,BREEDS,dirty,bump,safe,own,F,S}=X;
const toast=(ws,m)=>send(ws,{t:'toast',m});
const GAMES={race:{max:4,fill:3},grab:{max:2,fill:2},duel:{max:4,fill:3},rush:{max:4,fill:3},odd:{max:4,fill:3}};
const RUSHMS=24000,ODDN=6,ODDMS=9000;
const WAIT=+process.env.CD_MPWAIT||8000, TICK=100, CAP=600, STEP=1.8, MINTAP=65, QMS=10000, QN=5;
const lobbies={race:null,grab:null,duel:null,rush:null,odd:null}, rooms=new Map();let nextId=1;
const BOTNAMES=['Pudding','Mochi','Biscuit','Nova','Waffle','Pepper','Bean','Maple','Coco','Teddy','Miso','Ollie'];
const RAR={C:0,R:1,E:2,L:3,M:4};

// ---------------------------------------------------------------- quiz bank (bilingual)
const TRIVIA=[
 [['How many toes do dogs have on each front paw?','สุนัขมีกี่นิ้วที่อุ้งเท้าหน้าแต่ละข้าง?'],['3','3'],['4','4'],['5','5'],['6','6'],2],
 [['Which sense is a dog\'s strongest?','ประสาทสัมผัสใดของสุนัขที่เก่งที่สุด?'],['Smell','การดมกลิ่น'],['Sight','การมองเห็น'],['Taste','การรับรส'],['Touch','การสัมผัส'],0],
 [['Which breed is the fastest runner?','พันธุ์ใดวิ่งเร็วที่สุด?'],['Greyhound','เกรย์ฮาวนด์'],['Pug','ปั๊ก'],['Corgi','คอร์กี้'],['Bulldog','บูลด็อก'],0],
 [['Puppies lose these at about 4-6 months:','ลูกสุนัขจะผลัดสิ่งนี้ตอนอายุ 4-6 เดือน:'],['Baby teeth','ฟันน้ำนม'],['Whiskers','หนวด'],['Claws','กรงเล็บ'],['Tail','หาง'],0],
 [['Dalmatian puppies are born with what coat?','ลูกดัลเมเชียนเกิดมามีขนแบบไหน?'],['Plain white','ขาวล้วน'],['Black spots','จุดดำ'],['Brown','น้ำตาล'],['Striped','ลายทาง'],0],
 [['Which food is dangerous for dogs?','อาหารชนิดใดอันตรายต่อสุนัข?'],['Chocolate','ช็อกโกแลต'],['Plain rice','ข้าวสวย'],['Carrot','แครอท'],['Cooked chicken','ไก่ต้มสุก'],0],
 [['How many teeth does an adult dog have?','สุนัขโตเต็มวัยมีฟันกี่ซี่?'],['32','32'],['42','42'],['28','28'],['50','50'],1],
 [['Which breed has a blue-black tongue?','พันธุ์ใดมีลิ้นสีน้ำเงินเข้ม?'],['Chow Chow','เชาเชา'],['Poodle','พุดเดิ้ล'],['Beagle','บีเกิ้ล'],['Husky','ฮัสกี้'],0],
 [['The Shiba Inu comes from which country?','ชิบะอินุมาจากประเทศใด?'],['Japan','ญี่ปุ่น'],['Germany','เยอรมนี'],['Brazil','บราซิล'],['Egypt','อียิปต์'],0],
 [['The Corgi originally comes from:','คอร์กี้มีต้นกำเนิดจาก:'],['Wales','เวลส์'],['Italy','อิตาลี'],['Mexico','เม็กซิโก'],['India','อินเดีย'],0],
 [['Dachshunds were bred to hunt which animal?','ดัชชุนด์ถูกเพาะพันธุ์เพื่อล่าสัตว์ชนิดใด?'],['Badgers','แบดเจอร์'],['Deer','กวาง'],['Birds','นก'],['Fish','ปลา'],0],
 [['Which breed is famous for Alpine rescue?','พันธุ์ใดโด่งดังเรื่องช่วยชีวิตในเทือกเขาแอลป์?'],['Saint Bernard','เซนต์เบอร์นาร์ด'],['Chihuahua','ชิวาวา'],['Pug','ปั๊ก'],['Maltese','มอลทีส'],0],
 [['How long is a typical dog pregnancy?','สุนัขตั้งท้องประมาณกี่วัน?'],['About 30 days','ประมาณ 30 วัน'],['About 63 days','ประมาณ 63 วัน'],['About 90 days','ประมาณ 90 วัน'],['About 120 days','ประมาณ 120 วัน'],1],
 [['Which breed was bred to herd sheep?','พันธุ์ใดถูกเพาะพันธุ์เพื่อต้อนแกะ?'],['Border Collie','บอร์เดอร์ คอลลี่'],['Pug','ปั๊ก'],['Dachshund','ดัชชุนด์'],['Shih Tzu','ชิห์สุ'],0],
 [['A group of puppies born together is a:','ลูกสุนัขที่เกิดพร้อมกันเรียกว่า:'],['Litter','คอก (litter)'],['Pack','ฝูง'],['Herd','โขลง'],['Flock','ฝูงนก'],0],
 [['Dogs cool down mostly by:','สุนัขระบายความร้อนส่วนใหญ่ด้วยการ:'],['Panting','หอบ'],['Sweating a lot','เหงื่อออกทั้งตัว'],['Shivering','สั่น'],['Barking','เห่า'],0],
 [['The Pug originally comes from:','ปั๊กมีต้นกำเนิดจาก:'],['China','จีน'],['Canada','แคนาดา'],['Peru','เปรู'],['Norway','นอร์เวย์'],0],
 [['Adult dogs sleep about how many hours a day?','สุนัขโตเต็มวัยนอนวันละประมาณกี่ชั่วโมง?'],['4','4'],['8','8'],['12-14','12-14'],['20','20'],2],
 [['The famous loyal dog Hachiko was which breed?','ฮาจิโกะสุนัขผู้ซื่อสัตย์ที่โด่งดังเป็นพันธุ์ใด?'],['Akita','อากิตะ'],['Poodle','พุดเดิ้ล'],['Boxer','บ็อกเซอร์'],['Beagle','บีเกิ้ล'],0],
 [['Which of these is a hairless breed?','ข้อใดเป็นพันธุ์ไร้ขน?'],['Chinese Crested','ไชนีส เครสเต็ด'],['Samoyed','ซามอยด์'],['Husky','ฮัสกี้'],['Corgi','คอร์กี้'],0],
 [['What helps a dog\'s wet nose?','จมูกที่เปียกช่วยสุนัขเรื่องอะไร?'],['Catching scents','จับกลิ่น'],['Hearing','การได้ยิน'],['Seeing in the dark','มองในที่มืด'],['Running faster','วิ่งเร็วขึ้น'],0]];
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
function mkQuestions(n){const out=[],tv=shuffle(TRIVIA),kinds=shuffle(['img','img','rare','rar','tv']);let ti=0;
 for(const k of kinds.slice(0,n)){
  if(k=='img'){const b=pick(BREEDS),opts=shuffle([b,...shuffle(BREEDS.filter(x=>x!==b)).slice(0,3)]);out.push({k,breed:b[0],v:pick(['Normal','Normal','Snow','Chocolate','Golden']),opts:opts.map(o=>o[0]),a:opts.indexOf(b)})}
  else if(k=='rare'){const hi=Math.random()<.65,pool=shuffle(['C','R','E','L','M']).slice(0,4),opts=pool.map(r=>pick(BREEDS.filter(b=>b[2]==r)));
   const best=opts.reduce((m,b)=>(hi?RAR[b[2]]>RAR[m[2]]:RAR[b[2]]<RAR[m[2]])?b:m);out.push({k,hi,opts:opts.map(o=>o[0]),a:opts.indexOf(best)})}
  else if(k=='rar'){const b=pick(BREEDS),r=b[2],others=shuffle(['C','R','E','L','M'].filter(x=>x!=r)).slice(0,3),opts=shuffle([r,...others]);out.push({k,breed:b[0],v:'Normal',opts,a:opts.indexOf(r)})}
  else{const T=tv[ti++%tv.length],corr=T[T.length-1],opts=shuffle(T.slice(1,5).map((o,i)=>({o,i}))),a=opts.findIndex(x=>x.i==corr);out.push({k:'tv',q:T[0],opts:opts.map(x=>x.o),a})}}
 return shuffle(out)}

// ---------------------------------------------------------------- lobbies
const humans=r=>r.pl.filter(p=>!p.bot&&!p.left);
function dogFor(p,id){const d=p.dogs.find(x=>x.id===id&&!x.away)||p.dogs.find(x=>!x.away)||p.dogs[0];return d}
function mkPl(ws,c,dogId){const p=player(c.name),d=dogFor(p,dogId);return{ws,name:c.name,bot:false,lvl:lvl(p),breed:d.breed,variant:d.variant,acc:d.acc,dn:d.name,score:0,pos:0,fin:0,left:false,rtt:120,samples:[]}}
function mkBot(used){let n;do n=pick(BOTNAMES);while(used.has(n)&&used.size<BOTNAMES.length);used.add(n);const b=pick(BREEDS.filter(x=>x[2]=='C'||x[2]=='R'||Math.random()<.2));
 return{ws:null,name:n,bot:true,lvl:Math.floor(rnd(2,9)),breed:b[0],variant:pick(['Normal','Normal','Snow','Golden']),acc:pick([null,null,'bow','bandana','glasses']),dn:n,score:0,pos:0,fin:0,left:false,rate:rnd(5.4,7.6),frac:0}}
const lobbyMsg=L=>({t:'mp_lobby',g:L.g,n:L.pl.length,max:GAMES[L.g].max,ms:Math.max(0,L.fillAt-Date.now()),names:L.pl.map(p=>p.name)});
function find(ws,c,m){if(typeof m.g!='string'||!own(GAMES,m.g))return;const now=Date.now();
 if(c.mp)return toast(ws,'คุณอยู่ในเกมออนไลน์อยู่แล้ว');if(c.game||c.trade)return toast(ws,'จบเกมหรือการแลกของที่ทำอยู่ก่อนนะ');if(now-(c.mpCool||0)<800)return;c.mpCool=now;
 S.leavePark(ws);let L=lobbies[m.g];if(!L)L=lobbies[m.g]={g:m.g,pl:[],fillAt:now+WAIT,startAt:0};
 L.pl.push(mkPl(ws,c,m.dog));c.mp={lobby:L};for(const p of L.pl)send(p.ws,lobbyMsg(L));sendInfo(ws,c)}
function leaveLobby(ws,c){const L=c.mp&&c.mp.lobby;if(!L)return false;L.pl=L.pl.filter(p=>p.ws!==ws);c.mp=null;if(!L.pl.length){if(lobbies[L.g]===L)lobbies[L.g]=null}else for(const p of L.pl)send(p.ws,lobbyMsg(L));return true}
function sendInfo(ws,c){const p=player(c.name);if(!p.mp||p.mp.date!=today())p.mp={date:today(),coins:0};
 send(ws,{t:'mp_info',cap:CAP,used:p.mp.coins,wait:Object.fromEntries(Object.keys(GAMES).map(g=>[g,lobbies[g]?lobbies[g].pl.length:0]))})}

// ---------------------------------------------------------------- rooms
function startRoom(L){if(lobbies[L.g]===L)lobbies[L.g]=null;const G=GAMES[L.g],now=Date.now(),pl=L.pl.filter(p=>p.ws&&p.ws.readyState==1);if(!pl.length)return;
 const used=new Set(pl.map(p=>p.name));const humanCount=pl.length;
 while(pl.length<Math.min(G.max,humanCount==1?G.fill:humanCount))pl.push(mkBot(used));
 const room={id:nextId++,g:L.g,pl,state:'count',t0:now,goAt:now+3600,vsHuman:humanCount>1,over:false,q:null};
 rooms.set(room.id,room);
 pl.forEach((p,i)=>{p.i=i;if(p.ws){const c=conns.get(p.ws);if(c)c.mp={room}}});
 if(room.g=='duel'){room.qs=mkQuestions(QN);room.qi=-1}
 else if(room.g=='odd'){room.oi=-1}
 else if(room.g=='rush'){room.items=[];room.nid=1}
 const info=pl.map(p=>({n:p.name,bot:p.bot,breed:p.breed,variant:p.variant,acc:p.acc,dn:p.dn,lvl:p.lvl}));
 pl.forEach(p=>{if(p.ws)send(p.ws,{t:'mp_start',g:room.g,id:room.id,pl:info,me:p.i,go:3600,cfg:{len:100,win:3,rounds:room.g=='odd'?ODDN:QN,qms:room.g=='odd'?ODDMS:QMS,dur:RUSHMS}})});
 for(let k=0;k<3;k++)setTimeout(()=>{if(room.over)return;for(const p of humans(room)){p.pk=p.pk||{};p.pk[k]=Date.now();send(p.ws,{t:'mp_p',k})}},300+k*500)}
const bcast=(room,o)=>{for(const p of room.pl)if(p.ws&&!p.left)send(p.ws,o)};
function rttOf(p){return clamp(p.rtt,0,350)}
function destroy(room){if(room.over)return;room.over=true;rooms.delete(room.id);for(const p of room.pl)if(p.ws){const c=conns.get(p.ws);if(c&&c.mp&&c.mp.room===room)c.mp=null}}

// ---------------------------------------------------------------- results & rewards
const REW=[60,38,22,10];
function finish(room,ranks,extra){if(room.over)return;
 const n=room.pl.length,res=room.pl.map((p,i)=>({n:p.name,bot:p.bot,score:Math.round(p.score*10)/10,rank:ranks[i],left:p.left,ft:p.fin?Math.round((p.fin-room.playT0)/10)/100:0,breed:p.breed,variant:p.variant}));
 for(const p of room.pl){if(p.bot||p.left||!p.ws)continue;const c=conns.get(p.ws);if(!c)continue;const pl=player(c.name),rank=ranks[p.i];
  if(!pl.mp||pl.mp.date!=today())pl.mp={date:today(),coins:0};
  let base=room.g=='grab'?(rank==1?50:12):REW[Math.min(3,rank-1)];if(!room.vsHuman)base=Math.round(base/2);
  const coins=clamp(base,0,Math.max(0,CAP-pl.mp.coins));pl.mp.coins+=coins;pl.coins+=coins;const xp=rank==1?12:5;addXp(pl,xp,p.ws);
  bump(c.name,'mp',1,p.ws);bump(c.name,room.g,1,p.ws);const win=rank==1&&n>1;if(win){bump(c.name,'mpwin',1,p.ws);bump(c.name,room.g+'win',1,p.ws)}
  dirty();c.mp=null;send(p.ws,{t:'mp_end',g:room.g,res,me:{rank,coins,xp,win,capLeft:Math.max(0,CAP-pl.mp.coins),vsHuman:room.vsHuman,...(extra||{})}});sendMe(p.ws)}
 room.over=true;rooms.delete(room.id)}
const rankBy=(pl,key)=>{const idx=pl.map((_,i)=>i).sort((a,b)=>key(b)-key(a));const r=[];idx.forEach((i,k)=>r[i]=k+1);return r};

// ---------------------------------------------------------------- RACE
function raceStep(room,now,dt){
 if(room.state=='count'){if(now>=room.goAt){room.state='play';room.playT0=now;room.order=[];for(const p of room.pl){p.lastTap=0;p.lastSide=-1;p.pos=0}}return}
 if(room.state!='play')return;let changed=false;
 for(const p of room.pl){if(!p.bot||p.fin)continue;p.frac+=p.rate*dt*(.65+Math.random()*.7);while(p.frac>=1&&p.pos<100){p.frac--;p.pos=Math.min(100,p.pos+STEP);changed=true}if(p.pos>=100&&!p.fin){p.fin=now;room.order.push(p.i)}}
 const hs=room.pl.filter(p=>!p.bot&&!p.left);
 if(room.dirty||changed){room.dirty=false;bcast(room,{t:'mp_s',p:room.pl.map(p=>Math.round(p.pos*10)/10),f:room.pl.map(p=>p.fin?1:0),ts:now})}
 if(!hs.length)return destroy(room);
 if(hs.every(p=>p.fin)||now>room.playT0+26000){
  const ord=room.order,key=p=>p.fin?1e9-(p.fin-room.playT0)+(ord.indexOf(p.i)>=0?0:0):p.left?-1:p.pos;
  const ranks=rankBy(room.pl,key);room.pl.forEach(p=>{p.score=p.pos});finish(room,ranks)}}
function raceTap(ws,c,m){const room=c.mp&&c.mp.room;if(!room||room.g!='race'||room.state!='play')return;const p=room.pl.find(x=>x.ws===ws);if(!p||p.fin||p.left)return;
 const now=Date.now(),side=m.s==1?1:0;if(side===p.lastSide||now-p.lastTap<MINTAP)return;p.lastSide=side;p.lastTap=now;p.pos=Math.min(100,p.pos+STEP);room.dirty=true;
 if(p.pos>=100&&!p.fin){p.fin=now;room.order.push(p.i)}}

// ---------------------------------------------------------------- BONE GRAB
function grabStep(room,now){
 if(room.state=='count'){if(now>=room.goAt){room.rn=1;room.playT0=now;grabRound(room,now)}return}
 if(room.state=='wait'){if(now>=room.sigT){room.state='sig';room.sigAt=now;room.acts=[];room.firstAt=0;room.pl.forEach(p=>{if(p.bot)p.botAt=now+rnd(300,560)});bcast(room,{t:'mp_signal',r:room.rn})}return}
 if(room.state=='sig'){
  for(const p of room.pl)if(p.bot&&now>=p.botAt&&!room.acts.some(a=>a.i==p.i)){room.acts.push({i:p.i,rt:p.botAt-room.sigAt});if(!room.firstAt)room.firstAt=now}
  const all=room.acts.length>=room.pl.length;
  if(room.firstAt&&(now>=room.firstAt+260||all)){const w=room.acts.slice().sort((a,b)=>a.rt-b.rt)[0];grabEnd(room,now,w.i,'fast')}
  else if(now>room.sigAt+3500)grabEnd(room,now,-1,'none');return}
 if(room.state=='res'&&now>=room.resT){const top=Math.max(...room.pl.map(p=>p.score));
  if(top>=3||room.rn>=9){const ranks=rankBy(room.pl,p=>p.left?-1:p.score);finish(room,ranks)}else{room.rn++;grabRound(room,now)}}}
function grabRound(room,now){room.state='wait';room.sigT=now+rnd(1500,4500);bcast(room,{t:'mp_round',r:room.rn,sc:room.pl.map(p=>p.score)})}
function grabEnd(room,now,w,why){if(room.state=='res')return;room.state='res';room.resT=now+1900;if(w>=0)room.pl[w].score++;
 const rt=room.pl.map(p=>{const a=(room.acts||[]).find(x=>x.i==p.i);return a?Math.round(a.rt):null});
 bcast(room,{t:'mp_rr',r:room.rn,w,rt,sc:room.pl.map(p=>p.score),why});if(w<0)room.rn--}   // nobody reacted: replay the round
function grabAct(ws,c,m){const room=c.mp&&c.mp.room;if(!room||room.g!='grab')return;const p=room.pl.find(x=>x.ws===ws);if(!p||p.left)return;const now=Date.now();
 if(room.state=='wait'){const o=room.pl.find(x=>x!==p);grabEnd(room,now,o.i,'false');room.falseBy=p.i;return}      // reacted before the signal = false start
 if(room.state!='sig'||room.acts.some(a=>a.i==p.i))return;
 const rt=Math.max(80,now-room.sigAt-rttOf(p));room.acts.push({i:p.i,rt});if(!room.firstAt)room.firstAt=now}

// ---------------------------------------------------------------- BREED DUEL
function duelStep(room,now){
 if(room.state=='count'){if(now>=room.goAt){room.playT0=now;duelAsk(room,now)}return}
 if(room.state=='ask'){
  for(const p of room.pl)if(p.bot&&!room.ans[p.i]&&now>=p.botAt){const q=room.qs[room.qi];let o=Math.random()<.62?q.a:Math.floor(Math.random()*q.opts.length);room.ans[p.i]={o,at:p.botAt-room.qAt}}
  const need=room.pl.filter(p=>!p.left);if(need.every(p=>room.ans[p.i])||now>=room.qAt+QMS+300)duelReveal(room,now);return}
 if(room.state=='rev'&&now>=room.resT){if(room.qi>=QN-1){const ranks=rankBy(room.pl,p=>p.left?-1e9+p.score:p.score);finish(room,ranks)}else duelAsk(room,now)}}
function duelAsk(room,now){room.qi++;room.state='ask';room.qAt=now;room.ans={};const q=room.qs[room.qi];room.pl.forEach(p=>{if(p.bot)p.botAt=now+rnd(2200,7000)});
 const {a,...pub}=q;bcast(room,{t:'mp_q',i:room.qi,n:QN,q:pub,ms:QMS,sc:room.pl.map(p=>p.score)})}
function duelReveal(room,now){room.state='rev';room.resT=now+3000;const q=room.qs[room.qi],pts=room.pl.map(p=>{const a=room.ans[p.i];if(!a||a.o!==q.a)return 0;const el=clamp(a.at,0,QMS);return 100+Math.floor((1-el/QMS)*100)});
 room.pl.forEach((p,i)=>p.score+=pts[i]);bcast(room,{t:'mp_qr',i:room.qi,a:q.a,picks:room.pl.map(p=>room.ans[p.i]?room.ans[p.i].o:-1),pts,sc:room.pl.map(p=>p.score)})}
function duelAns(ws,c,m){const room=c.mp&&c.mp.room;if(!room||room.g!='duel'||room.state!='ask'||(m.i|0)!==room.qi)return;const p=room.pl.find(x=>x.ws===ws);if(!p||p.left||room.ans[p.i])return;
 const o=m.o|0;if(o<0||o>=room.qs[room.qi].opts.length)return;room.ans[p.i]={o,at:Math.max(0,Date.now()-room.qAt-rttOf(p))}}


// ---------------------------------------------------------------- TREAT FRENZY
const TREATS=[{k:'cookie',w:60,pts:1,ms:2300},{k:'bone',w:20,pts:3,ms:1900},{k:'star',w:6,pts:5,ms:1500},{k:'boot',w:14,pts:-2,ms:2500}];
function rushSpawn(room,now){const x=clamp(rnd(8,92),8,92);let y=0,px=0,py=0,ok=false;for(let t=0;t<8&&!ok;t++){px=rnd(8,92);py=rnd(10,88);ok=room.items.every(it=>Math.hypot(it.x-px,it.y-py)>17)}if(!ok)return;
 let r=Math.random()*100,T=TREATS[0];for(const t of TREATS){r-=t.w;if(r<=0){T=t;break}}
 const it={id:room.nid++,x:Math.round(px),y:Math.round(py),k:T.k,pts:T.pts,exp:now+T.ms,got:false};room.items.push(it);
 for(const b of room.pl)if(b.bot&&!b.left&&(T.pts>0||Math.random()<.12)&&Math.random()<b.skill){(it.bots=it.bots||[]).push({i:b.i,at:now+rnd(520,1700)/(0.75+b.skill*.5)})}
 bcast(room,{t:'mp_rs',id:it.id,x:it.x,y:it.y,k:it.k,ms:T.ms})}
function rushClaim(room,p,it,now){const j=room.items.indexOf(it);if(j<0)return false;room.items.splice(j,1);p.score=Math.max(0,p.score+it.pts);p.hits=(p.hits||0)+1;bcast(room,{t:'mp_rx',id:it.id,by:p.i,d:it.pts,sc:room.pl.map(q=>q.score)});return true}
function rushStep(room,now){
 if(room.state=='count'){if(now>=room.goAt){room.state='play';room.playT0=now;room.endAt=now+RUSHMS;room.nextSp=now+350;for(const p of room.pl)if(p.bot)p.skill=rnd(.45,.85)}return}
 for(let i=room.items.length-1;i>=0;i--){const it=room.items[i];if(now>=it.exp+120){room.items.splice(i,1);bcast(room,{t:'mp_rx',id:it.id,by:-1})}}
 for(const it of room.items.slice())if(it.bots){for(const b of it.bots)if(now>=b.at&&room.items.includes(it)){const p=room.pl[b.i];if(p&&!p.left)rushClaim(room,p,it,now)}}
 if(!humans(room).length)return destroy(room);
 if(now>=room.endAt){const ranks=rankBy(room.pl,p=>p.left?-1e9+p.score:p.score);return finish(room,ranks)}
 if(now>=room.nextSp){const prog=(now-room.playT0)/RUSHMS;if(room.items.length<5)rushSpawn(room,now);room.nextSp=now+rnd(330,640)*(1-.35*prog)}}
function rushHit(ws,c,m){const room=c.mp&&c.mp.room;if(!room||room.g!='rush'||room.state!='play')return;const p=room.pl.find(x=>x.ws===ws);if(!p||p.left)return;const now=Date.now();
 if(now-(p.lastHit||0)<50)return;p.lastHit=now;const it=room.items.find(x=>x.id===(m.id|0));if(!it||now>it.exp+120)return;rushClaim(room,p,it,now)}

// ---------------------------------------------------------------- ODD PUP OUT
function oddRound(room,now){room.oi++;room.state='ask';room.qAt=now;room.got={};room.firstAt=0;room.locks={};
 const n=room.oi<2?9:room.oi<4?12:16,b=pick(BREEDS),same=BREEDS.filter(x=>x!==b&&x[2]===b[2]),o=pick(same.length?same:BREEDS.filter(x=>x!==b)),idx=Math.floor(Math.random()*n),cells=Array(n).fill(b[0]);cells[idx]=o[0];room.ans=idx;
 room.pl.forEach(p=>{if(p.bot)p.botAt=now+rnd(2000,6800)});
 bcast(room,{t:'mp_o',i:room.oi,n:ODDN,cells,ms:ODDMS,sc:room.pl.map(p=>p.score)})}
function oddReveal(room,now){room.state='rev';room.resT=now+2600;const pts=room.pl.map(p=>{const a=room.got[p.i];if(!a)return 0;const bonus=Math.floor((1-clamp(a.at,0,ODDMS)/ODDMS)*60);return a.order==0?100+bonus:40+Math.floor(bonus/2)});
 room.pl.forEach((p,i)=>p.score+=pts[i]);const order=Object.entries(room.got).sort((a,b)=>a[1].order-b[1].order).map(e=>+e[0]);bcast(room,{t:'mp_or',i:room.oi,a:room.ans,who:order,pts,sc:room.pl.map(p=>p.score)})}
function oddStep(room,now){
 if(room.state=='count'){if(now>=room.goAt){room.playT0=now;oddRound(room,now)}return}
 if(room.state=='ask'){
  for(const p of room.pl)if(p.bot&&!room.got[p.i]&&now>=p.botAt){if(Math.random()<.88){oddGot(room,p,now,p.botAt-room.qAt)}else p.botAt=now+rnd(1500,3500)}
  const need=room.pl.filter(p=>!p.left);if(need.every(p=>room.got[p.i])||now>=room.qAt+ODDMS+300||(room.firstAt&&now>=room.firstAt+1700))oddReveal(room,now);return}
 if(room.state=='rev'&&now>=room.resT){if(room.oi>=ODDN-1){const ranks=rankBy(room.pl,p=>p.left?-1e9+p.score:p.score);finish(room,ranks)}else oddRound(room,now)}}
function oddGot(room,p,now,at){if(room.got[p.i])return;room.got[p.i]={at,order:Object.keys(room.got).length};if(!room.firstAt){room.firstAt=now;bcast(room,{t:'mp_ov',by:p.i})}}
function oddPick(ws,c,m){const room=c.mp&&c.mp.room;if(!room||room.g!='odd'||room.state!='ask'||(m.i|0)!==room.oi)return;const p=room.pl.find(x=>x.ws===ws);if(!p||p.left||room.got[p.i])return;const now=Date.now();
 if(now<(room.locks[p.i]||0))return;const el=now-room.qAt-rttOf(p);if(el<420)return;
 if((m.c|0)===room.ans){oddGot(room,p,now,el);send(ws,{t:'mp_ok',i:room.oi})}else{room.locks[p.i]=now+1200;p.score=Math.max(0,p.score-10);send(ws,{t:'mp_ow',c:m.c|0,sc:p.score})}}

// ---------------------------------------------------------------- leaving
function leave(ws,c){if(leaveLobby(ws,c))return;const room=c.mp&&c.mp.room;if(!room)return;const p=room.pl.find(x=>x.ws===ws);c.mp=null;if(!p)return;p.left=true;
 const hs=humans(room);if(!hs.length)return destroy(room);
 if(room.g=='grab'&&!room.over){const o=room.pl.find(x=>x!==p);o.score=Math.max(o.score,3);finish(room,rankBy(room.pl,x=>x.left?-1:x.score),{forfeit:true})}
 else bcast(room,{t:'mp_gone',n:p.name})}

// ---------------------------------------------------------------- main loop
let last=Date.now();
setInterval(safe('arcade',()=>{const now=Date.now(),dt=Math.min(.3,(now-last)/1000);last=now;
 for(const g in lobbies){const L=lobbies[g];if(!L)continue;const G=GAMES[g];L.pl=L.pl.filter(p=>p.ws&&p.ws.readyState==1&&conns.has(p.ws));
  if(!L.pl.length){lobbies[g]=null;continue}
  if(L.pl.length>=G.max&&!L.startAt){L.startAt=now+1200}
  if((L.startAt&&now>=L.startAt)||now>=L.fillAt)startRoom(L)}
 for(const room of [...rooms.values()]){try{if(room.g=='race')raceStep(room,now,dt);else if(room.g=='grab')grabStep(room,now);else if(room.g=='rush')rushStep(room,now);else if(room.g=='odd')oddStep(room,now);else duelStep(room,now)}catch(e){console.error('[room]',e&&e.stack||e);try{bcast(room,{t:'mp_abort'})}catch{}destroy(room)}}}),TICK);

const HND=Object.create(null);
HND.mp_find=(ws,c,m)=>find(ws,c,m);
HND.mp_cancel=(ws,c)=>{leaveLobby(ws,c)};
HND.mp_leave=(ws,c)=>leave(ws,c);
HND.mp_get=(ws,c)=>sendInfo(ws,c);
HND.mp_tap=(ws,c,m)=>raceTap(ws,c,m);
HND.mp_act=(ws,c,m)=>grabAct(ws,c,m);
HND.mp_ans=(ws,c,m)=>duelAns(ws,c,m);
HND.mp_hit=(ws,c,m)=>rushHit(ws,c,m);
HND.mp_pick=(ws,c,m)=>oddPick(ws,c,m);
HND.mp_pr=(ws,c,m)=>{const room=c.mp&&c.mp.room;if(!room)return;const p=room.pl.find(x=>x.ws===ws),k=m.k|0;if(!p||!p.pk||!p.pk[k])return;const r=Date.now()-p.pk[k];p.pk[k]=0;p.samples.push(r);p.rtt=Math.min(...p.samples)};
const handle=(ws,c,m)=>{const f=HND[m.t];if(!f)return false;f(ws,c,m);return true};
const onClose=ws=>{const c=conns.get(ws);if(c&&c.mp)leave(ws,c)};
return{handle,onClose,rooms,lobbies};
};
