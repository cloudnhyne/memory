// Random-play stress test for the engine: plays many games with random legal
// moves and checks board invariants after every action.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Engine } = require('../js/engine.js');
const { LEVELS } = require('../js/levels.js');

function check(e, where) {
  const ids = new Set();
  for (let r = 0; r < e.rows; r++) for (let c = 0; c < e.cols; c++) {
    const cl = e.cells[r][c];
    if (!cl.p) {
      if (cl.tile || cl.block) throw new Error(`${where}: content in hole ${c},${r}`);
      continue;
    }
    if (cl.tile && cl.block) throw new Error(`${where}: tile+block at ${c},${r}`);
    if (cl.tile) {
      if (ids.has(cl.tile.id)) throw new Error(`${where}: duplicate tile id ${cl.tile.id}`);
      ids.add(cl.tile.id);
      if (cl.tile.k === 'n' && !e.colors.includes(cl.tile.col)) throw new Error(`${where}: bad color ${cl.tile.col}`);
    }
    if (cl.tape && !cl.tile) throw new Error(`${where}: tape without tile at ${c},${r}`);
  }
  if (e.status === 'playing' && e._findGroups().length) throw new Error(`${where}: unresolved match at rest`);
}

let games = 0, actions = 0, empties = 0;
const t0 = Date.now();
for (const L of LEVELS) {
  for (let g = 0; g < 25; g++) {
    const e = new Engine(L, 1000 + g * 7919 + L.id);
    check(e, `L${L.id} init`);
    let guard = 0;
    while (e.status === 'playing' && guard++ < 400) {
      const moves = e.findMoves();
      let res;
      const roll = e.rand();
      if (roll < 0.04) {
        const types = ['hammer', 'row', 'col', 'shuffle'];
        const type = types[Math.floor(Math.random() * 4)];
        res = e.booster(type, { c: Math.floor(Math.random() * e.cols), r: Math.floor(Math.random() * e.rows) });
      } else if (moves.length) {
        const mv = moves[Math.floor(Math.random() * moves.length)];
        res = mv.t === 'tap' ? e.tap(mv) : e.swap(mv.a, mv.b);
        if (!res.ok) throw new Error(`L${L.id}: legal move rejected ${JSON.stringify(mv)}`);
      } else {
        throw new Error(`L${L.id}: no moves at rest`);
      }
      actions++;
      check(e, `L${L.id} action ${guard}`);
      // count empty playable cells at rest (refill gaps)
      for (let r = 0; r < e.rows; r++) for (let c = 0; c < e.cols; c++) {
        const cl = e.cells[r][c];
        if (cl.p && !cl.block && !cl.tile) empties++;
      }
    }
    if (e.status === 'won') {
      const enc = e.encore();
      check({ ...e, status: 'x', _findGroups: () => [] }, `L${L.id} encore`);
      if (!enc.events.length) throw new Error('empty encore');
    }
    games++;
  }
}
console.log(`ok: ${games} games, ${actions} actions, ${empties} empty cells at rest, ${Date.now() - t0}ms`);
