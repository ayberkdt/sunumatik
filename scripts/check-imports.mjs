#!/usr/bin/env node
/* check-imports.mjs — Göreli ES-modül import yollarının var olan dosyalara çözüldüğünü denetler
   (.mjs dosyaları ve index.html <script type="module"> blokları, statik ve dinamik import()).
   Neden: preset'ler birbirinin saf modüllerini paylaşır (core/astro-*, reentry-model, gravity-model…);
   bir dosya taşınır ya da yeniden adlandırılırsa sahne sessizce kırılır. Bu bekçi CI'da yakalar.
   Kullanım: node scripts/check-imports.mjs   (çıkış kodu 1 = kırık import) */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = /node_modules|[\\/]vendor[\\/]|[\\/]\.git[\\/]|[\\/]demo[\\/]|moon_react_source/;
const files = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (SKIP.test(p)) continue; if (e.isDirectory()) walk(p); else if (/\.mjs$/.test(e.name) || e.name === 'index.html') files.push(p); } })(root);

const RE = /(?:^|[^\w.])import\s*(?:[^'"]*?from\s*)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
let errors = 0, checked = 0;
function checkSource(src, baseDir, label) {
  let m; RE.lastIndex = 0;
  while ((m = RE.exec(src))) {
    const spec = m[1] ?? m[2]; if (!spec || !(spec.startsWith('./') || spec.startsWith('../') || spec.startsWith('/'))) continue;
    checked++;
    const target = spec.startsWith('/') ? path.join(root, spec) : path.resolve(baseDir, spec);
    if (!fs.existsSync(target)) { errors++; console.error(`KIRIK ${label}: ${spec} → ${path.relative(root, target)}`); }
  }
}
for (const f of files) {
  const rel = path.relative(root, f), src = fs.readFileSync(f, 'utf8');
  if (f.endsWith('.mjs')) checkSource(src, path.dirname(f), rel);
  else { const re = /<script\s+type="module"[^>]*>([\s\S]*?)<\/script>/g; let m; while ((m = re.exec(src))) checkSource(m[1], path.dirname(f), rel + ' <script type="module">');
    const im = /<script\s+type="importmap"[^>]*>([\s\S]*?)<\/script>/.exec(src); if (im) { try { const map = JSON.parse(im[1]).imports || {}; for (const [k, v] of Object.entries(map)) { checked++; const t = path.resolve(path.dirname(f), v); if (!fs.existsSync(t)) { errors++; console.error(`KIRIK ${rel} importmap ${k}: ${v}`); } } } catch (e) { errors++; console.error(`KIRIK ${rel} importmap JSON: ${e.message}`); } } }
}
console.log(`Import denetimi: ${checked} göreli import, ${errors} kırık`);
process.exit(errors ? 1 : 0);
