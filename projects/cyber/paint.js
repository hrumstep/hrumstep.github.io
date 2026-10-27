// Cyber Gang 2107: a chamfered neon glass panel with a glitch logo, drawn in code
// (the export pack has the city / vault backgrounds and rigs but no frame art).
window.HS_PAINT = window.HS_PAINT || {};
HS_PAINT.cyber = function (layer, mode, g) {
  var K = window.HSPaintKit, bonus = mode === 'bonus';
  var c1 = bonus ? '#3aa0ff' : '#22e6ff', c2 = bonus ? '#b8e4ff' : '#ff2bd6';
  if (layer !== 'under') return false;
  var x = 461, y = 126, w = 998, h = 603, cut = 30;
  function panel(inset) {
    var a = x + inset, b = y + inset, ww = w - inset * 2, hh = h - inset * 2, c = cut - inset * 0.4;
    g.beginPath();
    g.moveTo(a + c, b); g.lineTo(a + ww - c, b); g.lineTo(a + ww, b + c); g.lineTo(a + ww, b + hh - c);
    g.lineTo(a + ww - c, b + hh); g.lineTo(a + c, b + hh); g.lineTo(a, b + hh - c); g.lineTo(a, b + c); g.closePath();
  }
  // glass
  g.save();
  g.shadowColor = 'rgba(0,0,0,.75)'; g.shadowBlur = 40; g.shadowOffsetY = 12;
  panel(0); g.fillStyle = bonus ? 'rgba(4,14,34,.86)' : 'rgba(8,4,24,.84)'; g.fill();
  g.restore();
  // faint tech grid inside
  g.save(); panel(6); g.clip();
  g.strokeStyle = bonus ? 'rgba(90,170,255,.07)' : 'rgba(34,230,255,.06)'; g.lineWidth = 1;
  for (var gx = x; gx < x + w; gx += 24) { g.beginPath(); g.moveTo(gx, y); g.lineTo(gx, y + h); g.stroke(); }
  for (var gy = y; gy < y + h; gy += 24) { g.beginPath(); g.moveTo(x, gy); g.lineTo(x + w, gy); g.stroke(); }
  // column separators
  g.strokeStyle = bonus ? 'rgba(120,190,255,.16)' : 'rgba(255,43,214,.14)'; g.lineWidth = 2;
  for (var i = 1; i < 5; i++) { var sx = 485 + i * 190; g.beginPath(); g.moveTo(sx, y + 18); g.lineTo(sx, y + h - 18); g.stroke(); }
  g.restore();
  // neon border + corner brackets
  var tube = K.lin(g, x, y, x + w, y + h, [c1, c1, c2, c2]);
  K.glow(g, function () { panel(0); }, tube, 4, 30, 3);
  g.save(); panel(0); g.lineWidth = 1.5; g.strokeStyle = 'rgba(255,255,255,.65)'; g.stroke(); g.restore();
  g.save(); g.lineWidth = 7; g.lineCap = 'square'; g.shadowBlur = 20;
  [[x, y + cut + 60, x, y + cut, x + cut, y, x + cut + 60, y, c1], [x + w - cut - 60, y + h, x + w - cut, y + h, x + w, y + h - cut, x + w, y + h - cut - 60, c2],
   [x + w - cut - 60, y, x + w - cut, y, x + w, y + cut, x + w, y + cut + 60, c2], [x, y + h - cut - 60, x, y + h - cut, x + cut, y + h, x + cut + 60, y + h, c1]].forEach(function (p) {
    g.strokeStyle = p[8]; g.shadowColor = p[8];
    g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(p[2], p[3]); g.lineTo(p[4], p[5]); g.lineTo(p[6], p[7]); g.stroke();
  });
  g.restore();
  // logo plate + glitch type
  g.save(); K.rr(g, 742, 58, 436, 74, 14); g.fillStyle = 'rgba(8,4,24,.9)'; g.fill();
  K.glow(g, function () { K.rr(g, 742, 58, 436, 74, 14); }, c2, 3, 18, 2); g.restore();
  g.save(); g.globalAlpha = 0.75;
  K.text(g, 'CYBER GANG', 956, 96, { size: 50, fill: bonus ? '#3aa0ff' : '#ff2bd6', spacing: 3 });
  K.text(g, 'CYBER GANG', 964, 94, { size: 50, fill: '#22e6ff', spacing: 3 });
  g.restore();
  K.text(g, 'CYBER GANG', 960, 95, { size: 50, fill: ['#ffffff', '#d6f9ff'], stroke: '#12062a', strokeW: 5, glow: c1, blur: 16, spacing: 3 });
  // release name: Cyber Gang 2107
  g.save(); K.rr(g, 906, 122, 108, 30, 8); g.fillStyle = 'rgba(8,4,24,.92)'; g.fill(); g.lineWidth = 2; g.strokeStyle = c2; g.stroke(); g.restore();
  K.text(g, '2107', 960, 138, { size: 22, fill: '#ffffff', glow: c2, blur: 12, spacing: 4 });

  K.controls(g, { y: 864, menu: [69, 116, 163], minus: 552, pill: [600, 152], plus: 795, spin: [960, 58], turbo: 1206, auto: 1286, balance: 1890, accent: bonus ? '#7cc4ff' : '#ff6ad8' });
  return true;
};
