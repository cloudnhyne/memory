# Rhyme Kingdom

A hip-hop match-3 adventure in the style of Royal Kingdom, from Cloudnhyne Designz.

King Static has silenced the Kingdom of Rhyme. He stole the Crowns, taped up the park,
and buried the block in static. Help **King Flow** and the hip-hop royal court bring the
music back across **100 levels** and **5 chapters**, then spend your stars to rebuild the
neighborhood piece by piece.

Play it online: https://rhyme-kingdom.vercel.app

## Play it

- **Easiest:** open `dist/rhyme-kingdom.html` in any browser (phone or desktop). It is one
  self-contained file with no install, so you can email it, drop it on a website, or host it
  on GitHub Pages, Netlify, Vercel or similar.
- **From source:** open `index.html` directly, or serve the folder (`npx serve .`).

Turn the sound on: the game has a produced hip-hop soundtrack (a theme song with chopper
rap verses, G-funk and stutter-beat level loops, boss and arena loops). See `SOUNDTRACK.md`
for the Suno and Gemini prompts and how to swap tracks.

## What's in the game

| Royal Kingdom idea | Rhyme Kingdom version |
| --- | --- |
| King Richard and the royal family | **King Flow** (MC), **Queen Cadence** (voice), **DJ Duchess** (DJ), **Prince Breaks** (b-boy), **Countess Canvas** (graffiti writer) and **The Griot** (knowledge, the fifth element) |
| The Dark King | **King Static**, with lieutenants **Baron Buzzkill** and **Lady Lip-Sync** |
| Build the kingdom with stars | Rebuild five areas of the Block: the Block Party, the Record Shop, the Blacktop, the Wall and the Crown Arena (25 buildable pieces) |
| Rocket / TNT / Propeller / Light Ball | **Spray Can** (row or column) / **Boombox** (blast) / **Flyer** (paper plane that seeks goals) / **Platinum Record** (clears a color) |
| Power-up combos | Crossfade, Bass Cross, Double Drop, Airmail, Special Delivery, Remix, Double Platinum |
| In-game boosters | **Mic Drop** (hammer), **Scratch** (row), **Bass Drop** (column), **Remix** (shuffle) |
| Boxes, grass, chains, collectibles | Record crates (1 to 3 layers), dance-floor panels (1 to 2 layers), taped tiles, Crowns to bring home, spreading static |
| Boss fights | A boss closes every chapter: Baron Buzzkill (20, and his remix at 60), Lady Lip-Sync (40, and her encore at 80), King Static (100) |
| Lives and free lives | 5 lives, one back every 30 minutes. Free lives from the Daily Cypher, Street Tasks, the Daily Drop, Gold levels, hot streaks, boss wins and sharing |
| End-of-level celebration | **Encore!** Leftover moves turn into spray cans and fire for bonus coins |

All artwork (pieces, obstacles, characters, bosses, icons and the ten Block paintings) was
generated with a professional image model and cut into sprites by `tools/slice.mjs`.
Each area of the Block has a "silenced" painting and a rebuilt one; every piece you build
lights up its part of the scene.

### Lives and free lives

- **Lives:** you start with 5 and get one back every 30 minutes. A life is only used when you
  fail a level, or quit or restart one after making a move. The Daily Cypher never uses one.
- **Daily Cypher:** a free bonus level every day (picked from 30, only with obstacles you have
  learned). Win it for +1 life and 50 coins.
- **Street Tasks:** three tasks a day (like "Drop 3 Boomboxes"). Two pay lives, one pays coins,
  and finishing all three gives 30 minutes of unlimited lives.
- **Daily Drop:** a 7-day gift calendar ending in an hour of unlimited lives. Missing a day
  never resets it, so nobody feels pressured to log in.
- **Gold levels:** every level ending in 5 gives a free life the first time you beat it.
- **Hot streak:** every third win in a row gives a life. **Boss wins** refill your lives and
  add 30 minutes of unlimited lives. **Sharing** the game gives a life once a day.
- Rewards can stack lives up to 9. Lives can also be refilled for 250 coins.
- **Creator preview** in Settings has a switch for unlimited lives while you test.

Also included: forced-move tutorials on the levels that introduce a power-up, "New!" cards for
each mechanic, idle hints, story scenes with every character, coins, +5 moves when you run out,
level select, and a **Creator preview** switch in Settings that unlocks all 25 levels so you can
review any of them.

Progress saves in the browser on that device.

### The levels

| Chapter | Levels | New ideas |
| --- | --- | --- |
| 1. The Block Party (King Flow) | 1 to 20 | matching, Spray Can, dance floor, Boombox, Platinum Record, Flyer, crates, combos, boss: Baron Buzzkill |
| 2. The Record Shop (DJ Duchess) | 21 to 40 | deep crates, tape, Crowns, boss: Lady Lip-Sync |
| 3. The Blacktop (Prince Breaks) | 41 to 60 | two-layer floors, odd board shapes, boss: Buzzkill Remix |
| 4. The Wall (Countess Canvas) | 61 to 80 | spreading static, boss: Lip-Sync Encore |
| 5. The Crown Arena (Queen Cadence) | 81 to 100 | everything together, final boss: King Static |

Boards are at most 7 wide and 8 tall so the pieces stay big on a phone. Each area of the Block
has five pieces that cost 1, 3, 4, 5 and 7 stars (20 stars per chapter, one per level).

Difficulty is tuned with a bot that plays every level many times: intro levels are near-certain
wins, normal levels win about 80 to 90 percent of the time for the bot, hard levels about two
thirds, super hard levels and bosses about half to two thirds.

## Project layout

```
index.html        page structure (screens, HUD, popups)
css/style.css     all styling
js/engine.js      match-3 rules: matching, gravity, power-ups, combos, obstacles, bosses
js/levels.js      the 100 levels and the Daily Cypher pool (generated by tools/makelevels.mjs)
js/meta.js        lives, Street Tasks, Daily Drop and other rewards (pure rules, no screen code)
js/render.js      canvas board renderer, animations and touch input
js/art.js         art registry and the Block's build regions
assets/           game art (WebP), cut from the generated sheets
art-src/          original generated sheets and scene paintings
js/audio.js       soundtrack player and synthesized sound effects (Web Audio)
assets/music/     the soundtrack (MP3)
js/story.js       characters, dialog and mechanic intro cards
js/ui.js          screens, menus, saving, boosters, win and lose flow
js/main.js        startup
tools/            build, balance simulator and engine stress test
dist/             the bundled single-file game
```

## Editing levels

`js/levels.js` is generated by `tools/makelevels.mjs`. Each level there is a short spec: a
board shape, obstacle patterns and goals. Edit a spec, then run:

```
node tools/makelevels.mjs           # rebuild every level and re-tune all move counts (about 2 minutes)
node tools/makelevels.mjs 12 40     # re-tune only levels 12 and 40
node tools/makelevels.mjs --lint    # rebuild and check layouts without re-tuning
node tools/meta-test.mjs            # check the lives, tasks and daily reward rules
```

The generated file uses the same board format you can read and tweak by hand. Example:

```js
{
  id: 6, name: 'Crate Digging', moves: 15, colors: [0, 1, 2, 3, 4],
  goals: [{ type: 'crate' }],
  board: [
    '........',
    '..1..1..',   // 1, 2, 3 = record crate with that many layers
    '........',
  ],
}
```

Board characters: `.` random tile, `-` hole, `R O Y G B P` a fixed tile (mic, sneaker, chain,
cap, headphones, mixtape), `1 2 3` crates, `S` static, `C` crown, `K` boss, `h v x p d` a
power-up already on the board. Optional `floor` and `tape` grids use the same shape. Goals are
`color`, `crate`, `floor`, `tape`, `static`, `crown` or `boss`.

After changing levels, check them:

```
node tools/simulate.mjs 60          # lint layouts and report bot win rates per level
CAL=1 node tools/simulate.mjs 60    # also report how many moves each level needs
node tools/invariants.mjs           # stress-test the engine with random play
node tools/build.mjs                # rebuild dist/rhyme-kingdom.html (inlines assets/)
node tools/slice.mjs                # re-cut assets/ from art-src/ (needs Playwright)
```

### Restyling the art with Gemini

`tools/gemini-art.mjs` remakes every piece of art (cast, pieces, obstacles, icons, the ten
Block paintings, five tall level backdrops and a logo) in one glossy 3D cartoon style, using
the current art as the reference for each piece so layouts and characters stay the same.
It needs a free Gemini API key from https://aistudio.google.com/apikey in `GEMINI_API_KEY`.

```
node tools/gemini-art.mjs           # make what's missing (re-runs skip finished pieces)
node tools/gemini-art.mjs cast      # only the jobs whose name contains "cast"
node tools/gemini-art.mjs --force   # remake everything
node tools/slice.mjs && node tools/build.mjs
```

The first-generation art is kept in `art-src/v1/`. Sprites come back on flat magenta,
which `slice.mjs` keys out. The style line and every prompt live at the top of the script.

## Why a web game instead of Unreal Engine

Match-3 hits like Royal Match and Royal Kingdom are 2D mobile games. Unreal is built for 3D and
would add gigabytes of download for a puzzle game. This
version runs instantly in any phone browser today, and the same code can ship to the App Store and
Google Play by wrapping it with [Capacitor](https://capacitorjs.com/) when you're ready.

## Before you publish

- **Name:** "Rhyme Kingdom" is a working title. "Royal Kingdom" and "Royal Match" are trademarks
  of Dream Games; this game is independent, uses its own art, characters and code, and is not
  affiliated with them. Run a trademark search on the final name before launch.
- **Characters** are original and fictional. No real artists' names, likenesses or lyrics are
  used, which keeps you clear of right-of-publicity issues.
- **Music** is AI-generated from text descriptions with original lyrics; no samples or real
  artists' voices are used. Check the generator's commercial-use terms for your plan before launch.

## Natural next steps

- A coin shop, and ads or in-app purchases for coins and lives
- More chapters (each new area is 5 levels, 5 buildable pieces, and a host)
- Leaderboards and daily challenges
- Voiced callouts and animated character reactions
