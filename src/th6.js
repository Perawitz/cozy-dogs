// Cozy Dogs v6 - Thai names for catalog items, foods, accessories, breeds, personalities, tricks and room styles.
// The server (and the embedded catalog) keep English names; the client shows the Thai one while Settings > Language = Thai.
'use strict';
Object.assign(TH,{
// ---- toys / furniture / rugs / wall decor / seasonal
'Tennis Ball':'ลูกเทนนิส','Frisbee':'จานร่อน','Rope Toy':'เชือกกัดเล่น','Rubber Duck':'เป็ดยาง','Teddy Bear':'ตุ๊กตาหมี','Squeaky Bone':'กระดูกบีบมีเสียง',
'Food Bowl':'ชามอาหาร','Water Bowl':'ชามน้ำ','Dog Bed (Pink)':'เตียงหมา (ชมพู)','Dog Bed (Blue)':'เตียงหมา (ฟ้า)','Dog House':'บ้านหมา',
'Sofa (Pink)':'โซฟา (ชมพู)','Sofa (Blue)':'โซฟา (ฟ้า)','Sofa (Mint)':'โซฟา (มิ้นต์)','Armchair (Yellow)':'เก้าอี้นวม (เหลือง)','Armchair (Teal)':'เก้าอี้นวม (เขียวฟ้า)',
'Bookshelf':'ชั้นหนังสือ','Monstera':'มอนสเตร่า','Potted Plant':'กระถางต้นไม้','Cactus':'กระบองเพชร','Floor Lamp':'โคมไฟตั้งพื้น','Side Table':'โต๊ะข้าง',
'TV Set':'ทีวี','Aquarium':'ตู้ปลา','Fireplace':'เตาผิง',
'Round Rug (Blue)':'พรมกลม (ฟ้า)','Round Rug (Pink)':'พรมกลม (ชมพู)','Striped Rug (Green)':'พรมลายทาง (เขียว)','Striped Rug (Red)':'พรมลายทาง (แดง)',
'Dog Portrait':'ภาพวาดน้องหมา','Sunflower Print':'ภาพดอกทานตะวัน','Paw Print Art':'ภาพรอยเท้าหมา','Wall Clock':'นาฬิกาแขวนผนัง','Wall Shelf':'ชั้นวางผนัง',
'Party Bunting':'ธงราวปาร์ตี้','Neon Bone Sign':'ป้ายไฟนีออนกระดูก',
'Jack-o-lantern':'โคมฟักทอง','Cobweb':'ใยแมงมุม','Christmas Tree':'ต้นคริสต์มาส','Stocking':'ถุงเท้าคริสต์มาส',
// ---- food
'Kibble':'อาหารเม็ด','Treat':'ขนม','Fruit':'ผลไม้','Cookie':'คุกกี้','Bone':'กระดูก','Steak':'สเต็ก','Cake':'เค้ก','Meat':'สเต็ก',
// ---- dog accessories
'Pink Bow':'โบว์สีชมพู','Bandana':'ผ้าบันดานา','Warm Scarf':'ผ้าพันคออุ่น ๆ','Sunglasses':'แว่นกันแดด','Party Hat':'หมวกปาร์ตี้','Headphones':'หูฟัง','Royal Crown':'มงกุฎราชา','Witch Hat':'หมวกแม่มด','Santa Hat':'หมวกซานต้า',
// ---- favourite toys (server sends the short word)
'Ball':'ลูกบอล','Rope':'เชือก','Duck':'เป็ดยาง','Teddy':'ตุ๊กตาหมี','Squeaky':'กระดูกบีบ',
// ---- personalities (shown through nice())
'Playful':'ขี้เล่น','Lazy':'ขี้เกียจ','Energetic':'พลังเยอะ','Shy':'ขี้อาย','Friendly':'เป็นมิตร','Foodie':'นักกิน','Curious':'ช่างสงสัย','Clingy':'ติดเจ้าของ','Brave':'กล้าหาญ','Sleepy':'ขี้ง่วง','Mischievous':'ซุกซน',
// ---- seasons / tricks
'Halloween':'ฮาโลวีน','Christmas':'คริสต์มาส',
'Sit':'นั่ง','Shake':'จับมือ','Spin':'หมุนตัว','Jump':'กระโดด','Roll':'กลิ้ง','Dead':'แกล้งตาย',
// ---- wallpapers / floors / lighting
'Cream':'ครีม','Pink':'ชมพู','Mint':'มิ้นต์','Sky':'ฟ้าใส','Stripe':'ลายทาง','Panel':'แผงไม้','Galaxy':'กาแล็กซี่',
'Wood':'ไม้','Light':'ไม้สีอ่อน','Dark':'ไม้สีเข้ม','Tile':'กระเบื้อง','Carpet':'พรมปูพื้น','Marble':'หินอ่อน',
'Warm':'อบอุ่น','Cool':'เย็นสบาย','Dream':'ฝันหวาน','Sunset':'อาทิตย์อัสดง',
// ---- variants (coat colours)
'Normal':'ปกติ','Chocolate':'ช็อกโกแลต','Golden':'ทองคำ','Rainbow':'สายรุ้ง',
// ---- misc labels
'Age':'อายุ','Quest complete':'ภารกิจสำเร็จ','Use':'ใช้','Sleep':'นอน','Bark':'เห่า','Fetch':'โยนบอลเล่น','✨ Effects':'✨ เอฟเฟกต์','🐾 cozy multiplayer dog house 🐾':'🐾 บ้านน้องหมาแสนอบอุ่น เล่นด้วยกันได้ 🐾',
// ---- breeds
'Chihuahua':'ชิวาวา','Pomeranian':'ปอมเมอเรเนียน','Corgi':'คอร์กี้','Pug':'ปั๊ก','Beagle':'บีเกิ้ล','Dachshund':'ดัชชุนด์','Shih Tzu':'ชิห์สุ','Maltese':'มอลทีส','Yorkshire Terrier':'ยอร์กเชียร์เทอร์เรีย','Bichon Frise':'บิชอง ฟริเซ่',
'Boston Terrier':'บอสตันเทอร์เรีย','Jack Russell Terrier':'แจ็ก รัสเซลล์','Husky':'ฮัสกี้','Shiba Inu':'ชิบะ อินุ','Golden Retriever':'โกลเด้น รีทรีฟเวอร์','Labrador':'ลาบราดอร์','Black Labrador':'ลาบราดอร์ดำ','Dalmatian':'ดัลเมเชียน','Samoyed':'ซามอยด์','Border Collie':'บอร์เดอร์ คอลลี่',
'Poodle':'พุดเดิ้ล','French Bulldog':'เฟรนช์ บูลด็อก','Boxer':'บ็อกเซอร์','Cocker Spaniel':'ค็อกเกอร์ สแปเนียล','American Pit Bull':'อเมริกัน พิทบูล','Schnauzer':'ชเนาเซอร์','Basset Hound':'บาสเซ็ต ฮาวนด์','Akita':'อากิตะ','Chow Chow':'เชา เชา','German Shepherd':'เยอรมัน เชพเพิร์ด',
'Bernese Mountain Dog':'เบอร์นีส เมาน์เทน','Australian Shepherd':'ออสเตรเลียน เชพเพิร์ด','Doberman':'โดเบอร์แมน','Rottweiler':'ร็อตไวเลอร์','Greyhound':'เกรย์ฮาวนด์','Borzoi':'บอร์ซอย','Rhodesian Ridgeback':'โรเดเชียน ริดจ์แบ็ก','Alaskan Malamute':'อะแลสกัน มาลามิวต์','Saint Bernard':'เซนต์ เบอร์นาร์ด','Great Dane':'เกรท เดน',
'Newfoundland':'นิวฟันด์แลนด์','English Mastiff':'อิงลิช มาสทิฟ','Great Pyrenees':'เกรท ไพเรนีส','Galaxy Husky':'ฮัสกี้กาแล็กซี่','Rainbow Corgi':'คอร์กี้สายรุ้ง','Cloud Puppy':'ลูกหมาก้อนเมฆ','Crystal Puppy':'ลูกหมาคริสตัล','Star Puppy':'ลูกหมาดวงดาว','Moonlight Shiba':'ชิบะแสงจันทร์','Flame Puppy':'ลูกหมาเปลวเพลิง'
});

// ---- catalog names follow the language setting: S.cat.items[id].n / S.cat.food[id].n / S.cat.acc[id].n are getters that call t()
function localizeCat(C){
 if(!C)return C;
 for(const grp of [C.items,C.food,C.acc]){
  if(!grp)continue;
  for(const k in grp){
   const o=grp[k];if(!o||typeof o!='object'||typeof o.n!='string'||Object.prototype.hasOwnProperty.call(o,'_en'))continue;
   const en=o.n;
   Object.defineProperty(o,'_en',{value:en,enumerable:false});
   Object.defineProperty(o,'n',{get(){return t(en)},set(v){},enumerable:true,configurable:true});
  }
 }
 return C;
}

// ---- a few server toasts still carry English words: translate them here while the language is Thai
const EVT_TH={'found a ball!':'เจอลูกบอล!','fell asleep on the sofa.':'หลับบนโซฟาแล้ว','wants to play!':'อยากเล่นแล้ว!','discovered a new place!':'ค้นพบที่ใหม่ๆ!','brought you a toy!':'เอาของเล่นมาให้คุณ!','is looking out the window.':'กำลังมองออกไปนอกหน้าต่าง','is chasing a butterfly 🦋':'กำลังไล่จับผีเสื้อ 🦋','is rolling around happily!':'กลิ้งไปมาอย่างมีความสุข!'};
function locEvent(s){      // the little ticker messages come from the server in one language; show them in the player's
 if(typeof s!='string')return s;let m;const th=S.set.lang=='th';
 if(th){if(m=/^🐶 (.+?) (found a ball!|fell asleep on the sofa\.|wants to play!|discovered a new place!|brought you a toy!|is looking out the window\.|is chasing a butterfly 🦋|is rolling around happily!)$/.exec(s))return'🐶 '+m[1]+' '+EVT_TH[m[2]];
  if(m=/^⛏️ (.+?) dug up (a shiny gem 💎|a buried coin 💰|a buried coin 💰)(.*)$/.exec(s))return'⛏️ '+m[1]+' '+(m[2][2]=='s'||m[2].includes('gem')?'ขุดเจอเพชรแวววาว 💎':'ขุดเจอเหรียญที่ถูกฝังไว้ 💰')+m[3]}
 else{const r=/^💤 (.+?) และ (.+?) นอนด้วยกัน(.*)$/.exec(s);if(r)return'💤 '+r[1]+' and '+r[2]+' are napping together'+r[3];
  if(m=/^🐶 (.+?) หิวแล้ว!$/.exec(s))return'🐶 '+m[1]+' is hungry!'}
 return s}
function locMsg(s){
 if(S.set.lang!='th'||typeof s!='string')return s;
 let m;
 if(m=/^🎓 (.+) learned “(.+)”! (.*)$/.exec(s))return'🎓 '+m[1]+' เรียนท่า “'+nice(m[2])+'” สำเร็จ! '+m[3];
 if(m=/^👏 (.+) did “(.+)”$/.exec(s))return'👏 '+m[1]+' ทำท่า “'+nice(m[2])+'”';
 if(m=/^😋 (.+) loves (.+)!$/.exec(s))return'😋 '+m[1]+' ชอบ'+t(m[2])+'มาก!';
 if(m=/^🎉 Daily bonus! (.*)$/.exec(s))return'🎉 โบนัสภารกิจรายวัน! '+m[1];
 if(m=/^📖 Collection (\d+) (.*)$/.exec(s))return'📖 สะสมครบ '+m[1]+' สายพันธุ์ '+m[2];
 if(m=/^🏆 (.+?) (\+\d.*)$/.exec(s))return'🏆 '+t(m[1])+' '+m[2];
 if(m=/^✅ Quest complete: (.+)$/.exec(s))return'✅ ภารกิจสำเร็จ: '+t(m[1]);
 if(m=/^🎨 ปลดล็อก (\w+)!$/.exec(s))return'🎨 ปลดล็อก '+nice(m[1])+'!';
 return s;
}
