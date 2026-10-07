// Cozy Dogs v7.1 - ประกาศถึงทุกคน (client). The SERVER decides everything (price, queue, cooldown, text rules - see announce.js); this file only
// draws: the banner everybody sees, the "write an announcement" window with a live preview, and the list of the latest announcements.
//   DO: announce anstyle antab ansend anclose      H: ann ann_ok ann_info
'use strict';
const ANN=(()=>{
 const ST={heart:{e:'💗',en:'Heart',th:'หัวใจ',fx:['💗','💖','💕','🤍','🩷']},star:{e:'⭐',en:'Gold star',th:'ดาวทอง',fx:['⭐','✨','🌟','💛','✨']},rainbow:{e:'🌈',en:'Rainbow',th:'สายรุ้ง',fx:['🌈','🎉','✨','💖','🎀','🦄','🎊']}};
 const KEYS=['heart','star','rainbow'],NFX={heart:7,star:8,rainbow:12};
 const P={heart:3,star:8,rainbow:20},MS={heart:7000,star:9000,rainbow:12000};     // defaults; the real numbers come with ann_info
 const Z={k:'heart',txt:'',tab:'w',info:null,hist:[],at:0,busy:0,boot:false,iv:0,seen:null,max:60,maxq:6};
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 const styleOf=k=>own(ST,k)?k:'heart';
 const chars=s=>Array.from(String(s||'')).length;
 const cut=(s,n)=>Array.from(String(s||'')).slice(0,n).join('');
 const secs=ms=>Math.max(1,Math.round(ms/1000));
 function ago(at){const s=Math.max(0,(Date.now()-(+at||0))/1000);if(s<60)return TT('just now','เมื่อครู่');if(s<3600)return Math.floor(s/60)+TT(' min ago',' นาทีที่แล้ว');if(s<86400)return Math.floor(s/3600)+TT(' h ago',' ชม.ที่แล้ว');return Math.floor(s/86400)+TT(' d ago',' วันที่แล้ว')}

 // ---------------------------------------------------------------- the banner (also used for the preview)
 function bannerHTML(o){const k=styleOf(o.k),me=o.n===S.name,fx=ST[k].fx,N=NFX[k];let ps='';
  for(let i=0;i<N;i++){const x=Math.round(4+(i+Math.random()*.7)*(92/N)),dl=(Math.random()*2.6).toFixed(2),du=(2.2+Math.random()*1.6).toFixed(2),sz=11+Math.round(Math.random()*8),y=8+Math.round(Math.random()*62);
   ps+=`<i class="an-p" style="--x:${x}%;--y:${y}%;--dl:${dl}s;--du:${du}s;--s:${sz}px">${fx[i%fx.length]}</i>`}
  const bar=o.ms?`<div class="an-bar"><i style="animation-duration:${Math.round(o.ms)}ms"></i></div>`:'';
  const x=o.live?`<button class="an-x" data-do="anclose" aria-label="${esc(TT('Close','ปิด'))}" title="${esc(TT('Hide this one','ซ่อนอันนี้'))}">✕</button>`:'';
  return`<div class="an an-${k}${o.live?'':' an-prev'}" role="status"><div class="an-fx">${ps}</div>
   <div class="an-ico"><span>📣</span></div>
   <div class="an-bd"><div class="an-by"><span>${ST[k].e}</span><b>${esc(o.n||'?')}</b><em>${me?TT('(you) announces','(คุณ) ประกาศ'):TT('announces','ประกาศ')}</em></div><div class="an-tx">${esc(o.m||'')}</div></div>${x}${bar}</div>`}

 let cur=null;
 const host=()=>{let h=document.getElementById('anb');if(!h){h=document.createElement('div');h.id='anb';h.setAttribute('aria-live','polite');document.body.append(h)}return h};
 function hide(now){if(!cur)return;const c=cur;cur=null;c.tm.forEach(clearTimeout);if(now){c.el.remove();return}c.el.classList.add('out');setTimeout(()=>c.el.remove(),480)}
 function show(m,ms){hide(true);if(S.set&&S.set.ann===false)return;const k=styleOf(m.k),ttl=Math.max(900,Math.min(30000,+ms||MS[k]));
  const el=document.createElement('div');el.className='an-w';el.innerHTML=bannerHTML({n:m.n,m:m.m,k,live:1,ms:ttl});host().append(el);
  cur={el,id:m.id,tm:[setTimeout(()=>{if(cur&&cur.el===el)el.classList.add('out')},Math.max(300,ttl-480)),setTimeout(()=>{if(cur&&cur.el===el){cur=null;el.remove()}else el.remove()},ttl+40)]};
  sfx('ann',k)}
 const clean=m=>m&&typeof m=='object'?{id:Number.isFinite(+m.id)?+m.id:0,n:cut(m.n,24),m:cut(m.m,160),k:styleOf(m.k)}:null;

 // ---------------------------------------------------------------- the window
 const cdLeft=()=>Z.info?Math.max(0,(+Z.info.cd||0)-(Date.now()-Z.at)):0;
 const qLen=()=>Z.info?Z.info.q|0:0;
 function blocked(){const k=Z.k,txt=cut(Z.txt.replace(/\s+/g,' ').trim(),Z.max);
  if(S.guest)return TT('Register an account first - Guests cannot announce','สมัครสมาชิกก่อนนะ ผู้เล่น Guest ประกาศไม่ได้');
  if(!txt)return TT('Type your message first','พิมพ์ข้อความก่อนนะ');
  if(cdLeft()>0)return TT('You can announce again in '+secs(cdLeft())+' s','ประกาศได้อีกครั้งในอีก '+secs(cdLeft())+' วินาที');
  if(qLen()>=Z.maxq)return TT('The queue is full - try again in a moment (no gems spent)','คิวประกาศเต็มอยู่ รอสักครู่แล้วลองใหม่นะ (ยังไม่เสียเพชร)');
  if(((S.me&&S.me.gems)|0)<P[k])return TT('Not enough gems - you need '+P[k],'เพชรไม่พอ ต้องใช้ '+P[k]+' เม็ด');
  return null}
 function statusHTML(){
  if(S.guest)return`<span class="bad">🔒 ${TT('Register an account to announce','สมัครสมาชิกก่อนถึงจะประกาศได้นะ')}</span>`;
  if(cdLeft()>0)return`<span class="warn">⏳ ${TT('You can announce again in '+secs(cdLeft())+' s','ประกาศได้อีกครั้งในอีก '+secs(cdLeft())+' วินาที')}</span>`;
  if(Z.info&&qLen()>=Z.maxq)return`<span class="bad">🚦 ${TT('Queue is full, try again soon','คิวเต็มอยู่ ลองใหม่อีกสักครู่นะ')}</span>`;
  if(Z.info&&(qLen()>0||Z.info.cur)){const w=Z.info.wait||0;return`<span class="warn">🚦 ${TT(qLen()+' waiting - yours shows in about '+secs(w)+' s',qLen()?'มีประกาศรอคิว '+qLen()+' รายการ ของคุณจะขึ้นในอีกประมาณ '+secs(w)+' วินาที':'มีประกาศกำลังแสดง ของคุณจะขึ้นต่อในอีกประมาณ '+secs(w)+' วินาที')}</span>`}
  return`<span class="good">✨ ${TT('No queue - it shows right away!','ไม่มีคิว ขึ้นให้ทุกคนเห็นทันที!')}</span>`}
 function writeHTML(){
  return`<p class="an-hint">${TT('Your message pops up on the screen of EVERY player who is online! Costs gems.','ข้อความของคุณจะเด้งขึ้นบนหน้าจอของผู้เล่นออนไลน์ทุกคน! ใช้เพชรในการประกาศนะ')}</p>
  <div class="an-sts">${KEYS.map(k=>`<button class="an-st an-st-${k} ${Z.k==k?'on':''}" data-do="anstyle" data-k="${k}" aria-pressed="${Z.k==k}"><span class="e">${ST[k].e}</span><b>${TT(ST[k].en,ST[k].th)}</b><span class="pr">${ic('gem','sm')} ${P[k]}</span><small>${TT('shows '+secs(MS[k])+' s','แสดง '+secs(MS[k])+' วิ')}</small></button>`).join('')}</div>
  <div class="an-edit"><textarea class="an-in" rows="2" maxlength="${Z.max*2}" autocomplete="off" spellcheck="false" placeholder="${esc(TT('Write something sweet for everyone…','เขียนข้อความน่ารัก ๆ ถึงทุกคน…'))}"></textarea><span class="an-cnt"></span></div>
  <div class="an-pvl">👀 ${TT('Preview','ตัวอย่างที่ทุกคนจะเห็น')}</div><div class="an-pv"></div>
  <div class="an-stat"></div>
  <button class="btn pink an-go" data-do="ansend"></button>
  <ul class="an-rules"><li>${TT('Max '+Z.max+' characters, no links, polite words only','ไม่เกิน '+Z.max+' ตัวอักษร ห้ามใส่ลิงก์ และใช้คำสุภาพนะ')}</li><li>${TT('Announcements wait in one line, so none cover each other','ประกาศจะเข้าคิวต่อกัน ไม่ซ้อนทับกัน')}</li><li>${TT('Gems are charged only when your announcement is accepted','หักเพชรเมื่อประกาศผ่านเข้าคิวแล้วเท่านั้น')}</li></ul>`}
 function histHTML(){const L=Z.hist;if(!L.length)return emptyState('ยังไม่มีใครประกาศเลย ลองเป็นคนแรกสิ~','No announcements yet - be the first!','📣');
  return`<div class="an-hl">${L.map(h=>`<div class="an-hr an-h-${styleOf(h.k)}"><span class="e">${ST[styleOf(h.k)].e}</span><div><div class="by"><b>${esc(h.n)}</b><small>${ago(h.at)}</small></div><div class="tx">${esc(h.m)}</div></div></div>`).join('')}</div>`}
 function paintPreview(){const pv=$('#mods .ov[data-mod="announce"] .an-pv');if(!pv)return;
  pv.innerHTML=bannerHTML({n:S.name,m:Z.txt.replace(/\s+/g,' ').trim()||TT('Your message shows up here ✨','ข้อความของคุณจะขึ้นตรงนี้ ✨'),k:Z.k})}
 function refresh(){const ov=modOpen('announce');if(!ov||Z.tab!='w')return;
  const n=chars(Z.txt),c=$('.an-cnt',ov);if(c){c.textContent=n+'/'+Z.max;c.classList.toggle('full',n>=Z.max)}
  const st=$('.an-stat',ov);if(st){const h=statusHTML();if(st.dataset.h!==h){st.dataset.h=h;st.innerHTML=h}}
  const go=$('.an-go',ov);if(go){const why=blocked(),k=Z.k;go.classList.toggle('an-off',!!why);go.innerHTML=`📣 ${TT('Announce!','ประกาศเลย!')} <span class="pr">${ic('gem','sm')} ${P[k]}</span>`}}
 function render(open){if(!open&&!modOpen('announce'))return;
  const tabs=`<div class="tabs2"><button class="${Z.tab=='w'?'on':''}" data-do="antab" data-k="w">✍️ ${TT('Write','เขียนประกาศ')}</button><button class="${Z.tab=='h'?'on':''}" data-do="antab" data-k="h">📜 ${TT('Latest','ประกาศล่าสุด')}</button></div>`;
  const ov=modal('announce','📣 '+TT('Announce to everyone','ประกาศถึงทุกคน'),`<div class="anm">${tabs}${Z.tab=='w'?writeHTML():histHTML()}</div>`,'sm anmod');
  if(Z.tab=='w'){const ta=$('.an-in',ov);ta.value=Z.txt;
   ta.addEventListener('input',()=>{let v=ta.value.replace(/[\r\n]+/g,' ');if(chars(v)>Z.max)v=cut(v,Z.max);if(v!==ta.value){const p=ta.selectionStart;ta.value=v;try{ta.setSelectionRange(Math.min(p,v.length),Math.min(p,v.length))}catch{}}Z.txt=v;paintPreview();refresh()});
   ta.addEventListener('keydown',e=>{if(e.key=='Enter'){e.preventDefault();e.stopPropagation();DO.ansend()}else e.stopPropagation()});
   paintPreview();refresh()}}
 function tick(){const ov=modOpen('announce');if(!ov){clearInterval(Z.iv);Z.iv=0;return}
  if(Z.tab=='w')refresh();else{const t=$$('.an-hr small',ov);const L=Z.hist;t.forEach((e,i)=>{if(L[i])e.textContent=ago(L[i].at)})}
  if(++Z.n%4==0)send({t:'ann_info'})}
 Z.n=0;

 DO.announce=()=>{if(S.guest){modal('announce','📣 '+TT('Announce to everyone','ประกาศถึงทุกคน'),emptyState('สมัครบัญชีก่อนนะ~ ผู้เล่น Guest ประกาศไม่ได้','Register an account first - Guests cannot announce','📣'),'sm anmod');return}
  Z.tab='w';render(true);send({t:'ann_info'});if(!Z.iv)Z.iv=setInterval(tick,1000)};
 DO.anstyle=d=>{if(!own(ST,d.k))return;Z.k=d.k;render()};
 DO.antab=d=>{Z.tab=d.k=='h'?'h':'w';render();if(Z.tab=='h')send({t:'ann_info'})};
 DO.anclose=()=>hide();
 DO.ansend=()=>{const why=blocked();if(why){toast('📣 '+why);sfx('err');return}
  if(Date.now()-Z.busy<1500)return;const k=Z.k,txt=cut(Z.txt.replace(/\s+/g,' ').trim(),Z.max),go=()=>{Z.busy=Date.now();send({t:'ann_send',m:txt,k})};
  if(P[k]>=8)ask(`${TT('Announce this to everyone for '+P[k]+' gems?','ประกาศข้อความนี้ให้ทุกคนเห็น ใช้ '+P[k]+' เพชร?')}\n\n“${esc(txt)}”`,go,{title:'📣 '+TT('Announce','ประกาศ'),yes:'📣 '+TT('Announce!','ประกาศเลย!'),cls:'pink'});
  else go()};

 // ---------------------------------------------------------------- server messages
 H.ann=m=>{const c=clean(m);if(!c||!c.m)return;Z.hist.unshift({id:c.id,n:c.n,m:c.m,k:c.k,at:Date.now()});if(Z.hist.length>20)Z.hist.length=20;
  show(c,Number.isFinite(+m.ms)?+m.ms:MS[c.k]);if(modOpen('announce')){if(Z.tab=='h')render();send({t:'ann_info'})}};
 H.ann_ok=m=>{if(!m||typeof m!='object')return;Z.txt='';const w=+m.wait||0;
  toast(w<1500?'🎉 '+TT('Announced! Everybody can see it now','ประกาศแล้ว! ทุกคนเห็นข้อความของคุณแล้ว'):'🚦 '+TT('In line (#'+((m.pos|0)+1)+') - shows in about '+secs(w)+' s','เข้าคิวแล้ว (คิวที่ '+((m.pos|0)+1)+') จะขึ้นในอีกประมาณ '+secs(w)+' วินาที'),4200);
  if(modOpen('announce')&&Z.tab=='w'){render()}};
 H.ann_info=m=>{if(!m||typeof m!='object')return;Z.info=m;Z.at=Date.now();
  if(m.price&&typeof m.price=='object')for(const k of KEYS)if(Number.isFinite(+m.price[k])&&+m.price[k]>0)P[k]=+m.price[k]|0;
  if(m.ms&&typeof m.ms=='object')for(const k of KEYS)if(Number.isFinite(+m.ms[k])&&+m.ms[k]>0)MS[k]=+m.ms[k];
  if(Number.isFinite(+m.max)&&+m.max>0)Z.max=+m.max|0;if(Number.isFinite(+m.maxq)&&+m.maxq>0)Z.maxq=+m.maxq|0;
  if(Array.isArray(m.hist))Z.hist=m.hist.filter(h=>h&&typeof h=='object').map(h=>({...clean(h),at:+h.at||0})).filter(h=>h.m).slice(0,20);
  if(Z.boot){Z.boot=false;const c=m.cur&&clean(m.cur);if(c&&c.m&&!cur&&+m.cur.ms>1500)show(c,+m.cur.ms)}      // joined while a banner is up: show the rest of it
  if(modOpen('announce')){if(Z.tab=='h')render();else refresh()}};
 // ask for the state once per (re)connection - the welcome message is the signal (H.welcome itself belongs to main.js)
 setInterval(()=>{if(S.welcome&&S.welcome!==Z.seen&&S.name){Z.seen=S.welcome;Z.boot=true;send({t:'ann_info'})}},700);
 return{show,hide,bannerHTML,Z,P,MS}
})();
Object.assign(TH,{'Announce':'ประกาศ','Show announcements':'แสดงประกาศ'});
// little fanfares (one per style)
SFX.ann=k=>{if(k=='rainbow'){[784,988,1175,1319,1568,1976].forEach((f,i)=>tone(f,.2,'triangle',.09,i*.08));tone(2349,.4,'sine',.07,.5)}
 else if(k=='star'){[784,1047,1319,1568].forEach((f,i)=>tone(f,.16,'sine',.09,i*.09))}
 else{tone(880,.12,'sine',.09);tone(1175,.2,'sine',.09,.11)}};
