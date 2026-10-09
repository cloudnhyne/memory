/*
 * Rhyme Kingdom: artwork registry.
 * All art is generated imagery (see art-src/ for the source sheets and
 * tools/slice.mjs for how they are cut). In development the images load from
 * assets/; the single-file build inlines them as data URIs in RK_ASSETS.
 */
(function (root) {
  'use strict';

  const A = (k) => (root.RK_ASSETS && root.RK_ASSETS[k]) || 'assets/' + k + '.webp';

  const TILE_NAMES = ['Mic', 'Sneaker', 'Gold Chain', 'Snapback', 'Headphones', 'Mixtape'];

  // Five areas of the Block. Each piece lights up a soft region of the rebuilt
  // painting over the silenced one: [centerX, centerY, radiusX, radiusY] in %.
  const AREAS = [
    {
      key: 'block', name: 'The Block Party', host: 'kingFlow',
      items: [
        { name: 'Turntables', at: [[50, 80, 17, 17]] },
        { name: 'Speaker Stacks', at: [[29, 74, 8, 21], [69, 74, 8, 21]] },
        { name: 'String Lights', at: [[50, 42, 30, 13]] },
        { name: 'Graffiti Mural', at: [[16, 38, 17, 26]] },
        { name: 'Block Party Banner', at: [[50, 19, 24, 13]] },
      ],
    },
    {
      key: 'shop', name: 'The Record Shop', host: 'djDuchess',
      items: [
        { name: 'Neon Sign', at: [[34, 15, 19, 14]] },
        { name: 'Striped Awning', at: [[33, 29, 22, 13]] },
        { name: 'Album Wall', at: [[37, 48, 18, 17]] },
        { name: 'Record Bins', at: [[33, 72, 23, 14]] },
        { name: 'Giant Vinyl', at: [[87, 33, 12, 20]] },
      ],
    },
    {
      key: 'blacktop', name: 'The Blacktop', host: 'princeBreaks',
      items: [
        { name: 'Hoop', at: [[18, 28, 11, 28]] },
        { name: 'Cardboard Dance Floor', at: [[46, 70, 23, 17]] },
        { name: 'Bleachers', at: [[82, 58, 18, 19]] },
        { name: 'Boombox Bench', at: [[53, 44, 11, 11]] },
        { name: 'Court Lights', at: [[44, 22, 9, 28], [85, 22, 9, 28]] },
      ],
    },
    {
      key: 'wall', name: 'The Wall', host: 'countessCanvas',
      items: [
        { name: 'Wildstyle Piece', at: [[36, 38, 31, 21]] },
        { name: 'Character Mural', at: [[77, 40, 11, 20]] },
        { name: 'Paint Cans', at: [[58, 84, 11, 11]] },
        { name: 'Subway Car', at: [[45, 68, 25, 19]] },
        { name: 'Spotlights', at: [[8, 50, 8, 20], [92, 50, 8, 20]] },
      ],
    },
    {
      key: 'arena', name: 'The Crown Arena', host: 'queenCadence',
      items: [
        { name: 'Main Stage', at: [[50, 86, 34, 16]] },
        { name: 'Speaker Towers', at: [[14, 50, 11, 38], [86, 50, 11, 38]] },
        { name: 'Light Rig', at: [[50, 33, 40, 26]] },
        { name: 'Golden Mic Throne', at: [[50, 60, 9, 17]] },
        { name: 'Crown Banner', at: [[50, 12, 21, 15]] },
      ],
    },
  ];

  const mask = (spots) => spots.map(([x, y, rx, ry]) =>
    `radial-gradient(ellipse ${rx}% ${ry}% at ${x}% ${y}%, #000 62%, transparent 100%)`).join(', ');

  // The Block screen: the silenced painting, with each built piece revealed.
  function scene(ai, built) {
    const a = AREAS[ai];
    const done = built.every(Boolean);
    let html = `<img class="scene-off" src="${A('scene-' + a.key + '-off')}" alt="">`;
    a.items.forEach((it, i) => {
      if (!built[i]) return;
      const m = mask(it.at);
      html += `<img class="scene-on build-item built" data-item="${i}" src="${A('scene-' + a.key)}" alt="" style="-webkit-mask-image:${m};mask-image:${m}">`;
    });
    if (done) html += `<img class="scene-on scene-full" src="${A('scene-' + a.key)}" alt="">`;
    a.items.forEach((it, i) => {
      if (built[i]) return;
      const [x, y] = it.at[0];
      html += `<span class="build-spot" style="left:${x}%;top:${y}%" title="${it.name}"><img src="${A('i-star')}" alt=""></span>`;
    });
    return `<div class="scene-stack" role="img" aria-label="${a.name}">${html}</div>`;
  }

  // Small glossy vector icons for the lives and rewards screens (no image files needed).
  const grad = (id, a, b, c) => `<linearGradient id='${id}' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='${a}'/><stop offset='.55' stop-color='${b}'/><stop offset='1' stop-color='${c}'/></linearGradient>`;
  const HEART = "M32 57C12 43 4 33 4 21C4 12 11 5 19.5 5C25.5 5 29.5 8.5 32 13C34.5 8.5 38.5 5 44.5 5C53 5 60 12 60 21C60 33 52 43 32 57Z";
  const SVG = {
    heart: `<defs>${grad('g', '#ff6b75', '#e3192b', '#8f0b16')}</defs><path d='${HEART}' fill='url(#g)' stroke='#050505' stroke-width='4' stroke-linejoin='round'/><ellipse cx='19' cy='18' rx='8' ry='5' fill='#fff' opacity='.6' transform='rotate(-32 19 18)'/>`,
    heartInf: `<defs>${grad('g', '#ff6b75', '#e3192b', '#8f0b16')}</defs><path d='${HEART}' fill='url(#g)' stroke='#050505' stroke-width='4' stroke-linejoin='round'/><path d='M20 29c0-4 3-6 6-6 5 0 7 12 12 12 3 0 6-2 6-6s-3-6-6-6c-5 0-7 12-12 12-3 0-6-2-6-6z' fill='none' stroke='#fff' stroke-width='4.5' stroke-linecap='round'/>`,
    heartEmpty: `<path d='${HEART}' fill='#2c2c30' stroke='#050505' stroke-width='4' stroke-linejoin='round'/><ellipse cx='19' cy='18' rx='8' ry='5' fill='#fff' opacity='.15' transform='rotate(-32 19 18)'/>`,
    gift: `<defs>${grad('g', '#ff6b75', '#e3192b', '#8f0b16')}${grad('w', '#ffffff', '#e6e6ea', '#9a9aa0')}</defs><rect x='8' y='26' width='48' height='32' rx='5' fill='url(#g)' stroke='#050505' stroke-width='4'/><rect x='5' y='18' width='54' height='12' rx='4' fill='url(#g)' stroke='#050505' stroke-width='4'/><rect x='27' y='18' width='10' height='40' fill='url(#w)' stroke='#050505' stroke-width='3'/><path d='M32 18c-4-10-16-12-16-4 0 5 8 4 16 4zM32 18c4-10 16-12 16-4 0 5-8 4-16 4z' fill='url(#w)' stroke='#050505' stroke-width='3.5' stroke-linejoin='round'/>`,
    share: `<defs>${grad('g', '#ff6b75', '#e3192b', '#8f0b16')}</defs><circle cx='32' cy='32' r='27' fill='url(#g)' stroke='#050505' stroke-width='4'/><path d='M22 33l18-10M22 33l18 10' stroke='#fff' stroke-width='4'/><circle cx='21' cy='33' r='6' fill='#fff' stroke='#050505' stroke-width='2'/><circle cx='42' cy='22' r='6' fill='#fff' stroke='#050505' stroke-width='2'/><circle cx='42' cy='44' r='6' fill='#fff' stroke='#050505' stroke-width='2'/>`,
    clock: `<circle cx='32' cy='32' r='26' fill='#f2f2f2' stroke='#050505' stroke-width='4'/><path d='M32 16v17l11 7' stroke='#e3192b' stroke-width='5' stroke-linecap='round' fill='none'/>`,
  };
  const svgUrl = (k) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>${SVG[k]}</svg>`);

  const ICONS = { coin: 'i-coin', star: 'i-star', lock: 'i-lock', hammer: 'i-hammer', row: 'i-row', col: 'i-col', shuffle: 'i-shuffle', hand: 'i-hand', trophy: 'i-trophy' };
  const PORTRAIT = { static: 'static-boss' };

  root.RKArt = {
    TILE_NAMES, AREAS, scene, asset: A,
    sceneUrl: (key, off) => A('scene-' + key + (off ? '-off' : '')),
    // Optional art: only used once it exists in the bundle (tools/gemini-art.mjs makes it).
    has: (k) => !!(root.RK_ASSETS && root.RK_ASSETS[k]),
    levelUrl: (key) => A('level-' + key),
    tileUrl: (col) => A('t' + col),
    powerUrl: (pw) => A(pw === 'h' ? 'v' : pw),
    crownUrl: () => A('crown'),
    crateUrl: (hp) => A('c' + hp),
    tapeUrl: () => A('tape'),
    floorUrl: () => A('floor'),
    staticUrl: () => A('static'),
    handUrl: () => A('i-hand'),
    portraitUrl: (k) => A(PORTRAIT[k] || k),
    iconUrl: (k) => (SVG[k] ? svgUrl(k) : A(ICONS[k] || k)),
  };
})(typeof self !== 'undefined' ? self : this);
