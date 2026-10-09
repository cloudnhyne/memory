// Builds js/levels.js: 100 story levels and a pool of Daily Cypher levels.
//
// Each level is written below as a short spec (board shape, obstacle patterns,
// goals). This script turns the specs into board strings, checks every layout
// can refill, then plays each level with the greedy bot to set its move count
// so the difficulty follows a curve (easy intros, hard spikes, bosses).
//
//   node tools/makelevels.mjs            build and calibrate everything (a few minutes)
//   node tools/makelevels.mjs 12 13 40   recalibrate only these levels, keep the rest
//   node tools/makelevels.mjs --lint     only build and lint, keep existing move counts
//
// After editing a spec, rerun the script; js/levels.js is generated, so edit specs here.
import { createRequire } from 'module';
import { writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { cpus } from 'os';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const { Engine } = require('../js/engine.js');

// ------------------------------------------------------------------ shapes
// '.' a cell, '-' a hole. Boards are at most 7 wide and 8 tall so pieces stay big on phones.
const rect = (w, h) => Array.from({ length: h }, () => '.'.repeat(w));
const SHAPES = {
  s6x6: rect(6, 6), s6x7: rect(6, 7), s6x8: rect(6, 8), s7x7: rect(7, 7), s7x8: rect(7, 8),
  oct7: ['--...--', '-.....-', '.......', '.......', '.......', '-.....-', '--...--'],
  oct78: ['--...--', '-.....-', '.......', '.......', '.......', '.......', '-.....-', '--...--'],
  heart: ['-..-..-', '.......', '.......', '.......', '-.....-', '--...--', '---.---'],
  hour: ['.......', '.......', '-.....-', '--...--', '--...--', '-.....-', '.......', '.......'],
  donut: ['.......', '.......', '..---..', '..---..', '..---..', '.......', '.......'],
  towers: ['...-...', '...-...', '...-...', '.......', '.......', '.......', '.......', '.......'],
  pillar: ['.......', '.......', '.......', '...-...', '...-...', '.......', '.......', '.......'],
  cup: ['.......', '.......', '-.....-', '-.....-', '-.....-', '-.....-', '--...--'],
  cross: ['--...--', '--...--', '.......', '.......', '.......', '--...--', '--...--'],
  stairs: ['---....', '--.....', '-......', '.......', '.......', '......-', '.....--', '....---'],
  crownS: ['.-.-.-.', '.......', '.......', '.......', '.......', '.......', '.......', '.......'],
  arch: ['.......', '.......', '.......', '.......', '.......', '.......', '..---..', '..---..'],
};

// --------------------------------------------------------------- patterns
// Pattern functions pick cells by position: (c, r, W, H) => boolean.
const P = {
  all: () => true,
  rows: (a, b = a) => (c, r) => r >= a && r <= b,
  cols: (...cs) => (c, r, W) => cs.some((x) => x === c || W - 1 - x === c), // mirrored
  border: (c, r, W, H) => c === 0 || r === 0 || c === W - 1 || r === H - 1,
  ring: (k) => (c, r, W, H) => c >= k && r >= k && c <= W - 1 - k && r <= H - 1 - k && (c === k || r === k || c === W - 1 - k || r === H - 1 - k),
  inner: (k) => (c, r, W, H) => c >= k && r >= k && c <= W - 1 - k && r <= H - 1 - k,
  top: (k) => (c, r) => r < k,
  bottom: (k) => (c, r, W, H) => r >= H - k,
  center: (w, h) => (c, r, W, H) => {
    const x0 = Math.floor((W - w) / 2), y0 = Math.floor((H - h) / 2);
    return c >= x0 && c < x0 + w && r >= y0 && r < y0 + h;
  },
  corners: (k) => (c, r, W, H) => (c < k || c >= W - k) && (r < k || r >= H - k),
  checker: (p = 0) => (c, r) => (c + r) % 2 === p,
  dots: (c, r) => c % 2 === 1 && r % 2 === 1,
  diag: (c, r, W, H) => {
    const x = Math.round((r * (W - 1)) / (H - 1));
    return c === x || c === W - 1 - x;
  },
  pts: (...list) => (c, r, W) => list.some(([x, y]) => y === r && (x === c || W - 1 - x === c)), // mirrored
  and: (...fs) => (c, r, W, H) => fs.every((f) => f(c, r, W, H)),
  or: (...fs) => (c, r, W, H) => fs.some((f) => f(c, r, W, H)),
  not: (f) => (c, r, W, H) => !f(c, r, W, H),
};

// ------------------------------------------------------------------- goals
const col = (color, count) => ({ type: 'color', color, count });
const crate = () => ({ type: 'crate' });
const floor = () => ({ type: 'floor' });
const tape = () => ({ type: 'tape' });
const stat = () => ({ type: 'static' });
const crown = () => ({ type: 'crown' });
const boss = () => ({ type: 'boss' });

const C4a = [0, 2, 3, 4], C4b = [0, 1, 3, 4];
const C5a = [0, 1, 2, 3, 4], C5b = [0, 2, 3, 4, 5], C5c = [0, 1, 2, 4, 5], C5d = [1, 2, 3, 4, 5], C5e = [0, 1, 3, 4, 5];
const C6 = [0, 1, 2, 3, 4, 5];
const KKK = ['..KKK..', '..KKK..'];
const crowns = (total, max = 1, gap = 3) => ({ total, max, gap });

// ------------------------------------------------------------------- specs
// blocks: [[pattern, char], ...] placed on open cells ('1' '2' '3' crates, 'S' static)
// floor:  [[pattern, '1' | '2'], ...]   tape: pattern   preset: rows laid over the top-left
// gold: first clear gives a free life. hard: 1 hard, 2 super hard.
const SPECS = [
  // ---------------- Chapter 1: The Block Party (King Flow) ----------------
  { id: 1, name: 'First Beat', shape: 's6x7', colors: C4a, goals: [col(0, 24)],
    preset: ['......', '..G...', '.GRY..', '.RBR..'],
    tutorial: [{ do: 'swap', a: { c: 2, r: 2 }, b: { c: 2, r: 3 }, text: 'Swipe the mic down to line up 3 in a row.' }] },
  { id: 2, name: 'Spray It Loud', shape: 's6x7', colors: C4a, goals: [col(4, 26), col(3, 24)], intro: 'spray',
    preset: ['......', '......', '...G..', '..GBR.', 'RBBYB.'],
    tutorial: [
      { do: 'swap', a: { c: 3, r: 3 }, b: { c: 3, r: 4 }, expect: { pw: 'h', c: 3, r: 4 }, text: 'Line up 4 headphones to make a Spray Can.' },
      { do: 'tap', at: { c: 3, r: 4 }, text: 'Tap the Spray Can to tag the whole row.' },
    ] },
  { id: 3, name: 'Light the Floor', shape: 's6x7', colors: C4b, goals: [floor()], intro: 'floor',
    floor: [[P.all, '1']] },
  { id: 4, name: 'Drop the Bass', shape: 's7x8', colors: [0, 1, 2, 3, 5], goals: [floor(), col(2, 20)], intro: 'boombox',
    preset: ['.......', '...G...', '...P...', '...PR..', 'YPPOPY.', '...RG..'],
    floor: [[P.or(P.corners(2), P.bottom(1)), '1']],
    tutorial: [
      { do: 'swap', a: { c: 4, r: 4 }, b: { c: 3, r: 4 }, expect: { pw: 'x', c: 3, r: 4 }, text: 'Match in an L or T shape to build a Boombox.' },
      { do: 'tap', at: { c: 3, r: 4 }, text: 'Tap the Boombox to drop the bass!' },
    ] },
  { id: 5, name: 'Block Party', shape: 's6x7', colors: C4b, goals: [col(0, 34), col(1, 34)], gold: true },
  { id: 6, name: 'Go Platinum', shape: 's7x8', colors: C5b, goals: [col(5, 30), col(4, 22)], intro: 'platinum',
    preset: ['.......', '.......', '.......', '...G...', '..GYB..', 'BYYRYYG', '...P...'],
    tutorial: [
      { do: 'swap', a: { c: 3, r: 4 }, b: { c: 3, r: 5 }, expect: { pw: 'd', c: 3, r: 5 }, text: 'Line up 5 to go Platinum!' },
      { do: 'swap', a: { c: 3, r: 5 }, b: { c: 3, r: 6 }, text: 'Swap the Platinum Record with a cassette to clear every cassette.' },
    ] },
  { id: 7, name: 'Turn It Up', shape: 's6x7', colors: C4a, goals: [floor(), col(3, 30)],
    floor: [[P.or(P.center(4, 5), P.top(1)), '1']] },
  { id: 8, name: 'Flyer Drop', shape: 's7x8', colors: C5b, goals: [col(3, 22), floor()], intro: 'flyer',
    preset: ['.......', '.......', '.......', '.......', '.......', '..YB...', '.RGGP..', '.BGRGY.'],
    floor: [[P.top(2), '1']],
    tutorial: [
      { do: 'swap', a: { c: 4, r: 7 }, b: { c: 3, r: 7 }, expect: { pw: 'pl', c: 3, r: 7 }, text: 'Match 4 in a square to fold a Flyer.' },
      { do: 'tap', at: { c: 3, r: 7 }, text: 'Tap the Flyer. It flies straight to what you need.' },
    ] },
  { id: 9, name: 'Mic Check', shape: 'oct7', colors: C5a, goals: [floor(), col(0, 22)], hard: 1, floor: [[P.all, '1']] },
  { id: 10, name: 'Fresh Kicks', shape: 's6x8', colors: C5a, goals: [col(1, 30), col(2, 26)] },
  { id: 11, name: 'Crate Digging', shape: 's6x7', colors: C5a, goals: [crate()], intro: 'crate',
    blocks: [[P.or(P.and(P.bottom(3), P.checker(0)), P.pts([2, 2])), '1']] },
  { id: 12, name: 'Stack It Up', shape: 's6x8', colors: C5a, goals: [crate(), col(4, 28)],
    blocks: [[P.and(P.rows(3, 5), P.checker(0)), '1']] },
  { id: 13, name: 'Corner Store', shape: 'cup', colors: C5a, goals: [crate(), floor()],
    blocks: [[P.pts([0, 1], [1, 3], [2, 5]), '1']], floor: [[P.rows(2, 6), '1']] },
  { id: 14, name: 'Combo Moves', shape: 's7x7', colors: C5a, goals: [floor(), col(4, 20)], intro: 'combo',
    preset: ['.......', '.......', '.......', '.......', '...hv..'],
    floor: [[P.inner(1), '1']],
    tutorial: [{ do: 'swap', a: { c: 3, r: 4 }, b: { c: 4, r: 4 }, text: 'Swap two power-ups together for a combo!' }] },
  { id: 15, name: 'Golden Hour', shape: 'heart', colors: C5c, goals: [col(0, 26), col(5, 22)], gold: true },
  { id: 16, name: 'Double Up', shape: 's6x8', colors: C5a, goals: [crate()],
    blocks: [[P.and(P.rows(2, 5), P.cols(0)), '2']] },
  { id: 17, name: 'Speaker Stack', shape: 'towers', colors: C5a, goals: [crate(), col(3, 22)],
    blocks: [[P.and(P.rows(4, 5), P.cols(0, 2)), '1']] },
  { id: 18, name: 'Night Shift', shape: 's7x8', colors: C5a, goals: [crate(), floor()], hard: 1,
    blocks: [[P.and(P.rows(1, 2), P.checker(1)), '2']], floor: [[P.bottom(3), '1']] },
  { id: 19, name: 'Last Call', shape: 'oct78', colors: C5a, goals: [crate(), floor(), col(0, 24)],
    blocks: [[P.pts([1, 2], [3, 3], [0, 4]), '1']], floor: [[P.and(P.rows(5, 6), P.inner(1)), '1']] },
  { id: 20, name: 'Baron Buzzkill', shape: 's7x8', colors: C5a, goals: [boss()], hard: 1, intro: 'boss',
    preset: KKK, boss: { kind: 'buzzkill', hp: 18, every: 4, attack: 'crate', count: 2 } },

  // ---------------- Chapter 2: The Record Shop (DJ Duchess) ----------------
  { id: 21, name: 'Back in the Shop', shape: 's6x8', colors: C5a, goals: [crate(), col(1, 26)],
    blocks: [[P.pts([0, 3], [1, 4], [2, 5]), '2']] },
  { id: 22, name: 'B Side', shape: 'donut', colors: C5b, goals: [crate(), col(5, 20)],
    blocks: [[P.pts([1, 2], [1, 3], [1, 4]), '1'], [P.pts([3, 6]), '2']] },
  { id: 23, name: 'Taped Up', shape: 's6x7', colors: C5a, goals: [tape(), col(0, 16)], intro: 'tape', tape: P.diag },
  { id: 24, name: 'Rewind', shape: 's7x7', colors: C5c, goals: [tape(), col(2, 26)], tape: P.and(P.ring(1), P.checker(0)) },
  { id: 25, name: 'Gold Record', shape: 'oct78', colors: C5b, goals: [floor(), col(2, 26)], gold: true,
    floor: [[P.inner(1), '1']] },
  { id: 26, name: 'Needle Drop', shape: 's7x8', colors: C5a, goals: [crate(), tape()],
    blocks: [[P.and(P.rows(2, 3), P.checker(0)), '2']], tape: P.bottom(1) },
  { id: 27, name: 'Crown Run', shape: 's6x8', colors: C5a, goals: [crown()], intro: 'crown',
    preset: ['..C...'], crowns: crowns(3) },
  { id: 28, name: 'Vinyl Vault', shape: 's7x8', colors: C5a, goals: [crown(), crate()], hard: 1, crowns: crowns(3),
    blocks: [[P.pts([0, 3], [2, 4], [1, 6]), '1']] },
  { id: 29, name: 'Mixtape Maze', shape: 'pillar', colors: C5a, goals: [crown(), col(4, 18)], crowns: crowns(3) },
  { id: 30, name: 'Liner Notes', shape: 's7x7', colors: C5d, goals: [tape(), floor()],
    tape: P.and(P.inner(1), P.dots), floor: [[P.border, '1']] },
  { id: 31, name: 'Triple Crates', shape: 's6x8', colors: C5a, goals: [crate()],
    blocks: [[P.pts([0, 2], [2, 4]), '3'], [P.pts([1, 6], [0, 5]), '2']] },
  { id: 32, name: 'Crate Wall', shape: 's7x8', colors: C5b, goals: [crate(), col(3, 28)],
    blocks: [[P.and(P.rows(3), P.checker(1)), '2'], [P.and(P.rows(5), P.checker(0)), '1']] },
  { id: 33, name: 'Deep Cuts', shape: 'cup', colors: C5a, goals: [crate(), tape()], hard: 1,
    blocks: [[P.pts([1, 4], [3, 5]), '3']], tape: P.and(P.top(2), P.checker(0)) },
  { id: 34, name: 'Album Wall', shape: 's7x8', colors: C5c, goals: [floor(), crate()],
    floor: [[P.top(3), '1']], blocks: [[P.pts([0, 5], [2, 6], [3, 4]), '1']] },
  { id: 35, name: 'Gold Plaque', shape: 's7x8', colors: C5a, goals: [col(0, 32), col(2, 32), col(4, 32)], gold: true },
  { id: 36, name: 'Spin Cycle', shape: 'oct78', colors: C5a, goals: [crown(), crate()], crowns: crowns(3),
    blocks: [[P.pts([1, 4], [2, 5]), '1']] },
  { id: 37, name: 'Sample Hunt', shape: 's7x8', colors: C5d, goals: [crown(), tape()], hard: 1, crowns: crowns(4),
    tape: P.and(P.rows(4, 5), P.checker(1)) },
  { id: 38, name: 'Locked Groove', shape: 's7x8', colors: C5a, goals: [crown(), crate(), tape()], hard: 2, crowns: crowns(2, 1, 4),
    blocks: [[P.pts([0, 3], [3, 4]), '3'], [P.pts([1, 5]), '2']], tape: P.and(P.top(2), P.checker(0)) },
  { id: 39, name: 'Listening Party', shape: 'heart', colors: C5b, goals: [floor(), col(5, 18)], floor: [[P.all, '1']] },
  { id: 40, name: 'Lady Lip-Sync', shape: 's7x8', colors: C5a, goals: [boss()], hard: 1,
    preset: KKK, boss: { kind: 'lipsync', hp: 24, every: 3, attack: 'tape', count: 3 } },

  // ---------------- Chapter 3: The Blacktop (Prince Breaks) ----------------
  { id: 41, name: 'Hit the Court', shape: 's7x8', colors: C5a, goals: [floor(), col(1, 28)], floor: [[P.inner(1), '1']] },
  { id: 42, name: 'Cardboard Cypher', shape: 's7x7', colors: C5a, goals: [floor()], floor: [[P.inner(1), '2']] },
  { id: 43, name: 'Fast Break', shape: 'hour', colors: C5a, goals: [col(3, 24), col(4, 24)] },
  { id: 44, name: 'Crossover', shape: 'cross', colors: C5c, goals: [floor(), crate()],
    floor: [[P.rows(2, 4), '1']], blocks: [[P.pts([2, 0], [2, 6]), '2']] },
  { id: 45, name: 'Gold Chain', shape: 's6x8', colors: C4a, goals: [col(2, 54)], gold: true },
  { id: 46, name: 'Bleacher Seats', shape: 'stairs', colors: C5a, goals: [crate(), col(0, 28)],
    blocks: [[P.and(P.bottom(3), P.checker(0)), '1']] },
  { id: 47, name: 'Pick and Roll', shape: 's7x8', colors: C5b, goals: [crown(), floor()], crowns: crowns(3),
    floor: [[P.bottom(2), '1']] },
  { id: 48, name: 'Full Court Press', shape: 's7x8', colors: C5a, goals: [crate(), floor()], hard: 1,
    blocks: [[P.and(P.rows(2, 3), P.checker(0)), '2']], floor: [[P.bottom(3), '2']] },
  { id: 49, name: 'Freeze Frame', shape: 's7x8', colors: C5d, goals: [crown(), tape()], crowns: crowns(3), tape: P.diag },
  { id: 50, name: 'Halftime Show', shape: 'oct78', colors: C5a, goals: [floor(), col(4, 18)], floor: [[P.all, '2']] },
  { id: 51, name: 'Windmill', shape: 's7x8', colors: C5a, goals: [crown(), crate()], crowns: crowns(3),
    blocks: [[P.pts([1, 2], [2, 3], [2, 5], [1, 6]), '1']] },
  { id: 52, name: 'Six Step', shape: 's7x8', colors: C5c, goals: [tape(), crate()], hard: 1,
    tape: P.and(P.inner(1), P.checker(0)), blocks: [[P.pts([3, 3]), '3'], [P.pts([1, 5]), '2']] },
  { id: 53, name: 'Head Spin', shape: 'oct7', colors: C5b, goals: [floor()], floor: [[P.all, '1'], [P.ring(1), '2']] },
  { id: 54, name: 'Toprock', shape: 's7x8', colors: C5a, goals: [crown(), col(0, 18)], crowns: crowns(4, 2, 2) },
  { id: 55, name: 'Golden Kicks', shape: 's7x8', colors: C5e, goals: [col(1, 30), col(3, 30)], gold: true },
  { id: 56, name: 'Power Move', shape: 's7x8', colors: C5a, goals: [crate()],
    blocks: [[P.pts([0, 4], [2, 4], [1, 6], [3, 6]), '3']] },
  { id: 57, name: 'Battle Ready', shape: 's7x8', colors: C5b, goals: [floor(), tape(), crate()], hard: 1,
    floor: [[P.top(3), '2']], tape: P.and(P.bottom(2), P.checker(0)), blocks: [[P.pts([1, 4]), '2']] },
  { id: 58, name: 'Breakers Circle', shape: 'donut', colors: C5a, goals: [crown(), floor(), crate()], hard: 2, crowns: crowns(2),
    floor: [[P.border, '1']], blocks: [[P.pts([1, 2], [1, 4]), '2']] },
  { id: 59, name: 'Street Lights', shape: 'towers', colors: C5a, goals: [crown(), floor()], crowns: crowns(3),
    floor: [[P.bottom(3), '1']] },
  { id: 60, name: 'Buzzkill Remix', shape: 's7x8', colors: C5a, goals: [boss()], hard: 1,
    preset: KKK, blocks: [[P.pts([0, 4], [1, 6]), '1']], boss: { kind: 'buzzkill', hp: 28, every: 3, attack: 'crate', count: 3 } },

  // ---------------- Chapter 4: The Wall (Countess Canvas) ----------------
  { id: 61, name: 'Blank Canvas', shape: 's7x8', colors: C5a, goals: [floor(), col(3, 26)], floor: [[P.all, '1']] },
  { id: 62, name: 'Static Spreads', shape: 's6x8', colors: C5a, goals: [stat(), col(3, 18)], spread: true, intro: 'static',
    blocks: [[P.and(P.bottom(3), P.checker(0)), 'S']] },
  { id: 63, name: 'Outline', shape: 's7x8', colors: C5b, goals: [stat(), col(5, 28)], spread: true,
    blocks: [[P.pts([0, 7], [1, 6], [0, 5], [2, 7]), 'S']] },
  { id: 64, name: 'Fill In', shape: 's7x7', colors: C5a, goals: [stat(), floor()], spread: true,
    blocks: [[P.pts([2, 2], [3, 3], [2, 4]), 'S']], floor: [[P.border, '1']] },
  { id: 65, name: 'Gold Leaf', shape: 'heart', colors: C5a, goals: [col(2, 30), col(0, 24)], gold: true },
  { id: 66, name: 'Drip Effect', shape: 's7x8', colors: C5c, goals: [stat(), crate()], spread: true,
    blocks: [[P.and(P.bottom(3), P.checker(1)), 'S'], [P.pts([1, 2], [3, 2]), '3']] },
  { id: 67, name: 'Wildstyle', shape: 's7x8', colors: C5a, goals: [stat(), tape()], spread: true,
    blocks: [[P.pts([0, 4], [1, 5], [0, 6], [2, 6]), 'S']], tape: P.and(P.rows(1, 3), P.checker(0)) },
  { id: 68, name: 'Subway Car', shape: 's7x8', colors: C5b, goals: [crown(), stat()], hard: 1, spread: true, crowns: crowns(3),
    blocks: [[P.and(P.bottom(1), P.checker(0)), 'S']] },
  { id: 69, name: 'Spray Pattern', shape: 's7x8', colors: C5a, goals: [floor()], floor: [[P.checker(0), '2']] },
  { id: 70, name: 'Tag Team', shape: 's7x8', colors: C5a, goals: [stat(), crate()], spread: true,
    blocks: [[P.pts([3, 3], [3, 6]), 'S'], [P.pts([0, 2], [1, 5], [2, 1]), '3']] },
  { id: 71, name: 'Mural Day', shape: 'oct78', colors: C5d, goals: [floor(), col(5, 20)], floor: [[P.all, '1']] },
  { id: 72, name: 'Night Painters', shape: 's7x8', colors: C5a, goals: [stat(), col(0, 26)], hard: 1, spread: true,
    blocks: [[P.and(P.rows(3, 7), P.checker(0)), 'S']] },
  { id: 73, name: 'Color Burst', shape: 's7x8', colors: C5a, goals: [col(0, 30), col(1, 30), col(3, 30)] },
  { id: 74, name: 'Stencil', shape: 'cross', colors: C5a, goals: [tape(), floor()],
    tape: P.and(P.rows(2, 4), P.checker(0)), floor: [[P.all, '1']] },
  { id: 75, name: 'Golden Wall', shape: 's7x8', colors: C5b, goals: [floor(), col(5, 30)], gold: true, floor: [[P.inner(1), '1']] },
  { id: 76, name: 'Paint Cans', shape: 's7x8', colors: C5a, goals: [crate(), stat()], spread: true,
    blocks: [[P.pts([1, 3], [2, 5]), '3'], [P.and(P.bottom(2), P.checker(0)), 'S']] },
  { id: 77, name: 'Masterpiece', shape: 's7x8', colors: C5c, goals: [stat(), floor()], hard: 1, spread: true,
    blocks: [[P.pts([0, 3], [3, 3], [1, 5]), 'S']], floor: [[P.bottom(2), '2']] },
  { id: 78, name: 'Static Storm', shape: 's7x8', colors: C5a, goals: [stat(), floor()], hard: 2, spread: true,
    blocks: [[P.and(P.bottom(4), P.checker(1)), 'S']], floor: [[P.top(2), '1']] },
  { id: 79, name: 'Final Coat', shape: 'pillar', colors: C5a, goals: [crown(), stat()], spread: true, crowns: crowns(3),
    blocks: [[P.pts([0, 5], [1, 6]), 'S']] },
  { id: 80, name: 'Lip-Sync Encore', shape: 's7x8', colors: C5a, goals: [boss(), floor()], hard: 1,
    preset: KKK, floor: [[P.bottom(2), '1']], boss: { kind: 'lipsync', hp: 30, every: 3, attack: 'tape', count: 3 } },

  // ---------------- Chapter 5: The Crown Arena (Queen Cadence) ----------------
  { id: 81, name: 'Arena Gates', shape: 's7x8', colors: C5a, goals: [crate(), floor()],
    blocks: [[P.pts([0, 3], [2, 3], [1, 5]), '3']], floor: [[P.and(P.bottom(3), P.inner(1)), '2']] },
  { id: 82, name: 'Soundcheck', shape: 's7x8', colors: C5e, goals: [col(0, 32), col(4, 32)] },
  { id: 83, name: 'Spotlight', shape: 'oct78', colors: C5a, goals: [floor(), tape()], hard: 1,
    floor: [[P.all, '2']], tape: P.and(P.ring(1), P.checker(1)) },
  { id: 84, name: 'Crowd Wave', shape: 's7x8', colors: C5a, goals: [crown(), col(1, 16)], crowns: crowns(4, 2, 2) },
  { id: 85, name: 'Gold Mic', shape: 's7x8', colors: C5a, goals: [col(0, 40)], gold: true },
  { id: 86, name: 'Backstage', shape: 's7x8', colors: C5b, goals: [crate(), tape()],
    blocks: [[P.pts([1, 3], [3, 2], [0, 5]), '3']], tape: P.and(P.bottom(2), P.checker(0)) },
  { id: 87, name: 'Light Rig', shape: 's7x8', colors: C5a, goals: [floor(), stat()], spread: true,
    floor: [[P.top(4), '1']], blocks: [[P.and(P.bottom(2), P.checker(0)), 'S']] },
  { id: 88, name: 'Encore Please', shape: 's7x8', colors: C5a, goals: [crown(), crate()], hard: 1, crowns: crowns(3),
    blocks: [[P.and(P.rows(3), P.checker(1)), '2'], [P.pts([3, 1]), '1']] },
  { id: 89, name: 'Main Stage', shape: 'arch', colors: C5a, goals: [floor(), col(2, 16)], floor: [[P.all, '1'], [P.bottom(2), '2']] },
  { id: 90, name: 'Hype Man', shape: 's7x8', colors: C5c, goals: [crown(), stat()], spread: true, crowns: crowns(3),
    blocks: [[P.pts([0, 6], [1, 7], [2, 6], [3, 7]), 'S']] },
  { id: 91, name: 'All Elements', shape: 's7x8', colors: C5a, goals: [crown(), floor(), crate()], crowns: crowns(2),
    floor: [[P.center(3, 2), '2']], blocks: [[P.pts([0, 4], [1, 6]), '2']] },
  { id: 92, name: 'Mic Stand', shape: 's7x8', colors: C5a, goals: [tape(), stat(), col(4, 24)], hard: 1, spread: true,
    tape: P.and(P.top(3), P.checker(0)), blocks: [[P.and(P.bottom(3), P.checker(0)), 'S']] },
  { id: 93, name: 'Front Row', shape: 's7x8', colors: C6, goals: [col(2, 20), col(4, 20), col(5, 20)] },
  { id: 94, name: 'Throne Room', shape: 'crownS', colors: C5a, goals: [crown(), floor()], crowns: crowns(3),
    floor: [[P.bottom(3), '2']] },
  { id: 95, name: 'Golden Throne', shape: 's7x8', colors: C5a, goals: [floor()], gold: true, floor: [[P.all, '1']] },
  { id: 96, name: 'The Cypher', shape: 'donut', colors: C5a, goals: [floor(), crate(), stat()], spread: true,
    floor: [[P.border, '1']], blocks: [[P.pts([1, 1]), '3'], [P.pts([3, 6]), 'S']] },
  { id: 97, name: 'Royal Court', shape: 's7x8', colors: C5a, goals: [crate(), stat()], hard: 1, spread: true,
    blocks: [[P.pts([0, 2], [2, 2], [1, 4]), '3'], [P.and(P.bottom(3), P.checker(0)), 'S']] },
  { id: 98, name: 'Static Surge', shape: 's7x8', colors: C5a, goals: [stat(), floor()], hard: 2, spread: true,
    blocks: [[P.and(P.rows(2, 7), P.checker(0)), 'S']], floor: [[P.top(2), '2']] },
  { id: 99, name: 'Crown Ceremony', shape: 'crownS', colors: C5a, goals: [crown(), floor()], crowns: crowns(4),
    floor: [[P.bottom(2), '1']] },
  { id: 100, name: 'King Static', shape: 's7x8', colors: C5a, goals: [boss()], hard: 2, spread: true,
    preset: ['..KKK..', '..KKK..', '..KKK..'], boss: { kind: 'static', hp: 36, every: 3, attack: 'static', count: 2 } },
];

// ------------------------------------------------------- daily cypher pool
// One of these plays each day. They are built from a seeded mix of shapes and
// goal recipes, then calibrated like the story levels.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const DAILY_NAMES = ['Morning Cypher', 'Block Cypher', 'Freestyle Friday', 'Open Mic', 'Rooftop Session', 'Corner Cypher',
  'Late Night Set', 'Sunday Jam', 'Park Jam', 'Stoop Session', 'Beat Battle', 'Crate Session', 'Boom Bap Break',
  'Golden Era', 'Sample Day', 'Dance Break', 'Tag Day', 'Mixtape Monday', 'Throwback Thursday', 'Cookout Cypher',
  'Bus Stop Bars', 'Front Stoop', 'Summer Jam', 'Lunch Break Bars', 'Record Fair', 'Turntable Tuesday',
  'Wax Wednesday', 'Soundclash', 'Hometown Hero', 'Weekend Warmup'];
function dailySpecs() {
  const R = rng(20261009);
  const pick = (a) => a[Math.floor(R() * a.length)];
  const shapes = ['s6x7', 's6x8', 's7x7', 's7x8', 'oct78', 'hour', 'heart', 'cross', 'towers', 'pillar', 'crownS', 'cup'];
  const sets = [C5a, C5b, C5c, C5d, C5e];
  const recipes = [
    (cs) => ({ goals: [col(cs[0], 30), col(cs[2], 30)] }),
    (cs) => ({ goals: [crate(), col(cs[1], 26)], blocks: [[pick([P.and(P.rows(2, 3), P.checker(0)), P.pts([0, 3], [2, 5]), P.and(P.bottom(2), P.checker(1))]), pick(['1', '2'])]] }),
    (cs) => ({ goals: [floor(), col(cs[3], 24)], floor: [[pick([P.inner(1), P.bottom(3), P.top(3), P.border, P.center(3, 4)]), pick(['1', '1', '2'])]] }),
    () => ({ goals: [tape(), crate()], tape: pick([P.diag, P.and(P.ring(1), P.checker(0)), P.and(P.top(3), P.checker(0))]), blocks: [[P.pts([1, 4], [3, 5]), '2']] }),
    (cs) => ({ goals: [crown(), col(cs[4], 16)], crowns: crowns(3) }),
    () => ({ goals: [stat(), floor()], spread: true, blocks: [[P.and(P.bottom(3), P.checker(0)), 'S']], floor: [[P.top(3), '1']] }),
    () => ({ goals: [crate(), floor()], blocks: [[P.pts([0, 3], [2, 4], [1, 2]), '3']], floor: [[P.bottom(2), '2']] }),
    () => ({ goals: [crown(), floor()], crowns: crowns(2), floor: [[P.bottom(2), '2']] }),
  ];
  const out = [];
  for (let i = 0; i < DAILY_NAMES.length; i++) {
    const cs = pick(sets);
    const r = recipes[i % recipes.length](cs);
    out.push({ id: 1001 + i, name: DAILY_NAMES[i], shape: pick(shapes), colors: cs, daily: true, ...r });
  }
  return out;
}

// ----------------------------------------------------------------- builder
function build(spec) {
  const base = SHAPES[spec.shape];
  if (!base) throw new Error(`L${spec.id}: unknown shape ${spec.shape}`);
  const H = base.length, W = base[0].length;
  const board = base.map((row) => row.split(''));
  (spec.preset || []).forEach((row, r) => row.split('').forEach((ch, c) => { if (ch !== '.' && board[r][c] !== '-') board[r][c] = ch; }));
  for (const [f, ch] of spec.blocks || []) {
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (board[r][c] === '.' && f(c, r, W, H)) board[r][c] = ch;
  }
  const open = (c, r) => !['-', '1', '2', '3', 'S', 'K'].includes(board[r][c]);
  let floorRows = null;
  if (spec.floor) {
    const fl = Array.from({ length: H }, () => Array(W).fill('.'));
    for (const [f, ch] of spec.floor) {
      for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (open(c, r) && f(c, r, W, H)) fl[r][c] = ch;
    }
    floorRows = fl.map((r) => r.join(''));
  }
  let tapeRows = null;
  if (spec.tape) {
    tapeRows = Array.from({ length: H }, (_, r) => Array.from({ length: W }, (_, c) => (open(c, r) && board[r][c] === '.' && spec.tape(c, r, W, H) ? 'x' : '.')).join(''));
  }
  const L = { id: spec.id, name: spec.name, moves: spec.moves || 20, colors: spec.colors };
  if (spec.hard) L.hard = spec.hard;
  if (spec.gold) L.gold = true;
  if (spec.daily) L.daily = true;
  if (spec.spread) L.spread = true;
  L.goals = spec.goals;
  if (spec.intro) L.intro = spec.intro;
  if (spec.crowns) L.crowns = spec.crowns;
  if (spec.boss) L.boss = spec.boss;
  L.board = board.map((r) => r.join(''));
  if (floorRows) L.floor = floorRows;
  if (tapeRows) L.tape = tapeRows;
  if (spec.tutorial) L.tutorial = spec.tutorial;
  return L;
}

function lint(L) {
  const warn = [];
  let e;
  try { e = new Engine(L, 7); } catch (err) { return ['engine error: ' + err.message]; }
  const fill = e._fillMap();
  for (let r = 0; r < e.rows; r++) for (let c = 0; c < e.cols; c++) {
    if (e.cells[r][c].p && !fill[r][c]) warn.push(`cell ${c},${r} can never refill`);
  }
  if (e.cols > 7 || e.rows > 8) warn.push(`board is ${e.cols}x${e.rows}, max 7x8`);
  for (const g of e.goals) if (!g.need) warn.push(`goal ${g.type} has nothing to do`);
  if (L.tutorial && !e._tutorialOk()) warn.push('tutorial moves do not work on this board');
  return warn;
}

// The bot's target win rate. Humans also have boosters and +5 moves.
function target(L) {
  if (L.boss) return L.id === 100 ? 0.55 : 0.62;
  if (L.hard === 2) return 0.5;
  if (L.hard) return 0.66;
  if (L.daily) return 0.8;
  if (L.tutorial || L.intro) return 0.95;
  if (L.gold) return 0.9;
  if (L.id <= 20) return 0.9;
  if (L.id <= 60) return 0.84;
  return 0.8;
}

// ---------------------------------------------------------------- the bot
const PW_VALUE = { h: 3, v: 3, pl: 3, x: 4, d: 6 };
function progress(e) {
  let s = 0;
  for (const g of e.goals) s += Math.max(-1, (g.need - g.left) / Math.max(1, g.need));
  return s;
}
function shapeScore(e) {
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
  e.rs = (Math.random() * 4294967296) >>> 0;
  if (mv.t === 'tap') e.tap(mv); else e.swap(mv.a, mv.b);
  if (e.status === 'won') return 1e6 + e.moves;
  return (progress(e) - progress(e0)) * 100 + shapeScore(e) + Math.random() * 0.05;
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
    if (!best) break;
    if (best.t === 'tap') e.tap(best); else e.swap(best.a, best.b);
  }
  return { won: e.status === 'won', left: e.moves };
}
const winRate = (L, moves, n, salt) => {
  let w = 0;
  for (let g = 0; g < n; g++) if (play({ ...L, moves }, 77 + g * 104729 + L.id * 31 + salt).won) w++;
  return w / n;
};
function calibrate(L) {
  const t = target(L);
  const used = [];
  for (let g = 0; g < 70; g++) {
    const res = play({ ...L, moves: 120 }, 9000 + g * 7717 + L.id * 13);
    used.push(res.won ? 120 - res.left : 999);
  }
  used.sort((a, b) => a - b);
  let m = used[Math.min(used.length - 1, Math.ceil(t * used.length) - 1)];
  const floorMoves = L.id <= 20 ? 15 : 14;
  m = Math.max(10, Math.min(40, m));
  // check at the real budget (the bot spends power-ups sooner when moves run low)
  let w = winRate(L, m, 70, 1);
  for (let i = 0; i < 4 && w < t - 0.07 && m < 45; i++) { m++; w = winRate(L, m, 70, 2 + i); }
  for (let i = 0; i < 4 && w > t + 0.08 && m > 10; i++) {
    const w2 = winRate(L, m - 1, 70, 9 + i);
    if (w2 < t - 0.04) break;
    m--; w = w2;
  }
  return { id: L.id, moves: Math.max(m, floorMoves), win: w, target: t, p50: used[used.length >> 1] };
}

// ----------------------------------------------------------------- workers
if (!isMainThread) {
  for (const L of workerData.levels) parentPort.postMessage(calibrate(L));
  process.exit(0);
}

const args = process.argv.slice(2);
const lintOnly = args.includes('--lint');
const only = args.filter((a) => /^\d+$/.test(a)).map(Number);

const levels = SPECS.map(build);
const daily = dailySpecs().map(build);
let bad = 0;
for (const L of [...levels, ...daily]) {
  const w = lint(L);
  if (w.length) { bad++; console.log(`L${L.id} ${L.name}: ${w.join('; ')}`); }
}
if (bad) { console.log(`${bad} level(s) failed lint`); process.exit(1); }
console.log(`lint ok: ${levels.length} levels, ${daily.length} daily`);

// keep move counts from the current file for levels we are not recalibrating
let prev = {};
try {
  const old = require('../js/levels.js');
  for (const L of [...(old.LEVELS || []), ...(old.DAILY || [])]) prev[L.id] = L.moves;
} catch (e) { prev = {}; }
const all = [...levels, ...daily];
const todo = lintOnly ? [] : all.filter((L) => (only.length ? only.includes(L.id) : true));
for (const L of all) if (!todo.includes(L) && prev[L.id]) L.moves = prev[L.id];

if (todo.length) {
  const n = Math.max(1, Math.min(cpus().length, 8));
  const buckets = Array.from({ length: n }, () => []);
  // spread the slow late levels across workers
  todo.slice().sort((a, b) => b.id - a.id).forEach((L, i) => buckets[i % n].push(L));
  const t0 = Date.now();
  let done = 0;
  await Promise.all(buckets.filter((b) => b.length).map((b) => new Promise((res, rej) => {
    const w = new Worker(fileURLToPath(import.meta.url), { workerData: { levels: b } });
    w.on('message', (r) => {
      const L = all.find((x) => x.id === r.id);
      L.moves = r.moves;
      done++;
      console.log(`${String(done).padStart(3)}/${todo.length} L${r.id} ${L.name.padEnd(18)} moves ${String(r.moves).padStart(2)}  bot win ${Math.round(r.win * 100)}% (target ${Math.round(r.target * 100)}%)  p50 ${r.p50}`);
    });
    w.on('error', rej);
    w.on('exit', res);
  })));
  console.log(`calibrated ${todo.length} in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}

// ------------------------------------------------------------------ output
const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
function val(v) {
  if (Array.isArray(v)) return `[${v.map(val).join(', ')}]`;
  if (v && typeof v === 'object') return `{ ${Object.entries(v).map(([k, x]) => `${k}: ${val(x)}`).join(', ')} }`;
  return typeof v === 'string' ? q(v) : String(v);
}
function fmt(L) {
  const head = ['id', 'name', 'moves', 'colors', 'hard', 'gold', 'daily', 'spread'].filter((k) => L[k] != null).map((k) => `${k}: ${val(L[k])}`).join(', ');
  const lines = [`    {`, `      ${head},`, `      goals: ${val(L.goals)},`];
  for (const k of ['intro', 'crowns', 'boss']) if (L[k]) lines.push(`      ${k}: ${val(L[k])},`);
  for (const k of ['board', 'floor', 'tape']) {
    if (!L[k]) continue;
    lines.push(`      ${k}: [`, ...L[k].map((r) => `        ${q(r)},`), '      ],');
  }
  if (L.tutorial) {
    lines.push('      tutorial: [', ...L.tutorial.map((s) => `        ${val(s)},`), '      ],');
  }
  lines.push('    },');
  return lines.join('\n');
}
const CH = ['The Block Party', 'The Record Shop', 'The Blacktop', 'The Wall', 'The Crown Arena'];
let body = '';
levels.forEach((L, i) => {
  if (i % 20 === 0) body += `\n    // ---------------- Chapter ${i / 20 + 1}: ${CH[i / 20]} (levels ${i + 1} to ${i + 20}) ----------------\n`;
  body += fmt(L) + '\n';
});
const out = `/*
 * Rhyme Kingdom: level definitions.
 * GENERATED by tools/makelevels.mjs. Edit the specs there and rerun it; it also
 * sets each level's move count by playing it with the balancing bot.
 *
 * board chars:  .  random tile        -  hole (not part of the board)
 *               R O Y G B P  preset tile (mic, sneaker, chain, cap, headphones, cassette)
 *               1 2 3  record crate with that many layers
 *               S  static (spreads when \`spread\` is on)
 *               C  crown        K  boss cell
 *               h v x p d  preset power-up (spray row, spray column, boombox, flyer, platinum)
 * floor:        1 / 2  dance-floor layers under the tile
 * tape:         x  the tile is taped in place
 * goals:        { type: color|crate|floor|tape|static|crown|boss, color?, count? }
 *               count is optional for board obstacles (defaults to everything on the board)
 * gold:         the first clear also gives a free life
 * tutorial:     forced moves at the start of the level, with an optional expected power-up
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RKLevels = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const LEVELS = [${body}  ];

  // Daily Cypher: one plays each day, free, with a life for the win.
  const DAILY = [
${daily.map(fmt).join('\n')}
  ];

  return { LEVELS, DAILY };
});
`;
writeFileSync(join(root, 'js', 'levels.js'), out);
console.log('wrote js/levels.js');
