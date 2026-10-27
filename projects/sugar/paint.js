// Sweetie Spins (Sugar Lady): wooden kitchen shelves for the base game and a picnic cloth for
// free spins, with the logo, drawn in code over the kitchen / meadow pictures from the Behance set.
window.HS_PAINT = window.HS_PAINT || {};
HS_PAINT.sugar = function (layer, mode, g) {
  var K = window.HSPaintKit, bonus = mode === 'bonus';
  if (layer !== 'under') return false;
  var x0 = 410, y0 = 92, w = 1100, h = 690, cx = 460, cy = 134, cw = 198, ch = 202;

  if (!bonus) {
    g.save(); g.shadowColor = 'rgba(40,15,0,.55)'; g.shadowBlur = 36; g.shadowOffsetY = 16;
    K.rr(g, x0, y0, w, h, 12); g.fillStyle = K.lin(g, 0, y0, 0, y0 + h, ['#9a5428', '#6e3514', '#4e230b']); g.fill(); g.restore();
    // crown and base boards
    K.rr(g, x0 - 16, y0 - 18, w + 32, 34, 8); g.fillStyle = K.lin(g, 0, y0 - 18, 0, y0 + 16, ['#d18b4c', '#8e4a1e']); g.fill();
    K.rr(g, x0 - 10, y0 + h - 14, w + 20, 30, 8); g.fillStyle = K.lin(g, 0, y0 + h - 14, 0, y0 + h + 16, ['#c47c40', '#6e3514']); g.fill();
    for (var c = 0; c < 5; c++) for (var r = 0; r < 3; r++) {
      var bx = cx + c * cw + 8, by = cy + r * ch + 6, bw = cw - 16, bh = ch - 20;
      g.fillStyle = K.lin(g, 0, by, 0, by + bh, ['#2a1206', '#4a2410', '#5e2f14']); g.fillRect(bx, by, bw, bh);
      var sh = g.createLinearGradient(bx, 0, bx + bw, 0);
      sh.addColorStop(0, 'rgba(0,0,0,.35)'); sh.addColorStop(0.15, 'rgba(0,0,0,0)'); sh.addColorStop(0.85, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.35)');
      g.fillStyle = sh; g.fillRect(bx, by, bw, bh);
      // shelf lip under each cubby
      g.fillStyle = K.lin(g, 0, by + bh, 0, by + bh + 14, ['#e0a060', '#9a5428']); g.fillRect(bx - 8, by + bh, bw + 16, 14);
    }
    // wood grain on the posts
    g.strokeStyle = 'rgba(255,200,140,.08)'; g.lineWidth = 2;
    for (var gx = x0 + 6; gx < x0 + w; gx += 9) { g.beginPath(); g.moveTo(gx, y0 + 10); g.lineTo(gx + 4, y0 + h - 10); g.stroke(); }
  } else {
    g.save(); g.shadowColor = 'rgba(0,40,0,.45)'; g.shadowBlur = 30; g.shadowOffsetY = 14;
    K.rr(g, x0, y0 + 6, w, h - 6, 26); g.fillStyle = '#f2e8d2'; g.fill(); g.restore();
    g.save(); K.rr(g, x0, y0 + 6, w, h - 6, 26); g.clip();
    g.fillStyle = 'rgba(214,190,150,.22)';
    for (var tx = x0; tx < x0 + w; tx += 44) g.fillRect(tx, y0, 22, h);
    for (var ty = y0; ty < y0 + h; ty += 44) g.fillRect(x0, ty, w, 22);
    g.strokeStyle = 'rgba(160,130,90,.18)'; g.lineWidth = 3;
    for (c = 1; c < 5; c++) { g.beginPath(); g.moveTo(cx + c * cw, y0 + 20); g.lineTo(cx + c * cw, y0 + h - 20); g.stroke(); }
    for (r = 1; r < 3; r++) { g.beginPath(); g.moveTo(x0 + 20, cy + r * ch - 4); g.lineTo(x0 + w - 20, cy + r * ch - 4); g.stroke(); }
    g.restore();
    K.rr(g, x0, y0 + 6, w, h - 6, 26); g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.7)'; g.stroke();
  }
  // logo
  var script = function (px) { return 'italic 900 ' + px + "px 'Georgia', 'Times New Roman', serif"; };
  K.text(g, 'Sweetie', 842, 62, { font: script(78), size: 78, fill: ['#ffd6ec', '#ff6fb8', '#d01f7c'], stroke: '#6a0f3c', strokeW: 10, glow: 'rgba(255,255,255,.9)', blur: 10 });
  K.text(g, 'Spins', 1130, 66, { font: script(70), size: 70, fill: ['#fff3c4', '#ffc93c', '#d88a10'], stroke: '#6a0f3c', strokeW: 10, glow: 'rgba(255,255,255,.9)', blur: 10 });

  K.controls(g, { y: 864, menu: [69, 116, 163], minus: 552, pill: [600, 152], plus: 795, spin: [960, 58], turbo: 1206, auto: 1286, balance: 1890, accent: '#ffcf6b' });
  return true;
};
