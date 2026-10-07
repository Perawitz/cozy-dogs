// Cozy Dogs - pixel-art room renderer: wallpaper, floors, moulding, window scenery (time/weather/season), curtains, lighting, item drawing.
(function(g){
'use strict';
const IA=g.ITEMART,T=IA.T,Dr=IA.D;
const NW=400,NH=300,WX=159,WY=25,WW=82,WH=78;          // native (x2 = world) ; window hole
const hash=(x,y,s=0)=>{let h=(Math.imul(x|0,374761393)+Math.imul(y|0,668265263)+Math.imul(s|0,1442695041))>>>0;h=Math.imul(h^(h>>>13),1274126177)>>>0;return((h^(h>>>16))>>>0)/4294967296};
const cvs=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c};
const lerp=(a,b,t)=>a+(b-a)*t, sstep=(a,b,x)=>{x=Math.max(0,Math.min(1,(x-a)/(b-a)));return x*x*(3-2*x)};
const hx=h=>{h=h.replace('#','');return[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]};
const mix=(a,b,t)=>{const A=hx(a),B=hx(b);return'#'+A.map((v,i)=>Math.round(lerp(v,B[i],t)).toString(16).padStart(2,'0')).join('')};
const rgba=(h,a)=>{const[r,gg,b]=hx(h);return`rgba(${r},${gg},${b},${a})`};

// ---------------- wallpapers ----------------
const WALLC={cream:['#f7e6c4','#ecd3a6'],pink:['#fad4de','#f1b6c8'],mint:['#d2eede','#b2dcc6'],sky:['#d4e7fc','#b4d1f0']};
const CURT={cream:'#e58a9c',pink:'#fff0e2',mint:'#6fb8b2',sky:'#f2c878',stripe:'#c8505e',panel:'#8e2c3c',galaxy:'#4a3a9a'};
function wallPaint(c,style){const d=Dr(c,0,0);
 if(WALLC[style]){const[b,m]=WALLC[style];d.r(0,0,NW,160,b);
  for(let y=6;y<150;y+=14)for(let x=((y/14|0)%2)*7+3;x<NW;x+=14){d.p(x,y,m);d.p(x-1,y+1,m);d.p(x+1,y+1,m);d.p(x,y+2,m);d.p(x,y+1,T(m,.9));d.p(x,y-1,T(b,1.08))}
  for(let y=0;y<46;y++){c.fillStyle='rgba(110,70,60,'+(0.13*Math.pow(1-y/46,1.4))+')';c.fillRect(0,y,NW,1)}}
 else if(style=='stripe'){const a='#f7ecd6',b='#a4cbd8';for(let x=0;x<NW;x++){const k=x%20;d.r(x,0,1,160,k<10?a:b);}
  for(let x=0;x<NW;x+=20){d.r(x,0,1,160,'#fff');d.r(x+9,0,1,160,T(a,.9));d.r(x+10,0,1,160,T(b,1.15));d.r(x+19,0,1,160,T(b,.85))}
  for(let y=0;y<46;y++){c.fillStyle='rgba(60,70,90,'+(0.12*Math.pow(1-y/46,1.4))+')';c.fillRect(0,y,NW,1)}}
 else if(style=='panel'){d.r(0,0,NW,160,'#5a3826');
  for(let x=2;x<NW;x+=44){d.bx(x,10,40,130,'#7a5238',0);d.r(x+4,14,32,122,'#6a4430');d.r(x+4,14,32,1,'#4a2c1c');d.r(x+4,14,1,122,'#4a2c1c');d.r(x+35,15,1,121,'#8a6044');d.r(x+5,135,31,1,'#8a6044');
   for(let i=0;i<40;i++)d.p(x+5+Math.floor(hash(x,i,3)*30),15+Math.floor(hash(i,x,5)*118),hash(i,x,9)<.5?'#5e3c28':'#74503a')}}
 else if(style=='galaxy'){for(let y=0;y<160;y++)d.r(0,y,NW,1,mix('#0c0622','#2a1658',y/160));
  const blobs=[[70,50,50,22,'#7a2a9a'],[290,90,70,26,'#2a4aa8'],[200,30,40,14,'#a02a7a'],[350,30,36,16,'#4a2aa0'],[120,120,60,20,'#2a6ab0']];
  for(const[cx,cy,rx,ry,col]of blobs)for(let y=cy-ry;y<=cy+ry;y++)for(let x=cx-rx;x<=cx+rx;x++){const q=(x-cx)*(x-cx)/(rx*rx)+(y-cy)*(y-cy)/(ry*ry);if(q<1&&hash(x,y,2)<(1-q)*.5&&(x+y)%2==0)d.p(x,y,col)}
  for(let y=0;y<160;y++)for(let x=0;x<NW;x++){const h=hash(x,y,7);if(h<.008)d.p(x,y,'#fff');else if(h<.02)d.p(x,y,'#b8a8ff')}
  for(const[x,y]of[[40,20],[130,70],[260,40],[330,110],[370,60],[90,120]]){d.p(x,y,'#fff');d.p(x-1,y,'#cfc4ff');d.p(x+1,y,'#cfc4ff');d.p(x,y-1,'#cfc4ff');d.p(x,y+1,'#cfc4ff')}}}
function wainscot(c,style){if(style=='panel'||style=='galaxy')return;const d=Dr(c,0,0),wc=style=='stripe'?'#fffdf6':'#fdf4e6';
 d.r(0,108,NW,42,wc);d.r(0,105,NW,4,T(wc,1.05));d.r(0,105,NW,1,'#fff');d.r(0,108,NW,1,T(wc,.82));d.r(0,109,NW,2,'rgba(90,60,40,.13)');
 for(let x=7;x<NW;x+=34){d.r(x,116,26,30,T(wc,.97));d.r(x,116,26,1,T(wc,.8));d.r(x,116,1,30,T(wc,.84));d.r(x+25,116,1,30,'#fff');d.r(x,145,26,1,'#fff');d.r(x+1,117,24,1,'rgba(90,60,40,.08)')}
 d.r(0,148,NW,2,T(wc,.85))}
function baseboard(c){const d=Dr(c,0,0);d.r(0,150,NW,10,'#fffaf0');d.r(0,150,NW,1,'#fff');d.r(0,151,NW,1,'#e8dcc8');d.r(0,157,NW,2,'#e0d2bc');d.r(0,159,NW,1,'#c8b89c');d.r(0,160,NW,2,'rgba(60,35,20,.28)');d.r(0,162,NW,2,'rgba(60,35,20,.12)')}
function crown(c){const d=Dr(c,0,0);d.r(0,0,NW,7,'#fffaf0');d.r(0,0,NW,1,'#fff');d.r(0,2,NW,1,'#e8dcc8');d.r(0,5,NW,1,'#e0d2bc');d.r(0,6,NW,1,'#c8b89c');d.r(0,7,NW,3,'rgba(60,35,20,.22)');d.r(0,10,NW,2,'rgba(60,35,20,.08)');
 for(let x=2;x<NW;x+=6){d.p(x,3,'#efe4d0');d.p(x,4,'#e8dcc8')}}
function windowFrame(c){const d=Dr(c,0,0);c.clearRect(WX,WY,WW,WH);
 d.r(WX-4,WY-4,WW+8,4,'#fffaf2');d.r(WX-4,WY-4,WW+8,1,'#fff');d.r(WX-4,WY-1,WW+8,1,'#d8ccb8');
 d.r(WX-4,WY,4,WH,'#fffaf2');d.r(WX-4,WY,1,WH,'#fff');d.r(WX-1,WY,1,WH,'#d8ccb8');
 d.r(WX+WW,WY,4,WH,'#f2e8d6');d.r(WX+WW,WY,1,WH,'#e8dcc8');d.r(WX+WW+3,WY,1,WH,'#c8b89c');
 d.r(WX-4,WY+WH,WW+8,3,'#f2e8d6');d.r(WX-4,WY+WH,WW+8,1,'#d8ccb8');
 d.r(WX+39,WY,3,WH,'#fffaf2');d.r(WX+39,WY,1,WH,'#fff');d.r(WX+41,WY,1,WH,'#d8ccb8');d.r(WX,WY+37,WW,3,'#fffaf2');d.r(WX,WY+37,WW,1,'#fff');d.r(WX,WY+39,WW,1,'#d8ccb8');
 d.r(WX-7,WY+WH+3,WW+14,4,'#fffaf2');d.r(WX-7,WY+WH+3,WW+14,1,'#fff');d.r(WX-7,WY+WH+6,WW+14,1,'#d0c4ae');d.r(WX-6,WY+WH+7,WW+12,2,'rgba(60,35,20,.25)');d.r(WX-4,WY+WH+9,WW+8,1,'rgba(60,35,20,.12)');
 d.r(WX,WY,WW,2,'rgba(60,40,30,.28)');d.r(WX,WY,2,WH,'rgba(60,40,30,.16)')}

// ---------------- floors ----------------
const FLC={wood:['#d9a572','#cf9a68','#e2b080'],light:['#ecd2a8','#e3c598','#f2dcb8'],dark:['#9a6a46','#8e5f3e','#a67450']};
function floorPaint(c,style){const d=Dr(c,0,0);let y=160,i=0;
 const base=FLC[style];
 if(style=='carpet'){d.r(0,160,NW,140,'#d6b6d8');for(let yy=160;yy<NH;yy++)for(let x=0;x<NW;x++){const h=hash(x,yy,4);if(h<.3)d.p(x,yy,'#c8a6cc');else if(h<.52)d.p(x,yy,'#e2c6e2')}
  d.r(0,160,NW,1,'#b896bc');for(let k=0;k<NW;k+=2){d.p(k,165,'#c0a0c4')}d.r(6,166,NW-12,1,'#e8d0e8');d.r(6,NH-6,NW-12,1,'#c0a0c4');d.r(6,166,1,NH-172,'#e8d0e8');d.r(NW-7,166,1,NH-172,'#c0a0c4');return}
 while(y<NH){const h=Math.min(NH-y,6+Math.floor(i/2));
  if(base){let x=-Math.floor(hash(i,1,1)*50),n=0;while(x<NW){const w=50+Math.floor(hash(i,n,2)*50),col=mix(base[Math.floor(hash(i,n,3)*3)],'#ffffff',.0),k=.94+hash(i,n,4)*.12;const cc=T(col,k);
    d.r(x,y,w,h,cc);d.r(x,y,w,1,T(cc,1.16));d.r(x,y+h-1,w,1,T(cc,.72));d.r(x+w-1,y,1,h,T(cc,.7));
    for(let q=0;q<2+h/4;q++){const gx=x+2+Math.floor(hash(i,n*9+q,5)*(w-6)),gy=y+1+Math.floor(hash(i,n*7+q,6)*(h-2));d.r(gx,gy,3+Math.floor(hash(q,n,8)*6),1,T(cc,.88))}
    if(hash(i,n,11)<.12){const kx=x+6+Math.floor(hash(i,n,12)*(w-12)),ky=y+Math.floor(h/2);d.e(kx,ky,2,Math.max(1,(h/4)|0),T(cc,.8));d.p(kx,ky,T(cc,.62))}
    x+=w;n++}}
  else if(style=='tile'){const tw=Math.round((h+2)*2.4);let x=-((i%2)*tw/2|0);let n=0;while(x<NW){const col=(n+i)%2?'#c9dbe8':'#f6f2ea';d.r(x,y,tw,h,col);d.r(x,y,tw,1,T(col,1.1));d.r(x,y+h-1,tw,1,'#a9b6c0');d.r(x+tw-1,y,1,h,'#a9b6c0');d.r(x+2,y+2,3,1,'rgba(255,255,255,.7)');x+=tw;n++}}
  else if(style=='marble'){const tw=Math.round((h+3)*3.2);let x=-((i%2)*tw/2|0),n=0;while(x<NW){const col=(n+i)%2?'#e8e4f0':'#f6f3f8';d.r(x,y,tw,h,col);d.r(x,y,tw,1,'#fff');d.r(x,y+h-1,tw,1,'#cbc6d8');d.r(x+tw-1,y,1,h,'#cbc6d8');
    for(let v=0;v<2;v++){let vx=x+2+Math.floor(hash(n,i,20+v)*(tw-6)),vy=y+1;for(let k=0;k<h-1;k++){d.p(vx,vy+k,v?'#e0dcec':'#c4bfd8');if(hash(vx,k,i)<.3)vx+=hash(k,vx,i)<.5?-1:1;vx=Math.max(x+1,Math.min(x+tw-2,vx))}}x+=tw;n++}}
  y+=h;i++}
 for(let k=0;k<22;k++){c.fillStyle='rgba(55,28,16,'+(0.28*Math.pow(1-k/22,1.6))+')';c.fillRect(0,160+k,NW,1)}
 for(let k=0;k<NH-160;k++){c.fillStyle='rgba(255,236,190,'+(0.07*k/140)+')';c.fillRect(0,160+k,NW,1)}}

// ---------------- window scenery (dynamic) ----------------
const SKY=[[0,'#0b1030','#1c2a62'],[5,'#1c2250','#3a3a80'],[6,'#4a4a8a','#f29078'],[7.5,'#66b4ec','#ffd8b0'],[10,'#58b4f0','#c8ecfd'],[15.5,'#5cb0f0','#d4f0ff'],[17.5,'#6aa0e8','#ffd9a0'],[19,'#52407a','#ff8c6a'],[20.5,'#1c2050','#5a4a8a'],[22,'#0b1030','#1c2a62'],[24,'#0b1030','#1c2a62']];
function skyAt(h){for(let i=0;i<SKY.length-1;i++){const a=SKY[i],b=SKY[i+1];if(h>=a[0]&&h<=b[0]){const t=(h-a[0])/(b[0]-a[0]);return[mix(a[1],b[1],t),mix(a[2],b[2],t)]}}return[SKY[0][1],SKY[0][2]]}
const nightF=h=>h<5||h>=21?1:h<7?1-sstep(5,7,h):h<18?0:sstep(18,21,h);
const sc=cvs(WW,WH),scc=sc.getContext('2d'),sd=Dr(scc,0,0);
function cloud(d,x,y,s,col){d.se(x,y,6*s,3*s,col);d.se(x+5*s,y-2*s,5*s,3*s,col);d.se(x-5*s,y+0,4*s,2*s,col);d.r(x-8*s,y+2*s,17*s,1,T(col,.9))}
function scenery(env,t){const h=env.hour,n=nightF(h),[top,bot]=skyAt(h),wea=env.weather||'sunny',snow=wea=='snow'||env.season=='christmas',hal=env.season=='halloween';
 let tt=top,bb=bot;if(wea=='rain'){tt=mix(tt,'#7a8898',.55);bb=mix(bb,'#aab6c2',.55)}else if(wea=='snow'){tt=mix(tt,'#a8b4c4',.5);bb=mix(bb,'#d8e0ea',.5)}else if(wea=='cloudy'){tt=mix(tt,'#8c98a8',.35);bb=mix(bb,'#c4ccd6',.35)}
 if(hal){tt=mix(tt,'#3a1850',.4);bb=mix(bb,'#e8782a',n>.5?.25:.1)}
 for(let y=0;y<WH;y++){const k=Math.floor(y/WH*10)/10;sd.r(0,y,WW,1,mix(tt,bb,k))}
 if(n>.2){for(let i=0;i<26;i++){const x=Math.floor(hash(i,1,1)*WW),y=Math.floor(hash(i,2,1)*40),a=n*(.45+.55*Math.sin(t*2+i*1.7));if(a>.35){sd.p(x,y,i%5?'#dfe6ff':'#fff');if(i%7==0&&a>.8){sd.p(x-1,y,'#b8c4ff');sd.p(x+1,y,'#b8c4ff');sd.p(x,y-1,'#b8c4ff');sd.p(x,y+1,'#b8c4ff')}}}}
 // sun & moon
 const dt=(h-6)/12;if(dt>=0&&dt<=1&&wea!='rain'){const x=8+dt*66,y=58-Math.sin(dt*Math.PI)*44;scc.globalAlpha=.18;sd.e(Math.round(x),Math.round(y),11,11,'#fff2b0');scc.globalAlpha=.3;sd.e(Math.round(x),Math.round(y),8,8,'#fff2b0');scc.globalAlpha=1;sd.se(Math.round(x),Math.round(y),5,5,dt<.12||dt>.88?'#ffb860':'#ffe46b')}
 const nt=((h<12?h+24:h)-18)/12;if(nt>=0&&nt<=1){const x=8+nt*66,y=58-Math.sin(nt*Math.PI)*42,mc=hal?'#ffb040':'#fff6c8';scc.globalAlpha=.2;sd.e(Math.round(x),Math.round(y),hal?12:9,hal?12:9,mc);scc.globalAlpha=1;sd.e(Math.round(x),Math.round(y),hal?7:5,hal?7:5,mc);
  if(!hal){sd.e(Math.round(x)+2,Math.round(y)-1,4,4,mix(tt,bb,.4))}else{sd.p(Math.round(x)-3,Math.round(y)-2,'#c87a1a');sd.p(Math.round(x)+2,Math.round(y)+2,'#c87a1a');sd.p(Math.round(x)+1,Math.round(y)-3,'#c87a1a')}}
 // clouds
 const heavy=wea=='cloudy'||wea=='rain'||wea=='snow',cc=wea=='rain'?'#9aa6b4':n>.5?'#6a7498':'#ffffff';
 for(let i=0;i<(heavy?5:3);i++){const sp=2+i*.7,x=((t*sp+i*37)%(WW+40))-20;cloud(sd,Math.round(x),12+i*9+(i%2)*4,heavy?1.3:1,mix(cc,mix(tt,bb,.5),n*.2))}
 // far hills / house / tree
 const dayK=1-n*.78,gcol=snow?'#eef5ff':hal?'#6a5a4a':'#7ccb8a',gcol2=snow?'#dfe9f6':hal?'#4e4236':'#5cbc6e';
 for(let x=0;x<WW;x++){const y=Math.round(50+Math.sin(x*.07+1)*5+Math.sin(x*.19)*2);sd.r(x,y,1,WH-y,mix('#07101a',gcol,dayK))}
 sd.r(54,48,12,9,mix('#1a1020',snow?'#e8dccb':'#f2e0c0',dayK));for(let k=0;k<7;k++)sd.r(53+k,47-k,14-2*k,1,mix('#10101a',snow?'#f4f8ff':'#c8604a',dayK));sd.r(62,39,3,6,mix('#10101a','#a85a48',dayK));sd.r(57,51,3,5,n>.4?'#ffd870':mix('#3a2a2a','#7a5a3a',dayK));if(n>.4)sd.r(57,51,3,5,'#ffd870');
 if(n<.8&&!(wea=='rain')){for(let i=0;i<3;i++){const k=((t*6+i*9)%27)/27;scc.globalAlpha=(1-k)*.5*(1-n);sd.e(64+Math.round(k*7+i%2),Math.round(37-k*14),1+(k*2|0),1+(k*2|0),'#fff');scc.globalAlpha=1}}
 for(let x=0;x<WW;x++){const y=Math.round(61+Math.sin(x*.05+2)*4);sd.r(x,y,1,WH-y,mix('#05101a',gcol2,dayK))}
 // tree
 const tc=snow?'#e8f2ff':hal?'#3a2a20':env.hour>0?'#4aa858':'#4aa858';sd.r(13,48,4,26,mix('#10080a','#7a5030',dayK));
 if(!hal){for(const[x,y,r]of[[15,40,9],[9,46,6],[21,46,6],[15,34,6]])sd.se(x,y,r,Math.round(r*.9),mix('#0a1810',tc,dayK))}else{for(const[a,b,c2,d2]of[[15,44,6,36],[15,42,24,34],[15,46,5,40],[15,38,20,30]])sd.ln(a,b,c2,d2,'#2a1a14')}
 // fence & flowers
 for(let x=1;x<WW;x+=5){sd.r(x,64,3,12,mix('#101820','#fffdf6',dayK));sd.r(x,64,1,12,mix('#101820','#e8e0d0',dayK));sd.p(x+1,63,mix('#101820','#fffdf6',dayK))}sd.r(0,68,WW,1,mix('#101820','#e8e0d0',dayK));sd.r(0,73,WW,1,mix('#101820','#e8e0d0',dayK));
 if(!snow&&!hal)for(let i=0;i<9;i++){const x=Math.floor(hash(i,3,3)*WW),y=70+Math.floor(hash(i,4,3)*7);if(y>73||y<68)sd.p(x,y,mix('#101820',['#ff8aa8','#ffd24a','#fff','#c58bff'][i%4],dayK))}
 sd.r(0,WH-4,WW,4,mix('#06100c',gcol2,dayK*.9));
 // birds
 if(n<.6&&wea=='sunny'||wea=='cloudy'&&n<.6){const k=((t*5)%140)/140;if(k<1){const x=-8+k*(WW+16),y=20+Math.sin(k*9)*4,w=Math.floor(t*5)%2;const col=mix('#202020','#3a3a46',0);sd.p(Math.round(x),Math.round(y),col);sd.p(Math.round(x)-1,Math.round(y)+(w?-1:1),col);sd.p(Math.round(x)+1,Math.round(y)+(w?-1:1),col)}}
 if(hal&&n>.4){for(let i=0;i<3;i++){const k=((t*9+i*40)%160)/160,x=-6+k*(WW+12),y=10+i*10+Math.sin(k*14+i)*5,w=Math.floor(t*8+i)%2;sd.p(Math.round(x),Math.round(y),'#0a0610');sd.r(Math.round(x)-2,Math.round(y)+(w?-1:0),2,1,'#0a0610');sd.r(Math.round(x)+1,Math.round(y)+(w?-1:0),2,1,'#0a0610')}}
 // weather particles
 if(wea=='rain'){for(let i=0;i<34;i++){const sp=70+hash(i,1,1)*40,x=(hash(i,2,2)*WW*1.3+t*14)%(WW+10)-5,y=(hash(i,3,3)*WH+t*sp)%(WH+8)-4;sd.p(Math.round(x),Math.round(y),'#cfe4fa');sd.p(Math.round(x)-1,Math.round(y)-2,'#9fbad8')}}
 if(snow&&(wea=='snow'||env.season=='christmas')){for(let i=0;i<40;i++){const sp=7+hash(i,1,1)*9,x=(hash(i,2,2)*WW+Math.sin(t+i)*3+WW)%WW,y=(hash(i,3,3)*WH+t*sp)%WH;sd.p(Math.round(x),Math.round(y),'#fff');if(i%5==0)sd.p(Math.round(x)+1,Math.round(y),'#dfeaff')}}
 // glass reflection
 scc.globalAlpha=.14;sd.r(6,4,3,30,'#fff');sd.r(11,4,1,18,'#fff');sd.r(46,40,3,30,'#fff');scc.globalAlpha=1}

// ---------------- curtains ----------------
const CURC={};
function curtain(side,col,sw){const key=side+col+sw;if(CURC[key])return CURC[key];const w=26,h=112,cv=cvs(w+6,h),c=cv.getContext('2d'),d=Dr(c,0,0);
 for(let y=2;y<h;y++){const k=(y-2)/(h-2),s=Math.round(sw*k*1.4),flare=y>66?Math.round((y-66)/46*5):0;const l=(side<0?0:0)+s-(side<0?flare:0)+3,wd=w-3+(y>66?3:0)+flare*(1-0)*.5;
  for(let x=0;x<wd;x++){const f=Math.sin((x+y*.03)*(Math.PI*2/8.5)),shade=f>.55?1.14:f>.1?1.0:f>-.45?.9:.78;d.p(Math.round(l+x),y,T(col,shade))}
  d.p(Math.round(l-1),y,T(col,.62));d.p(Math.round(l+wd),y,T(col,.62))}
 const ty=62,tl=side<0?3:4;d.r(tl-1,ty,w-1,4,T(col,.7));d.r(tl-1,ty,w-1,1,T(col,1.2));d.p(tl+(side<0?w-3:1),ty+1,'#ffd870');d.p(tl+(side<0?w-3:1),ty+2,'#c8962a');
 for(let x=0;x<w;x+=3)d.p(3+x,h-1,T(col,1.25));return CURC[key]=cv}
function rod(c){const d=Dr(c,0,0);d.r(124,12,152,3,'#8a6a4a');d.r(124,12,152,1,'#c8a874');d.r(124,14,152,1,'#5a3a22');for(const x of[120,274]){d.se(x+3,13,3,3,'#f0c870');d.p(x+2,12,'#fff6c0')}
 for(let x=134;x<266;x+=11){d.r(x,15,2,3,'#c8a874')}}

// ---------------- lights ----------------
const GLOW={lamp:{dy:-52,col:'#ffd890',r:150,k:.95},tv:{dy:-46,col:'#a8d8ff',r:120,k:.55,flick:1,always:1},aquarium:{dy:-42,col:'#8fe8ff',r:110,k:.5,always:1},fireplace:{dy:-26,col:'#ff9a40',r:190,k:1,flick:1,always:1},
 neon:{dy:0,col:'#ff5ab0',r:120,k:.7},pumpkin:{dy:-12,col:'#ff9a30',r:80,k:.8,flick:1},xtree:{dy:-56,col:'#fff0a0',r:140,k:.55},bunting:{dy:8,col:'#fff0c8',r:0,k:0}};
const RODC=cvs(NW,NH);rod(RODC.getContext('2d'));
const LTINT={warm:['#ffc878',.06],cool:['#8ab4ff',.10],dream:['#ff9ae0',.12],sunset:['#ff9a4c',.11]};
const lo=cvs(NW,NH),loc=lo.getContext('2d');
const motes=[...Array(30)].map((_,i)=>({x:hash(i,1,5)*800,y:hash(i,2,5)*600,v:3+hash(i,3,5)*7,p:hash(i,4,5)*6}));

const R={cur:{wall:'cream',floor:'wood',light:'warm'},stat:null,key:''};
function build(deco){const key=deco.wall+'|'+deco.floor;if(R.key==key&&R.stat)return;R.key=key;const cv=cvs(NW,NH),c=cv.getContext('2d');
 floorPaint(c,deco.floor);wallPaint(c,deco.wall);wainscot(c,deco.wall);baseboard(c);crown(c);windowFrame(c);R.stat=cv}
function mainCtx(ctx){ctx.imageSmoothingEnabled=false}
const api={
 NW,NH,
 setDeco(d){R.cur=Object.assign({wall:'cream',floor:'wood',light:'warm'},d);build(R.cur)},
 back(ctx,t,env){build(R.cur);mainCtx(ctx);scenery(env,t);ctx.drawImage(sc,WX*2,WY*2,WW*2,WH*2);ctx.drawImage(R.stat,0,0,NW*2,NH*2);
  const col=CURT[R.cur.wall]||CURT.cream,s=Math.sin(t*1.1),si=Math.round((s+1)/2*6),sw=-3+si*.9,s2=Math.round((Math.sin(t*1.1+1)+1)/2*6);
  ctx.drawImage(RODC,0,0,NW*2,NH*2);
  ctx.drawImage(curtain(-1,col,Math.round(sw)),132*2,14*2,32*2,112*2);ctx.drawImage(curtain(1,col,-Math.round(sw)),(240)*2,14*2,32*2,112*2)},
 // draw one item
 item(ctx,it,t,env,o={}){const m=IA.META[it.draw];if(!m)return;const pal=it.pal,fr=m.fr;let f=0;
  const RT={fireplace:8,tv:1.3,aquarium:2,plantBig:.9,plantSmall:.9,pumpkin:3,xtree:2,water:1.5};
  if(it.draw=='neon')f=Math.sin(t*3.1)>.93?1:0;else if(fr>1)f=Math.floor(t*(RT[it.draw]||2)+(it.uid?hash(it.uid.charCodeAt(0),it.uid.charCodeAt(1)||0,1)*7:0))%fr;
  const s=IA.sprite(it.draw,it.draw=='clock'?(Math.floor(env.hour*60)%720):pal,f);if(!s)return;
  ctx.save();ctx.imageSmoothingEnabled=false;ctx.translate(Math.round(it.x),Math.round(it.y));if(it.f)ctx.scale(-1,1);
  const x0=-s.ax*2,y0=-s.ay*2;
  if(s.rug){ctx.globalAlpha=1;ctx.fillStyle='rgba(60,30,20,.18)';ctx.fillRect(x0+4,y0+s.h*2-4,s.w*2-8,4)}
  else if(it.kind=='wall'){ctx.shadowColor='rgba(50,30,20,.30)';ctx.shadowOffsetX=4;ctx.shadowOffsetY=5;ctx.shadowBlur=0}
  else{ctx.fillStyle='rgba(60,30,20,.2)';const w=Math.min(s.w*2*.78,150);ctx.beginPath();ctx.ellipse(0,-1,w/2,Math.max(5,w*.075),0,0,7);ctx.fill();
   if(it.draw=='bunting'){}}
  if(o.ghost)ctx.globalAlpha=.65;ctx.drawImage(s.cv,x0,y0,s.w*2,s.h*2);ctx.restore()},
 box(it){const m=IA.META[it.draw];if(!m)return{x0:it.x-20,y0:it.y-20,x1:it.x+20,y1:it.y};const w=m.w*2,h=m.h*2,x0=it.x-m.ax*2,y0=it.y-m.ay*2;return{x0,y0,x1:x0+w,y1:y0+h}},
 // lighting + shafts + motes, drawn over everything
 front(ctx,t,env,items){const h=env.hour,n=nightF(h),wea=env.weather||'sunny',lt=LTINT[R.cur.light]||LTINT.warm,day=1-n;
  // shafts
  if(day>.15&&wea!='rain'){const gh=1-Math.min(1,Math.abs(h-12)/6),a=.15*day*(wea=='cloudy'?.5:1),sh=(12-h)*26;ctx.save();
   const gr=ctx.createLinearGradient(0,206,0,560);gr.addColorStop(0,`rgba(255,${240-gh*0|0},190,${a*1.4})`);gr.addColorStop(1,'rgba(255,240,190,0)');ctx.fillStyle=gr;ctx.beginPath();ctx.moveTo(318,206);ctx.lineTo(482,206);ctx.lineTo(560+sh,560);ctx.lineTo(250+sh,560);ctx.closePath();ctx.fill();
   ctx.fillStyle=`rgba(255,246,200,${a*1.05})`;for(let i=0;i<2;i++)for(let j=0;j<2;j++){const u0=330+i*80,v0=60+j*76,P=(u,v)=>[400+(u-400)*1.5+sh*1.1,402+(v-50)*.82];const q=[P(u0,v0),P(u0+72,v0),P(u0+72,v0+66),P(u0,v0+66)];ctx.beginPath();q.forEach(([x,y],k)=>k?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill()}
   ctx.restore();ctx.fillStyle='#fff8d8';for(const m of motes){const x=(m.x+Math.sin(t*.4+m.p)*14+t*m.v*.3)%800,y=(m.y-t*m.v*.6+6000)%600,a2=(.25+.35*Math.sin(t*1.5+m.p))*day;if(y>200&&y<540&&x>250&&x<640){ctx.globalAlpha=a2;ctx.fillRect(Math.round(x/2)*2,Math.round(y/2)*2,2,2)}}ctx.globalAlpha=1}
  // night & tint overlay
  const L=items.filter(i=>GLOW[i.draw]&&GLOW[i.draw].r);
  const ng=env.hour,tintA=n*.64+(lt[1]*(1-n*.4)),tc=n>.3?mix(lt[0],'#0a1034',Math.min(1,n*1.2)):lt[0];
  loc.globalCompositeOperation='source-over';loc.clearRect(0,0,NW,NH);loc.fillStyle=rgba(tc,Math.min(.74,tintA));loc.fillRect(0,0,NW,NH);
  const dusk=Math.max(0,1-Math.abs(h-18.6)/1.5),dawn=Math.max(0,1-Math.abs(h-6.3)/1.2);if(dusk+dawn>0){loc.fillStyle=rgba('#ff8a50',.10*(dusk+dawn));loc.fillRect(0,0,NW,NH)}
  loc.globalCompositeOperation='destination-out';
  const gl=[];for(const i of L){const G=GLOW[i.draw];const on=G.always?(.4+.6*n):n*.85+.1;let k=G.k*on;if(G.flick)k*=.92+.08*Math.sin(t*(i.draw=='fireplace'?13:5)+i.x);const x=i.x/2,y=(i.y+G.dy)/2,r=G.r/2;gl.push([i,G,x,y,r,k]);
   const gr=loc.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,`rgba(0,0,0,${Math.min(1,k*1.0)})`);gr.addColorStop(.5,`rgba(0,0,0,${k*.5})`);gr.addColorStop(1,'rgba(0,0,0,0)');loc.fillStyle=gr;loc.fillRect(x-r,y-r,r*2,r*2)}
  // window moon/day light pool at night
  if(n>.3){const gr=loc.createRadialGradient(200,60,0,200,60,90);gr.addColorStop(0,`rgba(0,0,0,${.22*n})`);gr.addColorStop(1,'rgba(0,0,0,0)');loc.fillStyle=gr;loc.fillRect(100,0,200,160)}
  loc.globalCompositeOperation='source-over';ctx.save();ctx.imageSmoothingEnabled=true;ctx.drawImage(lo,0,0,800,600);ctx.restore();
  ctx.save();ctx.globalCompositeOperation='lighter';for(const[i,G,x,y,r,k]of gl){const gr=ctx.createRadialGradient(x*2,y*2,0,x*2,y*2,r*2);gr.addColorStop(0,rgba(G.col,.30*k));gr.addColorStop(.45,rgba(G.col,.11*k));gr.addColorStop(1,rgba(G.col,0));ctx.fillStyle=gr;ctx.fillRect(x*2-r*2,y*2-r*2,r*4,r*4)}ctx.restore();
  if(R.cur.light=='dream'){ctx.save();for(let i=0;i<14;i++){const x=(hash(i,1,9)*800+Math.sin(t*.5+i)*20),y=(hash(i,2,9)*400+120+t*6*(1+i%3))%420+110,a=.5+.5*Math.sin(t*2+i*2);ctx.globalAlpha=a*.8;ctx.fillStyle=i%2?'#fff4ff':'#ffd0f4';const s=i%3?2:4;ctx.fillRect(Math.round(x/2)*2,Math.round(y/2)*2,s,s);if(s==4){ctx.fillRect(Math.round(x/2)*2-2,Math.round(y/2)*2+1,8,2)}}ctx.restore()}
  const vg=ctx.createRadialGradient(400,330,260,400,330,560);vg.addColorStop(0,'rgba(60,30,20,0)');vg.addColorStop(1,'rgba(60,30,20,.22)');ctx.fillStyle=vg;ctx.fillRect(0,0,800,600)},
 thumb(draw,pal,size,f){const s=IA.sprite(draw,pal,f||0),cv=cvs(size,size);if(!s)return cv;const c=cv.getContext('2d');let k=Math.min((size-4)/s.w,(size-4)/s.h);if(k>=1)k=Math.floor(k);c.imageSmoothingEnabled=k<1;const w=s.w*k,h=s.h*k;c.drawImage(s.cv,(size-w)/2,(size-h)/2,w,h);return cv},
 swatch(kind,id,w,h){const cv=cvs(w,h),c=cv.getContext('2d');c.imageSmoothingEnabled=false;if(kind=='light'){const L=LTINT[id]||LTINT.warm,gr=c.createLinearGradient(0,0,w,h);gr.addColorStop(0,mix('#fff6e0',L[0],.55));gr.addColorStop(1,mix('#6a5a70',L[0],.5));c.fillStyle=gr;c.fillRect(0,0,w,h);return cv}
  const t=cvs(NW,NH),tc=t.getContext('2d');if(kind=='wall'){wallPaint(tc,id);wainscot(tc,id);baseboard(tc);c.drawImage(t,30,40,150,90,0,0,w,h)}else{floorPaint(tc,id);c.drawImage(t,60,170,140,84,0,0,w,h)}return cv},
 hour(){const d=new Date();return d.getHours()+d.getMinutes()/60}
};
g.ROOM=api;
})(typeof window!=='undefined'?window:globalThis);
