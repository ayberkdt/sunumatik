#!/usr/bin/env node
/* Heuristic assertion linter for the copy manifest (same shape as
   enforce-slide-copy-density's manifest, optional top-level "language").
   Emits WARNINGS to review by hand — natural language cannot be gated
   mechanically. NOT regex-\b based: JS \b misfires on Turkish letters
   (ç/ı/ğ break word boundaries), so words are split Unicode-aware and
   suffixes checked with endsWith. */

import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const strict = args.includes('--strict');
const file = args.find(a => !a.startsWith('--'));
if (!file) {
  console.error('kullanım: node validate-assertions.mjs <copy-manifest.json> [--strict]');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(file, 'utf8'));
const language = (manifest.language || 'tr').toLowerCase();

const words = text => String(text).toLocaleLowerCase('tr')
  .split(/[^\p{L}\p{N}.,%→↑↓±×]+/u).filter(Boolean);

const EN_VERBS = new Set(('is are was were be been being has have had do does did can could will would may might ' +
  'must should shows show halves doubles reduces increases improves wins fails holds scales drops rises suggests ' +
  'supports predicts estimates demonstrates means drives causes beats matches needs requires remains becomes keeps ' +
  'makes takes gives gets runs works uses costs saves adds cuts lacks misses outperforms hits reaches stays').split(' '));

/* Türkçe: sözcük SONU çekim ekleri + tek başına yüklem görevi görenler */
const TR_SUFFIXES = ['ıyor','iyor','uyor','üyor','mıştır','miştir','muştur','müştür','mıştı','mişti','muştu','müştü',
  'acak','ecek','acaktır','ecektir','dı','di','du','dü','tı','ti','tu','tü','maz','mez','mazlar','mezler',
  'malı','meli','malıdır','melidir','abilir','ebilir','ıldı','ildi','uldu','üldü','ındı','indi','undu','ündü',
  'ıyoruz','iyoruz','dık','dik','duk','dük','sın','sin','iyorlar','ıyorlar'];
const TR_PREDICATES = new Set(['var','yok','değil','eşit','fazla','az','düşük','yüksek','hızlı','yavaş','aynı',
  'farklı','gerekli','yeterli','yetersiz','mümkün','imkansız','sabit','kararlı','kararsız']);
/* sık isim tuzakları: -dı/-di gibi görünen ama isim olan sonlar */
const TR_NOUN_TRAPS = new Set(['adı','tadı','kedi','yedi','kendi','şimdi','sonuçları','verileri','değerleri']);

const NUM_RELATION = /(→|↑|↓|±|%|×|vs\.?|\bkat\b|göre|karşı|per\b|\d+[.,]?\d*\s*(px|ms|sn|s\b|km|m\b|hz|db|mb|gb))/iu;

const FILLER = language === 'en'
  ? ['optimization','efficiency','synergy','integration','comprehensive','holistic','innovative','robust framework',
     'overview','key findings','takeaways','insights','landscape','journey','empower','leverage']
  : ['optimizasyon','verimlilik','sinerji','entegrasyon','kapsamlı','bütüncül','yenilikçi','güçlü altyapı',
     'genel bakış','önemli bulgular','sonuçlar ve öneriler','değerlendirme','farkındalık'];

const hasFiller = text => {
  const low = String(text).toLocaleLowerCase('tr');
  return FILLER.some(f => low.includes(f));
};

const hasPredicate = text => {
  if (NUM_RELATION.test(String(text))) return true;
  for (const w of words(text)) {
    if (EN_VERBS.has(w)) return true;
    if (TR_PREDICATES.has(w)) return true;
    if (!TR_NOUN_TRAPS.has(w) && TR_SUFFIXES.some(s => w.length > s.length + 1 && w.endsWith(s))) return true;
  }
  return false;
};

/* ok zinciri: kelimeleri birleştiren ≥1 ok (sayısal önce→sonra çifti hariç) */
const isArrowChain = text => {
  const s = String(text);
  const arrows = (s.match(/→|->|=>/g) || []).length;
  if (!arrows) return false;
  /* meşru istisna: iki tarafı da sayı+birim olan TEK ok ("0,42 → 0,21 px") */
  if (arrows === 1 && /[\d.,]+\s*(?:px|ms|sn|s|km|m|%|hz|db|mb|gb)?\s*(?:→|->|=>)\s*[\d.,]+/iu.test(s)) return false;
  return /\p{L}{2,}\s*(?:→|->|=>)|(?:→|->|=>)\s*\p{L}{2,}/u.test(s);
};

const warnings = [];
const warn = (slide, kind, text) =>
  warnings.push(`[${slide}] ${kind}: "${String(text).slice(0, 70)}"`);

for (const slide of manifest.slides || []) {
  const id = slide.id || '?';
  const role = slide.role || '';
  const headline = slide.headline || '';
  /* bölüm ayraçları etiket olabilir; kalan her başlık iddia taşımalı */
  if (headline && role !== 'section' && role !== 'divider') {
    if (!hasPredicate(headline)) warn(id, 'başlık yüklemsiz (etiket gibi)', headline);
    if (hasFiller(headline)) warn(id, 'başlıkta dolgu sözcüğü (Swap Test)', headline);
  }
  for (const b of slide.bullets || []) {
    const w = words(b);
    if (w.length <= 3 && !hasPredicate(b)) warn(id, 'madde konfeti olabilir (kısa + yüklemsiz)', b);
    if (hasFiller(b)) warn(id, 'maddede dolgu sözcüğü', b);
    if (isArrowChain(b)) warn(id, 'ok zinciri (sözde-diyagram — akış bileşeni ya da cümle kullan)', b);
    const s = String(b);
    if (s === s.toLocaleUpperCase('tr') && /\p{Lu}{6,}/u.test(s)) warn(id, 'tamamı büyük harf', b);
  }
  for (const p of slide.body || []) {
    if (hasFiller(p) && !hasPredicate(p)) warn(id, 'gövde satırı iddiasız dolgu', p);
    if (isArrowChain(p)) warn(id, 'ok zinciri (sözde-diyagram)', p);
  }
  if (isArrowChain(headline)) warn(id, 'başlıkta ok zinciri', headline);
}

const slides = (manifest.slides || []).length;
console.log(`Slides: ${slides} | Uyarı: ${warnings.length}`);
for (const w of warnings) console.log('  ' + w);
if (warnings.length) {
  console.log('\nUyarılar elle incelenmeli: özel adlar, bölüm ayraçları ve');
  console.log('tablo/şema bağlamındaki parçalar meşru olabilir (bkz. assertion-craft.md).');
}
process.exit(strict && slides === 0 ? 1 : 0);
