# Rhyme Kingdom

A hip-hop match-3 adventure in the style of Royal Kingdom, from Cloudnhyne Designz.

King Static has silenced the Kingdom of Rhyme. He stole the Crowns, taped up the park,
and buried the block in static. Help **King Flow** and the hip-hop royal court bring the
music back across **25 levels** and **5 chapters**, then spend your stars to rebuild the
neighborhood piece by piece.

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
| Boss fights | Level 10 Baron Buzzkill (throws crates), Level 20 Lady Lip-Sync (tapes tiles), Level 25 King Static (spreads static) |
| End-of-level celebration | **Encore!** Leftover moves turn into spray cans and fire for bonus coins |

All artwork (pieces, obstacles, characters, bosses, icons and the ten Block paintings) was
generated with a professional image model and cut into sprites by `tools/slice.mjs`.
Each area of the Block has a "silenced" painting and a rebuilt one; every piece you build
lights up its part of the scene.

Also included: forced-move tutorials on the levels that introduce a power-up, "New!" cards for
each mechanic, idle hints, story scenes with every character, coins, +5 moves when you run out,
level select, and a **Creator preview** switch in Settings that unlocks all 25 levels so you can
review any of them.

Progress saves in the browser on that device.

### The levels

| Chapter | Levels | New ideas |
| --- | --- | --- |
| 1. The Block Party (King Flow) | 1 to 5 | matching, Spray Can, dance floor, Boombox, Platinum Record |
| 2. The Record Shop (DJ Duchess) | 6 to 10 | crates, Flyer, boss: Baron Buzzkill |
| 3. The Blacktop (Prince Breaks) | 11 to 15 | tape, combos, Crowns |
| 4. The Wall (Countess Canvas) | 16 to 20 | spreading static, 3-layer crates, boss: Lady Lip-Sync |
| 5. The Crown Arena (Queen Cadence) | 21 to 25 | everything together, final boss: King Static |

Difficulty was tuned with a bot that played every level hundreds of times: early levels are
near-certain wins, the bosses and the last chapter are genuinely hard.

## Project layout

```
index.html        page structure (screens, HUD, popups)
css/style.css     all styling
js/engine.js      match-3 rules: matching, gravity, power-ups, combos, obstacles, bosses
js/levels.js      the 25 level layouts
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

Each level in `js/levels.js` is a small block of text. Example:

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

- Lives and timed refills, a shop, and ads or in-app purchases for coins
- More chapters (each new area is 5 levels, 5 buildable pieces, and a host)
- Leaderboards and daily challenges
- Voiced callouts and animated character reactions
