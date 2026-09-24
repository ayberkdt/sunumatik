/* hab-parts.mjs — HABİTAT BİLEŞEN KATALOĞU (three'siz, DOM'suz, saf).
 * docs/habitat-blocks-plan.md §3, §4, §6.
 *
 * Katalog `satellite_integration/sat-parts.mjs` ile AYNI biçimdedir; bu
 * bir tesadüf değil, sözleşmedir (exploded-view-plan §3): aynı alanları
 * beyan eden her cisim aynı patlatma, aynı bütçe ve aynı denetimden
 * geçer. Bir üs ile bir uydu arasındaki fark katalogda kalır.
 *
 * Birim: metre, kilogram. Konum saha koordinatında (+Z yukarı, +X doğu).
 * Ortam: 'mars' (varsayılan) ya da 'moon' — ortama uymayan bileşen
 * `envAllows` ile reddedilir ve gerekçesi yazılır.
 *
 * Örnek üs: dört mürettebatlı, ~90 gün özerk bir Mars yüzey üssü.
 * Sayılar bu sınıfın tipik büyüklükleridir; belirli bir görevin veri
 * sayfası DEĞİLDİR.
 */

export const HAB_ENV = Object.freeze({
  mars: { ad: 'Mars', gravity: 3.72, pressure: 610, atmosfer: true, ruzgar: true,
    toz: 'kızıl, elektrostatik değil ama yapışkan', gun: 88775 },
  moon: { ad: 'Ay', gravity: 1.62, pressure: 0, atmosfer: false, ruzgar: false,
    toz: 'keskin, elektrostatik yüklü — conta ve yatak düşmanı', gun: 2551443 },
});

export const SUBSYSTEMS = Object.freeze({
  basincli: { ad: 'Basınçlı hacim', renk: '#d8d4cc', neden: 'İnsanın yaşadığı yer; her şey onu ayakta tutmak için var.' },
  gecis: { ad: 'Geçiş ve kilit', renk: '#c9a35c', neden: 'Dışarı çıkmak ve içeri girmek, havayı kaybetmeden.' },
  yapi: { ad: 'Yapı ve temel', renk: '#9aa0aa', neden: 'Basınç kuvvetini ve kendi ağırlığını regolite aktarır.' },
  guc: { ad: 'Güç', renk: '#e0b25a', neden: 'Gündüz güneş, gece batarya, sürekli fisyon.' },
  isil: { ad: 'Isıl', renk: '#8fa2b4', neden: 'Isı ancak ışımayla atılır; radyatör bir konfor değil, zorunluluk.' },
  isru: { ad: 'ISRU ve tank', renk: '#9ec98a', neden: 'Yerinde üretim: taşınmayan her kilogram kazançtır.' },
  hat: { ad: 'Hatlar', renk: '#7fb0c9', neden: 'Modülleri birbirine bağlayan akışkan, güç ve veri yolları.' },
  iletisim: { ad: 'İletişim', renk: '#b4a8c9', neden: 'Dünya ile bağ; yükseklik = ufuk mesafesi.' },
});

export const INTERFACES = Object.freeze({
  basincli: 'Basınçlı geçiş (conta + kelepçe, hava sızdırmaz)',
  civata: 'Cıvatalı arayüz (tork değerli)',
  ayirma: 'Zemin ankrajı (regolit vidası / plaka)',
  akiskan: 'Akışkan arayüzü (kuru bağlantı, kesme valfi)',
  elektrik: 'Elektrik arayüzü (konnektör, kablo tavası)',
  mentese: 'Menteşe + kilit',
  kaynak: 'Kaynaklı/dikişli birleşim (sökülmez)',
});

/** Akışkan renk bandı standardı (plan §4.6) — bant BİLGİDİR, vurgu değil.
 * `yogunluk` hattın taşıdığı akışkanın çalışma yoğunluğudur (kg/m³) ve
 * boru birim kütlesine girer: gaz hattı ile kriyojenik hat aynı boruyla
 * aynı açıklığı geçemez. */
export const FLUID_BANDS = Object.freeze({
  O2: { ad: 'Oksijen (gaz)', renk: '#5aa86a', yogunluk: 26, hal: 'gaz, ~2 MPa' },
  LOX: { ad: 'Sıvı oksijen', renk: '#3f8f57', yogunluk: 1141, hal: 'kriyojenik sıvı' },
  N2: { ad: 'Azot (gaz)', renk: '#c9b45a', yogunluk: 23, hal: 'gaz, ~2 MPa' },
  H2O: { ad: 'Su', renk: '#5a8fc9', yogunluk: 1000, hal: 'sıvı' },
  CO2: { ad: 'Karbondioksit', renk: '#8a8f96', yogunluk: 40, hal: 'gaz, sıkıştırılmış' },
  CH4: { ad: 'Metan / yakıt', renk: '#c95a5a', yogunluk: 423, hal: 'kriyojenik sıvı' },
  NH3: { ad: 'Soğutucu (amonyak)', renk: '#d68a4a', yogunluk: 610, hal: 'iki fazlı' },
  DC: { ad: 'Güç (DC)', renk: '#2a2a2a', yogunluk: 0, hal: 'iletken — akışkan yok' },
  DATA: { ad: 'Veri', renk: '#7f90a8', yogunluk: 0, hal: 'fiber — akışkan yok' },
});

/* Ortam kuralı: hangi bileşen nerede GERÇEK. */
const ENV_RULE = {
  'ruzgar-olcer': { gerek: e => e.ruzgar, neden: 'Rüzgâr ölçer atmosfer ister; Ay\'da ölçülecek rüzgâr yoktur.',
    oneri: 'Ay\'da yerine toz birikim sensörü ve mikrometeorit sayacı konur.' },
  'moxie': { gerek: e => e.atmosfer && e.pressure > 100, neden: 'MOXIE atmosferdeki CO₂\'yi ayrıştırır; Ay\'da hammadde yok.',
    oneri: 'Ay\'da oksijen regolit ilmenitinden ya da kutup buzundan çıkarılır.' },
  'toz-firca': { gerek: () => true, neden: '', oneri: '' },
};

/* ── BİLEŞENLER ───────────────────────────────────────────────────────
   Alan adları sat-parts ile birebir aynı: mountsTo, arayuz, step, massKg,
   pos, size, why — böylece assemblyFromCatalog hiçbir değişiklik
   istemeden çalışır.
   ports: hat yönlendirmenin bağlanacağı noktalar (plan §4.1).
*/
export const PARTS = Object.freeze([
  /* ADIM 1 — zemin hazırlığı ve temel */
  { id: 'platform', ad: 'Sıkıştırılmış platform', sistem: 'yapi', step: 1, mountsTo: null, arayuz: 'ayirma',
    massKg: 0, pos: [0, 0, -0.08], size: [26, 20, 0.16], sekil: 'platform',
    why: 'Regolit sıkıştırılıp düzlenir: modüller eşit otursun, toz kalkmasın ve yürüyüş yolu belli olsun. Kütlesi yoktur çünkü yerinde üretilir — ISRU\'nun en ucuz biçimi.' },
  { id: 'temel-hab', ad: 'Habitat temel plakaları (6)', sistem: 'yapi', step: 1, qty: 6, mountsTo: 'platform', arayuz: 'ayirma',
    massKg: 42, pos: [-3.6, 0, 0.06], size: [1.1, 1.1, 0.12], sekil: 'plaka',
    why: 'Yükü regolite yayar. Altı nokta izostatik değildir ama zeminde oturma farkını cıvata boyuyla düzeltmek gerekir; üç nokta ise yumuşak regolitte batar.' },

  /* ADIM 2 — basınçlı çekirdek */
  { id: 'hab-silindir', ad: 'Sert habitat modülü', sistem: 'basincli', step: 2, mountsTo: 'temel-hab', arayuz: 'civata',
    massKg: 4800, pos: [-3.6, 0, 2.3], size: [7.6, 4.4, 4.4], sekil: 'silindir-yatay',
    why: 'Çapı fırlatıcı başlığına göre seçilir (4,4 m). Uçları küresel kapak: basınç yükünü membran gerilmesine çevirir, düz kapak eğilmede kalırdı.',
    ports: [{ ad: 'kilit', pos: [0.5, -2.2, 0], dir: [0, -1, 0], tur: 'basincli' },
            { ad: 'tunel', pos: [3.8, 0, 0], dir: [1, 0, 0], tur: 'basincli' },
            { ad: 'O2', pos: [-3.8, 0.8, -1.2], dir: [-1, 0, 0], tur: 'O2' },
            { ad: 'guc', pos: [-3.8, -0.8, -1.2], dir: [-1, 0, 0], tur: 'DC' }] },
  { id: 'hab-ic-raf', ad: 'İç raf ve ekipman duvarı', sistem: 'basincli', step: 2, mountsTo: 'hab-silindir', arayuz: 'civata',
    massKg: 620, pos: [-3.6, 1.2, 1.6], size: [6.4, 0.8, 2.0], sekil: 'raf',
    why: 'Yaşam desteği, su geri kazanımı ve elektronik tek duvarda toplanır: bakım tek noktadan, gürültü tek yönde.' },
  { id: 'regolit-ortu', ad: 'Regolit radyasyon örtüsü', sistem: 'yapi', step: 2, mountsTo: 'hab-silindir', arayuz: 'ayirma',
    massKg: 0, pos: [-3.6, 0, 3.4], size: [8.6, 5.4, 1.6], sekil: 'ortu',
    why: '0,5–1 m regolit, galaktik kozmik ışın dozunu Dünya atmosferi mertebesine indirir. Yerinde kazılır, taşınmaz; kütle bütçesinde sıfır görünmesinin nedeni budur.' },

  /* ADIM 3 — geçişler */
  { id: 'hava-kilidi', ad: 'Hava kilidi', sistem: 'gecis', step: 3, mountsTo: 'hab-silindir', arayuz: 'basincli',
    massKg: 890, pos: [-3.1, -3.6, 1.5], size: [2.4, 2.4, 2.6], sekil: 'silindir-dikey',
    why: 'Hacmi küçük tutulur çünkü her çıkışta o hacim kadar hava kaybedilir. Kapılar İÇE açılır: basınç kapıyı contaya bastırır, dışa açılan kapıyı ise koparır.',
    ports: [{ ad: 'ic', pos: [0, 1.2, -0.4], dir: [0, 1, 0], tur: 'basincli' },
            { ad: 'dis', pos: [0, -1.2, -0.4], dir: [0, -1, 0], tur: 'basincli' }] },
  { id: 'toz-firca', ad: 'Toz temizleme istasyonu', sistem: 'gecis', step: 3, mountsTo: 'hava-kilidi', arayuz: 'civata',
    massKg: 65, pos: [-3.1, -5.1, 0.9], size: [1.6, 1.0, 1.8], sekil: 'kutu',
    why: 'Toz içeri girerse conta, yatak ve akciğer bozar. Dış kapının ÖNÜNDE durur; temizlik giysi üstündeyken yapılır, içeride değil.' },
  { id: 'tunel', ad: 'Bağlantı tüneli', sistem: 'gecis', step: 3, mountsTo: 'hab-silindir', arayuz: 'basincli',
    massKg: 410, pos: [1.4, 0, 2.0], size: [3.2, 1.9, 1.9], sekil: 'tunel',
    why: 'İki modülü basınç altında bağlar. Körük bölümü ısıl genleşmeyi ve oturma farkını yutar; rijit bağlasak conta çatlardı.',
    ports: [{ ad: 'bati', pos: [-1.6, 0, 0], dir: [-1, 0, 0], tur: 'basincli' },
            { ad: 'dogu', pos: [1.6, 0, 0], dir: [1, 0, 0], tur: 'basincli' }] },
  { id: 'dugum', ad: 'Düğüm modülü', sistem: 'gecis', step: 3, mountsTo: 'tunel', arayuz: 'basincli',
    massKg: 1450, pos: [4.6, 0, 2.1], size: [3.4, 3.4, 3.4], sekil: 'dugum',
    why: 'Dört kapılı kavşak: üsse yeni modül eklemenin tek ucuz yolu, baştan fazladan kapı koymaktır.',
    ports: [{ ad: 'bati', pos: [-1.7, 0, 0], dir: [-1, 0, 0], tur: 'basincli' },
            { ad: 'dogu', pos: [1.7, 0, 0], dir: [1, 0, 0], tur: 'basincli' },
            { ad: 'kuzey', pos: [0, 1.7, 0], dir: [0, 1, 0], tur: 'basincli' }] },

  /* ADIM 4 — şişme hacim ve sera */
  { id: 'sisme-modul', ad: 'Şişme habitat (toroid)', sistem: 'basincli', step: 4, mountsTo: 'dugum', arayuz: 'basincli',
    massKg: 2900, pos: [4.6, 5.4, 2.4], size: [7.2, 7.2, 3.6], sekil: 'toroid',
    why: 'Katlanıp fırlatılır, yörüngede/yüzeyde şişer: hacim/kütle oranı sert modülün üç katı. Dikiş şeritleri ve bombe, zarın gerilme dağılımının görünür hâlidir.' },
  { id: 'sera', ad: 'Sera modülü', sistem: 'basincli', step: 4, mountsTo: 'dugum', arayuz: 'basincli',
    massKg: 1650, pos: [9.2, 0, 1.9], size: [5.6, 3.2, 3.2], sekil: 'silindir-yatay',
    why: 'Şeffaf DEĞİL: cam hem radyasyon geçirir hem ısı kaybettirir. İçeride LED ve kontrollü spektrum; bitki ışığı pencereden değil prizden gelir.' },

  /* ADIM 5 — güç */
  { id: 'panel-tarlasi', ad: 'Güneş paneli tarlası', sistem: 'guc', step: 5, qty: 4, mountsTo: 'platform', arayuz: 'ayirma',
    massKg: 310, pos: [-9.5, 6.0, 0.9], size: [5.0, 3.0, 1.6], sekil: 'panel-tarla',
    why: 'Mars\'ta toz birikir: paneller EĞİK durur ki toz kaysın ve temizleme kolay olsun. Ay kutbunda aynı tarla DİKEY olurdu çünkü Güneş ufukta dolaşır.' },
  { id: 'batarya-kabini', ad: 'Batarya kabini', sistem: 'guc', step: 5, mountsTo: 'platform', arayuz: 'ayirma',
    massKg: 780, pos: [-8.0, 2.2, 0.8], size: [2.6, 1.8, 1.6], sekil: 'kutu',
    why: 'Gece ve toz fırtınası için. Yalıtımlı: batarya soğukta kapasitesini kaybeder, sıcakta ömrünü.' },
  { id: 'reaktor', ad: 'Fisyon güç ünitesi', sistem: 'guc', step: 5, mountsTo: 'platform', arayuz: 'ayirma',
    massKg: 1520, pos: [11.5, -7.5, 1.4], size: [2.2, 2.2, 2.8], sekil: 'reaktor',
    why: 'Toz fırtınasında güneş yetmez. Üsten uzağa konur ve arasına gölge kalkanı girer: doz mesafenin karesiyle düşer, kalkan gerisini alır.' },
  { id: 'reaktor-radyator', ad: 'Reaktör radyatör şemsiyesi', sistem: 'isil', step: 5, mountsTo: 'reaktor', arayuz: 'civata',
    massKg: 340, pos: [11.5, -7.5, 3.4], size: [5.2, 5.2, 0.4], sekil: 'semsiye',
    why: 'Fisyon ısısının atılacağı tek yer uzaydır. Şemsiye biçimi ışıma alanını kütleye bölen en verimli açılımdır.' },

  /* ADIM 6 — ısıl ve ISRU */
  { id: 'radyator-dizisi', ad: 'Üs radyatör dizisi', sistem: 'isil', step: 6, qty: 2, mountsTo: 'platform', arayuz: 'ayirma',
    massKg: 290, pos: [-1.0, 7.6, 1.6], size: [6.0, 0.3, 2.6], sekil: 'radyator',
    why: 'Habitatın attığı ısı buradan ışır. Güneşe SIRT dönük durur; yüzeyi güneş görürse net ısı atımı sıfırlanır.' },
  { id: 'moxie', ad: 'MOXIE (CO₂ → O₂)', sistem: 'isru', step: 6, mountsTo: 'platform', arayuz: 'ayirma',
    massKg: 420, pos: [6.5, -6.2, 1.0], size: [2.2, 1.8, 1.8], sekil: 'kutu',
    why: 'Mars atmosferinin %95\'i CO₂. Katı oksit elektrolizi oksijeni yerinde üretir; solunan ve yakılan oksijen Dünya\'dan taşınmaz.' },
  { id: 'sabatier', ad: 'Sabatier reaktörü', sistem: 'isru', step: 6, mountsTo: 'platform', arayuz: 'ayirma',
    massKg: 380, pos: [8.6, -6.2, 1.0], size: [2.0, 1.6, 1.8], sekil: 'kutu',
    why: 'CO₂ + H₂ → CH₄ + H₂O. Dönüş yakıtı ve su aynı reaksiyondan çıkar; suyu elektrolizle bölüp hidrojeni geri verirsin.' },
  { id: 'tank-o2', ad: 'O₂ tankı', sistem: 'isru', step: 6, mountsTo: 'platform', arayuz: 'ayirma',
    massKg: 260, pos: [5.2, -9.4, 1.6], size: [2.4, 2.4, 3.0], sekil: 'tank-dikey',
    why: 'Kriyojenik; MLI ile sarılı. Yakıt tankından AYRI ve mesafeli durur: oksitleyici ile yakıtı yan yana koymak tek arızayı yangına çevirir.' },
  { id: 'tank-ch4', ad: 'CH₄ tankı', sistem: 'isru', step: 6, mountsTo: 'platform', arayuz: 'ayirma',
    massKg: 240, pos: [9.8, -9.4, 1.6], size: [2.4, 2.4, 3.0], sekil: 'tank-dikey',
    why: 'Sabatier\'in ürünü. O₂ tankından ayrı; aradaki mesafe bir tasarım kararıdır, yerleşim planının kuralıdır.' },

  /* ADIM 7 — hatlar, iletişim, saha */
  { id: 'hat-o2', ad: 'O₂ hattı', sistem: 'hat', step: 7, mountsTo: 'tank-o2', arayuz: 'akiskan',
    massKg: 75, pos: [0.8, -4.8, 0.9], size: [9.0, 0.24, 0.24], sekil: 'hat', akiskan: 'O2',
    boru: { odM: 0.08, wallM: 0.002, malzeme: 'paslanmaz', ucNoktalar: ['tank-o2', 'hab-silindir'] },
    why: 'Tanktan habitata. Yerden yükseltilir (toz), her 4 m beşiğe oturur ve her 30 m\'de genleşme ilmeği yapar: gündüz-gece farkı 100 K\'yi geçer, düz boru çeker ve kopar.' },
  { id: 'hat-guc', ad: 'Güç hattı', sistem: 'hat', step: 7, mountsTo: 'reaktor', arayuz: 'elektrik',
    massKg: 154, pos: [4.0, -4.0, 0.7], size: [14.0, 0.18, 0.18], sekil: 'hat', akiskan: 'DC',
    boru: { odM: 0.06, wallM: 0.004, malzeme: 'bakir', ucNoktalar: ['reaktor', 'hab-silindir'] },
    why: 'Reaktörden üsse. Kablo tavasında ve sarkmalı: gergin çekilen kablo ısıl daralmada kopar, sarkma o payı taşır.' },
  { id: 'anten-direk', ad: 'İletişim direği', sistem: 'iletisim', step: 7, mountsTo: 'platform', arayuz: 'ayirma',
    massKg: 210, pos: [-0.5, -8.4, 3.6], size: [0.5, 0.5, 7.2], sekil: 'direk',
    why: 'Yükseklik doğrudan ufuk mesafesidir; 7 m\'lik direk düz arazide görüş çizgisini birkaç kilometre uzatır.',
    ports: [{ ad: 'tepe', pos: [0, 0, 3.6], dir: [0, 0, 1], tur: 'DATA' }] },
  { id: 'anten-canak', ad: 'Dünya çanağı (2,4 m)', sistem: 'iletisim', step: 7, mountsTo: 'anten-direk', arayuz: 'mentese',
    massKg: 95, pos: [-0.5, -8.4, 7.6], size: [2.4, 2.4, 0.7], sekil: 'canak',
    why: 'Dünya\'yı izler; iki eksenli gimbal gezegen döndükçe kilidi korur. Dar huzme yüksek veri hızı demektir.' },
  { id: 'ruzgar-olcer', ad: 'Rüzgâr ölçer', sistem: 'iletisim', step: 7, mountsTo: 'anten-direk', arayuz: 'civata',
    massKg: 8, pos: [-0.5, -8.9, 6.2], size: [0.6, 0.6, 0.5], sekil: 'ruzgar',
    why: 'Toz fırtınası uyarısı ve iniş penceresi için. Yalnız atmosferi olan gezegende gerçektir; Ay\'da ölçülecek rüzgâr yoktur.' },
  { id: 'garaj', ad: 'Gezgin tentesi', sistem: 'yapi', step: 7, mountsTo: 'platform', arayuz: 'ayirma',
    massKg: 520, pos: [-9.8, -4.6, 1.8], size: [6.0, 4.4, 3.4], sekil: 'tente',
    why: 'Kapalı değil: basınçlı garaj hem pahalı hem gereksiz. Tente tozu ve gece soğuğunu keser, şarj kablosu altından gelir.' },
]);

export const STEPS = Object.freeze([
  { no: 1, ad: 'Zemin ve temel', aciklama: 'Regolit sıkıştırılır, temel plakaları serilir. Bundan sonraki her ölçü bu düzleme göredir.' },
  { no: 2, ad: 'Basınçlı çekirdek', aciklama: 'Sert habitat indirilir, iç raf duvarı takılır, üstü regolitle örtülür. Örtü kazılarak yerinde üretilir.' },
  { no: 3, ad: 'Geçişler', aciklama: 'Hava kilidi, toz temizleme, tünel ve düğüm. Basınçlı hacim ancak bu adımdan sonra kullanılabilir.' },
  { no: 4, ad: 'Hacim genişletme', aciklama: 'Şişme modül ve sera düğüme bağlanır; üs artık dört kişiyi uzun süre taşıyabilir.' },
  { no: 5, ad: 'Güç', aciklama: 'Panel tarlası, batarya kabini ve fisyon ünitesi. Reaktör uzağa, gölge kalkanının arkasına.' },
  { no: 6, ad: 'Isıl ve ISRU', aciklama: 'Radyatörler, MOXIE, Sabatier ve tanklar. Oksijen ve yakıt yerinde üretilmeye başlar.' },
  { no: 7, ad: 'Hatlar ve saha', aciklama: 'Boru ve kablo hatları, iletişim direği, gezgin tentesi. Üs bağlanır ve görünür olur.' },
]);

/** Bağlantı katsayısı: çıplak borunun üstüne vana, flanş, yalıtım ve
 * askı gelir. Beyan edilen hat kütlesi = birim kütle × boy × bu katsayı;
 * denetim ikisinin ayrışmasına izin vermez. */
export const FITTINGS_FACTOR = 1.45;

/** Hat bileşenlerinin uç noktaları — yönlendirme buradan plan üretir. */
export function runEndpoints(id) {
  const p = partById(id);
  if (!p || !p.boru || !p.boru.ucNoktalar) return null;
  const [a, b] = p.boru.ucNoktalar.map(partById);
  if (!a || !b) return null;
  return { a: a.pos, b: b.pos, akiskan: p.akiskan, odM: p.boru.odM, wallM: p.boru.wallM, malzeme: p.boru.malzeme };
}

/* ── sorgular ─────────────────────────────────────────────────────────── */
const say = p => p.qty ?? 1;
export const partMass = p => say(p) * p.massKg;
export function partById(id) { return PARTS.find(p => p.id === id) || null; }

/** Bileşen bu ortamda gerçek mi? */
export function envAllows(id, envKey = 'mars') {
  const e = HAB_ENV[envKey];
  if (!e) throw new Error(`hab-parts: bilinmeyen ortam '${envKey}'`);
  const k = ENV_RULE[id];
  if (!k) return { ok: true, id, env: e };
  const ok = Boolean(k.gerek(e));
  return { ok, id, env: e, neden: ok ? null : k.neden, oneri: ok ? null : k.oneri };
}
export const ENV_RULED = Object.freeze(Object.keys(ENV_RULE));

/**
 * Kütle bütçesi ORTAMA bağlıdır. Ortamsız çağrı bütün katalogu toplar ve
 * bu yanlıştı: Ay üssü 24 bileşenle kuruluyor ama bütçe 26 bileşenin
 * kütlesini gösteriyordu (MOXIE 420 kg + rüzgâr ölçer 8 kg, hiç
 * gönderilmeyecek 428 kg). Reddedilen bileşen fırlatılmaz; bütçede de
 * yoktur.
 */
export function massBudget(envKey = null) {
  const sistem = {};
  let toplam = 0;
  const kapsam = envKey ? PARTS.filter(p => envAllows(p.id, envKey).ok) : PARTS;
  for (const p of kapsam) {
    const m = partMass(p);
    toplam += m;
    sistem[p.sistem] = (sistem[p.sistem] || 0) + m;
  }
  return {
    ortam: envKey ? HAB_ENV[envKey].ad : 'ortamdan bağımsız (tam katalog)',
    kapsamParca: kapsam.length,
    disaridaKg: envKey ? Number(PARTS.filter(p => !envAllows(p.id, envKey).ok)
      .reduce((a, p) => a + partMass(p), 0).toFixed(1)) : 0,
    toplamKg: Number(toplam.toFixed(1)),
    /* Yerinde üretilen (kütlesi 0) bileşenler: taşınmayan her kilogram kazançtır. */
    yerindeUretilen: kapsam.filter(p => p.massKg === 0).map(p => p.id),
    sistemler: Object.entries(sistem).map(([k, v]) => ({ sistem: k, ad: SUBSYSTEMS[k].ad, kg: Number(v.toFixed(1)), pay: v / toplam }))
      .sort((a, b) => b.kg - a.kg),
    parcaSayisi: kapsam.reduce((s, p) => s + say(p), 0),
  };
}

/** Basınçlı hacim zinciri: hangi modüller havayı paylaşıyor. */
export function pressurizedChain() {
  const basincliler = PARTS.filter(p => p.sistem === 'basincli' || p.sistem === 'gecis');
  return basincliler.filter(p => p.arayuz === 'basincli' || p.sistem === 'basincli').map(p => p.id);
}

/** Bütün arayüz noktaları (hat yönlendirme buradan bağlanır). */
export function allPorts() {
  const out = [];
  for (const p of PARTS) for (const q of (p.ports || [])) {
    out.push({ parca: p.id, ad: q.ad, tur: q.tur,
      pos: [p.pos[0] + q.pos[0], p.pos[1] + q.pos[1], p.pos[2] + q.pos[2]], dir: q.dir });
  }
  return out;
}

export function describe(envKey = 'mars') {
  const b = massBudget(envKey);
  const red = PARTS.filter(p => !envAllows(p.id, envKey).ok);
  return {
    ortam: HAB_ENV[envKey].ad,
    parca: PARTS.length, adet: b.parcaSayisi, adim: STEPS.length,
    toplamKg: b.toplamKg, yerindeUretilen: b.yerindeUretilen.length,
    reddedilen: red.map(p => p.id),
    basincliModul: pressurizedChain().length,
    arayuzNoktasi: allPorts().length,
  };
}
