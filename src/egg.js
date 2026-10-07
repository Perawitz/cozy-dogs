// Cozy Dogs v7 - EGG reveal. One place that knows how an egg wobbles, cracks and shows the new puppy.
//   Egg.eggsHTML(list)            wobbling eggs (list of {r}) for the gacha screen             Egg.crack(el) / Egg.cardsHTML(list)  the cracked state + the result cards
//   Egg.reveal(dog,info)          stand-alone full-screen hatch for ONE dog (nursery hatch, shop gift)  info = {src:'nursery'|'shop'|'gacha', mixed, mut, pa, pb, pan, pbn, r, isNew, onClose}
// The egg art itself (CSS) lives in src/nursery.js (NURSERY.eggHTML); this file only animates it.
'use strict';
const Egg=(()=>{
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 const rOf=(d,i)=>(i&&typeof i.r=='string'&&own(RCOL,i.r)&&i.r)||(d&&(d.r&&own(RCOL,d.r)?d.r:DOGS.BR[d.breed]&&DOGS.BR[d.breed].r))||'C';
 const eggHTML=(r,o)=>window.NURSERY&&NURSERY.eggHTML?NURSERY.eggHTML(r,o):'<span class="eg-fb">🥚</span>';
 const srv=()=>Date.now()+(S.skew||0);
 function dur(ms){const h=Math.max(0,ms)/36e5;if(h<1)return Math.max(1,Math.round(h*60))+TT(' min',' นาที');if(h<48)return Math.round(h)+TT(' h',' ชม.');return Math.round(h/24)+TT(' days',' วัน')}
 const trChips=d=>TRD.cleanTraits(d&&d.tr).map(id=>{const T=TRD.TR[id];return`<span class="eg-tr t${T.tier}" title="${esc(TT(T.en,T.th))}">${T.e}</span>`}).join('');
 const stageOfD=d=>Number.isFinite(d&&d.born)?TRD.stageOf(d.born,srv(),S.gk||1):3;

 // ---- the eggs (gacha screen). list = [{r}]
 function eggsHTML(list){const one=list.length==1;
  return`<div class="eg-eggs ${one?'one':'many'}">${list.map((x,i)=>`<div class="eg-eggw" style="animation-delay:${(i%5)*.07}s">${eggHTML(rOf(null,x))}${rOf(null,x)!='C'?'<i class="eg-sp a">✨</i><i class="eg-sp b">✨</i>':''}</div>`).join('')}</div>`}
 // "about to hatch": stronger shaking and the crack line appears
 function crack(root){$$('.eg-eggw',root).forEach(e=>{e.classList.add('rdy','crk')})}
 function flash(){const f=document.createElement('div');f.className='eg-flash';document.body.append(f);setTimeout(()=>f.remove(),700)}

 // ---- result cards
 function big(d,i){i=i||{};const r=rOf(d,i),mixed=!!i.mixed||TRD.isMixed(d),tr=TRD.cleanTraits(d.tr),st=stageOfD(d),SG=TRD.STAGES[st],left=TRD.nextIn(d.born,srv(),S.gk||1),
   conf=Array.from({length:12},(_,k)=>`<i style="left:${4+k*8}%;animation-delay:${(k*.27)%2.4}s">${['💖','✨','🌟','💗'][k%4]}</i>`).join('');
  return`<div class="nur-res eg-res r-${r}"><div class="nur-conf">${conf}</div><div class="burst"></div>${i.isNew?`<div class="rb">🆕 ${TT('NEW breed!','สายพันธุ์ใหม่!')}</div>`:''}
   <div class="pic">${thumbHTML(DOGS.k(d),d.variant,75,d.acc)}</div><h3>${esc(d.name)}</h3><div class="bn">${esc(DOGS.nm(d))}</div>
   <div class="tags">${rarTag(r)}<span class="nur-tag ${mixed?'mix':'pure'}">${mixed?TT('Mixed (พันทาง)','พันทาง (ลูกผสม)'):TT('Purebred','สายพันธุ์แท้')}</span><span class="nur-tag">${SG.e} ${TT(SG.en,SG.th)}</span>${d.variant&&d.variant!='Normal'?`<span class="nur-tag mutt">🎨 ${esc(t(d.variant))}</span>`:''}${d.away?`<span class="nur-tag">🏠 ${TT('house full','บ้านเต็ม')}</span>`:''}</div>
   ${i.mut?`<div class="mutb">✨ ${TT('Mutation! One of the genes jumped up a rarity!','กลายพันธุ์! ยีนหนึ่งเปลี่ยนเป็นสายพันธุ์ที่หายากขึ้น!')} ✨</div>`:''}
   ${tr.length?`<div class="trl">${tr.map(id=>{const T=TRD.TR[id];return`<div class="tri"><span>${T.e}</span><div><b>${esc(TT(T.en,T.th))} <small style="display:inline">· ${esc(TT(TRD.TIER_NAME[T.tier].en,TRD.TIER_NAME[T.tier].th))}</small></b><small>${esc(TT(T.den,T.dth))}</small></div></div>`}).join('')}</div>`:`<div class="par">${TT('No special trait this time','รอบนี้ยังไม่มีลักษณะพิเศษ')}</div>`}
   ${st<3&&left>0?`<div class="par">🌱 ${TT('Grows up in about '+dur(left),'โตเต็มวัยในอีกประมาณ '+dur(left))}</div>`:''}
   ${i.pan||i.pbn?`<div class="par">💞 ${esc(i.pan||'?')} ♥ ${esc(i.pbn||'?')}</div>`:''}</div>`}
 // small card for the 10-pull grid
 function mini(r,nw,delay){const b=DOGS.b(r)||DOGS.BR[r.breed]||{r:'C',name:String(r.breed)},rr=rOf(r),st=stageOfD(r),mixed=TRD.isMixed(r);
  return`<div class="panel rcard r-${rr} eg-mini" style="border-color:${RCOL[rr]};width:auto;animation-delay:${delay||0}s">${rr!='C'?'<div class="glow"></div>':''}<div style="position:relative">${nw?`<span class="tag eg-new">${TT('NEW!','ใหม่!')}</span>`:''}${thumbHTML(DOGS.k(r),r.variant,42,null)}<h3>${esc(r.name)}</h3><div>${rarTag(rr)}</div>
   <div class="muted">${esc(b.name)}${r.variant&&r.variant!='Normal'?' · '+t(r.variant):''}${r.away?' · 🏠 '+TT('full','บ้านเต็ม'):''}</div><div class="eg-line">${TRD.STAGES[st].e}${trChips(r)}</div></div></div>`}

 // ---- stand-alone reveal (nursery / shop)
 let cur=null;
 function reveal(d,info){info=info||{};if(!d||typeof d!='object')return;if(cur)cur.finish(true);
  const r=rOf(d,info),shop=info.src=='shop',ov=document.createElement('div');ov.className='reveal eg-ov';document.body.append(ov);if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();
  let done=false,shown=false,tm=[];
  const key=e=>{if(!shown)return;if(e.key=='Enter'||e.key==' '||e.key=='Escape'){e.preventDefault();e.stopPropagation();close()}};
  const close=()=>{if(done)return;done=true;tm.forEach(clearTimeout);document.removeEventListener('keydown',key,true);ov.remove();cur=null;try{info.onClose&&info.onClose()}catch(e){}};
  const showCard=()=>{if(shown||done)return;shown=true;tm.forEach(clearTimeout);flash();sfx('reveal',r);
   ov.innerHTML=`<div class="panel eg-box">${big(d,info)}<div class="acts eg-acts"><button class="btn ghost" data-do="dogprof" data-id="${esc(d.id)}">ℹ️ ${TT('Profile','ข้อมูล')}</button><button class="btn pink rclose">💖 ${TT('Yay!','เย้!')}</button></div></div>`;
   paintThumbs(ov);$('.rclose',ov).onclick=close;if(r!='C'&&typeof sparkle=='function')sparkle(400,300,0)};
  document.addEventListener('keydown',key,true);
  if(shop){ov.innerHTML=`<div class="eg-gift"><span class="g1">🎁</span><small>${TT('Your new friend is arriving…','เพื่อนใหม่กำลังมา…')}</small></div>`;sfx('shake');tm.push(setTimeout(()=>{const g=$('.eg-gift',ov);if(g)g.classList.add('open')},700),setTimeout(showCard,1300))}
  else{ov.innerHTML=`<div class="eg-stage">${eggsHTML([{r}])}<small class="eg-hint">${TT('Tap to skip','แตะเพื่อข้าม')}</small></div>`;sfx('shake');
   tm.push(setTimeout(()=>{crack(ov);sfx('shake')},1000),setTimeout(showCard,1650))}
  ov.addEventListener('click',e=>{if(!shown&&e.target.closest('.eg-stage,.eg-gift,.eg-ov'))showCard()});
  cur={finish:q=>{if(!done){done=true;tm.forEach(clearTimeout);document.removeEventListener('keydown',key,true);ov.remove();cur=null;if(!q)try{info.onClose&&info.onClose()}catch(e){}}}};
  return ov}
 return{reveal,eggsHTML,crack,flash,big,mini,trChips,dur,eggHTML}
})();
