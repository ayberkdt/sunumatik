/* astro-build.mjs — katalogdan GİYSİYİ kurar ve onu HAREKET ETTİRİR.
 *
 * ÇERÇEVE. `astro-parts.mjs`'in beyan ettiği gövde çerçevesi: +X İLERİ
 * (göğsün baktığı yön), +Y SOL, +Z YUKARI. `pos` harfiyen konumdur ve qty 2
 * olan parçanın aynalama ekseni satırında yazılıdır. Dikey düzen `DIKEY`
 * tablosundan gelir; buradaki hiçbir mafsal yüksekliği elle yazılmaz.
 *
 * BİÇİM — ÜÇÜNCÜ YAZIM. İkinci yazımda konvolüt mafsallar, yataklar ve sert
 * üst gövde vardı ama figür hâlâ bir SİLİNDİR YIĞINI gibi duruyordu, çünkü
 * her gövde `latheZ` ile kurulmuş bir DÖNEL YÜZEYDİ ve dönel yüzeyin kesiti
 * ne yaparsan yap DAİREDİR. İnsanda hiçbir yerde daire kesit yoktur.
 *
 * Artık gövdeler `astro-body.mjs`'in SÜPÜRME'siyle kurulur: kesit eksen
 * boyunca değişir, süpereliptiktir (p ≈ 2,4-3,6: ne boru ne kutu) ve iki
 * dersle taşınır -
 *
 *   Apollo A7L   Silueti yapan şey ITMG'nin ÇEVRESEL KAPİTONE bantlarıdır.
 *                Düz bir tüp asla kumaş gibi görünmez; bantlı bir tüp hemen
 *                görünür. Ay botu ayrı bir OVERSHOE'dur, bu yüzden bilekten
 *                aşağısı belirgin şekilde kalındır. Göğüste RCU ve ondan
 *                gövdeye giren iki hortum; sırtta köşeleri yuvarlatılmış
 *                dikdörtgen PLSS ve ÜSTÜNDE ikincil oksijen.
 *   Ranger EVA   Gövde kesiti dar ve süpereliptik; panel dikişleri uzvu
 *                BOYUNA böler. Kapitone enine, dikiş boyuna gider ve
 *                ikisinin kesişmesi yüzeye ölçek verir - bir uzvun ne kadar
 *                kalın olduğu ancak o zaman okunur.
 *
 * HAREKET. Duruş artık kurulumda pişmez: `uygulaPoz` mafsal açılarını
 * geometriyi yeniden kurmadan uygular, o yüzden aynı figür hem duran beş
 * duruşu hem de `astro-gait.mjs`'in çözdüğü yürüyüşü oynatır.
 */
import {
  PARTS, partById, BOY_M, OMUZ_M, DIKEY, UYLUK_M, BALDIR_M, kopyaKonumlari,
  EKLEMLER, POZ_EKLEM, sinirla,
} from './astro-parts.mjs';
import { supur, uzuvKesiti, govdeKesiti } from './astro-body.mjs';
import { cylGeoX, cylGeoY, cylGeoZ, kureGeoZ, latheZ, latheZYonlu,
         PHI_Z } from '../core/geometry-axis.mjs';
import * as D from '../core/hardware-kit.mjs';

const TAU = Math.PI * 2;
const RAD = Math.PI / 180;

/* Giysi rengi bir boya işi değil. Dış katman beyazdır çünkü güneşi geri
   yansıtmak zorundadır; mafsallar ve yataklar metaldir çünkü yük taşır;
   vizör altındır çünkü morötesini kesen şey o; taban koyudur çünkü aşınan
   yüzeye beyaz kaplama konmaz. */
export function suitMaterials(THREE, tk = {}) {
  const std = (renk, kaba, metal) => new THREE.MeshStandardMaterial({
    color: renk, roughness: kaba, metalness: metal });
  return {
    /* Beta kumaşı güneşte GÖZ ALICI beyazdır - referans Apollo fotoğrafında
       giysi, gri regolitin üstünde neredeyse yanar. 0xecedf0 ACES'ten sonra
       orta griye düşüyordu. */
    kumas: std(tk.kumas ?? 0xf6f7f9, 0.88, 0.02),
    kumasGolge: std(tk.kumasGolge ?? 0xd6d9df, 0.92, 0.02),
    sert: Object.assign(std(tk.sert ?? 0xe2e5ea, 0.38, 0.22), { envMapIntensity: 0.9 }),
    metal: Object.assign(std(tk.metal ?? 0xa8b0bc, 0.24, 0.96), { envMapIntensity: 1.25 }),
    koyu: std(tk.koyu ?? 0x3b4049, 0.6, 0.45),
    taban: std(tk.taban ?? 0x24272d, 0.88, 0.08),
    uyari: std(tk.uyari ?? 0xd8b23a, 0.6, 0.15),
    bayrak: std(tk.bayrak ?? 0x2f4f8f, 0.75, 0.05),
    /* ALTIN VİZÖR — GERÇEK metal. Sahneye ortam haritası girdiği için artık
       yansıtacak bir dünya var: metalness 0,55'e inmek malzemeye yalan
       söylemekti (altını boyaya çevirmek). Vizör 0,05 mm altın kaplamadır ve
       bir AYNA gibi davranır. */
    vizor: new THREE.MeshStandardMaterial({ color: 0xffc257, roughness: 0.07,
      metalness: 1.0, envMapIntensity: 1.6, side: THREE.DoubleSide }),
    /* Kabarcık: ince, çok pürüzsüz polikarbonat. Ortam haritası geldiği için
       artık üstünde gerçek bir yansıma var. */
    cam: new THREE.MeshPhysicalMaterial({ color: 0xbcd8e8, roughness: 0.03,
      metalness: 0.0, transparent: true, opacity: 0.18, transmission: 0,
      clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.4,
      side: THREE.DoubleSide }),
    serit: std(tk.serit ?? 0xc23b3b, 0.7, 0.1),
    /* Kaskın içindeki kişi. Ten rengi bir PORTRE değil, nötr bir orta ton:
       amaç birini resmetmek değil, kaskın boş olmadığını göstermek. */
    ten: std(tk.ten ?? 0xb08768, 0.82, 0.02),
    bere: std(tk.bere ?? 0xe6e3dc, 0.9, 0.02),
    kit: D.hardwareMaterials(THREE, tk),
  };
}

/* ── biçim yardımcıları ──────────────────────────────────────────────── */

/** Süpürülmüş uzuv: kesiti değişen, kapitoneli, dikişli bir gövde parçası. */
function uzuvMesh(THREE, mat, boy, kesit, o = {}) {
  return new THREE.Mesh(supur(THREE, { boy, kesit, ...o }), mat);
}

/** Yumuşak uçlu kabuk (kask kabarcığı): iki ucu kapanan dönel yüzey. */
function kabuk(THREE, mat, r, boy, { seg = 22, uc = 0.5 } = {}) {
  const pts = [];
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const k = Math.sin(Math.PI * t) ** uc;
    pts.push(new THREE.Vector2(Math.max(r * k, 1e-4), (t - 0.5) * boy));
  }
  return latheZ(pts, seg, mat);
}

/**
 * Konvolüt mafsal — basınçlı giysinin bükülebilmesinin TEK yolu.
 * Kıvrımlar hacmi sabit tutar; olmayınca mafsal bükülmez, sıkışır.
 * Halkalar da eliptiktir: mafsal yuvarlak değil, uzvun kesitini izler.
 */
function konvolut(THREE, M, wUst, dUst, wAlt, dAlt, boy, n = 4) {
  const g = new THREE.Group();
  g.add(uzuvMesh(THREE, M.kumas, boy, uzuvKesiti({
    ustW: wUst * 0.94, ustD: dUst * 0.94, altW: wAlt * 0.94, altD: dAlt * 0.94, sis: 0.01,
  }), { dilim: 10, halka: 26 }));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const w = wUst + (wAlt - wUst) * t, d = dUst + (dAlt - dUst) * t;
    const k = new THREE.Mesh(new THREE.TorusGeometry(w, w * 0.2, 10, 28), M.kumasGolge);
    k.scale.x = d / w;
    k.position.z = -t * boy;
    g.add(k);
  }
  return g;
}

/**
 * EKLEM GÖVDESİ — mafsalın merkezindeki cisim.
 *
 * İki katı parçayı bir mafsalda birleştirmek YETMEZ. Uçları düz kapaklıysa
 * açı büyüdükçe bükümün dışında KAMA biçiminde bir boşluk açılır, içinde ise
 * iki kapak birbirine girer. Ölçülen: diz mafsalının 5 cm çevresinde yalnız
 * İKİ yüzey noktası - yani mafsalın kendisinde neredeyse hiçbir şey yok.
 * Figürün "birbirine yapıştırılmış parçalar" gibi durmasının sebebi buydu.
 *
 * Çözüm, eklemli modellerin her zaman kullandığı şey: mafsalın MERKEZİNE,
 * uzvun kalınlığında bir cisim koymak. Küre her yönden aynı görünür, o yüzden
 * içinden geçen bir yüzey HİÇBİR açıda kopamaz. Uzuv parçaları da mafsalın
 * içinde buluşmak yerine eklem yarıçapı kadar geride biter.
 *
 * Kesit eliptik olduğu için küre de eliptiktir: mafsal, bağladığı uzvun
 * kesitini izler, yoksa ince bir bileğe yuvarlak bir top takılmış gibi durur.
 */
function mafsalGovdesi(THREE, mat, w, d, { doluluk = 1.0, seg = 22 } = {}) {
  const k = new THREE.Mesh(new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7)), mat);
  k.scale.set(d * doluluk, w * doluluk, w * doluluk * 0.96);
  k.castShadow = true; k.receiveShadow = true;
  return k;
}

/**
 * Yatak halkası. Konvolüt bükmeyi verir, DÖNMEYİ vermez: omuz, dirsek,
 * bilek, bel, kalça, diz ve ayak bileği dönüşü rulmanlı halkalardan gelir.
 */
function yatakHalkasi(THREE, M, r, { kalin = 0.02, tirnak = 8, kol = false, basik = 1 } = {}) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(cylGeoZ(r * 1.05, r * 1.05, kalin * 2.4, 40), M.metal));
  g.add(new THREE.Mesh(cylGeoZ(r * 1.13, r * 1.13, kalin, 40), M.koyu));
  for (let i = 0; i < tirnak; i++) {
    const a = i * TAU / tirnak;
    const t = new THREE.Mesh(new THREE.BoxGeometry(r * 0.1, r * 0.13, kalin * 1.8), M.metal);
    t.position.set(Math.cos(a) * r * 1.11, Math.sin(a) * r * 1.11, 0);
    t.rotation.z = a;
    g.add(t);
  }
  if (kol) {
    /* Kilit kolu: eldivenli elle çevrilecek kadar büyük olmak zorunda. */
    const k = new THREE.Mesh(new THREE.BoxGeometry(r * 0.7, r * 0.16, kalin * 1.4), M.uyari);
    k.position.set(r * 1.2, 0, kalin * 1.2);
    g.add(k);
  }
  g.scale.x = basik;
  return g;
}

/** Bir yüzeye yapışan yama/etiket. */
function yama(THREE, mat, w, h, kal = 0.006) {
  return new THREE.Mesh(new THREE.BoxGeometry(kal, w, h), mat);
}

/* ── pozlar ──────────────────────────────────────────────────────────
   Açı beyan edilir, vertex taşınmaz. Sayılar DERECE ve her biri FLEKSİYON:
   pozitif sayı mafsalın büküldüğü yöndür, hepsinde aynı anlamda.

   İŞARET SÖZLEŞMESİ TEK YERDE. Bu yazılana kadar her mafsal kendi işaretini
   icat ediyordu: dirsek "58° bükük" yazılmış ama kolu ARKAYA büküyordu -
   ölçülen: dik duran figürün elleri gövdenin 0,123 m gerisinde. Kalça, omuz
   ve dirsek fleksiyonu uzvu ÖNE getirir (-Y etrafında), diz fleksiyonu
   topuğu GERİ getirir (+Y). Fark anatomiktir, o yüzden yazılıdır. */
export const FLEKS = Object.freeze({ kalca: -1, diz: 1, ayak: 1, omuz: -1, dirsek: -1 });
/** Kolun gövdeye YAKINSAMA açısı (derece). Omuz 0,30 m'den bilek 0,21 m'ye
 *  iner: 0,09 m / 0,76 m = 6,8°. İnsan kolunun asılı duruşu budur. */
export const KOL_YAKINSAMA = 7;
/** Ayak ucunun dışa dönme açısı (derece). Paralel iki ayak oyuncak askeridir. */
export const AYAK_ACILMA = 7;
/** Bir mafsalın poz açısını radyana ve DOĞRU işarete çevirir. */
export const mafsal = (poz, ad, i) => (poz?.[ad]?.[i] ?? 0) * RAD * FLEKS[ad];

export const POZLAR = Object.freeze({
  dik: { ad: 'Standing', kalca: [5, 5], diz: [9, 9], omuz: [5, 5], dirsek: [16, 16], govdeEgim: 2 },
  egilme: { ad: 'Crouched at a task', kalca: [52, 52], diz: [66, 66], omuz: [34, 34], dirsek: [58, 58], govdeEgim: 26 },
  uzanma: { ad: 'Reaching up to a panel', kalca: [0, 0], diz: [6, 6], omuz: [104, 30], dirsek: [22, 14], govdeEgim: -6 },
  tasima: { ad: 'Carrying a load', kalca: [8, 8], diz: [12, 12], omuz: [48, 48], dirsek: [74, 74], govdeEgim: 8 },
  selam: { ad: 'Saluting', kalca: [0, 0], diz: [2, 2], omuz: [96, 4], dirsek: [118, 14], govdeEgim: -2 },
});

/* ── gövdeler ────────────────────────────────────────────────────────
   `yan`: +1 sol, -1 sağ, 0 orta. Sol ve sağ kol aynı değildir - kontrol
   listesi bir kolda, ayna ötekinde durur. */
function govde(THREE, p, M, yan = 0) {
  const [sx, sy, sz] = p.size;
  const g = new THREE.Group();
  const ekle = (m) => { m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };

  switch (p.sekil) {

    /* ── soğutma tulumu ─────────────────────────────────────────────
       Tene giyilir; dışarıdan yalnız boyundan ve bileklerden görünür. Isıyı
       taşıyan şey hava değil, o borulardaki sudur - o yüzden borular çizilir. */
    case 'tulum': {
      const t = ekle(uzuvMesh(THREE, M.koyu, sz * 0.56, govdeKesiti({
        omuzW: sy * 0.46, omuzD: sx * 0.46, belW: sy * 0.36, belD: sx * 0.36, p: 2.6,
      }), { dilim: 18, halka: 30 }));
      t.position.z = sz * 0.46;
      /* Tulumun bacakları GİYSİNİN UYLUKLARIYLA aynı eksende ve daha ince
         olmak zorunda. y = ±sy*0,2'de duruyorlardı, yani iki uyluğun ARASINA
         düşüyor ve kırmızı serpantin dışarıdan görünüyordu: giysinin en dış
         katmanı, tene giyilen katman oluyordu. */
      for (const s of [-1, 1]) {
        const b = ekle(uzuvMesh(THREE, M.koyu, sz * 0.42, uzuvKesiti({
          ustW: sy * 0.14, ustD: sx * 0.15, altW: sy * 0.1, altD: sx * 0.11, sis: 0.04,
        }), { dilim: 10, halka: 22 }));
        b.position.set(0, s * sy * 0.38, -sz * 0.06);
      }
      /* Serpantin: borular gövdeyi SARAR, üst üste halka olmaz. */
      for (let i = 0; i < 16; i++) {
        const r = sy * (0.44 - 0.05 * Math.abs(Math.sin(i * 0.9)));
        const hat = ekle(new THREE.Mesh(
          new THREE.TorusGeometry(r, sy * 0.018, 5, 22, TAU * 0.92), M.serit));
        hat.scale.x = sx / sy;
        hat.position.z = sz * (0.44 - i * 0.05);
        hat.rotation.z = i * 0.55;
      }
      break;
    }

    /* ── alt gövde ──────────────────────────────────────────────────
       Bel yatağı, kalça kabuğu, iki bacak. Bacaklar KESİTİ DEĞİŞEN süpürme
       gövdelerdir: uyluk kalçada yanlara yassı (w > d), dizde yuvarlağa
       yaklaşır - bir insan uyluğu ne silindirdir ne koni.
       Mafsal yükseklikleri `DIKEY` tablosundan gelir, elle yazılmaz. */
    case 'altGovde': {
      const yerel = (dunyaZ) => dunyaZ - p.pos[2];
      const belZ = yerel(DIKEY.bel), kalcaZ = yerel(DIKEY.kalca);
      /* Kalça kabuğu: belden kalçaya genişleyen, kapitoneli yumuşak kısım. */
      /* Kabuk kalça mafsalının ALTINA kadar iner. Belde bitirilince kasıkta
         boşluk kalıyor ve altındaki soğutma tulumunun kırmızı serpantini
         dışarıdan görünüyordu: giysinin en dış katmanı, tene giyilen katman
         oluyordu. */
      /* Kalça, taşıdığı bacaklar kadar GENİŞ olmak zorunda. A7L fıçı
         biçimlidir: kalçası omzu kadar geniştir, ve dar bir kalçaya kalın
         bacak takmak tam olarak "bacaklı varil"in tersi kadar yanlış. */
      const brief = ekle(uzuvMesh(THREE, M.kumas, belZ - kalcaZ + 0.3, uzuvKesiti({
        ustW: sy * 0.52, ustD: sx * 0.52, altW: sy * 0.8, altD: sx * 0.68, sis: 0.03,
        p: 2.5, kapitone: [4, 0.05], dikis: [6, 0.05], kirisik: [1.2, 0.018],
      }), { dilim: 20, halka: 34 }));
      brief.position.z = belZ;
      const bel = yatakHalkasi(THREE, M, sy * 0.5,
        { kalin: 0.022, tirnak: 10, kol: true, basik: sx / sy });
      bel.position.z = belZ;
      g.add(bel);
      /* Alet askıları: kalçada, eldivenli elin ulaşabileceği yerde. */
      for (const s of [-1, 1]) {
        const ask = ekle(new THREE.Mesh(
          new THREE.TorusGeometry(sy * 0.05, sy * 0.014, 5, 12), M.metal));
        ask.position.set(-sx * 0.1, s * sy * 0.62, kalcaZ + 0.04);
        ask.rotation.x = Math.PI / 2;
      }

      const eklem = { kalca: [], diz: [], ayak: [] };
      for (const [i, s] of [[0, 1], [1, -1]]) {
        const kalca = new THREE.Group();
        kalca.name = i === 0 ? 'kalcaL' : 'kalcaR';
        kalca.position.set(0, s * sy * 0.37, kalcaZ);
        g.add(kalca);
        eklem.kalca.push(kalca);
        /* KALÇA EKLEMİ: mafsalın merkezinde gövde, sonra konvolüt. */
        kalca.add(mafsalGovdesi(THREE, M.kumas, sy * 0.355, sx * 0.35));
        kalca.add(konvolut(THREE, M, sy * 0.36, sx * 0.355, sy * 0.35, sx * 0.345, 0.07, 2));
        /* Uyluk, eklem gövdesinin içinde bitmek yerine ONA DAYANIR. */
        const uyluk = uzuvMesh(THREE, M.kumas, UYLUK_M - 0.07 - sy * 0.2, uzuvKesiti({
          /* BASINÇLI GİYSİ İNCELMEZ. İnsan uyluğu dize doğru daralır; 26 kPa'ya
             şişirilmiş bir tulum daralmaz - uyluk 0,28 m, diz 0,26 m, yani
             neredeyse aynı. Anatomik daralmayı giysiye uygulamak, figürü bir
             basınç kabı değil tulum giymiş bir insan gibi gösteriyordu. */
          ustW: sy * 0.35, ustD: sx * 0.345, altW: sy * 0.325, altD: sx * 0.32,
          sis: 0.05, sisT: 0.3, p: 2.2, kapitone: [6, 0.075], dikis: [8, 0.04], kirisik: [1.4, 0.022],
        }), { dilim: 20, halka: 32 });
        uyluk.position.z = -0.07;
        uyluk.castShadow = true; uyluk.receiveShadow = true;
        kalca.add(uyluk);
        /* Uyluk cebi: A7L'de örnek torbası ve kontrol listesi oradadır. */
        const cep = new THREE.Mesh(
          new THREE.BoxGeometry(sx * 0.16, sy * 0.24, UYLUK_M * 0.3), M.kumasGolge);
        cep.position.set(sx * 0.44, s * sy * 0.1, -UYLUK_M * 0.56);
        kalca.add(cep);

        const diz = new THREE.Group();
        diz.name = i === 0 ? 'dizL' : 'dizR';
        diz.position.z = -UYLUK_M;
        kalca.add(diz);
        eklem.diz.push(diz);
        /* DİZ EKLEMİ. Konvolüt artık mafsalın ÜSTÜNE ve ALTINA simetrik
           oturur: yalnız altına konunca büküm dışında boşluk kalıyordu. */
        diz.add(mafsalGovdesi(THREE, M.kumas, sy * 0.325, sx * 0.32));
        const dizKon = konvolut(THREE, M, sy * 0.33, sx * 0.325, sy * 0.3, sx * 0.3, 0.16, 4);
        dizKon.position.z = 0.07;
        diz.add(dizKon);
        /* Diz kapağı: konvolütü koruyan EĞRİ plaka. */
        /* kutup-ok: kutup burada ELLE +Z'ye çevriliyor (aşağıdaki tek
           eksenli dönüş), plakanın eğrilmesi gereken yön de o. */
        const kapak = new THREE.Mesh(
          new THREE.SphereGeometry(sy * 0.37, 24, 16, -0.8, 1.6, 0.9, 1.1), M.kumasGolge);
        kapak.rotation.x = Math.PI / 2;
        kapak.position.z = -0.05;
        diz.add(kapak);
        const baldir = uzuvMesh(THREE, M.kumas, BALDIR_M - 0.16, uzuvKesiti({
          ustW: sy * 0.3, ustD: sx * 0.3, altW: sy * 0.244, altD: sx * 0.25,
          sis: 0.07, sisT: 0.25, p: 2.2, kapitone: [6, 0.07], dikis: [8, 0.04], kirisik: [1.6, 0.022],
        }), { dilim: 20, halka: 32 });
        baldir.position.z = -0.16;
        baldir.castShadow = true; baldir.receiveShadow = true;
        diz.add(baldir);
        const ayakY = yatakHalkasi(THREE, M, sy * 0.215, { kalin: 0.013, tirnak: 6 });
        ayakY.position.z = -BALDIR_M;
        diz.add(ayakY);
        /* AYAK BİLEĞİ EKLEMİ: bilek en dar mafsal ve en çok bükülen yer. */
        const ayakEk = mafsalGovdesi(THREE, M.kumasGolge, sy * 0.235, sx * 0.24);
        ayakEk.position.z = -BALDIR_M;
        diz.add(ayakEk);
        /* Havalandırma hattı baldırın arkasından iner. */
        const hat = new THREE.Mesh(cylGeoZ(sx * 0.022, sx * 0.022, BALDIR_M * 0.8, 8), M.koyu);
        hat.position.set(-sx * 0.33, 0, -BALDIR_M * 0.55);
        diz.add(hat);
        /* AYAK BİLEĞİ MAFSALI. Çizme baldıra sabit bağlıyken basma evresinde
           baldır eğildikçe ayak da eğiliyor ve burun ya da topuk yere
           giriyordu - ölçülen: Ay'da taban 0,107 m yerin altında. Bir ayak
           bileği yalnız bir ayrıntı değil, tabanı yere DÜZ tutan şeydir. */
        const ayak = new THREE.Group();
        ayak.name = i === 0 ? 'ayakL' : 'ayakR';
        ayak.position.z = -BALDIR_M;
        diz.add(ayak);
        eklem.ayak.push(ayak);
        ayak.userData.ayakUcu = 0;
        diz.userData.ayakUcu = -BALDIR_M;
        diz.userData.ayak = ayak;
      }
      g.userData.eklem = eklem;
      g.userData.diz = eklem.diz;
      g.userData.ayak = eklem.ayak;
      break;
    }

    /* ── çizme ──────────────────────────────────────────────────────
       Yerel çerçeve: kaynak nokta AYAK BİLEĞİ (z = 0). Ay botu ayrı bir
       OVERSHOE'dur - giysinin botunun ÜSTÜNE geçer, o yüzden bilekten
       aşağısı belirgin şekilde kalındır ve tabanı geniştir. */
    case 'cizme': {
      const boy = sz, uz = sx, gen = sy;
      g.add(yatakHalkasi(THREE, M, gen * 0.44, { kalin: 0.012, tirnak: 6 }));
      g.add(konvolut(THREE, M, gen * 0.44, gen * 0.46, gen * 0.5, gen * 0.52, boy * 0.3, 2));
      /* Overshoe gövdesi: bilekten aşağı AÇILIR. */
      const ust = ekle(uzuvMesh(THREE, M.kumasGolge, boy * 0.56, uzuvKesiti({
        ustW: gen * 0.5, ustD: uz * 0.22, altW: gen * 0.58, altD: uz * 0.3,
        sis: 0.02, p: 2.6, kapitone: [3, 0.06],
      }), { dilim: 12, halka: 28 }));
      ust.position.z = -boy * 0.22;
      /* Ayak: burun yuvarlak, topuk kısa ve dik. */
      const tabanZ = -boy * 0.8;
      const orta = ekle(new THREE.Mesh(
        new THREE.BoxGeometry(uz * 0.5, gen * 1.0, boy * 0.26), M.kumasGolge));
      orta.position.set(uz * 0.06, 0, tabanZ + boy * 0.14);
      const burun = ekle(new THREE.Mesh(new THREE.SphereGeometry(gen * 0.5, 24, 16), M.kumasGolge));
      burun.scale.set(uz * 0.88 / gen, 1, 0.6);
      burun.position.set(uz * 0.3, 0, tabanZ + boy * 0.14);
      const topuk = ekle(new THREE.Mesh(new THREE.SphereGeometry(gen * 0.48, 22, 15), M.kumasGolge));
      topuk.scale.set(0.72, 1, 0.66);
      topuk.position.set(-uz * 0.2, 0, tabanZ + boy * 0.13);
      /* Taban ve deseni. Desen topukta ve ayak bilyesinde SIKLAŞIR, çünkü
         basılan yer orasıdır - düzgün aralıklı çizgiler bir ayakkabının
         nasıl aşındığını bilmemek demek. */
      const tabanM = ekle(new THREE.Mesh(
        new THREE.BoxGeometry(uz * 1.0, gen * 1.06, boy * 0.08), M.taban));
      tabanM.position.set(uz * 0.05, 0, tabanZ);
      for (let i = 0; i < 11; i++) {
        const u = i / 10;
        const yogun = Math.abs(u - 0.2) < 0.18 || Math.abs(u - 0.82) < 0.16;
        const d = ekle(new THREE.Mesh(new THREE.BoxGeometry(
          uz * (yogun ? 0.055 : 0.032), gen * 0.98, boy * 0.05), M.taban));
        d.position.set((u - 0.45) * uz * 0.94 + uz * 0.05, 0, tabanZ - boy * 0.055);
      }
      /* Bağ ucu ve topuk klipsi: çizme bir kutu değil, BAĞLANAN bir şeydir. */
      for (const s2 of [-1, 1]) {
        const uc = ekle(new THREE.Mesh(
          new THREE.BoxGeometry(uz * 0.07, gen * 0.07, boy * 0.1), M.metal));
        uc.position.set(uz * 0.16, s2 * gen * 0.5, tabanZ + boy * 0.3);
      }
      const klips = ekle(new THREE.Mesh(
        new THREE.BoxGeometry(uz * 0.1, gen * 0.5, boy * 0.09), M.metal));
      klips.position.set(-uz * 0.33, 0, tabanZ + boy * 0.2);
      /* Bağ kayışı çizmenin ETRAFINI sarar. `rotation.x = PI/2` halkayı DİK
         çeviriyordu: XY düzlemindeki bir simit +Z ekseni etrafında sarar,
         X etrafında çevrilince XZ düzlemine geçer ve tabanın 6 cm ALTINA
         sarkar. Ölçülen taban profili de onu görüyordu - bilek-taban mesafesi
         0,194 yerine 0,253 çıkıyor ve yürüyüş çözümü her karede 30 mm
         şaşıyordu. Bir simidin ekseni, sardığı şeyin eksenidir. */
      /* ÖLÇÜ ÇİZMENİN KENDİ KUTUSUNDAN. Önceki hâl `uz * 0.8`i YARIÇAP
         yerine koyuyordu; çizmenin yarı uzunluğu ise `uz * 0.5`tir. 0,36 m
         boyunda bir çizmenin etrafında 0,657 m'lik, buruna göre 16 cm öne
         taşan ve ayağa hiçbir yerde değmeyen düz bir çember dönüyordu
         (ölçüldü: dünya matrisi determinantı 2,3188). Bir kayış, sardığı
         şeyin ölçüsündedir. */
      const kayisR = gen * 0.54;
      const kayis = ekle(new THREE.Mesh(
        new THREE.TorusGeometry(kayisR, gen * 0.055, 8, 24), M.koyu));
      kayis.scale.set(uz * 0.44 / kayisR, 1, 1);
      kayis.position.set(uz * 0.05, 0, tabanZ + boy * 0.34);
      break;
    }

    /* ── sert üst gövde ─────────────────────────────────────────────
       Kolların, kaskın ve sırt paketinin yükünü taşıyan tek parça. Kesit
       SÜPERELİPTİK (p = 2,75): enine geniş, önden arkaya sığ. Bir göğüs
       kafesi daire değildir ve giysi onu yuvarlamaz - Ranger'ın biçim dili. */
    case 'ustGovde': {
      /* A7L'NİN SERT ÜST GÖVDESİ YOKTUR. Boyun halkasından kalçaya kadar
         tek YUMUŞAK giysidir ve basınç onu şişirir. Süpereliptik p = 2,75'lik
         bir kabuk zırh gibi okunur - o, xEMU/Ranger'ın biçim dili. Apollo'da
         kesit yuvarlağa yakındır (p = 2,2), omuz keskin değil DÖNEREK biter
         ve bel çok az daralır: şişmiş bir tulumun beli yoktur. */
      const kab = ekle(uzuvMesh(THREE, M.kumas, sz, govdeKesiti({
        omuzW: sy * 0.5, omuzD: sx * 0.54, belW: sy * 0.42, belD: sx * 0.48,
        omuzT: 0.26, p: 2.2, kapitone: [4, 0.03], dikis: [5, 0.03], kirisik: [1.1, 0.016],
      }), { dilim: 24, halka: 40 }));
      kab.position.z = sz / 2;
      /* Göğüs dolgusu: basınç kumaşı şişirir ve öne eğilebilmek için ÖNDE
         yer bırakılır, o yüzden göğüs sırttan dolgundur. */
      const gpts = [];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        gpts.push(new THREE.Vector2(
          Math.max(sx * (0.44 + 0.2 * Math.sin(Math.PI * t)), 0.02), (t - 0.46) * sz * 0.88));
      }
      const gogus = ekle(latheZYonlu(gpts, 20, M.sert, PHI_Z.on, 2.0));
      gogus.scale.y = sy * 0.9 / sx;
      /* Omuz boyundurukları ve YAMUK KASI. Omuz çizgisi boyundan omuza
         DÜŞER; düz bir tepe çizgisi gövdeyi kutu yapar ve bir insan
         siluetinde omuz hiçbir zaman yatay değildir. */
      for (const s of [-1, 1]) {
        const om = ekle(new THREE.Mesh(new THREE.SphereGeometry(sy * 0.24, 26, 18), M.kumas));
        om.scale.set(sx * 0.5 / (sy * 0.24) * 0.58, 1, 0.8);
        om.position.set(0, s * sy * 0.31, sz * 0.2);
        /* Boyundan omuza İNEN eğim. İlk denemede kütleler hem yüksek hem
           x'te 1,7 kat gerili olduğu için omuz düz bir RAFA dönüyordu -
           eğim vermek isterken tam tersini yapıyordu. Küçük, dar ve gerçekten
           alçalan üç kütle. */
        for (let i = 1; i <= 3; i++) {
          const u = i / 3;
          const yam = ekle(new THREE.Mesh(
            new THREE.SphereGeometry(sy * (0.145 - 0.04 * u), 20, 14), M.kumas));
          yam.scale.set(0.92, 1, 0.66);
          yam.position.set(0, s * sy * 0.3 * u, sz * (0.34 - 0.2 * u));
        }
      }
      const belY = yatakHalkasi(THREE, M, sy * 0.35,
        { kalin: 0.022, tirnak: 10, kol: true, basik: sx * 1.12 / sy });
      belY.position.z = -sz * 0.5;
      g.add(belY);
      const boyun = ekle(uzuvMesh(THREE, M.kumas, sz * 0.1, uzuvKesiti({
        ustW: sy * 0.22, ustD: sx * 0.28, altW: sy * 0.26, altD: sx * 0.3, sis: 0,
      }), { dilim: 8, halka: 26 }));
      boyun.position.z = sz * 0.6;
      const boyunY = yatakHalkasi(THREE, M, sy * 0.22, { kalin: 0.018, tirnak: 8, kol: true });
      boyunY.position.z = sz * 0.5;
      g.add(boyunY);
      /* Mürettebat şeridi, bayrak ve isimlik - giysinin üstünde YAZILI olan
         şeyler; iki mürettebatı uzaktan ayıran tek işaret. */
      /* Mürettebat şeridi KOLDA durur. Göğse konan büyük kırmızı levha,
         referans fotoğraftaki beyaz RCU kutusunun yerini kaplıyordu; Apollo
         11 giysisinde göğüste şerit yoktur. Buradaki küçük bant yalnız
         omuz hizasında kalır. */
      const serit = ekle(yama(THREE, M.serit, sy * 0.075, sz * 0.12));
      serit.position.set(sx * 0.46, sy * 0.33, sz * 0.26);
      /* Bayrak OMUZDA ve küçüktür. Göğsün ortasına konan geniş levhalar,
         referans fotoğraftaki beyaz RCU'nun yerini kaplayıp giysiyi alacalı
         gösteriyordu; Apollo'da göğüs beyazdır, işaretler omuzdadır. */
      const bayrak = ekle(yama(THREE, M.bayrak, sy * 0.1, sz * 0.09));
      bayrak.position.set(sx * 0.46, -sy * 0.33, sz * 0.26);
      const isim = D.levha(THREE, M.kit, ['CREW'], { w: sy * 0.26, h: sz * 0.075 });
      isim.rotateOnWorldAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2);
      isim.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), Math.PI / 2);
      isim.position.set(sx * 0.5, -sy * 0.26, sz * 0.1);
      g.add(isim);
      /* KUŞAK VE ASKI. Bir basınçlı giysinin üstü boş değildir: paketin yükünü
         omuzlara aktaran dokuma kayışlar, ayar tokaları ve D-halkaları vardır.
         Temiz bir yüzey, maket gibi okunur; premium hissi veren şey küçük
         donanımın VARLIĞIDIR. */
      for (const s of [-1, 1]) {
        const kayis = ekle(new THREE.Mesh(
          new THREE.BoxGeometry(sx * 1.06, sy * 0.1, sz * 0.045), M.kumasGolge));
        kayis.position.set(0, s * sy * 0.26, sz * 0.12);
        const toka = ekle(new THREE.Mesh(
          new THREE.BoxGeometry(sx * 0.06, sy * 0.13, sz * 0.07), M.metal));
        toka.position.set(sx * 0.48, s * sy * 0.26, sz * 0.12);
        /* D-halkası: alet bağlanan yer. Bağsız alet EVA'yı tek başına bitirir. */
        const d = ekle(new THREE.Mesh(
          new THREE.TorusGeometry(sy * 0.035, sy * 0.011, 8, 16, Math.PI * 1.1), M.metal));
        d.position.set(sx * 0.5, s * sy * 0.38, -sz * 0.02);
        d.rotation.x = Math.PI / 2;
      }
      /* Bel kuşağı ve iki yan toka. */
      const kusak = ekle(new THREE.Mesh(
        new THREE.TorusGeometry(sy * 0.37, sy * 0.028, 10, 32), M.kumasGolge));
      kusak.scale.x = sx * 1.16 / sy;
      kusak.position.z = -sz * 0.4;
      for (const s of [-1, 1]) {
        const t2 = ekle(new THREE.Mesh(
          new THREE.BoxGeometry(sx * 0.07, sy * 0.1, sz * 0.055), M.metal));
        t2.position.set(0, s * sy * 0.4, -sz * 0.4);
      }
      /* Basınç fermuarı: giysinin kapandığı çizgi, önden omuza. */
      for (let i = 0; i < 9; i++) {
        const u = i / 8;
        const dis = ekle(new THREE.Mesh(
          new THREE.BoxGeometry(sx * 0.03, sy * 0.028, sz * 0.03), M.metal));
        dis.position.set(sx * (0.5 - 0.04 * u), sy * (0.06 + 0.2 * u), sz * (-0.3 + 0.62 * u));
      }
      /* Sırt: paketin oturduğu yuva ve dört kilit. */
      const yuva = ekle(new THREE.Mesh(
        new THREE.BoxGeometry(sx * 0.14, sy * 0.66, sz * 0.62), M.koyu));
      yuva.position.set(-sx * 0.46, 0, 0);
      for (const s of [-1, 1]) for (const z of [-1, 1]) {
        const kil = ekle(new THREE.Mesh(
          new THREE.BoxGeometry(sx * 0.1, sy * 0.08, sz * 0.08), M.metal));
        kil.position.set(-sx * 0.52, s * sy * 0.26, z * sz * 0.24);
      }
      break;
    }

    /* ── omuz yatağı ────────────────────────────────────────────────
       Kolun döndüğü rulman. Ekseni dışa ve hafif aşağı bakar - kol gövdeden
       dik çıkmaz. Yön `setFromUnitVectors` ile kurulur, Euler ile değil. */
    case 'yatak': {
      const r = sy * 0.5;
      const eksen = new THREE.Vector3(0, yan >= 0 ? 1 : -1, -0.34).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), eksen);
      const h = yatakHalkasi(THREE, M, r, { kalin: 0.016, tirnak: 8, kol: true });
      h.quaternion.copy(q);
      g.add(h);
      const gobek = ekle(new THREE.Mesh(cylGeoZ(r * 0.92, r * 0.92, sx * 0.45, 18), M.metal));
      gobek.quaternion.copy(q);
      for (let i = 0; i < 10; i++) {
        const a = i * TAU / 10;
        const b = new THREE.Mesh(new THREE.SphereGeometry(r * 0.1, 8, 6), M.koyu);
        b.position.set(Math.cos(a) * r * 0.98, Math.sin(a) * r * 0.98, 0);
        b.position.applyQuaternion(q);
        ekle(b);
      }
      break;
    }

    /* ── kol ────────────────────────────────────────────────────────
       Yerel çerçeve: kaynak nokta OMUZ (z = 0), kol aşağı uzanır. Üst kol,
       dirsek konvolütü + sert fincan, ön kol, bilek yatağı. Kesit omuzda
       yanlara yassı, bilekte yuvarlak.
       Sol ve sağ kol AYNI DEĞİL: kontrol listesi bir kolda, ayna ötekinde -
       mürettebat kendi göğsündeki paneli ancak aynayla okur. */
    case 'kol': {
      const ustBoy = sz * 0.46, onBoy = sz * 0.44;
      const kap = ekle(new THREE.Mesh(new THREE.SphereGeometry(sy * 0.7, 24, 16), M.kumas));
      kap.scale.set(0.9, 1, 0.78);
      g.add(yatakHalkasi(THREE, M, sy * 0.62, { kalin: 0.014, tirnak: 6 }));
      /* OMUZ EKLEMİ. */
      g.add(mafsalGovdesi(THREE, M.kumas, sy * 0.62, sx * 0.59));
      g.add(konvolut(THREE, M, sy * 0.63, sx * 0.6, sy * 0.61, sx * 0.58, sz * 0.09, 2));
      const ust = uzuvMesh(THREE, M.kumas, ustBoy - sz * 0.09 - sy * 0.34, uzuvKesiti({
        ustW: sy * 0.61, ustD: sx * 0.58, altW: sy * 0.574, altD: sx * 0.56,
        sis: 0.05, sisT: 0.25, p: 2.2, kapitone: [6, 0.085], dikis: [6, 0.035], kirisik: [1.8, 0.025],
      }), { dilim: 18, halka: 30 });
      ust.position.z = -sz * 0.09;
      ust.castShadow = true; ust.receiveShadow = true;
      g.add(ust);

      const dirsek = new THREE.Group();
      dirsek.name = yan >= 0 ? 'dirsekL' : 'dirsekR';
      dirsek.position.z = -ustBoy;
      g.add(dirsek);
      g.userData.dirsek = dirsek;
      /* DİRSEK EKLEMİ: gövde mafsalın merkezinde, konvolüt iki yanına. */
      dirsek.add(mafsalGovdesi(THREE, M.kumas, sy * 0.575, sx * 0.565));
      const dirKon = konvolut(THREE, M, sy * 0.59, sx * 0.58, sy * 0.55, sx * 0.55, sz * 0.16, 4);
      dirKon.position.z = sz * 0.07;
      dirsek.add(dirKon);
      /* kutup-ok: kutup elle −Z'ye çevriliyor; fincan dirseğin ALTINI
         kaplar, o yüzden ters yön. */
      const fincan = new THREE.Mesh(
        new THREE.SphereGeometry(sy * 0.66, 22, 15, -0.8, 1.6, 0.9, 1.1), M.kumasGolge);
      fincan.rotation.x = -Math.PI / 2;
      fincan.position.z = -sz * 0.05;
      dirsek.add(fincan);
      const on = uzuvMesh(THREE, M.kumas, onBoy - sz * 0.17, uzuvKesiti({
        ustW: sy * 0.541, ustD: sx * 0.54, altW: sy * 0.447, altD: sx * 0.45,
        sis: 0.06, sisT: 0.25, p: 2.2, kapitone: [6, 0.08], dikis: [6, 0.035], kirisik: [2.0, 0.025],
      }), { dilim: 18, halka: 30 });
      on.position.z = -sz * 0.17;
      on.castShadow = true; on.receiveShadow = true;
      dirsek.add(on);
      const bilek = yatakHalkasi(THREE, M, sy * 0.46, { kalin: 0.014, tirnak: 6, kol: true });
      bilek.position.z = -onBoy;
      dirsek.add(bilek);
      /* BİLEK EKLEMİ. */
      const bilekEk = mafsalGovdesi(THREE, M.kumasGolge, sy * 0.45, sx * 0.45);
      bilekEk.position.z = -onBoy;
      dirsek.add(bilekEk);
      if (yan >= 0) {
        const kitap = new THREE.Mesh(
          new THREE.BoxGeometry(sy * 0.46, sy * 0.12, onBoy * 0.3), M.kit.white);
        kitap.position.set(sy * 0.48, 0, -onBoy * 0.56);
        dirsek.add(kitap);
      } else {
        const ayna = new THREE.Mesh(
          new THREE.BoxGeometry(sy * 0.38, sy * 0.04, sy * 0.32), M.metal);
        ayna.position.set(sy * 0.48, 0, -onBoy * 0.56);
        dirsek.add(ayna);
      }
      g.userData.bilekZ = -onBoy;
      break;
    }

    /* ── eldiven ────────────────────────────────────────────────────
       Yerel çerçeve: kaynak BİLEK (z = 0). Bilezik, koni manşet, avuç, dört
       parmak (ikişer boğum, hafif kıvrık) ve ayrı başparmak. Parmak uçları
       koyu: kavrama yüzeyi kumaş değil, kauçuktur. */
    case 'eldiven': {
      const rB = sy * 0.6, uz = sx, boy = sz;
      g.add(yatakHalkasi(THREE, M, rB, { kalin: 0.012, tirnak: 6 }));
      const mansetBoy = boy * 0.34;
      ekle(uzuvMesh(THREE, M.kumasGolge, mansetBoy, uzuvKesiti({
        ustW: rB, ustD: rB * 0.96, altW: rB * 0.9, altD: rB * 0.84, sis: 0.02,
        p: 2.4, kapitone: [2, 0.05],
      }), { dilim: 10, halka: 24 }));
      const avuc = ekle(new THREE.Mesh(
        new THREE.BoxGeometry(uz * 0.34, sy * 0.88, boy * 0.3), M.kumasGolge));
      avuc.position.set(uz * 0.04, 0, -mansetBoy - boy * 0.15);
      const ped = ekle(new THREE.Mesh(
        new THREE.BoxGeometry(uz * 0.28, sy * 0.72, boy * 0.05), M.taban));
      ped.position.set(uz * 0.2, 0, -mansetBoy - boy * 0.15);
      /* Bilek kayışı ve tokası: eldiven bileğe SIKILIR. */
      const bkayis = ekle(new THREE.Mesh(
        new THREE.TorusGeometry(rB * 0.92, rB * 0.09, 8, 22), M.koyu));
      bkayis.position.z = -mansetBoy * 0.55;
      const btoka = ekle(new THREE.Mesh(
        new THREE.BoxGeometry(uz * 0.1, sy * 0.1, boy * 0.05), M.metal));
      btoka.position.set(uz * 0.24, 0, -mansetBoy * 0.55);
      /* AYNA, KOPYA DEĞİL. Başparmak GÖVDE ORTASINA bakar: sol elde -y,
         sağ elde +y. İki eli aynı geometriyle kurmak, sağ elin başparmağını
         dışarı çeviriyordu - ölçülen: iki elde de yerel y = -0,054. Elin
         hangi el olduğu, onu kuran koda SÖYLENMEK zorunda. */
      const ayna = yan >= 0 ? 1 : -1;
      const parmakZ = -mansetBoy - boy * 0.3;
      for (let i = 0; i < 4; i++) {
        const kok = new THREE.Group();
        kok.position.set(uz * 0.06, ayna * (i / 3 - 0.5) * sy * 0.64, parmakZ);
        kok.rotation.y = -0.42;
        g.add(kok);
        const b1 = new THREE.Mesh(new THREE.BoxGeometry(uz * 0.13, sy * 0.15, boy * 0.16), M.kumas);
        b1.position.z = -boy * 0.08;
        kok.add(b1);
        const b2g = new THREE.Group();
        b2g.position.z = -boy * 0.16;
        b2g.rotation.y = -0.5;
        kok.add(b2g);
        const b2 = new THREE.Mesh(new THREE.BoxGeometry(uz * 0.11, sy * 0.13, boy * 0.13), M.kumas);
        b2.position.z = -boy * 0.065;
        b2g.add(b2);
        const uc = new THREE.Mesh(new THREE.SphereGeometry(sy * 0.07, 8, 6), M.taban);
        uc.position.z = -boy * 0.13;
        b2g.add(uc);
      }
      const bp = new THREE.Group();
      bp.position.set(uz * 0.15, -ayna * sy * 0.4, -mansetBoy - boy * 0.16);
      bp.rotation.y = -1.0;
      g.add(bp);
      const bp1 = new THREE.Mesh(new THREE.BoxGeometry(uz * 0.12, sy * 0.16, boy * 0.14), M.kumas);
      bp1.position.z = -boy * 0.07;
      bp.add(bp1);
      const bpUc = new THREE.Mesh(new THREE.SphereGeometry(sy * 0.08, 8, 6), M.taban);
      bpUc.position.z = -boy * 0.14;
      bp.add(bpUc);
      break;
    }

    /* ── yaşam destek paketi ────────────────────────────────────────
       A7L'de PLSS köşeleri yuvarlatılmış bir DİKDÖRTGENDİR, silindir değil:
       süpereliptik kesit (p = 3,6) tam bunu verir. Üstünde OPS, altında
       yüceltici ve kanatları - ısının gittiği yer görünür olmalı. */
    case 'paket': {
      const kab = ekle(uzuvMesh(THREE, M.sert, sz * 0.94, uzuvKesiti({
        ustW: sy * 0.48, ustD: sx * 0.46, altW: sy * 0.5, altD: sx * 0.5,
        sis: 0.02, p: 3.6, dikis: [4, 0.03],
      }), { dilim: 14, halka: 36 }));
      kab.position.z = sz * 0.47;
      const kapak = ekle(new THREE.Mesh(
        new THREE.BoxGeometry(sx * 0.94, sy * 0.96, sz * 0.06), M.koyu));
      kapak.position.z = sz * 0.47;
      for (const s of [-1, 1]) {
        const tut = ekle(new THREE.Mesh(
          new THREE.TorusGeometry(sy * 0.08, sy * 0.02, 6, 12), M.metal));
        tut.position.set(-sx * 0.1, s * sy * 0.3, sz * 0.5);
        tut.rotation.y = Math.PI / 2;
      }
      /* İkincil oksijen AYRI BİR PARÇADIR ve paketin üstünde durur (A7L
         düzeni). Buraya bir de OPS kutusu çizmek onu İKİ KEZ göstermekti:
         biri burada, biri kataloğun `ikincil-o2` satırında sırtın altında.
         Aynı donanım iki yerde duramaz. */
      for (const s of [-1, 1]) {
        const tup = ekle(new THREE.Mesh(cylGeoZ(sy * 0.1, sy * 0.1, sz * 0.44, 14), M.metal));
        tup.position.set(-sx * 0.1, s * sy * 0.24, sz * 0.2);
        const vana = ekle(new THREE.Mesh(cylGeoZ(sy * 0.04, sy * 0.04, sz * 0.06, 8), M.uyari));
        vana.position.set(-sx * 0.1, s * sy * 0.24, sz * 0.44);
      }
      const yuc = ekle(new THREE.Mesh(
        new THREE.BoxGeometry(sx * 0.62, sy * 0.74, sz * 0.12), M.metal));
      yuc.position.set(-sx * 0.06, 0, -sz * 0.34);
      for (let i = 0; i < 7; i++) {
        const kan = ekle(new THREE.Mesh(
          new THREE.BoxGeometry(sx * 0.58, sy * 0.02, sz * 0.09), M.koyu));
        kan.position.set(-sx * 0.06, (i / 6 - 0.5) * sy * 0.68, -sz * 0.4);
      }
      for (const s of [-1, 1]) {
        const ag = ekle(new THREE.Mesh(cylGeoX(sy * 0.05, sy * 0.05, sx * 0.3, 10), M.koyu));
        ag.position.set(sx * 0.4, s * sy * 0.2, sz * 0.24);
      }
      /* Durum paneli ve bağlantı bloğu: paket bir kutu değil, ÜSTÜNDE
         okunacak şeyler ve takılacak yerler olan bir makinedir. */
      const durum = ekle(new THREE.Mesh(
        new THREE.BoxGeometry(sx * 0.12, sy * 0.4, sz * 0.14), M.koyu));
      durum.position.set(-sx * 0.5, sy * 0.16, sz * 0.24);
      for (let i = 0; i < 3; i++) {
        const led = ekle(new THREE.Mesh(cylGeoX(sy * 0.022, sy * 0.022, sx * 0.05, 10),
          i === 1 ? M.uyari : M.kit.white));
        led.position.set(-sx * 0.57, sy * (0.05 + i * 0.11), sz * 0.24);
      }
      const blok = ekle(new THREE.Mesh(
        new THREE.BoxGeometry(sx * 0.14, sy * 0.3, sz * 0.1), M.metal));
      blok.position.set(-sx * 0.5, -sy * 0.24, sz * 0.24);
      for (let i = 0; i < 3; i++) {
        const soket = ekle(new THREE.Mesh(cylGeoX(sy * 0.032, sy * 0.032, sx * 0.07, 12), M.koyu));
        soket.position.set(-sx * 0.56, -sy * (0.14 + i * 0.1), sz * 0.24);
      }
      /* Paket anteni kask TEPESİNİ AŞMAZ: uzun bir çubuk beyan edilen boyu
         2,064 m'ye çıkarıyordu ve o beyan, habitatın kapı açıklığı
         denetiminin okuduğu sözleşmedir. */
      const anten = ekle(new THREE.Mesh(cylGeoZ(sy * 0.013, sy * 0.009, sz * 0.28, 8), M.metal));
      anten.position.set(-sx * 0.3, -sy * 0.38, sz * 0.56);
      const lv = D.levha(THREE, M.kit, [p.tech?.no || p.id, 'LIFE SUPPORT'],
        { w: sy * 0.56, h: sz * 0.1 });
      lv.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), -Math.PI / 2);
      lv.position.set(-sx * 0.54, 0, 0);
      g.add(lv);
      break;
    }

    /* ── ikincil oksijen ────────────────────────────────────────────
       İki tüp, bir kelepçe ve bir regülatör. Ana paket kesilirse EVA'yı
       bitirecek kadar oksijen; süs değil, dönüş süresi. */
    case 'kutu': {
      const gv = ekle(new THREE.Mesh(new THREE.BoxGeometry(sx * 0.5, sy, sz * 0.7), M.koyu));
      gv.position.z = -sz * 0.1;
      for (const zs of [-1, 1]) {
        const tup = ekle(new THREE.Mesh(cylGeoY(sz * 0.36, sz * 0.36, sy * 0.86, 12), M.metal));
        tup.position.set(0, 0, sz * 0.12 + zs * sz * 0.3);
        for (const ys of [-1, 1]) {
          const bas = ekle(new THREE.Mesh(new THREE.SphereGeometry(sz * 0.36, 10, 8), M.metal));
          bas.position.set(0, ys * sy * 0.43, sz * 0.12 + zs * sz * 0.3);
        }
      }
      const kelepce = ekle(new THREE.Mesh(
        new THREE.BoxGeometry(sx * 0.56, sy * 0.16, sz * 0.9), M.metal));
      kelepce.position.z = sz * 0.12;
      const reg = ekle(new THREE.Mesh(cylGeoX(sz * 0.22, sz * 0.22, sx * 0.5, 10), M.metal));
      reg.position.set(sx * 0.4, 0, sz * 0.05);
      const gost = ekle(new THREE.Mesh(cylGeoX(sz * 0.13, sz * 0.13, sx * 0.1, 10), M.kit.white));
      gost.position.set(sx * 0.66, 0, sz * 0.05);
      break;
    }

    /* ── kask ───────────────────────────────────────────────────────
       Boyun yatağı, saydam kabarcık, MENTEŞELİ altın vizör, alın siperliği,
       arkada havalandırma kanalı ve önde besleme ağzı. Baş kaskın İÇİNDE
       döner; kask dönmez, o yüzden vizör hep öne bakar. */
    case 'kask': {
      const R = Math.min(sx, sy) * 0.5;
      g.add(yatakHalkasi(THREE, M, R * 0.62, { kalin: 0.016, tirnak: 8, kol: true }))
        .position.z = -sz * 0.47;
      const huni = ekle(kabuk(THREE, M.sert, R * 0.8, sz * 0.2, { seg: 18, uc: 0.2 }));
      huni.position.z = -sz * 0.3;
      /* KASKIN İÇİNDE BİRİ VAR. Boş bir kabarcık, giysiyi giyen birinin
         değil bir mankenin resmidir - ve bir silueti insan yapan en güçlü
         işaret baştır. İçeride kafatası, yüz düzlemi, çene ve Apollo'nun
         CCA haberleşme başlığı ("Snoopy cap") var: beyaz bere, koyu kulaklık
         ve mikrofon kolu. Ten rengi nötr bir orta tondur; amaç birini
         RESMETMEK değil, kaskın boş olmadığını göstermek. */
      const bas = new THREE.Group();
      bas.position.set(-R * 0.04, 0, sz * 0.04);
      g.add(bas);
      const kafa = new THREE.Mesh(new THREE.SphereGeometry(R * 0.6, 18, 14), M.ten);
      kafa.scale.set(0.92, 0.84, 1.06);
      bas.add(kafa);
      const cene = new THREE.Mesh(new THREE.SphereGeometry(R * 0.4, 14, 10), M.ten);
      cene.scale.set(1.05, 0.86, 0.72);
      cene.position.set(R * 0.12, 0, -R * 0.36);
      bas.add(cene);
      const burun = new THREE.Mesh(new THREE.SphereGeometry(R * 0.13, 10, 8), M.ten);
      burun.scale.set(1.5, 0.8, 0.9);
      burun.position.set(R * 0.5, 0, -R * 0.06);
      bas.add(burun);
      for (const s2 of [-1, 1]) {
        const goz = new THREE.Mesh(new THREE.SphereGeometry(R * 0.07, 8, 6), M.koyu);
        goz.position.set(R * 0.44, s2 * R * 0.2, R * 0.08);
        bas.add(goz);
      }
      /* CCA: beyaz bere kafatasını örter, kulaklıklar koyu, mikrofon kolu
         ağzın önüne gelir. Apollo fotoğraflarında kaskın içinde görünen şey. */
      const berem = new THREE.Mesh(
        kureGeoZ(R * 0.63, 18, 14, 0, TAU, 0, Math.PI * 0.62), M.bere);
      berem.scale.set(0.94, 0.88, 1.06);
      bas.add(berem);
      for (const s2 of [-1, 1]) {
        const kulak = new THREE.Mesh(cylGeoY(R * 0.19, R * 0.19, R * 0.1, 12), M.koyu);
        kulak.position.set(-R * 0.04, s2 * R * 0.52, -R * 0.02);
        bas.add(kulak);
      }
      const mikKol = new THREE.Mesh(cylGeoX(R * 0.03, R * 0.03, R * 0.5, 8), M.koyu);
      mikKol.position.set(R * 0.3, R * 0.46, -R * 0.2);
      mikKol.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), -0.5);  // euler-ok: tek eksen
      bas.add(mikKol);
      const mik = new THREE.Mesh(new THREE.SphereGeometry(R * 0.07, 8, 6), M.koyu);
      mik.position.set(R * 0.5, R * 0.24, -R * 0.3);
      bas.add(mik);

      const bub = ekle(new THREE.Mesh(new THREE.SphereGeometry(R, 44, 30), M.cam));
      bub.position.z = sz * 0.06;
      /* Altın vizör KALDIRILMIŞ durumda. İndirilmişken içerideki kişi
         görünmez ve vitrinin işi giysiyi giyen birini göstermek; menteşe de
         ancak kullanıldığında menteşe olduğunu belli eder. Gölgede indirilir. */
      const vpts = [];
      /* Vizör LEVA'nın ön açıklığını TAMAMEN doldurur. Daha dar bir bant
         bırakıldığında açıklığın altı beyaz kalıyordu; referans fotoğrafta
         kaskın bütün önü altın bir aynadır. */
      for (let i = 0; i <= 14; i++) {
        const a = (14 + (i / 14) * 118) * RAD;
        vpts.push(new THREE.Vector2(R * 1.06 * Math.sin(a), R * 1.06 * Math.cos(a)));
      }
      const viz = ekle(latheZYonlu(vpts, 44, M.vizor, PHI_Z.on, 3.24));
      viz.position.z = sz * 0.06;
      /* VİZÖR İNİK. Referans Apollo fotoğrafında altın vizör indirilmiştir ve
         AYNA gibi davranır - kaskın önü, karşısındakini yansıtan altın bir
         disktir. Kaldırılmış hâli içerideki kişiyi gösteriyordu ama aranan
         siluet bu değil. Menteşe ve içerideki kişi duruyor; değişen yalnız
         varsayılan durum. */
      for (const s of [-1, 1]) {
        const men = ekle(new THREE.Mesh(cylGeoY(R * 0.07, R * 0.07, R * 0.16, 8), M.metal));
        men.position.set(0, s * R * 1.02, sz * 0.06 + R * 0.34);
      }
      /* Siperlik ALIN kadar: daha genişi kaskı siyah bir başlığa çevirip
         altındaki altın vizörü gölgeliyor. */
      const spts = [];
      for (let i = 0; i <= 8; i++) {
        const a = (17 + (i / 8) * 20) * RAD;
        spts.push(new THREE.Vector2(R * 1.09 * Math.sin(a), R * 1.09 * Math.cos(a)));
      }
      const sip = ekle(latheZYonlu(spts, 32, M.kumasGolge, PHI_Z.on, 1.9));
      sip.position.z = sz * 0.06;
      /* LEVA: kaskın üstüne geçen BEYAZ dış miğfer - Apollo siluetinin en
         tanınır parçası. İlk denemede kısmi bir küre + torus ağızlık + iki
         siperlikle kurulmuştu ve birbirine giren koyu köşeler çıkıyordu.
         `latheZYonlu` kısmi turu YÖNÜYLE alır: ÖN AÇIKLIĞI bırakıp geri
         kalanı kapatmak tek çağrı. (Burada bir kez "phi = 0 öne bakıyor"
         yazıyordu; ölçüm phi = 0'ın −Y'ye, yani figürün SAĞINA baktığını
         söyledi ve bu kabuk beş kardeşiyle birlikte 90° yan duruyordu.) */
      const acik = 0.92;                       // ön açıklığın yarı açısı (rad)
      const lpts = [];
      for (let i = 0; i <= 14; i++) {
        const a = (8 + (i / 14) * 150) * RAD;
        lpts.push(new THREE.Vector2(R * 1.1 * Math.sin(a), R * 1.1 * Math.cos(a)));
      }
      /* Kaplanan yay ARKADA merkezlidir, çünkü AÇIKLIK öndedir. */
      const leva = ekle(latheZYonlu(lpts, 44, M.kumas, PHI_Z.arka, TAU - 2 * acik));
      leva.position.z = sz * 0.06;
      /* Açıklığın kenarı: ince bir bilezik, miğferin bittiği yeri belli eder. */
      const kpts = [];
      for (let i = 0; i <= 14; i++) {
        const a = (8 + (i / 14) * 150) * RAD;
        kpts.push(new THREE.Vector2(R * 1.15 * Math.sin(a), R * 1.15 * Math.cos(a)));
      }
      for (const yon of [-1, 1]) {
        const kenar = ekle(latheZYonlu(kpts, 8, M.kumasGolge, PHI_Z.on + yon * (acik + 0.06), 0.12));
        kenar.position.z = sz * 0.06;
      }
      /* YAN VİZÖRLER. LEVA'nın iki yanında, menteşeli iki beyaz kanat;
         güneş yanlardan gelirken öne çevrilir, gerekmeyince geriye yatar.
         Apollo kaskının profilden en tanınır ayrıntısı bu ve onsuz miğfer
         düz bir küre kalıyordu. */
      for (const yon of [-1, 1]) {
        const ypts = [];
        for (let i = 0; i <= 10; i++) {
          const a = (34 + (i / 10) * 74) * RAD;
          ypts.push(new THREE.Vector2(R * 1.17 * Math.sin(a), R * 1.17 * Math.cos(a)));
        }
        const yv = ekle(latheZYonlu(ypts, 16, M.kumas, PHI_Z.on + yon * (acik + 0.16), 0.52));
        yv.position.z = sz * 0.06;
        /* Menteşe braketi: kanadın döndüğü yer görünür olmak zorunda. */
        const br = ekle(new THREE.Mesh(
          new THREE.BoxGeometry(R * 0.1, R * 0.1, R * 0.26), M.metal));
        br.position.set(R * 0.62 * Math.cos(acik), yon * R * 1.12 * Math.sin(acik), sz * 0.06 + R * 0.5);
      }
      /* Güneşlik kolu: vizörü indiren düğme, eldivenli elle çevrilebilecek
         kadar büyük. */
      const vkol = ekle(new THREE.Mesh(cylGeoZ(R * 0.07, R * 0.07, R * 0.16, 12), M.uyari));
      vkol.position.set(R * 0.5, 0, sz * 0.06 + R * 0.86);
      const kanal = ekle(new THREE.Mesh(
        new THREE.BoxGeometry(R * 0.34, R * 0.5, sz * 0.46), M.kumasGolge));
      kanal.position.set(-R * 0.98, 0, sz * 0.02);
      const agiz = ekle(new THREE.Mesh(cylGeoX(R * 0.1, R * 0.1, R * 0.3, 10), M.koyu));
      agiz.position.set(R * 0.9, 0, -sz * 0.2);
      break;
    }

    /* ── başlıklar ──────────────────────────────────────────────────
       Dört lamba, kamera ve anten. Vakumda gölge MUTLAK siyahtır: tek kaynak
       mürettebatın kendi elini gölgeler, o yüzden lambalar ayrılır. */
    case 'lamba': {
      /* Lambalar LEVA'NIN YANINA oturur. Kaskın tepesinde bir kafes, Apollo
         siluetini bozan en büyük şeydi: referans fotoğrafta kaskın üstünde
         HİÇBİR ŞEY yok, siluet temiz bir küre olarak biter. İki küçük ünite
         yanlara, kamera da yana alındı. */
      for (const s2 of [-1, 1]) {
        const gv = ekle(new THREE.Mesh(cylGeoX(sz * 0.34, sz * 0.38, sx * 0.34, 12), M.kumasGolge));
        gv.position.set(sx * 0.04, s2 * sy * 0.42, 0);
        const cam = ekle(new THREE.Mesh(cylGeoX(sz * 0.3, sz * 0.3, sx * 0.06, 12), M.kit.white));
        cam.position.set(sx * 0.22, s2 * sy * 0.42, 0);
      }
      const kam = ekle(new THREE.Mesh(new THREE.BoxGeometry(sx * 0.28, sy * 0.14, sz * 0.5), M.kumasGolge));
      kam.position.set(sx * 0.06, -sy * 0.3, -sz * 0.1);
      const lens = ekle(new THREE.Mesh(cylGeoX(sz * 0.2, sz * 0.2, sx * 0.12, 10), M.kit.white));
      lens.position.set(sx * 0.24, -sy * 0.3, -sz * 0.1);
      /* Anten GERİYE yatar ve kask tepesini aşmaz: dik bir çubuk beyan
         edilen boyu 0,26 m şişiriyordu ve bir kapı açıklığı geçecek şeyin
         en yüksek noktasına göre ölçülür. */
      const ant = ekle(new THREE.Mesh(cylGeoZ(sx * 0.02, sx * 0.014, sz * 1.2, 6), M.metal));
      ant.position.set(-sx * 0.46, sy * 0.3, -sz * 0.2);
      ant.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), -0.6);  // euler-ok: tek eksen
      break;
    }

    /* ── göğüs paneli (RCU/DCM) ─────────────────────────────────────
       A7L'de göğüste duran kumanda kutusu. Basınç göstergesi, dört korumalı
       anahtar, bir tahliye vanası. Her kumanda eldivenli elle çevrilecek
       kadar büyük ve dokunarak ayırt edilecek kadar farklı olmak zorunda. */
    case 'panel': {
      /* RCU açık renktir. Göğse siyah bir levha koymak, referans fotoğraftaki
         beyaz kutuyu deliğe çeviriyordu. */
      ekle(new THREE.Mesh(new THREE.BoxGeometry(sx * 0.8, sy, sz), M.kumasGolge));
      const ekran = ekle(new THREE.Mesh(
        new THREE.BoxGeometry(sx * 0.1, sy * 0.46, sz * 0.34), M.kit.white));
      ekran.position.set(sx * 0.44, sy * 0.22, sz * 0.26);
      const gost = ekle(new THREE.Mesh(cylGeoX(sz * 0.22, sz * 0.22, sx * 0.12, 14), M.metal));
      gost.position.set(sx * 0.44, -sy * 0.28, sz * 0.24);
      const ibre = ekle(new THREE.Mesh(
        new THREE.BoxGeometry(sx * 0.02, sy * 0.02, sz * 0.18), M.serit));
      ibre.position.set(sx * 0.51, -sy * 0.28, sz * 0.28);
      ibre.rotation.x = 0.6;
      for (let i = 0; i < 4; i++) {
        const y = (i / 3 - 0.5) * sy * 0.66;
        const kor = ekle(new THREE.Mesh(
          new THREE.BoxGeometry(sx * 0.16, sy * 0.13, sz * 0.16), M.metal));
        kor.position.set(sx * 0.44, y, -sz * 0.24);
        const an = ekle(new THREE.Mesh(cylGeoX(sz * 0.05, sz * 0.05, sx * 0.14, 8),
          i % 2 ? M.uyari : M.serit));
        an.position.set(sx * 0.5, y, -sz * 0.24);
      }
      const vana = ekle(new THREE.Mesh(cylGeoX(sz * 0.14, sz * 0.14, sx * 0.2, 14), M.serit));
      vana.position.set(sx * 0.5, sy * 0.42, -sz * 0.3);
      /* Hortum kelepçeleri ve kör tapalar: bir bağlantı ağzı, bağlansa da
         bağlanmasa da donanımdır. */
      for (const s2 of [-1, 1]) {
        const agiz = ekle(new THREE.Mesh(cylGeoX(sz * 0.17, sz * 0.19, sx * 0.34, 16), M.metal));
        agiz.position.set(-sx * 0.28, s2 * sy * 0.3, -sz * 0.05);
        const kel = ekle(new THREE.Mesh(
          new THREE.TorusGeometry(sz * 0.2, sz * 0.03, 8, 18), M.koyu));
        kel.position.set(-sx * 0.4, s2 * sy * 0.3, -sz * 0.05);
        kel.rotation.y = Math.PI / 2;
      }
      /* Künye: her kumandanın ne olduğu YAZILI olmak zorunda. */
      const etiket = D.levha(THREE, M.kit, ['O2 · H2O · PWR'], { w: sy * 0.6, h: sz * 0.13 });
      etiket.rotateOnWorldAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2);
      etiket.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), Math.PI / 2);
      etiket.position.set(sx * 0.42, 0, -sz * 0.44);
      g.add(etiket);
      break;
    }

    /* ── emniyet halatı ve alet kutusu ──────────────────────────────
       Makara, karabina ve üç alet. Bağlanmamış bir alet EVA'yı tek başına
       bitirir; o yüzden her aletin kendi bağı vardır. */
    case 'halat': {
      ekle(new THREE.Mesh(cylGeoY(sz * 0.44, sz * 0.44, sy * 0.34, 14), M.koyu));
      const sarim = ekle(new THREE.Mesh(
        new THREE.TorusGeometry(sz * 0.32, sz * 0.09, 6, 18), M.kumasGolge));
      sarim.rotation.x = Math.PI / 2;
      const kanca = ekle(new THREE.Mesh(
        new THREE.TorusGeometry(sz * 0.2, sz * 0.045, 6, 14, TAU * 0.82), M.metal));
      kanca.position.set(sx * 0.26, 0, -sz * 0.24);
      kanca.rotation.x = Math.PI / 2;
      for (const [x, boy, mat] of [
        [-sx * 0.3, sz * 0.5, M.metal], [0, sz * 0.4, M.uyari], [sx * 0.3, sz * 0.46, M.kumasGolge],
      ]) {
        const halka = ekle(new THREE.Mesh(
          new THREE.TorusGeometry(sz * 0.1, sz * 0.025, 5, 12), M.metal));
        halka.position.set(x, 0, -sz * 0.3);
        halka.rotation.x = Math.PI / 2;
        const al = ekle(new THREE.Mesh(
          new THREE.BoxGeometry(sz * 0.16, sz * 0.16, boy), mat));
        al.position.set(x, 0, -sz * 0.3 - boy * 0.5);
      }
      break;
    }

    default:
      ekle(new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), M.kumas));
  }
  return g;
}

/* Hortum: paketten göğse giden esnek bağlantı. A7L'de iki hortum göğse
   ÖNDEN girer ve bir giysiyi giysi yapan ayrıntılardan biri budur - kutu bir
   sırt çantası, hortum ise onu SOLUNAN bir şeye bağlar. */
function hortum(THREE, mat, a, b, tepe, r) {
  const egri = new THREE.CatmullRomCurve3([
    new THREE.Vector3(a[0], a[1], a[2]),
    new THREE.Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, tepe),
    new THREE.Vector3(b[0], b[1], b[2]),
  ]);
  return new THREE.Mesh(new THREE.TubeGeometry(egri, 18, r, 8, false), mat);
}

/**
 * Giysiyi kurar.
 *
 * Dönen `uygulaPoz(P)` duruşu geometriyi YENİDEN KURMADAN uygular, o yüzden
 * aynı figür hem duran duruşları hem yürüyüşü oynatır. `P.kalcaZ` verilirse
 * kök yüksekliği ondan hesaplanır (yürüyüş çözümü kalçayı zaten biliyor);
 * verilmezse en alçak nokta ÖLÇÜLÜR - sabit bir ofset çömelmiş figürü
 * havada bırakır.
 */
export function buildAstronaut(THREE, { tokens = {}, poz = 'dik', seritRenk = null } = {}) {
  const M = suitMaterials(THREE, tokens);
  if (seritRenk !== null) M.serit = new THREE.MeshStandardMaterial({
    color: seritRenk, roughness: 0.7, metalness: 0.1 });

  const kok = new THREE.Group();
  /* Gövde eğimi BELDEN: bir insan eğilirken bacakları yerinde kalır. */
  const belZ = DIKEY.bel;
  /* DÖNME kendi grubunda. `bel.rotation` hem eğimi (Y) hem dönmeyi (Z)
     taşısaydı sıra belirsiz olurdu; iç içe iki grup her ikisini de tek
     eksenli tutar. */
  const belDonme = new THREE.Group();
  belDonme.name = 'belDonme';
  belDonme.position.z = belZ;
  const bel = new THREE.Group();
  bel.name = 'belEgim';
  const nodes = new Map();
  const eklem = { kalca: [], diz: [], ayak: [], omuz: [], dirsek: [] };

  for (const p of PARTS) {
    const yerler = kopyaKonumlari(p);
    yerler.forEach((yer, i) => {
      const x = yer[0], y = yer[1], z = yer[2];
      const yan = yerler.length === 2 ? (y >= 0 ? 1 : -1) : 0;
      const gg = govde(THREE, p, M, yan);
      gg.name = yerler.length === 2 ? `${p.id}#${i + 1}` : p.id;
      gg.userData.part = p;
      gg.userData.partId = p.id;
      gg.userData.yan = yan;

      const dizler = nodes.get('alt-govde')?.userData.diz;
      const kolG = nodes.get(i === 0 ? 'kollar' : 'kollar#2') ?? nodes.get('kollar');

      if (p.id === 'cizmeler' && dizler && dizler[i]) {
        /* Çizmenin kaynak noktası AYAK BİLEĞİ ve AYAK BİLEĞİ MAFSALINA
           bağlanır - baldıra bağlansa basma evresinde yere girer. */
        /* AYAK UCU DIŞA DÖNER. Bir insan ayaklarını birbirine paralel
           koymaz; tam paralel iki çizme figürü bir oyuncak askerine çevirir. */
        gg.position.set(x, 0, 0);
        gg.rotation.z = (i === 0 ? 1 : -1) * AYAK_ACILMA * RAD;
        dizler[i].userData.ayak.add(gg);
      } else if (p.id === 'eldivenler' && kolG?.userData.dirsek) {
        gg.position.set(0, 0, kolG.userData.bilekZ);
        kolG.userData.dirsek.add(gg);
      } else if (p.id === 'kollar') {
        /* KOLLAR YAKINSAR. Dimdik asılı bir kol, omuz genişliğini bileğe
           kadar taşır ve figür uyluk ortasından omuza kadar SABİT bir levha
           olur - ölçülen: z 0,71 ile 1,61 arasında genişlik hep 0,40-0,45
           boy oranında. İnsanda el kalçanın yanında biter, omzun yanında
           değil. Uzaklaştırma açısı kendi YUVASINDA durur, böylece poz açısı
           tek eksenli bir dönüş olarak kalır. */
        const yuva = new THREE.Group();
        yuva.position.set(x, y, z + p.size[2] / 2 - belZ);
        yuva.rotation.x = -Math.sign(y || 1) * KOL_YAKINSAMA * RAD;
        bel.add(yuva);
        const omuz = new THREE.Group();
        omuz.name = i === 0 ? 'omuzL' : 'omuzR';
        yuva.add(omuz);
        omuz.add(gg);
        eklem.omuz.push(omuz);
        eklem.dirsek.push(gg.userData.dirsek);
      } else {
        const anne = z > belZ ? bel : kok;
        gg.position.set(x, y, anne === bel ? z - belZ : z);
        anne.add(gg);
      }
      if (p.id === 'alt-govde') {
        eklem.kalca.push(gg.userData.eklem.kalca[0], gg.userData.eklem.kalca[1]);
        eklem.diz.push(gg.userData.eklem.diz[0], gg.userData.eklem.diz[1]);
        eklem.ayak.push(gg.userData.eklem.ayak[0], gg.userData.eklem.ayak[1]);
      }
      nodes.set(i === 0 ? p.id : `${p.id}#${i + 1}`, gg);
    });
  }

  /* HORTUMLAR: paketin ağızlarından göğüs paneline; gövdeyle eğilsin diye
     bele bağlanır, ayrı bir parça değildir. */
  {
    const paket = partById('yasam-paketi'), panel = partById('gogus-paneli');
    const hg = new THREE.Group();
    for (const s of [-1, 1]) {
      const a = [paket.pos[0] + paket.size[0] * 0.4, s * paket.size[1] * 0.2,
        paket.pos[2] + paket.size[2] * 0.24 - belZ];
      const b = [panel.pos[0] - panel.size[0] * 0.3, s * panel.size[1] * 0.3,
        panel.pos[2] - belZ];
      const h = hortum(THREE, M.kumasGolge, a, b, Math.max(a[2], b[2]) + 0.14, 0.026);
      h.castShadow = true;
      hg.add(h);
    }
    bel.add(hg);
    nodes.set('hortumlar', hg);
  }
  belDonme.add(bel);
  kok.add(belDonme);

  /* ÇİZME OFSETİ bir kez ölçülür: ayak bileğinden tabana olan mesafe.
     Yürüyüşte her karede bütün vertexleri taramak pahalıdır ve gereksizdir -
     çözüm kalçanın nerede olduğunu zaten biliyor. */
  const v = new THREE.Vector3();
  const enAltZ = (o) => {
    let z = Infinity;
    o.updateWorldMatrix(true, true);
    o.traverse((m) => {
      const a = m.isMesh && m.geometry?.attributes?.position;
      if (!a) return;
      for (let i = 0; i < a.count; i++) {
        v.fromBufferAttribute(a, i).applyMatrix4(m.matrixWorld);
        if (v.z < z) z = v.z;
      }
    });
    return z;
  };
  kok.updateMatrixWorld(true);

  /* TABAN PROFİLİ ÖLÇÜLÜR, MODELLENMEZ. Bilek açısı değişince tabanın en
     alçak noktası bileğe göre nereye düşer? Bunu "ayak burun mesafesi çarpı
     sin(açı)" diye modellemek yaklaşıktı ve tabanı 3,5-16 mm yere gömüyordu:
     taban düz bir çizgi değil, kalınlığı ve yuvarlatılmış uçları var.
     Bir kez süpürülüp ölçülür ve yürüyüş çözümü o tabloyu okur. */
  const tabanProfili = [];
  {
    const ay = eklem.ayak[0];
    const eski = ay.rotation.y;
    /* ÜST ZİNCİR NÖTRLENİR. Profil, ayakta duruş pozunda ölçülüyordu: kalça
       5° ve diz 9° dönükken bilek açısı 0 olsa bile çizme 4° eğikti, ve
       tablo o eğikliği içine gömdü - her karede sabit 30 mm'lik bir sapma
       olarak çıktı. Bir uzvun profili, kendi açısının fonksiyonu olmak
       zorunda; atalarının değil. */
    const eskiKalca = eklem.kalca[0].rotation.y, eskiDiz = eklem.diz[0].rotation.y;
    eklem.kalca[0].rotation.y = 0;
    eklem.diz[0].rotation.y = 0;
    const [aMin, aMax] = EKLEMLER['ayak.L'].range;
    const bot = nodes.get('cizmeler');
    for (let i = 0; i <= 96; i++) {
      const aci = aMin + (aMax - aMin) * (i / 96);
      ay.rotation.y = aci * RAD * FLEKS.ayak;
      kok.updateMatrixWorld(true);
      tabanProfili.push([aci, ay.getWorldPosition(new THREE.Vector3()).z - enAltZ(bot)]);
    }
    ay.rotation.y = eski;
    eklem.kalca[0].rotation.y = eskiKalca;
    eklem.diz[0].rotation.y = eskiDiz;
    kok.updateMatrixWorld(true);
  }
  /** Bilek açısı için bileğin taban üstündeki yüksekliği (m), doğrusal ara değer. */
  function tabanDusme(aci) {
    const n = tabanProfili.length;
    const a0 = tabanProfili[0][0], a1 = tabanProfili[n - 1][0];
    const u = Math.max(0, Math.min(1, (aci - a0) / (a1 - a0))) * (n - 1);
    const i = Math.min(n - 2, Math.floor(u));
    /* MUHAFAZAKÂR ARA DEĞER. Tabanın en alçak noktası topuktan burna geçerken
       profilde bir KIRIK var ve doğrusal ara değer o kırığı keserek bileği
       fazla alçaltıyordu - taban 2-7 mm gömülüyordu. İki komşu örneğin
       BÜYÜĞÜ alınır: hata artık her zaman yukarı doğru ve ayak asla batmaz. */
    return Math.max(tabanProfili[i][1], tabanProfili[i + 1][1]);
  }

  /* ÇİZME OFSETİ PROFİLDEN GELİR. Önce `DIKEY.ayakBilegi` tasarım
     yüksekliğinden çıkarılıyordu; profil ise gerçek bilek-taban mesafesini
     ölçüyor ve ikisi aynı şey OLMAK zorunda. Değillerdi: aradaki fark her
     karede sabit 30 mm'lik bir sapma olarak çıktı. Tek ölçüm, iki kullanıcı. */
  const botOfset = tabanDusme(0);

  const olcu = Object.freeze({
    uylukM: UYLUK_M, baldirM: BALDIR_M,
    erisimM: UYLUK_M + BALDIR_M,
    bacakM: DIKEY.kalca,
    botOfsetM: botOfset,
    tabanDusme, tabanProfili,
  });

  /** Duruşu uygular. Geometri yeniden kurulmaz. */
  function uygulaPoz(P) {
    bel.rotation.y = (P.govdeEgim ?? 0) * RAD;
    belDonme.rotation.z = sinirla('bel.donme', P.govdeDonme ?? 0) * RAD;
    /* Baş sabitlenir ve ikincil parçalar gövdeyi GECİKMELİ izler. */
    const kask = nodes.get('kask'), lamba = nodes.get('basliklar');
    if (kask) kask.rotation.z = (P.basDonme ?? 0) * RAD;
    if (lamba) lamba.rotation.z = (P.basDonme ?? 0) * RAD;
    const hg = nodes.get('hortumlar'), halat = nodes.get('emniyet-halati');
    if (hg) hg.rotation.z = (P.ikincil?.hortum ?? 0) * RAD;
    if (halat) halat.rotation.z = (P.ikincil?.halat ?? 0) * RAD;
    for (let i = 0; i < 2; i++) {
      /* Her açı kendi ekleminin BEYAN EDİLEN sınırından geçer. Kırpmasız bir
         duruş, giysinin yapamayacağı bir şeyi çizer ve bunu kimse görmez. */
      if (eklem.kalca[i]) eklem.kalca[i].rotation.y =
        sinirla(POZ_EKLEM.kalca[i], P.kalca?.[i] ?? 0) * RAD * FLEKS.kalca;
      if (eklem.diz[i]) eklem.diz[i].rotation.y =
        sinirla(POZ_EKLEM.diz[i], P.diz?.[i] ?? 0) * RAD * FLEKS.diz;
      /* AYAK BİLEĞİ TÜRETİLİR. Baldırın düşeyle açısı kalça - diz'dir;
         tabanın yere düz oturması için bilek tam o kadar ters döner. Poz
         kendi açısını verirse o kullanılır, vermezse hesaplanır - böylece
         hiçbir duruşta ve hiçbir yürüyüş karesinde ayak yere giremez. */
      if (eklem.ayak[i]) {
        /* Ayak bileği en DAR mafsaldır ve tabanı düz tutmak için gereken açı
           salınımda ona sığmaz: kalça 35°, diz 70° iken türev -35° çıkar ama
           giysinin bileği -26°'den fazla açılmaz. Kırpılır - ve sonuç
           doğrudur: gerçek bir yürüyüşte salınan ayak zaten yere paralel
           kalmaz, ucu düşer. */
        const turev = (P.kalca?.[i] ?? 0) - (P.diz?.[i] ?? 0);
        eklem.ayak[i].rotation.y =
          sinirla(POZ_EKLEM.ayak[i], P.ayak?.[i] ?? turev) * RAD * FLEKS.ayak;
      }
      if (eklem.omuz[i]) eklem.omuz[i].rotation.y =
        sinirla(POZ_EKLEM.omuz[i], P.omuz?.[i] ?? 0) * RAD * FLEKS.omuz;
      if (eklem.dirsek[i]) eklem.dirsek[i].rotation.y =
        sinirla(POZ_EKLEM.dirsek[i], P.dirsek?.[i] ?? 0) * RAD * FLEKS.dirsek;
    }
    /* Hareket parçaları kökü milimetrik oynatabilir (nefes gövdeyi kaldırır).
       Ayrı bir alan, çünkü `kalcaZ` yürüyüş çözümünün ÇIKTISIDIR ve ikisini
       aynı sayıya yazmak, nefesi yürüyüşün yerine geçirirdi. */
    const zOfset = P.kalcaZOfset ?? 0;
    if (P.kalcaZ != null) {
      /* Yürüyüş çözümü kalçanın yüksekliğini zaten verir: basan ayağın
         tabanı tam z = 0'a oturur, ölçüm gerekmez. */
      kok.position.z = botOfset + P.kalcaZ - DIKEY.kalca + zOfset;
    } else {
      kok.position.z = 0;
      kok.position.z = -enAltZ(kok) + zOfset;
    }
    kok.userData.poz = P;
  }

  const P0 = typeof poz === 'string' ? (POZLAR[poz] ?? POZLAR.dik) : poz;
  uygulaPoz(P0);

  /* RİG YAYIMLANIR. `craft-blocks`'un `finalize`'ı ile aynı sözleşme: her
     eklemin düğümü ağaçta ARANIR ve bulunamayan `found: false` ile
     işaretlenir - sessizce yanlış bir ad yok. */
  {
    const joints = {};
    for (const [ad, spec] of Object.entries(EKLEMLER)) {
      joints[ad] = { deg: true, ...spec, found: !!kok.getObjectByName(spec.node) };
    }
    kok.userData.rig = {
      kind: 'astronaut', units: 'm', scaleToRoot: 1, joints,
      contacts: ['cizmeler', 'cizmeler#2'],
      massClass: 'A7L sınıfı yüzey giysisi (~120 kg)',
    };
  }
  kok.userData.notes = { regime: 'yüzey EVA',
    why: `Giysili boy ${BOY_M} m, omuz ${OMUZ_M} m: habitat kapısı ve tutamak aralıkları bu ölçüye göre belirlenir, çıplak insana göre değil.` };
  return { root: kok, bel, nodes, eklem, materials: M, poz: P0, uygulaPoz, olcu };
}

export { PARTS, partById, DIKEY, EKLEMLER, POZ_EKLEM, sinirla };
