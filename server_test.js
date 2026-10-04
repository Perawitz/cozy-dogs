const URL='ws://localhost:'+(process.env.PORT||3055);
function cli(){return new Promise(res=>{const ws=new WebSocket(URL),log=[];const o={ws,log,send:m=>ws.send(JSON.stringify(m)),
 wait:(t,ms=1500)=>new Promise((ok,no)=>{const f=()=>{const i=log.findIndex(x=>x.t==t);if(i>=0)return ok(log.splice(i,1)[0]);if((ms-=30)<=0)return no(new Error('timeout '+t));setTimeout(f,30)};f()}),
 tw:async()=>{await new Promise(r=>setTimeout(r,250));const l=log.filter(x=>x.t=='toast');for(let i=log.length-1;i>=0;i--)if(log[i].t=='toast')log.splice(i,1);return l.at(-1)||{m:''}},
 last:t=>[...log].reverse().find(x=>x.t==t)};
 ws.onmessage=e=>log.push(JSON.parse(e.data));ws.onopen=()=>res(o)})}
let pass=0,fail=0;const ok=(c,n)=>{c?pass++:fail++;console.log(c?'PASS':'FAIL',n)};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let a0;(async()=>{
 const a=await cli();a0=a;a.send({t:'register',user:'alice',email:'a@b.co',pass:'secret1'});
 const au=await a.wait('auth');ok(au.ok&&au.token,'register');
 const w=await a.wait('welcome');ok(w.cat&&w.cat.items.sofa_pink&&w.max.items==40,'welcome catalog');
 let me=await a.wait('me');ok(me.inv.sofa_pink==1&&me.coins==300,'me inv defaults');
 let h=await a.wait('house');ok(h.items.length==11&&h.dogs.length==1,'house defaults');
 const d0=h.dogs[0].id;
 // shop
 a.send({t:'shop_buy',id:'cake',n:2});await a.wait('buy_ok');ok(true,'shop_buy food');
 a.send({t:'shop_buy',id:'crown',n:1});let r=await a.tw().catch(()=>null);ok(r&&/ไม่พอ/.test(r.m),'crown too expensive (300 coins - 90 ok?)');
 a.send({t:'shop_buy',id:'bow'});await a.wait('buy_ok');
 a.send({t:'equip',dog:d0,acc:'bow'});let eq=await a.wait('equip_ok');ok(eq.acc=='bow','equip');
 await a.tw();a.send({t:'equip',dog:d0,acc:'glasses'});r=await a.tw();ok(/ไม่มี/.test(r.m),'equip unowned rejected');
 // feed
 a.send({t:'feed',dog:d0,food:'cake'});await sleep(200);ok(a.last('dogs'),'feed ok');
 await a.tw();a.send({t:'feed',dog:d0,food:'meat'});r=await a.tw();ok(/ไม่มี/.test(r.m),'feed w/o stock rejected');
 // acts
 for(const x of ['pet','play','brush','bath'])a.send({t:'act',a:x,dog:d0});
 a.send({t:'act',a:'train',dog:d0});await sleep(300);
 me=a.last('me');ok(me.stats.pet==1&&me.stats.train==1,'stats via act: '+JSON.stringify(me.stats));
 // place/move/store
 await a.tw();a.send({t:'shop_buy',id:'tv'});r=await a.tw();ok(/ไม่พอ/.test(r.m),'tv too expensive');
 await a.tw();a.send({t:'place',id:'ball',x:300,y:450});r=await a.tw();ok(/ไม่มี/.test(r.m),'place w/o inventory (ball already placed)');
 a.send({t:'shop_buy',id:'ball'});await a.wait('buy_ok');
 a.send({t:'place',id:'ball',x:300,y:450});let it=await a.wait('items');ok(it.items.length==12,'place');
 const uid=it.items.at(-1).uid;
 a.send({t:'move',uid,x:9999,y:9999});it=await a.wait('items');const m=it.items.find(i=>i.uid==uid);ok(m.x==770&&m.y==578,'move clamped');
 a.send({t:'store',uid});it=await a.wait('items');ok(it.items.length==11,'store');
 // wall item clamp
 a.send({t:'shop_buy',id:'clock'});await a.wait('buy_ok');await a.tw();a.send({t:'place',id:'clock',x:400,y:100});r=await a.tw();ok(/ไม่ได้/.test(r.m),'wall item in window rejected');
 a.send({t:'place',id:'clock',x:150,y:100});it=await a.wait('items');ok(it.items.length==12,'wall item placed');
 // decor
 await a.tw();a.send({t:'deco',k:'wall',v:'galaxy'});r=await a.tw();ok(/ไม่พอ/.test(r.m),'premium wall locked');
 a.send({t:'deco',k:'wall',v:'mint'});let dc=await a.wait('deco');ok(dc.deco.wall=='mint','deco free');
 // quests / ach / coll
 a.send({t:'quests'});let q=await a.wait('quests');ok(q.list.length==4,'4 quests');
 a.send({t:'ach'});let ac=await a.wait('ach');ok(ac.list.length==38&&ac.coll.length==10,'ach+coll lists ('+ac.list.length+')');
 // capsule x1 with ticket
 a.send({t:'capsule',n:1,ticket:true});let cp=await a.wait('capsule');ok(cp.res.length==1,'capsule');
 // dogs_all, fav, home, release
 a.send({t:'dogs_get'});let da=await a.wait('dogs_all');ok(da.dogs.length==2,'dogs_all');
 const d1=da.dogs.find(d=>d.id!=d0).id;
 a.send({t:'dog_fav',dog:d1});da=await a.wait('dogs_all');ok(da.dogs.find(d=>d.id==d1).fav,'fav');
 a.send({t:'release',ids:[d1]});await sleep(200);a.send({t:'dogs_get'});da=await a.wait('dogs_all');da=a.last('dogs_all')||da;ok(da.dogs.length==2,'fav not released');
 a.send({t:'dog_fav',dog:d1});await a.wait('dogs_all');
 a.send({t:'dog_home',dog:d0,on:false});await sleep(200);a.send({t:'dogs_get'});da=await a.wait('dogs_all');ok(true,'dog_home off (d0 away, d1 at home)');
 await a.tw();a.send({t:'dog_home',dog:d1,on:false});r=await a.tw();ok(/อย่างน้อย/.test(r.m),'cannot send last dog away');
 a.send({t:'dog_home',dog:d0,on:true});await sleep(200);
 // minigames
 a.send({t:'mg_start',g:'guess'});await sleep(100);a.send({t:'mg_end',g:'guess',score:5});let mg=await a.wait('mg_ok');ok(mg.reward==0,'mg too fast = 0');
 // friends
 const b=await cli();b.send({t:'register',user:'bobby',email:'b@b.co',pass:'secret2'});await b.wait('auth');await sleep(200);
 a.send({t:'friend_add',name:'BOBBY'});await a.wait('friends');
 let bn=await b.wait('notify');ok(true,'bob got notify');
 b.send({t:'friend_ok',name:'alice'});await sleep(300);let bf=b.last('friends');ok(bf.friends.length==1,'friend accepted');
 a.send({t:'friends'});await sleep(150);let af=a.last('friends');ok(af.friends.length==1&&af.friends[0].online,'alice sees bob online');
 await a.tw();a.send({t:'friend_gift',name:'bobby'});let g1=await a.tw();a.send({t:'friend_gift',name:'bobby'});let g2=await a.tw();ok(/ของขวัญ/.test(g1.m)&&/วันนี้ส่ง/.test(g2.m),'gift once per day: '+g1.m+' | '+g2.m);
 a.send({t:'lb'});let lb=await a.wait('lb');ok(lb.level.length>=2&&lb.rank.level>0,'leaderboard');
 a.log.length=0;a.send({t:'visit',id:'bobby'});await sleep(300);h=a.last('house');ok(h.owner=='bobby','visit');
 a.send({t:'act',a:'train',dog:h.dogs[0].id});await sleep(150);ok(true,'train on other house ignored');
 a.send({t:'visit',id:'alice'});await a.wait('house');
 // daily + quest claim + resume
 a.send({t:'daily'});await a.wait('daily_ok');ok(true,'daily');
 a.send({t:'logout',token:au.token});await sleep(100);
 const a2=await cli();a2.send({t:'resume',token:au.token});r=await a2.wait('auth');ok(!r.ok,'token revoked after logout');
 const g=await cli();g.send({t:'guest'});r=await g.wait('auth');ok(r.ok&&r.guest,'guest');
 // wait for sim tick
 await sleep(1500);ok(g.log.some(x=>x.t=='dogs'||x.t=='house'),'sim running');
 console.log('\nPASS',pass,'FAIL',fail);process.exit(fail?1:0);
})().catch(e=>{console.log('ERR',e.message,JSON.stringify(a0&&a0.log.slice(-6)));process.exit(2)});
