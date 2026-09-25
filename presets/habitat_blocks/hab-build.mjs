/* hab-build.mjs — habitat kataloğunu GÖVDEYE çevirir.
 *
 * sat-build.mjs ile aynı sözleşme: tek bir ölçü elle yazılmaz, her şey
 * katalogdaki `sekil`, `size`, `pos` alanlarından çıkar. Katalog
 * değişirse model de değişir; kütle bütçesiyle çizim ayrışamaz.
 *
 * Eksen sözleşmesi: çıplak CylinderGeometry/ConeGeometry yok —
 * `core/geometry-axis.mjs`. Saha koordinatı +Z yukarı.
 */

import { PARTS, SUBSYSTEMS, partById, envAllows } from './hab-parts.mjs';
import { cylGeoZ, cylGeoX, coneGeoZ, latheX } from '../core/geometry-axis.mjs';
import * as D from './hab-detail.mjs';

const TAU = Math.PI * 2;

export function habMaterials(THREE, tk = {}) {
  const std = (c, r, m, ek = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...ek });
  /* Ayrıntı kiti kendi malzeme ailesini getirir: korkuluk sarısı, conta
     siyahı, cam ve bakır üs boyunca AYNI olsun diye tek yerde kurulur. */
  const kit = D.detailMaterials(THREE);
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
    regolit: std(0x6b5a48, .96, .02),
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
function govde(THREE, p, M, dok) {
  const [sx, sy, sz] = p.size;
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
      /* yürüyüş yolu: sıkıştırılmış şeritler zemini okunur kılar */
      for (const [ox, oy, w, h] of [[0, 0, sx * 0.72, 1.4], [3.2, 0, 1.4, sy * 0.66]]) {
        const y = ekle(new THREE.Mesh(new THREE.BoxGeometry(w, h, sz * 0.4),
          new THREE.MeshStandardMaterial({ color: 0x7d6b56, roughness: .98, metalness: .02 })));
        y.position.set(ox, oy, sz * 0.5); y.castShadow = false;
      }
      break;
    }
    case 'plaka': {
      ekle(new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat));
      const pabuc = D.ayakPabucu(THREE, M.kit, sx * 0.34, { regolitMat: M.regolit });
      pabuc.position.z = sz * 0.5;
      g.add(pabuc);
      /* regolit vidası: plakayı zemine bağlayan tek şey */
      for (let i = 0; i < 4; i++) {
        const a = i * TAU / 4 + Math.PI / 4;
        const vida = ekle(new THREE.Mesh(cylGeoZ(sx * 0.05, sx * 0.05, sz * 3.2, 8), M.koyu));
        vida.position.set(Math.cos(a) * sx * 0.36, Math.sin(a) * sx * 0.36, -sz * 0.9);
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
      const ikaz = D.levha(THREE, M.kit, ['BASINÇLI HACİM', 'boşaltmadan açma'],
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
      const r = sy / 2;
      /* iki rijit uç + ortada körük: ısıl genleşmeyi ve oturmayı yutar */
      for (const s of [-1, 1]) {
        const u = ekle(new THREE.Mesh(cylGeoX(r, r, sx * 0.3, 26), mat));
        u.position.x = s * sx * 0.35;
      }
      const n = 7, boy = sx * 0.4;
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n - 0.5;
        const k = ekle(new THREE.Mesh(new THREE.TorusGeometry(r * 1.06, r * 0.13, 7, 26), M.koyu));
        k.position.x = t * boy; k.rotation.y = Math.PI / 2;
      }
      const ic = ekle(new THREE.Mesh(cylGeoX(r * 0.92, r * 0.92, boy, 24), M.koyu));
      ic.position.x = 0;
      /* Tünelin üstünden de yürünür: iki yanda korkuluk. */
      for (const yan of [-1, 1]) {
        const kork = D.korkuluk(THREE, M.kit, sx * 0.86);
        kork.position.set(0, yan * r * 0.5, r * 0.84);
        kork.rotation.x = yan * 0.55;
        g.add(kork);
      }
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
        serit.rotation.set(Math.PI / 2, 0, a + Math.PI / 2);
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
      const lv4 = D.levha(THREE, M.kit, [p.tech?.no || p.id, 'ŞİŞME HACİM'], { w: R * 0.5, h: R * 0.24 });
      lv4.position.set(0, -R * 0.46, sz * 0.5);
      lv4.rotation.x = Math.PI / 2;
      g.add(lv4);
      break;
    }
    case 'ortu': {
      /* regolit örtüsü: yarım silindir kabuk, yüzeyi kırık */
      const r = sy / 2;
      /* Yarım kabuk kısmi lathe ile kurulur. Çıplak CylinderGeometry'nin
         thetaLength'i burada işe yarardı ama eksen sözleşmesi çıplak
         silindiri yasaklar; latheX zaten kısmi tur alıyor. */
      const profil = [new THREE.Vector2(r, -sx / 2), new THREE.Vector2(r, sx / 2)];
      const m = ekle(latheX(profil, 26, M.regolit, 0, Math.PI));
      m.position.z = -sz * 0.34;
      m.castShadow = false;
      for (let i = 0; i < 26; i++) {
        const a = Math.PI * (i + 0.5) / 26;
        const yig = ekle(new THREE.Mesh(new THREE.SphereGeometry(r * 0.1, 7, 5), M.regolit));
        yig.position.set((i % 7 - 3) * sx * 0.14, Math.cos(a) * r * 0.96, -sz * 0.34 + Math.sin(a) * r * 0.96);
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
      const r = sx / 2, boy = sz - sx;
      const t = ekle(new THREE.Mesh(cylGeoZ(r, r, boy, 30), mat));
      t.material = mat.clone(); t.material.map = dok.zar; t.material.map.repeat.set(6, 3);
      for (const s of [-1, 1]) {
        const k = ekle(new THREE.Mesh(new THREE.SphereGeometry(r, 26, 16, 0, TAU, 0, Math.PI / 2), mat));
        k.rotation.x = s > 0 ? 0 : Math.PI;
        k.position.z = s * boy / 2;
      }
      for (let i = 0; i < 4; i++) {
        const a = i * TAU / 4;
        const bac = ekle(new THREE.Mesh(cylGeoZ(r * 0.06, r * 0.06, sz * 0.5, 10), M.koyu));
        bac.position.set(Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82, -sz * 0.6);
        const pb = D.ayakPabucu(THREE, M.kit, r * 0.2, { regolitMat: M.regolit });
        pb.position.set(Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82, -sz * 0.85);
        g.add(pb);
      }
      /* Dolum-boşaltım paneli ve akışkan künyesi: hangi tank ne taşıyor,
         gövdenin üstünden okunur. Kriyojenikte yanlış hat ölümcüldür. */
      const kp2 = D.konnektorPaneli(THREE, M.kit, r * 0.7, r * 0.5);
      kp2.position.set(0, -r * 1.02, sz * 0.05);
      kp2.rotation.x = Math.PI / 2;
      g.add(kp2);
      const akis = p.id.includes('o2') ? ['O₂', 'KRİYOJENİK'] : ['CH₄', 'YANICI'];
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
        pan.rotation.x = -32 * Math.PI / 180;
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
      const lv3 = D.levha(THREE, M.kit, ['NH₃ SOĞUTUCU', 'dokunma'],
        { w: 0.58, h: 0.28, seritRenk: '#d68a4a' });
      lv3.position.set(sx * 0.32, 0.12, -sz * 0.3);
      lv3.rotation.x = Math.PI / 2;
      g.add(lv3);
      break;
    }
    case 'semsiye': {
      const n = 8;
      for (let i = 0; i < n; i++) {
        const a = i * TAU / n;
        const dilim = ekle(new THREE.Mesh(new THREE.BoxGeometry(sx * 0.46, sx * 0.17, 0.03), mat));
        dilim.position.set(Math.cos(a) * sx * 0.27, Math.sin(a) * sx * 0.27, 0);
        dilim.rotation.z = a;
        dilim.rotation.y = -14 * Math.PI / 180;
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
        const ik = D.levha(THREE, M.kit, ['RADYASYON', '14 m yaklaşma sınırı'],
          { w: r * 0.8, h: r * 0.42, seritRenk: '#d6a24a', zemin: '#e0cf9a' });
        ik.position.set(Math.cos(a) * r * 0.64, Math.sin(a) * r * 0.64, sz * 0.05);
        ik.rotation.set(Math.PI / 2, 0, a + Math.PI / 2);
        g.add(ik);
      }
      const fr = D.fener(THREE, M.kit, { renk: 0xff5a3c });
      fr.position.z = sz * 0.42;
      g.add(fr);
      break;
    }
    case 'direk': {
      ekle(new THREE.Mesh(cylGeoZ(sx * 0.34, sx * 0.5, sz, 10), mat));
      for (let i = 0; i < 3; i++) {
        const a = i * TAU / 3;
        const ger = ekle(new THREE.Mesh(cylGeoZ(0.012, 0.012, sz * 0.92, 5), M.koyu));
        ger.position.set(Math.cos(a) * sz * 0.16, Math.sin(a) * sz * 0.16, -sz * 0.04);
        ger.rotation.set(Math.sin(a) * 0.32, -Math.cos(a) * 0.32, 0);
      }
      break;
    }
    case 'canak': {
      const r = sx / 2;
      const c = ekle(new THREE.Mesh(
        new THREE.SphereGeometry(r * 1.5, 30, 16, 0, TAU, 0, Math.asin(r / (r * 1.5))), mat));
      c.rotation.x = Math.PI;
      c.position.z = r * 0.62;
      const bes = ekle(new THREE.Mesh(cylGeoZ(r * 0.09, r * 0.09, r * 0.62, 10), M.koyu));
      const alici = ekle(new THREE.Mesh(cylGeoZ(r * 0.13, r * 0.09, r * 0.24, 12), M.koyu));
      alici.position.z = r * 0.7;
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
      for (let i = 0; i < 4; i++) {
        const bac = ekle(new THREE.Mesh(cylGeoZ(0.06, 0.08, sz, 8), mat));
        bac.position.set((i % 2 ? 1 : -1) * sx * 0.44, (i < 2 ? 1 : -1) * sy * 0.44, 0);
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
    case 'hat':
      /* Hatlar routing.mjs tarafından kurulur; burada yer tutucu yok. */
      break;
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
export function buildHabitat(THREE, { env = 'mars', tema = {} } = {}) {
  const M = habMaterials(THREE, tema);
  const dok = { zar: zarDokusu(THREE), hucre: hucreDokusu(THREE), regolit: D.regolitKabartma(THREE) };
  const root = new THREE.Group();
  root.name = 'habitat';
  const nodes = new Map();
  const reddedilen = [];

  for (const p of PARTS) {
    const izin = envAllows(p.id, env);
    if (!izin.ok) { reddedilen.push({ id: p.id, neden: izin.neden, oneri: izin.oneri }); continue; }
    const g = govde(THREE, p, M, dok);
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
  const dizi = { 'temel-hab': { n: 6, adim: [0, 0, 0], yay: 'halka', r: 3.2 },
    'panel-tarlasi': { n: 4, adim: [6.2, 0, 0] }, 'radyator-dizisi': { n: 2, adim: [0, 2.6, 0] } };
  for (const [id, d] of Object.entries(dizi)) {
    const temel = nodes.get(id);
    if (!temel) continue;
    for (let i = 1; i < d.n; i++) {
      const k = temel.clone(true);
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
