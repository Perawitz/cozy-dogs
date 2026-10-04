// Pixel-art human avatar generator for Cozy Dogs. Produces RGBA frames (44x48 px) per look / view / pose / frame.
// Same conventions as dogpix.js (PX=2.5 screen px per art pixel, dark brown outline, top-lit shading).
// Used in-browser (inlined into index.html) and in node for the contact-sheet tests.
(function(root){
'use strict';
const PX=2.5,AW=44,AH=48,AX=22,AY=46;           // grid size, centre column, baseline (feet bottom row = AY-1)
const D=root.AVD||(typeof require!=='undefined'?require('./avatar_data.js'):null);
const hexc=h=>{h=h.replace('#','');if(h.length==3)h=[...h].map(x=>x+x).join('');const n=parseInt(h,16);return[n>>16&255,n>>8&255,n&255]};
const mix=(a,b,t)=>[a[0]*(1-t)+b[0]*t,a[1]*(1-t)+b[1]*t,a[2]*(1-t)+b[2]*t];
const OUT=[42,28,24],LIGHT=[255,247,228],DARK=[62,36,78],ROSE=[158,70,88];
const sh=(c,k,rose)=>k<0?mix(c,rose||DARK,-k):mix(c,LIGHT,k);
const lum=c=>c[0]*.3+c[1]*.59+c[2]*.11;
const cl=(v,a,b)=>Math.max(a,Math.min(b,v));
const KEYS=['sk','h','hc','e','ec','m','bl','fr','t','tc','pt','b','bc','s','sc','ht','hk','g','x','xk','ls'];
const FRAMES={idle:8,wave:4,happy:2,walk:4,stand:2};
const FRONT={idle:1,wave:1,happy:1};

// ------------------------------------------------------------------------------------------------
// surface: colour / group / z per cell
// ------------------------------------------------------------------------------------------------
function surface(){
 const N=AW*AH,col=new Array(N).fill(null),grp=new Int16Array(N),zz=new Int32Array(N),gm=[null],gid={};let Z=0;
 const G=(name,o)=>{let g=gid[name];if(!g){g=gid[name]=gm.length;gm.push(Object.assign({name},o||{}))}return g};
 const put=(x,y,c,g)=>{x=Math.round(x);y=Math.round(y);if(x<0||y<0||x>=AW||y>=AH)return;const i=y*AW+x;col[i]=c;grp[i]=g;zz[i]=++Z};
 const has=(x,y)=>x>=0&&y>=0&&x<AW&&y<AH&&col[y*AW+x]!==null;
 const gAt=(x,y)=>has(x,y)?grp[y*AW+x]:0;
 const S={col,grp,zz,gm,G,put,has,gAt};
 // --- shapes (pixel-centre coordinates) ---
 S.px=(x,y,c,g)=>put(x,y,c,G(g[0],g[1]));
 S.rect=(x,y,w,h,c,g,keep)=>{const gg=G(g[0],g[1]);for(let j=0;j<h;j++)for(let i=0;i<w;i++)if(!keep||keep(x+i,y+j))put(x+i,y+j,c,gg)};
 S.ell=(cx,cy,rx,ry,c,g,keep)=>{const gg=G(g[0],g[1]);for(let y=Math.floor(cy-ry-1);y<=Math.ceil(cy+ry+1);y++)for(let x=Math.floor(cx-rx-1);x<=Math.ceil(cx+rx+1);x++){const dx=(x-cx)/(rx+.35),dy=(y-cy)/(ry+.35);if(dx*dx+dy*dy<=1&&(!keep||keep(x,y)))put(x,y,c,gg)}};
 S.sq=(cx,cy,rx,ry,n,c,g,keep)=>{const gg=G(g[0],g[1]);for(let y=Math.floor(cy-ry-1);y<=Math.ceil(cy+ry+1);y++)for(let x=Math.floor(cx-rx-1);x<=Math.ceil(cx+rx+1);x++){const dx=Math.abs((x-cx)/(rx+.35)),dy=Math.abs((y-cy)/(ry+.35));if(Math.pow(dx,n)+Math.pow(dy,n)<=1&&(!keep||keep(x,y)))put(x,y,c,gg)}};
 S.cap=(x0,y0,x1,y1,r,c,g,r1)=>{const n=Math.max(1,Math.ceil(Math.hypot(x1-x0,y1-y0)*2));if(r1==null)r1=r;for(let k=0;k<=n;k++){const t=k/n,rr=r+(r1-r)*t;S.ell(x0+(x1-x0)*t,y0+(y1-y0)*t,rr,rr,c,g)}};
 // polygon, vertices in pixel-CORNER coordinates (pixel (i,j) occupies [i,i+1)x[j,j+1))
 S.poly=(pts,c,g)=>{const gg=G(g[0],g[1]);let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;for(const p of pts){x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);y0=Math.min(y0,p[1]);y1=Math.max(y1,p[1])}
  for(let y=Math.floor(y0);y<=Math.ceil(y1);y++)for(let x=Math.floor(x0);x<=Math.ceil(x1);x++){const X=x+.5,Y=y+.5;let ins=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],b=pts[j];if((a[1]>Y)!=(b[1]>Y)&&X<(b[0]-a[0])*(Y-a[1])/(b[1]-a[1])+a[0])ins=!ins}if(ins)put(x,y,c,gg)}};
 // recolour existing cells only (keeps their group -> still shaded)
 S.paint=(x,y,c)=>{x=Math.round(x);y=Math.round(y);if(has(x,y))col[y*AW+x]=c};
 S.paintRect=(x,y,w,h,c)=>{for(let j=0;j<h;j++)for(let i=0;i<w;i++)S.paint(x+i,y+j,c)};
 S.paintIf=(x,y,c,gname)=>{x=Math.round(x);y=Math.round(y);if(has(x,y)&&gm[grp[y*AW+x]].name===gname)col[y*AW+x]=c};
 S.shadeCell=(x,y,k,rose)=>{x=Math.round(x);y=Math.round(y);if(has(x,y))col[y*AW+x]=sh(col[y*AW+x],k,rose)};
 S.erase=(x,y)=>{x=Math.round(x);y=Math.round(y);if(x>=0&&y>=0&&x<AW&&y<AH){col[y*AW+x]=null;grp[y*AW+x]=0}};
 S.finish=()=>{
  const px=new Uint8ClampedArray(AW*AH*4);let x0=AW,y0=AH,x1=0,y1=0;
  const flatG=g=>g&&gm[g].flat;
  const same=(x,y,g)=>{if(!has(x,y))return false;const h=grp[y*AW+x];return h===g||flatG(h)};
  const out=new Array(N).fill(null);
  for(let y=0;y<AH;y++)for(let x=0;x<AW;x++){
   const i=y*AW+x;if(!col[i])continue;const g=grp[i],m=gm[g];let c=col[i];
   if(!m.flat){
    let front=false;
    for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const X=x+dx,Y=y+dy;if(!has(X,Y))continue;const j=Y*AW+X,h=grp[j];if(h!==g&&!flatG(h)&&zz[j]>zz[i]){front=true;break}}
    const rose=m.skin?ROSE:null;
    if(front&&!m.noContour)c=sh(c,-.3,rose);
    else{
     let k=0;
     if(!same(x,y-1,g))k=m.hi==null?.17:m.hi;else if(!same(x,y-2,g))k=.07;
     if(!same(x,y+1,g))k=m.lo==null?-.2:m.lo;else if(!same(x,y+2,g))k=Math.min(k,-.08);
     if(!same(x+1,y,g))k-=.09;if(!same(x-1,y,g))k+=.05;
     if(k)c=sh(c,k,rose);
    }
   }
   out[i]=c;
  }
  for(let y=0;y<AH;y++)for(let x=0;x<AW;x++){
   const i=y*AW+x;let c=out[i];
   if(!c){if(has(x-1,y)||has(x+1,y)||has(x,y-1)||has(x,y+1))c=OUT;else continue}
   const o=i*4;px[o]=c[0];px[o+1]=c[1];px[o+2]=c[2];px[o+3]=255;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
  }
  return{w:AW,h:AH,px,bb:{x0,y0,x1:x1+1,y1:y1+1}};
 };
 return S;
}

// ------------------------------------------------------------------------------------------------
// generator
// ------------------------------------------------------------------------------------------------
const norm=av=>Object.assign({},D.defaults('x'),av||{});
const contrast=(c,list)=>{let best=list[0],bd=-1;const dist=l=>Math.abs(l[0]-c[0])+Math.abs(l[1]-c[1])+Math.abs(l[2]-c[2]);for(const l of list){if(dist(l)>=170)return l;const d=dist(l);if(d>bd){bd=d;best=l}}return best};
const PAT={heart:['.#.#.','#####','.###.','..#..'],star:['...#...','...#...','..###..','#######','.#####.','..###..','.##.##.'],paw:['.#.#.','#...#','.###.','#####','.###.']};
const FLAT=g=>[g,{flat:true}];
const sk=n=>[n,{skin:true}];
const GOLD=[255,208,72],STRAW=[238,204,126],WHITE=[255,255,255],K=[38,26,30];

function gen(avIn,view,pose,fr,opt){
 const av=norm(avIn);opt=opt||{};
 const S=surface();
 const SK=hexc(D.SKIN[av.sk]||D.SKIN[2]),HC=hexc(D.HAIRC[av.hc]||D.HAIRC[0]),IR=hexc(D.EYEC[av.ec]||D.EYEC[0]),
  TC=hexc(D.TOPC[av.tc]||D.TOPC[0]),BC=hexc(D.BOTC[av.bc]||D.BOTC[0]),SC=hexc(D.SHOEC[av.sc]||D.SHOEC[0]),HK=hexc(D.TOPC[av.hk]||D.TOPC[0]),XK=hexc(D.TOPC[av.xk]||D.TOPC[0]);
 const BLUSH=mix(SK,[255,96,132],.55),MOUTH=[128,44,58],TONG=[255,122,146],FRK=mix(SK,[150,80,50],.45);
 const P=pose,FRN=fr|0,side=!FRONT[pose];
 const info={hand:{x:AX,y:34},top:2};
 // ---- pose ----
 let up=0,blink=false,wave=false,happy=false;const hold=opt.hold||null;
 if(P==='idle'){up=[0,0,0,0,1,1,1,0][FRN%8];blink=FRN%8===3}
 else if(P==='wave'){wave=true;up=FRN%2}
 else if(P==='happy'){happy=true;up=FRN%2?0:1}
 const swing=P==='walk'?[1,0,-1,0][FRN%4]:0,bobS=P==='walk'?[0,1,0,1][FRN%4]:(P==='stand'?[0,1][FRN%2]:0);
 const U=side?-bobS:-up;
 const TY=27,HIP=36;
 // shifted drawing API (upper body moves with breathing)
 const mkH=dy=>({
  px:(x,y,c,g)=>S.px(x,y+dy,c,g),rect:(x,y,w,h,c,g,k)=>S.rect(x,y+dy,w,h,c,g,k&&((a,b)=>k(a,b-dy))),
  ell:(cx,cy,rx,ry,c,g,k)=>S.ell(cx,cy+dy,rx,ry,c,g,k&&((a,b)=>k(a,b-dy))),sq:(cx,cy,rx,ry,n,c,g,k)=>S.sq(cx,cy+dy,rx,ry,n,c,g,k&&((a,b)=>k(a,b-dy))),
  cap:(x0,y0,x1,y1,r,c,g,r1)=>S.cap(x0,y0+dy,x1,y1+dy,r,c,g,r1),poly:(pts,c,g)=>S.poly(pts.map(p=>[p[0],p[1]+dy]),c,g),
  paint:(x,y,c)=>S.paint(x,y+dy,c),paintRect:(x,y,w,h,c)=>S.paintRect(x,y+dy,w,h,c),paintIf:(x,y,c,n)=>S.paintIf(x,y+dy,c,n),shadeCell:(x,y,k,r)=>S.shadeCell(x,y+dy,k,r),erase:(x,y)=>S.erase(x,y+dy)});
 const H=mkH(U);
 // draw a char map with palette (flat details)
 const MAP=(h,x0,y0,rows,pal,g)=>rows.forEach((r,j)=>{for(let i=0;i<r.length;i++){const c=pal[r[i]];if(c)h.px(x0+i,y0+j,c,g)}});
 const lerp=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
 // ===================================================================================================
 //  FACE (front)
 // ===================================================================================================
 function eyesFront(){
  const mode=blink?'closed':happy?'happy':av.e,f=FLAT('!e');
  const pal={K,W:WHITE,I:mix(IR,[0,0,0],.15),i:mix(IR,WHITE,.35),J:IR};
  const E={
   dot:{w:2,y:18,m:['KW','KK','KK']},
   round:{w:3,y:17,m:['KKK','KWI','III','.iI']},
   sleepy:{w:3,y:19,m:['KKK','JJJ']},
   happy:{w:3,y:19,m:['.K.','K.K']},
   sparkle:{w:3,y:17,m:['KKK','KWI','IiW','.I.']},
   cat:{w:3,y:18,m:['.KK','IKI','.I.']},
   closed:{w:3,y:20,m:['KKK']}};
  const e=E[mode]||E.dot;
  const xs=e.w===2?[18,25]:[18,24];
  xs.forEach((x0,s)=>{let m=e.m;if(mode==='cat'&&s===0)m=['KK.','IKI','.I.'];MAP(H,x0,e.y,m,pal,f)});
  // lashes for sparkle
  if(mode==='sparkle'||mode==='round'){H.px(17,17,K,f);H.px(27,17,K,f)}
 }
 function mouthFront(){
  const f=FLAT('!m'),m=happy&&av.m==='flat'?'smile':av.m;
  if(m==='smile'){H.px(21,22,MOUTH,f);H.px(22,23,MOUTH,f);H.px(23,22,MOUTH,f)}
  else if(m==='grin'||happy&&m!=='wow'){MAP(H,20,22,['KWWWK','.KTK.'],{K:MOUTH,W:WHITE,T:TONG},f)}
  else if(m==='cat'){H.px(20,22,MOUTH,f);H.px(21,23,MOUTH,f);H.px(22,22,MOUTH,f);H.px(23,23,MOUTH,f);H.px(24,22,MOUTH,f)}
  else if(m==='flat'){H.px(21,22,MOUTH,f);H.px(22,22,MOUTH,f);H.px(23,22,MOUTH,f)}
  else if(m==='wow'){H.px(22,22,MOUTH,f);H.px(22,23,TONG,f)}
 }
 function cheeksFront(){
  const f=FLAT('!c');
  if(av.bl){H.px(16,21,BLUSH,f);H.px(17,21,BLUSH,f);H.px(27,21,BLUSH,f);H.px(28,21,BLUSH,f);H.px(16,22,mix(BLUSH,SK,.5),f);H.px(28,22,mix(BLUSH,SK,.5),f)}
  if(av.fr){for(const[x,y]of[[18,22],[20,22],[19,23],[24,22],[26,22],[25,23]])H.px(x,y,FRK,f)}
 }
 // ===================================================================================================
 //  HAIR (front)
 // ===================================================================================================
 const HB=sh(HC,-.16);
 function hairCap(hl,o){o=o||{};H.sq(22,o.cy??15,o.rx??8.6,o.ry??8,o.n??2.3,HC,['hairF'],(x,y)=>y<hl(x))}
 const dxs=x=>Math.abs(x-22);
 const byD=(a,b,c,d)=>x=>{const q=dxs(x);return q>=6?d:q===5?c:q===4?b:a};
 function sheen(){const c=sh(HC,.3);for(const[x,y]of[[17,9],[18,9],[19,9],[20,9],[16,10],[21,9],[22,9],[23,10]])H.paintIf(x,y,c,'hairF')}
 function spike(cx,by,w,h,lean){for(let j=0;j<h;j++){const ww=Math.max(1,Math.round(w*(1-j/h))),x0=Math.round(cx-(ww-1)/2+lean*j/h);H.rect(x0,by-j,ww,1,HC,['hairF'])}}
 function hairBack(){
  const g=['hairB'],c=HB;
  switch(av.h){
   case 'bob':H.rect(13,14,19,11,c,g);H.rect(14,25,17,1,c,g);break;
   case 'long':H.rect(13,14,19,21,c,g);H.rect(14,35,17,1,c,g);H.rect(15,36,13,1,c,g);break;
   case 'twin':
    H.cap(14,13,11,17,2.6,c,g,2.0);H.cap(11,17,10.5,23,2,c,g,1.6);H.cap(10.5,23,11,28,1.6,c,g,1.0);
    H.cap(30,13,33,17,2.6,c,g,2.0);H.cap(33,17,33.5,23,2,c,g,1.6);H.cap(33.5,23,33,28,1.6,c,g,1.0);break;
   case 'ponytail':
    H.cap(26,9,30,10,2.2,c,g,2.4);H.cap(30,10,33,15,2.4,c,g,2.4);H.cap(33,15,33,21,2.4,c,g,1.8);H.cap(33,21,31,26,1.8,c,g,1.0);break;
   case 'bun':H.ell(22,4.5,3.9,3.5,c,g);break;
   case 'curly':break;
  }
 }
 function hairFront(){
  const g=['hairF'],tie=mix(TC,WHITE,.1);
  switch(av.h){
   case 'short':hairCap(byD0(15,16,17,19));sheen();break;
   case 'sidepart':hairCap(x=>{const q=dxs(x);if(q>=6)return 19;if(q===5)return 17;return x<=19?14:Math.min(17,14+Math.ceil((x-19)*.45))});sheen();
    for(const[x,y]of[[19,8],[19,9],[20,10],[20,11]])H.paintIf(x,y,sh(HC,-.3),'hairF');break;
   case 'spiky':hairCap(byD0(15,16,17,19));spike(16,8,4,5,-1);spike(19.5,7,4,6,-.5);spike(23,7,4,7,0);spike(26.5,8,4,5,1);spike(29,10,3,3,1.5);spike(14,11,3,3,-1.5);sheen();break;
   case 'messy':hairCap(x=>{const q=dxs(x);if(q>=6)return 19;return 15+((x*7)%3===0?1:0)-((x*5)%4===0?1:0)});
    H.ell(15,10,2.4,1.8,HC,g);H.ell(29.5,9,2.4,2.2,HC,g);H.ell(22,6,3.2,1.6,HC,g);H.ell(25.5,6.5,2,1.4,HC,g);sheen();break;
   case 'bowl':hairCap(x=>{const q=dxs(x);return q>=7?20:q===6?18:16},{ry:8.2});sheen();break;
   case 'bob':hairCap(x=>{const q=dxs(x);return q>=6?15:q===5?16:16});
    H.rect(13,15,3,10,HC,g);H.rect(29,15,3,10,HC,g);H.erase(13,24);H.erase(31,24);H.px(16,24,HC,g);H.px(28,24,HC,g);H.px(16,23,HC,g);H.px(28,23,HC,g);sheen();break;
   case 'long':hairCap(x=>{const q=dxs(x);return q>=6?15:q===5?16:q<=1?15:16});
    H.rect(13,15,3,17,HC,g);H.rect(29,15,3,17,HC,g);H.rect(14,32,2,1,HC,g);H.rect(29,32,2,1,HC,g);sheen();break;
   case 'ponytail':hairCap(x=>{const q=dxs(x);if(q>=6)return 19;if(q===5)return 17;return x<=19?14:Math.min(17,14+Math.ceil((x-19)*.45))});
    H.rect(27,8,3,2,tie,['!tie',{flat:true}]);sheen();break;
   case 'bun':hairCap(byD0(15,16,17,19));H.rect(19,7,7,1,tie,['!tie',{flat:true}]);sheen();break;
   case 'pixie':hairCap(x=>{const q=dxs(x);if(q>=6)return 17;if(q===5)return 16;return x<=20?14:Math.min(17,14+Math.ceil((x-20)*.5))},{cy:14.5,ry:7.6,rx:8.2});spike(19,7,3,2,-1);spike(25,7,3,3,1);sheen();break;
   case 'twin':hairCap(x=>{const q=dxs(x);return q>=6?18:16});H.rect(12,12,3,2,tie,['!tie',{flat:true}]);H.rect(30,12,3,2,tie,['!tie',{flat:true}]);sheen();break;
   case 'curly':H.sq(22,12.5,10.2,8.8,2.2,HC,g,(x,y)=>y<(dxs(x)>=9?19:dxs(x)>=7?17:16));
    for(const[x,y,r]of[[13,12,2.2],[31,12,2.2],[12.5,16,1.8],[31.5,16,1.8],[15,6.5,2.4],[29,6.5,2.4],[22,3.8,3.2],[18.5,4.3,2.5],[25.5,4.3,2.5]])H.ell(x,y,r,r,HC,g);sheen();break;
   case 'braid':hairCap(x=>{const q=dxs(x);if(q>=6)return 19;if(q===5)return 17;return x<=19?14:Math.min(17,14+Math.ceil((x-19)*.45))});
    for(let j=0;j<6;j++){H.ell(30.5,19+j*2.6,2,1.7,j%2?sh(HC,-.12):HC,['braid']);}
    H.rect(29,34,3,2,tie,['!tie',{flat:true}]);sheen();break;
   default:hairCap(byD0(15,16,17,19));sheen();
  }
 }
 function byD0(a,b,c,d){return byD(a,b,c,d)}
 // ===================================================================================================
 //  HATS / GLASSES / BACK EXTRAS (front)
 // ===================================================================================================
 const FL=(n)=>FLAT(n);
 function ringCells(h,cx,cy,rx,ry,lo,c,g){for(let y=Math.floor(cy-ry-1);y<=Math.ceil(cy+ry+1);y++)for(let x=Math.floor(cx-rx-1);x<=Math.ceil(cx+rx+1);x++){const dx=(x-cx)/(rx+.35),dy=(y-cy)/(ry+.35),r=dx*dx+dy*dy;if(r<=1&&r>=lo)h.px(x,y,c,g)}}
 function spikeUp(h,cx,by,h2,c,g){for(let k=0;k<h2;k++){const w=Math.max(1,3-Math.floor(k*3/h2));h.rect(Math.round(cx-(w-1)/2),by-k,w,1,c,g)}}
 function hatFront(){
  const HT=av.ht;if(HT==='none')return;
  const hg=['hat'],hd=sh(HK,-.22);
  switch(HT){
   case'cap':
    H.sq(22,10.5,8.9,5.6,2.2,HK,hg,(x,y)=>y<=12);H.rect(14,12,17,1,hd,['hatband']);
    H.rect(14,13,17,1,sh(HK,-.18),['visor']);H.rect(15,14,15,1,sh(HK,-.3),['visor']);H.rect(17,15,11,1,sh(HK,-.45),['visor']);
    for(let y=6;y<=11;y++)H.paintIf(22,y,sh(HK,-.16),'hat');H.px(22,4,sh(HK,.4),FL('!btn'));
    H.rect(21,8,3,2,sh(HK,.55),FL('!logo'));break;
   case'beanie':
    H.sq(22,10.5,9.2,6,2.1,HK,hg,(x,y)=>y<=13);H.rect(13,11,19,3,sh(HK,.1),['cuff']);for(let x=13;x<=31;x+=2)H.paintRect(x,11,1,3,sh(HK,-.14));
    H.ell(22,3.4,2.8,2.6,sh(HK,.32),['pom']);H.px(20,3,sh(HK,.6),FL('!pf'));break;
   case'bow':
    H.ell(24,8.5,3,2.6,HK,hg);H.ell(30.5,8.5,3,2.6,HK,hg);H.rect(26,7,3,3,sh(HK,-.15),['knot']);H.rect(25,10,2,3,HK,['tailL']);H.rect(28,10,2,3,HK,['tailR']);
    H.px(23,7,sh(HK,.5),FL('!bh'));H.px(30,7,sh(HK,.5),FL('!bh'));break;
   case'party':{
    const c2=[255,236,140];H.poly([[16.5,10.5],[28.5,10.5],[23,0.5]],HK,hg);
    for(let y=1;y<=10;y++)for(let x=16;x<=29;x++)if(((x+y)>>1)%2===0)H.paintIf(x,y,c2,'hat');
    H.ell(23,1,1.5,1.5,[255,150,190],['pom']);H.rect(16,10,13,1,sh(HK,-.2),['hatband']);break}
   case'straw':
    H.sq(22,7.6,6.6,4.8,2.2,STRAW,['hatcrown'],(x,y)=>y<=11);H.ell(22,11.6,12,2.3,STRAW,hg,(x,y)=>y>=9);
    H.rect(16,9,13,2,HK,['hatband']);for(let y=4;y<=14;y++)for(let x=10;x<=34;x++)if((x+y*2)%5===0)H.paintIf(x,y,sh(STRAW,-.1),'hat');break;
   case'flowers':{
    const cols=[[255,140,175],[255,255,255],[190,160,255],[255,214,80],[255,140,175]],xs=[15.5,19,22,25,28.5];
    const yy=x=>9.6+Math.pow((x-22)/7.3,2)*3.2;
    for(const x of[17.2,20.5,23.6,26.8])H.rect(Math.round(x),Math.round(yy(x)),2,1,[84,184,116],['!leaf',{flat:true}]);
    xs.forEach((x,i)=>{const y=Math.round(yy(x)),c=cols[i];for(const[dx,dy]of[[-1,0],[1,0],[0,-1],[0,1]])H.px(Math.round(x)+dx,y+dy,c,FL('!pt'));H.px(Math.round(x),y,i===3?WHITE:[255,220,100],FL('!pc'))});break}
   case'phones':{
    const dk=sh(HK,-.42);for(let a=0;a<=40;a++){const t=Math.PI*a/40,x=22+9.9*Math.cos(t),y=14-8.9*Math.sin(t);H.ell(x,y,.9,.9,dk,['band'])}
    for(const x0 of[11,30]){H.rect(x0,15,4,7,HK,['cup'+x0]);H.paintRect(x0+(x0<20?1:1),16,2,5,sh(HK,-.3));H.px(x0+(x0<20?0:3),15,sh(HK,.5),FL('!ch'))}break}
   case'bunny':
    H.cap(19,8,17,1,1.7,HK,['earL']);H.cap(19,7,17.2,2.2,.7,[255,176,196],['!inL',{flat:true}]);
    H.cap(25,8,27.4,2.5,1.7,HK,['earR']);H.cap(27.4,2.5,29.6,2,1.5,HK,['earR']);H.cap(25,7,27.2,3.4,.7,[255,176,196],['!inR',{flat:true}]);break;
   case'cat':
    H.poly([[14.5,11],[14.5,3.5],[21.5,8]],HK,['earL']);H.poly([[30.5,11],[30.5,3.5],[23.5,8]],HK,['earR']);
    H.poly([[16,10],[16,6.2],[19.6,8.2]],[255,176,196],['!inL',{flat:true}]);H.poly([[29,10],[29,6.2],[25.4,8.2]],[255,176,196],['!inR',{flat:true}]);break;
   case'halo':ringCells(H,22,3.3,7.2,2.2,.42,[255,226,120],['halo',{noContour:true}]);for(const x of[17,18,19,20])H.px(x,1,[255,250,200],FL('!hh'));H.px(30,1,WHITE,FL('!sp'));H.px(30,0,[255,246,190],FL('!sp'));H.px(30,2,[255,246,190],FL('!sp'));H.px(29,1,[255,246,190],FL('!sp'));H.px(31,1,[255,246,190],FL('!sp'));break;
   case'crown':{
    H.rect(15,8,15,3,GOLD,['crown']);
    [[16,3],[19,4],[22,5],[25,4],[28,3]].forEach(([x,h2])=>spikeUp(H,x,7,h2,GOLD,['crown']));
    H.paintRect(15,10,15,1,sh(GOLD,-.2));H.px(22,9,[235,70,90],FL('!j'));H.px(18,9,[90,170,255],FL('!j'));H.px(26,9,[90,170,255],FL('!j'));
    [[16,3],[19,4],[22,5],[25,4],[28,3]].forEach(([x,h2])=>H.px(x,7-h2+1,[255,246,190],FL('!tp')));break}
  }
 }
 function glassesFront(){
  const G=av.g;if(G==='none')return;const f=FL('!gl'),fc=[58,40,52];
  const lensTint=mix(SK,[205,232,255],.32);
  const tint=(x0,y0,w,h)=>{for(let j=0;j<h;j++)for(let i=0;i<w;i++)H.paintIf(x0+i,y0+j,lensTint,'face')};
  if(G==='round'){for(const x0 of[16,23]){MAP(H,x0,16,['.####.','#....#','#....#','#....#','#....#','.####.'],{'#':fc},f);tint(x0+1,17,4,4)}H.px(22,18,fc,f);H.px(15,18,fc,f);H.px(29,18,fc,f)}
  else if(G==='square'){for(const x0 of[16,23]){MAP(H,x0,16,['######','#....#','#....#','#....#','#....#','######'],{'#':fc},f);tint(x0+1,17,4,4)}H.px(22,17,fc,f);H.px(15,17,fc,f);H.px(29,17,fc,f)}
  else if(G==='shades'){for(const x0 of[16,23])MAP(H,x0,16,['######','#SSSS#','#SWSS#','#SSSS#','.####.'],{'#':[30,30,42],S:[44,48,72],W:[150,180,230]},f);H.rect(22,16,1,1,[30,30,42],f);H.px(15,17,[30,30,42],f);H.px(29,17,[30,30,42],f)}
  else if(G==='heart'){const hc=[255,84,134],ol=[150,36,76];for(const x0 of[15,23])MAP(H,x0,15,['.OO.OO.','OHHOHHO','OHRRRRO','.ORRRO.','..ORO..','...O...'],{O:ol,H:[255,196,222],R:hc},f)}
 }
 function extraBack(){
  const EX=av.x;
  if(EX==='backpack'){S.rect(14,28+U,17,9,XK,['pack']);S.paintRect(14,28+U,17,2,sh(XK,.15));S.paintRect(14,32+U,2,3,sh(XK,-.18));S.paintRect(29,32+U,2,3,sh(XK,-.18));S.rect(19,26+U,7,2,sh(XK,-.25),['packH'])}
  if(EX==='wings'){
   const W=[255,255,255],fl=up?-1:0;
   for(const s of[0,1]){
    const X=x=>s?44-x:x,tint=[200,224,255];
    S.cap(X(17),30+U,X(5),16+fl+U,2.2,sh(W,-.03),['w1'+s],3.4);
    S.cap(X(17),32+U,X(4),24+fl+U,1.9,sh(W,-.06),['w2'+s],3);
    S.cap(X(17),34+U,X(7),31+fl+U,1.5,tint,['w3'+s],2.3);
   }
  }
 }
 // ===================================================================================================
 //  SIDE VIEW (facing right, 3/4 face)
 // ===================================================================================================
 function eyesSide(){
  const mode=blink?'closed':happy?'happy':av.e,f=FLAT('!e');
  const pal={K,W:WHITE,I:mix(IR,[0,0,0],.15),i:mix(IR,WHITE,.35),J:IR};
  const E={dot:{w:2,y:18,m:['KW','KK','KK']},round:{w:3,y:17,m:['KKK','KWI','III','.iI']},sleepy:{w:3,y:19,m:['KKK','JJJ']},happy:{w:3,y:19,m:['.K.','K.K']},
   sparkle:{w:3,y:17,m:['KKK','KWI','IiW','.I.']},cat:{w:3,y:18,m:['.KK','IKI','.I.']},closed:{w:3,y:20,m:['KKK']}};
  const e=E[mode]||E.dot;
  MAP(H,e.w===2?22:21,e.y,e.m,pal,f);                                  // near eye
  const far=e.m.map(r=>r.slice(1));MAP(H,e.w===2?27:26,e.y,far,pal,f);       // far eye (foreshortened)
  if(mode==='sparkle'||mode==='round')H.px(20,17,K,f);
 }
 function mouthSide(){
  const f=FLAT('!m'),m=happy&&av.m==='flat'?'smile':av.m;
  if(m==='grin'||happy&&m!=='wow'){MAP(H,24,22,['KWWK','.KT.'],{K:MOUTH,W:WHITE,T:TONG},f)}
  else if(m==='flat'){H.px(25,22,MOUTH,f);H.px(26,22,MOUTH,f);H.px(27,22,MOUTH,f)}
  else if(m==='wow'){H.px(26,22,MOUTH,f);H.px(26,23,TONG,f)}
  else{H.px(25,22,MOUTH,f);H.px(26,23,MOUTH,f);H.px(27,22,MOUTH,f);if(m==='cat'){H.px(28,22,MOUTH,f)}}
 }
 function cheeksSide(){
  const f=FLAT('!c');
  if(av.bl){H.px(23,21,BLUSH,f);H.px(24,21,BLUSH,f);H.px(28,21,BLUSH,f)}
  if(av.fr){for(const[x,y]of[[21,22],[23,22],[22,23]])H.px(x,y,FRK,f)}
 }
 const hlS=(bk,fr,ear)=>x=>x<=17?bk:x<=19?ear:x<=22?15:fr(x);
 const sway=P==='walk'?[0,1,0,-1][FRN%4]:0;
 function hairBackSide(){
  const g=['hairB'],c=HB;
  switch(av.h){
   case'bob':H.rect(13,14,7,11,c,g);H.rect(14,25,5,1,c,g);break;
   case'long':H.rect(12,14,8,21,c,g);H.rect(13,35,6,1,c,g);H.rect(14,36,4,1,c,g);break;
   case'ponytail':H.cap(17,9,12.5,10,2.2,c,g,2.4);H.cap(12.5,10,10+sway,15,2.4,c,g,2.4);H.cap(10+sway,15,10.5+sway*1.5,21,2.4,c,g,1.8);H.cap(10.5+sway*1.5,21,11+sway*2,26,1.8,c,g,1);break;
   case'twin':H.cap(16,13,12,17,2.6,c,g,2);H.cap(12,17,12+sway,24,2,c,g,1.2);break;
   case'braid':for(let j=0;j<7;j++)H.ell(15.5+(sway*j*.18),17+j*2.5,2,1.7,j%2?sh(HC,-.28):HB,['braid']);H.rect(Math.round(14.5+sway),35,3,2,mix(TC,WHITE,.1),['!tie',{flat:true}]);break;
  }
 }
 function hairFrontSide(){
  const g=['hairF'],tie=mix(TC,WHITE,.1);
  const cap=(hl,o)=>{o=o||{};H.sq(o.cx??21.4,o.cy??15,o.rx??8.7,o.ry??8.1,o.n??2.3,HC,g,(x,y)=>y<hl(x))};
  const sw0=x=>x<=24?15:Math.min(17,15+Math.ceil((x-24)*.5));
  const sheenS=()=>{const c=sh(HC,.3);for(const[x,y]of[[17,9],[18,9],[19,9],[20,9],[21,9],[16,10],[22,10],[15,11]])H.paintIf(x,y,c,'hairF')};
  switch(av.h){
   case'short':cap(hlS(20,x=>16,18));sheenS();break;
   case'sidepart':cap(hlS(21,sw0,19));for(const[x,y]of[[24,8],[24,9],[25,10],[25,11]])H.paintIf(x,y,sh(HC,-.3),'hairF');sheenS();break;
   case'spiky':cap(hlS(21,x=>16,19));spike(15,9,4,5,-2);spike(19,7,4,6,-1);spike(23,7,4,6,0);spike(27,9,4,4,1.5);sheenS();break;
   case'messy':cap(hlS(21,x=>15+((x*7)%3===0?1:0),19));H.ell(14,11,2.4,2,HC,g);H.ell(29,9,2.2,2,HC,g);H.ell(20,6,3.2,1.6,HC,g);H.ell(24.5,6.5,2,1.4,HC,g);sheenS();break;
   case'bowl':cap(hlS(20,x=>16,20),{ry:8.2});sheenS();break;
   case'bob':cap(hlS(22,x=>16,22));H.rect(16,15,5,9,HC,g);H.erase(16,23);H.px(20,24,HC,g);sheenS();break;
   case'long':cap(hlS(22,x=>x<=24?15:16,22));H.rect(15,15,5,17,HC,g);H.erase(15,31);H.erase(15,30);sheenS();break;
   case'ponytail':cap(hlS(21,sw0,19));H.rect(15,8,3,2,tie,['!tie',{flat:true}]);sheenS();break;
   case'bun':cap(hlS(21,x=>16,19));H.ell(19,5,3.6,3.4,HC,['hairF']);H.rect(16,8,6,1,tie,['!tie',{flat:true}]);sheenS();break;
   case'pixie':cap(hlS(18,sw0,17),{cy:14.5,ry:7.6,rx:8.4});spike(18,7,3,2,-1);spike(24,7,3,3,1);sheenS();break;
   case'twin':cap(hlS(20,x=>16,19));H.cap(18,13,17.5,19,2.2,HC,['tailN'],1.8);H.cap(17.5,19,17+sway*.5,26,1.8,HC,['tailN'],1.1);H.rect(16,12,3,2,tie,['!tie',{flat:true}]);sheenS();break;
   case'curly':H.sq(21,12.5,10.4,8.8,2.2,HC,g,(x,y)=>y<(x<=17?19:x<=19?18:x<=22?16:x<=26?16:17));
    for(const[x,y,r]of[[12.5,12,2.2],[30,12,2.2],[12,16,1.8],[30,16,1.6],[14.5,6.5,2.4],[28,6.5,2.4],[21,3.8,3.2],[17.5,4.3,2.5],[24.5,4.3,2.5]])H.ell(x,y,r,r,HC,g);sheenS();break;
   case'braid':cap(hlS(21,sw0,19));sheenS();break;
   default:cap(hlS(21,x=>16,19));sheenS();
  }
 }
 function hatSide(){
  const HT=av.ht;if(HT==='none')return;
  const hg=['hat'],cx=21.5;
  switch(HT){
   case'cap':H.sq(cx,10.5,8.9,5.6,2.2,HK,hg,(x,y)=>y<=12);H.rect(13,12,18,1,sh(HK,-.22),['hatband']);H.rect(26,12,8,2,sh(HK,-.2),['visor']);H.rect(27,14,6,1,sh(HK,-.4),['visor']);H.px(cx,4,sh(HK,.4),FL('!btn'));
    for(let y=6;y<=11;y++)H.paintIf(24,y,sh(HK,-.16),'hat');break;
   case'beanie':H.sq(cx,10.5,9.2,6,2.1,HK,hg,(x,y)=>y<=13);H.rect(12,11,19,3,sh(HK,.1),['cuff']);for(let x=12;x<=30;x+=2)H.paintRect(x,11,1,3,sh(HK,-.14));H.ell(cx-1,3.4,2.8,2.6,sh(HK,.32),['pom']);break;
   case'bow':H.ell(16,8.5,3,2.6,HK,hg);H.ell(21.5,8.5,3,2.6,HK,hg);H.rect(18,7,3,3,sh(HK,-.15),['knot']);H.rect(17,10,2,3,HK,['tailL']);H.rect(20,10,2,3,HK,['tailR']);break;
   case'party':{const c2=[255,236,140];H.poly([[15.5,10.5],[27.5,10.5],[21,0.5]],HK,hg);for(let y=1;y<=10;y++)for(let x=15;x<=28;x++)if(((x+y)>>1)%2===0)H.paintIf(x,y,c2,'hat');H.ell(21,1,1.5,1.5,[255,150,190],['pom']);H.rect(15,10,13,1,sh(HK,-.2),['hatband']);break}
   case'straw':H.sq(cx,7.6,6.6,4.8,2.2,STRAW,['hatcrown'],(x,y)=>y<=11);H.ell(cx,11.6,12,2.3,STRAW,hg,(x,y)=>y>=9);H.rect(15,9,13,2,HK,['hatband']);for(let y=4;y<=14;y++)for(let x=9;x<=34;x++)if((x+y*2)%5===0)H.paintIf(x,y,sh(STRAW,-.1),'hat');break;
   case'flowers':{const cols=[[255,140,175],[255,255,255],[190,160,255],[255,214,80],[255,140,175]],xs=[14.5,18,21.5,25,28.5];const yy=x=>9.6+Math.pow((x-21.5)/7.6,2)*3.4;
    for(const x of[16.2,19.6,23.2,26.8])H.rect(Math.round(x),Math.round(yy(x)),2,1,[84,184,116],['!leaf',{flat:true}]);
    xs.forEach((x,i)=>{const y=Math.round(yy(x)),c=cols[i];for(const[dx,dy]of[[-1,0],[1,0],[0,-1],[0,1]])H.px(Math.round(x)+dx,y+dy,c,FL('!pt'));H.px(Math.round(x),y,i===3?WHITE:[255,220,100],FL('!pc'))});break}
   case'phones':{const dk=sh(HK,-.42);for(let a=0;a<=40;a++){const t=Math.PI*a/40,x=21.5+9.2*Math.cos(t),y=14-8.9*Math.sin(t);H.ell(x,y,.9,.9,dk,['band'])}
    H.rect(17,15,5,7,HK,['cup']);H.paintRect(18,16,3,5,sh(HK,-.3));H.px(17,15,sh(HK,.5),FL('!ch'));break}
   case'bunny':H.cap(18,8,14.5,1.5,1.7,HK,['earL']);H.cap(18,7,14.9,2.6,.7,[255,176,196],['!inL',{flat:true}]);H.cap(22,8,23,2.5,1.7,sh(HK,-.1),['earR']);H.cap(23,2.5,25.5,2.5,1.5,sh(HK,-.1),['earR']);break;
   case'cat':H.poly([[13.5,11],[13.5,3.5],[20.5,8]],HK,['earL']);H.poly([[16,10],[16,6.2],[19.4,8.2]],[255,176,196],['!inL',{flat:true}]);H.poly([[22,8],[27,3.8],[28,10.5]],sh(HK,-.12),['earR']);break;
   case'halo':ringCells(H,21.5,3.3,7.2,2.2,.42,[255,226,120],['halo',{noContour:true}]);for(const x of[16,17,18,19])H.px(x,1,[255,250,200],FL('!hh'));H.px(29,1,WHITE,FL('!sp'));H.px(29,0,[255,246,190],FL('!sp'));H.px(29,2,[255,246,190],FL('!sp'));H.px(28,1,[255,246,190],FL('!sp'));H.px(30,1,[255,246,190],FL('!sp'));break;
   case'crown':{H.rect(14,8,15,3,GOLD,['crown']);[[15,3],[18,4],[21,5],[24,4],[27,3]].forEach(([x,h2])=>spikeUp(H,x,7,h2,GOLD,['crown']));H.paintRect(14,10,15,1,sh(GOLD,-.2));H.px(21,9,[235,70,90],FL('!j'));H.px(17,9,[90,170,255],FL('!j'));H.px(25,9,[90,170,255],FL('!j'));break}
  }
 }
 function glassesSide(){
  const G=av.g;if(G==='none')return;const f=FL('!gl'),fc=[58,40,52],lensTint=mix(SK,[205,232,255],.32);
  const tint=(x0,y0,w,h)=>{for(let j=0;j<h;j++)for(let i=0;i<w;i++)H.paintIf(x0+i,y0+j,lensTint,'face')};
  if(G==='round'){MAP(H,20,16,['.####.','#....#','#....#','#....#','#....#','.####.'],{'#':fc},f);tint(21,17,4,4);MAP(H,26,16,['###','#..','#..','#..','###'].map(r=>r),{'#':fc},f);H.px(26,16,fc,f);for(let x=15;x<20;x++)H.px(x,18,fc,f)}
  else if(G==='square'){MAP(H,20,16,['######','#....#','#....#','#....#','#....#','######'],{'#':fc},f);tint(21,17,4,4);MAP(H,26,16,['###','#..','#..','###'],{'#':fc},f);for(let x=15;x<20;x++)H.px(x,17,fc,f)}
  else if(G==='shades'){MAP(H,20,16,['######','#SSSS#','#SWSS#','#SSSS#','.####.'],{'#':[30,30,42],S:[44,48,72],W:[150,180,230]},f);MAP(H,26,16,['###','#SS','#SS','.##'],{'#':[30,30,42],S:[44,48,72]},f);for(let x=15;x<20;x++)H.px(x,17,[30,30,42],f)}
  else if(G==='heart'){const hc=[255,84,134],ol=[150,36,76];MAP(H,19,15,['.OO.OO.','OHHOHHO','OHRRRRO','.ORRRO.','..ORO..','...O...'],{O:ol,H:[255,196,222],R:hc},f);MAP(H,26,16,['OO.','OHR','ORR','.OR'],{O:ol,H:[255,196,222],R:hc},f)}
 }
 function side_(){
  const TOP=av.t,BOT=av.b,SHOE=av.s,dress=TOP==='dress',over=TOP==='overalls',t0=TY+U;
  const sw=swing,nLift=P==='walk'&&FRN%4===3?1:0,fLift=P==='walk'&&FRN%4===1?1:0;
  const FSK=sh(SK,-.17,ROSE),dark=c=>sh(c,-.2);
  // ---- back extras / hair ----
  const EX=av.x;
  if(EX==='backpack'){S.rect(12,28+U,7,9,XK,['pack']);S.paintRect(12,28+U,7,2,sh(XK,.15));S.paintRect(12,33+U,2,3,sh(XK,-.18))}
  if(EX==='wings'){const W=[255,255,255],fl=bobS?-1:0;
   S.cap(19,30+U,8,15+fl+U,2.2,W,['w1'],3.4);S.cap(19,32+U,7,24+fl+U,1.9,sh(W,-.06),['w2'],3);S.cap(19,34+U,9,31+fl+U,1.5,[200,224,255],['w3'],2.3)}
  hairBackSide();
  // ---- far arm (behind torso) ----
  const farX=22.5+(P==='walk'?-sw*2.6:0),aSf=[22.5,t0+1.5],aHf=[farX,TY+7.5];
  const longSl={hoodie:1,sweater:1,jacket:1,rain:1,uniform:1}[TOP],noSl=TOP==='tank',slLen=noSl?0:longSl?.92:(TOP==='dress'?.3:.42);
  const slc=TOP==='overalls'?mix(TC,WHITE,.78):TC;
  S.cap(aSf[0],aSf[1],aHf[0],aHf[1],.9,FSK,sk('armF'));S.ell(aHf[0],aHf[1]+.2,1.2,1.2,FSK,sk('handF'));
  if(slLen>0){const P2=lerp(aSf,aHf,slLen);S.cap(aSf[0],aSf[1]-.3,P2[0],P2[1],1.0,dark(slc),['slvF'])}
  // ---- legs ----
  const nx=21+(P==='walk'?sw*3:0),fx=22-(P==='walk'?sw*3:0);
  const leg=(hx,fx_,lift,skin,gs)=>{S.cap(hx,HIP+1,fx_,43-lift,1.1,skin,sk(gs))};
  leg(22,fx,fLift,FSK,'legF');
  const shoe=(fx_,lift,far)=>{
   const g=['shoe'+(far?'F':'N')],c=far?dark(SC):SC,y=44-lift,sole=lum(SC)>200?[226,206,180]:[250,244,232];
   const sx=Math.round(fx_);
   if(SHOE==='sandal'){S.rect(sx-1,y+1,6,1,far?dark([168,124,88]):[168,124,88],g);S.rect(sx-1,y,6,1,far?FSK:SK,sk('foot'+(far?'F':'N')));S.rect(sx-1,y-1,3,1,c,['strap'+(far?'F':'N')])}
   else{
    if(SHOE==='sneaker')S.rect(sx-1,y-3,3,2,far?dark([246,246,252]):[246,246,252],['sock'+(far?'F':'N')]);
    if(SHOE==='boots')S.rect(sx-1,y-4,3,3,c,g);if(SHOE==='rain')S.rect(sx-1,y-5,3,4,c,g);
    S.rect(sx-1,y-1,3,1,c,g);S.rect(sx-1,y,6,2,c,g);S.erase(sx+4,y+1);S.paintRect(sx-1,y+1,6,1,SHOE==='sneaker'?(far?dark(sole):sole):sh(c,-.35));
    S.paint(sx+3,y,sh(c,.3));
   }
  };
  shoe(fx,fLift,true);
  leg(21,nx,nLift,SK,'legN');shoe(nx,nLift,false);
  // ---- bottoms ----
  if(!dress&&!over){
   const g=['bot'];
   if(BOT==='shorts'||BOT==='pants'||BOT==='jogger'){
    S.rect(18,HIP,8,2,BC,g);S.paintRect(18,HIP,8,1,sh(BC,-.1));
    const k=BOT==='shorts'?.32:.93,r=BOT==='jogger'?1.7:1.5;
    S.cap(22,HIP+1,22+(fx-22)*k,HIP+1+(43-fLift-HIP-1)*k,r,dark(BC),['botF']);
    S.cap(21,HIP+1,21+(nx-21)*k,HIP+1+(43-nLift-HIP-1)*k,r,BC,g);
    if(BOT==='jogger'){const cx2=21+(nx-21)*.93,cy2=HIP+1+(43-nLift-HIP-1)*.93;S.cap(cx2,cy2,cx2+(nx-21)*.04,cy2+.4,1.2,sh(BC,.25),['cuffN'])}
    if(BOT==='pants'){const cx2=21+(nx-21)*.93,cy2=HIP+1+(43-nLift-HIP-1)*.93;S.cap(cx2,cy2,cx2+(nx-21)*.04,cy2+.4,1.2,sh(BC,-.16),['cuffN'])}
   }else if(BOT==='skirt'||BOT==='pleat'){
    const h=BOT==='skirt'?40:41,fl=sway&&P==='walk'?sw:0;
    S.poly([[18,HIP],[26,HIP],[27.5+fl*.6,h],[16.5+fl*.6,h]],BC,g);S.paintRect(18,HIP,8,1,sh(BC,-.1));S.paintRect(16,h-1,13,1,BOT==='pleat'?sh(BC,.55):sh(BC,.18));
    for(const x of[19,21,23])for(let y=HIP+1;y<h-1;y++)S.paint(x+Math.round(fl*.3),y,sh(BC,-.13));
   }
  }
  // ---- torso ----
  const BW={hoodie:5,jacket:5,rain:5,sweater:5,uniform:5}[TOP]||4,xl=21.5-BW+.5,hem=({hoodie:HIP,sweater:HIP,jacket:HIP,uniform:HIP,rain:HIP+2})[TOP]||HIP-1,gt=['top'];
  const bl=Math.round(21.5-BW+.5+ (BW>4?-.5:0)),br=bl+(BW>4?9:7);   // body columns bl..br
  if(dress){S.rect(bl+1,t0,6,1,TC,gt);S.rect(bl,t0+1,8,5,TC,gt);S.poly([[bl,t0+6],[bl+8,t0+6],[bl+9.5+sway*.4,t0+11],[bl-1.5+sway*.4,t0+11]],TC,gt);S.paintRect(bl,t0+5,8,1,sh(TC,-.18));S.paintRect(bl-1,t0+10,12,1,sh(TC,.2))}
  else if(over){const un=mix(TC,WHITE,.78);S.rect(bl+1,t0,6,1,un,['under']);S.rect(bl,t0+1,8,HIP-t0-1,un,['under']);S.rect(bl+4,t0+3,4,HIP-t0-3,TC,gt);S.rect(bl,HIP,8,2,TC,gt);
   S.cap(22,t0,25,t0+3,.7,TC,['strapN']);S.px(24,t0+3,GOLD,FLAT('!btn'));
   S.cap(22,HIP+1,22+(fx-22)*.32,HIP+1+(43-fLift-HIP-1)*.32,1.5,dark(TC),['botF']);S.cap(21,HIP+1,21+(nx-21)*.32,HIP+1+(43-nLift-HIP-1)*.32,1.5,TC,gt)}
  else{S.rect(bl+1,t0,BW*2-2,1,TC,gt);S.rect(bl,t0+1,BW*2,hem-t0,TC,gt)}
  const pat=(TOP==='tee'||TOP==='tank'||TOP==='shirt'||TOP==='hoodie'||TOP==='sweater'||TOP==='dress')?av.pt:'none';
  if(pat==='stripe'){const pc=ptc(TC);for(let y=t0+2;y<(dress?t0+6:hem+1);y+=3)for(let x=bl;x<=br;x++)S.paintIf(x,y,pc,'top')}
  else if(pat&&pat!=='none'){const pc=contrast(TC,pat==='heart'?[[255,110,150],[255,255,255],[60,50,70]]:pat==='star'?[[255,214,80],[255,255,255],[60,50,70]]:[[255,255,255],[120,80,60],[60,50,70]]);
   const m=PAT[pat].map(r=>pat==='star'?r.slice(1,6):r.slice(0,4));m.forEach((r,j)=>{for(let i=0;i<r.length;i++)if(r[i]==='#')S.paintIf(bl+3+i,t0+(dress?1:2)+j,pc,'top')})}
  // neck
  S.rect(21,24,3,t0+1-24+((TOP==='tank'||TOP==='jacket'||TOP==='uniform'||TOP==='shirt')?1:0),SK,sk('neck'));
  if(TOP==='tee'){S.paintRect(21,t0+1,3,1,sh(TC,-.16))}
  else if(TOP==='sweater'){S.paintRect(bl+1,t0,6,1,sh(TC,.2));S.paintRect(bl,hem,BW*2,1,sh(TC,-.12));for(let x=bl;x<bl+BW*2;x+=2)S.paint(x,hem,sh(TC,-.22))}
  else if(TOP==='shirt'){const cc=lum(TC)>215?mix(TC,[150,170,200],.35):WHITE;S.px(23,t0,cc,['collar']);S.px(24,t0,cc,['collar']);S.px(24,t0+1,cc,['collar']);for(const y of[t0+3,t0+5,t0+7])if(y<hem)S.px(bl+7,y,sh(TC,.5),FLAT('!btn'))}
  else if(TOP==='hoodie'||TOP==='rain'){S.ell(bl+1,t0,3.2,2.2,sh(TC,-.1),['hood']);if(TOP==='hoodie'){S.paintRect(bl,hem,BW*2,1,sh(TC,-.14));S.rect(bl+4,hem-3,5,2,sh(TC,-.1),['pocket']);S.paintRect(bl+4,hem-3,5,1,sh(TC,-.2))}else{for(const y of[t0+3,t0+6])S.px(bl+8,y,sh(TC,-.45),FLAT('!btn'));S.paintRect(bl,hem,BW*2,1,sh(TC,-.15))}}
  else if(TOP==='jacket'){S.paintRect(bl+8,t0+1,1,hem-t0,sh(TC,-.22));S.rect(bl+7,t0,2,2,sh(TC,.12),['collarN'])}
  else if(TOP==='uniform'){S.px(bl+8,t0+1,[220,70,90],['tie']);S.px(bl+8,t0+2,[220,70,90],['tie']);S.px(bl+8,t0+3,[220,70,90],['tie']);S.rect(bl+6,t0,3,2,WHITE,['shirtw']);S.px(bl+8,t0+5,GOLD,FLAT('!btn'));S.px(bl+8,t0+7,GOLD,FLAT('!btn'))}
  else if(TOP==='tank'){S.rect(21,t0,2,2,TC,['strapN'])}
  else if(TOP==='dress'){S.paintRect(21,t0+1,3,1,sh(TC,-.16))}
  // front-side extras
  if(EX==='scarf'){S.rect(18,25,8,3,XK,['scarf']);for(let x=18;x<26;x+=2)S.paintRect(x,26,1,1,sh(XK,.35));S.cap(18,27,14+sway,31,1.2,XK,['scarfT'],1.0)}
  if(EX==='bandana'){S.rect(19,25,6,2,XK,['bandana']);S.poly([[19,27],[26,27],[24.5,31]],XK,['bandana']);for(const[x,y]of[[21,26],[24,27]])S.px(x,y,WHITE,FLAT('!dot'))}
  if(EX==='backpack'){S.rect(bl+1,t0,2,7,sh(XK,-.15),['pstrap'])}
  if(EX==='bag'){S.cap(24,t0,19,HIP-1,.5,sh(XK,-.2),['bstrap'])}
  // ---- near arm (holds the leash forward) ----
  const hs=!!opt.hold||true,aS=[21.5,t0+1.5];
  const tgt=P==='walk'||P==='stand'?[26.4,TY+7.2]:[26.4,TY+7.4];
  S.cap(aS[0],aS[1],tgt[0],tgt[1],.9,SK,sk('armN'));S.ell(tgt[0],tgt[1]+.2,1.2,1.2,SK,sk('handN'));
  if(slLen>0){const P2=lerp(aS,tgt,slLen);S.cap(aS[0],aS[1]-.3,P2[0],P2[1],1.0,slc,['slvN']);if(slLen>.7){const Q=lerp(aS,tgt,.86),Q2=lerp(aS,tgt,.95);S.cap(Q[0],Q[1],Q2[0],Q2[1],1.0,sh(slc,-.14),['cuffN'])}}
  if(EX==='bag'){S.rect(18,33,5,5,XK,['bag']);S.paintRect(18,33,5,2,sh(XK,.18));S.px(20,35,GOLD,FLAT('!clasp'))}
  info.hand={x:tgt[0],y:tgt[1]+.2};
  // ---- head ----
  H.sq(22,18,7.2,6.4,2.6,SK,sk('face'));
  H.px(30,21,SK,sk('nose'));H.px(30,20,SK,sk('nose'));
  H.rect(18,19,2,3,SK,sk('ear'));H.px(18,20,sh(SK,-.25,ROSE),FLAT('!ei'));
  cheeksSide();eyesSide();mouthSide();
  hairFrontSide();hatSide();glassesSide();
  info.head={x:22,y:18+U};
 }
 // ===================================================================================================
 //  FRONT VIEW
 // ===================================================================================================
 function front(){
  const TOP=av.t,BOT=av.b,SHOE=av.s,dress=TOP==='dress',over=TOP==='overalls';
  const t0=TY+U;
  extraBack();hairBack();
  // ---- legs ----
  S.rect(19,HIP+1,3,8,SK,sk('legL'));S.rect(23,HIP+1,3,8,SK,sk('legR'));
  // ---- shoes ----
  for(const s of[0,1]){
   const fx=s?23:17,ax=s?23:18,g=['shoe'+s],sole=[250,244,232];
   if(SHOE==='sandal'){S.rect(fx,45,5,1,[168,124,88],g);S.rect(fx,44,5,1,SK,sk('foot'+s));S.rect(ax+1,43,3,1,SC,['strap'+s]);S.px(fx+2,44,SC,['strap'+s])}
   else{
    if(SHOE==='sneaker'){S.rect(19+(s?4:0),41,3,2,[246,246,252],['sock'+s]);S.paintRect(19+(s?4:0),41,3,1,mix(TC,WHITE,.35))}
    if(SHOE==='boots'){S.rect(ax,40,4,3,SC,g);S.paintRect(ax,40,4,1,sh(SC,.22))}
    if(SHOE==='rain'){S.rect(ax,39,4,4,SC,g);S.paintRect(ax,39,4,1,sh(SC,.3));S.paintRect(ax+1,40,1,3,sh(SC,.4))}
    S.rect(ax,43,4,1,SC,g);S.rect(fx,44,5,2,SC,g);
    S.paintRect(fx,45,5,1,SHOE==='sneaker'?(lum(SC)>200?[226,206,180]:sole):sh(SC,-.35));
    S.paint(s?26:18,44,sh(SC,.35));
    if(SHOE==='sneaker')S.px(s?24:20,43,WHITE,FLAT('!l'));
   }
  }
  // ---- bottoms (skipped under dress / overalls) ----
  if(!dress&&!over){
   const g=['bot'];
   if(BOT==='shorts'){S.rect(18,HIP,9,2,BC,g);S.rect(18,HIP+2,4,2,BC,g);S.rect(23,HIP+2,4,2,BC,g);S.paintRect(18,HIP,9,1,sh(BC,-.1))}
   else if(BOT==='pants'){S.rect(18,HIP,9,2,BC,g);S.rect(18,HIP+2,4,5,BC,g);S.rect(23,HIP+2,4,5,BC,g);S.paintRect(18,HIP,9,1,sh(BC,-.1));S.paintRect(18,42,4,1,sh(BC,-.16));S.paintRect(23,42,4,1,sh(BC,-.16))}
   else if(BOT==='jogger'){S.rect(18,HIP,9,2,BC,g);S.rect(17,HIP+2,5,3,BC,g);S.rect(23,HIP+2,5,3,BC,g);S.rect(19,HIP+5,3,2,BC,g);S.rect(23,HIP+5,3,2,BC,g);
    S.paintRect(18,HIP,9,1,sh(BC,-.1));S.paintRect(19,42,3,1,sh(BC,.25));S.paintRect(23,42,3,1,sh(BC,.25));for(let y=HIP+2;y<HIP+5;y++){S.paint(17,y,sh(BC,.5));S.paint(27,y,sh(BC,.5))}}
   else if(BOT==='skirt'){S.rect(18,HIP,9,2,BC,g);S.rect(17,HIP+2,11,2,BC,g);S.paintRect(18,HIP,9,1,sh(BC,-.1));S.paintRect(17,HIP+3,11,1,sh(BC,.18));for(const x of[20,24])for(let y=HIP+1;y<HIP+3;y++)S.paint(x,y,sh(BC,-.12))}
   else if(BOT==='pleat'){S.rect(18,HIP,9,1,BC,g);S.rect(17,HIP+1,11,2,BC,g);S.rect(16,HIP+3,13,2,BC,g);S.paintRect(18,HIP,9,1,sh(BC,-.1));S.paintRect(16,HIP+4,13,1,sh(BC,.55));
    for(let y=HIP+1;y<HIP+4;y++)for(const x of[18,20,24,26])S.paint(x,y,sh(BC,-.14))}
  }
  // ---- torso ----
  const BW={hoodie:5,jacket:5,rain:5,sweater:5,uniform:5}[TOP]||4,xl=22-BW,xr=22+BW;
  const hem=({hoodie:HIP,sweater:HIP,jacket:HIP,uniform:HIP,rain:HIP+2})[TOP]||HIP-1;
  const gt=['top'];
  const arm=(s)=>{const ax=BW>4?15.5:16.5;return s?[44-ax-1,0]:[ax,0]};
  // arms & hands
  const AXL=BW>4?15.5:16.5,AXR=BW>4?28.5:27.5;
  const aS=[[AXL,t0+1.5],[AXR,t0+1.5]];
  let aH=[[AXL-.3,TY+7.6],[AXR+.3,TY+7.6]];
  if(hold==='L')aH[0]=[AXL-2.6,TY+6]; if(hold==='R')aH[1]=[AXR+2.6,TY+6];
  if(wave){const w=[[31.5,TY-5.5],[33,TY-6.5],[31.5,TY-5.5],[30,TY-6.5]][FRN%4];aH[1]=[w[0],w[1]+U]}
  if(happy){aH[0]=[AXL-3,TY-6+U];aH[1]=[AXR+3,TY-6+U]}
  const longSl={hoodie:1,sweater:1,jacket:1,rain:1,uniform:1}[TOP],noSl=TOP==='tank';
  const slLen=noSl?0:longSl?.92:(TOP==='dress'?.3:.42);
  // torso shape
  if(dress){
   S.rect(19,t0,7,1,TC,gt);S.rect(18,t0+1,9,5,TC,gt);
   S.rect(17,t0+6,11,2,TC,gt);S.rect(16,t0+8,13,2,TC,gt);S.rect(15,t0+10,15,1+(U?0:0),TC,gt);
   S.paintRect(18,t0+5,9,1,sh(TC,-.18));
  }else if(over){
   const un=mix(TC,WHITE,.78);S.rect(19,t0,7,1,un,['under']);S.rect(18,t0+1,9,HIP-t0-1,un,['under']);
   S.rect(19,t0+3,7,HIP-t0-3,TC,gt);S.rect(18,HIP,9,2,TC,gt);S.rect(18,HIP+2,4,2,TC,gt);S.rect(23,HIP+2,4,2,TC,gt);
   S.rect(19,t0,2,4,TC,['strapL']);S.rect(24,t0,2,4,TC,['strapR']);
   for(const x of[20,24])S.px(x,t0+3,GOLD,FLAT('!btn'));
  }else{
   S.rect(xl+1,t0,2*BW-1,1,TC,gt);S.rect(xl,t0+1,2*BW+1,hem-t0,TC,gt);
  }
  // pattern
  const pat=(TOP==='tee'||TOP==='tank'||TOP==='shirt'||TOP==='hoodie'||TOP==='sweater'||TOP==='dress')?av.pt:'none';
  if(pat&&pat!=='none'){
   const pc=contrast(TC,pat==='stripe'?[ptcOf(TC)]:pat==='heart'?[[255,110,150],[255,255,255],[60,50,70]]:pat==='star'?[[255,214,80],[255,255,255],[60,50,70]]:[[255,255,255],[120,80,60],[60,50,70]]);
   if(pat==='stripe'){for(let y=t0+2;y<(dress?t0+6:hem+1);y+=3){for(let x=xl;x<=xr;x++)S.paintIf(x,y,pc,'top')}}
   else{const m=PAT[pat],x0=22-(m[0].length>>1),y0=t0+(dress?1:2)+((pat==='heart'||pat==='paw')?1:1);m.forEach((r,j)=>{for(let i=0;i<r.length;i++)if(r[i]==='#')S.paintIf(x0+i,y0+j,pc,'top')})}
  }
  // neck (drawn over the torso so the neckline shows skin)
  const nd=({tank:2,jacket:2,uniform:2,shirt:2})[TOP]||1;
  S.rect(21,24,3,t0+nd-24+(nd>1?0:0),SK,sk('neck'));
  if(TOP==='tank'||TOP==='dress'){S.px(20,t0,SK,sk('neck'));S.px(24,t0,SK,sk('neck'))}
  if(TOP==='tee'){S.paintRect(20,t0,1,1,sh(TC,-.14));S.paintRect(24,t0,1,1,sh(TC,-.14));S.paintRect(21,t0+1,3,1,sh(TC,-.16))}
  else if(TOP==='sweater'){S.paintRect(20,t0,5,1,sh(TC,.2));S.paintRect(21,t0+1,3,1,sh(TC,.2));S.paintRect(xl,hem,2*BW+1,1,sh(TC,-.12));for(let x=xl;x<=xr;x+=2)S.paint(x,hem,sh(TC,-.22));S.paintRect(xl,hem-1,2*BW+1,1,sh(TC,.08))}
  else if(TOP==='shirt'){const cc=lum(TC)>215?mix(TC,[150,170,200],.35):WHITE;
   for(const[x,y]of[[20,t0],[21,t0],[21,t0+1],[24,t0],[23,t0],[23,t0+1]])S.px(x,y,cc,['collar']);
   for(let y=t0+2;y<hem;y++)S.paint(22,y,sh(TC,-.12));for(const y of[t0+3,t0+5,t0+7])if(y<hem)S.px(22,y,sh(TC,.5),FLAT('!btn'))}
  else if(TOP==='tank'){S.rect(19,t0,2,2,TC,['strapL']);S.rect(24,t0,2,2,TC,['strapR'])}
  else if(TOP==='hoodie'){S.rect(17,t0-1,4,2,sh(TC,-.08),['hoodL']);S.rect(24,t0-1,4,2,sh(TC,-.08),['hoodR']);S.paintRect(xl,hem,2*BW+1,1,sh(TC,-.14));
   S.rect(19,hem-3,7,2,sh(TC,-.1),['pocket']);S.paintRect(19,hem-3,7,1,sh(TC,-.2));S.px(18,hem-2,sh(TC,-.25),FLAT('!pk'));S.px(26,hem-2,sh(TC,-.25),FLAT('!pk'));
   const st=mix(TC,WHITE,.55);for(const x of[20,24])for(let y=t0+1;y<=t0+4;y++)S.px(x,y,st,FLAT('!str'))}
  else if(TOP==='jacket'){const un=mix(TC,WHITE,.78);S.rect(21,t0+1,3,hem-t0-1,un,['inner']);S.px(22,t0+2,sh(TC,-.4),FLAT('!zip'));
   for(let y=t0+2;y<hem;y++){S.paint(21,y,sh(TC,-.2));S.paint(23,y,sh(TC,-.2))}S.rect(xl,t0,2,2,sh(TC,.12),['collarL']);S.rect(xr-1,t0,2,2,sh(TC,.12),['collarR'])}
  else if(TOP==='rain'){S.rect(17,t0-1,4,2,sh(TC,-.08),['hoodL']);S.rect(24,t0-1,4,2,sh(TC,-.08),['hoodR']);for(const y of[t0+3,t0+6])S.px(22,y,sh(TC,-.45),FLAT('!btn'));
   for(let y=t0+2;y<hem;y+=3){S.paint(xl+1,y,sh(TC,.5));S.paint(xl+1,y+1,sh(TC,.5))}S.paintRect(xl,hem,2*BW+1,1,sh(TC,-.15))}
  else if(TOP==='uniform'){const w=WHITE;
   S.rect(20,t0,5,3,w,['shirtw']);S.px(22,t0+1,[220,70,90],['tie']);S.px(22,t0+2,[220,70,90],['tie']);S.px(22,t0+3,[220,70,90],['tie']);
   for(let y=t0;y<hem;y++){S.paint(xl+3+(y-t0)*0,y,TC)}
   for(const y of[t0+4,t0+6])S.px(xr-2,y,GOLD,FLAT('!btn'));S.px(xl+2,t0+3,sh(WHITE,-.1),FLAT('!pk'))}
  else if(TOP==='dress'){S.paintRect(21,t0+1,3,1,sh(TC,-.16));S.paintRect(15,t0+10,15,1,sh(TC,.2))}
  // ---- front-side extras (straps, scarves, bag strap) ----
  const EX=av.x;
  if(EX==='backpack'){S.rect(19,t0,2,8,sh(XK,-.15),['pstrapL']);S.rect(24,t0,2,8,sh(XK,-.15),['pstrapR']);0}
  if(EX==='bag'){S.cap(25,t0,19,HIP-1,.5,sh(XK,-.2),['bstrap'])}
  if(EX==='scarf'){S.rect(17,25,11,3,XK,['scarf']);for(let x=17;x<28;x+=2)S.paintRect(x,26,1,1,sh(XK,.35));S.rect(24,28,3,7,XK,['scarfT']);for(let y=28;y<35;y+=2)S.paintRect(24,y,3,1,sh(XK,.35));S.erase(24,34);S.erase(26,34)}
  if(EX==='bandana'){const rows=[[18,26],[19,25],[20,24],[21,23],[22,22]];rows.forEach((r,j)=>S.rect(r[0],25+j,r[1]-r[0]+1,1,XK,['bandana']));for(const[x,y]of[[20,26],[24,26],[22,27]])S.px(x,y,WHITE,FLAT('!dot'))}
  // ---- arms (skin + sleeves) ----
  for(let s=0;s<2;s++){
   const A=aS[s],Hh=aH[s],gs='arm'+s;
   S.cap(A[0],A[1],Hh[0],Hh[1],.9,SK,sk(gs));S.ell(Hh[0],Hh[1]+.2,1.2,1.2,SK,sk('hand'+s));
   if(slLen>0){const P2=lerp(A,Hh,slLen),sx=A[0]+(s?.5:-.5);const sc=TOP==='overalls'?mix(TC,WHITE,.78):TC;S.cap(sx,A[1]-.3,P2[0]+(s?.5:-.5),P2[1],1.0,sc,['slv'+s]);
    if(slLen>.7){const Q=lerp(A,Hh,.86),Q2=lerp(A,Hh,.95);S.cap(Q[0]+(s?.5:-.5),Q[1],Q2[0]+(s?.5:-.5),Q2[1],1.0,sh(sc,-.14),['cuff'+s])}}
  }
  if(EX==='bag'){S.rect(13,33,6,5,XK,['bag']);S.paintRect(13,33,6,2,sh(XK,.18));S.px(15,35,GOLD,FLAT('!clasp'))}
  info.hand={x:(hold==='L'?aH[0][0]:aH[1][0]),y:(hold==='L'?aH[0][1]:aH[1][1])};
  // ---- head ----
  S.rect(14,19+U,1,3,SK,sk('earL'));S.rect(30,19+U,1,3,SK,sk('earR'));
  H.sq(22,18,7.2,6.4,2.6,SK,sk('face'));
  cheeksFront();eyesFront();mouthFront();
  hairFront();hatFront();glassesFront();
  info.head={x:22,y:18+U};
 }
 const ptcOf=ptc;
 function ptc(c){return lum(c)>165?sh(c,-.34):sh(c,.62)}
 if(side)side_();else front();
 return Object.assign(S.finish(),{info});
}
root.AVPIX={gen,PX,AW,AH,AX,AY,FRAMES,FRONT,hexc,mix,sh};
if(typeof module!=='undefined')module.exports=root.AVPIX;
})(typeof window!=='undefined'?window:globalThis);
