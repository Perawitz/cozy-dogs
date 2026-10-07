// Cozy Dogs v7 - the HOURLY DOG SHOW, judged by the players on the server.
//   every round lasts CD_SHOW_MS (default one hour):   0-42% ENTER a dog  ·  42-88% VOTE (3 votes each)  ·  88-100% RESULTS (prizes are mailed)
//   score = player votes x 3 + the "judge's charm" (bond, cute traits, rarity, mixed breed, grown-up, accessory) - so even a quiet server gets a fair ranking
//   prizes (needs 3+ dogs): 1st 400💰+3💎 · 2nd 250💰+1💎 · 3rd 150💰 · everybody else 20💰.  The winner's dog wears a 👑 for 24 hours and enters the Hall of Fame.
// Messages: sh_get sh_enter sh_unenter sh_vote            Pushed: sh (state), sh_ph (a phase just changed)
'use strict';
const TRD=require('./traits');
module.exports=function(X){
const {db,conns,send,sendAll,wsOf,player,give,clamp,today,sendMe,pub,rt,BR,dirty,own,safe,toView,F,bump,GK,lvl}=X;
const toast=(ws,m)=>send(ws,{t:'toast',m});
const SHOW_MS=Math.max(2000,+process.env.CD_SHOW_MS||36e5),P_ENTER=.42,P_VOTE=.88,VOTES=3,MIN_ENTRIES=3,VOTE_LVL=2,CROWN_MS=864e5;
const PRIZE=[{c:400,g:3},{c:250,g:1},{c:150}],PART={c:20};
const RORD={C:0,R:1,E:2,L:3,M:4};
const S=()=>db.show??={cur:null,last:null,hall:[]};
const phaseOf=now=>{const k=(now%SHOW_MS)/SHOW_MS;return k<P_ENTER?'enter':k<P_VOTE?'vote':'result'};
const phaseEnd=(now,ph)=>{const base=now-now%SHOW_MS;return base+(ph=='enter'?P_ENTER:ph=='vote'?P_VOTE:1)*SHOW_MS};
const small=d=>({id:d.id,breed:d.breed,mix:d.mix||null,ms:d.ms|0,tr:TRD.cleanTraits(d.tr),variant:d.variant,name:d.name,pers:d.pers,bond:d.bond|0,born:d.born,acc:d.acc||null,cr:d.crown>Date.now()?1:0});
const charm=(d,now)=>Math.max(0,Math.round((d.bond|0)/25+TRD.buff(d,'show')+(RORD[BR[d.breed]?BR[d.breed][2]:'C']||0)*.5+(TRD.isMixed(d)?1:0)+(TRD.stageOf(d.born,now,GK)==3?1:0)+(d.acc?1:0)));
function tally(cur,now){
 const votes={};for(const v of Object.values(cur.vt))for(const n of v)votes[n]=(votes[n]||0)+1;
 return Object.entries(cur.ent).map(([n,e])=>({n,d:e.d,t:e.t,v:votes[n]|0,j:charm(e.d,now),score:(votes[n]|0)*3+charm(e.d,now)})).sort((a,b)=>b.score-a.score||b.v-a.v||a.t-b.t)}
function finalize(cur,now){
 if(cur.done)return;cur.done=true;const rows=tally(cur,now);
 if(rows.length<MIN_ENTRIES){S().last={id:cur.id,cancel:rows.length,top:[]};dirty();return}
 const top=rows.map((r,i)=>({n:r.n,d:r.d,v:r.v,j:r.j,score:r.score,rank:i+1,r:PRIZE[i]||PART}));
 for(const r of top){F.mailTo(r.n,{k:'show',rank:r.rank,from:'',dn:r.d.name,r:r.r})}
 const w=top[0],p=db.players[w.n];if(p){const dg=p.dogs.find(x=>x.id==w.d.id);if(dg){dg.crown=now+CROWN_MS;const ws=wsOf(w.n);if(ws)toView(w.n,{t:'dogs',dogs:[pub(rt(dg),now)]})}bump(w.n,'showwin',1)}
 const s=S();s.last={id:cur.id,n:rows.length,top:top.slice(0,8)};s.hall.unshift({id:cur.id,n:w.n,d:w.d,v:w.v,score:w.score});s.hall=s.hall.slice(0,20);dirty()}
function roll(now){const s=S(),id=Math.floor(now/SHOW_MS);
 if(!s.cur||s.cur.id!=id){if(s.cur&&!s.cur.done)finalize(s.cur,now);s.cur={id,ent:{},vt:{},done:false};dirty()}
 if(!s.cur.done&&phaseOf(now)=='result')finalize(s.cur,now);return s}
const eligible=(c,min)=>!c.guest&&lvl(player(c.name))>=min;
function state(c,now){
 const s=roll(now),cur=s.cur,ph=phaseOf(now),rows=tally(cur,now),me=cur.ent[c.name];
 return{t:'sh',ms:SHOW_MS,now,id:cur.id,ph,left:phaseEnd(now,ph)-now,n:rows.length,min:MIN_ENTRIES,votes:VOTES,
  me:{entered:me?me.d:null,votes:(cur.vt[c.name]||[]).slice(),canVote:eligible(c,VOTE_LVL),canEnter:!c.guest,guest:!!c.guest,lvl:VOTE_LVL},
  entries:(ph=='result'?rows:rows.slice().sort((a,b)=>a.t-b.t||(a.n<b.n?-1:1))).map(r=>({n:r.n,d:r.d,v:ph=='result'?r.v:0,j:ph=='result'?r.j:0})),      // before the result the order must not reveal the standings
  prize:{top:PRIZE,part:PART},
  last:s.last,hall:s.hall.slice(0,10)}}
function enter(ws,c,m){const now=Date.now(),s=roll(now);
 if(c.guest)return toast(ws,'ผู้เล่น Guest เข้าประกวดไม่ได้ — สมัครสมาชิกก่อนนะ');
 if(phaseOf(now)!='enter')return toast(ws,'ตอนนี้ปิดรับสมัครแล้ว รอรอบหน้านะ');
 const p=player(c.name),d=p.dogs.find(d=>d.id===String(m.dog));if(!d)return;
 const first=!s.cur.ent[c.name];s.cur.ent[c.name]={d:small(d),t:now};dirty();if(first)bump(c.name,'show',1,ws);
 toast(ws,'👑 ส่ง '+d.name+' เข้าประกวดแล้ว!');send(ws,state(c,now))}
function unenter(ws,c){const now=Date.now(),s=roll(now);if(phaseOf(now)!='enter')return;if(s.cur.ent[c.name]){delete s.cur.ent[c.name];dirty()}send(ws,state(c,now))}
function vote(ws,c,m){const now=Date.now(),s=roll(now),cur=s.cur;
 if(phaseOf(now)!='vote')return toast(ws,'ยังไม่ถึงเวลาโหวต (หรือหมดเวลาแล้ว)');
 if(!eligible(c,VOTE_LVL))return toast(ws,c.guest?'ผู้เล่น Guest โหวตไม่ได้ — สมัครสมาชิกก่อนนะ':'ต้องเลเวล '+VOTE_LVL+' ขึ้นไปถึงจะโหวตได้');
 const n=typeof m.n=='string'?m.n.slice(0,24):'';if(!own(cur.ent,n))return;if(n==c.name)return toast(ws,'โหวตให้หมาตัวเองไม่ได้นะ 😆');
 const mine=cur.vt[c.name]||(cur.vt[c.name]=[]),i=mine.indexOf(n);
 if(i>=0)mine.splice(i,1);else{if(mine.length>=VOTES)return toast(ws,'ใช้โหวตครบ '+VOTES+' คะแนนแล้ว (กดซ้ำเพื่อยกเลิก)');mine.push(n);
  if(!cur.vp)cur.vp={};if(!cur.vp[c.name]){cur.vp[c.name]=1;const p=player(c.name);give(p,{c:10});bump(c.name,'vote',1,ws);toast(ws,'🗳️ ขอบคุณที่โหวต +10💰');sendMe(ws)}}
 dirty();send(ws,state(c,now))}
const HND={sh_get:(ws,c)=>send(ws,state(c,Date.now())),sh_enter:enter,sh_unenter:unenter,sh_vote:vote};
function handle(ws,c,m){const f=own(HND,m.t)?HND[m.t]:null;if(!f)return false;f(ws,c,m);return true}
// tell everybody when a phase changes (and settle the round on time even if nobody asks)
let lastPh=null;
setInterval(safe('show',()=>{const now=Date.now(),s=roll(now),ph=phaseOf(now),key=s.cur.id+ph;if(lastPh===null){lastPh=key;return}if(key==lastPh)return;lastPh=key;
 const msg=ph=='enter'?'👑 ประกวดหมารอบใหม่เปิดแล้ว! ส่งหมาเข้าประกวดได้เลย':ph=='vote'?'🗳️ เริ่มโหวตหมาประกวดแล้ว! ร่วมตัดสินกันเลย':'🏆 ประกาศผลประกวดหมาแล้ว!';
 for(const [w,c] of conns){send(w,{t:'sh_ph',ph});send(w,{t:'notify',m:msg});sendMe(w)}}),Math.min(5000,Math.max(500,SHOW_MS/10)));
const meExtra=(c,now)=>{try{const s=db.show;if(!s||!s.cur)return{};const ph=phaseOf(now);return{shBadge:ph=='vote'&&!c.guest&&(s.cur.vt[c.name]||[]).length<VOTES&&Object.keys(s.cur.ent).some(n=>n!=c.name)?1:ph=='enter'&&!c.guest&&!s.cur.ent[c.name]?1:0}}catch(e){return{}}};
return{handle,state,roll,finalize,phaseOf,SHOW_MS,tally,charm,meExtra,PRIZE,MIN_ENTRIES};
};
