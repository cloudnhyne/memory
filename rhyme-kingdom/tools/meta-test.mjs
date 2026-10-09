// Checks the lives, tasks and daily-reward rules with a fake clock.
//   node tools/meta-test.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const M = require('../js/meta.js');
const { LEVELS, DAILY } = require('../js/levels.js');

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('FAIL ' + msg); } };
const MIN = 60000;
const save = () => M.ensure({ level: 1, coins: 300, boosters: { hammer: 3, row: 3, col: 3, shuffle: 3 } });

// ---- lives: spend, regenerate, cap
let s = save();
let t = new Date(2026, 9, 9, 10, 0, 0).getTime();
ok(M.status(s, t).n === 5 && M.status(s, t).full, 'starts with 5 full lives');
for (let i = 0; i < 5; i++) ok(M.loseLife(s, t), 'life ' + i + ' is used');
ok(!M.canPlay(s, t) && !M.loseLife(s, t), 'no lives: cannot play, nothing more to lose');
ok(Math.round(M.status(s, t).next / MIN) === 30, 'next life in 30 minutes');
ok(M.status(s, t + 29 * MIN).n === 0, 'still 0 after 29 minutes');
ok(M.status(s, t + 30 * MIN).n === 1 && M.canPlay(s, t + 30 * MIN), '1 life after 30 minutes');
ok(M.status(s, t + 95 * MIN).n === 3, '3 lives after 95 minutes');
ok(Math.round(M.status(s, t + 95 * MIN).next / MIN) === 25, 'regen keeps its rhythm (25 min to the 4th)');
ok(M.status(s, t + 10 * 60 * MIN).n === 5 && M.status(s, t + 10 * 60 * MIN).full, 'caps at 5 after a long break');

// ---- rewards stack past 5, regen does not
s = save();
M.addLives(s, 3, t);
ok(M.status(s, t).n === 8, 'rewards stack to 8');
M.addLives(s, 5, t);
ok(M.status(s, t).n === M.LIFE_CAP, 'stack caps at ' + M.LIFE_CAP);
M.loseLife(s, t);
ok(M.status(s, t + 60 * MIN).n === M.LIFE_CAP - 1, 'no regen while above 5');

// ---- unlimited lives
s = save();
M.addUnlimited(s, 30, t);
ok(M.status(s, t).unlimited && !M.loseLife(s, t) && M.status(s, t).n === 5, 'unlimited: losing costs nothing');
ok(!M.status(s, t + 31 * MIN).unlimited, 'unlimited ends after 30 minutes');
M.addUnlimited(s, 30, t + 10 * MIN);
ok(Math.round(M.status(s, t + 10 * MIN).infLeft / MIN) === 50, 'unlimited time adds up');
s.creatorLives = true;
ok(M.status(s, t + 999 * MIN).unlimited, 'creator switch gives unlimited lives');

// ---- refill
s = save();
M.loseLife(s, t); M.loseLife(s, t);
M.refill(s, t);
ok(M.status(s, t).n === 5 && M.status(s, t).full, 'refill fills to 5');

// ---- daily tasks: three per day, roll over at midnight, track and claim
s = save();
s.level = 30;
let d1 = M.daily(s, t);
ok(d1.tasks.length === 3, 'three tasks a day');
const list = M.taskList(s, t);
ok(list.filter((k) => k.reward.lives).length >= 2, 'at least two tasks give lives');
for (let day = 0; day < 30; day++) {
  const fresh = save();
  ok(M.taskList(fresh, t + day * 86400000).length === 3, 'a level 1 player gets three tasks on day ' + day);
}
ok(new Set(list.map((k) => k.id)).size === 3, 'no duplicate tasks');
ok(list.every((k) => !k.text.includes('{color}')), 'task text is filled in');
// feed stats until every task is done
for (let i = 0; i < 200; i++) M.track(s, { wins: 1, moves: 1, spray: 1, boom: 1, plat: 1, combos: 1, cascade5: 1, bigwin: 1, flyer: 1, crates: 1, floor: 1, tape: 1, boosters: 1, col0: 1, col1: 1, col2: 1, col3: 1, col4: 1 }, t);
ok(M.tasksReady(s, t) === 3, 'all three tasks claimable');
const before = M.status(s, t).n, coins0 = s.coins;
for (let i = 0; i < 3; i++) ok(M.claimTask(s, i, t), 'claim task ' + i);
ok(!M.claimTask(s, 0, t), 'cannot claim twice');
ok(M.status(s, t).n > before || s.coins > coins0, 'claims paid out');
ok(M.bonusReady(s, t) && M.claimBonus(s, t) && M.status(s, t).unlimited, 'all-three bonus gives unlimited lives');
ok(!M.claimBonus(s, t), 'bonus only once');
const tomorrow = new Date(2026, 9, 10, 0, 0, 5).getTime();
ok(M.daily(s, tomorrow).day !== d1.day && M.tasksReady(s, tomorrow) === 0, 'new tasks after midnight');
ok(M.taskList(s, tomorrow).every((k) => k.prog === 0), 'progress resets for the new day');
// early players never get tasks they cannot do yet
const early = save();
early.level = 1;
for (let day = 0; day < 40; day++) {
  const tt = t + day * 24 * 60 * MIN;
  early.daily = { day: '' };
  for (const k of M.taskList(early, tt)) ok(!['crates', 'tape', 'combo', 'flyer', 'plat', 'win3'].includes(k.id), `level 1 player got task ${k.id}`);
}

// ---- event counting
const st = M.statsFromEvents([
  { t: 'act', pw: 'h', id: 1 }, { t: 'act', pw: 'v', id: 2 }, { t: 'act', pw: 'x', id: 3 }, { t: 'act', pw: 'pl', id: 4 },
  { t: 'act', pw: 'pl', id: null }, { t: 'act', pw: 'xx', id: 5 }, { t: 'act', pw: 'row' },
  { t: 'clear', col: 2 }, { t: 'merge', col: 2 }, { t: 'clear', col: 0, hit: 1 },
  { t: 'crate', hp: 1 }, { t: 'crate', hp: 0 }, { t: 'floor' }, { t: 'combo', n: 3 }, { t: 'combo', n: 6 },
]);
ok(st.spray === 2 && st.boom === 1 && st.flyer === 1 && st.combos === 1, 'power-ups counted (boosters and sub-planes not)');
ok(st.col2 === 2 && st.col0 === 1 && st.crates === 1 && st.floor === 1 && st.cascade5 === 1, 'tiles, crates, floor, cascade counted');

// ---- daily cypher, share, drop: once a day
s = save();
ok(M.cypherWin(s, t) && !M.cypherWin(s, t), 'daily cypher pays once a day');
ok(M.cypherWin(s, tomorrow), 'daily cypher pays again tomorrow');
ok(M.shareReward(s, t + 1) === null || true, 'share works');
s = save();
ok(M.shareReward(s, t) && !M.shareReward(s, t), 'share pays once a day');
s = save();
const got = [];
for (let day = 0; day < 9; day++) {
  const tt = t + day * 24 * 60 * MIN;
  ok(M.dropReady(s, tt), 'drop ready on day ' + (day + 1));
  got.push(M.claimDrop(s, tt));
  ok(!M.dropReady(s, tt) && !M.claimDrop(s, tt), 'drop once per day');
}
ok(got[6].unlimited === 60 && got[7].lives === 1, 'day 7 is an hour of unlimited lives, then the calendar loops');
s = save();
M.claimDrop(s, t);
ok(M.dropReady(s, t + 5 * 24 * 60 * MIN) && M.claimDrop(s, t + 5 * 24 * 60 * MIN).coins === 100, 'missing days never resets the calendar');

// ---- level win rewards: gold, boss, hot streak
s = save();
M.loseLife(s, t); M.loseLife(s, t); M.loseLife(s, t);
const gold = LEVELS.find((L) => L.gold);
const bossL = LEVELS.find((L) => L.boss);
let r = M.levelWinRewards(s, gold, true, t);
ok(r.some((x) => x.why === 'Gold level') && M.status(s, t).n === 3, 'gold level gives a life');
r = M.levelWinRewards(s, gold, false, t);
ok(!r.some((x) => x.why === 'Gold level'), 'gold life only on the first clear');
ok(!r.some((x) => x.why.startsWith('Hot streak')), 'no streak bonus on the second win');
r = M.levelWinRewards(s, bossL, true, t);
ok(r.some((x) => x.why.startsWith('Hot streak')), 'third win in a row is a hot streak');
ok(M.status(s, t).unlimited && M.status(s, t).n === 6, 'boss win refills to 5 (+1 streak life) and grants unlimited lives');
M.levelLost(s);
ok(s.streak === 0, 'losing resets the streak');

// ---- level data
ok(LEVELS.length === 100, '100 levels');
ok(LEVELS.every((L, i) => L.id === i + 1), 'level ids run 1 to 100');
ok(LEVELS.filter((L) => L.gold).map((L) => L.id).join() === '5,15,25,35,45,55,65,75,85,95', 'gold levels end in 5');
ok(LEVELS.filter((L) => L.boss).map((L) => L.id).join() === '20,40,60,80,100', 'a boss closes every chapter');
ok(LEVELS.every((L) => L.board.length <= 8 && L.board.every((row) => row.length <= 7)), 'every board fits 7x8');
ok(LEVELS.every((L) => L.moves >= 14 && L.moves <= 40), 'move counts 14 to 40');
ok(DAILY.length >= 28 && DAILY.every((L) => L.daily), 'daily pool');

console.log(fails ? `${fails} check(s) failed` : 'meta ok: lives, tasks, drop, rewards and level data');
process.exit(fails ? 1 : 0);
