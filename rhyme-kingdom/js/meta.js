/*
 * Rhyme Kingdom: lives, daily tasks and daily rewards.
 *
 * Pure rules over the save object and a clock (no DOM), so they run in the
 * browser (window.RKMeta) and in Node tests. Every function takes `now` (ms).
 *
 * Lives:  5 max, one comes back every 30 minutes. A life is used when you fail
 *         a level or quit one after making a move. Rewards can stack lives past
 *         5 (up to 9); timed "unlimited lives" stop lives from being used.
 * Free lives: Daily Cypher win, Street Tasks, the Daily Drop calendar, Gold
 *         levels (every level ending in 5), a 3-win hot streak, boss wins,
 *         and sharing the game once a day.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RKMeta = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MAX_LIVES = 5;
  const LIFE_CAP = 9;
  const REGEN_MS = 30 * 60 * 1000;
  const REFILL_PRICE = 250;
  const MIN = 60 * 1000;

  // ---------------------------------------------------------------- dates
  const pad = (n) => String(n).padStart(2, '0');
  function today(now) {
    const d = new Date(now);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  // Days since 2026-01-01 in local time: picks the Daily Cypher and the task color.
  function dayNumber(now) {
    const d = new Date(now);
    return Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(2026, 0, 1)) / 86400000);
  }
  function msToMidnight(now) {
    const d = new Date(now);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1) - d;
  }
  function clock(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    return h ? `${h}h ${pad(m)}m` : `${m}:${pad(ss)}`;
  }

  // ---------------------------------------------------------------- lives
  function ensure(save) {
    if (!save.lives || typeof save.lives !== 'object') save.lives = { n: MAX_LIVES, t: 0, inf: 0 };
    if (typeof save.streak !== 'number') save.streak = 0;
    if (!save.daily || typeof save.daily !== 'object') save.daily = { day: '' };
    if (!save.drop || typeof save.drop !== 'object') save.drop = { last: '', idx: 0 };
    return save;
  }
  // Bring regenerated lives up to date.
  function tick(save, now) {
    const L = ensure(save).lives;
    if (L.n >= MAX_LIVES) { L.t = 0; return; }
    if (!L.t) { L.t = now; return; }
    const k = Math.floor((now - L.t) / REGEN_MS);
    if (k > 0) {
      L.n = Math.min(MAX_LIVES, L.n + k);
      L.t = L.n >= MAX_LIVES ? 0 : L.t + k * REGEN_MS;
    }
  }
  const unlimited = (save, now) => !!save.creatorLives || ensure(save).lives.inf > now;
  function status(save, now) {
    tick(save, now);
    const L = save.lives;
    return {
      n: L.n,
      unlimited: unlimited(save, now),
      infLeft: Math.max(0, L.inf - now),
      next: L.n < MAX_LIVES && L.t ? Math.max(0, REGEN_MS - (now - L.t)) : 0,
      full: L.n >= MAX_LIVES,
    };
  }
  function canPlay(save, now) {
    tick(save, now);
    return unlimited(save, now) || save.lives.n > 0;
  }
  // Returns true when a life was actually used.
  function loseLife(save, now) {
    tick(save, now);
    if (unlimited(save, now)) return false;
    const L = save.lives;
    if (L.n <= 0) return false;
    L.n--;
    if (L.n < MAX_LIVES && !L.t) L.t = now;
    return true;
  }
  function addLives(save, k, now) {
    tick(save, now);
    const L = save.lives;
    L.n = Math.min(LIFE_CAP, L.n + k);
    if (L.n >= MAX_LIVES) L.t = 0;
  }
  function addUnlimited(save, minutes, now) {
    const L = ensure(save).lives;
    L.inf = Math.max(L.inf, now) + minutes * MIN;
  }
  function refill(save, now) {
    tick(save, now);
    if (save.lives.n < MAX_LIVES) save.lives.n = MAX_LIVES;
    save.lives.t = 0;
  }

  // Apply a reward: { lives, coins, unlimited (minutes), boosters: { type: n } }
  function grant(save, reward, now) {
    if (!reward) return;
    if (reward.lives) addLives(save, reward.lives, now);
    if (reward.coins) save.coins = (save.coins || 0) + reward.coins;
    if (reward.unlimited) addUnlimited(save, reward.unlimited, now);
    if (reward.refill) refill(save, now);
    for (const [k, n] of Object.entries(reward.boosters || {})) save.boosters[k] = (save.boosters[k] || 0) + n;
  }
  function describe(reward) {
    const out = [];
    if (!reward) return out;
    if (reward.refill) out.push({ icon: 'heart', text: 'Full lives' });
    if (reward.lives) out.push({ icon: 'heart', text: `+${reward.lives} ${reward.lives === 1 ? 'life' : 'lives'}` });
    if (reward.unlimited) out.push({ icon: 'heartInf', text: `${reward.unlimited >= 60 ? reward.unlimited / 60 + ' hr' : reward.unlimited + ' min'} unlimited lives` });
    if (reward.coins) out.push({ icon: 'coin', text: `+${reward.coins} coins` });
    for (const [k, n] of Object.entries(reward.boosters || {})) out.push({ icon: k, text: `+${n} ${BOOSTER_NAMES[k] || k}` });
    return out;
  }
  const BOOSTER_NAMES = { hammer: 'Mic Drop', row: 'Scratch', col: 'Bass Drop', shuffle: 'Remix' };

  // ---------------------------------------------------------- street tasks
  // Three a day: two that give lives, one that gives coins. Finish all three
  // for 30 minutes of unlimited lives. `from` is the first level where the
  // task makes sense (no crate tasks before crates exist).
  const TILE_NAMES = ['Mics', 'Sneakers', 'Gold Chains', 'Snapbacks', 'Headphones', 'Mixtapes'];
  const LIFE_TASKS = [
    { id: 'win2', stat: 'wins', need: 2, text: 'Win 2 levels', reward: { lives: 1 }, from: 1 },
    { id: 'moves', stat: 'moves', need: 25, text: 'Make 25 moves', reward: { lives: 1 }, from: 1 },
    { id: 'win3', stat: 'wins', need: 3, text: 'Win 3 levels', reward: { lives: 2 }, from: 6 },
    { id: 'spray', stat: 'spray', need: 5, text: 'Fire 5 Spray Cans', reward: { lives: 1 }, from: 3 },
    { id: 'boom', stat: 'boom', need: 3, text: 'Drop 3 Boomboxes', reward: { lives: 1 }, from: 5 },
    { id: 'plat', stat: 'plat', need: 2, text: 'Spin 2 Platinum Records', reward: { lives: 1 }, from: 7 },
    { id: 'combo', stat: 'combos', need: 2, text: 'Pull off 2 power-up combos', reward: { lives: 1 }, from: 15 },
    { id: 'cascade', stat: 'cascade5', need: 1, text: 'Chain a x5 combo', reward: { lives: 1 }, from: 4 },
    { id: 'bigwin', stat: 'bigwin', need: 1, text: 'Win with 5 or more moves left', reward: { lives: 1 }, from: 2 },
  ];
  const COIN_TASKS = [
    { id: 'color', stat: 'col', need: 60, text: 'Collect 60 {color}', reward: { coins: 60 }, from: 1 },
    { id: 'flyer', stat: 'flyer', need: 4, text: 'Launch 4 Flyers', reward: { coins: 60 }, from: 9 },
    { id: 'crates', stat: 'crates', need: 15, text: 'Break 15 crates', reward: { coins: 60 }, from: 12 },
    { id: 'floor', stat: 'floor', need: 30, text: 'Light up 30 floor panels', reward: { coins: 50 }, from: 4 },
    { id: 'tape', stat: 'tape', need: 12, text: 'Rip the tape off 12 tiles', reward: { coins: 60 }, from: 24 },
    { id: 'boosters', stat: 'boosters', need: 2, text: 'Use 2 boosters', reward: { coins: 40, boosters: { shuffle: 1 } }, from: 3 },
  ];
  const ALL_DONE = { unlimited: 30 };

  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), s | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(list, R) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  // Today's daily state, rolled over at local midnight.
  function daily(save, now) {
    ensure(save);
    const day = today(now);
    if (save.daily.day !== day) {
      const dn = dayNumber(now);
      const R = rng(dn * 7919 + 13);
      const lvl = save.level || 1;
      const ok = (t) => lvl >= t.from;
      const lifePool = shuffle(LIFE_TASKS.filter(ok), R);
      const coinPool = shuffle(COIN_TASKS.filter(ok), R);
      const color = dn % 5; // one of the five tiles every level uses
      const picks = [lifePool[0], lifePool[1], coinPool[0]].filter(Boolean);
      save.daily = {
        day,
        color,
        tasks: picks.map((t) => ({ id: t.id, prog: 0, claimed: false })),
        stats: {},
        bonus: false,
        cypher: false,
        shared: false,
      };
    }
    return save.daily;
  }
  function taskDef(id) { return LIFE_TASKS.find((t) => t.id === id) || COIN_TASKS.find((t) => t.id === id); }
  function taskList(save, now) {
    const d = daily(save, now);
    return d.tasks.map((t, i) => {
      const def = taskDef(t.id);
      const stat = def.stat === 'col' ? 'col' + d.color : def.stat;
      const prog = Math.min(def.need, d.stats[stat] || 0);
      return {
        i, id: t.id, need: def.need, prog,
        text: def.text.replace('{color}', TILE_NAMES[d.color]),
        reward: def.reward, done: prog >= def.need, claimed: t.claimed,
      };
    });
  }
  function claimTask(save, i, now) {
    const list = taskList(save, now);
    const t = list[i];
    if (!t || !t.done || t.claimed) return null;
    save.daily.tasks[i].claimed = true;
    grant(save, t.reward, now);
    return t.reward;
  }
  function bonusReady(save, now) {
    const d = daily(save, now);
    return !d.bonus && d.tasks.length > 0 && d.tasks.every((t) => t.claimed);
  }
  function claimBonus(save, now) {
    if (!bonusReady(save, now)) return null;
    save.daily.bonus = true;
    grant(save, ALL_DONE, now);
    return ALL_DONE;
  }
  // Things ready to claim (for the badge on the home screen).
  function tasksReady(save, now) {
    return taskList(save, now).filter((t) => t.done && !t.claimed).length + (bonusReady(save, now) ? 1 : 0);
  }

  function track(save, stats, now) {
    const d = daily(save, now);
    for (const [k, v] of Object.entries(stats)) if (v) d.stats[k] = (d.stats[k] || 0) + v;
  }
  const COMBOS = ['cross', 'bigcross', 'xx', 'plpl', 'plc', 'dconv', 'dd'];
  // Count what a move did, from the engine's event list.
  function statsFromEvents(events) {
    const s = {};
    const add = (k, v = 1) => { s[k] = (s[k] || 0) + v; };
    let topCascade = 0;
    for (const ev of events) {
      switch (ev.t) {
        case 'act':
          if (ev.pw === 'h' || ev.pw === 'v') add('spray');
          else if (ev.pw === 'x') add('boom');
          else if (ev.pw === 'd') add('plat');
          else if (ev.pw === 'pl') { if (ev.id != null) add('flyer'); }
          else if (COMBOS.includes(ev.pw)) add('combos');
          break;
        case 'clear': case 'merge':
          if (ev.col >= 0) add('col' + ev.col);
          break;
        case 'crate': if (ev.hp === 0) add('crates'); break;
        case 'floor': add('floor'); break;
        case 'tape': add('tape'); break;
        case 'static': add('static'); break;
        case 'combo': topCascade = Math.max(topCascade, ev.n); break;
        default: break;
      }
    }
    if (topCascade >= 5) add('cascade5');
    return s;
  }

  // ------------------------------------------------------- daily cypher etc
  const CYPHER_REWARD = { lives: 1, coins: 50 };
  const SHARE_REWARD = { lives: 1 };
  function cypherWin(save, now) {
    const d = daily(save, now);
    if (d.cypher) return null;
    d.cypher = true;
    grant(save, CYPHER_REWARD, now);
    return CYPHER_REWARD;
  }
  function shareReward(save, now) {
    const d = daily(save, now);
    if (d.shared) return null;
    d.shared = true;
    grant(save, SHARE_REWARD, now);
    return SHARE_REWARD;
  }

  // ----------------------------------------------------------- daily drop
  // A 7-day calendar of gifts. Missing a day never resets it: no pressure.
  const DROP = [
    { lives: 1 },
    { coins: 100 },
    { boosters: { hammer: 1 } },
    { lives: 2 },
    { coins: 150 },
    { boosters: { row: 1, shuffle: 1 } },
    { unlimited: 60 },
  ];
  function dropReady(save, now) { return ensure(save).drop.last !== today(now); }
  function claimDrop(save, now) {
    if (!dropReady(save, now)) return null;
    const r = DROP[save.drop.idx % DROP.length];
    save.drop.idx = (save.drop.idx + 1) % DROP.length;
    save.drop.last = today(now);
    grant(save, r, now);
    return r;
  }

  // ----------------------------------------------------------- level wins
  // Extra rewards for a story level win (stars and coins are handled by the UI).
  function levelWinRewards(save, L, first, now) {
    const out = [];
    save.streak = (save.streak || 0) + 1;
    if (first && L.gold) out.push({ why: 'Gold level', reward: { lives: 1 } });
    if (first && L.boss) out.push({ why: 'Boss defeated', reward: { refill: true, unlimited: 30 } });
    if (save.streak % 3 === 0) out.push({ why: 'Hot streak: 3 wins in a row', reward: { lives: 1 } });
    for (const o of out) grant(save, o.reward, now);
    return out;
  }
  function levelLost(save) { save.streak = 0; }

  return {
    MAX_LIVES, LIFE_CAP, REGEN_MS, REFILL_PRICE, DROP, CYPHER_REWARD, SHARE_REWARD, ALL_DONE,
    today, dayNumber, msToMidnight, clock,
    ensure, tick, status, canPlay, loseLife, addLives, addUnlimited, refill, grant, describe,
    daily, taskList, claimTask, bonusReady, claimBonus, tasksReady, track, statsFromEvents,
    cypherWin, shareReward, dropReady, claimDrop, levelWinRewards, levelLost,
  };
});
