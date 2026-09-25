/* site-plan.mjs — SAHA YERLEŞİMİ (three'siz, DOM'suz, deterministik).
 * docs/habitat-blocks-plan.md §6.
 *
 * Bir yüzey üssünde modüllerin yeri keyfi değildir; her mesafe bir KAZAYI
 * ya da bir kaybı önler. Bu modül o kuralları ADLANDIRIR, bir yerleşim
 * çözer ve uymayan her kuralı BİLDİRİR (sessiz kabul yok).
 *
 * Kurallar (habitat planı §6; hepsi burada ad ve sayı olarak yaşar):
 *   · reaktör ≥ 1 km, habitat yönünde gölge kalkanı  — nötron/gama akısı
 *   · iniş pisti ≥ 500 m ve EJECTA konisinde yapı yok — inişte fırlayan
 *     taş, 500 m'de hâlâ zırh deler; koni pistin rüzgâr altına bakar
 *   · yakıt tankı ↔ O₂ tankı ≥ 50 m                  — ortak arıza kipi
 *   · güneş tarlası gölgede değil                     — Güneş azimutu
 *   · radyatör Güneş'e SIRT                            — ışıma verimi
 *   · hava kilidi/garaj habitat'a yakın (≤ 150 m)      — yürüyüş süresi
 *   · ISRU alımı rüzgâr ÜSTÜ (yalnız Mars)            — egzoz/toz kirliliği
 *   · zemin eğimi ≤ eşik, yerleşimler ÇAKIŞMAZ
 *
 * Çözüm: tohumlu EN İYİ ADAY (best-candidate) örneklemesi — her modül için
 * K aday üretilir, sert kuralı çiğneyen elenir, kalanlar puanlanır ve en
 * iyisi alınır. Mavi gürültü gibi dağılır ama kural güdümlüdür. Aynı tohum
 * → aynı yerleşim. `overrides` ile herhangi bir modül ELLE konabilir.
 *
 * Birim: API METRE ile konuşur; `unitMeters` (varsayılan 100, terrain_blocks
 * ölçeği) ile arazi birimine çevrilir ve `clearings` o birimde üretilir.
 *
 * API:
 *   planSite({ seed, modules, environment, sunAzimuthDeg, windDeg,
 *              radiusM, terrain, unitMeters, overrides, maxSlopeDeg })
 *     → { placements, links, clearings, violations, rules, describe() }
 *   MODULES, SITE_RULES
 */

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const uzaklik = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
/** İki yön arasındaki en kısa açı farkı (derece, 0..180). */
const aciFark = (a, b) => { const d = Math.abs(((a - b) % 360 + 540) % 360 - 180); return 180 - d; };
const yon = (a, b) => (Math.atan2(b.x - a.x, -(b.z - a.z)) / DEG + 360) % 360;   // kuzey = −z, saat yönü

/** Modül kataloğu: yarıçap METRE, tür kurallarda kullanılır. */
export const MODULES = Object.freeze({
  habitat:  { ad: 'Habitat', r: 14, tur: 'basincli', renk: '#d8d4cc', bandM: [0, 0] },
  garage:   { ad: 'Gezgin garajı', r: 11, tur: 'basincli', renk: '#c2bdb2', bandM: [60, 170] },
  reactor:  { ad: 'Reaktör', r: 9, tur: 'guc', renk: '#c98a5c', bandM: [1010, 1500] },
  solar:    { ad: 'Güneş tarlası', r: 26, tur: 'guc', renk: '#5c7fa8', bandM: [190, 620] },
  radiator: { ad: 'Radyatör dizisi', r: 15, tur: 'isil', renk: '#8fa2b4', bandM: [90, 320] },
  pad:      { ad: 'İniş pisti', r: 32, tur: 'pist', renk: '#9a9186', bandM: [620, 1500] },
  o2:       { ad: 'O₂ tankı', r: 8, tur: 'tank', renk: '#7fb0c9', bandM: [170, 560] },
  fuel:     { ad: 'Yakıt tankı', r: 8, tur: 'tank', renk: '#c9a35c', bandM: [170, 560] },
  isru:     { ad: 'ISRU alımı', r: 10, tur: 'isru', renk: '#9ec98a', bandM: [190, 700] },
  comms:    { ad: 'Haberleşme direği', r: 5, tur: 'iletisim', renk: '#b4a8c9', bandM: [90, 240] },
});

/** Kural kataloğu. `sert` olanlar adayı ELER; yumuşak olanlar puanlar.
    Her kuralın bir `neden`i vardır — sayı tek başına bir şey anlatmaz. */
export const SITE_RULES = Object.freeze([
  { id: 'reaktor-uzak', sert: true, ad: 'Reaktör ≥ 1 km (habitat)',
    neden: 'Nötron ve gama akısı mesafenin karesiyle düşer; 1 km, ek zırh olmadan mürettebat dozunu sınırda tutar.',
    kontrol: (p, ctx) => p.reactor && p.habitat ? uzaklik(p.reactor, p.habitat) >= 1000 : true,
    olc: (p) => p.reactor && p.habitat ? uzaklik(p.reactor, p.habitat) : null, birim: 'm', hedef: '≥ 1000' },
  { id: 'pist-uzak', sert: true, ad: 'İniş pisti ≥ 500 m (her yapı)',
    neden: 'İnişte plümün fırlattığı regolit taneleri balistiktir ve atmosfersiz ortamda yavaşlamaz; 500 m altı mesafede zırh deler.',
    kontrol: (p) => Object.entries(p).every(([id, q]) => id === 'pad' || !p.pad || uzaklik(p.pad, q) >= 500),
    olc: (p) => p.pad ? Math.min(...Object.entries(p).filter(([id]) => id !== 'pad').map(([, q]) => uzaklik(p.pad, q))) : null,
    birim: 'm', hedef: '≥ 500' },
  { id: 'ejecta-bos', sert: true, ad: 'Ejecta konisinde yapı yok (±30°, 900 m)',
    neden: 'Fırlayan malzeme her yöne eşit dağılmaz: pistin rüzgâr altı sektörü en yoğun koridordur ve o koni boş tutulur.',
    kontrol: (p, ctx) => !p.pad || Object.entries(p).every(([id, q]) => id === 'pad'
      || uzaklik(p.pad, q) > 900 || aciFark(yon(p.pad, q), ctx.ejectaAz) > 30),
    olc: (p, ctx) => p.pad ? Math.min(...Object.entries(p).filter(([id]) => id !== 'pad')
      .map(([, q]) => uzaklik(p.pad, q) > 900 ? 180 : aciFark(yon(p.pad, q), ctx.ejectaAz))) : null,
    birim: '°', hedef: '> 30' },
  { id: 'tank-ayrik', sert: true, ad: 'Yakıt ↔ O₂ ≥ 50 m',
    neden: 'İkisi bir arada tutuşursa tek bir kaza iki tankı da alır; ayrık tutmak ortak arıza kipini keser.',
    kontrol: (p) => !p.fuel || !p.o2 || uzaklik(p.fuel, p.o2) >= 50,
    olc: (p) => p.fuel && p.o2 ? uzaklik(p.fuel, p.o2) : null, birim: 'm', hedef: '≥ 50' },
  { id: 'cakisma-yok', sert: true, ad: 'Yerleşimler çakışmaz (+20 m pay)',
    neden: 'Ayak izleri üst üste binerse inşaat ve servis yolu kalmaz.',
    kontrol: (p) => {
      const l = Object.entries(p);
      for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) {
        const [ai, a] = l[i], [bi, b] = l[j];
        if (uzaklik(a, b) < a.r + b.r + 20) return false;
        void ai; void bi;
      }
      return true;
    },
    olc: (p) => { const l = Object.values(p); let m = Infinity;
      for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) m = Math.min(m, uzaklik(l[i], l[j]) - l[i].r - l[j].r);
      return Number.isFinite(m) ? m : null; }, birim: 'm', hedef: '≥ 20' },
  { id: 'egim-uygun', sert: true, ad: 'Zemin eğimi eşiğin altında',
    neden: 'Düzleştirme kazı demektir; eğim büyüdükçe taşınacak regolit hacmi küpsel artar.',
    kontrol: (p, ctx) => !ctx.slopeDeg || Object.values(p).every(q => ctx.slopeDeg(q.x, q.z) <= ctx.maxSlopeDeg),
    olc: (p, ctx) => ctx.slopeDeg ? Math.max(...Object.values(p).map(q => ctx.slopeDeg(q.x, q.z))) : null,
    birim: '°', hedef: 'eşik altı' },
  { id: 'panel-golgede-degil', sert: false, agirlik: 2, ad: 'Güneş tarlası gölgede değil',
    neden: 'Güneş azimutu boyunca habitat/radyatör ile aynı hatta duran panel, günün yarısında gölgede kalır.',
    kontrol: (p, ctx) => !p.solar || !p.habitat || aciFark(yon(p.solar, p.habitat), ctx.sunAz) > 25,
    olc: (p, ctx) => p.solar && p.habitat ? aciFark(yon(p.solar, p.habitat), ctx.sunAz) : null, birim: '°', hedef: '> 25' },
  { id: 'radyator-sirt', sert: false, agirlik: 2, ad: 'Radyatör Güneş\'e sırt',
    neden: 'Radyatör ısıyı ışıyarak atar; Güneş\'e bakan yüzey net ısı KAZANIR.',
    kontrol: (p, ctx) => !p.radiator || !p.habitat || aciFark(yon(p.habitat, p.radiator), ctx.sunAz) > 90,
    olc: (p, ctx) => p.radiator && p.habitat ? aciFark(yon(p.habitat, p.radiator), ctx.sunAz) : null, birim: '°', hedef: '> 90' },
  { id: 'garaj-yakin', sert: false, agirlik: 3, ad: 'Garaj habitat\'a ≤ 150 m',
    neden: 'Hava kilidinden garaja yürüyüş, giysi tüketimi ve risk demektir; kısa tutulur.',
    kontrol: (p) => !p.garage || !p.habitat || uzaklik(p.garage, p.habitat) <= 150,
    olc: (p) => p.garage && p.habitat ? uzaklik(p.garage, p.habitat) : null, birim: 'm', hedef: '≤ 150' },
  { id: 'isru-ruzgar-ustu', sert: false, agirlik: 2, ad: 'ISRU alımı rüzgâr üstü (Mars)',
    neden: 'Alım borusu üssün egzozunu ve kaldırdığı tozu çekmemeli; rüzgâr üstünde temiz hava alır.',
    kontrol: (p, ctx) => ctx.environment !== 'mars' || !p.isru || !p.habitat
      || aciFark(yon(p.habitat, p.isru), ctx.windDeg) < 60,
    olc: (p, ctx) => p.isru && p.habitat ? aciFark(yon(p.habitat, p.isru), ctx.windDeg) : null, birim: '°', hedef: '< 60' },
  { id: 'iletisim-yuksek', sert: false, agirlik: 1, ad: 'Haberleşme direği habitat\'a ≤ 250 m',
    neden: 'Kablo uzunluğu kütle ve arıza yüzeyidir; direk yine de yapıların gölgesinden çıkmalıdır.',
    kontrol: (p) => !p.comms || !p.habitat || uzaklik(p.comms, p.habitat) <= 250,
    olc: (p) => p.comms && p.habitat ? uzaklik(p.comms, p.habitat) : null, birim: 'm', hedef: '≤ 250' },
]);

/** Hat (boru/kablo) bağlantıları: neyin neye gitmesi gerektiği. */
const BAGLANTI = [
  ['habitat', 'garage', 'basincli geçit'],
  ['habitat', 'reactor', 'güç hattı'],
  ['habitat', 'solar', 'güç hattı'],
  ['habitat', 'radiator', 'soğutucu'],
  ['habitat', 'o2', 'O₂ hattı'],
  ['isru', 'fuel', 'ürün hattı'],
  ['fuel', 'pad', 'ikmal hattı'],
  ['habitat', 'comms', 'veri'],
];

export function planSite({
  seed = 20260924, modules = Object.keys(MODULES), environment = 'moon',
  sunAzimuthDeg = 120, windDeg = 250, radiusM = 1600, unitMeters = 100,
  terrain = null, maxSlopeDeg = 8, overrides = {}, candidates = 48,
} = {}) {
  const rnd = mulberry32(seed);
  const ctx = {
    environment, sunAz: sunAzimuthDeg, windDeg, maxSlopeDeg,
    /* Ejecta konisi pistin RÜZGÂR ALTINA bakar (Mars); Ay'da rüzgâr yok,
       o zaman Güneş azimutunun tersi alınır — keyfi değil, ilan edilmiş. */
    ejectaAz: environment === 'mars' ? windDeg : (sunAzimuthDeg + 180) % 360,
    slopeDeg: terrain ? ((xm, zm) => terrain.slopeDeg(xm / unitMeters, zm / unitMeters)) : null,
  };

  /* Yerleştirme sırası: kısıtı en sert olan ÖNCE (habitat merkez, sonra
     pist ve reaktör uzağa, sonra gerisi). Sonraya bırakılan sert kısıt,
     çözümü kilitler. */
  const sira = ['habitat', 'pad', 'reactor', 'garage', 'solar', 'radiator', 'fuel', 'o2', 'isru', 'comms']
    .filter(id => modules.includes(id));

  const p = {};
  const kondu = () => ({ ...p });
  for (const id of sira) {
    const def = MODULES[id];
    if (!def) continue;
    if (overrides[id]) {
      p[id] = { id, ad: def.ad, r: def.r, renk: def.renk, tur: def.tur, x: overrides[id].x, z: overrides[id].z, elle: true };
      continue;
    }
    if (id === 'habitat') { p[id] = { id, ad: def.ad, r: def.r, renk: def.renk, tur: def.tur, x: 0, z: 0 }; continue; }
    let enIyi = null, enIyiPuan = -Infinity;
    for (let k = 0; k < candidates; k++) {
      /* Aday: halka içinde tohumlu; yarıçap √u ile düzgün dağılır. */
      const a = rnd() * TAU;
      /* Aday yarıçapı modülün TERCİH BANDINDA üretilir (garaj yakın, reaktör
         uzak): bant yoksa tüm saha. Bant olmadan çözücü, yumuşak kuralları
         (garaj ≤ 150 m, direk ≤ 250 m) tesadüfe bırakıyor ve düzenli olarak
         ihlal ediyordu (ölçüldü: 255 m / 270 m). */
      const bant = def.bandM || [0.12 * radiusM, radiusM];
      const lo = Math.max(0, Math.min(bant[0], radiusM)), hi = Math.max(lo + 1, Math.min(bant[1], radiusM));
      const rr = Math.sqrt(lo * lo + (hi * hi - lo * lo) * rnd());
      const aday = { id, ad: def.ad, r: def.r, renk: def.renk, tur: def.tur, x: Math.cos(a) * rr, z: Math.sin(a) * rr };
      const deneme = { ...p, [id]: aday };
      if (!SITE_RULES.filter(r => r.sert).every(r => r.kontrol(deneme, ctx))) continue;
      let puan = 0;
      for (const r of SITE_RULES) if (!r.sert && r.kontrol(deneme, ctx)) puan += r.agirlik ?? 1;
      /* Eşit puanda MERKEZE yakın olan kazanır: hat uzunluğu kütledir. */
      puan -= uzaklik(aday, { x: 0, z: 0 }) / radiusM * 0.5;
      if (puan > enIyiPuan) { enIyiPuan = puan; enIyi = aday; }
    }
    if (enIyi) p[id] = enIyi;
    else {
      /* Sert kuralları sağlayan aday bulunamadı: modül yine de konur ama
         İHLAL olarak bildirilir. Sessizce atlamak, eksik sahayı gizler. */
      const a = rnd() * TAU;
      p[id] = { id, ad: def.ad, r: def.r, renk: def.renk, tur: def.tur,
        x: Math.cos(a) * radiusM, z: Math.sin(a) * radiusM, zorlandi: true };
    }
  }

  const placements = Object.values(p);
  const violations = [];
  for (const r of SITE_RULES) {
    const ok = r.kontrol(p, ctx);
    if (!ok) violations.push({ id: r.id, ad: r.ad, sert: !!r.sert, neden: r.neden,
      olculen: r.olc ? r.olc(p, ctx) : null, birim: r.birim, hedef: r.hedef });
  }
  const links = BAGLANTI.filter(([a, b]) => p[a] && p[b])
    .map(([a, b, tur]) => ({ a, b, tur, uzunluk: uzaklik(p[a], p[b]) }));

  /* Araziye GERİ YAZILAN kapılar: her yerleşim bir `site` çokgeni (altıgen
     ayak izi), her hat bir `corridor`. terrain_blocks bu listeyi doğrudan
     `createTerrainField({ clearings })` ile alır ve zemini düzleştirir. */
  const clearings = [];
  for (const q of placements) {
    const poly = [];
    for (let i = 0; i < 6; i++) {
      const a = i * TAU / 6 + Math.PI / 6;
      poly.push([(q.x + Math.cos(a) * q.r) / unitMeters, (q.z + Math.sin(a) * q.r) / unitMeters]);
    }
    clearings.push({ polygon: poly, compaction: q.tur === 'pist' ? 0.9 : 0.6, keep: ['microRelief'] });
  }
  for (const l of links) {
    /* Koridor genisligi 24 m: basincli gezgin/tasiyici gabarisi (~12 m) +
       iki yanda banket. 14 m denenmisti; hem dar bir hat hem de arazi
       orgusunun bir hucresinden ince kaldigi icin 3B onizlemede tarakli
       goruntu veriyordu (olculdu). */
    clearings.push({ path: [[p[l.a].x / unitMeters, p[l.a].z / unitMeters], [p[l.b].x / unitMeters, p[l.b].z / unitMeters]],
      w: 0.24, maxSlopeDeg: 12, keep: ['microRelief'] });
  }

  return {
    seed, environment, sunAzimuthDeg, windDeg, radiusM, unitMeters,
    placements, links, clearings, violations, rules: SITE_RULES, ctx,
    /** Ölçüm tablosu: her kural için ölçülen değer ve hedef. */
    olcumler() {
      return SITE_RULES.map(r => ({ id: r.id, ad: r.ad, sert: !!r.sert,
        olculen: r.olc ? r.olc(p, ctx) : null, birim: r.birim, hedef: r.hedef, gecti: r.kontrol(p, ctx) }));
    },
    describe() {
      return {
        seed, environment, unitMeters, modul: placements.length,
        hatMetre: Math.round(links.reduce((s, l) => s + l.uzunluk, 0)),
        mesafeler: Object.fromEntries(placements.filter(q => q.id !== 'habitat')
          .map(q => [q.id, Math.round(uzaklik(q, p.habitat || { x: 0, z: 0 }))])),
        ihlal: violations.map(v => v.id),
        zorlanan: placements.filter(q => q.zorlandi).map(q => q.id),
      };
    },
  };
}
