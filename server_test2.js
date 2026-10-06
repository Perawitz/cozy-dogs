// Tests for v4 online features: Park, Trading, Community goal. Run via `npm test` (starts its own server).
const URL='ws://localhost:'+(process.env.PORT||3055);
function cli(){return new Promise(res=>{const ws=new WebSocket(URL),log=[];const o={ws,log,send:m=>ws.send(JSON.stringify(m)),
 wait:(t,ms=2000,f=null)=>new Promise((ok,no)=>{const g=()=>{const i=log.findIndex(x=>x.t==t&&(!f||f(x)));if(i>=0)return ok(log.splice(i,1)[0]);if((ms-=30)<=0)return no(new Error('timeout '+t));setTimeout(g,30)};g()}),
 tw:async()=>{await new Promise(r=>setTimeout(r,250));const l=log.filter(x=>x.t=='toast');for(let i=log.length-1;i>=0;i--)if(log[i].t=='toast')log.splice(i,1);return l.at(-1)||{m:''}},
 last:t=>[...log].reverse().find(x=>x.t==t),clear:t=>{for(let i=log.length-1;i>=0;i--)if(!t||log[i].t==t)log.splice(i,1)}};
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.t=='me')o.me=m;log.push(m)};ws.onopen=()=>res(o)})}
let pass=0,fail=0;const ok=(c,n)=>{c?pass++:fail++;console.log(c?'PASS':'FAIL',n)};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const U='x'+Math.random().toString(36).slice(2,6);
(async()=>{
 const reg=async n=>{const c=await cli();c.send({t:'register',user:n,email:n+'@t.co',pass:'secret1'});const au=await c.wait('auth');if(!au.ok)throw new Error('reg '+n+' '+au.err);await c.wait('me');c.g0=await c.wait('goal');return c};
 const a=await reg('al'+U),b=await reg('bo'+U),A='al'+U,B='bo'+U;
 // ---------- community goal
 let g=a.g0;ok(g&&g.id=='pet'&&g.target>0&&g.tiers.length==3&&g.me==0&&g.ends>Date.now(),'goal message on login (CD_GOAL=pet)');
 a.send({t:'goal_claim',i:0});let r=await a.tw();ok(/ยังรับ/.test(r.m),'claim blocked before contributing');
 // ---------- park
 a.send({t:'park_join'});const ia=await a.wait('park_init');ok(ia.members.length==1&&ia.cfg.walk==120&&ia.ball,'park_init');
 b.send({t:'park_join'});const ib=await b.wait('park_init');ok(ib.members.length==2,'second join sees both');
 const pin=await a.wait('park_in');ok(pin.m.n==B&&pin.m.breed,'other member gets park_in');
 a.send({t:'park_move',x:999999,y:-50});await sleep(150);a.clear('park_s');
 b.clear('park_s');a.send({t:'park_move',x:ia.members[0].x+200,y:ia.members[0].y});
 await sleep(500);let sn=b.last('park_s');let mine=sn&&sn.m.find(x=>x[0]==A);ok(mine&&mine[1]<ia.members[0].x+200&&mine[5]=='walk','server moves dog gradually (speed-capped), not teleport');
 // out-of-bounds clamp: target clamped inside map
 a.send({t:'park_move',x:5000,y:5000});await sleep(250);sn=b.last('park_s');mine=sn&&sn.m.find(x=>x[0]==A);ok(mine&&mine[3]==766&&mine[4]==530,'target clamped to park bounds');
 // emotes
 b.clear('park_fx');a.send({t:'park_emote',e:'💩'});a.send({t:'park_emote',e:'❤️'});const fx=await b.wait('park_fx');ok(fx.n==A&&fx.k=='emote'&&fx.v=='❤️'&&!b.last('park_fx'),'emote broadcast, invalid emote ignored');
 a.send({t:'park_pose',p:'sit'});const fp=await b.wait('park_fx',1500,x=>x.k=='pose');ok(fp.v=='sit','pose broadcast');
 a.send({t:'park_trick',k:'spin'});await sleep(250);ok(!b.log.some(x=>x.t=='park_fx'&&x.k=='trick'),'unknown trick rejected');
 // ball kick: walk through the ball
 b.send({t:'park_move',x:400,y:300});b.clear('park_s');let kicked=false;
 for(let i=0;i<30&&!kicked;i++){await sleep(100);kicked=b.log.some(x=>x.t=='park_s'&&x.b&&(Math.abs(x.b[2])+Math.abs(x.b[3])>50))}
 ok(kicked,'walking into the ball kicks it (shared physics)');
 // treats
 a.clear('park_item');await sleep(150);const pk0=(a.me||{stats:{}}).stats.park||0;      // forget treats that were already spawned (and maybe collected) earlier in this test; read the count BEFORE waiting: a new treat can spawn right under the dog
 const add=await a.wait('park_item',9000,x=>x.add);ok(add.add.k&&add.add.x>0,'treat spawned');
 const before=a.me?.coins??0;
 a.send({t:'park_move',x:add.add.x,y:add.add.y,run:1});
 let del=null;try{del=await a.wait('park_item',7000,x=>x.del==add.add.id)}catch{}
 // another treat could be taken by the other dog (bob walks elsewhere) - if so just verify protocol
 ok(del&&del.by,'treat collected by a dog (server decides) ');
 if(del&&del.by==A){await sleep(200);const m2=a.me;ok(m2&&(m2.stats.park||0)>=pk0+1,'collector stat updated: '+JSON.stringify(m2&&m2.stats.park)+' pk0='+pk0)}else ok(true,'(other collected)');
 // goal progress via pets
 a.send({t:'park_leave'});const out=await b.wait('park_out');ok(out.n==A,'park_out broadcast');
 a.send({t:'visit',id:A});const hs=await a.wait('house');const dogs=hs.dogs;
 for(let i=0;i<45;i++){a.send({t:'act',a:'pet',dog:dogs[0].id});if(i%12==11)await sleep(1100)}
 await sleep(3300);g=a.last('goal');ok(g&&g.me>=40,'pets count toward community goal: me='+(g&&g.me));
 ok(g.top[0].n==A,'top contributor listed');
 a.send({t:'goal_claim',i:0});r=await a.tw();ok(/🌍/.test(r.m)||g.tiers[0].can===false,'tier-0 claim flow: '+r.m+' (target '+g.target+', total '+g.total+')');
 // ---------- trading
 a.send({t:'shop_buy',id:'cake',n:2});await a.wait('buy_ok');b.send({t:'shop_buy',id:'bone',n:1});await b.wait('buy_ok');
 a.send({t:'trade_req',name:'nobody'});r=await a.tw();ok(/ออนไลน์/.test(r.m),'trade with offline player rejected');
 a.send({t:'trade_req',name:B});await a.tw();const inv=await b.wait('trade_inv');ok(inv.from==A,'trade invite delivered');
 b.send({t:'trade_ans',from:A,ok:true});let va=await a.wait('trade'),vb=await b.wait('trade');ok(va.with==B&&vb.with==A&&va.ver==0&&va.av.cake==2,'trade window opens for both');
 a.send({t:'trade_set',inv:{cake:5},coins:0});r=await a.tw();ok(/ไม่พอ/.test(r.m),'over-offer rejected (more than owned)');
 a.send({t:'trade_set',inv:{kibble:1},coins:9999});r=await a.tw();ok(/ไม่พอ/.test(r.m),'coin over-offer rejected');
 a.clear('trade');b.clear('trade');a.send({t:'trade_set',inv:{cake:1},coins:50});va=await a.wait('trade');vb=await b.wait('trade');ok(vb.theirs.inv.cake==1&&vb.theirs.coins==50&&vb.ver==1,'offer visible to partner');
 a.send({t:'trade_ok',v:true,ver:0});await sleep(250);ok(!a.log.some(x=>x.t=='trade_end'),'confirm with stale version is ignored');a.clear();b.clear();
 b.send({t:'trade_set',inv:{bone:1},coins:10});va=await a.wait('trade',2000,x=>x.ver==2);ok(va.theirs.inv.bone==1&&!va.myOk,'partner edit resets confirmations');
 const ca=a.me.coins,cb=b.me.coins;a.send({t:'trade_ok',v:true,ver:2});await a.wait('trade',2000,x=>x.myOk);b.send({t:'trade_ok',v:true,ver:2});
 const ea=await a.wait('trade_end'),eb=await b.wait('trade_end');ok(ea.ok&&eb.ok,'both confirmed -> trade executed');
 await sleep(250);const ma=a.me,mb=b.me;
 ok(ma.inv.cake==1&&ma.inv.bone==1&&mb.inv.cake==1&&!mb.inv.bone,'items swapped: alice cake='+ma.inv.cake+' bone='+ma.inv.bone+' | bob cake='+mb.inv.cake+' bone='+mb.inv.bone);
 ok(ma.coins==ca-50+10&&mb.coins==cb+50-10,'coins moved: alice '+ca+'->'+ma.coins+', bob '+cb+'->'+mb.coins);
 ok((ma.stats.trade||0)==1&&(mb.stats.trade||0)==1,'trade stat counted');
 // dog trade
 a.send({t:'capsule',n:1});await a.wait('capsule');await sleep(150);a.send({t:'dogs_get'});const all=await a.wait('dogs_all');ok(all.dogs.length==2,'alice has 2 dogs');
 const spare=all.dogs.find(d=>d.id!=dogs[0].id);
 await sleep(3100);a.send({t:'trade_req',name:B});await a.tw();await b.wait('trade_inv');b.send({t:'trade_ans',from:A,ok:true});await a.wait('trade');await b.wait('trade');
 a.send({t:'trade_set',dogs:[dogs[0].id,spare.id]});r=await a.tw();ok(/อย่างน้อย 1|แลกหมา/.test(r.m),'cannot trade away every dog');
 a.send({t:'trade_set',dogs:[spare.id]});await a.wait('trade',2000,x=>x.mine.dogs.length==1);a.clear('trade');b.clear('trade');
 let tv=null;b.send({t:'trade_ok',v:true,ver:1});tv=await b.wait('trade');a.send({t:'trade_ok',v:true,ver:1});await a.wait('trade_end');
 await sleep(250);ok(a.me.total==1&&b.me.total==2,'dog moved to bob: alice '+a.me.total+', bob '+b.me.total);
 // cancel + disconnect
 await sleep(3100);a.send({t:'trade_req',name:B});await a.tw();await b.wait('trade_inv');b.send({t:'trade_ans',from:A,ok:true});await a.wait('trade');await b.wait('trade');
 b.clear('trade_end');a.send({t:'trade_cancel'});const ce=await b.wait('trade_end');ok(!ce.ok,'cancel notifies partner');
 await sleep(3100);a.send({t:'trade_req',name:B});await a.tw();await b.wait('trade_inv');b.send({t:'trade_ans',from:A,ok:true});await a.wait('trade');await b.wait('trade');
 a.clear('trade_end');b.ws.close();const de=await a.wait('trade_end');ok(!de.ok&&/ออกจากเกม/.test(de.why),'disconnect cancels trade');
 const gu=await cli();gu.send({t:'guest'});await gu.wait('auth');await gu.wait('me');gu.send({t:'trade_req',name:A});r=await gu.tw();ok(/Guest/.test(r.m),'guests cannot trade');
 console.log('\nPASS',pass,'FAIL',fail);process.exit(fail?1:0);
})().catch(e=>{console.log('ERR',e.message);process.exit(2)});
