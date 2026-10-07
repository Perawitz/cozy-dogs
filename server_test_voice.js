// v7 tests: park voice chat SIGNALLING (voice.js). Self-contained: starts its OWN servers (temp data files, ports 3160-3164, override with VPORT), real WebSocket clients.
//   node server_test_voice.js
// Covers: join/leave rules, peers list, relay only between voice peers, payload validation, rate limit, cap of 8, cleanup (park leave / visit / disconnect / replaced login),
// mute broadcast, and the ICE list in /config.json + voice_state (default STUN, CD_ICE, TURN_URL/USER/PASS, TURN_SECRET).
'use strict';
const {spawn}=require('child_process'),crypto=require('crypto'),http=require('http'),os=require('os'),path=require('path'),fs=require('fs');
const BASE=+(process.env.VPORT||3160);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let pass=0,fail=0;const ok=(c,n)=>{c?pass++:fail++;console.log(c?'PASS':'FAIL',n)};
const get=(port,p)=>new Promise((res,rej)=>http.get({port,path:p,host:'127.0.0.1'},r=>{let b='';r.on('data',d=>b+=d);r.on('end',()=>res({status:r.statusCode,body:b}))}).on('error',rej));
const files=[],procs=[];
function start(port,env){const data=path.join(os.tmpdir(),'cozydogs_vt_'+process.pid+'_'+port+'.json');files.push(data,data+'.bak');
  const p=spawn(process.execPath,[path.join(__dirname,'server.js')],{env:{...process.env,PORT:String(port),DATA:data,CD_TEST:'1',CD_GOAL:'pet',TRUST_PROXY_HOPS:'0',...env},stdio:['ignore','pipe','inherit']});procs.push(p);return p}
let PORT=BASE;
function cli(port){return new Promise((res,rej)=>{const ws=new WebSocket('ws://127.0.0.1:'+(port||PORT)),log=[];
  const o={ws,log,send:m=>ws.send(typeof m=='string'?m:JSON.stringify(m)),
   wait:(t,ms=3000,f=null)=>new Promise((ok,no)=>{const g=()=>{const i=log.findIndex(x=>x.t==t&&(!f||f(x)));if(i>=0)return ok(log.splice(i,1)[0]);if((ms-=20)<=0)return no(new Error('timeout '+t));setTimeout(g,20)};g()}),
   count:(t,f)=>log.filter(x=>x.t==t&&(!f||f(x))).length,all:(t,f)=>log.filter(x=>x.t==t&&(!f||f(x))),clear:t=>{for(let i=log.length-1;i>=0;i--)if(!t||log[i].t==t)log.splice(i,1)},
   closed:false};
  ws.onmessage=e=>{log.push(JSON.parse(e.data))};ws.onclose=()=>{o.closed=true};ws.onopen=()=>res(o);ws.onerror=()=>rej(new Error('connect'))})}
const tryWait=async(c,t,ms,f)=>{try{return await c.wait(t,ms,f)}catch{return null}};
let uid=0;
async function player(name,port){const o=await cli(port);o.name=name;o.send({t:'register',user:name,email:'v@t.co',pass:'secret1'});const a=await o.wait('auth',4000);if(!a.ok)throw new Error('register '+name+': '+a.err);await o.wait('me',3000);return o}
const guest=async port=>{const o=await cli(port);o.send({t:'guest'});const a=await o.wait('auth',4000);o.name=a.name;await o.wait('me',3000);return o};
async function park(o){o.send({t:'park_join'});await o.wait('park_init',4000);o.clear('park_s')}
async function join(o){o.send({t:'voice_join'});return o.wait('voice_state',3000,x=>x.on)}
const quiet=async(c,t,ms,f)=>{await sleep(ms||250);return c.count(t,f)==0};
const SDP='v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=rtpmap:111 opus/48000/2\r\n';
const CAND={candidate:'candidate:1 1 udp 2113937151 192.168.1.2 54321 typ host generation 0',sdpMid:'0',sdpMLineIndex:0,usernameFragment:'abcd'};

(async()=>{
const main=start(PORT,{CD_RATE:'2000'});await sleep(1500);
const done=async()=>{for(const p of procs)p.kill();for(const f of files)try{fs.unlinkSync(f)}catch{}console.log('\nPASS',pass,'FAIL',fail);process.exit(fail?1:0)};
try{
// ======================= 1. joining
const A=await player('VoiceA'),B=await player('VoiceB'),C=await player('VoiceC'),D=await player('VoiceD');
A.send({t:'voice_join'});let r=await A.wait('voice_state');ok(r.on===false&&r.why=='park','join while NOT in the park is refused (voice_state on:false why:park)');
ok(await quiet(B,'voice_peer',200),'...and nobody is told about it');
for(const o of [A,B,C,D])await park(o);
r=await join(A);ok(r.on===true&&Array.isArray(r.peers)&&r.peers.length==0&&r.max==8,'first join: voice_state on:true, no peers yet, max 8 '+JSON.stringify({peers:r.peers,max:r.max}));
ok(Array.isArray(r.ice)&&r.ice.length==2&&r.ice.every(s=>/^stun:/.test(s.urls)),'voice_state carries the default ICE list (2 STUN servers)');
ok(Array.isArray(r.muted)&&r.muted.length==0,'voice_state.muted is an (empty) list');
r=await join(B);ok(JSON.stringify(r.peers)=='["VoiceA"]','second join: peers = [VoiceA]');
let pj=await A.wait('voice_peer',2000);ok(pj.n=='VoiceB'&&pj.joined===true,'VoiceA is told: VoiceB joined');
ok(await quiet(B,'voice_peer',150),'the newcomer gets no voice_peer about himself');
r=await join(C);ok(JSON.stringify(r.peers)=='["VoiceA","VoiceB"]','third join: peers in join order');
ok((await A.wait('voice_peer')).n=='VoiceC'&&(await B.wait('voice_peer')).n=='VoiceC','both existing members are told about VoiceC');
// idempotent
A.clear();B.clear();C.clear();A.send({t:'voice_join'});r=await A.wait('voice_state');
ok(r.on===true&&JSON.stringify(r.peers)=='["VoiceB","VoiceC"]','a second voice_join is idempotent: same state again, peers = the others');
ok(await quiet(B,'voice_peer',250)&&await quiet(C,'voice_peer',0),'...and nobody else hears anything about it');
// guests may join
const G=await guest();await park(G);r=await join(G);ok(r.on===true&&r.peers.length==3,'a guest may join voice (peers: 3) '+G.name);
ok((await A.wait('voice_peer')).n==G.name,'...and the others see him');
G.send({t:'voice_leave'});await G.wait('voice_state',2000,x=>x.on===false);await A.wait('voice_peer',2000,x=>x.joined===false);

// ======================= 2. relay only between voice peers
for(const o of [A,B,C,D])o.clear();
A.send({t:'voice_sig',to:'VoiceB',d:{k:'offer',s:SDP,g:3}});
let m=await B.wait('voice_sig');ok(m.from=='VoiceA'&&m.d.k=='offer'&&m.d.s===SDP&&m.d.g===3&&Object.keys(m.d).sort().join()=='g,k,s','offer relayed A->B with sender name, generation and nothing else');
ok(await quiet(C,'voice_sig',250),'...and C (also in voice) does not receive it');
B.send({t:'voice_sig',to:'VoiceA',d:{k:'answer',s:SDP,g:3}});m=await A.wait('voice_sig');ok(m.from=='VoiceB'&&m.d.k=='answer'&&m.d.g===3,'answer relayed B->A');
A.send({t:'voice_sig',to:'VoiceB',d:{k:'ice',c:CAND,g:3,junk:{a:1}}});m=await B.wait('voice_sig');ok(m.d.k=='ice'&&m.d.c.candidate==CAND.candidate&&m.d.c.sdpMid=='0'&&m.d.c.sdpMLineIndex===0&&!('junk' in m.d),'ice candidate relayed (whitelisted fields only)');
A.send({t:'voice_sig',to:'VoiceB',d:{k:'ice',c:{...CAND,evil:'x'}}});m=await B.wait('voice_sig');ok(!('evil' in m.d.c)&&m.d.c.candidate==CAND.candidate,'unknown candidate fields are stripped');
A.send({t:'voice_sig',to:'VoiceB',d:{k:'ice',s:CAND}});m=await tryWait(B,'voice_sig',800);ok(m&&m.d.c&&m.d.c.candidate==CAND.candidate,'an ice candidate sent in d.s is accepted too (re-emitted as d.c)');
// not allowed
for(const o of [A,B,C,D])o.clear();
A.send({t:'voice_sig',to:'VoiceA',d:{k:'offer',s:SDP}});ok(await quiet(A,'voice_sig',250),'a signal to yourself is ignored');
A.send({t:'voice_sig',to:'Nobody',d:{k:'offer',s:SDP}});A.send({t:'voice_sig',to:'__proto__',d:{k:'offer',s:SDP}});A.send({t:'voice_sig',to:'constructor',d:{k:'offer',s:SDP}});
A.send({t:'voice_sig',to:'VoiceD',d:{k:'offer',s:SDP}});                                  // D is in the park but not in voice
ok(await quiet(D,'voice_sig',300)&&await quiet(B,'voice_sig',0)&&await quiet(C,'voice_sig',0),'unknown names, __proto__/constructor and a non-voice target are ignored silently');
D.send({t:'voice_sig',to:'VoiceA',d:{k:'offer',s:SDP}});ok(await quiet(A,'voice_sig',300),'a sender who is not in voice cannot signal');
ok(!A.count('toast')&&!A.count('voice_state'),'...and nothing is answered to the bad senders (silent)');

// ======================= 3. payload validation
const bad=async(label,d,extra)=>{B.clear('voice_sig');A.send(Object.assign({t:'voice_sig',to:'VoiceB',d},extra||{}));const got=await tryWait(B,'voice_sig',350);ok(!got,'rejected: '+label)};
const good=async(label,d)=>{B.clear('voice_sig');A.send({t:'voice_sig',to:'VoiceB',d});const got=await tryWait(B,'voice_sig',1000);ok(!!got,'accepted: '+label);return got};
await bad('oversized SDP (6501 chars)',{k:'offer',s:'a'.repeat(6501)});
const edge=await good('SDP of exactly 6500 chars',{k:'offer',s:'a'.repeat(6500)});ok(edge&&edge.d.s.length==6500,'...relayed in full');
await bad('empty SDP',{k:'offer',s:''});
await bad('SDP that is not a string (number)',{k:'offer',s:123});
await bad('SDP that is an object',{k:'answer',s:{x:1}});
await bad('unknown kind "close"',{k:'close',s:SDP});
await bad('kind missing',{s:SDP});
await bad('kind as an array ["offer"]',{k:['offer'],s:SDP});
await bad('kind with different case "Offer"',{k:'Offer',s:SDP});
await bad('d is an array',[{k:'offer',s:SDP}]);
await bad('d is a string','offer');
await bad('d is null',null);
await bad('d is a number',5);
await bad('ice without a candidate',{k:'ice'});
await bad('ice candidate that is a string',{k:'ice',c:'candidate:1'});
await bad('ice candidate whose "candidate" is not a string',{k:'ice',c:{candidate:5}});
await bad('ice candidate array',{k:'ice',c:[CAND]});
await bad('ice candidate longer than the 600 byte limit',{k:'ice',c:{candidate:'x'.repeat(401)}});
await bad('ice candidate with huge sdpMid',{k:'ice',c:{candidate:'a',sdpMid:'m'.repeat(400)}});
await bad('ice candidate with sdpMLineIndex 99',{k:'ice',c:{candidate:'a',sdpMLineIndex:99}});
await bad('ice candidate with sdpMid that is an object',{k:'ice',c:{candidate:'a',sdpMid:{}}});
await bad('generation that is a float',{k:'offer',s:SDP,g:1.5});
await bad('generation that is negative',{k:'offer',s:SDP,g:-1});
await bad('generation that is a string',{k:'offer',s:SDP,g:'3'});
await bad('"to" as an array',{k:'offer',s:SDP},{to:['VoiceB']});
await bad('"to" as an object',{k:'offer',s:SDP},{to:{toString:'x'}});
await bad('"to" missing',{k:'offer',s:SDP},{to:undefined});
// hostile raw JSON (the server's scrub() removes __proto__/constructor/toString keys before anything sees them)
B.clear('voice_sig');A.send('{"t":"voice_sig","to":"VoiceB","d":{"__proto__":{"k":"offer","s":"v=0"}}}');ok(!await tryWait(B,'voice_sig',350),'rejected: d = {"__proto__":{...}} (payload hidden behind __proto__)');
B.clear('voice_sig');A.send('{"t":"voice_sig","to":"VoiceB","d":{"k":"offer","s":"v=0 ok","__proto__":{"polluted":1},"constructor":{"x":1}}}');m=await tryWait(B,'voice_sig',1000);
ok(m&&m.d.s=='v=0 ok'&&Object.keys(m.d).sort().join()=='k,s'&&({}).polluted===undefined,'a valid offer with __proto__/constructor extras is relayed WITHOUT them; Object.prototype untouched');
B.clear('voice_sig');A.send('{"t":"voice_sig","to":"VoiceB","__proto__":{"to":"VoiceB"},"d":{"k":"offer","s":"x"}}');m=await tryWait(B,'voice_sig',800);ok(m&&m.from=='VoiceA','a __proto__ key next to valid fields does not break the relay');
B.clear('voice_sig');A.send('{"t":"voice_sig","to":"VoiceB","d":{"k":"ice","c":{"candidate":"candidate:1","__proto__":{"a":1},"sdpMid":"0"}}}');m=await tryWait(B,'voice_sig',800);ok(m&&m.d.c.candidate=='candidate:1'&&m.d.c.sdpMid=='0'&&!Object.prototype.hasOwnProperty.call(m.d.c,'__proto__')&&Object.keys(m.d.c).sort().join()=='candidate,sdpMid','candidate with a __proto__ key: relayed clean');
// still healthy after the garbage
await good('a normal offer after all that garbage',{k:'offer',s:SDP,g:0});
A.send({t:'voice_foo'});A.send({t:'voice_'});A.send({t:'voice_sig'});A.send({t:'voice_mute'});await sleep(200);ok(!A.closed&&await quiet(A,'toast',0),'unknown / empty voice_* messages are swallowed without error');
ok(A.ws.readyState==1,'(connection still open)');

// ======================= 4. mute broadcast
for(const o of [A,B,C,D])o.clear();
B.send({t:'voice_mute',on:true});
pj=await A.wait('voice_peer');ok(pj.n=='VoiceB'&&pj.muted===true&&!('joined' in pj),'mute is broadcast to the others: voice_peer {n,muted:true}');
await C.wait('voice_peer');ok(await quiet(B,'voice_peer',150),'...to everybody except the muter');
B.send({t:'voice_mute',on:true});ok(await quiet(A,'voice_peer',250),'muting twice does not broadcast twice');
const E=await player('VoiceE');await park(E);r=await join(E);ok(JSON.stringify(r.muted)=='["VoiceB"]','a newcomer is told who is muted (voice_state.muted)');
E.send({t:'voice_leave'});await E.wait('voice_state',2000,x=>x.on===false);
B.send({t:'voice_mute',on:false});pj=await A.wait('voice_peer',2000,x=>x.muted===false);ok(pj.n=='VoiceB','unmute is broadcast (muted:false)');
B.send({t:'voice_mute',on:'true'});ok(await quiet(A,'voice_peer',250,x=>x.muted===true),'on:"true" (a string) does not count as muted');
D.send({t:'voice_mute',on:true});ok(await quiet(A,'voice_peer',250,x=>x.n=='VoiceD'),'a player who is not in voice cannot mute');

// ======================= 5. leaving
for(const o of [A,B,C,D,E])o.clear();
C.send({t:'voice_leave'});r=await C.wait('voice_state');ok(r.on===false,'voice_leave: the leaver gets voice_state on:false');
pj=await A.wait('voice_peer');ok(pj.n=='VoiceC'&&pj.joined===false,'...the others get voice_peer joined:false');await B.wait('voice_peer');
C.clear();C.send({t:'voice_leave'});r=await C.wait('voice_state');ok(r.on===false&&await quiet(A,'voice_peer',250),'leaving twice: answered, but nobody is told again');
B.clear();A.send({t:'voice_sig',to:'VoiceC',d:{k:'offer',s:SDP}});ok(await quiet(C,'voice_sig',300),'nothing is relayed to somebody who left');
C.send({t:'voice_sig',to:'VoiceA',d:{k:'offer',s:SDP}});ok(await quiet(A,'voice_sig',300),'...and he cannot send either');
r=await join(C);ok(r.on===true&&r.peers.length==2,'he can come back');
for(const o of [A,B,C,D,E])o.clear();

// ======================= 6. cleanup: park_leave, visiting a house, disconnect, replaced by another login
C.send({t:'park_leave'});
r=await C.wait('voice_state',2000);ok(r.on===false&&r.why=='park','park_leave: the player is taken out of voice (why:park)');
pj=await A.wait('voice_peer',2000);ok(pj.n=='VoiceC'&&pj.joined===false,'...and the others are told');
C.send({t:'voice_join'});r=await C.wait('voice_state');ok(r.on===false&&r.why=='park','after leaving the park, voice_join is refused again');
await park(C);r=await join(C);ok(r.on===true,'back in the park: can join again');
for(const o of [A,B,C,D,E])o.clear();
C.send({t:'visit',id:'VoiceC'});
r=await C.wait('voice_state',2000);ok(r.on===false&&r.why=='park','visiting a house leaves voice (via the park-leave hook)');
ok((await A.wait('voice_peer',2000)).joined===false,'...others are told');
await park(C);await join(C);for(const o of [A,B,C,D,E])o.clear();
// joining an online game (arcade.js calls S.leavePark)
C.send({t:'mp_find',g:'race'});
r=await C.wait('voice_state',2000);ok(r.on===false&&r.why=='park','joining an online game leaves the park and therefore voice');
ok((await A.wait('voice_peer',2000)).joined===false,'...others are told');
C.send({t:'mp_cancel'});await sleep(150);
await park(C);r=await join(C);ok(r.on===true,'(back in the park and in voice)');for(const o of [A,B,C,D,E])o.clear();
// disconnect
C.ws.close();pj=await A.wait('voice_peer',2000);ok(pj.n=='VoiceC'&&pj.joined===false,'disconnect: the others are told VoiceC left');await B.wait('voice_peer');
// replaced by another login: same account on a second socket
const R1=await player('VoiceR');await park(R1);r=await join(R1);await A.wait('voice_peer');await B.wait('voice_peer');
for(const o of [A,B])o.clear();
const R2=await cli();R2.send({t:'login',user:'VoiceR',pass:'secret1'});const la=await R2.wait('auth',4000);
ok(la.ok,'(setup) second login with the same account works');
ok(!!await tryWait(R1,'kick',2000),'the first device is kicked');
pj=await A.wait('voice_peer',2000);ok(pj.n=='VoiceR'&&pj.joined===false,'being replaced by a login from another device removes the old session from voice');await B.wait('voice_peer');
await R2.wait('me');R2.send({t:'voice_join'});r=await R2.wait('voice_state');ok(r.on===false&&r.why=='park','the new session starts outside the park AND outside voice (nothing carried over)');
R2.ws.close();

// ======================= 7. cap of 8 (VOICE_MAX)
for(const o of [A,B,D])o.send({t:'voice_leave'});await sleep(300);
const T=[];for(let i=0;i<9;i++){const p=await guest();await park(p);T.push(p)}
for(let i=0;i<8;i++){r=await join(T[i]);if(r.peers.length!=i){ok(false,'cap setup: peers '+r.peers.length+' != '+i)}}
ok(true,'8 players joined (peers list grew 0..7)');
T[8].clear();T[8].send({t:'voice_join'});r=await T[8].wait('voice_full',2000);ok(r.max==8,'the 9th player gets voice_full {max:8}');
ok(await quiet(T[0],'voice_peer',300,x=>x.n==T[8].name),'...and nobody is told about him');
T[8].send({t:'voice_sig',to:T[0].name,d:{k:'offer',s:SDP}});ok(await quiet(T[0],'voice_sig',300),'the refused player is not in the channel (cannot signal)');
ok(!T[8].count('voice_state',x=>x.on===true),'(no voice_state on:true for him)');
T[7].send({t:'voice_leave'});await T[7].wait('voice_state',2000,x=>x.on===false);
r=await join(T[8]);ok(r.on===true&&r.peers.length==7,'when somebody leaves, the 9th can join (7 peers)');
for(const p of T)p.ws.close();

// ======================= 8. rate limit: 60 voice_sig / 10 s per connection
const P1=await player('VoiceP1'),P2=await player('VoiceP2');await park(P1);await park(P2);await join(P1);await join(P2);P2.clear();
for(let i=0;i<100;i++)P1.send({t:'voice_sig',to:'VoiceP2',d:{k:'offer',s:SDP,g:i}});
await sleep(900);let n=P2.count('voice_sig');ok(n==60,'100 signals in a burst: exactly 60 are relayed, the rest dropped ('+n+')');
ok(P2.all('voice_sig').every((x,i)=>x.d.g==i),'...the FIRST 60 (order kept)');
ok(P1.ws.readyState==1,'(the sender is not disconnected for it)');
P1.send({t:'voice_mute',on:true});ok(!!await tryWait(P2,'voice_peer',1500,x=>x.muted===true),'control messages have their own bucket: mute still works while signalling is throttled');
await sleep(10300);P2.clear();P1.send({t:'voice_sig',to:'VoiceP2',d:{k:'offer',s:SDP,g:999}});m=await tryWait(P2,'voice_sig',1500);ok(m&&m.d.g===999,'after the 10 s window the sender may signal again');
// control spam: 30 / 10 s
const Q1=await player('VoiceQ1'),Q2=await player('VoiceQ2');await park(Q1);await park(Q2);await join(Q2);Q2.clear();
for(let i=0;i<20;i++){Q1.send({t:'voice_join'});Q1.send({t:'voice_leave'})}
await sleep(900);ok(Q2.count('voice_peer')<=30&&Q2.count('voice_peer')>0,'join/leave spam is throttled to 30 control messages / 10 s (relayed events: '+Q2.count('voice_peer')+')');

// ======================= 9. ICE configuration
let cfg=JSON.parse((await get(PORT,'/config.json')).body);
ok(Array.isArray(cfg.ice)&&cfg.ice.length==2&&cfg.ice[0].urls=='stun:stun.l.google.com:19302'&&cfg.ice[1].urls=='stun:stun1.l.google.com:19302','/config.json: default ICE = the two Google STUN servers');
ok('google' in cfg,'(/config.json still has the google field)');
{const h=await get(PORT,'/config.json');ok(JSON.parse(h.body).ice.length==2,'(ice present on every request)')}
// server 2: CD_ICE replaces STUN, TURN_URL list + static credentials appended
PORT=BASE+1;const s2=start(PORT,{CD_RATE:'2000',CD_ICE:JSON.stringify([{urls:'stun:stun.example.org:3478'},{urls:['stun:a.example.org:1','turn:b.example.org:2'],username:'x',credential:'y'},{urls:'http://evil.example/'},{nothing:1}]),TURN_URL:'turn:turn.example.org:3478, turns:turn.example.org:5349 ,http://nope,',TURN_USER:'cozy',TURN_PASS:'s3cret'});await sleep(1500);
cfg=JSON.parse((await get(PORT,'/config.json')).body);
ok(cfg.ice.length==3&&cfg.ice[0].urls=='stun:stun.example.org:3478'&&cfg.ice[1].username=='x'&&cfg.ice[1].urls.length==2,'CD_ICE replaces the default list (invalid entries dropped): '+JSON.stringify(cfg.ice.map(s=>s.urls)));
const tu=cfg.ice[2];ok(Array.isArray(tu.urls)&&tu.urls.join()=='turn:turn.example.org:3478,turns:turn.example.org:5349'&&tu.username=='cozy'&&tu.credential=='s3cret','TURN_URL (comma separated, junk ignored) + TURN_USER/TURN_PASS are appended as ONE entry');
{const X1=await player('VoiceX1',PORT);await park(X1);const st=await join(X1);ok(JSON.stringify(st.ice)==JSON.stringify(cfg.ice),'voice_state.ice equals /config.json ice');X1.ws.close()}
// server 3: CD_ICE='[]' (host candidates only) + TURN_SECRET (ephemeral credentials)
PORT=BASE+2;const s3=start(PORT,{CD_RATE:'2000',CD_ICE:'[]',TURN_URL:'turn:t.example.org:3478',TURN_SECRET:'topsecret'});await sleep(1500);
cfg=JSON.parse((await get(PORT,'/config.json')).body);
ok(cfg.ice.length==1&&cfg.ice[0].urls=='turn:t.example.org:3478','CD_ICE=[] removes the STUN servers; only TURN is left');
{const t=cfg.ice[0],exp=+t.username.split(':')[0],want=crypto.createHmac('sha1','topsecret').update(t.username).digest('base64');
 ok(/^\d+:cozydogs$/.test(t.username)&&exp>Date.now()/1000+3600&&exp<=Date.now()/1000+6*3600+5&&t.credential===want,'TURN_SECRET: short-lived credentials "<expiry>:cozydogs" + base64(HMAC-SHA1) (the coturn REST scheme)')}
// server 4: broken CD_ICE falls back to the default
PORT=BASE+3;const s4=start(PORT,{CD_RATE:'2000',CD_ICE:'this is not json',TURN_URL:'ftp://x'});await sleep(1500);
cfg=JSON.parse((await get(PORT,'/config.json')).body);ok(cfg.ice.length==2&&cfg.ice[0].urls=='stun:stun.l.google.com:19302','invalid CD_ICE / TURN_URL are ignored (default STUN list stays; server still starts)');
}catch(e){ok(false,'test crashed: '+(e&&e.stack||e))}
await done()})();
