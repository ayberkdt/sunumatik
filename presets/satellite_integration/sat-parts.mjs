/* sat-parts.mjs — UYDU PARÇA KATALOĞU ve ENTEGRASYON AĞACI
 * (three'siz, DOM'suz, saf).
 *
 * Bu dosya bir uydunun neye benzediğini değil, NASIL KURULDUĞUNU anlatır.
 * Patlatılmış görünüm bir süs değildir: her parçanın nereye cıvatalandığı,
 * hangi arayüzle bağlandığı, montaj sırasında kaçıncı adımda geldiği ve
 * ne kadar kütle getirdiği yazılıdır. Bunlar ölçülebilir iddialardır ve
 * `scripts/validate-satellite.mjs` hepsini sınar:
 *
 *   · kütle bütçesi TOPLANIR ve ilan edilen kuru kütleye eşit çıkar,
 *   · her parçanın bağlandığı arayüz GERÇEKTEN vardır (ağaç kapalıdır),
 *   · montaj sırası bağımlılıkları çiğnemez (ebeveyn önce gelir),
 *   · kütle merkezi ayırma halkası ekseninden ilan edilen paydan sapmaz.
 *
 * Birim: metre ve kilogram. Konumlar gövde koordinatında (+Z fırlatma
 * ekseni yukarı, +X güneş kanatları ekseni, +Y radyatör ekseni).
 *
 * Sınıf: ~1250 kg fırlatma kütleli, kimyasal itkili, üç eksen dengeli
 * bir haberleşme/gözlem otobüsü. Sayılar bu sınıfın tipik büyüklükleridir
 * ve BİR TASARIM ÖRNEĞİDİR; belirli bir uydunun veri sayfası değildir.
 */

/** Alt sistemler — panelde renk ve süzgeç bunlardan gelir. */
export const SUBSYSTEMS = Object.freeze({
  yapi: { ad: 'Yapı', renk: '#9aa0aa', neden: 'Fırlatma yüklerini taşır ve her şeyin bağlandığı referansı verir.' },
  itki: { ad: 'İtki', renk: '#c98a5c', neden: 'Yörünge yükseltme ve istasyon tutma; kütlenin yarısı burada.' },
  guc: { ad: 'Güç', renk: '#e0b25a', neden: 'Güneşten enerji, gölgede batarya, dağıtım ve koruma.' },
  adcs: { ad: 'Yönelim (ADCS)', renk: '#7fb0c9', neden: 'Nereye baktığını bilmek ve oraya çevirmek.' },
  haberlesme: { ad: 'Haberleşme', renk: '#b4a8c9', neden: 'Veriyi yere indirmek ve komut almak.' },
  isil: { ad: 'Isıl', renk: '#8fa2b4', neden: 'Her kutuyu çalışma sıcaklığında tutmak; uzayda tek yol ışımadır.' },
  faydali: { ad: 'Faydalı yük', neden: 'Uydunun VAR OLMA nedeni; gerisi onu hayatta tutar.', renk: '#9ec98a' },
  kablaj: { ad: 'Kablaj', renk: '#6f7688', neden: 'Kutuları birbirine bağlar; kütlesi küçümsenir ama %3-4 eder.' },
});

/** Arayüz türleri — "nasıl bağlı" sorusunun cevabı. */
export const INTERFACES = Object.freeze({
  civata: 'Cıvatalı arayüz (tork değerli, gömlekli)',
  kizak: 'Kızak/ray arayüzü (panel seviyesinde kayar, sonra kilitlenir)',
  ayirma: 'Ayırma arayüzü (kelepçe bandı ya da piroteknik; fırlatıcıya bakan tek yüzey)',
  akiskan: 'Akışkan arayüzü (kaynaklı boru, kesme valfi)',
  isil: 'Isıl arayüz (macun/gaz aralığı, ısı borusu gömme)',
  elektrik: 'Elektrik arayüzü (konnektör, kablaj demeti)',
  menteşe: 'Menteşe + kilit (fırlatmada katlı, yörüngede açılır)',
});

/* ── PARÇALAR ─────────────────────────────────────────────────────────
   step: montaj adımı (AIT akışı). Aynı adımdaki parçalar birlikte gelir.
   mountsTo: bağlandığı parçanın kimliği (kök = null).
   axis: patlatmada AYRILMA doğrultusu — montaj doğrultusunun tersidir.
   pos: gövde koordinatında parça merkezi [x, y, z] (m).
   size: kaba gabari [x, y, z] (m) — çizim ve kütle merkezi için.
*/
export const PARTS = Object.freeze([
  /* ADIM 1 — birincil yapı */
  { id: 'ayirma-halkasi', ad: 'Ayırma halkası (937 mm)', sistem: 'yapi', step: 1,
    mountsTo: null, arayuz: 'ayirma', massKg: 24, pos: [0, 0, -1.12], size: [0.94, 0.94, 0.09], sekil: 'halka',
    why: 'Fırlatıcıya bakan TEK yapısal yüzey. Kelepçe bandı burada açılır; uydunun bütün yükü bu çemberden geçer.' },
  { id: 'itki-tupu', ad: 'İtki tüpü (merkez silindir)', sistem: 'yapi', step: 1,
    mountsTo: 'ayirma-halkasi', arayuz: 'civata', massKg: 62, pos: [0, 0, -0.1], size: [0.86, 0.86, 1.96], sekil: 'silindir',
    why: 'Fırlatma yükünü ayırma halkasına indiren ana yol. Tank içine oturur; bütün paneller ona asılır.' },
  { id: 'alt-panel', ad: 'Alt panel (itki güvertesi)', sistem: 'yapi', step: 1,
    mountsTo: 'itki-tupu', arayuz: 'civata', massKg: 31, pos: [0, 0, -1.04], size: [1.72, 1.72, 0.03], sekil: 'panel',
    why: 'Apogee motoru ve iticiler buraya bakar; egzoz yönü uydudan uzağa.' },

  /* ADIM 2 — itki: yapı kapanmadan ÖNCE girer */
  { id: 'yakit-tanki', ad: 'İtici tankı (MMH/NTO)', sistem: 'itki', step: 2,
    mountsTo: 'itki-tupu', arayuz: 'civata', massKg: 46, pos: [0, 0, -0.05], size: [0.74, 0.74, 1.3], sekil: 'tank',
    why: 'Tüpün İÇİNE girer, çünkü sonra paneller kapanır ve bir daha yeri kalmaz. Kütle merkezine yakın olmalı: yakıt bittikçe merkez fazla kaymasın.' },
  { id: 'itici-yakit', ad: 'İtici (yakıt yükü)', sistem: 'itki', step: 2,
    mountsTo: 'yakit-tanki', arayuz: 'akiskan', massKg: 415, pos: [0, 0, -0.1], size: [0.7, 0.7, 1.15], sekil: 'gizli',
    why: 'Fırlatma kütlesinin üçte biri. Kuru kütleye DAHİL DEĞİLDİR; bütçede ayrı satırdır.' },
  { id: 'basinc-tanki', ad: 'Basınçlandırma tankı (He)', sistem: 'itki', step: 2,
    mountsTo: 'itki-tupu', arayuz: 'civata', massKg: 14, pos: [0.0, 0.0, 0.72], size: [0.42, 0.42, 0.42], sekil: 'kure',
    why: 'Tank basıncını sabit tutar; yakıt aktıkça helyum yerini alır.' },
  { id: 'apogee-motoru', ad: 'Apogee motoru (490 N)', sistem: 'itki', step: 2,
    mountsTo: 'alt-panel', arayuz: 'civata', massKg: 11, pos: [0, 0, -1.28], size: [0.3, 0.3, 0.45], sekil: 'nozul',
    why: 'Transfer yörüngesinden hedef yörüngeye çıkaran tek büyük yakış. Ekseni kütle merkezinden geçmeli, yoksa her yakışta dönme momenti doğar.' },
  { id: 'iticiler', ad: 'İticiler (4 × 10 N)', sistem: 'itki', step: 2, qty: 4,
    mountsTo: 'alt-panel', arayuz: 'civata', massKg: 1.2, pos: [0.72, 0.72, -1.16], size: [0.1, 0.1, 0.22], sekil: 'nozul',
    why: 'İstasyon tutma ve momentum boşaltma. Köşelerde çünkü kolu büyük olsun.' },
  { id: 'besleme-hatlari', ad: 'Besleme hatları ve valfler', sistem: 'itki', step: 2,
    mountsTo: 'yakit-tanki', arayuz: 'akiskan', massKg: 9, pos: [0, 0, -0.6], size: [0.8, 0.8, 0.5], sekil: 'boru',
    why: 'Kaynaklı; sızdırmazlık testi bu adımda yapılır, panel kapandıktan sonra erişilemez.' },

  /* ADIM 3 — yan paneller (ekipman panele ÖNCEDEN entegre edilir) */
  { id: 'yan-panel-xp', ad: 'Yan panel +X', sistem: 'yapi', step: 3,
    mountsTo: 'itki-tupu', arayuz: 'kizak', massKg: 18, pos: [0.86, 0, -0.1], size: [0.03, 1.72, 1.9], sekil: 'panel',
    why: 'Panel seviyesinde entegrasyon: kutular tezgâhta panele takılır, test edilir, sonra uyduya kayar. Uydunun içinde çalışmak pahalıdır.' },
  { id: 'yan-panel-xn', ad: 'Yan panel −X', sistem: 'yapi', step: 3,
    mountsTo: 'itki-tupu', arayuz: 'kizak', massKg: 18, pos: [-0.86, 0, -0.1], size: [0.03, 1.72, 1.9], sekil: 'panel',
    why: 'Karşı panel; kanat ve SADA yükünü taşır.' },
  { id: 'radyator-yp', ad: 'Radyatör paneli +Y', sistem: 'isil', step: 3,
    mountsTo: 'itki-tupu', arayuz: 'kizak', massKg: 22, pos: [0, 0.86, -0.1], size: [1.72, 0.03, 1.9], sekil: 'panel',
    why: 'Uzayda soğutmanın tek yolu ışımadır. ±Y seçilir çünkü Güneş +X ekseninde döner; bu yüzeyler Güneş görmez.' },
  { id: 'radyator-yn', ad: 'Radyatör paneli −Y', sistem: 'isil', step: 3,
    mountsTo: 'itki-tupu', arayuz: 'kizak', massKg: 22, pos: [0, -0.86, -0.1], size: [1.72, 0.03, 1.9], sekil: 'panel',
    why: 'Çift radyatör: ısı yükü iki yüze bölünür ve biri Güneş görse bile diğeri çalışır.' },

  /* ADIM 4 — panel üstü ekipman */
  { id: 'batarya', ad: 'Batarya paketi (Li-ion)', sistem: 'guc', step: 4,
    mountsTo: 'radyator-yn', arayuz: 'isil', massKg: 38, pos: [0.3, -0.72, -0.45], size: [0.44, 0.2, 0.34], sekil: 'kutu',
    why: 'Gölgede tek kaynak. Radyatör panelinde çünkü sıcaklığı dar bir bantta tutulmalı; ısıl arayüz macunla kurulur.' },
  { id: 'pcdu', ad: 'Güç dağıtım ünitesi (PCDU)', sistem: 'guc', step: 4,
    mountsTo: 'radyator-yp', arayuz: 'civata', massKg: 21, pos: [-0.3, 0.72, -0.45], size: [0.4, 0.2, 0.3], sekil: 'kutu',
    why: 'Kanatlardan geleni düzenler, bataryayı şarj eder, her yükü ayrı korur. Tek arıza noktası olmasın diye kablajı ikiz.' },
  { id: 'tepki-tekerlekleri', ad: 'Tepki tekerlekleri (4, piramit)', sistem: 'adcs', step: 4, qty: 4,
    mountsTo: 'alt-panel', arayuz: 'civata', massKg: 7.5, pos: [0.45, 0.45, -0.85], size: [0.26, 0.26, 0.16], sekil: 'tekerlek',
    why: 'Dördü PİRAMİT dizilir: üçü yeter, dördüncüsü yedektir ve herhangi biri bozulsa üç eksen hâlâ kapanır.' },
  { id: 'yildiz-izleyici', ad: 'Yıldız izleyici (2)', sistem: 'adcs', step: 4, qty: 2,
    mountsTo: 'yan-panel-xn', arayuz: 'civata', massKg: 5.5, pos: [-0.92, 0.3, 0.55], size: [0.18, 0.18, 0.34], sekil: 'bafil',
    why: 'Mutlak yönelimi yıldız alanından okur. İkisi farklı yöne bakar ki Güneş ya da Dünya birini kör ettiğinde diğeri görsün; bafıl kaçak ışığı keser.' },
  { id: 'imu', ad: 'Eylemsizlik ölçüm birimi', sistem: 'adcs', step: 4,
    mountsTo: 'itki-tupu', arayuz: 'civata', massKg: 4.2, pos: [0.25, 0.25, 0.1], size: [0.2, 0.2, 0.16], sekil: 'kutu',
    why: 'Yıldız izleyici arasında dönme hızını taşır. Yapının EN RİJİT yerine konur: esneme doğrudan ölçüm hatasıdır.' },
  { id: 'manyetik-cubuk', ad: 'Manyetik çubuklar (3)', sistem: 'adcs', step: 4, qty: 3,
    mountsTo: 'yan-panel-xp', arayuz: 'civata', massKg: 2.4, pos: [0.9, -0.4, 0.2], size: [0.06, 0.06, 0.5], sekil: 'cubuk',
    why: 'Tekerleklerin biriktirdiği momentumu Dünya manyetik alanına iterek boşaltır — yakıt harcamadan.' },
  { id: 'transponder', ad: 'Transponder ve TWTA', sistem: 'haberlesme', step: 4,
    mountsTo: 'radyator-yp', arayuz: 'isil', massKg: 16, pos: [0.3, 0.72, 0.3], size: [0.36, 0.2, 0.34], sekil: 'kutu',
    why: 'Verici tüpü ısı üretir; doğrudan radyatöre oturur. Isıl arayüz olmadan kendi ısısında boğulur.' },

  /* ADIM 5 — üst güverte ve faydalı yük */
  { id: 'ust-panel', ad: 'Üst panel (faydalı yük güvertesi)', sistem: 'yapi', step: 5,
    mountsTo: 'itki-tupu', arayuz: 'civata', massKg: 26, pos: [0, 0, 0.86], size: [1.72, 1.72, 0.03], sekil: 'panel',
    why: 'En son kapanan yapısal yüzey; altındaki her şeye erişim bu panel açıkken yapılır.' },
  { id: 'faydali-yuk', ad: 'Faydalı yük (optik gövde)', sistem: 'faydali', step: 5,
    mountsTo: 'ust-panel', arayuz: 'civata', massKg: 96, pos: [0, 0, 1.28], size: [0.7, 0.7, 0.8], sekil: 'silindir',
    why: 'Uydunun var olma nedeni. Üstte çünkü bakış yönü serbest kalmalı; yapıya üç noktadan izostatik bağlanır ki panel esnemesi optiği bozmasın.' },
  { id: 'faydali-elektronik', ad: 'Faydalı yük elektroniği', sistem: 'faydali', step: 5,
    mountsTo: 'ust-panel', arayuz: 'civata', massKg: 18, pos: [-0.45, 0.35, 0.98], size: [0.34, 0.26, 0.2], sekil: 'kutu',
    why: 'Algılayıcıdan gelen veriyi işler; kısa kablo için algılayıcının hemen yanında.' },

  /* ADIM 6 — ısıl kapanış */
  { id: 'isi-borulari', ad: 'Isı boruları', sistem: 'isil', step: 6,
    mountsTo: 'radyator-yp', arayuz: 'isil', massKg: 8, pos: [0, 0.8, -0.1], size: [1.6, 0.04, 1.7], sekil: 'boru',
    why: 'Isıyı kutudan radyatöre TAŞIR. Pasiftir: içindeki akışkan buharlaşıp yoğuşur, pompa yoktur, bozulacak parçası yoktur.' },
  { id: 'mli', ad: 'MLI battaniyeleri', sistem: 'isil', step: 6,
    mountsTo: 'itki-tupu', arayuz: 'civata', massKg: 17, pos: [0, 0, -0.1], size: [1.8, 1.8, 2.0], sekil: 'kabuk',
    why: 'Yirmi kat metalize film; ışımayı keser. EN SON takılır çünkü altındaki her cıvataya erişim biter.' },
  { id: 'kablaj', ad: 'Kablaj demeti', sistem: 'kablaj', step: 6,
    mountsTo: 'itki-tupu', arayuz: 'elektrik', massKg: 34, pos: [0, 0, -0.2], size: [1.5, 1.5, 1.6], sekil: 'gizli',
    why: 'Kütlenin %3-4\'ü. Tek tek küçük, toplamı bir insan ağırlığı; bütçede unutulduğunda kuru kütle tutmaz.' },

  /* ADIM 7 — açılır elemanlar (fırlatmada katlı) */
  { id: 'sada-xp', ad: 'SADA tamburu +X', sistem: 'guc', step: 7,
    mountsTo: 'yan-panel-xp', arayuz: 'civata', massKg: 9, pos: [1.0, 0, 0.35], size: [0.22, 0.22, 0.24], sekil: 'silindir',
    why: 'Kanadı Güneş\'e dik tutan döner eklem; gücü ve veriyi kayar halkadan geçirir.' },
  { id: 'sada-xn', ad: 'SADA tamburu −X', sistem: 'guc', step: 7,
    mountsTo: 'yan-panel-xn', arayuz: 'civata', massKg: 9, pos: [-1.0, 0, 0.35], size: [0.22, 0.22, 0.24], sekil: 'silindir',
    why: 'Simetrik kanat; iki kanat birlikte döner ki uydu dengede kalsın.' },
  { id: 'kanat-xp', ad: 'Güneş kanadı +X (3 panel)', sistem: 'guc', step: 7,
    mountsTo: 'sada-xp', arayuz: 'menteşe', massKg: 31, pos: [3.0, 0, 0.35], size: [3.6, 1.5, 0.03], sekil: 'kanat',
    why: 'Fırlatmada gövdeye katlı durur, yörüngede yanan tel serbest bırakır ve yay açar. Açılmazsa uydu birkaç saat içinde biter.' },
  { id: 'kanat-xn', ad: 'Güneş kanadı −X (3 panel)', sistem: 'guc', step: 7,
    mountsTo: 'sada-xn', arayuz: 'menteşe', massKg: 31, pos: [-3.0, 0, 0.35], size: [3.6, 1.5, 0.03], sekil: 'kanat',
    why: 'İkinci kanat; tek kanat açılırsa hem güç yarıya iner hem de güneş basıncı sürekli bir tork üretir.' },
  { id: 'hga-boom', ad: 'HGA kolu (boom)', sistem: 'haberlesme', step: 7,
    mountsTo: 'ust-panel', arayuz: 'menteşe', massKg: 6, pos: [0.55, -0.55, 1.1], size: [0.08, 0.08, 0.7], sekil: 'cubuk',
    why: 'Çanağı gövdeden uzaklaştırır: hem gövde huzmeyi kesmesin hem de çanak serbest dönsün.' },
  { id: 'hga', ad: 'Yüksek kazançlı anten (1,2 m)', sistem: 'haberlesme', step: 7,
    mountsTo: 'hga-boom', arayuz: 'menteşe', massKg: 13, pos: [0.85, -0.85, 1.5], size: [1.2, 1.2, 0.3], sekil: 'canak',
    why: 'Dar huzme, yüksek veri hızı — ama Dünya\'yı sürekli izlemek zorunda; iki eksenli gimbal bu yüzden var.' },
  { id: 'lga', ad: 'Düşük kazançlı antenler (2)', sistem: 'haberlesme', step: 7, qty: 2,
    mountsTo: 'yan-panel-xp', arayuz: 'civata', massKg: 1.1, pos: [0.9, 0.5, 0.75], size: [0.08, 0.08, 0.26], sekil: 'cubuk',
    why: 'Geniş huzme, düşük hız. Uydu kontrolü kaybedip savrulduğunda komut alabilmenin TEK yolu; bu yüzden ikisi zıt yönlere bakar.' },
]);

/* ── ENTEGRASYON AKIŞI ───────────────────────────────────────────────── */
export const STEPS = Object.freeze([
  { no: 1, ad: 'Birincil yapı', aciklama: 'Ayırma halkası, itki tüpü ve alt panel birleşir. Bundan sonrası hep bu referansa göre ölçülür.' },
  { no: 2, ad: 'İtki sistemi', aciklama: 'Tank tüpün içine iner, hatlar kaynaklanır, sızdırmazlık test edilir. Paneller kapanınca buraya bir daha girilemez.' },
  { no: 3, ad: 'Yan paneller', aciklama: 'Paneller tezgâhta ekipmanıyla birlikte hazırlanır, test edilir, sonra uyduya kayar. Uydunun içinde çalışmak pahalıdır.' },
  { no: 4, ad: 'Panel üstü ekipman', aciklama: 'Batarya, PCDU, tekerlekler, izleyiciler, transponder. Isı üretenler radyatör paneline oturur.' },
  { no: 5, ad: 'Üst güverte ve faydalı yük', aciklama: 'Faydalı yük izostatik üç noktadan bağlanır; üst panel kapanır.' },
  { no: 6, ad: 'Isıl kapanış ve kablaj', aciklama: 'Isı boruları, kablaj demeti ve en son MLI. MLI takıldıktan sonra altındaki cıvatalara erişim biter.' },
  { no: 7, ad: 'Açılır elemanlar', aciklama: 'Kanatlar, SADA, HGA kolu ve antenler katlı hâlde takılır; yörüngede açılır.' },
]);

/* ── SORGULAR (saf) ──────────────────────────────────────────────────── */

const say = p => p.qty ?? 1;

/** Parçanın toplam kütlesi (adet × birim). */
export const partMass = p => say(p) * p.massKg;

/** Kimliğe göre parça. */
export function partById(id) { return PARTS.find(p => p.id === id) || null; }

/**
 * Kütle bütçesi. Kuru kütle itici YAKITI hariçtir — bu ayrım bütçenin
 * en sık karıştırılan yeridir ve burada ayrı satırdır.
 */
export function massBudget() {
  const sistem = {};
  let kuru = 0, itici = 0;
  for (const p of PARTS) {
    const m = partMass(p);
    if (p.id === 'itici-yakit') { itici += m; continue; }
    kuru += m;
    sistem[p.sistem] = (sistem[p.sistem] || 0) + m;
  }
  const siralı = Object.entries(sistem)
    .map(([k, v]) => ({ sistem: k, ad: SUBSYSTEMS[k].ad, kg: Number(v.toFixed(1)), pay: v / kuru }))
    .sort((a, b) => b.kg - a.kg);
  return {
    kuruKg: Number(kuru.toFixed(1)),
    iticiKg: Number(itici.toFixed(1)),
    firlatmaKg: Number((kuru + itici).toFixed(1)),
    sistemler: siralı,
    parcaSayisi: PARTS.reduce((s, p) => s + say(p), 0),
  };
}

/**
 * Kütle merkezi (gövde koordinatı, metre). Ayırma halkası ekseni x=y=0'dır;
 * merkez bu eksenden kayarsa apogee yakışı uyduyu döndürür.
 */
export function centerOfMass({ yakitli = true } = {}) {
  let M = 0, x = 0, y = 0, z = 0;
  for (const p of PARTS) {
    if (!yakitli && p.id === 'itici-yakit') continue;
    const m = partMass(p);
    M += m; x += m * p.pos[0]; y += m * p.pos[1]; z += m * p.pos[2];
  }
  return { x: x / M, y: y / M, z: z / M, kg: Number(M.toFixed(1)) };
}

/** Montaj ağacı: her parçanın çocukları. */
export function tree() {
  const cocuk = new Map();
  for (const p of PARTS) {
    const k = p.mountsTo;
    if (!cocuk.has(k)) cocuk.set(k, []);
    cocuk.get(k).push(p);
  }
  return cocuk;
}

/** Bir parçanın köke kadar bağlanma zinciri — "bu neyin üstünde duruyor". */
export function mountChain(id) {
  const zincir = [];
  let p = partById(id);
  while (p) { zincir.push(p); p = p.mountsTo ? partById(p.mountsTo) : null; }
  return zincir;
}

/** Montaj derinliği: patlatmada ne kadar uzağa gideceğini belirler. */
export function depth(id) { return mountChain(id).length - 1; }

/** Adım adım entegrasyon listesi. */
export function integrationOrder() {
  return STEPS.map(s => ({ ...s, parcalar: PARTS.filter(p => p.step === s.no) }));
}

/** Manifest ve altyazı için özet. */
export function describe() {
  const b = massBudget();
  const c = centerOfMass();
  const ck = centerOfMass({ yakitli: false });
  return {
    parca: PARTS.length, adet: b.parcaSayisi, adim: STEPS.length,
    kuruKg: b.kuruKg, iticiKg: b.iticiKg, firlatmaKg: b.firlatmaKg,
    kutleMerkeziYakitli: [c.x, c.y, c.z].map(v => Number(v.toFixed(3))),
    kutleMerkeziKuru: [ck.x, ck.y, ck.z].map(v => Number(v.toFixed(3))),
    eksendenSapmaMm: Number((Math.hypot(c.x, c.y) * 1000).toFixed(1)),
  };
}
