// craft-effects.mjs — Motor ateşleme efekt sistemi (craft-blocks yol arkadaşı).
//
// DONMUŞ API:
//   buildEngineFX({ scale = 1, tip = 'vakum', seed = 1, palette } = {})
//     → { group, update(dt, { gaz, atesle }), dispose() }
//
//   • group: THREE.Group — orijin MOTOR AĞZINDA, alev −X yönünde uzar
//     (craft-blocks eksen sözleşmesiyle aynı: −X = egzoz).
//   • update(dt, { gaz, atesle }): her karede çağrılır. gaz 0..1 (throttle).
//     atesle false→true geçişinde ateşleme geçici rejimi (flaş + halka +
//     kıvılcım + basınçlanma aşımı), true→false geçişinde ~0.5 sn sönüm kuyruğu.
//   • dispose(): geometri / malzeme / doku / ışık temizliği.
//
//   tip: 'vakum'    — uzayda geniş açılı, seyrek genleşme şalı
//        'atmosfer' — dar huzme + mach elması hücreleri
//        'hover'    — iniş motoru: kısa, geniş, zemin etkisine uygun
//
// Bu bir akışkan simülasyonu DEĞİLDİR; adlandırılmış olguların (mach elması,
// vakum genleşmesi, çan kızarması) stilize, katmanlı bir gösterimidir.
// Deterministiktir: tüm rastgelelik seed'li (mulberry32), zaman yalnız
// update(dt) toplamından akar — Math.random / Date.now KULLANILMAZ.
// Alev diegetik ışıktır (motor gerçekten ışık kaynağıdır); veri işaretlerindeki
// sürekli-glow yasağı bu sahne efektine uygulanmaz. Parlaklık salınımı,
// epilepsi tetiklememek için ±%15 bandında tutulur.
//
// Craft-blocks malzemelerine DOKUNULMAZ: çan kızarması dahil her parça bu
// grubun kendi mesh'idir. Bütçe: FX başına ≤ 8 mesh (+ tek Points + tek Sprite).

import * as THREE from 'three';
import { CRAFT_PALETTE } from './craft-blocks.mjs';

/* ------------------------------------------------------------------ */
/* Deterministik yardımcılar                                           */
/* ------------------------------------------------------------------ */

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp01 = (x) => Math.min(1, Math.max(0, x));

/* ------------------------------------------------------------------ */
/* Tip tabloları — boyutlar scale=1 için, mutlak sahne birimi          */
/* ------------------------------------------------------------------ */

const TIPLER = Object.freeze({
  // vakum: genleşme oranı yüksek, huzme geniş açılır; şal ÇOK geniş ve soluk.
  vakum:    { boy: 0.95, agiz: 0.100, cikis: 0.21, isik: 1.0,
              sal: { boy: 1.15, agiz: 0.13, cikis: 0.55, op: 0.14 }, elmas: false },
  // atmosfer: dış basınç huzmeyi sıkar → dar koni + mach elması hücreleri.
  atmosfer: { boy: 1.35, agiz: 0.085, cikis: 0.105, isik: 1.15,
              sal: null, elmas: true },
  // hover: iniş motoru; kısa/küt huzme, zemin etkisine uygun geniş şal.
  hover:    { boy: 0.50, agiz: 0.115, cikis: 0.22, isik: 1.3,
              sal: { boy: 0.55, agiz: 0.15, cikis: 0.34, op: 0.16 }, elmas: false },
});

/* ------------------------------------------------------------------ */
/* Doku üretimi (CanvasTexture — deterministik gradyanlar, resim yok)  */
/* ------------------------------------------------------------------ */

function rgba(renk, a) {
  const c = renk.isColor ? renk : new THREE.Color(renk);
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
}

// Dikey gradyan: y=0 (canvas tepesi) alev AĞZI, y=256 kuyruk ucu.
// flipY=true varsayılanıyla canvas tepesi v=1'e, yani koninin ağız ucuna düşer.
function dogrusalDoku(duraklar) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 16; c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  for (const [t, renk] of duraklar) g.addColorStop(t, renk);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 16, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Radyal parlama (ateşleme flaşı sprite'ı için).
function radyalDoku(merkezRenk) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, rgba(merkezRenk, 0.85));
  g.addColorStop(0.6, rgba(merkezRenk, 0.22));
  g.addColorStop(1.0, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ------------------------------------------------------------------ */
/* buildEngineFX                                                       */
/* ------------------------------------------------------------------ */

export function buildEngineFX({ scale = 1, tip = 'vakum', seed = 1, palette } = {}) {
  const T = TIPLER[tip] || TIPLER.vakum;
  const p = { ...CRAFT_PALETTE, ...(palette || {}) };
  const rng = mulberry32((seed | 0) || 1);
  const s = scale;

  // Renk ailesi: beyaz-sıcak çekirdek → palet vurgusuna soğuyan kuyruk.
  const accent = new THREE.Color(p.accent);
  const sicak  = new THREE.Color(0xffdcb2).lerp(accent, 0.30);  // ağız yakını
  const orta   = new THREE.Color(0xffa25a).lerp(accent, 0.45);  // gövde
  const kuyruk = new THREE.Color(0xb0561e).lerp(accent, 0.55);  // uç
  const isikRenk = new THREE.Color(0xffb46b).lerp(accent, 0.25);
  const korSoguk = new THREE.Color(0x8f1e08);                    // çan: derin kızıl
  const korSicak = new THREE.Color(0xffc27a);                    // çan: sarı-ak

  const group = new THREE.Group();
  group.name = `craft-fx:${tip}`;
  group.userData = { preset: 'craft-effects', tip, seed };
  group.visible = false;

  const kaynaklar = [];                       // dispose listesi
  const iz = (x) => { if (x) kaynaklar.push(x); return x; };

  // Koni kurucu: ağız x=0'da, çıkış x=−boy'da (−X egzoz sözleşmesi).
  function koni(agizR, cikisR, boy, mat, seg = 24) {
    const geo = iz(new THREE.CylinderGeometry(agizR, cikisR, boy, seg, 6, true));
    geo.rotateZ(-Math.PI / 2);                // +Y (ağız ucu) → +X
    geo.translate(-boy / 2, 0, 0);            // ağız orijinde
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.fx = true;
    mesh.frustumCulled = false;               // ölçek animasyonunda kırpılmasın
    return mesh;
  }

  /* --- 1) Çekirdek: parlak iç koni (gradyan doku, additive) --------- */
  const alevTex = iz(dogrusalDoku([
    [0.00, 'rgba(255,255,255,1)'],
    [0.22, rgba(sicak, 0.95)],
    [0.50, rgba(orta, 0.70)],
    [0.80, rgba(kuyruk, 0.34)],
    [1.00, 'rgba(0,0,0,0)'],                  // additive'de siyah = görünmez
  ]));
  const cekMat = iz(new THREE.MeshBasicMaterial({
    map: alevTex, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }));
  const cekirdek = koni(T.agiz * s, T.cikis * s, T.boy * s, cekMat, 24);
  cekirdek.renderOrder = 9;
  group.add(cekirdek);

  // İç dil: daha dar, daha parlak — merkez beyaz-sıcak okunsun.
  const icMat = iz(new THREE.MeshBasicMaterial({
    map: alevTex, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }));
  const icAlev = koni(T.agiz * 0.55 * s, T.cikis * 0.42 * s, T.boy * 0.72 * s, icMat, 18);
  icAlev.renderOrder = 10;
  group.add(icAlev);

  /* --- 2) Mach elmasları ('atmosfer'): tek InstancedMesh ------------ */
  let elmaslar = null, elmasMat = null;
  const dummy = new THREE.Object3D();
  if (T.elmas) {
    const elmasGeo = iz(new THREE.SphereGeometry(1, 10, 8));
    elmasMat = iz(new THREE.MeshBasicMaterial({
      color: 0xfff0d6, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    elmaslar = new THREE.InstancedMesh(elmasGeo, elmasMat, 8);
    elmaslar.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    elmaslar.userData.fx = true;
    elmaslar.frustumCulled = false;
    elmaslar.renderOrder = 11;
    group.add(elmaslar);
  }

  /* --- 3) Dış genleşme şalı ('vakum'/'hover') ----------------------- */
  let sal = null, salMat = null;
  if (T.sal) {
    salMat = iz(new THREE.MeshBasicMaterial({
      map: alevTex, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }));
    sal = koni(T.sal.agiz * s, T.sal.cikis * s, T.sal.boy * s, salMat, 28);
    sal.renderOrder = 8;
    group.add(sal);
  }

  /* --- 4) Ateşleme geçici rejimi: flaş + halka + kıvılcım ----------- */
  const flasTex = iz(radyalDoku(sicak));
  const flasMat = iz(new THREE.SpriteMaterial({
    map: flasTex, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  const flas = new THREE.Sprite(flasMat);
  flas.userData.fx = true;
  flas.position.x = -0.06 * s;
  flas.visible = false;
  flas.renderOrder = 13;
  group.add(flas);

  const halkaGeo = iz(new THREE.RingGeometry(0.72, 1, 40));
  halkaGeo.rotateY(Math.PI / 2);              // halka normali X eksenine
  const halkaMat = iz(new THREE.MeshBasicMaterial({
    color: sicak, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }));
  const halka = new THREE.Mesh(halkaGeo, halkaMat);
  halka.userData.fx = true;
  halka.frustumCulled = false;
  halka.position.x = -0.04 * s;
  halka.visible = false;
  halka.renderOrder = 12;
  group.add(halka);

  // Kıvılcım patlaması: tek BufferGeometry + Points; yönler seed'li,
  // hareket yalnız mesh ölçeğiyle (öznitelik güncellemesi yok → ucuz).
  const KIV_N = 56;
  const kivPoz = new Float32Array(KIV_N * 3);
  for (let i = 0; i < KIV_N; i++) {
    const v = new THREE.Vector3(
      -(0.35 + rng() * 0.9),                  // −X yarıküresine eğimli
      (rng() * 2 - 1) * 0.75,
      (rng() * 2 - 1) * 0.75,
    ).normalize().multiplyScalar(0.45 + 0.55 * rng());
    kivPoz.set([v.x, v.y, v.z], i * 3);
  }
  const kivGeo = iz(new THREE.BufferGeometry());
  kivGeo.setAttribute('position', new THREE.BufferAttribute(kivPoz, 3));
  const kivMat = iz(new THREE.PointsMaterial({
    color: 0xffd9a6, size: 0.05 * s, sizeAttenuation: true,
    map: flasTex,                             // radyal doku: kare piksel değil yumuşak nokta
    transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  const kivilcim = new THREE.Points(kivGeo, kivMat);
  kivilcim.userData.fx = true;
  kivilcim.frustumCulled = false;
  kivilcim.visible = false;
  kivilcim.renderOrder = 12;
  group.add(kivilcim);

  /* --- 6) Çan kızarması: motor çanının iç ağzına oturan emissive koni */
  // craft-blocks malzemelerine dokunmaz; bu grup içinde ayrı mesh'tir.
  const korDerinlik = T.agiz * 0.9 * s;
  const korGeo = iz(new THREE.CylinderGeometry(
    T.agiz * 0.5 * s, T.agiz * 0.96 * s, korDerinlik, 20, 1, true));
  korGeo.rotateZ(-Math.PI / 2);               // dar uç +X'e (çanın boğazına doğru)
  // Ağız dudağından hafif taşar: kor, yandan bakışta da ince bir halka olarak okunur.
  korGeo.translate(korDerinlik / 2 - 0.014 * s, 0, 0);
  const korMat = iz(new THREE.MeshStandardMaterial({
    color: 0x0a0503, emissive: korSoguk.clone(), emissiveIntensity: 0,
    roughness: 0.9, metalness: 0.0, side: THREE.DoubleSide,
  }));
  const canKor = new THREE.Mesh(korGeo, korMat);
  canKor.userData.fx = true;
  canKor.visible = false;
  group.add(canKor);

  /* --- 5) Işık: tek PointLight, alev rengi, decay 2 ------------------ */
  const isik = new THREE.PointLight(isikRenk, 0, 9 * s, 2);
  isik.position.x = -0.35 * T.boy * s;
  group.add(isik);

  /* ------------------------------------------------------------------ */
  /* Durum ve titreşim (12–30 Hz bandı, seed'li; parlaklık ±%15)         */
  /* ------------------------------------------------------------------ */

  let t = 0;                                  // yalnız update(dt) toplamı
  let basinc = 0;                             // düzgünleştirilmiş throttle
  let isi = 0;                                // çan ısısı (gecikmeli)
  let oncekiAtes = false;
  let igT = Infinity;                         // ateşlemeden bu yana geçen süre

  const f1 = 12 + rng() * 6;                  // 12–18 Hz
  const f2 = 22 + rng() * 8;                  // 22–30 Hz
  const faz1 = rng() * Math.PI * 2;
  const faz2 = rng() * Math.PI * 2;
  const gur = Array.from({ length: 64 }, () => rng() * 2 - 1);
  const gurultu = (x) => {                    // seed'li düzgün değer gürültüsü
    const i0 = Math.floor(x);
    const f = x - i0;
    const a = gur[((i0 % 64) + 64) % 64];
    const b = gur[(((i0 + 1) % 64) + 64) % 64];
    const u = f * f * (3 - 2 * f);
    return a + (b - a) * u;
  };

  function update(dt, durum = {}) {
    dt = Math.max(0, Math.min(dt || 0, 0.1));
    const gaz = clamp01(durum.gaz ?? 0);
    const ates = !!durum.atesle;
    t += dt;
    if (ates && !oncekiAtes) igT = 0;         // ateşleme kenarı
    oncekiAtes = ates;
    if (igT !== Infinity) igT += dt;

    // Basınç dinamiği: hızlı basma (~70 ms), sönümde ~0.5 sn görünür kuyruk.
    const hedef = ates ? gaz : 0;
    const tau = hedef > basinc ? 0.07 : 0.16;
    basinc += (hedef - basinc) * (1 - Math.exp(-dt / tau));

    // Ateşleme geçici rejimi: flaş zarfı + kısa basınçlanma aşımı.
    const flasEnv = ates && igT < 0.6 ? Math.exp(-igT / 0.09) : 0;
    const asim = ates && igT < 0.4 ? 0.3 * gaz * Math.exp(-igT / 0.12) : 0;
    const pG = Math.min(basinc + asim, 1.25); // görsel basınç (aşım payıyla)
    const pN = Math.min(pG, 1);

    // Çan ısısı: yavaş ısınır (~0.9 sn), daha yavaş soğur (~2.4 sn).
    const isiHedef = ates ? gaz : 0;
    isi += (isiHedef - isi) * (1 - Math.exp(-dt / (isiHedef > isi ? 0.9 : 2.4)));

    // Titreşim: iki sinüs (12–30 Hz) + gürültü; parlaklık salınımı ±%15.
    const flick =
      0.55 * Math.sin(2 * Math.PI * f1 * t + faz1) +
      0.30 * Math.sin(2 * Math.PI * f2 * t + faz2) +
      0.15 * gurultu(t * 9);
    const parla = 1 + 0.15 * Math.max(-1, Math.min(1, flick));

    const canli = pG > 0.004 || flasEnv > 0.004 || isi > 0.02;
    group.visible = canli;
    if (!canli) { isik.intensity = 0; return; }

    // Çekirdek: gaz ile boy/çap, seed'li boy titremesi.
    const boyF = (0.32 + 0.78 * pN) * (1 + 0.05 * gurultu(t * 7 + 17));
    const radF = 0.55 + 0.45 * pN;
    cekirdek.scale.set(boyF, radF, radF);
    cekMat.opacity = clamp01(0.8 * pN * parla + 0.35 * flasEnv);
    icAlev.scale.set(boyF * 1.05, radF, radF);
    icMat.opacity = clamp01(0.95 * pN * parla + 0.5 * flasEnv);

    // Dış genleşme şalı.
    if (sal) {
      sal.scale.set(boyF * 0.95, 0.6 + 0.4 * pN, 0.6 + 0.4 * pN);
      salMat.opacity = T.sal.op * pN * parla;
    }

    // Mach elmasları: gazla sayı ve aralık değişir; uca doğru küçülürler.
    if (elmaslar) {
      const n = pN > 0.06 ? Math.min(8, Math.round(2 + 5 * pN)) : 0;
      // Hücreler alevin parlak %80'lik bölümünde kalsın — kuyrukta kopuk top görünmesin.
      const huzmeBoyu = T.boy * s * boyF * 0.8;
      const aralik = huzmeBoyu / (n + 1.2);
      for (let i = 0; i < 8; i++) {
        if (i < n) {
          dummy.position.set(-aralik * (i + 0.85), 0, 0);
          dummy.scale.set(
            aralik * 0.46 * (1 - 0.05 * i),
            T.agiz * s * radF * (0.74 - 0.05 * i),
            T.agiz * s * radF * (0.74 - 0.05 * i),
          );
        } else {
          dummy.position.set(0, 0, 0);
          dummy.scale.setScalar(0.0001);
        }
        dummy.updateMatrix();
        elmaslar.setMatrixAt(i, dummy.matrix);
      }
      elmaslar.instanceMatrix.needsUpdate = true;
      elmasMat.opacity = clamp01(0.85 * pN * parla);
    }

    // Ateşleme flaşı (~0.3 sn) + açılan halka + kıvılcım patlaması.
    if (flasEnv > 0.004) {
      flas.visible = true;
      const acilim = 1 - Math.exp(-igT / 0.05);
      flas.scale.setScalar(s * (0.5 + 2.0 * acilim));
      flasMat.opacity = clamp01(1.2 * flasEnv);
    } else flas.visible = false;
    if (ates && igT < 0.7) {
      halka.visible = true;
      halka.scale.setScalar(s * (0.18 + 2.6 * igT));
      halkaMat.opacity = 0.85 * Math.exp(-igT / 0.13);
      kivilcim.visible = true;
      kivilcim.scale.setScalar(s * 1.8 * (0.06 + igT));
      kivMat.opacity = Math.exp(-igT / 0.22);
      kivMat.size = 0.05 * s * Math.max(0.2, 1 - igT);
    } else { halka.visible = false; kivilcim.visible = false; }

    // Çan kızarması: ısıyla derin kızıldan sarı-aka; hafif titreşimli.
    canKor.visible = isi > 0.02 || pG > 0.02;
    korMat.emissive.copy(korSoguk).lerp(korSicak, clamp01(isi * 1.15));
    korMat.emissiveIntensity = 3.2 * isi * (1 + 0.1 * flick * Math.min(1, pN * 2));

    // Işık: gaz + titreşim + flaş; decay 2 ile makul mesafe sönümü.
    isik.intensity = s * s * (T.isik * 6.0 * pN * parla + 26 * flasEnv);
  }

  function dispose() {
    if (group.parent) group.parent.remove(group);
    if (elmaslar) elmaslar.dispose();
    for (const k of kaynaklar) if (k && k.dispose) k.dispose();
    isik.dispose();
  }

  return { group, update, dispose };
}
