/* cockpit-scene.mjs — gözlem güvertesi kabuğu (cinematic-space-plan.md §7-8).

   İlke: kokpit AYNI aracındır. Malzeme dili craft-blocks paletinden
   (obsidyen-şampanya), geometri eksen yardımcılarıyla (core/geometry-axis).
   Pencere GERÇEK bir deliktir, ekran değil: dünya geçişi (Ay + gök) önce
   çizilir, kabuk derinlik temizlenip üstüne çizilir — delikten dünya
   pikselleri görünür. Ay'ın "pencerede durması" bir senkron değil, aynı
   sahnenin kendisidir.

   Yerel eksenler: koltuk/kamera orijinde oturur, pencere +Z yönündedir;
   grup lookAt(ay) ile döndürülünce pencere Ay'a bakar.

   İçerik disiplini: anlamsız HUD yok. Tek sıcak pano şeridi (bölüm konsolu
   Faz 3'te bu şeride oturacak), tek soğuk dolgu — ışık mantığı dış sahneyle
   aynı Güneş yönünü paylaşır. */

import * as THREE from 'three';

/* Eksen yardımcıları paylaşılan altyapıdan; craft paleti sözleşme gereği
   düşebilir bağımlılıktır (yer tutucu palet aynı aile). */
import { cylX, cylZ } from '../../core/geometry-axis.mjs';

const YEDEK_PALET = { body: 0x23252c, panel: 0x10151d, accent: 0xc9a35c, metal: 0x9aa0ab };

export function buildCockpitShell({ palette } = {}) {
  const p = { ...YEDEK_PALET, ...(palette || {}) };
  /* TASARIM KARARI (kullanıcı: "asla uydu içi gibi değil" — haklı):
     mürettebat iç mekânları AÇIK renklidir (ISS/Dragon dili) — koyu olan
     yalnız cam ekranlar ve uzayın kendisidir. Koyu-oyun-odası paleti
     atıldı; sıcak beyaz paneller + gri yapı + seyrek altın aksan. */
  const mat = {
    panel: new THREE.MeshStandardMaterial({ color: 0xd9d5cb, roughness: .74, metalness: .04 }),  // ana iç panel
    yapi:  new THREE.MeshStandardMaterial({ color: 0x9ba0a6, roughness: .5,  metalness: .35 }),  // kaburga/çerçeve
    govde: new THREE.MeshStandardMaterial({ color: 0xb9b5ac, roughness: .66, metalness: .1 }),   // ikincil panel
    koyu:  new THREE.MeshStandardMaterial({ color: 0x22262e, roughness: .55, metalness: .2 }),   // konsol gövdesi
    metal: new THREE.MeshStandardMaterial({ color: 0x8d939c, roughness: .34, metalness: .8 }),   // ray/tutamak
    aksan: new THREE.MeshStandardMaterial({ color: p.accent, roughness: .38, metalness: .62 }),
    /* cam ekran: koyu, hafif yansımalı yüzey + içinde kısık veri çizgileri */
    ekran: new THREE.MeshStandardMaterial({ color: 0x0a0e16, roughness: .18, metalness: .4 }),
    veri:  new THREE.MeshStandardMaterial({
      color: 0x0a0e16, roughness: .4, metalness: .1,
      emissive: new THREE.Color(0x9db8e8), emissiveIntensity: .5,
    }),
    veri2: new THREE.MeshStandardMaterial({
      color: 0x0a0e16, roughness: .4, metalness: .1,
      emissive: new THREE.Color(p.accent), emissiveIntensity: .45,
    }),
    pano:  new THREE.MeshStandardMaterial({
      color: 0x14181f, roughness: .5, metalness: .3,
      emissive: new THREE.Color(p.accent), emissiveIntensity: .12,
    }),
    /* cam IŞIKLAMASIZ saf ton (MeshBasic) — Standard spekülerinin diyagonal
       perde bastığı ölçülmüştü */
    cam:   new THREE.MeshBasicMaterial({
      color: 0x0a1420, transparent: true, opacity: .05,
      depthWrite: false, side: THREE.DoubleSide,
    }),
  };
  const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);

  const g = new THREE.Group();

  /* -- DUVAR İÇİNDE PENCERE: açıklığın çevresi TEK düzlemde dört plakayla
        kapatılır — hava-geçirmez maske. (İlk deneme açıktı: yan duvarlar
        41°'de başlıyordu, açıklık kenarı 19°'de bitiyordu ve aradaki
        boşluktan dünya sızıyordu; tavan da pencerenin üstüne sarkıp
        diyagonal parlak bant basıyordu — ikisi de ekran görüntüsüyle
        yakalandı.) -- */
  const W = .62, H = .34, Z = .45, KAL = .055;
  const DUV_W = 2.6, DUV_H = 1.6;                        // duvar zarfı: görüşü tamamen örter
  const ustPlaka = box(DUV_W, (DUV_H - H) / 2, .06, mat.panel);
  ustPlaka.position.set(0, .02 + H / 2 + (DUV_H - H) / 4, Z + .01);
  const altPlaka = box(DUV_W, (DUV_H - H) / 2, .06, mat.panel);
  altPlaka.position.set(0, .02 - H / 2 - (DUV_H - H) / 4, Z + .01);
  const solPlaka = box((DUV_W - W) / 2, H, .06, mat.panel);
  solPlaka.position.set(-W / 2 - (DUV_W - W) / 4, .02, Z + .01);
  const sagPlaka = box((DUV_W - W) / 2, H, .06, mat.panel);
  sagPlaka.position.set(W / 2 + (DUV_W - W) / 4, .02, Z + .01);
  g.add(ustPlaka, altPlaka, solPlaka, sagPlaka);

  /* -- panel derzleri: açık yüzeyi bölen ince gri çizgiler (dikişsiz dev
     plaka "ucuz" okunur; gerçek kabinler panel panosudur) -- */
  for (const dx of [-.78, -.44, .44, .78]) {
    const derz = box(.008, DUV_H, .062, mat.yapi);
    derz.position.set(dx, .02, Z + .012);
    g.add(derz);
  }
  const yatayDerz = box(DUV_W, .008, .062, mat.yapi);
  yatayDerz.position.set(0, .02 + H / 2 + .16, Z + .012);
  g.add(yatayDerz);

  /* -- KABURGALAR: duvara YASLI ince yapı şeritleri (ilk deneme içeri taşan
     döndürülmüş kamalardı — sağda parlak beyaz üçgen olarak patlıyordu,
     ölçüldü) -- */
  for (const dx of [-.68, .68]) {
    const kaburga = box(.04, DUV_H, .02, mat.yapi);
    kaburga.position.set(dx, .02, Z - .002);
    g.add(kaburga);
  }
  const tavanKemeri = box(DUV_W * .7, .04, .02, mat.yapi);
  tavanKemeri.position.set(0, .02 + H / 2 + .3, Z - .002);
  g.add(tavanKemeri);

  /* -- TUTUNMA RAYLARI (ISS imzası): pencere altı boydan boya + iki yanda
     dikey — mikro yerçekimi iç mekânının en tanıdık işareti -- */
  const rayY = .02 - H / 2 - .085;
  const ray = cylX(.011, .011, .9, 12, mat.metal);
  ray.position.set(0, rayY, Z - .05);
  for (const dx of [-.42, .42]) {
    const destek = box(.02, .03, .05, mat.yapi);
    destek.position.set(dx, rayY, Z - .025);
    g.add(destek);
  }
  g.add(ray);

  /* -- YAN KONSOLLAR: eğik yüzlü iki istasyon; her birinde koyu cam ekran
     (içinde kısık veri çizgileri) + şalter kümesi -- */
  for (const yan of [-1, 1]) {
    const govde = box(.34, .2, .16, mat.koyu);
    govde.position.set(yan * .52, -.2, .3);
    govde.rotation.set(-.35, yan * -.35, 0);
    g.add(govde);
    const ekran = box(.24, .002, .11, mat.ekran);
    ekran.position.set(yan * .5, -.135, .285);
    ekran.rotation.set(-.35, yan * -.35, 0);
    g.add(ekran);
    /* ekranda üç veri çizgisi: kısık mavi/altın — anlam iddiası yok,
       "açık konsol" dokusu */
    for (let i = 0; i < 3; i++) {
      const cizgi = box(.16 - i * .04, .003, .006, i === 1 ? mat.veri2 : mat.veri);
      cizgi.position.set(yan * (.5 - i * .01), -.132, .27 + i * .025);
      cizgi.rotation.set(-.35, yan * -.35, 0);
      g.add(cizgi);
    }
    /* şalter kümesi: 2×4 minik silindir başlık */
    for (let sx = 0; sx < 4; sx++) for (let sy = 0; sy < 2; sy++) {
      const salter = cylZ(.006, .007, .012, 10, sy ? mat.metal : mat.aksan);
      salter.position.set(yan * (.42 + sx * .033), -.245 - sy * .038, .345);
      salter.rotation.x = -.35;
      g.add(salter);
    }
  }
  /* -- pencere çerçevesi: açıklığın kenarına oturan yapı-gri biyeler -- */
  const cerMat = mat.yapi;
  const ust = box(W + 2 * KAL, KAL, .09, cerMat); ust.position.set(0, H / 2 + KAL / 2 + .02, Z);
  const alt = box(W + 2 * KAL, KAL, .09, cerMat); alt.position.set(0, -H / 2 - KAL / 2 + .02, Z);
  const sol = box(KAL, H, .09, cerMat); sol.position.set(-W / 2 - KAL / 2, .02, Z);
  const sag = box(KAL, H, .09, cerMat); sag.position.set(W / 2 + KAL / 2, .02, Z);
  /* çerçeve iç kenarı: ince metal biye — cam kenarı vurgusu.
     DİKKAT: EdgesGeometry LineSegments İSTER. Mesh ile çizilirse çizgi
     köşeleri üçgen listesi sanılır ve pencereye yarı saydam dev üçgenler
     basar — "diyagonal süt beyazı perde" tam olarak buydu; üç kez cam/halo
     sanıldı, görsel bisection buldu. */
  const biye = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(W, H, .002)),
    new THREE.LineBasicMaterial({ color: p.metal, transparent: true, opacity: .5 }));
  biye.position.set(0, .02, Z - .01);
  const cam = new THREE.Mesh(new THREE.PlaneGeometry(W, H), mat.cam);
  cam.position.set(0, .02, Z - .006);
  /* Orta kayıt YOK (kullanıcı: "cezaevi gibi" — iki koyu düşey çubuk tam
     olarak parmaklık okunuyordu, ölçüldü): tek panoramik cam. Köşelere
     küçük guseler rektangleri yumuşatır. */
  for (const [gx, gy] of [[-W / 2, H / 2], [W / 2, H / 2], [-W / 2, -H / 2], [W / 2, -H / 2]]) {
    const guse = box(.05, .05, .04, cerMat);
    guse.position.set(gx * .96, gy * .96 + .02, Z - .006);
    guse.rotation.z = Math.PI / 4;
    g.add(guse);
  }
  g.add(ust, alt, sol, sag, biye, cam);

  /* tavan gösterge şeridi: pencere üstünde 5 kısık durum LED'i — anlam
     taşımayan telemetri değil, yalnız "canlı panel" dokusu; kımıldamaz */
  for (let i = 0; i < 5; i++) {
    const led = box(.012, .006, .004, new THREE.MeshStandardMaterial({
      color: p.panel, roughness: .5, metalness: .3,
      emissive: new THREE.Color(i === 2 ? p.accent : 0x3a4a66), emissiveIntensity: .5,
    }));
    led.position.set(-.12 + i * .06, H / 2 + KAL + .045, Z - .002);
    g.add(led);
  }

  /* -- derinlik öğeleri: eğik yan duvarlar ve tavan pencereden GERİDE
        kalır (sarkma yasak), kabine hacim verirler — açık panel dili -- */
  const solDuvar = box(.06, DUV_H, .8, mat.govde); solDuvar.position.set(-.62, .0, -.05);
  solDuvar.rotation.y = .14;
  const sagDuvar = box(.06, DUV_H, .8, mat.govde); sagDuvar.position.set(.62, .0, -.05);
  sagDuvar.rotation.y = -.14;
  const tavan = box(DUV_W, .05, .8, mat.govde); tavan.position.set(0, .5, -.08);
  const taban = box(DUV_W, .05, .8, mat.koyu); taban.position.set(0, -.42, -.08);
  const arka = box(DUV_W, DUV_H, .05, mat.govde); arka.position.set(0, 0, -.5);
  g.add(solDuvar, sagDuvar, tavan, taban, arka);

  /* -- ana pult: açık gövde + geniş koyu CAM EKRAN (bölüm konsolu DOM'u
        bunun üstüne oturur) + iki tutamak + aksan çizgisi -- */
  const pult = box(.9, .05, .24, mat.panel);
  pult.position.set(0, -.22, .33); pult.rotation.x = -.42;
  const anaEkran = box(.6, .012, .13, mat.ekran);
  anaEkran.position.set(0, -.198, .333); anaEkran.rotation.x = -.42;
  const serit = box(.74, .006, .014, mat.pano);
  serit.position.set(0, -.176, .3); serit.rotation.x = -.42;
  const tutamakL = cylZ(.012, .012, .1, 12, mat.metal); tutamakL.position.set(-.38, -.16, .30);
  const tutamakR = cylZ(.012, .012, .1, 12, mat.metal); tutamakR.position.set(.38, -.16, .30);
  const aksanCizgi = box(.9, .008, .008, mat.aksan);
  aksanCizgi.position.set(0, -.248, .35); aksanCizgi.rotation.x = -.42;
  g.add(pult, anaEkran, serit, tutamakL, tutamakR, aksanCizgi);

  /* -- ışıklar kabukla gelir: kabuğu kullanan sahne kendi Güneş yönünü
        paylaşmalı; buradakiler iç aydınlatmadır -- */
  /* Pano ışığı YOK: küçük emissive şerit yeter; nokta ışık alt plakayı
     geniş bir sıcak sele çeviriyordu (ölçüldü). Tek iç ışık: pencereden
     giren Ay dolgusu hissi. */
  const ayDolgu = new THREE.PointLight(0x8fa3c8, .16, 2.2);
  ayDolgu.position.set(0, .05, .42);
  g.add(ayDolgu);

  return { group: g, glass: cam, panelStrip: serit, window: { w: W, h: H, z: Z } };
}

/* Dış gövdeye iliştirilen KANOPİ YAMASI: yaklaşmanın fiziksel hedefi.
   buildOrbiter'ın önüne konan koyu cam pano — kamera bunun içinden geçer,
   çerçeve ekranı doldururken iç kabuğa geçiş yapılır (geçiş maskesi). */
export function buildCanopyPatch({ palette } = {}) {
  const p = { ...YEDEK_PALET, ...(palette || {}) };
  const g = new THREE.Group();
  /* Çerçeve KOYU; cam ise AYNA-BENZERİ: yüksek metalness + düşük roughness,
     kamera yaklaşırken Güneş parıltısı yüzeyde GERÇEKTEN süpürülür — eşik
     karesi ölü siyah değil, yaşayan bir yansıma olur (kullanıcı geri
     bildirimi: "siyah ekran"). Maske yine karanlık okunur; parıltı onu
     deler, doldurmaz. */
  const cerceve = new THREE.Mesh(new THREE.BoxGeometry(.02, .12, .2),
    new THREE.MeshStandardMaterial({ color: p.panel, roughness: .55, metalness: .45 }));
  const cam = new THREE.Mesh(new THREE.BoxGeometry(.012, .095, .175),
    new THREE.MeshStandardMaterial({ color: 0x16263c, roughness: .07, metalness: .92 }));
  cam.position.x = .006;
  g.add(cerceve, cam);
  return g;
}
