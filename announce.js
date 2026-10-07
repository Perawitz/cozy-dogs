// Cozy Dogs v7.1 - "ประกาศถึงทุกคน" (server-wide announcements, paid with gems).
//
// A player writes one short line, picks a cute style and pays gems; every player who is online sees a banner for a few seconds.
// Rules (all enforced HERE - the client only draws):
//   * 3 styles: heart 3 gems (7 s) / star 8 gems (9 s) / rainbow 20 gems (12 s).  Only members (not Guest accounts) can announce.
//   * text: 1..60 characters (cut by characters, never inside an emoji), control / zero-width characters removed, no links, no rude words.
//   * a banner never covers another one: announcements wait in ONE queue (max 6 waiting, so a flood cannot lock the screen for minutes).
//     The gems are taken only when the announcement is accepted into the queue; a refused one (queue full, cooldown, bad text) costs nothing.
//   * cooldown per player 30 s (stored on the player, a re-login does not skip it).
//   * the queue, the one that is on screen and the last 20 announcements live in db.ann, so a server restart does not lose a paid announcement.
// Messages (client -> server): ann_info · ann_send {m, k:'heart'|'star'|'rainbow'}
// Messages (server -> client): ann_info {price, ms, max, cd, q, cur, hist} · ann_ok {pos, wait} · ann {id, n, m, k, ms}  (the banner) · toast
'use strict';
module.exports=function(X){
const {db,conns,send,sendAll,player,sendMe,dirty,own,safe}=X;
const toast=(ws,m)=>send(ws,{t:'toast',m});
const SCALE=Math.max(1,+process.env.CD_ANN_SCALE||1);                       // tests: CD_ANN_SCALE=10 shows banners 10x shorter
const CD=Math.max(0,process.env.CD_ANN_CD!==undefined?+process.env.CD_ANN_CD||0:30000);   // per-player cooldown (ms)
const STY={heart:{p:3,ms:7000},star:{p:8,ms:9000},rainbow:{p:20,ms:12000}};
const MAXLEN=60,MAXQ=6,HIST=20,GAP=Math.round(900/SCALE);
const dur=k=>Math.round(STY[k].ms/SCALE);
const A=()=>{const a=db.ann??={q:[],cur:null,hist:[],n:0};if(!Array.isArray(a.q))a.q=[];if(!Array.isArray(a.hist))a.hist=[];if(!Number.isFinite(a.n))a.n=0;return a};

// ---------- text checks
const LINK=/(https?:|ftp:|www\.|[a-z0-9-]+\.(com|net|org|io|xyz|co|me|th|gg|ly|app|info|biz|cc|tk|ru|cn|link|club|shop|site|online|top)\b|line\.me|@[a-z0-9_.]{3,})/i;
const RUDE=['เหี้ย','ควย','เชี่ย','สัส','ไอ้สัตว์','fuck','shit','bitch','dick','cunt','nigg','fag','porn','sex'];
const squash=s=>s.toLowerCase().replace(/[\s._\-*+~'"`!?,|\\\/()\[\]{}0-9]/g,'');
function clean(raw){
  if(typeof raw!='string')return'';                      // numbers / objects / arrays are not text (String({}) would announce "[object Object]")
  let s=raw.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]/g,'').replace(/\s+/g,' ').trim();
  s=Array.from(s).slice(0,MAXLEN).join('').trim();return s}
function bad(s){const q=squash(s);if(LINK.test(s))return'link';for(const w of RUDE)if(q.includes(w))return'rude';return null}

// ---------- the queue
const now=()=>Date.now();
function snapshot(){const a=A(),t=now(),cur=a.cur&&a.cur.until>t?{id:a.cur.id,n:a.cur.n,m:a.cur.m,k:a.cur.k,ms:a.cur.until-t,full:a.cur.until-a.cur.at}:null;return cur}
function waitFor(a,idx){          // ms until the idx-th waiting announcement starts
  const t=now();let w=a.cur&&a.cur.until>t?a.cur.until-t+GAP:0;for(let i=0;i<idx;i++)w+=dur(a.q[i].k)+GAP;return w}
function pump(){
  const a=A(),t=now();
  if(a.cur&&a.cur.until<=t){a.cur=null;dirty()}
  if(a.cur||!a.q.length)return;
  if(a.last&&t-a.last<GAP)return;                                            // a short breather between two banners
  const x=a.q.shift(),ms=dur(x.k);
  a.cur={id:x.id,n:x.n,m:x.m,k:x.k,at:t,until:t+ms};a.last=t+ms;
  a.hist.unshift({id:x.id,n:x.n,m:x.m,k:x.k,at:t});if(a.hist.length>HIST)a.hist.length=HIST;
  dirty();sendAll({t:'ann',id:x.id,n:x.n,m:x.m,k:x.k,ms})}
setInterval(safe?safe('ann',pump):pump,Math.max(40,Math.round(400/SCALE)));

// ---------- messages
const info=(c)=>{const a=A(),p=player(c.name),t=now();
  const price={},ms={};for(const k of Object.keys(STY)){price[k]=STY[k].p;ms[k]=dur(k)}
  return{t:'ann_info',price,ms,max:MAXLEN,wait:waitFor(a,a.q.length),cd:Math.max(0,((p&&p.annAt)||0)+CD-t),q:a.q.length,maxq:MAXQ,cur:snapshot(),hist:a.hist.slice(0,HIST).map(h=>({id:h.id,n:h.n,m:h.m,k:h.k,at:h.at})),guest:!!c.guest}};

function send_(ws,c,m){
  const p=player(c.name);if(!p)return;
  if(c.guest)return toast(ws,'📣 สมัครสมาชิกก่อนนะ ผู้เล่น Guest ประกาศไม่ได้');
  const k=typeof m.k=='string'&&own(STY,m.k)?m.k:null;if(!k)return toast(ws,'📣 เลือกสไตล์ประกาศก่อนนะ');
  const s=clean(m.m);if(!s)return toast(ws,'📣 พิมพ์ข้อความก่อนนะ');
  const why=bad(s);if(why)return toast(ws,why=='link'?'📣 ใส่ลิงก์ในประกาศไม่ได้นะ':'📣 ข้อความมีคำไม่สุภาพ ลองเปลี่ยนคำดูนะ');
  const t=now(),a=A(),left=((p.annAt||0)+CD)-t;
  if(left>0)return toast(ws,'⏳ ประกาศได้อีกครั้งในอีก '+Math.ceil(left/1000)+' วินาที');
  if(a.q.length>=MAXQ)return toast(ws,'📣 คิวประกาศเต็มอยู่ รอสักครู่แล้วลองใหม่นะ (ยังไม่เสียเพชร)');
  const price=STY[k].p;if(!(p.gems>=price))return toast(ws,'Gems ไม่พอ (ต้องใช้ '+price+'💎)');
  p.gems-=price;p.annAt=t;p.stats=p.stats||{};p.stats.ann=(p.stats.ann|0)+1;
  const id=(a.n=(a.n+1)|0);a.q.push({id,n:c.name,m:s,k,at:t});dirty();
  const pos=a.q.length-1,wait=waitFor(a,pos);
  send(ws,{t:'ann_ok',pos,wait,k,price});sendMe(ws);send(ws,info(c));
  pump()}

const HND={
  ann_info:(ws,c)=>send(ws,info(c)),
  ann_send:(ws,c,m)=>send_(ws,c,m||{}),
};
function handle(ws,c,m){const f=own(HND,m.t)?HND[m.t]:null;if(!f)return false;f(ws,c,m);return true}
return{handle,clean,bad,STY,MAXLEN,MAXQ,pump,A,dur};
};
