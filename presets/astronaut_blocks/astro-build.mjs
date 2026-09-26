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
} from './astro-parts.mjs';
import { supur, uzuvKesiti, govdeKesiti } from './astro-body.mjs';
import { cylGeoX, cylGeoY, cylGeoZ, latheZ } from '../core/geometry-axis.mjs';
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
    sert: std(tk.sert ?? 0xe2e5ea, 0.42, 0.28),
    metal: std(tk.metal ?? 0x9aa2ae, 0.32, 0.88),
    koyu: std(tk.koyu ?? 0x3b4049, 0.6, 0.45),
    taban: std(tk.taban ?? 0x25282e, 0.95, 0.05),
    uyari: std(tk.uyari ?? 0xd8b23a, 0.6, 0.15),
    bayrak: std(tk.bayrak ?? 0x2f4f8f, 0.75, 0.05),
    /* ALTIN VİZÖR. metalness 0,96 + roughness 0,06, ORTAM HARİTASI OLMAYAN
       bir sahnede yansıtacak hiçbir şey bulamaz ve saf metal SİYAH çıkar -
       kaskın önü altın bir disk olacakken donuk bir delik oluyordu. Yarı
       metalik ve biraz pürüzlü bir altın, doğrudan ışıkta gerçekten altın
       görünür; ayrıca kendi sıcaklığını taşısın diye hafif bir yayım var. */
    vizor: new THREE.MeshStandardMaterial({ color: 0xe8b552, roughness: 0.18,
      metalness: 0.55, emissive: 0x2a1c06, side: THREE.DoubleSide }),
    cam: new THREE.MeshStandardMaterial({ color: 0xa8cadd, roughness: 0.04,
      metalness: 0.08, transparent: true, opacity: 0.22, side: THREE.DoubleSide }),
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
  }), { dilim: 6, halka: 18 }));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const w = wUst + (wAlt - wUst) * t, d = dUst + (dAlt - dUst) * t;
    const k = new THREE.Mesh(new THREE.TorusGeometry(w, w * 0.2, 6, 18), M.kumasGolge);
    k.scale.x = d / w;
    k.position.z = -t * boy;
    g.add(k);
  }
  return g;
}

/**
 * Yatak halkası. Konvolüt bükmeyi verir, DÖNMEYİ vermez: omuz, dirsek,
 * bilek, bel, kalça, diz ve ayak bileği dönüşü rulmanlı halkalardan gelir.
 */
function yatakHalkasi(THREE, M, r, { kalin = 0.02, tirnak = 8, kol = false, basik = 1 } = {}) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(cylGeoZ(r * 1.05, r * 1.05, kalin * 2.4, 26), M.metal));
  g.add(new THREE.Mesh(cylGeoZ(r * 1.13, r * 1.13, kalin, 26), M.koyu));
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
/** Bir mafsalın poz açısını radyana ve DOĞRU işarete çevirir. */
export const mafsal = (poz, ad, i) => (poz?.[ad]?.[i] ?? 0) * RAD * FLEKS[ad];

export const POZLAR = Object.freeze({
  dik: { ad: 'Standing', kalca: [0, 0], diz: [2, 2], omuz: [5, 5], dirsek: [16, 16], govdeEgim: 0 },
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
      }), { dilim: 12, halka: 20 }));
      t.position.z = sz * 0.46;
      /* Tulumun bacakları GİYSİNİN UYLUKLARIYLA aynı eksende ve daha ince
         olmak zorunda. y = ±sy*0,2'de duruyorlardı, yani iki uyluğun ARASINA
         düşüyor ve kırmızı serpantin dışarıdan görünüyordu: giysinin en dış
         katmanı, tene giyilen katman oluyordu. */
      for (const s of [-1, 1]) {
        const b = ekle(uzuvMesh(THREE, M.koyu, sz * 0.42, uzuvKesiti({
          ustW: sy * 0.14, ustD: sx * 0.15, altW: sy * 0.1, altD: sx * 0.11, sis: 0.04,
        }), { dilim: 6, halka: 14 }));
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
      const brief = ekle(uzuvMesh(THREE, M.kumas, belZ - kalcaZ + 0.26, uzuvKesiti({
        ustW: sy * 0.44, ustD: sx * 0.46, altW: sy * 0.54, altD: sx * 0.52, sis: 0.03,
        p: 2.7, kapitone: [4, 0.05], dikis: [6, 0.05],
      }), { dilim: 12, halka: 22 }));
      brief.position.z = belZ;
      const bel = yatakHalkasi(THREE, M, sy * 0.42,
        { kalin: 0.022, tirnak: 10, kol: true, basik: sx / sy });
      bel.position.z = belZ;
      g.add(bel);
      /* Alet askıları: kalçada, eldivenli elin ulaşabileceği yerde. */
      for (const s of [-1, 1]) {
        const ask = ekle(new THREE.Mesh(
          new THREE.TorusGeometry(sy * 0.05, sy * 0.014, 5, 12), M.metal));
        ask.position.set(-sx * 0.1, s * sy * 0.5, kalcaZ + 0.04);
        ask.rotation.x = Math.PI / 2;
      }

      const eklem = { kalca: [], diz: [], ayak: [] };
      for (const [i, s] of [[0, 1], [1, -1]]) {
        const kalca = new THREE.Group();
        kalca.position.set(0, s * sy * 0.29, kalcaZ);
        g.add(kalca);
        eklem.kalca.push(kalca);
        kalca.add(konvolut(THREE, M, sy * 0.26, sx * 0.25, sy * 0.25, sx * 0.245, 0.07, 2));
        const uyluk = uzuvMesh(THREE, M.kumas, UYLUK_M - 0.07, uzuvKesiti({
          ustW: sy * 0.25, ustD: sx * 0.245, altW: sy * 0.2, altD: sx * 0.2,
          sis: 0.07, sisT: 0.26, p: 2.25, kapitone: [6, 0.075], dikis: [8, 0.045],
        }), { dilim: 14, halka: 22 });
        uyluk.position.z = -0.07;
        uyluk.castShadow = true; uyluk.receiveShadow = true;
        kalca.add(uyluk);
        /* Uyluk cebi: A7L'de örnek torbası ve kontrol listesi oradadır. */
        const cep = new THREE.Mesh(
          new THREE.BoxGeometry(sx * 0.16, sy * 0.2, UYLUK_M * 0.32), M.kumasGolge);
        cep.position.set(sx * 0.26, s * sy * 0.2, -UYLUK_M * 0.56);
        kalca.add(cep);

        const diz = new THREE.Group();
        diz.position.z = -UYLUK_M;
        kalca.add(diz);
        eklem.diz.push(diz);
        diz.add(konvolut(THREE, M, sy * 0.205, sx * 0.205, sy * 0.2, sx * 0.2, 0.1, 3));
        /* Diz kapağı: konvolütü koruyan EĞRİ plaka. */
        const kapak = new THREE.Mesh(
          new THREE.SphereGeometry(sy * 0.245, 14, 10, -0.8, 1.6, 0.9, 1.1), M.kumasGolge);
        kapak.rotation.x = Math.PI / 2;
        kapak.position.z = -0.05;
        diz.add(kapak);
        const baldir = uzuvMesh(THREE, M.kumas, BALDIR_M - 0.1, uzuvKesiti({
          ustW: sy * 0.225, ustD: sx * 0.23, altW: sy * 0.17, altD: sx * 0.18,
          sis: 0.1, sisT: 0.22, p: 2.25, kapitone: [6, 0.07], dikis: [8, 0.045],
        }), { dilim: 14, halka: 22 });
        baldir.position.z = -0.1;
        baldir.castShadow = true; baldir.receiveShadow = true;
        diz.add(baldir);
        const ayakY = yatakHalkasi(THREE, M, sy * 0.175, { kalin: 0.013, tirnak: 6 });
        ayakY.position.z = -BALDIR_M;
        diz.add(ayakY);
        /* Havalandırma hattı baldırın arkasından iner. */
        const hat = new THREE.Mesh(cylGeoZ(sx * 0.022, sx * 0.022, BALDIR_M * 0.8, 8), M.koyu);
        hat.position.set(-sx * 0.22, 0, -BALDIR_M * 0.55);
        diz.add(hat);
        /* AYAK BİLEĞİ MAFSALI. Çizme baldıra sabit bağlıyken basma evresinde
           baldır eğildikçe ayak da eğiliyor ve burun ya da topuk yere
           giriyordu - ölçülen: Ay'da taban 0,107 m yerin altında. Bir ayak
           bileği yalnız bir ayrıntı değil, tabanı yere DÜZ tutan şeydir. */
        const ayak = new THREE.Group();
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
      }), { dilim: 8, halka: 20 }));
      ust.position.z = -boy * 0.22;
      /* Ayak: burun yuvarlak, topuk kısa ve dik. */
      const tabanZ = -boy * 0.8;
      const orta = ekle(new THREE.Mesh(
        new THREE.BoxGeometry(uz * 0.5, gen * 1.0, boy * 0.26), M.kumasGolge));
      orta.position.set(uz * 0.06, 0, tabanZ + boy * 0.14);
      const burun = ekle(new THREE.Mesh(new THREE.SphereGeometry(gen * 0.5, 14, 10), M.kumasGolge));
      burun.scale.set(uz * 0.88 / gen, 1, 0.6);
      burun.position.set(uz * 0.3, 0, tabanZ + boy * 0.14);
      const topuk = ekle(new THREE.Mesh(new THREE.SphereGeometry(gen * 0.48, 12, 9), M.kumasGolge));
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
      const kayis = ekle(new THREE.Mesh(
        new THREE.TorusGeometry(gen * 0.56, gen * 0.05, 5, 14), M.koyu));
      kayis.scale.set(uz * 0.72 / gen, 1, 1);
      kayis.position.set(uz * 0.02, 0, tabanZ + boy * 0.28);
      kayis.rotation.x = Math.PI / 2;
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
        omuzT: 0.26, p: 2.2, kapitone: [4, 0.03], dikis: [5, 0.03],
      }), { dilim: 18, halka: 28 }));
      kab.position.z = sz / 2;
      /* Göğüs dolgusu: basınç kumaşı şişirir ve öne eğilebilmek için ÖNDE
         yer bırakılır, o yüzden göğüs sırttan dolgundur. */
      const gpts = [];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        gpts.push(new THREE.Vector2(
          Math.max(sx * (0.44 + 0.2 * Math.sin(Math.PI * t)), 0.02), (t - 0.46) * sz * 0.88));
      }
      const gogus = ekle(latheZ(gpts, 20, M.sert, -1.0, 2.0));
      gogus.scale.y = sy * 0.9 / sx;
      /* Omuz boyundurukları ve YAMUK KASI. Omuz çizgisi boyundan omuza
         DÜŞER; düz bir tepe çizgisi gövdeyi kutu yapar ve bir insan
         siluetinde omuz hiçbir zaman yatay değildir. */
      for (const s of [-1, 1]) {
        const om = ekle(new THREE.Mesh(new THREE.SphereGeometry(sy * 0.24, 16, 12), M.kumas));
        om.scale.set(sx * 0.5 / (sy * 0.24) * 0.58, 1, 0.8);
        om.position.set(0, s * sy * 0.31, sz * 0.2);
        /* Boyundan omuza İNEN eğim. İlk denemede kütleler hem yüksek hem
           x'te 1,7 kat gerili olduğu için omuz düz bir RAFA dönüyordu -
           eğim vermek isterken tam tersini yapıyordu. Küçük, dar ve gerçekten
           alçalan üç kütle. */
        for (let i = 1; i <= 3; i++) {
          const u = i / 3;
          const yam = ekle(new THREE.Mesh(
            new THREE.SphereGeometry(sy * (0.145 - 0.04 * u), 12, 9), M.kumas));
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
      }), { dilim: 4, halka: 18 }));
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
      const kap = ekle(new THREE.Mesh(new THREE.SphereGeometry(sy * 0.62, 14, 10), M.kumas));
      kap.scale.set(0.86, 1, 0.74);
      g.add(yatakHalkasi(THREE, M, sy * 0.56, { kalin: 0.014, tirnak: 6 }));
      g.add(konvolut(THREE, M, sy * 0.57, sx * 0.54, sy * 0.56, sx * 0.53, sz * 0.09, 2));
      const ust = uzuvMesh(THREE, M.kumas, ustBoy - sz * 0.09, uzuvKesiti({
        ustW: sy * 0.56, ustD: sx * 0.53, altW: sy * 0.44, altD: sx * 0.44,
        sis: 0.08, sisT: 0.2, p: 2.25, kapitone: [6, 0.085], dikis: [6, 0.04],
      }), { dilim: 12, halka: 20 });
      ust.position.z = -sz * 0.09;
      ust.castShadow = true; ust.receiveShadow = true;
      g.add(ust);

      const dirsek = new THREE.Group();
      dirsek.position.z = -ustBoy;
      g.add(dirsek);
      g.userData.dirsek = dirsek;
      dirsek.add(konvolut(THREE, M, sy * 0.47, sx * 0.47, sy * 0.46, sx * 0.46, sz * 0.1, 3));
      const fincan = new THREE.Mesh(
        new THREE.SphereGeometry(sy * 0.56, 12, 9, -0.8, 1.6, 0.9, 1.1), M.kumasGolge);
      fincan.rotation.x = -Math.PI / 2;
      fincan.position.z = -sz * 0.05;
      dirsek.add(fincan);
      const on = uzuvMesh(THREE, M.kumas, onBoy - sz * 0.1, uzuvKesiti({
        ustW: sy * 0.46, ustD: sx * 0.46, altW: sy * 0.34, altD: sx * 0.35,
        sis: 0.09, sisT: 0.22, p: 2.25, kapitone: [6, 0.08], dikis: [6, 0.04],
      }), { dilim: 12, halka: 20 });
      on.position.z = -sz * 0.1;
      on.castShadow = true; on.receiveShadow = true;
      dirsek.add(on);
      const bilek = yatakHalkasi(THREE, M, sy * 0.36, { kalin: 0.014, tirnak: 6, kol: true });
      bilek.position.z = -onBoy;
      dirsek.add(bilek);
      if (yan >= 0) {
        const kitap = new THREE.Mesh(
          new THREE.BoxGeometry(sy * 0.46, sy * 0.12, onBoy * 0.3), M.kit.white);
        kitap.position.set(sy * 0.34, 0, -onBoy * 0.56);
        dirsek.add(kitap);
      } else {
        const ayna = new THREE.Mesh(
          new THREE.BoxGeometry(sy * 0.38, sy * 0.04, sy * 0.32), M.metal);
        ayna.position.set(sy * 0.34, 0, -onBoy * 0.56);
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
      const rB = sy * 0.48, uz = sx, boy = sz;
      g.add(yatakHalkasi(THREE, M, rB, { kalin: 0.012, tirnak: 6 }));
      const mansetBoy = boy * 0.34;
      ekle(uzuvMesh(THREE, M.kumasGolge, mansetBoy, uzuvKesiti({
        ustW: rB, ustD: rB * 0.96, altW: rB * 0.86, altD: rB * 0.78, sis: 0.02,
        p: 2.4, kapitone: [2, 0.05],
      }), { dilim: 5, halka: 16 }));
      const avuc = ekle(new THREE.Mesh(
        new THREE.BoxGeometry(uz * 0.34, sy * 0.88, boy * 0.3), M.kumasGolge));
      avuc.position.set(uz * 0.04, 0, -mansetBoy - boy * 0.15);
      const ped = ekle(new THREE.Mesh(
        new THREE.BoxGeometry(uz * 0.28, sy * 0.72, boy * 0.05), M.taban));
      ped.position.set(uz * 0.2, 0, -mansetBoy - boy * 0.15);
      const parmakZ = -mansetBoy - boy * 0.3;
      for (let i = 0; i < 4; i++) {
        const kok = new THREE.Group();
        kok.position.set(uz * 0.06, (i / 3 - 0.5) * sy * 0.64, parmakZ);
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
      bp.position.set(uz * 0.15, -sy * 0.4, -mansetBoy - boy * 0.16);
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
      }), { dilim: 8, halka: 26 }));
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
        new THREE.SphereGeometry(R * 0.63, 18, 14, 0, TAU, 0, Math.PI * 0.62), M.bere);
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

      const bub = ekle(new THREE.Mesh(new THREE.SphereGeometry(R, 26, 18), M.cam));
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
      const viz = ekle(latheZ(vpts, 26, M.vizor, -1.62, 3.24));
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
      const sip = ekle(latheZ(spts, 20, M.kumasGolge, -0.95, 1.9));
      sip.position.z = sz * 0.06;
      /* LEVA: kaskın üstüne geçen BEYAZ dış miğfer - Apollo siluetinin en
         tanınır parçası. İlk denemede kısmi bir küre + torus ağızlık + iki
         siperlikle kurulmuştu ve birbirine giren koyu köşeler çıkıyordu.
         `latheZ` zaten kısmi tur destekliyor ve phi = 0 +X'e (öne) bakıyor:
         ÖN AÇIKLIĞI bırakıp geri kalanı kapatmak tek çağrı. */
      const acik = 0.92;                       // ön açıklığın yarı açısı (rad)
      const lpts = [];
      for (let i = 0; i <= 14; i++) {
        const a = (8 + (i / 14) * 150) * RAD;
        lpts.push(new THREE.Vector2(R * 1.1 * Math.sin(a), R * 1.1 * Math.cos(a)));
      }
      const leva = ekle(latheZ(lpts, 26, M.kumas, acik, TAU - 2 * acik));
      leva.position.z = sz * 0.06;
      /* Açıklığın kenarı: ince bir bilezik, miğferin bittiği yeri belli eder. */
      const kpts = [];
      for (let i = 0; i <= 14; i++) {
        const a = (8 + (i / 14) * 150) * RAD;
        kpts.push(new THREE.Vector2(R * 1.15 * Math.sin(a), R * 1.15 * Math.cos(a)));
      }
      for (const yon of [-1, 1]) {
        const kenar = ekle(latheZ(kpts, 8, M.kumasGolge, yon > 0 ? acik : TAU - acik - 0.12, 0.12));
        kenar.position.z = sz * 0.06;
      }
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
      const vana = ekle(new THREE.Mesh(cylGeoX(sz * 0.14, sz * 0.14, sx * 0.2, 10), M.serit));
      vana.position.set(sx * 0.5, sy * 0.42, -sz * 0.3);
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
  const bel = new THREE.Group();
  bel.position.z = belZ;
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
        gg.position.set(x, 0, 0);
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
      const h = hortum(THREE, M.koyu, a, b, Math.max(a[2], b[2]) + 0.14, 0.022);
      h.castShadow = true;
      hg.add(h);
    }
    bel.add(hg);
    nodes.set('hortumlar', hg);
  }
  kok.add(bel);

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
  const botOfset = DIKEY.ayakBilegi - enAltZ(nodes.get('cizmeler'));

  const olcu = Object.freeze({
    uylukM: UYLUK_M, baldirM: BALDIR_M,
    erisimM: UYLUK_M + BALDIR_M,
    bacakM: DIKEY.kalca,
    botOfsetM: botOfset,
  });

  /** Duruşu uygular. Geometri yeniden kurulmaz. */
  function uygulaPoz(P) {
    bel.rotation.y = (P.govdeEgim ?? 0) * RAD;
    for (let i = 0; i < 2; i++) {
      if (eklem.kalca[i]) eklem.kalca[i].rotation.y = mafsal(P, 'kalca', i);
      if (eklem.diz[i]) eklem.diz[i].rotation.y = mafsal(P, 'diz', i);
      /* AYAK BİLEĞİ TÜRETİLİR. Baldırın düşeyle açısı kalça - diz'dir;
         tabanın yere düz oturması için bilek tam o kadar ters döner. Poz
         kendi açısını verirse o kullanılır, vermezse hesaplanır - böylece
         hiçbir duruşta ve hiçbir yürüyüş karesinde ayak yere giremez. */
      if (eklem.ayak[i]) {
        const turev = (P.kalca?.[i] ?? 0) - (P.diz?.[i] ?? 0);
        eklem.ayak[i].rotation.y = (P.ayak?.[i] ?? turev) * RAD * FLEKS.ayak;
      }
      if (eklem.omuz[i]) eklem.omuz[i].rotation.y = mafsal(P, 'omuz', i);
      if (eklem.dirsek[i]) eklem.dirsek[i].rotation.y = mafsal(P, 'dirsek', i);
    }
    if (P.kalcaZ != null) {
      /* Yürüyüş çözümü kalçanın yüksekliğini zaten verir: basan ayağın
         tabanı tam z = 0'a oturur, ölçüm gerekmez. */
      kok.position.z = botOfset + P.kalcaZ - DIKEY.kalca;
    } else {
      kok.position.z = 0;
      kok.position.z = -enAltZ(kok);
    }
    kok.userData.poz = P;
  }

  const P0 = typeof poz === 'string' ? (POZLAR[poz] ?? POZLAR.dik) : poz;
  uygulaPoz(P0);

  kok.userData.notes = { regime: 'yüzey EVA',
    why: `Giysili boy ${BOY_M} m, omuz ${OMUZ_M} m: habitat kapısı ve tutamak aralıkları bu ölçüye göre belirlenir, çıplak insana göre değil.` };
  return { root: kok, bel, nodes, eklem, materials: M, poz: P0, uygulaPoz, olcu };
}

export { PARTS, partById, DIKEY };
