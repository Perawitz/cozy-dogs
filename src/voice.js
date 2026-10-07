// Cozy Dogs - park voice chat, CLIENT (v7): peer-to-peer WebRTC audio, the game server only relays the signalling (see voice.js for the full networking notes).
//  * Opt-in: the microphone is requested only when the player presses the 🎤 button, and everything (tracks, peer connections, audio elements) is released on leaving.
//  * Full mesh: one RTCPeerConnection per other person in the room (N*(N-1)/2 links, uplink = (N-1) x ~32 kbit/s Opus -> the server caps the room at 8).
//  * Signalling = our existing WebSocket: voice_join -> voice_state {peers} -> the NEWCOMER sends an offer to each peer (no offer collisions "glare"), existing members only
//    answer. ICE is NON-trickle: wait for icegatheringstate 'complete' (or 2.5 s) and send ONE offer/answer holding every candidate (host / srflx from STUN / relay from TURN);
//    candidates found after the timeout are trickled as a few small 'ice' messages. Outgoing signalling is queued at <= 10/s (the server drops > 20 messages/s per socket).
//  * Media is encrypted by the browser (DTLS-SRTP). Remote audio goes <audio muted> (keeps the stream flowing in Chrome) -> WebAudio GainNode (iOS ignores audio.volume),
//    the gain follows the distance between the two dogs in the park (proximity chat). AnalyserNodes drive the "speaking" icons.
(()=>{'use strict';
const DEF_ICE=[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}];
const V={on:false,st:'off',max:8,ice:null,peers:Object.create(null),q:[],job:0,gen:1,stream:null,track:null,muted:false,lvl:0,spk:false,spkT:0,ctx:null,mode:'web',ws:null,lastSig:0,
 pref:(()=>{const p=LS.get('cd_voice',null)||{},o=x=>x&&typeof x=='object'&&!Array.isArray(x)?x:{};return{prox:p.prox!==false,vol:o(p.vol),mute:o(p.mute)}})()};
window.Voice=window.__voice=V;
const savePref=()=>{const keep=o=>Object.fromEntries(Object.entries(o).slice(-60));LS.set('cd_voice',{prox:V.pref.prox,vol:keep(V.pref.vol),mute:keep(V.pref.mute)})};
const pcState=pc=>pc.connectionState||({checking:'connecting',completed:'connected'}[pc.iceConnectionState]||pc.iceConnectionState);
const live=()=>Object.values(V.peers);
// ---------------------------------------------------------------- audio helpers
function sinkNode(){if(!V.sinkN||V.sinkN.context!==V.ctx){V.sinkN=V.ctx.createGain();V.sinkN.gain.value=0;V.sinkN.connect(V.ctx.destination)}return V.sinkN}      // analysers hang here (silent) so every browser keeps pulling them
const rms=an=>{const b=an._b||(an._b=new Uint8Array(an.fftSize));an.getByteTimeDomainData(b);let s=0;for(let i=0;i<b.length;i++){const x=(b[i]-128)/128;s+=x*x}return Math.sqrt(s/b.length)};
const tap=(src,ctx)=>{const an=ctx.createAnalyser();an.fftSize=512;src.connect(an);an.connect(sinkNode());return an};
function proxGain(p){const m=Park.m[p.n],me=Park.m[Park.me];let g=1;      // proximity chat: full volume within 150 px, fading linearly to 15 % at 600 px (park world units)
 if(V.pref.prox&&m&&me&&m.rx!=null&&me.rx!=null){const d=Math.hypot(m.rx-me.rx,m.ry-me.ry);g=d<=150?1:d>=600?.15:1-.85*(d-150)/450}
 return p.lmute?0:g*clamp(+p.vol,0,1)}
function applyGain(p,now){const g=p.target=proxGain(p);
 if(p.gain){const gp=p.gain.gain,t=V.ctx.currentTime;if(now){gp.cancelScheduledValues(t);gp.setValueAtTime(g,t)}else gp.setTargetAtTime(g,t,.08)}      // smooth: no clicks while the dogs move
 else if(p.audio)p.audio.volume=clamp(g,0,1)}
function detach(p){if(p.audio){p.audio.pause();p.audio.srcObject=null;p.audio.remove();p.audio=null}
 for(const k of ['src','gain','an']){if(p[k]){try{p[k].disconnect()}catch{}p[k]=null}}}
function attach(p,stream){detach(p);
 let host=$('#voiceaudio');if(!host){host=document.createElement('div');host.id='voiceaudio';document.body.append(host)}
 const a=document.createElement('audio');a.autoplay=true;a.playsInline=true;a.setAttribute('playsinline','');a.srcObject=stream;host.append(a);p.audio=a;let web=false;
 if(V.ctx&&V.mode=='web'){try{p.src=V.ctx.createMediaStreamSource(stream);p.gain=V.ctx.createGain();p.gain.gain.value=0;p.src.connect(p.gain);p.gain.connect(V.ctx.destination);p.an=tap(p.src,V.ctx);web=true}
  catch{for(const k of ['src','gain','an']){if(p[k]){try{p[k].disconnect()}catch{}p[k]=null}}}}
 a.muted=web;      // WebAudio plays the sound (volume works on iOS); the element only keeps the remote stream flowing in Chrome. Without WebAudio the element plays and audio.volume is used
 applyGain(p,true);const pl=a.play();if(pl&&pl.catch)pl.catch(()=>{})}
// ---------------------------------------------------------------- SDP helpers
function tune(sdp){      // Opus: DTX (silence costs ~nothing, so 7 uplinks of a quiet room are cheap) + a 32 kbit/s ceiling, mono
 try{const m=/^a=rtpmap:(\d+) opus\/48000[^\r\n]*/im.exec(sdp);if(!m)return sdp;const pt=m[1],add='usedtx=1;maxaveragebitrate=32000;stereo=0',re=new RegExp('^(a=fmtp:'+pt+' )([^\\r\\n]*)$','m');
  return re.test(sdp)?sdp.replace(re,(l,a,b)=>/usedtx/.test(b)?l:a+b+';'+add):sdp.replace(m[0],m[0]+'\r\na=fmtp:'+pt+' '+add)}catch{return sdp}}
function shrink(sdp){      // the server accepts <= 6500 chars (the socket 8192 bytes): drop tcp / late candidates if a many-interface machine made it too big
 if(sdp.length<=5800)return sdp;const L=sdp.split('\r\n'),tcp=l=>/ tcp /i.test(l),dead=new Set();let len=sdp.length;
 const c=L.map((l,i)=>[l,i]).filter(([l])=>l.startsWith('a=candidate')).sort((a,b)=>(tcp(b[0])-tcp(a[0]))||b[1]-a[1]);
 for(const [l,i] of c){if(len<=5800)break;dead.add(i);len-=l.length+2}return L.filter((_,i)=>!dead.has(i)).join('\r\n')}
const gathered=(pc,ms)=>new Promise(res=>{if(pc.iceGatheringState=='complete')return res();let t;const on=()=>{if(pc.iceGatheringState=='complete')fin()},fin=()=>{clearTimeout(t);pc.removeEventListener('icegatheringstatechange',on);res()};t=setTimeout(fin,ms);pc.addEventListener('icegatheringstatechange',on)});
function opusOnly(pc){try{const tr=pc.getTransceivers()[0],caps=RTCRtpReceiver.getCapabilities('audio');if(tr&&tr.setCodecPreferences&&caps){const o=caps.codecs.filter(c=>/opus/i.test(c.mimeType));if(o.length)tr.setCodecPreferences(o)}}catch{}}
// ---------------------------------------------------------------- signalling queue (<= 10 messages/s)
function sig(to,d){V.q.push([to,d]);pump()}
function pump(){if(V.pumpT)return;V.pumpT=setTimeout(()=>{V.pumpT=0;const it=V.q.shift();if(it&&V.on&&V.peers[it[0]]&&V.ws===S.ws&&send({t:'voice_sig',to:it[0],d:it[1]}))V.lastSig=performance.now();if(V.q.length)pump()},Math.max(0,V.lastSig+100-performance.now()))}
// ---------------------------------------------------------------- one RTCPeerConnection per person
function peer(n,role){let p=V.peers[n];if(!p){p=V.peers[n]={n,role,pc:null,g:0,audio:null,src:null,gain:null,an:null,spk:false,spkT:0,rms:0,rmuted:false,up:false,sent:false,nIce:0,pend:[],tries:0,target:1,link:'',rtt:0,t0:Date.now(),
  vol:clamp(+V.pref.vol[n]>=0?+V.pref.vol[n]:1,0,1),lmute:!!V.pref.mute[n]};p.waitT=setTimeout(()=>{if(V.peers[n]===p&&!p.pc&&!p.up)giveUp(p)},15000)}return p}
function closePC(p){clearTimeout(p.failT);clearTimeout(p.ansT);const pc=p.pc;p.pc=null;p.up=false;if(pc){pc.onicecandidate=pc.ontrack=pc.onconnectionstatechange=pc.oniceconnectionstatechange=null;try{pc.close()}catch{}}}
function dropPeer(n){const p=V.peers[n];if(!p)return;clearTimeout(p.waitT);closePC(p);detach(p);delete V.peers[n];const m=Park.m[n];if(m)m.vin=m.speaking=m.vmuted=false}
function makePC(p,g){closePC(p);clearTimeout(p.waitT);
 const pc=new RTCPeerConnection({iceServers:V.ice||DEF_ICE,bundlePolicy:'max-bundle',rtcpMuxPolicy:'require'});
 p.pc=pc;p.g=g;p.sent=false;p.nIce=0;p.pend=[];p.up=false;p.state='connecting';
 pc.addTrack(V.track,V.stream);opusOnly(pc);
 pc.ontrack=e=>{if(p.pc===pc&&e.track.kind=='audio')attach(p,(e.streams&&e.streams[0])||new MediaStream([e.track]))};
 pc.onicecandidate=e=>{if(!e.candidate||!p.sent||p.pc!==pc||p.nIce>=12)return;p.nIce++;sig(p.n,{k:'ice',c:e.candidate.toJSON?e.candidate.toJSON():e.candidate,g:p.g})};     // late candidates (after the 2.5 s timeout)
 const st=()=>{if(p.pc===pc)onState(p,pcState(pc))};pc.onconnectionstatechange=st;pc.oniceconnectionstatechange=st;
 return pc}
function onState(p,s){clearTimeout(p.failT);
 if(s=='connected'){p.up=true;p.state='connected';clearTimeout(p.ansT);p.tries=0;probeSoon(p)}
 else if(s=='failed')retry(p);
 else if(s=='disconnected'){p.state='connecting';p.failT=setTimeout(()=>{if(p.pc&&pcState(p.pc)!='connected')retry(p)},5000)}      // a Wi-Fi hiccup often heals by itself
 refreshPop()}
function retry(p){if(!V.on||V.peers[p.n]!==p)return;
 if(p.role=='offer'&&p.tries<1){p.tries++;offer(p).catch(()=>giveUp(p))}      // the OFFERER (the later joiner) recreates the link once - the answerer never starts a negotiation, so no glare
 else if(p.role=='answer'&&p.tries<1){p.tries++;closePC(p);p.state='connecting';p.waitT=setTimeout(()=>{if(V.peers[p.n]===p&&!p.up)giveUp(p)},15000)}      // ...and waits for the new offer
 else giveUp(p)}
function giveUp(p){if(V.peers[p.n]!==p||p.state=='failed')return;closePC(p);p.state='failed';toast('🎧 '+TT('Could not connect the voice link with '+p.n+' (a strict network or firewall may block direct connections)','เชื่อมต่อเสียงกับ '+p.n+' ไม่ได้ (เครือข่ายอาจบล็อกการเชื่อมต่อโดยตรง)'),5200);refreshPop()}
async function offer(p){const g=V.gen++,pc=makePC(p,g);p.role='offer';
 const o=await pc.createOffer();if(p.pc!==pc)return;
 try{await pc.setLocalDescription({type:'offer',sdp:tune(o.sdp)})}catch{await pc.setLocalDescription(o)}
 await gathered(pc,2500);if(p.pc!==pc||!V.on)return;
 p.sent=true;sig(p.n,{k:'offer',s:shrink(pc.localDescription.sdp),g});
 p.ansT=setTimeout(()=>{if(p.pc===pc&&!p.up)retry(p)},14000)}      // no answer / no connection in 14 s
async function onOffer(n,d){if(typeof d.s!='string')return;const p=peer(n,'answer');
 if(p.pc&&p.role=='offer'&&p.pc.signalingState!='stable'&&S.name<n)return;      // glare cannot happen by design; if it ever does, the smaller name keeps its offer
 const g=d.g|0;if(p.pc&&p.role=='answer'&&p.g===g&&p.sent)return;                // duplicate
 p.role='answer';const pc=makePC(p,g);
 await pc.setRemoteDescription({type:'offer',sdp:d.s});if(p.pc!==pc)return;await flush(p);
 const a=await pc.createAnswer();if(p.pc!==pc)return;
 try{await pc.setLocalDescription({type:'answer',sdp:tune(a.sdp)})}catch{await pc.setLocalDescription(a)}
 await gathered(pc,2500);if(p.pc!==pc||!V.on)return;
 p.sent=true;sig(n,{k:'answer',s:shrink(pc.localDescription.sdp),g});
 p.ansT=setTimeout(()=>{if(p.pc===pc&&!p.up)retry(p)},14000)}
async function onAnswer(n,d){const p=V.peers[n];if(!p||!p.pc||p.role!='offer'||(d.g|0)!==p.g||p.pc.signalingState!='have-local-offer'||typeof d.s!='string')return;
 const pc=p.pc;await pc.setRemoteDescription({type:'answer',sdp:d.s});if(p.pc!==pc)return;await flush(p)}
async function flush(p){const pc=p.pc,l=p.pend;p.pend=[];for(const c of l){try{await pc.addIceCandidate(c)}catch{}}}
function onIce(n,d){const p=V.peers[n];if(!p||!p.pc||(d.g|0)!==p.g||!d.c||typeof d.c!='object')return;
 if(p.pc.remoteDescription)p.pc.addIceCandidate(d.c).catch(()=>{});else if(p.pend.length<24)p.pend.push(d.c)}      // arrived before the offer/answer was applied: keep it
// ---------------------------------------------------------------- start / stop
const supportErr=()=>typeof RTCPeerConnection=='undefined'?'unsupported':(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia)?(window.isSecureContext===false?'insecure':'unsupported'):null;
const ERR={insecure:['🔒 คุยด้วยเสียงต้องเปิดเกมผ่าน https หรือ localhost เท่านั้น (เบราว์เซอร์ไม่ให้ใช้ไมโครโฟนบนหน้าเว็บที่ไม่ปลอดภัย)','🔒 Voice chat needs https (or localhost): browsers block the microphone on insecure pages'],
 unsupported:['🎤 ใช้ไมโครโฟนไม่ได้ในหน้านี้ — ต้องเปิดผ่าน https (หรือ localhost) และเบราว์เซอร์ในแอปอย่าง LINE / Instagram มักไม่รองรับ ลองเปิดด้วย Chrome หรือ Safari','🎤 The microphone is not available here - it needs https (or localhost), and in-app browsers such as LINE / Instagram usually cannot do it. Try Chrome or Safari'],
 NotAllowedError:['🎤 ยังไม่ได้อนุญาตให้ใช้ไมโครโฟน — กดรูปแม่กุญแจข้างช่องที่อยู่เว็บ แล้วเลือก “อนุญาต” ไมโครโฟน','🎤 The microphone is blocked - tap the lock icon next to the address and choose Allow for the microphone'],
 NotFoundError:['🎤 ไม่พบไมโครโฟนในอุปกรณ์นี้ ลองเสียบหูฟังหรือไมค์แล้วลองใหม่','🎤 No microphone found on this device - plug one in and try again'],
 NotReadableError:['🎤 เปิดไมโครโฟนไม่ได้ — อาจมีแอปอื่นกำลังใช้อยู่ ปิดแอปนั้นแล้วลองใหม่','🎤 The microphone is busy - another app may be using it. Close it and try again'],
 other:['🎤 เปิดไมโครโฟนไม่สำเร็จ ลองใหม่อีกครั้งนะ','🎤 Could not open the microphone - please try again']};
function fail(k){const alias={SecurityError:'NotAllowedError',PermissionDeniedError:'NotAllowedError',DevicesNotFoundError:'NotFoundError',TrackStartError:'NotReadableError'};k=alias[k]||k;const e=ERR[k]||ERR.other;toast(TT(e[1],e[0]),6500);
 if(k=='NotAllowedError')modal('voicehelp','🎤 '+TT('Allow the microphone','อนุญาตให้ใช้ไมโครโฟน'),`<div class="vintro"><p>${TT('The browser is not letting this page use the microphone. To fix it:','เบราว์เซอร์ไม่ให้เกมใช้ไมโครโฟน วิธีแก้:')}</p><ol><li>${TT('Tap the lock icon (🔒) next to the address bar.','กดรูปแม่กุญแจ (🔒) ข้างช่องที่อยู่เว็บ')}</li><li>${TT('Find “Microphone” and choose “Allow”.','หาคำว่า “ไมโครโฟน” แล้วเลือก “อนุญาต”')}</li><li>${TT('Reload this page, join the park and tap 🎤 again.','รีเฟรชหน้านี้ เข้าสวนแล้วกด 🎤 อีกครั้ง')}</li></ol><p class="muted">${TT('iPhone: Settings › Safari › Microphone › Ask / Allow.','iPhone: ตั้งค่า › Safari › ไมโครโฟน › ถาม / อนุญาต')}</p><div class="row"><button class="btn mint" data-do="closemod" data-id="voicehelp">OK</button></div></div>`,'sm')}
function intro(){modal('voicehi','🎤 '+TT('Voice chat in the park','คุยด้วยเสียงในสวน'),`<div class="vintro"><p class="big">${TT('Talk with the other players in the park!','คุยกับเพื่อน ๆ ในสวนด้วยเสียงได้เลย!')}</p><ul>
<li><b>🔗</b>${TT('Your voice goes straight to the other players (peer-to-peer), not through the game server.','เสียงของคุณส่งตรงถึงเพื่อน (peer-to-peer) ไม่ผ่านเซิร์ฟเวอร์เกม')}</li>
<li><b>🌳</b>${TT('Only people in the park who joined can hear you (max 8).','ได้ยินกันเฉพาะคนในสวนที่กดเข้าร่วม (สูงสุด 8 คน)')}</li>
<li><b>📍</b>${TT('The farther away a dog is, the quieter it sounds.','ยิ่งน้องหมาอยู่ไกลกัน เสียงก็ยิ่งเบาลง')}</li>
<li><b>🔒</b>${TT('Needs https (or localhost) and your permission to use the microphone.','ต้องเปิดผ่าน https (หรือ localhost) และอนุญาตให้ใช้ไมโครโฟน')}</li>
<li><b>🔇</b>${TT('You can mute any time. The microphone closes when you leave the park.','ปิดไมค์ได้ทุกเมื่อ และไมค์จะปิดเองเมื่อออกจากสวน')}</li>
<li><b>🌐</b>${TT('People in the voice room can see each other\'s IP address, like in any peer-to-peer call.','คนในห้องเสียงจะเห็นที่อยู่ IP ของกันและกัน เหมือนการโทรแบบ P2P ทั่วไป')}</li></ul>
<div class="row"><button class="btn mint" data-do="voiceok">🎤 ${TT('Join now','เข้าร่วมเลย')}</button><button class="btn ghost" data-do="closemod" data-id="voicehi">${TT('Not now','ไว้ก่อน')}</button></div></div>`,'sm')}
async function join(){
 if(V.st!='off')return;
 if(!Park.on)return toast('🌳 '+TT('Go to the park first to use voice chat','ต้องอยู่ในสวนสาธารณะก่อนถึงจะคุยด้วยเสียงได้'));
 const se=supportErr();if(se)return fail(se);
 if(!S.ws||S.ws.readyState!=1)return toast(TT('Not connected yet - try again in a moment','ยังไม่ได้เชื่อมต่อ — ลองใหม่อีกครั้งนะ'));
 V.st='asking';const job=++V.job;ui();let stream;
 try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false})}
 catch(e){if(job===V.job){V.st='off';ui();fail(e&&e.name||'')}return}
 const track=stream.getAudioTracks()[0];
 if(job!==V.job||!Park.on||!S.ws||S.ws.readyState!=1||!track){stream.getTracks().forEach(t=>t.stop());if(job===V.job){V.st='off';ui();if(!track)fail('NotFoundError')}return}      // left the park / lost the connection while the permission prompt was open
 V.stream=stream;V.track=track;V.muted=false;V.ctx=actx();V.mode=V.ctx&&V.ctx.createMediaStreamSource?'web':'el';
 track.onended=()=>{if(V.track===track)stop(true,TT('The microphone stopped working','ไมโครโฟนหยุดทำงาน — ออกจากห้องเสียงแล้ว'))};
 if(V.mode=='web'){try{V.msrc=V.ctx.createMediaStreamSource(stream);V.man=tap(V.msrc,V.ctx)}catch{V.man=null}}
 V.ws=S.ws;V.wsClose=()=>stop(false,TT('Voice room closed - the connection was lost. Tap 🎤 to join again','ห้องเสียงถูกตัดเพราะการเชื่อมต่อหลุด — กด 🎤 เพื่อเข้าใหม่อีกครั้ง'));V.ws.addEventListener('close',V.wsClose);
 V.st='joining';ui();send({t:'voice_join'});
 V.joinT=setTimeout(()=>{if(V.st=='joining'){stop(true);toast(TT('Could not join the voice room - try again','เข้าห้องเสียงไม่สำเร็จ ลองใหม่อีกครั้งนะ'),4000)}},6000)}
function stop(notify,msg){      // release EVERYTHING: peer connections, audio elements, WebAudio nodes, the microphone
 const was=V.st!='off';V.job++;clearTimeout(V.joinT);clearTimeout(V.pumpT);V.pumpT=0;clearInterval(V.lvT);clearInterval(V.pxT);clearInterval(V.popT);V.lvT=V.pxT=V.popT=0;
 for(const n of Object.keys(V.peers))dropPeer(n);
 if(V.stream)for(const t of V.stream.getTracks()){t.onended=null;try{t.stop()}catch{}}
 for(const k of ['msrc','man']){if(V[k]){try{V[k].disconnect()}catch{}V[k]=null}}
 V.stream=V.track=null;V.q.length=0;
 if(V.ws){V.ws.removeEventListener('close',V.wsClose);V.ws=null}
 if(notify&&was&&S.ws&&S.ws.readyState==1)send({t:'voice_leave'});
 V.on=false;V.st='off';V.muted=false;V.spk=false;V.lvl=0;flags();ui();closePop();
 if(was&&msg)toast(msg,3600)}
// ---------------------------------------------------------------- messages from the server
H.voice_state=m=>{
 if(!m.on){if(V.st=='joining'||V.st=='on'){const park=m.why=='park'&&V.st=='joining';stop(false);if(park)toast('🌳 '+TT('Go to the park first to use voice chat','ต้องอยู่ในสวนสาธารณะก่อนถึงจะคุยด้วยเสียงได้'))}return}
 if(V.st=='joining'||V.st=='on'){
  const first=V.st=='joining';clearTimeout(V.joinT);V.st='on';V.on=true;V.max=m.max|0||8;V.ice=Array.isArray(m.ice)?m.ice:(V.ice||DEF_ICE);
  const names=(Array.isArray(m.peers)?m.peers:[]).filter(n=>typeof n=='string'&&n!==S.name).slice(0,V.max),mu=Array.isArray(m.muted)?m.muted:[];
  for(const n of Object.keys(V.peers))if(!names.includes(n))dropPeer(n);
  for(const n of names){const had=!!V.peers[n],p=peer(n,'offer');p.rmuted=mu.includes(n);if(!had||(!p.pc&&p.role=='offer'&&!p.up&&p.state!='failed')){p.role='offer';offer(p).catch(()=>giveUp(p))}}      // I am the newcomer: I make the offers
  if(first){V.lvT=setInterval(tick,100);V.pxT=setInterval(prox,200);sfx('ok');toast('🎧 '+TT('Joined the voice room','เข้าร่วมห้องเสียงแล้ว')+(names.length?' · '+(names.length+1)+'/'+V.max:''),2600)}
  flags();ui();refreshPop(true)}
 else send({t:'voice_leave'})}      // a stale "on" (I gave up while the server was answering): leave again
H.voice_full=m=>{if(V.st=='joining'){stop(false);toast('🎧 '+TT('The voice room is full (max '+(m.max|0||8)+') - try again later','ห้องเสียงเต็มแล้ว (สูงสุด '+(m.max|0||8)+' คน) ลองใหม่ภายหลังนะ'),4500)}};
H.voice_peer=m=>{if(!V.on||typeof m.n!='string'||m.n===S.name)return;
 if(m.joined===true){if(!V.peers[m.n]){peer(m.n,'answer');ticker('🎧 '+m.n+TT(' joined the voice room',' เข้าร่วมห้องเสียง'));sfx('notify')}}      // existing members just wait for the newcomer's offer
 else if(m.joined===false){if(V.peers[m.n]){dropPeer(m.n);sfx('pop')}}
 else if(typeof m.muted=='boolean'){const p=V.peers[m.n];if(p)p.rmuted=m.muted}
 flags();ui();refreshPop(true)};
H.voice_sig=m=>{if(!V.on||typeof m.from!='string'||m.from===S.name||!m.d||typeof m.d!='object')return;const d=m.d,n=m.from,ko=e=>{const p=V.peers[n];if(p)retry(p)};
 try{if(d.k=='offer')onOffer(n,d).catch(ko);else if(d.k=='answer')onAnswer(n,d).catch(ko);else if(d.k=='ice')onIce(n,d)}catch{}};
// ---------------------------------------------------------------- 10 Hz: speaking indicators, 5 Hz: proximity volume
function flags(){for(const m of Object.values(Park.m)){if(m.me){m.vin=V.on;m.speaking=V.on&&V.spk&&!V.muted;m.vmuted=V.on&&V.muted}else{const p=V.peers[m.n];m.vin=!!p;m.speaking=!!(p&&p.spk&&!p.rmuted);m.vmuted=!!(p&&p.rmuted)}}}
function tick(){const now=performance.now();
 if(V.man){V.lvl=V.muted?0:rms(V.man);if(V.lvl>(V.spk?.012:.025))V.spkT=now+350;V.spk=now<V.spkT}
 for(const p of live()){if(!p.an)continue;p.rms=rms(p.an);if(p.rms>(p.spk?.012:.025))p.spkT=now+350;p.spk=now<p.spkT}
 flags();const on=V.on&&V.spk&&!V.muted;for(const b of $$('.vbtn.on'))b.classList.toggle('spk',on);
 const pop=$('#voicepop');if(pop&&!pop.classList.contains('hidden')){const u=$('.vlvl u',pop);if(u)u.style.width=Math.min(100,Math.round(V.lvl*400))+'%';for(const p of live()){const r=$(`.vp[data-n="${CSS.escape(p.n)}"] .vdot`,pop);if(r)r.classList.toggle('spk',!!p.spk&&!p.rmuted)}}}
function prox(){for(const p of live())applyGain(p,false);if(V.ctx&&V.ctx.state!='running'&&V.on)V.ctx.resume().catch(()=>{})}
// ---------------------------------------------------------------- connection statistics (also for the popover and the tests)
async function probe(p){const o={n:p.n,role:p.role,state:p.pc?pcState(p.pc):p.state||'none',up:p.up,g:p.g,target:p.target,rms:p.rms,speaking:!!p.spk,muted:!!p.rmuted,gain:p.gain?p.gain.gain.value:null};
 if(!p.pc)return o;
 try{const rep=await p.pc.getStats(),by={};rep.forEach(r=>by[r.id]=r);let pair=null;
  rep.forEach(r=>{const kind=r.kind||r.mediaType;
   if(r.type=='inbound-rtp'&&kind=='audio'){o.bytesReceived=r.bytesReceived;o.packetsReceived=r.packetsReceived;o.packetsLost=r.packetsLost;o.jitter=r.jitter;o.audioLevel=r.audioLevel;o.totalAudioEnergy=r.totalAudioEnergy}
   else if(r.type=='outbound-rtp'&&kind=='audio'){o.bytesSent=r.bytesSent;o.packetsSent=r.packetsSent}
   else if(r.type=='transport'&&r.selectedCandidatePairId)pair=by[r.selectedCandidatePairId];
   else if(r.type=='candidate-pair'&&!pair&&(r.selected||r.nominated)&&r.state=='succeeded')pair=r});
  if(pair){const l=by[pair.localCandidateId]||{},rm=by[pair.remoteCandidateId]||{},ty=[l.candidateType,rm.candidateType];o.rtt=pair.currentRoundTripTime!=null?Math.round(pair.currentRoundTripTime*1000):null;o.local=l.candidateType;o.remote=rm.candidateType;o.proto=l.protocol;
   o.link=ty.includes('relay')?'relay':ty.includes('srflx')||ty.includes('prflx')?'nat':'host'}}catch{}
 p.link=o.link||p.link;p.rtt=o.rtt!=null?o.rtt:p.rtt;return o}
V.stats=()=>Promise.all(live().map(probe));V.sig=sig;      // (stats + sig: used by browser_tests/voice.py)
V.live=()=>({peers:live().filter(p=>p.pc).length,tracks:V.stream?V.stream.getTracks().filter(t=>t.readyState=='live').length:0});
let probeT=0;function probeSoon(p){if(probeT)return;probeT=setTimeout(async()=>{probeT=0;if(V.on&&popOpen())await Promise.all(live().map(probe));refreshPop()},800)}
// ---------------------------------------------------------------- UI: park bar group, floating group (short landscape phones), settings popover
const gHTML=()=>{const busy=V.st=='asking'||V.st=='joining';
 if(!V.on)return`<button class="eb vbtn${busy?' busy':''}" data-do="voice" title="${esc(TT('Voice chat','คุยด้วยเสียง'))}" aria-label="${esc(TT('Join voice chat','เข้าร่วมคุยด้วยเสียง'))}">🎤</button>`;
 return`<button class="eb vbtn on${V.spk&&!V.muted?' spk':''}" data-do="voice" title="${esc(TT('Leave voice chat','ออกจากห้องเสียง'))}" aria-label="${esc(TT('Leave voice chat','ออกจากห้องเสียง'))}">🎤</button><button class="eb vmute${V.muted?' m':''}" data-do="voicemute" title="${esc(V.muted?TT('Unmute microphone','เปิดไมค์'):TT('Mute microphone','ปิดไมค์'))}" aria-label="${esc(V.muted?TT('Unmute microphone','เปิดไมค์'):TT('Mute microphone','ปิดไมค์'))}">${V.muted?'🔇':'🎙️'}</button><button class="eb vchip" data-do="voicepop" title="${esc(TT('People in voice - tap for settings','คนในห้องเสียง — แตะเพื่อตั้งค่า'))}" aria-label="${esc(TT('Voice settings','ตั้งค่าห้องเสียง'))}">🎧 ${1+live().length}</button>`};
function floatBar(){let f=$('#voicebar');if(!f){f=document.createElement('div');f.id='voicebar';f.className='panel hidden';const h=$('#hud');if(h)h.append(f)}return f}
function ui(){const f=floatBar();f.classList.toggle('hidden',!Park.on);for(const g of $$('.vgrp'))g.innerHTML=gHTML()}
{const _pb=UI.parkbar;UI.parkbar=function(){_pb.apply(this,arguments);const el=$('#parkbar');if(el&&Park.on&&!el.classList.contains('hidden'))el.insertAdjacentHTML('beforeend','<span class="sep vsep"></span><span class="vgrp"></span>');
 const f=floatBar();if(!f.firstChild)f.innerHTML='<span class="vgrp"></span>';ui()}}
const popOpen=()=>{const p=$('#voicepop');return !!p&&!p.classList.contains('hidden')};
function closePop(){const p=$('#voicepop');if(p)p.classList.add('hidden');clearInterval(V.popT);V.popT=0}
const LINK={host:['⚡','Direct (LAN)','ตรง (วงเดียวกัน)'],nat:['🌐','Peer-to-peer via NAT','ตรง P2P ผ่าน NAT'],relay:['🔁','Relayed (TURN)','ผ่านเซิร์ฟเวอร์ TURN']};
function stTxt(p){if(p.rmuted&&p.up)return'🔇 '+TT('muted','ปิดไมค์');if(p.state=='failed')return'⚠️ '+TT('no link','ต่อไม่ได้');if(!p.up)return'⏳ '+TT('connecting…','กำลังเชื่อมต่อ…');const l=LINK[p.link];return(l?l[0]+' '+TT(l[1],l[2]):'✅ '+TT('connected','เชื่อมต่อแล้ว'))+(p.rtt?' · '+p.rtt+' ms':'')}
const rowHTML=p=>`<div class="vp" data-n="${esc(p.n)}"><i class="vdot"></i><span class="nm">${esc(p.n)}</span><small class="vst">${esc(stTxt(p))}</small><button class="vpm${p.lmute?' m':''}" data-do="voicepm" data-n="${esc(p.n)}" title="${esc(TT('Mute this person for me','ปิดเสียงคนนี้ (เฉพาะฉัน)'))}" aria-label="${esc(TT('Mute this person for me','ปิดเสียงคนนี้ (เฉพาะฉัน)'))}">${p.lmute?'🔇':'🔊'}</button><input type="range" min="0" max="100" value="${Math.round(p.vol*100)}" data-vvol="${esc(p.n)}" aria-label="${esc(TT('Volume of '+p.n,'ระดับเสียงของ '+p.n))}"></div>`;
function popHTML(){const ps=live();return`<div class="vph"><b>🎧 ${TT('Voice room','ห้องคุยเสียง')}</b><small>${1+ps.length}/${V.max}</small><button class="x" data-do="voicepop" aria-label="${esc(TT('Close','ปิด'))}">✕</button></div>
<label class="vopt"><input type="checkbox" data-vprox ${V.pref.prox?'checked':''}><span>${TT('Quieter when dogs are far apart','เสียงเบาลงเมื่อน้องหมาอยู่ไกลกัน')}</span></label>
<div class="vme"><span>🎤 ${TT('You','คุณ')}</span><i class="vlvl"><u></u></i><em class="vmm">${V.muted?'🔇':''}</em></div>
<div class="vlist">${ps.length?ps.map(rowHTML).join(''):`<div class="vnone">${TT('Nobody else is in the voice room yet','ยังไม่มีคนอื่นในห้องเสียง')}</div>`}</div>
<button class="btn sm red vleave" data-do="voiceleave">${TT('Leave voice','ออกจากห้องเสียง')}</button>`}
function placePop(){const pop=$('#voicepop');if(!pop||pop.classList.contains('hidden'))return;const vw=innerWidth,vh=innerHeight,a=$$('.vchip').find(b=>b.offsetParent);
 pop.style.maxHeight=(vh-16)+'px';const w=pop.offsetWidth,h=pop.offsetHeight;let left=(vw-w)/2,top=vh-h-70;
 if(a){const r=a.getBoundingClientRect();left=r.left+r.width/2-w/2;top=r.top-h-10;if(top<8){if(r.right+10+w<=vw-8){left=r.right+10;top=r.top}else top=r.bottom+10}}
 pop.style.left=clamp(left,8,Math.max(8,vw-w-8))+'px';pop.style.top=clamp(top,8,Math.max(8,vh-h-8))+'px'}
function refreshPop(full){const pop=$('#voicepop');if(!pop||pop.classList.contains('hidden'))return;
 if(!V.on)return closePop();
 const act=document.activeElement;if(full&&!(act&&pop.contains(act)&&act.type=='range')){const sc=$('.vlist',pop);const st=sc?sc.scrollTop:0;pop.innerHTML=popHTML();const l=$('.vlist',pop);if(l)l.scrollTop=st}
 else{for(const p of live()){const r=$(`.vp[data-n="${CSS.escape(p.n)}"] .vst`,pop);if(r)r.textContent=stTxt(p)}const mm=$('.vmm',pop);if(mm)mm.textContent=V.muted?'🔇':'';const c=$('.vph small',pop);if(c)c.textContent=(1+live().length)+'/'+V.max}
 placePop()}
DO.voicepop=()=>{if(!V.on)return;let pop=$('#voicepop');if(!pop){pop=document.createElement('div');pop.id='voicepop';pop.className='panel hidden';const h=$('#hud');(h||document.body).append(pop)}
 if(!pop.classList.contains('hidden'))return closePop();
 pop.classList.remove('hidden');pop.innerHTML=popHTML();placePop();for(const p of live())probe(p).then(refreshPop);V.popT=setInterval(()=>{if(!V.on||!popOpen())return closePop();Promise.all(live().map(probe)).then(()=>refreshPop())},2000)};
addEventListener('resize',placePop);
document.addEventListener('input',e=>{const t=e.target;if(t&&t.dataset&&t.dataset.vvol!=null){const p=V.peers[t.dataset.vvol];if(p){p.vol=clamp(+t.value/100,0,1);V.pref.vol[p.n]=p.vol;applyGain(p,true)}}});
document.addEventListener('change',e=>{const t=e.target;if(t&&t.dataset){if(t.dataset.vprox!=null){V.pref.prox=!!t.checked;savePref();for(const p of live())applyGain(p,false)}else if(t.dataset.vvol!=null)savePref()}});
// ---------------------------------------------------------------- buttons
DO.voice=()=>{if(V.st=='on'){stop(true,'🎤 '+TT('Left the voice room','ออกจากห้องเสียงแล้ว'));return}
 if(V.st!='off')return;if(!Park.on)return toast('🌳 '+TT('Go to the park first to use voice chat','ต้องอยู่ในสวนสาธารณะก่อนถึงจะคุยด้วยเสียงได้'));
 const se=supportErr();if(se)return fail(se);                       // explain first, before any dialog
 if(!LS.get('cd_voice_ok',false))return intro();join()};
DO.voiceok=()=>{closeMod('voicehi');LS.set('cd_voice_ok',true);join()};
DO.voiceleave=()=>{if(V.st=='on')stop(true,'🎤 '+TT('Left the voice room','ออกจากห้องเสียงแล้ว'))};
DO.voicemute=()=>{if(!V.on||!V.track)return;V.muted=!V.muted;V.track.enabled=!V.muted;send({t:'voice_mute',on:V.muted});if(V.muted){V.spk=false;V.spkT=0}flags();ui();refreshPop();toast(V.muted?'🔇 '+TT('Microphone muted','ปิดไมค์แล้ว'):'🎙️ '+TT('Microphone on','เปิดไมค์แล้ว'),1200)};
DO.voicepm=d=>{const p=V.peers[d.n];if(!p)return;p.lmute=!p.lmute;if(p.lmute)V.pref.mute[p.n]=1;else delete V.pref.mute[p.n];savePref();applyGain(p,true);refreshPop(true)};
// ---------------------------------------------------------------- hooks into the park
{const _l=Park.leaveLocal;Park.leaveLocal=function(){if(V.st!='off')stop(false,'🎧 '+TT('Left the voice room','ออกจากห้องเสียงแล้ว'));return _l.apply(this,arguments)}}      // button / visit / game start: the server drops us from voice by itself when we leave the park
{const _od=onDisconnect;onDisconnect=function(){if(V.st!='off')stop(false,TT('Voice room closed - the connection was lost. Tap 🎤 to join again','ห้องเสียงถูกตัดเพราะการเชื่อมต่อหลุด — กด 🎤 เพื่อเข้าใหม่อีกครั้ง'));return _od.apply(this,arguments)}}
{const _dp=drawPTag;drawPTag=function(c,m,t,now){_dp(c,m,t,now);if(m.vin&&m._top!=null)voiceBadge(c,m,t,now)}}      // sound-wave badge next to the name tag
function voiceBadge(c,m,t,now){c.font='bold 11px '+UIF();const w=c.measureText(m.n+' · Lv'+m.lvl).width+16,x=m.rx+w/2+13,y=m.ry+17.5,sp=m.speaking&&!m.vmuted;
 c.save();c.translate(x,y);c.lineWidth=2;c.strokeStyle='#5a3d33';c.fillStyle=m.vmuted?'#ff6b6b':sp?'#6fd1a5':'#fffaf1';
 if(sp){c.globalAlpha=.35+.25*Math.sin(t*10);c.beginPath();c.arc(0,0,11+Math.sin(t*10)*2,0,7);c.fill();c.globalAlpha=1}
 c.beginPath();c.arc(0,0,9,0,7);c.fill();c.stroke();
 c.fillStyle=m.vmuted?'#fff':'#5a3d33';c.beginPath();c.moveTo(-5,-2);c.lineTo(-2,-2);c.lineTo(1.5,-5);c.lineTo(1.5,5);c.lineTo(-2,2);c.lineTo(-5,2);c.closePath();c.fill();
 c.lineCap='round';c.strokeStyle=m.vmuted?'#fff':'#5a3d33';c.lineWidth=1.6;
 if(m.vmuted){c.beginPath();c.moveTo(3.5,-3);c.lineTo(7,3);c.moveTo(7,-3);c.lineTo(3.5,3);c.stroke()}
 else if(sp){for(let i=0;i<2;i++){c.globalAlpha=.3+.7*Math.max(0,Math.sin(t*11-i*1.5));c.beginPath();c.arc(1.5,0,3.5+i*3,-.9,.9);c.stroke()}}
 else{c.globalAlpha=.55;c.beginPath();c.arc(1.5,0,3.5,-.9,.9);c.stroke()}
 c.restore()}
// ---------------------------------------------------------------- safety nets
setInterval(()=>{if(V.st!='off'&&(!Park.on||!S.ws||(V.ws&&S.ws!==V.ws)||(V.ws&&V.ws.readyState!=1)))stop(false,TT('Left the voice room','ออกจากห้องเสียงแล้ว'));
 if(V.on){if(V.ctx&&V.ctx.state!='running')V.ctx.resume().catch(()=>{});for(const p of live())if(p.audio&&p.audio.paused&&p.audio.srcObject){const r=p.audio.play();if(r&&r.catch)r.catch(()=>{})}}},1000);
for(const ev of ['pointerdown','touchend','click'])addEventListener(ev,()=>{if(V.on&&V.ctx&&V.ctx.state!='running')V.ctx.resume().catch(()=>{})},true);      // iOS suspends audio again after a call / app switch: any tap brings it back
addEventListener('pagehide',()=>{if(V.st!='off')stop(true)});
})();
