// Cozy Dogs - park voice chat, SERVER SIDE = SIGNALLING ONLY (v7).
//
// Design (networking notes - the audio itself NEVER touches this server):
//  * One shared voice channel for the park. Opt-in: nobody is in it until they press the mic button. Peer-to-peer WebRTC audio, full mesh.
//  * Why the game's existing WebSocket carries the signalling: two browsers behind NATs cannot open a connection to each other out of thin air - they first have to
//    swap "session descriptions" (SDP: codecs, DTLS fingerprint, ICE credentials + candidate addresses). Any reliable, ordered channel both already have to a public
//    server will do, and we already own one (TCP + TLS in production), authenticated by the game login. So there is no second server and no extra port.
//    This module only relays {offer, answer, ice} between two players that are BOTH in the channel, and tells the others who joined / left / muted.
//  * Full mesh: every player keeps one RTCPeerConnection to every other player -> N*(N-1)/2 links in total, and each player UPLOADS (N-1) copies of his own voice
//    (Opus ~32 kbit/s mono, less with DTX) and decodes (N-1) streams. At N=8 that is 28 links and 7 x 32 = ~224 kbit/s up per player - fine for ADSL / 4G.
//    At N=16 it would be 120 links and ~480 kbit/s up, and phone CPUs start to struggle, so the channel is capped at VOICE_MAX = 8. Beyond that you would need an
//    SFU (a media server that forwards one copy per speaker) or an MCU (mixes); both put the audio through a server again and cost bandwidth there.
//  * NAT traversal (ICE): each browser gathers candidate addresses - "host" (its LAN address), "srflx" (its public address as seen by a STUN server) and, when a TURN
//    server is configured, "relay" (an address on the TURN server). Both sides try every pair; the first pair that answers wins (UDP hole punching). STUN is a tiny
//    free "what is my public address" service and is enough for most home/school NATs. Symmetric NATs and many mobile carriers / strict firewalls block hole punching,
//    then only a TURN relay works (it relays the - still end-to-end encrypted - packets). TURN costs real bandwidth, so it is optional: TURN_URL / TURN_USER / TURN_PASS.
//    NOTE: static TURN credentials are sent to every browser in /config.json, so anybody can read (and use) them. That is acceptable for a class project; with
//    TURN_SECRET (coturn `use-auth-secret`) the server instead hands out short-lived HMAC credentials (draft-uberti-behave-turn-rest), which is the production way.
//  * Security: media is encrypted DTLS-SRTP by the browser (keys are negotiated peer-to-peer, the fingerprint travels inside the SDP over our signalling channel).
//    The server could in principle swap fingerprints (a MITM on the signalling channel) - that is why the channel must be https/wss. Everybody in the channel can see
//    the others' IP addresses (inherent to peer-to-peer) - the client tells the user so before the first join.
//  * Glare avoidance: if two peers both send an offer at the same moment the negotiation deadlocks. Rule: the NEWCOMER (the one who just sent voice_join, i.e. the
//    later one in this server's single-threaded order) creates the offers to everybody already in the channel; existing members only ever answer. The server serialises
//    joins, so for every pair there is exactly one offerer - no collisions by construction.
//  * Non-trickle ICE: the client waits until candidate gathering is complete (or 2.5 s) and sends ONE offer/answer that already contains all candidates. That keeps
//    the signalling to ~2 messages per link (an 8-person join = 7 offers + 7 answers) instead of dozens of tiny "ice" messages, which matters because of the
//    per-connection limit of 20 messages/s in server.js (excess messages are silently dropped) and the 8192-byte payload cap. An audio-only SDP is ~1.5-3 KB.
//  * Everything a client sends is untrusted: names, kinds and sizes are checked, only whitelisted fields are forwarded, signalling is rate limited per connection.
'use strict';
const crypto=require('crypto');
module.exports=function(X){
const {send}=X;
const VOICE_MAX=8, SDP_MAX=6500, ICE_MAX=600, SIG_LIM=[60,10000], CTL_LIM=[30,10000];       // 60 signalling messages / 10 s and 30 join/leave/mute / 10 s per connection
const room=new Map();                    // ws -> {n:name, muted:bool}   the voice channel (Map keeps the join order)
const bc=(o,except)=>{for(const w of room.keys())if(w!==except)send(w,o)};
const lim=(c,k,[max,win])=>{const now=Date.now(),L=c.vl||(c.vl={});let e=L[k];if(!e||now-e.t>win)e=L[k]={t:now,n:0};return ++e.n<=max};      // fixed window, counts every attempt
const others=ws=>[...room].filter(([w])=>w!==ws).map(([,v])=>v);

// ---------- ICE server list (what the page hands to new RTCPeerConnection({iceServers}))
const DEF_ICE=[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}];
function cleanServer(s){if(!s||typeof s!='object'||Array.isArray(s))return null;
  const u=(Array.isArray(s.urls)?s.urls:[s.urls]).filter(x=>typeof x=='string'&&/^(stuns?|turns?):[^\s]{1,200}$/i.test(x)).slice(0,6);if(!u.length)return null;
  const o={urls:u.length==1?u[0]:u};if(typeof s.username=='string')o.username=s.username.slice(0,200);if(typeof s.credential=='string')o.credential=s.credential.slice(0,200);return o}
let BASE=DEF_ICE;
if(process.env.CD_ICE){try{const a=JSON.parse(process.env.CD_ICE);if(!Array.isArray(a))throw new Error('not an array');BASE=a.map(cleanServer).filter(Boolean)}      // CD_ICE REPLACES the default STUN list ('[]' = host candidates only, e.g. a LAN party)
  catch(e){console.error('[voice] CD_ICE ignored (needs a JSON array of {urls,...}):',e.message)}}
const TURN_URLS=String(process.env.TURN_URL||'').split(',').map(s=>s.trim()).filter(Boolean).filter(u=>{const ok=/^turns?:[^\s]{1,200}$/i.test(u);if(!ok)console.error('[voice] TURN_URL entry ignored (must start with turn: or turns:):',u.slice(0,60));return ok}).slice(0,6);
const TURN_USER=String(process.env.TURN_USER||''), TURN_PASS=String(process.env.TURN_PASS||''), TURN_SECRET=String(process.env.TURN_SECRET||''), TURN_TTL=6*3600;
function turnEntry(){const o={urls:TURN_URLS.length==1?TURN_URLS[0]:TURN_URLS};
  if(TURN_SECRET){const u=(Math.floor(Date.now()/1000)+TURN_TTL)+':cozydogs';o.username=u;o.credential=crypto.createHmac('sha1',TURN_SECRET).update(u).digest('base64')}     // coturn `use-auth-secret`: credential = base64(HMAC-SHA1(secret, "<expiry>:<user>"))
  else{if(TURN_USER)o.username=TURN_USER;if(TURN_PASS)o.credential=TURN_PASS}
  return o}
const ice=()=>TURN_URLS.length?[...BASE.map(s=>({...s})),turnEntry()]:BASE.map(s=>({...s}));      // always a fresh array (the ephemeral TURN credential changes)

// ---------- channel
const state=ws=>({t:'voice_state',on:true,peers:others(ws).map(v=>v.n),muted:others(ws).filter(v=>v.muted).map(v=>v.n),max:VOICE_MAX,ice:ice()});
function leave(ws,why,quiet){const v=room.get(ws);if(!v)return false;room.delete(ws);bc({t:'voice_peer',n:v.n,joined:false});if(!quiet)send(ws,{t:'voice_state',on:false,why});return true}
function cleanCand(cd){      // an RTCIceCandidateInit: forward only the known fields; a field of the wrong type / size rejects the whole message
  if(!cd||typeof cd!='object'||Array.isArray(cd)||typeof cd.candidate!='string'||cd.candidate.length>400)return null;
  const o={candidate:cd.candidate},{sdpMid:mid,sdpMLineIndex:li,usernameFragment:uf}=cd;
  if(mid!==undefined){if(mid!==null&&(typeof mid!='string'||mid.length>32))return null;o.sdpMid=mid}
  if(li!==undefined){if(li!==null&&!(Number.isInteger(li)&&li>=0&&li<=8))return null;o.sdpMLineIndex=li}
  if(uf!==undefined){if(typeof uf!='string'||uf.length>64)return null;o.usernameFragment=uf}
  return JSON.stringify(o).length<=ICE_MAX?o:null}

function handle(ws,c,m){
  const t=m.t;if(typeof t!='string'||!t.startsWith('voice_'))return false;
  switch(t){
    case 'voice_join':{
      if(!lim(c,'c',CTL_LIM))return true;
      if(room.has(ws)){send(ws,state(ws));return true}                                        // idempotent: already in -> just tell the caller the current state, tell nobody else
      if(!X.S.inPark(ws)){send(ws,{t:'voice_state',on:false,why:'park'});return true}         // the channel belongs to the park: only people standing in it can join
      if(room.size>=VOICE_MAX){send(ws,{t:'voice_full',max:VOICE_MAX});return true}
      room.set(ws,{n:c.name,muted:false});
      send(ws,state(ws));                                                                     // the newcomer gets the list and will OFFER to each of them
      bc({t:'voice_peer',n:c.name,joined:true},ws);                                           // the others learn about him and wait for his offers
      return true}
    case 'voice_leave':{
      if(!lim(c,'c',CTL_LIM))return true;
      if(!leave(ws,'leave'))send(ws,{t:'voice_state',on:false});                              // not in the channel: still answer, so a client that lost track can resync
      return true}
    case 'voice_mute':{
      const v=room.get(ws);if(!v||!lim(c,'c',CTL_LIM))return true;
      const on=m.on===true||m.on===1;if(v.muted===on)return true;                              // informational only (the mic is muted on the client); no change = no broadcast
      v.muted=on;bc({t:'voice_peer',n:v.n,muted:on},ws);return true}
    case 'voice_sig':{
      const v=room.get(ws);if(!v)return true;
      if(!lim(c,'s',SIG_LIM)){c.vdrop=(c.vdrop|0)+1;return true}                               // the global limit (20 msg/s) drops silently; this one is explicit and per type
      const to=m.to,d=m.d;
      if(typeof to!='string'||to===v.n||!d||typeof d!='object'||Array.isArray(d))return true;
      let tw=null;for(const [w,x] of room)if(x.n===to){tw=w;break}
      if(!tw)return true;                                                                       // unknown name / not in voice / already left: nothing to relay
      const k=d.k,out={k};
      if(k==='offer'||k==='answer'){if(typeof d.s!='string'||!d.s.length||d.s.length>SDP_MAX)return true;out.s=d.s}
      else if(k==='ice'){const cd=cleanCand(d.c!==undefined?d.c:d.s);if(!cd)return true;out.c=cd}
      else return true;
      if(d.g!==undefined){if(!Number.isInteger(d.g)||d.g<0||d.g>1e9)return true;out.g=d.g}      // optional "generation" of the sender's connection: lets the receiver ignore stale messages
      send(tw,{t:'voice_sig',from:v.n,d:out});return true}
  }
  return true}                                                                                   // any other voice_* message is ours too: consumed, ignored

if(X.hooks&&X.hooks.parkLeave)X.hooks.parkLeave.push(ws=>leave(ws,'park'));                   // social.js calls this when a player leaves the park for ANY reason (button, visit, game, disconnect)
return{handle,onClose:ws=>{leave(ws,'close',true)},ice,size:()=>room.size,has:ws=>room.has(ws),MAX:VOICE_MAX};
};
