#!/usr/bin/env node
/* check-syntax.mjs — Tüm .mjs modüllerini ve index.html içindeki <script type="module"> bloklarını
   `node --check` ile derler (çalıştırmaz). Neden: tek tırnaklı dizgelerde Türkçe kesme işareti
   ("J2'yi", "NRHO'ya") üç kez sözdizimi hatası üretti; bu bekçi hata sınıfını CI'da yakalar.
   Kullanım: node scripts/check-syntax.mjs   (çıkış kodu 1 = hata) */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = /node_modules|[\\/]vendor[\\/]|[\\/]\.git[\\/]|[\\/]demo[\\/]/;
const files = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (SKIP.test(p)) continue; if (e.isDirectory()) walk(p); else if (/\.mjs$/.test(e.name) || e.name === 'index.html') files.push(p); } })(root);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sunumatik-syntax-'));
let errors = 0, checked = 0;
function check(file, label) {
  checked++;
  try { execFileSync(process.execPath, ['--check', file], { stdio: ['ignore', 'ignore', 'pipe'] }); }
  catch (err) { errors++; const msg = String(err.stderr || err.message).split('\n').filter(l => /SyntaxError|Error:/.test(l) || /\^/.test(l)).slice(0, 2).join(' · ') || String(err.message).split('\n')[0]; console.error(`HATA ${label}: ${msg}`); }
}
for (const f of files) {
  const rel = path.relative(root, f);
  if (f.endsWith('.mjs')) check(f, rel);
  else {
    const html = fs.readFileSync(f, 'utf8'); const re = /<script\s+type="module"[^>]*>([\s\S]*?)<\/script>/g; let m, i = 0;
    while ((m = re.exec(html))) { const t = path.join(tmp, `${rel.replace(/[\\/]/g, '__')}.${i++}.mjs`); fs.writeFileSync(t, m[1]); check(t, `${rel} <script type="module"> #${i}`); }
  }
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`Sözdizimi denetimi: ${checked} modül/blok, ${errors} hata`);
process.exit(errors ? 1 : 0);
