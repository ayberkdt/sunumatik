// lbm-solver.mjs — Kármán vorteks caddesi, GERÇEK bir zamansal çözücüden.
//
// Bu preset bir "vorteks caddesi animasyonu" DEĞİLDİR. Girdap salınımı hiçbir
// yerde programlanmamıştır: akışkan denklemleri adım adım çözülür ve cadde
// kendiliğinden doğar. Kanıtı da ekrandadır — salınım frekansı ölçülür ve
// Strouhal sayısı literatürdeki bağıntıyla karşılaştırılır. Elle konsaydı
// bu karşılaştırmanın hiçbir anlamı olmazdı.
//
// YÖNTEM: Kafes Boltzmann (Lattice Boltzmann), D2Q9, TRT çarpışması.
// ─────────────────────────────────────────────────────────────────────
// Navier–Stokes denklemlerini doğrudan ayrıklaştırmak yerine, kafes üstünde
// dokuz yönde hareket eden bir dağılım fonksiyonu f_i taşınır. Her adımda
// iki iş yapılır: ÇARPIŞMA (f dengeye doğru gevşer) ve TAŞINMA (f komşuya
// gider). Chapman–Enskog açılımı bu iki basit işlemin, düşük Mach sınırında,
// sıkıştırılamaz Navier–Stokes'u verdiğini gösterir; kinematik viskozite
// gevşeme süresinden çıkar: ν = (τ − ½)/3 (kafes birimlerinde).
//
// Denge dağılımı:  f_i^eq = w_i ρ [1 + 3(e_i·u) + 4,5(e_i·u)² − 1,5|u|²]
//
// NEDEN TRT, BGK DEĞİL: tek gevşeme süreli (BGK) çarpışma, yüksek Reynolds'ta
// τ → ½'ye yaklaşınca kararsızlaşır ve sayısal olarak patlar. TRT, dağılımı
// simetrik ve antisimetrik parçalara ayırıp ikisini AYRI gevşetir:
//     τ⁻ = ½ + Λ/(τ⁺ − ½),   Λ = 3/16
// Λ = 3/16 seçimi, sıçratmalı (bounce-back) duvarı tam olarak iki düğümün
// ORTASINA oturtur — yani cismin yüzeyi çözünürlükten bağımsız olarak doğru
// yerde durur. Ek maliyeti birkaç toplama; kazancı, Re 300'e kadar kararlılık.
//
// KUVVET: momentum değişimi yöntemi. Cismin yüzeyine değen her bağda,
// sıçrayan dağılımın taşıdığı momentum toplanır: F = Σ 2 e_i f_i^çarpışma.
// Buradan Cd ve Cl(t) çıkar; Strouhal sayısı da Cl(t)'nin sıfır geçişlerinden.

const EX = new Int32Array([0, 1, 0, -1, 0, 1, -1, -1, 1]);
const EY = new Int32Array([0, 0, 1, 0, -1, 1, 1, -1, -1]);
const W = new Float64Array([4 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 36, 1 / 36, 1 / 36, 1 / 36]);
const OPP = new Int32Array([0, 3, 4, 1, 2, 7, 8, 5, 6]);
const LAMBDA = 3 / 16;

/**
 * @param opts.nx, opts.ny  kafes boyutu
 * @param opts.U            giriş hızı (kafes birimi; ≤0,08 tutulmalı — Mach
 *                          sayısı √3 U'dur ve sıkıştırılabilirlik hatası M²
 *                          ile büyür)
 * @param opts.D            karakteristik boy (hücre)
 * @param opts.re           Reynolds sayısı
 * @param opts.solid        Uint8Array(nx*ny) — 1 = katı
 */
export function createLBM({ nx = 440, ny = 150, U = 0.06, D = 18, re = 120, solid }) {
  const n = nx * ny;
  const f = new Float64Array(9 * n);
  const g = new Float64Array(9 * n);
  const rho = new Float64Array(n);
  const ux = new Float64Array(n);
  const uy = new Float64Array(n);
  const kati = solid || new Uint8Array(n);

  let tauP = 0.5, tauM = 0.5, nu = 0;
  function setRe(r) {
    re = Math.max(0.5, r);
    nu = (U * D) / re;
    tauP = 3 * nu + 0.5;
    tauM = 0.5 + LAMBDA / (tauP - 0.5);
  }
  setRe(re);

  function feq(i, r, vx, vy, usq) {
    const eu = EX[i] * vx + EY[i] * vy;
    return W[i] * r * (1 + 3 * eu + 4.5 * eu * eu - 1.5 * usq);
  }

  function baslat() {
    for (let k = 0; k < n; k++) {
      rho[k] = 1; ux[k] = U; uy[k] = 0;
      const usq = U * U;
      for (let i = 0; i < 9; i++) f[i * n + k] = feq(i, 1, U, 0, usq);
    }
    adim_sayaci = 0; clIz.length = 0; gecisler.length = 0;
    cdTop = 0; cdN = 0;
  }

  let adim_sayaci = 0;
  const clIz = [];          // Cl(t) izi (çizim için)
  const gecisler = [];      // Cl'nin yukarı yönlü sıfır geçiş adımları
  let cdTop = 0, cdN = 0;
  let cdSon = 0, clSon = 0;

  /**
   * Bir zaman adımı: çarpışma + taşınma + sınır koşulları + kuvvet.
   * Simetriyi kıracak bir bozulma GEREKİR: tam simetrik başlangıçta
   * çözüm kararsız bir denge noktasında sonsuza kadar oturur ve cadde
   * hiç doğmaz. Gerçek deneyde bu işi kaçınılmaz gürültü yapar; burada
   * ilk 400 adımda giriş hızına küçük, sönümlenen bir dikey bileşen
   * konur ve sonra tamamen kapanır — cadde kendi kendini sürdürür.
   */
  function adim() {
    const t = adim_sayaci;
    const bozulma = t < 400 ? 0.012 * U * Math.sin((Math.PI * t) / 200) * (1 - t / 400) : 0;
    let Fx = 0, Fy = 0;

    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        const k = y * nx + x;
        if (kati[k]) continue;

        // ── makroskopik büyüklükler
        let r = 0, mx = 0, my = 0;
        for (let i = 0; i < 9; i++) {
          const fi = f[i * n + k];
          r += fi; mx += EX[i] * fi; my += EY[i] * fi;
        }
        const vx = mx / r, vy = my / r;
        rho[k] = r; ux[k] = vx; uy[k] = vy;
        const usq = vx * vx + vy * vy;

        // ── TRT çarpışma + taşınma (birleşik)
        for (let i = 0; i < 9; i++) {
          const j = OPP[i];
          const fi = f[i * n + k], fj = f[j * n + k];
          const ei = feq(i, r, vx, vy, usq), ej = feq(j, r, vx, vy, usq);
          const sP = 0.5 * (fi + fj) - 0.5 * (ei + ej);      // simetrik sapma
          const sM = 0.5 * (fi - fj) - 0.5 * (ei - ej);      // antisimetrik sapma
          const post = fi - sP / tauP - sM / tauM;

          const xn = x + EX[i], yn = y + EY[i];
          if (xn < 0 || xn >= nx || yn < 0 || yn >= ny) {
            g[i * n + k] = post;                              // kenar: sonra ezilir
            continue;
          }
          const kn = yn * nx + xn;
          if (kati[kn]) {
            // Yarı-yol sıçratma + momentum değişimi.
            g[j * n + k] = post;
            Fx += 2 * EX[i] * post;
            Fy += 2 * EY[i] * post;
          } else {
            g[i * n + kn] = post;
          }
        }
      }
    }
    f.set(g);

    // ── Sınırlar: sol giriş (denge), sağ çıkış (kopyalama), alt/üst uzak alan
    const usqIn = U * U + bozulma * bozulma;
    for (let y = 0; y < ny; y++) {
      const k0 = y * nx;
      for (let i = 0; i < 9; i++) f[i * n + k0] = feq(i, 1, U, bozulma, usqIn);
      const kL = y * nx + nx - 1, kL1 = y * nx + nx - 2;
      for (let i = 0; i < 9; i++) f[i * n + kL] = f[i * n + kL1];   // sıfır gradyan
    }
    for (let x = 0; x < nx; x++) {
      const kb = x, kt = (ny - 1) * nx + x;
      for (let i = 0; i < 9; i++) {
        f[i * n + kb] = feq(i, 1, U, 0, U * U);
        f[i * n + kt] = feq(i, 1, U, 0, U * U);
      }
    }

    // ── Katsayılar: Cd = Fx/(½ρU²D)
    const q = 0.5 * U * U * D;
    cdSon = Fx / q; clSon = Fy / q;
    if (t > 1500) { cdTop += cdSon; cdN++; }        // geçici rejim atılır
    clIz.push(clSon);
    if (clIz.length > 4000) clIz.shift();

    // Cl'nin YUKARI YÖNLÜ sıfır geçişleri → periyot → Strouhal.
    if (t > 1500 && clIz.length > 2) {
      const a = clIz[clIz.length - 2], b = clIz[clIz.length - 1];
      if (a < 0 && b >= 0) {
        gecisler.push(t);
        if (gecisler.length > 24) gecisler.shift();
      }
    }
    adim_sayaci++;
  }

  /** Vortisite ω = ∂v/∂x − ∂u/∂y (merkezi fark, kafes birimi). */
  function vortisite(out) {
    const o = out || new Float32Array(n);
    for (let y = 1; y < ny - 1; y++) {
      for (let x = 1; x < nx - 1; x++) {
        const k = y * nx + x;
        if (kati[k]) { o[k] = 0; continue; }
        o[k] = 0.5 * (uy[k + 1] - uy[k - 1]) - 0.5 * (ux[k + nx] - ux[k - nx]);
      }
    }
    return o;
  }

  /**
   * Ölçülen Strouhal sayısı: St = f·D/U. Frekans, Cl'nin ardışık yukarı
   * geçişleri arasındaki ORTALAMA periyottan gelir (ilk ve son geçiş arası
   * / geçiş sayısı — tek tek periyotların ortalamasından daha az gürültülü).
   */
  function strouhal() {
    if (gecisler.length < 4) return null;
    const T = (gecisler[gecisler.length - 1] - gecisler[0]) / (gecisler.length - 1);
    // MAKUL PERİYOT KAPISI. Çözüm ıraksarsa Cl her adımda işaret değiştirir,
    // ölçülen periyot 2-3 adıma iner ve St 100'ün üzerinde saçma bir sayı
    // olarak ekrana basılır. Fiziksel salınım periyodu D/(St·U) mertebesindedir
    // ve bu ayarlarda birkaç yüz adımdır; 40 adımın altındaki bir periyot
    // ölçüm değil, gürültüdür.
    if (!(T > 40)) return null;
    if (!Number.isFinite(cdSon) || !Number.isFinite(clSon)) return null;
    return (D / U) / T;
  }

  /**
   * Roshko'nun deneysel bağıntısı (1954), karşılaştırma için:
   *   St = 0,212(1 − 21,2/Re)   ~50 < Re < 150   (kararlı cadde)
   *   St = 0,212(1 − 12,7/Re)   150 < Re < 300   (geçiş caddesi)
   * Bunlar YALNIZ dairesel silindir içindir ve sonsuz akışa (bloklama yok)
   * aittir; başka cisimlerde ya da dar kanalda karşılaştırma anlamını yitirir.
   */
  function roshko(r) {
    if (r < 50) return null;
    if (r <= 150) return 0.212 * (1 - 21.2 / r);
    if (r <= 300) return 0.212 * (1 - 12.7 / r);
    return null;
  }

  baslat();
  return {
    nx, ny, n, U, D, f, rho, ux, uy, kati,
    get re() { return re; }, setRe, baslat, adim, vortisite, strouhal, roshko,
    get adimSayisi() { return adim_sayaci; },
    get cd() { return cdN ? cdTop / cdN : cdSon; },
    get cdAni() { return cdSon; },
    get cl() { return clSon; },
    get clIzi() { return clIz; },
    get tau() { return tauP; },
    get nu() { return nu; },
    get mach() { return U * Math.sqrt(3); },
  };
}

/* ================================================================== */
/* Cisim maskeleri                                                    */
/* ================================================================== */

export function maskeDaire(nx, ny, cx, cy, D) {
  const m = new Uint8Array(nx * ny), r = D / 2;
  for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++)
    if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) m[y * nx + x] = 1;
  return m;
}

export function maskeKare(nx, ny, cx, cy, D, aciDer = 0) {
  const m = new Uint8Array(nx * ny), h = D / 2;
  const a = (aciDer * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const dx = x - cx, dy = y - cy;
    const u = dx * c + dy * s, v = -dx * s + dy * c;
    if (Math.abs(u) <= h && Math.abs(v) <= h) m[y * nx + x] = 1;
  }
  return m;
}

/** Düz levha: kalınlığı 3 hücre, uzunluğu D, verilen açıda. */
export function maskeLevha(nx, ny, cx, cy, D, aciDer = 90) {
  const m = new Uint8Array(nx * ny), h = D / 2;
  const a = (aciDer * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const dx = x - cx, dy = y - cy;
    const u = dx * c + dy * s, v = -dx * s + dy * c;
    if (Math.abs(u) <= 1.5 && Math.abs(v) <= h) m[y * nx + x] = 1;
  }
  return m;
}

/**
 * Kanat profili maskesi — nokta dizisi dışarıdan verilir (airfoil-solver'ın
 * `nacaNodes` çıktısı). Veter uzunluğu `L` hücre, hücum açısı `aciDer`.
 * Aynı geometri iki presette de kullanılabilsin diye ışın atma ile taranır.
 */
export function maskeProfil(nx, ny, cx, cy, L, aciDer, nodes) {
  const m = new Uint8Array(nx * ny);
  const a = (-aciDer * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  // Profil koordinatları (0…1 veter) → kafes koordinatı.
  const P = nodes.map(([px, py]) => {
    const X = (px - 0.35) * L, Y = py * L;
    return [cx + X * c - Y * s, cy + X * s + Y * c];
  });
  for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    let ic = false;
    for (let i = 0, j = P.length - 2; i < P.length - 1; j = i++) {
      const [xi, yi] = P[i], [xj, yj] = P[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ic = !ic;
    }
    if (ic) m[y * nx + x] = 1;
  }
  return m;
}
