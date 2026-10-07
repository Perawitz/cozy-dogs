// Cozy Dogs v7.2 - the Menu: ONE window that lists every feature of the game in groups, so nothing is hidden at the end of a long row.
// The bottom dock keeps only the 6 buttons people use all the time + a "Menu" button (☰).  Every button in the window runs the same DO.<name>
// the old dock button ran (DO.shop, DO.show, DO.announce ...), so no feature had to change.  Features that came with v7 wear a "NEW" tag until the
// player opens them for the first time (remembered in the browser, per player name).
// Window id: 'menu'.  DO.menu (open) · DO.mn {k} (a tile).  UI.bd() = the red number badges (shared by the dock and the window).
(function(){
const GROUPS=[
 {e:'🐶',t:['My dogs','หมาของฉัน'],c:'#ffd0de',it:[
  ['dogs','🐶','Dogs','See and look after your dogs','ดูและดูแลน้องหมาของคุณ'],
  ['nursery','🧬','Nursery','Breed two dogs for cute new traits','ผสมพันธุ์ให้ได้ลูกหมาลักษณะใหม่'],
  ['wardrobe','👕','Outfit','Dress up your character','แต่งตัวให้ตัวละคร'],
  ['coll','📖','Collection','Your breed collection book','สมุดสะสมสายพันธุ์']]},
 {e:'🌍',t:['Community','ชุมชน'],c:'#d6ecff',it:[
  ['show','👑','Dog Show','Every hour: enter, vote, win prizes','ประกวดทุกชั่วโมง ส่งหมา โหวต ลุ้นรางวัล'],
  ['announce','📣','Announce','Show a message on everyone\'s screen','ประกาศข้อความให้ทุกคนเห็น'],
  ['friends','👥','Friends','Friends and requests','เพื่อนและคำขอเป็นเพื่อน'],
  ['dm','💌','Private chat','Chat privately with friends','แชทส่วนตัวกับเพื่อน'],
  ['park','🌳','Park','Meet players, talk with your mic 🎙️','พบเพื่อน คุยด้วยไมค์ 🎙️'],
  ['ranks','🏆','Ranks','Leaderboards','อันดับผู้เล่น'],
  ['community','🌍','Community','The goal everyone builds together','เป้าหมายที่ทุกคนช่วยกัน']]},
 {e:'🛍️',t:['Shops','ร้านค้า'],c:'#fff3c4',it:[
  ['shop','🛍️','Shop','Goodies for your dogs and home','ของน่ารักสำหรับน้องหมาและบ้าน'],
  ['capsule','🥚','Egg Gacha','Crack an egg - which dog is inside?','สุ่มไข่ ข้างในจะเป็นหมาอะไรนะ?'],
  ['petshop','🐾','Pet Shop','Buy and sell dogs, premium breeds 💎','ซื้อ-ขายหมา มีสายพันธุ์พรีเมียม 💎']]},
 {e:'🏡',t:['Home & fun','บ้านและความสนุก'],c:'#d8f5e6',it:[
  ['house','🏡','House','Level up, party, who may visit','อัปเกรดบ้าน ปาร์ตี้ ตั้งว่าใครเข้าได้'],
  ['decor','🛋️','Decorate','Move the furniture in your room','จัดเฟอร์นิเจอร์ในห้อง'],
  ['games','🎮','Games','Mini-games and online battles','มินิเกมและเกมออนไลน์'],
  ['quests','📜','Quests','Daily quests and achievements','ภารกิจประจำวันและความสำเร็จ'],
  ['mail','✉️','Mail','Gifts and letters','ของขวัญและจดหมาย'],
  ['photo','📷','Photo','Save a picture of your room','บันทึกรูปห้องของคุณ'],
  ['settings','⚙️','Settings','Sound, language, display','เสียง ภาษา การแสดงผล']]}];
const NEWK=['nursery','show','announce','dm','petshop','capsule'];       // the features v7 brought
const HIDE_ON_DOCK=['quests','friends','games','park','dogs','shop'];     // their own number is already on a dock button
Object.assign(TH,{'Menu':'เมนู','My dogs':'หมาของฉัน','Shops':'ร้านค้า','Home & fun':'บ้านและความสนุก','NEW':'ใหม่'});

// ---- which tiles has this player already opened?  (browser memory; if it is unavailable every NEW tag simply stays)
const key=()=>'cd_seen_'+(S.name||'');
const seenList=()=>{const a=LS.get(key(),[]);return Array.isArray(a)?a:[]};
const isNew=k=>NEWK.includes(k)&&!seenList().includes(k);
function mark(k){if(!isNew(k))return;LS.set(key(),[...seenList(),k])}
const newCount=()=>NEWK.filter(isNew).length;

// ---- the red numbers
UI.bd=function(){const m=S.me||{},fr=S.fr&&S.fr.inReq?S.fr.inReq.length:0;
 return{nursery:m.eggs|0,show:m.shBadge|0,quests:(m.ready||0)+(m.stReady||0),friends:fr,dm:m.dm|0,community:typeof goalReady=='function'?goalReady():0,games:m.spinFree?1:0,mail:m.mail|0}};
// what the ☰ button shows: the numbers of everything that has no button of its own on the dock; else "NEW" while something new is unopened
UI.menuBadge=function(){const b=UI.bd();let n=0;for(const k of Object.keys(b))if(!HIDE_ON_DOCK.includes(k))n+=b[k];return n?{txt:String(n>99?'99+':n),cls:''}:newCount()?{txt:t('NEW'),cls:' nw'}:null};

// ---- the window
function tile(g,x,b){const[k,e,l,he,ht]=x,n=b[k]|0,nw=isNew(k);
 return`<button class="mn-t${nw?' isnew':''}" data-do="mn" data-k="${k}"><span class="mn-e">${e}</span><span class="mn-x"><b>${esc(t(l))}</b><small>${esc(TT(he,ht))}</small></span>${n?`<span class="bd">${n>99?'99+':n}</span>`:''}${nw?`<i class="mn-nw">${esc(t('NEW'))}</i>`:''}</button>`}
const sigOf=()=>JSON.stringify([UI.bd(),NEWK.filter(isNew)]);
// the dock refreshes often (every "me" push): redraw an open Menu only when a number or a NEW tag really changed, so a tap is never lost to a redraw
function refresh(){const o=modOpen('menu');if(o&&o.dataset.sig!==sigOf())render()}
function render(){const b=UI.bd();
 const body=GROUPS.map(g=>`<section class="mn-g" style="--mc:${g.c}"><h4><span>${g.e}</span>${esc(TT(g.t[0],g.t[1]))}</h4><div class="mn-grid">${g.it.map(x=>tile(g,x,b)).join('')}</div></section>`).join('');
 const foot=`<div class="mn-ft"><button class="btn sm" data-do="wn">✨ ${esc(TT('What\'s new','มีอะไรใหม่'))}</button><button class="btn sm ghost" data-do="starter">🌱 ${esc(TT('Starter missions','ภารกิจมือใหม่'))}</button></div>`;
 const o=modal('menu','☰ '+TT('Menu','เมนู'),body+foot,'mnmod');o.dataset.sig=sigOf()}
DO.menu=()=>render();
DO.mn=d=>{const k=d&&d.k;if(typeof k!='string'||!Object.prototype.hasOwnProperty.call(DO,k)||k=='mn'||k=='menu')return;
 mark(k);closeMod('menu');UI.dock();DO[k]({})};
// ---- "What's new": a one-time tour for players who were here before v7 (new players learn the same things in the tutorial)
const WNL=[
 ['capsule','🥚','The Egg Gacha gives EGGS','สุ่มไข่แล้ว!','Crack an egg, wait for it to hatch (or speed it up with 💎).','ได้ไข่มาแล้วรอฟัก (หรือใช้ 💎 เร่ง) ว่าที่หมาตัวใหม่'],
 ['nursery','🧬','Breed two dogs','ผสมพันธุ์หมา','Get purebred or mixed pups with cute new traits ✨','ได้ลูกพันธุ์แท้/พันทาง และลักษณะพิเศษน่ารัก ✨'],
 ['dogs','🍼','Dogs grow up','หมาโตตามวัย','Baby → puppy → teen → adult.','เบบี๋ → ลูกหมา → วัยรุ่น → โตเต็มวัย'],
 ['show','👑','Hourly Dog Show','ประกวดหมาทุกชั่วโมง','Everyone votes - win prizes and a crown.','ทุกคนช่วยโหวต ลุ้นรางวัลและมงกุฎ'],
 ['petshop','🐾','Pet Shop','ร้านหมา','Buy and sell dogs. Premium breeds cost 💎.','ซื้อ-ขายหมา มีสายพันธุ์พรีเมียมสุดน่ารักใช้ 💎'],
 ['dm','💌','Private chat','แชทส่วนตัว','Talk to friends privately, or make a group room.','คุยกับเพื่อนแบบส่วนตัว สร้างห้องกลุ่มได้'],
 ['announce','📣','Announcements','ประกาศถึงทุกคน','Pay 💎 to show a message on everyone\'s screen.','ใช้ 💎 ประกาศข้อความให้ทุกคนเห็นบนหน้าจอ'],
 ['house','🔒','House privacy','ปิดบ้านได้','Choose who may visit: everyone / friends / nobody.','ตั้งว่าใครเข้าบ้านได้: ทุกคน / เฉพาะเพื่อน / ปิดบ้าน'],
 ['starter','🌱','Explorer missions','ภารกิจสำรวจ','Try the new things once and get free 💎.','ลองของใหม่ครั้งแรกรับ 💎 ฟรี (ดูที่ภารกิจมือใหม่)']];
function wnHTML(){return`<div class="muted" style="margin-bottom:8px">${esc(TT('Lots of new things arrived! Tap "Go" to try one - everything lives in the ☰ Menu.','มีของใหม่เพียบ! กด "ไปดู" เพื่อลองได้เลย ทุกอย่างอยู่ที่ปุ่ม ☰ เมนู'))}</div><div class="wn-l">`
 +WNL.map(([k,e,et,tt,ed,td])=>`<div class="wn-r"><span class="wn-e">${e}</span><div class="wn-x"><b>${esc(TT(et,tt))}</b><small>${esc(TT(ed,td))}</small></div><button class="btn sm mint" data-do="wngo" data-k="${k}">${esc(TT('Go','ไปดู'))}</button></div>`).join('')
 +`</div><div class="center" style="margin-top:10px"><button class="btn" data-do="wnok">👍 ${esc(TT('Got it!','เข้าใจแล้ว!'))}</button></div>`}
DO.wn=()=>modal('wn','✨ '+TT('What\'s new','มีอะไรใหม่'),wnHTML(),'sm wnmod');
DO.wngo=d=>{const k=d&&d.k;if(!WNL.some(x=>x[0]==k))return;closeMod('wn');DO.mn({k})};
DO.wnok=()=>closeMod('wn');
let wnShown=false;
setInterval(()=>{try{if(wnShown||S.scr!='game'||!S.loaded||!S.me||!S.me.tut||(S.me.wn|0)>=72||S.tutOn)return;
  if(S.owner!=S.name||Park.on||(typeof MP!='undefined'&&MP.g)||S.edit||$('#mods .ov'))return;
  wnShown=true;S.me.wn=72;send({t:'whatsnew'});DO.wn()}catch(e){}},2500);
window.MN={render,refresh,isNew,mark,newCount,NEWK,GROUPS,WNL};
})();
