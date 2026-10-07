// Cozy Dogs v7 - the Dog Nursery window (breeding): nest with eggs, "new pair" picker with a live egg preview, hatch / speed-up, result card, breeding guide.
// The genes are decided by the SERVER (pets.js: nur_get / nur_pair / nur_hatch / nur_fast  ->  nur / nur_ok / nur_hatched). This file only shows them:
// nurCalc() below reproduces pets.js geneKid() as exact probabilities, so the preview never promises anything the server does not do (server_test13.js checks that).
// Window id: 'nursery' (DO.nursery is the dock button; DO.nurpick is "breed this dog" from the dog profile).
'use strict';
(function(){
const NU='nursery',own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);

// ===================================================================== the rules, as exact numbers (mirror of pets.js)
//#calc-begin
const RL=['C','R','E','L','M'],RO={C:0,R:1,E:2,L:3,M:4};
const NR={mut:.04,inh:.5,newPure:.12,newMix:.30,b1:50,b1p:.05,b2:80,b2p:.10,dom:.06,lo:.25,hi:.75,coat:.07,tw:[60,32,8],tw2:[45,40,15],maxTr:2,dec:.25};
const nurAlle=d=>[d.breed,d.mix&&d.mix!=d.breed?d.mix:d.breed];
// a, b: dogs {breed,mix,tr,bond}.  E: {ro(id)->0..4, pool(tier)->[breed ids], hatchH:{C:h,..}, cost:{C:coins,..}, hk}
function nurCalc(a,b,E){
 const ga=nurAlle(a),gb=nurAlle(b),all=ga.concat(gb),top=Math.max(...all.map(E.ro)),pool=E.pool(Math.min(4,top+1)),mutP=pool.length?NR.mut:0,base=1-mutP;
 const rows=new Map(),eggP={},lvl=x=>Math.min(1,Math.max(0,x));
 for(const x of ga)for(const y of gb){
  const w=base/4,rx=E.ro(x),ry=E.ro(y),egg=RL[Math.max(rx,ry)];eggP[egg]=(eggP[egg]||0)+w;
  if(x==y){const r=rows.get(x)||{pure:true,ids:[x],p:0,dom:new Map()};r.p+=w;rows.set(x,r);continue}
  const px=Math.min(NR.hi,Math.max(NR.lo,.5+NR.dom*(rx-ry))),k=[x,y].sort().join('+'),r=rows.get(k)||{pure:false,ids:[x,y].sort(),p:0,dom:new Map()};
  r.p+=w;r.dom.set(x,(r.dom.get(x)||0)+w*px);r.dom.set(y,(r.dom.get(y)||0)+w*(1-px));rows.set(k,r)}
 const list=[...rows.values()];
 for(const r of list)if(!r.pure){let best=r.ids[0];for(const id of r.ids)if(r.dom.get(id)>r.dom.get(best)+1e-9||(Math.abs(r.dom.get(id)-r.dom.get(best))<1e-9&&id==r.ids[0]))best=id;   // the more likely leader first
  r.lead=best;r.other=r.ids.find(i=>i!=best);r.shares=r.ids.map(i=>({id:i,p:r.dom.get(i)/r.p}))}
 const mut=mutP?{p:mutP,tier:Math.min(4,top+1),rar:RL[Math.min(4,top+1)],pool}:null;if(mut)eggP[mut.rar]=(eggP[mut.rar]||0)+mutP;
 // a mutation swaps ONE of the two chosen genes for a random breed of the next tier; it is a purebred only if the other gene happens to be that very breed (possible for Mythic parents only)
 let mutPure=0;if(mut)for(const x of ga)for(const y of gb)mutPure+=.25*.5*((pool.includes(y)?1:0)+(pool.includes(x)?1:0))/pool.length;
 mut&&(mut.pure=mutPure);
 const mixP=list.filter(r=>!r.pure).reduce((s,r)=>s+r.p,0)+mutP*(1-mutPure);
 const bond=((a.bond|0)+(b.bond|0))/2,bonus=bond>=NR.b2?NR.b2p:bond>=NR.b1?NR.b1p:0,newP=lvl(mixP*NR.newMix+(1-mixP)*NR.newPure+bonus);
 // pets.js rolls every trait of BOTH parents (a trait both parents carry gets two 50% rolls = 75%)
 const ta=TRD.cleanTraits(a.tr),tb=TRD.cleanTraits(b.tr),pt=[...new Set([...ta,...tb])].map(id=>{const n=(ta.includes(id)?1:0)+(tb.includes(id)?1:0);return{id,n,p:1-Math.pow(1-NR.inh,n)}}),tw=bond>=NR.b2?NR.tw2:NR.tw,tws=tw.reduce((s,v)=>s+v,0);
 const costR=RL[Math.max(...[a.breed,a.mix,b.breed,b.mix].filter(Boolean).map(E.ro))],mul=1-NR.dec*bond/100,time={};
 for(const R of Object.keys(eggP))time[R]=E.hatchH[R]*36e5/Math.max(1,E.hk||1)*mul;
 return{ga,gb,top,rows:list,mut,mixP,eggP,time,bond,bonus,mul,newP,tierP:tw.map(v=>v/tws),parentTr:pt,anyP:lvl(1-pt.reduce((q,x)=>q*(1-x.p),1)*(1-newP)),costR,cost:E.cost[costR]|0}}
//#calc-end

// ===================================================================== small helpers
const DEF={hatchH:{C:.5,R:1,E:2,L:4,M:6},cost:{C:80,R:150,E:300,L:600,M:1000},hk:1,restH:12,maxDogs:100};
const V=k=>{const v=S.v7&&S.v7[k];return v==null?DEF[k]:v};
const HK=()=>Math.max(1,+V('hk')||1);
const env=()=>{const R=DOGS.raw;return{ro:id=>R[id]&&own(RO,R[id].r)?RO[R[id].r]:0,pool:tier=>Object.values(R).filter(b=>!b.pm&&b.r==RL[tier]).map(b=>b.id),hatchH:V('hatchH'),cost:V('cost'),hk:HK()}};
const bn=id=>DOGS.raw[id]?DOGS.raw[id].name:String(id);
const rOf=id=>DOGS.raw[id]&&own(RO,DOGS.raw[id].r)?DOGS.raw[id].r:'C';
const rtag=r=>`<span class="rar" style="background:${RCOL[r]}">${esc(t(RN[r]))}</span>`;
const pc=p=>p>=.995?'100%':p<.005?'<1%':Math.round(p*100)+'%';
const srvNow=()=>Date.now()+(S.skew||0);
function nDur(ms){ms=Math.max(0,+ms||0);if(ms<9e4){return Math.max(1,Math.round(ms/1e3))+TT(' s',' วิ')}
 const M=Math.round(ms/6e4),h=Math.floor(M/60),m=M%60;if(h<=0)return M+TT(' min',' นาที');
 if(h>=48){const d=Math.floor(h/24),hh=h%24;return d+TT(' d',' วัน')+(hh?' '+hh+TT(' h',' ชม.'):'')}
 return h+TT(' h',' ชม.')+(m?' '+m+TT(' min',' นาที'):'')}
function clock(ms){const s=Math.max(0,Math.ceil(ms/1000)),h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60,p=n=>String(n).padStart(2,'0');return h?`${h}:${p(m)}:${p(x)}`:`${m}:${p(x)}`}
const trList=d=>TRD.cleanTraits(d&&d.tr);
const trEm=(ids,n=2)=>ids.slice(0,n).map(id=>{const T=TRD.TR[id];return`<span class="tr" title="${esc(TT(T.en,T.th))}">${T.e}</span>`}).join('');
const trName=T=>TT(T.en,T.th),trDesc=T=>TT(T.den,T.dth);
const SPK='<svg viewBox="0 0 10 10"><path d="M5 0l1.2 3.8L10 5 6.2 6.2 5 10 3.8 6.2 0 5l3.8-1.2z"/></svg>';
const HRT='<svg viewBox="0 0 10 9"><path d="M5 9L.9 4.9C-.4 3.4.1 1 2 .4 3.3 0 4.4.6 5 1.6 5.6.6 6.7 0 8 .4c1.9.6 2.4 3 1.1 4.5z"/></svg>';

// ===================================================================== egg art (CSS egg; colour + pattern hint the rarity, sparkles for the rare ones)
const DECO={C:[],R:[],E:[[22,34,20],[62,58,17],[40,74,13]],L:[[26,36,19],[64,62,14]],M:[[22,30,19,1],[62,52,19,1],[38,72,14]]};
function eggHTML(r,o={}){r=own(RO,r)?r:'C';
 const dc=o.mini||o.mys||o.gh?'':(DECO[r]||[]).map(([x,y,w,h])=>`<i class="nu-d ${h?'h':''}" style="left:${x}%;top:${y}%;width:${w}%">${h?HRT:SPK}</i>`).join('');
 const crack=o.crack?'<i class="nu-crack"><svg viewBox="0 0 60 20" preserveAspectRatio="none"><path d="M0 12L8 5L15 14L24 3L32 15L41 5L50 14L60 6" fill="none" stroke="#5a3d33" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"/></svg></i>':'';
 return`<span class="nu-egg r-${r} ${o.mini?'nu-mini':''} ${o.mys?'mys':''} ${o.gh?'gh':''}">${dc}${crack}</span>`}
const FL=[[4,20,12,0],[84,12,10,.8],[6,58,9,1.5],[86,50,13,.4],[44,-2,10,1.1],[78,80,9,1.9]];
function floaters(r){const n={R:2,E:3,L:4,M:6}[r]||0,col={R:'#d6ecff',E:'#efe2ff',L:'#fff1a0',M:'#ffd0ea'}[r];
 return FL.slice(0,n).map(([x,y,s,d],i)=>`<i class="nur-fl" style="left:${x}%;top:${y}%;width:${s}px;animation-delay:${d}s;--fc:${r=='M'&&i%2?'#ff9cc8':col}">${r=='M'&&i%2?HRT:SPK}</i>`).join('')}
const RING={C:'#ffa65c',R:'#4f9dff',E:'#a65cff',L:'#ffb52e',M:'#ff5cc0'},RC2=2*Math.PI*46;

// ===================================================================== state
const Z={sel:{a:null,b:null,act:1},q:'',rf:'all',only:false,busy:{},fresh:new Set(),pre:null,flags:{},timer:0,loadT:0,ids:null};
const dogs=()=>Array.isArray(S.allDogs)?S.allDogs:[];
const byId=id=>id==null?null:dogs().find(d=>String(d.id)==String(id))||null;
const selDog=n=>{const d=byId(n==1?Z.sel.a:Z.sel.b);return d||null};
const restLeft=d=>Math.max(0,(+d.rest||0)-(Date.now()-(S.allDogsAt||Date.now())));
const remain=e=>Math.max(0,(+e.left||0)-(Date.now()-((S.nur&&S.nur.at)||Date.now())));
const eggOf=id=>S.nur&&S.nur.eggs.find(e=>String(e.id)==String(id));
const maxDogs=()=>+V('maxDogs')||100;
const fastCost=e=>Math.min(24,Math.max(1,Math.ceil(remain(e)*HK()/9e5)));
const ov=()=>modOpen(NU);
const Q=(s,r)=>{const o=r||ov();return o?o.querySelector(s):null};
function lock(k,ms=1500){if(Z.busy[k])return false;Z.busy[k]=setTimeout(()=>{delete Z.busy[k];queue('bar')},ms);queue('bar');return true}
function unlock(p){for(const x of Object.keys(Z.busy))if(p==null||x.startsWith(p)){clearTimeout(Z.busy[x]);delete Z.busy[x]}}
const isBusy=p=>Object.keys(Z.busy).some(k=>k.startsWith(p));

// why a dog cannot be a parent right now (null = fine). Same order as pets.js pairErr: premium -> not adult -> resting.
function why(d){
 const R=DOGS.raw[d.breed];if(R&&R.pm)return{k:'prem',s:'👑 '+TT('Premium','พรีเมียม'),l:`${d.name}: `+TT('premium breeds cannot breed','สายพันธุ์พรีเมียมผสมพันธุ์ไม่ได้')};
 const gk=S.gk||1,sv=srvNow();
 if(Number.isFinite(d.born)){const st=TRD.stageOf(d.born,sv,gk);if(st<3){const ms=Math.max(0,TRD.ADULT_MS/gk-(sv-d.born)),sg=TRD.STAGES[st];
  return{k:'baby',ms,s:sg.e+' '+TT('grows up in ','โตใน ')+nDur(ms),l:`${d.name} `+TT(`is still a ${sg.en.toLowerCase()} - only grown-up dogs can breed (adult in ${nDur(ms)})`,`ยังเป็น${sg.th}อยู่ ผสมพันธุ์ได้เมื่อโตเต็มวัย (อีก ${nDur(ms)})`)}}}
 const r=restLeft(d);if(r>0)return{k:'rest',ms:r,s:'😴 '+TT('rests ','พักอีก ')+nDur(r),l:`${d.name} `+TT(`is resting for ${nDur(r)}`,`ยังพักอยู่อีก ${nDur(r)}`)};
 return null}

// ===================================================================== the nest
function slotHTML(e){
 const rem=remain(e),rdy=rem<=0,tot=Math.max(1,+e.total||1),prog=rdy?1:Math.min(1,Math.max(0,1-rem/tot)),wob=!rdy&&rem<=Math.min(3e5,Math.max(45e3,tot*.07)),r=own(RO,e.rar)?e.rar:'C';
 const pa=e.pa||{},pb=e.pb||{},mini=p=>p&&p.b&&DOGS.raw[p.b]?thumbHTML(p.b,p.v||'Normal',11):'';
 const fresh=Z.fresh.has(String(e.id)),g=fastCost(e),canG=(S.me.gems|0)>=g,full=(S.me.total|0)>=maxDogs();
 return`<div class="nur-slot r-${r} ${rdy?'rdy':''} ${wob?'wob':''} ${fresh?'new':''}" data-id="${esc(e.id)}">
 <div class="nur-ew" style="--rc:${RING[r]}"><svg class="nur-ring" viewBox="0 0 104 104"><circle class="in" cx="52" cy="52" r="42"/><circle class="bg" cx="52" cy="52" r="46"/><circle class="pg" cx="52" cy="52" r="46" stroke-dasharray="${RC2.toFixed(2)}" stroke-dashoffset="${(RC2*(1-prog)).toFixed(2)}"/></svg>${floaters(r)}<div class="nur-eg">${eggHTML(r,{crack:rdy})}</div><div class="nur-cup"></div></div>
 <div class="nur-cd" data-cd>${rdy?'🎉 '+TT('Ready!','พร้อมแล้ว!'):clock(rem)}</div>
 <div class="nur-kind">${TT('Egg','ไข่')} ${rtag(r)}${(e.cm|0)>0?`<span title="${esc(TT('Parents bond','ความผูกพันของพ่อแม่'))}">${ic('heart','sm')}${e.cm|0}</span>`:''}</div>
 <div class="nur-from">${mini(pa)}<span>${esc(pa.n||'?')}</span>♥${mini(pb)}<span>${esc(pb.n||'?')}</span></div>
 <div class="nur-sbt">${rdy?`<button class="btn mint ${full||isBusy('h')?'nur-off':''}" data-do="nurhatch" data-id="${esc(e.id)}">🐣 ${isBusy('h'+e.id)?TT('Hatching…','กำลังฟัก…'):TT('Hatch!','ฟักไข่!')}</button>`
  :`<button class="btn sky ${canG?'':'nur-off'}" data-do="nurfast" data-id="${esc(e.id)}" title="${esc(TT('Speed up: 1 gem per 15 min left (max 24)','เร่งเวลา: 1 เพชรต่อ 15 นาทีที่เหลือ (สูงสุด 24)'))}">⚡ ${TT('Speed up','เร่งเวลา')} <b data-g>${g}</b>${ic('gem','sm')}</button>`}</div></div>`}
function nestHTML(){
 const N=S.nur;if(!N)return`<div class="nur-load">${Z.loadT&&Date.now()-Z.loadT>5000?`😿 ${TT('The nursery did not answer.','บ้านเลี้ยงลูกยังไม่ตอบ')} <button class="btn sm sky" data-do="nurretry">↻ ${TT('Try again','ลองใหม่')}</button>`:`🥚 ${TT('Warming up the nest…','กำลังอุ่นรังไข่…')}`}</div>`;
 let h=N.eggs.map(slotHTML).join('');
 for(let i=N.eggs.length;i<N.max;i++)h+=`<div class="nur-slot empty" data-do="nurgo"><div class="nur-ghost">${eggHTML('C',{gh:1})}<span class="nur-plus">+</span></div><div class="nur-txt"><b>${TT('Empty nest','รังว่าง')}</b><small>${TT('Pair two dogs to lay an egg','จับคู่หมา 2 ตัวเพื่อให้ออกไข่')}</small></div></div>`;
 const hl=N.max-2,nx=S.welcome&&Array.isArray(S.welcome.house)?S.welcome.house[hl+1]:null;
 if(nx)h+=`<div class="nur-slot lock"><div class="nur-lockic">🔒</div><div class="nur-txt"><b>${TT('One more nest','รังไข่เพิ่ม +1')}</b><small>${TT('Upgrade your house'+(nx.lvl?` (player Lv.${nx.lvl})`:''),'อัปเกรดบ้านเพื่อปลดล็อก'+(nx.lvl?` (ผู้เล่นเลเวล ${nx.lvl})`:''))}</small></div></div>`;
 return h}
function nestWarn(){const N=S.nur;if(!N)return'';const rd=N.eggs.some(e=>remain(e)<=0),full=(S.me.total|0)>=maxDogs();
 return rd&&full?`🏠 ${TT(`You have ${maxDogs()} dogs - the most possible. Ready eggs wait until you sell, release or list a dog.`,`ตอนนี้มีหมาครบ ${maxDogs()} ตัวแล้ว ไข่ที่พร้อมฟักจะรอไว้ก่อน ขาย ปล่อย หรือลงตลาดสักตัวเพื่อเว้นที่นะ`)}`:''}
function setHTML(el,h){if(!el)return false;if(el._h===h)return false;el._h=h;el.innerHTML=h;paintThumbs(el);return true}
function renderNest(){const o=ov();if(!o)return;const N=S.nur;
 setHTML(Q('.nur-nest',o),nestHTML());setHTML(Q('.nur-warn',o),nestWarn());
 const pl=Q('[data-ncount]',o);if(pl){pl.textContent=N?N.eggs.length+'/'+N.max:'–';pl.classList.toggle('full',!!N&&N.eggs.length>=N.max)}}

// ===================================================================== new pair: slots, picker, preview, button
function psHTML(n,d){const act=Z.sel.act==n;
 if(!d)return`<div class="nur-ps empty ${act?'act':''}" data-do="nurslot" data-s="${n}"><span class="nur-pn">${n}</span><span class="em">🐶</span><div>${TT('Parent '+n,'พ่อแม่พันธุ์ '+n)}</div><small>${act?TT('Tap a dog below','แตะเลือกหมาด้านล่าง'):TT('Tap to choose','แตะเพื่อเลือก')}</small></div>`;
 return`<div class="nur-ps has ${act?'act':''}" data-do="nurslot" data-s="${n}"><span class="nur-pn">${n}</span><button class="nur-px" data-do="nurclr" data-s="${n}" title="${esc(TT('Remove','เอาออก'))}">✕</button><div class="nur-pth">${thumbHTML(DOGS.k(d),d.variant,58,d.acc)}</div><div class="nur-pi"><b>${esc(d.name)}</b><small>${esc(DOGS.nm(d))}</small><small>${trEm(trList(d))} ${ic('heart','sm')}${d.bond|0}</small></div></div>`}
const HEART_BIG='<svg class="hh" viewBox="0 0 10 9"><path d="M5 9L.9 4.9C-.4 3.4.1 1 2 .4 3.3 0 4.4.6 5 1.6 5.6.6 6.7 0 8 .4c1.9.6 2.4 3 1.1 4.5z"/></svg>';
function slotsHTML(){const a=selDog(1),b=selDog(2),both=a&&b;
 return psHTML(1,a)+`<div class="nur-mid ${both?'on':''}">${HEART_BIG}<i class="fh">${HRT}</i><i class="fh">${HRT}</i><i class="fh">${HRT}</i></div>`+psHTML(2,b)}
function cardHTML(d){const w=why(d),r=rOf(d.breed),n=String(d.id)==String(Z.sel.a)?1:String(d.id)==String(Z.sel.b)?2:0,tr=trList(d);
 return`<div class="nur-dog r-${r} ${n?'sel':''} ${w?'off':''}" data-do="nurdog" data-id="${esc(d.id)}"><span class="bd2">${n||''}</span>${d.fav?'<span class="fv2">⭐</span>':''}
 <div class="mn">${thumbHTML(DOGS.k(d),d.variant,62,d.acc)}<div class="nm">${esc(d.name)}</div><div class="br">${esc(DOGS.nm(d))}</div><div class="mt">${trEm(tr)}<span>${ic('heart','sm')}${d.bond|0}</span>${d.away?`<span title="${esc(TT('Not at home','ไม่ได้อยู่บ้าน'))}">🏕️</span>`:''}</div></div>
 ${w?`<div class="why" ${w.k=='rest'?`data-rest="${esc(d.id)}"`:''}>${w.s}</div>`:''}</div>`}
function pickList(){const q=Z.q.trim().toLowerCase(),RR={C:0,R:1,E:2,L:3,M:4};
 return dogs().filter(d=>(Z.rf=='all'||rOf(d.breed)==Z.rf)&&(!q||(String(d.name).toLowerCase().includes(q)||String(DOGS.nm(d)).toLowerCase().includes(q)||String((DOGS.raw[d.breed]||{}).en||'').toLowerCase().includes(q)))&&(!Z.only||!why(d)))
  .map(d=>({d,w:why(d)})).sort((x,y)=>(!!x.w-!!y.w)||(RR[rOf(y.d.breed)]-RR[rOf(x.d.breed)])||String(x.d.name).localeCompare(String(y.d.name))||String(x.d.id).localeCompare(String(y.d.id))).map(x=>x.d)}
function pickHTML(){
 if(!Array.isArray(S.allDogs))return Array.from({length:6},()=>'<div class="nur-skel"></div>').join('');
 const L=pickList();
 if(!dogs().length)return`<div class="nur-empty">${emptyState('ยังไม่มีหมาให้เลือก','No dogs yet','🐶')}</div>`;
 if(!L.length)return`<div class="nur-empty">${emptyState('ไม่เจอหมาที่ค้นหา ลองเปลี่ยนคำค้นหรือตัวกรองดูนะ','No dogs match - try another search or filter','🔍')}</div>`;
 return L.map(cardHTML).join('')}
function pickHead(){const ok=dogs().filter(d=>!why(d)).length;
 return`<span>${TT('Choosing','กำลังเลือก')}</span><span class="who">${TT('Parent '+Z.sel.act,'พ่อแม่พันธุ์ '+Z.sel.act)}</span>${Array.isArray(S.allDogs)?`<span class="ct">${ok}/${dogs().length} ${TT('ready to breed','พร้อมผสม')}</span>`:''}`}
function chipsHTML(){return[['all',null],...RL.map(r=>[r,r])].map(([k,r])=>`<button class="nur-chip ${Z.rf==k?'on':''}" data-do="nurflt" data-k="${k}">${r?`<i style="--c:${RCOL[r]}"></i>${esc(t(RN[r]))}`:esc(t('All'))}</button>`).join('')+`<button class="nur-chip ${Z.only?'on':''}" data-do="nuronly">✅ ${TT('Ready only','เฉพาะที่พร้อม')}</button>`}
function renderPicker(){const o=ov();if(!o)return;setHTML(Q('.nur-dogs',o),pickHTML());setHTML(Q('.nur-pkh',o),pickHead());setHTML(Q('.nur-chips',o),chipsHTML())}
function markSel(){const o=ov();if(!o)return;$$('.nur-dog',o).forEach(el=>{const n=el.dataset.id==Z.sel.a?1:el.dataset.id==Z.sel.b?2:0;el.classList.toggle('sel',!!n);const b=$('.bd2',el);if(b)b.textContent=n||''});const k=Q('.nur-dogs',o);if(k)k._h=null;const h=Q('.nur-pkh',o);if(h)h._h=null;setHTML(h,pickHead())}

function pairState(){const a=selDog(1),b=selDog(2);
 if(!S.nur)return{ok:false,msg:TT('Loading the nest…','กำลังโหลดรังไข่…')};
 if(!a||!b)return{ok:false,msg:a||b?TT('Choose one more dog','เลือกหมาอีก 1 ตัวนะ'):TT('Choose 2 dogs to make an egg','เลือกหมา 2 ตัวเพื่อทำไข่'),none:true};
 const c=nurCalc(a,b,env()),o={c,a,b,cost:c.cost};
 for(const d of [a,b]){const w=why(d);if(w)return{...o,ok:false,msg:w.l}}
 if(S.nur.eggs.length>=S.nur.max)return{...o,ok:false,full:true,msg:TT('The nest is full - hatch an egg first (or upgrade your house)','รังไข่เต็มแล้ว ฟักไข่ก่อนนะ (หรืออัปเกรดบ้านเพื่อเพิ่มรัง)')};
 if((S.me.coins|0)<c.cost)return{...o,ok:false,poor:true,msg:TT(`Not enough coins - you need ${c.cost}`,`เหรียญไม่พอ ต้องใช้ ${c.cost}`)};
 return{...o,ok:true,msg:''}}
function alleleChip(id){return`<span class="nur-al"><i style="--c:${RCOL[rOf(id)]}"></i>${esc(bn(id))}</span>`}
function genePair(d){const g=nurAlle(d);return`<span class="nur-gp">${alleleChip(g[0])}<span class="x">+</span>${alleleChip(g[1])}</span>`}
function sil(key,size){return thumbHTML(key,'Normal',size).replace('<canvas','<canvas data-dark="1"')}
function prevHTML(ps){
 const a=selDog(1),b=selDog(2);
 if(!a||!b)return`<div class="nur-pv empty">${eggHTML('C',{mys:1})}<b>${TT('Pick two dogs to preview the egg','เลือกหมา 2 ตัวเพื่อดูตัวอย่างไข่')}</b><small>${TT('You will see the possible breeds, traits, cost and hatch time here.','จะเห็นสายพันธุ์ที่อาจได้ ลักษณะพิเศษ ค่าใช้จ่าย และเวลาฟักตรงนี้')}</small></div>`;
 const c=ps.c||nurCalc(a,b,env());
 const rows=c.rows.slice().sort((x,y)=>y.p-x.p||String(x.ids[0]).localeCompare(String(y.ids[0]))).map(r=>{
  const lead=r.pure?r.ids[0]:r.lead,key=r.pure?lead+'.b':`${lead}+${r.other}~2.b`,nm=r.pure?esc(bn(lead)):`${esc(bn(lead))} × ${esc(bn(r.other))}`,r1=rOf(lead);
  const split=!r.pure&&rOf(r.ids[0])!=rOf(r.ids[1])?r.shares.slice().sort((x,y)=>y.p-x.p).map(s=>`${esc(bn(s.id))} ${pc(s.p)}`).join(' · '):'';
  return`<div class="nur-or"><div class="th">${thumbHTML(key,'Normal',40)}</div><div class="nm"><b>${nm}</b><div class="tg">${rtag(r1)}<span class="nur-tag ${r.pure?'pure':'mix'}">${r.pure?TT('Purebred','สายพันธุ์แท้'):TT('Mixed','พันทาง')}</span></div>${split?`<div class="lead">${TT('Leads the name: ','ชื่อหลัก: ')}${split}</div>`:''}</div><div class="pc">${pc(r.p)}</div><div class="bar3"><i style="width:${Math.max(2,Math.round(r.p*100))}%"></i></div></div>`}).join('');
 const m=c.mut,mrow=m?`<div class="nur-or mut"><div class="th">${sil((m.pool[0]||'corgi')+'.b',40)}</div><div class="nm"><b>✨ ${TT('Mutation!','กลายพันธุ์!')}</b><div class="tg">${rtag(m.rar)}<span class="nur-tag mutt">${TT('Mixed','พันทาง')}</span></div><div class="lead">${TT('One gene jumps to a random breed one rarity higher','ยีนหนึ่งเปลี่ยนเป็นสายพันธุ์สุ่มที่หายากขึ้น 1 ระดับ')}</div></div><div class="pc">${pc(m.p)}</div><div class="bar3"><i style="width:${Math.max(3,Math.round(m.p*100))}%"></i></div></div>`:'';
 const cols=Object.keys(c.eggP).sort((x,y)=>RO[x]-RO[y]),one=cols.length==1;
 const eggs=`<div class="nur-eggs">${cols.map(R=>`<span class="ec">${eggHTML(R,{mini:1})}${one?'':pc(c.eggP[R])+' · '}${nDur(c.time[R])}</span>`).join('')}</div>`;
 const tchips=c.parentTr.length?c.parentTr.map(x=>{const T=TRD.TR[x.id];return`<span class="nur-trn t${T.tier}" title="${esc(trName(T)+': '+trDesc(T))}">${T.e} ${esc(trName(T))} <i>${pc(x.p)}</i></span>`}).join(''):`<span class="nur-ln muted">${TT('Neither parent has a trait to hand down.','พ่อแม่ไม่มีลักษณะพิเศษให้ส่งต่อ')}</span>`;
 const tn=[1,2,3].map(i=>`${esc(TT(TRD.TIER_NAME[i].en,TRD.TIER_NAME[i].th))} ${pc(c.tierP[i-1])}`).join(' · ');
 const rest=V('restH')*36e5/HK();
 return`<div class="nur-pv"><div class="nur-pvh">${eggHTML(cols[cols.length-1],{mini:1})}<span>${TT('Egg preview','ตัวอย่างไข่')}</span></div>
 <div class="nur-genes">${genePair(a)}<span class="nur-ln">♥</span>${genePair(b)}</div>
 <div class="nur-sub">🐣 ${TT('What could hatch','ลูกหมาที่อาจฟักออกมา')}</div>${rows}${mrow}
 <div class="nur-sub">⏱ ${TT('Egg colour & hatch time','สีไข่ & เวลาฟัก')}</div>${eggs}
 ${c.bond>0?`<div class="nur-ln">${ic('heart','sm')} ${TT('Parents bond','ความผูกพัน')} <b>${Math.round(c.bond)}</b>: ${TT(`hatches ${Math.round((1-c.mul)*100)}% faster`,`ฟักเร็วขึ้น ${Math.round((1-c.mul)*100)}%`)}${c.bonus?`, ${TT(`+${Math.round(c.bonus*100)}% new-trait chance`,`โอกาสได้ลักษณะใหม่ +${Math.round(c.bonus*100)}%`)}`:''}</div>`:`<div class="nur-ln muted">${ic('heart','sm')} ${TT('Closer bond = faster hatching and luckier traits','ผูกพันกันมาก = ฟักเร็วขึ้น และมีโอกาสได้ลักษณะพิเศษมากขึ้น')}</div>`}
 <div class="nur-sub">🎀 ${TT('Traits','ลักษณะพิเศษ')}</div><div class="nur-trs">${tchips}</div>
 <div class="nur-ln">✨ ${TT('New trait chance','โอกาสได้ลักษณะใหม่')} <b>${pc(c.newP)}</b> <span class="muted">(${tn})</span><br>${TT('Chance the pup has at least one trait: ','โอกาสที่ลูกหมามีลักษณะพิเศษอย่างน้อย 1 อย่าง: ')}<b>${pc(c.anyP)}</b> · ${TT(`max ${NR.maxTr}`,`ได้สูงสุด ${NR.maxTr}`)}</div>
 <div class="nur-pillrow"><span class="nur-fact ${ps.poor?'bad':''}">${ic('coin','sm')} ${c.cost} <small>(${esc(t(RN[c.costR]))})</small></span><span class="nur-fact">😴 ${TT('Parents rest ','พ่อแม่พัก ')}${nDur(rest)}</span><span class="nur-fact ${ps.full?'bad':''}">🪺 ${S.nur?S.nur.eggs.length:'–'}/${S.nur?S.nur.max:'–'}</span></div></div>`}
function barHTML(ps){
 const go=ps.ok&&!isBusy('p'),c=ps.c;
 const sum=c?`<div class="pr"><span class="${ps.poor?'bad':''}">${ic('coin','sm')} ${ps.cost}</span><span>⏱ ${(()=>{const k=Object.keys(c.eggP).sort((x,y)=>c.time[x]-c.time[y]);return k.length>1&&c.time[k[0]]!=c.time[k[k.length-1]]?nDur(c.time[k[0]])+' – '+nDur(c.time[k[k.length-1]]):nDur(c.time[k[0]])})()}</span></div>`:`<div class="pr muted">🥚 ${TT('No egg yet','ยังไม่มีไข่')}</div>`;
 const w=ps.ok?`<div class="why ok">💞 ${TT('Ready! Parents will rest afterwards.','พร้อมแล้ว! พ่อแม่จะพักหลังวางไข่นะ')}</div>`:`<div class="why">${esc(ps.msg||'')}</div>`;
 return`<div class="sum">${sum}${w}</div><button class="btn pink ${ps.ok?'':'nur-off'} ${isBusy('p')?'busy':''}" data-do="nurpair">💞 ${isBusy('p')?TT('Laying…','กำลังวางไข่…'):TT('Lay egg','จับคู่ & วางไข่')}</button>`}
function renderSide(){const o=ov();if(!o)return;
 let drop=false;for(const n of [1,2]){const k=n==1?'a':'b',id=Z.sel[k];if(id!=null&&Array.isArray(S.allDogs)){const d=byId(id);if(!d||why(d)){Z.sel[k]=null;drop=true}}}
 if(Z.sel.a!=null&&Z.sel.a==Z.sel.b){Z.sel.b=null;drop=true}if(drop)markSel();
 const ps=pairState();
 setHTML(Q('.nur-slots',o),slotsHTML());setHTML(Q('.nur-prev',o),prevHTML(ps));setHTML(Q('.nur-bar',o),barHTML(ps));
 const mid=Q('.nur-mid',o);if(mid)mid.classList.toggle('on',!!(selDog(1)&&selDog(2)));const br=Q('.nur-bar',o);if(br)br.classList.toggle('idle',!selDog(1)&&!selDog(2))}

// ===================================================================== breeding guide
function guideHTML(){
 const cost=V('cost'),hh=V('hatchH'),TRS=TRD.TRAITS,tier=i=>TRS.filter(x=>x.tier==i).map(x=>`<div class="r"><span>${x.e}</span><div><b>${esc(trName(x))}</b><small>${esc(trDesc(x))}</small></div></div>`).join(''),
  tn=i=>TT(TRD.TIER_NAME[i].en,TRD.TIER_NAME[i].th),tcol={1:'#6fd1a5',2:'#b79bff',3:'#ffc94d'};
 const stg=TRD.STAGES.map((s,i)=>`<span class="st ${i==3?'ad':''}">${s.e} ${esc(TT(s.en,s.th))}${i<3?` <small>&lt;${TRD.STAGE_H[i]} ${TT('h','ชม.')}</small>`:''}</span>`).join('<span>→</span>');
 const rowsT=RL.map(r=>`<tr><td>${rtag(r)}</td><td>${ic('coin','sm')} ${cost[r]}</td><td>${nDur(hh[r]*36e5/HK())}</td></tr>`).join('');
 return`<summary>📘 ${TT('Breeding guide','คู่มือการผสมพันธุ์')}</summary><div class="nur-gb">
 <div class="nur-gc wide"><h4>🥚 ${TT('How it works','ทำงานยังไง')}</h4><div class="nur-steps"><div><span>🐶🐶</span>${TT('Choose two grown-up dogs','เลือกหมาโตเต็มวัย 2 ตัว')}</div><div><span>💰</span>${TT('Pay the fee - an egg appears in your nest','จ่ายค่าผสมพันธุ์ ไข่จะมาอยู่ในรัง')}</div><div><span>🐣</span>${TT('Wait (or speed up with gems), then hatch it!','รอให้ฟัก (หรือเร่งด้วยเพชร) แล้วกดฟักเลย!')}</div></div></div>
 <div class="nur-gc"><h4>🧬 ${TT('Purebred & mixed (พันทาง)','สายพันธุ์แท้ & พันทาง')}</h4>
 <p>${TT('Every dog has two breed genes. Each parent gives one gene to the egg.','น้องหมาทุกตัวมียีนสายพันธุ์ 2 ชุด พ่อแม่แต่ละตัวส่งต่อให้ไข่ตัวละ 1 ชุด')}</p>
 <p>🟢 ${TT('Same gene twice → <b>Purebred</b>.','ยีนเหมือนกัน 2 ชุด → <b>สายพันธุ์แท้</b>')}</p>
 <p>🟣 ${TT('Two different genes → <b>Mixed breed (พันทาง)</b>: it shows both looks. The rarer gene is a bit more likely to lead the name (Husky × Corgi or Corgi × Husky).','ยีนต่างกัน → <b>พันทาง</b> หน้าตาผสมทั้งสองสายพันธุ์ และยีนที่หายากกว่ามีโอกาสเป็นชื่อหลักมากกว่านิดหน่อย (เช่น Husky × Corgi กับ Corgi × Husky)')}</p>
 <p>✨ ${TT(`About ${pc(NR.mut)} of eggs <b>mutate</b>: one gene turns into a random breed one rarity higher!`,`มีไข่ราว ${pc(NR.mut)} ที่ <b>กลายพันธุ์</b> ยีนหนึ่งเปลี่ยนเป็นสายพันธุ์สุ่มที่หายากขึ้น 1 ระดับ!`)}</p>
 <p>🎨 ${TT(`Coat colour comes from a parent - with a ${pc(NR.coat)} chance of a surprise colour.`,`สีขนมาจากพ่อแม่ และมีโอกาส ${pc(NR.coat)} ที่จะได้สีพิเศษแบบเซอร์ไพรส์`)}</p>
 <p>🥚 ${TT('The egg colour shows how rare the top breed is - rarer eggs take longer to hatch.','สีไข่บอกความหายากของสายพันธุ์สูงสุด ไข่ยิ่งหายากยิ่งฟักนาน')}</p></div>
 <div class="nur-gc"><h4>🎀 ${TT('Traits','ลักษณะพิเศษ')}</h4>
 <p>${TT(`Traits are little marks and accessories with small bonuses. A dog keeps at most ${NR.maxTr}.`,`ลักษณะพิเศษคือรอยและเครื่องประดับน่ารัก ๆ ที่ให้โบนัสเล็กน้อย หมา 1 ตัวมีได้สูงสุด ${NR.maxTr} อย่าง`)}</p>
 <p>👪 ${TT(`Each trait a parent has: ${pc(NR.inh)} chance to be passed on (a trait both parents have: ${pc(1-Math.pow(1-NR.inh,2))}).`,`ลักษณะที่พ่อแม่มี มีโอกาส ${pc(NR.inh)} ที่จะส่งต่อให้ลูก (ถ้าพ่อแม่มีเหมือนกันทั้งคู่ ${pc(1-Math.pow(1-NR.inh,2))})`)}</p>
 <p>🌟 ${TT(`A brand-new trait can appear: ${pc(NR.newPure)} for purebred pups, ${pc(NR.newMix)} for mixed pups!`,`ลักษณะใหม่เอี่ยมก็เกิดได้: ลูกสายพันธุ์แท้ ${pc(NR.newPure)} ลูกพันทาง ${pc(NR.newMix)}!`)}</p>
 <p>💞 ${TT(`Parents with a close bond help: +${pc(NR.b1p)} at bond ${NR.b1}+, +${pc(NR.b2p)} at bond ${NR.b2}+ (and rarer traits show up more often). They also hatch up to ${pc(NR.dec)} faster.`,`พ่อแม่ที่ผูกพันกันช่วยได้: Bond ${NR.b1}+ เพิ่ม ${pc(NR.b1p)}, Bond ${NR.b2}+ เพิ่ม ${pc(NR.b2p)} (และเจอลักษณะหายากบ่อยขึ้น) แถมไข่ฟักเร็วขึ้นสูงสุด ${pc(NR.dec)}`)}</p></div>
 <div class="nur-gc"><h4>🍼 ${TT('Who can breed?','ใครผสมพันธุ์ได้บ้าง?')}</h4>
 <div class="nur-stages">${stg}</div>
 <p>${TT('Only <b>grown-up</b> dogs can breed. Baby, puppy and teen dogs must grow first, and premium breeds cannot breed.','ผสมพันธุ์ได้เฉพาะหมา<b>โตเต็มวัย</b> เบบี๋ ลูกหมา และวัยรุ่นต้องรอโตก่อน และสายพันธุ์พรีเมียมผสมพันธุ์ไม่ได้')}</p>
 <p>😴 ${TT(`After laying an egg both parents rest for ${nDur(V('restH')*36e5/HK())}.`,`หลังวางไข่ พ่อแม่ทั้งสองตัวจะพัก ${nDur(V('restH')*36e5/HK())}`)}</p>
 <p>🪺 ${TT('Nests = 2 + your house level.','จำนวนรังไข่ = 2 + เลเวลบ้าน')} 🏠 ${TT(`You can own up to ${maxDogs()} dogs - ready eggs wait when you are full.`,`เก็บหมาได้สูงสุด ${maxDogs()} ตัว ถ้าเต็มไข่ที่พร้อมจะรอไว้ก่อน`)}</p></div>
 <div class="nur-gc"><h4>💰 ${TT('Fees & hatch times','ค่าผสมพันธุ์ & เวลาฟัก')}</h4>
 <table class="nur-tbl"><tr><th>${TT('Rarity','ความหายาก')}</th><th>${TT('Fee','ค่าผสม')}</th><th>${TT('Hatch','เวลาฟัก')}</th></tr>${rowsT}</table>
 <p>${TT('The fee follows the rarest breed gene of the two parents; the hatch time follows the egg colour.','ค่าผสมดูจากยีนที่หายากที่สุดของพ่อแม่ ส่วนเวลาฟักดูจากสีไข่')}</p>
 <p>⚡ ${TT('Speed up: 1 gem per 15 minutes left (at most 24 gems).','เร่งเวลา: 1 เพชรต่อ 15 นาทีที่เหลือ (สูงสุด 24 เพชร)')}</p></div>
 <div class="nur-gc wide"><h4>🎀 ${TT('All traits','ลักษณะพิเศษทั้งหมด')} (${TRS.length})</h4>
 ${[1,2,3].map(i=>`<div class="nur-tier"><i style="background:${tcol[i]}"></i>${esc(tn(i))}</div><div class="nur-trl">${tier(i)}</div>`).join('')}</div></div>`}

// ===================================================================== the window
const queueF={nest:0,side:0,pick:0};
function queue(k){if(k)for(const x of k.split(','))queueF[x]=1;if(Z.timer)return;Z.timer=setTimeout(flush,30)}
function flush(){clearTimeout(Z.timer);Z.timer=0;if(!ov()){queueF.nest=queueF.side=queueF.pick=0;return}
 if(queueF.pick){renderPicker();queueF.side=1}
 if(queueF.nest||queueF.bar)renderNest();
 if(queueF.side||queueF.nest||queueF.bar||queueF.me)renderSide();
 queueF.nest=queueF.side=queueF.pick=0;queueF.bar=0;queueF.me=0}
function shell(){return`<div class="nur">
 <section class="nur-sec nur-nestsec"><div class="nur-h"><b>🪺 ${TT('Nest','รังไข่')}</b><span class="pill" data-ncount>–</span><span class="nur-hint">${TT('The egg colour hints how rare the babies can be','สีของไข่บอกใบ้ว่าลูกหมาจะหายากแค่ไหน')}</span></div><div class="nur-nest"></div><div class="nur-warn"></div></section>
 <section class="nur-sec nur-pairsec" data-pairsec><div class="nur-h"><b>💞 ${TT('New pair','จับคู่ใหม่')}</b><span class="nur-hint">${TT('Pick two grown-up dogs - each gives one breed gene to the egg','เลือกหมาโตเต็มวัย 2 ตัว แต่ละตัวส่งยีนสายพันธุ์ให้ไข่ตัวละ 1 ชุด')}</span></div>
  <div class="nur-pg">
   <div class="nur-pk"><div class="nur-pkh"></div><div class="nur-filt"><input class="nur-q" type="search" maxlength="30" autocomplete="off" placeholder="🔍 ${esc(TT('Search name or breed…','ค้นหาชื่อหรือสายพันธุ์…'))}" value="${esc(Z.q)}"><div class="nur-chips"></div></div><div class="nur-dogs"></div></div>
   <div class="nur-side"><div class="nur-slots"></div><div class="nur-prev"></div><div class="nur-bar"></div></div></div></section>
 <details class="nur-guide"></details></div>`}
function nurOpen(fresh){
 Z.loadT=Date.now();send({t:'nur_get'});send({t:'dogs_get'});
 let o=modOpen(NU);
 if(!o){o=modal(NU,'🧬 '+TT('Dog Nursery','บ้านเลี้ยงลูกหมา'),shell(),'lg nurm');
  const g=$('.nur-guide',o);g.innerHTML=guideHTML();
  o.addEventListener('input',e=>{if(e.target.classList.contains('nur-q')){Z.q=e.target.value;renderPicker()}});
  o.addEventListener('close',()=>{unlock()});
  clearTimeout(Z.rt);Z.rt=setTimeout(()=>{if(ov()&&!S.nur)renderNest()},5200)}
 queue('nest,side,pick');flush();
 return o}
DO.nursery=()=>{nurOpen()};
DO.nurretry=()=>{Z.loadT=Date.now();send({t:'nur_get'});send({t:'dogs_get'});renderNest();clearTimeout(Z.rt);Z.rt=setTimeout(()=>{if(ov()&&!S.nur)renderNest()},5200)};
// "breed this dog": the dog profile calls it with data-id; the nursery opens with that dog as parent 1
DO.nurpick=d=>{const id=d&&d.id!=null?String(d.id):'';Z.sel={a:null,b:null,act:1};Z.pre=id||null;nurOpen();applyPre()};
function applyPre(){if(!Z.pre)return;if(!Array.isArray(S.allDogs))return;const id=Z.pre;Z.pre=null;const d=byId(id);if(!d)return;
 const w=why(d);if(w){toast(w.l);sfx('err');return}Z.sel={a:d.id,b:null,act:2};queue('side,pick')}
DO.nurgo=()=>{const o=ov();if(!o)return;const s=Q('[data-pairsec]',o);if(s)s.scrollIntoView({behavior:'smooth',block:'start'});const i=Q('.nur-q',o);if(i&&!matchMedia('(pointer:coarse)').matches)i.focus({preventScroll:true})};
DO.nurslot=d=>{const n=+d.s==2?2:1;Z.sel.act=n;queue('side');renderPicker()};
DO.nurclr=(d,el,e)=>{e&&e.stopPropagation&&e.stopPropagation();const n=+d.s==2?2:1;Z.sel[n==1?'a':'b']=null;Z.sel.act=n;markSel();queue('side')};
DO.nurflt=d=>{Z.rf=[...RL,'all'].includes(d.k)?d.k:'all';renderPicker()};
DO.nuronly=()=>{Z.only=!Z.only;renderPicker()};
DO.nurdog=d=>{const dog=byId(d.id);if(!dog)return;const id=dog.id,w=why(dog);
 if(Z.sel.a!=null&&String(Z.sel.a)==String(id)){Z.sel.a=null;Z.sel.act=1}
 else if(Z.sel.b!=null&&String(Z.sel.b)==String(id)){Z.sel.b=null;Z.sel.act=2}
 else{if(w){toast(w.l);sfx('err');return}
  let n=Z.sel.act==2?2:1;if(Z.sel[n==1?'a':'b']!=null&&Z.sel[n==1?'b':'a']==null)n=3-n;
  Z.sel[n==1?'a':'b']=id;Z.sel.act=Z.sel.a==null?1:Z.sel.b==null?2:3-n;sfx('pop')}
 markSel();queue('side')};
DO.nurpair=()=>{const ps=pairState();
 if(!ps.ok){if(isBusy('p'))return;toast(ps.msg||'…');sfx('err');return}
 const go=()=>{const s=pairState();if(!s.ok||!lock('p',1600))return;send({t:'nur_pair',a:String(Z.sel.a),b:String(Z.sel.b)})};
 if(ps.cost>=600)ask(TT(`Pair ${esc(ps.a.name)} and ${esc(ps.b.name)}?\nThe fee is ${ps.cost} coins.`,`จับคู่ ${esc(ps.a.name)} กับ ${esc(ps.b.name)} ไหม?\nค่าผสมพันธุ์ ${ps.cost} เหรียญ`),go,{yes:'💞 '+TT('Lay egg','จับคู่ & วางไข่'),title:'💞 '+TT('Lay an egg','วางไข่'),cls:'pink'});else go()};
DO.nurhatch=d=>{const e=eggOf(d.id);if(!e)return;
 if(remain(e)>0){toast(TT('Not ready yet - a little more waiting 🥚','ไข่ยังไม่ฟัก รออีกนิดนะ 🥚'));sfx('err');return}
 if((S.me.total|0)>=maxDogs()){toast(TT(`Your dog storage is full (${maxDogs()}). Sell or release a dog first.`,`ที่เก็บหมาเต็มแล้ว (${maxDogs()} ตัว) ขายหรือปล่อยบางตัวก่อนนะ`));sfx('err');return}
 if(!lock('h'+e.id,2500))return;send({t:'nur_hatch',id:String(e.id)})};
DO.nurfast=d=>{const e=eggOf(d.id);if(!e||remain(e)<=0)return;const g=fastCost(e);
 if((S.me.gems|0)<g){toast(TT(`Not enough gems - you need ${g} 💎`,`เพชรไม่พอ ต้องใช้ ${g} 💎`));sfx('err');return}
 ask(TT(`Speed up this egg for ${g} gems?\nIt hatches right away.`,`ใช้ ${g} เพชรเร่งเวลา?\nไข่จะฟักได้ทันที`),()=>{const e2=eggOf(d.id);if(!e2||remain(e2)<=0)return;if(!lock('f'+e2.id,1500))return;send({t:'nur_fast',id:String(e2.id)})},{yes:`⚡ ${g} 💎`,title:'⚡ '+TT('Speed up','เร่งเวลา'),cls:'sky'})};

// ===================================================================== server messages
H.nur=m=>{if(!m||!Array.isArray(m.eggs))return;
 const eggs=m.eggs.slice(0,24).filter(e=>e&&typeof e=='object').map(e=>({id:String(e.id),rar:own(RO,e.rar)?e.rar:'C',left:Math.max(0,+e.left||0),total:Math.max(1,+e.total||1),pa:e.pa&&typeof e.pa=='object'?e.pa:{},pb:e.pb&&typeof e.pb=='object'?e.pb:{},cm:+e.cm||0}));
 const old=Z.ids;Z.ids=new Set(eggs.map(e=>e.id));Z.fresh=new Set(old?eggs.filter(e=>!old.has(e.id)).map(e=>e.id):[]);
 S.nur={max:Math.min(12,Math.max(1,Math.floor(+m.max)||2)),eggs,at:Date.now(),now:+m.now||0};unlock('f');unlock('h');
 if(Z.fresh.size)setTimeout(()=>{Z.fresh.clear()},900);
 queue('nest,side')};
H.nur_ok=()=>{unlock('p');sfx('ok');toast('🥚 '+TT('An egg is in the nest! The parents are resting now.','มีไข่ใบใหม่ในรังแล้ว! พ่อแม่ขอพักผ่อนก่อนนะ'));Z.sel={a:null,b:null,act:1};
 const o=ov();if(o){const s=Q('.nur-nestsec',o);if(s)s.scrollIntoView({behavior:'smooth',block:'nearest'})}queue('nest,side,pick')};
H.nur_hatched=m=>{unlock('h');unlock('f');if(!m||!m.dog||typeof m.dog!='object')return;{const nb=Object.assign({},m.dog,{born:Date.now()+(S.skew||0)});setTimeout(()=>window.Bark&&Bark.say('pup',nb,true),1100)}
 const d=m.dog,pa=m.pa&&typeof m.pa=='object'?m.pa:{},pb=m.pb&&typeof m.pb=='object'?m.pb:{},isNew=!!d.breed&&Array.isArray(S.me.owned)&&!S.me.owned.includes(d.breed);
 const info={src:'nursery',mixed:!!m.mixed,mut:!!m.mut,pa:pa.b||null,pb:pb.b||null,pan:pa.n||'',pbn:pb.n||'',r:m.r,isNew,onClose:()=>queue('nest,side,pick')};
 queue('nest,side,pick');
 if(typeof Egg!='undefined'&&Egg&&typeof Egg.reveal=='function'){try{Egg.reveal(d,info);return}catch(e){if(window.DEBUG)console.log('Egg.reveal failed',e)}}
 resultModal(d,info)};
function resultModal(d,i){
 const r=own(RO,i.r)?i.r:rOf(d.breed),tr=trList(d),mixed=!!i.mixed||TRD.isMixed(d),nm=DOGS.nm(d),conf=Array.from({length:12},(_,k)=>`<i style="left:${4+k*8}%;animation-delay:${(k*.27)%2.4}s">${['💖','✨','🌟','💗'][k%4]}</i>`).join('');
 sfx('reveal',r);
 const body=`<div class="nur-res r-${r}"><div class="nur-conf">${conf}</div><div class="burst"></div>${i.isNew?`<div class="rb">🆕 ${TT('NEW breed!','สายพันธุ์ใหม่!')}</div>`:''}
 <div class="pic">${thumbHTML(DOGS.k(d),d.variant,75,d.acc)}</div><h3>${esc(d.name)}</h3><div class="bn">${esc(nm)}</div>
 <div class="tags">${rtag(r)}<span class="nur-tag ${mixed?'mix':'pure'}">${mixed?TT('Mixed (พันทาง)','พันทาง (ลูกผสม)'):TT('Purebred','สายพันธุ์แท้')}</span><span class="nur-tag">🍼 ${TT('Baby','เบบี๋')}</span>${d.variant&&d.variant!='Normal'?`<span class="nur-tag mutt">🎨 ${esc(t(d.variant))}</span>`:''}</div>
 ${i.mut?`<div class="mutb">✨ ${TT('Mutation! One of the genes jumped up a rarity!','กลายพันธุ์! ยีนหนึ่งเปลี่ยนเป็นสายพันธุ์ที่หายากขึ้น!')} ✨</div>`:''}
 ${tr.length?`<div class="trl">${tr.map(id=>{const T=TRD.TR[id];return`<div class="tri"><span>${T.e}</span><div><b>${esc(trName(T))} <small style="display:inline">· ${esc(TT(TRD.TIER_NAME[T.tier].en,TRD.TIER_NAME[T.tier].th))}</small></b><small>${esc(trDesc(T))}</small></div></div>`}).join('')}</div>`:`<div class="par">${TT('No traits this time - maybe next egg!','รอบนี้ยังไม่มีลักษณะพิเศษ ไข่ใบหน้าอาจได้นะ!')}</div>`}
 ${i.pan||i.pbn?`<div class="par">💞 ${esc(i.pan||'?')} ♥ ${esc(i.pbn||'?')}</div>`:''}
 <div class="acts"><button class="btn ghost" data-do="dogprof" data-id="${esc(d.id)}">ℹ️ ${TT('Profile','ข้อมูล')}</button><button class="btn pink" data-do="closemod" data-id="nurres">💖 ${TT('Yay!','เย้!')}</button></div></div>`;
 const o=modal('nurres','🐣 '+TT('A new puppy!','ลูกหมาตัวใหม่!'),body,'sm nurres');paintThumbs(o);o.addEventListener('close',()=>{try{i.onClose&&i.onClose()}catch{}})}

// ===================================================================== hooks that need no change in shared files
// my dogs list arrives as S.allDogs (set by H.dogs_all in main.js): watch it so the picker follows (rest times, new dogs, cost changes).
{const pd=Object.getOwnPropertyDescriptor(S,'allDogs');let v=pd&&'value' in pd?pd.value:undefined;
 Object.defineProperty(S,'allDogs',{configurable:true,enumerable:true,get(){return pd&&pd.get?pd.get.call(S):v},set(x){if(pd&&pd.set)pd.set.call(S,x);else v=x;S.allDogsAt=Date.now();if(ov()){applyPre();queue('pick,side,nest')}else if(Z.pre)applyPre()}})}
// every "me" update (coins, gems, dog count) re-checks the buttons that depend on money
{const _cur=UI.cur;UI.cur=function(){const r=_cur.apply(this,arguments);if(ov())queue('me,nest');return r}}
// one-second heartbeat: countdowns, progress rings, "almost ready" wobble, ready flip, rest labels. Nothing is re-rendered unless something really changed.
setInterval(()=>{const o=ov();if(!o||!S.nur)return;let flip=false;
 $$('.nur-slot[data-id]',o).forEach(el=>{const e=eggOf(el.dataset.id);if(!e)return;const rem=remain(e),rdy=rem<=0;if(rdy!=el.classList.contains('rdy')){flip=true;return}
  if(!rdy){const cd=$('[data-cd]',el),tx=clock(rem);if(cd&&cd.textContent!=tx)cd.textContent=tx;const pg=$('.pg',el);if(pg)pg.setAttribute('stroke-dashoffset',(RC2*Math.max(0,Math.min(1,rem/Math.max(1,e.total)))).toFixed(2));
   el.classList.toggle('wob',rem<=Math.min(3e5,Math.max(45e3,e.total*.07)))}});
 if(flip){renderNest();renderSide();sfx('notify')}
 let free=false;$$('[data-rest]',o).forEach(el=>{const d=byId(el.dataset.rest);if(!d)return;const w=why(d);if(!w||w.k!='rest'){free=true;return}if(el.textContent!=w.s)el.textContent=w.s});
 if(free){renderPicker();renderSide()}
 const g=S.me.gems|0;$$('.nur-slot[data-id] [data-do=nurfast]',o).forEach(b=>{const e=eggOf(b.dataset.id);if(!e)return;const c=fastCost(e),n=$('[data-g]',b);if(n&&n.textContent!=String(c))n.textContent=c;b.classList.toggle('nur-off',g<c)})
},1000);
setInterval(()=>{if(ov()&&!document.hidden){send({t:'nur_get'});send({t:'dogs_get'})}},45000);      // keeps a window that stays open for a long time honest (reconnects, other devices)
window.NURSERY={calc:nurCalc,rules:NR,env,eggHTML,why,state:Z};
})();
