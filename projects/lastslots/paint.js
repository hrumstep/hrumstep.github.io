// The Last of Slots: the pack has the symbols and the hanging-vine rig only, so the backdrop,
// the gold frame and the red logo plaque are drawn in code after the released game.
window.HS_PAINT = window.HS_PAINT || {};
HS_PAINT.lastslots = function (layer, mode, g) {
  var K = window.HSPaintKit, bonus = mode === 'bonus', W = 1920, H = 940;
  var rnd = (function (s) { return function () { s = (s * 16807) % 2147483647; return s / 2147483647; }; })(11);
  if (layer === 'back') {
    g.fillStyle = K.lin(g, 0, 0, 0, H, bonus ? ['#0a2a2a', '#0c3a30', '#06160f'] : ['#0b2a16', '#14402a', '#07160c']);
    g.fillRect(0, 0, W, H);
    var sun = g.createRadialGradient(960, 260, 20, 960, 260, 760);
    sun.addColorStop(0, bonus ? 'rgba(120,255,220,.45)' : 'rgba(255,236,150,.42)'); sun.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sun; g.fillRect(0, 0, W, H);
    // light shafts
    g.save(); g.globalCompositeOperation = 'lighter';
    for (var i = 0; i < 7; i++) {
      var x = 300 + i * 220 + rnd() * 80; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 70, 0); g.lineTo(x - 120 + rnd() * 60, H); g.lineTo(x - 260, H); g.closePath();
      g.fillStyle = bonus ? 'rgba(120,255,220,.035)' : 'rgba(255,240,170,.035)'; g.fill();
    }
    g.restore();
    // layered foliage: back to front, darker toward the edges
    function leaf(x, y, r, a, col) { g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(r * 0.5, -r * 0.35, r, 0); g.quadraticCurveTo(r * 0.5, r * 0.35, 0, 0); g.fillStyle = col; g.fill(); g.restore(); }
    [['#1d5a32', 90], ['#16482a', 70], ['#0f3620', 55], ['#0a2616', 40]].forEach(function (L, li) {
      for (var n = 0; n < L[1]; n++) {
        var side = rnd() < 0.5, x = side ? rnd() * 520 : W - rnd() * 520, y = rnd() * H;
        if (li < 2 && rnd() < 0.4) { x = rnd() * W; y = H - rnd() * 140; }
        leaf(x, y, 60 + rnd() * 110, rnd() * Math.PI * 2, L[0]);
      }
    });
    // ground
    g.fillStyle = K.lin(g, 0, 780, 0, H, ['rgba(20,40,20,0)', '#081208']); g.fillRect(0, 760, W, H - 760);
    return true;
  }
  if (layer !== 'under') return false;
  var x0 = 462, y0 = 126, w = 996, h = 624;
  // thin gold frame around a dark panel, as in the released game (the vine rig climbs over it)
  g.save(); g.shadowColor = 'rgba(0,0,0,.75)'; g.shadowBlur = 40; g.shadowOffsetY = 14;
  g.fillStyle = bonus ? '#0c1c18' : '#16120c'; g.fillRect(x0, y0, w, h); g.restore();
  var p = g.createRadialGradient(960, 440, 60, 960, 440, 640);
  p.addColorStop(0, bonus ? '#163a34' : '#2a2416'); p.addColorStop(1, bonus ? '#07140f' : '#0e0b06');
  g.fillStyle = p; g.fillRect(x0 + 14, y0 + 14, w - 28, h - 28);
  g.strokeStyle = 'rgba(214,170,80,.35)'; g.lineWidth = 3;
  for (var c = 1; c < 5; c++) { var lx = 480 + c * 192; g.beginPath(); g.moveTo(lx, y0 + 14); g.lineTo(lx, y0 + h - 14); g.stroke(); }
  var gold = K.lin(g, x0, y0, x0 + w, y0 + h, ['#fff0b0', '#d9a43a', '#ffe08a', '#a8701c', '#f6d27a']);
  g.save(); g.lineWidth = 16; g.strokeStyle = gold; g.strokeRect(x0 + 7, y0 + 7, w - 14, h - 14);
  g.lineWidth = 2; g.strokeStyle = 'rgba(80,50,10,.8)'; g.strokeRect(x0, y0, w, h); g.strokeRect(x0 + 15, y0 + 15, w - 30, h - 30);
  g.strokeStyle = 'rgba(255,250,220,.55)'; g.strokeRect(x0 + 4, y0 + 4, w - 8, h - 8); g.restore();
  // logo: a red plaque with a gold rim
  var lw = 560, lh = 92, lx0 = 960 - lw / 2, ly0 = 52;
  g.save(); g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 20; g.shadowOffsetY = 8;
  K.rr(g, lx0, ly0, lw, lh, 26); g.fillStyle = K.lin(g, 0, ly0, 0, ly0 + lh, ['#ffe9a0', '#c8901e', '#8a5a10']); g.fill(); g.restore();
  K.rr(g, lx0 + 8, ly0 + 8, lw - 16, lh - 16, 20); g.fillStyle = K.lin(g, 0, ly0, 0, ly0 + lh, bonus ? ['#1f6a5a', '#0c3a30'] : ['#c8322a', '#8a1410', '#5e0a08']); g.fill();
  K.rr(g, lx0 + 8, ly0 + 8, lw - 16, lh - 16, 20); g.lineWidth = 2; g.strokeStyle = 'rgba(255,230,160,.6)'; g.stroke();
  K.text(g, 'THE LAST OF SLOTS', 960, ly0 + lh / 2 + 2, { size: 44, fill: ['#fffbe8', '#ffe7a6', '#f2b84a'], stroke: '#3a0a06', strokeW: 9, spacing: 2 });
  K.controls(g, { y: 864, menu: [69, 116, 163], minus: 552, pill: [600, 152], plus: 795, spin: [960, 58], turbo: 1206, auto: 1286, balance: 1890, accent: '#ffd86a' });
  return true;
};
