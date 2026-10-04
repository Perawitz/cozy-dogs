// Cozy Dogs - boot, login scene, server message handlers
'use strict';
const TIPS={th:['ลูบหัวน้องหมาทุกวันเพื่อเพิ่ม Bond 💕','น้องหมาแต่ละตัวมีนิสัยต่างกัน ลองสังเกตดูนะ','ซื้อเฟอร์นิเจอร์แล้วลากไปวางในห้องได้เลย 🛋️','เทรนจนได้ลูกเล่นใหม่ — หมุน กระโดด กลิ้ง!','เพื่อนส่งขนมให้กันได้วันละครั้ง 🎁','ลองเล่นตอนกลางคืน — เตาผิงกับโคมไฟสวยมาก 🔥','ไปสวนหมา 🌳 เก็บขนม เตะบอล และแลกของกับเพื่อนได้','ทุกวันจันทร์มีเป้าหมายใหม่ให้ทั้งเซิร์ฟเวอร์ช่วยกันทำ 🌍'],
 en:['Pet your dogs daily to grow Bond 💕','Every dog has its own personality.','Buy furniture, then drag it into your room 🛋️','Train to unlock tricks — spin, jump, roll!','Send friends a gift once a day 🎁','Play at night — the fireplace is so cozy 🔥','Visit the Dog Park 🌳 grab treats, kick the ball, trade with friends.','A new community goal starts every Monday 🌍']};
function applyLang(){$$('[data-t]').forEach(e=>e.textContent=t(e.dataset.t));const fb=$('#fetchbtn');if(fb)fb.title=t('Fetch');$('#tip').textContent=pick(TIPS[S.set.lang]||TIPS.th);document.documentElement.lang=S.set.lang}
DO.lang=(d,el,e)=>{e.preventDefault();S.set.lang=S.set.lang=='th'?'en':'th';saveSet();applyLang()};
DO.ltab=d=>{$('#fLogin').classList.toggle('hidden',d.v!='login');$('#fReg').classList.toggle('hidden',d.v!='reg');$('#tLogin').classList.toggle('on',d.v=='login');$('#tReg').classList.toggle('on',d.v=='reg')};
UI.all=function(){UI.starterpill();UI.fetchbtn();UI.cur();UI.pcard();UI.loc();UI.dock();UI.online();UI.chat();UI.bars();UI.care();UI.goalpill();UI.parkbar();UI.parkinfo()};
// ---------- login scene ----------
const Login={dogs:[],items:[],deco:{wall:'cream',floor:'wood',light:'sunset'},ready:false};
function initLogin(){const C=S.cat.items;const defs=[['sofa_blue',120,338],['lamp',212,338],['fireplace',640,340],['plant_big',752,338],['bookshelf',318,338],['rug_round_pink',420,478],['bed_blue',250,470],['frame_dog',560,92],['frame_sun',690,96],['clock',115,100],['bowl',140,520],['ball',470,500]];
 if(S.cat.season=='christmas')defs.push(['xtree',560,340]);if(S.cat.season=='halloween')defs.push(['pumpkin',520,340]);
 Login.items=defs.filter(([t])=>C[t]).map(([t,x,y],i)=>{const d=C[t];return{uid:'l'+i,type:t,draw:d.draw,pal:d.pal,kind:d.kind,x,y,f:0}});
 const ids=shuffle(Object.keys(DOGS.BR)).slice(0,6);Login.dogs=ids.map((id,i)=>({id:'ld'+i,breed:id,variant:Math.random()<.2?pick(['Snow','Golden','Chocolate']):'Normal',name:'',state:'IDLE',fx:rnd(100,700),fy:rnd(380,540),tx:0,ty:0,t0:0,dur:1,until:0,face:Math.random()<.5?1:-1,seed:i,happy:70,acc:Math.random()<.4?pick(['bow','bandana','scarf','glasses','partyhat','crown']):null}));
 Login.dogs.forEach(d=>{d.tx=d.fx;d.ty=d.fy});const lav=AVD.defaults(String(Math.random()));lav.hm=Math.random()<.5?'bl':'br';Login.av=lav;Login.ready=true}
const bgc=$('#bgc'),bgx=bgc.getContext('2d');
function loginFrame(ms,dt){if(!Login.ready)return;const w=innerWidth,h=innerHeight,dpr=Math.min(1.5,devicePixelRatio||1);if(bgc.width!=Math.round(w*dpr)||bgc.height!=Math.round(h*dpr)){bgc.width=Math.round(w*dpr);bgc.height=Math.round(h*dpr)}
 const s=Math.max(bgc.width/800,bgc.height/600),now=performance.now(),t=(ms-World.t0)/1000;
 for(const d of Login.dogs)if(now>d.until){const[x,y]=posOf(d,now);d.fx=x;d.fy=y;const r=Math.random();let st=r<.5?'WALK':r<.6?'RUN':r<.8?'IDLE':r<.9?'SIT':'SLEEP';d.state=st;
  if(st=='WALK'||st=='RUN'){d.tx=rnd(80,720);d.ty=rnd(380,560)}else{d.tx=x;d.ty=y}const dist=Math.hypot(d.tx-x,d.ty-y);d.t0=now;d.dur=Math.max(400,dist/(st=='RUN'?170:70)*1000);d.until=now+d.dur+rnd(2500,6000);d.trick=null}
 bgx.setTransform(1,0,0,1,0,0);bgx.clearRect(0,0,bgc.width,bgc.height);const sc0=World.scale;World.scale=s;bgx.translate((bgc.width-800*s)/2,(bgc.height-600*s)/2);
 const hp=AVD.HOMEPOS[Login.av.hm],ph=t%9;Login.avatar={av:Login.av,x:hp[0],y:hp[1],name:'',pose:ph<2.2?'wave':'idle',own:false};
 renderWorld(bgx,{deco:Login.deco,items:Login.items,dogs:Login.dogs,avatar:Login.avatar,env:{hour:18.7,weather:'sunny',season:S.cat.season}},t,now,dt);World.scale=sc0}
// ---------- auth ----------
function setErr(id,m){$(id).textContent=m||''}
async function ensureConn(){if(S.ws&&S.ws.readyState==1)return;await connect()}
async function doAuth(msg,errId){setErr(errId,'');try{await ensureConn();send(msg)}catch{setErr(errId,S.set.lang=='th'?'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ (รัน node server.js แล้วหรือยัง?)':'Cannot reach server. Is it running?')}}
$('#fLogin').onsubmit=e=>{e.preventDefault();doAuth({t:'login',user:$('#lUser').value,pass:$('#lPass').value},'#lErr')};
$('#fReg').onsubmit=e=>{e.preventDefault();doAuth({t:'register',user:$('#rUser').value,email:$('#rMail').value,pass:$('#rPass').value},'#rErr')};
DO.guest=()=>doAuth({t:'guest'},'#lErr');
H.auth=m=>{if(!m.ok){setErr($('#fReg').classList.contains('hidden')?'#lErr':'#rErr',m.err);if(S.pendingResume||S.autoResume){S.token=null;LS.set('cd_token',null);S.autoResume=false;S.pendingResume=false;show('login')}sfx('err');return}
 if(Park.on)Park.leaveLocal();S.name=m.name;S.guest=m.guest;if(m.token){S.token=m.token;LS.set('cd_token',m.token)}S.loaded=true;S.autoResume=false;S.pendingResume=false;hideBanner()};
function show(id){S.scr=id;$$('.scr').forEach(s=>s.classList.toggle('on',s.id==id));if(id=='game')layout()}
H.kick=()=>{wantConn=false;toast(S.set.lang=='th'?'มีการเข้าสู่ระบบจากที่อื่น':'Logged in elsewhere');setTimeout(()=>location.reload(),1200)};
// ---------- game messages ----------
H.welcome=m=>{S.welcome=m;DOGS.setBreeds(m.breeds);S.cat=localizeCat({items:m.cat.items,food:m.cat.food,acc:m.cat.acc,walls:m.cat.walls,floors:m.cat.floors,lights:m.cat.lights,tricks:m.cat.tricks,season:m.cat.season})};
let firstMe=true;
H.me=m=>{const prevInv=JSON.stringify(S.me.inv),prevSt=(S.me.stReady||0)+'/'+(S.me.stDone?1:0);Object.assign(S.me,m);UI.cur();UI.pcard();UI.dock();UI.starterpill();UI.fetchbtn();if(S.loaded&&(S.me.stReady||0)+'/'+(S.me.stDone?1:0)!=prevSt&&!S.me.stDone)send({t:'starter'});if(modOpen('house'))send({t:'house_info'});
 if(prevInv!=JSON.stringify(S.me.inv)){if(S.feedOpen||S.sel)UI.care();if(S.edit)UI.edit()}
 for(const id of['shop','capsule','profile'])if(modOpen(id))({shop:renderShop,capsule:()=>0,profile:()=>DO.profile()})[id]();
 if(modOpen('prof'))renderProfile();if(modOpen('daily'))DO.daily();if(modOpen('wardrobe'))Wardrobe.refresh();
 if(firstMe){firstMe=false;send({t:'starter'});send({t:'mail_get'});setTimeout(tutStart,2500);show('game');if(m.canClaim)setTimeout(DO.daily,900);else if(!LS.get('cd_help',false))setTimeout(DO.help,900);LS.set('cd_help',true)}};
H.house=m=>{const mine=m.owner==S.name;S.fetchMode=false;cv.classList.remove('throw');if(!mine)S.edit=false;S.owner=m.owner;S.ownerAv=m.av||null;S.avTap=0;S.party=m.party>0?performance.now()+m.party:0;S.deco=m.deco;S.items=m.items;if(m.owner!=S.name){S.gbData=null}rebuildItems();S.dogs={};m.dogs.forEach(setDog);World.selItem=null;S.sel=null;S.feedOpen=false;S.hungry={};
 if(mine&&m.dogs[0])S.avatarBreed=m.dogs[0].breed;if(mine)checkHungry();UI.all();show('game');ROOM.setDeco(S.deco);if(modOpen('shop'))renderShop()};
function checkHungry(){S.hungry={};if(S.owner==S.name)for(const d of Object.values(S.dogs))if(d.hunger<25)S.hungry[d.id]=true}
H.dogs=m=>{if(m.full){const keep=new Set(m.dogs.map(d=>d.id));for(const id of Object.keys(S.dogs))if(!keep.has(id))delete S.dogs[id];if(S.sel&&!S.dogs[S.sel]){S.sel=null;UI.care()}}
 const selBefore=S.sel&&S.dogs[S.sel]?S.dogs[S.sel].acc:null;for(const d of m.dogs){const old=S.dogs[d.id];setDog(d);if(old&&old.state!=d.state&&d.state=='EAT')sfx('eat')}
 checkHungry();if(S.sel&&S.dogs[S.sel]){if(S.dogs[S.sel].acc!=selBefore)UI.care();else UI.careBars()}};
H.dogs_all=m=>{S.allDogs=m.dogs;if(modOpen('pdogs'))renderParkDogs();if(modOpen('dogs'))renderDogs();if(modOpen('prof'))renderProfile()};
H.items=m=>{const old=new Set(S.items.map(i=>i.uid));S.items=m.items;rebuildItems();if(S.pendingSelect){const n=m.items.find(i=>!old.has(i.uid));if(n){selectItem(n.uid)}S.pendingSelect=null}
 if(World.selItem&&!m.items.some(i=>i.uid==World.selItem))World.selItem=null;if(S.edit)UI.edit();UI.loc()};
H.deco=m=>{S.deco=m.deco;ROOM.setDeco(S.deco);if(modOpen('shop'))renderShop();sfx('ok')};
H.fx=m=>{const d=m.dog&&S.dogs[m.dog];if(d&&d._pos){const[x,y,L]=d._pos;if(m.pet){burst(x,y-L-d._top*.8,'❤️',4);sfx('pet')}else if(m.e=='✨'){sparkle(x,y-30,14)}else burst(x,y-L-d._top*.8,m.e,3)}else burst(m.x||400,m.y||300,m.e,3)};
H.players=m=>{S.players=m.list;UI.online()};
H.chat=m=>{Park.onChat(m);if(!Park.on&&m.from==S.owner)S.avBub={m:m.m,at:performance.now()};S.chat.push(m);if(S.chat.length>60)S.chat.shift();const el=$('#chat');UI.chat();if(el.classList.contains('min')){const hd=$('.hd span',el);if(hd)hd.textContent='💬 '+t('Chat')+' •'}};
H.event=m=>ticker(m.text);
H.notify=m=>{toast(locMsg(m.m));sfx('notify')};
H.toast=m=>{toast(locMsg(m.m));if(/ไม่พอ|ไม่มี|ไม่ได้|เต็ม|Not enough|แล้ว$/.test(m.m)&&!/learned|ปลด|เป็นเพื่อน|ส่ง/.test(m.m))sfx('err')};
H.levelup=m=>{sfx('level');toast('⭐ '+TT('Level Up!','เลเวลอัป!')+' Lv.'+m.lvl+'  +50🪙 +1💎',4200);const r=cv.getBoundingClientRect();for(let i=0;i<5;i++)setTimeout(()=>burst(rnd(150,650),rnd(250,450),pick(['⭐','🎉','✨']),4),i*150)};
H.buy_ok=m=>{sfx('coin');const it=S.cat.items[m.id]||S.cat.food[m.id]||S.cat.acc[m.id];toast('🛍️ '+(it?it.n:m.id)+' ×'+m.n)};
H.equip_ok=m=>{sfx('ok');const d=(S.allDogs||[]).find(x=>x.id==m.dog);if(d)d.acc=m.acc;const s=S.dogs[m.dog];if(s)s.acc=m.acc;if(modOpen('prof'))renderProfile();UI.care()};
H.quests=m=>{S.quests=m;if(modOpen('quests'))renderQuests()};
H.ach=m=>{S.ach=m.list;S.coll=m.coll;if(modOpen('quests'))renderQuests();if(modOpen('coll'))renderColl()};
H.friends=m=>{S.fr=m;if(modOpen('friends'))renderFriends();UI.dock()};
H.lb=m=>{S.lb=m;if(modOpen('ranks'))renderRanks()};
// ---- wardrobe (human avatar)
H.av_ok=m=>{S.me.av=m.av;S.me.avOwn=m.own||S.me.avOwn;if(S.owner==S.name)S.ownerAv=m.av;UI.pcard();if(!m.get){Wardrobe.saved(m)}else Wardrobe.refresh()};
H.av_err=m=>{Wardrobe.failed(m)};
H.av_upd=m=>{if(m.n==S.owner)S.ownerAv=m.av};
H.park_av=m=>{const q=Park.m[m.n];if(q)q.av=m.av;if(m.n==S.name)S.me.av=m.av};
// ---------- boot ----------
(function boot(){buildIcons();DOGS.setBreeds(EMBED.breeds);S.cat=localizeCat(Object.assign({},EMBED.cat,{season:(()=>{const m=new Date().getMonth()+1;return m==10?'halloween':m==12?'christmas':''})()}));
 applyLang();initLogin();ROOM.setDeco(Login.deco);UI.cur();
 const lu=LS.get('cd_user','');$('#lUser').value=lu;
 if(S.token){S.autoResume=true;connect().then(()=>send({t:'resume',token:S.token})).catch(()=>{S.autoResume=false})}
 // keep the clock / weather label fresh
 setInterval(()=>{if(S.scr=='game')UI.loc()},20000);
 setInterval(()=>{if(S.ws&&S.ws.readyState==1&&S.loaded)send({t:'hb'})},20000);   // heartbeat: lets the server drop dead connections
 addEventListener('beforeunload',()=>{});
})();
