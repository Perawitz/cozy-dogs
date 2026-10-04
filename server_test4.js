// v5.1 server tests: Treat Frenzy + Odd Pup Out online games. Needs the server started with CD_TEST=1 CD_MPWAIT=1200.
const PORT=process.env.PORT||3055,URL='ws://localhost:'+PORT;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let pass=0,fail=0;const ok=(c,n)=>{c?pass++:fail++;console.log(c?'PASS':'FAIL',n)};
function cli(){return new Promise(res=>{const ws=new WebSocket(URL),log=[];const o={ws,log,me:null,send:m=>ws.readyState==1&&ws.send(JSON.stringify(m)),
 wait:(t,ms=3000,f)=>new Promise((ok,no)=>{const g=()=>{const i=log.findIndex(x=>x.t==t&&(!f||f(x)));if(i>=0)return ok(log.splice(i,1)[0]);if((ms-=25)<=0)return no(new Error('timeout '+t));setTimeout(g,25)};g()}),
 last:t=>[...log].reverse().find(x=>x.t==t),clear:t=>{for(let i=log.length-1;i>=0;i--)if(!t||log[i].t==t)log.splice(i,1)},
 toast:async(ms=400)=>{await sleep(ms);const l=log.filter(x=>x.t=='toast');o.clear('toast');return l.at(-1)?.m||''}};
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.t=='me')o.me=m;log.push(m)};ws.onopen=()=>res(o)})}
async function reg(name,guest){const c=await cli();c.send(guest?{t:'guest'}:{t:'register',user:name,email:name+'@x.co',pass:'secret1'});const a=await c.wait('auth');if(!a.ok)throw new Error('auth failed for '+name+': '+a.err);c.name=a.name;await c.wait('welcome');await c.wait('me');c.house=await c.wait('house');c.dog=c.house.dogs[0].id;return c}
const startMsg=c=>c.wait('mp_start',8000);
(async()=>{
 // ---------- Treat Frenzy with bots
 const a=await reg('rushA');
 a.send({t:'mp_find',g:'rush',dog:a.dog});const lob=await a.wait('mp_lobby');ok(lob.g=='rush'&&lob.max==4,'rush lobby opened');
 const st=await startMsg(a);ok(st.g=='rush'&&st.pl.length==3&&st.cfg.dur==24000,'rush starts with bots + duration');
 let mine=0,seen=0,rx=[],bad=0;const t0=Date.now();
 a.send({t:'mp_hit',id:1});await sleep(300);ok(!a.last('mp_rx'),'hit before GO ignored');
 while(Date.now()-t0<30000&&!a.last('mp_end')){
  for(const m of a.log.splice(0)){if(m.t=='mp_rs'){seen++;if(m.k!='boot'){setTimeout(()=>a.send({t:'mp_hit',id:m.id}),Math.random()<.5?30:900)}}
   else if(m.t=='mp_rx'){rx.push(m);if(m.by==0)mine++}else if(m.t=='mp_end'){a.log.push(m)}}
  await sleep(25)}
 const end=a.last('mp_end')||await a.wait('mp_end',8000);
 ok(seen>=20,'treats spawned ('+seen+')');ok(mine>=3,'human claimed treats ('+mine+')');ok(rx.some(x=>x.by>0),'bots claim treats too');
 ok(rx.every(x=>Array.isArray(x.sc)||x.by==-1),'claims carry the score board');
 ok(end.g=='rush'&&end.res.length==3&&end.me.rank>=1,'rush ends with results (rank '+end.me.rank+')');
 ok(end.res.every(r=>typeof r.score=='number'&&r.score>=0),'scores are never negative');
 // double claim on same id must not score twice
 // ---------- Odd Pup Out with bots
 const b=await reg('oddB');
 b.send({t:'mp_find',g:'odd',dog:b.dog});await b.wait('mp_lobby');const st2=await startMsg(b);ok(st2.g=='odd'&&st2.cfg.rounds==6,'odd starts');
 let rounds=0,wrongSent=0,right=0;const t1=Date.now();
 while(Date.now()-t1<70000&&!b.last('mp_end')){
  for(const m of b.log.splice(0)){
   if(m.t=='mp_o'){rounds++;const cnt={};m.cells.forEach(c=>cnt[c]=(cnt[c]||0)+1);const odd=m.cells.findIndex(c=>cnt[c]==1);
    ok(m.cells.length==(m.i<2?9:m.i<4?12:16),'round '+(m.i+1)+' grid size '+m.cells.length);
    if(m.i==0){b.send({t:'mp_pick',i:m.i,c:odd});await sleep(150);ok(!b.last('mp_ov'),'instant pick (<420ms) rejected');
     const wrong=(odd+1)%m.cells.length;await sleep(800);b.send({t:'mp_pick',i:m.i,c:wrong});const w=await b.wait('mp_ow',2000).catch(()=>null);ok(w&&w.sc==0,'wrong pick penalised (score floors at 0)');wrongSent++;
     b.send({t:'mp_pick',i:m.i,c:odd});await sleep(100);ok(!b.last('mp_ov'),'pick during lockout ignored');await sleep(1200);b.send({t:'mp_pick',i:m.i,c:odd});right++}
    else{await sleep(600+Math.random()*500);b.send({t:'mp_pick',i:m.i,c:odd});right++}}
   else if(m.t=='mp_end')b.log.push(m)}
  await sleep(25)}
 const e2=b.last('mp_end')||await b.wait('mp_end',10000);
 ok(rounds==6,'6 rounds played ('+rounds+')');ok(e2.g=='odd'&&e2.me.rank==1&&e2.me.win,'human finds the odd pup faster than bots (rank '+e2.me.rank+')');
 // ---------- two humans in rush: both in same room, quitting mid game does not crash
 const c1=await reg('rushC1'),c2=await reg('rushC2');
 c1.send({t:'mp_find',g:'rush',dog:c1.dog});c2.send({t:'mp_find',g:'rush',dog:c2.dog});
 const s1=await startMsg(c1),s2=await startMsg(c2);ok(s1.pl.length==2&&!s1.pl[0].bot&&!s1.pl[1].bot&&s1.me!=s2.me,'two humans share a rush room');
 await sleep(4500);c2.send({t:'mp_leave'});await sleep(500);ok(!!c1.last('mp_gone'),'other player is told about the leaver');
 const e3=await c1.wait('mp_end',30000);ok(e3.me.vsHuman===true&&e3.res.length==2,'rush finishes for the remaining player');
 // ---------- info lists all five games
 c1.send({t:'mp_get'});const inf=await c1.wait('mp_info');ok(['race','grab','duel','rush','odd'].every(g=>g in inf.wait),'mp_info lists all online games');
 console.log(`\nPASS ${pass} FAIL ${fail}`);process.exit(fail?1:0);
})().catch(e=>{console.log('FAIL fatal',e);process.exit(1)});
