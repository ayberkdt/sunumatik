/* routing.mjs — BORU VE KABLO HATLARI.
 * docs/habitat-blocks-plan.md §4.5, §4.6.
 *
 * Bir hat, iki bağlantı noktası arasına çizilen bir çizgi değildir. Gerçek
 * bir hat şunları taşımak zorundadır:
 *   • MESNET — boru kendi ağırlığı altında sarkar; mesnet aralığı sarkma
 *     sınırından ÇIKAR, gözle seçilmez. Aralık yerçekimiyle g^(−1/3) gibi
 *     değişir: Ay'da aynı boru Mars'takinden daha uzun açıklık geçer.
 *   • SARKMA — mesnetler arasındaki eğri zincir eğrisidir (katener),
 *     parabol değil. Küçük sarkmada ikisi yakınsar ama kablo askısında
 *     fark ölçülebilir olur.
 *   • GENLEŞME İLMEĞİ — gündüz-gece farkı yüzeyde 100 K'yi geçer. Düz
 *     çekilmiş boru ΔL = αLΔT kadar kısalmak ister; kısalamazsa uçlarını
 *     koparır. İlmek bu boyu yutar.
 *   • RENK BANDI — içinden ne geçtiği boru üstünde YAZILIDIR; süs değil,
 *     bakımcının hayatını kurtaran bilgidir.
 *
 * Modül three görmez; `buildRun` THREE'yi parametre olarak alır. Böylece
 * bütün matematik ekransız doğrulanabilir.
 */

import { FLUID_BANDS } from './hab-parts.mjs';
import { HAB_ENV } from './hab-parts.mjs';

/* ── malzeme tablosu ──────────────────────────────────────────────────
   E: elastisite modülü (Pa), alfa: ısıl genleşme katsayısı (1/K),
   yogunluk: kg/m³. Kaynak sınıfı değerleridir; belirli bir alaşımın
   sertifika değeri değildir. */
export const MATERIALS = Object.freeze({
  paslanmaz: { ad: '316L paslanmaz', E: 193e9, alfa: 16.0e-6, yogunluk: 7990 },
  aluminyum: { ad: '6061-T6 alüminyum', E: 68.9e9, alfa: 23.6e-6, yogunluk: 2700 },
  titanyum: { ad: 'Ti-6Al-4V', E: 113.8e9, alfa: 8.6e-6, yogunluk: 4430 },
  bakir: { ad: 'Bakır iletken', E: 110e9, alfa: 16.9e-6, yogunluk: 8960 },
});

/** Halka kesitin atalet momenti ve kesit alanı (m⁴, m²). */
export function tubeSection(odM, wallM) {
  const di = Math.max(0, odM - 2 * wallM);
  const I = Math.PI / 64 * (odM ** 4 - di ** 4);
  const A = Math.PI / 4 * (odM ** 2 - di ** 2);
  return { I, A, ic: di };
}

/**
 * İzin verilen mesnet açıklığı.
 *
 * Düzgün yayılı yükte basit kirişin orta sarkması δ = 5wL⁴/(384EI).
 * Sınır δ ≤ L/oran (tesisatta oran = 360 yaygın kabuldür) konulursa:
 *   5wL⁴/(384EI) = L/oran  ⇒  L³ = 384·EI/(5·oran·w)
 * w = (boru + akışkan) birim kütle × g olduğundan L ∝ g^(−1/3):
 * yerçekimi düştükçe aynı boru daha uzun açıklık geçer.
 */
export function supportSpan({ E, I, linMassKgM, g, oran = 360 }) {
  const w = linMassKgM * g;                       // N/m
  if (w <= 0) return Infinity;
  return Math.cbrt(384 * E * I / (5 * oran * w));
}

/** Verilen açıklıkta gerçekleşen orta sarkma (m). */
export function beamSag({ E, I, linMassKgM, g, spanM }) {
  const w = linMassKgM * g;
  return 5 * w * spanM ** 4 / (384 * E * I);
}

/**
 * Zincir eğrisi (katener) parametresi: açıklık L ve orta sarkma s için
 * s = a(cosh(L/2a) − 1) denklemini çözer. Kapalı çözümü yok; küçük
 * sarkmada parabol yaklaşımı a₀ = L²/(8s) iyi bir başlangıçtır ve
 * Newton birkaç adımda kapanır.
 */
export function catenaryA(spanM, sagM, tur = 40) {
  if (sagM <= 0) return Infinity;
  let a = spanM * spanM / (8 * sagM);
  for (let i = 0; i < tur; i++) {
    const u = spanM / (2 * a);
    const f = a * (Math.cosh(u) - 1) - sagM;
    const df = (Math.cosh(u) - 1) - u * Math.sinh(u);   // d/da
    if (Math.abs(df) < 1e-14) break;
    const yeni = a - f / df;
    if (!Number.isFinite(yeni) || yeni <= 0) break;
    if (Math.abs(yeni - a) < 1e-12 * a) { a = yeni; break; }
    a = yeni;
  }
  return a;
}

/** Zincir eğrisinin yay uzunluğu: S = 2a·sinh(L/2a). Analitik. */
export const catenaryLength = (spanM, a) => 2 * a * Math.sinh(spanM / (2 * a));

/** Açıklık ortasına göre düşey iniş (x: −L/2..+L/2, 0 = uç yüksekliği). */
export const catenaryY = (x, a, spanM) => a * Math.cosh(x / a) - a * Math.cosh(spanM / (2 * a));

/**
 * Isıl boy değişimi ve gereken ilmek sayısı.
 * ΔL = α·L·ΔT. Bir ilmek yaklaşık kendi yüksekliğinin ~0,6'sı kadar boy
 * yutar (U ilmeğinin iki kolu esner); güvenli tarafta 0,5 alınır.
 */
export function expansionPlan({ lengthM, malzeme = 'paslanmaz', dT = 110, loopHeightM = 0.5 }) {
  const m = MATERIALS[malzeme];
  if (!m) throw new Error(`routing: bilinmeyen malzeme '${malzeme}'`);
  const dL = m.alfa * lengthM * dT;
  const yutum = loopHeightM * 0.5;
  const adet = dL <= 1e-6 ? 0 : Math.ceil(dL / yutum);
  return { dLm: dL, ilmekAdedi: adet, ilmekYutumM: yutum, araM: adet ? lengthM / adet : Infinity, malzeme: m.ad, dT };
}

/**
 * Bir hattın tam planı: mesnet yerleri, sarkma, ilmek yerleri, renk bandı.
 * a/b: [x,y,z] uç noktaları (metre, saha koordinatı).
 */
export function planRun(a, b, {
  akiskan = 'H2O', env = 'mars', malzeme = 'paslanmaz',
  odM = 0.12, wallM = 0.003, doluluk = 1.0, yukseklikM = 0.35,
  guvenlik = 0.45, dT = 110, loopHeightM = 0.5,
} = {}) {
  const e = HAB_ENV[env];
  if (!e) throw new Error(`routing: bilinmeyen ortam '${env}'`);
  const bant = FLUID_BANDS[akiskan];
  if (!bant) throw new Error(`routing: bilinmeyen akışkan '${akiskan}'`);
  const m = MATERIALS[malzeme];
  const { I, A, ic } = tubeSection(odM, wallM);

  /* Birim kütle = boru cidarı + İÇİNDEKİ akışkan. Akışkan yoğunluğu
     bandın kendisinden gelir; her hatta su varsaymak gaz hattının
     kütlesini üç katına çıkarıyordu (denetim ölçtü: O₂ hattı 245 kg
     görünüyordu, gerçeği 74 kg). */
  const akiskanYog = (bant.yogunluk ?? 0) * doluluk;
  const linMassKgM = A * m.yogunluk + (Math.PI / 4) * ic * ic * akiskanYog;

  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const uzunluk = Math.hypot(dx, dy, dz);

  const izin = supportSpan({ E: m.E, I, linMassKgM, g: e.gravity });
  /* Seçilen aralık izin verilenin altındadır: sarkma tek ölçüt değil,
     vana yükü, titreşim ve montaj kolaylığı da aralığı kısaltır. */
  const aralik = Math.min(izin * guvenlik, 4.0);
  const bolme = Math.max(1, Math.round(uzunluk / aralik));
  const gercekAralik = uzunluk / bolme;
  const sag = beamSag({ E: m.E, I, linMassKgM, g: e.gravity, spanM: gercekAralik });

  const mesnetler = [];
  for (let i = 0; i <= bolme; i++) {
    const t = i / bolme;
    mesnetler.push([a[0] + dx * t, a[1] + dy * t, a[2] + dz * t]);
  }

  const gen = expansionPlan({ lengthM: uzunluk, malzeme, dT, loopHeightM });
  const ilmekler = [];
  for (let i = 1; i <= gen.ilmekAdedi; i++) {
    const t = (i - 0.5) / gen.ilmekAdedi;
    ilmekler.push({ t, pos: [a[0] + dx * t, a[1] + dy * t, a[2] + dz * t] });
  }

  return {
    a, b, uzunlukM: uzunluk, akiskan, bant, ortam: e.ad, malzeme: m.ad,
    odM, wallM, linMassKgM, kesitI: I,
    izinliAralikM: izin, mesnetAraligiM: gercekAralik, mesnetAdedi: mesnetler.length,
    sarkmaM: sag, sarkmaOrani: gercekAralik / sag,
    kutleKg: linMassKgM * uzunluk,
    genlesme: gen, mesnetler, ilmekler, yukseklikM,
  };
}

/* ── gövde ────────────────────────────────────────────────────────────── */

/**
 * Planı üç boyuta çevirir: sarkan boru parçaları, mesnet beşikleri,
 * genleşme ilmekleri ve uçlardaki renk bandı.
 */
export function buildRun(THREE, plan, { segment = 10 } = {}) {
  const g = new THREE.Group();
  g.name = `hat-${plan.akiskan}`;
  const govde = new THREE.MeshStandardMaterial({ color: 0x8d949e, roughness: .55, metalness: .6 });
  const bantMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(plan.bant.renk), roughness: .7, metalness: .1 });
  const mesnetMat = new THREE.MeshStandardMaterial({ color: 0x5d6572, roughness: .8, metalness: .3 });
  const r = plan.odM / 2;

  const A = new THREE.Vector3(...plan.a), B = new THREE.Vector3(...plan.b);
  const eksen = new THREE.Vector3().subVectors(B, A);
  const boy = eksen.length();
  eksen.normalize();

  /* Her mesnet açıklığı kendi zincir eğrisiyle çizilir. */
  const aKat = catenaryA(plan.mesnetAraligiM, Math.max(plan.sarkmaM, 1e-6));
  for (let i = 0; i < plan.mesnetler.length - 1; i++) {
    const p0 = new THREE.Vector3(...plan.mesnetler[i]);
    const p1 = new THREE.Vector3(...plan.mesnetler[i + 1]);
    const nokta = [];
    for (let s = 0; s <= segment; s++) {
      const t = s / segment;
      const x = (t - 0.5) * plan.mesnetAraligiM;
      const d = catenaryY(x, aKat, plan.mesnetAraligiM);   // ≤ 0
      const p = new THREE.Vector3().lerpVectors(p0, p1, t);
      p.z += plan.yukseklikM + d;
      nokta.push(p);
    }
    const egri = new THREE.CatmullRomCurve3(nokta);
    const boru = new THREE.Mesh(new THREE.TubeGeometry(egri, segment, r, 10, false), govde);
    boru.castShadow = true; boru.receiveShadow = true;
    g.add(boru);

    /* beşik: boruyu taşıyan U yatak */
    const m = new THREE.Mesh(new THREE.BoxGeometry(r * 2.6, r * 2.6, plan.yukseklikM), mesnetMat);
    m.position.copy(p1); m.position.z += plan.yukseklikM / 2;
    m.castShadow = true; g.add(m);
  }
  const ilk = new THREE.Mesh(new THREE.BoxGeometry(r * 2.6, r * 2.6, plan.yukseklikM), mesnetMat);
  ilk.position.copy(A); ilk.position.z += plan.yukseklikM / 2; g.add(ilk);

  /* genleşme ilmekleri: düşey U */
  for (const il of plan.ilmekler) {
    const c = new THREE.Vector3(...il.pos); c.z += plan.yukseklikM;
    const yan = new THREE.Vector3(-eksen.y, eksen.x, 0);
    if (yan.lengthSq() < 1e-8) yan.set(1, 0, 0);
    yan.normalize();
    const h = plan.genlesme.ilmekYutumM * 2;
    const w = h * 0.55;
    const nokta = [
      c.clone().addScaledVector(eksen, -w),
      c.clone().addScaledVector(eksen, -w * 0.5).setZ(c.z + h * 0.55),
      c.clone().setZ(c.z + h * 0.8).addScaledVector(yan, w * 0.18),
      c.clone().addScaledVector(eksen, w * 0.5).setZ(c.z + h * 0.55),
      c.clone().addScaledVector(eksen, w),
    ];
    const egri = new THREE.CatmullRomCurve3(nokta);
    const t = new THREE.Mesh(new THREE.TubeGeometry(egri, 24, r, 10, false), govde);
    t.castShadow = true; g.add(t);
  }

  /* renk bandı: iki uçta ve her ~6 m'de bir. Bant BİLGİDİR. */
  const bantAra = 6;
  const bantSayi = Math.max(2, Math.floor(boy / bantAra) + 1);
  for (let i = 0; i < bantSayi; i++) {
    const t = bantSayi === 1 ? 0.5 : i / (bantSayi - 1);
    const p = new THREE.Vector3().lerpVectors(A, B, t);
    p.z += plan.yukseklikM - plan.sarkmaM * 0.5;
    const halka = new THREE.Mesh(new THREE.TorusGeometry(r * 1.06, r * 0.28, 8, 18), bantMat);
    halka.position.copy(p);
    halka.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), eksen);
    g.add(halka);
  }

  g.userData.notes = { regime: `${plan.ortam} yüzeyi`, why:
    `${plan.bant.ad} hattı: ${plan.uzunlukM.toFixed(1)} m, ${plan.mesnetAdedi} mesnet ` +
    `(${plan.mesnetAraligiM.toFixed(2)} m arayla, izin verilen ${plan.izinliAralikM.toFixed(1)} m), ` +
    `sarkma ${(plan.sarkmaM * 1000).toFixed(1)} mm, ` +
    `${plan.genlesme.ilmekAdedi} genleşme ilmeği (ΔT=${plan.genlesme.dT} K → ${(plan.genlesme.dLm * 1000).toFixed(0)} mm).` };
  return g;
}
