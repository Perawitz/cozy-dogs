// Cozy Dogs v7 - the DOG SHOW window (hourly show, judged by the players of the server). Server side: show.js (messages sh_get sh_enter sh_unenter sh_vote, pushes sh + sh_ph).
// One window ('show'): a stage + phase bar with a live countdown (ticks once a second WITHOUT re-rendering), then tabs: this round (sign-up / vote / results) · last round · hall of fame.
// Rules and numbers (3 votes, >=3 dogs, vote level, prizes) come from the server's state push; the only constants here are decorative (round timeline fractions, learned from the server's 'left').
(function(){'use strict';
const ID='show',RO={C:0,R:1,E:2,L:3,M:4},CROWN_MS=864e5;
const Sh={st:null,rx:0,tab:'today',pick:null,sig:'',timer:0,lastGet:0,lock:{},guide:false,fr:{e:.42,v:.88},raf:0,dogsRef:undefined,vt:0,liveMap:{},liveOff:false,openAt:0};
const now=()=>Date.now()+(S.skew||0),gk=()=>S.gk||1,mm=matchMedia('(prefers-reduced-motion: reduce)');
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const ph0=p=>p=='vote'||p=='result'?p:'enter';
const PH={enter:{e:'🎪',en:'Sign-ups',th:'รับสมัคร',ben:'Sign-ups are open!',bth:'เปิดรับสมัครแล้ว!',cen:'Sign-ups close in',cth:'ปิดรับสมัครใน'},
 vote:{e:'🗳️',en:'Voting',th:'โหวต',ben:'Voting time!',bth:'ได้เวลาโหวตแล้ว!',cen:'Voting ends in',cth:'ปิดโหวตใน'},
 result:{e:'🏆',en:'Results',th:'ประกาศผล',ben:'The results are in!',bth:'ประกาศผลแล้ว!',cen:'Next show in',cth:'ประกวดรอบหน้าใน'}};
const MED=['🥇','🥈','🥉'];
// ---------------------------------------------------------------- tiny helpers
const clock=ms=>{let s=Math.ceil(Math.max(0,ms)/1000);const h=Math.floor(s/3600),m=Math.floor(s%3600/60);s%=60;return(h?h+':'+String(m).padStart(2,'0'):String(m))+':'+String(s).padStart(2,'0')};
const rem=()=>{const s=Sh.st;return s?Math.max(0,(+s.left||0)-(performance.now()-Sh.rx)):0};
const endFrac=()=>{const s=Sh.st,p=s?ph0(s.ph):'enter';return p=='enter'?Sh.fr.e:p=='vote'?Sh.fr.v:1};
const pos=()=>{const s=Sh.st;if(!s||!(s.ms>0))return 0;return Math.max(0,Math.min(1,endFrac()-rem()/s.ms))};
const hsh=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0};
const shuffled=(list,st)=>list.slice().sort((a,b)=>hsh(st.id+':'+a.n)-hsh(st.id+':'+b.n));   // the server lists entries by score: we never show that order before the results (it would leak the standings), nor favour the first sign-up
const lock=(k,ms=450)=>{const t=Date.now();if(Sh.lock[k]&&t-Sh.lock[k]<ms)return true;Sh.lock[k]=t;return false};
const roundName=(id,st)=>{const ms=st&&st.ms||36e5;if(!(ms>=6e4)||!Number.isFinite(+id))return'#'+id;const d=new Date(+id*ms),p=x=>String(x).padStart(2,'0');return p(d.getHours())+':'+p(d.getMinutes())};
const everyTxt=ms=>ms==36e5?TT('every hour','ทุกชั่วโมง'):ms>=6e4?TT('every '+Math.round(ms/6e4)+' min','ทุก '+Math.round(ms/6e4)+' นาที'):TT('every '+Math.round(ms/1e3)+' s','ทุก '+Math.round(ms/1e3)+' วินาที');
const get=()=>{Sh.lastGet=Date.now();return send({t:'sh_get'})};
const myName=()=>S.name;
const isMe=n=>n===myName();
// ---------------------------------------------------------------- dogs: art, chips, charm (the SAME formula as the server's charm())
const brOf=d=>{try{return DOGS.BR[d.breed]||null}catch{return null}};
const rarOf=d=>{const b=brOf(d);return b&&own(RO,b.r)?b.r:'C'};
const bname=d=>d&&d.breed?esc(DOGS.nm(d)):'🐶';
const art=(d,size,cls='')=>thumbHTML(DOGS.k(d),d.variant,size,d.acc,cls);
const stageOf=d=>TRD.stageOf(d.born,now(),gk());
const accOf=a=>a&&S.cat&&S.cat.acc&&own(S.cat.acc,a)?S.cat.acc[a]:null;
const trChip=id=>{const T=TRD.TR[id];if(!T)return'';const sh=TRD.buff({tr:[id]},'show');return`<span class="ds-chip t${T.tier}" title="${esc(TT(T.den,T.dth))}">${T.e} ${esc(TT(T.en,T.th))}${sh?` <i>✨+${sh}</i>`:''}</span>`};
const accChip=a=>{if(!a)return'';const o=accOf(a);return`<span class="ds-chip acc">${o?o.e+' '+esc(o.n):'🎀 '+esc(nice(a))}</span>`};
const stageChip=d=>{const s=TRD.STAGES[stageOf(d)]||TRD.STAGES[3];return`<span class="ds-chip stg">${s.e} ${esc(TT(s.en,s.th))}</span>`};
const chips=(d,full)=>{const tr=TRD.cleanTraits(d.tr);return(full?stageChip(d):'')+(TRD.isMixed(d)?`<span class="ds-chip mix">🧬 ${TT('Mixed','พันทาง')}</span>`:'')+accChip(d.acc)+tr.map(trChip).join('')};
const emoChips=d=>TRD.cleanTraits(d.tr).map(id=>TRD.TR[id].e).join('')+(d.acc?(accOf(d.acc)||{e:'🎀'}).e:'')+(TRD.isMixed(d)?'🧬':'');
// hall-of-fame winners still wear their crown for 24 h: the entries do not say who is crowned, so we work it out from the hall (display only)
function crownedIds(st){const o=new Set();if(!st||!Array.isArray(st.hall)||!(st.ms>0))return o;const t=now();for(const h of st.hall)if(h&&h.d&&t<(+h.id+Sh.fr.v)*st.ms+CROWN_MS)o.add(h.d.id);return o}
function charm(d,at){
 const bond=d.bond|0,show=TRD.buff(d,'show'),rar=rarOf(d),mixed=TRD.isMixed(d),adult=TRD.stageOf(d.born,at,gk())==3,acc=!!d.acc,f1=x=>String(Math.round(x*10)/10);
 const P=[
  {k:'bond',e:'💞',v:bond/25,tx:'+'+f1(bond/25),en:'Bond '+bond,th:'ความผูกพัน '+bond,hen:'Every 25 Bond = +1. Pet, play and feed your dog!',hth:'ทุก 25 Bond ได้ +1 · ลูบ เล่น ป้อนอาหารบ่อยๆ นะ'},
  {k:'trait',e:'✨',v:show,tx:'+'+f1(show),en:'Cute traits',th:'ลายน่ารัก',hen:'Marks like ⭐ Star, 🌼 Flower or 😇 Halo make a dog shine.',hth:'ลายเด่น เช่น ⭐ ดาว 🌼 ดอกไม้ 😇 วงแหวน ช่วยให้เสน่ห์สูงขึ้น'},
  {k:'rar',e:'💎',v:RO[rar]*.5,tx:'+'+f1(RO[rar]*.5),en:'Rarity',th:'ความหายาก',hen:'Rarer breeds are worth a little more (+0.5 each level).',hth:'สายพันธุ์หายากยิ่งได้เพิ่ม (ระดับละ +0.5)'},
  {k:'mix',e:'🧬',v:mixed?1:0,tx:mixed?'+1':'0',en:'Mixed breed',th:'พันทาง',hen:'Breed two dogs in the Nursery to get a mixed breed.',hth:'ผสมน้องหมา 2 ตัวในโรงเพาะฟัก ลูกจะเป็นพันทาง'},
  {k:'adult',e:'🦮',v:adult?1:0,tx:adult?'+1':'0',en:'Grown-up',th:'โตเต็มวัย',hen:'Babies, puppies and teens are not grown yet.',hth:'เบบี๋ ลูกหมา วัยรุ่น ยังโตไม่เต็มวัย'},
  {k:'acc',e:'🎀',v:acc?1:0,tx:acc?'+1':'0',en:'Accessory',th:'เครื่องประดับ',hen:'Put an accessory on in the Dogs window (🎀 Wear).',hth:'ใส่เครื่องประดับให้น้องในหน้า น้องหมา (🎀 แต่งตัว)'}];
 const sum=P.reduce((a,p)=>a+p.v,0);return{P,sum,total:Math.max(0,Math.round(sum))}}
const dogSig=d=>JSON.stringify([d.acc||'',TRD.cleanTraits(d.tr),d.bond|0,d.mix||'',d.breed]);
// ---------------------------------------------------------------- state / network
function learn(m){if(!(m.ms>0)||!Number.isFinite(+m.now)||!Number.isFinite(+m.left))return;const base=m.now-m.now%m.ms,e=(m.now+m.left-base)/m.ms;if(e>.05&&e<.995){if(m.ph=='enter')Sh.fr.e=e;else if(m.ph=='vote')Sh.fr.v=e}}
const sigOf=m=>JSON.stringify([m.id,m.ph,m.n,m.min,m.votes,m.me,m.entries,m.last,m.hall,m.prize,m.ms]);
H.sh=m=>{if(!m||typeof m!='object'||!Array.isArray(m.entries)||!m.me)return;
 learn(m);Sh.st=m;Sh.rx=performance.now();clearTimeout(Sh.vt);Sh.vt=0;
 if(!modOpen(ID))return;
 if(sigOf(m)===Sh.sig){tickNow();return}      // nothing changed (the 6 s safety poll): leave the DOM alone, no flicker
 render()};
H.sh_ph=()=>{if(modOpen(ID))get()};
// optimistic UI must never stay out of sync: when the server rejects (it only answers with a toast), ask again
const resync=()=>{clearTimeout(Sh.vt);Sh.vt=setTimeout(()=>{Sh.vt=0;if(modOpen(ID))get()},1100)};
function tick(){
 if(!modOpen(ID)){clearInterval(Sh.timer);Sh.timer=0;stopLive();return}
 if(S.allDogs!==Sh.dogsRef){Sh.dogsRef=S.allDogs;if(Sh.st)render()}
 tickNow();
 const t=Date.now(),need=!Sh.st?2000:rem()<=0?1500:6000;if(t-Sh.lastGet>need)get()}
function tickNow(){const o=modOpen(ID);if(!o||!Sh.st)return;
 const r=rem(),c=$('[data-dsclock]',o),p=pos();if(c){const tx=clock(r);if(c.textContent!==tx)c.textContent=tx;c.classList.toggle('hot',r>0&&r<10500)}
 const f=$('[data-dsfill]',o),mk=$('[data-dsmark]',o);if(f)f.style.width=(p*100).toFixed(2)+'%';if(mk)mk.style.left=(p*100).toFixed(2)+'%'}
// ---------------------------------------------------------------- open
DO.show=()=>{const fresh=Sh.st&&performance.now()-Sh.rx<Math.min(4000,Sh.st.left||0);if(!fresh)Sh.st=null;Sh.sig='';Sh.openAt=Date.now();
 get();send({t:'dogs_get'});Sh.dogsRef=S.allDogs;render(true);if(!Sh.timer)Sh.timer=setInterval(tick,1000);startLive()};
DO.shTab=d=>{if(!['today','prev','hall'].includes(d.k)||Sh.tab===d.k)return;Sh.tab=d.k;Sh.sig='';render()};
DO.shPv=()=>{Sh.pv=!Sh.pv;render()};
DO.shGuide=()=>{Sh.guide=!Sh.guide;render()};
DO.shRetry=()=>{Sh.st=null;get();send({t:'dogs_get'});render()};
DO.shPick=d=>{if(!d.id||Sh.pick===d.id)return;Sh.pick=d.id;sfx('pop');render()};
DO.shEnter=()=>{const st=Sh.st;if(!st)return;const me=st.me;
 if(me.guest||!me.canEnter)return sfx('err'),toast(TT('Sign up for a free account to join the show!','สมัครสมาชิกฟรีก่อนนะ ถึงจะส่งน้องหมาเข้าประกวดได้!'));
 if(ph0(st.ph)!='enter')return sfx('err'),toast(TT('Sign-ups are closed — see you next round!','ปิดรับสมัครแล้ว เจอกันรอบหน้านะ!'));
 const d=(S.allDogs||[]).find(x=>x.id===Sh.pick);if(!d)return sfx('err'),toast(TT('Pick one of your dogs first','เลือกน้องหมาของคุณก่อนนะ'));
 if(lock('enter',900))return;
 if(me.entered&&me.entered.id===d.id&&dogSig(me.entered)==dogSig(d))return toast(TT('This dog is already in the show 🐾','น้องตัวนี้อยู่ในการประกวดแล้วนะ 🐾'));
 if(!send({t:'sh_enter',dog:d.id}))return sfx('err'),toast(TT('Not connected yet — try again in a moment','ยังไม่ได้เชื่อมต่อ ลองใหม่อีกครั้งนะ'));
 sfx('ok');resync()};
DO.shLeave=()=>{const st=Sh.st;if(!st||!st.me.entered)return;if(ph0(st.ph)!='enter')return toast(TT('Sign-ups are closed','ปิดรับสมัครแล้ว'));if(lock('leave',900))return;
 if(send({t:'sh_unenter'})){toast(TT('Your dog left the show','ถอนน้องหมาออกจากการประกวดแล้ว'));resync()}else toast(TT('Not connected yet — try again in a moment','ยังไม่ได้เชื่อมต่อ ลองใหม่อีกครั้งนะ'))};
DO.shVote=d=>{const st=Sh.st;if(!st)return;const me=st.me,n=String(d.n||'');
 if(ph0(st.ph)!='vote')return sfx('err'),toast(TT('Voting is not open right now','ตอนนี้ยังไม่เปิดโหวตนะ'));
 if(me.guest)return sfx('err'),toast(TT('Sign up for a free account to vote','สมัครสมาชิกฟรีก่อนถึงจะโหวตได้นะ'));
 if(!me.canVote)return sfx('err'),toast(TT('Reach level '+me.lvl+' to vote — you are level '+(S.me.lvl|0)+'. Keep caring for your dogs!','ต้องเลเวล '+me.lvl+' ขึ้นไปถึงจะโหวตได้ (ตอนนี้เลเวล '+(S.me.lvl|0)+') ดูแลน้องหมาเก็บ XP กันนะ'));
 if(isMe(n))return sfx('err'),toast(TT('You cannot vote for your own dog 😆','โหวตให้หมาตัวเองไม่ได้นะ 😆'));
 if(!st.entries.some(e=>e.n===n))return;
 const has=me.votes.includes(n);
 if(!has&&me.votes.length>=st.votes)return sfx('err'),toast(TT('All '+st.votes+' votes used — tap a ♥ again to take one back','ใช้โหวตครบ '+st.votes+' คะแนนแล้ว กด ♥ ซ้ำเพื่อยกเลิกได้'));
 if(lock('v:'+n))return;
 const keep=me.votes.slice();me.votes=has?me.votes.filter(x=>x!==n):me.votes.concat(n);        // optimistic: the server's answer (a fresh 'sh') replaces it, a rejection is caught by resync()
 if(!send({t:'sh_vote',n})){me.votes=keep;return sfx('err'),toast(TT('Not connected yet — try again in a moment','ยังไม่ได้เชื่อมต่อ ลองใหม่อีกครั้งนะ'))}
 sfx(has?'click':'pop');render();resync()};
// ---------------------------------------------------------------- pieces
const hearts=(left,total)=>Array.from({length:Math.max(0,total)},(_,i)=>`<span class="ds-h ${i<left?'on':''}">${ic(i<left?'heart':'hearte','big')}</span>`).join('');
const prizeChips=st=>{const pz=st.prize||{},top=Array.isArray(pz.top)?pz.top:[],part=pz.part||{};
 return top.map((r,i)=>`<span class="ds-pz p${i+1}"><b>${MED[i]||'🏅'}</b><span class="rw">${rewardTxt(r||{})}</span></span>`).join('')+`<span class="ds-pz pp"><b>🎖️</b><em>${TT('everyone else','ทุกตัวที่เข้าร่วม')}</em><span class="rw">${rewardTxt(part)}</span></span>`};
function hero(st,mini){return`<div class="ds-stage ${mini?'mini':''}"><div class="ds-flags"></div><div class="ds-spot"></div><div class="ds-curt l"></div><div class="ds-curt r"></div>
 <div class="ds-hero"><div class="ds-cup"><span>🏆</span><i class="s1">✨</i><i class="s2">⭐</i><i class="s3">✨</i></div>
 <div class="ds-ht"><h3>${TT('Cozy Dog Show','ประกวดน้องหมา')}</h3><p>${TT('Every player on the server is a judge — a new show '+everyTxt(st.ms)+'!','ผู้เล่นทุกคนในเซิร์ฟเวอร์ช่วยกันเป็นกรรมการ — จัดประกวดใหม่'+everyTxt(st.ms)+'!')}</p><p class="crw">👑 ${TT('The winner\'s dog wears a golden crown for 24 hours and joins the 🏛️ Hall of Fame.','หมาของผู้ชนะได้สวมมงกุฎทอง 24 ชั่วโมง และได้ขึ้นหอเกียรติยศ 🏛️')}</p></div>
 <div class="ds-prizes">${prizeChips(st)}</div></div><div class="ds-floor"></div></div>`}
const scoreExplain=()=>`<div class="ds-eq"><span>🏆 ${TT('Score','คะแนนรวม')}</span><b>=</b><span class="a">♥ ${TT('votes','โหวต')} × 3</span><b>+</b><span class="b">✨ ${TT('judge\'s charm','เสน่ห์จากกรรมการ')}</span></div>`;
function countCard(st){const n=st.n|0,min=st.min|0,ok=n>=min,pc=Math.min(100,min?n/min*100:100),p=ph0(st.ph);
 const need=Math.max(0,min-n);
 return`<div class="ds-card ds-count ${ok?'ok':'low'}"><div class="ds-bn">🐶<b>${n}</b></div><div class="g"><b>${p=='enter'?TT(n==1?'1 dog has entered':n+' dogs have entered',n+' ตัวสมัครแล้ว'):TT(n+' dogs are competing',n+' ตัวเข้าประกวด')}</b>
 <div class="prog"><i style="width:${pc}%;background:linear-gradient(#ffd9a0,${ok?'#6fd1a5':'#ffb36b'})"></i></div>
 <small>${ok?'✅ '+TT('Enough dogs — the show is on!','ครบแล้ว! การประกวดรอบนี้จัดแน่นอน'):p=='enter'?'🐾 '+TT('At least '+min+' dogs are needed, '+need+' more to go — otherwise this round is cancelled.','ต้องมีอย่างน้อย '+min+' ตัว ขาดอีก '+need+' ตัว — ถ้าไม่ครบรอบนี้จะถูกยกเลิก'):'⚠️ '+TT('Only '+n+' dogs signed up (needs '+min+'): this round will be cancelled.','มีแค่ '+n+' ตัว (ต้องมี '+min+'): รอบนี้จะถูกยกเลิกนะ')}</small></div></div>`}
function guestNote(what){return`<div class="ds-card ds-guest">${emptyState('สมัครสมาชิกฟรีก่อนนะ~ ผู้เล่น Guest ส่งหมาเข้าประกวด'+(what=='vote'?'และโหวต':'')+'ไม่ได้ แต่ดูการประกวดได้เลย!','Create a free account to join — guests can watch the show, but cannot enter'+(what=='vote'?' or vote':'')+'.','🎟️')}</div>`}
function guide(st){const o=Sh.guide,v=st.votes|0,min=st.min|0;
 const li=(e,en,th)=>`<li><i>${e}</i><span>${TT(en,th)}</span></li>`;
 return`<div class="ds-guide ${o?'open':''}"><button class="ds-gb" data-do="shGuide" aria-expanded="${o}">❓ ${TT('How does the show work?','การประกวดทำงานยังไง?')} <span>${o?'▲':'▼'}</span></button>${o?`<ol class="ds-gl">
 ${li('🎪','Sign-ups: pick ONE of your dogs (any of them, even one that is away). You can switch dogs until sign-ups close, or withdraw.','รับสมัคร: เลือกน้องหมาได้ 1 ตัว (ตัวไหนก็ได้ แม้ไม่ได้อยู่บ้าน) เปลี่ยนตัวหรือถอนตัวได้จนกว่าจะปิดรับสมัคร')}
 ${li('🗳️','Voting: every player is a judge! You get '+v+' ♥ votes (tap a ♥ again to take it back). You cannot vote for yourself, and you need level '+st.me.lvl+'. Your first vote of the round pays +10 coins.','โหวต: ทุกคนเป็นกรรมการ! มี '+v+' ♥ โหวต (กด ♥ ซ้ำเพื่อยกเลิก) โหวตให้ตัวเองไม่ได้ และต้องเลเวล '+st.me.lvl+' ขึ้นไป โหวตแรกของรอบได้ +10 เหรียญ')}
 ${li('✨','The judge\'s charm adds a few points: Bond, cute traits, rarity, mixed breed, grown-up and accessory. Every vote is worth 3 points, so being loved matters most!','เสน่ห์จากกรรมการช่วยเพิ่มคะแนนอีกหน่อย: Bond ลายน่ารัก ความหายาก พันทาง โตเต็มวัย เครื่องประดับ — แต่โหวตละ 3 คะแนน ความน่ารักที่คนชอบสำคัญที่สุด!')}
 ${li('🏆','Results: score = votes × 3 + charm. Ties go to the dog that signed up first. Vote counts stay secret until the results.','ผลตัดสิน: คะแนน = โหวต × 3 + เสน่ห์ เสมอกันตัวที่สมัครก่อนชนะ ยอดโหวตจะถูกเก็บเป็นความลับจนกว่าจะประกาศผล')}
 ${li('✉️','Prizes arrive in your Mail ✉️ — everyone who entered gets something. A show needs at least '+min+' dogs, otherwise the round is cancelled.','รางวัลส่งเข้ากล่องจดหมาย ✉️ — ทุกตัวที่เข้าร่วมได้รางวัลหมด ต้องมีอย่างน้อย '+min+' ตัว ไม่งั้นรอบนั้นจะถูกยกเลิก')}</ol>`:''}</div>`}
// ---------------------------------------------------------------- sign-up phase
function myCard(st){const d=st.me.entered;if(!d)return'';const c=charm(d,now()),live=(S.allDogs||[]).find(x=>x.id===d.id),lc=live?charm(live,now()):null,changed=live&&dogSig(live)!=dogSig(d);
 return`<div class="ds-card ds-mine"><div class="ds-rib">✔ ${TT('Your contestant','ตัวแทนของคุณ')}</div><div class="ds-mw">${art(d,64,'ds-live')}<div class="g"><h4>${esc(d.name)} <i>${PERS_EM[d.pers]||''}</i></h4><div class="ds-br">${bname(d)} ${rarTag(rarOf(d))}</div><div class="ds-chips">${chips(d,true)}</div>
 <div class="ds-cm">✨ ${TT('Charm','เสน่ห์')} <b>${c.total}</b> <small>${TT('(from the day you signed up)','(ตอนที่สมัคร)')}</small></div></div></div>
 ${changed&&lc?`<div class="ds-chg">🔄 ${lc.total!=c.total?TT('Your dog has changed since sign-up: charm '+c.total+' → '+lc.total+'. Update the entry to show it off!','น้องเปลี่ยนไปจากตอนสมัคร: เสน่ห์ '+c.total+' → '+lc.total+' กดอัปเดตเพื่อใช้ค่าใหม่!'):TT('Your dog has changed since sign-up. You can update the entry.','น้องเปลี่ยนไปจากตอนสมัคร กดอัปเดตได้นะ')}</div>`:''}
 <div class="ds-ma"><button class="btn ghost sm" data-do="shLeave">↩ ${TT('Withdraw','ถอนตัว')}</button><span class="muted">${TT('You can switch dogs until sign-ups close.','เปลี่ยนตัวได้จนกว่าจะปิดรับสมัคร')}</span></div></div>`}
function charmPanel(d){const c=charm(d,now());
 return`<div class="ds-card ds-pv ${Sh.pv?'open':''}"><button class="ds-pvh" data-do="shPv" aria-expanded="${!!Sh.pv}">${art(d,40)}<div class="g"><b>${esc(d.name)}</b><small>${TT('Why this charm?','ทำไมได้เสน่ห์เท่านี้?')}</small></div><div class="ds-big">✨<b>${c.total}</b></div><span class="ds-chev">${Sh.pv?'▴':'▾'}</span></button>
 <div class="ds-pvb"><div class="ds-cl">${c.P.map(p=>`<div class="ds-cr ${p.v>0?'on':''}"><i>${p.e}</i><div class="g"><b>${esc(TT(p.en,p.th))}</b>${p.v>0?'':`<small>${esc(TT(p.hen,p.hth))}</small>`}</div><span class="v">${p.tx}</span></div>`).join('')}</div>
 <div class="ds-sum"><span>${TT('Total (rounded)','รวม (ปัดเศษ)')}</span><b>✨ ${c.total}</b></div>
 <div class="ds-warn">⚠️ ${TT('Charm is only a small part of the score! Every vote you get is worth 3 points.','เสน่ห์เป็นแค่ส่วนเล็กๆ ของคะแนน! ทุกโหวตที่ได้มีค่า 3 คะแนน')}</div>${scoreExplain()}</div></div>`}
function picker(st){const dogs=S.allDogs;
 if(!dogs)return`<div class="ds-card ds-load"><div class="ds-pup">🐶</div>${TT('Fetching your dogs…','กำลังเรียกน้องหมาของคุณ…')}</div>`;
 if(!dogs.length)return`<div class="ds-card">${emptyState('ยังไม่มีน้องหมาให้ส่งประกวดเลย','You have no dogs to enter yet.','🐶')}</div>`;
 const at=now(),me=st.me,crowned=new Set(dogs.filter(d=>d.cr).map(d=>d.id)),list=dogs.map(d=>({d,c:charm(d,at)})).sort((a,b)=>b.c.total-a.c.total||(b.d.bond|0)-(a.d.bond|0)||String(a.d.name).localeCompare(String(b.d.name)));
 if(!list.some(x=>x.d.id===Sh.pick))Sh.pick=(me.entered&&list.some(x=>x.d.id===me.entered.id)?me.entered.id:list[0].d.id);
 const sel=list.find(x=>x.d.id===Sh.pick),best=list[0].d.id,inShow=me.entered&&me.entered.id===sel.d.id,changed=inShow&&dogSig(me.entered)!=dogSig(sel.d);
 const cards=list.map(({d,c})=>`<button class="ds-dog r-${rarOf(d)} ${d.id===Sh.pick?'sel':''} ${me.entered&&me.entered.id===d.id?'in':''}" data-do="shPick" data-id="${esc(d.id)}" aria-pressed="${d.id===Sh.pick}">
  <span class="ds-cb">✨${c.total}</span>${me.entered&&me.entered.id===d.id?`<span class="ds-in">✔</span>`:crowned.has(d.id)?'<span class="ds-in">👑</span>':d.id===best&&list.length>1?'<span class="ds-in best">⭐</span>':''}
  <div class="ds-art">${art(d,46)}</div><b>${esc(d.name)}</b><small>${bname(d)}</small><span class="ds-em">${emoChips(d)||'&nbsp;'}</span></button>`).join('');
 const label=inShow?(changed?'🔄 '+TT('Update my entry','อัปเดตการสมัคร'):'✔ '+TT('Already in the show','อยู่ในการประกวดแล้ว')):me.entered?'🔄 '+TT('Switch to '+esc(sel.d.name),'เปลี่ยนเป็น '+esc(sel.d.name)):'👑 '+TT('Enter '+esc(sel.d.name),'ส่ง '+esc(sel.d.name)+' เข้าประกวด');
 return`<div class="ds-sech"><h4>🐶 ${me.entered?TT('Switch to another dog?','อยากเปลี่ยนตัวไหม?'):TT('Pick your contestant','เลือกตัวแทนของคุณ')}</h4><span class="muted">${TT('Best charm first','เรียงตามเสน่ห์มากไปน้อย')}</span></div>
 <div class="ds-sel"><div class="ds-grid">${cards}</div><div class="ds-side">${charmPanel(sel.d)}</div></div>
 <div class="ds-act"><div class="ds-ai">${art(sel.d,22)}<div class="g"><b>${esc(sel.d.name)}</b><small>✨ ${TT('Charm','เสน่ห์')} ${sel.c.total}</small></div></div><button class="btn ${inShow&&!changed?'ghost shno':'pink'}" data-do="shEnter">${label}</button></div>`}
function whoIn(st){if(!st.entries.length)return`<div class="ds-sech"><h4>🎪 ${TT('Who is in the show?','ใครมาประกวดบ้าง?')}</h4></div><div class="ds-card">${emptyState('ยังไม่มีใครสมัครเลย — เป็นคนแรกกันนะ!','Nobody has signed up yet — be the first!','🎪')}</div>`;
 const L=shuffled(st.entries,st),cr=crownedIds(st),cap=30;
 return`<div class="ds-sech"><h4>🎪 ${TT('Who is in the show?','ใครมาประกวดบ้าง?')} <span class="pill">${st.entries.length}</span></h4><span class="muted">${TT('Votes and charm stay secret until the results.','โหวตและเสน่ห์เป็นความลับจนกว่าจะประกาศผล')}</span></div>
 <div class="ds-mini">${L.slice(0,cap).map(e=>`<div class="ds-m ${isMe(e.n)?'me':''}">${cr.has(e.d.id)?'<span class="ds-cw">👑</span>':''}<div class="ds-art">${art(e.d,30)}</div><b>${esc(e.d.name)}</b><small>${isMe(e.n)?TT('you','คุณ'):esc(e.n)}</small></div>`).join('')}${L.length>cap?`<div class="ds-m more">+${L.length-cap}</div>`:''}</div>`}
function viewEnter(st){const me=st.me;let h=hero(st)+countCard(st);
 if(me.guest)h+=guestNote('enter');else{h+=myCard(st)+picker(st)}
 return h+whoIn(st)}
// ---------------------------------------------------------------- vote phase
function viewVote(st){const me=st.me,left=Math.max(0,st.votes-me.votes.length),cr=crownedIds(st),L=shuffled(st.entries,st),others=L.filter(e=>!isMe(e.n));
 let why='';
 if(me.guest)why=guestNote('vote');
 else if(!me.canVote)why=`<div class="ds-card ds-lock">🔒 <div class="g"><b>${TT('Reach level '+me.lvl+' to vote','ต้องเลเวล '+me.lvl+' ขึ้นไปถึงจะโหวตได้')}</b><small>${TT('You are level '+(S.me.lvl|0)+'. Care for your dogs to earn XP — you can still look at everybody!','ตอนนี้คุณเลเวล '+(S.me.lvl|0)+' ดูแลน้องหมาเก็บ XP แล้วมาโหวตกันนะ — ดูน้องๆ ได้เหมือนเดิม!')}</small></div></div>`;
 const status=(me.guest||!me.canVote)?'':`<div class="ds-card ds-vs"><div class="ds-hr">${hearts(left,st.votes)}</div><div class="g"><b>${left?TT('You have '+left+' of '+st.votes+' votes left','เหลือ '+left+' จาก '+st.votes+' โหวต'):'💖 '+TT('All votes used — thank you, judge!','ใช้โหวตครบแล้ว ขอบคุณกรรมการมาก!')}</b>
  <small>${me.votes.length?TT('Tap a ♥ again to take it back.','กด ♥ ซ้ำเพื่อยกเลิกโหวต'):TT('Your first vote of the round pays +10 💰','โหวตแรกของรอบนี้ได้ +10 💰')} · ${TT('Vote counts stay secret until the results.','ยอดโหวตเป็นความลับจนกว่าจะประกาศผล')}</small></div></div>`;
 const warn=st.n<st.min?`<div class="ds-card ds-lock">⚠️ <div class="g"><b>${TT('Only '+st.n+' dog'+(st.n==1?'':'s')+' entered','มีแค่ '+st.n+' ตัวที่สมัคร')}</b><small>${TT('A show needs at least '+st.min+' dogs, so this round will be cancelled.','การประกวดต้องมีอย่างน้อย '+st.min+' ตัว รอบนี้จึงจะถูกยกเลิก')}</small></div></div>`:'';
 const card=e=>{const d=e.d,mine=isMe(e.n),voted=me.votes.includes(e.n),can=!me.guest&&me.canVote,full=!voted&&left<=0;
  return`<div class="ds-c r-${rarOf(d)} ${voted?'voted':''} ${mine?'mine':''}">${mine?`<span class="ds-tg">💖 ${TT('yours','ของคุณ')}</span>`:''}${cr.has(d.id)?'<span class="ds-cw">👑</span>':''}
  <div class="ds-art">${art(d,56,'ds-live')}</div><b class="nm">${esc(d.name)} <i>${PERS_EM[d.pers]||''}</i></b><small class="brd">${bname(d)}</small><small class="ow">${TT('by','โดย')} ${mine?TT('you','คุณ'):esc(e.n)}</small>
  <div class="ds-chips">${chips(d,true)}</div>
  ${mine?`<div class="ds-vb self">${TT('your dog 🐾','น้องของคุณ 🐾')}</div>`:`<button class="btn ds-vb ${voted?'pink on':can&&!full?'ghost':'ghost shno'}" data-do="shVote" data-n="${esc(e.n)}" aria-pressed="${voted}">${voted?'♥ '+TT('Voted','โหวตแล้ว'):'♡ '+TT('Vote','โหวต')}</button>`}</div>`};
 return hero(st,true)+why+warn+status+(L.length?`<div class="ds-sech"><h4>🗳️ ${TT('The contestants','น้องๆ ที่เข้าประกวด')} <span class="pill">${L.length}</span></h4><span class="muted">${others.length?TT('Tap ♥ on your favourites','แตะ ♥ ที่น้องที่ชอบ'):TT('Only your dog is in so far','มีแค่น้องของคุณตัวเดียว')}</span></div><div class="ds-cgrid">${L.map(card).join('')}</div>`:`<div class="ds-card">${emptyState('ยังไม่มีน้องหมาลงประกวดรอบนี้เลย','No dogs signed up for this round.','🐾')}</div>`)}
// ---------------------------------------------------------------- results
function podium(top,st){const by=r=>top.find(x=>x.rank==r);
 const col=(r,big)=>{const x=by(r);if(!x)return'<div class="ds-pod empty"></div>';const d=x.d,mine=isMe(x.n);
  return`<div class="ds-pod p${r} ${mine?'me':''}" style="--d:${r==1?0:r==2?.25:.45}s"><div class="ds-medal">${MED[r-1]}</div><div class="ds-art">${art(d,big?64:48,r==1?'ds-live':'')}</div><b class="nm">${mine?'🎉 ':''}${esc(d.name)}</b><small>${TT('by','โดย')} ${mine?TT('you','คุณ'):esc(x.n)}</small>
  <div class="ds-step" data-r="${r}"><div class="ds-prz">${rewardTxt(x.r||{})}</div><div class="ds-st"><span>♥ ${x.v}<em>×3</em></span><span>✨ ${x.j}</span><b>${x.score}</b></div></div></div>`};
 return`<div class="ds-podium">${col(2)}${col(1,true)}${col(3)}</div>`}
function resRows(last,st,cur){const top=Array.isArray(last.top)?last.top:[];let rows=top.filter(x=>x.rank>3).map(x=>({n:x.n,d:x.d,v:x.v,j:x.j,score:x.score,rank:x.rank,r:x.r}));
 if(cur){const seen=new Set(top.map(x=>x.n));let k=top.length;for(const e of st.entries)if(!seen.has(e.n)){k++;rows.push({n:e.n,d:e.d,v:e.v,j:e.j,score:e.v*3+e.j,rank:k,r:st.prize&&st.prize.part||{}})}}
 if(!rows.length)return'';
 return`<div class="ds-sech"><h4>🎖️ ${TT('Everybody else','น้องๆ คนอื่นๆ')}</h4><span class="muted">${TT('Each one gets a participation prize','ทุกตัวได้รางวัลร่วมสนุก')}</span></div><div class="ds-rows">${rows.map(x=>`<div class="ds-row ${isMe(x.n)?'me':''}"><b class="rk">${x.rank}</b><div class="ds-art">${art(x.d,22)}</div><div class="g"><b>${esc(x.d.name)}</b><small>${isMe(x.n)?TT('you','คุณ'):esc(x.n)} · ${bname(x.d)}</small></div><span class="sc">♥ ${x.v}</span><span class="sc">✨ ${x.j}</span><strong>${x.score}</strong><span class="rw">${rewardTxt(x.r||{})}</span></div>`).join('')}</div>`+(!cur&&last.n>top.length?`<p class="ds-note">${TT('…and '+(last.n-top.length)+' more dogs got a participation prize.','…และอีก '+(last.n-top.length)+' ตัวที่ได้รางวัลร่วมสนุก')}</p>`:'')}
function cancelCard(last,st,cur){const n=last.cancel|0;
 return`<div class="ds-card ds-cancel"><div class="ds-cx">😿</div><h3>${cur?TT('No show this round','รอบนี้ไม่มีการประกวด'):TT('That show was cancelled','การประกวดรอบนั้นถูกยกเลิก')}</h3><p>${TT('A show needs at least '+st.min+' dogs, but only '+n+' signed up. Nobody lost anything — everyone can try again next round!','ต้องมีน้องหมาอย่างน้อย '+st.min+' ตัว แต่มาแค่ '+n+' ตัว ไม่มีใครเสียอะไรเลย รอบหน้ามาลองกันใหม่นะ!')}</p></div>`}
function myResult(last,st){const top=last.top||[],mine=top.find(x=>isMe(x.n));
 if(mine){const w=mine.rank<=3;return`<div class="ds-card ds-my ${w?'win':''}"><div class="ds-mm">${w?MED[mine.rank-1]:'🎖️'}</div><div class="g"><b>${w?TT('Congratulations! '+esc(mine.d.name)+' came '+['1st','2nd','3rd'][mine.rank-1]+'!','ยินดีด้วย! '+esc(mine.d.name)+' ได้ที่ '+mine.rank+'!'):TT(esc(mine.d.name)+' finished #'+mine.rank+' — thanks for joining!',esc(mine.d.name)+' ได้ที่ '+mine.rank+' — ขอบคุณที่ร่วมสนุกนะ!')}</b><small>${TT('Your prize','รางวัลของคุณ')}: ${rewardTxt(mine.r||{})}</small></div><button class="btn mint sm" data-do="mail">✉️ ${TT('Open Mail','เปิดกล่องจดหมาย')}</button></div>`}
 const e=st.entries.find(x=>isMe(x.n));if(e)return`<div class="ds-card ds-my"><div class="ds-mm">🎖️</div><div class="g"><b>${TT(esc(e.d.name)+' joined the show — thanks!',esc(e.d.name)+' ร่วมประกวดด้วย ขอบคุณนะ!')}</b><small>${TT('Your prize','รางวัลของคุณ')}: ${rewardTxt(st.prize&&st.prize.part||{})}</small></div><button class="btn mint sm" data-do="mail">✉️ ${TT('Open Mail','เปิดกล่องจดหมาย')}</button></div>`;
 return''}
function resultsOf(last,st,cur){
 if(!last)return`<div class="ds-card">${emptyState('ยังไม่มีผลประกวดเลย รอรอบแรกกันนะ!','No results yet — wait for the first show!','🏆')}</div>`;
 if(last.cancel!==undefined)return cancelCard(last,st,cur);
 const top=Array.isArray(last.top)?last.top:[];
 return`<div class="ds-stage res"><div class="ds-flags"></div><div class="ds-spot"></div><div class="ds-curt l"></div><div class="ds-curt r"></div><div class="ds-rt">🏆 ${TT('Winners','ผู้ชนะ')} · ${roundName(last.id,st)}${last.n?` · ${TT(last.n+' dogs',last.n+' ตัว')}`:''}</div>${podium(top,st)}<div class="ds-floor"></div></div>`+(cur?myResult(last,st):'')+scoreExplain()+resRows(last,st,cur)}
function viewResult(st){const last=st.last&&st.last.id===st.id?st.last:null;
 if(!last)return hero(st)+`<div class="ds-card ds-load"><div class="ds-pup">🐶</div>${TT('The judges are counting the votes…','กรรมการกำลังนับคะแนน…')}</div>`;
 return resultsOf(last,st,true)}
function viewPrev(st){return`<div class="ds-sech"><h4>📜 ${TT('Last round','รอบที่แล้ว')}</h4></div>`+resultsOf(st.last,st,false)}
function viewHall(st){const hall=Array.isArray(st.hall)?st.hall:[],cr=crownedIds(st);
 const head=`<div class="ds-sech"><h4>🏛️ ${TT('Hall of Fame','หอเกียรติยศ')}</h4><span class="muted">${TT('The last champions of the show','แชมเปี้ยนจากการประกวดล่าสุด')}</span></div>`;
 if(!hall.length)return head+`<div class="ds-card">${emptyState('หอเกียรติยศยังว่างอยู่ เป็นแชมเปี้ยนคนแรกกันเถอะ!','The Hall of Fame is empty — be the first champion!','🏛️')}</div>`;
 return head+`<div class="ds-hall">${hall.map((h,i)=>{const d=h.d||{},mine=isMe(h.n);return`<div class="ds-hf ${i==0?'first':''} ${mine?'me':''}"><div class="ds-hfa">${cr.has(d.id)?'<span class="ds-cw">👑</span>':''}<div class="ds-art">${art(d,i==0?48:38,i==0?'ds-live':'')}</div></div><div class="g"><b>${esc(d.name)} ${i==0?`<em>${TT('latest champion','แชมป์ล่าสุด')}</em>`:''}</b><small>${TT('by','โดย')} ${mine?TT('you','คุณ'):esc(h.n)} · ${bname(d)}</small></div><div class="ds-hs"><span>♥ ${h.v|0}</span><b>${h.score|0}</b></div><div class="ds-hd">${roundName(h.id,st)}</div></div>`}).join('')}</div>`}
// ---------------------------------------------------------------- top bar + window
function topBar(st,tab){const p=ph0(st.ph),m=PH[p],fe=Sh.fr.e*100,fv=(Sh.fr.v-Sh.fr.e)*100,fr=(1-Sh.fr.v)*100;
 const tabs=[['today',m.e,TT('This round','รอบนี้')],...(p=='result'?[]:[['prev','📜',TT('Last round','รอบที่แล้ว')]]),['hall','🏛️',TT('Hall of Fame','หอเกียรติยศ')]];
 return`<div class="ds-top ph-${p}"><div class="ds-lf"><div class="ds-bar"><div class="ds-ph"><span class="ds-pe">${m.e}</span><div class="g"><b>${TT(m.ben,m.bth)}</b><small>${TT(m.cen,m.cth)}</small></div></div><div class="ds-clock" data-dsclock>${clock(rem())}</div></div>
 <div class="ds-track" aria-hidden="true"><i class="sg e ${p=='enter'?'ds-now':''}" style="flex:${fe}">${PH.enter.e}<span> ${TT(PH.enter.en,PH.enter.th)}</span></i><i class="sg v ${p=='vote'?'ds-now':''}" style="flex:${fv}">${PH.vote.e}<span> ${TT(PH.vote.en,PH.vote.th)}</span></i><i class="sg r ${p=='result'?'ds-now':''}" style="flex:${fr}">${PH.result.e}<span> ${TT(PH.result.en,PH.result.th)}</span></i><u class="fl" data-dsfill style="width:${(pos()*100).toFixed(2)}%"></u><s class="mk" data-dsmark style="left:${(pos()*100).toFixed(2)}%">🐶</s></div></div>
 <div class="tabs2 ds-tabs" role="tablist">${tabs.map(([k,e,l])=>`<button role="tab" aria-selected="${tab==k}" class="${tab==k?'on':''}" data-do="shTab" data-k="${k}">${e} ${l}</button>`).join('')}</div></div>`}
function loadingView(){const late=Sh.openAt&&Date.now()-Sh.openAt>4500;
 return`<div class="ds-body"><div class="ds-card ds-load"><div class="ds-pup">🐶</div>${TT('Setting up the stage…','กำลังจัดเวทีประกวด…')}${late?`<div class="ds-rt2"><p class="muted">${TT('Can\'t reach the show right now.','ยังติดต่อเวทีประกวดไม่ได้เลย')}</p><button class="btn sky sm" data-do="shRetry">🔄 ${TT('Try again','ลองใหม่')}</button></div>`:''}</div></div>`}
function render(force){if(!force&&!modOpen(ID))return;const st=Sh.st,title='👑 '+TT('Dog Show','ประกวดน้องหมา');let body,tab=Sh.tab;
 if(!st){body=loadingView();setTimeout(()=>{if(modOpen(ID)&&!Sh.st)render()},4700)}
 else{const p=ph0(st.ph);if(tab=='prev'&&p=='result')tab='today';
  const v=tab=='hall'?viewHall(st):tab=='prev'?viewPrev(st):p=='enter'?viewEnter(st):p=='vote'?viewVote(st):viewResult(st);
  body=topBar(st,tab)+`<div class="ds-body ${tab=='today'?'t-'+p:''}">${v}${tab=='today'?guide(st):''}</div>`}
 const view=st?tab+'|'+ph0(st.ph)+'|'+st.id:'load',fresh=Sh.view!==view;Sh.view=view;
 const ov=modal(ID,title,body,'lg ds-win');if(st)Sh.sig=sigOf(st);
 if(fresh){const mb=ov&&ov.querySelector('.mb');if(mb)mb.scrollTop=0}   // a different page (tab / phase / round): start at the top, not where the last page was scrolled
 paintThumbs(ov);collectLive();tickNow();celebrate(st)}
// ---------------------------------------------------------------- live (animated) dogs: a few canvases are redrawn with the real sprite; everything else is a still thumbnail with a CSS bob
function collectLive(){const st=Sh.st,M=Sh.liveMap={};if(!st)return;const add=d=>{if(d&&d.breed)M[DOGS.k(d)]=d};for(const e of st.entries)add(e.d);add(st.me.entered);if(st.last&&Array.isArray(st.last.top))for(const x of st.last.top)add(x.d);if(Array.isArray(st.hall))for(const h of st.hall)add(h.d)}
function liveDraw(cv,d,t,i){const g=cv.getContext('2d'),b=DOGS.b(d),D=window.DOGPIX;if(!b||!D)return;
 const f=DOGS.frame(b,d.variant||'Normal','happy',0,d.acc),bb=f.bb,K=D.PX,W=cv.width,Hh=cv.height,bw=(bb.x1-bb.x0)*K,bh=(bb.y1-bb.y0)*K;if(!(bw>0&&bh>0))return;
 const s=Math.min(W*.86/bw,Hh*.8/bh);g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,W,Hh);g.save();g.imageSmoothingEnabled=false;
 g.translate(W/2-((bb.x0+bb.x1)/2-D.GX)*K*s,Hh*.9-(bb.y1-D.GY-1)*K*s);g.scale(s,s);
 g.fillStyle='rgba(70,45,35,.16)';g.beginPath();g.ellipse((((bb.x0+bb.x1)/2)-D.GX)*K,(bb.y1-D.GY-1)*K+2,bw*.42,6,0,0,7);g.fill();
 DOGS.sprite(g,b,d.variant||'Normal',t,{state:'IDLE',pet:1,acc:d.acc,seed:i+2,noAura:1});g.restore()}
function startLive(){if(Sh.raf||mm.matches)return;const t0=performance.now();
 const loop=()=>{Sh.raf=0;const ov=modOpen(ID);if(!ov||Sh.liveOff)return;Sh.raf=requestAnimationFrame(loop);if(document.hidden)return;
  const tt=(performance.now()-t0)/1000;let i=0;
  for(const cv of $$('canvas.ds-live[data-th]',ov)){const d=Sh.liveMap&&Sh.liveMap[cv.dataset.th.split('|')[0]];if(!d)continue;try{liveDraw(cv,d,tt+i*.37,i++)}catch(e){Sh.liveOff=true;break}}};
 Sh.raf=requestAnimationFrame(loop)}
function stopLive(){cancelAnimationFrame(Sh.raf);Sh.raf=0}
// ---------------------------------------------------------------- confetti (once per round, only when I won a place; not with reduced motion)
function celebrate(st){if(!st||ph0(st.ph)!='result'||Sh.tab=='hall'||Sh.tab=='prev')return;const last=st.last;if(!last||last.id!==st.id||!Array.isArray(last.top))return;
 const mine=last.top.find(x=>isMe(x.n));if(!mine||mine.rank>3)return;if(LS.get('cd_shconf',null)===st.id)return;LS.set('cd_shconf',st.id);
 sfx('level');setTimeout(()=>sfx('win'),350);confetti()}
function confetti(){const ov=modOpen(ID);if(!ov||mm.matches)return;const host=$('.panel',ov),cv=document.createElement('canvas');cv.className='ds-conf';const r=host.getBoundingClientRect(),W=cv.width=Math.max(50,Math.round(r.width)),Hh=cv.height=Math.max(50,Math.round(r.height));host.append(cv);
 const g=cv.getContext('2d'),cols=['#ff8fb0','#ffc94d','#6fd1a5','#6fb8ff','#b79bff','#ffffff'],P=Array.from({length:Math.min(110,Math.round(W/7))},()=>({x:Math.random()*W,y:-Math.random()*Hh*.6-10,vx:(Math.random()-.5)*90,vy:80+Math.random()*160,w:5+Math.random()*6,h:3+Math.random()*4,c:cols[Math.floor(Math.random()*cols.length)],a:Math.random()*6.28,va:(Math.random()-.5)*10,ph:Math.random()*6.28,dot:Math.random()<.3}));
 const t0=performance.now();let last=t0;const loop=ts=>{if(!cv.isConnected)return;const dt=Math.min(.05,(ts-last)/1000);last=ts;const el=ts-t0;g.clearRect(0,0,W,Hh);
  for(const p of P){p.x+=(p.vx+Math.sin(el/400+p.ph)*30)*dt;p.y+=p.vy*dt;p.a+=p.va*dt;g.save();g.globalAlpha=Math.max(0,Math.min(1,(3600-el)/700));g.translate(p.x,p.y);g.rotate(p.a);g.fillStyle=p.c;if(p.dot){g.beginPath();g.arc(0,0,p.h,0,7);g.fill()}else g.fillRect(-p.w/2,-p.h/2,p.w,p.h);g.restore()}
  if(el<3600)requestAnimationFrame(loop);else cv.remove()};requestAnimationFrame(loop)}
})();
