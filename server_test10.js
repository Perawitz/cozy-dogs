// v6.3 tests: sign in with Google, the achievement shown above the head, and the daily limit for petting.
// Self-contained (`npm test` runs it with the others): it starts its OWN server with GOOGLE_CLIENT_ID set and a tiny local "Google key server",
// then signs test tokens with its own RSA key. So the real token check (RS256 signature, issuer, audience, expiry, verified e-mail) runs for real.
'use strict';
const {spawn}=require('child_process'),crypto=require('crypto'),http=require('http'),os=require('os'),path=require('path'),fs=require('fs');
const BASE=+(process.env.PORT||3055),PORT=BASE+10,JPORT=BASE+11;
const CID='test-client-id.apps.googleusercontent.com';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let pass=0,fail=0;const ok=(c,n)=>{c?pass++:fail++;console.log(c?'PASS':'FAIL',n)};

// ---------- fake Google key server
const kp=crypto.generateKeyPairSync('rsa',{modulusLength:2048}),kp2=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
const jwk=Object.assign(kp.publicKey.export({format:'jwk'}),{kid:'k1',alg:'RS256',use:'sig'});
let jwksHits=0;
const jserver=http.createServer((q,r)=>{jwksHits++;r.writeHead(200,{'Content-Type':'application/json','Cache-Control':'public, max-age=3600'});r.end(JSON.stringify({keys:[jwk]}))});
const b64=o=>Buffer.from(typeof o=='string'?o:JSON.stringify(o)).toString('base64url');
function token(over,o){o=o||{};const now=Math.floor(Date.now()/1000);
  const pl=Object.assign({iss:'https://accounts.google.com',aud:CID,sub:'1000000001',email:'kid@example.com',email_verified:true,name:'Test Kid',iat:now-10,exp:now+3000},over||{});
  const head=o.head||{alg:'RS256',typ:'JWT',kid:o.kid||'k1'},data=b64(head)+'.'+b64(pl);
  const sig=o.alg=='none'?'':crypto.sign('RSA-SHA256',Buffer.from(data),(o.key||kp.privateKey)).toString('base64url');
  return data+'.'+sig}

// ---------- client
function cli(){return new Promise((res,rej)=>{const ws=new WebSocket('ws://localhost:'+PORT),log=[];
  const o={ws,log,send:m=>ws.send(JSON.stringify(m)),
   wait:(t,ms=3000,f=null)=>new Promise((ok,no)=>{const g=()=>{const i=log.findIndex(x=>x.t==t&&(!f||f(x)));if(i>=0)return ok(log.splice(i,1)[0]);if((ms-=25)<=0)return no(new Error('timeout '+t));setTimeout(g,25)};g()}),
   last:t=>[...log].reverse().find(x=>x.t==t),count:(t,f)=>log.filter(x=>x.t==t&&(!f||f(x))).length,clear:t=>{for(let i=log.length-1;i>=0;i--)if(!t||log[i].t==t)log.splice(i,1)},
   async auth(m){o.send(m);const a=await o.wait('auth',4000);if(a.ok)await o.wait('me',3000);return a}};
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.t=='me')o.me=m;log.push(m)};ws.onopen=()=>res(o);ws.onerror=()=>rej(new Error('connect'))})}
const tryWait=async(c,t,ms,f)=>{try{return await c.wait(t,ms,f)}catch{return null}};
const get=p=>new Promise((res,rej)=>http.get({port:PORT,path:p,host:'127.0.0.1'},r=>{let b='';r.on('data',d=>b+=d);r.on('end',()=>res({status:r.statusCode,body:b,type:r.headers['content-type']}))}).on('error',rej));

(async()=>{
await new Promise(r=>jserver.listen(JPORT,'127.0.0.1',r));
const data=path.join(os.tmpdir(),'cozydogs_t10_'+process.pid+'.json');
const srv=spawn(process.execPath,[path.join(__dirname,'server.js')],{env:{...process.env,PORT:String(PORT),DATA:data,GOOGLE_CLIENT_ID:CID,CD_GOOGLE_JWKS:'http://127.0.0.1:'+JPORT+'/certs',CD_PET_DAILY:'5',ADMIN_KEY:'testadminkey123',CD_GOAL:'pet',TRUST_PROXY_HOPS:'0'},stdio:['ignore','pipe','inherit']});
await sleep(1500);
const done=async()=>{srv.kill();jserver.close();for(const f of [data,data+'.bak'])try{fs.unlinkSync(f)}catch{}console.log('\nPASS',pass,'FAIL',fail);process.exit(fail?1:0)};
try{
// ======================= Google
const cfg=await get('/config.json');ok(cfg.status==200&&JSON.parse(cfg.body).google==CID&&/json/.test(cfg.type),'/config.json tells the page the Google client id');
// 1. a new Google user: token ok -> asked for a game name
let A=await cli();A.send({t:'google',credential:token({sub:'111',email:'newbie@example.com'})});
const gn=await tryWait(A,'google_new',4000);ok(gn&&gn.email=='newbie@example.com'&&/^[A-Za-z0-9_]{3,16}$/.test(gn.name||''),'new Google user: server asks for a game name and suggests one '+JSON.stringify(gn&&gn.name));
ok(!A.last('auth'),'...and nobody is logged in yet');
A.send({t:'google_name',user:'ab'});let r=await A.wait('auth');ok(!r.ok&&r.gname==1,'too short a game name is refused');
A.send({t:'google_name',user:'Guest1234'});r=await A.wait('auth');ok(!r.ok,'a name starting with Guest is refused');
A.send({t:'google_name',user:'toString'});r=await A.wait('auth');ok(!r.ok,'a reserved name is refused');
A.send({t:'google_name',user:'GoogleKid'});r=await A.wait('auth');ok(r.ok&&r.name=='GoogleKid'&&!r.guest&&r.token,'a good name creates the account and logs in (with a session token)');
await A.wait('me');ok(A.me.gl=='newbie@example.com'&&A.me.rec===null,'me: Google linked, no recovery code row for a password-less account');
ok(!A.last('rec'),'no recovery code is shown (Google is the way back in)');
A.ws.close();await sleep(200);
// 2. the same Google user comes back
let B=await cli();B.send({t:'google',credential:token({sub:'111'})});r=await B.wait('auth');ok(r.ok&&r.name=='GoogleKid','the same Google user signs straight in the next time');
await B.wait('me');
// 3. the name is taken
let C=await cli();C.send({t:'google',credential:token({sub:'222',email:'other@example.com'})});await C.wait('google_new');
C.send({t:'google_name',user:'googlekid'});r=await C.wait('auth');ok(!r.ok&&/ใช้แล้ว/.test(r.err),'a game name that is already used is refused (any capitals)');
C.send({t:'google_name',user:'GoogleKid2'});r=await C.wait('auth');ok(r.ok&&r.name=='GoogleKid2','...and another name works');await C.wait('me');
// 4. bad tokens
const bads={'wrong signing key':token({sub:'900'},{key:kp2.privateKey}),'wrong audience':token({sub:'901',aud:'someone-else'}),'expired':token({sub:'902',exp:Math.floor(Date.now()/1000)-3600,iat:Math.floor(Date.now()/1000)-7200}),
 'wrong issuer':token({sub:'903',iss:'https://evil.example.com'}),'e-mail not verified':token({sub:'904',email_verified:false}),'unknown key id':token({sub:'905'},{kid:'zzz'}),
 'alg none':token({sub:'906'},{alg:'none',head:{alg:'none',typ:'JWT',kid:'k1'}}),'HS256 with the public key':token({sub:'907'},{head:{alg:'HS256',typ:'JWT',kid:'k1'}}),
 'not a token':'hello','three empty parts':'..','too long':'a.'.repeat(1800)+'b','audience list without us':token({sub:'908',aud:['x','y']}),'issued in the future':token({sub:'909',iat:Math.floor(Date.now()/1000)+4000,exp:Math.floor(Date.now()/1000)+8000}),
 'sub that is not text':token({sub:12345}),'sub with bad characters':token({sub:'a b<script>'})};
for(const [k,v] of Object.entries(bads)){const X=await cli();X.send({t:'google',credential:v});const a=await tryWait(X,'auth',4000);const nw=X.last('google_new');ok(a&&!a.ok&&!nw,'refused: '+k);X.ws.close()}
{const X=await cli();X.send({t:'google'});const a=await tryWait(X,'auth',3000);ok(a&&!a.ok,'refused: no credential at all');X.ws.close()}
{const X=await cli();X.send({t:'google',credential:{a:1}});const a=await tryWait(X,'auth',3000);ok(a&&!a.ok,'refused: credential that is an object');X.ws.close()}
ok(jwksHits>=1&&jwksHits<=3,'Google keys are fetched once and cached (fetches: '+jwksHits+')');
// 5. google_name without a Google check first
{const X=await cli();X.send({t:'google_name',user:'Sneaky'});const a=await X.wait('auth');ok(!a.ok,'choosing a name without a verified Google login is refused');X.ws.close()}
// 6. a Google-only account has no password
{const X=await cli();X.send({t:'login',user:'GoogleKid',pass:'secret1'});const a=await X.wait('auth');ok(!a.ok,'password login on a Google-only account fails cleanly');
 X.send({t:'reset',user:'GoogleKid',code:'AAAA-BBBB-CCCC-DDDD',pass:'newpass1'});const b=await X.wait('auth');ok(!b.ok,'"forgot password" on a Google-only account fails cleanly');X.ws.close()}
B.send({t:'rec_new',pass:'secret1'});await sleep(300);ok(!B.last('rec')&&!B.last('rec_err'),'asking for a recovery code on a Google-only account does nothing (no crash, no code)');
// 7. link Google to a normal account
const P=await cli();r=await P.auth({t:'register',user:'PwUser',email:'pw@example.com',pass:'secret1'});ok(r.ok,'(setup) normal account created');ok(P.me.gl===null&&P.me.rec===true,'me: not linked yet, recovery code present');
P.send({t:'google_link',credential:token({sub:'333',email:'pw@gmail.com'})});const lk=await tryWait(P,'google_linked',3000);ok(lk&&lk.email=='pw@gmail.com','linking Google to a password account works');
await sleep(200);ok(P.last('me').gl=='pw@gmail.com','me shows the linked address');
P.send({t:'google_link',credential:token({sub:'334'})});let tt=await P.wait('toast');ok(/ผูก Google ไว้แล้ว/.test(tt.m),'a second link on the same account is refused');
P.ws.close();await sleep(200);
{const X=await cli();X.send({t:'google',credential:token({sub:'333'})});const a=await X.wait('auth');ok(a.ok&&a.name=='PwUser','then Google signs in to that same account');await X.wait('me');
 X.ws.close()}
{const X=await cli();const a=await X.auth({t:'login',user:'PwUser',pass:'secret1'});ok(a.ok,'...and the password still works too');X.ws.close()}
// a Google id that already belongs to somebody else cannot be linked again
const Q=await cli();await Q.auth({t:'register',user:'PwUser2',email:'p2@example.com',pass:'secret1'});
Q.send({t:'google_link',credential:token({sub:'111'})});tt=await Q.wait('toast');ok(/คนอื่นแล้ว/.test(tt.m),'a Google account that belongs to someone else cannot be linked');
Q.send({t:'google_link',credential:token({sub:'5',aud:'nope'})});tt=await Q.wait('toast');ok(/ไม่สำเร็จ/.test(tt.m),'linking with a bad token is refused');
// guests cannot link
const G=await cli();await G.auth({t:'guest'});G.send({t:'google_link',credential:token({sub:'777'})});await sleep(500);ok(!G.last('google_linked'),'a guest cannot link Google');G.ws.close();
{const X=await cli();X.send({t:'google',credential:token({sub:'777'})});await X.wait('google_new');ok(true,'...and sub 777 was not bound to the guest');X.ws.close()}
// the e-mail in a token never logs in to a password account with the same e-mail
{const X=await cli();X.send({t:'google',credential:token({sub:'888',email:'pw@example.com'})});const g=await tryWait(X,'google_new',3000);ok(g&&!X.last('auth'),'a Google user with the SAME e-mail as a password account is NOT given that account (new account instead)');X.ws.close()}
ok(srv.exitCode===null,'server still running after all the bad input');

// ======================= petting limit (CD_PET_DAILY=5)
const T=await cli();await T.auth({t:'register',user:'PetFan',email:'pf@example.com',pass:'secret1'});
await sleep(300);const house=T.last('house');const dogId=house.dogs[0].id;
ok(T.me.pets&&T.me.pets.n==0&&T.me.pets.max==5,'me: pets today 0 of 5 '+JSON.stringify(T.me.pets));
T.clear();
for(let i=0;i<8;i++){T.send({t:'act',a:'pet',dog:dogId});await sleep(60)}
await sleep(400);
const pets=T.log.filter(x=>x.t=='pets');
ok(pets.length==5&&pets[4].n==5&&pets[4].max==5,'5 petting hearts count, the counter goes 1..5 ('+pets.map(x=>x.n)+')');
ok(T.count('petcap')==1,'once the limit is reached the player is told (only once, not for every tap)');
const fx=T.count('fx',x=>x.pet);ok(fx>=5&&fx<8,'heart effects after the limit are thinned out ('+fx+' of 8)');
await sleep(900);T.send({t:'act',a:'pet',dog:dogId});await sleep(200);
// the stat only counted 5
const st=await (async()=>{T.send({t:'ach'});const a=await T.wait('ach');const pm=a.list.find(x=>x.id=='pet100');return pm})();
ok(st&&st.prog==5,'the "Pet 100 times" achievement progress only grew by 5 (is '+(st&&st.prog)+')');
ok(T.count('petcap')<=2,'the limit message is rate limited');
// visitors petting somebody else's dog do not count for the owner nor themselves
const V=await cli();await V.auth({t:'register',user:'PetVisit',email:'pv@example.com',pass:'secret1'});
V.send({t:'visit',id:'PetFan'});await V.wait('house');V.clear();
for(let i=0;i<3;i++){V.send({t:'act',a:'pet',dog:dogId});await sleep(80)}
await sleep(300);ok(V.count('pets')==0&&V.count('petcap')==0,'petting a friend\'s dog gives visitor no counter / no limit message (hearts only)');
V.ws.close();

// ======================= achievement title
T.send({t:'admin',key:'testadminkey123',coins:5000});await sleep(300);
T.send({t:'capsule',n:10,ticket:true});await sleep(600);
T.clear();T.send({t:'ach'});let ach=await T.wait('ach');
const d5=ach.list.find(x=>x.id=='d5'),caps=ach.list.find(x=>x.id=='caps10'),k1=ach.list.find(x=>x.id=='pet1k');
ok(d5.prog>=d5.goal&&caps.prog>=caps.goal&&k1.prog<k1.goal,'(setup) two achievements are finished, "Cuddle Legend" is not');
ok(ach.ti===null,'nothing shown above the head yet');
T.clear();T.send({t:'ach_title',id:'pet1k'});tt=await T.wait('toast');ok(/ยังทำ/.test(tt.m),'an unfinished achievement cannot be chosen');
T.send({t:'ach_title',id:'nope'});tt=await T.wait('toast');ok(/ยังทำ/.test(tt.m),'an unknown achievement id cannot be chosen');
T.send({t:'ach_title',id:{a:1}});await sleep(150);T.send({t:'ach_title',id:'__proto__'});await sleep(150);ok(srv.exitCode===null,'weird ids do not hurt the server');
// a watcher in the house and one in the park
const W=await cli();await W.auth({t:'register',user:'Watcher',email:'w@example.com',pass:'secret1'});
W.send({t:'visit',id:'PetFan'});await W.wait('house');
T.send({t:'park_join'});await T.wait('park_init');
W.send({t:'park_join'});const pi=await W.wait('park_init');W.clear();
T.clear();T.send({t:'ach_title',id:'d5'});
const a2=await T.wait('ach');ok(a2.ti=='d5','chosen: the achievement list says which one is shown');
const m2=await T.wait('me');ok(m2.ti&&m2.ti.id=='d5'&&m2.ti.n=='Dog Lover','me carries the title (id + name)');
const wp=await tryWait(W,'park_ti',2500);ok(wp&&wp.n=='PetFan'&&wp.ti&&wp.ti.id=='d5','people in the park get the new title right away');
T.send({t:'park_leave'});await sleep(200);W.send({t:'park_leave'});await sleep(200);W.clear();
// Watcher is back in PetFan's house view after leaving the park? make sure
W.send({t:'visit',id:'PetFan'});const h2=await W.wait('house');ok(h2.ti&&h2.ti.id=='d5','visitors of the house receive the title with the house');
T.clear();W.clear();T.send({t:'ach_title',id:'caps10'});
const up=await tryWait(W,'ti_upd',2500);ok(up&&up.n=='PetFan'&&up.ti.id=='caps10','visitors of the house see a change at once');
T.send({t:'park_join'});await T.wait('park_init');W.send({t:'park_join'});const pi2=await W.wait('park_init');
const ent=pi2.members.find(x=>x.n=='PetFan');ok(ent&&ent.ti&&ent.ti.id=='caps10','the park member list carries each player\'s title');
T.send({t:'park_leave'});W.send({t:'park_leave'});await sleep(200);
// a state-based achievement ("Hold 2000 coins") hides itself when it stops being true, but stays chosen
T.send({t:'ach_title',id:'rich'});await sleep(300);ok(T.last('me').ti&&T.last('me').ti.id=='rich','a finished state-based achievement can be chosen');
// remove
T.clear();T.send({t:'ach_title',id:null});const a3=await T.wait('ach');ok(a3.ti===null,'choosing none hides it');
const m3=await T.wait('me');ok(m3.ti===null,'me: no title');
T.send({t:'ach_title',id:'d5'});await sleep(300);
// persists across a new connection (session token)
T.ws.close();await sleep(300);
const T2=await cli();T2.send({t:'login',user:'PetFan',pass:'secret1'});await T2.wait('auth');await T2.wait('me');ok(T2.me.ti&&T2.me.ti.id=='d5','the title is remembered after logging in again');
}catch(e){console.log('FAIL (exception)',e&&e.stack||e);fail++}
await done()})();
