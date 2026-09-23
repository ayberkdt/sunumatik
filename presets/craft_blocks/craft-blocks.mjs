// craft-blocks.mjs — Parametrik uzay aracı kütüphanesi (SAF kurucular).
//
// DONMUŞ SÖZLEŞME (references/scene-blocks.md):
//   • Her kurucu THREE.Group döndürür; bağlama YOK (mount / rAF / doku çekme yok).
//   • Eksenler: +X = ileri/hız, −X = ana motor egzozu, +Z = yukarı/çanak tarafı.
//   • Orijin geometrik merkezde; en uzun boyut ≈ 1 × scale.
//   • palette = { body, panel, accent, metal } — varsayılan obsidyen–şampanya.
//   • Yalnızca MeshStandardMaterial; emissive yok, doku yok — geometri ve malzeme disiplini.
//   • Araç başına TEK vurgu (accent) öğesi; her ayrıntı bir MEKANİZMA ya da
//     bir mühendislik kısıtı anlatır (userData.notes.why bunu yazar) — süs yok.
//   • PARÇA SÖZLEŞMESİ (docs/physical-rigs-plan.md §2, F0): hareketli her parça
//     adlı bir Group'tur; root.userData.rig.joints haritası düğüm adını, ekseni,
//     açı/strok sınırını ve hız sınırını verir. Eklem grubunun yerel eksenleri
//     tasarım eksenleriyle çakışır (sıfır açıda birim dönüş); yönelim gerekiyorsa
//     DIŞ bir yönelim grubu taşır, eklem içeride kalır. Tüketici parçayı
//     bulamazsa sessizce devre dışı kalır (blok sözleşmesi).
//
// Tüketiciler bu modülü GÖRELİ yolla import eder ve import başarısız olursa
// basit bir yer tutucu Group'a düşmek ZORUNDADIR (bloklar birbirine sert bağımlı olamaz).

import * as THREE from 'three';
// Eksen yardımcıları tek kaynaktan: ../core/geometry-axis.mjs
// (cylY/cylZ/coneX/coneZ/latheX/latheZ de orada — gerektiğinde import edin).
import { eksenX, cylX, cylY, cylZ, latheX } from '../core/geometry-axis.mjs';

// Varsayılan palet: obsidyen gövde, koyu hücreler, şampanya vurgusu, saten çelik.
export const CRAFT_PALETTE = Object.freeze({
  body:   0x23252c,
  panel:  0x10151d,
  accent: 0xc9a35c,
  metal:  0x9aa0ab,
});

/* ------------------------------------------------------------------ */
/* Malzeme dili — tüm araçlar aynı satın mühendislik yüzeyini paylaşır */
/* ------------------------------------------------------------------ */

// Panel çerçevesi: hücre renginin aydınlatılmış hâli (ince açık çerçeve kuralı).
// Palet yerinde güncellenirken de AYNI türetme kullanılır — tek doğruluk kaynağı.
function cerceveRengi(panel) {
  return new THREE.Color(panel).lerp(new THREE.Color(0xffffff), 0.42);
}

// Kök Group → malzeme kaydı. Yerinde palet güncellemesi (applyCraftPalette)
// için tutulur; kök çöpe gidince kayıt da gider (WeakMap).
const MALZEME_KAYDI = new WeakMap();

function makeMats(palette) {
  const p = { ...CRAFT_PALETTE, ...(palette || {}) };
  const frame = cerceveRengi(p.panel);
  return {
    body:     new THREE.MeshStandardMaterial({ color: p.body,  roughness: 0.55, metalness: 0.35 }),
    bodyFlat: new THREE.MeshStandardMaterial({ color: p.body,  roughness: 0.55, metalness: 0.35, flatShading: true }),
    panel:    new THREE.MeshStandardMaterial({ color: p.panel, roughness: 0.38, metalness: 0.55 }),
    frame:    new THREE.MeshStandardMaterial({ color: frame,   roughness: 0.50, metalness: 0.45 }),
    metal:    new THREE.MeshStandardMaterial({ color: p.metal, roughness: 0.30, metalness: 0.85 }),
    metalDS:  new THREE.MeshStandardMaterial({ color: p.metal, roughness: 0.30, metalness: 0.85, side: THREE.DoubleSide }),
    accent:   new THREE.MeshStandardMaterial({ color: p.accent, roughness: 0.32, metalness: 0.70 }),
    dark:     new THREE.MeshStandardMaterial({ color: 0x07090c, roughness: 0.65, metalness: 0.25, side: THREE.DoubleSide }),
  };
}

/* ------------------------------------------------- */
/* Geometri yardımcıları (hepsi deterministik)        */
/* ------------------------------------------------- */

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

/* EKSEN YARDIMCILARI artık ../core/geometry-axis.mjs içinde yaşar (tek
   kaynak; hikâye ve kural orada). Buradaki alignX eski addır — yerinde
   kullanımlar için eksenX'e bağlanır, yeni kodda eksenX kullanın. */
const alignX = eksenX;

function box(w, h, d, mat) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
}

// İki nokta arasında dikme (strut).
function strut(a, b, r, mat, seg = 10) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(V3(0, 1, 0), dir.normalize());
  return mesh;
}

// Gerçek çan profili (LatheGeometry): boğaz y=0'da, egzoz −Y'de.
// Hızlı genişleyip düzleşen klasik çan eğrisi — koni DEĞİL.
function bellMesh(rThroat, rExit, len, mat, seg = 48) {
  const pts = [];
  const N = 16;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const r = rThroat + (rExit - rThroat) * Math.pow(t, 0.62);
    pts.push(new THREE.Vector2(r, -len * t));
  }
  return new THREE.Mesh(new THREE.LatheGeometry(pts, seg), mat);
}

// Motor grubu: montaj halkası + çan; egzoz yerel −X'e bakar.
// mountX: montaj düzleminin x konumu (çan buradan −X'e uzanır).
function engineAssembly(m, { rThroat, rExit, len, mountX = 0, ringR = null }) {
  const g = new THREE.Group();
  const rr = ringR ?? rThroat * 1.6;
  const ring = cylX(rr, rr, 0.035, 24, m.metal);
  ring.position.x = mountX;
  g.add(ring);
  const bell = bellMesh(rThroat, rExit, len, m.metalDS);
  bell.geometry.rotateZ(-Math.PI / 2);       // −Y egzoz → −X egzoz
  bell.position.x = mountX - 0.017;
  g.add(bell);
  return g;
}

// Parabolik çanak: +Y'ye açılır; çağıran döndürür.
function dishMesh(R, depth, mat, seg = 48) {
  const pts = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    pts.push(new THREE.Vector2(R * t, depth * t * t));
  }
  return new THREE.Mesh(new THREE.LatheGeometry(pts, seg), mat);
}

// Güneş paneli kanadı: koyu hücreler + ince açık çerçeve (iki tonlu grup, doku yok).
// XY düzleminde; hücreler +Z yüzünde. w = X boyu (cols), h = Y boyu (rows).
function panelWing(w, h, cols, rows, m, t = 0.016) {
  const g = new THREE.Group();
  const base = box(w, h, t, m.frame);           // açık çerçeve tabanı
  g.add(base);
  const gap = Math.min(w, h) * 0.035;
  const cw = (w - gap * (cols + 1)) / cols;
  const ch = (h - gap * (rows + 1)) / rows;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const cell = box(cw, ch, t * 0.55, m.panel);
      cell.position.set(
        -w / 2 + gap + cw / 2 + i * (cw + gap),
        -h / 2 + gap + ch / 2 + j * (ch + gap),
        t * 0.55,
      );
      g.add(cell);
    }
  }
  return g;
}

// İtici dörtlüsü (RCS quad) — amaçlı greeble: taban blok + 4 mini nozul.
function thrusterQuad(m, s = 1) {
  const g = new THREE.Group();
  const base = box(0.055 * s, 0.055 * s, 0.028 * s, m.metal);
  g.add(base);
  const dirs = [V3(1, 0, 0.55), V3(-1, 0, 0.55), V3(0, 1, 0.55), V3(0, -1, 0.55)];
  for (const d of dirs) {
    const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.011 * s, 0.004 * s, 0.03 * s, 10, 1, true), m.dark);
    noz.quaternion.setFromUnitVectors(V3(0, 1, 0), d.clone().normalize());
    noz.position.copy(d.clone().normalize().multiplyScalar(0.032 * s));
    g.add(noz);
  }
  return g;
}

// Eklem düğümü: adlı Group, tasarım koordinatında pivot. Çocuklar pivota
// GÖRE konur; sıfır açıda dönüş birimdir (rig sözleşmesi).
function eklem(name, x = 0, y = 0, z = 0) {
  const j = new THREE.Group();
  j.name = name;
  j.position.set(x, y, z);
  return j;
}

// Bitirici: merkeze al, en uzun boyutu 1×scale'e normalle, kök Group döndür.
// m: bu aracın malzeme kaydı — yerinde palet güncellemesi için saklanır.
// rig: { joints, contacts, massClass } — userData.rig'e yazılır; her eklemin
// düğümü ağaçta ARANIR ve bulunamayanlar `found:false` ile işaretlenir
// (sessiz yanlış ad yok; validate-craft bunu HATA sayar).
function finalize(inner, kind, scale, m, rig = null) {
  const bb = new THREE.Box3().setFromObject(inner);
  const size = bb.getSize(new THREE.Vector3());
  const center = bb.getCenter(new THREE.Vector3());
  const longest = Math.max(size.x, size.y, size.z) || 1;
  const s = scale / longest;
  inner.scale.setScalar(s);
  inner.position.copy(center).multiplyScalar(-s);
  const root = new THREE.Group();
  root.name = `craft:${kind}`;
  root.add(inner);
  let parts = 0;
  inner.traverse((o) => { if (o.isMesh) parts++; });
  root.userData = { preset: 'craft-blocks', kind, parts, designSize: size.toArray() };
  if (rig) {
    const joints = {};
    for (const [ad, spec] of Object.entries(rig.joints || {})) {
      joints[ad] = { deg: true, ...spec, found: !!inner.getObjectByName(spec.node) };
    }
    root.userData.rig = {
      kind, units: 'design', scaleToRoot: s, joints,
      contacts: rig.contacts || [], massClass: rig.massClass || null,
    };
  }
  if (m) MALZEME_KAYDI.set(root, m);
  return root;
}

/* ------------------------------------------------------------------ */
/* Yerinde palet güncellemesi                                          */
/* ------------------------------------------------------------------ */
//
// Görünür araç YENİDEN KURULMAZ (webgl-scene-contract §2): palet değişiminde
// yalnız malzeme renkleri yerinde tazelenir. Sök-tak yolu tamamen ortadan
// kalkar — ne geometri dispose'u ne de tekrar üretim olur; türetilmiş
// çerçeve rengi de aynı kaynaktan (cerceveRengi) tazelenir.
//
//   applyCraftPalette(root, { body, panel, accent, metal }) → boolean
//   (root bu modülün kurucularından biriyle üretilmemişse false döner)
export function applyCraftPalette(root, palette) {
  const m = MALZEME_KAYDI.get(root);
  if (!m) return false;
  const p = { ...CRAFT_PALETTE, ...(palette || {}) };
  m.body.color.set(p.body);
  m.bodyFlat.color.set(p.body);
  m.panel.color.set(p.panel);
  m.frame.color.copy(cerceveRengi(p.panel));   // TÜRETİLMİŞ renk
  m.metal.color.set(p.metal);
  m.metalDS.color.set(p.metal);
  m.accent.color.set(p.accent);
  // m.dark palete bağlı değildir (sabit kaportalı boşluk rengi) — dokunulmaz.
  return true;
}

/* ================================================================== */
/* 1) YÖRÜNGE ARACI — gövde 1×0.7×0.6, kanat açıklığı ≈ 2.4           */
/* ================================================================== */

export function buildOrbiter({ scale = 1, palette } = {}) {
  const m = makeMats(palette);
  const g = new THREE.Group();

  // Gövde (bus): ±X geçiş plakaları, uzun kenar rayları, +Z'de iki termal
  // battaniye (MLI) plakası — MLI gergin dikişli panolar hâlinde durur.
  g.add(box(1, 0.7, 0.6, m.body));
  for (const sx of [1, -1]) {
    const pl = box(0.04, 0.74, 0.64, m.metal);
    pl.position.x = sx * 0.5;
    g.add(pl);
  }
  for (const sy of [1, -1]) for (const sz of [1, -1]) {
    const rail = box(1.02, 0.055, 0.055, m.metal);
    rail.position.set(0, sy * 0.345, sz * 0.295);
    g.add(rail);
  }
  for (const sx of [1, -1]) {
    const mli = box(0.4, 0.6, 0.014, m.bodyFlat);
    mli.position.set(sx * 0.24, 0, 0.306);
    g.add(mli);
  }

  // Radyatör (−Z: çanağın ve Güneş'in TERSİ) + PANJURLAR. Panjur, ısıtıcı
  // harcamadan ısı atımını ayarlayan iki konumlu mekanizma: soğukta kapanır
  // (yansıtıcı yüz uzaya bakar), sıcakta açılır. Beş çıta, tek eklem ailesi.
  const rad = box(0.78, 0.5, 0.02, m.panel);
  rad.position.z = -0.308;
  g.add(rad);
  const panjur = eklem('louvers', 0, 0, -0.33);
  for (let i = 0; i < 5; i++) {
    const l = eklem(`louver${i}`, 0, -0.2 + i * 0.1, 0);
    const cita = box(0.74, 0.088, 0.006, m.frame);
    cita.rotation.x = 0.5;                       // yarı açık (~29°)
    l.add(cita);
    panjur.add(l);
  }
  g.add(panjur);

  // Güneş kanatları: SADA tamburu (gövdede) → boyunduruk → menteşe → iki
  // panel bölümü. Kanat gövdeye göre Y ekseninde DÖNER: yörünge ilerledikçe
  // Güneş yönü değişir, gövde ise aletlerini nadire çevirmek zorundadır;
  // iki isteği tek eklem uzlaştırır. İki bölüm = fırlatmada katlanmış kanat.
  for (const s of [1, -1]) {
    const L = s > 0 ? 'L' : 'R';
    const sada = cylY(0.05, 0.05, 0.06, 20, m.metal);
    sada.position.set(0, s * 0.38, 0);
    g.add(sada);
    const wing = eklem(`wing${L}`, 0, s * 0.41, 0);
    wing.add(strut(V3(0, 0, 0), V3(0, s * 0.2, 0), 0.022, m.metal));
    const hinge = box(0.09, 0.05, 0.09, m.metal);
    hinge.position.y = s * 0.2;
    wing.add(hinge);
    const p1 = panelWing(0.52, 0.46, 3, 4, m, 0.02);
    p1.position.y = s * 0.45;
    wing.add(p1);
    for (const dx of [-0.18, 0.18]) {
      const h2 = box(0.06, 0.05, 0.03, m.metal);
      h2.position.set(dx, s * 0.70, 0);
      wing.add(h2);
    }
    const p2 = panelWing(0.52, 0.46, 3, 4, m, 0.02);
    p2.position.y = s * 0.95;
    wing.add(p2);
    g.add(wing);
  }

  // Yüksek kazançlı çanak (+Z), İKİ EKSENLİ gimbal: azimut tamburu (Z ekseni)
  // → dirsek → yükseliş (Y ekseni) → Cassegrain çanak (ana yansıtıcı + üç
  // dikme + alt yansıtıcı). Çanak Dünya'yı, gövde gezegeni izler; iki eksen
  // bu yüzden şart. ÇANAK JANTI = tek vurgu öğesi.
  const hgaTaban = cylZ(0.07, 0.08, 0.05, 24, m.metal);
  hgaTaban.position.z = 0.325;
  g.add(hgaTaban);
  const hgaAz = eklem('hgaAz', 0, 0, 0.35);
  const dirsek = box(0.05, 0.12, 0.09, m.metal);
  dirsek.position.z = 0.045;
  hgaAz.add(dirsek);
  const hgaEl = eklem('hgaEl', 0, 0, 0.09);
  const dish = dishMesh(0.27, 0.085, m.metalDS);
  dish.geometry.rotateX(Math.PI / 2);          // +Y açılışı → +Z açılışı
  hgaEl.add(dish);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.268, 0.011, 12, 48), m.accent);
  rim.position.z = 0.085;
  hgaEl.add(rim);
  for (let i = 0; i < 3; i++) {
    const a = (i * 2 * Math.PI) / 3;
    hgaEl.add(strut(V3(Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0.055), V3(0, 0, 0.19), 0.006, m.metal, 6));
  }
  const altYansitici = cylZ(0.03, 0.03, 0.012, 16, m.metal);
  altYansitici.position.z = 0.19;
  hgaEl.add(altYansitici);
  const besleme = cylZ(0.02, 0.026, 0.05, 12, m.metal);
  besleme.position.z = 0.03;
  hgaEl.add(besleme);
  hgaAz.add(hgaEl);
  g.add(hgaAz);

  // Alçak kazançlı omni (yönelim kaybolsa da bağlantı), Güneş sensörü (kaba
  // yönelim), iki yıldız izleyici (farklı bakış: biri Güneş'e kör kalınca öteki).
  g.add(strut(V3(0.4, -0.28, 0.3), V3(0.4, -0.28, 0.66), 0.006, m.metal, 6));
  const omniUc = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), m.metal);
  omniUc.position.set(0.4, -0.28, 0.66);
  g.add(omniUc);
  const gunesSensoru = cylZ(0.022, 0.022, 0.012, 16, m.dark);
  gunesSensoru.position.set(-0.3, -0.22, 0.316);
  g.add(gunesSensoru);
  for (const sy of [1, -1]) {
    const tr = cylZ(0.02, 0.045, 0.1, 16, m.dark, true);
    tr.quaternion.setFromUnitVectors(V3(0, 0, 1), V3(0.35, sy * 0.25, 1).normalize());
    tr.position.set(0.3, sy * 0.2, 0.33);
    g.add(tr);
  }

  // Ana motor (−X egzoz) GİMBALLİ: ana yanmada itki vektörü ağırlık merkezine
  // bakmalıdır ve merkez yakıt tüketildikçe kayar; iki aktüatör bunu düzeltir.
  const engineGimbal = eklem('engineGimbal', -0.5, 0, 0);
  engineGimbal.add(engineAssembly(m, { rThroat: 0.05, rExit: 0.115, len: 0.19, mountX: -0.025 }));
  g.add(engineGimbal);
  for (const s of [1, -1]) g.add(strut(V3(-0.46, s * 0.14, -0.14), V3(-0.53, s * 0.06, -0.07), 0.008, m.metal, 8));
  const sep = cylX(0.2, 0.2, 0.016, 32, m.metal);     // fırlatıcı ayrılma halkası
  sep.position.x = -0.525;
  g.add(sep);

  // Umbilikal panel + 4 RCS dörtlüsü köşelerde (en uzun moment kolu).
  const umb = box(0.05, 0.2, 0.14, m.dark);
  umb.position.set(0.505, 0.15, 0.12);
  g.add(umb);
  for (const sy of [1, -1]) for (const sz of [1, -1]) {
    const q = thrusterQuad(m, 1);
    q.quaternion.setFromUnitVectors(V3(0, 0, 1), V3(0, sy, sz).normalize());
    q.position.set(0.42, sy * 0.34, sz * 0.29);
    g.add(q);
  }

  const root = finalize(g, 'orbiter', scale, m, {
    joints: {
      'wing.L.sada':     { node: 'wingL', axis: 'y', range: [-180, 180], rateDegS: 0.5 },
      'wing.R.sada':     { node: 'wingR', axis: 'y', range: [-180, 180], rateDegS: 0.5 },
      'hga.az':          { node: 'hgaAz', axis: 'z', range: [-170, 170], rateDegS: 3 },
      'hga.el':          { node: 'hgaEl', axis: 'y', range: [-10, 100], rateDegS: 3 },
      'engine.gimbal':   { node: 'engineGimbal', axis: ['y', 'z'], range: [-6, 6], rateDegS: 10 },
      'radiator.louvers': { node: 'louvers', axis: 'x', range: [0, 75], slats: 5, rateDegS: 2 },
    },
    massClass: 'MRO sınıfı (~2 t)',
  });
  root.userData.notes = {
    regime: 'yörünge aracı · 3 eksen kararlı',
    why: 'Kanatlar gövdeye göre döner (SADA): gövde aletlerini gezegene, kanat hücrelerini Güneş\'e çevirmek zorundadır ve yörünge ilerledikçe ikisi ayrışır. Çanak iki eksenli gimbaldedir çünkü Dünya üçüncü bir yöndür. Radyatör çanağın ve Güneş\'in tersindedir; panjurları ısıtıcı harcamadan ısı atımını ayarlar. RCS dörtlüleri köşelerde: aynı itkiyle en büyük tork. Ana motor gimballidir: yakıt tükendikçe ağırlık merkezi kayar, itki vektörü onu izlemelidir.',
  };
  return root;
}

/* ================================================================== */
/* 2) İNİŞ ARACI — geniş duruş, ~35° bacak açısı, gerçek çan          */
/*    Egzoz −X (sözleşme); iniş yönelimini tüketici verir.            */
/* ================================================================== */

export function buildLander({ scale = 1, palette } = {}) {
  const m = makeMats(palette);
  const g = new THREE.Group();
  const joints = {};

  // Sekizgen gövde, ekseni X; 22,5° döndürülmüş: düz yüzler tankları, köşeler
  // bacakları taşısın. Altta koyu MLI yalıtım eteği (motor ısısı + regolit).
  const body = cylX(0.5, 0.5, 0.4, 8, m.bodyFlat);
  body.geometry.rotateX(Math.PI / 8);
  g.add(body);
  const etek = cylX(0.506, 0.506, 0.11, 8, m.panel);
  etek.geometry.rotateX(Math.PI / 8);
  etek.position.x = -0.135;
  g.add(etek);

  // Üst güverte (+X) + VURGU: kenetlenme halkası.
  const deck = cylX(0.45, 0.45, 0.045, 8, m.bodyFlat);
  deck.geometry.rotateX(Math.PI / 8);
  deck.position.x = 0.222;
  g.add(deck);
  const dockRing = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.022, 14, 40), m.accent);
  dockRing.rotation.y = Math.PI / 2;         // halka normali +X — TEK vurgu öğesi
  dockRing.position.x = 0.26;
  g.add(dockRing);

  // Alt geçiş halkası + GİMBALLİ, kısılabilir iniş motoru (−X egzoz). İnişte
  // itki ağırlığın altına inmeli (kısma) ve ağırlık merkezini izlemeli (gimbal).
  const skirt = cylX(0.34, 0.28, 0.07, 24, m.metal);
  skirt.position.x = -0.225;
  g.add(skirt);
  const engineGimbal = eklem('engineGimbal', -0.24, 0, 0);
  engineGimbal.add(engineAssembly(m, { rThroat: 0.07, rExit: 0.17, len: 0.26, mountX: -0.02, ringR: 0.12 }));
  g.add(engineGimbal);
  for (const a of [Math.PI / 2, Math.PI]) {
    g.add(strut(V3(-0.2, Math.sin(a) * 0.3, Math.cos(a) * 0.3), V3(-0.27, Math.sin(a) * 0.13, Math.cos(a) * 0.13), 0.008, m.metal, 8));
  }
  joints['engine.gimbal'] = { node: 'engineGimbal', axis: ['y', 'z'], range: [-6, 6], rateDegS: 10 };

  // Yakıt tankları: gövde yüzeylerine yarı gömülü 4 küre + kuşak.
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    const tank = new THREE.Mesh(new THREE.SphereGeometry(0.14, 24, 16), m.body);
    tank.position.set(0, Math.sin(a) * 0.46, Math.cos(a) * 0.46);
    g.add(tank);
    const bant = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.008, 8, 28), m.metal);
    bant.rotation.y = Math.PI / 2;
    bant.position.copy(tank.position);
    g.add(bant);
  }

  // Bacaklar (4, 45° aralık, ~35° açılı). Ana dikme İKİ BORUDUR: üst kalın boru
  // alüminyum bal peteği kartuşunu taşır, alt ince boru temasta onun içine
  // girer — strok TEK yönlü ve KALICIDIR (yay gibi geri tepmez, enerji ısıya
  // döner). Ayak tabanının altından temas probu sarkar: yere değdiği an motor
  // kesilir (yerde yanan motor plümü geri teper). 1. bacakta merdiven + sahanlık.
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    const ry = Math.sin(a), rz = Math.cos(a);
    const A = V3(0.06, ry * 0.5, rz * 0.5);           // üst bağlantı
    const F = V3(-0.42, ry * 0.82, rz * 0.82);         // ayak
    const MidW = A.clone().lerp(F, 0.62);
    const leg = eklem(`leg${k}`, A.x, A.y, A.z);
    const Mid = MidW.clone().sub(A), Fl = F.clone().sub(A);
    leg.add(strut(V3(0, 0, 0), Mid, 0.024, m.metal));
    const stroke = eklem(`leg${k}Stroke`, Mid.x, Mid.y, Mid.z);
    const FfromMid = Fl.clone().sub(Mid);
    stroke.add(strut(V3(0, 0, 0), FfromMid, 0.016, m.metal));
    const pad = cylX(0.1, 0.115, 0.028, 20, m.bodyFlat);
    pad.position.copy(FfromMid).add(V3(-0.025, 0, 0));
    stroke.add(pad);
    const probTaban = FfromMid.clone().add(V3(-0.04, ry * 0.05, rz * 0.05));
    stroke.add(strut(probTaban, probTaban.clone().add(V3(-0.14, ry * 0.02, rz * 0.02)), 0.004, m.frame, 6));
    leg.add(stroke);
    g.add(leg);
    // İkincil dikmeler (V): alt gövdeden ana dikmenin 2/3'üne, iki yandan.
    for (const da of [0.35, -0.35]) {
      g.add(strut(V3(-0.17, Math.sin(a + da) * 0.46, Math.cos(a + da) * 0.46), MidW, 0.011, m.metal));
    }
    const dir = A.clone().sub(F).normalize();          // sıkışma yönü (ayaktan gövdeye)
    joints[`leg.${k}.stroke`] = { node: `leg${k}Stroke`, mode: 'translate', dir: dir.toArray(), range: [0, 0.08], oneWay: true };

    if (k === 0) {
      const t = V3(0, rz, -ry);                        // teğet (radyale dik)
      for (const st of [1, -1]) {
        g.add(strut(A.clone().lerp(F, 0.08).addScaledVector(t, st * 0.045), A.clone().lerp(F, 0.95).addScaledVector(t, st * 0.045), 0.006, m.frame, 6));
      }
      for (let i = 0; i < 6; i++) {
        const c = A.clone().lerp(F, 0.14 + i * 0.15);
        g.add(strut(c.clone().addScaledVector(t, 0.045), c.clone().addScaledVector(t, -0.045), 0.005, m.frame, 6));
      }
      const sahanlik = box(0.03, 0.2, 0.2, m.panel);
      sahanlik.rotation.x = -a;
      sahanlik.position.set(0.25, ry * 0.55, rz * 0.55);
      g.add(sahanlik);
    }
  }

  // İniş radarı (altta, gövdeden −X'e sarkar): irtifa ve hız yerden ölçülür.
  const radar = box(0.06, 0.16, 0.12, m.dark);
  radar.position.set(-0.23, 0.2, -0.2);
  g.add(radar);

  // S-bant yönlendirilebilir anten: azimut (deck normali X) → yükseliş (Y) → mini çanak.
  const sTaban = cylX(0.03, 0.03, 0.03, 12, m.metal);
  sTaban.position.set(0.255, 0, 0.3);
  g.add(sTaban);
  const sbandAz = eklem('sbandAz', 0.27, 0, 0.3);
  sbandAz.add(strut(V3(0, 0, 0), V3(0.1, 0, 0.06), 0.007, m.metal));
  const sbandEl = eklem('sbandEl', 0.1, 0, 0.06);
  const miniDish = dishMesh(0.06, 0.018, m.metalDS);
  miniDish.geometry.rotateX(Math.PI / 2);
  miniDish.quaternion.setFromUnitVectors(V3(0, 0, 1), V3(0.6, 0, 1).normalize());
  sbandEl.add(miniDish);
  sbandAz.add(sbandEl);
  g.add(sbandAz);
  joints['sband.az'] = { node: 'sbandAz', axis: 'x', range: [-180, 180], rateDegS: 5 };
  joints['sband.el'] = { node: 'sbandEl', axis: 'y', range: [-20, 90], rateDegS: 5 };
  // VHF çubuk antenler (güverte, 2): yörüngedeki eşle görüş hattı bağlantısı.
  for (const sy of [1, -1]) g.add(strut(V3(0.24, sy * 0.3, 0.2), V3(0.5, sy * 0.33, 0.24), 0.004, m.metal, 6));

  // Umbilikal kutu + 4 RCS dörtlüsü (±Y, ±Z).
  const umb = box(0.14, 0.1, 0.05, m.dark);
  umb.position.set(0.1, -0.34, -0.36);
  umb.rotation.x = Math.PI / 4;
  g.add(umb);
  for (const [sy, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const q = thrusterQuad(m, 0.9);
    q.quaternion.setFromUnitVectors(V3(0, 0, 1), V3(0, sy, sz));
    q.position.set(0.12, sy * 0.52, sz * 0.52);
    g.add(q);
  }

  const root = finalize(g, 'lander', scale, m, { joints, contacts: ['leg.0.stroke', 'leg.1.stroke', 'leg.2.stroke', 'leg.3.stroke'], massClass: 'Apollo LM iniş kademesi sınıfı (~10 t)' });
  root.userData.notes = {
    regime: 'iniş aracı · iniş kademesi',
    why: 'Bacaklar tankların arasına 45° kaydırılmıştır: gövde yüzleri tank, köşeler bacak taşır. Ana dikmenin içinde alüminyum bal peteği vardır; temasta TEK yönde ve KALICI olarak ezilir, geri tepmez — iniş enerjisi ısıya döner. Taban altındaki temas probu yere değdiği an motor kesilir; yerde yanan motorun plümü geri teper. Motor gimballi ve kısılabilir: inişte itki ağırlığın altına inmeli, ağırlık merkezini izlemelidir. Radar irtifayı yerden ölçer; atalet ölçümü inişte yeterince kesin değildir.',
  };
  return root;
}

/* ================================================================== */
/* 3) ROKET — incelik oranı ~8, kademeler + ara halkalar + ojiv       */
/*    başlık + kafes kanatçıklar + motor kümesi. Burun +X.            */
/* ================================================================== */

export function buildRocket({ stages = 2, scale = 1, palette } = {}) {
  const m = makeMats(palette);
  const g = new THREE.Group();
  const joints = {};
  const R = 0.12;
  const stageLens = [0.88, 0.44, 0.3].slice(0, Math.max(1, Math.min(3, stages)));

  let x = 0; // kuyruk tabanı; +X'e doğru istifleriz, motorlar −X'e taşar
  // Üst kademe(ler) AYRILABİLİR bir grupta yaşar: kademe ayrılması = bu grubun
  // +X boyunca ötelenmesi. `kap` o an eklenen kabı, `ekle` mutlak x'i kabın
  // yerel x'ine çevirir.
  let kap = g;
  const ekle = (mesh, absX) => { mesh.position.x = absX - kap.position.x; kap.add(mesh); };

  // Motor eteği + taban halkası.
  const skirt = cylX(R, R * 1.15, 0.07, 40, m.body);
  ekle(skirt, x + 0.035);
  const tabanHalka = cylX(R * 1.16, R * 1.16, 0.018, 40, m.metal);
  ekle(tabanHalka, x + 0.012);

  // Motor kümesi: MERKEZ motor gimballi (TVC — kanat çalışmadan önce ve
  // atmosfer dışında tek yönelim aracı), 4 çevre motoru sabit.
  const engineGimbal = eklem('engineGimbal', x, 0, 0);
  engineGimbal.add(engineAssembly(m, { rThroat: 0.045, rExit: 0.095, len: 0.16, mountX: 0, ringR: 0.07 }));
  g.add(engineGimbal);
  joints['engine.gimbal'] = { node: 'engineGimbal', axis: ['y', 'z'], range: [-8, 8], rateDegS: 20 };
  for (const s of [1, -1]) g.add(strut(V3(0.07, s * 0.06, -0.06), V3(0.0, s * 0.035, -0.035), 0.006, m.metal, 6));
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    const e = engineAssembly(m, { rThroat: 0.028, rExit: 0.058, len: 0.11, mountX: 0, ringR: 0.045 });
    e.position.set(x, Math.sin(a) * 0.072, Math.cos(a) * 0.072);
    g.add(e);
  }
  x += 0.07;

  // Kademeler + ara halkalar.
  for (let i = 0; i < stageLens.length; i++) {
    const L = stageLens[i];
    if (i === 1) {                                   // ayrılabilir üst yığın
      kap = eklem('stage2', x, 0, 0);
      g.add(kap);
      joints['stage.sep'] = { node: 'stage2', mode: 'translate', dir: [1, 0, 0], range: [0, 3], oneWay: true };
    }
    const stage = cylX(R, R, L, 40, m.body);
    ekle(stage, x + L / 2);
    const x0 = x;
    x += L;

    if (i === 0) {
      // Kafes kanatçıklar: dış YÖNELİM grubu (radyal) + iç EKLEM (teğet eksen
      // = yerel z): fırlatmada gövdeye katlı, inişte 90° açılır. Kafes yapı
      // süpersonik hızda düz kanatçıktan daha iyi çalışır ve katlanınca yer kaplamaz.
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2;
        const ry = Math.sin(a), rz = Math.cos(a);
        const yon = new THREE.Group();
        yon.quaternion.setFromUnitVectors(V3(0, 1, 0), V3(0, ry, rz));
        yon.position.set(x - 0.09, ry * R, rz * R);
        const fin = eklem(`gridFin${k}`);
        const plateO = box(0.014, 0.12, 0.1, m.frame);
        plateO.position.y = 0.055;
        const plateI = box(0.017, 0.095, 0.078, m.panel);
        plateI.position.y = 0.055;
        const hinge = box(0.045, 0.06, 0.028, m.metal);
        hinge.position.set(0.018, 0.0, 0);
        fin.add(plateO, plateI, hinge);
        yon.add(fin);
        g.add(yon);
        /* tasarım pozu = AÇIK; katlı = 85° buruna doğru (sense −1: +açı gövde boyunca +X'e katlar) */
        joints[`gridFin.${k}.fold`] = { node: `gridFin${k}`, axis: 'z', range: [0, 90], rateDegS: 45, sense: -1, folded: 85 };
      }
      // Kablo kanalı (raceway) + iki BESLEME HATTI: yakıt/oksitleyici boruları
      // tank dışından geçer (iç geçiş tankı deler, kütle ve risk ekler).
      const race = box(L * 0.86, 0.024, 0.03, m.dark);
      race.position.set(x - L / 2, 0, R + 0.008);
      g.add(race);
      for (const sy of [1, -1]) {
        const hat = cylX(0.011, 0.011, L * 0.9, 10, m.metal);
        hat.position.set(x0 + L * 0.5, sy * (R + 0.012), -0.02);
        g.add(hat);
      }
      // İniş bacakları (4, katlı): 45° kaydırılmış, kanatçıklarla çakışmaz.
      // Dış yönelim + iç eklem (menteşe üstte, bacak −X'e sarkar).
      for (let k = 0; k < 4; k++) {
        const a = Math.PI / 4 + (k * Math.PI) / 2;
        const ry = Math.sin(a), rz = Math.cos(a);
        const yon = new THREE.Group();
        yon.quaternion.setFromUnitVectors(V3(0, 1, 0), V3(0, ry, rz));
        yon.position.set(x0 + 0.5, ry * (R + 0.012), rz * (R + 0.012));
        const leg = eklem(`leg${k}`);
        const slat = box(0.46, 0.022, 0.034, m.metal);
        slat.position.set(-0.23, 0.011, 0);
        leg.add(slat);
        const menteşe = box(0.04, 0.03, 0.05, m.frame);
        menteşe.position.set(0.0, 0.01, 0);
        leg.add(menteşe);
        yon.add(leg);
        g.add(yon);
        /* tasarım pozu = KATLI (gövde boyunca); +açı dışa açar (sense −1: yerel +z dönüşü içe bakıyordu, ölçüldü) */
        joints[`leg.${k}.deploy`] = { node: `leg${k}`, axis: 'z', range: [0, 70], rateDegS: 30, sense: -1 };
      }
      // Soğuk gaz RCS kapsülleri (kademe tepesinde: en uzun moment kolu),
      // 4 adet — kıyı dönüşü ve geri dönüş yönelimi için.
      for (let k = 0; k < 4; k++) {
        const a = Math.PI / 4 + (k * Math.PI) / 2;
        const q = thrusterQuad(m, 0.55);
        q.quaternion.setFromUnitVectors(V3(0, 0, 1), V3(0, Math.sin(a), Math.cos(a)));
        q.position.set(x - 0.06, Math.sin(a) * (R + 0.012), Math.cos(a) * (R + 0.012));
        g.add(q);
      }
      // Umbilikal kapağı (yer bağlantısı, +Z, tabana yakın).
      const umb = box(0.05, 0.05, 0.02, m.dark);
      umb.position.set(x0 + 0.1, 0, R + 0.004);
      g.add(umb);
    }

    // Ara halka: ilkinde ŞAMPANYA BANT (tek vurgu), diğerlerinde metal.
    if (i < stageLens.length - 1) {
      const ring = cylX(R * 1.045, R * 1.045, 0.07, 40, i === 0 ? m.accent : m.metal);
      ekle(ring, x + 0.035);
      x += 0.07;
    }
  }

  // Başlık geçiş halkası + tanjant-ojiv başlık, İKİ YARIM olarak (payload
  // fairing: yörüngeye yaklaşırken tabandaki menteşeden açılıp atılır).
  const collar = cylX(R * 1.03, R * 1.03, 0.04, 40, m.metal);
  ekle(collar, x + 0.02);
  x += 0.04;
  const L = 0.5;                                    // ojiv boyu
  const rho = (R * R + L * L) / (2 * R);            // tanjant-ojiv yarıçapı
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const r = Math.sqrt(rho * rho - (t * L) * (t * L)) + R - rho;
    pts.push(new THREE.Vector2(Math.max(r, 0), t * L));
  }
  for (const [ad, phi0, sgn] of [['fairingR', 0, -1], ['fairingL', Math.PI, 1]]) {
    const yarim = eklem(ad);                       // menteşe: başlık tabanı, eksen z
    yarim.position.x = x - kap.position.x;
    const kabuk = latheX(pts, 24, m.body, phi0, Math.PI);
    kabuk.material = m.body;
    yarim.add(kabuk);
    kap.add(yarim);
    joints[`${ad === 'fairingL' ? 'fairing.L' : 'fairing.R'}.open`] = { node: ad, axis: 'z', range: [0, sgn * 60].sort((p, q) => p - q), rateDegS: 25 };
  }
  // Üst kademe umbilikal kapağı.
  const umb2 = box(0.04, 0.045, 0.018, m.dark);
  umb2.position.set(0.08, 0, R + 0.003);
  kap.add(umb2);

  const root = finalize(g, 'rocket', scale, m, { joints, massClass: 'orta sınıf fırlatıcı (~500 t)' });
  root.userData.notes = {
    regime: 'fırlatıcı · iki kademe · tekrar kullanılabilir 1. kademe',
    why: 'Merkez motor gimballidir: kalkışta hız sıfırken aerodinamik yüzey işe yaramaz, tek yönelim aracı itki vektörüdür. Kafes kanatçıklar geri dönüşte açılır — süpersonik akımda düz kanatçıktan iyi çalışır ve katlanınca yer kaplamaz. Soğuk gaz RCS kademe tepesindedir: aynı itkiyle en büyük tork. Besleme hatları tank DIŞINDAN geçer; tankı delmek kütle ve risk ekler. Başlık iki yarımdır: atmosfer bittiğinde tabandaki menteşeden açılıp atılır, taşımak yakıta mal olur.',
  };
  return root;
}

/* ================================================================== */
/* 4) KÜPSAT — görünür raylar, hafif gömülü yüzeyler, açılır paneller */
/* ================================================================== */

export function buildCubesat({ units = 3, scale = 1, palette } = {}) {
  const m = makeMats(palette);
  const g = new THREE.Group();
  const joints = {};
  const u = 0.1;
  const n = Math.max(1, Math.min(6, Math.round(units)));
  const L = n * u;                                   // X boyu (nU)

  // Çekirdek gövde: raylardan hafif içeride.
  g.add(box(L - 0.006, 0.088, 0.088, m.body));

  // Yüzey panelleri (±Y, ±Z): raylara göre GÖMÜLÜ iki tonlu hücre plakaları.
  for (const [axis, sgn] of [['y', 1], ['y', -1], ['z', 1], ['z', -1]]) {
    const face = panelWing(L - 0.018, 0.082, n, 1, m, 0.004);
    if (axis === 'y') {
      face.rotation.x = sgn > 0 ? -Math.PI / 2 : Math.PI / 2;
      face.position.y = sgn * 0.0455;
    } else {
      if (sgn < 0) face.rotation.x = Math.PI;
      face.position.z = sgn * 0.0455;
    }
    g.add(face);
  }

  // Raylar: 4 uzun kenarda, gövdeden taşkın — fırlatma kabı (P-POD) yalnız
  // raylara dokunur; standart budur. Ray uçlarında AYIRMA ANAHTARLARI: kapta
  // basılı, dışarı atılınca serbest kalıp aracı çalıştırır.
  for (const sy of [1, -1]) for (const sz of [1, -1]) {
    const rail = box(L + 0.008, 0.0095, 0.0095, m.metal);
    rail.position.set(0, sy * 0.0455, sz * 0.0455);
    g.add(rail);
    const sw = box(0.005, 0.006, 0.006, m.frame);
    sw.position.set(-L / 2 - 0.0065, sy * 0.0455, sz * 0.0455);
    g.add(sw);
  }

  // +X yüzü: kamera açıklığı, yıldız izleyici bafılı, 4 teyp anten (turnstile).
  const cam = cylX(0.018, 0.02, 0.014, 20, m.dark);
  cam.position.set(L / 2 + 0.004, 0, -0.018);
  g.add(cam);
  const baffle = cylX(0.012, 0.016, 0.022, 14, m.dark, true);
  baffle.position.set(L / 2 + 0.008, 0, 0.022);
  g.add(baffle);
  for (const sy of [1, -1]) for (const sz of [1, -1]) {
    g.add(strut(V3(L / 2, sy * 0.03, sz * 0.03), V3(L / 2 + 0.1, sy * 0.085, sz * 0.05), 0.0016, m.metal));
  }

  // −X yüzü: ayrılma halkası. +Z: GPS yama anteni ve Güneş sensörü.
  const sep = cylX(0.034, 0.038, 0.01, 24, m.metal);
  sep.position.x = -L / 2 - 0.004;
  g.add(sep);
  const gps = box(0.03, 0.03, 0.003, m.frame);
  gps.position.set(L / 2 - 0.03, 0, 0.0495);
  g.add(gps);
  const gunes = cylZ(0.006, 0.006, 0.004, 12, m.dark);
  gunes.position.set(-L / 2 + 0.03, 0.025, 0.05);
  g.add(gunes);

  // Açılır güneş kanatları (±Y): DIŞ yönelim (hafif dihedral) + İÇ eklem
  // (menteşe ekseni X). Kanat fırlatmada gövdeye katlıdır, yanan-tel
  // serbest bırakınca yayla açılır ve mekanik dayanakta durur.
  for (const sgn of [1, -1]) {
    const Lr = sgn > 0 ? 'L' : 'R';
    const yon = new THREE.Group();
    yon.position.set(0, sgn * 0.052, 0.038);
    yon.rotation.x = sgn * 0.16;
    const kanat = eklem(`wing${Lr}`);
    const hinge = cylX(0.006, 0.006, L * 0.8, 12, m.metal);
    kanat.add(hinge);
    for (let seg = 0; seg < 2; seg++) {
      const wing = panelWing(L * 0.92, 0.094, n * 2, 1, m, 0.0045);
      wing.position.set(0, sgn * (0.053 + seg * 0.1), 0);
      kanat.add(wing);
    }
    yon.add(kanat);
    g.add(yon);
    /* tasarım pozu = AÇIK (0°); katlı poz gövdeye doğru: sol +85°, sağ −85° (ayna). Yay + dayanak (range). */
    joints[`wing.${Lr}.deploy`] = { node: `wing${Lr}`, axis: 'x', range: sgn > 0 ? [0, 85] : [-85, 0], spring: true, folded: sgn > 0 ? 85 : -85 };
  }

  // TEK vurgu: −Z yüzünde şampanya erişim kapağı.
  const port = box(0.032, 0.032, 0.005, m.accent);
  port.position.set(-L / 2 + 0.05, 0, -0.049);
  g.add(port);

  const root = finalize(g, 'cubesat', scale, m, { joints, massClass: `${n}U (~${(n * 1.33).toFixed(0)} kg)` });
  root.userData.notes = {
    regime: `küpsat · ${n}U`,
    why: 'Raylar gövdeden taşkındır çünkü fırlatma kabı yalnız raylara dokunur; ray uçlarındaki ayırma anahtarları kapta basılı durur, dışarı atılınca serbest kalıp aracı çalıştırır. Kanatlar ve teyp antenler kapta katlıdır, yanan-tel serbest bırakınca yayla açılır. Yıldız izleyicinin bafılı Güneş ve Dünya parıltısını keser; GPS yaması yörüngeyi kendi ölçer.',
  };
  return root;
}

/* ================================================================== */
/* 5) KAPSÜL — 33° yan duvarlı komuta modülü + küresel ısı kalkanı    */
/*    + servis modülü + motor. Tepe +X, kalkan/egzoz −X.              */
/* ================================================================== */

export function buildCapsule({ scale = 1, palette } = {}) {
  const m = makeMats(palette);
  const g = new THREE.Group();
  const joints = {};
  const Rb = 0.3;                                    // taban yarıçapı
  const Rt = 0.07;                                   // tepe yarıçapı
  const H = (Rb - Rt) / Math.tan((33 * Math.PI) / 180); // 33° yan duvar → ~0.354
  const cosW = Math.cos((33 * Math.PI) / 180), sinW = Math.sin((33 * Math.PI) / 180);

  // Yan duvar: kesik koni (taban x=0, tepe +X). 33°: hipersonik girişte
  // aerodinamik olarak kararlı, ısı kalkanı her zaman öne bakar.
  const wall = cylX(Rt, Rb, H, 48, m.body);
  wall.position.x = H / 2;
  g.add(wall);

  // Tepe: küresel kapak + PARAŞÜT BÖLMESİ kapağı halkası + kenetlenme tüneli.
  const cap = new THREE.Mesh(new THREE.SphereGeometry(Rt, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), m.body);
  cap.geometry.rotateZ(-Math.PI / 2);                // kutup +X'e
  cap.position.x = H;
  g.add(cap);
  const bayLip = cylX(0.078, 0.078, 0.018, 32, m.panel);
  bayLip.position.x = H + 0.02;
  g.add(bayLip);
  const tunnel = cylX(0.038, 0.044, 0.04, 24, m.metal);
  tunnel.position.x = H + 0.05;
  g.add(tunnel);
  const dockRing = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.007, 10, 32), m.metal);
  dockRing.rotation.y = Math.PI / 2;
  dockRing.position.x = H + 0.072;
  g.add(dockRing);

  // Isı kalkanı: küresel kesit (R=0.72 küreden), −X'e şişkin; kenar dudak halkası.
  const shieldR = 0.72;
  const capAngle = Math.asin(Rb / shieldR);
  const spts = [];
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * capAngle;
    spts.push(new THREE.Vector2(shieldR * Math.sin(a), -(shieldR * (1 - Math.cos(a)))));
  }
  const shield = latheX(spts, 48, m.dark);           // sıra latheX içinde düzeltilir; şişkinlik −X
  g.add(shield);
  const lip = cylX(0.306, 0.306, 0.026, 48, m.metal);
  g.add(lip);

  // Koni yüzeyine dik parça yerleştirici: (x boyunca konum, açı) → grup.
  const yuzeyde = (hx, ang) => {
    const hr = Rb - (Rb - Rt) * (hx / H) + 0.004;
    const dir = V3(sinW, Math.sin(ang) * cosW, Math.cos(ang) * cosW);
    const o = new THREE.Group();
    o.quaternion.setFromUnitVectors(V3(0, 0, 1), dir);
    o.position.set(hx, Math.sin(ang) * hr, Math.cos(ang) * hr);
    return o;
  };

  // TEK vurgu: +Z tarafında kapak (hatch) halkası; kapak menteşeli EKLEM.
  const hatchYon = yuzeyde(0.16, 0);
  const hatch = eklem('hatch', 0, -0.062, 0);          // menteşe kapağın ALT kenarında (yerel −y)
  const hDisc = cylZ(0.052, 0.052, 0.012, 28, m.panel);
  hDisc.position.y = 0.062;
  hatch.add(hDisc);
  const hRing = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.009, 12, 36), m.accent);
  hRing.position.y = 0.062;
  hatch.add(hRing);
  hatchYon.add(hatch);
  g.add(hatchYon);
  joints['hatch.open'] = { node: 'hatch', axis: 'x', range: [0, 100], rateDegS: 15 };

  // İki pencere (±Y): küçük — basınçlı gövdede her açıklık yapısal bedeldir.
  for (const ang of [Math.PI / 2, -Math.PI / 2]) {
    const w = yuzeyde(0.2, ang);
    const cam = cylZ(0.028, 0.028, 0.01, 24, m.dark);
    w.add(cam);
    const cerceve = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.005, 8, 24), m.metal);
    w.add(cerceve);
    g.add(w);
  }
  // Kapsül RCS'i (4 mini dörtlü, tabana yakın): girişte yalpa/yunuslama
  // kontrolü kapsülün KENDİ iticileriyle yapılır — SM o an çoktan atılmıştır.
  for (let k = 0; k < 4; k++) {
    const ang = Math.PI / 4 + (k * Math.PI) / 2;
    const q = yuzeyde(0.05, ang);
    q.add(thrusterQuad(m, 0.55));
    g.add(q);
  }

  // Servis modülü: kalkandan İÇERLEK gövde — adaptör konisi + silindir + radyatörler.
  const adapter = cylX(0.3, 0.262, 0.06, 48, m.body);
  adapter.position.x = -0.043;
  g.add(adapter);
  const sm = cylX(0.262, 0.262, 0.5, 48, m.body);
  sm.position.x = -0.323;
  g.add(sm);
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    const ry = Math.sin(a), rz = Math.cos(a);
    const radp = box(0.32, 0.15, 0.012, m.panel);
    radp.quaternion.setFromUnitVectors(V3(0, 0, 1), V3(0, ry, rz));
    radp.position.set(-0.323, ry * 0.265, rz * 0.265);
    g.add(radp);
  }
  const aftRing = cylX(0.268, 0.268, 0.03, 48, m.metal);
  aftRing.position.x = -0.567;
  g.add(aftRing);

  // SM güneş kanatları: X düzeninde 4 radyal kanat, menteşe kıç halkasında.
  // Dört küçük kanat iki büyükten iyidir: biri açılmasa güç yarıya değil
  // dörtte üçe iner ve hiçbiri ana motor plümüne girmez. Hücreler ∓X'e
  // bakar (panel normali X): kanat Güneş'e gövde dönerek çevrilir.
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    const rad = V3(0, Math.sin(a), Math.cos(a)), tan = V3(0, Math.cos(a), -Math.sin(a));
    const yon = new THREE.Group();
    yon.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(tan, rad, V3(1, 0, 0)));
    yon.position.set(-0.5, rad.y * 0.272, rad.z * 0.272);
    const wing = eklem(`smWing${k}`);
    const mafsal = cylY(0.014, 0.014, 0.05, 10, m.metal);
    mafsal.position.y = 0.02;
    wing.add(mafsal);
    const kol = strut(V3(0, 0.04, 0), V3(0, 0.1, 0), 0.008, m.metal, 8);
    wing.add(kol);
    const panel = panelWing(0.12, 0.34, 1, 5, m, 0.012);
    panel.position.y = 0.28;
    wing.add(panel);
    yon.add(wing);
    g.add(yon);
    /* tasarım pozu = AÇIK (radyal); katlı = −85° kıça doğru (SM boyunca), tek yönlü açılım */
    joints[`smWing.${k}.deploy`] = { node: `smWing${k}`, axis: 'x', range: [-90, 0], oneWay: true, folded: -85 };
  }

  // Umbilikal kaplama + 4 RCS dörtlüsü + 8 yardımcı itici (kıç halkası).
  const umb = box(0.14, 0.09, 0.045, m.dark);
  umb.position.set(-0.15, 0, 0.262);
  g.add(umb);
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    const ry = Math.sin(a), rz = Math.cos(a);
    const q = thrusterQuad(m, 1.1);
    q.quaternion.setFromUnitVectors(V3(0, 0, 1), V3(0, ry, rz));
    q.position.set(-0.22, ry * 0.272, rz * 0.272);
    g.add(q);
  }
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4 + Math.PI / 8;
    const t = cylX(0.012, 0.02, 0.03, 10, m.dark, true);
    t.position.set(-0.585, Math.sin(a) * 0.22, Math.cos(a) * 0.22);
    g.add(t);
  }

  // SM ana motoru (−X egzoz), gimballi.
  const engineGimbal = eklem('engineGimbal', -0.567, 0, 0);
  engineGimbal.add(engineAssembly(m, { rThroat: 0.06, rExit: 0.15, len: 0.23, mountX: -0.011, ringR: 0.095 }));
  g.add(engineGimbal);
  joints['engine.gimbal'] = { node: 'engineGimbal', axis: ['y', 'z'], range: [-6, 6], rateDegS: 10 };

  const root = finalize(g, 'capsule', scale, m, { joints, massClass: 'Orion sınıfı (kapsül ~10 t + SM ~15 t)' });
  root.userData.notes = {
    regime: 'mürettebat kapsülü + servis modülü',
    why: '33° yan duvar hipersonik girişte kendiliğinden kararlıdır: kalkan öne bakar, sapınca geri döner. Kalkan küresel kesittir (R ≈ 2,4 taban çapı): küt burun şok tabakasını yüzeyden uzak tutar, ısı akısı küçülür. Pencereler küçüktür; basınçlı gövdede her açıklık yapısal bedeldir. Kapsülün kendi RCS\'i vardır çünkü girişte SM çoktan atılmıştır. SM kanatları X düzenindedir: dört küçük kanat iki büyükten yedeklidir ve hiçbiri ana motor plümüne girmez.',
  };
  return root;
}

/* ================================================================== */
/* Ortak parçalar — ikinci dalga                                      */
/* ================================================================== */

// Tekerlek: silindir + çevresinde radyal ÇITALAR (grouser).
// Çıtalar süs değil: gevşek regolitte tekerlek bir tırtıl gibi kazır,
// düz bir jant kayar. Gezgin tekerleklerinde bu yüzden kesme yönünde
// dişler vardır ve iz üstünde ayrık damgalar bırakırlar.
function tekerlek(m, { r = 0.13, w = 0.10, cita = 18 } = {}) {
  const g = new THREE.Group();
  // AKS YÖNÜ: CylinderGeometry'nin ekseni zaten +Y'dir ve blok düzeninde
  // +Y açıklık/aks yönüdür — yani DÖNDÜRMEK GEREKMEZ. rotation.x = π/2
  // konunca aks +Z'ye (yukarı) gidiyor ve tekerlekler yere serilmiş tabaklar
  // gibi yatıyordu. Çıtalar XZ düzleminde doğru yerleştirilmiş olduğu için
  // hata yalnız jantta ve göbekte görünüyordu.
  const jant = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 26), m.metal);
  g.add(jant);
  const cg = new THREE.BoxGeometry(0.012, w * 0.94, 0.018);
  for (let i = 0; i < cita; i++) {
    const a = (i * 2 * Math.PI) / cita;
    const c = new THREE.Mesh(cg, m.frame);
    c.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    c.rotation.y = -a;
    g.add(c);
  }
  const gobek = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.34, r * 0.34, w * 1.1, 16), m.body);
  g.add(gobek);
  return g;
}

// Kanatlı radyoizotop güç kaynağı (RTG): silindir + boyuna kanatlar.
// Kanatlar ısıyı UZAYA ışıma yoluyla atar; RTG çıkışının yalnız ~%6'sı
// elektriktir, kalanı atık ısıdır ve konveksiyon olmadığı için tek yol budur.
function rtg(m, { r = 0.052, len = 0.30, kanat = 8 } = {}) {
  const g = new THREE.Group();
  g.add(cylX(r, r, len, 20, m.metal));
  const kg = new THREE.BoxGeometry(len * 0.92, 0.006, r * 0.85);
  for (let i = 0; i < kanat; i++) {
    const a = (i * 2 * Math.PI) / kanat;
    const k = new THREE.Mesh(kg, m.frame);
    k.position.set(0, Math.sin(a) * r * 1.3, Math.cos(a) * r * 1.3);
    k.rotation.x = -a;
    g.add(k);
  }
  return g;
}

/**
 * Rotor: N kanatlı, burulmalı. Kanat kesiti ince bir plakadır — Mars'ta
 * Reynolds sayısı 10⁴ mertebesindedir ve o rejimde kalın profil işe yaramaz.
 * Tek geometri üretilip bütün kanatlarda paylaşılır.
 */
function rotorDisk(m, { R = 0.6, kanat = 2, kokVeter = 0.10, ucVeter = 0.06, burulma = 12 } = {}) {
  const g = new THREE.Group();
  const N = 8, pos = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const rr = R * (0.14 + 0.86 * t);
    const c = kokVeter + (ucVeter - kokVeter) * t;
    const tw = ((burulma * (1 - t)) * Math.PI) / 180;      // kökte çok, uçta az
    const ct = Math.cos(tw), stw = Math.sin(tw);
    for (const s of [-0.5, 0.5]) {
      const dx = s * c;
      pos.push(dx * ct, rr, dx * stw);
    }
  }
  for (let i = 0; i < N; i++) {
    const a = i * 2, b = a + 2;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: m.frame.color, roughness: 0.5,
    metalness: 0.3, side: THREE.DoubleSide });
  for (let i = 0; i < kanat; i++) {
    const b = new THREE.Mesh(geo, mat);
    b.rotation.z = (i * 2 * Math.PI) / kanat;
    g.add(b);
  }
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.034, 0.05, 14), m.metal));
  return g;
}

/* ================================================================== */
/* 6) STARSHIP SINIFI — paslanmaz iki kademeli, gövde flapli            */
/* ================================================================== */
//
// Bu sınıfın iki alışılmadık kararı vardır ve ikisi de geometride görünür:
//
// 1. FLAPLER KANAT DEĞİLDİR. Araç atmosfere KARNI ÖNDE, paraşütçü gibi
//    girer: amaç kaldırma üretmek değil, en büyük sürüklemeyi üretip
//    enerjiyi yüksekte harcamaktır. Dört flap (2 ön küçük, 2 arka büyük)
//    bağımsız hareket ederek ağırlık merkezi etrafındaki momenti dengeler —
//    yani kanat gibi kaldırma değil, paraşütçünün kolları gibi DURUŞ
//    kontrolü yaparlar. Arka flaplerin büyük olması, motor kütlesinin
//    ağırlık merkezini arkaya çekmesindendir.
//
// 2. İKİ TÜR MOTOR. Deniz seviyesi çanları küçük genişleme oranlıdır
//    (atmosferde akım ayrılmasın diye), vakum çanları çok büyüktür — vakumda
//    genişleme oranı ne kadar büyükse özgül itki o kadar yüksektir.
export function buildStarship({ scale = 1, palette, booster = false } = {}) {
  const m = makeMats(palette);
  const g = new THREE.Group();
  const R = 0.20;

  // Ojiv burun (Lathe) + silindirik gövde
  // OJİV BURUN: taban (y = 0,56) gövde yarıçapında, uç (y = 0,86) sıfır.
  // İlk yazımda yarıçap TERS yönde büyüyordu — burun aşağı bakan bir kâse
  // gibi çıkıyordu. Profil y ARTARAK sıralanır ki lathe normalleri dışa baksın.
  const prof = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    prof.push(new THREE.Vector2(R * Math.sqrt(Math.max(0, 1 - Math.pow(t, 2.1))), 0.56 + t * 0.30));
  }
  const burun = new THREE.Mesh(new THREE.LatheGeometry(prof, 44), m.body);
  burun.geometry.rotateZ(-Math.PI / 2);
  g.add(burun);
  const govde = cylX(R, R, 1.32, 44, m.body);
  govde.position.x = -0.10;
  g.add(govde);

  // Isıl koruma: RÜZGÂR ALTI yüzde altıgen seramik karo alanı. Yalnız BİR
  // yüz kaplıdır çünkü araç hep aynı yüzü akıma verir; öteki yüz çıplak
  // paslanmazdır ve ısıyı ışıyarak atar.
  const karo = new THREE.Mesh(
    new THREE.CylinderGeometry(R * 1.015, R * 1.015, 1.36, 44, 1, true, Math.PI * 0.60, Math.PI * 0.80),
    m.panel);
  karo.geometry.rotateZ(-Math.PI / 2);
  karo.position.x = -0.10;
  karo.material.side = THREE.DoubleSide;
  g.add(karo);

  const flap = (len, w, kal) => {
    const f = new THREE.Group();
    f.add(box(len, w, kal, m.body));
    const kenar = box(len * 0.96, 0.012, kal * 1.5, m.frame);
    kenar.position.y = w / 2;
    f.add(kenar);
    return f;
  };
  // Flapler EKLEMDİR: dış yönelim grubu (gövde eğimi) + iç eklem (menteşe
  // gövde kenarında, eksen X). Karın-önde düşüşte dördü bağımsız komut alır.
  const joints = {};
  for (const s of [1, -1]) {
    const LR = s > 0 ? 'L' : 'R';
    for (const [ad, len, w, kal, px, pz, egim] of [[`flapF${LR}`, 0.20, 0.17, 0.030, 0.50, 0.06, -0.30], [`flapR${LR}`, 0.30, 0.26, 0.036, -0.58, 0.05, -0.26]]) {
      const yon = new THREE.Group();
      yon.position.set(px, s * R, pz);
      yon.rotation.x = s * egim;
      const j = eklem(ad);
      const f = flap(len, w, kal);
      f.position.y = s * (w / 2 + 0.005);
      j.add(f);
      yon.add(j);
      g.add(yon);
      joints[`flap.${ad.slice(4)}`] = { node: ad, axis: 'x', range: [-15, 15], rateDegS: 30 };
    }
    const mn = cylX(0.030, 0.030, 0.10, 14, m.metal);
    mn.rotation.z = Math.PI / 2;
    mn.position.set(-0.58, s * (R + 0.01), 0.05);
    g.add(mn);
  }

  // Motorlar: 3 deniz seviyesi (içte, gimballi) + 3 vakum (dışta, sabit)
  const kic = -0.76;
  // Deniz seviyesi motorları GİMBALLİ (yalnız bunlar): iniş yanışında
  // yönelimi bunlar verir; vakum çanları sabittir (büyük çan gimbalde sığmaz).
  for (let i = 0; i < 3; i++) {
    const a = (i * 2 * Math.PI) / 3 + Math.PI / 6;
    const j = eklem(`engineSL${i}`, kic, Math.sin(a) * 0.055, Math.cos(a) * 0.055);
    j.add(engineAssembly(m, { rThroat: 0.030, rExit: 0.052, len: 0.10, mountX: 0, ringR: 0.040 }));
    g.add(j);
    joints[`engine.${i}.gimbal`] = { node: `engineSL${i}`, axis: ['y', 'z'], range: [-15, 15], rateDegS: 30 };
  }
  for (let i = 0; i < 3; i++) {
    const a = (i * 2 * Math.PI) / 3;
    const e = engineAssembly(m, { rThroat: 0.032, rExit: 0.088, len: 0.19, mountX: kic + 0.02, ringR: 0.050 });
    e.position.set(0, Math.sin(a) * 0.115, Math.cos(a) * 0.115);
    g.add(e);
  }
  const kicHalka = cylX(R, R * 0.97, 0.05, 44, m.metal);
  kicHalka.position.x = kic + 0.03;
  g.add(kicHalka);

  const hat = box(1.18, 0.026, 0.020, m.accent);
  hat.position.set(-0.10, 0, R * 0.99);
  g.add(hat);

  if (booster) {
    const BL = 1.9;
    const bg = cylX(R, R, BL, 44, m.body);
    bg.position.x = kic - 0.12 - BL / 2;
    g.add(bg);
    // Sıcak ayırma halkası: üst kademe motorlarını, alt kademe hâlâ
    // yanarken ateşlemeye izin veren delikli geçiş parçası.
    const sicak = cylX(R * 1.02, R * 1.02, 0.10, 44, m.frame, true);
    sicak.position.x = kic - 0.12;
    sicak.material.side = THREE.DoubleSide;
    g.add(sicak);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      const izgara = box(0.11, 0.015, 0.13, m.metal);
      izgara.position.set(kic - 0.34, Math.sin(a) * (R + 0.055), Math.cos(a) * (R + 0.055));
      izgara.rotation.x = -a;
      g.add(izgara);
    }
    const bKic = kic - 0.12 - BL;
    for (const [n, rr, re] of [[3, 0.045, 0.030], [10, 0.105, 0.026], [20, 0.160, 0.024]]) {
      for (let i = 0; i < n; i++) {
        const a = (i * 2 * Math.PI) / n;
        const e = engineAssembly(m, { rThroat: re * 0.6, rExit: re, len: 0.055, mountX: bKic, ringR: re * 1.2 });
        e.position.set(0, Math.sin(a) * rr, Math.cos(a) * rr);
        g.add(e);
      }
    }
  }

  const root = finalize(g, booster ? 'starship-stack' : 'starship', scale, m, { joints, massClass: booster ? 'tam yığın (~5 000 t)' : 'gemi kademesi (~1 300 t dolu)' });
  root.userData.notes = {
    regime: booster ? 'tam yığın · tekrar kullanılabilir' : 'gemi kademesi',
    why: 'Flapler kanat değildir: araç karnı önde, paraşütçü gibi iner ve flapler kaldırma değil DURUŞ kontrolü yapar. İki tür motorun sebebi genişleme oranıdır — vakumda büyük çan yüksek özgül itki verir, atmosferde ise akım ayrılır.',
  };
  return root;
}

/* ================================================================== */
/* 7) GEZGİN — rocker-bogie süspansiyonlu altı tekerlekli               */
/* ================================================================== */
//
// ROCKER-BOGIE'DE YAY YOKTUR. Her yanda iki kollu bir mekanizma vardır:
// ROCKER (ön tekerlek + bogie ekseni) ve BOGIE (orta + arka tekerlek).
// Gövde, iki rockerın açısının ORTALAMASINI alan bir diferansiyele bağlıdır.
// Sonuç: bir tekerlek kendi çapına yakın bir kayaya tırmanırken diğer beşi
// yerde kalır ve gövde eğimin yarısı kadar döner. Yaylı süspansiyon bunu
// yapamaz — yay, yükü aktarırken tekerleği yerden keser.
//
// Tırmanma yeteneği tekerlek çapıyla ölçeklenir; gezgin tekerlekleri bu
// yüzden gövdeye göre orantısız büyüktür.
export function buildRover({ scale = 1, palette, arm = true } = {}) {
  const m = makeMats(palette);
  const g = new THREE.Group();
  const joints = {};

  const kasa = box(0.86, 0.44, 0.26, m.body);
  kasa.position.set(0, 0, 0.04);
  g.add(kasa);
  const guverte = box(0.62, 0.40, 0.05, m.panel);
  guverte.position.set(0.06, 0, 0.19);
  guverte.rotation.y = -0.06;
  g.add(guverte);
  // Ön tehlike kameraları (hazcam): gövde önünde, alçakta, çift.
  for (const s of [1, -1]) {
    const hz = cylX(0.016, 0.02, 0.03, 12, m.dark);
    hz.position.set(0.44, s * 0.15, -0.02);
    g.add(hz);
  }

  // Rocker-bogie: GERÇEK pivot ağacı. rocker(L/R) gövde pivotunda döner; ön
  // tekerlek ve bogie pivotu rockerın çocuğudur; orta/arka tekerlek bogienin.
  // Köşe tekerlekleri (ön/arka) direksiyon eklemi (Z) taşır, ortadakiler taşımaz.
  const wR = 0.135, wW = 0.095;
  const N = { rockerP: [0.02, -0.02], bogieP: [-0.22, -0.13],
              on: [0.44, -0.30], orta: [-0.07, -0.30], arka: [-0.44, -0.30] };
  const teker = (ad, steer) => {
    const w = eklem(ad);
    w.add(tekerlek(m, { r: wR, w: wW }));
    joints[`wheel.${ad.slice(5)}`] = { node: ad, axis: 'y', radius: wR, spin: true, ...(steer ? { steer } : {}) };
    return w;
  };
  const pivotDisk = () => { const p = cylY(0.024, 0.024, 0.05, 14, m.frame); return p; };
  for (const s of [1, -1]) {
    const LR = s > 0 ? 'L' : 'R';
    const Y = s * 0.245, Yw = s * 0.31;
    const P = (k) => V3(N[k][0], Y, N[k][1]);
    const Pw = (k) => V3(N[k][0], Yw, N[k][1]);
    const rocker = eklem(`rocker${LR}`, P('rockerP').x, P('rockerP').y, P('rockerP').z);
    const onRel = Pw('on').sub(P('rockerP')), bogieRel = P('bogieP').sub(P('rockerP'));
    rocker.add(strut(V3(0, 0, 0), onRel, 0.016, m.metal));
    rocker.add(strut(V3(0, 0, 0), bogieRel, 0.016, m.metal));
    rocker.add(pivotDisk());
    const steerF = eklem(`steerF${LR}`, onRel.x, onRel.y, onRel.z);
    steerF.add(teker(`wheelF${LR}`, `steerF${LR}`));
    rocker.add(steerF);
    joints[`steer.F${LR}`] = { node: `steerF${LR}`, axis: 'z', range: [-90, 90], rateDegS: 20 };
    const bogie = eklem(`bogie${LR}`, bogieRel.x, bogieRel.y, bogieRel.z);
    const ortaRel = Pw('orta').sub(P('bogieP')), arkaRel = Pw('arka').sub(P('bogieP'));
    bogie.add(strut(V3(0, 0, 0), ortaRel, 0.013, m.metal));
    bogie.add(strut(V3(0, 0, 0), arkaRel, 0.013, m.metal));
    bogie.add(pivotDisk());
    const wM = teker(`wheelM${LR}`);
    wM.position.copy(ortaRel);
    bogie.add(wM);
    const steerR = eklem(`steerR${LR}`, arkaRel.x, arkaRel.y, arkaRel.z);
    steerR.add(teker(`wheelR${LR}`, `steerR${LR}`));
    bogie.add(steerR);
    joints[`steer.R${LR}`] = { node: `steerR${LR}`, axis: 'z', range: [-90, 90], rateDegS: 20 };
    rocker.add(bogie);
    g.add(rocker);
    joints[`rocker.${LR}`] = { node: `rocker${LR}`, axis: 'y', range: [-25, 25] };
    joints[`bogie.${LR}`] = { node: `bogie${LR}`, axis: 'y', range: [-30, 30] };
  }
  // Diferansiyel çubuğu: iki rockerı gövdenin ÜSTÜNDEN bağlar; gövdenin
  // eğimi bu çubuk sayesinde iki yanın ortalaması olur.
  const dif = eklem('differential', 0.02, 0, 0.21);
  dif.add(box(0.03, 0.52, 0.03, m.metal));
  g.add(dif);
  joints['differential'] = { node: 'differential', axis: 'z', range: [-25, 25] };

  // Direk: pan (Z) gövdede, tilt (Y) başta. Baş: stereo çift + uzaktan
  // algılama kutusu (lazer spektrometre) + VURGU maske.
  const mastPan = eklem('mastPan', 0.28, 0, 0.21);
  const direk = cylZ(0.022, 0.026, 0.42, 14, m.metal);
  direk.position.z = 0.21;
  mastPan.add(direk);
  const mastTilt = eklem('mastTilt', 0, 0, 0.45);
  const bas = box(0.16, 0.22, 0.10, m.body);
  bas.position.set(0.02, 0, 0);
  mastTilt.add(bas);
  for (const s of [1, -1]) {
    const lens = cylX(0.022, 0.026, 0.045, 14, m.dark);
    lens.position.set(0.11, s * 0.07, 0);
    mastTilt.add(lens);
  }
  const lazer = cylX(0.03, 0.03, 0.05, 16, m.dark);
  lazer.position.set(0.11, 0, 0.06);
  mastTilt.add(lazer);
  const maske = box(0.02, 0.23, 0.11, m.accent);
  maske.position.set(0.113, 0, 0);
  mastTilt.add(maske);
  mastPan.add(mastTilt);
  g.add(mastPan);
  joints['mast.pan'] = { node: 'mastPan', axis: 'z', range: [-180, 180], rateDegS: 12 };
  joints['mast.tilt'] = { node: 'mastTilt', axis: 'y', range: [-87, 91], rateDegS: 12 };

  // RTG arkada ve YUKARI KANIK: kanıklık ısıyı gövdeden uzağa yöneltir ve
  // ışıma görüş açısını açar.
  const r = rtg(m, { r: 0.055, len: 0.30 });
  r.position.set(-0.56, 0, 0.20);
  r.rotation.y = -0.42;
  g.add(r);

  // Yüksek kazançlı çanak (gövde üstü, iki eksen): Dünya'yla doğrudan bağ.
  // UHF sarmal anten (yörüngedeki röleyle asıl veri yolu — 100× daha hızlı).
  const hgaAz = eklem('hgaAz', -0.18, 0.14, 0.24);
  hgaAz.add(cylZ(0.02, 0.02, 0.06, 12, m.metal));
  const hgaEl = eklem('hgaEl', 0, 0, 0.06);
  const cnk = dishMesh(0.09, 0.03, m.metalDS, 32);
  cnk.geometry.rotateX(Math.PI / 2);
  cnk.quaternion.setFromUnitVectors(V3(0, 0, 1), V3(0.7, 0.3, 1).normalize());
  hgaEl.add(cnk);
  hgaAz.add(hgaEl);
  g.add(hgaAz);
  joints['hga.az'] = { node: 'hgaAz', axis: 'z', range: [-180, 180], rateDegS: 5 };
  joints['hga.el'] = { node: 'hgaEl', axis: 'y', range: [0, 90], rateDegS: 5 };
  const uhf = cylZ(0.02, 0.02, 0.12, 10, m.metal);
  uhf.position.set(-0.3, -0.16, 0.30);
  g.add(uhf);

  if (arm) {
    // Kol: azimut (Z) → omuz (Y) → dirsek (Y) → turet. Turet: matkap + fırça.
    const p0 = V3(0.42, -0.20, -0.05), p1 = V3(0.62, -0.24, -0.16), p2 = V3(0.50, -0.30, -0.30);
    const armJ1 = eklem('armJ1', p0.x, p0.y, p0.z);
    armJ1.add(new THREE.Mesh(new THREE.SphereGeometry(0.026, 12, 10), m.frame));
    const armJ2 = eklem('armJ2');
    const p1r = p1.clone().sub(p0);
    armJ2.add(strut(V3(0, 0, 0), p1r, 0.020, m.metal));
    const armJ3 = eklem('armJ3', p1r.x, p1r.y, p1r.z);
    armJ3.add(new THREE.Mesh(new THREE.SphereGeometry(0.026, 12, 10), m.frame));
    const p2r = p2.clone().sub(p1);
    armJ3.add(strut(V3(0, 0, 0), p2r, 0.017, m.metal));
    const turet = eklem('armTurret', p2r.x, p2r.y, p2r.z);
    turet.add(box(0.10, 0.10, 0.08, m.body));
    const matkap = cylZ(0.012, 0.012, 0.08, 10, m.metal);
    matkap.position.set(0.02, 0, -0.08);
    turet.add(matkap);
    const firca = cylZ(0.025, 0.025, 0.02, 12, m.dark);
    firca.position.set(-0.03, 0.03, -0.05);
    turet.add(firca);
    armJ3.add(turet);
    armJ2.add(armJ3);
    armJ1.add(armJ2);
    g.add(armJ1);
    joints['arm.j1'] = { node: 'armJ1', axis: 'z', range: [-90, 90], rateDegS: 10 };
    joints['arm.j2'] = { node: 'armJ2', axis: 'y', range: [-60, 120], rateDegS: 10 };
    joints['arm.j3'] = { node: 'armJ3', axis: 'y', range: [-150, 10], rateDegS: 10 };
    joints['arm.turret'] = { node: 'armTurret', axis: 'z', range: [-180, 180], rateDegS: 15 };
  }

  const root = finalize(g, 'rover', scale, m, {
    joints,
    contacts: ['wheel.FL', 'wheel.ML', 'wheel.RL', 'wheel.FR', 'wheel.MR', 'wheel.RR'],
    massClass: 'Curiosity sınıfı (~900 kg)',
  });
  root.userData.notes = {
    regime: 'yüzey gezgini · rocker-bogie',
    why: 'Yay yoktur: rocker ve bogie kolları, gövdeyi iki yanın ORTALAMASINDA tutan bir diferansiyele bağlıdır. Bir tekerlek kendi çapına yakın bir kayaya tırmanırken diğer beşi yerde kalır. Tırmanma yeteneği tekerlek çapıyla ölçeklendiği için tekerlekler gövdeye göre orantısız büyüktür. Yalnız köşe tekerlekleri döner (yerinde dönüş için altı yeter). Veri yolu UHF sarmalıdır: yörüngedeki röle, Dünya\'ya doğrudan bağlantıdan 100 kat hızlıdır; çanak yedek ve komut hattıdır.',
  };
  return root;
}

/* ================================================================== */
/* 8) MARS HELİKOPTERİ — eş eksenli, ters dönen çift rotor              */
/* ================================================================== */
//
// NEDEN ROTOR BU KADAR BÜYÜK VE HIZLI: itki ≈ ρ A (ΩR)² ile gider ve Mars
// yüzeyinde hava yoğunluğu Dünya'nınkinin ~%1,2'sidir. Aynı itkiyi üretmek
// için ya alanı ya uç hızını büyütmek gerekir — ikisi de yapılmıştır: rotor
// gövdeye göre devasa, devir ~2400 dev/dk. Ama uç hızı ses hızının altında
// kalmak ZORUNDA olduğu için bu iki büyütme birbirini sınırlar; aracın
// boyutunu belirleyen denge budur.
//
// EŞ EKSENLİ VE TERS DÖNEN: tek rotor gövdeye tepki torku uygular ve gövde
// ters yöne döner. Kuyruk rotoru koymak yerine iki rotoru ters çevirmek
// torku sıfırlar, üstelik kuyruk kolunun kütlesinden de kurtarır.
export function buildMarsHelicopter({ scale = 1, palette } = {}) {
  const m = makeMats(palette);
  const g = new THREE.Group();
  const R = 0.58;

  g.add(box(0.20, 0.15, 0.17, m.body));
  const alt = box(0.16, 0.12, 0.05, m.panel);
  alt.position.z = -0.10;
  g.add(alt);

  const mil = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.020, 0.40, 12), m.metal);
  mil.rotation.x = Math.PI / 2;        // eksen +Y → +Z (dik mil); yoksa yatık kalır
  mil.position.z = 0.29;
  g.add(mil);
  const rotorAlt = rotorDisk(m, { R, kanat: 2, kokVeter: 0.085, ucVeter: 0.055, burulma: 14 });
  rotorAlt.position.z = 0.20;
  rotorAlt.name = 'rotorAlt';
  g.add(rotorAlt);
  const rotorUst = rotorDisk(m, { R, kanat: 2, kokVeter: 0.085, ucVeter: 0.055, burulma: 14 });
  rotorUst.position.z = 0.40;
  rotorUst.rotation.z = Math.PI / 2;
  rotorUst.name = 'rotorUst';
  g.add(rotorUst);

  // Güneş paneli EN ÜSTTE, rotorların üstünde: aşağıda olsaydı rotorların
  // gölgesi altında kalırdı.
  const gp = panelWing(0.19, 0.19, 3, 3, m, 0.012);
  gp.position.z = 0.50;
  g.add(gp);

  // Dört ayak: uzun ve ince; iniş enerjisini bükülerek yutarlar.
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const ust = V3(Math.cos(a) * 0.07, Math.sin(a) * 0.07, -0.09);
    const yer = V3(Math.cos(a) * 0.20, Math.sin(a) * 0.20, -0.38);
    g.add(strut(ust, yer, 0.007, m.metal, 8));
    const pad = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8), m.frame);
    pad.position.copy(yer);
    g.add(pad);
  }

  const kam = cylX(0.016, 0.018, 0.03, 12, m.accent);
  kam.position.set(0.10, 0, -0.03);
  g.add(kam);

  const root = finalize(g, 'marshelicopter', scale, m, {
    joints: {
      'rotor.lower': { node: 'rotorAlt', axis: 'z', spin: true, rpm: 2400, spokes: 2, sense: 1 },
      'rotor.upper': { node: 'rotorUst', axis: 'z', spin: true, rpm: 2400, spokes: 2, sense: -1 },
    },
    massClass: 'Ingenuity sınıfı (1,8 kg)',
  });
  root.userData.rotors = [rotorAlt, rotorUst];
  root.userData.notes = {
    regime: 'gezegen atmosferinde döner kanat · ~2400 dev/dk',
    why: 'İtki ≈ ρA(ΩR)²; Mars yüzeyinde ρ Dünya’nınkinin ~%1,2’si. Hem alan hem uç hızı büyütülmüştür, ama uç hızı ses hızının altında kalmak zorunda olduğu için ikisi birbirini sınırlar. Rotorlar ters döner: tepki torku kuyruk rotoru olmadan sıfırlanır.',
  };
  return root;
}

/* ================================================================== */
/* 9) DERİN UZAY SONDASI — büyük çanak, boomlar, RTG                    */
/* ================================================================== */
//
// Bu aracın bütün siluetini üç kısıt belirler:
//  · ÇANAK BÜYÜK olmalı — alınan güç 1/r² ile düşer, kazanç ise çanak
//    alanıyla artar. Milyarlarca kilometreden bit taşımanın tek yolu budur.
//  · RTG UZAKTA olmalı — nötron ve gama akısı bilim aletlerini kirletir;
//    bu yüzden ayrı bir boomun ucundadır.
//  · MANYETOMETRE DAHA DA UZAKTA olmalı — aracın kendi elektroniği ve RTG'si
//    manyetik alan üretir, ölçüm için yerel alandan kaçmak gerekir. Bu yüzden
//    sondalarda en uzun eleman genellikle manyetometre boomudur.
export function buildProbe({ scale = 1, palette } = {}) {
  const m = makeMats(palette);
  const g = new THREE.Group();

  const bus = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.20, 10), m.body);
  bus.rotation.z = Math.PI / 2;
  g.add(bus);
  const raf = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.02, 10), m.frame);
  raf.rotation.z = Math.PI / 2;
  raf.position.x = -0.11;
  g.add(raf);

  // Yüksek kazançlı çanak +Z'ye bakar (blok sözleşmesi: çanak tarafı +Z).
  // dishMesh +Y'ye açılır. R_x(θ)·(0,1,0) = (0, cosθ, sinθ); +Z'ye açılması
  // için θ = +90° gerekir. −90° yazılınca çanak AŞAĞI bakıyordu, oysa blok
  // sözleşmesi "+Z = çanak tarafı" der.
  // Derinlik/çap oranı 0,11/0,80 iken çanak düz bir tabak gibi okunuyordu;
  // gerçek derin uzay çanaklarında f/D ≈ 0,35 civarıdır, yani belirgin bir
  // kâse. 0,17'ye çıkarıldı.
  const cn = dishMesh(0.40, 0.17, m.metalDS, 48);
  cn.rotation.x = Math.PI / 2;
  cn.position.set(0.02, 0, 0.20);
  cn.name = 'hga';                       // sabit çanak: sonda GÖVDESİYLE Dünya'ya döner
  g.add(cn);
  const besleme = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.038, 0.20, 14), m.metal);
  besleme.rotation.x = Math.PI / 2;    // besleme boynuzu çanağın eksenine paralel
  besleme.position.set(0.02, 0, 0.34);
  g.add(besleme);
  for (let i = 0; i < 3; i++) {
    const a = (i * 2 * Math.PI) / 3;
    g.add(strut(V3(0.02 + Math.cos(a) * 0.32, Math.sin(a) * 0.32, 0.215),
                V3(0.02, 0, 0.355), 0.006, m.metal, 6));
  }
  // Alçak kazançlı boynuz: çanağın TERSİNE, −Z'ye bakar (araç yönelimi
  // kaybolduğunda geniş hüzmeyle bağlantı kurmak için).
  const dusuk = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.09, 14, 1, true), m.metalDS);
  dusuk.rotation.x = -Math.PI / 2;
  dusuk.position.set(-0.05, 0, -0.20);
  g.add(dusuk);

  const rtgUc = V3(-0.05, -0.62, -0.05);
  g.add(strut(V3(-0.02, -0.16, -0.02), rtgUc, 0.014, m.metal));
  for (let i = 0; i < 3; i++) {
    const r = rtg(m, { r: 0.042, len: 0.20, kanat: 8 });
    r.rotation.z = Math.PI / 2;
    r.position.set(rtgUc.x, rtgUc.y - i * 0.21, rtgUc.z);
    g.add(r);
  }

  // Manyetometre boomu en uzun eleman OLMALI ama 1,05 iken finalize'ın
  // normalleştirmesi bütün aracı küçültüyor ve otobüs okunmaz hâle
  // geliyordu. 0,74 hâlâ en uzun eleman, ama gövdeyi ezmiyor.
  const magUc = V3(0.04, 0.74, 0.06);
  g.add(strut(V3(0.02, 0.16, 0.03), magUc, 0.008, m.frame, 8));
  for (const t of [0.45, 0.78, 1.0]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.03), m.panel);
    s.position.set(0.02 + (magUc.x - 0.02) * t, 0.16 + (magUc.y - 0.16) * t, 0.03 + (magUc.z - 0.03) * t);
    g.add(s);
  }

  const plat = box(0.16, 0.14, 0.10, m.body);
  plat.position.set(0.16, 0.20, -0.10);
  g.add(plat);
  for (const [dy, r0] of [[0.05, 0.020], [-0.03, 0.026]]) {
    const tup = cylX(r0, r0 * 1.1, 0.14, 12, m.dark);
    tup.position.set(0.26, 0.20 + dy, -0.10);
    g.add(tup);
  }
  const vurgu = box(0.015, 0.15, 0.11, m.accent);
  vurgu.position.set(0.335, 0.20, -0.10);
  g.add(vurgu);

  for (const s of [1, -1]) {
    const q = thrusterQuad(m, 0.9);
    q.position.set(-0.12, s * 0.17, 0.02);
    g.add(q);
  }

  const root = finalize(g, 'probe', scale, m, { joints: {}, massClass: 'Voyager sınıfı (~800 kg)' });
  root.userData.notes = {
    regime: 'derin uzay sondası',
    why: 'Silueti üç kısıt belirler: alınan güç 1/r² düştüğü için çanak büyük olmalı; RTG’nin nötron ve gama akısı aletleri kirlettiği için ayrı bir boomun ucunda olmalı; manyetometre aracın kendi alanından kaçmak zorunda olduğu için en uzun eleman odur.',
  };
  return root;
}

/* ================================================================== */
/* Kayıt                                                               */
/* ================================================================== */

export const CRAFT_BUILDERS = Object.freeze({
  orbiter: buildOrbiter,
  lander: buildLander,
  rocket: buildRocket,
  cubesat: buildCubesat,
  capsule: buildCapsule,
  starship: buildStarship,
  rover: buildRover,
  marshelicopter: buildMarsHelicopter,
  probe: buildProbe,
});

export const CRAFT_LABELS = Object.freeze({
  orbiter: 'yörünge aracı', lander: 'iniş aracı', rocket: 'roket',
  cubesat: 'cubesat', capsule: 'kapsül', starship: 'starship sınıfı',
  rover: 'gezgin', marshelicopter: 'mars helikopteri', probe: 'derin uzay sondası',
});

/** İsimle kur; bilinmeyen ad basit bir yer tutucuya düşer. */
export function buildCraft(kind, opts = {}) {
  const fn = CRAFT_BUILDERS[kind];
  if (fn) return fn(opts);
  const m = makeMats(opts.palette);
  const g = new THREE.Group();
  g.add(box(1, 0.3, 0.3, m.body));
  return finalize(g, 'placeholder', opts.scale || 1, m);
}
