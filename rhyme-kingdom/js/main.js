/*
 * Rhyme Kingdom: boot.
 */
(function (root) {
  'use strict';

  // Equalizer bars along the bottom of the backdrop, pumping with the beat.
  function equalizer() {
    const cv = document.getElementById('eq');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const bars = 28;
    const level = new Array(bars).fill(0.2);
    const colors = ['#e3192b', '#f2f2f2', '#8d8d93', '#ff2a3d', '#d4d4d8'];
    function frame(now) {
      const dpr = Math.min(root.devicePixelRatio || 1, 2);
      const w = cv.clientWidth, h = cv.clientHeight;
      if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const pulse = root.RKSound.pulse();
      const bw = w / bars;
      for (let i = 0; i < bars; i++) {
        const wobble = reduce ? 0.3 : 0.25 + 0.25 * Math.sin(now / 300 + i * 1.7) + 0.2 * Math.sin(now / 170 + i * 0.6);
        const target = Math.max(0.08, wobble * 0.6 + pulse * (0.4 + ((i * 37) % 11) / 22));
        level[i] += (target - level[i]) * 0.25;
        const bh = level[i] * h;
        ctx.fillStyle = colors[i % colors.length];
        const segs = Math.floor(bh / 7);
        for (let s = 0; s < segs; s++) ctx.fillRect(i * bw + 2, h - (s + 1) * 7, bw - 4, 5);
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function start(data) {
    equalizer();
    root.RKApp.boot(data || {});
  }

  function go() {
    const hot = root.claude && root.claude.hot;
    if (hot && hot.ready) hot.ready(start);
    else start((hot && hot.data) || {});
  }

  // Give the web fonts a moment so canvas text uses them; never block for long.
  const fonts = document.fonts && document.fonts.ready
    ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))])
    : Promise.resolve();
  fonts.then(go, go);
})(typeof self !== 'undefined' ? self : this);
