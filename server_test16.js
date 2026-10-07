// v7.2 tests: explorer (starter) missions, the one-time "what's new" flag, the DM stat.
//   16 starter missions (the first 10 unchanged, 6 new ones that pay free gems), a new player's tour flag, tutorial marks the tour as seen,
//   whatsnew is idempotent and ignores junk, sending a private message counts for its mission, claiming pays the gems exactly once.
// Self-contained: starts its OWN server on PORT+30 (PORT env, default 3055).  Exit code 1 when anything FAILs.
'use strict';
const {spawn}=require('child_process'),os=require('os'),path=require('path');
const PORT=+(process.env.PORT||3055)+30;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let pass=0,fail=0;const ok=(c,n)=>{c?pass++:fail++;console.log(c?'PASS':'FAIL',n)};
const PW='secret12';
function cli(){return new Promise((res,rej)=>{const ws=new WebSocket('ws://localhost:'+PORT),log=[];
  const o={ws,log,send:m=>ws.send(JSON.stringify(m)),
   wait:(t,ms=3000,f=null)=>new Promise((ok,no)=>{const g=()=>{const i=log.findIndex(x=>x.t==t&&(!f||f(x)));if(i>=0)return ok(log.splice(i,1)[0]);if((ms-=25)<=0)return no(new Error('timeout '+t));setTimeout(g,25)};g()}),
   clear:t=>{for(let i=log.length-1;i>=0;i--)if(!t||log[i].t==t)log.splice(i,1)},
   async auth(m){o.send(m);const a=await o.wait('auth',4000);if(a.ok){await o.wait('welcome',3000);await o.wait('me',3000)}return a},
   async refresh(){o.clear('me');o.send({t:'dbg_give'});await o.wait('me',2000);return o.me}};      // dbg_give with nothing to give = "send me my numbers again"
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.t=='me')o.me=m;log.push(m)};ws.onopen=()=>res(o);ws.onerror=()=>rej(new Error('connect'))})}
const data=path.join(os.tmpdir(),'cozydogs_t16_'+process.pid+'.json');
const srv=spawn(process.execPath,[path.join(__dirname,'server.js')],{env:{...process.env,PORT:String(PORT),DATA:data,CD_TEST:'1'},stdio:['ignore','pipe','pipe']});
let err='';srv.stderr.on('data',d=>err+=d);
const reg=async name=>{const c=await cli();const a=await c.auth({t:'register',user:name,email:name+'@example.com',pass:PW});if(!a.ok)throw new Error('register '+name+JSON.stringify(a));c.name=name;return c};
const starter=async c=>{c.clear('starter');c.send({t:'starter'});return c.wait('starter')};
(async()=>{
 await sleep(1500);
 try{
  const A=await reg('ExpA'),B=await reg('ExpB');
  // ---------- the list
  let st=await starter(A);
  ok(st.list.length===16,'16 starter missions ('+st.list.length+')');
  ok(st.list.slice(0,10).map(x=>x.t).join('|')==['Feed a dog','Pet your dogs 5 times','Buy something in the Shop','Place a furniture item','Train a trick','Open a capsule','Grant a dog wish','Visit the dog park',"Visit a friend's house",'Play an online mini-game'].join('|'),'the first 10 missions are unchanged (their claimed flags stay valid)');
  const nw=st.list.slice(10);
  ok(nw.map(x=>x.t).join('|')==['Hatch your first dog egg','Breed two dogs in the Nursery','Enter a dog in the Dog Show','Vote in a Dog Show','Adopt a dog from the Pet Shop','Send a private message to a friend'].join('|'),'the 6 explorer missions');
  ok(nw.reduce((s,x)=>s+(x.r.g||0),0)===11&&nw.every(x=>x.goal===1&&x.prog===0&&!x.claimed),'they pay 11 gems in total, one try each, nothing done yet');
  ok(!st.bonus.ready&&!st.bonus.claimed,'the all-done bonus is not ready');
  ok(A.me.stDone===0,'stDone is 0 for a new player');
  // ---------- what's new flag
  ok(A.me.wn===0&&A.me.tut===false,'a new account: tour not seen (wn 0), tutorial not done');
  A.send({t:'tutorial'});let me=await A.refresh();
  ok(me.tut===true&&me.wn===72,'finishing the tutorial also marks the tour as seen (wn 72)');
  B.send({t:'dbg_wn'});me=await B.wait('me');
  ok(me.tut===true&&me.wn===0,'(test helper) a player from before v7.2: tutorial done, tour not seen');
  for(const junk of [{t:'whatsnew',v:5},{t:'whatsnew',v:'x'},{t:'whatsnew',v:null}]){B.clear('me');B.send(junk);await sleep(120)}
  me=await B.refresh();ok(me.wn===72,'whatsnew marks it seen (the number the client sends is ignored: 72)');
  B.send({t:'whatsnew'});me=await B.refresh();ok(me.wn===72,'a second whatsnew changes nothing');
  const R=await cli();R.send({t:'guest'});const ga=await R.wait('auth');await R.wait('welcome',3000);await R.wait('me',3000);
  ok(ga.ok&&R.me.wn===0,'a guest also starts with wn 0');R.send({t:'whatsnew'});me=await R.refresh();ok(me.wn===72,'...and can mark it seen');
  // ---------- private message counts for its mission
  A.send({t:'friend_add',name:B.name});await B.wait('friends',3000,f=>f.inReq.some(r=>r.name==A.name));B.send({t:'friend_ok',name:A.name});await A.wait('friends',3000,f=>f.friends.some(r=>r.name==B.name));
  st=await starter(A);ok(st.list[15].prog===0,'before any message: 0/1');
  A.clear('dm_chat');A.send({t:'dm_open',with:B.name});const ch=await A.wait('dm_chat');
  A.send({t:'dm_send',id:ch.id,m:''});await sleep(200);st=await starter(A);ok(st.list[15].prog===0,'an empty message does not count');
  A.send({t:'dm_send',id:ch.id,m:'สวัสดี'});await sleep(250);st=await starter(A);ok(st.list[15].prog===1,'sending a message: 1/1');
  A.send({t:'starter_claim',i:15});await sleep(250);const g1=(await A.refresh()).gems;
  ok(g1===10+1+0,'claiming pays 1 gem ('+g1+')');
  A.send({t:'starter_claim',i:15});await sleep(250);ok((await A.refresh()).gems===g1,'no second payment');
  st=await starter(A);ok(st.list[15].claimed===true&&st.list[14].claimed===false,'only that mission is marked claimed');
  // a mission nobody did cannot be claimed, a bad index is ignored
  for(const i of [10,11,12,13,14,99,-1,'x',null,1.5]){A.send({t:'starter_claim',i});await sleep(60)}
  ok((await A.refresh()).gems===g1,'unfinished or invalid claims pay nothing');
  // the other chat message of B does not give A anything
  B.send({t:'dm_send',id:ch.id,m:'hi'});await sleep(250);st=await starter(B);ok(st.list[15].prog===1,'B sent a message too: B has 1/1');
  ok(!err,'server wrote nothing to stderr ('+err.slice(0,200)+')');
 }catch(e){fail++;console.log('FAIL EXCEPTION',e&&e.stack||e)}
 try{srv.kill()}catch{}
 console.log('\nPASS',pass,'FAIL',fail);process.exit(fail?1:0)})();
