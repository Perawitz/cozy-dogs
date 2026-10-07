// Cozy Dogs - private chat (v7): friend-to-friend DMs + friends-only group rooms. Server-authoritative: every message is validated again here, a client can send any JSON.
//   db.chats[id] = {id, kind:'dm'|'room', title, owner (rooms), members:[exact names], msgs:[{n,m,t}] (last 100), n (messages ever written),
//                   rd:{name:messages read}, j:{name:first message the member may see (rooms: nothing from before they joined)}, created, last, mute:{name:true}}
//   client -> server  dm_list  dm_open{with}  dm_get{id}  dm_send{id,m}  dm_read{id}  dm_room_new{title,members}  dm_room_add{id,name}  dm_room_kick{id,name}
//                     dm_room_rename{id,title}  dm_room_leave{id}  dm_room_del{id}  dm_mute{id,on}
//   server -> client  dm_list{chats,friends,avs}  dm_chat{...,open?}  dm_msg{id,msg,kind,title,muted}  dm_unread{n}  dm_upd{id,ev,...}  dm_gone{id}  dm_err{k,x?}
//   (errors are codes, not Thai text: the page words them in the player's language)
// Messages are routed here from server.js via CH.handle(); CH.unread(name) feeds the dock badge (me.dm).
'use strict';
module.exports=function(X){
const {db,conns,send,wsOf,own,safe,isGuestName,rid}=X, dirty=X.dirty, bump=X.bump||(()=>{});
const envN=(k,d)=>{const v=process.env[k];return v!=null&&v!==''&&Number.isFinite(+v)&&+v>=0?+v:d};
const MAXMSG=100,MAXTXT=200,MAXTITLE=16,MAXMEM=8,OWN=5,IN=12,TTL=60*864e5,DUP=8000;
const GAP=envN('CD_DMGAP',700), SWEEP=envN('CD_DMSWEEP',36e5)||36e5;      // (only so the automatic tests need not wait: CD_DMGAP = ms between two messages, CD_DMSWEEP = ms between clean-ups)

// ---------------------------------------------------------------- text
// like the public chat: no control / zero-width / bidi characters, one space between words, cut by CHARACTERS (never inside an emoji), never longer than n
const CTRL=new RegExp('['+[[0,0x1f],[0x7f,0x9f],[0xad,0xad],[0x61c,0x61c],[0x180e,0x180e],[0x200b,0x200f],[0x2028,0x202e],[0x2060,0x206f],[0xfeff,0xfeff],[0xfff9,0xfffb],[0xe0000,0xe007f]].map(([a,b])=>String.fromCodePoint(a)+'-'+String.fromCodePoint(b)).join('')+']','gu');      // C0/C1 controls, soft hyphen, Arabic letter mark, zero-width + bidi marks, line/paragraph separators, word joiner + isolates, BOM, annotation marks, tag characters
const LONE=/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g;      // half of a surrogate pair (hostile JSON) would show as a broken box
const txt=(s,n)=>typeof s!='string'?'':Array.from(s.replace(/[\t\n\r\u0085\u2028\u2029]/g,' ').replace(LONE,'').replace(CTRL,'').replace(/\s+/g,' ').trim()).slice(0,n).join('').trim();      // (a line break becomes a space, so pasted lines do not run together)
const title=s=>typeof s!='string'?'':txt(s.replace(/[<>]/g,''),MAXTITLE);
const dmId=(a,b)=>'dm:'+[a.toLowerCase(),b.toLowerCase()].sort().join('|');

// ---------------------------------------------------------------- people
const ex=n=>own(db.players,n);                                                         // still exists (guests are purged after a day)
const fr=n=>ex(n)&&Array.isArray(db.players[n].friends)?db.players[n].friends:[];
const mutual=(a,b)=>a!==b&&fr(a).includes(b)&&fr(b).includes(a);                       // friends in BOTH directions, right now
const pickName=(list,x)=>{if(typeof x!='string'||x.length>40)return'';const k=x.trim().toLowerCase();return k&&list.find(n=>n.toLowerCase()==k)||''};
const avOf=n=>{const p=ex(n)?db.players[n]:null;return p?{av:p.av||null,dog:(p.dogs&&p.dogs[0]&&p.dogs[0].breed)||null}:null};
const onSet=()=>new Set([...conns.values()].map(c=>c.name));
const wsMap=()=>{const m=new Map();for(const [w,c] of conns)m.set(c.name,w);return m};

// ---------------------------------------------------------------- storage
const chats=()=>db.chats||(db.chats=Object.create(null));       // (a getter: a Supabase load replaces db.chats after this module was created)
chats();
const getChat=id=>{const C=chats();return own(C,id)?C[id]:null};
let idx=null,idxFor=null;                                         // member name -> chats; rebuilt lazily after any change of membership (messages do not change it)
function norm(C){for(const k of Object.keys(C)){const ch=C[k];      // a hand-edited / older save must never crash the server: repair what can be repaired, drop the rest
  let ok=!!ch&&typeof ch=='object'&&ch.id===k&&(ch.kind=='dm'||ch.kind=='room')&&Array.isArray(ch.members)&&Array.isArray(ch.msgs);
  if(ok){ch.members=[...new Set(ch.members.filter(n=>typeof n=='string'&&n))];ch.msgs=ch.msgs.filter(x=>x&&typeof x.n=='string'&&typeof x.m=='string'&&Number.isFinite(x.t)).slice(-MAXMSG);
   for(const f of ['rd','j','mute'])if(!ch[f]||typeof ch[f]!='object'||Array.isArray(ch[f]))ch[f]={};
   ch.n=Number.isFinite(ch.n)?Math.max(ch.n|0,ch.msgs.length):ch.msgs.length;ch.title=typeof ch.title=='string'?ch.title:'';ch.created=Number.isFinite(ch.created)?ch.created:Date.now();ch.last=Number.isFinite(ch.last)?ch.last:ch.created;
   if(ch.kind=='dm')ok=ch.members.length==2;else{ok=ch.members.length>0;if(ok&&!ch.members.includes(ch.owner))ch.owner=ch.members[0]}}
  if(!ok)delete C[k]}}
const mine=name=>{const C=chats();if(idx===null||idxFor!==C){norm(C);idx=new Map();for(const ch of Object.values(C))for(const n of ch.members){let a=idx.get(n);if(!a)idx.set(n,a=[]);a.push(ch)}idxFor=C}return idx.get(name)||[]};
const rdOf=(ch,n)=>own(ch.rd,n)&&Number.isFinite(ch.rd[n])?ch.rd[n]:0, jOf=(ch,n)=>own(ch.j,n)&&Number.isFinite(ch.j[n])?ch.j[n]:0;
const unreadOf=(ch,n)=>Math.max(0,Math.min(ch.msgs.length,ch.n-Math.max(rdOf(ch,n),jOf(ch,n))));
const roOf=ch=>ch.kind=='dm'&&!(ch.members.length==2&&mutual(ch.members[0],ch.members[1]));      // a DM with someone who is no longer a friend: history stays, nothing new can be written
const shown=(ch,me)=>ch.members.includes(me)&&!(ch.kind=='dm'&&(ch.n==0||roOf(ch)));             // listed and counted: not an empty DM, not a DM with an ex-friend
const unread=name=>{let s=0;for(const ch of mine(name))if(shown(ch,name))s+=unreadOf(ch,name);return s};
const titleFor=(ch,me)=>ch.kind=='dm'?ch.members.find(n=>n!==me)||'':ch.title;
const muted=(ch,me)=>own(ch.mute,me)&&ch.mute[me]===true;
const ownedBy=n=>mine(n).filter(ch=>ch.kind=='room'&&ch.owner===n).length, inRooms=n=>mine(n).filter(ch=>ch.kind=='room').length;
function markRead(ch,me){if(own(ch.rd,me)&&rdOf(ch,me)===ch.n)return false;ch.rd[me]=ch.n;dirty();return true}
function dropMember(ch,n){ch.members=ch.members.filter(x=>x!==n);delete ch.rd[n];delete ch.j[n];delete ch.mute[n];idx=null;dirty()}

// ---------------------------------------------------------------- messages to the page
const err=(ws,k,x)=>send(ws,x==null?{t:'dm_err',k}:{t:'dm_err',k,x:String(x).slice(0,40)});
const gone=(ws,id)=>send(ws,{t:'dm_gone',id:typeof id=='string'?id.slice(0,64):''});
const pushUnread=name=>{const w=wsOf(name);if(w)send(w,{t:'dm_unread',n:unread(name)})};
function rowOf(ch,me,on){const l=ch.msgs[ch.msgs.length-1],see=ch.n>jOf(ch,me)&&l;
  return{id:ch.id,kind:ch.kind,title:titleFor(ch,me),members:ch.members.filter(ex).map(n=>({name:n,online:on.has(n)})),last:see?{n:l.n,m:Array.from(l.m).slice(0,80).join(''),t:l.t}:null,unread:unreadOf(ch,me),owner:ch.owner||null,muted:muted(ch,me),ro:roOf(ch)}}
function listMsg(me,on){on=on||onSet();const rows=mine(me).filter(ch=>shown(ch,me)).sort((a,b)=>b.last-a.last).slice(0,80).map(ch=>rowOf(ch,me,on));
  const fl=fr(me).filter(n=>mutual(me,n)&&!isGuestName(n)).sort((a,b)=>(on.has(b)-on.has(a))||(a.toLowerCase()<b.toLowerCase()?-1:1)).slice(0,100);
  const avs=Object.create(null);for(const n of fl)avs[n]=avOf(n);for(const r of rows)for(const m of r.members)if(!(m.name in avs))avs[m.name]=avOf(m.name);
  return{t:'dm_list',chats:rows,friends:fl.map(n=>({name:n,online:on.has(n)})),avs}}
function chatMsg(ch,me,open){const on=onSet(),start=Math.max(0,jOf(ch,me)-(ch.n-ch.msgs.length)),mem=ch.members.filter(ex).map(n=>({name:n,online:on.has(n)})),avs=Object.create(null);for(const m of mem)avs[m.name]=avOf(m.name);
  return{t:'dm_chat',id:ch.id,kind:ch.kind,title:titleFor(ch,me),owner:ch.owner||null,members:mem,msgs:ch.msgs.slice(start).map(x=>({n:x.n,m:x.m,t:x.t})),ro:roOf(ch),muted:muted(ch,me),avs,...(open?{open:1}:{})}}
function pushLists(names){const on=onSet(),W=wsMap();for(const n of new Set(names)){const w=W.get(n);if(w){send(w,listMsg(n,on));send(w,{t:'dm_unread',n:unread(n)})}}}
const pushEv=(names,o)=>{const W=wsMap();for(const n of names){const w=W.get(n);if(w)send(w,{t:'dm_upd',...o})}};

// ---------------------------------------------------------------- handlers
const HND=Object.create(null);
function need(ws,c,m){const ch=getChat(m.id);if(!ch||!ch.members.includes(c.name)){gone(ws,m.id);return null}return ch}      // unknown chat and "not yours" look the same: nobody can probe for other people's chats
HND.dm_list=(ws,c)=>send(ws,listMsg(c.name));
HND.dm_open=(ws,c,m)=>{const me=c.name;if(typeof m.with!='string'||m.with.length>40)return err(ws,'bad');
  if(m.with.trim().toLowerCase()==me.toLowerCase())return err(ws,'self');
  const o=pickName(fr(me),m.with);if(!o||!mutual(me,o))return err(ws,'nofriend');if(isGuestName(o))return err(ws,'guestfriend',o);
  const id=dmId(me,o),C=chats();let ch=own(C,id)?C[id]:null;
  if(!ch){const now=Date.now();ch=C[id]={id,kind:'dm',title:'',members:[me,o],msgs:[],n:0,rd:{[me]:0,[o]:0},j:{},created:now,last:now,mute:{}};idx=null;dirty()}
  const ch2=markRead(ch,me);send(ws,chatMsg(ch,me,true));if(ch2)pushUnread(me)};
HND.dm_get=(ws,c,m)=>{const ch=need(ws,c,m);if(!ch)return;const r=markRead(ch,c.name);send(ws,chatMsg(ch,c.name));if(r)pushUnread(c.name)};
HND.dm_read=(ws,c,m)=>{const ch=need(ws,c,m);if(ch&&markRead(ch,c.name))pushUnread(c.name)};
HND.dm_send=(ws,c,m)=>{const ch=need(ws,c,m);if(!ch)return;const me=c.name;
  if(roOf(ch)){send(ws,chatMsg(ch,me));return err(ws,'ro')}               // not friends any more: the page switches this chat to read-only
  const s=txt(m.m,MAXTXT);if(!s)return;
  const now=Date.now();if(now-(c.dmAt||0)<GAP)return err(ws,'slow');
  const key=ch.id+'\n'+s;if(c.dmTxt===key&&now-c.dmAt<DUP)return;          // the same words twice within 8 s in the same chat: ignored
  c.dmAt=now;c.dmTxt=key;bump(me,'dm',1,ws);       // counts for the starter mission "send a private message"
  const msg={n:me,m:s,t:now};ch.msgs.push(msg);ch.n++;if(ch.msgs.length>MAXMSG)ch.msgs.splice(0,ch.msgs.length-MAXMSG);ch.last=now;ch.rd[me]=ch.n;dirty();
  const W=wsMap();for(const n of ch.members){const w=W.get(n);if(!w)continue;send(w,{t:'dm_msg',id:ch.id,kind:ch.kind,title:titleFor(ch,n),muted:muted(ch,n),msg});send(w,{t:'dm_unread',n:unread(n)})}};
HND.dm_room_new=(ws,c,m)=>{const me=c.name,ti=title(m.title);
  if(!ti)return err(ws,'title');if(!Array.isArray(m.members)||m.members.length>20)return err(ws,'members');
  const set=new Set();for(const x of m.members){if(typeof x!='string')return err(ws,'bad');if(x.trim().toLowerCase()==me.toLowerCase())continue;
    const n=pickName(fr(me),x);if(!n||!mutual(me,n))return err(ws,'nofriend',x);if(isGuestName(n))return err(ws,'guestfriend',n);set.add(n)}
  if(!set.size||set.size>MAXMEM-1)return err(ws,'members');
  if(ownedBy(me)>=OWN)return err(ws,'own5');if(inRooms(me)>=IN)return err(ws,'in12',me);
  for(const n of set)if(inRooms(n)>=IN)return err(ws,'in12',n);
  const C=chats(),now=Date.now(),members=[me,...set];let id;do id=rid();while(own(C,id));
  const ch=C[id]={id,kind:'room',title:ti,owner:me,members,msgs:[],n:0,rd:{},j:{},created:now,last:now,mute:{}};for(const n of members)ch.rd[n]=0;idx=null;dirty();
  send(ws,chatMsg(ch,me,true));pushEv([...set],{id,ev:'invite',title:ti,by:me});pushLists(members)};
HND.dm_room_add=(ws,c,m)=>{const ch=need(ws,c,m);if(!ch)return;const me=c.name;if(ch.kind!='room')return err(ws,'bad');if(ch.owner!==me)return err(ws,'notowner');
  const n=pickName(fr(me),m.name);if(!n||!mutual(me,n))return err(ws,'nofriend');if(isGuestName(n))return err(ws,'guestfriend',n);
  if(ch.members.includes(n))return err(ws,'already',n);if(ch.members.length>=MAXMEM)return err(ws,'full');if(inRooms(n)>=IN)return err(ws,'in12',n);
  ch.members.push(n);ch.rd[n]=ch.n;ch.j[n]=ch.n;idx=null;dirty();      // the new member starts at "now": older messages stay private to the people who were there
  pushEv([n],{id:ch.id,ev:'invite',title:ch.title,by:me});pushEv(ch.members.filter(x=>x!==n&&x!==me),{id:ch.id,ev:'add',title:ch.title,by:me,name:n});pushLists(ch.members)};
HND.dm_room_kick=(ws,c,m)=>{const ch=need(ws,c,m);if(!ch)return;const me=c.name;if(ch.kind!='room')return err(ws,'bad');if(ch.owner!==me)return err(ws,'notowner');
  const n=pickName(ch.members,m.name);if(!n||n===me)return err(ws,'bad');
  dropMember(ch,n);const w=wsOf(n);if(w){gone(w,ch.id);send(w,{t:'dm_upd',id:ch.id,ev:'kicked',title:ch.title,by:me});send(w,{t:'dm_unread',n:unread(n)})}
  pushEv(ch.members.filter(x=>x!==me),{id:ch.id,ev:'kick',title:ch.title,by:me,name:n});pushLists(ch.members)};
HND.dm_room_rename=(ws,c,m)=>{const ch=need(ws,c,m);if(!ch)return;const me=c.name;if(ch.kind!='room')return err(ws,'bad');if(ch.owner!==me)return err(ws,'notowner');
  const ti=title(m.title);if(!ti)return err(ws,'title');if(ti===ch.title)return pushLists([me]);
  ch.title=ti;dirty();pushEv(ch.members.filter(x=>x!==me),{id:ch.id,ev:'rename',title:ti,by:me});pushLists(ch.members)};
HND.dm_room_leave=(ws,c,m)=>{const ch=need(ws,c,m);if(!ch)return;const me=c.name;if(ch.kind!='room')return err(ws,'bad');
  dropMember(ch,me);let owner=null;
  if(!ch.members.length)delete chats()[ch.id];                              // nobody left: the room is gone
  else if(ch.owner===me)owner=ch.owner=ch.members[0];                       // the owner left: the next member in line takes over
  gone(ws,ch.id);pushUnread(me);pushEv(ch.members,{id:ch.id,ev:'leave',title:ch.title,by:me,name:me,owner});pushLists(ch.members)};
HND.dm_room_del=(ws,c,m)=>{const ch=need(ws,c,m);if(!ch)return;const me=c.name;if(ch.kind!='room')return err(ws,'bad');if(ch.owner!==me)return err(ws,'notowner');
  delete chats()[ch.id];idx=null;dirty();const W=wsMap();
  for(const n of ch.members){const w=W.get(n);if(!w)continue;if(n!==me)send(w,{t:'dm_upd',id:ch.id,ev:'del',title:ch.title,by:me});gone(w,ch.id);send(w,{t:'dm_unread',n:unread(n)})}};
HND.dm_mute=(ws,c,m)=>{const ch=need(ws,c,m);if(!ch||typeof m.on!='boolean')return;if(m.on)ch.mute[c.name]=true;else delete ch.mute[c.name];dirty();pushLists([c.name])};

function handle(ws,c,m){const f=HND[m.t];if(!f)return false;      // (HND has no prototype: "dm_constructor" can never reach an inherited function)
  if(c.guest){err(ws,'guest');return true}
  try{f(ws,c,m)}catch(e){console.error('[chat]',e&&e.stack||e)}
  return true}
const onClose=()=>{};

// ---------------------------------------------------------------- clean-up (hourly): nobody wrote for 60 days -> deleted; members that no longer exist (purged guests) leave
function sweep(){const C=chats(),now=Date.now(),W=wsMap(),dead=[];let any=false;
  for(const ch of Object.values(C)){let rm=now-ch.last>TTL;
    if(!rm){const miss=ch.members.filter(n=>!ex(n));if(miss.length){any=true;if(ch.kind=='dm')rm=true;else{for(const n of miss)dropMember(ch,n);if(!ch.members.length)rm=true;else if(!ch.members.includes(ch.owner))ch.owner=ch.members[0]}}}
    if(rm){delete C[ch.id];dead.push(ch);any=true}}
  if(!any)return;idx=null;dirty();
  for(const ch of dead)for(const n of ch.members){const w=W.get(n);if(w){gone(w,ch.id);send(w,{t:'dm_unread',n:unread(n)})}}}
setInterval(safe('dmsweep',sweep),SWEEP);

// optional hook for server.js: after friend_del call CH.onFriendChange(a,b) so both pages drop / reopen the DM at once (without it the next dm_* message does the same)
const onFriendChange=(a,b)=>pushLists([a,b]);

return{handle,onClose,unread:name=>{try{return unread(name)}catch(e){console.error('[chat]',e&&e.stack||e);return 0}},onFriendChange,sweep};
};
