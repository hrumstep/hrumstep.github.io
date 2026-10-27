// East Discovery: the temple frame comes from the layout (frame + frame_mask in bg.js); only the
// dark lacquer panel behind the reels is drawn here.
window.HS_PAINT = window.HS_PAINT || {};
HS_PAINT.china = function (layer, mode, g) {
  if (layer !== 'under') return false;
  var K = window.HSPaintKit, bonus = mode === 'bonus';
  g.fillStyle = K.lin(g, 0, 140, 0, 742, bonus ? ['rgba(40,10,30,.55)', 'rgba(20,4,16,.7)'] : ['rgba(30,14,8,.5)', 'rgba(14,6,4,.66)']);
  g.fillRect(464, 140, 1002, 604);
  g.strokeStyle = 'rgba(255,200,120,.12)'; g.lineWidth = 2;
  for (var c = 1; c < 5; c++) { var x = 473 + c * 197; g.beginPath(); g.moveTo(x, 160); g.lineTo(x, 724); g.stroke(); }
  return true;
};
