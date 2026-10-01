/*
 * Rhyme Kingdom: artwork.
 * Everything is vector SVG generated in code (no external files), so the
 * game stays one self-contained page. Tiles and power-ups are rasterized
 * onto canvas sprites by the renderer; portraits and scenes are inlined.
 */
(function (root) {
  'use strict';

  const OL = '#1d0f33'; // outline ink
  let uid = 0;
  const id = (p) => `${p}${++uid}`;

  const svg = (body, vb = '0 0 100 100', w = 256, h = 256) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${w}" height="${h}">${body}</svg>`;
  const lin = (gid, stops, x2 = 0, y2 = 1) =>
    `<linearGradient id="${gid}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map((s) => `<stop offset="${s[0]}" stop-color="${s[1]}"/>`).join('')}</linearGradient>`;
  const rad = (gid, stops, cx = '38%', cy = '32%', r = '72%') =>
    `<radialGradient id="${gid}" cx="${cx}" cy="${cy}" r="${r}">${stops.map((s) => `<stop offset="${s[0]}" stop-color="${s[1]}"/>`).join('')}</radialGradient>`;
  const shadow = (cx = 50, cy = 91, rx = 30, ry = 5) =>
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#000" opacity=".22"/>`;
  const star = (cx, cy, R, r, n = 5, rot = -90) => {
    let d = '';
    for (let i = 0; i < n * 2; i++) {
      const a = ((rot + (i * 180) / n) * Math.PI) / 180;
      const rr = i % 2 ? r : R;
      d += `${i ? 'L' : 'M'}${(cx + rr * Math.cos(a)).toFixed(2)} ${(cy + rr * Math.sin(a)).toFixed(2)}`;
    }
    return d + 'Z';
  };

  // ------------------------------------------------------------------ tiles
  function mic() {
    const h = id('h'), b = id('b'), g = id('g'), cp = id('c');
    let mesh = '';
    for (let k = -40; k <= 100; k += 7) mesh += `M${k} 0 L${k + 70} 70 M${k + 70} 0 L${k} 70 `;
    return svg(`<defs>${rad(h, [[0, '#ff9b9b'], [0.45, '#ff3347'], [1, '#9e0020']])}
      ${lin(b, [[0, '#d8203d'], [0.45, '#ff4a5f'], [1, '#7d0a1f']], 1, 0)}
      ${lin(g, [[0, '#fff0a6'], [0.5, '#ffbe1a'], [1, '#c77800']], 1, 0)}
      <clipPath id="${cp}"><circle cx="50" cy="30" r="19"/></clipPath></defs>
      ${shadow(52, 92, 22, 4)}
      <g transform="rotate(-26 50 56)">
        <path d="M39.5 52 L60.5 52 L56 92 Q50 97 44 92 Z" fill="url(#${b})" stroke="${OL}" stroke-width="4" stroke-linejoin="round"/>
        <path d="M45 58 L47 88" stroke="#ffd0d6" stroke-width="3" stroke-linecap="round" opacity=".55"/>
        <rect x="36" y="45" width="28" height="11" rx="4" fill="url(#${g})" stroke="${OL}" stroke-width="4"/>
        <circle cx="50" cy="30" r="21" fill="url(#${h})" stroke="${OL}" stroke-width="4"/>
        <g clip-path="url(#${cp})"><path d="${mesh}" stroke="#6d0014" stroke-width="1.7" opacity=".5" fill="none" transform="translate(0 -5)"/></g>
        <ellipse cx="42" cy="21" rx="8" ry="4.5" fill="#fff" opacity=".8" transform="rotate(-35 42 21)"/>
      </g>`);
  }

  function sneaker() {
    const o = id('o'), t = id('t');
    return svg(`<defs>${lin(o, [[0, '#ffb35c'], [0.5, '#ff7a1a'], [1, '#c94f00']])}${lin(t, [[0, '#fffaf2'], [1, '#e9d6c0']])}</defs>
      ${shadow(52, 90, 40, 5)}
      <path d="M14 70 L14 30 Q14 19 25 19 L45 19 Q52 19 53 27 L55 45 Q73 46 85 55 Q94 61 92 70 Z" fill="url(#${o})" stroke="${OL}" stroke-width="4" stroke-linejoin="round"/>
      <path d="M57 48 Q74 50 84 57 Q90 61 90 66 L66 66 Q58 60 57 48 Z" fill="#ffe0bd" opacity=".9"/>
      <path d="M14 30 Q30 35 46 26" stroke="${OL}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <g stroke="${OL}" stroke-width="6.5" stroke-linecap="round"><path d="M44 33 L57 37"/><path d="M45 41 L59 44"/></g>
      <g stroke="#fff" stroke-width="3" stroke-linecap="round"><path d="M44 33 L57 37"/><path d="M45 41 L59 44"/></g>
      <circle cx="30" cy="50" r="9.5" fill="#fff" stroke="${OL}" stroke-width="3"/>
      <path d="${star(30, 50.5, 6.5, 2.8)}" fill="#ff7a1a"/>
      <path d="M8 69 Q8 65 13 65 L93 65 Q98 65 98 70 L98 75 Q98 85 88 85 L17 85 Q8 85 8 76 Z" fill="url(#${t})" stroke="${OL}" stroke-width="4" stroke-linejoin="round"/>
      <path d="M10 75.5 L97 75.5" stroke="#d7bfa3" stroke-width="3"/>
      <path d="M20 26 Q22 22 30 22" stroke="#fff" stroke-width="3.5" stroke-linecap="round" fill="none" opacity=".7"/>`);
  }

  function chain() {
    const g = id('g'), m = id('m');
    const path = 'M25 10 Q19 50 50 52 Q81 50 75 10';
    return svg(`<defs>${lin(g, [[0, '#fff3a3'], [0.5, '#ffc21a'], [1, '#cf8700']], 1, 1)}${rad(m, [[0, '#fff6c2'], [0.5, '#ffcc33'], [1, '#c98100']])}</defs>
      ${shadow(50, 92, 26, 4)}
      <path d="${path}" fill="none" stroke="${OL}" stroke-width="13" stroke-linecap="round"/>
      <path d="${path}" fill="none" stroke="url(#${g})" stroke-width="7" stroke-linecap="round"/>
      <path d="${path}" fill="none" stroke="#a86a00" stroke-width="7" stroke-dasharray="2.5 4.5"/>
      <circle cx="50" cy="64" r="26" fill="url(#${m})" stroke="${OL}" stroke-width="4"/>
      <circle cx="50" cy="64" r="18.5" fill="none" stroke="#c98100" stroke-width="3"/>
      <path d="${star(50, 65, 13, 5.6)}" fill="#fff6c9" stroke="#b07000" stroke-width="2.4" stroke-linejoin="round"/>
      <ellipse cx="39" cy="52" rx="7" ry="4" fill="#fff" opacity=".75" transform="rotate(-30 39 52)"/>`);
  }

  function cap() {
    const g = id('g');
    return svg(`<defs>${rad(g, [[0, '#8dffb4'], [0.45, '#25c75a'], [1, '#0d7a32']], '35%', '28%', '80%')}</defs>
      ${shadow(52, 89, 40, 5)}
      <path d="M44 66 Q70 55 95 64 Q98 73 87 78 Q64 83 42 76 Z" fill="#109140" stroke="${OL}" stroke-width="4" stroke-linejoin="round"/>
      <path d="M50 70 Q70 63 90 67" stroke="#0a5c27" stroke-width="2.5" fill="none"/>
      <path d="M7 67 Q5 25 46 21 Q83 21 84 61 Q84 68 77 69 L14 73 Q7 73 7 67 Z" fill="url(#${g})" stroke="${OL}" stroke-width="4" stroke-linejoin="round"/>
      <path d="M10 64 Q45 59 81 62" stroke="#0a5c27" stroke-width="3" fill="none"/>
      <path d="M46 22 Q39 43 41 63" stroke="#0a5c27" stroke-width="2.5" fill="none"/>
      <path d="M46 22 Q63 40 67 62" stroke="#0a5c27" stroke-width="2.5" fill="none"/>
      <ellipse cx="46" cy="22" rx="6.5" ry="3.2" fill="#0d7a32" stroke="${OL}" stroke-width="3"/>
      <path d="M44 51 L45 40 L50 45 L54 37 L58 45 L63 40 L64 51 Z" fill="#ffd23f" stroke="${OL}" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M17 52 Q17 33 35 28" stroke="#c9ffda" stroke-width="4" stroke-linecap="round" fill="none" opacity=".75"/>`);
  }

  function headphones() {
    const g = id('g');
    const band = 'M21 60 Q21 13 50 13 Q79 13 79 60';
    return svg(`<defs>${lin(g, [[0, '#7fd3ff'], [0.5, '#2e8cff'], [1, '#1446b8']], 1, 1)}</defs>
      ${shadow(50, 92, 36, 4)}
      <path d="${band}" fill="none" stroke="${OL}" stroke-width="14" stroke-linecap="round"/>
      <path d="${band}" fill="none" stroke="#2e8cff" stroke-width="7" stroke-linecap="round"/>
      <path d="M27 38 Q30 21 45 18" stroke="#c4ecff" stroke-width="3" stroke-linecap="round" fill="none"/>
      <rect x="7" y="46" width="27" height="40" rx="11" fill="url(#${g})" stroke="${OL}" stroke-width="4"/>
      <rect x="66" y="46" width="27" height="40" rx="11" fill="url(#${g})" stroke="${OL}" stroke-width="4"/>
      <rect x="28" y="52" width="9" height="28" rx="4.5" fill="#123a8a" stroke="${OL}" stroke-width="3"/>
      <rect x="63" y="52" width="9" height="28" rx="4.5" fill="#123a8a" stroke="${OL}" stroke-width="3"/>
      <circle cx="20.5" cy="66" r="6.5" fill="#c4ecff" stroke="${OL}" stroke-width="2.6"/>
      <circle cx="79.5" cy="66" r="6.5" fill="#c4ecff" stroke="${OL}" stroke-width="2.6"/>
      <path d="M12 56 Q12 50 17 49" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none" opacity=".8"/>`);
  }

  function cassette() {
    const g = id('g');
    return svg(`<defs>${lin(g, [[0, '#c48bff'], [0.5, '#9446f0'], [1, '#5e1fb0']], 1, 1)}</defs>
      ${shadow(50, 90, 40, 5)}
      <rect x="6" y="19" width="88" height="64" rx="9" fill="url(#${g})" stroke="${OL}" stroke-width="4"/>
      <rect x="14" y="26" width="72" height="31" rx="4" fill="#f8f0ff" stroke="${OL}" stroke-width="3"/>
      <rect x="15.5" y="27.5" width="69" height="7" fill="#ff4f9a"/>
      <rect x="26" y="37.5" width="48" height="15" rx="7.5" fill="#2b1446" stroke="${OL}" stroke-width="2.5"/>
      <circle cx="37" cy="45" r="5.5" fill="#fff" stroke="${OL}" stroke-width="2"/>
      <circle cx="63" cy="45" r="5.5" fill="#fff" stroke="${OL}" stroke-width="2"/>
      <path d="M44 45 L56 45" stroke="#8a5a2b" stroke-width="5"/>
      <path d="M27 83 L33 66 L67 66 L73 83" fill="#7a31d0" stroke="${OL}" stroke-width="4" stroke-linejoin="round"/>
      <circle cx="41" cy="74" r="2.6" fill="${OL}"/><circle cx="59" cy="74" r="2.6" fill="${OL}"/>
      <path d="M12 30 Q12 23 18 23" stroke="#e8d4ff" stroke-width="3" stroke-linecap="round" fill="none" opacity=".8"/>`);
  }

  // ------------------------------------------------------------- power-ups
  function sprayCan(dir) {
    const s = id('s'), l = id('l'), cp = id('c');
    const rot = dir === 'h' ? 'rotate(90 50 50)' : '';
    const arrows = dir === 'h'
      ? `<path d="M4 50 L14 41 L14 59 Z M96 50 L86 41 L86 59 Z" fill="#fff" stroke="${OL}" stroke-width="3" stroke-linejoin="round"/>`
      : `<path d="M50 3 L41 13 L59 13 Z M50 97 L41 87 L59 87 Z" fill="#fff" stroke="${OL}" stroke-width="3" stroke-linejoin="round"/>`;
    return svg(`<defs>${lin(s, [[0, '#8b93b3'], [0.35, '#f2f4ff'], [0.6, '#c3c9e0'], [1, '#6b7290']], 1, 0)}
      ${lin(l, [[0, '#ff3b8d'], [0.5, '#ffb100'], [1, '#22e3ff']], 1, 1)}
      <clipPath id="${cp}"><rect x="32" y="32" width="36" height="56" rx="8"/></clipPath></defs>
      <g transform="${rot}">
        <circle cx="50" cy="52" r="42" fill="#ff3b8d" opacity=".18"/>
        <rect x="32" y="32" width="36" height="56" rx="8" fill="url(#${s})" stroke="${OL}" stroke-width="4"/>
        <g clip-path="url(#${cp})"><rect x="30" y="47" width="40" height="27" fill="url(#${l})"/>
          <path d="M34 66 Q44 52 54 62 Q60 68 68 56" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round"/></g>
        <rect x="32" y="32" width="36" height="56" rx="8" fill="none" stroke="${OL}" stroke-width="4"/>
        <path d="M34 34 Q50 20 66 34 Z" fill="#d4d8ea" stroke="${OL}" stroke-width="4" stroke-linejoin="round"/>
        <rect x="43" y="14" width="14" height="12" rx="3" fill="#ff3b8d" stroke="${OL}" stroke-width="4"/>
        <circle cx="62" cy="13" r="4" fill="#ff8ccf"/><circle cx="70" cy="8" r="3" fill="#ffc531"/><circle cx="71" cy="17" r="2.5" fill="#22e3ff"/>
        <path d="M38 40 L38 82" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".75"/>
      </g>${arrows}`);
  }

  function boombox() {
    const b = id('b'), sp = id('s');
    const speaker = (cx) => `<circle cx="${cx}" cy="62" r="16.5" fill="url(#${sp})" stroke="${OL}" stroke-width="4"/>
      <circle cx="${cx}" cy="62" r="10" fill="#2a2140" stroke="${OL}" stroke-width="2.5"/>
      <circle cx="${cx}" cy="62" r="4.2" fill="#ff3b8d"/>
      <circle cx="${cx - 4}" cy="57" r="2" fill="#fff" opacity=".6"/>`;
    return svg(`<defs>${lin(b, [[0, '#4d3a78'], [0.5, '#2d1f4c'], [1, '#170e2a']])}${rad(sp, [[0, '#ffffff'], [0.6, '#c9cfe6'], [1, '#8a92b5']])}</defs>
      <circle cx="50" cy="56" r="46" fill="#ffc531" opacity=".2"/>
      <path d="M27 31 L27 18 Q27 11 34 11 L66 11 Q73 11 73 18 L73 31" fill="none" stroke="${OL}" stroke-width="11" stroke-linejoin="round"/>
      <path d="M27 31 L27 18 Q27 11 34 11 L66 11 Q73 11 73 18 L73 31" fill="none" stroke="#c7cde3" stroke-width="5" stroke-linejoin="round"/>
      <rect x="4" y="28" width="92" height="58" rx="11" fill="url(#${b})" stroke="${OL}" stroke-width="4"/>
      <rect x="9" y="33" width="82" height="8" rx="3" fill="#ffc531" stroke="${OL}" stroke-width="2"/>
      <rect x="13" y="35" width="5" height="4" rx="1" fill="${OL}"/><rect x="21" y="35" width="5" height="4" rx="1" fill="${OL}"/><rect x="74" y="35" width="13" height="4" rx="1" fill="#ff3b8d"/>
      ${speaker(26)}${speaker(74)}
      <rect x="43.5" y="49" width="13" height="25" rx="2.5" fill="#22e3ff" stroke="${OL}" stroke-width="2.6"/>
      <path d="M46 55 L54 55 M46 61 L54 61 M46 67 L54 67" stroke="${OL}" stroke-width="1.6"/>`);
  }

  function flyer() {
    return svg(`<circle cx="50" cy="50" r="44" fill="#22e3ff" opacity=".18"/>
      <path d="M2 64 L16 62 M4 74 L20 70 M10 83 L24 77" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".85"/>
      <path d="M8 52 L94 14 L64 88 L49 62 Z" fill="#fffaf0" stroke="${OL}" stroke-width="4" stroke-linejoin="round"/>
      <path d="M49 62 L45 84 L60 68" fill="#ffc1dc" stroke="${OL}" stroke-width="3.5" stroke-linejoin="round"/>
      <path d="M49 62 L94 14" stroke="${OL}" stroke-width="3"/>
      <path d="M26 45 L76 23" stroke="#ff3b8d" stroke-width="5" stroke-linecap="round"/>
      <path d="M37 51 L82 27" stroke="#22e3ff" stroke-width="4" stroke-linecap="round"/>
      <path d="M58 66 L70 41" stroke="#ffc531" stroke-width="4" stroke-linecap="round"/>`);
  }

  function platinum() {
    const v = id('v'), w = id('w'), l = id('l');
    let grooves = '';
    for (let r = 20; r <= 38; r += 3.6) grooves += `<circle cx="50" cy="50" r="${r}" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="1"/>`;
    return svg(`<defs>${rad(v, [[0, '#ffffff'], [0.5, '#d9def2'], [1, '#7f88ad']], '40%', '35%', '75%')}
      ${lin(w, [[0, '#ff3b8d'], [0.25, '#ffc531'], [0.5, '#3bffb0'], [0.75, '#22c8ff'], [1, '#b05cff']], 1, 1)}
      ${rad(l, [[0, '#fff2a8'], [0.6, '#ffc531'], [1, '#d48a00']])}</defs>
      <circle cx="50" cy="50" r="49" fill="#fff" opacity=".22"/>
      <circle cx="50" cy="50" r="43" fill="url(#${v})" stroke="${OL}" stroke-width="4"/>
      <path d="M50 50 L18 20 A43 43 0 0 1 40 8 Z" fill="url(#${w})" opacity=".55"/>
      <path d="M50 50 L82 80 A43 43 0 0 1 60 92 Z" fill="url(#${w})" opacity=".55"/>
      ${grooves}
      <circle cx="50" cy="50" r="15" fill="url(#${l})" stroke="${OL}" stroke-width="3.5"/>
      <path d="${star(50, 50.6, 9, 3.8)}" fill="#fff" stroke="#c07a00" stroke-width="1.6"/>
      <circle cx="50" cy="50" r="2.2" fill="${OL}"/>`);
  }

  // ------------------------------------------------------------- obstacles
  function crown(size = 1) {
    const g = id('g'), d = id('d');
    return svg(`<defs>${lin(g, [[0, '#fff3a3'], [0.45, '#ffc21a'], [1, '#c98100']])}${lin(d, [[0, '#ffb300'], [1, '#a86400']])}</defs>
      <circle cx="50" cy="52" r="44" fill="#ffd84a" opacity="${0.22 * size}"/>
      ${shadow(50, 91, 34, 4)}
      <path d="M13 74 L8 30 L31 49 L50 17 L69 49 L92 30 L87 74 Z" fill="url(#${g})" stroke="${OL}" stroke-width="4" stroke-linejoin="round"/>
      <path d="M50 26 L50 64 M24 46 L30 66 M76 46 L70 66" stroke="#fff" stroke-opacity=".45" stroke-width="3" stroke-linecap="round"/>
      <rect x="11" y="69" width="78" height="15" rx="4" fill="url(#${d})" stroke="${OL}" stroke-width="4"/>
      <circle cx="8" cy="28" r="5.5" fill="#ff3b8d" stroke="${OL}" stroke-width="3"/>
      <circle cx="50" cy="15" r="6.5" fill="#22e3ff" stroke="${OL}" stroke-width="3"/>
      <circle cx="92" cy="28" r="5.5" fill="#ff3b8d" stroke="${OL}" stroke-width="3"/>
      <circle cx="30" cy="76.5" r="4" fill="#22e3ff" stroke="${OL}" stroke-width="2"/>
      <circle cx="50" cy="76.5" r="5" fill="#ff3b8d" stroke="${OL}" stroke-width="2"/>
      <circle cx="70" cy="76.5" r="4" fill="#3bff8a" stroke="${OL}" stroke-width="2"/>`);
  }

  function crate(hp) {
    if (hp === 1) {
      const c = id('c');
      return svg(`<defs>${lin(c, [[0, '#e8b27a'], [1, '#a9672c']])}</defs>
        <rect x="18" y="11" width="22" height="24" rx="2" fill="#ff3b8d" stroke="${OL}" stroke-width="3" transform="rotate(-9 29 23)"/>
        <circle cx="29" cy="23" r="6" fill="#2a1446" transform="rotate(-9 29 23)"/>
        <rect x="39" y="7" width="23" height="25" rx="2" fill="#22e3ff" stroke="${OL}" stroke-width="3"/>
        <circle cx="50.5" cy="19.5" r="6" fill="#2a1446"/>
        <rect x="61" y="11" width="22" height="24" rx="2" fill="#ffc531" stroke="${OL}" stroke-width="3" transform="rotate(9 72 23)"/>
        <rect x="7" y="29" width="86" height="64" rx="6" fill="url(#${c})" stroke="${OL}" stroke-width="4"/>
        <path d="M7 42 L93 42" stroke="${OL}" stroke-width="3"/>
        <path d="M44 29 L44 42 M56 29 L56 42" stroke="#c98f55" stroke-width="3"/>
        <rect x="28" y="55" width="44" height="22" rx="3" fill="#fff5e3" stroke="${OL}" stroke-width="3"/>
        <circle cx="40" cy="66" r="6.5" fill="#2a1446"/><circle cx="40" cy="66" r="2" fill="#ffc531"/>
        <path d="M51 61 L66 61 M51 66 L63 66 M51 71 L66 71" stroke="#b07a46" stroke-width="2.2" stroke-linecap="round"/>`);
    }
    if (hp === 2) {
      const c = id('c');
      let holes = '';
      for (let y = 0; y < 3; y++) for (let x = 0; x < 4; x++) holes += `<rect x="${15 + x * 19}" y="${41 + y * 15}" width="13" height="9" rx="3" fill="#6b0e1f"/>`;
      return svg(`<defs>${lin(c, [[0, '#ff5d72'], [1, '#b0192f']])}</defs>
        <rect x="16" y="9" width="20" height="22" rx="2" fill="#22e3ff" stroke="${OL}" stroke-width="3" transform="rotate(-6 26 20)"/>
        <rect x="38" y="6" width="22" height="24" rx="2" fill="#ffc531" stroke="${OL}" stroke-width="3"/>
        <rect x="62" y="9" width="20" height="22" rx="2" fill="#9b5cff" stroke="${OL}" stroke-width="3" transform="rotate(7 72 20)"/>
        <rect x="7" y="26" width="86" height="67" rx="7" fill="url(#${c})" stroke="${OL}" stroke-width="4"/>
        <rect x="5" y="23" width="90" height="11" rx="4" fill="#ff7a8b" stroke="${OL}" stroke-width="4"/>
        ${holes}
        <rect x="35" y="27" width="30" height="5" rx="2" fill="#6b0e1f"/>`);
    }
    const c = id('c');
    return svg(`<defs>${lin(c, [[0, '#5ea3ff'], [1, '#1b4fb3']])}</defs>
      <rect x="7" y="12" width="86" height="81" rx="8" fill="url(#${c})" stroke="${OL}" stroke-width="4"/>
      <rect x="15" y="20" width="70" height="65" rx="4" fill="#163f94" opacity=".55"/>
      <path d="M7 36 L93 36 M7 69 L93 69" stroke="#cfd6ea" stroke-width="9"/>
      <path d="M7 36 L93 36 M7 69 L93 69" stroke="${OL}" stroke-width="2" stroke-dasharray="0 9 86 1" />
      <path d="M7 31.5 L93 31.5 M7 40.5 L93 40.5 M7 64.5 L93 64.5 M7 73.5 L93 73.5" stroke="${OL}" stroke-width="2"/>
      <circle cx="16" cy="36" r="2.3" fill="${OL}"/><circle cx="84" cy="36" r="2.3" fill="${OL}"/>
      <circle cx="16" cy="69" r="2.3" fill="${OL}"/><circle cx="84" cy="69" r="2.3" fill="${OL}"/>
      <path d="M41 50 Q41 39 50 39 Q59 39 59 50" fill="none" stroke="${OL}" stroke-width="8"/>
      <path d="M41 50 Q41 39 50 39 Q59 39 59 50" fill="none" stroke="#dfe4f5" stroke-width="4"/>
      <rect x="36" y="48" width="28" height="22" rx="4" fill="#ffc531" stroke="${OL}" stroke-width="3.5"/>
      <circle cx="50" cy="57" r="3.5" fill="${OL}"/><path d="M50 58 L50 64" stroke="${OL}" stroke-width="3" stroke-linecap="round"/>`);
  }

  function tape() {
    const strip = (rot, fill) => `<g transform="rotate(${rot} 50 50)">
      <path d="M-4 39 L3 42 L-2 46 L4 50 L-2 54 L3 58 L-4 61 L104 61 L97 58 L102 54 L96 50 L102 46 L97 42 L104 39 Z" fill="${fill}" stroke="${OL}" stroke-width="3" stroke-linejoin="round" opacity=".96"/>
      <path d="M8 45 L92 45 M8 55 L92 55" stroke="#ffffff" stroke-opacity=".35" stroke-width="1.6"/>
      <path d="M8 50 L92 50" stroke="#8d86a6" stroke-opacity=".4" stroke-width="1.2" stroke-dasharray="3 3"/></g>`;
    return svg(`${strip(45, '#b9b3cc')}${strip(-45, '#d6d1e6')}`, '-6 -6 112 112');
  }

  // --------------------------------------------------------------- bosses
  function staticNoise(seed, x, y, w, h, cell, colors) {
    let s = seed;
    const r = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    let out = '';
    for (let yy = y; yy < y + h; yy += cell) {
      for (let xx = x; xx < x + w; xx += cell) {
        if (r() < 0.55) out += `<rect x="${xx}" y="${yy}" width="${cell}" height="${cell}" fill="${colors[Math.floor(r() * colors.length)]}"/>`;
      }
    }
    return out;
  }

  function bossKingStatic() {
    const b = id('b'), sc = id('s'), cp = id('c'), g = id('g'), cape = id('k');
    return svg(`<defs>${lin(b, [[0, '#8a7ab8'], [1, '#3d2f66']])}${rad(sc, [[0, '#b7a6e6'], [1, '#3c2b6b']], '50%', '45%', '70%')}
      ${lin(g, [[0, '#fff3a3'], [0.5, '#ffc21a'], [1, '#c98100']])}${lin(cape, [[0, '#9b1dff'], [1, '#4b0a8a']])}
      <clipPath id="${cp}"><rect x="62" y="110" width="176" height="128" rx="26"/></clipPath></defs>
      <path d="M40 300 Q50 150 150 160 Q250 150 260 300 Z" fill="url(#${cape})" stroke="${OL}" stroke-width="7"/>
      <path d="M118 74 L80 18" stroke="${OL}" stroke-width="9" stroke-linecap="round"/><path d="M118 74 L80 18" stroke="#c7cde3" stroke-width="4" stroke-linecap="round"/>
      <path d="M182 74 L222 22" stroke="${OL}" stroke-width="9" stroke-linecap="round"/><path d="M182 74 L222 22" stroke="#c7cde3" stroke-width="4" stroke-linecap="round"/>
      <circle cx="80" cy="18" r="9" fill="#ff3b5c" stroke="${OL}" stroke-width="5"/><circle cx="222" cy="22" r="9" fill="#ff3b5c" stroke="${OL}" stroke-width="5"/>
      <rect x="38" y="86" width="224" height="178" rx="34" fill="url(#${b})" stroke="${OL}" stroke-width="8"/>
      <rect x="62" y="110" width="176" height="128" rx="26" fill="url(#${sc})" stroke="${OL}" stroke-width="6"/>
      <g clip-path="url(#${cp})" opacity=".85">${staticNoise(7, 62, 110, 176, 128, 8, ['#ffffff', '#d9d0ff', '#6e5aa8', '#22e3ff', '#ff3b8d'])}</g>
      <path d="M84 150 L128 166 L84 178 Z" fill="#ff2a4f" stroke="${OL}" stroke-width="6" stroke-linejoin="round"/>
      <path d="M216 150 L172 166 L216 178 Z" fill="#ff2a4f" stroke="${OL}" stroke-width="6" stroke-linejoin="round"/>
      <path d="M100 210 L118 198 L136 212 L150 198 L164 212 L182 198 L200 210" fill="none" stroke="${OL}" stroke-width="9" stroke-linejoin="round" stroke-linecap="round"/>
      <path d="M100 210 L118 198 L136 212 L150 198 L164 212 L182 198 L200 210" fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>
      <rect x="244" y="132" width="10" height="22" rx="4" fill="#ffc531" stroke="${OL}" stroke-width="4"/>
      <rect x="244" y="168" width="10" height="22" rx="4" fill="#22e3ff" stroke="${OL}" stroke-width="4"/>
      <path d="M92 92 L84 46 L118 70 L150 30 L182 70 L216 46 L208 92 Z" fill="url(#${g})" stroke="${OL}" stroke-width="7" stroke-linejoin="round"/>
      <circle cx="150" cy="70" r="9" fill="#9b1dff" stroke="${OL}" stroke-width="4"/>
      <circle cx="112" cy="80" r="6" fill="#ff3b5c" stroke="${OL}" stroke-width="3"/><circle cx="188" cy="80" r="6" fill="#ff3b5c" stroke="${OL}" stroke-width="3"/>`, '0 0 300 300');
  }

  function bossBuzzkill() {
    const w = id('w'), sp = id('s'), hat = id('h');
    return svg(`<defs>${lin(w, [[0, '#6f6a86'], [1, '#2f2b44']])}${rad(sp, [[0, '#5a5470'], [0.7, '#2a2638'], [1, '#14111f']], '45%', '40%', '70%')}${lin(hat, [[0, '#3a3550'], [1, '#14111f']])}</defs>
      <rect x="44" y="70" width="212" height="214" rx="26" fill="url(#${w})" stroke="${OL}" stroke-width="8"/>
      <rect x="58" y="84" width="184" height="186" rx="16" fill="none" stroke="#8e88a8" stroke-width="3" stroke-dasharray="6 7"/>
      <circle cx="150" cy="198" r="64" fill="#b9b3cc" stroke="${OL}" stroke-width="7"/>
      <circle cx="150" cy="198" r="50" fill="url(#${sp})" stroke="${OL}" stroke-width="5"/>
      <path d="M112 222 Q150 196 188 222" fill="none" stroke="#ff6a3d" stroke-width="9" stroke-linecap="round"/>
      <circle cx="108" cy="122" r="25" fill="#e8e4f4" stroke="${OL}" stroke-width="6"/>
      <circle cx="108" cy="124" r="11" fill="${OL}"/><circle cx="104" cy="119" r="4" fill="#fff"/>
      <circle cx="192" cy="122" r="25" fill="#e8e4f4" stroke="${OL}" stroke-width="6"/>
      <circle cx="192" cy="124" r="11" fill="${OL}"/><circle cx="188" cy="119" r="4" fill="#fff"/>
      <circle cx="192" cy="122" r="31" fill="none" stroke="#ffc531" stroke-width="5"/>
      <path d="M222 134 Q236 170 228 206" fill="none" stroke="#ffc531" stroke-width="3"/>
      <path d="M78 96 L134 110 M222 96 L166 110" stroke="${OL}" stroke-width="9" stroke-linecap="round"/>
      <path d="M150 160 Q118 146 96 166 Q116 160 130 168 Q140 172 150 166 Q160 172 170 168 Q184 160 204 166 Q182 146 150 160 Z" fill="#3a2c22" stroke="${OL}" stroke-width="4" stroke-linejoin="round"/>
      <rect x="86" y="54" width="128" height="22" rx="8" fill="url(#${hat})" stroke="${OL}" stroke-width="7"/>
      <rect x="106" y="2" width="88" height="60" rx="8" fill="url(#${hat})" stroke="${OL}" stroke-width="7"/>
      <rect x="106" y="40" width="88" height="12" fill="#ff6a3d" stroke="${OL}" stroke-width="4"/>`, '0 0 300 300');
  }

  function bossLipSync() {
    const b = id('b'), lp = id('l'), t = id('t');
    const reel = (cx) => `<circle cx="${cx}" cy="150" r="30" fill="#fff" stroke="${OL}" stroke-width="7"/>
      <circle cx="${cx}" cy="152" r="14" fill="${OL}"/><circle cx="${cx - 5}" cy="146" r="5" fill="#fff"/>
      <path d="M${cx - 32} 128 L${cx - 40} 116 M${cx - 18} 120 L${cx - 22} 106 M${cx} 118 L${cx} 104" stroke="${OL}" stroke-width="6" stroke-linecap="round"/>`;
    return svg(`<defs>${lin(b, [[0, '#ff7ac8'], [1, '#b51f86']])}${lin(lp, [[0, '#ff5a8a'], [1, '#c4004f']])}${lin(t, [[0, '#fff3a3'], [0.5, '#ffc21a'], [1, '#c98100']])}</defs>
      <path d="M40 120 Q8 160 30 210 Q46 250 20 290 M262 120 Q296 170 270 216 Q252 252 282 292" fill="none" stroke="#5a3418" stroke-width="12" stroke-linecap="round"/>
      <path d="M40 120 Q8 160 30 210 Q46 250 20 290 M262 120 Q296 170 270 216 Q252 252 282 292" fill="none" stroke="#9a5a2c" stroke-width="6" stroke-linecap="round"/>
      <rect x="30" y="80" width="240" height="176" rx="22" fill="url(#${b})" stroke="${OL}" stroke-width="8"/>
      <rect x="52" y="100" width="196" height="100" rx="12" fill="#fff4fb" stroke="${OL}" stroke-width="6"/>
      <rect x="55" y="103" width="190" height="18" fill="#22e3ff"/>
      ${reel(104)}${reel(196)}
      <path d="M96 230 L106 210 L194 210 L204 230" fill="#a3157a" stroke="${OL}" stroke-width="6" stroke-linejoin="round"/>
      <path d="M110 186 Q130 172 150 182 Q170 172 190 186 Q170 210 150 206 Q130 210 110 186 Z" fill="url(#${lp})" stroke="${OL}" stroke-width="6" stroke-linejoin="round"/>
      <path d="M116 187 Q150 194 184 187" stroke="${OL}" stroke-width="4" fill="none"/>
      <path d="M86 84 L92 44 L120 66 L150 30 L180 66 L208 44 L214 84 Z" fill="url(#${t})" stroke="${OL}" stroke-width="7" stroke-linejoin="round"/>
      <circle cx="150" cy="62" r="9" fill="#22e3ff" stroke="${OL}" stroke-width="4"/>`, '0 0 300 300');
  }

  // ------------------------------------------------------------ characters
  // Head-and-shoulders portraits on a 200x200 canvas.
  function face(o) {
    const skin = o.skin, shade = o.shade;
    const eyes = o.eyes || 'open';
    const eye = (cx) => eyes === 'closed'
      ? `<path d="M${cx - 9} 101 Q${cx} 108 ${cx + 9} 101" fill="none" stroke="${OL}" stroke-width="4" stroke-linecap="round"/>`
      : `<ellipse cx="${cx}" cy="101" rx="9" ry="${o.eyeRy || 10}" fill="#fff" stroke="${OL}" stroke-width="3"/>
         <circle cx="${cx + (o.look || 1)}" cy="102" r="5.6" fill="${o.iris || '#3a1f12'}"/><circle cx="${cx + (o.look || 1)}" cy="102" r="2.8" fill="${OL}"/>
         <circle cx="${cx + (o.look || 1) - 2}" cy="99.5" r="1.9" fill="#fff"/>`;
    const lashes = o.lashes ? `<path d="M68 93 L62 88 M73 91 L69 85 M132 93 L138 88 M127 91 L131 85" stroke="${OL}" stroke-width="3" stroke-linecap="round"/>` : '';
    const brows = o.brows || `<path d="M64 86 Q76 79 88 85" stroke="${OL}" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M112 85 Q124 79 136 86" stroke="${OL}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
    const mouth = o.mouth || `<path d="M84 132 Q100 146 116 132 Q100 138 84 132 Z" fill="#fff" stroke="${OL}" stroke-width="3.5" stroke-linejoin="round"/>`;
    return `
      <path d="M86 140 L86 168 Q100 176 114 168 L114 140 Z" fill="${shade}" stroke="${OL}" stroke-width="4"/>
      <ellipse cx="56" cy="106" rx="8" ry="12" fill="${skin}" stroke="${OL}" stroke-width="4"/>
      <ellipse cx="144" cy="106" rx="8" ry="12" fill="${skin}" stroke="${OL}" stroke-width="4"/>
      <path d="M58 98 Q58 54 100 54 Q142 54 142 98 Q142 150 100 154 Q58 150 58 98 Z" fill="${skin}" stroke="${OL}" stroke-width="4"/>
      <path d="M134 110 Q132 140 104 150 Q130 146 138 116 Z" fill="${shade}" opacity=".45"/>
      <ellipse cx="72" cy="122" rx="8" ry="5" fill="#ff6b8b" opacity="${o.blush == null ? 0.28 : o.blush}"/>
      <ellipse cx="128" cy="122" rx="8" ry="5" fill="#ff6b8b" opacity="${o.blush == null ? 0.28 : o.blush}"/>
      ${eye(76)}${eye(124)}${lashes}${brows}
      <path d="M96 108 Q92 120 98 122 Q102 124 106 121" fill="none" stroke="${shade}" stroke-width="4" stroke-linecap="round"/>
      ${mouth}`;
  }

  function kingFlow() {
    const j = id('j'), g = id('g');
    return svg(`<defs>${lin(j, [[0, '#7b2cff'], [1, '#3d0f8c']])}${lin(g, [[0, '#fff3a3'], [0.5, '#ffc21a'], [1, '#c98100']])}</defs>
      <path d="M14 200 Q20 160 64 152 L136 152 Q180 160 186 200 Z" fill="url(#${j})" stroke="${OL}" stroke-width="5"/>
      <path d="M58 156 Q70 186 100 192 Q130 186 142 156 Q122 176 100 176 Q78 176 58 156 Z" fill="#fff" stroke="${OL}" stroke-width="4"/>
      <circle cx="76" cy="170" r="2.4" fill="${OL}"/><circle cx="92" cy="182" r="2.4" fill="${OL}"/><circle cx="110" cy="182" r="2.4" fill="${OL}"/><circle cx="126" cy="170" r="2.4" fill="${OL}"/>
      ${face({ skin: '#7a4a2a', shade: '#5a321b', blush: 0.15,
        brows: `<path d="M63 87 Q76 78 89 86" stroke="${OL}" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M111 86 Q124 78 137 87" stroke="${OL}" stroke-width="6" fill="none" stroke-linecap="round"/>`,
        mouth: `<path d="M86 131 Q100 143 114 131" fill="#fff" stroke="${OL}" stroke-width="3.5"/>` })}
      <path d="M58 100 Q60 150 100 156 Q140 150 142 100 L136 100 Q134 136 118 140 Q100 128 82 140 Q66 136 64 100 Z" fill="#1d1210" stroke="${OL}" stroke-width="3"/>
      <path d="M82 128 Q100 120 118 128 Q100 125 82 128 Z" fill="#1d1210" stroke="${OL}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M86 132 Q100 142 114 132 Q100 136 86 132 Z" fill="#fff" stroke="${OL}" stroke-width="3"/>
      <path d="M60 88 Q58 56 100 54 Q142 56 140 88 Q132 70 100 70 Q68 70 60 88 Z" fill="#1d1210" stroke="${OL}" stroke-width="4"/>
      <path d="M64 58 L58 22 L82 40 L100 12 L118 40 L142 22 L136 58 Z" fill="url(#${g})" stroke="${OL}" stroke-width="5" stroke-linejoin="round"/>
      <rect x="62" y="52" width="76" height="12" rx="4" fill="#d48a00" stroke="${OL}" stroke-width="4"/>
      <circle cx="100" cy="36" r="5" fill="#ff3b8d" stroke="${OL}" stroke-width="3"/>
      <path d="M70 160 Q100 196 130 160" fill="none" stroke="url(#${g})" stroke-width="6"/>
      <circle cx="100" cy="186" r="9" fill="url(#${g})" stroke="${OL}" stroke-width="3"/>
      <path d="M97 181 L103 181 L103 189 L97 189 Z" fill="${OL}"/>`, '0 0 200 200');
  }

  function queenCadence() {
    const d = id('d'), g = id('g');
    return svg(`<defs>${lin(d, [[0, '#ff3b5c'], [1, '#9b0f2e']])}${lin(g, [[0, '#fff3a3'], [0.5, '#ffc21a'], [1, '#c98100']])}</defs>
      <circle cx="100" cy="84" r="70" fill="#2a1410" stroke="${OL}" stroke-width="5"/>
      <path d="M16 200 Q22 162 66 154 L134 154 Q178 162 184 200 Z" fill="url(#${d})" stroke="${OL}" stroke-width="5"/>
      <path d="M70 154 L100 186 L130 154" fill="none" stroke="url(#${g})" stroke-width="5"/>
      ${face({ skin: '#5e3520', shade: '#3f2213', lashes: true, iris: '#2a140b', blush: 0.25,
        brows: `<path d="M64 86 Q76 80 88 84" stroke="${OL}" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M112 84 Q124 80 136 86" stroke="${OL}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
        mouth: `<path d="M84 131 Q92 126 100 130 Q108 126 116 131 Q108 146 100 145 Q92 146 84 131 Z" fill="#d9123f" stroke="${OL}" stroke-width="3.5" stroke-linejoin="round"/><path d="M88 133 Q100 137 112 133" stroke="#fff" stroke-width="2.5" fill="none"/>` })}
      <path d="M60 84 Q66 52 100 50 Q134 52 140 84 Q120 66 100 66 Q80 66 60 84 Z" fill="#2a1410"/>
      <circle cx="52" cy="128" r="11" fill="none" stroke="${OL}" stroke-width="7"/><circle cx="52" cy="128" r="11" fill="none" stroke="#ffc21a" stroke-width="3.5"/>
      <circle cx="148" cy="128" r="11" fill="none" stroke="${OL}" stroke-width="7"/><circle cx="148" cy="128" r="11" fill="none" stroke="#ffc21a" stroke-width="3.5"/>
      <path d="M70 40 L66 14 L86 28 L100 6 L114 28 L134 14 L130 40 Z" fill="url(#${g})" stroke="${OL}" stroke-width="5" stroke-linejoin="round"/>
      <circle cx="100" cy="26" r="5" fill="#22e3ff" stroke="${OL}" stroke-width="3"/>`, '0 0 200 200');
  }

  function djDuchess() {
    const j = id('j'), g = id('g'), hp = id('h');
    let braids = '';
    for (let i = 0; i < 6; i++) {
      const xl = 50 + i * 3.4, xr = 150 - i * 3.4;
      braids += `<path d="M${xl} 80 Q${xl - 8} 130 ${xl - 4 + i} 176" stroke="${OL}" stroke-width="8" fill="none" stroke-linecap="round"/><path d="M${xl} 80 Q${xl - 8} 130 ${xl - 4 + i} 176" stroke="#2b1a14" stroke-width="4.5" fill="none" stroke-linecap="round"/>`;
      braids += `<path d="M${xr} 80 Q${xr + 8} 130 ${xr + 4 - i} 176" stroke="${OL}" stroke-width="8" fill="none" stroke-linecap="round"/><path d="M${xr} 80 Q${xr + 8} 130 ${xr + 4 - i} 176" stroke="#2b1a14" stroke-width="4.5" fill="none" stroke-linecap="round"/>`;
      braids += `<circle cx="${xl - 4 + i}" cy="176" r="4" fill="#b05cff" stroke="${OL}" stroke-width="2"/><circle cx="${xr + 4 - i}" cy="176" r="4" fill="#b05cff" stroke="${OL}" stroke-width="2"/>`;
    }
    return svg(`<defs>${lin(j, [[0, '#19d3c5'], [1, '#0b7f86']])}${lin(g, [[0, '#fff3a3'], [0.5, '#ffc21a'], [1, '#c98100']])}${lin(hp, [[0, '#7fd3ff'], [1, '#1446b8']])}</defs>
      <path d="M16 200 Q22 160 66 152 L134 152 Q178 160 184 200 Z" fill="url(#${j})" stroke="${OL}" stroke-width="5"/>
      <path d="M84 152 L84 200 M116 152 L116 200" stroke="#0b5f66" stroke-width="4"/>
      ${braids}
      ${face({ skin: '#a5693f', shade: '#7c4a29', lashes: true, iris: '#3b2212',
        mouth: `<path d="M86 131 Q100 144 114 131 Q100 136 86 131 Z" fill="#fff" stroke="${OL}" stroke-width="3.5" stroke-linejoin="round"/><path d="M86 131 Q100 128 114 131" stroke="#b0346a" stroke-width="3" fill="none"/>` })}
      <path d="M56 92 Q56 50 100 48 Q144 50 144 92 Q134 66 100 64 Q66 66 56 92 Z" fill="#2b1a14" stroke="${OL}" stroke-width="4"/>
      <path d="M82 50 L80 34 L92 42 L100 28 L108 42 L120 34 L118 50 Z" fill="url(#${g})" stroke="${OL}" stroke-width="4" stroke-linejoin="round"/>
      <path d="M54 166 Q54 140 76 140 M146 166 Q146 140 124 140" fill="none" stroke="${OL}" stroke-width="9"/>
      <path d="M60 168 Q100 186 140 168" fill="none" stroke="${OL}" stroke-width="10"/>
      <path d="M60 168 Q100 186 140 168" fill="none" stroke="url(#${hp})" stroke-width="5"/>
      <rect x="40" y="150" width="26" height="32" rx="10" fill="url(#${hp})" stroke="${OL}" stroke-width="4"/>
      <rect x="134" y="150" width="26" height="32" rx="10" fill="url(#${hp})" stroke="${OL}" stroke-width="4"/>`, '0 0 200 200');
  }

  function princeBreaks() {
    const j = id('j'), c = id('c'), g = id('g');
    return svg(`<defs>${lin(j, [[0, '#ff4a3d'], [1, '#a8170f']])}${lin(c, [[0, '#ff5a4a'], [1, '#b81b12']])}${lin(g, [[0, '#fff3a3'], [1, '#d48a00']])}</defs>
      <path d="M16 200 Q22 162 66 154 L134 154 Q178 162 184 200 Z" fill="url(#${j})" stroke="${OL}" stroke-width="5"/>
      <path d="M70 156 L60 200 M130 156 L140 200" stroke="#fff" stroke-width="6"/>
      <path d="M100 158 L100 200" stroke="${OL}" stroke-width="4"/><path d="M84 154 L100 172 L116 154" fill="#fff" stroke="${OL}" stroke-width="4" stroke-linejoin="round"/>
      ${face({ skin: '#c48a5c', shade: '#9a6438', eyeRy: 11, iris: '#4a2a14',
        brows: `<path d="M64 84 Q76 77 88 82" stroke="${OL}" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M112 82 Q124 77 136 84" stroke="${OL}" stroke-width="5" fill="none" stroke-linecap="round"/>`,
        mouth: `<path d="M80 128 Q100 152 120 128 Z" fill="#fff" stroke="${OL}" stroke-width="3.5" stroke-linejoin="round"/><path d="M88 140 Q100 146 112 140" fill="#ff6b8b" stroke="${OL}" stroke-width="2.5"/>` })}
      <path d="M60 92 Q58 64 72 58 L86 66 Q78 76 76 90 Z" fill="#2a1a12" stroke="${OL}" stroke-width="3"/>
      <path d="M140 92 Q142 64 128 58 L114 66 Q122 76 124 90 Z" fill="#2a1a12" stroke="${OL}" stroke-width="3"/>
      <path d="M56 78 Q56 40 100 38 Q144 40 144 78 Q122 68 100 68 Q78 68 56 78 Z" fill="url(#${c})" stroke="${OL}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M100 39 L100 68 M78 44 Q76 58 78 70 M122 44 Q124 58 122 70" stroke="#7d0f08" stroke-width="2.5" fill="none"/>
      <path d="M58 76 Q48 70 30 74 Q32 84 58 84 Z" fill="#8f140c" stroke="${OL}" stroke-width="4" stroke-linejoin="round"/>
      <path d="M116 56 L118 48 L123 52 L127 45 L131 52 L136 48 L137 56 Z" fill="url(#${g})" stroke="${OL}" stroke-width="2.4" stroke-linejoin="round"/>`, '0 0 200 200');
  }

  function countessCanvas() {
    const h = id('h'), b = id('b');
    return svg(`<defs>${lin(h, [[0, '#ff9a3c'], [1, '#d4560a']])}${lin(b, [[0, '#2ad46e'], [1, '#0f7a3c']])}</defs>
      <path d="M16 200 Q22 160 66 152 L134 152 Q178 160 184 200 Z" fill="url(#${h})" stroke="${OL}" stroke-width="5"/>
      <path d="M66 152 Q100 176 134 152" fill="none" stroke="${OL}" stroke-width="4"/>
      <path d="M86 166 L84 194 M114 166 L116 194" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
      <circle cx="30" cy="186" r="5" fill="#22e3ff"/><circle cx="168" cy="178" r="6" fill="#ff3b8d"/><circle cx="150" cy="194" r="3.5" fill="#ffc531"/>
      <path d="M58 104 Q44 120 56 140 M142 104 Q156 120 144 140" stroke="#3a1f12" stroke-width="16" stroke-linecap="round" fill="none"/>
      ${face({ skin: '#b97a4c', shade: '#8c5532', lashes: true, iris: '#3b2212', look: 2,
        mouth: `<path d="M86 132 Q102 142 116 128" fill="none" stroke="${OL}" stroke-width="4" stroke-linecap="round"/>` })}
      <circle cx="128" cy="128" r="3.5" fill="#ff3b8d"/><circle cx="135" cy="121" r="2.2" fill="#22e3ff"/><circle cx="122" cy="134" r="2" fill="#ffc531"/>
      <circle cx="52" cy="122" r="7" fill="none" stroke="#ffc21a" stroke-width="3.5"/><circle cx="148" cy="122" r="7" fill="none" stroke="#ffc21a" stroke-width="3.5"/>
      <path d="M54 86 Q50 36 100 34 Q150 36 146 86 Z" fill="url(#${b})" stroke="${OL}" stroke-width="5" stroke-linejoin="round"/>
      <rect x="50" y="76" width="100" height="16" rx="6" fill="#0f7a3c" stroke="${OL}" stroke-width="4"/>
      <path d="M58 80 L58 90 M66 80 L66 90 M74 80 L74 90 M82 80 L82 90 M90 80 L90 90 M98 80 L98 90 M106 80 L106 90 M114 80 L114 90 M122 80 L122 90 M130 80 L130 90 M138 80 L138 90" stroke="#0a5c2c" stroke-width="2.5"/>
      <circle cx="100" cy="30" r="9" fill="#ffc531" stroke="${OL}" stroke-width="4"/>
      <path d="M70 52 Q74 46 80 50" stroke="#ff3b8d" stroke-width="4" fill="none" stroke-linecap="round"/>`, '0 0 200 200');
  }

  function griot() {
    const r = id('r'), k = id('k');
    return svg(`<defs>${lin(r, [[0, '#5b3a8c'], [1, '#2b1650']])}
      <pattern id="${k}" width="24" height="12" patternUnits="userSpaceOnUse"><rect width="24" height="12" fill="#ffb100"/><rect width="8" height="12" fill="#1f8a3a"/><rect x="12" width="5" height="12" fill="#c8102e"/><rect x="20" width="2" height="12" fill="#111"/></pattern></defs>
      <path d="M16 200 Q22 160 66 152 L134 152 Q178 160 184 200 Z" fill="url(#${r})" stroke="${OL}" stroke-width="5"/>
      <path d="M52 160 L72 200 L92 200 L76 154 Z M148 160 L128 200 L108 200 L124 154 Z" fill="url(#${k})" stroke="${OL}" stroke-width="4" stroke-linejoin="round"/>
      ${face({ skin: '#4f2e1c', shade: '#341c10', blush: 0.12, look: 0,
        brows: `<path d="M63 86 Q76 80 89 84" stroke="#e9e4dc" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M111 84 Q124 80 137 86" stroke="#e9e4dc" stroke-width="6" fill="none" stroke-linecap="round"/>`,
        mouth: `<path d="M86 131 Q100 142 114 131" fill="#fff" stroke="${OL}" stroke-width="3.5"/>` })}
      <circle cx="76" cy="101" r="15" fill="#fff" fill-opacity=".12" stroke="#ffc531" stroke-width="4"/>
      <circle cx="124" cy="101" r="15" fill="#fff" fill-opacity=".12" stroke="#ffc531" stroke-width="4"/>
      <path d="M91 101 Q100 95 109 101" stroke="#ffc531" stroke-width="4" fill="none"/>
      <path d="M60 104 Q62 166 100 172 Q138 166 140 104 L134 104 Q132 138 116 142 Q100 132 84 142 Q68 138 66 104 Z" fill="#ece7df" stroke="${OL}" stroke-width="3.5"/>
      <path d="M82 128 Q100 120 118 128 Q100 126 82 128 Z" fill="#ece7df" stroke="${OL}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M86 132 Q100 141 114 132 Q100 136 86 132 Z" fill="#fff" stroke="${OL}" stroke-width="3"/>
      <path d="M62 74 Q62 40 100 40 Q138 40 138 74 Z" fill="url(#${k})" stroke="${OL}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M62 74 L138 74" stroke="${OL}" stroke-width="5"/>`, '0 0 200 200');
  }

  // Lit dance-floor panel (goal icon) and a static blob (goal icon).
  function floorIcon() {
    return svg(`<rect x="8" y="8" width="84" height="84" rx="12" fill="#1d0f33" stroke="${OL}" stroke-width="5"/>
      <rect x="14" y="14" width="34" height="34" rx="5" fill="#ff3b8d"/><rect x="52" y="14" width="34" height="34" rx="5" fill="#22e3ff"/>
      <rect x="14" y="52" width="34" height="34" rx="5" fill="#ffc531"/><rect x="52" y="52" width="34" height="34" rx="5" fill="#3bff8a"/>
      <path d="M20 22 L34 22" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".8"/>`);
  }
  function staticIcon(seed = 3) {
    const cp = id('c');
    return svg(`<defs><clipPath id="${cp}"><rect x="8" y="8" width="84" height="84" rx="18"/></clipPath></defs>
      <rect x="8" y="8" width="84" height="84" rx="18" fill="#3c2b6b"/>
      <g clip-path="url(#${cp})">${staticNoise(seed, 8, 8, 84, 84, 6, ['#ffffff', '#cfc4f5', '#7b66b8', '#22e3ff', '#ff3b8d'])}</g>
      <rect x="8" y="8" width="84" height="84" rx="18" fill="none" stroke="${OL}" stroke-width="5"/>
      <path d="M24 40 L44 48 L24 54 Z M76 40 L56 48 L76 54 Z" fill="#ff2a4f" stroke="${OL}" stroke-width="4" stroke-linejoin="round"/>
      <path d="M32 72 L40 66 L50 72 L60 66 L68 72" fill="none" stroke="${OL}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`);
  }
  function hand() {
    return svg(`<path d="M38 92 L30 60 Q27 50 35 48 Q41 47 43 55 L46 64 L46 22 Q46 13 54 13 Q62 13 62 22 L62 50 Q70 46 74 52 Q82 50 84 58 Q92 58 92 68 L90 80 Q86 92 74 94 Z" fill="#fff" stroke="${OL}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M62 50 L62 62 M74 52 L74 64" stroke="${OL}" stroke-width="3.5" stroke-linecap="round"/>`);
  }

  // ----------------------------------------------------------------- icons
  const icon = {
    coin: () => svg(`<circle cx="50" cy="50" r="42" fill="#ffc21a" stroke="${OL}" stroke-width="7"/><circle cx="50" cy="50" r="30" fill="none" stroke="#c98100" stroke-width="5"/><path d="M38 64 L36 40 L44 47 L50 36 L56 47 L64 40 L62 64 Z" fill="#fff3b0" stroke="#b07000" stroke-width="3" stroke-linejoin="round"/>`),
    star: () => svg(`<path d="${star(50, 54, 44, 19)}" fill="#ffc21a" stroke="${OL}" stroke-width="7" stroke-linejoin="round"/><path d="M38 40 L46 30" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".8"/>`),
    hammer: () => svg(`<g transform="rotate(35 50 50)"><rect x="44" y="40" width="12" height="56" rx="5" fill="#2d2347" stroke="${OL}" stroke-width="6"/><circle cx="50" cy="28" r="22" fill="#ff3347" stroke="${OL}" stroke-width="6"/><path d="M34 20 L66 36 M34 34 L66 20" stroke="#6d0014" stroke-width="3" opacity=".6"/><rect x="38" y="44" width="24" height="9" rx="3" fill="#ffc21a" stroke="${OL}" stroke-width="5"/></g>`),
    row: () => svg(`<circle cx="50" cy="50" r="30" fill="#2a2140" stroke="${OL}" stroke-width="6"/><circle cx="50" cy="50" r="18" fill="none" stroke="#6b5c94" stroke-width="3"/><circle cx="50" cy="50" r="7" fill="#ff3b8d" stroke="${OL}" stroke-width="3"/><path d="M4 50 L18 40 L18 60 Z M96 50 L82 40 L82 60 Z" fill="#22e3ff" stroke="${OL}" stroke-width="5" stroke-linejoin="round"/>`),
    col: () => svg(`<rect x="24" y="16" width="52" height="68" rx="9" fill="#2a2140" stroke="${OL}" stroke-width="6"/><circle cx="50" cy="60" r="15" fill="#c9cfe6" stroke="${OL}" stroke-width="5"/><circle cx="50" cy="60" r="6" fill="#ff3b8d"/><circle cx="50" cy="31" r="7" fill="#c9cfe6" stroke="${OL}" stroke-width="4"/><path d="M50 98 L40 86 L60 86 Z M50 2 L40 14 L60 14 Z" fill="#22e3ff" stroke="${OL}" stroke-width="5" stroke-linejoin="round"/>`),
    shuffle: () => svg(`<path d="M14 32 L34 32 Q50 32 58 50 Q66 68 82 68 L86 68" fill="none" stroke="${OL}" stroke-width="15" stroke-linecap="round"/><path d="M14 68 L34 68 Q50 68 58 50 Q66 32 82 32 L86 32" fill="none" stroke="${OL}" stroke-width="15" stroke-linecap="round"/><path d="M14 32 L34 32 Q50 32 58 50 Q66 68 82 68 L86 68" fill="none" stroke="#ffc21a" stroke-width="7" stroke-linecap="round"/><path d="M14 68 L34 68 Q50 68 58 50 Q66 32 82 32 L86 32" fill="none" stroke="#22e3ff" stroke-width="7" stroke-linecap="round"/><path d="M84 20 L98 32 L84 44 Z M84 56 L98 68 L84 80 Z" fill="#fff" stroke="${OL}" stroke-width="5" stroke-linejoin="round"/>`),
    lock: () => svg(`<path d="M30 46 L30 32 Q30 12 50 12 Q70 12 70 32 L70 46" fill="none" stroke="${OL}" stroke-width="16"/><path d="M30 46 L30 32 Q30 12 50 12 Q70 12 70 32 L70 46" fill="none" stroke="#c9cfe6" stroke-width="7"/><rect x="18" y="42" width="64" height="48" rx="9" fill="#ffc21a" stroke="${OL}" stroke-width="7"/><circle cx="50" cy="62" r="7" fill="${OL}"/><path d="M50 64 L50 76" stroke="${OL}" stroke-width="6" stroke-linecap="round"/>`),
  };

  // ------------------------------------------------------------- the block
  // Each area: a backdrop plus five buildable pieces, drawn in a 400x260 frame.
  const T = (x, y, txt, size, fill, extra = '') =>
    `<text x="${x}" y="${y}" font-family="'Sedgwick Ave Display', 'Bungee', Impact, sans-serif" font-size="${size}" fill="${fill}" text-anchor="middle" ${extra}>${txt}</text>`;
  const T2 = (x, y, txt, size, fill, extra = '') =>
    `<text x="${x}" y="${y}" font-family="'Bungee', Impact, sans-serif" font-size="${size}" fill="${fill}" text-anchor="middle" ${extra}>${txt}</text>`;

  function windows(x, y, cols, rows, w, h, gx, gy, seed) {
    let s = seed, out = '';
    const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const lit = r() < 0.55;
      out += `<rect x="${x + i * gx}" y="${y + j * gy}" width="${w}" height="${h}" rx="1.5" fill="${lit ? (r() < 0.5 ? '#ffd27a' : '#ffb35c') : '#2a1d4a'}" stroke="${OL}" stroke-width="1.5"/>`;
    }
    return out;
  }
  function bricks(x, y, w, h, color, seed) {
    let out = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}"/>`;
    for (let yy = y + 8; yy < y + h; yy += 8) out += `<path d="M${x} ${yy} L${x + w} ${yy}" stroke="#000" stroke-opacity=".18" stroke-width="1"/>`;
    for (let yy = y, k = 0; yy < y + h; yy += 8, k++) {
      for (let xx = x + (k % 2 ? 8 : 0); xx < x + w; xx += 16) out += `<path d="M${xx} ${yy} L${xx} ${yy + 8}" stroke="#000" stroke-opacity=".14" stroke-width="1"/>`;
    }
    return out;
  }
  function stars(seed, n, h) {
    let s = seed, out = '';
    const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < n; i++) out += `<circle cx="${(r() * 400).toFixed(1)}" cy="${(r() * h).toFixed(1)}" r="${(0.6 + r() * 1.3).toFixed(2)}" fill="#fff" opacity="${(0.4 + r() * 0.6).toFixed(2)}"/>`;
    return out;
  }
  function sky(top, bottom, gid) {
    return `<defs>${lin(gid, [[0, top], [1, bottom]])}</defs><rect width="400" height="260" fill="url(#${gid})"/>`;
  }
  function speakerStack(x, y, s = 1) {
    const cone = (cy, r) => `<circle cx="${x + 18 * s}" cy="${cy}" r="${r}" fill="#c9cfe6" stroke="${OL}" stroke-width="2.5"/><circle cx="${x + 18 * s}" cy="${cy}" r="${r * 0.55}" fill="#2a2140"/><circle cx="${x + 18 * s}" cy="${cy}" r="${r * 0.2}" fill="#ff3b8d"/>`;
    return `<rect x="${x}" y="${y}" width="${36 * s}" height="${44 * s}" rx="4" fill="#2d2347" stroke="${OL}" stroke-width="3"/>${cone(y + 24 * s, 13 * s)}
      <rect x="${x}" y="${y - 30 * s}" width="${36 * s}" height="${30 * s}" rx="4" fill="#2d2347" stroke="${OL}" stroke-width="3"/>${cone(y - 15 * s, 9 * s)}`;
  }

  const AREAS = [
    {
      key: 'block', name: 'The Block Party', host: 'kingFlow',
      backdrop: () => `${sky('#140a35', '#4a1d6e', id('s'))}${stars(11, 50, 120)}
        <circle cx="330" cy="44" r="20" fill="#fff4cf"/><circle cx="338" cy="40" r="18" fill="#2a1450" opacity=".35"/>
        <g>${bricks(0, 40, 120, 190, '#8a3b2e', 1)}${windows(14, 56, 4, 5, 16, 18, 26, 30, 3)}<rect x="0" y="40" width="120" height="190" fill="none" stroke="${OL}" stroke-width="3"/></g>
        <g>${bricks(280, 60, 120, 170, '#6b3a5c', 2)}${windows(294, 76, 4, 4, 16, 18, 26, 30, 9)}<rect x="280" y="60" width="120" height="170" fill="none" stroke="${OL}" stroke-width="3"/></g>
        <path d="M120 120 L280 120 L280 230 L120 230 Z" fill="#2e1c52"/>
        <rect x="0" y="222" width="400" height="38" fill="#3a3550"/><rect x="0" y="222" width="400" height="6" fill="#57516f"/>
        <path d="M30 244 L70 244 M130 244 L170 244 M230 244 L270 244 M330 244 L370 244" stroke="#ffc531" stroke-width="3" opacity=".6"/>
        <g transform="translate(250 200)"><rect x="0" y="6" width="14" height="18" rx="3" fill="#e8364f" stroke="${OL}" stroke-width="2.5"/><rect x="-3" y="2" width="20" height="6" rx="2" fill="#ff5a6e" stroke="${OL}" stroke-width="2.5"/><circle cx="7" cy="14" r="3" fill="#b0192f"/></g>`,
      items: [
        { key: 'decks', name: 'Turntables', draw: () => `<g>
          <path d="M140 230 L150 178 L250 178 L260 230 Z" fill="#7b2cff" stroke="${OL}" stroke-width="3"/>
          <path d="M150 196 L250 196" stroke="#ffc531" stroke-width="4"/>
          <rect x="140" y="166" width="120" height="16" rx="3" fill="#2d2347" stroke="${OL}" stroke-width="3"/>
          <ellipse cx="168" cy="166" rx="17" ry="5.5" fill="#14111f" stroke="#6b5c94" stroke-width="2"/><ellipse cx="168" cy="166" rx="5" ry="1.8" fill="#ff3b8d"/>
          <ellipse cx="232" cy="166" rx="17" ry="5.5" fill="#14111f" stroke="#6b5c94" stroke-width="2"/><ellipse cx="232" cy="166" rx="5" ry="1.8" fill="#22e3ff"/>
          <rect x="190" y="160" width="20" height="8" rx="1.5" fill="#c9cfe6" stroke="${OL}" stroke-width="2"/></g>` },
        { key: 'speakers', name: 'Speaker Stacks', draw: () => `<g>${speakerStack(96, 178, 1)}${speakerStack(268, 178, 1)}</g>` },
        { key: 'lights', name: 'String Lights', draw: () => {
          let bulbs = '';
          const cols = ['#ff3b8d', '#ffc531', '#22e3ff', '#3bff8a', '#b05cff'];
          for (let i = 0; i <= 14; i++) {
            const x = 120 + i * (160 / 14), y = 92 + Math.sin((i / 14) * Math.PI) * 26;
            bulbs += `<circle cx="${x.toFixed(1)}" cy="${(y + 5).toFixed(1)}" r="7" fill="${cols[i % 5]}" opacity=".35"/><circle cx="${x.toFixed(1)}" cy="${(y + 5).toFixed(1)}" r="3.5" fill="${cols[i % 5]}" stroke="${OL}" stroke-width="1.2"/>`;
          }
          return `<g><path d="M120 92 Q200 144 280 92" fill="none" stroke="${OL}" stroke-width="2"/>${bulbs}</g>`;
        } },
        { key: 'mural', name: 'Graffiti Mural', draw: () => `<g>
          <path d="M8 150 L112 140 L112 196 L8 204 Z" fill="#22e3ff" opacity=".25"/>
          ${T(60, 186, 'FLOW', 34, '#ff3b8d', `stroke="${OL}" stroke-width="2.5" paint-order="stroke" transform="rotate(-5 60 176)"`)}
          <path d="M14 196 Q30 188 44 198" stroke="#ffc531" stroke-width="3" fill="none"/><circle cx="104" cy="152" r="4" fill="#3bff8a"/></g>` },
        { key: 'banner', name: 'Block Party Banner', draw: () => `<g>
          <path d="M126 36 L274 36 L268 52 L274 68 L126 68 L132 52 Z" fill="#ffc531" stroke="${OL}" stroke-width="3" stroke-linejoin="round"/>
          ${T2(200, 59, 'BLOCK PARTY', 16, OL)}
          <path d="M120 28 L126 40 M280 28 L274 40" stroke="${OL}" stroke-width="2"/></g>` },
      ],
    },
    {
      key: 'shop', name: 'The Record Shop', host: 'djDuchess',
      backdrop: () => `${sky('#1a0b2e', '#3b1452', id('s'))}${stars(23, 30, 60)}
        ${bricks(0, 30, 400, 200, '#4a2a6b', 5)}
        <rect x="0" y="30" width="400" height="200" fill="none" stroke="${OL}" stroke-width="3"/>
        <rect x="56" y="96" width="210" height="110" rx="4" fill="#1d1238" stroke="${OL}" stroke-width="4"/>
        <rect x="62" y="102" width="198" height="98" fill="#2e2156"/>
        <path d="M70 108 L120 108 L82 194 L70 194 Z" fill="#fff" opacity=".07"/>
        <rect x="290" y="110" width="70" height="112" rx="4" fill="#5b2d1a" stroke="${OL}" stroke-width="4"/>
        <circle cx="348" cy="168" r="4" fill="#ffc531" stroke="${OL}" stroke-width="2"/>
        <rect x="298" y="120" width="54" height="40" rx="3" fill="#2e2156" stroke="${OL}" stroke-width="2.5"/>
        <rect x="0" y="222" width="400" height="38" fill="#3a3550"/><rect x="0" y="222" width="400" height="6" fill="#57516f"/>`,
      items: [
        { key: 'neon', name: 'Neon Sign', draw: () => `<g>
          <rect x="74" y="40" width="176" height="40" rx="8" fill="#14082a" stroke="${OL}" stroke-width="3"/>
          ${T2(162, 69, 'RECORDS', 22, '#ff3b8d', 'stroke="#ffc1dc" stroke-width="1" paint-order="stroke" style="filter:drop-shadow(0 0 4px #ff3b8d)"')}</g>` },
        { key: 'awning', name: 'Striped Awning', draw: () => {
          let st = '';
          for (let i = 0; i < 9; i++) st += `<path d="M${50 + i * 25} 84 L${75 + i * 25} 84 L${75 + i * 25} 100 Q${62 + i * 25} 108 ${50 + i * 25} 100 Z" fill="${i % 2 ? '#fff4e0' : '#e8364f'}" stroke="${OL}" stroke-width="2"/>`;
          return `<g>${st}</g>`;
        } },
        { key: 'albums', name: 'Album Wall', draw: () => {
          const c = ['#ffc531', '#22e3ff', '#ff3b8d', '#3bff8a', '#b05cff', '#ff7a1a'];
          let a = '';
          for (let i = 0; i < 6; i++) {
            const x = 74 + (i % 3) * 62, y = 112 + Math.floor(i / 3) * 44;
            a += `<rect x="${x}" y="${y}" width="40" height="38" rx="2" fill="${c[i]}" stroke="${OL}" stroke-width="2.5"/><circle cx="${x + 20}" cy="${y + 19}" r="11" fill="#14111f"/><circle cx="${x + 20}" cy="${y + 19}" r="3.5" fill="${c[(i + 2) % 6]}"/>`;
          }
          return `<g>${a}</g>`;
        } },
        { key: 'bins', name: 'Record Bins', draw: () => {
          let r = '';
          const c = ['#ff3b8d', '#22e3ff', '#ffc531', '#3bff8a', '#b05cff'];
          for (let i = 0; i < 9; i++) r += `<rect x="${86 + i * 16}" y="${190 - (i % 3) * 3}" width="14" height="22" rx="1.5" fill="${c[i % 5]}" stroke="${OL}" stroke-width="1.8"/>`;
          return `<g><rect x="78" y="206" width="160" height="26" rx="3" fill="#a9672c" stroke="${OL}" stroke-width="3"/>${r}<rect x="78" y="206" width="160" height="7" fill="#c98f55" stroke="${OL}" stroke-width="2"/></g>`;
        } },
        { key: 'vinyl', name: 'Giant Vinyl', draw: () => `<g>
          <circle cx="342" cy="66" r="30" fill="#14111f" stroke="${OL}" stroke-width="3"/>
          <circle cx="342" cy="66" r="22" fill="none" stroke="#6b5c94" stroke-width="1.2"/><circle cx="342" cy="66" r="15" fill="none" stroke="#6b5c94" stroke-width="1.2"/>
          <circle cx="342" cy="66" r="9" fill="#ffc531" stroke="${OL}" stroke-width="2"/><circle cx="342" cy="66" r="2" fill="${OL}"/>
          <path d="M322 46 A28 28 0 0 1 344 38" stroke="#fff" stroke-width="3" fill="none" opacity=".5"/></g>` },
      ],
    },
    {
      key: 'blacktop', name: 'The Blacktop', host: 'princeBreaks',
      backdrop: () => `${sky('#0d1b3d', '#3a2a6e', id('s'))}${stars(37, 40, 100)}
        <path d="M0 150 L30 150 L30 110 L60 110 L60 130 L90 130 L90 90 L120 90 L120 140 L160 140 L160 100 L190 100 L190 120 L230 120 L230 80 L260 80 L260 130 L300 130 L300 105 L330 105 L330 140 L370 140 L370 115 L400 115 L400 160 L0 160 Z" fill="#1d1238" opacity=".9"/>
        <path d="M0 160 L400 160" stroke="#8e88a8" stroke-width="2"/>
        <g opacity=".35" stroke="#c9cfe6" stroke-width="1.2">${Array.from({ length: 21 }, (_, i) => `<path d="M${i * 20} 160 L${i * 20 + 20} 196 M${i * 20 + 20} 160 L${i * 20} 196"/>`).join('')}</g>
        <path d="M0 196 L400 196" stroke="#8e88a8" stroke-width="3"/>
        <rect x="0" y="196" width="400" height="64" fill="#2b4a6b"/>
        <path d="M20 250 Q200 214 380 250" fill="none" stroke="#fff" stroke-width="2.5" opacity=".75"/>
        <path d="M200 200 L200 260" stroke="#fff" stroke-width="2.5" opacity=".6"/>`,
      items: [
        { key: 'hoop', name: 'Hoop', draw: () => `<g>
          <rect x="44" y="96" width="8" height="130" fill="#8e88a8" stroke="${OL}" stroke-width="2.5"/>
          <rect x="22" y="70" width="52" height="38" rx="3" fill="#fff" stroke="${OL}" stroke-width="3"/>
          <rect x="36" y="82" width="24" height="17" fill="none" stroke="#e8364f" stroke-width="3"/>
          <ellipse cx="48" cy="112" rx="15" ry="4" fill="none" stroke="#ff7a1a" stroke-width="3.5"/>
          <path d="M34 113 L39 132 L57 132 L62 113 M41 114 L46 132 M55 114 L50 132" stroke="#fff" stroke-width="1.5" fill="none"/></g>` },
        { key: 'cardboard', name: 'Cardboard Dance Floor', draw: () => `<g>
          <path d="M130 212 L270 212 L284 246 L116 246 Z" fill="#d9a066" stroke="${OL}" stroke-width="3"/>
          <path d="M200 212 L200 246 M124 229 L276 229" stroke="#a9672c" stroke-width="2"/>
          ${T2(200, 236, 'B-BOY', 12, '#7b3f12')}</g>` },
        { key: 'bleachers', name: 'Bleachers', draw: () => `<g>
          <path d="M296 226 L296 176 L386 176 L386 226" fill="none" stroke="${OL}" stroke-width="3"/>
          <rect x="296" y="176" width="90" height="10" fill="#c9cfe6" stroke="${OL}" stroke-width="2.5"/>
          <rect x="304" y="194" width="82" height="10" fill="#c9cfe6" stroke="${OL}" stroke-width="2.5"/>
          <rect x="312" y="212" width="74" height="10" fill="#c9cfe6" stroke="${OL}" stroke-width="2.5"/></g>` },
        { key: 'bench', name: 'Boombox Bench', draw: () => `<g>
          <rect x="170" y="180" width="70" height="8" rx="2" fill="#a9672c" stroke="${OL}" stroke-width="2.5"/>
          <path d="M176 188 L176 204 M234 188 L234 204" stroke="${OL}" stroke-width="3"/>
          <rect x="186" y="160" width="40" height="22" rx="4" fill="#2d2347" stroke="${OL}" stroke-width="2.5"/>
          <circle cx="196" cy="172" r="6" fill="#c9cfe6" stroke="${OL}" stroke-width="1.5"/><circle cx="216" cy="172" r="6" fill="#c9cfe6" stroke="${OL}" stroke-width="1.5"/>
          <path d="M194 160 L194 154 L218 154 L218 160" fill="none" stroke="${OL}" stroke-width="2.5"/></g>` },
        { key: 'courtlights', name: 'Court Lights', draw: () => `<g>
          <path d="M120 70 L170 196 L70 196 Z" fill="#fff6c2" opacity=".12"/><path d="M290 70 L340 196 L240 196 Z" fill="#fff6c2" opacity=".12"/>
          <rect x="116" y="60" width="8" height="140" fill="#8e88a8" stroke="${OL}" stroke-width="2"/><rect x="104" y="54" width="32" height="12" rx="3" fill="#fff6c2" stroke="${OL}" stroke-width="2.5"/>
          <rect x="286" y="60" width="8" height="140" fill="#8e88a8" stroke="${OL}" stroke-width="2"/><rect x="274" y="54" width="32" height="12" rx="3" fill="#fff6c2" stroke="${OL}" stroke-width="2.5"/></g>` },
      ],
    },
    {
      key: 'wall', name: 'The Wall', host: 'countessCanvas',
      backdrop: () => `${sky('#12081f', '#2e1450', id('s'))}${stars(53, 40, 80)}
        <rect x="0" y="70" width="400" height="140" fill="#5c5670" stroke="${OL}" stroke-width="3"/>
        ${Array.from({ length: 10 }, (_, i) => `<path d="M${i * 40} 70 L${i * 40} 210" stroke="#000" stroke-opacity=".2"/>`).join('')}
        <rect x="0" y="210" width="400" height="50" fill="#2a2438"/>
        <path d="M0 236 L400 236 M0 248 L400 248" stroke="#8e88a8" stroke-width="3"/>
        ${Array.from({ length: 20 }, (_, i) => `<rect x="${i * 20 + 4}" y="232" width="10" height="20" fill="#5a3418"/>`).join('')}`,
      items: [
        { key: 'piece', name: 'Wildstyle Piece', draw: () => `<g>
          ${T(132, 150, 'RHYME', 54, '#3bff8a', `stroke="${OL}" stroke-width="4" paint-order="stroke" transform="rotate(-4 132 130)"`)}
          <path d="M60 102 L72 92 M196 160 L212 168" stroke="#ff3b8d" stroke-width="5" stroke-linecap="round"/></g>` },
        { key: 'character', name: 'Character Mural', draw: () => `<g>
          <circle cx="300" cy="128" r="40" fill="#ffc531" stroke="${OL}" stroke-width="3"/>
          <circle cx="300" cy="134" r="26" fill="#7a4a2a" stroke="${OL}" stroke-width="3"/>
          <path d="M282 112 L278 92 L292 102 L300 86 L308 102 L322 92 L318 112 Z" fill="#fff3a3" stroke="${OL}" stroke-width="2.5" stroke-linejoin="round"/>
          <circle cx="291" cy="132" r="3.5" fill="${OL}"/><circle cx="309" cy="132" r="3.5" fill="${OL}"/>
          <path d="M290 144 Q300 152 310 144" stroke="${OL}" stroke-width="3" fill="none" stroke-linecap="round"/></g>` },
        { key: 'cans', name: 'Paint Cans', draw: () => {
          const c = ['#ff3b8d', '#22e3ff', '#ffc531', '#3bff8a', '#b05cff'];
          let o = '';
          c.forEach((col, i) => { o += `<rect x="${226 + i * 15}" y="${188 + (i % 2) * 4}" width="12" height="24" rx="3" fill="#c9cfe6" stroke="${OL}" stroke-width="2"/><rect x="${226 + i * 15}" y="${196 + (i % 2) * 4}" width="12" height="9" fill="${col}"/><rect x="${229 + i * 15}" y="${183 + (i % 2) * 4}" width="6" height="6" rx="1" fill="${col}" stroke="${OL}" stroke-width="1.5"/>`; });
          return `<g>${o}</g>`;
        } },
        { key: 'train', name: 'Subway Car', draw: () => `<g>
          <rect x="16" y="182" width="190" height="40" rx="6" fill="#b9b3cc" stroke="${OL}" stroke-width="3"/>
          <rect x="26" y="188" width="28" height="14" rx="2" fill="#2a1d4a" stroke="${OL}" stroke-width="2"/><rect x="168" y="188" width="28" height="14" rx="2" fill="#2a1d4a" stroke="${OL}" stroke-width="2"/>
          ${T(112, 214, 'cypher', 22, '#ff3b8d', `stroke="${OL}" stroke-width="2" paint-order="stroke"`)}
          <circle cx="44" cy="224" r="6" fill="#2a2438" stroke="${OL}" stroke-width="2"/><circle cx="178" cy="224" r="6" fill="#2a2438" stroke="${OL}" stroke-width="2"/></g>` },
        { key: 'spots', name: 'Spotlights', draw: () => `<g>
          <path d="M30 20 L150 90 L120 120 Z" fill="#fff6c2" opacity=".14"/><path d="M370 20 L250 90 L280 120 Z" fill="#fff6c2" opacity=".14"/>
          <rect x="16" y="10" width="26" height="18" rx="4" fill="#2d2347" stroke="${OL}" stroke-width="2.5" transform="rotate(30 29 19)"/>
          <rect x="358" y="10" width="26" height="18" rx="4" fill="#2d2347" stroke="${OL}" stroke-width="2.5" transform="rotate(-30 371 19)"/></g>` },
      ],
    },
    {
      key: 'arena', name: 'The Crown Arena', host: 'queenCadence',
      backdrop: () => `${sky('#0c0620', '#2a0f4f', id('s'))}
        <path d="M0 120 Q200 60 400 120 L400 260 L0 260 Z" fill="#1d1238"/>
        ${Array.from({ length: 40 }, (_, i) => `<circle cx="${i * 10 + 5}" cy="${232 + (i % 3) * 3}" r="7" fill="#140a2a"/>`).join('')}
        ${Array.from({ length: 30 }, (_, i) => `<circle cx="${i * 14 + 2}" cy="${246 + (i % 2) * 4}" r="9" fill="#0b0618"/>`).join('')}`,
      items: [
        { key: 'stage', name: 'Main Stage', draw: () => `<g>
          <path d="M70 196 L330 196 L350 226 L50 226 Z" fill="#2d2347" stroke="${OL}" stroke-width="3"/>
          <rect x="70" y="190" width="260" height="8" fill="#ffc531" stroke="${OL}" stroke-width="2"/>
          <path d="M90 214 L310 214" stroke="#22e3ff" stroke-width="3" opacity=".7"/></g>` },
        { key: 'towers', name: 'Speaker Towers', draw: () => `<g>${speakerStack(30, 160, 1.1)}${speakerStack(330, 160, 1.1)}
          ${speakerStack(30, 90, 0.9)}${speakerStack(334, 90, 0.9)}</g>` },
        { key: 'rig', name: 'Light Rig', draw: () => {
          let o = `<rect x="60" y="28" width="280" height="12" fill="none" stroke="#c9cfe6" stroke-width="3"/>`;
          for (let i = 0; i < 14; i++) o += `<path d="M${60 + i * 20} 28 L${80 + i * 20} 40" stroke="#c9cfe6" stroke-width="1.5"/>`;
          const c = ['#ff3b8d', '#22e3ff', '#ffc531', '#3bff8a', '#b05cff', '#ff3b8d'];
          c.forEach((col, i) => { o += `<path d="M${90 + i * 44} 44 L${70 + i * 44} 190 L${110 + i * 44} 190 Z" fill="${col}" opacity=".12"/><rect x="${82 + i * 44}" y="40" width="16" height="12" rx="3" fill="${col}" stroke="${OL}" stroke-width="2"/>`; });
          return `<g>${o}</g>`;
        } },
        { key: 'throne', name: 'Golden Mic Throne', draw: () => `<g>
          <path d="M170 190 L170 120 Q170 100 186 96 L200 80 L214 96 Q230 100 230 120 L230 190 Z" fill="#ffc21a" stroke="${OL}" stroke-width="3"/>
          <rect x="178" y="128" width="44" height="40" rx="4" fill="#9b1dff" stroke="${OL}" stroke-width="2.5"/>
          <rect x="164" y="150" width="72" height="12" rx="3" fill="#d48a00" stroke="${OL}" stroke-width="2.5"/>
          <path d="M184 96 L180 78 L192 88 L200 72 L208 88 L220 78 L216 96 Z" fill="#fff3a3" stroke="${OL}" stroke-width="2" stroke-linejoin="round"/>
          <path d="M250 190 L250 120" stroke="${OL}" stroke-width="4"/><circle cx="250" cy="114" r="8" fill="#ffc21a" stroke="${OL}" stroke-width="2.5"/></g>` },
        { key: 'banner', name: 'Crown Banner', draw: () => `<g>
          <path d="M120 54 L280 54 L280 104 L200 92 L120 104 Z" fill="#9b1dff" stroke="${OL}" stroke-width="3" stroke-linejoin="round"/>
          ${T2(200, 76, 'RHYME', 15, '#ffc531')}${T2(200, 92, 'KINGDOM', 11, '#fff')}</g>` },
      ],
    },
  ];

  function scene(areaIndex, built) {
    const a = AREAS[areaIndex];
    const parts = a.items.map((it, i) => {
      const done = built && built[i];
      return `<g class="build-item${done ? ' built' : ''}" data-item="${i}">${it.draw()}</g>`;
    }).join('');
    return `<svg class="scene-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${a.name}">${a.backdrop()}${parts}</svg>`;
  }

  // ------------------------------------------------------------------ export
  const TILE_ART = [mic, sneaker, chain, cap, headphones, cassette];
  const TILE_NAMES = ['Mic', 'Sneaker', 'Gold Chain', 'Snapback', 'Headphones', 'Mixtape'];
  const POWER_ART = { h: () => sprayCan('h'), v: () => sprayCan('v'), x: boombox, pl: flyer, d: platinum };
  const PORTRAITS = { kingFlow, queenCadence, djDuchess, princeBreaks, countessCanvas, griot, buzzkill: bossBuzzkill, lipsync: bossLipSync, static: bossKingStatic };
  const BOSS_ART = { buzzkill: bossBuzzkill, lipsync: bossLipSync, static: bossKingStatic };

  const dataUrl = (s) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  const cache = {};
  function url(key, fn) { if (!cache[key]) cache[key] = dataUrl(fn()); return cache[key]; }

  root.RKArt = {
    OL, TILE_ART, TILE_NAMES, POWER_ART, PORTRAITS, BOSS_ART, AREAS, icon, scene,
    crown, crate, tape, dataUrl, url,
    tileUrl: (col) => url('tile' + col, TILE_ART[col]),
    powerUrl: (pw) => url('pw' + pw, POWER_ART[pw]),
    crownUrl: () => url('crown', crown),
    crateUrl: (hp) => url('crate' + hp, () => crate(hp)),
    tapeUrl: () => url('tape', tape),
    floorUrl: () => url('floor', floorIcon),
    staticUrl: (k = 3) => url('static' + k, () => staticIcon(k)),
    handUrl: () => url('hand', hand),
    portraitUrl: (k) => url('portrait' + k, PORTRAITS[k]),
    iconUrl: (k) => url('icon' + k, icon[k]),
  };
})(typeof self !== 'undefined' ? self : this);
