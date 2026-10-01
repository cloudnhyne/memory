/*
 * Rhyme Kingdom: match-3 rules engine.
 *
 * Pure game logic with no DOM and no timers. Every player action resolves
 * synchronously and returns a list of events that the renderer plays back.
 * Runs in the browser (window.RKEngine) and in Node (require) so levels can
 * be balanced with a headless bot.
 *
 * Tile colors: 0 mic (red), 1 sneaker (orange), 2 chain (yellow),
 *              3 cap (green), 4 headphones (blue), 5 cassette (purple)
 * Power-ups:   h / v  spray can (row / column)
 *              x      boombox (blast)
 *              pl     flyer (paper plane that seeks a goal)
 *              d      platinum record (clears one color)
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RKEngine = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Timing used for event scheduling (ms). The renderer reads these too.
  const T = {
    SPRAY: 30,     // per cell travelled by a spray can
    FUSE: 70,      // delay between a power-up being hit and firing
    BOOM: 120,     // boombox wind-up
    RING: 34,      // per ring of a blast
    PLANE: 520,    // flyer flight time
    DISC: 26,      // between platinum beams
    CONVERT: 45,   // between conversions in a platinum combo
  };

  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const COLOR_CHARS = { R: 0, O: 1, Y: 2, G: 3, B: 4, P: 5 };
  const POWER_CHARS = { h: 'h', v: 'v', x: 'x', p: 'pl', d: 'd' };

  class Engine {
    constructor(level, seed) {
      this.level = level;
      this.rs = (seed >>> 0) || 1;
      this.nid = 1;
      this.silent = false;
      this.ev = [];
      this.status = 'playing';
      this.moves = level.moves;
      this.movesUsed = 0;
      this.encoreMode = false;
      this.staticHit = false;
      this.colors = (level.colors || [0, 1, 2, 3, 4]).slice();
      this._pend = new Map();
      this._parse();
      this._initialFill();
    }

    // ---------- random ----------
    rand() {
      let t = (this.rs = (this.rs + 0x6d2b79f5) | 0);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    ri(n) { return Math.floor(this.rand() * n); }
    pick(a) { return a[this.ri(a.length)]; }
    shuffleArr(a) {
      for (let i = a.length - 1; i > 0; i--) {
        const j = this.ri(i + 1);
        const t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    }

    // ---------- events ----------
    emit(e) { if (!this.silent) this.ev.push(e); }
    phase(min) { if (!this.silent) this.ev.push({ t: 'phase', min: min || 0 }); }

    // ---------- setup ----------
    _parse() {
      const L = this.level;
      const rows = L.board.length;
      const cols = Math.max(...L.board.map((s) => s.length));
      this.rows = rows; this.cols = cols;
      this.cells = [];
      const bossCells = [];
      let presetCrowns = 0;
      for (let r = 0; r < rows; r++) {
        const row = [];
        for (let c = 0; c < cols; c++) {
          const ch = L.board[r][c] || ' ';
          const cell = { p: ch !== ' ' && ch !== '-', floor: 0, block: null, tile: null, tape: 0 };
          if (cell.p) {
            if (ch in COLOR_CHARS) cell.tile = this._newTile('n', COLOR_CHARS[ch]);
            else if (ch in POWER_CHARS) cell.tile = this._newTile('p', -1, POWER_CHARS[ch]);
            else if (ch === '1' || ch === '2' || ch === '3') cell.block = { t: 'crate', hp: +ch };
            else if (ch === 'S') cell.block = { t: 'static' };
            else if (ch === 'K') { cell.block = { t: 'boss' }; bossCells.push([c, r]); }
            else if (ch === 'C') { cell.tile = this._newTile('c'); presetCrowns++; }
          }
          if (cell.p && L.floor && L.floor[r]) {
            const f = L.floor[r][c];
            if (f === '1' || f === '2') cell.floor = +f;
          }
          if (cell.p && L.tape && L.tape[r] && L.tape[r][c] === 'x' && !cell.block) cell.tape = 1;
          row.push(cell);
        }
        this.cells.push(row);
      }
      this.boss = null;
      if (bossCells.length && L.boss) {
        const xs = bossCells.map((p) => p[0]), ys = bossCells.map((p) => p[1]);
        const x = Math.min(...xs), y = Math.min(...ys);
        this.boss = {
          x, y, w: Math.max(...xs) - x + 1, h: Math.max(...ys) - y + 1,
          hp: L.boss.hp, max: L.boss.hp, kind: L.boss.kind,
          every: L.boss.every || 3, attack: L.boss.attack, count: L.boss.count || 2,
          timer: L.boss.every || 3,
        };
      }
      // column helpers
      this.topRow = []; this.botRow = [];
      for (let c = 0; c < cols; c++) {
        let top = -1, bot = -1;
        for (let r = 0; r < rows; r++) if (this.cells[r][c].p) { if (top < 0) top = r; bot = r; }
        this.topRow.push(top); this.botRow.push(bot);
      }
      // crowns
      this.crownCfg = L.crowns || null;
      this.crownSpawned = presetCrowns;
      this.crownCooldown = this.crownCfg ? (this.crownCfg.gap || 2) : 0;
      // goals
      this.goals = L.goals.map((g) => {
        let need = g.count;
        if (need == null) {
          if (g.type === 'crate') need = this._count((cl) => cl.block && cl.block.t === 'crate');
          else if (g.type === 'floor') need = this._count((cl) => cl.floor > 0);
          else if (g.type === 'tape') need = this._count((cl) => cl.tape);
          else if (g.type === 'static') need = this._count((cl) => cl.block && cl.block.t === 'static');
          else if (g.type === 'boss') need = this.boss ? this.boss.hp : 0;
          else if (g.type === 'crown') need = this.crownCfg ? this.crownCfg.total : presetCrowns;
        }
        return { type: g.type, color: g.color, need, left: need };
      });
    }

    _count(pred) {
      let n = 0;
      for (const row of this.cells) for (const cl of row) if (cl.p && pred(cl)) n++;
      return n;
    }

    _newTile(k, col, pw) {
      return { id: this.nid++, k, col: col == null ? -1 : col, pw: pw || null };
    }

    _initialFill() {
      const holes = [];
      for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
        const cl = this.cells[r][c];
        if (cl.p && !cl.block && !cl.tile) holes.push([c, r]);
      }
      for (let attempt = 0; attempt < 300; attempt++) {
        for (const [c, r] of holes) this.cells[r][c].tile = null;
        for (const [c, r] of holes) {
          const opts = this.colors.filter((col) => !this._wouldMatch(c, r, col));
          this.cells[r][c].tile = this._newTile('n', opts.length ? this.pick(opts) : this.pick(this.colors));
        }
        if (!this._findGroups().length && this.findMoves(1).length && this._tutorialOk()) return;
      }
    }

    // The scripted tutorial moves must play out exactly as written on this board.
    _tutorialOk() {
      const steps = this.level.tutorial;
      if (!steps) return true;
      const e = this.clone();
      e.silent = true;
      for (const s of steps) {
        const res = s.do === 'swap' ? e.swap(s.a, s.b) : e.tap(s.at);
        if (!res.ok || e.status !== 'playing') return false;
        if (s.expect) {
          const cl = e.cell(s.expect.c, s.expect.r);
          if (!cl || !cl.tile || cl.tile.k !== 'p' || cl.tile.pw !== s.expect.pw) return false;
        }
      }
      return true;
    }

    // Would placing `col` at (c,r) form a line of 3 or a 2x2 with existing tiles?
    _wouldMatch(c, r, col) {
      const mc = (x, y) => this._mc(x, y);
      let n = 1;
      for (let x = c - 1; mc(x, r) === col; x--) n++;
      for (let x = c + 1; mc(x, r) === col; x++) n++;
      if (n >= 3) return true;
      n = 1;
      for (let y = r - 1; mc(c, y) === col; y--) n++;
      for (let y = r + 1; mc(c, y) === col; y++) n++;
      if (n >= 3) return true;
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        if (mc(c + dx, r) === col && mc(c, r + dy) === col && mc(c + dx, r + dy) === col) return true;
      }
      return false;
    }

    // Match color of a cell, or -1 when it cannot take part in a match.
    _mc(c, r) {
      if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return -1;
      const cl = this.cells[r][c];
      if (!cl.p || cl.block || !cl.tile || cl.tile.k !== 'n') return -1;
      return cl.tile.col;
    }

    // ---------- queries ----------
    cell(c, r) {
      if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return null;
      return this.cells[r][c];
    }

    _swappable(p) {
      const cl = this.cell(p.c, p.r);
      return !!(cl && cl.p && !cl.block && cl.tile && !cl.tape);
    }

    _matchAt(c, r) {
      const col = this._mc(c, r);
      if (col < 0) return false;
      const mc = (x, y) => this._mc(x, y);
      let n = 1;
      for (let x = c - 1; mc(x, r) === col; x--) n++;
      for (let x = c + 1; mc(x, r) === col; x++) n++;
      if (n >= 3) return true;
      n = 1;
      for (let y = r - 1; mc(c, y) === col; y--) n++;
      for (let y = r + 1; mc(c, y) === col; y++) n++;
      if (n >= 3) return true;
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        if (mc(c + dx, r) === col && mc(c, r + dy) === col && mc(c + dx, r + dy) === col) return true;
      }
      return false;
    }

    // All legal moves (power-up taps first, then swaps). Stops at `limit`.
    findMoves(limit) {
      limit = limit || Infinity;
      const res = [];
      const { cols, rows, cells } = this;
      const sw = (c, r) => { const x = cells[r][c]; return x.p && !x.block && x.tile && !x.tape; };
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        if (sw(c, r) && cells[r][c].tile.k === 'p') {
          res.push({ t: 'tap', c, r });
          if (res.length >= limit) return res;
        }
      }
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        if (!sw(c, r)) continue;
        for (const [dx, dy] of [[1, 0], [0, 1]]) {
          const x = c + dx, y = r + dy;
          if (x >= cols || y >= rows || !sw(x, y)) continue;
          const A = cells[r][c].tile, B = cells[y][x].tile;
          if (A.k === 'p' || B.k === 'p') {
            res.push({ t: 'swap', a: { c, r }, b: { c: x, r: y } });
          } else {
            if (A.k === 'n' && B.k === 'n' && A.col === B.col) continue;
            cells[r][c].tile = B; cells[y][x].tile = A;
            const m = this._matchAt(c, r) || this._matchAt(x, y);
            cells[r][c].tile = A; cells[y][x].tile = B;
            if (m) res.push({ t: 'swap', a: { c, r }, b: { c: x, r: y } });
          }
          if (res.length >= limit) return res;
        }
      }
      return res;
    }

    // A good move to suggest after the player idles.
    hint() {
      const moves = this.findMoves();
      if (!moves.length) return null;
      let best = null, bestScore = -1;
      for (const mv of moves) {
        let score;
        if (mv.t === 'tap') score = 6;
        else {
          const A = this.cells[mv.a.r][mv.a.c], B = this.cells[mv.b.r][mv.b.c];
          if (A.tile.k === 'p' && B.tile.k === 'p') score = 20;
          else if (A.tile.k === 'p' || B.tile.k === 'p') score = 7;
          else {
            const ta = A.tile, tb = B.tile;
            A.tile = tb; B.tile = ta;
            const groups = this._findGroups();
            A.tile = ta; B.tile = tb;
            score = 0;
            for (const g of groups) {
              score += g.cells.size + this._groupValue(g);
              const sh = this._shape(g, [mv.a, mv.b]);
              if (sh.pw) score += sh.pw === 'd' ? 12 : sh.pw === 'x' ? 9 : 6;
            }
          }
        }
        score += Math.random() * 0.5; // never touch the game's own random stream here
        if (score > bestScore) { bestScore = score; best = mv; }
      }
      return best;
    }

    // How much a match group helps the open goals (used to rank hints).
    _groupValue(g) {
      const open = (type, col) => this.goals.some((x) => x.type === type && x.left > 0 && (col == null || x.color === col));
      let v = open('color', g.col) ? g.cells.size * 2 : 0;
      const seen = new Set();
      for (const i of g.cells) {
        const c = i % this.cols, r = (i / this.cols) | 0;
        const cl = this.cells[r][c];
        if (cl.floor > 0 && open('floor')) v += 2;
        if (cl.tape && open('tape')) v += 3;
        for (const [dx, dy] of DIRS) {
          const n = this.cell(c + dx, r + dy);
          if (!n || !n.block) continue;
          const k = (r + dy) * this.cols + c + dx;
          if (seen.has(k)) continue;
          seen.add(k);
          if (n.block.t === 'boss' || (n.block.t === 'crate' && open('crate')) || n.block.t === 'static') v += 3;
        }
      }
      return v;
    }

    goalsDone() { return this.goals.every((g) => g.left <= 0); }

    // ---------- matching ----------
    _findGroups() {
      const { cols, rows } = this;
      const N = cols * rows;
      const colAt = new Int8Array(N);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) colAt[r * cols + c] = this._mc(c, r);
      const runs = [], squares = [];
      for (let r = 0; r < rows; r++) {
        let c = 0;
        while (c < cols) {
          const col = colAt[r * cols + c];
          if (col < 0) { c++; continue; }
          let e = c + 1;
          while (e < cols && colAt[r * cols + e] === col) e++;
          if (e - c >= 3) {
            const cl = [];
            for (let x = c; x < e; x++) cl.push(r * cols + x);
            runs.push({ dir: 'h', cells: cl, col });
          }
          c = e;
        }
      }
      for (let c = 0; c < cols; c++) {
        let r = 0;
        while (r < rows) {
          const col = colAt[r * cols + c];
          if (col < 0) { r++; continue; }
          let e = r + 1;
          while (e < rows && colAt[e * cols + c] === col) e++;
          if (e - r >= 3) {
            const cl = [];
            for (let y = r; y < e; y++) cl.push(y * cols + c);
            runs.push({ dir: 'v', cells: cl, col });
          }
          r = e;
        }
      }
      for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols - 1; c++) {
        const i = r * cols + c, col = colAt[i];
        if (col >= 0 && colAt[i + 1] === col && colAt[i + cols] === col && colAt[i + cols + 1] === col) {
          squares.push({ cells: [i, i + 1, i + cols, i + cols + 1], col });
        }
      }
      if (!runs.length && !squares.length) return [];
      const parent = new Int32Array(N).fill(-1);
      const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
      const add = (shape) => {
        const cl = shape.cells;
        for (const i of cl) if (parent[i] === -1) parent[i] = i;
        for (let k = 1; k < cl.length; k++) {
          const a = find(cl[0]), b = find(cl[k]);
          if (a !== b) parent[b] = a;
        }
      };
      runs.forEach(add); squares.forEach(add);
      const groups = new Map();
      const getG = (i) => {
        const root = find(i);
        let g = groups.get(root);
        if (!g) { g = { cells: new Set(), runs: [], squares: [], col: colAt[i] }; groups.set(root, g); }
        return g;
      };
      for (const run of runs) { const g = getG(run.cells[0]); run.cells.forEach((i) => g.cells.add(i)); g.runs.push(run); }
      for (const sq of squares) { const g = getG(sq.cells[0]); sq.cells.forEach((i) => g.cells.add(i)); g.squares.push(sq); }
      return [...groups.values()];
    }

    // Which power-up a match group earns, and where it appears.
    _shape(g, preferred) {
      const cols = this.cols;
      const xy = (i) => ({ c: i % cols, r: (i / cols) | 0 });
      const ok = (p) => !this.cells[p.r][p.c].tape;
      const inG = (p) => g.cells.has(p.r * cols + p.c);
      let pref = null;
      if (preferred) for (const p of preferred) if (p && inG(p) && ok(p)) { pref = { c: p.c, r: p.r }; break; }
      let best = null;
      for (const run of g.runs) if (!best || run.cells.length > best.cells.length) best = run;
      const maxLen = best ? best.cells.length : 0;
      const anyOk = () => { for (const i of g.cells) { const p = xy(i); if (ok(p)) return p; } return null; };
      const mid = (run) => {
        const n = run.cells.length, m = (n - 1) >> 1;
        for (let k = 0; k < n; k++) {
          const idx = m + (k % 2 ? (k + 1) >> 1 : -(k >> 1));
          if (idx < 0 || idx >= n) continue;
          const p = xy(run.cells[idx]);
          if (ok(p)) return p;
        }
        return anyOk();
      };
      let pw = null, at = null;
      if (maxLen >= 5) { pw = 'd'; at = pref || mid(best); }
      else {
        let inter = null;
        for (const h of g.runs) {
          if (h.dir !== 'h') continue;
          for (const v of g.runs) {
            if (v.dir !== 'v') continue;
            for (const i of h.cells) if (v.cells.includes(i)) { inter = xy(i); break; }
            if (inter) break;
          }
          if (inter) break;
        }
        if (inter) { pw = 'x'; at = pref || (ok(inter) ? inter : anyOk()); }
        else if (maxLen === 4) { pw = best.dir === 'h' ? 'h' : 'v'; at = pref || mid(best); }
        else if (g.squares.length) {
          pw = 'pl';
          const sq = g.squares[0].cells.map(xy);
          const order = [sq[2], sq[3], sq[0], sq[1]];
          at = pref || order.find(ok) || anyOk();
        }
      }
      if (pw && !at) pw = null;
      return { pw, at };
    }

    // ---------- goals ----------
    _goalHit(type, col) {
      if (this.encoreMode) return {};
      for (let i = 0; i < this.goals.length; i++) {
        const g = this.goals[i];
        if (g.type !== type || g.left <= 0) continue;
        if (type === 'color' && g.color !== col) continue;
        g.left--;
        return { g: i };
      }
      return {};
    }

    _lightFloor(c, r, at) {
      const cl = this.cells[r][c];
      if (cl.floor > 0) {
        cl.floor--;
        const gh = cl.floor === 0 ? this._goalHit('floor') : {};
        this.emit({ t: 'floor', c, r, n: cl.floor, at, ...gh });
      }
    }

    _damageBlock(c, r, at) {
      const cl = this.cells[r][c];
      const b = cl.block;
      if (!b) return;
      if (b.t === 'crate') {
        b.hp--;
        if (b.hp <= 0) {
          cl.block = null;
          this.emit({ t: 'crate', c, r, hp: 0, at, ...this._goalHit('crate') });
        } else this.emit({ t: 'crate', c, r, hp: b.hp, at });
      } else if (b.t === 'static') {
        cl.block = null;
        this.staticHit = true;
        this.emit({ t: 'static', c, r, on: 0, at, ...this._goalHit('static') });
      } else if (b.t === 'boss') {
        const B = this.boss;
        if (!B || B.hp <= 0) return;
        B.hp--;
        this.emit({ t: 'boss', c, r, hp: B.hp, at, ...this._goalHit('boss') });
        if (B.hp <= 0) {
          for (let y = B.y; y < B.y + B.h; y++) for (let x = B.x; x < B.x + B.w; x++) this.cells[y][x].block = null;
          this.emit({ t: 'bossDie', at: at + 80 });
        }
      }
    }

    // ---------- player actions ----------
    swap(a, b) {
      this.ev = [];
      this.staticHit = false;
      if (this.status !== 'playing') return { ok: false, events: [] };
      if (Math.abs(a.c - b.c) + Math.abs(a.r - b.r) !== 1) return { ok: false, events: [] };
      if (!this._swappable(a) || !this._swappable(b)) return { ok: false, events: [] };
      const A = this.cells[a.r][a.c], B = this.cells[b.r][b.c];
      const ta = A.tile, tb = B.tile;
      const pa = ta.k === 'p', pb = tb.k === 'p';
      A.tile = tb; B.tile = ta;
      if (pa || pb) {
        this.emit({ t: 'swap', a, b, ida: ta.id, idb: tb.id });
        this._useMove();
        this.phase();
        let acts;
        if (pa && pb) acts = [this._comboAct(ta, tb, a, b)];
        else {
          const p = pa ? ta : tb, other = pa ? tb : ta;
          const at = pa ? b : a;
          acts = [{ c: at.c, r: at.r, pw: p.pw, id: p.id, at: 0, color: other.k === 'n' ? other.col : -1 }];
        }
        this._resolve(acts, null, null);
        this._endTurn(true);
        return { ok: true, events: this.ev };
      }
      const groups = this._findGroups();
      if (!groups.length) {
        A.tile = ta; B.tile = tb;
        this.emit({ t: 'swap', a, b, ida: ta.id, idb: tb.id, bad: true });
        return { ok: false, events: this.ev };
      }
      this.emit({ t: 'swap', a, b, ida: ta.id, idb: tb.id });
      this._useMove();
      this.phase();
      this._resolve(null, [b, a], groups);
      this._endTurn(true);
      return { ok: true, events: this.ev };
    }

    tap(p) {
      this.ev = [];
      this.staticHit = false;
      const cl = this.cell(p.c, p.r);
      if (this.status !== 'playing' || !cl || !cl.p || cl.block || !cl.tile || cl.tile.k !== 'p' || cl.tape) {
        return { ok: false, events: [] };
      }
      this._useMove();
      this._resolve([{ c: p.c, r: p.r, pw: cl.tile.pw, id: cl.tile.id, at: 0, color: -1 }], null, null);
      this._endTurn(true);
      return { ok: true, events: this.ev };
    }

    // Boosters never cost a move. Types: hammer, row, col, shuffle.
    booster(type, p) {
      this.ev = [];
      this.staticHit = false;
      if (this.status !== 'playing') return { ok: false, events: [] };
      if (type === 'shuffle') {
        this._shuffle();
        this._endTurn(false);
        return { ok: true, events: this.ev };
      }
      const cl = this.cell(p.c, p.r);
      if (!cl || !cl.p) return { ok: false, events: [] };
      if (type === 'hammer' && !cl.block && !cl.tile && !cl.floor) return { ok: false, events: [] };
      this._resolve([{ c: p.c, r: p.r, pw: type, at: 0 }], null, null);
      this._endTurn(false);
      return { ok: true, events: this.ev };
    }

    addMoves(n) {
      this.moves += n;
      if (this.status === 'lost') this.status = 'playing';
    }

    // After a win, leftover moves become spray cans and everything fires.
    encore() {
      this.ev = [];
      this.encoreMode = true;
      const left = this.moves;
      const cands = [];
      for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
        const cl = this.cells[r][c];
        if (cl.p && !cl.block && !cl.tape && cl.tile && cl.tile.k === 'n') cands.push([c, r]);
      }
      this.shuffleArr(cands);
      const n = Math.min(left, cands.length, 14);
      for (let i = 0; i < n; i++) {
        const [c, r] = cands[i];
        const t = this.cells[r][c].tile;
        t.k = 'p'; t.pw = this.rand() < 0.5 ? 'h' : 'v';
        this.emit({ t: 'convert', id: t.id, c, r, pw: t.pw, at: i * 120, encore: 1 });
      }
      this.moves = 0;
      this.emit({ t: 'moves', n: 0, at: n * 120 });
      this.phase(250);
      for (let round = 0; round < 12; round++) {
        const acts = [];
        for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
          const cl = this.cells[r][c];
          if (cl.p && !cl.tape && cl.tile && cl.tile.k === 'p') {
            acts.push({ c, r, pw: cl.tile.pw, id: cl.tile.id, at: acts.length * 130, color: -1 });
          }
        }
        if (!acts.length) break;
        this._resolve(acts, null, null);
      }
      this.emit({ t: 'encoreDone' });
      return { events: this.ev, bonus: left };
    }

    // ---------- resolution ----------
    _useMove() {
      this.moves--;
      this.movesUsed++;
      if (this.crownCooldown > 0) this.crownCooldown--;
      this.emit({ t: 'moves', n: this.moves, at: 0 });
    }

    _resolve(acts, preferred, groups) {
      let cascade = 0;
      for (let guard = 0; guard < 60; guard++) {
        if (groups && groups.length) {
          this._processGroups(groups, preferred);
          preferred = null;
          cascade++;
          if (cascade >= 2) this.emit({ t: 'combo', n: cascade, at: 0 });
          this.phase();
        }
        if (acts && acts.length) {
          this._runActivations(acts);
          acts = null;
          this.phase();
        }
        this._gravityAndCollect();
        groups = this._findGroups();
        if (!groups.length) break;
      }
    }

    _processGroups(groups, preferred) {
      const cols = this.cols;
      const dmg = [];
      for (const g of groups) {
        const shape = this._shape(g, preferred);
        const spawn = shape.pw ? shape.at : null;
        const list = [...g.cells].map((i) => [i % cols, (i / cols) | 0]);
        for (const [c, r] of list) {
          const cl = this.cells[r][c];
          this._lightFloor(c, r, 0);
          if (cl.tape) {
            cl.tape = 0;
            this.emit({ t: 'tape', c, r, on: 0, at: 0, ...this._goalHit('tape') });
            continue;
          }
          const t = cl.tile;
          if (!t) continue;
          cl.tile = null;
          const gh = this._goalHit('color', t.col);
          if (spawn) this.emit({ t: 'merge', id: t.id, c, r, to: spawn, col: t.col, at: 0, ...gh });
          else this.emit({ t: 'clear', id: t.id, c, r, col: t.col, at: 0, ...gh });
        }
        const seen = new Set();
        for (const [c, r] of list) {
          for (const [dx, dy] of DIRS) {
            const x = c + dx, y = r + dy;
            const n = this.cell(x, y);
            if (!n || !n.p || !n.block) continue;
            const key = n.block.t === 'boss' ? -1 : y * cols + x;
            if (seen.has(key)) continue;
            seen.add(key);
            dmg.push([x, y]);
          }
        }
        if (spawn) {
          const nt = this._newTile('p', -1, shape.pw);
          this.cells[spawn.r][spawn.c].tile = nt;
          this.emit({ t: 'create', id: nt.id, pw: shape.pw, c: spawn.c, r: spawn.r, at: 170, size: g.cells.size });
        }
      }
      for (const [x, y] of dmg) this._damageBlock(x, y, 60);
    }

    _comboAct(ta, tb, a, b) {
      // ta now sits at b, tb at a. The combo fires where the dragged tile landed.
      const p1 = ta.pw, p2 = tb.pw;
      const rm = [{ c: b.c, r: b.r, id: ta.id }, { c: a.c, r: a.r, id: tb.id }];
      let pw, payload = null;
      if (p1 === 'd' || p2 === 'd') {
        if (p1 === 'd' && p2 === 'd') pw = 'dd';
        else { pw = 'dconv'; payload = p1 === 'd' ? p2 : p1; }
      } else if (p1 === 'pl' || p2 === 'pl') {
        if (p1 === 'pl' && p2 === 'pl') pw = 'plpl';
        else { pw = 'plc'; payload = p1 === 'pl' ? p2 : p1; }
      } else if (p1 === 'x' || p2 === 'x') {
        pw = p1 === 'x' && p2 === 'x' ? 'xx' : 'bigcross';
      } else pw = 'cross';
      return { c: b.c, r: b.r, pw, payload, rm, at: 0, combo: true, from: { c: a.c, r: a.r }, ids: [ta.id, tb.id], pws: [p1, p2] };
    }

    _runActivations(acts) {
      const q = [];
      this._pend = new Map();
      const push = (it) => {
        if (it.kind === 'hit') {
          const k = it.r * this.cols + it.c;
          this._pend.set(k, (this._pend.get(k) || 0) + 1);
        }
        q.push(it);
      };
      for (const a of acts) push({ ...a, kind: 'act' });
      let guard = 0;
      while (q.length && guard++ < 20000) {
        let mi = 0;
        for (let i = 1; i < q.length; i++) if (q[i].at < q[mi].at) mi = i;
        const it = q.splice(mi, 1)[0];
        if (it.kind === 'act') this._activate(it, push);
        else {
          const k = it.r * this.cols + it.c;
          this._pend.set(k, (this._pend.get(k) || 1) - 1);
          this._hit(it.c, it.r, it.at, push);
        }
      }
    }

    _activate(it, push) {
      const { c, r, at } = it;
      if (it.id != null) {
        const cl = this.cell(c, r);
        if (!cl || !cl.tile || cl.tile.id !== it.id) return;
        cl.tile = null;
      }
      if (it.rm) {
        for (const x of it.rm) {
          const cl = this.cells[x.r][x.c];
          if (cl.tile && cl.tile.id === x.id) cl.tile = null;
        }
      }
      const H = (x, y, t) => {
        if (x < 0 || y < 0 || x >= this.cols || y >= this.rows || !this.cells[y][x].p) return;
        push({ kind: 'hit', c: x, r: y, at: t });
      };
      const line = (horiz, x0, y0, t0) => {
        const n = horiz ? this.cols : this.rows;
        H(x0, y0, t0);
        for (let d = 1; d < n; d++) {
          if (horiz) { H(x0 - d, y0, t0 + d * T.SPRAY); H(x0 + d, y0, t0 + d * T.SPRAY); }
          else { H(x0, y0 - d, t0 + d * T.SPRAY); H(x0, y0 + d, t0 + d * T.SPRAY); }
        }
      };
      const ev = { t: 'act', pw: it.pw, c, r, at, id: it.id };
      if (it.combo) { ev.ids = it.ids; ev.from = it.from; ev.pws = it.pws; }
      switch (it.pw) {
        case 'h': case 'row':
          this.emit(ev); line(true, c, r, at + (it.pw === 'row' ? 200 : 0)); break;
        case 'v': case 'col':
          this.emit(ev); line(false, c, r, at + (it.pw === 'col' ? 200 : 0)); break;
        case 'cross':
          this.emit(ev); line(true, c, r, at + 150); line(false, c, r, at + 150); break;
        case 'bigcross':
          this.emit(ev);
          for (let d = -1; d <= 1; d++) { line(true, c, r + d, at + 220); line(false, c + d, r, at + 220); }
          break;
        case 'x':
          this.emit(ev); this._blast(c, r, 2, at + T.BOOM, H); break;
        case 'xx':
          this.emit(ev); this._blast(c, r, 3, at + T.BOOM + 150, H); break;
        case 'hammer':
          this.emit(ev); H(c, r, at + 330); break;
        case 'pl':
          this._plane(it, H, push, null, 0); break;
        case 'plc': {
          const pay = it.payload;
          this._plane(it, H, push, pay, 0);
          break;
        }
        case 'plpl': {
          this.emit({ ...ev, pw: 'plpl' });
          H(c, r, at);
          for (const [dx, dy] of DIRS) H(c + dx, r + dy, at + 40);
          for (let k = 0; k < 3; k++) this._plane({ c, r, at: at + 60 + k * 90 }, H, push, null, 1);
          break;
        }
        case 'd': {
          const col = it.color >= 0 ? it.color : this._commonColor();
          const targets = this._colorCells(col, true);
          targets.sort((p, q2) => (Math.abs(p.c - c) + Math.abs(p.r - r)) - (Math.abs(q2.c - c) + Math.abs(q2.r - r)));
          ev.col = col;
          ev.targets = targets.map((p, i) => ({ c: p.c, r: p.r, at: at + 160 + i * T.DISC }));
          this.emit(ev);
          H(c, r, at);
          ev.targets.forEach((p) => H(p.c, p.r, p.at));
          break;
        }
        case 'dconv': {
          const col = this._commonColor();
          const targets = this._colorCells(col, false);
          targets.sort((p, q2) => (Math.abs(p.c - c) + Math.abs(p.r - r)) - (Math.abs(q2.c - c) + Math.abs(q2.r - r)));
          ev.col = col;
          ev.targets = targets.map((p, i) => ({ c: p.c, r: p.r, at: at + 200 + i * T.CONVERT }));
          this.emit(ev);
          H(c, r, at + 100);
          const base = at + 200 + targets.length * T.CONVERT + 250;
          targets.forEach((p, i) => {
            const t = this.cells[p.r][p.c].tile;
            t.k = 'p';
            t.pw = it.payload === 'h' || it.payload === 'v' ? (this.rand() < 0.5 ? 'h' : 'v') : it.payload;
            t.armed = true;
            this.emit({ t: 'convert', id: t.id, c: p.c, r: p.r, pw: t.pw, at: ev.targets[i].at });
            push({ kind: 'act', c: p.c, r: p.r, pw: t.pw, id: t.id, at: base + i * 110, color: -1 });
          });
          break;
        }
        case 'dd': {
          this.emit(ev);
          for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) {
            const d = Math.hypot(x - c, y - r);
            H(x, y, at + 250 + d * 55);
          }
          break;
        }
        default:
          break;
      }
    }

    _blast(c, r, rad, t0, H) {
      for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
        if (Math.abs(dx) === rad && Math.abs(dy) === rad) continue;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        H(c + dx, r + dy, t0 + d * T.RING);
      }
    }

    _plane(it, H, push, payload, sub) {
      const { c, r, at } = it;
      if (!sub) {
        H(c, r, at);
        for (const [dx, dy] of DIRS) H(c + dx, r + dy, at + 40);
      }
      const tgt = this._planeTarget(c, r);
      const ev = { t: 'act', pw: 'pl', c, r, at, id: sub ? null : it.id, to: tgt, payload, dur: T.PLANE };
      if (it.combo) { ev.ids = it.ids; ev.from = it.from; ev.pws = it.pws; }
      this.emit(ev);
      if (!tgt) return;
      if (payload) push({ kind: 'act', c: tgt.c, r: tgt.r, pw: payload, at: at + T.PLANE, color: -1 });
      else H(tgt.c, tgt.r, at + T.PLANE);
    }

    _planeTarget(c0, r0) {
      const { cols, rows, cells } = this;
      const pending = (x, y) => (this._pend.get(y * cols + x) || 0) > 0;
      const goalLeft = (type) => this.goals.some((g) => g.type === type && g.left > 0);
      const tiers = [];
      if (this.boss && this.boss.hp > 0) tiers.push({ f: (cl) => cl.block && cl.block.t === 'boss', dup: true });
      if (goalLeft('static') || this._count((cl) => cl.block && cl.block.t === 'static') > 0) {
        tiers.push({ f: (cl) => cl.block && cl.block.t === 'static' });
      }
      if (goalLeft('crate')) tiers.push({ f: (cl) => cl.block && cl.block.t === 'crate' });
      if (goalLeft('floor')) tiers.push({ f: (cl) => cl.floor > 0 && !cl.block && !(cl.tile && cl.tile.k === 'p') });
      if (goalLeft('tape')) tiers.push({ f: (cl) => cl.tape && !cl.block });
      if (goalLeft('crown')) {
        tiers.push({ f: (cl, x, y) => y > 0 && cl.tile && cl.tile.k === 'n' && !cl.tape && cells[y - 1][x].tile && cells[y - 1][x].tile.k === 'c' });
      }
      const need = this.goals.filter((g) => g.type === 'color' && g.left > 0).map((g) => g.color);
      if (need.length) tiers.push({ f: (cl) => cl.tile && cl.tile.k === 'n' && !cl.block && need.includes(cl.tile.col) });
      tiers.push({ f: (cl) => cl.tile && cl.tile.k === 'n' && !cl.block });
      for (const tier of tiers) {
        const list = [];
        for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
          const cl = cells[y][x];
          if (!cl.p || (x === c0 && y === r0)) continue;
          if (Math.abs(x - c0) + Math.abs(y - r0) <= 1) continue;
          if (!tier.dup && pending(x, y)) continue;
          if (tier.f(cl, x, y)) list.push({ c: x, r: y });
        }
        if (list.length) return this.pick(list);
      }
      return null;
    }

    _hit(c, r, at, push) {
      const cl = this.cells[r][c];
      if (!cl.p) return;
      if (cl.block) { this._damageBlock(c, r, at); return; }
      const t = cl.tile;
      if (t) {
        if (cl.tape) {
          cl.tape = 0;
          this.emit({ t: 'tape', c, r, on: 0, at, ...this._goalHit('tape') });
          return;
        }
        if (t.k === 'p') {
          if (!t.armed) {
            t.armed = true;
            push({ kind: 'act', c, r, pw: t.pw, id: t.id, at: at + T.FUSE, color: -1 });
          }
          return;
        }
        if (t.k === 'n') {
          cl.tile = null;
          this.emit({ t: 'clear', id: t.id, c, r, col: t.col, at, hit: 1, ...this._goalHit('color', t.col) });
        }
      }
      this._lightFloor(c, r, at);
    }

    _commonColor() {
      const n = new Array(6).fill(0);
      for (const row of this.cells) for (const cl of row) {
        if (cl.p && !cl.block && cl.tile && cl.tile.k === 'n') n[cl.tile.col]++;
      }
      // Prefer colors the goals still need.
      for (const g of this.goals) if (g.type === 'color' && g.left > 0 && n[g.color] > 0) n[g.color] += 100;
      let best = -1, bestN = -1;
      for (const col of this.colors) {
        const v = n[col] + this.rand() * 0.5;
        if (v > bestN) { bestN = v; best = col; }
      }
      return best;
    }

    _colorCells(col, includeTaped) {
      const out = [];
      for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
        const cl = this.cells[r][c];
        if (cl.p && !cl.block && cl.tile && cl.tile.k === 'n' && cl.tile.col === col && (includeTaped || !cl.tape)) out.push({ c, r });
      }
      return out;
    }

    // ---------- gravity ----------
    _gravityAndCollect() {
      for (let guard = 0; guard < 30; guard++) {
        const moved = this._gravity();
        if (moved) this.phase();
        if (!this._collectCrowns()) break;
        this.phase();
      }
    }

    _gravity() {
      const { cols, rows, cells } = this;
      const paths = new Map();
      const spawnN = new Array(cols).fill(0);
      let step = 0, any = false;
      const rec = (t, fc, fr, tc, tr, spawned) => {
        let p = paths.get(t.id);
        if (!p) {
          p = { id: t.id, path: [[fc, fr]], step };
          if (spawned) p.spawn = { k: t.k, col: t.col, pw: t.pw };
          paths.set(t.id, p);
        }
        p.path.push([tc, tr]);
      };
      // Boss cells let tiles pass behind them; every other block is solid.
      const solid = (cl) => (cl.block && cl.block.t !== 'boss') || (cl.tile && cl.tape);
      for (let iter = 0; iter < 400; iter++) {
        let changed = false;
        for (let c = 0; c < cols; c++) {
          for (let r = rows - 1; r >= 0; r--) {
            const cl = cells[r][c];
            if (!cl.p || cl.block || cl.tile) continue;
            let src = -1, blocked = false;
            for (let rr = r - 1; rr >= 0; rr--) {
              const a = cells[rr][c];
              if (!a.p) continue;
              if (solid(a)) { blocked = true; break; }
              if (a.block) continue; // boss
              if (a.tile) { src = rr; break; }
            }
            if (src >= 0) {
              const t = cells[src][c].tile;
              cells[src][c].tile = null;
              cl.tile = t;
              rec(t, c, src, c, r, false);
              changed = true;
            } else if (!blocked) {
              const t = this._spawnTile();
              const sy = this.topRow[c] - 1 - spawnN[c]++;
              cl.tile = t;
              rec(t, c, sy, c, r, true);
              changed = true;
            }
          }
        }
        if (changed) { any = true; step++; continue; }
        let moved = false;
        for (let r = rows - 1; r >= 1 && !moved; r--) {
          for (let k = 0; k < cols && !moved; k++) {
            const c = iter & 1 ? cols - 1 - k : k;
            const cl = cells[r][c];
            if (!cl.p || cl.block || cl.tile) continue;
            const order = iter & 1 ? [1, -1] : [-1, 1];
            for (const dc of order) {
              const sc = c + dc;
              if (sc < 0 || sc >= cols) continue;
              const s = cells[r - 1][sc];
              if (!s.p || s.block || !s.tile || s.tape) continue;
              const t = s.tile;
              s.tile = null;
              cl.tile = t;
              rec(t, sc, r - 1, c, r, false);
              moved = true;
              break;
            }
          }
        }
        if (!moved) break;
        any = true; step++;
      }
      if (any) this.emit({ t: 'fall', moves: [...paths.values()] });
      return any;
    }

    _spawnTile() {
      const cfg = this.crownCfg;
      if (cfg && !this.encoreMode && this.crownSpawned < cfg.total && this.crownCooldown <= 0 &&
          this._count((cl) => cl.tile && cl.tile.k === 'c') < (cfg.max || 1)) {
        this.crownSpawned++;
        this.crownCooldown = cfg.gap || 2;
        return this._newTile('c');
      }
      return this._newTile('n', this.pick(this.colors));
    }

    _collectCrowns() {
      let got = false;
      for (let c = 0; c < this.cols; c++) {
        const r = this.botRow[c];
        if (r < 0) continue;
        const cl = this.cells[r][c];
        if (cl.tile && cl.tile.k === 'c' && !cl.tape && !cl.block) {
          const t = cl.tile;
          cl.tile = null;
          got = true;
          this.emit({ t: 'collect', id: t.id, c, r, at: 0, ...this._goalHit('crown') });
        }
      }
      return got;
    }

    // ---------- end of turn ----------
    _endTurn(usedMove) {
      if (this.goalsDone()) {
        this.status = 'won';
        this.emit({ t: 'won' });
        return;
      }
      if (usedMove) {
        let changed = false;
        if (this.level.spread && !this.staticHit) changed = this._spreadStatic() || changed;
        if (this.boss && this.boss.hp > 0) {
          this.boss.timer--;
          if (this.boss.timer <= 0) {
            this.boss.timer = this.boss.every;
            changed = this._bossAttack() || changed;
          }
          this.emit({ t: 'bossTimer', n: this.boss.timer });
        }
        if (changed) this.phase(120);
      }
      this.staticHit = false;
      if (this.moves <= 0) {
        this.status = 'lost';
        this.emit({ t: 'lost' });
        return;
      }
      if (!this.findMoves(1).length) this._shuffle();
    }

    // For every cell: would a falling tile reach it if it were empty right now?
    // Covers obstacle cells too, so we know whether clearing them leaves a hole.
    _fillMap() {
      const { cols, rows, cells } = this;
      const solid = (cl) => (cl.block && cl.block.t !== 'boss') || cl.tape;
      const fill = [];
      for (let r = 0; r < rows; r++) {
        const row = new Array(cols).fill(false);
        for (let c = 0; c < cols; c++) {
          if (!cells[r][c].p) continue;
          let up = r - 1;
          while (up >= 0 && !cells[up][c].p) up--;
          let ok = up < 0 || (!solid(cells[up][c]) && fill[up][c]);
          if (!ok && r > 0) {
            for (const dc of [-1, 1]) {
              const x = c + dc;
              if (x < 0 || x >= cols) continue;
              const s = cells[r - 1][x];
              if (s.p && !s.block && !s.tape && fill[r - 1][x]) { ok = true; break; }
            }
          }
          row[c] = ok;
        }
        fill.push(row);
      }
      return fill;
    }

    // Would turning (c,r) solid leave some cell below it unable to refill?
    _traps(c, r, mutate) {
      const before = this._fillMap();
      const cl = this.cells[r][c];
      const saved = { block: cl.block, tape: cl.tape };
      mutate(cl);
      const after = this._fillMap();
      cl.block = saved.block; cl.tape = saved.tape;
      for (let y = r + 1; y < this.rows; y++) {
        for (let x = 0; x < this.cols; x++) if (before[y][x] && !after[y][x]) return true;
      }
      return false;
    }

    _spreadStatic() {
      const opts = [];
      for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
        const cl = this.cells[r][c];
        if (!cl.block || cl.block.t !== 'static') continue;
        for (const [dx, dy] of DIRS) {
          const n = this.cell(c + dx, r + dy);
          if (n && n.p && !n.block && !n.tape && n.tile && n.tile.k === 'n' &&
              !this._traps(c + dx, r + dy, (x) => { x.block = { t: 'static' }; })) {
            opts.push([c + dx, r + dy, c, r]);
          }
        }
      }
      if (!opts.length) return false;
      const [x, y, fx, fy] = this.pick(opts);
      const cl = this.cells[y][x];
      const t = cl.tile;
      cl.tile = null;
      cl.block = { t: 'static' };
      const gi = this.goals.findIndex((g) => g.type === 'static');
      if (gi >= 0) this.goals[gi].left++;
      this.emit({ t: 'spread', c: x, r: y, from: { c: fx, r: fy }, id: t.id, g: gi >= 0 ? gi : undefined, at: 0 });
      return true;
    }

    _bossAttack() {
      const B = this.boss;
      const opts = [];
      for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
        const cl = this.cells[r][c];
        if (cl.p && !cl.block && !cl.tape && cl.tile && cl.tile.k === 'n') opts.push({ c, r });
      }
      this.shuffleArr(opts);
      const mutate = (cl) => {
        if (B.attack === 'tape') cl.tape = 1;
        else cl.block = B.attack === 'static' ? { t: 'static' } : { t: 'crate', hp: 1 };
      };
      const targets = [];
      for (const p of opts) {
        if (targets.length >= B.count) break;
        if (this._traps(p.c, p.r, mutate)) continue;
        const cl = this.cells[p.r][p.c];
        const at = 350 + targets.length * 140;
        if (B.attack === 'tape') {
          cl.tape = 1;
          targets.push({ c: p.c, r: p.r, at });
        } else {
          const t = cl.tile;
          cl.tile = null;
          mutate(cl);
          targets.push({ c: p.c, r: p.r, at, id: t.id });
        }
      }
      if (!targets.length) return false;
      this.emit({ t: 'bossAttack', kind: B.attack, targets, at: 0 });
      return true;
    }

    _shuffle() {
      const pos = [], tiles = [];
      for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
        const cl = this.cells[r][c];
        if (cl.p && !cl.block && !cl.tape && cl.tile && cl.tile.k === 'n') { pos.push([c, r]); tiles.push(cl.tile); }
      }
      let ok = false;
      if (pos.length >= 3) {
        for (let attempt = 0; attempt < 250 && !ok; attempt++) {
          this.shuffleArr(tiles);
          pos.forEach(([c, r], i) => { this.cells[r][c].tile = tiles[i]; });
          ok = !this._findGroups().length && this.findMoves(1).length > 0;
        }
        for (let attempt = 0; attempt < 80 && !ok; attempt++) {
          for (const [c, r] of pos) this.cells[r][c].tile.col = -1;
          for (const [c, r] of pos) {
            const t = this.cells[r][c].tile;
            t.col = -1;
            const opts = this.colors.filter((col) => !this._wouldMatch(c, r, col));
            t.col = opts.length ? this.pick(opts) : this.pick(this.colors);
          }
          ok = !this._findGroups().length && this.findMoves(1).length > 0;
        }
      }
      this.emit({
        t: 'shuffle',
        moves: pos.map(([c, r]) => ({ id: this.cells[r][c].tile.id, c, r, col: this.cells[r][c].tile.col })),
      });
      if (!ok || !this.findMoves(1).length) {
        // Nothing can be arranged into a move: hand the player a free spray can.
        const cands = pos.length ? pos : [];
        if (cands.length) {
          const [c, r] = this.pick(cands);
          const t = this.cells[r][c].tile;
          t.k = 'p'; t.pw = 'h';
          this.emit({ t: 'convert', id: t.id, c, r, pw: 'h', at: 500 });
        }
      }
      this.phase(150);
    }

    // ---------- cloning (for the balancing bot) ----------
    clone() {
      const e = Object.create(Engine.prototype);
      Object.assign(e, this);
      e.cells = this.cells.map((row) => row.map((cl) => ({
        p: cl.p, floor: cl.floor, tape: cl.tape,
        block: cl.block ? { ...cl.block } : null,
        tile: cl.tile ? { ...cl.tile } : null,
      })));
      e.goals = this.goals.map((g) => ({ ...g }));
      e.boss = this.boss ? { ...this.boss } : null;
      e.colors = this.colors.slice();
      e.ev = [];
      e._pend = new Map();
      return e;
    }
  }

  return { Engine, T };
});
