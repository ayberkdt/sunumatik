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
const ZEMIN_UST = 0.0006;       // arazi yüzeyinin üstündeki ~6 cm oturma payı — ayaklar, kayalar,
                                // toz ve yer izleri bu payla TEK arazi örgüsüne oturur (z-çatışması yok)

/* Altın oranın küpü: detay taplarının frekans adımı. Rasyonel bir adım
   (eski 13/3) iki tapın periyodunu ortak katta buluşturur ve vuru deseni
   üretir; φ³ irrasyonel olduğu için hiçbir tap çifti kayda giremez. */
const FI3 = ((1 + Math.sqrt(5)) / 2) ** 3;   // 4,236068

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

/* ---- YÜZEY DETAY DOKUSU (döşenebilir) — yakın planın gerçek çözünürlüğü ----
   Kanallar:  R = albedo modülasyonu (0.5 nötr) · G,B = yüzey eğimi ∂h/∂x, ∂h/∂z
   (0.5 düz). Yani tek dokuda hem regolit greni hem de mikro rölyefin NORMALİ
   taşınır; ışık her ölçekte gerçek yüzey normalinden hesaplanır (boyalı gölge
   yok — alçak güneş döndüğünde detay da onunla döner).

   Neden döşenebilir + çok ölçekli: aynı doku DÖRT farklı dünya frekansında
   (≈5 m / 22 m / 95 m / 435 m periyot) örneklenir ve toplanır. Pockmark alanı
   güç yasalı (çok küçük çok, iri az) olduğundan aynı alan her ölçekte
   inandırıcı kalır — kraterler 1,5 cm'den 17 m'ye kadar kesintisiz sürer.
   Tekrar deseni dört ayrı DÖNDÜRME + kaydırmayla kırılır (ızgara sırıtmaz).
   Mesafeye göre detay BEDAVA gelir: mip zinciri uzakta ortalamayı 0.5'e
   çeker → katkı kendiliğinden sıfırlanır (ne titreme ne moiré), yakında ise
   tam çözünürlük açılır. */
function detayDokusu(seed, S = 512) {
  const rnd = mulberry32(seed ^ 0xD37A11);
  const N = S * S;
  const H = new Float32Array(N);          // mikro yükseklik
  const A = new Float32Array(N);          // albedo modülasyonu
  const tohum = (seed ^ 0x5EED17) >>> 0;
  const hash = (ix, iy, per, kat) => {
    ix = ((ix % per) + per) % per; iy = ((iy % per) + per) % per;
    let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(kat * 7919 + tohum, 69069)) | 0;
    h = (h ^ (h >>> 13)) | 0; h = Math.imul(h, 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const gur = (x, y, per, kat) => {                 // periyodik kafes → dikişsiz
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = hash(ix, iy, per, kat), b = hash(ix + 1, iy, per, kat);
    const c = hash(ix, iy + 1, per, kat), d = hash(ix + 1, iy + 1, per, kat);
    const ab = a + (b - a) * sx;
    return ab + ((c + (d - c) * sx) - ab) * sy;
  };
  /* DÖNDÜRÜLMÜŞ KAFESLİ gürültü — moiré onarımının çekirdeği (bkz. (a) notu).
     Kafes, Gauss tam sayısı (ga,gb) ile atan(gb/ga) kadar döndürülür. Değişmezlik
     kafesi K(ga,−gb) ve K(gb,ga) tarafından gerilir; bir düğümün TEMSİLCİSİ
     (ga·ix − gb·iy, gb·ix + ga·iy) mod Q ile bulunur (Q = K·(ga²+gb²)). Bu
     eşleme bir homomorfizmadır ve çekirdeği tam olarak o kafestir — yani
     doku bir tile'da BİR KEZ tekrarlanır (düz `% K` kullanmak, alanı
     √(ga²+gb²) kat erken tekrarlatıp yeni bir desen doğuruyordu). */
  const hashD = (ix, iy, Q, ga, gb, kat) => hash(ga * ix - gb * iy, gb * ix + ga * iy, Q, kat);
  const gurD = (x, y, Q, ga, gb, kat) => {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = hashD(ix, iy, Q, ga, gb, kat), b = hashD(ix + 1, iy, Q, ga, gb, kat);
    const c = hashD(ix, iy + 1, Q, ga, gb, kat), d = hashD(ix + 1, iy + 1, Q, ga, gb, kat);
    const ab = a + (b - a) * sx;
    return ab + ((c + (d - c) * sx) - ab) * sy;
  };
  /* (a) fBm regolit dalgalanması + bağımsız albedo benekliliği

     ---- OKTAV KAFESLERİNİN AYRIŞTIRILMASI (zemin moiré'sinin onarımı) ----
     ÖLÇÜM önce yapıldı: yüzey kamerasının ön alanında (kameradan 12–20 m)
     tap B'nin texel boyu 42,9 mm, pikselin arazi ayak izi ise (11°'lik sıyırma
     açısında) 42,8 mm. Yani doku EKSİK ÖRNEKLENMİYOR — mip/anizotropi doğru
     çalışıyor, aliasing YOK. Görünen kusur bir örnekleme artefaktı değil,
     dokunun KENDİ yapısıydı: beş oktavın değer kafesi de EKSENE HİZALI ve
     aynı yönlüydü; hücre köşeleri üst üste binerek düzenli bir NOKTA IZGARASI
     kuruyordu. FFT kanıtı (seed 7, ön alan): λ = 6,75–6,96 px, açı 60–72°,
     güç/medyan 152 — ve tapları tek tek kapatınca sayı yalnız tap B'de
     patlıyor (yok 22,6 · A 27,1 · B 152,2 · C 8,8 · D 10,1). λ tahmini de
     birebir tutuyor: per=78 oktavının hücresi 6,56 teksel = 281,6 mm,
     42,8 mm/px ile 6,58 px.

     Onarım iki katmanlı; İKİSİ DE DÖŞENEBİLİRLİĞİ BOZMAZ:

      (a) GAUSS TAM SAYISI DÖNDÜRMESİ. Her oktav (a,b) tam sayı çiftiyle
          tanımlı M = [[a,b],[−b,a]] matrisinden geçirilir. Bu, ölçekle
          birleşik bir dönmedir: kafes atan(b/a) kadar DÖNER ve 1/√(a²+b²)
          ölçeklenir; `per` bununla bölünerek oktavın frekansı korunur.
          Periyodiklik birebir sürer: tx→tx+1'de px, per·a kadar; py, per·b
          kadar artar — ikisi de `per` katı, hash mod `per` çalıştığı için
          değer aynı kalır.
          DİKKAT — bir tur burada kaybedildi: önce |det| = 1 olan KESME
          (shear) matrisleri denendi. Ölçüm ızgaranın hiç kıpırdamadığını
          gösterdi ve nedeni matematikseldir: unimoduler tam sayı matrisi
          Z²'yi Z² ÜZERİNE eşler, yani kafes kendine gider — yalnız hangi
          hash değerinin hangi düğümde durduğu değişir. Kafesi gerçekten
          döndürmek için det = a²+b² > 1 (alt-kafes) ŞARTTIR.
      (b) 1-periyotlu ALAN BÜKMESİ (iki frekanslı): kaba gürültüden gelen
          yer değiştirme her oktav için AYRI açıyla döndürülüp uygulanır.
          Kafesi yalnız döndürmez, EĞER: düz sıralar kalmaz. Genlik tile
          biriminde sabit tutulur (≈0,03 ≈ 15 teksel), böylece kaba oktavlar
          (hücre 85 teksel) neredeyse bozulmaz — geniş rölyef korunur — ama
          ince oktavlar (hücre 2,8 teksel) tamamen kayıt dışına çıkar. */
  /* [K, ağırlık, ga, gb] — tile başına hücre = K·√(ga²+gb²) ≈ eski periyot
     (6 · 13,4 · 31,6 · 79,3 · 181,4; eskiden 6 · 14 · 33 · 78 · 180),
     kafes dönmesi atan(gb/ga) = 0° · 26,6° · 18,4° · 33,7° · 14,0°. */
  const okt = [[6, .46, 1, 0], [6, .26, 2, 1], [10, .145, 3, 1], [22, .075, 3, 2], [44, .038, 4, 1]];
  const BUK = 0.030;                                    // tile birimi
  const bukAci = [0.41, 1.79, 2.63, 4.02, 5.31];        // rad — eş aralıklı DEĞİL
  /* Bükme alanı KABA IZGARADA (BS²) bir kez hesaplanır ve iki doğrusal
     örneklenir: en ince bileşeni per=11, yani 512/11 ≈ 47 teksellik bir
     dalga — 128'lik ızgara (4 teksel adım) bunu fazlasıyla çözer. Texel
     başına dört `gur` çağrısı yerine on altıda bir maliyet; kurulum
     bütçesi bu yüzden bozulmaz. Izgara sarmalı olduğu için (BS moduyla
     okunur) bükme alanı da 1-periyotlu kalır. */
  const BS = 128, bfX = new Float32Array(BS * BS), bfY = new Float32Array(BS * BS);
  for (let j = 0; j < BS; j++) for (let i = 0; i < BS; i++) {
    const gx = i / BS, gy = j / BS;
    bfX[j * BS + i] = (gur(gx * 4, gy * 4, 4, 201) - .5) + .55 * (gur(gx * 11 + 5.1, gy * 11 - 2.7, 11, 203) - .5);
    bfY[j * BS + i] = (gur(gx * 4 + 2.3, gy * 4 - 1.1, 4, 202) - .5) + .55 * (gur(gx * 11 - 3.3, gy * 11 + 7.9, 11, 204) - .5);
  }
  const bukOku = (alan, gx, gy) => {
    const i0 = Math.floor(gx), j0 = Math.floor(gy), fx = gx - i0, fy = gy - j0;
    const ia = ((i0 % BS) + BS) % BS, ib = (ia + 1) % BS;
    const ja = ((j0 % BS) + BS) % BS, jb = (ja + 1) % BS;
    const t = alan[ja * BS + ia] + (alan[ja * BS + ib] - alan[ja * BS + ia]) * fx;
    const b = alan[jb * BS + ia] + (alan[jb * BS + ib] - alan[jb * BS + ia]) * fx;
    return t + (b - t) * fy;
  };
  const bOlcek = BS / S;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const tx = x / S, ty = y / S;
      const bx = bukOku(bfX, x * bOlcek, y * bOlcek);
      const by = bukOku(bfY, x * bOlcek, y * bOlcek);
      let h = 0, a = 0;
      for (let o = 0; o < okt.length; o++) {
        const K = okt[o][0], w = okt[o][1], ga = okt[o][2], gb = okt[o][3];
        const Q = K * (ga * ga + gb * gb);
        const ca = Math.cos(bukAci[o]), sa = Math.sin(bukAci[o]);
        const ux = tx + BUK * (bx * ca - by * sa);
        const uy = ty + BUK * (bx * sa + by * ca);
        const px = (ga * ux + gb * uy) * K, py = (ga * uy - gb * ux) * K;
        h += (gurD(px, py, Q, ga, gb, o) - .5) * w;
        if (o < 3) a += (gurD(px + 11.3, py - 4.7, Q, ga, gb, o + 40) - .5) * w * .62;
      }
      const i = y * S + x;
      H[i] = h;
      A[i] = .5 + a + (hash(x, y, S, 91) - .5) * .085;  // + ince kum greni
    }
  }
  /* (b) pockmark alanı: güç yasalı boy dağılımı, çanak + yükseltilmiş kenar +
         ejecta örtüsü. Kenarları sarmalı (döşenebilirlik) çizilir.
         KRATERLEŞME MASKESİ: kraterler bir "sünger" gibi her yeri kaplamaz —
         düşük frekanslı bir alan bazı yamaları yoğun kraterli, bazılarını
         pürüzsüz regolit örtüsü bırakır (gerçek yüzeyin lekeli dağılımı). */
  const pockSay = Math.round(S * S / 300);
  for (let p = 0; p < pockSay; p++) {
    const cx = rnd() * S, cy = rnd() * S;
    const maske = gur(cx / S * 5, cy / S * 5, 5, 77);
    if (rnd() > purussuz(.38, .86, maske)) continue;
    const r = Math.min(S * .085, 1.7 * Math.pow(1 - rnd() * .9995, -1 / 1.85));
    const taze = rnd();                              // 1 = taze (parlak ejecta), 0 = aşınmış
    const derin = r * (.055 + .075 * taze);
    const kenar = derin * (.20 + .26 * taze);
    // Gerçek kraterler tam daire DEĞİL: kenar iki harmonikle düzensizleştirilir —
    // aksi hâlde üstten bakışta alan bir "sabun köpüğü" halısı gibi okuyor.
    const h3 = .05 + rnd() * .085, h5 = .025 + rnd() * .055, f3 = rnd() * 6.283, f5 = rnd() * 6.283;
    const R2 = Math.ceil(r * 1.9);
    for (let dy = -R2; dy <= R2; dy++) for (let dx = -R2; dx <= R2; dx++) {
      const uz = Math.hypot(dx, dy);
      if (uz > r * 1.9) continue;
      const te = Math.atan2(dy, dx);
      const s = uz / (r * (1 + h3 * Math.sin(3 * te + f3) + h5 * Math.sin(5 * te + f5)));
      if (s >= 1.7) continue;
      const ix = ((Math.round(cx) + dx) % S + S) % S, iy = ((Math.round(cy) + dy) % S + S) % S;
      const i = iy * S + ix;
      if (s < 1) {
        H[i] += -derin + (derin + kenar) * Math.pow(s, 2.9);
        A[i] += (taze > .68 ? .045 : -.038) * (1 - s * .5); // taze taban aydınlık, eski koyu
      } else {
        const t = 1 - (s - 1) / .7;
        H[i] += kenar * t * t;
        if (taze > .68) A[i] += .062 * t * t;               // taze ejecta halkası
      }
    }
  }
  /* (c) klastlar: iri kum tanesi / cam boncuk lekeleri (albedo çeşitliliği) */
  for (let k = 0, n = Math.round(S * S / 900); k < n; k++) {
    const cx = Math.floor(rnd() * S), cy = Math.floor(rnd() * S);
    const r = 1 + rnd() * 2.6, ac = rnd() < .42, guc = (ac ? .26 : -.20) * (.5 + rnd() * .5);
    const R2 = Math.ceil(r);
    for (let dy = -R2; dy <= R2; dy++) for (let dx = -R2; dx <= R2; dx++) {
      const s = Math.hypot(dx, dy) / r;
      if (s >= 1) continue;
      const i = (((cy + dy) % S + S) % S) * S + (((cx + dx) % S + S) % S);
      A[i] += guc * (1 - s * s);
      H[i] += guc * .012;
    }
  }
  /* (d) eğim kanalları: merkezi fark (sarmalı) + RMS'e göre ölçekleme */
  const gx = new Float32Array(N), gz = new Float32Array(N);
  let kare = 0;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x;
    const sx = H[y * S + (x + 1) % S] - H[y * S + (x + S - 1) % S];
    const sz = H[((y + 1) % S) * S + x] - H[((y + S - 1) % S) * S + x];
    gx[i] = sx; gz[i] = sz; kare += sx * sx + sz * sz;
  }
  const olcek = .40 / Math.max(1e-6, 2.6 * Math.sqrt(kare / (2 * N)));
  const cnv = document.createElement('canvas'); cnv.width = cnv.height = S;
  const ctx = cnv.getContext('2d');
  const img = ctx.createImageData(S, S), veri = img.data;
  for (let i = 0; i < N; i++) {
    veri[i * 4] = kirp(A[i], 0, 1) * 255;
    veri[i * 4 + 1] = kirp(.5 + gx[i] * olcek, 0, 1) * 255;
    veri[i * 4 + 2] = kirp(.5 + gz[i] * olcek, 0, 1) * 255;
    veri[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return cnv;
}

/* ---- BÖLGE ALBEDOSU — gerçek Ay tonlaması (mare / highland / taze ejecta) ----
   Tek tip gri-krem yerine: koyu mare lekeleri, açık highland zeminleri, taze
   kraterlerden çıkan AÇIK ejecta ışınları ve yer yer koyu piroklastik lekeler.
   Dünya koordinatına (x,z → uv) doğrudan bağlanır: krater ALANIYLA aynı seed'i
   kullandığı için ışınlar gerçek krater kenarlarından çıkar, boyanmış süs değil. */
function bolgeAlbedosu(seed, kraterler, kapsam, S = 2048) {
  const rnd = mulberry32(seed ^ 0xB016E);
  const cnv = document.createElement('canvas'); cnv.width = cnv.height = S;
  const c = cnv.getContext('2d');
  const px = x => (x / (2 * kapsam) + .5) * S;
  const py = z => (.5 - z / (2 * kapsam)) * S;
  const pr = r => r / (2 * kapsam) * S;
  c.fillStyle = '#7c7b75'; c.fillRect(0, 0, S, S);          // nötr ay grisi (referans)
  // (a) geniş highland/mare tonlaması — yumuşak, düşük genlikli lekeler
  for (let i = 0; i < 130; i++) {
    const r = S * (.04 + Math.pow(rnd(), 1.6) * .30);
    const x = rnd() * S, y = rnd() * S;
    const ac = rnd() < .5;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, ac ? 'rgba(150,148,141,.30)' : 'rgba(74,72,68,.30)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // (b) mare havzaları: birkaç geniş, belirgin KOYU alan (bazalt dolgusu)
  for (let i = 0; i < 6; i++) {
    const r = S * (.14 + rnd() * .20), x = rnd() * S, y = rnd() * S;
    const g = c.createRadialGradient(x, y, r * .1, x, y, r);
    g.addColorStop(0, 'rgba(58,57,54,.46)'); g.addColorStop(.65, 'rgba(63,62,58,.30)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // (c) taze kraterler: parlak ejecta örtüsü + radyal ışın demeti
  for (const k of kraterler) {
    if (k.R < 6 || k.taze < .62) continue;
    const x = px(k.x), y = py(k.z), r = pr(k.R);
    if (r < 1.2) continue;
    const guc = (k.taze - .62) / .38;
    const g = c.createRadialGradient(x, y, r * .6, x, y, r * 2.6);
    g.addColorStop(0, `rgba(196,192,182,${(.30 * guc).toFixed(3)})`);
    g.addColorStop(.35, `rgba(180,176,166,${(.15 * guc).toFixed(3)})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(x - r * 2.6, y - r * 2.6, r * 5.2, r * 5.2);
    if (k.R < 18) continue;                                  // ışın demeti yalnız irilerde
    const isinSay = 7 + Math.floor(rnd() * 9);
    c.save(); c.translate(x, y);
    for (let i = 0; i < isinSay; i++) {
      const a = rnd() * Math.PI * 2, uz = r * (3 + Math.pow(rnd(), 1.4) * 7);
      const yari = r * (.10 + rnd() * .16);
      c.save(); c.rotate(a);
      const lg = c.createLinearGradient(r, 0, uz, 0);
      lg.addColorStop(0, `rgba(202,198,188,${(.26 * guc).toFixed(3)})`);
      lg.addColorStop(.4, `rgba(190,186,176,${(.13 * guc).toFixed(3)})`);
      lg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = lg;
      c.beginPath(); c.moveTo(r * .8, -yari * .5); c.lineTo(uz, -yari * 1.7);
      c.lineTo(uz, yari * 1.7); c.lineTo(r * .8, yari * .5); c.closePath(); c.fill();
      c.restore();
    }
    c.restore();
  }
  // (d) seyrek koyu lekeler (piroklastik örtü) — düzgünlüğü kırar
  for (let i = 0; i < 46; i++) {
    const r = S * (.008 + Math.pow(rnd(), 2) * .05), x = rnd() * S, y = rnd() * S;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(52,51,48,.34)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return cnv;
}

/* Zemin malzemesine çok ölçekli detayı ve bölge tonlamasını enjekte eder.
   Albedo: bölge tonu × (1 + Σ detay) · Normal: geometrik normale dünya
   uzayında Σ eğim eklenir (yatay zeminde birebir doğru, eğimde yeterli). */
function zeminDetayiEkle(mat, unif) {
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, unif);
    sh.vertexShader = 'varying vec2 vDunyaXZ;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n\tvDunyaXZ = (modelMatrix * vec4(transformed, 1.0)).xz;'
    );
    sh.fragmentShader = `varying vec2 vDunyaXZ;
      uniform sampler2D uDetay; uniform sampler2D uDetay2; uniform sampler2D uBolge;
      uniform vec4 uFrek; uniform vec4 uAlbAmp; uniform vec4 uEgimAmp;
      uniform float uDetayGuc; uniform float uBolgeOlcek; uniform vec2 uZeminTon;
      ` + sh.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
        mat2 DON1 = mat2(0.8000, 0.6000, -0.6000, 0.8000);
        mat2 DON2 = mat2(-0.5137, 0.8580, -0.8580, -0.5137);
        mat2 DON3 = DON1 * DON2;
        vec4 dtA = texture2D(uDetay, vDunyaXZ * uFrek.x);
        vec4 dtB = texture2D(uDetay2, (DON1 * vDunyaXZ) * uFrek.y + vec2(0.317, 0.771));
        vec4 dtC = texture2D(uDetay, (DON2 * vDunyaXZ) * uFrek.z + vec2(0.633, 0.194));
        vec4 dtD = texture2D(uDetay2, (DON3 * vDunyaXZ) * uFrek.w + vec2(0.118, 0.442));
        float dtAlb = (dtA.r - 0.5) * uAlbAmp.x + (dtB.r - 0.5) * uAlbAmp.y
                    + (dtC.r - 0.5) * uAlbAmp.z + (dtD.r - 0.5) * uAlbAmp.w;
        vec3 bolgeTon = texture2D(uBolge, vDunyaXZ * uBolgeOlcek + 0.5).rgb;
        diffuseColor.rgb *= (uZeminTon.x + uZeminTon.y * bolgeTon) * (1.0 + uDetayGuc * dtAlb);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        vec2 dtEgim = (dtA.gb - 0.5) * uEgimAmp.x
                    + ((dtB.gb - 0.5) * uEgimAmp.y) * DON1
                    + ((dtC.gb - 0.5) * uEgimAmp.z) * DON2
                    + ((dtD.gb - 0.5) * uEgimAmp.w) * DON3;
        vec3 dnyN = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
        dnyN = normalize(dnyN + vec3(-dtEgim.x, 0.0, -dtEgim.y) * uDetayGuc);
        normal = normalize((viewMatrix * vec4(dnyN, 0.0)).xyz);`);
  };
  return mat;
}

/* Kaya malzemesine AYNI detay dokusunu üç düzlemli (triplanar) izdüşümle
   uygular: kayaların uv'si yoktur (silme: `deleteAttribute('uv')`) ve yüzeyleri
   her yöne bakar, o yüzden zeminin düz XZ izdüşümü burada sıvanma yapardı.
   Ağırlık: |n|³. Varying, tepeye yazılmış KESME DÜZLEMİ normalidir (bkz.
   kayaGeometrisi): faset içinde sabit, yalnız kenara binen üçgen sırasında
   iki düzlem arasında yumuşak geçer. Zeminle aynı malzeme dili: R = albedo modülasyonu, GB = mikro
   rölyefin eğimi — mikro pürüz BOYANMAZ, gerçek normalden gelir, alçak güneş
   döndüğünde onunla döner.

   KAFES DÖNDÜRME (kusur onarımı): detay dokusunun gürültüsü EKSENE HİZALI
   bir değer kafesidir ve GB kanalları o kafesin merkezi farkıdır — yani
   dikdörtgen hücre sınırlarını en güçlü taşıyan kanal. Zemin bunu dört tapı
   dört ayrı 2×2 DÖNDÜRME ile örnekleyerek gizler; kayanın triplanar'ı ise
   ham eksen izdüşümü kullanıyordu (yalnız ötelenmiş). Genlik yükseltilir
   yükseltilmez kafes doğrudan yüzeye vuruyor ve "JPEG bloğu" gibi KARE
   yamalar bırakıyordu. Artık her düzlem VE her tap ayrı bir döndürmeyle
   örneklenir; eğim vektörü aynı döndürmeyle sağdan çarpılarak (v * M = Mᵀv)
   dünya eksenine geri çevrilir, böylece rölyefin yönü doğru kalır.

   Ölçek seçimi ÖLÇÜLEREK yapıldı (yüzey kamerası, 1600×900, fov 32°, blok
   ~15 m'de): piksel ayak izi ≈ 13 mm. 512² doku ile
     tap A ≈ 2,4 m periyot → 4,7 mm/texel → 2,8 texel/piksel (mip ~1,5)
     tap B ≈ 0,72 m periyot → 1,4 mm/texel → 9,4 texel/piksel (mip ~3,2)
   Yani hiçbir tap BÜYÜTÜLMEZ (magnification yok, mip her zaman ≥1) — eski
   38 cm'lik tap 17 texel/piksele düşüyordu, tamamen mip'e gömülüyor ve hiç
   okunmuyordu. Yeni periyotlarda dokunun taşıyıcı oktavları (≈85 ve ≈37
   texel) ekranda 10–40 px ve 4–12 px'e denk gelir: kırık yüzeyin 5–30 cm'lik
   yonga/çentik dokusu tam olarak bu bant. */
function kayaDetayiEkle(mat, unif) {
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, unif);
    sh.vertexShader = 'varying vec3 vKayaP; varying vec3 vKayaN;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vKayaP = (modelMatrix * vec4(transformed, 1.0)).xyz;
       vKayaN = normalize(mat3(modelMatrix) * objectNormal);`
    );
    sh.fragmentShader = `varying vec3 vKayaP; varying vec3 vKayaN;
      uniform sampler2D uDetay; uniform sampler2D uDetay2;
      uniform vec2 uKayaFrek; uniform vec2 uKayaAlb; uniform vec2 uKayaEgim;
      ` + sh.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec3 kw = abs(vKayaN); kw *= kw * kw; kw /= max(1e-4, kw.x + kw.y + kw.z);
        mat2 KD1 = mat2( 0.8000, 0.6000, -0.6000,  0.8000);
        mat2 KD2 = mat2(-0.5137, 0.8580, -0.8580, -0.5137);
        mat2 KD3 = KD1 * KD2;
        mat2 KD4 = KD2 * KD2;
        mat2 KD5 = KD3 * KD1;
        mat2 KD6 = KD4 * KD3;
        vec4 kAx = texture2D(uDetay,  (KD1 * vKayaP.zy) * uKayaFrek.x + vec2(0.13, 0.57));
        vec4 kAy = texture2D(uDetay,  (KD2 * vKayaP.xz) * uKayaFrek.x + vec2(0.61, 0.29));
        vec4 kAz = texture2D(uDetay,  (KD3 * vKayaP.xy) * uKayaFrek.x + vec2(0.37, 0.83));
        vec4 kBx = texture2D(uDetay2, (KD4 * vKayaP.zy) * uKayaFrek.y + vec2(0.41, 0.13));
        vec4 kBy = texture2D(uDetay2, (KD5 * vKayaP.xz) * uKayaFrek.y + vec2(0.77, 0.62));
        vec4 kBz = texture2D(uDetay2, (KD6 * vKayaP.xy) * uKayaFrek.y + vec2(0.19, 0.88));
        float kAlb = dot(vec3(kAx.r, kAy.r, kAz.r) - 0.5, kw) * uKayaAlb.x
                   + dot(vec3(kBx.r, kBy.r, kBz.r) - 0.5, kw) * uKayaAlb.y;
        diffuseColor.rgb *= 1.0 + kAlb;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        vec2 sAx = ((kAx.gb - 0.5) * uKayaEgim.x) * KD1 + ((kBx.gb - 0.5) * uKayaEgim.y) * KD4;
        vec2 sAy = ((kAy.gb - 0.5) * uKayaEgim.x) * KD2 + ((kBy.gb - 0.5) * uKayaEgim.y) * KD5;
        vec2 sAz = ((kAz.gb - 0.5) * uKayaEgim.x) * KD3 + ((kBz.gb - 0.5) * uKayaEgim.y) * KD6;
        vec3 kEgim = vec3(0.0, -sAx.y, -sAx.x) * kw.x
                   + vec3(-sAy.x, 0.0, -sAy.y) * kw.y
                   + vec3(-sAz.x, -sAz.y, 0.0) * kw.z;
        vec3 kN = normalize(vKayaN + kEgim);
        normal = normalize((viewMatrix * vec4(kN, 0.0)).xyz);`);
  };
  return mat;
}

/* ---- KAYA GEOMETRİSİ: kırık (dışbükey çok yüzlü) siluet ----
   Yarıçap yön fonksiyonudur: R(d) = min_i(d_i / <d, n_i>) — yani rastgele
   yarı-uzayların kesişimi. Bu, çarpma kırılmasıyla oluşmuş köşeli blokların
   gerçek biçim ailesidir (yamru yumru "top" değil). Kalite kademesi ikosfer
   bölünmesiyle verilir: uzaktakiler ucuz (20 yüz), orta alan 80/180, en yakın
   kademe 500. DİKKAT: three'de PolyhedronGeometry bir yüzü (detay+1)² parçaya
   böler (4^detay DEĞİL) — yüz sayısı 20·(d+1)².

   ---- Neden GEOMETRİK mikro pürüz YOK (bir tur geri alındı) ----
   Bir önceki tur "kristal/oyuncak" okumasını kırmak için en yakın kademeyi
   d=9'a (2000 yüz) çıkarıp tepeleri sırt (ridged) gürültüsüyle ötelemişti.
   Ölçüm bunun iki ayrı kusur ürettiğini gösterdi:
     · 2000 yüz, 2,6 m'lik bir blokta ≈ 8 cm faset demek; yüzey kamerasında
       piksel ayak izi 13 mm olduğu için faset ekranda ≈ 6–11 px. flatShading
       ile her faset TEK ton — yani şikâyet edilen "JPEG bloğu" yamalar tam
       olarak fasetlerin kendisiydi (doku örnekleme kusuru DEĞİL: triplanar
       katkısı sıfırlandığında yamalar aynen kaldı, ölçüldü).
     · Güneş 11° elevede. Faset normalleri komşusundan 11–13° sapınca yüzey
       bir terminatör mozaiğine dönüyor: büyük tutarlı AYDINLIK düzlem kalmıyor,
       her şey orta-koyu bulamaca iniyor (aydınlık yüz L 52,7 → 39,6 ölçüldü).
   Alçak güneşte faset ölçekli normal saçılımı kazanılamayacak bir kavgadır.
   O yüzden yüzey dokusu artık GEOMETRİDE değil, piksel başına sürekli olan
   triplanar detayda taşınır (bkz. kayaDetayiEkle) — mozaik riski yok, alçak
   güneşte terminatörü delmiyor.

   ---- "Kristal" okumasının GERÇEK çaresi: daha çok kırılma düzlemi ----
   Politopu daha ince BÖLMEK yeni yüzey detayı üretmez (parçalı düzlemsel bir
   fonksiyonu daha sık örneklemiş olursunuz, hepsi bu). Blok oyuncak gibi
   duruyorsa sebep az sayıda İRİ düz yüzdür. Çare kesme düzlemi sayısını
   artırmak (10–18 → 17–29) ve ofset bandını daraltmaktır (0,54–1,06 →
   0,50–0,86; üst uç 1'in altında olduğu için HER düzlem küreyi gerçekten
   keser, yuvarlak kalıntı bırakmaz).

   ---- KONJUGE EKLEM TAKIMLARI (normal saçılımı denetimi) ----
   Düzlem normallerini küreye SERBEST serpmek 17–29 düzlemde ~25 ayrı normal
   yönü demek. Güneş 11° elevede olduğu için N·L bu yönlere aşırı duyarlıdır:
   blok, tonu birbirinden kopuk fasetlerden oluşan bir "kamuflaj deseni" gibi
   okunuyordu (ölçüldü ve gözle doğrulandı). Gerçek kırılma zaten böyle
   çalışmaz: çarpma kırığı, birbirine yakın dik KONJUGE EKLEM TAKIMLARI
   boyunca ilerler — bir blokta birkaç baskın düzlem ailesi vardır.
   Bu yüzden her kaya için rastgele bir ORTONORMAL ÜÇLÜ kurulur; her kesme
   düzlemi bu üçlünün ±eksenlerinden birine ≤22°'lik bir koni içinde
   saçılır. Sonuç: düzlem SAYISI yüksek (zengin, köşeli siluet, çok sayıda
   faset ve kenar) ama normal AİLESİ altı tane — bloğun büyük yüzeyleri
   tutarlı tonlarda okur, alçak güneşte mozaik yapmaz. */
function kayaGeometrisi(rnd, bolunme) {
  const geo = new THREE.IcosahedronGeometry(1, bolunme);
  const duzlem = [];
  const kure = () => {                       // düzgün dağılmış birim yön
    const t = rnd() * Math.PI * 2, u = rnd() * 2 - 1, s = Math.sqrt(Math.max(0, 1 - u * u));
    return [s * Math.cos(t), u, s * Math.sin(t)];
  };
  const capraz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const birim = v => { const L = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / L, v[1] / L, v[2] / L]; };
  /* Üçlünün ilk ekseni DÜŞEYE yakın tutulur (≤25°). Gerekçe hem fizik hem
     kompozisyon: bir blok, kırık yüzeylerinden birinin üstüne OTURUR — yani
     eklem takımlarından biri kabaca yataydır. Sonuç, bloğun üstünde yataya
     yakın geniş bir faset olması; yüzey kamerası güneşin karşı yakasına
     baktığı için (bakış ile ışık arası ≈ 97°) dik yüzler zaten karanlıkta
     kalır, bloğun okunurluğunu bu YATAY faset taşır: regolitle aynı 11°
     sıyırma ışığını alır, dolayısıyla çevresiyle uyumlu bir tonda okur. */
  const yd = kure();
  const dik = Math.tan(.436 * Math.sqrt(rnd()));           // ≤25° eğim
  const yat = birim([yd[0], 0, yd[2]]);
  const e1 = birim([yat[0] * dik, 1, yat[2] * dik]);
  const e2 = birim(capraz(e1, kure()));      // e1'e dik (kure() e1'e paralel gelemez: ölçü sıfır)
  const e3 = capraz(e1, e2);
  const eksen = [e1, e2, e3];
  const nD = 18 + Math.floor(rnd() * 13);    // 18–30 kesme düzlemi
  for (let i = 0; i < nD; i++) {
    /* İlk altı düzlem ±e1, ±e2, ±e3 — blok her yönden kapanır ve KUTUMSU bir
       çekirdek kazanır; kalanlar rastgele eksen/işaret seçer (köşe pahları). */
    const ek = i < 6 ? i >> 1 : Math.floor(rnd() * 3);
    const e = eksen[ek];
    const im = (i < 6 ? i : Math.floor(rnd() * 2)) & 1 ? -1 : 1;
    /* Koni açısı takıma göre. OTURMA takımı (e1 — yataya yakın olan) DAR
       tutulur (≤8°): güneş 11° elevede olduğu için yataya yakın bir fasetin
       20° eğilmesi N·L'yi kat kat değiştirir, bloğun üstü aydınlık/koyu
       basamaklara bölünüyordu. Dar koni üst yüzeyi tek ve tutarlı aydınlıkta
       bırakır; kırılma dokusunu orada triplanar detay taşır. Yan takımlar
       geniş kalır (≤22°): onlar zaten güneşin karşı yakasında, hepsi koyu. */
    const sap = Math.tan((ek === 0 ? .140 : .384) * Math.sqrt(rnd()));
    const yan = birim(capraz(e, kure()));
    duzlem.push([
      ...birim([e[0] * im + yan[0] * sap, e[1] * im + yan[1] * sap, e[2] * im + yan[2] * sap]),
      .50 + rnd() * .36,
    ]);
  }
  /* ---- Yarıçap = yarı-uzayların kesişimi, BAŞKA HİÇBİR ŞEY ----
     Eskiden bunun üzerine dört sinüs çarpımıyla bir "yonga warp"ı biniyordu.
     İkisi birden kaldırıldı, iki ayrı gerekçeyle:
       · sin(ax)·sin(by)·sin(cz) AYRIŞTIRILABİLİR bir çarpımdır — yani eksene
         hizalı bir 3B dama tahtası. 320 yüzlük eski kademede çözülemediği için
         zararsız görünüyordu; ön plandaki iri blokta faset başına çözülünce
         üst yüzey açık/koyu kareli bir "kamuflaj" desenine dönüyordu.
       · Daha temeli: warp, politopun DÜZ yüzlerini eğriltir. Genlik %8,5 ve
         dalga boyu ≈ 0,86 R olduğu için yüzey eğimi ≈ 32°'ye çıkıyordu — güneş
         11° elevede olduğundan bu, tek bir kırık yüzeyi bile aydınlık/karanlık
         şeritlere bölmeye fazlasıyla yetiyor; üçgen başına sabit normalle de
         eğrilik sert faset basamaklarına dönüşüyor.
     Warp gidince her yüz TAM DÜZLEMSEL olur — bir kırık yüzey tek ve tutarlı
     tonda okur, üzerindeki değişimi yalnız triplanar detay taşır
     (bkz. kayaDetayiEkle).
     Biçim zenginliği artık tek bir yerden gelir: kesme düzlemlerinin sayısı,
     yönü ve ofsetleri. */
  const p = geo.attributes.position;
  const nrm = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const L = Math.hypot(x, y, z) || 1; x /= L; y /= L; z /= L;
    let R = 1.3, nx = x, ny = y, nz = z;   // kazanan yarı-uzayın normali
    for (const d of duzlem) {
      const dp = x * d[0] + y * d[1] + z * d[2];
      if (dp <= .14) continue;
      const r = d[3] / dp;
      if (r < R) { R = r; nx = d[0]; ny = d[1]; nz = d[2]; }
    }
    p.setXYZ(i, x * R, y * R, z * R);
    nrm[i * 3] = nx; nrm[i * 3 + 1] = ny; nrm[i * 3 + 2] = nz;
  }
  geo.deleteAttribute('uv');
  /* Normal, üçgenin GEOMETRİK normali değil, tepenin bağlı olduğu KESME
     DÜZLEMİNİN normalidir. Fark yalnız kenarlarda ortaya çıkar ve tam da
     oradaki kusuru kaldırır: iki fasetin arasındaki dihedral kenarı bir
     üçgen sırası "biniyor" (üç tepesi iki ayrı düzleme ait). computeVertexNormals
     bu üçgenlere ikisinin ARASINDA bir normal veriyordu; güneş 11° elevede
     olduğu için o ara değer kenar boyunca parlak bir TESTERE DİŞİ şeridi
     bırakıyordu (bölünmeyi artırmak dişi inceltiyor ama yok etmiyordu).
     Düzlem normali yazılınca binen üçgen iki düzlem normali arasında
     YUMUŞAK geçer: keskin kenar, aşınmış ince bir pah gibi okur — hem
     kusur gider hem gerçeğe daha yakın olur. Faset İÇİ hiç değişmez: bir
     fasetin bütün tepeleri aynı düzleme aittir, normal sabittir, yüzey
     düz tonda kalır. */
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  return geo;
}

/* Dönüştürülmüş parçaları TEK statik geometriye kaynaklar (çizim çağrısı = 1).
   Tepe rengi: taban ton × üst yüzeylerde biriken ince tozun aydınlığı. */
function birlestirParcalar(parcalar) {
  let n = 0;
  for (const p of parcalar) n += p.geo.attributes.position.count;
  const poz = new Float32Array(n * 3), nrm = new Float32Array(n * 3), ren = new Float32Array(n * 3);
  const v = new THREE.Vector3(), nm = new THREE.Matrix3();
  let o = 0;
  for (const p of parcalar) {
    const gp = p.geo.attributes.position, gn = p.geo.attributes.normal;
    nm.getNormalMatrix(p.m);
    for (let i = 0; i < gp.count; i++, o++) {
      v.fromBufferAttribute(gp, i).applyMatrix4(p.m);
      poz[o * 3] = v.x; poz[o * 3 + 1] = v.y; poz[o * 3 + 2] = v.z;
      v.fromBufferAttribute(gn, i).applyMatrix3(nm).normalize();
      nrm[o * 3] = v.x; nrm[o * 3 + 1] = v.y; nrm[o * 3 + 2] = v.z;
      const ust = Math.max(0, v.y), k = .86 + .30 * ust * ust;
      ren[o * 3] = p.renk[0] * k; ren[o * 3 + 1] = p.renk[1] * k; ren[o * 3 + 2] = p.renk[2] * k;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(poz, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.BufferAttribute(ren, 3));
  return g;
}

/* Kayanın oturduğu yerin izi: temas karanlığı (iç) + savrulmuş ince toz
   halkası (dış). Tek dokuda renk + alfa birlikte değişir. */
function etekDokusu(S = 128) {
  const cnv = document.createElement('canvas'); cnv.width = cnv.height = S;
  const c = cnv.getContext('2d'), M = S / 2;
  const g = c.createRadialGradient(M, M, 0, M, M, M);
  g.addColorStop(0, 'rgba(72,69,63,.46)');
  g.addColorStop(.30, 'rgba(86,83,76,.34)');
  g.addColorStop(.52, 'rgba(154,150,140,.15)');
  g.addColorStop(.78, 'rgba(140,136,127,.06)');
  g.addColorStop(1, 'rgba(120,116,108,0)');
  c.fillStyle = g; c.fillRect(0, 0, S, S);
  return cnv;
}

/* Plum süpürme izi: motor plümünün radyal olarak süpürdüğü kalıcı desen.
   İçte sıkışmış/temizlenmiş koyu daire, dışa doğru ince tozun taşındığı AÇIK
   ışınlar. Vakumda toz balistik gittiği için ışınlar KESKİN ve düz. */
function plumIziDokusu(seed, S = 1024) {
  const rnd = mulberry32(seed ^ 0x91A57);
  const cnv = document.createElement('canvas'); cnv.width = cnv.height = S;
  const c = cnv.getContext('2d'), M = S / 2;
  let g = c.createRadialGradient(M, M, S * .012, M, M, S * .21);
  g.addColorStop(0, 'rgba(92,88,80,.26)'); g.addColorStop(.55, 'rgba(102,98,90,.15)');
  g.addColorStop(1, 'rgba(118,114,105,0)');
  c.fillStyle = g; c.fillRect(0, 0, S, S);
  c.save(); c.translate(M, M);
  // Açısal KÜMELER: süpürme her yöne eşit değil, motor akışı birkaç yönde
  // yoğunlaşır (eşit dağılım "lens patlaması" gibi okuyordu).
  const kume = [];
  for (let i = 0; i < 9; i++) kume.push(rnd() * Math.PI * 2);
  for (let i = 0; i < 190; i++) {
    const a = kume[i % kume.length] + (rnd() - .5) * 0.85;
    const r0 = S * (.035 + rnd() * .075), r1 = S * (.12 + Math.pow(rnd(), 1.7) * .26);
    if (r1 <= r0) continue;
    const w0 = S * (.0014 + rnd() * .0035), w1 = w0 * (2.0 + rnd() * 3.0);
    const ac = rnd() < .70;
    c.save(); c.rotate(a);
    const lg = c.createLinearGradient(r0, 0, r1, 0);
    const al = (.035 + rnd() * .075).toFixed(3);
    lg.addColorStop(0, ac ? `rgba(206,201,190,${al})` : `rgba(74,71,65,${al})`);
    lg.addColorStop(.45, ac ? `rgba(186,181,171,${(al * .6).toFixed(3)})` : `rgba(84,81,74,${(al * .6).toFixed(3)})`);
    lg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = lg;
    c.beginPath(); c.moveTo(r0, -w0); c.lineTo(r1, -w1); c.lineTo(r1, w1); c.lineTo(r0, w0);
    c.closePath(); c.fill();
    c.restore();
  }
  c.restore();
  // dış kenar solması — kesik daire bırakmaz
  c.globalCompositeOperation = 'destination-out';
  const s2 = c.createRadialGradient(M, M, S * .30, M, M, S * .5);
  s2.addColorStop(0, 'rgba(0,0,0,0)'); s2.addColorStop(1, 'rgba(0,0,0,1)');
  c.fillStyle = s2; c.fillRect(0, 0, S, S);
  c.globalCompositeOperation = 'source-over';
  return cnv;
}

/* ---- ARAÇ TEMAS KARARTMASI (ortam örtüşmesi) ----
   Kayaların "etek izi" ile AYNI dil, araca uygulanmış: gövdenin altındaki
   yarı-küre görüşü kapalıdır, yani dolgu ışığı (yarıküre saçılımı + dünya
   ışığı) oraya ulaşamaz. Bu, gölge haritasının çözemeyeceği bir yumuşak
   karartmadır — güneş gölgesinin YERİNE değil, ÜSTÜNE gelir. Dört ped
   noktasında yoğunlaşır: araç zemine "yapıştırılmış" değil, OTURMUŞ okunur.
   Pedin yarıçapı craft-blocks'tan okunan AYAK_YANAL ile eşleşir. */
function aracAoDokusu(pedYari, S = 256) {
  const cnv = document.createElement('canvas'); cnv.width = cnv.height = S;
  const c = cnv.getContext('2d'), M = S / 2;
  // (a) gövde altı geniş, yumuşak karartma
  const g = c.createRadialGradient(M, M, 0, M, M, M * .62);
  g.addColorStop(0, 'rgba(26,24,21,.62)');
  g.addColorStop(.45, 'rgba(38,36,32,.36)');
  g.addColorStop(.78, 'rgba(58,55,50,.11)');
  g.addColorStop(1, 'rgba(70,67,61,0)');
  c.fillStyle = g; c.fillRect(0, 0, S, S);
  // (b) ped dibi: temas noktasında keskinleşen çekirdek
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + k * Math.PI / 2;
    const px = M + Math.cos(a) * pedYari * M, py = M + Math.sin(a) * pedYari * M;
    const r = M * .17;
    const pg = c.createRadialGradient(px, py, 0, px, py, r);
    pg.addColorStop(0, 'rgba(14,13,11,.80)');
    pg.addColorStop(.42, 'rgba(24,22,20,.44)');
    pg.addColorStop(1, 'rgba(40,38,34,0)');
    c.fillStyle = pg; c.fillRect(px - r, py - r, r * 2, r * 2);
  }
  return cnv;
}

/* Ayak pedi izi: pedin bastığı sığ çukur (koyu halka) + çevreye serpilen
   ince tozun açık yakası. */
function pedIziDokusu(S = 256) {
  const cnv = document.createElement('canvas'); cnv.width = cnv.height = S;
  const c = cnv.getContext('2d'), M = S / 2;
  const g = c.createRadialGradient(M, M, 0, M, M, M);
  g.addColorStop(0, 'rgba(70,67,60,.52)');
  g.addColorStop(.36, 'rgba(56,53,48,.66)');    // pedin bastırdığı sığ çukur halkası
  g.addColorStop(.47, 'rgba(196,190,177,.40)'); // dışa itilen toz yakası
  g.addColorStop(.74, 'rgba(160,155,145,.13)');
  g.addColorStop(1, 'rgba(130,126,118,0)');
  c.fillStyle = g; c.fillRect(0, 0, S, S);
  return cnv;
}

/* Doku yüklenemezse uzak zemin için prosedürel yedek (aynı dil, daha kaba). */
function uzakZeminYedek(seed) {
  const cnv = kraterDokusu(seed ^ 0xFA11, Math.PI * .82);
  return new THREE.CanvasTexture(cnv);
}

export async function mountLunarDescent(host, options = {}) {
  const kurulusT0 = performance.now();
  const zaman = {}, olc = k => { zaman[k] = Math.round(performance.now() - kurulusT0); };
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
  renderer.toneMappingExposure = 1.62;  // başlangıç; irtifayla sürülür (bkz. POZLAMA rampası)
  renderer.shadowMap.enabled = true;
  /* PCFShadowMap — PCFSoft DEĞİL. İki gerekçe:
     · Fizik: atmosfer yok, saçılma yok. Güneşin açısal çapı Ay'dan ~0,53°,
       yani 9 m'lik bir aracın 46 m'lik gölgesinde penumbra ancak ~40 cm —
       ekranda birkaç piksel. Gölge KESKİN olmalı; PCFSoft'un geniş çekirdeği
       bu fiziği ihlal ediyordu.
     · Bu three sürümünde PCFSoftShadowMap KULLANIMDAN KALDIRILDI ve konsola
       "Using PCFShadowMap instead" uyarısı basıyordu — uyarı da böyle temizlenir. */
  renderer.shadowMap.type = THREE.PCFShadowMap;
  kok.prepend(renderer.domElement);

  const sahne = new THREE.Scene();
  sahne.background = new THREE.Color(0x010204);
  const kamera = new THREE.PerspectiveCamera(48, 16 / 9, 0.02, 26000);

  /* ---- Işık: alçak güneş (uzun gölgeler), zayıf dünya-ışığı dolgusu ---- */
  /* Güneş yönü — elevasyon GERÇEKTEN 11°. Eski satır y bileşenine tan(11°)
     koyup vektörü normalize ediyordu; ama yatay bileşenin boyu 1 değil 0,717
     olduğu için gerçek elevasyon asin(0,2617) = 15,2°'ye çıkıyordu (belge ve
     yorumlar 11° diyordu — ölçüldü). Doğrusu: yatay yön ayrı normalize edilip
     cos/sin ile ölçeklenir. Sonuç: gölgeler h/tan11° = 5,14·h, yani eskisine
     göre %38 DAHA UZUN — alçak güneşin asıl okuma aracı budur. */
  const gunesElev = 11 * Math.PI / 180;
  const gunesYatay = new THREE.Vector3(-0.62, 0, 0.36).normalize();
  const gunesYon = new THREE.Vector3(
    gunesYatay.x * Math.cos(gunesElev), Math.sin(gunesElev), gunesYatay.z * Math.cos(gunesElev));
  const gunes = new THREE.DirectionalLight(0xfff1dc, 4.3);
  gunes.castShadow = true;
  gunes.shadow.mapSize.set(4096, 4096);
  gunes.shadow.radius = 1;        // vakum: penumbra yok denecek kadar dar
  /* intensity 1.0 = güneş TAM kapanır. Gölge içi karanlığı artık yalnız
     dolgu ışıkları (yarıküre saçılımı + dünya-ışığı) belirler; 0,62 ile
     dolguyu İKİ KEZ saymak gölgeyi silik bir lekeye çeviriyordu. */
  gunes.shadow.intensity = 1.0;
  /* bias/normalBias her karede gölge tekseline göre hesaplanır (bkz. GÖLGE
     KUTUSU). Sabit -0.0004 değeri 399 birimlik derinlik aralığında 15,96 m
     dünya ötelemesi demekti — 9 m'lik aracın gölgesini tamamen yiyordu. */
  gunes.shadow.bias = 0;
  gunes.shadow.normalBias = 0;
  sahne.add(gunes, gunes.target);
  // Mikro rölyefin güneşten kaçan yüzleri jilet siyahı olmasın: zayıf gökyüzü
  // dolgusu (gerçekte de ejecta/kaya saçılımı bu yüzleri hafifçe aydınlatır).
  // groundColor = parlak regolitten seken ışık (yüzey sıçraması): alçak güneşte
  // kayaların ve aracın gölge yüzleri delik gibi kapkara kalmaz.
  sahne.add(new THREE.HemisphereLight(0x2b3140, 0x453b2e, 0.70));
  const dunyaIsigi = new THREE.DirectionalLight(0x39465c, 0.32); // dünya-ışığı (earthshine)
  dunyaIsigi.position.set(-3600, 470, -2900);
  sahne.add(dunyaIsigi);
  /* REGOLİT SIÇRAMASI — İKİ DENEME DE ÖLÇÜMLE GERİ ALINDI, tekrar denemeyin:
     (a) aşağı bakan ayrı bir DirectionalLight (fizikle ölçeklenmiş 0,12
         şiddet: 11° güneşte zeminin aldığı 0,191·S ışıma × ~0,14 albedo
         ≈ 0,027·S, anahtar güneş 4,3 → 0,12). Yönlü ışık YALNIZ tam aşağı
         bakan normalleri aydınlatır; bu sahnede öyle GÖRÜNÜR yüzey yok
         denecek kadar azdır — kareyi 365 pikselde (%0,03) değiştiriyordu.
     (b) HemisphereLight'ın groundColor'ını 0x453b2e → 0x6b5b46'ya yükseltmek
         (ground terimi 2,46×). Ölçüm: aracın gölgeli gövde yüzü 10,6 → 10,6;
         karenin %98'inde fark ≤ 2 seviye. Nedeni aynı: yarıküre ışığında
         YUKARI bakan yüzeyler (yani zeminin tamamı) skyColor'ı görür,
         groundColor'a ancak dik ve aşağı bakan yüzler erişir.
     Sıçrama sahnede zaten skyColor + dünya-ışığı dolgusuyla temsil ediliyor;
     ölçülen gölge/aydınlık zemin oranı 21,9/94,5 = 0,23, Apollo yüzey
     karelerinin bandında. Görünür katkısı olmayan ışık EKLENMEZ. */

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
  /* Yüzey kamerasının sabit durak noktası (sahne birimi). Kaya yerleşimi de
     bunu bilir: kadrajı kapatan iri blok kameranın dibine düşmez. */
  const YUZEY_KAM = { x: 0.62, z: 0.8 };

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
          x, z, R, d, taze,
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

  /* --- SAHA KRATERLERİ: 6–90 m çaplı, yüzey kamerasının GERÇEKTEN gördüğü
     ölçek. Uzak krater alanı iniş sahasının 1400 m çevresini boş bırakıyordu;
     yakın planın "düz PNG" duygusunun asıl kaynağı buydu. Bunlar temiz-bölge
     kapısından BAĞIMSIZ eklenir (kapı 800 m'yi düzler), ama her biri temas
     noktasından en az 15 m uzakta doğar: ayak teması, gölge ve toz mantığı
     hâlâ h(0,0)=0 düz zemine dayanır. --- */
  const sahaKraterleri = [];
  {
    const rnd = mulberry32(seed ^ 0x5A4A17);
    for (let i = 0; i < 300; i++) {
      const R = 0.028 + Math.pow(rnd(), 2.4) * 0.42;   // 2,8–45 m yarıçap
      let x = 0, z = 0, enIyi = -1;
      for (let a = 0; a < 8; a++) {
        const t = rnd() * Math.PI * 2;
        const rr = Math.sqrt(0.0225 + rnd() * (81 - 0.0225));  // 0,15–9 birim
        const ax = Math.cos(t) * rr, az = Math.sin(t) * rr;
        let yakin = 1e9;
        for (const k of sahaKraterleri) yakin = Math.min(yakin, Math.hypot(ax - k.x, az - k.z) - k.R * 1.4);
        if (yakin > enIyi) { enIyi = yakin; x = ax; z = az; }
      }
      if (Math.hypot(x, z) - R * 1.3 < 0.15) continue;  // temas alanı dokunulmaz
      const taze = 0.3 + rnd() * 0.7;
      const d = R * (0.11 + 0.10 * taze);
      sahaKraterleri.push({ x, z, R, d, taze, rim: d * (0.20 + 0.24 * taze), us: 2.2 });
    }
  }
  olc('krater');
  const SHUCRE = 1.2, sahaIzgara = new Map();
  for (const k of sahaKraterleri) {
    const yay = k.R * 2.6;
    for (let ix = Math.floor((k.x - yay) / SHUCRE); ix <= Math.floor((k.x + yay) / SHUCRE); ix++)
      for (let iz = Math.floor((k.z - yay) / SHUCRE); iz <= Math.floor((k.z + yay) / SHUCRE); iz++) {
        const anahtar = ix * 100003 + iz;
        let liste = sahaIzgara.get(anahtar);
        if (!liste) sahaIzgara.set(anahtar, liste = []);
        liste.push(k);
      }
  }
  const sahaKraterKatki = (x, z) => {
    const liste = sahaIzgara.get(Math.floor(x / SHUCRE) * 100003 + Math.floor(z / SHUCRE));
    if (!liste) return 0;
    let h = 0;
    for (const k of liste) {
      const s = Math.hypot(x - k.x, z - k.z) / k.R;
      if (s >= 2.5) continue;
      if (s < 1) h += -k.d + (k.d + k.rim) * Math.pow(s, k.us);
      else h += k.rim * (1 - purussuz(1.6, 2.5, s)) / (s * s);
    }
    return h;
  };
  /* Yakın alan dalgalanması: örgünün ÇÖZEBİLDİĞİ ölçekte (7–21 m dalga boyu,
     ±10–28 cm) hafif kabarma. Ayak halkasının içinde (11 m) tam sıfır, uzakta
     örgü seyreldikçe (aliasing olmasın diye) yeniden söner. */
  const yakinKabarti = (x, z, d) => {
    const kapi = purussuz(0.11, 0.75, d);
    if (kapi <= 0) return 0;
    return kapi * (
        (deger2(x / 0.21 + 12.7, z / 0.21 - 5.3) - .5) * 0.0056 * (1 - purussuz(5, 13, d))
      + (deger2(x / 0.075 - 3.1, z / 0.075 + 8.9) - .5) * 0.0021 * (1 - purussuz(1.6, 4, d))
    );
  };

  /* --- Paylaşılan yükseklik alanı: sagitta + temiz-bölge kapılı kabartma
     + saha kraterleri + yakın alan dalgalanması --- */
  const araziYukseklik = (x, z) => {
    const d2 = x * x + z * z, d = Math.sqrt(d2);
    // Küresel sagitta + 5000 birim ötesinde ek yuvarlanma (ufuk altına bastırma)
    const kure = -d2 / (2 * R_AY_BIRIM) - (d > 5000 ? ((d - 5000) ** 2) / 1600 : 0);
    const yakinAlan = d < 12 ? sahaKraterKatki(x, z) + yakinKabarti(x, z, d) : 0;
    const temizlik = purussuz(8, 15, d); // iniş sahası: ~8 birim yarıçapta h≈0
    if (temizlik <= 0) return kure + yakinAlan;
    let a = kraterKatki(x, z) + sirtKatki(x, z)
      + (deger2(x / 620, z / 620) - .5) * 5.2          // fBm: geniş kabarma
      + (deger2(x / 145 + 37.2, z / 145 - 11.8) - .5) * 1.7
      + (deger2(x / 34 - 8.5, z / 34 + 21.3) - .5) * 0.55
      + (deger2(x / 14 + 55.1, z / 14 - 3.7) - .5) * 0.28; // yakın alan pürüzü
    if (dispOrnek) a += (dispOrnek((x / 13000 + .5) * 9, (.5 - z / 13000) * 9) - .5) * 6.5;
    return kure + temizlik * a + yakinAlan;
  };

  /* --- Arazi örgüsü: TEK kutupsal ızgara — merkezde sık, ufka doğru geometrik
     seyrelen halkalar (LOD dikişi ve z-çatışması hiç doğmaz). ~200k tepe,
     ≤ 400k bütçenin içinde; kurulumda bir kez örneklenir. --- */
  const ACISAL = 384;
  const yaricaplar = [];
  // İlk halka 5 m'de başlar (eskiden 150 m): yüzey kamerasının ön alanı artık
  // dev üçgen dilimleri değil ~1,6 m'lik gerçek örgüdür.
  for (let r = 0.05; r < 7200; r *= 1.016) yaricaplar.push(r);
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
  olc('araziOrnek');
  const araziGeo = new THREE.BufferGeometry();
  araziGeo.setAttribute('position', new THREE.BufferAttribute(aPoz, 3));
  araziGeo.setAttribute('uv', new THREE.BufferAttribute(aUv, 2));
  araziGeo.setIndex(new THREE.BufferAttribute(aIdx, 1));
  araziGeo.computeVertexNormals(); // alçak güneş bu normallerle kraterleri OKUTUR
  /* ---- Çok ölçekli yüzey detayı (mesafeye göre çözünürlük) ----
     Eski üç şeffaf tonlama yaması (yakın/orta/mikro) KALDIRILDI: en iyi
     ihtimalle 54 cm/texel veriyorlardı ve yüzey kamerası bunları 87 piksele
     büyütüyordu — şikâyet edilen "bulanık PNG" tam olarak buydu. Yerine tek
     döşenebilir detay dokusu geldi; DÖRT dünya frekansında örneklenir:
       tap A  ≈   5 m periyot →  ~1,0 cm/texel  (temas planı)
       tap B  ≈  22 m periyot →  ~4,3 cm/texel  (ön alan)
       tap C  ≈  95 m periyot →  ~18,6 cm/texel (orta alan)
       tap D  ≈ 435 m periyot →  ~85 cm/texel   (ufka kadar)
     Böylece kamera yaklaştıkça açılan bir çözünürlük merdiveni oluşur; mip
     zinciri uzakta ince tapları 0.5'e (nötr) çektiği için tek renk düzleşmesi
     de titreme de olmaz. Dört tap ayrı DÖNDÜRME + kaydırma ile örneklendiği
     için tekrar deseni hiçbir ölçekte ızgara olarak okunmaz. */
  const detayKur = tohum => {
    const t = new THREE.CanvasTexture(detayDokusu(tohum, 512));
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.NoColorSpace ?? THREE.LinearSRGBColorSpace; // ham veri (albedo + eğim)
    t.flipY = false;              // ŞART: uv.y doğrudan satır indisi → +z eğimi doğru işaretli
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();         // sıyırma açısı ASIL kullanım
    return t;
  };
  // İki bağımsız detay dokusu: taplar arasında öz-benzerlik yakalanmasın diye
  // A/C bir dokudan, B/D diğerinden örneklenir (tekrar motifi tamamen kırılır).
  const detayTex = detayKur(seed);
  const detayTex2 = detayKur(seed ^ 0x2C4F19);
  const bolgeTex = new THREE.CanvasTexture(bolgeAlbedosu(seed, kraterler, 8000, 2048));
  bolgeTex.wrapS = bolgeTex.wrapT = THREE.ClampToEdgeWrapping;
  bolgeTex.colorSpace = THREE.NoColorSpace ?? THREE.LinearSRGBColorSpace;
  bolgeTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const zeminUnif = {
    uDetay: { value: detayTex },
    uDetay2: { value: detayTex2 },
    uBolge: { value: bolgeTex },
    /* Tap frekansları (tekrar / sahne birimi). Adımlar artık ALTIN ORANIN
       KÜPÜ (φ³ = 4,236068) — kanıtlanabilir biçimde irrasyonel, yani hiçbir
       tap çifti ortak periyoda oturamaz. Eski dizide 4,55/1,05 = 13/3 TAM
       rasyoneldi: B ile C, üç periyotta bir yeniden kayda giriyordu (vuru
       deseni). Periyotlar: 5,00 m · 21,2 m · 89,7 m · 380 m. */
    uFrek: { value: new THREE.Vector4(20.0, 20 / FI3, 20 / (FI3 * FI3), 20 / (FI3 * FI3 * FI3)) },
    uAlbAmp: { value: new THREE.Vector4(0.26, 0.24, 0.22, 0.18) },
    /* Eğim genliği ölçülü: alçak güneşte (11°) fazla dik mikro yüzey, aydınlık
       tarafı 11°'nin ALTINA düşürüp kapkara terminatör lekeleri bırakıyordu. */
    uEgimAmp: { value: new THREE.Vector4(0.34, 0.32, 0.25, 0.17) },
    uDetayGuc: { value: 1 },
    uBolgeOlcek: { value: 1 / 16000 },
    /* Zemin tonu: albedo × (a + b·bölge). Ay regolitinin gerçek normal albedosu
       0,12–0,20'dir; bu ölçekte kamera POZLAMASI (toneMappingExposure + anahtar
       ışık) yükseltilerek Apollo yüzey karelerinin okunur parlaklığı yakalanır —
       katman yığma değil, tek yerden yönetilen pozlama. */
    uZeminTon: { value: new THREE.Vector2(1.05, 2.45) },
  };
  /* Kaya yüzey dokusunun TAMAMI buradan gelir (zeminle tek malzeme dili,
     yalnız üç düzlemli izdüşümle). Siluet politoptan, yüzey bu iki taptan:
       tap A ≈ 2,4 m periyot → 4,7 mm/texel → 2,8 texel/px (mip ~1,5)
       tap B ≈ 0,72 m periyot → 1,4 mm/texel → 9,4 texel/px (mip ~3,2)
     Eski genlikler (albedo 0,22/0,20 · eğim 0,20/0,16) ÖLÇÜLEBİLİR bir katkı
     vermiyordu: hepsini sıfırlamak aydınlık yüz parlaklığını 39,6'dan yalnız
     38,9'a indiriyordu (yani hiçbir şey), çünkü 38 cm'lik tap 17 texel/piksele
     düşüp mip'e gömülüyordu. Şimdi EĞİM kanalı ~4 kat yükseltildi — kırık
     yüzeyin okunmasını taşıyan kanal bu. ALBEDO kanalı ise ölçülü tutuldu
     (zeminin tap başına üst sınırıyla aynı mertebe): yükseltmek yüzeye görünür
     bir katkı yapmıyor (0,60/0,50 ile 0,30/0,26 arasında aydınlık yüz farkı
     0,1 L ölçüldü), yalnız kontrast kirletiyordu. Sonuç ÖLÇÜLDÜ: aydınlık yüz
     / regolit oranı 0,645 — düzeltme öncesi 0,495, gerileme öncesi 0,607. */
  const kayaUnif = {
    uDetay: { value: detayTex },
    uDetay2: { value: detayTex2 },
    /* 41,7 ↔ 139,0 oranı TAM 10/3'tü (rasyonel: iki tap üç periyotta bir
       aynı kayda giriyordu). π ile çarpmak oranı irrasyonel yapar; periyot
       0,72 m'den 0,76 m'ye kayar — ölçülen texel/piksel bandı aynı kalır. */
    uKayaFrek: { value: new THREE.Vector2(41.7, 41.7 * Math.PI) },
    uKayaAlb: { value: new THREE.Vector2(0.30, 0.26) },
    uKayaEgim: { value: new THREE.Vector2(0.85, 0.70) },
  };
  if (albedo) albedo.anisotropy = renderer.capabilities.getMaxAnisotropy();

  olc('doku');
  /* bumpMap KALDIRILDI: three'nin bump türevi EKRAN uzayındadır — 9× tekrarlı
     yükseklik dokusu yörünge irtifasında aşırı büyütüldüğünde normal sapması
     kontrolsüz büyüyüp uzak yüzeyi beyaza patlatıyordu (üstelik aynı yükseklik
     katkısı zaten GEOMETRİDE var: dispOrnek). Normaller artık iki kaynaktan
     gelir: gerçek örgü normalleri + dünya uzayında ölçeği bilinen detay eğimi. */
  const araziZemin = new THREE.Mesh(araziGeo, zeminDetayiEkle(new THREE.MeshStandardMaterial({
    map: albedo, roughness: .96, metalness: 0,
  }), zeminUnif));
  araziZemin.receiveShadow = true;
  sahne.add(araziZemin);

  /* ---- KAYALAR: kırık bloklar, KÜMELENMİŞ yerleşim, kısmen gömülü ----
     Eskiden: tek boy dodecahedron, tekdüze en-iyi-aday serpme → "her yere eşit
     dağılmış koyu yamru yumru bloklar". Şimdi:
     · Biçim: rastgele yarı-uzayların kesişimi (dışbükey çok yüzlü) = çarpma
       kırılmasının gerçek biçim ailesi; köşeli siluet, düz kırık yüzeyler.
     · Boy: güç yasası N(>D) ∝ D^-2,1 — çok küçük ÇOK, iri NADİR.
     · Yerleşim: kaya yoğunluğu KRATER KENARLARINDA ve ejecta hatlarında
       yükselir, düzlüklerde düşer (reddetme örneklemesi) + yamalı seyreklik.
     · Duruş: her blok boyunun %22–77'si kadar GÖMÜLÜ; oturduğu yerde toz
       halkası + temas karanlığı (etek izi).
     · Kalite kademesi (4 kademe): en yakın bloklar 500 yüz, sonra 180/80/20.
       Kademe SIRALAMAYLA dağıtılır (aşağıya bak). */
  const kayaGrup = new THREE.Group();
  let kayaTepe = 0, kayaSay = 0;
  {
    const rnd = mulberry32(seed ^ 0xCA7A);
    const havuz = [[], [], [], []];
    /* Kademe 3 = EN YAKIN: d=9 → 2000 yüz. Bir önceki turda 2000 yüz KUSUR
       kaynağıydı; artık değil, çünkü sebep bölünme sayısı değil, o bölünmenin
       üstündeki EĞRİLİKti (sırt gürültüsü + sinüs warp). Yüzey artık parçalı
       DÜZLEMSEL: bir fasetin bütün üçgenleri tam eş düzlemlidir, dolayısıyla
       ek üçgen ek normal saçılımı üretmez — bölünme yalnız kesme düzlemi
       KENARLARININ ne kadar doğru çizildiğini belirler. Yüksek bölünme burada
       bedava: 18–30 düzlemin kesişim kenarları temiz çıkar. */
    for (let q = 0; q < 4; q++)
      for (let i = 0, n = q === 3 ? 6 : 12; i < n; i++)
        havuz[q].push(kayaGeometrisi(rnd, q === 3 ? 9 : q));
    /* Kaya albedosu zeminle AYNI pozlama kazancını alır (uZeminTon ile aynı
       çarpan): aksi hâlde bloklar sahnenin geri kalanından ~3 kat koyu, siyah
       leke gibi okunuyordu. Gerçekte kaya yüzeyi regolitten hafifçe PARLAKTIR
       (daha az olgunlaşmış yüzey), o yüzden çarpan biraz yüksek tutulur. */
    const KAYA_KAZANC = 2.95;
    const tonlar = [0x8f8c84, 0x7d7b73, 0x6c6a62, 0x9b988d, 0x605e57]
      .map(h => {
        const c = new THREE.Color(h); if (c.convertSRGBToLinear) c.convertSRGBToLinear();
        return [c.r * KAYA_KAZANC, c.g * KAYA_KAZANC, c.b * KAYA_KAZANC];
      });

    /* Kaya yoğunluğu alanı — hem saha hem uzak krater alanından beslenir. */
    const kenarKatki = (liste, x, z, olcek) => {
      let y = 0;
      if (liste) for (const k of liste) {
        const s = Math.hypot(x - k.x, z - k.z) / k.R;
        if (s > 2.4) continue;
        if (s > 0.80 && s < 1.32) y += 1.5 * k.taze * olcek;                      // kenar tacı
        else if (s >= 1.32) y += 0.95 * k.taze * olcek * Math.exp(-(s - 1.32) * 1.8); // ejecta hattı
        else if (s > 0.5) y += 0.34 * k.taze * olcek;                             // iç duvar dökülmesi
      }
      return y;
    };
    const yogunluk = (x, z) => {
      let y = 0.075                                                               // düzlük taban seviyesi
        + kenarKatki(sahaIzgara.get(Math.floor(x / SHUCRE) * 100003 + Math.floor(z / SHUCRE)), x, z, 1)
        + kenarKatki(kraterIzgara.get(Math.floor(x / HUCRE) * 100003 + Math.floor(z / HUCRE)), x, z, .8);
      // yamalı seyreklik: düzlükte bile kümeler var, aralar bomboş
      y *= 0.16 + 2.5 * Math.pow(deger2(x / 0.62 + 91.3, z / 0.62 - 17.6), 2.7);
      return y;
    };

    const parcalar = [[], [], [], []];
    const etekler = [];
    const bloklar = [];
    const V3 = (a, b, c) => new THREE.Vector3(a, b, c);
    const m4 = new THREE.Matrix4(), qt = new THREE.Quaternion(), eu = new THREE.Euler();
    const yerlestir = (r0, r1, boyTaban, boyTavan, hedef, kahraman = 0) => {
      let kabul = 0, deneme = 0;
      while (kabul < hedef && deneme++ < hedef * 40) {
        const t = rnd() * Math.PI * 2;
        const rr = Math.sqrt(r0 * r0 + rnd() * (r1 * r1 - r0 * r0));
        const x = Math.cos(t) * rr, z = Math.sin(t) * rr;
        if (rnd() > Math.min(1, yogunluk(x, z))) continue;
        /* KAMERA PLATOSU (kompozisyon) — TAVAN ve TABAN birlikte.
           Kucakta dev blok istemiyoruz, ama bir önceki tur tavanı öyle sıktı ki
           ön plandaki blok 22 m'de 1,3 m'ye indi: kadraj boşaldı, ölçek duygusu
           kayboldu (istenen şey buydu değil). Şimdi:
             · 6,5 m'ye kadar blok yok; boy TAVANI 30 m'ye kadar DOĞRUSAL
               rampalanır (8 m'de 0,8 m — 15 m'de 2,6 m). Yani iri blok yine
               kadrajı kapatamaz, ama ön plan da bodur kalmaz.
             · 10–20 m penceresindeki İLK blok "kahraman" seçilir ve boyu
               tavana çekilir. Ön planda okunaklı bir bloğun bulunması artık
               şansa (bu halkada 20 m içine ~1,4 blok düşüyor) bırakılmaz.
               Deterministik: yerleşim sırasının ve uzaklığın fonksiyonu. */
        const kamD = Math.hypot(x - YUZEY_KAM.x, z - YUZEY_KAM.z);
        const SD0 = 0.065, SD1 = 0.30;
        if (kamD < SD0) continue;
        kabul++;
        let boy = Math.min(boyTavan, boyTaban * Math.pow(1 - rnd() * .9995, -1 / 2.1));
        const tavan = 0.004 + 0.063 * kirp((kamD - SD0) / (SD1 - SD0), 0, 1);
        if (kamD < SD1) boy = Math.min(boy, tavan);
        if (kahraman > 0 && kamD > 0.10 && kamD < 0.20) { boy = Math.max(boy, tavan * .58); kahraman--; }
        const gom = .22 + rnd() * .55;                         // kısmen GÖMÜLÜ duruş
        const egik = (rnd() < .18 ? 1.15 : .38);
        eu.set((rnd() - .5) * egik, rnd() * Math.PI * 2, (rnd() - .5) * egik, 'YXZ');
        qt.setFromEuler(eu);
        m4.compose(
          V3(x, araziYukseklik(x, z) + ZEMIN_UST + boy * (.62 - gom), z), qt,
          V3(boy * (.82 + rnd() * .46), boy * (.48 + rnd() * .46), boy * (.82 + rnd() * .46)));
        const ton = tonlar[Math.floor(rnd() * tonlar.length)];
        const p = .86 + rnd() * .3;
        bloklar.push({
          m: m4.clone(), renk: [ton[0] * p, ton[1] * p, ton[2] * p], u: rnd(),
          pk: boy / Math.max(.1, kamD),        // yüzey kamerasındaki görünen boy
          ps: boy / Math.max(.1, rr),          // iniş sahasındaki görünen boy
        });
        kayaSay++;
        if (boy >= .0032) etekler.push({ x, z, y: araziYukseklik(x, z) + ZEMIN_UST * .6, s: boy * (2.1 + rnd() * 1.3), a: rnd() * Math.PI });
      }
    };
    yerlestir(0.13, 3.6, 0.0026, 0.026, 780, 1);   // 13–360 m: yüzey kamerasının ön/orta alanı
    yerlestir(3.4, 16, 0.004, 0.055, 280);      // saha çevresi
    yerlestir(15, 70, 0.008, 0.16, 240);        // arazi halkası: krater kenarları, sırt etekleri

    /* ---- Kalite kotası SIRALAMAYLA dağıtılır ----
       Eski kural eşikliydi ve slotları İLK uyan blok kapıyordu; boy tavanı
       düşünce yüzey kamerasının ön planı hiç eşiği geçemeyip orta kademede
       (180 yüz) kalabiliyordu. Şimdi bütün bloklar toplanır, görünen boya göre sıralanır
       ve kota tepeden dağıtılır. Kota İKİ kameraya paylaştırılır: 5 slot yüzey
       kamerasının kadrajına (pk), 7 slot genel görünürlüğe (pk|ps) — aksi hâlde
       iniş sahasının dibindeki bloklar bütün kotayı yerdi. Sıralama
       deterministik: eşitlikte yerleşim sırası bozar. */
    const YAKIN_KOTA = 12, ORTA_KOTA = 90;
    bloklar.forEach((b, i) => { b.i = i; b.pg = Math.max(b.pk, b.ps); b.k = -1; });
    const kotaDagit = (anahtar, kota, kademe) => {
      bloklar.filter(b => b.k < 0).sort((a, b) => anahtar(b) - anahtar(a) || a.i - b.i)
        .slice(0, kota).forEach(b => { b.k = kademe; });
    };
    kotaDagit(b => b.pk, 5, 3);
    kotaDagit(b => b.pg, YAKIN_KOTA - 5, 3);
    kotaDagit(b => b.pg, ORTA_KOTA, 2);
    for (const b of bloklar) {
      const kalite = b.k >= 0 ? b.k : b.pg > .0016 ? 1 : 0;
      parcalar[kalite].push({
        geo: havuz[kalite][Math.floor(b.u * havuz[kalite].length)], m: b.m, renk: b.renk,
      });
    }

    const kayaMat = kayaDetayiEkle(new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: .95, metalness: 0,
    }), kayaUnif);
    for (let q = 0; q < 4; q++) {
      if (!parcalar[q].length) continue;
      const g = birlestirParcalar(parcalar[q]);
      kayaTepe += g.attributes.position.count;
      const mesh = new THREE.Mesh(g, kayaMat);
      mesh.castShadow = true; mesh.receiveShadow = true;
      kayaGrup.add(mesh);
    }
    /* Etek izleri: kayanın oturduğu yerde temas karanlığı + savrulmuş toz
       halkası — blok zemine "yapıştırılmış" değil, GÖMÜLÜ okunur. */
    if (etekler.length) {
      const n = etekler.length;
      const ep = new Float32Array(n * 12), eu2 = new Float32Array(n * 8);
      const ei = new Uint32Array(n * 6);
      etekler.forEach((e, i) => {
        const ca = Math.cos(e.a) * e.s, sa = Math.sin(e.a) * e.s;
        const uvk = [[0, 0], [1, 0], [0, 1], [1, 1]];
        for (let k = 0; k < 4; k++) {
          const u = uvk[k][0] * 2 - 1, v = uvk[k][1] * 2 - 1;   // döndürülmüş kare
          ep[(i * 4 + k) * 3] = e.x + u * ca - v * sa;
          ep[(i * 4 + k) * 3 + 1] = e.y;
          ep[(i * 4 + k) * 3 + 2] = e.z + u * sa + v * ca;
          eu2[(i * 4 + k) * 2] = uvk[k][0]; eu2[(i * 4 + k) * 2 + 1] = uvk[k][1];
        }
        const b = i * 4;
        ei.set([b, b + 3, b + 1, b, b + 2, b + 3], i * 6);
      });
      const eg = new THREE.BufferGeometry();
      eg.setAttribute('position', new THREE.BufferAttribute(ep, 3));
      eg.setAttribute('uv', new THREE.BufferAttribute(eu2, 2));
      eg.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 12).map((_, i) => i % 3 === 1 ? 1 : 0), 3));
      eg.setIndex(new THREE.BufferAttribute(ei, 1));
      const etekTex = new THREE.CanvasTexture(etekDokusu(128));
      etekTex.colorSpace = THREE.SRGBColorSpace;
      etekTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      const etekMesh = new THREE.Mesh(eg, new THREE.MeshStandardMaterial({
        map: etekTex, transparent: true, depthWrite: false, roughness: .98, metalness: 0,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      }));
      etekMesh.renderOrder = 1;
      kayaGrup.add(etekMesh);
      kayaTepe += n * 4;
    }
  }
  olc('kaya');
  sahne.add(kayaGrup);

  /* ---- Plum süpürme izi: motorun radyal olarak süpürdüğü KALICI desen.
     İrtifa 25 m'de açılmaya başlar (tozun kalktığı an), temasta tam güce
     ulaşır ve orada kalır — vakumda süpürülen toz geri oturmaz. Tamamen
     sim-zamanının fonksiyonu (scrub/dışa aktarım güvenli). ---- */
  const izTex = new THREE.CanvasTexture(plumIziDokusu(seed, 1024));
  izTex.colorSpace = THREE.SRGBColorSpace;
  izTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const supurmeGeo = new THREE.PlaneGeometry(0.86, 0.86, 72, 72);
  supurmeGeo.rotateX(-Math.PI / 2);
  {
    const p = supurmeGeo.attributes.position;
    for (let i = 0; i < p.count; i++)
      p.setY(i, araziYukseklik(p.getX(i), p.getZ(i)) + ZEMIN_UST * .55);
    supurmeGeo.computeVertexNormals();
  }
  const supurmeMat = zeminDetayiEkle(new THREE.MeshStandardMaterial({
    map: izTex, transparent: true, opacity: 0, depthWrite: false,
    roughness: .97, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
  }), zeminUnif);
  const supurme = new THREE.Mesh(supurmeGeo, supurmeMat);
  supurme.renderOrder = 2;
  supurme.receiveShadow = true;
  supurme.visible = false;
  sahne.add(supurme);

  olc('supurme');
  /* ---- Araç: craft-blocks (paralel inşa) → yoksa yedek ---- */
  const PALET = { body: 0x2e2f33, panel: 0xcfb07a, accent: 0xc86a40, metal: 0x9aa0a8 };
  let arac = null, aracKaynak = 'craft-blocks';
  let AYAK = 0.46;       // craft-blocks ayak tabanı ≈ −0.459 (birim boy)
  let AYAK_YANAL = 0.82; // pedlerin eksene dik yarıçapı (craft-blocks: ry/rz × 0.82)
  try {
    const mod = await import(new URL('../craft_blocks/craft-blocks.mjs', import.meta.url).href);
    arac = mod.buildLander({ scale: 1, palette: PALET });
  } catch (hata) {
    aracKaynak = 'yedek';
    console.info('[lunar-descent] craft-blocks yüklenemedi, yedek araç kullanılıyor:', hata?.message || hata);
    arac = yedekLander(PALET);
    AYAK = 0.5;          // yedek aracın tabanı −0.5
    AYAK_YANAL = 0.44;
  }
  olc('arac');
  /* ÖZ-GÖLGE: castShadow tek başına aracın kendi üzerine gölge DÜŞÜRMESİNİ
     sağlamaz — alıcı taraf da açık olmalı. Alçak güneşte (11°) gövdenin
     bacaklara, ayak konsollarının pedlere düşürdüğü gölge aracın hacmini
     okutan asıl ipuçlarından biridir. */
  arac.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const aracSargi = new THREE.Group();
  aracSargi.add(arac);
  sahne.add(aracSargi);

  /* Temas karartması çıkartması (bkz. aracAoDokusu). Zemine paralel, arazi
     yüksekliğine oturur; opaklığı irtifayla sürülür (durumUygula). */
  const aoTex = new THREE.CanvasTexture(aracAoDokusu(AYAK_YANAL * 0.62, 256));
  aoTex.colorSpace = THREE.SRGBColorSpace;
  aoTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const aoMat = new THREE.MeshBasicMaterial({
    map: aoTex, transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.CustomBlending,          // çarpımsal: ışık EKLEMEZ, yalnız kısar
    blendSrc: THREE.ZeroFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5,
  });
  const aoGeo = new THREE.PlaneGeometry(AYAK_YANAL * 0.09 * 4.4, AYAK_YANAL * 0.09 * 4.4, 1, 1);
  aoGeo.rotateX(-Math.PI / 2);
  const aoDecal = new THREE.Mesh(aoGeo, aoMat);
  aoDecal.renderOrder = 4;
  aoDecal.visible = false;
  sahne.add(aoDecal);

  /* Ayak pedi izleri: pedin bastırdığı sığ çukur + çevresine serpilen ince
     toz yakası. Temas anında 1,1 s içinde açılır (bacak oturmasıyla aynı
     ritim), sonra kalıcıdır. Ped yarıçapı araç geometrisinden okunur —
     yedek araca düşülse bile izler pedlerin ALTINDA kalır. */
  const pedTex = new THREE.CanvasTexture(pedIziDokusu(256));
  pedTex.colorSpace = THREE.SRGBColorSpace;
  pedTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const pedMat = new THREE.MeshStandardMaterial({
    map: pedTex, transparent: true, opacity: 0, depthWrite: false,
    roughness: .98, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
  });
  const pedGrup = new THREE.Group();
  {
    const suTemas = 0.09;                          // aracOlcek(0) — temasta gerçek boyut
    // İz yarıçapı ped yarıçapının ~3,6 katı: gerçek ped izinde bozulan alan
    // pedin kendisinden belirgin geniştir (dışa itilen ince toz yakası).
    const rPed = AYAK_YANAL * suTemas, yari = 0.115 * suTemas * 3.6;
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + k * Math.PI / 2;
      const x = -Math.sin(a) * rPed, z = Math.cos(a) * rPed;
      const g = new THREE.PlaneGeometry(yari * 2, yari * 2, 6, 6);
      g.rotateX(-Math.PI / 2);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++)
        p.setY(i, araziYukseklik(p.getX(i) + x, p.getZ(i) + z) + ZEMIN_UST * .75);
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, pedMat);
      m.position.set(x, 0, z);
      m.renderOrder = 3;
      m.receiveShadow = true;
      pedGrup.add(m);
    }
  }
  pedGrup.visible = false;
  sahne.add(pedGrup);

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

  olc('fx');
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
      out.goz.set(YUZEY_KAM.x, 0.034, YUZEY_KAM.z);
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
  /* Gölge kutusunun teksel ızgarasına yuvarlanması için ışık uzayı tabanı
     (three'nin lookAt kuralı: z = göz−hedef, x = up × z, y = z × x). */
  const YUKARI = new THREE.Vector3(0, 1, 0);
  const gIsikX = new THREE.Vector3(), gIsikY = new THREE.Vector3();
  const golgeHedef = new THREE.Vector3();

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

    /* POZLAMA RAMPASI — tek sahne, iki ışık dünyası. Alçak güneşte (11°) düz
       zeminin geliş açısı sin 11° = 0,19'dur; yörünge irtifasından bakıldığında
       ise araç sahanın 450 km GÜNEŞ TARAFINDADIR: oradaki yerel güneş yüksekliği
       11° + menzil/R_ay ≈ 26–50°, yani sahne gerçekten 2–4 kat parlaktır. Yani
       iniş boyunca sahne KARARIR; kamera da gerçek çekimdeki gibi açılır. İrtifa
       bu yerel güneş yüksekliğinin (menzille birebir bağlı) vekilidir. Rampa
       süreklidir (eşik yok) ve yalnız s.y'nin fonksiyonudur — scrub güvenli. */
    /* Katsayılar güneş elevasyonu 15,2°'den GERÇEK 11°'ye indirilince yeniden
       ölçülerek ayarlandı: düz zeminin geliş açısı sin15,2° = 0,262'den
       sin11° = 0,191'e düşüyor (%27 daha az doğrudan ışık), ölçülen yüzey
       parlaklığı 93,7'den 79,0'a iniyordu. 0,30/1,32 → 0,34/1,51. */
    renderer.toneMappingExposure = 0.34 + 1.51 * (1 - purussuz(150, 5000, s.y));

    // Toz
    tozGuncelle(s.t);

    /* Yer izleri — sim-zamanının sürekli fonksiyonu (eşik yok, sıfırdan rampa):
       süpürme izi 25 m'de açılır ve temasta kalıcılaşır; ped izleri oturmayla
       birlikte belirir. Vakumda süpürülen toz geri oturmaz — iz kalıcıdır. */
    const izGuc = purussuz(tozBaslangic, (olaylar.temasSim ?? tozBaslangic) + .01, s.t);
    supurmeMat.opacity = izGuc * .78;
    supurme.visible = izGuc > .01;
    const pedGuc = s.temas ? purussuz(0, 1.1, s.oynat - olaylar.temasOynat) : 0;
    pedMat.opacity = pedGuc * .70;   // bozulan alan okunsun ama "delik" gibi durmasın
    pedGrup.visible = pedGuc > .01;

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

    /* ---- GÖLGE KUTUSU: sahne ölçeğine göre DİNAMİK, teksel ızgarasına kilitli
       Eski kurulum ölçüldü ve iki ayrı nedenle temas planında gölgeyi YOK
       ediyordu (kanıt: baz-temas.png):
         · kutu yarısı 2,5 birim (=250 m) sabit tabanlıydı → 2048 haritada
           24,4 cm/teksel; 9 m'lik araç yalnız 37 teksel, üstüne radius=6 PCF
           bulanıklığı (≈1,5 m) → gölge silik bir lekeye iniyordu.
         · near=1, far=400 → derinlik aralığı 399 birim; bias=-0,0004 bunun
           DÜNYA karşılığı olarak 15,96 m'ye denk geliyordu. Araç gövdesi
           zeminden ancak 7 m yukarıdaydı; 11° güneşte gölge derinlik farkı
           h/sin11° = 5,24·h, yani 37 m tepede ama pedlerin dibinde SIFIR.
           16 m'lik bias gölgenin köküyle birlikte tamamını yiyordu.
       Yeni kurulum: kutu araç ölçeğiyle büyür, GEOMETRİK bir kademe merdivenine
       yuvarlanır (teksel boyu kare içinde sabit kalsın → snapping anlamlı olsun),
       merkez ışık uzayında teksel ızgarasına yuvarlanır (gölge kenarı akmaz) ve
       bias/normalBias ölçülen teksel boyundan türetilir. */
    const gk = gunes.shadow.camera;
    const yerYuk = Math.max(0, aracPoz.y - araziYukseklik(xs, 0));   // zeminden yükseklik
    /* Taban 1,7 birim (=170 m): yüzey kamerası araçtan 101 m ötede duruyor,
       yani ön alandaki kayalar da kutunun içinde kalır (gölge düşürürler). */
    const gerek = Math.max(1.7, su * 3.4);
    const KADEME = 1.25;                                    // geometrik merdiven
    const yarim = 1.7 * Math.pow(KADEME, Math.max(0, Math.ceil(Math.log(gerek / 1.7) / Math.log(KADEME))));
    const teksel = 2 * yarim / gunes.shadow.mapSize.x;
    /* Alçak güneşte (11°) yerdeki gölge, ışık uzayında aracın TAM ALTINDADIR
       (yalnız derinlikte 5,24·h kadar geridedir) — bu yüzden kutuyu araca
       ortalamak gölgenin tamamını kapsamak için yeterli; derinlik aralığını
       irtifayla açmak gerekir. */
    /* Derinlik aralığı ASİMETRİKTİR. Araç, kutunun derinlik ekseninde D'de
       durur; ışığa DOĞRU yalnız kendi boyu kadar yer gerekir, ama ARKADA
       yerdeki gölgeye kadar h/sin(11°) = 5,24·h uzanmak gerekir. (Bir tur
       burada kaybedildi: fazla derinlik `near` tarafına verilince 297 m'de
       zemin `far`ın ötesinde kalıyor ve takip kamerasında gölge yok oluyordu
       — kanıt golge-t4-chase.png.) */
    const arkaDerinlik = yerYuk / gunesYon.y + 3.5 * yarim + 1;
    const D = 2 * yarim + 1;
    golgeHedef.copy(aracPoz);
    // Teksel ızgarasına yuvarla: ışık uzayının iki yanal ekseninde
    gIsikX.crossVectors(YUKARI, gunesYon).normalize();
    gIsikY.crossVectors(gunesYon, gIsikX);
    golgeHedef.addScaledVector(gIsikX, Math.round(golgeHedef.dot(gIsikX) / teksel) * teksel - golgeHedef.dot(gIsikX));
    golgeHedef.addScaledVector(gIsikY, Math.round(golgeHedef.dot(gIsikY) / teksel) * teksel - golgeHedef.dot(gIsikY));
    gk.left = -yarim; gk.right = yarim; gk.top = yarim; gk.bottom = -yarim;
    gk.near = D - 1.6 * yarim;          // = 0,4·yarım + 1 > 0
    gk.far = D + arkaDerinlik;
    /* Ortografik derinlik DOĞRUSALDIR: bias'ın dünya karşılığı = bias·(far−near).
       Akne'yi normalBias (dünya birimi, normal boyunca) taşır; bias yalnız
       küçük bir emniyet payıdır — böylece peter-panning teksel mertebesinde
       kalır ve pedler ile gölgenin kökü BİRLEŞİK okunur. */
    gunes.shadow.normalBias = 1.6 * teksel;
    gunes.shadow.bias = -0.35 * teksel / (gk.far - gk.near);
    gunes.position.copy(golgeHedef).addScaledVector(gunesYon, D);
    gunes.target.position.copy(golgeHedef);
    gk.updateProjectionMatrix();

    /* Temas karartması: aracın gövdesi altındaki ortam örtüşmesi (AO). Kayaların
       "etek izi" diliyle aynı — araç zemine YAPIŞTIRILMIŞ değil OTURMUŞ okunur.
       Yerden yüksekliğe göre sürekli söner (eşik yok): 30 m'de görünmez,
       temasta tam güçte ve pedlerin altında yoğunlaşır. */
    const aoGuc = 1 - purussuz(0, 30, s.y);      // son 30 m'de sürekli açılır
    aoMat.opacity = 0.86 * aoGuc;
    aoDecal.visible = aoGuc > 0.01;
    if (aoDecal.visible) {
      aoDecal.position.set(xs, araziYukseklik(xs, 0) + ZEMIN_UST * 0.35, 0);
      aoDecal.scale.setScalar(su / 0.09);
    }

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
  const fxAgizDunya = V();        // motor ağzı dünya konumu (kare başına yeniden kullanılır)
  let oynatiliyor = false;
  let aktif = options.active !== false;
  let oynatZaman = 0;
  let rafId = 0;
  let sonSaat = 0;

  const cizVeGuncelle = gercekDt => {
    durumUygula(model.durum(oynatZaman));
    if (motorFX) {
      /* Zemin etkisi İRTİFAYA bağlıdır, sabit değil. zeminMesafe verilmezse
         craft-effects 'hover' plüm ucunu çarpma düzlemi sayar ve duvar jetini
         HER irtifada tam güçte çalıştırır — araç 15 km'de bile zemin süpürüyor
         gibi görünüyordu. Gerçek mesafeyi ölçüp veriyoruz: motor ağzının dünya
         yüksekliği eksi o noktadaki arazi yüksekliği, aracın kendi ölçeğine
         bölünerek FX'in YEREL birimine çevrilir (FX group aracSargi'nın
         çocuğudur ve aracSargi irtifayla ölçeklenir). Böylece jet ve kabarma
         yalnız yere yaklaşınca açılır, temasta tam güce çıkar. */
      const agizD = motorFX.group.getWorldPosition(fxAgizDunya);
      const yerelOlcek = Math.max(1e-4, aracSargi.scale.x);
      const zeminMesafe = Math.max(0, agizD.y - araziYukseklik(agizD.x, agizD.z)) / yerelOlcek;
      motorFX.update(gercekDt, {
        gaz: sonDurum.gaz,
        atesle: !sonDurum.temas && sonDurum.gaz > 0.002,
        zeminMesafe,
      });
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
    /* Hata avı kancası (sözleşme §6: ölçülür, tahmin edilmez). Gölge kutusu,
       bias'ın DÜNYA karşılığı ve tap frekansları buradan okunup ölçülür. */
    hataAyikla: { sahne, kamera, renderer, gunes, aracSargi, kayaGrup, zeminUnif, kayaUnif },
    toplamOynat: model.toplamOynat,
    aracKaynak,
    get oynatZamani() { return oynatZaman; },
    get oynuyor() { return oynatiliyor; },
    get faz() { return sonDurum.temas ? 'temas' : sonDurum.faz; },
  };

  /* Katman kapatma anahtarları (sözleşme §6: hata avı için) —
     ?kapat=arac,iz,toz,zemin,yakin,plum,dunya,kaya,iziz,ao,golge */
  {
    const kapat = new URLSearchParams(location.search).get('kapat');
    if (kapat) {
      const k = new Set(kapat.split(','));
      if (k.has('arac')) sahne.remove(aracSargi);
      if (k.has('iz')) sahne.remove(iz);
      if (k.has('toz')) sahne.remove(toz);
      if (k.has('zemin')) sahne.remove(araziZemin);
      if (k.has('yakin')) zeminUnif.uDetayGuc.value = 0; // çok ölçekli detay katmanı kapalı
      if (k.has('kaya')) sahne.remove(kayaGrup);
      if (k.has('iziz')) { sahne.remove(supurme); sahne.remove(pedGrup); }
      if (k.has('ao')) sahne.remove(aoDecal);           // temas karartması
      if (k.has('golge')) renderer.shadowMap.enabled = false;
      if (k.has('plum')) {
        plumGrup.removeFromParent(); sahne.remove(plumIsik);
        if (motorFX) motorFX.group.removeFromParent();
      }
    }
  }

  /* Kaynak raporu (doğrulama sözleşmesi §6: ölçülür, tahmin edilmez) */
  console.info(
    `[lunar-descent] tepe bütçesi: arazi ${tepeSay.toLocaleString('en')} + kaya ${kayaTepe.toLocaleString('en')} ` +
    `(${kayaSay} blok) + yıldız 1700 ≈ ${(tepeSay + kayaTepe + 1700).toLocaleString('en')} | ` +
    `doku: detay 2×512² + bölge 2048² + plum izi 1024² + ped 256² + etek 128² ≈ ` +
    `${(((2 * 512 * 512 + 2048 * 2048 + 1024 * 1024 + 256 * 256 + 128 * 128) * 4 * 1.34) / 1048576).toFixed(1)} MB (mip dahil) | ` +
    `anizotropi ${renderer.capabilities.getMaxAnisotropy()}× | kurulum ${(performance.now() - kurulusT0).toFixed(0)} ms ` +
    `(${Object.entries(zaman).map(([k, v]) => `${k} ${v}`).join(' · ')})`
  );

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
