// Cozy Dogs - Dog Brawl (client).
// The server owns the rules (brawl.js + brawl_data.js - build.js embeds the data here as window.BRD, so both sides always use the same numbers).
// This file lets the player choose a fighter, draws the arena, sends ONE move per round and plays back the events the server sends (hits, misses, skills, K.O.s).
'use strict';
Object.assign(TH,{'Dog Brawl':'หมากัดกัน'});
const BWL=()=>S.set.lang=='th'?1:0,bwN=o=>o.n[BWL()],bwD=o=>o.d[BWL()];
SFX.bhit=()=>{tone(180,.12,'square',.08,0,.5);tone(95,.14,'sawtooth',.06,.02)};
SFX.bcrit=()=>{tone(280,.1,'square',.09);tone(560,.18,'square',.08,.07,1.3);tone(90,.16,'sawtooth',.07,.02)};
SFX.bmiss=()=>tone(520,.18,'sine',.05,0,.4);
SFX.bheal=()=>{tone(523,.1,'sine',.07);tone(784,.2,'sine',.07,.09)};
SFX.bshield=()=>tone(300,.2,'triangle',.08,0,1.6);
SFX.bko=()=>tone(330,.5,'sawtooth',.07,0,.35);
SFX.bbuff=()=>{tone(440,.09,'square',.05);tone(660,.12,'square',.05,.07)};
SFX.bsel=()=>tone(700,.05,'square',.04);

const BW={on:false,ph:'idle',N:0,pl:[],me:0,order:[],slot:[],stepT:0,raf:0,uiT:0,chosen:null,top:[],sig:[]};

// ================================================================ fighter chooser
const bwStats=id=>{const b=DOGS.BR[id]||{r:'C',size:.9};return BRD.statsFor(id,b.r,b.size)};
let bwMaxMemo=null;
function bwMax(){if(bwMaxMemo)return bwMaxMemo;const m={hp:1,atk:1,def:1,spd:1};for(const id in DOGS.BR){const s=bwStats(id);for(const k in m)m[k]=Math.max(m[k],s[k])}return bwMaxMemo=m}
const bwDogs=()=>{const all=S.allDogs||[],home=all.filter(d=>!d.away);return home.length?home:all};
function bwStatBars(s){const M=bwMax();return[['❤️','HP',s.hp,M.hp],['⚔️','ATK',s.atk,M.atk],['🛡️','DEF',s.def,M.def],['💨','SPD',s.spd,M.spd]].map(([e,l,v,m])=>`<div class="bstat"><span>${e} ${l}</span><div class="bbar"><i style="width:${Math.max(8,Math.round(v/m*100))}%"></i></div><b>${v}</b></div>`).join('')}
function bwSkillRow(id){const k=BRD.SK[id];return`<div class="bsk2"><i>${k.ic}</i><div><b>${esc(bwN(k))}</b> <em>⚡${k.cost}</em><small>${esc(bwD(k))}</small></div></div>`}
function bwDetail(d){const b=DOGS.BR[d.breed],s=bwStats(d.breed),A=BRD.ARCH[s.arch];
 return`<div class="bpd"><div class="bpt"><b>${esc(d.name)}</b> <span class="muted">${esc(b.name)}</span> ${rarTag(b.r)} <span class="pill">${A.ic} ${A.n[BWL()]}</span></div><div class="bstats">${bwStatBars(s)}</div><div class="bskl">${s.sk.map(bwSkillRow).join('')}</div></div>`}
DO.brpick=()=>{send({t:'dogs_get'});renderBrawlPick()};
function renderBrawlPick(){const dogs=bwDogs(),pref=BW.chosen||LS.get('cd_brdog',null)||LS.get('cd_pdog',null),cur=dogs.find(d=>d.id==pref)||dogs[0];BW.chosen=cur?cur.id:null;
 const body=!dogs.length?`<div class="muted center" style="padding:24px">…</div>`:
  `<div class="muted">${TT('Every dog fights with its own stats and 2 skills — pick who steps into the ring!','น้องหมาแต่ละตัวมีค่าพลังและสกิลไม่เหมือนกัน เลือกตัวที่จะลงสังเวียนเลย!')}</div>
   <div class="bpgrid">${dogs.map(d=>{const s=bwStats(d.breed),A=BRD.ARCH[s.arch];return`<div class="bpc ${cur&&cur.id==d.id?'sel':''}" data-do="brsel" data-id="${d.id}">${thumbHTML(d.breed,d.variant,30,d.acc)}<b>${esc(d.name)}</b><small>${A.ic} ${A.n[BWL()]}</small></div>`}).join('')}</div>${bwDetail(cur)}`;
 modal('bpick','⚔️ '+TT('Dog Brawl — choose your fighter','หมากัดกัน — เลือกนักสู้'),body+`<div class="row" style="margin-top:10px"><button class="btn ghost" data-do="brhelp">❓ ${TT('How to play','วิธีเล่น')}</button><button class="btn mint" data-do="brgo"${cur?'':' disabled'}>⚔️ ${TT('Find a fight','หาคู่ต่อสู้')}</button></div>`,'');
 paintThumbs(modOpen('bpick'))}
DO.brsel=d=>{BW.chosen=d.id;renderBrawlPick()};
DO.brgo=()=>{const cur=bwDogs().find(d=>d.id==BW.chosen);if(!cur)return;LS.set('cd_brdog',cur.id);closeMod('bpick');DO.mpfind({g:'brawl',dog:cur.id})};
DO.brhelp=()=>{const L=BWL(),B=BRD.BASIC,C=BRD.CFG,secs=C.ms/1000;
 modal('brhelp','❓ '+TT('Dog Brawl — how to play','หมากัดกัน — วิธีเล่น'),`<div class="bhelp">
  <p>🎯 <b>${TT('Goal','เป้าหมาย')}</b> — ${TT(`Knock out the other dogs! After ${C.rounds} rounds (or when only one dog is left) the survivors are ranked by HP left, then by damage dealt. Knocked-out dogs rank by who lasted longer.`,`ล้มน้องหมาตัวอื่นให้หมด! ครบ ${C.rounds} รอบ (หรือเหลือตัวเดียว) จะจัดอันดับตัวที่รอดจาก HP ที่เหลือ แล้วดูดาเมจที่ทำได้ ตัวที่สลบจัดอันดับตามว่าใครอยู่ได้นานกว่า`)}</p>
  <p>⚔️ <b>${TT('Every round','ทุกรอบ')}</b> — ${TT(`Everybody secretly picks ONE move within ${secs} seconds, then all moves play out together. Faster dogs (SPD) act first, and ${BRD.SK.pounce.n[0]} always goes first. Tap an enemy to choose your target.`,`ทุกคนเลือกท่า 1 ท่าแบบลับ ๆ ภายใน ${secs} วินาที แล้วทุกท่าจะเกิดขึ้นพร้อมกัน หมาที่เร็วกว่า (SPD) ลงมือก่อน และ ${BRD.SK.pounce.n[1]} ลงมือก่อนเสมอ แตะศัตรูเพื่อเลือกเป้าหมาย`)}</p>
  <p>⚡ <b>${TT('Energy','พลังงาน')}</b> — ${TT(`You gain +1 every round (+1 more when you Guard), up to ${C.maxEn}. ${B.atk.n[0]} and ${B.grd.n[0]} are free; skills cost 2-3.`,`ได้ +1 ทุกรอบ (+1 เพิ่มเมื่อป้องกัน) สูงสุด ${C.maxEn} ท่า ${B.atk.n[1]} และ ${B.grd.n[1]} ใช้ฟรี ส่วนสกิลใช้ 2-3`)}</p>
  <p>🛡️ <b>${B.grd.n[L]}</b> — ${bwD(B.grd)}</p>
  <p>📊 <b>${TT('Stats','ค่าพลัง')}</b> — ❤️ HP ${TT('how much you can take','ความทนทาน')} · ⚔️ ATK ${TT('damage','พลังโจมตี')} · 🛡️ DEF ${TT('each point cuts damage by 3% (max 50%)','แต้มละ 3% ลดดาเมจ (สูงสุด 50%)')} · 💨 SPD ${TT('acts first, hits critically more often and dodges slower dogs more often','ลงมือก่อน ติดคริบ่อยขึ้น และหลบหมาที่ช้ากว่าได้บ่อยขึ้น')}</p>
  <p>🏆 <b>${TT('Rewards','รางวัล')}</b> — 🥇 60 · 🥈 38 · 🥉 22 · 4th 10 ${TT('coins (half when you only fought bots).','เหรียญ (ครึ่งเดียวถ้าสู้กับบอทล้วน)')}</p>
  <h4>${TT('All skills','สกิลทั้งหมด')}</h4>${Object.keys(BRD.SK).map(bwSkillRow).join('')}</div>`,'sm')};

// ================================================================ the arena
const bwXY=i=>{const s=BW.slot[i];return{x:Math.round(640*(s+.5)/BW.N),y:208+(s%2?10:0)}};
const bwNm=i=>(BW.pl[i].bot?'🤖 ':'')+BW.pl[i].n;
function bwBg(){const c=document.createElement('canvas');c.width=640;c.height=260;const g=c.getContext('2d');
 let gr=g.createLinearGradient(0,0,0,160);gr.addColorStop(0,'#aedcff');gr.addColorStop(1,'#e8f6ff');g.fillStyle=gr;g.fillRect(0,0,640,260);
 g.fillStyle='rgba(255,255,255,.9)';for(const[x,y,r]of[[90,40,20],[120,33,27],[152,42,19],[470,54,22],[502,46,29],[538,57,19]]){g.beginPath();g.arc(x,y,r,0,7);g.fill()}
 g.fillStyle='#bfe8a2';g.beginPath();g.moveTo(0,170);for(let x=0;x<=640;x+=16)g.lineTo(x,126+Math.sin(x*.02)*12+Math.cos(x*.057)*6);g.lineTo(640,170);g.closePath();g.fill();
 gr=g.createLinearGradient(0,150,0,260);gr.addColorStop(0,'#a9e08b');gr.addColorStop(1,'#84cc6b');g.fillStyle=gr;g.fillRect(0,150,640,110);
 g.strokeStyle='#6fb85a';g.lineWidth=2;for(let i=0;i<30;i++){const x=(i*97)%640,y=162+((i*53)%90);g.beginPath();g.moveTo(x,y);g.lineTo(x-2,y-6);g.moveTo(x,y);g.lineTo(x+2,y-7);g.stroke()}
 g.lineWidth=4;g.strokeStyle='#5a3d33';g.fillStyle='#f6dfae';g.beginPath();g.ellipse(320,214,306,40,0,0,7);g.fill();g.stroke();
 g.fillStyle='rgba(255,255,255,.3)';g.beginPath();g.ellipse(320,214,268,31,0,0,7);g.fill();g.strokeStyle='rgba(140,100,70,.35)';g.lineWidth=2;g.beginPath();g.ellipse(320,214,268,31,0,0,7);g.stroke();
 return c}
function bwBubble(g,x,y,txt){g.font=`900 17px ${BW.font}`;const w=g.measureText(txt).width+20;x=clamp(x,w/2+4,636-w/2);g.fillStyle='#fff';g.strokeStyle='#5a3d33';g.lineWidth=3;g.beginPath();if(g.roundRect)g.roundRect(x-w/2,y-17,w,27,10);else g.rect(x-w/2,y-17,w,27);g.fill();g.stroke();g.fillStyle='#5a3d33';g.textAlign='center';g.fillText(txt,x,y+3)}
function bwDog(g,i,now){const p=BW.pl[i],b=DOGS.BR[p.breed];if(!b)return;const{x,y}=bwXY(i),t=now/1000,right=BW.slot[i]<BW.N/2,sc=(1+.45*b.size)*(BW.N>3?.85:1),fl=right?1:-1;
 let ox=0,oy=0,state='IDLE',mv=false,run=false,flash=0,alpha=1;
 const L=BW.lunge[i];if(L&&now<L.t0+L.ms){const k=(now-L.t0)/L.ms;ox=L.dx*Math.sin(Math.PI*Math.min(1,k));oy=-Math.abs(Math.sin(Math.PI*k))*10;state='BARK'}
 const Hh=BW.hurt[i];if(Hh&&now<Hh.t0+Hh.ms){const k=(now-Hh.t0)/Hh.ms;ox-=fl*Math.sin(k*Math.PI*7)*8*(1-k);flash=1-k;if(state=='IDLE')state='CORNER'}
 const Dd=BW.dodge[i];if(Dd&&now<Dd+380){const k=(now-Dd)/380;ox-=fl*Math.sin(Math.PI*k)*40;state='RUN';mv=true;run=true}
 const Ps=BW.pose[i];if(Ps&&now<Ps.until&&state=='IDLE')state=Ps.s;
 const down=BW.down[i];if(down){state='SLEEP';alpha=.55;flash=0;mv=false}
 g.save();g.globalAlpha=alpha;g.fillStyle='rgba(60,32,22,.25)';g.beginPath();g.ellipse(x,y+3,36*sc,7,0,0,7);g.fill();
 const o={state,mv,run,seed:i,acc:p.acc,happy:state=='IDLE',noAura:true};
 if(flash>0){const tmp=BW.tmp||(BW.tmp=document.createElement('canvas'));tmp.width=300;tmp.height=240;const tg=tmp.getContext('2d');tg.imageSmoothingEnabled=false;tg.translate(150,190+oy);tg.scale(fl*sc,sc);
  const r=DOGS.sprite(tg,b,p.variant,t+i*.31,o);BW.top[i]=(r&&r.top||80)*sc;
  tg.setTransform(1,0,0,1,0,0);tg.globalCompositeOperation='source-atop';tg.fillStyle=`rgba(255,60,60,${.6*flash})`;tg.fillRect(0,0,300,240);g.drawImage(tmp,x+ox-150,y-190)}
 else{g.translate(x+ox,y+oy);g.scale(fl*sc,sc);const r=DOGS.sprite(g,b,p.variant,t+i*.31,o);BW.top[i]=(r&&r.top||80)*sc}
 g.restore();
 if(down){g.font='22px sans-serif';g.textAlign='center';g.fillText(BW.gone[i]?'🚪':'💫',x,y-(BW.top[i]||60)-4+Math.sin(t*4)*3)}
 if(BW.guard[i]&&!down){g.save();g.strokeStyle='rgba(80,160,255,.9)';g.fillStyle='rgba(120,190,255,.28)';g.lineWidth=4;g.beginPath();g.ellipse(x,y-(BW.top[i]||60)*.5,50*sc,(BW.top[i]||60)*.62,0,0,7);g.fill();g.stroke();g.restore()}}
function bwDraw(g,now){g.clearRect(0,0,640,260);g.imageSmoothingEnabled=false;g.drawImage(BW.bg,0,0);
 const idx=BW.order.slice().sort((a,b)=>bwXY(a).y-bwXY(b).y);for(const i of idx)bwDog(g,i,now);
 for(const i of idx){const L=BW.lbl[i];if(L&&now<L.t0+L.ms){const k=(now-L.t0)/L.ms,{x,y}=bwXY(i);g.globalAlpha=k<.15?k/.15:k>.8?(1-k)/.2:1;bwBubble(g,x,y-(BW.top[i]||80)-16-Math.min(k*10,6),L.txt);g.globalAlpha=1}}
 if(BW.ph=='ask'&&!BW.sent&&BW.al[BW.me]&&BW.tgt>=0&&BW.al[BW.tgt]){const{x,y}=bwXY(BW.tgt),yy=y-(BW.top[BW.tgt]||80)-30+Math.sin(now/130)*4;g.fillStyle='#ff3b5c';g.strokeStyle='#fff';g.lineWidth=3;g.beginPath();g.moveTo(x-12,yy-11);g.lineTo(x+12,yy-11);g.lineTo(x,yy+7);g.closePath();g.stroke();g.fill()}
 BW.fx=BW.fx.filter(f=>now<f.t0+f.ms);for(const f of BW.fx){const k=(now-f.t0)/f.ms;g.globalAlpha=k>.7?(1-k)/.3:1;g.font=`900 ${f.size}px ${BW.font}`;g.textAlign='center';g.lineWidth=5;g.strokeStyle='rgba(255,255,255,.95)';g.strokeText(f.txt,f.x,f.y-k*38);g.fillStyle=f.col;g.fillText(f.txt,f.x,f.y-k*38)}g.globalAlpha=1}
function bwLoop(){const c=$('#bwc');if(!c||!BW.on)return;const now=performance.now(),dt=Math.min(.1,(now-BW.last)/1000);BW.last=now;
 for(let i=0;i<BW.N;i++)BW.vhp[i]+=(BW.shown[i]-BW.vhp[i])*Math.min(1,dt*9);
 bwDraw(c.getContext('2d'),now);if(now-BW.uiT>90){BW.uiT=now;bwUi(now)}
 BW.raf=requestAnimationFrame(bwLoop)}

// ---- DOM side of the arena: fighter cards (HP, energy, status), move buttons, message line
const bwCard=i=>{const p=BW.pl[i];return`<div class="bwc ${i==BW.me?'me':'foe'}" id="bwcd${i}" data-i="${i}"${i==BW.me?'':' data-do="brt"'}><div class="bwh">${thumbHTML(p.breed,p.variant,13,p.acc)}<b>${p.bot?'🤖 ':i==BW.me?'⭐ ':''}${esc(p.n)}</b></div><div class="bwhp"><i></i><span></span></div><div class="bwe"></div><div class="bws"></div></div>`};
function bwActs(){const me=BW.pl[BW.me],sk=me.sk.map(id=>BRD.SK[id]),B=BRD.BASIC;
 const btn=(k,cls,o,cost,n)=>`<button class="bact ${cls}" data-do="bact" data-k="${k}" id="bact-${k}"><span class="bi">${o.ic}</span><span class="bn"><b>${esc(bwN(o))}</b>${cost?`<em>⚡${cost}</em>`:`<em class="fr">${TT('free','ฟรี')}</em>`}</span><small>${esc(bwD(o))}</small><kbd>${n}</kbd></button>`;
 return btn('atk','a',B.atk,0,1)+btn('grd','g',B.grd,0,2)+btn('s0','s',sk[0],sk[0].cost,3)+btn('s1','s',sk[1],sk[1].cost,4)}
function bwActsUi(){const root=$('#bacts');if(!root)return;const me=BW.pl[BW.me],timeUp=performance.now()>=BW.askEnd;
 for(const k of['atk','grd','s0','s1']){const b=$('#bact-'+k,root);if(!b)continue;const sk=k[0]=='s'?BRD.SK[me.sk[+k[1]]]:null,poor=!!sk&&BW.en[BW.me]<sk.cost,sel=BW.sent&&BW.pickK==k;
  b.classList.toggle('pick',sel);b.classList.toggle('off',!sel&&(!BW.al[BW.me]||BW.ph!='ask'||BW.sent||poor||timeUp))}}
function bwMsg(){const el=$('#bwmsg');if(!el)return;let s='';
 if(BW.ph=='count')s=TT('Get ready…','เตรียมตัว…');
 else if(!BW.al[BW.me])s='💫 '+TT('Your dog is knocked out — watching the rest of the fight','น้องหมาของคุณสลบแล้ว — ดูการต่อสู้ที่เหลือ');
 else if(BW.ph=='play')s=BW.say||TT('Fight!','ลุย!');
 else if(BW.ph=='ask'){if(BW.sent)s='✔ '+TT('Move locked in — waiting for the others…','เลือกท่าแล้ว — รอคนอื่นอยู่…');
  else if(performance.now()>=BW.askEnd)s='⏰ '+TT("Time's up!",'หมดเวลา!');
  else s=TT('Choose your move!','เลือกท่าของคุณ!')+(BW.N>2&&BW.tgt>=0&&BW.pl[BW.tgt]?'   🎯 '+BW.pl[BW.tgt].n:'')}
 if(el.textContent!=s)el.textContent=s}
function bwUi(now,force){
 const rd=$('#bwrd');if(rd){const s=BW.round?TT('Round','รอบ')+' '+BW.round+'/'+BW.n:TT('Get ready','เตรียมตัว');if(rd.textContent!=s)rd.textContent=s}
 const tm=$('#bwtime');if(tm){const k=BW.ph=='ask'?clamp((BW.askEnd-now)/BW.ms,0,1):0;tm.style.width=k*100+'%';tm.style.background=k<.25?'#ff6b6b':k<.5?'#ffc94d':'#6fd1a5';
  if(BW.ph=='ask'&&!BW.sent&&BW.al[BW.me]){const s=Math.ceil(k*BW.ms/1000);if(s>0&&s<=3&&BW.tick!=s){BW.tick=s;sfx('tick')}}}
 if(BW.ph=='count'){const k=cdText(),ov=$('#bwov');if(ov){if(k>0){if(BW.tick!=k){BW.tick=k;sfx('tick');ov.textContent=k;ov.classList.remove('off','go')}}else if(!ov.classList.contains('go')){ov.textContent=TT('FIGHT!','สู้!');ov.classList.add('go');sfx('go');setTimeout(()=>ov&&ov.classList.add('off'),800)}}}
 for(let i=0;i<BW.N;i++){const el=$('#bwcd'+i);if(!el)continue;const hp=Math.max(0,Math.round(BW.vhp[i])),mx=BW.mx[i],st=BW.st[i]||{},al=!!BW.al[i]&&!BW.gone[i],
   isTgt=i!=BW.me&&al&&BW.tgt==i&&BW.ph=='ask'&&!BW.sent,sig=[hp,BW.en[i],al,isTgt,st.sh,st.u,st.w,st.s,st.r,BW.gone[i]].join();
  if(!force&&BW.sig[i]===sig)continue;BW.sig[i]=sig;
  el.classList.toggle('out',!al);el.classList.toggle('sel',isTgt);
  const bar=$('.bwhp i',el),r=hp/mx;bar.style.width=Math.round(r*100)+'%';bar.style.background=r>.5?'#6fd1a5':r>.25?'#ffc94d':'#ff6b6b';$('.bwhp span',el).textContent=al?hp+'/'+mx:(BW.gone[i]?'🚪':'K.O.');
  const en=clamp(BW.en[i]|0,0,5);$('.bwe',el).innerHTML=al?'⚡<b>'+'●'.repeat(en)+'</b><i>'+'●'.repeat(5-en)+'</i>':'';
  $('.bws',el).textContent=al?[st.sh>0?'🛡'+st.sh:'',st.u?'⬆':'',st.r?'🔥':'',st.s?'😱':'',st.w?'💤':''].filter(Boolean).join(' '):''}
 bwActsUi();bwMsg()}

// ---- the board as the server last told us
function bwSet(m){BW.hp=m.hp.slice();BW.en=m.en.slice();BW.al=m.al.slice();BW.st=m.st.map(s=>s||{});BW.dm=m.dm.slice();BW.shown=m.hp.slice();
 BW.gone.forEach((g,i)=>{if(g)BW.al[i]=0});BW.down=BW.al.map(a=>!a)}

// ---- events -> animation. Same durations as the server uses to schedule the next round (BRD.EVMS).
function bwFloat(i,txt,col,size,dy){const{x,y}=bwXY(i),top=BW.top[i]||80;BW.fx.push({x:x+Math.round(Math.random()*20-10),y:y-top*.7+(dy||0),txt,col,size:size||24,t0:performance.now(),ms:1000})}
const bwLabel=(i,txt)=>{BW.lbl[i]={txt,t0:performance.now(),ms:1150}};
function bwLunge(i,t,ms){if(t==null||t<0||!BW.pl[t])return;const a=bwXY(i),b=bwXY(t),d=b.x-a.x;BW.lunge[i]={t0:performance.now(),ms,dx:Math.sign(d||1)*Math.min(Math.abs(d)*.62,150)}}
function bwTargetOf(i){for(let k=BW.ei;k<BW.evs.length;k++){const e=BW.evs[k];if(e.i==i&&e.t!=null&&e.t>=0&&(e.k=='hit'||e.k=='miss'||e.k=='cancel'||e.k=='steal'))return e.t;if(e.k=='act'&&e.i==i)break}return null}
function bwSay(s){BW.say=s;bwMsg()}
function bwApply(e){const now=performance.now(),B=BRD.BASIC;
 switch(e.k){
 case'act':{
  if(e.a=='grd'){BW.guard[e.i]=1;bwLabel(e.i,B.grd.ic+' '+bwN(B.grd));BW.pose[e.i]={s:'SIT',until:now+900};sfx('bshield')}
  else if(e.a=='atk'){bwLabel(e.i,B.atk.ic+' '+bwN(B.atk));bwLunge(e.i,e.t,380);sfx('whoosh')}
  else{const s=BRD.SK[e.s];bwLabel(e.i,s.ic+' '+bwN(s));if(s.tgt=='self')BW.pose[e.i]={s:'PLAY',until:now+500};else bwLunge(e.i,bwTargetOf(e.i),380);sfx(s.tgt=='self'?'bbuff':'whoosh')}
  bwSay(bwNm(e.i)+' · '+BW.lbl[e.i].txt);break}
 case'hit':{BW.shown[e.t]=Math.max(0,BW.shown[e.t]-e.d);BW.hurt[e.t]={t0:now,ms:480};if(e.ab)bwFloat(e.t,'🛡 −'+e.ab,'#2563eb',20,26);
  bwFloat(e.t,'−'+e.d,e.c?'#ff2d2d':'#e11d48',e.c?38:28);if(e.c)bwFloat(e.t,'CRIT!','#f59e0b',22,-32);sfx(e.c?'bcrit':'bhit');break}
 case'miss':BW.dodge[e.t]=now;bwFloat(e.t,TT('MISS','พลาด'),'#6b7280',24);sfx('bmiss');break;
 case'cancel':bwFloat(e.i,'🥺 '+TT('melted','ใจอ่อน'),'#ec4899',22);sfx('bbuff');break;
 case'heal':BW.shown[e.i]=Math.min(BW.mx[e.i],BW.shown[e.i]+e.d);bwFloat(e.i,'+'+e.d,'#16a34a',30);sfx('bheal');break;
 case'shield':bwFloat(e.i,'🛡 '+e.v,'#2563eb',24);sfx('bshield');break;
 case'buff':{const x={zoom:['💨',TT('Dodge!','หลบ!')],eyes:['🥺',TT('Puppy eyes','ตาแป๋ว')],up:['⬆',TT('ATK up','โจมตีขึ้น')],rage:['🔥',TT('RAGE!','บ้าพลัง!')]}[e.s]||['✨',''];bwFloat(e.i,x[0]+' '+x[1],'#d97706',22);sfx('bbuff');break}
 case'debuff':bwFloat(e.t,e.s=='scared'?'😱 '+TT('Scared','กลัว'):'💤 '+TT('Weak','อ่อนแรง'),'#7c3aed',22);sfx('bbuff');break;
 case'steal':bwFloat(e.t,'−'+e.n+'⚡','#9333ea',22);bwFloat(e.i,'+'+e.n+'⚡','#9333ea',22,-24);sfx('bbuff');break;
 case'ko':BW.down[e.t]=true;bwFloat(e.t,'K.O.!','#ef4444',40,-12);sfx('bko');bwSay('💥 '+bwNm(e.t)+' K.O.!');break;
 case'fizzle':bwFloat(e.i,'💫','#9ca3af',22);break}}
function bwStep(){clearTimeout(BW.stepT);if(!BW.evs)return;
 if(BW.ei>=BW.evs.length){const m=BW.snap,over=BW.al.filter(Boolean).length<=1||BW.round>=BW.n;BW.evs=null;bwSet(m);bwSay(over?'🏁 '+TT('Fight over!','จบการต่อสู้!'):TT('Next round…','รอบต่อไป…'));return}
 const e=BW.evs[BW.ei++];bwApply(e);BW.stepT=setTimeout(bwStep,BRD.EVMS[e.k]||300)}
function bwFlush(){clearTimeout(BW.stepT);if(BW.evs){BW.evs=null;if(BW.snap)bwSet(BW.snap)}}       // skip whatever is still being animated and show the real board

// ---- rounds
function bwAsk(m){bwFlush();BW.ph='ask';MP.state='ask';BW.round=m.r;BW.ms=m.ms;BW.askEnd=performance.now()+m.ms;BW.sent=false;BW.pickK=null;BW.tick=9;BW.say='';BW.guard=[];BW.pose=[];BW.lbl=[];
 bwSet(m);
 if(!(BW.tgt>=0&&BW.tgt!=BW.me&&BW.al[BW.tgt])){const foes=BW.order.slice(1).filter(i=>BW.al[i]).sort((a,b)=>BW.hp[a]-BW.hp[b]);BW.tgt=foes.length?foes[0]:-1}   // default target: the weakest enemy
 const ov=$('#bwov');if(ov)ov.classList.add('off');sfx('pop');bwUi(performance.now(),true)}
function bwPlay(m){bwFlush();BW.ph='play';MP.state='play';BW.snap=m;BW.evs=m.ev;BW.ei=0;BW.say='';bwUi(performance.now(),true);bwStep()}
H.mp_ba=m=>{MP.seen=performance.now();if(MP.g=='brawl'&&BW.on)bwAsk(m)};
H.mp_bx=m=>{MP.seen=performance.now();if(MP.g=='brawl'&&BW.on)bwPlay(m)};
H.mp_bok=m=>{MP.seen=performance.now()};
H.mp_bno=m=>{MP.seen=performance.now();if(MP.g!='brawl'||!BW.on||m.r!=BW.round)return;BW.sent=false;BW.pickK=null;toast(m.why=='en'?TT('Not enough energy ⚡','พลังงานไม่พอ ⚡'):TT('Pick a target first','เลือกเป้าหมายก่อน'),1500);sfx('err');bwUi(performance.now(),true)};
const _bwGone=H.mp_gone;H.mp_gone=m=>{_bwGone(m);if(MP.g!='brawl'||!BW.on)return;const i=BW.pl.findIndex(p=>p.n==m.n&&!p.bot);if(i<0||i==BW.me)return;BW.gone[i]=true;BW.al[i]=0;BW.down[i]=true;bwUi(performance.now(),true)};

// ---- player input
function bwSelect(i){if(BW.ph!='ask'||BW.sent||!BW.al[BW.me]||i==BW.me||!BW.al[i]||BW.gone[i])return;if(BW.tgt!=i){BW.tgt=i;sfx('bsel');bwUi(performance.now(),true)}}
DO.brt=d=>bwSelect(+d.i);
function bwCycle(dir){const foes=BW.order.slice(1).filter(i=>BW.al[i]);if(!foes.length)return;const k=foes.indexOf(BW.tgt);bwSelect(foes[(k+dir+foes.length)%foes.length])}
DO.bact=d=>{if(MP.g!='brawl'||!BW.on||BW.ph!='ask'||BW.sent||!BW.al[BW.me])return;if(performance.now()>=BW.askEnd)return;
 const k=d.k,me=BW.pl[BW.me],sk=k=='s0'||k=='s1'?BRD.SK[me.sk[k=='s0'?0:1]]:null;
 if(sk&&BW.en[BW.me]<sk.cost){sfx('err');return toast(TT('Not enough energy ⚡','พลังงานไม่พอ ⚡'),1400)}
 const need=k=='atk'||(sk&&sk.tgt=='one');if(need&&!(BW.tgt>=0&&BW.al[BW.tgt]))return toast(TT('Pick a target first','เลือกเป้าหมายก่อน'),1400);
 BW.sent=true;BW.pickK=k;send({t:'mp_bp',r:BW.round,a:k,to:need?BW.tgt:-1});bwUi(performance.now(),true)};
addEventListener('keydown',e=>{if(MP.g!='brawl'||!BW.on||!modOpen('mp')||e.repeat||e.ctrlKey||e.metaKey||e.altKey)return;if(e.target&&/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))return;
 const k={'1':'atk','2':'grd','3':'s0','4':'s1'}[e.key];if(k){e.preventDefault();DO.bact({k})}else if(e.key=='ArrowLeft'||e.key=='ArrowRight'){e.preventDefault();bwCycle(e.key=='ArrowRight'?1:-1)}});

// ================================================================ start / stop
function startBrawl(m){
 const N=m.pl.length,me=m.me,order=[me,...m.pl.map((_,i)=>i).filter(i=>i!=me)],slot=[];order.forEach((i,s)=>slot[i]=s);
 clearTimeout(BW.stepT);cancelAnimationFrame(BW.raf);
 Object.assign(BW,{on:true,ph:'count',N,pl:m.pl,me,order,slot,n:m.cfg.rounds,ms:m.cfg.qms,round:0,hp:m.pl.map(p=>p.hp),shown:m.pl.map(p=>p.hp),vhp:m.pl.map(p=>p.hp),mx:m.pl.map(p=>p.hp),en:m.pl.map(p=>p.en),
  al:m.pl.map(()=>1),st:m.pl.map(()=>({})),dm:m.pl.map(()=>0),tgt:-1,sent:false,pickK:null,askEnd:0,evs:null,snap:null,ei:0,say:'',fx:[],lbl:[],lunge:[],hurt:[],dodge:[],down:m.pl.map(()=>false),guard:[],pose:[],gone:[],top:[],sig:[],tick:9,last:performance.now(),uiT:0,
  font:(getComputedStyle(document.documentElement).getPropertyValue('--ui')||'sans-serif').trim()||'sans-serif'});
 mpModal('⚔️ '+t('Dog Brawl'),`<div class="bwroot"><div class="bwtop"><span class="pill" id="bwrd">${TT('Get ready','เตรียมตัว')}</span><div class="dtimer"><i id="bwtime"></i></div></div>
  <div class="bwcards" style="--n:${N}">${order.map(bwCard).join('')}</div>
  <div class="racewrap bwarena"><canvas id="bwc" width="640" height="260"></canvas><div class="raceov" id="bwov">3</div></div>
  <div class="bwr"><div class="bwmsg" id="bwmsg"></div><div class="bacts" id="bacts">${bwActs()}</div><div class="row bwfoot"><button class="btn sm ghost" data-do="brhelp">❓ ${TT('Rules','กติกา')}</button><button class="btn sm ghost" data-do="mpleave">🚪 ${TT('Leave','ออก')}</button></div></div></div>`,'br');
 const ov=modOpen('mp'),pn=$('.panel',ov);pn.classList.remove('sm');pn.classList.add('br');       // (the lobby opened this window as a narrow one)
 paintThumbs(ov);const cv=$('#bwc',ov);BW.bg=bwBg();
 cv.addEventListener('pointerdown',e=>{const r=cv.getBoundingClientRect(),s=clamp(Math.floor((e.clientX-r.left)/r.width*BW.N),0,BW.N-1);bwSelect(BW.order[s])});
 BW.raf=requestAnimationFrame(bwLoop);bwUi(performance.now(),true)}
function bwStop(){const was=BW.on;BW.on=false;BW.ph='idle';cancelAnimationFrame(BW.raf);clearTimeout(BW.stepT);BW.evs=null;
 if(was){const pn=$('#mods .ov[data-mod=mp] .panel');if(pn){pn.classList.remove('br');pn.classList.add('sm')}}}
{const reset=MP.reset;MP.reset=function(){bwStop();return reset.apply(this,arguments)};
 const end=H.mp_end;H.mp_end=function(m){if(m.g=='brawl')bwStop();return end.apply(this,arguments)}}
