// Cozy Dogs - wardrobe: the person who walks the dog can change skin, face, hair and clothes.
// Free pieces are always available; premium pieces cost coins once and are yours forever (the server validates + charges, see wardrobe.js on the server).
'use strict';
Object.assign(TH,{'Outfit':'แต่งตัว','Wardrobe':'ตู้เสื้อผ้า',
'Try a new look in the wardrobe':'ลองเปลี่ยนลุคในตู้เสื้อผ้า','Fresh Look':'ลุคใหม่','Save a new look in the wardrobe':'บันทึกลุคใหม่ในตู้เสื้อผ้า',
'Fashionista':'สายแฟชั่น','Own 5 premium wardrobe pieces':'มีชิ้นพรีเมียมในตู้ 5 ชิ้น','Style Icon':'ไอคอนแฟชั่น','Own 15 premium wardrobe pieces':'มีชิ้นพรีเมียมในตู้ 15 ชิ้น',
'Royalty':'ราชวงศ์','Own the golden crown':'มีมงกุฎทอง','Little Angel':'นางฟ้าตัวน้อย','Own the halo and the angel wings':'มีห่วงนางฟ้ากับปีกนางฟ้า'});
const Wardrobe=(()=>{
 const D=AVD,W={base:null,draft:null,tab:'hair',pose:'walk',saving:false};
 const clone=o=>JSON.parse(JSON.stringify(o)),th=()=>S.set.lang=='th',nm=it=>th()?it.th:it.en,own=()=>new Set(S.me.avOwn||[]);
 const TBL={SKIN:D.SKIN,HAIRC:D.HAIRC,EYEC:D.EYEC,TOPC:D.TOPC,BOTC:D.BOTC,SHOEC:D.SHOEC,LEASH:D.LEASH};
 const PATOK=['tee','tank','shirt','hoodie','sweater','dress'],HATCOL=['cap','beanie','bow','party','straw','phones','bunny','cat'],XCOL=['bandana','scarf','bag','backpack'];
 const TABS=[
  {id:'hair',e:'💇',en:'Hair',th:'ทรงผม',secs:[
   {k:'h',kind:'opt',list:D.HAIR,crop:'head',en:'Hairstyle',th:'ทรงผม'},
   {k:'hc',kind:'col',tbl:'HAIRC',en:'Hair colour',th:'สีผม'}]},
  {id:'face',e:'😊',en:'Face',th:'หน้าตา',secs:[
   {k:'sk',kind:'col',tbl:'SKIN',en:'Skin tone',th:'สีผิว'},
   {k:'e',kind:'opt',list:D.EYES,crop:'head',en:'Eyes',th:'ดวงตา'},
   {k:'ec',kind:'col',tbl:'EYEC',en:'Eye colour',th:'สีตา'},
   {k:'m',kind:'opt',list:D.MOUTH,crop:'head',en:'Mouth',th:'ปาก'},
   {k:'cheek',kind:'tog2',en:'Cheeks',th:'แก้ม & กระ'}]},
  {id:'top',e:'👕',en:'Tops',th:'เสื้อ',secs:[
   {k:'t',kind:'opt',list:D.TOP,crop:'torso',en:'Top',th:'เสื้อ'},
   {k:'tc',kind:'col',tbl:'TOPC',en:'Top colour',th:'สีเสื้อ'},
   {k:'pt',kind:'opt',list:D.PAT,crop:'torso',en:'Pattern',th:'ลวดลาย',needs:d=>PATOK.includes(d.t),note:['Patterns work on tees, shirts, hoodies, sweaters and dresses','ลายใช้ได้กับเสื้อยืด เสื้อกล้าม เสื้อเชิ้ต ฮู้ดดี้ ไหมพรม และเดรส']}]},
  {id:'bottom',e:'👖',en:'Bottoms',th:'กางเกง/รองเท้า',secs:[
   {k:'b',kind:'opt',list:D.BOT,crop:'legs',en:'Bottoms',th:'กางเกง / กระโปรง'},
   {k:'bc',kind:'col',tbl:'BOTC',en:'Colour',th:'สี'},
   {k:'s',kind:'opt',list:D.SHOE,crop:'feet',en:'Shoes',th:'รองเท้า'},
   {k:'sc',kind:'col',tbl:'SHOEC',en:'Shoe colour',th:'สีรองเท้า'}]},
  {id:'acc',e:'🎩',en:'Hats & more',th:'หมวก/แว่น/ปีก',secs:[
   {k:'ht',kind:'opt',list:D.HAT,crop:'hat',en:'Hats',th:'หมวก'},
   {k:'hk',kind:'col',tbl:'TOPC',en:'Hat colour',th:'สีหมวก',showIf:d=>HATCOL.includes(d.ht)},
   {k:'g',kind:'opt',list:D.GLASS,crop:'head',en:'Glasses',th:'แว่นตา'},
   {k:'x',kind:'opt',list:D.EXTRA,crop:'full',view:'side',en:'Accessories',th:'ผ้าพันคอ / กระเป๋า / ปีก'},
   {k:'xk',kind:'col',tbl:'TOPC',en:'Accessory colour',th:'สีของแต่งตัว',showIf:d=>XCOL.includes(d.x)}]},
  {id:'pet',e:'🦮',en:'Leash & home',th:'สายจูง/มุมบ้าน',secs:[
   {k:'ls',kind:'col',tbl:'LEASH',en:'Leash colour',th:'สีสายจูง'},
   {k:'hm',kind:'home',en:'Where you stand at home',th:'ยืนตรงไหนในบ้าน'}]}];
 const POSES=[['walk','🚶',['Walk','เดิน']],['idle','🙂',['Stand','ยืน']],['wave','👋',['Wave','โบกมือ']],['happy','🎉',['Cheer','ดีใจ']]];
 const dirty=()=>!!(W.draft&&W.base&&JSON.stringify(W.draft)!=JSON.stringify(W.base));
 const priceOf=()=>D.price(W.draft,S.me.avOwn||[]);
 // the dog that comes along in the preview
 function myDog(){const d=(S.owner==S.name?Object.values(S.dogs)[0]:null)||(S.allDogs&&S.allDogs[0]);if(d)return{breed:DOGS.k(d),variant:d.variant,acc:d.acc};const pm=Park.on&&Park.m[Park.me];if(pm)return{breed:DOGS.k(pm),variant:pm.variant,acc:pm.acc};return S.avatarBreed?{breed:S.avatarBreed,variant:'Normal',acc:null}:null}
 // ---------- pieces of the screen ----------
 const colBtn=(k,i,c)=>`<button class="swb ${W.draft[k]==i?'on':''} ${c=='rainbow'?'rb':''}" data-do="wcol" data-k="${k}" data-v="${i}" style="--c:${c=='rainbow'?'#fff':c}"></button>`;
 function cardHTML(s,it){const d=W.draft,on=d[s.k]===it.id,owned=!it.p||own().has(s.k+':'+it.id),av2=Object.assign({},d,{[s.k]:it.id}),dis=s.needs&&!s.needs(d);
  const o={crop:s.crop||'head'};if(s.view){o.view=s.view;o.pose='stand'}
  return`<button class="wc ${on?'on':''} ${it.p&&!owned?'prem':''} ${dis?'dis':''}" data-do="wpick" data-k="${s.k}" data-v="${it.id}">${AVA.html(av2,s.k=='x'?54:60,o)}<span class="wn">${esc(nm(it))}</span>${it.p?(owned?'<i class="wown">✔</i>':`<i class="wpr">${ic('coin','sm')} ${it.p}</i>`):''}</button>`}
 function secHTML(s){const d=W.draft;if(s.showIf&&!s.showIf(d))return'';const ttl=`<h5 class="wsec">${th()?s.th:s.en}</h5>`;
  if(s.kind=='col')return`<div class="wsecw">${ttl}<div class="swr">${TBL[s.tbl].map((c,i)=>colBtn(s.k,i,c)).join('')}</div></div>`;
  if(s.kind=='tog2')return`<div class="wsecw">${ttl}<div class="wtgs"><button class="wt ${d.bl?'on':''}" data-do="wtog" data-k="bl">🌸 ${TT('Rosy cheeks','แก้มแดง')}</button><button class="wt ${d.fr?'on':''}" data-do="wtog" data-k="fr">✨ ${TT('Freckles','กระ')}</button></div></div>`;
  if(s.kind=='home')return`<div class="wsecw">${ttl}<div class="wroom"><div class="wwall"></div><div class="wfloor"></div><div class="wmid">🐶</div>${D.HOME.map(h=>`<button class="wspot ${h.id} ${d.hm==h.id?'on':''}" data-do="whome" data-v="${h.id}" title="${esc(nm(h))}"><span>🧍</span><small>${esc(nm(h))}</small></button>`).join('')}</div></div>`;
  const bad=s.needs&&!s.needs(d);
  return`<div class="wsecw">${ttl}${bad?`<div class="muted wnote">ℹ️ ${TT(s.note[0],s.note[1])}</div>`:''}<div class="wgrid ${s.k=='x'?'wide':''}">${s.list.map(it=>cardHTML(s,it)).join('')}</div></div>`}
 function renderTabs(){const el=$('#wtabs');if(!el)return;el.innerHTML=TABS.map(x=>`<button class="${W.tab==x.id?'on':''}" data-do="wtab" data-v="${x.id}"><span class="e">${x.e}</span><span class="l">${th()?x.th:x.en}</span></button>`).join('')}
 function renderPane(keep){const el=$('#wpane');if(!el)return;const tab=TABS.find(x=>x.id==W.tab)||TABS[0],sc=keep?el.scrollTop:0;el.innerHTML=tab.secs.map(secHTML).join('');AVA.paint(el);el.scrollTop=sc}
 function renderPoses(){const el=$('#wposes');if(!el)return;el.innerHTML=POSES.map(([k,e,l])=>`<button class="${W.pose==k?'on':''}" data-do="wpose" data-v="${k}" title="${TT(l[0],l[1])}">${e}</button>`).join('')}
 function renderSave(){const el=$('#wsave');if(!el)return;const p=priceOf(),coins=S.me.coins|0,ch=dirty(),short=p.cost>coins;
  const info=!ch?`<span class="muted">✔ ${TT('This is your current look','นี่คือลุคปัจจุบันของคุณ')}</span>`:p.need.length?`<span class="wcost ${short?'bad':''}">🛍️ ${TT('New pieces','ชิ้นใหม่')}: <b>${p.need.length}</b> &nbsp;·&nbsp; ${ic('coin','sm')} <b>${p.cost}</b>${short?` <em>${TT('need','ขาดอีก')} ${p.cost-coins}</em>`:''}</span>`:`<span class="muted">${TT('Everything here is yours — free to wear!','ทุกชิ้นเป็นของคุณแล้ว ใส่ได้ฟรี!')}</span>`;
  el.innerHTML=`${info}<span class="sp" style="flex:1"></span><button class="btn ghost sm" data-do="wreset" ${ch?'':'disabled'}>↺ ${TT('Undo','ย้อนกลับ')}</button><button class="btn mint ${ch&&!short?'':'dis'}" data-do="wsave">${p.cost>0?'🛍️':'💾'} ${p.cost>0?TT('Buy & wear','ซื้อ & ใส่'):TT('Save','บันทึก')}</button>`}
 const titleHTML=()=>`👕 ${TT('Wardrobe','ตู้เสื้อผ้า')} <span class="rw" style="font-size:14px;margin-left:10px">${ic('coin','sm')} ${S.me.coins|0}</span>`;
 function build(){
  const body=`<div class="wlay"><div class="wleft"><div class="wprev panel"><canvas id="wprev" width="320" height="250"></canvas><div class="wposes" id="wposes"></div></div>
   <div class="wrow"><button class="btn sm lav" data-do="wrand">🎲 ${TT('Surprise me','สุ่มลุค')}</button><button class="btn sm ghost" data-do="wdefault">✨ ${TT('Basic','พื้นฐาน')}</button></div></div>
   <div class="wright"><div class="tabs2 wtabs" id="wtabs"></div><div id="wpane"></div></div></div><div class="wsave" id="wsave"></div>`;
  const ov=modal('wardrobe',titleHTML(),body,'lg wd',{lock:1});
  AVA.stage($('#wprev',ov),()=>W.draft?{av:W.draft,pose:W.pose,dog:myDog()}:null);
  renderTabs();renderPoses();renderPane();renderSave()}
 // ---------- public ----------
 function open(){
  if(S.edit)return toast(TT('Finish decorating first','ตกแต่งให้เสร็จก่อนนะ'));
  if(!S.me.av)S.me.av=D.defaults(S.name);
  LS.set('cd_avhint',true);
  if(modOpen('wardrobe')){refresh();return}
  W.base=clone(S.me.av);W.draft=clone(S.me.av);W.pose='walk';W.saving=false;build();send({t:'av_get'})}
 function refresh(){const ov=modOpen('wardrobe');if(!ov)return;$('.mt',ov).innerHTML=titleHTML();
  // a look saved from elsewhere (or confirmed by the server) becomes the new baseline when we have no unsaved edits
  if(!dirty()&&S.me.av){W.base=clone(S.me.av);W.draft=clone(S.me.av);renderPane(true)}
  renderSave()}
 function saved(m){const n=(m.bought||[]).length;
  if(m.same&&!n){W.saving=false;toast('👕 '+TT('You are already wearing this look','ใส่ลุคนี้อยู่แล้ว'));return}
  sfx(n?'coin':'level');toast('✨ '+TT('Look saved!','บันทึกลุคแล้ว!')+(n?'  🛍️ −'+m.cost+'💰':''),3000);
  W.base=clone(m.av);if(W.saving){W.saving=false;W.draft=clone(m.av);closeMod('wardrobe');
   if(Park.on){const q=Park.m[Park.me];if(q){q.av=m.av;q.emote={e:'👋',at:performance.now()}}}
   else{S.avTap=performance.now()+2600;const a=AVA.homeAvatar(performance.now());if(a){sparkle(a.x,a.y-48,16);burst(a.x,a.y-(a.top||90)-12,'✨',4)}}}
  else refresh()}
 function failed(m){W.saving=false;sfx('err');
  if(m&&m.code=='coins')toast('💰 '+TT('Not enough coins','เหรียญไม่พอ')+' ('+(m.cost|0)+')');else toast(TT('Could not save this look','บันทึกลุคนี้ไม่ได้'));refresh()}
 // ---------- actions ----------
 const touch=(keepScroll=true)=>{renderPane(keepScroll);renderSave()};
 DO.wardrobe=()=>open();
 DO.wtab=d=>{W.tab=d.v;renderTabs();renderPane(false)};
 DO.wpose=d=>{W.pose=d.v;renderPoses()};
 DO.wpick=(d,el)=>{if(el.classList.contains('dis'))return toast('ℹ️ '+TT('Pick a top that supports patterns first','เลือกเสื้อที่ใส่ลายได้ก่อนนะ'));W.draft[d.k]=d.v;
  // quick highlight swap (no thumbnail rebuild) unless a dependent piece changed
  if(d.k=='t'||d.k=='ht'||d.k=='x')touch();else{const g=el.parentElement;$$('.wc.on',g).forEach(x=>x.classList.remove('on'));el.classList.add('on');renderSave()}};
 DO.wcol=d=>{W.draft[d.k]=+d.v;touch()};
 DO.wtog=d=>{W.draft[d.k]=W.draft[d.k]?0:1;touch()};
 DO.whome=d=>{W.draft.hm=d.v;touch()};
 DO.wreset=()=>{W.draft=clone(W.base);touch()};
 DO.wdefault=()=>{const df=D.defaults(S.name),o=own();const d=W.draft;for(const k of['h','e','m','t','pt','b','s','ht','g','x']){const it=D.find(k,df[k]);if(it&&(!it.p||o.has(k+':'+it.id)))d[k]=df[k]}for(const k of['hc','ec','tc','bc','sc','hk','xk','ls','bl','fr'])d[k]=df[k];touch()};
 DO.wrand=()=>{const d=W.draft,o=own(),r=n=>Math.floor(Math.random()*n),ok=(k)=>D.KINDS[k].filter(it=>!it.p||o.has(k+':'+it.id));
  for(const k of['h','e','m','t','b','s']){const l=ok(k);d[k]=l[r(l.length)].id}
  d.pt=Math.random()<.3?['stripe','heart','star','paw'][r(4)]:'none';
  for(const k of['hc','ec','tc','bc','sc','hk','xk'])d[k]=r(D.NCOL[k]);
  for(const k of['ht','g','x']){const l=ok(k).filter(it=>it.id!='none');d[k]=Math.random()<.45&&l.length?l[r(l.length)].id:'none'}
  d.bl=Math.random()<.5?1:0;d.fr=Math.random()<.2?1:0;sfx('pop');touch(false)};
 DO.wsave=(d,el)=>{if(el.classList.contains('dis')||W.saving)return;W.saving=true;send({t:'av_save',av:W.draft});setTimeout(()=>{if(W.saving){W.saving=false;renderSave()}},4000)};
 // closing with unsaved changes asks first
 const _cm=DO.closemod;DO.closemod=d=>{if(d.id=='wardrobe'&&dirty()){ask(TT('Leave without saving your new look?','ออกโดยไม่บันทึกลุคใหม่?'),()=>closeMod('wardrobe'),{cls:'red',yes:TT('Leave','ออก')});return}_cm(d)};
 addEventListener('keydown',e=>{if(e.key!='Escape')return;const o=$$('#mods .ov'),top=o[o.length-1];if(top&&top.dataset.mod=='wardrobe')DO.closemod({id:'wardrobe'})});
 return{open,refresh,saved,failed,myDog,W};
})();
