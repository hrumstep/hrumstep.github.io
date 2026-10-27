/* Rabbit cursor: the mascot's head seen from behind follows the mouse. The ears hang on springs,
 * so they swing with the movement and twitch now and then; over anything clickable they perk up,
 * and on a click the rabbit reaches out with its paw and taps. Mouse/trackpad only — touch screens keep the system cursor.
 */
(function () {
  'use strict';
  if (!window.matchMedia || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  var calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

  var css = document.createElement('style');
  css.textContent =
    'html.hs-rc, html.hs-rc * { cursor: none !important; }' +
    'html.hs-rc input, html.hs-rc textarea, html.hs-rc [contenteditable] { cursor: text !important; }' +
    '#hs-rabbit { position: fixed; left: 0; top: 0; width: 46px; height: 54px; pointer-events: none; z-index: 2147483647;' +
    '  opacity: 0; transition: opacity .2s; will-change: transform; }' +
    '#hs-rabbit.on { opacity: 1; }' +
    '#hs-rabbit .rb { width: 100%; height: 100%; transform-origin: 23px 34px; transition: transform .18s ease-out;' +
    '  filter: drop-shadow(0 0 5px rgba(166,77,255,.75)) drop-shadow(0 2px 3px rgba(0,0,0,.6)); }' +
    // over anything clickable the rabbit picks up the site's neon: a purple rim and a soft cyan halo
    '#hs-rabbit .rb { transition: transform .18s ease-out, filter .2s ease-out; }' +
    '#hs-rabbit.hot .rb { filter: drop-shadow(0 0 2px rgba(214,168,255,.95)) drop-shadow(0 0 8px rgba(176,77,255,.85)) drop-shadow(0 0 16px rgba(61,224,255,.4)) drop-shadow(0 2px 3px rgba(0,0,0,.5)); }' +
    '#hs-rabbit.press .rb { transform: translateY(1.5px) scale(.96); }' +
    // the tap: a small neon ring where the paw lands
    '.hs-rb-tap { position: fixed; width: 26px; height: 26px; margin: -13px 0 0 -13px; border-radius: 50%; pointer-events: none;' +
    '  z-index: 2147483646; border: 2px solid #c48bff; box-shadow: 0 0 10px rgba(176,77,255,.8); animation: hs-rb-tap .45s ease-out forwards; }' +
    '@keyframes hs-rb-tap { from { transform: scale(.3); opacity: 1; } to { transform: scale(1.5); opacity: 0; } }';
  document.head.appendChild(css);

  // ear: drawn pointing up from its root at (0,0); the group is rotated around the root
  var EAR = 'M-4.6,0 C-6.4,-7 -6,-17 -2.4,-24 C-0.8,-27 2.2,-27 3.4,-23.5 C5.6,-16 5.6,-7 4.4,0 Z';
  var svg =
    '<svg class="rb" viewBox="0 0 46 54" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<defs>' +
    '<linearGradient id="hsrbFur" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbf9ff"/><stop offset="1" stop-color="#cfc6ee"/></linearGradient>' +
    '<linearGradient id="hsrbEar" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#e6e0fb"/><stop offset=".7" stop-color="#fbf9ff"/><stop offset="1" stop-color="#b9a6ff"/></linearGradient>' +
    '</defs>' +
    '<g id="hsrbL" transform="translate(17 25) rotate(-14)"><path d="' + EAR + '" fill="url(#hsrbEar)"/>' +
    '<path d="M-1.2,-4 C-2.4,-10 -2,-17 -0.4,-21" stroke="#ddd5f7" stroke-width="0.9" fill="none" stroke-linecap="round"/></g>' +
    '<g id="hsrbR" transform="translate(29 25) rotate(14)"><path d="' + EAR + '" fill="url(#hsrbEar)"/>' +
    '<path d="M1.2,-4 C2.4,-10 2,-17 0.4,-21" stroke="#ddd5f7" stroke-width="0.9" fill="none" stroke-linecap="round"/></g>' +
    // back of the head (lit from above, shaded at the nape), a soft fur tuft and the black hood
    // rising behind the neck with a neon rim (the mascot wears a hoodie)
    '<ellipse cx="23" cy="34" rx="13.5" ry="12.5" fill="url(#hsrbFur)"/>' +
    '<ellipse cx="23" cy="28.5" rx="7.5" ry="4.2" fill="#ffffff" opacity=".55"/>' +
    '<path d="M18.8,23.8 q1.4,-2.4 2.8,-0.4 q1.4,-2.6 2.8,-0.2 q1.4,-2.2 2.8,0.6" stroke="#fbf9ff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M5.5,46 C8,38.5 15,36.5 23,36.5 C31,36.5 38,38.5 40.5,46 L41,54 L5,54 Z" fill="#14101f"/>' +
    '<path d="M5.5,46 C8,38.5 15,36.5 23,36.5 C31,36.5 38,38.5 40.5,46" stroke="#b04dff" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
    '<path d="M23,38.5 L23,54" stroke="#2a2140" stroke-width="1.2"/>' +
    // paw: hoodie sleeve with a neon cuff and a white paw, rotated about the shoulder (35,54);
    // tucked away it hangs down behind the hood, pressing it reaches up so the paw lands on the hotspot
    '<g id="hsrbP" transform="translate(35 54) rotate(70)" opacity="0">' +
    '<rect x="-3.4" y="-16" width="6.8" height="17" rx="3.4" fill="#14101f"/>' +
    '<rect x="-3.8" y="-16.6" width="7.6" height="2.4" rx="1.2" fill="#b04dff"/>' +
    '<ellipse cx="0" cy="-20.2" rx="4.6" ry="4.3" fill="url(#hsrbFur)"/>' +
    '<path d="M-1.9,-24 L-1.6,-22.3 M0,-24.4 L0,-22.6 M1.9,-24 L1.6,-22.3" stroke="#c4b6f0" stroke-width=".8" stroke-linecap="round"/>' +
    '</g>' +
    '</svg>';

  var el = document.createElement('div');
  el.id = 'hs-rabbit';
  el.innerHTML = svg;
  var earL, earR, paw, ready = false;
  function mount() {
    document.body.appendChild(el);
    earL = el.querySelector('#hsrbL'); earR = el.querySelector('#hsrbR'); paw = el.querySelector('#hsrbP');
    document.documentElement.classList.add('hs-rc');
    ready = true;
  }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);

  // hotspot = middle of the head
  var HX = 23, HY = 34;
  var x = -100, y = -100, px = x, py = y, vx = 0, vy = 0, seen = false, hot = false, last = 0;
  // each ear: angle offset (deg) on a spring; the right one is a touch looser so they never move in lockstep
  var L = { a: 0, v: 0, k: 170, d: 11 }, R = { a: 0, v: 0, k: 140, d: 9.5 };
  var nextTwitch = 0;
  // paw reach 0..1 on a stiff spring (a little overshoot reads as a push); held at least 220 ms per tap
  var P = { a: 0, v: 0, k: 520, d: 26 }, held = false, heldUntil = 0;

  addEventListener('mousemove', function (e) {
    x = e.clientX; y = e.clientY;
    if (!seen) { seen = true; px = x; py = y; }
    var t = e.target;
    // inside an iframe (Vimeo player) the page gets no more moves: hide and let the system cursor show
    el.classList.toggle('on', !(t && t.tagName === 'IFRAME'));
    hot = !!(t && t.closest && t.closest('a, button, select, label, [role="button"], [style*="cursor:pointer"], [style*="cursor: pointer"], [data-slot]'));
    el.classList.toggle('hot', hot);
  }, { passive: true });
  document.addEventListener('mouseleave', function () { el.classList.remove('on'); });
  addEventListener('blur', function () { el.classList.remove('on'); });

  addEventListener('mousedown', function (e) {
    if (e.button !== 0) return;
    held = true; heldUntil = performance.now() + 220;
    el.classList.add('press');
    L.v += 160; R.v -= 160;   // a little ear bob as it leans in
  });
  addEventListener('mouseup', function (e) {
    if (e.button !== 0 || !held) return;
    held = false;
    el.classList.remove('press');
    var tap = document.createElement('div');
    tap.className = 'hs-rb-tap'; tap.style.left = x + 'px'; tap.style.top = y + 'px';
    document.body.appendChild(tap);
    setTimeout(function () { tap.remove(); }, 500);
  });

  function spring(s, target, dt) {
    s.v += ((target - s.a) * s.k - s.v * s.d) * dt;
    s.a += s.v * dt;
    if (s.a > 70) { s.a = 70; s.v *= -0.3; } else if (s.a < -70) { s.a = -70; s.v *= -0.3; }
  }

  function frame(t) {
    var dt = Math.min(0.033, ((t - last) / 1000) || 0.016); last = t;
    if (ready) {
      // smoothed pointer velocity in px/s
      vx += ((x - px) / dt - vx) * Math.min(1, dt * 14);
      vy += ((y - py) / dt - vy) * Math.min(1, dt * 14);
      px = x; py = y;
      // ears trail the motion: moving right swings them left; moving up/down flattens or lifts them
      var sway = Math.max(-48, Math.min(48, -vx * 0.035));
      var lift = Math.max(-18, Math.min(18, vy * 0.02));
      var perk = hot ? 10 : 0;
      if (!calm && t > nextTwitch) {
        nextTwitch = t + 1800 + Math.random() * 2600;
        (Math.random() < 0.5 ? L : R).v += (Math.random() < 0.5 ? -1 : 1) * 260;
      }
      spring(L, sway - lift + perk, dt);
      spring(R, sway + lift - perk, dt);
      earL.setAttribute('transform', 'translate(17 25) rotate(' + (-14 + L.a).toFixed(2) + ')');
      earR.setAttribute('transform', 'translate(29 25) rotate(' + (14 + R.a).toFixed(2) + ')');
      spring(P, held || t < heldUntil ? 1 : 0, dt);
      paw.setAttribute('transform', 'translate(35 54) rotate(' + (70 - 105 * P.a).toFixed(2) + ')');
      paw.setAttribute('opacity', Math.max(0, Math.min(1, P.a * 3)).toFixed(2));
      el.style.transform = 'translate3d(' + (x - HX) + 'px,' + (y - HY) + 'px,0)';
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
