// Cozy Dogs - Park: shared outdoor map. The server owns positions, ball and treats; this file predicts, interpolates and draws.
'use strict';
const Park={on:false,m:{},me:null,ball:{x:400,y:430,vx:0,vy:0,rot:0},items:{},cfg:{x0:34,y0:262,x1:766,y1:530,walk:120,run:205,emotes:['👋','❤️','😂','🎉','😴','❓','😋','👍']},run:false,ping:0,rx:0,rxs:0,keys:{},keyT:0,marks:[],pingT:0,bubbles:{}};
const PA=PARKART;
function parkSeason(){const m=new Date().getMonth();return m>=9&&m<=10?'autumn':m==11||m<=1?'winter':m<=4?'spring':'summer'}
// ---------- members
function addMember(e){const old=Park.m[e.n]||{};Park.m[e.n]=Object.assign(old,{n:e.n,lvl:e.lvl,breed:e.breed,variant:e.variant,acc:e.acc,dn:e.dn,av:e.av||old.av||null,tricks:e.tricks,run:!!e.run,pose:e.pose||null,
  tx:e.tx,ty:e.ty,ax:old.ax!=null?old.ax:e.x,ay:old.ay!=null?old.ay:e.y,rx:old.rx!=null?old.rx:e.x,ry:old.ry!=null?old.ry:e.y,face:old.face||1,seed:old.seed||[...e.n].reduce((a,c)=>a+c.charCodeAt(0),0)%7,me:e.n==Park.me});
 return Park.m[e.n]}
function snap(a){const m=Park.m[a[0]];if(!m)return;const[x,y,tx,ty,st,run,pose]=[a[1],a[2],a[3],a[4],a[5],a[6],a[7]];
 const err=Math.hypot(m.ax-x,m.ay-y);
 if(m.me){ if(err>45){m.ax=x;m.ay=y} else m.ax+=(x-m.ax)*.15 }          // my own dog is predicted locally, only nudged when the server disagrees
 else{ if(err>130){m.ax=x;m.ay=y;m.rx=x;m.ry=y} else{m.ax+=(x-m.ax)*.45;m.ay+=(y-m.ay)*.45} m.tx=tx;m.ty=ty;m.run=!!run}
 if(!m.me){m.pose=pose||null}else if(pose&&!m.pose)m.pose=pose}
H.park_init=m=>{Park.on=true;Park.me=m.me;Park.cfg=m.cfg;Park.m={};Park.items={};Park.marks=[];Park.bubbles={};m.members.forEach(addMember);m.items.forEach(i=>Park.items[i.id]=Object.assign(i,{born:performance.now()}));Object.assign(Park.ball,m.ball);
 Park.tr=!!m.tr;Park.fb=m.fb?{x:m.fb.x,y:m.fb.y,land:performance.now()+m.fb.ms}:null;Park.mounds=[];Park.hint=null;Park.ping=0;Park.rx=0;Park.pingT=0;S.sel=null;S.edit=false;document.body.classList.add('inpark');UI.care();UI.loc();UI.parkbar();UI.online();closeMod('shop');sfx('open');
 setTimeout(()=>toast(S.set.lang=='th'?'🌳 แตะที่พื้นเพื่อเดิน · เก็บขนม · เตะลูกบอล!':'🌳 Tap the ground to walk · grab treats · kick the ball!',3600),300)};
H.park_in=m=>{const e=m.m,isNew=!Park.m[e.n];addMember(e);if(e.n==Park.me)UI.parkbar();if(isNew&&e.n!=Park.me){sfx('notify');ticker('🌳 '+e.n+(S.set.lang=='th'?' มาถึงสวนแล้ว':' joined the park'))}UI.online()};
H.park_out=m=>{delete Park.m[m.n];UI.online()};
H.park_s=m=>{Park.rx++;for(const a of m.m)snap(a);if(m.b){const b=Park.ball,e=Math.hypot(b.x-m.b[0],b.y-m.b[1]);if(e>40){b.x=m.b[0];b.y=m.b[1]}else{b.x+=(m.b[0]-b.x)*.5;b.y+=(m.b[1]-b.y)*.5}b.vx=m.b[2];b.vy=m.b[3]}};
H.park_fx=m=>{const now=performance.now();
 if(!m.n){if(m.k=='tr_new'){Park.tr=true;ticker('🗺️ '+TT('A treasure is buried somewhere in the park! Dig for it ⛏️','มีสมบัติถูกฝังไว้ในสวน! ไปขุดหาดู ⛏️'))}else if(m.k=='tr_gone'){Park.tr=false;Park.hint=null}
  else if(m.k=='fb_new'){Park.fb={x:m.x,y:m.y,land:now+m.ms};sfx('whoosh');ticker('🥏 '+TT('Frisbee! Run and catch it!','จานร่อน! วิ่งไปรับเร็ว!'))}else if(m.k=='fb_gone')Park.fb=null;return}
 if(m.k=='tr_found'){Park.tr=false;Park.hint=null;const q=Park.m[m.n];if(q){sfx('level');for(let i=0;i<4;i++)setTimeout(()=>burst(q.rx,q.ry-40,pick(['💎','⭐','💰']),4),i*140)}ticker('💎 '+m.n+' '+TT('found the treasure!','ขุดเจอสมบัติ!'));return}
 if(m.k=='fb_got'){const q=Park.m[m.n];if(Park.fb){burst(Park.fb.x,Park.fb.y-20,'🥏',3);Park.fb=null}if(m.n==Park.me&&q){sfx('coin');floatText(q.rx,q.ry-70,'+'+m.c+'💰','#ffe27a')}else if(q)sfx('pop');return}
 const p=Park.m[m.n];if(!p)return;
 if(m.k=='emote'){p.emote={e:m.v,at:now};if(m.n!=Park.me)sfx('pop')}
 else if(m.k=='pose'){p.pose=m.v||null;if(m.v){p.tx=p.ax;p.ty=p.ay}if(m.v=='bark')sfx('bark')}
 else if(m.k=='dig'){p.dig=now;p.pose=null;p.tx=p.ax;p.ty=p.ay;Park.mounds.push({x:p.ax,y:p.ay,at:now,n:m.n});if(Park.mounds.length>14)Park.mounds.shift();if(m.n==Park.me)sfx('shake')}
 else if(m.k=='trick'){p.trick=m.v;p.trickAt=now;p.pose=null;p.tx=p.ax;p.ty=p.ay;sfx('ok')}};
H.park_item=m=>{if(m.add){Park.items[m.add.id]=Object.assign(m.add,{born:performance.now()});return}
 const it=Park.items[m.del];delete Park.items[m.del];if(!it||!m.by)return;const col=m.k=='star'?'#8fd8ff':'#fff';
 burst(it.x,it.y-20,m.k=='star'?'✨':'⭐',3);sparkle(it.x,it.y-20,10,col);
 if(m.by==Park.me){const r=m.r||{};if(r.g||r.c){sfx('coin');floatText(it.x,it.y-40,'+'+(r.g?r.g+'💎':r.c+'💰'),'#ffe27a')}else floatText(it.x,it.y-40,TT('Daily limit reached','ครบโควต้าวันนี้แล้ว'),'#ffffff')}};      // after the daily cap a treat is still picked up, but gives nothing: say so
H.park_dig_r=m=>{const q=Park.m[Park.me];if(!q)return;const x=q.rx,y=q.ry-60,L={dirt:['🟤','Just dirt…','มีแต่ดิน…'],coin:['💰','A coin!','เจอเหรียญ!'],bone:['🦴','A bone!','เจอกระดูก!'],cookie:['🍪','A cookie!','เจอคุกกี้!'],boot:['🥾','An old boot…','รองเท้าเก่า…'],gem:['💎','A gem!','เจอเพชร!'],ticket:['🎟','A ticket!','เจอตั๋ว!'],treasure:['🏆','TREASURE!','สมบัติ!!!']}[m.k]||['🟤','','']; 
 floatText(x,y,L[0]+' '+TT(L[1],L[2]),m.k=='dirt'?'#ffffff':'#ffe27a');if(m.k!='dirt'){sfx(m.k=='treasure'?'level':'coin');burst(q.rx,q.ry-30,L[0],3)}
 if(m.r&&m.k=='treasure')floatText(x,y-26,'+'+m.r.c+'💰 +'+m.r.g+'💎 +'+m.r.tk+'🎟','#ffe27a');else if(m.r&&m.r.c)floatText(x,y-26,'+'+m.r.c+'💰','#ffe27a');
 if(m.hint){Park.hint={k:m.hint,at:performance.now()}}};
H.pong=m=>{const r=performance.now()-m.c;Park.ping=Park.ping?Park.ping*.6+r*.4:r;UI.parkinfo()};
Park.onChat=m=>{if(!Park.on||!Park.m[m.from])return;Park.bubbles[m.from]={m:m.m,at:performance.now()}};
// ---------- UI
const PEM_POSES=[['sit','🪑','Sit'],['sleep','💤','Sleep'],['bark','🗨️','Bark']];
UI.parkbar=function(){const el=$('#parkbar'),me=Park.m[Park.me],tr=(me&&me.tricks)||[];if(!Park.on){el.classList.add('hidden');return}el.classList.remove('hidden');
 el.innerHTML=`<button class="btn sm red" data-do="parkleave">🏠 ${S.set.lang=='th'?'กลับบ้าน':'Leave'}</button><span class="sep"></span>${Park.cfg.emotes.map(e=>`<button class="eb" data-do="pemote" data-e="${e}">${e}</button>`).join('')}<span class="sep"></span>${PEM_POSES.map(([k,e,l])=>`<button class="eb" title="${t(l)}" data-do="ppose" data-p="${k}">${e}</button>`).join('')}${tr.map(k=>`<button class="eb tr" title="${nice(k)}" data-do="ptrick" data-k="${k}">${DOGS.TEM[k]||'✨'}</button>`).join('')}<span class="sep"></span><button class="eb" title="${TT('Dig for treasure','ขุดหาสมบัติ')}" data-do="parkdig">⛏️</button><button class="btn sm ${Park.run?'sun':'ghost'}" data-do="parkrun">🏃</button><button class="btn sm sky" data-do="parkdog">🐶</button>`}
UI.parkinfo=function(){const el=$('#parkinfo');if(!Park.on){el.classList.add('hidden');return}el.classList.remove('hidden');const n=Object.keys(Park.m).length,q=Park.ping<60?'#2f9e6a':Park.ping<160?'#e8a020':'#d13c4c';
 el.innerHTML=`${Park.tr?'🗺️ · ':''}👥 ${n} · <b style="color:${q}">📶 ${Math.round(Park.ping)}ms</b> · ⇣ ${Park.rxs}/s`}
DO.park=()=>{if(MP.g)return toast(TT('Finish your game first','จบเกมที่เล่นอยู่ก่อนนะ'));if(S.edit)return toast(S.set.lang=='th'?'ตกแต่งให้เสร็จก่อนนะ':'Finish decorating first');if(Park.on)return;send({t:'park_join',dog:LS.get('cd_pdog',null)})};
DO.parkleave=()=>{send({t:'park_leave'});Park.leaveLocal();send({t:'visit',id:S.name})};
Park.leaveLocal=()=>{Park.on=false;Park.fb=null;Park.tr=false;Park.mounds=[];Park.hint=null;Park.m={};document.body.classList.remove('inpark');UI.parkinfo();UI.parkbar();UI.loc();UI.online()};
DO.pemote=d=>{send({t:'park_emote',e:d.e});const m=Park.m[Park.me];if(m)m.emote={e:d.e,at:performance.now()};sfx('pop')};
DO.ppose=d=>{const m=Park.m[Park.me];if(!m)return;const p=m.pose==d.p?null:d.p;m.pose=p;if(p){m.tx=m.ax;m.ty=m.ay}send({t:'park_pose',p})};
DO.ptrick=d=>{send({t:'park_trick',k:d.k})};
DO.parkrun=()=>{Park.run=!Park.run;UI.parkbar();toast(Park.run?'🏃 Run':'🚶 Walk',900)};
DO.parkdig=()=>{const m=Park.m[Park.me];if(!m)return;if(performance.now()-(Park.digT||0)<4000)return toast('⛏️ '+TT('Wait a moment…','รอสักครู่…'),900);Park.digT=performance.now();m.pose=null;m.tx=m.ax;m.ty=m.ay;send({t:'park_dig'})};
DO.parkdog=()=>{send({t:'dogs_get'});renderParkDogs()};
function renderParkDogs(){const all=S.allDogs||[],cur=Park.m[Park.me];modal('pdogs','🐶 '+(S.set.lang=='th'?'เลือกน้องหมาที่จะพาไปสวน':'Choose your park dog'),`<div class="grid">${all.map(d=>`<div class="gc ${cur&&cur.dn==d.name&&cur.breed==d.breed?'sel':''}" data-do="pickpdog" data-id="${d.id}">${thumbHTML(d.breed,d.variant,42,d.acc)}<div class="nm">${esc(d.name)}</div></div>`).join('')||'<div class="muted">…</div>'}</div>`,'lg');paintThumbs(modOpen('pdogs'))}
DO.pickpdog=d=>{LS.set('cd_pdog',d.id);send({t:'park_dog',dog:d.id});closeMod('pdogs')};
// ---------- player card (tap another dog)
function playerCard(m){const fr=S.fr&&S.fr.friends.some(f=>f.name==m.n),th=S.set.lang=='th';
 modal('pc',esc(m.n),`<div class="center"><div class="duo">${m.av?`<div class="ph">${AVA.html(m.av,64,{crop:'full',shadow:1,bottom:1})}</div>`:''}<div class="ph dg">${thumbHTML(m.breed,m.variant,m.av?46:60,m.acc)}</div></div><div class="big" style="margin-top:6px">${esc(m.n)}</div><div class="muted">Lv${m.lvl} · 🐶 ${esc(m.dn)}</div></div>
 <div class="row" style="margin-top:14px;flex-wrap:wrap"><button class="btn sky" data-do="pvisit" data-n="${esc(m.n)}">🏡 ${t('Visit')}</button>${fr?'':`<button class="btn mint" data-do="fadd" data-n="${esc(m.n)}">➕ ${t('Add')}</button>`}<button class="btn pink" data-do="tradereq" data-n="${esc(m.n)}">🔁 ${t('Trade')}</button></div>`,'sm');paintThumbs(modOpen('pc'));AVA.paint(modOpen('pc'))}
DO.pvisit=d=>{closeMod('pc');Park.leaveLocal();send({t:'park_leave'});send({t:'visit',id:d.n})};
// ---------- input
function parkGround(e){const[x,y]=toWorld(e);return[clamp(x,Park.cfg.x0,Park.cfg.x1),clamp(y,Park.cfg.y0,Park.cfg.y1)]}
function parkMoveTo(x,y,run){const m=Park.m[Park.me];if(!m)return;m.tx=x;m.ty=y;m.run=run;m.pose=null;send({t:'park_move',x:Math.round(x),y:Math.round(y),run:run?1:0})}
function parkPointer(e){const[wx,wy]=toWorld(e);let best=null,bd=1e9,viaHuman=false;for(const m of Object.values(Park.m)){if(m._hit){const[hx,hy,r]=m._hit,dd=Math.hypot(wx-hx,wy-hy);if(dd<r&&dd<bd){best=m;bd=dd;viaHuman=false}}
  if(m._hhit&&m.av){const[hx,hy,rx,ry]=m._hhit,dx=(wx-hx)/rx,dy=(wy-hy)/ry;if(dx*dx+dy*dy<=1){const dd=Math.hypot(wx-hx,wy-hy)*.8;if(dd<bd){best=m;bd=dd;viaHuman=true}}}}
 if(best&&!best.me){sfx('pop');playerCard(best);return}
 if(best&&best.me&&viaHuman){sfx('pop');best.emote={e:'👋',at:performance.now()};DO.wardrobe();return}
 const[x,y]=parkGround(e);parkMoveTo(x,y,Park.run||e.shiftKey);Park.marks.push({x,y,t:performance.now()});sfx('click')}
addEventListener('keydown',e=>{if(!Park.on||e.target.tagName=='INPUT'||$('#mods .ov'))return;const k=e.key.toLowerCase();if('wasd'.includes(k)&&k.length==1||k.startsWith('arrow')){Park.keys[k]=true;e.preventDefault()}});
addEventListener('blur',()=>{Park.keys={}});document.addEventListener('visibilitychange',()=>{if(document.hidden)Park.keys={}});      // alt-tab with a key held must not leave the dog walking
addEventListener('keyup',e=>{const k=e.key.toLowerCase();if(Park.keys[k]){delete Park.keys[k];if(!Object.keys(Park.keys).length){const m=Park.m[Park.me];if(m)parkMoveTo(m.rx,m.ry,Park.run)}}});
// ---------- simulation (client prediction + dead reckoning)
function stepPark(dt,now){const C=Park.cfg;
 const K=Park.keys;if(Object.keys(K).length&&now-Park.keyT>150){Park.keyT=now;const m=Park.m[Park.me];if(m){const dx=(K.d||K.arrowright?1:0)-(K.a||K.arrowleft?1:0),dy=(K.s||K.arrowdown?1:0)-(K.w||K.arrowup?1:0);if(dx||dy){const l=Math.hypot(dx,dy);parkMoveTo(clamp(m.rx+dx/l*90,C.x0,C.x1),clamp(m.ry+dy/l*90,C.y0,C.y1),Park.run)}}}
 for(const m of Object.values(Park.m)){const sp=m.run?C.run:C.walk,dx=m.tx-m.ax,dy=m.ty-m.ay,d=Math.hypot(dx,dy);
  if(d>1){const s=Math.min(d,sp*dt);m.ax+=dx/d*s;m.ay+=dy/d*s}else{m.ax=m.tx;m.ay=m.ty}
  const px=m.rx,k=1-Math.exp(-dt*(m.me?28:11));m.rx+=(m.ax-m.rx)*k;m.ry+=(m.ay-m.ry)*k;if(Math.abs(m.rx-px)>.03)m.face=m.rx>px?1:-1;
  m.moving=d>1.5||Math.hypot(m.ax-m.rx,m.ay-m.ry)>1.2;m.wade=PA.inPond(m.rx,m.ry);
  if(m.run&&m.moving&&!m.wade&&!m.pose&&World.fxs.length<90){m.dust=(m.dust||0)-dt;if(m.dust<=0){m.dust=.11;fx('dust',m.rx-(m.face||1)*8+rnd(-3,3),m.ry+rnd(-2,2),{vx:-(m.face||1)*rnd(6,16),vy:-rnd(4,14),life:.42,max:.42,size:rnd(3,5)})}}
  if(m.av)AVA.stepHuman(m,dt,C)}
 const b=Park.ball;if(Math.hypot(b.vx,b.vy)>0){b.x+=b.vx*dt;b.y+=b.vy*dt;if(b.x<C.x0){b.x=C.x0;b.vx=Math.abs(b.vx)*.72}if(b.x>C.x1){b.x=C.x1;b.vx=-Math.abs(b.vx)*.72}if(b.y<C.y0){b.y=C.y0;b.vy=Math.abs(b.vy)*.72}if(b.y>C.y1){b.y=C.y1;b.vy=-Math.abs(b.vy)*.72}
  const f=Math.pow(.1,dt);b.vx*=f;b.vy*=f;b.rot+=(b.vx+b.vy)*dt*.05;if(Math.hypot(b.vx,b.vy)<9)b.vx=b.vy=0}
 if(now-Park.pingT>2000){Park.pingT=now;send({t:'ping',c:now});Park.rxs=Math.round(Park.rx/2);Park.rx=0}}
// ---------- drawing
function drawPDog(c,m,t,now){const b=DOGS.BR[m.breed];if(!b)return;const sc=b.size*.9,mv=m.moving&&!m.pose,run=mv&&m.run,bob=mv?Math.abs(Math.sin(t*(run?17:10)))*(run?6:2.5):0;
 let trickK=null,trick=null;if(m.trick&&now-m.trickAt<DOGS.TRICK_MS){trickK=(now-m.trickAt)/DOGS.TRICK_MS;trick=m.trick}
 const state=m.pose=='sit'?'SIT':m.pose=='sleep'?'SLEEP':m.pose=='bark'?'BARK':'IDLE',sink=m.wade?5:0;
 c.save();c.translate(m.rx,m.ry);c.fillStyle='rgba(60,32,22,.24)';c.beginPath();c.ellipse(0,0,38*sc,7*sc,0,0,7);c.fill();
 c.translate(0,sink);c.scale(m.face*sc,sc);c.translate(0,-bob);if(b.r=='M'){c.shadowColor=b.acc;c.shadowBlur=14}
 const info=DOGS.sprite(c,b,m.variant,t,{state,mv,run,seed:m.seed,acc:m.acc,happy:true,trick,trickK,pet:m.emote&&now-m.emote.at<1500&&m.emote.e=='❤️'});c.restore();
 if(m.wade){c.save();c.translate(m.rx,m.ry+1);c.fillStyle='rgba(90,175,225,.5)';c.beginPath();c.ellipse(0,0,30*sc,8*sc,0,0,7);c.fill();c.strokeStyle='rgba(255,255,255,'+(.55+.3*Math.sin(t*6))+')';c.lineWidth=2;c.beginPath();c.ellipse(0,1,(26+Math.sin(t*4)*4)*sc,(6+Math.sin(t*4)*1.5)*sc,0,0,7);c.stroke();c.restore()}
 m._top=info.top*sc;m._w=info.w;m._hit=[m.rx,m.ry-m._top*.45,Math.max(28,m._top*.55)]}
function drawPTag(c,m,t,now){const b=DOGS.BR[m.breed];if(!b||m._top==null)return;const x=m.rx,y=m.ry,top=m._top;
 c.font='bold 11px '+UIF();c.textAlign='center';const label=m.n+' · Lv'+m.lvl,w=c.measureText(label).width+16;
 c.fillStyle=m.me?'#ff8fb0':'rgba(255,250,241,.94)';c.strokeStyle=b.r&&b.r!='C'?RCOL[b.r]:'#5a3d33';c.lineWidth=2;c.beginPath();c.roundRect(x-w/2,y+9,w,17,8);c.fill();c.stroke();c.fillStyle=m.me?'#fff':'#5a3d33';c.fillText(label,x,y+21);
 const bub=Park.bubbles[m.n];let by=y-top-12;
 if(bub&&now-bub.at<4500){const a=Math.min(1,(4500-(now-bub.at))/600);if(m.av&&m._htop!=null&&m.hx!=null)AVA.bubble(c,m.hx,m.hy-m._htop-8,bub.m,a);else{AVA.bubble(c,x,by,bub.m,a);by-=30}}
 if(m.emote&&now-m.emote.at<2200){const k=(now-m.emote.at)/2200,a=k>.75?(1-k)*4:1;c.globalAlpha=a;c.font='26px sans-serif';c.fillText(m.emote.e,x,by-6-k*14);c.globalAlpha=1}
 else if(m.dig&&now-m.dig<1200){c.font='22px sans-serif';c.save();c.translate(x+14,by-4);c.rotate(Math.sin(now/90)*.5);c.fillText('⛏️',0,0);c.restore()}
 else if(m.pose=='sleep'){c.font='20px sans-serif';c.fillText('💤',x+16,by-4-Math.sin(t*2)*3)}}
function disc(c,x,y,sq){c.save();c.translate(x,y);c.fillStyle='rgba(60,32,22,.25)';c.beginPath();c.ellipse(0,8,12,3,0,0,7);c.fill();c.scale(1,sq);c.fillStyle='#ff6b8b';c.strokeStyle='#5a3d33';c.lineWidth=2.2;c.beginPath();c.ellipse(0,0,13,13,0,0,7);c.fill();c.stroke();c.fillStyle='#ffd0de';c.beginPath();c.ellipse(0,0,7,7,0,0,7);c.fill();c.restore()}
function drawParkExtras(c,t,now){
 for(let i=Park.mounds.length-1;i>=0;i--){const mo=Park.mounds[i],age=now-mo.at;if(age>25000){Park.mounds.splice(i,1);continue}const dig=age<1200;c.save();c.globalAlpha=age>20000?(25000-age)/5000:1;c.translate(mo.x+16,mo.y+2);c.fillStyle='#7a5238';c.beginPath();c.ellipse(0,0,13,5,0,0,7);c.fill();c.fillStyle='#98694a';c.beginPath();c.ellipse(0,-2,9,3.5,0,0,7);c.fill();c.restore();
  if(dig&&Math.random()<.5)fx('spark',mo.x+rnd(8,24),mo.y-4,{vx:rnd(-30,30),vy:-rnd(30,70),g:150,life:.6,max:.6,size:3,col:'#8a5a3a'})}
 const f=Park.fb;if(f){const k=1-(f.land-now)/1700;c.save();if(k<1){const kk=clamp(k,0,1),x=f.x-160*(1-kk),y=f.y-Math.sin(kk*Math.PI)*120-(1-kk)*60;disc(c,x,y,.35+.25*Math.abs(Math.sin(t*14)))}
  else{c.strokeStyle='rgba(255,230,120,'+(.5+.4*Math.sin(t*8))+')';c.lineWidth=3;c.beginPath();c.ellipse(f.x,f.y,22+Math.sin(t*6)*3,8,0,0,7);c.stroke();disc(c,f.x,f.y-6,.4)}c.restore();
  if(k<1){c.save();c.fillStyle='rgba(255,230,120,.35)';c.beginPath();c.ellipse(f.x,f.y,22*clamp(k,0,1),8*clamp(k,0,1),0,0,7);c.fill();c.restore()}}
 const me=Park.m[Park.me],h=Park.hint;if(me&&h&&now-h.at<5000){const o={hot:['🔥',TT('Burning hot!','ร้อนแรง!'),'#ff5a3c'],warm:['♨️',TT('Warm','อุ่น ๆ'),'#ff9a3c'],cool:['🌬️',TT('Cool','เย็น'),'#6fb8ff'],cold:['🧊',TT('Cold','เย็นเฉียบ'),'#8fd8ff']}[h.k];
  if(o){const a=Math.min(1,(5000-(now-h.at))/700);c.save();c.globalAlpha=a;c.font='bold 14px '+UIF();c.textAlign='center';c.lineWidth=4;c.strokeStyle='#5a3d33';const y=me.ry-(me._top||60)-48-((now-h.at)/5000)*10;c.strokeText(o[0]+' '+o[1],me.rx,y);c.fillStyle=o[2];c.fillText(o[0]+' '+o[1],me.rx,y);c.restore()}}}
function renderPark(c,t,now,dt){const e=env(),season=parkSeason(),P=PA.pal(season,e.weather);stepPark(dt,now);
 c.save();c.scale(World.scale,World.scale);c.imageSmoothingEnabled=false;
 PA.sky(c,t,e);c.drawImage(PA.layer(season,e.weather),0,0,800,600);PA.pondLive(c,t,e,P);
 // click markers
 for(let i=Park.marks.length-1;i>=0;i--){const mk=Park.marks[i],k=(now-mk.t)/700;if(k>1){Park.marks.splice(i,1);continue}c.strokeStyle='rgba(255,255,255,'+(1-k)*.85+')';c.lineWidth=3;c.beginPath();c.ellipse(mk.x,mk.y,10+k*22,4+k*9,0,0,7);c.stroke()}
 const ents=[];for(const p of PA.PROPS)ents.push({y:p.y,p});for(const m of Object.values(Park.m)){ents.push({y:m.ry,m});if(m.av&&m.hx!=null){ents.push({y:m.hy,h:m});ents.push({y:Math.max(m.hy,m.ry)+.3,l:m})}}for(const it of Object.values(Park.items))ents.push({y:it.y,it});ents.push({y:Park.ball.y,ball:1});
 ents.sort((a,b)=>a.y-b.y);
 for(const en of ents){
  if(en.p){const p=en.p;if(p.k=='tree'){const sway=Math.sin(t*.9+p.x*.013)*1.6;if(!P.winter||true){PA.put(c,PA.trunk(P,p.v),p.x,p.y,{});PA.put(c,PA.canopy(P,p.v),p.x+sway,p.y-78,{})}}
   else if(p.k=='bench')PA.put(c,PA.bench(),p.x,p.y);else if(p.k=='lamp')PA.put(c,PA.lamp(),p.x,p.y);else if(p.k=='bush')PA.put(c,PA.bush(P),p.x,p.y);else if(p.k=='rock')PA.put(c,PA.rock(P),p.x,p.y);else if(p.k=='flowers')PA.put(c,PA.flowers(P),p.x,p.y)}
  else if(en.m)drawPDog(c,en.m,t,now);
  else if(en.h)AVA.drawHuman(c,en.h,t,now);
  else if(en.l)AVA.drawLeash(c,en.l,t);
  else if(en.it){const it=en.it,s=PA.TREAT[it.k](),age=(now-it.born)/1000,pop=Math.min(1,age*4),bob=Math.sin(t*3+it.id)*3;c.fillStyle='rgba(60,32,22,.25)';c.beginPath();c.ellipse(it.x,it.y,12*pop,4*pop,0,0,7);c.fill();
   if(it.k=='star'){c.save();c.globalAlpha=.6;const gr=c.createRadialGradient(it.x,it.y-20,2,it.x,it.y-20,28);gr.addColorStop(0,'rgba(140,220,255,.8)');gr.addColorStop(1,'rgba(140,220,255,0)');c.fillStyle=gr;c.fillRect(it.x-28,it.y-48,56,56);c.restore()}
   c.save();c.translate(it.x,it.y-14-bob);c.scale(pop,pop);c.translate(-it.x,-it.y+14+bob);PA.put(c,s,it.x,it.y-14-bob);c.restore();if(Math.sin(t*4+it.id*2)>.93)sparkle(it.x,it.y-6,1)}
  else if(en.ball){const b=Park.ball,sp=Math.hypot(b.vx,b.vy),hop=sp>40?Math.abs(Math.sin(t*11))*Math.min(10,sp/28):0;c.fillStyle='rgba(60,32,22,'+(.26-hop*.008)+')';c.beginPath();c.ellipse(b.x,b.y,10-hop*.3,4,0,0,7);c.fill();PA.put(c,PA.ball(),b.x,b.y-10-hop,{rot:b.rot})}}
 drawParkExtras(c,t,now);
 for(const m of Object.values(Park.m))drawPTag(c,m,t,now);
 PA.weatherFx(c,t,dt,e,P);PA.light(c,t,e,P);fxDraw(c,t,dt);c.restore()}
cv.addEventListener('pointerdown',e=>{if(Park.on){e.stopImmediatePropagation();parkPointer(e)}},true);
