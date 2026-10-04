// Cozy Dogs - online mini-game arcade (client). The server owns every room; this file only draws and sends inputs.
//   Dog Race (alternate taps) · Bone Grab (reaction duel) · Breed Duel (quiz) + the "Games" hub with the lucky wheel and the solo games.
'use strict';
const TT=(en,th)=>S.set.lang=='th'?th:en;
SFX.whoosh=()=>{tone(300,.25,'sawtooth',.03,0,3)};SFX.tick=()=>tone(660,.07,'square',.06);SFX.go=()=>{tone(880,.16,'square',.08);tone(1320,.28,'square',.08,.08)};SFX.step=()=>tone(300+Math.random()*60,.03,'square',.025);
const OG=[
 ['race','🏁','Dog Race','แตะซ้าย-ขวาสลับกันให้เร็วที่สุด! วิ่งแข่งกับผู้เล่นจริง 2-4 คน','Alternate left / right taps to outrun 2-4 players','2-4'],
 ['grab','🦴','Bone Grab','ดวลปฏิกิริยา 1 ต่อ 1 ใครแตะกระดูกไวกว่าชนะ (ชนะ 3 รอบ)','1v1 reaction duel — first to win 3 rounds','2'],
 ['rush','🍪','Treat Frenzy','ขนมโผล่ทั่วจอ! แตะให้ไวกว่าคนอื่น 🍪+1 🦴+3 ⭐+5 ระวังรองเท้า 🥾 (−2) นาน 24 วินาที','Treats pop up everywhere — tap them before the others! Avoid the boots. 24 seconds','2-4'],
 ['odd','🔍','Odd Pup Out','หาน้องหมาตัวที่แตกต่างจากตะแกรงให้เร็วที่สุด 6 รอบ ยิ่งไปยิ่งยาก','Spot the one different dog in the grid — 6 rounds, getting harder','2-4'],
 ['duel','🧠','Breed Duel','ตอบคำถามเรื่องสายพันธุ์และความรู้หมา 5 ข้อ ตอบไวได้แต้มเพิ่ม','5 quick questions about breeds and dog facts — faster = more points','2-4']];
const MP={prev:[],mv:[],g:null,room:null,pl:[],me:0,lobby:null,res:null,raf:0,iv:0,state:'idle',rn:0,pos:[],fin:[],shown:[],loc:0,lastSide:-1,goAt:0,sc:[],acted:false,q:null,qEnd:0,qms:10000,keysOn:false};
// ================= hub =================
DO.games=()=>{send({t:'mp_get'});send({t:'spin_get'});renderHub()};
H.mp_info=m=>{S.mpInfo=m;if(modOpen('games'))renderHub()};
function renderHub(){const th=S.set.lang=='th',inf=S.mpInfo||{cap:600,used:0,wait:{}},sp=S.spin;
 const og=OG.map(g=>`<div class="gmcard og" data-do="mpfind" data-g="${g[0]}"><span class="e">${g[1]}</span><div style="flex:1"><b style="font-size:16px">${t(g[2])}</b> <span class="pill">👥 ${g[5]}</span>${inf.wait&&inf.wait[g[0]]?` <span class="pill on">⏳ ${inf.wait[g[0]]} ${TT('waiting','รออยู่')}</span>`:''}<div class="muted">${th?g[3]:g[4]}</div></div></div>`).join('');
 modal('games','🎮 '+t('Games'),`<h4 class="hubh">🌐 ${TT('Online games','เกมออนไลน์')}</h4><div class="muted" style="margin-bottom:8px">${TT('Real players join your room · if nobody is around, friendly bots fill in (half rewards).','ผู้เล่นจริงจะเข้าห้องเดียวกับคุณ · ถ้าไม่มีใครอยู่ จะมีบอทมาเล่นด้วย (รางวัลครึ่งเดียว)')}<br>🪙 ${TT('Arcade coins today','เหรียญเกมออนไลน์วันนี้')}: <b>${inf.used}/${inf.cap}</b></div>${og}
 <div class="gmcard" data-do="wheel" style="margin-top:6px"><span class="e">🎰</span><div style="flex:1"><b style="font-size:16px">${TT('Lucky Wheel','วงล้อนำโชค')}</b>${sp&&sp.free||S.me.spinFree?` <span class="pill on">🎁 ${TT('FREE spin!','หมุนฟรี!')}</span>`:''}<div class="muted">${TT('One free spin every day — coins, gems, tickets and more.','หมุนฟรีวันละครั้ง ได้เหรียญ เพชร ตั๋ว และของรางวัลอื่น ๆ')}</div></div></div>
 <h4 class="hubh">🎮 ${TT('Solo mini-games','มินิเกมเล่นคนเดียว')}</h4><div class="muted" style="margin-bottom:8px">${th?'รางวัลเหรียญจากมินิเกมจำกัดวันละ 500 เหรียญ':'Mini game coin rewards are capped at 500 per day.'}</div>`+
  GAMES.map(g=>`<div class="gmcard" data-do="gstart" data-g="${g[0]}"><span class="e">${g[1]}</span><div><b style="font-size:16px">${t(g[2])}</b><div class="muted">${th?g[3]:g[4]}</div></div></div>`).join(''),'sm')}
// ================= flow =================
const mpRoomOpen=()=>!!modOpen('mp');
function mpModal(title,body,cls){return modal('mp',title,body,cls||'sm',{lock:1})}
DO.mpfind=d=>{if(MP.g)return toast(TT('Already in a game','คุณอยู่ในเกมอยู่แล้ว'));if(S.edit)return toast(TT('Finish decorating first','ตกแต่งให้เสร็จก่อนนะ'));
 closeMod('games');MP.reset(true);MP.g=d.g;MP.state='lobby';MP.seen=performance.now();send({t:'mp_find',g:d.g,dog:LS.get('cd_pdog',null)});renderLobby({n:1,max:d.g=='grab'?2:4,ms:8000,names:[S.name]})};
DO.mpcancel=()=>{send({t:'mp_cancel'});MP.reset()};
DO.mpleave=()=>ask(TT('Leave this game? You will forfeit.','ออกจากเกมนี้? จะนับว่าแพ้นะ'),()=>{send({t:'mp_leave'});MP.reset()},{cls:'red',yes:TT('Leave','ออก')});
DO.mpagain=()=>{const g=MP.g;MP.reset(true);DO.mpfind({g})};
DO.mpclose=()=>{MP.reset();DO.games()};
MP.reset=(keepOpen)=>{cancelAnimationFrame(MP.raf);clearInterval(MP.iv);Object.assign(MP,{g:null,room:null,pl:[],lobby:null,res:null,state:'idle',pos:[],fin:[],shown:[],prev:[],mv:[],loc:0,lastSide:-1,sc:[],acted:false,q:null,items:{},lockEnd:0});if(!keepOpen)closeMod('mp')};
MP.abort=()=>{if(MP.g||MP.state!='idle'){MP.reset();toast(TT('Connection lost — game cancelled','การเชื่อมต่อหลุด — ยกเลิกเกม'))}};
const gname=g=>t((OG.find(x=>x[0]==g)||[0,0,g])[2]);
const gicon=g=>(OG.find(x=>x[0]==g)||[0,'🎮'])[1];
// ---- lobby
H.mp_lobby=m=>{if(MP.g!=m.g)return;MP.lobby={n:m.n,max:m.max,end:performance.now()+m.ms,names:m.names};renderLobby(m);sfx('pop')};
function renderLobby(m){MP.lobby=MP.lobby||{n:m.n,max:m.max,end:performance.now()+m.ms,names:m.names};const g=MP.g;
 const slots=Array.from({length:m.max},(_,i)=>`<div class="slot ${i<m.n?'on':''}">${i<m.n?'🐶':'…'}<small>${i<m.n?esc((m.names||MP.lobby.names||[])[i]||''):''}</small></div>`).join('');
 mpModal(gicon(g)+' '+gname(g),`<div class="center"><div class="slots">${slots}</div><div class="big" style="margin:12px 0 4px">${TT('Looking for players…','กำลังหาผู้เล่น…')}</div><div class="muted" id="lobt">${TT('Bots join in','บอทจะเข้าร่วมใน')} <b id="lobs">—</b>s</div>
  <div class="muted" style="margin-top:8px">${esc(TT((OG.find(x=>x[0]==g)||[])[4]||'',(OG.find(x=>x[0]==g)||[])[3]||''))}</div><div class="row" style="margin-top:14px"><button class="btn ghost" data-do="mpcancel">✕ ${t('Cancel')}</button></div></div>`);
 clearInterval(MP.iv);MP.iv=setInterval(()=>{const e=$('#lobs');if(!e||!MP.lobby)return clearInterval(MP.iv);e.textContent=Math.max(0,Math.ceil((MP.lobby.end-performance.now())/1000))},250)}
// ---- start
H.mp_start=m=>{clearInterval(MP.iv);if(Park.on)Park.leaveLocal();Object.assign(MP,{g:m.g,room:m,pl:m.pl,me:m.me,lobby:null,state:'count',goAt:performance.now()+m.go,pos:m.pl.map(()=>0),fin:m.pl.map(()=>0),shown:m.pl.map(()=>0),loc:0,lastSide:-1,sc:m.pl.map(()=>0),acted:false,rn:0,lastTick:4});
 S.sel=null;UI.care();sfx('level');({race:startRace,grab:startGrab,duel:startDuel,rush:startRush,odd:startOdd})[m.g](m)};
H.mp_p=m=>send({t:'mp_pr',k:m.k});
H.mp_gone=m=>toast('🚪 '+m.n+' '+TT('left the game','ออกจากเกมแล้ว'));
const pName=p=>(p.bot?'🤖 ':'')+esc(p.n);
function scoreBoard(){return`<div class="sboard">${MP.pl.map((p,i)=>`<div class="sc ${i==MP.me?'me':''}">${thumbHTML(p.breed,p.variant,18,p.acc)}<b>${pName(p)}</b><span id="sc${i}">${MP.sc[i]||0}</span></div>`).join('')}</div>`}
function cdText(){const k=Math.ceil((MP.goAt-performance.now())/1000);return k}
// ================= DOG RACE =================
function startRace(m){const n=m.pl.length,H0=n*74+34;
 mpModal('🏁 '+t('Dog Race'),`<div class="racewrap"><canvas id="racec" width="640" height="${H0}"></canvas><div class="raceov" id="raceov">3</div></div>
  <div class="pads"><button class="pad" id="padL" data-side="0">◀<small>A / ←</small></button><button class="pad" id="padR" data-side="1">▶<small>D / →</small></button></div><div class="muted center" id="racehint">${TT('Tap the pads — alternate left and right as fast as you can!','แตะสลับซ้าย-ขวาให้เร็วที่สุด!')}</div><div class="row" style="margin-top:6px"><button class="btn sm ghost" data-do="mpleave">🚪 ${TT('Leave','ออก')}</button></div>`,'');
 const ov=modOpen('mp');for(const b of $$('.pad',ov))b.addEventListener('pointerdown',e=>{e.preventDefault();raceTap(+b.dataset.side)});
 MP.keysOn=true;MP.raf=requestAnimationFrame(raceLoop)}
function raceTap(side){if(MP.g!='race'||MP.state!='play')return;const pad=$(side?'#padR':'#padL');if(pad){pad.classList.add('hit');setTimeout(()=>pad.classList.remove('hit'),70)}
 if(side===MP.lastSide){const h=$('#racehint');if(h){h.textContent=TT('Alternate! ◀ ▶ ◀ ▶','สลับข้างสิ! ◀ ▶ ◀ ▶');h.style.color='#d13c4c'}return}
 MP.lastSide=side;MP.loc=Math.min(100,MP.loc+1.8);send({t:'mp_tap',s:side});sfx('step');const h=$('#racehint');if(h){h.style.color='';h.textContent=TT('Go go go!','เร็วเข้า!')}}
addEventListener('keydown',e=>{if(MP.g!='race'||e.repeat||!mpRoomOpen())return;const k=e.key.toLowerCase();if(k=='a'||k=='arrowleft'){e.preventDefault();raceTap(0)}else if(k=='d'||k=='arrowright'){e.preventDefault();raceTap(1)}});
H.mp_s=m=>{if(MP.g!='race')return;MP.pos=m.p;MP.fin=m.f;if(MP.state=='count'||MP.state=='play'){if(MP.loc<m.p[MP.me])MP.loc=m.p[MP.me];if(MP.loc>m.p[MP.me]+5)MP.loc=m.p[MP.me]+5}};
function raceLoop(){const c=$('#racec');if(!c||MP.g!='race'){return}const g=c.getContext('2d'),now=performance.now(),t=now/1000,n=MP.pl.length,LH=74,W=640,X0=64,X1=592;
 const k=cdText(),ov=$('#raceov');
 if(MP.state=='count'){if(k<=0){MP.state='play';sfx('go');if(ov){ov.textContent='GO!';ov.classList.add('go');setTimeout(()=>ov&&ov.classList.add('off'),700)}}else if(ov){if(MP.lastTick!=k){MP.lastTick=k;sfx('tick');ov.textContent=k;ov.classList.remove('off','go')}}}
 g.clearRect(0,0,W,c.height);g.imageSmoothingEnabled=false;
 for(let i=0;i<n;i++){const y0=14+i*LH;g.fillStyle=i%2?'#a6dc86':'#b6e898';g.fillRect(0,y0,W,LH-4);g.fillStyle='rgba(255,255,255,.35)';for(let x=X0;x<X1;x+=(X1-X0)/10)g.fillRect(x-1,y0,2,LH-4);
  g.fillStyle='#e9c98f';g.fillRect(0,y0+LH-14,W,6);
  // finish line
  for(let r=0;r<(LH-4)/8;r++){g.fillStyle=r%2?'#fff':'#333';g.fillRect(X1+22,y0+r*8,8,8);g.fillStyle=r%2?'#333':'#fff';g.fillRect(X1+30,y0+r*8,8,8)}
  const target=i==MP.me?Math.max(MP.pos[i]||0,MP.loc):(MP.pos[i]||0);MP.shown[i]=(MP.shown[i]||0)+(target-(MP.shown[i]||0))*Math.min(1,.28+(i==MP.me?.3:0));
  MP.mv=MP.mv||[];if(Math.abs(target-(MP.prev[i]||0))>.02)MP.mv[i]=now;MP.prev[i]=target;
  const p=MP.pl[i],b=DOGS.BR[p.breed],x=X0+(X1-X0)*(MP.shown[i]/100),y=y0+LH-18,moving=MP.state=='play'&&!MP.fin[i]&&now-(MP.mv[i]||0)<380;
  if(b){g.save();g.translate(x,y);g.fillStyle='rgba(60,32,22,.22)';g.beginPath();g.ellipse(0,0,26,5,0,0,7);g.fill();const sc=.62*b.size;g.translate(0,moving?-Math.abs(Math.sin(t*14+i))*4:0);g.scale(sc,sc);
   DOGS.sprite(g,b,p.variant,t+i*.3,{state:MP.fin[i]?'SIT':moving?'RUN':'IDLE',mv:moving&&!MP.fin[i],run:true,seed:i,acc:p.acc,happy:true,noAura:true});g.restore()}
  g.font='bold 11px sans-serif';g.textAlign='left';g.fillStyle=i==MP.me?'#d8325f':'#3b2a24';g.fillText((p.bot?'🤖 ':'')+p.n+(i==MP.me?' ★':''),6,y0+12);
  if(MP.fin[i]){g.font='16px sans-serif';g.fillText('🏁',X1+42,y0+LH/2+4)}}
 if(MP.state!='done')MP.raf=requestAnimationFrame(raceLoop)}
// ================= BONE GRAB =================
function startGrab(m){const me=m.pl[m.me],op=m.pl[1-m.me];
 mpModal('🦴 '+t('Bone Grab'),`<div class="grabw">${scoreBoard()}<div class="garena" id="garena"><div class="gdog l">${thumbHTML(me.breed,me.variant,44,me.acc)}</div><div class="gcen"><div class="gmsg" id="gmsg">${TT('Get ready…','เตรียมตัว…')}</div><div class="gbone" id="gbone">🦴</div></div><div class="gdog r">${thumbHTML(op.breed,op.variant,44,op.acc)}</div></div>
  <div class="muted center" id="ghint">${TT("Tap when the bone appears — NOT before!",'แตะเมื่อกระดูกโผล่ขึ้นมาเท่านั้น — อย่าแตะก่อน!')}</div><div class="row"><button class="btn sm ghost" data-do="mpleave">🚪 ${TT('Leave','ออก')}</button></div></div>`,'sm');
 paintThumbs(modOpen('mp'));const ar=$('#garena');ar.addEventListener('pointerdown',e=>{e.preventDefault();grabAct()});
 MP.keysOn=true;clearInterval(MP.iv);MP.iv=setInterval(()=>{if(MP.state=='count'){const k=cdText(),m2=$('#gmsg');if(m2&&k>0){if(MP.lastTick!=k){MP.lastTick=k;sfx('tick')}m2.textContent=k}}},100)}
function grabAct(){if(MP.g!='grab'||MP.acted)return;if(MP.state=='wait'||MP.state=='sig'){MP.acted=true;send({t:'mp_act',r:MP.rn});if(MP.state=='sig'){sfx('pop');const b=$('#gbone');if(b)b.classList.add('got')}}}
addEventListener('keydown',e=>{if(MP.g=='grab'&&mpRoomOpen()&&(e.key==' '||e.key=='Enter')&&!e.repeat){e.preventDefault();grabAct()}});
function setGrabUI(msg,cls){const a=$('#garena'),m=$('#gmsg');if(a){a.className='garena '+(cls||'')}if(m)m.innerHTML=msg}
H.mp_round=m=>{if(MP.g!='grab')return;MP.state='wait';MP.rn=m.r;MP.acted=false;MP.sc=m.sc;updScores();clearInterval(MP.iv);setGrabUI('· · ·','wait');const b=$('#gbone');if(b)b.classList.remove('got','show')};
H.mp_signal=m=>{if(MP.g!='grab')return;MP.state='sig';setGrabUI('GRAB!','sig');const b=$('#gbone');if(b)b.classList.add('show');sfx('go')};
H.mp_rr=m=>{if(MP.g!='grab')return;MP.state='res';MP.sc=m.sc;updScores();const me=MP.me,mine=m.w==me;let msg,cls;
 if(m.why=='false'){msg=mine?TT('Opponent jumped the gun! 😆','คู่ต่อสู้แตะก่อน! 😆'):TT('Too early! 😵','แตะเร็วไป! 😵');cls=mine?'win':'lose'}
 else if(m.w<0){msg=TT('Nobody reacted — again!','ไม่มีใครแตะ — เล่นรอบนี้ใหม่!');cls='wait'}
 else{msg=(mine?'⚡ '+TT('You got it!','คุณชนะรอบนี้!'):'🐢 '+TT('Too slow!','ช้าไปนิด!'))+(m.rt&&m.rt[m.w]!=null?`<small>${m.rt[m.w]} ms</small>`:'');cls=mine?'win':'lose'}
 setGrabUI(msg,cls);sfx(mine?'win':m.w<0?'click':'lose');const b=$('#gbone');if(b)b.classList.remove('show')};
function updScores(){MP.sc.forEach((v,i)=>{const e=$('#sc'+i);if(e)e.textContent=Math.round(v)})}
// ================= BREED DUEL =================
function startDuel(m){mpModal('🧠 '+t('Breed Duel'),`<div class="duelw">${scoreBoard()}<div class="dtimer"><i id="dtime"></i></div><div id="dq" class="dq center"><div class="big">${TT('Get ready…','เตรียมตัว…')}</div></div><div id="dopts" class="dopts"></div><div class="row" style="margin-top:6px"><button class="btn sm ghost" data-do="mpleave">🚪 ${TT('Leave','ออก')}</button></div></div>`,'sm');
 clearInterval(MP.iv);MP.iv=setInterval(()=>{const e=$('#dtime');if(!e)return;if(MP.state=='ask'){const k=Math.max(0,(MP.qEnd-performance.now())/MP.qms);e.style.width=k*100+'%';e.style.background=k<.25?'#ff6b6b':k<.5?'#ffc94d':'#6fd1a5';const s=Math.ceil(k*MP.qms/1000);if(s<=3&&MP.lastTick!=s&&!MP.acted){MP.lastTick=s;sfx('tick')}}else if(MP.state=='count'){const k=cdText(),q=$('#dq');if(q&&k>0)q.innerHTML='<div class="big">'+k+'</div>'}},100)}
const ansLabel=(q,o)=>q.k=='tv'?TT(o[0],o[1]):q.k=='rar'?t(RN[o]):(DOGS.BR[o]||{name:o}).name;
H.mp_q=m=>{if(MP.g!='duel')return;MP.state='ask';MP.q=m.q;MP.qi=m.i;MP.acted=false;MP.qEnd=performance.now()+m.ms;MP.qms=m.ms;MP.sc=m.sc;MP.lastTick=9;updScores();const q=m.q;let head='';
 if(q.k=='img')head=`<div class="qimg">${thumbHTML(q.breed,q.v,52,null)}</div><div class="big">${TT('Which breed is this?','นี่คือสายพันธุ์อะไร?')}</div>`;
 else if(q.k=='rare')head=`<div class="big">${q.hi?TT('Which breed is the RAREST?','สายพันธุ์ไหนหายากที่สุด?'):TT('Which breed is the most COMMON?','สายพันธุ์ไหนพบบ่อยที่สุด?')}</div>`;
 else if(q.k=='rar')head=`<div class="qimg">${thumbHTML(q.breed,q.v,52,null)}</div><div class="big">${TT('What rarity is','ความหายากของ')} ${esc(DOGS.BR[q.breed].name)}?</div>`;
 else head=`<div class="big" style="font-size:18px">${esc(TT(q.q[0],q.q[1]))}</div>`;
 $('#dq').innerHTML=`<div class="qn">${m.i+1}/${m.n}</div>`+head;
 $('#dopts').innerHTML=q.opts.map((o,i)=>`<button class="dopt" data-do="mpans" data-o="${i}">${q.k=='rare'?`<span class="oth">${thumbHTML(o,'Normal',16,null)}</span>`:''}<span>${esc(ansLabel(q,o))}</span><em class="who"></em></button>`).join('');paintThumbs(modOpen('mp'))};
DO.mpans=d=>{if(MP.g!='duel'||MP.state!='ask'||MP.acted)return;MP.acted=true;send({t:'mp_ans',i:MP.qi,o:+d.o});$$('#dopts .dopt').forEach((b,i)=>{b.classList.toggle('pick',i==+d.o);if(i!=+d.o)b.classList.add('dim')});sfx('pop')};
H.mp_qr=m=>{if(MP.g!='duel')return;MP.state='rev';MP.sc=m.sc;updScores();const mine=m.picks[MP.me];
 $$('#dopts .dopt').forEach((b,i)=>{b.classList.remove('dim');b.classList.toggle('right',i==m.a);if(i==mine&&mine!=m.a)b.classList.add('wrong');const who=m.picks.map((p,k)=>p==i?k:-1).filter(k=>k>=0).map(k=>`<i class="wb ${k==MP.me?'me':''}">${(MP.pl[k].n[0]||'?').toUpperCase()}</i>`).join('');$('.who',b).innerHTML=who});
 const gain=m.pts[MP.me];sfx(gain>0?'ok':'lose');if(gain>0){const q=$('#dq');q.insertAdjacentHTML('beforeend',`<div class="gain">+${gain}</div>`)}else if(mine<0){$('#dq').insertAdjacentHTML('beforeend',`<div class="gain bad">${TT('Time up!','หมดเวลา!')}</div>`)}};
// ================= TREAT FRENZY =================
const TRE={cookie:'🍪',bone:'🦴',star:'⭐',boot:'🥾'};
function startRush(m){mpModal('🍪 '+t('Treat Frenzy'),`<div class="rushw">${scoreBoard()}<div class="dtimer"><i id="rtime"></i></div><div class="rushf" id="rushf"><div class="rushc" id="rushc">3</div></div><div class="muted center">${TT('Tap treats before the others do! 🍪+1  🦴+3  ⭐+5  — avoid boots 🥾 (−2)','แตะขนมให้ไวกว่าคนอื่น! 🍪+1  🦴+3  ⭐+5  — เลี่ยงรองเท้า 🥾 (−2)')}</div><div class="row"><button class="btn sm ghost" data-do="mpleave">🚪 ${TT('Leave','ออก')}</button></div></div>`,'sm');
 MP.items={};MP.endAt=MP.goAt+(m.cfg.dur||24000);clearInterval(MP.iv);
 MP.iv=setInterval(()=>{const now=performance.now(),c=$('#rushc'),tm=$('#rtime');if(!tm){clearInterval(MP.iv);return}
  if(MP.state=='count'){const k=cdText();if(c&&k>0){if(MP.lastTick!=k){MP.lastTick=k;sfx('tick')}c.textContent=k}else if(c&&k<=0){MP.state='play';c.textContent='GO!';c.classList.add('go');sfx('go');setTimeout(()=>c&&c.classList.add('off'),600)}}
  if(MP.state=='play'){const k=clamp((MP.endAt-now)/(m.cfg.dur||24000),0,1);tm.style.width=k*100+'%';tm.style.background=k<.25?'#ff6b6b':k<.5?'#ffc94d':'#6fd1a5'}},80)}
H.mp_rs=m=>{if(MP.g!='rush')return;if(MP.state=='count'){MP.state='play';const c=$('#rushc');if(c)c.classList.add('off')}const f=$('#rushf');if(!f)return;
 const b=document.createElement('button');b.className='treat '+m.k;b.textContent=TRE[m.k]||'🍪';b.style.left=m.x+'%';b.style.top=m.y+'%';b.style.setProperty('--ms',m.ms+'ms');b.dataset.id=m.id;
 b.addEventListener('pointerdown',e=>{e.preventDefault();if(b.dataset.tap)return;b.dataset.tap=1;b.classList.add('tapped');send({t:'mp_hit',id:m.id});sfx(m.k=='boot'?'click':'pop')});f.append(b);MP.items[m.id]=b;if(m.k=='star')sfx('notify')};
H.mp_rx=m=>{if(MP.g!='rush')return;const b=MP.items[m.id];delete MP.items[m.id];if(m.sc){MP.sc=m.sc;updScores()}if(!b)return;const f=$('#rushf');
 if(m.by<0){b.classList.add('gone');setTimeout(()=>b.remove(),250);return}
 const mine=m.by==MP.me,x=b.style.left,y=b.style.top;b.classList.add('took');setTimeout(()=>b.remove(),300);
 if(f){const g=document.createElement('div');g.className='fl '+(m.d<0?'bad':mine?'me':'oth');g.style.left=x;g.style.top=y;g.textContent=(m.d>0?'+':'')+m.d+(mine?'':' '+((MP.pl[m.by]||{n:'?'}).n[0]||'?').toUpperCase());f.append(g);setTimeout(()=>g.remove(),900)}
 if(mine)sfx(m.d<0?'err':m.d>=3?'coin':'ok')};
// ================= ODD PUP OUT =================
function startOdd(m){mpModal('🔍 '+t('Odd Pup Out'),`<div class="duelw">${scoreBoard()}<div class="dtimer"><i id="otime"></i></div><div id="oq" class="dq center"><div class="big">${TT('Get ready…','เตรียมตัว…')}</div></div><div id="ogrid" class="ogrid"></div><div class="row" style="margin-top:6px"><button class="btn sm ghost" data-do="mpleave">🚪 ${TT('Leave','ออก')}</button></div></div>`,'sm');
 clearInterval(MP.iv);MP.iv=setInterval(()=>{const e=$('#otime');if(!e)return;if(MP.state=='ask'){const k=Math.max(0,(MP.qEnd-performance.now())/MP.qms);e.style.width=k*100+'%';e.style.background=k<.25?'#ff6b6b':k<.5?'#ffc94d':'#6fd1a5'}else if(MP.state=='count'){const k=cdText(),q=$('#oq');if(q&&k>0){if(MP.lastTick!=k){MP.lastTick=k;sfx('tick')}q.innerHTML='<div class="big">'+k+'</div>'}}},100)}
H.mp_o=m=>{if(MP.g!='odd')return;MP.state='ask';MP.qi=m.i;MP.acted=false;MP.qEnd=performance.now()+m.ms;MP.qms=m.ms;MP.sc=m.sc;MP.lockEnd=0;MP.askAt=performance.now();updScores();
 const q=$('#oq'),g=$('#ogrid');if(!q||!g)return;q.innerHTML=`<div class="qn">${m.i+1}/${m.n}</div><div class="big">${TT('Find the odd one out!','หาตัวที่แตกต่าง!')}</div>`;
 g.className='ogrid c'+(m.cells.length==9?3:4);g.innerHTML=m.cells.map((b,i)=>`<button class="ocell" data-do="mppick" data-c="${i}">${thumbHTML(b,'Normal',34,null)}</button>`).join('');paintThumbs(g);sfx('pop')};
DO.mppick=(d,el)=>{if(MP.g!='odd'||MP.state!='ask'||MP.acted)return;const now=performance.now();if(now<MP.lockEnd||now-MP.askAt<460)return;send({t:'mp_pick',i:MP.qi,c:+d.c});el.classList.add('pick');setTimeout(()=>el.classList.remove('pick'),500)};
H.mp_ow=m=>{if(MP.g!='odd')return;MP.lockEnd=performance.now()+1200;MP.sc[MP.me]=m.sc;updScores();sfx('err');const b=$$('#ogrid .ocell')[m.c];if(b)b.classList.add('wrong');$('#ogrid').classList.add('lock');setTimeout(()=>{const g=$('#ogrid');if(g)g.classList.remove('lock')},1200);toast('✖ −10',900)};
H.mp_ok=m=>{if(MP.g!='odd'||m.i!=MP.qi)return;MP.acted=true;sfx('ok');const q=$('#oq');if(q)q.insertAdjacentHTML('beforeend',`<div class="gain">✔</div>`);$('#ogrid').classList.add('lock')};
H.mp_ov=m=>{if(MP.g!='odd'||m.by==MP.me)return;const q=$('#oq');if(q&&!MP.acted)q.insertAdjacentHTML('beforeend',`<div class="gain bad" style="font-size:14px">${esc((MP.pl[m.by]||{n:'?'}).n)} ✔ !</div>`)};
H.mp_or=m=>{if(MP.g!='odd')return;MP.state='rev';MP.sc=m.sc;updScores();$$('#ogrid .ocell').forEach((b,i)=>{b.classList.toggle('right',i==m.a);if(i!=m.a)b.classList.add('dim')});const g=m.pts[MP.me];sfx(g>0?'ok':'lose');const q=$('#oq');q.querySelectorAll('.gain').forEach(x=>x.remove());q.insertAdjacentHTML('beforeend',g>0?`<div class="gain">+${g}</div>`:`<div class="gain bad">${TT('Missed!','พลาด!')}</div>`)};
// ================= results =================
H.mp_end=m=>{MP.state='done';clearInterval(MP.iv);cancelAnimationFrame(MP.raf);MP.res=m;const th=S.set.lang=='th',me=m.me,med=['🥇','🥈','🥉','4️⃣'],res=m.res.slice().sort((a,b)=>a.rank-b.rank);
 const head=me.forfeit?TT('Opponent left — you win!','คู่ต่อสู้ออกจากเกม — คุณชนะ!'):me.win?TT('You win! 🎉','คุณชนะ! 🎉'):me.rank==1?TT('Finished first','มาเป็นที่ 1'):TT('Finished #','จบอันดับที่ ')+me.rank;
 const rows=res.map(r=>`<div class="li" style="${r.n==S.name?'background:#fff3c4':''}"><b style="width:34px;font-size:20px;text-align:center">${med[r.rank-1]||r.rank}</b>${thumbHTML(r.breed,r.variant,14,null)}<div class="g"><b>${r.bot?'🤖 ':''}${esc(r.n)}${r.left?' 🚪':''}</b><small>${m.g=='race'?(r.ft?r.ft+'s':r.left?TT('left','ออก'):'—'):(m.g=='duel'||m.g=='rush'||m.g=='odd')?r.score+' pts':r.score+' / 3'}</small></div></div>`).join('');
 mpModal(gicon(m.g)+' '+gname(m.g),`<div class="center"><div class="big" style="margin:4px 0 8px">${head}</div><div class="rwbox">+${me.coins} ${ic('coin','big')} <small>· +${me.xp} XP</small></div>${!me.vsHuman?`<div class="muted">🤖 ${TT('Played with bots — rewards halved','เล่นกับบอท — รางวัลลดครึ่ง')}</div>`:''}${me.capLeft<=0?`<div class="muted" style="color:#d13c4c">${TT('Daily arcade coin cap reached','ครบเพดานเหรียญเกมออนไลน์ของวันนี้แล้ว')}</div>`:''}</div><div class="list" style="margin-top:10px">${rows}</div>
  <div class="row"><button class="btn ghost" data-do="mpclose">${TT('Back to games','กลับไปหน้าเกม')}</button><button class="btn mint" data-do="mpagain">▶ ${TT('Play again','เล่นอีกครั้ง')}</button></div>`,'sm');paintThumbs(modOpen('mp'));
 sfx(me.win?'level':me.rank<=2?'win':'lose');if(me.win){for(let i=0;i<5;i++)setTimeout(()=>burst(rnd(150,650),rnd(250,450),pick(['⭐','🎉','🏆']),3),i*140)}
 MP.g=m.g;send({t:'mp_get'})};

// ---- safety net: a game room can never leave the player stuck behind a locked window
H.mp_abort=()=>{if(MP.g||MP.state!='idle'){MP.reset();toast(TT('The game was cancelled','เกมถูกยกเลิก'))}};
for(const k of Object.keys(H))if(k.startsWith('mp_')&&k!='mp_info'&&k!='mp_abort'){const f=H[k];H[k]=function(m){MP.seen=performance.now();return f.apply(this,arguments)}}
MP.seen=performance.now();
setInterval(()=>{if(!MP.g||MP.state=='idle'||MP.state=='done')return;const lim=MP.state=='lobby'?30000:18000;if(performance.now()-MP.seen>lim){send({t:'mp_leave'});MP.reset();toast(TT('Lost contact with the game — back to home','เกมไม่ตอบสนอง — กลับหน้าหลัก'))}},2000);
const _closemod=DO.closemod;DO.closemod=d=>{if(d.id=='mp'){if(MP.state=='done'||MP.state=='idle')return DO.mpclose();if(MP.state=='lobby')return DO.mpcancel();return DO.mpleave()}_closemod(d)};
