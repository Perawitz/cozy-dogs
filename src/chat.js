// Cozy Dogs - private chat client (v7): friend-to-friend DMs + friends-only group rooms (the server half is chat.js).
// The window is built ONCE and then only patched: the text field is never re-created, so typing, the caret and the keyboard are never disturbed by a message that arrives.
//   list pane (left / first screen)   = chat rows + friends without a chat yet     chat pane (right / second screen) = header, log, emoji bar, text field
//   .dmx                              = room settings / new room / add a friend (re-drawn through dmKeep, which keeps what was typed)
'use strict';
Object.assign(TH,{'Private chat':'แชทส่วนตัว'});
const Dm={rows:[],fr:[],avs:Object.create(null),drafts:Object.create(null),cur:null,sub:null,chat:null,log:null,pin:null,sel:new Set(),ttl:'',add:'',back:null,at:0,stick:true,fresh:false,newc:0,rt:0,gt:0,g2:0,snd:0,ws:null,fk:'',lt:0,tick:0};
const DM_MAX=200,DM_EM=['😀','😂','🥰','😭','😮','👍','🙏','🎉','❤️','🐶','🐾','🍖','✨','😴','🤔'],DM_COL=['#d9558a','#3a8fd9','#2f9e6a','#8e63e6','#d98a1f','#e0604f'];
// errors arrive as codes (the server only knows Thai): worded here in the player's language. '%' = the name the server sent along
const DM_ERR={guest:['Create an account to use private chat.','สมัครบัญชีก่อนนะ แชทส่วนตัวใช้ได้เฉพาะสมาชิก'],bad:['Something went wrong, please try again.','เกิดข้อผิดพลาด ลองใหม่อีกครั้งนะ'],self:['You cannot chat with yourself.','แชทกับตัวเองไม่ได้นะ'],
 nofriend:['You can only chat with friends.','แชทได้เฉพาะกับเพื่อนเท่านั้นนะ'],nofriendx:['% is not your friend.','% ไม่ได้เป็นเพื่อนกับคุณ'],guestfriend:['% is a guest, and guests cannot use private chat.','% เป็น Guest ใช้แชทส่วนตัวไม่ได้'],
 slow:['Slow down a little~','ส่งเร็วไปหน่อย รอสักครู่นะ'],ro:['You are no longer friends, so this chat is read-only.','ไม่ได้เป็นเพื่อนกันแล้ว อ่านข้อความเก่าได้อย่างเดียวนะ'],title:['Give the room a name first.','ตั้งชื่อห้องก่อนนะ'],
 members:['Pick 1 to 7 friends.','เลือกเพื่อน 1-7 คนนะ'],own5:['You can own up to 5 rooms.','สร้างห้องได้สูงสุด 5 ห้องนะ'],in12me:['You are in too many rooms (max 12).','คุณอยู่ในห้องครบ 12 ห้องแล้ว'],in12x:['% is in too many rooms (max 12).','% อยู่ในห้องครบ 12 ห้องแล้ว'],
 notowner:['Only the room owner can do that.','เฉพาะเจ้าของห้องเท่านั้นนะ'],already:['% is already in the room.','% อยู่ในห้องนี้แล้ว'],full:['The room is full (8 people).','ห้องเต็มแล้ว (สูงสุด 8 คน)']};
// ---------------------------------------------------------------- small helpers
const dmQ=s=>{const o=modOpen('dm');return o?$(s,o):null};
const dmP2=n=>String(n).padStart(2,'0'),dmHM=ts=>{const d=new Date(ts);return dmP2(d.getHours())+':'+dmP2(d.getMinutes())},dmDK=ts=>{const d=new Date(ts);return new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime()};
function dmDayLbl(ts){const df=Math.round((dmDK(Date.now())-dmDK(ts))/864e5);if(df==0)return TT('Today','วันนี้');if(df==1)return TT('Yesterday','เมื่อวาน');const d=new Date(ts),y=d.getFullYear()!=new Date().getFullYear();
 try{return d.toLocaleDateString(S.set.lang=='th'?'th-TH':'en-GB',y?{day:'numeric',month:'short',year:'numeric'}:{day:'numeric',month:'short'})}catch{return dmP2(d.getDate())+'/'+dmP2(d.getMonth()+1)}}
const dmListTime=ts=>dmDK(ts)==dmDK(Date.now())?dmHM(ts):dmDayLbl(ts);
const dmCol=n=>{let h=0;for(const c of String(n))h=(h*31+c.codePointAt(0))>>>0;return DM_COL[h%DM_COL.length]};       // every sender keeps one colour
const dmAv=(n,sz,on)=>{const a=Dm.avs[n]||{};return`<div class="dma">${avCirc(a.av,a.dog,sz)}<i class="dmo${on?' on':''}"></i></div>`};
const dmRoomAv=(sz,on)=>`<div class="dma"><div class="dmra" style="width:${sz}px;height:${sz}px;font-size:${Math.round(sz*.5)}px">👥</div><i class="dmo${on?' on':''}"></i></div>`;
const dmPaint=el=>{if(!el)return;try{if(typeof AVA!='undefined')AVA.paint(el);paintThumbs(el)}catch{}};
const dmNear=lg=>lg.scrollHeight-lg.scrollTop-lg.clientHeight<48;
const dmReady=()=>S.loaded&&!S.pendingResume&&!reconnecting&&S.ws&&S.ws.readyState==1;
const dmRows=()=>Dm.pin&&!Dm.rows.some(r=>r.id==Dm.pin.id)?[Dm.pin,...Dm.rows]:Dm.rows,dmRow=id=>dmRows().find(r=>r.id==id);
const dmPv=(s,n)=>{const a=Array.from(String(s));return a.slice(0,n).join('')+(a.length>n?'…':'')};
// re-draw a box without losing what the player typed in it, where the caret was, or how far a list was scrolled
function dmKeep(box,fn){const a=document.activeElement,keep={},sc=[...box.querySelectorAll('.dmxb,.dmfl')].map(e=>e.scrollTop);box.querySelectorAll('input[id]').forEach(i=>{if(i.type!='checkbox')keep[i.id]=i.value});
 const fid=a&&box.contains(a)&&a.id?a.id:null,ss=fid?[a.selectionStart,a.selectionEnd]:null;fn();
 for(const id in keep){const i=box.querySelector('#'+id);if(i&&i.value!==keep[id])i.value=keep[id]}
 box.querySelectorAll('.dmxb,.dmfl').forEach((e,i)=>{if(sc[i])e.scrollTop=sc[i]});
 if(fid){const i=box.querySelector('#'+fid);if(i){i.focus();try{if(ss[0]!=null)i.setSelectionRange(ss[0],ss[1])}catch{}}}}
// ---------------------------------------------------------------- the window
const dmSkel=()=>`<div class="dmw" data-p="list"><div class="dml"><div class="dmlh"><span>${TT('Chats','ข้อความ')}</span><button class="btn sm mint" data-do="dmnew">+ ${TT('New room','ห้องใหม่')}</button></div><div class="dmls"></div></div>
<div class="dmc" data-v="none"><div class="dmnone">${emptyState('เลือกแชทจากรายการ หรือเริ่มคุยกับเพื่อนได้เลย~','Pick a chat from the list, or start one with a friend~','💌')}</div>
<div class="dmcv" data-ro="0"><div class="dmh"></div><div class="dmlw"><div class="dmlog" role="log"></div><button class="dmpill hidden" data-do="dmdown"></button></div>
<div class="dmrof">🔒 ${TT('You are no longer friends, so this chat is read-only.','ไม่ได้เป็นเพื่อนกันแล้ว อ่านข้อความเก่าได้อย่างเดียวนะ')}</div>
<form class="dmf" autocomplete="off"><div class="dmem"><div class="eml">${DM_EM.map(e=>`<button type="button" data-do="dmem" data-e="${e}" tabindex="-1">${e}</button>`).join('')}</div><span class="dmct">0/${DM_MAX}</span></div>
<div class="dmin"><input class="dmi" type="text" autocomplete="off" autocapitalize="sentences" enterkeyhint="send" maxlength="600" placeholder="${TT('Type a message…','พิมพ์ข้อความ…')}" aria-label="${TT('Message','ข้อความ')}"><button class="btn pink dmsend" type="submit">${TT('Send','ส่ง')}</button></div></form></div>
<div class="dmx"></div></div></div>`;
function dmShow(){const had=modOpen('dm');if(had)return had;
 Object.assign(Dm,{cur:null,sub:null,chat:null,log:null,pin:null,sel:new Set(),ttl:'',add:'',back:null,at:0,stick:true,fresh:false,newc:0,ws:null});
 const ov=modal('dm','💌 '+TT('Private chat','แชทส่วนตัว'),dmSkel(),'lg dm');dmWire(ov);dmRenderList();dmLayout();dmFit();clearInterval(Dm.tick);Dm.tick=setInterval(dmTick,2500);dmSync();return ov}
function dmWire(ov){
 ov.addEventListener('mousedown',e=>{if(e.target.closest('.dmsend,.dmem button'))e.preventDefault()});      // a tap on "send" / an emoji must not take the focus (= close the phone keyboard) away from the text field
 ov.addEventListener('submit',e=>{e.preventDefault();const f=e.target.classList;if(f.contains('dmf'))dmSend();else if(f.contains('dmrn'))dmRename();else if(f.contains('dmnf'))dmCreate()});
 ov.addEventListener('input',e=>{const i=e.target;if(i.classList.contains('dmi')){if(!e.isComposing)dmClamp(i);dmCount()}else if(i.id=='dmTtl'){Dm.ttl=i.value;dmNewBtn()}});
 ov.addEventListener('change',e=>{const i=e.target;if(i.matches&&i.matches('input[type=checkbox][data-n]'))dmChk(i)});
 const lg=$('.dmlog',ov);lg.addEventListener('scroll',()=>{if(!lg.clientHeight)return;Dm.stick=dmNear(lg);if(Dm.stick&&Dm.newc){Dm.newc=0;dmPill()}},{passive:true})}
function dmFit(){const o=modOpen('dm'),v=window.visualViewport;if(!o||!v)return;const kb=v.height<innerHeight-100;       // phone keyboard open: the window shrinks to what is really visible, so the text field is never hidden behind the keyboard
 if(kb){o.style.top=Math.max(0,v.offsetTop)+'px';o.style.height=v.height+'px';o.style.bottom='auto';const lg=$('.dmlog',o);if(lg&&Dm.stick)lg.scrollTop=lg.scrollHeight}else{o.style.top=o.style.height=o.style.bottom=''}}
if(window.visualViewport){visualViewport.addEventListener('resize',dmFit);visualViewport.addEventListener('scroll',dmFit)}
function dmLayout(){const w=dmQ('.dmw'),c=dmQ('.dmc');if(!w)return;c.dataset.v=Dm.sub||(Dm.cur?'chat':'none');w.dataset.p=Dm.cur||Dm.sub?'chat':'list';dmStick()}
function dmStick(){const lg=dmQ('.dmlog');if(lg&&Dm.cur&&!Dm.sub&&Dm.stick)lg.scrollTop=lg.scrollHeight}
// ---------------------------------------------------------------- list pane
function dmRowHTML(r){const dm=r.kind=='dm',me=S.name,o=r.members.find(x=>x.name!=me),on=dm?!!(o&&o.online):r.members.some(x=>x.name!=me&&x.online),l=r.last,
 pv=l?(l.n==me?TT('You: ','คุณ: '):dm?'':l.n+': ')+l.m:TT('No messages yet','ยังไม่มีข้อความ');
 return`<button class="dmr${r.id==Dm.cur?' on':''}${r.unread?' un':''}" data-do="dmsel" data-id="${esc(r.id)}">${dm?dmAv(r.title,46,on):dmRoomAv(46,on)}<div class="g"><b>${esc(r.title)}${r.muted?' <span class="dmmu">🔇</span>':''}</b><small>${esc(pv)}</small></div>
<div class="dmt"><span>${l?dmListTime(l.t):''}</span>${r.unread?`<span class="dmbd${r.muted?' q':''}">${r.unread>99?'99+':r.unread}</span>`:''}</div></button>`}
function dmRenderList(){const el=dmQ('.dmls');if(!el)return;const sc=el.scrollTop,rows=dmRows(),have=new Set(rows.filter(r=>r.kind=='dm').map(r=>r.title.toLowerCase())),fl=Dm.fr.filter(f=>!have.has(f.name.toLowerCase()));
 let h=rows.map(dmRowHTML).join('');
 if(fl.length)h+=`<div class="dmsl">${TT('Start a chat with a friend','เริ่มคุยกับเพื่อน')}</div>`+fl.map(f=>`<button class="dmr dmfx" data-do="dmfr" data-n="${esc(f.name)}">${dmAv(f.name,38,f.online)}<div class="g"><b>${esc(f.name)}</b><small>${f.online?'🟢 '+t('Online'):'⚪ '+t('Offline')}</small></div><span class="dmgo">💬</span></button>`).join('');
 if(!rows.length&&!fl.length)h=emptyState('ยังไม่มีเพื่อนให้คุยด้วย~ ไปเพิ่มเพื่อนก่อนนะ','No friends to chat with yet~ add some first!','💌')+`<div class="center"><button class="btn sm pink" data-do="dmtofr">👥 ${t('Friends')}</button></div>`;
 el.innerHTML=h;el.scrollTop=sc;dmPaint(el)}
// ---------------------------------------------------------------- chat pane
function dmHead(){const c=Dm.chat,h=dmQ('.dmh');if(!h)return;if(!c){h.innerHTML='';return}const dm=c.kind=='dm',o=c.members.filter(x=>x.name!=S.name),no=o.filter(x=>x.online).length,n=c.members.length;
 h.innerHTML=`<button class="btn sm ghost dmbk" data-do="dmback" aria-label="${TT('Back','กลับ')}">←</button>${dm?dmAv(c.title,40,no>0):dmRoomAv(40,no>0)}<div class="g"><b>${esc(c.title)}${c.muted?' <span class="dmmu">🔇</span>':''}</b><small>${dm?(no?'🟢 '+t('Online'):'⚪ '+t('Offline')):TT(n+' members · '+no+' online',n+' คน · ออนไลน์ '+no)}</small></div>
${dm?`<button class="btn sm ${c.muted?'ghost':'lav'} dmib" data-do="dmmute" aria-label="${TT('Mute','ปิดแจ้งเตือน')}">${c.muted?'🔇':'🔔'}</button>`:`<button class="btn sm lav dmib" data-do="dminfo" aria-label="${TT('Room settings','ตั้งค่าห้อง')}">⚙️</button>`}`;dmPaint(h)}
function dmMsgHTML(p,x){const me=x.n==S.name,room=!!Dm.chat&&Dm.chat.kind=='room',nd=!p||dmDK(p.t)!=dmDK(x.t),f=nd||p.n!=x.n||x.t-p.t>18e4,a=Dm.avs[x.n]||{};
 return(nd?`<div class="dmds">${dmDayLbl(x.t)}</div>`:'')+`<div class="dmm ${me?'me':'ot'}${f?' f':''}">${!me&&room?`<div class="dmav">${f?avCirc(a.av,a.dog,30):''}</div>`:''}<div class="dmb">${!me&&room&&f?`<span class="dmn" style="color:${dmCol(x.n)}">${esc(x.n)}</span>`:''}${esc(x.m)}<span class="dmtm">${dmHM(x.t)}</span></div></div>`}
function dmLogFill(){const lg=dmQ('.dmlog');if(!lg||!Dm.log)return;const near=lg.clientHeight?dmNear(lg):Dm.stick,from=lg.scrollHeight-lg.scrollTop,L=Dm.log,c=Dm.chat,room=!!c&&c.kind=='room';
 lg.innerHTML=L.length?L.map((x,i)=>dmMsgHTML(L[i-1],x)).join(''):`<div class="empty"><div class="es-e">${room?'🐾':'💬'}</div><div class="es-b">${room?TT('It is quiet here — start the conversation~','ห้องนี้ยังเงียบอยู่ เริ่มคุยกันเลย~'):TT('Say hi to '+esc(c?c.title:'')+'~','ทักทาย '+esc(c?c.title:'')+' หน่อยสิ~')}</div></div>`;
 dmPaint(lg);if(Dm.fresh||near){lg.scrollTop=lg.scrollHeight;Dm.stick=true}else lg.scrollTop=Math.max(0,lg.scrollHeight-from);Dm.fresh=false;Dm.newc=0;dmPill()}
function dmAppend(x){const lg=dmQ('.dmlog');if(!lg||!Dm.log)return;const stick=lg.clientHeight?dmNear(lg):Dm.stick,p=Dm.log[Dm.log.length-1];Dm.log.push(x);
 if(Dm.log.length>150){Dm.log=Dm.log.slice(-100);return dmLogFill()}
 const e=lg.querySelector('.empty');if(e)e.remove();lg.insertAdjacentHTML('beforeend',dmMsgHTML(p,x));dmPaint(lg.lastElementChild);
 if(x.n==S.name||stick){lg.scrollTop=lg.scrollHeight;Dm.stick=true}else{Dm.newc++;dmPill()}}      // somebody scrolled up to read old messages: do not yank them down, offer a button instead
function dmPill(){const b=dmQ('.dmpill');if(!b)return;b.classList.toggle('hidden',!Dm.newc);b.textContent='⬇ '+TT('New messages','ข้อความใหม่')+(Dm.newc>1?' ('+Dm.newc+')':'')}
function dmRo(){const c=dmQ('.dmcv');if(c)c.dataset.ro=Dm.chat&&Dm.chat.ro?'1':'0'}
function dmCount(){const i=dmQ('.dmi');if(!i)return;const n=Array.from(i.value).length,c=dmQ('.dmct'),b=dmQ('.dmsend');if(c){c.textContent=n+'/'+DM_MAX;c.classList.toggle('warn',n>=DM_MAX-20)}if(b)b.classList.toggle('rdy',n>0)}
function dmClamp(i){const a=Array.from(i.value);if(a.length>DM_MAX)i.value=a.slice(0,DM_MAX).join('')}
function dmSend(){const i=dmQ('.dmi');if(!i||!Dm.cur||(Dm.chat&&Dm.chat.ro))return;const m=Array.from(i.value.replace(/\s+/g,' ').trim()).slice(0,DM_MAX).join('');if(!m)return;
 const now=Date.now();if(now-Dm.at<800){toast(TT(...DM_ERR.slow));return}       // (a little slower than the server's own limit, so a message is not refused just because of network jitter)
 if(!send({t:'dm_send',id:Dm.cur,m})){toast(TT('Not connected - please try again in a moment.','ยังไม่ได้เชื่อมต่อ ลองใหม่อีกครั้งนะ'));sfx('err');return}
 Dm.at=now;Dm.back={id:Dm.cur,m};i.value='';dmCount()}
DO.dmem=d=>{const i=dmQ('.dmi');if(!i)return;const a=i.selectionStart==null?i.value.length:i.selectionStart,b=i.selectionEnd==null?a:i.selectionEnd,v=i.value.slice(0,a)+d.e+i.value.slice(b);if(Array.from(v).length>DM_MAX)return;i.value=v;const p=a+d.e.length;try{i.setSelectionRange(p,p)}catch{}dmCount()};
DO.dmdown=()=>{const lg=dmQ('.dmlog');if(lg){lg.scrollTop=lg.scrollHeight;Dm.stick=true;Dm.newc=0;dmPill()}};
// ---------------------------------------------------------------- choosing / leaving a chat
function dmSelect(id){const i=dmQ('.dmi');if(i&&Dm.cur)Dm.drafts[Dm.cur]=i.value;const r=dmRow(id);
 Object.assign(Dm,{cur:id,sub:null,log:null,fresh:true,stick:true,newc:0,sel:new Set(),ttl:'',chat:r?{id,kind:r.kind,title:r.title,owner:r.owner,members:r.members.slice(),ro:!!r.ro,muted:!!r.muted}:null});
 if(Dm.pin&&Dm.pin.id!=id)Dm.pin=null;if(r)r.unread=0;
 if(i){i.value=Dm.drafts[id]||'';dmCount()}const lg=dmQ('.dmlog');if(lg)lg.innerHTML='';dmPill();dmRo();dmLayout();dmHead();dmRenderList()}
function dmLeave(){const i=dmQ('.dmi');if(i){if(Dm.cur)Dm.drafts[Dm.cur]=i.value;if(document.activeElement===i)i.blur()}Object.assign(Dm,{cur:null,sub:null,chat:null,log:null,pin:null,newc:0});dmLayout();dmRenderList()}
const dmFocus=()=>{if(matchMedia('(hover:hover)').matches){const i=dmQ('.dmi');if(i)i.focus()}};      // a mouse user can type at once; on a phone the keyboard would cover the messages, so it opens only when the field is tapped
DO.dm=()=>{if(S.guest){modal('dm','💌 '+TT('Private chat','แชทส่วนตัว'),emptyState('สมัครบัญชีก่อนนะ~ แชทส่วนตัวใช้ได้เฉพาะสมาชิก (Guest ใช้ไม่ได้)','Create an account to use private chat (guests cannot).','💌'),'sm');return}dmShow()};
DO.dmopen=d=>{if(S.guest)return toast(TT(...DM_ERR.guest));closeMod('friends');dmShow();send({t:'dm_open',with:d.n})};
DO.dmfr=d=>{send({t:'dm_open',with:d.n})};
DO.dmsel=d=>{if(d.id==Dm.cur){Dm.sub=null;dmLayout();return}dmSelect(d.id);send({t:'dm_get',id:d.id});dmFocus()};
DO.dmback=()=>{if(Dm.sub=='pick'){Dm.sub='info';dmLayout();dmInfo()}else if(Dm.sub){Dm.sub=null;dmLayout();dmRenderList()}else dmLeave()};
DO.dmtofr=()=>{closeMod('dm');DO.friends()};
DO.dmmute=()=>{const c=Dm.chat;if(!c)return;const on=!c.muted;if(!send({t:'dm_mute',id:c.id,on}))return;c.muted=on;const r=dmRow(c.id);if(r)r.muted=on;dmHead();dmRenderList();dmInfo();toast(on?'🔇 '+TT('Notifications off for this chat','ปิดแจ้งเตือนแชทนี้แล้ว'):'🔔 '+TT('Notifications on','เปิดแจ้งเตือนแล้ว'))};
// ---------------------------------------------------------------- rooms: settings, new room, add a friend
const dmSubHead=ti=>`<div class="dmxh"><button class="btn sm ghost dmbk2" data-do="dmback" aria-label="${TT('Back','กลับ')}">←</button><b>${ti}</b></div>`;
const dmFriendRow=(f,body,tag)=>`${dmAv(f.name,40,f.online)}<div class="g"><b>${esc(f.name)}${tag||''}</b><small>${f.online?'🟢 '+t('Online'):'⚪ '+t('Offline')}</small></div>${body||''}`;
function dmInfo(){const c=Dm.chat,x=dmQ('.dmx');if(!c||!x||Dm.sub!='info')return;const own=c.owner===S.name,me=S.name;
 dmKeep(x,()=>{x.innerHTML=dmSubHead('⚙️ '+TT('Room settings','ตั้งค่าห้อง'))+`<div class="dmxb">${own?`<form class="dmrn row"><input id="dmRn" maxlength="16" value="${esc(c.title)}" aria-label="${TT('Room name','ชื่อห้อง')}"><button class="btn sm mint" style="flex:none">${TT('Rename','เปลี่ยนชื่อ')}</button></form>`:`<div class="dmrt">${esc(c.title)}</div>`}
<div class="dmsl">${TT('Members','สมาชิก')} <span>${c.members.length}/8</span></div><div class="list">${c.members.map(p=>`<div class="li">${dmFriendRow(p,own&&p.name!==me?`<button class="btn sm ghost" data-do="dmkick" data-n="${esc(p.name)}" aria-label="${TT('Remove','เอาออก')}">✕</button>`:'',(p.name==me?' <span class="muted">('+TT('you','คุณ')+')</span>':'')+(p.name===c.owner?' 👑':''))}</div>`).join('')}</div>
${own&&c.members.length<8?`<button class="btn sm sky" data-do="dmpick" style="margin:2px 0 6px">+ ${TT('Add a friend','เพิ่มเพื่อน')}</button>`:''}
<div class="toggle"><span>🔇 ${TT('Mute notifications','ปิดการแจ้งเตือน')}</span><div class="sw ${c.muted?'on':''}" data-do="dmmute" role="switch"></div></div>
<div class="row dmact"><button class="btn ghost" data-do="dmleave">🚪 ${TT('Leave room','ออกจากห้อง')}</button>${own?`<button class="btn red" data-do="dmdel">🗑️ ${TT('Disband room','ยุบห้อง')}</button>`:''}</div></div>`;dmPaint(x)})}
DO.dminfo=()=>{if(!Dm.chat||Dm.chat.kind!='room')return;Dm.sub='info';dmLayout();dmInfo()};
function dmRename(){const c=Dm.chat,i=dmQ('#dmRn');if(!c||!i)return;const v=i.value.trim();if(!v){toast(TT(...DM_ERR.title));return}if(v!==c.title){send({t:'dm_room_rename',id:c.id,title:v});dmReget(1)}}
DO.dmkick=d=>{const c=Dm.chat;if(c)ask(TT('Remove '+esc(d.n)+' from this room?','เอา '+esc(d.n)+' ออกจากห้องนี้ใช่ไหม?'),()=>{send({t:'dm_room_kick',id:c.id,name:d.n});dmReget(1)},{cls:'red',yes:TT('Remove','เอาออก'),title:'🚪'})};
DO.dmleave=()=>{const c=Dm.chat;if(!c)return;const nx=c.owner===S.name&&c.members.length>1;ask(TT('Leave “'+esc(c.title)+'”?'+(nx?'\nThe next member becomes the owner.':''),'ออกจากห้อง “'+esc(c.title)+'” ใช่ไหม?'+(nx?'\nคนถัดไปจะได้เป็นเจ้าของห้องแทน':'')),()=>send({t:'dm_room_leave',id:c.id}),{cls:'red',yes:TT('Leave','ออกจากห้อง'),title:'🚪'})};
DO.dmdel=()=>{const c=Dm.chat;if(c)ask(TT('Disband “'+esc(c.title)+'”?\nAll messages are deleted and everyone is removed.','ยุบห้อง “'+esc(c.title)+'” ใช่ไหม?\nข้อความทั้งหมดจะหายไป และทุกคนจะถูกเชิญออกจากห้อง'),()=>send({t:'dm_room_del',id:c.id}),{cls:'red',yes:TT('Disband','ยุบห้อง'),title:'🗑️'})};
DO.dmpick=()=>{if(!Dm.chat)return;Dm.sub='pick';dmLayout();dmPick()};
function dmPick(){const c=Dm.chat,x=dmQ('.dmx');if(!c||!x||Dm.sub!='pick')return;const inr=new Set(c.members.map(p=>p.name.toLowerCase())),F=Dm.fr.filter(f=>!inr.has(f.name.toLowerCase()));
 x.innerHTML=dmSubHead('+ '+TT('Add a friend','เพิ่มเพื่อนเข้าห้อง'))+`<div class="dmxb"><div class="list">${F.length?F.map(f=>`<button class="li dmpk" data-do="dmadd" data-n="${esc(f.name)}">${dmFriendRow(f,'<span class="dmgo">➕</span>')}</button>`).join(''):emptyState('เพื่อนทุกคนอยู่ในห้องนี้แล้ว','All your friends are already in this room','🐾')}</div></div>`;dmPaint(x)}
DO.dmadd=d=>{const c=Dm.chat;if(!c)return;send({t:'dm_room_add',id:c.id,name:d.n});Dm.add=d.n;Dm.sub='info';dmLayout();dmInfo();dmReget(1)};
DO.dmnew=()=>{Object.assign(Dm,{sub:'new',sel:new Set(),ttl:''});dmLayout();dmNewView();const i=dmQ('#dmTtl');if(i)i.focus()};
function dmNewView(){const x=dmQ('.dmx');if(!x||Dm.sub!='new')return;
 dmKeep(x,()=>{x.innerHTML=dmSubHead('➕ '+TT('New room','ห้องใหม่'))+`<form class="dmxb dmnf" autocomplete="off"><label class="fld"><span>${TT('Room name','ชื่อห้อง')}</span><input id="dmTtl" maxlength="16" value="${esc(Dm.ttl)}" placeholder="${TT('e.g. Dog lovers','เช่น ก๊วนคนรักหมา')}" enterkeyhint="done"></label>
<div class="dmsl">${TT('Choose friends (up to 7)','เลือกเพื่อน (ได้สูงสุด 7 คน)')} <span id="dmSelN">${Dm.sel.size}/7</span></div><div class="list dmfl">${Dm.fr.length?Dm.fr.map(f=>`<label class="li dmpk"><input type="checkbox" data-n="${esc(f.name)}"${Dm.sel.has(f.name)?' checked':''}>${dmFriendRow(f)}</label>`).join(''):emptyState('ยังไม่มีเพื่อนให้ชวนเลย~ ไปเพิ่มเพื่อนก่อนนะ','No friends to invite yet~ add some first!','🐾')}</div>
<div class="row dmact"><button type="button" class="btn ghost" data-do="dmback">${t('Cancel')}</button><button class="btn pink" id="dmMk">${TT('Create room','สร้างห้อง')}</button></div></form>`;dmPaint(x)});dmNewBtn()}
function dmNewBtn(){const b=dmQ('#dmMk');if(b)b.disabled=!(Dm.ttl.trim()&&Dm.sel.size)}
function dmChk(i){if(Dm.sub!='new')return;if(i.checked){if(Dm.sel.size>=7){i.checked=false;toast(TT('You can pick up to 7 friends.','เลือกเพื่อนได้สูงสุด 7 คนนะ'));return}Dm.sel.add(i.dataset.n)}else Dm.sel.delete(i.dataset.n);const n=dmQ('#dmSelN');if(n)n.textContent=Dm.sel.size+'/7';dmNewBtn()}
function dmCreate(){const ti=Dm.ttl.trim(),mem=[...Dm.sel];if(!ti){toast(TT(...DM_ERR.title));const i=dmQ('#dmTtl');if(i)i.focus();return}if(!mem.length){toast(TT('Pick at least one friend.','เลือกเพื่อนอย่างน้อย 1 คนนะ'));return}send({t:'dm_room_new',title:ti,members:mem})}
// ---------------------------------------------------------------- talking to the server
const dmFk=()=>S.fr&&S.fr.friends?S.fr.friends.map(f=>f.name).join(','):'';
function dmSync(full){if(S.guest||!dmReady())return;Dm.ws=S.ws;Dm.fk=dmFk();Dm.lt=Date.now();send({t:'dm_list'});if(full&&Dm.cur&&Dm.log)send({t:'dm_get',id:Dm.cur})}
function dmTick(){if(!modOpen('dm')){clearInterval(Dm.tick);Dm.tick=0;return}if(S.guest||!dmReady())return;       // reconnected = a new socket: ask again; the friend list changed or 30 s passed: refresh the online dots
 if(S.ws!==Dm.ws)dmSync(true);else if(dmFk()!==Dm.fk||Date.now()-Dm.lt>3e4)dmSync()}
function dmReq(){if(Dm.gt)return;Dm.gt=setTimeout(()=>{Dm.gt=0;send({t:'dm_list'})},400)}
function dmReget(now){if(!Dm.cur)return;const id=Dm.cur,go=()=>{Dm.g2=0;if(modOpen('dm')&&Dm.cur==id)send({t:'dm_get',id})};if(now){clearTimeout(Dm.g2);go()}else if(!Dm.g2)Dm.g2=setTimeout(go,300)}
function dmRead(){if(Dm.rt||!Dm.cur)return;Dm.rt=setTimeout(()=>{Dm.rt=0;if(modOpen('dm')&&Dm.cur&&!document.hidden)send({t:'dm_read',id:Dm.cur})},1200)}      // throttled: a burst of messages is one "read"
document.addEventListener('visibilitychange',()=>{if(document.hidden||!modOpen('dm')||!Dm.cur)return;const r=dmRow(Dm.cur);if(r&&r.unread){r.unread=0;dmRenderList()}send({t:'dm_read',id:Dm.cur})});
H.dm_list=m=>{Dm.rows=Array.isArray(m.chats)?m.chats:[];Dm.fr=Array.isArray(m.friends)?m.friends:[];Object.assign(Dm.avs,m.avs||{});
 if(Dm.pin&&Dm.rows.some(r=>r.id==Dm.pin.id))Dm.pin=null;if(!modOpen('dm'))return;
 if(Dm.cur&&Dm.chat){const r=Dm.rows.find(x=>x.id==Dm.cur);
  if(r){Object.assign(Dm.chat,{title:r.title,muted:!!r.muted,ro:!!r.ro,owner:r.owner,members:r.members});r.unread=0;dmHead();dmRo()}
  else if(!Dm.pin){Dm.pin={id:Dm.cur,kind:Dm.chat.kind,title:Dm.chat.title,members:Dm.chat.members,last:null,unread:0,owner:Dm.chat.owner,muted:Dm.chat.muted,ro:Dm.chat.ro};
   if(Dm.chat.kind=='dm'&&Dm.log&&Dm.log.length&&!Dm.chat.ro)dmReget()}}      // a DM that has messages but left the list = the two are no longer friends: ask, so the page turns read-only
 dmRenderList();dmNewView();dmPick();dmInfo()};
H.dm_chat=m=>{if(typeof m.id!='string'||!modOpen('dm'))return;Object.assign(Dm.avs,m.avs||{});
 if(m.open){dmSelect(m.id);dmFocus()}else if(m.id!==Dm.cur)return;
 const c=Dm.chat={id:m.id,kind:m.kind,title:m.title,owner:m.owner,members:m.members||[],ro:!!m.ro,muted:!!m.muted},L=Array.isArray(m.msgs)?m.msgs.slice(-100):[],r=Dm.rows.find(x=>x.id==m.id);
 if(r)Object.assign(r,{unread:0,title:c.title,muted:c.muted,ro:c.ro,owner:c.owner,members:c.members});
 else{const l=L[L.length-1];Dm.pin={id:m.id,kind:c.kind,title:c.title,members:c.members,last:l?{n:l.n,m:Array.from(l.m).slice(0,80).join(''),t:l.t}:null,unread:0,owner:c.owner,muted:c.muted,ro:c.ro}}
 Dm.log=L;dmRo();dmHead();dmLogFill();dmRenderList();dmInfo();dmPick();
 if(Dm.add){if(c.members.some(p=>p.name==Dm.add))toast('✅ '+TT(Dm.add+' joined the room','เพิ่ม '+Dm.add+' เข้าห้องแล้ว'));Dm.add=''}};
H.dm_msg=m=>{const x=m&&m.msg;if(!x||typeof m.id!='string'||typeof x.m!='string'||typeof x.n!='string')return;const me=x.n==S.name,on=modOpen('dm')&&Dm.cur==m.id;
 let r=Dm.rows.find(q=>q.id==m.id);if(!r&&Dm.pin&&Dm.pin.id==m.id){r=Dm.pin;Dm.pin=null}
 if(!r){r={id:m.id,kind:m.kind,title:m.title,members:[],last:null,unread:0,owner:null,muted:false,ro:false};dmReq()}      // a chat the list does not know yet: a provisional row now, the real one in a moment
 Object.assign(r,{title:m.title,muted:!!m.muted,last:{n:x.n,m:Array.from(x.m).slice(0,80).join(''),t:x.t}});Dm.rows=[r,...Dm.rows.filter(q=>q!==r)];
 if(on){if(Dm.log)dmAppend(x);if(!me){if(document.hidden)r.unread++;else dmRead()}}
 else if(!me){r.unread=(r.unread|0)+1;S.me.dm=(S.me.dm|0)+1;UI.dock();if(!m.muted){toast('💬 '+(m.kind=='room'?m.title+' · '+x.n:m.title)+': '+dmPv(x.m,40),4200);if(Date.now()-Dm.snd>1500){Dm.snd=Date.now();sfx('notify')}}}      // not on screen: a toast + a ping (unless muted); the dock badge counts it
 if(modOpen('dm'))dmRenderList()};
H.dm_unread=m=>{S.me.dm=Math.max(0,m.n|0);UI.dock()};
H.dm_upd=m=>{const ti='“'+(m.title||'')+'”',by=m.by||'',nm=m.name||'',on=modOpen('dm')&&Dm.cur==m.id,say=(en,th,snd)=>{toast(TT(en,th),4200);if(snd)sfx('notify')};
 switch(m.ev){
  case'invite':say('💌 '+by+' invited you to '+ti,'💌 '+by+' ชวนคุณเข้าห้อง '+ti,1);break;
  case'kicked':say('You were removed from '+ti,'คุณถูกเชิญออกจากห้อง '+ti,1);break;
  case'del':say(ti+' was disbanded by '+by,'ห้อง '+ti+' ถูกยุบโดย '+by,1);break;
  case'rename':if(on)say(by+' renamed the room to '+ti,by+' เปลี่ยนชื่อห้องเป็น '+ti);break;
  case'add':if(on)say(by+' added '+nm,by+' เพิ่ม '+nm+' เข้าห้อง');break;
  case'kick':if(on)say(by+' removed '+nm,by+' เชิญ '+nm+' ออกจากห้อง');break;
  case'leave':if(on)say(nm+' left the room',nm+' ออกจากห้องแล้ว');break}
 if(on&&/^(rename|add|kick|leave)$/.test(m.ev))dmReget()};
H.dm_gone=m=>{const id=m.id;Dm.rows=Dm.rows.filter(r=>r.id!=id);if(Dm.pin&&Dm.pin.id==id)Dm.pin=null;delete Dm.drafts[id];
 if(!modOpen('dm'))return;if(Dm.cur==id){Object.assign(Dm,{cur:null,sub:null,chat:null,log:null,newc:0});dmLayout()}dmRenderList()};
H.dm_err=m=>{let k=String(m.k||'bad'),x=m.x||'';if(k=='in12')k=x==S.name?'in12me':'in12x';else if(k=='nofriend'&&x)k='nofriendx';const e=DM_ERR[k]||DM_ERR.bad;toast('⚠️ '+TT(e[0],e[1]).replace('%',()=>x));sfx('err');
 if(k=='slow'&&Dm.back&&Dm.back.id==Dm.cur){const i=dmQ('.dmi');if(i&&!i.value){i.value=Dm.back.m;dmCount()}Dm.at=Date.now()}Dm.back=null};
