/* Ay'a motorlu iniş — ANALİTİK gerçeklik düzeyi.
   Üç fazlı rehberlik, yarı-örtük (semi-implicit) Euler ile ENTEGRE edilir;
   hiçbir konum/hız keyframe değildir. Düşey düzlemde 2B durum (x: menzil,
   y: irtifa), sabit ay yerçekimi. three.js'e bağımlı DEĞİLDİR — Node ile
   doğrudan kalibre edilebilir/test edilebilir.

   Faz 1 — Frenleme: 15 km irtifa, sahaya −450 km menzil, yatay v0 ≈ yörünge
     hızı. Sabit büyüklükte itki (A_FREN), yön geri-yönlü (retrograd) +
     düşey-hız-referanslı hafif destek; yatay hız ≈ 0 olurken irtifa ≈ 2 km.
   Faz 2 — Yaklaşma: itki vektörü düşeye döner; düşey hız −28 → −12 m/s
     rampası, hedef 150 m.
   Faz 3 — Son iniş: düşey; düşey hız irtifayla −12 → −0.85 m/s'e iner,
     temasta ≤ 1 m/s. Temasta motor kesilir; 2% bacak oturması görsel katmanda.

   Zaman büküm (timewarp): toplam oynatma ≈ 35 s olacak şekilde faz başına
   hedef büküm; oynatma-zamanı alanında yumuşatılır (süreklilik yasası).

   SINIRLAR (manifest'te de bildirilir): 2B düzlem, sabit g (merkezkaç
   rahatlaması yok), düz arazi, dinamikte sabit kütle (yakıt yalnız gösterge,
   Tsiolkovsky ile entegre), araç ölçeği ve süre görselde sıkıştırılmış. */

export const SABITLER = {
  G_AY: 1.62,          // m/s² — ay yüzey yerçekimi
  V0: 1673,            // m/s — 15 km'de dairesel yörünge hızı ≈ √(μ/r), μ=4902.8 km³/s²
  IRTIFA0: 15000,      // m
  MENZIL0: -450000,    // m — frenleme başlangıcının sahaya uzaklığı
  A_FREN: 3.48,        // m/s² — frenleme itki ivmesi (sabit büyüklük, ≈ 2.15 g_ay)
                       //        450 km'de yatay hızın sıfırlanmasına göre ayarlandı
  DT: 1 / 60,          // s — entegrasyon adımı (sim-zamanı)
  VE: 3050,            // m/s — efektif egzoz hızı (Isp ≈ 311 s)
  KURU_KUTLE: 0.42,    // normalize — yakıt göstergesi için kuru kütle oranı
  A_MAX: 5.4,          // m/s² — itki ivmesi tavanı (gaz kolu göstergesi bunun oranı)
  // Frenleme düşey hız referansı: u = vx/V0 (1→0), vyRef = −(BAS·u + SON·(1−u))
  FREN_VY_BAS: 21.6, FREN_VY_SON: 29,
  // Yaklaşma: 1900 → 150 m, vyRef −28 → −12 m/s
  YAK_VY_BAS: 28, YAK_VY_SON: 12,
  // Son iniş: 150 → 0 m, vyRef −12 → −0.85 m/s
  SON_VY_BAS: 12, SON_VY_SON: 0.85,
  // Zaman büküm hedefleri (sim-saniye / oynatma-saniye)
  BUKUM: { 1: 33, 2: 11, 3: 4.2, alcak: 2.0, oturma: 1.25 },
  OTURMA_SIM: 4.0,     // s — temas sonrası örneklenen kuyruk (toz çöker, bacaklar oturur)
};

const kirp = (v, a, b) => Math.min(b, Math.max(a, v));

/* Tüm inişi bir kez entegre eder; oynatma/scrub bu örnek dizisinden
   deterministik olarak okunur. ~45k adım, birkaç ms sürer. */
export function simulateDescent() {
  const S = SABITLER;
  const dt = S.DT;
  let x = S.MENZIL0, y = S.IRTIFA0, vx = S.V0, vy = 0;
  let faz = 1, m = 1, dv = 0, t = 0;
  let temas = false, temasHizi = 0, temasT = 0;
  let bukum = S.BUKUM[1], oynat = 0;

  // İtki vektörü birinci dereceden gecikmeyle komutu izler (C0 süreklilik +
  // sinematik yumuşak yunuslama). Başlangıçta motor zaten yanık: komutla başlat.
  let Tx = 0, Ty = 0, ilkAdim = true;

  const kolon = { t: [], x: [], y: [], vx: [], vy: [], nx: [], ny: [], gaz: [], yakit: [], faz: [], bukum: [], oynat: [] };
  const olaylar = { fazOynat: { 1: 0 }, fazSim: { 1: 0 }, irtifa25: null, irtifa30: null, temasOynat: null, temasSim: null };

  const komut = () => {
    if (temas) return { cx: 0, cy: 1.2, tau: 1.0, kapali: true }; // görsel yön dikeye döner, itki yok
    if (faz === 1) {
      const u = Math.max(0, vx / S.V0);
      const vyRef = -(S.FREN_VY_BAS * u + S.FREN_VY_SON * (1 - u));
      const netY = 0.10 * (vyRef - vy);
      const sinT = kirp((S.G_AY + netY) / S.A_FREN, 0.06, 0.985);
      const cosT = Math.sqrt(1 - sinT * sinT);
      return { cx: -cosT * S.A_FREN, cy: sinT * S.A_FREN, tau: 2.5 };
    }
    if (faz === 2) {
      const f = kirp((y - 150) / (1900 - 150), 0, 1);
      const vyRef = -(S.YAK_VY_SON + (S.YAK_VY_BAS - S.YAK_VY_SON) * f);
      const cy = kirp(S.G_AY + 0.4 * (vyRef - vy), 0.05, S.A_MAX);
      const cx = kirp(-0.0009 * x - 0.18 * vx, -1.2, 1.2);
      return { cx, cy, tau: 1.8 };
    }
    // Faz 3 — son iniş
    const vyRef = -(S.SON_VY_SON + (S.SON_VY_BAS - S.SON_VY_SON) * kirp(y / 150, 0, 1));
    const kv = y < 12 ? 1.3 : 0.7;
    const cy = kirp(S.G_AY + kv * (vyRef - vy), 0.05, S.A_MAX);
    // Alçakta konum kovalamayı bırak, yalnız yatay hızı söndür (P66 mantığı):
    // temas hızı vektörün TAMAMI ile ölçülür, sürüklenme kırıntısı da sayılır.
    const kxIrtifa = 0.003 * kirp((y - 30) / 120, 0, 1);
    const cx = kirp(-kxIrtifa * x - 0.8 * vx, -0.6, 0.6);
    return { cx, cy, tau: 0.9 };
  };

  const ornekle = () => {
    const n = Math.hypot(Tx, Ty) || 1;
    kolon.t.push(t); kolon.x.push(x); kolon.y.push(y);
    kolon.vx.push(vx); kolon.vy.push(vy);
    kolon.nx.push(Tx / n); kolon.ny.push(Ty / n);
    kolon.gaz.push(temas ? 0 : kirp(Math.hypot(Tx, Ty) / S.A_MAX, 0, 1));
    kolon.yakit.push(kirp((m - S.KURU_KUTLE) / (1 - S.KURU_KUTLE), 0, 1));
    kolon.faz.push(faz); kolon.bukum.push(bukum); kolon.oynat.push(oynat);
  };

  const enCok = 900 / dt; // güvenlik tavanı
  for (let adim = 0; adim < enCok; adim++) {
    const k = komut();
    if (ilkAdim) { Tx = k.cx; Ty = k.cy; ilkAdim = false; }
    const izle = Math.min(1, dt / k.tau);
    Tx += (k.cx - Tx) * izle;
    Ty += (k.cy - Ty) * izle;

    if (!temas) {
      // Yarı-örtük Euler: önce hız, sonra konum
      vx += Tx * dt;
      vy += (Ty - S.G_AY) * dt;
      x += vx * dt;
      y += vy * dt;
      const aT = Math.hypot(Tx, Ty);
      dv += aT * dt;                       // toplam ΔV
      m *= Math.exp(-aT * dt / S.VE);      // Tsiolkovsky — yakıt göstergesi

      if (faz === 1 && (vx < 15 || y < 1500)) {
        faz = 2; olaylar.fazSim[2] = t; olaylar.fazOynat[2] = oynat;
      } else if (faz === 2 && y < 150) {
        faz = 3; olaylar.fazSim[3] = t; olaylar.fazOynat[3] = oynat;
      }
      if (faz === 3 && olaylar.irtifa30 === null && y <= 30) olaylar.irtifa30 = { sim: t, oynat };
      if (faz === 3 && olaylar.irtifa25 === null && y <= 25) olaylar.irtifa25 = { sim: t, oynat };

      if (y <= 0) {                        // temas: motor kesme, sekme yok
        temasHizi = Math.hypot(vx, vy);
        temasT = t;
        y = 0; vx = 0; vy = 0; temas = true;
        olaylar.temasSim = t; olaylar.temasOynat = oynat;
      }
    }

    // Zaman büküm: hedefe OYNATMA-zamanı alanında yumuşak yaklaşım
    let hedefB = temas ? S.BUKUM.oturma : S.BUKUM[faz];
    if (!temas && faz === 3 && y < 40) hedefB = S.BUKUM.alcak; // temas yakın çekimi yavaşlar
    const dOynat = dt / bukum;
    bukum += (hedefB - bukum) * Math.min(1, dOynat / 1.1);
    oynat += dOynat;
    t += dt;
    ornekle();

    if (temas && t - temasT >= S.OTURMA_SIM) break;
  }

  const N = kolon.t.length;
  const diziler = {};
  for (const ad of Object.keys(kolon)) diziler[ad] = Float64Array.from(kolon[ad]);

  const toplamOynat = diziler.oynat[N - 1];
  const ozet = {
    temasHizi, toplamDV: dv, toplamSim: diziler.t[N - 1], toplamOynat,
    kalanYakit: kirp((m - S.KURU_KUTLE) / (1 - S.KURU_KUTLE), 0, 1),
    temasX: diziler.x[N - 1],
    fren: { sim: olaylar.fazSim[2], irtifa: null, menzil: null },
  };
  // Frenleme sonu koşulları (rapor için)
  if (olaylar.fazSim[2] != null) {
    const i = diziler.t.findIndex(v => v >= olaylar.fazSim[2]);
    ozet.fren.irtifa = diziler.y[i]; ozet.fren.menzil = diziler.x[i]; ozet.fren.vy = diziler.vy[i];
  }

  /* Oynatma zamanından duruma deterministik okuma (ikili arama + lerp). */
  const oyn = diziler.oynat;
  const durum = p => {
    p = kirp(p, 0, toplamOynat);
    let lo = 0, hi = N - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; (oyn[mid] <= p ? lo = mid : hi = mid); }
    const a = lo, b = hi;
    const f = oyn[b] > oyn[a] ? (p - oyn[a]) / (oyn[b] - oyn[a]) : 0;
    const L = (dizi) => dizi[a] + (dizi[b] - dizi[a]) * f;
    return {
      oynat: p, t: L(diziler.t), x: L(diziler.x), y: L(diziler.y),
      vx: L(diziler.vx), vy: L(diziler.vy), nx: L(diziler.nx), ny: L(diziler.ny),
      gaz: L(diziler.gaz), yakit: L(diziler.yakit),
      faz: diziler.faz[a], bukum: L(diziler.bukum),
      temas: olaylar.temasOynat != null && p >= olaylar.temasOynat,
    };
  };

  return { diziler, olaylar, ozet, durum, toplamOynat };
}
