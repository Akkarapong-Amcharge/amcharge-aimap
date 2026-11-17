/* standards.js — ฐานข้อมูลมาตรฐานของ Amcharge สำหรับการคำนวณพลังงาน
 * ===========================================================================
 * ไฟล์นี้คือ "ตัวเลขที่บริษัทยอมรับ" — แก้/เพิ่มที่นี่ที่เดียว แล้ว push ขึ้น GitHub (Vercel deploy เอง)
 *
 * 1) LOSS_PRESETS — ชุดค่า loss มาตรฐาน ให้คนใช้เลือกในหัวข้อ 5
 *    status: 'approved'  = วิศวกรอาวุโสอนุมัติแล้ว ใช้กับลูกค้าได้
 *            'reference' = ค่าอ้างอิงจากแหล่งภายนอก (ยังไม่ใช่มาตรฐานบริษัท)
 *            'draft'     = ร่าง รออนุมัติ
 *    values (หน่วย %, ยกเว้น iamB0 / uc (W/m²K) / albedo):
 *      soiling ฝุ่น · mismatch · quality คุณภาพแผง (ติดลบ = ได้เพิ่ม) · wiring สายไฟ DC ที่ STC
 *      lowLight แสงอ่อนที่ 200 W/m² · iamB0 · uc · albedo
 *    *เงาบังไม่อยู่ในชุดนี้ เพราะขึ้นกับไซต์ — ให้ระบบคำนวณจากความสูงสิ่งกีดขวาง/ขอบกำแพง
 *
 * 2) CALIBRATION_POINTS — จุดปรับเทียบข้อมูลแดด NASA POWER ให้ใกล้ค่าจริง
 *    type 'weather' = จากตารางแดดรายเดือน (PVsyst/Meteonorm) : ghi/dhi = ตัวคูณ, dt = บวกอุณหภูมิ (°C)
 *    type 'yield'   = จากผลผลิตจริงของระบบที่ติดตั้งแล้ว : ghi = dhi = ผลจริง ÷ ผลจำลอง (NASA ดิบ)
 *    ระบบเลือกจุดที่ใกล้ไซต์ที่สุดให้อัตโนมัติ
 *    เพิ่มจุดใหม่: ในหน้าเว็บ หัวข้อ 5 → "จุดปรับเทียบ" → บันทึก → "คัดลอก JSON" แล้ววางต่อท้ายรายการข้างล่าง
 * ===========================================================================
 */
window.AmchargeStandards = {
  LOSS_PRESETS: [
    {
      id: 'ref-mypark',
      label: { th: 'อ้างอิงรายงาน PVsyst · My Park Mall (Enmax 2026)', en: 'Reference: PVsyst report · My Park Mall (Enmax 2026)' },
      status: 'reference',
      source: 'PVsyst V8.1.7, Enmax Solar I, 10/11/2026 — lowLight 1.8% ปรับให้ engine ได้ค่า loss แสงอ่อนเท่ารายงาน (−0.86%)',
      values: { soiling: 3.5, mismatch: 0.5, quality: -0.75, wiring: 1.5, lowLight: 1.8, iamB0: 0.05, uc: 20, albedo: 0.2 }
    }
    // ตัวอย่างการเพิ่มชุดมาตรฐานบริษัท (ใส่ตัวเลขที่วิศวกรอาวุโสอนุมัติแล้วเท่านั้น):
    // , { id: 'amc-factory-2wash', label: { th: 'มาตรฐาน Amcharge · หลังคาโรงงาน ล้างแผง 2 ครั้ง/ปี', en: 'Amcharge std · factory roof, 2 cleanings/yr' },
    //     status: 'approved', source: 'อนุมัติโดย ... วันที่ ...',
    //     values: { soiling: 0, mismatch: 0, quality: 0, wiring: 0, lowLight: 1.8, iamB0: 0.05, uc: 20, albedo: 0.2 } }
  ],

  CALIBRATION_POINTS: [
    {
      id: 'mypark',
      name: { th: 'My Park Mall · คลองกุ่ม กรุงเทพฯ', en: 'My Park Mall · Khlong Kum, Bangkok' },
      lat: 13.7878, lon: 100.6955, type: 'weather', ghi: 0.8907, dhi: 0.9857, dt: 1.25,
      source: 'PVsyst V8.1.7 / Meteonorm 9.0 (Enmax, 2026-11) เทียบ NASA POWER climatology'
    }
  ]
};
