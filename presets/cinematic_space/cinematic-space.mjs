/* cinematic-space.mjs — Sinematik Uzay Sahnesi (cinematic_space, Faz 1).

   Sunumu tek ve sürekli bir uzamsal dünyada geçiren sistemin dış sahnesi:
   Ay sağ-merkezde baskın, uzay aracı solda "aktif tutunma" hâlinde, arkada
   cosmos gök kubbesi. Program ve tüm kararlar docs/cinematic-space-plan.md.

   KOMPOZİSYON, KOPYA DEĞİL:
   · Gök    → cosmos_advanced/mountCosmos (dekor deseni: UI gizli,
              active:false, dışarıdan advance ile sürülür)
   · Ay     → moon_advanced/buildMoonMesh + loadMoonTextures (Faz 0 dışa açımı)
   · Araç   → craft_blocks/buildOrbiter (import düşerse yer tutucu — sözleşme)
   · Kamera → camera-director.mjs keyframe rayı; kamera nefesi ve araç
              solunumu İKİNCİL katmanlardır, rayı süremezler.

   API:
     const cine = await mountCinematicSpace(host, { seed });
     cine.setProgress(p)   // 0..1 ray: dış → kadraj → yaklaşma → eşik → kokpit
     cine.goTo('cockpit')  // anlatı geçişi (3.5 sn); 'exterior' geri sarımdır
     cine.back()           // pull-out
     cine.advance(dt)      // deterministik kare sürme (test/export)
     cine.play()/pause() · cine.setActive(bool) · cine.dispose()

   Ray çizelgesi (plan §4): 0 dış idle · .15 yeniden kadraj · .30 yaklaşma ·
   .50 kanopi kadrajı doldurur · .62 eşik (kabuk devrede, araç gizlenir) ·
   .78 kokpit oturur · 1 pult eğilimi. Tekerlek ve sürgü aynı rayı sürer.

   Determinizm: tüm hareket t'nin ve seed'in saf fonksiyonu; goTo geçişi de
   sim zamanıyla ilerler (advance altında aynı kareler). İşaretçi paralaksı
   KALDIRILDI (kullanıcı yönergesi) — yerine araç solunumu: saf f(t) olduğu
   için export yolunda da aynıdır.
   ?p=0.78&t=12&export=1 → donuk deterministik kare (data-frozen-at).
   ?durum=cockpit → p=1 başlangıcı.

   ÖLÇEK DÜRÜSTLÜĞÜ: araç–Ay oranı SİNEMATİKTİR (gerçek oranda araç tek
   piksel bile olmazdı); altyazı ve manifest bunu açıkça söyler. */

import * as THREE from 'three';
import { coneZ, cylX, cylZ } from '../core/geometry-axis.mjs';
import { mountCosmos } from '../cosmos_advanced/cosmos-sky.mjs';
import { loadMoonTextures, buildMoonMesh } from '../moon_advanced/lunaris-moon.mjs';
import { createIdleModel } from './spatial-idle.mjs';
import { createCameraDirector } from './camera-director.mjs';
import { buildCockpitShell, buildCanopyPatch } from './cockpit/cockpit-scene.mjs';
import { buildChapterConsole } from './cockpit/chapter-console.mjs';
import { createChapterRouter } from './chapter-router.mjs';
import { buildSurfaceScene } from './surface-scene.mjs';

/* Varsayılan bölümler — veri güdümlü; deste kendi listesini options.chapters
   ile verir. Tip kayıt defterinde yoksa konsolda dürüstçe pasif görünür
   (surface Faz 4'te, craft Faz 5'te açılır). */
const VARSAYILAN_BOLUMLER = [
  { id: 'orbit', label: 'Yörünge Dinamiği', sublabel: 'Alçak Ay yörüngesi · orbital_stage',
    grammar: 'pass-through', destination: { type: 'orbital-stage', spec: { central: 'moon' } } },
  { id: 'surface', label: 'Ay Yüzeyi', sublabel: 'Dalış ve gezgin vista',
    grammar: 'dive', internal: true, destination: { type: 'rover' } },
  { id: 'systems', label: 'Araç Sistemleri', sublabel: 'Alt sistem yakın planı',
    grammar: 'approach', destination: { type: 'craft' } },
];

const prefersReduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const domExport = () =>
  new URLSearchParams(location.search).get('export') === '1'
  || document.documentElement.dataset.export === 'true';

/* Yer tutucu araç — craft_blocks yüklenemezse (blok sözleşmesi: sert
   bağımlılık yok). +X ileri, en uzun boyut ≈ 1. */
function yedekCraft() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x23252c, roughness: .55, metalness: .35 });
  const govde = new THREE.Mesh(new THREE.BoxGeometry(.6, .22, .22), mat);
  const panel = new THREE.MeshStandardMaterial({ color: 0x10151d, roughness: .38, metalness: .55 });
  const k1 = new THREE.Mesh(new THREE.BoxGeometry(.02, .05, .5), panel); k1.position.z = .38;
  const k2 = k1.clone(); k2.position.z = -.38;
  g.add(govde, k1, k2);
  return g;
}

export async function mountCinematicSpace(host, options = {}) {
  if (!host) throw new Error('mountCinematicSpace requires a container element');
  const q = new URLSearchParams(location.search);
  const seed = options.seed ?? (Number(q.get('seed')) || 20260816);
  const exportMode = options.exportMode ?? domExport();
  const reducedMotion = prefersReduced();
  const assetBaseUrl = options.assetBaseUrl || '../moon_react_source/public/lunaris';

  /* -------- DOM iskeleti: gök katmanı (DOM) + sahne tuvali + altyazı */
  const root = document.createElement('figure');
  root.className = 'cine-space';
  root.dataset.export = exportMode ? 'true' : 'false';
  root.tabIndex = 0;
  root.dataset.ownsKeys = '';
  root.setAttribute('aria-label', options.title || 'Sinematik uzay sahnesi: Ay ve tutunan uzay aracı');
  /* SAHNE 16:9 YAZARLANIR (deste sözleşmesi): kadraj her kapta aynı kalsın
     diye kamera oranı sabittir, stage konteynerin içine letterbox'lanır. */
  root.innerHTML = `
    <div class="cine-space__stage">
      <div class="cine-space__sky" aria-hidden="true"></div>
      <div class="cine-space__canvas" aria-hidden="true"></div>
      <div class="cine-space__ctl" data-export-hide>
        <button type="button" data-action="pause" aria-pressed="false">Duraklat</button>
        <label>İlerleme <input data-input="p" type="range" min="0" max="1" step="0.005" value="0"
          aria-label="Kamera rayı ilerlemesi"></label>
      </div>
      <div class="cine-space__filtre" role="group" aria-label="Gözlem filtresi" hidden>
        <span>GÖZLEM FİLTRESİ</span>
        <button type="button" data-filtre="aesthetic" aria-pressed="true">Doğal</button>
        <button type="button" data-filtre="gravity" aria-pressed="false">Yerçekimi</button>
      </div>
      <div class="cine-space__gezgin" role="group" aria-label="Gezgin komutları" hidden>
        <span>GEZGİN</span>
        <button type="button" data-gezgin="farlar" aria-pressed="false">Farlar</button>
        <button type="button" data-gezgin="tarama" aria-pressed="true">Direk taraması</button>
      </div>
      <div class="cine-space__vinyet" aria-hidden="true"></div>
      <figcaption class="cine-space__truth"></figcaption>
    </div>`;
  host.appendChild(root);
  const stage = root.querySelector('.cine-space__stage');
  const skyHost = root.querySelector('.cine-space__sky');
  const canvasHost = root.querySelector('.cine-space__canvas');
  const truthEl = root.querySelector('.cine-space__truth');
  const vinyet = root.querySelector('.cine-space__vinyet');
  const filtreKutu = root.querySelector('.cine-space__filtre');
  const gezginKutuEl = root.querySelector('.cine-space__gezgin');

  /* -------- gök: cosmos, dekor deseniyle (UI gizli, dışarıdan sürülür) */
  /* Gök bir FONDUR, kahraman değil: yoğunluk ve bant parlaklığı kısılır ki
     Ay ve araç silüet ayrımını gökle yarışmadan kursun. */
  const cosmos = await mountCosmos(skyHost, {
    active: false, drift: 0, activity: .7, seed,
    density: options.starDensity ?? .65,
    milkyWayIntensity: options.milkyWayIntensity ?? .45,
    exportMode,
  });
  {
    const cv = cosmos.figure.querySelector('.lunaris-preset__canvas');
    [...cosmos.figure.children].forEach(el => {
      if (el !== cv && el.tagName !== 'STYLE') el.style.display = 'none';
    });
    /* gök katmanı salt dekordur: odak zinciri içine GİRMEZ (Tab, gizli
       cosmos figürüne düşüyordu — ölçüldü) */
    skyHost.inert = true;
  }
  cosmos.advance(0.001);

  /* -------- doku + sahne */
  const { gravityMap, aestheticMap, displacementMap } = await loadMoonTextures({ assetBaseUrl });
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;                     // yalnız yüzey Güneş'i gölge atar (dünya ışıkları atmaz)
  canvasHost.appendChild(renderer.domElement);
  const scene = new THREE.Scene();                       // fon şeffaf: gök DOM katmanından
  const camera = new THREE.PerspectiveCamera(42, 16 / 9, .05, 400);

  /* Işık mantığı TEK: Güneş sağ-üstten (Ay'ın kameraya dönük yüzünü ve
     aracın sağ yanağını yakar — silüet ayrımı), soluk soğuk dolgu soldan. */
  scene.add(new THREE.AmbientLight('#ffffff', .28));
  const sun = new THREE.DirectionalLight('#fff4e0', 2.1);
  sun.position.set(6, 2.6, 3.8);
  scene.add(sun);
  const fill = new THREE.PointLight('#445588', .4);
  fill.position.set(-7, -2, 1);
  scene.add(fill);

  /* -------- Ay: sağ-merkezde baskın; dönme fark edilmeyecek kadar yavaş */
  const moonParts = buildMoonMesh({
    gravityMap, aestheticMap, displacementMap,
    textureMode: 'aesthetic', relief: .03, cinematic: true,
  });
  const moonGroup = moonParts.group;
  moonGroup.scale.setScalar(2.6);
  moonGroup.position.set(2.35, .12, -6.6);
  const moonSpinBase = .34;
  scene.add(moonGroup);

  /* -------- araç: solda, burnu (+X) hafifçe Ay'a dönük */
  let craft, craftPalette = null;
  try {
    const cb = await import('../craft_blocks/craft-blocks.mjs');
    craft = cb.buildOrbiter({ scale: 1 });
    craftPalette = cb.CRAFT_PALETTE;
  } catch {
    console.warn('craft_blocks yüklenemedi; yer tutucu araç kullanılıyor.');
    craft = yedekCraft();
  }
  const CRAFT_POS = new THREE.Vector3(-2.05, -.08, -3.35);
  const CRAFT_EULER = new THREE.Euler(0, -.32, .06);     // taban duruş: burun Ay'a çeyrek dönük
  const craftPivot = new THREE.Group();                  // idle offsetleri pivota uygulanır
  craftPivot.position.copy(CRAFT_POS);
  craft.rotation.copy(CRAFT_EULER);
  craftPivot.add(craft);
  scene.add(craftPivot);

  /* DETAY KATMANI v2 (kullanıcı: "yeterince detaylı değil") — orbiter FORK
     edilmez, üstüne giydirilir. Gerçek uydu silüetini kuran şeyler:
     ÇOK BANTLI MLI sargısı (tek ton folyo oyuncak okunur), kıçta kafes
     adaptör halkası + payanda, AĞIZLIKLI RCS pod'ları, çanak besleme
     sehpası + gimbal kolu, sensör mercekleri, panjurlu radyatör, nav
     flaşörü. Tümü eksen yardımcılarıyla. */
  const strobeMat = new THREE.MeshStandardMaterial({
    color: 0x1a1d24, roughness: .4, metalness: .2,
    emissive: new THREE.Color(0xffffff), emissiveIntensity: 0,
  });
  {
    const mat = {
      folyo1: new THREE.MeshStandardMaterial({ color: 0xc9a35c, roughness: .26, metalness: .85 }),
      folyo2: new THREE.MeshStandardMaterial({ color: 0xa87f3e, roughness: .38, metalness: .8 }),
      folyo3: new THREE.MeshStandardMaterial({ color: 0xdec080, roughness: .22, metalness: .88 }),
      radyator: new THREE.MeshStandardMaterial({ color: 0x10151d, roughness: .3, metalness: .6 }),
      govde: new THREE.MeshStandardMaterial({ color: 0x2a2d35, roughness: .5, metalness: .4 }),
      metal: new THREE.MeshStandardMaterial({ color: 0x9aa0ab, roughness: .3, metalness: .85 }),
      mercek: new THREE.MeshStandardMaterial({ color: 0x06090f, roughness: .1, metalness: .6 }),
    };
    const kutu = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);

    /* ÇOK BANTLI MLI: üç ayrı tonda, hafif farklı genişlikte kuşak —
       gerçek folyo sargısının düzensiz parlaklığı */
    const b1 = kutu(.05, .206, .206, mat.folyo1); b1.position.set(-.085, 0, 0);
    const b2 = kutu(.045, .204, .204, mat.folyo2); b2.position.set(-.035, 0, 0);
    const b3 = kutu(.035, .207, .207, mat.folyo3); b3.position.set(.006, 0, 0);
    craft.add(b1, b2, b3);

    /* KIÇ ADAPTÖR HALKASI + 4 payanda: motor bölgesine yapısal derinlik */
    const halka = cylX(.085, .095, .04, 20, mat.govde, true);
    halka.position.set(-.185, 0, 0);
    craft.add(halka);
    for (const a of [0, 1, 2, 3]) {
      const aci = a * Math.PI / 2 + Math.PI / 4;
      const payanda = cylX(.004, .004, .07, 8, mat.metal);
      payanda.position.set(-.16, Math.cos(aci) * .07, Math.sin(aci) * .07);
      payanda.rotation.y = .3 * Math.sin(aci);
      payanda.rotation.z = .3 * Math.cos(aci);
      craft.add(payanda);
    }

    /* RCS POD'LARI: köşelerde blok + her blokta 3 görünür ağızlık konisi */
    for (const [px, py, pz] of [[.15, .1, .1], [.15, -.1, -.1], [-.15, .1, -.1], [-.15, -.1, .1]]) {
      const blok = kutu(.03, .03, .03, mat.govde);
      blok.position.set(px, py, pz);
      craft.add(blok);
      const yonler = [[0, Math.sign(py), 0], [0, 0, Math.sign(pz)], [Math.sign(px), 0, 0]];
      for (const yn of yonler) {
        const agiz = coneZ(.006, .012, 8, mat.metal, true);
        agiz.position.set(px + yn[0] * .018, py + yn[1] * .018, pz + yn[2] * .018);
        agiz.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...yn));
        craft.add(agiz);
      }
    }

    /* ÇANAK SEHPASI: besleme noktasına üç ince payanda + gimbal kolu.
       (Çanak buildOrbiter'da +Z tarafında; sehpa o bölgeye kurulur.) */
    for (const a of [0, 2.09, 4.19]) {
      const bacak = cylX(.0022, .0022, .1, 6, mat.metal);
      bacak.position.set(.02 + Math.cos(a) * .04, Math.sin(a) * .04, .19);
      bacak.rotation.y = .9;
      bacak.rotation.z = a;
      craft.add(bacak);
    }
    const gimbal = cylX(.008, .008, .06, 10, mat.govde);
    gimbal.position.set(0, 0, .13); gimbal.rotation.x = Math.PI / 2;
    craft.add(gimbal);

    /* PANJURLU RADYATÖR: alt yüzde 6 ince şeritli koyu panel */
    for (let i = 0; i < 6; i++) {
      const serit = kutu(.028, .004, .12, mat.radyator);
      serit.position.set(-.06 + i * .032, -.112, 0);
      craft.add(serit);
    }

    /* SENSÖR TAKIMI: iki mercek kutusu + yıldız izleyiciler */
    for (const [px, pz, r] of [[.11, .06, .014], [.13, -.04, .01]]) {
      const kutucuk = kutu(.03, .03, .03, mat.govde);
      kutucuk.position.set(px, .105, pz);
      const mercekDisk = cylX(r, r, .006, 14, mat.mercek);
      mercekDisk.position.set(px + .017, .105, pz);
      craft.add(kutucuk, mercekDisk);
    }
    const izci = cylX(.014, .018, .045, 14, mat.govde);
    izci.position.set(-.02, .112, -.07); izci.rotation.z = .7;
    craft.add(izci);

    /* GİRİŞ KAPAĞI ÇEVRESİ: kanopiden giriyoruz — kapak çevresinde iki EVA
       tutunma rayı + burun yüzünde derz çizgileri + servis kutusu (boş
       yüzey "oyuncak" okunur; derz ve ray ölçek verir) */
    for (const dz of [-.14, .14]) {
      const evaRay = cylZ(.004, .004, .1, 10, mat.metal);
      evaRay.position.set(.305, .045, dz);
      craft.add(evaRay);
      for (const du of [-.045, .045]) {
        const ayak = kutu(.008, .008, .012, mat.govde);
        ayak.position.set(.3, .045, dz + du);
        craft.add(ayak);
      }
    }
    for (const dy of [-.075, .0, .075]) {
      const derz = kutu(.002, .002, .19, mat.govde);
      derz.position.set(.302, dy - .02, 0);
      craft.add(derz);
    }
    const servisKutu = kutu(.02, .05, .05, mat.govde);
    servisKutu.position.set(.3, -.075, -.1);
    craft.add(servisKutu);

    /* KAMÇI ANTENLER + nav flaşörü */
    const kamci1 = cylX(.0016, .0016, .34, 6, mat.metal);
    kamci1.position.set(-.1, .1, -.14); kamci1.rotation.z = 1.1;
    const kamci2 = kamci1.clone(); kamci2.position.set(-.1, .1, .14); kamci2.rotation.z = 1.3;
    const strobe = new THREE.Mesh(new THREE.SphereGeometry(.006, 10, 8), strobeMat);
    strobe.position.set(.05, .12, -.09);
    craft.add(kamci1, kamci2, strobe);
  }

  /* DÜZELTME ALEVİ: craft-effects'in gerçek motor FX'i, kıç (−X) egzozunda.
     Tutunma döngüsünün yanma zarfıyla sürülür — alev süs değil, aracın
     "eski yerine gelmesinin" nedenidir. */
  let motorFX = null;
  try {
    const ce = await import('../craft_blocks/craft-effects.mjs');
    motorFX = ce.buildEngineFX({ scale: .55, tip: 'vakum', seed });
    /* FX sözleşmesi: orijin MOTOR AĞZINDA, alev zaten −X'e uzar — ekstra
       döndürme YANLIŞTI (alev gövdenin içine bakıyordu, ölçüldü). */
    motorFX.group.position.set(-.2, 0, 0);
    craft.add(motorFX.group);
  } catch { /* FX yoksa yanma yalnız hareketle okunur */ }
  /* Vakum plümü TASARIM GEREĞİ soluktur (craft-effects sözleşmesi) ve bu
     kadrajdan okunmaz — ateşlemeyi her mesafeden satan şey IŞIKTIR: yanma
     zarfı bu sıcak ışığı sürer, gövde ve paneller turuncu yalanır. */
  const yanmaIsigi = new THREE.PointLight('#ffb066', 0, 1.6);
  yanmaIsigi.position.set(-.3, 0, 0);
  craft.add(yanmaIsigi);
  let oncekiYanma = 0;

  /* RCS DARBELERİ (plan §7, §26): tutunma anlatısının noktalama işareti —
     araç "kendini düzeltiyor" okunur. buildEngineFX ana motor alevidir
     (mach elmasları, gaz sürgüsü); RCS bambaşka bir fenomen: 0,35 sn'lik
     soğuk gaz püskürtmesi. Burada dört ağızlık + toplamsal minik koniler;
     takvim tohumdan türetilir ve her değer t'nin SAF fonksiyonudur —
     export altında da aynı karede aynı puf. */
  const rcs = { agizliklar: [], ARALIK: 9, SURE: .35 };
  {
    /* coneZ: eksen yardımcısı (çıplak kurucu YASAK — ratchet bunu kendi
       kodumuzda yakaladı, kural herkese işliyor). Tepe +Z ucundadır;
       her ağızlık, tepesi gövdeye bakacak şekilde püskürtme yönüne
       kuaterniyonla çevrilir. */
    const pufMat = () => new THREE.MeshBasicMaterial({ color: 0xcfe0ff,
      transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const yerlesim = [
      { pos: [.15, .1, .1],   yon: [0, 1, 0] },              // +Y'ye püskürtür
      { pos: [.15, -.1, -.1], yon: [0, -1, 0] },
      { pos: [-.15, .1, -.1], yon: [0, 0, -1] },
      { pos: [-.15, -.1, .1], yon: [0, 0, 1] },
    ];
    const arti_z = new THREE.Vector3(0, 0, 1);
    for (const y of yerlesim) {
      const m = coneZ(.012, .05, 10, pufMat(), true);
      m.position.set(...y.pos);
      /* tepe (+Z) gövdeye: koninin +Z'si püskürtmenin TERSİNE bakar */
      m.quaternion.setFromUnitVectors(arti_z, new THREE.Vector3(...y.yon).negate());
      craft.add(m);
      rcs.agizliklar.push(m);
    }
  }
  const rcsHash = k => {
    let h = (Math.imul(k, 2654435761) ^ seed) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 2246822519);
    return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
  };
  function rcsGuncelle(t) {
    const k = Math.floor(t / rcs.ARALIK);
    const baslangic = k * rcs.ARALIK + rcsHash(k) * rcs.ARALIK * .5;
    const e = (t - baslangic) / rcs.SURE;
    for (const m of rcs.agizliklar) m.material.opacity = 0;
    if (e >= 0 && e <= 1) {
      const m = rcs.agizliklar[Math.floor(rcsHash(k ^ 0x5bd1) * 4)];
      m.material.opacity = Math.sin(Math.PI * e) * .85;
      m.scale.setScalar(.6 + e * .8);
    }
  }

  /* Kanopi yaması: yaklaşmanın fiziksel hedefi — aracın burnunda koyu cam
     pano. Kamera bunun içinden geçer; çerçevesi ekranı doldururken kabuğa
     geçilir (geometri destekli maske, plan §6). */
  const canopy = buildCanopyPatch({ palette: craftPalette });
  canopy.position.set(.30, .045, 0);                     // araç yerelinde burun önü
  craft.add(canopy);
  const patchPos = canopy.position.clone().applyEuler(CRAFT_EULER).add(CRAFT_POS); // taban pozdaki dünya konumu
  const patchN = new THREE.Vector3(1, 0, 0).applyEuler(CRAFT_EULER);               // dışarı bakan normal

  /* keyframe yardımcıları (ray tanımlarının tamamı bunları kullanır) */
  const v = (vec) => [vec.x, vec.y, vec.z];
  const yak = (base, dir, k, yUp = 0) => v(base.clone().addScaledVector(dir, k).add(new THREE.Vector3(0, yUp, 0)));
  const yanVek = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), patchN).normalize();

  /* -------- kokpit kabuğu: ayrı sahne, İKİNCİ geçişte çizilir */
  const cockpitScene = new THREE.Scene();
  const cockpit = buildCockpitShell({ palette: craftPalette });
  const seatPos = patchPos.clone().addScaledVector(patchN, -.22);  // eşiğin hemen içi
  /* Pencere yönü GEOMETRİYLE seçilir: koltuktan Ay'ın açısal yarıçapı ~28°,
     pencere açıklığı ±19° — pencere Ay merkezine bakarsa her ışın Ay'a
     çarpar, limb görünmez (ilk denemede ölçüldü: pencere "doku duvarı"na
     dönüştü). Açıklık, merkezi limbin ötesine taşıyacak kadar yukarı-sola
     kaydırılır: alt-sağda Ay, üst-solda uzay. */
  const ayYon = moonGroup.position.clone().sub(seatPos).normalize();
  const sagVek = new THREE.Vector3().crossVectors(ayYon, new THREE.Vector3(0, 1, 0)).normalize();
  const ustVek = new THREE.Vector3().crossVectors(sagVek, ayYon).normalize();
  const pencereBakis = moonGroup.position.clone()
    .addScaledVector(sagVek, -1.15).addScaledVector(ustVek, 1.5);
  cockpit.group.position.copy(seatPos);
  cockpit.group.lookAt(pencereBakis);                    // pencere (+Z) limb kompozisyonuna bakar
  cockpitScene.add(cockpit.group);
  cockpitScene.add(new THREE.AmbientLight('#ffffff', .3));        // açık panel içi eşit dolgu
  const cockpitSun = new THREE.DirectionalLight('#fff4e0', .9);    // dışarıyla AYNI Güneş yönü
  cockpitSun.position.copy(sun.position);
  cockpitScene.add(cockpitSun);

  /* -------- bölüm konsolu + yönlendirici (plan §9-10) */
  const chapters = (options.chapters ?? VARSAYILAN_BOLUMLER).slice(0, 4);
  /* Pencerenin sahne-içi piksel dikdörtgeni: açıklık köşeleri kokpit
     uzayından kameraya PROJEKTE edilir — maske gerçek pencereye oturur,
     elle hizalanmış bir dikdörtgene değil. */
  function pencereDikdortgen() {
    const { w, h, z } = cockpit.window;
    const koseler = [[-w / 2, .02 - h / 2, z], [w / 2, .02 - h / 2, z],
                     [-w / 2, .02 + h / 2, z], [w / 2, .02 + h / 2, z]];
    let minX = 1, maxX = -1, minY = 1, maxY = -1;
    const vec = new THREE.Vector3();
    for (const [x, y, zz] of koseler) {
      cockpit.group.localToWorld(vec.set(x, y, zz)).project(camera);
      minX = Math.min(minX, vec.x); maxX = Math.max(maxX, vec.x);
      minY = Math.min(minY, vec.y); maxY = Math.max(maxY, vec.y);
    }
    const W = stage.clientWidth, H = stage.clientHeight;
    return {
      x: (minX + 1) / 2 * W, y: (1 - maxY) / 2 * H,
      w: (maxX - minX) / 2 * W, h: (maxY - minY) / 2 * H,
    };
  }
  const router = createChapterRouter({
    stage, chapters, seed, reducedMotion, exportMode,
    windowRect: pencereDikdortgen,
    onOpen(id) {
      state.active = false; konsol.setVisible(false);
      root.dataset.bolum = id;         // kabuk kromu (altyazı/kontroller) gizlenir — hedef kendi dilini taşır
      durumDegisti();
    },
    onClose() {
      state.active = options.active ?? true;
      delete root.dataset.bolum;
      durumDegisti();
    },
  });
  const konsol = buildChapterConsole(stage, {
    chapters,
    onSelect: id => api.goTo(`chapter:${id}`),
  });
  let hazirlaZamani = null;          // konsol ilk göründüğünde hedefleri hazırla

  /* -------- DALIŞ (gramer C, plan §11): kokpit → Ay küresi → arazi → gezgin.
     İki koordinat sistemi, iki ray: A dünya sahnesinde küreye iner; ekran
     tamamen regolit dokusuyla dolduğu anda (q=.55, nadir bakış) B arazi
     sahnesine teslim alır — iki temsil aynı karede asla okunmaz (R3). */
  let surface = null, surfaceSozu = null;
  const yuzeyHazirla = () => surfaceSozu ??= buildSurfaceScene({ seed, assetBaseUrl })
    .then(s => { if (s) { surface = s; dalisDirBkur(s); } return s; })
    .catch(error => { console.warn('Yüzey sahnesi kurulamadı:', error); surfaceSozu = null; return null; });

  const ayC = moonGroup.position;
  const ayYonu = ayC.clone().sub(seatPos).normalize();
  const dalisDirA = createCameraDirector(camera, { keyframes: [
    { p: 0,   pos: v(seatPos), look: v(pencereBakis), fov: 50, ease: 'smooth' },
    { p: .10, pos: yak(seatPos, ayYonu, .5),  look: v(ayC), fov: 52, ease: 'linear' },
    { p: .35, pos: v(ayC.clone().addScaledVector(ayYonu, -3.4)),  look: v(ayC), fov: 55, ease: 'linear' },
    { p: .55, pos: v(ayC.clone().addScaledVector(ayYonu, -2.68)), look: v(ayC), fov: 58, ease: 'linear' },
  ] });
  let dalisDirB = null;                                  // vista araziye oturduktan sonra kurulur
  const dalisDirBkur = s => {
    /* HELİKOPTER ÇEKİMİ (kullanıcı: geçiş dandik — haklıydı, nadir inişi
       ölüydü): alçal → 60 m'de ZEMİNİ SIYIRARAK süz (hız hissi gerçek yer
       paralaksından gelir) → hafif flare → gezgine otur. Keyframe
       yükseklikleri araziden ÖLÇÜLÜR — 200 m'lik bir kabartmaya çakılmak
       elle sabitin kaderidir. */
    const h = (x, z, klerans) => s.araziYukseklik(x, z) + klerans;
    /* EĞİM, kameranın KENDİ yüksekliğinden düşülerek kurulur: bakış hedefine
       kendi arazi yüksekliğini vermek, engebede hedefi kameranın ÜSTÜNE
       taşıyıp burnu göğe çeviriyordu (ölçüldü — "dümdüz Samanyolu"nun
       ikinci yarısı). */
    const y68 = h(1.1, 9.5, 2.2), y84 = h(.5, 4.2, .4), y94 = h(.16, 1.15, .12);
    dalisDirB = createCameraDirector(camera, { keyframes: [
      { p: .55, pos: [0, 34, 8],   look: [0, 0, 0],   fov: 58, ease: 'linear' },  // nadir: ekran yalnız regolit
      { p: .68, pos: [1.1, y68, 9.5], look: [.4, y68 - 2.1, 6.2],  fov: 55, ease: 'linear' }, // ~32° burun aşağı
      { p: .84, pos: [.5, y84, 4.2],  look: [.28, y84 - .48, 2.9], fov: 54, ease: 'linear' }, // 40 m sıyırma, ~20° aşağı
      { p: .94, pos: [.16, y94, 1.15], look: [0, .02, 0], fov: 47, ease: 'smooth' },           // flare: gezgin belirir
      { p: 1,   pos: v(s.vista.pos), look: v(s.vista.look), fov: s.vista.fov, ease: 'smooth' },
    ] });
    /* sıyırma bankı: dönüşte ~4°'lik yatış — kamera.up ikincil katmanda
       eğilir, ray dokunulmaz; saf f(q) */
    dalisDirB.addSecondary(camState => {
      const q = state.dalisQ;
      const bank = .07 * Math.sin(Math.PI * Math.min(1, Math.max(0, (q - .66) / .24)));
      camera.up.set(Math.sin(bank), Math.cos(bank), 0);
      if (q >= .97) camera.up.set(0, 1, 0);
    });
    /* VİSTA CANLI KAMERASI (kullanıcı: rover planı ölü duruyor): varışta
       kamera belgesel tarzı, çok yavaş bir yay üstünde süzülmeye devam
       eder — Ken Burns'ün gerçek-kamera karşılığı (plan §14). Saf f(t). */
    dalisDirB.addSecondary((camState, t) => {
      if (state.dalisQ < .995) return;
      const a = .05 * Math.sin(TAU2 * t / 47);
      const px = camState.pos.x - 0, pz = camState.pos.z - 0;
      camState.pos.x = px * Math.cos(a) - pz * Math.sin(a);
      camState.pos.z = px * Math.sin(a) + pz * Math.cos(a);
      camState.pos.y += .0012 * Math.sin(TAU2 * t / 13.7);
    });
  };
  const TAU2 = Math.PI * 2;

  /* durum yayını: deste çalıştırıcısı slayt eşlemesi için */
  const dinleyiciler = new Set();
  const durum = () => state.dalisQ >= .99 ? 'chapter:surface'
    : (state.dalisQ > 0 || state.dalisGecis) ? 'dive'
    : router.acikBolum ? `chapter:${router.acikBolum}`
    : state.p >= .98 ? 'cockpit' : state.p <= .02 ? 'exterior' : 'ray';
  let sonDurum = null;
  function durumDegisti() {
    const simdiki = durum();
    if (simdiki === sonDurum) return;
    sonDurum = simdiki;
    for (const fn of dinleyiciler) fn(simdiki);
  }

  /* -------- hareket katmanları: tam ray (plan §4 çizelgesi) */
  /* tutunma halkasının eksenleri araç duruşundan türetilir: geri kayış
     MOTOR AKSI boyunca olur ki toparlanma itkisi fiziksel okunsun */
  const aftYon = new THREE.Vector3(-1, 0, 0).applyEuler(CRAFT_EULER);
  const yanYon = new THREE.Vector3().crossVectors(aftYon, new THREE.Vector3(0, 1, 0)).normalize();
  const idle = createIdleModel(seed, { aft: aftYon, yan: yanYon });
  /* İç kadraj bakışları pencere yönüyle aynı vektörlerden türetilir
     (yukarıda, kokpit kurulumunda) — kamera ve pencere aynı kompozisyona
     bakar, çerçeve görüşte ortalanır. */
  const pultBakis = pencereBakis.clone().addScaledVector(ustVek, -.55);
  const director = createCameraDirector(camera, {
    keyframes: [
      { p: 0,   pos: [0, .12, 2.1],     look: [.25, .02, -4.6],   fov: 42, ease: 'smooth' },    // dış idle
      { p: .15, pos: [-.55, .05, 1.05], look: v(CRAFT_POS),       fov: 44, ease: 'cinematic' }, // yeniden kadraj
      /* Yaklaşma ÇEYREK açıdan: tam cephe, panelleri kenar çizgisine indirip
         gövdeyi düz kutuya çeviriyordu (ölçüldü). Yanal offset p artarken
         sıfıra iner — eşikte eksene hizalanır. */
      /* orta segmentler LİNEER: küresel tween zaten yumuşatıyor — segment
         başına ikinci ease "dur-kalk" üretiyordu */
      /* yaklaşma ÇANAK/MLI tarafından: öteki yan boş gövde yüzü gösteriyordu
         (ölçüldü) — kompozisyon aracın zengin silüetini kadraja alır */
      { p: .30, pos: v(patchPos.clone().addScaledVector(patchN, 1.5).addScaledVector(yanVek, -.6).add(new THREE.Vector3(0, .14, 0))), look: v(patchPos), fov: 45, ease: 'linear' },
      { p: .50, pos: v(patchPos.clone().addScaledVector(patchN, .16).addScaledVector(yanVek, -.05).add(new THREE.Vector3(0, .015, 0))), look: v(patchPos), fov: 47, ease: 'linear' },
      { p: .62, pos: yak(patchPos, patchN, .015),      look: yak(patchPos, patchN, -1), fov: 47, ease: 'smooth' }, // eşik: cam maske
      { p: .78, pos: v(seatPos),        look: v(pencereBakis),    fov: 50, ease: 'cinematic' },  // kokpit oturur (geniş açı)
      { p: 1,   pos: yak(seatPos, patchN, 0, -.012),   look: v(pultBakis), fov: 50, ease: 'smooth' }, // pult öne eğilim
    ],
  });
  const smooth01 = x => { const c = Math.min(1, Math.max(0, x)); return c * c * (3 - 2 * c); };
  director.addSecondary((camState, t) => {               // kamera nefesi (deterministik)
    const s = idle.sample(t).camera;
    /* içeride nefes kısılır (plan §4: kokpit genliği dışın ~%40'ı) */
    const olcek = state.p < .62 ? 1 : .4;
    camState.pos.x += s.x * olcek; camState.pos.y += s.y * olcek;
    const dx = camState.look.x - camState.pos.x, dz = camState.look.z - camState.pos.z;
    camState.look.x += -dz * s.yaw * olcek; camState.look.z += dx * s.yaw * olcek;
  });

  /* -------- durum + deterministik adım */
  const DURUMLAR = { exterior: 0, cockpit: 1 };
  const roverBaslangic = q.get('durum') === 'rover';     // dalış tamamlanmış tablo
  const baslangicP = roverBaslangic ? 1
    : q.get('durum') in DURUMLAR ? DURUMLAR[q.get('durum')] : (Number(q.get('p')) || 0);
  const state = {
    t: 0, p: baslangicP, hedefP: baslangicP, gecis: null,
    dalisQ: 0, dalisGecis: null,
    calisiyor: !(exportMode || reducedMotion),
    active: options.active ?? true,
  };
  if (roverBaslangic) { await yuzeyHazirla(); state.dalisQ = surface ? 1 : 0; }
  const stats = { advanceMs: 0 };

  /* Gök adımı SEYRELTİLİR: parıldama/göktaşı ~15 Hz'de görsel olarak aynıdır,
     ama cosmos.advance her çağrıda kendi sahnesini bir kez render eder — 60 Hz
     sürmek ana sahnenin kare bütçesini ikinci bir tam render'la yakar.
     Birikmiş dt tek seferde verilir; advance(dt) yolu aynı kapıdan geçtiği
     için determinizm bozulmaz. */
  let gokBirikim = 0;
  const GOK_ADIM = 1 / 15;

  function step(dt) {
    const t0 = performance.now();
    state.t += dt;
    /* p geçişi (goTo): sim zamanına bağlı — advance(dt) altında da deterministik */
    if (state.gecis) {
      const g = state.gecis;
      const e = Math.min(1, (state.t - g.bas) / g.sure);
      /* TEK yumuşatma: segment ease'leri zaten var — çifte easing her
         keyframe sınırında dur-kalk üretiyordu (kullanıcı: "adım adım") */
      state.p = g.from + (g.to - g.from) * smooth01(e);
      pInput.value = String(state.p);
      if (e >= 1) {
        state.gecis = null; state.hedefP = state.p;
        if (state.bekleyenBolum) { const id = state.bekleyenBolum; state.bekleyenBolum = null; router.ac(id); }
      }
    }
    /* dalış geçişi: q da sim zamanıyla ilerler (deterministik) */
    if (state.dalisGecis) {
      const g = state.dalisGecis;
      const e = Math.min(1, (state.t - g.bas) / g.sure);
      let hedefQ = g.from + (g.to - g.from) * smooth01(e);
      /* yüzey henüz kurulmadıysa teslim eşiğinde BEKLE (küre dolu kare) */
      if (hedefQ > .53 && !surface) hedefQ = .53;
      state.dalisQ = hedefQ;
      if (e >= 1 && state.dalisQ === g.to) { state.dalisGecis = null; }
    }
    gokBirikim += dt;
    if (gokBirikim >= GOK_ADIM) { cosmos.advance(gokBirikim); gokBirikim = 0; }
    /* İplik geçirme sırasında araç SABİTLENİR: p .3→.5 arasında idle sıfıra
       rampalanır — kameranın geçtiği kanopi kımıldamaz (plan §11 benzeri
       teslim disiplini). */
    const idleOlcek = 1 - smooth01((state.p - .30) / .20);
    const s = idle.sample(state.t);
    craftPivot.position.set(
      CRAFT_POS.x + s.craft.x * idleOlcek,
      CRAFT_POS.y + s.craft.y * idleOlcek,
      CRAFT_POS.z + s.craft.z * idleOlcek);
    craftPivot.rotation.set(s.craft.pitch * idleOlcek, s.craft.yaw * idleOlcek, s.craft.roll * idleOlcek);
    /* solunum: paralaksın yerini alan yaşam belirtisi — tekdüze ölçek,
       eşiğe yaklaşırken idle ile birlikte sıfıra rampalanır */
    craftPivot.scale.setScalar(1 + s.craft.nefes * idleOlcek);
    if (craftPivot.visible) {
      rcsGuncelle(state.t);
      /* düzeltme alevi: tutunma döngüsünün yanma zarfı FX'i sürer */
      {
        const yanma = s.burn * idleOlcek;
        motorFX?.update(dt, { gaz: yanma, atesle: yanma > .02 && oncekiYanma <= .02 });
        yanmaIsigi.intensity = yanma * 2.4;
        oncekiYanma = yanma;
        state.sonYanma = yanma;                          // debug/test gözlemi
      }
      /* nav flaşörü: 3 sn'de bir 120 ms çift beyaz flaş — saf f(t) */
      {
        const faz = state.t % 3;
        const flas = (faz < .12 || (faz > .25 && faz < .33)) ? 1.6 : 0;
        strobeMat.emissiveIntensity = flas;
      }
    }
    /* Ay dönüşü GÖRÜNÜR sinematik tempoda (kullanıcı yönergesi): ~1,1°/sn,
       tam tur ≈ 5,4 dk — gerçek Ay 27,3 günde döner; altyazı bunu söyler */
    moonGroup.rotation.y = moonSpinBase + state.t * .02;
    kameraUygula();

    /* konsol yaşam döngüsü: güverte oturunca belirir; hedefler ilk
       belirişte GİZLİCE hazırlanır (plan §21 — kokpit idle'ı ön yükleme
       zamanıdır; dahili yüzey sahnesi de aynı pencerede kurulur) */
    const guvertede = state.p > .9 && !router.acikBolum
      && state.dalisQ === 0 && !state.dalisGecis;
    konsol.setVisible(guvertede && !exportMode);
    filtreKutu.hidden = !(guvertede && !exportMode);
    gezginKutuEl.hidden = !(state.dalisQ >= .99 && !exportMode);
    /* vinyet: içerideyken yumuşak kenar kararması — sinema hissi, içerik
       okunurluğuna dokunmaz (kenarlar zaten kabuk) */
    vinyet.style.opacity = (state.p >= .6 && state.dalisQ < .1) ? '1' : '0';
    if (state.p > .85 && !hazirlaZamani && !exportMode && !reducedMotion) {
      hazirlaZamani = true;
      for (const chapter of chapters) {
        if (chapter.internal) yuzeyHazirla();
        else router.hazirla(chapter.id);
      }
    }
    durumDegisti();

    renderFrame();
    stats.advanceMs = stats.advanceMs * .9 + (performance.now() - t0) * .1;
  }

  /* kamera SEÇİMİ TEK KAPIDAN: dalıştaysak dalış rayları, değilsek ana ray.
     (Paused dal bu ayrımı bilmeden ana rayı uygulayınca, dalış scrub'ında
     kamera koltuk pozuna dönüp göğe bakıyordu — ölçülerek bulundu.) */
  function kameraUygula() {
    if (state.dalisQ > 0) {
      if (state.dalisQ < .55 || !dalisDirB) dalisDirA.apply(Math.min(state.dalisQ, .55), state.t);
      else dalisDirB.apply(state.dalisQ, state.t);
      /* HIZ HİSSİ (kullanıcı: "animasyon gibi değil"): iniş boyunca ray
         pozu değişmeden iki ikincil katman biner — (a) FOV vuruşu: hız
         arttıkça görüş açılır, varışta toparlanır; (b) açısal mikro
         türbülans (~0,2° tepe): pozisyon değil AÇI sarsılır, bu yüzden
         dünya ölçeğinde de yüzey ölçeğinde de aynı okunur. Her ikisi
         saf f(q, t) — export/advance altında birebir aynı kareler. */
      const q = state.dalisQ;
      const zarf = Math.sin(Math.PI * Math.min(1, Math.max(0, (q - .06) / .86))) ** 1.4;
      if (zarf > 0) {
        camera.fov += zarf * 9;
        camera.updateProjectionMatrix();
        const j = .0035 * zarf;
        camera.rotateX(j * Math.sin(TAU2 * state.t * 1.9));
        camera.rotateY(j * .8 * Math.sin(TAU2 * state.t * 2.7 + 1.7));
      }
    } else {
      director.apply(state.p, state.t);
    }
  }

  /* İKİ GEÇİŞLİ RENDER: dünya (Ay+gök+araç) → derinlik temizle → kabuk.
     Pencere gerçek delik: delikten dünya pikselleri görünür. Eşik anında
     araç gizlenir (artık içindeyiz); örtüşme payı kısa tutulur ki iki
     temsil aynı karede okunmasın. Dalış q≥.55'te sahne ARAZİYE teslim
     edilir (ekran o anda yalnız regolit — R3 disiplini). */
  function renderFrame() {
    /* kamera düzlemleri sahneye göre: arazide 20 cm'den 520 km'ye */
    const yuzeyde = state.dalisQ >= .55 && surface;
    const near = yuzeyde ? .002 : .05, far = yuzeyde ? 12000 : 400;
    if (camera.near !== near) { camera.near = near; camera.far = far; camera.updateProjectionMatrix(); }
    renderer.autoClear = false;
    renderer.clear();
    if (yuzeyde) {
      surface.etkilesim.guncelle(state.t);               // fener nabzı + direk taraması (saf f(t))
      renderer.render(surface.scene, camera);
      return;
    }
    const iceride = state.p >= .60 && state.dalisQ < .10;
    craftPivot.visible = state.p < .625;
    /* Halo yalnız DIŞ kadraj içindir: içeriden bakınca 30°'lik soluk bir
       disk olarak pencereye diyagonal bir perde çekiyordu (üç ekran
       görüntüsünde de aynı kenar — cam sanılıp iki kez yanlış onarıldı,
       ölçüm bunu buldu). Dalışta da kapalı: küreye dalarken perde olurdu. */
    moonParts.halo.visible = state.p < .55 && state.dalisQ === 0;
    renderer.render(scene, camera);
    if (iceride) { renderer.clearDepth(); renderer.render(cockpitScene, camera); }
  }

  /* -------- boyutlandırma: kabın içine en büyük 16:9 dikdörtgen */
  camera.aspect = 16 / 9;                                // kadraj SABİT — kap değil, sahne belirler
  camera.updateProjectionMatrix();
  function boyut() {
    const w = Math.max(2, root.clientWidth), h = Math.max(2, root.clientHeight);
    const s = Math.min(w / 16, h / 9);
    const sw = Math.round(16 * s), sh = Math.round(9 * s);
    stage.style.width = `${sw}px`;
    stage.style.height = `${sh}px`;
    renderer.setSize(sw, sh, false);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  }
  const ro = new ResizeObserver(() => { boyut(); step(0); });
  ro.observe(root);
  boyut();

  /* -------- donuk başlangıç (export/reduced): t'ye önden entegre et */
  if (exportMode || reducedMotion) {
    const T = Number(q.get('t')) || 12;
    state.t = T - 1; step(1);                            // cosmos'u tek adımda T'ye taşımak yerine
    root.dataset.frozenAt = String(T);                   // son 1 sn'yi gerçek adımla — ucuz ve deterministik
  }

  /* -------- canlı çevrim */
  const canliGirdi = !exportMode && !reducedMotion;     // tekerlek vb. canlı girdiler
  skyHost.style.transform = 'scale(1.05)';             // eski paralaks kaymasının sabit tabanı
  let frame = null;
  let onceki = performance.now();
  function tik(now) {
    frame = requestAnimationFrame(tik);
    const dt = Math.min(.05, (now - onceki) / 1000); onceki = now;
    if (!state.active) return;
    /* sürgü/tekerlek hedefi: geçiş yokken p hedefe yumuşak yaklaşır */
    if (!state.gecis && state.hedefP !== state.p) {
      const k = 1 - Math.exp(-dt / .22);
      state.p += (state.hedefP - state.p) * k;
      if (Math.abs(state.hedefP - state.p) < 1e-4) state.p = state.hedefP;
      pInput.value = String(state.p);
      if (!state.calisiyor) { kameraUygula(); renderFrame(); }
    }
    if (state.calisiyor) step(dt);
    /* duraklatılmışken sahne donuktur: sürgü dalı kendi karesini zaten
       çizer, burada boşa render yok (paralaks kaldırıldı) */
  }
  if (!exportMode) { frame = requestAnimationFrame(tik); onceki = performance.now(); }

  /* -------- altyazı: gerçek/temsilî ayrımı + zorunlu krediler */
  truthEl.innerHTML =
    '<strong>Ölçek ve tempo sinematik</strong> — araç–Ay oranı gerçek değildir; ' +
    'Ay burada ~5 dk\'da döner (gerçekte 27,3 gün). Ay dokuları gerçek ' +
    '(NASA türevi; yerçekimi filtresi Lunaris varlığıdır), yıldız parlaklık ' +
    'dağılımı gerçekçi, konumlar (yüzey göğündeki Dünya dâhil) temsilî.' +
    (cosmos.galaxyPhotoActive ? ' Samanyolu: ESO/S. Brunier (CC BY 4.0).' : '');

  /* -------- kontroller */
  const pauseBtn = root.querySelector('[data-action="pause"]');
  const pInput = root.querySelector('[data-input="p"]');
  pInput.value = String(state.p);
  const syncPause = () => {
    pauseBtn.textContent = state.calisiyor ? 'Duraklat' : 'Sürdür';
    pauseBtn.setAttribute('aria-pressed', String(!state.calisiyor));
  };
  pauseBtn.addEventListener('click', () => { state.calisiyor = !state.calisiyor; syncPause(); });
  pInput.addEventListener('input', () => {
    state.gecis = null;
    state.p = state.hedefP = Number(pInput.value);
    if (!state.calisiyor) { kameraUygula(); renderFrame(); }
  });
  root.addEventListener('keydown', event => {
    if (event.key === ' ') { event.preventDefault(); state.calisiyor = !state.calisiyor; syncPause(); }
    else if (event.key === 'Enter' && state.p < .5) { event.preventDefault(); api.goTo('cockpit'); }
    else if (event.key === 'Escape') {
      event.preventDefault();
      if (state.dalisQ > 0 || state.dalisGecis || router.acikBolum || state.p > .5) api.back();
    }
  });
  /* tekerlek = sinematik zaman çizelgesi (plan §17): sayfa kaydırmaz, rayı
     sarar. Dalışta ve bölümde devre dışı — o gramerlerin kendi dönüşü var. */
  if (canliGirdi) root.addEventListener('wheel', event => {
    event.preventDefault();
    if (state.dalisQ > 0 || state.dalisGecis || router.acikBolum) return;
    state.gecis = null;
    state.hedefP = Math.min(1, Math.max(0, state.hedefP + event.deltaY * .0006));
  }, { passive: false });
  syncPause();

  /* Reduced-motion geçiş perdesi: uzun sinematik yolculuk yerine kısa
     kararma + tabloya atlama (plan §15). */
  const veil = document.createElement('div');
  veil.style.cssText = 'position:absolute;inset:0;background:#04050a;opacity:0;' +
    'pointer-events:none;z-index:8;transition:opacity .18s ease;';
  stage.appendChild(veil);


  /* GÖZLEM FİLTRESİ (kullanıcı yönergesi): güvertede Ay'ın YERÇEKİMİ dokusu
     — Lunaris'in gravity_moon_real varlığı, buildMoonMesh.setTextureMode ile.
     Süs değil alet: bakılan cismin başka bir ölçümünü gösterir. */
  let aktifFiltre = 'aesthetic';
  const filtreUygula = ad => {
    aktifFiltre = ad;
    moonParts.setTextureMode(ad);
    filtreKutu.querySelectorAll('button').forEach(b =>
      b.setAttribute('aria-pressed', String(b.dataset.filtre === ad)));
    if (!state.calisiyor) { kameraUygula(); renderFrame(); }
  };
  filtreKutu.addEventListener('click', event => {
    const b = event.target.closest('button[data-filtre]');
    if (b) filtreUygula(b.dataset.filtre);
  });

  /* GEZGİN KOMUTLARI (kullanıcı: interaktif hiçbir şeyi yok): farlar +
     direk taraması — deterministik davranışlar, kullanıcı anahtarlarıyla */
  const gezginKutu = root.querySelector('.cine-space__gezgin');
  gezginKutu.addEventListener('click', event => {
    const b = event.target.closest('button[data-gezgin]');
    if (!b || !surface) return;
    const acik = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', String(acik));
    if (b.dataset.gezgin === 'farlar') surface.etkilesim.setFarlar(acik);
    else surface.etkilesim.setTarama(acik);
    if (!state.calisiyor) { renderFrame(); }
  });

  const onVisibility = () => { if (document.hidden) state.active = false; else state.active = options.active ?? true; };
  document.addEventListener('visibilitychange', onVisibility);

  /* Yüzey ERKEN hazırlanır (kullanıcı ilk ziyarette hızlıca dalarsa teslim
     eşiğinde bekleme yaşanmasın): mount'tan 2,5 sn sonra, sessizce. */
  if (!exportMode && !reducedMotion) setTimeout(() => { yuzeyHazirla(); }, 2500);

  /* ?perf=1 — 180 karelik ölçümü DOM'a yaz (orbital_stage deseni) */
  if (q.get('perf') === '1' && !exportMode) {
    let kare = 0;
    const perfBekci = setInterval(() => {
      kare += 1;
      if (kare < 30) return;                             // ilk ~3 sn ısınma
      clearInterval(perfBekci);
      const kutu = document.createElement('output');
      kutu.className = 'cine-space__perf';
      kutu.style.cssText = 'position:absolute;left:16px;top:14px;z-index:9;' +
        'font:12px ui-monospace,monospace;color:#9fb2d0;background:rgba(8,10,16,.8);' +
        'border:1px solid #1c2434;border-radius:8px;padding:6px 10px;';
      kutu.textContent = `advanceMs (EMA): ${stats.advanceMs.toFixed(2)} — CPU tarafı; kare bütçesini GPU belirler`;
      stage.appendChild(kutu);
    }, 100);
  }

  const api = {
    root, stats, seed,
    /* hata ayıklama: görsel bisection için sahne tutamaçları (belgesiz) */
    _debug: { scene, cockpitScene, cockpit, moonParts, craftPivot, renderFrame, director, state, craft, motorFX, camera },
    setProgress(p) {
      state.gecis = null;
      state.p = state.hedefP = Math.min(1, Math.max(0, p));
      pInput.value = String(state.p);
      if (!state.calisiyor || exportMode) { kameraUygula(); renderFrame(); }
    },
    getProgress: () => state.p,
    /** Anlatı geçişi (plan §5): exterior ↔ cockpit ↔ chapter:<id>.
        Canlıda ray yolculuğu + pencere maskesi; reduced/export'ta kısa
        perde + tabloya atlama. */
    goTo(hedefDurum, { duration = 3.5 } = {}) {
      if (hedefDurum.startsWith('chapter:')) {
        const id = hedefDurum.slice(8);
        const chapter = chapters.find(c => c.id === id);
        if (!chapter) throw new Error(`Bilinmeyen bölüm: ${id}`);
        if (chapter.internal) {                          // DALIŞ (gramer C)
          if (state.dalisQ >= .99) return;
          yuzeyHazirla();
          const dal = () => {
            /* güvence: kullanıcı zincirlenmiş güverte yolculuğunu tekerlekle
               yarıda kestiyse dalış rayı yine koltuktan başlar */
            if (state.p < .98) api.setProgress(1);
            if (exportMode || reducedMotion) {
              veil.style.opacity = '1';
              yuzeyHazirla().then(() => setTimeout(() => {
                state.dalisQ = surface ? 1 : 0;
                if (!state.calisiyor || exportMode) step(0);
                setTimeout(() => { veil.style.opacity = '0'; }, 120);
              }, 150));
              return;
            }
            state.dalisGecis = { from: state.dalisQ, to: 1, bas: state.t, sure: 10 };
            state.calisiyor = true; syncPause();
          };
          if (state.p < .98 && !(exportMode || reducedMotion)) {
            state.bekleyenBolum = null;
            api.goTo('cockpit', { duration: Math.min(duration, 2.2) });
            const eskiGecis = state.gecis;
            /* güverteye varınca dal: ray geçişi bitince tetiklenir */
            const bekci = setInterval(() => {
              if (state.gecis !== eskiGecis && !state.gecis) { clearInterval(bekci); dal(); }
            }, 120);
          } else { if (state.p < 1) api.setProgress(1); dal(); }
          return;
        }
        if (router.acikBolum === id) return;
        const acilis = () => {
          if (state.p < .98) {
            if (exportMode || reducedMotion) { api.setProgress(1); router.ac(id); }
            else { state.bekleyenBolum = id; api.goTo('cockpit', { duration: Math.min(duration, 2.2) }); }
          } else router.ac(id);
        };
        if (router.acikBolum) router.kapat().then(acilis); else acilis();
        return;
      }
      const to = DURUMLAR[hedefDurum];
      if (to === undefined) throw new Error(`Bilinmeyen durum: ${hedefDurum}`);
      const rayaGit = () => {
        if (exportMode || reducedMotion) {
          veil.style.opacity = '1';
          setTimeout(() => {
            api.setProgress(to);
            setTimeout(() => { veil.style.opacity = '0'; }, 120);
          }, reducedMotion && !exportMode ? 150 : 0);
          return;
        }
        state.hedefP = to;
        state.gecis = { from: state.p, to, bas: state.t, sure: duration };
        state.calisiyor = true; syncPause();
      };
      if (router.acikBolum) router.kapat().then(rayaGit); else rayaGit();
    },
    /** Pull-out: dalıştan güverteye (geri sarım), bölümden güverteye,
        güverteden dışarıya. */
    back() {
      if (state.dalisQ > 0 || state.dalisGecis) {
        if (exportMode || reducedMotion) {
          veil.style.opacity = '1';
          setTimeout(() => {
            state.dalisGecis = null; state.dalisQ = 0;
            if (!state.calisiyor || exportMode) step(0);
            setTimeout(() => { veil.style.opacity = '0'; }, 120);
          }, 150);
          return;
        }
        state.dalisGecis = { from: state.dalisQ, to: 0, bas: state.t, sure: Math.max(3, 6 * state.dalisQ) };
        state.calisiyor = true; syncPause();
        return;
      }
      if (router.acikBolum) { router.kapat(); return; }
      api.goTo(state.p >= .5 ? 'exterior' : 'cockpit');
    },
    advance(dt) { step(Math.max(0, dt)); },
    play() { state.calisiyor = true; syncPause(); },
    pause() { state.calisiyor = false; syncPause(); },
    setActive(v) { state.active = Boolean(v); },
    on(olay, fn) { if (olay === 'statechange') dinleyiciler.add(fn); return () => dinleyiciler.delete(fn); },
    get chapters() { return chapters.map(c => ({ id: c.id, label: c.label, disabled: !!c.disabled })); },
    dispose() {
      if (frame !== null) cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', onVisibility);
      ro.disconnect();
      router.dispose();
      konsol.dispose();
      surface?.dispose();
      cosmos.dispose();
      for (const sahne of [scene, cockpitScene]) sahne.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : (o.material ? [o.material] : [])) m.dispose();
      });
      renderer.dispose();
      root.remove();
    },
  };
  return api;
}
