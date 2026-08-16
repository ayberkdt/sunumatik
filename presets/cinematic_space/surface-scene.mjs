/* surface-scene.mjs — Ay yüzeyi vista sahnesi (plan §11, R2 yedek yolu).

   NEDEN TÜRETME, NEDEN KOPYA DEĞİL: lunar_descent'in arazisi 115 KB'lık
   kanıtlanmış dosyada renderer'a ve iki doku ressamına bağlı ~500 satırlık
   bir kapanış alt-grafiğidir; sökmek, "çalışan geometriyi toplu yeniden
   yazma" hatasının ta kendisi olurdu (eksen dersi). Bu modül aynı YAYIMLANMIŞ
   REÇETEYİ kompakt biçimde uygular ve farkını manifest'te bildirir:

     · küresel sagitta (gerçek Ay yarıçapı 1737,4 km; 1 birim = 100 m)
     · güç yasalı krater alanı: çukur çanak + yükseltilmiş kenar + s⁻² ejecta
     · 3 oktav değer-gürültüsü fBm regolit dalgalanması
     · ufuk siluetini kıran mare sırtları (vista ufkuna nişanlı)
     · lunar_descent'in ÇÖZÜMLEMEDİĞİ şey burada da yok: dört-tap detay
       shader'ı ve bölge albedosu onların premium katmanı — bizde tek
       tekrar dokulu StandardMaterial (aesthetic_moon_real, 9× tekrar).

   Vista sözleşmesi: gezgin orijinde, arazi orada temiz; kamera alçak
   üç-çeyrek belgesel planı — gezgin ön planda sol-altta, ufuk üst üçte-bir
   hattında. Sahne fonu ŞEFFAF: yıldızlar cosmos DOM katmanından gelir
   (dış sahneyle AYNI gök — süreklilik). */

import * as THREE from 'three';
import { cylX, cylY, cylZ } from '../core/geometry-axis.mjs';

const R_AY_BIRIM = 17374;            // gerçek Ay yarıçapı, 100 m biriminde
const kirp = (v, a, b) => Math.min(b, Math.max(a, v));
const purussuz = (a, b, v) => { const t = kirp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function buildSurfaceScene({ seed = 20260816, assetBaseUrl } = {}) {
  const scene = new THREE.Scene();     // fon şeffaf: gök DOM katmanından

  /* --- deterministik değer gürültüsü (lunar_descent reçetesi) --- */
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
    const c = izgaraHash(ix, iz + 1), d = izgaraHash(ix + 1, iz + 1);
    const ab = a + (b - a) * sx;
    return ab + ((c + (d - c) * sx) - ab) * sz;
  };

  /* --- krater alanı: güç yasalı boylar; vista çevresi (±3 birim) temiz --- */
  const kraterler = [];
  {
    const rnd = mulberry32(seed ^ 0x7E44A1);
    const halka = (r0, r1, R0, R1, adet) => {
      for (let i = 0; i < adet; i++) {
        const R = R0 + (R1 - R0) * Math.pow(rnd(), 2.6);
        const t = rnd() * Math.PI * 2;
        const rr = Math.sqrt(r0 * r0 + rnd() * (r1 * r1 - r0 * r0));
        const x = Math.cos(t) * rr, z = Math.sin(t) * rr;
        if (Math.hypot(x, z) < 3 + R * 1.6) continue;   // vista temiz
        const taze = 0.35 + rnd() * 0.65;
        const d = R * (0.13 + 0.17 * taze);
        kraterler.push({ x, z, R, d, rim: d * (0.22 + 0.22 * taze), us: 2 + Math.min(2, R / 12) });
      }
    };
    halka(3, 30, 0.25, 2.2, 90);       // yakın alan: gezgin planının kraterleri
    halka(20, 220, 1.2, 14, 110);
    halka(180, 1400, 6, 60, 90);
    halka(1200, 4800, 20, 200, 60);    // ufuk havzaları
  }
  const HUCRE = 60, izgara = new Map();
  for (const k of kraterler) {
    const yay = k.R * 2.8;
    for (let ix = Math.floor((k.x - yay) / HUCRE); ix <= Math.floor((k.x + yay) / HUCRE); ix++)
      for (let iz = Math.floor((k.z - yay) / HUCRE); iz <= Math.floor((k.z + yay) / HUCRE); iz++) {
        const key = ix * 100003 + iz;
        let liste = izgara.get(key);
        if (!liste) izgara.set(key, liste = []);
        liste.push(k);
      }
  }
  const kraterKatki = (x, z) => {
    const liste = izgara.get(Math.floor(x / HUCRE) * 100003 + Math.floor(z / HUCRE));
    if (!liste) return 0;
    let h = 0;
    for (const k of liste) {
      const s = Math.hypot(x - k.x, z - k.z) / k.R;
      if (s >= 2.8) continue;
      if (s < 1) h += -k.d + (k.d + k.rim) * Math.pow(s, k.us);
      else h += k.rim * (1 - purussuz(1.7, 2.8, s)) / (s * s);
    }
    return h;
  };

  /* --- mare sırtları: vista ufkuna nişanlı (belgesel silueti) --- */
  const sirtlar = [];
  {
    const rnd = mulberry32(seed ^ 0x51D7);
    const ekle = (az, rd) => {
      const yon = az + Math.PI / 2 + (rnd() - .5) * .8;
      sirtlar.push({
        cx: Math.cos(az) * rd, cz: Math.sin(az) * rd,
        ux: Math.cos(yon), uz: Math.sin(yon),
        L: kirp(rd * .9, 60, 1200), w: 6 + rd * .02,
        H: kirp(.028 * rd, .9, 9) * (.7 + .6 * rnd()), faz: rnd() * Math.PI * 2,
      });
    };
    ekle(-.35, 90 + rnd() * 60);       // vista bakış ufku (−z yönü civarı)
    ekle(.25, 170 + rnd() * 80);
    for (let i = 0; i < 5; i++) ekle(rnd() * Math.PI * 2, 60 + rnd() * 1400);
  }
  const sirtKatki = (x, z) => {
    let h = 0;
    for (const s of sirtlar) {
      const dx = x - s.cx, dz = z - s.cz;
      const boyunca = dx * s.ux + dz * s.uz;
      const yarim = s.L * .55;
      if (Math.abs(boyunca) > yarim) continue;
      const dik = -dx * s.uz + dz * s.ux + Math.sin(boyunca * .018 + s.faz) * s.w * .7;
      const zarf = 1 - (boyunca / yarim) ** 2;
      h += s.H * zarf * Math.exp(-(dik * dik) / (s.w * s.w));
    }
    return h;
  };

  /* --- SAHA KRATERLERİ (lunar_descent dersi): yakın planın "düz plaka"
     okunmasının asıl sebebi 40 m çevresinin kratersiz kalmasıydı. 90 küçük
     krater (1–9 m yarıçap) vista'nın 4–45 m bandında; gezgin pedi (3,5 m)
     ve kamera ayak noktası temiz. --- */
  const sahaKraterleri = [];
  {
    const rnd = mulberry32(seed ^ 0x5A4A17);
    for (let i = 0; i < 90; i++) {
      const R = .01 + Math.pow(rnd(), 2.1) * .08;        // 1–9 m
      const t = rnd() * Math.PI * 2;
      const rr = .04 + Math.sqrt(rnd()) * .41;           // 4–45 m
      const x = Math.cos(t) * rr, z = Math.sin(t) * rr;
      if (Math.hypot(x, z) < .035 + R * 1.4) continue;   // ped temiz
      if (Math.hypot(x - .085, z - .11) < .012) continue; // kamera ayak noktası
      const taze = .3 + rnd() * .7;
      const dk = R * (.11 + .1 * taze);
      sahaKraterleri.push({ x, z, R, d: dk, rim: dk * (.2 + .24 * taze) });
    }
  }
  const sahaKatki = (x, z) => {
    let h = 0;
    for (const k of sahaKraterleri) {
      const s = Math.hypot(x - k.x, z - k.z) / k.R;
      if (s >= 2.4) continue;
      if (s < 1) h += -k.d + (k.d + k.rim) * Math.pow(s, 2.2);
      else h += k.rim * (1 - purussuz(1.5, 2.4, s)) / (s * s);
    }
    return h;
  };

  /* --- paylaşılan yükseklik alanı: sagitta + katkılar; ped düzlenir ama
     saha kraterleri ve mikro-kabartma KAPI DIŞIDIR (lunar_descent deseni) --- */
  const araziYukseklik = (x, z) => {
    const d2 = x * x + z * z, d = Math.sqrt(d2);
    const kure = -d2 / (2 * R_AY_BIRIM);
    const temizlik = purussuz(2.2, 6, d);   // BÜYÜK biçimler için sakinlik; küçükler yaşar
    const kaba = kraterKatki(x, z) + sirtKatki(x, z)
      + (deger2(x / 520, z / 520) - .5) * 4.6
      + (deger2(x / 120 + 37.2, z / 120 - 11.8) - .5) * 1.4
      + (deger2(x / 26 - 8.5, z / 26 + 21.3) - .5) * .4;
    /* yakın alan: saha kraterleri + iki bantlı mikro-kabartma (30–80 cm
       dalga boyu, ±3–4 cm) — "anlamsız düz plaka"nın panzehiri */
    const yakinAlan = d < .5 ? (
        sahaKatki(x, z)
      + (deger2(x / .6 + 12.7, z / .6 - 5.3) - .5) * .028 * purussuz(.045, .3, d)
      + (deger2(x / .22 - 3.1, z / .22 + 8.9) - .5) * .011 * purussuz(.03, .18, d)
    ) : (d < .9 ? sahaKatki(x, z) : 0);
    return kure + temizlik * kaba + yakinAlan;
  };

  /* --- örgü: kutupsal ızgara (merkez sık, ufka geometrik seyrelme) --- */
  /* merkez çözünürlüğü saha kraterlerini ÇÖZER: ilk halka 2 m'de, oran
     1.025 — 10 m yarıçapta segment ~20 cm (1 m'lik krater 5 segment).
     DIŞ YARIÇAP 3 600 KM: 320 m irtifadan ufuk 33 km'dedir; örgü 5,2 km'de
     bitince ufkun ALTINDA Samanyolu şeridi açığa çıkıyordu (kullanıcı:
     "dümdüz Samanyolu" — kök neden buydu). Geometrik halkalarda bu
     genişletme yalnız ~+25 halkadır, bütçe değişmez. */
  const ACISAL = 320;
  const yaricaplar = [];
  for (let r = .02; r < 36000; r *= 1.025) yaricaplar.push(r);
  yaricaplar.push(36000);
  const halkaSay = yaricaplar.length;
  const tepeSay = halkaSay * ACISAL + 1;
  const poz = new Float32Array(tepeSay * 3);
  const uv = new Float32Array(tepeSay * 2);
  poz[1] = araziYukseklik(0, 0);
  uv[0] = .5; uv[1] = .5;
  {
    let v = 1;
    for (const r of yaricaplar) for (let j = 0; j < ACISAL; j++, v++) {
      const t = j / ACISAL * Math.PI * 2;
      const x = Math.cos(t) * r, z = Math.sin(t) * r;
      poz[v * 3] = x; poz[v * 3 + 1] = araziYukseklik(x, z); poz[v * 3 + 2] = z;
      uv[v * 2] = x / 10000 + .5; uv[v * 2 + 1] = .5 - z / 10000;
    }
  }
  const idx = new Uint32Array((ACISAL + (halkaSay - 1) * ACISAL * 2) * 3);
  {
    let n = 0;
    for (let j = 0; j < ACISAL; j++) { idx[n++] = 0; idx[n++] = 1 + (j + 1) % ACISAL; idx[n++] = 1 + j; }
    for (let i = 0; i < halkaSay - 1; i++) {
      const bi = 1 + i * ACISAL, bo = bi + ACISAL;
      for (let j = 0; j < ACISAL; j++) {
        const j1 = (j + 1) % ACISAL;
        idx[n++] = bi + j; idx[n++] = bo + j1; idx[n++] = bo + j;
        idx[n++] = bi + j; idx[n++] = bi + j1; idx[n++] = bo + j1;
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(poz, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();          // alçak güneş kraterleri bu normallerle okutur

  /* --- doku: Lunaris albedosu geniş ölçekte (geometriyle hizalı, 9×) +
     yükseklik dokusundan YAKIN ALAN bump'ı (220×): renk tekrarı görünmeden
     ışık tepkisi detayı — lunar_descent'in dört-tap merdiveninin tek
     katmanlı, dürüstçe basit karşılığı --- */
  const base = assetBaseUrl || '../moon_react_source/public/lunaris';
  let albedo = null, bump = null;
  try {
    const loader = new THREE.TextureLoader();
    [albedo, bump] = await Promise.all([
      loader.loadAsync(`${base}/textures/aesthetic_moon_real.webp`),
      loader.loadAsync(`${base}/textures/moon_disp_real.webp`),
    ]);
    albedo.colorSpace = THREE.SRGBColorSpace;
    albedo.wrapS = albedo.wrapT = THREE.RepeatWrapping;
    albedo.repeat.set(9, 9);
    albedo.anisotropy = 8;
    bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
    bump.repeat.set(220, 220);
    bump.anisotropy = 8;
  } catch { /* çevrimdışı: düz renk yeter */ }
  /* REGOLİT LAMBERTIAN'DIR: Standard'ın GGX'i sıyırma açısında fiziksel
     olarak yersiz bir speküler bant basıyordu (kullanıcı: "güneş yansıması
     alakasız" — haklı). Lambert speküleri tamamen keser; kabartma bump'la,
     biçim vertex normalleriyle okunur. Ton GRİ: Ay toprağı kahve değildir;
     gri ton, dalış teslimindeki küre dokusuyla da renk sıçramasını yok eder. */
  const terrain = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
    map: albedo, color: albedo ? 0xbdb9b3 : 0x8f8a82,
    bumpMap: bump, bumpScale: .045,
  }));
  terrain.receiveShadow = true;
  scene.add(terrain);

  /* --- KAYALAR (kullanıcı: zemin amatör): ölçeği satan şey kayalardır.
     lunar_descent'in dersi: yakın plan kayasız kalırsa zemin "düz PNG"
     okunur. Tohumlu 46 blok: bozulmuş ikosahedron, yassıltılmış, yarı
     gömülü; gezgin pediyle kamera yolu temiz tutulur. Bir FON KAYASI
     kadraj sol-altına yakın konur (ön plan örtmesi, plan §26). --- */
  {
    const rnd = mulberry32(seed ^ 0x4A7A11);
    /* kaya tonu regolitten YALNIZ BİRAZ açık; Lambert (speküler yok) */
    const kayaMat = new THREE.MeshLambertMaterial({ color: 0x7d7970 });
    const kayaKoy = (x, z, boy) => {
      const g2 = new THREE.IcosahedronGeometry(boy, 1);
      const pozlar = g2.getAttribute('position');
      for (let i = 0; i < pozlar.count; i++) {
        const j = 1 + (rnd() - .5) * .55;
        pozlar.setXYZ(i, pozlar.getX(i) * j, pozlar.getY(i) * j * .62, pozlar.getZ(i) * j);
      }
      g2.computeVertexNormals();
      const kaya = new THREE.Mesh(g2, kayaMat);
      kaya.castShadow = true; kaya.receiveShadow = true;
      kaya.position.set(x, araziYukseklik(x, z) + boy * .22, z);   // yarı gömülü
      kaya.rotation.y = rnd() * Math.PI * 2;
      scene.add(kaya);
    };
    for (let i = 0; i < 46; i++) {
      const t = rnd() * Math.PI * 2;
      const d = .35 + Math.pow(rnd(), 1.6) * 24;                    // 35 m – 2,4 km
      const x = Math.cos(t) * d, z = Math.sin(t) * d;
      if (Math.hypot(x, z) < .28) continue;                         // gezgin pedi temiz
      kayaKoy(x, z, .004 + Math.pow(rnd(), 2.2) * .05);             // 40 cm – 5,4 m
    }
    /* Ön plan kayası KALDIRILDI: kamera–gezgin hattına konan blok, bu
       kadrajda gezginin tekerlek dibine düşüyordu (ölçüldü). */
    kayaKoy(-.5, -.9, .028);        // orta plan blok
    kayaKoy(-.35, -.55, .016);      // gezgin arkası siluet kayası

    /* ÇAKIL SERPİNTİSİ: 160 küçük taş (5–22 cm), vista'nın 1,5–40 m bandı —
       yakın plan ölçeğini asıl satan katman. Tek InstancedMesh: bir çizim. */
    const cakilGeo = new THREE.IcosahedronGeometry(1, 0);
    const cakil = new THREE.InstancedMesh(cakilGeo, kayaMat, 160);
    const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e3 = new THREE.Euler();
    let ci = 0;
    for (let i = 0; i < 400 && ci < 160; i++) {
      const t = rnd() * Math.PI * 2;
      const dd = .015 + Math.sqrt(rnd()) * .385;         // 1,5–40 m
      const x = Math.cos(t) * dd, z = Math.sin(t) * dd;
      if (Math.hypot(x, z) < .026) continue;             // gezgin pedi
      if (Math.hypot(x - .085, z - .11) < .02) continue; // kamera dibi
      const boy = .0005 + Math.pow(rnd(), 1.7) * .0017;  // 5–22 cm
      q4.setFromEuler(e3.set(rnd() * 3, rnd() * 6.28, rnd() * 3));
      m4.compose(
        new THREE.Vector3(x, araziYukseklik(x, z) + boy * .35, z),
        q4,
        new THREE.Vector3(boy * (0.8 + rnd() * .5), boy * .6, boy * (0.8 + rnd() * .5)));
      cakil.setMatrixAt(ci++, m4);
    }
    cakil.count = ci;
    cakil.receiveShadow = true;
    scene.add(cakil);
  }

  /* --- ışık: alçak Güneş + zayıf gök dolgusu (Apollo bandı).
     Azimut, KAMERANIN GÖRDÜĞÜ yanağı aydınlatacak biçimde seçilir:
     kamera +x,+z'den bakar → görünen yüz +x,+z tarafıdır → Güneş
     kameranın arka-sağ omzundan gelir; uzun gölge ufka doğru, KADRAJIN
     İÇİNE uzar. (İlk deneme Güneş'i karşı yakaya koydu, gezgin kömür
     silueti çıktı — ölçüldü.) */
  const sun = new THREE.DirectionalLight('#fff2dc', 2.6);
  /* 14° irtifa: 9°'de zemin sin(9°)≈0,16 ile kömür karanlığındaydı
     (ölçüldü); 14° hâlâ "alçak güneş + uzun gölge" dilindedir ama
     regoliti okutur. */
  sun.position.set(26, Math.tan(14 * Math.PI / 180) * 39, 31);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  /* gölge frustumu SIKI: yalnız gezgin çevresi (±40 m) → ~4 cm/texel;
     arazinin kendi gölgesini normaller anlatır, harita gezgine harcanır */
  sun.shadow.camera.near = 36; sun.shadow.camera.far = 46;
  sun.shadow.camera.left = -.4; sun.shadow.camera.right = .4;
  sun.shadow.camera.top = .4; sun.shadow.camera.bottom = -.4;
  sun.target.position.set(0, 0, 0);
  scene.add(sun, sun.target);
  scene.add(new THREE.AmbientLight('#8d95a8', .3));       // yıldız/dünya-ışığı dolgusu
  /* vista dolgusu: kamera yanından çok kısık sıcak ışık — gezginin görünen
     yüzü kömürleşmesin (belgesel reflektörünün kısık hâli) */
  const dolgu = new THREE.PointLight('#ffe8cc', 1.1, 2.2);
  dolgu.position.set(.22, .08, .28);
  scene.add(dolgu);

  /* --- gezgin: craft-blocks buildRover — ölçek DÜRÜSTÇE bildirilir --- */
  const fenerMat = new THREE.MeshStandardMaterial({
    color: 0x10151d, roughness: .4, metalness: .3,
    emissive: new THREE.Color(0xc9a35c), emissiveIntensity: .3,
  });
  const farMat = new THREE.MeshStandardMaterial({
    color: 0x1a1e26, roughness: .2, metalness: .4,
    emissive: new THREE.Color(0xfff3d8), emissiveIntensity: 0,
  });
  const farlar = [];
  const kafa = new THREE.Group();                        // direk tepesi pan-tilt
  let rover;
  try {
    const cb = await import('../craft_blocks/craft-blocks.mjs');
    rover = cb.buildRover({ scale: .045, arm: true });    // 4,5 m — hafif sinematik abartı (gerçek ~3 m)
  } catch {
    console.warn('craft_blocks yüklenemedi; yer tutucu gezgin.');
    rover = new THREE.Group();
    const kutu = new THREE.Mesh(new THREE.BoxGeometry(.04, .02, .03),
      new THREE.MeshStandardMaterial({ color: 0x23252c, roughness: .6, metalness: .3 }));
    kutu.position.y = .012;
    rover.add(kutu);
  }
  /* ---- GEZGİN DETAY + İNTERAKTİVİTE KATMANI (kullanıcı: "kutu gibi") ----
     finalize() İÇ grubu ölçekler; detaylar İÇ gruba TASARIM koordinatlarında
     eklenir (kasa .86×.44×.26, direk (.28,0,.42), kafa (.30,0,.66) — kaynak
     craft-blocks'tan okundu). Böylece her parça hassas oturur, fork yok. */
  const ic = rover.children[0] ?? rover;
  const dMat = {
    govde: new THREE.MeshStandardMaterial({ color: 0x23252c, roughness: .55, metalness: .35 }),
    panel: new THREE.MeshStandardMaterial({ color: 0x10151d, roughness: .38, metalness: .55 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x9aa0ab, roughness: .3, metalness: .85 }),
    altin: new THREE.MeshStandardMaterial({ color: 0xc9a35c, roughness: .3, metalness: .8 }),
    beyazDis: new THREE.MeshStandardMaterial({ color: 0xd8d5cc, roughness: .5, metalness: .2, side: THREE.DoubleSide }),
  };
  const dbox = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  {
    /* HGA çanağı: güvertede arka-solda, göğe eğik yarım küre + besleme */
    const canak = new THREE.Mesh(new THREE.SphereGeometry(.13, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2.6), dMat.beyazDis);
    canak.rotation.x = Math.PI;                          // kâse yukarı bakar
    canak.scale.z = .55;
    const hga = new THREE.Group();
    hga.add(canak);
    const besleme = cylZ(.008, .008, .12, 8, dMat.metal); besleme.position.z = .07; hga.add(besleme);
    const hgaKol = cylZ(.02, .024, .1, 10, dMat.metal); hgaKol.position.z = -.08; hga.add(hgaKol);
    hga.position.set(-.32, .12, .33);
    hga.rotation.set(.4, .2, 0);
    ic.add(hga);

    /* yan dolaplar (batarya/elektronik) + kablo kanalları */
    for (const s of [1, -1]) {
      const dolap = dbox(.34, .05, .16, dMat.panel);
      dolap.position.set(.02, s * .25, .05);
      ic.add(dolap);
    }
    for (let i = 0; i < 3; i++) {
      const kablo = cylX(.008, .008, .5, 6, dMat.govde);
      kablo.position.set(-.1, -.14 + i * .05, .18);
      ic.add(kablo);
    }
    /* tekerlek göbek kapakları */
    const gobekler = [[.44, .365], [-.07, .365], [-.44, .365], [.44, -.365], [-.07, -.365], [-.44, -.365]];
    for (const [gx, gy] of gobekler) {
      const kapak = cylY(.045, .045, .015, 12, dMat.altin);
      kapak.position.set(gx, gy, -.30);
      ic.add(kapak);
    }
    /* ön tampon + FARLAR (interaktif): iki lens + iki spot */
    const tampon = cylY(.015, .015, .5, 8, dMat.metal);
    tampon.position.set(.46, 0, -.02);
    ic.add(tampon);
    for (const s of [1, -1]) {
      const lens = cylX(.03, .034, .02, 12, farMat);
      lens.position.set(.45, s * .14, .02);
      ic.add(lens);
      const far = new THREE.SpotLight('#fff3d8', 0, .28, .32, .65);
      far.position.set(.45, s * .14, .02);
      const hedef = new THREE.Object3D(); hedef.position.set(1.6, s * .3, -.5);
      ic.add(hedef); far.target = hedef;
      ic.add(far);
      farlar.push(far);
    }
    /* arka kamçı anten + durum feneri (güvertede, DOĞRU yerde) */
    const kamci = cylZ(.006, .006, .5, 6, dMat.metal);
    kamci.position.set(-.4, -.16, .45);
    ic.add(kamci);
    const fener = new THREE.Mesh(new THREE.SphereGeometry(.024, 10, 8), fenerMat);
    fener.position.set(-.14, .16, .245);
    ic.add(fener);

    /* KAFA GRUBU: buildRover'ın kafa kutusu + lensler + maske, direk tepesinde
       DÖNDÜRÜLEBİLİR gruba alınır (konumdan eşleştirme — builder çocukları
       adsızdır; bulunamazsa tarama animasyonu sessizce devre dışı kalır) */
    const kafaParcalari = [];
    ic.traverse(o => {
      if (!o.isMesh) return;
      const p = o.position;
      if (Math.abs(p.z - .66) < .03 && Math.abs(p.x - .3) < .11) kafaParcalari.push(o);
    });
    if (kafaParcalari.length >= 2) {
      kafa.position.set(.30, 0, .63);
      for (const parca of kafaParcalari) {
        parca.position.sub(kafa.position);
        kafa.add(parca);
      }
      ic.add(kafa);
    }
  }
  rover.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  /* EKSEN SÖZLEŞMESİ ÇEVİRİSİ: craft blokları +X ileri / +Z yukarı kurar,
     sahnenin yukarısı +Y — çevirmeden gezgin YAN YATAR (ölçüldü: tekerlekler
     havada silindir dizisi olarak çıktı; eksen-denetimi dersinin konsumer
     tarafı). Pivot yalnız sahne-yaw'ı taşır; zemine oturma Box3 ile
     ÖLÇÜLEREK yapılır, elle tahminle değil. */
  const roverPivot = new THREE.Group();
  rover.rotation.x = -Math.PI / 2;                        // +Z(yukarı) → +Y
  roverPivot.add(rover);
  roverPivot.rotation.y = -.55;                           // üç-çeyrek siluet
  roverPivot.updateMatrixWorld(true);
  const kutu = new THREE.Box3().setFromObject(roverPivot);
  roverPivot.position.set(0, araziYukseklik(0, 0) - kutu.min.y + .0004, 0);
  scene.add(roverPivot);

  /* --- vista kamerası: alçak, gezgin sol-önde, ufuk üst üçte-birde --- */
  const vista = {
    pos: new THREE.Vector3(.085, araziYukseklik(.085, .11) + .017, .11),  // ~1,7 m göz
    look: new THREE.Vector3(-.01, araziYukseklik(0, 0) + .012, -.02),
    fov: 46,
  };

  /* interaktif durum: farlar + direk taraması (adım cinematic-space'ten sürülür) */
  const etkilesim = {
    farAcik: false,
    taramaAcik: true,
    setFarlar(v) {
      etkilesim.farAcik = Boolean(v);
      for (const far of farlar) far.intensity = etkilesim.farAcik ? 1.1 : 0;
      farMat.emissiveIntensity = etkilesim.farAcik ? 1.2 : 0;
    },
    setTarama(v) { etkilesim.taramaAcik = Boolean(v); },
    /** saf f(t): direk taraması + fener nabzı */
    guncelle(t) {
      fenerMat.emissiveIntensity = .28 + .3 * (0.5 + 0.5 * Math.sin(t * 1.5));
      if (kafa.children.length) {
        kafa.rotation.z = etkilesim.taramaAcik ? .5 * Math.sin(Math.PI * 2 * t / 26) : 0;
      }
    },
  };

  return { scene, terrain, rover, sun, araziYukseklik, vista, fenerMat, etkilesim, dispose() {
    geo.dispose();
    albedo?.dispose();
    scene.traverse(o => {
      if (o.geometry && o.geometry !== geo) o.geometry.dispose();
      for (const m of Array.isArray(o.material) ? o.material : (o.material ? [o.material] : [])) m.dispose();
    });
  } };
}
