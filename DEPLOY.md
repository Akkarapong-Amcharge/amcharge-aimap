# Deploy ขึ้น URL สาธารณะ — Amcharge AI Roof Planner

เดโมนี้เป็น **static site ล้วน** (HTML/CSS/JS + โลโก้ · แผนที่/ฟอนต์โหลดจาก CDN · ไม่มี backend)
→ ลากทั้งโฟลเดอร์ `demo` ขึ้น hosting ได้เลย ไม่ต้อง build ไม่ต้องลง Node

ไฟล์ที่ต้อง deploy (ทั้งโฟลเดอร์ก็ได้): `index.html`, `style.css`, `i18n.js`, `engine.js`, `app.js`, `logo.png`
ไฟล์ที่ **ไม่จำเป็นต้องขึ้น** (ลบก่อนลากได้ถ้าอยากสะอาด): `serve.ps1`, `เปิดเดโม.bat`, `ai.js`, `README.md`, `DEPLOY.md`

---

## ทางเลือก A — Netlify Drop (เร็วสุด แนะนำ)
1. เปิด **https://app.netlify.com/drop**
2. **ลากโฟลเดอร์ `demo` ทั้งโฟลเดอร์** ไปวางในหน้านั้น
3. รอสักครู่ → ได้ **ลิงก์สาธารณะทันที** (เช่น `https://random-name.netlify.app`)
4. กด Sign up (ฟรี) เพื่อเก็บลิงก์ถาวร + เปลี่ยนชื่อ subdomain ได้ (เช่น `amcharge-roof.netlify.app`)

## ทางเลือก B — Cloudflare Pages (CDN ไทยเร็ว ฟรี)
1. เปิด **https://pages.cloudflare.com** → Create a project → **Direct Upload**
2. ตั้งชื่อโปรเจกต์ → ลากไฟล์ในโฟลเดอร์ `demo` ขึ้นไป
3. Deploy → ได้ลิงก์ `https://<project>.pages.dev`

## ทางเลือก C — GitHub Pages (ถ้าใช้ git อยู่แล้ว)
1. push โฟลเดอร์ `demo` ขึ้น repo
2. Settings → Pages → Source = branch, folder = `/demo` (หรือ root)
3. ได้ลิงก์ `https://<user>.github.io/<repo>/`

---

## ✅ เช็กก่อนแชร์เป็นทางการ (production)
เดโม/แชร์ภายใน = ใช้ได้เลย แต่ถ้าเปิดสาธารณะจริงจัง ควรจัดการ:

- **ภาพแผนที่ (Esri World Imagery)** — ยืนยัน terms การใช้เชิงพาณิชย์ (O-03) หรือย้ายไป **ArcGIS token / MapTiler / GISTDA** พร้อม API key
- **ค้นหาที่อยู่ (Nominatim/OSM)** — มี usage policy (~1 req/วินาที) ปริมาณเยอะควรใช้ geocoder ที่มี plan
- **AI (ตามหลัง)** — จะเสียบเป็น serverless endpoint ที่ถือ API key ฝั่ง server (ไม่หลุดใน browser)
- **HTTPS** — hosting ทั้ง 3 เจ้าให้ https อัตโนมัติ (จำเป็นเพราะเรียก API หลายตัว)

## หมายเหตุ
- ทุกพาธในโค้ดเป็น relative → ทำงานได้ทุก subdomain/subfolder
- ต้องมีอินเทอร์เน็ต (โหลด tiles/ฟอนต์/ค้นหา)
- อัปเดตเว็บ = แก้ไฟล์แล้วลาก deploy ใหม่ (Netlify/Cloudflare ทำ version ให้)
