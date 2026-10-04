// Cozy Dogs - pixel-art furniture & decor sprites. 1 sprite px = 2 world px. Everything is drawn procedurally, cached per (type|pal|frame).
(function(g){
'use strict';
const hx=h=>{h=h.replace('#','');if(h.length==3)h=h.replace(/./g,'$&$&');return[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]};
const hex=a=>'#'+a.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
const TC={};
// tone: k<1 darker (cool shadow), k>1 lighter (warm light)
function T(col,k){const key=col+'|'+k;if(TC[key])return TC[key];const[r,gg,b]=hx(col);let o;
 if(k<1)o=[r*k*.95,gg*k*.98,b*k*1.02+(1-k)*16];else{const q=k-1;o=[r+(255-r)*q*.75+q*10,gg+(255-gg)*q*.72+q*5,b+(255-b)*q*.6]}
 return TC[key]=hex(o)}
const rng=s=>()=>((s=(s*1664525+1013904223)>>>0)/4294967296);

function D(c,ox,oy){const o={c};
 o.r=(x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(x+ox,y+oy,w,h)};
 o.p=(x,y,col)=>{c.fillStyle=col;c.fillRect(x+ox,y+oy,1,1)};
 o.clr=(x,y,w,h)=>c.clearRect(x+ox,y+oy,w,h);
 o.e=(cx,cy,rx,ry,col)=>{c.fillStyle=col;for(let y=-ry;y<=ry;y++){const w=Math.round(rx*Math.sqrt(Math.max(0,1-(y*y)/((ry+.5)*(ry+.5)))));c.fillRect(cx-w+ox,cy+y+oy,w*2+1,1)}};
 // shaded ellipse: dark rim, base, highlight
 o.se=(cx,cy,rx,ry,b,k=1)=>{o.e(cx,cy,rx,ry,T(b,.74));o.e(cx,cy-(ry>2?1:0),rx-(rx>2?1:0),ry-(ry>2?1:0),b);if(rx>=3&&ry>=3)o.e(cx-1,cy-2,Math.max(1,rx-3),Math.max(1,ry-3),T(b,1.2*k))};
 // shaded box
 o.bx=(x,y,w,h,b,rad=1)=>{o.r(x,y,w,h,b);o.r(x+1,y,w-2,1,T(b,1.22));o.r(x,y+1,1,h-2,T(b,1.12));o.r(x+1,y+h-1,w-2,1,T(b,.76));o.r(x+w-1,y+1,1,h-2,T(b,.84));
  if(rad){o.clr(x,y,1,1);o.clr(x+w-1,y,1,1);o.clr(x,y+h-1,1,1);o.clr(x+w-1,y+h-1,1,1)}};
 o.ln=(x0,y0,x1,y1,col)=>{if(!(isFinite(x0)&&isFinite(y0)&&isFinite(x1)&&isFinite(y1)))return;x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);const dx=Math.abs(x1-x0),dy=-Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1;let e=dx+dy;for(;;){o.p(x0,y0,col);if(x0==x1&&y0==y1)break;const e2=2*e;if(e2>=dy){e+=dy;x0+=sx}if(e2<=dx){e+=dx;y0+=sy}}};
 // char map: rows of chars -> palette
 o.map=(x,y,rows,pal)=>rows.forEach((row,j)=>[...row].forEach((ch,i)=>{if(pal[ch])o.p(x+i,y+j,pal[ch])}));
 // leaf along an angle
 o.leaf=(cx,cy,len,ang,wd,col)=>{for(let i=0;i<=len;i++){const t=i/len,x=Math.round(cx+Math.cos(ang)*i),y=Math.round(cy+Math.sin(ang)*i),r=Math.max(0,Math.round(Math.sin(Math.PI*Math.pow(t,.8))*wd));
   o.e(x,y,r,r,T(col,.8));}
  for(let i=0;i<=len;i++){const t=i/len,x=Math.round(cx+Math.cos(ang)*i),y=Math.round(cy+Math.sin(ang)*i),r=Math.max(0,Math.round(Math.sin(Math.PI*Math.pow(t,.8))*wd)-1);o.e(x,y,r,r,col)}
  for(let i=1;i<len;i+=1){const x=Math.round(cx+Math.cos(ang)*i),y=Math.round(cy+Math.sin(ang)*i);o.p(x,y,T(col,1.35))}};
 return o}

// auto-outline: transparent pixel next to an opaque one becomes a dark version of the neighbour colour
function outline(cv,strength){const c=cv.getContext('2d'),w=cv.width,h=cv.height,im=c.getImageData(0,0,w,h),d=im.data,out=new Uint8ClampedArray(d);
 const A=(x,y)=>x<0||y<0||x>=w||y>=h?0:d[(y*w+x)*4+3];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;if(d[i+3]>40)continue;let r=0,gg=0,b=0,n=0;
  for(const[dx,dy]of[[0,-1],[-1,0],[1,0],[0,1]]){if(A(x+dx,y+dy)>200){const j=((y+dy)*w+x+dx)*4;r+=d[j];gg+=d[j+1];b+=d[j+2];n++}}
  if(n){out[i]=r/n*strength;out[i+1]=gg/n*strength*.95;out[i+2]=Math.min(255,b/n*strength*1.1+14);out[i+3]=255}}
 im.data.set(out);c.putImageData(im,0,0)}

const META={},DRAW={};
function def(id,w,h,ax,ay,fr,fn,o={}){const t=o.top||0;META[id]=Object.assign({w:w+2,h:h+2+t,ax:ax+1,ay:ay+1+t,fr,ol:.42,top:t},o);DRAW[id]=fn}
const PALS={pink:{b:'#ec9fb6',a:'#fff2d4',d:'#c86c8a'},blue:{b:'#7ca6e2',a:'#ffe7ae',d:'#4f78b8'},mint:{b:'#8ed6b6',a:'#fff6dc',d:'#4fa684'},yellow:{b:'#f4c85a',a:'#fff',d:'#c8962a'},
 teal:{b:'#4db5b0',a:'#ffe08a',d:'#2a8a88'},green:{b:'#6cc48a',a:'#fff3c8',d:'#3f9a62'},red:{b:'#dc625a',a:'#fff3c8',d:'#a8403a'}};

// ================= toys =================
def('ball',12,12,6,12,1,d=>{d.se(6,6,5,5,'#cbe34c');for(const[x,y]of[[3,3],[4,4],[4,5],[4,6],[4,7],[3,8],[9,3],[8,4],[8,5],[8,6],[8,7],[9,8]])d.p(x,y,'#f6fadc');d.p(4,2,'#eef7a8')});
def('frisbee',22,10,11,10,1,d=>{d.e(11,5,10,4,'#a9322c');d.e(11,4,10,3,'#e84c40');d.e(11,4,7,2,'#ff8b78');d.e(11,4,4,1,'#ffd0c4');d.r(3,4,2,1,'#fff');d.r(17,4,2,1,'#fff')});
def('rope',24,10,12,10,1,d=>{for(let x=2;x<22;x++){const y=4+Math.round(Math.sin(x*.55)*2.2);d.r(x,y,1,3,x%3==0?'#b88f4a':'#e8cf9a');d.p(x,y,'#f6e4b8')}d.se(3,6,2,2,'#a07a3a');d.se(21,4,2,2,'#a07a3a');d.p(2,8,'#7a5a2a');d.p(22,6,'#7a5a2a')});
def('duck',18,16,9,16,1,d=>{d.se(8,11,6,4,'#ffd445');d.se(12,5,4,4,'#ffe266');d.e(7,11,3,2,'#f2bd30');d.r(15,6,3,2,'#ff8a2a');d.p(15,8,'#d86a1a');d.p(12,4,'#2a2a30');d.p(3,9,'#ffd445');d.p(2,8,'#ffe266');d.r(5,14,8,1,'#b8d8f0');d.p(11,3,'#fff6b0')});
def('teddy',20,24,10,24,1,d=>{d.se(4,4,2,2,'#b47a4a');d.se(16,4,2,2,'#b47a4a');d.e(4,4,1,1,'#e8b8a0');d.e(16,4,1,1,'#e8b8a0');
 d.se(10,16,6,6,'#b47a4a');d.e(10,17,3,3,'#e8c49a');d.se(3,15,2,3,'#a86e40');d.se(17,15,2,3,'#a86e40');d.se(6,22,3,2,'#a86e40');d.se(14,22,3,2,'#a86e40');
 d.se(10,8,6,5,'#c98a58');d.e(10,10,3,2,'#ecd0a8');d.p(9,9,'#3a2418');d.p(10,9,'#3a2418');d.p(7,7,'#2a1a14');d.p(13,7,'#2a1a14');d.p(10,11,'#7a4a30');
 d.r(7,13,6,1,'#d94a4a');d.p(9,14,'#d94a4a');d.p(10,14,'#d94a4a');d.p(11,14,'#d94a4a')});
def('squeaky',22,12,11,12,1,d=>{const c='#ff9cb6';d.se(3,4,3,3,c);d.se(3,8,3,3,c);d.se(19,4,3,3,c);d.se(19,8,3,3,c);d.r(4,3,14,6,c);d.r(4,3,14,1,T(c,1.25));d.r(4,8,14,1,T(c,.76));d.p(10,5,'#fff');d.p(11,5,'#fff');d.r(15,5,2,2,T(c,.6));d.p(2,2,'#ffe0ea')});

// ================= bowls =================
function bowl(d,col,inside,f,water){d.e(13,5,11,3,T(col,1.15));
 for(let y=6;y<=11;y++){const hw=11-Math.floor((y-5)*.6);d.r(13-hw,y,hw*2+1,1,col);d.r(13-hw,y,2,1,T(col,1.2));d.r(13+hw-1,y,2,1,T(col,.78))}
 d.r(7,12,13,1,T(col,.7));d.r(3,6,1,1,T(col,1.3));d.r(8,8,11,1,'#fff6ec');d.p(13,8,T(col,.8));d.p(12,8,T(col,.8));d.p(14,8,T(col,.8));
 d.e(13,5,9,2,T(col,.6));
 if(water){d.e(13,5,9,2,'#8fd2f6');d.e(13,5,8,1,'#b8e6ff');const o=f?2:0;d.p(8+o,5,'#fff');d.p(9+o,5,'#fff');d.p(15-o,6,'#e8f8ff');d.p(16-o,6,'#e8f8ff');d.p(13,4,'#fff')}
 else{d.e(13,5,9,2,'#7a4e2c');d.e(13,4,7,2,'#8a5a34');const r=rng(7);for(let i=0;i<16;i++){const x=6+Math.floor(r()*14),y=3+Math.floor(r()*4);d.p(x,y,['#b07840','#6a4020','#c8924e'][i%3])}d.p(10,3,'#d8a860');d.p(15,3,'#d8a860')}}
def('bowl',26,14,13,13,1,(d)=>bowl(d,'#e0554a',0,0,false));
def('water',26,14,13,13,2,(d,p,f)=>bowl(d,'#4f9ee6',0,f,true));

// ================= beds / houses =================
def('bed',52,26,26,25,1,(d,p)=>{const P=PALS[p]||PALS.pink;d.e(26,20,25,5,T(P.b,.62));d.se(26,15,25,9,P.b);d.e(26,15,20,6,T(P.b,.7));d.e(26,16,18,5,T(P.a,.98));d.e(26,15,16,4,T(P.a,1.08));
 for(let i=0;i<22;i++){const a=i/22*Math.PI*2;d.p(Math.round(26+Math.cos(a)*18),Math.round(15+Math.sin(a)*5.5),T(P.b,1.05))}
 d.map(23,12,['.a.a.','aaaaa','.aaa.','..a..'].map(s=>s),{a:T(P.d,1)});d.p(24,11,P.d);d.p(26,10,P.d);d.p(28,11,P.d);
 d.r(8,9,6,1,T(P.b,1.35));d.r(14,7,5,1,T(P.b,1.35))});
def('doghouse',62,58,31,58,1,d=>{const wl='#c88e58';d.r(4,56,54,2,'#7a5a3e');
 for(let y=22;y<56;y++){d.r(8,y,46,1,y%6==0?T(wl,.82):wl)}d.r(8,22,2,34,T(wl,1.15));d.r(52,22,2,34,T(wl,.8));
 for(let y=2;y<24;y++){const hw=Math.round(1+(y-2)/22*28);const x0=31-hw;d.r(x0,y,hw*2,1,y%5==0?T(wl,.9):T(wl,1.05))}
 for(let y=2;y<24;y++){const hw=Math.round(1+(y-2)/22*28);d.r(31-hw-1,y,6,1,'#c9473d');d.r(31+hw-5,y,6,1,'#a8352f');if(y%4==0){d.r(31-hw-1,y,6,1,'#a8352f');d.r(31+hw-5,y,6,1,'#8a2a26')}}
 d.r(30,0,2,2,'#e0675a');d.r(2,22,58,3,'#d94d42');d.r(2,25,58,1,'#8a2a26');d.r(2,22,58,1,'#ef7a6a');
 d.e(31,38,9,8,'#2a1a18');d.r(22,38,19,18,'#2a1a18');d.r(34,38,7,18,'#1a100e');d.e(31,38,9,8,'#2a1a18');
 d.r(21,38,1,18,'#6a4a2e');d.r(41,38,1,18,'#6a4a2e');for(let i=0;i<8;i++){d.p(31-9+Math.round(9-Math.sqrt(81-(i-8)*(i-8)+.1)),38-8+i,'#6a4a2e')}
 d.r(25,27,12,6,'#fff3dc');d.r(25,27,12,1,'#fff');d.r(25,32,12,1,'#d8c8a8');d.p(27,29,'#8a5a36');d.p(28,30,'#8a5a36');d.p(30,29,'#8a5a36');d.p(31,29,'#8a5a36');d.p(34,29,'#8a5a36');d.p(33,30,'#8a5a36');
 d.r(12,46,6,1,T(wl,.7));d.r(44,33,6,1,T(wl,.7))},{ol:.4});

// ================= sofa / armchair =================
def('sofa',80,46,40,46,1,(d,p)=>{const P=PALS[p]||PALS.pink,b=P.b;
 d.r(6,41,4,5,'#8a5a36');d.r(70,41,4,5,'#8a5a36');d.r(7,41,1,5,'#b07a4a');d.r(71,41,1,5,'#b07a4a');
 d.bx(6,2,68,28,b,2);d.r(8,4,64,1,T(b,1.3));
 for(const[x,y]of[[18,10],[30,10],[42,10],[54,10],[66,10],[24,18],[36,18],[48,18],[60,18],[12,18]]){d.p(x,y,T(b,.66));d.p(x+1,y,T(b,.8));d.p(x,y-1,T(b,1.3))}
 for(let x=14;x<68;x+=12){d.ln(x,11,x+6,17,T(b,.86));d.ln(x+12,11,x+6,17,T(b,.86))}
 d.bx(0,14,14,30,T(b,.94),3);d.bx(66,14,14,30,T(b,.9),3);d.se(7,15,7,5,b);d.se(73,15,7,5,T(b,.96));
 d.bx(12,24,56,14,T(b,1.06),2);d.r(39,25,2,13,T(b,.62));d.bx(14,27,24,11,T(b,1.1),2);d.bx(42,27,24,11,T(b,1.08),2);
 d.r(14,36,52,1,T(b,.84));d.bx(8,36,64,7,T(b,.8),1);
 d.bx(16,15,13,13,P.a,2);d.p(20,19,P.d);d.p(21,18,P.d);d.p(23,18,P.d);d.p(24,19,P.d);d.p(20,20,P.d);d.p(21,21,P.d);d.p(22,22,P.d);d.p(23,21,P.d);d.p(24,20,P.d);d.p(22,20,P.d)});
def('armchair',44,44,22,44,1,(d,p)=>{const P=PALS[p]||PALS.yellow,b=P.b;
 d.r(5,40,3,4,'#8a5a36');d.r(36,40,3,4,'#8a5a36');
 d.bx(6,2,32,30,b,3);for(const[x,y]of[[16,10],[28,10],[22,16],[16,22],[28,22],[22,28]]){d.p(x,y,T(b,.66));d.p(x,y-1,T(b,1.3))}
 d.bx(0,16,11,26,T(b,.92),3);d.bx(33,16,11,26,T(b,.88),3);d.se(5,17,5,4,b);d.se(38,17,5,4,T(b,.96));
 d.bx(9,26,26,12,T(b,1.08),2);d.r(10,35,24,1,T(b,.82));d.bx(6,36,32,6,T(b,.78),1);
 d.bx(26,14,9,9,P.a,2);d.p(29,17,P.d);d.p(30,18,P.d);d.p(31,17,P.d)});

// ================= bookshelf =================
def('bookshelf',42,70,21,70,1,d=>{d.bx(0,0,42,68,'#a4703e',1);d.r(3,3,36,62,'#5e3a22');d.r(3,3,36,2,'#4a2c18');d.r(3,3,2,62,'#4a2c18');
 d.r(2,66,6,4,'#7a5030');d.r(34,66,6,4,'#7a5030');
 const cols=['#d9544e','#4f8fd8','#f2c14a','#5fb86a','#a56ad6','#f08aa8','#3fb5b0','#e8e0cc','#ef8a3a'],r=rng(11);
 for(let s=0;s<4;s++){const y0=4+s*16,yb=y0+14;d.r(3,yb,36,2,'#c8925a');d.r(3,yb,36,1,'#e8b278');
  let x=5;while(x<36){if(s==0&&x>=24&&x<35){x=35;break}const w=2+Math.floor(r()*3),h=8+Math.floor(r()*6),c=cols[Math.floor(r()*cols.length)];
   if(s==1&&x>=24&&x<35){x=35;break}
   d.r(x,yb-h,w,h,c);d.r(x,yb-h,1,h,T(c,1.25));d.r(x+w-1,yb-h,1,h,T(c,.75));d.r(x,yb-h+2,w,1,T(c,.8));x+=w;if(r()<.12)x+=2}}
 // top shelf: plant, 2nd shelf: trophy + frame
 d.r(26,13,8,4,'#d98a5a');d.leaf(30,13,5,-1.9,2,'#4fae6a');d.leaf(30,13,5,-1.2,2,'#5fc27a');d.leaf(30,13,4,-1.55,2,'#3f9a5a');
 d.r(27,25,6,1,'#f2c14a');d.r(29,22,2,3,'#f2c14a');d.e(30,20,3,2,'#ffe27a');d.p(28,19,'#fff6b0');
 d.r(25,36,10,8,'#fff3dc');d.r(26,37,8,6,'#9bd0f0');d.p(30,40,'#e8a860');d.p(29,39,'#e8a860');d.p(31,39,'#e8a860')});

// ================= plants =================
function lf(d,cx,cy,rx,ry,c,notch){d.e(cx,cy,rx,ry,T(c,.72));d.e(cx,cy-1,rx-1,ry-1,c);d.e(cx-1,cy-2,Math.max(1,rx-3),Math.max(1,ry-3),T(c,1.18));
 d.ln(cx-rx+2,cy+1,cx+rx-2,cy-1,T(c,.7));if(notch){d.clr(cx-rx+1,cy,3,1);d.clr(cx+rx-3,cy+1,3,1);d.clr(cx-2,cy+ry-1,2,2);d.clr(cx+1,cy-ry+1,2,1)}}
def('plantBig',44,64,22,64,2,(d,p,f)=>{const s=f?1:0,L=[[9,34,8,6,'#2f8a4e'],[35,32,8,6,'#2f8a4e'],[22,12,9,7,'#3c9c5a'],[11,18,8,6,'#46ac66'],[33,17,8,6,'#46ac66'],[22,28,9,7,'#58c07a'],[15,40,6,5,'#3c9c5a'],[30,40,6,5,'#3c9c5a']];
 for(const[x,y,rx,ry,c]of L)d.ln(22,46,x+(s&&y<30?1:0),y+ry-1,'#2a6a40');
 for(const[x,y,rx,ry,c]of L)lf(d,x+(s&&y<30?1:0),y,rx,ry,c,1);
 d.bx(11,46,22,5,'#e8a070',1);d.bx(13,50,18,12,'#d98a5a',1);d.r(14,54,16,1,'#c07040');d.r(12,62,20,2,'#a86a40');d.r(14,47,16,1,'#6a4a30')});
def('plantSmall',24,32,12,32,2,(d,p,f)=>{const s=f?1:0;for(const[x,y,rx,ry,c]of[[6,17,5,4,'#46ac66'],[18,17,5,4,'#46ac66'],[12,9,6,5,'#58c07a'],[12,18,5,4,'#3c9c5a']]){d.ln(12,24,x,y+2,'#2a6a40');lf(d,x+(s&&y<14?1:0),y,rx,ry,c,0)}
 d.bx(5,23,14,3,'#fff',1);d.bx(6,26,12,6,'#f2e4d4',1);d.p(9,29,'#4a3028');d.p(14,29,'#4a3028');d.r(11,30,2,1,'#e8788a')});
def('cactus',18,30,9,30,1,d=>{d.bx(6,6,7,16,'#4fae6a',3);d.bx(1,10,4,3,'#4fae6a',0);d.bx(1,6,3,8,'#4fae6a',2);d.bx(14,12,3,3,'#4fae6a',0);d.bx(14,8,4,9,'#4fae6a',2);
 for(const[x,y]of[[8,9],[11,12],[8,15],[10,18],[2,8],[16,11]])d.p(x,y,'#e8f8c8');d.se(9,5,2,2,'#ff7ca6');d.p(9,4,'#ffe27a');
 d.bx(4,22,11,8,'#e08a56',1);d.r(5,24,9,1,'#b86a3a');d.r(3,22,13,2,'#f0a070')});

// ================= lamp / table / tv / aquarium / fireplace =================
def('lamp',20,66,10,66,1,d=>{d.e(10,63,7,2,'#4a3a30');d.e(10,62,6,2,'#6a5a4a');d.r(9,22,2,40,'#b89a6a');d.r(9,22,1,40,'#e8cc8e');d.r(10,22,1,40,'#8a6a3a');
 for(let y=4;y<=20;y++){const hw=Math.round(5+(y-4)*.45),x0=10-hw;d.r(x0,y,hw*2,1,'#fff0c4');d.r(x0,y,2,1,'#fffbe8');d.r(10+hw-3,y,3,1,'#f0d594')}
 d.r(4,20,12,1,'#d8b878');d.r(5,3,10,1,'#d8b878');d.r(9,1,2,3,'#b89a6a');d.r(7,12,6,1,'#ffe9a8')});
def('sideTable',36,36,18,36,1,d=>{d.r(5,15,2,20,'#8a5a36');d.r(29,15,2,20,'#8a5a36');d.r(6,31,24,2,'#a86e44');d.r(6,31,24,1,'#c8905a');
 d.e(18,12,16,4,'#8a5a36');d.e(18,11,16,4,'#c88e58');d.e(18,10,14,3,'#e0a870');d.r(8,15,20,2,'#a86e44');d.r(6,34,3,2,'#6a4426');d.r(27,34,3,2,'#6a4426');
 d.bx(23,4,6,8,'#5fb8d8',1);d.r(24,3,4,1,'#8ad0e8');d.r(25,0,1,4,'#4fae6a');d.p(24,0,'#ff8aa8');d.p(26,-0,'#ff8aa8');d.p(27,1,'#ffd27a');d.leaf(26,4,3,-2.3,1,'#58bc74');
 d.bx(7,6,10,3,'#d9544e',0);d.bx(8,4,9,2,'#f2c14a',0)});
const TVF=[
 s=>{const c=['#f4f4f4','#f4e24a','#4ad4e8','#5ad45a','#e04ad4','#e84a4a','#4a5ae8'];c.forEach((k,i)=>s.r(i*6,0,6,18,k));for(let i=0;i<7;i++)s.r(i*6,18,6,3,i%2?'#222':c[6-i]);s.r(0,21,42,5,'#1a1f3a');s.r(4,23,10,1,'#fff');s.r(30,22,8,3,'#f4e24a')},
 s=>{const r=rng(Date.now()>>8&255);for(let y=0;y<26;y++)for(let x=0;x<42;x++)s.p(x,y,r()<.5?(r()<.5?'#e8e8e8':'#8a8a90'):'#303038')},
 s=>{s.r(0,0,42,26,'#8ad4f8');s.r(0,19,42,7,'#6cc86c');s.e(34,6,4,4,'#ffe46b');s.e(10,6,6,2,'#fff');s.e(15,7,5,2,'#fff');s.se(19,18,5,4,'#e8a860');s.se(25,15,4,4,'#f0b878');s.se(22,11,0,0,'#f0b878');s.p(26,14,'#222');s.r(28,16,3,1,'#222');s.r(15,21,2,4,'#d89050');s.r(22,21,2,4,'#d89050');s.p(23,12,'#d8904a');s.p(28,12,'#d8904a');s.r(0,0,42,1,'rgba(0,0,0,.2)')},
 s=>{s.r(0,0,42,26,'#2a1a4a');for(const[x,y]of[[4,3],[12,6],[20,2],[30,7],[36,3],[8,12]])s.p(x,y,'#fff');s.e(32,8,5,5,'#fff3b0');s.e(34,7,4,4,'#2a1a4a');s.r(0,20,42,6,'#1a1a32');s.r(8,15,8,5,'#12122a');s.r(20,16,6,4,'#12122a');s.r(28,14,7,6,'#12122a');s.p(10,17,'#ffe46b');s.p(23,18,'#ffe46b');s.p(31,16,'#ffe46b')}];
def('tv',58,52,29,52,4,(d,p,f)=>{d.bx(2,36,54,14,'#8a5a3a',1);d.r(4,40,24,8,'#a0703f');d.r(30,40,24,8,'#a0703f');d.r(4,40,24,1,'#c89050');d.r(30,40,24,1,'#c89050');d.r(14,43,4,2,'#f2d08a');d.r(40,43,4,2,'#f2d08a');d.r(4,50,5,2,'#5a3a22');d.r(49,50,5,2,'#5a3a22');
 d.r(25,33,8,3,'#2a2a30');d.bx(6,4,46,30,'#2a3038',2);d.r(7,5,44,28,'#10141a');TVF[f%4]({r:(x,y,w,h,c)=>d.r(8+x,6+y,w,h,c),p:(x,y,c)=>d.p(8+x,6+y,c),e:(a,b,c,e,k)=>d.e(8+a,6+b,c,e,k),se:(a,b,c,e,k)=>d.se(8+a,6+b,c,e,k)});
 d.r(10,7,12,1,'rgba(255,255,255,.35)');d.r(10,8,1,5,'rgba(255,255,255,.3)');d.p(48,32,'#5aff7a')},{ol:.5});
def('aquarium',62,50,31,50,2,(d,p,f)=>{d.bx(2,36,58,13,'#7a5a42',1);d.r(5,39,24,8,'#946e50');d.r(32,39,25,8,'#946e50');d.r(15,42,4,2,'#f2d08a');d.r(42,42,4,2,'#f2d08a');d.r(4,48,5,2,'#4a3022');d.r(53,48,5,2,'#4a3022');
 d.r(3,4,56,32,'#2c3a46');d.r(5,8,52,26,'#3ec0e8');for(let y=8;y<34;y++){const t=(y-8)/26;d.r(5,y,52,1,t<.3?'#7ad8f4':t<.65?'#4ac8ec':'#2e9ac8')}
 d.r(5,29,52,5,'#dcc48e');const r=rng(5);for(let i=0;i<20;i++)d.p(6+Math.floor(r()*50),29+Math.floor(r()*5),['#a89060','#fff0c8','#e8a0a0','#90a8d8'][i%4]);
 for(const x of[8,11,48,52]){for(let y=0;y<12;y++)d.p(x+Math.round(Math.sin(y*.7+f*1.2+x)*1.2),28-y,y%3?'#3a9a58':'#58c077')}
 d.bx(26,22,10,8,'#c8a0b8',1);d.e(31,22,4,3,'#c8a0b8');d.r(29,25,4,5,'#3a2a3a');d.r(30,20,2,2,'#e8c8d8');
 const fx=(t,y,c,dir)=>{const x=5+((t)%46);d.se(x+3,y,3,2,c);d.r(dir?x-1:x+6,y-1,2,3,T(c,.9));d.p(x+(dir?4:2),y-1,'#222')};
 fx(f*6+6,14,'#ff8a3a',1);fx(f*5+26,20,'#ffd24a',1);fx(46-f*7,16,'#ff6a8a',0);
 for(let i=0;i<4;i++)d.p(40+(i%2)*2-(f?1:0),26-i*5-(f?2:0),'#e8fbff');
 d.r(3,4,56,2,'#1a2a36');d.r(3,34,56,2,'#1a2a36');d.r(3,4,2,32,'#1a2a36');d.r(57,4,2,32,'#1a2a36');d.r(4,0,54,5,'#46525e');d.r(6,1,50,2,'#fff6c8');d.r(6,1,50,1,'#fff');
 d.r(8,8,1,12,'rgba(255,255,255,.55)');d.r(10,8,1,5,'rgba(255,255,255,.35)')},{ol:.5});
function flame(d,f){const cols=['#d8321a','#ff7a22','#ffc83a','#fff2a8'];
 const H=[[11,17,22,16,10],[13,21,17,19,12],[10,16,24,14,13],[14,19,19,22,9]][f%4];
 for(let i=0;i<5;i++){const cx=36+(i-2)*7+((f+i)%2?1:0),h=H[i];for(let y=0;y<h;y++){const t=y/h,hw=Math.round((1-t*t)*4.2+.3);d.r(cx-hw,54-y,hw*2+1,1,t<.2?cols[0]:t<.5?cols[1]:t<.78?cols[2]:cols[3])}}
 for(let i=0;i<3;i++)d.p(30+i*6+((f*3+i)%5),30+((f*5+i*4)%8),'#ffd24a')}
def('fireplace',72,66,36,66,4,(d,p,f)=>{d.bx(0,14,72,52,'#a8584a',0);
 for(let y=15;y<64;y+=4){d.r(1,y+3,70,1,'#d8c4b0');const o=(y/4|0)%2?0:5;for(let x=o;x<72;x+=10)d.r(x,y,1,4,'#d8c4b0')}
 d.r(0,14,72,2,'#c06a5a');d.r(70,14,2,52,'#7a3a32');
 d.bx(-0,6,72,9,'#8a5a3a',0);d.r(0,6,72,1,'#c89058');d.r(0,14,72,1,'#5a3a22');d.r(2,3,68,3,'#a0703f');d.r(2,3,68,1,'#d8a468');
 d.r(14,28,44,38,'#18100e');d.e(36,28,22,8,'#18100e');d.r(14,28,1,38,'#5a3a30');d.r(58,28,1,38,'#3a2220');
 d.r(14,20,44,2,'#6a4a3a');
 d.r(18,36,36,30,'#241614');flame(d,f);d.bx(20,56,32,5,'#6a4426',1);d.bx(24,53,26,4,'#7a5030',1);d.r(22,57,28,1,'#ff7a2a');d.r(20,59,32,1,'#e8421a');
 d.r(10,62,52,4,'#7a6a62');d.r(10,62,52,1,'#a89890');
 d.r(8,-2,3,8,'#fff3dc');d.p(9,-4,'#ffd24a');d.p(9,-3,'#ff8a22');d.r(60,-2,3,8,'#fff3dc');d.p(61,-4,'#ffd24a');d.p(61,-3,'#ff8a22');
 d.bx(26,-6,18,12,'#fff3dc',1);d.r(28,-4,14,8,'#9bd0f0');d.p(35,0,'#e8a860')},{ol:.45,top:8});

// ================= rugs (flat, no outline) =================
def('rugRound',116,36,58,18,1,(d,p)=>{const P=PALS[p]||PALS.blue,b=P.b;d.e(58,18,57,17,T(b,.66));d.e(58,17,56,16,T(b,.9));d.e(58,17,52,14,b);d.e(58,17,46,12,P.a);d.e(58,17,44,11,T(b,1.1));d.e(58,17,34,8,b);d.e(58,17,32,7,T(b,.92));
 for(let i=0;i<48;i++){const a=i/48*Math.PI*2;d.p(Math.round(58+Math.cos(a)*49),Math.round(17+Math.sin(a)*13),P.a)}
 for(let i=0;i<8;i++){const a=i/8*Math.PI*2+.4;d.e(Math.round(58+Math.cos(a)*22),Math.round(17+Math.sin(a)*5),2,1,P.a);d.p(Math.round(58+Math.cos(a)*22),Math.round(17+Math.sin(a)*5),T(b,.7))}
 d.e(58,17,6,2,P.a);d.e(58,17,3,1,T(b,.7));d.r(8,10,16,1,T(b,1.3));d.r(14,8,12,1,T(b,1.3))},{ol:0,rug:1});
def('rugRect',104,34,52,17,1,(d,p)=>{const P=PALS[p]||PALS.green,b=P.b;
 for(let y=0;y<34;y++){const l=Math.round(8*(1-y/33)),w=104-2*l;d.r(l,y,w,1,T(b,.7));if(y>0&&y<33)d.r(l+2,y,w-4,1,(y>>2)%2?b:P.a);}
 for(let y=3;y<31;y++){const l=Math.round(8*(1-y/33)),w=104-2*l;d.r(l+3,y,w-6,1,(y>>2)%2?T(b,1.1):T(P.a,.98))}
 for(let y=7;y<27;y++){const l=Math.round(8*(1-y/33));d.r(l+6,y,1,1,'rgba(255,255,255,.25)')}
 for(let x=2;x<102;x+=3){d.r(x,34,1,1,P.a);d.r(Math.round(x*.84+8),0,1,0,P.a)}d.r(8,1,88,1,'rgba(255,255,255,.35)')},{ol:0,rug:1});

// ================= wall decor =================
def('frameDog',30,36,15,18,1,d=>{d.bx(0,0,30,36,'#8a5a36',0);d.r(2,2,26,32,'#6a4426');d.r(3,3,24,30,'#f8f0e0');d.r(6,6,18,24,'#a4d8f4');d.r(6,22,18,8,'#7acb78');d.e(21,10,3,3,'#ffe46b');
 d.se(15,19,6,6,'#e8a860');d.se(10,13,2,3,'#d8904a');d.se(20,13,2,3,'#d8904a');d.e(15,22,3,2,'#fff3e0');d.p(15,21,'#2a1a18');d.p(12,18,'#2a1a18');d.p(18,18,'#2a1a18');d.p(15,24,'#ff8aa0');d.r(8,26,14,4,'#d8904a');d.r(13,26,4,4,'#fff3e0')},{ol:.4});
def('frameSun',28,34,14,17,1,d=>{d.bx(0,0,28,34,'#fbf6ee',0);d.r(2,2,24,30,'#e8e0d4');d.r(3,3,22,28,'#bfe3ff');d.r(3,24,22,7,'#8fd18a');d.r(13,16,2,12,'#3f9a5a');d.leaf(13,23,5,-.3,2,'#58bc74');d.leaf(14,22,5,Math.PI+.3,2,'#58bc74');
 for(let i=0;i<10;i++){const a=i/10*Math.PI*2;d.e(Math.round(14+Math.cos(a)*5),Math.round(13+Math.sin(a)*5),2,2,'#ffd22e')}d.se(14,13,3,3,'#7a4a24');d.p(13,12,'#a8723f')},{ol:.4});
def('framePaw',30,30,15,15,1,d=>{d.bx(0,0,30,30,'#f4a0b8',0);d.r(2,2,26,26,'#d8809a');d.r(3,3,24,24,'#fff3e6');d.se(15,19,6,5,'#b8785a');
 for(const[x,y]of[[8,12],[12,8],[18,8],[22,12]])d.se(x,y,2,3,'#b8785a');d.p(13,17,'#d8a888');d.p(14,16,'#d8a888')},{ol:.4});
def('clock',28,28,14,14,1,(d,mm)=>{mm=(+mm||0);const m=mm%60,h=(mm/60|0)%12;d.e(14,14,13,13,'#6a4426');d.e(14,14,12,12,'#a0703f');d.e(14,14,10,10,'#fbf3e0');d.e(14,14,10,10,'#fbf3e0');
 for(let i=0;i<12;i++){const a=i/12*Math.PI*2;d.p(Math.round(14+Math.sin(a)*8.5),Math.round(14-Math.cos(a)*8.5),'#6a4a3a')}
 const ha=(h+m/60)/12*Math.PI*2,ma=m/60*Math.PI*2;d.ln(14,14,Math.round(14+Math.sin(ha)*5),Math.round(14-Math.cos(ha)*5),'#3a2a24');d.ln(14,14,Math.round(14+Math.sin(ma)*8),Math.round(14-Math.cos(ma)*8),'#6a4a3a');d.p(14,14,'#d94a4a');d.p(8,6,'#fff');d.p(7,7,'#fff')},{ol:.4,dyn:1});
def('shelf',42,22,21,22,1,d=>{d.bx(0,16,42,4,'#b07a44',0);d.r(0,16,42,1,'#d8a468');d.r(5,20,3,2,'#7a5030');d.r(34,20,3,2,'#7a5030');
 d.bx(4,8,8,8,'#f2e4d4',1);d.leaf(8,8,6,-2.2,2,'#58bc74');d.leaf(8,8,6,-.9,2,'#58bc74');d.leaf(8,8,7,-1.57,2,'#4aae68');
 d.se(21,12,4,3,'#e8b878');d.se(24,8,2,3,'#d8a060');d.p(25,7,'#2a1a18');d.r(17,14,3,2,'#d8a060');
 d.bx(30,10,6,6,'#f8f0e4',1);d.p(33,9,'#ffd24a');d.p(33,8,'#ff8a22');d.r(37,6,2,10,'#4f8fd8');d.r(39,8,2,8,'#d9544e')},{ol:.42});
def('bunting',130,20,65,0,1,d=>{const cols=['#ff8aa8','#ffd24a','#6cc8f0','#7ad47a','#c58bff'],at=x=>2+Math.round(8*(1-Math.pow(2*x/129-1,2)));
 for(let x=0;x<130;x++)d.p(x,at(x)-1,'#7a5a4a');let i=0;for(let x=6;x<124;x+=12,i++){const c=cols[i%5],y0=at(x);for(let k=0;k<9;k++){const hw=Math.round(5-k*.55);d.r(x-hw,y0+k,hw*2+1,1,k<1?T(c,1.2):c);d.p(x-hw,y0+k,T(c,.8))}d.p(x,y0+9,T(c,.7))}},{ol:.4});
def('neon',48,28,24,14,2,(d,p,f)=>{const a=f?'#ff7ac0':'#ff4fa8',b=f?'#8ae8ff':'#4fd4ff'; d.r(8,9,32,2,a);d.r(8,16,32,2,a);d.r(8,9,32,1,'#fff');d.r(8,16,32,1,'#fff');
 for(const[x,y]of[[5,5],[5,13],[38,5],[38,13]]){d.e(x+3,y+3,3,3,a);d.p(x+3,y+3,'#fff')}
 d.r(12,22,24,2,b);d.r(12,22,24,1,'#fff')},{ol:.4});

// ================= seasonal =================
def('pumpkin',30,28,15,28,2,(d,p,f)=>{d.e(15,17,13,10,'#a84c10');d.se(15,16,13,9,'#f08a24');for(const x of[8,11,19,22])for(let y=9;y<24;y++)if((y+x)%1==0)d.p(Math.round(x+Math.sin((y-9)/15*Math.PI)*(x<15?-1:1)*1.2),y,'#c8601a');
 d.r(14,5,3,5,'#6a8a2a');d.r(17,4,3,2,'#7aa23a');d.leaf(20,8,5,-.5,1,'#58bc74');
 const g=f?'#fff0a0':'#ffd24a';d.map(8,12,['..a.....a..','.aaa...aaa.'],{a:g});d.r(10,12,3,1,g);d.r(17,12,3,1,g);d.p(14,15,g);d.p(15,15,g);d.p(16,15,g);
 d.map(7,19,['a.a.a.a.a.a.a','.aaaaaaaaaaa.'].map(s=>s.slice(0,13)),{a:g});d.r(10,23,9,1,T('#f08a24',.6))},{ol:.4});
def('cobweb',30,30,0,0,1,d=>{const c='#eceaf4',s='#b8b6c8';for(let i=0;i<=6;i++){const a=i/6*Math.PI/2;d.ln(0,0,Math.round(Math.cos(a)*28),Math.round(Math.sin(a)*28),c)}
 for(const R of[8,14,20,26]){let px=R,py=0;for(let i=1;i<=6;i++){const a=i/6*Math.PI/2,x=Math.round(Math.cos(a)*R*.88),y=Math.round(Math.sin(a)*R*.88);d.ln(px,py,x,y,s);px=x;py=y}}
 d.ln(16,16,16,24,'#888');d.se(16,26,2,2,'#2a2a30');d.p(14,24,'#2a2a30');d.p(18,24,'#2a2a30');d.p(14,28,'#2a2a30');d.p(18,28,'#2a2a30');d.p(15,26,'#ff4a4a');d.p(17,26,'#ff4a4a')},{ol:0});
def('xtree',52,80,26,80,2,(d,p,f)=>{d.bx(16,70,20,10,'#b8423a',1);d.r(16,70,20,2,'#e8665a');d.r(23,74,6,6,'#7a2a26');d.r(24,60,4,10,'#6a4426');
 const tier=(y0,y1,hw0,hw1)=>{for(let y=y0;y<=y1;y++){const t=(y-y0)/(y1-y0),hw=Math.round(hw0+(hw1-hw0)*t)+((y&1)?0:1);d.r(26-hw,y,hw*2+1,1,'#2a8a46');d.r(26-hw,y,Math.max(2,hw*.5|0),1,'#46b062');d.r(26+hw-Math.max(2,hw*.5|0),y,Math.max(2,hw*.5|0),1,'#1f6a38')}
  d.r(26-hw1-1,y1,hw1*2+3,1,'#1a5a30')};
 tier(8,28,2,13);tier(22,46,5,18);tier(40,66,8,23);
 for(let i=0;i<11;i++){const t=i/10;d.p(Math.round(10+t*30),Math.round(20+Math.sin(t*6)*4+t*30),'#fff')}
 const O=[[22,18,'#e8423a'],[30,26,'#ffd24a'],[20,34,'#4f8fd8'],[34,38,'#e8423a'],[14,48,'#ffd24a'],[28,50,'#c58bff'],[40,56,'#e8423a'],[18,60,'#4f8fd8'],[32,63,'#ffd24a'],[10,64,'#e8423a'],[24,40,'#ffd24a'],[44,64,'#4f8fd8']];
 for(const[x,y,c]of O){d.se(x,y,2,2,c)}
 for(let i=0;i<16;i++){const x=[22,26,30,18,34,14,38,20,32,16,36,12,40,24,28,8][i],y=[14,22,20,30,32,40,44,50,52,58,58,62,64,66,68,66][i];d.p(x,y,(i+f)%2?'#fff6a0':['#ff6a6a','#6ad4ff','#7aff8a'][i%3])}
 d.map(21,0,['....a....','....a....','...aaa...','aaaaaaaaa','.aaaaaaa.','..aaaaa..','..aa.aa..','.aa...aa.'],{a:'#ffd24a'});d.p(26,3,'#fff6b0');
 d.bx(2,70,12,10,'#4f8fd8',0);d.r(7,70,2,10,'#ffd24a');d.r(2,74,12,2,'#ffd24a');d.bx(38,72,10,8,'#c58bff',0);d.r(42,72,2,8,'#fff');d.r(38,75,10,1,'#fff')},{ol:.4});
def('stocking',18,26,9,13,1,d=>{d.bx(3,0,12,6,'#fff',1);d.r(3,5,12,1,'#d8e0ec');d.bx(4,6,10,12,'#d9423a',0);d.bx(4,15,12,8,'#d9423a',1);d.bx(12,18,5,6,'#d9423a',1);d.r(5,9,8,1,'#2a8a46');d.r(5,12,8,1,'#2a8a46');d.p(6,6,'#f2685e');d.r(14,22,3,2,'#fff');d.p(8,-1,'#ffd24a');d.p(9,-1,'#ffd24a')},{ol:.4});

// ================= cache / api =================
const CACHE={};
function sprite(type,pal,f=0){const key=type+'|'+(pal||'')+'|'+f,hit=CACHE[key];if(hit)return hit;
 const dr=type,m=META[dr];if(!m)return null;
 const cv=document.createElement('canvas');cv.width=m.w;cv.height=m.h;const c=cv.getContext('2d');DRAW[dr](D(c,1,1+(m.top||0)),pal,f);if(m.ol)outline(cv,m.ol);
 return CACHE[key]={cv,w:m.w,h:m.h,ax:m.ax,ay:m.ay,fr:m.fr,dyn:m.dyn,rug:m.rug}}
g.ITEMART={sprite,META,PALS,T,D,outline};
})(typeof window!=='undefined'?window:globalThis);
