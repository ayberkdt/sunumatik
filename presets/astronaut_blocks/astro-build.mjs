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
  PARTS, partById, BOY_M, OMUZ_M, BOYUN_CAP_M, DIKEY, UYLUK_M, BALDIR_M,
  AYAK_ON_M, AYAK_ARKA_M, AYAK_EN_M, EL_CERCEVE, kopyaKonumlari,
  EKLEMLER, POZ_EKLEM, sinirla,
} from './astro-parts.mjs';
import { supur, uzuvKesiti, govdeKesiti, cizmeGovdesi, ayakEni, ayakBoyu,
         kapitoneKat, dikisKat, kirisikKat } from './astro-body.mjs';
import { kumasNormalHaritasi, kumasPuruzHaritasi, metalNormalHaritasi,
         DOKU_TEKRAR } from './astro-doku.mjs';
import { ortamOrtme } from './astro-ao.mjs';
import { cylGeoX, cylGeoY, cylGeoZ, kureGeoZ, pahliKutuGeo, latheZ, latheZYonlu,
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
    /* ── DOKULAR. Düz renk artı iki sayı ile aydınlatılan bir yüzey
       boyanmış plastiktir; bir giysiyi kumaş yapan şey DOKUMADIR. Haritalar
       yordamsal ve `DataTexture` ile üretilir: kapılar node'da koşuyor ve
       orada canvas yok, yani ölçülen şey gösterilen şey olsun diye aynı kod
       iki yerde de çalışmak zorunda. UV'ler metre cinsinden olduğu için
       `repeat` doğrudan "metrede kaç karo" demektir. */
    /* İŞLENMİŞ metal: yatak bilezikleri, menteşe pimleri, boru ağızları.
       Sayıldı: bu malzeme tek başına figürün 481 mesh'inin 192'sini (%40)
       kaplıyordu - vida da toka da braket de kasnak da AYNI aynaydı ve bir
       giysinin donanımı o yüzden oyuncak gibi okunuyordu. Gerçekte bunların
       çoğu ELOKSALLI alüminyumdur: metalliği tamdır ama MATTIR. */
    metal: Object.assign(std(tk.metal ?? 0xa8b0bc, 0.24, 0.96), { envMapIntensity: 1.25 }),
    eloksal: Object.assign(std(tk.eloksal ?? 0x9aa1ab, 0.44, 1.0), { envMapIntensity: 0.85 }),
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
    /* KONVOLÜT HALKASI SİLUETE GİRER. Boru yarıçapı w*0,2, yani bir uzuvda
       yaklaşık 28 mm: 10 kesit segmenti orada 36°'lik kenar açısı bırakır ve
       giysinin en çok tekrar eden ayrıntısı (her uzuvda 3-4 halka, figürde
       34 tane) köşeli görünür. 14 segment onu 26°'ye indirir. Bedel
       HESAPLANDI (ölçülmedi, çünkü aynı sürümde eldiven de değişti):
       34 halka x (14x30 - 10x28) x 2 = 9.520 üçgen, figürün ~%8'i. */
    const k = new THREE.Mesh(new THREE.TorusGeometry(w, w * 0.2, 14, 30), M.kumasGolge);
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
function mafsalGovdesi(THREE, mat, w, d, {
  doluluk = 1.0, seg = 26, kapitone = [3, 0.030], dikis = [6, 0.020],
  kirisik = [1.4, 0.012],
} = {}) {
  /* KÜRE TOPOLOJİSİ + UZVUN YÜZEYİ.
     Ölçülen: diz gövdesi 0,260 x 0,286, yanındaki baldır 0,261 x 0,279 -
     top uzuvdan yalnız %2,5 kalın, yani BOYUT hiç sorun değildi. Sorun
     YÜZEYDİ: uzuvlar konvolütlü, eklem pürüzsüz bir küreydi ve aynı çapta
     farklı dokulu iki yüzey yan yana gelince göz onları tek parça değil
     "takılmış bir top" diye okur.

     Süpürme gövdesi denendi ve SÜREKLİLİĞİ bozdu: sivri uçlu bir elipsoidin
     uç bandında yüzey neredeyse eksene dik kalıyor, sarım dışa bakan bir
     yüzeyi tarif etmiyor (ölçüldü: 225 köşenin 22'si içe) ve arkaya bakan
     üçgen ışına da kameraya da görünmez - 72 ışından biri gövdenin kendi
     ekseninin 5° yanından geçip 90 mm ÖTEDEKİ duvara çarpıyordu.

     Küre bu tuzakların hiçbirini taşımaz: bantlar düzgün, yüzeyin ortasında
     tekillik yok, kapalı. Ve zaten seçilme sebebi bu: her yönden aynı
     yarıçap, yani içinden geçen yüzey HİÇBİR açıda kopamaz. */
  const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7));
  const poz = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < poz.count; i++) {
    v.fromBufferAttribute(poz, i);
    /* t: kutuptan kutba (0..1), aci: ekvator boyunca (0..2pi) - uzuv
       süpürmesindeki iki parametrenin aynısı, o yüzden desen de aynı. */
    const tt = 0.5 - Math.asin(Math.max(-1, Math.min(1, v.y))) / Math.PI;
    const aci = Math.atan2(v.z, v.x) + Math.PI;
    const k = kapitoneKat(tt, kapitone?.[0], kapitone?.[1])
      * dikisKat(aci, dikis?.[0], dikis?.[1])
      * kirisikKat(tt, aci, kirisik?.[0], kirisik?.[1]);
    poz.setXYZ(i, v.x * k, v.y * k, v.z * k);
  }
  g.computeVertexNormals();
  const k = new THREE.Mesh(g, mat);
  /* Kesit eliptiktir: mafsal, bağladığı uzvun kesitini izler - yoksa ince
     bir bileğe yuvarlak bir top takılmış gibi durur. */
  k.scale.set(d * doluluk, w * doluluk, w * doluluk * 0.96);
  /* Kapı bu gövdeleri ADIYLA bulur: en büyük çocuğu seçmek, bir gün başka
     bir şey büyüdüğünde sessizce yanlış şeyi ölçmeye başlar. */
  k.userData.mafsalGovdesi = { w: w * doluluk, d: d * doluluk };
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
    const t = new THREE.Mesh(pahliKutuGeo(r * 0.1, r * 0.13, kalin * 1.8), M.eloksal);
    t.position.set(Math.cos(a) * r * 1.11, Math.sin(a) * r * 1.11, 0);
    t.rotation.z = a;
    g.add(t);
  }
  if (kol) {
    /* Kilit kolu: eldivenli elle çevrilecek kadar büyük olmak zorunda. */
    const k = new THREE.Mesh(pahliKutuGeo(r * 0.7, r * 0.16, kalin * 1.4), M.uyari);
    k.position.set(r * 1.2, 0, kalin * 1.2);
    g.add(k);
  }
  g.scale.x = basik;
  return g;
}

/** Bir yüzeye yapışan yama/etiket. */
function yama(THREE, mat, w, h, kal = 0.006, egriR = 0.30) {
  /* Bir çıkartma yüzeye BASILIR, üstünde durmaz: eğri bir gövdeye konan düz
     bir dörtgen kenarlarından kalkar ve gölgesiyle birlikte "yapıştırılmış
     etiket" gibi okunur. Yarıçap gövdenin kendi eğriliğidir. */
  return new THREE.Mesh(pahliKutuGeo(kal, w, h, 0.0015, { egriR }), mat);
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

/* DURUŞLAR ARTIK YEDİ EKSEN KULLANIR. Bu tablo dört eksenle yazıldığında
   figür her pozda aynı ele ve dimdik bir kola sahipti - ölçülen: omuzdan
   dirseğe Δx tam sıfır, yani hazır ol vaziyetinde bir asker. İnsanda taşıma
   açısı 5-15°dir, dirsek omzun biraz ARKASINDA durur ve avuç gövdeye bakar.

   `omuzAcilma` kolu gövdeden ayırır, `omuzDonme` üst kolu kendi ekseninde
   çevirir, `onkolDonme` avucu çevirir, `kalcaAcilma` bacağı açar. Hepsi
   beyan edilen sınırlardan geçer; verilmeyen eksen 0'dır. */
export const POZLAR = Object.freeze({
  dik: { ad: 'Standing', kalca: [5, 5], diz: [9, 9], omuz: [-4, -4], dirsek: [14, 14],
    /* Dinlenmede omuz AÇILMAZ: kolun gövdeye yakınsaması zaten
       `KOL_YAKINSAMA` ile yuvadan geliyor ve üstüne abdüksiyon eklemek
       bileği omzun DIŞINA çıkarıyor (ölçüldü: 7°'de 0,306 > 0,300 ve
       bölüm 7'nin yakınsama sınavı düşüyor). "Hazır ol"dan çıkaran şey
       açılma değil, omzun hafif GERİDE ve dirseğin bükük olmasıdır. */
    omuzAcilma: [0, 0], omuzDonme: [10, 10], onkolDonme: [-14, -14],
    kalcaAcilma: [3, 3], govdeEgim: 2 },
  egilme: { ad: 'Crouched at a task', kalca: [52, 52], diz: [66, 66], omuz: [34, 34],
    dirsek: [58, 58], omuzAcilma: [16, 16], omuzDonme: [-18, -18],
    /* Bir işe eğilen kişinin AVUÇLARI işe döner: iki el de içe supinasyon. */
    onkolDonme: [46, 46], kalcaAcilma: [9, 9], govdeEgim: 26 },
  uzanma: { ad: 'Reaching up to a panel', kalca: [0, 0], diz: [6, 6], omuz: [104, 30],
    dirsek: [22, 14], omuzAcilma: [24, 9], omuzDonme: [32, 6],
    /* Panele uzanan el AVUCUNU panele çevirir - bu, dönme ekseni olmadan
       yapılamayan şeyin ta kendisiydi. */
    onkolDonme: [64, 10], kalcaAcilma: [2, 2], govdeEgim: -6 },
  tasima: { ad: 'Carrying a load', kalca: [8, 8], diz: [12, 12], omuz: [48, 48],
    dirsek: [74, 74], omuzAcilma: [12, 12], omuzDonme: [-24, -24],
    /* Yük taşıyan avuçlar YUKARI bakar. */
    onkolDonme: [58, 58], kalcaAcilma: [5, 5], govdeEgim: 8 },
  selam: { ad: 'Saluting', kalca: [0, 0], diz: [2, 2], omuz: [96, 4], dirsek: [118, 14],
    omuzAcilma: [38, 6], omuzDonme: [26, 8], onkolDonme: [-38, -10],
    kalcaAcilma: [2, 2], govdeEgim: -2 },
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

      const eklem = { kalca: [], diz: [], ayak: [], kalcaAcilma: [] };
      for (const [i, s] of [[0, 1], [1, -1]]) {
        /* KALÇA DA İKİ EKSENDİR: açılma (abdüksiyon) kendi grubunda, çünkü
           bacak x'te açılırken y'de bükülür ve ikisini tek `rotation`a
           yazmak Euler sırası tuzağıdır. */
        const kalcaAc = new THREE.Group();
        kalcaAc.name = i === 0 ? 'kalcaAcL' : 'kalcaAcR';
        kalcaAc.position.set(0, s * sy * 0.37, kalcaZ);
        g.add(kalcaAc);
        const kalca = new THREE.Group();
        kalca.name = i === 0 ? 'kalcaL' : 'kalcaR';
        kalcaAc.add(kalca);
        eklem.kalca.push(kalca);
        eklem.kalcaAcilma.push(kalcaAc);
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
          pahliKutuGeo(sx * 0.16, sy * 0.24, UYLUK_M * 0.3), M.kumasGolge);
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
      /* ÇİZME, BEYAN EDİLEN AYAKTAN. Önceki hâl `AYAK_ON_M` ve
         `AYAK_ARKA_M`i hiç kullanmıyordu: burun bir küre, topuk başka bir
         küre, taban ayrı bir levhaydı ve üçü arasında görünür kademeler
         vardı. Ölçülen sonuç plandan neredeyse kare bir kütleydi - yani
         yürüdüğü yönü söylemeyen bir ayak.

         Şimdi tek yüzey: kalıp boyunca süpürülen, altı DÜZ üstü yuvarlak
         bir gövde. Taban, diş ve manşet aynı kalıbın farklı yüksekliklerde
         örnekleridir, o yüzden aralarında kademe olamaz. */
      const boy = sz, uz = sx, gen = sy;
      const uzunluk = AYAK_ON_M + AYAK_ARKA_M;
      const tabanZ = -DIKEY.ayakBilegi + 0.012;     // bilek ekseninden tabana
      const govdeBoy = boy * 0.86;

      const cizme = ekle(new THREE.Mesh(cizmeGovdesi(THREE, {
        uzunluk, arkaPay: AYAK_ARKA_M, en: AYAK_EN_M, boy: govdeBoy,
        istasyon: 34, halka: 22,
        /* Çizme gövdesi BEYAZDIR. `kumasGolge` ile kurulduğunda ayak, bacağın
           geri kalanından koyu bir kütle olarak ayrılıyordu ve figür dizden
           aşağısı başka bir şeymiş gibi okunuyordu; Apollo overshoe'su da
           açık renk, yalnız TABANI koyudur. */
      }), M.kumas));
      cizme.position.z = tabanZ;

      /* TABAN ayrı bir malzemedir ama aynı kalıptan gelir: silikon taban,
         kumaş üst - ikisi arasındaki çizgi çizmenin en okunur ayrıntısı. */
      const taban = ekle(new THREE.Mesh(cizmeGovdesi(THREE, {
        uzunluk: uzunluk * 0.995, arkaPay: AYAK_ARKA_M * 0.995,
        en: AYAK_EN_M * 0.99, boy: boy * 0.24, istasyon: 34, halka: 22,
      }), M.taban));
      taban.position.z = tabanZ - 0.002;

      /* DİŞ DESENİ topukta ve bilyede SIKLAŞIR, çünkü basılan yer orasıdır.
         Her çubuk kalıbın o istasyondaki genişliğini alır: dışarı taşan bir
         diş, tabanın dışına çizilmiş bir çizgidir. */
      for (let i = 0; i < 13; i++) {
        const u = 0.04 + (i + 0.5) / 13 * 0.9;
        const yogun = Math.abs(u - 0.22) < 0.14 || Math.abs(u - 0.68) < 0.16;
        /* Çubuk kalıbın o istasyondaki eninde ve ondan DAR: tabanın
           kenarından taşan bir diş, tabanın dışına çizilmiş bir çizgidir. */
        const d = ekle(new THREE.Mesh(pahliKutuGeo(
          uzunluk * (yogun ? 0.045 : 0.028), AYAK_EN_M * 0.76 * ayakEni(u),
          boy * 0.05), M.taban));
        d.position.set(-AYAK_ARKA_M + u * uzunluk, 0, tabanZ - boy * 0.012);
      }

      /* MANŞET: bileği saran konvolüt ve yatak halkası. Çizme ayrı bir
         OVERSHOE'dur, yani giysinin botunun ÜSTÜNE geçer ve bilekten
         aşağısı belirgin şekilde kalınlaşır. */
      /* Manşet AYAĞIN kesitinden gelir, çizmenin gabarisinden değil:
         `gen`den kurulduğunda halkalar 0,266 m'ye çıkıyordu, yani çizme
         gövdesinden (0,221) geniş bir bilek. Bir bilek, bastığı ayaktan
         geniş olamaz. */
      const bilekW = AYAK_EN_M * 0.46, bilekD = AYAK_EN_M * 0.52;
      g.add(yatakHalkasi(THREE, M, bilekW, { kalin: 0.012, tirnak: 6 }));
      const mans = konvolut(THREE, M, bilekW, bilekD, bilekW * 1.1, bilekD * 1.08,
        boy * 0.34, 3);
      mans.position.z = -boy * 0.06;
      g.add(mans);

      /* BAĞ KAYIŞI çizmenin ETRAFINI sarar ve ölçüsü kalıptan gelir; bir
         zamanlar `uz * 0.8` yarıçap yerine konduğu için 0,657 m'lik, ayağa
         hiç değmeyen düz bir çember dönüyordu. */
      const kayisU = 0.42;                          // bilyenin biraz gerisi
      const kayisW = AYAK_EN_M * 0.5 * ayakEni(kayisU) * 1.14;
      const kayis = ekle(new THREE.Mesh(
        new THREE.TorusGeometry(kayisW, gen * 0.045, 8, 22), M.koyu));
      kayis.scale.set(uzunluk * 0.16 / kayisW, 1, 1);
      kayis.position.set(-AYAK_ARKA_M + kayisU * uzunluk, 0,
        tabanZ + govdeBoy * ayakBoyu(kayisU) * 0.52);
      const toka = ekle(new THREE.Mesh(
        pahliKutuGeo(uzunluk * 0.06, gen * 0.09, boy * 0.05), M.eloksal));
      toka.position.set(-AYAK_ARKA_M + kayisU * uzunluk, 0,
        tabanZ + govdeBoy * ayakBoyu(kayisU) * 1.02);

      /* Topuk klipsi: çizme bir kutu değil, BAĞLANAN bir şeydir. */
      const klips = ekle(new THREE.Mesh(
        pahliKutuGeo(uz * 0.08, AYAK_EN_M * 0.44, boy * 0.08), M.eloksal));
      klips.position.set(-AYAK_ARKA_M * 0.82, 0, tabanZ + boy * 0.16);
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
      /* Boyun çapı KATALOGDAN gelir; kabuğun tepesi o çapa iner. Kesit
         yarım ölçü kullandığı için beyan edilen çap ikiye bölünür. */
      const kab = ekle(uzuvMesh(THREE, M.kumas, sz, govdeKesiti({
        omuzW: sy * 0.5, omuzD: sx * 0.54, belW: sy * 0.42, belD: sx * 0.48,
        boyunW: BOYUN_CAP_M * 0.5, boyunD: BOYUN_CAP_M * 0.52, boyunT: 0.26,
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
      /* BOYUN — beyan edilen çizgide ve beyan edilen çapta.
         Önceki hâl sütunu gövde boyunun %60'ına koyuyordu (dünyada 1,708)
         ve kask oraya kadar indiği için sütun kaskın İÇİNDE kalıyordu:
         çizilmiş ama görülemeyen bir boyun, olmayan bir boyunla aynı şeydir.
         Artık yükseklik `DIKEY.boyun`dan, çap `BOYUN_CAP_M`den gelir -
         ikisi de katalogda yazılı, ikisi de kapıda ölçülüyor. */
      const boyunZ = DIKEY.boyun - p.pos[2];       // parça çerçevesinde
      const bR = BOYUN_CAP_M * 0.5;
      /* Sütun boyun çizgisinde BİTER; üstü artık kaskın kilit bileziğine
         bırakılır. sz*0,19 ile tepesi 1,716'ya çıkıyor ve kaskın içine
         giriyordu. */
      const boyun = ekle(uzuvMesh(THREE, M.kumas, sz * 0.125, uzuvKesiti({
        ustW: bR * 0.92, ustD: bR * 0.98, altW: bR, altD: bR * 1.06, sis: 0,
      }), { dilim: 8, halka: 26 }));
      boyun.position.z = boyunZ + sz * 0.083;
      /* Basınç körüğü: boyun, basınç altında da eğilebilmek zorunda. */
      const bkor = konvolut(THREE, M, bR * 1.02, bR * 1.08, bR * 0.96, bR * 1.02,
        sz * 0.1, 3);
      bkor.position.z = boyunZ - sz * 0.02;
      g.add(bkor);
      /* Kilit bileziği: kaskın oturduğu yer. Giysinin en tanınır
         ayrıntılarından biri ve şimdiye kadar hiç görünmemişti. */
      const boyunY = yatakHalkasi(THREE, M, bR * 1.06, { kalin: 0.019, tirnak: 10, kol: true });
      boyunY.position.z = boyunZ;
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
          pahliKutuGeo(sx * 1.06, sy * 0.1, sz * 0.045), M.kumasGolge));
        kayis.position.set(0, s * sy * 0.26, sz * 0.12);
        const toka = ekle(new THREE.Mesh(
          pahliKutuGeo(sx * 0.06, sy * 0.13, sz * 0.07), M.eloksal));
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
          pahliKutuGeo(sx * 0.07, sy * 0.1, sz * 0.055), M.eloksal));
        t2.position.set(0, s * sy * 0.4, -sz * 0.4);
      }
      /* Basınç fermuarı: giysinin kapandığı çizgi, önden omuza. */
      for (let i = 0; i < 9; i++) {
        const u = i / 8;
        const dis = ekle(new THREE.Mesh(
          pahliKutuGeo(sx * 0.03, sy * 0.028, sz * 0.03), M.eloksal));
        dis.position.set(sx * (0.5 - 0.04 * u), sy * (0.06 + 0.2 * u), sz * (-0.3 + 0.62 * u));
      }
      /* Sırt: paketin oturduğu yuva ve dört kilit. */
      const yuva = ekle(new THREE.Mesh(
        pahliKutuGeo(sx * 0.14, sy * 0.66, sz * 0.62), M.koyu));
      yuva.position.set(-sx * 0.46, 0, 0);
      for (const s of [-1, 1]) for (const z of [-1, 1]) {
        const kil = ekle(new THREE.Mesh(
          pahliKutuGeo(sx * 0.1, sy * 0.08, sz * 0.08), M.eloksal));
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
      /* ÖN KOL DÖNMESİ (pronasyon/supinasyon) dirsekten SONRA gelir: radius
         ulnanın üstünde döner, yani dönen şey ön koldur, üst kol değil.
         Kendi grubunda, çünkü dirsek y'de bükülürken ön kol z'de döner. */
      const onkolDon = new THREE.Group();
      onkolDon.name = yan >= 0 ? 'onkolDonL' : 'onkolDonR';
      dirsek.add(onkolDon);
      g.userData.onkolDon = onkolDon;

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
      /* Ön kolun KENDİSİ döner, üst kol değil: dönen parça `onkolDon`un
         altındadır ve eldiven de oraya bağlanır. */
      onkolDon.add(on);
      const bilek = yatakHalkasi(THREE, M, sy * 0.46, { kalin: 0.014, tirnak: 6, kol: true });
      bilek.position.z = -onBoy;
      onkolDon.add(bilek);
      /* BİLEK EKLEMİ. */
      const bilekEk = mafsalGovdesi(THREE, M.kumasGolge, sy * 0.45, sx * 0.45);
      bilekEk.position.z = -onBoy;
      onkolDon.add(bilekEk);
      if (yan >= 0) {
        const kitap = new THREE.Mesh(
          pahliKutuGeo(sy * 0.46, sy * 0.12, onBoy * 0.3), M.kit.white);
        kitap.position.set(sy * 0.48, 0, -onBoy * 0.56);
        dirsek.add(kitap);
      } else {
        const ayna = new THREE.Mesh(
          pahliKutuGeo(sy * 0.38, sy * 0.04, sy * 0.32), M.eloksal);
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
      /* BİLEK HALKASI KOLDAN BİRAZ GENİŞ, ELDİVENDEN DEĞİL. sy*0.6 ile
         halkanın dış çapı 0,230 m çıkıyordu; ön kolun bilekteki kesiti ise
         0,152 m, yani halka kolundan %51 genişti - bir kilit halkası
         geçtiği kolun ölçüsündedir. */
      /* 0,44 ile halkanın dış çapı 0,169 m, ön kolun bilekteki kesiti ise
         0,152 m. 0,42 ikisini eşitliyor ve eldiveni beyan ettiği kutuya
         sokuyor (çizilen 0,192 → 0,184, pay %12'nin altında). */
      const rB = sy * 0.42, uz = sx, boy = sz;
      g.add(yatakHalkasi(THREE, M, rB, { kalin: 0.012, tirnak: 6 }));
      const mansetBoy = boy * 0.34;
      ekle(uzuvMesh(THREE, M.kumasGolge, mansetBoy, uzuvKesiti({
        ustW: rB, ustD: rB * 0.96, altW: rB * 0.9, altD: rB * 0.84, sis: 0.02,
        p: 2.4, kapitone: [2, 0.05],
      }), { dilim: 10, halka: 24 }));
      /* ── EL ÇERÇEVESİ ────────────────────────────────────────────
         `EL_CERCEVE` katalogda beyan edildi; burada ona UYULUR.

           avuç normali  −ayna·y  (içe, uyluğa doğru)
           başparmak     +x       (öne)
           parmaklar     −z       (aşağı)

         Önceki hâlde avuç +x'e bakıyor, başparmak −ayna·y'de duruyordu; o
         ikisi bir arada elin ELLİLİĞİNİ ters çeviriyor ve sol kola sağ el
         takıyordu. Tek bir işareti çevirmek yetmez - avucu içe döndüren
         dönme başparmağı arkaya götürür - o yüzden el baştan bu çerçevede
         kurulur.

         ÖLÇÜ EKSENLERİ DE DEĞİŞİR: avuç artık y'de İNCE, x'te GENİŞtir ve
         dört parmak x boyunca (önden arkaya) dizilir - işaret parmağı en
         önde, serçe en arkada. `supur`'da w = y, d = x. */
      const ayna = yan >= 0 ? 1 : -1;
      const ice = -ayna;                       // gövdeye doğru olan y işareti
      const avucEn = sy * 0.62;                // x'te genişlik (parmak dizilimi)
      const avucKalin = sy * 0.30;             // y'de kalınlık
      const avuc = ekle(uzuvMesh(THREE, M.kumasGolge, boy * 0.32, uzuvKesiti({
        ustW: avucKalin * 0.86, ustD: avucEn * 0.80,
        altW: avucKalin, altD: avucEn,
        sis: 0.02, p: 2.5, kapitone: [2, 0.04], dikis: [5, 0.035],
      }), { dilim: 8, halka: 22 }));
      avuc.position.set(uz * 0.02, 0, -mansetBoy);
      /* Kavrama yastığı AVUÇ YÜZÜNDE, yani içe bakan yüzde. */
      const ped = ekle(new THREE.Mesh(
        pahliKutuGeo(avucEn * 0.78, sy * 0.05, boy * 0.19, 0.002, { egriR: 0.10 }), M.koyu));
      ped.userData.el = { rol: 'avucYastigi', ayna };
      ped.position.set(uz * 0.02, ice * avucKalin * 0.52, -mansetBoy - boy * 0.17);
      /* Bilek kayışı ve tokası: eldiven bileğe SIKILIR. */
      const bkayis = ekle(new THREE.Mesh(
        new THREE.TorusGeometry(rB * 0.92, rB * 0.09, 8, 22), M.koyu));
      bkayis.position.z = -mansetBoy * 0.55;
      const btoka = ekle(new THREE.Mesh(
        pahliKutuGeo(uz * 0.1, sy * 0.1, boy * 0.05), M.eloksal));
      btoka.position.set(uz * 0.24, 0, -mansetBoy * 0.55);

      const parmakZ = -mansetBoy - boy * 0.3;

      /* PARMAK: üç boğum, her biri bir öncekinden kısa, ince ve DAHA KIVRIK.
         Önceki hâl iki düz dikdörtgen ve ucunda parmaktan kalın siyah bir
         küreydi - dört tanesi yan yana, hepsi aynı boyda: bir el değil bir
         çatal.

         KIVRIM BASINÇTAN. 29,6 kPa'da kumaş silindir olmak ister, o yüzden
         şişmiş bir eldivenin NÖTR duruşu hafif kapalıdır; mürettebat gün boyu
         o kıvrıma karşı çalışır ve giysili bir eli en çok tanınır kılan şey
         budur.

         KIVRIM EKSENİ x: parmaklar avuç yüzüne, yani −ayna·y yönüne kapanır.
         Önceki hâlde y ekseninde kıvrılıyorlardı ve bu, avucu öne bakan bir
         el demekti. */
      const parmakKur = (kokGrup, boyOran, enOran, kivrimlar) => {
        let ana = kokGrup;
        let L = boy * 0.17 * boyOran;
        let w = sy * 0.080 * enOran;           // y: parmağın kalınlığı
        let d = sy * 0.072 * enOran;           // x: parmağın genişliği
        for (let b = 0; b < 3; b++) {
          const eklemG = new THREE.Group();
          eklemG.rotation.x = ice * kivrimlar[b];
          ana.add(eklemG);
          const m = new THREE.Mesh(supur(THREE, {
            boy: L,
            kesit: (u) => ({
              /* Boğum ortada şişer, uçlarda mafsala iner: basınçlı kumaşın
                 boğum arası her zaman dolgundur. */
              w: w * (0.86 + 0.14 * Math.sin(Math.PI * u)),
              d: d * (0.86 + 0.14 * Math.sin(Math.PI * u)),
              p: 2.4, kapitone: [2, 0.05], dikis: [4, 0.03],
            }),
            dilim: 6, halka: 14,
          }), M.kumas);
          m.castShadow = true; m.receiveShadow = true;
          eklemG.add(m);
          /* Boğum mafsalı: parmak da bir eklemdir ve orada da kama boşluğu
             açılır. */
          const mf = mafsalGovdesi(THREE, M.kumas, w * 1.02, d * 1.02, { seg: 12 });
          eklemG.add(mf);
          const sonraki = new THREE.Group();
          sonraki.position.z = -L;
          eklemG.add(sonraki);
          ana = sonraki;
          L *= 0.72; w *= 0.86; d *= 0.86;
        }
        /* Uç, parmağın DEVAMI olan bir kapak - üstüne takılmış bir top değil.
           Silikon parmak ucu koyudur ve tutuş yüzeyidir. */
        const uc = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), M.taban);
        uc.scale.set(d * 0.98, w * 0.98, w * 1.05);
        uc.position.z = -w * 0.35;
        ana.add(uc);
        /* Kapı parçayı ADIYLA bulsun: "en koyu küçük küre" diye aramak, bir
           gün başka bir koyu küre eklendiğinde sessizce yanlış şeyi ölçer. */
        return uc;
      };

      /* Dört parmak ÖNDEN ARKAYA dizilir: işaret en önde (+x), serçe en
         arkada. Boylar farklı ve kıvrım serçeye doğru artar - bir el
         kapanırken böyle kapanır. */
      const PARMAK = [
        { boyO: 1.00, enO: 1.00, kiv: [0.30, 0.42, 0.40] },   // işaret (en ön)
        { boyO: 1.08, enO: 1.00, kiv: [0.26, 0.40, 0.38] },   // orta
        { boyO: 0.98, enO: 0.94, kiv: [0.30, 0.46, 0.44] },   // yüzük
        { boyO: 0.80, enO: 0.86, kiv: [0.36, 0.52, 0.50] },   // serçe (en arka)
      ];
      for (let i = 0; i < 4; i++) {
        const kok = new THREE.Group();
        /* Kökler bir YAY üzerinde: avuç kemikleri farklı uzunluktadır ve el o
           yüzden kürek değildir. u = 0 işaret, u = 1 serçe. */
        const u = i / 3;
        kok.position.set(
          uz * 0.02 + (0.5 - u) * avucEn * 0.78,
          ice * avucKalin * 0.10,
          parmakZ + boy * 0.02 * Math.sin(Math.PI * u));
        kok.rotation.x = ice * 0.16;
        /* Serçeye doğru hafif yelpaze. */
        kok.rotation.y = (u - 0.5) * 0.12;
        g.add(kok);
        const pUc = parmakKur(kok, PARMAK[i].boyO, PARMAK[i].enO, PARMAK[i].kiv);
        pUc.userData.el = { rol: 'parmak', sira: i, kok, ayna };
      }

      /* BAŞPARMAK ÖNE bakar ve öteki dörde KARŞIDIR - bir eli el yapan şey
         odur. Avucun ön-iç köşesinden çıkar, avuç yüzüne doğru kapanır. */
      const bp = new THREE.Group();
      bp.position.set(uz * 0.02 + avucEn * 0.46, ice * avucKalin * 0.34,
        -mansetBoy - boy * 0.10);
      /* Aşağı bakan parmak eksenini öne çevir: başparmak −z değil +x'e gider. */
      bp.rotation.y = -1.15;
      bp.rotation.x = ice * 0.30;
      g.add(bp);
      const bpUc = parmakKur(bp, 0.92, 1.22, [0.20, 0.36, 0.0]);
      bpUc.userData.el = { rol: 'basparmak', kok: bp, ayna };
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
        pahliKutuGeo(sx * 0.94, sy * 0.96, sz * 0.06), M.koyu));
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
        pahliKutuGeo(sx * 0.62, sy * 0.74, sz * 0.12), M.eloksal));
      yuc.position.set(-sx * 0.06, 0, -sz * 0.34);
      for (let i = 0; i < 7; i++) {
        const kan = ekle(new THREE.Mesh(
          pahliKutuGeo(sx * 0.58, sy * 0.02, sz * 0.09), M.koyu));
        kan.position.set(-sx * 0.06, (i / 6 - 0.5) * sy * 0.68, -sz * 0.4);
      }
      for (const s of [-1, 1]) {
        const ag = ekle(new THREE.Mesh(cylGeoX(sy * 0.05, sy * 0.05, sx * 0.3, 10), M.koyu));
        ag.position.set(sx * 0.4, s * sy * 0.2, sz * 0.24);
      }
      /* Durum paneli ve bağlantı bloğu: paket bir kutu değil, ÜSTÜNDE
         okunacak şeyler ve takılacak yerler olan bir makinedir. */
      const durum = ekle(new THREE.Mesh(
        pahliKutuGeo(sx * 0.12, sy * 0.4, sz * 0.14), M.koyu));
      durum.position.set(-sx * 0.5, sy * 0.16, sz * 0.24);
      for (let i = 0; i < 3; i++) {
        const led = ekle(new THREE.Mesh(cylGeoX(sy * 0.022, sy * 0.022, sx * 0.05, 10),
          i === 1 ? M.uyari : M.kit.white));
        led.position.set(-sx * 0.57, sy * (0.05 + i * 0.11), sz * 0.24);
      }
      const blok = ekle(new THREE.Mesh(
        pahliKutuGeo(sx * 0.14, sy * 0.3, sz * 0.1), M.eloksal));
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
      const gv = ekle(new THREE.Mesh(pahliKutuGeo(sx * 0.5, sy, sz * 0.7), M.koyu));
      gv.position.z = -sz * 0.1;
      for (const zs of [-1, 1]) {
        const tup = ekle(new THREE.Mesh(cylGeoY(sz * 0.36, sz * 0.36, sy * 0.86, 12), M.metal));
        tup.position.set(0, 0, sz * 0.12 + zs * sz * 0.3);
        for (const ys of [-1, 1]) {
          const bas = ekle(new THREE.Mesh(new THREE.SphereGeometry(sz * 0.36, 16, 11), M.metal));
          bas.position.set(0, ys * sy * 0.43, sz * 0.12 + zs * sz * 0.3);
        }
      }
      const kelepce = ekle(new THREE.Mesh(
        pahliKutuGeo(sx * 0.56, sy * 0.16, sz * 0.9), M.eloksal));
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
      /* KİLİT BİLEZİĞİ GÖVDENİN BOYUN HALKASINA OTURUR, içine GİRMEZ.
         Ölçülen kusur: bilezik −sz*0,47'de, yani dünyada 1,557 — gövdenin
         omuz boyunduruğunun tam içinde. 1 cm'lik ızgarada iki parça 223
         hücreyi paylaşıyordu, z 1,57…1,67 bandında. Bir ek yeri, iki
         parçanın BULUŞTUĞU yerdir; birbirinin içinden geçtiği yer değil.
         Yükseklik artık `DIKEY.boyun`dan türer. */
      const boyunEki = DIKEY.boyun + 0.045 - p.pos[2];   // parça çerçevesinde
      g.add(yatakHalkasi(THREE, M, R * 0.62, { kalin: 0.016, tirnak: 8, kol: true }))
        .position.z = boyunEki;
      const huni = ekle(kabuk(THREE, M.sert, R * 0.8, sz * 0.2, { seg: 18, uc: 0.2 }));
      huni.position.z = boyunEki + sz * 0.17;
      /* KASKIN İÇİNDE BİRİ VAR. Boş bir kabarcık, giysiyi giyen birinin
         değil bir mankenin resmidir - ve bir silueti insan yapan en güçlü
         işaret baştır. İçeride kafatası, yüz düzlemi, çene ve Apollo'nun
         CCA haberleşme başlığı ("Snoopy cap") var: beyaz bere, koyu kulaklık
         ve mikrofon kolu. Ten rengi nötr bir orta tondur; amaç birini
         RESMETMEK değil, kaskın boş olmadığını göstermek. */
      const bas = new THREE.Group();
      /* BAŞ, BOYUN ÇİZGİSİNİN ÜSTÜNDE. sz*0,04'te çenesi 1,624'e iniyordu -
         beyan edilen boyun çizgisinin 36 mm ALTI, yani baş gövdenin içinde.
         İnsanda çene boyun tabanının ~60 mm üstündedir. */
      bas.position.set(-R * 0.04, 0, sz * 0.22);
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

      /* KABARCIK BOYUN EKİNDE BİTER. Tam küre olarak kurulduğunda alt
         kutbu 1,569'a iniyordu, yani gövdenin boyun sütununun İÇİNE. Gerçek
         bir kask kabarcığı da küre değildir: boyun halkasında kesilir ve
         oraya sızdırmaz oturur. Kesme açısı `DIKEY.boyun`dan TÜRETİLİR -
         kabarcığın merkezi ile ek yeri arasındaki yükseklik farkının
         yarıçapa oranının ark kosinüsü. */
      const bubMerkez = p.pos[2] + sz * 0.06;
      const kesmeOran = Math.max(-1, Math.min(1, (DIKEY.boyun + 0.024 - bubMerkez) / R));
      const bubTheta = Math.acos(kesmeOran);        // kutuptan ölçülen açı
      const bub = ekle(new THREE.Mesh(
        kureGeoZ(R, 44, 26, 0, TAU, 0, bubTheta), M.cam));
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
      /* LEVA'NIN ALT KENARI DA BOYUN ÇİZGİSİNDE. 158°'ye kadar süpürüldüğünde
         kabuğun altı 1,568'e iniyor ve omuz boyunduruğunun içinden geçiyordu.
         Bitiş açısı beyan edilen boyundan türer: kabuk merkezi ile boyun
         arasındaki farkın (R*1,1)'e oranının ark kosinüsü. */
      const levaR = R * 1.1;
      const levaSon = Math.acos(Math.max(-1, Math.min(1,
        (DIKEY.boyun + 0.012 - (p.pos[2] + sz * 0.06)) / levaR))) / RAD;
      const lpts = [];
      for (let i = 0; i <= 14; i++) {
        const a = (8 + (i / 14) * (levaSon - 8)) * RAD;
        lpts.push(new THREE.Vector2(levaR * Math.sin(a), levaR * Math.cos(a)));
      }
      /* Kaplanan yay ARKADA merkezlidir, çünkü AÇIKLIK öndedir. */
      const leva = ekle(latheZYonlu(lpts, 44, M.kumas, PHI_Z.arka, TAU - 2 * acik));
      leva.position.z = sz * 0.06;
      /* Açıklığın kenarı: ince bir bilezik, miğferin bittiği yeri belli eder. */
      const kpts = [];
      for (let i = 0; i <= 14; i++) {
        const a = (8 + (i / 14) * (levaSon - 8)) * RAD;
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
          pahliKutuGeo(R * 0.1, R * 0.1, R * 0.26), M.eloksal));
        br.position.set(R * 0.62 * Math.cos(acik), yon * R * 1.12 * Math.sin(acik), sz * 0.06 + R * 0.5);
      }
      /* Güneşlik kolu: vizörü indiren düğme, eldivenli elle çevrilebilecek
         kadar büyük. */
      const vkol = ekle(new THREE.Mesh(cylGeoZ(R * 0.07, R * 0.07, R * 0.16, 12), M.uyari));
      vkol.position.set(R * 0.5, 0, sz * 0.06 + R * 0.86);
      const kanal = ekle(new THREE.Mesh(
        pahliKutuGeo(R * 0.34, R * 0.5, sz * 0.46), M.kumasGolge));
      kanal.position.set(-R * 0.98, 0, sz * 0.02);
      const agiz = ekle(new THREE.Mesh(cylGeoX(R * 0.1, R * 0.1, R * 0.3, 10), M.koyu));
      /* Besleme ağzı kaskın ÖN ALT kenarında durur ama boyun çizgisinin
         altına inemez: −sz*0,2'de 1,624'e sarkıp gövdenin içine giriyordu. */
      agiz.position.set(R * 0.9, 0, -sz * 0.09);
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
      const kam = ekle(new THREE.Mesh(pahliKutuGeo(sx * 0.28, sy * 0.14, sz * 0.5), M.kumasGolge));
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
      /* RCU'nun ARKASI göğsün eğrisini izler. Ölçülen yarıçap 0,56 m:
         gövde kesiti p = 2,2 süperelipstir ve panelin yarı eninde (0,14 m)
         yüzey 17,6 mm geri çekilir - dairesel karşılığı budur. */
      ekle(new THREE.Mesh(pahliKutuGeo(sx * 0.8, sy, sz, 0.004, { arkaEgriR: 0.56 }),
        M.kumasGolge));
      const ekran = ekle(new THREE.Mesh(
        pahliKutuGeo(sx * 0.1, sy * 0.46, sz * 0.34), M.kit.white));
      ekran.position.set(sx * 0.44, sy * 0.22, sz * 0.26);
      const gost = ekle(new THREE.Mesh(cylGeoX(sz * 0.22, sz * 0.22, sx * 0.12, 14), M.metal));
      gost.position.set(sx * 0.44, -sy * 0.28, sz * 0.24);
      const ibre = ekle(new THREE.Mesh(
        pahliKutuGeo(sx * 0.02, sy * 0.02, sz * 0.18), M.serit));
      ibre.position.set(sx * 0.51, -sy * 0.28, sz * 0.28);
      ibre.rotation.x = 0.6;
      for (let i = 0; i < 4; i++) {
        const y = (i / 3 - 0.5) * sy * 0.66;
        const kor = ekle(new THREE.Mesh(
          pahliKutuGeo(sx * 0.16, sy * 0.13, sz * 0.16), M.eloksal));
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
          pahliKutuGeo(sz * 0.16, sz * 0.16, boy), mat));
        al.position.set(x, 0, -sz * 0.3 - boy * 0.5);
      }
      break;
    }

    default:
      ekle(new THREE.Mesh(pahliKutuGeo(sx, sy, sz), M.kumas));
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
/* DOKU ÖNBELLEĞİ. Haritalar her figür için yeniden üretiliyordu ve 256x256
   üç harita, köşe başına birkaç sinüs ve gürültü çağrısıyla kurulumun yarısını
   yiyordu; habitat sayfası iki mürettebat kurduğu için bedeli iki katına
   çıkıyordu. Aynı kumaş her figürde aynı kumaştır - bir kez üretilir. */
let _doku = null;
function dokuOnbellegi(THREE) {
  if (_doku) return _doku;
  /* GÜÇ 0,22: 1,0 ile dokuma bir ÖRGÜ gibi kabarıyordu. Beta bezinin
     kabartısı ipliğin çapının onda biri kadardır; görünmesi gereken şey
     ipliğin kendisi değil ışığı kırma biçimi. */
  _doku = {
    nrm: kumasNormalHaritasi(THREE, { en: 256, iplik: 8, guc: 0.22 }),
    prz: kumasPuruzHaritasi(THREE, { en: 256, iplik: 8 }),
    mNrm: metalNormalHaritasi(THREE, { en: 128 }),
  };
  return _doku;
}

export function buildAstronaut(THREE, { tokens = {}, poz = 'dik', seritRenk = null,
                                      ao = true } = {}) {
  const M = suitMaterials(THREE, tokens);
  if (seritRenk !== null) M.serit = new THREE.MeshStandardMaterial({
    color: seritRenk, roughness: 0.7, metalness: 0.1 });

  /* Haritalar BİR KEZ üretilir ve paylaşılır: her malzemeye ayrı doku
     üretmek, aynı kumaşı belleğe yedi kez koymaktı. */
  const { nrm, prz, mNrm } = dokuOnbellegi(THREE);
  const kare = (dok, tekrar) => { const d = dok.clone(); d.repeat.set(tekrar, tekrar); d.needsUpdate = true; return d; };
  for (const [ad, tekrar, guc] of [['kumas', DOKU_TEKRAR, 0.30], ['kumasGolge', DOKU_TEKRAR, 0.30],
    ['bere', DOKU_TEKRAR * 1.5, 0.30]]) {
    const m = M[ad];
    if (!m) continue;
    m.normalMap = kare(nrm, tekrar);
    m.normalScale = new THREE.Vector2(guc, guc);
    m.roughnessMap = kare(prz, tekrar);
    m.needsUpdate = true;
  }
  /* SERT ÜST GÖVDE kumaş DEĞİLDİR: cam elyafı bir kabuk. Dokuma yerine çok
     sığ bir taşlama izi alır, yoksa figürün en sert parçası battaniyeye
     dönüşüyor. */
  /* TEMAS KARARTMASI köşe rengine pişirilir, o yüzden HER malzeme
     `vertexColors` açar. Açık bırakılıp özniteliği olmayan bir geometri
     SİYAH çıkar - ayrık durum bırakmamak için öznitelik istisnasız
     veriliyor (bkz. astro-ao). */
  for (const m of Object.values(M)) {
    if (m && m.isMaterial) { m.vertexColors = true; m.needsUpdate = true; }
  }
  for (const ad of ['metal', 'eloksal', 'taban', 'koyu', 'sert']) {
    const m = M[ad];
    if (!m) continue;
    m.normalMap = kare(mNrm, ad === 'taban' ? 70 : 140);
    m.normalScale = new THREE.Vector2(0.5, 0.5);
    m.needsUpdate = true;
  }

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
  const eklem = { kalca: [], diz: [], ayak: [], omuz: [], dirsek: [],
    omuzAcilma: [], omuzDonme: [], onkolDonme: [], kalcaAcilma: [] };

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
      } else if (p.id === 'eldivenler' && kolG?.userData.onkolDon) {
        /* Eldiven ÖN KOL DÖNME grubuna bağlanır: bilek döndüğünde el de
           döner, yoksa yeni eksen hiçbir şeyi çevirmez. */
        gg.position.set(0, 0, kolG.userData.bilekZ);
        kolG.userData.onkolDon.add(gg);
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
        /* OMUZ ÜÇ EKSENDİR ve her eksen KENDİ GRUBUNDA durur. Tek bir
           `rotation` üzerine iki eksen yazmak, deponun bir kez pahalıya mal
           olduğu Euler sırası tuzağıdır (eksen-denetimi kural 2): three
           R = Rx·Ry·Rz kurar ve "aç, sonra çevir" o sırayla olmaz.
           Sıra ANATOMİK: önce açılma (kol gövdeden ayrılır), sonra dönme
           (kol kendi ekseninde), en sonra fleksiyon (ileri sallanır). */
        const omuzAc = new THREE.Group();
        omuzAc.name = i === 0 ? 'omuzAcL' : 'omuzAcR';
        yuva.add(omuzAc);
        const omuzDon = new THREE.Group();
        omuzDon.name = i === 0 ? 'omuzDonL' : 'omuzDonR';
        omuzAc.add(omuzDon);
        const omuz = new THREE.Group();
        omuz.name = i === 0 ? 'omuzL' : 'omuzR';
        omuzDon.add(omuz);
        omuz.add(gg);
        eklem.omuz.push(omuz);
        eklem.omuzAcilma.push(omuzAc);
        eklem.omuzDonme.push(omuzDon);
        eklem.dirsek.push(gg.userData.dirsek);
        eklem.onkolDonme.push(gg.userData.onkolDon);
      } else {
        const anne = z > belZ ? bel : kok;
        gg.position.set(x, y, anne === bel ? z - belZ : z);
        anne.add(gg);
      }
      if (p.id === 'alt-govde') {
        eklem.kalca.push(gg.userData.eklem.kalca[0], gg.userData.eklem.kalca[1]);
        eklem.kalcaAcilma.push(gg.userData.eklem.kalcaAcilma[0], gg.userData.eklem.kalcaAcilma[1]);
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
    /* ÖLÇÜM ARALIĞI EKLEM ARALIĞINDAN GENİŞ. Profil, sorulacağı şeyi
       kapsamak ZORUNDA: tablo bileğin beyan edilen aralığında (-26..+34)
       örnekleniyordu, ama sorulan şey eklem açısı değil DÜNYA EĞİMİDİR,
       yani kırpmanın bıraktığı farktır - ve Ay'da 1,7 m/s'de o fark +39,5°
       çıkıyor. Aralığın dışında kalan sorgu uca kırpılıp EKSİK bir düşme
       döndürüyordu ve çizme 15,7 mm yere giriyordu. Ölçülen kusur tam
       buydu: doğru işleyen bir tablo, yanlış yerde sorgulanıyor.
       ±55° pay, ölçülen en büyük taşmanın (39,5°) rahatça üstünde. */
    const [aMinJ, aMaxJ] = EKLEMLER['ayak.L'].range;
    const aMin = aMinJ - 55, aMax = aMaxJ + 55;
    const bot = nodes.get('cizmeler');
    /* ÇÖZÜNÜRLÜK ÖLÇÜMDEN. 96 aralık, eski yuvarlak çizmede yetiyordu;
       kalıptan süpürülen çizmede tabanın en alçak noktası topuktan bilyeye
       geçerken profilde daha KESKİN bir kırık var ve aynı örnekleme 8-10 mm
       batma bırakıyordu. Doğrusal ara değerin hatası adım aralığının karesiyle
       gider: 96 → 240 onu yaklaşık altıda bire indirir. Eşik değil ÖLÇÜM
       düzeltilir - eşiği gevşetmek, kusuru ölçmemek demektir. */
    /* Adım ~0,5°: aralık genişledi, çözünürlük korunur. */
    const ornek = Math.round((aMax - aMin) * 2);
    for (let i = 0; i <= ornek; i++) {
      const aci = aMin + (aMax - aMin) * (i / ornek);
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

  /* AO, taban profili ölçülmeden ÖNCE pişirilemez ve duruş uygulanmadan
     önce pişirilmeli: karartma geometriye aittir, poza değil. */
  const aoSonuc = ao ? ortamOrtme(THREE, kok, nodes) : null;
  if (!ao) {
    /* KAPALIYKEN DE ÖZNİTELİK ŞART: `vertexColors` açık bir malzemede
       renk özniteliği olmayan geometri SİYAH çıkar. */
    kok.traverse((o) => {
      if (!o.isMesh || !o.geometry.attributes.position) return;
      const n = o.geometry.attributes.position.count;
      o.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
    });
  }

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
      /* YENİ EKSENLER. Her biri kendi grubunda ve kendi beyan edilen
         sınırından geçer; verilmezse duruş 0'dır, yani eski duruşlar
         değişmez. Açılma işareti YANA göre: pozitif açı kolu/bacağı
         GÖVDEDEN UZAKLAŞTIRIR, iki tarafta da. */
      const yanIsaret = i === 0 ? 1 : -1;
      /* AÇILMA İŞARETİ ÖLÇÜLDÜ, TÜRETİLMEDİ. −yanIsaret ile sol kol +45°'de
         y = +0,203'ten −0,325'e gidiyordu, yani gövdeden uzaklaşmak yerine
         KARŞIYA geçiyordu. x etrafında θ dönmesi (0, 0, −L)'yi
         y' = L·sin θ'ya götürür; sol kolun dışarı gitmesi için θ > 0. */
      if (eklem.omuzAcilma[i]) eklem.omuzAcilma[i].rotation.x =
        yanIsaret * sinirla(POZ_EKLEM.omuzAcilma[i], P.omuzAcilma?.[i] ?? 0) * RAD;
      if (eklem.omuzDonme[i]) eklem.omuzDonme[i].rotation.z =
        yanIsaret * sinirla(POZ_EKLEM.omuzDonme[i], P.omuzDonme?.[i] ?? 0) * RAD;
      if (eklem.onkolDonme[i]) eklem.onkolDonme[i].rotation.z =
        yanIsaret * sinirla(POZ_EKLEM.onkolDonme[i], P.onkolDonme?.[i] ?? 0) * RAD;
      if (eklem.kalcaAcilma[i]) eklem.kalcaAcilma[i].rotation.x =
        yanIsaret * sinirla(POZ_EKLEM.kalcaAcilma[i], P.kalcaAcilma?.[i] ?? 0) * RAD;
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
  return { root: kok, bel, nodes, eklem, materials: M, poz: P0, uygulaPoz, olcu, ao: aoSonuc };
}

export { PARTS, partById, DIKEY, EKLEMLER, POZ_EKLEM, sinirla };
