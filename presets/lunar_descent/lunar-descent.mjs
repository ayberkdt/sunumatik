/* Ay'a motorlu iniş — sinematik WebGL sahnesi (webgl-scene-contract.md'ye bağlı).
   Fizik: ./descent-model.mjs (analitik rehberlik, entegre; keyframe yok).
   Görsel dil: alçak güneş + uzun gölgeler, siyah gökyüzü + seyrek yıldız,
   ufukta küçük Dünya, gaz koluyla ölçeklenen sıcak plum (beyaz patlama yok),
   ~25 m altında büyüyen deterministik toz süpürmeleri (vakum: balistik,
   süspansiyon yok), temas sonrası çökme.

   Sayfa gereksinimi (lunaris kuralıyla aynı): modüllerden önce import map —
   {"imports": {"three": "../moon_advanced/vendor/three.module.min.js"}}

   ÖLÇEK DÜRÜSTLÜĞÜ: 1 sahne birimi = 100 m; ufuk eğriliği GERÇEK ay yarıçapı
   (1737.4 km) ile çizilir. Araç ölçeği ise sinematik olarak abartılır:
   frenlemede ~600 m görünür (≈×65), 150 m altında gerçek boyuta (~9 m) iner.
   Bu abartı manifest'te ve altyazıda bildirilir. */

import * as THREE from 'three';
import { simulateDescent, SABITLER } from './descent-model.mjs';

const OLCEK = 1 / 100;          // m → sahne birimi
const R_AY_BIRIM = 17374;       // ay yarıçapı, birim (gerçek: 1737.4 km)
const ZEMIN_UST = 0.003;        // görünür zemin katmanının (mikro yama) y'si — ayaklar buna basar
                                // (katman adımları 15-30 cm: sıyırma açısında parlak şerit bırakmaz)

const kirp = (v, a, b) => Math.min(b, Math.max(a, v));
const purussuz = (a, b, v) => { const t = kirp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
/* Küresel yüzeyin sagittası: düz-zemin fiziği ile eğri zemin görselini bağdaştırır —
   araç, izi ve gölge hedefi yerel zemin yüksekliğine oturur. */
const sagitta = xBirim => -(xBirim * xBirim) / (2 * R_AY_BIRIM);

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---- Yedek araç: craft-blocks yüklenemezse basit 4 bacaklı kutu iniş aracı.
   Dondurulmuş sözleşmeyle aynı: +X ileri, motor −X'ten çıkar, en uzun boyut ≈ 1,
   orijin geometrik merkez, obsidyen-şampanya paleti. ---- */
function yedekLander(palette = {}) {
  const p = {
    body: palette.body ?? 0x2e2f33, panel: palette.panel ?? 0xcfb07a,
    accent: palette.accent ?? 0xc86a40, metal: palette.metal ?? 0x9aa0a8,
  };
  const mat = (color, metalness, roughness) => new THREE.MeshStandardMaterial({ color, metalness, roughness });
  const govdeM = mat(p.body, .45, .5), panelM = mat(p.panel, .6, .35), metalM = mat(p.metal, .7, .4), vurguM = mat(p.accent, .3, .55);
  const g = new THREE.Group();
  const govde = new THREE.Mesh(new THREE.BoxGeometry(.42, .5, .5), govdeM);
  govde.position.x = .05; g.add(govde);
  const ust = new THREE.Mesh(new THREE.BoxGeometry(.2, .3, .3), panelM);
  ust.position.x = .34; g.add(ust);
  // Tanklar (±Z)
  for (const z of [-.31, .31]) {
    const tank = new THREE.Mesh(new THREE.SphereGeometry(.13, 20, 14), metalM);
    tank.position.set(.02, 0, z); g.add(tank);
  }
  // Motor çanı (−X yönüne bakar)
  const can = new THREE.Mesh(new THREE.CylinderGeometry(.05, .13, .2, 20, 1, true), vurguM);
  can.rotation.z = Math.PI / 2; can.position.x = -.3; g.add(can);
  // 4 bacak + tabanlar: −X ucunda, YZ düzleminde radyal
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2;
    const uy = Math.cos(a) * .44, uz = Math.sin(a) * .44;
    const bacak = new THREE.Mesh(new THREE.CylinderGeometry(.016, .016, .5, 8), metalM);
    bacak.position.set(-.26, uy * .68, uz * .68);
    bacak.lookAt(new THREE.Vector3(-.52, uy, uz).add(bacak.position).sub(new THREE.Vector3(.26 - .02, -uy * .32, -uz * .32)));
    // lookAt yaklaşıklığı yerine basit eğim:
    bacak.rotation.set(0, 0, 0);
    bacak.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(.5, uy * .62, uz * .62).normalize());
    g.add(bacak);
    const taban = new THREE.Mesh(new THREE.CylinderGeometry(.05, .06, .025, 12), metalM);
    taban.rotation.z = Math.PI / 2; taban.position.set(-.49, uy, uz); g.add(taban);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/* Seeded yıldız kabuğu (statik, parıldamaz — sahne sözleşmesi: dekoratif döngü yok). */
function yildizlar(seed) {
  const rnd = mulberry32(seed);
  const n = 1700, poz = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = 8600 + rnd() * 900, te = rnd() * Math.PI * 2, fi = Math.acos(2 * rnd() - 1);
    poz[i * 3] = r * Math.sin(fi) * Math.cos(te);
    poz[i * 3 + 1] = Math.abs(r * Math.cos(fi)) * .96 - 120; // çoğu ufkun üstünde
    poz[i * 3 + 2] = r * Math.sin(fi) * Math.sin(te);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(poz, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0xdfe6f2, size: 1.9, sizeAttenuation: false, transparent: true, opacity: .8, depthWrite: false,
  }));
}

/* Küçük mavi Dünya — ufkun az üstünde, dingin (mavi bilye diski; süsleme, aria dışı). */
function dunya(seed) {
  const rnd = mulberry32(seed ^ 0x517);
  const cnv = document.createElement('canvas'); cnv.width = cnv.height = 256;
  const c = cnv.getContext('2d');
  const grad = c.createRadialGradient(96, 88, 20, 128, 128, 128);
  grad.addColorStop(0, '#8fb8dd'); grad.addColorStop(.55, '#3d6fa8'); grad.addColorStop(1, '#16304e');
  c.fillStyle = grad; c.fillRect(0, 0, 256, 256);
  c.globalAlpha = .28; c.fillStyle = '#e8eef2';
  for (let i = 0; i < 34; i++) { // bulut süpürmeleri — bant karikatürü değil
    const y = rnd() * 256, w = 18 + rnd() * 70, h = 3 + rnd() * 6;
    c.beginPath(); c.ellipse(rnd() * 256, y, w, h, rnd() * 1.2 - .6, 0, Math.PI * 2); c.fill();
  }
  const tex = new THREE.CanvasTexture(cnv); tex.colorSpace = THREE.SRGBColorSpace;
  const kure = new THREE.Mesh(new THREE.SphereGeometry(62, 40, 28),
    new THREE.MeshBasicMaterial({ map: tex }));
  kure.position.set(-3600, 470, -2900);
  return kure;
}

/* Yakın alan zemin dokusu: seeded prosedürel kraterler.
   Sözleşme: en-iyi-aday (blue noise) yerleşim, düzenli ızgara yok; boyutlar
   düşük-çarpık. Gölgeleme alçak güneşle tutarlı (rim vurgusu güneşe bakan yayda). */
function kraterDokusu(seed, gunesAcisi, ayar = {}) {
  const rnd = mulberry32(seed ^ 0xA11CE);
  const S = 1024, cnv = document.createElement('canvas'); cnv.width = cnv.height = S;
  const c = cnv.getContext('2d');
  const kraterSay = ayar.kraterSay ?? 42;
  const rTaban = ayar.rTaban ?? 6, rGenis = ayar.rGenis ?? 40;
  const grenSay = ayar.grenSay ?? 6400;
  c.fillStyle = '#6c6b66'; c.fillRect(0, 0, S, S); // ay grisi — sıcak kahve DEĞİL
  if (ayar.taban) {
    // Ton sürekliliği: yakın yamanın tabanı GERÇEK albedo dokusundan bir bölgedir —
    // uzak zemin ile renk uyuşmazlığı (kahverengi ada etkisi) kökten biter.
    const img = ayar.taban;
    const iw = img.width || 1024, ih = img.height || 512;
    const kirpB = Math.floor(Math.min(iw, ih) * (ayar.tabanOran ?? .4));
    const sx = Math.floor(rnd() * (iw - kirpB)), sy = Math.floor(rnd() * (ih - kirpB));
    c.drawImage(img, sx, sy, kirpB, kirpB, 0, 0, S, S);
  } else {
    // geniş, soğuk-nötr albedo lekeleri (mare/highland yankısı)
    for (let i = 0; i < 70; i++) {
      const r = 40 + rnd() * 190;
      c.globalAlpha = .035 + rnd() * .045;
      c.fillStyle = ['#787772', '#5e5d59', '#73726d', '#575651'][Math.floor(rnd() * 4)];
      c.beginPath(); c.arc(rnd() * S, rnd() * S, r, 0, Math.PI * 2); c.fill();
    }
    c.globalAlpha = 1;
  }
  // kraterler: en-iyi-aday yerleşim (düzenli ızgara ve yığılma yok)
  const yerler = [];
  for (let i = 0; i < kraterSay; i++) {
    let enIyi = null, enIyiUzak = -1;
    for (let d = 0; d < 12; d++) {
      const aday = { x: rnd() * S, y: rnd() * S };
      let enYakin = 1e9;
      for (const p of yerler) enYakin = Math.min(enYakin, Math.hypot(aday.x - p.x, aday.y - p.y));
      if (enYakin > enIyiUzak) { enIyiUzak = enYakin; enIyi = aday; }
    }
    const r = rTaban + Math.pow(rnd(), 2.2) * rGenis; // düşük-çarpık: çoğu küçük, seyrek büyük
    yerler.push({ ...enIyi, r });
  }
  const ga = gunesAcisi; // güneşin doku düzlemindeki azimutu
  for (const k of yerler) {
    const { x, y, r } = k;
    // sığ iç gölge: güneş TARAFINDAKİ iç duvar karanlık (yarım ay biçimli), taban hafif
    c.save(); c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.clip();
    let g = c.createLinearGradient(x - Math.cos(ga) * r, y - Math.sin(ga) * r, x + Math.cos(ga) * r, y + Math.sin(ga) * r);
    g.addColorStop(0, 'rgba(30,29,27,.32)'); g.addColorStop(.5, 'rgba(44,42,39,.12)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
    c.restore();
    // İNCE aydınlık rim: karşı (güneşten uzak) dış yay — krater dilini veren çizgi
    c.save(); c.translate(x, y); c.rotate(ga);
    c.strokeStyle = 'rgba(198,192,181,.32)';
    c.lineWidth = Math.max(1, r * .045);
    c.beginPath(); c.arc(0, 0, r * .96, -1.35, 1.35); c.stroke();
    // güneş tarafında zayıf dış rim gölgesi
    c.strokeStyle = 'rgba(26,25,23,.28)';
    c.lineWidth = Math.max(1, r * .05);
    c.beginPath(); c.arc(0, 0, r * 1.02, Math.PI - 1.1, Math.PI + 1.1); c.stroke();
    c.restore();
  }
  // regolit greni — iki tonlu, ince
  for (let i = 0; i < grenSay; i++) {
    c.globalAlpha = .04 + rnd() * .05;
    c.fillStyle = rnd() < .5 ? '#8a867e' : '#605d57';
    c.beginPath(); c.arc(rnd() * S, rnd() * S, .5 + rnd() * 1.7, 0, Math.PI * 2); c.fill();
  }
  c.globalAlpha = 1;
  return cnv;
}

/* Doku yüklenemezse uzak zemin için prosedürel yedek (aynı dil, daha kaba). */
function uzakZeminYedek(seed) {
  const cnv = kraterDokusu(seed ^ 0xFA11, Math.PI * .82);
  return new THREE.CanvasTexture(cnv);
}

export async function mountLunarDescent(host, options = {}) {
  const seed = options.seed ?? 20260813;
  const model = simulateDescent();
  const { ozet, olaylar } = model;

  // Fizik doğruluk raporu (doğrulama sözleşmesi: konsola yazılır)
  console.info(
    `[lunar-descent] temas hızı ${ozet.temasHizi.toFixed(2)} m/s | toplam ΔV ${ozet.toplamDV.toFixed(0)} m/s | ` +
    `kalan yakıt %${(ozet.kalanYakit * 100).toFixed(1)} | sim ${ozet.toplamSim.toFixed(0)} s → oynatma ${ozet.toplamOynat.toFixed(1)} s`
  );

  /* ---- DOM ---- */
  const kok = document.createElement('div');
  kok.className = 'ldp-root';
  kok.innerHTML = `
    <div class="ldp-hud" role="status" aria-label="İniş telemetrisi">
      <div class="ldp-faz"><span class="ldp-faz-ad">Frenleme</span><span class="ldp-bukum" title="Zaman sıkıştırma">×33</span></div>
      <dl class="ldp-metrik">
        <div><dt>İrtifa</dt><dd data-ldp="irtifa">—</dd></div>
        <div><dt>Dikey hız</dt><dd data-ldp="vy">—</dd></div>
        <div><dt>Yatay hız</dt><dd data-ldp="vx">—</dd></div>
        <div><dt>Yakıt</dt><dd data-ldp="yakit">—</dd></div>
      </dl>
      <div class="ldp-yakit-bar" aria-hidden="true"><i></i></div>
    </div>
    <p class="ldp-duyuru" aria-live="polite"></p>
    <p class="ldp-kaynak">Analitik rehberli iniş profili — görev telemetrisi değil; ölçek ve süre sıkıştırılmış. Araç frenlemede ≈×65 büyütülür, son inişte gerçek boyuttadır.</p>`;
  host.appendChild(kok);
  const hudEl = kok.querySelector('.ldp-hud');
  const fazAdEl = kok.querySelector('.ldp-faz-ad');
  const bukumEl = kok.querySelector('.ldp-bukum');
  const duyuruEl = kok.querySelector('.ldp-duyuru');
  const m_irtifa = kok.querySelector('[data-ldp="irtifa"]');
  const m_vy = kok.querySelector('[data-ldp="vy"]');
  const m_vx = kok.querySelector('[data-ldp="vx"]');
  const m_yakit = kok.querySelector('[data-ldp="yakit"]');
  const yakitBar = kok.querySelector('.ldp-yakit-bar i');

  /* ---- Renderer / sahne ---- */
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  kok.prepend(renderer.domElement);

  const sahne = new THREE.Scene();
  sahne.background = new THREE.Color(0x010204);
  const kamera = new THREE.PerspectiveCamera(48, 16 / 9, 0.02, 26000);

  /* ---- Işık: alçak güneş (uzun gölgeler), zayıf dünya-ışığı dolgusu ---- */
  const gunesYon = new THREE.Vector3(-0.62, Math.tan(11 * Math.PI / 180), 0.36).normalize(); // ~11° eleve
  const gunes = new THREE.DirectionalLight(0xfff1dc, 2.7);
  gunes.castShadow = true;
  gunes.shadow.mapSize.set(2048, 2048);
  gunes.shadow.bias = -0.0004;
  gunes.shadow.radius = 6;        // yumuşak yarı gölge — jilet siyahı leke değil
  gunes.shadow.intensity = 0.62;  // dünya-ışığı gölgeyi tamamen karartmaz
  sahne.add(gunes, gunes.target);
  sahne.add(new THREE.HemisphereLight(0x232833, 0x191510, 0.4));
  const dunyaIsigi = new THREE.DirectionalLight(0x39465c, 0.22); // dünya-ışığı (earthshine)
  dunyaIsigi.position.set(-3600, 470, -2900);
  sahne.add(dunyaIsigi);

  /* ---- Gökyüzü ---- */
  sahne.add(yildizlar(seed));
  sahne.add(dunya(seed));

  /* ---- Zemin: gerçek yarıçaplı eğrilikle bükülen büyük yama ---- */
  const yukleyici = new THREE.TextureLoader();
  const dokuUrl = ad => new URL(`../moon_react_source/public/lunaris/textures/${ad}`, import.meta.url).href;
  let albedo = null, engebe = null;
  try {
    [albedo, engebe] = await Promise.all([
      yukleyici.loadAsync(dokuUrl('aesthetic_moon_real.webp')),
      yukleyici.loadAsync(dokuUrl('moon_disp_real.webp')),
    ]);
  } catch { /* çevrimdışı: prosedürel yedek */ }
  if (albedo) {
    albedo.colorSpace = THREE.SRGBColorSpace;
    albedo.wrapS = albedo.wrapT = THREE.RepeatWrapping;
    albedo.repeat.set(9, 9);
    albedo.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  } else {
    albedo = uzakZeminYedek(seed);
    albedo.colorSpace = THREE.SRGBColorSpace;
    albedo.wrapS = albedo.wrapT = THREE.RepeatWrapping;
    albedo.repeat.set(9, 9);
  }
  if (engebe) { engebe.wrapS = engebe.wrapT = THREE.RepeatWrapping; engebe.repeat.set(9, 9); }

  const buyukGeo = new THREE.PlaneGeometry(13000, 13000, 110, 110);
  buyukGeo.rotateX(-Math.PI / 2);
  {
    const p = buyukGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const dx = p.getX(i), dz = p.getZ(i);
      const d2 = dx * dx + dz * dz;
      // Küresel sagitta + 5000 birim ötesinde ek yuvarlanma: kare düzlemin
      // köşeleri ufkun altına iner (köşe kenarı çizgi/teras artefaktı bırakmaz).
      const d = Math.sqrt(d2);
      const ek = d > 5000 ? ((d - 5000) ** 2) / 1600 : 0;
      p.setY(i, -d2 / (2 * R_AY_BIRIM) - ek);
    }
    buyukGeo.computeVertexNormals();
  }
  const buyukZemin = new THREE.Mesh(buyukGeo, new THREE.MeshStandardMaterial({
    map: albedo, bumpMap: engebe || null, bumpScale: engebe ? 2.4 : 0,
    roughness: .96, metalness: 0,
  }));
  buyukZemin.position.y = 0;
  buyukZemin.receiveShadow = true;
  sahne.add(buyukZemin);

  /* Yakın alan detay yaması: iniş sahası çevresi (temas noktası = orijin) */
  const albedoImg = albedo && albedo.image && albedo.image.width ? albedo.image : null;
  const yakinCnv = kraterDokusu(seed, Math.atan2(-gunesYon.z, -gunesYon.x),
    { taban: albedoImg, tabanOran: .38 });
  // kenar alfa solması — yama uzak zemine dikişsiz karışsın
  {
    const c = yakinCnv.getContext('2d');
    const g = c.createRadialGradient(512, 512, 300, 512, 512, 512);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)');
    c.globalCompositeOperation = 'destination-out';
    const gg = c.createRadialGradient(512, 512, 330, 512, 512, 512);
    gg.addColorStop(0, 'rgba(0,0,0,0)'); gg.addColorStop(1, 'rgba(0,0,0,1)');
    c.fillStyle = gg; c.fillRect(0, 0, 1024, 1024);
    c.globalCompositeOperation = 'source-over';
  }
  const yakinTex = new THREE.CanvasTexture(yakinCnv);
  yakinTex.colorSpace = THREE.SRGBColorSpace;
  const yakinGeo = new THREE.PlaneGeometry(120, 120, 46, 46);
  yakinGeo.rotateX(-Math.PI / 2);
  {
    const p = yakinGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const dx = p.getX(i), dz = p.getZ(i);
      p.setY(i, -(dx * dx + dz * dz) / (2 * R_AY_BIRIM) + 0.0015);
    }
    yakinGeo.computeVertexNormals();
  }
  yakinTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const yakinZemin = new THREE.Mesh(yakinGeo, new THREE.MeshStandardMaterial({
    map: yakinTex, bumpMap: yakinTex, bumpScale: .6,
    transparent: true, depthWrite: false, roughness: .97, metalness: 0,
  }));
  yakinZemin.renderOrder = 1;
  yakinZemin.receiveShadow = true;
  sahne.add(yakinZemin);

  /* Mikro yama: yüzey kamerasının gördüğü son ~1 km — küçük kraterler + yoğun gren.
     Kenarı alfa ile solar; orta yamanın üstünde yüzer (0.006 birim = 60 cm). */
  const mikroCnv = kraterDokusu(seed ^ 0x3C7, Math.atan2(-gunesYon.z, -gunesYon.x),
    { kraterSay: 72, rTaban: 4, rGenis: 30, grenSay: 16000, taban: albedoImg, tabanOran: .16 });
  {
    const c = mikroCnv.getContext('2d');
    c.globalCompositeOperation = 'destination-out';
    const gg = c.createRadialGradient(512, 512, 340, 512, 512, 512);
    gg.addColorStop(0, 'rgba(0,0,0,0)'); gg.addColorStop(1, 'rgba(0,0,0,1)');
    c.fillStyle = gg; c.fillRect(0, 0, 1024, 1024);
    c.globalCompositeOperation = 'source-over';
  }
  const mikroTex = new THREE.CanvasTexture(mikroCnv);
  mikroTex.colorSpace = THREE.SRGBColorSpace;
  mikroTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const mikroGeo = new THREE.PlaneGeometry(11, 11, 8, 8);
  mikroGeo.rotateX(-Math.PI / 2);
  const mikroZemin = new THREE.Mesh(mikroGeo, new THREE.MeshStandardMaterial({
    map: mikroTex, bumpMap: mikroTex, bumpScale: .5,
    transparent: true, depthWrite: false, roughness: .97, metalness: 0,
  }));
  mikroZemin.position.y = ZEMIN_UST;
  mikroZemin.renderOrder = 2;
  mikroZemin.receiveShadow = true;
  sahne.add(mikroZemin);

  /* Kayalar: saha çevresine seeded, en-iyi-aday yerleşimli regolit blokları.
     Alçak güneşte uzun gölge düşürürler — yüzey kamerası karesinin tuzu. */
  const kayaGrup = new THREE.Group();
  {
    const rnd = mulberry32(seed ^ 0xCA7A);
    const kayaMatA = new THREE.MeshStandardMaterial({ color: 0x6f6e68, roughness: .95, metalness: 0 });
    const kayaMatB = new THREE.MeshStandardMaterial({ color: 0x5c5b56, roughness: .97, metalness: 0 });
    const yerler = [];
    const ekle = (r0, r1, boy0, boy1, adet) => {
      for (let i = 0; i < adet; i++) {
        let enIyi = null, enIyiUzak = -1;
        for (let d = 0; d < 10; d++) {
          const a = rnd() * Math.PI * 2, r = r0 + Math.pow(rnd(), .8) * (r1 - r0);
          const aday = { x: Math.cos(a) * r, z: Math.sin(a) * r };
          let enYakin = 1e9;
          for (const p of yerler) enYakin = Math.min(enYakin, Math.hypot(aday.x - p.x, aday.z - p.z));
          if (enYakin > enIyiUzak) { enIyiUzak = enYakin; enIyi = aday; }
        }
        yerler.push(enIyi);
        const boy = boy0 + Math.pow(rnd(), 2.2) * (boy1 - boy0); // düşük-çarpık
        const kaya = new THREE.Mesh(new THREE.DodecahedronGeometry(boy, 0), rnd() < .6 ? kayaMatA : kayaMatB);
        kaya.position.set(enIyi.x, ZEMIN_UST + boy * .3, enIyi.z);
        kaya.rotation.set(rnd() * Math.PI, rnd() * Math.PI, rnd() * Math.PI);
        kaya.scale.set(1, .5 + rnd() * .4, .8 + rnd() * .4); // yassı, gömülü blok duruşu
        kaya.castShadow = true; kaya.receiveShadow = true;
        kayaGrup.add(kaya);
      }
    };
    ekle(0.18, 1.9, 0.0018, 0.010, 96);  // saha çevresi: 18–190 m, 18 cm–1 m bloklar
    ekle(1.6, 4.6, 0.005, 0.018, 14);    // uzak halka: seyrek iri kayalar (ufuk silueti)
  }
  sahne.add(kayaGrup);

  /* ---- Araç: craft-blocks (paralel inşa) → yoksa yedek ---- */
  const PALET = { body: 0x2e2f33, panel: 0xcfb07a, accent: 0xc86a40, metal: 0x9aa0a8 };
  let arac = null, aracKaynak = 'craft-blocks';
  let AYAK = 0.46; // craft-blocks ayak tabanı ≈ −0.459 (birim boy)
  try {
    const mod = await import(new URL('../craft_blocks/craft-blocks.mjs', import.meta.url).href);
    arac = mod.buildLander({ scale: 1, palette: PALET });
  } catch (hata) {
    aracKaynak = 'yedek';
    console.info('[lunar-descent] craft-blocks yüklenemedi, yedek araç kullanılıyor:', hata?.message || hata);
    arac = yedekLander(PALET);
    AYAK = 0.5; // yedek aracın tabanı −0.5
  }
  arac.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
  const aracSargi = new THREE.Group();
  aracSargi.add(arac);
  sahne.add(aracSargi);

  /* ---- Plum: gaz koluyla ölçeklenen sıcak koni + ışık konisi.
     Işık disiplini: doygun sıcak ton, beyaz patlama yok; doku altta görünür kalır. */
  const plumGrup = new THREE.Group();
  plumGrup.position.set(-0.5, 0, 0);
  aracSargi.add(plumGrup);
  const koniYap = (r, len, renk, opaklik) => {
    const geo = new THREE.ConeGeometry(r, 1, 22, 1, true);
    geo.translate(0, -0.5, 0);
    geo.rotateZ(-Math.PI / 2); // taban −X'e
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: renk, transparent: true, opacity: opaklik,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }));
    mesh.scale.x = len;
    return mesh;
  };
  const plumDis = koniYap(.155, 1.5, 0xff7a28, .17);
  const plumIc = koniYap(.068, .85, 0xffc37c, .36);
  plumGrup.add(plumDis, plumIc);
  const plumIsik = new THREE.PointLight(0xffa04e, 0, 0, 2);
  sahne.add(plumIsik);

  /* ---- Toz: ~25 m altında plum çarpmasıyla büyüyen radyal süpürme çizgileri.
     Deterministik (seed + sim-zamanı fonksiyonu), kesmeden sonra çöker;
     vakumda balistik — bulut/süspansiyon yok. ---- */
  const TOZ_N = 150;
  const tozRnd = mulberry32(seed ^ 0x702D);
  const tozBaslangic = olaylar.irtifa25 ? olaylar.irtifa25.sim : Infinity;
  const tozParcalar = [];
  for (let k = 0; k < TOZ_N; k++) {
    const fi = k * 2.399963 + (tozRnd() - .5) * .5; // altın açı + seyrek sarsım = düzenli ızgarasız eşit dağılım
    tozParcalar.push({
      fi,
      dogum: tozBaslangic + Math.pow(tozRnd(), 1.3) * Math.max(0.1, (olaylar.temasSim ?? tozBaslangic) - tozBaslangic),
      hiz: 8 + tozRnd() * 30,           // m/s — plum süpürme hızları
      egim: 0.05 + tozRnd() * 0.12,     // radyan — Ay tozu düz, yatık tabakalar halinde uçar
      omur: 2.2 + tozRnd() * 1.8,
    });
  }
  const tozGeo = new THREE.BufferGeometry();
  const tozPoz = new Float32Array(TOZ_N * 2 * 3);
  const tozRenk = new Float32Array(TOZ_N * 2 * 3);
  tozGeo.setAttribute('position', new THREE.BufferAttribute(tozPoz, 3));
  tozGeo.setAttribute('color', new THREE.BufferAttribute(tozRenk, 3));
  const toz = new THREE.LineSegments(tozGeo, new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  toz.frustumCulled = false;
  sahne.add(toz);

  /* Toz durum güncelleme: tamamen sim-zamanının fonksiyonu (scrub güvenli). */
  const tozGuncelle = simT => {
    let gorunur = false;
    for (let k = 0; k < TOZ_N; k++) {
      const p = tozParcalar[k];
      const yas = simT - p.dogum;
      let alfa = 0, x1 = 0, y1 = 0, z1 = 0, x2 = 0, y2 = 0, z2 = 0;
      if (yas > 0 && yas < p.omur) {
        const imp = tozImp(p.dogum);
        if (imp > 0.02) {
          const vr = p.hiz * imp, g = SABITLER.G_AY;
          const yatay = vr * Math.cos(p.egim) * yas;
          const dikey = 0.6 + vr * Math.sin(p.egim) * yas - 0.5 * g * yas * yas;
          if (dikey > -0.2) {
            const cf = Math.cos(p.fi), sf = Math.sin(p.fi);
            x1 = yatay * cf * OLCEK; z1 = yatay * sf * OLCEK;
            y1 = ZEMIN_UST + Math.max(0.004, dikey * OLCEK);
            const kuyruk = Math.min(yatay * .4, Math.min(1.7, (1.4 + vr * 0.1) * (0.4 + 0.6 * imp)));
            x2 = (yatay - kuyruk) * cf * OLCEK; z2 = (yatay - kuyruk) * sf * OLCEK;
            y2 = ZEMIN_UST + Math.max(0.002, (dikey - kuyruk * Math.tan(p.egim) * .6) * OLCEK);
            alfa = imp * Math.min(1, yas / .12) * kirp(1 - yas / p.omur, 0, 1);
            gorunur = true;
          }
        }
      }
      const i6 = k * 6;
      tozPoz[i6] = x1; tozPoz[i6 + 1] = y1; tozPoz[i6 + 2] = z1;
      tozPoz[i6 + 3] = x2; tozPoz[i6 + 4] = y2; tozPoz[i6 + 5] = z2;
      // sıcak gri — additive; parlaklık = alfa
      const r = .62 * alfa, gg = .57 * alfa, b = .5 * alfa;
      tozRenk[i6] = r; tozRenk[i6 + 1] = gg; tozRenk[i6 + 2] = b;
      tozRenk[i6 + 3] = r * .3; tozRenk[i6 + 4] = gg * .3; tozRenk[i6 + 5] = b * .3;
    }
    toz.visible = gorunur;
    if (gorunur) { tozGeo.attributes.position.needsUpdate = true; tozGeo.attributes.color.needsUpdate = true; }
  };
  /* Doğum anındaki plum çarpma şiddeti (irtifa<25 m'de büyür, gaz koluyla çarpılır) */
  const tozImpOnbellek = new Map();
  const tozImp = simT => {
    const key = Math.round(simT * 60);
    if (tozImpOnbellek.has(key)) return tozImpOnbellek.get(key);
    if (olaylar.temasSim != null && simT >= olaylar.temasSim) { tozImpOnbellek.set(key, 0); return 0; }
    // sim-zamanından örnek: oynatma eşdeğerini ikili aramayla bulmak yerine t dizisinde ara
    const d = model.diziler;
    let lo = 0, hi = d.t.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; (d.t[mid] <= simT ? lo = mid : hi = mid); }
    const y = d.y[lo], gaz = d.gaz[lo];
    const v = gaz * Math.pow(kirp(1 - y / 25, 0, 1), 2);
    tozImpOnbellek.set(key, v);
    return v;
  };

  /* ---- İz: kat edilen yörünge (yan kamera için), ilerledikçe açılır ---- */
  const izAdim = 90; // örnek başına 1.5 s sim
  const izNokta = [];
  {
    const d = model.diziler;
    for (let i = 0; i < d.t.length; i += izAdim) {
      const xs = (d.x[i] - ozet.temasX) * OLCEK;
      izNokta.push([xs, d.y[i] * OLCEK + sagitta(xs), 0]);
    }
  }
  const izGeo = new THREE.BufferGeometry();
  const izPoz = new Float32Array((izNokta.length + 1) * 3);
  izNokta.forEach((p, i) => izPoz.set(p, i * 3));
  izGeo.setAttribute('position', new THREE.BufferAttribute(izPoz, 3));
  izGeo.setDrawRange(0, 0);
  const iz = new THREE.Line(izGeo, new THREE.LineBasicMaterial({
    color: 0xcfb07a, transparent: true, opacity: .3, depthWrite: false,
  }));
  iz.frustumCulled = false;
  sahne.add(iz);

  /* ---- Kamera yönetmeni ---- */
  const V = () => new THREE.Vector3();
  const kameraHedef = { goz: V(), bak: V(), fov: 48 };
  const fazKamera = { 1: 'side', 2: 'chase', 3: 'surface' };
  let kamModu = options.camera && options.camera !== 'auto' ? options.camera : 'side';
  let kullaniciSecti = !!(options.camera && options.camera !== 'auto');
  let gecis = null; // {dan:{goz,bak,fov}, sure, t}
  const aracPoz = V();

  const kameraDegerlendir = (mod, s, su, out) => {
    const P = aracPoz;
    if (mod === 'chase') {
      const d = su * 7 + 0.15;
      out.goz.set(P.x - .85 * d, P.y + .5 * d, P.z + .3 * d);
      out.bak.set(P.x + .8 * d, P.y - .2 * d, P.z);
      out.fov = 48;
    } else if (mod === 'side') {
      const d = su * 8 + 0.2;
      out.goz.set(P.x + .1 * d, P.y + .2 * d, P.z + 1.1 * d);
      out.bak.set(P.x + .05 * d, P.y - .04 * d, P.z);
      out.fov = 46;
    } else { // surface: sahada sabit, yukarı bakan klasik iniş filmi karesi
      out.goz.set(0.62, 0.034, 0.8);
      // Bakış, araçla zemin ARASINA: 30 m tablosunda da yer + toz kadrajda kalır
      out.bak.set(P.x, P.y * .6 + 0.012, P.z);
      out.fov = 32;
    }
    // Göz asla YEREL zeminin altına inmesin (eğri yüzeyde yerel yükseklik sagitta'dır)
    out.goz.y = Math.max(out.goz.y, sagitta(out.goz.x) + 0.032);
  };

  const kameraUygula = gercekDt => {
    const s = sonDurum;
    const su = aracOlcek(s.y);
    kameraDegerlendir(kamModu, s, su, kameraHedef);
    if (gecis) {
      gecis.t += gercekDt;
      const f = purussuz(0, 1, gecis.t / gecis.sure);
      kamera.position.lerpVectors(gecis.dan.goz, kameraHedef.goz, f);
      const bak = V().lerpVectors(gecis.dan.bak, kameraHedef.bak, f);
      kamera.fov = gecis.dan.fov + (kameraHedef.fov - gecis.dan.fov) * f;
      kamera.lookAt(bak);
      if (f >= 1) gecis = null;
    } else {
      kamera.position.copy(kameraHedef.goz);
      kamera.fov = kameraHedef.fov;
      kamera.lookAt(kameraHedef.bak);
    }
    kamera.updateProjectionMatrix();
  };

  const kameraGec = (mod, ani = false) => {
    if (mod === kamModu) return;
    if (!ani) {
      gecis = {
        dan: { goz: kamera.position.clone(), bak: kameraHedef.bak.clone(), fov: kamera.fov },
        sure: 1.7, t: 0,
      };
    } else gecis = null;
    kamModu = mod;
  };

  /* ---- Araç ölçeği: frenlemede abartılı, 150 m altında gerçek (webgl sözleşmesi:
     eşik yok, sürekli rampa; küçülme yaklaşma fazında kamera mesafesiyle örtülür) ---- */
  const aracOlcek = irtifa => 0.09 + (6 - 0.09) * purussuz(150, 2000, irtifa);

  /* ---- Durum uygulama ---- */
  const fazAdlari = { 1: 'Frenleme', 2: 'Yaklaşma', 3: 'Son iniş' };
  let sonFazAdi = '';
  let sonDurum = model.durum(0);
  const zEkseni = new THREE.Vector3(0, 0, 1);

  const durumUygula = s => {
    sonDurum = s;
    const su = aracOlcek(s.y);
    const aci = Math.atan2(s.ny, s.nx);
    // temas sonrası bacak oturması: %2 çökme, sekme yok
    const oturma = s.temas ? purussuz(0, 1.4, s.oynat - olaylar.temasOynat) : 0;
    const xs = (s.x - ozet.temasX) * OLCEK;
    const ys = s.y * OLCEK + sagitta(xs) + ZEMIN_UST
      + AYAK * su * Math.max(0, Math.sin(aci)) - 0.02 * su * oturma;
    aracPoz.set(xs, ys, 0);
    aracSargi.position.copy(aracPoz);
    aracSargi.scale.setScalar(su);
    aracSargi.quaternion.setFromAxisAngle(zEkseni, aci);

    // Plum
    const gaz = s.gaz;
    const titrek = 0.9 + 0.1 * (Math.sin(s.t * 37) * .5 + Math.sin(s.t * 59 + 1.7) * .5);
    plumDis.scale.x = Math.max(0.001, 1.6 * gaz * titrek);
    plumIc.scale.x = Math.max(0.001, 0.9 * gaz * titrek);
    const sisme = 0.65 + 0.55 * gaz;
    plumDis.scale.y = plumDis.scale.z = sisme;
    plumIc.scale.y = plumIc.scale.z = sisme;
    plumDis.material.opacity = .2 * gaz * titrek;
    plumIc.material.opacity = .42 * gaz;
    plumGrup.visible = gaz > 0.002;
    const motorDunya = V().set(-0.55 * su, 0, 0).applyQuaternion(aracSargi.quaternion).add(aracPoz);
    plumIsik.position.copy(motorDunya);
    plumIsik.intensity = gaz * su * su * 40;

    // Toz
    tozGuncelle(s.t);

    // İz — alçaldıkça söner (son inişte kadrajı dikey çizgiyle kesmesin) ve
    // MESAFEYLE PENCERELENİR: araçtan 400 birimden (40 km) geride kalan kuyruk
    // çizilmez — sagitta ile ufkun altına dalan uzak uç "gökten inen çizgi"
    // artefaktı bırakmıştı.
    const izSay = Math.min(izNokta.length, Math.floor(s.t / (izAdim / 60)) + 1);
    izPoz[izSay * 3] = xs; izPoz[izSay * 3 + 1] = Math.max(ys, 0.02); izPoz[izSay * 3 + 2] = 0;
    let izBas = 0;
    while (izBas < izSay && Math.abs(xs - izPoz[izBas * 3]) > 160) izBas++;
    izGeo.attributes.position.needsUpdate = true;
    izGeo.setDrawRange(izBas, izSay + 1 - izBas);
    iz.material.opacity = 0.3 * purussuz(90, 600, s.y);
    iz.visible = iz.material.opacity > 0.01;

    // Gölge kamerası aracı izler (alçakta anlamlı, sürekli)
    const gk = gunes.shadow.camera;
    const yarim = Math.max(2.5, su * 11);
    gk.left = -yarim; gk.right = yarim; gk.top = yarim; gk.bottom = -yarim;
    gk.near = 1; gk.far = 400;
    gunes.position.copy(aracPoz).addScaledVector(gunesYon, 160);
    gunes.target.position.set(xs, sagitta(xs), 0);
    gk.updateProjectionMatrix();

    // HUD
    m_irtifa.textContent = s.y >= 1000
      ? `${(s.y / 1000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} km`
      : `${Math.max(0, s.y).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} m`;
    m_vy.textContent = `${s.vy.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m/s`;
    m_vx.textContent = `${s.vx.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} m/s`;
    m_yakit.textContent = `%${(s.yakit * 100).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`;
    yakitBar.style.width = `${(s.yakit * 100).toFixed(1)}%`;
    bukumEl.textContent = `×${Math.round(s.bukum)}`;
    const fazAdi = s.temas ? 'Yüzeyde — motor kapalı' : fazAdlari[s.faz];
    if (fazAdi !== sonFazAdi) {
      sonFazAdi = fazAdi;
      fazAdEl.textContent = fazAdi;
      duyuruEl.textContent = `Faz: ${fazAdi}`;
      // Otomatik kamera önerisi (kullanıcı seçmediyse)
      if (!kullaniciSecti && !s.temas) {
        const oneri = fazKamera[s.faz];
        if (oneri) kameraGec(oneri);
      }
    }
  };

  /* ---- Zaman sürücüsü ---- */
  let oynatiliyor = false;
  let aktif = options.active !== false;
  let oynatZaman = 0;
  let rafId = 0;
  let sonSaat = 0;

  const cizVeGuncelle = gercekDt => {
    durumUygula(model.durum(oynatZaman));
    kameraUygula(gercekDt);
    renderer.render(sahne, kamera);
  };

  const dongu = saat => {
    rafId = 0;
    if (!aktif || !oynatiliyor || document.hidden) return;
    const dt = Math.min(0.1, (saat - sonSaat) / 1000 || 0);
    sonSaat = saat;
    oynatZaman = Math.min(model.toplamOynat, oynatZaman + dt);
    cizVeGuncelle(dt);
    if (oynatZaman >= model.toplamOynat) { oynatiliyor = false; return; }
    rafId = requestAnimationFrame(dongu);
  };
  const donguBaslat = () => {
    if (!rafId && aktif && oynatiliyor) { sonSaat = performance.now(); rafId = requestAnimationFrame(dongu); }
  };
  document.addEventListener('visibilitychange', donguBaslat);

  /* ---- Boyutlandırma ---- */
  const boyutla = () => {
    const w = host.clientWidth || host.offsetWidth || 960;
    const h = host.clientHeight || host.offsetHeight || 540;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    kamera.aspect = w / h;
    kamera.updateProjectionMatrix();
  };
  boyutla();
  const gozlemci = new ResizeObserver(() => { boyutla(); cizVeGuncelle(0); });
  gozlemci.observe(host);

  /* ---- İndirgenmiş hareket / dışa aktarım: son iniş 30 m tablosu ---- */
  const tabloOynat = olaylar.irtifa30 ? olaylar.irtifa30.oynat : model.toplamOynat * .8;
  const dundurulmus = matchMedia('(prefers-reduced-motion: reduce)').matches
    || document.documentElement.dataset.export === 'true'
    || new URLSearchParams(location.search).get('export') === '1';

  /* ---- API ---- */
  const api = {
    advance(dt) { oynatZaman = kirp(oynatZaman + dt, 0, model.toplamOynat); cizVeGuncelle(dt); },
    play() { if (oynatZaman >= model.toplamOynat) oynatZaman = 0; oynatiliyor = true; donguBaslat(); },
    pause() { oynatiliyor = false; },
    restart() {
      oynatZaman = 0; kullaniciSecti = false;
      kameraGec(fazKamera[1], true); sonFazAdi = '';
      oynatiliyor = true; donguBaslat(); cizVeGuncelle(0);
    },
    scrub(f, kaminci = true) {
      const eski = oynatZaman;
      oynatZaman = kirp(f, 0, 1) * model.toplamOynat;
      // büyük sıçramada kamera önerilen moda anında geçer
      if (kaminci && Math.abs(oynatZaman - eski) > 2 && !kullaniciSecti) {
        const s = model.durum(oynatZaman);
        kameraGec(s.temas ? 'surface' : (fazKamera[s.faz] || 'chase'), true);
      }
      cizVeGuncelle(0);
    },
    setPhase(n) {
      const p = olaylar.fazOynat[n];
      if (p != null) api.scrub(p / model.toplamOynat);
    },
    camera: {
      get mode() { return kamModu; },
      transitionTo(mod) {
        if (!['chase', 'side', 'surface'].includes(mod)) return;
        kullaniciSecti = true;
        // Duraklatılmışken kare akmaz — geçiş tween'i asla biteceği yere
        // varamazdı; duraklatmada anında geç (deterministik yakalama için de şart).
        kameraGec(mod, !oynatiliyor);
        if (!oynatiliyor) cizVeGuncelle(0);
      },
    },
    hud(goster) { hudEl.style.display = goster ? '' : 'none'; },
    setActive(deger) {
      aktif = !!deger;
      if (aktif) donguBaslat();
    },
    dispose() {
      oynatiliyor = false; aktif = false;
      if (rafId) cancelAnimationFrame(rafId);
      document.removeEventListener('visibilitychange', donguBaslat);
      gozlemci.disconnect();
      sahne.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
          if (m.map) m.map.dispose(); m.dispose();
        });
      });
      renderer.dispose();
      kok.remove();
    },
    model: { ozet, olaylar, sabitler: SABITLER },
    toplamOynat: model.toplamOynat,
    aracKaynak,
    get oynatZamani() { return oynatZaman; },
    get oynuyor() { return oynatiliyor; },
    get faz() { return sonDurum.temas ? 'temas' : sonDurum.faz; },
  };

  /* Katman kapatma anahtarları (sözleşme §6: hata avı için) —
     ?kapat=arac,iz,toz,zemin,yakin,plum,dunya */
  {
    const kapat = new URLSearchParams(location.search).get('kapat');
    if (kapat) {
      const k = new Set(kapat.split(','));
      if (k.has('arac')) sahne.remove(aracSargi);
      if (k.has('iz')) sahne.remove(iz);
      if (k.has('toz')) sahne.remove(toz);
      if (k.has('zemin')) sahne.remove(buyukZemin);
      if (k.has('yakin')) { sahne.remove(yakinZemin); sahne.remove(mikroZemin); }
      if (k.has('plum')) { plumGrup.removeFromParent(); sahne.remove(plumIsik); }
    }
  }

  /* İlk kare */
  if (dundurulmus) {
    api.scrub(tabloOynat / model.toplamOynat);
  } else {
    kamModu = kullaniciSecti ? kamModu : fazKamera[1];
    cizVeGuncelle(0);
    if (options.autoplay !== false && aktif) api.play();
  }

  return api;
}
