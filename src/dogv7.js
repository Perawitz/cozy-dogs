// Cozy Dogs v7 - what a dog looks like in the lists / cards / profile now: growth stage, mixed breed, cute traits, crown,
// the Growth Candy button and the shortcuts to breeding / selling. Also the 👑 Premium section of the Collection.
'use strict';
const DV=(()=>{
 const srv=()=>Date.now()+(S.skew||0),gk=()=>S.gk||1;
 const stageOf=d=>Number.isFinite(d&&d.born)?TRD.stageOf(d.born,srv(),gk()):3;
 function dur(ms){const h=Math.max(0,ms)/36e5;if(h<1)return Math.max(1,Math.round(h*60))+TT(' min',' นาที');if(h<48){const H=Math.floor(h),m=Math.round((h-H)*60);return H+TT(' h',' ชม.')+(m&&H<10?' '+m+TT(' min',' นาที'):'')}return Math.round(h/24)+TT(' days',' วัน')}
 const tr=d=>TRD.cleanTraits(d&&d.tr);
 // small chips: [stage] [mixed] [traits] [crown]
 function badges(d,o){o=o||{};const s=stageOf(d),SG=TRD.STAGES[s],a=[];
  if(s<3)a.push(`<span class="dv-chip st${s}">${SG.e} ${TT(SG.en,SG.th)}</span>`);
  if(TRD.isMixed(d))a.push(`<span class="dv-chip mix">🧬 ${TT('Mixed','พันทาง')}</span>`);
  for(const id of tr(d)){const T=TRD.TR[id];a.push(`<span class="dv-chip t${T.tier}" title="${esc(TT(T.den,T.dth))}">${T.e}${o.names?' '+esc(TT(T.en,T.th)):''}</span>`)}
  if(d.cr)a.push(`<span class="dv-chip crown">👑</span>`);
  return a.join('')}
 // the big block in the dog profile
 function panel(d,own){const s=stageOf(d),R=DOGS.BR[d.breed]||{},prem=!!R.pm,mixed=TRD.isMixed(d),T=tr(d),[A,B]=TRD.alleles(d),nmOf=id=>DOGS.raw[id]?DOGS.raw[id].name:String(id);
  let prog='';if(s<3){const left=TRD.nextIn(d.born,srv(),gk()),span=(TRD.STAGE_H[s]-(s?TRD.STAGE_H[s-1]:0))*TRD.HOUR/gk(),pct=Math.max(2,Math.min(100,Math.round((1-left/Math.max(1,span))*100))),nx=TRD.STAGES[s+1];
   prog=`<div class="dv-prog"><div class="prog"><i style="width:${pct}%;background:linear-gradient(#b7f0c9,#6fd1a5)"></i></div><small>🌱 ${TT('Becomes a '+nx.en.toLowerCase()+' in '+dur(left),'จะเป็น'+nx.th+'ในอีก '+dur(left))}</small></div>`}
  const stages=TRD.STAGES.map((g,i)=>`<span class="dv-s ${i<s?'done':i==s?'now':''}"><b>${g.e}</b><small>${TT(g.en,g.th)}</small></span>`).join('<i class="dv-ar">›</i>');
  const gene=prem?`<div class="dv-row"><b>🧬</b><span>👑 ${TT('Premium breed - cannot be bred','สายพันธุ์พรีเมียม — ผสมพันธุ์ไม่ได้')}</span></div>`
   :`<div class="dv-row"><b>🧬</b><span>${mixed?`<em class="mx">${TT('Mixed breed (พันทาง)','พันทาง (ลูกผสม)')}</em> · ${TT('looks like','เด่น')} <b>${esc(nmOf(A))}</b> + ${TT('hidden','แฝง')} <b>${esc(nmOf(B))}</b>`:`<em class="pu">${TT('Purebred','สายพันธุ์แท้')}</em> · <b>${esc(nmOf(A))}</b>`}</span></div>`;
  const trs=T.length?T.map(id=>{const x=TRD.TR[id];return`<div class="dv-tr t${x.tier}"><span>${x.e}</span><div><b>${esc(TT(x.en,x.th))} <small>· ${esc(TT(TRD.TIER_NAME[x.tier].en,TRD.TIER_NAME[x.tier].th))}</small></b><small>${esc(TT(x.den,x.dth))}</small></div></div>`}).join(''):`<div class="dv-none">✨ ${TT('No special trait yet. Eggs and breeding can bring cute ones!','ยังไม่มีลักษณะพิเศษ ลองสุ่มไข่หรือผสมพันธุ์ดูนะ!')}</div>`;
  let acts='';
  if(own){const candy=S.me.inv&&S.me.inv.candy|0;let price='';try{const p=TRD.sellValue(d,R.r||'C',R.pm||null,srv(),gk());price=` <small>≈${fmt(p)}${ic('coin','sm')}</small>`}catch(e){}
   acts=`<div class="dv-acts">${s<3?`<button class="btn mint ${d.away?'dis':''}" data-do="candy" data-id="${esc(d.id)}">🍬 ${TT('Growth Candy','ลูกอมโตเร็ว')} <small>${candy?'×'+candy:TT('buy','ซื้อ')}</small></button>`:''}${prem?'':`<button class="btn pink" data-do="nurpick" data-id="${esc(d.id)}">💞 ${TT('Breed','ผสมพันธุ์')}</button>`}<button class="btn sun" data-do="dogsell" data-id="${esc(d.id)}">💰 ${TT('Sell to shop','ขายให้ร้าน')}${price}</button><button class="btn lav" data-do="mklist" data-id="${esc(d.id)}">🏷️ ${TT('List on market','ลงขายตลาด')}</button></div>`}
  return`<div class="dv7"><div class="dv-stages">${stages}</div>${prog}${gene}<div class="dv-trs">${trs}</div>${d.cr?`<div class="dv-row"><b>👑</b><span>${TT('Dog show champion! Wears a crown for a day.','แชมป์ประกวดหมา! สวมมงกุฎอยู่หนึ่งวัน')}</span></div>`:''}${acts}</div>`}
 // age text for the profile table
 function age(d){const ms=Math.max(0,srv()-(+d.born||0)),h=ms/36e5;return h<48?Math.max(1,Math.round(h))+TT(' h',' ชม.'):Math.floor(h/24)+TT(' d',' วัน')}
 // 👑 Premium section in the Collection window
 function premColl(){const have=new Set(S.me.ownedP||[]),L=Object.values(DOGS.raw).filter(b=>b.pm).sort((a,b)=>(a.pm.g?1:0)-(b.pm.g?1:0)||(a.pm.g||a.pm.c)-(b.pm.g||b.pm.c));if(!L.length)return'';
  return`<h4 class="dv-ph">👑 ${TT('Premium dogs','หมาพรีเมียม')} <small>${have.size}/${L.length} · ${TT('sold in the Pet Shop for coins or gems','ซื้อได้ที่ร้านหมาด้วยเหรียญหรือเพชรเท่านั้น')}</small></h4>
  <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(104px,1fr))">${L.map(b=>{const o=have.has(b.id);return`<div class="gc r-${b.r} ${o?'':'off'}" style="padding:5px 4px">${thumbHTML(b.id,'Normal',34,null).replace('<canvas','<canvas '+(o?'':'data-dark="1" '))}<div class="nm" style="font-size:11px;min-height:26px">${o?esc(b.name):'???'}</div><span class="dv-pr">${b.pm.g?ic('gem','sm')+' '+b.pm.g:ic('coin','sm')+' '+fmt(b.pm.c)}</span></div>`}).join('')}</div>`}
 return{badges,panel,age,premColl,stageOf,dur}
})();
// Growth Candy: only for dogs at home that are not grown up yet
DO.candy=d=>{const dg=S.dogs[d.id];
 if(S.owner!=S.name||!dg)return toast(TT('Dogs eat candy at home - bring this one home first','ให้ลูกอมได้เฉพาะหมาที่อยู่บ้านของเรา ชวนกลับบ้านก่อนนะ'));
 if(DV.stageOf(dg)>=3)return toast('🦮 '+TT('Already grown up!','โตเต็มวัยแล้วนะ'));
 if(((S.me.inv&&S.me.inv.candy)|0)<=0){toast('🍬 '+TT('No Growth Candy yet - buy some in the Shop (Food)','ยังไม่มีลูกอมโตเร็ว ซื้อได้ที่ร้านค้า (หมวดอาหาร)'));S.shopTab='food';if(typeof DO.shop=='function')DO.shop();return}
 send({t:'feed',dog:d.id,food:'candy'});sfx('eat')};

// the "How to play" window: the v7 chapters
{const _h=DO.help;DO.help=function(){_h.apply(this,arguments);const l=$('#mods .ov[data-mod="help"] .list');if(!l||l.dataset.v7)return;l.dataset.v7=1;
 const row=(e,b,s)=>`<div class="li"><span style="font-size:28px">${e}</span><div class="g"><b>${b}</b><small>${s}</small></div></div>`;
 l.insertAdjacentHTML('beforeend',
  row('🥚',TT('Egg Gacha & growing up','สุ่มไข่และการเติบโต'),TT('The gacha lays EGGS: a baby dog hatches (maybe with a cute trait ✨). Dogs grow baby → puppy → teen → adult over a few days; Growth Candy 🍬 (Shop → Food) speeds it up.','สุ่มไข่แล้วลูกหมาเบบี๋จะฟักออกมา (บางตัวมีลักษณะพิเศษ ✨) น้องหมาจะโตจากเบบี๋ → ลูกหมา → วัยรุ่น → โตเต็มวัยในเวลาไม่กี่วัน ลูกอมโตเร็ว 🍬 (ร้านค้า → อาหาร) ช่วยให้โตไวขึ้น'))+
  row('🧬',TT('Breeding','ผสมพันธุ์'),TT('Pick two grown-up dogs in the Nursery: same breed → purebred, different breeds → a mixed (พันทาง) puppy with a blended look! Mixed dogs get new traits more often and rarely mutate into a rarer breed. Parents rest 12 h.','เลือกหมาโตเต็มวัย 2 ตัวในหน้าผสมพันธุ์: สายพันธุ์เดียวกันได้ลูกพันธุ์แท้ ต่างสายพันธุ์ได้ลูกพันทางที่หน้าตาผสมกัน! ลูกพันทางมีโอกาสได้ลักษณะพิเศษใหม่มากกว่า และมีโอกาสกลายพันธุ์เป็นสายพันธุ์ที่หายากขึ้น พ่อแม่ต้องพัก 12 ชม.'))+
  row('🐾',TT('Pet Shop & Market','ร้านหมาและตลาด'),TT('Very cute / very rare premium breeds are sold ONLY here for coins or gems (small daily stock). Sell dogs to the shop, or list them in the player market (5% fee).','หมาพรีเมียมสุดน่ารัก/หายากขายที่นี่ที่เดียวด้วยเหรียญหรือเพชร (สต็อกมีจำกัดต่อวัน) ขายหมาให้ร้านได้ หรือลงขายในตลาดผู้เล่น (หักค่าธรรมเนียม 5%)'))+
  row('👑',TT('Dog Show','ประกวดหมา'),TT('Every hour: enter a dog, then everyone votes. Winners get coins, gems and a 👑 crown!','ทุกชั่วโมง: ส่งหมาเข้าประกวด แล้วให้ทุกคนโหวต ผู้ชนะได้เหรียญ เพชร และมงกุฎ 👑'))+
  row('🔒',TT('Private house & losing fee','บ้านส่วนตัวและค่าแพ้'),TT('House → Privacy lets you close your house or allow friends only. Careful: losing an online game costs a few coins!','ในหน้าบ้านตั้งความเป็นส่วนตัวได้ ปิดบ้านหรือรับเฉพาะเพื่อน และระวัง: แพ้เกมออนไลน์จะโดนหักเหรียญเล็กน้อย')))}}
