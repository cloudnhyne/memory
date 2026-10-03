// Restyles every piece of game art with Google Gemini, using the current art as
// the reference for each piece so layouts and characters stay the same.
//
//   GEMINI_API_KEY=... node tools/gemini-art.mjs            make everything that's missing
//   GEMINI_API_KEY=... node tools/gemini-art.mjs --force    remake everything
//   GEMINI_API_KEY=... node tools/gemini-art.mjs cast       only jobs whose name contains "cast"
//   GEMINI_MODEL=gemini-3-pro-image-preview node tools/gemini-art.mjs   pick another model
//
// Results land in art-src/ (the old files are kept in art-src/v1/). Then run
//   node tools/slice.mjs && node tools/build.mjs
//
// Sprites are drawn on a flat magenta background; slice.mjs keys it out.
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'fs';
import { dirname, join, extname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'art-src');
const KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-image';
const args = process.argv.slice(2);
const force = args.includes('--force');
const only = args.filter((a) => !a.startsWith('--'));
if (!KEY) { console.error('Set GEMINI_API_KEY (free key: https://aistudio.google.com/apikey).'); process.exit(1); }

// ------------------------------------------------------------------ the look
// One style line on every prompt keeps the whole game consistent.
const STYLE = 'Premium mobile puzzle game art: glossy stylized 3D cartoon render, chunky friendly proportions, big expressive eyes, soft studio lighting with warm key light and bright rim light, subtle subsurface glow, rich saturated color, crisp clean silhouettes, polished like a top-grossing match-3 game. Original characters and designs only. Palette led by candy red, deep black, chrome silver and white, with gold for crowns, chains and coins.';
const KEYBG = 'Solid flat pure magenta background (#FF00FF) everywhere behind the objects, no gradient, no floor, no shadow on the background.';
const NOTEXT = 'No text, no letters, no logos, no watermark.';

const PEOPLE = {
  kingFlow: 'King Flow, a warm confident Black hip-hop king and MC in his 30s: short beard, gold crown tilted on a black fitted cap, red velvet cape with white fur trim over a black track jacket, chunky gold chain, holding a gold microphone, big friendly grin',
  queenCadence: 'Queen Cadence, a radiant Black woman singer: voluminous natural hair with a slim gold crown, red sequin stage gown with a black leather jacket, gold hoop earrings, holding a vintage microphone, joyful mid-song expression',
  djDuchess: 'DJ Duchess, a cool young woman DJ with box braids: oversized red headphones around her neck, small tiara, black bomber jacket with red trim, one hand on a turntable record, playful smirk',
  princeBreaks: 'Prince Breaks, an energetic teenage b-boy: red tracksuit with white stripes, backwards cap with a tiny crown pin, fresh white sneakers, frozen in a fun dance pose, huge smile',
  countessCanvas: 'Countess Canvas, an artistic young woman graffiti writer: paint-splattered black overalls, red bandana, small crown hair clip, spray can in each hand, proud grin',
  griot: 'The Griot, a kind wise elder storyteller: white beard, round glasses, patterned red and black kente-style robe, wooden walking staff topped with a small gold crown, gentle smile',
  buzzkill: 'Baron Buzzkill, a grumpy comic villain shaped like a living grey loudspeaker with arms and a scowling face, little black top hat, harmless and silly looking',
  lipsync: 'Lady Lip-Sync, a sneaky comic villain diva: purple-grey bob wig, big sunglasses, oversized fake microphone that is clearly a toy, scheming smirk, silly not scary',
  'static-boss': 'King Static, the main comic villain: a lanky king made of grey TV static with glowing red eyes, a crooked black crown with antenna spikes, a long black cape, theatrical pout, silly not scary, kid friendly',
};

const SCENES = {
  block: 'a city block party on a brownstone street at night: turntables center bottom, speaker stacks at left and right, string lights overhead, a graffiti mural on the left wall, a party banner across the top',
  shop: 'a corner record shop at night: neon sign top left, striped red and white awning, album covers in the window, record bins on the sidewalk, a giant vinyl record sign on the right',
  blacktop: 'a fenced basketball court at night: hoop on the left, cardboard dance floor center, bleachers on the right, a boombox on a bench, tall court lights',
  wall: 'a train yard graffiti wall at night: a huge colorful wildstyle piece across the wall, a character mural on the right, paint cans at the bottom, a subway car in front, spotlights at both edges',
  arena: 'an outdoor concert stage at night: main stage at the bottom, speaker towers at both sides, a light rig above, a golden microphone throne in the center, a crown banner at the top',
};

const jobs = [];
for (const [k, who] of Object.entries(PEOPLE)) {
  jobs.push({
    name: 'cast-' + k, out: `portrait-${k}.png`, aspect: '1:1', refs: [join(root, 'assets', k + '.webp')],
    prompt: `Redraw this exact character in a new art style. ${who}. Chest-up portrait, centered, facing the viewer, cut at the chest. ${STYLE} ${KEYBG} ${NOTEXT}`,
  });
}
jobs.push({
  name: 'sheet-tiles', out: 'cut-tiles.png', aspect: '1:1', refs: [join(src, 'v1', 'cut-tiles.png'), join(src, 'cut-tiles.png')],
  prompt: `Redraw these nine game pieces in a new art style, same objects in the same 3 by 3 grid, evenly spaced with clear gaps: row 1 a red microphone, an orange sneaker, a gold chain; row 2 a green snapback cap, blue headphones, a purple cassette mixtape; row 3 a red spray paint can, a black and red boombox, a shiny platinum vinyl record. Each a chunky glossy toy-like 3D icon with a thick dark outline feel, bold readable silhouette, fills its cell. ${STYLE} ${KEYBG} ${NOTEXT}`,
});
jobs.push({
  name: 'sheet-obstacles', out: 'cut-obstacles.png', aspect: '1:1', refs: [join(src, 'v1', 'cut-obstacles.png'), join(src, 'cut-obstacles.png')],
  prompt: `Redraw these nine game objects in a new art style, same objects in the same 3 by 3 grid, evenly spaced with clear gaps: row 1 a golden jeweled crown, a folded red paper airplane flyer, a wooden record crate; row 2 the same crate wrapped in one band of black tape, the same crate wrapped in chains, a block of grey TV static noise; row 3 a strip of torn silver duct tape, a square glowing dance floor tile, a round red cushion. Glossy chunky 3D game objects. ${STYLE} ${KEYBG} ${NOTEXT}`,
});
jobs.push({
  name: 'sheet-icons', out: 'cut-icons.png', aspect: '1:1', refs: [join(src, 'v1', 'cut-icons.png'), join(src, 'cut-icons.png')],
  prompt: `Redraw these nine game UI icons in a new art style, same 3 by 3 grid, evenly spaced: a gold coin with a crown stamp, a gold star, a red padlock, a gold microphone as a hammer, a turntable scratch arrows icon pointing left and right, a speaker with arrows pointing up and down, a red shuffle arrows icon, a white cartoon pointing hand, a gold trophy. Glossy chunky 3D icons with bold silhouettes. ${STYLE} ${KEYBG} ${NOTEXT}`,
});
for (const [k, desc] of Object.entries(SCENES)) {
  jobs.push({
    name: 'scene-' + k, out: `scene-${k}.png`, aspect: '16:9', refs: [join(src, 'v1', `scene-${k}.png`), join(src, `scene-${k}.png`)],
    prompt: `Redraw this scene in a new art style with the same layout and every object in the same place: ${desc}. Lively, lit up, colorful lights, cozy and fun. Wide 16:9 diorama view, no people. ${STYLE} ${NOTEXT}`,
  });
  jobs.push({
    name: 'scene-' + k + '-off', out: `scene-${k}-off.png`, aspect: '16:9', after: 'scene-' + k, refs: [join(src, `scene-${k}.png`)],
    prompt: `Edit this image: keep the exact same camera, layout and buildings, but make the place silent and abandoned. Every light switched off, everything grey and dusty, objects broken, boarded up or taped up, a cold grey static haze over everything. Same art style. ${NOTEXT}`,
  });
  jobs.push({
    name: 'level-' + k, out: `level-${k}.png`, aspect: '9:16', after: 'scene-' + k, refs: [join(src, `scene-${k}.png`)],
    prompt: `Tall 9:16 game level background in the same art style and setting as this image (${desc.split(':')[0]}). A wide empty paved plaza fills the middle 70 percent of the picture where a puzzle board will sit, framed by the street, buildings and lights around the edges and top. Seen from slightly above. No people. ${STYLE} ${NOTEXT}`,
  });
}
jobs.push({
  name: 'logo', out: 'logo.png', aspect: '16:9',
  prompt: `Game logo that reads exactly "RHYME KINGDOM": "RHYME" huge on top in chunky glossy chrome and candy red 3D graffiti letters with a gold crown sitting on the letter R, "KINGDOM" smaller underneath on a red ribbon banner, a gold microphone crossing behind. Bold black outline, sparkles. ${STYLE} ${KEYBG}`,
});

// ------------------------------------------------------------------ the call
const mime = (f) => ({ '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' }[extname(f).toLowerCase()] || 'image/png');
async function generate(job) {
  const parts = [{ text: job.prompt }];
  for (const r of job.refs || []) {
    if (!existsSync(r)) continue;
    parts.push({ inline_data: { mime_type: mime(r), data: readFileSync(r).toString('base64') } });
    break; // first reference that exists
  }
  const body = { contents: [{ parts }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: job.aspect } } };
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': KEY }, body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      const img = (json.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData || p.inline_data);
      if (img) return Buffer.from((img.inlineData || img.inline_data).data, 'base64');
      throw new Error('no image returned: ' + JSON.stringify(json).slice(0, 300));
    }
    const msg = json.error?.message || res.statusText;
    if (res.status === 429 || res.status >= 500) { await new Promise((r) => setTimeout(r, 4000 * attempt)); continue; }
    throw new Error(`${res.status} ${msg}`);
  }
  throw new Error('gave up after retries');
}

// keep the first-generation art for reference
mkdirSync(join(src, 'v1'), { recursive: true });
for (const j of jobs) {
  const f = join(src, j.out);
  if (existsSync(f) && !existsSync(join(src, 'v1', j.out))) copyFileSync(f, join(src, 'v1', j.out));
}

// a job is done once its .gemini-<name> marker exists
const todo = jobs.filter((j) => (!only.length || only.some((o) => j.name.includes(o))) && (force || !existsSync(join(src, '.gemini-' + j.name))));
console.log(`${todo.length} images to make with ${MODEL}`);
const done = new Set();
const run = async (j) => {
  try {
    const buf = await generate(j);
    writeFileSync(join(src, j.out), buf);
    writeFileSync(join(src, '.gemini-' + j.name), new Date().toISOString());
    console.log('ok   ' + j.name);
  } catch (e) { console.log('FAIL ' + j.name + ': ' + e.message); }
  done.add(j.name);
};
let queue = [...todo];
while (queue.length) {
  const ready = queue.filter((j) => !(j.after && todo.some((t) => t.name === j.after) && !done.has(j.after)));
  const batch = ready.slice(0, 3);
  if (!batch.length) break;
  await Promise.all(batch.map(run));
  queue = queue.filter((j) => !batch.includes(j));
}
console.log('next: node tools/slice.mjs && node tools/build.mjs');
