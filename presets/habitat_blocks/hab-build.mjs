/* hab-build.mjs — habitat kataloğunu GÖVDEYE çevirir.
 *
 * sat-build.mjs ile aynı sözleşme: tek bir ölçü elle yazılmaz, her şey
 * katalogdaki `sekil`, `size`, `pos` alanlarından çıkar. Katalog
 * değişirse model de değişir; kütle bütçesiyle çizim ayrışamaz.
 *
 * Eksen sözleşmesi: çıplak CylinderGeometry/ConeGeometry yok —
 * `core/geometry-axis.mjs`. Saha koordinatı +Z yukarı.
 */

import { PARTS, SUBSYSTEMS, partById, envAllows, runEndpoints, canakGeo,
  PANEL_EGIM_DEG, YOLLAR, yolSeritleri, yolCukurlari, yolKoseleri,
  yolNoktalari, cukurRampaM, cukurAcikligiM, CUKUR_TABAN_M } from './hab-parts.mjs';
import { cylGeoZ, cylGeoY, cylGeoX, coneGeoZ, latheX } from '../core/geometry-axis.mjs';
import * as D from './hab-detail.mjs';
import { yuzeyAlbedoRGB } from '../core/scene-lighting.mjs';
import { planRun, buildRun } from './routing.mjs';

const TAU = Math.PI * 2;

export function habMaterials(THREE, tk = {}) {
  const std = (c, r, m, ek = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...ek });
  /* Ayrıntı kiti kendi malzeme ailesini getirir: korkuluk sarısı, conta
     siyahı, cam ve bakır üs boyunca AYNI olsun diye tek yerde kurulur. */
  /* Tokens are FORWARDED to the kit. They were not, so a scene that asked
     for lunar-grey regolith got the default brown and nothing said so. */
  const kit = D.detailMaterials(THREE, tk);
  return {
    kit,
    basincli: std(tk.basincli ?? 0xd8d4cc, .52, .28),
    /* Altın rengi bir TRİM rengidir. Bütün kilidi onunla boyadığımda
   modül pirinç bir fıçıya dönüşüyordu; gövde yapısal beyaza yakın
   durur, altın yalnız tutunma ve kumanda yüzeylerinde kalır. */
    gecis: std(tk.gecis ?? 0xcfc8bc, .55, .35),
    yapi: std(tk.yapi ?? 0x9aa0aa, .72, .38),
    guc: std(tk.guc ?? 0xe0b25a, .45, .35),
    isil: std(tk.isil ?? 0x8fa2b4, .38, .62),
    isru: std(tk.isru ?? 0x9ec98a, .5, .45),
    hat: std(tk.hat ?? 0x7fb0c9, .55, .6),
    iletisim: std(tk.iletisim ?? 0xb4a8c9, .42, .5),
    koyu: std(0x3a3f47, .8, .25),
    cam: std(0x2a3c4a, .15, .1, { transparent: true, opacity: .45 }),
    /* The one material whose colour is a MEASUREMENT: it is the surface
       albedo, and it differs by a factor of two between the Moon and Mars.
       It was hardcoded, so both bodies came out the same brown. */
    regolit: std(tk.regolit ?? 0x6b5a48, .96, .02),
  };
}

/* MLI/zar dikişi: yorgan görüntüsü prosedürel — doku dosyası ÇEKİLMEZ. */
function zarDokusu(THREE, renk = '#d8d4cc') {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = renk; g.fillRect(0, 0, 256, 256);
  /* MLI yorganı bir DOKUMA değil: ayırıcı dikişler tek yönde uzanır,
     enine olan yalnız katman ek yeridir. İlk sürümde iki yön de eşit
     koyuydu ve yüzey hasır gibi görünüyordu. */
  g.strokeStyle = 'rgba(78,71,62,.20)'; g.lineWidth = 2;
  for (let x = 0; x <= 256; x += 42) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
  g.strokeStyle = 'rgba(78,71,62,.07)'; g.lineWidth = 1;
  for (let y = 0; y <= 256; y += 22) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
  /* battaniyenin buruşukluğu: rastgele açık lekeler */
  g.fillStyle = 'rgba(255,255,255,.035)';
  for (let i = 0; i < 70; i++) g.fillRect((i * 61) % 256, (i * 97) % 256, 13, 6);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/* Güneş hücresi deseni. */
function hucreDokusu(THREE) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#17293b'; g.fillRect(0, 0, 256, 128);
  g.strokeStyle = 'rgba(185,205,232,.28)'; g.lineWidth = 1;
  for (let x = 0; x <= 256; x += 21) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 128); g.stroke(); }
  for (let y = 0; y <= 128; y += 21) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/**
 * Bir nesneyi DÜŞEY silindirin yüzeyine oturtur.
 *
 * Bunu bir yardımcıya çevirdim çünkü elle yaptığımda yanlış yaptım:
 * tutamakları (x = ±0,62 r, y = −0,98 r) diye koymuştum, yani yüzeyi
 * DÜZLEM sanmıştım. O noktada silindir yüzeyi y = −√(r² − x²) = −0,78 r
 * olduğu için tutamaklar gövdenin 23 cm dışında havada duruyordu.
 * Silindirde konum açıdan gelir, koordinattan değil.
 *
 * @param aci  0 = −Y yönü (ön yüz), saat yönünde artar
 * @param z    silindir ekseni boyunca yükseklik
 */
function silindireOturt(THREE, nesne, r, aci, z, { disari = 0, egim = 0 } = {}) {
  const R = r + disari;
  nesne.position.set(Math.sin(aci) * R, -Math.cos(aci) * R, z);
  /* Dönüşü Euler ile kurmak YANLIŞTI: `rotation.set(π/2, 0, aci)` three'nin
     XYZ sırasında Z'yi ÖNCE uygular, bu yüzden dışarı bakması gereken yerel
     +Z her açıda −Y'de kalıyordu ve çubuklar yüzeyden eğik fırlıyordu.
     Doğrusu üç birim vektörden taban kurmak: +X teğet, +Y silindir ekseni,
     +Z dışarı normal. */
  const tegen = new THREE.Vector3(Math.cos(aci), Math.sin(aci), 0);
  const eksen = new THREE.Vector3(0, 0, 1);
  const normal = new THREE.Vector3(Math.sin(aci), -Math.cos(aci), 0);
  nesne.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(tegen, eksen, normal));
  if (egim) nesne.rotateOnAxis(new THREE.Vector3(0, 0, 1), egim);
  return nesne;
}


/** Tek parçanın gövdesi. Grup parçanın MERKEZİNDE oturur. */
/* Shapes the habitat builds itself. Declared for the same reason as the
 * satellite's list: the gate can then tell a row that routes to the shared
 * grammar from one that has a local case, and no name collides by accident.
 * The habitat is not on the grammar yet (plan phase F3); this list is what
 * will shrink as it moves over. */
export const LOCAL_KINDS = Object.freeze(new Set([
  'platform', 'plaka', 'silindir-yatay', 'silindir-dikey', 'tunel', 'dugum',
  'toroid', 'ortu', 'raf', 'kutu', 'tank-dikey', 'panel-tarla', 'radyator', 'kalkan',
  'semsiye', 'reaktor', 'direk', 'canak', 'ruzgar', 'tente', 'hat',
  'kubbe', 'depo', 'gezgin', 'atolye',
,
  /* Kargo önlüğü: ped grameri bu adı bilmez, yerel kurucusu var. */
  'onluk']));

function govde(THREE, p, M, dok, env = 'mars') {
  /* Cogaltilan bir parcada `size` DIZININ zarfidir; gövde ise TEK birimi
     cizer. Birimin olcusu zarftan cogaltma acikligi dusulerek bulunur.
     Bu ayrim yapilmayinca panel tarlasinin kablo tavasi `-sx * 0.42` ile
     9,9 m disari gitti ve dizi 42 m'ye yayildi: `sx` artik 23,6 idi. */
  const dz = p.dizilim;
  const birim = (() => {
    const [a, b, c] = p.size;
    if (!dz) return [a, b, c];
    if (dz.yay === 'halka') return [a - 2 * dz.r, b - 2 * dz.r, c];
    return [a - Math.abs(dz.adim[0]) * (dz.n - 1),
      b - Math.abs(dz.adim[1]) * (dz.n - 1),
      c - Math.abs(dz.adim[2]) * (dz.n - 1)];
  })();
  const [sx, sy, sz] = birim;
  const g = new THREE.Group();
  const mat = M[p.sistem] || M.yapi;
  const ekle = (m) => { m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };

  switch (p.sekil) {
    case 'platform': {
      /* Düz bir kutu toprağa benzemez. Kabartma haritası ışığı kırar ve
         yüzeyi taneli gösterir; sıkıştırılmış platform ile doğal regolit
         arasındaki fark ancak böyle görünür. */
      const zeminMat = M.regolit.clone();
      zeminMat.bumpMap = dok.regolit;
      zeminMat.bumpMap.repeat.set(14, 11);
      zeminMat.bumpScale = 0.35;
      const m = ekle(new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), zeminMat));
      m.castShadow = false;
      /* YÜRÜME YOLLARI, beyan edilen rotalardan kurulur.
         Eskisi iki elle yazılmış parlak kutuydu: `sx * 0.72` ve `sy * 0.66`
         uzunluğunda, keyfî bir noktada kesişen, hiçbir şeye bağlı olmayan ve
         ped büyüdükçe büyüyen. Şimdi rota PARÇA ÇİFTİ olarak beyan edilir,
         KIRIKLI YOL'dur (düz doğru habitat silindirinin içinden geçiyordu)
         ve şeritler BİRLEŞTİRİLİR - üç ana yol aynı caddeyi paylaşır, her
         biri kendi kutusunu çizse aynı düzlemde üç kutu üst üste gelirdi. */
      const yolMat = zeminMat.clone();
      yolMat.color = zeminMat.color.clone().multiplyScalar(1.22);
      yolMat.roughness = 0.94;
      /* Bot izi: şeridin basılan ortası kenarından daha çok parlar. */
      const izMat = zeminMat.clone();
      izMat.color = zeminMat.color.clone().multiplyScalar(1.44);
      izMat.roughness = 0.8;
      const ustZ = sz * 0.5;
      const kal = sz * 0.34;
      const yerel = (x, y) => [x - p.pos[0], y - p.pos[1]];

      const seritler = yolSeritleri(env);
      const cukurlar = yolCukurlari(env);

      for (const g of seritler) {
        /* Bu şeridin üstündeki çukurlar, yay uzunluğu aralığı olarak: çukur
           bir BOŞLUK'tur, yoksa düz şerit onu örter ve hiçbir şey görünmez. */
        const bosluk = [];
        for (const c of cukurlar) {
          const dx = c.nokta[0] - g.a[0], dy = c.nokta[1] - g.a[1];
          /* Nokta bu doğrunun üstünde mi (dik uzaklık) ve aralığın içinde mi. */
          if (Math.abs(-g.uy * dx + g.ux * dy) > 1e-6) continue;
          const d = g.ux * dx + g.uy * dy;
          if (d < -1e-6 || d > g.uzunluk + 1e-6) continue;
          const yari = cukurAcikligiM(c.cukurM) / 2;
          bosluk.push([Math.max(0, d - yari), Math.min(g.uzunluk, d + yari), c, d]);
        }
        bosluk.sort((a, b2) => a[0] - b2[0]);

        const dilim = (s0, s1) => {
          const L = s1 - s0;
          if (L <= 0.05) return;
          const tm = (s0 + s1) / 2;
          const [cx, cy] = yerel(g.a[0] + g.ux * tm, g.a[1] + g.uy * tm);
          const serit = ekle(new THREE.Mesh(
            new THREE.BoxGeometry(L, g.genislik, kal), yolMat));
          serit.position.set(cx, cy, ustZ + 0.01);
          serit.rotation.z = g.aci;
          serit.castShadow = false; serit.receiveShadow = true;
          const iz = ekle(new THREE.Mesh(
            new THREE.BoxGeometry(L - 0.1, g.genislik * 0.62, kal), izMat));
          iz.position.set(cx, cy, ustZ + 0.02);
          iz.rotation.z = g.aci;
          iz.castShadow = false; iz.receiveShadow = true;
          /* BOYALI KENAR ÇİZGİSİ. Bir yolu yol yapan şey yüzeyi değil
             BOYASIDIR: soluk bir pedin üstündeki soluk bir şerit, bakan için
             yalnız bir çizgidir. İki yanına kontrast bir kenar çizgisi
             çekilince yol okunur hale gelir. */
          for (const yan of [-1, 1]) {
            const kenar = ekle(new THREE.Mesh(
              new THREE.BoxGeometry(L, g.genislik * 0.07, kal * 0.7), M.kit.gold));
            kenar.position.set(
              cx - g.uy * yan * g.genislik * 0.46,
              cy + g.ux * yan * g.genislik * 0.46, ustZ + 0.025);
            kenar.rotation.z = g.aci;
            kenar.castShadow = false;
          }
          /* YÖN İŞARETLERİ: yolun nereye gittiğini yolun kendisi söyler. */
          const nKev = Math.max(1, Math.round(L / 3.4));
          for (let i = 0; i < nKev; i++) {
            const u = (i + 0.5) / nKev;
            const d = s0 + L * u;
            const [kx, ky] = yerel(g.a[0] + g.ux * d, g.a[1] + g.uy * d);
            for (const kol of [-1, 1]) {
              const kv = ekle(new THREE.Mesh(new THREE.BoxGeometry(
                g.genislik * 0.34, g.genislik * 0.08, kal * 0.7), M.kit.white));
              kv.position.set(
                kx - g.uy * kol * g.genislik * 0.16 - g.ux * g.genislik * 0.08,
                ky + g.ux * kol * g.genislik * 0.16 - g.uy * g.genislik * 0.08,
                ustZ + 0.025);
              kv.rotation.z = g.aci + kol * 0.62;
              kv.castShadow = false;
            }
          }
        };
        let imlec = 0;
        for (const [a1, b1] of bosluk) {
          if (a1 > imlec) dilim(imlec, a1);
          imlec = Math.max(imlec, b1);
        }
        if (imlec < g.uzunluk) dilim(imlec, g.uzunluk);

        /* ÇUKUR: alçaltılmış taban ve iki 1:8 rampa. Hatlar üssün tek
           doğu-batı koridorunu 1,93 ve 1,95 m'de kesiyor, giysili boy ise
           1,95 m - tesviye etmek, iki sabit bağlantı noktasını oynatmaktan da
           caddeyi kaydırmaktan da ucuz. Derinlik ölçümden çıkar. */
        for (const [, , c, d] of bosluk) {
          const ramp = cukurRampaM(c.cukurM);
          const [cx, cy] = yerel(g.a[0] + g.ux * d, g.a[1] + g.uy * d);
          const tab = ekle(new THREE.Mesh(new THREE.BoxGeometry(
            CUKUR_TABAN_M, g.genislik, kal), izMat));
          tab.position.set(cx, cy, ustZ + 0.01 - c.cukurM);
          tab.rotation.z = g.aci;
          tab.castShadow = false; tab.receiveShadow = true;
          for (const yon of [-1, 1]) {
            const dd = yon * (CUKUR_TABAN_M / 2 + ramp / 2);
            const r = ekle(new THREE.Mesh(new THREE.BoxGeometry(
              Math.hypot(ramp, c.cukurM), g.genislik, kal), yolMat));
            r.position.set(cx + g.ux * dd, cy + g.uy * dd, ustZ + 0.01 - c.cukurM / 2);
            r.rotation.z = g.aci;
            /* Sol normal etrafında döndürmek +X'i AŞAĞI yatırır (n × u = -z),
               o yüzden +u yönünde YÜKSELEN rampanın açısı eksi işaretli. */
            r.rotateOnWorldAxis(new THREE.Vector3(-g.uy, g.ux, 0),
              -yon * Math.atan2(c.cukurM, ramp));  // euler-ok: tek dünya ekseni
            r.castShadow = false; r.receiveShadow = true;
            /* Alçak geçit uyarısı: çukur bir SEBEPTEN var ve sebebi hemen
               üstünde. İşaret YOLUN kendisine aittir - boruya takılan bir
               bilezik, patlatmada boru uçarken havada kalırdı. */
            for (const yan of [-1, 1]) {
              const ex = cx + g.ux * yon * (CUKUR_TABAN_M / 2 + ramp)
                - g.uy * yan * g.genislik * 0.56;
              const ey = cy + g.uy * yon * (CUKUR_TABAN_M / 2 + ramp)
                + g.ux * yan * g.genislik * 0.56;
              const dk = ekle(new THREE.Mesh(cylGeoZ(0.045, 0.06, 0.95, 6), M.kit.aluDark));
              dk.position.set(ex, ey, ustZ + 0.48);
              dk.castShadow = false;
              const bs = ekle(new THREE.Mesh(cylGeoZ(0.075, 0.075, 0.18, 6), M.kit.gold));
              bs.position.set(ex, ey, ustZ + 1.04);
              bs.castShadow = false;
            }
          }
        }
      }

      /* Dönüş önlüğü: iki şerit köşede dik birleşince içeri çentik kalır ve
         giysili bir mürettebatın dönüş yarıçapı o çentiğe sığmaz. */
      for (const k of yolKoseleri(env)) {
        const [cx, cy] = yerel(k.nokta[0], k.nokta[1]);
        const don = ekle(new THREE.Mesh(
          cylGeoZ(k.genislik * 0.62, k.genislik * 0.62, kal, 16), yolMat));
        don.position.set(cx, cy, ustZ + 0.012);
        don.castShadow = false; don.receiveShadow = true;
      }

      /* Kenar işaretleri. Toz her şeyi aynı renge boyar; yolun nerede
         bittiğini kenar belli eder. Bir rotanın ucuna 1,8 m'den yakın dikme
         konmaz, yoksa binanın duvarının içine girer. */
      const uclar = [...new Set(YOLLAR.flatMap(y => [y.a, y.b]))]
        .map(partById).filter(Boolean).map(q => [q.pos[0], q.pos[1]]);
      const konan = new Set();
      for (const g of seritler) {
        const n = Math.max(1, Math.round(g.uzunluk / 4.0));
        for (let i = 0; i <= n; i++) {
          const d = (i / n) * g.uzunluk;
          const cx = g.a[0] + g.ux * d, cy = g.a[1] + g.uy * d;
          if (uclar.some(([ux2, uy2]) => Math.hypot(cx - ux2, cy - uy2) < 1.8)) continue;
          /* Çukurun ağzındaki yüksek dikmeler zaten kenarı işaretler. */
          if (cukurlar.some(c => Math.hypot(cx - c.nokta[0], cy - c.nokta[1])
            < cukurAcikligiM(c.cukurM) / 2 + 0.6)) continue;
          for (const yan of [-1, 1]) {
            const px = cx - g.uy * yan * g.genislik * 0.56;
            const py = cy + g.ux * yan * g.genislik * 0.56;
            const anahtar = `${px.toFixed(1)}|${py.toFixed(1)}`;
            if (konan.has(anahtar)) continue;
            konan.add(anahtar);
            const [lx, ly] = yerel(px, py);
            const dik = ekle(new THREE.Mesh(cylGeoZ(0.04, 0.055, 0.42, 6), M.kit.aluDark));
            dik.position.set(lx, ly, ustZ + 0.21);
            dik.castShadow = false;
            /* Yansıtıcı başlık sırayla iki renk: yönü olan bir işaret
               yönsüz bir çubuktan daha okunur. */
            const bas = ekle(new THREE.Mesh(
              cylGeoZ(0.058, 0.058, 0.08, 6), i % 2 ? M.kit.white : M.kit.gold));
            bas.position.set(lx, ly, ustZ + 0.44);
            bas.castShadow = false;
          }
        }
      }

      /* HEDEF TABELASI. Bir yolun nereye gittiği YAZILI olmak zorunda: yön
         işareti yönü söyler, ada ihtiyaç duyulan şey hedeftir. Tabela her
         rotanın iki ucunda, yolun kendi doğrultusuna dik durur. */
      for (const yol of YOLLAR) {
        if (!envAllows(yol.a, env).ok || !envAllows(yol.b, env).ok) continue;
        const n = yolNoktalari(yol);
        if (!n) continue;
        for (const [uc, hedefId] of [[0, yol.b], [n.length - 1, yol.a]]) {
          const hedef = partById(hedefId);
          if (!hedef) continue;
          const dx = n[uc === 0 ? 1 : uc - 1][0] - n[uc][0];
          const dy = n[uc === 0 ? 1 : uc - 1][1] - n[uc][1];
          const aci = Math.atan2(dy, dx);
          const [tx, ty] = yerel(n[uc][0] + Math.cos(aci) * 2.4 - Math.sin(aci) * 1.5,
            n[uc][1] + Math.sin(aci) * 2.4 + Math.cos(aci) * 1.5);
          const direk = ekle(new THREE.Mesh(cylGeoZ(0.05, 0.06, 1.3, 8), M.kit.aluDark));
          direk.position.set(tx, ty, ustZ + 0.65);
          direk.castShadow = false;
          const lv = D.levha(THREE, M.kit, [(hedef.ad || hedefId).toUpperCase()],
            { w: 1.4, h: 0.3 });
          lv.rotateOnWorldAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2);  // euler-ok
          lv.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), aci + Math.PI / 2);  // euler-ok
          lv.position.set(tx, ty, ustZ + 1.3);
          g.add(lv);
        }
      }

      /* Kavşak önlüğü: iki yoldan fazlasının buluştuğu kapı önünde zemin
         genişler, çünkü orada durulur, dönülür ve yük bırakılır. */
      const kavsak = new Map();
      for (const y of YOLLAR) {
        if (!envAllows(y.a, env).ok || !envAllows(y.b, env).ok) continue;
        for (const uc of [y.a, y.b]) kavsak.set(uc, (kavsak.get(uc) ?? 0) + 1);
      }
      for (const [id, n] of kavsak) {
        if (n < 2) continue;
        const q = partById(id);
        if (!q) continue;
        const [cx, cy] = yerel(q.pos[0], q.pos[1]);
        const onluk = ekle(new THREE.Mesh(cylGeoZ(2.0, 2.2, kal, 20), yolMat));
        onluk.position.set(cx, cy, ustZ + 0.011);
        onluk.castShadow = false; onluk.receiveShadow = true;
      }
      /* Bearing plates. A module does not stand on loose regolith: the load
         goes through plates that were levelled and compacted first, and
         step 1 of the build order exists to put them there.
         Their positions are DERIVED from the heaviest ground-mounted parts
         rather than written down, because written-down ones go stale the
         moment the site is re-laid - these were still sitting under the
         previous layout. */
      const tasiyicilar = PARTS
        .filter(q => q.id !== 'platform' && (q.massKg ?? 0) >= 900 && Math.abs(q.pos[2]) < 6)
        .sort((x, y) => (y.massKg ?? 0) - (x.massKg ?? 0))
        .slice(0, 6)
        .map(q => [q.pos[0] - p.pos[0], q.pos[1] - p.pos[1]]);
      for (const [px, py] of tasiyicilar) {
        const pl = ekle(new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, sz * 0.7), M.metal));
        pl.position.set(px, py, sz * 0.55);
        pl.receiveShadow = true; pl.castShadow = false;
        /* Levelling screws, three per plate: the surface is never flat. */
        for (let i = 0; i < 3; i++) {
          const a = i * TAU / 3 + 0.5;
          const v = ekle(new THREE.Mesh(cylGeoZ(0.09, 0.09, sz * 0.5, 8), M.koyu));
          v.position.set(px + Math.cos(a) * 0.82, py + Math.sin(a) * 0.82, sz * 0.5);
          v.castShadow = false;
        }
      }
      break;
    }
    case 'kubbe': {
      /* Gozlem kubbesi: yuzuk cerceve, alti yan cam, bir de tepe cami.
         Camin kendisi ince; gorunur olan CERCEVE ve kepenklerdir, cunku
         cam ussun en kotu radyasyon yoludur ve kullanilmadigi her an
         kapatilir - satirin soyledigi de bu. */
      const r = sx / 2;
      const camMat = new THREE.MeshStandardMaterial({
        color: 0x9fc4d8, roughness: 0.06, metalness: 0.1,
        transparent: true, opacity: 0.30, side: THREE.DoubleSide });
      /* Taban yuzugu: basincli flans. */
      const flans = ekle(new THREE.Mesh(cylGeoZ(r * 1.04, r * 1.04, sz * 0.14, 24), M.kit.aluDark));
      flans.position.z = -sz / 2 + sz * 0.07;
      ekle(new THREE.Mesh(new THREE.TorusGeometry(r * 1.06, r * 0.05, 8, 28), M.kit.metal))
        .position.z = -sz / 2 + sz * 0.14;
      const n = 6;
      for (let i = 0; i < n; i++) {
        const a = i * TAU / n;
        /* Yan cam: disa dogru hafif egik, cerceve icinde. */
        const cam = ekle(new THREE.Mesh(new THREE.BoxGeometry(r * 0.92, 0.02, sz * 0.52), camMat));
        cam.position.set(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9, 0);
        cam.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
          new THREE.Vector3(-Math.sin(a), Math.cos(a), 0),
          new THREE.Vector3(Math.cos(a), Math.sin(a), 0),
          new THREE.Vector3(0, 0, 1)));
        /* Mullion: camlar arasindaki tasiyici. */
        const mul = ekle(new THREE.Mesh(new THREE.BoxGeometry(r * 0.1, r * 0.12, sz * 0.62), M.kit.alu));
        const am = a + Math.PI / n;
        mul.position.set(Math.cos(am) * r * 0.96, Math.sin(am) * r * 0.96, 0);
        mul.rotation.z = am;
        /* Kepenk: yarisinda acik, yarisinda kapali - mekanizma oldugu
           boylece okunur. */
        const acik = i % 2 === 0;
        const kep = ekle(new THREE.Mesh(new THREE.BoxGeometry(r * 0.96, 0.03, sz * 0.5), M.kit.mliSilver));
        const ka = acik ? sz * 0.46 : 0;
        kep.position.set(Math.cos(a) * r * 1.02, Math.sin(a) * r * 1.02, ka);
        kep.quaternion.copy(cam.quaternion);
        if (acik) kep.rotateOnAxis(new THREE.Vector3(1, 0, 0), -0.9);
      }
      /* Tepe cami ve uzerindeki koruma kafesi. */
      const tepe = ekle(new THREE.Mesh(
        new THREE.SphereGeometry(r * 0.86, 22, 12, 0, TAU, 0, Math.PI / 2.4), camMat));
      tepe.position.z = sz * 0.26;
      for (let i = 0; i < 8; i++) {
        const a = i * TAU / 8;
        const tel = ekle(new THREE.Mesh(
          new THREE.BoxGeometry(r * 0.78, r * 0.03, r * 0.03), M.kit.aluDark));
        tel.position.z = sz * 0.44;
        tel.rotation.z = a;
      }
      /* Ic el rayi: birinin tutunacagi sey. */
      const ray = ekle(new THREE.Mesh(new THREE.TorusGeometry(r * 0.74, r * 0.035, 6, 26), M.kit.metal));
      ray.position.z = -sz * 0.16;
      break;
    }
    case 'depo': {
      /* Yuzey deposu: cerceve, uc raf gozu, gergili toz ortusu. Basincsiz -
         bir ambari basinclandirmak bos yere kutle harcamaktir. */
      const ayakR = 0.075;
      for (const ex of [-1, 1]) for (const ey of [-1, 1]) {
        const kol = D.tasiyiciKolon(THREE, M.kit, sz, ayakR, { guse: 3, civata: 4 });
        kol.position.set(ex * sx * 0.45, ey * sy * 0.42, -sz / 2);
        g.add(kol);
      }
      /* Kirisler ve capraz baglar. */
      for (const ey of [-1, 1]) {
        const kir = ekle(new THREE.Mesh(new THREE.BoxGeometry(sx * 0.94, sy * 0.05, sz * 0.07), M.kit.alu));
        kir.position.set(0, ey * sy * 0.42, sz * 0.44);
        const capraz = ekle(new THREE.Mesh(new THREE.BoxGeometry(sx * 0.96, sy * 0.03, sz * 0.04), M.kit.aluDark));
        capraz.position.set(0, ey * sy * 0.42, 0);
        capraz.rotation.y = 0.32;
      }
      /* Uc raf gozu, her birinde istiflenmis kargo kutulari. */
      const goz = 3;
      for (let i = 0; i < goz; i++) {
        const x = (i / (goz - 1) - 0.5) * sx * 0.68;
        for (let k = 0; k < 2; k++) {
          const raf = ekle(new THREE.Mesh(
            new THREE.BoxGeometry(sx * 0.2, sy * 0.72, sz * 0.03), M.kit.metal));
          raf.position.set(x, 0, -sz * 0.3 + k * sz * 0.34);
          /* Kutular: hepsi ayni degil - bir ambar oyle gorunmez. */
          for (let j = 0; j < 2; j++) {
            const h = sz * (0.2 + ((i + j + k) % 3) * 0.045);
            const kutu = ekle(new THREE.Mesh(
              new THREE.BoxGeometry(sx * 0.17, sy * 0.3, h),
              (i + j) % 2 ? M.kit.alu : M.kit.aluDark));
            kutu.position.set(x, (j - 0.5) * sy * 0.36, -sz * 0.3 + k * sz * 0.34 + h / 2 + sz * 0.02);
          }
        }
      }
      /* Toz ortusu: catiya gergili, kenarlari asagi sarkar. */
      const ortu = ekle(new THREE.Mesh(
        new THREE.BoxGeometry(sx * 0.98, sy * 0.9, sz * 0.02), M.kit.mliSilver));
      ortu.position.z = sz * 0.47;
      for (const ex of [-1, 1]) {
        const etek = ekle(new THREE.Mesh(
          new THREE.BoxGeometry(sx * 0.02, sy * 0.9, sz * 0.3), M.kit.mliSilver));
        etek.position.set(ex * sx * 0.48, 0, sz * 0.3);
      }
      const lv = D.levha(THREE, M.kit, [p.tech?.no || p.id, 'DEPOT'],
        { w: sx * 0.3, h: sz * 0.14 });
      lv.position.set(0, -sy * 0.44, sz * 0.2);
      lv.rotation.x = Math.PI / 2;
      g.add(lv);
      break;
    }
    case 'gezgin': {
      /* Kasif gezgini: roker-bojili alti tekerlek, gunes destesi, direk ve
         kol. Roker-boji, tekerlek yuksekligi kadar engeli asmasini saglayan
         sey - ve gorunur ozelligi de o. */
      const tekR = sz * 0.22, govdeZ = -sz * 0.1;
      const govde = ekle(new THREE.Mesh(
        new THREE.BoxGeometry(sx * 0.62, sy * 0.66, sz * 0.26), mat));
      govde.position.z = govdeZ;
      /* Gunes destesi: govdenin ustunde, hafif egik. */
      const deste = ekle(new THREE.Mesh(
        new THREE.BoxGeometry(sx * 0.72, sy * 0.78, sz * 0.03), M.kit.mliSilver));
      deste.position.z = govdeZ + sz * 0.17;
      deste.rotation.y = -0.06;
      for (const yan of [-1, 1]) {
        /* Roker kolu: iki tekerlegi bir eksende birlestirir. */
        const roker = ekle(new THREE.Mesh(
          new THREE.BoxGeometry(sx * 0.78, sy * 0.05, sz * 0.05), M.kit.aluDark));
        roker.position.set(0, yan * sy * 0.38, govdeZ - sz * 0.06);
        for (let i = 0; i < 3; i++) {
          const x = (i - 1) * sx * 0.3;
          const tek = ekle(new THREE.Mesh(cylGeoY(tekR, tekR, sy * 0.13, 16), M.kit.koyuMetal));
          tek.position.set(x, yan * sy * 0.44, -sz / 2 + tekR);
          /* Gros: tekerlegin regolitte tutunmasini saglayan sey. */
          for (let k = 0; k < 8; k++) {
            const a = k * TAU / 8;
            const gr = ekle(new THREE.Mesh(
              new THREE.BoxGeometry(tekR * 0.22, sy * 0.14, tekR * 0.18), M.kit.metal));
            gr.position.set(x + Math.cos(a) * tekR * 0.96, yan * sy * 0.44,
              -sz / 2 + tekR + Math.sin(a) * tekR * 0.96);
            gr.rotation.y = -a;
          }
          const bacak = ekle(new THREE.Mesh(
            new THREE.BoxGeometry(sx * 0.035, sy * 0.035, sz * 0.2), M.kit.alu));
          bacak.position.set(x, yan * sy * 0.4, -sz / 2 + tekR + sz * 0.1);
        }
      }
      /* Direk ve kamera kafasi. */
      const direk = ekle(new THREE.Mesh(cylGeoZ(sx * 0.022, sx * 0.028, sz * 0.5, 10), M.kit.metal));
      direk.position.set(-sx * 0.22, sy * 0.2, govdeZ + sz * 0.42);
      const kafa = ekle(new THREE.Mesh(
        new THREE.BoxGeometry(sx * 0.11, sy * 0.1, sz * 0.09), M.kit.aluDark));
      kafa.position.set(-sx * 0.22, sy * 0.2, govdeZ + sz * 0.7);
      for (const ex of [-1, 1]) {
        const lens = ekle(new THREE.Mesh(cylGeoY(sx * 0.022, sx * 0.022, sy * 0.02, 10), M.kit.black));
        lens.position.set(-sx * 0.22 + ex * sx * 0.03, sy * 0.15, govdeZ + sz * 0.7);
      }
      /* Kol: katli halde govdenin yaninda. */
      const kol1 = ekle(new THREE.Mesh(cylGeoX(sx * 0.02, sx * 0.02, sx * 0.34, 8), M.kit.alu));
      kol1.position.set(sx * 0.16, -sy * 0.34, govdeZ + sz * 0.04);
      const kol2 = ekle(new THREE.Mesh(cylGeoZ(sx * 0.018, sx * 0.018, sz * 0.2, 8), M.kit.alu));
      kol2.position.set(sx * 0.32, -sy * 0.34, govdeZ - sz * 0.06);
      /* Sarj pabucu ve kimlik. */
      const pad = ekle(new THREE.Mesh(cylGeoZ(sx * 0.1, sx * 0.1, sz * 0.03, 12), M.kit.gold));
      pad.position.set(-sx * 0.3, -sy * 0.3, -sz / 2 + sz * 0.015);
      const lvg = D.levha(THREE, M.kit, [p.tech?.no || p.id, 'ROVER'],
        { w: sx * 0.26, h: sz * 0.1 });
      lvg.position.set(0, -sy * 0.34, govdeZ + sz * 0.05);
      lvg.rotation.x = Math.PI / 2;
      g.add(lvg);
      break;
    }
    case 'atolye': {
      /* Atolye: cerceve, regolit dolgulu duvar panelleri, sarmal kapi ve
         cati panjuru. Metal kesen bir atolye isi uretir; panjur o isinin
         cikis yolu ve duvardaki tek hareketli parca. */
      const duvarMat = M.regolit;
      for (const ex of [-1, 1]) {
        const duvar = ekle(new THREE.Mesh(
          new THREE.BoxGeometry(sx * 0.04, sy * 0.94, sz * 0.9), duvarMat));
        duvar.position.set(ex * sx * 0.48, 0, 0);
        duvar.receiveShadow = true;
      }
      const arka = ekle(new THREE.Mesh(
        new THREE.BoxGeometry(sx * 0.96, sy * 0.04, sz * 0.9), duvarMat));
      arka.position.set(0, sy * 0.48, 0);
      const cati = ekle(new THREE.Mesh(
        new THREE.BoxGeometry(sx * 0.98, sy * 0.98, sz * 0.05), M.kit.aluDark));
      cati.position.z = sz * 0.47;
      /* Cerceve dikmeleri. */
      for (const ex of [-1, 1]) for (const ey of [-1, 1]) {
        const dik = ekle(new THREE.Mesh(
          new THREE.BoxGeometry(sx * 0.05, sy * 0.05, sz * 0.94), M.kit.alu));
        dik.position.set(ex * sx * 0.47, ey * sy * 0.47, 0);
      }
      /* Sarmal kapi: ucte biri acik, lamelleri gorunur. */
      const lamel = 7, acikPay = 0.34;
      for (let i = 0; i < lamel; i++) {
        const u = i / (lamel - 1);
        if (u < acikPay) continue;
        const lm = ekle(new THREE.Mesh(
          new THREE.BoxGeometry(sx * 0.66, sy * 0.02, sz * 0.12), M.kit.mliSilver));
        lm.position.set(0, -sy * 0.48, sz * (0.42 - u * 0.86));
      }
      const rulo = ekle(new THREE.Mesh(cylGeoX(sz * 0.07, sz * 0.07, sx * 0.7, 12), M.kit.metal));
      rulo.position.set(0, -sy * 0.48, sz * 0.42);
      /* Cati panjuru. */
      for (let i = 0; i < 4; i++) {
        const pj = ekle(new THREE.Mesh(
          new THREE.BoxGeometry(sx * 0.3, sy * 0.06, sz * 0.02), M.kit.metal));
        pj.position.set(sx * 0.22, (i - 1.5) * sy * 0.1, sz * 0.5);
        pj.rotation.x = 0.5;
      }
      /* Ic tezgah ve yedek duvari - kapinin acik kalan ucundan gorunur. */
      const tezgah = ekle(new THREE.Mesh(
        new THREE.BoxGeometry(sx * 0.8, sy * 0.22, sz * 0.05), M.kit.alu));
      tezgah.position.set(0, sy * 0.3, -sz * 0.12);
      for (let i = 0; i < 5; i++) {
        const kutu = ekle(new THREE.Mesh(
          new THREE.BoxGeometry(sx * 0.1, sy * 0.1, sz * 0.12), M.kit.aluDark));
        kutu.position.set((i / 4 - 0.5) * sx * 0.66, sy * 0.42, sz * 0.14);
      }
      const lva = D.levha(THREE, M.kit, [p.tech?.no || p.id, 'WORKSHOP'],
        { w: sx * 0.3, h: sz * 0.12 });
      lva.position.set(-sx * 0.2, -sy * 0.5, sz * 0.3);
      lva.rotation.x = Math.PI / 2;
      g.add(lva);
      break;
    }
    case 'kalkan': {
      /* A shadow shield is a frame that gets FILLED on site. Shielding a
         reactor all the way round costs mass nobody has; shielding the cone
         that points at the crew costs a frame and some regolith, and the
         regolith is already underfoot. So the thing to draw is the frame,
         the panels, and the fill behind them. */
      const cerceveMat = M.kit.metal;
      for (const ex of [-1, 1]) {
        const dikme = ekle(new THREE.Mesh(new THREE.BoxGeometry(sx * 0.06, sy, sz), cerceveMat));
        dikme.position.x = ex * sx * 0.47;
      }
      for (const ez of [-1, 1]) {
        const kiris = ekle(new THREE.Mesh(new THREE.BoxGeometry(sx, sy * 1.02, sz * 0.07), cerceveMat));
        kiris.position.z = ez * sz * 0.46;
      }
      /* Regolith fill between the frames: the shielding itself. */
      const dolgu = ekle(new THREE.Mesh(
        new THREE.BoxGeometry(sx * 0.9, sy * 0.86, sz * 0.88), M.regolit));
      dolgu.receiveShadow = true;
      /* Panels on the crew side, bolted after the frame is levelled. */
      const satir = 3, sutun = 4;
      for (let i = 0; i < sutun; i++) {
        for (let j = 0; j < satir; j++) {
          const pn = ekle(new THREE.Mesh(
            new THREE.BoxGeometry(sx * 0.9 / sutun * 0.9, sy * 0.1, sz * 0.9 / satir * 0.88), M.isil));
          pn.position.set((i - (sutun - 1) / 2) * sx * 0.9 / sutun,
            sy * 0.52, (j - (satir - 1) / 2) * sz * 0.9 / satir);
          for (const ex of [-1, 1]) {
            const civ = ekle(new THREE.Mesh(cylGeoY(sx * 0.012, sx * 0.012, sy * 0.06, 6), M.koyu));
            civ.position.set(pn.position.x + ex * sx * 0.085, sy * 0.58, pn.position.z);
          }
        }
      }
      /* Hold-down bolts along the base. */
      for (let i = 0; i < 6; i++) {
        const civ = ekle(new THREE.Mesh(cylGeoZ(sx * 0.02, sx * 0.02, sz * 0.05, 6), M.koyu));
        civ.position.set((i / 5 - 0.5) * sx * 0.88, 0, -sz * 0.47);
      }
      /* Caution placard: this is the one wall on the site you do not walk
         behind while the core is running. */
      const ikaz = ekle(new THREE.Mesh(
        new THREE.BoxGeometry(sx * 0.16, sy * 0.06, sz * 0.1), M.kit.ikaz));
      ikaz.position.set(sx * 0.3, sy * 0.55, sz * 0.3);
      break;
    }
    case 'plaka': {
      ekle(new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat));
      const pabuc = D.ayakPabucu(THREE, M.kit, sx * 0.34, { regolitMat: M.regolit });
      pabuc.position.z = sz * 0.5;
      g.add(pabuc);
      /* Regolith screw: the only thing holding the plate to the ground.
         Its length used to be sz * 3.2, which is fine for a 0.1 m bearing
         plate and nonsense for anything thicker - it turned a 3 m wall into
         a 9.7 m spike. How deep an anchor goes is set by the FOOTPRINT it
         has to hold down, not by how thick the thing above it is. */
      const vidaBoy = Math.min(sz * 3.2, Math.min(sx, sy) * 1.2);
      for (let i = 0; i < 4; i++) {
        const a = i * TAU / 4 + Math.PI / 4;
        const vida = ekle(new THREE.Mesh(cylGeoZ(sx * 0.05, sx * 0.05, vidaBoy, 8), M.koyu));
        vida.position.set(Math.cos(a) * sx * 0.36, Math.sin(a) * sy * 0.36, -sz * 0.5 - vidaBoy * 0.4);
      }
      break;
    }
    case 'silindir-yatay': {
      /* Uçlar YARIM KÜRE DEĞİL. Yarım küreyle çizdiğimde modül bir
         habitat değil zeplin gibi duruyordu ve haklı olarak öyle
         duruyordu: Ø4,4 m gövdede her kapak 2,2 m uzunluk yiyor, 7,6 m
         modülün yalnız 3,2 m'si silindir kalıyordu.

         Gerçek basınç kabı TORİSFERİK kapak kullanır: derinliği yarıçapın
         yarısı kadar, göbeği küresel, kenarı küçük yarıçaplı bir kavis
         (knuckle) ile silindire bağlanır. Aynı basıncı daha kısa boyda
         taşır — bu yüzden her tank ve her modül böyle görünür. */
      const r = sy / 2;
      const kapakD = r * 0.52;                      // kapak derinliği
      const boy = Math.max(sx - 2 * kapakD, r * 0.6);
      const govdeM = ekle(new THREE.Mesh(cylGeoX(r, r, boy, 44), mat));
      govdeM.material = mat.clone();
      govdeM.material.map = dok.zar.clone();
      govdeM.material.map.needsUpdate = true;
      govdeM.material.map.repeat.set(7, 3);
      for (const s of [-1, 1]) {
        /* Kapak profili lathe ile: göbek küresel, kenar knuckle. */
        const nokta = [];
        const ADIM = 14;
        for (let i = 0; i <= ADIM; i++) {
          const t = i / ADIM;
          const yariCap = r * Math.cos(t * Math.PI / 2) ** 0.62;
          const derin = kapakD * Math.sin(t * Math.PI / 2);
          nokta.push(new THREE.Vector2(Math.max(yariCap, 0.004), derin));
        }
        const k = ekle(latheX(nokta, 44, mat));
        k.scale.x = s;
        k.position.x = s * boy / 2;
        /* Kapak ayrıntısı. İlk denemede meridyen dikişleri sabit yarıçapa
           koymuştum ve hepsi kubbenin İÇİNDE kaldı — görünmediler. Kapak
           bir küre değil, profili yukarıda tanımlanan bir dönel yüzey;
           halka nereye oturacaksa yarıçapı o profilden okunmalı. */
        const profilde = (t) => ({
          rr: r * Math.pow(Math.cos(t * Math.PI / 2), 0.62),
          dd: kapakD * Math.sin(t * Math.PI / 2),
        });
        /* knuckle halkası: kapağın silindire bağlandığı kavis */
        const kn = profilde(0.16);
        const knuckle = ekle(new THREE.Mesh(new THREE.TorusGeometry(kn.rr, r * 0.018, 6, 34), M.yapi));
        knuckle.position.x = s * (boy / 2 + kn.dd);
        knuckle.rotation.y = Math.PI / 2;
        /* orta kuşak: dilim eklerinin çevresel dikişi */
        const or = profilde(0.58);
        const orta = ekle(new THREE.Mesh(new THREE.TorusGeometry(or.rr, r * 0.013, 6, 30), M.yapi));
        orta.position.x = s * (boy / 2 + or.dd);
        orta.rotation.y = Math.PI / 2;
        /* kutup göbeği: dilimlerin birleştiği kapak plakası */
        const gobek = ekle(new THREE.Mesh(cylGeoX(r * 0.11, r * 0.11, r * 0.035, 16), M.yapi));
        gobek.position.x = s * (boy / 2 + kapakD * 0.97);
      }
      /* Kuşak kaburgaları: burkulmayı tutan halkalar. İnce ve SIK olur —
         kalın birkaç bant kemer gibi duruyordu; gerçekte kaburga cidarın
         birkaç katı kalınlıkta, aralığı ise çapın çeyreği kadardır. */
      const n = Math.max(4, Math.round(boy / (r * 0.5)));
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n - 0.5;
        const kab = ekle(new THREE.Mesh(new THREE.TorusGeometry(r * 1.008, r * 0.016, 6, 34), M.yapi));
        kab.position.x = t * boy; kab.rotation.y = Math.PI / 2;
      }
      /* Boyuna sertleştirici: kaburgaları birbirine bağlar. */
      for (let i = 0; i < 8; i++) {
        const a = i * TAU / 8 + Math.PI / 16;
        const ser = ekle(new THREE.Mesh(new THREE.BoxGeometry(boy * 0.98, r * 0.03, r * 0.022), M.yapi));
        ser.position.set(0, Math.cos(a) * r * 1.006, Math.sin(a) * r * 1.006);
        ser.rotation.x = a;
      }
      for (const q of (p.ports || [])) {
        const kp = D.kapak(THREE, M.kit, r * 0.34);
        kp.position.set(q.pos[0], q.pos[1], q.pos[2]);
        const d = new THREE.Vector3(...q.dir);
        kp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d);
        g.add(kp);
      }

      /* ── donanım ──────────────────────────────────────────────────
         Kabuk tek başına bir maket; modülü gerçek yapan üstündeki
         işlerdir. Her biri bir gereksinimden doğar. */

      /* Sırt korkuluğu: EVA'da modül üstünde yürünür, tutunacak yer şart.
         Kaburgaların üstünde durur (r × 1,03) yoksa içlerinde kayboluyor. */
      for (const yan of [-1, 1]) {
        const kork = D.korkuluk(THREE, M.kit, boy * 0.92);
        const a = yan * 0.42;
        kork.position.set(0, Math.sin(a) * r * 1.03, Math.cos(a) * r * 1.03);
        kork.rotation.x = a;
        g.add(kork);
      }

      /* Gözlem penceresi: yan yüzde, göz hizasında. */
      /* Pencere, basınçlı kapağın açılma alanından UZAKTA durur: kapak
         çarkını çeviren kolun süpürdüğü yere pencere konmaz. */
      const pen = D.pencere(THREE, M.kit, r * 0.3);
      pen.position.set(-boy * 0.3, -r * 0.93, r * 0.28);
      pen.rotation.set(Math.PI / 2, 0, 0);
      pen.rotateX(-0.3);
      g.add(pen);

      /* Göbek bağı paneli: hatlar buraya gelir. */
      const kon = D.konnektorPaneli(THREE, M.kit, r * 0.46, r * 0.34);
      kon.position.set(-boy * 0.36, -r * 0.98, -r * 0.34);
      kon.rotation.x = Math.PI / 2;
      g.add(kon);

      /* Kablo tavası: sırt boyunca, korkuluğun altında. */
      const tava = D.kabloTavasi(THREE, M.kit, boy * 0.92);
      tava.position.set(0, 0, r * 1.02);
      g.add(tava);

      /* MLI dikiş şeridi: battaniye ayırıcılarla kabuktan uzak durur. */
      for (const yan of [-1, 1]) {
        const ml = D.mliSeridi(THREE, M.kit, boy * 0.9);
        const a = yan * 1.05;
        ml.position.set(0, Math.sin(a) * r * 1.02, Math.cos(a) * r * 1.02);
        ml.rotation.x = a;
        g.add(ml);
      }

      /* Künye levhası ve seyrüsefer fenerleri. */
      const lv = D.levha(THREE, M.kit, [p.tech?.no || p.id, p.ad], { w: r * 0.7, h: r * 0.34 });
      lv.position.set(boy * 0.26, -r * 0.99, -r * 0.2);
      lv.rotation.x = Math.PI / 2;
      g.add(lv);
      for (const s2 of [-1, 1]) {
        const f = D.fener(THREE, M.kit);
        f.position.set(s2 * boy * 0.46, 0, r * 1.03);
        g.add(f);
      }
      break;
    }
    case 'silindir-dikey': {
      const r = sx / 2;
      ekle(new THREE.Mesh(cylGeoZ(r, r, sz, 30), mat));
      for (const z of [-sz / 2, sz / 2]) {
        const h = ekle(new THREE.Mesh(new THREE.TorusGeometry(r * 1.02, r * 0.06, 6, 28), M.koyu));
        h.position.z = z;
      }
      for (const q of (p.ports || [])) {
        const kp = D.kapak(THREE, M.kit, r * 0.52);
        kp.position.set(q.pos[0], q.pos[1], q.pos[2]);
        kp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...q.dir));
        g.add(kp);
      }
      /* Dış kapının altına merdiven: zemin ile eşik arasında 1,5 m var. */
      const mer = D.merdiven(THREE, M.kit, sz * 0.58);
      mer.position.set(0, -r * 1.02, -sz * 0.5);
      g.add(mer);
      /* Kapı yanında tutamak — eldivenli el kapağı çevirirken tutunur.
         Konum AÇIdan gelir: silindir yüzeyi düzlem değildir. */
      for (const yan of [-1, 1]) {
        const t = D.tutamak(THREE, M.kit, { uzunluk: r * 0.34 });
        silindireOturt(THREE, t, r, yan * 0.62, sz * 0.05);
        g.add(t);
      }
      /* Kuşak kaburgaları: kilit de bir basınç kabıdır, çıplak tüp değil. */
      const nk = 4;
      for (let i = 0; i < nk; i++) {
        const kb = ekle(new THREE.Mesh(new THREE.TorusGeometry(r * 1.008, r * 0.02, 6, 30), M.yapi));
        kb.position.z = ((i + 0.5) / nk - 0.5) * sz * 0.86;
      }
      /* Arka yüzde battaniye şeridi ve boşaltma pompası kutusu. */
      const mlk = D.mliSeridi(THREE, M.kit, sz * 0.7, { n: 3 });
      silindireOturt(THREE, mlk, r, Math.PI * 0.82, 0, { disari: 0.01, egim: Math.PI / 2 });
      g.add(mlk);
      const pompa = ekle(new THREE.Mesh(new THREE.BoxGeometry(r * 0.5, r * 0.34, r * 0.44), M.koyu));
      silindireOturt(THREE, pompa, r, Math.PI * 0.55, -sz * 0.18, { disari: r * 0.16 });
      /* İkaz levhası: basınç boşaltma uyarısı, kırmızı şeritli. */
      const ikaz = D.levha(THREE, M.kit, ['PRESSURISED', 'do not open before venting'],
        { w: r * 0.9, h: r * 0.42, seritRenk: '#c9563f' });
      ikaz.position.set(0, -r * 1.01, sz * 0.3);
      ikaz.rotation.x = Math.PI / 2;
      g.add(ikaz);
      const f2 = D.fener(THREE, M.kit, { renk: 0xff6a4a });
      f2.position.set(0, 0, sz * 0.52);
      g.add(f2);
      break;
    }
    case 'tunel': {
      /* A tunnel runs along its LONGEST horizontal axis. It was built along
         x unconditionally, so a run between two modules separated in y
         could not be drawn at all - which is why the node, the inflatable
         and the greenhouse had nothing between them. */
      const uzunEksen = sy > sx, uzun = Math.max(sx, sy), cap = Math.min(sx, sy);
      const r = cap / 2;
      /* iki rijit uç + ortada körük: ısıl genleşmeyi ve oturmayı yutar */
      for (const s of [-1, 1]) {
        const u = ekle(new THREE.Mesh(cylGeoX(r, r, uzun * 0.3, 26), mat));
        u.position.x = s * uzun * 0.35;
      }
      const n = 7, boy = uzun * 0.4;
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n - 0.5;
        const k = ekle(new THREE.Mesh(new THREE.TorusGeometry(r * 1.06, r * 0.13, 7, 26), M.koyu));
        k.position.x = t * boy; k.rotation.y = Math.PI / 2;
      }
      const ic = ekle(new THREE.Mesh(cylGeoX(r * 0.92, r * 0.92, boy, 24), M.koyu));
      ic.position.x = 0;
      /* Tünelin üstünden de yürünür: iki yanda korkuluk. */
      for (const yan of [-1, 1]) {
        const kork = D.korkuluk(THREE, M.kit, uzun * 0.86);
        kork.position.set(0, yan * r * 0.5, r * 0.84);
        kork.rotation.x = yan * 0.55;
        g.add(kork);
      }
      if (uzunEksen) g.rotation.z = Math.PI / 2;
      break;
    }
    case 'dugum': {
      const r = sx / 2;
      ekle(new THREE.Mesh(new THREE.SphereGeometry(r, 30, 20), mat));
      /* dört yatay kapı + bir tavan penceresi kollarıyla */
      const kollar = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1]];
      for (const d of kollar) {
        const kol = ekle(new THREE.Mesh(cylGeoZ(r * 0.42, r * 0.42, r * 0.7, 20), mat));
        const v = new THREE.Vector3(...d);
        kol.position.copy(v).multiplyScalar(r * 0.92);
        kol.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), v);
        const kp = D.kapak(THREE, M.kit, r * 0.42);
        kp.position.copy(v).multiplyScalar(r * 1.26);
        kp.quaternion.copy(kol.quaternion);
        g.add(kp);
      }
      /* Kapılar arası geçiş korkuluğu: kürenin çevresinde dört yay. */
      for (let i = 0; i < 4; i++) {
        const a = i * TAU / 4 + Math.PI / 4;
        const kork = D.korkuluk(THREE, M.kit, r * 0.9, { ayakSayisi: 2 });
        kork.position.set(Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.92, r * 0.3);
        kork.rotation.z = a + Math.PI / 2;
        g.add(kork);
      }
      const fd = D.fener(THREE, M.kit);
      fd.position.z = r * 1.08;
      g.add(fd);
      break;
    }
    case 'toroid': {
      /* şişme modül: zar bombeli, dikiş şeritleri gerilme dağılımını gösterir */
      const R = sx * 0.3, r = sz * 0.5;
      const t = ekle(new THREE.Mesh(new THREE.TorusGeometry(R, r, 20, 40), mat));
      t.material = mat.clone(); t.material.map = dok.zar; t.material.map.repeat.set(8, 2);
      const cekirdek = ekle(new THREE.Mesh(cylGeoZ(R * 0.42, R * 0.42, sz * 1.05, 26), M.koyu));
      for (let i = 0; i < 12; i++) {
        const a = i * TAU / 12;
        const serit = ekle(new THREE.Mesh(new THREE.TorusGeometry(r * 1.03, r * 0.05, 5, 18), M.koyu));
        serit.position.set(Math.cos(a) * R, Math.sin(a) * R, 0);
        /* A strap wraps the TUBE, so its plane holds the tube's cross section
           and its normal lies along the big ring's TANGENT. Euler cannot say
           that: three composes XYZ as Rx*Ry*Rz, so the Z term hits the vector
           first and the following Rx(PI/2) drops every normal onto -Y.
           Measured, all 12 straps shared one normal, up to 90 deg off, so the
           ring read as a stack of hoops in a single plane. */
        serit.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1),
          new THREE.Vector3(-Math.sin(a), Math.cos(a), 0));
      }
      for (let i = 0; i < 4; i++) {
        const a = i * TAU / 4 + Math.PI / 8;
        const j = ekle(new THREE.Mesh(cylGeoX(R * 0.06, R * 0.06, R * 0.62, 10), M.koyu));
        j.position.set(Math.cos(a) * R * 0.7, Math.sin(a) * R * 0.7, 0);
        j.rotation.z = a;
      }
      /* Çekirdek çevresinde tutunma rayı ve künye. */
      for (let i = 0; i < 3; i++) {
        const a = i * TAU / 3;
        const kork = D.korkuluk(THREE, M.kit, R * 0.7, { ayakSayisi: 2 });
        kork.position.set(Math.cos(a) * R * 0.44, Math.sin(a) * R * 0.44, sz * 0.45);
        kork.rotation.z = a + Math.PI / 2;
        g.add(kork);
      }
      const lv4 = D.levha(THREE, M.kit, [p.tech?.no || p.id, 'INFLATABLE VOLUME'], { w: R * 0.5, h: R * 0.24 });
      lv4.position.set(0, -R * 0.46, sz * 0.5);
      lv4.rotation.x = Math.PI / 2;
      g.add(lv4);
      break;
    }
    case 'ortu': {
      /* Regolit örtüsü, ÖRTTÜĞÜ ŞEYDEN türetilir.
         Ölçülen (düzeltme öncesi): çizilen kabuk z 0,16..5,56 ve y -2,70..0,
         yani yerden 5,56 m'ye çıkan, -Y yanına dikilmiş DİKEY bir yarım
         duvar - beyan edilen kutu ise z 2,60..4,20. İki ayrı sebep: yarıçap
         örttüğü modülden (2,2) değil parçanın kendi GENİŞLİĞİNDEN (5,4)
         geliyordu, ve lathe üstteki yarımı değil -Y'ye bakan yarımı
         süpürüyordu. Üstünde durmayan şey örtü değildir.
         Artık eksen de, uzunluk da, yarıçap da bağlı olduğu silindirden
         okunur; örtünün kendi `sz`'si yalnız kalınlıktır. */
      const ust = partById(p.mountsTo);
      const kR = ust ? Math.min(ust.size[1], ust.size[2]) / 2 : sy / 2;
      /* Kalinlik ayri beyan edilir; `sz` artik zarfin yuksekligi. */
      const r = kR + (p.kalinlik ?? 0.6) * 0.5;
      const boy = ust ? ust.size[0] * 1.04 : sx;
      /* Silindirin ekseni, bu grubun kendi çerçevesinde. */
      const eksen = ust ? ust.pos[2] - p.pos[2] : 0;
      const profil = [new THREE.Vector2(r, -boy / 2), new THREE.Vector2(r, boy / 2)];
      /* phi-ok: ÖLÇÜLDÜ — latheX'te phi = 0 +Z'ye (ÜSTE) bakar, yani bu
         yarım zaten üstü kaplıyor ve aşağıdaki çeyrek tur onu eksene
         oturtuyor. Yön burada yazılı olduğu için açı kalabilir. */
      const m = ekle(latheX(profil, 26, M.regolit, 0, Math.PI));
      /* Süpürülen yarım -Y'ye bakar; tek eksende çeyrek tur onu ÜSTE alır.
         Tek bileşenli dönüş, sıra tuzağı yok. */
      m.rotation.x = -Math.PI / 2;
      m.position.z = eksen;
      m.castShadow = false;
      /* Yüzeyi kıran regolit yığınları kabuğun üstüne, aynı eksene oturur. */
      for (let i = 0; i < 26; i++) {
        const a = Math.PI * (i + 0.5) / 26;
        const yig = ekle(new THREE.Mesh(new THREE.SphereGeometry(r * 0.1, 7, 5), M.regolit));
        yig.position.set((i % 7 - 3) * boy * 0.14, Math.cos(a) * r * 0.96,
          eksen + Math.sin(a) * r * 0.96);
        yig.scale.set(1, 1, 0.6); yig.castShadow = false;
      }
      break;
    }
    case 'raf': {
      ekle(new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), M.koyu));
      const n = 5;
      for (let i = 0; i < n; i++) {
        const r = ekle(new THREE.Mesh(new THREE.BoxGeometry(sx / n * 0.88, sy * 1.1, sz * 0.82), mat));
        r.position.x = (i / (n - 1) - 0.5) * sx * 0.82;
      }
      break;
    }
    /* ── kargo önlüğü ───────────────────────────────────────────────
       Yük, basınçlı hacmin yanına inemez: bir iniş aracı regoliti çevresine
       savurur. Ayrı bir önlük hem inişi hem yük taşımayı güvenli kılar ve
       maliyeti yalnızca sıkıştırılmış zemindir - ama BOŞ bir levha değildir:
       kenarı, bağlama halkaları ve köşe işaretleri vardır. */
    case 'onluk': {
      const plaka = ekle(new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat));
      plaka.receiveShadow = true; plaka.castShadow = false;
      /* Kenar bordürü: önlüğün nerede bittiği tozda görünmek zorunda. */
      for (const [ex, ey, w, h] of [[0, sy * 0.5, sx, 0.3], [0, -sy * 0.5, sx, 0.3],
        [sx * 0.5, 0, 0.3, sy], [-sx * 0.5, 0, 0.3, sy]]) {
        const b = ekle(new THREE.Mesh(new THREE.BoxGeometry(w, h, sz * 1.8), M.kit.aluDark));
        b.position.set(ex, ey, sz * 0.4);
        b.castShadow = false;
      }
      /* Bağlama halkaları: yük indirilir ve BAĞLANIR, yoksa ilk fırtınada
         önlükte durmaz. */
      for (const ex of [-1, 1]) for (const ey of [-1, 1]) {
        const halka = ekle(new THREE.Mesh(
          new THREE.TorusGeometry(0.22, 0.05, 8, 18), M.kit.aluDark));
        halka.position.set(ex * sx * 0.3, ey * sy * 0.3, sz * 0.6);
        halka.rotation.x = Math.PI / 2;
        const yuva = ekle(new THREE.Mesh(cylGeoZ(0.16, 0.2, sz * 1.2, 10), M.kit.aluDark));
        yuva.position.set(ex * sx * 0.3, ey * sy * 0.3, sz * 0.2);
      }
      /* Köşe işaretleri: iniş aracı nereye ineceğini YUKARIDAN görmeli. */
      for (const ex of [-1, 1]) for (const ey of [-1, 1]) {
        for (const [dx, dy] of [[1.4, 0.3], [0.3, 1.4]]) {
          const m2 = ekle(new THREE.Mesh(
            new THREE.BoxGeometry(dx, dy, sz * 0.6), M.kit.gold));
          m2.position.set(ex * (sx * 0.5 - dx * 0.5 - 0.5),
            ey * (sy * 0.5 - dy * 0.5 - 0.5), sz * 0.9);
          m2.castShadow = false;
        }
      }
      break;
    }
    case 'kutu': {
      ekle(new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat));
      const kpk = ekle(new THREE.Mesh(new THREE.BoxGeometry(sx * 0.72, sy * 0.06, sz * 0.62), M.koyu));
      kpk.position.y = -sy / 2;
      for (let i = 0; i < 4; i++) {
        const ay = ekle(new THREE.Mesh(cylGeoZ(sx * 0.04, sx * 0.04, sz * 0.3, 10), M.koyu));
        ay.position.set((i % 2 ? 1 : -1) * sx * 0.4, (i < 2 ? 1 : -1) * sy * 0.4, -sz * 0.62);
      }
      break;
    }
    case 'tank-dikey': {
      /* Ölçülen: çizilen tank z -1,06..2,99, beyan 0..3 - ayaklar pedin
         1,05 m ALTINA iniyordu. İki hata üst üsteydi: ayak `-sz*0.6`'ya
         konuyor ve `sz*0.5` uzunlukta çiziliyordu, üstelik basınç kabı zaten
         beyan edilen yüksekliğin TAMAMINI dolduruyordu, yani ayağa hiç yer
         yoktu. Kriyojenik bir tank ayaklarının üstünde durur ve ayakları
         zarfın içindedir. */
      const ayakPay = sz * 0.2;
      /* Kabin capi ayrica beyan edilir; `sx` sehpa dahil ayak izidir. */
      const r = (p.kapCapM ?? sx) / 2;
      /* Gövde boyu zarftan ARTAN kadardır. Eskiden `sz - sx` yazıyordu ve
         alt sınır konmadigi icin kap zarfi 0,36 m asiyordu; capi yuksekligine
         yakin bir tank zaten kuresel olur, silindirik govdesi kalmaz. */
      /* Yukseklik hesabi KABIN capindan gider, ayak izinden degil: `sx`
         artik sehpa dahil zarf ve onu kullanmak kabi 0,65 m havaya kaldirdi
         (kapi yakaladi). */
      const boy = Math.max(0, sz - ayakPay - 2 * r);
      const kapZ = -sz / 2 + ayakPay + r + boy / 2;
      if (boy > 0.05) {
        const t = ekle(new THREE.Mesh(cylGeoZ(r, r, boy, 30), mat));
        t.position.z = kapZ;
        t.material = mat.clone(); t.material.map = dok.zar; t.material.map.repeat.set(6, 3);
      }
      for (const s of [-1, 1]) {
        const k = ekle(new THREE.Mesh(new THREE.SphereGeometry(r, 26, 16, 0, TAU, 0, Math.PI / 2), mat));
        k.rotation.x = s > 0 ? 0 : Math.PI;
        k.position.z = kapZ + s * boy / 2;
      }
      /* Sehpa: dört düz silindir bir tankı taşımaz ve taşıyormuş gibi de
         görünmez. Ölçülen (düzeltme öncesi) ayaklar z 0..0,60'ta ve eksenden
         1,05 m'de duruyordu, tankın o yarıçaptaki yüzeyi ise 1,23'te —
         arada 0,63 m boşluk. Yük artık kabın EKVATORUNDAN, kuşak halkasıyla
         geçiyor ve çerçeve çapraz bağlı. */
      /* Sehpa kendi cercevesinde PED duzleminden kurulur (z = 0 ayak taban
         duzlemi); bu yuzden gruba pedin uzerine konur ve kusak yuksekligi
         de oradan olculur. Parca merkezinden vermek, sehpayi kabin icine
         kaldirir. */
      const sehpa = D.tankSehpasi(THREE, M.kit, r, kapZ + sz / 2, { n: 4 });
      sehpa.position.z = -sz / 2;
      g.add(sehpa);
      /* Dolum-boşaltım paneli ve akışkan künyesi: hangi tank ne taşıyor,
         gövdenin üstünden okunur. Kriyojenikte yanlış hat ölümcüldür. */
      const kp2 = D.konnektorPaneli(THREE, M.kit, r * 0.7, r * 0.5);
      kp2.position.set(0, -r * 1.02, sz * 0.05);
      kp2.rotation.x = Math.PI / 2;
      g.add(kp2);
      const akis = p.id.includes('o2') ? ['O2', 'CRYOGENIC'] : ['CH4', 'FLAMMABLE'];
      const lv2 = D.levha(THREE, M.kit, akis,
        { w: r * 0.85, h: r * 0.5, seritRenk: p.id.includes('o2') ? '#5aa86a' : '#c95a5a' });
      lv2.position.set(0, -r * 1.02, sz * 0.3);
      lv2.rotation.x = Math.PI / 2;
      g.add(lv2);
      for (let i = 0; i < 3; i++) {
        const ml2 = D.mliSeridi(THREE, M.kit, r * 1.5, { n: 4 });
        ml2.position.set(0, 0, (i - 1) * sz * 0.26);
        ml2.rotation.z = i * 1.1;
        g.add(ml2);
      }
      break;
    }
    case 'panel-tarla': {
      /* eğik paneller: toz kayması için. Ay'da dik durur (ortam kuralı). */
      const sira = 3;
      for (let i = 0; i < sira; i++) {
        const pan = ekle(new THREE.Mesh(new THREE.BoxGeometry(sx, sy / sira * 0.82, 0.05), mat));
        pan.material = new THREE.MeshStandardMaterial({ map: dok.hucre, roughness: .3, metalness: .5 });
        pan.material.map.repeat.set(3, 1);
        pan.position.set(0, (i - (sira - 1) / 2) * sy / sira, sz * 0.5);
        /* Egim isareti aynalanmisti. Sahnenin gunesi HER IKI ortamda da
           negatif Y'de - Mars (18, -16, 17), Ay (-8, -8, 9) - ve -32 derece
           hucre yuzunu +Y'ye cevirdigi icin paneller gunesten UZAGA bakiyordu.
           Olculen kosinus 0,201; ayni paneli hic egmesen 0,577, dogru yone
           egsen 0,777. Yani egim, egmemekten %65 daha kotuydu; aynalanmis bir
           isaretin tanimi budur. Satirin egim gerekcesi toz atmak ve gunese
           dogru egmek tozu da ayni sekilde atar. */
        pan.rotation.x = PANEL_EGIM_DEG * Math.PI / 180;
        const dir = ekle(new THREE.Mesh(cylGeoZ(0.05, 0.05, sz, 8), M.koyu));
        dir.position.set(0, pan.position.y, 0);
      }
      /* Dizi kablosu tavada toplanır: yerde sürünen kablo toza gömülür. */
      const tv = D.kabloTavasi(THREE, M.kit, sy * 0.92, { kablo: 2 });
      tv.position.set(-sx * 0.42, 0, 0.1);
      tv.rotation.z = Math.PI / 2;
      g.add(tv);
      break;
    }
    case 'radyator': {
      /* Kanat sayısı künyeden okunur: bütçe ile çizim aynı sayıyı kullanır. */
      const n = p.tech?.kanat ?? 2;
      for (let i = 0; i < n; i++) {
        const k = ekle(new THREE.Mesh(new THREE.BoxGeometry(sx, 0.03, sz), mat));
        k.position.y = (i / (n - 1) - 0.5) * sy * 4;
      }
      const t = ekle(new THREE.Mesh(cylGeoX(0.06, 0.06, sx * 1.02, 10), M.koyu));
      t.position.z = -sz / 2;
      /* Dönüş hattı ve künye: akışkan amonyak, dokunma sınırı yazılı. */
      const t2 = ekle(new THREE.Mesh(cylGeoX(0.045, 0.045, sx * 1.02, 10), M.koyu));
      t2.position.set(0, 0.09, -sz / 2);
      const lv3 = D.levha(THREE, M.kit, ['NH3 COOLANT', 'do not touch'],
        { w: 0.58, h: 0.28, seritRenk: '#d68a4a' });
      lv3.position.set(sx * 0.32, 0.12, -sz * 0.3);
      lv3.rotation.x = Math.PI / 2;
      g.add(lv3);
      break;
    }
    case 'semsiye': {
      const n = 8;
      /* An umbrella slopes outward and DOWN: the outer end of every petal
         sits lower than its root, by the same amount all the way round. The
         old pair of assignments composed as Ry(-14)*Rz(a), which tilts every
         petal about the same WORLD axis - measured, the outer end rose 0.242
         at i=0, 0.171 at i=1 and 0.000 at i=2, so the cone flattened as it
         went round and the thing was only an umbrella at one petal in eight.
         Tilt first about the petal's own tangential axis, THEN carry it round.
         The sign matters and it is the name that fixes it: -14 lifted the
         outer end, which is a bowl. */
      const egim = 14 * Math.PI / 180;
      for (let i = 0; i < n; i++) {
        const a = i * TAU / n;
        const dilim = ekle(new THREE.Mesh(new THREE.BoxGeometry(sx * 0.46, sx * 0.17, 0.03), mat));
        dilim.position.set(Math.cos(a) * sx * 0.27, Math.sin(a) * sx * 0.27, 0);
        dilim.rotation.set(0, egim, 0);
        dilim.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), a);
      }
      ekle(new THREE.Mesh(cylGeoZ(sx * 0.07, sx * 0.07, sz * 2, 12), M.koyu));
      break;
    }
    case 'reaktor': {
      const r = sx / 2;
      ekle(new THREE.Mesh(cylGeoZ(r * 0.62, r * 0.62, sz * 0.72, 22), mat));
      /* gölge kalkanı: üsse bakan yüzde konik, doz mesafeyle değil kalkanla düşer */
      const kal = ekle(new THREE.Mesh(coneGeoZ(r, sz * 0.36, 22), M.koyu));
      kal.position.z = -sz * 0.4;
      for (let i = 0; i < 6; i++) {
        const a = i * TAU / 6;
        const bor = ekle(new THREE.Mesh(cylGeoZ(r * 0.05, r * 0.05, sz * 0.8, 8), M.isil));
        bor.position.set(Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72, sz * 0.1);
      }
      /* Radyasyon ikazı dört yüzde: hangi yönden gelinirse gelinsin okunur. */
      for (let i = 0; i < 4; i++) {
        const a = i * TAU / 4;
        /* Levhadaki sayı da katalogdan gelir: bir uyarı levhasının, uyardığı
           şeyin kendi beyanından farklı bir rakam yazması mümkün olmamalı. */
        const ik = D.levha(THREE, M.kit, ['RADIATION', `${p.yasakYaricapM ?? 14} m approach limit`],
          { w: r * 0.8, h: r * 0.42, seritRenk: '#d6a24a', zemin: '#e0cf9a' });
        ik.position.set(Math.cos(a) * r * 0.64, Math.sin(a) * r * 0.64, sz * 0.05);
        /* The comment above is the specification: readable from whichever side
           you walk up. It was not true. The Z term went in first, so all four
           placards faced -Y - measured 90 deg off radial on two of them, and
           the two that read at all were the ones that happened to line up. A
           placard's face is +Z and its text runs up +Y, so the basis is
           tangent / world up / outward, and there is no order left to get
           wrong. */
        ik.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
          new THREE.Vector3(-Math.sin(a), Math.cos(a), 0),
          new THREE.Vector3(0, 0, 1),
          new THREE.Vector3(Math.cos(a), Math.sin(a), 0)));
        g.add(ik);
      }
      const fr = D.fener(THREE, M.kit, { renk: 0xff5a3c });
      fr.position.z = sz * 0.42;
      g.add(fr);
      break;
    }
    case 'direk': {
      ekle(new THREE.Mesh(cylGeoZ(sx * 0.34, sx * 0.5, sz, 10), mat));
      /* Base flange and its hold-down bolts: the mast is the tallest thing
         on the site and everything it carries lands here. */
      const taban = ekle(new THREE.Mesh(cylGeoZ(sx * 0.95, sx * 0.95, sz * 0.02, 16), M.metal));
      taban.position.z = -sz / 2;
      for (let i = 0; i < 6; i++) {
        const a = i * TAU / 6;
        const civ = ekle(new THREE.Mesh(cylGeoZ(sx * 0.07, sx * 0.07, sz * 0.03, 6), M.koyu));
        civ.position.set(Math.cos(a) * sx * 0.72, Math.sin(a) * sx * 0.72, -sz / 2 + sz * 0.012);
      }
      /* Guys run from near the top to anchors ON THE GROUND. They used to
         be short stubs near the base, placed with rotation.set(sin, -cos, 0)
         - which composes Z first and does not aim at anything. Built from
         the two endpoints instead, so they land where the anchor is. */
      const tepe = new THREE.Vector3(0, 0, sz * 0.38);
      for (let i = 0; i < 3; i++) {
        const a = i * TAU / 3;
        const ankraj = new THREE.Vector3(Math.cos(a) * sz * 0.42, Math.sin(a) * sz * 0.42, -sz / 2);
        const boy = tepe.distanceTo(ankraj);
        const ger = ekle(new THREE.Mesh(cylGeoZ(0.012, 0.012, boy, 5), M.koyu));
        ger.position.copy(tepe).add(ankraj).multiplyScalar(0.5);
        ger.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1),
          ankraj.clone().sub(tepe).normalize());
        /* The anchor itself: a plate pinned into the regolith. */
        const pl = ekle(new THREE.Mesh(new THREE.BoxGeometry(sx * 0.6, sx * 0.6, sz * 0.015), M.metal));
        pl.position.copy(ankraj);
        pl.position.z += sz * 0.008;
      }
      break;
    }
    case 'canak': {
      /* A dish is drawn AIMED, and its envelope is the sphere it sweeps.
         Two errors were measured here, one hiding behind the other. The
         boresight sat at 90 deg elevation - straight up - while the row says
         the thing tracks Earth. And the reflector was a cap around three's +Y
         pole turned by Rx(PI), which only moves the pole to -Y: the bowl
         opened sideways while the rim, ribs, feed and tripod were all built
         around +Z. On the live scene the assembly's furthest point measured
         2.36 m from the gimbal for a dish of 1.2 m radius, and its local box
         ran y -1.80..1.25 against z -0.45..1.94.
         Everything below hangs off canakGeo(), which the gate imports too, so
         the declared envelope and the drawn one cannot drift apart. */
      const nis = p.nis || { cap: sx, azimut: 0, yukseklik: 90, enAz: 90 };
      const G = canakGeo(nis.cap ?? sx);
      const r = G.r;
      const az = nis.azimut * Math.PI / 180;
      const yuk = nis.yukseklik * Math.PI / 180;
      /* Azimuth 0 is +Y and runs clockwise; elevation is from the horizon. */
      const bore = new THREE.Vector3(Math.sin(az) * Math.cos(yuk),
        Math.cos(az) * Math.cos(yuk), Math.sin(yuk));
      /* Elevation axis: horizontal, square across the line of sight. The
         gimbal ring is drawn about THIS, so the mount reads the angle the
         dish is actually at instead of a ring fixed at 90 deg. */
      const yukEkseni = new THREE.Vector3(Math.cos(az), -Math.sin(az), 0);

      /* Everything that moves hangs off the elevation axis, which is the part
         centre; everything that holds it up stays on the part group. */
      const tabak = new THREE.Group();
      tabak.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), bore);
      g.add(tabak);
      const ekleT = (m) => { m.castShadow = true; m.receiveShadow = true; tabak.add(m); return m; };

      /* Reflector: a spherical cap, concave toward the boresight. The sphere
         centre sits one radius BEYOND the vertex, so the surface we want is
         the cap nearest the origin - the one around the sphere's -Z pole.
         three caps around +Y, and it is Rx(-90 deg) that takes +Y to -Z;
         Rx(+90 deg) caps the far side instead and puts the reflector 3.72 m
         out, which is how this was measured wrong the first time. */
      const kapMat = mat.clone();
      kapMat.side = THREE.DoubleSide;
      const c = ekleT(new THREE.Mesh(
        new THREE.SphereGeometry(G.R, 30, 16, 0, TAU, 0, G.alfa), kapMat));
      c.rotation.x = -Math.PI / 2;
      c.position.z = G.vTepe + G.R;
      /* Rim. A dish without one is a bowl: the edge is a rolled stiffener
         and it is the part that survives being leaned on. */
      const kenar = ekleT(new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.045, 8, 36), M.metal));
      kenar.position.z = G.kenarZ;
      /* Back ribs: a thin reflector holds its shape because of these, and
         they are what you actually see from behind. */
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 6;
        const rib = ekleT(new THREE.Mesh(new THREE.BoxGeometry(r * 1.9, r * 0.05, r * 0.11), M.koyu));
        rib.position.z = G.vTepe + G.sehim * 0.35;
        rib.rotation.z = a;
      }
      /* Feed at the FOCUS, on a tripod rather than a floating stalk. A
         spherical mirror focuses at R/2, so that is where it goes. */
      const alici = ekleT(new THREE.Mesh(cylGeoZ(r * 0.13, r * 0.09, G.besleBoy, 12), M.koyu));
      alici.position.z = G.odak;
      for (let i = 0; i < 3; i++) {
        const a = i * TAU / 3;
        const p0 = new THREE.Vector3(Math.cos(a) * r * 0.86,
          Math.sin(a) * r * 0.86, G.vTepe + G.sehim * 0.8);
        const p1 = new THREE.Vector3(0, 0, G.odak - G.besleBoy / 2);
        const len = p0.distanceTo(p1);
        const ayak = ekleT(new THREE.Mesh(cylGeoZ(r * 0.022, r * 0.022, len, 6), M.metal));
        ayak.position.copy(p0).add(p1).multiplyScalar(0.5);
        ayak.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1),
          p1.clone().sub(p0).normalize());
      }

      /* The yoke: it lifts the elevation axis clear of the mast head, which
         is the only reason the dish can be pointed at all. */
      const yokeBoy = sz / 2;
      const boyun = ekle(new THREE.Mesh(cylGeoZ(r * 0.11, r * 0.14, yokeBoy, 14), M.metal));
      boyun.position.z = -sz / 2 + yokeBoy / 2;
      /* Trunnion arms straddle the elevation axis, so they lie ALONG it. */
      for (const ex of [-1, 1]) {
        const kol = ekle(new THREE.Mesh(new THREE.BoxGeometry(r * 0.07, r * 0.07, r * 0.34), M.metal));
        kol.position.set(yukEkseni.x * ex * r * 0.2, yukEkseni.y * ex * r * 0.2, -r * 0.15);
      }
      const kardan = ekle(new THREE.Mesh(new THREE.TorusGeometry(r * 0.17, r * 0.04, 6, 18), M.koyu));
      kardan.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), yukEkseni);
      /* Azimuth bearing at the mast head: the other of the two axes. */
      const yatak = ekle(new THREE.Mesh(cylGeoZ(r * 0.2, r * 0.2, r * 0.1, 16), M.koyu));
      yatak.position.z = -sz / 2 + r * 0.05;
      break;
    }
    case 'ruzgar': {
      for (let i = 0; i < 3; i++) {
        const a = i * TAU / 3;
        const kol = ekle(new THREE.Mesh(cylGeoX(0.008, 0.008, sx * 0.46, 6), mat));
        kol.position.set(Math.cos(a) * sx * 0.23, Math.sin(a) * sx * 0.23, 0);
        kol.rotation.z = a;
        const kup = ekle(new THREE.Mesh(new THREE.SphereGeometry(sx * 0.1, 12, 8, 0, TAU, 0, Math.PI / 2), mat));
        kup.position.set(Math.cos(a) * sx * 0.46, Math.sin(a) * sx * 0.46, 0);
        kup.rotation.x = Math.PI / 2; kup.rotation.z = a;
      }
      ekle(new THREE.Mesh(cylGeoZ(0.014, 0.014, sz, 8), M.koyu));
      break;
    }
    case 'tente': {
      /* kapalı değil: dört ayak, gergili örtü, altta şarj kablosu */
      /* Ayaklar duz silindirdi. Bir kolonun nereden tutundugu ve neyi
         tasidigi tabanindan ve basligindan okunur; kanopi dort kolonun
         basligina oturur. */
      for (let i = 0; i < 4; i++) {
        const kol = D.tasiyiciKolon(THREE, M.kit, sz, 0.075, { guse: 4, civata: 4 });
        kol.position.set((i % 2 ? 1 : -1) * sx * 0.44, (i < 2 ? 1 : -1) * sy * 0.44, -sz / 2);
        g.add(kol);
      }
      const ort = ekle(new THREE.Mesh(new THREE.BoxGeometry(sx, sy, 0.05), M.gecis));
      ort.position.z = sz * 0.5;
      ort.rotation.y = 5 * Math.PI / 180;
      for (let i = 0; i < 5; i++) {
        const kir = ekle(new THREE.Mesh(cylGeoX(0.03, 0.03, sx, 6), M.koyu));
        kir.position.set(0, (i / 4 - 0.5) * sy * 0.9, sz * 0.5 - 0.05);
      }
      /* Şarj kablosu tentenin altından gelir; ayaklar pabuçlu. */
      const tv2 = D.kabloTavasi(THREE, M.kit, sx * 0.8, { kablo: 2 });
      tv2.position.set(0, sy * 0.4, 0.06);
      g.add(tv2);
      for (let i = 0; i < 4; i++) {
        const pb2 = D.ayakPabucu(THREE, M.kit, 0.2, { regolitMat: M.regolit });
        pb2.position.set((i % 2 ? 1 : -1) * sx * 0.44, (i < 2 ? 1 : -1) * sy * 0.44, -sz * 0.5);
        g.add(pb2);
      }
      const ft = D.fener(THREE, M.kit);
      ft.position.set(0, -sy * 0.44, sz * 0.52);
      g.add(ft);
      break;
    }
    case 'hat': {
      /* The run used to be built only by the showcase page, so in the
         exploded view these two parts were EMPTY groups: they got a label
         and a leader pointing at nothing. The hardware gate caught it
         (0 meshes). The geometry now comes from the same routing solver the
         page uses, so the line exists wherever the part does. */
      const uc = runEndpoints(p.id);
      if (!uc) break;
      const plan = planRun(uc.a, uc.b, {
        akiskan: uc.akiskan, env: 'mars', odM: uc.odM, wallM: uc.wallM, malzeme: uc.malzeme,
      });
      const run = buildRun(THREE, plan);
      /* The catalogue places the part at its own centre, but planRun works
         in site coordinates, so the run is shifted back onto the origin. */
      run.position.set(-p.pos[0], -p.pos[1], -p.pos[2]);
      g.add(run);
      break;
    }
    default:
      ekle(new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat));
  }
  return g;
}

/**
 * Bütün üssü kurar.
 * Dönen: { root, nodes: Map(id → Object3D), reddedilen }
 * `nodes` doğrudan `core/exploded-view.mjs`'e verilebilir — patlatma
 * için ek bir adım gerekmez.
 */
/* Üssün ÇEVRESİ: pedin bittiği yerde dünya bitmez.
 *
 * Sahne arkaplanı tek düz bir renkti ve zemin 54x44 m'lik pedden ibaretti,
 * yani üs bir gezegen yüzeyinde değil bir masanın üstünde duruyordu. Buradaki
 * her şey ORTAMA bağlıdır: Ay'da grade edilecek atmosfer ve içinde
 * kaybolunacak pus yoktur, o yüzden Ay'da ufuk keskin ve gök siyahtır.
 *
 * Kayalar pedin DIŞINA dağılır - üssün içine kaya düşmesi, üstünde durduğu
 * hazırlanmış alanın ne olduğunu anlamamak demektir.
 */
export function buildCevre(THREE, { env = 'mars', ped = null, yaricap = 170, tohum = 7 } = {}) {
  /* Ped ölçüsü KATALOGDAN gelir. `[54, 44]` diye elle yazılmış bir varsayılan,
     ped büyüdüğünde çevreyi eski ölçüde bırakıyordu: hazırlanmış alan ile
     onu çevreleyen araziyi iki ayrı sayı anlatamaz. */
  if (!ped) { const pf = partById('platform'); ped = [pf.size[0], pf.size[1]]; }
  const g = new THREE.Group();
  g.userData.notes = { regime: `${env} çevresi`,
    why: 'Pedin dışı da yüzeydir; üssün ölçeği ancak çevresine göre okunur.' };
  const mars = env === 'mars';
  /* Deterministik dağılım: aynı sahne her açılışta aynı görünmeli. */
  let t = tohum;
  const rnd = () => (t = (t * 1664525 + 1013904223) % 4294967296) / 4294967296;

  const zeminRenk = mars ? 0x8a5638 : 0x5f5f63;
  const zemin = new THREE.Mesh(
    new THREE.CircleGeometry(yaricap, 96),
    new THREE.MeshStandardMaterial({ color: zeminRenk, roughness: 0.98, metalness: 0.02 }));
  /* Hafif kabarıklık: kusursuz düzlük bir yüzeye değil, bir zemine benzer. */
  const pz = zemin.geometry.attributes.position;
  for (let i = 0; i < pz.count; i++) {
    const x = pz.getX(i), y = pz.getY(i);
    const d = Math.hypot(x, y);
    const h = d < 30 ? 0 : Math.sin(x * 0.07) * Math.cos(y * 0.061) * Math.min(1, (d - 30) / 40) * 1.5;
    pz.setZ(i, h - 0.02);
  }
  pz.needsUpdate = true;
  zemin.geometry.computeVertexNormals();
  zemin.receiveShadow = true;
  g.add(zemin);

  /* Kaya dağılımı. Pedin köşegeninin dışında başlar. */
  const disR = Math.hypot(ped[0], ped[1]) / 2 + 6;
  const kayaMat = new THREE.MeshStandardMaterial({ color: mars ? 0x6d4530 : 0x4c4c50,
    roughness: 0.95, metalness: 0.03 });
  const kayaGeo = new THREE.IcosahedronGeometry(1, 0);
  const n = 260;
  const kaya = new THREE.InstancedMesh(kayaGeo, kayaMat, n);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(),
    kon = new THREE.Vector3(), olc = new THREE.Vector3(), e = new THREE.Euler();
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const r = disR + Math.pow(rnd(), 0.65) * (yaricap - disR - 8);
    const s2 = 0.25 + Math.pow(rnd(), 2.6) * 2.6;
    kon.set(Math.cos(a) * r, Math.sin(a) * r, s2 * 0.28);
    e.set(rnd() * 3.14, rnd() * 3.14, rnd() * 3.14);
    q.setFromEuler(e);
    olc.set(s2 * (0.8 + rnd() * 0.6), s2 * (0.8 + rnd() * 0.6), s2 * 0.62);
    kaya.setMatrixAt(i, m4.compose(kon, q, olc));
  }
  kaya.castShadow = true; kaya.receiveShadow = true;
  g.add(kaya);

  /* Gök: Mars'ta dereceli, Ay'da siyah. Doku 2 piksel geniştir - gradyan
     dikeydir ve yatayda bilgi yoktur. */
  const c = document.createElement('canvas');
  c.width = 2; c.height = 256;
  const ctx = c.getContext('2d');
  const gr = ctx.createLinearGradient(0, 0, 0, 256);
  if (mars) {
    gr.addColorStop(0, '#20160f');    // zenit
    gr.addColorStop(0.55, '#6b452c');
    gr.addColorStop(0.82, '#b4794a');  // ufuk pusu
    gr.addColorStop(1, '#c98f5c');
  } else {
    gr.addColorStop(0, '#01010a');
    gr.addColorStop(0.9, '#05060c');
    gr.addColorStop(1, '#0b0d14');
  }
  ctx.fillStyle = gr; ctx.fillRect(0, 0, 2, 256);
  const dokuGok = new THREE.CanvasTexture(c);
  dokuGok.colorSpace = THREE.SRGBColorSpace;
  const gok = new THREE.Mesh(
    new THREE.SphereGeometry(yaricap * 2.4, 32, 24),
    new THREE.MeshBasicMaterial({ map: dokuGok, side: THREE.BackSide, depthWrite: false, fog: false }));
  /* Küre +Y kutuplu kurulur; gövde çerçevesi +Z yukarıdır. Tek eksende
     çeyrek tur, sıra tuzağı yok. */
  gok.rotation.x = Math.PI / 2;
  g.add(gok);

  return { group: g, zemin, kaya, gok, ufukRengi: mars ? 0xb4794a : 0x05060c };
}

export function buildHabitat(THREE, { env = 'mars', tema = {} } = {}) {
  /* The ground is painted with the albedo the lighting reflects off, so the
     two cannot disagree: 0.13 and nearly neutral on the Moon, 0.25 and
     strongly red on Mars. Before this both bodies were the same brown. */
  const yerRGB = yuzeyAlbedoRGB(env === 'moon' ? 'vacuum' : 'mars');
  const M = habMaterials(THREE, {
    regolit: new THREE.Color(yerRGB[0], yerRGB[1], yerRGB[2]).getHex(), ...tema,
  });
  const dok = { zar: zarDokusu(THREE), hucre: hucreDokusu(THREE), regolit: D.regolitKabartma(THREE) };
  const root = new THREE.Group();
  root.name = 'habitat';
  const nodes = new Map();
  const reddedilen = [];

  for (const p of PARTS) {
    const izin = envAllows(p.id, env);
    if (!izin.ok) { reddedilen.push({ id: p.id, neden: izin.neden, oneri: izin.oneri }); continue; }
    const g = govde(THREE, p, M, dok, env);
    g.name = p.id;
    g.position.set(p.pos[0], p.pos[1], p.pos[2]);
    g.userData.partId = p.id;
    g.traverse(o => { o.userData.partId = p.id; });
    g.userData.notes = { regime: `${env} yüzeyi`, why: p.why };
    nodes.set(p.id, g);
    root.add(g);
  }

  /* Çoklu bileşenler (qty) katalogdaki tek gövdenin kopyalarıdır; temel
     plakaları ve panel sıraları tek tek beyan edilmez, dizilir. */
  /* Desen artık KATALOGDA. Burada yazılıyken `size` tek bir birimi
     anlatıyordu, çizim ise dizinin tamamını: panel tarlası 5,0 m beyan edip
     23,6 m'ye yayılıyordu ve `size` okuyan hiçbir kapı bunu göremiyordu. */
  for (const q of PARTS) {
    const d = q.dizilim;
    if (!d) continue;
    const id = q.id;
    const temel = nodes.get(id);
    if (!temel) continue;
    /* Dizinin zarfı beyan edilen `size` olduğu için, tek birimin gövdesi
       zarfın BAŞINDAN başlar: yoksa dizi beyan edilen kutunun dışına taşar. */
    const bas = d.yay === 'halka' ? [0, 0, 0]
      : [-(d.adim[0] * (d.n - 1)) / 2, -(d.adim[1] * (d.n - 1)) / 2, -(d.adim[2] * (d.n - 1)) / 2];
    temel.position.set(q.pos[0] + bas[0], q.pos[1] + bas[1], q.pos[2] + bas[2]);
    /* Kopya, HIC KOPYA EKLENMEMIS hâlden alınır. Döngü `temel.clone(true)`
       diyordu ve her turda temel'e bir kopya eklendiği için sonraki klonlar
       öncekileri de içine alıyordu: kopyalar iç içe giriyor ve ötelemeler
       üst üste biniyordu. Ölçülen sonuç - panel tarlası beyan edilen
       x [-18,8, -13,8] yerine x [18,4, 23,4]'te, yani sahanın tam öbür
       ucunda ve reaktörün üstünde, 112 alt-mesh'e şişmiş hâlde. Aynı döngü
       temel plakalarını 6,4 m, radyatör dizisini 3,1 m kaydırıyordu. */
    const taban = temel.clone(true);
    for (let i = 1; i < d.n; i++) {
      const k = taban.clone(true);
      if (d.yay === 'halka') {
        const a = i * TAU / d.n;
        k.position.set(temel.position.x + Math.cos(a) * d.r, temel.position.y + Math.sin(a) * d.r, temel.position.z);
      } else {
        k.position.set(temel.position.x + d.adim[0] * i, temel.position.y + d.adim[1] * i, temel.position.z + d.adim[2] * i);
      }
      /* Kopya ana gövdenin ALTINA girer: patlatma parçayı tek düğüm
         olarak taşır, dizinin altı dağılmaz. Konum bu yüzden ana
         gövdeye görelidir. */
      k.position.sub(temel.position);
      temel.add(k);
    }
  }

  root.userData.rig = {
    kind: 'habitat', units: 'design', scaleToRoot: 1,
    joints: [], contacts: ['platform'], massClass: 'yuzey-ussu',
  };
  root.userData.notes = { regime: `${env} yüzeyi`,
    why: 'Üs adım adım kurulur: zemin, basınçlı çekirdek, geçişler, hacim, güç, ısıl/ISRU, hatlar. Her bileşen bir öncekine dayanır.' };
  return { root, nodes, reddedilen, materials: M, textures: dok };
}

export { PARTS, SUBSYSTEMS, partById };
