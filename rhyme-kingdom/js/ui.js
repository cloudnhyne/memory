/*
 * Rhyme Kingdom: screens, menus, saving and the game controller.
 */
(function (root) {
  'use strict';
  const Art = root.RKArt, Snd = root.RKSound, Story = root.RKStory;
  const { Engine } = root.RKEngine;
  const { LEVELS } = root.RKLevels;
  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const BOOSTERS = {
    hammer: { name: 'Mic Drop', icon: 'hammer', hint: 'Tap any tile to drop the mic on it.' },
    row: { name: 'Scratch', icon: 'row', hint: 'Tap a row to scratch it clean.' },
    col: { name: 'Bass Drop', icon: 'col', hint: 'Tap a column to drop the bass on it.' },
    shuffle: { name: 'Remix', icon: 'shuffle', hint: '' },
  };
  const BOOSTER_PRICE = 80;
  const CONTINUE_PRICE = 100;
  const HYPE = [
    'You got bars and skills.',
    'That last move was cold!',
    'The whole block is proud of you.',
    'Calm mind, clean moves.',
    'Keep that confidence. You earned it.',
    'Every level-up starts with one brave move.',
    'You stayed cool under pressure. That’s a real skill.',
    'Your flow is getting stronger.',
  ];

  // ------------------------------------------------------------------ save
  const SAVE_KEY = 'rhymeKingdom.save.v1';
  const DEFAULTS = () => ({
    v: 1, level: 1, stars: 0, coins: 300, cleared: {},
    built: [[0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0]],
    boosters: { hammer: 3, row: 3, col: 3, shuffle: 3 },
    music: true, sfx: true, haptics: true, unlockAll: false, seen: {},
  });
  function loadSave(seed) {
    let data = seed || null;
    if (!data) {
      try { data = JSON.parse(root.localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { data = null; }
    }
    const s = DEFAULTS();
    if (data && typeof data === 'object') {
      Object.assign(s, data);
      s.boosters = Object.assign(DEFAULTS().boosters, data.boosters || {});
      if (!Array.isArray(s.built) || s.built.length !== 5) s.built = DEFAULTS().built;
    }
    return s;
  }
  function storeSave(s) {
    try { root.localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) { /* storage unavailable */ }
  }

  // --------------------------------------------------------------- helpers
  function goalIcon(g, level) {
    switch (g.type) {
      case 'color': return Art.tileUrl(g.color);
      case 'crate': return Art.crateUrl(1);
      case 'floor': return Art.floorUrl();
      case 'tape': return Art.tapeUrl();
      case 'static': return Art.staticUrl(3);
      case 'crown': return Art.crownUrl();
      case 'boss': return Art.portraitUrl(level.boss.kind);
      default: return Art.iconUrl('star');
    }
  }
  function goalLabel(g) {
    switch (g.type) {
      case 'color': return Art.TILE_NAMES[g.color] + 's';
      case 'crate': return 'Crates';
      case 'floor': return 'Floor panels';
      case 'tape': return 'Taped tiles';
      case 'static': return 'Static';
      case 'crown': return 'Crowns';
      case 'boss': return 'Boss health';
      default: return '';
    }
  }
  function chapterOf(n) { return Story.CHAPTERS.find((c) => n >= c.from && n <= c.to) || Story.CHAPTERS[Story.CHAPTERS.length - 1]; }
  function artFor(key) {
    if (key.startsWith('pw:')) return Art.powerUrl(key.slice(3));
    if (key.startsWith('crate:')) return Art.crateUrl(+key.slice(6));
    if (key.startsWith('portrait:')) return Art.portraitUrl(key.slice(9));
    if (key === 'floor') return Art.floorUrl();
    if (key === 'tape') return Art.tapeUrl();
    if (key === 'crown') return Art.crownUrl();
    if (key === 'static') return Art.staticUrl(3);
    return Art.iconUrl('star');
  }
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));

  // ------------------------------------------------------------------- app
  const App = {
    save: null,
    view: null,
    eng: null,
    level: null,
    screen: null,
    display: [],
    tutStep: -1,
    booster: null,
    hintOk: true,

    async boot(snapshot) {
      this.save = loadSave(snapshot && snapshot.save);
      Snd.musicOn = this.save.music;
      Snd.sfxOn = this.save.sfx;
      this.view = new root.RKBoardView($('#board'), $('#fx'), {
        onSwap: (a, b) => this.onSwap(a, b),
        onTap: (p) => this.onTap(p),
        onCell: (p) => this.onCell(p),
        canInput: () => this.screen === 'game' && $('#modal').hidden && $('#dialog').hidden,
        canHint: () => this.hintOk && this.screen === 'game' && $('#modal').hidden,
        goalPos: (i) => this.goalPos(i),
        goalTick: (i, d) => this.goalTick(i, d),
        setMoves: (n) => this.setMoves(n),
        bossTimer: (n) => this.setBossTimer(n),
        haptic: (ms) => { if (this.save.haptics && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* ignore */ } } },
      });
      await this.view.init();
      this._wire();
      this._titleArt();
      this.show('title');
      root.addEventListener('resize', () => this.view.layout());
      if (root.claude && root.claude.hot && root.claude.hot.snapshot) {
        try { root.claude.hot.snapshot(() => ({ save: this.save })); } catch (e) { /* not in a viewer */ }
      }
    },

    persist() { storeSave(this.save); this.refreshCounters(); },

    // The blurred painting of an area sits behind every screen.
    setBackdrop(key, silenced) {
      const el = $('#backdrop-art');
      if (el) el.style.backgroundImage = `url("${Art.sceneUrl(key, silenced)}")`;
    },

    show(name) {
      this.screen = name;
      for (const el of document.querySelectorAll('.screen')) el.hidden = el.id !== 'scr-' + name;
      document.body.dataset.screen = name;
      if (name === 'game') requestAnimationFrame(() => this.view.layout());
    },

    _wire() {
      $('#btn-start').addEventListener('click', () => this.start());
      $('#btn-play').addEventListener('click', () => { Snd.fx('click'); this.playNext(); });
      $('#btn-build').addEventListener('click', () => { Snd.fx('click'); this.openBuild(); });
      $('#btn-settings').addEventListener('click', () => { Snd.fx('click'); this.openSettings(); });
      $('#btn-pause').addEventListener('click', () => { Snd.fx('click'); this.openPause(); });
      for (const b of document.querySelectorAll('.booster')) {
        b.addEventListener('click', () => this.pickBooster(b.dataset.b));
      }
      for (const b of document.querySelectorAll('.booster img')) b.src = Art.iconUrl(BOOSTERS[b.parentElement.dataset.b].icon);
      $('#home-stars img').src = Art.iconUrl('star');
      $('#home-coins img').src = Art.iconUrl('coin');
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.screen === 'game' && $('#modal').hidden) this.openPause();
      });
    },

    _titleArt() {
      const cast = ['djDuchess', 'kingFlow', 'queenCadence'];
      this.setBackdrop('block');
      $('#title-cast').innerHTML = cast.map((k, i) => `<img class="cast-${i}" src="${Art.portraitUrl(k)}" alt="${esc(Story.CAST[k].name)}">`).join('');
    },

    async start() {
      Snd.unlock();
      Snd.fx('scratch');
      Snd.play('menu');
      if (!this.save.seen.intro) {
        this.save.seen.intro = 1;
        this.persist();
        await this.story(Story.SCENES.intro);
      }
      this.goHome();
    },

    // ---------------------------------------------------------------- home
    currentArea() {
      const i = this.save.built.findIndex((a) => a.some((x) => !x));
      return i < 0 ? 4 : i;
    },

    goHome() {
      this.show('home');
      Snd.play('menu');
      this.renderHome();
    },

    renderHome() {
      const ai = this.currentArea();
      const area = Art.AREAS[ai];
      const built = this.save.built[ai];
      const n = built.filter(Boolean).length;
      $('#area-chapter').textContent = 'Area ' + (ai + 1) + ' of 5';
      $('#area-name').textContent = area.name;
      $('#area-count').textContent = `${n}/5 built`;
      $('#area-bar').style.width = (n / 5) * 100 + '%';
      $('#scene').innerHTML = Art.scene(ai, built);
      this.setBackdrop(area.key, n < 5);
      const host = area.host;
      $('#host-face').src = Art.portraitUrl(host);
      $('#host-face').alt = Story.CAST[host].name;
      $('#host-name').textContent = Story.CAST[host].name;
      $('#host-line').textContent = this.hostLine(ai, n);
      const lv = this.save.level;
      const play = $('#btn-play');
      if (lv > LEVELS.length) {
        play.innerHTML = '<span class="btn-kicker">All 25 cleared</span>Replay a level';
      } else {
        const L = LEVELS[lv - 1];
        const tag = L.hard === 2 ? '<span class="tag tag-super">Super hard</span>' : L.hard ? '<span class="tag tag-hard">Hard</span>' : '';
        play.innerHTML = `<span class="btn-kicker">${esc(L.name)}</span>Level ${lv}${tag}`;
      }
      this.renderPath();
      const buildBtn = $('#btn-build');
      buildBtn.classList.toggle('ready', this.save.stars > 0 && n < 5);
      this.refreshCounters();
    },

    // The five levels of the current chapter as a path of stops.
    renderPath() {
      const lv = Math.min(this.save.level, LEVELS.length);
      const ch = chapterOf(lv);
      const stops = [];
      for (let n = ch.from; n <= ch.to; n++) {
        const L = LEVELS[n - 1];
        const done = !!this.save.cleared[n];
        const cur = n === this.save.level;
        const face = L.boss ? `<img src="${Art.portraitUrl(L.boss.kind)}" alt="">` : '';
        stops.push(`<li class="stop${done ? ' done' : ''}${cur ? ' current' : ''}${L.boss ? ' boss' : ''}" title="Level ${n}: ${esc(L.name)}">
          ${face}<b>${n}</b>${done ? `<img class="stop-star" src="${Art.iconUrl('star')}" alt="cleared">` : ''}</li>`);
      }
      $('#path-title').textContent = `Chapter ${ch.n}: ${ch.title}`;
      $('#path').innerHTML = stops.join('');
    },

    hostLine(ai, n) {
      const s = this.save.stars;
      if (this.save.built.every((a) => a.every(Boolean))) return 'The whole Kingdom is rebuilt. Thank you, for real.';
      if (n === 5) return 'This spot is done. Next stop on the map!';
      if (s > 0) return `You’ve got ${s} star${s > 1 ? 's' : ''}. Tap Build and let’s fix up ${Art.AREAS[ai].name}!`;
      if (this.save.level > LEVELS.length) return 'All 25 levels cleared. Replay any level for coins and stars.';
      return `Win Level ${this.save.level} to earn a star, then spend it here.`;
    },

    refreshCounters() {
      $('#home-stars b').textContent = this.save.stars;
      $('#home-coins b').textContent = this.save.coins;
      for (const b of document.querySelectorAll('.booster')) {
        const n = this.save.boosters[b.dataset.b] || 0;
        b.querySelector('.count').textContent = n > 0 ? n : '+';
        b.classList.toggle('empty', n <= 0);
      }
    },

    openBuild() {
      const ai = this.currentArea();
      const area = Art.AREAS[ai];
      const built = this.save.built[ai];
      const rows = area.items.map((it, i) => `
        <li class="build-row${built[i] ? ' done' : ''}">
          <span class="build-name">${esc(it.name)}</span>
          ${built[i] ? '<span class="build-done">Built</span>'
            : `<button class="btn btn-gold btn-small" data-build="${i}" ${this.save.stars < 1 ? 'disabled' : ''}>Build <img src="${Art.iconUrl('star')}" alt="">1</button>`}
        </li>`).join('');
      this.modal(`
        <h2 class="modal-title">${esc(area.name)}</h2>
        <p class="modal-sub">You have <b>${this.save.stars}</b> star${this.save.stars === 1 ? '' : 's'}. Each piece costs one.</p>
        <ul class="build-list">${rows}</ul>
        <div class="modal-actions"><button class="btn btn-plum" data-close>Close</button></div>`, {
        onClick: (el) => {
          if (el.dataset.build != null) { this.build(ai, +el.dataset.build); return true; }
          return false;
        },
      });
    },

    async build(ai, i) {
      if (this.save.stars < 1 || this.save.built[ai][i]) return;
      this.save.stars -= 1;
      this.save.built[ai][i] = 1;
      this.persist();
      this.closeModal();
      Snd.fx('build');
      this.renderHome();
      const el = document.querySelector(`#scene .build-item[data-item="${i}"]`);
      if (el) { el.classList.remove('built'); void el.getBoundingClientRect(); el.classList.add('built', 'just-built'); }
      this.confetti($('#scene'));
      if (this.save.built[ai].every(Boolean)) {
        await pause(1300);
        const next = Art.AREAS[ai + 1];
        await this.alert(`${Art.AREAS[ai].name} is restored!`,
          next ? `Next up: ${next.name}. Keep winning levels to earn stars.` : 'The whole Kingdom of Rhyme is rebuilt. You did that.',
          'Let’s go');
        this.renderHome();
      }
    },

    // ------------------------------------------------------------- levels
    playNext() {
      if (this.save.level > LEVELS.length) { this.openLevels(); return; }
      this.startLevel(this.save.level);
    },

    async startLevel(n, opts = {}) {
      const L = LEVELS[n - 1];
      if (!L) return;
      const key = 'before-' + n;
      if (Story.SCENES[key] && !this.save.seen[key] && !opts.retry) {
        this.save.seen[key] = 1;
        this.persist();
        await this.story(Story.SCENES[key]);
      }
      if (!opts.retry) {
        const go = await this.levelCard(L);
        if (!go) return;
        if (L.intro && !this.save.seen['intro-' + L.intro]) {
          this.save.seen['intro-' + L.intro] = 1;
          this.persist();
          await this.introCard(Story.INTROS[L.intro]);
        }
      }
      this.level = L;
      this.eng = new Engine(L, (Math.random() * 4294967296) >>> 0);
      this.boosterOff();
      this.show('game');
      const ch = chapterOf(n);
      document.body.dataset.chapter = ch.bg;
      this.setBackdrop(ch.bg);
      Snd.play(L.boss ? 'boss' : ch.track);
      $('#hud-level').textContent = `Level ${n}`;
      const hard = $('#hud-hard');
      hard.hidden = !L.hard;
      hard.textContent = L.hard === 2 ? 'Super hard' : 'Hard';
      this.setBossTimer(L.boss ? this.eng.boss.timer : null);
      this.buildGoals();
      this.setMoves(this.eng.moves);
      this.refreshCounters();
      this.view.load(this.eng);
      this.tutStep = L.tutorial && !opts.retry ? 0 : -1;
      this.applyTutorial();
    },

    levelCard(L) {
      const ch = chapterOf(L.id);
      const counts = new Engine({ ...L, tutorial: null }, 1).goals;
      const goals = L.goals.map((g, i) =>
        `<li><img src="${goalIcon(g, L)}" alt=""><b>${counts[i].need}</b><span>${esc(goalLabel(g))}</span></li>`).join('');
      const hard = L.hard === 2 ? '<span class="tag tag-super">Super hard</span>' : L.hard ? '<span class="tag tag-hard">Hard</span>' : '';
      const face = L.boss ? Art.portraitUrl(L.boss.kind) : Art.portraitUrl(ch.host);
      return new Promise((res) => {
        this.modal(`
          <div class="level-card">
            <img class="level-face" src="${face}" alt="">
            <p class="modal-kicker">Chapter ${ch.n}: ${esc(ch.title)}</p>
            <h2 class="modal-title">Level ${L.id} ${hard}</h2>
            <p class="level-name">${esc(L.name)}</p>
            <ul class="goal-list">${goals}</ul>
            <p class="modal-sub">${L.moves} moves</p>
          </div>
          <div class="modal-actions">
            <button class="btn btn-plum" data-v="0">Back</button>
            <button class="btn btn-gold btn-big" data-v="1">Play</button>
          </div>`, { onClick: (el) => { if (el.dataset.v != null) { Snd.fx('click'); this.closeModal(true); res(el.dataset.v === '1'); return true; } return false; }, onClose: () => res(false) });
      });
    },

    introCard(intro) {
      return new Promise((res) => {
        this.modal(`
          <p class="new-badge">New!</p>
          <img class="intro-art" src="${artFor(intro.art)}" alt="">
          <h2 class="modal-title">${esc(intro.title)}</h2>
          <p class="modal-text">${esc(intro.text)}</p>
          <div class="modal-actions"><button class="btn btn-gold" data-close>Got it</button></div>`, { onClose: res });
      });
    },

    buildGoals() {
      const L = this.level;
      this.display = this.eng.goals.map((g) => g.left);
      $('#hud-goals').innerHTML = this.eng.goals.map((g, i) =>
        `<div class="goal" data-g="${i}" title="${esc(goalLabel(g))}"><img src="${goalIcon(g, L)}" alt="${esc(goalLabel(g))}"><b>${g.left}</b></div>`).join('');
    },

    goalPos(i) {
      const el = document.querySelector(`.goal[data-g="${i}"] img`);
      if (!el) return null;
      const r = el.getBoundingClientRect(), a = $('#app').getBoundingClientRect();
      return { x: r.left - a.left + r.width / 2, y: r.top - a.top + r.height / 2 };
    },

    goalTick(i, d) {
      this.display[i] = Math.max(0, (this.display[i] || 0) + d);
      const el = document.querySelector(`.goal[data-g="${i}"]`);
      if (!el) return;
      el.querySelector('b').textContent = this.display[i];
      el.classList.toggle('done', this.display[i] <= 0);
      el.classList.remove('bump');
      void el.offsetWidth;
      el.classList.add('bump');
    },

    setMoves(n) {
      const el = $('#hud-moves');
      el.textContent = n;
      el.parentElement.classList.toggle('low', n <= 5 && this.eng && this.eng.status === 'playing');
    },

    setBossTimer(n) {
      const el = $('#hud-boss');
      if (n == null || !this.level || !this.level.boss) { el.hidden = true; return; }
      el.hidden = false;
      const who = Story.CAST[this.level.boss.kind].name;
      el.textContent = n === 1 ? `${who} strikes next move!` : `${who} strikes in ${n} moves`;
      el.classList.toggle('soon', n === 1);
    },

    // ------------------------------------------------------------ tutorial
    applyTutorial() {
      const steps = this.level && this.level.tutorial;
      const coach = $('#coach');
      const relayout = () => requestAnimationFrame(() => this.view.layout());
      if (!steps || this.tutStep < 0 || this.tutStep >= steps.length) {
        this.view.tut = null;
        if (!coach.hidden) { coach.hidden = true; relayout(); }
        this.tutStep = -1;
        return;
      }
      const s = steps[this.tutStep];
      // Safety net: if the scripted move is not possible on this board, end the tutorial.
      const can = s.do === 'swap'
        ? this.eng._swappable(s.a) && this.eng._swappable(s.b)
        : (() => { const cl = this.eng.cell(s.at.c, s.at.r); return !!(cl && cl.tile && cl.tile.k === 'p' && !cl.tape); })();
      if (!can) { this.tutStep = steps.length; this.applyTutorial(); return; }
      if (s.do === 'swap') this.view.tut = { kind: 'swap', a: s.a, b: s.b, cells: [s.a, s.b] };
      else this.view.tut = { kind: 'tap', a: s.at, cells: [s.at] };
      const host = chapterOf(this.level.id).host;
      $('#coach-face').src = Art.portraitUrl(host);
      $('#coach-text').textContent = s.text || '';
      coach.hidden = false;
      relayout();
    },

    // -------------------------------------------------------------- moves
    async onSwap(a, b) {
      if (this.view.busy || !this.eng || this.eng.status !== 'playing') return;
      if (this.booster) return;
      const res = this.eng.swap(a, b);
      if (!res.events.length) return;
      await this.view.play(res.events);
      if (res.ok) await this.afterMove();
    },

    async onTap(p) {
      if (this.view.busy || !this.eng || this.eng.status !== 'playing') return;
      const res = this.eng.tap(p);
      if (!res.ok) return;
      await this.view.play(res.events);
      await this.afterMove();
    },

    async afterMove() {
      if (this.tutStep >= 0) { this.tutStep++; this.applyTutorial(); }
      if (this.eng.status === 'won') await this.win();
      else if (this.eng.status === 'lost') await this.lose();
    },

    // ------------------------------------------------------------ boosters
    pickBooster(type) {
      if (this.screen !== 'game' || this.view.busy || !this.eng || this.eng.status !== 'playing' || this.tutStep >= 0) return;
      Snd.fx('click');
      if (this.booster === type) { this.boosterOff(); return; }
      if ((this.save.boosters[type] || 0) <= 0) { this.buyBooster(type); return; }
      if (type === 'shuffle') { this.useBooster('shuffle', null); return; }
      this.booster = type;
      this.view.targeting = type;
      for (const b of document.querySelectorAll('.booster')) b.classList.toggle('active', b.dataset.b === type);
      this.toast(BOOSTERS[type].hint);
    },

    boosterOff() {
      this.booster = null;
      if (this.view) this.view.targeting = null;
      for (const b of document.querySelectorAll('.booster')) b.classList.remove('active');
      this.toast(null);
    },

    async onCell(p) {
      if (!this.booster) return;
      const type = this.booster;
      await this.useBooster(type, p);
    },

    async useBooster(type, p) {
      const res = this.eng.booster(type, p || { c: 0, r: 0 });
      if (!res.ok) return;
      this.save.boosters[type]--;
      this.persist();
      this.boosterOff();
      await this.view.play(res.events);
      await this.afterMove();
    },

    buyBooster(type) {
      const b = BOOSTERS[type];
      const can = this.save.coins >= BOOSTER_PRICE;
      this.modal(`
        <img class="intro-art" src="${Art.iconUrl(b.icon)}" alt="">
        <h2 class="modal-title">${esc(b.name)}</h2>
        <p class="modal-text">You’re out. Get one more for ${BOOSTER_PRICE} coins?</p>
        <p class="modal-sub">You have ${this.save.coins} coins.</p>
        <div class="modal-actions">
          <button class="btn btn-plum" data-close>Not now</button>
          <button class="btn btn-gold" data-buy ${can ? '' : 'disabled'}>Buy <img src="${Art.iconUrl('coin')}" alt="">${BOOSTER_PRICE}</button>
        </div>`, {
        onClick: (el) => {
          if (el.dataset.buy == null) return false;
          this.save.coins -= BOOSTER_PRICE;
          this.save.boosters[type] = (this.save.boosters[type] || 0) + 1;
          this.persist();
          Snd.fx('coin');
          this.closeModal();
          return true;
        },
      });
    },

    // ----------------------------------------------------------- win / lose
    async win() {
      this.view.tut = null;
      if (!$('#coach').hidden) { $('#coach').hidden = true; this.view.layout(); }
      const n = this.level.id;
      const first = !this.save.cleared[n];
      this.hintOk = false;
      if (this.eng.moves > 0) {
        this.view.text('ENCORE!', this.view.W / 2, this.view.oy + this.view.rows * this.view.S * 0.4, Math.min(this.view.W / 6, 64), '#ff2a3d', 1.2);
        Snd.fx('horn', 2);
        await pause(600);
      }
      const enc = this.eng.encore();
      await this.view.play(enc.events);
      Snd.fx('win');
      const coins = 20 + enc.bonus * 4;
      this.save.coins += coins;
      if (first) {
        this.save.cleared[n] = 1;
        this.save.stars += 1;
      }
      if (this.save.level === n) this.save.level = n + 1;
      this.persist();
      this.hintOk = true;
      const ch = chapterOf(n);
      const hype = HYPE[(n * 7 + Math.floor(Math.random() * 3)) % HYPE.length];
      await new Promise((res) => {
        this.modal(`
          <div class="win-card">
            <p class="win-burst">Level ${n} complete!</p>
            <img class="win-face" src="${Art.portraitUrl(ch.host)}" alt="">
            <p class="win-hype">“${esc(hype)}” <span>${esc(Story.CAST[ch.host].name)}</span></p>
            <ul class="reward-list">
              ${first ? `<li><img src="${Art.iconUrl('star')}" alt=""><b>+1</b><span>Star</span></li>` : ''}
              <li><img src="${Art.iconUrl('coin')}" alt=""><b>+${coins}</b><span>Coins</span></li>
            </ul>
          </div>
          <div class="modal-actions"><button class="btn btn-gold btn-big" data-close>Continue</button></div>`, { onClose: res, celebrate: true });
        this.confetti($('#modal .modal-card'));
      });
      const after = Story.SCENES['after-' + n];
      if (after && !this.save.seen['after-' + n]) {
        this.save.seen['after-' + n] = 1;
        this.persist();
        await this.story(after);
      }
      if (n === LEVELS.length && first) {
        await this.alert('The Kingdom of Rhyme is restored!', 'You beat all 25 levels. Finish building the Block with your stars, and watch for new chapters.', 'Back to the Block');
      }
      this.goHome();
    },

    async lose() {
      this.hintOk = false;
      const goals = this.eng.goals.map((g, i) => (g.left > 0
        ? `<li><img src="${goalIcon(g, this.level)}" alt=""><b>${g.left}</b><span>${esc(goalLabel(g))} left</span></li>` : '')).join('');
      const can = this.save.coins >= CONTINUE_PRICE;
      const choice = await new Promise((res) => {
        this.modal(`
          <h2 class="modal-title">Out of moves</h2>
          <p class="modal-sub">So close. Here’s what’s left:</p>
          <ul class="goal-list">${goals}</ul>
          <div class="modal-actions modal-actions-col">
            <button class="btn btn-gold btn-big" data-v="more" ${can ? '' : 'disabled'}>+5 moves <img src="${Art.iconUrl('coin')}" alt="">${CONTINUE_PRICE}</button>
            <button class="btn btn-pink" data-v="retry">Try again</button>
            <button class="btn btn-plum" data-v="home">Back to the Block</button>
          </div>
          <p class="modal-sub">You have ${this.save.coins} coins.</p>`, {
          onClick: (el) => { if (el.dataset.v) { this.closeModal(true); res(el.dataset.v); return true; } return false; },
          onClose: () => res('home'),
        });
      });
      this.hintOk = true;
      if (choice === 'more') {
        this.save.coins -= CONTINUE_PRICE;
        this.persist();
        Snd.fx('coin');
        Snd.play(this.level.boss ? 'boss' : chapterOf(this.level.id).track);
        this.eng.addMoves(5);
        this.setMoves(this.eng.moves);
      } else if (choice === 'retry') {
        this.startLevel(this.level.id, { retry: true });
      } else this.goHome();
    },

    // --------------------------------------------------------------- menus
    openPause() {
      if (this.screen !== 'game' || !$('#modal').hidden) return;
      this.modal(`
        <h2 class="modal-title">Paused</h2>
        <div class="toggles">${this.toggleRows()}</div>
        <div class="modal-actions modal-actions-col">
          <button class="btn btn-gold btn-big" data-close>Resume</button>
          <button class="btn btn-pink" data-v="restart">Restart level</button>
          <button class="btn btn-plum" data-v="home">Quit to the Block</button>
        </div>`, {
        onClick: (el) => {
          if (this.handleToggle(el)) return true;
          if (el.dataset.v === 'restart') { this.closeModal(); this.startLevel(this.level.id, { retry: true }); return true; }
          if (el.dataset.v === 'home') { this.closeModal(); this.goHome(); return true; }
          return false;
        },
      });
    },

    toggleRows() {
      const row = (key, label) => `<button class="toggle" data-toggle="${key}" aria-pressed="${this.save[key] ? 'true' : 'false'}"><span>${label}</span><i></i></button>`;
      return row('music', 'Music') + row('sfx', 'Sound effects') + row('haptics', 'Vibration');
    },

    handleToggle(el) {
      const key = el.dataset.toggle;
      if (!key) return false;
      this.save[key] = !this.save[key];
      el.setAttribute('aria-pressed', this.save[key] ? 'true' : 'false');
      if (key === 'music') Snd.setMusic(this.save.music);
      if (key === 'sfx') Snd.setSfx(this.save.sfx);
      this.persist();
      Snd.fx('click');
      return true;
    },

    openSettings() {
      this.modal(`
        <h2 class="modal-title">Settings</h2>
        <div class="toggles">${this.toggleRows()}
          <button class="toggle" data-toggle="unlockAll" aria-pressed="${this.save.unlockAll ? 'true' : 'false'}"><span>Creator preview: unlock all levels</span><i></i></button>
        </div>
        <div class="modal-actions modal-actions-col">
          <button class="btn btn-gold" data-v="levels">Level select</button>
          <button class="btn btn-pink" data-v="story">Replay the intro story</button>
          <button class="btn btn-plum" data-v="reset">Reset progress</button>
        </div>
        <p class="credits">Rhyme Kingdom is a Cloudnhyne Designz game. Characters, art and music are original and made in code.</p>
        <div class="modal-actions"><button class="btn btn-plum" data-close>Close</button></div>`, {
        onClick: (el) => {
          if (this.handleToggle(el)) return true;
          const v = el.dataset.v;
          if (v === 'levels') { this.closeModal(); this.openLevels(); return true; }
          if (v === 'story') { this.closeModal(); this.story(Story.SCENES.intro).then(() => this.goHome()); return true; }
          if (v === 'reset') { this.confirmReset(); return true; }
          return false;
        },
      });
    },

    confirmReset() {
      this.modal(`
        <h2 class="modal-title">Reset progress?</h2>
        <p class="modal-text">This erases your levels, stars, coins and everything you built. It can’t be undone.</p>
        <div class="modal-actions">
          <button class="btn btn-plum" data-close>Keep my progress</button>
          <button class="btn btn-pink" data-v="yes">Erase it</button>
        </div>`, {
        onClick: (el) => {
          if (el.dataset.v !== 'yes') return false;
          const keep = { music: this.save.music, sfx: this.save.sfx, haptics: this.save.haptics };
          this.save = Object.assign(DEFAULTS(), keep);
          this.persist();
          this.closeModal();
          this.goHome();
          this.toast('Progress reset. Fresh start!', 2200);
          return true;
        },
      });
    },

    openLevels() {
      const max = this.save.unlockAll ? LEVELS.length : Math.min(this.save.level, LEVELS.length);
      const cells = LEVELS.map((L) => {
        const open = L.id <= max;
        const done = this.save.cleared[L.id];
        const cls = ['lv', done ? 'lv-done' : '', open ? '' : 'lv-locked', L.boss ? 'lv-boss' : '', L.hard ? 'lv-hard' : ''].join(' ');
        return `<button class="${cls}" data-lv="${L.id}" ${open ? '' : 'disabled'} aria-label="Level ${L.id}${done ? ', cleared' : ''}${open ? '' : ', locked'}">
          <b>${L.id}</b>${done ? `<img src="${Art.iconUrl('star')}" alt="">` : open ? '' : `<img src="${Art.iconUrl('lock')}" alt="">`}</button>`;
      }).join('');
      const chapters = Story.CHAPTERS.map((c) => `<span>${c.from}–${c.to} ${esc(c.title)}</span>`).join('');
      this.modal(`
        <h2 class="modal-title">Levels</h2>
        <div class="lv-grid">${cells}</div>
        <p class="lv-legend">${chapters}</p>
        <div class="modal-actions"><button class="btn btn-plum" data-close>Close</button></div>`, {
        onClick: (el) => {
          if (!el.dataset.lv) return false;
          this.closeModal();
          this.startLevel(+el.dataset.lv);
          return true;
        },
      });
    },

    // ------------------------------------------------------------- dialogs
    story(lines) {
      const box = $('#dialog');
      return new Promise((res) => {
        let i = 0;
        const showLine = () => {
          if (i >= lines.length) {
            box.hidden = true;
            box.onclick = null;
            res();
            return;
          }
          const [who, text] = lines[i];
          const c = Story.CAST[who];
          box.innerHTML = `
            <div class="dialog-card${c.villain ? ' villain' : ''}" style="--who:${c.color}">
              <img class="dialog-face" src="${Art.portraitUrl(who)}" alt="">
              <div class="dialog-body">
                <p class="dialog-name">${esc(c.name)} <span>${esc(c.role)}</span></p>
                <p class="dialog-text">${esc(text)}</p>
                <div class="dialog-foot"><span class="dialog-step">${i + 1} / ${lines.length}</span>
                  <button class="btn btn-small btn-gold" id="dialog-next">${i === lines.length - 1 ? 'Let’s go' : 'Next'}</button>
                  <button class="btn btn-small btn-ghost" id="dialog-skip">Skip</button></div>
              </div>
            </div>`;
          box.hidden = false;
          const card = box.querySelector('.dialog-card');
          card.classList.add('enter');
          box.querySelector('#dialog-skip').onclick = (e) => { e.stopPropagation(); Snd.fx('click'); i = lines.length; showLine(); };
          box.onclick = () => { Snd.fx('click'); i++; showLine(); };
        };
        showLine();
      });
    },

    modal(html, opts = {}) {
      const m = $('#modal');
      m.innerHTML = `<div class="modal-card${opts.celebrate ? ' celebrate' : ''}" role="dialog" aria-modal="true">${html}</div>`;
      m.hidden = false;
      this._modalOpts = opts;
      m.onclick = (e) => {
        const el = e.target.closest('button, [data-close]');
        if (!el) return;
        if (el.hasAttribute('data-close')) { Snd.fx('click'); this.closeModal(); return; }
        if (opts.onClick) opts.onClick(el);
      };
      const first = m.querySelector('.btn-gold:not([disabled]), button:not([disabled])');
      if (first) setTimeout(() => first.focus({ preventScroll: true }), 30);
    },

    // `silent` closes without firing onClose (the caller already settled).
    closeModal(silent) {
      const m = $('#modal');
      if (m.hidden) return;
      m.hidden = true;
      m.innerHTML = '';
      const o = this._modalOpts;
      this._modalOpts = null;
      if (!silent && o && o.onClose) o.onClose();
    },

    alert(title, text, ok) {
      return new Promise((res) => {
        this.modal(`<h2 class="modal-title">${esc(title)}</h2><p class="modal-text">${esc(text)}</p>
          <div class="modal-actions"><button class="btn btn-gold" data-close>${esc(ok || 'OK')}</button></div>`, { onClose: res, celebrate: true });
        this.confetti($('#modal .modal-card'));
      });
    },

    toast(text, ms) {
      const t = $('#toast');
      clearTimeout(this._toastT);
      if (!text) { t.hidden = true; return; }
      t.textContent = text;
      t.hidden = false;
      if (ms) this._toastT = setTimeout(() => { t.hidden = true; }, ms);
    },

    confetti(host) {
      if (!host) return;
      const colors = ['#e3192b', '#ffffff', '#8d8d93', '#ff2a3d', '#2c2c30'];
      const layer = document.createElement('div');
      layer.className = 'confetti';
      for (let i = 0; i < 36; i++) {
        const s = document.createElement('i');
        s.style.left = Math.random() * 100 + '%';
        s.style.background = colors[i % colors.length];
        s.style.animationDelay = Math.random() * 0.4 + 's';
        s.style.animationDuration = 1.4 + Math.random() * 1.2 + 's';
        s.style.setProperty('--x', (Math.random() - 0.5) * 160 + 'px');
        s.style.setProperty('--r', Math.random() * 720 - 360 + 'deg');
        layer.appendChild(s);
      }
      host.appendChild(layer);
      setTimeout(() => layer.remove(), 3200);
    },
  };

  root.RKApp = App;
})(typeof self !== 'undefined' ? self : this);
