// v7.1 tests: server-wide announcements (announce.js).
//   prices 3/8/20 gems, only members, text cleaning (length by characters, control chars, links, rude words), cooldown, ONE queue (max 6 waiting,
//   banners never overlap), nothing is charged for a refused announcement, history, late joiners see the running banner, a restart keeps paid announcements,
//   hostile input and a flood.
// Self-contained: starts its OWN servers on PORT+20 / PORT+21 (PORT env, default 3055).  Exit code 1 when anything FAILs.
'use strict';
const {spawn}=require('child_process'),os=require('os'),path=require('path');
const BASE=+(process.env.PORT||3055),PA=BASE+20,PB=BASE+21;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let pass=0,fail=0;const ok=(c,n)=>{c?pass++:fail++;console.log(c?'PASS':'FAIL',n)};
const KEY='testadminkey1',PW='secret12';
function cli(PORT){return new Promise((res,rej)=>{const ws=new WebSocket('ws://localhost:'+PORT),log=[];
  const o={ws,log,send:m=>ws.send(JSON.stringify(m)),raw:s=>ws.send(s),
   wait:(t,ms=3000,f=null)=>new Promise((ok,no)=>{const g=()=>{const i=log.findIndex(x=>x.t==t&&(!f||f(x)));if(i>=0)return ok(log.splice(i,1)[0]);if((ms-=25)<=0)return no(new Error('timeout '+t));setTimeout(g,25)};g()}),
   count:(t,f)=>log.filter(x=>x.t==t&&(!f||f(x))).length,clear:t=>{for(let i=log.length-1;i>=0;i--)if(!t||log[i].t==t)log.splice(i,1)},
   async auth(m){o.send(m);const a=await o.wait('auth',4000);if(a.ok){await o.wait('welcome',3000);await o.wait('me',3000)}return a},
   async toast(ms=1200){try{return(await o.wait('toast',ms)).m}catch{return null}},
   async info(){o.clear('ann_info');o.send({t:'ann_info'});return o.wait('ann_info')},
   async gems(){await sleep(150);return o.me.gems}};
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.t=='me')o.me=m;log.push(m)};ws.onopen=()=>res(o);ws.onerror=()=>rej(new Error('connect'))})}
const procs=[];
const start=(port,env,data)=>{data=data||path.join(os.tmpdir(),'cozydogs_t15_'+port+'_'+process.pid+'.json');
  const p=spawn(process.execPath,[path.join(__dirname,'server.js')],{env:{...process.env,PORT:String(port),DATA:data,ADMIN_KEY:KEY,CD_TEST:'1',...env},stdio:['ignore','pipe','pipe']});
  let err='';p.stderr.on('data',d=>err+=d);p.getErr=()=>err;p.data=data;p.exited=new Promise(r=>p.on('exit',r));procs.push(p);return p};
const stop=async p=>{p.kill('SIGTERM');await Promise.race([p.exited,sleep(4000)])};
const reg=async(port,name)=>{const c=await cli(port);const a=await c.auth({t:'register',user:name,email:name+'@example.com',pass:PW});if(!a.ok)throw new Error('register '+name+': '+JSON.stringify(a));c.name=name;return c};
const login=async(port,name)=>{const c=await cli(port);const a=await c.auth({t:'login',user:name,pass:PW});if(!a.ok)throw new Error('login '+name+': '+JSON.stringify(a));c.name=name;return c};
const rich=async(port,name)=>{const c=await reg(port,name);c.send({t:'admin',key:KEY,coins:1e6});await sleep(200);return c};

(async()=>{
 const SA=start(PA,{CD_ANN_SCALE:'1'}),SB=start(PB,{CD_ANN_CD:'0',CD_ANN_SCALE:'20'});await sleep(1500);
 try{
 // ============================================================ A: rules (real timing: banners 7/9/12 s, cooldown 30 s)
 const a=await reg(PA,'AnnA'),b=await reg(PA,'AnnB'),g=await cli(PA);g.send({t:'guest'});const ga=await g.wait('auth');
 const i0=await a.info();
 ok(i0.price&&i0.price.heart===3&&i0.price.star===8&&i0.price.rainbow===20,'prices: heart 3 / star 8 / rainbow 20 gems');
 ok(i0.ms.heart===7000&&i0.ms.star===9000&&i0.ms.rainbow===12000&&i0.max===60&&i0.cd===0&&i0.q===0&&i0.cur===null&&Array.isArray(i0.hist)&&i0.hist.length===0,'info: durations, 60 characters, no cooldown, empty queue, no banner, empty history');
 ok(a.me.gems===10,'a new player has 10 gems');
 // --- guests
 g.clear();g.send({t:'ann_send',m:'hello',k:'heart'});const gt=await g.toast();
 ok(ga.guest&&/สมัครสมาชิก/.test(gt||'')&&g.count('ann_ok')===0,'a Guest cannot announce (asked to register) '+gt);
 // --- cannot afford
 a.clear('toast');a.send({t:'ann_send',m:'too expensive',k:'rainbow'});const t1=await a.toast();
 ok(/Gems ไม่พอ/.test(t1||'')&&(await a.gems())===10&&b.count('ann')===0,'20 gems needed, 10 owned: refused, nothing charged, nobody sees it ('+t1+')');
 // --- hostile / invalid input: nothing charged, nothing shown
 const bad=[{m:'hi',k:'nope'},{m:'hi'},{m:'hi',k:{}},{m:'hi',k:['heart']},{m:'hi',k:'__proto__'},{m:'hi',k:'toString'},{m:'hi',k:'constructor'},{m:'',k:'heart'},{m:'   ',k:'heart'},{m:null,k:'heart'},{m:{a:1},k:'heart'},{m:['a'],k:'heart'},{m:12345,k:'heart',skip:1},
   {k:'heart'},{m:'\u0000​‮',k:'heart'},{m:'visit www.example.com now',k:'heart'},{m:'go to http://x.y',k:'heart'},{m:'https://evil.test',k:'heart'},{m:'my site is cool.com',k:'heart'},{m:'add me line.me/abc',k:'heart'},{m:'dm @someone_x',k:'heart'},
   {m:'ไอ้เหี้ย',k:'heart'},{m:'f u c k',k:'heart'},{m:'ค ว ย',k:'heart'},{m:'S.H.I.T',k:'heart'}].filter(x=>!x.skip);
 a.clear();for(const x of bad){a.send({t:'ann_send',...x})}await sleep(900);
 ok(a.count('ann_ok')===0&&b.count('ann')===0&&(await a.gems())===10,'24 invalid / link / rude announcements: none accepted, none shown, nothing charged (gems '+a.me.gems+')');
 const links=['visit www.example.com now','my site is cool.com'];let lk=0;for(const m of links){a.clear('toast');a.send({t:'ann_send',m,k:'heart'});if(/ลิงก์/.test(await a.toast()||''))lk++}
 ok(lk===2,'a link gets the "no links" message');
 a.clear('toast');a.send({t:'ann_send',m:'ไอ้เหี้ย',k:'heart'});ok(/ไม่สุภาพ/.test(await a.toast()||''),'a rude word gets the "polite words" message');
 a.clear('toast');a.send({t:'ann_send',m:'สวัสดีทุกคน แม่งานมาแล้ว',k:'heart'});await sleep(300);
 ok(a.count('ann_ok')===1,'normal Thai text is fine (สวัสดี / แม่งาน are not rude words)');
 // --- the happy path (that one was a 3-gem heart)
 const ok1=await a.wait('ann_ok');const an1=await b.wait('ann',2000);
 ok(ok1.pos===0&&ok1.wait===0&&ok1.k==='heart'&&ok1.price===3,'accepted: first in line, shows at once, price 3');
 ok(an1.n==='AnnA'&&an1.m==='สวัสดีทุกคน แม่งานมาแล้ว'&&an1.k==='heart'&&an1.ms===7000&&Number.isInteger(an1.id),'EVERY online player gets the banner: sender, text, style, 7000 ms');
 ok((await a.gems())===7&&a.me.gems===7,'3 gems charged (10 -> 7)');
 ok(a.count('ann')===1,'the sender sees his own banner too');
 // --- cooldown (30 s)
 a.clear('toast');a.send({t:'ann_send',m:'again please',k:'heart'});const t2=await a.toast();
 const i1=await a.info();
 ok(/ประกาศได้อีกครั้ง/.test(t2||'')&&(await a.gems())===7&&i1.cd>25000&&i1.cd<=30000,'cooldown 30 s: second one refused and free (cd '+i1.cd+' ms)');
 ok(i1.cur&&i1.cur.n==='AnnA'&&i1.cur.ms>0&&i1.cur.ms<=7000&&i1.hist.length===1&&i1.hist[0].m==='สวัสดีทุกคน แม่งานมาแล้ว','info during the banner: "cur" with the time left, one history row');
 // --- late joiner sees the running banner
 const late=await reg(PA,'AnnLate');const il=await late.info();
 ok(il.cur&&il.cur.n==='AnnA'&&il.cur.ms>0,'a player who joins while the banner is up gets it from ann_info');
 // --- B uses the star: waits behind A's banner, one queue
 b.send({t:'ann_send',m:'  ⭐   Hello   ⭐  ',k:'star'});const okb=await b.wait('ann_ok');
 ok(okb.pos===0&&okb.wait>0&&okb.wait<=7900&&okb.price===8&&(await b.gems())===2,'B (star, 8 gems) is queued behind A: waits '+okb.wait+' ms, charged 8 (10 -> 2)');
 ok(b.count('ann',m=>m.n==='AnnB')===0,'B\'s own banner is still waiting (not shown yet)');
 // --- the text is cleaned: collapsed spaces, trimmed
 const i2=await a.info();ok(i2.q===1,'the queue shows 1 waiting');
 await sleep(7600);const an2=await a.wait('ann',2000,x=>x.n==='AnnB');
 ok(an2.m==='⭐ Hello ⭐'&&an2.k==='star'&&an2.ms===9000,'the queued banner starts after the first one ended; spaces collapsed ("'+an2.m+'")');
 const i3=await late.info();ok(i3.hist.length===2&&i3.hist[0].n==='AnnB'&&i3.hist[1].n==='AnnA','history: newest first');

 // ============================================================ B server: no cooldown, banners 20x shorter (350 / 450 / 600 ms), queue + flood
 const x=await rich(PB,'QueueX'),y=await rich(PB,'QueueY'),z=await rich(PB,'QueueZ');
 const gx=x.me.gems;
 // --- 60 characters: cut by characters, never inside an emoji
 const long='ก'.repeat(70),emo='🐶'.repeat(70);
 x.send({t:'ann_send',m:long,k:'heart'});const l1=await y.wait('ann',2000,m=>m.n==='QueueX');
 ok(Array.from(l1.m).length===60&&l1.m==='ก'.repeat(60),'70 Thai characters -> exactly 60');
 await sleep(500);
 x.send({t:'ann_send',m:emo,k:'heart'});const l2=await y.wait('ann',2000,m=>m.m.includes('🐶'));
 ok(Array.from(l2.m).length===60&&!/\ud83d$/.test(l2.m)&&l2.m===Array.from(emo).slice(0,60).join(''),'70 emoji -> exactly 60 whole emoji (no split surrogate)');
 await sleep(600);
 // --- queue: 12 at once, from three players (CD 0): 1 on screen + 6 waiting = 7 accepted, 5 refused, free
 for(const c of [x,y,z]){c.clear('ann');c.clear('ann_ok')}
 const g0=[x,y,z].map(c=>c.me.gems);
 const sends=[];for(let i=0;i<12;i++){const c=[x,y,z][i%3];sends.push([c,i]);c.send({t:'ann_send',m:'msg '+i,k:'heart'})}
 await sleep(900);
 const accepted=[x,y,z].reduce((s,c)=>s+c.count('ann_ok'),0);
 ok(accepted===7,'12 announcements at once: 7 accepted (1 showing + 6 waiting), the rest refused ('+accepted+')');
 await sleep(400);const spent=[x,y,z].map((c,i)=>g0[i]-c.me.gems);
 ok(spent.reduce((s,v)=>s+v,0)===7*3,'only the accepted ones were charged: '+spent.reduce((s,v)=>s+v,0)+' gems = 7 x 3');
 await sleep(4200);
 const seen=x.log.filter(m=>m.t=='ann');
 ok(seen.length===7,'every accepted announcement is shown to everybody exactly once ('+seen.length+')');
 const ids=seen.map(m=>m.id);ok(ids.every((v,i)=>i==0||v>ids[i-1]),'in the order they were accepted (ids rise)');
 // --- banners never overlap: the gap between two "ann" pushes is >= the duration of the earlier one
 x.clear('ann');x.clear('ann_ok');y.clear('ann_ok');
 const T=[];x.ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.t=='ann')T.push([Date.now(),m.ms])});
 for(let i=0;i<4;i++)(i%2?x:y).send({t:'ann_send',m:'gap '+i,k:i%2?'rainbow':'star'});
 await sleep(4800);
 let gapsOk=T.length===4;for(let i=1;i<T.length;i++)if(T[i][0]-T[i-1][0]<T[i-1][1]-60)gapsOk=false;
 ok(gapsOk,'banners never overlap: gaps '+T.slice(1).map((t,i)=>(t[0]-T[i][0])+'>='+T[i][1]).join(', '));
 // --- hostile flood on a single connection: server stays up, only what was paid for is shown
 const gf=z.me.gems;z.clear('ann_ok');z.clear('ann');
 for(let i=0;i<400;i++)z.send({t:'ann_send',m:'flood '+i,k:i%3?'heart':'star'});
 await sleep(1500);
 const okc=z.count('ann_ok');await sleep(300);
 ok(okc<=7+3&&z.me.gems>=0&&z.me.gems===gf-z.log.filter(m=>m.t=='ann_ok').reduce((s,m)=>s+m.price,0),'400-message flood: '+okc+' accepted, gems charged exactly for them (never negative: '+z.me.gems+')');
 const alive=await x.info();ok(alive&&alive.t==='ann_info','the server still answers after the flood');
 await sleep(5000);
 // --- junk payloads on the raw socket
 for(const s of ['{"t":"ann_send"}','{"t":"ann_send","m":"x"}','{"t":"ann_send","m":"x","k":null}','{"t":"ann_info","x":{"a":[1,2,3]}}','{"t":"ann_send","m":"'+'y'.repeat(7000)+'","k":"heart"}','{"t":"ann_send","m":"ok","k":"heart","__proto__":{"gems":1e9}}'])x.raw(s);
 await sleep(500);ok(x.me.gems<1e9&&!({}).gems,'junk payloads do nothing odd (no prototype pollution)');

 // ============================================================ restart keeps a paid announcement (real 7 s banner, no cooldown)
 await stop(SB);
 const dataR=path.join(os.tmpdir(),'cozydogs_t15_restart_'+process.pid+'.json'),SR=start(PB,{CD_ANN_CD:'0',CD_ANN_SCALE:'1'},dataR);await sleep(1500);
 const r=await rich(PB,'RestartR');
 for(let i=0;i<3;i++)r.send({t:'ann_send',m:'persist '+i,k:'heart'});await sleep(500);
 const ir=await r.info();ok(ir.cur&&ir.q===2,'3 sent: 1 showing, 2 waiting (before the restart)');
 const gr=r.me.gems;r.ws.close();await sleep(300);await stop(SR);
 const SR2=start(PB,{CD_ANN_CD:'0',CD_ANN_SCALE:'1'},dataR);await sleep(1800);
 const r2=await login(PB,'RestartR');const ir2=await r2.info();
 ok(r2.me.gems===gr,'gems are as they were ('+gr+')');
 ok(ir2.q+(ir2.cur?1:0)>=2,'after the restart the paid announcements are still there (queue '+ir2.q+', showing '+(ir2.cur?1:0)+')');
 const nxt=await r2.wait('ann',9000).catch(()=>null);ok(!!nxt&&/persist/.test(nxt.m),'...and they are shown to the players');
 await stop(SR2);
 ok(!SA.getErr()&&!SB.getErr(),'servers wrote nothing to stderr ('+(SA.getErr()+SB.getErr()).slice(0,200)+')');
 }catch(e){fail++;console.log('FAIL EXCEPTION',e&&e.stack||e)}
 for(const p of procs)try{p.kill()}catch{}
 console.log('\nPASS',pass,'FAIL',fail);process.exit(fail?1:0)})();
