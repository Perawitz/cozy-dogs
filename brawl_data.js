// Cozy Dogs - Dog Brawl data, shared by the server (rules engine, brawl.js) and the client (stat cards, skill buttons).
// build.js embeds this file in public/index.html as window.BRD, so both sides always agree on the numbers.
// Every dog's power comes from its breed: rarity + body size + a fighting style ("archetype"), and each breed owns 2 skills.
'use strict';
const RT={C:0,R:1,E:2,L:3,M:4};

// ---- fighting style per breed (hand-picked for flavour; a breed that is not listed falls back to a size-based guess)
const ARCH_OF={};
for(const [arch,ids] of Object.entries({
 fighter:'chihuahua dachshund yorkie blacklab boxer pitbull akita gsd doberman rottweiler rhodesian malamute greatdane flamepuppy',
 tank:   'pug boston labrador frenchie schnauzer basset chowchow bernese saintbernard newfoundland mastiff crystalpuppy',
 speedy: 'corgi beagle jackrussell husky dalmatian bordercollie aussie greyhound borzoi galaxyhusky moonshiba',
 trick:  'pomeranian shihtzu maltese bichon shiba golden samoyed poodle cocker pyrenees rainbowcorgi cloudpuppy starpuppy'}))
 for(const id of ids.split(' '))ARCH_OF[id]=arch;
// per-style tuning: hp / atk are multipliers, def / spd are additions, en0 = starting energy
const ARCH={
 fighter:{hp:.99,atk:1.16,def:-.7,spd:.5, en0:1,n:['Fighter','นักสู้'],ic:'⚔️'},
 tank:   {hp:1.02,atk:.93,def:2.4,spd:-1.4,en0:1,n:['Tank','ตัวถึก'],ic:'🛡️'},
 speedy: {hp:1,   atk:1.04,def:-.9,spd:3.1,en0:1,n:['Speedster','สายเร็ว'],ic:'💨'},
 trick:  {hp:1,   atk:1,   def:1.2,spd:1,  en0:2,n:['Trickster','สายแสบ'],ic:'🎩'}};

// centre dog (hp, atk, def, spd) and how far rarity (per tier) and body size (per unit above 0.85) move each stat.
// hp / atk move by a fraction, def / spd by points. HP is deliberately kept in a narrow band: it decides who survives.
const TUNE={base:[92,26,3,6],rar:[.01,.02,.35,.25],size:[.04,.10,1.2,-3]};

// ---- skills. cost = energy, tgt = one enemy / all enemies / self, mult = attack multiplier, hits = number of hits
const SK={
 bite:  {ic:'🦷',cost:2,tgt:'one', mult:.45,hits:3,n:['Frenzy Bite','กัดรัว'],d:['3 quick bites, 45% power each','กัด 3 ครั้งติด ครั้งละ 45% ของพลังโจมตี']},
 smash: {ic:'💥',cost:3,tgt:'one', mult:2,pierce:1,n:['Bone Smash','ทุบกระดูก'],d:['One huge 200% hit that pierces guard','ฟาดหนัก 200% ทะลุการป้องกันบางส่วน']},
 whip:  {ic:'🌀',cost:2,tgt:'all', mult:.6,n:['Tail Whip','ตีหางหมุน'],d:['Hits every enemy for 60% power','ตีศัตรูทุกตัว 60% ของพลังโจมตี']},
 pounce:{ic:'🐾',cost:2,tgt:'one', mult:1.4,pri:1,n:['Quick Pounce','กระโจนเร็ว'],d:['140% hit that always strikes first','โจมตี 140% และลงมือก่อนใครเสมอ']},
 bark:  {ic:'😱',cost:2,tgt:'one', mult:.6,sc:.45,n:['Scary Bark','เห่าขู่'],d:['60% hit; the target\'s next attack drops to 45%','โจมตี 60% และการโจมตีครั้งหน้าของเป้าหมายเหลือ 45%']},
 steal: {ic:'🦴',cost:2,tgt:'one', mult:.9,take:2,n:['Bone Thief','ขโมยกระดูก'],d:['90% hit and steals 2 energy','โจมตี 90% และขโมยพลังงาน 2 หน่วย']},
 howl:  {ic:'📣',cost:3,tgt:'all', mult:.35,wk:.7,n:['Thunder Howl','หอนก้องฟ้า'],d:['35% to all enemies and weakens them (−30% ATK next round)','โจมตีศัตรูทุกตัว 35% และทำให้อ่อนแรง (โจมตี −30% รอบหน้า)']},
 fluff: {ic:'☁️',cost:2,tgt:'self',shield:24,n:['Fluffy Shield','ขนฟูกันกระแทก'],d:['A 24-point shield for 2 rounds','ได้โล่ 24 แต้ม นาน 2 รอบ']},
 nap:   {ic:'😴',cost:3,tgt:'self',heal:.26,n:['Power Nap','งีบเอาแรง'],d:['Heal 26% of max HP','ฟื้น HP 26% ของ HP สูงสุด']},
 zoom:  {ic:'💨',cost:2,tgt:'self',up:1.1,n:['Zoomies','วิ่งซิ่งหลบ'],d:['Dodge every attack this round, then +10% ATK for 2 rounds','หลบทุกการโจมตีในรอบนี้ แล้วโจมตี +10% อีก 2 รอบ']},
 eyes:  {ic:'🥺',cost:2,tgt:'self',p:.65,n:['Puppy Eyes','ตาแป๋ว'],d:['Each attacker has a 65% chance to melt and skip you','ผู้โจมตีแต่ละตัวมีโอกาส 65% ใจอ่อนไม่ลงมือกับคุณ']},
 treat: {ic:'🍖',cost:2,tgt:'self',heal:.1,up:1.5,n:['Treat Time','ขนมวิเศษ'],d:['Heal 10% HP and +50% ATK for 2 rounds','ฟื้น HP 10% และโจมตี +50% นาน 2 รอบ']},
 rage:  {ic:'🔥',cost:3,tgt:'self',up:1.9,n:['Mad Dog','โหมดบ้าพลัง'],d:['+90% ATK for the next 2 rounds, but DEF is halved for 3 rounds (this round included)','โจมตี +90% ใน 2 รอบถัดไป แต่ป้องกันลดครึ่ง 3 รอบ (นับรอบนี้ด้วย)']}};
// the two basic moves every dog has
const BASIC={atk:{ic:'🐕',n:['Bite','กัด'],d:['A normal attack on one enemy','โจมตีศัตรูหนึ่งตัวตามปกติ']},
             grd:{ic:'🛡️',n:['Guard','ป้องกัน'],d:['Take half damage this round and gain +1 extra energy','รับดาเมจครึ่งเดียวในรอบนี้ และได้พลังงานเพิ่ม +1']}};
// each style owns a pool of "signature" skills and a pool of "support" skills; the breed id picks one of each
const POOL={fighter:[['smash','bite','pounce','rage'],['bark','whip','steal','treat']],
            tank:   [['fluff','nap','smash','howl'],['bark','eyes','whip','treat']],
            speedy: [['zoom','pounce','bite','steal'],['eyes','whip','treat','bark']],
            trick:  [['eyes','treat','steal','howl'],['nap','zoom','fluff','bark','whip']]};

const hash=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0};
const archOf=(id,size)=>ARCH_OF[id]||(size>=1.15?'tank':size<=.8?'speedy':'fighter');

// -> {arch, hp, atk, def, spd, en0, sk:[skillId,skillId]}
function statsFor(id,r,size){
 const rt=RT[r]||0,sz=+size||.9,arch=archOf(id,sz),m=ARCH[arch],T=TUNE,z=sz-.85;
 const hp=T.base[0]*(1+rt*T.rar[0]+z*T.size[0])*m.hp,atk=T.base[1]*(1+rt*T.rar[1]+z*T.size[1])*m.atk;
 const def=T.base[2]+rt*T.rar[2]+z*T.size[2]+m.def,spd=T.base[3]+rt*T.rar[3]+z*T.size[3]+m.spd;
 const h=hash(id),pa=POOL[arch][0],pb=POOL[arch][1];
 return{arch,hp:Math.round(hp),atk:Math.round(atk),def:Math.max(1,Math.min(9,Math.round(def))),spd:Math.max(2,Math.min(12,Math.round(spd))),en0:m.en0,
  sk:[pa[h%pa.length],pb[(h>>>4)%pb.length]]}}

// how long the client animates each kind of battle event (ms). The server uses the same numbers to schedule the next round.
const EVMS={act:380,hit:480,miss:380,cancel:420,heal:460,shield:380,buff:340,debuff:360,steal:360,ko:800,fizzle:120};
const evTime=ev=>ev.reduce((s,e)=>s+(EVMS[e.k]||300),0);
const CFG={ms:7000,rounds:6,maxEn:5};

module.exports={RT,TUNE,ARCH,ARCH_OF,SK,BASIC,POOL,statsFor,archOf,hash,EVMS,evTime,CFG};
