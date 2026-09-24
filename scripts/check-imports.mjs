#!/usr/bin/env node
/* check-imports.mjs — Göreli ES-modül import yollarının var olan dosyalara çözüldüğünü denetler
   (.mjs dosyaları ve index.html <script type="module"> blokları, statik ve dinamik import()).
   Neden: preset'ler birbirinin saf modüllerini paylaşır (core/astro-*, reentry-model, gravity-model…);
   bir dosya taşınır ya da yeniden adlandırılırsa sahne sessizce kırılır. Bu bekçi CI'da yakalar.
   Yol doğru ama AD yanlışsa da kırıktır: `import { cylGeoZ } from './geometry-axis.mjs'`
   yol denetiminden geçiyordu çünkü dosya vardı — ad yoktu. Tarayıcıda
   "does not provide an export named" diye patlıyordu ve bu kapıya kadar
   hiçbir yerde görünmüyordu. Artık adlar da denetlenir.
   Kullanım: node scripts/check-imports.mjs   (çıkış kodu 1 = kırık import) */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = /node_modules|[\\/]vendor[\\/]|[\\/]\.git[\\/]|[\\/]demo[\\/]|moon_react_source/;
const files = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (SKIP.test(p)) continue; if (e.isDirectory()) walk(p); else if (/\.mjs$/.test(e.name) || e.name === 'index.html') files.push(p); } })(root);

/* Yorumları söker. Bu denetleyicinin ilk sürümü yorumları da tarıyordu ve
   bir açıklama satırındaki ÖRNEK import'u gerçek sanıyordu (kendi başlık
   yorumundaki `./geometry-axis.mjs` örneği "KIRIK" diye raporlandı). Kaynak
   metni önce temizlenir; dizgi içindeki // ve /* korunur. */
function yorumsuz(src) {
  let out = '', i = 0, n = src.length;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '*') { const k = src.indexOf('*/', i + 2); i = k < 0 ? n : k + 2; out += ' '; continue; }
    if (c === '/' && d === '/') { const k = src.indexOf('\n', i); i = k < 0 ? n : k; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const tirnak = c; out += c; i++;
      while (i < n) { if (src[i] === '\\') { out += src[i] + (src[i + 1] ?? ''); i += 2; continue; } out += src[i]; if (src[i] === tirnak) { i++; break; } i++; }
      continue;
    }
    out += c; i++;
  }
  return out;
}

/* `export const A = 1, B = 2, C = 3;` — TEK bildirimde birden çok ad.
   İlk sürüm yalnız ilk adı görüyordu ve on üç gerçek dışa aktarımı
   "eksik" diye raporluyordu. Bildirim listesi, parantez derinliği
   izlenerek sonuna kadar okunur. */
function bildirimAdlari(src, baslangic) {
  const adlar = [];
  let i = baslangic, derinlik = 0, jeton = '';
  const bitir = () => {
    const t = jeton.trim(); jeton = '';
    const m = /^([A-Za-z_$][\w$]*)\s*(?:=|$)/.exec(t);
    if (m) adlar.push(m[1]);
    /* Yapısal çözme (`export const { a, b } = x`) burada AD VERMEZ ve
       vermemesi doğrudur: adı güvenle çıkaramıyorsak eksik demeyiz. */
  };
  for (; i < src.length; i++) {
    const c = src[i];
    if ('([{'.includes(c)) { derinlik++; jeton += c; continue; }
    if (')]}'.includes(c)) { derinlik--; jeton += c; continue; }
    if (derinlik === 0 && c === ',') { bitir(); continue; }
    if (derinlik === 0 && c === ';') { bitir(); return adlar; }
    if (derinlik === 0 && c === '\n') {
      /* Satır sonu: dengeli ve devam işareti yoksa bildirim bitmiştir. */
      const kalan = jeton.trimEnd();
      if (kalan && !/[,=+\-*/%&|?:([{<>]$/.test(kalan)) { bitir(); return adlar; }
    }
    jeton += c;
  }
  bitir();
  return adlar;
}

/* Bir modülün dışa aktardığı adlar. Yalnız statik biçimler okunur; bir
   modül `export * from` ile yeniden aktarıyorsa o kaynak da izlenir. */
const disaAktarimOnbellek = new Map();
function disaAktarimlar(dosya, gorulen = new Set()) {
  if (disaAktarimOnbellek.has(dosya)) return disaAktarimOnbellek.get(dosya);
  if (gorulen.has(dosya) || !fs.existsSync(dosya)) return null;
  gorulen.add(dosya);
  let src;
  try { src = yorumsuz(fs.readFileSync(dosya, 'utf8')); } catch { return null; }
  const adlar = new Set();
  let yildiz = false;
  /* export function/const/let/var/class/async function */
  for (const m of src.matchAll(/^\s*export\s+(?:async\s+)?(?:function\*?|class)\s+([A-Za-z_$][\w$]*)/gm)) adlar.add(m[1]);
  for (const m of src.matchAll(/^\s*export\s+(?:const|let|var)\s+/gm)) {
    for (const ad of bildirimAdlari(src, m.index + m[0].length)) adlar.add(ad);
  }
  /* export { a, b as c } — yeniden aktarım dahil */
  for (const m of src.matchAll(/^\s*export\s*\{([^}]*)\}/gm)) {
    for (const parca of m[1].split(',')) {
      const t = parca.trim(); if (!t) continue;
      const ad = /\sas\s/.test(t) ? t.split(/\s+as\s+/)[1].trim() : t;
      if (ad) adlar.add(ad);
    }
  }
  if (/^\s*export\s+default\b/m.test(src)) adlar.add('default');
  /* export * from './x.mjs' — kaynağın adları buraya da geçer */
  for (const m of src.matchAll(/^\s*export\s*\*\s*from\s*['"]([^'"]+)['"]/gm)) {
    yildiz = true;
    const hedef = path.resolve(path.dirname(dosya), m[1]);
    const alt = disaAktarimlar(hedef, gorulen);
    if (alt) for (const a of alt.adlar) adlar.add(a);
  }
  const sonuc = { adlar, yildiz };
  disaAktarimOnbellek.set(dosya, sonuc);
  return sonuc;
}

/* `import { a, b as c } from '...'` cümlesinden istenen adlar. Yıldız
   (`* as ns`) ve varsayılan import ad denetimine girmez. */
function istenenAdlar(cumle) {
  const m = /\{([^}]*)\}/.exec(cumle);
  if (!m) return [];
  return m[1].split(',').map(t => t.trim()).filter(Boolean)
    .map(t => (/\sas\s/.test(t) ? t.split(/\s+as\s+/)[0] : t).trim())
    .filter(t => t && t !== 'type');
}

const RE = /(?:^|[^\w.])import\s*(?:[^'"]*?from\s*)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
let errors = 0, checked = 0, adDenetlendi = 0;
function checkSource(ham, baseDir, label) {
  const src = yorumsuz(ham);
  let m; RE.lastIndex = 0;
  while ((m = RE.exec(src))) {
    const spec = m[1] ?? m[2]; if (!spec || !(spec.startsWith('./') || spec.startsWith('../') || spec.startsWith('/'))) continue;
    checked++;
    const target = spec.startsWith('/') ? path.join(root, spec) : path.resolve(baseDir, spec);
    if (!fs.existsSync(target)) { errors++; console.error(`KIRIK ${label}: ${spec} → ${path.relative(root, target)}`); }
  }
  /* Ad denetimi: yalnız göreli, .mjs uzantılı ve kaynağı okunabilen hedefler. */
  const ADRE = /import\s+((?:type\s+)?\{[^}]*\})\s*from\s*['"]([^'"]+)['"]/g;
  let a;
  while ((a = ADRE.exec(src))) {
    const spec = a[2];
    if (!(spec.startsWith('./') || spec.startsWith('../'))) continue;
    if (!/\.mjs$/.test(spec)) continue;
    const hedef = path.resolve(baseDir, spec);
    const disa = disaAktarimlar(hedef);
    if (!disa || disa.yildiz) continue;              // okunamadı ya da yıldız aktarım: sessiz geç
    for (const ad of istenenAdlar(a[1])) {
      adDenetlendi++;
      if (!disa.adlar.has(ad)) {
        errors++;
        console.error(`EKSİK AD ${label}: '${ad}' ${path.relative(root, hedef)} içinde dışa aktarılmıyor`);
      }
    }
  }
}
for (const f of files) {
  const rel = path.relative(root, f), src = fs.readFileSync(f, 'utf8');
  if (f.endsWith('.mjs')) checkSource(src, path.dirname(f), rel);
  else { const re = /<script\s+type="module"[^>]*>([\s\S]*?)<\/script>/g; let m; while ((m = re.exec(src))) checkSource(m[1], path.dirname(f), rel + ' <script type="module">');
    const im = /<script\s+type="importmap"[^>]*>([\s\S]*?)<\/script>/.exec(src); if (im) { try { const map = JSON.parse(im[1]).imports || {}; for (const [k, v] of Object.entries(map)) { checked++; const t = path.resolve(path.dirname(f), v); if (!fs.existsSync(t)) { errors++; console.error(`KIRIK ${rel} importmap ${k}: ${v}`); } } } catch (e) { errors++; console.error(`KIRIK ${rel} importmap JSON: ${e.message}`); } } }
}
console.log(`Import denetimi: ${checked} göreli import, ${adDenetlendi} adlandırılmış giriş, ${errors} kırık`);
process.exit(errors ? 1 : 0);
