/* Configurable slot demo engine (Spine 4.1 via the spine-player bundle).
 * One WebGL canvas draws reel symbols, characters and popups over CSS background
 * layers (base and bonus), so a scene has one GL context and no duplicated backgrounds.
 *
 * window.HSSlotEngine.create(host, cfg) -> { play(kind, pick), destroy() }
 * cfg: { dir, ns, ver, runtime, W, H, reel:{x,y,w,h}, spinBtn:{x,y,r}, low:[], high:[],
 *        bg:{base, bonus}, chars:{base:{id,x,y,scale}, bonus:{...}}, bonusSpins,
 *        popups:[ids], idleGrid:[[...]x5], onState(st), onSpinButton() }
 * kinds: low | high (pick = symbol id), wild, scatter (wins and starts the bonus round), popup,
 *        special (pick = coin | coins | bomb | x2, x3 …)
 * grid: cols × rows (default 5 × 3); win: 'lines' (n of a kind from the left) or 'cluster'
 *       (pays anywhere, optional cascade with a boom effect)
 * extras: specials:[ids on the reels], coins:[Hold&Win coin ids], jackpots:{coinId:{id,x,y}},
 *         env:[{id,x,y,speed}] living background pieces, extraIds:[preloaded effect ids]
 */
(function () {
  'use strict';

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
  function wait(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }
  function easeOutBack(t) { var s = 1.15, u = t - 1; return 1 + (s + 1) * u * u * u + s * u * u; }
  function easeOutBounce(t) {
    if (t < 1 / 2.75) return 7.5625 * t * t;
    if (t < 2 / 2.75) { t -= 1.5 / 2.75; return 7.5625 * t * t + 0.75; }
    if (t < 2.5 / 2.75) { t -= 2.25 / 2.75; return 7.5625 * t * t + 0.9375; }
    t -= 2.625 / 2.75; return 7.5625 * t * t + 0.984375;
  }
  function range(n) { var a = []; for (var i = 0; i < n; i++) a.push(i); return a; }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = rnd(i + 1), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  // Bounds of what is actually visible: skips hidden slots, which Skeleton.getBounds counts.
  function visibleBounds(sk) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, buf = new Float32Array(1024);
    sk.drawOrder.forEach(function (slot) {
      if (!slot.bone.active || slot.color.a < 0.05) return;
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

  function finished(entry) {
    return new Promise(function (ok) {
      var done = false, fin = function () { if (!done) { done = true; ok(); } };
      var l = entry.listener || {};
      l.complete = fin; l.interrupt = fin; l.end = fin;
      entry.listener = l;
    });
  }

  // ---------- popup numbers ----------
  // Win amounts / spin counts drawn on the popup's number bone (bone_money, bone_input_number,
  // bone_main_star_number). The text is rendered to a 2D canvas, uploaded as a texture and drawn
  // at the bone's world position and scale, faded with the plate it sits on.
  var NUMBERS = {
    bigwin: { min: 20000, max: 60000, money: true }, megawin: { min: 60000, max: 250000, money: true },
    epicwin: { min: 250000, max: 900000, money: true }, bonustotal: { min: 30000, max: 150000, money: true },
    bonusspins: { list: [8, 10, 12, 15] }, buybonus: { list: [100000], money: true, fixed: true },
    win: { min: 2000, max: 9000, money: true }, superwin: { min: 60000, max: 150000, money: true },
    sensational: { min: 300000, max: 600000, money: true }, maxwin: { min: 900000, max: 1000000, money: true },
    totalwin: { min: 30000, max: 150000, money: true }
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
  function popupNumber(o, id, at) {
    var spec = NUMBERS[id], bone = null;
    if (!spec) return null;
    o.sk.bones.forEach(function (b) { if (!bone && /money|input_number|star_number|numb/.test(b.data.name)) bone = b; });
    // no dedicated number bone: the text sits on the input plate's own bone (bone_input / input)
    var own = !bone;
    if (own) o.sk.bones.forEach(function (b) { if (!bone && /^(bone_)?input$/.test(b.data.name)) bone = b; });
    // no number bone in the rig: an empty plate at a known offset from the popup's origin
    if (!bone && at) bone = { worldX: 0, worldY: 0, at: at, getWorldScaleY: function () { return o.sk.scaleY; } };
    if (!bone) return null;
    var plate = null, host = own ? bone : bone.parent;
    o.sk.slots.forEach(function (s) { if (!plate && s.bone === host) plate = s; });
    var target = spec.list ? pick(spec.list) : Math.round((spec.min + Math.random() * (spec.max - spec.min)) / 50) * 50;
    return { bone: bone, plate: plate, target: target, money: !!spec.money, count: spec.money && !spec.fixed, t: 0 };
  }

  function Engine(host, cfg) {
    this.host = host; this.cfg = cfg;
    this.W = cfg.W; this.H = cfg.H; this.R = cfg.reel;
    this.cols = cfg.cols || 5; this.rows = cfg.rows || 3;
    this.CW = this.R.w / this.cols; this.CH = this.R.h / this.rows;
    this.low = cfg.low; this.high = cfg.high; this.popupIds = cfg.popups || [];
    this.specials = cfg.specials || ['wild', 'scatter'];
    this.cluster = cfg.win === 'cluster';
    this.effects = []; this.env = []; this.jackpots = {};
    this.data = {}; this.meta = {}; this.loading = {}; this.pma = {};
    this.reels = []; this.chars = {}; this.popup = null; this.dim = 0; this.dimTarget = 0;
    this.mode = 'base'; this.busy = false; this.locked = false; this.dead = false; this.visible = true; this.token = 0;
    // a sound or UI error in the page's callback must never break the running sequence (popups on phones)
    var onState = cfg.onState || function () {};
    this.status = function (st) { try { onState(st); } catch (e) { console.error(e); } };
    this.init();
  }
  var P = Engine.prototype;

  P.cell = function (c, r) { return { x: this.R.x + this.CW * (c + 0.5), y: this.H - (this.R.y + this.CH * (r + 0.5)) }; };

  P.init = function () {
    var self = this, cfg = this.cfg;
    this.status({ phase: 'loading' });
    // background layers: base is the page's own background; bonus fades in over it
    if (cfg.bg && cfg.bg.bonus) {
      var b = document.createElement('div');
      b.style.cssText = 'position:absolute;inset:0;background:url("' + cfg.bg.bonus + '") center/100% 100% no-repeat;opacity:0;transition:opacity .9s ease;pointer-events:none';
      this.host.appendChild(b);
      this.bonusLayer = b;
    }
    loadScript(cfg.runtime).then(function () {
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
      var bgLoad = cfg.bgPack ? self.loadBackgrounds() : Promise.resolve();
      var jp = Object.keys(cfg.jackpots || {}).map(function (k) { return cfg.jackpots[k].id; });
      var env = (cfg.env || []).map(function (e) { return e.id; });
      var ids = self.low.concat(self.high, self.specials, cfg.coins || [], cfg.extraIds || [], jp, env);
      var chars = Object.keys(cfg.chars || {}).map(function (k) { return cfg.chars[k].id; });
      var scene = Object.keys(cfg.scene || {}).map(function (k) { return cfg.scene[k].id; });
      var paint = cfg.paint ? loadScript(cfg.dir + 'paint.js' + (cfg.ver ? '?v=' + cfg.ver : '')).then(function () { self.buildPaint(); }) : null;
      return Promise.all(ids.concat(chars, scene).map(function (id) { return self.load(id); }).concat([bgLoad, paint]));
    }).then(function () {
      if (self.dead) return;
      self.buildChars();
      self.scene = self.buildModeSet(cfg.scene);
      self.buildEnv();
      self.buildIdleGrid();
      self.last = performance.now();
      self.lastAction = self.last; self.nextAttract = self.last + 2500;
      self.loop = function (t) { if (self.dead) return; self.frame(t); self.raf = requestAnimationFrame(self.loop); };
      self.raf = requestAnimationFrame(self.loop);
      self.status({ phase: 'ready' });
      self.prefetchPopups();
    }).catch(function (e) { console.error(e); if (!self.dead) self.status({ phase: 'error' }); });
  };

  // only the script (data) is fetched here; textures go to the GPU when a popup is actually shown
  P.prefetchPopups = function () {
    var self = this, ver = this.cfg.ver ? '?v=' + this.cfg.ver : '';
    (this.popupIds || []).reduce(function (q, id) {
      return q.then(function () { if (!self.dead) return loadScript(self.cfg.dir + 'spine/' + id + '.js' + ver).catch(function () { }); });
    }, new Promise(function (ok) { setTimeout(ok, 1500); }));
  };

  P.load = function (id) {
    var self = this;
    if (this.data[id]) return Promise.resolve(this.data[id]);
    if (this.loading[id]) return this.loading[id];
    var src = this.cfg.dir + 'spine/' + id + '.js' + (this.cfg.ver ? '?v=' + this.cfg.ver : '');
    this.loading[id] = loadScript(src).then(function () {
      var e = window.HS_SPINE[self.cfg.ns ? self.cfg.ns + '/' + id : id], am = self.assets;
      // HS_SPINE is shared between projects; namespace the asset keys by project folder
      var key = self.cfg.dir + id;
      am.setRawDataURI(key + '.json', e.json);
      am.setRawDataURI(key + '.atlas', e.atlas);
      Object.keys(e.pages).forEach(function (p) { am.setRawDataURI(self.cfg.dir + p, e.pages[p]); });
      am.loadText(key + '.json');
      am.loadTextureAtlas(key + '.atlas');
      return new Promise(function (ok, fail) {
        (function poll() {
          if (self.dead) return;
          if (am.hasErrors()) return fail(new Error(JSON.stringify(am.getErrors())));
          if (am.isLoadingComplete()) return ok(key);
          setTimeout(poll, 30);
        })();
      });
    }).then(function (key) {
      var atlas = self.assets.require(key + '.atlas');
      var json = new spine.SkeletonJson(new spine.AtlasAttachmentLoader(atlas));
      var data = json.readSkeletonData(self.assets.require(key + '.json'));
      self.data[id] = data;
      // exports differ: some atlases are premultiplied (pma:true), others straight alpha
      self.pma[id] = atlas.pages.some(function (pg) { return pg.pma; });
      self.measure(id, data);
      return data;
    });
    return this.loading[id];
  };

  // Background images drawn inside WebGL. Glows use additive blending; over a transparent
  // canvas (CSS background behind it) browsers drop that light, so the scene must be opaque.
  P.loadBackgrounds = function () {
    var self = this, cfg = this.cfg, am = this.assets;
    return loadScript(cfg.dir + 'bg.js' + (cfg.ver ? '?v=' + cfg.ver : '')).then(function () {
      self.bgTex = {};
      var keys = ['base', 'bonus'].filter(function (k) { return window.HS_IMG && window.HS_IMG[cfg.ns + '/' + k]; });
      keys.forEach(function (k) { am.setRawDataURI(cfg.dir + 'bg-' + k, window.HS_IMG[cfg.ns + '/' + k]); am.loadTexture(cfg.dir + 'bg-' + k); });
      return new Promise(function (ok) {
        (function poll() {
          if (self.dead) return;
          if (am.isLoadingComplete() || am.hasErrors()) {
            // the runtime files raw data URIs under the URI itself, not under the alias path
            keys.forEach(function (k) {
              var uri = window.HS_IMG[cfg.ns + '/' + k];
              try { self.bgTex[k] = am.require(cfg.dir + 'bg-' + k); } catch (e) { try { self.bgTex[k] = am.require(uri); } catch (e2) { } }
            });
            return ok();
          }
          setTimeout(poll, 30);
        })();
      }).then(function () { return self.loadFrameArt(); });
    }).catch(function (e) { console.warn('backgrounds', e); });
  };

  // Layout frame exported from the PSD as JPEG colour + PNG alpha mask (a fraction of an RGBA
  // PNG's weight): HS_IMG["<ns>/frame"] and HS_IMG["<ns>/frame_mask"], joined on a 2D canvas.
  // Also: HS_IMG["<ns>/bonus_front_mask"] cuts a foreground piece out of the bonus backdrop itself
  // (e.g. the front of a brazier) that is drawn over the scene rigs, so flames sit inside it.
  P.loadFrameArt = function () {
    var self = this, img = window.HS_IMG || {}, ns = this.cfg.ns;
    function load(src) { return new Promise(function (ok, no) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = no; i.src = src; }); }
    function join(colour, mask) {
      return Promise.all([load(colour), load(mask)]).then(function (ims) {
        var c = document.createElement('canvas'); c.width = self.W; c.height = self.H;
        var g = c.getContext('2d');
        g.drawImage(ims[1], 0, 0, self.W, self.H);
        var m = g.getImageData(0, 0, self.W, self.H);
        g.clearRect(0, 0, self.W, self.H); g.drawImage(ims[0], 0, 0, self.W, self.H);
        var d = g.getImageData(0, 0, self.W, self.H);
        for (var i = 3; i < d.data.length; i += 4) d.data[i] = m.data[i - 3];
        g.putImageData(d, 0, 0);
        return new spine.GLTexture(self.ctx, c, false);
      });
    }
    var jobs = [];
    if (img[ns + '/frame'] && img[ns + '/frame_mask']) jobs.push(join(img[ns + '/frame'], img[ns + '/frame_mask']).then(function (t) { self.frameTex = t; }));
    if (img[ns + '/bonus'] && img[ns + '/bonus_front_mask']) jobs.push(join(img[ns + '/bonus'], img[ns + '/bonus_front_mask']).then(function (t) { self.bonusFrontTex = t; }));
    return Promise.all(jobs);
  };

  P.drawBackground = function (dt) {
    var tex = this.bgTex || {}, r = this.renderer;
    this.bonusMix = this.bonusMix || 0;
    this.bonusMix += ((this.mode === 'bonus' ? 1 : 0) - this.bonusMix) * Math.min(1, dt * 2.2);
    if (!tex.base) {
      if (!this.paint || !this.paint.back) return false;
      r.begin(); this.drawPaint('back'); r.end();
      return true;
    }
    this.bgColor = this.bgColor || new spine.Color(1, 1, 1, 1);
    r.begin();
    r.batcher.setBlendMode(spine.BlendMode.Normal, false);
    this.bgColor.a = 1; r.drawTexture(tex.base, 0, 0, this.W, this.H, this.bgColor);
    if (tex.bonus && this.bonusMix > 0.005) { this.bgColor.a = this.bonusMix; r.drawTexture(tex.bonus, 0, 0, this.W, this.H, this.bgColor); }
    this.drawPaint('mid');
    r.end();
    return true;
  };

  P.measure = function (id, data) {
    var m = {}, W = this.W, H = this.H;
    if (this.popupIds.indexOf(id) >= 0) {
      // popups are authored full-screen around the skeleton origin
      m.scale = this.cfg.popupScale || Math.max(W / data.width, H / data.height); m.ox = 0; m.oy = 0;
    } else if (this.cfg.symbolScale) {
      // symbols keep the scale and centre authored in Spine — one size system for all of them
      m.scale = this.cfg.symbolScale; m.ox = 0; m.oy = 0;
    } else {
      var sk = new spine.Skeleton(data);
      sk.setToSetupPose(); sk.updateWorldTransform();
      var s = visibleBounds(sk);
      m.scale = Math.min(this.CW * 0.92 / s.w, this.CH * 0.92 / s.h);
      m.ox = -(s.x + s.w / 2); m.oy = -(s.y + s.h / 2);
    }
    this.meta[id] = m;
  };

  P.inst = function (id) {
    var data = this.data[id], sk = new spine.Skeleton(data);
    var sd = new spine.AnimationStateData(data); sd.defaultMix = 0.15;
    var st = new spine.AnimationState(sd);
    sk.setToSetupPose();
    return { id: id, sk: sk, st: st, m: this.meta[id], pma: this.pma[id] !== false, dim: 0, dimTarget: 0 };
  };

  P.has = function (o, name) { return !!o.sk.data.findAnimation(name); };

  // the symbol's win animation: 'win', or one of its variants (win_1, win_2 ...)
  P.winAnim = function (o) {
    if (this.has(o, 'win')) return 'win';
    if (this.has(o, 'trigger')) return 'trigger';
    var v = o.sk.data.animations.filter(function (a) { return /^win/.test(a.name); });
    if (v.length) return pick(v).name;
    // small_win / big_win pairs: the small one is the symbol's own size; a lone 'animation' is its win
    var w = o.sk.data.findAnimation('small_win') || o.sk.data.animations.filter(function (a) { return /win/.test(a.name); })[0];
    if (w) return w.name;
    return o.sk.data.animations.length === 1 ? o.sk.data.animations[0].name : null;
  };

  // ---------- characters ----------

  // one looping rig per game mode (base / bonus), cross-faded when the mode changes
  P.buildModeSet = function (cfgSet) {
    var self = this, out = {};
    Object.keys(cfgSet || {}).forEach(function (mode) {
      var c = cfgSet[mode];
      // shift: {bone: [dx, dy]} moves parts of the rig in its setup pose (layout px, y down)
      Object.keys(c.shift || {}).forEach(function (b) {
        var bd = self.data[c.id].findBone(b);
        if (bd && !bd.hsShifted) { bd.x += c.shift[b][0]; bd.y -= c.shift[b][1]; bd.hsShifted = true; }
      });
      var o = self.inst(c.id);
      o.st.setAnimation(0, o.sk.data.animations[0].name, true);
      o.x = c.x; o.y = self.H - c.y; o.scale = c.scale || 1;
      o.alpha = mode === 'base' ? 1 : 0;
      out[mode] = o;
    });
    return out;
  };

  P.buildChars = function () { this.chars = this.buildModeSet(this.cfg.chars); };

  P.drawChars = function (dt) { this.drawModeSet(this.chars, dt); };

  // Layers painted in code (reel panel, frame, backdrop) when the layout has no art for them:
  // projects/<p>/paint.js registers HS_PAINT[ns](layer, mode, ctx2d, cfg) -> true if it drew.
  P.buildPaint = function () {
    var self = this, fn = window.HS_PAINT && window.HS_PAINT[this.cfg.ns];
    this.paint = {};
    if (!fn) return;
    // 'mid' sits on the painted backdrop under the scene rigs (e.g. a body for a rig that is only a head)
    ['back', 'mid', 'under', 'over'].forEach(function (layer) {
      ['base', 'bonus'].forEach(function (mode) {
        var c = document.createElement('canvas'); c.width = self.W; c.height = self.H;
        if (fn(layer, mode, c.getContext('2d'), self.cfg)) (self.paint[layer] = self.paint[layer] || {})[mode] = new spine.GLTexture(self.ctx, c, false);
      });
    });
  };

  P.drawPaint = function (layer) {
    var set = this.paint && this.paint[layer], r = this.renderer;
    if (!set) return;
    this.paintColor = this.paintColor || new spine.Color(1, 1, 1, 1);
    var mix = this.bonusMix || 0;
    r.batcher.setBlendMode(spine.BlendMode.Normal, false);
    // a 'mid' piece drawn for one mode only fades out in the other
    var only = layer === 'mid';
    if (set.base && (!set.bonus || mix < 0.995)) { this.paintColor.a = set.bonus || only ? 1 - mix : 1; if (this.paintColor.a > 0.005) r.drawTexture(set.base, 0, 0, this.W, this.H, this.paintColor); }
    if (set.bonus && mix > 0.005) { this.paintColor.a = mix; r.drawTexture(set.bonus, 0, 0, this.W, this.H, this.paintColor); }
  };

  P.drawModeSet = function (set, dt) {
    var self = this, k = Math.min(1, dt * 2.5);
    Object.keys(set).forEach(function (mode) {
      var o = set[mode], target = self.mode === mode ? 1 : 0;
      o.alpha += (target - o.alpha) * k;
      if (o.alpha < 0.01) return;
      o.st.update(dt); o.st.apply(o.sk);
      o.sk.color.a = o.alpha;
      o.sk.x = o.x; o.sk.y = o.y; o.sk.scaleX = o.sk.scaleY = o.scale;
      o.sk.updateWorldTransform();
      self.renderer.drawSkeleton(o.sk, o.pma);
    });
  };

  // living background pieces and jackpot plates: scale 1 at their layout positions
  P.buildEnv = function () {
    var self = this, cfg = this.cfg;
    this.env = (cfg.env || []).map(function (e) {
      var o = self.inst(e.id), a = o.sk.data.animations[0];
      if (a) o.st.setAnimation(0, a.name, true).timeScale = e.speed || 1;
      o.x = e.x; o.y = self.H - e.y; return o;
    });
    Object.keys(cfg.jackpots || {}).forEach(function (k) {
      var j = cfg.jackpots[k], o = self.inst(j.id);
      o.x = j.x; o.y = self.H - j.y; self.jackpots[k] = o;
    });
  };

  P.drawEnv = function (dt) {
    var self = this, list = this.env.concat(Object.keys(this.jackpots).map(function (k) { return self.jackpots[k]; }));
    list.forEach(function (o) {
      o.st.update(dt); o.st.apply(o.sk);
      o.sk.x = o.x; o.sk.y = o.y; o.sk.scaleX = o.sk.scaleY = 1;
      o.sk.updateWorldTransform();
      self.renderer.drawSkeleton(o.sk, o.pma);
    });
  };

  P.setMode = function (mode) {
    this.mode = mode;
    if (this.bonusLayer) this.bonusLayer.style.opacity = mode === 'bonus' ? '1' : '0';
  };

  // ---------- grid & scenarios ----------

  P.filler = function (avoid) {
    var pool = this.low.concat(this.high).filter(function (s) { return avoid.indexOf(s) < 0; });
    return pick(pool);
  };

  P.fillResult = function (fixed, avoid) {
    var res = [];
    for (var c = 0; c < this.cols; c++) {
      res.push([]);
      for (var r = 0; r < this.rows; r++) {
        var key = c + ':' + r;
        if (fixed[key]) { res[c].push(fixed[key]); continue; }
        var left = c > 0 ? res[c - 1][r] : null, up = r > 0 ? res[c][r - 1] : null;
        res[c].push(this.filler(avoid.concat([left, up])));
      }
    }
    return res;
  };

  P.buildIdleGrid = function () {
    var g = this.cfg.idleGrid, self = this;
    this.reels = g.map(function (ids, c) { return { c: c, ids: ids, cells: ids.map(function (id) { return self.inst(id); }) }; });
  };

  P.scenario = function (kind, sel) {
    var self = this, C = this.cols, Rw = this.rows, row = rnd(Rw), fixed = {}, win = [], s = { kind: kind };
    var put = function (id, c, r, isWin) { fixed[c + ':' + r] = id; if (isWin) win.push([c, r]); };
    var free = function (c, r) { return !fixed[c + ':' + r]; };
    var freeSpots = function () { var a = []; range(C).forEach(function (c) { range(Rw).forEach(function (r) { if (free(c, r)) a.push([c, r]); }); }); return shuffle(a); };
    var line = function (sym, n, r) { range(n).forEach(function (c) { put(sym, c, r, true); }); };
    var cluster = function (sym, k) { freeSpots().slice(0, k).forEach(function (p) { put(sym, p[0], p[1], true); }); };
    var lineLen = function () { return C <= 3 ? C : 3 + rnd(C - 2); };
    var clusterLen = function () { return 8 + rnd(5); };
    var extra = function (id, chance) {
      if (self.specials.indexOf(id) < 0 && !/^x\d/.test(id) || Math.random() >= chance) return;
      var p = freeSpots()[0]; if (p) put(id, p[0], p[1], false);
    };
    var mults = this.specials.filter(function (id) { return /^x\d+$/.test(id); });
    var addMult = function (id) { var p = freeSpots()[0]; if (!p) return; put(id, p[0], p[1], true); s.mult = (s.mult || 0) + parseInt(id.slice(1), 10); };
    if (kind === 'popup') {
      // the POPUP button always shows a popup straight away, from a short example pool
      return { kind: 'popup', popup: sel || pick(this.cfg.popupPool || this.popupIds), noSpin: true };
    }
    if (kind === 'wild') {
      var hs = pick(this.high);
      if (this.cluster) { cluster(hs, clusterLen() - 2); var w = freeSpots().slice(0, 2); w.forEach(function (p) { put('wild', p[0], p[1], true); }); }
      else { var n = C, mid = C >> 1; range(n).forEach(function (c) { put(c === mid ? 'wild' : hs, c, row, true); }); }
      s.sym = hs; s.avoid = [hs];
    } else if (kind === 'scatter') {
      if (this.cluster) freeSpots().slice(0, 4).forEach(function (p) { put('scatter', p[0], p[1], true); });
      else [0, C >> 1, C - 1].forEach(function (c) { put('scatter', c, rnd(Rw), true); });
      s.anticipate = true; s.scatterWin = true;
      if (this.cfg.bonusRound !== false && (this.cfg.chars && this.cfg.chars.bonus || this.cfg.bonusRound)) { s.popup = this.hasPopup('bonusspins') ? 'bonusspins' : null; s.bonusRound = true; }
    } else if (kind === 'special') {
      var id = sel || pick(this.specials.filter(function (x) { return x !== 'wild' && x !== 'scatter'; }).concat(this.cfg.coins ? ['coins'] : []));
      s.special = id;
      if (/^x\d+$/.test(id)) {
        var lw = pick(this.low); cluster(lw, Math.min(clusterLen(), C * Rw - 1)); addMult(id);
        s.sym = lw; s.count = win.length - 1; s.avoid = [lw];
      } else if (id === 'bomb') {
        var bw = pick(this.low); cluster(bw, Math.min(clusterLen(), C * Rw - 1)); var bp = freeSpots()[0]; if (bp) put('bomb', bp[0], bp[1], true);
        s.sym = bw; s.count = win.length - 1; s.avoid = [bw];
      } else if (id === 'coins') {
        // Hold & Win: a handful of coins, the best one lights its jackpot plate
        var coins = this.cfg.coins, k = 3 + rnd(3), spots = freeSpots().slice(0, k);
        var jpCoins = coins.filter(function (c) { return self.cfg.jackpots && self.cfg.jackpots[c]; });
        spots.forEach(function (p, i) { put(i === 0 && jpCoins.length ? pick(jpCoins) : pick(coins), p[0], p[1], true); });
        var order = ['coin_grand', 'coin_major', 'coin_minor', 'coin_mini'];
        s.jackpot = order.filter(function (c) { return spots.some(function (p) { return fixed[p[0] + ':' + p[1]] === c; }); })[0];
        s.count = k;
      } else {
        // collect symbol (e.g. a coin): three to five land and win together
        var kc = Math.min(C, 3 + rnd(3));
        shuffle(range(C)).slice(0, kc).forEach(function (c) { put(id, c, rnd(Rw), true); });
        s.count = kc;
      }
    } else {
      var sym = sel || pick(kind === 'low' ? this.low : this.high);
      if (this.cluster) {
        cluster(sym, clusterLen()); s.count = win.length;
        if (mults.length && Math.random() < 0.4) addMult(pick(mults));
        extra('scatter', 0.25);
      } else {
        var len = lineLen(); line(sym, len, row); s.count = len;
        // now and then a scatter or a Wild lands too, so their landing shows up in normal play
        extra('scatter', 0.3); extra('wild', 0.25);
      }
      s.sym = sym; s.avoid = [sym];
    }
    s.win = win;
    s.result = this.fillResult(fixed, (s.avoid || []).concat(this.specials, this.cfg.coins || []));
    return s;
  };

  // ---------- flow ----------

  P.hasPopup = function (id) { return (this.popupIds || []).indexOf(id) >= 0; };

  // Stop whatever is running (spins, free spins, popups, cascades) and leave a calm base game,
  // so a newly chosen element starts at once.
  P.interrupt = function () {
    var self = this;
    this.token++;
    this.reels.forEach(function (col) {
      if (col.spin) { col.ids = col.spin.strip.slice(1, 1 + self.rows); col.cells = col.ids.map(function (id) { return self.inst(id); }); col.spin = null; }
      col.bounce = null;
      col.cells.forEach(function (o) { o.gone = false; o.drop = null; });
    });
    this.effects = []; this.snow = [];
    if (this.popup) this.dropPopup();
    this.dimTarget = 0;
    Object.keys(this.jackpots).forEach(function (k) { self.jackpots[k].st.setEmptyAnimation(0, 0.2); });
    this.setMode('base');
    this.locked = false; this.busy = false;
    this.settle();
  };

  P.play = function (kind, sel) {
    if (this.dead || !this.renderer || !this.reels.length) return false;
    if (kind === 'popup' && !(this.popupIds || []).length) return false;
    if ((kind === 'scatter' || kind === 'wild') && this.specials.indexOf(kind) < 0) kind = 'high';   // game has no such symbol
    var running = this.locked || this.reels.some(function (c) { return c.spin; }) || (this.popup && kind !== 'popup');
    if (running) this.interrupt();                    // a new choice always wins over the running sequence
    if (this.popup) this.dropPopup();                 // POPUP again: swap to a new one right away
    var s = this.scenario(kind, sel), self = this, token = ++this.token;
    if (s.noSpin) this.settle();
    this.busy = true; this.lastAction = performance.now();
    var popupLoad = s.popup ? this.load(s.popup) : null;
    var totalId = this.cfg.totalPopup || 'bonustotal', totalLoad = s.bonusRound && this.hasPopup(totalId) ? this.load(totalId) : Promise.resolve();
    (s.noSpin ? Promise.resolve() : this.spin(s, token)).then(function () {
      if (token !== self.token || s.noSpin) return;
      return self.showWin(s, token);
    }).then(function () {
      if (token !== self.token || !popupLoad) return;
      self.status({ phase: 'popup', s: s });
      return popupLoad.then(function () { return self.showPopup(s.popup, token); });
    }).then(function () {
      if (token !== self.token || !s.bonusRound) return;
      return totalLoad.then(function () { return self.bonusRound(token); });
    }).then(function () {
      if (token !== self.token) return;
      self.settle();
      self.busy = false; self.locked = false;
      self.lastAction = performance.now(); self.nextAttract = self.lastAction + 3500;
      self.status({ phase: 'done', s: s });
    }).catch(function (e) { console.error(e); self.busy = false; self.locked = false; self.setMode('base'); self.status({ phase: 'error' }); });
    return true;
  };

  // Free spins in the bonus scene, then the total-win popup and back to the base game.
  P.bonusRound = function (token) {
    var self = this, n = Math.min(this.cfg.bonusSpins || 2, 2), i = 0;   // short demo: at most 2 free spins
    this.locked = true;
    this.setMode('bonus');
    var next = function () {
      if (token !== self.token) return;
      if (i >= n) {
        var total = self.cfg.totalPopup || 'bonustotal';
        if (!self.hasPopup(total)) { self.setMode('base'); return wait(900); }
        self.status({ phase: 'popup', s: { kind: 'popup', popup: total } });
        return self.showPopup(total, token).then(function () { self.setMode('base'); return wait(600); });
      }
      i++;
      var s = self.scenario(Math.random() < 0.5 ? 'low' : 'high');
      if (self.specials.indexOf('wild') >= 0 && Math.random() < 0.35) s = self.scenario('wild');
      s.bonus = { i: i, n: n };
      return wait(i === 1 ? 900 : 350).then(function () { return token === self.token && self.spin(s, token); })
        .then(function () { return token === self.token && self.showWin(s, token); })
        .then(function () { if (token !== self.token) return; self.settle(); return next(); });
    };
    return next();
  };

  P.spin = function (s, token) {
    if (token !== this.token) return Promise.resolve();          // an interrupted sequence never starts new spins
    var self = this, now = performance.now(), pool = this.low.concat(this.high);
    this.clearWin();
    this.status({ phase: 'spinning', s: s });
    return Promise.all(this.reels.map(function (col, c) {
      var slow = s.anticipate && c === self.cols - 1;
      var rows = 14 + c * 4 + (slow ? 14 : 0);
      var strip = [pick(pool)].concat(s.result[c]);
      for (var i = 0; i < rows - 4; i++) strip.push(pick(pool));
      strip = strip.concat(col.ids);
      var R = self.rows, step = Math.max(110, 220 - (self.cols - 5) * 40);
      col.spin = { strip: strip, from: strip.length - R, to: 1, start: now + c * 90, dur: 900 + c * step + (slow ? 1100 : 0), pos: strip.length - R };
      return new Promise(function (ok) { col.spin.done = ok; });
    })).then(function () { return token === self.token ? wait(180) : null; });
  };

  P.updateSpin = function (col, t) {
    var sp = col.spin, k = (t - sp.start) / sp.dur, self = this;
    if (k < 0) { sp.pos = sp.from; sp.speed = 0; return; }
    if (k >= 1) {
      col.ids = sp.strip.slice(1, 1 + this.rows);
      col.cells = col.ids.map(function (id) { return self.inst(id); });
      // landing plays only as special symbols drop; they then rest in their setup pose
      col.cells.forEach(function (o) {
        if (self.has(o, 'landing')) { o.st.setAnimation(0, 'landing', false); o.st.addEmptyAnimation(0, 0.2, 0); }
      });
      col.spin = null; col.bounce = { start: t };
      if (this.cfg.onReelStop) this.cfg.onReelStop(this.reels.indexOf(col));
      sp.done();
      return;
    }
    var e = k < 0.12 ? -0.015 * Math.sin(k / 0.12 * Math.PI) : easeOutBack((k - 0.12) / 0.88);
    sp.pos = sp.from + (sp.to - sp.from) * e;
    sp.speed = Math.abs(sp.to - sp.from) * (k < 0.12 ? 0 : 1 - (k - 0.12) / 0.88);
  };

  P.clearWin = function () {
    this.reels.forEach(function (col) { col.cells.forEach(function (o) { o.dimTarget = 0; o.st.clearTracks(); o.sk.setToSetupPose(); o.sk.slots.forEach(function (sl) { sl.sequenceIndex = -1; }); }); });
  };

  P.finishCycle = function (o) {
    var cur = o.st.getCurrent(0);
    if (!cur || cur.next) return;
    var d = cur.animationEnd - cur.animationStart;
    if (!(d > 0)) { o.st.setEmptyAnimation(0, 0); return; }
    // rest exactly when the running cycle ends (delay counts from the entry's start)
    o.st.addEmptyAnimation(0, 0, d * (Math.floor(cur.trackTime / d) + 1));
  };

  P.settle = function () {
    var self = this;
    this.reels.forEach(function (col) {
      col.cells.forEach(function (o) {
        o.dimTarget = 0;
        var cur = o.st.getCurrent(0);
        // let the running cycle play to its end (its last frame matches the first), then rest:
        // cutting a loop mid-way replays part of it during the mix and then snaps
        if (cur && /win|trigger|^animation$/.test(cur.animation.name)) self.finishCycle(o);
      });
    });
  };

  P.showWin = function (s, token) {
    var self = this, winSet = {}, winners = [];
    s.win.forEach(function (p) { winSet[p[0] + ':' + p[1]] = 1; });
    this.reels.forEach(function (col, c) {
      col.cells.forEach(function (o, r) {
        var on = !!winSet[c + ':' + r];
        o.dimTarget = on ? 0 : 1;
        if (on) winners.push(o);
      });
    });
    // let a Scatter/Wild that just dropped finish its landing before celebrating
    var landing = winners.map(function (o) { var cur = o.st.getCurrent(0); return cur && cur.animation.name === 'landing' ? finished(cur) : null; }).filter(Boolean);
    return Promise.all(landing).then(function () {
      if (token !== self.token) return;
      winners.forEach(function (o) { var a = self.winAnim(o); if (a) o.st.setAnimation(0, a, true); });
      var plate = s.jackpot && self.jackpots[s.jackpot];
      if (plate && self.has(plate, 'win')) plate.st.setAnimation(0, 'win', true);
      self.status({ phase: 'win', s: s });
      var longest = winners.reduce(function (m, o) { var c = o.st.getCurrent(0); return Math.max(m, c ? c.animation.duration : 0); }, 1);
      return wait(Math.max(s.bonus ? 1800 : 2400, longest * 2000));
    }).then(function () {
      if (token !== self.token) return;
      if (s.jackpot && self.jackpots[s.jackpot]) self.jackpots[s.jackpot].st.setEmptyAnimation(0, 0.3);
      if (self.cluster && self.cfg.cascade && !s.scatterWin) return self.cascade(s, token);
    });
  };

  // Pays-anywhere cascade: winners burst, the rest fall, new symbols drop in from the top.
  P.cascade = function (s, token) {
    var self = this, winSet = {}, boom = this.cfg.cascade, hits = 0, burst = 0;
    s.win.forEach(function (p) { winSet[p[0] + ':' + p[1]] = 1; });
    this.status({ phase: 'cascade', s: s });
    this.reels.forEach(function (col, c) {
      col.cells.forEach(function (o, r) {
        o.dimTarget = 0;
        if (!winSet[c + ':' + r]) return;
        if (self.cfg.cascadeFx === 'snow') { var sp = self.cell(c, r); self.snowball(sp.x, sp.y, o, hits++ * 0.05); return; }
        if (boom && self.data[boom]) {
          var p = self.cell(c, r), e = self.inst(boom), en = e.st.setAnimation(0, self.winAnim(e) || e.sk.data.animations[0].name, false);
          self.effects.push({ o: e, x: p.x, y: p.y });
          // boomWait: the symbol is gone the moment it bursts, and the new ones drop in only once the
          // explosion (a separate effect rig, reused for every symbol) has played out
          if (self.cfg.boomWait) burst = Math.max(burst, en.animation.duration);
        }
        o.gone = true;
      });
    });
    return wait(burst ? burst * 1000 + 60 : hits ? 300 + hits * 50 + 260 : 260).then(function () {
      if (token !== self.token) return;
      var avoid = (s.avoid || []).concat(self.specials, self.cfg.coins || []);
      self.reels.forEach(function (col, c) {
        var keep = [], keepIdx = [];
        col.cells.forEach(function (o, r) { if (!o.gone) { keep.push(o); keepIdx.push(r); } });
        var n = self.rows - keep.length, fresh = range(n).map(function () { return self.inst(self.filler(avoid)); });
        var cells = fresh.concat(keep);
        cells.forEach(function (o, r) {
          var from = r < n ? r - n - 0.4 : keepIdx[r - n];        // row it starts from (negative = above the reels)
          if (from !== r) o.drop = { rows: r - from, t: 0, delay: c * 0.04 + (r < n ? 0.08 : 0) };
          o.st.clearTracks(); o.sk.setToSetupPose();
        });
        col.cells = cells; col.ids = cells.map(function (o) { return o.id; });
      });
      return wait(760);
    });
  };

  // ---------- snow burst (cascadeFx: 'snow') ----------
  // A snowball flies in, hits the symbol and it shatters into a puff, flakes and clumps of snow.
  function snowTextures(ctx) {
    function tex(size, draw) { var c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size); return new spine.GLTexture(ctx, c, false); }
    // snow reads on light and dark boards alike: white bodies with icy-blue shading and outlines
    return {
      ball: tex(96, function (g, n) {
        g.shadowColor = 'rgba(30,70,140,.55)'; g.shadowBlur = n * 0.08;
        var gr = g.createRadialGradient(n * 0.36, n * 0.34, n * 0.04, n / 2, n / 2, n * 0.42);
        gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.55, '#e3f0ff'); gr.addColorStop(1, '#7fa8dc');
        g.fillStyle = gr; g.beginPath(); g.arc(n / 2, n / 2, n * 0.4, 0, Math.PI * 2); g.fill();
        g.shadowBlur = 0; g.lineWidth = n * 0.03; g.strokeStyle = '#5b86c4'; g.stroke();
      }),
      puff: tex(160, function (g, n) {
        var gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
        gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(225,238,255,.9)'); gr.addColorStop(0.7, 'rgba(150,190,240,.45)'); gr.addColorStop(1, 'rgba(110,160,230,0)');
        g.fillStyle = gr; g.fillRect(0, 0, n, n);
      }),
      ring: tex(160, function (g, n) {
        g.strokeStyle = 'rgba(120,170,235,.95)'; g.lineWidth = n * 0.07; g.beginPath(); g.arc(n / 2, n / 2, n * 0.38, 0, Math.PI * 2); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = n * 0.035; g.stroke();
      }),
      flake: tex(64, function (g, n) {
        g.translate(n / 2, n / 2); g.lineCap = 'round';
        [['#4f7fc0', n * 0.12], ['#ffffff', n * 0.06]].forEach(function (pass) {
          g.strokeStyle = pass[0]; g.lineWidth = pass[1];
          for (var i = 0; i < 6; i++) {
            g.rotate(Math.PI / 3); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -n * 0.4);
            g.moveTo(0, -n * 0.22); g.lineTo(n * 0.1, -n * 0.31); g.moveTo(0, -n * 0.22); g.lineTo(-n * 0.1, -n * 0.31); g.stroke();
          }
        });
      }),
      clump: tex(64, function (g, n) {
        g.beginPath(); for (var i = 0; i < 8; i++) { var a = i / 8 * Math.PI * 2, r = n * (0.27 + (i % 2) * 0.11); g.lineTo(n / 2 + Math.cos(a) * r, n / 2 + Math.sin(a) * r); } g.closePath();
        var gr = g.createRadialGradient(n * 0.4, n * 0.38, 1, n / 2, n / 2, n * 0.4);
        gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#a9c6ee'); g.fillStyle = gr; g.fill();
        g.lineWidth = n * 0.05; g.strokeStyle = '#5b86c4'; g.stroke();
      })
    };
  }

  P.snowball = function (x, y, cellObj, delay) {
    this.snowTex = this.snowTex || snowTextures(this.ctx);
    this.snow = this.snow || [];
    var side = Math.random() < 0.5 ? -1 : 1;
    // thrown from above the reels, slightly from one side, on a small arc
    this.snow.push({ kind: 'ball', x0: x + side * (160 + Math.random() * 120), y0: this.H + 60, x1: x, y1: y, t: -delay, dur: 0.24, cell: cellObj });
  };

  P.snowBurst = function (x, y) {
    var S = this.snow, k = this.CW / 150;
    S.push({ kind: 'puff', x: x, y: y, t: 0, life: 0.6, size: 175 * k });
    S.push({ kind: 'ring', x: x, y: y, t: 0, life: 0.35, size: 60 * k });
    for (var i = 0; i < 16; i++) {
      var a = Math.random() * Math.PI * 2, v = (180 + Math.random() * 320) * k;
      S.push({ kind: i % 3 ? 'flake' : 'clump', x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v + 120 * k, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10,
        t: 0, life: 0.55 + Math.random() * 0.35, size: (i % 3 ? 22 + Math.random() * 16 : 16 + Math.random() * 14) * k });
    }
  };

  P.drawSnow = function (dt) {
    if (!this.snow || !this.snow.length) return;
    var r = this.renderer, T = this.snowTex, self = this, col = this.snowColor = this.snowColor || new spine.Color(1, 1, 1, 1);
    r.batcher.setBlendMode(spine.BlendMode.Normal, false);
    this.snow = this.snow.filter(function (p) {
      p.t += dt;
      if (p.t < 0) return true;
      if (p.kind === 'ball') {
        var k = Math.min(1, p.t / p.dur), x = p.x0 + (p.x1 - p.x0) * k, y = p.y0 + (p.y1 - p.y0) * k + Math.sin(k * Math.PI) * 70;
        var sz = (46 + 30 * k) * self.CW / 150; col.a = 1;
        r.drawTextureRotated(T.ball, x - sz / 2, y - sz / 2, sz, sz, sz / 2, sz / 2, p.t * 400, col);
        if (k >= 1) { if (p.cell) p.cell.gone = true; self.snowBurst(p.x1, p.y1); return false; }
        return true;
      }
      var q = p.t / p.life; if (q >= 1) return false;
      if (p.kind === 'puff') { var s = p.size * (0.5 + q * 0.9); col.a = 0.9 * (1 - q); r.drawTexture(T.puff, p.x - s / 2, p.y - s / 2, s, s, col); return true; }
      if (p.kind === 'ring') { var s2 = p.size * (0.6 + q * 2.2); col.a = 1 - q; r.drawTexture(T.ring, p.x - s2 / 2, p.y - s2 / 2, s2, s2, col); return true; }
      p.vy -= 900 * dt; p.vx *= 0.985; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      col.a = q < 0.7 ? 1 : 1 - (q - 0.7) / 0.3;
      r.drawTextureRotated(T[p.kind], p.x - p.size / 2, p.y - p.size / 2, p.size, p.size, p.size / 2, p.size / 2, p.rot * 57.3, col);
      return true;
    });
  };

  P.dropPopup = function () {
    var p = this.popup;
    if (!p) return;
    clearTimeout(p.timer);
    if (p.label) p.label.dispose();
    this.popup = null;
  };

  P.drawPopupNumber = function (p, dt) {
    var n = p.num;
    if (!n) return;
    n.t += dt;
    var k = Math.min(1, n.t / 1.6), val = n.count ? n.target * (1 - Math.pow(1 - k, 3)) : n.target;
    var size = n.money ? (this.cfg.numberSize || 52) : (this.cfg.countSize || 96);
    p.label.set(formatNumber(val, n.money));
    if (n.bone.at) { n.bone.worldX = p.sk.x + n.bone.at.x * p.sk.scaleX; n.bone.worldY = p.sk.y + n.bone.at.y * p.sk.scaleY; }
    p.label.draw(this.renderer, n.bone.worldX, n.bone.worldY, size, n.bone.getWorldScaleY(), n.plate ? n.plate.color.a : Math.min(1, this.dim * 1.2));
  };

  P.showPopup = function (id, token) {
    var self = this, p = this.inst(id);
    this.popup = p; this.dimTarget = 1;
    try {
      p.num = popupNumber(p, id, this.cfg.popupNumberAt);
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

  P.onClick = function (e) {
    if (this.popup && this.popup.close) { clearTimeout(this.popup.timer); this.popup.close(); return; }
    var r = this.canvas.getBoundingClientRect(), b = this.cfg.spinBtn;
    var x = (e.clientX - r.left) / r.width * this.W, y = (e.clientY - r.top) / r.height * this.H;
    if (b && Math.hypot(x - b.x, y - b.y) < b.r && this.cfg.onSpinButton) this.cfg.onSpinButton();
  };

  // While waiting: now a symbol wins once, now a Wild or Scatter plays its idle.
  P.attract = function (t) {
    if (this.busy || this.popup || t - this.lastAction < 2500 || t < this.nextAttract) return;
    this.nextAttract = t + 2600 + Math.random() * 1800;
    var pool = [];
    this.reels.forEach(function (col) {
      col.cells.forEach(function (o) { var cur = o.st.getCurrent(0); if (!cur || cur.animation.duration === 0) pool.push(o); });
    });
    if (!pool.length) return;
    var o = pick(pool), anim = this.has(o, 'idle') ? 'idle' : this.winAnim(o);
    if (!anim) return;
    o.st.setAnimation(0, anim, false);
    o.st.addEmptyAnimation(0, 0, 0);
  };

  // ---------- render ----------

  P.place = function (o, x, y, stretch) {
    var m = o.m, s = m.scale;
    o.sk.scaleX = s; o.sk.scaleY = s * (stretch || 1);
    o.sk.x = x + m.ox * s; o.sk.y = y + m.oy * s * (stretch || 1);
  };

  P.tick = function (o, dt, stretch, x, y) {
    o.dim += (o.dimTarget - o.dim) * Math.min(1, dt * 8);
    var v = 1 - o.dim * 0.62;
    o.sk.color.set(v, v * 0.97, Math.min(1, v * 1.02), o.alpha == null ? 1 : o.alpha);
    o.st.update(dt); o.st.apply(o.sk);
    // once an animation has fully mixed out, return slots to setup: an empty mix leaves keyed
    // attachments (glows / lights that are off in setup) switched on
    var cur = o.st.getCurrent(0), idle = !cur || (cur.animation.duration === 0 && !cur.mixingFrom);
    if (idle && o.played) { o.sk.setToSetupPose(); o.sk.slots.forEach(function (sl) { sl.sequenceIndex = -1; }); o.played = false; } else if (!idle) o.played = true;
    this.place(o, x, y, stretch);
    o.sk.updateWorldTransform();
    this.renderer.drawSkeleton(o.sk, o.pma);
  };

  P.spinInst = function (id) {
    this.spinPool = this.spinPool || {};
    if (!this.spinPool[id]) { var o = this.inst(id); o.st.clearTracks(); this.spinPool[id] = o; }
    return this.spinPool[id];
  };

  P.frame = function (t) {
    var dt = Math.min(0.05, (t - this.last) / 1000); this.last = t;
    if (!this.visible) return;
    var gl = this.ctx.gl, r = this.renderer, self = this, W = this.W, H = this.H, R = this.R;
    var c = this.canvas, dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cw = Math.round(c.clientWidth * dpr), ch = Math.round(c.clientHeight * dpr);
    if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
    gl.viewport(0, 0, c.width, c.height);
    r.camera.setViewport(W, H); r.camera.position.x = W / 2; r.camera.position.y = H / 2; r.camera.update();
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    if (this.drawBackground(dt) && this.bonusLayer) { this.bonusLayer.remove(); this.bonusLayer = null; }
    r.begin();
    if (this.scene) this.drawModeSet(this.scene, dt);
    if (this.bonusFrontTex && this.bonusMix > 0.005) {
      this.frontColor = this.frontColor || new spine.Color(1, 1, 1, 1); this.frontColor.a = this.bonusMix;
      r.batcher.setBlendMode(spine.BlendMode.Normal, false); r.drawTexture(this.bonusFrontTex, 0, 0, W, H, this.frontColor);
    }
    // frameShift [dx, dy] (layout px, y down) nudges the keyed-out layout layer, e.g. to set props on the floor
    if (this.frameTex) { var fs = this.cfg.frameShift || [0, 0]; r.batcher.setBlendMode(spine.BlendMode.Normal, false); r.drawTexture(this.frameTex, fs[0], -fs[1], W, H); }
    this.drawPaint('under');
    if (this.env.length || Object.keys(this.jackpots).length) this.drawEnv(dt);
    r.end();
    this.attract(t);

    var dropping = this.reels.some(function (col) { return col.cells.some(function (o) { return o.drop; }); });
    var spinning = dropping || this.reels.some(function (col) { return col.spin; });
    if (spinning) {
      var sx = c.width / W, sy = c.height / H;
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(Math.round(R.x * sx), Math.round((H - R.y - R.h) * sy), Math.round(R.w * sx), Math.round(R.h * sy));
    }
    r.begin();
    this.reels.forEach(function (col, ci) {
      if (col.spin) {
        self.updateSpin(col, t);
        if (col.spin) {
          var sp = col.spin, base = Math.floor(sp.pos), frac = sp.pos - base, stretch = 1 + Math.min(0.18, (sp.speed || 0) * 0.02);
          var top = self.cell(ci, 0);
          for (var i = -1; i <= self.rows; i++) {
            var id = sp.strip[base + i];
            if (id) self.tick(self.spinInst(id), 0, stretch, top.x, top.y - (i - frac) * self.CH);
          }
          return;
        }
      }
      var bounce = 0;
      if (col.bounce) {
        var bk = (t - col.bounce.start) / 260;
        if (bk >= 1) col.bounce = null; else bounce = Math.sin(bk * Math.PI) * 10 * (1 - bk);
      }
      col.cells.forEach(function (o, rr) {
        if (o.gone) return;                                   // burst in a cascade: only its effect shows
        var p = self.cell(ci, rr), off = 0;
        if (o.drop) {
          var d = o.drop; d.t += dt;
          var k = Math.max(0, d.t - d.delay) / 0.42;
          if (k >= 1) o.drop = null; else off = d.rows * self.CH * (1 - easeOutBounce(k));
        }
        self.tick(o, dt, 1, p.x, p.y - bounce + off);
      });
    });
    r.end();
    if (spinning) gl.disable(gl.SCISSOR_TEST);

    r.begin();
    this.drawPaint('over');
    this.effects = this.effects.filter(function (e) {
      self.tick(e.o, dt, 1, e.x, e.y);
      var cur = e.o.st.getCurrent(0);
      return cur && cur.trackTime < cur.animationEnd;
    });
    this.drawSnow(dt);
    this.drawChars(dt);
    this.dim += (this.dimTarget - this.dim) * Math.min(1, dt * 6);
    if (this.dim > 0.01) { this.dimColor.a = this.dim * 0.62; r.rect(true, 0, 0, W, H, this.dimColor); }
    if (this.popup) { this.tick(this.popup, dt, 1, W / 2, H / 2); this.drawPopupNumber(this.popup, dt); }
    r.end();
  };

  P.destroy = function () {
    this.dead = true; this.token++;
    cancelAnimationFrame(this.raf);
    if (this.io) this.io.disconnect();
    if (this.popup) clearTimeout(this.popup.timer);
    if (this.bonusLayer) this.bonusLayer.remove();
    if (this.canvas) {
      var ext = this.ctx && this.ctx.gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
      this.canvas.remove();
    }
  };

  // ---------- paint kit ----------
  // 2D-canvas helpers for projects/<p>/paint.js: reel panels, neon frames, logo type and the
  // shared control strip (bet, spin, balance) that the other layouts carry in their artwork.
  var K = {
    rr: function (g, x, y, w, h, r) {
      g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
      g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
    },
    lin: function (g, x0, y0, x1, y1, stops) {
      var gr = g.createLinearGradient(x0, y0, x1, y1);
      stops.forEach(function (s, i) { gr.addColorStop(Array.isArray(s) ? s[0] : i / (stops.length - 1), Array.isArray(s) ? s[1] : s); });
      return gr;
    },
    // glowing stroke: a few blurred passes under a crisp line
    glow: function (g, path, color, width, blur, passes) {
      g.save(); g.strokeStyle = color; g.lineWidth = width; g.shadowColor = typeof color === 'string' ? color : '#fff';
      for (var i = 0; i < (passes || 3); i++) { g.shadowBlur = blur * (i + 1) / (passes || 3); path(); g.stroke(); }
      g.restore();
    },
    font: function (px, w) { return (w || 900) + ' ' + px + "px 'Arial Black', 'Arial', sans-serif"; },
    text: function (g, str, x, y, o) {
      g.save(); g.font = o.font || K.font(o.size, o.weight); g.textAlign = o.align || 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      if (o.spacing) g.letterSpacing = o.spacing + 'px';
      if (o.glow) { g.shadowColor = o.glow; g.shadowBlur = o.blur || 24; }
      if (o.stroke) { g.lineWidth = o.strokeW || 8; g.strokeStyle = o.stroke; g.strokeText(str, x, y); g.shadowBlur = 0; }
      if (o.fill) { var m = g.measureText(str), h = o.size; g.fillStyle = Array.isArray(o.fill) ? K.lin(g, 0, y - h / 2, 0, y + h / 2, o.fill) : o.fill; g.fillText(str, x, y); }
      g.restore();
    },
    circle: function (g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); },
    // bottom strip: menu icons, bet -/+, spin, turbo, autoplay, balance (positions in layout px)
    controls: function (g, c) {
      var y = c.y, ink = c.ink || '#ffffff';
      g.save();
      (c.menu || []).forEach(function (x) { K.circle(g, x, y, 15); g.fillStyle = 'rgba(0,0,0,.45)'; g.fill(); g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,.55)'; g.stroke(); });
      if (c.minus) { K.circle(g, c.minus, y, 21); g.fillStyle = K.lin(g, 0, y - 21, 0, y + 21, ['#e8e8ee', '#9a9aa8']); g.fill(); g.fillStyle = '#3a3a48'; g.fillRect(c.minus - 9, y - 2.5, 18, 5); }
      if (c.pill) {
        K.rr(g, c.pill[0], y - 21, c.pill[1], 42, 21); g.fillStyle = 'rgba(8,6,20,.82)'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = c.accent || '#ffcf6b'; g.stroke();
        K.text(g, c.bet || '100,000 FUN', c.pill[0] + c.pill[1] / 2, y + 1, { size: 15, fill: '#fff4d6', weight: 800 });
      }
      if (c.plus) { K.circle(g, c.plus, y, 21); g.fillStyle = K.lin(g, 0, y - 21, 0, y + 21, ['#7dff8a', '#1fa83a']); g.fill(); g.fillStyle = '#fff'; g.fillRect(c.plus - 9, y - 2.5, 18, 5); g.fillRect(c.plus - 2.5, y - 9, 5, 18); }
      if (c.spin) {
        var sx = c.spin[0], r = c.spin[1];
        g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 18; K.circle(g, sx, y, r); g.fillStyle = '#15131f'; g.fill(); g.shadowBlur = 0;
        K.circle(g, sx, y, r - 4); g.lineWidth = 6; g.strokeStyle = '#ffffff'; g.stroke();
        // two clockwise arcs, each ending in a solid arrowhead that points along the arc
        var rr = r * 0.48, lw = r * 0.13, hl = r * 0.24, hw = r * 0.19;
        g.lineWidth = lw; g.lineCap = 'round'; g.strokeStyle = ink; g.fillStyle = ink;
        [0, Math.PI].forEach(function (a0) {
          var e = a0 + 2.55;
          g.beginPath(); g.arc(sx, y, rr, a0 + 0.45, e); g.stroke();
          var ex = sx + rr * Math.cos(e), ey = y + rr * Math.sin(e), tx = -Math.sin(e), ty = Math.cos(e), nx = Math.cos(e), ny = Math.sin(e);
          g.beginPath(); g.moveTo(ex + tx * hl, ey + ty * hl); g.lineTo(ex + nx * hw, ey + ny * hw); g.lineTo(ex - nx * hw, ey - ny * hw); g.closePath(); g.fill();
        });
        g.lineCap = 'butt';
      }
      [c.turbo, c.auto].forEach(function (x, i) {
        if (!x) return;
        K.circle(g, x, y, 19); g.fillStyle = 'rgba(0,0,0,.5)'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = 'rgba(255,255,255,.75)'; g.stroke();
        K.text(g, i ? 'A' : '⚡︎', x, y + 1, { size: i ? 17 : 16, fill: '#fff', weight: 900 });
      });
      if (c.balance) K.text(g, 'BALANCE: 1,000,000 FUN', c.balance, y + 1, { size: 16, fill: c.accent || '#ffcf6b', weight: 800, align: 'right' });
      g.restore();
    }
  };
  window.HSPaintKit = K;

  window.HSSlotEngine = {
    create: function (host, cfg) {
      var e = new Engine(host, cfg);
      return { play: function (k, p) { return e.play(k, p); }, isBusy: function () { return e.busy; }, destroy: function () { e.destroy(); } };
    },
    Engine: Engine
  };
})();
