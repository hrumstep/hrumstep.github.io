// Fruity Island: the driftwood reel frame, logo, Buy Free Spins sign and multiplier board drawn in code
// over the beach pictures (the export pack has the beach, palms, heroes and symbols but no frame art).
// Layout follows the released game: logo and Buy sign on the left, the surfer on the right.
window.HS_PAINT = window.HS_PAINT || {};
HS_PAINT.fruity = function (layer, mode, g) {
  var K = window.HSPaintKit, bonus = mode === 'bonus';
  if (layer !== 'under') return false;
  var x0 = 572, y0 = 100, w = 896, h = 680, cx = 590, cw = 143.33;

  // round driftwood log, horizontal or vertical, with lighter cut ends
  function log(x, y, len, th, vertical) {
    g.save();
    g.shadowColor = 'rgba(30,15,0,.45)'; g.shadowBlur = 14; g.shadowOffsetY = 5;
    var gr = vertical ? K.lin(g, x, 0, x + th, 0, ['#5e3a1a', '#b98048', '#d9a56a', '#8a5a2c', '#4e2f14'])
                      : K.lin(g, 0, y, 0, y + th, ['#5e3a1a', '#b98048', '#d9a56a', '#8a5a2c', '#4e2f14']);
    K.rr(g, x, y, vertical ? th : len, vertical ? len : th, th / 2); g.fillStyle = gr; g.fill();
    g.restore();
    g.save(); g.strokeStyle = 'rgba(60,32,10,.35)'; g.lineWidth = 1.5;
    for (var i = 1; i < 4; i++) {
      g.beginPath();
      if (vertical) { var xx = x + th * i / 4; g.moveTo(xx, y + 14); g.bezierCurveTo(xx + 3, y + len * 0.35, xx - 3, y + len * 0.65, xx, y + len - 14); }
      else { var yy = y + th * i / 4; g.moveTo(x + 14, yy); g.bezierCurveTo(x + len * 0.35, yy + 3, x + len * 0.65, yy - 3, x + len - 14, yy); }
      g.stroke();
    }
    g.restore();
    // cut ends
    [[0], [1]].forEach(function (e) {
      var ex = vertical ? x + th / 2 : x + (e[0] ? len - th / 2 : th / 2), ey = vertical ? y + (e[0] ? len - th / 2 : th / 2) : y + th / 2;
      g.beginPath(); g.ellipse(ex, ey, th * 0.42, th * 0.42, 0, 0, Math.PI * 2); g.fillStyle = '#e6c08a'; g.fill();
      g.beginPath(); g.ellipse(ex, ey, th * 0.26, th * 0.26, 0, 0, Math.PI * 2); g.strokeStyle = 'rgba(120,70,30,.6)'; g.lineWidth = 2; g.stroke();
    });
  }

  // whitewashed planks behind the reels, one per column
  g.save(); g.shadowColor = 'rgba(0,30,40,.4)'; g.shadowBlur = 30; g.shadowOffsetY = 12;
  g.fillStyle = bonus ? '#d8b48c' : '#eadfca'; g.fillRect(x0, y0, w, h); g.restore();
  for (var c = 0; c < 6; c++) {
    var px = cx + c * cw;
    g.fillStyle = K.lin(g, px, 0, px + cw, 0, bonus ? ['#caa27a', '#e2c39c', '#d6b38a'] : ['#e4d7bf', '#f3eadb', '#e8dcc6']);
    g.fillRect(px + 2, y0, cw - 4, h);
    g.strokeStyle = bonus ? 'rgba(110,60,20,.18)' : 'rgba(120,90,50,.16)'; g.lineWidth = 1.5;
    for (var k = 0; k < 5; k++) {
      var gx = px + 16 + k * 26 + (c * 7 % 11);
      g.beginPath(); g.moveTo(gx, y0 + 10);
      g.bezierCurveTo(gx + 8 * Math.sin(c + k), y0 + h * 0.3, gx - 8 * Math.cos(c * 2 + k), y0 + h * 0.7, gx + 4, y0 + h - 10); g.stroke();
    }
  }
  g.fillStyle = 'rgba(90,60,30,.35)';
  for (c = 1; c < 6; c++) g.fillRect(cx + c * cw - 2, y0, 4, h);
  g.fillStyle = 'rgba(90,60,30,.25)'; g.fillRect(x0, y0, cx - x0, h); g.fillRect(cx + 6 * cw, y0, x0 + w - cx - 6 * cw, h);

  // driftwood frame: posts at the sides, long logs across the top and bottom
  log(x0 - 22, y0 - 4, h + 8, 30, true);
  log(x0 + w - 8, y0 - 4, h + 8, 30, true);
  log(x0 - 54, y0 - 30, w + 108, 38, false);
  log(x0 - 54, y0 + h - 8, w + 108, 38, false);

  // tropical leaves and hibiscus behind the logo
  function leaf(x, y, len, ang, col) {
    g.save(); g.translate(x, y); g.rotate(ang);
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * 0.5, -len * 0.22, len, 0); g.quadraticCurveTo(len * 0.5, len * 0.22, 0, 0);
    g.fillStyle = col; g.fill(); g.strokeStyle = 'rgba(20,60,10,.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(len * 0.95, 0); g.stroke();
    g.restore();
  }
  function hibiscus(x, y, r) {
    for (var i = 0; i < 5; i++) { var a = i * Math.PI * 2 / 5; g.beginPath(); g.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.55, r * 0.4, a, 0, Math.PI * 2); g.fillStyle = i % 2 ? '#ff4d5e' : '#ff6a3d'; g.fill(); }
    K.circle(g, x, y, r * 0.2); g.fillStyle = '#ffd84a'; g.fill();
  }
  var lx = 262, ly = 182;
  [[-150, -30, 120, -2.7], [-130, 30, 110, 2.8], [120, -40, 120, -0.4], [140, 20, 110, 0.35], [-40, -70, 100, -1.9], [50, -72, 100, -1.2]].forEach(function (l, i) {
    leaf(lx + l[0] * 0.55, ly + l[1] * 0.4, l[2], l[3], i % 2 ? '#3fae3a' : '#2f8f2e');
  });
  hibiscus(lx - 150, ly + 20, 26); hibiscus(lx + 150, ly + 26, 24); hibiscus(lx - 30, ly + 64, 18);
  K.text(g, 'FRUITY', lx, ly - 26, { size: 64, fill: ['#fff7b0', '#ffc93a', '#ff7a1a'], stroke: '#5a2a0a', strokeW: 12, spacing: 2 });
  K.text(g, 'ISLAND', lx, ly + 34, { size: 60, fill: ['#e8ffcf', '#86e35a', '#2a9a3a'], stroke: '#3a1e06', strokeW: 12, spacing: 3 });

  // Buy Free Spins: an oval of dark wood framed with leaves
  var bx = 262, by = 458;
  [[-0.9, '#2f8f2e'], [-0.3, '#3fae3a'], [0.4, '#2f8f2e'], [2.5, '#3fae3a'], [3.3, '#2f8f2e']].forEach(function (l) { leaf(bx + Math.cos(l[0] - Math.PI / 2) * 120, by - 70 + Math.sin(l[0]) * 10, 90, l[0] - Math.PI / 2, l[1]); });
  hibiscus(bx - 110, by - 92, 20); hibiscus(bx + 112, by - 88, 20);
  g.save(); g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 20; g.shadowOffsetY = 8;
  g.beginPath(); g.ellipse(bx, by, 160, 112, 0, 0, Math.PI * 2); g.fillStyle = K.lin(g, 0, by - 112, 0, by + 112, ['#6a4a34', '#4a3020', '#3a2416']); g.fill(); g.restore();
  g.save(); g.beginPath(); g.ellipse(bx, by, 160, 112, 0, 0, Math.PI * 2); g.clip();
  g.strokeStyle = 'rgba(255,220,180,.10)'; g.lineWidth = 3;
  for (var r = 30; r < 220; r += 26) { g.beginPath(); g.ellipse(bx - 40, by + 10, r, r * 0.6, 0.2, 0, Math.PI * 2); g.stroke(); }
  g.restore();
  g.beginPath(); g.ellipse(bx, by, 160, 112, 0, 0, Math.PI * 2); g.lineWidth = 5; g.strokeStyle = '#2a170a'; g.stroke();
  ['BUY', 'FREE', 'SPINS'].forEach(function (t, i) { K.text(g, t, bx, by - 54 + i * 54, { size: 44, fill: '#ffffff', weight: 800, spacing: 2 }); });

  // win multiplier board on a log frame
  var mx = 262, my = 686;
  g.save(); g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 18; g.shadowOffsetY = 6;
  g.fillStyle = K.lin(g, 0, my - 70, 0, my + 70, ['#5a524c', '#3e3834']); g.fillRect(mx - 120, my - 66, 240, 132); g.restore();
  log(mx - 138, my - 82, 276, 22, false); log(mx - 138, my + 60, 276, 22, false);
  log(mx - 132, my - 70, 140, 18, true); log(mx + 114, my - 70, 140, 18, true);
  K.text(g, 'x1', mx, my + 2, { size: 92, fill: ['#ffffff', '#f0d0ff', '#c084ff'], stroke: '#4a2a6a', strokeW: 6 });

  K.controls(g, { y: 864, menu: [69, 116, 163], minus: 552, pill: [600, 152], plus: 795, spin: [966, 58], turbo: 1084, auto: 1146, balance: 1452, accent: bonus ? '#ffd27a' : '#6a3410' });
  return true;
};
