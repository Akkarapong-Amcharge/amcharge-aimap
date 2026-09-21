/* app.js — Amcharge AI Roof Planner (per-roof workflow)
 * แต่ละหลังคาเป็นชุดสมบูรณ์: รุ่นแผง/ความชัน/setback/ทิศ/walkway/obstacle แยกรายหลัง
 * หลังใหม่รับ default จากหลังที่กำลังทำ · กด Complete = สรุปรวม + breakdown รายหลัง
 */
(function () {
  'use strict';

  // ---------- master data ----------
  var MODULES = {
    'lr8-620': { label: 'Hi-MO 7 LR8-66HGD-620M · 620W', short: '620M', watt: 620, width: 1.134, height: 2.382, weightKg: 33.5 },
    'lr7-505': { label: 'Hi-MO X10 LR7-54HVH-505M · 505W', short: '505M', watt: 505, width: 1.134, height: 1.800, weightKg: 21.6 },
    'lr7-560': { label: 'Hi-MO X10 LR7-60HVH-560M · 560W', short: '560M', watt: 560, width: 1.134, height: 1.990, weightKg: 25.3 },
    'lr5-585': { label: 'Hi-MO 6 LR5-72HTH-585M · 585W', short: '585M', watt: 585, width: 1.134, height: 2.278, weightKg: 27.5 },
    'lr7-640': { label: 'Hi-MO 9 LR7-72HYD-640M · 640W', short: '640M', watt: 640, width: 1.134, height: 2.382, weightKg: 33.5 }
  };
  var MODULE_ORDER = ['lr8-620', 'lr7-505', 'lr7-560', 'lr5-585', 'lr7-640'];
  var ROOF_TYPES = {
    metal: { label: 'เมทัลชีท (โรงงาน)', tilt: 7 },
    flat:  { label: 'ดาดฟ้าเรียบ',       tilt: 3 },
    tile:  { label: 'กระเบื้อง (บ้าน)',   tilt: 30 }
  };
  // ค่าเริ่มต้นของหลังคาแรกสุด
  function defaultRoofParams() {
    return {
      module: 'lr8-620', roofType: 'metal', tilt: 7, tiltUnknown: false, az: 180,
      setback: 1.0, rowGap: 0.05, colGap: 0.02, orientation: 'portrait',
      walkwayWidth: 0, walkwayEvery: 6
    };
  }

  // ---------- map ----------
  var map = L.map('map', {
    preferCanvas: true, doubleClickZoom: true,
    rotate: true, touchRotate: true, shiftKeyRotate: true, rotateControl: false, bearing: 0
  }).setView([13.421, 101.104], 18);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 21, maxNativeZoom: 19, crossOrigin: 'anonymous', attribution: 'ภาพ © Esri, Maxar, Earthstar Geographics'
  }).addTo(map);
  L.control.scale({ metric: true, imperial: false, maxWidth: 140, position: 'bottomleft' }).addTo(map);

  var roofLayer = L.layerGroup().addTo(map);
  var panelLayer = L.layerGroup().addTo(map);
  var walkwayLayer = L.layerGroup().addTo(map);
  var obstacleLayer = L.layerGroup().addTo(map);
  var drawLayer = L.layerGroup().addTo(map);

  // ---------- state ----------
  var drawing = false, drawMode = 'roof', placingObstacle = false;
  var points = [];
  var roofs = [];          // แต่ละหลัง: { ring, module, roofType, tilt, tiltUnknown, az, setback, rowGap, colGap, orientation, walkwayWidth, walkwayEvery, walkways:[], obstacles:[] }
  var active = -1;         // หลังคาที่กำลังทำ (sections 2-4 ผูกกับหลังนี้)
  var selectedWk = -1, selectedOb = -1;
  var summaryOpen = false;
  var lastAgg = null, lastPer = null;

  var $ = function (id) { return document.getElementById(id); };
  function aRoof() { return (active >= 0 && active < roofs.length) ? roofs[active] : null; }
  function en() { return I18N.getLang() === 'en'; }

  var banner = null;
  function showBanner(t) { if (banner) { banner.textContent = t; banner.hidden = false; } }
  function hideBanner() { if (banner) banner.hidden = true; }
  function setStatus(t) { $('status').textContent = t || ''; }
  function fmt(x, d) { return (x == null ? 0 : x).toLocaleString(en() ? 'en-US' : 'th-TH', { maximumFractionDigits: d == null ? 0 : d }); }
  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]; }); }
  function currentAz() { var a = parseFloat($('azimuth').value); return isNaN(a) ? 180 : a; }

  // ---------- active-roof <-> UI ----------
  function loadActiveToUI() {
    var rf = aRoof();
    var enabled = !!rf;
    // เปิด/ปิดพารามิเตอร์เมื่อไม่มีหลังคาที่ทำอยู่
    ['module', 'roofType', 'tilt', 'tiltUnknown', 'azimuth', 'setback', 'rowGap', 'colGap', 'orientation', 'walkwayWidth', 'walkwayEvery', 'btnCompute', 'btnWalkway', 'btnClearWalkway', 'btnObstacle', 'btnClearObstacle', 'obstacleRadius', 'drawWalkwayWidth'].forEach(function (id) {
      var el = $(id); if (el) el.disabled = !enabled;
    });
    if (rf) {
      $('module').value = rf.module; $('roofType').value = rf.roofType;
      $('tilt').value = rf.tilt; $('tiltUnknown').checked = rf.tiltUnknown; $('tilt').disabled = rf.tiltUnknown;
      $('azimuth').value = rf.az;
      $('setback').value = rf.setback; $('rowGap').value = rf.rowGap; $('colGap').value = rf.colGap;
      $('orientation').value = rf.orientation;
      $('walkwayWidth').value = rf.walkwayWidth; $('walkwayEvery').value = rf.walkwayEvery;
    }
    updateAzLabel();
    selectedWk = -1; selectedOb = -1;
    updateWalkwayList(); updateObstacleList();
    updateRoofBar(); updateAccSummaries();
  }
  function syncActiveFromUI() {
    var rf = aRoof(); if (!rf) return;
    rf.module = $('module').value; rf.roofType = $('roofType').value;
    rf.tiltUnknown = $('tiltUnknown').checked;
    var t = parseFloat($('tilt').value); rf.tilt = isNaN(t) ? 0 : t;
    rf.az = currentAz();
    rf.setback = parseFloat($('setback').value) || 0;
    rf.rowGap = parseFloat($('rowGap').value) || 0;
    rf.colGap = parseFloat($('colGap').value) || 0;
    rf.orientation = $('orientation').value;
    rf.walkwayWidth = parseFloat($('walkwayWidth').value) || 0;
    rf.walkwayEvery = parseInt($('walkwayEvery').value, 10) || 0;
  }
  function updateRoofBar() {
    var el = $('activeRoofName'); if (!el) return;
    el.textContent = (active >= 0) ? (I18N.t('roof_prefix') + (active + 1)) : I18N.t('rb_none');
    el.classList.toggle('none', active < 0);
  }
  function updateAccSummaries() {
    var rf = aRoof();
    if ($('sum1')) $('sum1').textContent = roofs.length ? I18N.t('sum_roofs', roofs.length) : '';
    if (!$('sum2')) return;
    if (rf) {
      var m = MODULES[rf.module];
      var tiltTxt = rf.tiltUnknown ? '—' : (rf.tilt + '°');
      $('sum2').textContent = m.short + ' · ' + tiltTxt + ' · ' + I18N.t('lbl_facing') + ' ' + rf.az + '°';
      $('sum3').textContent = I18N.t('sum_wk', rf.walkways.length);
      $('sum4').textContent = I18N.t('sum_ob', rf.obstacles.length);
    } else { $('sum2').textContent = ''; $('sum3').textContent = ''; $('sum4').textContent = ''; }
  }
  // accordion
  function openAcc(n) {
    Array.prototype.forEach.call(document.querySelectorAll('.acc'), function (s) {
      s.classList.toggle('open', s.getAttribute('data-acc') === String(n));
    });
  }
  function toggleAcc(n) {
    var s = document.querySelector('.acc[data-acc="' + n + '"]');
    if (s.classList.contains('open')) s.classList.remove('open'); else openAcc(n);
  }

  // ---------- drawing (add roof) ----------
  function newRoofFrom(ring) {
    var base = aRoof() || null;
    var p = base ? {
      module: base.module, roofType: base.roofType, tilt: base.tilt, tiltUnknown: base.tiltUnknown,
      setback: base.setback, rowGap: base.rowGap, colGap: base.colGap, orientation: base.orientation,
      walkwayWidth: base.walkwayWidth, walkwayEvery: base.walkwayEvery
    } : defaultRoofParams();
    p.az = currentAz();              // ทิศ = ค่าสไลเดอร์ปัจจุบัน
    p.ring = ring; p.walkways = []; p.obstacles = [];
    return p;
  }
  function startDraw() {
    drawing = true; drawMode = 'roof'; points = [];
    drawLayer.clearLayers();
    map.doubleClickZoom.disable(); map.getContainer().classList.add('drawing');
    $('btnDraw').disabled = true; $('btnDraw').textContent = en() ? 'drawing…' : 'กำลังวาด…';
    $('btnFinish').disabled = false; $('btnFinish').classList.add('primary', 'pulse');
    setStatus(''); showBanner(I18N.t('banner_roof'));
  }
  function endDrawUI() {
    map.getContainer().classList.remove('drawing');
    $('btnDraw').disabled = false; $('btnDraw').textContent = I18N.t('btn_draw');
    $('btnFinish').classList.remove('primary', 'pulse'); $('btnFinish').disabled = true;
    if ($('wkDrawing')) $('wkDrawing').hidden = true;
    if ($('wkIdle')) $('wkIdle').hidden = false;
    hideBanner();
  }
  function redrawTemp() {
    drawLayer.clearLayers();
    var isWalk = (drawMode === 'walkway');
    var col = isWalk ? '#eab308' : '#0ea5a4';
    points.forEach(function (p) { L.circleMarker(p, { radius: 4, color: col, weight: 2, fillColor: '#fff', fillOpacity: 1 }).addTo(drawLayer); });
    if (!isWalk && points.length >= 3) L.polygon(points, { color: col, weight: 2, dashArray: '4 4', fillColor: col, fillOpacity: 0.1 }).addTo(drawLayer);
    else if (points.length >= 2) L.polyline(points, { color: col, weight: isWalk ? 3 : 2, dashArray: '4 4' }).addTo(drawLayer);
    if (points.length >= 1) L.circleMarker(points[0], { radius: 6, color: col, weight: 3, fillColor: '#fff', fillOpacity: 1 }).addTo(drawLayer);
    for (var k = 0; k < points.length - 1; k++) edgeLabel(points[k], points[k + 1], drawLayer);
    if (!isWalk && points.length >= 3) edgeLabel(points[points.length - 1], points[0], drawLayer);
  }
  function onMapClick(e) {
    if (placingObstacle) { placeObstacle(e.latlng); return; }
    if (!drawing) return;
    if (drawMode === 'roof' && points.length >= 3) {
      var p0 = map.latLngToContainerPoint(points[0]), pc = map.latLngToContainerPoint(e.latlng);
      if (Math.sqrt((p0.x - pc.x) * (p0.x - pc.x) + (p0.y - pc.y) * (p0.y - pc.y)) < 16) { finishDraw(); return; }
    }
    points.push(e.latlng); redrawTemp();
    var n = points.length;
    if (drawMode === 'walkway') showBanner(en() ? (n + ' point(s) — press “✓ Finish this line” (≥ 2)') : ('แนวทางเดิน ' + n + ' จุด — กด “✓ เสร็จเส้นนี้” (≥ 2 จุด)'));
    else if (n < 3) showBanner(en() ? (n + ' point(s) — need at least 3') : ('วางแล้ว ' + n + ' จุด — ต้องอย่างน้อย 3 จุด'));
    else { var ar = Math.round(polyAreaSqm(points)).toLocaleString(en() ? 'en-US' : 'th-TH'); showBanner(en() ? (n + ' points • ~' + ar + ' m² — press “✓ Done”') : ('วางแล้ว ' + n + ' จุด • ~' + ar + ' ตร.ม. — กด “✓ เสร็จ”')); }
  }
  function finishDraw() {
    if (!drawing) return;
    if (drawMode === 'walkway') {
      if (points.length < 2) { showBanner(en() ? 'need ≥ 2 points' : 'ต้องมีอย่างน้อย 2 จุด'); return; }
      drawing = false; map.doubleClickZoom.enable();
      var wdt = parseFloat($('drawWalkwayWidth').value) || 1.2;
      if (aRoof()) aRoof().walkways.push({ line: points.map(function (p) { return [p.lat, p.lng]; }), width: wdt });
      drawLayer.clearLayers(); renderWalkways(); endDrawUI(); updateWalkwayList(); runCompute();
      return;
    }
    if (points.length < 3) { showBanner(en() ? 'need ≥ 3 points' : 'ต้องมีอย่างน้อย 3 จุด — คลิกเพิ่ม'); return; }
    drawing = false; map.doubleClickZoom.enable();
    roofs.push(newRoofFrom(points.map(function (p) { return [p.lat, p.lng]; })));
    active = roofs.length - 1;
    drawLayer.clearLayers(); renderRoofs(); updateRoofList(); loadActiveToUI();
    endDrawUI(); setStatus(''); runCompute(); openAcc(2);
  }
  function makeRect() {
    var w = parseFloat($('roofW').value), len = parseFloat($('roofL').value);
    if (!(w > 0) || !(len > 0)) { setStatus(en() ? 'Enter width/length in meters' : 'กรอกความกว้าง/ยาวเป็นเมตร'); return; }
    var az = currentAz(), c = map.getCenter(), lat0 = c.lat, lng0 = c.lng;
    var hw = w / 2, hl = len / 2, corners = [[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]];
    var r = az * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r);
    var ring = corners.map(function (p) { var x = p[0] * cs - p[1] * sn, y = p[0] * sn + p[1] * cs; return RoofEngine._internal.toLatLng(x, y, lat0, lng0); });
    roofs.push(newRoofFrom(ring)); active = roofs.length - 1;
    drawLayer.clearLayers(); renderRoofs(); updateRoofList(); loadActiveToUI();
    endDrawUI();
    setStatus(en() ? ('Added roof ' + w + '×' + len + ' m — set its parameters below') : ('เพิ่มหลังคา ' + w + '×' + len + ' ม. — ตั้งค่าพารามิเตอร์ด้านล่างต่อได้เลย'));
    runCompute(); openAcc(2);
  }
  function clearAll() {
    drawing = false; placingObstacle = false; points = []; roofs = []; active = -1; selectedWk = -1; selectedOb = -1;
    map.doubleClickZoom.enable();
    drawLayer.clearLayers(); roofLayer.clearLayers(); panelLayer.clearLayers(); walkwayLayer.clearLayers(); obstacleLayer.clearLayers();
    closeSummary(); updateRoofList(); loadActiveToUI();
    endDrawUI(); openAcc(1); setStatus(en() ? 'Search your site, then add a roof (＋)' : 'ค้นหาไซต์ แล้วเพิ่มหลังคา (＋)');
  }

  // ---------- roofs (list / map / select / delete) ----------
  function ringAreaSqm(ring) { return polyAreaSqm(ring.map(function (p) { return { lat: p[0], lng: p[1] }; })); }
  function renderRoofs() {
    roofLayer.clearLayers();
    roofs.forEach(function (rf, idx) {
      var sel = (idx === active);
      var lls = rf.ring.map(function (p) { return L.latLng(p[0], p[1]); });
      L.polygon(lls, { color: sel ? '#f59e0b' : '#fb923c', weight: sel ? 3 : 2, fillColor: '#f59e0b', fillOpacity: sel ? 0.10 : 0.05 }).addTo(roofLayer);
      var cLat = 0, cLng = 0; rf.ring.forEach(function (p) { cLat += p[0]; cLng += p[1]; }); cLat /= rf.ring.length; cLng /= rf.ring.length;
      L.marker([cLat, cLng], { icon: L.divIcon({ className: 'tag-label roof-tag' + (sel ? ' sel' : ''), html: '<span>' + I18N.t('roof_prefix') + (idx + 1) + '</span>', iconSize: [0, 0] }), interactive: false, keyboard: false }).addTo(roofLayer);
      if (sel) for (var i = 0; i < lls.length; i++) edgeLabel(lls[i], lls[(i + 1) % lls.length], roofLayer);
    });
  }
  function setActive(i) {
    if (i < 0 || i >= roofs.length) return;
    active = i;
    renderRoofs(); updateRoofList(); loadActiveToUI();
    renderWalkways(); renderObstacles();
  }
  function deleteRoof(i) {
    if (i < 0 || i >= roofs.length) return;
    roofs.splice(i, 1);
    if (active === i) active = roofs.length ? Math.min(i, roofs.length - 1) : -1;
    else if (active > i) active--;
    renderRoofs(); updateRoofList(); loadActiveToUI(); renderWalkways(); renderObstacles(); runCompute();
  }
  function updateRoofList() {
    var host = $('roofList');
    if (host) {
      if (!roofs.length) { host.innerHTML = '<span class="hint">' + I18N.t('roof_empty') + '</span>'; }
      else {
        host.innerHTML = roofs.map(function (_, i) {
          return '<span class="wk-item' + (i === active ? ' sel' : '') + '">' +
            '<button class="wk-chip roof-chip" data-i="' + i + '">' + I18N.t('roof_prefix') + (i + 1) + '</button>' +
            '<button class="wk-del" data-i="' + i + '" title="' + I18N.t('del_roof') + '">✕</button></span>';
        }).join('');
        Array.prototype.forEach.call(host.querySelectorAll('.roof-chip'), function (b) { b.addEventListener('click', function () { setActive(parseInt(b.getAttribute('data-i'), 10)); }); });
        Array.prototype.forEach.call(host.querySelectorAll('.wk-del'), function (b) { b.addEventListener('click', function () { deleteRoof(parseInt(b.getAttribute('data-i'), 10)); }); });
      }
    }
    renderRoofDetail();
  }
  function renderRoofDetail() {
    var host = $('roofDetail'); if (!host) return;
    var rf = aRoof();
    if (!rf) { host.innerHTML = ''; host.hidden = true; return; }
    host.hidden = false;
    host.innerHTML = I18N.t('roof_detail', active + 1, fmt(ringAreaSqm(rf.ring)), rf.az) +
      ' <button id="roofDelSel" class="ghost" style="margin-left:6px">' + I18N.t('del_roof') + '</button>';
    $('roofDelSel').addEventListener('click', function () { deleteRoof(active); });
  }

  // ---------- walkway (per active roof) ----------
  function wkLabel(roofIdx, i) { return I18N.t('wk_prefix') + (roofIdx + 1) + '/' + (i + 1); }
  function obLabel(roofIdx, i) { return I18N.t('ob_prefix') + (roofIdx + 1) + '/' + (i + 1); }
  function walkwayLength(line) { var d = 0; for (var i = 0; i < line.length - 1; i++) d += map.distance(L.latLng(line[i][0], line[i][1]), L.latLng(line[i + 1][0], line[i + 1][1])); return d; }
  function startWalkwayDraw() {
    if (!aRoof()) { setStatus(en() ? 'Add a roof first' : 'เพิ่มหลังคาก่อน'); return; }
    drawing = true; drawMode = 'walkway'; points = [];
    drawLayer.clearLayers(); map.doubleClickZoom.disable(); map.getContainer().classList.add('drawing');
    $('btnDraw').disabled = true; $('wkIdle').hidden = true; $('wkDrawing').hidden = false;
    showBanner(I18N.t('banner_wk'));
  }
  function cancelWalkwayDraw() { if (!drawing || drawMode !== 'walkway') return; drawing = false; points = []; map.doubleClickZoom.enable(); drawLayer.clearLayers(); endDrawUI(); }
  function renderWalkways() {
    walkwayLayer.clearLayers();
    roofs.forEach(function (rf, roofIdx) {
      rf.walkways.forEach(function (wk, idx) {
        var lls = wk.line.map(function (p) { return L.latLng(p[0], p[1]); });
        L.polyline(lls, { color: '#eab308', weight: 3, dashArray: '6 5' }).addTo(walkwayLayer);
        var mid = lls[Math.floor(lls.length / 2)];
        L.marker(mid, { icon: L.divIcon({ className: 'tag-label wk-tag', html: '<span>' + wkLabel(roofIdx, idx) + '</span>', iconSize: [0, 0] }), interactive: false, keyboard: false }).addTo(walkwayLayer);
      });
    });
  }
  function updateWalkwayList() {
    var rf = aRoof(), arr = rf ? rf.walkways : [];
    var host = $('walkwayList');
    if (host) {
      if (!arr.length) { host.innerHTML = '<span class="hint">' + I18N.t('wk_empty') + '</span>'; selectedWk = -1; }
      else {
        host.innerHTML = arr.map(function (_, i) {
          return '<span class="wk-item' + (i === selectedWk ? ' sel' : '') + '"><button class="wk-chip" data-i="' + i + '">' + wkLabel(active, i) + '</button><button class="wk-del" data-i="' + i + '" title="' + I18N.t('btn_del_line') + '">✕</button></span>';
        }).join('');
        Array.prototype.forEach.call(host.querySelectorAll('.wk-chip'), function (b) { b.addEventListener('click', function () { var i = parseInt(b.getAttribute('data-i'), 10); selectedWk = (selectedWk === i ? -1 : i); updateWalkwayList(); }); });
        Array.prototype.forEach.call(host.querySelectorAll('.wk-del'), function (b) { b.addEventListener('click', function () { deleteWalkway(parseInt(b.getAttribute('data-i'), 10)); }); });
      }
    }
    renderWalkwayDetail();
    if ($('btnClearWalkway')) $('btnClearWalkway').disabled = !arr.length;
  }
  function renderWalkwayDetail() {
    var host = $('wkDetail'); if (!host) return; var rf = aRoof();
    if (!rf || selectedWk < 0 || selectedWk >= rf.walkways.length) { host.innerHTML = ''; host.hidden = true; return; }
    var wk = rf.walkways[selectedWk]; host.hidden = false;
    host.innerHTML = I18N.t('wk_detail', wkLabel(active, selectedWk), fmt(walkwayLength(wk.line), 1)) +
      '<div class="row" style="align-items:flex-end;margin-top:6px"><label class="field">' + I18N.t('lbl_width') + '<input id="wkWidthEdit" type="number" value="' + wk.width + '" min="0.3" step="0.1"></label><button id="wkDelSel" class="ghost">' + I18N.t('btn_del_line') + '</button></div>';
    $('wkWidthEdit').addEventListener('change', function () { var v = parseFloat($('wkWidthEdit').value); if (v > 0) { rf.walkways[selectedWk].width = v; renderWalkways(); runCompute(); } });
    $('wkDelSel').addEventListener('click', function () { deleteWalkway(selectedWk); });
  }
  function deleteWalkway(i) { var rf = aRoof(); if (!rf || i < 0 || i >= rf.walkways.length) return; rf.walkways.splice(i, 1); if (selectedWk === i) selectedWk = -1; else if (selectedWk > i) selectedWk--; renderWalkways(); updateWalkwayList(); runCompute(); }
  function clearWalkways() { var rf = aRoof(); if (!rf) return; rf.walkways = []; selectedWk = -1; renderWalkways(); updateWalkwayList(); runCompute(); }

  // ---------- obstacle (per active roof) ----------
  function startPlaceObstacle() { if (!aRoof()) { setStatus(en() ? 'Add a roof first' : 'เพิ่มหลังคาก่อน'); return; } placingObstacle = true; map.getContainer().classList.add('drawing'); showBanner(I18N.t('banner_ob')); }
  function placeObstacle(latlng) {
    var rf = aRoof(); if (!rf) { placingObstacle = false; return; }
    var r = parseFloat($('obstacleRadius').value) || 1.5;
    rf.obstacles.push({ lat: latlng.lat, lng: latlng.lng, r: r });
    placingObstacle = false; map.getContainer().classList.remove('drawing'); hideBanner();
    renderObstacles(); updateObstacleList(); runCompute();
  }
  function renderObstacles() {
    obstacleLayer.clearLayers();
    roofs.forEach(function (rf, roofIdx) {
      rf.obstacles.forEach(function (ob, idx) {
        L.circle([ob.lat, ob.lng], { radius: ob.r, color: '#ef4444', weight: 2, fillColor: '#ef4444', fillOpacity: 0.28 }).addTo(obstacleLayer);
        L.marker([ob.lat, ob.lng], { icon: L.divIcon({ className: 'tag-label ob-tag', html: '<span>' + obLabel(roofIdx, idx) + '</span>', iconSize: [0, 0] }), interactive: false, keyboard: false }).addTo(obstacleLayer);
      });
    });
  }
  function updateObstacleList() {
    var rf = aRoof(), arr = rf ? rf.obstacles : [];
    var host = $('obstacleList');
    if (host) {
      if (!arr.length) { host.innerHTML = '<span class="hint">' + I18N.t('ob_empty') + '</span>'; selectedOb = -1; }
      else {
        host.innerHTML = arr.map(function (_, i) {
          return '<span class="wk-item ob' + (i === selectedOb ? ' sel' : '') + '"><button class="wk-chip" data-i="' + i + '">' + obLabel(active, i) + '</button><button class="wk-del" data-i="' + i + '" title="' + I18N.t('btn_del_one') + '">✕</button></span>';
        }).join('');
        Array.prototype.forEach.call(host.querySelectorAll('.wk-chip'), function (b) { b.addEventListener('click', function () { var i = parseInt(b.getAttribute('data-i'), 10); selectedOb = (selectedOb === i ? -1 : i); updateObstacleList(); }); });
        Array.prototype.forEach.call(host.querySelectorAll('.wk-del'), function (b) { b.addEventListener('click', function () { deleteObstacle(parseInt(b.getAttribute('data-i'), 10)); }); });
      }
    }
    renderObstacleDetail();
    if ($('btnClearObstacle')) $('btnClearObstacle').disabled = !arr.length;
  }
  function renderObstacleDetail() {
    var host = $('obDetail'); if (!host) return; var rf = aRoof();
    if (!rf || selectedOb < 0 || selectedOb >= rf.obstacles.length) { host.innerHTML = ''; host.hidden = true; return; }
    var ob = rf.obstacles[selectedOb]; host.hidden = false;
    host.innerHTML = I18N.t('ob_detail', obLabel(active, selectedOb), fmt(ob.r * 2, 1)) +
      '<div class="row" style="align-items:flex-end;margin-top:6px"><label class="field">' + I18N.t('lbl_radius') + '<input id="obRadiusEdit" type="number" value="' + ob.r + '" min="0.3" step="0.1"></label><button id="obDelSel" class="ghost">' + I18N.t('btn_del_one') + '</button></div>';
    $('obRadiusEdit').addEventListener('change', function () { var v = parseFloat($('obRadiusEdit').value); if (v > 0) { rf.obstacles[selectedOb].r = v; renderObstacles(); runCompute(); } });
    $('obDelSel').addEventListener('click', function () { deleteObstacle(selectedOb); });
  }
  function deleteObstacle(i) { var rf = aRoof(); if (!rf || i < 0 || i >= rf.obstacles.length) return; rf.obstacles.splice(i, 1); if (selectedOb === i) selectedOb = -1; else if (selectedOb > i) selectedOb--; renderObstacles(); updateObstacleList(); runCompute(); }
  function clearObstacles() { var rf = aRoof(); if (!rf) return; rf.obstacles = []; selectedOb = -1; renderObstacles(); updateObstacleList(); runCompute(); }

  // ---------- compute (each roof its own everything) ----------
  function computeAll(overrideMod) {
    var agg = { projected: 0, trueA: 0, count: 0, kwp: 0, weight: 0, footprint: 0, warnings: [] };
    var per = [], allPanels = [];
    roofs.forEach(function (rf, idx) {
      var m = MODULES[overrideMod || rf.module];
      var res = RoofEngine.computeLayout({
        ring: rf.ring, tiltDeg: rf.tiltUnknown ? null : rf.tilt, azimuthDeg: rf.az,
        module: { watt: m.watt, width: m.width, height: m.height, weightKg: m.weightKg },
        rules: { setback: rf.setback, rowGap: rf.rowGap, colGap: rf.colGap, orientation: rf.orientation, walkwayWidth: rf.walkwayWidth, walkwayEvery: rf.walkwayEvery },
        walkways: rf.walkways, obstacles: rf.obstacles
      });
      if (!res.ok) return;
      allPanels = allPanels.concat(res.panels);
      per.push({ idx: idx, az: rf.az, tilt: res.tiltDeg, mod: m.short, res: res });
      agg.projected += res.projectedAreaSqm; agg.trueA += res.trueAreaSqm;
      agg.count += res.panelCount; agg.kwp += res.dcCapacityKwp; agg.weight += res.totalWeightKg;
      agg.footprint += res.panelCount * m.width * m.height;
      (res.warnings || []).forEach(function (w) { agg.warnings.push(I18N.t('roof_prefix') + (idx + 1) + ': ' + w); });
    });
    agg.load = agg.trueA > 0 ? agg.weight / agg.trueA : 0;
    agg.coverage = agg.trueA > 0 ? agg.footprint / agg.trueA : 0;
    return { agg: agg, per: per, panels: allPanels };
  }
  function runCompute() {
    updateAccSummaries();
    if (!roofs.length) { panelLayer.clearLayers(); closeSummary(); return; }
    var out = computeAll();
    lastAgg = out.agg; lastPer = out.per;
    drawPanels(out.panels);
    if (summaryOpen) updateResults(out.agg, out.per);
  }
  function drawPanels(panels) {
    panelLayer.clearLayers();
    for (var i = 0; i < panels.length; i++) L.polygon(panels[i], { color: '#1d4ed8', weight: 0.6, fillColor: '#3b82f6', fillOpacity: 0.7 }).addTo(panelLayer);
  }

  // ---------- results / summary modal ----------
  function openSummary() {
    if (!roofs.length) { if ($('confirmMsg')) $('confirmMsg').textContent = I18N.t('confirm_none'); return; }
    if ($('confirmMsg')) $('confirmMsg').textContent = '';
    var out = computeAll(); lastAgg = out.agg; lastPer = out.per;
    drawPanels(out.panels);
    updateResults(out.agg, out.per);
    if ($('dlMsg')) $('dlMsg').textContent = '';
    summaryOpen = true; $('summaryModal').classList.add('open');
  }
  function closeSummary() { summaryOpen = false; if ($('summaryModal')) $('summaryModal').classList.remove('open'); }

  // ---------- export ----------
  function round(x, d) { var m = Math.pow(10, d); return Math.round((x || 0) * m) / m; }
  function siteAddress() {
    var q = ($('search') && $('search').value.trim()) || '';
    var c = map.getCenter();
    return { link: q, coords: c.lat.toFixed(6) + ', ' + c.lng.toFixed(6) };
  }
  function projectName() {
    var p = ($('projName') && $('projName').value.trim()) || '';
    return p || (en() ? '(untitled project)' : '(ยังไม่ตั้งชื่อโครงการ)');
  }
  function safeName() { return projectName().replace(/[\\/:*?"<>|]/g, '_').slice(0, 40); }
  var WM_SCREEN = 0.14, WM_DOWNLOAD = 0.29;   // ลายน้ำ: หน้าจอจาง · ไฟล์ดาวน์โหลดเข้มขึ้น ~+15%
  function setWatermark(op) {
    var wm = document.getElementById('watermark'); if (!wm) return;
    if (typeof op !== 'number') op = WM_SCREEN;
    var p = ($('projName') && $('projName').value.trim()) || '';
    var txt = 'Amcharge' + (p ? ' · ' + p : '') + ' · Confidential';
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="210">' +
      '<text x="10" y="112" transform="rotate(-28 180 105)" font-family="Sarabun,Arial,sans-serif" font-size="19" font-weight="700" fill="rgba(255,255,255,' + op + ')">' + esc(txt) + '</text></svg>';
    wm.style.backgroundImage = 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
  }
  function exportExcel() {
    if (!roofs.length || !window.XLSX) { $('dlMsg').textContent = I18N.t('dl_none'); return; }
    var out = computeAll(); var agg = out.agg, per = out.per, E = en(), addr = siteAddress();
    var d = new Date(), p2 = function (n) { return ('0' + n).slice(-2); };
    var dateStr = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
    var aoa = [];
    aoa.push([E ? 'Project' : 'ชื่อโครงการ', projectName()]);
    aoa.push([E ? 'Map location / link' : 'ตำแหน่ง / ลิงก์แผนที่', addr.link]);
    aoa.push([E ? 'Coordinates (site center)' : 'พิกัด (กลางไซต์)', addr.coords]);
    aoa.push([E ? 'Exported' : 'วันที่ออกรายงาน', dateStr]);
    aoa.push([E ? 'Source' : 'ที่มา', 'Amcharge AI Roof Planner (demo) · Esri World Imagery']);
    aoa.push([]);
    aoa.push([E ? 'SITE TOTAL' : 'รวมทั้งไซต์']);
    aoa.push([E ? 'Installed DC (kWp)' : 'กำลังติดตั้ง DC (kWp)', round(agg.kwp, 1)]);
    aoa.push([E ? 'Panels' : 'จำนวนแผง', agg.count]);
    aoa.push([E ? 'True area (m2)' : 'พื้นที่จริง (ตร.ม.)', round(agg.trueA, 0)]);
    aoa.push([E ? 'Projected area (m2)' : 'พื้นที่เงา (ตร.ม.)', round(agg.projected, 0)]);
    aoa.push([E ? 'Usable ratio (%)' : 'สัดส่วนพื้นที่ที่ใช้ได้ (%)', round(agg.coverage * 100, 0)]);
    aoa.push([E ? 'Total weight (ton)' : 'น้ำหนักรวม (ตัน)', round(agg.weight / 1000, 1)]);
    aoa.push([E ? 'Avg roof load (kg/m2)' : 'โหลดเฉลี่ยหลังคา (กก./ตร.ม.)', round(agg.load, 1)]);
    aoa.push([E ? 'Roofs' : 'จำนวนหลังคา', roofs.length]);
    aoa.push([]);
    aoa.push([E ? 'PER-ROOF BREAKDOWN' : 'แยกรายหลัง']);
    aoa.push([E ? 'Roof' : 'หลังคา', E ? 'Area (m2)' : 'พื้นที่ (ตร.ม.)', E ? 'Module' : 'รุ่นแผง', E ? 'Tilt (deg)' : 'ความชัน (°)', E ? 'Facing (deg)' : 'ทิศ (°)', E ? 'Panels' : 'แผง', 'kWp', E ? 'Weight (ton)' : 'น้ำหนัก (ตัน)', E ? 'Walkways' : 'ทางเดิน', E ? 'Obstacles' : 'สิ่งกีดขวาง']);
    per.forEach(function (pp) {
      var rf = roofs[pp.idx];
      aoa.push([(E ? 'R' : 'ล') + (pp.idx + 1), round(pp.res.trueAreaSqm, 0), MODULES[rf.module].label, (rf.tiltUnknown ? '?' : rf.tilt), rf.az, pp.res.panelCount, round(pp.res.dcCapacityKwp, 1), round(pp.res.totalWeightKg / 1000, 2), rf.walkways.length, rf.obstacles.length]);
    });
    aoa.push([]);
    aoa.push([E ? 'COMPARE PV (whole site)' : 'เปรียบเทียบ PV (ทั้งไซต์)']);
    aoa.push([E ? 'Model' : 'รุ่น', E ? 'Panels' : 'แผง', 'kWp', E ? 'Weight (ton)' : 'น้ำหนัก (ตัน)', 'kg/m2']);
    var cmp = MODULE_ORDER.map(function (k) { return { k: k, a: computeAll(k).agg }; });
    var bestKwp = Math.max.apply(null, cmp.map(function (c) { return c.a.kwp; }));
    cmp.forEach(function (c) {
      var best = (c.a.kwp === bestKwp);
      aoa.push([(best ? '* ' : '') + MODULES[c.k].label, c.a.count, round(c.a.kwp, 1), round(c.a.weight / 1000, 1), round(c.a.load, 1)]);
    });
    aoa.push([]);
    aoa.push([E ? '* Best Choice = model that installs the most total capacity (kWp) on the same roof area.'
      : '* Best Choice = รุ่นที่ติดตั้งกำลังผลิตรวมได้สูงสุด (kWp) บนพื้นที่หลังคาเดิม']);
    aoa.push([E ? '  (Higher kWp = more energy per year on the same area; annual kWh to be added later.)'
      : '  (kWp สูง = ได้พลังงานต่อปีมากกว่าบนพื้นที่เท่ากัน · ค่า kWh/ปี จะเพิ่มในเฟสถัดไป)']);
    var ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 34 }, { wch: 16 }, { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, E ? 'Summary' : 'สรุป');
    XLSX.writeFile(wb, 'Amcharge_' + safeName() + '.xlsx');
    $('dlMsg').textContent = I18N.t('dl_ok');
  }
  function snapshot() {
    if (!roofs.length) { $('dlMsg').textContent = I18N.t('dl_none'); return; }
    if (!window.html2canvas) { $('dlMsg').textContent = I18N.t('snap_fail'); return; }
    $('dlMsg').textContent = I18N.t('snap_wait');
    setWatermark(WM_DOWNLOAD);   // เข้มขึ้นเฉพาะในไฟล์รูป
    html2canvas(map.getContainer(), { useCORS: true, allowTaint: false, logging: false, backgroundColor: null }).then(function (canvas) {
      setWatermark();            // คืนค่าจางบนหน้าจอ
      canvas.toBlob(function (blob) {
        if (!blob) { $('dlMsg').textContent = I18N.t('snap_fail'); return; }
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'Amcharge_' + safeName() + '.png';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
        $('dlMsg').textContent = I18N.t('snap_ok');
      });
    }).catch(function () { setWatermark(); $('dlMsg').textContent = I18N.t('snap_fail'); });
  }
  function updateResults(agg, per) {
    var tilts = per.map(function (p) { return p.tilt; });
    var sameTilt = tilts.every(function (t) { return Math.abs(t - tilts[0]) < 0.01; });
    $('resProjected').textContent = fmt(agg.projected);
    $('resTrue').textContent = fmt(agg.trueA);
    $('resTilt').textContent = per.length && sameTilt ? (fmt(tilts[0], 1) + '°') : I18N.t('varies');
    $('resCount').textContent = fmt(agg.count);
    $('resKwp').textContent = fmt(agg.kwp, 1);
    $('resCoverage').textContent = fmt(agg.coverage * 100, 0) + '%';
    $('resWeight').textContent = fmt(agg.weight / 1000, 1);
    $('resLoad').textContent = fmt(agg.load, 1);

    var bd = $('resBreakdown');
    if (bd) {
      if (per && per.length > 1) {
        bd.hidden = false;
        bd.innerHTML = '<div class="bd-title">' + I18N.t('breakdown_title') + '</div>' + per.map(function (p) {
          return '<div class="bd-row"><span class="bd-tag">' + I18N.t('roof_prefix') + (p.idx + 1) + '</span>' +
            '<span>' + fmt(p.res.panelCount) + ' ' + I18N.t('u_panels') + '</span>' +
            '<span><b>' + fmt(p.res.dcCapacityKwp, 1) + '</b> kWp</span>' +
            '<span>' + p.mod + '</span>' +
            '<span>' + I18N.t('lbl_facing') + ' ' + p.az + '°</span></div>';
        }).join('');
      } else { bd.hidden = true; bd.innerHTML = ''; }
    }

    var T = I18N.t, b = $('badges'); b.innerHTML = '';
    addBadge(b, T('badge_engine'), true);
    addBadge(b, roofs.length + ' ' + T('badge_roofs'), false);
    addBadge(b, T('badge_img'), false);

    var w = $('warnings');
    if (agg.warnings && agg.warnings.length) { w.hidden = false; w.innerHTML = '<b>' + T('warn_title') + '</b><ul>' + agg.warnings.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>'; }
    else { w.hidden = true; w.innerHTML = ''; }

    renderCompare();
  }
  function addBadge(parent, text, good) { var s = document.createElement('span'); s.className = 'badge' + (good ? ' good' : ''); s.textContent = text; parent.appendChild(s); }

  // ---------- meters / labels ----------
  function polyAreaSqm(lls) {
    if (lls.length < 3) return 0;
    var lat0 = 0, lng0 = 0, R = 6378137, i;
    for (i = 0; i < lls.length; i++) { lat0 += lls[i].lat; lng0 += lls[i].lng; }
    lat0 /= lls.length; lng0 /= lls.length;
    var m = lls.map(function (p) { return [(p.lng - lng0) * Math.PI / 180 * R * Math.cos(lat0 * Math.PI / 180), (p.lat - lat0) * Math.PI / 180 * R]; });
    var a = 0; for (i = 0; i < m.length; i++) { var j = (i + 1) % m.length; a += m[i][0] * m[j][1] - m[j][0] * m[i][1]; }
    return Math.abs(a) / 2;
  }
  function edgeLabel(a, b, layer) {
    var d = map.distance(a, b), mid = L.latLng((a.lat + b.lat) / 2, (a.lng + b.lng) / 2);
    L.marker(mid, { icon: L.divIcon({ className: 'len-label', html: '<span>' + d.toFixed(1) + (en() ? ' m' : ' ม.') + '</span>', iconSize: [0, 0] }), interactive: false, keyboard: false }).addTo(layer);
  }

  // ---------- compass ----------
  var compassNeedle = null, compassRose = null, compassCap = null;
  function azName(deg) { deg = ((deg % 360) + 360) % 360; return I18N.t('dirs')[Math.round(deg / 45) % 8]; }
  function mapBearing() { return (map.getBearing ? map.getBearing() : 0) || 0; }
  function updateCompass() {
    if (!compassNeedle) return;
    var az = currentAz(), b = mapBearing();
    compassNeedle.setAttribute('transform', 'rotate(' + (az - b) + ' 30 30)');
    if (compassRose) compassRose.setAttribute('transform', 'rotate(' + (-b) + ' 30 30)');
  }
  function updateAzLabel() {
    var d = currentAz(), rec = (d >= 157.5 && d <= 202.5) ? I18N.t('az_rec') : '';
    $('azVal').textContent = d + '° · ' + azName(d) + rec;
    updateCompass();
  }
  function addCompass() {
    var ctrl = L.control({ position: 'topright' });
    ctrl.onAdd = function () {
      var d = L.DomUtil.create('div', 'compass');
      d.innerHTML = '<svg width="60" height="60" viewBox="0 0 60 60"><circle cx="30" cy="30" r="27" fill="rgba(15,23,42,.82)" stroke="#475569" stroke-width="1"/><g id="cmp-rose" fill="#e2e8f0" font-size="10" font-weight="700" text-anchor="middle"><text x="30" y="13.5">N</text><text x="49" y="34">E</text><text x="30" y="54">S</text><text x="11" y="34">W</text></g><g id="cmp-needle"><polygon points="30,9 25.5,30 30,26 34.5,30" fill="#ef4444"/><polygon points="30,51 25.5,30 30,34 34.5,30" fill="#94a3b8"/></g><circle cx="30" cy="30" r="2.5" fill="#fff"/></svg><div class="compass-cap" id="cmp-cap">' + I18N.t('compass_cap') + '</div>';
      L.DomEvent.disableClickPropagation(d);
      d.onclick = function () { if (map.setBearing) map.setBearing(0); updateCompass(); };
      return d;
    };
    ctrl.addTo(map);
    compassNeedle = document.getElementById('cmp-needle'); compassRose = document.getElementById('cmp-rose'); compassCap = document.getElementById('cmp-cap');
    updateCompass();
  }

  // ---------- compare (override module across all roofs) ----------
  function buildCompareChecks() {
    var host = $('cmpChecks'); if (!host) return;
    host.innerHTML = MODULE_ORDER.map(function (k) { return '<label class="checkbox"><input type="checkbox" class="cmp-check" value="' + k + '" checked> ' + esc(MODULES[k].short) + '</label>'; }).join('');
    Array.prototype.forEach.call(host.querySelectorAll('.cmp-check'), function (c) { c.addEventListener('change', renderCompare); });
  }
  function renderCompare() {
    var body = $('cmpBody'); if (!body || !roofs.length) return;
    var keys = []; Array.prototype.forEach.call(document.querySelectorAll('.cmp-check'), function (c) { if (c.checked) keys.push(c.value); });
    if (!keys.length) { body.innerHTML = '<tr><td colspan="5" class="hint">' + (en() ? 'Select at least 1 model' : 'เลือกรุ่นอย่างน้อย 1') + '</td></tr>'; return; }
    var rows = keys.map(function (k) { return { m: MODULES[k], agg: computeAll(k).agg }; });
    var maxKwp = Math.max.apply(null, rows.map(function (r) { return r.agg.kwp; }));
    body.innerHTML = rows.map(function (r) {
      var win = r.agg.kwp === maxKwp;
      return '<tr' + (win ? ' class="win"' : '') + '><td>' + esc(r.m.short) + (win ? ' ★' : '') + '</td><td>' + fmt(r.agg.count) + '</td><td><b>' + fmt(r.agg.kwp, 1) + '</b></td><td>' + fmt(r.agg.weight / 1000, 1) + '</td><td>' + fmt(r.agg.load, 1) + '</td></tr>';
    }).join('');
  }

  // ---------- add-roof shortcut ----------
  function addRoofFlow() {
    openAcc(1);
    var s1 = document.querySelector('.acc[data-acc="1"]');
    if (s1 && s1.scrollIntoView) s1.scrollIntoView({ behavior: 'smooth', block: 'start' });
    var rw = $('roofW'); if (rw) { rw.focus(); rw.select && rw.select(); }
    setStatus(en() ? 'Set width/length then “＋ Place size”, or “✏️ Draw” for an irregular roof' : 'ใส่กว้าง/ยาว แล้ว “＋ ปักขนาด” หรือ “✏️ วาดเอง” สำหรับรูปทรงไม่เหลี่ยม');
  }

  // ---------- search ----------
  function extractLatLng(s) {
    var m;
    m = s.match(/^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/); if (m) return [parseFloat(m[1]), parseFloat(m[2])];
    m = s.match(/@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/); if (m) return [parseFloat(m[1]), parseFloat(m[2])];
    m = s.match(/!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/); if (m) return [parseFloat(m[1]), parseFloat(m[2])];
    m = s.match(/[?&]q=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/); if (m) return [parseFloat(m[1]), parseFloat(m[2])];
    return null;
  }
  function search() {
    var q = $('search').value.trim(); if (!q) return;
    var ll = extractLatLng(q);
    if (ll) { map.setView(ll, 18); setStatus((en() ? 'Went to ' : 'ไปที่พิกัด ') + ll[0].toFixed(6) + ', ' + ll[1].toFixed(6)); return; }
    setStatus(en() ? 'Searching…' : 'กำลังค้นหา…');
    fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=th&q=' + encodeURIComponent(q))
      .then(function (r) { return r.json(); })
      .then(function (list) { if (list && list.length) { map.setView([parseFloat(list[0].lat), parseFloat(list[0].lon)], 18); setStatus(''); } else { setStatus(en() ? 'Not found — try a Google Maps link or coordinates' : 'ไม่พบชื่อนี้ — ลองวางลิงก์ Google Maps หรือพิกัด'); } })
      .catch(function () { setStatus(en() ? 'Search failed' : 'ค้นหาไม่สำเร็จ'); });
  }

  // ---------- language ----------
  function updateLangSeg() { var seg = $('langSeg'); if (!seg) return; Array.prototype.forEach.call(seg.querySelectorAll('button'), function (b) { b.classList.toggle('active', b.getAttribute('data-lang') === I18N.getLang()); }); }
  function refreshLang() {
    I18N.applyStatic(); updateLangSeg();
    if (compassCap) compassCap.textContent = I18N.t('compass_cap');
    updateAzLabel(); updateRoofList(); updateWalkwayList(); updateObstacleList();
    updateRoofBar(); updateAccSummaries();
    renderRoofs(); renderWalkways(); renderObstacles();
    if (summaryOpen && lastAgg) updateResults(lastAgg, lastPer);
    if (!roofs.length && $('confirmMsg')) $('confirmMsg').textContent = '';
  }

  // ---------- init ----------
  function init() {
    banner = L.DomUtil.create('div', 'draw-banner'); banner.hidden = true; map.getContainer().appendChild(banner);
    var wm = L.DomUtil.create('div', 'wm-layer'); wm.id = 'watermark'; wm.setAttribute('aria-hidden', 'true');
    map.getContainer().appendChild(wm); setWatermark();
    addCompass(); map.on('rotate rotateend', updateCompass);
    map.on('click', onMapClick);
    map.on('dblclick', function (e) { if (drawing) { L.DomEvent.stop(e); finishDraw(); } });

    $('btnDraw').addEventListener('click', startDraw);
    $('btnFinish').addEventListener('click', finishDraw);
    $('btnClear').addEventListener('click', clearAll);
    $('btnRect').addEventListener('click', makeRect);
    $('roofW').addEventListener('keydown', function (e) { if (e.key === 'Enter') makeRect(); });
    $('roofL').addEventListener('keydown', function (e) { if (e.key === 'Enter') makeRect(); });
    $('btnWalkway').addEventListener('click', startWalkwayDraw);
    $('btnWalkwayDone').addEventListener('click', finishDraw);
    $('btnWalkwayCancel').addEventListener('click', cancelWalkwayDraw);
    $('btnClearWalkway').addEventListener('click', clearWalkways);
    $('btnObstacle').addEventListener('click', startPlaceObstacle);
    $('btnClearObstacle').addEventListener('click', clearObstacles);
    $('btnConfirm').addEventListener('click', openSummary);
    $('btnAddRoof').addEventListener('click', addRoofFlow);
    $('modalClose').addEventListener('click', closeSummary);
    $('modalEdit').addEventListener('click', closeSummary);
    $('btnDownload').addEventListener('click', exportExcel);
    $('btnSnapshot').addEventListener('click', snapshot);
    $('summaryModal').addEventListener('click', function (e) { if (e.target === $('summaryModal')) closeSummary(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && summaryOpen) closeSummary(); });
    Array.prototype.forEach.call(document.querySelectorAll('.acc-head'), function (h) {
      h.addEventListener('click', function () { toggleAcc(h.parentNode.getAttribute('data-acc')); });
    });
    $('btnCompute').addEventListener('click', function () { syncActiveFromUI(); runCompute(); });
    $('projName').addEventListener('input', function () { setWatermark(); });
    $('searchBtn').addEventListener('click', search);
    $('search').addEventListener('keydown', function (e) { if (e.key === 'Enter') search(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && placingObstacle) { placingObstacle = false; map.getContainer().classList.remove('drawing'); hideBanner(); } });
    Array.prototype.forEach.call($('langSeg').querySelectorAll('button'), function (b) { b.addEventListener('click', function () { if (b.getAttribute('data-lang') === I18N.getLang()) return; I18N.setLang(b.getAttribute('data-lang')); refreshLang(); }); });

    // พารามิเตอร์ (หัวข้อ 2) — เขียนลงหลังคาที่กำลังทำ
    $('roofType').addEventListener('change', function () { var t = ROOF_TYPES[$('roofType').value]; if (t) { $('tiltUnknown').checked = false; $('tilt').disabled = false; $('tilt').value = t.tilt; } syncActiveFromUI(); runCompute(); });
    ['module', 'tilt', 'setback', 'rowGap', 'colGap', 'orientation', 'walkwayWidth', 'walkwayEvery'].forEach(function (id) {
      $(id).addEventListener('change', function () { syncActiveFromUI(); runCompute(); });
    });
    $('azimuth').addEventListener('input', updateAzLabel);
    $('azimuth').addEventListener('change', function () { syncActiveFromUI(); renderRoofs(); renderRoofDetail(); runCompute(); });
    $('tiltUnknown').addEventListener('change', function () { $('tilt').disabled = $('tiltUnknown').checked; syncActiveFromUI(); runCompute(); });

    $('btnFinish').disabled = true;
    buildCompareChecks();
    I18N.applyStatic(); updateLangSeg();
    openAcc(1);                              // เริ่มเปิดหัวข้อ 1
    updateRoofList(); loadActiveToUI();      // เริ่มว่าง (ปุ่ม params ปิดจนกว่าจะเพิ่มหลังคา)
    setStatus(en() ? 'Search your site, then add a roof (＋)' : 'ค้นหาไซต์ แล้วเพิ่มหลังคา (＋)');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
