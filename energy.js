/* energy.js — Amcharge Energy Yield Engine (hourly, deterministic)
 * ฟังก์ชันบริสุทธิ์: input เดียวกัน -> output เดียวกันเสมอ (ไม่มี network / Date.now / random)
 * โมเดล (สาธารณะทั้งหมด):
 *   - ตำแหน่งดวงอาทิตย์: NOAA / Astronomical Almanac (low precision, ~0.01°)
 *   - แดดบนแผงเอียง: Perez 1990 (allsitescomposite1990)
 *   - IAM: ASHRAE  IAM = 1 - b0 (1/cosθ - 1)
 *   - อุณหภูมิเซลล์: แบบ PVsyst  Tc = Ta + α·G·(1-η)/(Uc + Uv·v)
 *   - แสงอ่อน: ประสิทธิภาพสัมพัทธ์แบบ log  f = 1 + k·ln(G/1000)
 *   - loss chain ลำดับเดียวกับ loss diagram ของ PVsyst + clipping อินเวอร์เตอร์
 * ทิศ (azimuth) ใช้ระบบเข็มทิศ: 0=เหนือ 90=ตะวันออก 180=ใต้ 270=ตะวันตก  (PVsyst ใช้ 0=ใต้ → aimap = PVsyst + 180)
 */
(function (global) {
  'use strict';
  var D2R = Math.PI / 180, R2D = 180 / Math.PI, HOUR = 3600000;
  var DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  // ค่าปรับเทียบ NASA POWER (climatology) -> Meteonorm 9 จากรายงาน PVsyst My Park Mall (กรุงเทพฯ, 2026-11-17)
  // GHI 1702.0 / 1910.9 · DHI 893.8 / 906.8 · Tamb 29.18 - 27.93 °C   — ใช้เป็นค่าประมาณทั้งประเทศจนกว่าจะมีจุดปรับเทียบเพิ่ม
  var CAL = { ghi: 0.8907, dhi: 0.9857, dt: 1.25, label: 'NASA→Meteonorm (Bangkok, My Park PVsyst)' };

  // ---------- sun position ----------
  function sunPosition(tMs, lat, lon) {
    var n = tMs / 86400000 + 2440587.5 - 2451545.0;
    var L = (280.460 + 0.9856474 * n) % 360;
    var g = ((357.528 + 0.9856003 * n) % 360) * D2R;
    var lam = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * D2R;
    var eps = (23.439 - 0.0000004 * n) * D2R;
    var ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam));
    var dec = Math.asin(Math.sin(eps) * Math.sin(lam));
    var gmst = (18.697374558 + 24.06570982441908 * n) % 24; if (gmst < 0) gmst += 24;
    var ha = (gmst * 15 + lon) * D2R - ra;
    var phi = lat * D2R;
    var cosZ = Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(ha);
    cosZ = Math.max(-1, Math.min(1, cosZ));
    var az = Math.atan2(-Math.cos(dec) * Math.sin(ha),
      Math.sin(dec) * Math.cos(phi) - Math.cos(dec) * Math.sin(phi) * Math.cos(ha)) * R2D;
    if (az < 0) az += 360;
    var doy = ((n % 365.25) + 365.25) % 365.25;
    return { cosZ: cosZ, zenith: Math.acos(cosZ), azimuth: az, e0: 1367 * (1 + 0.033 * Math.cos(2 * Math.PI * doy / 365)) };
  }

  // ---------- Perez 1990 ----------
  var PZ = {
    eps: [1.065, 1.23, 1.5, 1.95, 2.8, 4.5, 6.2],
    f11: [-0.008, 0.130, 0.330, 0.568, 0.873, 1.132, 1.060, 0.678],
    f12: [0.588, 0.683, 0.487, 0.187, -0.392, -1.237, -1.600, -0.327],
    f13: [-0.062, -0.151, -0.221, -0.295, -0.362, -0.412, -0.359, -0.250],
    f21: [-0.060, -0.019, 0.055, 0.109, 0.226, 0.288, 0.264, 0.156],
    f22: [0.072, 0.066, -0.064, -0.152, -0.462, -0.823, -1.127, -1.377],
    f23: [-0.022, -0.029, -0.026, -0.014, 0.001, 0.056, 0.131, 0.251]
  };
  // คืนค่าองค์ประกอบแดดกระจาย: iso (ทั้งท้องฟ้า), circ (รอบดวงอาทิตย์), hor (ขอบฟ้า)
  function perezParts(dhi, dni, cosZ, zRad, cosT, cb, sb, e0) {
    if (dhi <= 0) return { iso: 0, circ: 0, hor: 0 };
    var zDeg = zRad * R2D;
    var am = 1 / (Math.max(cosZ, 0) + 0.50572 * Math.pow(Math.max(96.07995 - zDeg, 0.01), -1.6364));
    var delta = dhi * am / e0;
    var k = 1.041 * zRad * zRad * zRad;
    var eps = ((dhi + dni) / dhi + k) / (1 + k);
    var b = 0; while (b < 7 && eps >= PZ.eps[b]) b++;
    var F1 = Math.max(0, PZ.f11[b] + PZ.f12[b] * delta + PZ.f13[b] * zRad);
    var F2 = PZ.f21[b] + PZ.f22[b] * delta + PZ.f23[b] * zRad;
    var a = Math.max(0, cosT), bb = Math.max(0.087156, cosZ); // cos 85°
    return { iso: dhi * (1 - F1) * (1 + cb) / 2, circ: dhi * F1 * a / bb, hor: dhi * F2 * sb };
  }

  // ---------- IAM ----------
  function iamAshrae(cosT, b0) {
    if (cosT <= 0) return 0;
    var v = 1 - b0 * (1 / cosT - 1);
    return v > 0 ? v : 0;
  }
  // ค่าเฉลี่ยครึ่งทรงกลม (แดดกระจายแบบ isotropic)
  function iamDiffuse(b0) {
    var s = 0, N = 900, d = (Math.PI / 2) / N;
    for (var i = 0; i < N; i++) { var t = (i + 0.5) * d; s += iamAshrae(Math.cos(t), b0) * Math.cos(t) * Math.sin(t) * d; }
    return 2 * s;
  }

  // ---------- weather helpers ----------
  function monthOf(tMs, tz) { return new Date(tMs + tz * HOUR).getUTCMonth(); }

  // หาว่าเวลาของข้อมูลเลื่อนจากกลางชั่วโมงเท่าไร (เลือกค่าที่แดดสัมพันธ์กับมุมดวงอาทิตย์มากที่สุด)
  function detectShift(w, lat, lon) {
    var best = 0, bestC = -1;
    for (var s = -1; s <= 1.0001; s += 0.25) {
      var sxy = 0, sxx = 0, syy = 0;
      for (var h = 0; h < w.t.length; h += 1) {
        var c = Math.max(0, sunPosition(w.t[h] + (0.5 + s) * HOUR, lat, lon).cosZ), y = w.ghi[h];
        sxy += c * y; sxx += c * c; syy += y * y;
      }
      var corr = sxy / Math.sqrt(sxx * syy || 1);
      if (corr > bestC + 1e-9) { bestC = corr; best = Math.round(s * 100) / 100; }
    }
    return best;
  }

  /**
   * buildWeather — แปลงข้อมูล NASA POWER เป็นชุดรายชั่วโมง 1 ปี แล้วปรับยอดรายเดือนให้ตรงเป้า
   *   hourly : JSON จาก /temporal/hourly (ALLSKY_SFC_SW_DWN, ALLSKY_SFC_SW_DIFF, T2M; time-standard=UTC)
   *   clim   : JSON จาก /temporal/climatology (ค่าเฉลี่ยระยะยาวรายเดือน)
   *   opts   : { lat, lon, tz, calibrate:bool, monthly:[12 x {ghi, dhi?, tamb?}] (kWh/m²/เดือน, °C) }
   * ถ้ามี opts.monthly → ใช้เป็นเป้าหมาย (เช่น ตารางจากรายงาน PVsyst) และไม่ใช้ค่าปรับเทียบ
   */
  function buildWeather(hourly, clim, opts) {
    var P = hourly.properties.parameter, keys = Object.keys(P.ALLSKY_SFC_SW_DWN).sort();
    var t = [], ghi = [], dhi = [], ta = [], lastT = 25;
    keys.forEach(function (k) {
      t.push(Date.UTC(+k.slice(0, 4), +k.slice(4, 6) - 1, +k.slice(6, 8), +k.slice(8, 10)));
      var g = P.ALLSKY_SFC_SW_DWN[k], d = P.ALLSKY_SFC_SW_DIFF[k], tt = P.T2M[k];
      g = g > 0 ? g : 0; d = d > 0 ? d : 0;
      if (tt > -100) lastT = tt; else tt = lastT;
      ghi.push(g); dhi.push(Math.min(d, g)); ta.push(tt);
    });
    var tz = typeof opts.tz === 'number' ? opts.tz : Math.round(opts.lon / 15);
    var sG = [], sD = [], sT = [], nT = [], m;
    for (m = 0; m < 12; m++) { sG[m] = 0; sD[m] = 0; sT[m] = 0; nT[m] = 0; }
    for (var h = 0; h < t.length; h++) { m = monthOf(t[h], tz); sG[m] += ghi[h]; sD[m] += dhi[h]; sT[m] += ta[h]; nT[m]++; }

    var C = clim && clim.properties && clim.properties.parameter;
    var MN = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    var target = [], useCal = !opts.monthly && !!opts.calibrate;
    for (m = 0; m < 12; m++) {
      var tg = { ghi: sG[m] / 1000, dhi: sD[m] / 1000, tamb: sT[m] / (nT[m] || 1) };
      if (C) { tg.ghi = C.ALLSKY_SFC_SW_DWN[MN[m]] * DAYS[m]; tg.dhi = C.ALLSKY_SFC_SW_DIFF[MN[m]] * DAYS[m]; tg.tamb = C.T2M[MN[m]]; }
      if (useCal) { tg.ghi *= CAL.ghi; tg.dhi *= CAL.dhi; tg.tamb += CAL.dt; }
      if (opts.monthly && opts.monthly[m]) {
        var u = opts.monthly[m];
        if (u.ghi > 0) {
          var ratio = tg.ghi > 0 ? tg.dhi / tg.ghi : 0.5;
          tg.ghi = u.ghi; tg.dhi = u.dhi > 0 ? u.dhi : u.ghi * ratio;
        }
        if (typeof u.tamb === 'number' && !isNaN(u.tamb)) tg.tamb = u.tamb;
      }
      target.push(tg);
    }
    var fG = [], fD = [], dT = [];
    for (m = 0; m < 12; m++) {
      fG[m] = sG[m] > 0 ? target[m].ghi * 1000 / sG[m] : 0;
      fD[m] = sD[m] > 0 ? target[m].dhi * 1000 / sD[m] : 0;
      dT[m] = target[m].tamb - sT[m] / (nT[m] || 1);
    }
    for (h = 0; h < t.length; h++) {
      m = monthOf(t[h], tz);
      ghi[h] *= fG[m]; dhi[h] = Math.min(dhi[h] * fD[m], ghi[h]); ta[h] += dT[m];
    }
    var w = { t: t, ghi: ghi, dhi: dhi, ta: ta, tz: tz, target: target,
      source: opts.monthly ? 'monthly-import' : (useCal ? 'nasa-calibrated' : 'nasa-raw') };
    w.shiftH = detectShift(w, opts.lat, opts.lon);
    return w;
  }

  /**
   * simulate — จำลองพลังงานรายชั่วโมงทั้งปี
   * input = {
   *   lat, lon, weather (จาก buildWeather),
   *   orientations: [{ kwp, tilt, az, gamma (%/°C เช่น -0.26), eff (ประสิทธิภาพแผง 0-1) }],
   *   losses: { albedo, shadingPct, soilingPct, iamB0, uc, uv, qualityPct, mismatchPct, optimizerPct,
   *             wiringStcPct, lowLight200Pct, invEffPct, pacKw }
   * }
   */
  function simulate(input) {
    var w = input.weather, L = input.losses, lat = input.lat, lon = input.lon;
    var ors = (input.orientations || []).filter(function (o) { return o.kwp > 0; });
    var kwpTot = ors.reduce(function (s, o) { return s + o.kwp; }, 0);
    if (!kwpTot || !w || !w.ghi || !w.ghi.length) return { ok: false, error: 'no-input' };
    var tz = w.tz, shift = w.shiftH || 0;
    var sh = (L.shadingPct || 0) / 100, so = (L.soilingPct || 0) / 100, q = (L.qualityPct || 0) / 100,
      mm = (L.mismatchPct || 0) / 100, op = (L.optimizerPct || 0) / 100, wr = (L.wiringStcPct || 0) / 100,
      ie = (L.invEffPct || 100) / 100, pac = L.pacKw || 0, alb = L.albedo == null ? 0.2 : L.albedo,
      b0 = L.iamB0 == null ? 0.05 : L.iamB0, U = (L.uc || 20) + (L.uv || 0) * 1,
      kll = ((L.lowLight200Pct || 0) / 100) / Math.log(5);
    var iamD = iamDiffuse(b0);
    var O = ors.map(function (o) {
      var b = o.tilt * D2R;
      return { kwp: o.kwp, w: o.kwp / kwpTot, cb: Math.cos(b), sb: Math.sin(b), az: o.az, gamma: (o.gamma || -0.29) / 100, eff: o.eff || 0.22 };
    });
    var M = [], m;
    for (m = 0; m < 12; m++) M.push({ ghi: 0, dhi: 0, ta: 0, n: 0, inc: 0, eff: 0, eNom: 0, e1: 0, e2: 0, e3: 0, e4: 0, e5: 0, eArr: 0, eInv: 0, eGrid: 0 });

    for (var h = 0; h < w.t.length; h++) {
      var A = M[monthOf(w.t[h], tz)];
      var ghi = w.ghi[h] > 0 ? w.ghi[h] : 0, dhi = Math.min(w.dhi[h] > 0 ? w.dhi[h] : 0, ghi), ta = w.ta[h];
      A.ghi += ghi; A.dhi += dhi; A.ta += ta; A.n++;
      if (ghi <= 0) continue;
      var sp = sunPosition(w.t[h] + (0.5 + shift) * HOUR, lat, lon);
      var cosZ = sp.cosZ, zRad = Math.min(sp.zenith, Math.PI / 2), sinZ = Math.sin(zRad), dni = 0, isoOnly = false;
      if (cosZ > 0.0175) dni = Math.min((ghi - dhi) / cosZ, sp.e0); else { dhi = ghi; isoOnly = true; }
      var pdc = 0;
      for (var i = 0; i < O.length; i++) {
        var o = O[i];
        var cosT = cosZ * o.cb + sinZ * o.sb * Math.cos((sp.azimuth - o.az) * D2R);
        var beam = dni * Math.max(0, cosT);
        var pp = isoOnly ? { iso: dhi * (1 + o.cb) / 2, circ: 0, hor: 0 } : perezParts(dhi, dni, cosZ, zRad, cosT, o.cb, o.sb, sp.e0);
        var gnd = ghi * alb * (1 - o.cb) / 2;
        var poa = Math.max(0, beam + pp.iso + pp.circ + pp.hor + gnd);
        var geff = Math.max(0, (beam + pp.circ) * iamAshrae(cosT, b0) + Math.max(0, pp.iso + pp.hor) * iamD + gnd * iamD) * (1 - sh) * (1 - so);
        A.inc += poa * o.w; A.eff += geff * o.w;
        var pn = o.kwp * geff / 1000;                                       // kW (= kWh ในชั่วโมงนี้)
        var p1 = geff > 0 ? pn * Math.max(0, 1 + kll * Math.log(geff / 1000)) : 0;   // แสงอ่อน
        var tc = ta + 0.9 * poa * (1 - sh) * (1 - o.eff) / U;                  // อุณหภูมิเซลล์
        var p2 = p1 * (1 + o.gamma * (tc - 25));
        var p3 = p2 * (1 - q), p4 = p3 * (1 - mm), p5 = p4 * (1 - op);
        A.eNom += pn; A.e1 += p1; A.e2 += p2; A.e3 += p3; A.e4 += p4; A.e5 += p5; pdc += p5;
      }
      var parr = pdc * (1 - wr * pdc / kwpTot);                               // สายไฟ DC (∝ I²)
      var pinv = parr * ie;
      var pg = pac > 0 ? Math.min(pinv, pac) : pinv;                          // clipping
      A.eArr += parr; A.eInv += pinv; A.eGrid += pg;
    }

    var Y = { ghi: 0, dhi: 0, ta: 0, inc: 0, eff: 0, eNom: 0, e1: 0, e2: 0, e3: 0, e4: 0, e5: 0, eArr: 0, eInv: 0, eGrid: 0 };
    var monthly = M.map(function (a) {
      Object.keys(Y).forEach(function (k) { if (k !== 'ta') Y[k] += a[k]; });
      Y.ta += a.ta;
      return {
        ghi: a.ghi / 1000, dhi: a.dhi / 1000, tamb: a.ta / (a.n || 1), globInc: a.inc / 1000, globEff: a.eff / 1000,
        eArray: a.eArr, eGrid: a.eGrid, pr: a.inc > 0 ? a.eGrid / (kwpTot * a.inc / 1000) : 0
      };
    });
    var nH = M.reduce(function (s, a) { return s + a.n; }, 0) || 1;
    var ratio = function (a, b) { return b > 0 ? a / b - 1 : 0; };
    var losses = [
      { key: 'ghi', kind: 'irr', value: Y.ghi / 1000 },
      { key: 'transposition', pct: ratio(Y.inc, Y.ghi) },
      { key: 'shading', pct: -sh },
      { key: 'soiling', pct: -so },
      { key: 'iam', pct: ratio(Y.eff, Y.inc * (1 - sh) * (1 - so)) },
      { key: 'globEff', kind: 'irr', value: Y.eff / 1000 },
      { key: 'eNom', kind: 'energy', value: Y.eNom },
      { key: 'irradiance', pct: ratio(Y.e1, Y.eNom) },
      { key: 'temperature', pct: ratio(Y.e2, Y.e1) },
      { key: 'quality', pct: ratio(Y.e3, Y.e2) },
      { key: 'mismatch', pct: ratio(Y.e4, Y.e3) },
      { key: 'optimizer', pct: ratio(Y.e5, Y.e4) },
      { key: 'ohmic', pct: ratio(Y.eArr, Y.e5) },
      { key: 'eArray', kind: 'energy', value: Y.eArr },
      { key: 'inverter', pct: ratio(Y.eInv, Y.eArr) },
      { key: 'clipping', pct: ratio(Y.eGrid, Y.eInv) },
      { key: 'eGrid', kind: 'energy', value: Y.eGrid }
    ];
    return {
      ok: true, kwp: kwpTot, monthly: monthly, losses: losses,
      year: {
        ghi: Y.ghi / 1000, dhi: Y.dhi / 1000, tamb: Y.ta / nH, globInc: Y.inc / 1000, globEff: Y.eff / 1000,
        eArray: Y.eArr, eGrid: Y.eGrid, specific: Y.eGrid / kwpTot, pr: Y.inc > 0 ? Y.eGrid / (kwpTot * Y.inc / 1000) : 0
      },
      shiftH: shift, source: w.source
    };
  }

  global.EnergyEngine = {
    simulate: simulate, buildWeather: buildWeather, CAL: CAL,
    _internal: { sunPosition: sunPosition, perezParts: perezParts, iamAshrae: iamAshrae, iamDiffuse: iamDiffuse, detectShift: detectShift }
  };
})(window);
