/* catalog.mjs — ADLANDIRILMIŞ NEFES DAVRANIŞLARI (three'siz, saf).
 * docs/breathing-motion-plan.md §3 ve §6.
 *
 * İLKE (§3): her davranış GERÇEK bir mekanizmanın GERÇEK boşta
 * davranışıdır. "Canlı görünsün" diye eklenen hareket yoktur. Bu yüzden
 * her satırda `neden` alanı var ve `roverArmTwitch` bir davranış değil,
 * REDDEDİLMİŞ bir satırdır: gerçek gezginde kol boştayken kilitlidir,
 * seğirmez.
 *
 * Her davranış şu şekli taşır:
 *   { id, ad, nesne, sinif, duygu, salience, durum, neden, model, limits,
 *     sample(t) → kanallar, describe() }
 *
 * `sample(t)` SAF'tır ve kanal adları birimleriyle birlikte `limits`'te
 * ilan edilir. Kanalı üç.js'e YAZMAK bind.mjs'in işidir; kaç davranışın
 * aynı anda fark edilebileceğine budget.mjs karar verir.
 *
 * `durum`:
 *   'uygulandı'  — çalışır, vitrinde ve denetimde
 *   'reddedildi' — plan bunu BİLEREK dışarıda bıraktı (gerçek değil)
 *   'bekliyor'   — davranış gerçektir ama bağlanacağı kütüphane henüz yok
 *                  (astronaut_blocks, habitat_blocks, sky_blocks,
 *                  core/light-physics) — plan §9 F3.
 */

import {
  oscBank, roughness, poissonSchedule, saccadeSettle, gazeProgram, envelope,
  counterBreath, stationKeeping, segmentChain, mulberry32, hash32, TAU, DEG, clamp, PHI, smooth,
} from '../core/life-signs.mjs';

const kayit = [];
const ekle = (b) => { kayit.push(b); return b; };

/* Ortak künye üreticisi — manifest satırı buradan çıkar, elle yazılmaz. */
function kunye(b) {
  return {
    id: b.id, ad: b.ad, nesne: b.nesne, sinif: b.sinif, duygu: b.duygu,
    salience: b.salience, durum: b.durum, model: b.model, neden: b.neden,
    limits: b.limits, kanallar: Object.keys(b.limits.kanal || {}),
  };
}

/* ══════════════════════════════ UZAY ARACI ══════════════════════════════ */

/** Aktif tutunma: araç konumunu motorla koruyor (spatial-idle taşındı). */
export function craftStationKeeping({ seed = 20260816, amplitude = 1 } = {}) {
  const m = stationKeeping(seed, { amplitude });
  const b = {
    id: 'craftStationKeeping', ad: 'Tutunma', nesne: 'uzay aracı', sinif: 'craft',
    duygu: 'dinginlik, güven', salience: 0.4, durum: 'uygulandı',
    neden: 'Serbest uçan bir araç konumunu KORUR: sürüklenir, iter, oturur. Görünen şey o düzeltme döngüsüdür.',
    model: 'katmanlı φ³ salınım + tutunma halkası (sürüklenme → yanma → oturma), 15–19 s çevrim',
    limits: { kanal: { x: 'nesne boyu', y: 'nesne boyu', z: 'nesne boyu', yaw: 'rad', pitch: 'rad', roll: 'rad', nefes: 'ölçek Δ', burn: '0..1' },
      konumMax: 0.42 * amplitude, aciMax: 2.9 * DEG, olcekMax: 0.013 },
    sample(t) { const s = m.sample(t); return { ...s.craft, burn: s.burn }; },
    camera(t) { return m.sample(t).camera; },
    frequencies() { return m.frequencies(); },
  };
  b.describe = () => kunye(b);
  return ekle(b);
}

/** Araç solunumu: ±%1,3 ölçek, insan nefes temposunda. */
export function craftBreath({ seed = 7, amplitude = 1 } = {}) {
  const bank = oscBank(seed, { base: [5.5, 8], channels: { nefes: { A: 0.013 * amplitude, ratio: 1 } } });
  const b = {
    id: 'craftBreath', ad: 'Araç solunumu', nesne: 'araç', sinif: 'craft',
    duygu: 'yakınlık', salience: 0.2, durum: 'uygulandı',
    neden: 'Basınçlı bir gövde termal ve basınç çevrimiyle milimetrik soluk alır; ölçek salınımı o soluğun okunabilir karşılığıdır.',
    model: 'ölçek ±%1,3 @ 5,5–8 s, pürüz zarflı',
    limits: { kanal: { nefes: 'ölçek Δ' }, olcekMax: 0.013 * amplitude },
    sample(t) { return { nefes: bank.at('nefes', t) }; },
    frequencies() { return bank.frequencies(); },
  };
  b.describe = () => kunye(b);
  return ekle(b);
}

/** Güneş kanadı takibi: yavaş sürüklenme + gün doğumunda hızlı slew olayı. */
export function panelSunTrack({ seed = 11, rateDegS = 0.06, sunriseEveryS = 180 } = {}) {
  const sac = saccadeSettle({ rateMax: 2.5 * DEG, omegaMax: 1.4 });
  const b = {
    id: 'panelSunTrack', ad: 'Panel Güneş takibi', nesne: 'güneş kanadı', sinif: 'craft',
    duygu: 'dinginlik', salience: 0.15, durum: 'uygulandı',
    neden: 'SADA paneli Güneş\'e dik tutar: yörünge boyunca yavaş sürer, terminatörde hızlı yakalar.',
    model: `sürekli ${rateDegS}°/s + ${sunriseEveryS} s'de bir yakalama slew'i (hızlandırılmış, ilan)`,
    limits: { kanal: { sada: 'rad' }, rateMax: 2.5 * DEG },
    sample(t) {
      /* Panel Güneş'i izler, terminatörde birikmiş açıyı hızlı slew ile
         kapatır. HGA ile aynı sürekli kalıp: çevrim sonu ile başı eşit. */
      const k = Math.floor(t / sunriseEveryS), tau = t - k * sunriseEveryS;
      const birikim = rateDegS * DEG * sunriseEveryS;
      return { sada: rateDegS * DEG * tau + sac.errorAt(birikim, tau) - birikim };
    },
    frequencies() { return [1 / sunriseEveryS]; },
  };
  b.describe = () => kunye(b);
  return ekle(b);
}

/** RCS pufu: Poisson, vakumda 0,4 s'lik darbe. */
export function rcsPuff({ seed = 23, meanGapS = 34 } = {}) {
  const prog = poissonSchedule(seed, meanGapS, { jitter: 0.4 });
  const env = envelope(0.06, 0.34);
  const b = {
    id: 'rcsPuff', ad: 'RCS pufu', nesne: 'araç', sinif: 'craft',
    duygu: 'tanıma', salience: 0.3, durum: 'uygulandı',
    neden: 'Tutunma bütçesi tükenince itici ateşler. Puf, düzeltmenin KENDİSİdir; süsleme değil.',
    model: `Poisson ortalama ${meanGapS} s, 0,4 s zarf (attack 0,06 / decay 0,34)`,
    limits: { kanal: { puf: '0..1', eksen: '0..2' }, sureS: 0.4 },
    sample(t) {
      const l = prog.last(t);
      return { puf: env(l.since), eksen: Math.floor(prog.value(l.index, 3) * 3) };
    },
    schedule: prog,
    frequencies() { return [1 / meanGapS]; },
  };
  b.describe = () => kunye(b);
  return ekle(b);
}

/* ═════════════════════════════════ GEZGİN ═══════════════════════════════ */

/** Direk bakışı: hedef seçimi + hız sınırlı saccade; ara sıra panorama. */
export function roverGaze({ seed = 31, rateDegS = 12, panoramaEveryS = 65, cameraOdds = 1 / 8 } = {}) {
  /* Hedefler gezginin gerçekten baktığı şeylerdir. Plan §10-1: KAMERA
     listede ama düşük olasılıkla — gezginin "bize bakması" etkileyici,
     sık olursa belgesel kırılır. */
  const targets = [
    { ad: 'ufuk-sol', yaw: -52 * DEG, pitch: 2 * DEG },
    { ad: 'ufuk-sağ', yaw: 47 * DEG, pitch: 2 * DEG },
    { ad: 'kaya', yaw: -18 * DEG, pitch: -9 * DEG },
    { ad: 'iz', yaw: 155 * DEG, pitch: -12 * DEG },
    { ad: 'dünya', yaw: 24 * DEG, pitch: 31 * DEG },
    { ad: 'kamera', yaw: 0, pitch: 4 * DEG },
  ];
  const pay = 1 - cameraOdds;
  const weights = [pay * 0.25, pay * 0.25, pay * 0.22, pay * 0.12, pay * 0.16, cameraOdds];
  const sac = saccadeSettle({ rateMax: rateDegS * DEG, omegaMax: 2.2 });
  const PANO_ADIM = 9 * DEG, PANO_KARE = 2.4, PANO_N = 11;

  /* PANORAMA AYRI BİR KATMAN DEĞİL, aynı zincirin segmentleridir. Üstüne
     bindirilen bir tarama, başlarken ve biterken direkte SIÇRAMA yaratır
     (ölçüldü: 39 000°/s). Program, arasına panorama bloğu serpiştirilmiş
     TEK bir hedef dizisidir; süreklilik zincirden gelir. */
  const rnd = mulberry32(seed);
  const segments = [];
  const onceki = { i: -1 };
  let birikim = 0, sonraki = 0;
  const hedefSec = () => {
    const toplam = weights.reduce((a, b) => a + b, 0);
    let acc = 0, u = rnd() * toplam, idx = targets.length - 1;
    for (let k = 0; k < weights.length; k++) { acc += weights[k]; if (u < acc) { idx = k; break; } }
    if (idx === onceki.i) idx = (idx + 1) % targets.length;
    onceki.i = idx;
    return idx;
  };
  for (let n = 0; n < 64; n++) {
    if (birikim >= sonraki) {
      const bas = -((PANO_N - 1) / 2) * PANO_ADIM;
      for (let k = 0; k < PANO_N; k++) {
        segments.push({ tur: 'panorama', yaw: bas + k * PANO_ADIM, pitch: 0, dwell: PANO_KARE, ad: 'panorama' });
        birikim += PANO_KARE;
      }
      sonraki = birikim + panoramaEveryS * (0.75 + 0.5 * rnd());
      onceki.i = -1;
      continue;
    }
    const idx = hedefSec();
    const dwell = 4 + rnd() * 8;
    segments.push({ tur: 'bakış', yaw: targets[idx].yaw, pitch: targets[idx].pitch, dwell, ad: targets[idx].ad });
    birikim += dwell;
  }
  let acc = 0;
  for (const sg of segments) { sg.start = acc; acc += sg.dwell; }
  const horizon = acc;
  const zincirPan = segmentChain(segments, sac, sg => sg.yaw);
  const zincirTilt = segmentChain(segments, sac, sg => sg.pitch);
  const segmentAt = (t) => {
    const w = ((t % horizon) + horizon) % horizon;
    let i = 0;
    for (let k = 0; k < segments.length; k++) { if (segments[k].start <= w) i = k; else break; }
    return { i, tau: w - segments[i].start, seg: segments[i] };
  };

  const b = {
    id: 'roverGaze', ad: 'Direk bakışı', nesne: 'gezgin direği', sinif: 'rover',
    duygu: 'merak', salience: 0.5, durum: 'uygulandı',
    neden: 'Duran gezgin gövdesiyle salınmaz; DİREĞİNİ çevirir. Mastcam hedef seçer, bakar, bekler; ara sıra sıralı panorama çeker.',
    model: `tek zincir: bakış hedefleri (dwell 4–12 s) + ~${panoramaEveryS} s'de bir ${PANO_N}×${PANO_ADIM / DEG}° panorama bloğu; kritik sönümlü saccade, ${rateDegS}°/s sınırlı`,
    limits: { kanal: { pan: 'rad', tilt: 'rad', panorama: '0..1' }, rateMax: rateDegS * DEG, aciMax: 155 * DEG },
    sample(t) {
      const { i, tau, seg } = segmentAt(t);
      return { pan: zincirPan.at(i, tau), tilt: zincirTilt.at(i, tau), panorama: seg.tur === 'panorama' ? 1 : 0 };
    },
    /** Vitrin/denetim için: o anda bakılan hedefin adı. */
    targetAt(t) { return segmentAt(t).seg.ad; },
    targets, segments, horizon, saccade: sac,
    frequencies() { return [segments.length / horizon, 1 / panoramaEveryS]; },
  };
  b.describe = () => kunye(b);
  return ekle(b);
}

/** Durum feneri: üç durumlu LED, olay programlı. */
export function roverBeacon({ seed = 41, meanGapS = 48 } = {}) {
  /* Gerçek: gezgin feneri bir DURUM bildirir. Nominal yavaş nabız, veri
     iletiminde hızlı nabız, uyku modunda sabit kısık. Tek sinüs değil;
     durumu olan bir işaret. */
  const DURUMLAR = [
    { ad: 'nominal', hz: 0.8, taban: 0.30, tepe: 0.62, pay: 0.62 },
    { ad: 'iletim', hz: 3.0, taban: 0.35, tepe: 1.00, pay: 0.20 },
    { ad: 'uyku', hz: 0, taban: 0.22, tepe: 0.22, pay: 0.18 },
  ];
  const prog = poissonSchedule(seed, meanGapS, { jitter: 0.45 });
  const pur = roughness(seed ^ 0x77, 26);
  const GECIS = 0.35;                       // durumlar arası harman süresi
  const durumFor = (index) => {
    const u = prog.value(((index % prog.times.length) + prog.times.length) % prog.times.length, 5);
    let acc = 0;
    for (const d of DURUMLAR) { acc += d.pay; if (u < acc) return d; }
    return DURUMLAR[DURUMLAR.length - 1];
  };
  /* Nabız şekli: kalkış smoothstep (sin^p'nin sıfırda eğimi sonsuzdur ve
     240 Hz'de bile tek karede %70 sıçrar — ölçüldü), sönüm üstel. */
  const nabiz = (d, t) => {
    if (d.hz === 0) return d.taban;
    const faz = (t * d.hz) % 1;
    const darbe = faz < 0.18 ? smooth(faz / 0.18) : Math.exp(-(faz - 0.18) * 4.2);
    return d.taban + (d.tepe - d.taban) * darbe * pur(t);
  };
  const b = {
    id: 'roverBeacon', ad: 'Durum feneri', nesne: 'fener', sinif: 'light',
    duygu: 'tanıma', salience: 0.15, durum: 'uygulandı',
    neden: 'LED süs değil, DURUM bildirir: nominal yavaş, veri indirmede hızlı, uykuda kısık sabit.',
    model: '3 durumlu LED (0,8 Hz / 3 Hz / sabit), Poisson durum geçişi, pürüz zarflı emissive',
    limits: { kanal: { emissive: '0..1', durum: 'ad' }, isikMin: 0.22, isikMax: 1.0 },
    sample(t) {
      const l = prog.last(t);
      const d = durumFor(l.index), onceki = durumFor(l.index - 1);
      /* DURUM GEÇİŞİ HARMANLANIR. Bir durumdan diğerine anlık atlamak
         emissive'de gerçek bir sıçramadır (ölçüldü: 1/240'ta bile Δ0,29)
         ve sözleşme §2'nin "olaylar enerji alanıdır, nesne takası değil"
         kuralını çiğner. LED sürücüsü de ayrık değildir; 0,35 s'lik
         smoothstep hem sürekli hem dürüsttür. */
      const u = clamp(l.since / GECIS, 0, 1);
      const v = nabiz(d, t) * smooth(u) + nabiz(onceki, t) * (1 - smooth(u));
      return { emissive: clamp(v, 0, 1), durum: u < 0.5 ? onceki.ad : d.ad };
    },
    schedule: prog, states: DURUMLAR,
    /* Durum frekansları (0,8 / 3 Hz) birbirini DIŞLAR — aynı anda ikisi
       çalmaz, dolayısıyla vuru da yapmazlar. Ölçüşmezlik sınavına giren
       çift EŞZAMANLI olanlardır: nabız ve onu modüle eden pürüz zarfı. */
    frequencies() { return [DURUMLAR[0].hz, pur.f1]; },
  };
  b.describe = () => kunye(b);
  return ekle(b);
}

/** HGA: Dünya'yı izler — çok yavaş sürüklenme + seyrek düzeltme. */
export function roverHgaTrack({ seed = 53, driftDegS = 0.05, fixEveryS = 90 } = {}) {
  const sac = saccadeSettle({ rateMax: 4 * DEG, omegaMax: 1.1 });
  const b = {
    id: 'roverHgaTrack', ad: 'HGA takibi', nesne: 'çanak', sinif: 'rover',
    duygu: 'yetkinlik', salience: 0.1, durum: 'uygulandı',
    neden: 'Yüksek kazançlı anten Dünya\'yı görmek zorundadır; gezegen döndükçe yavaşça sürer, belirli aralıkla düzeltilir.',
    model: `${driftDegS}°/s sürüklenme, ${fixEveryS} s'de bir düzeltme slew'i (gerçekte 20 dk — HIZLANDIRILMIŞ, ilan)`,
    limits: { kanal: { az: 'rad', el: 'rad' }, rateMax: 4 * DEG },
    sample(t) {
      /* Çanak Dünya'dan uzaklaşır (sürüklenme) ve düzeltmede geri gelir.
         Kalan hata ÇEVRİMİN BAŞINDAKİ birikimdir; böylece çevrim sonuyla
         başı aynı değerde buluşur ve sıçrama olmaz (ölçüldü: ters işaret
         2160°/s'lik bir atlama veriyordu). */
      const k = Math.floor(t / fixEveryS), tau = t - k * fixEveryS;
      const birikim = driftDegS * DEG * fixEveryS;
      /* Yükseliş kanalının periyodu φ katıdır, 2,6 (= 13/5) DEĞİL: rasyonel
         oran iki kanalı ortak katta buluşturur ve göz deseni yakalar
         (denetim §1 bunu 13/5 olarak ölçtü). */
      return { az: driftDegS * DEG * tau + sac.errorAt(birikim, tau) - birikim,
        el: 0.4 * DEG * Math.sin(TAU * t / (fixEveryS * PHI)) };
    },
    frequencies() { return [1 / fixEveryS, 1 / (fixEveryS * PHI)]; },
  };
  b.describe = () => kunye(b);
  return ekle(b);
}

/** REDDEDİLDİ — gerçek gezginde kol boştayken kilitlidir. */
export const roverArmTwitch = Object.freeze({
  id: 'roverArmTwitch', ad: 'Kol seğirmesi', nesne: 'gezgin kolu', sinif: 'rover',
  duygu: null, salience: null, durum: 'reddedildi',
  neden: 'Gerçek gezginde kol boştayken FRENLİ ve kilitlidir. Seğiren bir kol hem yalan hem arıza işaretidir; plan bunu bilerek dışarıda bıraktı.',
  model: null, limits: { kanal: {} },
  describe() { return kunye(this); },
});

/* ═════════════════════════════════ KAMERA ═══════════════════════════════ */

/** Kamera nefesi: nesneye NEGATİF korelasyonlu. */
export function cameraBreath({ seed = 61, source = null, k = -0.55, amplitude = 1 } = {}) {
  const bank = oscBank(seed, { base: [12, 20], channels: { x: { A: 0.012 * amplitude, ratio: 1 }, y: { A: 0.008 * amplitude, ratio: 1 / 1.27 }, yaw: { A: 0.12 * DEG, ratio: 1 / PHI } } });
  const karsi = source ? counterBreath(t => source.sample(t), k) : null;
  const b = {
    id: 'cameraBreath', ad: 'Kamera nefesi', nesne: 'kamera', sinif: 'camera',
    duygu: 'yakınlık', salience: 0.2, durum: 'uygulandı',
    neden: 'Elde tutulan kamera durmaz. Nesneyle SENKRON sallanırsa görüntü ölür; negatif korelasyon çekim hissi verir.',
    model: `serbest nefes (12–20 s) + kaynak davranışa ${k} korelasyon`,
    limits: { kanal: { x: 'nesne boyu', y: 'nesne boyu', yaw: 'rad' }, konumMax: 0.02 * amplitude, aciMax: 0.12 * DEG },
    sample(t) {
      const s = bank.sample(t);
      if (!karsi) return s;
      const c = karsi(t);
      return { x: s.x + (c.x || 0), y: s.y + (c.y || 0), yaw: s.yaw + (c.yaw || 0) };
    },
    frequencies() { return bank.frequencies(); },
  };
  b.describe = () => kunye(b);
  return ekle(b);
}

/** Belgesel yayı: çok yavaş, tek yönlü kamera kayışı. */
export function documentaryArc({ seed = 67, periodS = 240, spanDeg = 14 } = {}) {
  const pur = roughness(seed, periodS / 3);
  const b = {
    id: 'documentaryArc', ad: 'Belgesel yayı', nesne: 'kamera', sinif: 'camera',
    duygu: 'hayranlık', salience: 0.3, durum: 'uygulandı',
    neden: 'Belgesel çekiminde kamera sahneyi çok yavaş tarar; göz kaydığını fark etmez, ama kadraj hep tazedir.',
    model: `${periodS} s periyot, ±${spanDeg / 2}° yay, pürüz zarflı`,
    limits: { kanal: { yaw: 'rad' }, aciMax: (spanDeg / 2) * DEG, rateMax: 0.25 * DEG },
    sample(t) { return { yaw: (spanDeg / 2) * DEG * Math.sin(TAU * t / periodS) * pur(t) }; },
    frequencies() { return [1 / periodS]; },
  };
  b.describe = () => kunye(b);
  return ekle(b);
}

/* ═══════════════════════════ HABİTAT / ÇEVRE ════════════════════════════ */

/** Havacılık engel lambası. */
export function beaconAviation({ seed = 71, fpm = 40 } = {}) {
  /* Plan tablosunda "1 Hz" yazıyor, parantezinde gerçek değer var:
     20–40 flaş/dakika. Gerçeği alıyoruz (40 fpm = 0,667 Hz) ve ilan
     ediyoruz — uydurma yuvarlak sayı kütüphaneye girmez. */
  const hz = fpm / 60;
  const b = {
    id: 'beaconAviation', ad: 'Engel lambası', nesne: 'habitat/kule', sinif: 'light',
    duygu: 'tanıma', salience: 0.15, durum: 'uygulandı',
    neden: 'Yüksek yapıda kırmızı engel lambası zorunludur ve sabit hızda çakar; sahnede ölçek ve insan yapısı işaretidir.',
    model: `${fpm} flaş/dk (${hz.toFixed(3)} Hz), kısa kalkış + üstel sönme`,
    limits: { kanal: { emissive: '0..1' }, isikMax: 1 },
    sample(t) {
      const faz = (t * hz) % 1;
      const v = faz < 0.10 ? smooth(faz / 0.10) : Math.exp(-(faz - 0.10) * 9);
      return { emissive: clamp(v, 0, 1) };
    },
    frequencies() { return [hz]; },
  };
  b.describe = () => kunye(b);
  return ekle(b);
}

/** Kablo/anten salınımı — YALNIZ rüzgârlı ortamda. */
export function cableSway({ seed = 79, wind = 0, lengthM = 6 } = {}) {
  /* Birinci mod: f ≈ (1/2L)·√(T/μ) yerine sahne ölçeğinde ilan edilmiş
     bir periyot kullanılır; önemli olan rüzgâr YOKSA hareketin de
     olmamasıdır. Ay'da kablo sallanmaz. */
  const f = 1 / (1.1 * Math.sqrt(lengthM));
  const bank = oscBank(seed, { base: [1 / f, 1 / f + 0.6], channels: { sway: { A: 1, ratio: 1 }, twist: { A: 0.35, ratio: 1 / 1.43 } } });
  const b = {
    id: 'cableSway', ad: 'Kablo salınımı', nesne: 'kablo/anten', sinif: 'habitat',
    duygu: 'tedirginlik', salience: 0.2, durum: 'uygulandı',
    neden: 'Gergin bir kablo rüzgârda birinci modunda salınır. Havasız ortamda salınmaz — bu yüzden davranış rüzgâr şiddetiyle ÇARPILIR.',
    model: `birinci mod ${(1 / f).toFixed(1)} s, genlik ∝ rüzgâr (wind=0 → hareket yok)`,
    limits: { kanal: { sway: 'rad', twist: 'rad' }, aciMax: 3.5 * DEG, ortam: 'wind > 0' },
    wind,
    sample(t) {
      if (!(this.wind > 0)) return { sway: 0, twist: 0 };
      const g = clamp(this.wind, 0, 1) * 3.5 * DEG;
      const s = bank.sample(t);
      return { sway: s.sway * g, twist: s.twist * g };
    },
    frequencies() { return bank.frequencies(); },
  };
  b.describe = () => kunye(b);
  return ekle(b);
}

/* ═══════════════════════════════ GÖKYÜZÜ ════════════════════════════════ */

/** Yıldız parıldaması — YALNIZ atmosfer altından. */
export function starTwinkle({ seed = 83, fromSurface = true, brightestFraction = 0.02 } = {}) {
  const pur = roughness(seed, 9);
  const b = {
    id: 'starTwinkle', ad: 'Yıldız parıldaması', nesne: 'gökyüzü', sinif: 'sky',
    duygu: 'dinginlik', salience: 0.1, durum: 'uygulandı',
    neden: 'Parıldama atmosferdeki kırılmadır. Uzaydan ve Ay yüzeyinden yıldız PARILDAMAZ; davranış ortam bayrağıyla kapanır.',
    model: `en parlak %${brightestFraction * 100} yıldızda, ölçüşmez iki sinüs; atmosfersiz ortamda kapalı`,
    limits: { kanal: { kazanc: 'oran', pay: 'oran' }, isikMax: 0.18, ortam: 'atmosfer gerekir' },
    fromSurface,
    sample(t) {
      if (!this.fromSurface) return { kazanc: 1, pay: 0 };
      return { kazanc: 1 + 0.18 * (pur(t) - 0.775) / 0.225, pay: brightestFraction };
    },
    frequencies() { return [pur.f1, pur.f2]; },
  };
  b.describe = () => kunye(b);
  return ekle(b);
}

/** Göktaşı: seyrek, tohumlu, zarflı. */
export function meteor({ seed = 89, meanGapS = 42 } = {}) {
  const prog = poissonSchedule(seed, meanGapS, { jitter: 0.5 });
  const env = envelope(0.08, 0.55);
  const b = {
    id: 'meteor', ad: 'Göktaşı', nesne: 'gökyüzü', sinif: 'sky',
    duygu: 'keyif', salience: 0.3, durum: 'uygulandı',
    neden: 'Gerçek bir olay, seyrek ve kısa. Sık olursa havai fişek olur ve sahnenin ölçeğini bozar.',
    model: `Poisson ortalama ${meanGapS} s, 0,6 s zarf, tohumlu yön`,
    limits: { kanal: { parlaklik: '0..1', yon: '0..1' }, sureS: 0.63 },
    sample(t) {
      const l = prog.last(t);
      return { parlaklik: env(l.since), yon: prog.value(l.index, 7) };
    },
    schedule: prog,
    frequencies() { return [1 / meanGapS]; },
  };
  b.describe = () => kunye(b);
  return ekle(b);
}

/* ═════════════════════════════════ HUD ══════════════════════════════════ */

/** HUD oturması: sayı YALNIZ değiştiğinde kısa bir oturma yapar. */
export function hudSettle({ omegaMax = 9 } = {}) {
  const sac = saccadeSettle({ rateMax: 1e9, omegaMax });
  const b = {
    id: 'hudSettle', ad: 'HUD oturması', nesne: 'HUD', sinif: 'hud',
    duygu: 'yetkinlik', salience: 0, durum: 'uygulandı',
    neden: 'Sayı boşta SABİTTİR. Değişmeyen bir değeri kıpırdatmak veriyi yalanlar; yalnız gerçek değişim kısa bir oturmayla gösterilir.',
    model: 'değer değişiminde kritik sönümlü oturma; boşta hareket YOK',
    limits: { kanal: { deger: 'kaynak birimi' }, bostaHareket: 0 },
    /** Boşta hiçbir şey yapmaz; yalnız adım verildiğinde oturur. */
    sample() { return { deger: 0 }; },
    settle(from, to, tau) { return sac.valueAt(from, to, tau); },
    frequencies() { return []; },
  };
  b.describe = () => kunye(b);
  return ekle(b);
}

/* ═══════════════ BEKLEYENLER (kütüphanesi henüz yok — plan F3) ══════════ */

const bekleyen = (id, ad, nesne, sinif, duygu, salience, neden, model, plan) => Object.freeze({
  id, ad, nesne, sinif, duygu, salience, durum: 'bekliyor', neden, model, plan,
  limits: { kanal: {} },
  describe() { return { ...kunye(this), plan }; },
});

export const BEKLEYEN = Object.freeze([
  bekleyen('astroBreath', 'Solunum', 'astronot göğsü', 'astronaut', 'yakınlık', 0.2,
    'Giysi içinde göğüs kafesi 14–18/dk soluk alır; yürüyüşte 22–28.', '%1 ölçek @ 14–18/dk', 'astronaut-figure-plan.md'),
  bekleyen('astroWeightShift', 'Ağırlık aktarımı', 'astronot', 'astronaut', 'dinginlik', 0.25,
    'Ayakta duran insan ağırlığını bacaktan bacağa aktarır; kalça ±1,5 cm gezer.', '8–14 s çevrim', 'astronaut-figure-plan.md'),
  bekleyen('astroLook', 'Gövde bakışı', 'astronot gövdesi', 'astronaut', 'merak', 0.4,
    'Kask sabittir; bakış gövdenin yaw\'ıyla kurulur (±20°).', 'gazeProgram + gövde yaw', 'astronaut-figure-plan.md'),
  bekleyen('habitatVent', 'Vent tozu', 'habitat', 'habitat', 'yakınlık', 0.2,
    'Mars\'ta vent çıkışı tozu rüzgâr yönünde sürükler; Ay\'da atmosfer yok, davranış da yok.', 'Points, rüzgâr yönlü', 'habitat-blocks-plan.md'),
  bekleyen('airlockCycle', 'Hava kilidi çevrimi', 'hava kilidi', 'habitat', 'hazırlık', 0.3,
    'Basınç çevrimi ışıkla bildirilir: sarı (boşaltma) → yeşil (hazır).', '3 dk çevrim (hızlandırılmış, ilan)', 'habitat-blocks-plan.md'),
  bekleyen('variableStar', 'Değişen yıldız', 'kızıl dev / Cepheid', 'sky', 'hayranlık', 0.3,
    'Cepheid\'in parlaklığı gerçek periyotla değişir; sahnede hızlandırılır ve ilan edilir.', 'gerçek periyot × hızlandırma', 'sky-objects-plan.md'),
  bekleyen('flameFlicker', 'Alev/LED titreşimi', 'alev, LED', 'light', null, null,
    'Titreşim ışık fiziğinin alanıdır; iki yerde tanımlanırsa iki farklı titreşim doğar.', 'light-physics flickerField', 'light-physics-plan.md'),
]);

/* ═══════════════════════════════ DİZİN ══════════════════════════════════ */

export const BUILDERS = Object.freeze({
  craftStationKeeping, craftBreath, panelSunTrack, rcsPuff,
  roverGaze, roverBeacon, roverHgaTrack,
  cameraBreath, documentaryArc,
  beaconAviation, cableSway,
  starTwinkle, meteor, hudSettle,
});

export const REDDEDILEN = Object.freeze([roverArmTwitch]);

/** Plan §6 tablosunun TAMAMI: uygulanan + reddedilen + bekleyen. */
export function catalogRows() {
  const uygulanan = Object.keys(BUILDERS).map(k => BUILDERS[k]().describe());
  kayit.length = 0;                     // describe() üretimi kaydı şişirmesin
  return [...uygulanan, ...REDDEDILEN.map(r => r.describe()), ...BEKLEYEN.map(r => r.describe())];
}
