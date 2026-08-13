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
  const S = ayar.S ?? 1024, cnv = document.createElement('canvas'); cnv.width = cnv.height = S;
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

/* Geometri-altı mikro doku: ekstra gren + minik gölgeli pockmark'lar.
   Hepsi örgü çözünürlüğünün ALTINDA kalır (< 1 birim) — gölgesi geometrik
   kraterlerle çelişmez, "havada boyalı krater" etkisi yaratmaz. */
function mikroDetay(cnv, seed, ga, ayar = {}) {
  const rnd = mulberry32(seed ^ 0xB0A7);
  const c = cnv.getContext('2d');
  const S = cnv.width;
  const dx = Math.cos(ga), dy = Math.sin(ga);
  for (let i = 0, n = ayar.gren ?? 15000; i < n; i++) {
    c.globalAlpha = .065 + rnd() * .075;
    c.fillStyle = rnd() < .5 ? '#8d897f' : '#5b584f';
    c.beginPath(); c.arc(rnd() * S, rnd() * S, .5 + rnd() * (ayar.grenBoy ?? 1.9), 0, Math.PI * 2); c.fill();
  }
  for (let i = 0, n = ayar.pock ?? 140; i < n; i++) {
    const x = rnd() * S, y = rnd() * S, r = (ayar.rMin ?? 2) + rnd() * ((ayar.rMax ?? 6) - (ayar.rMin ?? 2));
    c.globalAlpha = .13 + rnd() * .08;   // güneş tarafı iç gölge (kraterDokusu diliyle aynı)
    c.fillStyle = '#2c2a26';
    c.beginPath(); c.ellipse(x - dx * r * .22, y - dy * r * .22, r * .8, r * .62, ga, 0, Math.PI * 2); c.fill();
    c.globalAlpha = .09 + rnd() * .07;   // karşı yay: ince aydınlık rim
    c.strokeStyle = '#c9c3b6'; c.lineWidth = Math.max(.8, r * .3);
    c.beginPath(); c.arc(x, y, r * .82, ga - 1.2, ga + 1.2); c.stroke();
  }
  c.globalAlpha = 1;
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

  /* ---- Zemin: GERÇEK KABARTMALI arazi — paylaşılan yükseklik alanı h(x,z).
     Bileşenler: (a) seed'li krater alanı: çukur çanak + YÜKSELTİLMİŞ kenar
     halkası + s⁻³ sönümlü ejecta örtüsü; çap > 40 birimde merkez tepecik;
     güç yasalı boy dağılımı (çok küçük çok, büyük az). (b) 3 oktav fBm
     regolit dalgalanması. (c) Mare kırışık sırtları — ufuk silueti artık
     cetvel düz değil. (d) moon_disp yükseklik dokusundan geniş ölçekli katkı
     (bump ile aynı 9× tekrar → doku-geometri uyumu). (e) İNİŞ SAHASI TEMİZ
     BÖLGESİ: orijin çevresi ~8 birim yumuşakça h≈0'a bastırılır — temas
     noktası y=0 kalır, ayak/gölge/toz mantığı bozulmaz. (f) Küresel sagitta
     AYNEN korunur (düz-zemin fiziği ↔ eğri görsel köprüsü).
     Aynı araziYukseklik(x,z) HEM geometri yer değiştirmesinde HEM
     kamera/kaya/toz korumalarında kullanılır; arazi statiktir — rAF
     döngüsüne yeni sürekli iş eklemez. */
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

  /* --- moon_disp_real'den CPU örnekleyici: geometri katkısı bump ile hizalı --- */
  let dispOrnek = null;
  if (engebe && engebe.image && engebe.image.width) {
    const DW = 256, DH = 256;
    const dc = document.createElement('canvas'); dc.width = DW; dc.height = DH;
    const dctx = dc.getContext('2d', { willReadFrequently: true });
    dctx.drawImage(engebe.image, 0, 0, DW, DH);
    const dveri = dctx.getImageData(0, 0, DW, DH).data;
    dispOrnek = (u, v) => {
      const fu = ((u % 1) + 1) % 1, fv = 1 - ((v % 1) + 1) % 1; // doku flipY eşleniği
      const px = fu * (DW - 1), py = fv * (DH - 1);
      const x0 = px | 0, y0 = py | 0, x1 = Math.min(DW - 1, x0 + 1), y1 = Math.min(DH - 1, y0 + 1);
      const tx = px - x0, ty = py - y0;
      const oku = (X, Y) => dveri[(Y * DW + X) * 4] / 255;
      return (oku(x0, y0) * (1 - tx) + oku(x1, y0) * tx) * (1 - ty)
           + (oku(x0, y1) * (1 - tx) + oku(x1, y1) * tx) * ty;
    };
  }

  /* --- Seed'li 2B değer gürültüsü (fBm çekirdeği) — tamamı deterministik --- */
  const gurTohum = (seed ^ 0x9E3779B9) >>> 0;
  const izgaraHash = (ix, iz) => {
    let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(gurTohum, 69069)) | 0;
    h = (h ^ (h >>> 13)) | 0; h = Math.imul(h, 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const deger2 = (x, z) => {
    const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
    const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
    const a = izgaraHash(ix, iz), b = izgaraHash(ix + 1, iz);
    const c2 = izgaraHash(ix, iz + 1), d2 = izgaraHash(ix + 1, iz + 1);
    const ab = a + (b - a) * sx;
    return ab + ((c2 + (d2 - c2) * sx) - ab) * sz;
  };

  /* --- Krater alanı: güç yasalı boylar, en-iyi-aday yerleşim (yığılma yok) --- */
  const kraterler = [];
  {
    const rnd = mulberry32(seed ^ 0x7E44A1);
    const halka = (r0, r1, R0, R1, adet) => {
      for (let i = 0; i < adet; i++) {
        const R = R0 + (R1 - R0) * Math.pow(rnd(), 2.6); // düşük-çarpık: çoğu küçük
        let x = 0, z = 0, enIyiSkor = -1;
        for (let a = 0; a < 9; a++) {
          const t = rnd() * Math.PI * 2, rr = Math.sqrt(r0 * r0 + rnd() * (r1 * r1 - r0 * r0));
          const ax = Math.cos(t) * rr, az = Math.sin(t) * rr;
          let enYakin = 1e9;
          for (const k of kraterler) enYakin = Math.min(enYakin, Math.hypot(ax - k.x, az - k.z) - k.R);
          if (enYakin > enIyiSkor) { enIyiSkor = enYakin; x = ax; z = az; }
        }
        if (Math.hypot(x, z) < 14 + R * 2) continue; // iniş sahası temiz kalsın
        const taze = 0.35 + rnd() * 0.65;            // aşınmışlar sığ, tazeler keskin
        const d = R * (0.14 + 0.20 * taze) * Math.min(1, 18 / (6 + R * .25)); // büyükler oransal sığ
        kraterler.push({
          x, z, R, d,
          rim: d * (0.22 + 0.22 * taze),               // yükseltilmiş kenar halkası
          tepe: R > 20 ? d * (0.22 + 0.18 * rnd()) : 0, // çap > 40 birim: merkez tepecik
          us: 2 + 2 * Math.min(1, R / 24),             // büyükte düz taban + dik duvar
        });
      }
    };
    halka(12, 90, 0.8, 5, 90);       // saha çevresi: yüzey kamerasının küçük kraterleri
    halka(14, 130, 0.6, 7, 95);
    halka(110, 700, 2.5, 26, 150);
    halka(600, 2600, 8, 80, 150);
    halka(2200, 6900, 24, 240, 110); // yüksek irtifa karesinin havzaları
  }
  /* mekânsal ızgara: h(x,z) sorgusu yalnız yakın kraterlere bakar (kare başı ucuz) */
  const HUCRE = 160, kraterIzgara = new Map();
  for (const k of kraterler) {
    const yay = k.R * 3.2;
    for (let ix = Math.floor((k.x - yay) / HUCRE); ix <= Math.floor((k.x + yay) / HUCRE); ix++)
      for (let iz = Math.floor((k.z - yay) / HUCRE); iz <= Math.floor((k.z + yay) / HUCRE); iz++) {
        const anahtar = ix * 100003 + iz;
        let liste = kraterIzgara.get(anahtar);
        if (!liste) kraterIzgara.set(anahtar, liste = []);
        liste.push(k);
      }
  }
  const kraterKatki = (x, z) => {
    const liste = kraterIzgara.get(Math.floor(x / HUCRE) * 100003 + Math.floor(z / HUCRE));
    if (!liste) return 0;
    let h = 0;
    for (const k of liste) {
      const s = Math.hypot(x - k.x, z - k.z) / k.R;
      if (s >= 3.1) continue;
      if (s < 1) {
        h += -k.d + (k.d + k.rim) * Math.pow(s, k.us);          // çanak → kenar halkası
        if (k.tepe) h += k.tepe * Math.exp(-(s * s) / 0.078);   // merkez tepecik (σ ≈ 0.28R)
      } else {
        h += k.rim * (1 - purussuz(1.9, 3.1, s)) / (s * s * s); // ejecta örtüsü: s⁻³ sönüm
      }
    }
    return h;
  };

  /* --- Mare kırışık sırtları: ufuk siluetini kıran alçak, uzun kabarıklar.
     İlk ikisi kamera ufuklarına nişanlıdır (yüzey → −x/−z, takip → +x). --- */
  const sirtlar = [];
  {
    const rnd = mulberry32(seed ^ 0x51D7);
    const ekleSirt = (az, rd) => {
      const yon = az + Math.PI / 2 + (rnd() - .5) * 0.9; // yaklaşık teğetsel (yay ailesi)
      sirtlar.push({
        cx: Math.cos(az) * rd, cz: Math.sin(az) * rd,
        ux: Math.cos(yon), uz: Math.sin(yon),
        L: kirp(rd * 0.9, 70, 1500), w: 7 + rd * 0.022,
        H: kirp(0.028 * rd, 1.1, 11) * (0.7 + 0.6 * rnd()),
        faz: rnd() * Math.PI * 2,
      });
    };
    ekleSirt(4.05 + (rnd() - .5) * .5, 95 + rnd() * 70);   // yüzey kamerası ufku
    ekleSirt((rnd() - .5) * .7, 150 + rnd() * 120);        // takip kamerası ufku
    ekleSirt(3.55 + (rnd() - .5) * .4, 190 + rnd() * 90);  // yüzey ufkuna ikinci kat (derinlik)
    for (let i = 0; i < 6; i++)
      ekleSirt(rnd() * Math.PI * 2, 60 * Math.pow(2600 / 60, Math.pow(rnd(), .85)));
  }
  const sirtKatki = (x, z) => {
    let h = 0;
    for (const s of sirtlar) {
      const dx = x - s.cx, dz = z - s.cz;
      const boyunca = dx * s.ux + dz * s.uz;
      const yarim = s.L * 0.55;
      if (Math.abs(boyunca) > yarim) continue;
      const dik = -dx * s.uz + dz * s.ux + Math.sin(boyunca * 0.018 + s.faz) * s.w * 0.7;
      const zarf = 1 - (boyunca / yarim) * (boyunca / yarim);
      h += s.H * zarf * Math.exp(-(dik * dik) / (s.w * s.w));
    }
    return h;
  };

  /* --- Paylaşılan yükseklik alanı: sagitta + temiz-bölge kapılı kabartma --- */
  const araziYukseklik = (x, z) => {
    const d2 = x * x + z * z, d = Math.sqrt(d2);
    // Küresel sagitta + 5000 birim ötesinde ek yuvarlanma (ufuk altına bastırma)
    const kure = -d2 / (2 * R_AY_BIRIM) - (d > 5000 ? ((d - 5000) ** 2) / 1600 : 0);
    const temizlik = purussuz(8, 15, d); // iniş sahası: ~8 birim yarıçapta h≈0
    if (temizlik <= 0) return kure;
    let a = kraterKatki(x, z) + sirtKatki(x, z)
      + (deger2(x / 620, z / 620) - .5) * 5.2          // fBm: geniş kabarma
      + (deger2(x / 145 + 37.2, z / 145 - 11.8) - .5) * 1.7
      + (deger2(x / 34 - 8.5, z / 34 + 21.3) - .5) * 0.55
      + (deger2(x / 14 + 55.1, z / 14 - 3.7) - .5) * 0.28; // yakın alan pürüzü
    if (dispOrnek) a += (dispOrnek((x / 13000 + .5) * 9, (.5 - z / 13000) * 9) - .5) * 6.5;
    return kure + temizlik * a;
  };

  /* --- Arazi örgüsü: TEK kutupsal ızgara — merkezde sık, ufka doğru geometrik
     seyrelen halkalar (LOD dikişi ve z-çatışması hiç doğmaz). ~200k tepe,
     ≤ 400k bütçenin içinde; kurulumda bir kez örneklenir. --- */
  const ACISAL = 384;
  const yaricaplar = [];
  for (let r = 1.5; r < 7200; r *= 1.0165) yaricaplar.push(r);
  yaricaplar.push(7200);
  const halkaSay = yaricaplar.length;
  const tepeSay = halkaSay * ACISAL + 1;
  const aPoz = new Float32Array(tepeSay * 3);
  const aUv = new Float32Array(tepeSay * 2);
  aPoz[1] = araziYukseklik(0, 0); aUv[0] = .5; aUv[1] = .5;
  {
    let v = 1;
    for (const r of yaricaplar) for (let j = 0; j < ACISAL; j++, v++) {
      const t = j / ACISAL * Math.PI * 2;
      const x = Math.cos(t) * r, z = Math.sin(t) * r;
      aPoz[v * 3] = x; aPoz[v * 3 + 1] = araziYukseklik(x, z); aPoz[v * 3 + 2] = z;
      aUv[v * 2] = x / 13000 + .5; aUv[v * 2 + 1] = .5 - z / 13000; // 9× tekrar doku ile aynı harita
    }
  }
  const aIdx = new Uint32Array((ACISAL + (halkaSay - 1) * ACISAL * 2) * 3);
  {
    let n = 0;
    for (let j = 0; j < ACISAL; j++) { // merkez yelpazesi
      aIdx[n++] = 0; aIdx[n++] = 1 + (j + 1) % ACISAL; aIdx[n++] = 1 + j;
    }
    for (let i = 0; i < halkaSay - 1; i++) {
      const bi = 1 + i * ACISAL, bo = bi + ACISAL;
      for (let j = 0; j < ACISAL; j++) {
        const j1 = (j + 1) % ACISAL;
        aIdx[n++] = bi + j; aIdx[n++] = bo + j1; aIdx[n++] = bo + j;
        aIdx[n++] = bi + j; aIdx[n++] = bi + j1; aIdx[n++] = bo + j1;
      }
    }
  }
  const araziGeo = new THREE.BufferGeometry();
  araziGeo.setAttribute('position', new THREE.BufferAttribute(aPoz, 3));
  araziGeo.setAttribute('uv', new THREE.BufferAttribute(aUv, 2));
  araziGeo.setIndex(new THREE.BufferAttribute(aIdx, 1));
  araziGeo.computeVertexNormals(); // alçak güneş bu normallerle kraterleri OKUTUR
  const araziZemin = new THREE.Mesh(araziGeo, new THREE.MeshStandardMaterial({
    map: albedo, bumpMap: engebe || null, bumpScale: engebe ? 2.4 : 0,
    roughness: .96, metalness: 0,
  }));
  araziZemin.receiveShadow = true;
  sahne.add(araziZemin);

  /* Yakın tonlama yaması: BOYALI KRATERSİZ — gerçek albedodan kırpılmış taban +
     regolit greni, araziye h(x,z) ile GİYDİRİLİR (havada duran boyalı krater
     görüntüsü kalmadı; kraterler artık geometrinin işi). İç kısmı deliktir:
     iniş sahasını ve ayak temasını mikro yamaya bırakır. */
  const albedoImg = albedo && albedo.image && albedo.image.width ? albedo.image : null;
  const yakinCnv = kraterDokusu(seed, Math.atan2(-gunesYon.z, -gunesYon.x),
    { taban: albedoImg, tabanOran: .38, kraterSay: 0, grenSay: 9800 });
  mikroDetay(yakinCnv, seed ^ 0x11, Math.atan2(-gunesYon.z, -gunesYon.x),
    { gren: 15000, grenBoy: 2.2, pock: 170, rMin: 2, rMax: 6.5 });
  {
    const c = yakinCnv.getContext('2d');
    c.globalCompositeOperation = 'destination-out';
    // dış kenar solması — uzak zemine dikişsiz karışır
    const gg = c.createRadialGradient(512, 512, 330, 512, 512, 512);
    gg.addColorStop(0, 'rgba(0,0,0,0)'); gg.addColorStop(1, 'rgba(0,0,0,1)');
    c.fillStyle = gg; c.fillRect(0, 0, 1024, 1024);
    // iç delik — iniş sahası açık kalır (aracın ayağını asla örtmez)
    const ic = c.createRadialGradient(512, 512, 20, 512, 512, 55);
    ic.addColorStop(0, 'rgba(0,0,0,1)'); ic.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = ic; c.fillRect(0, 0, 1024, 1024);
    c.globalCompositeOperation = 'source-over';
  }
  const yakinTex = new THREE.CanvasTexture(yakinCnv);
  yakinTex.colorSpace = THREE.SRGBColorSpace;
  const yakinGeo = new THREE.PlaneGeometry(120, 120, 110, 110);
  yakinGeo.rotateX(-Math.PI / 2);
  {
    const p = yakinGeo.attributes.position;
    for (let i = 0; i < p.count; i++)
      p.setY(i, araziYukseklik(p.getX(i), p.getZ(i)) + 0.012); // araziyle HİZALI
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

  /* Orta yama: 34 birimlik geçiş bandı — yüzey kamerasının 10–60 m alanına
     insan-ölçeği gren verir (2048 kanvas ≈ 57 cm/texel). KRATERSİZ: kabartma
     geometrinin işi; yama araziye h(x,z) ile giydirilir. İç delik iniş
     sahasını mikro yamaya bırakır. */
  const ortaCnv = kraterDokusu(seed ^ 0x9A1, Math.atan2(-gunesYon.z, -gunesYon.x),
    { S: 2048, kraterSay: 0, grenSay: 70000, taban: albedoImg, tabanOran: .26 });
  mikroDetay(ortaCnv, seed ^ 0x33, Math.atan2(-gunesYon.z, -gunesYon.x),
    { gren: 80000, grenBoy: 4.5, pock: 460, rMin: 3, rMax: 12 });
  {
    const c = ortaCnv.getContext('2d');
    c.globalCompositeOperation = 'destination-out';
    const gg = c.createRadialGradient(1024, 1024, 780, 1024, 1024, 1024);
    gg.addColorStop(0, 'rgba(0,0,0,0)'); gg.addColorStop(1, 'rgba(0,0,0,1)');
    c.fillStyle = gg; c.fillRect(0, 0, 2048, 2048);
    const ic = c.createRadialGradient(1024, 1024, 220, 1024, 1024, 400);
    ic.addColorStop(0, 'rgba(0,0,0,1)'); ic.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = ic; c.fillRect(0, 0, 2048, 2048);
    c.globalCompositeOperation = 'source-over';
  }
  const ortaTex = new THREE.CanvasTexture(ortaCnv);
  ortaTex.colorSpace = THREE.SRGBColorSpace;
  ortaTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const ortaGeo = new THREE.PlaneGeometry(34, 34, 72, 72);
  ortaGeo.rotateX(-Math.PI / 2);
  {
    const p = ortaGeo.attributes.position;
    for (let i = 0; i < p.count; i++)
      p.setY(i, araziYukseklik(p.getX(i), p.getZ(i)) + 0.008);
    ortaGeo.computeVertexNormals();
  }
  const ortaZemin = new THREE.Mesh(ortaGeo, new THREE.MeshStandardMaterial({
    map: ortaTex, bumpMap: ortaTex, bumpScale: 1.1, // sıyırma açısında gren okunsun
    transparent: true, depthWrite: false, roughness: .97, metalness: 0,
  }));
  ortaZemin.renderOrder = 2;
  ortaZemin.receiveShadow = true;
  sahne.add(ortaZemin);

  /* Mikro yama: yüzey kamerasının gördüğü son ~1 km — seyrek küçük kraterler +
     yoğun gren (2048 kanvas). Kenarı alfa ile solar; düz iniş sahasında durur. */
  const mikroCnv = kraterDokusu(seed ^ 0x3C7, Math.atan2(-gunesYon.z, -gunesYon.x),
    { S: 2048, kraterSay: 40, rTaban: 8, rGenis: 52, grenSay: 60000, taban: albedoImg, tabanOran: .16 });
  mikroDetay(mikroCnv, seed ^ 0x22, Math.atan2(-gunesYon.z, -gunesYon.x),
    { gren: 90000, grenBoy: 5, pock: 380, rMin: 4, rMax: 15 });
  {
    const c = mikroCnv.getContext('2d');
    c.globalCompositeOperation = 'destination-out';
    const gg = c.createRadialGradient(1024, 1024, 680, 1024, 1024, 1024);
    gg.addColorStop(0, 'rgba(0,0,0,0)'); gg.addColorStop(1, 'rgba(0,0,0,1)');
    c.fillStyle = gg; c.fillRect(0, 0, 2048, 2048);
    c.globalCompositeOperation = 'source-over';
  }
  const mikroTex = new THREE.CanvasTexture(mikroCnv);
  mikroTex.colorSpace = THREE.SRGBColorSpace;
  mikroTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const mikroGeo = new THREE.PlaneGeometry(11, 11, 8, 8);
  mikroGeo.rotateX(-Math.PI / 2);
  const mikroZemin = new THREE.Mesh(mikroGeo, new THREE.MeshStandardMaterial({
    map: mikroTex, bumpMap: mikroTex, bumpScale: 1.0, // sıyırma açısında gren okunsun
    transparent: true, depthWrite: false, roughness: .97, metalness: 0,
  }));
  mikroZemin.position.y = ZEMIN_UST;
  mikroZemin.renderOrder = 3;
  mikroZemin.receiveShadow = true;
  sahne.add(mikroZemin);

  /* Kayalar: saha çevresine seeded, en-iyi-aday yerleşimli regolit blokları.
     Alçak güneşte uzun gölge düşürürler — yüzey kamerası karesinin tuzu. */
  const kayaGrup = new THREE.Group();
  {
    const rnd = mulberry32(seed ^ 0xCA7A);
    const kayaMatA = new THREE.MeshStandardMaterial({ color: 0x7b7a74, roughness: .95, metalness: 0 });
    const kayaMatB = new THREE.MeshStandardMaterial({ color: 0x676660, roughness: .97, metalness: 0 });
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
        // kayalar arazi yüksekliğine oturur (gömülme payı boy*.3)
        kaya.position.set(enIyi.x, araziYukseklik(enIyi.x, enIyi.z) + ZEMIN_UST + boy * .3, enIyi.z);
        kaya.rotation.set(rnd() * Math.PI, rnd() * Math.PI, rnd() * Math.PI);
        kaya.scale.set(1, .5 + rnd() * .4, .8 + rnd() * .4); // yassı, gömülü blok duruşu
        kaya.castShadow = true; kaya.receiveShadow = true;
        kayaGrup.add(kaya);
      }
    };
    ekle(0.18, 1.9, 0.0018, 0.010, 96);  // saha çevresi: 18–190 m, 18 cm–1 m bloklar
    ekle(1.6, 4.6, 0.005, 0.018, 14);    // uzak halka: seyrek iri kayalar (ufuk silueti)
    ekle(7, 42, 0.006, 0.05, 44);        // arazi halkası: krater kenarlarına/sırtlara oturan bloklar
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

  /* Motor alev FX: craft-effects (paralel inşa, DONMUŞ API) → yoksa koni yer
     tutucu AYNEN kalır (zorunlu sözleşme). buildEngineFX group'unun origini
     motor ağzında, alev yerel −X'e bakar; aracSargi dönüşü inişte −X'i
     dünyada −Y'ye (aşağı) çevirir — ek döndürme gerekmez. */
  let motorFX = null;
  try {
    const fxMod = await import(new URL('../craft_blocks/craft-effects.mjs', import.meta.url).href);
    if (fxMod && typeof fxMod.buildEngineFX === 'function') {
      motorFX = fxMod.buildEngineFX({ scale: 1, tip: 'hover', seed, palette: PALET });
      motorFX.group.position.set(-0.5, 0, 0); // koni yer tutucuyla aynı motor ağzı
      aracSargi.add(motorFX.group);
      plumDis.visible = plumIc.visible = false; // yer tutucu koniler devre dışı
      console.info('[lunar-descent] craft-effects motor alevi bağlandı.');
    }
  } catch (hata) {
    console.info('[lunar-descent] craft-effects alevi yok, koni yer tutucu kullanılıyor:', hata?.message || hata);
  }

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
            // zemin seviyesi h(x,z)'den (temiz bölgede h≈0; genel arazi güvenli)
            y1 = araziYukseklik(x1, z1) + ZEMIN_UST + Math.max(0.004, dikey * OLCEK);
            const kuyruk = Math.min(yatay * .4, Math.min(1.7, (1.4 + vr * 0.1) * (0.4 + 0.6 * imp)));
            x2 = (yatay - kuyruk) * cf * OLCEK; z2 = (yatay - kuyruk) * sf * OLCEK;
            y2 = araziYukseklik(x2, z2) + ZEMIN_UST + Math.max(0.002, (dikey - kuyruk * Math.tan(p.egim) * .6) * OLCEK);
            alfa = imp * Math.min(1, yas / .12) * kirp(1 - yas / p.omur, 0, 1);
            gorunur = true;
          }
        }
      }
      const i6 = k * 6;
      tozPoz[i6] = x1; tozPoz[i6 + 1] = y1; tozPoz[i6 + 2] = z1;
      tozPoz[i6 + 3] = x2; tozPoz[i6 + 4] = y2; tozPoz[i6 + 5] = z2;
      // sıcak gri — additive; parlaklık = alfa (yeni zeminde okunacak kadar parlak)
      const r = .78 * alfa, gg = .715 * alfa, b = .62 * alfa;
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
    const v = Math.min(1, 1.6 * gaz * Math.pow(kirp(1 - y / 25, 0, 1), 2)); // yeni zeminde okunur şiddet
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
    // Göz asla YEREL arazinin altına inmesin (sagitta koruması h(x,z) ile genellendi)
    out.goz.y = Math.max(out.goz.y, araziYukseklik(out.goz.x, out.goz.z) + 0.032);
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
    gunes.target.position.set(xs, araziYukseklik(xs, 0), 0); // gölge hedefi yerel arazide
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
    if (motorFX) {
      motorFX.update(gercekDt, { gaz: sonDurum.gaz, atesle: !sonDurum.temas && sonDurum.gaz > 0.002 });
      // Işık disiplini: FX ışıkları araç ölçeğiyle (su²) çarpılır — alçak
      // irtifada küçülen araçtan taşan beyaz zemin taşkını olmaz.
      const su2 = aracOlcek(sonDurum.y) ** 2;
      motorFX.group.traverse(o => { if (o.isLight) o.intensity = Math.min(o.intensity * su2, 60); });
    }
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
      if (motorFX) { try { motorFX.dispose(); } catch { /* FX kendi kaynağını bilir */ } }
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
      if (k.has('zemin')) sahne.remove(araziZemin);
      if (k.has('yakin')) { sahne.remove(yakinZemin); sahne.remove(ortaZemin); sahne.remove(mikroZemin); }
      if (k.has('plum')) {
        plumGrup.removeFromParent(); sahne.remove(plumIsik);
        if (motorFX) motorFX.group.removeFromParent();
      }
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
