/* life-signs.mjs — NEFES PRİMİTİFLERİ (three'siz, DOM'suz, saf).
 * docs/breathing-motion-plan.md §5.
 *
 * Bir sahnenin "canlı" görünmesi hareket EKLEMEKLE olmaz; gerçek bir
 * mekanizmanın gerçek BOŞTA davranışını göstermekle olur. Bu dosya o
 * davranışların matematiğidir: katalog (life_signs/catalog.mjs) bunları
 * adlandırır, bind.mjs three kanallarına YAZAR, budget.mjs kaç tanesinin
 * aynı anda fark edilebileceğine karar verir.
 *
 * Üç kural buradaki her primitifi biçimlendirir:
 *
 *   1. TEK SİNÜS ASLA. Bir sinüs iki saniyede okunur ve sahne "döngüye"
 *      düşer. Her genlik, iki ÖLÇÜŞMEZ sinüsün çarpımı olan yavaş bir
 *      pürüz zarfıyla modüle edilir (`roughness`); zarf sıfıra inmez,
 *      yoksa hareket "durdu" diye okunur.
 *   2. ÖLÇÜŞMEZ ORANLAR. Kanal frekansları φ kuvvetlerinden türetilir.
 *      φ en kötü rasyonel yaklaşıma sahip sayıdır: hiçbir kanal çifti
 *      ortak katta buluşmaz, göz 30 saniye izlese de tekrar yakalayamaz.
 *      (validate-life-signs §1 bunu p/q ≤ 12 için sınar.)
 *   3. SAF f(t, seed). advance(dt) yoktur; her değer t'nin fonksiyonudur.
 *      Böylece ?t= ile dondurulan kare, canlı oynatımın aynı karesidir ve
 *      1/60 ile 1/120 aynı sonucu verir.
 *
 * API: oscBank · roughness · poissonSchedule · saccadeSettle · gazeProgram
 *      envelope · counterBreath · stationKeeping · PHI
 */

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
export const PHI = (1 + Math.sqrt(5)) / 2;          // 1.618033988…
export const PHI3 = PHI ** 3;                        // 4.236067977… — φ³ hilesi

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tohumlu tam sayı hash'i — olay/segment başına deterministik değer. */
export function hash32(k, seed = 0) {
  let h = (Math.imul(k | 0, 2654435761) ^ (seed >>> 1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

const smooth = v => v * v * (3 - 2 * v);
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/* ── 1) pürüz zarfı ─────────────────────────────────────────────────────
   İki ölçüşmez sinüsün çarpımı. Bandı [0.55, 1]: genliği yarıya kadar
   kısar ama SIFIRLAMAZ. spatial-idle'ın `puruz`u ile birebir aynı sayı. */
export function roughness(seed = 1, tBase = 14) {
  const rnd = mulberry32(seed);
  const f1 = 1 / (tBase * PHI3), f2 = 1 / (tBase * PHI3 * 1.31);
  const faz1 = rnd() * TAU, faz2 = rnd() * TAU;
  const at = t => 0.775 + 0.225 * Math.sin(TAU * f1 * t + faz1) * Math.sin(TAU * f2 * t + faz2);
  at.f1 = f1; at.f2 = f2;
  return at;
}

/** Ham pürüz (zarf parametreleri dışarıdan verildiğinde). */
export function roughAt(t, f1, f2, faz1, faz2) {
  return 0.775 + 0.225 * Math.sin(TAU * f1 * t + faz1) * Math.sin(TAU * f2 * t + faz2);
}

/* ── 2) osilatör bankası ────────────────────────────────────────────────
   Kanal frekansları TEK bir taban periyottan φ türevi oranlarla çıkar.
   `ratio` verilmezse kanal sırasına göre φ^(−k) atanır: ilk kanal tabanda,
   ikincisi φ kat yavaş, üçüncüsü φ² kat yavaş… Hiçbiri ortak katta değil.

   base: [lo, hi] saniye — taban periyot bandı (tohumdan seçilir).
   channels: { ad: { A, ratio?, faz? } } — A kanalın genliği (birimi
   çağıranın: metre, derece, oransız ölçek). */
export function oscBank(seed = 1, { base = [10, 18], channels = {} } = {}) {
  const rnd = mulberry32(seed);
  const tBase = base[0] + rnd() * (base[1] - base[0]);
  const fBase = 1 / tBase;
  const adlar = Object.keys(channels);
  const kanal = {};
  adlar.forEach((ad, i) => {
    const c = channels[ad];
    const ratio = c.ratio ?? PHI ** -i;
    kanal[ad] = { A: c.A ?? 1, ratio, f: fBase * ratio, faz: c.faz ?? rnd() * TAU };
  });
  /* Zarf, kanalların HEPSİNDEN yavaştır: genlik modülasyonu taşıyıcıyı
     yutmaz, üstüne biner. */
  const zf1 = fBase / PHI3, zf2 = fBase / (PHI3 * 1.31);
  const zfaz1 = rnd() * TAU, zfaz2 = rnd() * TAU;
  return {
    seed, tBase, fBase, channels: kanal,
    /** Tek kanalın t anındaki değeri. */
    at(ad, t) {
      const k = kanal[ad];
      if (!k) return 0;
      return k.A * Math.sin(TAU * k.f * t + k.faz) * roughAt(t, zf1, zf2, zfaz1, zfaz2);
    },
    /** Bütün kanallar. */
    sample(t) {
      const out = {};
      for (const ad of adlar) out[ad] = this.at(ad, t);
      return out;
    },
    /** Denetim için: kanal frekansları (Hz) — ölçüşmezlik sınavının girdisi. */
    frequencies() { return adlar.map(ad => kanal[ad].f); },
  };
}

/* ── 3) Poisson olay programı ───────────────────────────────────────────
   Seyrek olaylar (RCS pufu, panorama başlangıcı, LED durum değişimi).
   Üstel aralıklarla ÖNCEDEN üretilir ve ufukta sarılır: böylece t'nin saf
   fonksiyonu kalır, herhangi bir t'ye adım atmadan gidilir. */
export function poissonSchedule(seed = 1, meanGapS = 30, { jitter = 0.35, count = 64 } = {}) {
  const rnd = mulberry32(seed);
  const times = [];
  let t = 0;
  for (let i = 0; i < count; i++) {
    /* üstel aralık; jitter tabanı sıfıra yaklaşmaktan korur */
    const u = Math.max(1e-6, rnd());
    const gap = meanGapS * (1 - jitter + 2 * jitter * (-Math.log(u)) / 1.4);
    t += Math.max(meanGapS * 0.25, gap);
    times.push(t);
  }
  const horizon = t;
  return {
    seed, meanGapS, horizon, times,
    /** Ufukta sarılmış zaman. */
    wrap(t) { return ((t % horizon) + horizon) % horizon; },
    /** t'den önceki son olayın indeksi ve üstünden geçen süre. */
    last(t) {
      const w = this.wrap(t);
      let i = -1;
      for (let k = 0; k < times.length; k++) { if (times[k] <= w) i = k; else break; }
      if (i < 0) return { index: times.length - 1, since: w + (horizon - times[times.length - 1]), wrapped: true };
      return { index: i, since: w - times[i], wrapped: false };
    },
    /** Olay indeksinin tohumlu [0,1) değeri — hangi hedef, hangi şiddet. */
    value(index, salt = 0) { return hash32(index ^ (salt << 8), seed); },
  };
}

/* ── 4) olay zarfı ──────────────────────────────────────────────────────
   Kısa kalkış, uzun iniş. Sözleşme §2: olaylar nesne takası değil, sönen
   bir ENERJİdir; her eşik sıfırdan rampalanır. */
export function envelope(attack = 0.25, decay = 2.5) {
  return tau => {
    if (tau < 0) return 0;
    if (tau < attack) return smooth(tau / attack);
    return Math.exp(-(tau - attack) / decay);
  };
}

/* ── 5) saccade + oturma ────────────────────────────────────────────────
   Bir aktüatörün (direk, çanak, gövde) yeni hedefe gidişi. KAPALI FORM
   kritik sönüm: e(τ) = e₀(1 + ωτ)e^{−ωτ}. Aşım yok, C1 sürekli, ve
   herhangi bir τ'ya adım atmadan gidilir.

   HIZ SINIRI aktüatör fiziğidir (§4.6): kritik sönümlü yanıtın tepe hızı
   |e₀|·ω/e olduğundan, ω = min(ωMax, rateMax·e/|e₀|) seçilir. Böylece
   BÜYÜK adım daha uzun sürer — direk 12°/s'yi asla aşmaz, nefes bile
   mekaniğe uyar. */
export function saccadeSettle({ rateMax = 12 * DEG, omegaMax = 3.2 } = {}) {
  return {
    rateMax, omegaMax,
    /** Adım için doğal frekans. */
    omegaFor(step) {
      const e0 = Math.abs(step);
      if (e0 < 1e-9) return omegaMax;
      return Math.min(omegaMax, rateMax * Math.E / e0);
    },
    /** Adımın başlangıcından τ saniye sonraki KALAN hata. */
    errorAt(step, tau) {
      if (tau <= 0) return step;
      const w = this.omegaFor(step);
      return step * (1 + w * tau) * Math.exp(-w * tau);
    },
    /** a0'dan a1'e giden değer. */
    valueAt(a0, a1, tau) { return a1 + this.errorAt(a0 - a1, tau); },
    /** Anlık hız (denetim §4: rateMax aşılmıyor mu). */
    rateAt(step, tau) {
      if (tau <= 0) return 0;
      const w = this.omegaFor(step);
      return -step * w * w * tau * Math.exp(-w * tau);
    },
    /** Oturma süresi (kalan hata < tol·|step|). */
    settleTime(step, tol = 0.02) {
      const w = this.omegaFor(step);
      let tau = 0;
      for (let i = 0; i < 400; i++) { if ((1 + w * tau) * Math.exp(-w * tau) < tol) break; tau += 0.05; }
      return tau;
    },
  };
}

/* ── 6) bakış programı ──────────────────────────────────────────────────
   Hedef seçimi + bekleme (dwell). Segmentler önceden üretilir ve sarılır;
   böylece hangi t verilirse verilsin aynı hedef sırası okunur.
   `weights` verilirse hedef seçimi ağırlıklıdır (planın açık kararı 1:
   kamera hedefi DÜŞÜK olasılıkla listede — gezginin "bize bakması"
   etkileyici ama ölçülü olmalı). */
export function gazeProgram(seed = 1, targets = [], { dwell = [4, 12], count = 48, weights = null } = {}) {
  if (!targets.length) throw new Error('life-signs: gazeProgram hedefsiz kurulamaz');
  const rnd = mulberry32(seed);
  const toplam = weights ? weights.reduce((a, b) => a + b, 0) : targets.length;
  const sec = (u) => {
    if (!weights) return Math.min(targets.length - 1, Math.floor(u * targets.length));
    let acc = 0;
    for (let i = 0; i < targets.length; i++) { acc += weights[i]; if (u * toplam < acc) return i; }
    return targets.length - 1;
  };
  const segments = [];
  let t = 0, onceki = -1;
  for (let i = 0; i < count; i++) {
    let idx = sec(rnd());
    if (idx === onceki && targets.length > 1) idx = (idx + 1 + Math.floor(rnd() * (targets.length - 1))) % targets.length;
    onceki = idx;
    const sure = dwell[0] + rnd() * (dwell[1] - dwell[0]);
    segments.push({ index: idx, start: t, dwell: sure });
    t += sure;
  }
  const horizon = t;
  return {
    seed, targets, segments, horizon,
    /** t anındaki segment: hedef, segmentin başından geçen süre, bir önceki hedef. */
    at(t) {
      const w = ((t % horizon) + horizon) % horizon;
      let i = 0;
      for (let k = 0; k < segments.length; k++) { if (segments[k].start <= w) i = k; else break; }
      const s = segments[i];
      const prev = segments[(i - 1 + segments.length) % segments.length];
      return { index: s.index, target: targets[s.index], since: w - s.start, prevIndex: prev.index, prevTarget: targets[prev.index], segment: i };
    },
  };
}

/* ── 6b) sürekli saccade zinciri ──────────────────────────────
   Bir segment BEKLEMESİ oturma süresinden kısa olabilir: o zaman aktüatör
   hedefe varmadan yeni komut alır. Segmentin başlangıç değerini "bir önceki
   hedef" saymak, tam o anda bir SIÇRAMA yaratır — denetim bunu 39 000°/s
   olarak ölçtü. Doğrusu: segment k'nın başlangıcı, segment k−1'in SONUNDA
   gerçekten ulaşılmış değerdir. Önceden özyinelemeyle hesaplanır; örnekleme
   yine O(1) ve saf kalır. */
export function segmentChain(segments, sac, targetOf) {
  const start = new Array(segments.length);
  /* Sarma için iki geçiş: ilk geçiş hedeften başlatır, ikincisi döngüyü kapatır. */
  let v = targetOf(segments[0]);
  for (let gecis = 0; gecis < 2; gecis++) {
    for (let i = 0; i < segments.length; i++) {
      start[i] = v;
      const hedef = targetOf(segments[i]);
      v = hedef + sac.errorAt(v - hedef, segments[i].dwell);
    }
  }
  return {
    start,
    /** i. segmentin içinde tau saniye sonraki değer. */
    at(i, tau) {
      const hedef = targetOf(segments[i]);
      return hedef + sac.errorAt(start[i] - hedef, tau);
    },
  };
}

/* ── 7) karşı-nefes ─────────────────────────────────────────────────────
   Kamera nesneyle SENKRON sallanırsa görüntü ölür; NEGATİF korelasyonla
   (−0,55) elde tutulan kamera hissi doğar: araç sağa süzülürken kadraj
   hafif sola direnir. */
export function counterBreath(sampleFn, k = -0.55) {
  return t => {
    const s = sampleFn(t);
    const out = {};
    for (const ad of Object.keys(s)) out[ad] = s[ad] * k;
    return out;
  };
}

/* ── 8) tutunma modeli (spatial-idle'ın taşınmışı) ──────────────────────
   Plan §6: `craftStationKeeping | spatial-idle modeli (taşınır)`.
   BİREBİR aynı sayılar: cinematic_space/spatial-idle.mjs ile aynı tohumda
   aynı kareleri üretmek zorundadır (validate-life-signs §7 sınar), çünkü
   sahne bu kütüphaneye geçtiğinde görüntü değişmemeli. Bu yüzden rastgele
   çekim SIRASI da korunmuştur; dokunmayın. */
export function stationKeeping(seed = 20260816, {
  amplitude = 1,
  aft = { x: -0.95, y: 0, z: -0.31 },
  yan = { x: 0.31, y: 0, z: -0.95 },
} = {}) {
  const rnd = mulberry32(seed);
  const faz = () => rnd() * TAU;
  const fOte = 1 / (10 + rnd() * 8);
  const katmanlar = {
    x:     { f: fOte,               A: 0.010 * amplitude, faz: faz() },
    z:     { f: fOte * PHI3 / 3.1,  A: 0.006 * amplitude, faz: faz() },
    yaw:   { f: fOte / 1.55,        A: 0.60 * DEG,        faz: faz() },
    roll:  { f: fOte / 2.05,        A: 0.40 * DEG,        faz: faz() },
    pitch: { f: fOte / 1.85,        A: 0.25 * DEG,        faz: faz() },
  };
  const zarf = { f1: fOte / PHI3, f2: fOte / (PHI3 * 1.31), faz1: faz(), faz2: faz() };
  const fNefes = 1 / (12 + rnd() * 8);
  const nefesFaz = { x: faz(), y: faz(), yaw: faz() };
  const KARSI = -0.55;
  const fSolunum = 1 / (5.5 + rnd() * 2.5);
  const solunumFaz = faz();
  const kat = (k, t) => k.A * Math.sin(TAU * k.f * t + k.faz) * roughAt(t, zarf.f1, zarf.f2, zarf.faz1, zarf.faz2);

  const CEVRIM = 15 + rnd() * 4;
  const drNorm = k => hash32(k, seed);
  function tutunma(t) {
    const k = Math.floor(t / CEVRIM);
    const f = (t - k * CEVRIM) / CEVRIM;
    const buyukluk = (0.26 + drNorm(k) * 0.12) * amplitude;
    const yonJit = (drNorm(k ^ 0x9e37) - .5) * .3;
    let along, yanma = 0;
    if (f < .62) {
      along = smooth(f / .62) * buyukluk;
    } else if (f < .82) {
      const u = (f - .62) / .20;
      along = buyukluk * (1 - smooth(u)) * (1 + .05 * Math.sin(u * Math.PI));
      yanma = Math.sin(u * Math.PI) ** .7;
    } else {
      const u = (f - .82) / .18;
      along = -buyukluk * .06 * (1 - u) * Math.cos(u * 8);
    }
    const perp = buyukluk * .34 * Math.sin(Math.PI * Math.min(f, .82) / .82) * (1 + yonJit);
    const oran = along / buyukluk;
    return { along, perp, dip: Math.max(0, along) * .22, yanma, tutum: oran * 2.2 * DEG };
  }

  return {
    seed,
    sample(t) {
      const x = kat(katmanlar.x, t), z = kat(katmanlar.z, t);
      const yaw = kat(katmanlar.yaw, t), roll = kat(katmanlar.roll, t), pitch = kat(katmanlar.pitch, t);
      const dur = tutunma(t);
      const solunum = 0.013 * Math.sin(TAU * fSolunum * t + solunumFaz) *
        roughAt(t, zarf.f1 * 1.7, zarf.f2 * 1.13, zarf.faz2, zarf.faz1);
      return {
        craft: {
          x: x + aft.x * dur.along + yan.x * dur.perp,
          y: z * 0.4 + aft.y * dur.along + yan.y * dur.perp - dur.dip,
          z: z + aft.z * dur.along + yan.z * dur.perp,
          yaw: yaw + dur.tutum, pitch, roll, nefes: solunum,
        },
        burn: dur.yanma,
        camera: {
          x: KARSI * x + 0.012 * amplitude * Math.sin(TAU * fNefes * t + nefesFaz.x),
          y: KARSI * z * 0.4 + 0.008 * amplitude * Math.sin(TAU * fNefes * 1.27 * t + nefesFaz.y),
          yaw: 0.12 * DEG * Math.sin(TAU * fNefes * 0.83 * t + nefesFaz.yaw),
        },
      };
    },
    /** Denetim için: en güçlü kanal frekansları. */
    frequencies() { return [katmanlar.x.f, katmanlar.z.f, katmanlar.yaw.f, katmanlar.roll.f, katmanlar.pitch.f]; },
  };
}

export const LIFE_SIGNS_UNITS = Object.freeze({
  konum: 'nesne boyu oranı', aci: 'radyan', olcek: 'oransız delta', isik: 'oransız delta',
});
export { clamp, smooth, TAU, DEG };
