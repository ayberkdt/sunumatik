#!/usr/bin/env node
/* Preset envanterini TARAYARAK üretir — elle sayı yazılmaz.
   presets/registry.json bu betiğin çıktısıdır; README/KATALOG/demo'daki
   sayılar validate-invariants.mjs ile bu dosyaya karşı denetlenir.

   Kullanım:
     node scripts/build-registry.mjs            # registry.json'u yeniden yazar
     node scripts/build-registry.mjs --check    # yazmaz; commit'li dosya ile
                                                # taramayı karşılaştırır, fark
                                                # varsa 1 ile çıkar (CI için)
*/
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const presetsDir = path.join(repoRoot, 'presets');
const skillsDir = path.join(repoRoot, 'skills');
const demoFile = path.join(repoRoot, 'demo', 'index.html');
const ornekFile = path.join(repoRoot, 'demo', 'ornek-deste.html');
const registryFile = path.join(presetsDir, 'registry.json');
const checkMode = process.argv.includes('--check');

const read = file => fs.readFileSync(file, 'utf8');

/* "Hareketli" tanımı hesaplanabilir olmalı ki muafiyet listesi çürümesin:
   index.html ya da klasörün üst düzey .mjs/.js/.css dosyalarında sürekli bir
   çevrim (requestAnimationFrame / setInterval / element.animate) veya
   SVG/CSS animasyonu varsa preset hareketlidir. Düz CSS "transition"
   bilerek sayılmaz: hover/reveal geçişi olan her iskeleti hareketli
   saymak tanımı sulandırır. */
const MOTION_PATTERN = /requestAnimationFrame|setInterval\s*\(|\.animate\s*\(|<animate\b|@keyframes/;

function scanPreset(name) {
  const dir = path.join(presetsDir, name);
  const indexFile = path.join(dir, 'index.html');
  const hasIndex = fs.existsSync(indexFile);
  const topSources = fs.readdirSync(dir)
    .filter(entry => /\.(mjs|js|css)$/.test(entry))
    .map(entry => path.join(dir, entry));
  const sources = [hasIndex ? indexFile : null, ...topSources].filter(Boolean);
  const animated = sources.some(file => MOTION_PATTERN.test(read(file)));
  const title = hasIndex ? (read(indexFile).match(/<title>([^<]+)<\/title>/i)?.[1] ?? null) : null;
  return {
    name,
    title,
    hasIndex,
    animated,
    hasMotionManifest: fs.existsSync(path.join(dir, 'motion-manifest.json')),
  };
}

function scanDemo(html) {
  const slides = [...html.matchAll(/<section class="slide/g)].length;
  const cards = [...html.matchAll(/data-tur="kart"/g)].length;
  const sectionCategories = [...html.matchAll(/data-tur="bolum" data-kat="([a-z]+)"/g)].map(match => match[1]);
  /* Kapaktaki "N preset · M kategori" satırı build-demo.py'nin kuralıyla
     sayılır: arşiv ve otomatik-keşif bölümleri kategori sayılmaz. */
  const coverSections = sectionCategories.filter(kat => kat !== 'arsiv' && kat !== 'yeni').length;
  const referenced = [...new Set(
    [...html.matchAll(/\.\.\/presets\/([a-z0-9_]+)\//g)].map(match => match[1]),
  )].sort();
  return { slides, cards, sections: sectionCategories.length, coverSections, referencedPresets: referenced };
}

const presets = fs.readdirSync(presetsDir, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => scanPreset(entry.name))
  .sort((a, b) => a.name.localeCompare(b.name));

const skills = fs.readdirSync(skillsDir, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)
  .sort();

const demo = scanDemo(read(demoFile));
const ornekSlides = [...read(ornekFile).matchAll(/<section class="slide/g)].length;

const registry = {
  $comment: 'scripts/build-registry.mjs üretir — ELLE DÜZENLEMEYİN. CI, taramayla bu dosyanın eşleştiğini doğrular.',
  counts: {
    presets: presets.length,
    presetsWithIndex: presets.filter(preset => preset.hasIndex).length,
    animatedPresets: presets.filter(preset => preset.animated).length,
    skills: skills.length,
    demoSlides: demo.slides,
    demoCards: demo.cards,
    demoSections: demo.sections,
    demoCoverSections: demo.coverSections,
    ornekDesteSlides: ornekSlides,
  },
  demo,
  skills,
  presets,
};

const serialized = `${JSON.stringify(registry, null, 2)}\n`;
if (checkMode) {
  const existing = fs.existsSync(registryFile) ? read(registryFile) : null;
  if (existing === serialized) {
    console.log('registry.json taramayla eşleşiyor.');
  } else {
    console.error(existing === null
      ? 'presets/registry.json yok. `node scripts/build-registry.mjs` çalıştırıp commit edin.'
      : 'presets/registry.json bayat — tarama farklı bir envanter buldu. `node scripts/build-registry.mjs` çalıştırıp commit edin.');
    process.exit(1);
  }
} else {
  fs.writeFileSync(registryFile, serialized);
  console.log(`registry.json yazıldı: ${registry.counts.presets} preset, ${registry.counts.skills} beceri, demo ${demo.slides} slayt / ${demo.cards} kart.`);
}
