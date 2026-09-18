/*
 * ai.js — ชั้น AI: "อธิบายและแนะนำ" เท่านั้น (หลักการแกนกลาง / G-02)
 * AI ห้ามคำนวณหรือแก้ตัวเลข — ตัวเลขมาจาก DeterministicLayoutEngine เสมอ
 * เรียก Claude API ตรงจาก browser (ใส่ key เอง) พร้อม template fallback กันพังตอนเดโม
 */
window.RoofAI = (function () {
  'use strict';
  var LS_KEY = 'amcharge_anthropic_key';
  var LS_MODEL = 'amcharge_anthropic_model';

  function getKey() { try { return localStorage.getItem(LS_KEY) || ''; } catch (e) { return ''; } }
  function setKey(k) { try { localStorage.setItem(LS_KEY, k || ''); } catch (e) {} }
  function getModel() { try { return localStorage.getItem(LS_MODEL) || 'claude-sonnet-5'; } catch (e) { return 'claude-sonnet-5'; } }
  function setModel(m) { try { localStorage.setItem(LS_MODEL, m || 'claude-sonnet-5'); } catch (e) {} }

  function n(x, d) { return (x == null ? 0 : x).toLocaleString('th-TH', { maximumFractionDigits: d == null ? 0 : d }); }

  // สรุปเชิงกฎ (ไม่ใช้ network) — ใช้เมื่อยังไม่ใส่ API key
  function template(r, ctx) {
    var lines = [];
    lines.push('สรุปผล (โหมดสาธิต — ยังไม่ได้ตั้งค่า AI จริง)');
    lines.push('หลังคา ' + ctx.segmentLabel + ' พื้นที่จริง ' + n(r.trueAreaSqm) + ' ตร.ม. วางแผง ' + ctx.moduleLabel +
      ' ได้ ' + n(r.panelCount) + ' แผง คิดเป็นกำลังติดตั้ง ' + n(r.dcCapacityKwp, 1) + ' kWp (DC)');
    lines.push('');
    lines.push('ข้อสังเกต');
    lines.push('• พื้นที่จริง = พื้นที่เงา ÷ cos(ความชัน) = ' + n(r.projectedAreaSqm) + ' ÷ cos(' + n(r.tiltDeg, 1) + '°)');
    lines.push('• สัดส่วนพื้นที่ที่แผงคลุมได้ ~ ' + n(r.usableCoverage * 100, 0) + '% (ที่เหลือคือ setback/ขอบ/ช่องเดิน)');
    lines.push('• น้ำหนักแผงรวม ~ ' + n(r.totalWeightKg / 1000, 1) + ' ตัน (โหลดเฉลี่ย ' + n(r.arealLoadKgPerSqm, 1) + ' กก./ตร.ม.) — ต้องเช็คโครงสร้างหลังคารับได้');
    lines.push('');
    lines.push('คำแนะนำ');
    lines.push('• ลองปรับทิศ (azimuth) ให้แผงเรียงตามสันหลังคาเพื่อเพิ่มจำนวนแผง');
    lines.push('• ยืนยันความชันจริงหน้างาน — ค่าความชันกระทบพื้นที่จริงโดยตรง');
    lines.push('');
    lines.push('ข้อควรระวัง: ตัวเลขนี้เป็น "เบื้องต้น (indicative)" ยังไม่ผูกพัน ต้องสำรวจหน้างานก่อนรับประกันผลผลิต (AD-07)');
    return lines.join('\n');
  }

  function payload(r, ctx) {
    // ส่งเฉพาะตัวเลขสรุป (ไม่มีข้อมูลลูกค้า/ราคา ตาม G-11) — ไม่ส่ง array พิกัดแผง
    return {
      context: ctx,
      result_from_deterministic_engine: {
        projected_area_sqm: Math.round(r.projectedAreaSqm),
        true_area_sqm: Math.round(r.trueAreaSqm),
        tilt_deg: r.tiltDeg,
        tilt_known: r.tiltKnown,
        azimuth_deg: r.azimuthDeg,
        panel_count: r.panelCount,
        dc_capacity_kwp: Math.round(r.dcCapacityKwp * 10) / 10,
        module_watt: r.moduleWatt,
        module_weight_kg: r.moduleWeightKg,
        total_panel_weight_kg: Math.round(r.totalWeightKg),
        areal_load_kg_per_sqm: Math.round(r.arealLoadKgPerSqm * 10) / 10,
        usable_coverage_pct: Math.round(r.usableCoverage * 100),
        warnings: r.warnings
      }
    };
  }

  var SYSTEM = [
    'คุณคือผู้ช่วยวิศวกรของ Amcharge (Thailand) สำหรับการวางแผนติดตั้งแผงโซลาร์บนหลังคา',
    '',
    'กฎเด็ดขาด (ห้ามฝ่าฝืน):',
    '- ตัวเลขทั้งหมด (พื้นที่, จำนวนแผง, kWp) มาจากเครื่องยนต์คำนวณแบบ deterministic ที่ตรวจสอบย้อนกลับได้',
    '- คุณห้ามคำนวณใหม่ ห้ามแก้ ห้ามปัดเศษ หรือประมาณตัวเลขใดๆ ของตัวเอง',
    '- หน้าที่ของคุณคือ "อธิบายและแนะนำ" เท่านั้น',
    '',
    'ตอบเป็นภาษาไทย กระชับ เป็นมืออาชีพ สำหรับวิศวกร แบ่ง 4 หัวข้อสั้นๆ:',
    '1) สรุปผล (1-2 ประโยค อ้างตัวเลขจาก engine ตามจริง)',
    '2) ข้อสังเกต (ทำไมได้ผลแบบนี้ — พื้นที่จริง vs เงา, สัดส่วนพื้นที่ที่ใช้ได้, warning ถ้ามี)',
    '3) คำแนะนำ (ทิศ/ความชัน/รุ่นแผง/พื้นที่ที่ควรพิจารณาเพิ่ม)',
    '4) ข้อควรระวัง (ค่านี้เป็นเบื้องต้น indicative ยังไม่ผูกพัน ต้องยืนยันหน้างานก่อนรับประกันผลผลิต)'
  ].join('\n');

  function explain(r, ctx) {
    var key = getKey();
    if (!key) {
      return Promise.resolve({ source: 'template', text: template(r, ctx) });
    }
    var body = {
      model: getModel(),
      max_tokens: 1024,
      thinking: { type: 'disabled' },
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: 'ข้อมูลจากเครื่องยนต์ (ตัวเลขสุดท้าย ห้ามแก้):\n' + JSON.stringify(payload(r, ctx), null, 2)
      }]
    };
    return fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(body)
    }).then(function (resp) {
      return resp.text().then(function (t) {
        if (!resp.ok) throw new Error('API ' + resp.status + ': ' + t.slice(0, 300));
        var data = JSON.parse(t);
        var text = (data.content || []).filter(function (b) { return b.type === 'text'; })
          .map(function (b) { return b.text; }).join('\n').trim();
        return { source: 'claude · ' + getModel(), text: text || '(ไม่มีข้อความตอบกลับ)' };
      });
    });
  }

  return { explain: explain, getKey: getKey, setKey: setKey, getModel: getModel, setModel: setModel };
})();
