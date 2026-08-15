// aircraft-blocks.mjs — Parametrik hava aracı kütüphanesi (SAF kurucular).
//
// DONMUŞ SÖZLEŞME (references/scene-blocks.md) — craft-blocks ile AYNI:
//   • Her kurucu THREE.Group döndürür; bağlama YOK (mount / rAF / doku çekme yok).
//   • Eksenler: +X = ileri/uçuş yönü, −X = egzoz, +Z = yukarı, ±Y = kanat açıklığı.
//   • Orijin geometrik merkezde; en uzun boyut ≈ 1 × scale.
//   • palette = { body, panel, accent, metal } — craft-blocks ile AYNI anahtarlar,
//     AYNI varsayılan (obsidyen–şampanya), böylece bir sahnede uzay aracı ile
//     uçak yan yana durduğunda malzeme dili bozulmaz.
//   • Yalnızca MeshStandardMaterial; emissive yok, doku yok.
//
// Tüketiciler bu modülü GÖRELİ yolla import eder ve import başarısız olursa
// basit bir yer tutucu Group'a düşmek ZORUNDADIR.
//
// ── NEDEN BU KÜTÜPHANE "ŞEKİL ÇİZMİYOR" ──────────────────────────────────
// Kanatlar kutu değildir. Her kanat, GERÇEK bir NACA 4-haneli kesitin
// açıklık boyunca loft edilmesiyle üretilir; veter, süpürme, dihedral ve
// burulma istasyon tablosundan gelir. Bunun iki sonucu var:
//
//   1. Profil kesiti fizikseldir — aynı denklem, airfoil-flow presetinin
//      panel yöntemine verdiği geometrinin ta kendisi. Bir sahnede kanadı
//      kesip Cp dağılımını gösterebilirsiniz, çünkü kesit aynı kesittir.
//   2. Referans geometri ÖLÇÜLÜR, yazılmaz: kanat alanı S, açıklık b,
//      açıklık oranı AR = b²/S, sivrilme λ, çeyrek-veter süpürmesi Λ_c/4 ve
//      ortalama aerodinamik veter MAC, meshi üreten İSTASYON TABLOSUNDAN
//      integralle hesaplanır. userData.metrics içinde okunur.
//
// NACA 4-haneli kesit (Jacobs, Ward & Pinkerton 1933; NACA Report 460):
//
//   kalınlık:  y_t = 5t (0,2969√x − 0,1260x − 0,3516x² + 0,2843x³ − 0,1015x⁴)
//   kamburluk: x<p → y_c = (m/p²)(2px − x²)
//              x≥p → y_c = (m/(1−p)²)((1−2p) + 2px − x²)
//   yüzeyler:  θ = atan(dy_c/dx)
//              üst  (x − y_t sinθ,  y_c + y_t cosθ)
//              alt  (x + y_t sinθ,  y_c − y_t cosθ)
//
// Son katsayı literatürde −0,1015 (açık firar kenarı, orijinal) veya
// −0,1036 (kapalı firar kenarı) olarak geçer. Burada KAPALI kullanılır:
// kapalı olmayan bir firar kenarı katı modelde delik bırakır.
//
// ── DÜRÜSTLÜK NOTU ───────────────────────────────────────────────────────
// Bu araçlar ARKETİPTİR, belirli bir uçağın modeli DEĞİLDİR. Oranlar
// (AR, süpürme, sivrilme) ilgili sınıfın yayımlanmış tipik değerlerine
// yerleştirilmiştir; gövde ayrıntıları tasarım kararıdır. Hiçbir kurucu
// "bu şu uçaktır" demez ve demesin.

import * as THREE from 'three';

/* ================================================================== */
/* Palet ve malzeme dili                                              */
/* ================================================================== */

export const AIRCRAFT_PALETTE = Object.freeze({
  body:   0x23252c,   // gövde kaportası
  panel:  0x10151d,   // koyu yüzeyler: cam, giriş ağzı, nozul içi
  accent: 0xc9a35c,   // TEK vurgu: livre şeridi / sıcak hücum kenarı
  metal:  0x9aa0ab,   // çıplak metal: nasel dudağı, nozul, iniş takımı
});

// Çerçeve/ikincil ton, panel renginden TÜRETİLİR (tek doğruluk kaynağı) —
// palet yerinde güncellenirken de aynı fonksiyon çağrılır.
function cerceveRengi(panel) {
  return new THREE.Color(panel).lerp(new THREE.Color(0xffffff), 0.34);
}

const MALZEME_KAYDI = new WeakMap();

function makeMats(palette) {
  const p = { ...AIRCRAFT_PALETTE, ...(palette || {}) };
  const frame = cerceveRengi(p.panel);
  return {
    body:    new THREE.MeshStandardMaterial({ color: p.body,  roughness: 0.44, metalness: 0.28 }),
    wing:    new THREE.MeshStandardMaterial({ color: p.body,  roughness: 0.38, metalness: 0.34 }),
    // Kanat alt yüzü biraz daha koyu değil — TEK renk; ayrım ışıkla gelir.
    panel:   new THREE.MeshStandardMaterial({ color: p.panel, roughness: 0.30, metalness: 0.50 }),
    glass:   new THREE.MeshStandardMaterial({ color: p.panel, roughness: 0.12, metalness: 0.72 }),
    frame:   new THREE.MeshStandardMaterial({ color: frame,   roughness: 0.46, metalness: 0.40 }),
    metal:   new THREE.MeshStandardMaterial({ color: p.metal, roughness: 0.26, metalness: 0.86 }),
    metalDS: new THREE.MeshStandardMaterial({ color: p.metal, roughness: 0.26, metalness: 0.86, side: THREE.DoubleSide }),
    bodyDS:  new THREE.MeshStandardMaterial({ color: p.body,  roughness: 0.44, metalness: 0.28, side: THREE.DoubleSide }),
    accent:  new THREE.MeshStandardMaterial({ color: p.accent, roughness: 0.30, metalness: 0.66 }),
    dark:    new THREE.MeshStandardMaterial({ color: 0x07090c, roughness: 0.62, metalness: 0.22, side: THREE.DoubleSide }),
  };
}

//   applyAircraftPalette(root, { body, panel, accent, metal }) → boolean
// Görünür araç YENİDEN KURULMAZ (webgl-scene-contract §2): yalnız malzeme
// renkleri yerinde tazelenir.
export function applyAircraftPalette(root, palette) {
  const m = MALZEME_KAYDI.get(root);
  if (!m) return false;
  const p = { ...AIRCRAFT_PALETTE, ...(palette || {}) };
  m.body.color.set(p.body);
  m.bodyDS.color.set(p.body);
  m.wing.color.set(p.body);
  m.panel.color.set(p.panel);
  m.glass.color.set(p.panel);
  m.frame.color.copy(cerceveRengi(p.panel));   // TÜRETİLMİŞ
  m.metal.color.set(p.metal);
  m.metalDS.color.set(p.metal);
  m.accent.color.set(p.accent);
  return true;
}

/* ================================================================== */
/* 1) NACA 4-haneli kesit                                             */
/* ================================================================== */

// Kamburluk çizgisi ve eğimi. m = maksimum kamburluk (veter oranı),
// p = konumu (veter oranı). m=0 → simetrik profil.
function camberLine(x, m, p) {
  if (m === 0 || p === 0) return [0, 0];
  if (x < p) {
    return [(m / (p * p)) * (2 * p * x - x * x),
            (2 * m / (p * p)) * (p - x)];
  }
  const q = (1 - p) * (1 - p);
  return [(m / q) * ((1 - 2 * p) + 2 * p * x - x * x),
          (2 * m / q) * (p - x)];
}

// Yarı kalınlık dağılımı (kapalı firar kenarı katsayısı −0,1036).
function halfThickness(x, t) {
  return 5 * t * (0.2969 * Math.sqrt(x) - 0.1260 * x
                - 0.3516 * x * x + 0.2843 * x * x * x - 0.1036 * x * x * x * x);
}

/**
 * NACA 4-haneli kesit koordinatları.
 * @param code  '2412' gibi dizge ya da { m, p, t } (oran olarak).
 * @param nHalf Bir yüzeydeki nokta sayısı (toplam 2·nHalf+1 döner).
 * @returns [[x, z], …] — TE üst → LE → TE alt sırasıyla, veterle normalize.
 *          x: 0 = hücum kenarı, 1 = firar kenarı. z: yukarı pozitif.
 *
 * Kosinüs aralığı kullanılır: x = (1 − cos β)/2. Hücum kenarındaki eğrilik
 * yüksek olduğu için düzgün aralık orayı köşeli gösterir — panel yöntemi de
 * aynı aralığı kullanır, bu tesadüf değil.
 */
export function nacaSection(code, nHalf = 40) {
  let m, p, t;
  if (typeof code === 'string') {
    m = parseInt(code[0], 10) / 100;
    p = parseInt(code[1], 10) / 10;
    t = parseInt(code.slice(2), 10) / 100;
  } else {
    ({ m = 0, p = 0.4, t = 0.12 } = code || {});
  }
  const up = [], dn = [];
  for (let i = 0; i <= nHalf; i++) {
    const beta = (Math.PI * i) / nHalf;
    const x = 0.5 * (1 - Math.cos(beta));         // 0 → 1, LE'de sık
    const yt = halfThickness(x, t);
    const [yc, dyc] = camberLine(x, m, p);
    const th = Math.atan(dyc);
    const s = Math.sin(th), c = Math.cos(th);
    up.push([x - yt * s, yc + yt * c]);
    dn.push([x + yt * s, yc - yt * c]);
  }
  // TE üst → LE → TE alt. LE (index nHalf) bir kez yazılır.
  const pts = [];
  for (let i = nHalf; i >= 0; i--) pts.push(up[i]);
  for (let i = 1; i <= nHalf; i++) pts.push(dn[i]);
  return pts;
}

/* ================================================================== */
/* 2) Kanat loftu — istasyon tablosundan yüzey                        */
/* ================================================================== */
//
// İstasyon: { y, xqc, zqc, chord, twist, naca }
//   y     : açıklık koordinatı (kök 0)
//   xqc   : ÇEYREK VETER noktasının x'i (büyük = ileri). Süpürme bu çizgiden
//           gelir — Λ_c/4 tanımının kendisi budur, sonradan hesap yok.
//   zqc   : çeyrek veterin yüksekliği (dihedral bundan çıkar)
//   chord : veter uzunluğu
//   twist : derece, POZİTİF = hücum kenarı yukarı (washin). Uç istasyonlarda
//           negatif (washout) verilir: uç önce stall'a girmesin diye gerçek
//           uçaklarda yapılan şey budur.
//   naca  : kesit ('2412' ya da {m,p,t})

// Kapalı meshin işaretli hacmi — negatifse sarım ters demektir.
function signedVolume(pos, idx) {
  let v = 0;
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
    const ax = pos[a], ay = pos[a + 1], az = pos[a + 2];
    const bx = pos[b], by = pos[b + 1], bz = pos[b + 2];
    const cx = pos[c], cy = pos[c + 1], cz = pos[c + 2];
    v += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
  }
  return v / 6;
}

// Sarımı hacim işaretinden düzelt: dışa dönük normaller garanti edilir.
// (Elle sarım tutturmak, süpürme/dihedral işareti değiştiğinde sessizce
// bozulur; hacim testi ise geometrinin kendisine sorar.)
function finalizeGeo(pos, idx) {
  if (signedVolume(pos, idx) < 0) {
    for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Bir istasyonun 3B nokta bulutu.
function stationPoints(st, profileCache) {
  const key = typeof st.naca === 'string' ? st.naca : JSON.stringify(st.naca);
  let prof = profileCache.get(key);
  if (!prof) { prof = nacaSection(st.naca, 26); profileCache.set(key, prof); }
  const tw = ((st.twist || 0) * Math.PI) / 180;
  const ct = Math.cos(tw), stw = Math.sin(tw);
  const out = [];
  for (const [xc, zc] of prof) {
    // Çeyrek vetere göre yerel ofset. +X ileri olduğu için veter yönü TERS:
    // hücum kenarı (xc=0) en ileride kalmalı.
    const dx = -(xc - 0.25) * st.chord;
    const dz = zc * st.chord;
    // Burulma: +X'i +Z'ye taşıyan dönme → hücum kenarı yukarı.
    out.push([st.xqc + dx * ct - dz * stw, st.y, st.zqc + dx * stw + dz * ct]);
  }
  return out;
}

// Ucu/kökü kapatan üçgen yelpazesi (merkez ekseni eklenir).
function capFan(pos, idx, ring, flip) {
  const n = ring.length;
  let cx = 0, cy = 0, cz = 0;
  for (const i of ring) { cx += pos[i * 3]; cy += pos[i * 3 + 1]; cz += pos[i * 3 + 2]; }
  const ci = pos.length / 3;
  pos.push(cx / n, cy / n, cz / n);
  for (let j = 0; j < n - 1; j++) {
    if (flip) idx.push(ci, ring[j + 1], ring[j]);
    else idx.push(ci, ring[j], ring[j + 1]);
  }
}

/**
 * Kanat/kuyruk yüzeyi. sections KÖKTEN UCA sıralı verilir.
 * @param opts.mirror  true → −Y tarafı aynalanır (tam kanat), false → tek yüzey (dikey stabilize)
 * @returns { mesh, metrics }
 */
function loftWing(sections, mat, { mirror = true, refPanel = null } = {}) {
  const cache = new Map();
  let list = sections;
  if (mirror) {
    const left = [];
    for (let i = sections.length - 1; i >= (sections[0].y === 0 ? 1 : 0); i--) {
      left.push({ ...sections[i], y: -sections[i].y });
    }
    list = left.concat(sections);
  }
  const pos = [], idx = [];
  const rings = [];
  for (const st of list) {
    const ring = [];
    for (const p of stationPoints(st, cache)) { ring.push(pos.length / 3); pos.push(p[0], p[1], p[2]); }
    rings.push(ring);
  }
  const N = rings[0].length;
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < N - 1; j++) {
      const a = rings[i][j], b = rings[i][j + 1], c = rings[i + 1][j], d = rings[i + 1][j + 1];
      idx.push(a, b, c, b, d, c);
    }
  }
  capFan(pos, idx, rings[0], false);
  capFan(pos, idx, rings[rings.length - 1], true);
  const mesh = new THREE.Mesh(finalizeGeo(pos, idx), mat);
  return { mesh, metrics: wingMetrics(sections, mirror, refPanel) };
}

/**
 * Referans geometri — meshi üreten İSTASYON TABLOSUNDAN integralle.
 *
 *   S    = 2 ∫ c dy            (yamuk kuralı; izdüşüm alanı, dihedral sayılmaz)
 *   b    = 2 y_uç              (izdüşüm açıklığı — AR ile tutarlı olsun diye)
 *   AR   = b² / S
 *   MAC  = (2/S) ∫ c² dy
 *   λ    = c_uç / c_kök
 *   Λ_c/4= atan((xqc_kök − xqc_uç) / (y_uç − y_kök))     (+ = geriye süpürme)
 *   Λ_LE = aynı, hücum kenarı çizgisinden (xqc + 0,25c)
 *   Γ    = atan(Δzqc/Δy) — ana panelin dihedrali
 */
function wingMetrics(sections, mirror, refPanel) {
  const k = mirror ? 2 : 1;                    // tek yüzeyse (fin) yarım sayılmaz
  let S = 0, I2 = 0;
  for (let i = 0; i < sections.length - 1; i++) {
    const a = sections[i], b = sections[i + 1];
    const dy = b.y - a.y;
    S += 0.5 * (a.chord + b.chord) * dy;
    I2 += 0.5 * (a.chord * a.chord + b.chord * b.chord) * dy;
  }
  S *= k; I2 *= k;
  const root = sections[0], tip = sections[sections.length - 1];
  const n = sections.length;
  const b = k * (tip.y - root.y);
  const dy = tip.y - root.y;
  const deg = (r) => (r * 180) / Math.PI;
  const le = (s) => s.xqc + 0.25 * s.chord;
  const te = (s) => s.xqc - 0.75 * s.chord;

  // Panel panel hücum kenarı süpürmesi. OJİV bir kanatta (delta) tek bir
  // "süpürme açısı" YOKTUR — kökte 75°, uçta 55° olabilir. Kök→uç ortalaması
  // bunu gizler, bu yüzden panel dizisi de raporlanır.
  const sweepLEPanels = [];
  for (let i = 0; i < n - 1; i++) {
    const a = sections[i], c = sections[i + 1];
    if (c.y - a.y > 1e-6) sweepLEPanels.push(deg(Math.atan2(le(a) - le(c), c.y - a.y)));
  }

  // REFERANS TRAPEZ — YALNIZ kurucu bildirirse hesaplanır.
  //
  // Havacılıkta yayımlanan S_ref/AR çoğu zaman ölçülen planformun kendisi
  // değildir: ANA PANELİN hücum ve firar kenarı çizgileri gövde merkezine
  // uzatılır, oluşan trapez referans alınır. Bir savaş uçağında kök uzantısı
  // (LERX) ölçülen alanı şişirir ama referans trapeze girmez — iki sayının
  // farkı doğrudan LERX alanıdır.
  //
  // Ama bu hesap HER kanatta anlamlı DEĞİLDİR: firar kenarı "W" yapan bir
  // uçan kanatta ya da uç yuvarlaması küçük bir panel olan bir planörde,
  // rastgele bir paneli merkeze uzatmak uydurma bir sayı üretir (denendi:
  // planörde AR_ref 19,5 çıkıyordu, gerçek AR 31,3 iken). Bu yüzden hangi
  // iki istasyonun ana paneli tanımladığını KURUCU bildirir; bildirmezse
  // alan null kalır ve arayüz "—" yazar. Uydurma sayı üretmekten iyidir.
  let areaRef = null, aspectRatioRef = null, taperRef = null;
  if (refPanel) {
    const p1 = sections[refPanel[0]], p2 = sections[refPanel[1]];
    const pdy = p2.y - p1.y || 1e-9;
    const leSlope = (le(p2) - le(p1)) / pdy, teSlope = (te(p2) - te(p1)) / pdy;
    const cRefRoot = (le(p1) - leSlope * p1.y) - (te(p1) - teSlope * p1.y);
    const cRefTip = le(p1) + leSlope * (tip.y - p1.y) - (te(p1) + teSlope * (tip.y - p1.y));
    areaRef = k * 0.5 * (cRefRoot + cRefTip) * tip.y;
    aspectRatioRef = (b * b) / areaRef;
    taperRef = cRefTip / cRefRoot;
  }

  return {
    span: b,
    area: S,
    aspectRatio: (b * b) / S,
    areaRef,
    aspectRatioRef,
    mac: I2 / S,
    taper: tip.chord / root.chord,
    taperRef,
    sweepQC: deg(Math.atan2(root.xqc - tip.xqc, dy)),
    sweepLE: deg(Math.atan2(le(root) - le(tip), dy)),
    sweepLEPanels,
    sweepLEOuter: sweepLEPanels[sweepLEPanels.length - 1],
    dihedral: deg(Math.atan2(tip.zqc - root.zqc, dy)),
    twistTip: tip.twist || 0,
    rootChord: root.chord,
    tipChord: tip.chord,
    // Metrikleri ÜRETEN tablo. Sahneler kanadı istedikleri açıklık
    // istasyonunda kesip kesiti çizebilsin diye açık bırakılır — çizilen
    // kesit ile meshin kesiti aynı kaynaktan gelir, ayrışamaz.
    stations: sections.map((s) => ({
      y: s.y, xqc: s.xqc, zqc: s.zqc, chord: s.chord, twist: s.twist || 0, naca: s.naca,
    })),
  };
}

/* ================================================================== */
/* 3) Gövde loftu — süperelips kesitler                               */
/* ================================================================== */
//
// Kesit: |y/ry|^n + |z/rz|^n = 1
//   n = 2   → elips (yolcu uçağı gövdesi, basınçlı tüp)
//   n > 2   → köşeleşir (kutu benzeri)
//   n < 2   → SİVRİLİR — n≈1,3'te yanal keskin "chine" çıkar; savaş uçağı
//             ön gövdesinin ve waverider'ın alt yüzeyinin karakteri budur.
// Üst ve alt için AYRI üs verilebilir: waverider'da üst yuvarlak (n=2,3),
// alt neredeyse düz (n=6) — sıkıştırma yüzeyi.

function superPoint(t, ry, rz, nUp, nDn) {
  const ct = Math.cos(t), stt = Math.sin(t);
  const n = stt >= 0 ? nUp : nDn;
  const e = 2 / n;
  const y = ry * Math.sign(ct) * Math.pow(Math.abs(ct), e);
  const z = rz * Math.sign(stt) * Math.pow(Math.abs(stt), e);
  return [y, z];
}

// İstasyon: { x, ry, rz, dz=0, nUp=2, nDn=2 }
function loftBody(stations, mat, { nAround = 28 } = {}) {
  const pos = [], idx = [], rings = [];
  for (const st of stations) {
    const ring = [];
    const degenerate = st.ry < 1e-5 && st.rz < 1e-5;
    if (degenerate) {                      // burun/kuyruk ucu: tek nokta
      const i0 = pos.length / 3;
      pos.push(st.x, 0, st.dz || 0);
      for (let j = 0; j < nAround; j++) ring.push(i0);
    } else {
      for (let j = 0; j < nAround; j++) {
        const t = (2 * Math.PI * j) / nAround;
        const [y, z] = superPoint(t, st.ry, st.rz, st.nUp ?? 2, st.nDn ?? st.nUp ?? 2);
        ring.push(pos.length / 3);
        pos.push(st.x, y, z + (st.dz || 0));
      }
    }
    ring.push(ring[0]);                    // halkayı kapat
    rings.push(ring);
  }
  const N = rings[0].length;
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < N - 1; j++) {
      const a = rings[i][j], b = rings[i][j + 1], c = rings[i + 1][j], d = rings[i + 1][j + 1];
      if (a !== b) idx.push(a, b, c);
      if (c !== d) idx.push(b, d, c);
    }
  }
  const first = rings[0], last = rings[rings.length - 1];
  if (first[0] !== first[1]) capFan(pos, idx, first, false);
  if (last[0] !== last[1]) capFan(pos, idx, last, true);
  return new THREE.Mesh(finalizeGeo(pos, idx), mat);
}

/* ================================================================== */
/* 4) Ortak parçalar                                                  */
/* ================================================================== */

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);


/* ================================================================== */
/* EKSEN YARDIMCILARI — çeviriyi TEK YERE hapseder                    */
/* ================================================================== */
//
// three.js'te CylinderGeometry, LatheGeometry ve ConeGeometry'nin ekseni
// HER ZAMAN +Y'dir. Blok sözleşmesi ise "+X ileri, +Z yukarı" der. Bu
// çeviriyi her çağrı yerinde elle yazmak tek bir oturumda BEŞ ayrı hataya
// yol açtı (uçak kuyrukları, Starship burnu, helikopter mili, sonda çanağı,
// gezgin tekerlekleri) ve hepsini kullanıcı ekran görüntüsüyle buldu.
//
// Kural: çıplak `new THREE.CylinderGeometry/LatheGeometry/ConeGeometry`
// KULLANILMAZ; aşağıdaki adlandırılmış yardımcılar kullanılır. Adında hangi
// eksen yazıyorsa geometrinin ekseni odur — okuyanın işaret hesabı yapması
// gerekmez. `scripts/eksen-denetimi.py` kuralı denetler.
//
// Kontroller:  R_z(−90°)·(0,1,0) = (1,0,0)   ⇒ eksenX
//              R_x(+90°)·(0,1,0) = (0,0,1)   ⇒ eksenZ

const eksenX = (geo) => { geo.rotateZ(-Math.PI / 2); return geo; };   // +Y → +X
const eksenY = (geo) => geo;                                          // +Y (dokunma)
const eksenZ = (geo) => { geo.rotateX(Math.PI / 2); return geo; };    // +Y → +Z

/* Silindir — ilk yarıçap eksenin POZİTİF ucundadır. */
function cylY(rPoz, rNeg, h, seg, mat, open = false) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rPoz, rNeg, h, seg, 1, open), mat);
}
function cylZ(rPoz, rNeg, h, seg, mat, open = false) {
  return new THREE.Mesh(eksenZ(new THREE.CylinderGeometry(rPoz, rNeg, h, seg, 1, open)), mat);
}
/* Koni — tepe eksenin POZİTİF ucunda. */
function coneZ(r, h, seg, mat, open = false) {
  return new THREE.Mesh(eksenZ(new THREE.ConeGeometry(r, h, seg, 1, open)), mat);
}
function coneX(r, h, seg, mat, open = false) {
  return new THREE.Mesh(eksenX(new THREE.ConeGeometry(r, h, seg, 1, open)), mat);
}

/**
 * Lathe — İKİNCİ tuzağı da kapatır.
 *
 * Lathe normalleri profilin SIRASINA bağlıdır: y azalarak giden bir profil,
 * normalleri İÇE bakan bir yüzey üretir ve yüzey ters aydınlanır. Nasel
 * kaportası, Starship burnu ve sonda çanağı tam bu yüzden siyah çıkmıştı;
 * üçünde de palet açık renkti ama yüzey kendi gölgesindeydi.
 *
 * Burada artık imkânsız: sıra kontrol edilir, gerekirse ÇEVRİLİR. Çağıran
 * profili hangi sırada verdiğini düşünmek zorunda değil.
 */
function latheZ(noktalar, seg, mat) {
  const p = noktalar.slice();
  if (p.length > 1 && p[p.length - 1].y < p[0].y) p.reverse();
  return new THREE.Mesh(eksenZ(new THREE.LatheGeometry(p, seg)), mat);
}
function latheX(noktalar, seg, mat) {
  const p = noktalar.slice();
  if (p.length > 1 && p[p.length - 1].y < p[0].y) p.reverse();
  return new THREE.Mesh(eksenX(new THREE.LatheGeometry(p, seg)), mat);
}

function alignX(geo) { geo.rotateZ(-Math.PI / 2); return geo; }
function cylX(rTop, rBottom, h, seg, mat, open = false) {
  return new THREE.Mesh(alignX(new THREE.CylinderGeometry(rTop, rBottom, h, seg, 1, open)), mat);
}
function box(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }

/**
 * Turbofan naseli — yalnız boru değil: yuvarlatılmış GİRİŞ DUDAĞI (ses altı
 * girişte akım kopmasını önleyen kalın dudak), şişkin fan kaportası, daralan
 * baypas nozulu, koyu fan yüzü ve sıcak çekirdek konisi.
 * Yüksek baypas oranı büyük fan çapı demektir; bu yüzden çap/uzunluk ≈ 0,55.
 */
function turbofan(m, { r = 0.1, len = 0.34, blades = 20 } = {}) {
  const g = new THREE.Group();
  const seg = 30;
  // Kaporta profili: LatheGeometry ile dış hat (dudak yuvarlak, kıç daralan).
  const outer = [];
  const K = 22;
  for (let i = 0; i <= K; i++) {
    const u = i / K;
    // dudak: 0–0,12'de hızlı açılım; gövde: 0,12–0,62 hafif şişkin; kıç: daralma
    let rr;
    if (u < 0.12) rr = r * (0.82 + 0.18 * Math.sin((u / 0.12) * Math.PI * 0.5));
    else if (u < 0.62) rr = r * (1.0 + 0.045 * Math.sin(((u - 0.12) / 0.5) * Math.PI));
    else rr = r * (1.0 - 0.30 * Math.pow((u - 0.62) / 0.38, 1.5));
    outer.push(new THREE.Vector2(rr, -len * u));
  }
  outer.reverse();
  // LatheGeometry normalleri profilin YÖNÜNE bağlıdır: y azalarak giden bir
  // profil, normalleri İÇE bakan bir yüzey üretir. DoubleSide olduğu için
  // yüzey görünür ama ters normalle aydınlanır — kaporta, palet açık renk
  // olsa bile SİYAH bir kütle gibi çıkıyordu. Profil y artacak biçimde
  // sıralanır.
  // Nasel kaportası BOYALIDIR (çıplak metal değil): metalness 0,86'lık bir
  // yüzey karanlık ortamda yansıtacak bir şey bulamayıp siyah okunuyordu.
  const cowl = new THREE.Mesh(new THREE.LatheGeometry(outer, seg), m.bodyDS);
  cowl.geometry.rotateZ(-Math.PI / 2);          // eksen −Y → −X
  cowl.position.x = len * 0.5;
  g.add(cowl);
  // Giriş dudağının iç yüzü + kanal karanlığı (fanın ARKASI).
  const lip = cylX(r * 0.82, r * 0.72, 0.055, seg, m.metalDS, true);
  lip.position.x = len * 0.5 - 0.027;
  g.add(lip);
  const kanal = cylX(r * 0.72, r * 0.70, 0.20, seg, m.dark, true);
  kanal.position.x = len * 0.5 - 0.17;
  g.add(kanal);

  // ── FAN: gerçek kanatçıklar ────────────────────────────────────────
  const fan = fanRotoru(m, { rHub: r * 0.19, rTip: r * 0.71, blades });
  fan.position.x = len * 0.5 - 0.055;
  fan.name = 'fan';
  g.add(fan);

  // ── OGV (çıkış yönlendirici kanatları) ─────────────────────────────
  // Fanın arkasındaki SABİT kanat sırası. Görevi fanın verdiği dönmeyi
  // (swirl) söküp akımı eksene paralel hâle getirmek — dönen akım itki
  // üretmez, yalnız kayıp üretir. Bu yüzden statörler düzdür ve sayıları
  // fan kanatçığı sayısıyla ORTAK BÖLEN vermeyecek biçimde seçilir
  // (rezonans ve sirene benzeyen ton oluşmasın diye).
  const ogv = new THREE.Group();
  const ogvGeo = new THREE.BoxGeometry(0.035, 0.004, r * 0.48);
  for (let i = 0; i < 29; i++) {
    const v = new THREE.Mesh(ogvGeo, m.metal);
    v.position.set(0, 0, r * 0.47);
    const kol = new THREE.Group();
    kol.add(v);
    kol.rotation.x = (i * 2 * Math.PI) / 29;
    ogv.add(kol);
  }
  ogv.position.x = len * 0.5 - 0.135;
  g.add(ogv);

  // ── Çekirdek nozulu ve sıcak koni ──────────────────────────────────
  const core = cylX(r * 0.44, r * 0.40, 0.10, seg, m.metal);
  core.position.x = -len * 0.42;
  g.add(core);
  const plug = cylX(r * 0.06, r * 0.38, 0.12, seg, m.dark);
  plug.position.x = -len * 0.52;
  g.add(plug);

  g.userData.fan = fan;              // sahneler döndürebilsin diye
  return g;
}

/**
 * Fan rotoru — burulmalı kanatçıklar + spiralli spinner.
 *
 * NEDEN BURULMA: kanatçığın yerel hücum açısı, eksenel hava hızı ile
 * ÇEVRESEL hızın (Ωr) bileşkesine göredir. Ω sabit olduğu için çevresel hız
 * yarıçapla DOĞRUSAL büyür: kökte hava kanatçığa neredeyse eksenden gelir,
 * uçta ise neredeyse teğetten. Aynı hücum açısını her yarıçapta tutturmak
 * için kanatçık kökten uca ~40° burkulmak zorundadır. Düz bir kanatçık
 * kökte stall'da, uçta boşta çalışırdı.
 *
 * Kanatçık, kanat loft'unun ta kendisiyle kurulur: açıklık = yarıçap yönü,
 * veter = eksen yönü, istasyon tablosunda burulma. Tek geometri üretilip
 * bütün kanatçıklarda PAYLAŞILIR (N mesh, 1 tampon).
 */
function fanRotoru(m, { rHub = 0.02, rTip = 0.075, blades = 20 } = {}) {
  const g = new THREE.Group();
  const c = rTip * 0.72;                       // kök veteri (geniş veterli fan)
  const kanatcik = loftWing([
    { y: rHub,                       xqc: 0.000, zqc: 0, chord: c * 0.86, twist:  58, naca: { m: 0.02, p: 0.5, t: 0.10 } },
    { y: rHub + (rTip - rHub) * 0.35, xqc: -0.008, zqc: 0, chord: c * 1.02, twist:  40, naca: { m: 0.02, p: 0.5, t: 0.075 } },
    { y: rHub + (rTip - rHub) * 0.72, xqc: -0.020, zqc: 0, chord: c * 0.98, twist:  25, naca: { m: 0.015, p: 0.5, t: 0.055 } },
    { y: rTip,                       xqc: -0.034, zqc: 0, chord: c * 0.80, twist:  16, naca: { m: 0.01, p: 0.5, t: 0.042 } },
  ], m.metal, { mirror: false });

  for (let i = 0; i < blades; i++) {
    const b = new THREE.Mesh(kanatcik.mesh.geometry, m.metal);   // geometri PAYLAŞILIR
    const kol = new THREE.Group();
    kol.add(b);
    kol.rotation.x = (i * 2 * Math.PI) / blades;
    g.add(kol);
  }

  // Spinner: koni + üstünde spiral şerit. Spiral süs değil — yerdeyken
  // motorun döndüğünü uzaktan gösteren emniyet işaretidir.
  const spin = new THREE.Mesh(new THREE.ConeGeometry(rHub * 1.05, rHub * 2.6, 20), m.frame);
  spin.rotation.z = -Math.PI / 2;
  spin.position.x = rHub * 1.3;
  g.add(spin);
  const spiral = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const rr = rHub * 1.05 * (1 - t) + 0.0008;
    const a = t * Math.PI * 1.6;
    spiral.push(new THREE.Vector3(rHub * 2.6 * t, rr * Math.cos(a), rr * Math.sin(a)));
  }
  const sp = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(spiral), 40, rHub * 0.09, 6, false), m.dark);
  g.add(sp);
  return g;
}

// Pilon: nasel ile kanadı bağlayan ince, süpürülmüş kesitli kiriş.
function pylon(m, { len = 0.22, h = 0.09, th = 0.028 } = {}) {
  const p = box(len, th, h, m.body);
  return p;
}

// Kanopi/cam: gövdeye oturan yassı yarım kubbe (küre dilimi ölçeklenmiş).
function canopy(m, { len = 0.2, wid = 0.07, hgt = 0.045 } = {}) {
  const s = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), m.glass);
  s.scale.set(len, wid, hgt);
  return s;
}

// Kabin pencere şeridi: gövde boyunca ince koyu bant (tek tek pencere DEĞİL —
// bu ölçekte tek tek pencere gren gibi görünür, webgl-scene-contract §5).
function windowBand(m, { x0, x1, r, z = 0.32, w = 0.012 }) {
  const g = new THREE.Group();
  for (const side of [1, -1]) {
    const len = x1 - x0;
    const b = box(len, 0.004, w, m.panel);
    const ang = Math.asin(Math.min(0.98, z));
    b.position.set((x0 + x1) / 2, side * r * Math.cos(ang) * 0.99, r * z);
    b.rotation.x = side * -ang * 0.6;
    g.add(b);
  }
  return g;
}

// İniş takımı bacağı + tekerlek (yalnız istenirse; varsayılan kapalı).
function gearLeg(m, { x, y, zTop, len, wheelR = 0.022 }) {
  const g = new THREE.Group();
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, len, 10), m.metal);
  leg.position.set(x, y, zTop - len / 2);
  leg.rotation.x = Math.PI / 2;
  g.add(leg);
  const w = new THREE.Mesh(new THREE.TorusGeometry(wheelR, 0.010, 8, 18), m.dark);
  w.position.set(x, y, zTop - len);
  g.add(w);
  return g;
}

/* ================================================================== */
/* 5) finalize — normalize + ölçüm kaydı                              */
/* ================================================================== */

function finalize(g, kind, scale, m, metrics, notes) {
  const inner = new THREE.Group();
  while (g.children.length) inner.add(g.children[0]);
  inner.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  const bb = new THREE.Box3().setFromObject(inner);
  const size = bb.getSize(new THREE.Vector3());
  const center = bb.getCenter(new THREE.Vector3());
  const longest = Math.max(size.x, size.y, size.z) || 1;
  const s = scale / longest;
  inner.scale.setScalar(s);
  inner.position.copy(center).multiplyScalar(-s);

  const root = new THREE.Group();
  root.name = `aircraft:${kind}`;
  root.add(inner);
  let parts = 0;
  inner.traverse((o) => { if (o.isMesh) parts++; });

  // metrics TASARIM birimindedir; AR / λ / süpürme ölçekten bağımsızdır.
  // spanModel: normalize edilmiş modelde açıklık — uç vorteksi, kanat ucu
  // ışığı gibi şeyleri TAM uca koymak isteyen sahneler bunu kullanır.
  root.userData = {
    preset: 'aircraft-blocks', kind, parts,
    designSize: size.toArray(),
    modelScale: s,
    metrics: metrics ? { ...metrics, spanModel: metrics.span * s } : null,
    notes: notes || null,
  };
  if (m) MALZEME_KAYDI.set(root, m);
  return root;
}

/* ================================================================== */
/* ARAÇ 1 — YOLCU UÇAĞI (ses altı ulaşım, M ≈ 0,78–0,85)              */
/* ================================================================== */
//
// Sınıf oranları: AR ≈ 9,4 · Λ_c/4 ≈ 32° · λ ≈ 0,20 · dihedral ≈ 5,5°.
// Neden bu değerler:
//   • Yüksek AR → düşük indüklenen sürükleme (C_Di = C_L²/πARe). Menzil
//     uçağı için indüklenen sürükleme seyirde toplam sürüklemenin ~%40'ı.
//   • 32° süpürme → kritik Mach'ı yukarı iter (süpürülmüş kanat, kesite
//     yalnız normal bileşeni gösterir: M_n = M cos Λ).
//   • Uçta −3° washout → kanat ucu köke göre daha düşük hücum açısında
//     çalışır, stall KÖKTEN başlar; aileron son ana kadar çalışır.

export function buildAirliner({ scale = 1, palette, gear = false } = {}) {
  const m = makeMats(palette);
  const g = new THREE.Group();

  // ── Gövde: basınçlı tüp (dairesel kesit), ojiv burun, konik kuyruk yükselişi
  const R = 0.085;
  const body = loftBody([
    // Radom KÜT: bir yolcu uçağının burnu dart ucu değildir — içinde hava
    // radarı vardır ve incelik oranı ~1,7'dir. (İlk denemede 4,5 çıkmıştı,
    // uçak füzeye benziyordu.)
    { x: 1.30, ry: 0.0,      rz: 0.0,      dz: -0.010 },
    { x: 1.275, ry: R * 0.34, rz: R * 0.34, dz: -0.010 },
    { x: 1.225, ry: R * 0.64, rz: R * 0.66, dz: -0.008 },
    { x: 1.145, ry: R * 0.88, rz: R * 0.90, dz: -0.004 },
    { x: 1.040, ry: R * 0.99, rz: R * 0.99 },
    { x: 0.92, ry: R,       rz: R },
    { x: 0.20, ry: R,       rz: R },
    { x: -0.35, ry: R,      rz: R },
    { x: -0.62, ry: R * 0.92, rz: R * 0.94, dz: 0.008 },
    { x: -0.86, ry: R * 0.62, rz: R * 0.68, dz: 0.030 },
    { x: -1.02, ry: R * 0.30, rz: R * 0.34, dz: 0.052 },
    { x: -1.12, ry: 0.0,    rz: 0.0,       dz: 0.066 },
  ], m.body, { nAround: 34 });
  g.add(body);

  // ── Kanat: kırık hücum kenarı (kök yaka + ana panel), uçta raked tip
  const wingSec = [
    { y: 0.000, xqc:  0.075, zqc: -0.052, chord: 0.401, twist:  1.6, naca: { m: 0.02, p: 0.4, t: 0.15 } },
    { y: 0.085, xqc:  0.050, zqc: -0.050, chord: 0.363, twist:  1.2, naca: { m: 0.02, p: 0.4, t: 0.14 } },
    { y: 0.320, xqc: -0.097, zqc: -0.028, chord: 0.229, twist:  0.0, naca: { m: 0.02, p: 0.4, t: 0.115 } },
    { y: 0.760, xqc: -0.372, zqc:  0.014, chord: 0.129, twist: -1.8, naca: { m: 0.018, p: 0.4, t: 0.10 } },
    { y: 0.980, xqc: -0.520, zqc:  0.035, chord: 0.082, twist: -3.0, naca: { m: 0.015, p: 0.4, t: 0.09 } },
  ];
  const wing = loftWing(wingSec, m.wing);
  g.add(wing.mesh);

  // Kanat–gövde birleşim kaportası (belly fairing) — gerçek uçaklarda iniş
  // takımı kutusunu ve kanat kutusunu örter; siluetin tanınırlığı buradan gelir.
  const fair = loftBody([
    { x: 0.42, ry: 0.0, rz: 0.0, dz: -0.055 },
    { x: 0.30, ry: 0.075, rz: 0.030, dz: -0.062 },
    { x: 0.02, ry: 0.098, rz: 0.040, dz: -0.070 },
    { x: -0.30, ry: 0.086, rz: 0.034, dz: -0.066 },
    { x: -0.46, ry: 0.0, rz: 0.0, dz: -0.055 },
  ], m.body, { nAround: 22 });
  g.add(fair);

  // ── Kanatçık (winglet): uç vorteksinin indüklediği akımı dikey yüzeyde
  //    ileri bileşenli kuvvete çevirir — indüklenen sürüklemeyi ~%4 düşürür.
  for (const side of [1, -1]) {
    // DİKKAT — kanıklık işareti: kanatçık +Y'ye açılan yarım bir yüzey olarak
    // kurulursa, SOL taraf için X ekseni etrafındaki aynı dönme onu AŞAĞI
    // indirir (bir kez böyle çıktı: sağ kanatçık yukarı, sol aşağı bakıyordu).
    // Doğrusu, sol kanatçığı doğrudan −Y istasyonlarıyla kurmak ve dönmenin
    // işaretini de çevirmek: R_x(∓76°)·(0,±1,0) = (0, 0.24, 0.97) — İKİSİ DE
    // yukarı. Sarım zaten hacim işaretinden düzeltiliyor.
    const secs = [
      { y: 0.000, xqc:  0.000, zqc: 0.0, chord: 0.082, twist: 0, naca: { m: 0, p: 0.4, t: 0.09 } },
      { y: 0.045, xqc: -0.020, zqc: 0.0, chord: 0.070, twist: 0, naca: { m: 0, p: 0.4, t: 0.085 } },
      { y: 0.105, xqc: -0.052, zqc: 0.0, chord: 0.036, twist: 0, naca: { m: 0, p: 0.4, t: 0.08 } },
    ].map((s) => ({ ...s, y: s.y * side }));
    const wl = loftWing(secs, m.wing, { mirror: false });
    wl.mesh.rotation.x = side * (Math.PI * 0.42);   // ~76° yukarı, hafif dışa
    wl.mesh.position.set(-0.520, side * 0.980, 0.035);
    g.add(wl.mesh);
    // Kanatçığın hücum kenarında ince vurgu — livre şeridinin devamı.
    const edge = box(0.006, 0.004, 0.098, m.accent);
    edge.position.set(-0.500, side * 0.988, 0.083);
    edge.rotation.y = 0.42;
    g.add(edge);
  }

  // ── Motorlar: kanadın ALTINDA ve ÖNÜNDE (flutter için kütle dengesi +
  //    kanat yüküyle eğilme momenti azaltma). Yüksek baypas → büyük çap.
  for (const side of [1, -1]) {
    const nac = turbofan(m, { r: 0.078, len: 0.30 });
    nac.position.set(0.05, side * 0.36, -0.105);
    g.add(nac);
    const py = pylon(m, { len: 0.20, h: 0.085, th: 0.026 });
    py.position.set(-0.045, side * 0.36, -0.055);
    g.add(py);
  }

  // ── Kuyruk: dikey stabilize + yatay stabilize (gövde köküne monte)
  const fin = loftWing([
    { y: 0.000, xqc: -0.86, zqc: 0, chord: 0.30, twist: 0, naca: { m: 0, p: 0.4, t: 0.11 } },
    { y: 0.130, xqc: -0.92, zqc: 0, chord: 0.24, twist: 0, naca: { m: 0, p: 0.4, t: 0.10 } },
    { y: 0.300, xqc: -1.00, zqc: 0, chord: 0.145, twist: 0, naca: { m: 0, p: 0.4, t: 0.09 } },
  ], m.body, { mirror: false });
  // DİKEY YÜZEY YÖNÜ — bir kez yanlış kuruldu, ders burada duruyor:
  // R_x(θ)·(0,1,0) = (0, cosθ, sinθ). θ = −90° ⇒ (0,0,−1), yani açıklık
  // AŞAĞI gider ve dikey kuyruk gövdenin altında sarkar. Doğrusu +90°.
  // (Aynı hata kanatçıkta da yapılmıştı; orada yakalanıp burada kalmıştı.)
  fin.mesh.rotation.x = Math.PI / 2;               // açıklık +Y → +Z (YUKARI)
  fin.mesh.position.z = 0.062;
  g.add(fin.mesh);

  const tail = loftWing([
    { y: 0.000, xqc: -0.90, zqc: 0.020, chord: 0.20, twist: 0, naca: { m: 0, p: 0.4, t: 0.10 } },
    { y: 0.300, xqc: -1.00, zqc: 0.034, chord: 0.095, twist: 0, naca: { m: 0, p: 0.4, t: 0.09 } },
  ], m.body);
  g.add(tail.mesh);

  // ── Sırt kaportası (dorsal fin fillet) ────────────────────────────
  // Dikey kuyruğun kökünü gövdeye bağlayan alçak üçgen. Yalnız süs değil:
  // yüksek yana kayma açısında kuyruğun stall'a girmesini geciktirir ve
  // kanat–gövde birleşimindeki gibi girdap üretir. Siluetin tanınırlığının
  // büyük kısmı buradan gelir.
  {
    const N = 16, pos = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const x = -0.62 + t * 0.30;                       // gövdeden fin köküne
      const h = 0.062 + 0.055 * t * t;                  // yükselen sırt hattı
      const w = 0.019 * (1 - t) + 0.006;
      pos.push(x, -w, 0.030 + 0.020 * t, x, w, 0.030 + 0.020 * t, x, 0, h);
    }
    for (let i = 0; i < N; i++) {
      const a = i * 3, b = a + 3;
      idx.push(a, b, a + 2, b, b + 2, a + 2);           // sol yüz
      idx.push(a + 1, a + 2, b + 1, b + 1, a + 2, b + 2); // sağ yüz
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const sirt = new THREE.Mesh(geo, m.body);
    sirt.material.side = THREE.DoubleSide;
    g.add(sirt);
  }

  // ── Flap ray kaportaları ───────────────────────────────────────────
  // Kanadın ALTINDAN, firar kenarının GERİSİNE taşan mekik biçimli
  // kaportalar. İçinde flapı geriye ve aşağıya taşıyan raylar vardır;
  // bir yolcu uçağının alt siluetini tanınır kılan şey bunlardır.
  for (const side of [1, -1]) {
    for (const [yy, len] of [[0.155, 0.20], [0.300, 0.18], [0.460, 0.15]]) {
      const yerel = wingSec.find((s) => s.y >= yy) || wingSec[wingSec.length - 1];
      const kap = loftBody([
        { x:  0.10, ry: 0.0,   rz: 0.0 },
        { x:  0.03, ry: 0.019, rz: 0.016, nUp: 2.4, nDn: 2.4 },
        { x: -0.10, ry: 0.021, rz: 0.018, nUp: 2.6, nDn: 2.6 },
        { x: -len,  ry: 0.008, rz: 0.008, nUp: 2.4, nDn: 2.4 },
        { x: -len - 0.03, ry: 0.0, rz: 0.0 },
      ], m.body, { nAround: 16 });
      kap.position.set(yerel.xqc - 0.16 * yerel.chord, side * yy, yerel.zqc - 0.030);
      g.add(kap);
    }
  }

  // ── APU egzozu: kuyruk konisinin ucundaki küçük koyu ağız ──────────
  const apu = cylX(0.016, 0.022, 0.05, 16, m.dark, true);
  apu.position.set(-1.10, 0, 0.064);
  g.add(apu);

  // ── Kokpit camı + kabin şeridi + livre vurgusu
  const cp = canopy(m, { len: 0.20, wid: 0.075, hgt: 0.040 });
  cp.position.set(1.05, 0, R * 0.62);
  g.add(cp);
  g.add(windowBand(m, { x0: -0.55, x1: 0.98, r: R, z: 0.34, w: 0.014 }));
  const stripe = box(1.90, 0.004, 0.011, m.accent);
  for (const side of [1, -1]) {
    const s2 = stripe.clone();
    s2.position.set(0.05, side * R * 0.985, -R * 0.16);
    g.add(s2);
  }

  if (gear) {
    g.add(gearLeg(m, { x: 1.02, y: 0, zTop: -R, len: 0.10, wheelR: 0.018 }));
    for (const side of [1, -1]) g.add(gearLeg(m, { x: -0.02, y: side * 0.10, zTop: -0.070, len: 0.115 }));
  }

  return finalize(g, 'airliner', scale, m, wing.metrics, {
    regime: 'ses altı ulaşım · seyir M ≈ 0,78–0,85',
    why: 'Yüksek AR indüklenen sürüklemeyi düşürür; 32° süpürme kritik Mach\'ı yukarı iter; uçta −3° washout stall\'ı kökten başlatır.',
  });
}

/* ================================================================== */
/* ARAÇ 2 — SAVAŞ UÇAĞI (transonik–süpersonik, M ≈ 0,9–2,0)           */
/* ================================================================== */
//
// Sınıf oranları: AR ≈ 2,4 · Λ_LE ≈ 42° · λ ≈ 0,22 · dihedral 0°.
// Düşük AR bir eksiklik değil TERCİHTİR: yüksek g dönüşünde kanat yükü ve
// dalga sürüklemesi indüklenen sürüklemeden önce gelir; ayrıca düşük AR
// kanat, yüksek hücum açısında daha geç stall'a girer.
// LERX (kök uzantısı): keskin kenar, yüksek α'da KARARLI bir girdap üretir;
// girdabın çekirdeğindeki alçak basınç kanat üstünü emer — "vorteks kaldırması".

export function buildFighter({ scale = 1, palette } = {}) {
  const m = makeMats(palette);
  const g = new THREE.Group();

  // Gövde: chine'li ön gövde (n<2 → yanal keskin kenar), yassı orta gövde.
  const body = loftBody([
    { x: 1.05, ry: 0.0,   rz: 0.0,   nUp: 1.6, nDn: 1.6 },
    { x: 0.96, ry: 0.030, rz: 0.022, nUp: 1.5, nDn: 1.4, dz: 0.004 },
    { x: 0.80, ry: 0.062, rz: 0.040, nUp: 1.5, nDn: 1.4, dz: 0.004 },
    { x: 0.58, ry: 0.086, rz: 0.056, nUp: 1.7, nDn: 1.5 },
    { x: 0.26, ry: 0.108, rz: 0.062, nUp: 2.2, nDn: 2.4 },
    { x: -0.10, ry: 0.115, rz: 0.060, nUp: 2.6, nDn: 3.0 },
    { x: -0.46, ry: 0.108, rz: 0.055, nUp: 2.8, nDn: 3.2 },
    { x: -0.70, ry: 0.092, rz: 0.048, nUp: 2.6, nDn: 2.8 },
    { x: -0.82, ry: 0.082, rz: 0.044, nUp: 2.4, nDn: 2.4 },
  ], m.body, { nAround: 30 });
  g.add(body);

  // Kanat: LERX + trapez ana panel. LERX'i kanadın kök istasyonları olarak
  // veriyoruz — ayrı parça değil, aynı yüzeyin devamı (gerçekte de öyledir).
  // Kök uzantısı (LERX) 0 → 0,150'de ~78° süpürmeyle gelir; ana panel
  // 0,150 → 0,560'ta SABİT 42°'dir. İki bölge ayrı olduğu için ölçülen
  // planform AR'si ile referans trapez AR'si FARKLI çıkar; metrics ikisini
  // de yazar (aradaki fark tam olarak LERX alanıdır).
  const wingSec = [
    { y: 0.000, xqc:  0.5768, zqc: 0.003, chord: 1.3557, twist: 0, naca: { m: 0, p: 0.4, t: 0.055 } },
    { y: 0.070, xqc:  0.3342, zqc: 0.003, chord: 1.0089, twist: 0, naca: { m: 0, p: 0.4, t: 0.052 } },
    { y: 0.150, xqc:  0.0569, zqc: 0.003, chord: 0.6125, twist: 0, naca: { m: 0, p: 0.4, t: 0.048 } },
    { y: 0.310, xqc: -0.0412, zqc: 0.003, chord: 0.4284, twist: -0.5, naca: { m: 0, p: 0.4, t: 0.045 } },
    { y: 0.560, xqc: -0.1944, zqc: 0.003, chord: 0.1408, twist: -1.5, naca: { m: 0, p: 0.4, t: 0.040 } },
  ];
  // refPanel: ana panel 0,150 → 0,560 istasyonları. Referans trapez ORADAN
  // merkeze uzatılır; LERX dışarıda kalır (yayımlanan AR'nin tanımı budur).
  const wing = loftWing(wingSec, m.wing, { refPanel: [2, 4] });
  g.add(wing.mesh);

  // Hava girişleri: gövde yanına gömülü, keskin ağızlı (süpersonik rampalı).
  for (const side of [1, -1]) {
    const inlet = loftBody([
      { x: 0.44, ry: 0.030, rz: 0.030, nUp: 2.6, nDn: 2.6 },
      { x: 0.20, ry: 0.036, rz: 0.038, nUp: 2.8, nDn: 2.8 },
      { x: -0.10, ry: 0.034, rz: 0.036, nUp: 2.8, nDn: 2.8 },
    ], m.body, { nAround: 18 });
    inlet.position.set(0, side * 0.112, -0.014);
    g.add(inlet);
    const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.030, 18), m.dark);
    mouth.rotation.y = Math.PI / 2;
    mouth.position.set(0.442, side * 0.112, -0.014);
    g.add(mouth);
  }

  // Çift dikey kuyruk, DIŞA KANIK (radar kesitini düşürür + yüksek α'da
  // gövde gölgesinden çıkıp etkin kalır).
  for (const side of [1, -1]) {
    const vt = loftWing([
      { y: 0.000, xqc: -0.50, zqc: 0, chord: 0.34, twist: 0, naca: { m: 0, p: 0.4, t: 0.055 } },
      { y: 0.230, xqc: -0.66, zqc: 0, chord: 0.14, twist: 0, naca: { m: 0, p: 0.4, t: 0.045 } },
    ], m.body, { mirror: false });
    vt.mesh.rotation.x = Math.PI / 2;
    vt.mesh.rotation.y = 0;
    vt.mesh.position.set(0, side * 0.098, 0.052);
    // Kanıklık işareti: sağ kuyruğun (y>0) TEPESİ dışa (+Y) yatmalı.
    // R_x(−0,47)·(0,0,1) = (0, +0,45, +0,88) — bu yüzden −side.
    vt.mesh.rotateOnWorldAxis(V3(1, 0, 0), -side * 0.47);  // ~27° dışa kanık
    g.add(vt.mesh);
  }

  // Yatay kuyruk: tümü hareketli (stabilator) — süpersonikte klasik
  // asansör etkisini kaybeder, bu yüzden yüzeyin TAMAMI döner.
  const ht = loftWing([
    { y: 0.000, xqc: -0.60, zqc: -0.010, chord: 0.28, twist: 0, naca: { m: 0, p: 0.4, t: 0.05 } },
    { y: 0.290, xqc: -0.78, zqc: -0.014, chord: 0.11, twist: 0, naca: { m: 0, p: 0.4, t: 0.042 } },
  ], m.wing);
  g.add(ht.mesh);

  // Nozullar: yakınsak–ıraksak, dilimli (bkz. şok elmasları presetinde
  // egzoz genişlemesi). İki motor.
  for (const side of [1, -1]) {
    const noz = cylX(0.040, 0.050, 0.16, 20, m.metalDS, true);
    noz.position.set(-0.90, side * 0.048, -0.002);
    g.add(noz);
    const hot = new THREE.Mesh(new THREE.CircleGeometry(0.038, 18), m.dark);
    hot.rotation.y = -Math.PI / 2;
    hot.position.set(-0.975, side * 0.048, -0.002);
    g.add(hot);
  }

  // Kanopi (tek parça, kabarcık tip) + burun probu.
  const cp = canopy(m, { len: 0.30, wid: 0.058, hgt: 0.048 });
  cp.position.set(0.70, 0, 0.052);
  g.add(cp);
  const probe = cylX(0.0025, 0.005, 0.10, 8, m.metal);
  probe.position.set(1.10, 0, 0.0);
  g.add(probe);

  return finalize(g, 'fighter', scale, m, wing.metrics, {
    regime: 'transonik–süpersonik · M ≈ 0,9–2,0',
    why: 'Düşük AR yüksek-g manevrada dalga sürüklemesini azaltır; LERX yüksek α\'da kararlı girdap üretir ve kanat üstünü emerek "vorteks kaldırması" verir.',
  });
}

/* ================================================================== */
/* ARAÇ 3 — OJİV DELTA (süpersonik ulaşım, M ≈ 2,0)                   */
/* ================================================================== */
//
// AR ≈ 1,7 · λ ≈ 0,04 · Λ_LE kökte ~76°, uçta ~55° (OJİV: süpürme açıklık
// boyunca SÜREKLİ değişir, tek kırık yoktur).
// Neden ojiv: hücum kenarı Mach konisinin İÇİNDE kalırsa kenar "ses altı"
// davranır ve dalga sürüklemesi düşer — sin Λ_LE > ... koşulu M ile değişir.
// Ayrıca keskin kenar, düşük hızda KARARLI hücum kenarı girdabı üretir;
// inişte kaldırmanın büyük kısmı bu girdaptan gelir (burun yukarı duruş).

export function buildDelta({ scale = 1, palette, droopNose = 0 } = {}) {
  const m = makeMats(palette);
  const g = new THREE.Group();

  // İnce, uzun gövde — ince cisim teorisi: dalga sürüklemesi kesit alanı
  // dağılımının İKİNCİ TÜREVİNE bağlıdır, o yüzden her yer yumuşak.
  const R = 0.055;
  const bodyStations = [
    { x: 1.55, ry: 0.0, rz: 0.0 },
    { x: 1.42, ry: R * 0.22, rz: R * 0.20 },
    { x: 1.24, ry: R * 0.50, rz: R * 0.46 },
    { x: 1.00, ry: R * 0.78, rz: R * 0.76 },
    { x: 0.60, ry: R, rz: R },
    { x: -0.20, ry: R, rz: R },
    { x: -0.80, ry: R * 0.96, rz: R * 0.96 },
    { x: -1.18, ry: R * 0.72, rz: R * 0.78, dz: 0.012 },
    { x: -1.40, ry: R * 0.36, rz: R * 0.44, dz: 0.026 },
    { x: -1.52, ry: 0.0, rz: 0.0, dz: 0.034 },
  ];
  g.add(loftBody(bodyStations, m.body, { nAround: 30 }));

  // Düşük hızda görüş için EĞİLEN BURUN: gerçek mekanizma budur, süs değil.
  if (droopNose > 0) {
    const nose = loftBody([
      { x: 1.55, ry: 0.0, rz: 0.0 },
      { x: 1.42, ry: R * 0.22, rz: R * 0.20 },
      { x: 1.24, ry: R * 0.50, rz: R * 0.46 },
    ], m.body, { nAround: 24 });
    nose.position.set(-1.24, 0, 0);
    const pivot = new THREE.Group();
    pivot.add(nose);
    pivot.position.set(1.24, 0, 0);
    pivot.rotation.y = (droopNose * Math.PI) / 180;   // + = burun aşağı
    g.add(pivot);
  }

  // Ojiv delta: süpürme açıklık boyunca sürekli azalır.
  // OJİV hücum kenarı: süpürme kökte ~78°, uçta ~56°, ARADA SÜREKLİ.
  // Tablo, hücum kenarı çizgisinin ∫tan Λ dy integralinden çıkarıldı;
  // firar kenarı neredeyse dik (hafif geriye kaçık). Sivrilme λ ≈ 0,06.
  const wingSec = [
    { y: 0.000, xqc:  0.6200, zqc: -0.026, chord: 1.4200, twist:  0.0, naca: { m: 0, p: 0.4, t: 0.030 } },
    { y: 0.090, xqc:  0.3360, zqc: -0.028, chord: 1.0632, twist: -0.3, naca: { m: 0, p: 0.4, t: 0.030 } },
    { y: 0.200, xqc:  0.0696, zqc: -0.031, chord: 0.7347, twist: -0.7, naca: { m: 0, p: 0.4, t: 0.029 } },
    { y: 0.320, xqc: -0.1572, zqc: -0.035, chord: 0.4614, twist: -1.2, naca: { m: 0, p: 0.4, t: 0.028 } },
    { y: 0.450, xqc: -0.3533, zqc: -0.040, chord: 0.2313, twist: -1.8, naca: { m: 0, p: 0.4, t: 0.027 } },
    { y: 0.530, xqc: -0.4547, zqc: -0.045, chord: 0.1156, twist: -2.2, naca: { m: 0, p: 0.4, t: 0.026 } },
    { y: 0.550, xqc: -0.4782, zqc: -0.048, chord: 0.0891, twist: -2.4, naca: { m: 0, p: 0.4, t: 0.026 } },
  ];
  const wing = loftWing(wingSec, m.wing);
  g.add(wing.mesh);

  // Dört motor, iki ikiz nasel — kanadın ALTINA gömülü (dikdörtgen ağız,
  // süpersonik girişte rampa; burada yassı kutu olarak temsil edilir).
  for (const side of [1, -1]) {
    const nac = loftBody([
      { x: -0.30, ry: 0.062, rz: 0.030, nUp: 3.2, nDn: 3.2 },
      { x: -0.60, ry: 0.070, rz: 0.034, nUp: 3.4, nDn: 3.4 },
      { x: -1.00, ry: 0.066, rz: 0.032, nUp: 3.2, nDn: 3.2 },
    ], m.body, { nAround: 20 });
    nac.position.set(0, side * 0.235, -0.060);
    g.add(nac);
    const mouth = new THREE.Mesh(new THREE.PlaneGeometry(0.118, 0.056), m.dark);
    mouth.rotation.y = Math.PI / 2;
    mouth.position.set(-0.298, side * 0.235, -0.060);
    g.add(mouth);
    for (const inner of [-1, 1]) {
      const noz = cylX(0.026, 0.030, 0.10, 16, m.metalDS, true);
      noz.position.set(-1.06, side * 0.235 + inner * 0.030, -0.060);
      g.add(noz);
    }
  }

  // Tek dikey stabilize; YATAY KUYRUK YOK — delta kendi firar kenarıyla
  // hem asansör hem aileron yapar (elevon).
  const fin = loftWing([
    { y: 0.000, xqc: -1.02, zqc: 0, chord: 0.42, twist: 0, naca: { m: 0, p: 0.4, t: 0.045 } },
    { y: 0.140, xqc: -1.12, zqc: 0, chord: 0.30, twist: 0, naca: { m: 0, p: 0.4, t: 0.042 } },
    { y: 0.300, xqc: -1.24, zqc: 0, chord: 0.16, twist: 0, naca: { m: 0, p: 0.4, t: 0.038 } },
  ], m.body, { mirror: false });
  fin.mesh.rotation.x = Math.PI / 2;
  fin.mesh.position.z = 0.042;
  g.add(fin.mesh);

  // Kokpit: dar, çok eğik cam + kabin şeridi + hücum kenarı vurgusu.
  const cp = canopy(m, { len: 0.26, wid: 0.046, hgt: 0.026 });
  cp.position.set(1.10, 0, R * 0.66);
  g.add(cp);
  g.add(windowBand(m, { x0: -0.70, x1: 0.86, r: R, z: 0.30, w: 0.010 }));
  for (const side of [1, -1]) {
    const st = box(1.60, 0.003, 0.009, m.accent);
    st.position.set(0.10, side * R * 0.985, -R * 0.10);
    g.add(st);
  }

  return finalize(g, 'delta', scale, m, wing.metrics, {
    regime: 'süpersonik ulaşım · seyir M ≈ 2,0',
    why: 'Ojiv hücum kenarı Mach konisinin içinde kalarak dalga sürüklemesini düşürür; aynı keskin kenar düşük hızda kararlı girdap üretip inişte kaldırma sağlar.',
  });
}

/* ================================================================== */
/* ARAÇ 4 — WAVERIDER (hipersonik, M ≈ 5–10)                          */
/* ================================================================== */
//
// AR ≈ 1,0 · Λ_LE ≈ 78° · alt yüzey DÜZ (süperelips üssü n≈6).
// "Waverider" adı şundan gelir: araç KENDİ yay şokunun üstünde sörf yapar.
// Hücum kenarı şoka OTURTULUR; yüksek basınçlı şok-sonrası gaz alt yüzeyin
// altında hapsolur, üste sızamaz → L/D belirgin artar.
// Newton etki teorisi bu rejimde işe yarar: Cp = 2 sin²θ (θ = yüzeyin akım
// ile açısı). Hipersonikte basınç yalnız YEREL eğime bakar, çünkü şok
// yüzeye yapışır ve bozulmalar akım yönünde ilerleyemez.
// Hücum kenarı KESKİN ama tam sivri değil: durma noktası ısı akısı
// q ∝ 1/√R_n — sıfır yarıçap sonsuz ısı akısı demektir. Bu yüzden gerçek
// hipersonik araçlarda kenar milimetrik ama SONLU yarıçaplıdır.

export function buildWaverider({ scale = 1, palette } = {}) {
  const m = makeMats(palette);
  const g = new THREE.Group();

  // Gövde ve kanat AYRI DEĞİL: tek karışık (blended) yüzey. Onu tek bir
  // loft ile üretiyoruz — üstü yuvarlak (n=2,3), altı düz (n=7).
  const bodySec = [
    { x: 1.30, ry: 0.010, rz: 0.006, nUp: 2.0, nDn: 4.0 },
    { x: 1.10, ry: 0.048, rz: 0.020, nUp: 2.1, nDn: 5.0 },
    { x: 0.80, ry: 0.105, rz: 0.038, nUp: 2.2, nDn: 6.0 },
    { x: 0.40, ry: 0.168, rz: 0.054, nUp: 2.3, nDn: 7.0 },
    { x: 0.00, ry: 0.220, rz: 0.062, nUp: 2.3, nDn: 7.0 },
    { x: -0.40, ry: 0.258, rz: 0.064, nUp: 2.3, nDn: 7.0 },
    { x: -0.75, ry: 0.272, rz: 0.060, nUp: 2.2, nDn: 6.5 },
    { x: -0.95, ry: 0.266, rz: 0.054, nUp: 2.1, nDn: 6.0 },
  ];
  g.add(loftBody(bodySec, m.body, { nAround: 40 }));

  // Hücum kenarı: SONLU yarıçaplı, ısıya dayanıklı malzeme (vurgu rengi).
  // Kenar çizgisini gövde istasyonlarının maksimum genişliğinden türetiyoruz,
  // yani kenar gövdeye "yapıştırılmış" değil, gövdenin kendi hattı.
  for (const side of [1, -1]) {
    const pts = bodySec.map((s) => new THREE.Vector3(s.x, side * s.ry, -s.rz * 0.28));
    const curve = new THREE.CatmullRomCurve3(pts);
    const edge = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.0085, 10, false), m.accent);
    g.add(edge);
  }

  // Scramjet akış yolu: giriş rampası → izolatör → yanma odası → nozul.
  // Alt yüzeyin kendisi girişin SIKIŞTIRMA yüzeyidir (ön gövde ön sıkıştırma
  // yapar) — bu yüzden motor gövdeye gömülüdür, altına asılı değildir.
  const duct = loftBody([
    { x: 0.30, ry: 0.105, rz: 0.016, nUp: 5, nDn: 5 },
    { x: -0.10, ry: 0.115, rz: 0.024, nUp: 6, nDn: 6 },
    { x: -0.55, ry: 0.118, rz: 0.028, nUp: 6, nDn: 6 },
    { x: -0.95, ry: 0.130, rz: 0.034, nUp: 6, nDn: 6 },
  ], m.panel, { nAround: 20 });
  duct.position.z = -0.062;
  g.add(duct);
  const cowlLip = box(0.03, 0.212, 0.014, m.metal);
  cowlLip.position.set(0.305, 0, -0.076);
  g.add(cowlLip);
  const inMouth = new THREE.Mesh(new THREE.PlaneGeometry(0.206, 0.028), m.dark);
  inMouth.rotation.y = Math.PI / 2;
  inMouth.position.set(0.298, 0, -0.062);
  g.add(inMouth);
  // Tek taraflı (SERT) nozul: hipersonikte genişleme oranı çok büyüktür,
  // kapalı çan yerine aracın arka alt yüzeyi genişleme yüzeyi olarak kullanılır.
  const ramp = box(0.34, 0.24, 0.012, m.metal);
  ramp.position.set(-1.02, 0, -0.052);
  ramp.rotation.y = -0.26;
  g.add(ramp);

  // Kanıklı dikey yüzeyler (uç kanatçıklar) — hipersonikte yönlü kararlılık
  // gövdenin arkasında kalan küçük yüzeylerle sağlanır.
  for (const side of [1, -1]) {
    const fin = loftWing([
      { y: 0.000, xqc: -0.74, zqc: 0, chord: 0.30, twist: 0, naca: { m: 0, p: 0.4, t: 0.05 } },
      { y: 0.150, xqc: -0.84, zqc: 0, chord: 0.14, twist: 0, naca: { m: 0, p: 0.4, t: 0.045 } },
    ], m.body, { mirror: false });
    fin.mesh.rotation.x = Math.PI / 2;
    fin.mesh.position.set(0, side * 0.240, 0.030);
    fin.mesh.rotateOnWorldAxis(V3(1, 0, 0), -side * 0.38);  // tepesi dışa
    g.add(fin.mesh);
  }

  // Burun: sonlu yarıçaplı küre — ısı akısının sonlu kalmasının sebebi.
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.013, 20, 14), m.accent);
  nose.position.set(1.298, 0, -0.001);
  g.add(nose);

  // Metrikler: waverider'da "kanat" ayrı bir yüzey değil; planformu gövde
  // istasyonlarından SAYISAL olarak çıkarıyoruz (yarı genişlik ry, veter ise
  // o istasyondan buruna kadar olan mesafe değil — planform şeridi).
  const stations = bodySec.map((s) => ({ y: s.ry, x: s.x }));
  let S = 0;
  for (let i = 0; i < stations.length - 1; i++) {
    const dy = Math.abs(stations[i + 1].y - stations[i].y);
    const dx = Math.abs(stations[i + 1].x - stations[i].x);
    S += dx * (stations[i].y + stations[i + 1].y);      // 2 × yamuk (iki yarı)
  }
  const bMax = 2 * Math.max(...bodySec.map((s) => s.ry));
  const rootChord = bodySec[0].x - bodySec[bodySec.length - 1].x;
  const tipStation = bodySec[bodySec.length - 2];
  const metrics = {
    span: bMax, area: S, aspectRatio: (bMax * bMax) / S,
    mac: (2 / 3) * rootChord, taper: 0.0,
    sweepQC: (Math.atan2(bodySec[0].x - tipStation.x, tipStation.ry) * 180) / Math.PI,
    sweepLE: (Math.atan2(bodySec[0].x - tipStation.x, tipStation.ry) * 180) / Math.PI,
    dihedral: 0, twistTip: 0, rootChord, tipChord: 0.0,
  };

  return finalize(g, 'waverider', scale, m, metrics, {
    regime: 'hipersonik · M ≈ 5–10',
    why: 'Hücum kenarı kendi yay şokuna oturur; yüksek basınçlı şok-sonrası gaz alt yüzeyde hapsolur. Burun ve kenar SONLU yarıçaplıdır çünkü durma ısı akısı q ∝ 1/√R_n.',
  });
}

/* ================================================================== */
/* ARAÇ 5 — PLANÖR (ses altı, düşük hız, AR ≈ 28)                     */
/* ================================================================== */
//
// Süzülme oranı = L/D. AR 28'lik bir kanatta indüklenen sürükleme öyle
// düşer ki 50:1'e yaklaşan süzülme mümkün olur. Aynı zamanda bu kütüphanenin
// AR uçlarını göstermesi için var: AR 1,0 (waverider) → AR 28 (planör).

export function buildGlider({ scale = 1, palette } = {}) {
  const m = makeMats(palette);
  const g = new THREE.Group();

  const R = 0.042;
  g.add(loftBody([
    { x: 0.60, ry: 0.0, rz: 0.0 },
    { x: 0.54, ry: R * 0.40, rz: R * 0.44 },
    { x: 0.44, ry: R * 0.80, rz: R * 0.90 },
    { x: 0.28, ry: R, rz: R * 1.10 },
    { x: 0.05, ry: R * 0.92, rz: R * 1.02 },
    { x: -0.30, ry: R * 0.52, rz: R * 0.58 },
    { x: -0.80, ry: R * 0.28, rz: R * 0.32 },
    { x: -1.15, ry: R * 0.20, rz: R * 0.24 },
    { x: -1.28, ry: 0.0, rz: 0.0, dz: 0.006 },
  ], m.body, { nAround: 26 }));

  // Uzun, ince, çok az süpürülmüş kanat. Süpürme YOK denecek kadar az:
  // düşük hızda süpürmenin faydası yok, zararı (uç stall'ı) var.
  // Kesit KALIN ve KAMBURLU (t=0,15, m=0,03): düşük Reynolds'ta yüksek C_L.
  const wingSec = [
    { y: 0.000, xqc: 0.16, zqc: 0.044, chord: 0.150, twist:  1.0, naca: { m: 0.03, p: 0.4, t: 0.15 } },
    { y: 0.420, xqc: 0.155, zqc: 0.056, chord: 0.146, twist: 0.6, naca: { m: 0.03, p: 0.4, t: 0.145 } },
    { y: 1.050, xqc: 0.142, zqc: 0.078, chord: 0.126, twist: 0.0, naca: { m: 0.03, p: 0.4, t: 0.135 } },
    { y: 1.620, xqc: 0.128, zqc: 0.098, chord: 0.094, twist: -1.4, naca: { m: 0.025, p: 0.4, t: 0.125 } },
    { y: 1.900, xqc: 0.118, zqc: 0.110, chord: 0.052, twist: -2.6, naca: { m: 0.02, p: 0.4, t: 0.115 } },
  ];
  const wing = loftWing(wingSec, m.wing);
  g.add(wing.mesh);

  // T-kuyruk: yatay yüzey, kanat uyanıklığının DIŞINDA kalsın diye yukarıda.
  const fin = loftWing([
    { y: 0.000, xqc: -1.02, zqc: 0, chord: 0.19, twist: 0, naca: { m: 0, p: 0.4, t: 0.10 } },
    { y: 0.190, xqc: -1.10, zqc: 0, chord: 0.10, twist: 0, naca: { m: 0, p: 0.4, t: 0.09 } },
  ], m.body, { mirror: false });
  fin.mesh.rotation.x = Math.PI / 2;
  fin.mesh.position.z = 0.020;
  g.add(fin.mesh);

  const tail = loftWing([
    { y: 0.000, xqc: -1.11, zqc: 0.208, chord: 0.105, twist: 0, naca: { m: 0, p: 0.4, t: 0.09 } },
    { y: 0.320, xqc: -1.13, zqc: 0.210, chord: 0.062, twist: 0, naca: { m: 0, p: 0.4, t: 0.085 } },
  ], m.body);
  g.add(tail.mesh);

  // Uzun kanopi + tek tekerlek + kanat ucu emniyet takozu.
  const cp = canopy(m, { len: 0.34, wid: 0.042, hgt: 0.030 });
  cp.position.set(0.34, 0, R * 0.90);
  g.add(cp);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.020, 0.008, 8, 16), m.dark);
  wheel.position.set(0.10, 0, -R * 0.98);
  g.add(wheel);
  for (const side of [1, -1]) {
    const tipSkid = box(0.05, 0.006, 0.006, m.accent);
    tipSkid.position.set(0.118, side * 1.900, 0.104);
    g.add(tipSkid);
  }

  return finalize(g, 'glider', scale, m, wing.metrics, {
    regime: 'ses altı, düşük hız · süzülme oranı L/D ≈ 45–50',
    why: 'AR 28 indüklenen sürüklemeyi (C_L²/πARe) dibe çeker; kalın kamburlu kesit düşük Reynolds\'ta yüksek C_L verir; süpürme yok çünkü bu hızda faydası yok, uç stall zararı var.',
  });
}

/* ================================================================== */
/* ARAÇ 6 — UÇAN KANAT (ses altı, kuyruksuz, AR ≈ 5,9)                */
/* ================================================================== */
//
// Gövde yok, kuyruk yok: ıslak yüzey (sürtünme sürüklemesi) ve dalga
// yansıtan köşe sayısı en aza iner. Bedeli KARARLILIKTIR — dikey kuyruk
// olmadığı için yönlü kararlılık zayıftır ve firar kenarındaki bölünmüş
// frenler (drag rudder) ile uçuş kontrol bilgisayarına muhtaçtır.
// Kuyruksuz uçakta boyuna denge, uçta NEGATİF burulma (reflex/washout) ile
// sağlanır: uç aşağı yüklenir, burun-aşağı momenti dengelenir.

export function buildFlyingWing({ scale = 1, palette } = {}) {
  const m = makeMats(palette);
  const g = new THREE.Group();

  // Tek yüzey: kök çok kalın (mürettebat + yakıt + yük oraya girer), uca
  // doğru hızla incelir. Kökte t/c = 0,17, uçta 0,08.
  // Hücum kenarı TEK bir düz çizgi (33°) — kenar hizalaması budur: yansıma
  // birkaç yöne toplansın diye kanadın bütün kenarları o iki yöne paraleldir.
  // Firar kenarı ise "W" yapar: bu, kenar hizalamasını bozmadan veter
  // dağılımını değiştirmenin yoludur.
  const wingSec = [
    { y: 0.000, xqc:  0.3900, zqc: 0.000, chord: 0.840, twist:  1.4, naca: { m: 0.015, p: 0.45, t: 0.170 } },
    { y: 0.300, xqc:  0.2250, zqc: 0.003, chord: 0.720, twist:  0.9, naca: { m: 0.014, p: 0.45, t: 0.148 } },
    { y: 0.700, xqc:  0.0725, zqc: 0.008, chord: 0.290, twist:  0.0, naca: { m: 0.012, p: 0.45, t: 0.115 } },
    { y: 1.000, xqc: -0.1090, zqc: 0.011, chord: 0.240, twist: -2.4, naca: { m: 0.010, p: 0.45, t: 0.098 } },
    { y: 1.240, xqc: -0.2350, zqc: 0.014, chord: 0.120, twist: -4.2, naca: { m: 0.008, p: 0.45, t: 0.085 } },
    { y: 1.300, xqc: -0.2580, zqc: 0.015, chord: 0.056, twist: -4.6, naca: { m: 0.006, p: 0.45, t: 0.080 } },
  ];
  const wing = loftWing(wingSec, m.wing);
  g.add(wing.mesh);

  // Merkez kabarcık: kokpit ve yük bölmesi — kanadın ÜSTÜNE oturur ki
  // alt yüzey temiz kalsın.
  const hump = loftBody([
    { x: 0.560, ry: 0.0, rz: 0.0, dz: 0.034 },
    { x: 0.470, ry: 0.050, rz: 0.024, nUp: 2.2, nDn: 3.0, dz: 0.038 },
    { x: 0.240, ry: 0.086, rz: 0.040, nUp: 2.2, nDn: 3.2, dz: 0.042 },
    { x: -0.020, ry: 0.090, rz: 0.042, nUp: 2.2, nDn: 3.2, dz: 0.042 },
    { x: -0.150, ry: 0.068, rz: 0.030, nUp: 2.2, nDn: 3.0, dz: 0.038 },
    { x: -0.200, ry: 0.0, rz: 0.0, dz: 0.034 },
  ], m.body, { nAround: 24 });
  g.add(hump);

  // Üste gömülü girişler (alt yüzey ve radar için temiz kalır) + düz egzoz
  // yarıkları: sıcak gaz yayılarak çıkar, kızılötesi imza düşer.
  for (const side of [1, -1]) {
    const inl = loftBody([
      { x: 0.30, ry: 0.052, rz: 0.020, nUp: 3.0, nDn: 3.0 },
      { x: 0.06, ry: 0.058, rz: 0.024, nUp: 3.2, nDn: 3.2 },
      { x: -0.24, ry: 0.054, rz: 0.022, nUp: 3.0, nDn: 3.0 },
    ], m.body, { nAround: 18 });
    inl.position.set(0, side * 0.190, 0.044);
    g.add(inl);
    const mouth = new THREE.Mesh(new THREE.PlaneGeometry(0.100, 0.036), m.dark);
    mouth.rotation.y = Math.PI / 2;
    mouth.position.set(0.298, side * 0.190, 0.044);
    g.add(mouth);
    // Yassı egzoz yarığı: sıcak gaz yayılarak çıkar, kızılötesi imza düşer.
    const slot = box(0.13, 0.10, 0.009, m.panel);
    slot.position.set(-0.230, side * 0.190, 0.034);
    g.add(slot);
  }

  // Kokpit camı — kabarcığın (hump) üstüne oturur, kanadın içine gömülmez.
  const cp = canopy(m, { len: 0.19, wid: 0.052, hgt: 0.024 });
  cp.position.set(0.400, 0, 0.078);
  g.add(cp);

  return finalize(g, 'flyingwing', scale, m, wing.metrics, {
    regime: 'ses altı · yüksek menzil, kuyruksuz',
    why: 'Kuyruk ve gövde olmadığı için ıslak yüzey en aza iner; boyuna denge uçtaki −4,6° washout ile kurulur; yönlü kararlılık dikey yüzey yokluğunda bölünmüş firar kenarı frenlerine ve uçuş bilgisayarına kalır.',
  });
}

/* ================================================================== */
/* BLOK — YÜKSEK BAYPAS TURBOFAN (tek başına, isteğe bağlı kesitli)    */
/* ================================================================== */
//
// Uçaktan bağımsız bir blok: motoru tek başına göstermek, kesip içini
// anlatmak ya da bir Brayton çevrimi sahnesine mount etmek için.
//
// İSTASYONLAR — gerçek bir turbofanın akış yolu, önden arkaya:
//   0 giriş  → 1 FAN → baypas kanalı (itkinin ~%80'i buradan)
//                    ↘ çekirdek: 2 LPC → 3 HPC → 4 YANMA ODASI
//                      → 5 HPT (HPC'yi döndürür) → 6 LPT (fan ve LPC'yi
//                      döndürür) → 7 çekirdek nozulu
//
// Neden iki ayrı mil: HPC'nin verimli çalıştığı devir, fanın çalışabildiği
// devirden çok yüksektir (fan ucu ses hızını geçemez). Bu yüzden yüksek ve
// alçak basınç makineleri AYRI millerde döner, biri ötekinin içinden geçer.
//
// Neden yüksek baypas: itki ṁ·Δv'dir, itki gücü ise ~ ṁ·Δv²/2. Aynı itkiyi
// ÇOK havayı AZ hızlandırarak üretmek, az havayı çok hızlandırmaktan daha
// verimlidir — büyük fanın sebebi budur, ve gürültünün düşmesi de öyle.
export function buildTurbofan({ scale = 1, palette, blades = 20, cutaway = false } = {}) {
  const m = makeMats(palette);
  const g = new THREE.Group();
  const R = 0.5, L = 1.6;                     // fan yarıçapı ve nasel boyu
  const yari = cutaway ? Math.PI : Math.PI * 2;
  const bas = cutaway ? Math.PI * 0.5 : 0;

  // ── Nasel kaportası (kesitte yarım) ────────────────────────────────
  const dis = [];
  for (let i = 0; i <= 26; i++) {
    const u = i / 26;
    let rr;
    if (u < 0.10) rr = R * (0.86 + 0.14 * Math.sin((u / 0.10) * Math.PI * 0.5));
    else if (u < 0.60) rr = R * (1.0 + 0.05 * Math.sin(((u - 0.10) / 0.5) * Math.PI));
    else rr = R * (1.0 - 0.34 * Math.pow((u - 0.60) / 0.40, 1.4));
    dis.push(new THREE.Vector2(rr, -L * u));
  }
  dis.reverse();   // profil y ARTARAK sıralanmalı — yoksa normaller içe bakar
  // Kaporta BOYALI yüzeydir, çıplak metal değil: karanlık bir ortamda
  // metalness 0,86'lık bir yüzey yansıtacak bir şey bulamayıp siyah bir
  // kütle gibi okunuyordu. Metal yalnız dudakta, statörlerde ve nozulda.
  const cowl = new THREE.Mesh(new THREE.LatheGeometry(dis, 56, bas, yari), m.bodyDS);
  cowl.geometry.rotateZ(-Math.PI / 2);
  cowl.position.x = L * 0.5;
  g.add(cowl);
  // Kaportanın İÇ yüzü (baypas kanalının dışı)
  const ic = [];
  for (let i = 0; i <= 20; i++) {
    const u = i / 20;
    ic.push(new THREE.Vector2(R * (0.86 - 0.14 * u), -L * (0.08 + 0.84 * u)));
  }
  ic.reverse();
  const icCowl = new THREE.Mesh(new THREE.LatheGeometry(ic, 56, bas, yari), m.metalDS);
  icCowl.geometry.rotateZ(-Math.PI / 2);
  icCowl.position.x = L * 0.5;
  g.add(icCowl);

  // ── Fan + OGV ──────────────────────────────────────────────────────
  const fan = fanRotoru(m, { rHub: R * 0.20, rTip: R * 0.84, blades });
  fan.position.x = L * 0.40;
  fan.name = 'fan';
  g.add(fan);

  const ogvGeo = new THREE.BoxGeometry(0.10, 0.014, R * 0.42);
  for (let i = 0; i < 29; i++) {
    const v = new THREE.Mesh(ogvGeo, m.metal);
    v.position.set(0, 0, R * 0.55);
    const kol = new THREE.Group(); kol.add(v);
    kol.rotation.x = (i * 2 * Math.PI) / 29;
    if (cutaway && Math.sin(kol.rotation.x) < -0.1) continue;
    // NOT: Object3D.position SALT OKUNUR bir alandır (Vector3 nesnesi
    // yerinde değişir, yeniden atanamaz). Object.assign ile atamak
    // "Cannot assign to read only property 'position'" ile patlıyordu.
    kol.position.x = L * 0.24;
    g.add(kol);
  }

  // ── Çekirdek: kademe kademe ────────────────────────────────────────
  // Her kademe bir DİSK + üstünde radyal kanatçık sırası. Basınç arttıkça
  // hava yoğunlaşır, dolayısıyla akış kesiti KÜÇÜLÜR: kompresör kademeleri
  // arkaya doğru incelir, türbin kademeleri ise genişler. Bu daralma-genişleme
  // profili motorun siluetidir.
  function kademe(x, rIn, rOut, n, mat, kalinlik = 0.05) {
    const grp = new THREE.Group();
    const disk = cylX(rIn, rIn, kalinlik, 28, m.metal);
    grp.add(disk);
    const bg = new THREE.BoxGeometry(kalinlik * 0.7, 0.012, rOut - rIn);
    for (let i = 0; i < n; i++) {
      const b = new THREE.Mesh(bg, mat);
      b.position.set(0, 0, (rIn + rOut) / 2);
      const kol = new THREE.Group(); kol.add(b);
      kol.rotation.x = (i * 2 * Math.PI) / n + i * 0.11;
      if (cutaway && Math.sin(kol.rotation.x) < -0.15) continue;
      grp.add(kol);
    }
    grp.position.x = x;
    return grp;
  }

  // ÇEKİRDEK NASELİN İÇİNDE OTURMALI. İlk yerleşimde sıcak kısım (yanma
  // odası, HPT, LPT) kaportanın arkasından ~1 birim dışarı taşıyordu:
  // motor, ucuna türbin takılmış bir varil gibi görünüyordu. Gerçekte
  // çekirdek nasel boyunun ~%60'ıdır ve dışarı YALNIZ çekirdek nozulu ile
  // sıcak koni çıkar. Kaporta x ∈ [+0,8L/2, −0,8L/2] aralığında.
  const govde = cylX(R * 0.36, R * 0.30, L * 0.75, 34, m.body);
  govde.position.x = -L * 0.06;
  g.add(govde);

  // LPC — 3 kademe, dönen
  for (let i = 0; i < 3; i++) g.add(kademe(0.46 - i * 0.08, R * 0.14, R * 0.30, 26, m.metal, 0.045));
  // HPC — 6 kademe, arkaya doğru incelen
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    g.add(kademe(0.20 - i * 0.062, R * 0.16, R * (0.28 - 0.09 * t), 30, m.metal, 0.038));
  }
  // Yanma odası — halka; vurgu rengi (sıcak bölge)
  const yanma = new THREE.Mesh(
    new THREE.TorusGeometry(R * 0.235, R * 0.085, 12, 40, yari), m.accent);
  yanma.rotation.y = Math.PI / 2;
  yanma.rotation.z = bas;
  yanma.position.x = -0.24;
  g.add(yanma);
  // HPT — 2 kademe, LPT — 4 kademe, arkaya doğru GENİŞLEYEN
  for (let i = 0; i < 2; i++) g.add(kademe(-0.36 - i * 0.07, R * 0.16, R * (0.26 + 0.03 * i), 34, m.frame, 0.036));
  for (let i = 0; i < 4; i++) g.add(kademe(-0.55 - i * 0.07, R * 0.16, R * (0.28 + 0.035 * i), 32, m.frame, 0.042));

  // Mil (kesitte görünür)
  const mil = cylX(R * 0.055, R * 0.055, 1.34, 16, m.frame);
  mil.position.x = -0.16;
  g.add(mil);

  // Çekirdek nozulu + sıcak koni
  const noz = cylX(R * 0.30, R * 0.26, 0.20, 34, m.metalDS, true);
  noz.position.x = -0.90;
  g.add(noz);
  const plug = cylX(R * 0.04, R * 0.24, 0.28, 30, m.dark);
  plug.position.x = -1.03;
  g.add(plug);

  // Pilon bağlantısı (üstte), motorun nereye asıldığını okutur
  const bag = box(L * 0.5, 0.06, 0.16, m.body);
  bag.position.set(L * 0.10, 0, R * 1.02);
  g.add(bag);

  const root = finalize(g, cutaway ? 'turbofan-kesit' : 'turbofan', scale, m, null, {
    regime: 'yüksek baypas turbofan · seyir M 0,78–0,85',
    why: 'İtki ṁΔv, itki gücü ise ~ṁΔv²/2 ile gider: aynı itkiyi ÇOK havayı AZ hızlandırarak üretmek daha verimlidir. Büyük fanın da, düşük gürültünün de sebebi budur. Fan ucu ses hızını geçemediği için fan ve HPC ayrı millerde döner.',
  });
  root.userData.fan = fan;
  return root;
}

/* ================================================================== */
/* Kayıt: sahnelerin isimle çağırabilmesi için                        */
/* ================================================================== */

export const AIRCRAFT_BUILDERS = Object.freeze({
  airliner:   buildAirliner,
  fighter:    buildFighter,
  delta:      buildDelta,
  waverider:  buildWaverider,
  glider:     buildGlider,
  flyingwing: buildFlyingWing,
});

// Sınıfın TİPİK uçuş zarfı — arketip düzeyinde, belirli bir uçak değil.
// Uçuş rejimi sahnesi hangi bloğu hangi Mach'ta göstereceğine buradan karar
// verir; sayılar sınıfın yayımlanmış tipik değerleridir.
export const AIRCRAFT_ENVELOPE = Object.freeze({
  glider:     { machRange: [0.05, 0.20], altKm: [0.5, 3],   label: 'planör' },
  airliner:   { machRange: [0.20, 0.89], altKm: [9, 12],    label: 'yolcu uçağı' },
  flyingwing: { machRange: [0.20, 0.85], altKm: [10, 15],   label: 'uçan kanat' },
  fighter:    { machRange: [0.30, 2.00], altKm: [0, 18],    label: 'savaş uçağı' },
  delta:      { machRange: [0.30, 2.04], altKm: [15, 18],   label: 'ojiv delta' },
  waverider:  { machRange: [4.50, 10.0], altKm: [25, 40],   label: 'waverider' },
});

/**
 * İsimle kur; bilinmeyen ad basit bir yer tutucuya düşer (sözleşme gereği
 * hiçbir tüketici bu modülün varlığına SERT bağımlı olmamalı, ama ad
 * yanlışsa da patlamamalı).
 */
export function buildAircraft(kind, opts = {}) {
  const fn = AIRCRAFT_BUILDERS[kind];
  if (fn) return fn(opts);
  const g = new THREE.Group();
  const m = makeMats(opts.palette);
  g.add(box(1, 0.12, 0.08, m.body));
  g.add(box(0.2, 0.9, 0.02, m.wing));
  return finalize(g, 'placeholder', opts.scale || 1, m, null, { regime: 'yer tutucu' });
}
