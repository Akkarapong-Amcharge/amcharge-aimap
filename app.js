/* app.js — Leaflet map + วาดหลังคา + เชื่อม engine + AI (Amcharge AI Roof Planner) */
(function () {
  'use strict';

  // ---------- master data (เดโม — ค่าจริงรอวิศวกรตาม O-05) ----------
  // แผงจริง LONGi Hi-MO (width = ด้านสั้น 1.134 ม., height = ด้านยาว)
  var MODULES = {
    'lr8-620': { label: 'Hi-MO 7 LR8-66HGD-620M · 620W', short: '620M', watt: 620, width: 1.134, height: 2.382, weightKg: 33.5, segment: 'ci' },
    'lr7-505': { label: 'Hi-MO X10 LR7-54HVH-505M · 505W', short: '505M', watt: 505, width: 1.134, height: 1.800, weightKg: 21.6, segment: 'ci' },
    'lr7-560': { label: 'Hi-MO X10 LR7-60HVH-560M · 560W', short: '560M', watt: 560, width: 1.134, height: 1.990, weightKg: 25.3, segment: 'ci' },
    'lr5-585': { label: 'Hi-MO 6 LR5-72HTH-585M · 585W', short: '585M', watt: 585, width: 1.134, height: 2.278, weightKg: 27.5, segment: 'ci' },
    'lr7-640': { label: 'Hi-MO 9 LR7-72HYD-640M · 640W', short: '640M', watt: 640, width: 1.134, height: 2.382, weightKg: 33.5, segment: 'ci' }
  };
  var MODULE_ORDER = ['lr8-620', 'lr7-505', 'lr7-560', 'lr5-585', 'lr7-640'];
  var RULES = {
    ci:          { setback: 1.0, rowGap: 0.05, colGap: 0.02, orientation: 'portrait', walkwayWidth: 0, walkwayEvery: 6 },
    residential: { setback: 0.3, rowGap: 0.05, colGap: 0.02, orientation: 'portrait', walkwayWidth: 0, walkwayEvery: 0 }
  };
  var SEG_LABEL = { ci: 'C&I (โรงงาน/คลังสินค้า)', residential: 'ที่พักอาศัย' };
  // ชนิดหลังคา → ความชัน default (แก้เองได้)
  var ROOF_TYPES = {
    metal: { label: 'เมทัลชีท (โรงงาน)', tilt: 7 },
    flat:  { label: 'ดาดฟ้าเรียบ',       tilt: 3 },
    tile:  { label: 'กระเบื้อง (บ้าน)',   tilt: 30 }
  };

  // ---------- map ----------
  var map = L.map('map', {
    preferCanvas: true, doubleClickZoom: true,
    rotate: true, touchRotate: true, shiftKeyRotate: true, rotateControl: false, bearing: 0
  }).setView([13.421, 101.104], 18);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 21, maxNativeZoom: 19,
    attribution: 'ภาพ © Esri, Maxar, Earthstar Geographics'
  }).addTo(map);
  // แถบมาตราส่วน (เมตร) — บอกระยะจริงบนพื้น อัปเดตทุกครั้งที่ซูม
  L.control.scale({ metric: true, imperial: false, maxWidth: 140, position: 'bottomleft' }).addTo(map);

  var roofLayer = L.layerGroup().addTo(map);
  var panelLayer = L.layerGroup().addTo(map);
  var walkwayLayer = L.layerGroup().addTo(map);
  var obstacleLayer = L.layerGroup().addTo(map);
  var drawLayer = L.layerGroup().addTo(map);

  // ---------- state ----------
  var drawing = false;
  var drawMode = 'roof';       // 'roof' | 'walkway'
  var placingObstacle = false; // โหมดคลิกวางสิ่งกีดขวาง
  var points = [];             // [L.LatLng]
  var roofs = [];              // [{ ring:[[lat,lng]...], az:number }, ...] หลายหลังคา
  var selectedRoof = -1;       // หลังคาที่เลือกอยู่ (สไลเดอร์ทิศคุมหลังนี้)
  var walkways = [];           // [{ line:[[lat,lng]...], width:number }, ...]
  var obstacles = [];          // [{ lat, lng, r }, ...] สิ่งกีดขวางวงกลม
  var selectedWk = -1, selectedOb = -1; // ดัชนีที่กำลังดู detail
  var lastAgg = null, lastPer = null;   // ผลรวม + รายหลัง
  var confirmed = false;                // ยืนยัน/ล็อกแผนแล้วหรือยัง
  var lastResult = null, lastContext = null, lastMod = null;

  var $ = function (id) { return document.getElementById(id); };

  // ป้ายบอกสถานะกลางแผนที่ (โหมดวาด)
  var banner = null;
  function showBanner(t) { if (banner) { banner.textContent = t; banner.hidden = false; } }
  function hideBanner() { if (banner) banner.hidden = true; }

  // ---------- drawing ----------
  function currentAz() { var a = parseFloat($('azimuth').value); return isNaN(a) ? 180 : a; }
  function startDraw() {
    drawing = true; drawMode = 'roof'; points = [];
    drawLayer.clearLayers();
    map.doubleClickZoom.disable();
    map.getContainer().classList.add('drawing');
    $('btnDraw').disabled = true; $('btnDraw').textContent = I18N.getLang() === 'en' ? 'drawing…' : 'กำลังวาด…';
    $('btnFinish').disabled = false; $('btnFinish').classList.add('primary', 'pulse');
    setStatus('');
    showBanner(I18N.t('banner_roof'));
  }
  function startWalkwayDraw() {
    if (!roofs.length) { setStatus(I18N.getLang() === 'en' ? 'Place a roof first' : 'วางหลังคาก่อน'); return; }
    drawing = true; drawMode = 'walkway'; points = [];
    drawLayer.clearLayers();
    map.doubleClickZoom.disable();
    map.getContainer().classList.add('drawing');
    $('btnDraw').disabled = true;
    $('wkIdle').hidden = true; $('wkDrawing').hidden = false;
    showBanner(I18N.t('banner_wk'));
  }
  function endDrawUI() {
    map.getContainer().classList.remove('drawing');
    $('btnDraw').disabled = false; $('btnDraw').textContent = 'เริ่มวาดหลังคา';
    $('btnFinish').classList.remove('primary', 'pulse'); $('btnFinish').disabled = true;
    if ($('wkDrawing')) $('wkDrawing').hidden = true;
    if ($('wkIdle')) $('wkIdle').hidden = false;
    hideBanner();
  }
  function cancelWalkwayDraw() {
    if (!drawing || drawMode !== 'walkway') return;
    drawing = false; points = [];
    map.doubleClickZoom.enable();
    drawLayer.clearLayers();
    endDrawUI();
  }
  function redrawTemp() {
    drawLayer.clearLayers();
    var isWalk = (drawMode === 'walkway');
    var col = isWalk ? '#eab308' : '#0ea5a4';
    points.forEach(function (p) {
      L.circleMarker(p, { radius: 4, color: col, weight: 2, fillColor: '#fff', fillOpacity: 1 }).addTo(drawLayer);
    });
    if (!isWalk && points.length >= 3) {
      L.polygon(points, { color: col, weight: 2, dashArray: '4 4', fillColor: col, fillOpacity: 0.1 }).addTo(drawLayer);
    } else if (points.length >= 2) {
      L.polyline(points, { color: col, weight: isWalk ? 3 : 2, dashArray: '4 4' }).addTo(drawLayer);
    }
    if (points.length >= 1) {
      L.circleMarker(points[0], { radius: 6, color: col, weight: 3, fillColor: '#fff', fillOpacity: 1 }).addTo(drawLayer);
    }
    for (var k = 0; k < points.length - 1; k++) edgeLabel(points[k], points[k + 1], drawLayer);
    if (!isWalk && points.length >= 3) edgeLabel(points[points.length - 1], points[0], drawLayer);
  }
  function onMapClick(e) {
    if (placingObstacle) { placeObstacle(e.latlng); return; }
    if (!drawing) return;
    // คลิกใกล้จุดแรก (เมื่อมี ≥3 จุด) = ปิดรูป (เฉพาะโหมดหลังคา)
    if (drawMode === 'roof' && points.length >= 3) {
      var p0 = map.latLngToContainerPoint(points[0]);
      var pc = map.latLngToContainerPoint(e.latlng);
      if (Math.sqrt((p0.x - pc.x) * (p0.x - pc.x) + (p0.y - pc.y) * (p0.y - pc.y)) < 16) { finishDraw(); return; }
    }
    points.push(e.latlng);
    redrawTemp();
    var en = I18N.getLang() === 'en', n = points.length;
    if (drawMode === 'walkway') {
      showBanner(en ? (n + ' point(s) — press “✓ Finish this line” (step 3, ≥ 2)') : ('แนวทางเดิน ' + n + ' จุด — กด “✓ เสร็จเส้นนี้” (หัวข้อ 3, ต้อง ≥ 2 จุด)'));
    } else if (n < 3) {
      showBanner(en ? (n + ' point(s) — need at least 3') : ('วางแล้ว ' + n + ' จุด — ต้องอย่างน้อย 3 จุด'));
    } else {
      var area = Math.round(polyAreaSqm(points)).toLocaleString(en ? 'en-US' : 'th-TH');
      showBanner(en ? (n + ' points • area ~' + area + ' m² — press “✓ Done” (or click the first point)') : ('วางแล้ว ' + n + ' จุด • พื้นที่ ~' + area + ' ตร.ม. — กด “✓ เสร็จ” (หรือคลิกจุดแรกซ้ำ)'));
    }
  }
  function finishDraw() {
    if (!drawing) return;
    if (drawMode === 'walkway') {
      if (points.length < 2) { showBanner('ต้องมีอย่างน้อย 2 จุด — คลิกเพิ่ม'); return; }
      drawing = false; map.doubleClickZoom.enable();
      var wdt = parseFloat($('drawWalkwayWidth').value) || 1.2;
      walkways.push({ line: points.map(function (p) { return [p.lat, p.lng]; }), width: wdt });
      drawLayer.clearLayers();
      renderWalkways();
      endDrawUI(); updateWalkwayCount();
      runCompute();
      return;
    }
    if (points.length < 3) { setStatus('ต้องมีอย่างน้อย 3 จุด'); showBanner('ต้องมีอย่างน้อย 3 จุด — คลิกเพิ่ม'); return; }
    drawing = false;
    map.doubleClickZoom.enable();
    roofs.push({ ring: points.map(function (p) { return [p.lat, p.lng]; }), az: currentAz() });
    selectedRoof = roofs.length - 1;
    drawLayer.clearLayers();
    renderRoofs(); updateRoofList();
    endDrawUI();
    setStatus('');
    runCompute();
  }
  // ---------- walkway (ทางเดิน) ----------
  function walkwayLength(line) {
    var d = 0;
    for (var i = 0; i < line.length - 1; i++) {
      d += map.distance(L.latLng(line[i][0], line[i][1]), L.latLng(line[i + 1][0], line[i + 1][1]));
    }
    return d;
  }
  function renderWalkways() {
    walkwayLayer.clearLayers();
    walkways.forEach(function (wk, idx) {
      var lls = wk.line.map(function (p) { return L.latLng(p[0], p[1]); });
      L.polyline(lls, { color: '#eab308', weight: 3, dashArray: '6 5' }).addTo(walkwayLayer);
      var mid = lls[Math.floor(lls.length / 2)];
      L.marker(mid, { icon: L.divIcon({ className: 'tag-label wk-tag', html: '<span>' + I18N.t('wk_prefix') + (idx + 1) + '</span>', iconSize: [0, 0] }), interactive: false, keyboard: false }).addTo(walkwayLayer);
    });
  }
  function updateWalkwayCount() {
    var host = $('walkwayList');
    if (host) {
      if (!walkways.length) {
        host.innerHTML = '<span class="hint">' + I18N.t('wk_empty') + '</span>'; selectedWk = -1;
      } else {
        host.innerHTML = walkways.map(function (_, i) {
          return '<span class="wk-item' + (i === selectedWk ? ' sel' : '') + '">' +
            '<button class="wk-chip" data-i="' + i + '">' + I18N.t('wk_prefix') + (i + 1) + '</button>' +
            '<button class="wk-del" data-i="' + i + '" title="' + I18N.t('btn_del_line') + '">✕</button></span>';
        }).join('');
        Array.prototype.forEach.call(host.querySelectorAll('.wk-chip'), function (b) {
          b.addEventListener('click', function () {
            var i = parseInt(b.getAttribute('data-i'), 10);
            selectedWk = (selectedWk === i ? -1 : i); updateWalkwayCount();
          });
        });
        Array.prototype.forEach.call(host.querySelectorAll('.wk-del'), function (b) {
          b.addEventListener('click', function () { deleteWalkway(parseInt(b.getAttribute('data-i'), 10)); });
        });
      }
    }
    renderWalkwayDetail();
    if ($('btnClearWalkway')) $('btnClearWalkway').disabled = !walkways.length;
  }
  function renderWalkwayDetail() {
    var host = $('wkDetail'); if (!host) return;
    if (selectedWk < 0 || selectedWk >= walkways.length) { host.innerHTML = ''; host.hidden = true; return; }
    var wk = walkways[selectedWk];
    host.hidden = false;
    host.innerHTML = I18N.t('wk_detail', selectedWk + 1, fmt(walkwayLength(wk.line), 1)) +
      '<div class="row" style="align-items:flex-end;margin-top:6px">' +
      '<label class="field">' + I18N.t('lbl_width') + '<input id="wkWidthEdit" type="number" value="' + wk.width + '" min="0.3" step="0.1"></label>' +
      '<button id="wkDelSel" class="ghost">' + I18N.t('btn_del_line') + '</button></div>';
    $('wkWidthEdit').addEventListener('change', function () {
      var v = parseFloat($('wkWidthEdit').value); if (v > 0) { walkways[selectedWk].width = v; renderWalkways(); runCompute(); }
    });
    $('wkDelSel').addEventListener('click', function () { deleteWalkway(selectedWk); });
  }
  function deleteWalkway(i) {
    if (i < 0 || i >= walkways.length) return;
    walkways.splice(i, 1);
    if (selectedWk === i) selectedWk = -1; else if (selectedWk > i) selectedWk--;
    renderWalkways(); updateWalkwayCount();
    if (roofs.length) runCompute();
  }
  function clearWalkways() {
    walkways = []; selectedWk = -1; walkwayLayer.clearLayers(); updateWalkwayCount();
    if (roofs.length) runCompute();
  }

  // ---------- obstacle (สิ่งกีดขวาง) วงกลม ----------
  function startPlaceObstacle() {
    if (!roofs.length) { setStatus(I18N.getLang() === 'en' ? 'Place a roof first' : 'วางหลังคาก่อน'); return; }
    placingObstacle = true;
    map.getContainer().classList.add('drawing');
    showBanner(I18N.t('banner_ob'));
  }
  function placeObstacle(latlng) {
    var r = parseFloat($('obstacleRadius').value) || 1.5;
    obstacles.push({ lat: latlng.lat, lng: latlng.lng, r: r });
    placingObstacle = false;
    map.getContainer().classList.remove('drawing');
    hideBanner();
    renderObstacles(); updateObstacleList();
    runCompute();
  }
  function renderObstacles() {
    obstacleLayer.clearLayers();
    obstacles.forEach(function (ob, idx) {
      L.circle([ob.lat, ob.lng], { radius: ob.r, color: '#ef4444', weight: 2, fillColor: '#ef4444', fillOpacity: 0.28 }).addTo(obstacleLayer);
      L.marker([ob.lat, ob.lng], { icon: L.divIcon({ className: 'tag-label ob-tag', html: '<span>' + I18N.t('ob_prefix') + (idx + 1) + '</span>', iconSize: [0, 0] }), interactive: false, keyboard: false }).addTo(obstacleLayer);
    });
  }
  function updateObstacleList() {
    var host = $('obstacleList');
    if (host) {
      if (!obstacles.length) {
        host.innerHTML = '<span class="hint">' + I18N.t('ob_empty') + '</span>'; selectedOb = -1;
      } else {
        host.innerHTML = obstacles.map(function (_, i) {
          return '<span class="wk-item ob' + (i === selectedOb ? ' sel' : '') + '">' +
            '<button class="wk-chip" data-i="' + i + '">' + I18N.t('ob_prefix') + (i + 1) + '</button>' +
            '<button class="wk-del" data-i="' + i + '" title="' + I18N.t('btn_del_one') + '">✕</button></span>';
        }).join('');
        Array.prototype.forEach.call(host.querySelectorAll('.wk-chip'), function (b) {
          b.addEventListener('click', function () {
            var i = parseInt(b.getAttribute('data-i'), 10);
            selectedOb = (selectedOb === i ? -1 : i); updateObstacleList();
          });
        });
        Array.prototype.forEach.call(host.querySelectorAll('.wk-del'), function (b) {
          b.addEventListener('click', function () { deleteObstacle(parseInt(b.getAttribute('data-i'), 10)); });
        });
      }
    }
    renderObstacleDetail();
    if ($('btnClearObstacle')) $('btnClearObstacle').disabled = !obstacles.length;
  }
  function renderObstacleDetail() {
    var host = $('obDetail'); if (!host) return;
    if (selectedOb < 0 || selectedOb >= obstacles.length) { host.innerHTML = ''; host.hidden = true; return; }
    var ob = obstacles[selectedOb];
    host.hidden = false;
    host.innerHTML = I18N.t('ob_detail', selectedOb + 1, fmt(ob.r * 2, 1)) +
      '<div class="row" style="align-items:flex-end;margin-top:6px">' +
      '<label class="field">' + I18N.t('lbl_radius') + '<input id="obRadiusEdit" type="number" value="' + ob.r + '" min="0.3" step="0.1"></label>' +
      '<button id="obDelSel" class="ghost">' + I18N.t('btn_del_one') + '</button></div>';
    $('obRadiusEdit').addEventListener('change', function () {
      var v = parseFloat($('obRadiusEdit').value); if (v > 0) { obstacles[selectedOb].r = v; renderObstacles(); runCompute(); }
    });
    $('obDelSel').addEventListener('click', function () { deleteObstacle(selectedOb); });
  }
  function deleteObstacle(i) {
    if (i < 0 || i >= obstacles.length) return;
    obstacles.splice(i, 1);
    if (selectedOb === i) selectedOb = -1; else if (selectedOb > i) selectedOb--;
    renderObstacles(); updateObstacleList();
    if (roofs.length) runCompute();
  }
  function clearObstacles() {
    obstacles = []; selectedOb = -1; obstacleLayer.clearLayers(); updateObstacleList();
    if (roofs.length) runCompute();
  }
  // ---------- ยืนยัน / ล็อก / แก้ไข ----------
  var LOCK_IDS = ['btnDraw', 'btnFinish', 'btnClear', 'btnRect', 'roofW', 'roofL',
    'module', 'roofType', 'tilt', 'tiltUnknown', 'azimuth', 'setback', 'rowGap', 'colGap', 'orientation', 'walkwayWidth', 'walkwayEvery', 'btnCompute',
    'drawWalkwayWidth', 'btnWalkway', 'btnWalkwayDone', 'btnWalkwayCancel', 'btnClearWalkway',
    'obstacleRadius', 'btnObstacle', 'btnClearObstacle'];
  function lockUI(locked) {
    LOCK_IDS.forEach(function (id) { var el = $(id); if (el) el.disabled = locked; });
    ['roofList', 'roofDetail', 'walkwayList', 'wkDetail', 'obstacleList', 'obDetail'].forEach(function (id) {
      var host = $(id); if (host) Array.prototype.forEach.call(host.querySelectorAll('button,input,select'), function (el) { el.disabled = locked; });
    });
  }
  function confirmPlan() {
    if (!lastAgg) { if ($('confirmMsg')) $('confirmMsg').textContent = I18N.t('confirm_none'); return; }
    confirmed = true;
    updateResults(lastAgg, lastPer, lastMod);     // ผลคำนวณโผล่มาเมื่อยืนยัน
    lockUI(true);
    var b = $('btnConfirm');
    b.classList.remove('btn-pending'); b.classList.add('btn-confirmed');
    b.textContent = I18N.t('btn_confirmed');
    $('btnEdit').hidden = false;
    if ($('confirmMsg')) {
      $('confirmMsg').innerHTML = I18N.t('confirm_locked2', roofs.length, fmt(lastAgg.count), fmt(lastAgg.kwp, 1), walkways.length, obstacles.length);
    }
  }
  function editPlan() {
    confirmed = false;
    clearResults();                               // ผลหาย (แต่แผงบนแผนที่ยังอยู่)
    lockUI(false);
    var b = $('btnConfirm');
    b.classList.remove('btn-confirmed'); b.classList.add('btn-pending');
    b.textContent = I18N.t('btn_confirm');
    $('btnEdit').hidden = true;
    if ($('confirmMsg')) $('confirmMsg').textContent = '';
    // คืนสถานะพิเศษหลังปลดล็อก
    $('tilt').disabled = $('tiltUnknown').checked;
    endDrawUI(); updateWalkwayCount(); updateObstacleList();
  }
  // สร้างหลังคาสี่เหลี่ยมจากขนาดที่ปัก (เส้นทาง as-built — ไม่ต้อง digitize ภาพ)
  function makeRect() {
    var w = parseFloat($('roofW').value), len = parseFloat($('roofL').value);
    if (!(w > 0) || !(len > 0)) { setStatus(I18N.getLang() === 'en' ? 'Enter width/length in meters' : 'กรอกความกว้าง/ยาวเป็นเมตร'); return; }
    var az = currentAz();
    var c = map.getCenter(), lat0 = c.lat, lng0 = c.lng;
    var hw = w / 2, hl = len / 2;
    var corners = [[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]];
    var r = az * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r);
    var ring = corners.map(function (p) {
      var x = p[0] * cs - p[1] * sn, y = p[0] * sn + p[1] * cs;
      return RoofEngine._internal.toLatLng(x, y, lat0, lng0);
    });
    roofs.push({ ring: ring, az: az }); selectedRoof = roofs.length - 1;
    drawing = false; map.doubleClickZoom.enable();
    drawLayer.clearLayers();
    renderRoofs(); updateRoofList();
    endDrawUI();
    setStatus(I18N.getLang() === 'en'
      ? ('Added roof ' + w + '×' + len + ' m — pan the map and press Place size for another')
      : ('เพิ่มหลังคา ' + w + '×' + len + ' ม. — เลื่อนแผนที่แล้วกดปักขนาดเพิ่มหลังต่อไปได้'));
    runCompute();
  }

  function clearAll() {
    drawing = false; placingObstacle = false; points = []; roofs = []; selectedRoof = -1; walkways = []; obstacles = [];
    map.doubleClickZoom.enable();
    drawLayer.clearLayers(); roofLayer.clearLayers(); panelLayer.clearLayers(); walkwayLayer.clearLayers(); obstacleLayer.clearLayers();
    clearResults(); updateWalkwayCount(); updateObstacleList(); updateRoofList();
    endDrawUI();
    setStatus(I18N.t('status_cleared'));
  }

  // ---------- compute ----------
  function currentRules() {
    var seg = MODULES[$('module').value].segment;
    return {
      setback: parseFloat($('setback').value) || 0,
      rowGap: parseFloat($('rowGap').value) || 0,
      colGap: parseFloat($('colGap').value) || 0,
      orientation: $('orientation').value,
      walkwayWidth: parseFloat($('walkwayWidth').value) || 0,
      walkwayEvery: parseInt($('walkwayEvery').value, 10) || 0,
      _seg: seg
    };
  }
  function currentInputs() {
    var rules = currentRules();
    var tilt = $('tiltUnknown').checked ? null : (parseFloat($('tilt').value));
    if (tilt != null && isNaN(tilt)) tilt = null;
    return { rules: rules, tilt: tilt, walkways: walkways, obstacles: obstacles };
  }
  // คำนวณทุกหลังคาด้วยรุ่นแผงที่กำหนด — คืน { agg, per, panels }
  function computeAll(mod) {
    var ci = currentInputs();
    var modObj = { watt: mod.watt, width: mod.width, height: mod.height, weightKg: mod.weightKg };
    var panelArea = mod.width * mod.height;
    var agg = { projected: 0, trueA: 0, count: 0, kwp: 0, weight: 0, warnings: [] };
    var per = [], allPanels = [];
    roofs.forEach(function (rf, idx) {
      var res = RoofEngine.computeLayout({
        ring: rf.ring, tiltDeg: ci.tilt, azimuthDeg: rf.az,
        module: modObj, rules: ci.rules, walkways: ci.walkways, obstacles: ci.obstacles
      });
      if (!res.ok) return;
      allPanels = allPanels.concat(res.panels);
      per.push({ idx: idx, az: rf.az, res: res });
      agg.projected += res.projectedAreaSqm; agg.trueA += res.trueAreaSqm;
      agg.count += res.panelCount; agg.kwp += res.dcCapacityKwp; agg.weight += res.totalWeightKg;
      (res.warnings || []).forEach(function (w) { agg.warnings.push(I18N.t('roof_prefix') + (idx + 1) + ': ' + w); });
    });
    agg.load = agg.trueA > 0 ? agg.weight / agg.trueA : 0;
    agg.coverage = agg.trueA > 0 ? (agg.count * panelArea) / agg.trueA : 0;
    agg.tilt = ci.tilt;
    return { agg: agg, per: per, panels: allPanels };
  }
  function runCompute() {
    if (!roofs.length) { panelLayer.clearLayers(); clearResults(); return; }
    var mod = MODULES[$('module').value];
    var out = computeAll(mod);
    lastAgg = out.agg; lastPer = out.per; lastMod = mod;
    lastContext = {
      segment: mod.segment, segmentLabel: SEG_LABEL[mod.segment],
      moduleLabel: mod.label, moduleWatt: mod.watt,
      roofType: (ROOF_TYPES[$('roofType').value] || {}).label,
      roofCount: roofs.length, basemap: 'Esri World Imagery'
    };
    drawPanels(out.panels);
    if (confirmed) updateResults(out.agg, out.per, mod); else clearResults();
  }
  function drawPanels(panels) {
    panelLayer.clearLayers();
    for (var i = 0; i < panels.length; i++) {
      L.polygon(panels[i], { color: '#1d4ed8', weight: 0.6, fillColor: '#3b82f6', fillOpacity: 0.7 }).addTo(panelLayer);
    }
  }

  // ---------- results UI ----------
  function fmt(x, d) { return (x == null ? 0 : x).toLocaleString('th-TH', { maximumFractionDigits: d == null ? 0 : d }); }
  function clearResults() {
    $('results').hidden = true;
    $('cmpCard').hidden = true;
  }
  function updateResults(agg, per, mod) {
    $('results').hidden = false;
    var tiltUsed = (agg.tilt == null ? 0 : agg.tilt);
    $('resProjected').textContent = fmt(agg.projected);
    $('resTrue').textContent = fmt(agg.trueA);
    $('resTilt').textContent = fmt(tiltUsed, 1) + '°';
    $('resCount').textContent = fmt(agg.count);
    $('resKwp').textContent = fmt(agg.kwp, 1);
    $('resCoverage').textContent = fmt(agg.coverage * 100, 0) + '%';
    $('resWeight').textContent = fmt(agg.weight / 1000, 1);
    $('resLoad').textContent = fmt(agg.load, 1);

    // breakdown รายหลัง
    var bd = $('resBreakdown');
    if (bd) {
      if (per && per.length > 1) {
        bd.hidden = false;
        bd.innerHTML = '<div class="bd-title">' + I18N.t('breakdown_title') + '</div>' +
          per.map(function (p) {
            return '<div class="bd-row"><span class="bd-tag">' + I18N.t('roof_prefix') + (p.idx + 1) + '</span>' +
              '<span>' + fmt(p.res.panelCount) + ' ' + I18N.t('u_panels') + '</span>' +
              '<span><b>' + fmt(p.res.dcCapacityKwp, 1) + '</b> kWp</span>' +
              '<span>' + I18N.t('lbl_facing') + ' ' + p.az + '°</span></div>';
          }).join('');
      } else { bd.hidden = true; bd.innerHTML = ''; }
    }

    // badges
    var T = I18N.t;
    var b = $('badges'); b.innerHTML = '';
    addBadge(b, T('badge_engine'), true);
    addBadge(b, roofs.length + ' ' + T('badge_roofs'), false);
    addBadge(b, T('badge_img'), false);
    addBadge(b, mod.segment === 'ci' ? T('badge_ci') : T('badge_res'), false);

    // warnings
    var w = $('warnings');
    if (agg.warnings && agg.warnings.length) {
      w.hidden = false;
      w.innerHTML = '<b>' + T('warn_title') + '</b><ul>' + agg.warnings.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    } else { w.hidden = true; w.innerHTML = ''; }

    $('cmpCard').hidden = false;
    renderCompare();
  }
  function addBadge(parent, text, good) {
    var s = document.createElement('span');
    s.className = 'badge' + (good ? ' good' : '');
    s.textContent = text; parent.appendChild(s);
  }
  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]; }); }
  function setStatus(t) { $('status').textContent = t || ''; }

  // ---------- ระยะ/ป้ายวัดเมตร ----------
  function polyAreaSqm(lls) {
    if (lls.length < 3) return 0;
    var lat0 = 0, lng0 = 0, R = 6378137, i;
    for (i = 0; i < lls.length; i++) { lat0 += lls[i].lat; lng0 += lls[i].lng; }
    lat0 /= lls.length; lng0 /= lls.length;
    var m = lls.map(function (p) {
      return [(p.lng - lng0) * Math.PI / 180 * R * Math.cos(lat0 * Math.PI / 180), (p.lat - lat0) * Math.PI / 180 * R];
    });
    var a = 0; for (i = 0; i < m.length; i++) { var j = (i + 1) % m.length; a += m[i][0] * m[j][1] - m[j][0] * m[i][1]; }
    return Math.abs(a) / 2;
  }
  function edgeLabel(a, b, layer) {
    var d = map.distance(a, b);
    var mid = L.latLng((a.lat + b.lat) / 2, (a.lng + b.lng) / 2);
    L.marker(mid, {
      icon: L.divIcon({ className: 'len-label', html: '<span>' + d.toFixed(1) + (I18N.getLang() === 'en' ? ' m' : ' ม.') + '</span>', iconSize: [0, 0] }),
      interactive: false, keyboard: false
    }).addTo(layer);
  }
  function ringAreaSqm(ring) {
    return polyAreaSqm(ring.map(function (p) { return { lat: p[0], lng: p[1] }; }));
  }
  function renderRoofs() {
    roofLayer.clearLayers();
    roofs.forEach(function (rf, idx) {
      var sel = (idx === selectedRoof);
      var lls = rf.ring.map(function (p) { return L.latLng(p[0], p[1]); });
      L.polygon(lls, { color: sel ? '#f59e0b' : '#fb923c', weight: sel ? 3 : 2, fillColor: '#f59e0b', fillOpacity: sel ? 0.10 : 0.05 }).addTo(roofLayer);
      var cLat = 0, cLng = 0; rf.ring.forEach(function (p) { cLat += p[0]; cLng += p[1]; }); cLat /= rf.ring.length; cLng /= rf.ring.length;
      L.marker([cLat, cLng], { icon: L.divIcon({ className: 'tag-label roof-tag' + (sel ? ' sel' : ''), html: '<span>' + I18N.t('roof_prefix') + (idx + 1) + '</span>', iconSize: [0, 0] }), interactive: false, keyboard: false }).addTo(roofLayer);
      if (sel) for (var i = 0; i < lls.length; i++) edgeLabel(lls[i], lls[(i + 1) % lls.length], roofLayer);
    });
  }
  function selectRoof(i) {
    if (i < 0 || i >= roofs.length) return;
    selectedRoof = i;
    $('azimuth').value = roofs[i].az; updateAzLabel();
    renderRoofs(); updateRoofList();
  }
  function deleteRoof(i) {
    if (i < 0 || i >= roofs.length) return;
    roofs.splice(i, 1);
    if (selectedRoof === i) selectedRoof = roofs.length ? Math.min(i, roofs.length - 1) : -1;
    else if (selectedRoof > i) selectedRoof--;
    if (selectedRoof >= 0) { $('azimuth').value = roofs[selectedRoof].az; updateAzLabel(); }
    renderRoofs(); updateRoofList(); runCompute();
  }
  function updateRoofList() {
    var host = $('roofList');
    if (host) {
      if (!roofs.length) {
        host.innerHTML = '<span class="hint">' + I18N.t('roof_empty') + '</span>'; selectedRoof = -1;
      } else {
        host.innerHTML = roofs.map(function (_, i) {
          return '<span class="wk-item' + (i === selectedRoof ? ' sel' : '') + '">' +
            '<button class="wk-chip roof-chip" data-i="' + i + '">' + I18N.t('roof_prefix') + (i + 1) + '</button>' +
            '<button class="wk-del" data-i="' + i + '" title="' + I18N.t('del_roof') + '">✕</button></span>';
        }).join('');
        Array.prototype.forEach.call(host.querySelectorAll('.roof-chip'), function (b) {
          b.addEventListener('click', function () { selectRoof(parseInt(b.getAttribute('data-i'), 10)); });
        });
        Array.prototype.forEach.call(host.querySelectorAll('.wk-del'), function (b) {
          b.addEventListener('click', function () { deleteRoof(parseInt(b.getAttribute('data-i'), 10)); });
        });
      }
    }
    renderRoofDetail();
    if ($('btnClearWalkway')) { /* no-op */ }
  }
  function renderRoofDetail() {
    var host = $('roofDetail'); if (!host) return;
    if (selectedRoof < 0 || selectedRoof >= roofs.length) { host.innerHTML = ''; host.hidden = true; return; }
    var rf = roofs[selectedRoof];
    host.hidden = false;
    host.innerHTML = I18N.t('roof_detail', selectedRoof + 1, fmt(ringAreaSqm(rf.ring)), rf.az) +
      ' <button id="roofDelSel" class="ghost" style="margin-left:6px">' + I18N.t('del_roof') + '</button>';
    $('roofDelSel').addEventListener('click', function () { deleteRoof(selectedRoof); });
  }

  // ---------- เข็มทิศ + ทิศที่แผงหัน ----------
  var compassNeedle = null, compassRose = null, compassCap = null;
  function azName(deg) {
    deg = ((deg % 360) + 360) % 360;
    return I18N.t('dirs')[Math.round(deg / 45) % 8];
  }
  function mapBearing() { return (map.getBearing ? map.getBearing() : 0) || 0; }
  function updateCompass() {
    if (!compassNeedle) return;
    var az = parseFloat($('azimuth').value) || 0;
    var b = mapBearing();
    compassNeedle.setAttribute('transform', 'rotate(' + (az - b) + ' 30 30)');
    if (compassRose) compassRose.setAttribute('transform', 'rotate(' + (-b) + ' 30 30)');
  }
  function updateAzLabel() {
    var d = parseFloat($('azimuth').value) || 0;
    var rec = (d >= 157.5 && d <= 202.5) ? I18N.t('az_rec') : '';
    $('azVal').textContent = d + '° · ' + azName(d) + rec;
    updateCompass();
  }
  function addCompass() {
    var ctrl = L.control({ position: 'topright' });
    ctrl.onAdd = function () {
      var d = L.DomUtil.create('div', 'compass');
      d.innerHTML =
        '<svg width="60" height="60" viewBox="0 0 60 60">' +
        '<circle cx="30" cy="30" r="27" fill="rgba(15,23,42,.82)" stroke="#475569" stroke-width="1"/>' +
        '<g id="cmp-rose" fill="#e2e8f0" font-size="10" font-weight="700" text-anchor="middle">' +
        '<text x="30" y="13.5">N</text><text x="49" y="34">E</text><text x="30" y="54">S</text><text x="11" y="34">W</text>' +
        '</g>' +
        '<g id="cmp-needle"><polygon points="30,9 25.5,30 30,26 34.5,30" fill="#ef4444"/>' +
        '<polygon points="30,51 25.5,30 30,34 34.5,30" fill="#94a3b8"/></g>' +
        '<circle cx="30" cy="30" r="2.5" fill="#fff"/></svg>' +
        '<div class="compass-cap" id="cmp-cap">' + I18N.t('compass_cap') + '</div>';
      L.DomEvent.disableClickPropagation(d);
      d.onclick = function () { if (map.setBearing) { map.setBearing(0); } updateCompass(); };
      return d;
    };
    ctrl.addTo(map);
    compassNeedle = document.getElementById('cmp-needle');
    compassRose = document.getElementById('cmp-rose');
    compassCap = document.getElementById('cmp-cap');
    updateCompass();
  }

  // ---------- เปรียบเทียบหลาย PV บนหลังคาเดียวกัน ----------
  function buildCompareChecks() {
    var host = $('cmpChecks'); if (!host) return;
    host.innerHTML = MODULE_ORDER.map(function (k) {
      return '<label class="checkbox"><input type="checkbox" class="cmp-check" value="' + k + '" checked> ' + esc(MODULES[k].short) + '</label>';
    }).join('');
    Array.prototype.forEach.call(host.querySelectorAll('.cmp-check'), function (c) {
      c.addEventListener('change', renderCompare);
    });
  }
  function renderCompare() {
    var body = $('cmpBody'); if (!body || !roofs.length) return;
    var keys = [];
    Array.prototype.forEach.call(document.querySelectorAll('.cmp-check'), function (c) { if (c.checked) keys.push(c.value); });
    if (!keys.length) { body.innerHTML = '<tr><td colspan="5" class="hint">' + (I18N.getLang() === 'en' ? 'Select at least 1 model' : 'เลือกรุ่นอย่างน้อย 1') + '</td></tr>'; return; }
    var rows = keys.map(function (k) {
      var m = MODULES[k];
      return { m: m, agg: computeAll(m).agg };   // รวมทุกหลังคา
    });
    var maxKwp = Math.max.apply(null, rows.map(function (r) { return r.agg.kwp; }));
    body.innerHTML = rows.map(function (r) {
      var win = r.agg.kwp === maxKwp;
      return '<tr' + (win ? ' class="win"' : '') + '>' +
        '<td>' + esc(r.m.short) + (win ? ' ★' : '') + '</td>' +
        '<td>' + fmt(r.agg.count) + '</td>' +
        '<td><b>' + fmt(r.agg.kwp, 1) + '</b></td>' +
        '<td>' + fmt(r.agg.weight / 1000, 1) + '</td>' +
        '<td>' + fmt(r.agg.load, 1) + '</td>' +
        '</tr>';
    }).join('');
  }

  // ---------- geocode search ----------
  // ดึงพิกัดจากข้อความ: "lat,lng" หรือวางลิงก์ Google Maps ทั้งอัน
  function extractLatLng(s) {
    var m;
    m = s.match(/^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/); // 13.55, 100.78
    if (m) return [parseFloat(m[1]), parseFloat(m[2])];
    m = s.match(/@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/);                        // .../@13.55,100.78,...
    if (m) return [parseFloat(m[1]), parseFloat(m[2])];
    m = s.match(/!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/);                    // !3d13.55!4d100.78
    if (m) return [parseFloat(m[1]), parseFloat(m[2])];
    m = s.match(/[?&]q=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/);               // ?q=13.55,100.78
    if (m) return [parseFloat(m[1]), parseFloat(m[2])];
    return null;
  }
  function search() {
    var q = $('search').value.trim();
    if (!q) return;
    var en = I18N.getLang() === 'en';
    var ll = extractLatLng(q);
    if (ll) {
      map.setView(ll, 18);
      setStatus((en ? 'Went to ' : 'ไปที่พิกัด ') + ll[0].toFixed(6) + ', ' + ll[1].toFixed(6));
      return;
    }
    setStatus(en ? 'Searching…' : 'กำลังค้นหา…');
    fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=th&q=' + encodeURIComponent(q))
      .then(function (r) { return r.json(); })
      .then(function (list) {
        if (list && list.length) {
          map.setView([parseFloat(list[0].lat), parseFloat(list[0].lon)], 18);
          setStatus('');
        } else { setStatus(en ? 'Not found in OpenStreetMap — try a Google Maps link or coordinates (e.g. 13.556, 100.790)' : 'ไม่พบชื่อนี้ใน OpenStreetMap — ลองวางลิงก์ Google Maps หรือพิกัด (เช่น 13.556, 100.790)'); }
      }).catch(function () { setStatus(en ? 'Search failed (check connection)' : 'ค้นหาไม่สำเร็จ (ตรวจการเชื่อมต่อ)'); });
  }

  // ---------- segment / module sync ----------
  function applySegmentDefaults() {
    var seg = MODULES[$('module').value].segment;
    var rl = RULES[seg];
    $('setback').value = rl.setback; $('rowGap').value = rl.rowGap;
    $('colGap').value = rl.colGap; $('orientation').value = rl.orientation;
    $('walkwayWidth').value = rl.walkwayWidth; $('walkwayEvery').value = rl.walkwayEvery;
  }

  // ---------- language ----------
  function updateLangSeg() {
    var seg = $('langSeg'); if (!seg) return;
    Array.prototype.forEach.call(seg.querySelectorAll('button'), function (b) {
      b.classList.toggle('active', b.getAttribute('data-lang') === I18N.getLang());
    });
  }
  function refreshLang() {
    I18N.applyStatic();
    updateLangSeg();
    // ปุ่มยืนยัน (ข้อความจัดการเอง ไม่ใช้ data-i18n)
    var b = $('btnConfirm');
    b.textContent = confirmed ? I18N.t('btn_confirmed') : I18N.t('btn_confirm');
    if (compassCap) compassCap.textContent = I18N.t('compass_cap');
    updateAzLabel();
    updateWalkwayCount();
    updateObstacleList();
    renderRoofs(); updateRoofList();   // ป้าย/ชิปเปลี่ยนภาษา
    renderWalkways(); renderObstacles();
    if (confirmed && lastAgg) updateResults(lastAgg, lastPer, lastMod);
    else if (!confirmed) { $('confirmMsg').textContent = ''; }
  }

  // ---------- wire up ----------
  function init() {
    banner = L.DomUtil.create('div', 'draw-banner');
    banner.hidden = true;
    map.getContainer().appendChild(banner);
    addCompass();
    map.on('rotate rotateend', updateCompass);

    map.on('click', onMapClick);
    map.on('dblclick', function (e) { if (drawing) { L.DomEvent.stop(e); finishDraw(); } });

    $('btnDraw').addEventListener('click', startDraw);
    $('btnFinish').addEventListener('click', finishDraw);
    $('btnClear').addEventListener('click', clearAll);
    $('btnWalkway').addEventListener('click', startWalkwayDraw);
    $('btnWalkwayDone').addEventListener('click', finishDraw);
    $('btnWalkwayCancel').addEventListener('click', cancelWalkwayDraw);
    $('btnClearWalkway').addEventListener('click', clearWalkways);
    $('btnObstacle').addEventListener('click', startPlaceObstacle);
    $('btnClearObstacle').addEventListener('click', clearObstacles);
    $('btnConfirm').addEventListener('click', confirmPlan);
    $('btnEdit').addEventListener('click', editPlan);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && placingObstacle) {
        placingObstacle = false; map.getContainer().classList.remove('drawing'); hideBanner();
      }
    });
    $('btnRect').addEventListener('click', makeRect);
    $('roofW').addEventListener('keydown', function (e) { if (e.key === 'Enter') makeRect(); });
    $('roofL').addEventListener('keydown', function (e) { if (e.key === 'Enter') makeRect(); });
    $('btnCompute').addEventListener('click', runCompute);
    $('searchBtn').addEventListener('click', search);
    $('search').addEventListener('keydown', function (e) { if (e.key === 'Enter') search(); });
    Array.prototype.forEach.call($('langSeg').querySelectorAll('button'), function (b) {
      b.addEventListener('click', function () {
        if (b.getAttribute('data-lang') === I18N.getLang()) return;
        I18N.setLang(b.getAttribute('data-lang'));
        refreshLang();
      });
    });

    $('module').addEventListener('change', function () { applySegmentDefaults(); if (roofs.length) runCompute(); });
    $('roofType').addEventListener('change', function () {
      var t = ROOF_TYPES[$('roofType').value];
      if (t) {
        $('tiltUnknown').checked = false; $('tilt').disabled = false; $('tilt').value = t.tilt;
      }
      if (roofs.length) runCompute();
    });
    ['tilt', 'setback', 'rowGap', 'colGap', 'orientation', 'walkwayWidth', 'walkwayEvery'].forEach(function (id) {
      $(id).addEventListener('change', function () { if (roofs.length) runCompute(); });
    });
    $('azimuth').addEventListener('input', updateAzLabel);
    $('azimuth').addEventListener('change', function () {
      if (selectedRoof >= 0 && selectedRoof < roofs.length) { roofs[selectedRoof].az = currentAz(); renderRoofDetail(); }
      if (roofs.length) runCompute();
    });
    $('tiltUnknown').addEventListener('change', function () {
      $('tilt').disabled = $('tiltUnknown').checked;
      if (roofs.length) runCompute();
    });
    $('btnFinish').disabled = true;
    buildCompareChecks();
    updateAzLabel();
    updateWalkwayCount();
    updateObstacleList();

    // ---------- เริ่มต้นแบบว่าง — ค้นหาไซต์แล้วเพิ่มหลังคาเอง ----------
    roofs = []; selectedRoof = -1;
    renderRoofs(); updateRoofList();
    applySegmentDefaults();
    I18N.applyStatic();
    updateLangSeg();
    $('btnConfirm').textContent = I18N.t('btn_confirm');
    setStatus(I18N.getLang() === 'en' ? 'Search your site, then add a roof (＋)' : 'ค้นหาไซต์ แล้วเพิ่มหลังคา (＋)');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
