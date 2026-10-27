/* Wild Western Story — interactive slot demo.
 * One WebGL canvas (spine-webgl from the spine-player bundle) draws the living
 * environment, every reel symbol, the Wild and the popups on top of a single CSS
 * background, so the scene has one background and one GL context.
 * window.HSSlot.create(host, cfg) -> { play(kind, mode), destroy() }
 */
(function () {
  'use strict';

  // World = the clean game background exported from the layout PSB (1920x940, top-left origin).
  var W = 1920, H = 940;
  var REEL = { x: 466.5, y: 150, w: 985, h: 603, cols: 5, rows: 3 };
  var CW = REEL.w / REEL.cols, CH = REEL.h / REEL.rows;
  var SPIN_BTN = { x: 959, y: 860, r: 68 };
  // Environment rigs, placed where the matching layers sit in the PSB.
  var ENV = {
    cacti: { x: 929.2, y: 842, speed: 0.3, shift: { bone_cap: [-30.7, 13], bone_cactus_one: [20.8, -3.5], bone_cactus_two: [20.8, -3.5] } },
    light: { x: 1520.5, y: 181.5, speed: 0.5 },
    logo: { x: 877.8, y: 125, speed: 0.42 }
  };
  var TUMBLE = { speed: 0.12, first: [14000, 22000], every: [38000, 60000], spin: -560 };
  var POPUPS = /^(bigwin|megawin|epicwin|bonusspins|bonustotal|buybonus)$/;

  var scripts = {};
  function loadScript(src) {
    if (!scripts[src]) {
      scripts[src] = new Promise(function (ok, fail) {
        var s = document.createElement('script');
        s.src = src; s.async = true;
        s.onload = ok;
        s.onerror = function () { delete scripts[src]; fail(new Error('Failed to load ' + src)); };
        document.head.appendChild(s);
      });
    }
    return scripts[src];
  }

  function rnd(n) { return Math.floor(Math.random() * n); }
  function pick(list) { return list[rnd(list.length)]; }
  function between(r) { return r[0] + Math.random() * (r[1] - r[0]); }
  function wait(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }
  function easeOutBack(t) { var s = 1.15, u = t - 1; return 1 + (s + 1) * u * u * u + s * u * u; }

  // world (top-left origin) -> spine (bottom-left origin)
  function cellCenter(c, r) { return { x: REEL.x + CW * (c + 0.5), y: H - (REEL.y + CH * (r + 0.5)) }; }

  // Bounds of what is actually visible: skips hidden slots, which Skeleton.getBounds counts.
  // `only` limits the measurement to the named slots.
  function visibleBounds(sk, only) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, buf = new Float32Array(1024);
    sk.drawOrder.forEach(function (slot) {
      if (!slot.bone.active || slot.color.a < 0.05) return;
      if (only && only.indexOf(slot.data.name) < 0) return;
      var a = slot.getAttachment(), n = 0;
      if (!a) return;
      if (a instanceof spine.RegionAttachment) { n = 8; a.computeWorldVertices(slot, buf, 0, 2); }
      else if (a instanceof spine.MeshAttachment) {
        n = a.worldVerticesLength;
        if (buf.length < n) buf = new Float32Array(n);
        a.computeWorldVertices(slot, 0, n, buf, 0, 2);
      } else return;
      for (var i = 0; i < n; i += 2) {
        if (buf[i] < minX) minX = buf[i]; if (buf[i] > maxX) maxX = buf[i];
        if (buf[i + 1] < minY) minY = buf[i + 1]; if (buf[i + 1] > maxY) maxY = buf[i + 1];
      }
    });
    if (minX === Infinity) return { x: 0, y: 0, w: 1, h: 1 };
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  // ---------- popup numbers ----------
  // Win amounts / spin counts drawn on the popup's number bone (bone_money, bone_input_number,
  // bone_main_star_number). The text is rendered to a 2D canvas, uploaded as a texture and drawn
  // at the bone's world position and scale, faded with the plate it sits on.
  var NUMBERS = {
    bigwin: { min: 20000, max: 60000, money: true }, megawin: { min: 60000, max: 250000, money: true },
    epicwin: { min: 250000, max: 900000, money: true }, bonustotal: { min: 30000, max: 150000, money: true },
    bonusspins: { list: [8, 10, 12, 15] }, buybonus: { list: [100000], money: true, fixed: true }
  };
  function formatNumber(v, money) {
    var s = String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return money ? s + ' USD' : s;
  }
  function NumberLabel(ctx) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1024; this.canvas.height = 256;
    this.tex = new spine.GLTexture(ctx, this.canvas, false);
    this.text = null; this.color = new spine.Color(1, 1, 1, 1);
  }
  NumberLabel.prototype.set = function (text) {
    if (text === this.text) return;
    this.text = text;
    var c = this.canvas, g = c.getContext('2d'), px = 150;
    g.clearRect(0, 0, c.width, c.height);
    g.font = '900 ' + px + "px 'Arial Black', 'Arial', sans-serif";
    var w = g.measureText(text).width;
    if (w > c.width - 40) { px = Math.floor(px * (c.width - 40) / w); g.font = '900 ' + px + "px 'Arial Black', 'Arial', sans-serif"; }
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    var grad = g.createLinearGradient(0, c.height / 2 - px / 2, 0, c.height / 2 + px / 2);
    grad.addColorStop(0, '#fffbe0'); grad.addColorStop(0.45, '#ffd54a'); grad.addColorStop(1, '#e38a00');
    g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = 14; g.shadowOffsetY = 6;
    g.lineWidth = 16; g.strokeStyle = '#4a2300'; g.strokeText(text, c.width / 2, c.height / 2);
    g.shadowColor = 'transparent';
    g.fillStyle = grad; g.fillText(text, c.width / 2, c.height / 2);
    this.tex.update(false);
  };
  // height: glyph size in world units at bone scale 1
  NumberLabel.prototype.draw = function (r, x, y, height, scale, alpha) {
    if (alpha < 0.01 || scale < 0.01) return;
    var h = height * 256 / 150 * scale, w = h * 4;
    this.color.a = alpha;
    r.batcher.setBlendMode(spine.BlendMode.Normal, false);
    r.drawTexture(this.tex, x - w / 2, y - h / 2, w, h, this.color);
  };
  NumberLabel.prototype.dispose = function () { try { this.tex.dispose(); } catch (e) { } };

  // find the number bone and the plate slot that carries it
  function popupNumber(o, id) {
    var spec = NUMBERS[id], bone = null;
    if (!spec) return null;
    o.sk.bones.forEach(function (b) { if (!bone && /money|input_number|star_number/.test(b.data.name)) bone = b; });
    if (!bone) return null;
    var plate = null;
    o.sk.slots.forEach(function (s) { if (!plate && s.bone === bone.parent) plate = s; });
    var target = spec.list ? pick(spec.list) : Math.round((spec.min + Math.random() * (spec.max - spec.min)) / 50) * 50;
    return { bone: bone, plate: plate, target: target, money: !!spec.money, count: spec.money && !spec.fixed, t: 0 };
  }

  function Slot(host, cfg) {
    this.host = host; this.cfg = cfg; this.dir = cfg.dir;
    this.low = cfg.low; this.high = cfg.high;
    this.data = {}; this.meta = {}; this.loading = {};
    this.reels = []; this.env = []; this.popup = null; this.dim = 0; this.dimTarget = 0;
    this.busy = false; this.dead = false; this.visible = true; this.token = 0;
    // a sound or UI error in the page's callback must never break the running sequence (popups on phones)
    var onState = cfg.onState || function () {};
    this.status = function (st) { try { onState(st); } catch (e) { console.error(e); } };
    this.init();
  }

  Slot.prototype.init = function () {
    var self = this;
    this.status({ phase: 'loading' });
    loadScript(this.cfg.runtime).then(function () {
      if (self.dead) return;
      var c = document.createElement('canvas');
      c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;cursor:pointer';
      c.setAttribute('aria-hidden', 'true');
      self.host.appendChild(c);
      self.canvas = c;
      self.ctx = new spine.ManagedWebGLRenderingContext(c, { alpha: true, antialias: true });
      self.renderer = new spine.SceneRenderer(c, self.ctx, true);
      self.assets = new spine.AssetManager(self.ctx, '');
      self.dimColor = new spine.Color(0.02, 0.01, 0.06, 0);
      c.addEventListener('click', function (e) { self.onClick(e); });
      if ('IntersectionObserver' in window) {
        self.io = new IntersectionObserver(function (en) { self.visible = en[0].isIntersecting; });
        self.io.observe(self.host);
      }
      var core = self.low.concat(self.high, ['scatter', 'wild']);
      // the living environment is a bonus: if one rig fails, the slot still runs without it
      var env = Object.keys(ENV).map(function (id) { return self.load(id).catch(function (e) { console.warn('env ' + id, e); }); });
      return Promise.all(core.map(function (id) { return self.load(id); }).concat(env));
    }).then(function () {
      if (self.dead) return;
      self.buildEnv();
      self.buildIdleGrid();
      self.last = performance.now();
      self.lastAction = self.last;
      self.nextAttract = self.last + 2500;
      self.loop = function (t) { if (self.dead) return; self.frame(t); self.raf = requestAnimationFrame(self.loop); };
      self.raf = requestAnimationFrame(self.loop);
      self.status({ phase: 'ready' });
      // fetch the POPUP files in the background so the button answers at once on slow phone networks
      ['bigwin', 'megawin', 'epicwin'].reduce(function (q, id) {
        return q.then(function () { if (!self.dead) return loadScript(self.dir + 'spine/' + id + '.js' + (self.cfg.ver ? '?v=' + self.cfg.ver : '')).catch(function () { }); });
      }, new Promise(function (ok) { setTimeout(ok, 1500); }));
    }).catch(function (e) {
      console.error(e);
      if (!self.dead) self.status({ phase: 'error' });
    });
  };

  Slot.prototype.load = function (id) {
    var self = this;
    if (this.data[id]) return Promise.resolve(this.data[id]);
    if (this.loading[id]) return this.loading[id];
    this.loading[id] = loadScript(this.dir + 'spine/' + id + '.js' + (this.cfg.ver ? '?v=' + this.cfg.ver : '')).then(function () {
      var e = window.HS_SPINE[id], am = self.assets;
      am.setRawDataURI(id + '.json', e.json);
      am.setRawDataURI(id + '.atlas', e.atlas);
      Object.keys(e.pages).forEach(function (p) { am.setRawDataURI(p, e.pages[p]); });
      am.loadText(id + '.json');
      am.loadTextureAtlas(id + '.atlas');
      return new Promise(function (ok, fail) {
        (function poll() {
          if (self.dead) return;
          if (am.hasErrors()) return fail(new Error(JSON.stringify(am.getErrors())));
          if (am.isLoadingComplete()) return ok();
          setTimeout(poll, 30);
        })();
      });
    }).then(function () {
      var json = new spine.SkeletonJson(new spine.AtlasAttachmentLoader(self.assets.require(id + '.atlas')));
      var data = json.readSkeletonData(self.assets.require(id + '.json'));
      self.data[id] = data;
      self.measure(id, data);
      return data;
    });
    return this.loading[id];
  };

  // Scale and offset so the symbol sits centred in a reel cell (or the Wild in its reel).
  Slot.prototype.measure = function (id, data) {
    var m = {};
    if (ENV[id]) {
      var env = ENV[id];
      Object.keys(env.shift || {}).forEach(function (b) { var bd = data.findBone(b); if (bd) { bd.x += env.shift[b][0]; bd.y += env.shift[b][1]; } });
      m.scale = 1; m.ox = 0; m.oy = 0;
    } else if (POPUPS.test(id)) {
      // popups are authored full-screen around the origin: cover the screen, never shrink
      m.scale = Math.max(W / data.width, H / data.height);
      m.ox = -(data.x + data.width / 2); m.oy = -(data.y + data.height / 2);
    } else {
      var sk = new spine.Skeleton(data), st = new spine.AnimationState(new spine.AnimationStateData(data));
      if (id === 'wild') {
        st.setAnimation(0, 'idle_big', false); st.apply(sk); sk.updateWorldTransform();
        var big = visibleBounds(sk);
        m.scale = (REEL.h * 0.985) / big.h;
        m.ox = -(big.x + big.w / 2); m.oy = -(big.y + big.h / 2);
        sk.setToSetupPose(); st.clearTracks(); st.setAnimation(0, 'idle_small', false); st.apply(sk); sk.updateWorldTransform();
        // measure the small symbol by its frame: the legs and palm are hidden by a clipping
        // mask in the small state but still count as visible and would pull the centre down
        var small = visibleBounds(sk, ['frame2', 'frame_top', 'frame_bottom', 'bg']);
        var cy = (small.y + small.h / 2 + m.oy) * m.scale;          // relative to reel centre, spine y-up
        m.row = Math.max(0, Math.min(2, Math.round(1 - cy / CH)));
      } else {
        sk.setToSetupPose(); sk.updateWorldTransform();
        var s = visibleBounds(sk);
        m.scale = Math.min(CW * 0.9 / s.w, CH * 0.9 / s.h);
        m.ox = -(s.x + s.w / 2); m.oy = -(s.y + s.h / 2);
      }
    }
    this.meta[id] = m;
  };

  Slot.prototype.inst = function (id) {
    var data = this.data[id], sk = new spine.Skeleton(data);
    // the Wild's animations are authored to chain pose-to-pose; mixing them distorts the mask and frame
    var sd = new spine.AnimationStateData(data); sd.defaultMix = id === 'wild' ? 0 : 0.15;
    if (id === 'wild') {
      // small and big states are built differently (mesh deform vs bones), so only same-size
      // transitions are mixed; small -> big never mixes and never switches mid-way
      sd.setMix('move', 'win_big', 0.25); sd.setMix('win_big', 'idle_big', 0.3); sd.setMix('win_small', 'idle_small', 0.3);
    }
    var st = new spine.AnimationState(sd);
    sk.setToSetupPose();
    return { id: id, sk: sk, st: st, m: this.meta[id], dim: 0, dimTarget: 0 };
  };

  Slot.prototype.place = function (o, x, y, stretch) {
    var m = o.m, s = m.scale;
    o.sk.scaleX = s; o.sk.scaleY = s * (stretch || 1);
    o.sk.x = x + m.ox * s; o.sk.y = y + m.oy * s * (stretch || 1);
  };

  Slot.prototype.has = function (o, name) { return !!o.sk.data.findAnimation(name); };

  // ---------- environment ----------

  Slot.prototype.buildEnv = function () {
    var self = this;
    this.env = Object.keys(ENV).filter(function (id) { return self.data[id]; }).map(function (id) {
      var o = self.inst(id), anim = o.sk.data.animations[0].name;
      o.st.setAnimation(0, anim, true).timeScale = ENV[id].speed;
      o.x = ENV[id].x; o.y = H - ENV[id].y;
      return o;
    });
    var cacti = this.env.filter(function (o) { return o.id === 'cacti'; })[0];
    var tumbleSlot = cacti && cacti.sk.findSlot('rolling field');
    if (!tumbleSlot || !cacti.sk.findBone('bone_roling')) return;
    cacti.range = [tumbleSlot.data.index + 1, cacti.sk.slots.length - 1];
    // the tumbleweed is a second instance of the same rig: slow, rare, on its own schedule
    var t = this.inst('cacti');
    t.x = cacti.x; t.y = cacti.y; t.range = [tumbleSlot.data.index, tumbleSlot.data.index]; t.active = false;
    t.bone = t.sk.findBone('bone_roling');
    this.tumble = t;
    this.nextTumble = performance.now() + between(TUMBLE.first);
  };

  Slot.prototype.drawEnv = function (dt, t) {
    var self = this, tw = this.tumble;
    if (tw && !tw.active && t > this.nextTumble && !this.popup) {
      tw.active = true;
      var e = tw.st.setAnimation(0, tw.sk.data.animations[0].name, false);
      e.timeScale = TUMBLE.speed;
      tw.entry = e;
    }
    if (tw && tw.active) {
      tw.st.update(dt); tw.st.apply(tw.sk);
      var k = Math.min(1, tw.entry.trackTime / tw.entry.animationEnd);
      tw.bone.rotation += TUMBLE.spin * k;                     // roll a little more than the source as it slows down
      tw.sk.x = tw.x; tw.sk.y = tw.y; tw.sk.updateWorldTransform();
      this.renderer.drawSkeleton(tw.sk, true, tw.range[0], tw.range[1]);
      if (k >= 1) { tw.active = false; this.nextTumble = t + between(TUMBLE.every); }
    }
    this.env.forEach(function (o) {
      o.st.update(dt); o.st.apply(o.sk);
      o.sk.x = o.x; o.sk.y = o.y; o.sk.updateWorldTransform();
      if (o.range) self.renderer.drawSkeleton(o.sk, true, o.range[0], o.range[1]);
      else self.renderer.drawSkeleton(o.sk, true);
    });
  };

  // ---------- grid & scenarios ----------

  Slot.prototype.filler = function (avoid) {
    var pool = this.low.concat(this.high).filter(function (s) { return avoid.indexOf(s) < 0; });
    return pick(pool);
  };

  // result: 5 columns x 3 rows of symbol ids, 'wild' allowed once per column
  Slot.prototype.fillResult = function (fixed, avoid) {
    var res = [];
    for (var c = 0; c < 5; c++) {
      res.push([]);
      for (var r = 0; r < 3; r++) {
        var key = c + ':' + r;
        if (fixed[key]) { res[c].push(fixed[key]); continue; }
        var left = c > 0 ? res[c - 1][r] : null, up = r > 0 ? res[c][r - 1] : null;
        res[c].push(this.filler(avoid.concat([left, up, 'scatter', 'wild'])));
      }
    }
    return res;
  };

  Slot.prototype.buildIdleGrid = function () {
    var res = [['scatter', 'A', 'Q'], ['wolf', 'K', 'gun'], ['wild', 'wild', 'wild'], ['Q', 'A', 'whiskey'], ['J', 'K', 'J']];
    this.reels = [];
    for (var c = 0; c < 5; c++) this.reels.push(this.landColumn(c, res[c], c === 2 ? 'big' : null));
    var sc = this.reels[0].cells[0];
    if (this.has(sc, 'idle')) sc.st.setAnimation(0, 'idle', true);
  };

  // A landed column: three cell instances, or one Wild covering the reel.
  Slot.prototype.landColumn = function (c, ids, wildState) {
    var col = { c: c, ids: ids, cells: [], wild: null, spin: null };
    var wr = this.meta.wild.row;
    if (ids.indexOf('wild') >= 0) {
      var w = this.inst('wild');
      w.st.setAnimation(0, wildState === 'big' ? 'idle_big' : 'idle_small', true);
      col.wild = w; col.wildBig = wildState === 'big';
    }
    for (var r = 0; r < 3; r++) {
      var id = ids[r];
      if (id === 'wild' || (col.wild && (col.wildBig || r === wr))) { col.cells.push(null); continue; }
      col.cells.push(this.inst(id));
    }
    return col;
  };

  // kind: low | high | wild | scatter | popup; pick: a symbol id for low/high
  Slot.prototype.scenario = function (kind, pick_) {
    var low = this.low, high = this.high, wr = this.meta.wild.row, self = this;
    var row = rnd(3), fixed = {}, win = [], s = { kind: kind };
    var line = function (sym, cols, r) { cols.forEach(function (k) { fixed[k + ':' + r] = sym; win.push([k, r]); }); };
    if (kind === 'popup') {
      // the POPUP button always shows a popup straight away — three examples are enough
      return { kind: 'popup', popup: pick_ || pick(['bigwin', 'megawin', 'epicwin']), noSpin: true };
    } else if (kind === 'wild') {
      var hs = pick(high);
      fixed['2:' + wr] = 'wild';
      line(hs, [0, 1, 3, 4], wr);
      s.sym = hs; s.avoid = [hs];
      s.big = this.wildBigNext = !this.wildBigNext;              // big, small, big, ...
      s.wildAnim = s.big ? 'move' : 'win_small';
    } else if (kind === 'scatter') {
      [0, 2, 4].forEach(function (k) { var r = rnd(3); fixed[k + ':' + r] = 'scatter'; win.push([k, r]); });
      s.anticipate = true;
    } else {
      var sym = pick_ || pick(kind === 'low' ? low : high);
      var n = 3 + rnd(3), cols = [];
      for (var c = 0; c < n; c++) cols.push(c);
      line(sym, cols, row);
      s.sym = sym; s.count = n; s.avoid = [sym];
      // now and then a scatter or a small Wild lands as well, so their idle/landing states show up too
      var free = function (c, r) { return !fixed[c + ':' + r]; };
      if (Math.random() < 0.35) {
        var sc = [0, 1, 2, 3, 4].filter(function (c) { return [0, 1, 2].some(function (r) { return free(c, r); }); });
        var c1 = pick(sc), rows = [0, 1, 2].filter(function (r) { return free(c1, r); });
        fixed[c1 + ':' + pick(rows)] = 'scatter';
      }
      if (Math.random() < 0.3) {
        var wc = [0, 1, 2, 3, 4].filter(function (c) { return free(c, wr) && !['0', '1', '2'].some(function (r) { return fixed[c + ':' + r] === 'scatter'; }); });
        if (wc.length) fixed[pick(wc) + ':' + wr] = 'wild';
      }
    }
    s.win = win;
    s.result = this.fillResult(fixed, s.avoid || []);
    return s;
  };

  // ---------- flow ----------

  Slot.prototype.play = function (kind, mode) {
    if (this.dead || !this.renderer || !this.reels.length) return false;
    // a new choice interrupts whatever runs: spinning reels land at once, an open popup goes away
    var self0 = this;
    if (this.reels.some(function (c) { return c.spin; })) {
      this.token++;
      this.reels.forEach(function (col) {
        if (!col.spin) return;
        var landed = self0.landColumn(col.c, col.spin.strip.slice(1, 4).map(function (id) { return id === 'wildsym' ? 'wild' : id; }), null);
        col.ids = landed.ids; col.cells = landed.cells; col.wild = landed.wild; col.wildBig = false; col.spin = null;
      });
      this.settle();
    }
    if (this.popup) this.dropPopup();                 // POPUP again: swap to a new one right away
    var s = this.scenario(kind, mode), self = this, token = ++this.token;
    if (s.noSpin) this.settle();
    this.busy = true;
    this.lastAction = performance.now();
    var popupLoad = s.popup ? this.load(s.popup) : null;
    var run = s.noSpin ? Promise.resolve() : this.spin(s, token);
    run.then(function () {
      if (token !== self.token) return;
      return s.noSpin ? null : self.showWin(s, token);
    }).then(function () {
      if (token !== self.token || !popupLoad) return;
      self.status({ phase: 'popup', s: s });
      return popupLoad.then(function () { return self.showPopup(s.popup, token); });
    }).then(function () {
      if (token !== self.token) return;
      self.settle();
      self.busy = false;
      self.lastAction = performance.now();
      self.nextAttract = self.lastAction + 3500;
      self.status({ phase: 'done', s: s });
    }).catch(function (e) { console.error(e); self.busy = false; self.status({ phase: 'error' }); });
    return true;
  };

  Slot.prototype.spin = function (s, token) {
    var self = this, now = performance.now();
    this.clearWin();
    this.status({ phase: 'spinning', s: s });
    var pool = this.low.concat(this.high);
    return Promise.all(this.reels.map(function (col, c) {
      var slow = s.anticipate && c === 4;
      var rows = 14 + c * 4 + (slow ? 14 : 0);
      // strip[0] is the overshoot row, strip[1..3] the result, the end repeats what was on screen
      var strip = [pick(pool)].concat(s.result[c].map(function (id) { return id === 'wild' ? 'wildsym' : id; }));
      var prev = col.ids.map(function (id) { return id === 'wild' ? pick(pool) : id; });
      for (var i = 0; i < rows - 4; i++) strip.push(pick(pool));
      strip = strip.concat(prev);
      col.spin = { strip: strip, from: strip.length - 3, to: 1, start: now + c * 90, dur: 900 + c * 220 + (slow ? 1100 : 0), pos: strip.length - 3,
        wildAnim: s.kind === 'wild' && c === 2 ? s.wildAnim : 'idle_small' };
      return new Promise(function (ok) { col.spin.done = ok; });
    })).then(function () { return token === self.token ? wait(180) : null; });
  };

  Slot.prototype.updateSpin = function (col, t, s) {
    var sp = col.spin, k = (t - sp.start) / sp.dur;
    if (k < 0) { sp.pos = sp.from; sp.speed = 0; return; }
    if (k >= 1) {
      var ids = sp.strip.slice(1, 4).map(function (id) { return id === 'wildsym' ? 'wild' : id; });
      var landed = this.landColumn(col.c, ids, null);
      col.ids = landed.ids; col.cells = landed.cells; col.wild = landed.wild; col.wildBig = false;
      if (col.wild && sp.wildAnim !== 'idle_small') {
        col.wild.st.setAnimation(0, sp.wildAnim, sp.wildAnim !== 'move').timeScale = 0;
      }
      col.spin = null;
      var self = this;
      col.cells.forEach(function (o) { if (o && o.id === 'scatter' && self.has(o, 'landing')) { o.st.setAnimation(0, 'landing', false); if (self.has(o, 'idle')) o.st.addAnimation(0, 'idle', true, 0); } });
      col.bounce = { start: t };
      if (this.cfg.onReelStop) this.cfg.onReelStop(col.c);
      sp.done();
      return;
    }
    // quick wind-up, steady run, back-out landing
    var e = k < 0.12 ? -0.015 * Math.sin(k / 0.12 * Math.PI) : easeOutBack((k - 0.12) / 0.88);
    sp.pos = sp.from + (sp.to - sp.from) * e;
    sp.speed = Math.abs(sp.to - sp.from) * (k < 0.12 ? 0 : 1 - (k - 0.12) / 0.88);
  };

  Slot.prototype.clearWin = function () {
    this.reels.forEach(function (col) {
      col.cells.forEach(function (o) { if (o) { o.dimTarget = 0; o.st.clearTracks(); o.sk.setToSetupPose(); } });
    });
  };

  // after a presentation: stop looping wins, undim, keep the Wild/scatter states
  Slot.prototype.settle = function () {
    this.reels.forEach(function (col) {
      col.cells.forEach(function (o) {
        if (!o) return;
        o.dimTarget = 0;
        var cur = o.st.getCurrent(0);
        if (cur && cur.animation.name === 'win') o.st.setEmptyAnimation(0, 0.3);
      });
      if (col.wild) {
        col.wild.dimTarget = 0;
        var w = col.wild.st.getCurrent(0);
        if (w && /^win_/.test(w.animation.name)) col.wild.st.setAnimation(0, col.wildBig ? 'idle_big' : 'idle_small', true);
      }
    });
  };

  Slot.prototype.dimAllBut = function (winSet, keepWild) {
    this.reels.forEach(function (col, c) {
      col.cells.forEach(function (o, r) { if (o) o.dimTarget = winSet[c + ':' + r] ? 0 : 1; });
      if (col.wild) col.wild.dimTarget = keepWild ? 0 : 1;
    });
  };

  // resolves when a queued/played track entry finishes
  function finished(entry) {
    return new Promise(function (ok) {
      var done = false, fin = function () { if (!done) { done = true; ok(); } };
      var l = entry.listener || {};
      l.complete = fin; l.interrupt = fin; l.end = fin;
      entry.listener = l;
    });
  }

  Slot.prototype.showWin = function (s, token) {
    var self = this, winSet = {};
    s.win.forEach(function (p) { winSet[p[0] + ':' + p[1]] = 1; });
    var winners = [];
    this.reels.forEach(function (col, c) { col.cells.forEach(function (o, r) { if (o && winSet[c + ':' + r]) winners.push(o); }); });
    var loopWins = function () { winners.forEach(function (o) { if (self.has(o, 'win')) o.st.setAnimation(0, 'win', true); }); };
    var alive = function () { return token === self.token; };

    if (s.kind === 'wild') {
      var col = this.reels[2], w = col.wild;
      if (!w) return wait(1500);
      this.dimAllBut(winSet, true);
      // one of the two wins: small in place, or expand over the reel and win big.
      // The Wild already sits paused on frame 0 of that animation, so it just starts playing.
      var entry = w.st.getCurrent(0);
      if (!entry || entry.animation.name !== s.wildAnim) entry = w.st.setAnimation(0, s.wildAnim, !s.big);
      entry.timeScale = 1;
      if (!s.big) {
        loopWins();
        this.status({ phase: 'win', s: s });
        return wait(3000);
      }
      this.status({ phase: 'expand', s: s });
      return finished(entry).then(function () {
        if (!alive()) return;
        col.wildBig = true; col.cells = [null, null, null];
        w.st.setAnimation(0, 'win_big', true);
        loopWins();
        self.status({ phase: 'win', s: s });
        return wait(3000);
      });
    }

    this.dimAllBut(winSet, false);
    loopWins();
    this.status({ phase: 'win', s: s });
    var longest = winners.reduce(function (m, o) { var a = o.sk.data.findAnimation('win'); return Math.max(m, a ? a.duration : 0); }, 1);
    return wait(Math.max(2400, longest * 2000));
  };

  Slot.prototype.dropPopup = function () {
    var p = this.popup;
    if (!p) return;
    clearTimeout(p.timer);
    if (p.label) p.label.dispose();
    this.popup = null;
  };

  Slot.prototype.drawPopupNumber = function (p, dt) {
    var n = p.num;
    if (!n) return;
    n.t += dt;
    var k = Math.min(1, n.t / 1.6), val = n.count ? n.target * (1 - Math.pow(1 - k, 3)) : n.target;
    p.label.set(formatNumber(val, n.money));
    p.label.draw(this.renderer, n.bone.worldX, n.bone.worldY, n.money ? 52 : 84, n.bone.getWorldScaleY(), n.plate ? n.plate.color.a : 1);
  };

  Slot.prototype.showPopup = function (id, token) {
    var self = this, p = this.inst(id);
    this.popup = p; this.dimTarget = 1;
    try {
      p.num = popupNumber(p, id);
      if (p.num) p.label = new NumberLabel(this.ctx);
    } catch (e) { console.error(e); p.num = null; }
    p.st.setAnimation(0, 'start', false);
    p.st.addAnimation(0, 'idle', true, 0);
    return new Promise(function (ok) {
      p.close = function () {
        if (p.closing) return; p.closing = true;
        var e = p.st.setAnimation(0, 'end', false);
        self.dimTarget = 0;
        setTimeout(function () { if (self.popup === p) self.dropPopup(); ok(); }, e.animation.duration * 1000 + 50);
      };
      p.timer = setTimeout(function () { if (token === self.token) p.close(); }, 5600);
    });
  };

  Slot.prototype.onClick = function (e) {
    if (this.popup && this.popup.close) { clearTimeout(this.popup.timer); this.popup.close(); return; }
    var r = this.canvas.getBoundingClientRect();
    var x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H;
    if (Math.hypot(x - SPIN_BTN.x, y - SPIN_BTN.y) < SPIN_BTN.r && this.cfg.onSpinButton) this.cfg.onSpinButton();
  };

  // While waiting, a symbol now and then plays its win once — the screen stays alive and invites a click.
  Slot.prototype.attract = function (t) {
    if (this.busy || this.popup || t - this.lastAction < 2500 || t < this.nextAttract) return;
    this.nextAttract = t + 2800 + Math.random() * 1800;
    var pool = [];
    this.reels.forEach(function (col) {
      col.cells.forEach(function (o) { var cur = o && o.st.getCurrent(0); if (o && (!cur || cur.animation.duration === 0) && o.sk.data.findAnimation('win')) pool.push(o); });
    });
    if (!pool.length) return;
    var o = pick(pool);
    o.st.setAnimation(0, 'win', false);
    o.st.addEmptyAnimation(0, 0.25, 0);
  };

  // ---------- render ----------

  Slot.prototype.resize = function () {
    var c = this.canvas, dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.round(c.clientWidth * dpr), h = Math.round(c.clientHeight * dpr);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    this.ctx.gl.viewport(0, 0, c.width, c.height);
    var cam = this.renderer.camera;
    cam.setViewport(W, H); cam.position.x = W / 2; cam.position.y = H / 2; cam.update();
  };

  Slot.prototype.tick = function (o, dt, stretch, x, y) {
    o.dim += (o.dimTarget - o.dim) * Math.min(1, dt * 8);
    var v = 1 - o.dim * 0.62;
    o.sk.color.set(v, v * 0.97, Math.min(1, v * 1.02), 1);
    o.st.update(dt); o.st.apply(o.sk);
    this.place(o, x, y, stretch);
    o.sk.updateWorldTransform();
    this.renderer.drawSkeleton(o.sk, true);
  };

  Slot.prototype.frame = function (t) {
    var dt = Math.min(0.05, (t - this.last) / 1000); this.last = t;
    if (!this.visible) return;
    var gl = this.ctx.gl, r = this.renderer, self = this;
    this.resize();
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    this.attract(t);

    var spinning = this.reels.some(function (c) { return c.spin; });
    if (spinning) {
      var sx = this.canvas.width / W, sy = this.canvas.height / H;
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(Math.round(REEL.x * sx), Math.round((H - REEL.y - REEL.h) * sy), Math.round(REEL.w * sx), Math.round(REEL.h * sy));
    }
    r.begin();
    var wilds = [], wr = this.meta.wild.row;
    this.reels.forEach(function (col, c) {
      if (col.spin) {
        self.updateSpin(col, t);
        if (col.spin) {
          var sp = col.spin, base = Math.floor(sp.pos), frac = sp.pos - base, stretch = 1 + Math.min(0.18, (sp.speed || 0) * 0.02);
          var cc = cellCenter(c, 0);
          for (var i = -1; i <= 3; i++) {
            var id = sp.strip[base + i];
            if (!id) continue;
            var y = cc.y - (i - frac) * CH;
            // the Wild travels in its small state so the symbol that lands is the one you saw spinning
            if (id === 'wildsym') self.tick(self.spinWild(sp.wildAnim), 0, 1, cc.x, y + (wr - 1) * CH);
            else self.tick(self.spinInst(id), 0, stretch, cc.x, y);
          }
          return;
        }
      }
      var bounce = 0;
      if (col.bounce) {
        var bk = (t - col.bounce.start) / 260;
        if (bk >= 1) col.bounce = null; else bounce = Math.sin(bk * Math.PI) * 10 * (1 - bk);
      }
      col.cells.forEach(function (o, rr) { if (o) { var p = cellCenter(c, rr); self.tick(o, dt, 1, p.x, p.y - bounce); } });
      if (col.wild) wilds.push([col, c, bounce]);
    });
    r.end();
    if (spinning) gl.disable(gl.SCISSOR_TEST);

    r.begin();
    wilds.forEach(function (w) { var p = cellCenter(w[1], 1); self.tick(w[0].wild, dt, 1, p.x, p.y - w[2]); });
    this.drawEnv(dt, t);
    this.dim += (this.dimTarget - this.dim) * Math.min(1, dt * 6);
    if (this.dim > 0.01) { this.dimColor.a = this.dim * 0.62; r.rect(true, 0, 0, W, H, this.dimColor); }
    if (this.popup) { this.tick(this.popup, dt, 1, W / 2, H / 2); this.drawPopupNumber(this.popup, dt); }
    r.end();
  };

  Slot.prototype.spinInst = function (id) {
    this.spinPool = this.spinPool || {};
    if (!this.spinPool[id]) { var o = this.inst(id); o.st.clearTracks(); this.spinPool[id] = o; }
    return this.spinPool[id];
  };

  // The Wild spins in the first frame of the animation it will play after landing, so nothing switches.
  Slot.prototype.spinWild = function (anim) {
    this.wildSpin = this.wildSpin || {};
    if (!this.wildSpin[anim]) { var o = this.inst('wild'); o.st.setAnimation(0, anim, anim !== 'move').timeScale = 0; this.wildSpin[anim] = o; }
    return this.wildSpin[anim];
  };

  Slot.prototype.destroy = function () {
    this.dead = true; this.token++;
    cancelAnimationFrame(this.raf);
    if (this.io) this.io.disconnect();
    if (this.popup) clearTimeout(this.popup.timer);
    if (this.canvas) {
      var ext = this.ctx && this.ctx.gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
      this.canvas.remove();
    }
  };

  window.HSSlot = {
    create: function (host, cfg) {
      var s = new Slot(host, cfg);
      return { play: function (k, m) { return s.play(k, m); }, isBusy: function () { return s.busy; }, destroy: function () { s.destroy(); } };
    }
  };
})();
