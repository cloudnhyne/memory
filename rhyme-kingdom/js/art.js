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

  const ICONS = { coin: 'i-coin', star: 'i-star', lock: 'i-lock', hammer: 'i-hammer', row: 'i-row', col: 'i-col', shuffle: 'i-shuffle', hand: 'i-hand', trophy: 'i-trophy' };
  const PORTRAIT = { static: 'static-boss' };

  root.RKArt = {
    TILE_NAMES, AREAS, scene, asset: A,
    sceneUrl: (key, off) => A('scene-' + key + (off ? '-off' : '')),
    tileUrl: (col) => A('t' + col),
    powerUrl: (pw) => A(pw === 'h' ? 'v' : pw),
    crownUrl: () => A('crown'),
    crateUrl: (hp) => A('c' + hp),
    tapeUrl: () => A('tape'),
    floorUrl: () => A('floor'),
    staticUrl: () => A('static'),
    handUrl: () => A('i-hand'),
    portraitUrl: (k) => A(PORTRAIT[k] || k),
    iconUrl: (k) => A(ICONS[k] || k),
  };
})(typeof self !== 'undefined' ? self : this);
