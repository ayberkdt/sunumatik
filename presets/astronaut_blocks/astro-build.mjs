/* astro-build.mjs — katalogdan GİYSİYİ kurar.
 *
 * ÇERÇEVE. `astro-parts.mjs`'in beyan ettiği gövde çerçevesi: +X İLERİ
 * (göğsün baktığı yön), +Y SOL, +Z YUKARI. `pos` harfiyen konumdur ve
 * qty 2 olan parçanın aynalama ekseni satırında yazılıdır. Bu yazılana kadar
 * çerçeve üç şeydi aynı anda: omuz yatakları göğüste ve sırtta, sırt paketi
 * sol kolun içinde, göğüs paneli sol böğürde duruyordu.
 *
 * BİÇİM. Bir basınçlı giysi, bacak takılmış bir fıçı değildir. Burada çizilen
 * her biçim giysinin ÇALIŞMA biçimidir:
 *
 *   konvolüt mafsal   Basınçlı bir giysinin bükülebilmesinin tek yolu. Hacmi
 *                     sabit tutan kıvrımlar olmadan tulum dik bir borudur ve
 *                     diz bükülmez.
 *   yatak halkası     Konvolüt bükülmeyi verir, DÖNMEYİ vermez. Omuz, bilek,
 *                     bel ve bilek dönüşü rulmanlı halkalardan gelir; giysinin
 *                     her mafsalında ikisi birden vardır.
 *   sert üst gövde    Kolların, kaskın ve sırt paketinin yükü bir kumaşa
 *                     asılamaz. Göğüs sırttan DAHA DOLGUNDUR: basınç kumaşı
 *                     şişirir ve mürettebat öne eğilebilsin diye önde yer
 *                     bırakılır.
 *   altın vizör       Görünür ışığı geçirip morötesini ve ısıyı kesen ince
 *                     altın kaplama. Menteşelidir ve gölgede kaldırılır.
 *   taban deseni      Tozda tutunmanın tek yolu; topukta ve ayak bilyesinde
 *                     sıklaşır, çünkü basılan yer orasıdır.
 *
 * POZ. Bir astronotun duruşu bir İŞ anlatır. `POZLAR` içindeki her poz
 * kalça/diz/omuz/dirsek açılarını DERECE cinsinden beyan eder ve geometri o
 * açılardan kurulur - "eğilip alet alıyor" ile "panele uzanıyor" arasındaki
 * fark elle taşınmış vertexler değil, okunabilir sayılardır.
 */
import { PARTS, partById, BOY_M, OMUZ_M, kopyaKonumlari } from './astro-parts.mjs';
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
    kumas: std(tk.kumas ?? 0xecedf0, 0.88, 0.03),
    kumasGolge: std(tk.kumasGolge ?? 0xc9ccd4, 0.92, 0.03),
    sert: std(tk.sert ?? 0xe2e5ea, 0.4, 0.3),
    metal: std(tk.metal ?? 0x9aa2ae, 0.32, 0.88),
    koyu: std(tk.koyu ?? 0x3b4049, 0.6, 0.45),
    taban: std(tk.taban ?? 0x25282e, 0.95, 0.05),
    uyari: std(tk.uyari ?? 0xd8b23a, 0.6, 0.15),
    bayrak: std(tk.bayrak ?? 0x2f4f8f, 0.75, 0.05),
    vizor: new THREE.MeshStandardMaterial({ color: 0xd8a94a, roughness: 0.06,
      metalness: 0.96, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
    cam: new THREE.MeshStandardMaterial({ color: 0xa8cadd, roughness: 0.04,
      metalness: 0.08, transparent: true, opacity: 0.22, side: THREE.DoubleSide }),
    serit: std(tk.serit ?? 0xc23b3b, 0.7, 0.1),
    kit: D.hardwareMaterials(THREE, tk),
  };
}

/* ── biçim yardımcıları ──────────────────────────────────────────────── */

/**
 * Konik uzuv. Basınç kumaşı şişirir: bir giysi kolu iki ucundan ince,
 * ortasından dolgundur. Düz silindir tam olarak "bacaklı varil" görüntüsünü
 * veren şeydir, o yüzden burada profil her zaman eğridir.
 * Yerel çerçeve: tepe z = 0, aşağı doğru -boy.
 */
function uzuv(THREE, mat, rUst, rAlt, boy, { sis = 0.07, seg = 18, n = 9 } = {}) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const r = (rUst + (rAlt - rUst) * t) * (1 + sis * Math.sin(Math.PI * t));
    pts.push(new THREE.Vector2(Math.max(r, 1e-4), -t * boy));
  }
  return latheZ(pts, seg, mat);
}

/** Yumuşak uçlu kabuk (kask kabarcığı, paket gövdesi): iki ucu kapalı profil. */
function kabuk(THREE, mat, r, boy, { seg = 22, uc = 0.5 } = {}) {
  const pts = [];
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    /* Uçları yuvarlat: t=0 ve t=1'de yarıçap sıfıra iner. */
    const k = Math.sin(Math.PI * t) ** uc;
    pts.push(new THREE.Vector2(Math.max(r * k, 1e-4), (t - 0.5) * boy));
  }
  return latheZ(pts, seg, mat);
}

/**
 * Konvolüt mafsal — basınçlı giysinin bükülebilmesinin TEK yolu.
 * Kıvrımlar hacmi sabit tutar; olmayınca mafsal bükülmez, sıkışır.
 */
function konvolut(THREE, M, rUst, rAlt, boy, n = 4) {
  const g = new THREE.Group();
  g.add(uzuv(THREE, M.kumas, rUst * 0.93, rAlt * 0.93, boy, { sis: 0.02, seg: 16 }));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const r = rUst + (rAlt - rUst) * t;
    const k = new THREE.Mesh(
      new THREE.TorusGeometry(r * 0.99, r * 0.19, 6, 18), M.kumasGolge);
    k.position.z = -t * boy;
    g.add(k);
  }
  return g;
}

/**
 * Yatak halkası. Konvolüt bükmeyi verir, DÖNMEYİ vermez: omuz, bilek, bel ve
 * boyun dönüşü rulmanlı halkalardan gelir. İki bilezik, kilit tırnakları ve
 * bir kol - giysinin her ayrılabilir birleşimi böyle görünür.
 */
function yatakHalkasi(THREE, M, r, { kalin = 0.02, tirnak = 8, kol = false } = {}) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(cylGeoZ(r * 1.05, r * 1.05, kalin * 2.4, 26), M.metal));
  const dis = new THREE.Mesh(cylGeoZ(r * 1.13, r * 1.13, kalin, 26), M.koyu);
  g.add(dis);
  for (let i = 0; i < tirnak; i++) {
    const a = i * TAU / tirnak;
    const t = new THREE.Mesh(
      new THREE.BoxGeometry(r * 0.1, r * 0.13, kalin * 1.8), M.metal);
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
  return g;
}

/** Bir yüzeye yapışan yama/etiket: verilen yöne bakar. */
function yama(THREE, mat, w, h, kal = 0.006) {
  return new THREE.Mesh(new THREE.BoxGeometry(kal, w, h), mat);
}

/* ── pozlar ──────────────────────────────────────────────────────────
   Açı beyan edilir, vertex taşınmaz. Sayılar DERECE ve her biri FLEKSİYON:
   pozitif sayı mafsalın büküldüğü yöndür, hepsinde aynı anlamda.

   İŞARET SÖZLEŞMESİ TEK YERDE. Bu yazılana kadar her mafsal kendi işaretini
   icat ediyordu: kalça ve omuz negatifi fleksiyon sayıyor, diz pozitifi
   sayıyordu, dirsek ise "58° bükük" diye yazılmış ama kolu ARKAYA büküyordu -
   ölçülen: dik duran figürün elleri gövdenin 0,12 m gerisinde. Kalça, omuz
   ve dirsek fleksiyonu uzvu ÖNE getirir (-Y etrafında dönüş), diz fleksiyonu
   topuğu GERİ getirir (+Y). Fark anatomiktir, o yüzden burada yazılıdır.

   Dizi [sol, sağ]; +Y sol olduğu için sağ taraf ikinci sıradadır. */
const FLEKS = Object.freeze({ kalca: -1, diz: 1, omuz: -1, dirsek: -1 });
/** Bir mafsalın poz açısını radyana ve DOĞRU işarete çevirir. */
const mafsal = (poz, ad, i) => (poz?.[ad]?.[i] ?? 0) * RAD * FLEKS[ad];

export const POZLAR = Object.freeze({
  dik: { ad: 'Standing', kalca: [0, 0], diz: [2, 2], omuz: [5, 5], dirsek: [16, 16], govdeEgim: 0 },
  egilme: { ad: 'Crouched at a task', kalca: [52, 52], diz: [66, 66], omuz: [34, 34], dirsek: [58, 58], govdeEgim: 26 },
  uzanma: { ad: 'Reaching up to a panel', kalca: [0, 0], diz: [6, 6], omuz: [104, 30], dirsek: [22, 14], govdeEgim: -6 },
  tasima: { ad: 'Carrying a load', kalca: [8, 8], diz: [12, 12], omuz: [48, 48], dirsek: [74, 74], govdeEgim: 8 },
  yuruyus: { ad: 'Walking', kalca: [20, -18], diz: [24, 6], omuz: [-16, 16], dirsek: [22, 26], govdeEgim: 4 },
});

/* ── gövdeler ────────────────────────────────────────────────────────
   `yan`: +1 sol, -1 sağ, 0 orta. Sol ve sağ kol aynı değildir - kontrol
   listesi bir kolda, ayna ötekinde durur. */
function govde(THREE, p, M, poz, yan = 0) {
  const [sx, sy, sz] = p.size;
  const g = new THREE.Group();
  const ekle = (m) => { m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };

  switch (p.sekil) {

    /* ── soğutma tulumu ─────────────────────────────────────────────
       Tene giyilir; dışarıdan yalnız boyundan ve bileklerden görünür. Isıyı
       taşıyan şey hava değil, o borulardaki sudur - o yüzden borular çizilir. */
    case 'tulum': {
      const govdeBoy = sz * 0.62;
      const t = ekle(kabuk(THREE, M.koyu, sx * 0.46, govdeBoy, { seg: 18, uc: 0.28 }));
      t.scale.y = sy / sx;
      t.position.z = sz * 0.16;
      /* Bacak kısmı: tulum kalçadan aşağı devam eder. */
      for (const s of [-1, 1]) {
        const b = ekle(uzuv(THREE, M.koyu, sx * 0.19, sx * 0.13, sz * 0.42, { seg: 12 }));
        b.position.set(0, s * sx * 0.21, -sz * 0.12);
      }
      /* Serpantin: borular gövdeyi SARAR, üst üste halka olmaz. */
      for (let i = 0; i < 14; i++) {
        const z = sz * (0.44 - i * 0.045);
        const r = sx * (0.47 - 0.05 * Math.abs(Math.sin(i * 0.9)));
        const hat = ekle(new THREE.Mesh(
          new THREE.TorusGeometry(r, sx * 0.018, 5, 22, TAU * 0.92), M.serit));
        hat.scale.y = sy / sx;
        hat.position.z = z;
        hat.rotation.z = i * 0.55;
      }
      /* Göğüs manifoldu: bütün boruların toplandığı yer. */
      const man = ekle(new THREE.Mesh(
        new THREE.BoxGeometry(sx * 0.1, sx * 0.3, sz * 0.09), M.metal));
      man.position.set(sx * 0.42, 0, sz * 0.34);
      for (const s of [-1, 1]) {
        const uc = ekle(new THREE.Mesh(cylGeoX(sx * 0.035, sx * 0.035, sx * 0.12, 8), M.koyu));
        uc.position.set(sx * 0.5, s * sx * 0.09, sz * 0.34);
      }
      break;
    }

    /* ── alt gövde ──────────────────────────────────────────────────
       Bel yatağı, kalça kabuğu, iki bacak. Her bacakta kalça konvolütü,
       uyluk, diz konvolütü + sert diz kapağı, baldır ve ayak bileği yatağı.
       Eskiden iki tane tek yarıçaplı silindirdi. */
    case 'altGovde': {
      const kalcaZ = sz * 0.5;
      /* Bel yatağı + kalça kabuğu: giysinin en dış katmanı burada da giysidir.
         Kabuk olmayınca altındaki soğutma tulumu dışarıdan görünüyordu. */
      const brief = ekle(kabuk(THREE, M.kumas, sx * 0.5, sz * 0.3, { seg: 20, uc: 0.22 }));
      brief.scale.y = sy / sx;
      brief.position.z = kalcaZ - sz * 0.16;
      const kemer = ekle(new THREE.Mesh(
        new THREE.TorusGeometry(sx * 0.47, sx * 0.045, 6, 26), M.kumasGolge));
      kemer.scale.y = sy / sx;
      kemer.position.z = kalcaZ - sz * 0.24;
      /* Bel dönüş yatağı: gövde burada döner. */
      const bel = yatakHalkasi(THREE, M, sx * 0.44, { kalin: 0.022, tirnak: 10, kol: true });
      bel.position.z = kalcaZ;
      g.add(bel);
      /* Alet askıları: kalçada, eldivenli elin ulaşabileceği yerde. */
      for (const s of [-1, 1]) {
        const ask = ekle(new THREE.Mesh(
          new THREE.TorusGeometry(sx * 0.055, sx * 0.014, 5, 12), M.metal));
        ask.position.set(-sx * 0.12, s * sx * 0.5, kalcaZ - sz * 0.13);
        ask.rotation.x = Math.PI / 2;
      }

      const ustR = sx * 0.2, dizR = sx * 0.165, bilekR = sx * 0.145;
      /* BACAK BOYU TÜRETİLİR. Elle yazıldığında (sz * 0,36 iki kez) zincir
         pedin 0,20 m ALTINDA bitiyordu; ayakları yere oturtan ölçüm de bütün
         figürü o kadar yukarı kaldırıyor ve boy 1,95 yerine 2,41 çıkıyordu.
         Ayak bileğinin nerede olması GEREKTİĞİ bellidir: çizmenin yüksekliği
         kadar yukarıda. Boy ondan çıkar. */
      const kalcaMafsalZ = kalcaZ - sz * 0.27;
      const cizmeBoy = partById('cizmeler')?.size[2] ?? 0.2;
      const bacakBoy = kalcaMafsalZ - (-sz / 2 + cizmeBoy);
      const uylukBoy = bacakBoy * 0.5, baldirBoy = bacakBoy * 0.5;
      for (const [i, s] of [[0, 1], [1, -1]]) {
        const kalca = new THREE.Group();
        kalca.position.set(0, s * sx * 0.24, kalcaMafsalZ);
        kalca.rotation.y = mafsal(poz, 'kalca', i);
        g.add(kalca);
        /* Kalça konvolütü + uyluk: uyluk dizde incelir. */
        const kalcaKon = konvolut(THREE, M, ustR * 1.08, ustR, sz * 0.09, 2);
        kalca.add(kalcaKon);
        const uyluk = uzuv(THREE, M.kumas, ustR, dizR, uylukBoy - sz * 0.09, { seg: 16 });
        uyluk.position.z = -sz * 0.09;
        kalca.add(uyluk);
        /* Uyluk cebi ve sert aşınma plakası - dizin üstüne diz çökülür. */
        const cep = new THREE.Mesh(
          new THREE.BoxGeometry(ustR * 0.5, ustR * 1.0, uylukBoy * 0.34), M.kumasGolge);
        cep.position.set(ustR * 0.6, s * ustR * 0.5, -uylukBoy * 0.52);
        kalca.add(cep);

        const diz = new THREE.Group();
        diz.position.z = -uylukBoy;
        diz.rotation.y = mafsal(poz, 'diz', i);
        kalca.add(diz);
        const dizKon = konvolut(THREE, M, dizR * 1.06, dizR * 1.02, sz * 0.1, 3);
        diz.add(dizKon);
        /* Diz kapağı: konvolütü koruyan EĞRİ plaka, kutu değil. */
        const kapak = new THREE.Mesh(
          new THREE.SphereGeometry(dizR * 1.25, 14, 10, -0.8, 1.6, 0.9, 1.1), M.sert);
        kapak.rotation.x = Math.PI / 2;
        kapak.position.set(0, 0, -sz * 0.045);
        diz.add(kapak);
        const baldir = uzuv(THREE, M.kumas, dizR * 1.02, bilekR, baldirBoy - sz * 0.1, { seg: 16 });
        baldir.position.z = -sz * 0.1;
        diz.add(baldir);
        /* Ayak bileği yatağı: çizme buraya oturur. */
        const bilek = yatakHalkasi(THREE, M, bilekR, { kalin: 0.014, tirnak: 6 });
        bilek.position.z = -baldirBoy;
        diz.add(bilek);
        /* Havalandırma hattı baldırın arkasından iner. */
        const hat = new THREE.Mesh(
          cylGeoZ(sx * 0.022, sx * 0.022, baldirBoy * 0.8, 8), M.koyu);
        hat.position.set(-dizR * 0.92, 0, -baldirBoy * 0.5);
        diz.add(hat);

        diz.userData.ayakUcu = -baldirBoy;
        (g.userData.diz ??= []).push(diz);
      }
      break;
    }

    /* ── çizme ──────────────────────────────────────────────────────
       Yerel çerçeve: kaynak nokta AYAK BİLEĞİ (z = 0), ayak aşağı ve ileri
       uzanır. Eskiden iki kutuydu; bir çizmenin burnu, topuğu, bileği ve
       tabanı vardır ve hepsi ayrı işler yapar. */
    case 'cizme': {
      const boy = sz, uz = sx, gen = sy;
      const bilekR = gen * 0.46;
      g.add(yatakHalkasi(THREE, M, bilekR, { kalin: 0.013, tirnak: 6 }));
      /* Bilek körüğü ve toz eteği: tozun içeri girdiği tek yer burasıdır. */
      const kon = konvolut(THREE, M, bilekR, bilekR * 1.1, boy * 0.3, 2);
      g.add(kon);
      const etek = ekle(uzuv(THREE, M.kumasGolge, bilekR * 1.16, bilekR * 1.3, boy * 0.42, { seg: 14 }));
      etek.position.z = -boy * 0.06;
      /* Ayak: orta kısım kutu, burun ve topuk yuvarlak. */
      const tabanZ = -boy * 0.78;
      const orta = ekle(new THREE.Mesh(
        new THREE.BoxGeometry(uz * 0.5, gen * 0.9, boy * 0.3), M.kumasGolge));
      orta.position.set(uz * 0.06, 0, tabanZ + boy * 0.16);
      const burun = ekle(new THREE.Mesh(
        new THREE.SphereGeometry(gen * 0.46, 14, 10), M.kumasGolge));
      burun.scale.set(uz * 0.9 / gen, 1, 0.66);
      burun.position.set(uz * 0.3, 0, tabanZ + boy * 0.15);
      const topuk = ekle(new THREE.Mesh(
        new THREE.SphereGeometry(gen * 0.44, 12, 9), M.kumasGolge));
      topuk.scale.set(0.8, 1, 0.7);
      topuk.position.set(-uz * 0.2, 0, tabanZ + boy * 0.14);
      /* Taban plakası ve deseni. Desen topukta ve ayak bilyesinde sıklaşır,
         çünkü basılan yer orasıdır - düzgün aralıklı çizgiler bir ayakkabının
         nasıl aşındığını bilmemek demek. */
      const taban = ekle(new THREE.Mesh(
        new THREE.BoxGeometry(uz * 0.98, gen * 0.94, boy * 0.09), M.taban));
      taban.position.set(uz * 0.05, 0, tabanZ);
      for (let i = 0; i < 11; i++) {
        const u = i / 10;
        const x = (u - 0.45) * uz * 0.92 + uz * 0.05;
        const yogun = Math.abs(u - 0.2) < 0.18 || Math.abs(u - 0.82) < 0.16;
        const d = ekle(new THREE.Mesh(new THREE.BoxGeometry(
          uz * (yogun ? 0.05 : 0.035), gen * 0.86, boy * 0.05), M.taban));
        d.position.set(x, 0, tabanZ - boy * 0.06);
      }
      /* Yan takviye ve bağ kayışı. */
      for (const s of [-1, 1]) {
        const tak = ekle(new THREE.Mesh(
          new THREE.BoxGeometry(uz * 0.44, gen * 0.06, boy * 0.16), M.koyu));
        tak.position.set(uz * 0.06, s * gen * 0.46, tabanZ + boy * 0.2);
      }
      const kayis = ekle(new THREE.Mesh(
        new THREE.TorusGeometry(gen * 0.5, gen * 0.05, 5, 14), M.koyu));
      kayis.scale.set(uz * 0.8 / gen, 1, 1);
      kayis.position.set(uz * 0.02, 0, tabanZ + boy * 0.3);
      kayis.rotation.x = Math.PI / 2;
      break;
    }

    /* ── sert üst gövde ─────────────────────────────────────────────
       Kolların, kaskın ve sırt paketinin yükünü taşıyan tek parça. Belde dar,
       omuzda geniş; ve GÖĞÜS SIRTTAN DOLGUN - basınç kumaşı şişirir, ayrıca
       öne eğilebilmek için önde yer bırakılır. Eskiden tek konik silindirdi. */
    case 'ustGovde': {
      const yariGen = sy * 0.5, derin = sx * 0.5;
      /* Ana kabuk: belden omuza açılan profil. */
      const pts = [];
      const n = 12;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        /* 0 = bel, 1 = boyun. Omuz t ~ 0,78'de en geniş. */
        const r = 0.78 + 0.34 * Math.sin(Math.PI * Math.min(t * 1.18, 1) ** 0.85)
          - 0.5 * Math.max(0, t - 0.82) * 5.2;
        pts.push(new THREE.Vector2(Math.max(yariGen * r, 0.02), (t - 0.5) * sz));
      }
      const kab = ekle(latheZ(pts, 24, M.sert));
      kab.scale.x = derin / yariGen;
      /* Göğüs kabuğu: ön yarıya eklenen dolgu. Yalnız +X'e bakar. */
      const gpts = [];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        gpts.push(new THREE.Vector2(
          Math.max(derin * (0.82 + 0.3 * Math.sin(Math.PI * t)), 0.02), (t - 0.48) * sz * 0.86));
      }
      const gogus = ekle(latheZ(gpts, 20, M.sert, -1.0, 2.0));
      gogus.scale.y = yariGen * 0.94 / derin;
      /* Omuz boyundurukları: kolun çıktığı yerdeki kabarıklık. */
      for (const s of [-1, 1]) {
        const om = ekle(new THREE.Mesh(new THREE.SphereGeometry(yariGen * 0.42, 16, 12), M.sert));
        om.scale.set(derin / (yariGen * 0.42) * 0.72, 1, 0.78);
        om.position.set(0, s * yariGen * 0.66, sz * 0.26);
      }
      /* Bel ve boyun yatakları. */
      const belY = yatakHalkasi(THREE, M, yariGen * 0.76, { kalin: 0.022, tirnak: 10, kol: true });
      belY.position.z = -sz * 0.5;
      belY.scale.x = derin / (yariGen * 0.76) * 0.94;
      g.add(belY);
      const boyun = ekle(uzuv(THREE, M.sert, yariGen * 0.38, yariGen * 0.46, sz * 0.1, { seg: 16 }));
      boyun.position.z = sz * 0.6;
      const boyunY = yatakHalkasi(THREE, M, yariGen * 0.38, { kalin: 0.018, tirnak: 8, kol: true });
      boyunY.position.z = sz * 0.5;
      g.add(boyunY);
      /* Mürettebat şeridi: iki kişiyi uzaktan ayıran tek şey. */
      const serit = ekle(yama(THREE, M.serit, yariGen * 0.3, sz * 0.46));
      serit.position.set(derin * 1.12, yariGen * 0.5, 0);
      /* Bayrak ve isimlik: giysinin üstünde YAZILI olan iki şey. */
      const bayrak = ekle(yama(THREE, M.bayrak, yariGen * 0.34, sz * 0.2));
      bayrak.position.set(derin * 1.1, -yariGen * 0.46, sz * 0.12);
      const isim = D.levha(THREE, M.kit, ['CREW'], { w: yariGen * 0.44, h: sz * 0.1 });
      isim.rotateOnWorldAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2);
      isim.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), Math.PI / 2);
      isim.position.set(derin * 1.1, -yariGen * 0.44, -sz * 0.08);
      g.add(isim);
      /* Sırt: paketin oturduğu yuva ve dört kilit. */
      const yuva = ekle(new THREE.Mesh(
        new THREE.BoxGeometry(derin * 0.16, yariGen * 1.3, sz * 0.66), M.koyu));
      yuva.position.set(-derin * 0.96, 0, -sz * 0.02);
      for (const s of [-1, 1]) for (const z of [-1, 1]) {
        const kil = ekle(new THREE.Mesh(
          new THREE.BoxGeometry(derin * 0.12, yariGen * 0.14, sz * 0.08), M.metal));
        kil.position.set(-derin * 1.06, s * yariGen * 0.52, z * sz * 0.26);
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
      const gobek = ekle(new THREE.Mesh(cylGeoZ(r * 0.92, r * 0.92, sx * 0.5, 18), M.metal));
      gobek.quaternion.copy(q);
      /* Rulman bilyeleri: yatağın yatak olduğunu gösteren şey. */
      for (let i = 0; i < 10; i++) {
        const a = i * TAU / 10;
        const b = new THREE.Mesh(new THREE.SphereGeometry(r * 0.1, 8, 6), M.koyu);
        b.position.set(Math.cos(a) * r * 0.98, Math.sin(a) * r * 0.98, 0);
        b.applyQuaternion(q);
        b.position.applyQuaternion(q);
        ekle(b);
      }
      break;
    }

    /* ── kol ────────────────────────────────────────────────────────
       Yerel çerçeve: kaynak nokta OMUZ (z = 0), kol aşağı uzanır.
       Üst kol, dirsek konvolütü + sert dirsek fincanı, ön kol, bilek yatağı.
       Sol ve sağ kol AYNI DEĞİL: kontrol listesi bir kolda, ayna ötekinde. */
    case 'kol': {
      const rUst = sy * 0.52, rDir = sy * 0.45, rBilek = sy * 0.39;
      const ustBoy = sz * 0.46, onBoy = sz * 0.44;
      /* Omuz kapağı: kolun gövdeye girdiği yer. */
      const kap = ekle(new THREE.Mesh(new THREE.SphereGeometry(rUst * 1.15, 14, 10), M.sert));
      kap.scale.z = 0.7;
      g.add(yatakHalkasi(THREE, M, rUst, { kalin: 0.014, tirnak: 6 }));
      const omuzKon = konvolut(THREE, M, rUst * 1.04, rUst, sz * 0.09, 2);
      g.add(omuzKon);
      const ust = uzuv(THREE, M.kumas, rUst, rDir, ustBoy - sz * 0.09, { seg: 16 });
      ust.position.z = -sz * 0.09;
      g.add(ust);

      const dirsek = new THREE.Group();
      dirsek.position.z = -ustBoy;
      dirsek.rotation.y = mafsal(poz, 'dirsek', yan >= 0 ? 0 : 1);
      g.add(dirsek);
      const dirKon = konvolut(THREE, M, rDir * 1.05, rDir, sz * 0.1, 3);
      dirsek.add(dirKon);
      /* Dirsek fincanı: konvolütü koruyan eğri kabuk. */
      const fincan = new THREE.Mesh(
        new THREE.SphereGeometry(rDir * 1.3, 12, 9, -0.8, 1.6, 0.9, 1.1), M.sert);
      fincan.rotation.x = -Math.PI / 2;
      fincan.position.z = -sz * 0.05;
      dirsek.add(fincan);
      const on = uzuv(THREE, M.kumas, rDir, rBilek, onBoy - sz * 0.1, { seg: 16 });
      on.position.z = -sz * 0.1;
      dirsek.add(on);
      /* Bilek dönüş yatağı - eldiven buraya oturur. */
      const bilek = yatakHalkasi(THREE, M, rBilek, { kalin: 0.014, tirnak: 6, kol: true });
      bilek.position.z = -onBoy;
      dirsek.add(bilek);
      /* Manşet: sol kolda kontrol listesi, sağ kolda ayna. Mürettebat kendi
         göğsündeki paneli ancak aynayla okur - panel baş aşağı görünür. */
      if (yan >= 0) {
        const kitap = new THREE.Mesh(
          new THREE.BoxGeometry(rBilek * 1.5, rBilek * 0.34, onBoy * 0.3), M.kit.white);
        kitap.position.set(rBilek * 1.0, 0, -onBoy * 0.56);
        dirsek.add(kitap);
        const spiral = new THREE.Mesh(
          cylGeoY(rBilek * 0.07, rBilek * 0.07, rBilek * 0.4, 8), M.metal);
        spiral.position.set(rBilek * 1.0, 0, -onBoy * 0.42);
        dirsek.add(spiral);
      } else {
        const ayna = new THREE.Mesh(
          new THREE.BoxGeometry(rBilek * 1.2, rBilek * 0.1, rBilek * 1.0), M.metal);
        ayna.position.set(rBilek * 1.0, 0, -onBoy * 0.56);
        dirsek.add(ayna);
      }
      g.userData.bilek = dirsek;
      g.userData.bilekZ = -onBoy;
      break;
    }

    /* ── eldiven ────────────────────────────────────────────────────
       Yerel çerçeve: kaynak BİLEK (z = 0). Bilezik, koni manşet, avuç,
       dört parmak (ikişer boğum, hafif kıvrık) ve ayrı başparmak.
       Parmak uçları koyu: kavrama yüzeyi kumaş değil, kauçuktur. */
    case 'eldiven': {
      const rB = sy * 0.48, uz = sx, boy = sz;
      g.add(yatakHalkasi(THREE, M, rB, { kalin: 0.012, tirnak: 6 }));
      const mansetBoy = boy * 0.34;
      ekle(uzuv(THREE, M.kumasGolge, rB, rB * 0.86, mansetBoy, { seg: 14 }));
      /* Avuç: elin kendisi. Genişliği parmaklara doğru biraz artar. */
      const avuc = ekle(new THREE.Mesh(
        new THREE.BoxGeometry(uz * 0.36, sy * 0.86, boy * 0.3), M.kumasGolge));
      avuc.position.set(uz * 0.04, 0, -mansetBoy - boy * 0.15);
      /* Kavrama pedleri: avucun içi. */
      const ped = ekle(new THREE.Mesh(
        new THREE.BoxGeometry(uz * 0.3, sy * 0.7, boy * 0.05), M.taban));
      ped.position.set(uz * 0.22, 0, -mansetBoy - boy * 0.15);
      const parmakZ = -mansetBoy - boy * 0.3;
      for (let i = 0; i < 4; i++) {
        const py = (i / 3 - 0.5) * sy * 0.62;
        const kok = new THREE.Group();
        kok.position.set(uz * 0.06, py, parmakZ);
        kok.rotation.y = -0.42;   // parmaklar hafif kıvrık: duran el yumuşaktır
        g.add(kok);
        const b1 = new THREE.Mesh(
          new THREE.BoxGeometry(uz * 0.14, sy * 0.15, boy * 0.16), M.kumas);
        b1.position.z = -boy * 0.08;
        kok.add(b1);
        const b2g = new THREE.Group();
        b2g.position.z = -boy * 0.16;
        b2g.rotation.y = -0.5;
        kok.add(b2g);
        const b2 = new THREE.Mesh(
          new THREE.BoxGeometry(uz * 0.12, sy * 0.13, boy * 0.13), M.kumas);
        b2.position.z = -boy * 0.065;
        b2g.add(b2);
        const uc = new THREE.Mesh(new THREE.SphereGeometry(sy * 0.07, 8, 6), M.taban);
        uc.position.z = -boy * 0.13;
        b2g.add(uc);
      }
      /* Başparmak: avucun yanından ve ÖNE doğru çıkar - kavrama böyle olur. */
      const bp = new THREE.Group();
      bp.position.set(uz * 0.16, -sy * 0.4, -mansetBoy - boy * 0.16);
      bp.rotation.y = -1.0;
      g.add(bp);
      const bp1 = new THREE.Mesh(
        new THREE.BoxGeometry(uz * 0.13, sy * 0.16, boy * 0.14), M.kumas);
      bp1.position.z = -boy * 0.07;
      bp.add(bp1);
      const bpUc = new THREE.Mesh(new THREE.SphereGeometry(sy * 0.08, 8, 6), M.taban);
      bpUc.position.z = -boy * 0.14;
      bp.add(bpUc);
      break;
    }

    /* ── yaşam destek paketi ────────────────────────────────────────
       Yuvarlak köşeli kabuk, üst kapak ve taşıma kolları, iki oksijen tüpü,
       altta yüceltici ve kanatları. Isının gittiği yer görünür olmalı. */
    case 'paket': {
      const kab = ekle(kabuk(THREE, M.sert, sy * 0.5, sz * 0.94, { seg: 20, uc: 0.2 }));
      kab.scale.x = sx * 0.5 / (sy * 0.5);
      /* Üst kapak ve iki tutamak: paket buradan kaldırılır. */
      const kapak = ekle(new THREE.Mesh(
        new THREE.BoxGeometry(sx * 0.92, sy * 0.94, sz * 0.06), M.koyu));
      kapak.position.z = sz * 0.46;
      for (const s of [-1, 1]) {
        const tut = ekle(new THREE.Mesh(
          new THREE.TorusGeometry(sy * 0.09, sy * 0.022, 6, 12), M.metal));
        tut.position.set(-sx * 0.12, s * sy * 0.3, sz * 0.5);
        tut.rotation.y = Math.PI / 2;
      }
      /* Oksijen tüpleri: pakette görünen en belirgin şey. */
      for (const s of [-1, 1]) {
        const tup = ekle(uzuv(THREE, M.metal, sy * 0.13, sy * 0.13, sz * 0.52, { sis: 0.1, seg: 14 }));
        tup.position.set(-sx * 0.16, s * sy * 0.28, sz * 0.3);
        const bas = ekle(new THREE.Mesh(
          new THREE.SphereGeometry(sy * 0.13, 12, 8), M.metal));
        bas.position.set(-sx * 0.16, s * sy * 0.28, sz * 0.3);
        const vana = ekle(new THREE.Mesh(cylGeoZ(sy * 0.05, sy * 0.05, sz * 0.07, 8), M.uyari));
        vana.position.set(-sx * 0.16, s * sy * 0.28, sz * 0.36);
      }
      /* Yüceltici: ısının gittiği yer. 8 saatte 5 kg suyu buraya verir. */
      const yuc = ekle(new THREE.Mesh(
        new THREE.BoxGeometry(sx * 0.6, sy * 0.72, sz * 0.14), M.metal));
      yuc.position.set(-sx * 0.1, 0, -sz * 0.38);
      for (let i = 0; i < 7; i++) {
        const kan = ekle(new THREE.Mesh(
          new THREE.BoxGeometry(sx * 0.56, sy * 0.02, sz * 0.1), M.koyu));
        kan.position.set(-sx * 0.1, (i / 6 - 0.5) * sy * 0.66, -sz * 0.44);
      }
      /* Bağlantı ağzı: hortumlar buradan çıkar (gövdede kurulur). */
      for (const s of [-1, 1]) {
        const ag = ekle(new THREE.Mesh(cylGeoX(sy * 0.055, sy * 0.055, sx * 0.3, 10), M.koyu));
        ag.position.set(sx * 0.4, s * sy * 0.2, sz * 0.3);
      }
      const lv = D.levha(THREE, M.kit, [p.tech?.no || p.id, 'LIFE SUPPORT'],
        { w: sy * 0.58, h: sz * 0.11 });
      lv.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), -Math.PI / 2);
      lv.position.set(-sx * 0.52, 0, sz * 0.04);
      g.add(lv);
      break;
    }

    /* ── ikincil oksijen ────────────────────────────────────────────
       İki tüp, bir kelepçe ve bir regülatör. Ana paket kesilirse EVA'yı
       bitirecek kadar oksijen; süs değil, dönüş süresi. */
    case 'kutu': {
      const govdeM = ekle(new THREE.Mesh(
        new THREE.BoxGeometry(sx * 0.5, sy, sz * 0.7), M.koyu));
      govdeM.position.z = -sz * 0.1;
      /* İki tüp sırtın ENİNE yatar. `uzuv` aşağı doğru kurar ve onu x
         etrafında çevirmek boyu y'ye taşıyordu: beyan edilen 0,34 m yerine
         0,571 m çizildi. Eksen adı geometride yazılı olmalı. */
      for (const zs of [-1, 1]) {
        const tup = ekle(new THREE.Mesh(
          cylGeoY(sz * 0.36, sz * 0.36, sy * 0.86, 12), M.metal));
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
       Boyun yatağı, saydam kabarcık, MENTEŞELİ altın vizör, üstte güneşlik,
       arkada havalandırma kanalı ve önde besleme ağzı. Baş kaskın İÇİNDE
       döner; kask dönmez, o yüzden vizör hep öne bakar. */
    case 'kask': {
      const R = Math.min(sx, sy) * 0.5;
      g.add(yatakHalkasi(THREE, M, R * 0.62, { kalin: 0.016, tirnak: 8, kol: true }))
        .position.z = -sz * 0.47;
      /* Boyun hunisi: halkadan kabarcığa geçiş. */
      const huni = ekle(uzuv(THREE, M.sert, R * 0.9, R * 0.62, sz * 0.2, { seg: 18 }));
      huni.position.z = -sz * 0.27;
      const bub = ekle(new THREE.Mesh(new THREE.SphereGeometry(R, 26, 18), M.cam));
      bub.position.z = sz * 0.06;
      /* Altın vizör: ÖN yarıyı kaplar, alın hizasından çene hizasına. */
      const vpts = [];
      for (let i = 0; i <= 10; i++) {
        const a = (40 + (i / 10) * 66) * RAD;
        vpts.push(new THREE.Vector2(R * 1.04 * Math.sin(a), R * 1.04 * Math.cos(a)));
      }
      const viz = ekle(latheZ(vpts, 22, M.vizor, -1.15, 2.3));
      viz.position.z = sz * 0.06;
      /* Menteşe kolları: vizör kaldırılabilir olmalı, yoksa gölgede kör olur. */
      for (const s of [-1, 1]) {
        const men = ekle(new THREE.Mesh(cylGeoY(R * 0.07, R * 0.07, R * 0.16, 8), M.metal));
        men.position.set(0, s * R * 1.02, sz * 0.06 + R * 0.34);
      }
      /* Güneşlik: vizörün üstünde, doğrudan güneşi kesen opak siperlik. */
      const spts = [];
      for (let i = 0; i <= 8; i++) {
        const a = (17 + (i / 8) * 20) * RAD;
        spts.push(new THREE.Vector2(R * 1.09 * Math.sin(a), R * 1.09 * Math.cos(a)));
      }
      /* Siperlik ALIN kadar; daha genişi kaskı siyah bir başlığa çevirip
         altındaki altın vizörü gölgeliyordu. */
      const sip = ekle(latheZ(spts, 20, M.kumasGolge, -0.95, 1.9));
      sip.position.z = sz * 0.06;
      /* Arka havalandırma kanalı ve önde besleme ağzı. */
      const kanal = ekle(new THREE.Mesh(
        new THREE.BoxGeometry(R * 0.36, R * 0.5, sz * 0.5), M.kumasGolge));
      kanal.position.set(-R * 0.94, 0, sz * 0.02);
      const agiz = ekle(new THREE.Mesh(cylGeoX(R * 0.1, R * 0.1, R * 0.3, 10), M.koyu));
      agiz.position.set(R * 0.92, 0, -sz * 0.2);
      break;
    }

    /* ── başlıklar ──────────────────────────────────────────────────
       Dört lamba, kamera ve anten. Vakumda gölge MUTLAK siyahtır: tek kaynak
       mürettebatın kendi elini gölgeler, o yüzden lambalar ayrılır. */
    case 'lamba': {
      const boyunduruk = ekle(new THREE.Mesh(cylGeoY(sx * 0.055, sx * 0.055, sy * 0.96, 10), M.metal));
      boyunduruk.position.set(0, 0, 0);
      for (let i = 0; i < 4; i++) {
        const y = (i / 3 - 0.5) * sy * 0.78;
        const govdeL = ekle(new THREE.Mesh(cylGeoX(sz * 0.42, sz * 0.48, sx * 0.44, 12), M.koyu));
        govdeL.position.set(sx * 0.18, y, 0);
        const cam = ekle(new THREE.Mesh(cylGeoX(sz * 0.38, sz * 0.38, sx * 0.06, 12), M.kit.white));
        cam.position.set(sx * 0.42, y, 0);
        const braket = ekle(new THREE.Mesh(
          new THREE.BoxGeometry(sx * 0.1, sy * 0.05, sz * 0.5), M.metal));
        braket.position.set(0, y, -sz * 0.2);
      }
      /* Kamera: mürettebatın gördüğünü üssün de görmesi için. */
      const kam = ekle(new THREE.Mesh(
        new THREE.BoxGeometry(sx * 0.3, sy * 0.16, sz * 0.9), M.koyu));
      kam.position.set(sx * 0.1, 0, sz * 0.7);
      const lens = ekle(new THREE.Mesh(cylGeoX(sz * 0.26, sz * 0.26, sx * 0.14, 10), M.kit.white));
      lens.position.set(sx * 0.3, 0, sz * 0.7);
      /* Anten: bağlantı kopmazsa EVA devam eder. GERİYE yatar ve kask
         tepesini AŞMAZ - dik bir çubuk beyan edilen boyu 0,26 m şişiriyordu
         ve bir kapı açıklığı, geçecek şeyin en yüksek noktasına göre ölçülür. */
      const ant = ekle(new THREE.Mesh(cylGeoZ(sx * 0.02, sx * 0.014, sz * 1.5, 6), M.metal));
      ant.position.set(-sx * 0.42, sy * 0.36, -sz * 0.1);
      ant.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), -0.6);  // euler-ok: tek eksen
      break;
    }

    /* ── göğüs paneli (DCM) ─────────────────────────────────────────
       Basınç göstergesi, dört korumalı anahtar, bir tahliye vanası. Her
       kumanda eldivenli elle çevrilecek kadar büyük ve birbirinden ayırt
       edilecek kadar farklı olmak zorunda - dokunarak bulunur. */
    case 'panel': {
      const gvd = ekle(new THREE.Mesh(new THREE.BoxGeometry(sx * 0.8, sy, sz), M.koyu));
      const ekran = ekle(new THREE.Mesh(
        new THREE.BoxGeometry(sx * 0.1, sy * 0.46, sz * 0.34), M.kit.white));
      ekran.position.set(sx * 0.44, sy * 0.22, sz * 0.26);
      /* Basınç göstergesi: yuvarlak, çünkü ibre okunur. */
      const gost = ekle(new THREE.Mesh(cylGeoX(sz * 0.22, sz * 0.22, sx * 0.12, 14), M.metal));
      gost.position.set(sx * 0.44, -sy * 0.28, sz * 0.24);
      const ibre = ekle(new THREE.Mesh(
        new THREE.BoxGeometry(sx * 0.02, sy * 0.02, sz * 0.18), M.serit));
      ibre.position.set(sx * 0.51, -sy * 0.28, sz * 0.28);
      ibre.rotation.x = 0.6;
      for (let i = 0; i < 4; i++) {
        const y = (i / 3 - 0.5) * sy * 0.66;
        const koruma = ekle(new THREE.Mesh(
          new THREE.BoxGeometry(sx * 0.16, sy * 0.13, sz * 0.16), M.metal));
        koruma.position.set(sx * 0.44, y, -sz * 0.24);
        const anah = ekle(new THREE.Mesh(cylGeoX(sz * 0.05, sz * 0.05, sx * 0.14, 8),
          i % 2 ? M.uyari : M.serit));
        anah.position.set(sx * 0.5, y, -sz * 0.24);
      }
      /* Tahliye vanası: kırmızı ve tek başına, yanlışlıkla çevrilmesin diye. */
      const vana = ekle(new THREE.Mesh(cylGeoX(sz * 0.14, sz * 0.14, sx * 0.2, 10), M.serit));
      vana.position.set(sx * 0.5, sy * 0.42, -sz * 0.3);
      break;
    }

    /* ── emniyet halatı ve alet kutusu ──────────────────────────────
       Makara, karabina ve üç alet. Bağlanmamış bir alet EVA'yı tek başına
       bitirir; o yüzden her aletin kendi bağı vardır. */
    case 'halat': {
      /* Makara gövdenin ORTASINDA durur; `uzuv` aşağı kurup x'te çevrilince
         merkezi 0,078 m yana kayıyordu. Ekseni adında yazan silindir bunu
         yapamaz. */
      const mak = ekle(new THREE.Mesh(
        cylGeoY(sz * 0.44, sz * 0.44, sy * 0.34, 14), M.koyu));
      const sarim = ekle(new THREE.Mesh(
        new THREE.TorusGeometry(sz * 0.32, sz * 0.09, 6, 18), M.kumasGolge));
      sarim.rotation.x = Math.PI / 2;
      /* Karabina: halatın ucundaki kilitli kanca. */
      const kanca = ekle(new THREE.Mesh(
        new THREE.TorusGeometry(sz * 0.2, sz * 0.045, 6, 14, TAU * 0.82), M.metal));
      kanca.position.set(sx * 0.26, 0, -sz * 0.24);
      kanca.rotation.x = Math.PI / 2;
      /* Aletler: tork anahtarı, kesici ve örnek torbası. */
      const aletler = [
        [-sx * 0.3, sz * 0.5, M.metal], [0, sz * 0.4, M.uyari], [sx * 0.3, sz * 0.46, M.kumasGolge],
      ];
      for (const [x, boy, mat] of aletler) {
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

/* Hortum: paketten göğse giden esnek bağlantı. Bir giysiyi giysi yapan
   ayrıntılardan biri - kutu bir sırt çantası, hortum ise onu SOLUNAN bir
   şeye bağlar. */
function hortum(THREE, mat, a, b, tepe, r) {
  const egri = new THREE.CatmullRomCurve3([
    new THREE.Vector3(...a),
    new THREE.Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, tepe),
    new THREE.Vector3(...b),
  ]);
  return new THREE.Mesh(new THREE.TubeGeometry(egri, 18, r, 8, false), mat);
}

/**
 * Giysiyi kurar.
 * @param opts.poz  POZLAR anahtarı ya da poz nesnesi
 * @param opts.seritRenk  göğüs şeridi rengi — iki mürettebat böyle ayrılır
 */
export function buildAstronaut(THREE, { tokens = {}, poz = 'dik', seritRenk = null } = {}) {
  const P = typeof poz === 'string' ? (POZLAR[poz] ?? POZLAR.dik) : poz;
  const M = suitMaterials(THREE, tokens);
  if (seritRenk !== null) M.serit = new THREE.MeshStandardMaterial({
    color: seritRenk, roughness: 0.7, metalness: 0.1 });

  const kok = new THREE.Group();
  /* Gövde eğimi BELDEN: bir insan eğilirken bacakları yerinde kalır.
     Bel yatağının yüksekliği katalogdan gelir, elle yazılmaz. */
  const altGovde = partById('alt-govde');
  const belZ = altGovde.pos[2] + altGovde.size[2] / 2;
  const bel = new THREE.Group();
  bel.position.z = belZ;
  bel.rotation.y = P.govdeEgim * RAD;
  const nodes = new Map();

  for (const p of PARTS) {
    const yerler = kopyaKonumlari(p);
    /* Aynalama ekseni KATALOGDA yazılı; kimse `pos`'un bir bileşenini başka
       bir eksenin büyüklüğü diye yeniden yorumlamıyor. `yan` işareti +Y
       (sol) tarafı +1'dir. */
    yerler.forEach(([x, y, z], i) => {
      const yan = yerler.length === 2 ? (y >= 0 ? 1 : -1) : 0;
      const gg = govde(THREE, p, M, P, yan);
      gg.name = yerler.length === 2 ? `${p.id}#${i + 1}` : p.id;
      gg.userData.part = p;
      gg.userData.partId = p.id;
      gg.userData.yan = yan;

      /* İSKELETE BAĞLAMA. Bir parçayı mutlak konuma koymak onu manken yapar:
         bacak bükülür, ayak havada kalır. Her parça, hareketini takip etmesi
         gereken MAFSALA bağlanır. */
      const dizler = nodes.get('alt-govde')?.userData.diz;
      const kolG = nodes.get(i === 0 ? 'kollar' : 'kollar#2') ?? nodes.get('kollar');

      if (p.id === 'cizmeler' && dizler && dizler[i]) {
        /* Çizmenin kaynak noktası AYAK BİLEĞİ; baldırın alt ucuna oturur. */
        gg.position.set(x, 0, dizler[i].userData.ayakUcu ?? 0);
        dizler[i].add(gg);
      } else if (p.id === 'eldivenler' && kolG?.userData.bilek) {
        gg.position.set(0, 0, kolG.userData.bilekZ);
        kolG.userData.bilek.add(gg);
      } else if (p.id === 'kollar') {
        /* Kol OMUZDAN döner ve omuz kolun kendi tepesidir - sayı katalogdan. */
        const omuz = new THREE.Group();
        omuz.position.set(x, y, z + p.size[2] / 2 - belZ);
        omuz.rotation.y = mafsal(P, 'omuz', i);
        bel.add(omuz);
        omuz.add(gg);
      } else {
        const anne = z > belZ ? bel : kok;
        gg.position.set(x, y, anne === bel ? z - belZ : z);
        anne.add(gg);
      }
      nodes.set(i === 0 ? p.id : `${p.id}#${i + 1}`, gg);
    });
  }

  /* HORTUMLAR: paketin ağızlarından göğüs paneline. Gövdeyle birlikte eğilsin
     diye bele bağlanır, ayrı bir parça değildir. */
  {
    const paket = partById('yasam-paketi'), panel = partById('gogus-paneli');
    const hg = new THREE.Group();
    for (const s of [-1, 1]) {
      const a = [paket.pos[0] + paket.size[0] * 0.4, s * paket.size[1] * 0.2,
        paket.pos[2] + paket.size[2] * 0.3 - belZ];
      const b = [panel.pos[0] - panel.size[0] * 0.3, s * panel.size[1] * 0.3,
        panel.pos[2] - belZ];
      const h = hortum(THREE, M.koyu, a, b, Math.max(a[2], b[2]) + 0.16, 0.022);
      h.castShadow = true;
      hg.add(h);
    }
    bel.add(hg);
    nodes.set('hortumlar', hg);
  }

  kok.add(bel);

  /* AYAKLAR YERE OTURUR. Hangi pozda hangi noktanın en alta düştüğü poza
     bağlıdır; sabit bir ofset yazmak çömelmiş bir figürü havada bırakır.
     Ölçülür ve köke o kadar kaydırılır. */
  kok.updateMatrixWorld(true);
  {
    const v = new THREE.Vector3();
    let enAlt = Infinity;
    kok.traverse((o) => {
      const a = o.isMesh && o.geometry?.attributes?.position;
      if (!a) return;
      for (let i = 0; i < a.count; i++) {
        v.fromBufferAttribute(a, i).applyMatrix4(o.matrixWorld);
        if (v.z < enAlt) enAlt = v.z;
      }
    });
    if (Number.isFinite(enAlt)) kok.position.z -= enAlt;
  }
  kok.userData.notes = { regime: 'yüzey EVA',
    why: `Giysili boy ${BOY_M} m, omuz ${OMUZ_M} m: habitat kapısı ve tutamak aralıkları bu ölçüye göre belirlenir, çıplak insana göre değil.` };
  kok.userData.poz = P;
  return { root: kok, bel, nodes, materials: M, poz: P };
}

export { PARTS, partById };
