// Private chat (friend DMs + friends-only rooms) - server tests. Self-contained: starts its OWN servers (temp data files, CD_TEST=1) on PORT+12 / PORT+13 (PORT defaults to 3055) and uses the global WebSocket of Node 22.
//   server 1: CD_DMGAP=15 (fast, so 105 messages do not take a minute), CD_RATE=2000        server 2: the real defaults (700 ms between two messages)
// node server_test_chat.js     (or  PORT=3138 node server_test_chat.js  -> ports 3150 / 3151)
'use strict';
const {spawn}=require('child_process'),http=require('http'),os=require('os'),path=require('path'),fs=require('fs');
const BASE=+(process.env.PORT||3055),P1=BASE+12,P2=BASE+13;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let pass=0,fail=0;const ok=(c,n)=>{c?pass++:fail++;console.log(c?'PASS':'FAIL',n)};
const tmp=n=>path.join(os.tmpdir(),'cozydogs_chat_'+n+'_'+process.pid+'.json');
const rm=f=>{for(const x of [f,f+'.bak',f+'.tmp'])try{fs.unlinkSync(x)}catch{}};
const CP=(...n)=>String.fromCodePoint(...n);      // invisible / odd characters are built from code points (never typed), so this file stays readable
const NUL=CP(0),BEL=CP(7),US=CP(0x1f),RLO=CP(0x202e),LRI=CP(0x2066),PDI=CP(0x2069),ZWSP=CP(0x200b),ZWNJ=CP(0x200c),ZWJ=CP(0x200d),LRM=CP(0x200e),RLM=CP(0x200f),BOM=CP(0xfeff),LS=CP(0x2028),HALF=CP(0xd800);

// ---------- servers
function boot(port,data,env){const p=spawn(process.execPath,[path.join(__dirname,'server.js')],{env:{...process.env,PORT:String(port),DATA:data,CD_TEST:'1',...env},stdio:['ignore','pipe','inherit']});p.stdout.on('data',()=>{});return p}
async function up(port){for(let i=0;i<80;i++){try{await new Promise((res,rej)=>http.get({host:'127.0.0.1',port,path:'/healthz'},r=>{r.resume();r.on('end',res)}).on('error',rej));return}catch{await sleep(100)}}throw new Error('server did not start on '+port)}
const stop=p=>new Promise(r=>{if(p.exitCode!==null)return r();p.once('exit',r);p.kill()});      // SIGTERM: the server saves its data first

// ---------- client
function cli(port){return new Promise((res,rej)=>{const ws=new WebSocket('ws://localhost:'+port),log=[];
  const o={ws,log,send:m=>ws.send(typeof m=='string'?m:JSON.stringify(m)),
   wait:(t,ms=3000,f=null)=>new Promise((ok,no)=>{const g=()=>{const i=log.findIndex(x=>x.t==t&&(!f||f(x)));if(i>=0)return ok(log.splice(i,1)[0]);if((ms-=20)<=0)return no(new Error('timeout '+t));setTimeout(g,20)};g()}),
   last:(t,f)=>[...log].reverse().find(x=>x.t==t&&(!f||f(x))),all:(t,f)=>log.filter(x=>x.t==t&&(!f||f(x))),clear:t=>{for(let i=log.length-1;i>=0;i--)if(!t||log[i].t==t)log.splice(i,1)},
   async auth(m){o.send(m);const a=await o.wait('auth',5000);if(a.ok){o.name=a.name;await o.wait('me',3000)}return a},
   rq:(m,t,f,ms)=>{o.send(m);return o.wait(t,ms||3000,f)}};      // send + wait for the answer
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.t=='me')o.me=m;log.push(m)};ws.onopen=()=>res(o);ws.onerror=()=>rej(new Error('connect'))})}
const tryWait=async(c,t,ms,f)=>{try{return await c.wait(t,ms,f)}catch{return null}};
const quiet=async(c,t,f,ms=250)=>{await sleep(ms);return !c.log.some(x=>x.t==t&&(!f||f(x)))};      // nothing of that kind arrived

(async()=>{
const D1=tmp('a'),D2=tmp('b');rm(D1);rm(D2);
let srv=boot(P1,D1,{CD_DMGAP:'15',CD_RATE:'2000'}),srv2=boot(P2,D2,{CD_RATE:'2000'});
const done=async()=>{for(const p of [srv,srv2])try{p.kill()}catch{}await sleep(200);rm(D1);rm(D2);console.log('\nPASS',pass,'FAIL',fail);process.exit(fail?1:0)};
try{
await Promise.all([up(P1),up(P2)]);
const mk=async(name,port=P1)=>{const c=await cli(port);const a=await c.auth({t:'register',user:name,email:name.toLowerCase()+'@t.co',pass:'secret1'});if(!a.ok)throw new Error('register '+name+' '+a.err);return c};
const relog=async(old,name)=>{try{old.ws.close()}catch{}await sleep(120);const c=await cli(P1);const a=await c.auth({t:'login',user:name,pass:'secret1'});if(!a.ok)throw new Error('login '+name);return c};
const befriend=async(x,y)=>{x.send({t:'friend_add',name:y.name});await y.wait('friends',3000,f=>f.inReq.some(r=>r.name==x.name));y.send({t:'friend_ok',name:x.name});await y.wait('friends',3000,f=>f.friends.some(r=>r.name==x.name));x.clear('friends');y.clear('friends')};
const unfriend=async(x,y)=>{x.send({t:'friend_del',name:y.name});await x.wait('friends',3000,f=>!f.friends.some(r=>r.name==y.name));x.clear('friends')};
// "say": send and wait for our own message to come back (so two messages can never reach the server in the same instant)
const say=async(c,id,m)=>{c.send({t:'dm_send',id,m});await c.wait('dm_msg',2000,x=>x.id==id&&x.msg.m==m);await sleep(22)};
const lst=c=>{c.clear('dm_list');return c.rq({t:'dm_list'},'dm_list')};
const rowOf=(l,id)=>l.chats.find(r=>r.id==id);
const room=async(c,title,members)=>{c.clear('dm_chat');c.send({t:'dm_room_new',title,members});return c.wait('dm_chat')};

let A=await mk('Aoi'),B=await mk('Bob'),C=await mk('Cat'),Dn=await mk('Dan'),E=await mk('Eve');
ok(A.me.dm===0&&typeof A.me.dm=='number','me.dm is a number (0 for a new player)');

// =============================================================== 1. guests
const G=await cli(P1);const ga=await G.auth({t:'guest'});ok(ga.ok&&ga.guest&&G.me.dm===0,'(setup) a guest is logged in');
for(const m of [{t:'dm_list'},{t:'dm_open',with:'Aoi'},{t:'dm_send',id:'dm:aoi|bob',m:'hi'},{t:'dm_room_new',title:'x',members:['Aoi']},{t:'dm_get',id:'x'},{t:'dm_mute',id:'x',on:true}]){
  G.clear();G.send(m);const e=await tryWait(G,'dm_err',1500);ok(e&&e.k=='guest'&&!G.log.some(x=>x.t=='dm_list'||x.t=='dm_chat'),'guest refused: '+m.t)}

// =============================================================== 2. DMs only between current mutual friends
let e,l,o,ch,mm,un,s,g,ev;
A.clear();
for(const [w,k,n] of [['Bob','nofriend','not a friend yet'],['nobody','nofriend','a name that does not exist'],['aoi','self','yourself (any capitals)'],['  AOI  ','self','yourself with spaces']]){
  A.send({t:'dm_open',with:w});e=await A.wait('dm_err');ok(e.k==k,'dm_open refused ('+n+'): '+e.k)}
for(const [w,n] of [[['Bob'],'an array'],[{a:1},'an object'],[5,'a number'],[null,'null'],[undefined,'nothing'],['x'.repeat(300),'a 300 character name'],[true,'a boolean']]){
  A.send({t:'dm_open',with:w});e=await A.wait('dm_err');ok(e.k=='bad','dm_open with '+n+' -> bad')}
A.send({t:'dm_send',id:'dm:aoi|bob',m:'hello?'});g=await A.wait('dm_gone');ok(g.id=='dm:aoi|bob'&&!A.last('dm_msg'),'sending to a DM that does not exist is refused (dm_gone)');
// a guest can be a friend, but cannot be chatted with
await befriend(G,A);A.clear();A.send({t:'dm_open',with:G.name});e=await A.wait('dm_err');ok(e.k=='guestfriend','a guest friend cannot be DM-ed');
A.send({t:'dm_room_new',title:'g',members:[G.name]});e=await A.wait('dm_err');ok(e.k=='guestfriend','a guest friend cannot be invited to a room');
await unfriend(A,G);G.ws.close();

await befriend(A,B);await befriend(A,C);await befriend(A,Dn);await befriend(B,C);
A.clear();B.clear();
o=await A.rq({t:'dm_open',with:'bob'},'dm_chat');         // lower case: names are matched without capitals
ok(o.kind=='dm'&&o.open==1&&o.id=='dm:aoi|bob'&&o.title=='Bob'&&!o.ro&&!o.muted&&Array.isArray(o.msgs)&&o.msgs.length==0,'dm_open after becoming friends -> dm_chat (id from the sorted lower-case names, title = the other player)');
ok(o.members.length==2&&o.members.some(m=>m.name=='Bob'&&m.online===true)&&o.members.some(m=>m.name=='Aoi'),'members with online flags');
const DMID=o.id;
const o2=await B.rq({t:'dm_open',with:'AOI'},'dm_chat');ok(o2.id==DMID&&o2.title=='Aoi','the other side gets the SAME DM id');
l=await lst(B);ok(!rowOf(l,DMID),'an empty DM does not show up in the list yet');

// =============================================================== 3. messages, live push, unread
A.clear();B.clear();
A.send({t:'dm_send',id:DMID,m:'hi Bob'});
mm=await B.wait('dm_msg');ok(mm.id==DMID&&mm.msg.n=='Aoi'&&mm.msg.m=='hi Bob'&&Math.abs(mm.msg.t-Date.now())<5000&&mm.title=='Aoi'&&mm.kind=='dm'&&mm.muted===false,'live dm_msg pushed to the other side {id,msg:{n,m,t}}');
un=await B.wait('dm_unread');ok(un.n===1,'...with dm_unread 1 for the receiver');
const mm2=await A.wait('dm_msg');ok(mm2.msg.m=='hi Bob'&&mm2.title=='Bob','the sender gets the message back too (dm_msg)');
un=await A.wait('dm_unread');ok(un.n===0,'...and the sender has nothing unread');
l=await lst(B);let r=rowOf(l,DMID);ok(r&&r.unread===1&&r.last.m=='hi Bob'&&r.last.n=='Aoi'&&r.title=='Aoi'&&r.kind=='dm'&&r.ro===false&&r.muted===false&&r.owner===null&&r.members.length==2,'dm_list row: unread, last message, title, ro, muted');
ok(Array.isArray(l.friends)&&l.friends.some(f=>f.name=='Aoi'&&f.online===true)&&l.avs&&l.avs.Aoi&&'av' in l.avs.Aoi,'dm_list also carries the friends and their avatars');
const lA=await lst(A);ok(rowOf(lA,DMID)&&rowOf(lA,DMID).unread===0,'the sender sees the chat with unread 0');
await say(A,DMID,'second');await say(A,DMID,'third');await say(A,DMID,'fourth');
B.clear();B.send({t:'dm_get',id:DMID});ch=await B.wait('dm_chat');un=await B.wait('dm_unread');
ok(ch.msgs.map(x=>x.m).join('|')=='hi Bob|second|third|fourth'&&un.n===0,'dm_get returns the history in order and marks it read (dm_unread 0)');
l=await lst(B);ok(rowOf(l,DMID).unread===0,'...and the list agrees');
await say(A,DMID,'fifth');B.clear();B.send({t:'dm_read',id:DMID});un=await B.wait('dm_unread');ok(un.n===0,'dm_read clears the unread counter');
B.clear();B.send({t:'dm_read',id:DMID});ok(await quiet(B,'dm_unread'),'dm_read of an already read chat sends nothing');
// someone else's chat
C.clear();for(const t of ['dm_get','dm_read','dm_send','dm_mute']){C.send({t,id:DMID,m:'spy',on:true});g=await C.wait('dm_gone');ok(g.id==DMID,'a stranger cannot use '+t+' on a DM he is not in')}
ok(await quiet(A,'dm_msg',x=>x.msg.m=='spy'),'...and nothing was delivered');
l=await lst(C);ok(!rowOf(l,DMID),'a stranger does not see it in his list');

// offline delivery: unread appears in me.dm after login
B.ws.close();await sleep(150);
await say(A,DMID,'offline one');await say(A,DMID,'offline two');
B=await relog(B,'Bob');ok(B.me.dm===2,'offline delivery: me.dm is 2 right after login (got '+B.me.dm+')');
l=await lst(B);ok(rowOf(l,DMID).unread===2&&rowOf(l,DMID).members.find(m=>m.name=='Aoi').online===true,'the list agrees and shows A online');
B.ws.close();await sleep(150);l=await lst(A);ok(rowOf(l,DMID).members.find(m=>m.name=='Bob').online===false,'an offline friend shows online:false');
B=await relog(B,'Bob');

// =============================================================== 4. mute
B.clear();B.send({t:'dm_mute',id:DMID,on:'yes'});ok(await quiet(B,'dm_list'),'dm_mute with a non-boolean is ignored');
B.send({t:'dm_mute',id:DMID,on:true});l=await B.wait('dm_list');ok(rowOf(l,DMID).muted===true,'dm_mute on -> list says muted');
B.clear();await say(A,DMID,'while muted');mm=await B.wait('dm_msg');un=await B.wait('dm_unread');ok(mm.muted===true&&un.n>=1,'a muted chat still counts unread, and the push is marked muted (the page shows no toast / sound)');
B.send({t:'dm_mute',id:DMID,on:false});l=await B.wait('dm_list');ok(rowOf(l,DMID).muted===false,'dm_mute off');
B.send({t:'dm_get',id:DMID});await B.wait('dm_chat');

// =============================================================== 5. text cleaning
const send1=async m=>{A.clear();B.clear();A.send({t:'dm_send',id:DMID,m});const x=await tryWait(B,'dm_msg',500);await sleep(30);return x&&x.msg.m};
ok(await send1('a'+NUL+'b'+BEL+'c'+US+'d')=='abcd','control characters are removed');
ok(await send1('x'+RLO+'y'+RLO+'z'+LRI+'w'+PDI)=='xyzw','bidi override / isolate characters are removed');
ok(await send1('zero'+ZWSP+'width'+ZWNJ+ZWJ+LRM+RLM+BOM+'join')=='zerowidthjoin','zero-width characters are removed');
ok(await send1('   many    spaces \t\n here  ')=='many spaces here','spaces are collapsed, ends trimmed, tabs / newlines become spaces');
ok(await send1('line1\r\nline2'+LS+'line3')=='line1 line2 line3','line breaks and separators become spaces');
ok(await send1('lone'+HALF+'half')=='lonehalf','a half surrogate pair is dropped');
s=await send1('a'.repeat(199)+'😀'+'zzz');ok(Array.from(s).length==200&&s.endsWith('😀')&&!s.includes('�')&&!s.includes('z'),'cut at 200 CHARACTERS: the emoji at the border stays whole');
s=await send1('ก'.repeat(300));ok(Array.from(s).length==200&&s=='ก'.repeat(200),'300 Thai letters -> 200 characters');
s=await send1('😀'.repeat(150));ok(s=='😀'.repeat(150),'150 emoji (300 UTF-16 units) are all kept: the limit counts characters, not bytes');
s=await send1('😀'.repeat(230));ok(Array.from(s).length==200&&s=='😀'.repeat(200),'230 emoji -> exactly 200, none split');
s=await send1('<b>hi</b> & "q"');ok(s=='<b>hi</b> & "q"','markup is kept as text (the page escapes it) - same as the public chat');
s=await send1('สวัสดีครับ 🐶 ทดสอบ');ok(s=='สวัสดีครับ 🐶 ทดสอบ','Thai + emoji pass through unchanged');
for(const [v,n] of [[ZWSP+RLO+'   ','only invisible characters'],['','an empty string'],[['hi'],'an array'],[{m:'x'},'an object'],[5,'a number'],[null,'null'],[true,'true'],[undefined,'nothing']]){
  const x=await send1(v);ok(!x,'message that is not a usable text is ignored: '+n)}
A.clear();B.clear();A.send('{"t":"dm_send","id":"'+DMID+'","m":"'+'w'.repeat(7000)+'"}');mm=await B.wait('dm_msg');ok(mm.msg.m=='w'.repeat(200),'a 7000 character message is cut to 200');
await sleep(30);

// =============================================================== 6. same words twice / fast typing
A.clear();B.clear();A.send({t:'dm_send',id:DMID,m:'same words'});await sleep(60);A.send({t:'dm_send',id:DMID,m:'same words'});await sleep(300);
ok(B.all('dm_msg').length==1&&B.all('dm_msg')[0].msg.m=='same words','identical text twice within 8 s is ignored (only one arrives)');
A.clear();B.clear();A.send({t:'dm_send',id:DMID,m:'one'});A.send({t:'dm_send',id:DMID,m:'two'});await sleep(250);
e=A.last('dm_err');ok(e&&e.k=='slow'&&B.all('dm_msg').length==1,'two messages in the same instant: the second one is refused with dm_err slow');

// =============================================================== 7. history cap 100
for(let i=0;i<105;i++)await say(A,DMID,'cap '+i);
await sleep(100);B.clear();B.send({t:'dm_get',id:DMID});ch=await B.wait('dm_chat');
const caps=ch.msgs.filter(x=>x.m.startsWith('cap '));
ok(ch.msgs.length==100&&caps.length==100&&caps[0].m=='cap 5'&&caps[99].m=='cap 104','history is capped at the last 100 messages (first kept: '+(caps[0]&&caps[0].m)+', last: '+(caps[99]&&caps[99].m)+')');
ok(ch.msgs.every((x,i)=>i==0||x.t>=ch.msgs[i-1].t),'...in time order');
for(let i=0;i<3;i++)await say(A,DMID,'more '+i);
l=await lst(B);ok(rowOf(l,DMID).unread===3,'unread counts only messages after the read marker even after old ones were trimmed ('+rowOf(l,DMID).unread+')');
for(let i=0;i<110;i++)await say(A,DMID,'bulk '+i);
l=await lst(B);ok(rowOf(l,DMID).unread===100,'unread is never more than the 100 messages that are kept ('+rowOf(l,DMID).unread+')');
B.clear();B.send({t:'dm_get',id:DMID});await B.wait('dm_chat');l=await lst(B);ok(rowOf(l,DMID).unread===0,'...and dm_get clears it');
l=await lst(A);ok(rowOf(l,DMID).last.m=='bulk 109','the list shows the newest message as the preview');

// =============================================================== 8. hostile input
const raw=['{"t":"dm_get","id":"__proto__"}','{"t":"dm_get","id":"constructor"}','{"t":"dm_send","id":"toString","m":"x"}','{"t":"dm_get","id":{"toString":1}}','{"t":"dm_get","id":["dm:aoi|bob"]}','{"t":"dm_send","id":5,"m":"x"}','{"t":"dm_send","id":null,"m":"x"}',
 '{"t":"dm_open","with":"__proto__"}','{"t":"dm_open","with":"constructor"}','{"t":"dm_open","with":{"__proto__":{"x":1}}}','{"t":"dm_room_new","title":"__proto__","members":["__proto__","constructor"]}','{"t":"dm_room_new","title":"x","members":"Bob"}',
 '{"t":"dm_room_new","title":"x","members":{"0":"Bob"}}','{"t":"dm_room_new","title":["x"],"members":["Bob"]}','{"t":"dm_room_new","title":"x","members":[{"a":1}]}','{"t":"dm_room_new","title":"x","members":[null]}','{"t":"dm_room_new","title":"x","members":[5]}','{"t":"dm_room_new","title":"x","members":[["Bob"]]}',
 '{"t":"dm_room_add","id":"__proto__","name":"Bob"}','{"t":"dm_room_kick","id":"constructor","name":"__proto__"}','{"t":"dm_room_rename","id":{"a":1},"title":{"b":2}}','{"t":"dm_room_leave","id":["x"]}','{"t":"dm_room_del","id":false}','{"t":"dm_mute","id":"__proto__","on":true}',
 '{"t":"dm_constructor"}','{"t":"dm___proto__"}','{"t":"dm_toString","id":"x"}','{"t":"dm_","id":"x"}','{"t":"dm_list","extra":{"__proto__":{"polluted":1}}}','{"t":"dm_send","id":"'+DMID+'","m":{"__proto__":{"polluted":1}}}',
 '{"t":"dm_send","id":"'+DMID+'","m":{"toString":"x"}}','{"t":"dm_open","with":{"toString":"x"}}','[]','{"t":"dm_open"}','{"t":"dm_send"}','{"t":"dm_room_new"}','{"t":"dm_room_add"}','{"t":"dm_mute"}','{"t":"dm_get","id":"dm:aoi|bob","m":1}'];
A.clear();B.clear();for(const x of raw){A.send(x);await sleep(12)}
await sleep(400);
ok(!A.log.some(x=>x.t=='dm_msg'||(x.t=='dm_chat'&&x.id!=DMID)),'none of '+raw.length+' hostile messages created or delivered anything');
l=await lst(A);ok(l&&l.t=='dm_list','the server survived them and still answers');
ok(!({}).polluted&&!Object.prototype.polluted,'no prototype pollution');
ok(l.chats.length==1&&l.chats[0].id==DMID,'the list still holds only the one real chat');

// =============================================================== 9. rooms: create
A.clear();B.clear();C.clear();Dn.clear();
A.send({t:'dm_room_new',title:'  ',members:['Bob']});e=await A.wait('dm_err');ok(e.k=='title','room without a title refused');
for(const [t,n] of [[undefined,'missing'],[5,'a number'],[['x'],'an array'],[{a:1},'an object'],[ZWSP+RLO,'only invisible characters'],['<>','only < >']]){A.send({t:'dm_room_new',title:t,members:['Bob']});e=await A.wait('dm_err');ok(e.k=='title','title '+n+' refused')}
for(const [m,k,n] of [[[],'members','no friends'],[undefined,'members','no list'],['Bob','members','a string'],[{0:'Bob'},'members','an object'],[[5],'bad','a number in the list'],[[null],'bad','null in the list'],[[{a:1}],'bad','an object in the list'],[[['Bob']],'bad','an array in the list'],[['Aoi'],'members','only yourself'],[['Eve'],'nofriend','a player who is not a friend'],[['ghost'],'nofriend','a name that does not exist'],[['Bob','Eve'],'nofriend','one friend and one stranger'],[Array(21).fill('Bob'),'members','21 entries']]){
  A.send({t:'dm_room_new',title:'Room',members:m});e=await A.wait('dm_err');ok(e.k==k,'dm_room_new with '+n+' -> '+e.k)}
l=await lst(A);ok(l.chats.filter(x=>x.kind=='room').length==0,'(none of those created a room)');
A.clear();B.clear();C.clear();
A.send({t:'dm_room_new',title:'  Puppy <b>Squad</b>  club of the best dogs ',members:['bob','BOB','Aoi','cat',' Cat ']});
ch=await A.wait('dm_chat');const RID=ch.id;
ok(ch.kind=='room'&&ch.open==1&&ch.owner=='Aoi'&&/^[0-9a-f]{10}$/.test(RID)&&ch.members.map(m=>m.name).join()=='Aoi,Bob,Cat'&&ch.msgs.length==0&&!ch.ro,'room created: owner = creator, members deduped (self and repeats ignored, names matched without capitals)');
ok(ch.title=='Puppy bSquad/b c','title cleaned: no < >, max 16 characters ('+ch.title+')');
const TITLE=ch.title;
ev=await B.wait('dm_upd');ok(ev.ev=='invite'&&ev.id==RID&&ev.by=='Aoi'&&ev.title==TITLE,'invited members get dm_upd {ev:invite}');
await C.wait('dm_upd');
l=await B.wait('dm_list');r=rowOf(l,RID);ok(r&&r.kind=='room'&&r.title==TITLE&&r.owner=='Aoi'&&r.members.length==3&&r.unread===0&&r.last===null,'invited members get a fresh dm_list with the room');
// talk in the room
A.clear();B.clear();C.clear();
await say(A,RID,'welcome all');B.send({t:'dm_send',id:RID,m:'thanks A'});await sleep(80);
mm=await C.wait('dm_msg',2000,x=>x.msg.n=='Aoi');ok(mm.kind=='room'&&mm.title==TITLE&&mm.msg.m=='welcome all','room message goes to every member (title = room name)');
ok((await C.wait('dm_msg',2000,x=>x.msg.n=='Bob')).msg.m=='thanks A','...from any member');
un=C.last('dm_unread');ok(un&&un.n===2,'C has 2 unread in the room');
// non-owners cannot manage
B.clear();for(const [m,k] of [[{t:'dm_room_add',id:RID,name:'Dan'},'notowner'],[{t:'dm_room_kick',id:RID,name:'Cat'},'notowner'],[{t:'dm_room_rename',id:RID,title:'Mine'},'notowner'],[{t:'dm_room_del',id:RID},'notowner']]){B.send(m);e=await B.wait('dm_err');ok(e.k==k,'a member who is not the owner cannot '+m.t)}
// add friend (history stays private)
A.clear();Dn.clear();B.clear();C.clear();
await say(A,RID,'before Dan');
A.send({t:'dm_room_add',id:RID,name:'Eve'});e=await A.wait('dm_err');ok(e.k=='nofriend','owner cannot add a player who is not his friend');
A.send({t:'dm_room_add',id:RID,name:'bob'});e=await A.wait('dm_err');ok(e.k=='already'&&e.x=='Bob','adding someone who is already inside is refused');
A.send({t:'dm_room_add',id:RID,name:{a:1}});e=await A.wait('dm_err');ok(e.k=='nofriend','a name that is an object is refused');
A.send({t:'dm_room_add',id:RID,name:'dan'});await A.wait('dm_list',2000,x=>rowOf(x,RID)&&rowOf(x,RID).members.length==4);
ev=await Dn.wait('dm_upd');ok(ev.ev=='invite'&&ev.by=='Aoi','the new member gets an invitation');
ev=await B.wait('dm_upd',2000,x=>x.ev=='add');ok(ev.name=='Dan'&&ev.by=='Aoi','the other members are told who joined');
await sleep(100);Dn.send({t:'dm_get',id:RID});ch=await Dn.wait('dm_chat');ok(ch.msgs.length==0&&ch.members.length==4,'a new member does not see what was said before he joined');
l=await lst(Dn);ok(rowOf(l,RID).unread===0&&rowOf(l,RID).last===null&&Dn.me.dm===0,'...and has no unread from before he joined');
await say(A,RID,'after Dan');Dn.clear();Dn.send({t:'dm_get',id:RID});ch=await Dn.wait('dm_chat');ok(ch.msgs.length==1&&ch.msgs[0].m=='after Dan','...but sees everything written afterwards');
// kick
A.clear();B.clear();C.clear();Dn.clear();
for(const [m,n] of [[{t:'dm_room_kick',id:RID,name:'Aoi'},'the owner himself'],[{t:'dm_room_kick',id:RID,name:'Eve'},'a non-member'],[{t:'dm_room_kick',id:RID,name:{x:1}},'an object'],[{t:'dm_room_kick',id:DMID,name:'Bob'},'someone in a DM']]){A.send(m);e=await A.wait('dm_err');ok(e.k=='bad','cannot kick '+n)}
A.send({t:'dm_room_kick',id:RID,name:'cat'});
g=await C.wait('dm_gone');ok(g.id==RID,'kicked member gets dm_gone');ev=await C.wait('dm_upd');ok(ev.ev=='kicked'&&ev.by=='Aoi','...and a dm_upd {ev:kicked}');
un=await C.wait('dm_unread');ok(un.n===0,'...and his unread no longer counts that room');
ev=await B.wait('dm_upd',2000,x=>x.ev=='kick');ok(ev.name=='Cat','the others are told');
l=await B.wait('dm_list',2000,x=>rowOf(x,RID)&&rowOf(x,RID).members.length==3);ok(!rowOf(l,RID).members.some(m=>m.name=='Cat'),'...and the member list no longer has the kicked player');
C.clear();for(const t of ['dm_get','dm_read','dm_send']){C.send({t,id:RID,m:'still here?'});g=await C.wait('dm_gone');ok(g.id==RID,'a kicked member can no longer '+t)}
ok(await quiet(B,'dm_msg',x=>x.msg.m=='still here?')&&await quiet(A,'dm_msg',x=>x.msg.m=='still here?'),'...and what he tried to send was not delivered');
l=await lst(C);ok(!rowOf(l,RID),'...the room is gone from his list');
// rename
A.clear();B.clear();
A.send({t:'dm_room_rename',id:RID,title:''});e=await A.wait('dm_err');ok(e.k=='title','rename to nothing refused');
A.send({t:'dm_room_rename',id:RID,title:{a:1}});e=await A.wait('dm_err');ok(e.k=='title','rename to an object refused');
A.send({t:'dm_room_rename',id:RID,title:'Dog <i>Club</i> super long name here'});ev=await B.wait('dm_upd',2000,x=>x.ev=='rename');ok(ev.by=='Aoi'&&ev.title=='Dog iClub/i supe','rename: members told, title cleaned ('+ev.title+')');
l=await B.wait('dm_list',2000,x=>rowOf(x,RID)&&rowOf(x,RID).title==ev.title);ok(!!l,'...and the list carries the new title');
A.send({t:'dm_room_rename',id:DMID,title:'DM name'});e=await A.wait('dm_err');ok(e.k=='bad','a DM cannot be renamed');
for(const t of ['dm_room_leave','dm_room_del','dm_room_add','dm_room_kick']){A.send({t,id:DMID,name:'Bob'});e=await A.wait('dm_err');ok(e.k=='bad','a DM is not a room: '+t+' -> '+e.k)}
// leave + ownership transfer + last one out
A.clear();B.clear();Dn.clear();
B.send({t:'dm_room_leave',id:RID});g=await B.wait('dm_gone');ok(g.id==RID,'a member can leave (dm_gone for him)');
ev=await A.wait('dm_upd',2000,x=>x.ev=='leave');ok(ev.name=='Bob'&&ev.owner===null,'the others are told, owner unchanged');
l=await A.wait('dm_list',2000,x=>rowOf(x,RID)&&rowOf(x,RID).members.length==2);ok(rowOf(l,RID).owner=='Aoi','...members: Aoi + Dan');
B.send({t:'dm_get',id:RID});g=await B.wait('dm_gone');ok(!!g,'someone who left cannot read any more');
A.clear();Dn.clear();
A.send({t:'dm_room_leave',id:RID});ev=await Dn.wait('dm_upd',2000,x=>x.ev=='leave');ok(ev.name=='Aoi'&&ev.owner=='Dan','the owner leaves: ownership passes to the next member ('+ev.owner+')');
l=await Dn.wait('dm_list',2000,x=>rowOf(x,RID));ok(rowOf(l,RID).owner=='Dan'&&rowOf(l,RID).members.length==1,'...and the list shows the new owner');
Dn.send({t:'dm_room_rename',id:RID,title:'Solo'});await sleep(150);l=await lst(Dn);ok(rowOf(l,RID).title=='Solo','the new owner can manage the room');
Dn.clear();Dn.send({t:'dm_room_leave',id:RID});await Dn.wait('dm_gone');
A.clear();A.send({t:'dm_get',id:RID});g=await A.wait('dm_gone');ok(!!g,'nobody left: the room is deleted');
// disband
A.clear();B.clear();C.clear();
ch=await room(A,'Disband me',['bob','cat']);const R2=ch.id;await B.wait('dm_list',2000,x=>rowOf(x,R2));await C.wait('dm_list',2000,x=>rowOf(x,R2));
await say(A,R2,'bye soon');B.clear();C.clear();A.clear();
B.send({t:'dm_room_del',id:R2});e=await B.wait('dm_err');ok(e.k=='notowner','a member cannot disband the room');
A.send({t:'dm_room_del',id:R2});
ev=await B.wait('dm_upd',2000,x=>x.ev=='del');ok(ev.by=='Aoi','disband: members are told');g=await B.wait('dm_gone');ok(g.id==R2,'...and get dm_gone');await C.wait('dm_gone');g=await A.wait('dm_gone');ok(g.id==R2,'the owner too');
B.send({t:'dm_get',id:R2});g=await B.wait('dm_gone');ok(!!g,'a disbanded room can not be read');

// =============================================================== 10. concurrent kick + send
A.clear();B.clear();C.clear();
ch=await room(A,'Race',['bob','cat']);const R3=ch.id;await C.wait('dm_list',2000,x=>rowOf(x,R3));await B.wait('dm_list',2000,x=>rowOf(x,R3));B.clear();C.clear();
A.send({t:'dm_room_kick',id:R3,name:'Cat'});C.send({t:'dm_send',id:R3,m:'racing'});await sleep(400);
const got=B.all('dm_msg',x=>x.msg.m=='racing').length;
C.clear();C.send({t:'dm_get',id:R3});g=await C.wait('dm_gone');ok(!!g,'kick + send at the same moment: the kicked player can not read afterwards (his message was '+(got?'delivered just before the kick':'refused')+')');
B.clear();B.send({t:'dm_get',id:R3});ch=await B.wait('dm_chat');ok(ch.members.length==2&&ch.msgs.length==got,'...and the room is consistent');
A.send({t:'dm_room_del',id:R3});await sleep(100);

// =============================================================== 11. DM becomes read-only when the friendship ends (and comes back with the history)
A.clear();B.clear();
await unfriend(A,B);
l=await lst(A);ok(!rowOf(l,DMID),'ex-friend: the DM is hidden from the list');
A.clear();A.send({t:'dm_send',id:DMID,m:'still there?'});e=await A.wait('dm_err');ch=await A.wait('dm_chat');ok(e.k=='ro'&&ch.ro===true&&ch.msgs.length==100,'...writing is refused (dm_err ro) and the page gets the chat as read-only with its history');
B.clear();B.send({t:'dm_send',id:DMID,m:'hello?'});e=await B.wait('dm_err');ok(e.k=='ro','...from the other side as well');
ok(await quiet(A,'dm_msg')&&await quiet(B,'dm_msg'),'...nothing was delivered');
B.clear();B.send({t:'dm_get',id:DMID});ch=await B.wait('dm_chat');ok(ch.ro===true&&ch.msgs.length==100,'history is kept and can still be read');
A.clear();A.send({t:'dm_open',with:'Bob'});e=await A.wait('dm_err');ok(e.k=='nofriend','dm_open with an ex-friend is refused');
// room with an ex-friend: stays, but only the owner can invite
A.clear();B.clear();C.clear();
ch=await room(A,'Mixed',['cat']);const R4=ch.id;
A.send({t:'dm_room_add',id:R4,name:'Bob'});e=await A.wait('dm_err');ok(e.k=='nofriend','an ex-friend cannot be (re)invited');
await befriend(A,B);B.clear();A.clear();
l=await lst(A);ok(!!rowOf(l,DMID)&&rowOf(l,DMID).ro===false,'friends again: the DM is back with its history');
A.send({t:'dm_room_add',id:R4,name:'Bob'});await A.wait('dm_list',2000,x=>rowOf(x,R4)&&rowOf(x,R4).members.length==3);
await unfriend(B,A);
B.clear();B.send({t:'dm_get',id:R4});ch=await B.wait('dm_chat');ok(ch.kind=='room'&&ch.ro===false&&ch.members.length==3,'in a room an ex-friend of the owner is NOT removed');
B.send({t:'dm_send',id:R4,m:'still in the room'});mm=await A.wait('dm_msg',2000,x=>x.msg.m=='still in the room');ok(!!mm,'...and can still write');
B.clear();B.send({t:'dm_room_add',id:R4,name:'Dan'});e=await B.wait('dm_err');ok(e.k=='notowner','...but cannot invite (only the owner)');
await befriend(A,B);A.send({t:'dm_room_del',id:R4});await sleep(100);

// =============================================================== 12. limits: 5 owned, 12 in, 8 members
const O1=await mk('OwnerOne'),O2=await mk('OwnerTwo'),O3=await mk('OwnerThree'),O4=await mk('OwnerFour'),P=await mk('Pip');
await befriend(O1,P);await befriend(O2,P);await befriend(O3,P);await befriend(O4,P);
const ids1=[];for(let i=0;i<5;i++){ch=await room(O1,'R'+i,['Pip']);ids1.push(ch.id)}
O1.clear();O1.send({t:'dm_room_new',title:'R6',members:['Pip']});e=await O1.wait('dm_err');ok(e.k=='own5','a player may OWN at most 5 rooms');
O1.send({t:'dm_room_del',id:ids1[4]});await sleep(100);ch=await room(O1,'R6',['Pip']);ok(!!ch.id,'...disbanding one frees a slot');ids1[4]=ch.id;      // O1 owns 5, Pip is in 5
const ids2=[];for(let i=0;i<5;i++){ch=await room(O2,'S'+i,['Pip']);ids2.push(ch.id)}      // Pip in 10
const ids3=[];for(let i=0;i<2;i++){ch=await room(O3,'T'+i,['Pip']);ids3.push(ch.id)}      // Pip in 12
O3.clear();O3.send({t:'dm_room_new',title:'T3',members:['Pip']});e=await O3.wait('dm_err');ok(e.k=='in12'&&e.x=='Pip','a player may be IN at most 12 rooms: inviting him to a 13th is refused (names Pip)');
O4.clear();O4.send({t:'dm_room_new',title:'U0',members:['Pip']});e=await O4.wait('dm_err');ok(e.k=='in12','...whoever invites him');
O3.send({t:'dm_room_add',id:ids3[0],name:'pip'});e=await O3.wait('dm_err');ok(e.k=='already','(adding someone who is inside already)');
P.clear();P.send({t:'dm_room_new',title:'Mine',members:['OwnerFour']});e=await P.wait('dm_err');ok(e.k=='in12'&&e.x=='Pip','Pip himself cannot create a room either while he is in 12');
P.send({t:'dm_room_leave',id:ids3[1]});await sleep(150);
ch=await room(O4,'U0',['Pip']);ok(!!ch.id&&ch.members.length==2,'after he leaves one room he can be invited again');const idU=ch.id;
for(const x of ids1)O1.send({t:'dm_room_del',id:x});for(const x of ids2)O2.send({t:'dm_room_del',id:x});O3.send({t:'dm_room_del',id:ids3[0]});O3.send({t:'dm_room_del',id:ids3[1]});O4.send({t:'dm_room_del',id:idU});await sleep(400);
// 8 members
const Z=[];for(let i=1;i<=7;i++){const z=await mk('Zed'+i);Z.push(z);await befriend(A,z)}
A.clear();A.send({t:'dm_room_new',title:'Eight',members:Z.map(z=>z.name).concat(['Bob'])});e=await A.wait('dm_err');ok(e.k=='members','a room holds 8 players: inviting 8 others is refused');
ch=await room(A,'Eight',Z.map(z=>z.name));const R8=ch.id;ok(ch.members.length==8,'8 members (owner + 7) is fine');
A.send({t:'dm_room_add',id:R8,name:'Bob'});e=await A.wait('dm_err');ok(e.k=='full','the 9th member is refused (room full)');
A.send({t:'dm_room_kick',id:R8,name:'Zed7'});await sleep(100);A.clear();A.send({t:'dm_room_add',id:R8,name:'Bob'});l=await A.wait('dm_list',2000,x=>rowOf(x,R8)&&rowOf(x,R8).members.length==8);ok(!!l,'...a slot frees up after a kick');
A.send({t:'dm_room_del',id:R8});await sleep(100);

// =============================================================== 13. list order, shape, me.dm
A.clear();
ch=await room(A,'Order',['bob']);const RO=ch.id;await sleep(50);
await say(A,RO,'room msg');l=await lst(A);ok(l.chats[0].id==RO,'dm_list is sorted by last activity (room first)');
await say(A,DMID,'dm msg newer');l=await lst(A);ok(l.chats[0].id==DMID&&l.chats[1].id==RO,'...and re-sorted after a newer message in the DM');
ok(l.chats.every(r=>['id','kind','title','members','last','unread','owner','muted','ro'].every(k=>k in r)),'every list row has id, kind, title, members, last, unread, owner, muted, ro');
B.clear();B.send({t:'dm_get',id:DMID});await B.wait('dm_chat');B.send({t:'dm_get',id:RO});await B.wait('dm_chat');
await say(A,DMID,'x1');await say(A,DMID,'x2');await say(A,RO,'y1');await sleep(100);un=B.last('dm_unread');ok(un&&un.n===3,'dm_unread is the TOTAL over DMs and rooms ('+(un&&un.n)+')');
B=await relog(B,'Bob');ok(B.me.dm===3,'me.dm after a fresh login = total unread (3)');

// =============================================================== 14. persistence + stored shape + clean-up
await sleep(300);for(const c of [A,B,C,Dn])c.ws.close();await sleep(200);
await stop(srv);
let saved=JSON.parse(fs.readFileSync(D1,'utf8'));const sc=saved.chats&&saved.chats[DMID];
ok(sc&&sc.kind=='dm'&&sc.members.join()==['Aoi','Bob'].join()&&sc.msgs.length==100&&sc.msgs.every(x=>typeof x.n=='string'&&typeof x.m=='string'&&typeof x.t=='number')&&sc.rd&&typeof sc.rd.Aoi=='number'&&typeof sc.created=='number'&&typeof sc.last=='number'&&sc.mute&&typeof sc.mute=='object','saved shape: {id,kind,members,msgs[{n,m,t}],rd,created,last,mute} (db.chats['+DMID+'])');
ok(saved.chats[RO]&&saved.chats[RO].kind=='room'&&saved.chats[RO].owner=='Aoi'&&saved.chats[RO].title=='Order','room saved with title and owner');
// edit the file while the server is down: an old chat, a chat with a purged member, corrupt chats
const old=JSON.parse(JSON.stringify(saved.chats[RO]));old.id='oldoldold1';old.title='Old';old.members=['Aoi','Cat'];old.rd={};old.j={};old.last=Date.now()-61*864e5;saved.chats.oldoldold1=old;
saved.chats.ghostroom1={id:'ghostroom1',kind:'room',title:'Ghosts',owner:'Ghost1234',members:['Ghost1234','Aoi'],msgs:[{n:'Ghost1234',m:'boo',t:Date.now()}],n:1,rd:{},j:{},created:Date.now(),last:Date.now(),mute:{}};
saved.chats['dm:aoi|ghost1234']={id:'dm:aoi|ghost1234',kind:'dm',title:'',members:['Aoi','Ghost1234'],msgs:[{n:'Ghost1234',m:'boo',t:Date.now()}],n:1,rd:{},j:{},created:Date.now(),last:Date.now(),mute:{}};
saved.chats.broken1={id:'broken1',kind:'room',members:'nope',msgs:5};saved.chats.broken2=5;saved.chats.broken3={id:'other',kind:'dm',members:[],msgs:[]};
fs.writeFileSync(D1,JSON.stringify(saved));
srv=boot(P1,D1,{CD_DMGAP:'15',CD_RATE:'2000',CD_DMSWEEP:'400'});await up(P1);
const A3=await relog({ws:{close(){}}},'Aoi'),B3=await relog({ws:{close(){}}},'Bob');
ok(B3.me.dm===3,'restart: unread survives (B has 3) - me.dm='+B3.me.dm);
B3.send({t:'dm_get',id:DMID});ch=await B3.wait('dm_chat');ok(ch.msgs.length==100&&ch.msgs[99].m=='x2','restart: the history survives (100 messages, newest last)');
l=await lst(A3);ok(rowOf(l,RO)&&rowOf(l,RO).members.length==2&&rowOf(l,RO).owner=='Aoi','restart: rooms and members survive');
await sleep(1200);      // the clean-up (every 400 ms here) has run
A3.send({t:'dm_get',id:'oldoldold1'});g=await A3.wait('dm_gone');ok(g.id=='oldoldold1','a chat nobody wrote in for 61 days is swept away');
l=await lst(A3);ok(!rowOf(l,'ghostroom1')||!rowOf(l,'ghostroom1').members.some(m=>m.name=='Ghost1234'),'members that no longer exist (purged guests) are ignored / removed');
await stop(srv);saved=JSON.parse(fs.readFileSync(D1,'utf8'));
ok(!saved.chats.oldoldold1&&!saved.chats['dm:aoi|ghost1234']&&!saved.chats.broken1&&!saved.chats.broken2&&!saved.chats.broken3,'old, orphaned and corrupt chats are gone from the saved file');
ok(saved.chats.ghostroom1&&saved.chats.ghostroom1.members.join()=='Aoi'&&saved.chats.ghostroom1.owner=='Aoi','a room that lost a (purged) member keeps going with a valid owner');
ok(!!saved.chats[DMID]&&!!saved.chats[RO],'real chats are untouched');
A3.ws.close();B3.ws.close();

// =============================================================== 15. the real defaults on server 2: 700 ms between messages, identical text within 8 s
{const a=await mk('Slowa',P2),b=await mk('Slowb',P2);await befriend(a,b);const c=await a.rq({t:'dm_open',with:'Slowb'},'dm_chat');const id=c.id;
 const t0=Date.now(),at=ms=>sleep(Math.max(0,t0+ms-Date.now()));
 a.clear();b.clear();a.send({t:'dm_send',id,m:'first'});
 await at(100);a.send({t:'dm_send',id,m:'second'});await at(250);
 e=a.last('dm_err');ok(e&&e.k=='slow'&&b.all('dm_msg').length==1,'defaults: a second message after 100 ms is refused (dm_err slow)');
 await at(500);a.send({t:'dm_send',id,m:'third'});await at(650);ok(b.all('dm_msg').length==1,'defaults: still refused 500 ms after the first one');
 await at(1000);a.send({t:'dm_send',id,m:'third'});await at(1150);ok(b.all('dm_msg').length==2&&b.last('dm_msg').msg.m=='third','defaults: accepted after 700 ms');
 await at(1800);a.send({t:'dm_send',id,m:'third'});await at(1950);ok(b.all('dm_msg').length==2,'defaults: the same text again within 8 s is ignored even after the gap');
 b.send({t:'dm_send',id,m:'third'});await at(2100);ok(b.all('dm_msg').length==3,'...but only for the sender: the other player can say the same words');
 const c2=await mk('Slowc',P2);await befriend(a,c2);await sleep(700);ch=await room(a,'Both',['Slowb']);a.clear();await sleep(750);a.send({t:'dm_send',id:ch.id,m:'third'});await sleep(250);ok(a.all('dm_msg').length==1,'identical text in ANOTHER chat is not a duplicate');
 await sleep(750);a.send({t:'dm_send',id,m:'plain'});await sleep(100);b.send({t:'dm_send',id,m:'other side'});await sleep(250);ok(b.all('dm_msg').some(x=>x.msg.m=='other side'),'the limit is per connection: the other player is not slowed down');
 a.ws.close();b.ws.close();c2.ws.close()}
}catch(e){console.log('FAIL exception:',e&&e.stack||e);fail++}
await done()})();
