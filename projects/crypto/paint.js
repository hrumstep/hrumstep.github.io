// Crypto Chain: the monitor-style reel frame, logo and control strip from the Figma layout,
// drawn in code (the export pack has the backgrounds and rigs but not the frame art).
window.HS_PAINT = window.HS_PAINT || {};
HS_PAINT.crypto = function (layer, mode, g) {
  var K = window.HSPaintKit, bonus = mode === 'bonus';
  var neon = bonus ? ['#d8ff3a', '#3dff6a', '#00d27a'] : ['#38c8ff', '#7a5cff', '#e040ff'];
  if (layer !== 'under') return false;

  // monitor bezel
  g.save();
  g.shadowColor = 'rgba(0,0,0,.7)'; g.shadowBlur = 40; g.shadowOffsetY = 14;
  K.rr(g, 381, 50, 1123, 750, 30);
  g.fillStyle = K.lin(g, 0, 50, 0, 800, bonus ? ['#1c3a1e', '#0a1a0c'] : ['#262a52', '#0e1024']);
  g.fill();
  g.restore();
  K.rr(g, 381, 50, 1123, 750, 30); g.lineWidth = 3; g.strokeStyle = bonus ? 'rgba(160,255,140,.25)' : 'rgba(150,170,255,.25)'; g.stroke();

  // screen
  K.rr(g, 428, 97, 1029, 662, 20);
  var sg = g.createRadialGradient(942, 420, 60, 942, 420, 620);
  sg.addColorStop(0, bonus ? 'rgba(14,52,24,.94)' : 'rgba(30,22,82,.94)');
  sg.addColorStop(1, bonus ? 'rgba(4,20,8,.96)' : 'rgba(8,6,32,.96)');
  g.fillStyle = sg; g.fill();

  // neon tube around the screen
  var tube = K.lin(g, 428, 97, 1457, 759, neon);
  K.glow(g, function () { K.rr(g, 428, 97, 1029, 662, 20); }, tube, 7, 34, 3);
  g.save(); K.rr(g, 428, 97, 1029, 662, 20); g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,.7)'; g.stroke(); g.restore();

  // logo
  var logoGlow = bonus ? '#3dff6a' : '#3aa8ff';
  K.text(g, 'CRYPTO', 942, 74, { size: 30, fill: ['#ffffff', bonus ? '#b8ff9a' : '#9fe6ff'], stroke: '#0b0a30', strokeW: 9, glow: logoGlow, blur: 18, spacing: 4 });
  K.text(g, 'CHAIN', 942, 120, { size: 64, fill: ['#ffffff', bonus ? '#7dff5a' : '#4fd2ff', bonus ? '#1fa83a' : '#2160ff'], stroke: '#0b0a30', strokeW: 12, glow: logoGlow, blur: 26, spacing: 2 });
  K.text(g, '100 000', 566, 132, { size: 26, fill: ['#fff3b0', '#ffc21a'], stroke: '#2a1600', strokeW: 6 });

  K.controls(g, { y: 864, menu: [69, 116, 163], minus: 552, pill: [600, 152], plus: 795, spin: [960, 58], turbo: 1206, auto: 1286, balance: 1890 });
  return true;
};
