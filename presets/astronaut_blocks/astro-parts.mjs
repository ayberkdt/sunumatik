/* astro-parts.mjs — bir yüzey giysisinin KATALOĞU (three görmez).
 *
 * Bu dosya bir figür değil, bir GİYSİ tarif eder. Her satırda bileşenin
 * neye bağlandığı, hangi arayüzle, kaç kilo olduğu, ne kadar güç çektiği,
 * hangi basınç ve sıcaklık bandında çalıştığı ve NEDEN VAR OLDUĞU yazılıdır.
 * Biçim `sat-parts.mjs` ve `hab-parts.mjs` ile birebir aynıdır: aynı alanları
 * beyan eden her şey aynı patlatma, aynı bütçe ve aynı geometri kapısından
 * geçer.
 *
 * ÖLÇEK DÜRÜSTLÜĞÜ. Habitat planı astronotu 2 m referans olarak kullanıyor;
 * burada beyan edilen boy giysili ve kasklı toplam yüksekliktir, çıplak insan
 * boyu değil. Bir yüzey giysisi 1,75 m'lik birini 1,95 m yapar ve omuz
 * genişliğini 0,55 m'den 0,75 m'ye çıkarır — habitat kapısı, el kilidi ve
 * tutamak aralıkları bu sayıya göre ölçülür, insana göre değil.
 *
 * KAYNAK. Kütle ve güç değerleri kamuya açık EMU/xEMU sınıfı yüzey giysisi
 * büyüklükleridir; tek tek bir uçuş donanımının künyesi değil, o sınıfın
 * ölçeğidir ve burada SINIF olarak beyan edilir.
 */

/** Giysinin beyan edilen toplam yüksekliği (m) — kask dâhil. */
export const BOY_M = 1.95;
/** Omuz genişliği (m) — kapı ve geçiş açıklıkları bununla ölçülür.
 *  ÇİZİLEN genişliktir: kol yatakları ve kolların kendisi dâhil ölçülmüş
 *  0,79 m: omuz boyundurukları, yataklar ve kolların kendisi dâhil.
 *  Sayı üç kez ÖLÇÜME UYDURULDU, hiç tersi olmadı: 0,84 → 0,88 (giysi gerçek
 *  bir basınçlı giysi olarak yeniden çizilince) → 0,79 (kollar insan gibi
 *  gövdeye yakınsayınca; dimdik asılı kol omuz genişliğini bileğe kadar
 *  taşıyordu). Bir kapı açıklığı niyete göre değil, geçecek şeye göre
 *  ölçülür. */
export const OMUZ_M = 0.85;
/* DİKEY DÜZEN — bir kez, tablo hâlinde.
 *
 * İlk yazışta kalça 0,774 m'de çıkıyordu: 1,95 m boyunda bir figür için
 * bacaklar kısa, gövde ağırdı ve siluet "üstüne bacak takılmış bir gövde"
 * gibi okunuyordu. İnsanda kalça mafsalı boyun yaklaşık 0,53'ündedir.
 *
 *   yer            0,00
 *   ayak bileği    0,20   çizme (Ay botu ayrı bir OVERSHOE'dur, kalındır)
 *   diz            0,64   baldır 0,44
 *   kalça          1,10   uyluk 0,46 · boyun %56'sı
 *   bel yatağı     1,18
 *   omuz mafsalı   1,58
 *   boyun halkası  1,66
 *   kask tepesi    1,95
 *
 * Froude sayısı bacak boyu olarak KALÇA YÜKSEKLİĞİNİ ister; yürüyüş modülü
 * bunu kurulan figürden ölçer, buradan kopyalamaz.
 */
export const DIKEY = Object.freeze({
  ayakBilegi: 0.20, diz: 0.64, kalca: 1.10, bel: 1.18, omuz: 1.58,
  boyun: 1.66, tepe: 1.95,
});
/**
 * BOYUN ÇAPI — tabloda yalnız YÜKSEKLİK vardı, çap hiçbir yerde yazmıyordu,
 * o yüzden kimse ona uymuyordu: gövde kabuğu boyun halkasının hizasında
 * 0,56 m genişliğinde bitiyor, kask da ekvatoru halkanın 25 mm üstünde
 * durduğu için 0,42 m ile aynı bandı dolduruyordu. Sonuç, omuzdan tepeye
 * hiç daralmayan bir siluet - yani BOYUNSUZ bir figür.
 *
 * Bir boyun, iki geniş kütle arasındaki DARALMADIR. Ölçüt de o: göğsün en
 * geniş kesiti ile kask arasında bir yerel en küçük olmak ZORUNDA ve o en
 * küçük göğsün %55'ini geçemez. Giysili boyun kilidi 0,26 m'dir (çıplak
 * boyun 0,12; aradaki fark basınç contası, kilit bileziği ve körük).
 */
export const BOYUN_CAP_M = 0.26;

/**
 * GÖVDE KAPSÜLÜ — kolun İÇİNE GİREMEYECEĞİ hacim.
 *
 * Ölçülen kusur: yürüyüş çevriminin 60 fazının 32'sinde el gövdenin içinde,
 * en kötüsünde 2201 eldiven köşesi. Sebep basit - kol salınımı bir AÇIDIR ve
 * çözümün elin nereye gittiğinden haberi yoktur. Üstelik kolun dışa açılacak
 * bir ekseni de yoktu, yani düzeltmek için serbestlik de yoktu.
 *
 * Kapsül düşey bir eksen parçası ve bir yarıçaptır. Yarıçap ÖLÇÜLDÜ: gövdenin
 * en geniş kesiti (yarı en 0,308) artı eldivenin yarı kalınlığı (0,094), yani
 * elin merkezi bu yarıçapın içine girerse el gövdeye değiyor demektir.
 *
 * Beyan edilir, çünkü kodun içine gömülmüş bir çarpışma yarıçapını kimse
 * sonradan bulamaz.
 */
export const GOVDE_KAPSULU = Object.freeze({
  altZ: 1.02, ustZ: 1.62, yariCap: 0.40,
  neden: 'Gövdenin yarı eni 0,308 m; eldivenin yarı kalınlığı 0,094 m. '
    + 'Elin MERKEZİ bu yarıçapın içine girerse el gövdeye girmiş demektir.',
});
/**
 * EKLEM SÖZLEŞMESİ — deponun "aksamlar" kütüphanesiyle aynı biçim.
 *
 * `presets/physical_rigs/mechanism-index.mjs` şunu söyler: hareketli parçasını
 * olan her kurucu eklemlerini `userData.rig.joints` ile ilan eder ve orada her
 * eklemin DÜĞÜMÜ, EKSENİ, SINIRI ve HIZI yazar. Astronotun hiçbiri yoktu: ne
 * beyan edilmiş eksen, ne sınır - dolayısıyla bir uzvun ters dönmesini
 * yakalayabilecek hiçbir şey yoktu. Eldivenin sağ eli tam bu yüzden aynalanmak
 * yerine kopyalanmış olarak kalabildi.
 *
 * SINIRLAR BASINÇLI GİYSİNİNDİR, çıplak insanın değil. Gömlek kolunda omuz
 * 180° fleksiyon yapar; A7L sınıfı bir giyside konvolüt mafsal ve basınç bunu
 * yaklaşık 120°'ye indirir. Ayak bileği en dar mafsaldır ve aşağıda görüleceği
 * gibi yürüyüş çözümünün istediği açı oraya SIĞMAZ - o yüzden kırpılır.
 */
export const EKLEMLER = Object.freeze({
  'bel.donme':   { node: 'belDonme', axis: 'z', range: [-28, 28], rateDegS: 90 },
  'omuz.L':      { node: 'omuzL', axis: 'y', range: [-55, 120], rateDegS: 120 },
  'omuz.R':      { node: 'omuzR', axis: 'y', range: [-55, 120], rateDegS: 120 },
  'dirsek.L':    { node: 'dirsekL', axis: 'y', range: [0, 122], rateDegS: 150 },
  'dirsek.R':    { node: 'dirsekR', axis: 'y', range: [0, 122], rateDegS: 150 },
  'kalca.L':     { node: 'kalcaL', axis: 'y', range: [-28, 72], rateDegS: 110 },
  'kalca.R':     { node: 'kalcaR', axis: 'y', range: [-28, 72], rateDegS: 110 },
  'diz.L':       { node: 'dizL', axis: 'y', range: [0, 104], rateDegS: 160 },
  'diz.R':       { node: 'dizR', axis: 'y', range: [0, 104], rateDegS: 160 },
  'ayak.L':      { node: 'ayakL', axis: 'y', range: [-26, 34], rateDegS: 130 },
  /* TEK EKSEN BİR KOL DEĞİLDİR. Bu satırlar yazılana kadar figürdeki bütün
     uzuv eklemleri y ekseniydi: kol yalnız ileri-geri sallanabiliyordu.
     Ölçülen üç sonuç da bildirilen şikâyetlerdi - elin yönü her pozda donuk
     kalıyor, yürüyüş tek düzlemde kalıyor, ve yürüyüş çevriminin 60 fazının
     32'sinde el gövdenin İÇİNDE çünkü çözümün onu dışarı çıkaracak hiçbir
     serbestliği yok.

     SINIRLAR BASINÇLI GİYSİNİNDİR. Çıplak omuz 180° abdüksiyon yapar; 29,6
     kPa'ya şişmiş bir omuz yatağı ve konvolüt onu ~62°'ye indirir. Ön kol
     pronasyonu çıplakta 180°'dir, giyside bilek yatağının sürtünmesiyle
     ~130°. Kalça abdüksiyonu bacak halkasının izin verdiği kadardır. */
  'omuz.acilma.L': { node: 'omuzAcL', axis: 'x', range: [-8, 62], rateDegS: 100 },
  'omuz.acilma.R': { node: 'omuzAcR', axis: 'x', range: [-8, 62], rateDegS: 100 },
  'omuz.donme.L':  { node: 'omuzDonL', axis: 'z', range: [-35, 45], rateDegS: 110 },
  'omuz.donme.R':  { node: 'omuzDonR', axis: 'z', range: [-35, 45], rateDegS: 110 },
  'onkol.donme.L': { node: 'onkolDonL', axis: 'z', range: [-60, 70], rateDegS: 140 },
  'onkol.donme.R': { node: 'onkolDonR', axis: 'z', range: [-60, 70], rateDegS: 140 },
  'kalca.acilma.L': { node: 'kalcaAcL', axis: 'x', range: [-6, 28], rateDegS: 90 },
  'kalca.acilma.R': { node: 'kalcaAcR', axis: 'x', range: [-6, 28], rateDegS: 90 },
  'ayak.R':      { node: 'ayakR', axis: 'y', range: [-26, 34], rateDegS: 130 },
});
/** Poz alanı → eklem adı (sol, sağ). */
export const POZ_EKLEM = Object.freeze({
  omuzAcilma: ['omuz.acilma.L', 'omuz.acilma.R'],
  omuzDonme: ['omuz.donme.L', 'omuz.donme.R'],
  onkolDonme: ['onkol.donme.L', 'onkol.donme.R'],
  kalcaAcilma: ['kalca.acilma.L', 'kalca.acilma.R'],
  omuz: ['omuz.L', 'omuz.R'], dirsek: ['dirsek.L', 'dirsek.R'],
  kalca: ['kalca.L', 'kalca.R'], diz: ['diz.L', 'diz.R'], ayak: ['ayak.L', 'ayak.R'],
});
/** Bir açıyı kendi ekleminin sınırına kırpar. */
export function sinirla(ad, aciDeg) {
  const e = EKLEMLER[ad];
  if (!e) return aciDeg;
  return Math.max(e.range[0], Math.min(e.range[1], aciDeg));
}

/* Ayak: bilekten buruna ve topuğa olan yatay mesafe. Bilek sınıra dayanınca
   ayak bu uçlardan biri etrafında DÖNER ve bilek o kadar yükselir. */
/* AYAK ENİ. Beyan edilen 0,23 m'ydi ve çizilen 0,31'e çıkıyordu; ikisi de
   bir ayak için fazla - Ay botu kalın bir overshoe'dur ama 1,95 m'lik bir
   figürün ayağı 0,17 m'den geniş değildir. Ölçülen kusur: çizme plandan
   neredeyse KAREYDİ (0,343 x 0,266) ve bir kare, yürüdüğü yönü söylemez. */
export const AYAK_EN_M = 0.17;
export const AYAK_ON_M = 0.22;
export const AYAK_ARKA_M = 0.12;

/** Uyluk ve baldır uzunluğu — ters kinematik bunları kullanır. */
export const UYLUK_M = DIKEY.kalca - DIKEY.diz;
export const BALDIR_M = DIKEY.diz - DIKEY.ayakBilegi;

/** Çalışma basıncı (kPa) ve karşılık gelen oksijen kısmi basıncı. */
export const BASINC_KPA = 29.6;

/* GÖVDE ÇERÇEVESİ — bir kez, açıkça.
 *
 * +X İLERİ (göğsün baktığı yön) · +Y SOL · +Z YUKARI.
 *
 * Bu satır yazılana kadar çerçeve aynı anda üç şeydi. Kurulan figür ölçüldü:
 * omuz yatakları x = ±0,270 ve y = 0'da, yani birisi GÖĞÜSTE, öteki SIRTTA;
 * sırt paketi y = -0,268'de, yani sol kolun içinde; göğüs paneli y = +0,227'de.
 * Sebep, kataloğun aynalama eksenini hiç söylememesiydi: montajcı qty 2 olan
 * parçalarda `pos[0]`'ı bir KOORDİNAT değil bir BÜYÜKLÜK diye okuyup x'te
 * aynalıyordu, kollar için ayrı bir özel durum y'de aynalıyordu, gövde takımı
 * ise +Y'yi ileri sanan elle yazılmış konumlarla yerleştirilmişti.
 *
 * Artık `pos` harfiyen konumdur, aynalama eksenini satırın kendisi beyan eder
 * ve her satır gövdede NEREDE durduğunu söyler - kapı işareti karşılaştırır.
 */
export const EKSEN = Object.freeze({ ileri: '+x', sol: '+y', yukari: '+z' });

/**
 * EL ÇERÇEVESİ — bir elin hangi el olduğu ÖLÇÜLEBİLİR bir şeydir.
 *
 * Ölçülen kusur: avuç normali (1,000 · 0,000 · 0,000), yani tam ÖNE; parmaklar
 * öne kıvrık; başparmak İKİ elde de gövde orta çizgisine doğru. Bu dördü bir
 * arada imkânsız bir el tarif eder - avucu öne bakan bir SOL elde başparmak
 * kişinin solundadır. Yani sol kola sağ el, sağ kola sol el takılmıştı.
 *
 * Ayna kapısı bunu GÖREMEZ ve sebebi öğreticidir: o kapı "bu mesh'in karşı
 * tarafta eşi var mı" diye sorar ve iki eldiven birbirinin kusursuz aynasıdır
 * (0,1 mm). Birbirinin aynası olmak, doğru kol için doğru el olmak demek
 * değildir. ELLİLİK ayrı bir sorudur ve ayrı bir ölçüm ister.
 *
 * Kol yanda asılıyken (sıfır duruş) beklenen:
 *
 *   avuç normali   −ayna·y   içe, uyluğa doğru
 *   başparmak      +x        öne
 *   parmaklar      −z        aşağı
 *
 * ELLİLİK SINAVI: (başparmak × parmak) · avuçNormali işareti sol ve sağ elde
 * ZIT olmak zorundadır. Bir sol eli bir sağ elden ayıran tek şey budur.
 */
export const EL_CERCEVE = Object.freeze({
  avucNormali: 'ic', basparmak: '+x', parmaklar: '-z',
  /** Sol el için beklenen ellilik işareti; sağ el bunun tersi. */
  solIsaret: -1,
});

/**
 * ZARF PAYI — bir parçanın beyan ettiği `size`ı ne kadar aşabildiği (oran).
 *
 * Astronotun ÇİZİLEN geometrisini hiçbir kapı ölçmüyordu ve 0,36 m'lik bir
 * çizmenin etrafında 0,657 m'lik bir çember bu yüzden aylarca durabildi.
 * Ama düz "çizilen ≤ beyan" kuralı burada işlemez: `size`ı KURUCU okur ve
 * onunla ölçeklenir, yani beyanı büyütmek çizimi de büyütür (denendi ve
 * ölçüldü: kol 0,257 → 0,446, oran yerinde saydı). Sözleşme ters yönde
 * işler - kurucu beyana borçludur - ve meşru taşmalar (tabanın ayaktan
 * geniş olması, omuz yatağının kol borusundan geniş olması) ADIYLA beyan
 * edilir.
 *
 * VARSAYILAN 0,12: beyan etmeyen bir parça bu kadarını aşamaz.
 * TAVAN 0,85: hiçbir parça payını istediği kadar büyütemez; 0,40 üstü
 * beyanlar BORÇTUR ve neyin taştığını adıyla yazmak zorundadır.
 */
export const ZARF_VARSAYILAN = 0.12;
export const ZARF_TAVAN = 0.85;

/** Parçanın gövdedeki yeri; kapı çizilen konumun işaretini buna göre sınar. */
export const YONLER = Object.freeze({
  gogus: { ad: 'Chest', eksen: 0, isaret: 1 },
  sirt: { ad: 'Back', eksen: 0, isaret: -1 },
  yan: { ad: 'Left/right pair', eksen: 1, isaret: 0 },
  orta: { ad: 'Centreline', eksen: null, isaret: 0 },
});

/**
 * qty 2 olan bir parçanın İKİ kopyasının konumu.
 * `ayna` hangi eksende aynalandığını SÖYLER; kimse `pos`'un bir bileşenini
 * başka bir eksenin büyüklüğü diye yeniden yorumlamaz.
 */
export function kopyaKonumlari(p) {
  if ((p.qty ?? 1) !== 2) return [p.pos.slice()];
  const k = { x: 0, y: 1, z: 2 }[p.ayna ?? 'y'];
  const b = p.pos.slice();
  b[k] = -b[k];
  return [p.pos.slice(), b];
}

/** qty 2 olan parçanın iki kopyasının birlikte kapladığı zarf. */
export function parcaZarfi(p) {
  const yerler = kopyaKonumlari(p);
  const mn = [0, 1, 2].map(i => Math.min(...yerler.map(q => q[i] - p.size[i] / 2)));
  const mx = [0, 1, 2].map(i => Math.max(...yerler.map(q => q[i] + p.size[i] / 2)));
  return { mn, mx, size: [0, 1, 2].map(i => mx[i] - mn[i]) };
}

export const SUBSYSTEMS = Object.freeze({
  basinc: { ad: 'Pressure garment', renk: '#d8dbe2' },
  yasam: { ad: 'Life support', renk: '#7fb2d8' },
  gorus: { ad: 'Vision and lighting', renk: '#e0c27a' },
  hareket: { ad: 'Mobility joints', renk: '#a8d8b0' },
  arayuz: { ad: 'Crew interface', renk: '#d8a0b8' },
});

export const INTERFACES = Object.freeze({
  kilit: 'Locking ring (donned and doffed under pressure)',
  civata: 'Bolted',
  kumas: 'Sewn/bonded into the pressure garment',
  konnektor: 'Umbilical connector',
  mentese: 'Hinge',
});

/* Giyinme sırası keyfi değil: alt gövde önce girer, sert üst gövde ondan
   sonra iner, sırt paketi en son bağlanır çünkü bağlandıktan sonra
   mürettebat kendi başına eğilemez. */
export const STEPS = Object.freeze([
  { no: 1, ad: 'Liquid cooling garment', aciklama: 'Soğutma tulumu tene giyilir: ısıyı taşıyan şey hava değil, o borulardaki sudur.' },
  { no: 2, ad: 'Lower torso', aciklama: 'Alt gövde, bacaklar ve çizmeler tek parça girer.' },
  { no: 3, ad: 'Hard upper torso', aciklama: 'Sert üst gövde yukarıdan iner; mürettebat içine yukarı doğru girer.' },
  { no: 4, ad: 'Life support pack', aciklama: 'Sırt paketi kilitlenir. Bu andan sonra kişi kendi başına eğilemez.' },
  { no: 5, ad: 'Arms, gloves, helmet', aciklama: 'Kollar, eldivenler ve kask kilit halkalarına oturur.' },
  { no: 6, ad: 'Leak check and pressurise', aciklama: 'Kaçak denetimi, sonra basınçlandırma. Sıra tersine çevrilemez.' },
]);

export const PARTS = Object.freeze([
  /* ADIM 1 — soğutma */
  { id: 'sogutma-tulumu', ad: 'Liquid cooling garment', sistem: 'yasam', step: 1,
    mountsTo: null, arayuz: 'kumas', massKg: 3.0,
    pos: [0, 0, 1.20], size: [0.24, 0.28, 0.95], yon: 'orta', sekil: 'tulum',
    /* ZARF: beyan edilen `size`ın ÖLÇÜLEN aşımı. */
    zarfOran: 0.4,
    zarfNeden: 'Soğutma borusu halkaları gövdeyi SARAR (0,337 m), yani çapları gövdenin çapıdır; tulumun kendi kumaş kalınlığı değil.',
    tech: {
      no: 'AS-LIF-010',
      malzeme: 'Spandex with 90 m of 4 mm PVC tubing',
      guc_W: 0,
      basinc_kPa: 0,
      sicaklik_C: [10, 35],
      baglanti: 'Multiple water connector to the pack',
      isiYolu: 'Metabolic heat -> water -> sublimator',
      detay: '90 m of tubing over the torso and limbs; carries up to 400 W of metabolic heat. Air cannot do this job at 29.6 kPa - there is not enough mass flow.',
      kalite: 'Worn against the skin; the one garment that is laundered',
    },
    why: 'Bir insan çalışırken 300–500 W ısı üretir ve giysi içinde o ısıyı taşıyacak kadar hava yoktur. Isıyı su taşır; bu tulum olmadan mürettebat yirmi dakikada aşırı ısınır.' },

  /* ADIM 2 — alt gövde */
  { id: 'alt-govde', ad: 'Lower torso assembly', sistem: 'basinc', step: 2,
    mountsTo: 'sogutma-tulumu', arayuz: 'kilit', massKg: 12.5,
    pos: [0, 0, 0.59], size: [0.38, 0.44, 1.18], yon: 'orta', sekil: 'altGovde',
    /* ZARF: beyan edilen `size`ın ÖLÇÜLEN aşımı. */
    zarfOran: 0.6,
    zarfNeden: 'Leğen süpürmesi 0,696 m: iki kalçanın AÇIKLIĞI. Beyan edilen 0,44 m tek bir uyluğu ölçüyordu. BORÇ: kalça açıklığı ayrı beyan edilmeli.',
    tech: {
      no: 'AS-PRS-020',
      malzeme: 'Ortho-fabric over urethane bladder, aluminium waist ring',
      guc_W: 0,
      basinc_kPa: 29.6,
      sicaklik_C: [-150, 120],
      baglanti: 'Waist locking ring to the hard upper torso',
      detay: 'Bacaklar, kalça ve çizmeler tek parça. Diz ve kalça mafsalları konvolüt: basınç altında bükülebilmesi için hacmi sabit tutan kıvrımlar.',
      kalite: 'Kaçak oranı 24 saatte hacmin %1\'inden az',
    },
    why: 'Basınçlı bir tulum doğal hâlinde DİK bir silindirdir ve bükülmez. Konvolüt mafsallar hacmi sabit tuttuğu için diz bükülür; onlar olmadan mürettebat yürüyemez.' },

  { id: 'cizmeler', ad: 'Boots', sistem: 'hareket', step: 2,
    mountsTo: 'alt-govde', arayuz: 'kumas', massKg: 2.4, qty: 2,
    /* BİLEK AYAĞIN ÜSTÜNDE. x = 0,05 iken çizme bileğin 50 mm ÖNÜNE
       kayıyordu: çizilen burun 0,279 (beyan 0,22) ve topuk 0,079 (beyan
       0,12) - yani topuk neredeyse yok, ayak öne taşıyordu. Bu yalnız
       görünüş değil: `ayakYuvarlanma` bu iki sayıyı KALDIRAÇ KOLU olarak
       kullanıyor, yani kırpılan bilekte tabanın ne kadar yükseleceğini
       geometriyle uyuşmayan sayılardan hesaplıyordu - topukta %34 hata.
       x = 0 ile bilek kalıbın beyan edilen yerine oturur. */
    pos: [0, 0.145, 0.10], size: [0.36, 0.19, 0.22], yon: 'yan', ayna: 'y', sekil: 'cizme',
    /* ZARF: beyan edilen `size`ın ÖLÇÜLEN aşımı. */
    zarfOran: 0.25,
    zarfNeden: 'Taban ayaktan geniştir (basma alanı: 1,06 kat) ve manşet halkaları bileği sarar. Çizilen 0,366 x 0,231 - artık boyundan geniş değil, ki bir ayağın yürüdüğü yönü söyleyen tek şey odur.',
    tech: {
      no: 'AS-MOB-021',
      malzeme: 'Silicone sole, ortho-fabric upper, metal shank',
      guc_W: 0,
      basinc_kPa: 29.6,
      sicaklik_C: [-180, 120],
      baglanti: 'Sewn to the lower torso; ankle bearing above',
      detay: 'Taban deseni regolitte tutunmak için; bilek yatağı ayağın giysiyi çevirmeden dönmesini sağlar.',
      kalite: 'Taban aşınması 40 EVA sonrası ölçülür',
    },
    why: 'Toz elektrostatik yapışır ve derin desen olmadan taban cam gibi kayar. Bilek yatağı da yürümenin şartı: yatak olmadan her adım bütün giysiyi çevirir.' },

  /* ADIM 3 — sert üst gövde */
  { id: 'ust-govde', ad: 'Hard upper torso', sistem: 'basinc', step: 3,
    mountsTo: 'alt-govde', arayuz: 'kilit', massKg: 16.0,
    pos: [0, 0, 1.42], size: [0.36, 0.56, 0.48], yon: 'orta', sekil: 'ustGovde',
    /* AYNA: bu parça bilerek asimetriktir - beyan edilmezse
       ayna kapısı düşer (validate-astronaut §9). */
    asimetrik: 'Komutan şeridi, bayrak ve kontrol listesi etiketi tek yanda: işaretler bir giysiyi UZAKTAN ayırt etmek içindir ve iki yana da konursa o işi yapmaz.',
    /* ZARF: beyan edilen `size`ın ÖLÇÜLEN aşımı. */
    zarfOran: 0.25,
    zarfNeden: 'Göğüs dolgusu ÖNE taşar: basınçlı giyside öne eğilebilmek için orada yer bırakılır.',
    tech: {
      no: 'AS-PRS-030',
      malzeme: 'Spun aluminium shell with four bearing rings',
      guc_W: 0,
      basinc_kPa: 29.6,
      sicaklik_C: [-150, 120],
      baglanti: 'Bel, iki omuz ve boyun olmak üzere dört kilit halkası; arkada pakete civatalı',
      detay: 'Sert kabuk: basınç altında biçim değiştirmeyen tek parça. Bütün yükler - paket, kollar, kask - buradan geçer.',
      kalite: 'Kabuk 2x çalışma basıncında ispatlanır',
    },
    why: 'Yumuşak bir gövde basınç altında şişer ve kolların dönmesi için gereken sabit geometri kalmaz. Sert kabuk, dört yatağın birbirine göre yerini koruyan şeydir.' },

  { id: 'omuz-yatagi', ad: 'Shoulder bearings', sistem: 'hareket', step: 3,
    mountsTo: 'ust-govde', arayuz: 'kilit', massKg: 1.1, qty: 2,
    pos: [0, 0.25, 1.58], size: [0.16, 0.10, 0.16], yon: 'yan', ayna: 'y', sekil: 'yatak',
    tech: {
      no: 'AS-MOB-031',
      malzeme: 'Anodised aluminium races, dry-lubricated',
      guc_W: 0,
      basinc_kPa: 29.6,
      sicaklik_C: [-150, 120],
      baglanti: 'Bolted ring; the arm locks into it',
      detay: 'Yağsız yatak: toz ve vakum yağı yer. Sürtünmesi ölçülür, çünkü mürettebat her hareketinde onu yener.',
      kalite: '5000 tam devir sonrası sürtünme %15\'ten az artar',
    },
    why: 'Basınçlı bir kol kendi ekseninde dönemez; dönmeyi YATAK sağlar. Sürtünme doğrudan yorgunluktur: gün boyu her hareket onun karşısında yapılır.' },

  { id: 'kollar', ad: 'Arm assemblies', sistem: 'basinc', step: 5,
    mountsTo: 'omuz-yatagi', arayuz: 'kilit', massKg: 3.6, qty: 2,
    pos: [0, 0.30, 1.20], size: [0.18, 0.17, 0.76], yon: 'yan', ayna: 'y', sekil: 'kol',
    /* AYNA: bu parça bilerek asimetriktir - beyan edilmezse
       ayna kapısı düşer (validate-astronaut §9). */
    asimetrik: 'Kontrol listesi TEK bilekte: EVA sırasında bakılan yer orasıdır ve ikinci bir kopya ek kütle taşımaktan başka bir şey yapmaz.',
    /* ZARF: beyan edilen `size`ın ÖLÇÜLEN aşımı. */
    zarfOran: 0.8,
    zarfNeden: 'Omuz eklem gövdesi (0,259 m) ve iki yatak bileziği (0,258 / 0,254 m) bu parçanın içindedir ve kol borusunun kesitinden geniştir - bir yatak, içinde döndüğü şeyden dar olamaz. BORÇ: beyan edilen 0,17 m çıplak bir kolun kesitidir, takımın değil.',
    tech: {
      no: 'AS-PRS-050',
      malzeme: 'Ortho-fabric over bladder, elbow convolute, wrist bearing',
      guc_W: 0,
      basinc_kPa: 29.6,
      sicaklik_C: [-150, 120],
      baglanti: 'Omuz yatağına ve bilekte eldiven halkasına kilitli',
      detay: 'Dirsek konvolüt, bilek yataklı. Kol uzunluğu kişiye göre ara halkalarla ayarlanır.',
      kalite: 'Dirsek 15 000 çevrim',
    },
    why: 'İşin tamamı kolla yapılır ve basınçlı bir kolda her bükülme enerji ister. Konvolüt ve yatak, o enerjiyi ödenebilir kılan iki parçadır.' },

  { id: 'eldivenler', ad: 'Gloves', sistem: 'arayuz', step: 5,
    mountsTo: 'kollar', arayuz: 'kilit', massKg: 0.9, qty: 2,
    pos: [0.03, 0.30, 0.71], size: [0.22, 0.17, 0.24], yon: 'yan', ayna: 'y', sekil: 'eldiven',
    tech: {
      no: 'AS-INT-051',
      malzeme: 'RTV silicone fingertips, Vectran palm, heated fingers',
      guc_W: 12,
      basinc_kPa: 29.6,
      sicaklik_C: [-120, 120],
      baglanti: 'Bilek kilit halkası',
      detay: 'Isıtıcı parmak uçları: el, giysinin en hızlı üşüyen yeridir ve üşüyen el iş yapamaz. Avuç içi kavrama için takviyeli.',
      kalite: 'Parmak ucu aşınması her EVA sonrası denetlenir - eldiven, giysinin en sık hasar gören parçasıdır',
    },
    why: 'EVA\'nın en zor parçası eldivendir: basınç altında yumruk yapmak bir el egzersiz aletini sıkmak gibidir. Yorgunluğun ve yaralanmanın çoğu buradan gelir.' },

  /* ADIM 4 — yaşam desteği */
  { id: 'yasam-paketi', ad: 'Portable life support pack', sistem: 'yasam', step: 4,
    mountsTo: 'ust-govde', arayuz: 'civata', massKg: 54.0,
    pos: [-0.25, 0, 1.46], size: [0.22, 0.46, 0.56], yon: 'sirt', sekil: 'paket',
    /* AYNA: bu parça bilerek asimetriktir - beyan edilmezse
       ayna kapısı düşer (validate-astronaut §9). */
    asimetrik: 'Servis vanaları ve doldurma ağızları iki yanda farklıdır: aynı olsalardı eldivenli elle karıştırılabilirlerdi.',
    /* ZARF: beyan edilen `size`ın ÖLÇÜLEN aşımı. */
    zarfOran: 0.2,
    zarfNeden: 'Üst kapak ve askı kayışları kutunun dışındadır.',
    tech: {
      no: 'AS-LIF-040',
      malzeme: 'Composite shell; fan, pump, CO2 bed, sublimator, O2 tanks',
      guc_W: 90,
      basinc_kPa: 29.6,
      sicaklik_C: [-40, 60],
      baglanti: 'Üst gövdeye dört civata; su ve gaz konnektörleri içeriden',
      detay: '8 saat EVA: 0,67 kg O2 tüketilir (1,0 kg taşınır), CO2 yatağı, 5,1 kg yüceltici suyu. Su miktarı uydurulmaz - atılacak ısıdan ve suyun süblimleşme gizli ısısından (2,83 MJ/kg) çıkar; ilk yazışta 3,6 kg yazmıştım ve hesap onu yakaladı. Sırt paketi giysinin kütlesinin yarısıdır ve ağırlık merkezini arkaya alır.',
      kalite: 'Yedek O2 30 dakika - dönüş için gereken süre',
    },
    why: 'Giysi bir kapsüldür ve kapsülü yaşatan şey budur: soluma gazı, CO2 tutucu, ısı atımı ve güç. Sekiz saatlik bir EVA\'nın sınırı bu paketin kapasitesidir.' },

  { id: 'ikincil-o2', ad: 'Secondary oxygen pack', sistem: 'yasam', step: 4,
    mountsTo: 'yasam-paketi', arayuz: 'civata', massKg: 6.2,
    pos: [-0.24, 0, 1.79], size: [0.16, 0.28, 0.13], yon: 'sirt', sekil: 'kutu',
    /* ZARF: beyan edilen `size`ın ÖLÇÜLEN aşımı. */
    zarfOran: 0.35,
    zarfNeden: 'Bağlantı kelepçeleri ve vana tüpün dışında kalır.',
    tech: {
      no: 'AS-LIF-041',
      malzeme: 'Two composite bottles at 41 MPa',
      guc_W: 0,
      basinc_kPa: 29.6,
      sicaklik_C: [-40, 60],
      baglanti: 'Paketin altına civatalı; ayrı regülatör',
      detay: '30 dakika: bir kaçak hâlinde hava kilidine dönmek için gereken süre. Ana sistemden BAĞIMSIZ - ortak bir arıza ikisini birden alamaz.',
      kalite: 'Her EVA öncesi basınç denetimi',
    },
    why: 'Yedek, ana sistemle aynı şeyi paylaşmıyorsa yedektir. Otuz dakika keyfi değil: hava kilidine en uzak çalışma noktasından dönüş süresidir.' },

  /* ADIM 5 — kask ve görüş */
  { id: 'kask', ad: 'Helmet and visor assembly', sistem: 'gorus', step: 5,
    mountsTo: 'ust-govde', arayuz: 'kilit', massKg: 5.8,
    /* KASK YUKARI VE KÜÇÜK. Ekvator boyun halkasının 25 mm üstündeyken
       kaskın en geniş yeri boynun bandına düşüyordu. Küre denklemi:
       halkada genişliğin göğsün %55'inin altına inmesi için merkez en az
       0,585·R kadar yukarıda olmak zorunda; R = 0,182 için bu 1,766 eder ve
       tepe 1,946'da kalır - beyan edilen 1,95'in altında. Kask böylece
       0,42'den 0,36'ya iner: 1,95 m'lik bir figürde kask+LEVA yüksekliğinin
       toplam boya oranı %22'den %18'e düşer, ki gerçek oran odur. */
    pos: [0.02, 0, 1.726], size: [0.34, 0.33, 0.36], yon: 'orta', sekil: 'kask',
    /* AYNA: bu parça bilerek asimetriktir - beyan edilmezse
       ayna kapısı düşer (validate-astronaut §9). */
    asimetrik: 'Mikrofon kolu tek yanda — ağza tek bir mikrofon gider.',
    /* ZARF: beyan edilen `size`ın ÖLÇÜLEN aşımı. */
    zarfOran: 0.15,
    zarfNeden: 'Menteşe braketleri ve vizör kolu kabuğun dışına çıkar.',
    tech: {
      no: 'AS-VIS-060',
      malzeme: 'Polycarbonate bubble, gold-coated EVA visor, anti-fog coating',
      guc_W: 0,
      basinc_kPa: 29.6,
      sicaklik_C: [-150, 120],
      baglanti: 'Boyun kilit halkası',
      detay: 'Altın kaplı dış vizör güneşin morötesini ve ısısını keser; kabarcık kask, başın giysiyi çevirmeden dönmesini sağlar.',
      kalite: 'Vizör çizilmeye karşı her EVA sonrası denetlenir',
    },
    why: 'Kask dönmez - BAŞ döner. Kabarcık biçimi bunun için; düz bir vizör görüş alanını, başı çevirmenin mümkün olmadığı bir giysi içinde kabul edilemez kadar daraltır.' },

  { id: 'basliklar', ad: 'Helmet lights and camera', sistem: 'gorus', step: 5,
    mountsTo: 'kask', arayuz: 'civata', massKg: 1.3,
    /* LAMBALAR KASKLA BİRLİKTE ÇIKAR. Kask 1,745'e taşınırken bunlar
       1,660'ta kaldı ve boyun bandını 0,461 m genişliğinde doldurdular -
       kaska cıvatalanan bir şey kaskın bıraktığı yerde duramaz. */
    pos: [0.03, 0, 1.768], size: [0.20, 0.38, 0.12], yon: 'orta', sekil: 'lamba',
    /* AYNA: bu parça bilerek asimetriktir - beyan edilmezse
       ayna kapısı düşer (validate-astronaut §9). */
    asimetrik: 'Bir yanda kamera, öteki yanda anten. İkisi de iki yana konursa kütle ve gölge iki katına çıkar, kazanç sıfırdır.',
    tech: {
      no: 'AS-VIS-061',
      malzeme: 'Four LED heads, one camera, mounting yoke',
      guc_W: 26,
      basinc_kPa: 0,
      sicaklik_C: [-150, 120],
      baglanti: 'Kask halkasına boyunduruk',
      detay: 'Dört baş: gölge, vakumda MUTLAK siyahtır ve tek kaynak çalışılan yüzeyi kendi eliyle gölgeler. Kamera yer ekibinin gördüğü şeydir.',
      kalite: 'Sekiz saat sürekli, yedek akü kask içinde',
    },
    why: 'Havasız bir dünyada gölgenin içi doldurulmaz; oraya ışık koymazsan hiçbir şey göremezsin. Dört baş, kendi elinin gölgesinde çalışabilmek içindir.' },

  /* ADIM 6 — arayüz ve emniyet */
  { id: 'gogus-paneli', ad: 'Display and control module', sistem: 'arayuz', step: 6,
    mountsTo: 'ust-govde', arayuz: 'civata', massKg: 2.1,
    /* PANEL GÖVDEYE DEĞER. 0,19'da dururken arka yüzü gövdeden 27 mm
       uzaktaydı ve 12 ışının hiçbiri değmiyordu: göğsün üstünde DURAN değil,
       önünde UÇAN bir kutu. Arka yüz artık göğsün eğrisini izliyor (bkz.
       astro-build/panel), konum da onu gövdeye oturtacak kadar geri alındı. */
    pos: [0.163, 0, 1.46], size: [0.13, 0.28, 0.20], yon: 'gogus', sekil: 'panel',
    /* AYNA: bu parça bilerek asimetriktir - beyan edilmezse
       ayna kapısı düşer (validate-astronaut §9). */
    asimetrik: 'Kumanda yerleşimi SAĞ el içindir; aynalanmış bir panel kullanılamaz, çünkü kolun ulaştığı yer aynalanmıyor.',
    tech: {
      no: 'AS-INT-070',
      malzeme: 'Mechanical switches, sunlight-readable display, mirrored text',
      guc_W: 8,
      basinc_kPa: 0,
      sicaklik_C: [-120, 120],
      baglanti: 'Göğüse civatalı; paketle kablolu',
      detay: 'Anahtarlar eldivenle çevrilecek kadar büyük ve birbirinden ayırt edilecek kadar farklı. Yazı AYNALIDIR: mürettebat onu bilek aynasından okur, çünkü göğsüne bakamaz.',
      kalite: 'Her anahtar eldivenli elle tek başına çevrilebilir',
    },
    why: 'Kaskın içinden kendi göğsünü göremezsin. Panel bu yüzden aynalı yazılıdır ve bilekteki ayna ile okunur - giysi tasarımının en çok anlatılan ayrıntısı budur.' },

  { id: 'emniyet-halati', ad: 'Safety tether and tool caddy', sistem: 'arayuz', step: 6,
    mountsTo: 'ust-govde', arayuz: 'civata', massKg: 2.8,
    pos: [0.13, 0.17, 1.16], size: [0.11, 0.22, 0.16], yon: 'gogus', sekil: 'halat',
    /* AYNA: bu parça bilerek asimetriktir - beyan edilmezse
       ayna kapısı düşer (validate-astronaut §9). */
    asimetrik: 'Tek halat, tek yanda. İkinci bir halat emniyet değil, dolaşacak ikinci bir ip demektir.',
    /* ZARF: beyan edilen `size`ın ÖLÇÜLEN aşımı. */
    zarfOran: 0.25,
    zarfNeden: 'Makara ve kanca halatın kesitinden büyüktür.',
    tech: {
      no: 'AS-INT-071',
      malzeme: 'Retracting steel tether, carabiners, tool loops',
      guc_W: 0,
      basinc_kPa: 0,
      sicaklik_C: [-150, 120],
      baglanti: 'Göğüs bağlantı noktalarına kancalı',
      detay: 'Her alet bağlanır. Yüzeyde bırakılan bir alet kaybolmaz ama düşen bir alet giysiyi yırtabilir ve elden çıkan her şey iki kişilik işe dönüşür.',
      kalite: 'Halat 2 kN kopma yükü',
    },
    why: 'Bağlanmamış alet, tek başına EVA\'yı bitiren şeydir. Yüzeyde bile: eğilip bir şey almak, sırt paketi takılıyken en pahalı hareketlerden biridir.' },
]);

/* ── sorgular ─────────────────────────────────────────────────────────── */
const say = (p) => p.qty ?? 1;
export const partMass = (p) => say(p) * p.massKg;
export function partById(id) { return PARTS.find((p) => p.id === id) || null; }

/** Giysinin toplam kütlesi (kg). */
export function suitMass() {
  return PARTS.reduce((s, p) => s + partMass(p), 0);
}

/** Güç bütçesi: paket üretmez, taşır — her şey aküden gelir. */
export function powerBudget() {
  const kalemler = PARTS.filter((p) => (p.tech?.guc_W ?? 0) > 0)
    .map((p) => ({ id: p.id, W: p.tech.guc_W * say(p) }));
  const toplamW = kalemler.reduce((s, k) => s + k.W, 0);
  /* Paketin aküsü: 8 saatlik EVA'yı taşımak zorunda. */
  const sureH = 8;
  return { kalemler, toplamW, sureH, enerjiWh: toplamW * sureH };
}

/**
 * Tüketim bütçesi: sekiz saatlik bir EVA'da ne gider.
 * Metabolik hız çalışma yüküne bağlıdır ve o hız hem oksijeni hem ısıyı
 * belirler — ikisi aynı sayıdan çıkar, ayrı ayrı uydurulmaz.
 */
export function evaBudget({ sureH = 8, metabolikW = 350 } = {}) {
  /* Oksijen: ~0,084 kg/saat, 350 W metabolik hızda (RQ 0,87). */
  const o2KgH = metabolikW / 350 * 0.084;
  /* CO2: solunan O2'nin kütlece ~1,2 katı. */
  const co2KgH = o2KgH * 1.2;
  /* Yüceltici suyu, GİZLİ ISIDAN türetilir, uydurulmuş bir katsayıdan
     değil: su vakumda süblimleşirken kg başına 2,83 MJ taşır, yani atılan
     her kWh (3,6 MJ) için 3,6/2,83 = 1,27 kg su gider. İlk yazışımda 0,45
     yazmıştım ve bu, sekiz saatlik bir EVA'nın su ihtiyacını üçte birine
     indiriyordu — sayı hesaplanınca paketin kendi beyanıyla çelişti ve
     çelişki yakalandı. */
  const SUBLIM_MJ_KG = 2.83;
  const isiW = metabolikW + PARTS.reduce((s, p) => s + (p.tech?.guc_W ?? 0) * say(p), 0);
  const suKgH = (isiW * 3.6e-3) / SUBLIM_MJ_KG;
  return {
    sureH, metabolikW, isiW,
    o2Kg: o2KgH * sureH, co2Kg: co2KgH * sureH, suKg: suKgH * sureH,
    o2KgH, co2KgH, suKgH, sublimMJkg: SUBLIM_MJ_KG,
  };
}

/** Bağlantı zinciri: bir parçadan köke. */
export function mountChain(id) {
  const zincir = [];
  let p = partById(id);
  let g = 0;
  while (p && g++ < 12) { zincir.push(p); p = p.mountsTo ? partById(p.mountsTo) : null; }
  return zincir;
}

export function describe() {
  const e = evaBudget();
  return {
    parca: PARTS.length,
    adet: PARTS.reduce((s, p) => s + say(p), 0),
    kutleKg: +suitMass().toFixed(1),
    boyM: BOY_M, omuzM: OMUZ_M, basincKPa: BASINC_KPA,
    gucW: powerBudget().toplamW,
    o2Kg: +e.o2Kg.toFixed(2), suKg: +e.suKg.toFixed(2),
  };
}
