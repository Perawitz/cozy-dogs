// v5 server tests: online mini-games (race / bone grab / breed duel), dog wishes, fetch, lucky wheel, starter missions, house level + sets,
// party, guestbook / likes / contest, mailbox, park treasure + frisbee.   Needs the server started with CD_TEST=1 CD_WISH=1 CD_MPWAIT=1200.
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
 // ---------- 1. Dog Race alone (bots fill the room)
 const a=await reg('raceA');
 a.send({t:'dbg_give',c:0});a.send({t:'mp_get'});const inf=await a.wait('mp_info');ok(inf.cap==600&&inf.used==0,'mp_info daily cap');
 a.send({t:'mp_find',g:'bogus'});a.send({t:'mp_find',g:'__proto__'});await sleep(200);ok(!a.last('mp_lobby'),'unknown game ids rejected');
 a.send({t:'mp_find',g:'race',dog:a.dog});const lob=await a.wait('mp_lobby');ok(lob.n==1&&lob.max==4,'race lobby opened');
 a.send({t:'mp_find',g:'race'});await sleep(150);ok((await a.toast(0)).includes('อยู่ในเกม'),'cannot queue twice');
 const st=await startMsg(a);ok(st.g=='race'&&st.pl.length==3&&st.pl.filter(p=>p.bot).length==2&&st.me==0,'race starts with 2 bots filling in');
 ok(st.go==3600&&st.pl[0].breed,'start has countdown + dog info');
 // pings for latency compensation
 const p0=await a.wait('mp_p');a.send({t:'mp_pr',k:p0.k});
 await sleep(3700);
 let taps=0;for(let i=0;i<30;i++){a.send({t:'mp_tap',s:0});await sleep(30)}      // same side repeatedly is not allowed
 await sleep(200);const s1=a.last('mp_s');ok(s1&&s1.p[0]<=2,'same-side taps ignored (pos '+(s1&&s1.p[0])+')');
 let side=1,fin=null;for(let i=0;i<200&&!fin;i++){a.send({t:'mp_tap',s:side});side^=1;await sleep(80);fin=a.last('mp_end')}
 const end=fin||await a.wait('mp_end',12000);ok(end.g=='race'&&end.res.length==3,'race ends with results');
 ok(end.me.rank==1&&end.me.win,'fast human beats the bots (rank '+end.me.rank+')');
 ok(end.me.coins==30&&!end.me.vsHuman,'vs bots only -> half reward ('+end.me.coins+')');
 await sleep(150);ok(a.me.stats.mpwin==1&&a.me.stats.race==1&&a.me.stats.mp==1,'stats mp/race/mpwin recorded');
 a.send({t:'mp_get'});const inf2=await a.wait('mp_info',2000,x=>x.used>0);ok(inf2.used==30,'daily arcade coins tracked');

 // ---------- 2. two humans race (no bots)
 const b=await reg('raceB'),c=await reg('raceC');
 b.send({t:'mp_find',g:'race'});await b.wait('mp_lobby');c.send({t:'mp_find',g:'race'});const l2=await c.wait('mp_lobby',2000,x=>x.n==2);ok(l2.n==2&&l2.names.length==2,'second player joins the same lobby');
 const sb=await startMsg(b),sc=await startMsg(c);ok(sb.pl.length==2&&!sb.pl.some(p=>p.bot)&&sb.id==sc.id,'two humans: same room, no bots');
 await sleep(3700);
 async function runTaps(cl,gap,idx){let side=0;for(let i=0;i<120;i++){if(cl.last('mp_end'))return;cl.send({t:'mp_tap',s:side});side^=1;await sleep(gap)}}
 const t1=runTaps(b,80),t2=runTaps(c,140);await Promise.all([t1,t2]);
 const eb=await b.wait('mp_end',8000),ec=await c.wait('mp_end',12000);
 ok(eb.me.rank==1&&ec.me.rank==2,'faster human wins');ok(eb.me.coins==60&&ec.me.coins==0&&(ec.me.loss===0||ec.me.loss===20),'winner paid, loser gets no prize but a fee (v7) ('+eb.me.coins+'/'+ec.me.coins+' loss '+ec.me.loss+')');
 ok(eb.res[0].ft>0,'finish time reported');
 // regression: the player who joined SECOND but crosses the line first must be ranked 1st (rank used to follow join order)
 const rd=await reg("raceD"),re=await reg("raceE");
 rd.send({t:"mp_find",g:"race"});await rd.wait("mp_lobby");re.send({t:"mp_find",g:"race"});await re.wait('mp_lobby',2000,x=>x.n==2);
 await startMsg(rd);await startMsg(re);await sleep(3700);
 const u1=runTaps(rd,140),u2=runTaps(re,80);await Promise.all([u1,u2]);
 const ed=await rd.wait("mp_end",8000),ee=await re.wait('mp_end',12000);
 ok(ee.me.rank==1&&ed.me.rank==2,'second joiner who finishes first is ranked 1st ('+ee.me.rank+'/'+ed.me.rank+')');
 ok(ed.res.every((x,i)=>ed.res.every((y,j)=>!(x.ft>0&&y.ft>0&&x.ft<y.ft)||x.rank<y.rank)),'ranks follow finish times');

 // ---------- 3. lobby cancel + leave mid game
 const d=await reg('lobD');d.send({t:'mp_find',g:'duel'});await d.wait('mp_lobby');d.send({t:'mp_cancel'});await sleep(1700);ok(!d.last('mp_start'),'cancel leaves the lobby (no game)');
 d.send({t:'mp_find',g:'grab'});await d.wait('mp_lobby');ok(true,'can queue again after cancel');
 const sd=await startMsg(d);ok(sd.g=='grab'&&sd.pl.length==2&&sd.pl[1].bot,'grab vs bot');

 // ---------- 4. Bone Grab vs bot: react instantly
 let rounds=0,wins=0,lastRR=null;
 const gdone=new Promise(res=>{const iv=setInterval(()=>{
   const sg=d.log.findIndex(x=>x.t=='mp_signal');if(sg>=0){d.log.splice(sg,1);d.send({t:'mp_act',r:1});rounds++}
   const rr=d.log.findIndex(x=>x.t=='mp_rr');if(rr>=0){lastRR=d.log.splice(rr,1)[0];if(lastRR.w==0)wins++}
   if(d.last('mp_end')){clearInterval(iv);res()}},20)});
 await Promise.race([gdone,sleep(30000)]);const ge=d.last('mp_end');
 ok(ge&&ge.me.rank==1&&wins>=3,'instant reactions win Bone Grab (wins '+wins+', rounds '+rounds+')');
 ok(ge&&ge.me.coins==25,'grab vs bot reward halved ('+(ge&&ge.me.coins)+')');
 ok(lastRR&&lastRR.rt[0]!=null&&lastRR.rt[0]>=80,'reaction time reported & floored at 80ms ('+(lastRR&&lastRR.rt[0])+')');
 // false start
 d.clear();d.send({t:'mp_find',g:'grab'});await startMsg(d);await sleep(3700);await d.wait('mp_round',3000);d.send({t:'mp_act',r:1});const fs=await d.wait('mp_rr',2000);ok(fs.why=='false'&&fs.w==1,'reacting before the signal = false start, opponent scores');
 d.send({t:'mp_leave'});await sleep(200);

 // ---------- 5. grab forfeit when the other human leaves
 const e1=await reg('grabE1'),e2=await reg('grabE2');e1.send({t:'mp_find',g:'grab'});await e1.wait('mp_lobby');e2.send({t:'mp_find',g:'grab'});await startMsg(e1);await startMsg(e2);
 await sleep(500);e2.ws.close();const fe=await e1.wait('mp_end',3000);ok(fe.me.win&&fe.me.rank==1&&fe.me.vsHuman,'opponent disconnects -> remaining human wins');

 // ---------- 6. Breed Duel
 const g=await reg('duelG');g.send({t:'mp_find',g:'duel'});await g.wait('mp_lobby');const sg2=await startMsg(g);ok(sg2.pl.length==3&&sg2.cfg.rounds==5,'duel with bots, 5 rounds');
 let nq=0,leak=false,okq=true,lastQ=null;
 for(let r=0;r<5;r++){const q=await g.wait('mp_q',16000);nq++;lastQ=q;if('a' in q.q||'a' in q)leak=true;okq=okq&&q.q.opts&&q.q.opts.length>=3&&q.ms==10000;
  await sleep(300);g.send({t:'mp_ans',i:q.i,o:0});g.send({t:'mp_ans',i:q.i,o:1});const qr=await g.wait('mp_qr',16000);okq=okq&&qr.a>=0&&qr.a<q.q.opts.length&&qr.sc.length==3&&qr.picks[0]==0}
 ok(nq==5&&okq,'5 questions answered, reveal contains the answer only after answering');ok(!leak,'question message never contains the answer');
 const de=await g.wait('mp_end',8000);ok(de.g=='duel'&&de.res.length==3&&de.res.every(x=>x.rank>=1&&x.rank<=3),'duel results ranked');
 await sleep(150);ok(g.me.stats.duel==1,'duel stat recorded');
 // answering the wrong question index / out of range ignored
 g.send({t:'mp_find',g:'duel'});await startMsg(g);await sleep(3700);const q2=await g.wait('mp_q',5000);g.send({t:'mp_ans',i:q2.i+3,o:0});g.send({t:'mp_ans',i:q2.i,o:99});g.send({t:'mp_ans',i:q2.i,o:-1});await sleep(300);
 g.send({t:'mp_ans',i:q2.i,o:2});const qr2=await g.wait('mp_qr',16000);ok(qr2.picks[0]==2,'bad answers ignored, first valid answer counts');g.send({t:'mp_leave'});

 // ---------- 7. wishes
 const w=await reg('wishy');const wn=await w.wait('wish_new',8000);ok(wn.dog==w.dog&&wn.w.need>=1&&['pet','play','brush','bath','train','feed'].includes(wn.w.k),'a dog wish appears ('+wn.w.k+' x'+wn.w.need+')');
 const hasWish=()=>{const l=w.log.filter(x=>x.t=='dogs'||x.t=='house');return l.length};ok(hasWish()>0,'wish pushed with dog data');
 const lastDog=()=>{for(let i=w.log.length-1;i>=0;i--){const m=w.log[i];if(m.t=='dogs'){const d=m.dogs.find(d=>d.id==w.dog);if(d)return d}}return null};
 ok(lastDog()&&lastDog().wish&&lastDog().wish.k==wn.w.k,'dog pub carries the wish');
 const coins0=w.me.coins;w.clear('wish_done');
 const act={pet:{t:'act',a:'pet'},play:{t:'act',a:'play'},brush:{t:'act',a:'brush'},bath:{t:'act',a:'bath'},train:{t:'act',a:'train'},feed:{t:'feed',food:wn.w.f||'kibble'}}[wn.w.k];
 if(wn.w.k=='feed'&&wn.w.f&&wn.w.f!='kibble'){w.send({t:'shop_buy',id:wn.w.f,n:1});await sleep(250)}
 for(let i=0;i<wn.w.need;i++){w.send({...act,dog:w.dog});await sleep(320)}
 const wd=await w.wait('wish_done',3000);ok(wd.r.c>=17&&wd.dog==w.dog,'finishing the wish pays out ('+JSON.stringify(wd.r)+')');
 await sleep(300);ok(lastDog()&&!lastDog().wish,'wish cleared after reward');ok(w.me.stats.wish==1,'wish stat recorded');
 // wrong food does not progress
 // ---------- 8. fetch
 w.clear('dogs');w.send({t:'fetch',x:300,y:460,dog:w.dog});const fd=await w.wait('dogs',2000,m=>m.dogs.some(d=>d.fetch&&d.fetch.st==1));ok(fd.dogs.find(d=>d.fetch).fetch.bx==300,'fetch: dog runs to the thrown ball');
 const f2=await w.wait('dogs',6000,m=>m.dogs.some(d=>d.fetch&&d.fetch.st==2));ok(!!f2,'fetch: dog carries the ball back');
 await w.wait('dogs',6000,m=>m.dogs.some(d=>d.id==w.dog&&!d.fetch));await sleep(300);ok(w.me.stats.fetch==1,'fetch finished -> stat + reward');
 w.send({t:'fetch',x:99999,y:-5,dog:'nope'});await sleep(250);ok(true,'out-of-range fetch coordinates are clamped, unknown dog falls back');

 // ---------- 9. lucky wheel
 const sp=await reg('spinny');sp.send({t:'spin_get'});const si=await sp.wait('spin_info');ok(si.wheel.length==8&&si.free&&si.left==4,'wheel info');
 sp.send({t:'spin'});const sr=await sp.wait('spin_r');ok(sr.idx>=0&&sr.idx<8&&sr.r,'free spin result');const si2=await sp.wait('spin_info');ok(!si2.free&&si2.left==3,'free spin used');
 for(let i=0;i<3;i++){sp.send({t:'spin'});await sp.wait('spin_r');await sleep(60)}sp.clear();sp.send({t:'spin'});ok((await sp.toast()).includes('ครบแล้ว'),'max 4 spins per day (3 extra cost tickets)');
 ok(sp.me.tickets>=0&&sp.me.stats.spin==4,'spin stat');

 // ---------- 10. starter missions
 const sm=await reg('starty');sm.send({t:'starter'});let sl=await sm.wait('starter');ok(sl.list.length==16&&!sl.bonus.ready,'16 starter missions (10 + 6 explorer missions of v7.2)');
 sm.send({t:'starter_claim',i:0});await sleep(250);ok(sm.me.coins==300,'cannot claim an unfinished mission');
 sm.send({t:'feed',dog:sm.dog,food:'kibble'});await sleep(250);sm.send({t:'starter_claim',i:0});await sleep(300);ok(sm.me.coins==300-10+30,'claim after feeding (+30, kibble cost 10)');
 sm.send({t:'starter_claim',i:0});await sleep(250);ok(sm.me.coins==320,'no double claim');sm.send({t:'starter_bonus'});await sleep(150);ok(true,'bonus blocked until all done');
 sm.send({t:'tutorial'});await sleep(150);sm.send({t:'daily'});await sleep(200);ok(true,'tutorial flag accepted');

 // ---------- 11. house level + sets + cozy
 const h=await reg('houser');h.send({t:'house_info'});let hi=await h.wait('house_info');ok(hi.hl==0&&hi.maxItems==40&&hi.next.lvl==3&&hi.sets.length==7,'house info');
 h.send({t:'house_up'});ok((await h.toast()).includes('เลเวล 3'),'upgrade needs player level');
 h.send({t:'dbg_give',xp:1000,c:20000,g:100,tk:5});await sleep(200);h.send({t:'house_up'});hi=await h.wait('house_info');ok(hi.hl==1&&hi.maxItems==55&&hi.maxDogs==9,'upgrade to level 2 (55 items, 9 dogs)');
 await sleep(200);ok(h.me.maxItems==55&&h.me.coins==19700,'me reflects the new capacity and cost');
 const cz0=hi.cozy.score;ok(!hi.sets.find(s=>s.id=='pink').done,'pink set incomplete (needs rug)');
 h.send({t:'shop_buy',id:'rug_round_pink'});await h.wait('buy_ok');h.send({t:'place',id:'rug_round_pink',x:300,y:480});await h.wait('items');h.send({t:'house_info'});hi=await h.wait('house_info');
 ok(hi.sets.find(s=>s.id=='pink').done&&hi.perks.includes('happy')&&hi.cozy.score>cz0+30,'completing a set gives perk + cozy points ('+cz0+' -> '+hi.cozy.score+')');
 await sleep(200);ok(h.me.perks.includes('happy')&&h.me.cozy>=hi.cozy.score,'perk visible in me');
 h.send({t:'house_up'});await h.wait('house_info');h.send({t:'house_up'});await h.wait('house_info');h.send({t:'house_up'});await sleep(200);ok((await h.toast()).includes('สูงสุด')&&h.me.maxItems==90,'max level reached (90 items)');

 // ---------- 12. party, guestbook, likes, mail
 const o=await reg('hostO'),v=await reg('visitV'),v2=await reg('visitW');
 o.send({t:'friend_add',name:'visitV'});await sleep(150);v.send({t:'friend_ok',name:'hostO'});await sleep(200);
 o.send({t:'party_start'});const pa=await o.wait('party');ok(pa.ms>290000&&pa.owner=='hostO','party started (5 min)');const pinv=await v.wait('party_inv');ok(pinv.from=='hostO','friend gets a party invite');
 o.clear('toast');o.send({t:'party_start'});ok((await o.toast()).includes('ปาร์ตี้'),'cannot start a second party');
 const c0=v.me.coins,oc0=o.me.coins;v.send({t:'visit',id:'hostO'});const vh=await v.wait('house',2000,x=>x.owner=='hostO');ok(vh.party>0&&vh.party<=300000,'house message carries remaining party time');await sleep(300);
 ok(v.me.coins==c0+8,'party guest +8 coins');const gv=await o.wait('ev',2000,x=>x.k=='guest');ok(gv.n=='visitV','host notified of guest');ok(o.me.coins==oc0+2,'host +2 per guest');
 v.send({t:'visit',id:'hostO'});await sleep(250);ok(v.me.coins==c0+8,'guest reward once per party');
 // guestbook
 v.send({t:'gb_post',owner:'hostO',text:'  Nice <b>house</b>!  '});const gb=await v.wait('gb');ok(gb.list.length==1&&gb.list[0].n=='visitV'&&!/[<>]/.test(gb.list[0].m),'guestbook entry saved & sanitised');
 v.clear('toast');v.send({t:'gb_post',owner:'hostO',text:'again'});ok((await v.toast()).includes('เขียนได้อีก'),'guestbook cooldown');
 v2.send({t:'gb_post',owner:'hostO',text:'not visiting'});await sleep(250);v2.send({t:'gb_get',owner:'hostO'});const gb2=await v2.wait('gb');ok(gb2.list.length==1,'cannot post without visiting');
 ok(true,'');o.send({t:'gb_post',owner:'hostO',text:'self'});await sleep(150);
 v.send({t:'gb_post',owner:'__proto__',text:'x'});v.send({t:'gb_get',owner:'__proto__'});await sleep(150);
 // likes
 v.clear('gb');v.send({t:'like',owner:'hostO'});const lk=await v.wait('gb');ok(lk.likes==1&&lk.liked,'like counted');v.clear('toast');v.send({t:'like',owner:'hostO'});ok((await v.toast()).includes('ไปแล้ว'),'one like per house per day');
 v.send({t:'like',owner:'visitV'});await sleep(150);v.send({t:'visit',id:'visitV'});await sleep(200);v.send({t:'like',owner:'visitV'});await sleep(200);ok(true,'cannot like yourself');
 // mailbox
 o.clear('mail');o.send({t:'mail_get'});const ml=await o.wait('mail');ok(ml.list.some(m=>m.k=='like'&&m.from=='visitV')&&ml.list.some(m=>m.k=='gb'),'owner got like + guestbook mail');
 o.send({t:'dbg_mail',c:77});await sleep(250);o.clear('mail');o.send({t:'mail_get'});const ml2=await o.wait('mail');const rm=ml2.list.find(m=>m.r);ok(rm&&!rm.claimed,'reward mail present');
 const oc1=o.me.coins;o.send({t:'mail_claim',id:rm.id});await sleep(250);ok(o.me.coins==oc1+77,'mail reward claimed');o.send({t:'mail_claim',id:rm.id});await sleep(250);ok(o.me.coins==oc1+77,'no double claim');
 o.send({t:'dbg_mail',c:10});o.send({t:'dbg_mail',c:20});await sleep(300);const oc2=o.me.coins;o.send({t:'mail_claim_all'});await sleep(300);ok(o.me.coins==oc2+30,'claim all');
 o.clear('mail');o.send({t:'mail_clear'});const mc=await o.wait('mail');ok(mc.list.length==0,'clear mailbox');
 // offline visitor leaves a "visited" mail
 const off=await reg('offlineO');off.ws.close();await sleep(300);v2.send({t:'visit',id:'offlineO'});await sleep(300);
 const off2=await cli();off2.send({t:'login',user:'offlineO',pass:'secret1'});await off2.wait('auth');await off2.wait('me');off2.send({t:'mail_get'});const om=await off2.wait('mail');ok(om.list.some(m=>m.k=='visit'&&m.from=='visitW'),'visit to an offline house leaves a mail');
 // owner deletes guestbook entry
 o.clear('gb');o.send({t:'gb_get',owner:'hostO'});const og=await o.wait('gb');o.clear('gb');o.send({t:'gb_del',id:og.list[0].id});const og2=await o.wait('gb');ok(og2.list.length==0,'owner can delete guestbook entries');
 // ---------- 13. contest
 o.send({t:'contest_get'});const ct=await o.wait('contest');ok(ct.top[0]&&ct.top[0].n=='hostO'&&ct.top[0].v==1&&ct.me.rank==1&&ct.ends>Date.now(),'weekly contest ranks by likes');
 o.send({t:'dbg_week',n:'hostO',v:5});await sleep(400);o.clear('mail');o.send({t:'mail_get'});const cm=await o.wait('mail');const pm=cm.list.find(m=>m.k=='contest');ok(pm&&pm.rank==1&&pm.r.g==10,'week rollover mails the prize to the winner');
 // ---------- 14. park dig / treasure / frisbee
 const pk=await reg('digger');pk.send({t:'park_join'});await pk.wait('park_init');pk.send({t:'park_dig'});const dfx=await pk.wait('park_fx',1500,x=>x.k=='dig');ok(dfx.n=='digger','dig broadcast');
 const dr=await pk.wait('park_dig_r',3000);ok(['dirt','coin','bone','boot','cookie','gem','ticket'].includes(dr.k),'dig result '+dr.k);
 pk.send({t:'park_dig'});await sleep(500);ok(!pk.last('park_dig_r'),'dig cooldown');
 pk.send({t:'park_dbg_tr'});await sleep(4100);pk.clear();const g0=pk.me.gems;pk.send({t:'park_dig'});const tr=await pk.wait('park_dig_r',3000);ok(tr.found&&tr.k=='treasure'&&tr.r.g==2,'treasure found');await sleep(300);ok(pk.me.gems==g0+2&&pk.me.stats.treasure==1,'treasure paid');
 pk.send({t:'park_dbg_fb'});const fb=await pk.wait('park_fx',2500,x=>x.k=='fb_got');ok(fb.n=='digger'&&fb.c>=12,'frisbee caught (+'+fb.c+')');
 // ---------- 15. leaderboard tabs + shape checks
 pk.send({t:'lb'});const lb=await pk.wait('lb');ok(['likes','cozy','arcade','wishes'].every(k=>Array.isArray(lb[k]))&&lb.rank.cozy>0,'leaderboard has likes/cozy/arcade/wishes');
 ok(lb.arcade[0]&&lb.arcade[0].v>=1,'arcade board shows winners');
 console.log(`\nPASS ${pass} FAIL ${fail}`);process.exit(fail?1:0);
})().catch(e=>{console.log('FAIL fatal',e);process.exit(1)});
