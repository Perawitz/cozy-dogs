// v6.2.1 server tests: fixes from the big bug hunt.
//   guests keep their identity after a dropped connection | heartbeat answer | tricky names | daily care-XP cap | PvP rock-paper-scissors cap + forfeit
//   leaderboards without zero scores | no trade during a game | friend-request flood | per-client rate limits behind a proxy
// PORT = the normal test server, PORT2 = the "fuzz" server (high message rate), PORTP = a server started with TRUST_PROXY_HOPS=2 (npm test starts all three).
const net=require('net'),crypto=require('crypto');
const PORT=process.env.PORT||3055,PORT2=process.env.PORT2||String(+PORT+1),PORTP=process.env.PORTP||String(+PORT+2);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let pass=0,fail=0;const ok=(c,n)=>{c?pass++:fail++;console.log(c?'PASS':'FAIL',n)};
function cli(port=PORT){return new Promise(res=>{const ws=new WebSocket('ws://localhost:'+port),log=[];const o={ws,log,me:null,send:m=>ws.readyState==1&&ws.send(JSON.stringify(m)),
 wait:(t,ms=3000,f)=>new Promise((ok,no)=>{const g=()=>{const i=log.findIndex(x=>x.t==t&&(!f||f(x)));if(i>=0)return ok(log.splice(i,1)[0]);if((ms-=25)<=0)return no(new Error('timeout '+t));setTimeout(g,25)};g()}),
 last:t=>[...log].reverse().find(x=>x.t==t),all:t=>log.filter(x=>x.t==t),clear:t=>{for(let i=log.length-1;i>=0;i--)if(!t||log[i].t==t)log.splice(i,1)}};
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.t=='me')o.me=m;log.push(m)};ws.onopen=()=>res(o)})}
const uid=Math.random().toString(36).slice(2,6);
async function reg(name,port=PORT){const c=await cli(port);c.send({t:'register',user:name,email:name+'@x.co',pass:'secret1'});const a=await c.wait('auth');if(!a.ok)throw new Error('register '+name+': '+a.err);c.name=name;c.token=a.token;await c.wait('me',2000).catch(()=>0);return c}
async function guest(port=PORT){const c=await cli(port);c.send({t:'guest'});const a=await c.wait('auth');c.name=a.name;c.token=a.token;c.auth=a;await c.wait('me',2000).catch(()=>0);return c}
async function tryReg(name,port=PORT){const c=await cli(port);c.send({t:'register',user:name,email:'a@b.co',pass:'secret1'});const a=await c.wait('auth',3000);c.ws.close();return a}
// a minimal WebSocket client that can send headers (the built-in one cannot): used for the proxy tests
function rawWs(port,headers){return new Promise((res,rej)=>{const s=net.connect(port,'127.0.0.1'),key=crypto.randomBytes(16).toString('base64');let buf=Buffer.alloc(0),up=false;
 const o={log:[],send(m){const p=Buffer.from(JSON.stringify(m)),mask=crypto.randomBytes(4),h=p.length<126?Buffer.from([0x81,0x80|p.length]):Buffer.from([0x81,0x80|126,p.length>>8,p.length&255]),b=Buffer.alloc(p.length);for(let i=0;i<p.length;i++)b[i]=p[i]^mask[i%4];s.write(Buffer.concat([h,mask,b]))},close(){s.destroy()},
  wait:(t,ms=3000)=>new Promise((ok,no)=>{const g=()=>{const i=o.log.findIndex(x=>x.t==t);if(i>=0)return ok(o.log.splice(i,1)[0]);if((ms-=25)<=0)return no(new Error('timeout '+t));setTimeout(g,25)};g()})};
 s.on('connect',()=>s.write('GET / HTTP/1.1\r\nHost: localhost\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: '+key+'\r\nSec-WebSocket-Version: 13\r\n'+Object.entries(headers).map(([k,v])=>k+': '+v+'\r\n').join('')+'\r\n'));
 s.on('data',d=>{buf=Buffer.concat([buf,d]);if(!up){const i=buf.indexOf('\r\n\r\n');if(i<0)return;up=true;buf=buf.slice(i+4);res(o)}
  while(buf.length>=2){let len=buf[1]&127,off=2;if(len==126){if(buf.length<4)return;len=buf.readUInt16BE(2);off=4}else if(len==127){if(buf.length<10)return;len=Number(buf.readBigUInt64BE(2));off=10}if(buf.length<off+len)return;const op=buf[0]&15,pl=buf.slice(off,off+len);buf=buf.slice(off+len);if(op==1)try{o.log.push(JSON.parse(pl.toString()))}catch{}}});
 s.on('error',rej)})}
async function rawAuth(port,xff,msg){const w=await rawWs(port,xff?{'X-Forwarded-For':xff}:{});w.send(msg);const a=await w.wait('auth',3000);w.close();return a}
(async()=>{
 // ---------- heartbeat + guests keep their identity
 const G=await guest();
 const house=G.last('house');const firstDog=house&&house.dogs[0]&&house.dogs[0].id;
 G.clear();G.send({t:'hb'});ok(!!(await G.wait('hb',1500).catch(()=>null)),'the server answers a heartbeat (the page uses it to notice a dead connection)');
 ok(typeof G.token=='string'&&G.token.length>20&&G.auth.guest===true,'a guest gets a login token too');
 const R=await cli();R.send({t:'resume',token:G.token});const ra=await R.wait('auth',2000);
 ok(ra.ok&&ra.name==G.name&&ra.guest===true,'after a dropped connection the SAME guest comes back ('+ra.name+')');
 await R.wait('house',2000).then(h=>ok(h.dogs[0]&&h.dogs[0].id==firstDog,'...with the same dog and progress'));
 ok(!!(await G.wait('kick',2000).catch(()=>null)),'the older connection of that guest is closed');
 const bad=await cli();bad.send({t:'resume',token:'nope'+uid});const ba=await bad.wait('auth',2000);ok(!ba.ok&&ba.exp===1,'a token the server does not know is reported as expired (the page then forgets it)');bad.ws.close();
 R.send({t:'logout',token:G.token});await sleep(200);const R2=await cli();R2.send({t:'resume',token:G.token});ok(!(await R2.wait('auth',2000)).ok,'logging out ends that guest login');R2.ws.close();
 R.ws.close();G.ws.close();

 // ---------- names
 const N=[['Adminั','a reserved name with a Thai vowel mark added'],['toLocaleString','an Object.prototype method name'],['__defineGetter__','__defineGetter__'],['isPrototypeOf','isPrototypeOf'],['฿฿฿฿','symbols only'],['ััั','only vowel marks'],['Guestั123','"guest" with a mark added']];
 for(const [n,d] of N){const a=await tryReg(n);ok(!a.ok,'name refused: '+d)}
 const thai='สมชาย'+uid.slice(0,2),T1=await tryReg(thai);ok(T1.ok,'a normal Thai name is accepted ('+thai+')');
 const mark='น้องหมา'+uid.slice(0,1),plain='นองหมา'+uid.slice(0,1);
 ok((await tryReg(mark)).ok,'a Thai name with tone marks is accepted');
 ok(!(await tryReg(plain)).ok,'the same name without the marks counts as taken');

 // ---------- care XP is capped per day (the actions cost nothing)
 const X=await reg('xp_a'+uid,PORT2);const xp0=X.me.xp,dog=(await X.wait('house',2000)).dogs[0].id;
 for(let i=0;i<400;i++){X.send({t:'act',a:'play',dog});if(i%50==49)await sleep(40)}
 await sleep(600);X.clear();X.send({t:'dogs_get'});await sleep(200);
 const me1=X.me;ok(me1.xp-xp0<=520&&me1.xp-xp0>=450,'400 plays (1200 xp if uncapped) gave only the daily care allowance ('+(me1.xp-xp0)+' xp)');
 ok(me1.coins<=300+50*(1+Math.floor((me1.xp)/100)),'...and the level-up coins stay in line with that ('+me1.coins+' coins, level '+me1.lvl+')');
 X.ws.close();

 // ---------- PvP rock-paper-scissors: same daily cap as the other online games, forfeit on close, a stale match does not block the next
 const A=await reg('rp_a'+uid,PORT2),B=await reg('rp_b'+uid,PORT2);const c0=A.me.coins;const lvl0=A.me.lvl;      // PORT2: its message limit is high enough for a quick loop
 for(let i=0;i<26;i++){A.clear('rps_result');B.clear('rps_result');A.send({t:'rps_find'});await A.wait('rps_wait',1500).catch(()=>0);B.send({t:'rps_find'});
  const sa=await A.wait('rps_start',2500).catch(()=>null);if(!sa||sa.bot){break}
  A.send({t:'rps_pick',v:'R'});B.send({t:'rps_pick',v:'S'});await A.wait('rps_result',2500).catch(()=>0);await B.wait('rps_result',2500).catch(()=>0)}
 await sleep(300);A.clear('me');await sleep(100);
 const aCoins=A.me.coins-c0-50*(A.me.lvl-lvl0);      // the level-ups the wins caused pay 50 coins each
 ok(aCoins==600,'26 wins against people paid 600 coins in total, not 780 ('+aCoins+' without the level-up bonus)');
 ok((A.me.stats.mp|0)>=20,'rock-paper-scissors counts as an online game for the quests / achievements (mp='+(A.me.stats.mp|0)+')');
 // forfeit: closing the window in the middle of a match ends it for both
 A.clear();B.clear();A.send({t:'rps_find'});await A.wait('rps_wait',1500).catch(()=>0);B.send({t:'rps_find'});await A.wait('rps_start',2500);await B.wait('rps_start',2500);
 A.send({t:'rps_cancel'});const rb=await B.wait('rps_result',2500).catch(()=>null);ok(rb&&rb.r>0,'when one player closes the window the other wins at once');
 A.clear();A.send({t:'rps_find'});ok(!!(await A.wait('rps_wait',1500).catch(()=>null)||await A.wait('rps_start',1500).catch(()=>null)),'...and the one who left can search again straight away');
 A.send({t:'rps_cancel'});

 // ---------- no trade while somebody is playing
 const TA=await reg('tr_a'+uid),TB=await reg('tr_b'+uid);
 TA.send({t:'rps_find'});await TA.wait('rps_wait',1500).catch(()=>0);const TC=await reg('tr_c'+uid);TC.send({t:'rps_find'});await TA.wait('rps_start',2500).catch(()=>0);
 TB.clear();TB.send({t:'trade_req',name:'tr_a'+uid});const tt=await TB.wait('toast',2000).catch(()=>null);ok(tt&&/เล่นเกม/.test(tt.m)&&!TA.last('trade_invite'),'a trade request to a player who is in a game is refused ('+(tt&&tt.m)+')');
 TA.send({t:'rps_cancel'});TC.send({t:'rps_cancel'});

 // ---------- leaderboards: nobody is ranked with 0
 const L=await reg('lb_a'+uid);L.send({t:'lb'});const lb=await L.wait('lb',2000);
 ok(['wins','likes','arcade','wishes'].every(k=>lb[k].every(x=>x.v>0)),'boards where 0 means "nothing yet" list nobody with a 0');
 ok(lb.rank.wins===0&&lb.rank.likes===0,'a player with 0 wins has no rank on that board ('+lb.rank.wins+')');
 ok(lb.rank.level>0,'...but still has a rank on the level board ('+lb.rank.level+')');
 L.ws.close();

 // ---------- daily reward shows the right day
 const D=await reg('dy_a'+uid);ok(D.me.dayNext===1&&D.me.canClaim===true,'a new player will get day 1 (dayNext='+D.me.dayNext+')');
 D.send({t:'daily'});await D.wait('daily_ok',2000);D.send({t:'ach'});const ach=await D.wait('ach',2000);
 ok(ach.list.find(a=>a.id=='streak7').prog==1,'the 7-day streak achievement counts the streak');D.ws.close();

 // ---------- friend requests cannot flood one player
 const V=await reg('fr_v'+uid);let refused=0;
 for(let i=0;i<44;i++){const f=await reg('fr_'+i+'_'+uid.slice(0,2));f.clear('toast');f.send({t:'friend_add',name:'fr_v'+uid});const t=await f.wait('toast',1500).catch(()=>null);if(t&&/ค้างเยอะ/.test(t.m))refused++;f.ws.close()}
 ok(refused>=4,'after 40 pending requests more are refused ('+refused+' refused)');
 await sleep(300);V.clear();V.send({t:'friends'});const fr=await V.wait('friends',2000);ok(fr.inReq.length<=40,'...so the list stays at 40 ('+fr.inReq.length+')');V.ws.close();

 // ---------- behind a proxy: every client has its own limits
 const stamp=Math.floor(Math.random()*200)+10,xf=(c,fake)=>(fake||'spoof')+', 5.5.'+stamp+'.'+c+', 10.0.0.1';
 let okc=0,lastErr='';for(let i=0;i<11;i++){const a=await rawAuth(PORTP,xf(1,'s'+i),{t:'register',user:'px'+uid+i,email:'a@b.co',pass:'secret1'});if(a.ok)okc++;else lastErr=a.err}
 ok(okc==10&&/บ่อย/.test(lastErr),'one client address may register 10 accounts per hour; the 11th is refused - and made-up addresses in front of the real one do not help ('+okc+')');
 const other=await rawAuth(PORTP,xf(2),{t:'register',user:'py'+uid,email:'a@b.co',pass:'secret1'});ok(other.ok,'a different client behind the same proxy is not affected');
 const lo=await rawAuth(PORTP,'1.1.1.1, 127.0.0.1, 10.0.0.1',{t:'register',user:'pz'+uid+'a',email:'a@b.co',pass:'secret1'});
 let loOk=0;for(let i=0;i<12;i++){const a=await rawAuth(PORTP,'1.1.1.1, 127.0.0.1, 10.0.0.1',{t:'register',user:'pz'+uid+'b'+i,email:'a@b.co',pass:'secret1'});if(a.ok)loOk++}
 ok(loOk<=9,'a client that claims to be 127.0.0.1 is still rate limited ('+(loOk+(lo.ok?1:0))+' of 13 registered)');
 let logins=0;for(let i=0;i<32;i++){const a=await rawAuth(PORTP,xf(3),{t:'login',user:'py'+uid,pass:'secret1'});if(a.ok)logins++}
 ok(logins==32,'successful logins do not use up the per-address limit of failed attempts ('+logins+'/32)');
 let wrong=0,busy=0;for(let i=0;i<30;i++){const a=await rawAuth(PORTP,xf(4),{t:'login',user:'py'+uid,pass:'wrong'+i});if(!a.ok){if(a.busy)busy++;else wrong++}}
 ok(wrong>=20&&busy>=1,'but wrong passwords are limited per address ('+wrong+' answered, '+busy+' blocked)');
 console.log('\nPASS',pass,'FAIL',fail);process.exit(fail?1:0)})().catch(e=>{console.error('ERR',e);process.exit(1)});
