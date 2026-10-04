// Pixel-art dog generator for Cozy Dogs. Produces RGBA frames (56x46 px) per breed / variant / pose / frame.
// Used in-browser (inlined into index.html) and in node for the contact-sheet test.
(function(root){
'use strict';
const PX=2.5,GW=56,GH=46,GX=28,GY=42;
const hexc=h=>{h=h.replace('#','');if(h.length==3)h=[...h].map(x=>x+x).join('');const n=parseInt(h,16);return[n>>16&255,n>>8&255,n&255]};
const mx=(a,b,t)=>a.map((v,i)=>v*(1-t)+b[i]*t);
const sh=(c,k)=>k<0?mx(c,[0,0,0],-k):mx(c,[255,255,255],k);
const cl=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
function hsl(h,s,l){h/=360;const f=n=>{const k=(n+h*12)%12,a=s*Math.min(l,1-l);return(l-a*Math.max(-1,Math.min(k-3,9-k,1)))*255};return[f(0),f(8),f(4)]}

// ---------- per-breed silhouette / markings ----------
// L leg rows, BL body half-length, BH body half-height, HS head scale, MZ snout length, ear p/b/t/r/f/d, es ear scale,
// tail curl/whip/plume/stub/sabre/otter/pom/fluff, belly/chest/muz/sock/blaze/cheek/saddle/brow/earc = a|d|w|b, fluff 0-3
const BASE={L:6,BL:11,BH:6,HS:1,MZ:3,ear:'p',es:1,tail:'curl',belly:'a',muz:'a',earc:'b',fluff:0,flat:0};
const HUSKY={L:7,BL:11,BH:6.5,MZ:3,ear:'p',tail:'curl',fluff:1,sock:'a',belly:'a',cheek:'a',blaze:'a',eyec:'#5ab8ff',saddle:'d',dk:'#2a2f3a'};
const CORGI={L:4,BL:12,BH:6,HS:1.05,MZ:2.5,ear:'p',es:1.3,tail:'stub',sock:'a',blaze:'a',cheek:'a'};
const SHIBA={L:6,BL:10,BH:6,MZ:2.2,ear:'p',es:.9,tail:'curl',cheek:'a',sock:'a',brow:'a'};
const PR={
 chihuahua:{L:5,BL:8,BH:5,HS:1.3,MZ:1.5,ear:'b',es:1.4,tail:'whip',muz:'b'},
 pomeranian:{L:4,BL:8,BH:6,HS:1.1,MZ:1.2,ear:'p',es:.7,tail:'fluff',fluff:1},
 corgi:CORGI,
 pug:{L:5,BL:8,BH:6.5,HS:1.3,MZ:.5,flat:1,ear:'f',earc:'d',tail:'curl',muz:'d',belly:'b',dk:'#4a3a33'},
 beagle:{L:6,BL:11,BH:6,MZ:3.2,ear:'d',earc:'d',tail:'whip',tipc:'a',saddle:'d',sock:'a',blaze:'a',dk:'#6b3e22'},
 dachshund:{L:3,BL:15,BH:5,HS:.95,MZ:4,ear:'d',earc:'d',tail:'whip',sock:'a',brow:'a',belly:'b',lw:3,dk:'#5a2f18'},
 shihtzu:{L:4,BL:9,BH:6,HS:1.2,MZ:1,ear:'d',earc:'a',tail:'plume',fluff:1,saddle:'a',belly:'b',muz:'b'},
 maltese:{L:4,BL:9,BH:6,HS:1.15,MZ:1,ear:'d',tail:'plume',fluff:1,belly:'b',muz:'b'},
 yorkie:{L:4,BL:9,BH:5.5,HS:1.1,MZ:1.8,ear:'p',es:.9,earc:'a',tail:'plume',fluff:1,sock:'a',cheek:'a',brow:'a'},
 bichon:{L:4,BL:8,BH:6.5,HS:1.35,MZ:1,ear:'d',tail:'fluff',fluff:2,belly:'b',muz:'b'},
 boston:{L:6,BL:9,BH:6,HS:1.15,MZ:.6,flat:1,ear:'b',es:1.1,tail:'stub',sock:'a',blaze:'a'},
 jackrussell:{L:7,BL:10,BH:5.5,MZ:2.5,ear:'f',earc:'a',tail:'whip',saddle:'a',belly:'b',muz:'b'},
 husky:HUSKY,
 shiba:SHIBA,
 golden:{L:7,BL:12,BH:6.5,MZ:3.2,ear:'d',tail:'plume',fluff:1},
 labrador:{L:7,BL:11,BH:6.8,HS:1.05,MZ:3,ear:'d',tail:'otter'},
 blacklab:{L:7,BL:11,BH:6.8,HS:1.05,MZ:3,ear:'d',tail:'otter',belly:'b',muz:'b'},
 dalmatian:{L:8,BL:11,BH:6,MZ:3.2,ear:'d',earc:'d',tail:'sabre',spots:'d',belly:'b',muz:'b',dk:'#222222'},
 samoyed:{L:6,BL:10,BH:7,HS:1.1,MZ:2,ear:'p',es:.8,tail:'curl',fluff:2,belly:'b',muz:'b',smile:1},
 bordercollie:{L:7,BL:11,BH:6,MZ:2.8,ear:'t',tail:'plume',fluff:1,sock:'a',blaze:'a',tipc:'a'},
 poodle:{L:8,BL:9,BH:5.5,HS:.95,MZ:4,ear:'d',tail:'pom',fluff:3,belly:'b',muz:'b',lw:2},
 frenchie:{L:6,BL:8.5,BH:6.5,HS:1.3,MZ:.4,flat:1,ear:'b',es:1.4,tail:'stub',muz:'d',dk:'#4a3a33'},
 boxer:{L:8,BL:11,BH:6.5,HS:1.1,MZ:1.6,ear:'f',tail:'stub',sock:'a',blaze:'a',muz:'d',chest:'a',dk:'#3a2418'},
 cocker:{L:5,BL:10,BH:6,HS:1.05,MZ:2.2,ear:'d',es:1.3,earc:'d',tail:'plume',fluff:1,muz:'b'},
 pitbull:{L:7,BL:10,BH:7,HS:1.15,MZ:2,ear:'f',tail:'otter',sock:'a',blaze:'a'},
 schnauzer:{L:7,BL:9.5,BH:6,MZ:3.4,ear:'f',earc:'d',tail:'stub',brow:'a',dk:'#5a5f68'},
 basset:{L:3,BL:14,BH:6,HS:1.1,MZ:3.5,ear:'d',es:1.5,earc:'d',tail:'sabre',sock:'a',blaze:'a',saddle:'d',dk:'#5a3018'},
 akita:{L:8,BL:11,BH:7,HS:1.1,MZ:2.6,ear:'p',es:.9,tail:'curl',fluff:1,sock:'a',cheek:'a',blaze:'a',brow:'a'},
 chowchow:{L:6,BL:10,BH:7.5,HS:1.3,MZ:1.2,ear:'r',tail:'curl',fluff:3,belly:'b',muz:'b',tongue:'#4a4a8a'},
 gsd:{L:8,BL:12,BH:6.5,MZ:3.6,ear:'p',es:1.3,tail:'sabre',saddle:'d',muz:'d',brow:'a',cheek:'a',dk:'#2a1c12'},
 bernese:{L:7,BL:12,BH:7,HS:1.1,MZ:2.8,ear:'t',tail:'plume',fluff:1,belly:'b',chest:'w',cheek:'a',brow:'a',sock:'a',blaze:'w',muz:'w',dk:'#1a1716'},
 aussie:{L:7,BL:10.5,BH:6,MZ:2.8,ear:'t',tail:'stub',fluff:1,belly:'b',chest:'w',cheek:'a',brow:'a',sock:'w',blaze:'w',merle:'d',dk:'#38404e',eyec:'#6ab8ff'},
 doberman:{L:9,BL:11.5,BH:6,HS:.95,MZ:3.8,ear:'p',es:1.4,tail:'stub',belly:'b',chest:'a',muz:'a',sock:'a',cheek:'a',brow:'a'},
 rottweiler:{L:7,BL:11,BH:7,HS:1.15,MZ:2.2,ear:'f',tail:'stub',belly:'b',chest:'a',muz:'a',sock:'a',cheek:'a',brow:'a'},
 greyhound:{L:11,BL:12,BH:5,HS:.9,MZ:4.2,ear:'r',es:.8,tail:'sabre',muz:'b',lw:2},
 borzoi:{L:11,BL:12,BH:5.5,HS:.9,MZ:4.6,ear:'r',tail:'plume',fluff:1,belly:'b',saddle:'a',muz:'b',lw:2},
 rhodesian:{L:8,BL:11.5,BH:6.5,MZ:3.2,ear:'f',tail:'sabre',muz:'b'},
 malamute:{L:8,BL:12,BH:7.5,HS:1.1,MZ:3,ear:'p',es:.9,tail:'curl',fluff:2,sock:'a',cheek:'a',blaze:'a',eyec:'#6b4a2a',saddle:'d',dk:'#38404e'},
 saintbernard:{L:8,BL:12.5,BH:8,HS:1.2,MZ:2.4,ear:'d',earc:'a',tail:'plume',fluff:1,belly:'b',muz:'b',saddle:'a',cheek:'a',brow:'a'},
 greatdane:{L:11,BL:13,BH:7,MZ:4,ear:'d',earc:'d',tail:'sabre',belly:'b',muz:'d',dk:'#2a2c35'},
 newfoundland:{L:7,BL:12.5,BH:8,HS:1.2,MZ:2.4,ear:'d',tail:'plume',fluff:2,belly:'b'},
 mastiff:{L:8,BL:12.5,BH:8,HS:1.25,MZ:1.8,ear:'f',earc:'d',tail:'sabre',muz:'d',dk:'#3a2a24'},
 pyrenees:{L:8,BL:12,BH:7.5,HS:1.1,MZ:2.6,ear:'d',earc:'a',tail:'plume',fluff:2,belly:'b',muz:'b'},
 galaxyhusky:Object.assign({},HUSKY,{saddle:null,eyec:'#ffe27a',dk:null}),
 rainbowcorgi:CORGI,
 cloudpuppy:{L:5,BL:9,BH:7,HS:1.25,MZ:1,ear:'r',tail:'fluff',fluff:2},
 crystalpuppy:{L:6,BL:10,BH:6.5,HS:1.05,MZ:2.4,ear:'p',es:1.3,tail:'whip'},
 starpuppy:{L:6,BL:10,BH:6.5,HS:1.05,MZ:2.6,ear:'p',tail:'plume',fluff:1,star:1},
 moonshiba:Object.assign({},SHIBA,{moon:1,cheek:'a',brow:null}),
 flamepuppy:{L:7,BL:11,BH:6.2,MZ:3,ear:'p',es:1.1,tail:'plume',fluff:1,tipc:'a'},
};
const prof=id=>Object.assign({},BASE,PR[id]||{});

// ---------- palette per variant ----------
function pal(b,v,P){
 let body=hexc(b.body),acc=hexc(b.acc),dk=P.dk?hexc(P.dk):sh(body,-.45);
 if(v=='Snow'){body=hexc('#f1f7ff');acc=hexc('#cfe4ff');dk=hexc('#9fb8d8')}
 else if(v=='Chocolate'){body=hexc('#7a4a2e');acc=hexc('#a9774f');dk=hexc('#4a2a18')}
 else if(v=='Golden'){body=hexc('#f0c050');acc=hexc('#ffe49a');dk=hexc('#b88a20')}
 else if(v=='Galaxy'){body=hexc('#3a2a7a');acc=hexc('#c9a8ff');dk=hexc('#1e1450')}
 else if(v=='Rainbow'){body=hexc('#ff9ad5');acc=hexc('#fff0a8');dk=hexc('#c070e0')}
 const bodyAt=(x,y)=>{
  if(v=='Galaxy'){const t=cl((x*.55+y*.9-12)/62);return t<.5?mx([34,20,100],[122,74,208],t*2):mx([122,74,208],[224,106,208],t*2-1)}
  if(v=='Rainbow')return hsl((x*6+y*4)%360,.8,.74);
  return body};
 return{a:acc,d:dk,w:[255,255,255],n:[28,20,18],t:P.tongue?hexc(P.tongue):[255,124,147],r:[255,179,193],o:[42,28,24],e:P.eyec?hexc(P.eyec):(body[0]*.3+body[1]*.59+body[2]*.11<75&&v!='Galaxy'?[160,108,56]:[28,20,18]),y:[255,210,63],bodyAt};
}

const FRAMES={stand:8,walk:4,run:4,sleep:2,sit:2,look:2,eat:2,bark:2,sniff:2,happy:2,play:2,stretch:2,shy:2};

// ---------- generator ----------
function gen(b,v,pose,fr,acc){
 const P=prof(b.id),pl=pal(b,v,P);
 const G=[];for(let y=0;y<GH;y++)G.push(new Array(GW).fill(null));
 const get=(x,y)=>x>=0&&x<GW&&y>=0&&y<GH?G[y][x]:null;
 const set=(x,y,m)=>{x=Math.round(x);y=Math.round(y);if(x>=0&&x<GW&&y>=0&&y<GH)G[y][x]=m};
 const XC={},cs=(x,y,hx,only)=>{if(only&&!get(Math.round(x),Math.round(y)))return;const k='#'+hx;if(!XC[k]){const n=parseInt(hx,16);XC[k]=[n>>16&255,n>>8&255,n&255]}set(x,y,k)};
 const ell=(cx,cy,rx,ry,m)=>{for(let y=Math.floor(cy-ry-1);y<=Math.ceil(cy+ry+1);y++)for(let x=Math.floor(cx-rx-1);x<=Math.ceil(cx+rx+1);x++){const dx=(x-cx)/(rx+.35),dy=(y-cy)/(ry+.35);if(dx*dx+dy*dy<=1)set(x,y,m)}};
 const tint=(cx,cy,rx,ry,m,from='b')=>{for(let y=Math.floor(cy-ry-1);y<=Math.ceil(cy+ry+1);y++)for(let x=Math.floor(cx-rx-1);x<=Math.ceil(cx+rx+1);x++){const dx=(x-cx)/(rx+.35),dy=(y-cy)/(ry+.35);if(dx*dx+dy*dy<=1){const g=get(x,y);if(g&&from.includes(g))set(x,y,m)}}};
 const rect=(x,y,w,h,m)=>{for(let j=0;j<h;j++)for(let i=0;i<w;i++)set(x+i,y+j,m)};
 const path=(pts,r,m)=>{for(let i=0;i<pts.length-1;i++){const a=pts[i],c=pts[i+1],n=Math.ceil(Math.hypot(c[0]-a[0],c[1]-a[1])*2)||1;for(let k=0;k<=n;k++)ell(a[0]+(c[0]-a[0])*k/n,a[1]+(c[1]-a[1])*k/n,r,r,m)}};
 const {BL,BH,MZ,HS}=P,L=P.L+2,cx=Math.round((53-MZ)/2),LW=P.lw||(BH<5.5?2:BH>=7.5?4:3);
 const FM={b:'f',a:'g',d:'d',w:'w'};
 // ----- pose parameters -----
 const ph=fr*Math.PI/2,S=Math.sin,C=Math.cos;
 let mode='std',look=0,wag=0,tailM='up',legs=[0,1,2,3].map(()=>({dx:0,l:0})),hdx=0,hdy=0,pitch=0,mouth=0,eyes='open',earB=0,dyB=0,headLow=0;
 switch(pose){
  case'stand':wag=[-1,0,1,0,-1,0,1,0][fr]*1.3;eyes=fr==7?'blink':'open';break;
  case'walk':legs=[ph,ph+Math.PI,ph+Math.PI,ph].map(p=>({dx:S(p)*3.4,l:Math.max(0,C(p))*2.4}));dyB=fr%2==0?-1:0;hdy=dyB;earB=fr%2;wag=[1,0,-1,0][fr];break;
  case'run':legs=[ph,ph+2.6,ph+.5,ph+3.1].map(p=>({dx:S(p)*6.5,l:Math.max(0,C(p))*4}));dyB=-[0,2,3,2][fr];hdy=dyB;hdx=1;earB=2;mouth=1;tailM='back';wag=[1,-1,1,-1][fr];break;
  case'sleep':mode='lie';eyes='closed';earB=3;tailM='ground';break;
  case'sit':mode='sit';tailM='ground';wag=fr;break;
  case'look':mode='sit';look=1;tailM='ground';wag=fr;break;
  case'eat':headLow=1;pitch=2.5;mouth=fr;wag=[-.6,.6][fr];break;
  case'bark':hdy=-3;pitch=-1.5;mouth=fr;dyB=-fr;wag=[1.5,-1.5][fr];break;
  case'sniff':headLow=2;pitch=2;legs[0].l=fr?1.5:0;wag=[-1,1][fr];break;
  case'happy':eyes='happy';mouth=1;dyB=-fr;hdy=dyB;wag=[-2.4,2.4][fr];break;
  case'play':mode='bow';mouth=1;wag=[-2.2,2.2][fr];break;
  case'stretch':mode='bow';eyes='closed';mouth=1;wag=[-1,1][fr];break;
  case'shy':hdy=3;pitch=1;earB=3;tailM='down';eyes='sad';dyB=1;break;
 }
 // ----- helpers -----
 function leg(x0,lg,yt,mb,ma){
  const yb=GY-Math.round(lg.l);
  for(let y=yt;y<=yb;y++){const t=yb>yt?(y-yt)/(yb-yt):1,xx=x0+lg.dx*t,sock=P.sock&&y>yb-3,m=sock?(P.sock=='a'?ma:P.sock=='w'?'w':mb):mb;for(let i=0;i<LW;i++)set(xx-LW/2+i+.5,y,m)}
  set(x0+lg.dx+LW/2+.5,yb,P.sock=='a'?ma:P.sock=='w'?'w':mb);
 }
 function tail(tx,ty,tm){
  const w=wag,T=P.tail,fl=P.fluff>=1;let pts,r=1.5;
  if(tm=='ground'){pts=[[tx,ty],[tx-4,ty+1],[tx-8,ty+1.5]];r=T=='whip'?1:1.5}
  else if(tm=='down'){pts=[[tx,ty],[tx-2,ty+4],[tx-2.5,ty+8]];r=T=='whip'?1:1.6}
  else if(tm=='back'){pts=T=='stub'?[[tx,ty],[tx-2,ty-1]]:[[tx,ty],[tx-5,ty-1],[tx-10,ty-1+w*.3]];r=T=='whip'?1:1.6}
  else if(T=='curl'){const R=fl?4.2:3.4,rr=fl?2.2:1.5,c0=[tx-1+w*.5,ty-R-1];pts=[];for(let k=0;k<=10;k++){const a=.3+k/10*5.4;pts.push([c0[0]+S(a)*R,c0[1]+C(a)*R])}r=rr;if(fl)ell(c0[0],c0[1],R-rr,R-rr,'b')}
  else if(T=='whip'){pts=[[tx,ty],[tx-2,ty-4],[tx-3+w*.5,ty-8]];r=.9}
  else if(T=='plume'){pts=[[tx,ty],[tx-4,ty-3],[tx-8,ty-3+w*.5],[tx-10,ty+1+w]];r=1.7}
  else if(T=='stub'){pts=[[tx,ty],[tx-2,ty-1+w*.4]];r=1.5}
  else if(T=='sabre'){pts=[[tx,ty],[tx-5,ty+1],[tx-9,ty+4+w*.4],[tx-11,ty+8+w*.6]];r=1.3}
  else if(T=='otter'){pts=[[tx,ty],[tx-5,ty+1],[tx-9,ty+3+w*.4]];r=2}
  else if(T=='pom'){path([[tx,ty],[tx-3,ty-4]],.9,'b');ell(tx-4,ty-6+w*.4,3.2,3.2,'b');return}
  else if(T=='fluff'){ell(tx-2,ty-4,4,4.2,'b');ell(tx-4+w*.5,ty-6,3,3.2,'b');return}
  path(pts,r,'b');if(P.tipc){const e=pts[pts.length-1];ell(e[0],e[1],r+.3,r+.3,P.tipc)}
 }
 function ear(far,hx,hy,ry){
  const k=P.ear,es=P.es,em=P.earc,m=far?(FM[em]||em):em;
  if(k=='p'||k=='b'||k=='t'){
   const xc=far?hx+3.5:hx-3,yb=hy-ry+2+(far?1:0),h=Math.max(2,Math.round(7*es*(earB==3?.5:earB==2?.8:1))),w=Math.round((k=='b'?5.5:5)*es),tilt=earB>=2?-2.5:(k=='b'?-.3:-1.2);
   for(let j=0;j<h;j++){const f=k=='b'?1-.35*j/h:1-j/h,ww=Math.max(1,Math.round(w*f)),c0=xc+tilt*(j/h);for(let i=0;i<ww;i++)set(c0-ww/2+i+.5,yb-j,m)}
   if(!far&&k!='t')for(let j=1;j<h*.7;j++){const iw=Math.max(0,Math.round(w*.45*(1-j/(h*.75)))),c0=xc+tilt*(j/h);for(let i=0;i<iw;i++)set(c0-iw/2+i+.5,yb-j,'r')}
   if(k=='t')ell(xc+tilt+2.2,yb-h+1,2,1.6,m);
  }else if(k=='r')ell(far?hx+3.5:hx-3,hy-ry+1,3.3*es,3*es,m);
  else if(k=='f')ell(far?hx+3.5:hx-3.5,hy-ry+(far?3:4),(far?2.2:3)*es,(far?2.5:3.8)*es,m);
  else if(k=='d'){if(far)ell(hx+3.5,hy-ry+3,2.4*es,4.2*es,m);else ell(hx-4+(earB==2?-2:0),hy+2+(earB==1||earB==3?1:0),3.3*es,6.8*es,m)}
 }
 let EP=null;
 function head(hx,hy){
  const rx=(P.flat?5.8:6)*HS,ry=(P.flat?5.4:5.2)*HS,mm=P.muz;
  ear(true,hx,hy,ry);
  ell(hx,hy,rx,ry,'b');
  if(P.fluff>=1)ell(hx,hy+2,rx+1,ry-1,'b');
  if(P.fluff>=3){ell(hx-1,hy-ry-1,5.2,3.6,'b')}
  const sx=hx+rx*.55+MZ*.5+1.5,sy=hy+1.5+pitch*.9,srx=2.8+MZ*.55,sry=P.flat?3:2.5;
  ell(sx,sy,srx,sry,mm);if(!P.flat)ell(sx-1,sy+1.6,srx-.6,1.6,mm);
  if(P.blaze){tint(hx+2,hy-2,1.3,3.4,P.blaze);tint(sx,sy-1,srx-.5,1,P.blaze)}
  if(P.cheek)tint(hx+1,hy+3,4,2.5,P.cheek);
  if(P.spots=='d'||P.merle)tint(hx-2,hy-2,2,2,'d');
  ear(false,hx,hy,ry);
  // eyes
  const ex1=Math.round(hx-1.2*HS+.4),ex2=Math.round(hx+3.2*HS),ey=Math.round(hy-1.8*HS+pitch*.3);
  for(const ex of[ex1,ex2]){
   if(eyes=='closed'||eyes=='blink')rect(ex,ey+1,2,1,'n');
   else if(eyes=='happy'){set(ex,ey+1,'n');set(ex+1,ey,'n');set(ex+2,ey+1,'n')}
   else{rect(ex,ey-(P.flat?1:0),2,P.flat?3:2,'e');set(ex,ey-(P.flat?1:0),'w');if(eyes=='sad')set(ex+(ex==ex1?-1:1),ey-2,'n')}
  }
  if(P.brow&&eyes!='closed'){set(ex1,ey-3,P.brow);set(ex2,ey-3,P.brow)}
  const tipX=sx+srx;EP={hx,hy,rx,ry,ex1,ex2,ey,tipX,sx,sy};
  if(P.flat)rect(Math.round(tipX-3.2),Math.round(sy-2.5),3,2,'n');else rect(Math.round(tipX-2),Math.round(sy-1.8),2,2,'n');
  if(mouth){rect(Math.round(tipX-6),Math.round(sy+1.2),5,2,'n');rect(Math.round(tipX-5),Math.round(sy+2.2),2,2,'t');rect(Math.round(tipX-6),Math.round(sy+3.2),5,1,mm)}
  else{for(let i=2;i<=5;i++)set(tipX-i,sy+1.8,'n');if(P.smile)set(tipX-6,sy+1,'n')}
  if(v=='Golden'){rect(Math.round(hx-2),Math.round(hy-ry-1),5,2,'y');set(hx-2,hy-ry-2,'y');set(hx,hy-ry-3,'y');set(hx+2,hy-ry-2,'y')}
  if(P.star){const sx0=Math.round(hx+1),sy0=Math.round(hy-ry+2);set(sx0,sy0,'y');set(sx0-1,sy0,'y');set(sx0+1,sy0,'y');set(sx0,sy0-1,'y');set(sx0,sy0+1,'y')}
  if(P.moon){const mx0=Math.round(hx+1),my0=Math.round(hy-ry+2);set(mx0,my0-1,'y');set(mx0-1,my0,'y');set(mx0-1,my0+1,'y');set(mx0,my0+2,'y')}
 }
 const belM=P.belly=='a'?'a':P.belly=='w'?'w':null,chM=P.chest||null;
 function decor(by,bx){
  if(belM){tint(cx+1,by+BH*.75,BL*.9,BH*.45,belM);tint(cx+BL-1,by+BH*.1,4.2,BH*.8,belM)}
  if(chM)tint(cx+BL-1,by+BH*.2,3.6,BH*.65,chM);
  if(P.saddle)tint(cx-2,by-BH*.55,BL*.75,BH*.6,P.saddle);
  if(P.spots||P.merle){
   let s=0;for(const ch of b.id)s=(s*31+ch.charCodeAt(0))>>>0;const rnd=()=>(s=(s*1664525+1013904223)>>>0)/4294967296;
   const n=P.merle?9:16;for(let i=0;i<n;i++){const px=cx-BL+rnd()*(BL*2+6),py=by-BH-1+rnd()*(BH*2+L+2),r=P.merle?2+rnd()*2.2:1.1+rnd()*1.2;tint(px,py,r,r,P.merle||P.spots,'bw')}
  }
 }
 const scallop=by=>{for(let k=0;k<16;k++){const a=k/16*Math.PI*2;if(S(a)>.75)continue;ell(cx+C(a)*(BL+.8),by+S(a)*(BH+.6),1.8,1.8,'b')}};
 let hx,hy,by,after=()=>{};
 // ----- body by mode -----
 if(mode=='lie'){
  const hh=BH*.78+(fr?.6:0);by=GY-hh+.5;
  tail(cx-BL,GY-3,'ground');
  ell(cx,by,BL,hh,'b');ell(cx-BL+4,by+.5,BH*.9,hh,'b');
  if(P.fluff>=2)scallop(by);
  hx=cx+BL+3;hy=GY-5-(HS-1)*2;pitch=1;
  path([[cx+BL-4,by-1],[hx-2,hy+2]],3.2,'b');
  decor(by);
  after=()=>{ell(hx+3,GY-1.2,3.6,1.7,'b');ell(hx-2,GY-1,3,1.4,'f');if(P.sock)tint(hx+3,GY-1.2,3.6,1.7,P.sock=='a'?'a':'w')};
 }else if(mode=='sit'){
  const bx=cx+Math.round(BL*.55);by=GY-8;
  leg(bx-3,{dx:0,l:0},GY-12,'f','g');
  tail(cx-Math.round(BL*.45)-3,GY-3,'ground');
  path([[cx-BL*.45,GY-5],[bx,GY-13]],BH*.95,'b');
  ell(cx-BL*.45+1,GY-4.5,6,5,'b');ell(cx-BL*.45+7,GY-1,4,1.6,'b');
  if(P.fluff>=1)ell(bx+1,GY-13,4.5,6,'b');
  leg(bx+1,{dx:0,l:0},GY-12,'b','a');
  hx=bx+3;hy=GY-13-BH*.95-4-(look?1:0);if(look)pitch=-2;
  path([[bx,GY-14],[hx-2,hy+3]],Math.max(3,BH*.55),'b');
  if(belM)tint(bx+2,GY-12,3,7,belM);if(chM)tint(bx+2,GY-12,3,6,chM);
  if(P.saddle)tint(cx-1,GY-9,BL*.5,4,P.saddle);
  if(P.spots||P.merle)decor(GY-14,bx);
 }else if(mode=='bow'){
  const b0=GY-L-BH+1;by=b0;
  const yh=b0-2+BH-3,yf=b0+4+BH-3;
  leg(cx-BL+7,{dx:0,l:0},yh,'f','g');leg(cx+BL-7,{dx:2,l:0},yf,'f','g');
  tail(cx-Math.round(BL*1.1)+1,b0-2-BH+3,'up');
  ell(cx-BL*.4,b0-2,BL*.7,BH,'b');ell(cx,b0+1,BL*.55,BH*.9,'b');ell(cx+BL*.45,b0+4,BL*.62,BH*.9,'b');
  if(P.fluff>=1)ell(cx+BL-1,b0+3,4.5,BH,'b');
  if(P.fluff>=2)scallop(b0+1);
  leg(cx-BL+3,{dx:0,l:0},yh,'b','a');leg(cx+BL-3,{dx:3,l:0},yf,'b','a');
  hx=cx+BL+3;hy=b0+4-BH*.6+1;pitch=.5;
  path([[cx+BL-3,b0+2],[hx-2,hy+2]],Math.max(3,BH*.55),'b');
  decor(b0+1);
 }else{
  by=GY-L-BH+1+dyB;const yt=by+BH-3;
  leg(cx+BL-7,legs[2],yt,'f','g');leg(cx-BL+7,legs[3],yt,'f','g');
  tail(cx-BL+1,by-BH+3,tailM);
  ell(cx,by,BL,BH,'b');ell(cx-BL+3.5,by+1,BH*.85,BH*.9,'b');
  if(P.fluff>=1)ell(cx+BL-1,by-1,4.5,BH,'b');
  if(P.fluff>=2)scallop(by);
  leg(cx+BL-3,legs[0],yt,'b','a');leg(cx-BL+3,legs[1],yt,'b','a');
  if(P.fluff>=3)for(const lx of[cx+BL-3,cx+BL-7,cx-BL+3,cx-BL+7])ell(lx,GY-5,3,2.4,'b');
  hx=cx+BL+2+hdx;hy=by-BH-1+hdy;
  if(headLow==1){hx=cx+BL+4;hy=GY-5-(HS-1)*3}else if(headLow==2){hx=cx+BL+5;hy=GY-11-(HS-1)*3}
  path([[cx+BL-3,by-BH*.3],[hx-2,hy+3]],Math.max(3,BH*.55),'b');
  decor(by);
 }
 head(hx,hy);after();
 // ----- accessories (drawn over the head / neck, then outlined with the dog) -----
 function drawAcc(a){if(!a||!EP)return;const{hx,hy,rx,ry,ex1,ex2,ey}=EP,X=Math.round(hx),Y=Math.round(hy),top=Y-Math.round(ry),nx=X-1,ny=Y+Math.round(ry)-1;
  const M=(x0,y0,rows,pal,only)=>rows.forEach((row,j)=>[...row].forEach((ch,i)=>{if(pal[ch])cs(x0+i,y0+j,pal[ch],only)}));
  switch(a){
   case'bow':M(X-3,top-2,['.PP.PP.','PPPDPPP','.PP.PP.'].map(r=>r),{P:'ff7fae',D:'c83c78'});cs(X-3,top-2,'ffc4da');cs(X+1,top-2,'ffc4da');break;
   case'bandana':{const rows=[9,7,5,3,1];rows.forEach((w,j)=>{for(let i=0;i<w;i++){const x=nx-((w-1)>>1)+i,y=ny+j;cs(x,y,(i+j)%3==1&&j>0?'ffffff':'e0443c')}});for(let i=0;i<9;i++)cs(nx-4+i,ny,'ff6a5a');cs(nx-4,ny+1,'b82a24');break}
   case'scarf':{for(let j=0;j<3;j++)for(let i=0;i<10;i++)cs(nx-5+i,ny-1+j,(i+j*2)%4<2?'3fa8a0':'f2e6c8');for(let j=0;j<4;j++){cs(nx-5,ny+2+j,j%2?'f2e6c8':'3fa8a0');cs(nx-4,ny+2+j,j%2?'3fa8a0':'f2e6c8')}for(let i=0;i<3;i++)cs(nx-5+i,ny+6,'f2e6c8');break}
   case'glasses':{const x0=ex1-1,x1=ex2+2;for(let j=0;j<3;j++){for(let i=0;i<3;i++){cs(x0+i,ey-1+j,'1a1a22');cs(x1-1+i,ey-1+j,'1a1a22')}}cs(x0+1,ey-1,'5a6aa0');cs(x1,ey-1,'5a6aa0');cs(x0+3,ey-1,'1a1a22');cs(x0+4,ey-1,'1a1a22');cs(x0-1,ey,'1a1a22');cs(x0-2,ey+1,'1a1a22');cs(x1+3,ey,'1a1a22');break}
   case'partyhat':{const rows=[1,1,2,2,3,3,4,4,5];rows.forEach((w,j)=>{for(let i=0;i<w;i++){const x=X+1-((w-1)>>1)+i+(j>5?-1:0),y=top-9+j;cs(x,y,(j+i)%3==0?'ffe14a':(j%2?'ff6fae':'6fc8ff'))}});cs(X+1,top-10,'ffffff');cs(X+2,top-10,'ffe14a');cs(X,top-10,'ff6fae');break}
   case'headphones':{for(let k=0;k<=14;k++){const a=Math.PI*(1-k/14),x=X+.5+Math.cos(a)*(rx+.6),y=Y-ry*.3-Math.sin(a)*(ry+1.8);cs(x,y,'2a2e3a');cs(x,y-1,'4a5066')}
    for(let j=0;j<5;j++)for(let i=0;i<4;i++)cs(X-5+i,Y-1+j,i==0||j==0||j==4?'2a2e3a':(i==3?'e0457a':'f2548c'));cs(X-4,Y,'ff9ec0');break}
   case'crown':{M(X-3,top-4,['Y.Y.Y.Y','YYYYYYY','YRYBYRY','YYYYYYY'],{Y:'ffd23a',R:'e8423a',B:'4aa8f0'});cs(X-3,top-4,'fff2a0');cs(X-1,top-4,'fff2a0');cs(X+1,top-4,'fff2a0');cs(X+3,top-4,'fff2a0');M(X-3,top-1,['AAAAAAA'],{A:'c8962a'});break}
   case'witch':{M(X-5,top-1,['KKKKKKKKKKK'],{K:'2a1a3a'});M(X-3,top-2,['KKKKKKK'],{K:'3a2450'});M(X-3,top-3,['KPPPPPK'],{K:'3a2450',P:'8a4ad0'});const rows=[5,4,4,3,3,2,2,2];rows.forEach((w,j)=>{for(let i=0;i<w;i++)cs(X-2+i+(j>4?1+(j>6?1:0):0),top-4-j,'3a2450')});cs(X-1,top-3,'f2c94a');cs(X,top-3,'f2c94a');cs(X+1,top-11,'3a2450');cs(X+2,top-11,'3a2450');break}
   case'santa':{const rows=[6,5,5,4,3,3];rows.forEach((w,j)=>{for(let i=0;i<w;i++)cs(X-3+i+(j>2?j-2:0),top-5+j,'d9322a')});for(let i=0;i<8;i++){cs(X-4+i,top,'ffffff');cs(X-4+i,top-1,i%2?'f4f8ff':'ffffff')}cs(X+4,top-6,'ffffff');cs(X+5,top-6,'ffffff');cs(X+4,top-5,'ffffff');cs(X+5,top-5,'f4f8ff');cs(X+3,top-4,'d9322a');break}
  }}
 drawAcc(acc);
 // ----- outline -----
 const O=G.map(r=>r.slice());
 for(let y=0;y<GH;y++)for(let x=0;x<GW;x++)if(!G[y][x]&&(get(x-1,y)||get(x+1,y)||get(x,y-1)||get(x,y+1)))O[y][x]='o';
 const px=new Uint8ClampedArray(GW*GH*4);let x0=GW,y0=GH,x1=0,y1=0;
 for(let y=0;y<GH;y++)for(let x=0;x<GW;x++){
  const m=O[y][x];if(!m)continue;
  let c;
  switch(m){case'b':c=pl.bodyAt(x,y);break;case'f':c=sh(pl.bodyAt(x,y),-.3);break;case'g':c=sh(pl.a,-.3);break;default:c=pl[m]||XC[m]}
  if('bfagdw'.includes(m)){
   let k=0;if(!get(x,y-1))k=.14;else if(!get(x,y-2))k=.06;if(!get(x,y+1))k=-.2;else if(!get(x,y+2))k=-.09;
   if(k)c=sh(c,k);
   if(v=='Galaxy'&&m=='b'&&(((x*73856093)^(y*19349663))>>>0)%17==0)c=[255,255,255];
  }
  const i=(y*GW+x)*4;px[i]=c[0];px[i+1]=c[1];px[i+2]=c[2];px[i+3]=255;
  if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
 }
 return{w:GW,h:GH,px,bb:{x0,y0,x1:x1+1,y1:y1+1}};
}
root.DOGPIX={gen,PX,GW,GH,GX,GY,PR,FRAMES,prof};
if(typeof module!=='undefined')module.exports=root.DOGPIX;
})(typeof window!=='undefined'?window:globalThis);
