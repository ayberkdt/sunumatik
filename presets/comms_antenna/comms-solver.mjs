// comms-solver.mjs — Haberleşme bağlantısının sayıları. İki sahne de
// (anten/yer istasyonu ve link bütçesi) BU dosyadan beslenir, böylece
// çanak çizimindeki hüzme genişliği ile bütçedeki kazanç ayrışamaz.
//
// TEK BİR ÖDÜNLEŞME BÜTÜN ALANI BELİRLER
// ──────────────────────────────────────
// Anten kazancı G = η(πD/λ)² ile, hüzme genişliği ise θ ≈ 70λ/D ile gider.
// İkisi de λ'yı paydada taşır: FREKANSI YÜKSELTMEK KAZANCI ARTIRIR AMA
// HÜZMEYİ DARALTIR. Aynı çanak S bandında 3,5° hüzmeyle "kabaca" bakarken
// Ka bandında 0,22°'ye iner — kazanç 24 dB artar, ama artık aracı o kadar
// hassas göstermek gerekir. Ka bandına geçmek bir "daha iyi" seçimi değil,
// işaretleme doğruluğunu ve yağmur sönümlemesini satın alan bir takas.
//
// Bütün dB dönüşümleri burada; sayfalarda log alınmaz.

export const C_ISIK = 299792458;            // m/s
export const K_BOLTZ_DB = -228.6;           // 10log10(k), dBW/(K·Hz)

/* ================================================================== */
/* Bantlar                                                            */
/* ================================================================== */
//
// Derin uzay ve uydu haberleşmesinde kullanılan başlıca bantlar. Frekanslar
// tahsis edilmiş derin uzay alt bantlarının ortasıdır; "tipik" sütunları
// sınıfın yaygın değerleridir, belirli bir görevin değil.
export const BANTLAR = Object.freeze({
  S:  { ad: 'S', fGHz: 2.30,  renk: '#5f9ee0',
        not: 'Geniş hüzme, yağmura neredeyse duyarsız. İlk temas, acil durum ve düşük veri hızı.' },
  X:  { ad: 'X', fGHz: 8.42,  renk: '#c9a35c',
        not: 'Derin uzayın iş atı: kazanç ile atmosfer arasında en dengeli nokta.' },
  Ku: { ad: 'Ku', fGHz: 14.0, renk: '#9b7fd4',
        not: 'Yer sabit uydu yayıncılığı. Yağmur sönümlemesi ciddileşmeye başlar.' },
  Ka: { ad: 'Ka', fGHz: 32.0, renk: '#e0894a',
        not: 'Yüksek veri hızı. Kazanç büyük ama hüzme çok dar ve yağmurda bağlantı kesilebilir.' },
});

export const dalgaBoyu = (fGHz) => C_ISIK / (fGHz * 1e9);

/* ================================================================== */
/* Anten                                                              */
/* ================================================================== */

/**
 * Açıklık kazancı. G = η (πD/λ)².
 * η (açıklık verimi) tek bir sayı değil, çarpanların çarpımıdır:
 *   η = η_aydınlatma · η_taşma · η_gölgeleme · η_yüzey · η_kaçak
 * Bunlardan ikisi geometriden HESAPLANABİLİR ve burada öyle yapılır:
 *   · gölgeleme: alt yansıtıcı ve ayakları açıklığın bir kısmını kapatır,
 *     kayıp (1 − A_gölge/A)².  Kare alınır çünkü kapanan alan hem alanı
 *     hem de alan ortalamalı alan integralini düşürür.
 *   · yüzey: Ruze bağıntısı  η_yüzey = exp(−(4πε/λ)²),  ε = rms yüzey hatası.
 *     Bu terim frekansla ÜSTEL çöker — 1 mm'lik bir yüzey hatası X bandında
 *     %2 kayıpken Ka bandında %25 kayıptır. Büyük çanakların neden yüksek
 *     frekansa çıkamadığının cevabı budur.
 */
export function antenKazanci({ D, fGHz, etaAydinlatma = 0.80, golgeCap = 0, ayakSayisi = 0,
                               ayakGenislik = 0, yuzeyHatasiMm = 0.3 }) {
  const lam = dalgaBoyu(fGHz);
  const A = Math.PI * (D / 2) ** 2;
  const aGolge = Math.PI * (golgeCap / 2) ** 2 + ayakSayisi * ayakGenislik * (D / 2);
  const etaGolge = Math.pow(Math.max(0, 1 - aGolge / A), 2);
  const eps = yuzeyHatasiMm / 1000;
  const etaYuzey = Math.exp(-Math.pow((4 * Math.PI * eps) / lam, 2));
  const eta = etaAydinlatma * etaGolge * etaYuzey;
  const G = eta * Math.pow((Math.PI * D) / lam, 2);
  return {
    lam, eta, etaGolge, etaYuzey, G, GdB: 10 * Math.log10(G),
    golgeOran: aGolge / A,
    // Yarı güç hüzme genişliği. 70λ/D yaygın mühendislik yaklaşımıdır
    // (η ≈ 0,6 için); kenar aydınlatması azaldıkça katsayı 65'e iner.
    hpbwDeg: (70 * lam) / D,
    // İlk sıfır: 2·1,22λ/D (dairesel açıklığın Airy deseni).
    ilkSifirDeg: ((2 * 1.22 * lam) / D) * (180 / Math.PI),
  };
}

/** Etkin izotropik yayılan güç: EIRP = P_verici + G_anten − hat kaybı. */
export const eirp = (ptW, GdB, hatKaybiDB = 0.5) =>
  10 * Math.log10(ptW) + GdB - hatKaybiDB;

/**
 * Serbest uzay yayılım kaybı: L = (4πd/λ)².
 * Adı yanıltıcıdır — boşlukta hiçbir enerji SOĞURULMAZ. Kaybın kaynağı
 * yayılmadır: verici gücü giderek büyüyen bir küre yüzeyine dağılır ve
 * alıcının açıklığı o küreden hep aynı büyüklükte bir parça alır. Bu yüzden
 * mesafe iki katına çıkınca 6 dB kaybedilir, frekans iki katına çıkınca da
 * 6 dB — ama frekans arttığında ANTEN KAZANCI 6 dB'den fazla arttığı için
 * yüksek frekans yine de kazançlıdır.
 */
export const fsplDB = (dM, fGHz) => 20 * Math.log10((4 * Math.PI * dM) / dalgaBoyu(fGHz));

/* ================================================================== */
/* Atmosfer ve yağmur                                                 */
/* ================================================================== */
//
// Berrak hava zenit sönümlemesi: oksijen (60 GHz'de tepe yapan kompleks)
// ve su buharı (22,2 GHz çizgisi) hatlarının basit bir toplamı. Tam ITU-R
// P.676 satır satır bir modeldir; buradaki üç terimli uyum 1–40 GHz aralığında
// birkaç onda dB doğrulukta kalır ve NİTEL davranışı doğru verir.
export function berrakHavaZenitDB(fGHz) {
  const o2 = 0.0067 + 0.0021 * Math.pow(fGHz / 10, 2);
  const h2o = 0.045 * Math.exp(-Math.pow((fGHz - 22.2) / 6.0, 2)) + 0.0012 * fGHz;
  return o2 + h2o;
}

/**
 * Yağmur özgül sönümlemesi (ITU-R P.838): γ = k·R^α  [dB/km], R mm/saat.
 * k ve α frekansa ve polarizasyona bağlıdır; burada dairesel polarizasyon
 * için yaygın tablo değerleri log-log ara değerle kullanılır.
 *
 * YAĞMURUN NEDEN KA BANDINDA SORUN OLDUĞU: damla çapı milimetre
 * mertebesindedir. 32 GHz'de dalga boyu 9,4 mm — damla ile dalga aynı
 * ölçekte, saçılma güçlü. 2,3 GHz'de dalga boyu 13 cm; damla, dalganın
 * yanında görünmez kalır.
 */
const P838 = [
  // fGHz,   k,       alpha
  [1,  0.0000259, 0.9691], [2, 0.0000847, 1.0664], [4, 0.0001071, 1.6009],
  [6,  0.0004115, 1.4287], [8, 0.001129,  1.2746], [10, 0.002461, 1.1861],
  [12, 0.004431,  1.1396], [15, 0.008180, 1.0900], [20, 0.01669,  1.0440],
  [25, 0.02932,   0.9979], [30, 0.04481,  0.9630], [35, 0.06242,  0.9324],
  [40, 0.08084,   0.9047],
];
export function yagmurOzgulDB({ fGHz, mmSaat }) {
  if (mmSaat <= 0) return 0;
  const f = Math.max(1, Math.min(40, fGHz));
  let i = 0;
  while (i < P838.length - 2 && P838[i + 1][0] < f) i++;
  const [f1, k1, a1] = P838[i], [f2, k2, a2] = P838[i + 1];
  const t = (Math.log(f) - Math.log(f1)) / (Math.log(f2) - Math.log(f1));
  const k = Math.exp(Math.log(k1) + t * (Math.log(k2) - Math.log(k1)));
  const a = a1 + t * (a2 - a1);
  return k * Math.pow(mmSaat, a);
}

/** Eğik yol: zenit değeri 1/sin(elevasyon) ile çarpılır (düz katman kabulü). */
export const havaKutlesi = (elevDeg) => 1 / Math.sin(Math.max(3, elevDeg) * Math.PI / 180);

/* ================================================================== */
/* Gürültü ve bağlantı                                                */
/* ================================================================== */
//
// G/T alıcının TEK figürüdür: kazancı sistem gürültü sıcaklığına bölünmüş
// hâli. Bir alıcıyı iyileştirmenin iki yolu vardır ve ikisi de G/T'ye girer:
// çanağı büyütmek (G artar) ya da ön ucu soğutmak (T düşer). Derin uzay
// istasyonlarında LNA'lar kriyojenik olarak ~15 K'ya soğutulur — bu, çanağı
// %40 büyütmekle aynı kapıya çıkar ve çok daha ucuzdur.
export function sistemGurultusu({ TantenK = 30, TlnaK = 15, hatKaybiDB = 0.2, TortamK = 290 }) {
  const L = Math.pow(10, hatKaybiDB / 10);
  const That = (L - 1) * TortamK;
  return TantenK + That + L * TlnaK;
}

/**
 * Bağlantı bütçesi. Bütün girdiler dB ya da SI; çıktı bir DÖKÜM listesidir —
 * sayfalar bu listeyi doğrudan çizer, kendileri hesap yapmaz.
 */
export function linkButcesi({
  ptW, GtDB, hatKaybiDB = 0.5, dM, fGHz, GrDB, TsysK,
  elevDeg = 30, mmSaat = 0, yagmurYoluKm = 4,
  isaretlemeKaybiDB = 0.3, kutuplanmaKaybiDB = 0.2,
  veriHiziBps, gerekenEbN0DB = 2.5,
}) {
  const EIRP = eirp(ptW, GtDB, hatKaybiDB);
  const FSPL = fsplDB(dM, fGHz);
  const hava = berrakHavaZenitDB(fGHz) * havaKutlesi(elevDeg);
  const yagmur = yagmurOzgulDB({ fGHz, mmSaat }) * yagmurYoluKm * havaKutlesi(elevDeg) / havaKutlesi(90);
  const GT = GrDB - 10 * Math.log10(TsysK);
  const CN0 = EIRP - FSPL - hava - yagmur - isaretlemeKaybiDB - kutuplanmaKaybiDB + GT - K_BOLTZ_DB;
  const EbN0 = CN0 - 10 * Math.log10(veriHiziBps);
  return {
    dokum: [
      { ad: 'verici gücü', dB: 10 * Math.log10(ptW), tip: 'kaynak' },
      { ad: 'verici anten kazancı', dB: GtDB, tip: 'kaynak' },
      { ad: 'hat kaybı', dB: -hatKaybiDB, tip: 'kayip' },
      { ad: 'serbest uzay kaybı', dB: -FSPL, tip: 'kayip' },
      { ad: 'berrak hava', dB: -hava, tip: 'kayip' },
      { ad: 'yağmur', dB: -yagmur, tip: 'kayip' },
      { ad: 'işaretleme', dB: -isaretlemeKaybiDB, tip: 'kayip' },
      { ad: 'kutuplanma', dB: -kutuplanmaKaybiDB, tip: 'kayip' },
      { ad: 'alıcı G/T', dB: GT, tip: 'kaynak' },
      { ad: '−k (Boltzmann)', dB: -K_BOLTZ_DB, tip: 'kaynak' },
    ],
    EIRP, FSPL, hava, yagmur, GT, CN0, EbN0,
    marj: EbN0 - gerekenEbN0DB,
    // Shannon sınırı: bu C/N₀ ile B bant genişliğinde taşınabilecek EN
    // BÜYÜK hata payı sıfır veri hızı. Gerçek sistemler kodlama verimi
    // yüzünden bunun altında kalır; oran "Shannon'a yakınlık"tır.
    shannonBps: (B) => B * Math.log2(1 + Math.pow(10, (CN0 - 10 * Math.log10(B)) / 10)),
  };
}

/** Doppler kayması: Δf = f·v/c (v yaklaşma hızı, m/s). */
export const doppler = (fGHz, vMs) => (fGHz * 1e9 * vMs) / C_ISIK;

/** Işık gecikmesi (tek yön, saniye). */
export const gecikmeS = (dM) => dM / C_ISIK;

/* ================================================================== */
/* Hazır mesafeler                                                    */
/* ================================================================== */
export const MESAFELER = Object.freeze({
  leo:      { ad: 'AYY (400 km)',        m: 4.0e5 },
  meo:      { ad: 'GNSS (20 200 km)',    m: 2.02e7 },
  geo:      { ad: 'Yer sabit (35 786 km)', m: 3.5786e7 },
  ay:       { ad: 'Ay (384 400 km)',     m: 3.844e8 },
  marsYakin:{ ad: 'Mars en yakın (0,52 AB)', m: 7.8e10 },
  marsUzak: { ad: 'Mars en uzak (2,52 AB)',  m: 3.77e11 },
  jupiter:  { ad: 'Jüpiter (4,2 AB)',    m: 6.28e11 },
  voyager:  { ad: 'Voyager 1 (165 AB)',  m: 2.47e13 },
});
