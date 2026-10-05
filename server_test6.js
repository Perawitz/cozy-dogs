// v6 server tests: Dog Brawl (online turn-based fight) + Rock-Paper-Scissors with a bot fallback.
// Needs the server started with CD_TEST=1 CD_MPWAIT=1200 CD_BRFAST=4  (npm test does this for you).
const PORT=process.env.PORT||3055,URL='ws://localhost:'+PORT;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let pass=0,fail=0;const ok=(c,n)=>{c?pass++:fail++;console.log(c?'PASS':'FAIL',n)};
function cli(){return new Promise(res=>{const ws=new WebSocket(URL),log=[];const o={ws,log,me:null,send:m=>ws.readyState==1&&ws.send(JSON.stringify(m)),
 wait:(t,ms=3000,f)=>new Promise((ok,no)=>{const g=()=>{const i=log.findIndex(x=>x.t==t&&(!f||f(x)));if(i>=0)return ok(log.splice(i,1)[0]);if((ms-=25)<=0)return no(new Error('timeout '+t));setTimeout(g,25)};g()}),
 last:t=>[...log].reverse().find(x=>x.t==t),all:t=>log.filter(x=>x.t==t),clear:t=>{for(let i=log.length-1;i>=0;i--)if(!t||log[i].t==t)log.splice(i,1)}};
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.t=='me')o.me=m;log.push(m)};ws.onopen=()=>res(o)})}
async function reg(name){const c=await cli();c.send({t:'register',user:name,email:name+'@x.co',pass:'secret1'});const a=await c.wait('auth');if(!a.ok)throw new Error('auth failed for '+name+': '+a.err);c.name=a.name;await c.wait('welcome');await c.wait('me');c.house=await c.wait('house');c.dog=c.house.dogs[0].id;return c}
// the first message of any of the given types, in arrival order (so a late mp_end can never be mixed up with an earlier message)
async function nextOf(c,types,ms=25000){const t0=Date.now();for(;;){const i=c.log.findIndex(x=>types.includes(x.t));if(i>=0)return c.log.splice(i,1)[0];if(Date.now()-t0>ms)throw new Error('timeout waiting for '+types);await sleep(15)}}
const D=require('./brawl_data'),BREEDS=require('./breeds');
const rnd=n=>Math.floor(Math.random()*n),eq=(a,b)=>JSON.stringify(a)==JSON.stringify(b);

// Plays a whole brawl for client c (random mix of attacks, guards and skills) and checks on the way that every board the server shows
// is the previous board + the events it sent: HP, KO flags, damage dealt and my own energy.  opts.onAsk(m) may take over a round.
async function playBrawl(c,st,opts={}){
 const me=st.me,sk=st.pl[me].sk,out={rounds:0,bx:0,picks:0,bad:[],end:null};
 let hp=st.pl.map(p=>p.hp),al=st.pl.map(()=>1),en=st.pl.map(p=>p.en),dm=st.pl.map(()=>0),r=0,mv=null,enBefore=0;
 for(;;){
  const m=await nextOf(c,['mp_ba','mp_bx','mp_end']);
  if(m.t=='mp_end'){out.end=m;return out}
  if(m.t=='mp_ba'){out.rounds++;
   if(m.r!=r+1||m.n!=6||!(m.ms>0&&m.ms<=7000))out.bad.push('round header '+JSON.stringify([m.r,m.n,m.ms]));
   if(!eq(m.hp,hp)||!eq(m.al,al)||!eq(m.en,en)||!eq(m.dm,dm))out.bad.push('board at the start of round '+m.r+' differs from the last result');
   r=m.r;mv=null;enBefore=m.en[me];
   if(m.al[me]){
    const x=opts.onAsk&&await opts.onAsk(m);
    if(x){mv=x.mv;if(x.sent)out.picks++}
    if(!mv){const foes=m.al.map((a,i)=>a&&i!=me?i:-1).filter(i=>i>=0),aff=[0,1].filter(k=>D.SK[sk[k]].cost<=m.en[me]),q=Math.random();
     if(aff.length&&q<.5){const k=aff[rnd(aff.length)];mv={a:'s'+k,to:D.SK[sk[k]].tgt=='one'?foes[rnd(foes.length)]:-1}}
     else if(q<.62)mv={a:'grd'};else mv={a:'atk',to:foes[rnd(foes.length)]};
     c.send({t:'mp_bp',r:m.r,...mv});out.picks++}}
  }else{
   out.bx++;if(m.r!=r)out.bad.push('result of round '+m.r+' arrived during round '+r);
   const h2=hp.slice(),a2=al.slice(),d2=dm.slice();let lost=0,gain=0;
   for(const e of m.ev){
    if(e.k=='hit'){h2[e.t]=Math.max(0,h2[e.t]-e.d);d2[e.i]+=e.d}
    else if(e.k=='heal')h2[e.i]+=e.d;
    else if(e.k=='ko')a2[e.t]=0;
    else if(e.k=='steal'){if(e.t==me)lost+=e.n;if(e.i==me)gain+=e.n}}
   if(!eq(h2,m.hp))out.bad.push('HP after the events '+h2+' != '+m.hp+' (round '+m.r+')');
   if(!eq(a2,m.al))out.bad.push('KO flags '+a2+' != '+m.al);
   if(!eq(d2,m.dm))out.bad.push('damage dealt '+d2+' != '+m.dm);
   // my energy: pay for the skill, lose / gain stolen energy, +1 every round (+1 more for guarding), never above 5
   if(mv&&m.al[me]){const cost=mv.a[0]=='s'?D.SK[sk[+mv.a[1]]].cost:0,want=Math.min(5,enBefore-cost-lost+gain+1+(mv.a=='grd'?1:0));
    if(m.en[me]!=want)out.bad.push('my energy '+m.en[me]+' != '+want+' (round '+m.r+', '+mv.a+')')}
   hp=m.hp;al=m.al;en=m.en;dm=m.dm}}}

(async()=>{
 // ================= data sanity: every breed has its own power
 const tuples=new Set(BREEDS.map(b=>{const s=D.statsFor(b[0],b[2],b[6]);return[s.hp,s.atk,s.def,s.spd,s.sk.join()].join('/')}));
 ok(tuples.size>=40,'50 breeds give '+tuples.size+' different stat+skill combinations');
 ok(BREEDS.every(b=>{const s=D.statsFor(b[0],b[2],b[6]);return s.sk.length==2&&s.sk[0]!=s.sk[1]&&s.sk.every(k=>D.SK[k])}),'every breed owns two different, valid skills');

 // ================= Dog Brawl: one human + 2 bots
 const a=await reg('brawlA');
 a.send({t:'mp_find',g:'brawl',dog:a.dog});const lob=await a.wait('mp_lobby');ok(lob.g=='brawl'&&lob.max==4,'brawl lobby opens (max 4 dogs)');
 const st=await a.wait('mp_start',8000),me=st.me,mine=st.pl[me];
 ok(st.g=='brawl'&&st.pl.length==3&&st.pl.filter(p=>p.bot).length==2&&st.cfg.rounds==6&&st.cfg.qms==7000,'brawl starts: me + 2 bots, 6 rounds, 7 s to choose');
 ok(st.pl.every(p=>p.hp>=70&&p.atk>=15&&p.def>=1&&p.spd>=2&&p.en>=1&&Array.isArray(p.sk)&&p.sk.length==2&&p.sk.every(k=>D.SK[k])),'every dog arrives with HP / ATK / DEF / SPD, energy and 2 valid skills');
 const row=BREEDS.find(b=>b[0]==mine.breed),exp=D.statsFor(row[0],row[2],row[6]);
 ok(mine.hp==exp.hp&&mine.atk==exp.atk&&mine.def==exp.def&&mine.spd==exp.spd&&eq(mine.sk,exp.sk),'server stats = shared data for my dog ('+mine.breed+': '+mine.hp+'/'+mine.atk+'/'+mine.def+'/'+mine.spd+' '+mine.sk+')');
 a.send({t:'mp_bp',r:1,a:'atk',to:1});await sleep(200);ok(!a.last('mp_bok')&&!a.last('mp_bno'),'a move sent before the first round opens is ignored');
 const probe={};
 const fight=await playBrawl(a,st,{onAsk:async m=>{if(m.r!=1)return;
  const foe=[0,1,2].find(i=>i!=me);
  ok(m.hp.length==3&&m.en.length==3&&m.al.every(x=>x==1)&&m.st.length==3&&m.dm.every(x=>x==0),'round 1 opens with a full board (hp / energy / alive / status / damage)');
  // illegal moves: wrong round, unknown move, hitting myself, a target that does not exist, junk, no target at all
  a.send({t:'mp_bp',r:99,a:'atk',to:foe});a.send({t:'mp_bp',r:1,a:'nuke',to:foe});a.send({t:'mp_bp',r:1,a:'atk',to:me});a.send({t:'mp_bp',r:1,a:'atk',to:7});a.send({t:'mp_bp',r:1,a:{x:1},to:foe});a.send({t:'mp_bp',r:1,a:'atk'});a.send({t:'mp_bp',r:1,a:'atk',to:'1'});a.send({t:'mp_bp',r:1,a:'atk',to:1.5});
  await sleep(300);ok(!a.last('mp_bok'),'wrong round / unknown move / self-target / bad target / junk are all refused');
  probe.no=a.all('mp_bno');ok(probe.no.length>=4&&probe.no.every(x=>x.r==1&&x.why=='target'),'a refused target comes back as mp_bno so the client can unlock its buttons ('+probe.no.length+')');a.clear('mp_bno');
  // a skill I cannot pay for
  const costly=[0,1].find(k=>D.SK[mine.sk[k]].cost>m.en[me]);
  if(costly!==undefined){a.send({t:'mp_bp',r:1,a:'s'+costly,to:foe});const n=await a.wait('mp_bno',1500).catch(()=>null);ok(n&&n.why=='en','a skill without enough energy is refused (why = '+(n&&n.why)+')')}else ok(true,'(both skills affordable in round 1)');
  // a real move is accepted exactly once
  a.send({t:'mp_bp',r:1,a:'atk',to:foe});await a.wait('mp_bok',1500);a.send({t:'mp_bp',r:1,a:'grd'});a.send({t:'mp_bp',r:1,a:'atk',to:foe});await sleep(250);
  ok(a.all('mp_bok').length==0,'only the first move of a round counts');
  return{sent:true,mv:{a:'atk',to:foe}}}});
 const end=fight.end;
 ok(fight.bad.length==0,'every board matches the events that led to it over '+fight.rounds+' rounds / '+fight.bx+' results'+(fight.bad.length?': '+fight.bad.slice(0,3).join(' | '):''));
 ok(fight.rounds>=2&&fight.rounds<=6&&fight.bx==fight.rounds,'between 2 and 6 rounds were played ('+fight.rounds+'), each one resolved once');
 ok(end.g=='brawl'&&end.res.length==3&&end.me.rank>=1&&end.me.rank<=3,'the fight ends with results (my rank '+end.me.rank+')');
 ok(new Set(end.res.map(r=>r.rank)).size==3&&end.res.every(r=>typeof r.score=='number'&&r.score>=0),'ranks are distinct, score = damage dealt: '+end.res.map(r=>r.rank+':'+r.score).join(' '));
 ok(end.me.vsHuman===false&&end.me.coins>=0&&end.me.coins<=30,'a fight against bots pays half ('+end.me.coins+' coins)');
 ok(end.res.filter(r=>r.rank==1).length==1,'there is exactly one winner');

 // ================= guarding: +1 extra energy, the guard shows up in the events, leaving frees the player at once
 const g=await reg('brawlG');g.send({t:'mp_find',g:'brawl',dog:g.dog});const gs=await g.wait('mp_start',8000);let gx=null;
 let gen=0;   // the bots' "Bone Thief" skill may take up to 2 energy from me before the end-of-round regen, so every round is checked against the energy I had when asked, minus what was stolen
 let gright=true,gnote=[];
 for(let i=0;i<2;i++){const m=await nextOf(g,['mp_ba']);gen=m.en[gs.me];g.send({t:'mp_bp',r:m.r,a:'grd'});gx=await nextOf(g,['mp_bx']);
  const stolen=gx.ev.filter(e=>e.k=='steal'&&e.t==gs.me).reduce((n,e)=>n+e.n,0),gained=gx.ev.filter(e=>e.k=='steal'&&e.i==gs.me).reduce((n,e)=>n+e.n,0);
  if(!gx.ev.some(e=>e.k=='act'&&e.i==gs.me&&e.a=='grd'))gright=false;                                  // my guard must show up in the events
  if(gx.al[gs.me]&&gx.en[gs.me]!==Math.min(5,Math.min(6,Math.max(0,gen-stolen)+gained)+2))gright=false;    // en' = min(5, (en - stolen) + 1 regen + 1 for guarding)
  gnote.push(gen+(stolen?'-'+stolen:'')+' -> '+gx.en[gs.me])}
 ok(gright,'a guarding player gets +2 energy a round, minus anything a bot stole (energy '+gnote.join(', then ')+')');
 g.send({t:'mp_leave'});await sleep(300);g.clear();g.send({t:'mp_find',g:'brawl',dog:g.dog});const gl=await g.wait('mp_lobby',2000).catch(()=>null);ok(!!gl,'after leaving a fight the player can queue again straight away');
 g.send({t:'mp_cancel'});await sleep(1700);ok(!g.last('mp_start'),'cancelling the queue really leaves it');

 // ================= a player who never answers is played automatically and the fight goes on
 const idle=await reg('brawlI');idle.send({t:'mp_find',g:'brawl',dog:idle.dog});const is=await idle.wait('mp_start',8000);
 const t0=Date.now();await nextOf(idle,['mp_ba']);const ix=await nextOf(idle,['mp_bx']);
 ok(ix.r==1&&ix.ev.some(e=>e.k=='act'&&e.i==is.me&&e.a=='atk'),'a silent player gets an automatic attack when the time is up ('+Math.round((Date.now()-t0)/100)/10+' s)');
 const i2=await nextOf(idle,['mp_ba']);ok(i2.r==2,'the fight continues with round 2');idle.send({t:'mp_leave'});

 // ================= two humans: one room, no bots, same events for both
 const h1=await reg('brawlH1'),h2=await reg('brawlH2');h1.send({t:'mp_find',g:'brawl',dog:h1.dog});h2.send({t:'mp_find',g:'brawl',dog:h2.dog});
 const s1=await h1.wait('mp_start',8000),s2=await h2.wait('mp_start',8000);
 ok(s1.pl.length==2&&s1.pl.every(p=>!p.bot)&&s1.me!=s2.me&&s1.id==s2.id,'two humans share one brawl room without bots');
 const q1=await nextOf(h1,['mp_ba']),q2=await nextOf(h2,['mp_ba']);ok(q1.r==1&&q2.r==1&&eq(q1.hp,q2.hp),'both see round 1');
 h1.send({t:'mp_bp',r:1,a:'atk',to:1-s1.me});h2.send({t:'mp_bp',r:1,a:'grd'});
 const y1=await nextOf(h1,['mp_bx']),y2=await nextOf(h2,['mp_bx']);ok(eq(y1.ev,y2.ev)&&eq(y1.hp,y2.hp),'both humans receive exactly the same events');
 ok(y1.ev.some(e=>e.k=='act'&&e.a=='grd'&&e.i==s2.me),'the guard is in the events');
 await nextOf(h2,['mp_ba']);h2.send({t:'mp_leave'});const t1=Date.now();
 const gone=await nextOf(h1,['mp_gone']);ok(gone.n==h2.name,'the other player is told who left');
 const he=await nextOf(h1,['mp_end'],6000);ok(Date.now()-t1<2000,'the fight ends right away when the opponent leaves in the middle of a round ('+(Date.now()-t1)+' ms)');
 ok(he.me.rank==1&&he.me.vsHuman===true&&he.res.find(r=>r.n==h2.name).left===true&&he.res.find(r=>r.n==h2.name).rank==2,'the player who stays wins; the leaver is marked as left');
 await sleep(300);ok(!h2.last('mp_end'),'the leaver gets no result screen');
 // leaving while the events play (between rounds)
 const k1=await reg('brawlK1'),k2=await reg('brawlK2');k1.send({t:'mp_find',g:'brawl',dog:k1.dog});k2.send({t:'mp_find',g:'brawl',dog:k2.dog});
 const ks1=await k1.wait('mp_start',8000);await k2.wait('mp_start',8000);await nextOf(k1,['mp_ba']);await nextOf(k2,['mp_ba']);
 k1.send({t:'mp_bp',r:1,a:'atk',to:1-ks1.me});k2.send({t:'mp_bp',r:1,a:'atk',to:ks1.me});await nextOf(k1,['mp_bx']);k2.send({t:'mp_leave'});
 const ke=await nextOf(k1,['mp_end'],8000);ok(ke.me.rank==1&&ke.res.some(r=>r.left),'leaving between two rounds also ends the fight for the other player');
 // closing the browser before the first round
 const c1=await reg('brawlC1'),c2=await reg('brawlC2');c1.send({t:'mp_find',g:'brawl',dog:c1.dog});c2.send({t:'mp_find',g:'brawl',dog:c2.dog});
 await c1.wait('mp_start',8000);await c2.wait('mp_start',8000);c2.ws.close();
 const ce=await nextOf(c1,['mp_end'],9000);ok(ce.me.rank==1&&ce.res.some(r=>r.left),'a player who closes the page during the countdown forfeits; the other one wins');
 // ================= lobby info
 h1.send({t:'mp_get'});const inf=await h1.wait('mp_info');ok('brawl' in inf.wait&&'rps' in inf.wait,'mp_info lists the brawl and the rock-paper-scissors queues');

 // ================= Rock-Paper-Scissors: bot fallback
 const r1c=await reg('rpsA');r1c.send({t:'rps_find'});await r1c.wait('rps_wait',2000);ok(true,'rps: waiting for an opponent');
 const rs=await r1c.wait('rps_start',6000);ok(rs.bot==1&&/^🤖/.test(rs.vs),'rps: nobody came, so a bot opponent starts the match ('+rs.vs+')');
 r1c.send({t:'rps_pick',v:'Z'});r1c.send({t:'rps_pick',v:'R'});const rr=await r1c.wait('rps_result',6000);
 ok(['R','P','S'].includes(rr.op)&&rr.my=='R'&&[-1,0,1].includes(rr.r)&&rr.bot==1,'rps: result against the bot (my R vs '+rr.op+' -> '+rr.r+')');
 ok(rr.gain==(rr.r>0?15:rr.r==0?3:0),'rps: a bot match pays half ('+rr.gain+' coins)');
 // cancelling while waiting: the bot must not join afterwards
 const r2c=await reg('rpsB');r2c.send({t:'rps_find'});await r2c.wait('rps_wait',2000);r2c.send({t:'rps_cancel'});await sleep(2200);ok(!r2c.last('rps_start'),'rps: cancelling stops the bot from joining');
 // two humans meet: a real match with the normal reward
 const p1=await reg('rpsC'),p2=await reg('rpsD');p1.send({t:'rps_find'});await p1.wait('rps_wait',2000);p2.send({t:'rps_find'});
 const m1=await p1.wait('rps_start',3000),m2=await p2.wait('rps_start',3000);ok(m1.vs==p2.name&&m2.vs==p1.name&&!m1.bot,'rps: two humans are matched with each other');
 await sleep(1500);ok(!p1.last('rps_result'),'rps: the pending bot timer did not hijack the human match');
 p1.send({t:'rps_pick',v:'R'});p2.send({t:'rps_pick',v:'S'});const o1=await p1.wait('rps_result',3000),o2=await p2.wait('rps_result',3000);
 ok(o1.r==1&&o2.r==-1&&o1.gain==30&&o2.gain==0&&o1.bot==0,'rps: rock beats scissors, the winner gets the full 30 coins');
 console.log(`\nPASS ${pass} FAIL ${fail}`);process.exit(fail?1:0);
})().catch(e=>{console.log('FAIL fatal',e);process.exit(1)});
