/* assembly.mjs — MONTAJ GRAFİĞİ ve PATLATMA ÇÖZÜCÜSÜ (three'siz, saf).
 * docs/exploded-view-plan.md §3, §4, §8.
 *
 * Patlatılmış görünüm bir çizim efekti değil, bir MONTAJ MODELİDİR.
 * Bu dosya o modeli tutar ve üç.js görmez; böylece ekran görüntüsü
 * olmadan Node'da sınanabilir.
 *
 * Temel fark (mechanism_lab'in genelleştirilmesi): orada parçalar kapsamın
 * MERKEZİNDEN dışa itiliyordu. Burada referans ebeveyndir — parça,
 * bağlandığı yüzeyden çıkar. Montaj hiyerarşisi görüntüden okunur:
 * kök yerinde durur, yapraklar en uzağa gider.
 *
 * API: createAssembly(beyan) → { parts, root, explode(k), subtree, budget,
 *      interfaceCensus, integrationOrder, describe, depth, chain }
 */

export const IFACE_CLASSES = Object.freeze({
  civata: 'Cıvatalı arayüz (tork değerli)',
  kizak: 'Kızak/ray arayüzü (panel seviyesinde kayar, sonra kilitlenir)',
  ayirma: 'Ayırma arayüzü (kelepçe bandı ya da piroteknik)',
  akiskan: 'Akışkan arayüzü (kaynaklı boru, kesme valfi)',
  isil: 'Isıl arayüz (macun/gaz aralığı, ısı borusu gömme)',
  elektrik: 'Elektrik arayüzü (konnektör, kablaj demeti)',
  mentese: 'Menteşe + kilit (fırlatmada katlı, yörüngede açılır)',
  kaynak: 'Kaynaklı/yapıştırılmış birleşim (sökülmez)',
  basincli: 'Basınçlı geçiş (conta, kelepçe, hava sızdırmaz)',
});

export const MODES = Object.freeze(['assembly', 'axial', 'radial', 'layered']);

const V = (a = 0, b = 0, c = 0) => [a, b, c];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Yönü 26 kovadan birine yuvarlar (3×3×3 − 1). Çakışma çözümü bunu kullanır. */
export function directionBucket(dir) {
  const q = (v) => (v > 0.4 ? 1 : v < -0.4 ? -1 : 0);
  let b = [q(dir[0]), q(dir[1]), q(dir[2])];
  if (b[0] === 0 && b[1] === 0 && b[2] === 0) {
    /* hiçbir bileşen baskın değil: en büyüğüne yuvarla */
    const i = [Math.abs(dir[0]), Math.abs(dir[1]), Math.abs(dir[2])].indexOf(Math.max(Math.abs(dir[0]), Math.abs(dir[1]), Math.abs(dir[2])));
    b = [0, 0, 0]; b[i] = dir[i] >= 0 ? 1 : -1;
  }
  return b.join(',');
}

/** Eksen beyanını doğrular: üç sonlu sayı ve sıfır olmayan uzunluk. */
function eksenDogrula(a) {
  if (a == null) return [0, 0, 1];
  if (!Array.isArray(a) || a.length !== 3 || !a.every(Number.isFinite)) {
    throw new TypeError(`createAssembly: axis üç sayıdan oluşan bir dizi olmalı, gelen: ${JSON.stringify(a)}`);
  }
  if (len(a) < 1e-9) throw new RangeError('createAssembly: axis sıfır uzunlukta olamaz');
  return a;
}

/**
 * Montaj grafiğini kurar.
 *
 * beyan: { units, axis, parts:[...], steps:[...] }  (plan §3)
 * Zorunlu parça alanları: id, parent, iface, step, why.
 */
export function createAssembly(beyan) {
  /* Eksen SESSİZCE kabul edilmez. `axis: 'z'` gibi bir dizgi verildiğinde
     norm() NaN üretiyor ve `axial`/`layered` kipleri hiçbir parçayı
     kıpırdatmıyordu — hata görünmüyordu çünkü sıfır ötelenme de geçerli
     bir sonuç gibi duruyor (denetim yakaladı: 0/26 parça hareket etti).
     Sessiz yanlış yerine yüksek sesli hata. */
  const axis = norm(eksenDogrula(beyan.axis));
  const steps = beyan.steps || [];
  const ham = beyan.parts || [];
  if (!ham.length) throw new Error('assembly: parça listesi boş');

  const byId = new Map();
  for (const p of ham) {
    if (!p.id) throw new Error('assembly: kimliksiz parça');
    if (byId.has(p.id)) throw new Error(`assembly: kimlik iki kez: ${p.id}`);
    byId.set(p.id, p);
  }

  /* ── ağaç ──────────────────────────────────────────────────────────── */
  const cocuklar = new Map();
  let kok = null;
  for (const p of ham) {
    if (p.parent == null) { if (kok) throw new Error(`assembly: ikinci kök: ${p.id}`); kok = p; }
    else if (!byId.has(p.parent)) throw new Error(`assembly: '${p.id}' bulunmayan '${p.parent}' parçasına bağlı`);
    const k = p.parent ?? '__kok__';
    if (!cocuklar.has(k)) cocuklar.set(k, []);
    cocuklar.get(k).push(p);
  }
  if (!kok) throw new Error('assembly: kök yok (parent: null olan bir parça gerekir)');

  const derinlikCache = new Map();
  function depth(id) {
    if (derinlikCache.has(id)) return derinlikCache.get(id);
    let d = 0, p = byId.get(id), gorulen = new Set();
    while (p && p.parent != null) {
      if (gorulen.has(p.id)) throw new Error(`assembly: döngü: ${p.id}`);
      gorulen.add(p.id);
      p = byId.get(p.parent); d++;
      if (d > ham.length) throw new Error(`assembly: döngü (derinlik taştı): ${id}`);
    }
    derinlikCache.set(id, d);
    return d;
  }
  for (const p of ham) depth(p.id);                    // döngüyü kurulumda yakala

  function chain(id) {
    const z = [];
    let p = byId.get(id);
    while (p) { z.push(p); p = p.parent != null ? byId.get(p.parent) : null; }
    return z;
  }
  function subtree(id) {
    const out = [], yigin = [byId.get(id)];
    while (yigin.length) {
      const p = yigin.pop();
      if (!p) continue;
      out.push(p);
      for (const c of (cocuklar.get(p.id) || [])) yigin.push(c);
    }
    return out;
  }

  /* ── gabari ────────────────────────────────────────────────────────── */
  let kutu = { min: V(Infinity, Infinity, Infinity), max: V(-Infinity, -Infinity, -Infinity) };
  for (const p of ham) {
    const s = p.size || V(0.1, 0.1, 0.1), c = p.pos || V();
    for (let i = 0; i < 3; i++) {
      kutu.min[i] = Math.min(kutu.min[i], c[i] - s[i] / 2);
      kutu.max[i] = Math.max(kutu.max[i], c[i] + s[i] / 2);
    }
  }
  const gabari = len(sub(kutu.max, kutu.min)) || 1;

  /* ── AYRILMA DOĞRULTUSU (plan §4.1) ────────────────────────────────── */
  const yon = new Map();
  for (const p of ham) {
    let d = null, kaynak = '';
    if (p.dir && len(p.dir) > 1e-9) { d = norm(p.dir); kaynak = 'beyan'; }
    if (!d && p.ports && p.parent != null) {
      /* ebeveyne bakan arayüz noktasının normali — montajın tersi */
      const kapi = p.ports.find(q => q.tur === 'montaj' || q.parent === p.parent) || p.ports[0];
      if (kapi?.dir && len(kapi.dir) > 1e-9) { d = norm(mul(kapi.dir, -1)); kaynak = 'arayüz'; }
    }
    if (!d) {
      const ust = p.parent != null ? byId.get(p.parent) : null;
      const rel = sub(p.pos || V(), ust ? (ust.pos || V()) : V());
      if (len(rel) > gabari * 0.012) { d = norm(rel); kaynak = 'konum'; }
    }
    if (!d) { d = axis.slice(); kaynak = 'eksen'; }     // iç içe parça (tank ↔ tüp)
    yon.set(p.id, { dir: d, kaynak });
  }

  /* ── ÇAKIŞMA KOVALARI (plan §4.3) ──────────────────────────────────── */
  const kova = new Map();
  for (const p of ham) {
    const b = directionBucket(yon.get(p.id).dir);
    if (!kova.has(b)) kova.set(b, []);
    kova.get(b).push(p);
  }
  const TABAN = gabari * 0.10, KADEME = gabari * 0.11;

  /* Aynı doğrultuda giden parçalar için mesafe, YÖN ÜZERİNDEKİ İZDÜŞÜME
     göre paketlenir. Derinliğe göre paketlemek yanlıştı: derinde olan
     parça daha uzağa gidince önündeki sığ parçayı GEÇİYOR ve tam o anda
     içinden geçiyordu (denetim ölçtü: yakıt ile kapak k=0,5'te 16 mm'ye
     kadar yaklaşıyordu).

     Doğrusu: her parçanın yön üzerindeki başlangıç izdüşümü s alınır,
     istenen mesafe s + taban + derinlik·kademe olarak hesaplanır, sonra
     ileri geçişle sıralama korunur — bir parça kendinden öndekinin
     gerisinde kalamaz ve aralarında gabari payı bırakılır. Böylece
     hiçbir parça bir diğerini geçmez, patlatma boyunca sıra sabittir. */
  const mesafeMap = new Map();
  for (const [, liste] of kova) {
    const d = yon.get(liste[0].id).dir;
    const proj = (p) => dot(p.pos || V(), d);
    liste.sort((a, b) => (proj(a) - proj(b)) || (a.id < b.id ? -1 : 1));
    let oncekiHedef = -Infinity, oncekiYari = 0;
    for (const p of liste) {
      const s0 = proj(p);
      const yari = (p.size ? Math.max(...p.size) : gabari * 0.05) / 2;
      let hedef = s0 + TABAN + depth(p.id) * KADEME;
      const altSinir = oncekiHedef + (oncekiYari + yari) * 1.15;
      if (hedef < altSinir) hedef = altSinir;
      mesafeMap.set(p.id, hedef - s0);                  // yön boyunca öteleme
      oncekiHedef = hedef; oncekiYari = yari;
    }
  }

  /* ── KİP'e göre yer değiştirme ─────────────────────────────────────── */
  function offsetFor(p, k, mode) {
    if (k === 0) return V();
    /* KÖK YERİNDE DURUR. Montaj hiyerarşisi ancak sabit bir referansa
       göre okunur; kök de kayarsa bütün cisim ötelenir ve dahası kök,
       kendi çocuklarına yaklaşabilir (denetim bunu "en küçük mesafe
       monoton artmıyor" diye yakaladı). `radial` kipi mechanism_lab
       uyumluluğu içindir ve orada merkez kavramı farklıdır. */
    if (p.parent == null && mode !== 'radial') return V();
    const y = yon.get(p.id).dir;
    if (mode === 'axial') {
      const sira = (p.step ?? 1) - 1;
      return mul(axis, k * (TABAN + sira * KADEME * 1.6));
    }
    if (mode === 'radial') {
      const r = sub(p.pos || V(), V());
      const d = len(r) > 1e-6 ? norm(r) : axis;
      return mul(d, k * gabari * 0.55);
    }
    if (mode === 'layered') {
      const grup = p.group || 'yok';
      let h = 0; for (let i = 0; i < grup.length; i++) h = (h * 31 + grup.charCodeAt(i)) >>> 0;
      const kat = (h % 5) - 2;
      return mul(axis, k * kat * KADEME * 2.2);
    }
    /* assembly (varsayılan) */
    return mul(y, k * (mesafeMap.get(p.id) || TABAN));
  }

  /* ── bütçeler ──────────────────────────────────────────────────────── */
  const adet = p => p.qty ?? 1;
  const kutle = p => adet(p) * (p.massKg ?? 0);

  function budget() {
    const gruplar = {};
    let toplam = 0, tahminVar = false;
    for (const p of ham) {
      const m = kutle(p);
      if (p.wet) continue;                              // ıslak kütle (yakıt) ayrı
      toplam += m;
      if (p.tahmini) tahminVar = true;
      const g = p.group || 'yok';
      gruplar[g] = (gruplar[g] || 0) + m;
    }
    const islak = ham.filter(p => p.wet).reduce((a, p) => a + kutle(p), 0);
    return {
      kuruKg: Number(toplam.toFixed(2)),
      islakKg: Number(islak.toFixed(2)),
      toplamKg: Number((toplam + islak).toFixed(2)),
      tahmini: tahminVar,
      gruplar: Object.entries(gruplar).map(([g, kg]) => ({ grup: g, kg: Number(kg.toFixed(2)), pay: kg / (toplam || 1) }))
        .sort((a, b) => b.kg - a.kg),
      parca: ham.length, adet: ham.reduce((a, p) => a + adet(p), 0),
      derinlik: Math.max(...ham.map(p => depth(p.id))),
    };
  }

  function centerOfMass({ wet = true } = {}) {
    let M = 0, c = V();
    for (const p of ham) {
      if (!wet && p.wet) continue;
      const m = kutle(p);
      if (!(m > 0)) continue;
      M += m; c = add(c, mul(p.pos || V(), m));
    }
    if (!(M > 0)) return { x: 0, y: 0, z: 0, kg: 0, yanalMm: 0 };
    const k = mul(c, 1 / M);
    /* birincil eksene dik bileşen: fırlatıcı arayüzünün umursadığı şey */
    const boyuna = dot(k, axis);
    const yanal = len(sub(k, mul(axis, boyuna)));
    return { x: k[0], y: k[1], z: k[2], kg: Number(M.toFixed(2)), yanalMm: Number((yanal * 1000).toFixed(1)) };
  }

  /** Montaj karmaşıklığının okunur ölçüsü: hangi arayüzden kaç tane. */
  function interfaceCensus() {
    const say = {};
    for (const p of ham) {
      if (p.parent == null) continue;
      say[p.iface] = (say[p.iface] || 0) + adet(p);
    }
    return Object.entries(say).map(([k, n]) => ({ iface: k, ad: IFACE_CLASSES[k] || k, adet: n }))
      .sort((a, b) => b.adet - a.adet);
  }

  function integrationOrder() {
    const nolar = [...new Set(ham.map(p => p.step ?? 1))].sort((a, b) => a - b);
    return nolar.map(no => {
      const s = steps.find(x => x.no === no) || { no, ad: `Adım ${no}`, aciklama: '' };
      const parcalar = ham.filter(p => (p.step ?? 1) === no);
      return { ...s, parcalar, kg: Number(parcalar.reduce((a, p) => a + kutle(p), 0).toFixed(2)) };
    });
  }

  return {
    beyan, axis, steps, parts: ham, root: kok, gabari,
    byId: (id) => byId.get(id) || null,
    children: (id) => (cocuklar.get(id) || []).slice(),
    depth, chain, subtree,
    direction: (id) => yon.get(id),
    /** k=0 montajlı, k=1 tam ayrık. Dönen: id → [dx,dy,dz]. */
    explode(k, { mode = 'assembly' } = {}) {
      const out = new Map();
      for (const p of ham) out.set(p.id, offsetFor(p, k, mode));
      return out;
    },
    /** Tek parçanın ötelemesi. */
    offsetOf(id, k, mode = 'assembly') { return offsetFor(byId.get(id), k, mode); },
    budget, centerOfMass, interfaceCensus, integrationOrder,
    describe() {
      const b = budget(), c = centerOfMass();
      return {
        parca: b.parca, adet: b.adet, derinlik: b.derinlik, adim: integrationOrder().length,
        kuruKg: b.kuruKg, islakKg: b.islakKg, toplamKg: b.toplamKg, tahmini: b.tahmini,
        kutleMerkezi: [c.x, c.y, c.z].map(v => Number(v.toFixed(3))),
        eksendenSapmaMm: c.yanalMm,
        arayuzler: interfaceCensus(),
        gabari: Number(gabari.toFixed(3)),
      };
    },
  };
}

export { norm, len, sub, add, mul, dot };
