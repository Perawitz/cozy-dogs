// Cozy Dogs - world: canvas, render loop, dogs, FX, picking, decorate mode, photo
'use strict';
const cv=$('#cv'),cx=cv.getContext('2d');
const World={scale:1,W:800,H:600,drag:null,selItem:null,hover:null,fxs:[],t0:performance.now()};
const fitLocal=(def,x,y)=>{x=+x;y=+y;if(!isFinite(x)||!isFinite(y))return null;
 if(def.kind=='wall'){x=clamp(x,40,760);y=clamp(y,45,235);if(!def.wide&&x>292&&x<508&&y>38&&y<218)return null}
 else{x=clamp(x,30,770);y=def.wallside?clamp(y,330,352):clamp(y,def.kind=='rug'?365:340,578)}return[Math.round(x),Math.round(y)]};
// ---------- sizing ----------
function layout(){const w=innerWidth,h=innerHeight,port=h>w*1.15,dk=$('#dock'),dkH=dk&&!dk.classList.contains('hidden')&&dk.offsetHeight?dk.offsetHeight+14:78;
 // landscape: keep the whole room above the dock (skip on very short screens, where the dock simply floats over the room)
 const rsv=!port&&h>=520?dkH:0;let cw=w-16,ch=cw*.75;const maxH=h-4-rsv;if(ch>maxH){ch=maxH;cw=ch/.75}const st=$('#stage');st.style.alignItems=port?'flex-start':'center';st.style.paddingTop=port?'104px':'0';st.style.paddingBottom=rsv+'px';
 cv.style.width=cw+'px';cv.style.height=ch+'px';const dpr=Math.min(2,devicePixelRatio||1);cv.width=Math.round(cw*dpr);cv.height=Math.round(ch*dpr);World.scale=cv.width/800;World.css=cw/800}
addEventListener('resize',layout);
// ---------- environment ----------
function dayHash(){const d=new Date();return(d.getFullYear()*372+d.getMonth()*31+d.getDate())}
function autoWeather(){const h=dayHash(),m=new Date().getMonth(),r=((h*2654435761)>>>0)%100;if(m==11||m==0)return r<35?'snow':r<60?'cloudy':'sunny';return r<55?'sunny':r<80?'cloudy':'rain'}
const TIMES={morning:8,noon:13,evening:18.6,night:23};
function env(){return{hour:S.set.time=='auto'?ROOM.hour():TIMES[S.set.time]||13,weather:S.set.weather=='auto'?autoWeather():S.set.weather,season:S.cat?S.cat.season:''}}
// ---------- data ----------
function rebuildItems(){const C=S.cat?S.cat.items:{};S.ritems=S.items.filter(i=>C[i.type]).map(i=>{const d=C[i.type];return{uid:i.uid,type:i.type,draw:d.draw,pal:d.pal,kind:d.kind,lift:d.lift||0,role:d.role,x:i.x,y:i.y,f:i.f||0}})}
function setDog(d){const o=S.dogs[d.id]||{};const pn=performance.now();S.dogs[d.id]=Object.assign(o,d,{t0:pn-(d.el||0),wishExp:d.wish?pn+d.wish.ms:0,fetchAt:d.fetch?pn-d.fetch.el:0,face:o.face||1,seed:o.seed||[...d.id].reduce((a,c)=>a+c.charCodeAt(0),0)%7})}
const posOf=(d,now)=>{const k=clamp((now-d.t0)/d.dur,0,1);return[d.fx+(d.tx-d.fx)*k,d.fy+(d.ty-d.fy)*k,k<1]};
function liftOf(d,now){if(d.state!='SLEEP'||!S.ritems)return 0;const[x,y,mv]=posOf(d,now);if(mv)return 0;for(const it of S.ritems)if(it.lift&&Math.abs(it.x-x)<14&&Math.abs(it.y+1-y)<8)return it.lift;return 0}
// ---------- drawing ----------
function drawDogBody(c,d,t,now,item){const b=DOGS.BR[d.breed];if(!b)return null;const[x,y,mv]=posOf(d,now);if(mv&&Math.abs(d.tx-d.fx)>2)d.face=d.tx>d.fx?1:-1;
 const sc=b.size*.9,run=mv&&d.state=='RUN',bob=mv?Math.abs(Math.sin(t*(run?17:10)))*(run?6:2.5):(d.state=='PLAY'?Math.abs(Math.sin(t*8))*9:0);
 const lt=liftOf(d,now);d._lift=(d._lift||0)+(lt-(d._lift||0))*.18;const L=d._lift;
 let trickK=null;if(d.state=='TRICK'&&d.trick&&!mv){const k=(now-d.t0-d.dur)/DOGS.TRICK_MS;if(k>=0&&k<=1)trickK=k}
 c.save();c.translate(x,y);
 c.fillStyle='rgba(60,32,22,'+(L>2?.12:.24)+')';c.beginPath();c.ellipse(0,0,(L>2?26:38)*sc,(L>2?4:7)*sc,0,0,7);c.fill();
 c.translate(0,-L);c.scale(d.face*sc,sc);c.translate(0,-bob);
 if(b.r=='M'){c.shadowColor=b.acc;c.shadowBlur=14}
 const info=DOGS.sprite(c,b,d.variant,t,{state:d.state,mv,run,seed:d.seed,pet:now-(d.petAt||0)<1800,happy:d.happy>80,sad:d.happy<30,acc:d.acc,trick:d.trick,trickK});
 c.restore();
 d._pos=[x,y,L,mv,trickK];d._top=info.top*sc;d._hit=[x,y-L-d._top*.45,Math.max(26,d._top*.55)];return d}
function drawLabels(c,d,t,now,sel){const b=DOGS.BR[d.breed];if(!b||!d._pos)return;const[x,y,L,mv,tk]=d._pos,top=d._top;
 if(sel){c.save();c.strokeStyle='#ff8fb0';c.lineWidth=3;c.setLineDash([6,5]);c.lineDashOffset=-t*14;c.beginPath();c.ellipse(x,y+1,46*b.size*.9,10*b.size*.9,0,0,7);c.stroke();c.restore();
  c.fillStyle='#ff8fb0';c.strokeStyle='#5a3d33';c.lineWidth=2;const ay=y-L-top-26+Math.sin(t*4)*3;c.beginPath();c.moveTo(x-7,ay);c.lineTo(x+7,ay);c.lineTo(x,ay+9);c.closePath();c.fill();c.stroke()}
 let em=null;if(tk!=null)em=DOGS.TEM[d.trick];else if(!mv&&DOGS.EM[d.state])em=DOGS.EM[d.state];
 if(S.hungry&&S.hungry[d.id])em='🍖';
 if(em){c.font='20px sans-serif';c.textAlign='center';c.fillText(em,x,y-L-top-8-Math.sin(t*3)*3)}
 if((S.set.names||sel)&&d.name){c.font='bold 11px '+UIF();c.textAlign='center';const w=c.measureText(d.name).width+16,r=b.r;c.fillStyle=sel?'#ff8fb0':'rgba(255,250,241,.92)';c.strokeStyle=r&&r!='C'?RCOL[r]:'#5a3d33';c.lineWidth=2;c.beginPath();c.roundRect(x-w/2,y+9,w,17,8);c.fill();c.stroke();c.fillStyle=sel?'#fff':'#5a3d33';c.fillText(d.name,x,y+21)}
 if(d.wish&&S.owner==S.name&&typeof drawWish=='function')drawWish(c,d,t,now,x,y-L-top)}
function fxDraw(c,t,dt){for(let i=World.fxs.length-1;i>=0;i--){const f=World.fxs[i];f.life-=dt;if(f.life<=0){World.fxs.splice(i,1);continue}f.x+=f.vx*dt;f.y+=f.vy*dt;f.vy+=(f.g||0)*dt;const a=Math.min(1,f.life/(f.max*.4));
  c.save();c.globalAlpha=a;c.translate(f.x,f.y);if(f.type=='text'){c.font='bold '+(f.size||18)+'px '+UIF();c.textAlign='center';c.lineWidth=4;c.strokeStyle='#5a3d33';c.strokeText(f.txt,0,0);c.fillStyle=f.col||'#fff';c.fillText(f.txt,0,0)}
  else if(f.type=='dust'){c.fillStyle=f.col||'#eadcc0';const s=(f.size||4)*(1+(1-f.life/f.max)*.8);c.fillRect(-s/2,-s/2,s,s)}
  else if(f.type=='spark'){c.fillStyle=f.col||'#fff6a8';const s=f.size||3;c.fillRect(-s/2,-s*1.5,s,s*3);c.fillRect(-s*1.5,-s/2,s*3,s)}
  else{c.font=(f.size||24)+'px sans-serif';c.textAlign='center';c.rotate(Math.sin(t*5+f.x)*.2);c.fillText(f.txt,0,0)}c.restore()}}
function fx(type,x,y,o={}){if(!S.set.particles&&type!='text')return;World.fxs.push(Object.assign({type,x,y,vx:rnd(-12,12),vy:-rnd(30,56),life:1.4,max:1.4,txt:'❤️'},o))}
function burst(x,y,e='❤️',n=5){for(let i=0;i<n;i++)fx('emoji',x+rnd(-20,20),y+rnd(-10,10),{txt:e,vx:rnd(-25,25),vy:-rnd(35,75),life:1.2+rnd(0,.6),max:1.6,size:rnd(18,28)})}
function sparkle(x,y,n=10,col){for(let i=0;i<n;i++)fx('spark',x+rnd(-28,28),y+rnd(-50,0),{vx:rnd(-30,30),vy:-rnd(10,50),life:.8+rnd(0,.5),max:1.2,size:rnd(2,4),col})}
function floatText(x,y,txt,col){fx('text',x,y,{txt,col,vx:0,vy:-34,life:1.3,max:1.3})}
// ---------- main render ----------
function renderWorld(c,W,t,now,dt){const e=W.env||env();c.save();c.scale(World.scale,World.scale);c.imageSmoothingEnabled=false;ROOM.setDeco(W.deco);ROOM.back(c,t,e);
 const its=W.items||[],rugs=its.filter(i=>i.kind=='rug'),walls=its.filter(i=>i.kind=='wall'),fl=its.filter(i=>i.kind=='floor');
 for(const i of rugs)ROOM.item(c,i,t,e);for(const i of walls)ROOM.item(c,i,t,e);
 const ents=fl.map(i=>({k:'i',y:i.y,o:i}));if(W.avatar)ents.push({k:'a',y:W.avatar.y,o:W.avatar});const dogs=W.dogs;for(const d of dogs){const[x,y]=posOf(d,now);ents.push({k:'d',y:y+(d._lift>2?.6:0),o:d})}
 ents.sort((a,b)=>a.y-b.y);for(const en of ents){if(en.k=='i')ROOM.item(c,en.o,t,e,{ghost:W.ghost==en.o.uid});else if(en.k=='a')AVA.drawHome(c,en.o,t,now);else drawDogBody(c,en.o,t,now)}
 ROOM.front(c,t,e,its);
 for(const d of dogs)drawLabels(c,d,t,now,W.sel==d.id);
 if(W.avatar)AVA.drawHomeTag(c,W.avatar,t,now);
 if(W.after)W.after(c,t,now,e);fxDraw(c,t,dt);c.restore()}
let last=performance.now();
function loop(ms){const dt=Math.min(.1,(ms-last)/1000);last=ms;requestAnimationFrame(loop);
 if(S.scr=='game'){const t=(ms-World.t0)/1000;cx.setTransform(1,0,0,1,0,0);cx.clearRect(0,0,cv.width,cv.height);
  if(Park.on)renderPark(cx,t,performance.now(),dt);else renderWorld(cx,{deco:S.deco,items:S.ritems||[],dogs:Object.values(S.dogs),sel:S.sel,env:null,after:worldAfter,avatar:AVA.homeAvatar(performance.now())},t,performance.now(),dt);positionItemBar()}
 else if(S.scr=='login')loginFrame(ms,dt)}
// ---------- picking ----------
function toWorld(e){const r=cv.getBoundingClientRect();return[(e.clientX-r.left)/r.width*800,(e.clientY-r.top)/r.height*600]}
const alphaCache=new WeakMap();
function alphaAt(it,x,y){const s=ITEMART.sprite(it.draw,it.draw=='clock'?(Math.floor(ROOM.hour()*60)%720):it.pal,0);if(!s)return false;let px=Math.floor(((it.f?-1:1)*(x-it.x)+s.ax*2)/2),py=Math.floor((y-it.y+s.ay*2)/2);if(px<0||py<0||px>=s.w||py>=s.h)return false;
 let im=alphaCache.get(s.cv);if(!im){im=s.cv.getContext('2d').getImageData(0,0,s.w,s.h);alphaCache.set(s.cv,im)}return im.data[(py*s.w+px)*4+3]>40}
function orderedItems(){const its=S.ritems||[];return[...its.filter(i=>i.kind=='rug'),...its.filter(i=>i.kind=='wall'),...its.filter(i=>i.kind=='floor').sort((a,b)=>a.y-b.y)]}
function pickItem(x,y){const o=orderedItems();for(let i=o.length-1;i>=0;i--){const it=o[i],b=ROOM.box(it);if(x>=b.x0-4&&x<=b.x1+4&&y>=b.y0-4&&y<=b.y1+4&&(alphaAt(it,x,y)||(Math.abs(x-it.x)<6&&Math.abs(y-it.y)<6)))return it}return null}
function pickDog(x,y){let best=null,bd=1e9;for(const d of Object.values(S.dogs)){if(!d._hit)continue;const[hx,hy,r]=d._hit,dd=Math.hypot(x-hx,y-hy);if(dd<r&&dd<bd){best=d;bd=dd}}return best}
// ---------- decorate mode ----------
function editOverlay(c,t){if(!S.edit)return;
 c.save();if(World.selItem){const it=(S.ritems||[]).find(i=>i.uid==World.selItem);if(it){const b=ROOM.box(it);c.strokeStyle='#fff';c.lineWidth=3;c.setLineDash([8,6]);c.lineDashOffset=-t*20;c.strokeRect(b.x0-3,b.y0-3,b.x1-b.x0+6,b.y1-b.y0+6);c.strokeStyle='#ff8fb0';c.lineDashOffset=-t*20+7;c.stroke()}}
 if(World.drag&&World.drag.mode=='new'&&World.drag.x!=null){const def=S.cat.items[World.drag.id],p=fitLocal(def,World.drag.x,World.drag.y),ok=!!p,pp=p||[World.drag.x,World.drag.y];
  const it={draw:def.draw,pal:def.pal,kind:def.kind,x:pp[0],y:pp[1],f:0,uid:'ghost'};ROOM.item(c,it,t,env(),{ghost:true});const b=ROOM.box(it);c.fillStyle=ok?'rgba(111,209,165,.28)':'rgba(255,107,107,.35)';c.fillRect(b.x0,b.y0,b.x1-b.x0,b.y1-b.y0)}
 c.restore()}
// The floating bar over the selected item: flip / put back into the bag / delete for good (needs a 2nd tap).
// (It used to be an empty <div>, which is why furniture could not be removed.)
function itemBarHtml(){return`<button class="btn sm sky" data-do="flip" title="${t('Flip')}">🔄 ${t('Flip')}</button><button class="btn sm mint" data-do="store" title="${t('Store')}">📦 ${t('Store')}</button><button class="btn sm red" data-do="discard" title="${t('Delete')}">🗑 ${t('Delete')}</button>`}
function positionItemBar(){const bar=$('#itembar');const it=S.edit&&World.selItem&&(S.ritems||[]).find(i=>i.uid==World.selItem);if(!it){bar.classList.remove('on');return}
 if(bar.dataset.lg!==S.set.lang){bar.dataset.lg=S.set.lang;bar.innerHTML=itemBarHtml();bar._w=0}
 const b=ROOM.box(it),r=cv.getBoundingClientRect(),px=r.left+(b.x0+b.x1)/2/800*r.width,py=r.top+b.y0/600*r.height;bar.classList.add('on');
 if(!bar._w)bar._w=bar.offsetWidth||230;
 bar.style.left=clamp(px-bar._w/2,6,Math.max(6,innerWidth-bar._w-6))+'px';bar.style.top=Math.max(r.top+4,py-44)+'px';bar.style.transform='none'}
function selectItem(uid){World.selItem=uid;disarmDiscard();positionItemBar()}
function startPlace(id,ev){if(!S.edit)return;const def=S.cat.items[id];const d={mode:'new',id,x:null,y:null,moved:false,sx:ev.clientX,sy:ev.clientY};World.drag=d;
 const mv=e=>{if(Math.hypot(e.clientX-d.sx,e.clientY-d.sy)>6)d.moved=true;if(d.moved){const[x,y]=toWorld(e);d.x=x;d.y=y}};
 const stop=()=>{removeEventListener('pointermove',mv);removeEventListener('pointerup',up);removeEventListener('pointercancel',stop);if(World.drag===d)World.drag=null};
 const up=e=>{stop();const r=cv.getBoundingClientRect();
  let x,y;if(d.moved&&e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom){[x,y]=toWorld(e)}else if(!d.moved){x=def.kind=='wall'?560:def.kind=='rug'?400:380;y=def.kind=='wall'?110:def.wallside?340:def.kind=='rug'?470:470}else return;
  S.pendingSelect=id;send({t:'place',id,x,y});sfx('place')};
 addEventListener('pointermove',mv);addEventListener('pointerup',up);addEventListener('pointercancel',stop)}
cv.addEventListener('pointerdown',e=>{if(Park.on)return;const[x,y]=toWorld(e);
 if(S.edit&&S.owner==S.name){const it=pickItem(x,y);if(it){selectItem(it.uid);World.drag={mode:'item',uid:it.uid,ox:it.x-x,oy:it.y-y,moved:false};cv.setPointerCapture(e.pointerId);sfx('click')}else{selectItem(null)}return}
 if(S.fetchMode&&S.owner==S.name){fetchThrow(clamp(x,70,730),clamp(y,350,556));return}
 const d=pickDog(x,y);if(d){if(S.sel==d.id){send({t:'act',a:'pet',dog:d.id});d.petAt=performance.now();sfx('pet')}else{S.sel=d.id;sfx('pop');UI.care()}}else if(AVA.pickHome(x,y)){avatarTap()}else if(S.sel){S.sel=null;UI.care()}});
function avatarTap(){S.avTap=performance.now()+1900;sfx('pop');if(S.owner==S.name)setTimeout(()=>DO.wardrobe(),260);else{const a=AVA.homeAvatar(performance.now());if(a)floatText(a.x,a.y-(a.top||90)-8,'👋 '+S.owner,'#fff')}}
cv.addEventListener('pointermove',e=>{if(Park.on){cv.style.cursor='crosshair';return}const[x,y]=toWorld(e);const d=World.drag;
 if(d&&d.mode=='item'){const it=(S.ritems||[]).find(i=>i.uid==d.uid);if(!it)return;const def=S.cat.items[it.type],p=fitLocal(def,x+d.ox,y+d.oy);if(p){if(p[0]!=it.x||p[1]!=it.y)d.moved=true;it.x=p[0];it.y=p[1]}return}
 if(S.edit){cv.style.cursor=pickItem(x,y)?'grab':'default'}else cv.style.cursor=S.fetchMode?'crosshair':(pickDog(x,y)||AVA.pickHome(x,y))?'pointer':'default'});
const endDrag=()=>{const d=World.drag;if(!d||d.mode!='item')return;const it=(S.ritems||[]).find(i=>i.uid==d.uid);if(it&&d.moved){send({t:'move',uid:it.uid,x:it.x,y:it.y});sfx('place')}World.drag=null};
cv.addEventListener('pointerup',endDrag);cv.addEventListener('pointercancel',endDrag);
function flipItem(){const it=(S.ritems||[]).find(i=>i.uid==World.selItem);if(!it)return;it.f=it.f?0:1;send({t:'move',uid:it.uid,x:it.x,y:it.y,f:it.f});sfx('click')}
function storeItem(){if(!World.selItem)return;send({t:'store',uid:World.selItem});World.selItem=null;sfx('pop')}
function disarmDiscard(){clearTimeout(discardItem.tm);const b=$('#itembar [data-do=discard]');if(b&&b.classList.contains('arm')){b.classList.remove('arm');b.innerHTML='🗑 '+t('Delete');$('#itembar')._w=0}}
function discardItem(){if(!World.selItem)return;const bar=$('#itembar'),b=$('[data-do=discard]',bar);
 if(b&&!b.classList.contains('arm')){b.classList.add('arm');b.innerHTML='🗑 '+t('Tap again to delete');bar._w=0;clearTimeout(discardItem.tm);discardItem.tm=setTimeout(disarmDiscard,2600);return}
 disarmDiscard();send({t:'discard',uid:World.selItem});World.selItem=null;sfx('pop')}
// ---------- photo ----------
function photo(){const f=$('#flash');f.style.transition='none';f.style.opacity=.9;requestAnimationFrame(()=>{f.style.transition='opacity .5s';f.style.opacity=0});sfx('shake');
 const W=720,H=720*.75,pad=22,o=document.createElement('canvas');o.width=W+pad*2;o.height=H+pad*2+64;const c=o.getContext('2d');c.fillStyle='#fffaf1';c.fillRect(0,0,o.width,o.height);c.imageSmoothingEnabled=true;c.drawImage(cv,pad,pad,W,H);
 c.strokeStyle='#5a3d33';c.lineWidth=4;c.strokeRect(pad,pad,W,H);c.fillStyle='#5a3d33';c.font='bold 26px '+UIF();c.textAlign='center';c.fillText('Cozy Dogs 🐾 '+S.owner+"'s house",o.width/2,pad*2+H+14);c.font='bold 15px sans-serif';c.fillStyle='#8c6d5f';c.fillText(new Date().toLocaleString(),o.width/2,pad*2+H+42);
 const th=S.set.lang=='th',url=o.toDataURL('image/png');
 if(matchMedia('(pointer:coarse)').matches){      // phones / in-app browsers cannot download: share it, or show it so it can be saved with a long press
  o.toBlob(async b=>{try{const f=new File([b],'cozy-dogs.png',{type:'image/png'});if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f],title:'Cozy Dogs'});return}}catch(e){if(e&&e.name=='AbortError')return}
   modal('photo','📷 '+(th?'รูปถ่าย':'Photo'),`<div class="center"><img src="${url}" alt="" style="width:100%;border-radius:10px;border:3px solid var(--ink)"><p class="muted" style="margin-top:8px;font-weight:800">${th?'กดค้างที่รูป แล้วเลือก “บันทึกรูปภาพ”':'Press and hold the picture, then choose “Save image”'}</p></div>`,'sm')});return}
 const a=document.createElement('a');a.download='cozy-dogs-'+Date.now()+'.png';a.href=url;a.click();toast('📷 '+(th?'บันทึกรูปแล้ว!':'Photo saved!'))}
layout();requestAnimationFrame(loop);
