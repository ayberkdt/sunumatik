/* craft-surface.mjs — PROSEDÜREL YÜZEY DOKULARI (dosya çekmez, tohumlu).
 *
 * Blok sözleşmesi "dış kaynaktan doku ÇEKİLMEZ" der; üretilen doku bu yasağın
 * dışındadır ve terrain_blocks / ground-treadmill ile aynı yolu izler: tuvale
 * çizilir, deterministiktir, ağ erişimi yoktur.
 *
 * NEDEN GEREKLİ: bir fırlatıcının gövdesi düz beyaz bir silindir değildir.
 * Yakından bakıldığında görünenler, hepsi bir MÜHENDİSLİK gerekçesi taşır:
 *   · PANEL DİKİŞLERİ ve halka kaynakları — tank, tek parça değil halka
 *     halka kaynanmış sac bölümlerdir; dikişler eşit aralıklı çemberlerdir.
 *   · BOYUNA STRINGER izleri — iç takviyeler yüzeyde hafif gölge bırakır.
 *   · YALITIM/BUZ bandı — kriyojenik tankın dışında buz ve köpük; alt tank
 *     (LOX) üstteki yakıt tankından daha soğuktur, bu yüzden bant NET biter.
 *   · MARKALAMA — roll deseni (siyah-beyaz dama), uyarı şeritleri, kapak
 *     çerçeveleri. Roll deseni süs değil: uzaktan izlenen aracın DÖNÜŞÜNÜ
 *     görünür kılmak için konur.
 *
 * Dokular u = çevre (0..1), v = eksen boyunca (0..1) olarak üretilir ve
 * çevrede SARAR (u = 0 ile u = 1 birebir eşleşir) — silindire sarıldığında
 * dikiş görünmez.
 *
 * API:
 *   bodySurface(THREE, { seed, size, bands, tone, roll, insulation }) →
 *     { map, roughnessMap, dispose() }
 *   srbSurface(THREE, { seed, size, segments, tone }) → aynı biçim
 */

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Çevrede SARAN çizgi: u koordinatı 0/1 sınırında kopmasın diye x
    doğrudan piksel olarak verilir; dikey çizgiler zaten sarar. */
function dikeyCizgi(c, x, w, h, renk, kalinlik) {
  c.strokeStyle = renk; c.lineWidth = kalinlik;
  c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke();
}
function yatayCizgi(c, y, w, renk, kalinlik) {
  c.strokeStyle = renk; c.lineWidth = kalinlik;
  c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke();
}

function tuval(size, h) {
  const c = document.createElement('canvas');
  c.width = size; c.height = h ?? size;
  return c;
}

function doku(THREE, canvas, { srgb = true, repeat = [1, 1] } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 8;
  return t;
}

/** Ana gövde yüzeyi: halka kaynakları, stringer izleri, yalıtım/buz bandı,
    roll deseni ve uyarı şeritleri. `bands` eksen boyunca oranlarla verilir:
    [{ from, to, kind: 'insulation'|'dark'|'accent' }] (0 = kuyruk, 1 = burun). */
export function bodySurface(THREE, {
  seed = 4711, size = 1024, boy = 2048, tone = '#d9d5cd', bands = [], roll = true,
} = {}) {
  const c = tuval(size, boy), g = c.getContext('2d');
  const rnd = rng(seed);
  g.fillStyle = tone; g.fillRect(0, 0, size, boy);

  /* Boyuna stringer izleri: 48 adet, çevrede eşit — iç takviyenin gölgesi. */
  for (let i = 0; i < 48; i++) {
    const x = (i + 0.5) * size / 48;
    dikeyCizgi(g, x, size, boy, 'rgba(0,0,0,.055)', 1.6);
    dikeyCizgi(g, x + 2.2, size, boy, 'rgba(255,255,255,.05)', 1.2);
  }
  /* Halka kaynakları: tank bölümleri. Aralık eşit, kalınlık hafif değişir. */
  const halka = 26;
  for (let i = 1; i < halka; i++) {
    const y = i * boy / halka;
    yatayCizgi(g, y, size, 'rgba(0,0,0,.13)', 2.4 + rnd() * 1.1);
    yatayCizgi(g, y + 3, size, 'rgba(255,255,255,.08)', 1.4);
  }
  /* Bantlar: yalıtım (buzlu beyaz), koyu ara halka, vurgu şeridi. */
  for (const b of bands) {
    const y0 = (1 - b.to) * boy, y1 = (1 - b.from) * boy;
    if (b.kind === 'insulation') {
      g.fillStyle = '#e7e4dc'; g.fillRect(0, y0, size, y1 - y0);
      /* buz lekeleri: soğuk yüzeyde yoğuşma — seyrek, yumuşak */
      for (let i = 0; i < 260; i++) {
        const x = rnd() * size, y = y0 + rnd() * (y1 - y0), r = 3 + rnd() * 16;
        const grd = g.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, `rgba(255,255,255,${(0.10 + rnd() * 0.16).toFixed(3)})`);
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
      }
      yatayCizgi(g, y0, size, 'rgba(0,0,0,.22)', 3);
      yatayCizgi(g, y1, size, 'rgba(0,0,0,.22)', 3);
    } else if (b.kind === 'dark') {
      g.fillStyle = 'rgba(26,29,34,.88)'; g.fillRect(0, y0, size, y1 - y0);
    } else if (b.kind === 'accent') {
      g.fillStyle = b.color ?? '#c9a35c'; g.fillRect(0, y0, size, y1 - y0);
    }
  }
  /* Roll deseni: aracın DÖNÜŞÜNÜ uzaktan okutur (izleme kameraları için
     konur, süs değildir). Kuyruğa yakın dar bir kuşakta dama. */
  if (roll) {
    const y0 = boy * 0.74, h = boy * 0.055, n = 8;
    for (let i = 0; i < n; i++) {
      g.fillStyle = i % 2 ? '#1c1f24' : '#e8e5dd';
      g.fillRect(i * size / n, y0, size / n, h);
    }
    yatayCizgi(g, y0, size, 'rgba(0,0,0,.35)', 2);
    yatayCizgi(g, y0 + h, size, 'rgba(0,0,0,.35)', 2);
  }
  /* Kapak çerçeveleri ve uyarı etiketleri: küçük, seyrek, okunaksız —
     yakın planda "burada bir şey var" der, uzaktan gürültü yapmaz. */
  for (let i = 0; i < 14; i++) {
    const x = rnd() * size, y = boy * (0.08 + rnd() * 0.84);
    const w = 22 + rnd() * 44, h = 16 + rnd() * 26;
    g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 2;
    g.strokeRect(x, y, w, h);
    g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(x, y, w, h);
  }

  /* Pürüzlülük: kaynak ve bant kenarları daha mat, gövde saten. */
  const rc = tuval(size, boy), rg = rc.getContext('2d');
  rg.fillStyle = '#6e6e6e'; rg.fillRect(0, 0, size, boy);
  for (let i = 1; i < halka; i++) yatayCizgi(rg, i * boy / halka, size, 'rgba(255,255,255,.30)', 4);
  for (const b of bands) {
    if (b.kind !== 'insulation') continue;
    const y0 = (1 - b.to) * boy, y1 = (1 - b.from) * boy;
    rg.fillStyle = 'rgba(255,255,255,.34)'; rg.fillRect(0, y0, size, y1 - y0);
  }
  const map = doku(THREE, c), roughnessMap = doku(THREE, rc, { srgb: false });
  return { map, roughnessMap, dispose() { map.dispose(); roughnessMap.dispose(); } };
}

/** Katı yakıtlı iticinin yüzeyi: SEGMENT eklerinin halkaları (katı iticiler
    tek parça değil, segment segment üretilip sahada birleştirilir — Challenger
    kazasının O-ringi tam bu eklerdeydi), aft skirt koyu bandı ve nozul çevresi. */
export function srbSurface(THREE, { seed = 913, size = 512, boy = 1024, tone = '#cfcbc3', segments = 4 } = {}) {
  const c = tuval(size, boy), g = c.getContext('2d');
  const rnd = rng(seed);
  g.fillStyle = tone; g.fillRect(0, 0, size, boy);
  for (let i = 0; i < 32; i++) dikeyCizgi(g, (i + 0.5) * size / 32, size, boy, 'rgba(0,0,0,.045)', 1.3);
  /* SEGMENT EKLERİ: kalın, çift halkalı, cıvata deseniyle. */
  for (let i = 1; i < segments; i++) {
    const y = i * boy / segments;
    g.fillStyle = 'rgba(40,43,48,.55)'; g.fillRect(0, y - 9, size, 18);
    yatayCizgi(g, y - 9, size, 'rgba(0,0,0,.45)', 2.5);
    yatayCizgi(g, y + 9, size, 'rgba(0,0,0,.45)', 2.5);
    for (let k = 0; k < 40; k++) {                     // cıvata başları
      g.fillStyle = 'rgba(255,255,255,.22)';
      g.beginPath(); g.arc((k + 0.5) * size / 40, y, 2.6, 0, 6.2832); g.fill();
    }
  }
  /* Kuyruk eteği koyu bandı (nozul ısısı) + burun bandı. */
  g.fillStyle = 'rgba(38,36,34,.85)'; g.fillRect(0, boy * 0.90, size, boy * 0.10);
  g.fillStyle = 'rgba(201,163,92,.85)'; g.fillRect(0, boy * 0.055, size, boy * 0.018);
  for (let i = 0; i < 8; i++) {
    const x = rnd() * size, y = boy * (0.12 + rnd() * 0.7);
    g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 2;
    g.strokeRect(x, y, 18 + rnd() * 26, 12 + rnd() * 18);
  }
  const rc = tuval(size, boy), rg = rc.getContext('2d');
  rg.fillStyle = '#7a7a7a'; rg.fillRect(0, 0, size, boy);
  for (let i = 1; i < segments; i++) { rg.fillStyle = 'rgba(255,255,255,.35)'; rg.fillRect(0, i * boy / segments - 9, size, 18); }
  const map = doku(THREE, c), roughnessMap = doku(THREE, rc, { srgb: false });
  return { map, roughnessMap, dispose() { map.dispose(); roughnessMap.dispose(); } };
}
