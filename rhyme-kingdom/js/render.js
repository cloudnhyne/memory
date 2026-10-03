/*
 * Rhyme Kingdom: board renderer.
 * Draws the board on a canvas and plays back the engine's event list with
 * tweens, falling physics, particles and power-up effects. A second canvas on
 * top of the whole screen carries collected items up to the goal counters.
 */
(function (root) {
  'use strict';
  const Art = root.RKArt, Snd = root.RKSound;
  const T = root.RKEngine.T;

  const TILE_COLORS = ['#ff3347', '#ff7a1a', '#ffc21a', '#25c75a', '#2e8cff', '#9446f0'];
  const NEON = ['#e3192b', '#ffffff', '#ff2a3d', '#bdbdc2', '#ff5a64'];
  const DISPLAY_FONT = "'Sedgwick Ave Display', 'Bungee', Impact, sans-serif";

  const ease = {
    lin: (t) => t,
    out: (t) => 1 - (1 - t) * (1 - t),
    in: (t) => t * t,
    inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    back: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    cubic: (t) => 1 - Math.pow(1 - t, 3),
  };

  function loadImage(src) {
    return new Promise((res) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => res(null);
      im.src = src;
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  const CALLOUT = { 2: 'FRESH!', 3: 'DOPE!', 4: 'FIRE!', 5: 'FIRE!' };
  const COMBO_NAME = { cross: 'CROSSFADE!', bigcross: 'BASS CROSS!', xx: 'DOUBLE DROP!', dd: 'DOUBLE PLATINUM!', dconv: 'REMIX!', plpl: 'AIRMAIL!', plc: 'SPECIAL DELIVERY!' };

  class BoardView {
    constructor(canvas, fxCanvas, hooks) {
      this.cv = canvas;
      this.ctx = canvas.getContext('2d');
      this.fx = fxCanvas;
      this.fctx = fxCanvas.getContext('2d');
      this.hooks = hooks;
      this.img = {};
      this.cache = new Map();
      this.sprites = new Map();
      this.tweens = [];
      this.timers = [];
      this.parts = [];
      this.effects = [];
      this.texts = [];
      this.flyers = [];
      this.time = 0;
      this.shakeAmp = 0;
      this.busy = false;
      this.eng = null;
      this.sel = null;
      this.hint = null;
      this.idle = 0;
      this.tut = null;
      this.targeting = null;
      this.cascade = 0;
      this.lastPop = 0;
      this.lastFloor = 0;
      this.paused = false;
      this.speed = 1; // animation speed multiplier (automated tests run faster)
      this.slowT = 0; this.slowK = 1; // slow motion: remaining real seconds, time factor
      this.zoom = 0; // camera punch
      this.decals = []; // paint splats left on the board
      this.fxParts = []; // fireworks over the whole screen
      this.glowCache = new Map();
      this.comboShow = { n: 0, t: -9 };
      this._bindInput();
      this._last = performance.now();
      const loop = (now) => {
        const dt = Math.min(0.05, (now - this._last) / 1000);
        this._last = now;
        if (!this.paused) {
          const real = dt * this.speed;
          this.slowT = Math.max(0, this.slowT - real);
          this.update(real * (this.slowT > 0 ? this.slowK : 1), real);
          this.draw();
        }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }

    async init() {
      const jobs = [];
      const add = (k, url) => jobs.push(loadImage(url).then((im) => { this.img[k] = im; }));
      for (let c = 0; c < 6; c++) add('t' + c, Art.tileUrl(c));
      for (const p of ['h', 'v', 'x', 'pl', 'd']) add(p, Art.powerUrl(p));
      add('crown', Art.crownUrl());
      for (let h = 1; h <= 3; h++) add('c' + h, Art.crateUrl(h));
      add('tape', Art.tapeUrl());
      add('floor', Art.floorUrl());
      add('static', Art.staticUrl());
      add('hand', Art.handUrl());
      add('hammer', Art.iconUrl('hammer'));
      add('row', Art.iconUrl('row'));
      add('col', Art.iconUrl('col'));
      for (const b of ['buzzkill', 'lipsync', 'static']) add('boss_' + b, Art.portraitUrl(b));
      await Promise.all(jobs);
    }

    // ------------------------------------------------------------- level setup
    load(eng) {
      this.eng = eng;
      this.cols = eng.cols; this.rows = eng.rows;
      this.sprites.clear();
      this.tweens = []; this.timers = []; this.parts = []; this.effects = []; this.texts = []; this.flyers = [];
      this.sel = null; this.hint = null; this.idle = 0; this.tut = null; this.targeting = null;
      this.v = eng.cells.map((row) => row.map((cl) => ({
        p: cl.p, floor: cl.floor, lit: false, tape: cl.tape,
        block: cl.block ? { ...cl.block } : null, hitT: -9, litT: -9,
      })));
      for (let r = 0; r < eng.rows; r++) for (let c = 0; c < eng.cols; c++) {
        const t = eng.cells[r][c].tile;
        if (t) this._newSprite(t.id, t.k, t.col, t.pw, c, r);
      }
      this.boss = eng.boss ? { ...eng.boss, flash: 0, shake: 0, dead: false, deadT: 0, wind: 0 } : null;
      this.decals = []; this.zoom = 0; this.slowT = 0; this.comboShow = { n: 0, t: -9 };
      // the board drops in, column by column
      for (const sp of this.sprites.values()) {
        const y = sp.y;
        sp.y = y - this.rows - 1 - Math.random() * 0.6;
        sp.path = [{ x: sp.x, y }];
        sp.v = 4;
        sp.delay = (this.rows - y) * 0.035 + sp.x * 0.02;
      }
      this.busy = true;
      this.wait(0.95).then(() => { if (this.eng === eng && this.introBusy) { this.busy = false; } this.introBusy = false; });
      this.introBusy = true;
      this.hasCrowns = !!eng.crownCfg || eng.goals.some((g) => g.type === 'crown');
      this.layout();
    }

    _newSprite(id, k, col, pw, x, y) {
      const sp = { id, k, col, pw, x, y, s: 1, a: 1, rot: 0, z: 0, path: null, v: 0, delay: 0, sq: 0, flash: 0 };
      this.sprites.set(id, sp);
      return sp;
    }

    layout() {
      const wrap = this.cv.parentElement;
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(root.devicePixelRatio || 1, 3);
      this.dpr = dpr;
      this.W = Math.max(1, rect.width); this.H = Math.max(1, rect.height);
      this.cv.width = Math.round(this.W * dpr); this.cv.height = Math.round(this.H * dpr);
      const app = this.fx.parentElement.getBoundingClientRect();
      this.fx.width = Math.round(app.width * dpr); this.fx.height = Math.round(app.height * dpr);
      this.FW = app.width; this.FH = app.height;
      this.offX = rect.left - app.left; this.offY = rect.top - app.top;
      this.cache.clear();
      if (!this.eng) return;
      const S = Math.floor(Math.min((this.W - 4) / this.cols, (this.H - 4) / this.rows, 66));
      this.S = Math.max(16, S);
      this.ox = Math.round((this.W - this.S * this.cols) / 2);
      this.oy = Math.round((this.H - this.S * this.rows) / 2);
      this._buildBg();
    }

    _buildBg() {
      const { S, ox, oy, dpr } = this;
      const bg = document.createElement('canvas');
      bg.width = Math.round(this.W * dpr); bg.height = Math.round(this.H * dpr);
      const g = bg.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cells = [];
      for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) if (this.v[r][c].p) cells.push([c, r]);
      const pass = (grow, rad, fill, extra) => {
        g.save();
        if (extra) extra(g);
        g.fillStyle = fill;
        g.beginPath();
        for (const [c, r] of cells) roundRect(g, ox + c * S - grow, oy + r * S - grow, S + grow * 2, S + grow * 2, rad);
        g.fill();
        g.restore();
      };
      pass(9, 14, 'rgba(227,25,43,.55)', (x) => { x.shadowColor = '#e3192b'; x.shadowBlur = 22; });
      const grad = g.createLinearGradient(0, oy - 10, 0, oy + this.rows * S + 10);
      grad.addColorStop(0, '#f2f2f2'); grad.addColorStop(0.5, '#e3192b'); grad.addColorStop(1, '#5a5a60');
      pass(7, 12, grad);
      pass(4, 9, 'rgba(10, 10, 11, .92)');
      for (const [c, r] of cells) {
        g.fillStyle = (c + r) % 2 ? 'rgba(36, 36, 40, .8)' : 'rgba(50, 50, 55, .8)';
        g.fillRect(ox + c * S, oy + r * S, S, S);
      }
      g.strokeStyle = 'rgba(255,255,255,.05)';
      g.lineWidth = 1;
      for (const [c, r] of cells) g.strokeRect(ox + c * S + 0.5, oy + r * S + 0.5, S - 1, S - 1);
      this.bg = bg;
    }

    // ------------------------------------------------------------ geometry
    center(c, r) { return { x: this.ox + (c + 0.5) * this.S, y: this.oy + (r + 0.5) * this.S }; }
    toFx(x, y) { return { x: x + this.offX, y: y + this.offY }; }
    cellAt(px, py) {
      const c = Math.floor((px - this.ox) / this.S), r = Math.floor((py - this.oy) / this.S);
      if (c < 0 || r < 0 || c >= this.cols || r >= this.rows || !this.v[r][c].p) return null;
      return { c, r };
    }

    // Sprites are cached at power-of-two resolutions and scaled on draw, so
    // animated sizes never create new bitmaps (the cache stays tiny).
    _spr(key, w, h) {
      const want = Math.max(w, h || w) * this.dpr;
      const px = Math.min(1024, Math.max(32, Math.pow(2, Math.ceil(Math.log2(Math.max(1, want))))));
      const k = key + '@' + px;
      let c = this.cache.get(k);
      if (!c) {
        const im = this.img[key];
        if (!im) return null;
        c = document.createElement('canvas');
        c.width = px; c.height = px;
        const g = c.getContext('2d');
        g.imageSmoothingQuality = 'high';
        if (!/^(boss_|hand|floor)/.test(key)) {
          // soft contact shadow so the glossy pieces sit on the board
          g.shadowColor = 'rgba(0, 0, 0, .6)';
          g.shadowBlur = px * 0.05;
          g.shadowOffsetY = px * 0.035;
        }
        if (key === 'h') {
          g.translate(px / 2, px / 2); g.rotate(Math.PI / 2); g.translate(-px / 2, -px / 2);
        }
        const inset = key.startsWith('boss_') ? 0 : px * 0.02;
        g.drawImage(im, inset, inset, px - inset * 2, px - inset * 2);
        this.cache.set(k, c);
      }
      return c;
    }
    _keyOf(sp) { return sp.k === 'n' ? 't' + sp.col : sp.k === 'c' ? 'crown' : sp.pw; }

    // --------------------------------------------------------------- timing
    after(sec, fn) {
      if (sec <= 0.0005) return Promise.resolve(fn());
      return new Promise((res) => {
        this.timers.push({ t: this.time + sec, fn: () => Promise.resolve(fn()).then(res) });
      });
    }
    wait(sec) { return this.after(sec, () => {}); }
    tween(obj, to, dur, ez = ease.out) {
      return new Promise((res) => {
        const from = {};
        for (const k in to) from[k] = obj[k];
        this.tweens.push({ obj, from, to, dur: Math.max(0.001, dur), t: 0, ez, res });
      });
    }

    // ------------------------------------------------------------- playback
    async play(events) {
      this.introBusy = false;
      this.busy = true;
      this.sel = null; this.hint = null; this.idle = 0;
      this.cascade = 0;
      let i = 0;
      while (i < events.length) {
        const batch = [];
        while (i < events.length && events[i].t !== 'phase') batch.push(events[i++]);
        const ph = events[i++];
        const t0 = this.time;
        const proms = [];
        for (const ev of batch) {
          const p = this.apply(ev);
          if (p) proms.push(p);
        }
        await Promise.all(proms);
        const min = ph && ph.min ? ph.min / 1000 : 0;
        const left = min - (this.time - t0);
        if (left > 0) await this.wait(left);
      }
      this.busy = false;
    }

    apply(ev) {
      const at = (ev.at || 0) / 1000;
      switch (ev.t) {
        case 'swap': return this._swap(ev);
        case 'moves': this.after(at, () => this.hooks.setMoves(ev.n)); return null;
        case 'clear': return this.after(at, () => this._clear(ev));
        case 'merge': return this._merge(ev);
        case 'create': return this.after(at, () => this._create(ev));
        case 'floor': return this.after(at, () => this._floor(ev));
        case 'crate': return this.after(at, () => this._crate(ev));
        case 'static': return this.after(at, () => this._staticGone(ev));
        case 'tape': return this.after(at, () => this._tape(ev));
        case 'boss': return this.after(at, () => this._bossHit(ev));
        case 'bossDie': return this.after(at, () => this._bossDie());
        case 'bossAttack': return this._bossAttack(ev);
        case 'bossTimer': this.hooks.bossTimer && this.hooks.bossTimer(ev.n); return null;
        case 'spread': return this._spread(ev);
        case 'act': return this.after(at, () => this._act(ev));
        case 'convert': return this.after(at, () => this._convert(ev));
        case 'fall': return this._fall(ev);
        case 'collect': return this.after(at, () => this._collect(ev));
        case 'shuffle': return this._shuffle(ev);
        case 'combo': this._combo(ev.n); return null;
        default: return null;
      }
    }

    _swap(ev) {
      const A = this.sprites.get(ev.ida), B = this.sprites.get(ev.idb);
      if (!A || !B) return null;
      Snd.fx('swap');
      A.z = 2; B.z = 1;
      const go = Promise.all([
        this.tween(A, { x: ev.b.c, y: ev.b.r }, 0.13, ease.inOut),
        this.tween(B, { x: ev.a.c, y: ev.a.r }, 0.13, ease.inOut),
      ]);
      if (!ev.bad) return go.then(() => { A.z = 0; B.z = 0; });
      return go.then(() => {
        Snd.fx('bad');
        return Promise.all([
          this.tween(A, { x: ev.a.c, y: ev.a.r }, 0.16, ease.inOut),
          this.tween(B, { x: ev.b.c, y: ev.b.r }, 0.16, ease.inOut),
        ]);
      }).then(() => { A.z = 0; B.z = 0; });
    }

    _pop() {
      if (this.time - this.lastPop < 0.035) return;
      this.lastPop = this.time;
      Snd.fx('pop', Math.min(9, this.cascade + Math.floor(Math.random() * 2)));
    }

    _clear(ev) {
      const sp = this.sprites.get(ev.id);
      const p = this.center(ev.c, ev.r);
      const tc = TILE_COLORS[ev.col] || '#fff';
      this.burst(p.x, p.y, tc, ev.hit ? 6 : 9);
      this.part({ x: p.x, y: p.y, vx: 0, vy: 0, g: 0, life: 0.22, size: this.S * 0.75, color: tc, shape: 'glow' });
      for (let i = 0; i < 3; i++) { const an = Math.random() * Math.PI * 2, v = 240 * (this.S / 50); this.part({ x: p.x, y: p.y, vx: Math.cos(an) * v, vy: Math.sin(an) * v, g: 300, life: 0.3, size: this.S * 0.3, color: '#ffffff', shape: 'spark' }); }
      this._pop();
      if (ev.g != null) this.flyToGoal(ev.g, 't' + ev.col, p.x, p.y);
      if (!sp) return null;
      sp.z = 3;
      return this.tween(sp, { s: 1.28 }, 0.06).then(() => this.tween(sp, { s: 0, a: 0 }, 0.12, ease.in)).then(() => this.sprites.delete(ev.id));
    }

    _merge(ev) {
      const sp = this.sprites.get(ev.id);
      const p = this.center(ev.c, ev.r);
      if (ev.g != null) this.flyToGoal(ev.g, 't' + ev.col, p.x, p.y);
      this._pop();
      if (!sp) return null;
      sp.z = 2;
      return this.tween(sp, { x: ev.to.c, y: ev.to.r, s: 0.7 }, 0.15, ease.in).then(() => this.sprites.delete(ev.id));
    }

    _create(ev) {
      const sp = this._newSprite(ev.id, 'p', -1, ev.pw, ev.c, ev.r);
      sp.s = 0; sp.z = 2;
      const p = this.center(ev.c, ev.r);
      this.ring(p.x, p.y, this.S * 0.3, this.S * 1.1, 0.35, '#fff', 4);
      this.sparkle(p.x, p.y, 10);
      this.rays(p.x, p.y, this.S * 1.8, 0.6, ev.pw === 'd' ? '#ffffff' : '#ff2a3d');
      this.glowBurst(p.x, p.y, '#ffffff', 10, 200, 0.3);
      this.punch(0.025);
      Snd.fx('pop', 8);
      if (ev.pw === 'd') Snd.fx('platinum');
      this.hooks.haptic && this.hooks.haptic(15);
      return this.tween(sp, { s: 1.25 }, 0.13, ease.out).then(() => this.tween(sp, { s: 1 }, 0.12, ease.inOut)).then(() => { sp.z = 0; });
    }

    _floor(ev) {
      const cl = this.v[ev.r][ev.c];
      cl.floor = ev.n;
      const p = this.center(ev.c, ev.r);
      if (ev.n === 0) {
        cl.lit = true; cl.litT = this.time;
        this.sparkle(p.x, p.y, 6);
        if (this.time - this.lastFloor > 0.05) { this.lastFloor = this.time; Snd.fx('floor'); }
      } else {
        this.ring(p.x, p.y, this.S * 0.2, this.S * 0.7, 0.3, '#ff5a64', 3);
      }
      if (ev.g != null) this.flyToGoal(ev.g, 'floor', p.x, p.y);
    }

    _crate(ev) {
      const cl = this.v[ev.r][ev.c];
      const p = this.center(ev.c, ev.r);
      Snd.fx('crate');
      const col = cl.block ? (cl.block.hp === 3 ? '#5ea3ff' : cl.block.hp === 2 ? '#ff5d72' : '#d9a066') : '#d9a066';
      this.debris(p.x, p.y, col, ev.hp ? 6 : 12);
      if (ev.hp > 0) { if (cl.block) cl.block.hp = ev.hp; cl.hitT = this.time; }
      else {
        cl.block = null;
        for (let i = 0; i < 3; i++) this.part({ x: p.x, y: p.y, vx: (Math.random() - 0.5) * 260, vy: -180 - Math.random() * 160, g: 900, life: 0.9, size: this.S * 0.22, color: NEON[i % 5], shape: 'disc', vr: (Math.random() - 0.5) * 12 });
        if (ev.g != null) this.flyToGoal(ev.g, 'c1', p.x, p.y);
      }
    }

    _staticGone(ev) {
      const cl = this.v[ev.r][ev.c];
      cl.block = null;
      const p = this.center(ev.c, ev.r);
      Snd.fx('static');
      for (let i = 0; i < 12; i++) {
        this.part({ x: p.x + (Math.random() - 0.5) * this.S * 0.6, y: p.y + (Math.random() - 0.5) * this.S * 0.6, vx: (Math.random() - 0.5) * 220, vy: (Math.random() - 0.5) * 220, g: 0, life: 0.45, size: this.S * 0.09, color: ['#fff', '#cfc4f5', '#7b66b8'][i % 3], shape: 'sq' });
      }
      if (ev.g != null) this.flyToGoal(ev.g, 'static', p.x, p.y);
    }

    _tape(ev) {
      const cl = this.v[ev.r][ev.c];
      cl.tape = 0;
      const p = this.center(ev.c, ev.r);
      Snd.fx('tape');
      for (let i = 0; i < 4; i++) {
        this.part({ x: p.x, y: p.y, vx: (i % 2 ? 1 : -1) * (120 + Math.random() * 120), vy: -120 - Math.random() * 140, g: 700, life: 0.7, size: this.S * 0.42, color: i % 2 ? '#b9b3cc' : '#d6d1e6', shape: 'strip', rot: Math.random() * 3, vr: (Math.random() - 0.5) * 10 });
      }
      if (ev.g != null) this.flyToGoal(ev.g, 'tape', p.x, p.y);
    }

    _bossHit(ev) {
      const B = this.boss;
      if (!B) return;
      B.hp = ev.hp; B.flash = 1; B.shake = 1;
      const p = this.center(ev.c, ev.r);
      this.text('-1', p.x, p.y - this.S * 0.2, this.S * 0.55, '#ff3b5c', 0.7, 50);
      this.burst(p.x, p.y, '#9a9aa0', 5);
      this.glowBurst(p.x, p.y, '#ff2a3d', 4, 200, 0.3);
      if (this.time - (B.lastSnd || 0) > 0.06) { B.lastSnd = this.time; Snd.fx('bossHit'); }
      if (ev.g != null) this.hooks.goalTick(ev.g, -1);
    }

    _bossDie() {
      const B = this.boss;
      if (!B) return;
      B.dead = true; B.deadT = this.time;
      const p = this.center(B.x + B.w / 2 - 0.5, B.y + B.h / 2 - 0.5);
      Snd.fx('boom'); Snd.fx('horn', 3);
      this.shakeAmp = 18;
      for (let k = 0; k < 3; k++) this.ring(p.x, p.y, this.S * 0.5, this.S * (3 + k * 1.5), 0.5 + k * 0.15, NEON[k], 6);
      this.burst(p.x, p.y, '#9a9aa0', 30);
      this.sparkle(p.x, p.y, 30);
      this.slowMo(0.25, 0.7); this.punch(0.12);
      this.nova(p.x, p.y, this.S * 5, 0.8, '#ff2a3d');
      this.rays(p.x, p.y, this.S * 6, 1.6, '#ffffff');
      this.smoke(p.x, p.y, 18, 2);
      this.glowBurst(p.x, p.y, '#ffffff', 40, 480, 0.5);
      this.effects.push({ kind: 'flash', t0: this.time, dur: 0.4, color: '#ffffff', alpha: 0.7 });
      this.fireworks(4, 1);
      this.text('MIC DROP!', this.W / 2, this.oy + this.rows * this.S * 0.45, Math.min(this.W / 6, 70), '#ff2a3d', 1.6);
      this.hooks.haptic && this.hooks.haptic(80);
      for (let y = B.y; y < B.y + B.h; y++) for (let x = B.x; x < B.x + B.w; x++) this.v[y][x].block = null;
      return this.wait(0.6);
    }

    _bossAttack(ev) {
      const B = this.boss;
      if (!B) return null;
      Snd.fx('bossAttack');
      B.wind = 1;
      const from = this.center(B.x + B.w / 2 - 0.5, B.y + B.h / 2 - 0.5);
      const names = { crate: 'CRATE DROP!', tape: 'TAPED UP!', static: 'STATIC!' };
      this.text(names[ev.kind] || 'ATTACK!', from.x, from.y + this.S * B.h * 0.6, this.S * 0.6, '#ff3b5c', 1.1);
      const proms = ev.targets.map((tg) => this.after(tg.at / 1000, () => {
        const p = this.center(tg.c, tg.r);
        this.bolt(from.x, from.y, p.x, p.y, 0.35, ev.kind === 'tape' ? '#d6d1e6' : ev.kind === 'static' ? '#9a9aa0' : '#ff9a3c');
        const cl = this.v[tg.r][tg.c];
        if (ev.kind === 'tape') cl.tape = 1;
        else {
          if (tg.id != null) this.sprites.delete(tg.id);
          cl.block = ev.kind === 'static' ? { t: 'static' } : { t: 'crate', hp: 1 };
          cl.hitT = this.time;
        }
        this.ring(p.x, p.y, this.S * 0.2, this.S * 0.9, 0.3, '#ff3b5c', 4);
        return this.wait(0.15);
      }));
      return Promise.all(proms).then(() => { B.wind = 0; });
    }

    _spread(ev) {
      const sp = this.sprites.get(ev.id);
      const p = this.center(ev.c, ev.r), q = this.center(ev.from.c, ev.from.r);
      Snd.fx('static');
      this.bolt(q.x, q.y, p.x, p.y, 0.25, '#9a9aa0');
      if (ev.g != null) this.hooks.goalTick(ev.g, +1);
      const cl = this.v[ev.r][ev.c];
      const done = () => { this.sprites.delete(ev.id); cl.block = { t: 'static' }; cl.hitT = this.time; };
      if (!sp) { done(); return this.wait(0.2); }
      return this.tween(sp, { s: 0, a: 0 }, 0.2, ease.in).then(done);
    }

    _convert(ev) {
      const sp = this.sprites.get(ev.id);
      const p = this.center(ev.c, ev.r);
      this.ring(p.x, p.y, this.S * 0.2, this.S * 0.9, 0.3, '#fff', 3);
      this.sparkle(p.x, p.y, 5);
      Snd.fx('pop', 7);
      if (!sp) return null;
      sp.k = 'p'; sp.pw = ev.pw; sp.s = 0.4;
      return this.tween(sp, { s: 1 }, 0.18, ease.back);
    }

    _fall(ev) {
      const proms = [];
      for (const m of ev.moves) {
        let sp = this.sprites.get(m.id);
        if (m.spawn) sp = this._newSprite(m.id, m.spawn.k, m.spawn.col, m.spawn.pw, m.path[0][0], m.path[0][1]);
        if (!sp) continue;
        sp.path = m.path.slice(1).map(([c, r]) => ({ x: c, y: r }));
        sp.delay = (m.step || 0) * 0.045;
        sp.v = 3;
        proms.push(new Promise((res) => { sp.onLand = res; }));
      }
      return Promise.all(proms);
    }

    _collect(ev) {
      const sp = this.sprites.get(ev.id);
      const p = this.center(ev.c, ev.r);
      Snd.fx('crown');
      this.sparkle(p.x, p.y, 16);
      this.ring(p.x, p.y, this.S * 0.3, this.S * 1.4, 0.45, '#ff2a3d', 5);
      if (ev.g != null) this.flyToGoal(ev.g, 'crown', p.x, p.y, 1.2);
      if (sp) this.sprites.delete(ev.id);
      return this.wait(0.25);
    }

    _shuffle(ev) {
      Snd.fx('scratch');
      this.text('REMIX!', this.W / 2, this.oy + this.rows * this.S / 2, Math.min(this.W / 6, 64), '#ffffff', 1.1);
      const proms = ev.moves.map((m) => {
        const sp = this.sprites.get(m.id);
        if (!sp) return null;
        sp.col = m.col;
        sp.z = 1;
        return this.tween(sp, { x: m.c, y: m.r }, 0.45 + Math.random() * 0.15, ease.inOut).then(() => { sp.z = 0; });
      }).filter(Boolean);
      return Promise.all(proms);
    }

    _combo(n) {
      this.cascade = n;
      this.comboShow = { n, t: this.time };
      if (n >= 4) this.punch(0.02 + Math.min(0.05, (n - 4) * 0.012));
      if (n >= 6) this.slowMo(0.45, 0.35);
      const txt = n >= 6 ? 'LEGENDARY!' : CALLOUT[n];
      if (!txt) return;
      const colors = { 2: '#ffffff', 3: '#f2f2f2', 4: '#ff2a3d', 5: '#ff7a1a' };
      this.text(txt, this.W / 2, this.oy + this.rows * this.S * 0.42, Math.min(this.W / 6.5, 62), n >= 6 ? '#e3192b' : colors[n], 1.1);
      if (n >= 4) Snd.fx('horn', n >= 6 ? 3 : 2);
    }

    // ------------------------------------------------------------ power-ups
    _act(ev) {
      const S = this.S;
      const p = this.center(ev.c, ev.r);
      const own = ev.id != null ? this.sprites.get(ev.id) : null;
      if (own) this.sprites.delete(ev.id);
      if (ev.ids) {
        const name = COMBO_NAME[ev.pw];
        if (name) this.text(name, this.W / 2, this.oy + this.rows * S * 0.4, Math.min(this.W / 8, 54), '#ff2a3d', 1.2);
        for (const id of ev.ids) {
          const sp = this.sprites.get(id);
          if (!sp) continue;
          sp.z = 3;
          this.tween(sp, { x: ev.c, y: ev.r, s: 1.4 }, 0.1, ease.in).then(() => this.sprites.delete(id));
        }
        this.ring(p.x, p.y, S * 0.3, S * 2, 0.4, '#fff', 6);
        this.nova(p.x, p.y, S * 2.4, 0.45, '#ff2a3d');
        this.glowBurst(p.x, p.y, '#ff2a3d', 18, 320, 0.4);
        this.slowMo(0.3, 0.3);
        this.punch(0.07);
        this.hooks.haptic && this.hooks.haptic(40);
      }
      switch (ev.pw) {
        case 'h': case 'v':
          Snd.fx('spray');
          return this.spray(ev.c, ev.r, ev.pw, 0, 1);
        case 'row': case 'col': {
          Snd.fx('scratch');
          this.drop(ev.pw, p.x, p.y, 0.2);
          return this.wait(0.2).then(() => { Snd.fx('spray'); return this.spray(ev.c, ev.r, ev.pw === 'row' ? 'h' : 'v', 0, 1, '#ffffff'); });
        }
        case 'cross':
          return this.wait(0.15).then(() => { Snd.fx('spray'); Snd.fx('scratch'); return Promise.all([this.spray(ev.c, ev.r, 'h', 0, 1.15), this.spray(ev.c, ev.r, 'v', 0, 1.15)]); });
        case 'bigcross':
          return this.wait(0.22).then(() => {
            Snd.fx('spray'); Snd.fx('boom');
            this.shakeAmp = 10;
            this.punch(0.06);
            this.nova(p.x, p.y, S * 3, 0.5, '#ff2a3d');
            const ps = [];
            for (let d = -1; d <= 1; d++) { ps.push(this.spray(ev.c, ev.r + d, 'h', 0, 1)); ps.push(this.spray(ev.c + d, ev.r, 'v', 0, 1)); }
            return Promise.all(ps);
          });
        case 'x': case 'xx': {
          const big = ev.pw === 'xx';
          const wind = (T.BOOM + (big ? 150 : 0)) / 1000;
          this.effects.push({ kind: 'pulse', key: 'x', x: p.x, y: p.y, t0: this.time, dur: wind, size: S * (big ? 1.4 : 1) });
          return this.wait(wind).then(() => this.blast(p.x, p.y, big ? 3.5 : 2.5, big));
        }
        case 'hammer':
          this.drop('hammer', p.x, p.y, 0.33);
          return this.wait(0.33).then(() => { Snd.fx('crate'); this.shakeAmp = 6; this.punch(0.04); this.ring(p.x, p.y, S * 0.2, S * 1.2, 0.3, '#fff', 5); this.burst(p.x, p.y, '#ff3347', 8); this.nova(p.x, p.y, S * 1.4, 0.35, '#ff2a3d'); this.smoke(p.x, p.y, 5, 1); });
        case 'pl': {
          if (!ev.ids && own == null && ev.id != null) { /* plane already gone */ }
          Snd.fx('plane');
          this.burst(p.x, p.y, '#ffffff', 6);
          if (!ev.to) return this.wait(0.2);
          const q = this.center(ev.to.c, ev.to.r);
          const dur = (ev.dur || T.PLANE) / 1000;
          const side = Math.random() < 0.5 ? -1 : 1;
          this.effects.push({ kind: 'plane', x0: p.x, y0: p.y, x1: q.x, y1: q.y, cx: (p.x + q.x) / 2 + side * S * 2.5, cy: Math.min(p.y, q.y) - S * 2.2, t0: this.time, dur, payload: ev.payload });
          return this.wait(dur).then(() => { this.ring(q.x, q.y, S * 0.2, S * 1.1, 0.3, '#ffffff', 4); this.shakeAmp = Math.max(this.shakeAmp, 4); });
        }
        case 'plpl':
          Snd.fx('plane');
          this.burst(p.x, p.y, '#ffffff', 12);
          return null;
        case 'plc':
          return null;
        case 'd': case 'dconv': {
          Snd.fx('platinum');
          const dur = ((ev.targets && ev.targets.length ? ev.targets[ev.targets.length - 1].at - ev.at : 0) + 260) / 1000;
          this.effects.push({ kind: 'disc', x: p.x, y: p.y, t0: this.time, dur: dur + 0.15, size: S * 1.15 });
          this.rays(p.x, p.y, S * 3, dur + 0.3, '#ffffff');
          this.punch(0.03);
          if (!ev.ids) this.text('PLATINUM!', this.W / 2, this.oy + this.rows * S * 0.4, Math.min(this.W / 7, 58), '#e6e9f5', 1.1);
          const col = TILE_COLORS[ev.col] || '#fff';
          for (const tg of ev.targets || []) {
            this.after((tg.at - ev.at) / 1000, () => {
              const q = this.center(tg.c, tg.r);
              this.bolt(p.x, p.y, q.x, q.y, 0.22, col);
              this.glowBurst(q.x, q.y, col, 4, 160, 0.3);
            });
          }
          return this.wait(dur);
        }
        case 'dd': {
          Snd.fx('horn', 3); Snd.fx('platinum');
          this.effects.push({ kind: 'disc', x: p.x, y: p.y, t0: this.time, dur: 1.1, size: S * 1.8 });
          this.effects.push({ kind: 'flash', t0: this.time + 0.2, dur: 0.6, color: '#ffffff' });
          return this.wait(0.25).then(() => {
            this.shakeAmp = 22;
            this.punch(0.12); this.slowMo(0.3, 0.5);
            this.nova(p.x, p.y, S * 6, 0.8, '#ffffff');
            this.rays(p.x, p.y, S * 6, 1.2, '#ffffff');
            this.glowBurst(p.x, p.y, '#ffffff', 40, 520, 0.5);
            for (let k = 0; k < 4; k++) this.ring(p.x, p.y, S * 0.5, S * (4 + k * 3), 0.6 + k * 0.2, NEON[k], 8);
            return this.wait(0.6);
          });
        }
        default:
          return null;
      }
    }

    spray(c, r, dir, delay, widthMul, color) {
      const S = this.S;
      const n = dir === 'h' ? this.cols : this.rows;
      const speed = 1000 / T.SPRAY;
      const dur = n / speed;
      const col = color || NEON[(c + r) % NEON.length];
      this.effects.push({ kind: 'spray', c, r, dir, t0: this.time + (delay || 0), speed, n, dur, w: S * 0.62 * (widthMul || 1), color: col });
      return this.wait((delay || 0) + Math.min(dur, 0.35));
    }

    blast(x, y, radCells, big) {
      const S = this.S;
      Snd.fx('boom');
      if (big) Snd.fx('horn', 2);
      this.shakeAmp = big ? 18 : 11;
      this.hooks.haptic && this.hooks.haptic(big ? 90 : 50);
      this.ring(x, y, S * 0.3, S * radCells, 0.42, '#ff2a3d', 10);
      this.ring(x, y, S * 0.2, S * radCells * 0.8, 0.35, '#e3192b', 6);
      this.ring(x, y, S * 0.5, S * radCells * 1.35, 0.6, '#ffffff', 3);
      this.nova(x, y, S * radCells * 1.1, 0.5, '#ff2a3d');
      this.glowBurst(x, y, '#ffb347', big ? 26 : 16, 380, 0.45);
      this.smoke(x, y, big ? 12 : 7, 1.6);
      this.debris(x, y, '#6b6b72', big ? 14 : 8);
      this.punch(big ? 0.09 : 0.05);
      if (big) this.slowMo(0.35, 0.35);
      this.effects.push({ kind: 'flash', t0: this.time, dur: 0.18, color: '#ffd6d6', alpha: 0.35 });
      for (let i = 0; i < (big ? 40 : 24); i++) {
        const a = Math.random() * Math.PI * 2, sp = (180 + Math.random() * 380) * (S / 50);
        this.part({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 300, life: 0.6 + Math.random() * 0.4, size: S * (0.08 + Math.random() * 0.1), color: NEON[i % 5], shape: i % 3 ? 'sq' : 'note', rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10 });
      }
      return this.wait(0.2);
    }

    slowMo(k, dur) { if (this.speed > 2) return; this.slowK = Math.min(this.slowT > 0 ? this.slowK : 1, k); this.slowT = Math.max(this.slowT, dur); }
    punch(a) { this.zoom = Math.max(this.zoom, a); }
    // soft additive glow dot, cached per color
    _glow(color) {
      let g = this.glowCache.get(color);
      if (g) return g;
      g = document.createElement('canvas'); g.width = g.height = 64;
      const x = g.getContext('2d'), rg = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      rg.addColorStop(0, '#ffffff'); rg.addColorStop(0.25, color); rg.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = rg; x.fillRect(0, 0, 64, 64);
      this.glowCache.set(color, g);
      return g;
    }
    glowBurst(x, y, color, n, spd, size) {
      const S = this.S;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, sp = (spd || 260) * (0.3 + Math.random()) * (S / 50);
        this.part({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 120, life: 0.35 + Math.random() * 0.4, size: S * (size || 0.35) * (0.5 + Math.random()), color, shape: i % 3 ? 'glow' : 'spark' });
      }
    }
    smoke(x, y, n, spread) {
      const S = this.S;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, sp = (20 + Math.random() * 90) * (S / 50) * (spread || 1);
        this.part({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20, g: -30, life: 0.7 + Math.random() * 0.5, size: S * (0.35 + Math.random() * 0.35), grow: S * 1.2, color: i % 2 ? '#3a3a3f' : '#55555c', shape: 'smoke' });
      }
    }
    splat(x, y, color, r) {
      if (this.decals.length > 40) this.decals.shift();
      this.decals.push({ x, y, color, r: r * (0.8 + Math.random() * 0.5), t0: this.time, dur: 1.6, seed: Math.random() * 1000 });
    }
    rays(x, y, size, dur, color) { this.effects.push({ kind: 'rays', x, y, size, dur, color: color || '#ffffff', t0: this.time }); }
    nova(x, y, r, dur, color) { this.effects.push({ kind: 'nova', x, y, r, dur, color: color || '#ff2a3d', t0: this.time }); }
    // Fireworks over the whole screen (screen coordinates on the fx canvas).
    fireworks(n, spanSec) {
      const cols = ['#e3192b', '#ffffff', '#ffd23f', '#ff5a64', '#d4d4d8'];
      for (let i = 0; i < (n || 7); i++) {
        this.after(Math.random() * (spanSec || 1.6), () => {
          const x = this.FW * (0.15 + Math.random() * 0.7);
          this.fxParts.push({ shell: true, x, y: this.FH + 10, vx: (Math.random() - 0.5) * 60, vy: -(this.FH * (0.9 + Math.random() * 0.45)), g: this.FH * 0.9, life: 0.85 + Math.random() * 0.25, max: 1, size: 6, color: cols[i % cols.length] });
          Snd.fx('pop', 9);
        });
      }
    }

    drop(key, x, y, dur) {
      this.effects.push({ kind: 'drop', key, x, y, t0: this.time, dur });
    }

    // ------------------------------------------------------------ particles
    part(p) {
      p.max = p.life;
      if (this.parts.length > 600) this.parts.shift();
      this.parts.push(p);
    }
    burst(x, y, color, n) {
      const S = this.S;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, sp = (60 + Math.random() * 200) * (S / 50);
        this.part({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, g: 520, life: 0.45 + Math.random() * 0.35, size: S * (0.07 + Math.random() * 0.08), color: i % 4 === 0 ? '#ffffff' : color, shape: i % 2 ? 'sq' : 'dot', rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14 });
      }
    }
    sparkle(x, y, n) {
      const S = this.S;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, sp = (40 + Math.random() * 160) * (S / 50);
        this.part({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 60, life: 0.5 + Math.random() * 0.4, size: S * (0.1 + Math.random() * 0.1), color: NEON[i % 5], shape: 'star', rot: Math.random() * 6, vr: (Math.random() - 0.5) * 6 });
      }
    }
    debris(x, y, color, n) {
      const S = this.S;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, sp = (120 + Math.random() * 220) * (S / 50);
        this.part({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 900, life: 0.6 + Math.random() * 0.3, size: S * (0.08 + Math.random() * 0.1), color, shape: 'sq', rot: Math.random() * 6, vr: (Math.random() - 0.5) * 16 });
      }
    }
    ring(x, y, r0, r1, dur, color, w) { this.effects.push({ kind: 'ring', x, y, r0, r1, dur, color, w, t0: this.time }); }
    bolt(x0, y0, x1, y1, dur, color) { this.effects.push({ kind: 'bolt', x0, y0, x1, y1, dur, color, t0: this.time }); }
    text(txt, x, y, size, color, dur, rise) {
      this.texts.push({ txt, x, y, size, color, dur: dur || 1, t0: this.time, rise: rise == null ? 30 : rise });
      if (size > this.S * 0.8) this.rays(x, y, size * 2.6, (dur || 1) * 0.9, color === '#ffffff' ? '#ffffff' : '#ff2a3d');
    }

    flyToGoal(gi, key, x, y, scale) {
      const target = this.hooks.goalPos(gi);
      if (!target) { this.hooks.goalTick(gi, -1); return; }
      const from = this.toFx(x, y);
      const dist = Math.hypot(target.x - from.x, target.y - from.y);
      this.flyers.push({
        key, x0: from.x, y0: from.y, x1: target.x, y1: target.y,
        cx: from.x + (target.x - from.x) * 0.2 + (Math.random() - 0.5) * 120, cy: Math.min(from.y, target.y) - 40 - Math.random() * 60,
        t0: this.time + Math.random() * 0.05, dur: 0.45 + Math.min(0.35, dist / 1600), s0: this.S * 0.9 * (scale || 1), s1: 26,
        cb: () => this.hooks.goalTick(gi, -1),
      });
    }

    // ---------------------------------------------------------------- update
    update(dt, real) {
      this.time += dt;
      real = real == null ? dt : real;
      this.zoom *= Math.pow(0.002, real);
      this.decals = this.decals.filter((d) => this.time - d.t0 < d.dur);
      // fireworks
      for (let i = this.fxParts.length - 1; i >= 0; i--) {
        const p = this.fxParts[i];
        p.life -= real;
        p.vy += p.g * real; p.x += p.vx * real; p.y += p.vy * real;
        if (!p.shell) { p.vx *= 1 - real * 1.6; p.vy *= 1 - real * 1.2; }
        if (p.life > 0) continue;
        this.fxParts.splice(i, 1);
        if (p.shell) {
          Snd.fx('boom');
          const n = 46;
          for (let k = 0; k < n; k++) {
            const a = (k / n) * Math.PI * 2, sp = 160 + Math.random() * 140;
            this.fxParts.push({ x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 140, life: 0.9 + Math.random() * 0.5, max: 1.3, size: 3 + Math.random() * 3, color: k % 5 === 0 ? '#ffffff' : p.color });
          }
        }
      }
      // timers
      if (this.timers.length) {
        const due = this.timers.filter((t) => t.t <= this.time);
        if (due.length) {
          this.timers = this.timers.filter((t) => t.t > this.time);
          due.sort((a, b) => a.t - b.t).forEach((t) => t.fn());
        }
      }
      // tweens
      for (let i = this.tweens.length - 1; i >= 0; i--) {
        const tw = this.tweens[i];
        tw.t += dt;
        const k = Math.min(1, tw.t / tw.dur), e = tw.ez(k);
        for (const key in tw.to) tw.obj[key] = tw.from[key] + (tw.to[key] - tw.from[key]) * e;
        if (k >= 1) { this.tweens.splice(i, 1); tw.res(); }
      }
      // falling sprites
      for (const sp of this.sprites.values()) {
        if (sp.sq > 0) sp.sq = Math.max(0, sp.sq - dt * 6);
        if (!sp.path) continue;
        if (sp.delay > 0) { sp.delay -= dt; continue; }
        sp.v = Math.min(sp.v + 60 * dt, 17);
        let move = sp.v * dt;
        while (move > 0 && sp.path.length) {
          const tg = sp.path[0];
          const dx = tg.x - sp.x, dy = tg.y - sp.y, d = Math.hypot(dx, dy);
          if (d <= move) { sp.x = tg.x; sp.y = tg.y; move -= d; sp.path.shift(); }
          else { sp.x += (dx / d) * move; sp.y += (dy / d) * move; move = 0; }
        }
        if (!sp.path.length) {
          sp.path = null; sp.sq = 1;
          const cb = sp.onLand; sp.onLand = null;
          if (cb) cb();
        }
      }
      // particles
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const p = this.parts[i];
        p.life -= dt;
        if (p.life <= 0) { this.parts.splice(i, 1); continue; }
        p.vy += (p.g || 0) * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vx *= 1 - dt * 0.8;
        if (p.vr) p.rot = (p.rot || 0) + p.vr * dt;
      }
      // spray effects shed paint droplets
      for (const e of this.effects) {
        if (e.kind !== 'spray') continue;
        const el = this.time - e.t0;
        if (el < 0 || el > e.dur) continue;
        const d = el * e.speed;
        for (const s of [-1, 1]) {
          const cc = e.dir === 'h' ? e.c + s * d : e.c, rr = e.dir === 'v' ? e.r + s * d : e.r;
          if (cc < -0.5 || rr < -0.5 || cc > this.cols - 0.5 || rr > this.rows - 0.5) continue;
          const p = this.center(cc, rr);
          if (Math.random() < 0.7) this.part({ x: p.x, y: p.y, vx: (Math.random() - 0.5) * 120, vy: (Math.random() - 0.5) * 120, g: 200, life: 0.35, size: this.S * 0.1, color: e.color, shape: 'dot' });
          // sparks and smoke out of the nozzle, paint left on the wall
          const back = e.dir === 'h' ? { x: -s, y: 0 } : { x: 0, y: -s };
          for (let k = 0; k < 2; k++) this.part({ x: p.x, y: p.y, vx: back.x * (150 + Math.random() * 220) + (Math.random() - 0.5) * 90, vy: back.y * (150 + Math.random() * 220) + (Math.random() - 0.5) * 90, g: 60, life: 0.25 + Math.random() * 0.2, size: this.S * (0.2 + Math.random() * 0.25), color: k ? '#ffb347' : e.color, shape: k ? 'spark' : 'glow' });
          if (Math.random() < 0.25) this.part({ x: p.x, y: p.y, vx: back.x * 40, vy: back.y * 40 - 20, g: -40, life: 0.6, size: this.S * 0.3, grow: this.S * 0.9, color: '#4a4a50', shape: 'smoke' });
          const cell = Math.round(e.dir === 'h' ? cc : rr);
          const key = s + ':' + cell;
          e.splats = e.splats || {};
          if (!e.splats[key]) { e.splats[key] = 1; this.splat(p.x, p.y, e.color, this.S * 0.42); }
        }
      }
      this.effects = this.effects.filter((e) => this.time - e.t0 < e.dur + 0.5);
      this.texts = this.texts.filter((t) => this.time - t.t0 < t.dur);
      // flyers
      for (let i = this.flyers.length - 1; i >= 0; i--) {
        const f = this.flyers[i];
        if (this.time - f.t0 >= f.dur) { this.flyers.splice(i, 1); f.cb(); }
      }
      this.shakeAmp *= Math.pow(0.0015, dt);
      if (this.boss) {
        this.boss.flash = Math.max(0, this.boss.flash - dt * 4);
        this.boss.shake = Math.max(0, this.boss.shake - dt * 4);
      }
      // idle hint
      if (!this.busy && this.eng && this.eng.status === 'playing' && !this.tut && !this.targeting && this.hooks.canHint && this.hooks.canHint()) {
        this.idle += dt;
        if (this.idle > 5 && !this.hint) this.hint = this.eng.hint();
      }
    }

    // ------------------------------------------------------------------ draw
    draw() {
      const ctx = this.ctx, dpr = this.dpr || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, this.W, this.H);
      const f = this.fctx;
      f.setTransform(dpr, 0, 0, dpr, 0, 0);
      f.clearRect(0, 0, this.FW, this.FH);
      if (!this.eng || !this.bg) return;
      const sx = this.shakeAmp > 0.3 ? (Math.random() - 0.5) * this.shakeAmp : 0;
      const sy = this.shakeAmp > 0.3 ? (Math.random() - 0.5) * this.shakeAmp : 0;
      ctx.save();
      ctx.translate(sx, sy);
      if (this.zoom > 0.002) {
        const cx = this.ox + this.cols * this.S / 2, cy = this.oy + this.rows * this.S / 2, z = 1 + this.zoom;
        ctx.translate(cx, cy); ctx.scale(z, z); ctx.translate(-cx, -cy);
      }
      ctx.drawImage(this.bg, 0, 0, this.W, this.H);
      this._drawFloors(ctx);
      this._drawDecals(ctx);
      if (this.hasCrowns) this._drawExits(ctx);
      ctx.save();
      ctx.beginPath();
      for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
        if (this.v[r][c].p) ctx.rect(this.ox + c * this.S, this.oy + r * this.S, this.S, this.S);
      }
      ctx.clip();
      this._drawTiles(ctx);
      ctx.restore();
      this._drawCells(ctx);
      this._drawBoss(ctx);
      this._drawSelection(ctx);
      this._drawEffects(ctx);
      this._drawParticles(ctx);
      ctx.restore();
      this._drawTutorial(ctx);
      this._drawCombo(ctx);
      this._drawTexts(ctx);
      this._drawFlyers(f);
      this._drawFireworks(f);
    }

    _drawDecals(ctx) {
      for (const d of this.decals) {
        const k = (this.time - d.t0) / d.dur;
        const a = k < 0.1 ? k / 0.1 : 1 - Math.max(0, (k - 0.5) / 0.5);
        ctx.save();
        ctx.globalAlpha = 0.55 * a;
        ctx.fillStyle = d.color;
        ctx.translate(d.x, d.y);
        ctx.beginPath();
        const n = 9;
        for (let i = 0; i <= n; i++) {
          const an = (i / n) * Math.PI * 2, rr = d.r * (0.7 + 0.35 * Math.abs(Math.sin(d.seed + i * 2.3)));
          if (i === 0) ctx.moveTo(Math.cos(an) * rr, Math.sin(an) * rr); else ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr);
        }
        ctx.fill();
        // drips run down over time
        for (let i = 0; i < 3; i++) {
          const dx = (Math.sin(d.seed * (i + 1)) * 0.6) * d.r, len = d.r * (0.4 + 0.8 * Math.abs(Math.cos(d.seed + i))) * Math.min(1, k * 2.5);
          ctx.fillRect(dx - d.r * 0.07, 0, d.r * 0.14, d.r * 0.5 + len);
          ctx.beginPath(); ctx.arc(dx, d.r * 0.5 + len, d.r * 0.1, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }
    }

    _drawCombo(ctx) {
      const c = this.comboShow, el = this.time - c.t;
      if (c.n < 2 || el > 1.4) return;
      const S = this.S;
      const a = el > 1 ? 1 - (el - 1) / 0.4 : 1;
      const pop = el < 0.15 ? ease.back(el / 0.15) : 1;
      const x = this.ox + this.cols * S - S * 0.2, y = this.oy - S * 0.05;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(x, y); ctx.scale(pop, pop); ctx.rotate(0.08);
      // flame glow behind the badge
      if (c.n >= 3) {
        ctx.globalCompositeOperation = 'lighter';
        const g = this._glow(c.n >= 5 ? '#ff2a3d' : '#ff7a1a');
        const fl = S * (1.4 + 0.15 * Math.sin(this.time * 20));
        ctx.drawImage(g, -fl * 1.2, -fl * 0.8, fl * 1.6, fl * 1.6);
        ctx.globalCompositeOperation = 'source-over';
      }
      const w = S * 2.1, h = S * 0.95;
      const gr = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
      gr.addColorStop(0, '#ff5a64'); gr.addColorStop(0.5, '#e3192b'); gr.addColorStop(1, '#7a0911');
      ctx.fillStyle = '#050505';
      ctx.beginPath(); roundRect(ctx, -w - 3, -h / 2 - 3, w + 6, h + 6, h / 2 + 3); ctx.fill();
      ctx.fillStyle = gr;
      ctx.beginPath(); roundRect(ctx, -w, -h / 2, w, h, h / 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.beginPath(); roundRect(ctx, -w + h * 0.25, -h / 2 + 3, w - h * 0.5, h * 0.3, h * 0.15); ctx.fill();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `${Math.round(h * 0.3)}px 'Bungee', Impact, sans-serif`;
      ctx.fillStyle = '#fff';
      ctx.fillText('COMBO', -w / 2, -h * 0.2);
      ctx.font = `${Math.round(h * 0.55)}px ${DISPLAY_FONT}`;
      ctx.lineWidth = 4; ctx.strokeStyle = '#050505'; ctx.lineJoin = 'round';
      ctx.strokeText('x' + c.n, -w / 2, h * 0.17);
      ctx.fillText('x' + c.n, -w / 2, h * 0.17);
      ctx.restore();
    }

    _drawFireworks(f) {
      if (!this.fxParts.length) return;
      f.save();
      f.globalCompositeOperation = 'lighter';
      for (const p of this.fxParts) {
        const a = Math.max(0, Math.min(1, p.life / p.max * 1.5));
        f.globalAlpha = a;
        const g = this._glow(p.color), s = p.size * (p.shell ? 2.4 : 1.8);
        f.drawImage(g, p.x - s, p.y - s, s * 2, s * 2);
        // streak along the motion, white-hot core
        f.strokeStyle = p.color; f.lineWidth = p.shell ? 3 : 2; f.lineCap = 'round';
        f.beginPath(); f.moveTo(p.x, p.y); f.lineTo(p.x - p.vx * 0.06, p.y - p.vy * 0.06); f.stroke();
        f.fillStyle = '#fff'; f.fillRect(p.x - 1, p.y - 1, 2, 2);
      }
      f.restore();
    }

    _drawFloors(ctx) {
      const S = this.S, pulse = Snd.pulse ? Snd.pulse() : 0;
      for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
        const cl = this.v[r][c];
        if (!cl.p) continue;
        const x = this.ox + c * S, y = this.oy + r * S;
        if (cl.floor > 0) {
          // Unlit dance floor: the disco tile, dimmed to almost dark.
          const spr = this._spr('floor', S);
          if (spr) ctx.drawImage(spr, x + 1, y + 1, S - 2, S - 2);
          ctx.fillStyle = 'rgba(10, 10, 11, .78)';
          ctx.beginPath(); roundRect(ctx, x + 2, y + 2, S - 4, S - 4, S * 0.12); ctx.fill();
          ctx.strokeStyle = cl.floor > 1 ? '#ff2a3d' : 'rgba(200, 200, 205, .6)';
          ctx.lineWidth = cl.floor > 1 ? 3 : 1.6;
          ctx.beginPath(); roundRect(ctx, x + 2.5, y + 2.5, S - 5, S - 5, S * 0.14); ctx.stroke();
          if (cl.floor > 1) {
            ctx.strokeStyle = 'rgba(255,42,61,.5)';
            ctx.lineWidth = 1.5;
            ctx.beginPath(); roundRect(ctx, x + 7, y + 7, S - 14, S - 14, S * 0.1); ctx.stroke();
          }
        } else if (cl.lit) {
          // Lit dance floor glows and pulses with the kick drum.
          const fresh = Math.max(0, 1 - (this.time - cl.litT) * 2);
          const spr = this._spr('floor', S);
          ctx.globalAlpha = 0.42 + pulse * 0.3 + fresh * 0.28;
          if (spr) ctx.drawImage(spr, x + 1, y + 1, S - 2, S - 2);
          ctx.globalAlpha = 1;
        }
      }
    }

    _drawExits(ctx) {
      const S = this.S;
      const bob = Math.sin(this.time * 4) * 2;
      ctx.fillStyle = '#ff2a3d';
      ctx.strokeStyle = '#050505';
      ctx.lineWidth = 2;
      for (let c = 0; c < this.cols; c++) {
        const r = this.eng.botRow[c];
        if (r < 0) continue;
        const x = this.ox + (c + 0.5) * S, y = this.oy + (r + 1) * S + 7 + bob;
        ctx.beginPath();
        ctx.moveTo(x - S * 0.16, y - S * 0.06); ctx.lineTo(x, y + S * 0.1); ctx.lineTo(x + S * 0.16, y - S * 0.06);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }

    _drawTiles(ctx) {
      const S = this.S;
      const list = [...this.sprites.values()].sort((a, b) => a.z - b.z);
      const hint = this.hint;
      for (const sp of list) {
        if (sp.a <= 0.01 || sp.s <= 0.01) continue;
        const key = this._keyOf(sp);
        const base = sp.k === 'c' ? 0.95 : sp.k === 'p' ? 1.0 : 0.96;
        let size = S * base * sp.s;
        let x = this.ox + (sp.x + 0.5) * S, y = this.oy + (sp.y + 0.5) * S;
        let rot = sp.rot;
        if (sp.k === 'p' && !sp.path) {
          size *= 1 + Math.sin(this.time * 5 + sp.id) * 0.035;
          if (sp.pw === 'd') rot += this.time * 1.4;
        }
        if (sp.k === 'c') y += Math.sin(this.time * 3 + sp.id) * S * 0.03;
        if (hint && !this.busy) {
          const inHint = (hint.t === 'tap' && hint.c === Math.round(sp.x) && hint.r === Math.round(sp.y)) ||
            (hint.t === 'swap' && ((hint.a.c === Math.round(sp.x) && hint.a.r === Math.round(sp.y)) || (hint.b.c === Math.round(sp.x) && hint.b.r === Math.round(sp.y))));
          if (inHint && !sp.path) {
            const w = Math.sin(this.time * 9);
            if (hint.t === 'swap') {
              const dx = hint.b.c - hint.a.c, dy = hint.b.r - hint.a.r;
              const sgn = hint.a.c === Math.round(sp.x) && hint.a.r === Math.round(sp.y) ? 1 : -1;
              x += dx * w * S * 0.07 * sgn; y += dy * w * S * 0.07 * sgn;
            } else size *= 1 + Math.abs(w) * 0.12;
          }
        }
        const spr = this._spr(key, size, size);
        if (!spr) continue;
        if (sp.k === 'p' && sp.a > 0.5) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.28 + 0.14 * Math.sin(this.time * 4 + sp.id);
          const g = this._glow(sp.pw === 'd' ? '#ffffff' : '#ff2a3d'), gs = size * 0.85;
          ctx.drawImage(g, x - gs, y - gs, gs * 2, gs * 2);
          ctx.restore();
          if (!this.busy && Math.random() < 0.012) this.part({ x: x + (Math.random() - 0.5) * size * 0.7, y: y + (Math.random() - 0.5) * size * 0.7, vx: 0, vy: -10, g: 0, life: 0.6, size: S * 0.18, color: '#ffffff', shape: 'star', rot: 0, vr: 3 });
        }
        let sxk = 1, syk = 1;
        if (sp.sq > 0) { syk = 1 - sp.sq * 0.18; sxk = 1 + sp.sq * 0.12; y += sp.sq * S * 0.07; }
        ctx.save();
        ctx.globalAlpha = sp.a;
        ctx.translate(x, y);
        if (rot) ctx.rotate(rot);
        ctx.scale(sxk, syk);
        ctx.drawImage(spr, -size / 2, -size / 2, size, size);
        ctx.restore();
      }
    }

    _drawCells(ctx) {
      const S = this.S;
      for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
        const cl = this.v[r][c];
        if (!cl.p) continue;
        const x = this.ox + (c + 0.5) * S, y = this.oy + (r + 0.5) * S;
        if (cl.tape) {
          const size = S * 1.02;
          const spr = this._spr('tape', size);
          if (spr) ctx.drawImage(spr, x - size / 2, y - size / 2, size, size);
        }
        const b = cl.block;
        if (!b || b.t === 'boss') continue;
        const hit = Math.max(0, 1 - (this.time - cl.hitT) * 5);
        const jx = hit > 0 ? (Math.random() - 0.5) * hit * S * 0.12 : 0;
        const pop = hit > 0 ? 1 + hit * 0.06 : 1;
        if (b.t === 'crate') {
          const size = S * 0.98 * pop;
          const spr = this._spr('c' + b.hp, size);
          if (spr) ctx.drawImage(spr, x - size / 2 + jx, y - size / 2, size, size);
        } else if (b.t === 'static') {
          // static crackles: a quick jitter and flicker every few frames
          const tick = Math.floor(this.time * 12 + c * 7 + r * 3);
          const glitch = tick % 9 === 0 ? (((tick * 37) % 7) - 3) * S * 0.012 : 0;
          const size = S * (0.98 + Math.sin(this.time * 6 + c + r) * 0.02) * pop;
          const spr = this._spr('static', size);
          if (spr) {
            ctx.globalAlpha = tick % 13 === 0 ? 0.82 : 1;
            ctx.drawImage(spr, x - size / 2 + jx + glitch, y - size / 2, size, size);
            ctx.globalAlpha = 1;
          }
        }
      }
    }

    _drawBoss(ctx) {
      const B = this.boss;
      if (!B) return;
      const S = this.S;
      const w = B.w * S, h = B.h * S;
      let x = this.ox + B.x * S, y = this.oy + B.y * S;
      let scale = 1, alpha = 1, rot = 0;
      if (B.dead) {
        const k = Math.min(1, (this.time - B.deadT) / 0.6);
        if (k >= 1) return;
        scale = 1 + k * 0.4; alpha = 1 - k; rot = k * 0.5;
      }
      y += Math.sin(this.time * 2.2) * S * 0.04;
      if (B.shake > 0) x += (Math.random() - 0.5) * B.shake * S * 0.2;
      if (B.wind) scale *= 1 + Math.abs(Math.sin(this.time * 18)) * 0.05;
      // A lit stage panel fills the boss's cells; the boss bursts out above it.
      if (!B.dead) {
        const bx0 = this.ox + B.x * S + 2, by0 = this.oy + B.y * S + 2;
        const g0 = ctx.createRadialGradient(bx0 + w / 2, by0 + h * 0.9, S * 0.2, bx0 + w / 2, by0 + h * 0.6, Math.max(w, h));
        g0.addColorStop(0, B.wind ? 'rgba(255, 59, 92, .75)' : 'rgba(120, 120, 128, .7)');
        g0.addColorStop(1, 'rgba(10, 10, 11, .95)');
        ctx.fillStyle = g0;
        ctx.beginPath(); roundRect(ctx, bx0, by0, w - 4, h - 4, S * 0.25); ctx.fill();
        ctx.strokeStyle = 'rgba(227, 25, 43, .8)'; ctx.lineWidth = 2;
        ctx.beginPath(); roundRect(ctx, bx0, by0, w - 4, h - 4, S * 0.25); ctx.stroke();
      }
      const size = w * 1.45;
      const spr = this._spr('boss_' + B.kind, size);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x + w / 2, y + h);
      ctx.rotate(rot);
      ctx.scale(scale, scale);
      if (spr) ctx.drawImage(spr, -size / 2, -size, size, size);
      if (B.flash > 0 && spr) {
        ctx.globalAlpha = alpha * B.flash * 0.6;
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(spr, -size / 2, -size, size, size);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.restore();
      if (B.dead) return;
      // health bar along the bottom edge of the boss
      const bw = w * 0.86, bh = Math.max(8, S * 0.2);
      const bx = x + (w - bw) / 2, by = this.oy + (B.y + B.h) * S - bh - 3;
      ctx.fillStyle = '#050505';
      ctx.beginPath(); roundRect(ctx, bx - 2, by - 2, bw + 4, bh + 4, bh / 2 + 2); ctx.fill();
      const k = Math.max(0, B.hp / B.max);
      const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      g.addColorStop(0, '#ff3b5c'); g.addColorStop(1, '#ff2a3d');
      ctx.fillStyle = g;
      if (k > 0) { ctx.beginPath(); roundRect(ctx, bx, by, Math.max(bh, bw * k), bh, bh / 2); ctx.fill(); }
      ctx.fillStyle = '#fff';
      ctx.font = `${Math.round(bh * 0.85)}px Bungee, Impact, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(B.hp), bx + bw / 2, by + bh / 2 + 1);
    }

    _drawSelection(ctx) {
      const S = this.S;
      if (this.sel && !this.busy) {
        const x = this.ox + this.sel.c * S, y = this.oy + this.sel.r * S;
        ctx.strokeStyle = '#ff2a3d';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#ff2a3d'; ctx.shadowBlur = 12;
        ctx.beginPath(); roundRect(ctx, x + 2, y + 2, S - 4, S - 4, S * 0.18); ctx.stroke();
        ctx.shadowBlur = 0;
      }
      if (this.targeting) {
        const a = 0.35 + Math.sin(this.time * 6) * 0.15;
        ctx.strokeStyle = `rgba(255,255,255,${a})`;
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 6]);
        ctx.lineDashOffset = -this.time * 20;
        ctx.beginPath();
        roundRect(ctx, this.ox - 4, this.oy - 4, this.cols * S + 8, this.rows * S + 8, 14);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    _drawEffects(ctx) {
      const S = this.S;
      for (const e of this.effects) {
        const el = this.time - e.t0;
        if (el < 0) continue;
        const k = Math.min(1, el / e.dur);
        switch (e.kind) {
          case 'ring': {
            if (k >= 1) break;
            ctx.strokeStyle = e.color;
            ctx.globalAlpha = 1 - k;
            ctx.lineWidth = e.w * (1 - k) + 1;
            ctx.beginPath(); ctx.arc(e.x, e.y, e.r0 + (e.r1 - e.r0) * ease.cubic(k), 0, Math.PI * 2); ctx.stroke();
            ctx.globalAlpha = 1;
            break;
          }
          case 'flash': {
            if (k >= 1) break;
            ctx.fillStyle = e.color;
            ctx.globalAlpha = (e.alpha || 0.6) * (1 - k);
            ctx.fillRect(0, 0, this.W, this.H);
            ctx.globalAlpha = 1;
            break;
          }
          case 'spray': {
            const d = Math.min(e.n, el * e.speed);
            const fade = el > e.dur ? Math.max(0, 1 - (el - e.dur) / 0.35) : 1;
            if (fade <= 0) break;
            const p = this.center(e.c, e.r);
            const pos = e.dir === 'h' ? e.c : e.r, len = e.dir === 'h' ? this.cols : this.rows;
            const lo = Math.min(d, pos + 0.5), hi = Math.min(d, len - 0.5 - pos);
            ctx.save();
            ctx.globalAlpha = 0.75 * fade;
            ctx.fillStyle = e.color;
            ctx.shadowColor = e.color; ctx.shadowBlur = 16;
            if (e.dir === 'h') {
              ctx.beginPath(); roundRect(ctx, p.x - lo * S, p.y - e.w / 2, (lo + hi) * S, e.w, e.w / 2); ctx.fill();
              ctx.globalAlpha = 0.9 * fade; ctx.fillStyle = '#fff';
              ctx.fillRect(p.x - lo * S, p.y - e.w * 0.12, (lo + hi) * S, e.w * 0.24);
            } else {
              ctx.beginPath(); roundRect(ctx, p.x - e.w / 2, p.y - lo * S, e.w, (lo + hi) * S, e.w / 2); ctx.fill();
              ctx.globalAlpha = 0.9 * fade; ctx.fillStyle = '#fff';
              ctx.fillRect(p.x - e.w * 0.12, p.y - lo * S, e.w * 0.24, (lo + hi) * S);
            }
            ctx.restore();
            const can = this._spr(e.dir, S * 0.9);
            for (const [s, lim] of [[-1, lo], [1, hi]]) {
              if (d > lim || !can) continue;
              const q = e.dir === 'h' ? { x: p.x + s * d * S, y: p.y } : { x: p.x, y: p.y + s * d * S };
              ctx.drawImage(can, q.x - S * 0.45, q.y - S * 0.45, S * 0.9, S * 0.9);
            }
            break;
          }
          case 'bolt': {
            if (k >= 1) break;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.lineJoin = 'round'; ctx.lineCap = 'round';
            ctx.globalAlpha = 1 - k * 0.7;
            // jagged main bolt with two forks, drawn as wide glow then hot core
            const pts = [], n = 9;
            for (let i = 0; i <= n; i++) {
              const t = i / n;
              let x = e.x0 + (e.x1 - e.x0) * t, y = e.y0 + (e.y1 - e.y0) * t;
              if (i > 0 && i < n) { x += (Math.random() - 0.5) * S * 0.5; y += (Math.random() - 0.5) * S * 0.5; }
              pts.push([x, y]);
            }
            const forks = [];
            for (let f2 = 0; f2 < 2; f2++) {
              const st = pts[2 + Math.floor(Math.random() * (n - 4))], an = Math.random() * Math.PI * 2;
              forks.push([st, [st[0] + Math.cos(an) * S * 0.6, st[1] + Math.sin(an) * S * 0.6], [st[0] + Math.cos(an + 0.5) * S * 1.1, st[1] + Math.sin(an + 0.5) * S * 1.1]]);
            }
            const path = (list) => { ctx.beginPath(); list.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); };
            for (const [w, col, al] of [[S * 0.32, e.color, 0.25], [S * 0.12, e.color, 0.7], [2, '#ffffff', 1]]) {
              ctx.strokeStyle = col; ctx.lineWidth = w; ctx.globalAlpha = al * (1 - k * 0.7);
              path(pts); forks.forEach((fk) => { ctx.lineWidth = w * 0.6; path(fk); });
            }
            const g = this._glow(e.color);
            ctx.globalAlpha = 1 - k;
            ctx.drawImage(g, e.x1 - S * 0.8, e.y1 - S * 0.8, S * 1.6, S * 1.6);
            ctx.restore();
            break;
          }
          case 'rays': {
            if (k >= 1) break;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.translate(e.x, e.y); ctx.rotate(el * 1.2);
            const a = k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8;
            const R = e.size * (0.7 + 0.3 * ease.out(Math.min(1, k * 2)));
            const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
            gr.addColorStop(0, e.color); gr.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = gr; ctx.globalAlpha = 0.55 * a;
            for (let i = 0; i < 12; i++) {
              ctx.beginPath(); ctx.moveTo(0, 0);
              ctx.arc(0, 0, R, (i / 12) * Math.PI * 2, (i / 12) * Math.PI * 2 + 0.22);
              ctx.closePath(); ctx.fill();
            }
            ctx.restore();
            break;
          }
          case 'nova': {
            if (k >= 1) break;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const R = e.r * ease.cubic(k);
            const gr = ctx.createRadialGradient(e.x, e.y, R * 0.2, e.x, e.y, Math.max(1, R));
            gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.75, e.color); gr.addColorStop(0.92, '#ffffff'); gr.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.globalAlpha = 1 - k;
            ctx.fillStyle = gr;
            ctx.beginPath(); ctx.arc(e.x, e.y, Math.max(1, R), 0, Math.PI * 2); ctx.fill();
            // hot core
            const g = this._glow('#ffffff'), cs = e.r * 0.5 * (1 - k);
            ctx.drawImage(g, e.x - cs, e.y - cs, cs * 2, cs * 2);
            ctx.restore();
            break;
          }
          case 'plane': {
            if (k >= 1) break;
            const t = ease.inOut(k);
            const bx = (1 - t) * (1 - t) * e.x0 + 2 * (1 - t) * t * e.cx + t * t * e.x1;
            const by = (1 - t) * (1 - t) * e.y0 + 2 * (1 - t) * t * e.cy + t * t * e.y1;
            const tx = 2 * (1 - t) * (e.cx - e.x0) + 2 * t * (e.x1 - e.cx);
            const ty = 2 * (1 - t) * (e.cy - e.y0) + 2 * t * (e.y1 - e.cy);
            const ang = Math.atan2(ty, tx) + Math.PI / 4;
            if (Math.random() < 0.8) this.part({ x: bx, y: by, vx: 0, vy: 0, g: 0, life: 0.3, size: S * 0.12, color: NEON[Math.floor(Math.random() * 5)], shape: 'dot' });
            this.part({ x: bx, y: by, vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30, g: 0, life: 0.35, size: S * 0.28, color: '#ff2a3d', shape: 'glow' });
            const size = S * (1.1 + Math.sin(k * Math.PI) * 0.5);
            const spr = this._spr('pl', size);
            ctx.save(); ctx.translate(bx, by);
            if (e.payload) {
              const ps = this._spr(e.payload, size * 0.7);
              if (ps) ctx.drawImage(ps, -size * 0.35, -size * 0.35 + size * 0.3, size * 0.7, size * 0.7);
            }
            ctx.rotate(ang);
            if (spr) ctx.drawImage(spr, -size / 2, -size / 2, size, size);
            ctx.restore();
            break;
          }
          case 'disc': {
            if (k >= 1) break;
            const spr = this._spr('d', e.size);
            ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(el * 14);
            ctx.globalAlpha = k > 0.8 ? (1 - k) * 5 : 1;
            ctx.shadowColor = '#fff'; ctx.shadowBlur = 20;
            if (spr) ctx.drawImage(spr, -e.size / 2, -e.size / 2, e.size, e.size);
            ctx.restore();
            break;
          }
          case 'pulse': {
            if (k >= 1) break;
            const size = e.size * (1 + k * 0.45);
            const spr = this._spr(e.key, size);
            ctx.save(); ctx.translate(e.x + (Math.random() - 0.5) * k * 6, e.y);
            if (spr) ctx.drawImage(spr, -size / 2, -size / 2, size, size);
            ctx.restore();
            break;
          }
          case 'drop': {
            if (k >= 1) break;
            const size = S * 1.3;
            const spr = this._spr(e.key, size);
            const y = e.y - (1 - ease.in(k)) * S * 4;
            ctx.save(); ctx.globalAlpha = Math.min(1, k * 3);
            if (spr) ctx.drawImage(spr, e.x - size / 2, y - size / 2, size, size);
            ctx.restore();
            break;
          }
          default:
            break;
        }
      }
    }

    _drawParticles(ctx) {
      for (const p of this.parts) {
        const a = Math.max(0, Math.min(1, p.life / p.max * 1.4));
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        const s = p.size;
        switch (p.shape) {
          case 'glow': {
            ctx.globalCompositeOperation = 'lighter';
            const g = this._glow(p.color), gs = s * (0.6 + 0.4 * (p.life / p.max));
            ctx.drawImage(g, p.x - gs, p.y - gs, gs * 2, gs * 2);
            ctx.globalCompositeOperation = 'source-over';
            break;
          }
          case 'spark': {
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = p.color; ctx.lineWidth = Math.max(1.5, s * 0.12); ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05); ctx.stroke();
            ctx.globalCompositeOperation = 'source-over';
            break;
          }
          case 'smoke': {
            const k = 1 - p.life / p.max, r = s / 2 + (p.grow || 0) * k * 0.5;
            ctx.globalAlpha = 0.35 * (1 - k);
            ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
            break;
          }
          case 'dot': ctx.beginPath(); ctx.arc(p.x, p.y, s / 2, 0, Math.PI * 2); ctx.fill(); break;
          case 'sq':
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0); ctx.fillRect(-s / 2, -s / 2, s, s); ctx.restore(); break;
          case 'star':
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0);
            ctx.beginPath();
            for (let i = 0; i < 8; i++) { const r = i % 2 ? s * 0.22 : s * 0.6, an = (i * Math.PI) / 4; ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r); }
            ctx.closePath(); ctx.fill(); ctx.restore(); break;
          case 'strip':
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0);
            ctx.fillRect(-s / 2, -s * 0.12, s, s * 0.24);
            ctx.strokeStyle = '#050505'; ctx.lineWidth = 1.2; ctx.strokeRect(-s / 2, -s * 0.12, s, s * 0.24);
            ctx.restore(); break;
          case 'disc':
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0);
            ctx.fillStyle = '#14111f'; ctx.beginPath(); ctx.arc(0, 0, s / 2, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(0, 0, s / 5, 0, Math.PI * 2); ctx.fill();
            ctx.restore(); break;
          case 'note':
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate((p.rot || 0) * 0.3);
            ctx.font = `${Math.round(s * 2.2)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('♪', 0, 0); ctx.restore(); break;
          default: break;
        }
      }
      ctx.globalAlpha = 1;
    }

    _drawTexts(ctx) {
      for (const t of this.texts) {
        const el = this.time - t.t0, k = el / t.dur;
        const s = k < 0.18 ? ease.back(k / 0.18) : 1;
        const a = k > 0.7 ? Math.max(0, 1 - (k - 0.7) / 0.3) : 1;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(t.x, t.y - k * t.rise);
        ctx.rotate(-0.06);
        ctx.scale(s, s);
        ctx.font = `${Math.round(t.size)}px ${DISPLAY_FONT}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        if (t.size > this.S * 0.8) {
          // glossy sticker text: thick black outline, white to color fill, top shine
          ctx.lineWidth = Math.max(6, t.size * 0.24);
          ctx.strokeStyle = '#050505';
          ctx.strokeText(t.txt, 0, t.size * 0.06);
          ctx.strokeText(t.txt, 0, 0);
          const gr = ctx.createLinearGradient(0, -t.size / 2, 0, t.size / 2);
          gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.45, t.color === '#ffffff' ? '#e6e6ea' : t.color); gr.addColorStop(1, t.color === '#ffffff' ? '#9a9aa0' : '#7a0911');
          ctx.fillStyle = gr;
          ctx.fillText(t.txt, 0, 0);
          ctx.globalAlpha = a * 0.5;
          ctx.lineWidth = Math.max(1.5, t.size * 0.04);
          ctx.strokeStyle = '#ffffff';
          ctx.strokeText(t.txt, 0, -t.size * 0.03);
        } else {
          ctx.lineWidth = Math.max(4, t.size * 0.16);
          ctx.strokeStyle = '#050505';
          ctx.strokeText(t.txt, 0, 0);
          ctx.fillStyle = t.color;
          ctx.fillText(t.txt, 0, 0);
        }
        ctx.restore();
      }
    }

    _drawFlyers(f) {
      for (const fl of this.flyers) {
        const el = this.time - fl.t0;
        if (el < 0) continue;
        const k = Math.min(1, el / fl.dur), t = ease.in(k);
        const x = (1 - t) * (1 - t) * fl.x0 + 2 * (1 - t) * t * fl.cx + t * t * fl.x1;
        const y = (1 - t) * (1 - t) * fl.y0 + 2 * (1 - t) * t * fl.cy + t * t * fl.y1;
        const size = fl.s0 + (fl.s1 - fl.s0) * t;
        const spr = this._spr(fl.key, size);
        if (spr) f.drawImage(spr, x - size / 2, y - size / 2, size, size);
      }
    }

    _drawTutorial(ctx) {
      const tut = this.tut;
      if (!tut || this.busy) return;
      const S = this.S;
      ctx.save();
      ctx.fillStyle = 'rgba(8,8,9,.62)';
      ctx.beginPath();
      ctx.rect(0, 0, this.W, this.H);
      for (const p of tut.cells) roundRect(ctx, this.ox + p.c * S + 1, this.oy + p.r * S + 1, S - 2, S - 2, S * 0.16);
      ctx.fill('evenodd');
      ctx.strokeStyle = '#ff2a3d';
      ctx.lineWidth = 3;
      for (const p of tut.cells) { ctx.beginPath(); roundRect(ctx, this.ox + p.c * S + 1, this.oy + p.r * S + 1, S - 2, S - 2, S * 0.16); ctx.stroke(); }
      const hand = this._spr('hand', S * 0.9);
      if (hand) {
        let hx, hy;
        if (tut.kind === 'swap') {
          const k = (this.time % 1.4) / 1.4, e = k < 0.7 ? ease.inOut(k / 0.7) : 1;
          const a = this.center(tut.a.c, tut.a.r), b = this.center(tut.b.c, tut.b.r);
          hx = a.x + (b.x - a.x) * e; hy = a.y + (b.y - a.y) * e;
          ctx.globalAlpha = k > 0.85 ? (1 - k) / 0.15 : 1;
        } else {
          const a = this.center(tut.a.c, tut.a.r);
          hx = a.x; hy = a.y + Math.abs(Math.sin(this.time * 4)) * S * 0.15;
        }
        ctx.drawImage(hand, hx - S * 0.45, hy - S * 0.02, S * 0.9, S * 0.9);
      }
      ctx.restore();
    }

    // ---------------------------------------------------------------- input
    _bindInput() {
      const cv = this.cv;
      let down = null;
      const pos = (e) => {
        const r = cv.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
      };
      cv.addEventListener('pointerdown', (e) => {
        if (!this.eng || this.busy || this.eng.status !== 'playing') return;
        if (this.hooks.canInput && !this.hooks.canInput()) return;
        const p = pos(e);
        const cell = this.cellAt(p.x, p.y);
        this.idle = 0; this.hint = null;
        if (!cell) { this.sel = null; return; }
        if (this.targeting) { this.hooks.onCell(cell); return; }
        down = { cell, x: p.x, y: p.y, moved: false };
        try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      });
      cv.addEventListener('pointermove', (e) => {
        if (!down || down.moved || this.busy) return;
        const p = pos(e);
        const dx = p.x - down.x, dy = p.y - down.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < this.S * 0.32) return;
        down.moved = true;
        const b = Math.abs(dx) > Math.abs(dy)
          ? { c: down.cell.c + Math.sign(dx), r: down.cell.r }
          : { c: down.cell.c, r: down.cell.r + Math.sign(dy) };
        this.sel = null;
        this._trySwap(down.cell, b);
      });
      const up = () => {
        if (!down) return;
        const d = down;
        down = null;
        if (d.moved || this.busy) return;
        const cell = d.cell;
        if (this.sel && Math.abs(this.sel.c - cell.c) + Math.abs(this.sel.r - cell.r) === 1) {
          const a = this.sel;
          this.sel = null;
          this._trySwap(a, cell);
          return;
        }
        const cl = this.eng.cell(cell.c, cell.r);
        if (cl && cl.tile && cl.tile.k === 'p' && !cl.tape) {
          if (this.tut && !(this.tut.kind === 'tap' && this.tut.a.c === cell.c && this.tut.a.r === cell.r)) return;
          this.sel = null;
          this.hooks.onTap(cell);
          return;
        }
        if (this.sel && this.sel.c === cell.c && this.sel.r === cell.r) { this.sel = null; return; }
        this.sel = cl && cl.tile && !cl.tape && !cl.block ? cell : null;
      };
      cv.addEventListener('pointerup', up);
      cv.addEventListener('pointercancel', () => { down = null; });
    }

    _trySwap(a, b) {
      if (b.c < 0 || b.r < 0 || b.c >= this.cols || b.r >= this.rows) return;
      if (this.tut) {
        const t = this.tut;
        const ok = t.kind === 'swap' && ((t.a.c === a.c && t.a.r === a.r && t.b.c === b.c && t.b.r === b.r) ||
          (t.a.c === b.c && t.a.r === b.r && t.b.c === a.c && t.b.r === a.r));
        if (!ok) return;
        if (!(t.a.c === a.c && t.a.r === a.r)) { const tmp = a; a = b; b = tmp; }
      }
      this.hooks.onSwap(a, b);
    }
  }

  root.RKBoardView = BoardView;
})(typeof self !== 'undefined' ? self : this);
