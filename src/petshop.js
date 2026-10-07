// Cozy Dogs v7 - PET SHOP + PLAYER MARKET: one window (id "petshop"), three tabs.   Server side: pets.js (pet_shop / pet_buy / pet_sell, mk_get / mk_put / mk_buy / mk_cancel)
//   Shop   : "premium shelf" (11 very cute / very rare breeds, bought with coins OR gems, small daily stock, per-player daily cap) + today's 5 offers of ordinary breeds
//   Market : players sell dogs to each other (escrow, fee, 48 h) - browse / buy / cancel / list-a-dog form
//   Sell   : sell one of my dogs to the shop for coins (the price shown is the same formula the server uses: TRD.sellValue)
// DO: petshop pstab psbuy psplay psretry mkfilt mksort mkbuy mkcancel mklist mkpick mkcur mkq mkgo dogsell psnewdogs      H: pet_shop pet_stock pet_bought pet_sold mk
// The profile window calls DO.dogsell / DO.mklist with data-id = the dog id.
;(function(){
'use strict';
const PS={tab:'shop',shop:null,mk:null,filt:'all',sort:'cheap',fetchAt:0,stuck:0,sig:'',pend:0,ml:null,putPend:null,sellId:null,buy:null,n:0,io:null,raf:0,last:0};
const th=()=>S.set.lang=='th';
const num=v=>{v=Math.round(+v);return Number.isFinite(v)?v:0};
const nf=v=>num(v).toLocaleString('en-US');
const V7=()=>S.v7||{};
const NOW=()=>Date.now()+(S.skew||0);
const stageOf=d=>TRD.stageOf(d.born,NOW(),S.gk||1);
const RANK={C:0,R:1,E:2,L:3,M:4};
const PS_TZ=7;                                                      // the game day (and the shop restock) starts at midnight in Thailand, see server.js TZH

// ---- Thai names + little blurbs for the 11 premium breeds (the dictionary gives Thai names to dogs everywhere in the game)
const PNAME={'Mochi Pup':'โมจิพัพ','Teddy Pom':'เท็ดดี้ปอม','Bunny Corgi':'บันนี่คอร์กี้','Panda Pup':'แพนด้าพัพ','Sakura Shiba':'ซากุระชิบะ','Cotton Candy Poodle':'พุดเดิ้ลสายไหม','Strawberry Dalmatian':'ดัลเมเชียนสตรอว์เบอร์รี่','Honey Bee Pup':'ฮันนี่บีพัพ','Angel Retriever':'เรทรีฟเวอร์นางฟ้า','Unicorn Pup':'ยูนิคอร์นพัพ','Dragon Pup':'ดราก้อนพัพ'};
Object.assign(TH,PNAME);
const BLURB={
 mochipup:['Squishy as a rice cake and just as sweet.','นุ่มนิ่มเหมือนโมจิ กอดทีไรใจละลาย'],
 teddypom:['A fluffy little teddy bear who forgot to be a toy.','ตุ๊กตาหมีตัวจิ๋วที่ลืมไปว่าตัวเองมีชีวิต ขนฟูสุดๆ'],
 bunnycorgi:['Corgi bottom, bunny ears, double the hops.','ก้นกลมแบบคอร์กี้ หูยาวแบบกระต่าย กระโดดตุ๊บๆ'],
 pandapup:['Black, white and endlessly cuddly.','ขาวดำน่ากอด ชอบนอนกลิ้งทั้งวัน'],
 sakurashiba:['Blushes pink like cherry blossoms in spring.','ชมพูละมุนเหมือนซากุระบานในฤดูใบไม้ผลิ'],
 cottonpoodle:['Fluffy pink and blue, like spun sugar.','ขนปุกปุยสีชมพูฟ้า เหมือนสายไหมก้อนโต'],
 berrydal:['Spots like tiny strawberry seeds.','จุดเล็กๆ เหมือนเมล็ดสตรอว์เบอร์รี่'],
 honeybeepup:['Buzzing with stripes and sweetness.','ลายแถบน่ารัก หวานเหมือนน้ำผึ้ง'],
 angelretriever:['A golden glow and a heart to match.','ประกายทองอุ่นๆ ใจดีเหมือนนางฟ้า'],
 unicornpup:['A rainbow-maned dream with one magic horn.','ฝันสายรุ้งที่มีเขาวิเศษหนึ่งเขา'],
 dragonpup:['Tiny scales, tiny flames, huge courage.','เกล็ดจิ๋ว ไฟจิ๋ว แต่ใจกล้าสุดๆ']};
const VAR={Normal:['Normal','ปกติ','🐶'],Snow:['Snow','หิมะ','❄️'],Chocolate:['Chocolate','ช็อกโกแลต','🍫'],Golden:['Golden','ทองคำ','✨'],Galaxy:['Galaxy','กาแล็กซี','🌌'],Rainbow:['Rainbow','สายรุ้ง','🌈']};
const varName=v=>{const x=VAR[v]||VAR.Normal;return TT(x[0],x[1])};

// ---- small pieces of markup
const anim=(key,v,acc,w,h,cls)=>`<canvas class="psan ${cls||''}" data-an="${esc(key)}|${esc(v||'Normal')}|${esc(acc||'')}" width="${w||220}" height="${h||184}"></canvas>`;
const priceHTML=(cur,n)=>`${ic(cur=='g'?'gem':'coin','sm')} ${nf(n)}`;
const stageChip=d=>{const i=stageOf(d),s=TRD.STAGES[i]||TRD.STAGES[3];return`<span class="psch st${i}">${s.e} ${esc(TT(s.en,s.th))}</span>`};
const traitChips=d=>TRD.cleanTraits(d.tr).map(id=>{const x=TRD.TR[id];return`<span class="psch tr t${x.tier}" title="${esc(TT(x.den,x.dth))}">${x.e} ${esc(TT(x.en,x.th))}</span>`}).join('');
const mixChip=d=>TRD.isMixed(d)?`<span class="psch mx">🧬 ${TT('Mixed','พันทาง')}</span>`:'';
const varChip=d=>d.variant&&d.variant!='Normal'?`<span class="psch vr">${(VAR[d.variant]||VAR.Normal)[2]} ${esc(varName(d.variant))}</span>`:'';
const hearts=b=>{const n=Math.min(10,Math.floor((b|0)/10));return`<span class="psbond" title="${TT('Bond','ความผูกพัน')}">${n?Array.from({length:n},()=>ic('heart','sm')).join(''):ic('hearte','sm')}<small>${n}/10</small></span>`};
const dogChips=d=>stageChip(d)+mixChip(d)+varChip(d)+traitChips(d);
const enName=id=>{const r=((S.welcome&&S.welcome.breeds)||EMBED.breeds).find(x=>x[0]==id);return r?r[1]:String(id)};
const dur=ms=>{const m=Math.max(0,Math.ceil(ms/6e4)),h=Math.floor(m/60);return h>0?`${h} ${TT('h','ชม.')} ${m%60} ${TT('min','น.')}`:`${m} ${TT('min','น.')}`};
const durS=ms=>{if(ms<=0)return TT('Expired','หมดเวลา');if(ms>=36e5)return dur(ms);const s=Math.ceil(ms/1e3);return`${Math.floor(s/60)} ${TT('min','น.')} ${s%60} ${TT('sec','วิ')}`};
const restockMs=()=>{const n=NOW();return(Math.floor((n+PS_TZ*36e5)/864e5)+1)*864e5-PS_TZ*36e5-n};
const dogOf=id=>(S.allDogs||[]).find(x=>x.id==id)||S.dogs[id]||null;
const maxDogs=()=>V7().maxDogs||100;
const fullWhy=()=>(S.me.total|0)>=maxDogs()?TT(`Dog storage is full (${maxDogs()})`,`ที่เก็บน้องหมาเต็มแล้ว (${maxDogs()} ตัว)`):'';
const payWhy=(cur,n)=>{const have=cur=='g'?S.me.gems:S.me.coins;if(have>=n)return'';const miss=nf(n-have);return cur=='g'?TT(`Not enough gems · need ${miss} more`,`เพชรไม่พอ · ขาดอีก ${miss}`):TT(`Not enough coins · need ${miss} more`,`ทองไม่พอ · ขาดอีก ${miss}`)};
const loadingHTML=(msg)=>{const stuck=PS.stuck;return`<div class="psload"><div class="pspaw">🐾</div><div>${esc(msg||TT('Loading…','กำลังโหลด…'))}</div>${stuck?`<button class="btn sm sky" data-do="psretry">🔄 ${TT('Try again','ลองใหม่'    )}</button>`:''}</div>`};
// one request at a time (a double tap must never buy twice)
function psSend(m){if(PS.pend&&Date.now()-PS.pend<2500)return false;if(!send(m)){toast(TT('Not connected yet — try again in a moment','ยังไม่ได้เชื่อมต่อ — ลองใหม่อีกครั้งนะ'));return false}PS.pend=Date.now();return true}

// =====================================================================  the window
function psFetch(){PS.fetchAt=Date.now();PS.stuck=0;if(PS.tab=='shop')send({t:'pet_shop'});else if(PS.tab=='mk')send({t:'mk_get'});else send({t:'dogs_get'})}
DO.petshop=()=>{PS.sig='';PS.n=0;psFetch();psBuild()};
DO.pstab=d=>{if(!['shop','mk','sell'].includes(d.k))return;PS.tab=d.k;psFetch();psBuild()};
DO.psretry=()=>{psFetch();psBuild()};
const nfc=v=>{v=num(v);return v>=1e6?(v/1e6).toFixed(1)+'M':v>=1e5?Math.round(v/1e3)+'k':nf(v)};
function psHead(){const tabs=[['shop','🐾',TT('Shop','ร้านค้า')],['mk','🏷️',TT('Market','ตลาด')],['sell','💰',TT('Sell','ขายหมา')]];
 return`<div class="pshd"><div class="tabs2">${tabs.map(([k,e,l])=>`<button class="${PS.tab==k?'on':''}" data-do="pstab" data-k="${k}">${e} ${l}</button>`).join('')}</div></div>`}
const psTitle=()=>`<span class="pstt">🐾 ${TT('Pet Shop','ร้านน้องหมา')}</span><span class="pswal"><span class="psw" title="${TT('Coins','ทอง')}: ${nf(S.me.coins)}">${ic('coin')}<b>${nfc(S.me.coins)}</b></span><span class="psw" title="${TT('Gems','เพชร')}: ${nf(S.me.gems)}">${ic('gem')}<b>${nfc(S.me.gems)}</b></span></span>`;
function psBuild(){const body={shop:psShopHTML,mk:psMarketHTML,sell:psSellHTML}[PS.tab]();
 const ov=modal('petshop',psTitle(),psHead()+'<div class="psbody">'+body+'</div>','lg ps');PS.sig=psSig();psPaint(ov);return ov}
const psRender=()=>{if(modOpen('petshop'))psBuild()};
function dogsSig(){return(S.allDogs||[]).map(d=>[d.id,d.breed,d.mix,d.variant,(d.tr||[]).join(),d.bond,d.fav?1:0,d.away?1:0,d.name,d.acc,stageOf(d),d.cr].join(':')).join('|')}
function psSig(){const m=S.me,base=[PS.tab,S.set.lang,m.coins,m.gems,m.lvl,m.total,S.guest?1:0,S.owner==S.name?1:0,PS.stuck].join(',');
 if(PS.tab=='shop')return base+JSON.stringify(PS.shop);
 if(PS.tab=='mk')return base+PS.filt+PS.sort+(PS.mk?JSON.stringify(PS.mk.list.map(e=>[e.id,e.c,e.g,e.mine?1:0,e.d.name,stageOf(e.d)])):'-');
 return base+dogsSig()+(S.allDogs?1:0)}
// re-render only when something visible changed (no flicker every refresh); scroll position is kept by modal()
function psSoft(){if(modOpen('petshop')&&psSig()!==PS.sig)psBuild()}
{const prev=UI.cur;UI.cur=function(){prev.apply(this,arguments);psSoft();if(modOpen('mklist'))psMlSoft()}}      // my coins / gems / level changed
{const prev=H.dogs_all;H['dogs_all']=m=>{if(prev)prev(m);if(PS.tab=='sell')psSoft();if(modOpen('mklist')&&!PS.putPend&&!psTyping())psMlRender()}}      // chained: the main handler refreshes the dog list, then we re-draw

// =====================================================================  animated + static dog art
const PXC=()=>DOGPIX.PX;
function psDraw(c,t){let a=c._a;if(!a){const[k,v,acc]=c.dataset.an.split('|');let h=0;for(const ch of k)h=(h*31+ch.charCodeAt(0))>>>0;a=c._a={k,v:v||'Normal',acc:acc||null,seed:h%9}}
 const b=DOGS.BR[a.k];if(!b)return;const g=c.getContext('2d'),W=c.width,H_=c.height;
 if(!a.s){const bb=DOGS.frame(b,a.v,'stand',0,a.acc).bb,bw=bb.x1-bb.x0,bh=bb.y1-bb.y0;let s=Math.min(W*.7/bw,H_*.64/bh);if(s>=2)s=Math.floor(s);a.s=s;a.tx=W/2-((bb.x0+bb.x1)/2-DOGPIX.GX)*s;a.ty=H_*.84-(bb.y1-DOGPIX.GY-1)*s;a.bw=bw*s}
 const hap=c._hov||c._hap>performance.now();g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,W,H_);
 g.fillStyle='rgba(70,45,35,.17)';g.beginPath();g.ellipse(W/2,H_*.84+3,a.bw*.42,H_*.03,0,0,7);g.fill();
 g.save();g.translate(a.tx,a.ty);const k=a.s/PXC();g.scale(k,k);DOGS.sprite(g,b,a.v,t+a.seed*.7,{state:'IDLE',seed:a.seed,pet:hap?1:0,noAura:1,acc:a.acc,happy:true});g.restore()}
function psLoop(ts){PS.raf=0;const cs=$$('#mods canvas[data-an]');if(!cs.length)return;
 if(!document.hidden&&ts-PS.last>=33){PS.last=ts;for(const c of cs)if(c._vis!==false)psDraw(c,ts/1e3)}
 PS.raf=requestAnimationFrame(psLoop)}
const REDUCED=()=>{try{return matchMedia('(prefers-reduced-motion:reduce)').matches}catch{return false}};
function psPaint(root){paintThumbs(root);const all=$$('#mods canvas[data-an]');if(!all.length)return;
 if(window.IntersectionObserver){if(!PS.io)PS.io=new IntersectionObserver(es=>{for(const e of es)e.target._vis=e.isIntersecting},{threshold:0});PS.io.disconnect();for(const c of all){c._vis=true;PS.io.observe(c)}}
 const t=performance.now()/1e3;for(const c of all)try{psDraw(c,t)}catch(e){}
 if(!PS.raf&&!REDUCED())PS.raf=requestAnimationFrame(psLoop)}
document.addEventListener('mouseover',e=>{const c=e.target.closest&&e.target.closest('.psc,.psnew');if(c)for(const x of $$('canvas[data-an]',c))x._hov=true});
document.addEventListener('mouseout',e=>{const c=e.target.closest&&e.target.closest('.psc,.psnew');if(c&&!c.contains(e.relatedTarget))for(const x of $$('canvas[data-an]',c))x._hov=false});
DO.psplay=(d,el)=>{const c=$('canvas[data-an]',el);if(c){c._hap=performance.now()+1500;sfx('pop')}};

// =====================================================================  SHOP tab
function psBuyBtn(act,why,label){return`<button class="btn ${why?'psno':act.cls}" ${why?'aria-disabled="true"':''} data-do="psbuy" data-k="${act.k}" ${act.k=='p'?`data-id="${act.id}"`:`data-i="${act.i}"`}>${label}</button>${why?`<div class="psc-why">${esc(why)}</div>`:'<div class="psc-why"></div>'}`}
function premCard(p){const b=DOGS.BR[p.id];if(!b)return'';const gem=p.g>0,cur=gem?'g':'c',n=gem?p.g:p.c,s=PS.shop,capHit=s.bought>=s.cap,sold=p.left<=0;
 const why=sold?TT('Sold out · restocks at midnight','ขายหมดแล้ว · เติมของเที่ยงคืน'):capHit?TT(`You bought ${s.cap} today · come back tomorrow`,`วันนี้ซื้อครบ ${s.cap} ตัวแล้ว · พรุ่งนี้มาใหม่นะ`):fullWhy()||payWhy(cur,n);
 const pips=Array.from({length:p.max},(_,i)=>`<i class="${i<p.left?'on':''}"></i>`).join('');
 const nm=`<div class="psc-nm">${esc(b.name)}</div><div class="psc-en">${th()?esc(enName(p.id)):'&nbsp;'}</div>`;
 const bl=BLURB[p.id];
 return`<div class="psc r-${b.r} ${gem?'gem':'coin'} ${sold?'sold':''}">
  <div class="psc-top"><span class="psc-cur ${gem?'g':'c'}">${gem?'💎 '+TT('Gems','เพชร'):'💰 '+TT('Coins','ทอง')}</span>${rarTag(b.r)}</div>
  <div class="psc-art" data-do="psplay">${anim(p.id,'Normal',null)}${sold?`<div class="psc-sold">${TT('SOLD OUT','ขายหมดแล้ว')}</div>`:''}</div>
  ${nm}<div class="psc-bl">${bl?esc(TT(bl[0],bl[1])):''}</div>
  <div class="psc-st ${p.left==1?'low':''}"><span class="pips">${pips}</span><span>${sold?TT('0 left','หมดแล้ว'):p.left==1?TT('Only 1 left!','เหลือแค่ 1 ตัว!'):TT(`${p.left}/${p.max} left`,`เหลือ ${p.left}/${p.max}`)}</span></div>
  <div class="psc-pr">${priceHTML(cur,n)}</div>
  ${psBuyBtn({k:'p',id:p.id,cls:gem?'sky':'pink'},why,sold?TT('Sold out','ขายหมดแล้ว'):'🛒 '+TT('Buy','ซื้อ'))}</div>`}
function offerCard(o){const b=DOGS.BR[o.id];if(!b)return'';const s=PS.shop,capHit=s.bought>=s.cap,sold=o.left<=0;
 const why=sold?TT('Sold out','ขายหมดแล้ว'):capHit?TT(`You bought ${s.cap} today · come back tomorrow`,`วันนี้ซื้อครบ ${s.cap} ตัวแล้ว · พรุ่งนี้มาใหม่นะ`):fullWhy()||payWhy('c',o.c);
 const v=VAR[o.v]||VAR.Normal;
 return`<div class="psc offer r-${b.r} coin ${sold?'sold':''}">
  <div class="psc-top">${o.v!='Normal'?`<span class="psch vr">${v[2]} ${esc(varName(o.v))}</span>`:'<span></span>'}${rarTag(b.r)}</div>
  <div class="psc-art" data-do="psplay">${anim(o.id,o.v,null)}${sold?`<div class="psc-sold">${TT('SOLD OUT','ขายหมดแล้ว')}</div>`:''}</div>
  <div class="psc-nm">${esc(b.name)}</div>
  <div class="psc-st ${o.left==1?'low':''}"><span class="pips">${Array.from({length:Math.max(o.left,1)},(_,i)=>`<i class="${i<o.left?'on':''}"></i>`).join('')}</span><span>${sold?TT('0 left','หมดแล้ว'):TT(`${o.left} left`,`เหลือ ${o.left} ตัว`)}</span></div>
  <div class="psc-pr">${priceHTML('c',o.c)}</div>
  ${psBuyBtn({k:'d',i:o.i,cls:'mint'},why,sold?TT('Sold out','ขายหมดแล้ว'):'🛒 '+TT('Buy','ซื้อ'))}</div>`}
function psShopHTML(){const s=PS.shop;if(!s)return loadingHTML();
 const capHit=s.bought>=s.cap,coin=s.prem.filter(p=>p.c>0).sort((a,b)=>a.c-b.c),gem=s.prem.filter(p=>p.g>0).sort((a,b)=>a.g-b.g);
 return`<div class="psban"><i class="psb-sp a">✨</i><i class="psb-sp b">💖</i><i class="psb-sp c">⭐</i>
  <div class="psb-t">✨ ${TT('Premium Shelf','ชั้นพรีเมียม')} <small>${TT('very cute · very rare','น่ารักสุดๆ · หายากสุดๆ')}</small></div>
  <div class="psb-s">${TT("These special breeds can't be found in eggs and can't be bred — they're sold only here! A few arrive every day.",'สายพันธุ์พิเศษเหล่านี้ไม่มีในไข่กาชา และผสมพันธุ์ไม่ได้ — มีขายที่นี่ที่เดียว! มาใหม่ทุกวันแต่จำนวนน้อยนะ')}</div>
  <div class="psb-m"><span class="pill">🔄 ${TT('New stock at midnight','ของใหม่เที่ยงคืน')} · <span data-restock>${dur(restockMs())}</span></span><span class="pill ${capHit?'warn':''}">🛒 ${TT('Bought today','ซื้อวันนี้แล้ว')} ${s.bought}/${s.cap}</span></div></div>
 <div class="psh">💰 ${TT('Buy with Coins','ซื้อด้วยทอง')} <small>${TT('the coins you earn while playing','เหรียญที่หาได้จากการเล่น')}</small></div>
 <div class="psg">${coin.map(premCard).join('')}</div>
 <div class="psh">💎 ${TT('Buy with Gems','ซื้อด้วยเพชร')} <small>${TT('super rare · gems only','หายากสุดๆ · ใช้เพชรเท่านั้น')}</small></div>
 <div class="psg">${gem.map(premCard).join('')}</div>
 <div class="psh">🌟 ${TT("Today's Offers",'ข้อเสนอวันนี้')} <small>${TT('5 new dogs every day · coins','น้องหมาใหม่ 5 ตัวทุกวัน · จ่ายด้วยทอง')}</small></div>
 <div class="psg offers">${s.offers.map(offerCard).join('')}</div>
 <div class="psfoot">💡 ${TT(`You can buy up to ${s.cap} dogs from the shop each day. Dogs you buy arrive as babies.`,`ซื้อน้องหมาจากร้านได้วันละ ${s.cap} ตัวนะ · น้องหมาที่ซื้อจะมาเป็นเบบี๋ตัวน้อย`)}</div>`}
// ---- buy flow
const askArt=(key,v,acc)=>`<span class="psask">${anim(key,v,acc,200,150)}`;
function psAsk(o){      // o: {title,html,yes,cls,go}
 ask(o.html,o.go,{title:o.title,yes:o.yes,cls:o.cls});const ov=modOpen('ask');if(ov)psPaint(ov)}
DO.psbuy=d=>{const s=PS.shop;if(!s)return;let id,v='Normal',cur,n,left,prem=d.k=='p',msg;
 if(prem){const p=s.prem.find(x=>x.id==d.id);if(!p)return;id=p.id;cur=p.g>0?'g':'c';n=p.g>0?p.g:p.c;left=p.left}
 else{const o=s.offers.find(x=>x.i==+d.i);if(!o)return;id=o.id;v=o.v;cur='c';n=o.c;left=o.left}
 const b=DOGS.BR[id];if(!b)return;
 const why=left<=0?TT('Sold out','ขายหมดแล้ว'):s.bought>=s.cap?TT(`You bought ${s.cap} today · come back tomorrow`,`วันนี้ซื้อครบ ${s.cap} ตัวแล้ว · พรุ่งนี้มาใหม่นะ`):fullWhy()||payWhy(cur,n);
 if(why){toast('🚫 '+why);sfx('err');return}
 const have=cur=='g'?S.me.gems:S.me.coins,nm=esc(b.name),vr=v!='Normal'?` (${esc(varName(v))})`:'';
 psAsk({title:'🐾 '+TT('Buy this dog?','ซื้อน้องหมาตัวนี้?'),yes:'🛒 '+TT('Buy','ซื้อเลย'),cls:cur=='g'?'sky':'pink',
  html:`${askArt(id,v,null)}<b class="psask-n">${nm}${vr}</b></span><span class="psask-l">${TT('Price','ราคา')}: <b>${priceHTML(cur,n)}</b></span><span class="psask-s">${TT('You have','คุณมี')} ${priceHTML(cur,have)} → ${TT('left','เหลือ')} ${priceHTML(cur,have-n)}</span>${prem?`<span class="psask-s">✨ ${TT("A special breed: can't be bred or found in eggs.",'สายพันธุ์พิเศษ: ผสมพันธุ์ไม่ได้ และไม่มีในไข่กาชา')}</span>`:''}`,
  go:()=>{PS.buy={id,shop:1};psSend(prem?{t:'pet_buy',k:'p',id}:{t:'pet_buy',k:'d',i:+d.i})}})};
H.pet_shop=m=>{PS.pend=0;PS.shop=m;PS.stuck=0;psSoft()};
H.pet_stock=m=>{const s=PS.shop;if(!s)return;let ch=false;
 if(m.prem&&typeof m.prem=='object')for(const p of s.prem){const l=m.prem[p.id];if(Number.isFinite(l)&&l!=p.left){p.left=l;ch=true}}
 if(Array.isArray(m.offers))for(const o of s.offers){const l=m.offers[o.i];if(Number.isFinite(l)&&l!=o.left){o.left=l;ch=true}}
 if(ch)psSoft()};
H.pet_bought=m=>{PS.pend=0;sfx('coin');closeMod('ask');const d=m&&m.dog;if(!d)return;const buy=PS.buy;PS.buy=null;
 if(!m.mk&&typeof Egg!='undefined'&&Egg.reveal){try{Egg.reveal(d,{src:'shop',mixed:false,onClose:()=>{}});return}catch(e){}}
 psAdopt(d,{mk:!!m.mk,seller:buy&&buy.s})};
// "a new friend" card (used for market purchases and when the egg animation is not available)
function psAdopt(d,o){const b=DOGS.BR[d.breed]||{r:'C'};
 const html=`<div class="psnew r-${b.r}"><div class="psnew-glow"></div><div class="psnew-art">${anim(DOGS.k(d),d.variant,d.acc,300,240)}</div><h3>${esc(d.name)}</h3><div>${rarTag(b.r)}</div><div class="muted">${esc(DOGS.nm(d))}</div>
  <div class="psnew-ch">${dogChips(d)}</div><div class="psheart">${hearts(d.bond)}</div>
  <p class="muted" style="margin:6px 0">${o.mk?TT('Bought from '+esc(o.seller||'a player'),'ซื้อมาจาก '+esc(o.seller||'ผู้เล่นอื่น')):TT('Fresh from the Pet Shop!','มาใหม่จากร้านน้องหมา!')}</p>
  ${d.away?`<p class="psnote">🏠 ${TT('Your house is full, so this dog waits outside — find it in 🐶 Dogs.','บ้านเต็มแล้ว น้องหมาเลยรออยู่ข้างนอก — ดูได้ที่ 🐶 น้องหมา')}</p>`:''}
  <div class="row"><button class="btn ghost" data-do="psnewdogs">🐶 ${TT('My dogs','น้องหมาของฉัน')}</button><button class="btn pink" data-do="closemod" data-id="psnew">${TT('Yay!','เย้!')}</button></div></div>`;
 const ov=modal('psnew','🎉 '+TT('A new friend!','น้องหมาคนใหม่!'),html,'sm');psPaint(ov)}
DO.psnewdogs=()=>{closeMod('psnew');DO.dogs()};

// =====================================================================  SELL tab (to the shop)
const WHY={visit:['Go to your own house first','ต้องอยู่บ้านตัวเองก่อนนะ'],fav:['⭐ Favourites can not be sold — remove the star first','⭐ ขายตัวโปรดไม่ได้ (เอาดาวออกก่อนนะ)'],last:['You must keep at least 1 dog at home','ต้องมีน้องหมาอยู่บ้านอย่างน้อย 1 ตัวนะ'],
 guest:['Guests can not use the Market — please sign up first','ผู้เล่น Guest ใช้ตลาดไม่ได้ — สมัครสมาชิกก่อนนะ'],lvl:['','']};
function dogWhy(d,kind){const all=S.allDogs||[],home=all.filter(x=>!x.away).length;
 if(S.owner!=S.name)return TT(...WHY.visit);if(d.fav)return TT(...WHY.fav);if(S.allDogs&&(all.length<=1||(!d.away&&home<=1)))return TT(...WHY.last);
 if(kind=='list'){if(S.guest)return TT(...WHY.guest);const lv=V7().mkLvl||3;if((S.me.lvl|0)<lv)return TT(`You need level ${lv} to list dogs (you are level ${S.me.lvl|0})`,`ต้องเลเวล ${lv} ขึ้นไปถึงจะลงขายได้ (ตอนนี้เลเวล ${S.me.lvl|0})`);
  const mx=V7().mkMax||5;if(myListings()>=mx)return TT(`You can only have ${mx} listings at once`,`ลงขายพร้อมกันได้ไม่เกิน ${mx} ตัว`)}
 return''}
const myListings=()=>PS.mk?PS.mk.list.filter(e=>e.mine).length:0;
function dogValue(d){const b=DOGS.BR[d.breed];if(!b)return 0;return TRD.sellValue(d,b.r,b.pm||null,NOW(),S.gk||1)}
function psSellHTML(){const all=S.allDogs;if(!all)return loadingHTML(TT('Loading your dogs…','กำลังโหลดน้องหมา…'));
 const visit=S.owner!=S.name;
 const rows=all.map(d=>({d,v:dogValue(d),why:dogWhy(d,'sell'),why2:dogWhy(d,'list')})).sort((a,b)=>(!!a.why-!!b.why)||b.v-a.v||(RANK[(DOGS.BR[b.d.breed]||{}).r]|0)-(RANK[(DOGS.BR[a.d.breed]||{}).r]|0));
 return`<div class="psinfo">💰 ${TT("Sell a dog to the shop and get coins right away. The price depends on breed, age, bond, mixed breeds and lucky marks. Selling can't be undone!",'ขายน้องหมาให้ร้านแล้วได้ทองทันที ราคาขึ้นกับสายพันธุ์ วัย ความผูกพัน พันทาง และลายพิเศษ · ขายแล้วเอาคืนไม่ได้นะ!')}</div>
 ${visit?`<div class="psban warn"><b>🏡 ${TT('You are visiting '+esc(S.owner),'ตอนนี้อยู่บ้าน '+esc(S.owner))}</b> — ${TT('go home to sell dogs.','กลับบ้านตัวเองก่อนถึงจะขายได้นะ')} <button class="btn sm sky" data-do="home">🏠 ${TT('Go Home','กลับบ้าน')}</button></div>`:''}
 <div class="psl">${rows.map(({d,v,why,why2})=>sellRow(d,v,why,why2)).join('')||emptyState('ยังไม่มีน้องหมาเลย~','No dogs yet~','🐶')}</div>`}
function sellRow(d,v,why,why2){const b=DOGS.BR[d.breed]||{r:'C'};
 return`<div class="psrow r-${b.r}"><div class="psrow-art">${thumbHTML(DOGS.k(d),d.variant,34,d.acc)}</div>
  <div class="psrow-bd"><div class="psrow-nm"><b>${esc(d.name)}</b> ${rarTag(b.r)}${d.fav?' <span title="'+TT('Favourite','ตัวโปรด')+'">⭐</span>':''}${d.cr?' <span title="'+TT('Crowned','ได้มงกุฎ')+'">👑</span>':''}${d.away?` <span class="psch">🚪 ${TT('Away','ไม่อยู่บ้าน')}</span>`:''}</div>
   <div class="psrow-br">${esc(DOGS.nm(d))}</div><div class="psrow-ch">${dogChips(d)}</div><div class="psrow-h">${hearts(d.bond)}</div>${why?`<div class="psc-why left">🔒 ${esc(why)}</div>`:''}</div>
  <div class="psrow-act"><button class="btn sm ${why?'psno':'mint'}" ${why?'aria-disabled="true"':''} data-do="dogsell" data-id="${esc(d.id)}">💰 ${TT('Sell','ขาย')} <b>${nf(v)}</b> ${ic('coin','sm')}</button>
   <button class="btn sm ${why2?'psno':'lav'}" ${why2?'aria-disabled="true"':''} data-do="mklist" data-id="${esc(d.id)}">🏷️ ${TT('Market','ตลาด')}</button></div></div>`}
DO.dogsell=d=>{const dg=dogOf(d.id);if(!dg){send({t:'dogs_get'});return}
 const why=dogWhy(dg,'sell');if(why){toast('🔒 '+why);sfx('err');return}
 const v=dogValue(dg),b=DOGS.BR[dg.breed]||{r:'C'},hint=RANK[b.r]>=1||TRD.cleanTraits(dg.tr).length?`<span class="psask-s">💡 ${TT('Players may pay more on the Market!','ลองลงขายที่ตลาด อาจได้ราคาดีกว่านะ')}</span>`:'';
 psAsk({title:'💰 '+TT('Sell this dog?','ขายน้องหมาตัวนี้?'),yes:'💰 '+TT('Sell','ขายเลย'),cls:'red',
  html:`${askArt(DOGS.k(dg),dg.variant,dg.acc)}<b class="psask-n">${esc(dg.name)}</b><span class="psask-s">${esc(DOGS.nm(dg))}</span></span><span class="psask-l">${TT('The shop pays','ร้านจะจ่าย')} <b>${priceHTML('c',v)}</b></span><span class="psask-w">⚠️ ${TT("This can't be undone — you won't get this dog back.",'ขายแล้วเอากลับคืนไม่ได้นะ — จะไม่ได้น้องหมาตัวนี้คืน')}</span>${hint}`,
  go:()=>{PS.sellId=dg.id;psSend({t:'pet_sell',id:dg.id})}})};
H.pet_sold=m=>{PS.pend=0;sfx('coin');closeMod('ask');toast('💰 '+TT(`Sold ${m.name} for ${nf(m.c)}💰`,`ขาย ${m.name} ได้ ${nf(m.c)}💰`),3800);
 if(PS.sellId&&S.profId==PS.sellId)closeMod('prof');PS.sellId=null;send({t:'dogs_get'})};

// =====================================================================  MARKET tab
const mkLeft=e=>Math.max(0,e.exp-performance.now());
function mkWhy(e){if(e.mine)return'';if(S.guest)return TT(...WHY.guest);if(mkLeft(e)<=0)return TT('This listing has expired','หมดเวลาแล้ว');return fullWhy()||payWhy(e.c>0?'c':'g',e.c>0?e.c:e.g)}
const isRare=e=>{const b=DOGS.BR[e.d.breed]||{r:'C'};return RANK[b.r]>=2||TRD.cleanTraits(e.d.tr).some(id=>TRD.TR[id].tier>=3)};
function mkCard(e){const d=e.d,b=DOGS.BR[d.breed]||{r:'C'},cur=e.c>0?'c':'g',n=cur=='c'?e.c:e.g,why=mkWhy(e),left=mkLeft(e);
 return`<div class="mkc r-${b.r} ${e.mine?'mine':''}">${e.mine?`<span class="mkc-mine">★ ${TT('Yours','ของฉัน')}</span>`:''}
  <div class="mkc-art">${thumbHTML(DOGS.k(d),d.variant,40,d.acc)}</div>
  <div class="mkc-nm"><b>${esc(d.name)}</b> ${rarTag(b.r)}</div><div class="mkc-br">${esc(DOGS.nm(d))}</div>
  <div class="mkc-ch">${dogChips(d)}</div><div class="psheart">${hearts(d.bond)}</div>
  <div class="mkc-by">${e.mine?'':TT('Seller','ผู้ขาย')+': <b>'+esc(e.s)+'</b>'}</div>
  <div class="psc-pr ${cur=='g'?'gem':''}">${priceHTML(cur,n)}</div>
  <div class="mkc-left" data-exp="${Math.round(e.exp)}">⏳ ${durS(left)}</div>
  ${e.mine?`<button class="btn sm ghost" data-do="mkcancel" data-id="${esc(e.id)}">↩️ ${TT('Take back','เอากลับ')}</button><div class="psc-why"></div>`
   :`<button class="btn ${why?'psno':cur=='g'?'sky':'pink'}" ${why?'aria-disabled="true"':''} data-do="mkbuy" data-id="${esc(e.id)}">🛒 ${TT('Buy','ซื้อ')}</button><div class="psc-why">${esc(why)}</div>`}</div>`}
function psMarketHTML(){const M=PS.mk,v=V7(),fee=(M&&M.fee)||v.fee||.05;
 const info=`<div class="psmk-info">🏷️ ${TT(`Players sell dogs to each other here. Fee ${Math.round(fee*100)}% · up to ${v.mkMax||5} listings · stays ${v.mkH||48} h · sellers need Lv ${v.mkLvl||3}`,`ผู้เล่นขายน้องหมาให้กันที่นี่ · ค่าธรรมเนียม ${Math.round(fee*100)}% · ลงขายได้ ${v.mkMax||5} ตัว · ค้างได้ ${v.mkH||48} ชม. · ต้องเลเวล ${v.mkLvl||3} ขึ้นไป`)}</div>`;
 if(!M)return`<div class="psmk-bar">${info}</div>`+loadingHTML();
 const mine=M.list.filter(e=>e.mine).length,
  filt=[['all',TT('All','ทั้งหมด')],['c','💰 '+TT('Coins','ทอง')],['g','💎 '+TT('Gems','เพชร')],['rare','🌟 '+TT('Rare','หายาก')],['mine','★ '+TT('Mine','ของฉัน')+' '+mine]];
 let L=M.list.map((e,i)=>Object.assign(e,{ord:i})).filter(e=>PS.filt=='all'||(PS.filt=='c'&&e.c>0)||(PS.filt=='g'&&e.g>0)||(PS.filt=='rare'&&isRare(e))||(PS.filt=='mine'&&e.mine));
 L.sort(PS.sort=='new'?(a,b)=>a.ord-b.ord:(a,b)=>((a.c>0?0:1)-(b.c>0?0:1))||((a.c||a.g)-(b.c||b.g))||a.ord-b.ord);
 return`<div class="psmk-bar">${info}<button class="btn pink psmk-list" data-do="mklist">🏷️ ${TT('List a dog','ลงขายน้องหมา')}<small>${mine}/${v.mkMax||5}</small></button></div>
 <div class="psf">${filt.map(([k,l])=>`<button class="pill ${PS.filt==k?'on':''}" data-do="mkfilt" data-k="${k}">${l}</button>`).join('')}<span class="sp"></span>${[['cheap',TT('Cheapest','ถูกสุด')],['new',TT('Newest','ใหม่สุด')]].map(([k,l])=>`<button class="pill ${PS.sort==k?'on':''}" data-do="mksort" data-k="${k}">${l}</button>`).join('')}</div>
 ${S.guest?`<div class="psban warn">${TT(...WHY.guest)}</div>`:''}
 ${L.length?`<div class="psg mk">${L.map(mkCard).join('')}</div>`:M.list.length?emptyState('ไม่มีรายการที่ตรงกับตัวกรอง','Nothing matches this filter','🔍'):emptyState('ตลาดยังไม่มีน้องหมาเลย~ ลองลงขายเป็นคนแรกสิ!','The market is empty~ be the first to list a dog!','🏷️')}`}
DO.mkfilt=d=>{PS.filt=d.k;psRender()};DO.mksort=d=>{PS.sort=d.k;psRender()};
DO.mkbuy=d=>{const e=PS.mk&&PS.mk.list.find(x=>x.id==d.id);if(!e){send({t:'mk_get'});return}const why=mkWhy(e);if(why){toast('🚫 '+why);sfx('err');return}
 const cur=e.c>0?'c':'g',n=cur=='c'?e.c:e.g,have=cur=='g'?S.me.gems:S.me.coins,x=e.d;
 psAsk({title:'🏷️ '+TT('Buy from the Market?','ซื้อจากตลาด?'),yes:'🛒 '+TT('Buy','ซื้อเลย'),cls:cur=='g'?'sky':'pink',
  html:`${askArt(DOGS.k(x),x.variant,x.acc)}<b class="psask-n">${esc(x.name)}</b><span class="psask-s">${esc(DOGS.nm(x))} · ${TT('from','จาก')} ${esc(e.s)}</span></span><span class="psask-c">${dogChips(x)}</span><span class="psask-l">${TT('Price','ราคา')}: <b>${priceHTML(cur,n)}</b></span><span class="psask-s">${TT('You have','คุณมี')} ${priceHTML(cur,have)} → ${TT('left','เหลือ')} ${priceHTML(cur,have-n)}</span>`,
  go:()=>{PS.buy={id:e.id,s:e.s};psSend({t:'mk_buy',id:e.id})}})};
DO.mkcancel=d=>{psSend({t:'mk_cancel',id:d.id})};
H.mk=m=>{PS.pend=0;const t=performance.now();for(const e of m.list||[])e.exp=t+num(e.left);PS.mk=m;PS.stuck=0;
 const pp=PS.putPend;if(pp&&m.list.some(e=>e.mine&&e.d.id==pp.dog)){PS.putPend=null;closeMod('mklist');sfx('coin');if(modOpen('petshop')&&PS.tab!='mk'){}}
 psSoft()};

// =====================================================================  "list a dog for sale" form
const psTyping=()=>{const a=document.activeElement;return!!a&&a.id=='mkPrice'};
const mlRange=cur=>{const v=V7(),r=cur=='g'?(v.priceG||[1,9999]):(v.priceC||[50,99999]);return{lo:r[0],hi:r[1]}};
const mlNet=p=>{const fee=(PS.mk&&PS.mk.fee)||V7().fee||.05;return Math.max(1,Math.round(p*(1-fee)))};
const curName=cur=>cur=='g'?TT('gems','เพชร'):TT('coins','ทอง');
function mlErr(){const m=PS.ml,{lo,hi}=mlRange(m.cur),p=num(m.price);if(!m.price)return'';
 if(p<lo)return TT(`The lowest price is ${nf(lo)}`,`ราคาต่ำสุดคือ ${nf(lo)}`);if(p>hi)return TT(`The highest price is ${nf(hi)}`,`ราคาสูงสุดคือ ${nf(hi)}`);return''}
DO.mklist=d=>{const id=d&&d.id||null;PS.ml={dog:id,cur:'c',price:'',pick:!id};send({t:'dogs_get'});send({t:'mk_get'});psMlRender()};
function psMlRender(){const m=PS.ml;if(!m)return;const all=S.allDogs;
 const dg=m.dog?dogOf(m.dog):null,why=dg?dogWhy(dg,'list'):'',{lo,hi}=mlRange(m.cur),p=num(m.price),err=mlErr();
 let top='';
 if(!all)top=loadingHTML(TT('Loading your dogs…','กำลังโหลดน้องหมา…'));
 else if(dg&&!m.pick){const b=DOGS.BR[dg.breed]||{r:'C'};
  top=`<div class="psml-dog r-${b.r}"><div class="psml-art">${thumbHTML(DOGS.k(dg),dg.variant,34,dg.acc)}</div><div class="psml-bd"><b>${esc(dg.name)}</b> ${rarTag(b.r)}<div class="muted">${esc(DOGS.nm(dg))}</div><div class="psrow-ch">${dogChips(dg)}</div></div><button class="btn sm ghost" data-do="mkpick" data-id="">${TT('Change','เปลี่ยน')}</button></div>`}
 else{const L=all.map(d=>({d,why:dogWhy(d,'list'),v:dogValue(d)})).sort((a,b)=>(!!a.why-!!b.why)||b.v-a.v);
  top=`<div class="psml-h">${TT('Pick a dog to list','เลือกน้องหมาที่จะลงขาย')}</div><div class="psml-pick">${L.map(({d,why})=>`<button class="psp ${why?'off':''} ${m.dog==d.id?'on':''}" ${why?'aria-disabled="true"':''} data-do="mkpick" data-id="${esc(d.id)}" title="${esc(why)}">${thumbHTML(DOGS.k(d),d.variant,26,d.acc)}<span>${esc(d.name)}</span>${why?'<i>🔒</i>':''}</button>`).join('')}</div>`}
 const showForm=dg&&!m.pick,quick=m.cur=='g'?[3,5,10,25,50]:[100,300,500,1000,3000],val=showForm&&m.cur=='c'?dogValue(dg):0;
 const left=`${top}${showForm?`${why?`<div class="psban warn">🔒 ${esc(why)}</div>`:''}
  <div class="psml-h">${TT('Price in','ตั้งราคาเป็น')}</div><div class="sel-row psml-cur"><button class="opt ${m.cur=='c'?'on':''}" data-do="mkcur" data-k="c">💰 ${TT('Coins','ทอง')}</button><button class="opt ${m.cur=='g'?'on':''}" data-do="mkcur" data-k="g">💎 ${TT('Gems','เพชร')}</button></div>
  ${val?`<div class="psml-hint">💡 ${TT('The shop would pay about','ร้านรับซื้อประมาณ')} ${priceHTML('c',val)} — ${TT('ask for more than that to make it worth it!','ตั้งสูงกว่านี้ถึงจะคุ้มนะ')}</div>`:''}`:''}`;
 const right=showForm?`<label class="psml-in"><span>${TT('Price','ราคา')} <small>(${nf(lo)} – ${nf(hi)} ${curName(m.cur)})</small></span><input id="mkPrice" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="${String(hi).length}" autocomplete="off" placeholder="${nf(lo)} – ${nf(hi)}" value="${esc(m.price)}"></label>
  <div class="psq">${quick.filter(q=>q>=lo&&q<=hi).map(q=>`<button class="pill" data-do="mkq" data-v="${q}">${nf(q)}</button>`).join('')}</div>
  <div class="psprev" id="psPrev"></div><div class="err" id="mkErr">${esc(err)}</div>
  <div class="row"><button class="btn ghost" data-do="closemod" data-id="mklist">${TT('Cancel','ยกเลิก')}</button><button class="btn pink" id="mkGo" data-do="mkgo">🏷️ ${TT('List it','ลงขาย')}</button></div>
  <div class="muted psml-n">${TT(`If nobody buys within ${V7().mkH||48} h, your dog comes back to you by mail 💌`,`ถ้าไม่มีใครซื้อใน ${V7().mkH||48} ชม. น้องหมาจะกลับมาหาคุณทางจดหมาย 💌`)}</div>`:'';
 const html=`<div class="psml ${showForm?'':'solo'}"><div class="psml-l">${left}</div>${showForm?`<div class="psml-r">${right}</div>`:''}</div>`;
 const ov=modal('mklist','🏷️ '+TT('List a dog for sale','ลงขายน้องหมา'),html,'sm ps psmlm');paintThumbs(ov);
 const inp=$('#mkPrice',ov);if(inp){inp.oninput=()=>{const c=inp.value.replace(/\D/g,'').slice(0,6);if(c!==inp.value)inp.value=c;PS.ml.price=c;psMlPreview()};inp.onkeydown=e=>{if(e.key=='Enter'){e.preventDefault();DO.mkgo()}}}
 psMlPreview()}
function psMlPreview(){const m=PS.ml;if(!m)return;const pv=$('#psPrev'),go=$('#mkGo');if(!pv)return;const p=num(m.price),err=mlErr(),ok=p>0&&!err,net=mlNet(p),fee=(PS.mk&&PS.mk.fee)||V7().fee||.05,cur=m.cur;
 pv.innerHTML=ok?`<div><span>${TT('Buyer pays','ผู้ซื้อจ่าย')}</span><b>${priceHTML(cur,p)}</b></div><div><span>${TT('Fee','ค่าธรรมเนียม')} ${Math.round(fee*100)}%</span><b>− ${nf(p-net)}</b></div><div class="net"><span>${TT('You receive','คุณได้รับ')}</span><b>${priceHTML(cur,net)}</b></div>`
  :`<div class="muted">${TT('Type a price to see what you will receive','พิมพ์ราคาเพื่อดูว่าคุณจะได้รับเท่าไหร่')}</div>`;
 const e=$('#mkErr');if(e)e.textContent=err;if(go){const dg=m.dog&&dogOf(m.dog),bad=!ok||!dg||!!dogWhy(dg,'list')||!!PS.putPend;go.classList.toggle('psno',bad);if(bad)go.setAttribute('aria-disabled','true');else go.removeAttribute('aria-disabled')}}
function psMlSoft(){if(!PS.putPend)psMlPreview()}
DO.mkpick=d=>{const m=PS.ml;if(!m)return;if(!d.id){m.pick=true;psMlRender();return}const dg=dogOf(d.id),why=dg?dogWhy(dg,'list'):'';if(why){toast('🔒 '+why);sfx('err');return}m.dog=d.id;m.pick=false;psMlRender()};
DO.mkcur=d=>{const m=PS.ml;if(!m||m.cur==d.k)return;m.cur=d.k;m.price='';psMlRender()};
DO.mkq=d=>{const m=PS.ml;if(!m)return;m.price=String(num(d.v));const i=$('#mkPrice');if(i)i.value=m.price;psMlPreview()};
DO.mkgo=()=>{const m=PS.ml;if(!m||PS.putPend)return;const dg=m.dog&&dogOf(m.dog);
 if(!dg){toast(TT('Pick a dog first','เลือกน้องหมาก่อนนะ'));sfx('err');return}
 const why=dogWhy(dg,'list');if(why){toast('🔒 '+why);sfx('err');return}
 const p=num(m.price),err=mlErr();if(!p||err){const e=$('#mkErr');if(e)e.textContent=err||TT('Type a price first','พิมพ์ราคาก่อนนะ');sfx('err');const i=$('#mkPrice');if(i)i.focus();return}
 if(!psSend({t:'mk_put',dog:dg.id,[m.cur]:p}))return;PS.putPend={dog:dg.id};psMlPreview();setTimeout(()=>{if(PS.putPend&&PS.putPend.dog==dg.id){PS.putPend=null;psMlPreview()}},2600)};

// =====================================================================  tick: live countdowns + refresh every ~20 s while the window is open
setInterval(()=>{const open=modOpen('petshop');if(!open)return;PS.n++;
 for(const el of $$('[data-restock]',open))el.textContent=dur(restockMs());
 const t=performance.now();let expired=false;
 for(const el of $$('[data-exp]',open)){const l=Number(el.dataset.exp)-t;el.textContent='⏳ '+durS(l);el.classList.toggle('soon',l<36e5);if(l<=0&&!el.dataset.gone){el.dataset.gone=1;expired=true}}
 const have=PS.tab=='shop'?PS.shop:PS.tab=='mk'?PS.mk:S.allDogs;
 if(!have&&Date.now()-PS.fetchAt>5000&&!PS.stuck){PS.stuck=1;psSoft()}
 if(expired||PS.n%20==0){if(!document.hidden)psFetch()}},1000);
})();
