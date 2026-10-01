# Rhyme Kingdom: soundtrack and art prompts

The game streams its music from `assets/music/`. To swap in a Suno track, export it as MP3,
name it as listed below, drop it in `assets/music/`, and run `node tools/build.mjs`.
Loops should be about 90 seconds; the game repeats them.

| File | Plays during |
| --- | --- |
| `theme.mp3` | title screen and the Block (home) |
| `gfunk.mp3` | Chapters 1 and 3 (Block Party, Blacktop) |
| `stutter.mp3` | Chapters 2 and 4 (Record Shop, Wall) and the Daily Cypher |
| `arena.mp3` | Chapter 5 (Crown Arena) |
| `boss.mp3` | boss levels 10, 20 and 25 |
| `win.mp3` / `lose.mp3` | level clear and out of moves stingers (3 to 6 seconds) |

The current files are placeholders made with ElevenLabs before the switch to Suno.

## Suno prompts (paste into Custom mode)

### theme.mp3: "Bring the Music Back"

Style:
```
West Coast G-funk hip hop, 94 BPM, whiny portamento high synth lead, rubbery analog bass, hard cracking snare, sparse piano stabs, talkbox melody, syncopated stuttering drum programming, beatboxed percussion, plucked exotic samples, rapid-fire Midwest double-time chopper rap verses with triplet flows, chanted group chorus, clean family-friendly lyrics, punchy modern mix, wide dynamics, do not compress flat
```

Lyrics:
```
[Intro]
(spoken, cool and confident) Rhyme Kingdom. Turn it up. King Flow on the mic.

[Verse 1]
(rapid double-time flow)
Static came and cut the cord, the block went quiet, nobody on board
So I picked up the mic like a sword, every rhyme that I spit is a key to the door
Match it up, line it up, three in a row, light it up, fire it up, watch the floor glow
Crates on the corner, tape on the track, every move that I make bring the music back

[Chorus]
(group chant)
Bring the music back, bring the music back
Turn the corner up, put the bass on the track
From the stoop to the stage, every crown in the stack
Rhyme Kingdom, bring the music back

[Verse 2]
(even faster, triplet chopper flow)
Spray can rocking, boombox knocking, platinum spinning, never stopping
Mic drop popping, crowd keep hopping, King Static mad cause the block keep rocking
Every voice got a verse, every verse got a place, keep your head up high, put a smile on your face
Breathe in slow, let it go, take your time, take your space, this the Kingdom of Rhyme and we all got a place

[Chorus]
Bring the music back, bring the music back
Turn the corner up, put the bass on the track
From the stoop to the stage, every crown in the stack
Rhyme Kingdom, bring the music back

[Outro]
(synth lead rides out) Everybody gets a turn in the cypher. Bring it back.
```

### gfunk.mp3 (Instrumental on)
```
Laid-back West Coast G-funk instrumental, 92 BPM, whiny portamento high synth lead, deep rubbery analog bass, crisp hard snare, rolling hi-hats, piano stabs, light talkbox fills, steady head-nodding groove, consistent energy, no intro or outro, loopable
```

### stutter.mp3 (Instrumental on)
```
Futuristic syncopated hip hop instrumental, 98 BPM, stuttering off-kilter drum programming, beatboxed mouth percussion, skipping hi-hat triplets, deep sub bass, plucked exotic strings and flute, quirky vocal chops as texture, bouncy and playful, consistent energy, no intro or outro, loopable
```

### boss.mp3 (Instrumental on)
```
Dark menacing hip hop boss battle instrumental, 100 BPM, distorted 808 bass, hard knocking drums with snare rolls, ominous minor-key strings, eerie bell melody, choir stabs, glitchy static noise accents, tense and driving, loopable
```

### arena.mp3 (Instrumental on)
```
Triumphant stadium hip hop instrumental, 90 BPM, booming drums, bold brass horn riffs, soulful vocal chops, warm Rhodes chords, deep bass, crowd hype energy, victorious, loopable
```

### win.mp3 and lose.mp3 (Instrumental on, trim to the first few seconds)
```
Short hip hop victory stinger, DJ record scratch, punchy brass hit, booming 808, airhorn blasts, crowd cheer, big final chord
```
```
Short playful hip hop fail stinger, turntable record slowing to a stop, descending bass slide, soft disappointed horn, gentle not harsh
```

## Gemini prompts: street scenes

Each area needs two paintings, both 16:9 at the same framing: the rebuilt scene
(`art-src/scene-<area>.png`) and a silenced version (`art-src/scene-<area>-off.png`).
Make the silenced one first, then ask Gemini to edit it into the rebuilt one so the layout matches.
Then run `node tools/slice.mjs` and `node tools/build.mjs`.

Shared style line to add to every prompt:
```
Gritty urban street at night, painterly game art, black, deep red, concrete grey and white palette only, wet asphalt reflections, red neon and sodium streetlight glow, brick walls with graffiti, cinematic wide 16:9, no people, no text, no logos
```

- **block**: a city block party on a brownstone street: turntables center, speaker stacks either side, string lights overhead, graffiti mural on the left wall, banner across the top.
- **shop**: a corner record shop: neon sign top left, striped awning, album wall in the window, record bins on the sidewalk, giant vinyl sign on the right.
- **blacktop**: a fenced basketball court: hoop on the left, cardboard dance floor center, bleachers on the right, boombox on a bench, tall court lights.
- **wall**: a train yard wall: huge wildstyle piece across the wall, character mural on the right, paint cans at the bottom, subway car in front, spotlights at both edges.
- **arena**: an outdoor stage: main stage at the bottom, speaker towers on both sides, light rig above, golden mic throne center, crown banner at the top.

For the silenced version add: "abandoned and silent, everything switched off, dusty, taped up, grey static haze, no lights on".
