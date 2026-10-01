// Balancing harness: lints every level layout, then plays each level with a
// greedy bot and reports win rates.
//   node tools/simulate.mjs [games=40] [levelId ...]
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Engine } = require('../js/engine.js');
const { LEVELS } = require('../js/levels.js');

const games = +(process.argv[2] || 40);
const only = process.argv.slice(3).map(Number);

// ---- lint: cells that could never be refilled once emptied ----
function lint(L) {
  const e = new Engine(L, 7);
  const warn = [];
  const fill = e._fillMap();
  for (let r = 0; r < e.rows; r++) for (let c = 0; c < e.cols; c++) {
    if (e.cells[r][c].p && !fill[r][c]) warn.push(`cell ${c},${r} could never refill once emptied`);
  }
  return warn;
}

// ---- greedy bot ----
const PW_VALUE = { h: 3, v: 3, pl: 3, x: 4, d: 6 };
function progress(e) {
  let s = 0;
  for (const g of e.goals) s += Math.max(-1, (g.need - g.left) / Math.max(1, g.need));
  return s;
}
function shape(e) {
  let s = 0;
  const hoard = Math.min(1, e.moves / 6);
  for (let r = 0; r < e.rows; r++) for (let c = 0; c < e.cols; c++) {
    const cl = e.cells[r][c];
    if (cl.tile && cl.tile.k === 'p') s += (PW_VALUE[cl.tile.pw] || 2) * hoard;
    if (cl.tile && cl.tile.k === 'c') s += 4 * (r / e.rows);
    if (cl.block && cl.block.t === 'static') s -= 0.6;
  }
  return s;
}
function evaluate(e0, mv) {
  const e = e0.clone();
  e.silent = true;
  e.rs = (Math.random() * 4294967296) >>> 0; // the bot must not see upcoming refills
  if (mv.t === 'tap') e.tap(mv); else e.swap(mv.a, mv.b);
  if (e.status === 'won') return 1e6 + e.moves;
  return (progress(e) - progress(e0)) * 100 + shape(e) + Math.random() * 0.05;
}
function play(L, seed) {
  const e = new Engine(L, seed);
  e.silent = true;
  if (L.tutorial) for (const s of L.tutorial) { if (s.do === 'swap') e.swap(s.a, s.b); else e.tap(s.at); }
  while (e.status === 'playing') {
    const moves = e.findMoves();
    let best = null, bestS = -Infinity;
    for (const mv of moves) {
      const s = evaluate(e, mv);
      if (s > bestS) { bestS = s; best = mv; }
    }
    if (best.t === 'tap') e.tap(best); else e.swap(best.a, best.b);
  }
  return { won: e.status === 'won', left: e.moves, goals: e.goals.map((g) => g.left) };
}

let lintFail = 0;
for (const L of LEVELS) {
  if (only.length && !only.includes(L.id)) continue;
  const warn = lint(L);
  if (warn.length) { lintFail++; console.log(`L${L.id} lint: ${warn.join('; ')}`); }
}
if (lintFail) console.log('---');

for (const L of LEVELS) {
  if (only.length && !only.includes(L.id)) continue;
  const t0 = Date.now();
  let wins = 0, leftSum = 0;
  const shortBy = [];
  for (let g = 0; g < games; g++) {
    const res = play(L, 5000 + g * 104729 + L.id * 31);
    if (res.won) { wins++; leftSum += res.left; } else shortBy.push(res.goals.reduce((a, b) => a + Math.max(0, b), 0));
  }
  shortBy.sort((a, b) => a - b);
  const med = shortBy.length ? shortBy[shortBy.length >> 1] : 0;
  const pct = Math.round((wins / games) * 100);
  console.log(
    `L${String(L.id).padStart(2)} ${L.name.padEnd(16)} moves ${String(L.moves).padStart(2)}  win ${String(pct).padStart(3)}%` +
    `  avg left ${wins ? (leftSum / wins).toFixed(1).padStart(4) : '   -'}  median short ${med}  (${Date.now() - t0}ms)`,
  );
}

// ---- calibration: moves needed with an unlimited budget ----
//   CAL=1 node tools/simulate.mjs 60
if (process.env.CAL) {
  console.log('\ncalibration (moves used to finish, unlimited budget): p50 p75 p90');
  for (const L0 of LEVELS) {
    if (only.length && !only.includes(L0.id)) continue;
    const L = { ...L0, moves: 150 };
    const used = [];
    for (let g = 0; g < games; g++) {
      const res = play(L, 9000 + g * 7717 + L.id * 13);
      used.push(res.won ? 150 - res.left : 999);
    }
    used.sort((a, b) => a - b);
    const q = (p) => used[Math.min(used.length - 1, Math.floor(p * used.length))];
    console.log(`L${String(L.id).padStart(2)} ${L.name.padEnd(16)} p50 ${String(q(0.5)).padStart(3)}  p75 ${String(q(0.75)).padStart(3)}  p90 ${String(q(0.9)).padStart(3)}  (now ${L0.moves})`);
  }
}
