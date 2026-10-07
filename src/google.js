// Cozy Dogs - sign in with Google (v6.3). Google's own button (Google Identity Services) gives the page an ID token; the SERVER checks it (see server.js).
// Shown only when the server has GOOGLE_CLIENT_ID set (GET /config.json); otherwise nothing on the screen changes.
const GSI={id:null,ready:false,failed:false};
const inAppBrowser=()=>/Instagram|FBAN|FBAV|FB_IAB|Line\/|MicroMessenger|TikTok|Snapchat|Twitter/i.test(navigator.userAgent||'');
function gLoad(){return new Promise((res,rej)=>{if(window.google&&google.accounts&&google.accounts.id)return res();
  const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.async=true;s.onload=()=>res();s.onerror=()=>rej(new Error('gsi'));document.head.append(s)})}
function gSetup(){if(GSI.ready)return true;if(!GSI.id||!window.google||!google.accounts||!google.accounts.id)return false;
  google.accounts.id.initialize({client_id:GSI.id,callback:gCallback,ux_mode:'popup',auto_select:false,cancel_on_tap_outside:true});GSI.ready=true;return true}
function gButton(el,o){if(!el||!gSetup())return false;el.innerHTML='';
  google.accounts.id.renderButton(el,Object.assign({type:'standard',theme:'outline',size:'large',shape:'pill',text:'signin_with',logo_alignment:'left',width:Math.max(200,Math.min(280,innerWidth-90)),locale:S.set.lang=='th'?'th':'en'},o||{}));return true}
function gCallback(r){if(!r||typeof r.credential!='string')return;
  if(S.loaded&&S.scr=='game'){send({t:'google_link',credential:r.credential});return}          // already playing: this is "link my Google account"
  doAuth({t:'google',credential:r.credential},'#lErr')}                                     // on the login screen: sign in
async function gInit(){
  try{const r=await fetch('/config.json',{cache:'no-store'});if(!r.ok)return;const c=await r.json();if(!c||typeof c.google!='string'||!c.google)return;GSI.id=c.google}catch{return}
  const box=$('#gBox');if(!box)return;box.classList.remove('hidden');
  const note=$('#gNote');if(note&&inAppBrowser()){note.textContent=TT('Google sign-in does not work inside the Instagram / Facebook / LINE browser. Open this page in Safari or Chrome.','Google ใช้ไม่ได้ในเบราว์เซอร์ของ Instagram / Facebook / LINE ให้เปิดหน้านี้ด้วย Safari หรือ Chrome แทน');note.classList.remove('hidden')}
  try{await gLoad();gButton($('#gBtn'))}catch{GSI.failed=true;if(note){note.textContent=TT('Could not load Google sign-in (check your connection).','โหลดปุ่ม Google ไม่สำเร็จ (ตรวจสอบอินเทอร์เน็ต)');note.classList.remove('hidden')}}}
// a NEW Google user: choose the game name
H.google_new=m=>{loginBusy(false);
  modal('gname','🐶 '+TT('Choose your game name','ตั้งชื่อในเกม'),`<div class="center"><p class="muted" style="font-weight:700;margin:0 0 8px">${TT('Signed in with Google','เข้าสู่ระบบด้วย Google แล้ว')}: <b>${esc(m.email||'')}</b></p>
   <label class="fld"><span>${TT('Game name (3-16 letters, numbers or _)','ชื่อในเกม (3-16 ตัว ตัวอักษร ตัวเลข หรือ _)')}</span><input id="gName" maxlength="16" autocapitalize="off" autocorrect="off" spellcheck="false" value="${esc(m.name||'')}"></label>
   <div class="err" id="gErr"></div><button class="btn mint" data-do="gnamego">▶ ${TT('Start playing','เริ่มเล่น')}</button></div>`,'sm',{lock:true});
  const i=$('#gName');if(i){i.onkeydown=e=>{if(e.key=='Enter'){e.preventDefault();DO.gnamego()}};setTimeout(()=>{try{i.focus();i.select()}catch{}},60)}};
DO.gnamego=()=>{const i=$('#gName');if(!i)return;const e=$('#gErr');if(e)e.textContent='';loginBusy(true);send({t:'google_name',user:i.value.trim()})};
H.google_linked=m=>{S.me.gl=m.email||'1';sfx('ok');toast('✅ '+TT('Google account linked','ผูกบัญชี Google แล้ว')+(m.email?': '+m.email:''),3600);if(modOpen('settings'))renderSettings()};
// the "Settings" row: link Google to this account / shows that it is linked
function gSettingsRow(){if(!GSI.id||S.guest)return'';
  return`<div style="margin:12px 0 4px;font-weight:900">🔗 Google</div>`+(S.me.gl?`<div class="toggle"><span>✅ ${TT('Linked','ผูกแล้ว')}${S.me.gl&&S.me.gl!='1'?': '+esc(S.me.gl):''}</span></div>`
   :`<div class="muted" style="font-size:11.5px;font-weight:700;margin-bottom:6px">${TT('Link your Google account to sign in with it too (your game stays the same).','ผูกบัญชี Google เพื่อใช้ล็อกอินได้อีกทาง (ข้อมูลเกมเดิมไม่หาย)')}</div><div id="gLink" style="min-height:44px;display:flex;justify-content:center"></div>`)}
function gSettingsAfter(){const el=$('#gLink');if(!el)return;if(GSI.ready||gSetup()){gButton(el,{text:'continue_with',width:Math.max(200,Math.min(260,innerWidth-110))});return}
  if(GSI.id&&!GSI.failed)gLoad().then(()=>gButton($('#gLink'),{text:'continue_with',width:240})).catch(()=>{GSI.failed=true;const e=$('#gLink');if(e)e.textContent=TT('Could not load Google sign-in.','โหลดปุ่ม Google ไม่สำเร็จ')})}
window.gLangHook=()=>{if(GSI.ready){const b=$('#gBtn');if(b&&b.firstChild)gButton(b)}};      // the language was switched: draw Google's button again in that language (applyLang runs before this file, hence the window hook)
gInit();
