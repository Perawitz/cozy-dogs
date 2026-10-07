// Cozy Dogs - dog renderer glue: frame cache, poses, accessories, tricks, aura, thumbnails
(function(g){
'use strict';
const D=g.DOGPIX,TRD=g.TRD,cache=new Map(),RAW={},CMP=new Map(),own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
function setBreeds(list){list.forEach(b=>{const en=b[1];RAW[b[0]]={id:b[0],en,get name(){return t(en)},r:b[2],body:b[3],acc:b[4],ears:b[5],size:b[6],pm:b[7]||null}});CMP.clear()}
// v7: BR[id] is a plain breed for the 61 base ids; any "dog key" (see traits.js, e.g. corgi+husky~3.p#blush-star) becomes a composite breed entry on the fly,
// so every draw site that asks BR[key] gets a ready-to-draw entry (mixed colours, stage, traits) without knowing about any of it.
const hexN=h=>{h=h.replace('#','');return[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]};
const hexMix=(a,b,t)=>{const x=hexN(a),y=hexN(b);return'#'+x.map((v,i)=>Math.round(v*(1-t)+y[i]*t).toString(16).padStart(2,'0')).join('')};
function mkComp(key){const k=TRD.parseKey(key),A=RAW[k.base];if(!A||!(k.mix||k.st<3||k.tr.length))return null;const B=k.mix&&RAW[k.mix]&&k.mix!=k.base?RAW[k.mix]:null;
 const e={id:key,base:k.base,mix:B?B.id:null,st:k.st,tr:k.tr.filter(TRD.isTrait),r:A.r,body:A.body,acc:A.acc,ears:A.ears,size:A.size,pm:A.pm,get name(){return B?A.name+' × '+B.name:A.name}};
 if(B){e.body=hexMix(A.body,B.body,.15+.1*(k.ms&3));e.acc=B.body;e.size=(A.size+B.size)/2}
 return e}
const BR=new Proxy(RAW,{get(o,k){if(typeof k!='string')return o[k];if(own(o,k))return o[k];if(CMP.has(k))return CMP.get(k);
 if(k.length>90||!/^[a-z0-9]+[+.#]/.test(k))return undefined;if(CMP.size>3000)CMP.clear();const e=mkComp(k)||undefined;CMP.set(k,e);return e},has(o,k){return typeof k=='string'&&(own(o,k)||!!BR[k])}});
// the key to draw / thumbnail a dog with (breed + other breed + growth stage + traits). Works on house dogs, park members and anything with {breed,mix,ms,tr,born}.
function dkey(d,now){if(!d)return'';const s=typeof S!='undefined'?S:null;return TRD.keyOf(d,(now||Date.now())+((s&&s.skew)||0),(s&&s.gk)||1,id=>own(RAW,id))}
const bOf=(d,now)=>d?(BR[dkey(d,now)]||BR[d.breed]):undefined;   // the breed entry to DRAW a dog with (mix, growth stage and traits included)
const dname=d=>{const b=bOf(d);return b?b.name:String(d.breed)};
function frame(b,v,pose,fr,acc){const k=b.id+'|'+v+'|'+pose+'|'+fr+'|'+(acc||'');let f=cache.get(k);
 if(!f){if(cache.size>2500)cache.clear();const gn=D.gen(b,v,pose,fr,acc),cv=document.createElement('canvas');cv.width=gn.w;cv.height=gn.h;cv.getContext('2d').putImageData(new ImageData(gn.px,gn.w,gn.h),0,0);f={cv,bb:gn.bb};cache.set(k,f)}return f}

// ---- little animated sparkles for dogs with special traits / premium breeds (the pixel art itself already carries the static marks)
const PFX={heart:'heart',star:'spark',sparkle:'spark',halo:'spark',rainbow:'rbow',flower:'petal',sprout:'leaf',bubble:'bub',bee:'bee',wings:'feather',frosty:'snow'};
const PPM={sakurashiba:'petal',cottonpoodle:'spark',berrydal:'heart',honeybeepup:'bee',angelretriever:'feather',unicornpup:'rbow',dragonpup:'puff',mochipup:'heart',teddypom:'heart',bunnycorgi:'heart',pandapup:'leaf'};
const fxKinds=b=>{if(b._fx)return b._fx;const o=[];if(b.pm&&PPM[b.base||b.id])o.push(PPM[b.base||b.id]);for(const id of b.tr||[]){const T=TRD.TR[id];if(T&&T.tier>=2&&PFX[id]&&!o.includes(PFX[id]))o.push(PFX[id])}return b._fx=o.slice(0,2)};
const px3=(c,x,y,w,h)=>c.fillRect(Math.round(x/3)*3,Math.round(y/3)*3,w,h);
function sparkFx(c,kind,t,top,w,seed){
 const W=Math.max(60,w)*.55,N=kind=='puff'?3:4;
 for(let i=0;i<N;i++){const sp=kind=='snow'||kind=='feather'||kind=='petal'||kind=='leaf'?.22:kind=='bub'||kind=='heart'||kind=='puff'?.3:.5,ph=((t*sp+i/N+seed*.137)%1+1)%1,a=Math.sin(ph*Math.PI),
   rx=Math.sin((i*2.399+seed)*1.7)*W,x=rx+Math.sin(t*1.3+i*2)*5;let y;c.globalAlpha=Math.min(1,a*1.4);
   if(kind=='heart'){y=-top*(.55+.55*ph);c.fillStyle=i%2?'#ff7aa8':'#ff9fc0';px3(c,x-6,y,6,6);px3(c,x+3,y,6,6);px3(c,x-9,y+3,18,6);px3(c,x-6,y+9,12,3);px3(c,x-3,y+12,6,3)}
   else if(kind=='spark'||kind=='rbow'){y=-top*(.15+.95*((i*.37+seed*.11)%1));const tw=Math.sin(t*5+i*1.7),s=tw>0?1:.4;c.globalAlpha=.35+.65*Math.max(0,tw);c.fillStyle=kind=='rbow'?`hsl(${(t*90+i*70)%360},95%,68%)`:i%2?'#fff3a8':'#ffffff';
    px3(c,x-1,y-9*s,3,18*s);px3(c,x-9*s,y-1,18*s,3);if(s>.9){c.globalAlpha*=.6;px3(c,x-4,y-4,3,3);px3(c,x+4,y+4,3,3)}}
   else if(kind=='petal'||kind=='leaf'||kind=='feather'||kind=='snow'){y=-top*(1.15-ph*1.1);const sw=Math.sin(t*2+i*2.1)*9;c.fillStyle=kind=='petal'?(i%2?'#ffb7cf':'#ffd6e4'):kind=='leaf'?(i%2?'#7fd18b':'#a6e6a0'):kind=='feather'?'#ffffff':(i%2?'#ffffff':'#bfe6ff');
    if(kind=='snow'){px3(c,x+sw-1,y-4,3,9);px3(c,x+sw-4,y-1,9,3)}else if(kind=='feather'){px3(c,x+sw,y,9,3);px3(c,x+sw+3,y+3,6,3);px3(c,x+sw-3,y-3,6,3)}else{px3(c,x+sw,y,6,6);px3(c,x+sw+3,y+3,6,6)}}
   else if(kind=='bub'){y=-top*(.2+.95*ph);c.strokeStyle=i%2?'#bfe6ff':'#e6f6ff';c.lineWidth=2;const r=4+(i%3)*2;c.beginPath();c.arc(x,y,r,0,7);c.stroke();c.fillStyle='#ffffffaa';px3(c,x-r/2,y-r/2,3,3)}
   else if(kind=='puff'){y=-top*(.7+.5*ph);c.fillStyle=i%2?'#ffe08a':'#ffb36b';const r=3+ph*7;c.beginPath();c.arc(x+W*.7,y,r,0,7);c.fill()}
   else if(kind=='bee'){const a2=t*2.2+i*1.6;c.globalAlpha=1;if(i>1)continue;const bx=Math.cos(a2)*W*.8,by=-top*(.95)+Math.sin(a2*2)*10;c.fillStyle='#2a2a30';px3(c,bx-6,by-3,12,9);c.fillStyle='#ffd43a';px3(c,bx-3,by-3,3,9);c.fillStyle='#ffffff';px3(c,bx-3,by-9,6,3)}
 }c.globalAlpha=1}
const RATE={stand:3,walk:8,run:13,sleep:1.3,sit:1.5,look:1.5,eat:3,bark:4,sniff:2.5,happy:5,play:4,stretch:1.5,shy:2};
const STP={SLEEP:'sleep',EAT:'eat',DRINK:'eat',SIT:'sit',WINDOW:'look',BARK:'bark',SNIFF:'sniff',PLAY:'play',STRETCH:'stretch',CORNER:'shy',SEEK_OWNER:'happy',SOCIAL:'happy',WATCH:'look',TRICK:'happy'};
const AC={R:'#8ec5ff',E:'#cf9bff',L:'#ffd25a',M:'#ff8fd0'};
const EM={SLEEP:'💤',EAT:'🍖',DRINK:'💧',PLAY:'🎾',SNIFF:'👃',BARK:'🗨️',SEEK_OWNER:'❤️',EXPLORE:'🔍',SOCIAL:'🐾',CORNER:'😳',RUN:'💨',STRETCH:'🥱',WINDOW:'🌤',WATCH:'📺',TRICK:'✨'};
const TEM={sit:'🐶',shake:'🤝',spin:'🌀',jump:'⬆️',roll:'🔄',dead:'💀'};
const TRICK_MS=2400;
const ease=x=>x<.5?2*x*x:1-Math.pow(-2*x+2,2)/2;
function pickPose(o){const st=o.state;if(o.pet)return'happy';if(o.mv)return o.run?'run':'walk';let p=STP[st]||'stand';if(p=='stand'&&o.sad)p='shy';return p}
// transform for a trick; returns {pose,dx,dy,rot,sx,tk}
function trickFx(trick,k){const o={pose:'happy',dx:0,dy:0,rot:0,sx:1};
 if(trick=='sit'){o.pose='sit'}
 else if(trick=='shake'){o.pose='sit';o.rot=Math.sin(k*Math.PI*10)*.09}
 else if(trick=='spin'){o.pose='happy';o.sx=Math.cos(k*Math.PI*6);o.dy=-Math.abs(Math.sin(k*Math.PI))*14}
 else if(trick=='jump'){o.pose='run';o.dy=-Math.abs(Math.sin(k*Math.PI*3))*40}
 else if(trick=='roll'){o.pose='play';o.rot=k*Math.PI*4;o.dx=Math.sin(k*Math.PI)*22;o.dy=-14*Math.abs(Math.sin(k*Math.PI*4))}
 else if(trick=='dead'){o.pose='stand';const a=k<.2?ease(k/.2):k>.8?1-ease((k-.8)/.2):1;o.rot=Math.PI*a*(1);o.dy=14*a}
 return o}
// draw a dog with foot-point at (0,0); caller translates & mirrors. o: {state,mv,run,seed,pet,sad,happy,acc,trick,tk,variant}
function sprite(c,b,v,t,o){
 let pose=pickPose(o),fx=null;
 if(o.trickK!=null){fx=trickFx(o.trick,o.trickK);pose=fx.pose}
 const n=D.FRAMES[pose],fr=Math.floor(t*(RATE[pose]||3)+(o.seed||0)*.37)%n,f=frame(b,v,pose,fr,o.acc),K=D.PX;
 if(b.r&&b.r!='C'&&!o.noAura){c.save();const ac=AC[b.r],R=b.r=='L'||b.r=='M'?78:62,gr=c.createRadialGradient(0,-36,10,0,-36,R);gr.addColorStop(0,ac+(b.r=='R'?'55':'77'));gr.addColorStop(1,ac+'00');c.fillStyle=gr;c.beginPath();c.arc(0,-36,R,0,7);c.fill();
  if(b.r!='R'){const N=b.r=='M'?7:4;c.fillStyle=b.r=='L'?'#fff3a8':'#fff';for(let i=0;i<N;i++){const a=t*(b.r=='M'?1.2:.6)+i*6.28/N,x=Math.round(Math.cos(a)*54/3)*3,y=Math.round((-38+Math.sin(a*1.3)*34)/3)*3;c.globalAlpha=.5+.5*Math.sin(t*4+i*2);c.fillRect(x-1,y-4,3,9);c.fillRect(x-4,y-1,9,3)}c.globalAlpha=1}
  c.restore()}
 c.save();c.imageSmoothingEnabled=false;
 if(fx){const pivotY=-22;c.translate(fx.dx,fx.dy);if(fx.rot){c.translate(0,pivotY);c.rotate(fx.rot);c.translate(0,-pivotY)}if(fx.sx!=1)c.scale(fx.sx,1)}
 c.drawImage(f.cv,-D.GX*K,-(D.GY+1)*K,D.GW*K,D.GH*K);c.restore();
 const top=(D.GY-f.bb.y0)*K,w=(f.bb.x1-f.bb.x0)*K;
 if(!o.noFx){const fk=fxKinds(b);if(fk.length){c.save();c.shadowBlur=0;for(const k of fk)sparkFx(c,k,t,top,w,(o.seed||0)+k.length);c.restore()}}
 return {top,w}}
function thumb(id,v,size=110,o={}){const b=BR[id],cv=document.createElement('canvas'),W=size*2;cv.width=cv.height=W;if(!b)return cv;const c=cv.getContext('2d');c.imageSmoothingEnabled=false;
 const f=frame(b,v||'Normal',o.pose||'stand',o.fr||0,o.acc),bb=f.bb,bw=bb.x1-bb.x0,bh=bb.y1-bb.y0;let s=Math.min(W*.9/bw,W*.82/bh);if(s>=2)s=Math.floor(s);
 const dw=bw*s,dh=bh*s,dx=(W-dw)/2,dy=W*.9-dh;
 if(!o.noShadow){c.fillStyle='rgba(70,45,35,.18)';c.beginPath();c.ellipse(W/2,W*.9+2,dw*.42,W*.035,0,0,7);c.fill()}
 if((b.r=='M'||b.r=='L')&&!o.noGlow){c.shadowColor=b.acc;c.shadowBlur=14}
 if(o.dark){c.drawImage(f.cv,bb.x0,bb.y0,bw,bh,Math.round(dx),Math.round(dy),dw,dh);c.globalCompositeOperation='source-atop';c.fillStyle='#4a3a52';c.fillRect(0,0,W,W)}
 else c.drawImage(f.cv,bb.x0,bb.y0,bw,bh,Math.round(dx),Math.round(dy),dw,dh);return cv}
g.DOGS={BR,setBreeds,frame,sprite,thumb,EM,TEM,TRICK_MS,pickPose,AC,k:dkey,nm:dname,b:bOf,raw:RAW};
})(window);
