/* hab-detail.mjs — HABİTAT AYRINTI KİTİ.
 *
 * Bir uzay yapısını gerçek gösteren şey kabuğu değil, kabuğun ÜSTÜNDEKİ
 * şeylerdir: korkuluk, kapak çarkı, konnektör paneli, kablo tavası,
 * uyarı levhası, ayak pabucu. Hepsi bir işe yarar ve o iş yüzünden
 * oradadır; süs olarak konulan hiçbir parça yok.
 *
 * Kit paylaşılır: her modül kendi greeble'ını yeniden yazmaz, buradan
 * çağırır. Böylece üs boyunca aynı korkuluk, aynı kapak, aynı levha
 * görünür — gerçek bir donanım ailesinde olduğu gibi (Benzerlik yasası
 * yalnız arayüzde değil, modelde de geçerli).
 *
 * three parametre olarak alınır; modül üstten three import etmez.
 * Eksen sözleşmesi: çıplak kurucu yok, core/geometry-axis.mjs.
 */

import { cylGeoX, cylGeoY, cylGeoZ, coneGeoZ } from '../core/geometry-axis.mjs';

const TAU = Math.PI * 2;

/* ── malzemeler ──────────────────────────────────────────────────────
   Kit kendi malzemelerini bir kez kurar ve paylaşır: her greeble için
   yeni malzeme üretmek çizim çağrısını da belleği de şişirir. */
export function detailMaterials(THREE) {
  const std = (c, r, m, ek = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...ek });
  return {
    /* Korkuluk SARI: EVA'da eldivenli elin ilk aradığı şey tutamaktır ve
       rengi standarttır — göz onu aramaz, bulur. */
    korkuluk: std(0xd8b24a, .42, .55),
    metal: std(0x9aa2ad, .48, .72),
    koyuMetal: std(0x454b55, .62, .68),
    conta: std(0x2a2e35, .88, .10),
    cam: std(0x8fb4c9, .06, .0, { transparent: true, opacity: .34 }),
    ikaz: std(0xc9563f, .70, .10),
    bakir: std(0xa86b3c, .40, .85),
    kablo: std(0x23262c, .92, .05),
  };
}

/* ── dokular ─────────────────────────────────────────────────────────── */

/** Uyarı/künye levhası: metin prosedürel çizilir, dosya çekilmez. */
export function levhaDokusu(THREE, satirlar, { zemin = '#d8d4cc', yazi = '#23262c', seritRenk = null } = {}) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = zemin; g.fillRect(0, 0, 256, 128);
  if (seritRenk) { g.fillStyle = seritRenk; g.fillRect(0, 0, 256, 16); g.fillRect(0, 112, 256, 16); }
  g.fillStyle = yazi;
  g.textAlign = 'center';
  const n = satirlar.length;
  satirlar.forEach((t, i) => {
    g.font = `${i === 0 ? 'bold ' : ''}${i === 0 ? 26 : 19}px "Segoe UI", sans-serif`;
    g.fillText(t, 128, 64 + (i - (n - 1) / 2) * 30 + 8);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Regolit yüzey kabartması. Düz bir kutu yüzey gerçek toprağa benzemez;
 * bump haritası ışığı kırar ve yüzeyi taneli gösterir. Değer-gürültü
 * kullanılır: rastgele piksel çok keskin, iki ölçekli değer-gürültü
 * doğal taneyi verir.
 */
export function regolitKabartma(THREE, boyut = 256, seed = 11) {
  const c = document.createElement('canvas');
  c.width = c.height = boyut;
  const g = c.getContext('2d');
  const im = g.createImageData(boyut, boyut);
  let s = seed >>> 0;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  /* iki ölçek: kaba blok + ince tane */
  const kaba = 16, kabaN = new Float32Array(kaba * kaba);
  for (let i = 0; i < kabaN.length; i++) kabaN[i] = rnd();
  for (let y = 0; y < boyut; y++) {
    for (let x = 0; x < boyut; x++) {
      const gx = (x / boyut) * kaba, gy = (y / boyut) * kaba;
      const x0 = Math.floor(gx) % kaba, y0 = Math.floor(gy) % kaba;
      const x1 = (x0 + 1) % kaba, y1 = (y0 + 1) % kaba;
      const fx = gx - Math.floor(gx), fy = gy - Math.floor(gy);
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const a = kabaN[y0 * kaba + x0], b = kabaN[y0 * kaba + x1];
      const cc = kabaN[y1 * kaba + x0], d = kabaN[y1 * kaba + x1];
      const buyuk = (a + (b - a) * sx) + ((cc + (d - cc) * sx) - (a + (b - a) * sx)) * sy;
      const v = Math.round(255 * (0.55 * buyuk + 0.45 * rnd()));
      const i = (y * boyut + x) * 4;
      im.data[i] = im.data[i + 1] = im.data[i + 2] = v;
      im.data[i + 3] = 255;
    }
  }
  g.putImageData(im, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/* ── parçalar ─────────────────────────────────────────────────────────
   Her işlev bir Group döndürür ve kendi orijininde oturur; çağıran yerine
   koyar. Ölçüler metre. */

/**
 * EVA korkuluğu. Gerçek uzay donanımında el rayı standarttır: Ø19 mm,
 * yüzeyden 57 mm açıklık — eldivenli el parmaklarını geçirebilsin diye.
 * Bu iki sayı biçimi tamamen belirler.
 */
export function korkuluk(THREE, M, uzunluk, { ayakSayisi = null } = {}) {
  const g = new THREE.Group();
  const R = 0.0095, ACIKLIK = 0.057;
  const bar = new THREE.Mesh(cylGeoX(R, R, uzunluk, 10), M.korkuluk);
  bar.position.z = ACIKLIK;
  bar.castShadow = true;
  g.add(bar);
  const n = ayakSayisi ?? Math.max(2, Math.round(uzunluk / 0.55));
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const ayak = new THREE.Mesh(cylGeoZ(R * 0.8, R * 1.3, ACIKLIK, 8), M.korkuluk);
    ayak.position.set((t - 0.5) * uzunluk * 0.92, 0, ACIKLIK / 2);
    ayak.castShadow = true;
    g.add(ayak);
  }
  g.userData.notes = { regime: 'EVA', why: 'Ø19 mm el rayı, yüzeyden 57 mm açıklık: eldivenli el parmağını geçirebilsin.' };
  return g;
}

/**
 * Basınçlı kapak. Çark, kilit dilleri ve conta halkası görünür; kapak
 * İÇE açılır çünkü basınç onu contaya bastırır. Dışa açılan kapıyı
 * 101 kPa × kapak alanı koparırdı — Ø0,8 m kapakta 51 kN.
 */
export function kapak(THREE, M, r, { cark = true, pencere = true } = {}) {
  const g = new THREE.Group();
  const flans = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.13, 10, 28), M.metal);
  g.add(flans);
  const contaH = new THREE.Mesh(new THREE.TorusGeometry(r * 0.93, r * 0.05, 8, 26), M.conta);
  g.add(contaH);
  const govde = new THREE.Mesh(cylGeoZ(r * 0.88, r * 0.88, r * 0.22, 26), M.koyuMetal);
  govde.position.z = r * 0.06;
  govde.castShadow = true;
  g.add(govde);
  /* kilit dilleri: çevrede eşit, çark döndükçe dışa iter */
  for (let i = 0; i < 8; i++) {
    const a = i * TAU / 8;
    const dil = new THREE.Mesh(new THREE.BoxGeometry(r * 0.17, r * 0.09, r * 0.3), M.metal);
    dil.position.set(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9, r * 0.06);
    dil.rotation.z = a;
    g.add(dil);
  }
  if (cark) {
    const c = new THREE.Mesh(new THREE.TorusGeometry(r * 0.42, r * 0.045, 8, 22), M.korkuluk);
    c.position.z = r * 0.2;
    g.add(c);
    for (let i = 0; i < 4; i++) {
      const a = i * TAU / 4 + Math.PI / 8;
      const kol = new THREE.Mesh(cylGeoX(r * 0.03, r * 0.03, r * 0.42, 8), M.korkuluk);
      kol.position.set(Math.cos(a) * r * 0.21, Math.sin(a) * r * 0.21, r * 0.2);
      kol.rotation.z = a;
      g.add(kol);
    }
  }
  if (pencere) {
    const p = new THREE.Mesh(cylGeoZ(r * 0.2, r * 0.2, r * 0.1, 18), M.cam);
    p.position.z = r * 0.2;
    g.add(p);
  }
  g.userData.notes = { regime: 'basınçlı', why: 'Kapak İÇE açılır: basınç onu contaya bastırır. Dışa açsaydı Ø0,8 m\'de 51 kN onu koparırdı.' };
  return g;
}

/**
 * Gözlem penceresi. Tek cam değil: üç kat (basınç camı, yedek basınç
 * camı, çizilme camı) ve dışta kapak. Çerçeve kalın çünkü pencere
 * kabuğun en zayıf yeridir ve yükü etrafına dağıtmak gerekir.
 */
export function pencere(THREE, M, r) {
  const g = new THREE.Group();
  const cerceve = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.26, 10, 26), M.metal);
  g.add(cerceve);
  for (let i = 0; i < 3; i++) {
    const cam = new THREE.Mesh(cylGeoZ(r * 0.82, r * 0.82, r * 0.035, 22), M.cam);
    cam.position.z = r * 0.06 * (i - 1);
    g.add(cam);
  }
  /* Koruma kapağı SÜRGÜLÜdür, menteşeli değil. Menteşeli kapağı açık
     çizdiğimde kabuğun önünde havada duran koyu bir leke oluyordu; gerçek
     yüzey donanımında da menteşe tercih edilmez, çünkü açık kapak toz
     tutar ve EVA yolunu keser. Sürgü çerçevenin kendi oluğunda kayar. */
  const oluk = new THREE.Mesh(new THREE.TorusGeometry(r * 1.2, r * 0.1, 8, 26, Math.PI), M.koyuMetal);
  oluk.position.z = -r * 0.02;
  oluk.rotation.z = -Math.PI / 2;
  g.add(oluk);
  const surgu = new THREE.Mesh(
    new THREE.CircleGeometry(r * 1.04, 24, Math.PI * 0.62, Math.PI * 0.76), M.metal);
  surgu.position.z = r * 0.1;
  g.add(surgu);
  /* sürgü kolu — eldivenli elle çekilir */
  const kol = new THREE.Mesh(cylGeoY(r * 0.045, r * 0.045, r * 0.44, 8), M.korkuluk);
  kol.position.set(-r * 0.86, 0, r * 0.15);
  g.add(kol);

  g.userData.notes = { regime: 'basınçlı', why: 'Üç cam: iki basınç katı yedekli, dıştaki çizilme kurbanı. Kapak mikrometeorit ve güneş için.' };
  return g;
}

/**
 * Göbek bağı paneli: akışkan ve elektrik arayüzlerinin toplandığı yer.
 * Konnektörler farklı çapta ve ANAHTARLI olur — yanlış hattı yanlış
 * yuvaya takmak fiziksel olarak mümkün olmamalıdır.
 */
export function konnektorPaneli(THREE, M, w = 0.42, h = 0.3) {
  const g = new THREE.Group();
  const taban = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.035), M.koyuMetal);
  g.add(taban);
  const capi = [0.055, 0.042, 0.042, 0.03, 0.03, 0.03];
  capi.forEach((r, i) => {
    const cx = (-0.5 + ((i % 3) + 0.5) / 3) * w * 0.88;
    const cy = (i < 3 ? 0.22 : -0.22) * h;
    const k = new THREE.Mesh(cylGeoZ(r, r * 0.9, 0.05, 12), i < 3 ? M.bakir : M.metal);
    k.position.set(cx, cy, 0.04);
    g.add(k);
    const kilit = new THREE.Mesh(new THREE.TorusGeometry(r * 1.2, r * 0.18, 6, 14), M.metal);
    kilit.position.set(cx, cy, 0.05);
    g.add(kilit);
  });
  const kap = new THREE.Mesh(new THREE.BoxGeometry(w * 1.04, h * 0.1, 0.02), M.korkuluk);
  kap.position.set(0, -h * 0.55, 0.03);
  g.add(kap);
  g.userData.notes = { regime: 'arayüz', why: 'Konnektörler farklı çapta ve anahtarlı: yanlış hat yanlış yuvaya FİZİKSEL olarak girmez.' };
  return g;
}

/**
 * Kablo tavası. Kablo serbest bırakılmaz: tava onu tozdan, ayaktan ve
 * ısıl daralmadan korur; P kelepçeler belirli aralıkla tutar ve
 * aralarında sarkma payı bırakılır.
 */
export function kabloTavasi(THREE, M, uzunluk, { kablo = 3 } = {}) {
  const g = new THREE.Group();
  const w = 0.13;
  const taban = new THREE.Mesh(new THREE.BoxGeometry(uzunluk, w, 0.012), M.metal);
  g.add(taban);
  for (const s of [-1, 1]) {
    const yan = new THREE.Mesh(new THREE.BoxGeometry(uzunluk, 0.012, 0.05), M.metal);
    yan.position.set(0, s * w / 2, 0.025);
    g.add(yan);
  }
  for (let i = 0; i < kablo; i++) {
    const r = 0.014 - i * 0.002;
    const k = new THREE.Mesh(cylGeoX(r, r, uzunluk * 0.99, 8), M.kablo);
    k.position.set(0, (i - (kablo - 1) / 2) * 0.035, 0.018 + r);
    g.add(k);
  }
  const n = Math.max(2, Math.round(uzunluk / 0.8));
  for (let i = 0; i < n; i++) {
    const kel = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.005, 6, 12), M.metal);
    kel.position.set((i / (n - 1) - 0.5) * uzunluk * 0.95, 0, 0.03);
    kel.rotation.y = Math.PI / 2;
    g.add(kel);
  }
  g.userData.notes = { regime: 'kablaj', why: 'Tava kabloyu tozdan, ayaktan ve ısıl daralmadan korur; kelepçeler arasında sarkma payı kalır.' };
  return g;
}

/** Uyarı/künye levhası. */
export function levha(THREE, M, satirlar, { w = 0.3, h = 0.15, seritRenk = null, zemin, yazi } = {}) {
  const t = levhaDokusu(THREE, satirlar, { seritRenk, zemin, yazi });
  const mat = new THREE.MeshStandardMaterial({ map: t, roughness: .78, metalness: .05 });
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.006), mat);
  m.userData.notes = { regime: 'işletme', why: 'Levha bir süs değil: bakımcı hangi hattın ne taşıdığını gövdenin üstünden okur.' };
  return m;
}

/**
 * Basamaklı merdiven — hava kilidine iniş. Basamak aralığı 0,3 m:
 * basınçlı giysiyle diz açısı sınırlıdır, Dünya merdiveni işe yaramaz.
 */
export function merdiven(THREE, M, yukseklik, { genislik = 0.46 } = {}) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const dikme = new THREE.Mesh(cylGeoZ(0.016, 0.016, yukseklik, 8), M.korkuluk);
    dikme.position.set(s * genislik / 2, 0, yukseklik / 2);
    dikme.castShadow = true;
    g.add(dikme);
  }
  const n = Math.max(2, Math.round(yukseklik / 0.3));
  for (let i = 0; i < n; i++) {
    const z = (i + 0.5) * (yukseklik / n);
    const bas = new THREE.Mesh(cylGeoX(0.013, 0.013, genislik, 8), M.korkuluk);
    bas.position.set(0, 0, z);
    bas.castShadow = true;
    g.add(bas);
  }
  g.userData.notes = { regime: 'EVA', why: 'Basamak aralığı 0,30 m: basınçlı giyside diz açısı sınırlı, Dünya merdiveni tırmanılamaz.' };
  return g;
}

/**
 * İniş/oturma pabucu. Tabak biçimi yükü yayar; altındaki regolit halka
 * çökmeyi gösterir. Küresel mafsal oturma farkını yutar.
 */
export function ayakPabucu(THREE, M, r = 0.3, { regolitMat = null } = {}) {
  const g = new THREE.Group();
  const tabak = new THREE.Mesh(coneGeoZ(r, r * 0.34, 20), M.metal);
  tabak.position.z = r * 0.17;
  tabak.castShadow = true;
  g.add(tabak);
  const mafsal = new THREE.Mesh(new THREE.SphereGeometry(r * 0.22, 12, 10), M.koyuMetal);
  mafsal.position.z = r * 0.4;
  g.add(mafsal);
  if (regolitMat) {
    const halka = new THREE.Mesh(new THREE.TorusGeometry(r * 1.25, r * 0.16, 6, 20), regolitMat);
    halka.position.z = r * 0.03;
    halka.scale.z = 0.4;
    halka.receiveShadow = true;
    g.add(halka);
  }
  g.userData.notes = { regime: 'yapı', why: 'Tabak yükü yayar, küresel mafsal oturma farkını yutar; etrafındaki halka çöken regolittir.' };
  return g;
}

/** Seyrüsefer feneri — gece ve toz fırtınasında modülü işaretler. */
export function fener(THREE, M, { renk = 0xffc65a } = {}) {
  const g = new THREE.Group();
  const govde = new THREE.Mesh(cylGeoZ(0.035, 0.045, 0.07, 10), M.koyuMetal);
  g.add(govde);
  const cam = new THREE.Mesh(new THREE.SphereGeometry(0.036, 12, 8, 0, TAU, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: renk, emissive: renk, emissiveIntensity: 1.6, roughness: .3 }));
  cam.position.z = 0.035;
  g.add(cam);
  g.userData.notes = { regime: 'işletme', why: 'Toz fırtınasında görüş metrelerle ölçülür; fener modülün nerede bittiğini söyler.' };
  return g;
}

/**
 * MLI dikiş şeridi ve ayırıcı. Battaniye kabuğa yapışmaz: aradaki hava
 * boşluğu yalıtımın kendisidir, temas ısı köprüsü olur.
 */
export function mliSeridi(THREE, M, uzunluk, { n = null } = {}) {
  const g = new THREE.Group();
  const serit = new THREE.Mesh(new THREE.BoxGeometry(uzunluk, 0.05, 0.004),
    new THREE.MeshStandardMaterial({ color: 0xb9a878, roughness: .85, metalness: .2 }));
  g.add(serit);
  const adet = n ?? Math.max(2, Math.round(uzunluk / 0.45));
  for (let i = 0; i < adet; i++) {
    const d = new THREE.Mesh(cylGeoZ(0.008, 0.008, 0.03, 6), M.metal);
    d.position.set((i / (adet - 1) - 0.5) * uzunluk * 0.94, 0, -0.016);
    g.add(d);
  }
  g.userData.notes = { regime: 'ısıl', why: 'Ayırıcılar battaniyeyi kabuktan uzak tutar: temas eden yalıtım ısı köprüsüdür.' };
  return g;
}

/** Tutamak — tek elle kavranan kısa ray (kapak yanı, panel kenarı). */
export function tutamak(THREE, M, { uzunluk = 0.22 } = {}) {
  const g = new THREE.Group();
  const bar = new THREE.Mesh(cylGeoX(0.0095, 0.0095, uzunluk, 8), M.korkuluk);
  bar.position.z = 0.05;
  g.add(bar);
  for (const s of [-1, 1]) {
    const ayak = new THREE.Mesh(cylGeoZ(0.008, 0.012, 0.05, 6), M.korkuluk);
    ayak.position.set(s * uzunluk * 0.42, 0, 0.025);
    g.add(ayak);
  }
  return g;
}

export { TAU };
