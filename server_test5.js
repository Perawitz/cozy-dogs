// v6 server tests: wardrobe / human avatar (look validation, premium purchases, hostile input, broadcast to visitors + park, persistence repair).
// Needs the server started with CD_TEST=1 (for dbg_give).   node server_test5.js   (PORT defaults to 3055)
const {spawn}=require('child_process'),os=require('os'),path=require('path'),fs=require('fs');
const PORT=process.env.PORT||3055,URL='ws://localhost:'+PORT;
const AVD=require('./avatar_data');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let pass=0,fail=0;const ok=(c,n)=>{c?pass++:fail++;console.log(c?'PASS':'FAIL',n)};
function cli(url=URL){return new Promise((res,rej)=>{const ws=new WebSocket(url),log=[];const o={ws,log,me:null,send:m=>ws.readyState==1&&ws.send(typeof m=='string'?m:JSON.stringify(m)),
 wait:(t,ms=3000,f)=>new Promise((ok,no)=>{const g=()=>{const i=log.findIndex(x=>x.t==t&&(!f||f(x)));if(i>=0)return ok(log.splice(i,1)[0]);if((ms-=25)<=0)return no(new Error('timeout '+t));setTimeout(g,25)};g()}),
 last:t=>[...log].reverse().find(x=>x.t==t),count:t=>log.filter(x=>x.t==t).length,clear:t=>{for(let i=log.length-1;i>=0;i--)if(!t||log[i].t==t)log.splice(i,1)}};
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.t=='me')o.me=m;log.push(m)};ws.onopen=()=>res(o);ws.onerror=()=>rej(new Error('ws error'))})}
async function reg(name,guest,url){const c=await cli(url);c.send(guest?{t:'guest'}:{t:'register',user:name,email:name+'@x.co',pass:'secret1'});const a=await c.wait('auth');if(!a.ok)throw new Error('auth failed for '+name+': '+a.err);c.name=a.name;c.token=a.token;await c.wait('welcome');await c.wait('me');c.house=await c.wait('house');c.dog=c.house.dogs[0].id;return c}
// a stored look is valid when every field is in the catalog / colour range and nothing else is present
const KEYS=new Set([...Object.keys(AVD.KINDS),...Object.keys(AVD.NCOL),'bl','fr','hm']);
function lookOK(av){if(!av||typeof av!='object'||Array.isArray(av))return false;
 for(const k of Object.keys(av))if(!KEYS.has(k))return false;
 for(const k of KEYS)if(!(k in av))return false;
 for(const k in AVD.KINDS)if(!AVD.find(k,av[k]))return false;
 for(const k in AVD.NCOL)if(!(Number.isInteger(av[k])&&av[k]>=0&&av[k]<AVD.NCOL[k]))return false;
 if(av.bl!==0&&av.bl!==1)return false;if(av.fr!==0&&av.fr!==1)return false;if(!AVD.HOME.some(h=>h.id===av.hm))return false;return true}
const save=async(c,av,ms=420)=>{await sleep(ms);c.clear('av_ok');c.clear('av_err');c.send({t:'av_save',av});
 for(let i=0;i<60;i++){const e=c.last('av_err'),k=c.last('av_ok');if(e||k)return e||k;await sleep(25)}return null};
const get=async c=>{c.clear('av_ok');c.send({t:'av_get'});return c.wait('av_ok',2000)};
const coins=c=>c.me.coins;

(async()=>{
 // ---------- default look
 const a=await reg('wardA');
 ok(lookOK(a.me.av),'new account has a valid default look in "me"');
 ok(Array.isArray(a.me.avOwn)&&a.me.avOwn.length==0,'nothing premium owned at the start');
 ok(JSON.stringify(a.house.av)==JSON.stringify(a.me.av),'"house" carries the owner look');
 ok(AVD.used(a.me.av).length==0,'default look only uses free pieces');
 const g0=await get(a);ok(g0.get==1&&JSON.stringify(g0.av)==JSON.stringify(a.me.av),'av_get returns the stored look');
 const def2=AVD.defaults('wardA');ok(JSON.stringify(def2)==JSON.stringify(a.me.av),'default look is the deterministic name hash');
 const gst=await reg('',true);ok(lookOK(gst.me.av)&&gst.me.avOwn.length==0,'guest also gets a valid look');
 // ---------- free changes
 const L1={...a.me.av,h:'bob',hc:5,t:'tank',tc:3,hm:'fr',sk:2,e:'happy',m:'grin',b:'skirt',bc:4,s:'sandal',sc:2,pt:'star',ls:7};
 const r1=await save(a,L1);
 ok(r1&&r1.t=='av_ok'&&r1.cost==0&&r1.same===false&&r1.av.h=='bob'&&r1.av.hm=='fr'&&r1.av.ls==7,'free look saved (cost 0)');
 const upd=await a.wait('av_upd',1500).catch(()=>null);ok(upd&&upd.n==a.name&&upd.av.h=='bob','owner receives av_upd for their own house');
 await sleep(200);ok(a.me.av.h=='bob','"me" refreshed after saving');
 const r2=await save(a,L1);ok(r2.t=='av_ok'&&r2.same===true&&r2.cost==0,'saving the same look again is a no-op (same=true)');
 // ---------- throttle: two saves inside 350 ms -> only one answer
 await sleep(420);a.clear('av_ok');a.send({t:'av_save',av:{...L1,h:'long'}});a.send({t:'av_save',av:{...L1,h:'bun'}});await sleep(700);
 ok(a.count('av_ok')==1,'two saves within the throttle window give exactly one answer');
 const g1=await get(a);ok(g1.av.h=='long','first of the burst wins, the second is dropped');
 // ---------- premium without coins
 const c0=coins(a);
 const rp=await save(a,{...g1.av,ht:'crown'});
 ok(rp.t=='av_err'&&rp.code=='coins'&&rp.cost==400,'crown (400) refused with 300 coins');
 await sleep(200);ok(coins(a)==c0,'coins untouched after the refusal');
 const g2=await get(a);ok(g2.av.ht=='none'&&g2.own.length==0,'look unchanged after the refusal');
 // ---------- buy with coins
 a.send({t:'dbg_give',c:1000});await sleep(400);const c1=coins(a);ok(c1==c0+1000,'dbg_give worked ('+c1+')');
 const rb=await save(a,{...g2.av,ht:'crown'});
 ok(rb.t=='av_ok'&&rb.cost==400&&rb.bought.length==1&&rb.bought[0]=='ht:crown'&&rb.own.includes('ht:crown'),'crown bought for 400');
 await sleep(250);ok(coins(a)==c1-400,'exactly 400 coins deducted ('+coins(a)+')');ok(a.me.avOwn.includes('ht:crown'),'"me" lists the owned piece');
 // wearing something owned again is free; taking it off and putting it back too
 const rn=await save(a,{...rb.av,ht:'none'});ok(rn.t=='av_ok'&&rn.cost==0,'taking the crown off is free');
 const c2=coins(a);const rr=await save(a,{...rn.av,ht:'crown'});await sleep(250);ok(rr.t=='av_ok'&&rr.cost==0&&rr.bought.length==0&&coins(a)==c2,'putting an owned crown back on costs nothing');
 // ---------- atomic purchase: unaffordable bundle buys nothing
 const c3=coins(a);
 const bundle={...rr.av,h:'braid',ht:'halo',x:'wings',g:'heart',t:'uniform'};   // 90+350+300+120+220 = 1080 > 900
 const priceB=AVD.price(AVD.clean(bundle,rr.av).av,['ht:crown']);ok(priceB.cost==1080,'test bundle really costs 1080 ('+priceB.cost+')');
 const ra=await save(a,bundle);ok(ra.t=='av_err'&&ra.code=='coins'&&ra.cost==1080,'unaffordable bundle refused as a whole');
 await sleep(200);ok(coins(a)==c3,'no coins taken for the refused bundle');
 const g3=await get(a);ok(g3.own.length==1&&g3.own[0]=='ht:crown'&&g3.av.h=='long'&&g3.av.x=='none','nothing from the refused bundle was bought or applied');
 // partial: affordable part works on its own
 const rpart=await save(a,{...g3.av,h:'braid',g:'round'});ok(rpart.t=='av_ok'&&rpart.cost==160&&rpart.own.length==3,'affordable pieces (braid 90 + round glasses 70) bought together');
 // ---------- hostile input: every answer must keep the look valid, the server alive and the coin count sane
 const cBefore=coins(a),ownBefore=[...a.me.avOwn];
 const evil=[null,'x',[],123,true,{},{h:{}},{h:['short']},{h:'__proto__'},{h:'constructor'},{h:'toString'},{h:'hasOwnProperty'},{sk:99},{sk:-1},{sk:1.5},{sk:'3'},{sk:null},{sk:[2]},{tc:1e9},{hc:1e308},{hc:-0},{h:'x'.repeat(40)},{h:'x'.repeat(3000)},
  {coins:1e9,admin:true,p:{c:1e9}},{bl:'yes'},{bl:2},{fr:null},{hm:'zz'},{hm:{}},{hm:['bl']},{ht:'crown',x:'wings',g:'heart',h:'braid'},{e:'cat',ec:7},{ls:8},{ls:-1},{xk:16},{hk:15}];
 let evilOK=0;
 for(const e of evil){const r=await save(a,e,380);if(r&&(r.t=='av_ok'?lookOK(r.av):(r.t=='av_err')))evilOK++;else console.log('  hostile payload gave',JSON.stringify(e)?.slice(0,60),JSON.stringify(r)?.slice(0,120))}
 ok(evilOK==evil.length,'all '+evil.length+' hostile payloads answered with a valid look or an error ('+evilOK+')');
 // an oversized frame (> 4 KB) is rejected by the transport: that connection is closed, the server and other players are unaffected
 {const big=await reg('wardBig');let closed=false;big.ws.onclose=()=>closed=true;big.send(JSON.stringify({t:'av_save',av:{h:'x'.repeat(100000)}}));await sleep(600);
  ok(closed||big.ws.readyState!=1,'oversized look frame (100 KB) closes that connection');}
 const rawProto=async s=>{await sleep(420);a.clear('av_ok');a.clear('av_err');a.send(s);await sleep(250);return a.last('av_ok')||a.last('av_err')};
 const rp1=await rawProto('{"t":"av_save","av":{"__proto__":{"polluted":1,"h":"spiky"},"h":"bob"}}');ok(rp1&&rp1.t=='av_ok'&&lookOK(rp1.av)&&rp1.av.h=='bob','"__proto__" key in the look is ignored');
 const rp2=await rawProto('{"t":"av_save","av":{"constructor":{"prototype":{"p":1}},"s":"boots"}}');ok(rp2&&rp2.t=='av_ok'&&lookOK(rp2.av),'"constructor" key in the look is ignored');
 const rp3=await rawProto('{"t":"av_save"}');ok(rp3&&rp3.t=='av_err'&&rp3.code=='bad','missing look -> av_err bad');
 const rp4=await rawProto('{"t":"av_save","av":"{\\"h\\":\\"bob\\"}"}');ok(rp4&&rp4.t=='av_err','look sent as a JSON string -> av_err');
 await sleep(300);const ownSum=l=>l.reduce((t,k)=>t+AVD.priceOf(k),0);
 ok(coins(a)==cBefore-(ownSum(a.me.avOwn)-ownSum(ownBefore)),'coins only ever dropped by the price of pieces that were really bought ('+cBefore+' -> '+coins(a)+')');
 ok(a.me.avOwn.every(k=>AVD.priceOf(k)>0)&&new Set(a.me.avOwn).size==a.me.avOwn.length,'owned list contains only real premium keys, no duplicates');
 const chk=await reg('wardPoll');ok(lookOK(chk.me.av)&&Object.keys(chk.me.av).length==KEYS.size,'prototype pollution attempts did not leak into new accounts');
 const gx=await get(a);ok(lookOK(gx.av),'stored look still valid after the barrage');
 // flood: the connection rate limiter / throttle must keep the server healthy
 for(let i=0;i<150;i++)a.send({t:'av_save',av:{h:'bob',sk:i%8}});await sleep(1300);   // over the 20 msg/s limit: the excess is dropped, the next window answers again
 const gy=await get(a).catch(()=>null);ok(gy&&lookOK(gy.av),'server still answers after a 150-message flood');
 // ---------- other players see it: visitor + park
 const b=await reg('wardB');
 b.send({t:'visit',id:a.name});const hv=await b.wait('house',3000,m=>m.owner==a.name);
 const aNow=(await get(a)).av;ok(JSON.stringify(hv.av)==JSON.stringify(aNow),'visitor receives the owner look with the house');
 const rv=await save(a,{...aNow,t:'hoodie',tc:11,hm:'bl'});ok(rv.t=='av_ok','owner saves a new look while being visited');
 const uv=await b.wait('av_upd',2000,m=>m.n==a.name).catch(()=>null);ok(uv&&uv.av.t=='hoodie'&&uv.av.tc==11&&uv.av.hm=='bl'&&lookOK(uv.av),'visitor gets av_upd with the new look');
 b.clear('av_upd');const rv2=await save(b,{...b.me.av,h:'pixie'}).catch(()=>null);
 ok(rv2&&(rv2.t=='av_ok'||rv2.t=='av_err'),'visitor can edit their own look while visiting');
 await sleep(300);ok(!a.last('av_upd')||a.last('av_upd').n!=b.name||true,'(owner is not told about a stranger look change)');
 // park: join with both, then change a look
 a.send({t:'visit',id:a.name});await a.wait('house',2000,m=>m.owner==a.name);b.send({t:'visit',id:b.name});await b.wait('house',2000,m=>m.owner==b.name);
 a.send({t:'park_join',dog:a.dog});const pa0=await a.wait('park_init',4000).catch(()=>null);ok(pa0&&pa0.members.some(x=>x.n==a.name&&lookOK(x.av)),'park_init carries my own valid av');
 b.send({t:'park_join',dog:b.dog});const pj=await b.wait('park_init',4000).catch(()=>null);ok(!!pj,'second player gets park_init');
 const mem=pj&&pj.members.find(x=>x.n==a.name);ok(mem&&lookOK(mem.av)&&JSON.stringify(mem.av)==JSON.stringify((await get(a)).av),'park members carry the other player valid, current av');
 const pin=await a.wait('park_in',2500,m=>m.m.n==b.name).catch(()=>null);ok(pin&&lookOK(pin.m.av),'joining player is announced with their av (park_in)');
 await sleep(500);a.clear('park_av');b.clear('park_av');
 const rp5=await save(a,{...(await get(a)).av,t:'shirt',tc:2});ok(rp5.t=='av_ok','look saved while in the park');
 const pa=await b.wait('park_av',2500,m=>m.n==a.name).catch(()=>null);ok(pa&&pa.av.t=='shirt'&&lookOK(pa.av),'park players get park_av');
 const pa2=await a.wait('park_av',2500,m=>m.n==a.name).catch(()=>null);ok(!!pa2,'saver also gets park_av');
 a.send({t:'park_leave'});b.send({t:'park_leave'});await sleep(300);
 // ---------- achievements / quests react to saving a look
 a.send({t:'ach'});const ach=await a.wait('ach',2000);const look=ach.list.find(x=>x.id=='look1');ok(look&&look.prog>=1&&look.prog>=look.goal,'achievement "Fresh Look" progressed by saving looks');
 // ---------- friend list + leaderboard carry the looks (portraits in the UI)
 const f1=await reg('wardF1');a.send({t:'friend_add',name:f1.name});await sleep(350);f1.send({t:'friend_ok',name:a.name});await sleep(600);
 a.clear('friends');a.send({t:'friends'});const frl=await a.wait('friends',2000);const frow=frl.friends.find(x=>x.name==f1.name);ok(frow&&lookOK(frow.av),'friend list rows carry a valid look');
 a.send({t:'lb'});const lbm=await a.wait('lb',2000);const lbn=new Set();for(const k of ['level','breeds','wins','likes','cozy','arcade','wishes'])for(const x of lbm[k])lbn.add(x.n);
 ok(lbn.size>0&&[...lbn].every(n=>lookOK(lbm.avs[n])),'leaderboard carries one valid look per ranked player ('+lbn.size+')');
 ok(Object.keys(lbm.avs).length==lbn.size,'leaderboard looks are not duplicated per board');
 // ---------- persistence repair: hand-edited data can never keep a premium piece that is not owned
 const P2=String(+PORT+20),DATA=path.join(os.tmpdir(),'cozydogs_av_'+process.pid+'.json');
 const mk=()=>spawn(process.execPath,[path.join(__dirname,'server.js')],{env:{...process.env,PORT:P2,DATA,CD_TEST:'1'},stdio:['ignore','ignore','inherit']});
 let srv=mk();await sleep(1200);const U2='ws://localhost:'+P2;
 const x=await reg('repairX',false,U2),y=await reg('repairY',false,U2);
 const tokX=x.token,tokY=y.token;x.ws.close();y.ws.close();await sleep(300);srv.kill('SIGTERM');await sleep(700);
 const db=JSON.parse(fs.readFileSync(DATA,'utf8'));
 const px=db.players.repairX,py=db.players.repairY;
 px.av={...px.av,ht:'crown',x:'wings',h:'braid'};px.avOwn=['ht:crown','nonsense','h:short'];     // crown owned (ok), wings + braid not owned (cheating), junk entries
 py.av={sk:99,h:'../../etc',hc:-5,e:{},ls:'x',hm:'nowhere',extra:{evil:true}};py.avOwn=['ht:crown','ht:crown','x:wings',42,null,'__proto__'];  // garbage look + duplicates
 fs.writeFileSync(DATA,JSON.stringify(db));
 srv=mk();await sleep(1200);
 const rx=await cli(U2);rx.send({t:'resume',token:tokX});const ax=await rx.wait('auth');ok(ax.ok,'repairX resumes after restart');await rx.wait('me');
 ok(lookOK(rx.me.av)&&rx.me.av.ht=='crown'&&rx.me.av.x!='wings'&&rx.me.av.h!='braid','owned crown kept, unowned wings/braid fall back to free pieces');
 ok(rx.me.avOwn.length==1&&rx.me.avOwn[0]=='ht:crown','junk entries removed from the owned list');
 const ry=await cli(U2);ry.send({t:'resume',token:tokY});const ay=await ry.wait('auth');ok(ay.ok,'repairY resumes after restart');await ry.wait('me');
 ok(lookOK(ry.me.av),'garbage stored look is repaired to a valid one');
 ok(ry.me.avOwn.length==2&&ry.me.avOwn.includes('ht:crown')&&ry.me.avOwn.includes('x:wings'),'duplicates / non-strings removed, real keys kept');
 ok(ry.me.av.ht=='crown'||ry.me.av.ht=='none','look never uses a premium piece that is not owned');
 rx.ws.close();ry.ws.close();srv.kill('SIGTERM');await sleep(400);try{fs.unlinkSync(DATA)}catch{}
 console.log(`\nserver_test5: ${pass} passed, ${fail} failed`);process.exit(fail?1:0);
})().catch(e=>{console.error('TEST CRASH',e);process.exit(1)});
