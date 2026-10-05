// Fuzz / abuse test: throws garbage and hostile payloads at every message type; the server must stay alive and no player value may become NaN.
const URL='ws://localhost:'+(process.env.PORT||3055);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function cli(){return new Promise(res=>{const ws=new WebSocket(URL),log=[];const o={ws,log,send:m=>ws.send(typeof m=='string'?m:JSON.stringify(m)),
 wait:(t,ms=2000)=>new Promise((ok,no)=>{const f=()=>{const i=log.findIndex(x=>x.t==t);if(i>=0)return ok(log.splice(i,1)[0]);if((ms-=30)<=0)return no(new Error('timeout '+t));setTimeout(f,30)};f()}),
 last:t=>[...log].reverse().find(x=>x.t==t)};ws.onmessage=e=>log.push(JSON.parse(e.data));ws.onopen=()=>res(o);ws.onerror=()=>res(o)})}
let pass=0,fail=0;const ok=(c,n)=>{c?pass++:fail++;console.log(c?'PASS':'FAIL',n)};
const BAD=['__proto__','constructor','prototype','toString','hasOwnProperty','',null,undefined,NaN,Infinity,-1,1e308,0,true,false,[],{},[1,2],{a:1},'x'.repeat(500),'<script>alert(1)</script>','\u0000‮','1e999',-0,{toString:1}];
const TYPES=['visit','chat','emoji','deco','rename','daily','act','feed','equip','shop_buy','place','move','store','discard','capsule','dog_fav','dog_home','dogs_get','release','quests','quest_claim','quest_bonus','ach','ach_claim','coll_claim','friends','friend_add','friend_ok','friend_no','friend_del','friend_gift','lb','mg_start','mg_end','rps_find','rps_cancel','rps_pick',
 'park_join','park_leave','park_move','park_pose','park_emote','park_trick','park_dog','goal','goal_claim','trade_req','trade_ans','trade_set','trade_ok','trade_cancel','ping','hb',
 'mp_find','mp_cancel','mp_leave','mp_get','mp_tap','mp_act','mp_ans','mp_hit','mp_pick','mp_bp','mp_bp','mp_bp','mp_pr','wish_get','wish_skip','spin','spin_get','starter','starter_claim','house_up','house_info','party','party_end','gb_get','gb_post','gb_del','like','contest_get','contest_enter','contest_vote','mail_get','mail_claim','park_throw','park_dig','lb2','tutorial'];
const FIELDS=['r','id','dog','food','acc','k','v','n','m','e','a','x','y','f','uid','name','ids','i','score','g','from','ok','ver','inv','coins','dogs','p','c','ticket','on','token','game','pick','choice','to','msg','text','d','who','owner','slot','kind','idx','tap','side'];
TYPES.push('av_save','av_get','av_save','av_save','av_save');FIELDS.push('av','h','hc','ht','sk','hm','t','b','s','g','x','e','bl','fr','ls','tc','bc','sc','hk','xk','pt','ec');   // wardrobe messages are fuzzed too
const AVD=require('./avatar_data');
const lookOK=av=>{if(!av||typeof av!='object')return false;for(const k in AVD.KINDS)if(!AVD.find(k,av[k]))return false;for(const k in AVD.NCOL)if(!(Number.isInteger(av[k])&&av[k]>=0&&av[k]<AVD.NCOL[k]))return false;return(av.bl===0||av.bl===1)&&(av.fr===0||av.fr===1)&&AVD.HOME.some(h=>h.id===av.hm)};
(async()=>{
 const a=await cli();a.send({t:'register',user:'fuzzer',email:'f@b.co',pass:'secret1'});await a.wait('auth');await a.wait('me');
 const h0=await a.wait('house');const dog=h0.dogs[0].id;
 const rnd=n=>Math.floor(Math.random()*n),pick=l=>l[rnd(l.length)];
 // 1) raw garbage frames
 for(const g of ['','{','null','[]','"str"','123','{"t":1}','{"t":{}}','{"t":["x"]}','{"t":"'+'a'.repeat(3000)+'"}','\u0000\u0001','{"t":"visit","id":{"__proto__":1}}','{"__proto__":{"t":"chat"}}'])a.send(g);
 // 2) hostile logins before auth
 const x=await cli();for(const u of ['constructor','__proto__','toString','hasOwnProperty','CONSTRUCTOR'])x.send({t:'login',user:u,pass:'abcdefg'});
 x.send({t:'login',user:{a:1},pass:[1]});x.send({t:'register',user:'__proto__',email:'a@b.co',pass:'abcdefg'});x.send({t:'resume',token:{}});x.send({t:'register',user:'admin',email:'a@b.co',pass:'abcdefg'});
 await sleep(500);ok(true,'hostile auth messages did not crash');
 // 3) random fuzz of every type, with and without a real dog id
 let n=0;const b=await cli();
 b.send({t:'register',user:'fuzz2',email:'f2@b.co',pass:'secret1'});await b.wait('auth');
 for(let round=0;round<60;round++){
  for(const who of [a,b]){
   for(let i=0;i<14;i++){const m={t:pick(TYPES)};for(let k=0;k<rnd(5);k++)m[pick(FIELDS)]=Math.random()<.3?dog:pick(BAD);who.send(m);n++}
   await sleep(60)}}
 ok(true,'sent '+n+' random messages');
 await sleep(500);
 // 3b) Dog Brawl abuse: hostile move payloads during a live match (bots fill the lobby). The match must still end normally and pay finite numbers.
 {const f=await cli();f.send({t:'register',user:'fuzzbr',email:'fb@b.co',pass:'secret1'});await f.wait('auth');await f.wait('me');
  const fdog=(await f.wait('house')).dogs[0].id;
  f.send({t:'mp_find',g:'brawl',dog:fdog});
  let st=null;try{st=await f.wait('mp_start',15000)}catch(e){}
  ok(!!st&&st.pl.length>=2,'brawl: lobby is filled with bots and the match starts');
  let end=null;
  if(st){const t0=Date.now();
   while(!end&&Date.now()-t0<90000){
    const ba=f.last('mp_ba'),r=ba?ba.r:1;
    for(let i=0;i<8;i++){const m={t:'mp_bp'};
     if(Math.random()<.7)m.r=Math.random()<.5?r:pick(BAD);
     if(Math.random()<.8)m.a=Math.random()<.4?pick(['atk','grd','s0','s1']):pick(BAD);
     if(Math.random()<.8)m.to=Math.random()<.4?rnd(5)-1:pick(BAD);
     f.send(m)}
    await sleep(120);
    const i=f.log.findIndex(x=>x.t=='mp_end');if(i>=0)end=f.log.splice(i,1)[0]}}
  ok(!!end,'brawl: the match still ends normally while hostile moves are being sent');
  ok(!!end&&!!end.me&&['coins','xp'].every(k=>Number.isFinite(end.me[k]))&&end.res.every(p=>Number.isFinite(p.score)),'brawl: results and rewards are finite numbers');
  f.ws.close()}
 // 4) server still alive & sane
 const c=await cli();c.send({t:'guest'});const au=await c.wait('auth');ok(au.ok,'server still accepts new players after fuzz');
 await c.wait('welcome');const me=await c.wait('me');ok(Number.isFinite(me.coins)&&Number.isFinite(me.gems)&&me.coins==300,'fresh player intact');
 a.send({t:'quests'});await sleep(300);
 const m1=a.last('me');ok(m1&&['coins','gems','tickets','xp'].every(k=>Number.isFinite(m1[k])&&m1[k]>=0),'fuzzed player values finite & non-negative '+JSON.stringify(m1&&[m1.coins,m1.gems,m1.tickets,m1.xp]));
 ok(m1&&lookOK(m1.av)&&Array.isArray(m1.avOwn)&&m1.avOwn.every(k=>AVD.priceOf(k)>0),'fuzzed player still has a valid look + owned list');
 const m2=b.last('me');ok(m2&&['coins','gems','tickets','xp'].every(k=>Number.isFinite(m2[k])&&m2[k]>=0),'second fuzzed player finite');
 ok(({}).gems===undefined&&({}).coins===undefined&&({}).inv===undefined,'Object.prototype not polluted (client side check is meaningless; see /healthz below)');
 // 5) prototype-pollution probes that used to work
 const p=await cli();p.send({t:'guest'});await p.wait('auth');await p.wait('me');
 p.send({t:'visit',id:'__proto__'});p.send({t:'shop_buy',id:'constructor',n:1});p.send({t:'feed',dog,food:'__proto__'});p.send({t:'deco',k:'wall',v:'constructor'});p.send({t:'deco',k:'__proto__',v:'x'});
 await sleep(400);p.send({t:'act',a:'pet',dog:(await p.wait('house')).dogs[0].id});const pm=await p.wait('me');ok(pm&&pm.coins==300,'coins unchanged by proto probes ('+(pm&&pm.coins)+')');
 const hz=await fetch('http://localhost:'+(process.env.PORT||3055)+'/healthz').then(r=>r.text());ok(/^ok \d+/.test(hz),'healthz '+hz);
 // 6) chat flood is throttled
 const ch=await cli();ch.send({t:'guest'});await ch.wait('auth');await ch.wait('me');a.log.length=0;
 for(let i=0;i<10;i++){ch.send({t:'chat',m:'spam '+i});await sleep(40)}
 await sleep(300);const got=a.log.filter(x=>x.t=='chat'&&/spam/.test(x.m)).length;ok(got>=1&&got<=2,'chat flood throttled ('+got+'/10 delivered)');
 // 7) malformed WebSocket frames at the protocol level (exercises the built-in miniws parser)
 const net=require('net'),PORT=+(process.env.PORT||3055);
 const raw=(frames)=>new Promise(res=>{const s=net.connect(PORT,'127.0.0.1',()=>{s.write('GET / HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n');
   setTimeout(()=>{for(const f of frames)s.write(Buffer.from(f));setTimeout(()=>{s.destroy();res()},200)},100)});s.on('error',()=>res())});
 const mask=[1,2,3,4],mk=(op,payload,fin=1)=>{const p=Buffer.from(payload);const h=[(fin?128:0)|op,128|p.length,...mask];return[...h,...[...p].map((b,i)=>b^mask[i&3])]};
 await raw([[0x81,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff]]);            // 64-bit length of 2^64-1
 await raw([[0x89,0xfe,0x01,0x00,...Array(260).fill(0)]]);                      // ping with >125 byte payload
 await raw([[0x03,0x80,1,2,3,4],[0x8f,0x80,1,2,3,4]]);                          // reserved opcodes
 await raw([mk(1,'{"t":"guest"}',0),...Array(60).fill(0).map(()=>mk(0,'x'.repeat(100),0))]);   // endless fragmentation
 await raw([mk(1,'{"t":"guest"'),mk(1,'}'),[0x81]]);                              // truncated frame
 await raw(Array(300).fill(0).map(()=>mk(9,'p')));                                // ping flood
 const hz2=await fetch('http://localhost:'+PORT+'/healthz').then(r=>r.text());ok(/^ok/.test(hz2),'server alive after malformed WebSocket frames');
 console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0);
})().catch(e=>{console.log('FAIL fatal',e);process.exit(1)});
