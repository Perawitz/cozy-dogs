// Cozy Dogs - pixel-art park scenery: sky, hills, grass, path, pond, trees, benches, lamps, treats, ball, weather. Everything procedural.
(function(g){
'use strict';
const IA=g.ITEMART,T=IA.T,Dr=IA.D,OUT=IA.outline;
const NW=400,NH=300,HZ=112;
const hash=(x,y,s=0)=>{let h=(Math.imul(x|0,374761393)+Math.imul(y|0,668265263)+Math.imul(s|0,1442695041))>>>0;h=Math.imul(h^(h>>>13),1274126177)>>>0;return((h^(h>>>16))>>>0)/4294967296};
const cvs=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c};
const lerp=(a,b,t)=>a+(b-a)*t,cl=(v,a,b)=>Math.max(a,Math.min(b,v));
const hx=h=>{h=h.replace('#','');return[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]};
const mix=(a,b,t)=>{const A=hx(a),B=hx(b);return'#'+A.map((v,i)=>Math.round(lerp(v,B[i],t)).toString(16).padStart(2,'0')).join('')};
const POND={x:610,y:430,rx:80,ry:30};                     // world coords (shared with the server's "no treats here" box)
const PROPS=[{k:'tree',x:56,y:262,v:0},{k:'tree',x:232,y:250,v:1},{k:'tree',x:520,y:244,v:2},{k:'tree',x:748,y:258,v:0},{k:'tree',x:26,y:520,v:1},{k:'tree',x:778,y:536,v:2},
 {k:'bench',x:196,y:322},{k:'bench',x:480,y:318},{k:'lamp',x:116,y:304},{k:'lamp',x:402,y:292},{k:'lamp',x:704,y:304},
 {k:'bush',x:306,y:244},{k:'bush',x:628,y:240},{k:'bush',x:14,y:336},{k:'bush',x:788,y:410},{k:'rock',x:670,y:506},{k:'rock',x:84,y:424},{k:'flowers',x:360,y:560},{k:'flowers',x:150,y:548}];
const LAMPS=PROPS.filter(p=>p.k=='lamp');

// ------------------------------------------------------------- palettes
function pal(season,weather){const winter=season=='winter',snow=winter||weather=='snow';
 return{winter,snow,autumn:season=='autumn',spring:season=='spring',
  g:snow?['#f4f9fc','#e4eef6','#d3e1ed']:season=='autumn'?['#a6c45e','#94b552','#86a748']:['#8ad475','#74c460','#5fb44f'],
  leaf:season=='autumn'?['#a8381a','#d0601e','#ec9030','#f8c458']:['#2c8244','#46a24c','#6cc464','#9ce284'],
  hill:snow?['#dfe9f2','#c8d7e6']:season=='autumn'?['#b5b080','#9aa56a']:['#a8cfb4','#86bb92']}}

// ------------------------------------------------------------- sprite cache
const SC=new Map();
function spr(key,w,h,ax,ay,fn){let s=SC.get(key);if(s)return s;const cv=cvs(w+2,h+2),c=cv.getContext('2d');fn(Dr(c,1,1),c);OUT(cv,.42);s={cv,w:w+2,h:h+2,ax:ax+1,ay:ay+1};SC.set(key,s);return s}
function put(c,s,x,y,o={}){const w=s.w*2,h=s.h*2;c.save();c.translate(Math.round(x),Math.round(y));if(o.rot){c.rotate(o.rot)}if(o.flip)c.scale(-1,1);if(o.alpha!=null)c.globalAlpha=o.alpha;c.drawImage(s.cv,-s.ax*2,-s.ay*2,w,h);c.restore()}
function speckle(c,d,w,h,cols,seed){const im=c.getImageData(1,1,w,h).data;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){if(im[(y*w+x)*4+3]<200)continue;const r=hash(x,y,seed);
  if(r<.05){d.r(x,y,2,1,cols[3]);d.p(x+1,y+1,cols[2])}else if(r<.1){d.r(x,y,2,1,cols[0]);d.p(x,y+1,cols[0])}else if(r<.13)d.p(x,y,cols[2])}}

// ------------------------------------------------------------- props
function trunk(P,v){return spr('tk'+v+P.winter,40,62,20,60,d=>{const b=['#8a5a38','#7e5232','#946040'][v%3];
 d.r(16,18,9,42,b);d.r(16,18,2,42,T(b,1.22));d.r(23,18,2,42,T(b,.74));d.r(18,18,1,42,T(b,1.1));
 for(let y=22;y<58;y+=3){const x=17+Math.floor(hash(y,v,1)*6);d.r(x,y,1,2,T(b,.7))}
 d.r(13,54,15,4,b);d.r(12,57,17,3,T(b,.86));d.r(13,54,15,1,T(b,1.2));d.r(10,59,5,2,T(b,.7));d.r(25,59,6,2,T(b,.7));d.e(20,40,1,2,T(b,.55));
 d.ln(20,30,10,14,T(b,.92));d.ln(21,30,11,14,b);d.ln(22,28,32,10,T(b,.92));d.ln(21,28,31,10,b);d.ln(20,22,20,8,b);d.ln(21,22,21,8,T(b,.85))})}
function canopy(P,v){return spr('cn'+v+P.winter+P.autumn,64,56,32,48,(d,c)=>{const L=P.leaf;
 if(P.winter){const b='#6a4a32';const br=[[32,50,8,8],[32,50,56,10],[32,50,22,2],[32,50,44,4],[32,50,14,24],[32,50,50,24],[32,50,32,0]];
  for(const[x0,y0,x1,y1]of br){d.ln(x0,y0,x1,y1,b);d.ln(x0+1,y0,x1+1,y1,T(b,.84));for(let i=0;i<3;i++){const t=.45+i*.2,px=Math.round(lerp(x0,x1,t)),py=Math.round(lerp(y0,y1,t));d.ln(px,py,px+(i%2?8:-8),py-6,b);d.r(px+(i%2?6:-8),py-7,3,1,'#fff');d.r(px+(i%2?5:-7),py-8,2,1,'#e6f0fa')}d.r(x1-1,y1-1,4,2,'#fff');d.r(x1,y1-2,3,1,'#fff')}
  for(let i=0;i<14;i++)d.r(8+Math.floor(hash(i,v,3)*46),6+Math.floor(hash(i,v,4)*36),3,1,'#fff');return}
 const bl=[[32,36,22,13],[15,31,14,11],[49,31,14,11],[32,22,19,14],[21,13,13,9],[43,13,13,9],[32,8,11,7]];
 for(const[cx,cy,rx,ry]of bl)d.se(cx,cy,rx,ry,L[1],1.05);
 for(const[cx,cy,rx,ry]of bl.slice(0,5))d.e(cx+2,cy+ry-3,Math.max(2,rx-8),2,L[0]);
 speckle(c,d,64,56,L,v+7);
 for(let i=0;i<9;i++){const x=6+Math.floor(hash(i,v,5)*52),y=8+Math.floor(hash(i,v,6)*38);d.r(x,y,3,1,L[3]);d.r(x-1,y+1,3,1,L[2])}
 if(!P.autumn&&v!=1)for(let i=0;i<4;i++){const x=10+Math.floor(hash(i,v,8)*44),y=14+Math.floor(hash(i,v,9)*28);d.p(x,y,'#ff8aa8');d.p(x+1,y,'#ffd0dc')}})}
function bench(){return spr('bench',46,30,23,27,d=>{
 d.r(5,16,3,11,'#46465a');d.r(5,16,1,11,'#6e6e86');d.r(38,16,3,11,'#46465a');d.r(38,16,1,11,'#6e6e86');d.r(4,26,5,2,'#34343f');d.r(37,26,5,2,'#34343f');
 d.r(5,2,2,15,'#46465a');d.r(39,2,2,15,'#46465a');
 for(const y of[3,8]){d.bx(2,y,42,4,'#c88f4c',0);d.r(2,y+3,42,1,'#8a5c2c');for(let x=6;x<42;x+=9)d.p(x,y+1,'#a8743a')}
 d.bx(1,15,44,3,'#d49a54',0);d.bx(1,18,44,3,'#b87e3e',0);d.r(1,20,44,1,'#7a4c24');d.r(12,16,1,1,'#9a6428');d.r(30,19,1,1,'#7a4c24');d.r(0,14,3,5,'#46465a');d.r(43,14,3,5,'#46465a')})}
function lamp(){return spr('lamp',18,60,9,58,d=>{
 d.e(9,56,6,2,'#2e2e3a');d.bx(5,50,8,6,'#35353f',0);d.r(5,50,8,1,'#5a5a6c');d.r(8,16,3,35,'#3c3c4a');d.r(8,16,1,35,'#62627a');d.r(10,16,1,35,'#2a2a34');d.r(6,14,7,3,'#35353f');d.r(7,12,5,2,'#4a4a5c');
 d.bx(3,2,13,11,'#ffe6a0',1);d.r(4,3,11,2,'#fff6c8');d.r(9,2,1,11,'#8a7a40');d.r(3,7,13,1,'#c8a850');d.r(1,0,17,3,'#35353f');d.r(5,-1,9,2,'#4a4a5c');d.r(8,-3,3,2,'#35353f')})}
function bush(P){return spr('bush'+P.autumn+P.snow,34,20,17,18,(d,c)=>{const L=P.snow?['#4a6a52','#5e8268','#7aa07e','#9cc09a']:P.leaf;
 for(const[cx,cy,rx,ry]of[[9,13,8,6],[25,13,8,6],[17,10,10,8]])d.se(cx,cy,rx,ry,L[1],1.05);d.e(17,17,13,2,L[0]);speckle(c,d,34,20,L,3);
 if(!P.snow)for(let i=0;i<7;i++){const x=5+Math.floor(hash(i,1,2)*24),y=5+Math.floor(hash(i,2,2)*10);const col=P.autumn?'#ffb040':['#ff8aa8','#fff0a0','#ffffff'][i%3];d.p(x,y,col);d.p(x+1,y,T(col,.8))}
 else{d.r(6,3,10,2,'#fff');d.r(18,4,9,2,'#fff');d.r(10,1,12,2,'#eef5fb')}})}
function rock(P){return spr('rock'+P.snow,22,14,11,12,d=>{d.se(11,9,9,5,'#9a9aa8',1.1);d.se(6,10,5,3,'#8a8a98');d.p(8,6,'#c4c4d0');d.p(9,6,'#c4c4d0');d.r(13,8,2,1,'#74748a');if(P.snow)d.r(5,3,12,2,'#fff')})}
function flowers(P){return spr('fl'+P.snow,26,16,13,14,d=>{if(P.snow){d.r(4,10,18,3,'#fff');d.r(8,8,10,3,'#eef5fb');return}
 const cols=['#ff7a9a','#ffd84a','#ffffff','#b79bff','#ff9a4d'];for(let i=0;i<9;i++){const x=2+Math.floor(hash(i,3,3)*21),y=5+Math.floor(hash(i,4,3)*8),col=cols[i%5];d.r(x,y+2,1,4,'#3f9a46');d.p(x-1,y+4,'#58b45a');d.p(x,y+1,col);d.p(x-1,y+2,col);d.p(x+1,y+2,col);d.p(x,y+3,col);d.p(x,y+2,i%2?'#ffe8a0':'#ffb020')}})}
function duck(){return spr('duck',14,12,7,10,d=>{d.se(6,8,5,3,'#fff4c8');d.se(10,4,3,3,'#fff4c8');d.p(11,3,'#2a1a18');d.r(12,4,3,1,'#ff9a30');d.r(13,5,1,1,'#e87a20');d.r(2,6,4,2,'#e8dcae');d.r(9,2,1,1,'#fff')})}
const TREAT={
 cookie:()=>spr('t_cookie',11,11,5,9,d=>{d.se(5,5,5,5,'#e0a45e');d.p(3,3,'#6a3c1c');d.p(6,4,'#6a3c1c');d.p(4,7,'#6a3c1c');d.p(7,7,'#6a3c1c');d.p(5,2,'#f4c88a')}),
 bone:()=>spr('t_bone',14,9,7,7,d=>{d.se(2,2,2,2,'#faf4e4');d.se(2,6,2,2,'#faf4e4');d.se(11,2,2,2,'#faf4e4');d.se(11,6,2,2,'#faf4e4');d.r(3,2,8,5,'#faf4e4');d.r(3,6,8,1,'#d8ccb4');d.r(3,2,8,1,'#fff')}),
 meat:()=>spr('t_meat',13,12,6,10,d=>{d.se(5,5,5,4,'#c8584a');d.r(3,3,3,1,'#e88a78');d.r(6,4,2,1,'#8a2e28');d.r(8,8,4,2,'#f4ecd8');d.se(11,10,1,1,'#f4ecd8');d.se(12,8,1,1,'#f4ecd8')}),
 star:()=>spr('t_star',11,11,5,9,d=>{d.map(0,0,['.....b.....','....bBb....','....bBb....','..bbbcbbb..','.bBBBcBBBb.','..bBBcBBb..','...bBBBb...','..bBb.bBb..','.bB.....Bb.'],{b:'#3a9ae8',B:'#6cc6ff',c:'#e8f8ff'})})};
function ball(){return spr('ball',10,10,5,5,d=>{d.se(5,5,4,4,'#d8f25a');d.p(3,3,'#f4ffa0');d.r(2,5,1,1,'#fff');d.r(3,6,1,1,'#fff');d.r(4,7,2,1,'#fff');d.r(7,2,1,1,'#fff');d.r(8,3,1,2,'#fff')})}

// ------------------------------------------------------------- static ground layer
const LAYERS=new Map();
function layer(season,weather){const P=pal(season,weather),key=season+(P.snow?'S':'');let L=LAYERS.get(key);if(L)return L;
 const cv=cvs(NW,NH),c=cv.getContext('2d'),d=Dr(c,0,0);
 // hills: two rolling layers + a dithered tree line
 for(let x=0;x<NW;x++){const h1=30+Math.sin(x*.021+1)*11+Math.sin(x*.07)*4,h2=17+Math.sin(x*.033+4)*8+Math.sin(x*.11)*3;d.r(x,HZ-Math.round(h1),1,Math.round(h1)+1,P.hill[0]);d.r(x,HZ-Math.round(h2),1,Math.round(h2)+1,P.hill[1]);
  if(!P.winter&&hash(x,1,9)<.55){const th=Math.round(h2)+2+Math.floor(hash(x,2,9)*3);d.r(x,HZ-th,1,3,P.autumn?['#c0702a','#a8541e','#d49a38'][x%3]:['#4c9a58','#3c8a4c','#5aa862'][x%3])}}
 // ground
 for(let y=HZ;y<NH;y++){const k=(y-HZ)/(NH-HZ);d.r(0,y,NW,1,mix(P.g[0],P.g[2],Math.pow(k,.85)));if(((y-HZ)/16|0)%2)d.r(0,y,NW,1,P.snow?'rgba(170,190,215,.16)':'rgba(30,100,50,.07)')}
 for(let i=0;i<3200;i++){const x=hash(i,1,1)*NW|0,y=HZ+2+(hash(i,2,2)*(NH-HZ-2)|0),r=hash(i,3,3);
  if(P.snow){d.p(x,y,r<.45?'#ffffff':'#c4d6e8')}else{d.p(x,y,r<.5?T(P.g[1],.8):T(P.g[1],1.2));if(r<.22)d.p(x,y-1,T(P.g[1],.78))}}
 if(P.autumn)for(let i=0;i<150;i++){const x=hash(i,4,4)*NW|0,y=HZ+4+(hash(i,5,4)*(NH-HZ-4)|0);d.r(x,y,2,1,['#d0601e','#ec9030','#a8381a','#f8c458'][i%4])}
 else if(!P.snow)for(let i=0;i<90;i++){const x=6+(hash(i,6,4)*(NW-12)|0),y=HZ+8+(hash(i,7,4)*(NH-HZ-12)|0),col=['#ffffff','#ffe46a','#ff9cb8','#c4aaff'][i%4];d.p(x,y,col);d.p(x-1,y,T(col,.9));d.p(x+1,y,T(col,.9));d.p(x,y-1,T(col,.9));d.p(x,y+1,'#3f9a46')}
 // winding dirt path
 for(let y=HZ+1;y<NH;y++){const k=(y-HZ)/(NH-HZ),cx=196+Math.sin(y*.045)*(10+22*k),w=8+k*32,l=Math.round(cx-w),r=Math.round(cx+w),col=P.snow?'#ece2d2':'#e0c690';
  d.r(l,y,r-l,1,col);d.r(l-1,y,1,1,T(col,.7));d.r(l,y,2,1,T(col,.84));d.r(r-1,y,2,1,T(col,.84));d.r(r,y,1,1,T(col,.7));
  for(let i=0;i<Math.ceil(w/6);i++){if(hash(y,i,2)<.22){const px=l+3+Math.floor(hash(y,i,3)*(r-l-6));d.p(px,y,T(col,.82));if(hash(y,i,5)<.3)d.p(px+1,y,T(col,1.12))}}}
 // pond
 const px=POND.x/2,py=POND.y/2,rx=POND.rx/2,ry=POND.ry/2;
 d.e(px,py+2,rx+4,ry+3,P.snow?'#bcc8d4':'#6a4e34');d.e(px,py+1,rx+3,ry+2,P.snow?'#e8f0f8':'#86683f');d.e(px,py,rx+1,ry+1,P.snow?'#a8c0d4':'#4a96c4');
 d.e(px,py,rx,ry,P.winter?'#cfe8f6':'#58b0de');d.e(px,py-1,rx-3,ry-3,P.winter?'#e2f2fb':'#6cc2ea');d.e(px-3,py-3,rx-12,ry-8,P.winter?'#f2faff':'#86d2f2');
 for(let i=0;i<7;i++){const x=px-rx+8+Math.floor(hash(i,1,6)*(rx*2-16)),y=py-ry+4+Math.floor(hash(i,2,6)*(ry*2-8));d.r(x,y,3+i%3,1,P.winter?'#fff':'#bfeaff')}
 for(let i=0;i<22;i++){const a=hash(i,3,6)*6.28,rr=.9+hash(i,4,6)*.08;const x=Math.round(px+Math.cos(a)*(rx+2)*rr),y=Math.round(py+Math.sin(a)*(ry+1)*rr);d.p(x,y,['#7a5a3a','#6a4e34','#94704a'][i%3]);if(i%3==0)d.p(x+1,y,'#7a5a3a')}
 if(!P.snow){for(const[ox,oy]of[[-18,3],[10,-5],[22,5],[-6,-7]]){d.e(px+ox,py+oy,4,2,'#3f9a46');d.e(px+ox,py+oy-1,3,1,'#58b45a');d.clr(px+ox+1,py+oy,3,1);if(ox==10)d.p(px+ox,py+oy-1,'#ff9cc0')}
  for(let i=0;i<8;i++){const x=px-rx-1+Math.floor(hash(i,5,6)*7),y=py+2-Math.floor(hash(i,6,6)*6);d.r(x,y-5,1,7,'#4c9a52');d.r(x+1,y-4,1,5,'#3c8a46');if(i%3==0)d.r(x,y-7,1,3,'#8a6a3a')}}
 // picnic blanket + basket
 const bx=44,by=214;d.r(bx-2,by+22,52,3,'rgba(40,70,40,.25)');
 for(let y=0;y<22;y++)for(let x=0;x<48;x++){const k=((x/6|0)+(y/5|0))%2;const edge=x<1||y<1||x>46||y>20;d.p(bx+x,by+y,edge?'#a82e36':k?'#fff6ea':'#df4a52')}
 for(let x=0;x<48;x+=2)d.p(bx+x,by+22,'#a82e36');
 d.bx(bx+8,by+4,13,9,'#b8782e',0);d.r(bx+8,by+4,13,2,'#d8984a');d.r(bx+10,by+6,9,1,'#8a5420');d.r(bx+11,by+1,1,4,'#8a5420');d.r(bx+17,by+1,1,4,'#8a5420');d.r(bx+11,by,7,1,'#8a5420');d.r(bx+9,by+8,11,1,'#e8c07a');
 d.se(bx+30,by+10,3,2,'#fff');d.r(bx+28,by+10,5,1,'#e0e0f0');d.se(bx+36,by+7,2,2,'#ffe27a');d.r(bx+34,by+11,6,2,'#f4a8b8');d.p(bx+37,by+10,'#d8486a');
 // picket fence along the horizon (gap for the path)
 for(let x=3;x<NW;x+=14){if(x>168&&x<208)continue;d.bx(x,HZ-2,4,17,P.snow?'#f2ece0':'#f0e0bc',0);d.r(x,HZ-2,4,1,P.snow?'#fff':'#fff6dc');d.p(x+1,HZ-3,'#fff6dc');d.r(x+3,HZ,1,15,'rgba(90,60,30,.25)')}
 for(let x=0;x<NW;x++){if(x>166&&x<210)continue;d.r(x,HZ+3,1,2,'#e2d0a8');d.r(x,HZ+9,1,2,'#e2d0a8');d.r(x,HZ+5,1,1,'rgba(90,60,30,.22)');d.r(x,HZ+11,1,1,'rgba(90,60,30,.22)')}
 d.r(0,HZ+15,NW,3,'rgba(30,70,40,.16)');
 // path stepping stones at the entrance
 for(let i=0;i<5;i++){d.e(190+Math.round(Math.sin((NH-12-i*5)*.045)*30)+(i%2?4:-3),NH-4-i*5,5+i*0,2,'#d6c8a8')}
 L=cv;LAYERS.set(key,L);return L}

// ------------------------------------------------------------- sky (dynamic)
const SKY=[[0,'#0a0e2e','#1c2a5a'],[5,'#1c2250','#6a5a9a'],[6.4,'#7a8ad0','#ffb98a'],[8,'#5aa8f0','#ffe2b8'],[11,'#4a9ef0','#bfe6ff'],[16,'#4a9ef0','#cfeaff'],[18,'#7a8ad8','#ffb070'],[19.4,'#4a3a8a','#e8707a'],[21,'#10153a','#26306a'],[24,'#0a0e2e','#1c2a5a']];
function skyCols(h){for(let i=0;i<SKY.length-1;i++){const a=SKY[i],b=SKY[i+1];if(h>=a[0]&&h<=b[0]){const t=(h-a[0])/(b[0]-a[0]);return[mix(a[1],b[1],t),mix(a[2],b[2],t)]}}return[SKY[0][1],SKY[0][2]]}
const clouds=[0,1,2,3,4].map(i=>({x:i*190+30,y:30+hash(i,1,1)*110,s:.6+hash(i,2,1)*.7,sp:5+hash(i,3,1)*7}));
function cloudSpr(k){return spr('cloud'+k,56,22,28,20,d=>{const base=k?'#9aa4b4':'#ffffff';for(const[cx,cy,rx,ry]of[[14,14,12,6],[28,10,14,8],[42,14,12,6],[28,16,22,5]])d.se(cx,cy,rx,ry,base,1.05);d.r(8,19,40,1,T(base,.82))})}
function sky(c,t,e){const[top,bot]=skyCols(e.hour);const gr=c.createLinearGradient(0,0,0,240);gr.addColorStop(0,top);gr.addColorStop(1,bot);c.fillStyle=gr;c.fillRect(0,0,800,240);
 const night=e.hour<5.6||e.hour>20.6,hz=e.hour;
 if(night||hz<6.4||hz>19.4){const a=night?1:hz<6.4?cl((6.4-hz)/1.4,0,1):cl((hz-19.4)/1.2,0,1);c.fillStyle='#fff';for(let i=0;i<70;i++){const x=hash(i,1,5)*800,y=hash(i,2,5)*170,tw=.4+.6*Math.abs(Math.sin(t*(.6+hash(i,3,5)*1.4)+i));c.globalAlpha=a*tw*(e.weather=='sunny'||e.weather=='snow'?1:.35);const s=i%9==0?4:2;c.fillRect(Math.round(x),Math.round(y),s,s)}c.globalAlpha=1}
 if(hz>=5.6&&hz<=20.2){const u=(hz-5.6)/14.6,x=60+u*680,y=200-Math.sin(u*Math.PI)*170,col=hz<7.5||hz>18.2?'#ff9a52':'#fff2a0';
  c.save();const gl=c.createRadialGradient(x,y,6,x,y,70);gl.addColorStop(0,col+'aa');gl.addColorStop(1,col+'00');c.fillStyle=gl;c.fillRect(x-70,y-70,140,140);c.fillStyle=T(col,.8);c.beginPath();c.arc(x,y,22,0,7);c.fill();c.fillStyle=col;c.beginPath();c.arc(x,y,19,0,7);c.fill();c.fillStyle='#fffbe0';c.beginPath();c.arc(x-5,y-5,9,0,7);c.fill();c.restore()}
 if(hz<6.2||hz>19.6){const u=((hz+(hz<12?24:0))-19.6)/10.8,x=80+cl(u,0,1)*640,y=170-Math.sin(cl(u,0,1)*Math.PI)*130;c.save();c.fillStyle='#f4f0d8';c.beginPath();c.arc(x,y,17,0,7);c.fill();c.fillStyle=skyCols(0)[0];c.beginPath();c.arc(x+8,y-4,15,0,7);c.fill();c.fillStyle='#fffbe8';c.globalAlpha=.25;c.beginPath();c.arc(x,y,28,0,7);c.fill();c.restore()}
 const k=e.weather=='rain'?1:0,n=e.weather=='sunny'?3:5,dark=e.weather=='rain'||e.weather=='cloudy';
 for(let i=0;i<n;i++){const cd=clouds[i];cd.x+=cd.sp*.016;if(cd.x>880)cd.x=-120;c.globalAlpha=dark?.95:(night?.45:.9);put(c,cloudSpr(dark?1:0),cd.x,cd.y+cloudSpr(0).ay*0,{});c.globalAlpha=1}}

// ------------------------------------------------------------- pond (dynamic)
const ducks=[{a:0,sp:.22,r:1},{a:3,sp:-.17,r:.7}];
function pondLive(c,t,e,P){const{x,y,rx,ry}=POND;
 c.save();c.beginPath();c.ellipse(x,y,rx,ry,0,0,7);c.clip();
 for(let i=0;i<9;i++){const px=x-rx+((i*47+t*(8+i))%(rx*2)),py=y-ry+6+((i*23)%(ry*2-12)),w=10+(i%3)*6;c.fillStyle=P.winter?'rgba(255,255,255,.7)':'rgba(255,255,255,'+(.25+.25*Math.sin(t*2+i))+')';c.fillRect(Math.round(px/2)*2,Math.round(py/2)*2,w,2)}
 c.restore();
 if(P.winter)return;
 for(const dk of ducks){dk.a+=dk.sp*.016;const dx=x+Math.cos(dk.a)*(rx-26)*dk.r,dy=y+Math.sin(dk.a)*(ry-10)*dk.r,rr=(Math.sin(t*3+dk.a*5)+1)/2;
  c.strokeStyle='rgba(255,255,255,'+(.5-rr*.35)+')';c.lineWidth=2;c.beginPath();c.ellipse(dx,dy+8,14+rr*8,4+rr*3,0,0,7);c.stroke();put(c,duck(),dx,dy+Math.sin(t*4+dk.a)*1.5,{flip:Math.sin(dk.a)*dk.sp<0})}}
const inPond=(x,y)=>((x-POND.x)/(POND.rx-6))**2+((y-POND.y)/(POND.ry-4))**2<1;

// ------------------------------------------------------------- weather / ambience particles
const P_={rain:[],snow:[],leaf:[],fly:[],but:[]};
function initP(){for(let i=0;i<110;i++)P_.rain.push({x:Math.random()*840,y:Math.random()*600,v:620+Math.random()*260});
 for(let i=0;i<90;i++)P_.snow.push({x:Math.random()*800,y:Math.random()*600,v:30+Math.random()*50,p:Math.random()*6,s:2+Math.random()*3});
 for(let i=0;i<16;i++)P_.leaf.push({x:Math.random()*800,y:Math.random()*600,v:26+Math.random()*30,p:Math.random()*6,c:['#d0601e','#ec9030','#a8381a','#f8c458'][i%4],r:Math.random()*6});
 for(let i=0;i<16;i++)P_.fly.push({x:60+Math.random()*680,y:300+Math.random()*260,p:Math.random()*20,s:.6+Math.random()});
 for(let i=0;i<3;i++)P_.but.push({x:200+Math.random()*400,y:330+Math.random()*180,p:Math.random()*20,c:['#ff9ad0','#ffe05a','#9ad0ff'][i]})}
initP();
function weatherFx(c,t,dt,e,P){
 if(e.weather=='rain'){c.strokeStyle='rgba(190,215,255,.55)';c.lineWidth=2;c.beginPath();for(const r of P_.rain){r.y+=r.v*dt;r.x-=r.v*dt*.18;if(r.y>600){r.y=-20;r.x=Math.random()*860}if(r.x<-20)r.x+=840;c.moveTo(r.x,r.y);c.lineTo(r.x+3.5,r.y-17)}c.stroke()}
 if(e.weather=='snow'||P.winter){c.fillStyle='#fff';for(const s of P_.snow){s.y+=s.v*dt;s.x+=Math.sin(t*1.2+s.p)*18*dt;if(s.y>600){s.y=-6;s.x=Math.random()*800}c.globalAlpha=.9;c.fillRect(Math.round(s.x/2)*2,Math.round(s.y/2)*2,s.s>3.4?4:2,s.s>3.4?4:2)}c.globalAlpha=1}
 if(P.autumn&&e.weather!='rain'){for(const l of P_.leaf){l.y+=l.v*dt;l.x+=Math.sin(t+l.p)*24*dt+10*dt;l.r+=dt*2;if(l.y>600){l.y=-10;l.x=Math.random()*800}c.save();c.translate(l.x,l.y);c.rotate(l.r);c.fillStyle=l.c;c.fillRect(-4,-2,8,4);c.fillStyle='rgba(0,0,0,.2)';c.fillRect(-4,0,8,1);c.restore()}}
 const night=e.hour<5.6||e.hour>20.4;
 if(night&&e.weather!='rain'&&!P.snow){for(const f of P_.fly){f.p+=dt*f.s;const x=f.x+Math.sin(f.p*.7)*34,y=f.y+Math.cos(f.p*.9)*18,a=.4+.6*Math.abs(Math.sin(f.p*2));c.globalAlpha=a;const gr=c.createRadialGradient(x,y,0,x,y,12);gr.addColorStop(0,'rgba(255,255,160,.9)');gr.addColorStop(1,'rgba(255,255,160,0)');c.fillStyle=gr;c.fillRect(x-12,y-12,24,24);c.fillStyle='#fffbb0';c.fillRect(Math.round(x)-1,Math.round(y)-1,3,3)}c.globalAlpha=1}
 else if(!night&&!P.snow&&e.weather!='rain'&&!P.autumn){for(const b of P_.but){b.p+=dt*2;const x=b.x+Math.sin(b.p*.35)*120+Math.sin(b.p)*8,y=b.y+Math.cos(b.p*.27)*60+Math.sin(b.p*1.7)*7,w=Math.abs(Math.sin(b.p*7))*5+1;c.fillStyle=b.c;c.fillRect(Math.round(x)-w,Math.round(y)-3,w,4);c.fillRect(Math.round(x)+1,Math.round(y)-3,w,4);c.fillStyle='#3a2a2a';c.fillRect(Math.round(x),Math.round(y)-3,2,5)}}}

// ------------------------------------------------------------- lighting
const dkC=cvs(NW,NH),dkx=dkC.getContext('2d');
function darkness(h){if(h>=7.2&&h<=18.2)return 0;if(h>20.6||h<5.4)return .62;if(h>18.2)return(h-18.2)/2.4*.62;return(7.2-h)/1.8*.62}
function light(c,t,e,P){const dk=darkness(e.hour)*(e.weather=='rain'?1.08:1),ev=Math.max(0,1-Math.abs(e.hour-18.6)/1.6)*.2+Math.max(0,1-Math.abs(e.hour-6.9)/1.1)*.12;
 if(e.weather=='rain'||e.weather=='cloudy'){c.fillStyle=e.weather=='rain'?'rgba(50,70,100,.2)':'rgba(70,90,120,.08)';c.fillRect(0,0,800,600)}
 if(ev>.01){c.fillStyle='rgba(255,140,60,'+ev+')';c.fillRect(0,0,800,600)}
 if(dk>.02){dkx.globalCompositeOperation='source-over';dkx.clearRect(0,0,NW,NH);dkx.fillStyle='rgba(12,18,58,'+Math.min(.78,dk*1.05)+')';dkx.fillRect(0,0,NW,NH);dkx.globalCompositeOperation='destination-out';
  for(const l of LAMPS){const lx=l.x/2,ly=l.y/2-52,gr=dkx.createRadialGradient(lx,ly,2,lx,ly,64);gr.addColorStop(0,'rgba(0,0,0,.95)');gr.addColorStop(.6,'rgba(0,0,0,.45)');gr.addColorStop(1,'rgba(0,0,0,0)');dkx.fillStyle=gr;dkx.fillRect(lx-64,ly-64,128,128)}
  dkx.globalCompositeOperation='source-over';c.imageSmoothingEnabled=true;c.drawImage(dkC,0,0,800,600);c.imageSmoothingEnabled=false;
  c.save();c.globalCompositeOperation='lighter';for(const l of LAMPS){const lx=l.x,ly=l.y-104,fl=.92+.08*Math.sin(t*5+l.x),gr=c.createRadialGradient(lx,ly,2,lx,ly,110);gr.addColorStop(0,'rgba(255,214,130,'+.55*Math.min(1,dk*1.6)*fl+')');gr.addColorStop(1,'rgba(255,170,80,0)');c.fillStyle=gr;c.fillRect(lx-110,ly-110,220,260)}c.restore()}}

g.PARKART={POND,PROPS,pal,layer,sky,pondLive,inPond,weatherFx,light,spr,put,trunk,canopy,bench,lamp,bush,rock,flowers,TREAT,ball,hash};
})(window);
