// v6.1 regression tests: the player who joined SECOND but plays better must be ranked 1st in EVERY online game.
// (rankBy() used to hand the player's index to the key function, so every game ranked players in join order and the winner got 2nd place.)
// Race has its own check in server_test3.js; this file covers Bone Grab, Breed Duel, Treat Frenzy and Odd Pup Out. The four games run side by side.
// Needs the server started with CD_TEST=1 CD_MPWAIT=1200  (npm test does this for you).
const PORT=process.env.PORT||3055,URL='ws://localhost:'+PORT;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let pass=0,fail=0;const ok=(c,n)=>{c?pass++:fail++;console.log(c?'PASS':'FAIL',n)};
function cli(){return new Promise(res=>{const ws=new WebSocket(URL),log=[];const o={ws,log,me:null,send:m=>ws.readyState==1&&ws.send(JSON.stringify(m)),
 wait:(t,ms=3000,f)=>new Promise((ok,no)=>{const g=()=>{const i=log.findIndex(x=>x.t==t&&(!f||f(x)));if(i>=0)return ok(log.splice(i,1)[0]);if((ms-=25)<=0)return no(new Error('timeout '+t));setTimeout(g,25)};g()}),
 last:t=>[...log].reverse().find(x=>x.t==t),on:f=>ws.addEventListener('message',e=>f(JSON.parse(e.data)))};
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.t=='me')o.me=m;log.push(m)};ws.onopen=()=>res(o)})}
async function reg(name){const c=await cli();c.send({t:'register',user:name,email:name+'@x.co',pass:'secret1'});const a=await c.wait('auth');if(!a.ok)throw new Error('auth failed for '+name+': '+a.err);c.name=a.name;await c.wait('welcome');await c.wait('me');c.house=await c.wait('house');c.dog=c.house.dogs[0].id;return c}
// two humans in one room: `first` joins the lobby first, `second` right after it
async function pair(g,n1,n2){const a=await reg(n1),b=await reg(n2);
 a.send({t:'mp_find',g,dog:a.dog});await a.wait('mp_lobby');b.send({t:'mp_find',g,dog:b.dog});
 const sa=await a.wait('mp_start',8000),sb=await b.wait('mp_start',8000);
 ok(sa.pl.length==2&&sa.pl.every(x=>!x.bot)&&sa.pl[0].n==n1&&sa.pl[1].n==n2&&sa.me==0&&sb.me==1,g+': two humans share the room, '+n1+' joined first');
 return{a,b}}
// the common assertions once both players have their result
async function verdict(g,a,b,wait){let ea=null,eb=null;try{eb=await b.wait('mp_end',wait);ea=await a.wait('mp_end',4000)}catch(e){console.log('  (',g,e.message,')')}
 ok(!!ea&&!!eb,g+': both players get a result');if(!ea||!eb)return;
 ok(eb.me.rank==1&&ea.me.rank==2,g+': the second joiner who played better is ranked 1st ('+eb.me.rank+'/'+ea.me.rank+')');
 ok(eb.me.win&&!ea.me.win,g+': ...and is the one marked as the winner');
 const sc=n=>eb.res.find(x=>x.n==n);
 ok(sc(b.name).rank==1&&sc(a.name).rank==2&&sc(b.name).score>sc(a.name).score,g+': the result table gives the winner rank 1 and the higher score ('+sc(b.name).score+' vs '+sc(a.name).score+')');
 ok(eb.me.coins>ea.me.coins,g+': the winner is paid more ('+eb.me.coins+' vs '+ea.me.coins+')');
 ok(JSON.stringify(ea.res.map(x=>x.n))==JSON.stringify(eb.res.map(x=>x.n)),g+': both players see the same order')}

async function grab(){const{a,b}=await pair('grab','rkGrabA','rkGrabB');
 b.on(m=>{if(m.t=='mp_signal')b.send({t:'mp_act',r:1})});             // only the 2nd joiner reacts to the bone
 await verdict('grab',a,b,40000)}
async function duel(){const{a,b}=await pair('duel','rkDuelA','rkDuelB');
 for(let r=0;r<5;r++){const qb=await b.wait('mp_q',16000),qa=await a.wait('mp_q',16000),q=qb.q;
  // picture questions can be answered from what the client sees; for the other kinds both players give the same answer
  const right=q.k=='img'?q.opts.indexOf(q.breed):0,wrong=q.k=='img'?(right+1)%q.opts.length:0;
  b.send({t:'mp_ans',i:qb.i,o:right});await sleep(250);a.send({t:'mp_ans',i:qa.i,o:wrong});await b.wait('mp_qr',16000)}
 await verdict('duel',a,b,15000)}
async function rush(){const{a,b}=await pair('rush','rkRushA','rkRushB');
 b.on(m=>{if(m.t=='mp_rs'&&m.k!='boot')setTimeout(()=>b.send({t:'mp_hit',id:m.id}),40)});      // grabs every treat, dodges the boots; the 1st joiner does nothing
 await verdict('rush',a,b,45000)}
async function odd(){const{a,b}=await pair('odd','rkOddA','rkOddB');
 b.on(m=>{if(m.t=='mp_o'){const cnt={};m.cells.forEach(c=>cnt[c]=(cnt[c]||0)+1);const idx=m.cells.findIndex(c=>cnt[c]==1);setTimeout(()=>b.send({t:'mp_pick',i:m.i,c:idx}),700)}});
 await verdict('odd',a,b,60000)}

(async()=>{
 await Promise.all([grab(),duel(),rush(),odd()]);
 console.log(`\nserver_test7: ${pass} passed, ${fail} failed`);process.exit(fail?1:0)
})().catch(e=>{console.log('FAIL fatal',e);process.exit(1)});
