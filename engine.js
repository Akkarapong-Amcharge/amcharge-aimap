/*
 * engine.js — DeterministicLayoutEngine (Amcharge AI Roof Planner)
 * ------------------------------------------------------------------
 * กฎเหล็ก (Architecture Brief §5, G-02, G-08, AC-17):
 *   - computeLayout เป็น pure function: input เดียวกัน -> output เดียวกันเสมอ
 *   - ห้ามเรียก network / ห้ามอ่านเวลาปัจจุบัน / ห้ามใช้ค่าสุ่ม
 *   - AI ไม่แตะตัวเลขในไฟล์นี้เด็ดขาด ตัวเลขทั้งหมดมาจากกฎที่ traceable ได้
 * โค้ดนี้ยกไปใช้ในแอปจริง (TypeScript) ได้โดยตรง — แค่ใส่ type
 */
(function (global) {
  'use strict';

  var EARTH_R = 6378137; // รัศมีโลก (เมตร)

  // ---- โปรเจกชันเมตรแบบ local (equirectangular) รอบจุดกำเนิด lat0/lng0 ----
  function toLocal(lat, lng, lat0, lng0) {
    var x = ((lng - lng0) * Math.PI) / 180 * EARTH_R * Math.cos((lat0 * Math.PI) / 180);
    var y = ((lat - lat0) * Math.PI) / 180 * EARTH_R;
    return [x, y];
  }
  function toLatLng(x, y, lat0, lng0) {
    var lat = lat0 + (y / EARTH_R) * (180 / Math.PI);
    var lng = lng0 + (x / (EARTH_R * Math.cos((lat0 * Math.PI) / 180))) * (180 / Math.PI);
    return [lat, lng];
  }

  // ring = [[lat,lng], ...] -> เมตร + จุดกำเนิด (ใช้ค่าเฉลี่ยเป็น origin)
  function ringToMetric(ring) {
    var lat0 = 0, lng0 = 0, i;
    for (i = 0; i < ring.length; i++) { lat0 += ring[i][0]; lng0 += ring[i][1]; }
    lat0 /= ring.length; lng0 /= ring.length;
    var m = [];
    for (i = 0; i < ring.length; i++) m.push(toLocal(ring[i][0], ring[i][1], lat0, lng0));
    return { m: m, lat0: lat0, lng0: lng0 };
  }

  // พื้นที่ (เงาที่ฉายลงพื้น = projected) ด้วย shoelace บนพิกัดเมตร
  function shoelaceArea(m) {
    var a = 0, n = m.length, i, j;
    for (i = 0; i < n; i++) {
      j = (i + 1) % n;
      a += m[i][0] * m[j][1] - m[j][0] * m[i][1];
    }
    return Math.abs(a) / 2;
  }

  // จุดอยู่ในรูปหลายเหลี่ยมไหม (ray casting) — pt=[x,y], m=[[x,y]...]
  function pointInPoly(pt, m) {
    var inside = false, n = m.length, i, j;
    for (i = 0, j = n - 1; i < n; j = i++) {
      var xi = m[i][0], yi = m[i][1], xj = m[j][0], yj = m[j][1];
      var hit = ((yi > pt[1]) !== (yj > pt[1])) &&
        (pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi);
      if (hit) inside = !inside;
    }
    return inside;
  }

  function distToSeg(p, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1];
    var l2 = dx * dx + dy * dy;
    if (l2 === 0) return Math.sqrt((p[0] - a[0]) * (p[0] - a[0]) + (p[1] - a[1]) * (p[1] - a[1]));
    var t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2;
    if (t < 0) t = 0; else if (t > 1) t = 1;
    var px = a[0] + t * dx, py = a[1] + t * dy;
    return Math.sqrt((p[0] - px) * (p[0] - px) + (p[1] - py) * (p[1] - py));
  }
  function distToBoundary(p, m) {
    var d = Infinity, n = m.length, i;
    for (i = 0; i < n; i++) d = Math.min(d, distToSeg(p, m[i], m[(i + 1) % n]));
    return d;
  }

  function rot(x, y, deg) {
    var r = (deg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
    return [x * c - y * s, x * s + y * c];
  }

  // เส้นตรง 2 เส้นตัดกันไหม
  function segSeg(p1, p2, p3, p4) {
    function cr(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
    var d1 = cr(p3, p4, p1), d2 = cr(p3, p4, p2), d3 = cr(p1, p2, p3), d4 = cr(p1, p2, p4);
    return (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0)));
  }
  // ระยะต่ำสุดระหว่างเส้นทางเดิน (a-b) กับสี่เหลี่ยมแผง (rect 4 มุม) — 0 ถ้าทับ/ทะลุ
  function distSegRect(a, b, rect) {
    var i;
    for (i = 0; i < 4; i++) { if (segSeg(a, b, rect[i], rect[(i + 1) % 4])) return 0; }
    if (pointInPoly(a, rect) || pointInPoly(b, rect)) return 0;
    var d = Infinity;
    for (i = 0; i < 4; i++) d = Math.min(d, distToSeg(rect[i], a, b));
    for (i = 0; i < 4; i++) d = Math.min(d, distToSeg(a, rect[i], rect[(i + 1) % 4]), distToSeg(b, rect[i], rect[(i + 1) % 4]));
    return d;
  }
  // ระยะต่ำสุดจากจุด (สิ่งกีดขวางวงกลม) ถึงสี่เหลี่ยมแผง — 0 ถ้าจุดอยู่ในแผง
  function distPointRect(p, rect) {
    if (pointInPoly(p, rect)) return 0;
    var d = Infinity;
    for (var i = 0; i < 4; i++) d = Math.min(d, distToSeg(p, rect[i], rect[(i + 1) % 4]));
    return d;
  }

  /*
   * computeLayout — เครื่องยนต์หลัก
   * input = {
   *   ring: [[lat,lng]...],           // รูปหลังคาที่วาด (projected footprint)
   *   tiltDeg: number | null,         // ความชันหลังคา (null = ไม่ทราบ -> เตือน G-05)
   *   azimuthDeg: number,             // ทิศการวางกริดแผง (0 = แนวเหนือ-ใต้)
   *   module: { watt, width, height },// สเปกแผง (เมตร)
   *   rules: { setback, rowGap, colGap, orientation }  // แยกตาม segment (AD-06)
   * }
   */
  function computeLayout(input) {
    var ring = input.ring;
    var warnings = [];
    if (!ring || ring.length < 3) {
      return { ok: false, error: 'ต้องมีรูปหลังคาอย่างน้อย 3 จุด' };
    }

    var tiltKnown = (input.tiltDeg !== null && input.tiltDeg !== undefined);
    var tiltDeg = tiltKnown ? input.tiltDeg : 0;
    if (!tiltKnown) {
      warnings.push('ไม่มีค่าความชัน (tilt) — ใช้ค่า default 0° และพื้นที่จริง = พื้นที่เงา (Guardrail G-05)');
    }
    var az = input.azimuthDeg || 0;
    var mod = input.module;
    var rules = input.rules;

    var conv = ringToMetric(ring);
    var m = conv.m, lat0 = conv.lat0, lng0 = conv.lng0;

    var projectedArea = shoelaceArea(m);
    var tiltRad = (tiltDeg * Math.PI) / 180;
    var trueArea = projectedArea / Math.max(Math.cos(tiltRad), 1e-6); // §3.1 A_true = A_proj/cos(tilt)

    // ขนาดแผงตามการวาง (landscape = สลับด้าน)
    var pw = mod.width, ph = mod.height;
    if (rules.orientation === 'landscape') { pw = mod.height; ph = mod.width; }

    var stepX = pw + (rules.colGap || 0);
    var stepY = ph + (rules.rowGap || 0);
    var setback = rules.setback || 0;

    // หมุนรูปด้วย -az เพื่อให้กริดเรียงตามทิศแผง แล้วหา bbox
    var mr = [], i;
    for (i = 0; i < m.length; i++) mr.push(rot(m[i][0], m[i][1], -az));
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (i = 0; i < mr.length; i++) {
      if (mr[i][0] < minX) minX = mr[i][0];
      if (mr[i][1] < minY) minY = mr[i][1];
      if (mr[i][0] > maxX) maxX = mr[i][0];
      if (mr[i][1] > maxY) maxY = mr[i][1];
    }

    // ทางเดินบำรุงรักษา: เว้นช่องกว้าง walkwayWidth เมตร ทุกๆ walkwayEvery แถว
    var walkwayWidth = rules.walkwayWidth || 0;
    var walkwayEvery = rules.walkwayEvery || 0;
    var walkwayCount = 0;

    // walkway ที่วาดเอง (exclusion): แต่ละเส้นมีความกว้างของตัวเอง — แปลงเป็นเมตร origin เดียวกับหลังคา
    var drawnWalkways = input.walkways || [];
    var wwMetric = [];
    for (var wi = 0; wi < drawnWalkways.length; wi++) {
      var wk = drawnWalkways[wi];
      if (wk && wk.line && wk.line.length >= 2 && wk.width > 0) {
        var lm = [];
        for (var pj = 0; pj < wk.line.length; pj++) lm.push(toLocal(wk.line[pj][0], wk.line[pj][1], lat0, lng0));
        wwMetric.push({ pts: lm, half: wk.width / 2 });
      }
    }
    // สิ่งกีดขวาง (obstacle) วงกลม: center + รัศมี (เมตร)
    var obstacles = input.obstacles || [];
    var obsMetric = [];
    for (var oi = 0; oi < obstacles.length; oi++) {
      var ob = obstacles[oi];
      if (ob && ob.r > 0) obsMetric.push({ c: toLocal(ob.lat, ob.lng, lat0, lng0), r: ob.r });
    }

    var panels = [];              // แต่ละแผง = [[lat,lng] x4]
    var maxCells = 80000, cells = 0, stopped = false;
    var cx, cy, k, rowIndex = 0;
    cy = minY;
    while (cy + ph <= maxY) {
      for (cx = minX; cx + pw <= maxX; cx += stepX) {
        if (++cells > maxCells) { stopped = true; break; }
        // มุมแผงในเฟรมที่หมุนแล้ว
        var cornersR = [[cx, cy], [cx + pw, cy], [cx + pw, cy + ph], [cx, cy + ph]];
        // หมุนกลับสู่เฟรมเมตร แล้วทดสอบกับรูปเดิม m
        var cm = [], ok = true;
        for (k = 0; k < 4; k++) {
          var q = rot(cornersR[k][0], cornersR[k][1], az);
          cm.push(q);
          if (!pointInPoly(q, m)) { ok = false; break; }
          if (setback > 0 && distToBoundary(q, m) < setback) { ok = false; break; }
        }
        // ตัดแผงที่ทับ walkway ที่วาดเอง (corridor = เส้น ± ครึ่งความกว้าง ทับสี่เหลี่ยมแผง)
        if (ok && wwMetric.length) {
          for (var wl = 0; wl < wwMetric.length && ok; wl++) {
            var W = wwMetric[wl];
            for (var sg = 0; sg < W.pts.length - 1 && ok; sg++) {
              if (distSegRect(W.pts[sg], W.pts[sg + 1], cm) < W.half) { ok = false; break; }
            }
          }
        }
        // ตัดแผงที่ทับสิ่งกีดขวางวงกลม
        if (ok && obsMetric.length) {
          for (var ol = 0; ol < obsMetric.length && ok; ol++) {
            if (distPointRect(obsMetric[ol].c, cm) < obsMetric[ol].r) { ok = false; break; }
          }
        }
        if (ok) {
          var ll = [];
          for (k = 0; k < 4; k++) ll.push(toLatLng(cm[k][0], cm[k][1], lat0, lng0));
          panels.push(ll);
        }
      }
      if (stopped) break;
      rowIndex++;
      cy += stepY;
      if (walkwayEvery > 0 && walkwayWidth > 0 && rowIndex % walkwayEvery === 0) {
        cy += walkwayWidth;       // แทรกทางเดินบำรุงรักษา
        walkwayCount++;
      }
    }
    if (stopped) warnings.push('พื้นที่ใหญ่มาก หยุดการวางที่ ' + maxCells + ' ช่องเพื่อความเร็ว (เดโม)');

    var count = panels.length;
    var dcKwp = (count * mod.watt) / 1000;
    var usable = trueArea > 0 ? (count * pw * ph) / trueArea : 0;
    var weightKg = mod.weightKg || 0;
    var totalWeightKg = count * weightKg;
    var arealLoadKgPerSqm = trueArea > 0 ? totalWeightKg / trueArea : 0; // โหลดเฉลี่ยบนหลังคา

    return {
      ok: true,
      projectedAreaSqm: projectedArea,
      trueAreaSqm: trueArea,
      tiltDeg: tiltDeg,
      tiltKnown: tiltKnown,
      azimuthDeg: az,
      panelCount: count,
      dcCapacityKwp: dcKwp,
      moduleWatt: mod.watt,
      moduleWeightKg: weightKg,
      totalWeightKg: totalWeightKg,
      arealLoadKgPerSqm: arealLoadKgPerSqm,
      walkwayCount: walkwayCount,
      usableCoverage: usable,          // สัดส่วนพื้นที่จริงที่ถูกแผงคลุม (indicative)
      panels: panels,
      warnings: warnings
    };
  }

  global.RoofEngine = {
    computeLayout: computeLayout,
    _internal: { toLocal: toLocal, toLatLng: toLatLng, shoelaceArea: shoelaceArea, pointInPoly: pointInPoly }
  };
})(window);
