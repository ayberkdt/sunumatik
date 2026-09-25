#!/usr/bin/env node
/* apply-mobile-css.mjs — links presets/core/mobile.css from every preset
 * page, immediately AFTER that page's own <style> block.
 *
 * Source order matters here: the shared layer has to come last so its
 * media-query rules win the cascade against the page's own layout at equal
 * specificity. Inserting it by hand in 65 files is how one of them ends up
 * in the wrong place and nobody notices until a phone opens that one page.
 *
 *   node scripts/apply-mobile-css.mjs           insert where missing
 *   node scripts/apply-mobile-css.mjs --check   exit 1 if any page lacks it
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');

const pages = fs.readdirSync(path.join(root, 'presets'), { withFileTypes: true })
  .filter(e => e.isDirectory())
  .map(e => path.join('presets', e.name, 'index.html'))
  .filter(p => fs.existsSync(path.join(root, p)));

let added = 0, already = 0;
const missing = [];

for (const rel of pages) {
  const abs = path.join(root, rel);
  let src = fs.readFileSync(abs, 'utf8');
  /* Depth from the page to presets/core: every preset page sits at
     presets/<name>/index.html, so the shared file is always one up. */
  const href = '../core/mobile.css';
  const tag = `  <link rel="stylesheet" href="${href}">`;

  if (src.includes(href)) { already++; continue; }
  if (check) { missing.push(rel); continue; }

  /* After the LAST </style> in the head, or before </head> if the page has
     no inline style at all. */
  const headEnd = src.indexOf('</head>');
  const lastStyle = src.lastIndexOf('</style>', headEnd === -1 ? undefined : headEnd);
  if (lastStyle !== -1) {
    const at = lastStyle + '</style>'.length;
    src = src.slice(0, at) + '\n' + tag + src.slice(at);
  } else if (headEnd !== -1) {
    src = src.slice(0, headEnd) + tag + '\n' + src.slice(headEnd);
  } else {
    console.error(`apply-mobile-css: no <head> in ${rel}`);
    process.exit(2);
  }
  fs.writeFileSync(abs, src, 'utf8');
  added++;
}/* ── the shared component must be COVERED, not merely linked ──────────
   Seven preset pages are built on presets/moon_react_source/components,
   whose figure pins its children with `position: absolute`. On a phone that
   put the controls container over the whole scene - measured at 375x812,
   the canvas never appeared and the article caption bled through the gaps
   between the control panels - and this script still reported every page
   green, because linking a stylesheet is not the same as being covered by
   it.

   So the list is DERIVED from the component stylesheet rather than written
   out here: whatever it pins absolutely has to be either de-pinned below
   the breakpoint or named below as a deliberate overlay. */
const bilesenCss = path.join(root, 'presets/moon_react_source/components/moon_react_source.css');
if (fs.existsSync(bilesenCss)) {
  const css = fs.readFileSync(bilesenCss, 'utf8');
  const mobil = fs.readFileSync(path.join(root, 'presets/core/mobile.css'), 'utf8');

  /* Transient overlays are SUPPOSED to cover the scene; that is what they
     are for. Named with the reason rather than silently skipped. */
  const ortuler = new Map([
    ['.lunaris-preset__loading', 'yükleme göstergesi — sahneyi örtmesi işinin ta kendisi'],
    ['.lunaris-preset__help', 'yardım katmanı — istenerek sahnenin üstüne gelir'],
  ]);

  /* Every selector that carries `position: absolute` in the component. */
  const mutlak = new Set();
  const kurallar = css.split('}');
  for (const k of kurallar) {
    if (!/position\s*:\s*absolute/.test(k)) continue;
    const basi = k.slice(0, k.lastIndexOf('{'));
    for (const m of basi.matchAll(/\.(lunaris-preset[\w-]*)/g)) mutlak.add('.' + m[1]);
  }

  /* De-pinned below the breakpoint = named in a rule that sets position
     static. The whole file is inside one media query, so presence is
     enough; what matters is that the class is not forgotten. */
  const acikta = [];
  for (const sinif of mutlak) {
    if (ortuler.has(sinif)) continue;
    const kacis = new RegExp(sinif.replace('.', '\\.') + '\\b[^{]*\\{[^}]*position\\s*:\\s*static', 'm');
    const bahsi = mobil.includes(sinif);
    if (!bahsi || !kacis.test(mobil)) acikta.push(sinif);
  }
  if (acikta.length) {
    console.error(`${acikta.length} lunaris-preset kapsayıcısı mobilde hâlâ sabitlenmiş:`);
    for (const a of acikta) console.error(`  ${a} — core/mobile.css içinde position: static kuralı yok`);
    console.error('Telefonda bu, sahnenin üstünü örten bir katman demektir.');
    process.exit(1);
  }
  console.log(`lunaris-preset: ${mutlak.size} mutlak kapsayıcı, ${mutlak.size - ortuler.size} tanesi mobilde serbest, ${ortuler.size} bilinçli örtü.`);
}



if (check) {
  if (missing.length) {
    console.error(`${missing.length} preset page(s) do not link core/mobile.css:`);
    for (const m of missing) console.error(`  ${m}`);
    console.error('Run `node scripts/apply-mobile-css.mjs`.');
    process.exit(1);
  }
  console.log(`all ${already} preset pages link core/mobile.css.`);
} else {
  console.log(`core/mobile.css: ${added} page(s) linked, ${already} already had it.`);
}
