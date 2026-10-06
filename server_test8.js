// v6.2 server tests: forgot-password with a recovery code.
//   register -> one-time code | reset (user + code + new password) | single use | lock-out after 5 wrong codes | old logins stop working | rec_new (needs the password)
// Needs the server started like the others (npm test does it).
const PORT=process.env.PORT||3055,URL='ws://localhost:'+PORT;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let pass=0,fail=0;const ok=(c,n)=>{c?pass++:fail++;console.log(c?'PASS':'FAIL',n)};
function cli(){return new Promise(res=>{const ws=new WebSocket(URL),log=[];const o={ws,log,me:null,send:m=>ws.readyState==1&&ws.send(JSON.stringify(m)),
 wait:(t,ms=3000,f)=>new Promise((ok,no)=>{const g=()=>{const i=log.findIndex(x=>x.t==t&&(!f||f(x)));if(i>=0)return ok(log.splice(i,1)[0]);if((ms-=25)<=0)return no(new Error('timeout '+t));setTimeout(g,25)};g()}),
 last:t=>[...log].reverse().find(x=>x.t==t),all:t=>log.filter(x=>x.t==t),clear:t=>{for(let i=log.length-1;i>=0;i--)if(!t||log[i].t==t)log.splice(i,1)}};
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.t=='me')o.me=m;log.push(m)};ws.onopen=()=>res(o)})}
const FMT=/^[A-HJ-NP-Z2-9]{4}(-[A-HJ-NP-Z2-9]{4}){3}$/;
const uid=Math.random().toString(36).slice(2,6);
async function reg(name,pass='secret1'){const c=await cli();c.send({t:'register',user:name,email:name+'@x.co',pass});const a=await c.wait('auth');if(!a.ok)throw new Error('register failed: '+a.err);c.token=a.token;c.rec=await c.wait('rec',2000).catch(()=>null);return c}
async function tryAuth(msg){const c=await cli();c.send(msg);const a=await c.wait('auth',3000);if(a.ok){c.rec=await c.wait('rec',1500).catch(()=>null)}c.auth=a;return c}
(async()=>{
 // ---------- registering gives a code, once
 const A=await reg('rec_a'+uid);
 ok(A.rec&&FMT.test(A.rec.code)&&A.rec.fresh===1,'registering shows a recovery code once ('+(A.rec&&A.rec.code)+')');
 await A.wait('me',2000).catch(()=>0);
 ok(A.me&&A.me.rec===true,'the player knows that the account has a recovery code (me.rec)');
 const B=await reg('rec_b'+uid);ok(B.rec.code!==A.rec.code,'every account gets a different code');
 const login=await tryAuth({t:'login',user:'rec_a'+uid,pass:'secret1'});
 ok(login.auth.ok&&!login.rec,'a normal login does not show the code again');login.ws.close();

 // ---------- reset with a wrong code / unknown user: refused, and both look the same
 const w1=await tryAuth({t:'reset',user:'rec_a'+uid,code:'AAAA-BBBB-CCCC-DDDD',pass:'brandnew1'});
 const w2=await tryAuth({t:'reset',user:'nobody_'+uid,code:'AAAA-BBBB-CCCC-DDDD',pass:'brandnew1'});
 ok(!w1.auth.ok&&!w2.auth.ok&&w1.auth.err==w2.auth.err,'a wrong code and an unknown user get the same refusal ('+w1.auth.err+')');
 const w3=await tryAuth({t:'login',user:'rec_a'+uid,pass:'brandnew1'});ok(!w3.auth.ok,'the refused reset did not change the password');
 // a too short new password is refused and does not use up the code
 const sh=await tryAuth({t:'reset',user:'rec_a'+uid,code:A.rec.code,pass:'123'});ok(!sh.auth.ok,'a new password under 6 characters is refused');
 // other message shapes
 const H=await reg('rec_h'+uid);let alive=true;
 for(const code of [null,{x:1},[1,2],12345678901234567,'x'.repeat(5000),'../../etc/passwd','🐶🐶🐶🐶'])for(const user of ['rec_h'+uid,{a:1},null,'__proto__','constructor']){const c=await cli();c.send({t:'reset',user,code,pass:'brandnew1'});const a=await c.wait('auth',2000).catch(()=>null);if(a&&a.ok)alive=false;c.ws.close()}
 ok(alive,'hostile code / user values are refused and nothing logs in');H.ws.close();
 const ping=await cli();ping.send({t:'guest'});ok((await ping.wait('auth',2000)).ok,'the server is still answering after those');ping.ws.close();

 // ---------- the real reset: lower case, no dashes, spaces in between all work
 const sess=await tryAuth({t:'login',user:'rec_a'+uid,pass:'secret1'});const oldToken=sess.auth.token;
 const typed=A.rec.code.toLowerCase().replace(/-/g,' ');
 const R=await tryAuth({t:'reset',user:'rec_a'+uid,code:typed,pass:'brandnew1'});
 ok(R.auth.ok&&R.auth.name=='rec_a'+uid&&!R.auth.guest,'the right code (typed in lower case with spaces) sets a new password and logs in');
 ok(R.rec&&R.rec.reset===1&&FMT.test(R.rec.code)&&R.rec.code!==A.rec.code,'a new code is issued after a reset ('+(R.rec&&R.rec.code)+')');
 const kicked=await sess.wait('kick',2000).catch(()=>null);ok(!!kicked,'the other open login of that account is closed');
 const oldPw=await tryAuth({t:'login',user:'rec_a'+uid,pass:'secret1'});ok(!oldPw.auth.ok,'the old password stops working');
 const newPw=await tryAuth({t:'login',user:'rec_a'+uid,pass:'brandnew1'});ok(newPw.auth.ok,'the new password works');newPw.ws.close();
 const res=await cli();res.send({t:'resume',token:oldToken});const ra=await res.wait('auth',2000);ok(!ra.ok,'sessions created before the reset are no longer valid');res.ws.close();
 const again=await tryAuth({t:'reset',user:'rec_a'+uid,code:A.rec.code,pass:'another11'});ok(!again.auth.ok,'a used code cannot be used twice');
 const again2=await tryAuth({t:'reset',user:'rec_a'+uid,code:R.rec.code,pass:'another11'});ok(again2.auth.ok&&again2.rec&&again2.rec.code!==R.rec.code,'the new code works (and is replaced again)');
 again2.ws.close();R.ws.close();

 // ---------- guessing is limited: 5 wrong codes then even the right one is refused for a while
 let refused=0,last='';
 for(let i=0;i<5;i++){const c=await tryAuth({t:'reset',user:'rec_b'+uid,code:'ZZZZ-ZZZZ-ZZZZ-Z'+'ABCDEFGH'[i]+'ZZ',pass:'brandnew1'});if(!c.auth.ok)refused++;c.ws.close()}
 ok(refused==5,'five wrong guesses are refused');
 const lock=await tryAuth({t:'reset',user:'rec_b'+uid,code:B.rec.code,pass:'brandnew1'});last=lock.auth.err;
 ok(!lock.auth.ok&&/หลายครั้ง/.test(last),'after 5 wrong codes even the right one is locked out for an hour ('+last+')');
 const stillLogin=await tryAuth({t:'login',user:'rec_b'+uid,pass:'secret1'});ok(stillLogin.auth.ok,'the lock only affects resetting - the real owner can still log in with the password');

 // ---------- creating a new code while logged in needs the password
 const C=await reg('rec_c'+uid);await C.wait('me',2000).catch(()=>0);
 C.clear();C.send({t:'rec_new',pass:'wrongpass'});const e1=await C.wait('rec_err',2000).catch(()=>null);ok(e1&&!C.last('rec'),'a new code is refused when the password is wrong');
 C.send({t:'rec_new'});C.send({t:'rec_new',pass:{a:1}});C.send({t:'rec_new',pass:'x'.repeat(500)});await sleep(300);ok(!C.last('rec'),'rec_new with a missing / odd password is refused');
 C.clear();C.send({t:'rec_new',pass:'secret1'});const n1=await C.wait('rec',2000).catch(()=>null);
 ok(n1&&FMT.test(n1.code)&&n1.code!==C.rec.code,'the right password makes a new code ('+(n1&&n1.code)+')');
 const oldC=await tryAuth({t:'reset',user:'rec_c'+uid,code:C.rec.code,pass:'brandnew1'});ok(!oldC.auth.ok,'the code that was replaced no longer works');
 const newC=await tryAuth({t:'reset',user:'rec_c'+uid,code:n1.code,pass:'brandnew1'});ok(newC.auth.ok,'the new code works');newC.ws.close();
 C.ws.close();
 // five wrong passwords on one connection stop further tries (a stolen open session cannot guess the password)
 const D=await reg('rec_d'+uid);for(let i=0;i<5;i++)D.send({t:'rec_new',pass:'nope'+i});await sleep(400);D.clear();D.send({t:'rec_new',pass:'secret1'});await sleep(500);
 ok(!D.last('rec'),'after 5 wrong passwords the right one is not accepted on that connection any more');D.ws.close();

 // ---------- guests have no account, so no code
 const G=await cli();G.send({t:'guest'});await G.wait('auth');await G.wait('me',2000);ok(G.me.rec===null,'a guest has no recovery code (me.rec = null)');
 G.clear();G.send({t:'rec_new',pass:'secret1'});await sleep(300);ok(!G.last('rec')&&!G.last('rec_err'),'a guest cannot make one');
 const gr=await tryAuth({t:'reset',user:G.me.name,code:'AAAA-BBBB-CCCC-DDDD',pass:'brandnew1'});ok(!gr.auth.ok,'a guest name cannot be reset');G.ws.close();
 for(const x of [A,B,sess,w1,w2,w3,sh,oldPw,lock,stillLogin,oldC,gr])try{x.ws.close()}catch{}
 console.log('\nPASS',pass,'FAIL',fail);process.exit(fail?1:0)})().catch(e=>{console.error('ERR',e);process.exit(1)});
