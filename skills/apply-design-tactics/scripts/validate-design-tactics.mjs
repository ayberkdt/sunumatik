#!/usr/bin/env node
/* Koşullu tasarım taktikleri denetleyicisi — deste HTML'i alır, taktik
   kataloğundaki (references/tactics-catalog.md) OTOMATİK saptanabilir
   belirtileri arar.

   Tasarım ilkesi: uydurma yok. Bir belirti kaynaktan ölçülemiyorsa kural
   yazılmaz; onun yerine "göz testi" listesinde hatırlatma olarak çıkar.

   Türkçe notu: JS'in \b sözcük sınırı ç/ı/ğ/ş/ö/ü üzerinde kırılır
   (validate-assertions.mjs'te öğrenilen ders). Bu dosyada metin
   ayrıştırması \p{L} sınıflarıyla, büyük/küçük harf dönüşümü ise
   toLocaleUpperCase('tr') / toLocaleLowerCase('tr') ile yapılır.

   Kullanım:
     node validate-design-tactics.mjs <deste.html> [...] [--strict] [--json]
   Çıkış kodu: HATA varsa 1, yalnız uyarı varsa 0 (--strict uyarıları da
   hataya yükseltir). */

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

/* ── CLI ─────────────────────────────────────────────────────────── */
const argv = process.argv.slice(2);
const strict = argv.includes('--strict');
const asJson = argv.includes('--json');
const files = argv.filter(a => !a.startsWith('--'));
if (!files.length) {
  console.error('kullanım: node validate-design-tactics.mjs <deste.html> [...] [--strict] [--json]');
  process.exit(1);
}

/* ── eşikler ─────────────────────────────────────────────────────── */
const LIMIT = {
  axes: 5,          // T-01: slayt başına benzersiz x-ekseni
  fontSizes: 12,    // T-09: deste genelinde benzersiz punto
  radii: 4,         // T-22: benzersiz köşe yarıçapı
  shadows: 2,       // T-23: yükseklik kademesi
  measure: 75,      // T-10: satır başına karakter
  bodyCenter: 40,   // T-11: bu puntonun altı "gövde" sayılır
  motion: 1,        // T-29: slayt başına anlatı hareketi
  cardFloor: 24,    // T-14: kart bağlamı punto tabanı
  gradDelta: 60,    // T-15: iki durak arası algısal fark eşiği (0-255 ölçeği)
  gradAlpha: 0.45,  // T-15: iki durak arası alfa farkı eşiği
  smallPx: 6        // ≤ bu kalınlıktaki şeritlerde bantlaşma görünmez
};

/* ── küçük yardımcılar ───────────────────────────────────────────── */
const stripComments = css => css.replace(/\/\*[\s\S]*?\*\//g, '');

/* @keyframes / @font-face gövdelerini at: iç blokları kural sanmayalım */
function dropAtBlocks(css, names) {
  let out = '';
  for (let i = 0; i < css.length;) {
    const m = /@(keyframes|-webkit-keyframes|font-face|supports)\b/gi.exec(css.slice(i));
    if (!m) { out += css.slice(i); break; }
    const start = i + m.index;
    out += css.slice(i, start);
    let j = css.indexOf('{', start);
    if (j < 0) { break; }
    let depth = 0;
    for (; j < css.length; j++) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') { depth--; if (!depth) { j++; break; } }
    }
    i = j;
  }
  return out;
}

const numsPx = str => [...String(str).matchAll(/(-?\d*\.?\d+)px/g)].map(m => parseFloat(m[1]));

/* renk → {r,g,b,a}; çözülemezse null (uydurma yok) */
function parseColor(raw, vars) {
  let s = String(raw).trim().toLocaleLowerCase('tr');
  for (let pass = 0; pass < 4 && s.includes('var('); pass++) {
    s = s.replace(/var\(\s*(--[\w-]+)\s*(?:,[^)]*)?\)/g, (_, n) => vars[n] ?? _);
  }
  s = s.trim();
  if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  let m = /^#([0-9a-f]{3,8})$/.exec(s);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map(c => c + c).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16),
             b: parseInt(h.slice(4, 6), 16),
             a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1 };
  }
  m = /^rgba?\(([^)]+)\)$/.exec(s);
  if (m) {
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(parseFloat);
    if (p.length < 3 || p.slice(0, 3).some(Number.isNaN)) return null;
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 && !Number.isNaN(p[3]) ? p[3] : 1 };
  }
  return null;
}

/* ağırlıklı RGB uzaklığı — projeksiyonda bantlaşan farkı kabaca yakalar */
function colorDelta(a, b) {
  const rm = (a.r + b.r) / 2;
  const dr = a.r - b.r, dg = a.g - b.g, db = a.b - b.b;
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}

/* gradient argümanlarını üst düzey virgülden böl (iç parantezleri korur) */
function splitTop(str) {
  const out = []; let depth = 0, cur = '';
  for (const ch of str) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && !depth) { out.push(cur); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map(s => s.trim());
}

/* ── HTML ayrıştırma ─────────────────────────────────────────────── */
function parseDeck(html) {
  const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]).join('\n');
  const css = dropAtBlocks(stripComments(styles), true);

  /* :root özel değişkenleri (var() çözümü için) */
  const vars = {};
  for (const m of css.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+)/g)) vars[m[1]] = m[2].trim();

  /* kurallar: seçici + bildirimler */
  const rules = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].trim().replace(/\s+/g, ' ');
    if (!sel || sel.startsWith('@')) continue;
    const decls = {};
    for (const d of m[2].split(';')) {
      const i = d.indexOf(':');
      if (i < 0) continue;
      decls[d.slice(0, i).trim().toLocaleLowerCase('tr')] = d.slice(i + 1).trim();
    }
    rules.push({ sel, decls, raw: m[2] });
  }

  /* slaytlar: <section class="slide ..."> sınırlarından böl */
  const marks = [...html.matchAll(/<section[^>]*class="[^"]*\bslide\b[^"]*"[^>]*>/gi)];
  const slides = marks.map((m, i) => ({
    n: i + 1,
    open: m[0],
    html: html.slice(m.index, i + 1 < marks.length ? marks[i + 1].index : html.length)
  }));

  return { css, vars, rules, slides, html };
}

/* etiketleri at, metni Unicode-duyarlı topla */
function textOf(fragment) {
  return fragment
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ').trim();
}

/* ── denetim ─────────────────────────────────────────────────────── */
function audit(file, html) {
  const deck = parseDeck(html);
  const F = [];
  const add = (slide, rule, level, msg, tactic) =>
    F.push({ file, slide, rule, level, msg, tactic });

  const allDecls = [];                       /* {sel, prop, val, slide} */
  for (const r of deck.rules)
    for (const [p, v] of Object.entries(r.decls))
      allDecls.push({ sel: r.sel, prop: p, val: v, slide: '—', rule: r });

  /* satır içi style="" bildirimleri — açılış etiketiyle birlikte, slayta bağlı.
     Etiketin sınıf/data nitelikleri bağlam (seçici yerine geçer). */
  const TAG_WITH_STYLE = /<([a-zA-Z][\w-]*)\b([^<>]*?style="([^"]*)"[^<>]*)>/g;
  const inlineBySlide = new Map();
  const collectInline = (fragment, slideLabel) => {
    const list = [];
    for (const m of fragment.matchAll(TAG_WITH_STYLE)) {
      const ctx = `<${m[1]}${m[2].replace(/style="[^"]*"/, '').replace(/\s+/g, ' ').trimEnd()}>`;
      for (const d of m[3].split(';')) {
        const i = d.indexOf(':');
        if (i < 0) continue;
        list.push({ sel: ctx.slice(0, 90), prop: d.slice(0, i).trim().toLocaleLowerCase('tr'),
                    val: d.slice(i + 1).trim(), slide: slideLabel });
      }
    }
    return list;
  };
  const slideSpan = deck.slides.length
    ? [html.indexOf(deck.slides[0].open), html.length] : null;
  for (const s of deck.slides) {
    const list = collectInline(s.html, String(s.n).padStart(2, '0'));
    inlineBySlide.set(s.n, list);
    allDecls.push(...list);
  }
  /* slayt bloklarının DIŞINDA kalan satır içi stiller (şablon/JS dizeleri) */
  const outside = slideSpan ? html.slice(0, slideSpan[0]) : html;
  allDecls.push(...collectInline(outside, '—'));
  /* JS şablon dizelerindeki style="..." parçaları (slaytlardan sonra tanımlanır) */
  const tail = slideSpan ? html.slice(html.lastIndexOf('</section>') + 10) : '';
  allDecls.push(...collectInline(tail, '—'));

  const vals = prop => allDecls.filter(d => d.prop === prop);

  /* ── R1 font-scale (T-09) ─────────────────────────────────────── */
  const sizes = new Set();
  for (const d of vals('font-size')) for (const n of numsPx(d.val)) sizes.add(n);
  for (const d of allDecls.filter(d => d.prop === 'font')) for (const n of numsPx(d.val)) sizes.add(n);
  if (sizes.size > LIMIT.fontSizes) {
    const sorted = [...sizes].sort((a, b) => a - b);
    add('—', 'font-scale', 'UYARI',
      `${sizes.size} farklı punto (eşik ${LIMIT.fontSizes}): ${sorted.join(', ')} — 6-8 basamaklı modüler ölçeğe yuvarla ve jetonla`, 'T-09');
  }

  /* ── R2 radius-scale (T-22) ───────────────────────────────────── */
  const radii = new Set();
  for (const d of allDecls.filter(d => d.prop.startsWith('border-radius')))
    for (const n of numsPx(d.val)) if (n < 100) radii.add(n);   /* 999 = pill, ölçek dışı */
  if (radii.size > LIMIT.radii) {
    add('—', 'radius-scale', 'UYARI',
      `${radii.size} farklı köşe yarıçapı (eşik ${LIMIT.radii}): ${[...radii].sort((a, b) => a - b).join(', ')} — 2-3 basamağa indir, iç yarıçap = dış − dolgu`, 'T-22');
  }

  /* ── R3 shadow-tiers (T-23) ───────────────────────────────────── */
  const shadows = new Set();
  for (const d of allDecls.filter(d => d.prop === 'box-shadow'))
    if (!/^none$/i.test(d.val)) shadows.add(d.val.replace(/\s+/g, ' ').toLocaleLowerCase('tr'));
  if (shadows.size > LIMIT.shadows) {
    add('—', 'shadow-tiers', 'UYARI',
      `${shadows.size} farklı gölge değeri (eşik ${LIMIT.shadows}) — iki yükseklik kademesine indir (--elev-1 durgun, --elev-2 hover)`, 'T-23');
  }

  /* ── R4 neon-glow (T-21) — HATA ───────────────────────────────── */
  for (const d of allDecls.filter(d => d.prop === 'box-shadow' || d.prop === 'text-shadow' || d.prop === 'filter')) {
    const glow = /(^|[\s,])0\s+0\s+(\d+)px/.exec(d.val);
    const drop = /drop-shadow\(\s*0\s+0\s+(\d+)px/.exec(d.val);
    const blurPx = glow ? +glow[2] : drop ? +drop[1] : 0;
    if (blurPx >= 8) {
      const col = parseColor((d.val.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)/) || [])[0] || '', deck.vars);
      const sat = col ? Math.max(col.r, col.g, col.b) - Math.min(col.r, col.g, col.b) : 999;
      if (sat > 40)
        add(d.slide, 'neon-glow', 'HATA',
          `${d.sel} { ${d.prop}: ${d.val.slice(0, 60)} } — doygun ışıma yasak; ayrımı değer kontrastıyla kur`, 'T-21');
    }
  }

  /* ── R5 glass-blur (T-20) — HATA ──────────────────────────────── */
  for (const d of allDecls.filter(d => /^(-webkit-)?backdrop-filter$/.test(d.prop) || d.prop === 'filter')) {
    if (/blur\(\s*([\d.]+)px/.test(d.val)) {
      const px = +/blur\(\s*([\d.]+)px/.exec(d.val)[1];
      if (d.prop.includes('backdrop') || px >= 10)
        add(d.slide, 'glass-blur', 'HATA',
          `${d.sel} { ${d.prop}: ${d.val.slice(0, 50)} } — cam panel yerine opak --color-surface + --color-rule hairline`, 'T-20');
    }
  }

  /* ── R6 hard-gradient (T-15) ──────────────────────────────────── */
  for (const d of allDecls) {
    if (!/linear-gradient\(/i.test(d.val)) continue;
    for (const g of d.val.matchAll(/linear-gradient\(([^()]*(?:\([^()]*\)[^()]*)*)\)/gi)) {
      const parts = splitTop(g[1]);
      const stops = parts.filter(p => !/^(to\b|-?[\d.]+(deg|turn|rad|grad)$|in\s)/i.test(p));
      if (stops.length !== 2) continue;                       /* 3+ durak = eased sayılır */
      const c1 = parseColor(stops[0].replace(/\s+-?[\d.]+%?$/, ''), deck.vars);
      const c2 = parseColor(stops[1].replace(/\s+-?[\d.]+%?$/, ''), deck.vars);
      if (!c1 || !c2) continue;
      /* ince şerit / küçük öğede bantlaşma görünmez → susturulur */
      const thin = d.rule && numsPx(d.rule.decls.height || '').some(n => n <= LIMIT.smallPx);
      if (thin) continue;
      const dCol = colorDelta(c1, c2), dA = Math.abs(c1.a - c2.a);
      if (dCol > LIMIT.gradDelta || dA > LIMIT.gradAlpha)
        add(d.slide, 'hard-gradient', 'UYARI',
          `${d.sel} { ${d.prop} } iki duraklı degrade (Δrenk≈${Math.round(dCol)}, Δalfa=${dA.toFixed(2)}) — çok duraklı easing, oklab karışımı ya da düz dolgu kullan`, 'T-15');
    }
  }

  /* ── R7 data-color-decor (T-17) ───────────────────────────────── */
  /* Meşru veri bağlamı: grafik işareti, lejant kutucuğu, seri etiketi.
     Bunlar dışındaki her kullanım dekoratiftir. */
  const CHARTISH = /(chart|plot|\bbar\b|bar-|series|legend|swatch|axis|tick|\bdata-\d|heat|cell|point|line-|marker|sci-chart|dot)/i;
  const DECOR = /^(color|border|border-color|border-top|border-bottom|border-left|border-right|outline|text-decoration-color)$/;
  for (const d of allDecls) {
    if (!/var\(\s*--color-data-\d/.test(d.val)) continue;
    if (CHARTISH.test(d.sel)) continue;               /* veri işareti — meşru */
    if (DECOR.test(d.prop))
      add(d.slide, 'data-color-decor', 'UYARI',
        `${d.sel} { ${d.prop}: ${d.val.slice(0, 40)} } — veri rengi dekoratif kullanılmış; süs için --color-accent / --color-rule`, 'T-17');
    else if (/^background(-color)?$/.test(d.prop))
      add(d.slide, 'data-color-decor', 'UYARI',
        `${d.sel} { ${d.prop} } — veri rengi zemin olarak kullanılmış; hue veri kodlamasına ayrılır`, 'T-17');
  }

  /* ── R8 pure-extremes (T-16) ──────────────────────────────────── */
  const PURE = /(#fff\b|#ffffff\b|#000\b|#000000\b|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\)|rgb\(\s*0\s*,\s*0\s*,\s*0\s*\))/i;
  for (const d of allDecls) {
    if (!/^(color|background|background-color|fill)$/.test(d.prop)) continue;
    if (PURE.test(d.val))
      add(d.slide, 'pure-extremes', 'UYARI',
        `${d.sel} { ${d.prop}: ${d.val.slice(0, 40)} } — saf uç halasyon yapar; --color-canvas / --color-ink kullan`, 'T-16');
  }

  /* ── R9 line-measure (T-10) ───────────────────────────────────── */
  for (const r of deck.rules) {
    const fs = numsPx(r.decls['font-size'] || '')[0];
    const w = numsPx(r.decls['max-width'] || r.decls.width || '')[0];
    if (!fs || !w) continue;
    const ch = Math.round(w / (0.5 * fs));
    if (ch > LIMIT.measure)
      add('—', 'line-measure', 'UYARI',
        `${r.sel} ≈ ${ch} karakter/satır (${w}px ÷ ${fs}px, eşik ${LIMIT.measure}) — max-width'i 45-75ch aralığına çek`, 'T-10');
  }

  /* ── R10 lowercase-tracking (T-12) ────────────────────────────── */
  for (const r of deck.rules) {
    const ls = r.decls['letter-spacing'];
    if (!ls) continue;
    const v = parseFloat(ls);
    if (!(v > 0)) continue;
    const upper = /uppercase/i.test(r.decls['text-transform'] || '');
    if (!upper)
      add('—', 'lowercase-tracking', 'UYARI',
        `${r.sel} { letter-spacing: ${ls} } küçük harfte pozitif aralık — yalnız BÜYÜK HARFTE aç, büyük puntoda negatife geç`, 'T-12');
  }

  /* ── R11 centered-body (T-11) ─────────────────────────────────── */
  for (const r of deck.rules) {
    if (!/center/i.test(r.decls['text-align'] || '')) continue;
    const fs = numsPx(r.decls['font-size'] || '')[0];
    if (fs && fs <= LIMIT.bodyCenter)
      add('—', 'centered-body', 'UYARI',
        `${r.sel} { text-align: center; font-size: ${fs}px } — gövde metni okuma için sola yaslanır; ortalama kahraman anlara`, 'T-11');
  }

  /* ── R12 type-floor (T-14) ────────────────────────────────────── */
  for (const r of deck.rules) {
    if (!/\b(card|panel|kws|stat|tile|note|caption|credit)\b/i.test(r.sel)) continue;
    const fs = numsPx(r.decls['font-size'] || '')[0];
    if (fs && fs < LIMIT.cardFloor)
      add('—', 'type-floor', 'UYARI',
        `${r.sel} { font-size: ${fs}px } < ${LIMIT.cardFloor}px kart/panel tabanı — puntoyu değil kopyayı kes (enforce-slide-copy-density)`, 'T-14');
  }

  /* ── R13 alignment-axes (T-01) ────────────────────────────────── */
  for (const s of deck.slides) {
    const axes = new Set();
    for (const d of inlineBySlide.get(s.n) || []) {
      if (/^(left|right|margin-left|margin-right|padding-left|padding-right|text-indent)$/.test(d.prop))
        for (const n of numsPx(d.val)) axes.add(`${d.prop}:${n}`);
      if (d.prop === 'transform') {
        const t = /translateX\(\s*(-?[\d.]+)px/.exec(d.val);
        if (t) axes.add(`tx:${t[1]}`);
      }
    }
    const aligns = new Set([...s.html.matchAll(/text-align\s*:\s*([a-z]+)/gi)].map(m => m[1].toLocaleLowerCase('tr')));
    const total = axes.size + Math.max(0, aligns.size - 1);
    if (total > LIMIT.axes)
      add(String(s.n).padStart(2, '0'), 'alignment-axes', 'UYARI',
        `${total} hizalama ekseni (satır içi koordinat ${axes.size} + hizalama çeşidi ${aligns.size}, eşik ${LIMIT.axes}) — üç eksene indir`, 'T-01');
  }

  /* ── R14 motion-budget (T-29) ─────────────────────────────────── */
  const MOTION = /\b(data-enter|data-anim|data-card-cascade|data-cascade|data-morph|data-count|data-typewriter|data-camera)\b/gi;
  for (const s of deck.slides) {
    const hooks = [...s.html.matchAll(MOTION)].map(m => m[1].toLocaleLowerCase('tr'));
    const uniq = [...new Set(hooks)];
    if (uniq.length > LIMIT.motion)
      add(String(s.n).padStart(2, '0'), 'motion-budget', 'UYARI',
        `${uniq.length} anlatı hareketi (${uniq.join(', ')}) — slayt başına TEK hareket bırak`, 'T-29');
  }

  /* ── R15 caps-tracking-tr (T-12 tamamlayıcı) ──────────────────── */
  /* Türkçe: I/İ ayrımı yüzünden toUpperCase() yanlış sonuç verir. */
  for (const s of deck.slides) {
    for (const m of s.html.matchAll(/>([^<>]{6,120})</g)) {
      const t = m[1].replace(/&[a-z]+;/gi, ' ').trim();
      if (!t || !/\p{L}/u.test(t)) continue;
      /* katalog kimlikleri ve ölçüm kodları meşru büyük harftir: rakam ya da
         alt çizgi taşıyan dizeleri atla (GRAIL JGGRX_1800F, DE440, NASA · 2016) */
      if (/[\d_]/.test(t)) continue;
      const words = t.split(/[^\p{L}]+/u).filter(w => w.length >= 3);
      if (words.length < 3) continue;               /* kısaltma değil, cümle ara */
      const letters = [...t].filter(c => /\p{L}/u.test(c));
      if (letters.length < 12) continue;
      if (t === t.toLocaleUpperCase('tr') && t !== t.toLocaleLowerCase('tr'))
        add(String(s.n).padStart(2, '0'), 'caps-run', 'UYARI',
          `kaynakta tamamı BÜYÜK HARF metin: "${t.slice(0, 44)}" — büyük harfi CSS text-transform ile yap, harf aralığını orada aç`, 'T-12');
    }
  }

  return { findings: F, slideCount: deck.slides.length, ruleCount: deck.rules.length };
}

/* ── göz testleri (otomatikleştirilemeyenler) ────────────────────── */
const EYE_TESTS = [
  'T-02 düğmelerde optik hizalama (ikon kütlesi vs sınırlayıcı kutu)',
  'T-03 ikon + etiket cap-height hizası',
  'T-05 eş kart yükseklikleri',
  'T-06 dikey ritmin 8/16/24/40/64 ölçeğine oturması',
  'T-07 yakınlık gruplaması (gözü kıs testi)',
  'T-13 başlıkta dul/öksüz satır',
  'T-18 nötr ailesi (kirli deste tanısı)',
  'T-19 slayt başına tek baskın vurgu alanı',
  'T-24 tabloda dikey çizgi kalıntısı',
  'T-25 uzak lejant / doğrudan etiketleme',
  'T-27 ikonların görsel kütle eşitliği',
  'T-28 görsel kenarı ile metin arasındaki karar',
  'T-30 okuma sırasında süren ortam hareketi'
];

/* ── çalıştır ────────────────────────────────────────────────────── */
const all = [];
let slides = 0, rules = 0;
for (const f of files) {
  const res = audit(f, readFileSync(f, 'utf8'));
  all.push(...res.findings);
  slides += res.slideCount; rules += res.ruleCount;
}

const errors = all.filter(f => f.level === 'HATA');
const warns = all.filter(f => f.level === 'UYARI');

if (asJson) {
  console.log(JSON.stringify({ slides, rules, errors: errors.length, warnings: warns.length, findings: all }, null, 2));
} else {
  console.log(`Dosya: ${files.length} · Slayt: ${slides} · CSS kuralı: ${rules} · HATA: ${errors.length} · UYARI: ${warns.length}\n`);
  let last = '';
  for (const f of [...errors, ...warns]) {
    const tag = basename(f.file);
    if (tag !== last) { console.log(tag); last = tag; }
    console.log(`  slayt ${f.slide} · ${f.rule} · ${f.level} · [${f.tactic}] ${f.msg}`);
  }
  console.log('\nGöz testi gereken taktikler (otomatik saptanamaz):');
  for (const e of EYE_TESTS) console.log('  · ' + e);
}

process.exit((errors.length || (strict && warns.length)) ? 1 : 0);
