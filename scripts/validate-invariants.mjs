#!/usr/bin/env node
/* Depo geneli değişmezler. README'nin vaat ettiği ama bugüne dek hiçbir
   betiğin denetlemediği kurallar buraya taşındı; CI bu dosyayı koşar ve
   herhangi bir ihlal birleştirmeyi durdurur.

   1. Hareketli + index.html taşıyan her preset motion-manifest.json taşır.
   2. Her motion-manifest.json geçerli JSON'dur (ayrıntılı şema denetimi
      skills/design-scientific-motion/scripts/validate-motion-manifest.mjs).
   3. demo/*.html içindeki her ../presets/... yolu gerçekten var.
   4. Dokümanlardaki sayılar (slayt, beceri, preset·kategori) registry'deki
      taramayla eşleşir — sayı elle yazılmaz, yazılırsa burada yakalanır.
   5. README/KATALOG, depoda olmayan çalışma-ağacı yollarına
      (.agents/, preset-test/) atıf yapamaz ve markdown bağlantıları
      var olan dosyalara gitmelidir.

   Kullanım: node scripts/validate-invariants.mjs [--json]
*/
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(repoRoot, file), 'utf8');
const errors = [];
const warnings = [];
const error = (code, message) => errors.push({ code, message });
const warn = (code, message) => warnings.push({ code, message });

const registry = JSON.parse(read('presets/registry.json'));

/* 1–2 ── motion-manifest varlığı ve geçerliliği */
for (const preset of registry.presets) {
  const manifestPath = path.join(repoRoot, 'presets', preset.name, 'motion-manifest.json');
  if (preset.animated && preset.hasIndex && !fs.existsSync(manifestPath)) {
    error('missing-manifest', `${preset.name}: hareketli preset motion-manifest.json taşımıyor.`);
  }
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (!Array.isArray(manifest.motions) || !manifest.motions.length) {
        error('empty-manifest', `${preset.name}: motion-manifest.json motions dizisi boş.`);
      }
    } catch (parseError) {
      error('invalid-manifest', `${preset.name}: motion-manifest.json geçersiz JSON — ${parseError.message}`);
    }
  }
}

/* 3 ── demo'daki preset yolları çözülür */
for (const demoName of fs.readdirSync(path.join(repoRoot, 'demo')).filter(name => name.endsWith('.html'))) {
  const html = read(path.join('demo', demoName));
  const referenced = new Set(
    [...html.matchAll(/(?:src|href|data-src|data-embed)="(\.\.\/presets\/[^"?#]+)/g)].map(match => match[1]),
  );
  for (const reference of referenced) {
    const target = path.resolve(repoRoot, 'demo', reference.replaceAll('&amp;', '&'));
    if (!fs.existsSync(target)) error('broken-demo-path', `demo/${demoName}: ${reference} bulunamadı.`);
  }
}

/* 4 ── dokümanlardaki sayılar taramayla eşleşir */
const counts = registry.counts;
const validSlideCounts = new Set([counts.demoSlides, counts.ornekDesteSlides]);
const paletteCount = Object.keys(JSON.parse(read('presets/color_themes/palette-library.json')).palettes).length;
for (const doc of ['README.md', 'KATALOG.md', 'demo/index.html']) {
  if (!fs.existsSync(path.join(repoRoot, doc))) continue;
  const text = read(doc);
  for (const match of text.matchAll(/(\d+)\s+slaytlık/g)) {
    if (!validSlideCounts.has(Number(match[1]))) {
      error('stale-count', `${doc}: "${match[0]}" — gerçek sayılar demo ${counts.demoSlides} / örnek deste ${counts.ornekDesteSlides}.`);
    }
  }
  for (const match of text.matchAll(/(\d+)\s+yapay zekâ becerisi/g)) {
    if (Number(match[1]) !== counts.skills) {
      error('stale-count', `${doc}: "${match[0]}" — skills/ altında ${counts.skills} beceri var.`);
    }
  }
  for (const match of text.matchAll(/(\d+)\s+palet\b/gi)) {
    if (Number(match[1]) !== paletteCount) {
      error('stale-count', `${doc}: "${match[0]}" — palette-library.json ${paletteCount} palet taşıyor.`);
    }
  }
  for (const match of text.matchAll(/(\d+)\s+preset\s*·\s*(\d+)\s+kategori/g)) {
    if (Number(match[1]) !== counts.demoCards || Number(match[2]) !== counts.demoCoverSections) {
      error('stale-count', `${doc}: "${match[0]}" — demo ${counts.demoCards} kart · ${counts.demoCoverSections} kategori (arşiv/yeni hariç, build-demo.py kuralı) sayıyor.`);
    }
  }
}

/* 5 ── dokümanlar var olmayan yollara atıf yapamaz. README'nin
   ".agents/skills/ altına kopyalayın" cümlesi kullanım talimatıdır ve
   meşrudur; yasak-desen taraması bu yüzden yalnız KATALOG'a uygulanır,
   bağlantı-hedefi denetimi ise her iki dosyaya. */
for (const doc of ['KATALOG.md']) {
  if (!fs.existsSync(path.join(repoRoot, doc))) continue;
  const text = read(doc);
  for (const forbidden of ['.agents/', '.agents\\', 'preset-test/', 'preset-test\\']) {
    if (text.includes(forbidden)) {
      error('phantom-path', `${doc}: "${forbidden}" çalışma ağacına ait, bu depoda yok.`);
    }
  }
}
for (const doc of ['README.md', 'KATALOG.md']) {
  if (!fs.existsSync(path.join(repoRoot, doc))) continue;
  const text = read(doc);
  for (const match of text.matchAll(/\]\(([^)#?]+?)(?:[#?][^)]*)?\)/g)) {
    const target = match[1].trim();
    if (/^[a-z]+:/i.test(target) || target.startsWith('//')) continue; // http, mailto...
    if (!fs.existsSync(path.join(repoRoot, target))) {
      error('broken-link', `${doc}: bağlantı hedefi yok — ${target}`);
    }
  }
}

/* 6 ── localhost port iddiaları serve.py'nin aday listesindedir. 8781 gibi
   bayat bir port, ölü (ya da yanlış köklü) bir sunucuya yollar ve her
   bağlantı 404/ulaşılamaz görünür — bu tam olarak yaşandı. */
{
  const servePorts = [...read('demo/serve.py').matchAll(/\b8(\d{3})\b/g)].map(m => Number(`8${m[1]}`));
  const izinli = new Set(servePorts);
  for (const doc of ['README.md', 'KATALOG.md', 'demo/index.html', 'demo/ornek-deste.html']) {
    if (!fs.existsSync(path.join(repoRoot, doc))) continue;
    for (const match of read(doc).matchAll(/localhost:(\d+)/g)) {
      if (!izinli.has(Number(match[1]))) {
        error('stale-port', `${doc}: localhost:${match[1]} — serve.py yalnız ${[...izinli].join('/')} kullanır.`);
      }
    }
  }
}

/* rapor */
const result = { errors, warnings };
if (process.argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
else {
  console.log(`Hata: ${errors.length} | Uyarı: ${warnings.length}`);
  for (const item of errors) console.log(`ERROR ${item.code}: ${item.message}`);
  for (const item of warnings) console.log(`WARNING ${item.code}: ${item.message}`);
}
process.exit(errors.length ? 1 : 0);
