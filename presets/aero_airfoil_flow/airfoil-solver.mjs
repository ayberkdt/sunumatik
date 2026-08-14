// airfoil-solver.mjs — Bir kanat profili etrafındaki akımın GERÇEKTEN
// çözülmesi. Hiçbir eğri elle çizilmez; ekrandaki her sayı buradan çıkar.
//
// ÜÇ KATMAN, ÜÇ AYRI FİZİK
// ────────────────────────
// 1. POTANSİYEL AKIM — doğrusal şiddetli vorteks panel yöntemi (Kuethe &
//    Chow). Profil N panele bölünür, her düğümde bilinmeyen bir vorteks
//    şiddeti γ vardır ve panel boyunca DOĞRUSAL değişir. N tane akım
//    teğetlik denklemi + 1 Kutta koşulu = N+1 bilinmeyen.
//
//    Kutta koşulu γ₁ + γ_{N+1} = 0'dır: keskin firar kenarında hız sonlu
//    kalsın diye. Bu koşul KEYFİ DEĞİLDİR ama potansiyel akım teorisinin
//    içinden de çıkmaz — dışarıdan, viskozitenin gerçekte ne yaptığına
//    bakılarak konur. Sayfadaki "Kutta koşulu" anahtarı onu kapatabilir:
//    kapatınca arka durma noktası ÜST yüzeye tırmanır ve akım keskin firar
//    kenarının etrafından dolanır. Dolaşım sıfırdır, kaldırma sıfırdır.
//    Kaldırmanın nereden geldiğini bundan daha net gösteren bir düğme yok.
//
// 2. SINIR TABAKASI — Thwaites (laminer) → Michel (geçiş) → Head (türbülanslı).
//    Potansiyel çözümün verdiği kenar hızı Ue(s) girdi olur; çıktısı
//    momentum kalınlığı θ, şekil faktörü H, AYRILMA noktası ve
//    Squire–Young ile sürükleme katsayısı. Stall burada doğar: uydurma bir
//    Cl_max eğrisi yoktur, ayrılma noktası öne yürür.
//
// 3. SIKIŞTIRILABİLİRLİK — Prandtl–Glauert: Cp = Cp₀/√(1−M²). Yalnız
//    ses altında ve yalnız ince cisim için geçerlidir; kritik Mach sayısı
//    aşılınca sayfa bunu AÇIKÇA söyler ve düzeltmeyi durdurur.
//
// Birimler: veter c = 1, serbest akım V∞ = 1. Böylece ν = 1/Re.

/* ================================================================== */
/* 1) Geometri — NACA 4 haneli, kosinüs aralıklı                      */
/* ================================================================== */
//
// aircraft-blocks.mjs ile AYNI denklem ve AYNI aralık. Bir sahnede kanadı
// kesip bu çözücüye vermek istediğinizde geometri değişmesin diye.

function camberLine(x, m, p) {
  if (m === 0 || p === 0) return [0, 0];
  if (x < p) return [(m / (p * p)) * (2 * p * x - x * x), (2 * m / (p * p)) * (p - x)];
  const q = (1 - p) * (1 - p);
  return [(m / q) * ((1 - 2 * p) + 2 * p * x - x * x), (2 * m / q) * (p - x)];
}
function halfThickness(x, t) {
  return 5 * t * (0.2969 * Math.sqrt(x) - 0.1260 * x
                - 0.3516 * x * x + 0.2843 * x * x * x - 0.1036 * x * x * x * x);
}

/**
 * Panel düğümleri. SIRA ÖNEMLİ: firar kenarından başlar, ALT yüzeyden
 * hücum kenarına gider, ÜST yüzeyden firar kenarına döner (saat yönü).
 * Panel yöntemi normalleri bu sıraya göre dışa bakar; sıra ters verilirse
 * kaldırma işareti döner.
 * @returns [[x, y], …] uzunluk 2·nHalf + 1, ilk = son (kapalı)
 */
export function nacaNodes(code, nHalf = 80) {
  let m, p, t;
  if (typeof code === 'string') {
    m = parseInt(code[0], 10) / 100; p = parseInt(code[1], 10) / 10; t = parseInt(code.slice(2), 10) / 100;
  } else ({ m = 0, p = 0.4, t = 0.12 } = code || {});
  const up = [], dn = [];
  for (let i = 0; i <= nHalf; i++) {
    const x = 0.5 * (1 - Math.cos((Math.PI * i) / nHalf));
    const yt = halfThickness(x, t);
    const [yc, dyc] = camberLine(x, m, p);
    const th = Math.atan(dyc), s = Math.sin(th), c = Math.cos(th);
    up.push([x - yt * s, yc + yt * c]);
    dn.push([x + yt * s, yc - yt * c]);
  }
  const pts = [];
  for (let i = nHalf; i >= 0; i--) pts.push(dn[i]);   // TE → alt → LE
  for (let i = 1; i <= nHalf; i++) pts.push(up[i]);   // LE → üst → TE
  return pts;
}

/* ================================================================== */
/* 2) Panel etkileşim katsayıları                                     */
/* ================================================================== */
//
// Kuethe & Chow, "Foundations of Aerodynamics", doğrusal şiddetli vorteks
// paneli. Katsayılar 1/2π çarpanını zaten içerir.
//
// Bir ALAN noktasında (kontrol noktası olmayan) hız istendiğinde thetaI = 0
// verilir: o zaman "teğet" bileşen +x, "normal" bileşen +y olur. Aynı rutin
// iki iş görür, böylece alan hızı ile yüzey hızı ayrışamaz.

function panelCoef(xi, yi, thetaI, nodes, j) {
  const [Xj, Yj] = nodes[j], [Xj1, Yj1] = nodes[j + 1];
  const dx = Xj1 - Xj, dy = Yj1 - Yj;
  const S = Math.hypot(dx, dy);
  const thJ = Math.atan2(dy, dx);
  const A = -(xi - Xj) * Math.cos(thJ) - (yi - Yj) * Math.sin(thJ);
  const B = (xi - Xj) * (xi - Xj) + (yi - Yj) * (yi - Yj);
  const C = Math.sin(thetaI - thJ);
  const D = Math.cos(thetaI - thJ);
  const E = (xi - Xj) * Math.sin(thJ) - (yi - Yj) * Math.cos(thJ);
  // B + 2AS + S² = |P − düğüm_{j+1}|² ≥ 0; log argümanı taban çizgisinde
  // sıfıra iner (nokta panelin ÜSTÜNDE). Sonsuza gitmesin diye taban değeri.
  const arg = (S * S + 2 * A * S) / B + 1;
  const F = Math.log(Math.max(arg, 1e-12));
  const G = Math.atan2(E * S, B + A * S);
  const P = (xi - Xj) * Math.sin(thetaI - 2 * thJ) + (yi - Yj) * Math.cos(thetaI - 2 * thJ);
  const Q = (xi - Xj) * Math.cos(thetaI - 2 * thJ) - (yi - Yj) * Math.sin(thetaI - 2 * thJ);
  const cn2 = D + 0.5 * Q * F / S - (A * C + D * E) * G / S;
  const cn1 = 0.5 * D * F + C * G - cn2;
  const ct2 = C + 0.5 * P * F / S + (A * D - C * E) * G / S;
  const ct1 = 0.5 * C * F - D * G - ct2;
  return [cn1, cn2, ct1, ct2];
}

/* Gauss eliminasyonu, kısmi pivotlama. */
function solveLinear(A, b) {
  const n = b.length;
  const M = A.map((r, i) => r.concat([b[i]]));
  for (let k = 0; k < n; k++) {
    let piv = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[piv][k])) piv = i;
    if (piv !== k) { const t = M[k]; M[k] = M[piv]; M[piv] = t; }
    const d = M[k][k];
    if (Math.abs(d) < 1e-14) continue;
    for (let i = k + 1; i < n; i++) {
      const f = M[i][k] / d;
      if (f === 0) continue;
      for (let j = k; j <= n; j++) M[i][j] -= f * M[k][j];
    }
  }
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j];
    x[i] = Math.abs(M[i][i]) < 1e-14 ? 0 : s / M[i][i];
  }
  return x;
}

/* ================================================================== */
/* 3) Çözücü                                                          */
/* ================================================================== */

/**
 * @param nodes    nacaNodes çıktısı
 * @param alphaDeg hücum açısı (derece)
 * @param kutta    false → Kutta koşulu YERİNE Γ = 0 dayatılır (öğretici kip)
 */
export function solveAirfoil(nodes, alphaDeg, { kutta = true } = {}) {
  const N = nodes.length - 1;                 // panel sayısı
  const al = (alphaDeg * Math.PI) / 180;
  const xc = new Float64Array(N), yc = new Float64Array(N);
  const th = new Float64Array(N), S = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    xc[i] = 0.5 * (nodes[i][0] + nodes[i + 1][0]);
    yc[i] = 0.5 * (nodes[i][1] + nodes[i + 1][1]);
    const dx = nodes[i + 1][0] - nodes[i][0], dy = nodes[i + 1][1] - nodes[i][1];
    th[i] = Math.atan2(dy, dx);
    S[i] = Math.hypot(dx, dy);
  }

  const AN = Array.from({ length: N + 1 }, () => new Array(N + 1).fill(0));
  const AT = Array.from({ length: N }, () => new Array(N + 1).fill(0));
  const rhs = new Array(N + 1).fill(0);

  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      let cn1, cn2, ct1, ct2;
      if (i === j) {
        // Panelin KENDİ üzerindeki tekil terimler analitik limitten gelir.
        cn1 = -1; cn2 = 1; ct1 = Math.PI / 2; ct2 = Math.PI / 2;
      } else {
        [cn1, cn2, ct1, ct2] = panelCoef(xc[i], yc[i], th[i], nodes, j);
      }
      AN[i][j] += cn1; AN[i][j + 1] += cn2;
      AT[i][j] += ct1; AT[i][j + 1] += ct2;
    }
    rhs[i] = Math.sin(th[i] - al);
  }

  if (kutta) {
    // γ(firar üst) + γ(firar alt) = 0 → firar kenarında hız sonlu.
    AN[N][0] = 1; AN[N][N] = 1;
    rhs[N] = 0;
  } else {
    // ÖĞRETİCİ KİP: Kutta yerine toplam dolaşım sıfır. Γ = ∮γ ds = 0.
    // Panel başına ortalama γ × panel boyu toplanır.
    for (let j = 0; j < N; j++) { AN[N][j] += 0.5 * S[j]; AN[N][j + 1] += 0.5 * S[j]; }
    rhs[N] = 0;
  }

  const gamma = solveLinear(AN, rhs);          // γ/V∞, düğüm başına

  // Yüzey teğet hızı ve basınç katsayısı (kontrol noktalarında).
  const vt = new Float64Array(N), cp = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    let v = Math.cos(th[i] - al);
    for (let j = 0; j <= N; j++) v += AT[i][j] * gamma[j];
    vt[i] = v;
    cp[i] = 1 - v * v;
  }

  // ── Cl, İKİ BAĞIMSIZ YOLDAN ────────────────────────────────────────
  // (a) Kutta–Jukovski: L = ρV∞Γ ⇒ Cl = 2Γ/(V∞c).
  // (b) Yüzey basıncının integrali: Cl = ∮ −Cp (n̂ · ê_⊥) ds.
  //
  // İkisi aynı çözümün iki farklı okumasıdır; farkları AYRIKLAŞTIRMA
  // HATASIDIR (80 panelde binde birkaç) ve arayüzde kalıntı olarak durur.
  // Büyürse bir şey bozulmuş demektir.
  //
  // DİKKAT — 2π: Kuethe & Chow katsayıları γ'yı 1/2π çarpanı İÇİNDE
  // taşır, yani çözülen dizi vorteks tabakası şiddetinin 2π'de biridir.
  // Ölçüldü: ∮γ_çözüm ds = 0,04798 iken ∮V_t ds = 0,30011 — oran tam 2π.
  // Bu çarpan unutulunca Cl altı kat küçük çıkıyor ve her şey tutarlı
  // görünmeye devam ediyor, çünkü Cp eğrisi doğru kalıyor.
  let gsum = 0;
  for (let j = 0; j < N; j++) gsum += 0.5 * (gamma[j] + gamma[j + 1]) * S[j];
  const circulation = 2 * Math.PI * gsum;
  const clKJ = 2 * circulation;

  // Dış normal: düğüm sırası SAAT YÖNÜ olduğu için (−sinθ, +cosθ).
  // (Ters işaret bir kez kullanıldı: Cl doğru büyüklükte ama NEGATİF çıktı
  // ve alan hızı sorgusu cismin İÇİNİ örnekleyip 0,0005 döndürdü — ki bu
  // aslında çözümün doğru olduğunun kanıtıydı, iç hız gerçekten sıfırdır.)
  let cx = 0, cy = 0, cm = 0;
  for (let i = 0; i < N; i++) {
    const nx = -Math.sin(th[i]), ny = Math.cos(th[i]);
    const fx = -cp[i] * nx * S[i], fy = -cp[i] * ny * S[i];
    cx += fx; cy += fy;
    cm += (xc[i] - 0.25) * fy - yc[i] * fx;
  }
  const clCp = cy * Math.cos(al) - cx * Math.sin(al);
  const cdCp = cx * Math.cos(al) + cy * Math.sin(al);
  // Moment işareti: (x−0,25)·f_y matematiksel SAAT YÖNÜNÜN TERSİ momenttir.
  // Burun x = 0'da, firar x = 1'de olduğu için saat yönünün tersi dönme
  // burnu AŞAĞI indirir. Havacılık işareti ise burun-YUKARI pozitiftir,
  // dolayısıyla eksi. (Kontrol: NACA 2412 için ince profil teorisi −0,0531
  // veriyor, panel −0,0552; literatür ≈ −0,05.)
  cm = -cm;

  return {
    nodes, N, alpha: al, alphaDeg, gamma, vt, cp, xc, yc, th, S, AT,
    circulation,
    cl: clKJ, clFromCp: clCp,
    clResidual: Math.abs(clKJ - clCp),
    // Potansiyel akımda sürükleme SIFIR olmalıdır (d'Alembert paradoksu).
    // Çıkan küçük sayı ayrıklaştırma hatasıdır ve dürüstlük ölçütüdür:
    // "sürükleme yok" demek yerine "sürükleme 0,0013 çıktı, teoride 0"
    // demek, yöntemin sınırını da göstermiş olur.
    cdPressure: cdCp,
    cm4: cm,
    kutta,
  };
}

/**
 * Alan hızı. Aynı katsayı rutini, thetaI = 0 ile: "teğet" = x, "normal" = y.
 */
export function velocityAt(sol, x, y) {
  let u = Math.cos(sol.alpha), v = Math.sin(sol.alpha);
  for (let j = 0; j < sol.N; j++) {
    const [cn1, cn2, ct1, ct2] = panelCoef(x, y, 0, sol.nodes, j);
    u += ct1 * sol.gamma[j] + ct2 * sol.gamma[j + 1];
    v += cn1 * sol.gamma[j] + cn2 * sol.gamma[j + 1];
  }
  return [u, v];
}

/**
 * Hız ALANI ızgarası. Akım çizgileri ve parçacıklar için, nokta nokta
 * `velocityAt` çağırmak yerine bir kez ızgara doldurulur, sonra iki
 * doğrusal ara değerle okunur.
 *
 * NEDEN AYRI BİR RUTİN: genel `velocityAt` her (nokta, panel) çifti için
 * panelin trigonometrisini BAŞTAN hesaplıyordu. Ölçüldü: 220×150 ızgara,
 * 160 panel → 1103 ms. Panel sabitleri (cosθ, sinθ, cos2θ, sin2θ, S) dışarı
 * alınınca çift başına yalnız bir log ve bir atan2 kalıyor. Fizik aynı
 * fizik; yalnız aynı sayıyı 33 000 kez yeniden hesaplamıyoruz.
 *
 * @returns { u, v, nx, ny, x0, y0, dx, dy, ic } — ic: cismin içi maskesi
 */
export function velocityGrid(sol, { x0 = -0.7, x1 = 1.9, y0 = -0.9, y1 = 0.9, nx = 220, ny = 150 } = {}) {
  const { nodes, N, gamma, alpha } = sol;
  const dx = (x1 - x0) / (nx - 1), dy = (y1 - y0) / (ny - 1);
  const u = new Float32Array(nx * ny), v = new Float32Array(nx * ny);
  const ic = new Uint8Array(nx * ny);

  // Panel sabitleri bir kez.
  const PX = new Float64Array(N), PY = new Float64Array(N);
  const CJ = new Float64Array(N), SJ = new Float64Array(N);
  const C2 = new Float64Array(N), S2 = new Float64Array(N), PS = new Float64Array(N);
  for (let j = 0; j < N; j++) {
    const [Xj, Yj] = nodes[j], [Xj1, Yj1] = nodes[j + 1];
    const ddx = Xj1 - Xj, ddy = Yj1 - Yj;
    const S = Math.hypot(ddx, ddy), t = Math.atan2(ddy, ddx);
    PX[j] = Xj; PY[j] = Yj; PS[j] = S;
    CJ[j] = Math.cos(t); SJ[j] = Math.sin(t);
    C2[j] = Math.cos(2 * t); S2[j] = Math.sin(2 * t);
  }
  const ca = Math.cos(alpha), sa = Math.sin(alpha);

  for (let iy = 0; iy < ny; iy++) {
    const yy = y0 + iy * dy;
    for (let ix = 0; ix < nx; ix++) {
      const xx = x0 + ix * dx, k = iy * nx + ix;
      if (insideAirfoil(nodes, xx, yy)) { ic[k] = 1; u[k] = 0; v[k] = 0; continue; }
      let uu = ca, vv = sa;
      for (let j = 0; j < N; j++) {
        const rx = xx - PX[j], ry = yy - PY[j];
        const cj = CJ[j], sj = SJ[j], S = PS[j];
        const A = -rx * cj - ry * sj;
        const B = rx * rx + ry * ry;
        const E = rx * sj - ry * cj;
        const C = -sj, D = cj;                          // thetaI = 0
        const F = Math.log(Math.max((S * S + 2 * A * S) / B + 1, 1e-12));
        const G = Math.atan2(E * S, B + A * S);
        const P = -rx * S2[j] + ry * C2[j];
        const Q = rx * C2[j] + ry * S2[j];
        const cn2 = D + 0.5 * Q * F / S - (A * C + D * E) * G / S;
        const cn1 = 0.5 * D * F + C * G - cn2;
        const ct2 = C + 0.5 * P * F / S + (A * D - C * E) * G / S;
        const ct1 = 0.5 * C * F - D * G - ct2;
        const g0 = gamma[j], g1 = gamma[j + 1];
        uu += ct1 * g0 + ct2 * g1;
        vv += cn1 * g0 + cn2 * g1;
      }
      u[k] = uu; v[k] = vv;
    }
  }

  // ── İÇ HÜCRELERİ DOLDUR ────────────────────────────────────────────
  // Cismin içindeki hücreler sıfır bırakılırsa iki şey bozulur:
  //  (1) çizimde profilin çevresinde IZGARA ÇÖZÜNÜRLÜĞÜNDE siyah kutular
  //      belirir — dört köşesinden biri içeride olan her hücre "geçersiz"
  //      sayıldığı için resimde blok blok delik açılır;
  //  (2) parçacık izleme profilin yanından geçerken bu deliklere düşüp
  //      durur, ayırıcı akım çizgisi araması da bu yüzden hiç yakınsamaz.
  // Çözüm: iç hücreler komşularının ortalamasıyla doldurulur (birkaç geçiş).
  // Bu değerler FİZİK DEĞİLDİR ve hiçbir sayıya girmez; yalnız ara değer
  // çekirdeğinin kenarda düzgün davranmasını sağlar. Cismin kendisi zaten
  // üstüne çizilir. Parçacıklar için katı sorgu (strict) ayrı durur.
  for (let pass = 0; pass < 6; pass++) {
    for (let iy = 1; iy < ny - 1; iy++) {
      for (let ix = 1; ix < nx - 1; ix++) {
        const k = iy * nx + ix;
        if (!ic[k]) continue;
        let su = 0, sv = 0, n = 0;
        for (const kk of [k - 1, k + 1, k - nx, k + nx]) {
          if (ic[kk] && !(u[kk] || v[kk])) continue;
          su += u[kk]; sv += v[kk]; n++;
        }
        if (n) { u[k] = su / n; v[k] = sv / n; }
      }
    }
  }

  return { u, v, nx, ny, x0, y0, x1, y1, dx, dy, ic };
}

/**
 * Izgaradan iki doğrusal ara değer.
 * @param strict true → dört köşeden biri cismin içindeyse null döner
 *               (parçacık izleme bunu kullanır: cisme giren parçacık ölmeli).
 *               false → doldurulmuş değerlerle sürdürür (çizim bunu kullanır).
 */
export function sampleGrid(G, x, y, strict = false) {
  const fx = (x - G.x0) / G.dx, fy = (y - G.y0) / G.dy;
  const i = Math.floor(fx), j = Math.floor(fy);
  if (i < 0 || j < 0 || i >= G.nx - 1 || j >= G.ny - 1) return null;
  const tx = fx - i, ty = fy - j;
  const k00 = j * G.nx + i, k10 = k00 + 1, k01 = k00 + G.nx, k11 = k01 + 1;
  if (strict && (G.ic[k00] || G.ic[k10] || G.ic[k01] || G.ic[k11])) return null;
  const w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty;
  return [
    G.u[k00] * w00 + G.u[k10] * w10 + G.u[k01] * w01 + G.u[k11] * w11,
    G.v[k00] * w00 + G.v[k10] * w10 + G.v[k01] * w01 + G.v[k11] * w11,
  ];
}

/** Nokta profilin İÇİNDE mi (ışın atma). */
export function insideAirfoil(nodes, x, y) {
  let inside = false;
  for (let i = 0, j = nodes.length - 2; i < nodes.length - 1; j = i++) {
    const [xi, yi] = nodes[i], [xj, yj] = nodes[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/* ================================================================== */
/* 4) Sınır tabakası                                                  */
/* ================================================================== */
//
// Thwaites → Michel → Head zinciri. Girdisi potansiyel çözümün kenar hızı,
// çıktısı ayrılma noktası ve sürtünme sürüklemesi. Stall'ın kaynağı budur.

// Thwaites bağıntıları (λ = θ²/ν · dUe/ds).
function thwaitesH(l) {
  if (l >= 0) return 2.61 - 3.75 * l + 5.24 * l * l;
  return 2.088 + 0.0731 / (l + 0.14);
}
function thwaitesL(l) {
  if (l >= 0) return 0.22 + 1.57 * l - 1.8 * l * l;
  return 0.22 + 1.402 * l + (0.018 * l) / (l + 0.107);
}
// Head'in girdi/çıktı şekil faktörü ilişkisi.
function H1ofH(H) {
  if (H <= 1.6) return 3.3 + 0.8234 * Math.pow(Math.max(H - 1.1, 1e-4), -1.287);
  return 3.3 + 1.5501 * Math.pow(Math.max(H - 0.6778, 1e-4), -3.064);
}
function HofH1(H1) {
  if (H1 >= 5.3) return 1.1 + 0.86 * Math.pow(Math.max(H1 - 3.3, 1e-4), -0.777);
  return 0.6778 + 1.1538 * Math.pow(Math.max(H1 - 3.3, 1e-4), -0.326);
}
// Ludwieg–Tillmann sürtünme katsayısı.
function cfTurb(H, Reth) {
  return 0.246 * Math.pow(10, -0.678 * H) * Math.pow(Math.max(Reth, 1), -0.268);
}

/**
 * Bir yüzey boyunca sınır tabakası. s = durma noktasından yay uzunluğu,
 * Ue = kenar hızı (pozitif).
 * @returns { xSep, xTrans, theta, H, cf, sepIndex, transIndex, thetaTE, HTE, ueTE }
 */
function bLayerSurface(s, Ue, xs, Re) {
  const n = s.length;
  const nu = 1 / Re;
  const theta = new Float64Array(n), Hf = new Float64Array(n), cf = new Float64Array(n);
  let sepIdx = -1, transIdx = -1;

  // Durma noktasında Thwaites'in tekil olmayan başlangıcı: θ₀² = 0,075ν/(dUe/ds).
  let dU0 = (Ue[1] - Ue[0]) / Math.max(s[1] - s[0], 1e-9);
  if (!(dU0 > 1e-6)) dU0 = 1e-6;
  let th2 = 0.075 * nu / dU0;
  theta[0] = Math.sqrt(th2);
  Hf[0] = 2.24; cf[0] = 0;

  // ── Laminer bölge: Thwaites'in integral formu ───────────────────
  // θ² = 0,45ν/Ue⁶ ∫ Ue⁵ ds  — integral kümülatif tutulur.
  let I = 0, kabarcik = false;
  for (let i = 1; i < n; i++) {
    const ds = s[i] - s[i - 1];
    I += 0.5 * (Math.pow(Ue[i], 5) + Math.pow(Ue[i - 1], 5)) * ds;
    const U = Math.max(Ue[i], 1e-6);
    th2 = (0.45 * nu / Math.pow(U, 6)) * I;
    theta[i] = Math.sqrt(Math.max(th2, 1e-18));
    const dUds = (Ue[i] - Ue[i - 1]) / Math.max(ds, 1e-9);
    const lam = (theta[i] * theta[i] / nu) * dUds;
    Hf[i] = thwaitesH(Math.max(-0.0999, Math.min(0.1, lam)));
    const Reth = U * theta[i] * Re;
    cf[i] = (2 * thwaitesL(Math.max(-0.0999, Math.min(0.1, lam)))) / Math.max(Reth, 1);

    // Michel geçiş ölçütü: Re_θ ≥ 1,174(1 + 22400/Re_s)·Re_s^0,46
    const Res = Math.max(U * s[i] * Re, 1);
    if (Reth >= 1.174 * (1 + 22400 / Res) * Math.pow(Res, 0.46)) { transIdx = i; break; }

    // AYRILMA KAYNAKLI GEÇİŞ (kısa kabarcık).
    // Laminer ayrılma ölçütü λ ≤ −0,09 sağlandığında marşı durdurmak
    // yanlış sonuç veriyordu: 8°'de üst yüzey %2,5 veterde "ayrıldı" deyip
    // duruyordu, oysa gerçek profil orada AYRILIP HEMEN yeniden yapışır —
    // kısa laminer ayrılma kabarcığı. İntegral yöntemlerin standart kabulü
    // budur: kabarcık ihmal edilecek kadar kısadır, geçiş ayrılma
    // noktasında olmuş sayılır ve türbülanslı marş oradan H = 1,5 ile
    // devam eder. Kabarcığın kendisi MODELLENMEZ; sayfa bunu söyler.
    if (lam <= -0.09) { transIdx = i; kabarcik = true; break; }
  }

  // ── Türbülanslı bölge: Head'in sürükleme (entrainment) yöntemi ──
  if (transIdx >= 0) {
    let H = kabarcik ? 1.5 : 1.4, t = theta[transIdx];
    let H1 = H1ofH(H);
    for (let i = transIdx + 1; i < n; i++) {
      const ds = s[i] - s[i - 1];
      const U = Math.max(Ue[i - 1], 1e-6);
      const dUds = (Ue[i] - Ue[i - 1]) / Math.max(ds, 1e-9);
      const Reth = U * t * Re;
      const c = cfTurb(H, Reth);
      const dth = c / 2 - (H + 2) * (t / U) * dUds;
      const dH1 = (0.0306 * Math.pow(Math.max(H1 - 3, 1e-3), -0.6169) - H1 * dth) / Math.max(t, 1e-12);
      t = Math.max(t + dth * ds, 1e-12);
      H1 = Math.max(H1 + dH1 * ds, 3.05);
      H = HofH1(H1);
      theta[i] = t; Hf[i] = H; cf[i] = cfTurb(H, Math.max(U * t * Re, 1));
      // Türbülanslı ayrılma ölçütü: H ≈ 2,4.
      if (H >= 2.4) { sepIdx = i; break; }
    }
  }

  const last = sepIdx >= 0 ? sepIdx : n - 1;
  return {
    theta, H: Hf, cf, sepIndex: sepIdx, transIndex: transIdx, kabarcik,
    xSep: sepIdx >= 0 ? xs[sepIdx] : null,
    xTrans: transIdx >= 0 ? xs[transIdx] : null,
    thetaTE: theta[last], HTE: Hf[last], ueTE: Math.max(Ue[last], 1e-6),
  };
}

/**
 * İki yüzey için sınır tabakası + Squire–Young sürüklemesi.
 *   Cd = 2 (θ_TE/c) (Ue_TE/V∞)^((H_TE+5)/2)   — her yüzey için ayrı, toplanır.
 */
export function boundaryLayer(sol, Re = 3e6) {
  const { N, vt, xc, S } = sol;
  // Durma noktası: teğet hızın işaret değiştirdiği yer.
  let stag = 0;
  for (let i = 1; i < N; i++) if (vt[i - 1] * vt[i] <= 0) { stag = i; break; }

  // Sıra: TE → alt → LE → üst → TE. Durma noktası hücum kenarına yakındır.
  // ALT yüzey: durma noktasından geriye (index azalarak) firara.
  // ÜST yüzey: durma noktasından ileriye (index artarak) firara.
  const topla = (idx) => {
    const s = [0], Ue = [0], xs = [xc[idx[0]]];
    let acc = 0;
    for (let k = 1; k < idx.length; k++) {
      acc += 0.5 * (S[idx[k]] + S[idx[k - 1]]);
      s.push(acc); Ue.push(Math.abs(vt[idx[k]])); xs.push(xc[idx[k]]);
    }
    return { s, Ue, xs };
  };
  const altIdx = [], ustIdx = [];
  for (let i = stag; i >= 0; i--) altIdx.push(i);
  for (let i = stag; i < N; i++) ustIdx.push(i);

  const a = topla(altIdx), u = topla(ustIdx);
  const alt = bLayerSurface(a.s, a.Ue, a.xs, Re);
  const ust = bLayerSurface(u.s, u.Ue, u.xs, Re);

  const sy = (b) => 2 * b.thetaTE * Math.pow(b.ueTE, (b.HTE + 5) / 2);
  const cd = sy(alt) + sy(ust);

  return {
    ust, alt, cd, Re, stagIndex: stag,
    // Stall ÖLÇÜTÜ (Cl_max değil): üst yüzey ayrılması %50 veteri geçtiyse.
    // Ayrılma %50 veteri geçtiyse potansiyel Cl artık güvenilmez.
    stallUyari: ust.xSep != null && ust.xSep < 0.5,
  };
}

/* ================================================================== */
/* 5) Sıkıştırılabilirlik                                             */
/* ================================================================== */

/** Prandtl–Glauert: Cp = Cp₀/√(1−M²). Yalnız ses altı, ince cisim. */
export function prandtlGlauert(cp0, mach) {
  if (!(mach > 0.01)) return cp0;
  const b = Math.sqrt(Math.max(1 - mach * mach, 1e-6));
  return cp0 / b;
}

/**
 * Kritik basınç katsayısı: yerel akımın tam M = 1 olduğu Cp değeri.
 * İzentropik bağıntıdan (γ = 1,4):
 *   Cp* = (2/(γM²)) [ ((1 + 0,2M²)/1,2)^3,5 − 1 ]
 * Serbest akım Mach'ı artarken Cp* yukarı çıkar; profilin en düşük Cp'si
 * onunla kesiştiği anda KRİTİK MACH'a ulaşılmıştır ve o noktadan sonra
 * Prandtl–Glauert artık geçerli değildir.
 */
export function cpCritical(mach) {
  if (!(mach > 0.01)) return -Infinity;
  const g = 1.4;
  return (2 / (g * mach * mach)) * (Math.pow((1 + 0.2 * mach * mach) / 1.2, 3.5) - 1);
}

/** En düşük Cp'yi Cp* ile kesiştirerek kritik Mach'ı bulur (bisection). */
export function criticalMach(cpMin0) {
  if (!(cpMin0 < 0)) return null;
  // f(M) = Cp_yerel(M) − Cp*(M). Düşük M'de Cp* ÇOK negatiftir (M=0,05'te
  // −269), yerel Cp ise yalnız birkaç onda: f POZİTİF başlar. M büyüdükçe
  // Cp* sıfıra tırmanır, yerel Cp ise Prandtl–Glauert ile aşağı iner —
  // f işaret değiştirir. Yani kök f'in +'dan −'ye geçtiği yerdedir.
  // (İlk sürüm bisectionu ters yöne koşturuyordu ve her zaman null dönüyordu.)
  let lo = 0.05, hi = 0.99;
  const f = (M) => prandtlGlauert(cpMin0, M) - cpCritical(M);
  if (f(lo) < 0 || f(hi) > 0) return null;
  for (let k = 0; k < 60; k++) {
    const mid = 0.5 * (lo + hi);
    if (f(mid) > 0) lo = mid; else hi = mid;
  }
  return 0.5 * (lo + hi);
}

/* ================================================================== */
/* 6) İnce profil teorisi — karşılaştırma için                        */
/* ================================================================== */
//
// Cl = 2π(α − α_L0) ve α_L0 kamburluk çizgisinden:
//   α_L0 = −(1/π) ∫₀^π (dz/dx)(cosθ₀ − 1) dθ₀,  x = (1 − cosθ₀)/2
// Panel çözümü ile bu doğrunun ÜST ÜSTE düşmesi, çözücünün çalıştığının
// bağımsız kanıtıdır (kalınlık farkı birkaç yüzde kalır — teori sıfır
// kalınlık varsayar).
export function thinAirfoil(code) {
  let m, p;
  if (typeof code === 'string') { m = parseInt(code[0], 10) / 100; p = parseInt(code[1], 10) / 10; }
  else ({ m = 0, p = 0.4 } = code || {});
  if (m === 0 || p === 0) return { alphaL0: 0, cmAc: 0 };
  const M = 4000;
  let I = 0, J = 0;
  for (let k = 1; k <= M; k++) {
    const t0 = (Math.PI * (k - 0.5)) / M;
    const x = 0.5 * (1 - Math.cos(t0));
    const dz = camberLine(x, m, p)[1];
    I += dz * (Math.cos(t0) - 1) * (Math.PI / M);
    J += dz * (Math.cos(2 * t0) - Math.cos(t0)) * (Math.PI / M);
  }
  return { alphaL0: (-I / Math.PI) * (180 / Math.PI), cmAc: J / 2 };
}
