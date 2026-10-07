# วิธีเปิดปุ่ม "Sign in with Google" (ทำครั้งเดียว ประมาณ 10 นาที)

โค้ดล็อกอินด้วย Google **เขียนเสร็จและทดสอบแล้ว** แต่ปุ่มจะโผล่ก็ต่อเมื่อเซิร์ฟเวอร์รู้ "Client ID" ของโปรเจกต์ Google ของคุณ
(Client ID สร้างได้เฉพาะเจ้าของบัญชี Google เท่านั้น ผมสร้างให้แทนไม่ได้) ทำตามนี้ทีละข้อครับ

## เช็กก่อนว่าตอนนี้เปิดอยู่ไหม
เปิดลิงก์นี้ในเบราว์เซอร์: https://cozy-dogs.onrender.com/config.json
- เห็น `"google":null` = **ยังไม่ได้ตั้ง** (ไม่มีปุ่ม Google) → ทำตามขั้นตอนด้านล่าง
- เห็น `"google":"1234-abc.apps.googleusercontent.com"` = **ตั้งแล้ว** ปุ่มจะขึ้นใต้ฟอร์มล็อกอิน

## ขั้นตอน
1. เข้า https://console.cloud.google.com/ ล็อกอินด้วยบัญชี Google ของคุณ → กดเลือกโปรเจกต์ด้านบน → **New Project** → ตั้งชื่ออะไรก็ได้ (เช่น `cozy-dogs`) → Create
2. เมนูซ้าย **APIs & Services → OAuth consent screen** (บางบัญชีชื่อ **Google Auth Platform**) → เลือก **External** → ใส่ชื่อแอป `Cozy Dogs` และอีเมลของคุณ (ช่องอีเมลติดต่อ) → Save จนจบทุกหน้า (ไม่ต้องเพิ่ม scope)
3. กลับหน้า OAuth consent screen → กดปุ่ม **Publish app** (ให้สถานะเป็น **In production**)
   - ถ้าค้างเป็น "Testing" จะมีแค่อีเมลที่เพิ่มเป็น Test user เท่านั้นที่ล็อกอินได้ อาจารย์จะเข้าไม่ได้
4. เมนู **Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
   - ช่อง **Authorized JavaScript origins** → กด **Add URI** ใส่ `https://cozy-dogs.onrender.com` (ต้องตรงทุกตัวอักษร ไม่มี `/` ต่อท้าย)
   - ถ้าจะลองบนเครื่องตัวเองด้วย เพิ่มอีก 2 บรรทัด: `http://localhost` และ `http://localhost:3000`
   - ช่อง Redirect URI **ไม่ต้องใส่**
   - กด **Create** แล้วคัดลอก **Client ID** (ยาว ๆ ลงท้าย `.apps.googleusercontent.com`) — Client secret ไม่ต้องใช้
5. ไปที่ https://dashboard.render.com → เลือกเซอร์วิส `cozy-dogs` → แท็บ **Environment** → **Add Environment Variable**
   - Key: `GOOGLE_CLIENT_ID`
   - Value: Client ID ที่คัดลอกมา
   - กด **Save Changes** (Render จะ deploy ใหม่เอง รอ 1-2 นาที)
6. เปิดเกมใหม่ → เห็นปุ่ม **Sign in with Google** ใต้ฟอร์มล็อกอิน และแท็บสมัครสมาชิก

## ถ้ามีปัญหา
- ปุ่มขึ้นว่า *origin is not allowed* → URL ใน Authorized JavaScript origins ไม่ตรงกับที่เปิดอยู่ (ตรวจ https / ตัวสะกด / ไม่มี `/` ท้าย) หรือรอสักครู่ให้ Google อัปเดต (5 นาที ถึงไม่กี่ชั่วโมง)
- เปิด `/config.json` แล้วยังเป็น `null` → ใส่ชื่อ Key ผิด (ต้องเป็น `GOOGLE_CLIENT_ID` พอดี) หรือ Render ยัง deploy ไม่เสร็จ
- เปิดเกมผ่านแอป Instagram / Facebook / LINE มักถูกบล็อก → ให้เปิดด้วย Chrome / Safari
- รันบนเครื่อง Windows: CMD พิมพ์ `set GOOGLE_CLIENT_ID=ใส่ไอดี` แล้ว `node server.js` (PowerShell: `$env:GOOGLE_CLIENT_ID="ใส่ไอดี"`)

## ไว้ตอบอาจารย์ (ปลอดภัยแค่ไหน)
เบราว์เซอร์ได้ ID token (JWT) จาก Google แล้วส่งให้เซิร์ฟเวอร์ → **เซิร์ฟเวอร์ตรวจเอง**: ลายเซ็น RS256 กับกุญแจสาธารณะของ Google, ผู้ออก, ผู้รับต้องเป็น Client ID ของเรา, วันหมดอายุ และอีเมลที่ยืนยันแล้ว
บัญชีผูกกับ ID ถาวรของ Google (`sub`) ไม่ใช่อีเมล เพื่อกันคนสมัครด้วยอีเมลคนอื่น · รายละเอียดอยู่ใน README หัวข้อ v6.3
