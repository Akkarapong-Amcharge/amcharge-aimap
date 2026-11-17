/* shading.js — Near-shading engine (2.5D, hourly, deterministic)
 * คำนวณสัดส่วนแผงที่โดนเงา "แดดตรง" ทุกชั่วโมง จาก
 *   - สิ่งกีดขวางทรงกระบอก (ศูนย์กลาง, รัศมี r, สูง h เหนือผิวหลังคา)
 *   - ขอบกำแพงหลังคา (parapet) สูง hp รอบรูปหลังคา
 * สมมติ: แผงแนบผิวหลังคา (ความสูงแผง ≈ 0) · คิดเฉพาะแดดตรง (แดดกระจายไม่หัก) · ไม่คิดผลทางไฟฟ้าของเงาบางส่วน
 * พิกัดเป็นเมตร: x = ตะวันออก, y = เหนือ · ทิศดวงอาทิตย์แบบเข็มทิศ (0 = เหนือ)
 * ฟังก์ชันบริสุทธิ์: input เดียวกัน -> output เดียวกันเสมอ
 */
(function (global) {
  'use strict';
  var HOUR = 3600000;

  // ระยะจาก p ตามทิศ d ไปชนขอบรูปหลายเหลี่ยม (ใกล้สุด, > 0) — Infinity ถ้าไม่ชน
  function rayToEdges(px, py, dx, dy, edges) {
    var best = Infinity;
    for (var i = 0; i < edges.length; i++) {
      var e = edges[i], ex = e[2] - e[0], ey = e[3] - e[1];
      var den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-12) continue;
      var wx = e[0] - px, wy = e[1] - py;
      var t = (wx * ey - wy * ex) / den;        // ระยะตามรังสี
      var u = (wx * dy - wy * dx) / den;        // ตำแหน่งบนขอบ 0..1
      if (t > 1e-6 && u >= 0 && u <= 1 && t < best) best = t;
    }
    return best;
  }

  /**
   * computeShade(geom, weather, lat, lon, sunPosition)
   *   geom = { pts: [[x,y]...] (จุดตัวอย่างบนแผง), obstacles: [{x,y,r,h}], ring: [[x,y]...], parapet: hp (ม.) }
   *   weather = ชุดรายชั่วโมงจาก EnergyEngine.buildWeather (ใช้ t, ghi, shiftH)
   *   sunPosition = EnergyEngine._internal.sunPosition
   * คืน Float32Array ยาวเท่าจำนวนชั่วโมง: สัดส่วนแผงที่โดนเงาแดดตรง (0..1)
   */
  function computeShade(geom, w, lat, lon, sunPosition) {
    var n = w.t.length, out = new Float32Array(n);
    var pts = geom.pts || [], obs = (geom.obstacles || []).filter(function (o) { return o.h > 0 && o.r > 0; });
    var hp = geom.parapet > 0 ? geom.parapet : 0;
    if (!pts.length || (!obs.length && !hp)) return out;
    var ring = geom.ring || [], edges = [];
    for (var i = 0; i < ring.length; i++) { var a = ring[i], b = ring[(i + 1) % ring.length]; edges.push([a[0], a[1], b[0], b[1]]); }
    var shift = w.shiftH || 0;
    for (var h = 0; h < n; h++) {
      if (!(w.ghi[h] > 0)) continue;
      var sp = sunPosition(w.t[h] + (0.5 + shift) * HOUR, lat, lon);
      if (sp.cosZ <= 0.0175) continue;                    // ดวงอาทิตย์ต่ำมาก — แดดตรงเป็น 0 อยู่แล้ว
      var sinZ = Math.sqrt(1 - sp.cosZ * sp.cosZ), tanE = sp.cosZ / sinZ;
      var az = sp.azimuth * Math.PI / 180, dx = Math.sin(az), dy = Math.cos(az);
      var parLen = hp / tanE, shaded = 0;
      for (var k = 0; k < pts.length; k++) {
        var px = pts[k][0], py = pts[k][1], hit = false;
        for (var j = 0; j < obs.length && !hit; j++) {
          var o = obs[j], vx = o.x - px, vy = o.y - py;
          var along = vx * dx + vy * dy;
          if (along <= 0) continue;
          var perp2 = vx * vx + vy * vy - along * along;
          if (perp2 > o.r * o.r) continue;
          var entry = along - Math.sqrt(o.r * o.r - perp2);  // ระยะถึงผิวทรงกระบอก
          if (entry <= o.h / tanE) hit = true;
        }
        if (!hit && hp > 0 && rayToEdges(px, py, dx, dy, edges) <= parLen) hit = true;
        if (hit) shaded++;
      }
      out[h] = shaded / pts.length;
    }
    return out;
  }

  global.ShadingEngine = { computeShade: computeShade, _internal: { rayToEdges: rayToEdges } };
})(window);
