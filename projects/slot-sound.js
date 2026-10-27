/*
 * Site and slot sounds, synthesized with Web Audio (no audio files).
 *   HSSound.theme(id)        sound set + background music of a slot (null = site only)
 *   HSSound.event(name, d)   slot cues: spin, stop(col), anticipate, win('small'|'big'), scatter,
 *                            popup, bonus, cascade, coin, done
 *   HSSound.ui(name)         site cues: click, hover, tab, open, close, menu, whoosh, lang, play
 *   HSSound.music(on)        start / stop the quiet background loop of the current theme (not started by the site: no background music)
 *   HSSound.muted(bool)      one switch for everything (remembered in localStorage 'hs-mute')
 * Browsers start audio only after a user gesture; cues before that are silently skipped.
 */
(function () {
  var AC = window.AudioContext || window.webkitAudioContext;
  var ctx = null, master, sfxBus, uiBus, musicBus, verb, theme = null, themeId = null, mute = false, spinTimer = null;
  var music = { on: false, timer: null, step: 0, next: 0 };
  try { mute = localStorage.getItem('hs-mute') === '1'; } catch (e) { }

  function audio(force) {
    if (!AC && !ctx) return null;
    if (!ctx) {
      if (!force) return null;                       // never create the context outside a gesture
      ctx = new AC();
      build();
    }
    if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
    return ctx;
  }
  // Phones (iOS above all) start Web Audio only inside a user gesture, and our cues fire later
  // (after a click, from the slot engine). So every tap / click / key unlocks the context right in
  // the gesture. On iPhone a silent looping <audio> also moves the page to the "playback" audio
  // session, so the cues are heard with the ring/silent switch on silent too.
  var silentEl = null;
  function silentLoop() {
    if (silentEl) return;
    var sr = 8000, n = sr / 2, b = new ArrayBuffer(44 + n * 2), v = new DataView(b), str = function (o, t) { for (var i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
    str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * 2, true);
    silentEl = new Audio(URL.createObjectURL(new Blob([b], { type: 'audio/wav' })));
    silentEl.loop = true; silentEl.setAttribute('playsinline', ''); silentEl.setAttribute('x-webkit-airplay', 'deny');
    var p = silentEl.play(); if (p && p.catch) p.catch(function () { silentEl = null; });
  }
  function unlock() {
    if (mute) return;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { }
    var c = audio(true);
    if (c && c.state !== 'running' && c.resume) c.resume();
    if (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) silentLoop();
  }
  ['touchend', 'pointerup', 'click', 'keydown'].forEach(function (t) { window.addEventListener(t, unlock, { capture: true, passive: true }); });
  // iOS can suspend / interrupt the context (calls, app switch): wake it on return
  document.addEventListener('visibilitychange', function () { if (!document.hidden && ctx && ctx.state !== 'running' && ctx.resume) ctx.resume(); });

  function build() {
    {
      master = ctx.createGain(); master.gain.value = mute ? 0 : 0.7;
      var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3.5;
      master.connect(comp); comp.connect(ctx.destination);
      // small generated room so cues sit in a space instead of sounding dry
      verb = ctx.createConvolver();
      var len = ctx.sampleRate * 1.6, ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (var ch = 0; ch < 2; ch++) { var d = ir.getChannelData(ch); for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
      verb.buffer = ir;
      var wet = ctx.createGain(); wet.gain.value = 0.22; verb.connect(wet); wet.connect(master);
      sfxBus = bus(0.9, 0.35); uiBus = bus(0.35, 0.15); musicBus = bus(0.16, 0.5);
    }
  }
  function bus(vol, send) {
    var g = ctx.createGain(); g.gain.value = vol; g.connect(master);
    var s = ctx.createGain(); s.gain.value = send; g.connect(s); s.connect(verb);
    return g;
  }

  // ---------- voices ----------
  function note(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function env(g, t, a, d, peak) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }

  // o: {f, type, at (s from now) | t (absolute), a, d, vol, to, filter, q, out, pan}
  function tone(o) {
    var c = ctx; if (!c) return;
    var t = o.t || c.currentTime + (o.at || 0), osc = c.createOscillator(), g = c.createGain(), node = osc;
    osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(o.f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.a || 0.005) + o.d);
    if (o.detune) osc.detune.value = o.detune;
    if (o.filter) { var bq = c.createBiquadFilter(); bq.type = 'lowpass'; bq.frequency.value = o.filter; bq.Q.value = o.q || 0.7; node.connect(bq); node = bq; }
    if (o.pan && c.createStereoPanner) { var p = c.createStereoPanner(); p.pan.value = o.pan; node.connect(p); node = p; }
    node.connect(g); env(g, t, o.a || 0.005, o.d, o.vol || 0.3);
    g.connect(o.out || sfxBus); osc.start(t); osc.stop(t + (o.a || 0.005) + o.d + 0.05);
  }
  var noiseBuf = null;
  function noise(o) {
    var c = ctx; if (!c) return;
    if (!noiseBuf) { noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate); var ch = noiseBuf.getChannelData(0); for (var i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1; }
    var t = o.t || c.currentTime + (o.at || 0), s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noiseBuf; s.loop = true; f.type = o.type || 'bandpass'; f.frequency.setValueAtTime(o.freq || 2000, t); f.Q.value = o.q || 1;
    if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.sweep, t + (o.a || 0.003) + o.d);
    s.connect(f); f.connect(g); g.connect(o.out || sfxBus); env(g, t, o.a || 0.003, o.d, o.vol || 0.25);
    s.start(t, Math.random() * 0.5); s.stop(t + (o.a || 0.003) + o.d + 0.05);
  }
  // metallic / bell partials (coins, bells, gongs)
  function metal(f, at, d, vol, ratios) { (ratios || [1, 2.76, 5.4, 8.93]).forEach(function (r, i) { tone({ f: f * r, type: 'sine', at: at, d: d / (1 + i * 0.6), vol: vol / (1 + i * 0.9) }); }); }
  // plucked string (harp, koto, guitar): bright attack, filtered decay
  function pluck(f, at, d, vol, bright) { tone({ f: f, type: 'triangle', at: at, d: d, vol: vol, filter: bright || 3000 }); tone({ f: f * 2, type: 'sine', at: at, d: d * 0.4, vol: vol * 0.35 }); noise({ freq: f * 4, q: 6, at: at, d: 0.02, vol: vol * 0.4 }); }

  // ---------- themes ----------
  var SC = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], penta: [0, 2, 4, 7, 9], minpenta: [0, 3, 5, 7, 10],
    japan: [0, 1, 5, 7, 8], arab: [0, 1, 4, 5, 7, 8, 11], whole: [0, 2, 4, 6, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], lydian: [0, 2, 4, 6, 7, 9, 11] };
  // inst: lead voice; stop: reel-stop material; perc: music groove; prog: chord degrees; bpm: music tempo
  var THEMES = {
    'wild-western': { root: 50, sc: 'minpenta', inst: 'pluck', stop: 'wood', tick: 'wood', perc: 'trot', prog: [0, 3, 4, 0], bpm: 92, pad: 'triangle' },
    ferm:           { root: 60, sc: 'major', inst: 'square', stop: 'pop', tick: 'wood', perc: 'shaker', prog: [0, 3, 4, 0], bpm: 112, pad: 'triangle' },
    neon:           { root: 57, sc: 'japan', inst: 'pluck', stop: 'synth', tick: 'synth', perc: 'lofi', prog: [0, 5, 3, 4], bpm: 84, pad: 'sawtooth' },
    gods:           { root: 55, sc: 'lydian', inst: 'harp', stop: 'harp', tick: 'glass', perc: 'none', prog: [0, 4, 5, 3], bpm: 70, pad: 'sine' },
    joker:          { root: 60, sc: 'major', inst: 'square', stop: 'mech', tick: 'mech', perc: 'swing', prog: [0, 5, 1, 4], bpm: 120, pad: 'square' },
    crypto:         { root: 50, sc: 'minor', inst: 'synth', stop: 'synth', tick: 'synth', perc: 'house', prog: [0, 5, 2, 6], bpm: 118, pad: 'sawtooth' },
    cyber:          { root: 45, sc: 'dorian', inst: 'synth', stop: 'bass', tick: 'synth', perc: 'house', prog: [0, 6, 5, 4], bpm: 100, pad: 'sawtooth' },
    pyramids:       { root: 52, sc: 'arab', inst: 'pluck', stop: 'stone', tick: 'wood', perc: 'darbuka', prog: [0, 1, 0, 6], bpm: 96, pad: 'triangle' },
    sugar:          { root: 64, sc: 'major', inst: 'bell', stop: 'pop', tick: 'glass', perc: 'shaker', prog: [0, 4, 5, 3], bpm: 104, pad: 'sine' },
    greece:         { root: 57, sc: 'dorian', inst: 'harp', stop: 'harp', tick: 'glass', perc: 'none', prog: [0, 3, 6, 4], bpm: 76, pad: 'triangle' },
    newyear:        { root: 67, sc: 'major', inst: 'bell', stop: 'bell', tick: 'glass', perc: 'sleigh', prog: [0, 3, 4, 0], bpm: 108, pad: 'sine' },
    fruity:         { root: 62, sc: 'penta', inst: 'marimba', stop: 'marimba', tick: 'wood', perc: 'island', prog: [0, 3, 4, 3], bpm: 100, pad: 'triangle' },
    china:          { root: 57, sc: 'penta', inst: 'pluck', stop: 'gong', tick: 'wood', perc: 'temple', prog: [0, 4, 3, 4], bpm: 80, pad: 'triangle' },
    galaxy:         { root: 60, sc: 'whole', inst: 'bell', stop: 'laser', tick: 'synth', perc: 'space', prog: [0, 2, 4, 2], bpm: 90, pad: 'sine' },
    lastslots:      { root: 48, sc: 'minor', inst: 'marimba', stop: 'stone', tick: 'wood', perc: 'jungle', prog: [0, 5, 6, 4], bpm: 94, pad: 'triangle' },
  };
  function deg(T, i, oct) { var s = SC[T.sc], n = s.length; return T.root + s[((i % n) + n) % n] + 12 * (Math.floor(i / n) + (oct || 0)); }

  function lead(T, m, at, d, vol, out) {
    var f = note(m);
    switch (T.inst) {
      case 'pluck': pluck(f, at, d, vol); break;
      case 'harp': pluck(f, at, d * 1.6, vol * 0.9, 5000); break;
      case 'bell': metal(f, at, d * 1.8, vol * 0.8, [1, 2.4, 4.1]); break;
      case 'marimba': tone({ f: f, type: 'sine', at: at, d: d * 0.7, vol: vol, out: out }); tone({ f: f * 4, type: 'sine', at: at, d: 0.06, vol: vol * 0.25, out: out }); break;
      case 'square': tone({ f: f, type: 'square', at: at, d: d, vol: vol * 0.95, filter: 2600, out: out }); break;
      default: tone({ f: f, type: 'sawtooth', at: at, d: d, vol: vol * 1.0, filter: 1800, q: 4, out: out });
    }
  }

  var STOP_GAIN = { wood: 2.2, pop: 1.25, synth: 2.6, harp: 1.25, mech: 3.4, bass: 0.8, stone: 2.2, bell: 1, marimba: 1.1, gong: 0.85, laser: 3.6 };
  function stopSound(T, col) {
    var g = ctx.createGain(); g.gain.value = STOP_GAIN[T.stop] || 1; g.connect(sfxBus);
    var keep = sfxBus; sfxBus = g;                 // route this cue through its trim
    try { stopSound2(T, col); } finally { sfxBus = keep; }
  }
  function stopSound2(T, col) {
    var p = note(deg(T, col % 5, 0)), pan = (col - 2) * 0.25;
    switch (T.stop) {
      case 'wood':    noise({ freq: 850, q: 7, d: 0.07, vol: 0.45 }); tone({ f: p / 2, type: 'triangle', d: 0.12, vol: 0.22, pan: pan }); break;
      case 'pop':     tone({ f: p * 2.2, to: p, type: 'sine', d: 0.09, vol: 0.32, pan: pan }); noise({ freq: 3000, q: 3, d: 0.02, vol: 0.12 }); break;
      case 'synth':   tone({ f: p, type: 'sawtooth', d: 0.12, vol: 0.14, filter: 1400, q: 6, pan: pan }); noise({ freq: 5000, q: 2, d: 0.025, vol: 0.14 }); break;
      case 'harp':    pluck(p * 2, 0, 0.5, 0.2, 5000); break;
      case 'mech':    noise({ freq: 2600, q: 9, d: 0.035, vol: 0.5 }); noise({ freq: 700, q: 5, at: 0.025, d: 0.09, vol: 0.35 }); tone({ f: 180, type: 'square', at: 0.02, d: 0.04, vol: 0.06, filter: 900 }); break;
      case 'bass':    tone({ f: p / 2, to: p / 4, type: 'sine', d: 0.22, vol: 0.55 }); noise({ freq: 6000, q: 3, d: 0.02, vol: 0.12 }); break;
      case 'stone':   noise({ type: 'lowpass', freq: 380, d: 0.16, vol: 0.6 }); tone({ f: p / 2, type: 'triangle', d: 0.14, vol: 0.16, pan: pan }); break;
      case 'bell':    metal(p * 2, 0, 0.55, 0.2, [1, 2.4, 4.1]); break;
      case 'marimba': tone({ f: p, type: 'sine', d: 0.22, vol: 0.34, pan: pan }); tone({ f: p * 4, type: 'sine', d: 0.05, vol: 0.09 }); break;
      case 'gong':    metal(p / 2, 0, 0.6, 0.22, [1, 1.48, 2.76]); noise({ freq: 1200, q: 3, d: 0.05, vol: 0.12 }); break;
      case 'laser':   tone({ f: p * 4, to: p, type: 'square', d: 0.13, vol: 0.1, filter: 3200, pan: pan }); break;
    }
  }

  function startSpin(T) {
    stopSpin(); var n = 0;
    spinTimer = setInterval(function () {
      if (!ctx) return; n++;
      if (T.tick === 'wood') noise({ freq: 1500, q: 12, d: 0.018, vol: 0.08 });
      else if (T.tick === 'glass') tone({ f: note(T.root + 24 + (n % 3) * 2), type: 'sine', d: 0.03, vol: 0.035 });
      else if (T.tick === 'mech') noise({ freq: 3200, q: 14, d: 0.014, vol: 0.11 });
      else tone({ f: note(T.root + 12), type: 'square', d: 0.018, vol: 0.025, filter: 1800 });
    }, 66);
    duck(0.35);
  }
  function stopSpin() { if (spinTimer) { clearInterval(spinTimer); spinTimer = null; } }

  // music dips under big moments
  function duck(level, back) {
    if (!musicBus) return;
    var t = ctx.currentTime;
    musicBus.gain.cancelScheduledValues(t); musicBus.gain.setTargetAtTime(musicLevel() * level, t, 0.08);
    if (back) musicBus.gain.setTargetAtTime(musicLevel(), t + back, 0.6);
  }
  function unduck(after) { if (musicBus) musicBus.gain.setTargetAtTime(musicLevel(), ctx.currentTime + (after || 0), 0.6); }

  function run(T, n, step, vol, start) { for (var i = 0; i < n; i++) lead(T, deg(T, (start || 0) + i, 1), i * step, 0.22, vol); }

  // ---------- background music: a quiet four-bar loop per theme ----------
  function percHit(T, s, t) {
    var o = { t: t, out: musicBus };
    function nz(f, q, d, v, type) { noise({ t: t, freq: f, q: q, d: d, vol: v, type: type, out: musicBus }); }
    function kick(v) { tone({ t: t, f: 120, to: 42, type: 'sine', d: 0.22, vol: v, out: musicBus }); }
    var b = s % 16;
    switch (T.perc) {
      case 'trot': if (b % 4 === 0) nz(700, 6, 0.05, 0.5); if (b % 4 === 3) nz(1100, 6, 0.04, 0.3); break;
      case 'shaker': if (b % 2 === 1) nz(7000, 1, 0.04, 0.18, 'highpass'); if (b % 8 === 0) kick(0.35); break;
      case 'lofi': if (b === 0 || b === 10) kick(0.45); if (b === 4 || b === 12) nz(1800, 1, 0.12, 0.25); if (b % 2) nz(8000, 1, 0.02, 0.08, 'highpass'); break;
      case 'swing': if (b % 4 === 0) kick(0.3); if (b % 4 === 2) nz(6000, 1, 0.05, 0.12, 'highpass'); break;
      case 'house': if (b % 4 === 0) kick(0.5); if (b % 4 === 2) nz(9000, 1, 0.05, 0.14, 'highpass'); if (b === 4 || b === 12) nz(1500, 1, 0.1, 0.18); break;
      case 'darbuka': if (b === 0 || b === 6 || b === 10) tone({ t: t, f: 90, to: 60, type: 'sine', d: 0.18, vol: 0.4, out: musicBus }); if (b === 3 || b === 8 || b === 13 || b === 14) nz(2400, 5, 0.04, 0.25); break;
      case 'sleigh': if (b % 2 === 0) { nz(9000, 2, 0.06, 0.12, 'highpass'); } if (b % 8 === 0) kick(0.25); break;
      case 'island': if (b % 4 === 0) kick(0.3); if (b % 4 === 2 || b === 7 || b === 15) nz(5000, 2, 0.04, 0.12); break;
      case 'temple': if (b === 0) [1, 1.48, 2.76].forEach(function (r, i) { tone({ t: t, f: note(T.root - 12) * r, d: 1.2 / (1 + i), vol: 0.08 / (1 + i), out: musicBus }); }); if (b % 4 === 2) nz(1300, 12, 0.05, 0.25); break;
      case 'space': if (b === 0 || b === 8) nz(400, 2, 0.6, 0.12, 'lowpass'); break;
      case 'jungle': if (b === 0 || b === 3 || b === 8 || b === 11) tone({ t: t, f: 110, to: 70, type: 'sine', d: 0.16, vol: 0.38, out: musicBus }); if (b % 2) nz(4000, 3, 0.03, 0.1); break;
    }
    return o;
  }
  var MUSIC_TRIM = { 'wild-western': 1.8, ferm: -0.6, neon: -0.7, gods: 1.4, joker: -1.9, crypto: -4.1, cyber: -3.2, pyramids: -1.3,
    sugar: -1.1, greece: 1.5, newyear: -0.3, fruity: -1.2, china: 0.7, galaxy: 1.0, lastslots: -1.4 };
  function musicLevel() { return 0.16 * Math.pow(10, (MUSIC_TRIM[themeId] || 0) / 20); }
  function musicTick(horizon) {
    if (!music.on || !ctx || !theme) return;
    var T = theme, spb = 60 / T.bpm / 4;        // sixteenth notes
    while (music.next < (horizon || ctx.currentTime + 0.25)) {
      var s = music.step, t = music.next, bar = Math.floor(s / 16) % T.prog.length, chordDeg = T.prog[bar], b = s % 16;
      if (b === 0) {                           // pad chord + bass per bar
        [0, 2, 4].forEach(function (k) { tone({ t: t, f: note(deg(T, chordDeg + k, 0)), type: T.pad, a: 0.4, d: spb * 16 - 0.2, vol: 0.05, filter: 1100, out: musicBus }); });
        tone({ t: t, f: note(deg(T, chordDeg, -1)), type: 'sine', a: 0.02, d: spb * 7, vol: 0.18, out: musicBus });
      }
      if (b === 8) tone({ t: t, f: note(deg(T, chordDeg, -1)), type: 'sine', a: 0.02, d: spb * 7, vol: 0.14, out: musicBus });
      // sparse melody: chord tones on a fixed rhythm, varied per bar
      if ([0, 3, 6, 10, 12].indexOf(b) >= 0 && ((s * 7 + bar * 3) % 5) < 3) {
        var m = deg(T, chordDeg + [0, 2, 4, 2, 1][(b + bar) % 5], 1), f = note(m);
        if (T.inst === 'bell') tone({ t: t, f: f * 2.4, d: 0.6, vol: 0.02, out: musicBus });
        tone({ t: t, f: f, type: T.inst === 'square' ? 'square' : T.inst === 'synth' ? 'sawtooth' : 'triangle', d: spb * 3, vol: 0.06, filter: 2200, out: musicBus });
      }
      percHit(T, s, t);
      music.step++; music.next += spb;
    }
  }

  // ---------- public ----------
  var API = {
    theme: function (id) { themeId = id; theme = id ? (THEMES[id] || THEMES.joker) : null; if (!theme) API.music(false); },
    muted: function (v) {
      if (v === undefined) return mute;
      mute = !!v; try { localStorage.setItem('hs-mute', mute ? '1' : '0'); } catch (e) { }
      if (master) master.gain.value = mute ? 0 : 0.7;
      if (mute) { stopSpin(); if (silentEl) { silentEl.pause(); silentEl = null; } } else unlock();
      return mute;
    },
    stop: function () { stopSpin(); API.music(false); },
    // the background loop starts with the first slot action (a user gesture) and stops on leaving
    music: function (on) {
      if (!on) { music.on = false; clearInterval(music.timer); music.timer = null; return; }
      if (music.on || !theme || !audio(true)) return;
      music.on = true; music.step = 0; music.next = ctx.currentTime + 0.1;
      if (musicBus) { musicBus.gain.cancelScheduledValues(ctx.currentTime); musicBus.gain.setValueAtTime(0.0001, ctx.currentTime); musicBus.gain.exponentialRampToValueAtTime(musicLevel(), ctx.currentTime + 2.5); }
      music.timer = setInterval(musicTick, 90);
    },
    event: function (name, data) {
      if (!theme || !audio(true) || mute) return;
      var T = theme;
      switch (name) {
        case 'spin': noise({ type: 'lowpass', freq: 250, sweep: 1600, a: 0.05, d: 0.28, vol: 0.34 }); tone({ f: note(T.root), to: note(T.root + 12), type: 'sine', d: 0.18, vol: 0.08 }); startSpin(T); break;
        case 'stop': stopSound(T, data || 0); break;
        case 'anticipate': for (var i = 0; i < 10; i++) lead(T, deg(T, i, 1), i * 0.1, 0.12, 0.05 + i * 0.012); noise({ type: 'bandpass', freq: 400, sweep: 4000, q: 3, a: 0.9, d: 0.3, vol: 0.12 }); break;
        case 'win':
          stopSpin();
          if (data === 'big') { duck(0.3, 2.2); run(T, 8, 0.075, 0.2); [0, 2, 4, 7].forEach(function (k) { lead(T, deg(T, k, 1), 0.62, 0.9, 0.12); }); metal(note(deg(T, 7, 1)), 0.62, 1.2, 0.06); }
          else { duck(0.6, 1.2); run(T, 4, 0.085, 0.18); }
          break;
        case 'scatter': stopSpin(); duck(0.3, 2.5); [0, 2, 4, 7, 9].forEach(function (k, i) { lead(T, deg(T, k, 1), i * 0.06, 1.2, 0.12); }); noise({ type: 'highpass', freq: 6000, a: 0.25, d: 0.9, vol: 0.08 }); break;
        case 'bonus': duck(0.2, 3); noise({ type: 'bandpass', freq: 250, sweep: 6000, q: 2, a: 0.7, d: 0.6, vol: 0.24 }); run(T, 12, 0.055, 0.14); metal(note(T.root + 24), 0.75, 1.5, 0.1); break;
        case 'popup': duck(0.25, 3); [[0, 2, 4], [3, 5, 7], [4, 6, 8, 11]].forEach(function (ch, j) { ch.forEach(function (k) { lead(T, deg(T, k, 1), j * 0.33, j === 2 ? 1.3 : 0.4, 0.12); }); }); tone({ f: note(T.root - 12), type: 'sine', at: 0.66, d: 1.2, vol: 0.3 }); break;
        case 'cascade':
          if (themeId === 'newyear') {   // snowballs: a soft powdery puff
            noise({ type: 'lowpass', freq: 3000, sweep: 500, a: 0.01, d: 0.3, vol: 0.2 });
            for (var k = 0; k < 3; k++) tone({ f: note(deg(T, 9 - k, 1)), type: 'sine', at: k * 0.05, d: 0.08, vol: 0.08 });
            break;
          }
          // light burst of the winning symbols: soft thump, airy blast and a few sparks, plus a small sparkle in the theme's key
          tone({ f: 150, to: 48, type: 'sine', d: 0.26, vol: 0.32 });
          noise({ type: 'lowpass', freq: 2600, sweep: 260, q: 0.8, a: 0.004, d: 0.34, vol: 0.3 });
          noise({ type: 'bandpass', freq: 900, sweep: 300, q: 1.2, a: 0.002, d: 0.12, vol: 0.18 });
          for (var k = 0; k < 4; k++) noise({ type: 'highpass', freq: 5000 + Math.random() * 3000, at: 0.03 + Math.random() * 0.16, d: 0.025, vol: 0.05 });
          tone({ f: note(deg(T, 7, 1)), type: 'sine', at: 0.06, d: 0.18, vol: 0.05 }); tone({ f: note(deg(T, 9, 1)), type: 'sine', at: 0.1, d: 0.22, vol: 0.04 });
          break;
        case 'coin': metal(note(T.root + 31), 0, 0.25, 0.12, [1, 2.7, 5.1]); metal(note(T.root + 36), 0.07, 0.4, 0.12, [1, 2.7, 5.1]); break;
        case 'done': stopSpin(); unduck(); break;
      }
    },
    ui: function (name) {
      if (!audio(name !== 'hover') || mute) return;
      var o = { out: uiBus };
      switch (name) {
        case 'hover': tone({ f: 1800, type: 'sine', d: 0.025, vol: 0.05, out: uiBus }); break;
        case 'click': tone({ f: 1100, to: 700, type: 'sine', d: 0.05, vol: 0.3, out: uiBus }); noise({ freq: 4000, q: 4, d: 0.015, vol: 0.1, out: uiBus }); break;
        case 'tab': tone({ f: 660, type: 'triangle', d: 0.06, vol: 0.18, out: uiBus }); tone({ f: 990, type: 'triangle', at: 0.05, d: 0.09, vol: 0.16, out: uiBus }); break;
        case 'lang': tone({ f: 880, type: 'sine', d: 0.05, vol: 0.16, out: uiBus }); tone({ f: 1320, type: 'sine', at: 0.04, d: 0.07, vol: 0.12, out: uiBus }); break;
        case 'open': noise({ freq: 400, sweep: 3200, q: 1.5, a: 0.12, d: 0.22, vol: 0.2, out: uiBus }); tone({ f: 440, to: 880, type: 'sine', a: 0.05, d: 0.25, vol: 0.1, out: uiBus }); break;
        case 'close': noise({ freq: 3000, sweep: 350, q: 1.5, a: 0.03, d: 0.22, vol: 0.25, out: uiBus }); tone({ f: 700, to: 350, type: 'sine', d: 0.2, vol: 0.12, out: uiBus }); break;
        case 'menu': noise({ freq: 1500, sweep: 2600, q: 2, a: 0.03, d: 0.12, vol: 0.34, out: uiBus }); tone({ f: 900, type: 'sine', d: 0.06, vol: 0.12, out: uiBus }); break;
        case 'whoosh': noise({ freq: 600, sweep: 1800, q: 1.2, a: 0.15, d: 0.35, vol: 0.17, out: uiBus }); break;
        case 'play': tone({ f: 523, type: 'triangle', d: 0.1, vol: 0.16, out: uiBus }); tone({ f: 784, type: 'triangle', at: 0.08, d: 0.18, vol: 0.14, out: uiBus }); break;
      }
      return o;
    }
  };
  // QA: render cues into an OfflineAudioContext to measure their levels
  API._music = function (sec) { music.on = true; music.step = 0; music.next = 0.05; musicBus.gain.value = musicLevel(); musicTick(sec); music.on = false; };
  API._offline = function (c) { ctx = c; noiseBuf = null; build(); mute = false; master.gain.value = 0.7; return API; };
  window.HSSound = API;
})();
