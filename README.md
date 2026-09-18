# Amcharge AI Roof Planner — เดโม v0.1

เดโมพิสูจน์คอนเซปต์: **วาดหลังคาบนแผนที่ดาวเทียม → เครื่องยนต์คำนวณแบบ deterministic → AI อธิบายผล**
สร้างเป็นเว็บแอปไฟล์เดียว เปิดในเครื่องได้เลย ไม่ต้องลง Node/Python

## วิธีเปิด (เลือกทางใดทางหนึ่ง)

**แนะนำ — ผ่าน local server (AI จริงทำงานแน่นอน):**
1. คลิกขวาที่ `serve.ps1` > **Run with PowerShell**
   (หรือเปิด PowerShell แล้วรัน: `powershell -ExecutionPolicy Bypass -File serve.ps1`)
2. เปิดเบราว์เซอร์ไปที่ **http://localhost:8765/**

**เร็วสุด — ดับเบิลคลิก `index.html`** (เปิดแบบ `file://`)
แผนที่ + การคำนวณทำงานครบ แต่การเรียก Claude API จาก `file://` อาจติด CORS — ถ้าจะใช้ AI จริงให้ใช้ local server ด้านบน

## ใช้งาน
1. **วาดหลังคา** — กด "เริ่มวาดหลังคา" คลิกมุมหลังคาทีละจุด แล้วกด "เสร็จ" (หรือดับเบิลคลิก)
2. **ปรับพารามิเตอร์** — เลือกรุ่นแผง/segment, ใส่ความชัน, หมุนทิศวางแผง (azimuth), setback
3. ระบบวางแผงและสรุป **จำนวนแผง / kWp / พื้นที่จริง vs เงา** ให้อัตโนมัติ
4. **ให้ AI อธิบายผล** — กดปุ่มในการ์ด 4 (ใส่ Anthropic API key ที่ปุ่ม "ตั้งค่า AI" ก่อน จึงจะเป็น Claude จริง มิฉะนั้นเป็นสรุป template)

## ตรงกับ Architecture Brief อย่างไร
| Brief | ในเดโม |
|---|---|
| หลักการแกนกลาง — AI อธิบาย, engine คำนวณ | `engine.js` คำนวณทั้งหมด (pure function), `ai.js` อธิบายอย่างเดียว |
| §3.1 พื้นที่จริง = เงา ÷ cos(tilt) | แสดง projected และ true แยกกันเสมอ |
| G-02 ห้าม AI แตะตัวเลข | AI ได้รับตัวเลขสำเร็จ ห้ามคำนวณใหม่ (ระบุใน system prompt + badge) |
| G-05 ห้าม default tilt เงียบๆ | เช็ค "ไม่ทราบความชัน" → เตือนชัดเจน |
| AD-02 ห้าม digitize บน Google | ใช้ **Leaflet + Esri World Imagery** ไม่แตะ Google เลย |
| AD-06 rules แยก segment | C&I / Residential มี default setback ต่างกัน |
| AD-07 yield เป็น indicative | ทุกผลติดป้าย "เบื้องต้น ยังไม่ผูกพัน" |

## ยังเป็นของสาธิต (ต้องทำต่อในแอปจริง)
- ค่า setback / walkway / row spacing เป็นค่าเดโม — ค่าจริงรอวิศวกรอาวุโส (**O-05**)
- ยังไม่มี Solar API / annualFlux / heatmap (Phase 2)
- ยังไม่มี Supabase / RLS / บันทึกเวอร์ชัน / audit (แอปจริง)
- ManualDraw ยังไม่มีแก้ไขจุด/ลากย้าย (v0.1)
- ต้องยืนยัน terms ของ Esri สำหรับใช้เชิงพาณิชย์ (**O-03**)

## ไฟล์
- `engine.js` — DeterministicLayoutEngine (pure, ยกไปแอปจริง TypeScript ได้ตรงๆ)
- `app.js` — แผนที่ Leaflet + วาดหลังคา + เชื่อม engine
- `ai.js` — เรียก Claude API (อธิบายเท่านั้น) + template fallback
- `index.html`, `style.css` — UI
- `serve.ps1` — static server เล็กๆ
