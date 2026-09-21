/* i18n.js — ระบบสองภาษา ไทย/อังกฤษ (Amcharge AI Roof Planner) */
window.I18N = (function () {
  'use strict';
  var DICT = {
    th: {
      subtitle: 'AI Roof Planner · เดโม',
      search_ph: 'ค้นหาที่อยู่ / วางลิงก์ Google Maps / พิกัด…',
      btn_search: 'ค้นหา',
      lang_other: 'EN',

      f_projname: 'ชื่อโครงการ', projname_ph: 'เช่น AAPICO Hitech – หลังคาโรงงาน',
      btn_download: '⬇ ดาวน์โหลด Excel', btn_snapshot: '📷 รูปแผนผัง (PNG)',
      dl_none: 'ยังไม่มีข้อมูลให้ดาวน์โหลด', dl_ok: 'ดาวน์โหลดไฟล์ Excel แล้ว',
      snap_wait: 'กำลังสร้างรูปแผนผัง…', snap_ok: 'บันทึกรูปแผนผังแล้ว', snap_fail: 'บันทึกรูปไม่สำเร็จ (ภาพดาวเทียมติดสิทธิ์ CORS) — ใช้แคปหน้าจอแทนได้',
      rb_label: 'หลังคาที่กำลังทำ', rb_none: 'ยังไม่มีหลังคา',
      btn_addroof: '＋ เพิ่มหลังคา', s1_or: 'หรือหลังคารูปทรงไม่เหลี่ยม:',
      s_summary_title: 'สรุปโครงการ — ทั้งไซต์',
      sum_roofs: function (n) { return n + ' หลังคา'; },
      sum_wk: function (n) { return n ? (n + ' ทางเดิน') : '—'; },
      sum_ob: function (n) { return n ? (n + ' สิ่งกีดขวาง') : '—'; },

      s1_title: '1 · กำหนดหลังคา',
      s1_hint: 'ทำทีละหลังจนครบหัวข้อ 2-4 แล้วกด “＋ เพิ่มหลังคา” ด้านล่างเพื่อเพิ่มหลังต่อไป · คลิกชิป ล1 ด้านบนเพื่อสลับหลังที่กำลังทำ (หัวข้อ 2-4 ผูกกับหลังนี้)',
      s1_add_title: 'เพิ่มหลังคา',
      f_width: 'กว้าง (ม.)', f_length: 'ยาว (ม.)', btn_rect: '＋ ปักขนาด',
      s1_rect_hint: 'วางที่กลางแผนที่ ตามทิศ — จากแบบ as-built ไม่ต้อง digitize ภาพ',
      btn_draw: '＋ วาดหลังคา', btn_finish: '✓ เสร็จ', btn_clear: 'ล้างทั้งหมด',
      roof_prefix: 'ล', del_roof: 'ลบหลังนี้',
      roof_empty: 'ยังไม่มีหลังคา — กด “＋ ปักขนาด” หรือ “＋ วาดหลังคา”',
      roof_detail: function (n, area, az) { return '<b>หลังคา ' + n + '</b> · พื้นที่ ~' + area + ' ตร.ม. · ทิศ ' + az + '°'; },
      breakdown_title: 'แยกรายหลัง', lbl_facing: 'ทิศ', badge_roofs: 'หลังคา',
      editing: 'กำลังทำ:', no_active: 'ยังไม่ได้เลือกหลังคา', varies: 'หลากหลาย',
      confirm_locked2: function (rc, p, k) { return '🔒 <b>ล็อกแผนแล้ว</b> · ' + rc + ' หลังคา · รวม ' + p + ' แผง · ' + k + ' kWp · กด “แก้ไขแผน” เพื่อกลับไปปรับรายหลัง'; },

      s2_title: '2 · พารามิเตอร์',
      f_module: 'แผง / Segment', f_rooftype: 'ชนิดหลังคา',
      rt_metal: 'เมทัลชีท (โรงงาน) ~5–15°', rt_flat: 'ดาดฟ้าเรียบ ~0–3°', rt_tile: 'กระเบื้อง (บ้าน) ~25–35°',
      s2_rt_hint: 'เลือกชนิดหลังคาแล้วระบบตั้ง “ความชัน” ให้อัตโนมัติ — ปรับเองได้',
      f_tilt: 'ความชันหลังคา (°)', f_azimuth: 'ทิศที่แผงหันไป (azimuth)',
      chk_tiltunknown: 'ไม่ทราบความชัน (จะใช้ 0° + เตือน — G-05)',
      s2_compass_hint: '🧭 ไทยอยู่ซีกโลกเหนือ แผงควรหันทิศใต้ (~180°) · หมุนแผนที่: Shift+ลากเมาส์ หรือสองนิ้ว · คลิกเข็มทิศเพื่อรีเซ็ตทิศเหนือ',
      f_setback: 'ระยะร่นขอบ setback (ม.)', f_rowgap: 'ช่องว่างแถว (ม.)', f_colgap: 'ช่องว่างคอลัมน์ (ม.)',
      f_orient: 'การวางแผง', or_portrait: 'แนวตั้ง (portrait)', or_landscape: 'แนวนอน (landscape)',
      btn_compute: 'คำนวณใหม่',
      s2_demo_hint: 'ค่าเริ่มต้นเป็นค่าสาธิต — ค่าจริง (fire code walkway / setback) รอวิศวกรอาวุโสตาม O-05',

      s3_title: '3 · ทางเดิน (Walkway)',
      s3_hint: 'ทำหลังตั้งค่า PV/พารามิเตอร์ในหัวข้อ 2 แล้ว — ถ้าย้อนไปแก้พารามิเตอร์ ควรตรวจอีกครั้ง',
      s3_auto_title: 'ทางเดินอัตโนมัติ (เว้นเป็นแถว)',
      f_ww_width: 'ความกว้าง (ม.)', f_ww_every: 'เว้นทุกๆ (แถว)',
      s3_auto_hint: 'ความกว้าง 0 = ปิด (ใช้แบบวาดเองด้านล่างแทน)',
      s3_draw_title: 'ทางเดินวาดเอง (วาดได้ไม่จำกัดเส้น)',
      f_dww: 'ความกว้าง (ม.)', btn_wk_add: '＋ เพิ่มทางเดิน', btn_clear_all: 'ล้างทั้งหมด',
      btn_wk_done: '✓ เสร็จเส้นนี้', btn_wk_cancel: 'ยกเลิก',
      s3_drawing_hint: 'คลิกแนวทางเดินบนแผนที่ (≥ 2 จุด) แล้วกด “✓ เสร็จเส้นนี้”',
      s3_list_hint: 'แต่ละเส้นจบด้วย “✓ เสร็จเส้นนี้” · กด “＋ เพิ่มทางเดิน” วาดเส้นต่อไป · คลิกชิป ท1 เพื่อดู/แก้ความกว้าง · ✕ ลบ',
      wk_prefix: 'ท', ob_prefix: 'อ',

      s4_title: '4 · สิ่งกีดขวาง (Obstacle)',
      s4_hint: 'วางวงกลมทับสิ่งที่อยู่บนหลังคา เช่น Air Inlet, คูลลิ่งทาวเวอร์, ปล่องระบาย — engine จะเว้นแผงบริเวณนั้น',
      f_ob_radius: 'รัศมี (ม.)', btn_ob_add: '＋ วางสิ่งกีดขวาง',
      s4_list_hint: 'กดปุ่มแล้ว “คลิกตำแหน่ง” บนแผนที่ 1 ครั้ง = วาง 1 วง · คลิกชิป อ1 เพื่อดู/แก้รัศมี · ✕ ลบ',
      btn_confirm: '✓ สรุปโครงการ', btn_edit: '✏️ กลับไปแก้',

      s5_title: '5 · ผลการคำนวณ',
      m_kwp: 'กำลังติดตั้ง DC', m_count: 'จำนวนแผง', m_true: 'พื้นที่จริง', m_proj: 'พื้นที่เงา (projected)',
      m_tilt: 'ความชันที่ใช้', m_coverage: 'สัดส่วนพื้นที่ที่ใช้ได้', m_weight: 'น้ำหนักแผงรวม', m_load: 'โหลดเฉลี่ยหลังคา',
      m_coverage_f: '= พื้นที่แผงรวม ÷ พื้นที่หลังคาจริง × 100 (หลังหักร่น/ช่องว่าง/ทางเดิน/สิ่งกีดขวาง)',
      u_panels: 'แผง', u_sqm: 'ตร.ม.', u_ton: 'ตัน', u_kgm2: 'กก./ตร.ม.',

      s6_title: '6 · เปรียบเทียบ PV (ทั้งไซต์)',
      th_model: 'รุ่น', th_panels: 'แผง', th_ton: 'ตัน', th_kgm2: 'กก./ม²',
      s6_hint: '★ = กำลังติดตั้งรวมสูงสุด ถ้าใช้รุ่นเดียวกันทุกหลังคา (จำลองทับทุกหลัง) · ตัวเลขจาก engine ทั้งหมด',

      compass_cap: 'ทิศแผง',
      // dynamic
      status_cleared: 'ล้างแล้ว — ปักขนาด หรือกด "เริ่มวาดหลังคา"',
      banner_roof: 'คลิกมุมหลังคาทีละมุม — ครบแล้วกด “✓ เสร็จ” (ดับเบิลคลิก หรือคลิกจุดแรกซ้ำก็ได้)',
      banner_wk: 'คลิกแนวทางเดินบนแผนที่ (2 จุดขึ้นไป) — แล้วกด “✓ เสร็จเส้นนี้” ที่หัวข้อ 3',
      banner_ob: 'คลิกตำแหน่งสิ่งกีดขวางบนแผนที่ (วงกลมรัศมีตามค่าที่ตั้ง) · Esc ยกเลิก',
      wk_empty: 'ยังไม่มีทางเดิน — กด “＋ เพิ่มทางเดิน”',
      ob_empty: 'ยังไม่มีสิ่งกีดขวาง — กด “＋ วางสิ่งกีดขวาง”',
      wk_detail: function (n, len) { return '<b>ทางเดิน ' + n + '</b> · ยาว ~' + len + ' ม.'; },
      ob_detail: function (n, dia) { return '<b>สิ่งกีดขวาง ' + n + '</b> · เส้นผ่านศูนย์กลาง ~' + dia + ' ม.'; },
      lbl_width: 'กว้าง (ม.)', lbl_radius: 'รัศมี (ม.)', btn_del_line: 'ลบเส้นนี้', btn_del_one: 'ลบอันนี้',
      confirm_locked: function (p, k, w, o) { return '🔒 <b>ล็อกแผนแล้ว</b> · ' + p + ' แผง · ' + k + ' kWp · ทางเดิน ' + w + ' · สิ่งกีดขวาง ' + o + ' · กด “แก้ไขแผน” เพื่อกลับไปปรับ'; },
      confirm_none: 'ยังไม่มีแผนให้ยืนยัน — วางหลังคาก่อน',
      btn_confirmed: '✅ ยืนยันแล้ว (แผนถูกล็อก)',
      badge_engine: 'ตัวเลข: Deterministic Engine', badge_manual: 'เรขาคณิต: วาดเอง (manual)',
      badge_img: 'ภาพ: Esri World Imagery', badge_ci: 'Segment: C&I', badge_res: 'Segment: Residential',
      warn_title: '⚠ ข้อควรทราบ',
      dirs: ['เหนือ (N)', 'ต.อ.เฉียงเหนือ (NE)', 'ตะวันออก (E)', 'ต.อ.เฉียงใต้ (SE)', 'ใต้ (S)', 'ต.ต.เฉียงใต้ (SW)', 'ตะวันตก (W)', 'ต.ต.เฉียงเหนือ (NW)'],
      az_rec: ' ✓ แนะนำ (ไทย)'
    },
    en: {
      subtitle: 'AI Roof Planner · Demo',
      search_ph: 'Search address / paste Google Maps link / coordinates…',
      btn_search: 'Search',
      lang_other: 'ไทย',

      f_projname: 'Project name', projname_ph: 'e.g. AAPICO Hitech – factory roof',
      btn_download: '⬇ Download Excel', btn_snapshot: '📷 Layout image (PNG)',
      dl_none: 'No data to download yet', dl_ok: 'Excel file downloaded',
      snap_wait: 'Generating layout image…', snap_ok: 'Layout image saved', snap_fail: 'Image save failed (satellite tiles are CORS-protected) — use a screenshot instead',
      rb_label: 'Active roof', rb_none: 'No roofs yet',
      btn_addroof: '＋ Add roof', s1_or: 'Or irregular shape:',
      s_summary_title: 'Project summary — whole site',
      sum_roofs: function (n) { return n + ' roofs'; },
      sum_wk: function (n) { return n ? (n + ' walkways') : '—'; },
      sum_ob: function (n) { return n ? (n + ' obstacles') : '—'; },

      s1_title: '1 · Define Roof',
      s1_hint: 'Finish steps 2-4 for one roof, then press “＋ Add roof” below for the next · click chip R1 above to switch the active roof (steps 2-4 bind to it)',
      s1_add_title: 'Add roof',
      f_width: 'Width (m)', f_length: 'Length (m)', btn_rect: '＋ Place size',
      s1_rect_hint: 'Placed at map center along facing — from as-built drawings, no image digitizing',
      btn_draw: '＋ Draw roof', btn_finish: '✓ Done', btn_clear: 'Clear all',
      roof_prefix: 'R', del_roof: 'Delete roof',
      roof_empty: 'No roofs yet — press “＋ Place size” or “＋ Draw roof”',
      roof_detail: function (n, area, az) { return '<b>Roof ' + n + '</b> · area ~' + area + ' m² · facing ' + az + '°'; },
      breakdown_title: 'Per-roof breakdown', lbl_facing: 'facing', badge_roofs: 'roofs',
      editing: 'Editing:', no_active: 'No roof selected', varies: 'varies',
      confirm_locked2: function (rc, p, k) { return '🔒 <b>Plan locked</b> · ' + rc + ' roofs · ' + p + ' panels total · ' + k + ' kWp · press “Edit plan” to adjust per roof'; },

      s2_title: '2 · Parameters',
      f_module: 'Module / Segment', f_rooftype: 'Roof type',
      rt_metal: 'Metal sheet (factory) ~5–15°', rt_flat: 'Flat concrete ~0–3°', rt_tile: 'Tile (house) ~25–35°',
      s2_rt_hint: 'Choosing a roof type sets a default tilt — you can still adjust it',
      f_tilt: 'Roof tilt (°)', f_azimuth: 'Panel facing (azimuth)',
      chk_tiltunknown: 'Tilt unknown (uses 0° + warning — G-05)',
      s2_compass_hint: '🧭 Thailand is in the northern hemisphere; panels should face south (~180°) · Rotate map: Shift+drag or two fingers · Click compass to reset north',
      f_setback: 'Edge setback (m)', f_rowgap: 'Row gap (m)', f_colgap: 'Column gap (m)',
      f_orient: 'Panel orientation', or_portrait: 'Portrait', or_landscape: 'Landscape',
      btn_compute: 'Recalculate',
      s2_demo_hint: 'Defaults are demo values — real values (fire-code walkway / setback) pending senior engineer per O-05',

      s3_title: '3 · Walkway',
      s3_hint: 'Do this after setting PV/parameters in step 2 — if you change parameters, review again',
      s3_auto_title: 'Auto walkway (every N rows)',
      f_ww_width: 'Width (m)', f_ww_every: 'Every (rows)',
      s3_auto_hint: 'Width 0 = off (use manual drawing below instead)',
      s3_draw_title: 'Drawn walkways (unlimited)',
      f_dww: 'Width (m)', btn_wk_add: '＋ Add walkway', btn_clear_all: 'Clear all',
      btn_wk_done: '✓ Finish this line', btn_wk_cancel: 'Cancel',
      s3_drawing_hint: 'Click the walkway path on the map (≥ 2 points) then press “✓ Finish this line”',
      s3_list_hint: 'Finish each line with “✓ Finish this line” · press “＋ Add walkway” for the next · click chip W1 to view/edit width · ✕ delete',
      wk_prefix: 'W', ob_prefix: 'O',

      s4_title: '4 · Obstacle',
      s4_hint: 'Place a circle over rooftop items — air inlet, cooling tower, vent stack — the engine skips panels there',
      f_ob_radius: 'Radius (m)', btn_ob_add: '＋ Place obstacle',
      s4_list_hint: 'Press the button then “click a spot” on the map once = one circle · click chip O1 to view/edit radius · ✕ delete',
      btn_confirm: '✓ Project summary', btn_edit: '✏️ Back to edit',

      s5_title: '5 · Results',
      m_kwp: 'Installed DC', m_count: 'Panel count', m_true: 'True area', m_proj: 'Projected area',
      m_tilt: 'Tilt used', m_coverage: 'Usable area ratio', m_weight: 'Total panel weight', m_load: 'Avg roof load',
      m_coverage_f: '= total panel area ÷ true roof area × 100 (after setback/gaps/walkway/obstacle)',
      u_panels: 'panels', u_sqm: 'm²', u_ton: 'ton', u_kgm2: 'kg/m²',

      s6_title: '6 · Compare PV (whole site)',
      th_model: 'Model', th_panels: 'Panels', th_ton: 'ton', th_kgm2: 'kg/m²',
      s6_hint: '★ = highest total capacity if every roof used the same model (applied across all roofs) · all numbers from the engine',

      compass_cap: 'Facing',
      status_cleared: 'Cleared — place a size or press "Start drawing"',
      banner_roof: 'Click each roof corner — then press “✓ Done” (double-click or click the first point again)',
      banner_wk: 'Click the walkway path on the map (2+ points) — then press “✓ Finish this line” in step 3',
      banner_ob: 'Click the obstacle position on the map (circle radius as set) · Esc to cancel',
      wk_empty: 'No walkways yet — press “＋ Add walkway”',
      ob_empty: 'No obstacles yet — press “＋ Place obstacle”',
      wk_detail: function (n, len) { return '<b>Walkway ' + n + '</b> · length ~' + len + ' m'; },
      ob_detail: function (n, dia) { return '<b>Obstacle ' + n + '</b> · diameter ~' + dia + ' m'; },
      lbl_width: 'Width (m)', lbl_radius: 'Radius (m)', btn_del_line: 'Delete line', btn_del_one: 'Delete',
      confirm_locked: function (p, k, w, o) { return '🔒 <b>Plan locked</b> · ' + p + ' panels · ' + k + ' kWp · walkways ' + w + ' · obstacles ' + o + ' · press “Edit plan” to change'; },
      confirm_none: 'No plan to confirm — place a roof first',
      btn_confirmed: '✅ Confirmed (plan locked)',
      badge_engine: 'Numbers: Deterministic Engine', badge_manual: 'Geometry: manual draw',
      badge_img: 'Imagery: Esri World Imagery', badge_ci: 'Segment: C&I', badge_res: 'Segment: Residential',
      warn_title: '⚠ Note',
      dirs: ['North (N)', 'Northeast (NE)', 'East (E)', 'Southeast (SE)', 'South (S)', 'Southwest (SW)', 'West (W)', 'Northwest (NW)'],
      az_rec: ' ✓ recommended (TH)'
    }
  };

  var lang = 'th';
  try { var saved = localStorage.getItem('amcharge_lang'); if (saved === 'en' || saved === 'th') lang = saved; } catch (e) {}

  function t(key) {
    var v = (DICT[lang] && DICT[lang][key] != null) ? DICT[lang][key] : (DICT.th[key] != null ? DICT.th[key] : key);
    if (typeof v === 'function') return v.apply(null, Array.prototype.slice.call(arguments, 1));
    return v;
  }
  function getLang() { return lang; }
  function setLang(l) {
    lang = (l === 'en') ? 'en' : 'th';
    try { localStorage.setItem('amcharge_lang', lang); } catch (e) {}
    applyStatic();
  }
  function applyStatic() {
    document.documentElement.setAttribute('lang', lang);
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n]'), function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n-ph]'), function (el) {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph')));
    });
  }
  return { t: t, getLang: getLang, setLang: setLang, applyStatic: applyStatic };
})();
