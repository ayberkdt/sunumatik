/* spatial-idle.mjs — "aktif tutunma" modeli (cinematic-space-plan.md §7).

   Amaç cümlesi: "Araç uzayda konumunu aktif olarak koruyor." Zıplayan bir
   UI nesnesi değil. Bunun için:

   · KATMANLI, DÜŞÜK FREKANSLI salınım: öteleme, dikey süzülme, yaw, roll
     ayrı katmanlardır ve frekans oranları İRRASYONELDİR (lunar_descent'in
     φ³ hilesi) — hiçbir katman çifti ortak katta buluşamaz, göz 30 sn
     izlese de tekrar okuyamaz.
   · TEK SİNÜS ASLA GÖRÜNMEZ: her katmanın genliği, iki ölçüşmez sinüsün
     çarpımı olan yavaş bir "pürüz" zarfıyla modüle edilir.
   · KAMERA NEFESİ aynı yapıdadır ama araca NEGATİF korelasyonludur:
     araç sağa süzülürken kadraj hafif sola direnir — çekimde elde tutulan
     kamera hissi, senkron sallanma değil.
   · Her değer t'nin ve seed'in SAF fonksiyonudur: advance(dt) ile sürülen
     export, canlı oynatımla aynı kareleri üretir.

   Örnek periyotlar (seed'e göre ±): öteleme ~10–18 s · dikey ~7–13 s ·
   yaw ~15–25 s · roll ~18–30 s · kamera nefesi ~12–20 s. */

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const FI3 = ((1 + Math.sqrt(5)) / 2) ** 3;      // φ³ ≈ 4.236 — irrasyonel adım

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* İki ölçüşmez sinüsün çarpımı: [0.55, 1] bandında yavaş, tekrarsız zarf.
   Genlik modülasyonu için — sıfıra inmez, hareket "durmuş" görünmez. */
function puruz(t, f1, f2, faz1, faz2) {
  const s = Math.sin(TAU * f1 * t + faz1) * Math.sin(TAU * f2 * t + faz2);
  return 0.775 + 0.225 * s;
}

/** Tutunma modelini kurar. Dönen sample(t), her çağrıda AYNI t için AYNI
    değerleri üretir (saf fonksiyon — export determinizminin temeli).
    amplitude: sahne birimi ölçeğinde genel genlik (araç boyu ≈ 1 için
    varsayılan %1 mertebesi). */
export function createIdleModel(seed = 20260816, { amplitude = 1 } = {}) {
  const rnd = mulberry32(seed);
  const faz = () => rnd() * TAU;

  /* Temel frekans: öteleme periyodu 10–18 s. Diğer katmanlar φ³ türevi
     oranlarla türetilir — hiçbiri senkron değil. */
  const fOte = 1 / (10 + rnd() * 8);
  const katmanlar = {
    x:     { f: fOte,              A: 0.010 * amplitude, faz: faz() },
    z:     { f: fOte * FI3 / 3.1,  A: 0.006 * amplitude, faz: faz() },  // ~7–13 s
    yaw:   { f: fOte / 1.55,       A: 0.60 * DEG,        faz: faz() },  // ~15–25 s
    roll:  { f: fOte / 2.05,       A: 0.40 * DEG,        faz: faz() },  // ~18–30 s
    pitch: { f: fOte / 1.85,       A: 0.25 * DEG,        faz: faz() },
  };
  /* pürüz zarf frekansları: katman frekanslarından da yavaş */
  const zarf = {
    f1: fOte / FI3, f2: fOte / (FI3 * 1.31),
    faz1: faz(), faz2: faz(),
  };
  /* kamera nefesi ~12–20 s; araca negatif korelasyon oranı */
  const fNefes = 1 / (12 + rnd() * 8);
  const nefesFaz = { x: faz(), y: faz(), yaw: faz() };
  const KARSI = -0.55;

  const kat = (k, t) =>
    k.A * Math.sin(TAU * k.f * t + k.faz) * puruz(t, zarf.f1, zarf.f2, zarf.faz1, zarf.faz2);

  /* TUTUNMA DÖNGÜSÜ (kullanıcı yönergesi): araç ARA ARA geriye/aşağıya
     süzülür, sonra ATEŞLEMEYLE eski yerine gelir — mikro-salınımın üstüne
     binen, NEDENSELLİĞİ görünür bir düzeltme çevrimi. Her çevrim
     deterministik: süre ve genlik k'nin tohumlu hash'inden.
       faz 0.00–0.62: serbest sürüklenme (yavaş ivmelenen geri kayma)
       faz 0.62–0.80: YANMA — alev açık, konum ease ile toparlanır
       faz 0.80–1.00: sönümlü oturma (küçük aşım + yerleşme)                */
  const CEVRIM = 17 + rnd() * 6;                  // 17–23 s
  const drNorm = k => {
    let h = (Math.imul(k, 2654435761) ^ (seed >>> 1)) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 2246822519);
    return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
  };
  const s3 = v => v * v * (3 - 2 * v);
  function tutunma(t) {
    const k = Math.floor(t / CEVRIM);
    const f = (t - k * CEVRIM) / CEVRIM;          // çevrim içi faz 0..1
    const buyukluk = (0.045 + drNorm(k) * 0.035) * amplitude;   // 4,5–8 birim%
    const yonJit = (drNorm(k ^ 0x9e37) - .5) * .5;
    let geriKayma, yanma = 0;
    if (f < .62) {
      geriKayma = s3(f / .62) * buyukluk;          // yavaş, ivmelenen kayma
    } else if (f < .80) {
      const u = (f - .62) / .18;
      geriKayma = buyukluk * (1 - s3(u)) * (1 + .06 * Math.sin(u * Math.PI)); // toparlanma
      yanma = Math.sin(u * Math.PI) ** .7;         // alev zarfı: aç → tepe → kapan
    } else {
      const u = (f - .80) / .20;
      geriKayma = -buyukluk * .05 * (1 - u) * Math.cos(u * 9); // minik aşım + sönüm
    }
    return {
      /* kayma yönü: geriye (−x) ve hafif aşağı; çevrim başına küçük açı oynaması */
      x: -geriKayma * (0.92 + yonJit * .2),
      y: -geriKayma * (0.35 - yonJit * .3),
      yanma,
    };
  }

  return {
    seed,
    /** t (saniye) → araç ve kamera offsetleri + düzeltme yanması [0..1]. */
    sample(t) {
      const x = kat(katmanlar.x, t);
      const z = kat(katmanlar.z, t);
      const yaw = kat(katmanlar.yaw, t);
      const roll = kat(katmanlar.roll, t);
      const pitch = kat(katmanlar.pitch, t);
      const dur = tutunma(t);
      return {
        craft: { x: x + dur.x, y: z * 0.4 + dur.y, z, yaw, pitch, roll },
        burn: dur.yanma,
        camera: {
          x: KARSI * x + 0.012 * amplitude * Math.sin(TAU * fNefes * t + nefesFaz.x),
          y: KARSI * z * 0.4 + 0.008 * amplitude * Math.sin(TAU * fNefes * 1.27 * t + nefesFaz.y),
          yaw: 0.12 * DEG * Math.sin(TAU * fNefes * 0.83 * t + nefesFaz.yaw),
        },
      };
    },
  };
}
