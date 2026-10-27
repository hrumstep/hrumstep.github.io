// Sugar Galaxy: side panels and controls are keyed out of the layout (frame + frame_mask);
// the glowing reel panel behind the 6×5 grid is drawn here.
window.HS_PAINT = window.HS_PAINT || {};
HS_PAINT.galaxy = function (layer, mode, g) {
  if (layer !== 'under') return false;
  var K = window.HSPaintKit, bonus = mode === 'bonus';
  var x = 545, y = 62, w = 846, h = 688;
  K.glow(g, function () { K.rr(g, x, y, w, h, 34); }, bonus ? '#ff9af0' : '#c890ff', 12, 34, 3);
  K.rr(g, x, y, w, h, 34); g.fillStyle = K.lin(g, 0, y, 0, y + h, ['#f2e6ff', '#d6b8ff']); g.fill();
  K.rr(g, x + 18, y + 18, w - 36, h - 36, 22);
  var p = g.createRadialGradient(x + w / 2, y + h / 2, 40, x + w / 2, y + h / 2, 520);
  p.addColorStop(0, bonus ? '#7a2fb8' : '#6a32c8'); p.addColorStop(1, bonus ? '#2a0c4a' : '#2a1260');
  g.fillStyle = p; g.fill();
  g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 2;
  for (var c = 1; c < 6; c++) { var lx = 565 + c * 134.2; g.beginPath(); g.moveTo(lx, y + 26); g.lineTo(lx, y + h - 26); g.stroke(); }
  return true;
};
