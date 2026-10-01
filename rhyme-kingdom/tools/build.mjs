// Bundles index.html + css + js into one self-contained file.
//   node tools/build.mjs            -> dist/rhyme-kingdom.html (open it anywhere)
//   node tools/build.mjs --fragment -> dist/rhyme-kingdom.fragment.html
//                                      (no <html>/<head>/<body> wrapper, for hosts
//                                      that supply their own page skeleton)
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fragment = process.argv.includes('--fragment');
const html = readFileSync(join(root, 'index.html'), 'utf8');

const block = (name) => {
  const m = new RegExp(`<!-- build:${name} -->([\\s\\S]*?)<!-- /build:${name} -->`).exec(html);
  if (!m) throw new Error(`missing build:${name} block`);
  return m[1].trim();
};

// Inline local stylesheets; keep the Google Fonts link.
const head = block('head').replace(/<link rel="stylesheet" href="(css\/[^"]+)">/g, (_, href) =>
  `<style>\n${readFileSync(join(root, href), 'utf8')}</style>`);

// Every generated image in assets/ ships inside the page as a data URI.
const assets = {};
for (const f of readdirSync(join(root, 'assets')).filter((n) => n.endsWith('.webp')).sort()) {
  assets[f.replace(/\.webp$/, '')] = 'data:image/webp;base64,' + readFileSync(join(root, 'assets', f)).toString('base64');
}
// The soundtrack ships inside the page too (assets/music/*.mp3).
for (const f of readdirSync(join(root, 'assets', 'music')).filter((n) => n.endsWith('.mp3')).sort()) {
  assets['music/' + f.replace(/\.mp3$/, '')] = 'data:audio/mpeg;base64,' + readFileSync(join(root, 'assets', 'music', f)).toString('base64');
}
const assetScript = `<script>window.RK_ASSETS=${JSON.stringify(assets)};</script>`;

// Inline local scripts in order. Escape any "</script" inside the source.
const scripts = assetScript + '\n' + [...block('scripts').matchAll(/<script src="([^"]+)"><\/script>/g)]
  .map((m) => `<script>\n${readFileSync(join(root, m[1]), 'utf8').replace(/<\/script/gi, '<\\/script')}\n</script>`)
  .join('\n');

const body = block('body');
const bodyAttrs = /<body([^>]*)>/.exec(html)[1];

let out;
if (fragment) {
  // The host page provides doctype/head/body; carry the body's data attributes in a script.
  const attrs = [...bodyAttrs.matchAll(/data-([\w-]+)="([^"]*)"/g)]
    .map((m) => `document.body.dataset.${m[1].replace(/-(\w)/g, (_, c) => c.toUpperCase())}=${JSON.stringify(m[2])};`).join('');
  out = `${head}\n<style>html,body{height:100%;margin:0}</style>\n${body}\n<script>${attrs}</script>\n${scripts}\n`;
} else {
  out = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0b0b0c">
${head}
</head>
<body${bodyAttrs}>
${body}
${scripts}
</body>
</html>
`;
}

const file = join(root, 'dist', fragment ? 'rhyme-kingdom.fragment.html' : 'rhyme-kingdom.html');
mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, out);
console.log(`wrote ${file} (${(out.length / 1024).toFixed(0)} KB)`);
