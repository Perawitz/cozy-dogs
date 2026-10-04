// Cozy Dogs - dog renderer glue: frame cache, poses, accessories, tricks, aura, thumbnails
(function(g){
'use strict';
const D=g.DOGPIX,cache=new Map(),BR={};
function setBreeds(list){list.forEach(b=>{const en=b[1];BR[b[0]]={id:b[0],get name(){return t(en)},r:b[2],body:b[3],acc:b[4],ears:b[5],size:b[6]}})}
function frame(b,v,pose,fr,acc){const k=b.id+'|'+v+'|'+pose+'|'+fr+'|'+(acc||'');let f=cache.get(k);
 if(!f){const gn=D.gen(b,v,pose,fr,acc),cv=document.createElement('canvas');cv.width=gn.w;cv.height=gn.h;cv.getContext('2d').putImageData(new ImageData(gn.px,gn.w,gn.h),0,0);f={cv,bb:gn.bb};cache.set(k,f)}return f}
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
 return {top:(D.GY-f.bb.y0)*K,w:(f.bb.x1-f.bb.x0)*K}}
function thumb(id,v,size=110,o={}){const b=BR[id],cv=document.createElement('canvas'),W=size*2;cv.width=cv.height=W;if(!b)return cv;const c=cv.getContext('2d');c.imageSmoothingEnabled=false;
 const f=frame(b,v||'Normal',o.pose||'stand',o.fr||0,o.acc),bb=f.bb,bw=bb.x1-bb.x0,bh=bb.y1-bb.y0;let s=Math.min(W*.9/bw,W*.82/bh);if(s>=2)s=Math.floor(s);
 const dw=bw*s,dh=bh*s,dx=(W-dw)/2,dy=W*.9-dh;
 if(!o.noShadow){c.fillStyle='rgba(70,45,35,.18)';c.beginPath();c.ellipse(W/2,W*.9+2,dw*.42,W*.035,0,0,7);c.fill()}
 if((b.r=='M'||b.r=='L')&&!o.noGlow){c.shadowColor=b.acc;c.shadowBlur=14}
 if(o.dark){c.drawImage(f.cv,bb.x0,bb.y0,bw,bh,Math.round(dx),Math.round(dy),dw,dh);c.globalCompositeOperation='source-atop';c.fillStyle='#4a3a52';c.fillRect(0,0,W,W)}
 else c.drawImage(f.cv,bb.x0,bb.y0,bw,bh,Math.round(dx),Math.round(dy),dw,dh);return cv}
g.DOGS={BR,setBreeds,frame,sprite,thumb,EM,TEM,TRICK_MS,pickPose,AC};
})(window);
