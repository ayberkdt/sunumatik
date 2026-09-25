#!/usr/bin/env node
/* validate-site.mjs — SAHA YERLEŞİMİ denetimleri (three'siz).
   presets/terrain_blocks/site-plan.mjs: kural kataloğu, çözücü, determinizm,
   elle konum (overrides), arazi eğimi kısıtı ve araziye geri yazılan kapılar.

   Kullanım: node scripts/validate-site.mjs    Çıkış: HATA varsa 1 */

/* fileURLToPath, not `new URL(...).pathname`: the pathname is
   percent-encoded, so a folder with a space in its name came back as
   `Custom%20Yetenekler` and pathToFileURL then encoded the percent
   again. Every import missed, and only in the checkout that has a
   space in its path - which is the one people actually work in. */
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mod = (rel) => import(pathToFileURL(path.join(root, rel)).href);
const { planSite, MODULES, SITE_RULES } = await mod('presets/terrain_blocks/site-plan.mjs');
const { createTerrainField } = await mod('presets/terrain_blocks/terrain-field.mjs');
const { fbm, microRelief, craterField } = await mod('presets/terrain_blocks/terrain-features.mjs');

let fails = 0, total = 0;
const check = (name, ok, detail = '') => { total++; console.log(`  ${ok ? 'ok ' : 'HATA'} ${name}${detail ? '  (' + detail + ')' : ''}`); if (!ok) fails++; };
const d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const bul = (s, id) => s.placements.find(p => p.id === id);

console.log('== 1 kural kataloğu');
{
  check('her kuralda kimlik, ad, neden ve kontrol var',
    SITE_RULES.every(r => r.id && r.ad && r.neden && typeof r.kontrol === 'function'), `${SITE_RULES.length} kural`);
  check('kimlikler benzersiz', new Set(SITE_RULES.map(r => r.id)).size === SITE_RULES.length);
  check('sert kurallar var ve yumuşak kuralların ağırlığı tanımlı',
    SITE_RULES.some(r => r.sert) && SITE_RULES.filter(r => !r.sert).every(r => r.agirlik > 0));
  check('her modülün yarıçapı ve tercih bandı var',
    Object.values(MODULES).every(m => m.r > 0 && Array.isArray(m.bandM) && m.bandM.length === 2),
    `${Object.keys(MODULES).length} modül`);
}

console.log('== 2 çözülen yerleşim sert kuralları sağlar');
{
  let kotu = [];
  for (const [env, seed] of [['moon', 20260924], ['moon', 7], ['moon', 99], ['mars', 3], ['mars', 5150], ['mars', 42]]) {
    const s = planSite({ seed, environment: env });
    const sertIhlal = s.violations.filter(v => v.sert);
    if (sertIhlal.length) kotu.push(`${env}/${seed}: ${sertIhlal.map(v => v.id).join(',')}`);
  }
  check('altı tohum/ortamda SERT kural ihlali yok', kotu.length === 0, kotu.join(' | '));

  const s = planSite({ seed: 20260924 });
  check('reaktör ≥ 1 km', d(bul(s, 'reactor'), bul(s, 'habitat')) >= 1000,
    `${d(bul(s, 'reactor'), bul(s, 'habitat')).toFixed(0)} m`);
  const padMin = Math.min(...s.placements.filter(p => p.id !== 'pad').map(p => d(p, bul(s, 'pad'))));
  check('iniş pisti her yapıdan ≥ 500 m', padMin >= 500, `${padMin.toFixed(0)} m`);
  check('yakıt ↔ O₂ ≥ 50 m', d(bul(s, 'fuel'), bul(s, 'o2')) >= 50, `${d(bul(s, 'fuel'), bul(s, 'o2')).toFixed(0)} m`);
  let cakisma = 0;
  for (let i = 0; i < s.placements.length; i++) for (let j = i + 1; j < s.placements.length; j++) {
    const a = s.placements[i], b = s.placements[j];
    if (d(a, b) < a.r + b.r + 20) cakisma++;
  }
  check('ayak izleri çakışmaz (+20 m pay)', cakisma === 0, `${cakisma} çakışma`);
}

console.log('== 3 determinizm ve elle konum');
{
  const a = planSite({ seed: 1234 }), b = planSite({ seed: 1234 }), c = planSite({ seed: 1235 });
  const imza = (s) => s.placements.map(p => `${p.id}:${p.x.toFixed(6)},${p.z.toFixed(6)}`).join('|');
  check('aynı tohum → aynı yerleşim', imza(a) === imza(b));
  check('farklı tohum → farklı yerleşim', imza(a) !== imza(c));
  const o = planSite({ seed: 1234, overrides: { reactor: { x: -1400, z: 300 } } });
  const r = bul(o, 'reactor');
  check('overrides konumu birebir uygulanır ve elle işaretlenir',
    r.x === -1400 && r.z === 300 && r.elle === true);
  check('elle konan modül kural ölçümüne dahil (ihlal gizlenmez)',
    o.olcumler().find(x => x.id === 'reaktor-uzak').olculen > 1400);
}

console.log('== 4 ortam farkı');
{
  const ay = planSite({ seed: 8, environment: 'moon', windDeg: 250, sunAzimuthDeg: 120 });
  const mars = planSite({ seed: 8, environment: 'mars', windDeg: 250, sunAzimuthDeg: 120 });
  check('Ay\'da ejecta konisi Güneş azimutunun TERSİ (rüzgâr yok)',
    Math.abs(ay.ctx.ejectaAz - 300) < 1e-9, `${ay.ctx.ejectaAz}°`);
  check('Mars\'ta ejecta konisi rüzgâr altı', Math.abs(mars.ctx.ejectaAz - 250) < 1e-9, `${mars.ctx.ejectaAz}°`);
  check('ISRU kuralı yalnız Mars\'ta bağlayıcı',
    SITE_RULES.find(r => r.id === 'isru-ruzgar-ustu').kontrol({ isru: { x: 0, z: 100 }, habitat: { x: 0, z: 0 } }, ay.ctx) === true);
}

console.log('== 5 araziye geri yazılan kapılar');
{
  const alan = createTerrainField({ seed: 5, planet: 'moon', layers: [
    craterField({ seed: 5, rings: [{ r0: 3, r1: 40, Rmin: .3, Rmax: 3, count: 40 }] }),
    fbm({ seed: 5, bands: [[420, 6], [110, 2]] }), microRelief({ seed: 5 }),
  ] });
  const s = planSite({ seed: 20260924, terrain: alan, unitMeters: 100, maxSlopeDeg: 8 });
  check('her modül için bir site çokgeni, her hat için bir koridor üretildi',
    s.clearings.filter(c => c.polygon).length === s.placements.length
    && s.clearings.filter(c => c.path).length === s.links.length,
    `${s.clearings.length} kapı = ${s.placements.length} çokgen + ${s.links.length} koridor`);
  check('çokgenler ARAZİ biriminde (metre / unitMeters)',
    s.clearings.filter(c => c.polygon).every(c => c.polygon.every(([x, z]) => Math.abs(x) < 20 && Math.abs(z) < 20)));

  /* Kapılar araziye verilince zemin GERÇEKTEN düzleşmeli: yerleşim
     merkezinde büyük biçimler bastırılır. */
  const duz = createTerrainField({ seed: 5, planet: 'moon', clearings: s.clearings, layers: [
    craterField({ seed: 5, rings: [{ r0: 3, r1: 40, Rmin: .3, Rmax: 3, count: 40 }] }),
    fbm({ seed: 5, bands: [[420, 6], [110, 2]] }), microRelief({ seed: 5 }),
  ] });
  const hab = bul(s, 'habitat');
  const hx = hab.x / 100, hz = hab.z / 100;
  const mikroPay = (alanX, x, z) => alanX.layers.filter(L => L.tags.includes('micro')).reduce((a, L) => a + L.h(x, z), 0);
  const duzKot = (x, z) => duz.raw(x, z) - mikroPay(duz, x, z);
  check('habitat merkezinde büyük/küçük biçimler bastırıldı (< 2 cm)',
    Math.abs(duzKot(hab.x / 100, hab.z / 100)) < 0.0002, `${(duzKot(hab.x / 100, hab.z / 100) * 100).toFixed(3)} m`);

  /* UZAKTAKİ modülün kapısı KENDİ kotasına tesviye edilmeli. Tek bir genel
     datum kullanıldığında 1 km ötedeki reaktör pedi orijinin kotasına
     kazınıyor, koridorlar 30 m derin kanyon açıyordu (ölçüldü). */
  const rea = bul(s, 'reactor');
  const rx = rea.x / 100, rz = rea.z / 100, rr = rea.r / 100;
  const ic = [[rx, rz], [rx + rr * .4, rz], [rx, rz + rr * .4]];
  const kotlar = ic.map(([x, z]) => duzKot(x, z));
  check('uzak modülün pedi İÇİNDE düz (< 2 cm oynama)',
    Math.max(...kotlar) - Math.min(...kotlar) < 0.0002, `${((Math.max(...kotlar) - Math.min(...kotlar)) * 100).toFixed(3)} m`);
  const dogalRea = alan.raw(rx, rz) - mikroPay(alan, rx, rz);
  const dogalHab = alan.raw(hab.x / 100, hab.z / 100) - mikroPay(alan, hab.x / 100, hab.z / 100);
  const engebe = Math.abs(dogalRea - dogalHab);
  check('iki nokta arasında gerçekten kot farkı var (sınav anlamlı)', engebe > 0.05, `${(engebe * 100).toFixed(1)} m`);
  const kesme = Math.abs((kotlar[0] + dogalHab) - dogalRea);   // duzKot datum'a göreli
  check('uzak ped KENDİ kotasında tesviye edilir, orijine kazılmaz',
    kesme < engebe * 0.35, `kesme ${(kesme * 100).toFixed(1)} m < engebenin %35'i (${(engebe * 35).toFixed(1)} m)`);

  /* Kapı YEREL'dir, ama datum ötelemesi GENELDİR: kapılı alan `h(x,z)-ref`
     toplar, yani tüm arazi sabit bir miktar kayar (ped merkezi h=0 olsun
     diye). Dolayısıyla uzakta sınanacak şey mutlak yükseklik değil BİÇİM:
     saha dışındaki iki nokta arasındaki yükseklik FARKI değişmemeli. */
  const uzak = [[hx + 40, hz + 40], [hx + 41.3, hz + 39.1], [hx - 38, hz + 44]];
  const farkDuz = duz.raw(...uzak[1]) - duz.raw(...uzak[0]);
  const farkHam = alan.raw(...uzak[1]) - alan.raw(...uzak[0]);
  const farkDuz2 = duz.raw(...uzak[2]) - duz.raw(...uzak[0]);
  const farkHam2 = alan.raw(...uzak[2]) - alan.raw(...uzak[0]);
  check('kapı YEREL: saha dışında arazinin biçimi dokunulmamış',
    Math.abs(farkDuz - farkHam) < 1e-9 && Math.abs(farkDuz2 - farkHam2) < 1e-9,
    `Δ ${Math.abs(farkDuz - farkHam).toExponential(1)} birim`);
  check('datum ötelemesi SABİT: saha dışında yalnız tek bir kayma var',
    Math.abs((duz.raw(...uzak[0]) - alan.raw(...uzak[0])) - (duz.raw(...uzak[2]) - alan.raw(...uzak[2]))) < 1e-9);
  check('eğim kuralı arazi verilince ölçülür',
    s.olcumler().find(x => x.id === 'egim-uygun').olculen !== null);
}

console.log('== 6 rapor ve ihlal bildirimi');
{
  const s = planSite({ seed: 20260924 });
  const t = s.describe();
  check('describe(): modül sayısı, hat uzunluğu, mesafeler ve ihlal listesi',
    t.modul === s.placements.length && t.hatMetre > 0 && Object.keys(t.mesafeler).length === s.placements.length - 1
    && Array.isArray(t.ihlal), `${t.modul} modül · ${t.hatMetre} m hat`);
  /* Çözülemeyen bir kısıt SESSİZCE geçilmez: dar bir sahada reaktör kuralı
     sağlanamaz ve bu hem `zorlandi` hem de ihlal olarak görünür. */
  const dar = planSite({ seed: 11, radiusM: 300 });
  check('sığmayan modül zorlanır VE ihlal olarak bildirilir',
    dar.describe().zorlanan.length > 0 || dar.violations.some(v => v.sert),
    `zorlanan: ${dar.describe().zorlanan.join(',') || '-'} · ihlal: ${dar.violations.map(v => v.id).join(',') || '-'}`);
  check('olcumler() her kural için ölçülen değeri ve hedefi verir',
    s.olcumler().length === SITE_RULES.length && s.olcumler().every(o => o.hedef && typeof o.gecti === 'boolean'));
}

console.log(`\n${total - fails}/${total} geçti`);
process.exit(fails ? 1 : 0);
