// Cozy Dogs v3 - authoritative WebSocket server
// (auth, gacha, shop, house items, quests, achievements, friends, tricks, mini-game rewards, RPS). npm start / node server.js
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
let WebSocketServer;try{({WebSocketServer}=require('ws'))}catch{({WebSocketServer}=require('./miniws'))}  // built-in fallback when `ws` is not installed
const BREEDS=require('./breeds'),C=require('./catalog'),AVD=require('./avatar_data');
let V=null;   // wardrobe module (created below, after the shared helpers exist)
const BR=Object.fromEntries(BREEDS.map(b=>[b[0],b]));
const PORT=process.env.PORT||3000, DBF=process.env.DATA||path.join(__dirname,'data.json');
const INDEX=[path.join(__dirname,'public','index.html'),path.join(__dirname,'index.html')].find(f=>fs.existsSync(f))||path.join(__dirname,'public','index.html');
const RATE=+process.env.CD_RATE||20;     // max messages per second per connection (tests may raise it)
const COST=100, PITY=40;
const RATES={C:60,R:25,E:10,L:4,M:1};
const VARIANTS=['Normal','Snow','Chocolate','Golden','Galaxy','Rainbow'];
const PERS={PLAYFUL:{PLAY:3,RUN:2},LAZY:{SLEEP:3,IDLE:2},ENERGETIC:{RUN:3,WALK:2},SHY:{CORNER:4,SIT:1.5},FRIENDLY:{SOCIAL:4},
  FOODIE:{EAT:3,DRINK:1.5},CURIOUS:{SNIFF:2.5,EXPLORE:3,WINDOW:2},CLINGY:{SEEK_OWNER:4},BRAVE:{EXPLORE:2,BARK:2.5},SLEEPY:{SLEEP:4,STRETCH:2},MISCHIEVOUS:{PLAY:2,RUN:2,SNIFF:2}};
const DEF={eat:[130,505],drink:[215,510],sleep:[650,455],play:[420,435],tv:[400,430],owner:[400,560],corner:[70,345],window:[400,338]};
const NAMES=['Mochi','Buddy','Coco','Luna','Max','Bean','Pudding','Nova','Biscuit','Teddy','Miso','Waffle','Pepper','Maple','Ollie','Peanut','Cleo','Rocky','Daisy','Zeus'];
const FOODS=['Cookie','Bone','Meat','Cake','Fruit','Treat'], TOYS=['Ball','Frisbee','Rope','Duck','Teddy','Squeaky'];
const DAILY=[{c:50},{c:80},{c:100},{c:150},{tk:1},{c:200},{g:10,c:300}];
const QPOOL=[
 {t:'pet',n:'Pet your dogs',goal:5,r:{c:40}},{t:'feed',n:'Feed your dogs',goal:3,r:{c:50}},{t:'play',n:'Play with your dogs',goal:3,r:{c:45}},
 {t:'bath',n:'Give a bath',goal:1,r:{c:35}},{t:'brush',n:'Brush your dogs',goal:2,r:{c:30}},{t:'train',n:'Train a trick',goal:2,r:{c:60}},
 {t:'caps',n:'Open a capsule',goal:1,r:{c:30,tk:1}},{t:'win',n:'Win a Rock-Paper-Scissors match',goal:1,r:{c:60}},
 {t:'mg',n:'Play 2 mini games',goal:2,r:{c:50}},{t:'visit',n:"Visit someone's house",goal:1,r:{c:40}},
 {t:'place',n:'Decorate: place 2 items',goal:2,r:{c:40}},{t:'gift',n:'Send a gift to a friend',goal:1,r:{c:40,g:1}},
 {t:'park',n:'Collect 5 treats in the park',goal:5,r:{c:50}},{t:'parkjoin',n:'Visit the park',goal:1,r:{c:30}},
 {t:'wish',n:'Grant a dog wish',goal:2,r:{c:60}},{t:'mp',n:'Play an online mini-game',goal:2,r:{c:70,tk:1}},{t:'dig',n:'Dig 3 holes in the park',goal:3,r:{c:50}},
 {t:'avsave',n:'Try a new look in the wardrobe',goal:1,r:{c:30}},
 {t:'fetch',n:'Play fetch with your dogs',goal:3,r:{c:45}},{t:'like',n:'Like a friend\'s house',goal:1,r:{c:35}},{t:'spin',n:'Spin the lucky wheel',goal:1,r:{c:30}}];
const uniq=p=>new Set(p.dogs.map(d=>d.breed)).size, st=(p,k)=>p.stats[k]||0;
const ACH=[
 {id:'d5',n:'Dog Lover',d:'Own 5 dogs',goal:5,v:p=>p.dogs.length,r:{c:100}},
 {id:'d15',n:'Dog Parent',d:'Own 15 dogs',goal:15,v:p=>p.dogs.length,r:{c:300,tk:2}},
 {id:'d30',n:'Dog Whisperer',d:'Own 30 dogs',goal:30,v:p=>p.dogs.length,r:{g:15}},
 {id:'b10',n:'Collector',d:'Collect 10 breeds',goal:10,v:uniq,r:{c:200}},
 {id:'b25',n:'Breed Expert',d:'Collect 25 breeds',goal:25,v:uniq,r:{g:10,tk:3}},
 {id:'b50',n:'Complete Collection',d:'Collect all 50 breeds',goal:50,v:uniq,r:{g:50,c:2000}},
 {id:'pet100',n:'Pet Master',d:'Pet 100 times',goal:100,v:p=>st(p,'pet'),r:{c:150}},
 {id:'pet1k',n:'Cuddle Legend',d:'Pet 1000 times',goal:1000,v:p=>st(p,'pet'),r:{g:20}},
 {id:'feed50',n:'Master Chef',d:'Feed dogs 50 times',goal:50,v:p=>st(p,'feed'),r:{c:150}},
 {id:'train20',n:'Trainer',d:'Train tricks 20 times',goal:20,v:p=>st(p,'train'),r:{c:200,tk:1}},
 {id:'win5',n:'Gambler',d:'Win 5 RPS matches',goal:5,v:p=>p.wins,r:{c:150}},
 {id:'win25',n:'Champion',d:'Win 25 RPS matches',goal:25,v:p=>p.wins,r:{g:10}},
 {id:'caps10',n:'Capsule Fan',d:'Open 10 capsules',goal:10,v:p=>st(p,'caps'),r:{c:150}},
 {id:'bond',n:'Best Friends',d:'Max bond with a dog',goal:100,v:p=>Math.max(0,...p.dogs.map(d=>d.bond|0)),r:{g:10}},
 {id:'rich',n:'Rich Pup',d:'Hold 2000 coins',goal:2000,v:p=>p.coins,r:{g:5}},
 {id:'lucky',n:'Lucky!',d:'Own a Legendary or Mythic dog',goal:1,v:p=>p.dogs.some(d=>'LM'.includes(BR[d.breed][2]))?1:0,r:{c:300}},
 {id:'deco15',n:'Interior Designer',d:'Place 15 items in your house',goal:15,v:p=>p.items.length,r:{c:200}},
 {id:'fr3',n:'Social Butterfly',d:'Have 3 friends',goal:3,v:p=>p.friends.length,r:{c:150,tk:1}},
 {id:'streak7',n:'Loyal Owner',d:'Reach a 7-day login streak',goal:7,v:p=>p.daily.streak,r:{g:5}},
 {id:'kick50',n:'Ball Lover',d:'Kick the ball 50 times in the park',goal:50,v:p=>st(p,'kick'),r:{c:150}},
 {id:'park100',n:'Treat Hunter',d:'Collect 100 park treats',goal:100,v:p=>st(p,'park'),r:{g:5}},
 {id:'trade5',n:'Trader',d:'Complete 5 trades',goal:5,v:p=>st(p,'trade'),r:{c:200,tk:1}},
 {id:'wish10',n:'Wish Granter',d:'Grant 10 dog wishes',goal:10,v:p=>st(p,'wish'),r:{c:200}},
 {id:'wish50',n:'Dog Genie',d:'Grant 50 dog wishes',goal:50,v:p=>st(p,'wish'),r:{g:15,tk:2}},
 {id:'dig20',n:'Treasure Hunter',d:'Dig 20 holes in the park',goal:20,v:p=>st(p,'dig'),r:{c:200}},
 {id:'treasure',n:'X Marks the Spot',d:'Find the park treasure',goal:1,v:p=>st(p,'treasure'),r:{g:8}},
 {id:'mp10',n:'Arcade Regular',d:'Play 10 online games',goal:10,v:p=>st(p,'mp'),r:{c:250}},
 {id:'mpwin5',n:'Arcade Champ',d:'Win 5 online games',goal:5,v:p=>st(p,'mpwin'),r:{c:300,tk:1}},
 {id:'mpwin25',n:'Arcade Legend',d:'Win 25 online games',goal:25,v:p=>st(p,'mpwin'),r:{g:20}},
 {id:'party3',n:'Party Animal',d:'Host 3 parties',goal:3,v:p=>st(p,'party'),r:{c:200,tk:1}},
 {id:'like10',n:'Popular Pup',d:'Receive 10 house likes',goal:10,v:p=>p.likes|0,r:{c:250}},
 {id:'house3',n:'Dream Home',d:'Upgrade your house to the max level',goal:3,v:p=>p.hl|0,r:{g:15}},
 {id:'sets3',n:'Matching Set',d:'Complete 3 furniture sets',goal:3,v:p=>F.setsDone(p).length,r:{c:300,g:3}},
 {id:'look1',n:'Fresh Look',d:'Save a new look in the wardrobe',goal:1,v:p=>st(p,'avsave'),r:{c:40}},
 {id:'style5',n:'Fashionista',d:'Own 5 premium wardrobe pieces',goal:5,v:p=>(p.avOwn||[]).length,r:{c:200}},
 {id:'style15',n:'Style Icon',d:'Own 15 premium wardrobe pieces',goal:15,v:p=>(p.avOwn||[]).length,r:{g:8,tk:2}},
 {id:'royal',n:'Royalty',d:'Own the golden crown',goal:1,v:p=>(p.avOwn||[]).includes('ht:crown')?1:0,r:{g:5}},
 {id:'angel',n:'Little Angel',d:'Own the halo and the angel wings',goal:1,v:p=>(p.avOwn||[]).includes('ht:halo')&&(p.avOwn||[]).includes('x:wings')?1:0,r:{g:5}}];
const COLL=[[5,{c:200}],[10,{tk:2}],[15,{c:500}],[20,{g:10}],[25,{tk:5}],[30,{c:1000}],[35,{g:20}],[40,{tk:8}],[45,{g:30}],[50,{g:100,tk:10,c:2000}]];
const rnd=(a,b)=>a+Math.random()*(b-a), pick=a=>a[Math.floor(Math.random()*a.length)];
const rid=()=>crypto.randomBytes(5).toString('hex'), today=()=>new Date().toISOString().slice(0,10);
const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));

// own-property lookups: a client-supplied id like "__proto__" or "constructor" must never reach an object's prototype chain
const own=(o,k)=>typeof k=='string'&&Object.prototype.hasOwnProperty.call(o,k), cat=(T,k)=>own(T,k)?T[k]:undefined;
const nul=o=>Object.assign(Object.create(null),o);
const RESERVED=['__proto__','constructor','prototype','hasownproperty','tostring','valueof','admin','administrator','system','server','moderator','staff','cozydogs','null','undefined'];
let db={players:nul(),accounts:nul(),sessions:nul()};
for(const f of [DBF,DBF+'.bak']){try{Object.assign(db,JSON.parse(fs.readFileSync(f,'utf8')));break}catch(e){if(e.code!='ENOENT')console.error('could not read',f,e.message)}}
db.players=nul(db.players);db.accounts=nul(db.accounts);db.sessions=nul(db.sessions);
// ---- Supabase persistence (optional). Set SUPABASE_URL + SUPABASE_KEY (service_role / secret key) in the host's environment variables
//      so accounts, coins and dogs survive redeploys and sleeping servers. Without them the game keeps using the local data.json file.
const SB_URL=(process.env.SUPABASE_URL||'').trim().replace(/\/+$/,''), SB_KEY=(process.env.SUPABASE_KEY||'').trim(), REMOTE=!!(SB_URL&&SB_KEY);
const SB_H={apikey:SB_KEY,'Content-Type':'application/json'}; if(SB_KEY.startsWith('eyJ'))SB_H.Authorization='Bearer '+SB_KEY;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function remoteLoad(){                 // returns normally only if the read worked: we never start with empty data and overwrite the real save
  for(let i=1;;i++){
    try{const r=await fetch(SB_URL+'/rest/v1/game_data?id=eq.main&select=data',{headers:SB_H,signal:AbortSignal.timeout(15000)});
      if(!r.ok)throw new Error('HTTP '+r.status+' '+(await r.text()).slice(0,200));
      const rows=await r.json();
      if(rows[0]&&rows[0].data){Object.assign(db,rows[0].data);db.players=nul(db.players);db.accounts=nul(db.accounts);db.sessions=nul(db.sessions);console.log('loaded data from Supabase:',Object.keys(db.accounts).length,'accounts')}
      else console.log('Supabase is empty - starting fresh (first save will create the row)');
      return}
    catch(e){console.error('Supabase load failed ('+i+'/5):',e.message);if(i>=5){console.error('giving up - not starting, so real data is never overwritten');process.exit(1)}await sleep(3000*i)}
  }}
let rSaving=false,rPending=false;
async function remoteSave(){
  if(rSaving){rPending=true;return}
  rSaving=true;
  try{const r=await fetch(SB_URL+'/rest/v1/game_data?on_conflict=id',{method:'POST',headers:{...SB_H,Prefer:'resolution=merge-duplicates,return=minimal'},
      body:JSON.stringify({id:'main',data:db,updated_at:new Date().toISOString()}),signal:AbortSignal.timeout(15000)});
    if(!r.ok)throw new Error('HTTP '+r.status+' '+(await r.text()).slice(0,200))}
  catch(e){console.error('Supabase save failed (will retry):',e.message);dirty=true}
  finally{rSaving=false;if(rPending){rPending=false;remoteSave()}}}
let dirty=false,lastBak=0;
function save(){                       // atomic: write a temp file, then rename (a crash mid-write can never leave a half-written data.json)
  try{const tmp=DBF+'.tmp';fs.writeFileSync(tmp,JSON.stringify(db));
    if(Date.now()-lastBak>6e5){try{fs.copyFileSync(DBF,DBF+'.bak')}catch{}lastBak=Date.now()}
    fs.renameSync(tmp,DBF);dirty=false}catch(e){console.error('save failed:',e.message)}
  if(REMOTE)remoteSave()}
const safe=(name,f)=>(...a)=>{try{return f(...a)}catch(e){console.error('['+name+']',e&&e.stack||e)}};
setInterval(safe('save',()=>{if(dirty)save()}),5000);
for(const sg of ['SIGINT','SIGTERM'])process.on(sg,async()=>{save();if(REMOTE){await sleep(100);for(let i=0;i<40&&rSaving;i++)await sleep(100)}process.exit(0)});
process.on('uncaughtException',e=>console.error('uncaught:',e&&e.stack||e));
process.on('unhandledRejection',e=>console.error('unhandled:',e));

// ---- accounts: passwords hashed with scrypt + per-user salt (never stored in plain text)
const hashPw=(pw,salt)=>crypto.scryptSync(pw,salt,64).toString('hex');
const checkPw=(a,pw)=>{const h=Buffer.from(hashPw(pw,a.salt),'hex'),e=Buffer.from(a.hash,'hex');return h.length==e.length&&crypto.timingSafeEqual(h,e)};
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
function newSession(name){const t=crypto.randomBytes(24).toString('hex');
  const mine=Object.entries(db.sessions).filter(([,s])=>s.name==name).sort((a,b)=>a[1].exp-b[1].exp);while(mine.length>=5)delete db.sessions[mine.shift()[0]];   // max 5 live sessions per account
  db.sessions[sha(t)]={name,exp:Date.now()+30*864e5};dirty=true;return t}
function purge(){const now=Date.now();let n=0;for(const k of Object.keys(db.sessions))if(db.sessions[k].exp<now){delete db.sessions[k];n++}
  const viewed=new Set([...conns.values()].flatMap(c=>[c.name,c.view]));            // guests nobody uses any more (>1 day) are removed with every reference to them
  for(const name of Object.keys(db.players)){if(!isGuestName(name)||viewed.has(name))continue;const p=db.players[name];if(now-(p.seen||0)<864e5)continue;
    delete db.players[name];n++;for(const o of Object.values(db.players)){o.friends=o.friends.filter(x=>x!=name);o.reqIn=o.reqIn.filter(x=>x!=name);o.reqOut=o.reqOut.filter(x=>x!=name);delete o.gifted[name]}}
  if(n)dirty=true}
const isGuestName=n=>/^Guest\d{4}$/.test(n)&&!own(db.accounts,n.toLowerCase());
setInterval(safe('purge',()=>purge()),36e5);

function mkDog(breed,variant){return {id:rid(),breed,variant,name:pick(NAMES),pers:pick(Object.keys(PERS)),bond:0,hunger:80,energy:80,happy:70,clean:80,
  favFood:pick(FOODS),favToy:pick(TOYS),born:Date.now(),tricks:[],acc:null,fav:false,away:false}}
function player(name){
  if(!db.players[name]){db.players[name]={coins:300,gems:10,tickets:3,xp:0,wins:0,pity:0,daily:{last:'',streak:0},deco:{wall:'cream',floor:'wood',light:'warm'},
    dogs:[mkDog(pick(BREEDS.filter(b=>b[2]=='C'))[0],'Normal')]};dirty=true}
  const p=db.players[name];p.gems??=10;p.tickets??=3;p.xp??=0;p.wins??=0;p.pity??=0;p.daily??={last:'',streak:0};p.deco??={wall:'cream',floor:'wood',light:'warm'};
  p.inv??={};p.stats??={};p.q??={date:'',cnt:{},list:[],bonus:false};p.achClaimed??={};p.collClaimed??=[];p.friends??=[];p.reqIn??=[];p.reqOut??=[];p.gifted??={};
  p.mg??={date:'',coins:0};p.unlock??={wall:[],floor:[],light:[]};if(V)V.ensure(p,name);
  p.hl??=0;p.likes??=0;p.gb??=[];p.mail??=[];p.liked??={};p.starter??={claimed:{},bonus:false};
  for(const k of ['coins','gems','tickets','xp','wins','pity'])if(!Number.isFinite(p[k])||p[k]<0)p[k]=k=='coins'?0:0;   // never let NaN/negative values survive
  if(!p.items){p.items=C.DEFAULT_ITEMS.map(([type,x,y])=>({uid:rid(),type,x,y,f:0}));p.items.forEach(i=>p.inv[i.type]=(p.inv[i.type]||0)+1);dirty=true}
  p.dogs.forEach(d=>{d.clean??=80;d.favFood??=pick(FOODS);d.favToy??=pick(TOYS);d.born??=Date.now();d.tricks??=[];d.acc??=null;d.fav??=false;d.away??=false});
  if(p.dogs.length&&!p.dogs.some(d=>!d.away))p.dogs[0].away=false;
  return p;
}
const lvl=p=>1+Math.floor(p.xp/100);
function addXp(p,n,ws){const b=lvl(p);if(n>0&&F.perks(p).has('xp'))n=Math.ceil(n*1.15);p.xp+=n;dirty=true;if(lvl(p)>b){p.coins+=50;p.gems+=1;if(ws)send(ws,{t:'levelup',lvl:lvl(p)})}}
const give=(p,r)=>{p.coins+=r.c||0;p.gems+=r.g||0;p.tickets+=r.tk||0;dirty=true};
const rtxt=r=>[r.c&&r.c+'🪙',r.g&&r.g+'💎',r.tk&&r.tk+'🎟'].filter(Boolean).join(' ');
function rollDog(p){
  p.pity++; let r,x=Math.random()*100,acc=0;
  if(p.pity>=PITY) r=Math.random()<.2?'M':'L'; else for(const k in RATES){acc+=RATES[k]; if(x<acc){r=k;break}}
  if(r=='L'||r=='M') p.pity=0;
  return mkDog(pick(BREEDS.filter(b=>b[2]==r))[0], Math.random()<.5?'Normal':pick(VARIANTS));
}
// ---- quests
function ensureQ(p,name){const t=today();if(p.q.date==t)return;let s=0;for(const ch of name+t)s=(s*31+ch.charCodeAt(0))>>>0;const r=()=>(s=(s*1664525+1013904223)>>>0)/4294967296,pool=QPOOL.map((_,i)=>i),list=[];
  while(list.length<4){list.push({k:pool.splice(Math.floor(r()*pool.length),1)[0],claimed:false})}p.q={date:t,cnt:{},list,bonus:false};dirty=true}
function bump(name,type,n=1,ws){const p=player(name);ensureQ(p,name);p.stats[type]=(p.stats[type]||0)+n;p.q.cnt[type]=(p.q.cnt[type]||0)+n;dirty=true;S.goalAdd(name,type,n);
  if(ws)for(const e of p.q.list){const q=QPOOL[e.k];if(q.t==type&&p.q.cnt[type]-n<q.goal&&p.q.cnt[type]>=q.goal)send(ws,{t:'notify',m:'✅ Quest complete: '+q.n})}}
const questList=(p,name)=>{ensureQ(p,name);return p.q.list.map((e,i)=>{const q=QPOOL[e.k];return{i,n:q.n,goal:q.goal,prog:Math.min(q.goal,p.q.cnt[q.t]||0),r:q.r,claimed:e.claimed}})};
const achList=p=>ACH.map(a=>{const v=a.v(p);return{id:a.id,n:a.n,d:a.d,goal:a.goal,prog:Math.min(a.goal,v),r:a.r,claimed:!!p.achClaimed[a.id]}});
const collList=p=>{const n=uniq(p);return COLL.map(([k,r])=>({k,r,ok:n>=k,claimed:p.collClaimed.includes(k)}))};
const readyCount=(p,name)=>questList(p,name).filter(q=>q.prog>=q.goal&&!q.claimed).length+achList(p).filter(a=>a.prog>=a.goal&&!a.claimed).length+collList(p).filter(c=>c.ok&&!c.claimed).length;

// ---- items / placement
const placed=(p,type)=>p.items.filter(i=>i.type==type).length;
function fit(def,x,y){x=+x;y=+y;if(!isFinite(x)||!isFinite(y))return null;
  if(def.kind=='wall'){x=clamp(x,40,760);y=clamp(y,45,235);if(!def.wide&&x>292&&x<508&&y>38&&y<218)return null}
  else{x=clamp(x,30,770);y=def.wallside?clamp(y,330,352):clamp(y,def.kind=='rug'?365:340,578)}
  return[Math.round(x),Math.round(y)]}
function spot(p,role,d){const l=p.items.filter(i=>C.ITEMS[i.type]?.role==role);if(!l.length)return{xy:DEF[role]};
  const it=pick(l),def=C.ITEMS[it.type];let x=it.x,y=it.y;
  if(role=='eat'||role=='drink'){x-=30;y+=3}else if(role=='play'){x-=10;y+=4}else if(role=='tv')y+=48;else if(def.lift)y+=1;else y+=28;
  return{xy:[x,clamp(y,335,568)],it}}
const favToyOf=d=>String(d.favToy||'').toLowerCase();
// ---- runtime dog movement
function rt(d){ if(d.state) return d; Object.assign(d,{fx:rnd(80,720),fy:rnd(345,550),tx:0,ty:0,t0:0,dur:1,until:0,state:'IDLE'}); d.tx=d.fx;d.ty=d.fy; return d }
const posOf=(d,now)=>{const k=Math.min(1,(now-d.t0)/d.dur);return [d.fx+(d.tx-d.fx)*k,d.fy+(d.ty-d.fy)*k]};
const pub=(d,now)=>({id:d.id,breed:d.breed,variant:d.variant,name:d.name,pers:d.pers,bond:d.bond|0,hunger:d.hunger|0,energy:d.energy|0,happy:d.happy|0,clean:d.clean|0,
  favFood:d.favFood,favToy:d.favToy,born:d.born,state:d.state,fx:d.fx,fy:d.fy,tx:d.tx,ty:d.ty,dur:d.dur,el:now-d.t0,acc:d.acc,fav:d.fav,away:!!d.away,tricks:d.tricks,trick:d.trick||null,
  wish:d.wish?{k:d.wish.k,f:d.wish.f||null,need:d.wish.need,got:d.wish.got,ms:Math.max(0,d.wish.exp-now)}:null,fetch:d.fetch?{st:d.fetch.st,bx:d.fetch.bx,by:d.fetch.by,el:now-d.fetch.t0}:null});
const hlOf=p=>Math.min(C.HOUSE.length-1,Math.max(0,p.hl|0)), maxItems=p=>C.HOUSE[hlOf(p)].items, maxDogs=p=>C.HOUSE[hlOf(p)].dogs;
const houseDogs=p=>p.dogs.filter(d=>!d.away).slice(0,maxDogs(p)).map(rt);
const STAY={IDLE:3000,WALK:500,RUN:300,SLEEP:14000,EAT:6000,DRINK:4000,PLAY:8000,SNIFF:4000,SIT:4000,BARK:2500,STRETCH:2500,WINDOW:7000,SEEK_OWNER:6000,EXPLORE:1500,SOCIAL:6000,CORNER:7000,WATCH:9000,TRICK:2800};
function decide(p,d,dogs,now,forced){
  const [x,y]=posOf(d,now); d.fx=x;d.fy=y; let stt=forced; d.trick=null;
  if(!stt){
    const h=new Date().getHours(), night=h>=21||h<6, tv=p.items.some(i=>C.ITEMS[i.type].role=='tv');
    const w={IDLE:1,WALK:1.5,RUN:.5,SLEEP:.6,EAT:.5,DRINK:.4,PLAY:1,SNIFF:1,SIT:.7,BARK:.3,STRETCH:.4,WINDOW:.3,SEEK_OWNER:.4,EXPLORE:.8,CORNER:.2,SOCIAL:dogs.length>1?.8:0,WATCH:tv?.6:0};
    for(const k in PERS[d.pers]) w[k]*=PERS[d.pers][k];
    if(p.party&&p.party.until>now){w.PLAY*=3;w.RUN*=3;w.SOCIAL*=4;w.BARK*=3;w.SLEEP*=.1;w.CORNER*=.2}
    if(d.hunger<40) w.EAT*=6; if(d.energy<30) w.SLEEP*=6; if(d.energy>85) w.SLEEP*=.1; if(night) w.SLEEP*=3;
    let t=Object.values(w).reduce((a,b)=>a+b,0)*Math.random();
    for(const k in w){t-=w[k]; if(t<=0){stt=k;break}} stt=stt||'IDLE';
  }
  let tg=[x,y],sp=null;
  const go=r=>{sp=spot(p,r,d);tg=sp.xy};
  if(['WALK','RUN','EXPLORE'].includes(stt)) tg=[rnd(60,740),rnd(340,560)];
  else if(stt=='EAT') go('eat'); else if(stt=='DRINK') go('drink'); else if(stt=='SLEEP') go('sleep'); else if(stt=='PLAY') go('play'); else if(stt=='WATCH') go('tv');
  else if(stt=='SEEK_OWNER') tg=AVD.ownerSpot(p.av&&p.av.hm); else if(stt=='CORNER') tg=DEF.corner; else if(stt=='WINDOW') tg=DEF.window;
  else if(stt=='SOCIAL'){const o=pick(dogs.filter(o=>o!==d)); if(o){const [ox,oy]=posOf(o,now);tg=[ox+30,oy]}}
  tg=[tg[0]+rnd(-8,8),clamp(tg[1]+rnd(-5,5),335,568)];
  const dist=Math.hypot(tg[0]-x,tg[1]-y), spd=stt=='RUN'?170:stt=='EXPLORE'?45:75;
  d.state=stt;d.tx=tg[0];d.ty=tg[1];d.t0=now;d.dur=Math.max(300,dist/spd*1000);d.until=now+d.dur+(STAY[stt]||3000)*rnd(.7,1.3);
  if(!forced){if(stt=='EAT') d.hunger=clamp(d.hunger+35); if(stt=='DRINK') d.hunger=clamp(d.hunger+3)}
  if(stt=='SLEEP') d.energy=clamp(d.energy+40);
  if(stt=='PLAY'||stt=='RUN'){d.happy=clamp(d.happy+8);d.energy=clamp(d.energy-12)}
  if(stt=='PLAY'&&sp&&sp.it&&favToyOf(d).startsWith(C.ITEMS[sp.it.type].fav||'~')) d.happy=clamp(d.happy+8);
}
// ---- networking
const conns=new Map(), queue=[];
const send=(ws,o)=>ws.readyState==1&&ws.send(JSON.stringify(o));
const viewers=o=>[...conns].filter(([,c])=>c.view==o).map(([w])=>w);
const toView=(o,m)=>viewers(o).forEach(w=>send(w,m));
const sendAll=m=>conns.forEach((_,w)=>send(w,m));
const wsOf=name=>[...conns].find(([,c])=>c.name==name)?.[0];
const sendMe=ws=>{const c=conns.get(ws),p=player(c.name);send(ws,{t:'me',name:c.name,guest:c.guest,coins:p.coins,gems:p.gems,tickets:p.tickets,xp:p.xp,lvl:lvl(p),pity:p.pity,wins:p.wins,
  owned:[...new Set(p.dogs.map(d=>d.breed))],total:p.dogs.length,canClaim:p.daily.last!=today(),streak:p.daily.streak,inv:p.inv,unlock:p.unlock,ready:readyCount(p,c.name),stats:p.stats,av:p.av,avOwn:p.avOwn||[],...F.meExtra(p,c.name)})};
const sendPlayers=()=>sendAll({t:'players',list:[...conns.values()].map(c=>({name:c.name,lvl:lvl(player(c.name)),view:c.view,park:!!c.park,dog:player(c.name).dogs[0]?.breed}))});
function sendHouse(ws,owner){const p=player(owner),now=Date.now();send(ws,{t:'house',owner,av:p.av,deco:p.deco,items:p.items,dogs:houseDogs(p).map(d=>pub(d,now)),party:p.party&&p.party.until>now?p.party.until-now:0,likes:p.likes|0})}
const pushHouse=o=>viewers(o).forEach(w=>sendHouse(w,o));
const pushDogs=(o,p)=>toView(o,{t:'dogs',full:1,dogs:houseDogs(p).map(d=>pub(d,Date.now()))});
const realName=n=>Object.keys(db.players).find(k=>k.toLowerCase()==String(n).trim().toLowerCase());
const avOf=n=>{const o=db.players[n];if(!o)return null;if(V)V.ensure(o,n);return o.av||null};   // a player's look (validated), for friend lists / leaderboards
function sendFriends(ws,c){const p=player(c.name);const row=n=>{const w=wsOf(n),o=db.players[n];return{name:n,lvl:o?lvl(o):1,online:!!w,view:w?conns.get(w).view:null,dog:o?.dogs[0]?.breed,av:avOf(n)}};
  send(ws,{t:'friends',friends:p.friends.map(row),inReq:p.reqIn.map(row),outReq:p.reqOut,gifted:p.gifted,today:today()})}
function leaderboard(me){const ps=Object.entries(db.players).filter(([n])=>!isGuestName(n)).map(([n,p])=>({n,lvl:lvl(p),xp:p.xp,breeds:uniq(p),dogs:p.dogs.length,wins:p.wins,items:p.items?.length||0,likes:p.likes|0,cozy:F.cozy(p).score,arcade:p.stats.mpwin|0,wishes:p.stats.wish|0}));
  const top=(k)=>[...ps].sort((a,b)=>b[k]-a[k]||b.xp-a.xp).slice(0,10).map(x=>({n:x.n,v:x[k],lvl:x.lvl}));
  const rank=k=>[...ps].sort((a,b)=>b[k]-a[k]||b.xp-a.xp).findIndex(x=>x.n==me)+1;
  const out={level:top('xp'),breeds:top('breeds'),wins:top('wins'),likes:top('likes'),cozy:top('cozy'),arcade:top('arcade'),wishes:top('wishes'),
    rank:{level:rank('xp'),breeds:rank('breeds'),wins:rank('wins'),likes:rank('likes'),cozy:rank('cozy'),arcade:rank('arcade'),wishes:rank('wishes')}};
  const avs=Object.create(null);for(const k of ['level','breeds','wins','likes','cozy','arcade','wishes'])for(const x of out[k])if(!(x.n in avs))avs[x.n]=avOf(x.n);   // one look per distinct player, shared by every board
  out.avs=avs;return out}

const S=require('./social')({db,conns,send,sendAll,wsOf,player,give,rtxt,clamp,rnd,pick,today,lvl,sendMe,pushDogs,pushHouse,C,BR,dirty:()=>{dirty=true},bump,realName,maxDogs,sendPlayers});
const XF={rpsWaiting:()=>queue.length,db,conns,send,sendAll,wsOf,player,give,rtxt,clamp,rnd,pick,rid,today,lvl,sendMe,sendHouse,pushDogs,pushHouse,houseDogs,pub,rt,decide,posOf,addXp,C,BR,BREEDS,dirty:()=>{dirty=true},bump,realName,own,cat,safe,toView,viewers,maxItems,maxDogs,hlOf,isGuestName,DEF,S,favToyOf};
const F=require('./fun')(XF);
const A=require('./arcade')({...XF,F});
V=require('./wardrobe')(XF);
const server=http.createServer((q,r)=>{
  if(q.url=='/healthz'){r.writeHead(200,{'Content-Type':'text/plain'});return r.end('ok '+conns.size)}
  if(q.method!='GET'&&q.method!='HEAD'){r.writeHead(405);return r.end()}
  r.writeHead(200,{'Content-Type':'text/html; charset=utf-8','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});
  if(q.method=='HEAD')return r.end();const f=fs.createReadStream(INDEX);f.on('error',()=>r.end('index.html missing'));f.pipe(r)});
const wss=new WebSocketServer({server,maxPayload:4096});

// hostile JSON like {"id":{"toString":1}} would make String(x) throw; strip such keys and cap nesting depth before any handler sees the message
const BADK=['toString','valueOf','toJSON','constructor','__proto__','prototype'];
function scrub(o,d){for(const k of BADK)if(Object.prototype.hasOwnProperty.call(o,k))delete o[k];
  for(const k of Object.keys(o)){const v=o[k];if(v&&typeof v=='object'){if(d>=3)o[k]=null;else scrub(v,d+1)}}}
function drop(ws){const qi=queue.indexOf(ws);if(qi>=0)queue.splice(qi,1);const c=conns.get(ws);if(c)clearTimeout(c.rpsBot);if(c&&c.game)endRps(c.game,c.name);S.onClose(ws);A.onClose(ws);F.onClose(ws);conns.delete(ws)}
const ipOf=ws=>ws.ip||'?', isLocal=ip=>/^(::1|127\.|::ffff:127\.)/.test(ip), lim=new Map();
function hit(ip,kind,max,win){if(isLocal(ip))return true;const k=kind+ip,n=Date.now(),e=lim.get(k);if(!e||n-e.t>win){lim.set(k,{t:n,n:1});return true}return ++e.n<=max}
setInterval(safe('lim',()=>{const n=Date.now();for(const [k,e] of lim)if(n-e.t>36e5)lim.delete(k)}),6e5);
function enter(ws,name,guest,token){
  for(const [w,o] of conns) if(o.name==name&&w!==ws){send(w,{t:'kick'});drop(w);w.close()}
  conns.set(ws,{name,view:name,guest,last:Date.now()}); const p=player(name);ensureQ(p,name);
  send(ws,{t:'auth',ok:true,name,guest,token});
  send(ws,{t:'welcome',breeds:BREEDS,rates:RATES,cost:COST,pity:PITY,cat:{items:C.ITEMS,food:C.FOOD,acc:C.ACC,walls:C.WALLS,floors:C.FLOORS,lights:C.LIGHTS,tricks:C.TRICKS,season:C.season()},max:{house:maxDogs(p),items:maxItems(p)},house:C.HOUSE,sets:C.SETS,perks:C.PERKS,events:C.EVENTS});
  S.touch(name); sendMe(ws); sendHouse(ws,name); sendPlayers(); send(ws,S.goalMsg(name)); F.onEnter(ws,conns.get(ws),p);
  if(p.daily.last!=today()) send(ws,{t:'notify',m:'🎁 รางวัลล็อกอินรายวันพร้อมรับแล้ว!'});
  for(const n of p.reqIn) send(ws,{t:'notify',m:'👥 '+n+' ส่งคำขอเป็นเพื่อน'});
}
wss.on('connection',(ws,req)=>{
  let last=0,count=0,fails=0,tries=0,flood=0;ws.ip=String(req&&req.socket&&req.socket.remoteAddress||'?');ws.born=Date.now();
  ws.on('error',()=>{});
  ws.on('message',raw=>{ try{ onMessage(raw) }catch(e){ console.error('[msg]',e&&e.stack||e) } });
  function onMessage(raw){
    const now=Date.now(); if(now-last>1000){if(count<=RATE)flood=0;last=now;count=0} if(++count>RATE){if(++flood>300)ws.close();return}
    if(typeof raw!='string'&&!(raw instanceof Buffer))return; if(raw.length>4096)return;
    let m; try{m=JSON.parse(raw)}catch{return}
    if(!m||typeof m!='object'||Array.isArray(m)) return;
    scrub(m,0);
    let c=conns.get(ws); if(c)c.last=now;
    if(!c){                                   // ---- authentication (server-side only)
      const bad=e=>{fails++;send(ws,{t:'auth',ok:false,err:e})};
      if(fails>=8||++tries>30||!hit(ipOf(ws),'f',25,3e5)) return send(ws,{t:'auth',ok:false,err:'ลองมากเกินไป รอสักครู่แล้วรีเฟรช'});
      if(typeof m.t!='string') return;
      const user=String(m.user||'').trim(), pw=String(m.pass||'');
      if(m.t=='register'){
        if(!hit(ipOf(ws),'r',10,36e5)) return bad('สมัครบ่อยเกินไป ลองใหม่ภายหลัง');
        if(!/^[A-Za-z0-9_฀-๿]{3,16}$/.test(user)||/^guest/i.test(user)||RESERVED.includes(user.toLowerCase())) return bad('ชื่อผู้ใช้ 3-16 ตัว (ห้ามขึ้นต้น Guest)');
        if(!/^\S+@\S+\.\S+$/.test(String(m.email||''))) return bad('อีเมลไม่ถูกต้อง');
        if(pw.length<6||pw.length>64) return bad('รหัสผ่านอย่างน้อย 6 ตัว');
        if(own(db.accounts,user.toLowerCase())||Object.keys(db.players).some(k=>k.toLowerCase()==user.toLowerCase())) return bad('ชื่อนี้ถูกใช้แล้ว');
        const salt=crypto.randomBytes(16).toString('hex');
        db.accounts[user.toLowerCase()]={name:user,email:String(m.email).slice(0,60),salt,hash:hashPw(pw,salt)}; dirty=true;
        enter(ws,user,false,newSession(user));
      } else if(m.t=='login'){
        const a=own(db.accounts,user.toLowerCase())?db.accounts[user.toLowerCase()]:null;
        if(!a||!a.salt||pw.length>64||!checkPw(a,pw)) return bad('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
        enter(ws,a.name,false,newSession(a.name));
      } else if(m.t=='resume'){
        const s=db.sessions[sha(String(m.token||'').slice(0,100))];
        if(!s||s.exp<Date.now()||!own(db.players,s.name)&&!own(db.accounts,s.name.toLowerCase())) return bad('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
        enter(ws,s.name,false,m.token);
      } else if(m.t=='guest'){
        if(!hit(ipOf(ws),'g',40,36e5)) return bad('เข้าเป็น Guest บ่อยเกินไป');
        let g,k=0;do g='Guest'+(1000+Math.floor(Math.random()*9000));while(k++<50&&(own(db.players,g)||[...conns.values()].some(o=>o.name==g)));
        enter(ws,g,true,null)}
      return;
    }
    if(typeof m.t!='string'||m.t.length>24) return;
    if(m.t=='ping'){send(ws,{t:'pong',c:+m.c||0});return}
    if(S.handle(ws,c,m)||A.handle(ws,c,m)||F.handle(ws,c,m)||V.handle(ws,c,m)) return;
    const p=player(c.name), mine=c.view==c.name, toast=s=>send(ws,{t:'toast',m:s});
    switch(m.t){
      case 'admin':{   // owner-only cheat: needs ADMIN_KEY (>=8 chars) set as an environment variable on the host; silent on any failure
        const K=process.env.ADMIN_KEY||'';
        if(c.guest||K.length<8||!hit(ipOf(ws),'adm',5,36e5)) break;
        if(typeof m.key!='string'||m.key.length!=K.length||!crypto.timingSafeEqual(Buffer.from(m.key),Buffer.from(K))) break;
        const amt=clamp(Math.floor(+m.coins||1e6),0,1e9);
        p.coins=Math.max(p.coins,amt);p.gems=Math.max(p.gems,9999);p.tickets=Math.max(p.tickets,999);
        for(const k in C.ITEMS)p.inv[k]=Math.max(p.inv[k]||0,10);
        for(const k in C.FOOD)p.inv[k]=Math.max(p.inv[k]||0,99);
        for(const k in C.ACC)p.inv[k]=Math.max(p.inv[k]||0,1);
        p.unlock.wall=Object.keys(C.WALLS);p.unlock.floor=Object.keys(C.FLOORS);p.unlock.light=Object.keys(C.LIGHTS);
        const all=[];for(const k in AVD.KINDS)for(const it of AVD.KINDS[k])if(it.p)all.push(k+':'+it.id);p.avOwn=all;
        dirty=true;sendMe(ws);toast('🛠️ แอดมิน: เหรียญ '+p.coins.toLocaleString()+' + ของครบทุกชิ้น');
        console.log('[admin] cheat granted to',c.name);break }
      case 'logout':{ if(m.token) delete db.sessions[sha(String(m.token).slice(0,100))]; dirty=true; drop(ws); sendPlayers(); break }
      case 'visit':{ if(own(db.players,m.id)){ S.leavePark(ws); if(c.view!=m.id&&m.id!=c.name) bump(c.name,'visit',1,ws); c.view=m.id;sendHouse(ws,m.id);sendMe(ws);sendPlayers();F.onVisit(ws,c,m.id)} break }
      case 'chat':{ const s=String(m.m||'').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e]/g,'').replace(/\s+/g,' ').trim().slice(0,120);
        if(!s||now-(c.lastChat||0)<900||(s==c.lastTxt&&now-c.lastChat<8000)) { if(s&&now-(c.lastChat||0)<900)toast('💬 พิมพ์ช้าลงหน่อยนะ'); break } c.lastChat=now;c.lastTxt=s; sendAll({t:'chat',from:c.name,m:s}); break }
      case 'emoji':{ if(['❤️','😂','👍','🐶','⭐','😮'].includes(m.e)) toView(c.view,{t:'fx',e:m.e,x:rnd(100,700),y:rnd(250,400)}); break }
      case 'deco':{
        const DK={wall:C.WALLS,floor:C.FLOORS,light:C.LIGHTS},T=own(DK,m.k)?DK[m.k]:null; if(!mine||!T||!own(T,m.v)) break;
        if(T[m.v]>0&&!p.unlock[m.k].includes(m.v)){ if(p.coins<T[m.v]) return toast('Coins ไม่พอ'); p.coins-=T[m.v]; p.unlock[m.k].push(m.v); toast('🎨 ปลดล็อก '+m.v+'!') }
        p.deco[m.k]=m.v;dirty=true;toView(c.name,{t:'deco',deco:p.deco});sendMe(ws);break }
      case 'rename':{ const d=p.dogs.find(d=>d.id===m.dog),s=String(m.name||'').replace(/[<>&"'\u0000-\u001f\u200b-\u200f\u2028-\u202e]/g,'').trim().slice(0,12); if(d&&s){d.name=s;dirty=true;pushDogs(c.name,p)} break }
      case 'daily':{
        if(p.daily.last==today()) return toast('รับรางวัลวันนี้ไปแล้ว');
        const y=new Date(Date.now()-864e5).toISOString().slice(0,10);
        p.daily.streak=p.daily.last==y?(p.daily.streak%7)+1:1; p.daily.last=today();
        const r=DAILY[p.daily.streak-1]; give(p,r);
        send(ws,{t:'daily_ok',day:p.daily.streak,r}); sendMe(ws); break }
      case 'act':{
        if(!['pet','play','toy','brush','bath','train'].includes(m.a)) break;
        if(!own(db.players,c.view)) break; const dogs=houseDogs(db.players[c.view]), d=dogs.find(d=>d.id===m.dog); if(!d) break;
        if(m.a=='pet'){ toView(c.view,{t:'fx',e:'❤️',dog:d.id,pet:1}); if(mine){d.happy=clamp(d.happy+8);d.bond=clamp(d.bond+1+(F.perks(p).has('bond')?1:0));addXp(p,1,ws);bump(c.name,'pet',1,ws);F.wish(p,d,'pet',null,ws,c.name)} }
        else if(mine){
          if(m.a=='play'||m.a=='toy'){ d.bond=clamp(d.bond+2); addXp(p,3,ws); bump(c.name,'play',1,ws); decide(p,d,dogs,now,'PLAY'); F.wish(p,d,'play',null,ws,c.name) }
          else if(m.a=='brush'){ d.happy=clamp(d.happy+6);d.clean=clamp(d.clean+8);d.bond=clamp(d.bond+1); bump(c.name,'brush',1,ws);addXp(p,2,ws); toView(c.view,{t:'fx',e:'✨',dog:d.id}); F.wish(p,d,'brush',null,ws,c.name) }
          else if(m.a=='bath'){ if(p.coins<5) return toast('Coins ไม่พอ'); p.coins-=5; d.clean=100; d.happy=clamp(d.happy+4); d.bond=clamp(d.bond+1); bump(c.name,'bath',1,ws);addXp(p,2,ws); toView(c.view,{t:'fx',e:'🛁',dog:d.id}); F.wish(p,d,'bath',null,ws,c.name) }
          else if(m.a=='train'){
            if(d.energy<15) return toast(d.name+' หมดแรงแล้ว ให้พักก่อนนะ 💤');
            const nx=C.TRICKS.find(([n,b])=>!d.tricks.includes(n)&&d.bond>=b); let tr,isNew=false;
            if(nx&&(!d.tricks.length||Math.random()<.6)){tr=nx[0];d.tricks.push(tr);isNew=true}else if(d.tricks.length)tr=pick(d.tricks);else return toast('Bond ยังไม่พอสำหรับเทรน');
            d.energy=clamp(d.energy-10);d.bond=clamp(d.bond+1);d.happy=clamp(d.happy+5);addXp(p,isNew?8:3,ws);bump(c.name,'train',1,ws);
            decide(p,d,dogs,now,'TRICK');d.trick=tr;F.wish(p,d,'train',null,ws,c.name);
            if(isNew){p.coins+=10;toast('🎓 '+d.name+' learned “'+tr+'”! +10🪙')}else toast('👏 '+d.name+' did “'+tr+'”')
          }
        } else break;
        dirty=true; toView(c.view,{t:'dogs',dogs:[pub(d,now)]}); sendMe(ws); break;
      }
      case 'feed':{
        if(!mine) break; const dogs=houseDogs(p), d=dogs.find(d=>d.id===m.dog), FD=cat(C.FOOD,m.food); if(!d||!FD) break;
        if((p.inv[m.food]||0)>0) p.inv[m.food]--; else if(m.food=='kibble'&&p.coins>=FD.p) p.coins-=FD.p; else return toast('ไม่มี '+FD.n+' ในกระเป๋า — ซื้อที่ Shop');
        const fav=String(d.favFood).toLowerCase()==m.food;
        d.hunger=clamp(d.hunger+FD.h);d.happy=clamp(d.happy+FD.hp*(fav?2.5:1));if(FD.c)d.clean=clamp(d.clean+FD.c);d.bond=clamp(d.bond+1+(FD.b||0)+(fav?1:0));
        addXp(p,3,ws);bump(c.name,'feed',1,ws);decide(p,d,dogs,now,'EAT');F.wish(p,d,'feed',m.food,ws,c.name);
        toView(c.view,{t:'fx',e:fav?'😋':'🍖',dog:d.id}); if(fav)toast('😋 '+d.name+' loves '+FD.n+'!');
        dirty=true;toView(c.view,{t:'dogs',dogs:[pub(d,now)]});sendMe(ws);break }
      case 'equip':{
        if(!mine) break; const d=p.dogs.find(d=>d.id===m.dog); if(!d) break;
        if(m.acc===null||m.acc==='') d.acc=null;
        else{ if(!cat(C.ACC,m.acc)) break; const worn=p.dogs.filter(x=>x.acc==m.acc&&x!==d).length; if((p.inv[m.acc]||0)<=worn) return toast('ไม่มีไอเทมนี้ในคลัง (หรือถูกใส่อยู่)'); d.acc=m.acc }
        dirty=true;pushDogs(c.name,p);send(ws,{t:'equip_ok',dog:d.id,acc:d.acc});break }
      case 'shop_buy':{
        const id=String(m.id),n=clamp(Math.floor(+m.n||1),1,10),food=cat(C.FOOD,id),it=cat(C.ITEMS,id),ac=cat(C.ACC,id),def=food||it||ac; if(!def||!Number.isFinite(def.p)) break;
        if(def.season&&def.season!=C.season()) return toast('สินค้านี้ขายเฉพาะช่วงเทศกาล');
        const cap=food?99:ac?1:10; if((p.inv[id]||0)+n>cap) return toast('ถือไอเทมนี้ได้ไม่เกิน '+cap+' ชิ้น');
        const cost=def.p*n; if(p.coins<cost) return toast('Coins ไม่พอ'); p.coins-=cost; p.inv[id]=(p.inv[id]||0)+n; dirty=true;
        bump(c.name,'buy',1,ws);send(ws,{t:'buy_ok',id,n});sendMe(ws);break }
      case 'place':{
        if(!mine) break; const def=cat(C.ITEMS,m.id); if(!def) break; if(p.items.length>=maxItems(p)) return toast('บ้านเต็มแล้ว (สูงสุด '+maxItems(p)+' ชิ้น) — อัปเกรดบ้านเพื่อวางเพิ่ม');
        if(placed(p,m.id)>=(p.inv[m.id]||0)) return toast('ไม่มีไอเทมนี้ในคลัง'); const pos=fit(def,m.x,m.y); if(!pos) return toast('วางตรงนี้ไม่ได้');
        p.items.push({uid:rid(),type:m.id,x:pos[0],y:pos[1],f:m.f?1:0});bump(c.name,'place',1,ws);dirty=true;toView(c.name,{t:'items',items:p.items});sendMe(ws);break }
      case 'move':{
        if(!mine) break; const it=p.items.find(i=>i.uid==m.uid); if(!it) break; const pos=fit(C.ITEMS[it.type],m.x,m.y); if(!pos) return send(ws,{t:'items',items:p.items});
        it.x=pos[0];it.y=pos[1];if(m.f!==undefined)it.f=m.f?1:0;dirty=true;toView(c.name,{t:'items',items:p.items});break }
      case 'store':{
        if(!mine) break; const i=p.items.findIndex(i=>i.uid==m.uid); if(i<0) break; p.items.splice(i,1);dirty=true;toView(c.name,{t:'items',items:p.items});break }
      case 'discard':{   // delete for good: the piece leaves the room AND one copy leaves the bag (no refund)
        if(!mine) break; const i=p.items.findIndex(i=>i.uid==m.uid); if(i<0) break; const ty=p.items[i].type; p.items.splice(i,1);
        if((p.inv[ty]||0)>1)p.inv[ty]--; else delete p.inv[ty];
        dirty=true;toView(c.name,{t:'items',items:p.items});sendMe(ws);break }
      case 'capsule':{
        const n=m.n==10?10:1, ticket=!!m.ticket;
        if(ticket?p.tickets<n:p.coins<COST*n) return toast(ticket?'Tickets ไม่พอ':'Coins ไม่พอ');
        if(ticket)p.tickets-=n; else p.coins-=COST*n;
        const res=[]; for(let i=0;i<n;i++){const d=rollDog(p);if(p.dogs.filter(x=>!x.away).length>=maxDogs(p))d.away=true;p.dogs.push(d);res.push({id:d.id,breed:d.breed,variant:d.variant,name:d.name,r:BR[d.breed][2],away:d.away})}
        addXp(p,5*n,ws); bump(c.name,'caps',n,ws); dirty=true; send(ws,{t:'capsule',res}); sendMe(ws);
        if(mine) pushDogs(c.name,p); break;
      }
      case 'dog_fav':{ const d=p.dogs.find(d=>d.id===m.dog); if(d){d.fav=!d.fav;dirty=true;if(!d.away)pushDogs(c.name,p);send(ws,{t:'dogs_all',dogs:p.dogs.map(x=>pub(rt(x),Date.now()))})} break }
      case 'dog_home':{ if(!mine) break; const d=p.dogs.find(d=>d.id===m.dog); if(!d) break;
        if(m.on){ if(p.dogs.filter(x=>!x.away).length>=maxDogs(p)) return toast('บ้านเต็ม (สูงสุด '+maxDogs(p)+' ตัว) — อัปเกรดบ้านเพื่อเลี้ยงเพิ่ม'); d.away=false;rt(d);decide(p,d,houseDogs(p),Date.now()) }
        else{ if(p.dogs.filter(x=>!x.away).length<=1) return toast('ต้องมีหมาอยู่บ้านอย่างน้อย 1 ตัว'); d.away=true }
        dirty=true;pushDogs(c.name,p);send(ws,{t:'dogs_all',dogs:p.dogs.map(x=>pub(rt(x),Date.now()))});break }
      case 'dogs_get':{ send(ws,{t:'dogs_all',dogs:p.dogs.map(x=>pub(rt(x),Date.now()))}); break }
      case 'release':{
        if(!mine) break; const ids=(Array.isArray(m.ids)?m.ids:[]).slice(0,60).map(String); let gain=0,cnt=0;
        for(const id of ids){ if(p.dogs.length<=1) break; const i=p.dogs.findIndex(d=>d.id==id); if(i<0||p.dogs[i].fav) continue;
          if(!p.dogs[i].away&&p.dogs.filter(d=>!d.away).length<=1) continue;
          gain+=C.RELEASE[BR[p.dogs[i].breed][2]]; p.dogs.splice(i,1); cnt++ }
        p.coins+=gain;dirty=true; toast(cnt?`👋 ปล่อยหมา ${cnt} ตัว +${gain}🪙`:'ไม่มีหมาที่ปล่อยได้ (ตัวโปรดปล่อยไม่ได้)');
        pushHouse(c.name);send(ws,{t:'dogs_all',dogs:p.dogs.map(x=>pub(rt(x),Date.now()))});sendMe(ws);break }
      case 'quests':{ send(ws,{t:'quests',list:questList(p,c.name),bonus:{ready:p.q.list.every(e=>e.claimed),claimed:p.q.bonus},date:p.q.date}); break }
      case 'quest_claim':{ const ql=questList(p,c.name),q=ql[m.i|0]; if(!q||q.claimed||q.prog<q.goal) break; p.q.list[q.i].claimed=true; give(p,q.r); toast('🎁 +'+rtxt(q.r));
        send(ws,{t:'quests',list:questList(p,c.name),bonus:{ready:p.q.list.every(e=>e.claimed),claimed:p.q.bonus},date:p.q.date});sendMe(ws);break }
      case 'quest_bonus':{ if(p.q.bonus||!p.q.list.every(e=>e.claimed)) break; p.q.bonus=true; const r={g:3,tk:1,c:100}; give(p,r); toast('🎉 Daily bonus! +'+rtxt(r));
        send(ws,{t:'quests',list:questList(p,c.name),bonus:{ready:true,claimed:true},date:p.q.date});sendMe(ws);break }
      case 'ach':{ send(ws,{t:'ach',list:achList(p),coll:collList(p)}); break }
      case 'ach_claim':{ const a=achList(p).find(a=>a.id==m.id); if(!a||a.claimed||a.prog<a.goal) break; p.achClaimed[a.id]=true; give(p,a.r); toast('🏆 '+a.n+' +'+rtxt(a.r));
        send(ws,{t:'ach',list:achList(p),coll:collList(p)});sendMe(ws);break }
      case 'coll_claim':{ const e=collList(p).find(e=>e.k==(m.k|0)); if(!e||!e.ok||e.claimed) break; p.collClaimed.push(e.k); give(p,e.r); toast('📖 Collection '+e.k+' +'+rtxt(e.r));
        send(ws,{t:'ach',list:achList(p),coll:collList(p)});sendMe(ws);break }
      case 'friends':{ sendFriends(ws,c); break }
      case 'friend_add':{
        const n=realName(m.name); if(!n) return toast('ไม่พบผู้เล่นชื่อนี้'); if(n==c.name) return toast('เพิ่มตัวเองไม่ได้นะ 😅');
        if(p.friends.includes(n)) return toast('เป็นเพื่อนกันอยู่แล้ว'); const o=player(n);
        if(p.reqIn.includes(n)){ p.reqIn=p.reqIn.filter(x=>x!=n);o.reqOut=o.reqOut.filter(x=>x!=c.name);p.friends.push(n);o.friends.push(c.name);toast('🤝 เป็นเพื่อนกับ '+n+' แล้ว!'); const ow=wsOf(n); if(ow){send(ow,{t:'notify',m:'🤝 '+c.name+' ตอบรับเป็นเพื่อน'});sendFriends(ow,conns.get(ow))} }
        else if(p.reqOut.includes(n)) return toast('ส่งคำขอไปแล้ว');
        else{ p.reqOut.push(n);o.reqIn.push(c.name);toast('📨 ส่งคำขอถึง '+n+' แล้ว'); const ow=wsOf(n); if(ow){send(ow,{t:'notify',m:'👥 '+c.name+' ส่งคำขอเป็นเพื่อน'});sendFriends(ow,conns.get(ow));sendMe(ow)} }
        dirty=true;sendFriends(ws,c);break }
      case 'friend_ok':{ const n=realName(m.name); if(!n||!p.reqIn.includes(n)) break; const o=player(n); p.reqIn=p.reqIn.filter(x=>x!=n);o.reqOut=o.reqOut.filter(x=>x!=c.name);
        p.friends.push(n);o.friends.push(c.name);dirty=true;toast('🤝 เป็นเพื่อนกับ '+n+' แล้ว!'); const ow=wsOf(n); if(ow){send(ow,{t:'notify',m:'🤝 '+c.name+' ตอบรับเป็นเพื่อน'});sendFriends(ow,conns.get(ow))} sendFriends(ws,c);sendMe(ws);break }
      case 'friend_no':{ const n=realName(m.name); if(!n) break; const o=player(n); p.reqIn=p.reqIn.filter(x=>x!=n);o.reqOut=o.reqOut.filter(x=>x!=c.name);dirty=true;sendFriends(ws,c);break }
      case 'friend_del':{ const n=realName(m.name); if(!n) break; const o=player(n); p.friends=p.friends.filter(x=>x!=n);o.friends=o.friends.filter(x=>x!=c.name);dirty=true;sendFriends(ws,c);break }
      case 'friend_gift':{ const n=realName(m.name); if(!n||!p.friends.includes(n)) break; if(p.gifted[n]==today()) return toast('วันนี้ส่งของขวัญให้คนนี้แล้ว');
        const o=player(n); p.gifted[n]=today(); o.inv.treat=Math.min(99,(o.inv.treat||0)+1); o.coins+=5; p.coins+=8; dirty=true; bump(c.name,'gift',1,ws);F.mailTo(n,{k:'gift',from:c.name});
        toast('🎁 ส่งของขวัญให้ '+n+' แล้ว +8🪙'); const ow=wsOf(n); if(ow){send(ow,{t:'notify',m:'🎁 '+c.name+' ส่งขนมให้คุณ (+5🪙)'});sendMe(ow)} sendFriends(ws,c);sendMe(ws);break }
      case 'lb':{ send(ws,{t:'lb',...leaderboard(c.name)}); break }
      case 'mg_start':{ if(!['memory','catch','guess'].includes(m.g)) break; c.mg={g:m.g,t:now}; break }
      case 'mg_end':{
        const g=c.mg; c.mg=null; if(!g) break; const el=(now-g.t)/1000,sc=Math.max(0,Math.floor(+m.score||0)); let r=0;
        if(g.g=='memory'&&el>=10&&sc>=8) r=clamp(50-(sc-8)*3,10,50);
        else if(g.g=='catch'&&el>=17&&el<=45) r=clamp(Math.min(sc,Math.floor(el*2))*3,0,75);
        else if(g.g=='guess'&&el>=5) r=clamp(Math.min(sc,5)*12,0,60);
        if(p.mg.date!=today()) p.mg={date:today(),coins:0}; r=clamp(r,0,Math.max(0,500-p.mg.coins));
        p.mg.coins+=r; p.coins+=r; if(r>0){addXp(p,Math.ceil(r/5),ws);bump(c.name,'mg',1,ws)}dirty=true;
        send(ws,{t:'mg_ok',g:g.g,reward:r,capped:p.mg.coins>=500});sendMe(ws);break }
      case 'rps_find':{
        if(c.game||queue.includes(ws)) break;
        const o=queue.shift();
        if(o&&conns.has(o)){const oc=conns.get(o),g={a:ws,b:o,pick:{}};c.game=oc.game=g;clearTimeout(oc.rpsBot);
          send(ws,{t:'rps_start',vs:oc.name,lvl:lvl(player(oc.name)),my:lvl(p)});send(o,{t:'rps_start',vs:c.name,lvl:lvl(p),my:lvl(player(oc.name))});
          g.timer=setTimeout(()=>endRps(g),25000);}
        else{queue.push(ws);send(ws,{t:'rps_wait'});clearTimeout(c.rpsBot);c.rpsBot=setTimeout(()=>rpsBot(ws),RPS_WAIT)} break;      // nobody came: a friendly bot plays (like the other online games)
      }
      case 'rps_cancel':{ const qi=queue.indexOf(ws); if(qi>=0) queue.splice(qi,1); clearTimeout(c.rpsBot); break }
      case 'rps_pick':{ const g=c.game; if(!g||typeof m.v!='string'||!['R','P','S'].includes(m.v)||g.pick[c.name]) break; g.pick[c.name]=m.v; if(Object.keys(g.pick).length==2) endRps(g); break }
    }
  }
  ws.on('close',safe('close',()=>{ const had=conns.has(ws); drop(ws); if(had) sendPlayers() }));
  setTimeout(()=>{if(!conns.has(ws)&&ws.readyState==1)ws.close()},60000).unref();    // sockets that never log in are dropped
});
setInterval(safe('idle',()=>{const n=Date.now();for(const [w,c] of conns)if(n-(c.last||0)>180000){send(w,{t:'kick',idle:1});w.close()}}),30000);   // dead connections (client pings every 20 s)
const RPS_WAIT=+process.env.CD_MPWAIT||8000, BOT_NAMES=['Pudding','Mochi','Biscuit','Nova','Waffle','Pepper','Bean','Maple','Coco','Teddy','Miso','Ollie'];
function rpsBot(ws){          // no human opponent showed up: start a bot match (half reward, counted in the daily arcade cap)
  const c=conns.get(ws),qi=queue.indexOf(ws); if(!c||qi<0||c.game) return; queue.splice(qi,1);
  const nm=pick(BOT_NAMES),g={a:ws,b:null,bot:nm,pick:{}};c.game=g;
  send(ws,{t:'rps_start',vs:'🤖 '+nm,lvl:Math.floor(rnd(2,9)),my:lvl(player(c.name)),bot:1});
  g.timer=setTimeout(()=>endRps(g),25000);
  g.botT=setTimeout(()=>{if(c.game!==g)return;g.pick.$bot=pick(['R','P','S']);if(g.pick[c.name])endRps(g)},rnd(1200,3200));
}
function endRps(g,quitter){            // server decides winner & pays out
  clearTimeout(g.timer);clearTimeout(g.botT); const A=conns.get(g.a),B=g.bot?null:conns.get(g.b); if(!A&&!B) return;
  const beats={R:'S',S:'P',P:'R'}, pa=A&&g.pick[A.name], pb=g.bot?g.pick.$bot:B&&g.pick[B.name]; let ra=0;
  if(quitter) ra=quitter==(A&&A.name)?-1:1; else if(pa&&!pb) ra=1; else if(pb&&!pa) ra=-1; else if(pa&&pb&&pa!=pb) ra=beats[pa]==pb?1:-1;
  for(const [w,c,my,op,r] of [[g.a,A,pa,pb,ra],[g.b,B,pb,pa,-ra]]){
    if(!c) continue; c.game=null; const p=player(c.name); let gain=r>0?30:r==0?5:0;
    if(g.bot){if(!p.mp||p.mp.date!=today())p.mp={date:today(),coins:0};gain=clamp(Math.round(gain/2),0,Math.max(0,600-p.mp.coins));p.mp.coins+=gain}
    p.coins+=gain; if(r>0){if(!g.bot)p.wins++;addXp(p,g.bot?10:20,w);bump(c.name,'win',1,w)} dirty=true;
    send(w,{t:'rps_result',my,op,r,gain,bot:g.bot?1:0}); sendMe(w);
  }
}
// ---- simulation (1 Hz, only watched houses) + random cute events
setInterval(()=>{
  const now=Date.now();
  for(const o of new Set([...conns.values()].map(c=>c.view))){
    const p=db.players[o]; if(!p) continue; const dogs=houseDogs(p), changed=[], pk=F.perks(p);
    for(const d of dogs){if(d.fetch){if(now-d.fetch.t0>30000)d.fetch=null;else continue}
      d.hunger=clamp(d.hunger-.25*(pk.has('hunger')?.65:1),5); d.energy=clamp(d.energy-.12*(pk.has('energy')?.6:1),5); d.happy=clamp(d.happy-.05,pk.has('happy')?45:20); d.clean=clamp(d.clean-.03,10);
      if(now>=d.until){decide(p,d,dogs,now);changed.push(pub(d,now))}
      if(d.hunger<25&&(!d.nt||now-d.nt>3e5)){d.nt=now;const ow=wsOf(o);ow&&send(ow,{t:'notify',m:`🐶 ${d.name} หิวแล้ว!`})}
    }
    if(changed.length) toView(o,{t:'dogs',dogs:changed});
  }
},1000);
const EVT=[['found a ball!','PLAY'],['fell asleep on the sofa.','SLEEP'],['wants to play!','PLAY'],['discovered a new place!','EXPLORE'],
  ['brought you a toy!','SEEK_OWNER'],['is looking out the window.','WINDOW'],['is chasing a butterfly 🦋','RUN'],['is rolling around happily!','STRETCH']];
setInterval(()=>{
  const now=Date.now();
  for(const o of new Set([...conns.values()].map(c=>c.view))){
    const p=db.players[o]; if(!p) continue; const dogs=houseDogs(p).filter(d=>!d.fetch); if(!dogs.length) continue; const ow=wsOf(o), here=ow&&conns.get(ow).view==o;
    if(dogs.length>1&&Math.random()<.2){const [a,b]=dogs.sort(()=>Math.random()-.5);decide(p,a,dogs,now,'SLEEP');decide(p,b,dogs,now,'SLEEP');
      toView(o,{t:'dogs',dogs:[pub(a,now),pub(b,now)]});toView(o,{t:'event',text:`💤 ${a.name} และ ${b.name} นอนด้วยกัน (+5🪙)`});
      if(here){p.coins+=5;dirty=true;sendMe(ow)} continue}
    const d=pick(dogs);
    if(Math.random()<.18){ const big=Math.random()<.04, r=big?{g:1}:{c:Math.floor(rnd(3,9))}; decide(p,d,dogs,now,'SNIFF'); toView(o,{t:'dogs',dogs:[pub(d,now)]});
      toView(o,{t:'event',text:`⛏️ ${d.name} dug up ${big?'a shiny gem 💎':'a buried coin 🪙'}${here?' (+'+rtxt(r)+')':''}`}); if(here){give(p,r);sendMe(ow)} continue }
    const [txt,stt]=pick(EVT); decide(p,d,dogs,now,stt);
    toView(o,{t:'dogs',dogs:[pub(d,now)]}); toView(o,{t:'event',text:`🐶 ${d.name} ${txt}`});
  }
},40000);
server.on('error',e=>{if(e&&e.code=='EADDRINUSE'){console.error('\n[!] พอร์ต '+PORT+' ถูกใช้อยู่แล้ว — น่าจะมีเซิร์ฟเวอร์ Cozy Dogs ตัวเก่าเปิดค้างอยู่ (ปิดหน้าต่างเทอร์มินัลเก่า หรือกด Ctrl+C)\n    หรือรันพอร์ตอื่น:  Windows: set PORT=3001 && node server.js   |   Mac/Linux: PORT=3001 node server.js\n');process.exit(1)}console.error('server error:',e);process.exit(1)});
(async()=>{if(REMOTE)await remoteLoad();server.listen(PORT,()=>console.log('Cozy Dogs on http://localhost:'+PORT+(REMOTE?'  (data: Supabase)':'  (data: local file)')))})();
