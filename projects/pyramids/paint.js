// Pyramids' Coins (released as Pyramids' Coins, packed as Coin Chase): the export pack has the logo, cobras, palms and torch rigs but no
// backdrop or reel frame. Backdrops are generated paintings (bg.js); the reel frame is drawn here.
window.HS_PAINT = window.HS_PAINT || {};
HS_PAINT.pyramids = function (layer, mode, g, cfg) {
  var K = window.HSPaintKit, bonus = mode === 'bonus', W = 1920, H = 940;
  var rnd = (function (s) { return function () { s = (s * 16807) % 2147483647; return s / 2147483647; }; })(7);

  // backdrops are painted art now (bg.js: desert at dusk / treasure tomb); this code-drawn version is a fallback
  if (layer === 'back' && !(window.HS_IMG && window.HS_IMG['pyramids/base'])) {
    if (!bonus) {
      // desert at dusk
      g.fillStyle = K.lin(g, 0, 0, 0, 640, [[0, '#0a1036'], [0.45, '#3b2a6e'], [0.78, '#c25a3a'], [1, '#f6a54a']]);
      g.fillRect(0, 0, W, H);
      for (var i = 0; i < 140; i++) { g.fillStyle = 'rgba(255,255,255,' + (0.25 + rnd() * 0.6) + ')'; var r = rnd() * 1.6 + 0.4; K.circle(g, rnd() * W, rnd() * 330, r); g.fill(); }
      var sun = g.createRadialGradient(960, 600, 10, 960, 600, 520);
      sun.addColorStop(0, 'rgba(255,230,150,.95)'); sun.addColorStop(0.25, 'rgba(255,170,80,.5)'); sun.addColorStop(1, 'rgba(255,120,60,0)');
      g.fillStyle = sun; g.fillRect(0, 0, W, H);
      // pyramids: dark face + lit face
      [[300, 650, 330, 0.9], [1620, 660, 360, 1], [960, 640, 240, 0.7], [610, 660, 160, 0.8], [1330, 655, 190, 0.85]].forEach(function (p) {
        var x = p[0], base = p[1], hh = p[2], hw = hh * 1.05;
        g.globalAlpha = p[3];
        g.beginPath(); g.moveTo(x, base - hh); g.lineTo(x - hw, base); g.lineTo(x, base); g.closePath();
        g.fillStyle = K.lin(g, x - hw, base, x, base - hh, ['#7a3f2a', '#b8683a']); g.fill();
        g.beginPath(); g.moveTo(x, base - hh); g.lineTo(x + hw, base); g.lineTo(x, base); g.closePath();
        g.fillStyle = K.lin(g, x, base - hh, x + hw, base, ['#3a1d22', '#22101a']); g.fill();
        g.globalAlpha = 1;
      });
      // dunes
      g.fillStyle = K.lin(g, 0, 620, 0, H, ['#d08a3e', '#8a4f1e', '#4a2610']);
      g.beginPath(); g.moveTo(0, 680);
      g.bezierCurveTo(320, 600, 620, 720, 960, 660); g.bezierCurveTo(1300, 600, 1600, 700, W, 640);
      g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fill();
      g.fillStyle = 'rgba(40,18,6,.35)';
      g.beginPath(); g.moveTo(0, 800); g.bezierCurveTo(400, 740, 800, 840, 1200, 780); g.bezierCurveTo(1500, 740, 1750, 800, W, 770); g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fill();
    } else {
      // torch-lit tomb: sandstone blocks and a gold frieze
      g.fillStyle = K.lin(g, 0, 0, 0, H, ['#2a1709', '#4a2c12', '#1a0d05']);
      g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 3;
      for (var row = 0, y = 0; y < H; row++, y += 74) {
        g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
        for (var x = (row % 2) * 90; x < W; x += 180) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 74); g.stroke(); }
      }
      g.strokeStyle = 'rgba(255,210,140,.08)'; g.lineWidth = 1.5;
      for (row = 0, y = 2; y < H; row++, y += 74) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
      // carved glyph rows
      g.fillStyle = 'rgba(0,0,0,.28)';
      for (var gy = 230; gy < 760; gy += 148) for (var gx = 60; gx < W; gx += 110) {
        var k = Math.floor(rnd() * 4);
        if (k === 0) { K.circle(g, gx, gy, 14); g.fill(); g.fillRect(gx - 3, gy + 12, 6, 30); g.fillRect(gx - 14, gy + 18, 28, 6); }
        else if (k === 1) { g.beginPath(); g.ellipse(gx, gy + 14, 22, 10, 0, 0, Math.PI * 2); g.fill(); }
        else if (k === 2) { g.fillRect(gx - 12, gy, 24, 40); }
        else { g.beginPath(); g.moveTo(gx - 16, gy + 40); g.lineTo(gx, gy); g.lineTo(gx + 16, gy + 40); g.closePath(); g.fill(); }
      }
      g.fillStyle = K.lin(g, 0, 96, 0, 128, ['#ffe7a0', '#c88a24', '#7a4c10']); g.fillRect(0, 96, W, 30);
      var glow = g.createRadialGradient(960, 420, 80, 960, 420, 980);
      glow.addColorStop(0, 'rgba(255,170,70,.28)'); glow.addColorStop(1, 'rgba(0,0,0,.55)');
      g.fillStyle = glow; g.fillRect(0, 0, W, H);
    }
    return true;
  }

  // the cobra rigs are only a head and neck: in the base game their bodies coil around the white
  // columns of the backdrop (as in the released game), so the snakes rest on something
  if (layer === 'mid') {
    // contact shadows of the coin pots (layout layer, frameShift puts their feet at y ~836)
    g.save(); g.filter = 'blur(9px)'; g.fillStyle = bonus ? 'rgba(0,0,0,.6)' : 'rgba(50,22,4,.55)';
    [250, 1670].forEach(function (x) { g.beginPath(); g.ellipse(x, 838, 150, 20, 0, 0, Math.PI * 2); g.fill(); });
    g.restore();
    if (!bonus) { coil(g, 369, 1); coil(g, 1551, -1); }
    return true;
  }

  if (layer !== 'under') return false;
  // reel frame after the released game: a dark wooden panel, twisted gold dividers, a gold rim and a
  // sandstone frieze of glyphs along the top
  var x0 = 496, y0 = 136, w = 928, h = 576;
  g.save(); g.shadowColor = 'rgba(0,0,0,.7)'; g.shadowBlur = 38; g.shadowOffsetY = 14;
  g.fillStyle = K.lin(g, x0, 0, x0 + w, 0, ['#e2a634', '#ffe9a0', '#c88a24', '#ffe9a0', '#e2a634']); g.fillRect(x0, y0, w, h); g.restore();
  g.fillStyle = K.lin(g, 0, y0, 0, y0 + h, bonus ? ['#3a1608', '#24100a'] : ['#33200f', '#1e1208']); g.fillRect(x0 + 10, y0 + 10, w - 20, h - 20);
  var vg = g.createRadialGradient(960, 424, 80, 960, 424, 600); vg.addColorStop(0, 'rgba(255,190,110,.10)'); vg.addColorStop(1, 'rgba(0,0,0,.35)');
  g.fillStyle = vg; g.fillRect(x0 + 10, y0 + 10, w - 20, h - 20);
  // twisted gold dividers between the reels
  for (var c = 1; c < 5; c++) {
    var lx = 520 + c * 176;
    g.fillStyle = K.lin(g, lx - 7, 0, lx + 7, 0, ['#7a4c10', '#ffe08a', '#c88a24']); g.fillRect(lx - 6, y0 + 10, 12, h - 20);
    g.strokeStyle = 'rgba(70,40,6,.8)'; g.lineWidth = 2;
    for (var ty = y0 + 14; ty < y0 + h - 14; ty += 14) { g.beginPath(); g.moveTo(lx - 6, ty); g.lineTo(lx + 6, ty + 7); g.stroke(); }
    g.fillStyle = '#2a5ab8'; for (ty = y0 + 40; ty < y0 + h - 30; ty += 56) { g.fillRect(lx - 3, ty, 6, 10); }
  }
  // frieze across the top: sandstone band with carved glyphs and gold edges
  var fy = y0 - 46, fh = 50;
  g.save(); g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 14; g.shadowOffsetY = 5;
  // two runs either side of the logo rig, so the logo stays whole
  var runs = [[x0 - 24, 800], [1120, x0 + w + 24]];
  runs.forEach(function (r) { g.fillStyle = K.lin(g, 0, fy, 0, fy + fh, ['#f3dcae', '#dcb980', '#b8925a']); g.fillRect(r[0], fy, r[1] - r[0], fh); });
  g.restore();
  runs.forEach(function (r) { g.fillStyle = K.lin(g, 0, fy, 0, fy + 6, ['#ffe9a0', '#a8701c']); g.fillRect(r[0], fy, r[1] - r[0], 6); g.fillRect(r[0], fy + fh - 6, r[1] - r[0], 6); });
  g.fillStyle = 'rgba(70,42,16,.75)'; g.strokeStyle = 'rgba(70,42,16,.75)'; g.lineWidth = 3;
  for (var gx = x0 + 6, n = 0; gx < x0 + w + 10; gx += 46, n++) {
    if (gx > 780 && gx < 1140) continue;                     // the logo sits in the middle
    var cy = fy + fh / 2, k = n % 6;
    g.beginPath();
    if (k === 0) { g.arc(gx, cy - 6, 6, 0, Math.PI * 2); g.moveTo(gx, cy); g.lineTo(gx, cy + 13); g.moveTo(gx - 8, cy + 3); g.lineTo(gx + 8, cy + 3); g.stroke(); }
    else if (k === 1) { g.ellipse(gx, cy, 12, 6, 0, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(gx, cy, 3, 0, Math.PI * 2); g.fill(); }
    else if (k === 2) { g.moveTo(gx - 12, cy + 11); g.lineTo(gx, cy - 11); g.lineTo(gx + 12, cy + 11); g.closePath(); g.fill(); }
    else if (k === 3) { g.ellipse(gx, cy + 2, 10, 8, 0, 0, Math.PI * 2); g.fill(); g.fillRect(gx - 12, cy - 10, 24, 4); }
    else if (k === 4) { g.moveTo(gx - 10, cy + 10); g.quadraticCurveTo(gx - 12, cy - 12, gx + 8, cy - 8); g.lineTo(gx + 12, cy - 2); g.stroke(); }
    else { g.fillRect(gx - 3, cy - 11, 6, 22); g.fillRect(gx - 10, cy - 11, 20, 5); }
  }
  // gold rim along the bottom
  // the board stands on a stone plinth that reaches the floor: a band of lapis-and-gold tiles, a
  // sandstone base and its shadow on the floor (the released game's frame sits on the ground too)
  var py = y0 + h + 12, px0 = x0 - 30, pw = w + 60;
  g.save(); g.filter = 'blur(10px)'; g.fillStyle = 'rgba(40,18,4,.55)';
  g.beginPath(); g.ellipse(960, py + 74, pw / 2 + 10, 16, 0, 0, Math.PI * 2); g.fill(); g.restore();
  g.fillStyle = K.lin(g, 0, py, 0, py + 70, ['#e9c88e', '#c99a5c', '#8a5c2c']); g.fillRect(px0, py, pw, 70);
  g.fillStyle = 'rgba(255,240,200,.35)'; g.fillRect(px0, py + 26, pw, 2);
  g.fillStyle = 'rgba(60,30,8,.35)'; for (var bx = px0 + 120; bx < px0 + pw; bx += 160) g.fillRect(bx, py + 28, 2, 42);
  // tile band
  g.fillStyle = K.lin(g, 0, py, 0, py + 24, ['#ffe08a', '#c88a24']); g.fillRect(px0, py, pw, 24);
  for (var tx = px0 + 6, ti = 0; tx < px0 + pw - 10; tx += 22, ti++) {
    g.fillStyle = ti % 2 ? '#1f4fa8' : '#e8b23a'; g.fillRect(tx, py + 5, 16, 14);
  }
  g.fillStyle = K.lin(g, 0, py + 66, 0, py + 72, ['#a8701c', '#5a3610']); g.fillRect(px0, py + 66, pw, 6);
  if (bonus) { g.fillStyle = 'rgba(30,12,2,.38)'; g.fillRect(px0, py + 24, pw, 48); }   // torch-lit tomb: the stone sits in shadow
  g.fillStyle = K.lin(g, 0, y0 + h, 0, y0 + h + 18, ['#ffe9a0', '#c88a24', '#7a4c10']); g.fillRect(x0 - 24, y0 + h - 4, w + 48, 18);

  K.controls(g, { y: 864, menu: [69, 116, 163], minus: 552, pill: [600, 152], plus: 795, spin: [960, 58], turbo: 1206, auto: 1286, balance: 1890, accent: '#ffd86a' });
  return true;

  // golden cobra body wound around a column centred at cx; dir 1 = the neck comes down the column's
  // left side (left snake), -1 = mirrored. Only the front half of every turn shows, the column hides
  // the back half; the pot and the palms in front cover the lower turns.
  function coil(g, cx, dir) {
    var rx = 78, ry = 16, tilt = 20, bw = 38, turns = [452, 506, 560, 614, 668];
    turns.forEach(function (yc) {
      // centre line of the front half of one turn, with the body width at each point: full in front,
      // thinner where it bends away behind the column
      var pts = [], N = 60;
      for (var i = 0; i <= N; i++) {
        var t = Math.PI * i / N, side = Math.sin(t);
        pts.push({ x: cx + dir * rx * Math.cos(t), y: yc + ry * side - tilt * Math.cos(t), w: bw * (0.62 + 0.38 * Math.sqrt(side)), f: side });
      }
      g.save();
      // shadow cast on the column below the turn
      g.save(); g.filter = 'blur(7px)'; g.fillStyle = 'rgba(70,32,0,.5)';
      pts.forEach(function (p) { g.beginPath(); g.ellipse(p.x, p.y + p.w * 0.55, p.w * 0.55, p.w * 0.35, 0, 0, Math.PI * 2); g.fill(); });
      g.restore();
      // the body is laid as overlapping round sections, back to front, each shaded like a cylinder
      pts.forEach(function (p, n) {
        var r = p.w / 2, gr = g.createLinearGradient(p.x, p.y - r, p.x, p.y + r);
        var dark = 0.55 * (1 - p.f);                          // bends away into shadow at both ends
        gr.addColorStop(0, '#ffe39a'); gr.addColorStop(0.2, '#ffbf3c'); gr.addColorStop(0.55, '#ee8f14');
        gr.addColorStop(0.85, '#a8520a'); gr.addColorStop(1, '#4e2402');
        g.fillStyle = gr; g.beginPath(); g.ellipse(p.x, p.y, Math.max(3, r * 0.42), r, 0, 0, Math.PI * 2); g.fill();
        if (dark > 0.02) { g.fillStyle = 'rgba(50,22,0,' + dark.toFixed(3) + ')'; g.fill(); }
      });
      // outline along the top and bottom edges
      g.lineWidth = 2; g.strokeStyle = 'rgba(80,38,2,.9)';
      [-1, 1].forEach(function (e) { g.beginPath(); pts.forEach(function (p, n) { var y = p.y + e * p.w / 2; if (n) g.lineTo(p.x, y); else g.moveTo(p.x, y); }); g.stroke(); });
      // scales: a light diamond lattice over the front of the turn
      g.lineWidth = 1.3; g.strokeStyle = 'rgba(120,58,4,.45)';
      for (var k = 6; k < N - 5; k += 3) {
        var p = pts[k], r = p.w / 2;
        [-0.45, 0, 0.45].forEach(function (o) {
          g.beginPath(); g.moveTo(p.x - 4 * dir, p.y + o * r - 3); g.lineTo(p.x, p.y + o * r + 2); g.lineTo(p.x + 4 * dir, p.y + o * r - 3); g.stroke();
        });
      }
      g.restore();
    });
  }
};
