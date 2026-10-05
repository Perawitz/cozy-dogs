// Cozy Dogs - core: state, i18n, helpers, pixel icons, audio, network
'use strict';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),rnd=(a,b)=>a+Math.random()*(b-a),pick=a=>a[Math.floor(Math.random()*a.length)];
const LS={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch{return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}};

// ---------------- state ----------------
const S={scr:'login',ws:null,me:{coins:0,gems:0,tickets:0,xp:0,lvl:1,owned:[],total:0,pity:0,wins:0,inv:{},unlock:{wall:[],floor:[],light:[]},ready:0,stats:{}},name:'',owner:'',deco:{wall:'cream',floor:'wood',light:'warm'},items:[],dogs:{},players:[],
 cat:null,welcome:null,sel:null,edit:false,token:LS.get('cd_token',null),loaded:false,chat:[],notes:[],fx:[],
 set:Object.assign({sound:true,music:true,vol:.6,names:true,particles:true,lang:'th',weather:'auto',time:'auto'},LS.get('cd_set',{}))};
const saveSet=()=>LS.set('cd_set',S.set);
const RN={C:'Common',R:'Rare',E:'Epic',L:'Legendary',M:'Mythic'},RCOL={C:'#b8a99a',R:'#5aa8ff',E:'#b06aff',L:'#ffb52e',M:'#ff5cc0'},RORD={M:0,L:1,E:2,R:3,C:4};
const PERS_EM={PLAYFUL:'🎾',LAZY:'😴',ENERGETIC:'⚡',SHY:'🙈',FRIENDLY:'🤗',FOODIE:'🍖',CURIOUS:'🔍',CLINGY:'🥺',BRAVE:'🦁',SLEEPY:'💤',MISCHIEVOUS:'😈'};

// ---------------- i18n (English keys -> Thai) ----------------
const TH={'Shop':'ร้านค้า','Dogs':'น้องหมา','Capsule':'กาชา','Collection':'สะสม','Quests':'ภารกิจ','Ranks':'อันดับ','Friends':'เพื่อน','Games':'เกม','Decorate':'ตกแต่ง','Photo':'ถ่ายรูป','Settings':'ตั้งค่า','Chat':'แชท',
 'Pet':'ลูบหัว','Feed':'ให้อาหาร','Play':'เล่น','Brush':'หวีขน','Bath':'อาบน้ำ','Train':'เทรน','Info':'ข้อมูล','Wear':'แต่งตัว','Hunger':'หิว','Energy':'พลัง','Happy':'สุข','Clean':'สะอาด','Bond':'ความผูกพัน',
 'Login':'เข้าสู่ระบบ','Register':'สมัครสมาชิก','Guest':'เล่นแบบ Guest','Username':'ชื่อผู้ใช้','Password':'รหัสผ่าน','Email':'อีเมล','Play as Guest':'เล่นแบบ Guest','Create account':'สร้างบัญชี',
 'Buy':'ซื้อ','Owned':'มีอยู่','Close':'ปิด','Done':'เสร็จ','Cancel':'ยกเลิก','Confirm':'ยืนยัน','Claim':'รับ','Claimed':'รับแล้ว','Locked':'ล็อก','Visit':'เยี่ยมบ้าน','Go Home':'กลับบ้าน','Gift':'ส่งของขวัญ','Remove':'ลบ','Add':'เพิ่ม','Accept':'ตอบรับ','Decline':'ปฏิเสธ',
 'Food':'อาหาร','Toys':'ของเล่น','Furniture':'เฟอร์นิเจอร์','Rugs':'พรม','Wall':'ผนัง','Accessories':'เครื่องแต่งตัว','Styles':'ธีมห้อง','Season':'เทศกาล','Wallpaper':'วอลเปเปอร์','Floor':'พื้น','Lighting':'แสงไฟ',
 'All':'ทั้งหมด','At home':'อยู่บ้าน','Away':'ไม่อยู่บ้าน','Favorites':'ตัวโปรด','Release':'ปล่อยกลับธรรมชาติ','Rename':'เปลี่ยนชื่อ','Tricks':'ลูกเล่น','Personality':'นิสัย','Favorite food':'อาหารโปรด','Favorite toy':'ของเล่นโปรด',
 'Daily Reward':'รางวัลรายวัน','Day':'วัน','Level':'เลเวล','Breeds':'สายพันธุ์','Wins':'ชนะ','Online':'ออนไลน์','Offline':'ออฟไลน์','Profile':'โปรไฟล์','Sound':'เสียงเอฟเฟกต์','Music':'เพลงประกอบ','Volume':'ระดับเสียง','Names':'แสดงชื่อหมา','Language':'ภาษา','Weather':'สภาพอากาศ','Time of day':'ช่วงเวลา','Auto':'อัตโนมัติ','Log out':'ออกจากระบบ',
 'Sunny':'แดดจ้า','Cloudy':'มีเมฆ','Rain':'ฝนตก','Snow':'หิมะ','Morning':'เช้า','Noon':'เที่ยง','Evening':'เย็น','Night':'กลางคืน','Achievements':'ความสำเร็จ','Daily quests':'ภารกิจประจำวัน','Bonus':'โบนัส','Open':'เปิด','x10':'x10','Pity':'การันตี',
 'Memory Match':'จับคู่ความจำ','Cookie Catch':'รับขนม','Guess the Breed':'ทายสายพันธุ์','Rock Paper Scissors':'เป่ายิ้งฉุบ','Moves':'จำนวนครั้ง','Score':'คะแนน','Time':'เวลา','Start':'เริ่ม','Again':'เล่นอีกครั้ง','Reward':'รางวัล','Rock':'ค้อน','Paper':'กระดาษ','Scissors':'กรรไกร',
 'Store':'เก็บเข้ากระเป๋า','Flip':'กลับด้าน','Delete':'ลบทิ้ง','Tap again to delete':'แตะอีกครั้งเพื่อลบ','Inventory':'กระเป๋า','Drag items into your room':'ลากไอเทมไปวางในห้อง','Empty':'ว่าง','Tap a dog to care for it':'แตะที่น้องหมาเพื่อดูแล','Leaderboard':'อันดับผู้เล่น','Rank':'อันดับ','Online players':'ผู้เล่นออนไลน์',
 'Common':'ธรรมดา','Rare':'หายาก','Epic':'เอพิค','Legendary':'ตำนาน','Mythic':'มิธิก','Welcome back':'ยินดีต้อนรับกลับมา','Home':'บ้านของฉัน','Reconnecting':'กำลังเชื่อมต่อใหม่','Select all':'เลือกทั้งหมด','Selected':'เลือกแล้ว', 'Pet your dogs':'ลูบหัวน้องหมา','Feed your dogs':'ให้อาหารน้องหมา','Play with your dogs':'เล่นกับน้องหมา','Give a bath':'อาบน้ำให้น้องหมา','Brush your dogs':'หวีขนน้องหมา','Train a trick':'เทรนลูกเล่น','Open a capsule':'เปิดกาชา 1 ครั้ง','Win a Rock-Paper-Scissors match':'ชนะเป่ายิ้งฉุบ 1 ครั้ง','Play 2 mini games':'เล่นมินิเกม 2 ครั้ง',"Visit someone's house":'ไปเยี่ยมบ้านคนอื่น','Decorate: place 2 items':'ตกแต่ง: วางของ 2 ชิ้น','Send a gift to a friend':'ส่งของขวัญให้เพื่อน',
 'Dog Lover':'คนรักหมา','Own 5 dogs':'มีหมา 5 ตัว','Dog Parent':'พ่อแม่น้องหมา','Own 15 dogs':'มีหมา 15 ตัว','Dog Whisperer':'ผู้กระซิบหมา','Own 30 dogs':'มีหมา 30 ตัว','Collector':'นักสะสม','Collect 10 breeds':'สะสมครบ 10 สายพันธุ์','Breed Expert':'ผู้เชี่ยวชาญสายพันธุ์','Collect 25 breeds':'สะสมครบ 25 สายพันธุ์','Complete Collection':'สะสมครบทุกสายพันธุ์','Collect all 50 breeds':'สะสมครบ 50 สายพันธุ์',
 'Pet Master':'เซียนลูบหัว','Pet 100 times':'ลูบหัว 100 ครั้ง','Cuddle Legend':'ตำนานกอด','Pet 1000 times':'ลูบหัว 1000 ครั้ง','Master Chef':'เชฟมือทอง','Feed dogs 50 times':'ให้อาหาร 50 ครั้ง','Trainer':'ครูฝึก','Train tricks 20 times':'เทรนลูกเล่น 20 ครั้ง','Gambler':'นักพนัน','Win 5 RPS matches':'ชนะเป่ายิ้งฉุบ 5 ครั้ง','Champion':'แชมป์','Win 25 RPS matches':'ชนะเป่ายิ้งฉุบ 25 ครั้ง',
 'Capsule Fan':'แฟนกาชา','Open 10 capsules':'เปิดกาชา 10 ครั้ง','Best Friends':'เพื่อนซี้','Max bond with a dog':'Bond เต็มกับหมาสักตัว','Rich Pup':'ลูกหมาเศรษฐี','Hold 2000 coins':'มีเหรียญ 2000','Lucky!':'โชคดี!','Own a Legendary or Mythic dog':'มีหมา Legendary หรือ Mythic','Interior Designer':'นักตกแต่งภายใน','Place 15 items in your house':'วางของในบ้าน 15 ชิ้น','Social Butterfly':'ผีเสื้อสังคม','Have 3 friends':'มีเพื่อน 3 คน','Loyal Owner':'เจ้าของใจซื่อ','Reach a 7-day login streak':'ล็อกอินต่อเนื่อง 7 วัน',
 'Park':'สวนหมา','Dog Park':'สวนสาธารณะ','Community':'ชุมชน','Trade':'แลกของ','Collect 5 treats in the park':'เก็บขนมในสวน 5 ชิ้น','Visit the park':'ไปเที่ยวสวนสาธารณะ','Ball Lover':'คนรักลูกบอล','Kick the ball 50 times in the park':'เตะลูกบอลในสวน 50 ครั้ง','Treat Hunter':'นักล่าขนม','Collect 100 park treats':'เก็บขนมในสวน 100 ชิ้น','Trader':'พ่อค้า','Complete 5 trades':'แลกของสำเร็จ 5 ครั้ง',
 'Pet dogs together':'ช่วยกันลูบหัวน้องหมา','Collect park treats':'ช่วยกันเก็บขนมในสวน','Play mini games':'ช่วยกันเล่นมินิเกม','Visit & gift friends':'ช่วยกันเยี่ยมบ้าน & ส่งของขวัญ','Open capsules':'ช่วยกันเปิดกาชา','Feed dogs':'ช่วยกันให้อาหารน้องหมา','Complete trades':'ช่วยกันแลกของ'};
const t=k=>S.set.lang=='th'&&TH[k]?TH[k]:k;

// ---------------- pixel icons ----------------
const ICON={};
function mkIcon(name,w,h,fn,scale=3){const cv=document.createElement('canvas');cv.width=w+2;cv.height=h+2;const c=cv.getContext('2d'),d=ITEMART.D(c,1,1);fn(d);ITEMART.outline(cv,.4);
 const o=document.createElement('canvas');o.width=cv.width*scale;o.height=cv.height*scale;const oc=o.getContext('2d');oc.imageSmoothingEnabled=false;oc.drawImage(cv,0,0,o.width,o.height);ICON[name]=o.toDataURL();return ICON[name]}
function buildIcons(){
 mkIcon('coin',11,11,d=>{d.se(5,5,5,5,'#ffc94d');d.e(5,5,3,3,'#e8a020');d.e(5,5,2,2,'#ffd96a');d.r(5,3,1,5,'#c8841a')});
 mkIcon('gem',11,10,d=>{d.map(0,0,['..bbbbbbb..','.bBBcBBcBb.','bBBBcBBcBBb','bBBBBBBBBBb','.bBBBBBBBb.','..bBBBBBb..','...bBBBb...','....bBb....','.....b.....'],{b:'#3a9ae8',B:'#6cc6ff',c:'#c6ecff'})});
 mkIcon('ticket',13,9,d=>{d.bx(0,0,13,9,'#ff8fb0',1);d.r(4,1,1,7,'#ffd0de');d.r(6,2,5,1,'#fff');d.r(6,4,5,1,'#fff');d.r(6,6,3,1,'#fff');d.clr(0,3,1,3);d.clr(12,3,1,3)});
 mkIcon('heart',9,8,d=>d.map(0,0,['.rr...rr.','rRRr.rRRr','rRRRrRRRr','rRRRRRRRr','.rRRRRRr.','..rRRRr..','...rRr...','....r....'],{r:'#e8456f',R:'#ff7a9c'}));
 mkIcon('hearte',9,8,d=>d.map(0,0,['.rr...rr.','r..r.r..r','r...r...r','r.......r','.r.....r.','..r...r..','...r.r...','....r....'],{r:'#c8b0a8'}));
 mkIcon('paw',11,10,d=>{d.se(5,7,3,3,'#b8785a');for(const[x,y]of[[1,3],[4,1],[7,1],[10,3]])d.se(x,y,1,2,'#b8785a')});
 mkIcon('star',9,9,d=>d.map(0,0,['....y....','...yYy...','...yYy...','yyyyYyyyy','.yYYYYYy.','..yYYYy..','..yYyYy..','.yY...Yy.','.y.....y.'],{y:'#e8a020',Y:'#ffd84a'}));
 mkIcon('bone',13,7,d=>{d.se(2,2,2,2,'#f6efe0');d.se(2,5,2,2,'#f6efe0');d.se(10,2,2,2,'#f6efe0');d.se(10,5,2,2,'#f6efe0');d.r(3,2,7,4,'#f6efe0');d.r(3,5,7,1,'#d8ccb4')});
 mkIcon('lock',9,10,d=>{d.r(2,0,5,1,'#8a8a96');d.r(1,1,1,4,'#8a8a96');d.r(7,1,1,4,'#8a8a96');d.bx(0,4,9,6,'#ffc94d',1);d.r(4,6,1,2,'#6a4a1a')});
}
const ic=(n,cls='')=>`<img class="ic ${cls}" src="${ICON[n]}" alt="">`;

// ---------------- audio ----------------
const AU={ctx:null,master:null,music:null,mg:null,started:false,timer:null,step:0,next:0};
function actx(){if(!AU.ctx){try{AU.ctx=new(window.AudioContext||window.webkitAudioContext)();AU.master=AU.ctx.createGain();AU.master.connect(AU.ctx.destination);AU.sfx=AU.ctx.createGain();AU.sfx.connect(AU.master);AU.mus=AU.ctx.createGain();AU.mus.connect(AU.master);applyVol()}catch{}}if(AU.ctx&&AU.ctx.state=='suspended')AU.ctx.resume();return AU.ctx}
function applyVol(){if(!AU.ctx)return;AU.master.gain.value=S.set.vol;AU.sfx.gain.value=S.set.sound?1:0;AU.mus.gain.value=S.set.music?.55:0}
function tone(f,d=.1,type='sine',v=.12,when=0,slide=0,dest){const a=actx();if(!a||!S.set.sound&&!dest)return;const o=a.createOscillator(),g=a.createGain(),t0=a.currentTime+when;o.type=type;o.frequency.setValueAtTime(f,t0);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,f*slide),t0+d);
 g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(v,t0+.008);g.gain.exponentialRampToValueAtTime(.0008,t0+d);o.connect(g);g.connect(dest||AU.sfx);o.start(t0);o.stop(t0+d+.05)}
function noise(d=.1,v=.05,when=0,fq=3000,dest){const a=actx();if(!a)return;const n=a.sampleRate*d|0,b=a.createBuffer(1,n,a.sampleRate),ch=b.getChannelData(0);for(let i=0;i<n;i++)ch[i]=(Math.random()*2-1)*(1-i/n);const s=a.createBufferSource(),g=a.createGain(),f=a.createBiquadFilter();f.type='bandpass';f.frequency.value=fq;g.gain.value=v;s.buffer=b;s.connect(f);f.connect(g);g.connect(dest||AU.sfx);s.start(a.currentTime+when)}
const N={C4:261.6,D4:293.7,E4:329.6,F4:349.2,G4:392,A4:440,B4:493.9,C5:523.3,D5:587.3,E5:659.3,G5:784,C6:1046.5};
const SFX={click:()=>tone(620,.06,'square',.05,0,1.4),pop:()=>tone(480,.1,'sine',.14,0,2),coin:()=>{tone(988,.08,'square',.07);tone(1319,.18,'square',.07,.07)},err:()=>{tone(220,.16,'sawtooth',.07);tone(165,.2,'sawtooth',.07,.1)},
 pet:()=>{tone(700,.12,'sine',.12,0,1.6);tone(990,.14,'sine',.09,.07,1.3)},eat:()=>{for(let i=0;i<4;i++)noise(.05,.08,i*.09,900+i*80)},ok:()=>[N.C5,N.E5,N.G5].forEach((f,i)=>tone(f,.14,'triangle',.1,i*.07)),
 level:()=>[N.C5,N.E5,N.G5,N.C6].forEach((f,i)=>tone(f,.22,'triangle',.12,i*.09)),shake:()=>{for(let i=0;i<7;i++)noise(.07,.1,i*.08,500+Math.random()*900)},
 reveal:r=>{const k={C:3,R:4,E:5,L:6,M:8}[r]||3;for(let i=0;i<k;i++)tone(N.C5*Math.pow(1.122,i*1.7),.25,'triangle',.11,i*.08);if(k>=5)tone(N.C6,.6,'sine',.1,k*.08)},
 flip:()=>tone(400,.07,'square',.05,0,1.8),win:()=>[N.E5,N.G5,N.C6].forEach((f,i)=>tone(f,.18,'square',.07,i*.09)),lose:()=>[N.G4,N.E4,N.C4].forEach((f,i)=>tone(f,.2,'triangle',.1,i*.1)),
 place:()=>{tone(300,.08,'square',.08,0,.6);noise(.05,.06,0,400)},bark:()=>{tone(300,.12,'sawtooth',.08,0,.5);tone(260,.1,'sawtooth',.06,.14,.6)},open:()=>tone(540,.05,'sine',.07,0,1.3),notify:()=>{tone(880,.1,'sine',.09);tone(1175,.16,'sine',.09,.1)}};
const sfx=(n,a)=>{try{SFX[n]&&SFX[n](a)}catch{}};
// procedural lo-fi: swung drums, mellow keys, soft bass, vinyl crackle
const CH=[[48,55,59,64,67],[45,52,57,60,64],[41,48,52,57,60],[43,50,55,59,62]],mf=m=>440*Math.pow(2,(m-69)/12);
function musicStep(tm,bar,beat){const a=AU.ctx,ch=CH[bar%4],dst=AU.mus;
 const kd=()=>{const o=a.createOscillator(),g=a.createGain();o.frequency.setValueAtTime(130,tm);o.frequency.exponentialRampToValueAtTime(42,tm+.14);g.gain.setValueAtTime(.32,tm);g.gain.exponentialRampToValueAtTime(.001,tm+.2);o.connect(g);g.connect(dst);o.start(tm);o.stop(tm+.22)};
 const tick=(v,f)=>{const n=a.sampleRate*.04|0,b=a.createBuffer(1,n,a.sampleRate),c=b.getChannelData(0);for(let i=0;i<n;i++)c[i]=(Math.random()*2-1)*(1-i/n);const s=a.createBufferSource(),g=a.createGain(),fl=a.createBiquadFilter();fl.type='highpass';fl.frequency.value=f;g.gain.value=v;s.buffer=b;s.connect(fl);fl.connect(g);g.connect(dst);s.start(tm)};
 const key=(m,d,v)=>{const o=a.createOscillator(),o2=a.createOscillator(),g=a.createGain(),f=a.createBiquadFilter();o.type='triangle';o2.type='sine';o.frequency.value=mf(m);o2.frequency.value=mf(m)*2.003;f.type='lowpass';f.frequency.value=1400;g.gain.setValueAtTime(0,tm);g.gain.linearRampToValueAtTime(v,tm+.015);g.gain.exponentialRampToValueAtTime(.0008,tm+d);o.connect(f);o2.connect(f);f.connect(g);g.connect(dst);o.start(tm);o2.start(tm);o.stop(tm+d+.05);o2.stop(tm+d+.05)};
 if(beat==0||beat==5)kd();if(beat==4)tick(.18,1800);if(beat%2==0&&beat!=4)tick(.05,7000);
 if(beat==0){ch.slice(1).forEach((m,i)=>key(m+12,2.6,.045-.004*i));key(ch[0]-12,2.2,.18)}
 if(beat==6)key(ch[0]-12+7,.9,.1);
 if([2,3,5,7].includes(beat)&&Math.random()<.7){const m=ch[1+Math.floor(Math.random()*4)]+12+(Math.random()<.3?12:0);key(m,.7,.05)}
 if(Math.random()<.35){tick(.03,3500)}}
function musicTick(){const a=AU.ctx;if(!a||!S.set.music)return;const spb=60/78/2;while(AU.next<a.currentTime+.4){const sw=AU.step%2?spb*.16:0;musicStep(AU.next+sw,Math.floor(AU.step/8),AU.step%8);AU.next+=spb;AU.step++}}
function startMusic(){const a=actx();if(!a||AU.timer)return;AU.next=a.currentTime+.1;AU.timer=setInterval(musicTick,120);AU.started=true}
function stopMusic(){clearInterval(AU.timer);AU.timer=null}
const firstTouch=()=>{actx();if(S.set.music)startMusic();removeEventListener('pointerdown',firstTouch)};addEventListener('pointerdown',firstTouch);

// ---------------- network ----------------
const H={};   // message handlers: H.type=fn(msg)
let reconnectTimer=null,wantConn=false;
function wsURL(){return location.protocol=='file:'?'ws://localhost:3000':(location.protocol=='https:'?'wss://':'ws://')+location.host}
function send(o){if(S.ws&&S.ws.readyState==1)S.ws.send(JSON.stringify(o))}
function connect(first){return new Promise((res,rej)=>{let ws;try{ws=new WebSocket(wsURL())}catch(e){return rej(e)}S.ws=ws;
 ws.onopen=()=>{wantConn=true;res(ws)};ws.onerror=()=>rej(new Error('ws'));
 ws.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch{return}const f=H[m.t];if(f)f(m);else if(window.DEBUG)console.log('unhandled',m.t)};
 ws.onclose=()=>{if(S.ws!==ws)return;if(S.loaded&&wantConn)onDisconnect()}})}
function onDisconnect(){try{MP.abort()}catch{}showBanner(t('Reconnecting')+'…',true);clearTimeout(reconnectTimer);let n=0;const tryIt=async()=>{try{await connect();S.pendingResume=true;if(S.token)send({t:'resume',token:S.token});else send({t:'guest'});hideBanner()}catch{reconnectTimer=setTimeout(tryIt,Math.min(8000,1500+n++*700))}};reconnectTimer=setTimeout(tryIt,1200)}
