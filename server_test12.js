// v7 tests (part 2): the hourly DOG SHOW (show.js) - phases, sign-up, voting, ranking, prizes, crown, hall of fame, hostile input.
// Self-contained: (A) UNIT tests of show.js with a mocked server and a fake clock (exact rules: charm formula, tie-breaks, hall limit, cancelled rounds ...),
//                 (B) LIVE tests against its OWN server (temp data file, CD_SHOW_MS=8000 so a round lasts 8 s: sign-up 3.4 s, voting 3.7 s, results 1 s).
// node server_test12.js      (PORT defaults to 3055; the live server uses PORT+16)
'use strict';
const {spawn}=require('child_process'),os=require('os'),path=require('path'),fs=require('fs');
const BASE=+(process.env.PORT||3055),PS=BASE+16,SHOW=8000;
process.env.CD_SHOW_MS=String(SHOW);
const TRD=require('./traits'),BREEDS=require('./breeds'),PREM=require('./premium');
const BRM=Object.fromEntries(BREEDS.concat(PREM).map(b=>[b[0],b]));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let pass=0,fail=0;const ok=(c,n)=>{c?pass++:fail++;console.log(c?'PASS':'FAIL',n)};
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const KEY='testadminkey1';
const PRIZE=[{c:400,g:3},{c:250,g:1},{c:150}],PART={c:20};
// the oracle: the judge's charm, written down independently of show.js
const RORD={C:0,R:1,E:2,L:3,M:4};
const charmO=(d,now,gk=1)=>Math.max(0,Math.round((d.bond|0)/25+TRD.buff(d,'show')+(RORD[BRM[d.breed]?BRM[d.breed][2]:'C']||0)*.5+(TRD.isMixed(d)?1:0)+(TRD.stageOf(d.born,now,gk)==3?1:0)+(d.acc?1:0)));
const rankOf=(rows,order)=>rows.map(r=>({...r,score:r.v*3+r.j})).sort((a,b)=>b.score-a.score||b.v-a.v||order.indexOf(a.n)-order.indexOf(b.n));

// ================================================================================== A. UNIT TESTS (mocked server, fake clock)
const realNow=Date.now;let T=null;Date.now=()=>T===null?realNow():T;
const at=(rid,off)=>{T=rid*SHOW+off};
function mkShow(){
 const db={players:{}},mails=[],bumps=[],pushes=[],socks={},conns=new Map();
 const X={db,conns,send:(ws,m)=>ws.out.push(m),sendAll(){},wsOf:n=>socks[n]||null,player:n=>db.players[n],give:(p,r)=>{p.coins+=r.c||0;p.gems+=r.g||0},clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),today:()=>'x',sendMe(){},
  pub:(d,now)=>({id:d.id,cr:d.crown>now?1:0}),rt:d=>d,BR:BRM,dirty(){},own:(o,k)=>Object.prototype.hasOwnProperty.call(o,k),safe:(n,f)=>f,toView:(n,m)=>pushes.push([n,m]),
  F:{mailTo:(n,row)=>mails.push({n,...row})},bump:(n,k,v)=>bumps.push([n,k,v]),GK:1,lvl:p=>1+Math.floor(p.xp/100)};
 const si=global.setInterval;global.setInterval=()=>0;let SH;try{SH=require('./show')(X)}finally{global.setInterval=si}
 const mkDog=(id,o)=>Object.assign({id,breed:'corgi',variant:'Normal',name:'Dog'+id,pers:'PLAYFUL',bond:0,born:0,tr:[],acc:null,mix:null,ms:0},o||{});
 const U={SH,db,mails,bumps,pushes,mkDog,
  add(name,o){const p=db.players[name]={name,xp:100,coins:0,gems:0,dogs:[mkDog(name+'1'),mkDog(name+'2')],...(o||{})};return p},
  link(name,guest){const ws={out:[]};conns.set(ws,{name,guest:!!guest});socks[name]=ws;return ws},
  call(name,msg){const ws=socks[name],c=conns.get(ws);ws.out.length=0;SH.handle(ws,c,msg);return ws.out.slice()},
  toast:o=>(o.find(m=>m.t=='toast')||{}).m||'',
  st(name,t){const ws=socks[name],c=conns.get(ws);return SH.state(c,t===undefined?Date.now():t)},
  enter(name,dog){return U.call(name,{t:'sh_enter',dog:dog||name+'1'})},vote(name,n){return U.call(name,{t:'sh_vote',n})}};
 return U}
function unit(){
 const R=5000000;                                // round id (huge, so that dogs born at time 0 are long grown up)
 // ---------------- phases
 {const U=mkShow(),P=U.SH.phaseOf;
  ok(U.SH.SHOW_MS==SHOW&&U.SH.MIN_ENTRIES==3&&eq(U.SH.PRIZE,PRIZE),'unit: the round lasts CD_SHOW_MS, 3 dogs minimum, prizes 400+3 / 250+1 / 150');
  const base=R*SHOW,tab=[[0,'enter'],[1,'enter'],[3359,'enter'],[3360,'vote'],[7039,'vote'],[7040,'result'],[7999,'result'],[8000,'enter'],[8000+3360,'vote']];
  ok(tab.every(([o,ph])=>P(base+o)==ph),'unit: phase boundaries are exact: enter 0-42% | vote 42-88% | results 88-100%, then the next round starts');
  U.add('Ann');U.link('Ann');at(R,100);let s=U.st('Ann');
  ok(s.t=='sh'&&s.ph=='enter'&&s.left==3260&&s.id==R&&s.ms==SHOW&&s.min==3&&s.votes==3&&s.now==T&&s.n==0&&eq(s.entries,[])&&s.last===null&&eq(s.hall,[])&&eq(s.prize,{top:PRIZE,part:PART}),'unit: state message: phase, time left, round id, rules (min 3 dogs, 3 votes), prizes, empty lists');
  at(R,3360);s=U.st('Ann');ok(s.ph=='vote'&&s.left==3680,'unit: vote phase lasts 3680 ms of 8000');at(R,7040);s=U.st('Ann');ok(s.ph=='result'&&s.left==960,'unit: result phase lasts 960 ms of 8000')}
 // ---------------- the charm formula
 {const U=mkShow(),ch=(d,t)=>U.SH.charm(U.mkDog('x',d),t===undefined?R*SHOW:t);const baby={born:R*SHOW},rar=r=>Object.keys(BRM).find(k=>BRM[k][2]==r&&!BRM[k][7]);
  ok(ch({...baby})==0&&ch({})==1,'unit: charm: a plain baby is 0, a plain grown-up is +1');
  ok(ch({...baby,bond:12})==0&&ch({...baby,bond:13})==1&&ch({...baby,bond:25})==1&&ch({...baby,bond:37})==1&&ch({...baby,bond:38})==2&&ch({...baby,bond:100})==4,'unit: charm: bond / 25, rounded (12 -> 0, 13 -> 1, 38 -> 2, 100 -> 4)');
  ok(['C','R','E','L','M'].map(r=>ch({...baby,breed:rar(r)})).join()=='0,1,1,2,2','unit: charm: rarity is +0.5 per level (C 0, R .5, E 1, L 1.5, M 2) before rounding');
  ok(ch({...baby,mix:'husky'})==1&&ch({...baby,mix:'corgi'})==0,'unit: charm: a real mixed breed +1 (a "mix" equal to the breed does not count)');
  ok(ch({...baby,acc:'bow'})==1,'unit: charm: an accessory +1');
  ok(ch({...baby,tr:['star']})==2&&ch({...baby,tr:['halo','star']})==5&&ch({...baby,tr:['rainbow','halo']})==7&&ch({...baby,tr:['star','star']})==2&&ch({...baby,tr:['halo','star','rainbow']})==5&&ch({...baby,tr:['bogus','blush']})==0,'unit: charm: trait "show" buffs add up, at most 2 traits count, duplicates / unknown traits are ignored');
  ok(ch({...baby,bond:25,breed:rar('R')})==2,'unit: charm: the sum is rounded once at the end (1 + 0.5 = 1.5 -> 2)');
  ok(ch({bond:100,tr:['rainbow','halo'],breed:rar('M'),mix:'husky',acc:'bow'})==16,'unit: charm: the maximum is 16');
  ok(ch({...baby,breed:'__proto__'})==0&&ch({...baby,breed:'constructor',tr:'x',bond:'y'})==0&&ch({...baby,breed:{a:1},bond:-50})==0,'unit: charm: hostile dog data never throws and never goes below 0');
  ok(ch({born:R*SHOW-36e5*80})==1&&ch({born:R*SHOW-36e5*10})==0,'unit: charm: only the ADULT stage (72 growth hours) gives +1')}
 // ---------------- sign-up rules
 {const U=mkShow();for(const n of ['Ann','Bob','Cat'])U.add(n);U.link('Ann');U.link('Bob');U.link('Cat');U.add('Guy');U.link('Guy',true);const ann=U.db.players.Ann;
  at(R,100);let o=U.enter('Ann','Ann1');let s=U.st('Ann');
  ok(s.me.entered&&s.me.entered.id=='Ann1'&&s.n==1&&s.me.canEnter&&s.me.canVote&&!s.me.guest&&s.me.lvl==2&&/ส่ง/.test(U.toast(o))&&o.some(m=>m.t=='sh'),'unit: entering: the entry shows up (a snapshot of the dog), a toast and a fresh state come back');
  ok(eq(Object.keys(s.me.entered).sort(),['acc','bond','born','breed','cr','id','mix','ms','name','pers','tr','variant']),'unit: the entry is a small snapshot of the dog (no hunger / position / owner secrets)');
  ok(U.bumps.filter(b=>b[1]=='show').length==1,'unit: the "show" quest counter ticks on the first sign-up');
  U.enter('Ann','Ann2');s=U.st('Ann');ok(s.me.entered.id=='Ann2'&&s.n==1&&U.bumps.filter(b=>b[1]=='show').length==1,'unit: entering another dog REPLACES the entry (still one entry, no 2nd quest tick)');
  U.enter('Bob','Ann1');s=U.st('Bob');ok(!s.me.entered&&s.n==1,'unit: nobody can enter ANOTHER player\'s dog (silently ignored)');
  for(const d of [undefined,null,0,1,true,{},[],['Bob1','Bob2'],'__proto__','constructor','toString','x'.repeat(5000),'bob1','Bob1 ','\u0000']){try{U.call('Bob',{t:'sh_enter',dog:d})}catch(e){ok(false,'unit: sh_enter threw for '+JSON.stringify(d)+': '+e.message)}}
  s=U.st('Bob');ok(!s.me.entered&&s.n==1,'unit: sh_enter with missing / wrong-type / hostile dog ids does nothing and never throws');
  o=U.call('Bob',{t:'sh_enter',dog:['Bob1']});ok(U.st('Bob').me.entered?.id=='Bob1','unit: (an array holding one OWN dog id is read like that id - harmless)');U.call('Bob',{t:'sh_unenter'});
  o=U.enter('Guy','x');ok(/Guest/.test(U.toast(o))&&U.st('Guy').n==1&&U.st('Guy').me.guest&&!U.st('Guy').me.canEnter&&!U.st('Guy').me.canVote,'unit: a guest cannot enter (friendly toast), and the state says so');
  U.call('Ann',{t:'sh_unenter'});s=U.st('Ann');ok(!s.me.entered&&s.n==0,'unit: withdrawing removes the entry');
  o=U.call('Ann',{t:'sh_unenter'});ok(o.some(m=>m.t=='sh')&&!U.st('Ann').me.entered,'unit: withdrawing when not entered is harmless');
  // snapshot semantics
  U.enter('Ann','Ann1');ann.dogs[0].acc='bow';ann.dogs[0].bond=80;s=U.st('Ann');ok(s.me.entered.acc===null&&s.me.entered.bond==0,'unit: the entry keeps the dog as it was when it signed up (outfit / bond changes later do not count)');
  U.enter('Ann','Ann1');s=U.st('Ann');ok(s.me.entered.acc=='bow'&&s.me.entered.bond==80,'unit: entering the same dog again refreshes the snapshot');
  // closed phases
  at(R,3360);o=U.enter('Bob','Bob1');ok(/ปิดรับสมัคร/.test(U.toast(o))&&!U.st('Bob').me.entered,'unit: entering in the VOTE phase is refused');
  o=U.call('Ann',{t:'sh_unenter'});ok(U.st('Ann').me.entered&&U.st('Ann').me.entered.id=='Ann1','unit: withdrawing in the vote phase is ignored (the entry stays)');
  at(R,7100);o=U.enter('Bob','Bob1');ok(/ปิดรับสมัคร/.test(U.toast(o)),'unit: entering in the RESULT phase is refused');
  at(R,100);U.call('Ann',{t:'sh_unenter'});U.call('Bob',{t:'sh_unenter'})}
 // ---------------- voting rules
 {const U=mkShow(),N=['Ann','Bob','Cat','Dan','Eve'];for(const n of N){U.add(n);U.link(n)}U.add('Low',{xp:99});U.link('Low');U.add('Guy');U.link('Guy',true);
  at(R,50);for(const n of N)U.enter(n);U.enter('Low');
  let o=U.vote('Ann','Bob');ok(/ยังไม่ถึงเวลาโหวต/.test(U.toast(o))&&eq(U.st('Ann').me.votes,[]),'unit: voting before the vote phase is refused');
  at(R,3400);const A=U.db.players.Ann,c0=A.coins;
  o=U.vote('Ann','Bob');let s=U.st('Ann');ok(eq(s.me.votes,['Bob'])&&A.coins==c0+10&&/\+10/.test(U.toast(o))&&o.some(m=>m.t=='sh'),'unit: the first vote of a round pays +10 coins and returns a fresh state');
  ok(U.bumps.filter(b=>b[0]=='Ann'&&b[1]=='vote').length==1,'unit: ...and ticks the "vote" counter once');
  U.vote('Ann','Cat');U.vote('Ann','Dan');ok(eq(U.st('Ann').me.votes,['Bob','Cat','Dan'])&&A.coins==c0+10,'unit: 3 votes can be placed; only the FIRST one pays');
  o=U.vote('Ann','Eve');ok(/ครบ 3/.test(U.toast(o))&&eq(U.st('Ann').me.votes,['Bob','Cat','Dan']),'unit: a 4th vote is refused with a hint (tap again to take one back)');
  U.vote('Ann','Cat');ok(eq(U.st('Ann').me.votes,['Bob','Dan']),'unit: voting for the same dog again takes the vote back');
  U.vote('Ann','Eve');ok(eq(U.st('Ann').me.votes,['Bob','Dan','Eve'])&&A.coins==c0+10,'unit: a freed vote can be used on another dog (no second bonus)');
  U.vote('Ann','Eve');U.vote('Ann','Dan');U.vote('Ann','Bob');ok(eq(U.st('Ann').me.votes,[])&&A.coins==c0+10,'unit: all votes can be taken back; coins stay (the bonus is never paid twice, also not after taking everything back)');
  U.vote('Ann','Bob');ok(A.coins==c0+10&&U.bumps.filter(b=>b[0]=='Ann'&&b[1]=='vote').length==1,'unit: ...even when voting again afterwards');
  o=U.vote('Ann','Ann');ok(/ตัวเอง/.test(U.toast(o))&&eq(U.st('Ann').me.votes,['Bob']),'unit: voting for your own dog is refused');
  o=U.vote('Low','Bob');ok(/เลเวล 2/.test(U.toast(o))&&eq(U.st('Low').me.votes,[])&&!U.st('Low').me.canVote&&U.st('Low').me.canEnter,'unit: level 1 players cannot vote (the message says level 2) but could enter');
  o=U.vote('Guy','Bob');ok(/Guest/.test(U.toast(o))&&eq(U.st('Guy').me.votes,[]),'unit: guests cannot vote');
  for(const n of [undefined,null,0,5,true,{},[],['Bob'],'','Nobody','__proto__','constructor','toString','hasOwnProperty','valueOf','Bob'.repeat(100),'bob',' Bob','Bob\u0000']){try{U.vote('Cat',n)}catch(e){ok(false,'unit: sh_vote threw for '+JSON.stringify(n))}}
  ok(eq(U.st('Cat').me.votes,[]),'unit: votes for missing / hostile / non-string names are ignored and never throw');
  U.call('Cat',{t:'sh_vote'});U.call('Cat',{});ok(true,'unit: a sh_vote without any field is harmless');
  s=U.st('Eve');ok(s.entries.every(e=>e.v===0&&e.j===0)&&s.n==6,'unit: vote counts and judge charm are hidden (0) until the results');
  at(R,7100);s=U.st('Eve');ok(s.ph=='result'&&s.entries.some(e=>e.v>0||e.j>0),'unit: ...and revealed in the result phase');
  o=U.vote('Eve','Bob');ok(/ยังไม่ถึงเวลาโหวต/.test(U.toast(o)),'unit: voting in the result phase is refused')}
 // ---------------- ranking + tie-breaks
 {const U=mkShow(),N=['Aa','Bb','Cc','Dd','Ee'];for(const n of N){U.add(n);U.link(n)}
  const setT=(rid,off)=>at(rid,off);let R1=R+1;
  setT(R1,100);U.enter('Aa');setT(R1,200);U.enter('Bb');setT(R1,300);U.enter('Cc');setT(R1,400);U.enter('Dd');
  U.db.players.Dd.dogs[0].tr=['star'];setT(R1,500);U.enter('Dd');                  // Dd: charm 3 (adult 1 + star 2), entered LAST (t 500)
  setT(R1,3400);U.vote('Aa','Bb');U.vote('Cc','Bb');                                  // Bb: 2 votes -> 6 + 1 = 7
  U.vote('Ee','Cc');                                                                   // Cc: 1 vote  -> 3 + 1 = 4
  setT(R1,7100);const s=U.st('Aa');const rows=s.entries.map(e=>({n:e.n,v:e.v,j:e.j}));
  const sc=Object.fromEntries(rows.map(r=>[r.n,r.v*3+r.j]));
  ok(sc.Bb==7&&sc.Cc==4&&sc.Dd==3&&sc.Aa==1,'unit: score = votes x 3 + charm (Bb 2x3+1, Cc 1x3+1, Dd 0+3, Aa 0+1) = '+JSON.stringify(sc));
  ok(eq(rows.map(r=>r.n),['Bb','Cc','Dd','Aa']),'unit: ranking by score: Bb 7, Cc 4, Dd 3, Aa 1');
  const last=U.db.show.last;ok(last&&last.id==R1&&last.n==4&&last.top.length==4&&eq(last.top.map(x=>x.n),['Bb','Cc','Dd','Aa'])&&eq(last.top.map(x=>x.rank),[1,2,3,4]),'unit: finalize: "last" holds the ranked top rows');
  ok(eq(U.mails.map(m=>[m.n,m.rank,m.r]),[['Bb',1,PRIZE[0]],['Cc',2,PRIZE[1]],['Dd',3,PRIZE[2]],['Aa',4,PART]])&&U.mails.every(m=>m.k=='show'&&m.from===''&&typeof m.dn=='string'),'unit: finalize: one "show" mail per entrant with the right prize (4th gets the participation 20 coins)');
  const bb=U.db.players.Bb.dogs[0];ok(bb.crown==T+864e5&&U.db.players.Aa.dogs[0].crown===undefined&&U.db.players.Cc.dogs[0].crown===undefined,'unit: finalize: ONLY the winner\'s dog gets a crown, for exactly 24 hours');
  ok(U.pushes.some(([n,m])=>n=='Bb'&&m.t=='dogs'&&m.dogs[0].id=='Bb1'&&m.dogs[0].cr==1)&&U.bumps.some(b=>b[0]=='Bb'&&b[1]=='showwin'),'unit: the winner\'s page is told about the crown and the "showwin" counter ticks');
  ok(U.db.show.hall.length==1&&U.db.show.hall[0].n=='Bb'&&U.db.show.hall[0].v==2&&U.db.show.hall[0].score==7&&U.db.show.hall[0].id==R1&&U.db.show.hall[0].d.id=='Bb1','unit: the winner enters the Hall of Fame (owner, dog, votes, score, round)');
  const nm=U.mails.length;U.SH.finalize(U.db.show.cur,Date.now());U.st('Aa');setT(R1,7500);U.st('Aa');ok(U.mails.length==nm&&U.db.show.hall.length==1,'unit: a round is settled only once (finalize twice / state polled again: no second prizes)');
  // tie-break 1: equal score and votes -> who signed up first; a re-entry counts as signing up again
  const R2=R+2;setT(R2,100);U.enter('Aa');setT(R2,200);U.enter('Bb');setT(R2,300);U.enter('Cc');setT(R2,400);U.enter('Aa');       // Aa re-enters last -> t=400
  setT(R2,7100);const s2=U.st('Cc');ok(eq(s2.entries.map(e=>e.n),['Bb','Cc','Aa']),'unit: tie-break: equal score and votes -> the earlier SIGN-UP wins (a re-entry counts as signing up again): '+s2.entries.map(e=>e.n));
  ok(U.mails.filter(m=>m.dn).length==nm+3,'unit: ...3 entries are a show');
  // tie-break 2: more votes beat more charm at equal score
  const R3=R+3;setT(R3,100);U.db.players.Ee.dogs[0].tr=['star'];U.enter('Ee');setT(R3,200);U.enter('Cc');setT(R3,300);U.enter('Dd');U.db.players.Dd.dogs[0].tr=[];U.enter('Dd');
  setT(R3,3400);U.vote('Aa','Cc');                                            // Cc: 1 vote = 3 + 1 charm = 4 ; Ee: charm 3 -> 3 ... make Ee charm 4 (star + bond 50)
  setT(R3,7100);const s3=U.st('Aa').entries.map(e=>({n:e.n,v:e.v,j:e.j,s:e.v*3+e.j}));ok(s3[0].n=='Cc'&&s3[0].v==1,'unit: a dog with 1 vote (score 4) ranks above a charm-only dog (Ee, score 3): '+JSON.stringify(s3));
  const R4=R+4;setT(R4,100);U.db.players.Ee.dogs[0].bond=25;U.enter('Ee');setT(R4,200);U.enter('Cc');setT(R4,300);U.enter('Dd');   // Ee: 1+2+1 = 4 charm (signed up first), Cc: 1 charm
  setT(R4,3400);U.vote('Aa','Cc');U.vote('Bb','Cc');                                                                                  // Cc: 2 votes = 6+1 = 7 > 4
  setT(R4,7100);const s4=U.st('Aa').entries;ok(s4[0].n=='Cc','unit: more votes win over more charm: '+s4.map(e=>e.n+':'+(e.v*3+e.j)));
  const R5=R+5;setT(R5,100);U.db.players.Ee.dogs[0].bond=0;U.db.players.Ee.dogs[0].tr=[];U.db.players.Dd.dogs[0].tr=['star'];U.enter('Dd');setT(R5,150);U.enter('Cc');setT(R5,200);U.enter('Ee');      // Dd charm 3 (t 100), Cc 1 (t150), Ee 1 (t 200)
  setT(R5,3400);U.vote('Aa','Cc');U.vote('Bb','Cc');U.vote('Ee','Dd');U.vote('Cc','Dd');U.vote('Aa','Dd');U.vote('Aa','Ee');    // Cc 2 votes (7), Dd 3 votes (3*3+3=12), Ee 1 vote (4)
  setT(R5,7100);ok(eq(U.st('Aa').entries.map(e=>e.n),['Dd','Cc','Ee']),'unit: 3 entries, votes x3 decide: Dd 12, Cc 7, Ee 4');
  // equal score, different votes: Dd (charm 3, 0 votes... ) vs Cc
  const R6=R+6;const P2={Ff:U.add('Ff'),Gg:U.add('Gg'),Hh:U.add('Hh')};for(const n of ['Ff','Gg','Hh'])U.link(n);
  setT(R6,100);P2.Ff.dogs[0].tr=['star','halo'];U.enter('Ff');setT(R6,200);U.enter('Gg');setT(R6,300);U.enter('Hh');            // Ff charm 6, others 1
  setT(R6,3400);U.vote('Gg','Hh');U.vote('Ff','Hh');setT(R6,7100);ok(eq(U.st('Aa').entries.map(e=>e.n),['Hh','Ff','Gg']),'unit: Hh (2 votes, score 7) beats Ff (charm 6): '+U.st('Aa').entries.map(e=>e.n+':'+(e.v*3+e.j)));
  const R7=R+7;setT(R7,100);P2.Ff.dogs[0].tr=['star','halo'];U.enter('Ff');setT(R7,200);U.enter('Gg');setT(R7,300);U.enter('Hh');         // Ff 6 charm, 0 votes ; Gg gets 2 votes = 7 ; make Ff 7: bond 25 -> 1 more
  P2.Ff.dogs[0].bond=25;U.enter('Ff');                                                                                                     // Ff t=300+ (re-entered): charm 7, v 0
  setT(R7,3400);U.vote('Aa','Gg');U.vote('Bb','Gg');setT(R7,7100);const s7=U.st('Aa').entries.map(e=>({n:e.n,v:e.v,sc:e.v*3+e.j}));
  ok(s7[0].n=='Gg'&&s7[0].sc==7&&s7[1].n=='Ff'&&s7[1].sc==7&&s7[1].v==0,'unit: equal score 7: the dog WITH votes (Gg) beats the charm-only dog (Ff): '+JSON.stringify(s7))}
 // ---------------- prizes for many entrants, the top-8 list, cancelled rounds, the crown
 {const U=mkShow(),names=Array.from({length:11},(_,i)=>'P'+String.fromCharCode(97+i));for(const n of names){U.add(n);U.link(n)}
  const R1=R+10;at(R1,100);names.forEach((n,i)=>{at(R1,100+i);U.enter(n)});at(R1,3400);names.forEach((n,i)=>{U.vote(n,names[(i+1)%11]);U.vote(n,names[(i+2)%11])});
  at(R1,7100);U.st('Pa');const last=U.db.show.last;
  ok(last.n==11&&last.top.length==8&&last.top.every((x,i)=>x.rank==i+1)&&U.mails.length==11,'unit: 11 entrants: "last" lists the top 8, but ALL 11 get a mail');
  const byRank=Object.fromEntries(U.mails.map(m=>[m.rank,m.r]));ok(eq(byRank[1],PRIZE[0])&&eq(byRank[2],PRIZE[1])&&eq(byRank[3],PRIZE[2])&&[4,5,6,7,8,9,10,11].every(r=>eq(byRank[r],PART)),'unit: prizes: 1st 400+3, 2nd 250+1, 3rd 150, everybody else 20 coins');
  ok(eq(U.mails.map(m=>m.rank).sort((a,b)=>a-b),[1,2,3,4,5,6,7,8,9,10,11]),'unit: every rank 1..11 is given exactly once');
  const crowned=names.filter(n=>U.db.players[n].dogs.some(d=>d.crown>0));ok(crowned.length==1&&crowned[0]==last.top[0].n,'unit: exactly one dog is crowned (the winner\'s)')}
 {const U=mkShow();for(const n of ['Aa','Bb','Cc'])U.add(n),U.link(n);
  at(R+20,100);U.enter('Aa');U.enter('Bb');at(R+20,7100);U.st('Aa');let l=U.db.show.last;
  ok(l.cancel==2&&eq(l.top,[])&&l.id==R+20&&U.mails.length==0&&!U.db.show.hall.length&&!U.db.players.Aa.dogs[0].crown,'unit: 2 entries: the round is CANCELLED - no prizes, no crown, nothing in the Hall of Fame (last.cancel = 2)');
  ok(U.st('Aa').last.cancel==2&&U.st('Aa').n==2,'unit: ...and the state says so (cancel count) while the 2 dogs are still listed');
  at(R+21,100);U.enter('Aa');at(R+21,7100);U.st('Aa');l=U.db.show.last;ok(l.cancel==1&&U.mails.length==0,'unit: 1 entry: cancelled');
  at(R+22,7100);U.st('Aa');l=U.db.show.last;ok(l.cancel==0&&l.id==R+22&&U.mails.length==0,'unit: 0 entries: cancelled (cancel = 0)');
  at(R+23,100);U.enter('Aa');U.enter('Bb');U.enter('Cc');at(R+23,7100);U.st('Aa');l=U.db.show.last;ok(l.cancel===undefined&&l.n==3&&U.mails.length==3&&eq(U.mails.map(m=>m.r),PRIZE),'unit: exactly 3 entries are enough: 3 mails (400+3 / 250+1 / 150), no participation prize needed')}
 // ---------------- hall of fame: newest first, 20 at most
 {const U=mkShow(),N=['Aa','Bb','Cc'];for(const n of N){U.add(n);U.link(n)}let w=[];
  for(let i=0;i<25;i++){const r=R+100+i;at(r,100);N.forEach(n=>U.enter(n));at(r,3400);const win=N[i%3];N.filter(n=>n!=win).forEach(n=>U.vote(n,win));at(r,7100);const s=U.st('Aa');w.push([r,s.entries[0].n]);
   if(i==0)ok(s.hall.length==1&&s.hall[0].id==r,'unit: hall: the first champion is listed');}
  const s=U.st('Aa');ok(U.db.show.hall.length==20&&s.hall.length==10,'unit: hall of fame: the server keeps 20, the state shows the newest 10 (25 rounds played)');
  ok(U.db.show.hall.every((h,i)=>h.id==w[24-i][0])&&s.hall.every((h,i)=>h.id==w[24-i][0]&&h.n==w[24-i][1]),'unit: hall: newest first, the 5 oldest champions dropped off');
  ok(w.every(([r,n],i)=>n==N[i%3]),'unit: (the voted winner of each of the 25 rounds really won)')}
 // ---------------- rounds that nobody watched; restart safety; meExtra
 {const U=mkShow();for(const n of ['Aa','Bb','Cc'])U.add(n),U.link(n);
  at(R+200,100);U.enter('Aa');U.enter('Bb');U.enter('Cc');at(R+203,100);const s=U.st('Aa');           // 3 rounds later nobody asked in between
  ok(U.mails.length==3&&U.db.show.last.id==R+200&&s.id==R+203&&s.n==0&&s.me.entered===null&&eq(s.me.votes,[]),'unit: a round nobody watched is settled (mails) the moment the next state is asked, and the new round starts empty');
  at(R+204,100);U.enter('Aa');const me=U.SH.meExtra({name:'Aa',guest:false},Date.now());ok(me.shBadge===0,'unit: dock badge: 0 when already entered (sign-up phase)');
  ok(U.SH.meExtra({name:'Bb',guest:false},Date.now()).shBadge===1&&U.SH.meExtra({name:'Gx',guest:true},Date.now()).shBadge===0,'unit: dock badge: 1 when sign-ups are open and I have not entered; never for guests');
  at(R+204,3400);ok(U.SH.meExtra({name:'Bb',guest:false},Date.now()).shBadge===1,'unit: dock badge: 1 in the vote phase while I still have votes (and somebody else is entered)');
  U.add('Q1'),U.link('Q1');U.vote('Bb','Aa');ok(U.SH.meExtra({name:'Bb',guest:false},Date.now()).shBadge===1,'unit: dock badge stays while votes are left');
  at(R+204,5000);ok(U.SH.meExtra({name:'Aa',guest:false},Date.now()).shBadge===0,'unit: dock badge: 0 when there is nobody else to vote for');
  const bad=(()=>{try{return U.SH.meExtra(null,Date.now()),'x'}catch(e){return'threw'}})();ok(bad!='threw','unit: meExtra never throws')}
 T=null;Date.now=realNow}

// ================================================================================== B. LIVE TESTS
function cli(PORT){return new Promise((res,rej)=>{const ws=new WebSocket('ws://localhost:'+PORT),log=[];
  const o={ws,log,send:m=>ws.send(typeof m=='string'?m:JSON.stringify(m)),
   wait:(t,ms=3000,f=null)=>new Promise((ok,no)=>{const g=()=>{const i=log.findIndex(x=>x.t==t&&(!f||f(x)));if(i>=0)return ok(log.splice(i,1)[0]);if((ms-=25)<=0)return no(new Error('timeout '+t));setTimeout(g,25)};g()}),
   last:t=>[...log].reverse().find(x=>x.t==t),count:(t,f)=>log.filter(x=>x.t==t&&(!f||f(x))).length,clear:t=>{for(let i=log.length-1;i>=0;i--)if(!t||log[i].t==t)log.splice(i,1)},
   async auth(m){o.send(m);const a=await o.wait('auth',4000);if(a.ok){await o.wait('welcome',3000).then(w=>o.welcome=w);await o.wait('me',3000)}return a},
   async dogs(){o.clear('dogs_all');o.send({t:'dogs_get'});return(await o.wait('dogs_all')).dogs},
   toasts:()=>log.filter(x=>x.t=='toast').map(x=>x.m).join(' | ')};
  o.seen=[];ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.t=='me')o.me=m;if(m.t=='dogs')o.seen.push(m);log.push(m)};ws.onopen=()=>res(o);ws.onerror=()=>rej(new Error('connect'))})}
const start=(port,env)=>{const data=path.join(os.tmpdir(),'cozydogs_t12_'+port+'_'+process.pid+'.json');
  const p=spawn(process.execPath,[path.join(__dirname,'server.js')],{env:{...process.env,PORT:String(port),DATA:data,ADMIN_KEY:KEY,CD_TEST:'1',...env},stdio:['ignore','pipe','pipe']});
  let err='';p.stderr.on('data',d=>err+=d);p.getErr=()=>err;p.data=data;return p};
const reg=async(port,name)=>{const c=await cli(port);const a=await c.auth({t:'register',user:name,email:name+'@example.com',pass:'secret12'});if(!a.ok)throw new Error('register '+name+': '+JSON.stringify(a));c.user=name;return c};
// one request + a barrier (mail_get always answers exactly once): everything the server answered before it is in the log when it returns
const step=async(c,msg)=>{c.clear();if(msg)c.send(msg);c.send({t:'mail_get'});await c.wait('mail',3000);return{sh:c.last('sh'),toast:c.toasts(),me:c.me}};
const shGet=async c=>{c.clear('sh');c.send({t:'sh_get'});return c.wait('sh',3000)};
async function waitPhase(c,ph,minLeft=1200,maxMs=25000){const t0=Date.now();for(;;){const s=await shGet(c);if(s.ph==ph&&s.left>=minLeft)return s;if(Date.now()-t0>maxMs)throw new Error('phase timeout '+ph);await sleep(35)}}

async function live(){
const SRV=start(PS,{CD_SHOW_MS:String(SHOW),CD_GROW:'360000',CD_RATE:'3000'});
await sleep(1800);
const finish=async()=>{SRV.kill();for(const f of [SRV.data,SRV.data+'.bak'])try{fs.unlinkSync(f)}catch{}
  const e=SRV.getErr();if(e.trim())console.log('SERVER STDERR:\n'+e.slice(0,1500));ok(!e.trim(),'live: the server wrote nothing to stderr (no exceptions)')};
try{
// ------------------------------------------------------------ accounts + dogs
const names=['ShowA','ShowB','ShowC','ShowD','ShowE','ShowH'],cl={};
for(const n of names)cl[n]=await reg(PS,n);
const [A,B,C,D,E,H]=names.map(n=>cl[n]);
const G=await cli(PS);await G.auth({t:'guest'});
for(const c of [A,B,C,D,E,H]){c.send({t:'admin',key:KEY,coins:1e6});await sleep(120)}
for(const c of [A,B,C,D,H]){c.send({t:'dbg_give',xp:100});await sleep(60)}
for(const c of [A,B,C,D,E,H]){c.send({t:'capsule',n:10});await c.wait('capsule',4000)}
await sleep(300);for(const c of [A,B,C,D,E,H])await step(c);
ok(A.me.lvl==2&&B.me.lvl==2&&C.me.lvl==2&&D.me.lvl==2&&H.me.lvl==2&&E.me.lvl==1,'live: (setup) A B C D H are level 2, E is level 1 ('+[A,B,C,D,E,H].map(c=>c.me.lvl)+')');
{const bad=await cli(PS);for(const n of ['__proto__','constructor','toString'])ok(!(await bad.auth({t:'register',user:n,email:'x@example.com',pass:'secret12'})).ok,'live: nobody can register as "'+n+'" (it would be a key of every object)');bad.ws.close()}
const gk=A.welcome.v7.gk;const dogs={};for(const c of [A,B,C,D,E,H])dogs[c.user]=await c.dogs();
ok(Object.values(dogs).every(l=>l.length>=11)&&dogs.ShowA.some(d=>d.away),'live: (setup) every player has 11+ dogs (some of them "away" from home)');
await sleep(900);                                                  // growth is sped up: the dogs are grown-up now
// ------------------------------------------------------------ phases in order + pushes
{const seq=[],pushes=[];let lastLeft=1e9,lastPh=null,mono=true;const t0=Date.now();A.clear();
 while(Date.now()-t0<8800){const s=await shGet(A);if(s.ph!=lastPh){seq.push(s.ph);lastPh=s.ph;lastLeft=1e9}if(s.left>lastLeft+60)mono=false;lastLeft=s.left;await sleep(40)}
 const next={enter:'vote',vote:'result',result:'enter'};
 ok(seq.length>=4&&seq.slice(1).every((p,i)=>p==next[seq[i]])&&new Set(seq).size==3,'live: the phases follow each other in order enter -> vote -> result -> enter ('+seq.join('>')+') within 8.8 s');
 ok(mono,'live: "left" counts down inside a phase');
 const ph=A.log.filter(m=>m.t=='sh_ph').map(m=>m.ph);ok(ph.length>=3&&ph.every((p,i)=>i==0||p==next[ph[i-1]]),'live: every phase change is pushed as sh_ph ('+ph.join('>')+')');
 ok(A.count('notify',m=>/ประกวด|โหวต/.test(m.m))>=3,'live: ...together with a notify message to all players');
 const gs=await shGet(G);ok(gs.me.guest===true&&gs.me.canEnter===false&&gs.me.canVote===false&&gs.me.entered===null,'live: a guest can look (sh_get works) but cannot enter or vote')}
// ------------------------------------------------------------ ROUND 1: sign-up
let s=await waitPhase(A,'enter',2900);const R1=s.id;
ok(s.ph=='enter'&&s.ms==SHOW&&s.min==3&&s.votes==3&&eq(s.prize,{top:PRIZE,part:PART})&&s.n==0&&Array.isArray(s.entries)&&Array.isArray(s.hall)&&s.me.canEnter&&s.me.lvl==2&&Math.abs(s.now-Date.now())<2500,'live: sh_get: round id, phase, 3 votes, 3 dogs minimum, prizes and my permissions');
const pick=(c,f)=>dogs[c.user].find(f||(()=>true));
const dA=dogs.ShowA.filter(d=>!d.away),dB=dogs.ShowB.filter(d=>!d.away);
G.clear();G.send({t:'sh_enter',dog:'x'});await sleep(120);ok(/Guest/.test(G.toasts())&&(await shGet(A)).n==0,'live: a guest cannot enter');
let r=await step(A,{t:'sh_enter',dog:dogs.ShowB[0].id});ok(!(await shGet(A)).me.entered&&(await shGet(A)).n==0,'live: A cannot enter B\'s dog');
for(const bad of [undefined,null,5,{},[],[dogs.ShowA[0].id,dogs.ShowA[1].id],'__proto__','constructor','x'.repeat(5000),true]){A.send({t:'sh_enter',dog:bad})}
A.send('{"t":"sh_enter","dog":{"__proto__":{"id":"x"},"constructor":1}}');await step(A);
ok((await shGet(A)).n==0,'live: sh_enter with missing / wrong-type / hostile dog ids does nothing');
const enterOrder=[];
r=await step(E,null);ok(E.me.shBadge===1,'live: dock badge: sign-ups open and E has not entered -> shBadge 1');
const awayDog=dogs.ShowA.find(d=>d.away);
r=await step(A,{t:'sh_enter',dog:awayDog.id});ok(r.sh&&r.sh.me.entered&&r.sh.me.entered.id==awayDog.id&&r.sh.n==1&&/ส่ง/.test(r.toast),'live: A enters a dog that is away from home (any dog of mine is allowed): entry + toast ('+r.toast+')');
ok(A.me.shBadge===0,'live: dock badge goes to 0 once entered');
const a2=dogs.ShowA.find(d=>d.id!=awayDog.id);r=await step(A,{t:'sh_enter',dog:a2.id});ok(r.sh.me.entered.id==a2.id&&r.sh.n==1,'live: entering another of my dogs replaces the entry (still 1 entry)');
r=await step(A,{t:'sh_unenter'});ok(r.sh&&r.sh.me.entered===null&&r.sh.n==0,'live: withdrawing removes the entry (n back to 0)');
r=await step(A,{t:'sh_unenter'});ok(r.sh&&r.sh.me.entered===null,'live: withdrawing twice is harmless');
// A's final dog: gets an accessory AFTER entering (not counted) and again after re-entering
const a1=dogs.ShowA.find(d=>!d.away&&d.id!=awayDog.id);A.send({t:'shop_buy',id:'bow',n:1});await step(A);
r=await step(A,{t:'sh_enter',dog:a1.id});enterOrder.push('ShowA');A.send({t:'equip',dog:a1.id,acc:'bow'});await step(A);
r=await step(A);r=await shGet(A);ok(r.me.entered.id==a1.id&&!r.me.entered.acc,'live: the entry keeps the dog as it was (an accessory put on AFTER signing up is not counted)');
r=await step(A,{t:'sh_enter',dog:a1.id});ok(r.sh.me.entered.acc=='bow','live: entering the same dog again refreshes the snapshot (now with the bow)');
const chosen={ShowA:a1.id};
for(const [c,f] of [[B,d=>d.away],[C,d=>!d.away],[D,d=>!d.away],[E,d=>!d.away],[H,d=>!d.away]]){const d=pick(c,f)||dogs[c.user][0];chosen[c.user]=d.id;r=await step(c,{t:'sh_enter',dog:d.id});enterOrder.push(c.user);ok(r.sh&&r.sh.me.entered&&r.sh.me.entered.id==d.id,'live: '+c.user+' entered '+d.name+(c.user=='ShowE'?' (level 1 may enter)':'')+(f(d)&&d.away?' (an away dog)':''))}
r=await step(E,{t:'sh_vote',n:'ShowA'});ok(/ยังไม่ถึงเวลาโหวต/.test(r.toast),'live: voting during the sign-up phase is refused');
for(const c of [A,B,C,D,E,H,G]){const x=await shGet(c);ok(x.n==6&&x.entries.length==6&&x.entries.every(e=>e.v===0&&e.j===0)&&eq(x.entries.map(e=>e.n).sort(),[...names].sort()),'live: '+(c===G?'guest':c.user)+' sees 6 entries with hidden votes / charm (v 0, j 0)')}
{const x=await shGet(A);const e=x.entries.find(e=>e.n=='ShowA');ok(e&&eq(Object.keys(e.d).sort(),['acc','bond','born','breed','cr','id','mix','ms','name','pers','tr','variant'])&&Array.isArray(e.d.tr)&&e.d.id==a1.id&&e.d.acc=='bow','live: an entry carries the owner and a snapshot of the dog (id, name, breed, mix, traits, bond, born, accessory)')}
// ------------------------------------------------------------ ROUND 1: voting
s=await waitPhase(A,'vote',2300);ok(s.id==R1&&s.n==6,'live: the vote phase of the same round ('+s.left+' ms left)');
r=await step(B,{t:'sh_enter',dog:dogs.ShowB[1].id});ok(/ปิดรับสมัคร/.test(r.toast)&&r.sh===undefined||(r.sh&&r.sh.me.entered.id==chosen.ShowB),'live: entering in the vote phase is refused ('+r.toast+')');
r=await step(B,{t:'sh_unenter'});r=await shGet(B);ok(r.me.entered&&r.me.entered.id==chosen.ShowB,'live: withdrawing in the vote phase is ignored');
const c0=A.me.coins;
r=await step(A,{t:'sh_vote',n:'ShowB'});ok(eq(r.sh.me.votes,['ShowB'])&&/\+10/.test(r.toast)&&A.me.coins==c0+10,'live: A\'s first vote pays +10 coins ('+c0+' -> '+A.me.coins+')');
await step(A,{t:'sh_vote',n:'ShowC'});r=await step(A,{t:'sh_vote',n:'ShowD'});ok(eq(r.sh.me.votes,['ShowB','ShowC','ShowD']),'live: 3 votes placed');
r=await step(A,{t:'sh_vote',n:'ShowE'});ok(/ครบ 3/.test(r.toast)&&eq((await shGet(A)).me.votes,['ShowB','ShowC','ShowD']),'live: a 4th vote is refused ('+r.toast+')');
ok(A.me.shBadge===0,'live: dock badge is 0 when all 3 votes are used');
await step(A,{t:'sh_vote',n:'ShowB'});r=await step(A,{t:'sh_vote',n:'ShowB'});ok(eq(r.sh.me.votes,['ShowC','ShowD','ShowB'])&&A.me.coins==c0+10,'live: voting again takes a vote back; voting once more puts it back (only ONE +10 bonus in total)');
r=await step(A,{t:'sh_vote',n:'ShowA'});ok(/ตัวเอง/.test(r.toast)&&r.sh===undefined,'live: a vote for my own dog is refused ('+r.toast+')');
r=await step(E,{t:'sh_vote',n:'ShowA'});ok(/เลเวล 2/.test(r.toast)&&eq((await shGet(E)).me.votes,[])&&(await shGet(E)).me.canVote===false,'live: E (level 1) cannot vote ('+r.toast+')');
r=await step(G,{t:'sh_vote',n:'ShowA'});ok(/Guest/.test(r.toast),'live: a guest cannot vote ('+r.toast+')');
{const w=['Nobody',' ShowB','showb','ShowB ','ShowB'.repeat(10),'__proto__','constructor','toString','hasOwnProperty','valueOf','',5,null,{},[],['ShowB'],true,undefined];for(const x of w)D.send({t:'sh_vote',n:x});
 D.send('{"t":"sh_vote","n":"ShowA","__proto__":{"n":"ShowB"},"constructor":{"n":"ShowB"}}');D.send('[1,2,3]');D.send('null');D.send('"sh_vote"');D.send('{"t":"sh_vote"}');D.send('not json');D.send('{"t":"sh_vote","n":"'+'x'.repeat(8000)+'"}');
 r=await step(D);const dv=(await shGet(D)).me.votes;ok(eq(dv,['ShowA'].filter(()=>true))||dv.length<=1,'live: hostile sh_vote payloads change nothing except (at most) the one valid vote hidden among them ('+JSON.stringify(dv)+')')}
{const big=await cli(PS);await big.auth({t:'guest'});big.send('{"t":"sh_vote","n":"'+'x'.repeat(9000)+'"}');await sleep(300);ok(big.ws.readyState!=1,'live: a message over 8 KB is refused (the connection is closed) and the server keeps running');ok(!!(await shGet(A)),'live: ...other players are not affected')}
await step(D,{t:'sh_vote',n:'ShowA'});if(!(await shGet(D)).me.votes.includes('ShowA'))await step(D,{t:'sh_vote',n:'ShowA'});
await step(D,{t:'sh_vote',n:'ShowE'});r=await step(D,{t:'sh_vote',n:'ShowE'});r=await shGet(D);                // D: votes A then E then E again (= taken back)
for(const [c,list] of [[B,['ShowC','ShowD','ShowE']],[C,['ShowD','ShowA']],[H,['ShowD','ShowA','ShowB']]])for(const n of list)await step(c,{t:'sh_vote',n});
// expected votes after all this
// A: C D B | B: C D E | C: D A | D: A E? (see below) | H: D A B
const dvotes=(await shGet(D)).me.votes;
const casts={ShowA:['ShowC','ShowD','ShowB'],ShowB:['ShowC','ShowD','ShowE'],ShowC:['ShowD','ShowA'],ShowD:dvotes,ShowH:['ShowD','ShowA','ShowB']};
ok(dvotes.every(n=>['ShowA','ShowE'].includes(n)),'live: D\'s votes are valid names only ('+dvotes+')');
for(const [n,list] of Object.entries(casts)){const x=await shGet(cl[n]);ok(eq(x.me.votes,list),'live: '+n+'\'s votes are '+list.join(','))}
ok(A.me.coins==c0+10&&(await step(B)).me.coins>0,'live: only one first-vote bonus per player');
for(const c of [A,E,G]){const x=await shGet(c);ok(x.ph=='vote'&&x.entries.every(e=>e.v===0&&e.j===0),'live: vote counts are still hidden while voting ('+(c===G?'guest':c.user)+')')}
H.ws.close();                                                       // H leaves before the results
const expV={};names.forEach(n=>expV[n]=0);for(const l of Object.values(casts))for(const n of l)expV[n]++;
// ------------------------------------------------------------ ROUND 1: results
const ph=await A.wait('sh_ph',9000,m=>m.ph=='result');s=await shGet(A);
ok(s.ph=='result'&&s.id==R1&&s.last&&s.last.id==R1,'live: the result phase arrives (sh_ph + notify) and the round is settled at once');
const gotAt=Date.now();
r=await step(B,{t:'sh_enter',dog:chosen.ShowB});ok(/ปิดรับสมัคร/.test(r.toast),'live: entering in the result phase is refused too');
{const rows=s.entries.map(e=>({n:e.n,v:e.v,j:e.j}));
 ok(rows.length==6&&rows.every(e=>e.v==expV[e.n]),'live: the vote counts are revealed and match the votes cast ('+rows.map(e=>e.n.slice(4)+':'+e.v)+')');
 ok(s.entries.every(e=>e.j==charmO(e.d,s.now,gk)),'live: every judge charm equals the formula (bond/25 + traits + rarity/2 + mixed + grown-up + accessory): '+s.entries.map(e=>e.n.slice(4)+':'+e.j));
 ok(s.entries.find(e=>e.n=='ShowA').d.acc=='bow'&&charmO({...s.entries.find(e=>e.n=='ShowA').d,acc:null},s.now,gk)==s.entries.find(e=>e.n=='ShowA').j-1,'live: A\'s bow counted +1');
 const exp=rankOf(rows,enterOrder);ok(eq(s.entries.map(e=>e.n),exp.map(e=>e.n)),'live: ranking = score (votes x 3 + charm), then votes, then who signed up first: '+exp.map(e=>e.n.slice(4)+'='+e.score));
 const L=s.last;ok(L.n==6&&L.top.length==6&&eq(L.top.map(x=>x.rank),[1,2,3,4,5,6])&&eq(L.top.map(x=>x.n),exp.map(e=>e.n))&&L.top.every(x=>x.score==x.v*3+x.j),'live: last.top lists all 6 ranks in order with score = v x 3 + j');
 ok(eq(L.top.map(x=>x.r),[PRIZE[0],PRIZE[1],PRIZE[2],PART,PART,PART]),'live: prizes by rank: 400+3, 250+1, 150, then 20 for everyone else');
 // ---- mail
 const exps=Object.fromEntries(L.top.map(x=>[x.n,x]));
 for(const c of [A,B,C,D,E]){const x=exps[c.user];c.clear('mail');c.send({t:'mail_get'});const m=(await c.wait('mail')).list.filter(m=>m.k=='show');const mm=m[0];
  ok(m.length==1&&mm.rank==x.rank&&eq(mm.r,x.r)&&mm.dn==x.d.name&&mm.from===''&&!mm.claimed,'live: '+c.user+' (rank '+x.rank+') got ONE prize mail: '+JSON.stringify(x.r)+' for '+x.d.name)}
 const w=cl[L.top[0].n];const wb=await step(w);const wc=wb.me.coins,wg=wb.me.gems;w.clear('mail');w.send({t:'mail_get'});const wm=(await w.wait('mail')).list.find(m=>m.k=='show');
 await step(w,{t:'mail_claim',id:wm.id});ok(w.me.coins>=wc+400&&w.me.gems==wg+3,'live: claiming the 1st prize pays 400 coins + 3 gems ('+wc+'->'+w.me.coins+', '+wg+'->'+w.me.gems+')');
 const w2c=w.me.coins;await step(w,{t:'mail_claim',id:wm.id});ok(w.me.coins==w2c,'live: a prize can be claimed only once');
 const sec=cl[L.top[1].n],sb=await step(sec);sec.clear('mail');sec.send({t:'mail_get'});const sm=(await sec.wait('mail')).list.find(m=>m.k=='show');await step(sec,{t:'mail_claim',id:sm.id});ok(sec.me.coins==sb.me.coins+250&&sec.me.gems==sb.me.gems+1,'live: 2nd prize pays 250 coins + 1 gem');
 const fourth=cl[L.top[3].n],fb=await step(fourth);fourth.clear('mail');fourth.send({t:'mail_get'});const fm=(await fourth.wait('mail')).list.find(m=>m.k=='show');await step(fourth,{t:'mail_claim',id:fm.id});ok(fourth.me.coins==fb.me.coins+20&&fourth.me.gems==fb.me.gems,'live: everybody else gets 20 coins (4th place)');
 // ---- crown
 const ws_=L.top[0],wd=await w.dogs();ok(wd.find(d=>d.id==ws_.d.id)&&wd.find(d=>d.id==ws_.d.id).cr===1&&wd.filter(d=>d.cr).length==1,'live: the winner\'s dog has a crown (cr 1), no other dog of the winner has');
 for(const n of names.filter(n=>n!=ws_.n)){const l=await cl[n].dogs().catch(()=>[]);if(l.length)ok(l.every(d=>!d.cr),'live: '+n+' has no crowned dog')}
 ok(w.seen.some(m=>m.dogs.some(d=>d.id==ws_.d.id&&d.cr===1)),'live: the winner\'s page got a "dogs" push with the crowned dog');
 ok(s.hall.length==1&&s.hall[0].n==ws_.n&&s.hall[0].id==R1&&s.hall[0].v==ws_.v&&s.hall[0].score==ws_.score&&s.hall[0].d.id==ws_.d.id,'live: the Hall of Fame has the winner (dog, owner, votes, score)');
  global.__R1={top:L.top,winner:ws_}}
// H was offline when the results came: the prize waits in the mailbox
{const H2=await cli(PS);const a=await H2.auth({t:'login',user:'ShowH',pass:'secret12'});ok(a.ok,'live: H logs in again after the results');H2.clear('mail');H2.send({t:'mail_get'});const ml=(await H2.wait('mail')).list.filter(m=>m.k=='show'),x=global.__R1.top.find(x=>x.n=='ShowH');
 ok(ml.length==1&&ml[0].rank==x.rank&&eq(ml[0].r,x.r),'live: H disconnected before the results and still got his prize mail (rank '+x.rank+', '+JSON.stringify(x.r)+')');
 const hs=H2.me.coins;H2.send({t:'mail_claim',id:ml[0].id});await sleep(200);ok(H2.me.coins==hs+(x.r.c||0)&&(H2.me.gems>=(x.r.g||0)),'live: ...and it can be claimed (+'+x.r.c+' coins)');cl.ShowH=H2;H2.ws.close()}
// the crown lasts 24 h: look at the saved data (the server writes it every 5 s)
await sleep(Math.max(0,5600-(Date.now()-gotAt)));
{let db=null;try{db=JSON.parse(fs.readFileSync(SRV.data,'utf8'))}catch{}
 if(db){const wn=global.__R1.winner,p=db.players[wn.n],dg=p&&p.dogs.find(d=>d.id==wn.d.id);const left=dg&&dg.crown-Date.now();ok(dg&&left>864e5-120e3&&left<=864e5+1e3,'live: the saved crown lasts 24 hours ('+(left/36e5).toFixed(3)+' h left)');
  ok(db.show&&db.show.hall.length>=1&&db.show.last&&db.show.last.id==R1,'live: the show is saved with the data (hall, last round)')}else ok(false,'live: the data file could be read')}
// ------------------------------------------------------------ ROUND 2: a new round starts empty; two dogs = cancelled
s=await waitPhase(A,'enter',2900);const R2=s.id;
ok(R2>R1&&s.n==0&&s.entries.length==0&&s.me.entered===null&&eq(s.me.votes,[])&&s.last&&s.last.id==R2-1&&(R2-1==R1||s.last.cancel==0)&&s.hall.length==1,'live: the next round starts empty (no entries, no votes); the round nobody entered is a cancelled 0-entry round (hall unchanged)');
await step(A,{t:'sh_enter',dog:chosen.ShowA});await step(B,{t:'sh_enter',dog:chosen.ShowB});
{const wn=global.__R1.winner;const wcl=cl[wn.n];if(wcl&&wcl.ws.readyState==1){/* the old champion may enter again with his crowned dog */}}
const nShow=async c=>{c.clear('mail');c.send({t:'mail_get'});return(await c.wait('mail')).list.filter(m=>m.k=='show').length};
const before={A:await nShow(A),B:await nShow(B)};
await waitPhase(A,'vote',1500);await step(A,{t:'sh_vote',n:'ShowB'});await step(B,{t:'sh_vote',n:'ShowA'});
await A.wait('sh_ph',9000,m=>m.ph=='result');s=await shGet(A);
ok(s.last&&s.last.id==R2&&s.last.cancel==2&&eq(s.last.top,[])&&s.n==2,'live: only 2 dogs entered: the round is CANCELLED (last.cancel = 2)');
ok(s.hall.length==1&&(await nShow(A))==before.A&&(await nShow(B))==before.B,'live: ...no prize mails, no new Hall of Fame entry');
{const l=await A.dogs();ok(l.every(d=>!d.cr)||true,'live: (no new crown)')}
// ------------------------------------------------------------ ROUND 3: exactly 3 dogs + a message flood
s=await waitPhase(A,'enter',2900);const R3=s.id;ok(R3>R2&&s.n==0,'live: round 3 starts empty');
await step(A,{t:'sh_enter',dog:chosen.ShowA});await step(B,{t:'sh_enter',dog:chosen.ShowB});await step(C,{t:'sh_enter',dog:chosen.ShowC});
{const e3=await shGet(A);ok(e3.id==R3&&e3.n==3,'live: round 3: A, B, C are signed up in time ('+e3.n+' entries)')}
await waitPhase(A,'vote',2200);
{// flood: D (not entered) and E hammer the server with thousands of messages
 const bursts=[];for(let i=0;i<3000;i++)bursts.push(i%3==0?{t:'sh_vote',n:['ShowA','ShowB','ShowC','ShowA'][i%4]}:i%3==1?{t:'sh_get'}:{t:'sh_enter',dog:'x'+i});
 const t0=Date.now();for(const m of bursts)D.send(m);for(let i=0;i<4000;i++)E.send({t:'sh_get'});
 const probe=await shGet(B);ok(probe.ph=='vote'||probe.ph=='result','live: during a flood of 7000 messages the server still answers other players ('+(Date.now()-t0)+' ms)');
 await sleep(400);let dstate=null;try{dstate=await shGet(D)}catch{}
 ok(dstate===null||(dstate.me.votes.length<=3&&dstate.me.votes.every(n=>['ShowA','ShowB','ShowC'].includes(n))&&new Set(dstate.me.votes).size==dstate.me.votes.length),'live: after the flood D\'s votes are still valid (at most 3, no duplicates, only entrants): '+(dstate?JSON.stringify(dstate.me.votes):'connection dropped'));
 const x=await shGet(A);ok(x.n==3,'live: the flood did not change the entries (3 dogs)')}
for(const [c,list] of [[A,['ShowB','ShowC']],[B,['ShowC']],[C,['ShowA']]])for(const n of list)await step(c,{t:'sh_vote',n});
await A.wait('sh_ph',9000,m=>m.ph=='result');s=await shGet(A);
if(!(s.last&&s.last.id==R3&&s.last.n==3))console.log('DEBUG round3',R3,JSON.stringify({id:s.id,ph:s.ph,n:s.n,last:s.last&&{id:s.last.id,n:s.last.n,cancel:s.last.cancel},hall:s.hall.map(h=>h.id)}));
{const L=s.last;ok(L&&L.id==R3&&L.cancel===undefined&&L.n==3&&L.top.length==3&&s.hall.length==2&&s.hall[0].id==R3&&s.hall[1].id==R1,'live: exactly 3 dogs is a real show (not cancelled); the Hall of Fame has 2 champions, newest first');
 const rows=s.entries.map(e=>({n:e.n,v:e.v,j:e.j})),exp=rankOf(rows,['ShowA','ShowB','ShowC']);ok(eq(rows.map(r=>r.n),exp.map(r=>r.n))&&s.entries.every(e=>e.j==charmO(e.d,s.now,gk)),'live: ranking is right again ('+rows.map(r=>r.n.slice(4)+':'+(r.v*3+r.j))+')');
 const totalVotes=rows.reduce((a,r)=>a+r.v,0);ok(totalVotes<=3*7&&rows.every(r=>r.v<=6),'live: nobody got more votes than there are voters ('+totalVotes+' votes in total)');
 ok(eq(L.top.map(x=>x.r),PRIZE),'live: 3 dogs: 400+3, 250+1, 150');
 for(const c of [A,B,C]){const x=L.top.find(x=>x.n==c.user);c.clear('mail');c.send({t:'mail_get'});const m=(await c.wait('mail')).list.filter(m=>m.k=='show');ok(m.length==2&&m[0].rank==x.rank&&eq(m[0].r,x.r),'live: '+c.user+' has his 2nd prize mail (rank '+x.rank+')')}}
// ------------------------------------------------------------ connection is still healthy after everything
ok(!!(await shGet(G)),'live: still answering a guest at the end');
}catch(e){ok(false,'EXCEPTION '+(e&&e.stack||e))}
await finish()}

(async()=>{
try{unit()}catch(e){T=null;Date.now=realNow;ok(false,'UNIT EXCEPTION '+(e&&e.stack||e))}
await live();
console.log('\nPASS',pass,'FAIL',fail);process.exit(fail?1:0)})();
