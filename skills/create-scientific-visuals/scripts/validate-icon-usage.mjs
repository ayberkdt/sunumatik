#!/usr/bin/env node
/* İkon kullanım denetimi — bir destenin ikonlarını üç katmana karşı sınar.
 *
 *   node validate-icon-usage.mjs <deste.html> [...]
 *
 * İKİ KURAL:
 *  1. HATA — atıf yapılan her `#i-<ad>` bir sprite'ta GERÇEKTEN var olmalı.
 *     Yazım hatası ya da silinmiş ikon sessizce boş kutu bırakır; export
 *     alındığında fark edilir, sunumda fark edilir.
 *  2. UYARI — bir slaytta UTILITY katmanı (Lucide/Tabler/Phosphor ince kontur)
 *     ile DUOTONE katmanları (bilim + alan seti) birlikte kullanılmamalı.
 *     İki ayrı çizim dili yan yana amatör okunur. Duotone'un iki katmanı
 *     (kahraman + alan) serbestçe karışabilir — aynı elden çıkmışlardır.
 *
 * Çıkış kodu: hata varsa 1, yoksa 0 (uyarılar kodu değiştirmez). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
/* Sprite'lar iki farklı düzende yaşıyor: çalışma ağacında `../assets/...`,
   yayımlanan repoda `presets/charts_icons/...`. İkisini de ara ki betik
   kopyalandığı yerde çalışsın. */
const ROOTS = [
  path.join(HERE, "..", "assets"),                       // .agents/skills/<skill>/assets
  path.join(HERE, "..", "..", "..", "presets", "charts_icons"),  // repo: skills/<skill>/scripts
];
const find = (...rel) => ROOTS.map(r => path.join(r, ...rel)).find(fs.existsSync);
const TIERS = [
  { tier: "hero",    label: "duotone bilim",  file: find("icons", "science-icons.svg") },
  { tier: "domain",  label: "duotone alan",   file: find("domain-icons", "domain-icons.svg") },
  { tier: "utility", label: "utility kontur", file: find("icon-library", "sprite.svg") },
];

const files = process.argv.slice(2);
if (!files.length || files[0] === "--help") {
  console.log("Kullanım: node validate-icon-usage.mjs <deste.html> [...]");
  process.exit(files.length ? 0 : 2);
}

/* id → katman haritası */
const owner = new Map();
const missingSprites = [];
for (const { tier, label, file } of TIERS) {
  if (!file || !fs.existsSync(file)) { missingSprites.push(tier); continue; }
  const svg = fs.readFileSync(file, "utf8");
  for (const m of svg.matchAll(/<symbol[^>]*\sid="(i-[a-z0-9-]+)"/g)) {
    if (!owner.has(m[1])) owner.set(m[1], { tier, label });
  }
}
if (missingSprites.length) {
  console.warn("UYARI: sprite bulunamadı →\n  " + missingSprites.join("\n  "));
}
console.log(`sprite kapsamı: ${owner.size} ikon (${TIERS.map(t => t.tier).join(" · ")})`);

let errors = 0, warnings = 0;

for (const f of files) {
  const html = fs.readFileSync(f, "utf8");
  /* Slaytlara böl; slayt yoksa dosyanın tamamı tek blok sayılır. */
  const blocks = [];
  const re = /<section[^>]*class="[^"]*\bslide\b[^"]*"[\s\S]*?<\/section>/g;
  let m;
  while ((m = re.exec(html))) blocks.push({ name: `slayt ${blocks.length + 1}`, text: m[0] });
  if (!blocks.length) blocks.push({ name: "dosya", text: html });

  const seen = new Map();          /* id → kaç kez */
  const unknown = new Set();

  blocks.forEach(block => {
    const tiersHere = new Map();   /* tier → [id...] */
    for (const u of block.text.matchAll(/<use[^>]*\shref="[^"#]*#(i-[a-z0-9-]+)"/g)) {
      const id = u[1];
      seen.set(id, (seen.get(id) || 0) + 1);
      const own = owner.get(id);
      if (!own) { unknown.add(id); continue; }
      if (!tiersHere.has(own.tier)) tiersHere.set(own.tier, []);
      tiersHere.get(own.tier).push(id);
    }
    const hasUtility = tiersHere.has("utility");
    const hasDuotone = tiersHere.has("hero") || tiersHere.has("domain");
    if (hasUtility && hasDuotone) {
      warnings++;
      const util = [...new Set(tiersHere.get("utility"))].slice(0, 4).join(", ");
      const duo = [...new Set([...(tiersHere.get("hero") || []), ...(tiersHere.get("domain") || [])])]
        .slice(0, 4).join(", ");
      console.warn(`UYARI ${path.basename(f)} · ${block.name}: iki çizim dili bir arada\n` +
                   `      utility: ${util}\n      duotone: ${duo}\n` +
                   `      → utility katmanını tesisata (ok, durum, gezinme) ayırın.`);
    }
  });

  if (unknown.size) {
    errors += unknown.size;
    console.error(`HATA ${path.basename(f)}: sprite'ta olmayan ikon →\n  ` + [...unknown].join("\n  "));
  }

  const byTier = {};
  for (const [id, n] of seen) {
    const t = owner.get(id)?.tier ?? "bilinmiyor";
    byTier[t] = (byTier[t] || 0) + n;
  }
  console.log(`${path.basename(f)}: ${blocks.length} blok · ${seen.size} benzersiz ikon · ` +
              Object.entries(byTier).map(([t, n]) => `${t} ${n}`).join(" · "));
}

console.log(errors ? `\nHATA: ${errors} · UYARI: ${warnings}`
                   : `\nikon kullanımı geçerli (uyarı: ${warnings})`);
process.exit(errors ? 1 : 0);
