// Cozy Dogs v7 - shared dog "genetics" data. The SAME file runs on the server and (inlined) in the page, so both sides always agree.
//   growth stages  : Baby -> Puppy -> Teen -> Adult, by the dog's age (env CD_GROW speeds the clock up for demos / tests)
//   cute traits    : little marks / accessories a dog is born with (found in eggs, or passed on / mutated when breeding). Each one has a small buff.
//   dog key        : the string the page uses to draw a dog: base breed [+ other breed ~ look seed] [. stage] [# traits]   e.g. corgi+husky~3.p#blush-star
'use strict';
const HOUR=36e5;
const STAGE_H=[6,24,72];                       // growth hours: Baby <6h, Puppy <24h, Teen <72h, Adult after that
const STAGES=[
 {k:'baby', e:'🍼',en:'Baby', th:'เบบี๋'},
 {k:'puppy',e:'🐶',en:'Puppy',th:'ลูกหมา'},
 {k:'teen', e:'🐕',en:'Teen', th:'วัยรุ่น'},
 {k:'adult',e:'🦮',en:'Adult',th:'โตเต็มวัย'}];
const ADULT_MS=STAGE_H[2]*HOUR;
const stageOf=(born,now,gk=1)=>{if(!Number.isFinite(born))return 3;const h=(now-born)*gk/HOUR;return h<STAGE_H[0]?0:h<STAGE_H[1]?1:h<STAGE_H[2]?2:3};
// real milliseconds until the dog reaches the next stage (0 = already adult)
const nextIn=(born,now,gk=1)=>{if(!Number.isFinite(born))return 0;const s=stageOf(born,now,gk);return s>=3?0:Math.max(0,Math.ceil(STAGE_H[s]*HOUR/gk-(now-born)))};

// tier 1 common, 2 uncommon, 3 rare.  b = buffs: bond (+extra bond per care), wish (+% wish coins), xp (+% care XP), decay (-% need decay), show (dog-show charm), sell (+% sale price), dig (+% dug coins)
const TRAITS=[
 {id:'blush',  e:'🍑',tier:1,en:'Rosy Cheeks',  th:'แก้มแดงระเรื่อ',   b:{bond:1},          den:'Cuddles give +1 extra Bond.',        dth:'ลูบ/เล่นแล้ว Bond เพิ่มอีก +1'},
 {id:'freckle',e:'🍪',tier:1,en:'Freckles',     th:'ลายกระจุ๋มจิ๋ม',   b:{sell:.1},         den:'Sells for 10% more.',                dth:'ขายได้ราคาดีขึ้น 10%'},
 {id:'moon',   e:'🌙',tier:1,en:'Moon Mark',    th:'รอยพระจันทร์',      b:{decay:.2},        den:'Gets hungry & tired 20% slower.',    dth:'หิว/เหนื่อยช้าลง 20%'},
 {id:'cloud',  e:'☁️',tier:1,en:'Cloud Fluff',  th:'ปุยเมฆ',            b:{xp:.2},           den:'+20% care XP.',                      dth:'ดูแลแล้วได้ XP เพิ่ม 20%'},
 {id:'bandit', e:'🦝',tier:1,en:'Tiny Bandit',  th:'หน้ากากโจรจิ๋ว',    b:{dig:.5},          den:'Digs up +50% coins.',                dth:'ขุดเจอเหรียญเพิ่ม 50%'},
 {id:'blep',   e:'😛',tier:1,en:'Blep',         th:'แลบลิ้นเล่น',       b:{wish:.15},        den:'+15% wish rewards.',                 dth:'ทำตามคำขอได้รางวัลเพิ่ม 15%'},
 {id:'heart',  e:'💗',tier:2,en:'Heart Mark',   th:'รอยหัวใจ',          b:{bond:1,show:1},   den:'+1 Bond per care, a bit more charm.',dth:'Bond +1 ทุกครั้งที่ดูแล และเสน่ห์ในการประกวดเพิ่ม'},
 {id:'star',   e:'⭐',tier:2,en:'Star Mark',    th:'รอยดาว',            b:{show:2},          den:'Shines in dog shows.',               dth:'เด่นในการประกวด'},
 {id:'sprout', e:'🌱',tier:2,en:'Little Sprout',th:'ต้นอ่อนบนหัว',      b:{decay:.25},       den:'Needs drop 25% slower.',             dth:'ค่าต่างๆ ลดช้าลง 25%'},
 {id:'flower', e:'🌼',tier:2,en:'Flower Pin',   th:'ดอกไม้ข้างหู',      b:{show:2,wish:.1},  den:'Pretty in shows, +10% wish rewards.',dth:'สวยเด่นในการประกวด และรางวัลคำขอ +10%'},
 {id:'bubble', e:'💭',tier:2,en:'Bubble Pup',   th:'ฟองสบู่ลอย',        b:{decay:.2,xp:.1},  den:'Stays clean longer, +10% XP.',       dth:'ตัวสะอาดนานขึ้น และ XP +10%'},
 {id:'bee',    e:'🐝',tier:2,en:'Honey Antenna',th:'หนวดผึ้งน้อย',      b:{dig:.3,xp:.1},    den:'+30% dug coins, +10% XP.',           dth:'ขุดเจอเหรียญ +30% และ XP +10%'},
 {id:'halo',   e:'😇',tier:3,en:'Little Angel', th:'วงแหวนนางฟ้า',      b:{wish:.4,show:3},  den:'+40% wish rewards, big charm.',      dth:'รางวัลคำขอ +40% เสน่ห์สูงมาก'},
 {id:'wings',  e:'🕊️',tier:3,en:'Tiny Wings',   th:'ปีกจิ๋ว',           b:{xp:.3,show:3},    den:'+30% care XP, big charm.',           dth:'XP ดูแล +30% เสน่ห์สูงมาก'},
 {id:'sparkle',e:'✨',tier:3,en:'Glitter Coat', th:'ขนประกายระยิบ',     b:{sell:.3,show:3},  den:'Sells for 30% more, big charm.',     dth:'ขายได้ราคา +30% เสน่ห์สูงมาก'},
 {id:'rainbow',e:'🌈',tier:3,en:'Rainbow Back', th:'สายรุ้งบนหลัง',     b:{bond:1,wish:.2,sell:.2,show:4},den:'A bit of everything!',      dth:'ดีรอบด้าน! Bond+1 รางวัลคำขอ+20% ขายแพงขึ้น 20%'},
 {id:'frosty', e:'❄️',tier:3,en:'Frosty',       th:'หมาน้ำแข็ง',        b:{decay:.3,show:3}, den:'Needs drop 30% slower, big charm.',  dth:'ค่าต่างๆ ลดช้าลง 30% เสน่ห์สูงมาก'}];
const TR=Object.fromEntries(TRAITS.map(t=>[t.id,t]));
const TIER_NAME={1:{en:'Common',th:'ธรรมดา'},2:{en:'Uncommon',th:'น่ารัก'},3:{en:'Rare',th:'หายาก'}};
const isTrait=id=>typeof id=='string'&&Object.prototype.hasOwnProperty.call(TR,id);
const cleanTraits=a=>{const o=[];for(const x of Array.isArray(a)?a:[])if(isTrait(x)&&!o.includes(x))o.push(x);return o.slice(0,2)};
const buff=(d,k)=>{let v=0;for(const id of cleanTraits(d&&d.tr))v+=TR[id].b[k]||0;return v};
// pick a trait: tierW = weights for tier 1/2/3
const rollTrait=(rnd=Math.random,tierW=[62,31,7],not=[])=>{
 const W=tierW.reduce((a,b)=>a+b,0);let x=rnd()*W,tier=1;for(let i=0;i<3;i++){if(x<tierW[i]){tier=i+1;break}x-=tierW[i]}
 const pool=TRAITS.filter(t=>t.tier==tier&&!not.includes(t.id));const all=pool.length?pool:TRAITS.filter(t=>!not.includes(t.id));return all.length?all[Math.floor(rnd()*all.length)].id:null};

// ---- what a shop pays for a dog (the page shows the same number): rarity base x growth stage x bond x mixed breed x 'sell' traits.  Premium breeds: 40% of the coin price / 18 coins per gem.
const SELL_BASE={C:25,R:70,E:170,L:450,M:1100},SELL_STAGE=[.35,.55,.8,1];
function sellValue(d,rar,price,now,gk){let base=SELL_BASE[rar]||25;if(price)base=price.c?price.c*.4:(price.g||0)*18;
 const v=base*SELL_STAGE[stageOf(d.born,now,gk)]*(1+Math.min(100,d.bond|0)/250)*(isMixed(d)?1.15:1)*(1+buff(d,'sell'));return Math.max(5,Math.round(v))}

// ---- genes: every dog carries two breed "alleles" (a purebred has the same one twice; a mixed breed (พันทาง) has two different ones)
const alleles=d=>[d.breed,d.mix&&d.mix!=d.breed?d.mix:d.breed];
const isMixed=d=>!!(d&&d.mix&&d.mix!=d.breed);

// ---- the string the page draws from.  has(id) tells whether a breed id exists.
function keyOf(d,now,gk,has){
 let k=String(d.breed);if(has&&!has(k))return k;
 if(isMixed(d)&&(!has||has(d.mix)))k+='+'+d.mix+'~'+((d.ms|0)&7);
 const s=stageOf(d.born,now,gk);if(s<3)k+='.'+'bpt'[s];
 const t=cleanTraits(d.tr);if(t.length)k+='#'+t.join('-');
 return k}
const KEYRE=/^([a-z0-9]+)(?:\+([a-z0-9]+)~(\d))?(?:\.([bpt]))?(?:#([a-z0-9-]+))?$/;
function parseKey(id){const m=KEYRE.exec(String(id));if(!m)return null;return{base:m[1],mix:m[2]||null,ms:+m[3]||0,st:m[4]?'bpt'.indexOf(m[4]):3,tr:m[5]?m[5].split('-').filter(isTrait):[]}}

module.exports={SELL_BASE,sellValue,HOUR,STAGE_H,STAGES,ADULT_MS,stageOf,nextIn,TRAITS,TR,TIER_NAME,isTrait,cleanTraits,buff,rollTrait,alleles,isMixed,keyOf,parseKey};
