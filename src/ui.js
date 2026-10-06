// Cozy Dogs - UI infrastructure + HUD + care card
'use strict';
const DO={},UI={};
document.addEventListener('click',e=>{const el=e.target.closest('[data-do]');if(!el)return;const f=DO[el.dataset.do];if(f){sfx('click');f(el.dataset,el,e)}});
addEventListener('keydown',e=>{if(e.key=='Escape'){const o=$$('#mods .ov');if(o.length&&!o[o.length-1].dataset.lock){const x=o[o.length-1];x.remove();x.dispatchEvent(new Event('close'))}}});
// ---- toasts / banners
function toast(m,ms=3200){const e=document.createElement('div');e.className='toast';e.textContent=m;$('#toasts').append(e);setTimeout(()=>{e.style.transition='.4s';e.style.opacity=0;setTimeout(()=>e.remove(),400)},ms);while($('#toasts').children.length>4)$('#toasts').firstChild.remove()}
let tkT;function ticker(m){const e=$('#ticker');e.textContent=m;e.classList.add('on');clearTimeout(tkT);tkT=setTimeout(()=>e.classList.remove('on'),5200)}
function showBanner(m){const b=$('#banner');b.textContent=m;b.style.display='block'}function hideBanner(){$('#banner').style.display='none'}
// ---- modals
function modal(id,title,body,cls='',opts={}){let ov=$(`#mods .ov[data-mod="${id}"]`);const had=!!ov;
 if(!ov){ov=document.createElement('div');ov.className='ov';ov.dataset.mod=id;if(opts.lock)ov.dataset.lock=1;ov.innerHTML=`<div class="panel mod ${cls}"><div class="mh"><span class="mt"></span><span class="sp"></span><button class="x" data-do="closemod" data-id="${id}">✕</button></div><div class="mb"></div></div>`;
  let down=false;ov.addEventListener('pointerdown',e=>{down=e.target===ov});      // close on the CLICK that follows a press on the dark background: closing on pointerdown let the same tap fall through onto the button underneath
  ov.addEventListener('click',e=>{const was=down;down=false;if(was&&e.target===ov&&!ov.dataset.lock){ov.remove();ov.dispatchEvent(new Event('close'))}});$('#mods').append(ov);sfx('open')}
 $('.mt',ov).innerHTML=title;const mb=$('.mb',ov),sc=mb.scrollTop;mb.innerHTML=body;if(typeof AVA!='undefined')AVA.paint(mb);if(had)mb.scrollTop=sc;return ov}
const modOpen=id=>$(`#mods .ov[data-mod="${id}"]`);
function closeMod(id){const o=modOpen(id);if(o){o.remove();o.dispatchEvent(new Event('close'))}}
DO.closemod=d=>closeMod(d.id);
// ---- helpers
const rarTag=r=>`<span class="rar" style="background:${RCOL[r]}">${t(RN[r])}</span>`;
const nice=s=>t(String(s).replace(/_/g,' ').toLowerCase().replace(/\b\w/g,c=>c.toUpperCase()));
// round portrait of a player: the person (bust) with their dog as a small badge; falls back to the dog alone
function avCirc(av,dog,size){size=size||46;const bust=av&&typeof AVA!='undefined';
 return`<div class="avcirc" style="width:${size}px;height:${size}px"><div class="face">${bust?AVA.html(av,Math.round(size/1.4),{crop:'bust'}):dog?thumbHTML(dog,'Normal',Math.round(size/2),null):'🐶'}</div>${bust&&dog?`<div class="dg">${thumbHTML(dog,'Normal',Math.round(size*.25),null)}</div>`:''}</div>`}
// friendly empty state: our own person says something kind
function emptyState(th,en,e){const av=S.me&&S.me.av&&typeof AVA!='undefined';
 return`<div class="empty">${av?`<div class="es-av">${AVA.html(S.me.av,60,{crop:'bust',shadow:1})}</div>`:`<div class="es-e">${e||'🐾'}</div>`}<div class="es-b">${S.set.lang=='th'?th:en}</div></div>`}
function thumbHTML(id,v,size,acc,cls=''){return`<canvas class="${cls}" data-th="${id}|${v||'Normal'}|${size}|${acc||''}" width="${size*2}" height="${size*2}"></canvas>`}
function paintThumbs(root=document){$$('canvas[data-th]',root).forEach(c=>{const[id,v,size,acc]=c.dataset.th.split('|');if(c.dataset.done)return;c.dataset.done=1;const src=DOGS.thumb(id,v,+size,{acc:acc||null,dark:c.dataset.dark});c.getContext('2d').drawImage(src,0,0,c.width,c.height)})}
function paintItemThumbs(root=document){$$('canvas[data-it]',root).forEach(c=>{if(c.dataset.done)return;c.dataset.done=1;const[draw,pal,size]=c.dataset.it.split('|');const s=ROOM.thumb(draw,pal||undefined,+size);c.getContext('2d').drawImage(s,0,0,c.width,c.height)})}
const itThumb=(draw,pal,size=84,cls='')=>`<canvas class="${cls}" data-it="${draw}|${pal||''}|${size*2}" width="${size*2}" height="${size*2}"></canvas>`;
const fmt=n=>n>=1e4?(n/1e3).toFixed(1)+'k':String(n);
const rewardTxt=r=>[r.c&&r.c+' '+ic('coin','sm'),r.g&&r.g+' '+ic('gem','sm'),r.tk&&r.tk+' '+ic('ticket','sm')].filter(Boolean).join(' &nbsp;');
const myDogs=()=>Object.values(S.dogs);
// ---- HUD
let prevCur={};
UI.cur=function(){const m=S.me,el=$('#cur'),items=[['coin',m.coins,'shop'],['gem',m.gems,'capsule'],['ticket',m.tickets,'capsule']];
 el.innerHTML=items.map(([k,v,go])=>`<div class="chip" data-do="${go=='shop'?'shop':'capsule'}" id="chip-${k}">${ic(k,'big')}<span>${fmt(v)}</span><div class="plus">+</div></div>`).join('');
 for(const[k,v]of items){if(prevCur[k]!=null&&prevCur[k]!=v){const c=$('#chip-'+k);c.classList.add('pop');const dl=v-prevCur[k];if(dl>0){const r=c.getBoundingClientRect();const f=document.createElement('div');f.textContent='+'+dl;f.style.cssText=`position:fixed;left:${r.left+10}px;top:${r.bottom}px;font-weight:900;color:#2f9e6a;text-shadow:0 2px 0 #fff;z-index:60;transition:all 1s;pointer-events:none`;document.body.append(f);requestAnimationFrame(()=>{f.style.top=r.bottom+30+'px';f.style.opacity=0});setTimeout(()=>f.remove(),1100)}}prevCur[k]=v}}
UI.pcard=function(){const m=S.me,el=$('#pcard');const dog=S.avatarBreed||(S.owner==S.name&&Object.values(S.dogs)[0]?.breed);
 el.innerHTML=`<div class="av"><canvas class="p" width="96" height="96"></canvas>${m.av&&dog?'<canvas class="d" width="48" height="48"></canvas>':''}<div class="lv">${m.lvl}</div></div><div><b>${esc(S.name)}</b><div class="xp"><i style="width:${m.xp%100}%"></i></div></div>`;
 const pc=$('canvas.p',el);
 if(m.av&&window.AVA){pc.getContext('2d').drawImage(AVA.bust(m.av,48),0,0,96,96);if(dog)$('canvas.d',el).getContext('2d').drawImage(DOGS.thumb(dog,'Normal',24,{noShadow:1,noGlow:1}),0,0,48,48)}
 else if(dog){pc.getContext('2d').drawImage(DOGS.thumb(dog,'Normal',48,{noShadow:1,noGlow:1}),-4,-2,104,104)}}
UI.loc=function(){if(Park.on){$('#loc').innerHTML='🌳 '+t('Dog Park')+'<small></small>';return}const own=S.owner==S.name,e=env(),w={sunny:'☀️',cloudy:'☁️',rain:'🌧️',snow:'❄️'}[e.weather]||'☀️',h=Math.floor(e.hour),mn=Math.floor((e.hour%1)*60);
 const ic2=e.hour<5||e.hour>=20?'🌙':'';$('#loc').innerHTML=`${own?'🏠 '+t('Home'):'🏡 '+esc(S.owner)}<small>${w}${ic2} ${String(h).padStart(2,'0')}:${String(mn).padStart(2,'0')}</small>`}
UI.dock=function(){const m=S.me,fr=S.fr?S.fr.inReq.length:0;
 const B=[['shop','🛍️','Shop'],['dogs','🐶','Dogs'],['wardrobe','👕','Outfit'],['capsule','🎰','Capsule'],['coll','📖','Collection'],['quests','📜','Quests',(m.ready||0)+(m.stReady||0)],['friends','👥','Friends',fr],['ranks','🏆','Ranks'],['park','🌳','Park'],['community','🌍','Community',typeof goalReady=='function'?goalReady():0],['games','🎮','Games',m.spinFree?1:0],['house','🏡','House'],['mail','✉️','Mail',m.mail],['decor','🛋️','Decorate'],['photo','📷','Photo'],['settings','⚙️','Settings']];
 $('#dock').innerHTML=B.map(([k,e,l,b])=>`<button class="dk ${S.edit&&k=='decor'?'on':''}" data-do="${k}"><span class="e">${e}</span><span class="l">${t(l)}</span>${b?`<span class="bd">${b}</span>`:''}</button>`).join('');
 $('#dock').classList.toggle('hidden',S.edit)}
UI.online=function(){const l=S.players.filter(p=>p.name!=S.name);$('#online').innerHTML=`<h5 data-do="togonline">🟢 ${t('Online players')} (${S.players.length})</h5>`+(l.length?l.map(p=>`<div class="pl" data-do="visit" data-n="${esc(p.name)}"><i></i><span>${esc(p.name)}${p.park?' 🌳':''}</span><small>Lv${p.lvl}</small><b class="tb" data-do="tradereq" data-n="${esc(p.name)}" title="Trade">🔁</b></div>`).join(''):`<div class="muted" style="font-size:11px">—</div>`)}
UI.chat=function(){const el=$('#chat'),min=el.classList.contains('min');const log=S.chat.slice(-30).map(c=>`<div><b>${esc(c.from)}</b> ${esc(c.m)}</div>`).join('');
 let lg=$('.log',el);
 if(!lg||!$('#chatf',el)){   // build the panel once
  el.innerHTML=`<div class="hd" data-do="togchat"><span>💬 ${t('Chat')}</span><span>${min?'▲':'▼'}</span></div><div class="log">${log}</div><div class="em">${['❤️','😂','👍','🐶','⭐','😮'].map(e=>`<button data-do="emoji" data-e="${e}">${e}</button>`).join('')}</div><form id="chatf"><input maxlength="120" placeholder="${TT('Type a message…','พิมพ์ข้อความ…')}" autocomplete="off" enterkeyhint="send"><button class="btn sm pink">➤</button></form>`;
  lg=$('.log',el);$('#chatf').onsubmit=e=>{e.preventDefault();const i=$('input',el);if(i.value.trim()){if(send({t:'chat',m:i.value}))i.value='';else toast(TT('Not connected yet — your message is kept, try again in a moment','ยังไม่ได้เชื่อมต่อ — ข้อความยังอยู่ ลองส่งใหม่อีกครั้งนะ'))}}}
 else{   // later calls only refresh the log + header: rebuilding the <input> on every incoming message dropped focus and the typed text (and closed the phone keyboard)
  lg.innerHTML=log;const ci=$('#chatf input',el);if(ci)ci.placeholder=TT('Type a message…','พิมพ์ข้อความ…');const sp=$$('.hd span',el);if(sp[0])sp[0].textContent='💬 '+t('Chat');if(sp[1])sp[1].textContent=min?'▲':'▼'}
 lg.scrollTop=lg.scrollHeight}
DO.togchat=()=>{const el=$('#chat');el.classList.toggle('min');UI.chat();if(!el.classList.contains('min')&&matchMedia('(pointer:coarse)').matches){const i=$('input',el);if(i)i.focus()}};
DO.togonline=()=>{$('#online').classList.toggle('hidden')};
DO.emoji=d=>send({t:'emoji',e:d.e});
DO.visit=d=>{if(S.edit)return toast(TT('Finish decorating first','ตกแต่งให้เสร็จก่อนนะ'));if(Park.on)Park.leaveLocal();send({t:'visit',id:d.n});closeMod('friends')};
DO.home=()=>{if(Park.on)Park.leaveLocal();send({t:'visit',id:S.name})};
UI.bars=function(){const own=S.owner==S.name,v=$('#visitbar');if(typeof UI.fetchbtn=='function')UI.fetchbtn();
 v.classList.toggle('hidden',own);if(!own)v.innerHTML=`🏡 ${esc(S.owner)} <button class="btn sm sky" data-do="home">🏠 ${t('Go Home')}</button><button class="btn sm pink" data-do="gblike" title="Like">❤️</button><button class="btn sm lav" data-do="gbopen" data-n="${esc(S.owner)}" title="Guestbook">📖</button>`+['❤️','😂','👍','🐶','⭐','😮'].map(e=>`<button class="btn sm ghost" data-do="emoji" data-e="${e}">${e}</button>`).join('');
 document.body.classList.toggle('editing',!!S.edit);if(S.edit&&S.sel){S.sel=null;UI.care()}const eb=$('#editbar');eb.style.display=S.edit?'flex':'none';eb.classList.toggle('hidden',!S.edit);if(S.edit)UI.edit()}
// ---- decorate bar
const ECATS=[['all','All'],['toy','Toys'],['furn','Furniture'],['rug','Rugs'],['wall','Wall'],['season','Season']];
UI.edit=function(){const cat=S.editCat||'all',C=S.cat.items,inv=S.me.inv,placed={};for(const i of S.items)placed[i.type]=(placed[i.type]||0)+1;
 const list=Object.values(C).filter(d=>(inv[d.id]||0)>0&&(cat=='all'||d.cat==cat));
 $('#editbar').innerHTML=`<div class="hd"><b>🛋️ ${t('Decorate')}</b><span class="muted">${S.items.length}/${S.me.maxItems||(S.welcome?S.welcome.max.items:40)} · ${t('Drag items into your room')}</span><span class="sp" style="flex:1"></span>${ECATS.map(([k,l])=>`<button class="pill ${cat==k?'on':''}" data-do="ecat" data-k="${k}">${t(l)}</button>`).join('')}<button class="btn sm sky" data-do="shop">🛍️</button><button class="btn sm mint" data-do="decor">✔ ${t('Done')}</button></div>
 <div class="drawer">${list.length?list.map(d=>{const left=(inv[d.id]||0)-(placed[d.id]||0);return`<div class="inv ${left<=0?'dis':''}" data-id="${d.id}">${itThumb(d.draw,d.pal,30)}<b>${esc(d.n)}</b><em>${left}</em></div>`}).join(''):`<div class="muted" style="padding:14px">${t('Empty')} — <a href="#" data-do="shop">${t('Shop')}</a></div>`}</div>`;
 paintItemThumbs($('#editbar'));$$('#editbar .inv').forEach(el=>el.addEventListener('pointerdown',e=>{if(el.classList.contains('dis'))return;e.preventDefault();startPlace(el.dataset.id,e)}))}
DO.ecat=d=>{S.editCat=d.k;UI.edit()};
DO.decor=()=>{if(S.owner!=S.name){send({t:'visit',id:S.name});}S.edit=!S.edit;World.selItem=null;World.drag=null;UI.dock();UI.bars();if(S.edit)toast('🛋️ '+t('Drag items into your room'))};
DO.flip=flipItem;DO.store=storeItem;DO.discard=discardItem;
addEventListener('keydown',e=>{if(!S.edit||Park.on||!World.selItem)return;const g=e.target,n=g&&g.tagName;if(n=='INPUT'||n=='TEXTAREA'||n=='SELECT'||(g&&g.isContentEditable))return;
 if(e.key=='Delete'||e.key=='Backspace'){e.preventDefault();storeItem()}else if(e.key=='Escape')selectItem(null)});
// ---- care card
const FOODS=['kibble','treat','fruit','cookie','bone','meat','cake'];
UI.care=function(){const el=$('#care'),d=S.dogs[S.sel];if(!d){el.classList.add('hidden');return}el.classList.remove('hidden');const b=DOGS.BR[d.breed],own=S.owner==S.name,F=S.cat.food;
 const hearts=Array.from({length:10},(_,i)=>ic(i<Math.floor(d.bond/10)?'heart':'hearte','sm')).join('');
 const bar=(k,l,v,col)=>`<div class="bar"><b>${t(l)}</b><i><u data-bar="${k}" style="width:${v}%;background:${v<30?'#ff6b6b':col}"></u></i></div>`;
 el.innerHTML=`<button class="xbtn" data-do="desel">✕</button><div class="top"><div class="th">${thumbHTML(d.breed,d.variant,31,d.acc)}</div><div style="flex:1;min-width:0"><h4>${esc(d.name)} ${rarTag(b.r)}</h4><div class="sub">${esc(b.name)}${d.variant!='Normal'?' · '+t(d.variant):''}</div><div class="sub">${PERS_EM[d.pers]||''} ${nice(d.pers)}</div><div class="hearts" data-bondh>${hearts}</div></div></div>
 <div class="bars">${bar('hunger','Hunger',d.hunger,'#ffb36b')}${bar('energy','Energy',d.energy,'#6fb8ff')}${bar('happy','Happy',d.happy,'#ff8fb0')}${bar('clean','Clean',d.clean,'#6fd1a5')}</div>
 <div class="acts"><button class="btn pink" data-do="act" data-a="pet"><span>🤚</span>${t('Pet')}</button><button class="btn ${own?'':'dis'}" data-do="feedtog"><span>🍖</span>${t('Feed')}</button><button class="btn ${own?'':'dis'}" data-do="act" data-a="play"><span>🎾</span>${t('Play')}</button><button class="btn ${own?'':'dis'}" data-do="act" data-a="brush"><span>🧹</span>${t('Brush')}</button>
 <button class="btn sky ${own?'':'dis'}" data-do="act" data-a="bath"><span>🛁</span>${t('Bath')} <small>5💰</small></button><button class="btn mint ${own?'':'dis'}" data-do="act" data-a="train"><span>🎓</span>${t('Train')}</button><button class="btn lav ${own?'':'dis'}" data-do="dogprof" data-id="${d.id}"><span>🎀</span>${t('Wear')}</button><button class="btn ghost" data-do="dogprof" data-id="${d.id}"><span>ℹ️</span>${t('Info')}</button></div>
 <div class="foodpick ${S.feedOpen?'on':''}">${FOODS.map(k=>{const f=F[k],n=S.me.inv[k]||0,fav=String(d.favFood).toLowerCase()==k,can=n>0||(k=='kibble'&&S.me.coins>=f.p);return`<div class="fp ${can?'':'dis'} ${fav?'fav':''}" data-do="feed" data-f="${k}" title="${f.n}"><span class="e">${f.e}</span>${f.n}<br><small>${n>0?'':f.p+'💰'}</small>${n>0?`<em>${n}</em>`:''}</div>`}).join('')}</div>`;
 paintThumbs(el)}
UI.careBars=function(){const d=S.dogs[S.sel];if(!d||$('#care').classList.contains('hidden'))return;for(const k of['hunger','energy','happy','clean']){const u=$(`#care [data-bar="${k}"]`);if(u){u.style.width=d[k]+'%';u.style.background=d[k]<30?'#ff6b6b':{hunger:'#ffb36b',energy:'#6fb8ff',happy:'#ff8fb0',clean:'#6fd1a5'}[k]}}
 const h=$('#care [data-bondh]');if(h){const n=Math.floor(d.bond/10);if(h.dataset.n!=n){h.dataset.n=n;h.innerHTML=Array.from({length:10},(_,i)=>ic(i<n?'heart':'hearte','sm')).join('')}}}
DO.desel=()=>{S.sel=null;UI.care()};
DO.feedtog=()=>{S.feedOpen=!S.feedOpen;UI.care()};
DO.act=d=>{if(!S.sel)return;send({t:'act',a:d.a,dog:S.sel});const dg=S.dogs[S.sel];if(d.a=='pet'&&dg){dg.petAt=performance.now();sfx('pet')}else if(d.a=='play')sfx('bark');else if(d.a=='brush'||d.a=='bath')sfx('shake');else if(d.a=='train')sfx('ok')};
DO.feed=d=>{if(!S.sel)return;const n=S.me.inv[d.f]||0,f=S.cat.food[d.f];if(n<=0&&!(d.f=='kibble'&&S.me.coins>=f.p)){toast((S.set.lang=='th'?'ไม่มี ':'No ')+f.n);S.shopTab='food';DO.shop();return}send({t:'feed',dog:S.sel,food:d.f});sfx('eat')};
