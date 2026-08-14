// ml-layer-blocks.mjs — Sinir ağı KATMAN BLOKLARI kütüphanesi (SAF kurucular).
//
// DONMUŞ SÖZLEŞME (references/ml_layer_blocks.md):
//   • Her kurucu THREE.Group döndürür; bağlama YOK (mount / rAF / doku çekme yok).
//   • Eksenler: +X = İLERİ (veri akış yönü), +Y = yukarı, +Z = derinlik.
//   • Orijin blok MERKEZİNDE. X kalınlığı ≈ 0.25×scale, Y ve Z ≤ 1×scale
//     (bloklar +X ekseninde yan yana dizilebilsin diye).
//   • userData = { ad, tur, girisSekli, cikisSekli, parametre } — parametre
//     TAM SAYI ve DOĞRU (formüller aşağıda, her kurucunun başında).
//   • palette = { body, panel, accent, metal } — varsayılan obsidyen–şampanya
//     (craft-blocks ile AYNI aile; iki kütüphane aynı sahnede yan yana durabilir).
//   • Yalnızca MeshStandardMaterial; SIFIR emissive, doku yok.
//   • Deterministik: seed'li mulberry32. Math.random / Date.now YASAK.
//
// Tüketiciler bu modülü GÖRELİ yolla import eder ve import başarısız olursa
// basit bir yer tutucu Group'a düşmek ZORUNDADIR (bloklar sert bağımlı olamaz).

import * as THREE from 'three';

/* ================================================================== */
/* Sabitler                                                            */
/* ================================================================== */

// Varsayılan palet: obsidyen gövde, koyu hücreler, şampanya vurgusu, saten çelik.
export const ML_PALETTE = Object.freeze({
  body:   0x23252c,
  panel:  0x10151d,
  accent: 0xc9a35c,
  metal:  0x9aa0ab,
});

// ORTAK ÖLÇÜ SÖZLÜĞÜ — "hepsi aynı elden çıkmış" görüntüsünün kaynağı.
// Her blok bu paylardan, bu plaka kalınlığından ve bu köşe yarıçapından kurulur.
export const ML_OLCU = Object.freeze({
  kalinlik: 0.25,   // X bütçesi (veri akış ekseni)
  enBoy:    1.00,   // Y ve Z üst sınırı
  yuz:      0.78,   // standart yüz ölçüsü (dilim/plaka blokları)
  dilim:    0.026,  // özellik haritası dilimi kalınlığı
  plaka:    0.022,  // plaka kalınlığı
  ray:      0.014,  // ray / bant kalınlığı
  kose:     0.045,  // ORTAK köşe yumuşatma yarıçapı
  pay:      0.035,  // ORTAK kenar payı
  araPlaka: 0.12,   // norm/activation ara plakalarının X kalınlığı (bilinçli ince)
});

// girisSekli verilmediğinde kullanılan BELGELENMİŞ varsayılan giriş.
// (Parametre sayısı Cin'e bağlıdır; zincirle() ile gerçek şekil verilince
//  tüm sayılar yeniden hesaplanır.)
export const ML_VARSAYILAN_GIRIS = Object.freeze([32, 32, 3]);

/* ================================================================== */
/* Malzeme dili                                                        */
/* ================================================================== */

// Çerçeve rengi hücre renginden TÜRETİLİR (tek doğruluk kaynağı; palet
// yerinde güncellenirken de aynı fonksiyon kullanılır).
function cerceveRengi(panel) {
  return new THREE.Color(panel).lerp(new THREE.Color(0xffffff), 0.42);
}
// İkincil gövde: dilim yığınında komşu dilimleri ayıran hafif koyu ton.
function govde2Rengi(body, panel) {
  return new THREE.Color(body).lerp(new THREE.Color(panel), 0.34);
}

const MALZEME_KAYDI = new WeakMap();   // kök Group → malzeme kaydı
const HESAP_KAYDI = new WeakMap();     // kök Group → (girisSekli) => {cikis, parametre}

function makeMats(palette) {
  const p = { ...ML_PALETTE, ...(palette || {}) };
  return {
    body:   new THREE.MeshStandardMaterial({ color: p.body, roughness: 0.55, metalness: 0.35 }),
    body2:  new THREE.MeshStandardMaterial({ color: govde2Rengi(p.body, p.panel), roughness: 0.58, metalness: 0.32 }),
    panel:  new THREE.MeshStandardMaterial({ color: p.panel, roughness: 0.38, metalness: 0.55 }),
    frame:  new THREE.MeshStandardMaterial({ color: cerceveRengi(p.panel), roughness: 0.50, metalness: 0.45 }),
    metal:  new THREE.MeshStandardMaterial({ color: p.metal, roughness: 0.30, metalness: 0.85 }),
    accent: new THREE.MeshStandardMaterial({ color: p.accent, roughness: 0.32, metalness: 0.70 }),
    dark:   new THREE.MeshStandardMaterial({ color: 0x07090c, roughness: 0.65, metalness: 0.25 }),
  };
}

// Yerinde palet güncellemesi (webgl-scene-contract §2: görünür geometri
// yeniden KURULMAZ). applyLayerPalette(root, palette) → boolean
export function applyLayerPalette(root, palette) {
  const m = MALZEME_KAYDI.get(root);
  if (!m) return false;
  const p = { ...ML_PALETTE, ...(palette || {}) };
  m.body.color.set(p.body);
  m.body2.color.copy(govde2Rengi(p.body, p.panel));   // TÜRETİLMİŞ
  m.panel.color.set(p.panel);
  m.frame.color.copy(cerceveRengi(p.panel));          // TÜRETİLMİŞ
  m.metal.color.set(p.metal);
  m.accent.color.set(p.accent);
  // m.dark palete bağlı değildir (sabit boşluk rengi) — dokunulmaz.
  return true;
}

/* ================================================================== */
/* Geometri yardımcıları (hepsi deterministik)                         */
/* ================================================================== */

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function box(x, y, z, mat) {
  return new THREE.Mesh(new THREE.BoxGeometry(x, y, z), mat);
}

// ORTAK PLAKA: köşeleri yumuşatılmış, pahlı, X ekseninde kalınlığı olan levha.
// Tüm bloklar bu tek kurucudan gelir — ortak köşe yarıçapı ve ortak pah, kütüphanenin
// "aynı elden çıkmış" hissinin taşıyıcısıdır. (yBoy → Y, zBoy → Z, kalinlik → X)
function plakaGeo(yBoy, zBoy, kalinlik, r) {
  const bs = Math.max(Math.min(kalinlik * 0.2, 0.006, yBoy * 0.15, zBoy * 0.15), 0.0006);
  const derinlik = Math.max(kalinlik - 2 * bs, 0.001);
  const w = Math.max(zBoy - 2 * bs, 0.004);
  const h = Math.max(yBoy - 2 * bs, 0.004);
  const rr = Math.max(Math.min(r === undefined ? ML_OLCU.kose : r, w / 2 - 0.001, h / 2 - 0.001), 0.001);
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + rr, -h / 2);
  s.lineTo(w / 2 - rr, -h / 2);
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + rr);
  s.lineTo(w / 2, h / 2 - rr);
  s.quadraticCurveTo(w / 2, h / 2, w / 2 - rr, h / 2);
  s.lineTo(-w / 2 + rr, h / 2);
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - rr);
  s.lineTo(-w / 2, -h / 2 + rr);
  s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + rr, -h / 2);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: derinlik, bevelEnabled: true,
    bevelThickness: bs, bevelSize: bs, bevelSegments: 2, curveSegments: 5,
  });
  geo.translate(0, 0, -derinlik / 2);   // kalınlık merkezi orijine
  geo.rotateY(Math.PI / 2);             // ekstrüzyon ekseni → +X
  return geo;
}

function plaka(yBoy, zBoy, kalinlik, mat, r) {
  return new THREE.Mesh(plakaGeo(yBoy, zBoy, kalinlik, r), mat);
}

// İki nokta arasında dikme (strut) — huni kenarları, kafes çubukları.
function strut(a, b, r, mat, seg = 8) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(V3(0, 1, 0), dir.normalize());
  return mesh;
}

// Hücre ızgarası: YZ düzleminde satır×sütun koyu hücre, ORTAK paya göre boşluklu.
// Görüntü düzlemi ("ince ızgara"), çekirdek karesi ve norm olukları bunu kullanır.
function hucreIzgara(yBoy, zBoy, satir, sutun, mat, kalinlik = 0.008, bosOran = 0.055) {
  const g = new THREE.Group();
  const bos = Math.min(yBoy, zBoy) * bosOran;
  const ch = (yBoy - bos * (satir + 1)) / satir;
  const cw = (zBoy - bos * (sutun + 1)) / sutun;
  if (ch <= 0 || cw <= 0) return g;
  for (let i = 0; i < satir; i++) {
    for (let j = 0; j < sutun; j++) {
      const c = box(kalinlik, ch, cw, mat);
      c.position.set(0, -yBoy / 2 + bos + ch / 2 + i * (ch + bos), -zBoy / 2 + bos + cw / 2 + j * (cw + bos));
      g.add(c);
    }
  }
  return g;
}

// Kenar çerçevesi: dört ince çubuktan bir ÇERÇEVE (dolu plaka DEĞİL).
// Ara plakalarda dolu metal bilezik kullanıldığında levhanın tüm yüzünü
// kaplayıp bloğu "parlak metal pano" yapıyordu; çerçeve yalnız kenarı çizer.
function kenarCercevesi(yBoy, zBoy, x, kalinlik, bar, mat) {
  const g = new THREE.Group();
  for (const sy of [1, -1]) {
    const b = box(kalinlik, bar, zBoy, mat);
    b.position.set(x, sy * (yBoy - bar) / 2, 0);
    g.add(b);
  }
  for (const sz of [1, -1]) {
    const b = box(kalinlik, yBoy - 2 * bar, bar, mat);
    b.position.set(x, 0, sz * (zBoy - bar) / 2);
    g.add(b);
  }
  return g;
}

// Kısaltma işareti ("…"): üç küçük küp. Ekranı boğmadan "devamı var" der.
function uctNokta(mat, s = 1) {
  const g = new THREE.Group();
  for (let k = -1; k <= 1; k++) {
    const d = box(0.014 * s, 0.014 * s, 0.014 * s, mat);
    d.position.y = k * 0.032 * s;
    g.add(d);
  }
  return g;
}

// ORTAK MONTAJ DİLİ: her bloğun altında aynı metal ayak. Bloklar tek tek
// bakıldığında da, sıraya dizildiğinde de aynı taban çizgisini paylaşır.
function montajDili(m, xBoy, altY, zBoy = 0.20) {
  const g = new THREE.Group();
  // Ayak GÖVDE renginde tutulur: metal olsaydı (metalness 0.85) zemini
  // aynalayıp her blokta vurgu kadar parlak bir şerit olarak okunurdu.
  const dil = box(Math.max(xBoy * 0.66, 0.06), 0.026, zBoy, m.body2);
  dil.position.set(0, altY - 0.013, 0);
  g.add(dil);
  const kanal = box(Math.max(xBoy * 0.30, 0.03), 0.012, zBoy * 0.62, m.metal);
  kanal.position.set(0, altY - 0.030, 0);
  g.add(kanal);
  return g;
}

/* ================================================================== */
/* Şekil / parametre aritmetiği                                        */
/* ================================================================== */

function dizi(s) { return Array.isArray(s) ? s.map((v) => Math.max(1, Math.round(v))) : [...ML_VARSAYILAN_GIRIS]; }
function kanalSayisi(s) { return s.length >= 3 ? s[2] : s[s.length - 1]; }
function duzBoyut(s) { return s.reduce((a, b) => a * b, 1); }
// 'same' dolgu: H' = ceil(H / adim) — sunumlarda okunan standart varsayım.
function ayniDolgu(n, adim) { return Math.max(1, Math.ceil(n / adim)); }
function gecerliDolgu(n, k, adim) { return Math.max(1, Math.floor((n - k) / adim) + 1); }

/* ================================================================== */
/* Bitirici                                                            */
/* ================================================================== */
//
// Ölçüm nesne EBEVEYNE EKLENMEDEN yapılır: Box3.setFromObject DÜNYA uzayında
// ölçer; kök zaten sahnedeyse kutuya sahnenin dönüşümü karışır ve merkezleme
// bozulur (bu tuzak bu kütüphanede bir kez canımızı yaktı).
function finalize(inner, { tur, ad, scale, m, hesap, girisSekli }) {
  inner.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(inner);
  const size = bb.getSize(new THREE.Vector3());
  const center = bb.getCenter(new THREE.Vector3());

  // Güvenlik ağı: Y/Z sözleşme sınırını (1×scale) aşan bir tasarım varsa
  // blok oranları korunarak küçültülür (sessiz taşma yerine bilinçli sığdırma).
  const tasma = Math.max(size.y / ML_OLCU.enBoy, size.z / ML_OLCU.enBoy, 1);
  const s = scale / tasma;
  inner.scale.setScalar(s);
  inner.position.copy(center).multiplyScalar(-s);

  const root = new THREE.Group();
  root.name = `mlblok:${tur}`;
  root.add(inner);

  const giris = dizi(girisSekli);
  const { cikis, parametre } = hesap(giris);
  let parca = 0;
  inner.traverse((o) => { if (o.isMesh) parca++; });
  root.userData = {
    ad, tur,
    girisSekli: giris,
    cikisSekli: cikis,
    parametre: Math.round(parametre),
    preset: 'ml-layer-blocks',
    parca,
    olcu: { x: size.x * s, y: size.y * s, z: size.z * s },
  };
  MALZEME_KAYDI.set(root, m);
  HESAP_KAYDI.set(root, hesap);
  return root;
}

/* ================================================================== */
/* 1) GİRDİ — [H,W,C] görüntü düzlemi | [N] vektör                     */
/*    Parametre: 0 (öğrenilen ağırlık yok)                             */
/* ================================================================== */

export function buildInput({ sekil = [32, 32, 3], scale = 1, palette } = {}) {
  const m = makeMats(palette);
  const g = new THREE.Group();
  const s = dizi(sekil);
  const goruntu = s.length >= 3;

  if (goruntu) {
    // Görüntü düzlemi: en-boy oranı korunan levhalar; C kanalı kadar (≤4)
    // hafif kaydırılmış düzlem — RGB üç ayrı düzlem olarak okunur.
    const [H, W, C] = s;
    const uzun = Math.max(H, W);
    const yBoy = ML_OLCU.yuz * (H / uzun);
    const zBoy = ML_OLCU.yuz * (W / uzun);
    const n = Math.min(Math.max(C, 1), 4);
    const adim = n > 1 ? 0.072 : 0;
    const x0 = -adim * (n - 1) / 2;
    for (let i = 0; i < n; i++) {
      const lev = plaka(yBoy, zBoy, ML_OLCU.plaka, i === n - 1 ? m.body : m.body2);
      lev.position.x = x0 + i * adim;
      g.add(lev);
    }
    // Arka taşıyıcı: yığını tutan metal sırt plakası.
    const sirtP = plaka(yBoy + 0.04, zBoy + 0.04, 0.014, m.metal);
    sirtP.position.x = x0 - 0.026;
    g.add(sirtP);
    // İnce ızgara: yalnız ÖN (+X) düzlemin yüzünde — piksel ağı okunur, yığın boğulmaz.
    // Açık ÇERÇEVE altlık + koyu hücreler (craft-blocks'un iki tonlu panel dili).
    const altlik = plaka(yBoy - 2 * ML_OLCU.pay + 0.02, zBoy - 2 * ML_OLCU.pay + 0.02, 0.010, m.frame, 0.02);
    altlik.position.x = x0 + (n - 1) * adim + ML_OLCU.plaka / 2 + 0.004;
    g.add(altlik);
    // İnce dikişli ızgara (boşluk oranı 0.028): açık altlık yalnız PİKSEL
    // ARALARINDA görünür — geniş boşlukta blok, ailenin en parlak yüzeyi oluyordu.
    const izg = hucreIzgara(yBoy - 2 * ML_OLCU.pay, zBoy - 2 * ML_OLCU.pay, 8, 8, m.panel, 0.008, 0.028);
    izg.position.x = altlik.position.x + 0.008;
    g.add(izg);
    // TEK VURGU: köşe köşebendi — "kaynak görüntü" işareti (0,0 pikseli).
    const kx = izg.position.x + 0.004;
    const kol1 = box(0.008, 0.012, zBoy * 0.30, m.accent);
    kol1.position.set(kx, yBoy / 2 - 0.012, -zBoy / 2 + zBoy * 0.15 + 0.010);
    const kol2 = box(0.008, yBoy * 0.30, 0.012, m.accent);
    kol2.position.set(kx, yBoy / 2 - yBoy * 0.15 - 0.010, -zBoy / 2 + 0.012);
    g.add(kol1, kol2);
    if (C > 4) g.add(Object.assign(uctNokta(m.metal), { position: V3(x0 - 0.035, 0, zBoy / 2 + 0.03) }));
    g.add(montajDili(m, adim * (n - 1) + ML_OLCU.plaka, -yBoy / 2, zBoy * 0.28));
  } else {
    // Vektör: çubuk dizisi. Uzunluklar seed'li ve deterministiktir (sunum
    // boyunca AYNI kalır); yalnız "bir öznitelik vektörü" imgesini kurar.
    const N = s[s.length - 1];
    const n = Math.min(N, 10);
    const rnd = mulberry32(2024 + N);
    const yAdim = 0.072;
    const y0 = -yAdim * (n - 1) / 2;
    const sirt = plaka(yAdim * n + 0.06, 0.05, 0.05, m.body);
    sirt.position.z = -0.34;
    g.add(sirt);
    let enUzunIdx = 0, enUzun = 0;
    const boylar = [];
    for (let i = 0; i < n; i++) {
      const L = 0.18 + rnd() * 0.44;
      boylar.push(L);
      if (L > enUzun) { enUzun = L; enUzunIdx = i; }
    }
    for (let i = 0; i < n; i++) {
      const L = boylar[i];
      const cub = box(0.09, 0.044, L, i === enUzunIdx ? m.accent : m.body2);  // TEK VURGU: en büyük bileşen
      cub.position.set(0, y0 + i * yAdim, -0.31 + L / 2);
      g.add(cub);
      const uc = box(0.10, 0.052, 0.010, m.metal);
      uc.position.set(0, y0 + i * yAdim, -0.31 + L);
      g.add(uc);
    }
    if (N > n) {
      const nk = uctNokta(m.metal);
      nk.position.set(0, y0 + n * yAdim + 0.02, -0.26);
      g.add(nk);
    }
    g.add(montajDili(m, 0.10, y0 - 0.04, 0.22));
  }

  const ad = goruntu ? `Girdi ${s[0]}×${s[1]}×${s[2]}` : `Girdi ${s[s.length - 1]}`;
  return finalize(g, {
    tur: 'input', ad, scale, m, girisSekli: s,
    // Girdi katmanı şekli DEĞİŞTİRMEZ ve parametresi YOKTUR.
    hesap: (giris) => ({ cikis: [...giris], parametre: 0 }),
  });
}

/* ================================================================== */
/* 2) EVRİŞİM — dilim yığını + çekirdek karesi                         */
/*    Parametre: (kH · kW · Cin + 1) · filtre                          */
/* ================================================================== */

export function buildConv({
  filtre = 32, cekirdek = [3, 3], adim = 1, scale = 1, palette,
  girisSekli = ML_VARSAYILAN_GIRIS, dolgu = 'ayni',
} = {}) {
  const m = makeMats(palette);
  const g = new THREE.Group();
  const F = Math.max(1, Math.round(filtre));
  const kH = Math.max(1, Math.round(cekirdek[0] ?? 3));
  const kW = Math.max(1, Math.round(cekirdek[1] ?? kH));
  const S = Math.max(1, Math.round(adim));

  // Gösterilen dilim sayısı filtre sayısıyla LOGARİTMİK büyür: 8→3 … 128→7.
  // Derinlik "kaç özellik haritası" bilgisini taşır, sayıyı taklit etmez.
  const n = Math.min(7, Math.max(3, 3 + Math.round(Math.log2(F / 8))));
  const yuz = 0.74;
  const yayilim = 0.19;                       // dilim yığınının X boyu
  const pitch = n > 1 ? yayilim / (n - 1) : 0;
  const x0 = -yayilim / 2;
  // Dilimler ÇAPRAZ kaydırılarak istiflenir (kaydırılmış deste): yığın
  // cepheden bakıldığında da sayılabilir — düz istifte ön dilim hepsini örter.
  const kay = 0.020;
  const orta = (n - 1) / 2;
  for (let i = 0; i < n; i++) {
    const dil = plaka(yuz, yuz, ML_OLCU.dilim, i % 2 ? m.body2 : m.body);
    dil.position.set(x0 + i * pitch, (orta - i) * kay, (i - orta) * kay);
    g.add(dil);
  }
  // Ön dilimin metal kenar rayı — yığının "ön yüzü" belli olsun.
  const onX = x0 + (n - 1) * pitch;
  const onY = (orta - (n - 1)) * kay;
  const onZ = ((n - 1) - orta) * kay;
  for (const sy of [1, -1]) {
    const ray = box(ML_OLCU.dilim * 1.1, ML_OLCU.ray, yuz * 0.82, m.metal);
    ray.position.set(onX, onY + sy * (yuz / 2 - 0.02), onZ);
    g.add(ray);
  }

  // ÇEKİRDEK (kernel): ön yüzün sol-üstüne oturan kH×kW hücreli kare.
  // TEK VURGU şampanya çerçevedir — "işlem penceresi" burasıdır.
  const kBoy = 0.22;
  const kx = onX + ML_OLCU.dilim / 2 + 0.012;
  const cer = plaka(kBoy, kBoy, 0.016, m.accent, 0.018);
  cer.position.set(kx, onY + yuz / 2 - kBoy / 2 - 0.035, onZ - yuz / 2 + kBoy / 2 + 0.035);
  g.add(cer);
  const kHuc = hucreIzgara(kBoy - 0.042, kBoy - 0.042, kH, kW, m.panel, 0.012);
  kHuc.position.set(kx + 0.012, cer.position.y, cer.position.z);
  g.add(kHuc);

  // ADIM (stride): ön yüzün alt kenarında adım kadar çentik — 1'de tek çentik,
  // 2'de iki çentik arası GERÇEK adım mesafesi kadar açılır.
  const cAdim = 0.055;
  for (let k = 0; k < Math.min(S, 4); k++) {
    const cent = box(0.014, 0.020, 0.030, m.metal);
    cent.position.set(onX + 0.012, onY - yuz / 2 + 0.038, onZ - yuz / 2 + 0.07 + k * cAdim);
    g.add(cent);
  }
  g.add(montajDili(m, yayilim, onY - yuz / 2, 0.22));

  const ad = `Evrişim ${F}@${kH}×${kW}${S > 1 ? ` adım ${S}` : ''}`;
  return finalize(g, {
    tur: 'conv', ad, scale, m, girisSekli,
    hesap: (giris) => {
      const gs = giris.length >= 3 ? giris : [1, giris[giris.length - 1], 1];
      const Cin = kanalSayisi(gs);
      const H = dolgu === 'gecerli' ? gecerliDolgu(gs[0], kH, S) : ayniDolgu(gs[0], S);
      const W = dolgu === 'gecerli' ? gecerliDolgu(gs[1], kW, S) : ayniDolgu(gs[1], S);
      return { cikis: [H, W, F], parametre: (kH * kW * Cin + 1) * F };
    },
  });
}

/* ================================================================== */
/* 3) HAVUZLAMA — küçülten kademe; maks vs ort BİÇİMDEN okunur         */
/*    Parametre: 0                                                     */
/* ================================================================== */

export function buildPool({ tip = 'max', boyut = [2, 2], scale = 1, palette, girisSekli = ML_VARSAYILAN_GIRIS } = {}) {
  const m = makeMats(palette);
  const g = new THREE.Group();
  const bH = Math.max(1, Math.round(boyut[0] ?? 2));
  const bW = Math.max(1, Math.round(boyut[1] ?? bH));
  const maks = tip !== 'ort' && tip !== 'avg' && tip !== 'ortalama';

  // Üç kademe: +X'e doğru küçülen dilimler (veri akışıyla aynı yön).
  const boylar = [0.78, 0.60, 0.44];
  const xler = [-0.070, 0.0, 0.070];
  for (let i = 0; i < 3; i++) {
    const dil = plaka(boylar[i], boylar[i], ML_OLCU.dilim, i === 1 ? m.body2 : m.body);
    dil.position.x = xler[i];
    g.add(dil);
  }
  // Huni kenarları: ilk dilimin köşelerinden son dilimin köşelerine dikmeler.
  for (const [sy, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const a = V3(xler[0], sy * boylar[0] / 2 * 0.95, sz * boylar[0] / 2 * 0.95);
    const b = V3(xler[2], sy * boylar[2] / 2 * 0.95, sz * boylar[2] / 2 * 0.95);
    g.add(strut(a, b, 0.008, m.metal));
  }
  // Pencere ızgarası: ilk (en büyük) dilimin ÖN yüzünde bH×bW hücre —
  // "kaç pikselden biri" okunur. Orta dilimin dışında kalan KÖŞEYE konur,
  // yoksa akış yönünde önündeki dilim onu tamamen örter.
  const pBoy = 0.17;
  const pk = boylar[0] / 2 - pBoy / 2 - 0.035;
  // Koyu yuva + açık hücreler: pencere okunur ama VURGUDAN parlak olmaz
  // (açık zeminli çözüm, seçilen hücrenin şampanya vurgusunu bastırıyordu).
  const pAlt = plaka(pBoy + 0.02, pBoy + 0.02, 0.008, m.panel, 0.016);
  pAlt.position.set(xler[0] + ML_OLCU.dilim / 2 + 0.006, pk, -pk);
  g.add(pAlt);
  const pen = hucreIzgara(pBoy, pBoy, bH, bW, m.metal, 0.010);
  pen.position.set(pAlt.position.x + 0.008, pk, -pk);
  g.add(pen);

  if (maks) {
    // MAKS: tek bir hücre seçilir → sivri tepe (dörtgen koni) + seçili küp.
    const tepe = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.095, 4), m.metal);
    tepe.geometry.rotateZ(-Math.PI / 2);                 // uç +X'e
    tepe.position.x = xler[2] + 0.052;
    g.add(tepe);
    const sec = box(0.030, 0.075, 0.075, m.accent);      // TEK VURGU: seçilen hücre
    sec.position.set(xler[2] + ML_OLCU.dilim / 2 + 0.014, 0.075, -0.075);
    g.add(sec);
  } else {
    // ORT: hiçbir hücre seçilmez → tüm yüzü kaplayan DÜZ kapak (ortalama).
    const kapak = plaka(0.44, 0.44, 0.020, m.accent);    // TEK VURGU: ortalama kapağı
    kapak.position.x = xler[2] + ML_OLCU.dilim / 2 + 0.012;
    g.add(kapak);
    const cizgi = box(0.026, 0.012, 0.34, m.metal);      // ortalama çizgisi
    cizgi.position.x = kapak.position.x + 0.014;
    g.add(cizgi);
  }
  g.add(montajDili(m, 0.20, -boylar[0] / 2, 0.20));

  const ad = `Havuzlama ${maks ? 'maks' : 'ort'} ${bH}×${bW}`;
  return finalize(g, {
    tur: 'pool', ad, scale, m, girisSekli,
    hesap: (giris) => {
      const gs = giris.length >= 3 ? giris : [1, 1, giris[giris.length - 1]];
      return { cikis: [Math.max(1, Math.ceil(gs[0] / bH)), Math.max(1, Math.ceil(gs[1] / bW)), gs[2]], parametre: 0 };
    },
  });
}

/* ================================================================== */
/* 4) TAM BAĞLI — nöron sütunu (çok birimde temsilî grup + "…")        */
/*    Parametre: (Cin + 1) · birim                                     */
/* ================================================================== */

export function buildDense({ birim = 64, scale = 1, palette, girisSekli = ML_VARSAYILAN_GIRIS } = {}) {
  const m = makeMats(palette);
  const g = new THREE.Group();
  const U = Math.max(1, Math.round(birim));
  const kisalt = U > 7;
  const n = kisalt ? 6 : U;                    // kısaltmada 3 üst + 3 alt nöron

  // Sırt plakası + omurga: nöronların dizildiği taşıyıcı.
  const arka = plaka(0.86, 0.26, 0.020, m.panel);
  arka.position.x = -0.082;
  g.add(arka);
  const omurga = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.84, 12), m.metal);
  omurga.position.x = -0.042;
  g.add(omurga);
  // TEK VURGU: omurga başlıkları (üst/alt kapak diskleri).
  for (const sy of [1, -1]) {
    const kap = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.018, 16), m.accent);
    kap.position.set(-0.042, sy * 0.428, 0);
    g.add(kap);
  }

  const yAdim = kisalt ? 0.108 : Math.min(0.115, 0.78 / Math.max(n, 1));
  const yerler = [];
  if (kisalt) {
    for (let i = 0; i < 3; i++) yerler.push(0.38 - i * yAdim);
    for (let i = 0; i < 3; i++) yerler.push(-0.38 + i * yAdim);
  } else {
    const y0 = -yAdim * (n - 1) / 2;
    for (let i = 0; i < n; i++) yerler.push(y0 + i * yAdim);
  }
  for (const y of yerler) {
    const nor = new THREE.Mesh(new THREE.SphereGeometry(0.046, 20, 14), m.body2);
    nor.position.set(0.004, y, 0);
    g.add(nor);
    const bilezik = new THREE.Mesh(new THREE.TorusGeometry(0.049, 0.008, 8, 20), m.metal);
    bilezik.rotation.y = Math.PI / 2;          // halka normali +X
    bilezik.position.set(-0.010, y, 0);
    g.add(bilezik);
  }
  if (kisalt) {
    const nk = uctNokta(m.metal, 1.2);
    nk.position.set(0.004, 0, 0);
    g.add(nk);
  }
  // Çıkış barası: nöronların toplandığı ince ray (+X yüzü).
  // (Tam boy metal bara, nöron sütununu örten parlak bir duvar gibi okunuyordu:
  //  kısaltıldı ve inceltildi — artık toplayıcı bir RAY.)
  const bara = box(0.014, 0.62, 0.032, m.metal);
  bara.position.x = 0.104;
  g.add(bara);
  for (const sy of [1, -1]) {                  // barayı omurgaya bağlayan kollar
    g.add(strut(V3(0.104, sy * 0.30, 0), V3(0.010, sy * 0.30, 0), 0.008, m.metal, 8));
  }
  g.add(montajDili(m, 0.20, -0.46, 0.18));

  const ad = `Tam Bağlı ${U}`;
  return finalize(g, {
    tur: 'dense', ad, scale, m, girisSekli,
    // 3B giriş verilirse örtük düzleştirme uygulanır (Cin = H·W·C).
    hesap: (giris) => ({ cikis: [U], parametre: (duzBoyut(giris) + 1) * U }),
  });
}

/* ================================================================== */
/* 5) DÜZLEŞTİRME — dilimlerin tek şeride AÇILMASI                     */
/*    Parametre: 0                                                     */
/* ================================================================== */

export function buildFlatten({ scale = 1, palette, girisSekli = ML_VARSAYILAN_GIRIS } = {}) {
  const m = makeMats(palette);
  const g = new THREE.Group();

  // Açılma jesti: dilimler MENTEŞE kenarı sabit kalarak (z = mentese) döner;
  // uzak kenar geriye süpürür ve dilim gitgide "kenarına gelir". Merkezden
  // döndürülselerdi simetrik bir yelpaze (çiçek) çıkardı — açılma okunmazdı.
  const mentese = -0.29;
  const evre = [
    { x: -0.045, aci: 0.00, y: 0.62, z: 0.58 },
    { x: 0.005, aci: 0.38, y: 0.72, z: 0.38 },
    { x: 0.050, aci: 0.78, y: 0.82, z: 0.21 },
  ];
  for (let i = 0; i < evre.length; i++) {
    const e = evre[i];
    const kol = new THREE.Group();
    kol.position.set(e.x, 0, mentese);
    kol.rotation.y = -e.aci;                     // uzak kenar −X'e süpürür
    const dil = plaka(e.y, e.z, ML_OLCU.dilim, i === 1 ? m.body2 : m.body);
    dil.position.z = e.z / 2;                    // menteşe kenarı sabit
    kol.add(dil);
    g.add(kol);
  }
  // Son hâl: tek şerit — hücreler Y ekseninde tek sıra (1B vektör).
  const seritY = 0.88;
  const serit = plaka(seritY, 0.09, ML_OLCU.plaka, m.frame, 0.02);
  serit.position.set(0.095, 0, mentese + 0.055);
  g.add(serit);
  const huc = hucreIzgara(seritY - 0.05, 0.055, 9, 1, m.panel, 0.008);
  huc.position.set(0.095 + ML_OLCU.plaka / 2 + 0.003, 0, mentese + 0.055);
  g.add(huc);
  // TEK VURGU: şeridin dikişi — "buradan açıldı" izi.
  // (Tam boy şampanya çubuk, parlak şeritle birlikte iki baskın öğe yapıyordu:
  //  vurgu KISA bir dikiş işaretine indirildi — blok başına tek, ölçülü vurgu.)
  const dikis = box(0.010, 0.20, 0.014, m.accent);
  dikis.position.set(0.095 + ML_OLCU.plaka / 2 + 0.006, 0, mentese + 0.055 + 0.052);
  g.add(dikis);
  g.add(montajDili(m, 0.20, -seritY / 2, 0.30));

  return finalize(g, {
    tur: 'flatten', ad: 'Düzleştirme', scale, m, girisSekli,
    hesap: (giris) => ({ cikis: [duzBoyut(giris)], parametre: 0 }),
  });
}

/* ================================================================== */
/* 6) NORMALLEŞTİRME — ince ara plaka; tip OLUK YÖNÜNDEN okunur        */
/*    Parametre: 2 · C  (ölçek γ + kaydırma β)                         */
/* ================================================================== */

const NORM_AD = { batch: 'Toplu Normalleştirme', layer: 'Katman Normalleştirme', group: 'Grup Normalleştirme', instance: 'Örnek Normalleştirme' };

export function buildNorm({ tip = 'batch', scale = 1, palette, girisSekli = ML_VARSAYILAN_GIRIS } = {}) {
  const m = makeMats(palette);
  const g = new THREE.Group();
  const t = NORM_AD[tip] ? tip : 'batch';
  const yuz = 0.76;

  // Ara plaka sandviçi: gövde levhası + iki metal kenar ÇERÇEVESİ + açık iç alan.
  const gov = plaka(yuz, yuz, 0.056, m.body);
  g.add(gov);
  for (const sx of [1, -1]) {
    g.add(kenarCercevesi(yuz + 0.030, yuz + 0.030, sx * 0.040, 0.012, 0.045, m.metal));
  }
  const alan = plaka(yuz - 0.10, yuz - 0.10, 0.010, m.frame, 0.03);
  alan.position.x = 0.034;
  g.add(alan);
  // Oluklar: hangi eksende istatistik alındığını BİÇİM söyler.
  //  batch  → yatay oluklar (kanal başına, örnekler boyunca)
  //  layer  → dikey oluklar (örnek başına, kanallar boyunca)
  //  group  → 2×2 blok (kanal grupları)
  //  instance → tek merkezî kare (örnek×kanal başına)
  const yx = 0.048;
  let oluk;
  if (t === 'batch') oluk = hucreIzgara(yuz - 0.14, yuz - 0.14, 5, 1, m.panel, 0.012);
  else if (t === 'layer') oluk = hucreIzgara(yuz - 0.14, yuz - 0.14, 1, 5, m.panel, 0.012);
  else if (t === 'group') oluk = hucreIzgara(yuz - 0.14, yuz - 0.14, 2, 2, m.panel, 0.012);
  else oluk = hucreIzgara((yuz - 0.14) * 0.5, (yuz - 0.14) * 0.5, 1, 1, m.panel, 0.012);
  oluk.position.x = yx;
  g.add(oluk);
  // TEK VURGU: sıfır ortalama ekseni — olukları DİK kesen ince şampanya çizgi.
  const eksen = (t === 'layer')
    ? box(0.012, 0.016, yuz - 0.10, m.accent)
    : box(0.012, yuz - 0.10, 0.016, m.accent);
  eksen.position.x = yx + 0.012;
  g.add(eksen);
  g.add(montajDili(m, ML_OLCU.araPlaka, -(yuz + 0.035) / 2, 0.18));

  return finalize(g, {
    tur: 'norm', ad: NORM_AD[t], scale, m, girisSekli,
    // Öğrenilen ölçek (γ) ve kaydırma (β): kanal başına 2 parametre.
    hesap: (giris) => ({ cikis: [...giris], parametre: 2 * kanalSayisi(giris) }),
  });
}

/* ================================================================== */
/* 7) ETKİNLEŞTİRME — ince ara plaka + türüne özgü EĞRİ kabartması     */
/*    Parametre: 0                                                     */
/* ================================================================== */

const AKTIVASYON = {
  relu:    { ad: 'ReLU',      f: (x) => Math.max(0, x) },
  leaky:   { ad: 'LeakyReLU', f: (x) => (x > 0 ? x : 0.15 * x) },
  gelu:    { ad: 'GELU',      f: (x) => 0.5 * x * (1 + Math.tanh(0.7978845608 * (x + 0.044715 * x * x * x))) },
  silu:    { ad: 'SiLU',      f: (x) => x / (1 + Math.exp(-x)) },
  tanh:    { ad: 'tanh',      f: (x) => Math.tanh(x) },
  sigmoid: { ad: 'Sigmoid',   f: (x) => 1 / (1 + Math.exp(-x)) - 0.5 },
};

export function buildActivation({ tip = 'relu', scale = 1, palette, girisSekli = ML_VARSAYILAN_GIRIS } = {}) {
  const m = makeMats(palette);
  const g = new THREE.Group();
  const t = AKTIVASYON[tip] ? tip : 'relu';
  const yuz = 0.76;

  const gov = plaka(yuz, yuz, 0.056, m.body);
  g.add(gov);
  for (const sx of [1, -1]) {
    g.add(kenarCercevesi(yuz + 0.030, yuz + 0.030, sx * 0.040, 0.012, 0.045, m.metal));
  }
  const alan = plaka(yuz - 0.10, yuz - 0.10, 0.010, m.frame, 0.03);
  alan.position.x = 0.034;
  g.add(alan);
  // Eksen haçı (okunurluk referansı): eğri buna göre okunur.
  const yx = 0.050;
  const ekY = box(0.010, yuz - 0.16, 0.010, m.panel);
  ekY.position.set(yx, 0, 0);
  const ekZ = box(0.010, 0.010, yuz - 0.16, m.panel);
  ekZ.position.set(yx, 0, 0);
  g.add(ekY, ekZ);
  // TEK VURGU: eğrinin kendisi — 17 küçük şampanya kabartma, f(x) örneklemi.
  // Domain −2.6…2.6, görsel yükseklik ±0.26 (kırpılır; eğri türü siluetten okunur).
  const N = 17;
  const zYari = (yuz - 0.18) / 2;
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1);
    const x = -2.6 + u * 5.2;
    const y = Math.max(-0.26, Math.min(0.26, AKTIVASYON[t].f(x) * 0.115));
    const nokta = box(0.016, 0.030, 0.030, m.accent);
    // Eğrinin ARTAN x yönü blok −Z'sidir: vitrinin standart 3/4 duruşunda
    // (yaw ≈ −0.9 rad) eksen ekranda SOLDAN SAĞA artar. Ters çevrilirse
    // ReLU aynalanmış görünür — izleyici yanlış fonksiyon okur.
    nokta.position.set(yx + 0.012, y, zYari - u * 2 * zYari);
    g.add(nokta);
  }
  g.add(montajDili(m, ML_OLCU.araPlaka, -(yuz + 0.035) / 2, 0.18));

  return finalize(g, {
    tur: 'activation', ad: `Etkinleştirme ${AKTIVASYON[t].ad}`, scale, m, girisSekli,
    hesap: (giris) => ({ cikis: [...giris], parametre: 0 }),
  });
}

/* ================================================================== */
/* 8) DİKKAT — kafa sayısı kadar PARALEL şerit                         */
/*    Parametre: 4·(d² + d)  (Q,K,V,O izdüşümleri, bias'lı)            */
/* ================================================================== */

export function buildAttention({ kafa = 4, scale = 1, palette, girisSekli = [64] } = {}) {
  const m = makeMats(palette);
  const g = new THREE.Group();
  const K = Math.max(1, Math.round(kafa));
  const n = Math.min(K, 8);
  const kisalt = K > n;

  const zAlan = kisalt ? 0.72 : 0.84;
  const bos = 0.022;
  const w = (zAlan - bos * (n - 1)) / n;
  const z0 = -zAlan / 2 + w / 2;
  const yBoy = 0.80;
  for (let i = 0; i < n; i++) {
    const z = z0 + i * (w + bos);
    // Şeritler hafif yelpazelenir: dış kafalar X'te geride — paralellik derinlikte okunur.
    const c = (n - 1) / 2;
    const x = -0.070 * (c === 0 ? 0 : Math.abs(i - c) / c);
    const serit = plaka(yBoy, w, 0.030, i % 2 ? m.body2 : m.body, 0.018);
    serit.position.set(x, 0, z);
    g.add(serit);
    // Q, K, V tırnakları: her şeridin yüzünde üç küçük metal dil.
    for (const y of [0.26, 0.0, -0.26]) {
      const tirnak = box(0.014, 0.055, w * 0.52, m.metal);
      tirnak.position.set(x + 0.022, y, z);
      g.add(tirnak);
    }
  }
  if (kisalt) {
    const nk = uctNokta(m.metal, 1.2);
    nk.rotation.z = Math.PI / 2;                 // noktalar Z ekseninde dizilsin
    nk.position.set(-0.02, 0, zAlan / 2 + 0.055);
    g.add(nk);
  }
  // TEK VURGU: birleştirme (concat) barası — tüm kafaları üstten toplayan ray.
  const bara = box(0.05, 0.030, zAlan + 0.06, m.accent);
  bara.position.set(-0.010, yBoy / 2 + 0.030, 0);
  g.add(bara);
  const cikisRay = box(0.036, 0.075, 0.075, m.metal);
  cikisRay.position.set(0.070, yBoy / 2 + 0.030, 0);
  g.add(cikisRay);
  g.add(strut(V3(-0.010, yBoy / 2 + 0.030, 0), V3(0.070, yBoy / 2 + 0.030, 0), 0.012, m.metal, 8));
  g.add(montajDili(m, 0.19, -yBoy / 2, 0.22));

  return finalize(g, {
    tur: 'attention', ad: `Dikkat ${K} kafa`, scale, m, girisSekli,
    // d = model boyutu (girişin son ekseni). Q,K,V,O: 4 adet d×d ağırlık + d bias.
    hesap: (giris) => {
      const d = giris[giris.length - 1];
      return { cikis: [...giris], parametre: 4 * (d * d + d) };
    },
  });
}

/* ================================================================== */
/* 9) ARTIK BAĞLANTI — bloğun üstünden geçen atlama kemeri             */
/*    Parametre: 0 (özdeşlik atlaması)                                 */
/* ================================================================== */

export function buildResidual({ atlama = 2, scale = 1, palette, girisSekli = ML_VARSAYILAN_GIRIS, aciklik = ML_OLCU.kalinlik } = {}) {
  const m = makeMats(palette);
  const g = new THREE.Group();
  const A = Math.max(1, Math.round(atlama));
  const a = Math.max(0.12, aciklik);
  // Kemer YÜKSEKLİĞİ açıklıkla orantılıdır: dar açıklıkta yüksek kemer, kemer
  // değil bir iğne/dikilitaş olarak okunuyordu. Atlanan blok sayısı yüksekliği
  // bir miktar artırır ama oran her zaman "köprü" kalır.
  const h = Math.min(0.16 + 0.30 * a + 0.030 * A, 0.44);

  // Ayak pabuçları: kemerin oturduğu iki uç. Pabuç yarım genişliği açıklığın
  // İÇİNDE kalır — blok X bütçesi (0.25×scale) pabuçlarla taşmaz.
  const uc = a / 2 - 0.035;
  for (const sx of [-1, 1]) {
    const pabuc = box(0.070, 0.030, 0.24, m.metal);      // yatay pabuç (X'te İNCE)
    pabuc.position.set(sx * uc, -0.30, 0);
    g.add(pabuc);
  }
  // Dikmeler: pabuçlardan kemerin uçlarına.
  for (const sx of [-1, 1]) {
    g.add(strut(V3(sx * uc, -0.29, 0), V3(sx * uc, -0.06, 0), 0.013, m.metal, 10));
  }
  // KEMER: kuadratik Bézier boru — tek parça, sürekli eğri (kırık çizgi değil).
  const egri = new THREE.QuadraticBezierCurve3(
    V3(-uc, -0.06, 0), V3(0, h * 2 - 0.06, 0), V3(uc, -0.06, 0),
  );
  const kemer = new THREE.Mesh(new THREE.TubeGeometry(egri, 48, 0.023, 10, false), m.body);
  g.add(kemer);
  // Atlanan blok işaretleri: kemer üzerinde A adet çentik.
  for (let k = 0; k < Math.min(A, 6); k++) {
    const u = (k + 0.5) / Math.min(A, 6);
    const p = egri.getPoint(u);
    const cent = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.0075, 8, 16), m.panel);
    const tn = egri.getTangent(u);
    cent.quaternion.setFromUnitVectors(V3(0, 0, 1), tn);
    cent.position.copy(p);
    g.add(cent);
  }
  // TEK VURGU: toplama düğümü (+X ucunda) — halka + iç haç = "girdi + çıktı".
  const dugum = new THREE.Group();
  const halka = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.016, 12, 28), m.accent);
  halka.rotation.y = Math.PI / 2;
  dugum.add(halka);
  const c1 = box(0.014, 0.086, 0.016, m.accent);
  const c2 = box(0.014, 0.016, 0.086, m.accent);
  dugum.add(c1, c2);
  dugum.position.set(uc, -0.16, 0);
  g.add(dugum);
  g.add(montajDili(m, a * 0.8, -0.315, 0.20));

  return finalize(g, {
    tur: 'residual', ad: `Artık Bağlantı ×${A}`, scale, m, girisSekli,
    hesap: (giris) => ({ cikis: [...giris], parametre: 0 }),
  });
}

/* ================================================================== */
/* 10) ÇIKTI — sınıf çubukları; tip ÇERÇEVEDEN okunur                  */
/*     Parametre: (Cin + 1) · birim                                    */
/* ================================================================== */

export function buildOutput({ birim = 10, tip = 'softmax', scale = 1, palette, girisSekli = [64] } = {}) {
  const m = makeMats(palette);
  const g = new THREE.Group();
  const U = Math.max(1, Math.round(birim));
  const n = Math.min(U, 10);
  const kisalt = U > n;
  const t = ['softmax', 'sigmoid', 'dogrusal', 'linear'].includes(tip) ? tip : 'softmax';
  const dogrusal = t === 'dogrusal' || t === 'linear';

  // Taban rayı: çubukların oturduğu eksen.
  const zAlan = kisalt ? 0.72 : 0.84;
  const bos = 0.020;
  const w = (zAlan - bos * (n - 1)) / n;
  const z0 = -zAlan / 2 + w / 2;
  // (Plaka zaten X'te kalın, Y'de ince kurulur — DÖNDÜRÜLMEZ; döndürmek
  //  kalınlığı Y'ye taşır ve blok X bütçesini kaybederdi.)
  const taban = plaka(0.06, zAlan + 0.08, 0.19, m.panel, 0.02);
  taban.position.y = dogrusal ? 0 : -0.36;
  g.add(taban);

  // Deterministik dağılım: seed'li skorlar, softmax'ta toplamı 1'e normalize.
  const rnd = mulberry32(1337 + U * 7);
  const ham = [];
  for (let i = 0; i < n; i++) ham.push(0.10 + rnd() * 0.28);
  const kazanan = 3 % n;
  ham[kazanan] = 1.0;
  const toplam = ham.reduce((a, b) => a + b, 0);
  const enYuksek = -0.36 + 0.08 + (ham[kazanan] / toplam) * 1.5;   // kazanan çubuğun tepesi
  for (let i = 0; i < n; i++) {
    const z = z0 + i * (w + bos);
    const p = ham[i] / toplam;
    if (dogrusal) {
      // DOĞRUSAL: değerler sıfır ekseninin İKİ yanına da uzar (sınırsız çıktı).
      const isaret = i % 2 ? 1 : -1;
      const L = 0.10 + ham[i] * 0.30;
      const cub = box(0.15, L, w * 0.82, i === kazanan ? m.accent : m.body);
      cub.position.set(0, isaret * L / 2, z);
      g.add(cub);
    } else if (t === 'sigmoid') {
      // SİGMOİD: her sınıf kendi 0..1 KAFESİNDE — bağımsız kapılar.
      const kafes = plaka(0.62, w * 0.94, 0.020, m.panel, 0.015);
      kafes.position.set(-0.070, -0.05, z);
      g.add(kafes);
      const L = 0.06 + ham[i] * 0.5;
      const cub = box(0.13, L, w * 0.66, i === kazanan ? m.accent : m.body);
      cub.position.set(0.020, -0.36 + L / 2, z);
      g.add(cub);
    } else {
      // SOFTMAX: yükseklikler toplamı SABİT — biri artarsa diğerleri azalır.
      const L = 0.08 + p * 1.5;
      const cub = box(0.15, L, w * 0.82, i === kazanan ? m.accent : m.body);
      cub.position.set(0, -0.36 + L / 2, z);
      g.add(cub);
      const uc = box(0.17, 0.014, w * 0.9, m.metal);
      uc.position.set(0, -0.36 + L, z);
      g.add(uc);
    }
  }
  if (t === 'sigmoid') {
    // 0.5 eşiği: tüm kafesleri kesen metal ray.
    const esik = box(0.06, 0.012, zAlan + 0.04, m.metal);
    esik.position.set(0.020, -0.36 + 0.28, 0);
    g.add(esik);
  } else if (!dogrusal) {
    // Σ=1 kirişi: softmax'ın toplam kısıtını taşıyan üst ray. Kiriş EN YÜKSEK
    // çubuğun hemen üstüne oturur ve iki dikmeyle tabana bağlanır — sabit
    // yükseklikte bırakıldığında havada asılı, ilişkisiz bir çubuk okunuyordu.
    const ky = enYuksek + 0.032;
    const kiris = box(0.06, 0.016, zAlan + 0.06, m.metal);
    kiris.position.set(-0.062, ky, 0);
    g.add(kiris);
    for (const sz of [1, -1]) {
      const dikme = box(0.05, ky + 0.42, 0.014, m.metal);
      dikme.position.set(-0.062, (ky - 0.42) / 2, sz * (zAlan / 2 + 0.028));
      g.add(dikme);
    }
  }
  if (kisalt) {
    const nk = uctNokta(m.metal, 1.2);
    nk.rotation.z = Math.PI / 2;
    nk.position.set(0, dogrusal ? 0.10 : -0.28, zAlan / 2 + 0.055);
    g.add(nk);
  }
  g.add(montajDili(m, 0.16, dogrusal ? -0.44 : -0.44, 0.20));

  const adTip = dogrusal ? 'doğrusal' : t;
  return finalize(g, {
    tur: 'output', ad: `Çıktı ${U} · ${adTip}`, scale, m, girisSekli,
    hesap: (giris) => ({ cikis: [U], parametre: (duzBoyut(giris) + 1) * U }),
  });
}

/* ================================================================== */
/* Kompozisyon yardımcıları (çekirdek API'nin ÜSTÜNDE, isteğe bağlı)   */
/* ================================================================== */

// zincirle(gruplar, girisSekli) — şekilleri blok blok İLERLETİR ve her bloğun
// userData'sındaki girisSekli / cikisSekli / parametre alanlarını YERİNDE
// tazeler. Kurucular tek başına çağrıldığında belgelenen varsayılan girişi
// kullanır; gerçek mimaride sayılar buradan gelir.
export function zincirle(gruplar, girisSekli = ML_VARSAYILAN_GIRIS) {
  let sekil = dizi(girisSekli);
  const katmanlar = [];
  let toplam = 0;
  for (const kok of gruplar) {
    const hesap = HESAP_KAYDI.get(kok);
    if (!hesap) continue;
    const { cikis, parametre } = hesap(sekil);
    const p = Math.round(parametre);
    kok.userData.girisSekli = [...sekil];
    kok.userData.cikisSekli = [...cikis];
    kok.userData.parametre = p;
    katmanlar.push({ ad: kok.userData.ad, tur: kok.userData.tur, giris: [...sekil], cikis: [...cikis], parametre: p });
    toplam += p;
    sekil = cikis;
  }
  return { katmanlar, cikisSekli: sekil, toplamParametre: toplam };
}

// diz(gruplar, {bosluk, x0}) — blokları +X ekseninde ARALARINDA EŞİT boşlukla
// dizer (ölçülmüş X kalınlıklarını kullanır). Dönüş: toplam uzunluk.
export function diz(gruplar, { bosluk = 0.14, x0 = 0 } = {}) {
  let x = x0;
  for (const kok of gruplar) {
    const kal = (kok.userData && kok.userData.olcu ? kok.userData.olcu.x : ML_OLCU.kalinlik);
    kok.position.x = x + kal / 2;
    x += kal + bosluk;
  }
  return Math.max(0, x - x0 - bosluk);
}

// Sunum etiketi: "32×32×3 → 32×32×32 · 896 parametre"
export function katmanOzeti(kok) {
  const u = kok.userData || {};
  const s = (a) => (Array.isArray(a) ? a.join('×') : '?');
  return `${s(u.girisSekli)} → ${s(u.cikisSekli)} · ${(u.parametre ?? 0).toLocaleString('tr-TR')} parametre`;
}
