/*
 * Rhyme Kingdom: sound.
 * Music: produced tracks in assets/music/ (theme song, G-funk and stutter-beat
 * level loops, boss and arena loops, win and lose stingers). Drop a new MP3 with
 * the same name in that folder to replace one. If a track can't load, the
 * built-in synthesized boom-bap plays instead.
 * Effects are synthesized live with the Web Audio API.
 */
(function (root) {
  'use strict';

  const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  function freq(n) {
    const m = /^([A-G][b#]?)(-?\d)$/.exec(n);
    if (!m) return 440;
    const midi = (+m[2] + 1) * 12 + NOTE[m[1]];
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  const DRUMS = {
    boom: { k: '1000000100100000', s: '0000100000001000', h: '1010101010101011' },
    soft: { k: '1000000000100000', s: '0000100000001000', h: '0010001000100010' },
    break: { k: '1000001001100000', s: '0000100101001001', h: '1111111111111111' },
    boss: { k: '1001001010010010', s: '0000100000001010', h: '1010101010101010' },
  };

  // Chords are voiced around middle C; bass notes give the root of each bar.
  const TRACKS = {
    menu: { bpm: 84, drums: 'soft', comp: [0, 10], chords: [['F3', 'A3', 'C4', 'E4'], ['E3', 'G3', 'B3', 'D4'], ['D3', 'F3', 'A3', 'C4'], ['C3', 'E3', 'G3', 'B3']], bass: ['F2', 'E2', 'D2', 'C2'] },
    block: { bpm: 90, drums: 'boom', comp: [0, 7, 10], chords: [['D3', 'F3', 'C4', 'E4'], ['G3', 'B3', 'F4', 'A4'], ['C3', 'E3', 'B3', 'D4'], ['A3', 'C#4', 'G4', 'Bb4']], bass: ['D2', 'G2', 'C2', 'A1'] },
    shop: { bpm: 88, drums: 'boom', comp: [0, 6, 10], chords: [['C3', 'Eb3', 'Bb3', 'D4'], ['F3', 'Ab3', 'Eb4', 'G4'], ['Bb2', 'D3', 'A3', 'C4'], ['Eb3', 'G3', 'D4', 'F4']], bass: ['C2', 'F2', 'Bb1', 'Eb2'] },
    blacktop: { bpm: 96, drums: 'break', comp: [0, 3, 10], chords: [['E3', 'G3', 'D4', 'F#4'], ['A3', 'C#4', 'G4', 'B4'], ['D3', 'F#3', 'C#4', 'E4'], ['B2', 'D3', 'A3', 'C#4']], bass: ['E2', 'A1', 'D2', 'B1'] },
    wall: { bpm: 92, drums: 'boom', comp: [0, 10, 14], chords: [['G3', 'Bb3', 'F4', 'A4'], ['C3', 'E3', 'Bb3', 'D4'], ['F3', 'A3', 'E4', 'G4'], ['D3', 'F3', 'C4', 'E4']], bass: ['G1', 'C2', 'F1', 'D2'] },
    arena: { bpm: 94, drums: 'boom', comp: [0, 6, 10], chords: [['A3', 'C4', 'G4', 'B4'], ['F3', 'A3', 'E4', 'G4'], ['C3', 'E3', 'G3', 'D4'], ['G3', 'B3', 'D4', 'F4']], bass: ['A1', 'F1', 'C2', 'G1'] },
    boss: { bpm: 100, drums: 'boss', comp: [0, 3, 6, 12], stab: true, chords: [['C3', 'Eb3', 'G3', 'C4'], ['Ab2', 'C3', 'Eb3', 'Ab3'], ['F2', 'Ab2', 'C3', 'F3'], ['G2', 'B2', 'D3', 'F3']], bass: ['C2', 'Ab1', 'F1', 'G1'] },
  };

  // Which produced track plays for each game moment.
  const FILES = { menu: 'theme', block: 'gfunk', shop: 'stutter', blacktop: 'gfunk', wall: 'stutter', arena: 'arena', boss: 'boss', daily: 'stutter' };
  const musicUrl = (k) => (root.RK_ASSETS && root.RK_ASSETS['music/' + k]) || 'assets/music/' + k + '.mp3';

  class Sound {
    constructor() {
      this.ctx = null;
      this.musicOn = true;
      this.sfxOn = true;
      this.track = null;
      this.want = null;
      this.timer = null;
      this.kicks = [];
    }

    // Must run inside a user gesture (browsers block audio until then).
    unlock() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return;
      const c = (this.ctx = new AC());
      this.master = c.createGain();
      this.master.gain.value = 0.85;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
      this.master.connect(comp).connect(c.destination);
      this.music = c.createGain();
      this.music.gain.value = this.musicOn ? 0.5 : 0;
      this.music.connect(this.master);
      this.sfx = c.createGain();
      this.sfx.gain.value = this.sfxOn ? 0.85 : 0;
      this.sfx.connect(this.master);
      this.noise = this._noise(2);
      this.verb = c.createConvolver();
      this.verb.buffer = this._impulse(1.8);
      this.verbIn = c.createGain();
      this.verbIn.gain.value = 0.3;
      this.verbIn.connect(this.verb).connect(this.master);
      this._crackle();
      this._media();
      document.addEventListener('visibilitychange', () => {
        if (!this.ctx) return;
        if (document.hidden) this.ctx.suspend(); else this.ctx.resume();
      });
      if (this.want) { const w = this.want; this.want = null; this.track = null; this.play(w); }
    }

    // One streaming element for music and one for stingers. Both are started
    // inside the unlocking gesture so phones allow them to play later.
    _media() {
      const c = this.ctx;
      const mk = () => { const a = new Audio(); a.preload = 'auto'; a.crossOrigin = 'anonymous'; return a; };
      this.el = mk(); this.el.loop = true;
      this.sting = mk();
      // Routing through Web Audio lets the beat drive the visuals. Pages opened
      // straight from disk can't route media, so they play the element directly.
      this.routed = !!(root.RK_ASSETS || location.protocol !== 'file:');
      this.elGain = c.createGain(); this.elGain.gain.value = 0;
      this.analyser = c.createAnalyser(); this.analyser.fftSize = 512; this.analyser.smoothingTimeConstant = 0.5;
      this.bins = new Uint8Array(this.analyser.frequencyBinCount);
      this.bassAvg = 0;
      if (this.routed) {
        try {
          c.createMediaElementSource(this.el).connect(this.elGain);
          c.createMediaElementSource(this.sting).connect(this.sfx);
        } catch (e) { this.routed = false; }
      }
      this.elGain.connect(this.analyser);
      this.elGain.connect(this.music);
      // prime both elements during the gesture
      for (const a of [this.el, this.sting]) {
        a.src = musicUrl('win'); a.muted = true;
        const p = a.play(); if (p && p.then) p.then(() => { a.pause(); a.muted = false; }, () => { a.muted = false; });
      }
      this.el.addEventListener('error', () => { if (this.file) { this.failed = this.failed || {}; this.failed[this.file] = 1; const t = this.track; this.track = null; this.file = null; this.play(t); } });
    }

    _noise(sec) {
      const c = this.ctx, b = c.createBuffer(1, c.sampleRate * sec, c.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return b;
    }
    _impulse(sec) {
      const c = this.ctx, len = c.sampleRate * sec, b = c.createBuffer(2, len, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = b.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
      }
      return b;
    }
    _crackle() {
      const c = this.ctx, b = c.createBuffer(1, c.sampleRate * 3, c.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) {
        d[i] = (Math.random() * 2 - 1) * 0.012;
        if (Math.random() < 0.0009) d[i] = (Math.random() * 2 - 1) * 0.6;
      }
      const src = c.createBufferSource();
      src.buffer = b; src.loop = true;
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
      const g = c.createGain(); g.gain.value = 0.35;
      src.connect(hp).connect(g).connect(this.music);
      src.start();
    }

    setMusic(on) {
      this.musicOn = on;
      if (this.music) this.music.gain.setTargetAtTime(on ? 0.5 : 0, this.ctx.currentTime, 0.05);
      if (this.el && !this.routed) this.el.volume = on ? 0.6 : 0;
    }
    setSfx(on) {
      this.sfxOn = on;
      if (this.sfx) this.sfx.gain.setTargetAtTime(on ? 0.85 : 0, this.ctx.currentTime, 0.05);
    }

    // ------------------------------------------------------------ sequencer
    play(name) {
      this.want = name;
      if (!this.ctx || this.track === name) return;
      this.track = name;
      const file = FILES[name];
      if (this.el && file && !(this.failed && this.failed[file])) {
        this._stopSeq();
        if (this.file === file && !this.el.paused) return;
        this.file = file;
        this._fadeTo(0, 0.25);
        clearTimeout(this.swapT);
        this.swapT = setTimeout(() => {
          if (this.file !== file) return;
          this.el.loop = true;
          this.el.src = musicUrl(file);
          this.el.currentTime = 0;
          const p = this.el.play(); if (p && p.catch) p.catch(() => {});
          this._fadeTo(1, 0.6);
        }, 260);
        return;
      }
      this.file = null;
      if (this.el) this.el.pause();
      this.cfg = TRACKS[name] || TRACKS.menu;
      this.step = 0;
      this.next = this.ctx.currentTime + 0.12;
      if (!this.timer) this.timer = setInterval(() => this._tick(), 25);
    }
    _fadeTo(v, sec) {
      const vol = this.musicOn ? v : 0;
      if (this.routed) {
        const g = this.elGain.gain, t = this.ctx.currentTime;
        g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(vol * 1.6, t + sec);
      } else if (this.el) {
        this.el.volume = Math.min(1, vol * 0.6);
      }
    }
    _stopSeq() {
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
    }
    stop() {
      this.track = null; this.want = null; this.file = null;
      this._stopSeq();
      if (this.el) { this._fadeTo(0, 0.15); clearTimeout(this.swapT); this.swapT = setTimeout(() => { if (!this.file) this.el.pause(); }, 180); }
    }
    // Plays a produced stinger (win, lose). Returns false if it isn't available.
    _stinger(k) {
      if (!this.sting || (this.failed && this.failed[k])) return false;
      this.sting.src = musicUrl(k);
      this.sting.currentTime = 0;
      if (!this.routed) this.sting.volume = this.sfxOn ? 0.9 : 0;
      const p = this.sting.play();
      if (p && p.catch) p.catch(() => { this.failed = this.failed || {}; this.failed[k] = 1; });
      return true;
    }
    _tick() {
      if (!this.ctx || !this.track) return;
      const sixteenth = 60 / this.cfg.bpm / 4;
      while (this.next < this.ctx.currentTime + 0.12) {
        this._step(this.step, this.next, sixteenth);
        this.step = (this.step + 1) % 64;
        this.next += sixteenth;
      }
    }
    _step(step, t, dur) {
      const cfg = this.cfg, s = step % 16, bar = (step / 16) | 0;
      const swing = s % 2 ? dur * 0.2 : 0;
      const tt = t + swing;
      const pat = DRUMS[cfg.drums];
      if (pat.k[s] === '1') { this.kick(tt, 0.95); this.kicks.push(tt); if (this.kicks.length > 8) this.kicks.shift(); }
      if (pat.s[s] === '1') this.snare(tt, s === 4 || s === 12 ? 0.8 : 0.32);
      if (pat.h[s] === '1') this.hat(tt, s % 4 === 2 ? 0.5 : 0.3, cfg.drums === 'boom' && s === 14);
      const chord = cfg.chords[bar];
      if (cfg.comp.includes(s)) {
        const long = s === 0;
        if (cfg.stab) this.stab(tt, chord, long ? dur * 3 : dur * 1.5);
        else this.keys(tt, chord, long ? dur * 6 : dur * 2.5, long ? 0.18 : 0.11);
      }
      const root = cfg.bass[bar];
      if (s === 0 || s === 10) this.bass(tt, freq(root), dur * (s === 0 ? 5 : 3));
      if (s === 7) this.bass(tt, freq(root) * 1.5, dur * 2);
      if (s === 14) this.bass(tt, freq(root) * 2, dur * 1.5);
    }
    // 0..1 glow that peaks on each kick drum (drives the equalizer visuals).
    pulse() {
      if (!this.ctx || !this.track || !this.musicOn) return 0;
      if (this.file && this.routed) {
        // bass energy above its running average: spikes on every kick
        this.analyser.getByteFrequencyData(this.bins);
        let b = 0;
        for (let i = 1; i < 6; i++) b += this.bins[i];
        b /= 5 * 255;
        this.bassAvg += (b - this.bassAvg) * 0.04;
        this.lastPulse = Math.max((this.lastPulse || 0) * 0.86, Math.min(1, Math.max(0, (b - this.bassAvg * 0.92) * 6)));
        return this.lastPulse;
      }
      if (this.file) return 0.5 + 0.5 * Math.sin(performance.now() / 1000 * Math.PI * 2 * 1.53);
      const now = this.ctx.currentTime;
      let last = -1;
      for (const k of this.kicks) if (k <= now && k > last) last = k;
      return last < 0 ? 0 : Math.exp(-(now - last) * 7);
    }

    // ---------------------------------------------------------- instruments
    _env(g, t, a, peak, d, end = 0.0001) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + a);
      g.gain.exponentialRampToValueAtTime(end, t + a + d);
    }
    _out(bus) { return bus === 'sfx' ? this.sfx : this.music; }

    kick(t, v, bus) {
      const c = this.ctx, o = c.createOscillator(), g = c.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(44, t + 0.13);
      this._env(g, t, 0.004, v, 0.42);
      o.connect(g).connect(this._out(bus));
      o.start(t); o.stop(t + 0.5);
      this._noiseHit(t, 0.012, 'highpass', 2500, v * 0.25, bus);
    }
    snare(t, v, bus) {
      this._noiseHit(t, 0.19, 'bandpass', 1900, v * 0.9, bus, 0.7, true);
      const c = this.ctx, o = c.createOscillator(), g = c.createGain();
      o.type = 'triangle'; o.frequency.setValueAtTime(190, t);
      this._env(g, t, 0.003, v * 0.45, 0.1);
      o.connect(g).connect(this._out(bus));
      o.start(t); o.stop(t + 0.15);
    }
    hat(t, v, open, bus) {
      this._noiseHit(t, open ? 0.22 : 0.045, 'highpass', 7200, v * 0.35, bus);
    }
    _noiseHit(t, dur, type, f, v, bus, q, verb) {
      const c = this.ctx, src = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
      src.buffer = this.noise;
      fl.type = type; fl.frequency.value = f; if (q) fl.Q.value = q;
      this._env(g, t, 0.002, Math.max(0.0002, v), dur);
      src.connect(fl).connect(g).connect(this._out(bus));
      if (verb) g.connect(this.verbIn);
      src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
      return { src, fl, g };
    }
    bass(t, f, dur) {
      const c = this.ctx, o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
      o.type = 'sine'; o.frequency.setValueAtTime(f, t);
      o2.type = 'triangle'; o2.frequency.setValueAtTime(f, t);
      lp.type = 'lowpass'; lp.frequency.value = 520;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.42, t + 0.012);
      g.gain.setValueAtTime(0.42, t + dur * 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const g2 = c.createGain(); g2.gain.value = 0.3;
      o.connect(g); o2.connect(g2).connect(g);
      g.connect(lp).connect(this.music);
      o.start(t); o2.start(t); o.stop(t + dur + 0.02); o2.stop(t + dur + 0.02);
    }
    keys(t, notes, dur, v) {
      const c = this.ctx, lp = c.createBiquadFilter(), bus = c.createGain();
      lp.type = 'lowpass'; lp.frequency.value = 2300;
      bus.gain.value = 1;
      bus.connect(lp).connect(this.music);
      lp.connect(this.verbIn);
      notes.forEach((n, i) => {
        const f = freq(n), tt = t + i * 0.008;
        const o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), g2 = c.createGain();
        o.type = 'sine'; o.frequency.value = f;
        o2.type = 'sine'; o2.frequency.value = f * 2.002;
        g2.gain.value = 0.22;
        g.gain.setValueAtTime(0.0001, tt);
        g.gain.exponentialRampToValueAtTime(v, tt + 0.012);
        g.gain.exponentialRampToValueAtTime(v * 0.35, tt + 0.35);
        g.gain.exponentialRampToValueAtTime(0.0001, tt + dur);
        o.connect(g); o2.connect(g2).connect(g); g.connect(bus);
        o.start(tt); o2.start(tt); o.stop(tt + dur + 0.05); o2.stop(tt + dur + 0.05);
      });
    }
    stab(t, notes, dur) {
      const c = this.ctx, lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(1800, t);
      lp.frequency.exponentialRampToValueAtTime(500, t + dur);
      lp.connect(this.music); lp.connect(this.verbIn);
      notes.forEach((n) => {
        const o = c.createOscillator(), g = c.createGain();
        o.type = 'sawtooth'; o.frequency.value = freq(n); o.detune.value = (Math.random() - 0.5) * 14;
        this._env(g, t, 0.006, 0.07, dur);
        o.connect(g).connect(lp);
        o.start(t); o.stop(t + dur + 0.05);
      });
    }

    // ---------------------------------------------------------------- sfx
    // Every effect is a no-op until audio has been unlocked.
    fx(name, arg) {
      if (!this.ctx || !this.sfxOn) return;
      const t = this.ctx.currentTime + 0.005;
      const f = this['_' + name];
      if (f) f.call(this, t, arg);
    }
    _tone(t, type, f0, f1, dur, v, dest) {
      const c = this.ctx, o = c.createOscillator(), g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      this._env(g, t, 0.005, v, dur);
      o.connect(g).connect(dest || this.sfx);
      o.start(t); o.stop(t + dur + 0.05);
      return g;
    }
    _swap(t) {
      const n = this._noiseHit(t, 0.12, 'bandpass', 500, 0.35, 'sfx', 2);
      n.fl.frequency.exponentialRampToValueAtTime(2600, t + 0.12);
    }
    _bad(t) {
      this._tone(t, 'triangle', 220, 180, 0.09, 0.3);
      this._tone(t + 0.1, 'triangle', 180, 140, 0.12, 0.3);
    }
    _pop(t, n = 0) {
      const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5, 1568, 1760];
      const f = scale[Math.min(scale.length - 1, n)];
      const g = this._tone(t, 'triangle', f, f * 1.01, 0.18, 0.26);
      g.connect(this.verbIn);
      this._tone(t, 'sine', f * 2, f * 2, 0.08, 0.1);
      this._noiseHit(t, 0.02, 'highpass', 4000, 0.15, 'sfx');
    }
    _spray(t) {
      const n = this._noiseHit(t, 0.42, 'highpass', 2500, 0.5, 'sfx');
      n.fl.frequency.exponentialRampToValueAtTime(7000, t + 0.4);
      this._tone(t, 'sawtooth', 300, 900, 0.18, 0.06);
    }
    _boom(t) {
      const c = this.ctx, o = c.createOscillator(), g = c.createGain(), ws = c.createWaveShaper();
      const curve = new Float32Array(256);
      for (let i = 0; i < 256; i++) { const x = (i / 128) - 1; curve[i] = Math.tanh(x * 3); }
      ws.curve = curve;
      o.type = 'sine';
      o.frequency.setValueAtTime(130, t);
      o.frequency.exponentialRampToValueAtTime(32, t + 0.6);
      this._env(g, t, 0.005, 0.95, 0.9);
      o.connect(ws).connect(g).connect(this.sfx);
      o.start(t); o.stop(t + 1);
      this._noiseHit(t, 0.35, 'lowpass', 900, 0.6, 'sfx');
      this.kick(t, 0.9, 'sfx');
    }
    _plane(t) {
      const n = this._noiseHit(t, 0.5, 'bandpass', 600, 0.35, 'sfx', 3);
      n.fl.frequency.exponentialRampToValueAtTime(3000, t + 0.45);
      this._tone(t, 'sine', 600, 1400, 0.4, 0.08);
    }
    _platinum(t) {
      [1046.5, 1318.5, 1568, 2093, 2637].forEach((f, i) => {
        const g = this._tone(t + i * 0.05, 'sine', f, f, 0.5, 0.12);
        g.connect(this.verbIn);
      });
      this._scratch(t + 0.05);
    }
    _scratch(t) {
      const c = this.ctx, src = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
      src.buffer = this.noise;
      bp.type = 'bandpass'; bp.Q.value = 6;
      bp.frequency.setValueAtTime(600, t);
      bp.frequency.linearRampToValueAtTime(2400, t + 0.07);
      bp.frequency.linearRampToValueAtTime(500, t + 0.15);
      bp.frequency.linearRampToValueAtTime(2000, t + 0.22);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.7, t + 0.01);
      g.gain.setValueAtTime(0.7, t + 0.12);
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.14);
      g.gain.exponentialRampToValueAtTime(0.6, t + 0.16);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
      src.connect(bp).connect(g).connect(this.sfx);
      src.start(t, 0.3); src.stop(t + 0.3);
      const o = c.createOscillator(), og = c.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(180, t);
      o.frequency.linearRampToValueAtTime(420, t + 0.07);
      o.frequency.linearRampToValueAtTime(150, t + 0.15);
      o.frequency.linearRampToValueAtTime(380, t + 0.22);
      this._env(og, t, 0.01, 0.06, 0.24);
      o.connect(og).connect(this.sfx);
      o.start(t); o.stop(t + 0.3);
    }
    _horn(t, n = 3) {
      const c = this.ctx;
      for (let k = 0; k < n; k++) {
        const t0 = t + k * 0.2, dur = k === n - 1 ? 0.5 : 0.14;
        const lp = c.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 2600;
        const g = c.createGain();
        this._env(g, t0, 0.01, 0.16, dur);
        lp.connect(g).connect(this.sfx);
        [0, 7, -5].forEach((cents, i) => {
          const o = c.createOscillator();
          o.type = 'sawtooth';
          o.frequency.setValueAtTime(520 + i * 2, t0);
          o.frequency.exponentialRampToValueAtTime(470 + i * 2, t0 + 0.06);
          o.detune.value = cents;
          o.connect(lp);
          o.start(t0); o.stop(t0 + dur + 0.05);
        });
      }
    }
    _crate(t) {
      this._noiseHit(t, 0.08, 'bandpass', 900, 0.6, 'sfx', 1.5);
      this._tone(t, 'square', 160, 90, 0.08, 0.12);
    }
    _floor(t) {
      const g = this._tone(t, 'sine', 1568, 1568, 0.3, 0.12);
      g.connect(this.verbIn);
      this._tone(t + 0.04, 'sine', 2093, 2093, 0.25, 0.08);
    }
    _tape(t) {
      const n = this._noiseHit(t, 0.16, 'bandpass', 3000, 0.45, 'sfx', 1);
      n.fl.frequency.exponentialRampToValueAtTime(800, t + 0.15);
    }
    _static(t) {
      this._noiseHit(t, 0.18, 'highpass', 1200, 0.4, 'sfx');
      this._tone(t, 'square', 90, 60, 0.12, 0.06);
    }
    _crown(t) {
      [784, 988, 1175, 1568].forEach((f, i) => { const g = this._tone(t + i * 0.07, 'triangle', f, f, 0.3, 0.2); g.connect(this.verbIn); });
    }
    _coin(t) {
      this._tone(t, 'square', 988, 988, 0.06, 0.08);
      this._tone(t + 0.07, 'square', 1319, 1319, 0.16, 0.08);
    }
    _click(t) { this._tone(t, 'triangle', 1200, 900, 0.05, 0.15); }
    _build(t) {
      [523, 659, 784, 1047].forEach((f, i) => { const g = this._tone(t + i * 0.09, 'triangle', f, f, 0.35, 0.18); g.connect(this.verbIn); });
      this._horn(t + 0.4, 2);
    }
    _bossHit(t) {
      this._noiseHit(t, 0.14, 'lowpass', 1400, 0.6, 'sfx');
      this._tone(t, 'sawtooth', 110, 60, 0.18, 0.12);
    }
    _bossAttack(t) {
      const n = this._noiseHit(t, 0.5, 'bandpass', 300, 0.5, 'sfx', 4);
      n.fl.frequency.exponentialRampToValueAtTime(3000, t + 0.45);
      this._tone(t, 'square', 70, 140, 0.4, 0.08);
    }
    _win(t) {
      this.stop();
      if (this._stinger('win')) { this._horn(t + 0.2, 2); return; }
      const chord = ['C4', 'E4', 'G4', 'B4', 'D5'];
      chord.forEach((n, i) => { const g = this._tone(t + i * 0.08, 'triangle', freq(n), freq(n), 0.9, 0.16); g.connect(this.verbIn); });
      this._horn(t + 0.5, 3);
      for (let i = 0; i < 4; i++) this.snare(t + 0.5 + i * 0.1, 0.4, 'sfx');
      this.kick(t + 0.5, 0.9, 'sfx');
    }
    _lose(t) {
      this.stop();
      if (this._stinger('lose')) return;
      this._scratch(t);
      [392, 370, 349, 311].forEach((f, i) => {
        const c = this.ctx, o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter(), lfo = c.createOscillator(), lg = c.createGain();
        const t0 = t + 0.35 + i * 0.32, dur = i === 3 ? 0.8 : 0.28;
        o.type = 'sawtooth'; o.frequency.value = f;
        lfo.frequency.value = 6; lg.gain.value = i === 3 ? 6 : 0;
        lfo.connect(lg).connect(o.frequency);
        lp.type = 'lowpass'; lp.frequency.value = 900;
        this._env(g, t0, 0.02, 0.14, dur);
        o.connect(lp).connect(g).connect(this.sfx);
        o.start(t0); o.stop(t0 + dur + 0.05); lfo.start(t0); lfo.stop(t0 + dur + 0.05);
      });
    }
  }

  root.RKSound = new Sound();
})(typeof self !== 'undefined' ? self : this);
