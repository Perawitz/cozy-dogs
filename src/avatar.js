// Cozy Dogs - human avatar glue: frame cache, drawing (home corner / park leash walk), busts + thumbnails for the UI, leash.
(function(g){
'use strict';
const A=g.AVPIX,D=g.AVD,cache=new Map();
const KEYS=['sk','h','hc','e','ec','m','bl','fr','t','tc','pt','b','bc','s','sc','ht','hk','g','x','xk'];
const key=av=>{let k='';if(av)for(const f of KEYS)k+=(av[f]!=null?av[f]:'')+'|';return k};
const RATE={idle:2.4,wave:6,happy:6,walk:8,stand:2};
function frame(av,view,pose,fr,hold){
 const k=key(av)+view+pose+fr+(hold||'');let f=cache.get(k);
 if(!f){
  if(cache.size>1400){let n=0;for(const kk of cache.keys()){cache.delete(kk);if(++n>350)break}}
  const gn=A.gen(av,view,pose,fr,{hold}),cv=document.createElement('canvas');cv.width=gn.w;cv.height=gn.h;cv.getContext('2d').putImageData(new ImageData(gn.px,gn.w,gn.h),0,0);
  f={cv,bb:gn.bb,info:gn.info};cache.set(k,f)}
 return f}
const nfr=(pose)=>A.FRAMES[pose]||1;
const isFront=pose=>!!A.FRONT[pose];
// draw with the foot point at (0,0). o:{pose,t,seed,hold,flip,s}. returns {hand:[x,y] (px, already flipped), top (px above the feet), w}
function draw(c,av,t,o){
 o=o||{};const pose=o.pose||'idle',view=isFront(pose)?'front':'side',n=nfr(pose),fr=Math.floor(t*(RATE[pose]||3)+(o.seed||0)*.37)%n,f=frame(av,view,pose,fr,o.hold),K=A.PX*(o.s||1),fl=o.flip?-1:1;
 c.save();c.imageSmoothingEnabled=false;if(fl<0)c.scale(-1,1);c.drawImage(f.cv,-A.AX*K,-A.AY*K,A.AW*K,A.AH*K);c.restore();
 return{hand:[(f.info.hand.x-A.AX+.5)*K*fl,(f.info.hand.y-A.AY+.5)*K],top:(A.AY-f.bb.y0)*K,w:(f.bb.x1-f.bb.x0)*K}}
// crops (in art pixels) used for wardrobe option cards and portraits
const CROP={full:[2,0,40,47],bust:[9,1,26,29],head:[10,0,24,27],torso:[11,22,22,17],legs:[14,35,17,12],feet:[15,40,15,6],hat:[8,0,28,22]};
// returns a canvas (size*2 wide/high for crisp DPR2) with the cropped sprite centred, integer-scaled when possible
function thumb(av,o){
 o=o||{};const size=o.size||64,W=Math.round(size*2),cv=document.createElement('canvas');cv.width=cv.height=W;const c=cv.getContext('2d');c.imageSmoothingEnabled=false;
 const pose=o.pose||'idle',view=o.view||(isFront(pose)?'front':'side'),f=frame(av,view,pose,o.fr||0,o.hold),cr=CROP[o.crop||'full'];
 let s=Math.min(W*.92/cr[2],W*.92/cr[3]);if(s>=2)s=Math.floor(s);
 const dw=cr[2]*s,dh=cr[3]*s,dx=Math.round((W-dw)/2),dy=Math.round(o.bottom?W*.96-dh:(W-dh)/2);
 if(o.shadow){c.fillStyle='rgba(70,45,35,.18)';c.beginPath();c.ellipse(W/2,Math.min(W-4,dy+dh+3),dw*.34,W*.03,0,0,7);c.fill()}
 c.drawImage(f.cv,cr[0],cr[1],cr[2],cr[3],dx,dy,dw,dh);return cv}
const bust=(av,size,o)=>thumb(av,Object.assign({size,crop:'bust'},o));
// ---------- leash ----------
const LCOL=D?D.LEASH:[];
function leashPath(x0,y0,x1,y1,slack){const mx=(x0+x1)/2,my=(y0+y1)/2+slack;return t=>{const u=1-t;return[u*u*x0+2*u*t*mx+t*t*x1,u*u*y0+2*u*t*my+t*t*y1]}}
function leash(c,x0,y0,x1,y1,ls,t,o){
 o=o||{};const d=Math.hypot(x1-x0,y1-y0),maxLen=o.len||78,slack=Math.max(0,(maxLen-d))*.42+Math.sin(t*3+x0*.01)*(o.moving?1.6:.6)+2,P=leashPath(x0,y0,x1,y1,slack),N=Math.max(8,Math.min(22,Math.round(d/4)));
 const col=LCOL[ls]||'#ff5c6c',rainbow=col==='rainbow';
 c.save();c.lineCap='round';c.lineJoin='round';
 let pts=[];for(let i=0;i<=N;i++)pts.push(P(i/N));
 c.strokeStyle='#4a2f2a';c.lineWidth=5;c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.stroke();
 if(!rainbow){c.strokeStyle=col;c.lineWidth=2.6;c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.stroke();
  c.strokeStyle='rgba(255,255,255,.45)';c.lineWidth=1;c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p[0],p[1]-.8):c.moveTo(p[0],p[1]-.8));c.stroke()}
 else{for(let i=0;i<N;i++){c.strokeStyle='hsl('+Math.round(i/N*320)+',85%,62%)';c.lineWidth=2.6;c.beginPath();c.moveTo(pts[i][0],pts[i][1]);c.lineTo(pts[i+1][0],pts[i+1][1]);c.stroke()}}
 // handle loop in the hand + clip at the collar
 c.strokeStyle='#4a2f2a';c.lineWidth=2;c.fillStyle=rainbow?'#ffd24a':col;c.beginPath();c.arc(x0,y0+1,2.6,0,7);c.fill();c.stroke();
 c.fillStyle='#ffd24a';c.beginPath();c.roundRect(x1-3,y1-2,6,5,1.5);c.fill();c.stroke();
 c.restore()}
// ---------- html placeholders (painted after the markup is in the DOM) ----------
const jenc=o=>esc(JSON.stringify(o));
function html(av,size,o){o=o||{};return`<canvas class="avc ${o.cls||''}" width="${size*2}" height="${size*2}" data-av="${jenc(av)}" data-ao="${jenc({crop:o.crop,pose:o.pose,bottom:o.bottom,shadow:o.shadow,view:o.view})}"></canvas>`}
function paint(root){(root||document).querySelectorAll('canvas[data-av]').forEach(c=>{if(c.dataset.done)return;c.dataset.done=1;let av,o;try{av=JSON.parse(c.dataset.av);o=JSON.parse(c.dataset.ao||'{}')}catch{return}
 const src=thumb(av,Object.assign({size:c.width/2},o));c.getContext('2d').drawImage(src,0,0,c.width,c.height)})}
// ---------- speech bubble (shared by home + park) ----------
const FONT=()=>'bold 12px '+UIF();
function bubble(c,x,by,text,a){const cs=Array.from(String(text)),tx=cs.length>26?cs.slice(0,25).join('')+'…':cs.join('');c.save();c.font=FONT();c.textAlign='center';const tw=c.measureText(tx).width+18;c.globalAlpha=a==null?1:a;
 c.fillStyle='#fff';c.strokeStyle='#5a3d33';c.lineWidth=2;c.lineJoin='round';c.beginPath();c.roundRect(x-tw/2,by-24,tw,22,9);c.fill();c.stroke();
 c.beginPath();c.moveTo(x-5,by-3);c.lineTo(x,by+4);c.lineTo(x+5,by-3);c.fill();c.stroke();c.fillStyle='#fff';c.fillRect(x-4,by-4,8,3);c.fillStyle='#5a3d33';c.fillText(tx,x,by-9);c.restore()}
function pill(c,x,y,text,o){o=o||{};c.save();c.font='bold 11px '+UIF();c.textAlign='center';const w=c.measureText(text).width+16;
 c.fillStyle=o.fill||'rgba(255,250,241,.94)';c.strokeStyle=o.stroke||'#5a3d33';c.lineWidth=2;c.beginPath();c.roundRect(x-w/2,y,w,17,8);c.fill();c.stroke();c.fillStyle=o.ink||'#5a3d33';c.fillText(text,x,y+12);c.restore()}
// ---------- the owner at home (stands in a corner of the room) ----------
const AV_S=.9,HOME={hit:null};
function homePose(now,P){if(S.avTap&&now<S.avTap)return'wave';for(const d of Object.values(S.dogs)){if(d.state=='SEEK_OWNER'){const q=posOf(d,now);if(Math.hypot(q[0]-P[0],q[1]-P[1])<150)return'happy'}}return'idle'}
function homeAvatar(now){const av=S.ownerAv;if(!av||!D)return null;const P=D.HOMEPOS[av.hm]||D.HOMEPOS.bl;return{av,x:P[0],y:P[1],name:S.owner,pose:homePose(now,P),own:S.owner==S.name}}
function drawHome(c,a,t,now){c.save();c.translate(a.x,a.y);
 c.fillStyle='rgba(60,32,22,.24)';c.beginPath();c.ellipse(0,0,20*AV_S,6*AV_S,0,0,7);c.fill();
 const r=draw(c,a.av,t,{pose:a.pose,s:AV_S,seed:3});c.restore();a.top=r.top;HOME.hit=[a.x,a.y-r.top*.5,Math.max(24,r.w*.55),Math.max(30,r.top*.55)]}
function homeTop(a){return a.y-(a.top||90)}
function drawHomeTag(c,a,t,now){const top=homeTop(a);
 if(S.set.names&&a.name)pill(c,a.x,a.y+9,a.name,{stroke:'#6fb8ff'});
 const b=S.avBub;if(b&&now-b.at<4500)bubble(c,a.x,top-10,b.m,Math.min(1,(4500-(now-b.at))/600));
 else if(a.own&&!LS.get('cd_avhint',false)&&!S.edit){const y=top-14+Math.sin(t*3)*3;c.save();c.font='bold 12px '+UIF();c.textAlign='center';const tx='👕 '+TT('Tap to change outfit','แตะเพื่อเปลี่ยนชุด'),w=c.measureText(tx).width+18;
  c.fillStyle='#fff3c4';c.strokeStyle='#5a3d33';c.lineWidth=2;c.beginPath();c.roundRect(a.x-w/2,y-22,w,22,10);c.fill();c.stroke();c.fillStyle='#5a3d33';c.fillText(tx,a.x,y-7);c.restore()}}
function pickHome(x,y){const h=HOME.hit;if(!h||!S.ownerAv)return false;const dx=(x-h[0])/h[2],dy=(y-h[1])/h[3];return dx*dx+dy*dy<=1}
// ---------- the person walking the dog (park) ----------
const PAV_S=.84,LEASH_D=64;
// collar clip position relative to the dog's feet (px, already scaled / mirrored)
const collar=(info,sc,face)=>[face*info.w*sc*.17,-info.top*sc*.56];
function stepHuman(m,dt,C){
 if(m.hx==null){m.hs=-(m.face||1);m.hx=m.rx+m.hs*LEASH_D;m.hy=m.ry+3;m.hface=m.face||1;m.hstill=0;m.dirAcc=0;m.px0=m.rx}
 // which side the person walks on: behind the dog's heading (switches only after the dog really changed direction)
 const mvx=m.rx-m.px0;m.px0=m.rx;m.dirAcc=m.dirAcc*Math.exp(-dt*1.2)+mvx;if(Math.abs(m.dirAcc)>34)m.hs=m.dirAcc>0?-1:1;
 const gx=clamp(m.rx+m.hs*LEASH_D,26,774),gy=clamp(m.ry+3,C.y0-4,C.y1+8);
 const k=1-Math.exp(-dt*(m.moving?6.5:4)),ox=m.hx,oy=m.hy;m.hx+=(gx-m.hx)*k;m.hy+=(gy-m.hy)*k;
 const sp=Math.hypot(m.hx-ox,m.hy-oy)/Math.max(dt,.001);m.hmv=m.hmv?sp>6:sp>13;m.hstill=m.hmv?0:m.hstill+dt;
 if(Math.abs(m.rx-m.hx)>10)m.hface=m.rx>m.hx?1:-1}
function humanPose(m,now){let pose='stand';const em=m.emote&&now-m.emote.at<1800?m.emote.e:null;
 if(m.hmv)pose='walk';else if(em)pose=em=='👋'?'wave':'happy';else if(m.hstill>.5)pose='idle';
 return pose}
// draw the person + remember the hand position; the leash is drawn separately (on top of both)
function drawHuman(c,m,t,now){if(!m.av||m.hx==null)return;const pose=humanPose(m,now),front=isFront(pose),dogRight=m.rx>m.hx,wade=PARKART.inPond(m.hx,m.hy),sink=wade?4:0;
 c.save();c.translate(m.hx,m.hy);c.fillStyle='rgba(60,32,22,.24)';c.beginPath();c.ellipse(0,0,19*PAV_S,5.6*PAV_S,0,0,7);c.fill();c.translate(0,sink);
 const r=draw(c,m.av,t,{pose,s:PAV_S,flip:front?dogRight:!dogRight,hold:front?'L':null,seed:m.seed||0});c.restore();
 if(wade){c.save();c.translate(m.hx,m.hy+1);c.fillStyle='rgba(90,175,225,.5)';c.beginPath();c.ellipse(0,0,17*PAV_S,6*PAV_S,0,0,7);c.fill();c.strokeStyle='rgba(255,255,255,'+(.55+.3*Math.sin(t*6+1))+')';c.lineWidth=2;c.beginPath();c.ellipse(0,1,(15+Math.sin(t*4+1)*3)*PAV_S,(4.6+Math.sin(t*4+1))*PAV_S,0,0,7);c.stroke();c.restore()}
 m._hand=[m.hx+r.hand[0],m.hy+r.hand[1]+sink];m._htop=r.top+sink*-1;m._hhit=[m.hx,m.hy-r.top*.5,Math.max(22,r.w*.6),Math.max(28,r.top*.55)]}
function drawLeash(c,m,t){if(!m._hand||m._top==null||!m.av)return;const b=DOGS.BR[m.breed];if(!b)return;const sc=b.size*.9,cl=collar({w:m._w||90,top:m._top/sc},sc,m.face||1);
 leash(c,m._hand[0],m._hand[1],m.rx+cl[0],m.ry+cl[1]+(m.wade?5:0),m.av.ls,t,{moving:m.hmv,len:LEASH_D*1.15})}
// ---------- animated preview: the person walking their dog (wardrobe + profile) ----------
// get() -> {av,pose:'walk'|'idle'|'wave'|'happy',dog:{breed,variant,acc}|null}
function stage(cv,get){
 const g=cv.getContext('2d'),W=cv.width,H=cv.height,t0=performance.now(),k=H/160;let last=t0,scroll=0;
 const tuft=(x,y,c)=>{g.fillStyle=c;g.fillRect(x,y,2,4);g.fillRect(x-3,y+2,2,2);g.fillRect(x+3,y+2,2,2)};
 const cloud=(x,y,sz)=>{g.fillStyle='rgba(255,255,255,.92)';g.beginPath();g.roundRect(x,y,sz*3.4,sz,sz/2);g.fill();g.beginPath();g.arc(x+sz*1,y,sz*.7,0,7);g.fill();g.beginPath();g.arc(x+sz*1.9,y-sz*.15,sz*.9,0,7);g.fill()};
 const loop=()=>{if(!document.body.contains(cv))return;requestAnimationFrame(loop);
  const now=performance.now(),t=(now-t0)/1000,dt=Math.min(.05,(now-last)/1000);last=now;const st=get();if(!st||!st.av)return;
  const walk=st.pose==='walk';if(walk)scroll+=dt*(46*k);
  g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,W,H);g.imageSmoothingEnabled=false;
  const gy=H*.6,sky=g.createLinearGradient(0,0,0,gy);sky.addColorStop(0,'#aee0ff');sky.addColorStop(1,'#eaf9ff');g.fillStyle=sky;g.fillRect(0,0,W,gy+2);
  g.fillStyle='#ffe58a';g.beginPath();g.arc(W*.86,H*.17,H*.09,0,7);g.fill();g.fillStyle='rgba(255,246,200,.5)';g.beginPath();g.arc(W*.86,H*.17,H*.13,0,7);g.fill();
  cloud(((t*5+W*.1)%(W+120))-60,H*.14,9*k*.7);cloud(((t*3+W*.62)%(W+120))-60,H*.27,7*k*.7);
  g.fillStyle='#b6e6a2';g.beginPath();g.ellipse(W*.18,gy+4,W*.34,H*.12,0,Math.PI,0);g.fill();g.fillStyle='#9bd98d';g.beginPath();g.ellipse(W*.78,gy+6,W*.4,H*.14,0,Math.PI,0);g.fill();
  const gr=g.createLinearGradient(0,gy,0,H);gr.addColorStop(0,'#8fdc7a');gr.addColorStop(1,'#62bf5c');g.fillStyle=gr;g.fillRect(0,gy,W,H-gy);
  g.fillStyle='rgba(255,255,255,.18)';g.fillRect(0,gy,W,2);
  for(let i=0;i<16;i++){const bx=((i*W/16*1.01-scroll*(.6+(i%3)*.25))%(W+40)+W+40)%(W+40)-10,by=gy+10+((i*53)%7)*(H-gy-16)/7;tuft(Math.round(bx),Math.round(by),i%2?'#58b552':'#78cc69')}
  const fy=H*.88,hx=W*.34,dx=W*.7;
  // dog
  let info=null,sc=1,dogP=null;
  if(st.dog&&DOGS.BR[st.dog.breed]){const b=DOGS.BR[st.dog.breed];sc=b.size*.9*k*.82;const bob=walk?Math.abs(Math.sin(t*10))*2.5*sc:0;
   g.save();g.translate(dx,fy);g.fillStyle='rgba(60,32,22,.22)';g.beginPath();g.ellipse(0,0,36*sc,7*sc,0,0,7);g.fill();g.scale(sc,sc);g.translate(0,-bob/sc);
   info=DOGS.sprite(g,b,st.dog.variant||'Normal',t,{state:'IDLE',mv:walk,run:false,seed:2,acc:st.dog.acc||null,happy:true,pet:st.pose==='happy'||st.pose==='wave'});g.restore();dogP=[dx,fy]}
  // person
  const S2=k*1.02,front=isFront(st.pose);
  g.save();g.translate(hx,fy);g.fillStyle='rgba(60,32,22,.22)';g.beginPath();g.ellipse(0,0,19*S2,5.6*S2,0,0,7);g.fill();
  const r=draw(g,st.av,t,{pose:st.pose,s:S2,flip:front,hold:front?'L':null,seed:1});g.restore();
  if(info){const cl=collar(info,sc,1);leash(g,hx+r.hand[0],fy+r.hand[1],dogP[0]+cl[0],dogP[1]+cl[1],st.av.ls,t,{moving:walk,len:(dx-hx)*1.05})}
 };loop()}
g.AVA={frame,draw,thumb,bust,leash,key,RATE,CROP,nfr,isFront,cache,html,paint,bubble,pill,homeAvatar,drawHome,drawHomeTag,pickHome,stepHuman,drawHuman,drawLeash,collar,PAV_S,LEASH_D,stage};
})(window);
