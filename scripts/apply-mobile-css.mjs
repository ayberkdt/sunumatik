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
