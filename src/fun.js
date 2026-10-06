// Cozy Dogs - client for the "home" gameplay: dog wishes, fetch, lucky wheel, starter missions + tutorial, house level / sets / contest,
// party mode, guestbook + likes, mailbox. The server decides everything; this file renders and sends clicks.
'use strict';
const ago=ts=>{const s=Math.max(0,(Date.now()-ts)/1000);return s<90?TT('just now','เมื่อสักครู่'):s<5400?Math.round(s/60)+TT(' min ago',' นาทีที่แล้ว'):s<129600?Math.round(s/3600)+TT(' h ago',' ชม.ที่แล้ว'):Math.round(s/86400)+TT(' d ago',' วันที่แล้ว')};
const mmss=ms=>{const s=Math.max(0,Math.ceil(ms/1000));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
// ================= dog wishes =================
const WISH={pet:['🤚','wants some pats','อยากให้ลูบหัว'],play:['🎾','wants to play','อยากเล่นด้วย'],brush:['🧹','wants a brushing','อยากให้หวีขน'],bath:['🛁','wants a bath','อยากอาบน้ำ'],train:['🎓','wants to practise','อยากฝึกเทรน'],feed:['🍖','is craving','อยากกิน']};
const wishIcon=w=>w.k=='feed'&&S.cat.food[w.f]?S.cat.food[w.f].e:(WISH[w.k]||['💭'])[0];
const wishText=w=>{const o=WISH[w.k];if(!o)return'';let s=TT(o[1],o[2]);if(w.k=='feed'){const f=S.cat.food[w.f];s+=' '+(f?f.e+' '+f.n:'')}return s};
function drawWish(c,d,t,now,x,top){const w=d.wish;if(!w)return;const left=d.wishExp-now,bx=x+26,by=top-34+Math.sin(t*3+d.seed)*2.5;
 c.save();if(left<60000&&Math.floor(now/350)%2)c.globalAlpha=.55;c.lineWidth=2;c.strokeStyle='#5a3d33';c.fillStyle='#fff';
 c.beginPath();c.arc(bx-18,by+19,3,0,7);c.fill();c.stroke();c.beginPath();c.arc(bx-11,by+13,4.5,0,7);c.fill();c.stroke();
 c.beginPath();c.roundRect(bx-19,by-18,44,32,14);c.fill();c.stroke();c.font='20px sans-serif';c.textAlign='center';c.fillStyle='#000';c.fillText(wishIcon(w),bx-3,by+6);
 for(let i=0;i<w.need;i++){c.fillStyle=i<w.got?'#ff6b8b':'#e6d6c4';c.beginPath();c.arc(bx+16,by-9+i*7-(w.need-1)*3.2,2.6,0,7);c.fill()}
 c.restore()}
const _care=UI.care;UI.care=function(){_care();wishLine()};
const _bars=UI.careBars;UI.careBars=function(){_bars();wishLine()};
function wishLine(){const el=$('#care'),d=S.dogs[S.sel];if(!d||el.classList.contains('hidden'))return;let w=$('.wishline',el);
 if(!d.wish||S.owner!=S.name){if(w)w.remove();return}
 const html=`💭 <b>${esc(d.name)}</b> ${esc(wishText(d.wish))} <b>${d.wish.got}/${d.wish.need}</b> <small>⏳ ${mmss(d.wishExp-performance.now())}</small>`;
 if(!w){w=document.createElement('div');w.className='wishline';const top=$('.top',el);if(top)top.after(w)}w.innerHTML=html}
setInterval(wishLine,1000);
H.wish_new=m=>{if(S.owner!=S.name)return;sfx('notify');ticker('💭 '+m.name+' '+wishText(m.w))};
H.wish_done=m=>{sfx('level');const d=S.dogs[m.dog];toast('💖 '+m.name+' '+TT('is so happy!','มีความสุขมาก!')+' +'+(m.r.c||0)+'💰'+(m.r.g?' +'+m.r.g+'💎':''),3800);
 if(d&&d._pos){const[x,y,L]=d._pos;burst(x,y-L-d._top,'💖',6);sparkle(x,y-30,16,'#ffb3c7');floatText(x,y-L-d._top-30,'+'+(m.r.c||0)+'💰'+(m.r.g?' +'+m.r.g+'💎':''),'#ffe27a')}if(S.sel==m.dog)UI.care()};
// ================= fetch =================
S.fetchMode=false;
UI.fetchbtn=function(){const el=$('#fetchbtn');if(!el)return;const show=S.scr=='game'&&S.owner==S.name&&!Park.on&&!S.edit&&!MP.g;el.classList.toggle('hidden',!show);el.classList.toggle('on',!!S.fetchMode);if(!show&&S.fetchMode){S.fetchMode=false;cv.classList.remove('throw')}}
DO.fetchtog=()=>{S.fetchMode=!S.fetchMode;cv.classList.toggle('throw',S.fetchMode);UI.fetchbtn();if(S.fetchMode)toast(TT('🎾 Tap the floor to throw the ball!','🎾 แตะที่พื้นเพื่อโยนบอล!'),2200)};
function fetchThrow(x,y){send({t:'fetch',x:Math.round(x),y:Math.round(y),dog:S.sel||null});sfx('pop')}
function tball(c,x,y,r){c.fillStyle='#d9ee4a';c.strokeStyle='#5a3d33';c.lineWidth=2;c.beginPath();c.arc(x,y,r,0,7);c.fill();c.stroke();c.strokeStyle='#fff';c.lineWidth=1.6;c.beginPath();c.arc(x-r*1.05,y,r*.9,-.9,.9);c.stroke();c.beginPath();c.arc(x+r*1.05,y,r*.9,Math.PI-.9,Math.PI+.9);c.stroke()}
function fetchOverlay(c,t,now){for(const d of Object.values(S.dogs)){const f=d.fetch;if(!f)continue;const el=now-d.fetchAt;c.save();
 if(f.st==1){const k=Math.min(1,el/650),bx=400+(f.bx-400)*k,gy=572+(f.by-572)*k,h=Math.sin(k*Math.PI)*130,bounce=k>=1?Math.abs(Math.sin((el-650)/110))*9*Math.exp(-(el-650)/420):0;
  c.fillStyle='rgba(60,32,22,.25)';c.beginPath();c.ellipse(bx,gy,Math.max(5,11-h*.03),4,0,0,7);c.fill();tball(c,bx,gy-9-h-bounce,8)}
 else if(d._pos){const b=DOGS.BR[d.breed],sc=b?b.size*.9:1,[x,y,L]=d._pos;tball(c,x+d.face*30*sc,y-L-d._top*.34+Math.sin(t*10)*1.5,7)}c.restore()}}
// ================= party overlay =================
function partyOverlay(c,t,now){if(!S.party)return;if(now>S.party){S.party=0;return}
 c.save();for(let i=0;i<5;i++){const a=t*.9+i*1.26,x=400+Math.sin(a)*330,hue=(t*60+i*72)%360,gr=c.createLinearGradient(400,0,x,470);gr.addColorStop(0,`hsla(${hue},95%,72%,.30)`);gr.addColorStop(1,`hsla(${hue},95%,72%,0)`);c.fillStyle=gr;c.beginPath();c.moveTo(394,0);c.lineTo(406,0);c.lineTo(x+80,480);c.lineTo(x-80,480);c.closePath();c.fill()}
 c.strokeStyle='#8a8aa0';c.lineWidth=2;c.beginPath();c.moveTo(400,0);c.lineTo(400,38);c.stroke();const gr=c.createRadialGradient(394,44,2,400,52,18);gr.addColorStop(0,'#fff');gr.addColorStop(1,'#98a0c0');c.fillStyle=gr;c.beginPath();c.arc(400,52,17,0,7);c.fill();c.strokeStyle='#5a3d33';c.lineWidth=2;c.stroke();
 for(let k=0;k<9;k++){const a=t*2+k*.7;if(Math.sin(a*2)>0){c.fillStyle='#fff';c.fillRect(400+Math.cos(a)*14-1,52+Math.sin(a*1.3)*12-1,3,3)}}
 c.font='bold 15px '+UIF();c.textAlign='center';c.lineWidth=4;c.strokeStyle='#5a3d33';const lab='🎉 PARTY '+mmss(S.party-now);c.strokeText(lab,400,92);c.fillStyle='#fff';c.fillText(lab,400,92);c.restore();
 if(Math.random()<.4)fx('spark',rnd(60,740),rnd(0,30),{vx:rnd(-20,20),vy:rnd(40,90),g:60,life:2.2,max:2.2,size:rnd(3,5),col:pick(['#ff8fb0','#ffc94d','#6fd1a5','#6fb8ff','#b79bff'])})}
function worldAfter(c,t,now){editOverlay(c,t);partyOverlay(c,t,now);fetchOverlay(c,t,now)}
H.party=m=>{if(m.owner!=S.owner)return;S.party=m.ms>0?performance.now()+m.ms:0;if(m.ms>0){sfx('level');ticker('🎉 '+TT('Party time!','ปาร์ตี้เริ่มแล้ว!'))}if(modOpen('house'))renderHouse()};
H.party_inv=m=>{sfx('notify');ask('🎉 '+esc(m.from)+' '+TT('is throwing a party! Join now?','กำลังจัดปาร์ตี้อยู่! ไปร่วมเลยไหม?'),()=>DO.visit({n:m.from}),{yes:TT('Join','ไปเลย'),title:'🎉 '+TT('Party','ปาร์ตี้'),cls:'mint'})};
// ================= generic server events =================
H.ev=m=>{if(m.k=='mail'){sfx('notify');toast('✉️ '+TT('New mail','มีจดหมายใหม่')+(m.from?' · '+m.from:''))}
 else if(m.k=='guest'){sfx('notify');toast('🎉 '+m.n+' '+TT('joined your party!','มาร่วมปาร์ตี้ของคุณ!'))}
 else if(m.k=='season'&&S.welcome&&S.welcome.events&&!S.evShown){S.evShown=1;const e=S.welcome.events[m.id];if(e)setTimeout(()=>ticker(e.e+' '+t(e.n)+' — '+t(e.d)),2500)}};
// ================= lucky wheel =================
H.spin_info=m=>{S.spin=m;if(S.spinning)return;if(modOpen('wheel'))renderWheel();if(modOpen('games'))renderHub()};
DO.wheel=()=>{send({t:'spin_get'});renderWheel()};
const WCOL=['#ffd0de','#c9ecff','#fff0b0','#d6f5e3','#e6d8ff','#ffe0c2','#ffd0de','#c9ecff'];
function renderWheel(){const sp=S.spin||{wheel:[],free:true,left:4,tk:S.me.tickets};
 modal('wheel','🎰 '+TT('Lucky Wheel','วงล้อนำโชค'),`<div class="center"><div class="wheelw"><canvas id="wheelc" width="300" height="300"></canvas><div class="wptr">▼</div></div><div class="big" id="wres" style="min-height:34px;margin:6px 0">${S.wheelMsg||''}</div>
  <div class="muted">${sp.free?TT('Your daily spin is free!','หมุนฟรีวันนี้ 1 ครั้ง!'):TT('Extra spins cost 1 ticket','หมุนเพิ่มใช้ 1 ตั๋ว')} · ${TT('Spins left today','เหลือหมุนได้วันนี้')}: <b>${sp.left}</b> · 🎟 ${S.me.tickets}</div>
  <button class="btn ${sp.left>0&&(sp.free||S.me.tickets>0)?'mint':'dis'}" id="spinbtn" data-do="dospin" style="margin-top:10px">${sp.free?'🎁 '+TT('SPIN (free)','หมุน (ฟรี)'):'🎟 '+TT('SPIN (1 ticket)','หมุน (1 ตั๋ว)')}</button></div>`,'sm');drawWheel(S.wheelRot||0)}
function drawWheel(rot){const c=$('#wheelc');if(!c)return;const g=c.getContext('2d'),W=S.spin?S.spin.wheel:[];g.clearRect(0,0,300,300);g.save();g.translate(150,150);g.rotate(rot*Math.PI/180);
 for(let i=0;i<8;i++){g.beginPath();g.moveTo(0,0);g.arc(0,0,142,(-90+i*45)*Math.PI/180,(-90+(i+1)*45)*Math.PI/180);g.closePath();g.fillStyle=WCOL[i];g.fill();g.strokeStyle='#5a3d33';g.lineWidth=3;g.stroke();
  g.save();g.rotate((-90+i*45+22.5)*Math.PI/180);g.translate(92,0);g.rotate(Math.PI/2);g.fillStyle='#5a3d33';g.font='bold 15px sans-serif';g.textAlign='center';g.fillText(W[i]||'',0,5);g.restore()}
 g.restore();g.fillStyle='#fff';g.strokeStyle='#5a3d33';g.lineWidth=4;g.beginPath();g.arc(150,150,22,0,7);g.fill();g.stroke();g.font='22px sans-serif';g.textAlign='center';g.fillText('🐾',150,158)}
DO.dospin=()=>{if(S.spinning)return;const sp=S.spin;if(!sp||sp.left<=0||(!sp.free&&S.me.tickets<1))return toast(TT('No spins left','ไม่มีสิทธิ์หมุนแล้ว'));S.spinning=true;S.wheelMsg='';const b=$('#spinbtn');if(b)b.classList.add('dis');send({t:'spin'});setTimeout(()=>{if(S.spinning){S.spinning=false;if(modOpen('wheel'))renderWheel()}},9000)};
H.spin_r=m=>{const cur=((S.wheelRot||0)%360+360)%360,want=((-(m.idx*45+22.5))%360+360)%360,delta=((want-cur)%360+360)%360,from=S.wheelRot||0,to=from+360*5+delta,t0=performance.now(),dur=4200;S.spinning=true;
 const step=()=>{const k=Math.min(1,(performance.now()-t0)/dur),e=1-Math.pow(1-k,3);S.wheelRot=from+(to-from)*e;drawWheel(S.wheelRot);if(k<1&&$('#wheelc')){if(Math.floor((S.wheelRot)/45)!=Math.floor((S.wheelRot-8)/45))sfx('step');requestAnimationFrame(step)}else{S.wheelRot=to%360;S.spinning=false;
   const r=m.r||{},txt=(r.c?r.c+'💰 ':'')+(r.g?r.g+'💎 ':'')+(r.tk?r.tk+'🎟 ':'')+(r.inv?Object.entries(r.inv).map(([k,n])=>((S.cat.food[k]||{}).e||'🎁')+'×'+n).join(' '):'');S.wheelMsg='🎉 '+txt;sfx('level');if(modOpen('wheel'))renderWheel();for(let i=0;i<4;i++)setTimeout(()=>burst(rnd(200,600),rnd(250,420),pick(['⭐','🎉','✨']),3),i*120)}};requestAnimationFrame(step)};
// ================= starter missions + tutorial =================
H.starter=m=>{S.starter=m;UI.starterpill();if(modOpen('starter'))renderStarter()};
UI.starterpill=function(){const el=$('#starterpill');if(!el)return;const st=S.starter,done=S.me.stDone;if(!st||done||S.scr!='game'){el.classList.add('hidden');return}el.classList.remove('hidden');const n=st.list.filter(x=>x.claimed).length,rd=S.me.stReady||0;
 el.innerHTML=`<span class="e">🌱</span><div class="gp"><b>${TT('Starter missions','ภารกิจมือใหม่')}</b><div class="prog"><i style="width:${n/st.list.length*100}%"></i></div></div><span class="pc">${n}/${st.list.length}</span>${rd?`<span class="bd">${rd}</span>`:''}`}
DO.starter=()=>{send({t:'starter'});renderStarter()};
function renderStarter(){const st=S.starter;if(!st)return modal('starter','🌱 '+TT('Starter missions','ภารกิจมือใหม่'),'<div class="muted center">…</div>','sm');
 const rows='<div class="list">'+st.list.map(x=>`<div class="li"><div class="g"><b>${esc(t(x.t))}</b><div class="prog"><i style="width:${x.prog/x.goal*100}%"></i></div><small>${x.prog}/${x.goal}</small></div><span class="rw">${rewardTxt(x.r)}</span><button class="btn sm ${x.claimed?'dis':x.prog>=x.goal?'mint':'dis'}" data-do="stclaim" data-i="${x.i}">${x.claimed?'✔':t('Claim')}</button></div>`).join('')+'</div>';
 const b=st.bonus;modal('starter','🌱 '+TT('Starter missions','ภารกิจมือใหม่'),`<div class="muted" style="margin-bottom:8px">${TT('Easy one-time missions to learn the game. Finish them all for a big bonus!','ภารกิจครั้งเดียวสำหรับทำความรู้จักเกม ทำครบทุกข้อรับโบนัสก้อนใหญ่!')}</div>${rows}
  <div class="list"><div class="li" style="background:#fff3c4"><div class="g"><b>🎉 ${TT('All done bonus','โบนัสทำครบทุกข้อ')}</b></div><span class="rw">${rewardTxt(b.r)}</span><button class="btn sm ${b.claimed?'dis':b.ready?'mint':'dis'}" data-do="stbonus">${b.claimed?'✔':t('Claim')}</button></div></div>`,'sm')}
DO.stclaim=d=>send({t:'starter_claim',i:+d.i});DO.stbonus=()=>send({t:'starter_bonus'});
const TUT=[{e:'🐶',tx:['Welcome to Cozy Dogs! This is your home — your dogs live here.','ยินดีต้อนรับสู่ Cozy Dogs! นี่คือบ้านของคุณ น้องหมาอาศัยอยู่ที่นี่'],hl:null},
 {e:'👆',tx:['Tap a dog to open its care card: pet, feed, play, brush, bath and train to grow Bond ❤️.','แตะที่น้องหมาเพื่อเปิดการ์ดดูแล: ลูบหัว ให้อาหาร เล่น หวีขน อาบน้ำ เทรน เพื่อเพิ่ม Bond ❤️'],hl:'#cv'},
 {e:'💭',tx:['Dogs sometimes make a wish 💭 — grant it for bonus coins! The 🎾 button lets you throw a ball for fetch.','บางครั้งน้องหมาจะขอของ 💭 ทำตามเพื่อรับเหรียญโบนัส! ปุ่ม 🎾 ใช้โยนบอลให้คาบกลับมา'],hl:'#fetchbtn'},
 {e:'🧭',tx:['The dock has everything: Shop, Capsules, Friends, the Dog Park 🌳, online Games 🎮 and your House 🏡.','แถบด้านล่างมีทุกอย่าง: ร้านค้า กาชา เพื่อน สวนหมา 🌳 เกมออนไลน์ 🎮 และบ้าน 🏡'],hl:'#dock'},
 {e:'🌱',tx:['Finish the Starter missions for easy rewards. Have fun!','ทำภารกิจมือใหม่เพื่อรับรางวัลง่าย ๆ สนุกนะ!'],hl:'#starterpill'}];
function tutStart(){if(S.me.tut||S.tutOn||S.scr!='game')return;if(S.owner!=S.name||Park.on||MP.g||S.edit){setTimeout(tutStart,2000);return}if(modOpen('daily')||modOpen('help')||$('#mods .ov')){setTimeout(tutStart,1500);return}S.tutOn=true;S.tutI=0;tutShow()}
function tutShow(){const el=$('#coach'),s=TUT[S.tutI];$$('.hl').forEach(e=>e.classList.remove('hl'));if(!s){return tutEnd()}
 el.classList.remove('hidden');el.innerHTML=`<div class="ce">${s.e}</div><div class="ct">${TT(s.tx[0],s.tx[1])}<div class="cn">${S.tutI+1}/${TUT.length}</div></div><div class="cb"><button class="btn sm ghost" data-do="tutskip">${TT('Skip','ข้าม')}</button><button class="btn sm mint" data-do="tutnext">${S.tutI==TUT.length-1?TT('Got it!','เข้าใจแล้ว!'):TT('Next','ต่อไป')} ▶</button></div>`;
 const h=s.hl&&$(s.hl);if(h&&!h.classList.contains('hidden'))h.classList.add('hl')}
DO.tutnext=()=>{S.tutI++;tutShow()};DO.tutskip=()=>tutEnd();
function tutEnd(){S.tutOn=false;$('#coach').classList.add('hidden');$$('.hl').forEach(e=>e.classList.remove('hl'));if(!S.me.tut){S.me.tut=true;send({t:'tutorial'})}}
// ================= house: level, sets, contest =================
H.house_info=m=>{S.hinfo=m;if(modOpen('house'))renderHouse()};
H.contest=m=>{S.contest=m;if(modOpen('house'))renderHouse()};
DO.house=()=>{send({t:'house_info'});send({t:'contest_get'});S.houseTab=S.houseTab||'h';renderHouse()};
DO.htab=d=>{S.houseTab=d.k;renderHouse()};
DO.houseup=()=>send({t:'house_up'});
DO.partygo=()=>send({t:'party_start'});
function renderHouse(){const hi=S.hinfo,tab=S.houseTab||'h',th=S.set.lang=='th';
 const tabs=`<div class="tabs2">${[['h','🏡 '+TT('House','บ้าน')],['s','🧩 '+TT('Sets','ชุดเฟอร์')],['c','🏅 '+TT('Contest','ประกวด')]].map(([k,l])=>`<button class="${tab==k?'on':''}" data-do="htab" data-k="${k}">${l}</button>`).join('')}</div>`;
 if(!hi)return modal('house','🏡 '+TT('My House','บ้านของฉัน'),tabs+'<div class="muted center">…</div>','sm');
 let body='';
 if(tab=='h'){const nx=hi.next,W=S.welcome,perks=hi.perks||[],homeDogs=Object.keys(S.dogs).length,pty=S.party&&S.owner==S.name?S.party-performance.now():0,canUp=nx&&S.me.lvl>=nx.lvl&&S.me.coins>=nx.c&&S.me.gems>=(nx.g||0);
  body=`<div class="househead"><div class="hlv">${hi.hl+1}<small>/${W?W.house.length:4}</small></div><div style="flex:1"><div class="big" style="font-size:19px">${TT('House level','ระดับบ้าน')} ${hi.hl+1}</div><div class="muted">🛋️ ${TT('Furniture','เฟอร์นิเจอร์')} ${hi.items}/${hi.maxItems} · 🐶 ${TT('Dogs at home','หมาที่บ้าน')} ${homeDogs}/${hi.maxDogs}</div></div></div>
   <div class="stats4"><div><b>${hi.cozy.score}</b><small>🛋️ ${TT('Cozy score','คะแนนความอบอุ่น')}</small></div><div><b>${hi.likes}</b><small>❤️ ${TT('Likes','ถูกใจ')}</small></div><div><b>${hi.cozy.sets.length}/${W?W.sets.length:7}</b><small>🧩 ${TT('Sets','ชุดเฟอร์')}</small></div></div>
   ${nx?`<div class="list" style="margin-top:10px"><div class="li"><div class="g"><b>⬆️ ${TT('Upgrade to level','อัปเกรดเป็นระดับ')} ${hi.hl+2}</b><small>${TT('Furniture','เฟอร์')} ${hi.maxItems}→<b>${nx.items}</b> · ${TT('Dogs','หมา')} ${hi.maxDogs}→<b>${nx.dogs}</b></small><small>${TT('Needs player level','ต้องเลเวล')} ${nx.lvl}${S.me.lvl>=nx.lvl?' ✔':' ✖'}</small></div><span class="rw">${nx.c} ${ic('coin','sm')}${nx.g?'<br>'+nx.g+' '+ic('gem','sm'):''}</span><button class="btn sm ${canUp?'mint':'dis'}" data-do="houseup">${TT('Upgrade','อัปเกรด')}</button></div></div>`:`<div class="list" style="margin-top:10px"><div class="li" style="background:#fff3c4"><div class="g"><b>🏆 ${TT('Max level reached!','อัปเกรดสูงสุดแล้ว!')}</b></div></div></div>`}
   ${perks.length?`<h4 style="margin:12px 0 6px">✨ ${TT('Active perks','โบนัสที่ใช้งานอยู่')}</h4><div class="sel-row">${perks.map(p=>`<span class="opt on">${esc(t(W.perks[p]))}</span>`).join('')}</div>`:`<div class="muted" style="margin-top:10px">🧩 ${TT('Complete furniture sets to unlock perks!','จัดเฟอร์ให้ครบชุดเพื่อรับโบนัสพิเศษ!')}</div>`}
   <h4 style="margin:12px 0 6px">🎉 ${TT('Party','ปาร์ตี้')}</h4><div class="list"><div class="li"><div class="g"><b>${pty>0?TT('Party in progress!','ปาร์ตี้กำลังสนุก!')+' ⏳ '+mmss(pty):TT('Throw a party','จัดปาร์ตี้')}</b><small>${TT('5 minutes · friends are invited · guests earn coins · dogs go wild','5 นาที · เชิญเพื่อนอัตโนมัติ · แขกได้เหรียญ · น้องหมาเต้นกันสนุก')}</small></div><button class="btn sm ${pty>0||S.owner!=S.name?'dis':'pink'}" data-do="partygo">🎉 40💰</button></div></div>
   <div class="row" style="margin-top:12px;flex-wrap:wrap"><button class="btn sky" data-do="gbopen" data-n="${esc(S.name)}">📖 ${TT('Guestbook','สมุดเยี่ยม')}</button><button class="btn lav" data-do="mail">✉️ ${TT('Mailbox','กล่องจดหมาย')}</button></div>`}
 else if(tab=='s'){const W=S.welcome,placed=new Set(S.owner==S.name?S.items.map(i=>i.type):[]);
  body=`<div class="muted" style="margin-bottom:8px">${TT('Place every piece of a set in your house to unlock its perk and bonus cozy points.','วางเฟอร์ให้ครบทุกชิ้นของชุดเพื่อรับโบนัสพิเศษและคะแนนความอบอุ่น')}</div>`+(W?W.sets.map(s=>{const info=hi.sets.find(x=>x.id==s.id)||{have:0,total:s.need.length,done:false};
   return`<div class="setc ${info.done?'done':''}"><div class="sh"><span class="e">${s.e}</span><div style="flex:1"><b>${esc(t(s.n))}</b> ${info.done?'<span class="pill on">✔</span>':''}<div class="muted">✨ ${esc(t(W.perks[s.perk]))} · +${s.pts} 🛋️</div></div><b>${info.have}/${info.total}</b></div><div class="sit">${s.need.map(id=>{const it=S.cat.items[id];return`<div class="${placed.has(id)?'on':''}" title="${esc(it.n)}">${itThumb(it.draw,it.pal,22)}<small>${esc(it.n)}</small></div>`}).join('')}</div></div>`}).join(''):'');}
 else{const c=S.contest,med=['🥇','🥈','🥉'];
  if(!c)body='<div class="muted center">…</div>';else body=`<div class="goalhead"><span class="ge">🏅</span><div style="flex:1"><div class="big" style="font-size:19px">${TT('Weekly House Contest','ประกวดบ้านประจำสัปดาห์')}</div><div class="muted">${TT('Visitors give ❤️ to the coziest houses. Top 3 each week win prizes by mail!','ผู้มาเยี่ยมกด ❤️ ให้บ้านที่ชอบ 3 อันดับแรกของสัปดาห์ได้รางวัลทางจดหมาย!')}</div></div><div class="pill">⏳ ${countdown(c.ends)}</div></div>
   <div class="sel-row" style="margin-bottom:8px">${c.prizes.map((p,i)=>`<span class="opt">${med[i]} ${rewardTxt(p)}</span>`).join('')}</div>
   <div class="list">${c.top.map((x,i)=>`<div class="li" style="${x.n==S.name?'background:#fff3c4':''}" data-do="visit" data-n="${esc(x.n)}"><b style="width:34px;font-size:20px;text-align:center">${med[i]||i+1}</b><div class="g"><b>${esc(x.n)}</b><small>🛋️ ${x.cozy}</small></div><span class="rw">❤️ ${x.v}</span></div>`).join('')||`<div class="muted center" style="padding:14px">${TT('No likes yet this week — visit a house and tap ❤️!','สัปดาห์นี้ยังไม่มีใครได้ ❤️ — ไปเยี่ยมบ้านเพื่อนแล้วกดหัวใจเลย!')}</div>`}</div>
   <div class="center muted" style="margin-top:6px">${TT('Your rank','อันดับของคุณ')}: ${c.me.rank?'#'+c.me.rank:'—'} · ❤️ ${c.me.v}</div>
   ${c.prev&&c.prev.length?`<h4 style="margin:12px 0 6px">🏆 ${TT('Last week','สัปดาห์ที่แล้ว')}</h4><div class="sel-row">${c.prev.map((x,i)=>`<span class="opt on">${med[i]} ${esc(x.n)} ❤️${x.v}</span>`).join('')}</div>`:''}`}
 modal('house','🏡 '+TT('My House','บ้านของฉัน'),tabs+body,'sm');if(tab=='s')paintItemThumbs(modOpen('house'))}
// ================= guestbook + likes =================
DO.gbopen=d=>{const owner=(d&&d.n)||S.owner;S.gbOwner=owner;send({t:'gb_get',owner});renderGB()};
H.gb=m=>{S.gbData=m;if(modOpen('gb')&&m.owner==S.gbOwner)renderGB();if(m.owner==S.owner&&S.owner!=S.name)UI.bars()};
function renderGB(){const m=S.gbData&&S.gbData.owner==S.gbOwner?S.gbData:null,owner=S.gbOwner,mine=owner==S.name;
 if(!m)return modal('gb','📖 '+TT('Guestbook','สมุดเยี่ยม'),'<div class="muted center">…</div>','sm');
 const visiting=!mine&&S.owner==owner&&!S.guest;
 modal('gb','📖 '+TT('Guestbook','สมุดเยี่ยม')+' · '+esc(owner),`<div class="row" style="margin-bottom:8px"><div class="pill" style="text-align:center">❤️ ${m.likes}</div><div class="pill" style="text-align:center">🛋️ ${m.cozy}</div>${visiting?`<button class="btn sm ${m.liked?'dis':'pink'}" data-do="gblike">❤️ ${m.liked?TT('Liked','ถูกใจแล้ว'):TT('Like','ถูกใจ')}</button>`:''}</div>
  ${visiting?`<form id="gbf" class="row" style="margin-bottom:8px"><input id="gbin" maxlength="60" placeholder="${TT('Write something nice…','เขียนอะไรดี ๆ ทิ้งไว้…')}" style="flex:3;border:3px solid var(--ink);border-radius:10px;padding:6px 10px;font-weight:800;user-select:text"><button class="btn sm mint" type="submit">✍️</button></form>`:(S.guest&&!mine?`<div class="muted" style="margin-bottom:8px">${TT('Register an account to write in guestbooks.','สมัครบัญชีก่อนถึงจะเขียนสมุดเยี่ยมได้')}</div>`:'')}
  <div class="list">${m.list.map(e=>`<div class="li"><div class="g"><b>${esc(e.n)}</b><div style="font-weight:700;font-size:14px;word-break:break-word">${esc(e.m)}</div><small>${ago(e.t)}</small></div>${mine?`<button class="btn sm ghost" data-do="gbdel" data-id="${e.id}">✕</button>`:''}</div>`).join('')||`<div class="muted center" style="padding:16px">${TT('No messages yet.','ยังไม่มีข้อความ')}</div>`}</div>`,'sm');
 const f=$('#gbf');if(f)f.onsubmit=e=>{e.preventDefault();const i=$('#gbin');if(i.value.trim()){send({t:'gb_post',owner,text:i.value});i.value='';sfx('ok')}}}
DO.gblike=()=>{send({t:'like',owner:S.owner});sfx('pop')};
DO.gbdel=d=>send({t:'gb_del',id:d.id});
// ================= mailbox =================
H.mail=m=>{S.mail=m.list;if(modOpen('mail'))renderMail()};
DO.mail=()=>{send({t:'mail_get'});renderMail()};
function mailText(m){const f=esc(m.from||'');switch(m.k){case'gift':return`🎁 <b>${f}</b> ${TT('sent you a gift','ส่งของขวัญให้คุณ')}`;case'like':return`❤️ <b>${f}</b> ${TT('liked your house','กดถูกใจบ้านของคุณ')}`;
 case'gb':return`📖 <b>${f}</b> ${TT('signed your guestbook','เขียนสมุดเยี่ยมบ้านคุณ')}${m.text?': “'+esc(m.text)+'”':''}`;case'visit':return`👋 <b>${f}</b> ${TT('visited while you were away','มาเยี่ยมตอนคุณไม่อยู่')}`;
 case'contest':return`🏆 ${TT('Weekly house contest — you placed','ประกวดบ้านประจำสัปดาห์ — คุณได้อันดับ')} #${m.rank}!`;default:return`🎁 ${TT('A present from Cozy Dogs','ของขวัญจาก Cozy Dogs')}`}}
function renderMail(){const list=S.mail;if(!list)return modal('mail','✉️ '+TT('Mailbox','กล่องจดหมาย'),'<div class="muted center">…</div>','sm');const has=list.some(m=>m.r&&!m.claimed);
 modal('mail','✉️ '+TT('Mailbox','กล่องจดหมาย'),`<div class="row" style="margin-bottom:8px"><button class="btn sm ${has?'mint':'dis'}" data-do="mailall">🎁 ${TT('Claim all','รับทั้งหมด')}</button><button class="btn sm ghost" data-do="mailclear">🗑️ ${TT('Clear read','ล้างที่อ่านแล้ว')}</button></div>
  <div class="list">${list.map(m=>`<div class="li"><div class="g"><div style="font-weight:700;font-size:14px">${mailText(m)}</div><small>${ago(m.t)}</small></div>${m.r?`<span class="rw">${rewardTxt(m.r)}</span><button class="btn sm ${m.claimed?'dis':'mint'}" data-do="mailclaim" data-id="${m.id}">${m.claimed?'✔':t('Claim')}</button>`:`<button class="btn sm ghost" data-do="maildel" data-id="${m.id}">✕</button>`}</div>`).join('')||emptyState('กล่องจดหมายว่างเปล่า — ถ้ามีข่าวใหม่จะมาที่นี่นะ','Your mailbox is empty — news will show up here','💌')}</div>`,'sm')}
DO.mailclaim=d=>send({t:'mail_claim',id:d.id});DO.mailall=()=>send({t:'mail_claim_all'});DO.maildel=d=>send({t:'mail_del',id:d.id});DO.mailclear=()=>send({t:'mail_clear'});
// ================= help: v5 additions =================
const _help=DO.help;DO.help=function(){_help.apply(this,arguments);const l=$('#mods .ov[data-mod="help"] .list');if(!l)return;const row=(e,b,s)=>`<div class="li"><span style="font-size:28px">${e}</span><div class="g"><b>${b}</b><small>${s}</small></div></div>`;
 if(l.children[2])l.children[2].insertAdjacentHTML('afterend',row('👕',TT('Your own character','ตัวคุณเอง'),TT('Tap your character at home (or the 👕 button) to change hair, face, skin and outfit — fancy pieces cost coins once, then they are yours. In the park you walk your dog on a leash!','แตะตัวละครของคุณในบ้าน (หรือปุ่ม 👕) เพื่อเปลี่ยนทรงผม หน้าตา สีผิว และชุด — ชิ้นพิเศษซื้อด้วยเหรียญครั้งเดียวได้ตลอดไป ไปสวนแล้วคุณจะจูงน้องหมาเดินเอง!')));
 l.insertAdjacentHTML('beforeend',row('💭',TT('Wishes & fetch','คำขอและโยนบอล'),TT('Dogs make wishes by personality — grant them for bonus coins. Tap 🎾 then the floor to play fetch.','น้องหมาจะขอของตามนิสัย ทำตามเพื่อรับเหรียญโบนัส กด 🎾 แล้วแตะพื้นเพื่อโยนบอล'))+
 row('🏡',TT('House, sets & party','บ้าน ชุดเฟอร์ และปาร์ตี้'),TT('Upgrade your house, complete furniture sets for perks, throw parties, collect guestbook notes and ❤️ — top 3 houses win weekly prizes by mail.','อัปเกรดบ้าน จัดเฟอร์ให้ครบชุดรับโบนัส จัดปาร์ตี้ เก็บสมุดเยี่ยมและ ❤️ — 3 อันดับบ้านแห่งสัปดาห์ได้รางวัลทางจดหมาย'))+
 row('🌐',TT('Online games','เกมออนไลน์'),TT('Dog Race, Bone Grab, Treat Frenzy, Odd Pup Out and Breed Duel — real players first, bots fill in if nobody is around.','แข่งวิ่งหมา แย่งกระดูก แย่งขนม หาน้องหมาตัวแปลก และดวลสายพันธุ์ — เจอผู้เล่นจริงก่อน ถ้าไม่มีใครจะมีบอทมาเล่นด้วย'))+
 row('⛏️',TT('Dig for treasure','ขุดสมบัติ'),TT('In the Park tap ⛏️ to dig. Hot/warm/cool hints lead you to the shared treasure; catch the frisbee 🥏 for coins!','ในสวนหมากด ⛏️ เพื่อขุด คำใบ้ ร้อน/อุ่น/เย็น จะพาไปหาสมบัติกลาง และอย่าลืมรับจานร่อน 🥏 เพื่อรับเหรียญ!')))};
