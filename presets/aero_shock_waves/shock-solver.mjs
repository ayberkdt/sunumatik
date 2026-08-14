// shock-solver.mjs — Süpersonik dalga sistemi: eğik şoklar, genleşme
// yelpazeleri, Mach konisi, şok elmasları. Hiçbir açı elle konmaz.
//
// TEMEL FİKİR
// ───────────
// Ses altı akımda bir cisim, önündeki havayı "haberdar eder": basınç
// bozulmaları ses hızıyla YAYILIR ve akım cisme gelmeden önce yön değiştirmeye
// başlar. Süpersonikte bu imkânsızdır — cisim kendi haberinden hızlı gider.
// Akım cismi ancak ÜSTÜNE ÇARPINCA öğrenir ve yönünü bir anda, sıfır
// kalınlıkta bir yüzeyde değiştirir: ŞOK budur.
//
// İki tür dönüş vardır ve ikisi taban tabana zıttır:
//   · İÇE dönüş (sıkıştırma, örn. bir kama)  → EĞİK ŞOK. Basınç, sıcaklık ve
//     yoğunluk sıçrar; Mach düşer; toplam basınç KAYBOLUR (tersinmez).
//   · DIŞA dönüş (genleşme, örn. bir omuz)  → PRANDTL–MEYER YELPAZESİ.
//     Sonsuz sayıda zayıf Mach dalgası; sürekli, tersinir, izentropik.
//     Basınç düşer, Mach yükselir, toplam basınç KORUNUR.
//
// Bu iki işlemi cismin yüzeyi boyunca sırayla uygulamak "şok–genleşme
// teorisi"dir ve süpersonikte kesin sonuç verir (yüzey görünür olduğu ve
// dalgalar birbirini kesmediği sürece).
//
// γ = 1,4 (iki atomlu, kalorik olarak mükemmel gaz). Hipersonikte bu kabul
// bozulur — ayrışma ve iyonlaşma başlar; sayfa bunu söyler.

const G = 1.4;

/* ================================================================== */
/* 1) İzentropik bağıntılar                                           */
/* ================================================================== */

/** T₀/T = 1 + (γ−1)/2 · M²  — durgunluk (toplam) sıcaklık oranı. */
export function T0overT(M) { return 1 + 0.5 * (G - 1) * M * M; }
/** p₀/p = (1 + (γ−1)/2 M²)^(γ/(γ−1)) */
export function p0overp(M) { return Math.pow(T0overT(M), G / (G - 1)); }
export function rho0overrho(M) { return Math.pow(T0overT(M), 1 / (G - 1)); }

/** Mach açısı μ = arcsin(1/M) — zayıf bir bozulmanın koni yarı açısı. */
export function machAngle(M) { return M <= 1 ? null : Math.asin(1 / M); }

/* ================================================================== */
/* 2) Normal şok                                                      */
/* ================================================================== */
//
// Kütle, momentum ve enerjinin korunumundan çıkan cebirsel bağıntılar.
// Toplam sıcaklık KORUNUR (adyabatik), toplam basınç DÜŞER (tersinmez).

export function normalShock(M1) {
  if (M1 <= 1) return null;
  const m2 = M1 * M1;
  const M2 = Math.sqrt((1 + 0.5 * (G - 1) * m2) / (G * m2 - 0.5 * (G - 1)));
  const p2p1 = 1 + (2 * G / (G + 1)) * (m2 - 1);
  const rho2rho1 = ((G + 1) * m2) / (2 + (G - 1) * m2);
  const T2T1 = p2p1 / rho2rho1;
  // Toplam basınç oranı — entropi artışının doğrudan ölçüsü.
  const p02p01 = Math.pow(((G + 1) * m2 / (2 + (G - 1) * m2)), G / (G - 1))
               * Math.pow((G + 1) / (2 * G * m2 - (G - 1)), 1 / (G - 1));
  return { M2, p2p1, rho2rho1, T2T1, p02p01 };
}

/* ================================================================== */
/* 3) Eğik şok — θ-β-M bağıntısı                                      */
/* ================================================================== */
//
//   tan θ = 2 cot β (M₁² sin²β − 1) / (M₁²(γ + cos 2β) + 2)
//
// β için KAPALI çözüm yoktur; verilen θ ve M₁ için genelde İKİ kök vardır:
// ZAYIF şok (küçük β, arkasında akım genellikle hâlâ süpersonik) ve GÜÇLÜ
// şok (büyük β, arkasında ses altı). Doğada serbest akımda hemen her zaman
// zayıf kök gerçekleşir; güçlü kök arka basınç dayatıldığında görülür.
//
// θ, θ_max'ı aşarsa hiçbir kök yoktur: şok cisimden KOPAR ve önünde eğri bir
// YAY ŞOKU (bow shock) oluşur. Küt burunlu hipersonik araçların tasarım
// gerekçesi tam olarak budur — kopmuş şok, aracın önünde bir tampon gibi
// durur ve durma noktası ısı akısını dağıtır.

export function thetaFromBeta(M1, beta) {
  const s = Math.sin(beta), m2 = M1 * M1;
  const pay = 2 * (Math.cos(beta) / s) * (m2 * s * s - 1);
  const payda = m2 * (G + Math.cos(2 * beta)) + 2;
  return Math.atan2(pay, payda);
}

/** Verilen M₁ için en büyük dönüş açısı ve onu veren β (altın oran araması). */
export function thetaMax(M1) {
  if (M1 <= 1) return null;
  let lo = Math.asin(1 / M1), hi = Math.PI / 2;
  const phi = 0.6180339887;
  let a = hi - phi * (hi - lo), b = lo + phi * (hi - lo);
  let fa = thetaFromBeta(M1, a), fb = thetaFromBeta(M1, b);
  for (let k = 0; k < 90; k++) {
    if (fa < fb) { lo = a; a = b; fa = fb; b = lo + phi * (hi - lo); fb = thetaFromBeta(M1, b); }
    else { hi = b; b = a; fb = fa; a = hi - phi * (hi - lo); fa = thetaFromBeta(M1, a); }
  }
  const beta = 0.5 * (a + b);
  return { theta: thetaFromBeta(M1, beta), beta };
}

/**
 * Eğik şok çözümü. theta = akımın dönüş açısı (radyan, pozitif = içe dönüş).
 * @returns { detached:true, thetaMax } ya da tam çözüm.
 */
export function obliqueShock(M1, theta, { strong = false } = {}) {
  if (M1 <= 1) return null;
  if (theta <= 1e-9) {
    return { beta: Math.asin(1 / M1), M2: M1, p2p1: 1, rho2rho1: 1, T2T1: 1, p02p01: 1, Mn1: 1, theta: 0 };
  }
  const tm = thetaMax(M1);
  if (theta > tm.theta) return { detached: true, thetaMax: tm.theta, betaMax: tm.beta };

  // Zayıf kök [μ, β_max] aralığında, güçlü kök [β_max, 90°] aralığında;
  // θ(β) her iki aralıkta MONOTONdur, bu yüzden bisection güvenlidir.
  let lo, hi;
  if (strong) { lo = tm.beta; hi = Math.PI / 2 - 1e-9; }
  else { lo = Math.asin(1 / M1) + 1e-9; hi = tm.beta; }
  const artan = thetaFromBeta(M1, hi) > thetaFromBeta(M1, lo);
  for (let k = 0; k < 80; k++) {
    const mid = 0.5 * (lo + hi);
    const f = thetaFromBeta(M1, mid);
    if ((f < theta) === artan) lo = mid; else hi = mid;
  }
  const beta = 0.5 * (lo + hi);

  // Şoka DİK bileşen normal şok gibi davranır; teğet bileşen değişmez.
  const Mn1 = M1 * Math.sin(beta);
  const ns = normalShock(Mn1);
  const M2 = ns.M2 / Math.sin(beta - theta);
  return { beta, theta, Mn1, Mn2: ns.M2, M2, p2p1: ns.p2p1, rho2rho1: ns.rho2rho1,
           T2T1: ns.T2T1, p02p01: ns.p02p01, strong };
}

/* ================================================================== */
/* 4) Prandtl–Meyer genleşmesi                                        */
/* ================================================================== */
//
//   ν(M) = √((γ+1)/(γ−1)) · atan√((γ−1)(M²−1)/(γ+1)) − atan√(M²−1)
//
// ν, akımın M = 1'den M'e ulaşmak için dönmesi gereken açıdır. Bir dışa
// dönüşte Δθ kadar dönen akım için ν(M₂) = ν(M₁) + Δθ. Süreç izentropik
// olduğu için toplam basınç korunur ve statik büyüklükler izentropik
// bağıntılardan çıkar.
//
// ν'nin bir ÜST SINIRI vardır: M → ∞ için ν_max = (π/2)(√((γ+1)/(γ−1)) − 1)
// ≈ 130,45°. Akım bundan fazla dışa dönemez — arada boşluk (vakum) oluşur.

export function prandtlMeyer(M) {
  if (M <= 1) return 0;
  const k = Math.sqrt((G + 1) / (G - 1));
  const m = Math.sqrt(M * M - 1);
  return k * Math.atan(m / k) - Math.atan(m);
}

export const NU_MAX = (Math.PI / 2) * (Math.sqrt((G + 1) / (G - 1)) - 1);

/** ν'yü tersine çevir: verilen ν için M (bisection; ν monoton artandır). */
export function machFromNu(nu) {
  if (nu <= 0) return 1;
  if (nu >= NU_MAX) return Infinity;
  let lo = 1, hi = 60;
  for (let k = 0; k < 90; k++) {
    const mid = 0.5 * (lo + hi);
    if (prandtlMeyer(mid) < nu) lo = mid; else hi = mid;
  }
  return 0.5 * (lo + hi);
}

/** Δθ kadar DIŞA dönüş (genleşme). */
export function expansion(M1, dtheta) {
  const nu2 = prandtlMeyer(M1) + dtheta;
  if (nu2 >= NU_MAX) return { vakum: true, nuMax: NU_MAX };
  const M2 = machFromNu(nu2);
  // İzentropik: p₀ sabit ⇒ p₂/p₁ = (p₀/p₁)/(p₀/p₂)
  const p2p1 = p0overp(M1) / p0overp(M2);
  const T2T1 = T0overT(M1) / T0overT(M2);
  return { M2, p2p1, T2T1, rho2rho1: p2p1 / T2T1,
           mu1: machAngle(M1), mu2: machAngle(M2), dtheta };
}

/* ================================================================== */
/* 5) Şok–genleşme teorisi: bir yüzey boyunca marş                    */
/* ================================================================== */
//
// Yüzey, açıları bilinen düz panellerden oluşur. Serbest akımdan başlanır;
// her panel geçişinde akımın dönüş yönüne bakılır:
//   içe (sıkıştırma) → eğik şok      dışa (genleşme) → Prandtl–Meyer
// Her panelde p/p∞ bilindiğinde Cp = (p/p∞ − 1) / (½γM∞²) ile basınç
// katsayısı çıkar; panel normalleri ile toplanınca Cl ve Cd (DALGA
// SÜRÜKLEMESİ) elde edilir.
//
// Ses altı panel yönteminden farklı olarak burada sürükleme SIFIR DEĞİLDİR
// ve olmamalıdır: d'Alembert paradoksu süpersonikte geçerli değildir, çünkü
// şoklar entropi üretir. Dalga sürüklemesi gerçek bir kayıptır.

/**
 * @param paneller [{ yuzey:'ust'|'alt', phi, len }]
 *        phi : panelin GEOMETRİK eğimi (radyan, + = yüzey +z'ye tırmanıyor)
 *        len : panel boyu (veterle normalize)
 *        Normaller phi'den TÜRETİLİR — dışarıdan normal almak, işaretin iki
 *        ayrı yerde tutarlı tutulmasını gerektiriyor ve ilk sürümde tam
 *        oradan hata girdi.
 * @param Minf serbest akım Mach'ı, alpha hücum açısı (radyan)
 * @returns { paneller: [...], cl, cd, cm, kopma }
 *
 * İŞARET DÜZENİ — bir kez yanlış kuruldu, ders şu:
 * Bir dönüşün sıkıştırma mı genleşme mi olduğu, akışkanın YÜZEYİN HANGİ
 * TARAFINDA olduğuna bağlıdır. Aynı geometrik dönüş, üst yüzeyde genleşme
 * iken alt yüzeyde sıkıştırmadır. Tek bir "theta" ile iki yüzeyi birden
 * yönetmeye çalışmak bu yüzden çalışmaz:
 *
 *   genleşme_açısı = üst yüzeyde  (φ_önceki − φ)
 *                    alt yüzeyde  (φ − φ_önceki)
 *
 * Zincir serbest akımdan başlar ve akımın gövde çerçevesindeki yönü +α'dır.
 * Kontrol: α = 0'da elmas profilin ön üst paneli (φ = +ε) → genleşme açısı
 * −ε, yani ε kadar SIKIŞTIRMA (şok) ✓. α = 2ε'de aynı panel → +ε, yani
 * genleşme ✓ (panel artık akımdan kaçıyor). Alt ön panel ise α büyüdükçe
 * daha çok sıkışıyor ✓ — kaldırmanın süpersonikte nereden geldiği budur.
 */
export function shockExpansion(paneller, Minf, alpha) {
  const cikti = [];
  let kopma = false;
  const zincir = (list, ust) => {
    let M = Minf, pRatio = 1, phiOnceki = alpha;
    for (const p of list) {
      const genlesme = ust ? (phiOnceki - p.phi) : (p.phi - phiOnceki);
      let bilgi;
      if (genlesme > 1e-9) {
        const e = expansion(M, genlesme);
        if (e.vakum) { bilgi = { tur: 'vakum' }; }
        else { pRatio *= e.p2p1; M = e.M2; bilgi = { tur: 'genlesme', mu1: e.mu1, mu2: e.mu2, aci: genlesme }; }
      } else if (genlesme < -1e-9) {
        const s = obliqueShock(M, -genlesme);
        if (s.detached) { kopma = true; bilgi = { tur: 'kopmus', thetaMax: s.thetaMax, aci: -genlesme }; }
        else { pRatio *= s.p2p1; M = s.M2; bilgi = { tur: 'sok', beta: s.beta, p02p01: s.p02p01, aci: -genlesme }; }
      } else bilgi = { tur: 'duz', mu1: machAngle(M), aci: 0 };
      phiOnceki = p.phi;
      const cp = (pRatio - 1) / (0.5 * G * Minf * Minf);
      // Dış normal: üst yüzeyde (−sinφ, +cosφ), alt yüzeyde (+sinφ, −cosφ).
      const nx = ust ? -Math.sin(p.phi) : Math.sin(p.phi);
      const nz = ust ? Math.cos(p.phi) : -Math.cos(p.phi);
      cikti.push({ ...p, ust, M, pRatio, cp, nx, nz, ...bilgi });
    }
  };
  zincir(paneller.filter((p) => p.yuzey === 'ust'), true);
  zincir(paneller.filter((p) => p.yuzey === 'alt'), false);

  let cx = 0, cz = 0;
  for (const p of cikti) { cx += -p.cp * p.nx * p.len; cz += -p.cp * p.nz * p.len; }
  const cl = cz * Math.cos(alpha) - cx * Math.sin(alpha);
  const cd = cx * Math.cos(alpha) + cz * Math.sin(alpha);
  return { paneller: cikti, cl, cd, kopma };
}

/* ================================================================== */
/* 6) Doğrusallaştırılmış (Ackeret) teori — karşılaştırma için        */
/* ================================================================== */
//
// İnce cisim ve küçük açı varsayımıyla süpersonik akımda:
//   Cp = 2θ/√(M²−1)      (θ = yerel yüzey eğimi)
//   Cl = 4α/√(M²−1)
//   Cd = 4α²/√(M²−1) + kalınlık ve kamburluk terimleri
// Şok–genleşme çözümünün bu doğruya oturması (küçük α'da) çözücünün
// bağımsız kanıtıdır; büyük α'da ayrışmaları da beklenen davranıştır.

export function ackeret(M, alpha, { kalinlikTerimi = 0 } = {}) {
  if (M <= 1) return null;
  const b = Math.sqrt(M * M - 1);
  return { cl: (4 * alpha) / b, cd: (4 * alpha * alpha) / b + kalinlikTerimi / b };
}

/* ================================================================== */
/* 7) Yay şoku duruşu (Billig bağıntısı)                              */
/* ================================================================== */
//
// Şok koptuğunda burnun önünde durur. Küresel burunlu bir cisim için duruş
// mesafesi (Billig 1967, deneysel uyum):
//   Δ/R = 0,143 exp(3,24/M²)
// Bu, küt burnun NEDEN küt olduğunun sayısıdır: şok ne kadar uzakta durursa,
// durma noktasındaki sıcak gaz o kadar dağılır ve ısı akısı düşer.
export function bowShockStandoff(M, R = 1) {
  if (M <= 1) return null;
  return R * 0.143 * Math.exp(3.24 / (M * M));
}

/**
 * Küresel burunda durma noktası ısı akısı — Sutton–Graves:
 *   q = k √(ρ/R_n) V³,  k ≈ 1,7415×10⁻⁴ (SI, Dünya havası)
 * Hipersonik aracın burnunun neden SONLU yarıçaplı olduğu buradadır:
 * q ∝ 1/√R_n, yani sivri burun sonsuz ısı akısı demektir.
 */
export function suttonGraves(rho, V, Rn) {
  return 1.7415e-4 * Math.sqrt(rho / Rn) * V * V * V;
}

/* ================================================================== */
/* 8) ISA atmosferi (0–86 km)                                         */
/* ================================================================== */
//
// Katman katman sabit sıcaklık gradyanı; her katmanda ya barometrik
// (gradyanlı) ya da izotermal bağıntı. a = √(γRT).
const KATMAN = [
  // [taban yükseklik m, taban sıcaklık K, gradyan K/m]
  [0, 288.15, -0.0065], [11000, 216.65, 0], [20000, 216.65, 0.001],
  [32000, 228.65, 0.0028], [47000, 270.65, 0], [51000, 270.65, -0.0028],
  [71000, 214.65, -0.002],
];
export function isa(hM) {
  const Rg = 287.053, g0 = 9.80665;
  let h = Math.max(0, Math.min(86000, hM));
  let p = 101325, T = 288.15;
  for (let i = 0; i < KATMAN.length; i++) {
    const [hb, Tb, L] = KATMAN[i];
    const hUst = i + 1 < KATMAN.length ? KATMAN[i + 1][0] : 86000;
    if (h <= hb) break;
    const dh = Math.min(h, hUst) - hb;
    if (L === 0) { p *= Math.exp(-g0 * dh / (Rg * Tb)); T = Tb; }
    else { const T2 = Tb + L * dh; p *= Math.pow(T2 / Tb, -g0 / (Rg * L)); T = T2; }
    if (h <= hUst) break;
  }
  const rho = p / (Rg * T);
  return { T, p, rho, a: Math.sqrt(G * Rg * T) };
}

/* ================================================================== */
/* 9) Şok elmasları (egzoz)                                           */
/* ================================================================== */
//
// Nozul çıkışındaki basınç ortam basıncına eşit değilse, jet bir dizi
// genleşme ve sıkıştırma dalgasından geçerek dengeye ulaşmaya çalışır ve
// bu dalgalar birbirini kesip parlak düğümler yapar: MACH ELMASLARI.
// Düğümler arası mesafe için yaygın yaklaşım (Prandtl):
//   L ≈ 1,306 D √(M² − 1)     (D = çıkış çapı)
// Sıcak düğümler afterburner'da görünür hâle gelir çünkü orada yanmamış
// yakıt, şok sonrası sıcaklık sıçramasıyla tutuşur.
export function machDiamondSpacing(M, D) {
  if (M <= 1) return null;
  return 1.306 * D * Math.sqrt(M * M - 1);
}
