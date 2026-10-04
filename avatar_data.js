// Cozy Dogs - avatar catalog (shared by the server for validation/pricing and embedded into the client for the wardrobe + renderer).
// Every list is [id, English, Thai, price]. price 0 = free from the start; >0 = buy once with coins, then it is yours forever.
'use strict';
const L=(rows)=>rows.map(r=>({id:r[0],en:r[1],th:r[2],p:r[3]|0}));
const HAIR=L([['short','Short crop','ผมสั้น',0],['sidepart','Side part','ผมแสกข้าง',0],['spiky','Spiky','ผมตั้ง',0],['messy','Messy','ผมยุ่ง ๆ',0],['bowl','Bowl cut','ทรงบาวล์',0],
 ['bob','Bob','ผมบ็อบ',0],['long','Long','ผมยาว',0],['ponytail','Ponytail','ผมหางม้า',0],['bun','Top bun','มวยผม',0],['pixie','Pixie','ผมพิกซี่',40],
 ['twin','Pigtails','ผมแกละ',60],['curly','Curly puff','ผมหยิกฟู',80],['braid','Long braid','ผมเปีย',90]]);
const EYES=L([['dot','Dots','ตาจุด',0],['round','Big round','ตากลมโต',0],['sleepy','Sleepy','ตาง่วง',0],['happy','Happy arcs','ตายิ้ม',0],['sparkle','Sparkle','ตาประกาย',40],['cat','Cat eyes','ตาแมว',40]]);
const MOUTH=L([['smile','Smile','ยิ้มนิด ๆ',0],['grin','Big grin','ยิ้มกว้าง',0],['cat','Cat mouth','ปากแมว',0],['flat','Calm','หน้านิ่ง',0],['wow','Wow','อ้าปากว้าว',0]]);
const TOP=L([['tee','T-shirt','เสื้อยืด',0],['tank','Tank top','เสื้อกล้าม',0],['shirt','Collar shirt','เสื้อเชิ้ต',0],['hoodie','Hoodie','ฮู้ดดี้',90],['sweater','Knit sweater','เสื้อไหมพรม',110],
 ['dress','Dress','เดรส',140],['overalls','Overalls','ชุดเอี๊ยม',120],['jacket','Jacket','แจ็กเก็ต',160],['rain','Raincoat','เสื้อกันฝน',200],['uniform','Blazer','เบลเซอร์นักเรียน',220]]);
const PAT=L([['none','Plain','เรียบ ๆ',0],['stripe','Stripes','ลายขวาง',0],['heart','Heart','หัวใจ',0],['star','Star','ดาว',0],['paw','Paw','รอยเท้าหมา',0]]);
const BOT=L([['shorts','Shorts','กางเกงขาสั้น',0],['pants','Pants','กางเกงขายาว',0],['skirt','Skirt','กระโปรง',0],['jogger','Joggers','กางเกงจ๊อกเกอร์',70],['pleat','Pleated skirt','กระโปรงพลีท',90]]);
const SHOE=L([['sneaker','Sneakers','ผ้าใบ',0],['sandal','Sandals','รองเท้าแตะ',0],['boots','Boots','บูท',80],['rain','Rain boots','บูทกันฝน',100]]);
const HAT=L([['none','No hat','ไม่ใส่',0],['cap','Cap','หมวกแก๊ป',60],['beanie','Beanie','หมวกไหมพรม',60],['bow','Big bow','โบว์ใหญ่',80],['party','Party hat','หมวกปาร์ตี้',90],['straw','Straw hat','หมวกฟาง',90],
 ['flowers','Flower crown','มงกุฎดอกไม้',120],['phones','Headphones','หูฟัง',140],['bunny','Bunny ears','หูกระต่าย',150],['cat','Cat ears','หูแมว',150],['halo','Angel halo','ห่วงนางฟ้า',350],['crown','Gold crown','มงกุฎทอง',400]]);
const GLASS=L([['none','No glasses','ไม่ใส่',0],['round','Round','แว่นกลม',70],['square','Square','แว่นเหลี่ยม',70],['shades','Sunglasses','แว่นกันแดด',90],['heart','Heart shades','แว่นหัวใจ',120]]);
const EXTRA=L([['none','Nothing','ไม่มี',0],['bandana','Bandana','ผ้าพันคอสามเหลี่ยม',60],['scarf','Scarf','ผ้าพันคอ',80],['bag','Side bag','กระเป๋าสะพาย',100],['backpack','Backpack','เป้',120],['wings','Angel wings','ปีกนางฟ้า',300]]);
const HOME=[['bl','Back left','มุมหลังซ้าย'],['br','Back right','มุมหลังขวา'],['fl','Front left','มุมหน้าซ้าย'],['fr','Front right','มุมหน้าขวา']].map(r=>({id:r[0],en:r[1],th:r[2]}));
// where the owner stands at home (feet position on the 800x600 floor) and where a dog goes to "seek the owner" (next to them, toward the room centre)
const HOMEPOS={bl:[96,376],br:[704,376],fl:[100,520],fr:[700,520]};
const ownerSpot=(hm)=>{const q=HOMEPOS[hm]||HOMEPOS.bl;return[q[0]+(q[0]<400?58:-58),q[1]+10]};
// colour tables (hex strings; the client draws shaded variants from them)
const SKIN=['#ffe6d6','#fbd3b7','#f1bd96','#dea577','#c58759','#a4673f','#7b482b','#573120'];
const HAIRC=['#2b2230','#4a3228','#6b4630','#8d5a36','#a8482a','#d9772a','#e8b64a','#f6dc8a','#e9e2d4','#b8bcc8','#ff8fb0','#ff5c9a','#b79bff','#6fb8ff','#6fd1a5','#d63c4c'];
const EYEC=['#2a1a1a','#5a3a22','#8a6a2a','#3a8a5a','#3a78c8','#6a7a8a','#8a4ac8','#d84a5a'];
const TOPC=['#ffffff','#fff0d6','#ffb3c8','#ff5c6c','#ff9a4a','#ffd24a','#a8e8c0','#4cb878','#3aa8a8','#8fd0ff','#4a7fe0','#2c3e78','#c9b0ff','#8a5ad0','#8a8f9a','#3a3440'];
const BOTC=['#5b86c4','#2c3e78','#3a3440','#8a8f9a','#c8b08a','#7a5238','#fff0d6','#ffffff','#ffb3c8','#ff5c6c','#4cb878','#8a5ad0'];
const SHOEC=['#ffffff','#3a3440','#7a5238','#ff5c6c','#ffb3c8','#4a7fe0','#ffd24a','#4cb878'];
const LEASH=['#ff5c6c','#ff8fb0','#4a9fff','#6fd1a5','#ffd24a','#b79bff','#ff9a4a','rainbow'];
const KINDS={h:HAIR,e:EYES,m:MOUTH,t:TOP,pt:PAT,b:BOT,s:SHOE,ht:HAT,g:GLASS,x:EXTRA};
const NCOL={sk:SKIN.length,hc:HAIRC.length,ec:EYEC.length,tc:TOPC.length,bc:BOTC.length,sc:SHOEC.length,hk:TOPC.length,xk:TOPC.length,ls:LEASH.length};
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const find=(kind,id)=>KINDS[kind]&&KINDS[kind].find(x=>x.id===id);
// ---- default look from a name (stable, uses free items only)
function hash(s){let h=2166136261;for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)>>>0}return h>>>0}
function defaults(name){const h0=hash(name);let s=h0||1;const r=n=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s%n};
 const free=a=>a.filter(x=>!x.p);const f=(a)=>free(a)[r(free(a).length)].id;
 return{sk:r(6),h:f(HAIR),hc:r(10),e:f(EYES),ec:r(5),m:f(MOUTH),bl:r(3)>0?1:0,fr:r(5)==0?1:0,t:f(TOP),tc:r(TOPC.length),pt:'none',b:f(BOT),bc:r(BOTC.length),s:f(SHOE),sc:r(SHOEC.length),ht:'none',hk:r(TOPC.length),g:'none',x:'none',xk:r(TOPC.length),ls:r(7),hm:['bl','br','fl','fr'][r(4)]}}
// ---- validate an incoming avatar: unknown/odd values fall back to `base` (or defaults); returns {av, need:[ 'h:braid', ... ] (premium pieces used), cost}
function clean(inp,base,name){const out=Object.assign({},base||defaults(name||'x'));if(!inp||typeof inp!=='object'||Array.isArray(inp))return{av:out,need:[],cost:0};
 const need=[];let cost=0;
 for(const k in KINDS){const v=inp[k];if(typeof v!=='string'||v.length>16)continue;const it=find(k,v);if(!it)continue;out[k]=v}
 for(const k in NCOL){const v=inp[k];if(Number.isInteger(v)&&v>=0&&v<NCOL[k])out[k]=v}
 for(const k of ['bl','fr']){const v=inp[k];if(v===0||v===1||v===true||v===false)out[k]=v?1:0}
 if(typeof inp.hm==='string'&&HOME.some(x=>x.id===inp.hm))out.hm=inp.hm;
 return{av:out,...price(out)}}
// price info for an avatar: which premium pieces it uses
function used(av){const l=[];for(const k in KINDS){const it=find(k,av[k]);if(it&&it.p)l.push(k+':'+it.id)}return l}
function priceOf(key){const[k,id]=key.split(':');const it=find(k,id);return it?it.p:0}
function price(av,owned){const own_=new Set(owned||[]);const need=used(av).filter(x=>!own_.has(x));return{need,cost:need.reduce((a,x)=>a+priceOf(x),0)}}
module.exports={HOMEPOS,ownerSpot,HAIR,EYES,MOUTH,TOP,PAT,BOT,SHOE,HAT,GLASS,EXTRA,HOME,SKIN,HAIRC,EYEC,TOPC,BOTC,SHOEC,LEASH,KINDS,NCOL,defaults,clean,used,price,priceOf,find,hash};
