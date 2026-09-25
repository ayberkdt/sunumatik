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
    tech: {
      no: 'HB-CIV-001',
      malzeme: 'Sıkıştırılmış regolit + poliüretan bağlayıcı emdirme',
      guc_W: 0,
      sicaklik_C: [-140, 30],
      baglanti: 'Yok — yerinde serilir ve sıkıştırılır',
      detay: '26 × 20 m; sıkıştırma 1,9 g/cm³, taşıma gücü 180 kPa. Bağlayıcı yalnız üst 4 cm\'e emdirilir: tozu bağlar, kazıyı engellemez',
      kalite: 'Yerinde üretim — fırlatılan kütle sıfır',
    },
    why: 'Regolit sıkıştırılıp düzlenir: modüller eşit otursun, toz kalkmasın ve yürüyüş yolu belli olsun. Kütlesi yoktur çünkü yerinde üretilir — ISRU\'nun en ucuz biçimi.' },
  { id: 'temel-hab', ad: 'Habitat temel plakaları (6)', sistem: 'yapi', step: 1, qty: 6, mountsTo: 'platform', arayuz: 'ayirma',
    massKg: 42, pos: [-3.6, 0, 0.06], size: [1.1, 1.1, 0.12], sekil: 'plaka',
    tech: {
      no: 'HB-STR-010',
      malzeme: '6061-T6 alüminyum plaka, 12 mm',
      guc_W: 0,
      sicaklik_C: [-140, 60],
      baglanti: 'Regolit vidası 6 × Ø90 mm, 600 mm derin; üstte küresel mafsal',
      detay: 'Plaka başına 1,1 × 1,1 m ⇒ zemin basıncı 4800 kg / 7,26 m² = 6,6 kPa, taşıma gücünün %4\'ü',
      kalite: 'Küresel mafsal oturma farkını yutar; rijit bağlasak plaka eğilirdi',
    },
    why: 'Yükü regolite yayar. Altı nokta izostatik değildir ama zeminde oturma farkını cıvata boyuyla düzeltmek gerekir; üç nokta ise yumuşak regolitte batar.' },

  /* ADIM 2 — basınçlı çekirdek */
  { id: 'hab-silindir', ad: 'Sert habitat modülü', sistem: 'basincli', step: 2, mountsTo: 'temel-hab', arayuz: 'civata',
    massKg: 4800, pos: [-3.6, 0, 2.3], size: [7.6, 4.4, 4.4], sekil: 'silindir-yatay',
    tech: {
      no: 'HB-PRS-020',
      malzeme: '2219-T87 alüminyum kabuk 4,8 mm, iç Nomex astar',
      guc_W: 1850,
      sicaklik_C: [18, 27],
      hacim_m3: 92,
      koruma_gcm2: 2.1,
      baglanti: 'Temel plakalarına 6 × M20 küresel mafsal; uçlarda basınçlı geçiş flanşı',
      isiYolu: 'İç hava → soğutucu ilmeği → radyatör dizisi (radyator-dizisi)',
      detay: 'Ø4,4 × 7,6 m; 101,3 kPa iç basınç ⇒ çember gerilmesi pr/t = 101300 × 2,2 / 0,0048 = 46,4 MPa, akma sınırının %13\'ü. Küresel kapak aynı basınçta yarı gerilme taşır',
      kalite: 'Basınç emniyet payı 4,0 (insanlı uçuş kuralı)',
    },
    why: 'Çapı fırlatıcı başlığına göre seçilir (4,4 m). Uçları küresel kapak: basınç yükünü membran gerilmesine çevirir, düz kapak eğilmede kalırdı.',
    ports: [{ ad: 'kilit', pos: [0.5, -2.2, 0], dir: [0, -1, 0], tur: 'basincli' },
            { ad: 'tunel', pos: [3.8, 0, 0], dir: [1, 0, 0], tur: 'basincli' },
            { ad: 'O2', pos: [-3.8, 0.8, -1.2], dir: [-1, 0, 0], tur: 'O2' },
            { ad: 'guc', pos: [-3.8, -0.8, -1.2], dir: [-1, 0, 0], tur: 'DC' }] },
  { id: 'hab-ic-raf', ad: 'İç raf ve ekipman duvarı', sistem: 'basincli', step: 2, mountsTo: 'hab-silindir', arayuz: 'civata',
    massKg: 620, pos: [-3.6, 1.2, 1.6], size: [6.4, 0.8, 2.0], sekil: 'raf',
    tech: {
      no: 'HB-ECL-021',
      malzeme: 'Al petek raf, hızlı sökülür bağlantı',
      guc_W: 1240,
      sicaklik_C: [15, 35],
      baglanti: 'Kabuğa 24 × çeyrek tur kilit — bakım tek elle açılır',
      isiYolu: 'Raf arkası hava kanalı → soğutucu ilmeği',
      detay: 'CO₂ tutucu 380 W, su geri kazanım 430 W, hava dolaşımı 210 W, elektronik 220 W. Tek duvarda toplanır: gürültü tek yöne, bakım tek noktaya',
      veri_Mbps: 12,
      kalite: 'Her kutu ikili yedekli',
    },
    why: 'Yaşam desteği, su geri kazanımı ve elektronik tek duvarda toplanır: bakım tek noktadan, gürültü tek yönde.' },
  { id: 'regolit-ortu', ad: 'Regolit radyasyon örtüsü', sistem: 'yapi', step: 2, mountsTo: 'hab-silindir', arayuz: 'ayirma',
    massKg: 0, pos: [-3.6, 0, 3.4], size: [8.6, 5.4, 1.6], sekil: 'ortu',
    tech: {
      no: 'HB-RAD-022',
      malzeme: 'Kazılmış regolit, çuval içinde',
      guc_W: 0,
      sicaklik_C: [-140, 30],
      koruma_gcm2: 95,
      baglanti: 'Kabuğa dokunmaz — ayrı kemer taşır; yük basınçlı kabuğa geçmez',
      detay: '0,6 m kalınlık × 1,58 g/cm³ = 95 g/cm² sütun yoğunluğu. GKR dozunu ~%50 indirir; ikincil nötron üretimi bu kalınlıkta hâlâ net kazanç',
      kalite: 'Yerinde kazılır — fırlatılan kütle sıfır',
    },
    why: '0,5–1 m regolit, galaktik kozmik ışın dozunu Dünya atmosferi mertebesine indirir. Yerinde kazılır, taşınmaz; kütle bütçesinde sıfır görünmesinin nedeni budur.' },

  /* ADIM 3 — geçişler */
  { id: 'hava-kilidi', ad: 'Hava kilidi', sistem: 'gecis', step: 3, mountsTo: 'hab-silindir', arayuz: 'basincli',
    massKg: 890, pos: [-3.1, -3.6, 1.5], size: [2.4, 2.4, 2.6], sekil: 'silindir-dikey',
    tech: {
      no: 'HB-EVA-030',
      malzeme: '2219-T87 kabuk, çift kapı',
      guc_W: 310,
      sicaklik_C: [10, 30],
      hacim_m3: 8.4,
      koruma_gcm2: 1.4,
      baglanti: 'Basınçlı geçiş flanşı, 32 × M12 kelepçe; kapılar İÇE açılır',
      isiYolu: 'Kabuk üstü yerel radyatör; boşaltma pompası ısısı buraya',
      detay: '8,4 m³; boşaltma pompası hacmin %85\'ini geri kazanır ⇒ çıkış başına 1,26 m³ hava kaybı (pompasız 8,4 m³ olurdu)',
      kalite: 'Kapı basıncı contaya bastırır; dışa açılan kapı kopardı',
    },
    why: 'Hacmi küçük tutulur çünkü her çıkışta o hacim kadar hava kaybedilir. Kapılar İÇE açılır: basınç kapıyı contaya bastırır, dışa açılan kapıyı ise koparır.',
    ports: [{ ad: 'ic', pos: [0, 1.2, -0.4], dir: [0, 1, 0], tur: 'basincli' },
            { ad: 'dis', pos: [0, -1.2, -0.4], dir: [0, -1, 0], tur: 'basincli' }] },
  { id: 'toz-firca', ad: 'Toz temizleme istasyonu', sistem: 'gecis', step: 3, mountsTo: 'hava-kilidi', arayuz: 'civata',
    massKg: 65, pos: [-3.1, -5.1, 0.9], size: [1.6, 1.0, 1.8], sekil: 'kutu',
    tech: {
      kesilebilir: true,
      no: 'HB-EVA-031',
      malzeme: 'Paslanmaz gövde, iletken fırça teli',
      guc_W: 420,
      sicaklik_C: [-60, 40],
      baglanti: 'Hava kilidi dış kapağına 8 × M8; DIŞARIDA durur',
      isiYolu: 'Doğrudan ortama — ünite basınçlı hacmin DIŞINDA, ısısı üs ilmeğine hiç girmez',
      detay: 'Elektrostatik toz kalkanı + döner fırça; giysi üstünde çalışır. Ay tozu keskin ve yüklü: conta, yatak ve akciğer düşmanı',
      kalite: 'Tozun içeri girmesi geri alınamaz — temizlik dışarıda yapılır',
    },
    why: 'Toz içeri girerse conta, yatak ve akciğer bozar. Dış kapının ÖNÜNDE durur; temizlik giysi üstündeyken yapılır, içeride değil.' },
  { id: 'tunel', ad: 'Bağlantı tüneli', sistem: 'gecis', step: 3, mountsTo: 'hab-silindir', arayuz: 'basincli',
    massKg: 410, pos: [1.4, 0, 2.0], size: [3.2, 1.9, 1.9], sekil: 'tunel',
    tech: {
      no: 'HB-PRS-032',
      malzeme: 'Al kabuk + paslanmaz körük bölümü',
      guc_W: 85,
      sicaklik_C: [5, 30],
      hacim_m3: 9.1,
      koruma_gcm2: 0.9,
      baglanti: 'İki uçta basınçlı geçiş flanşı; orta bölüm körük',
      isiYolu: 'Yerel ısıtıcı; soğuk köprü riski körükte',
      detay: 'Ø1,9 × 3,2 m. Körük ±40 mm eksenel, ±2° açısal yutar: ΔT=110 K\'de 3,2 m alüminyum 8,2 mm oynar, zemin oturması daha fazlasını',
      kalite: 'Körük basınç yükünü taşımaz — takviye halkaları taşır',
    },
    why: 'İki modülü basınç altında bağlar. Körük bölümü ısıl genleşmeyi ve oturma farkını yutar; rijit bağlasak conta çatlardı.',
    ports: [{ ad: 'bati', pos: [-1.6, 0, 0], dir: [-1, 0, 0], tur: 'basincli' },
            { ad: 'dogu', pos: [1.6, 0, 0], dir: [1, 0, 0], tur: 'basincli' }] },
  { id: 'dugum', ad: 'Düğüm modülü', sistem: 'gecis', step: 3, mountsTo: 'tunel', arayuz: 'basincli',
    massKg: 1450, pos: [4.6, 0, 2.1], size: [3.4, 3.4, 3.4], sekil: 'dugum',
    tech: {
      no: 'HB-PRS-033',
      malzeme: '2219-T87 küresel kabuk 5,2 mm',
      guc_W: 140,
      sicaklik_C: [18, 27],
      hacim_m3: 20.6,
      koruma_gcm2: 1.1,
      baglanti: 'Beş basınçlı kapı (4 yatay + 1 tavan), her biri 32 × M12',
      isiYolu: 'Ana soğutucu ilmeği buradan dağılır',
      detay: 'Ø3,4 m küre; küre aynı hacmi en az kabuk kütlesiyle çevreler. Beşinci kapı fazladan: üsse modül eklemenin tek ucuz yolu baştan kapı koymaktır',
      kalite: 'Kapı başına bağımsız izolasyon valfi',
    },
    why: 'Dört kapılı kavşak: üsse yeni modül eklemenin tek ucuz yolu, baştan fazladan kapı koymaktır.',
    ports: [{ ad: 'bati', pos: [-1.7, 0, 0], dir: [-1, 0, 0], tur: 'basincli' },
            { ad: 'dogu', pos: [1.7, 0, 0], dir: [1, 0, 0], tur: 'basincli' },
            { ad: 'kuzey', pos: [0, 1.7, 0], dir: [0, 1, 0], tur: 'basincli' }] },

  /* ADIM 4 — şişme hacim ve sera */
  { id: 'sisme-modul', ad: 'Şişme habitat (toroid)', sistem: 'basincli', step: 4, mountsTo: 'dugum', arayuz: 'basincli',
    massKg: 2900, pos: [4.6, 5.4, 2.4], size: [7.2, 7.2, 3.6], sekil: 'toroid',
    tech: {
      no: 'HB-PRS-040',
      malzeme: 'Vectran kuşak + üretan hava tutucu + Nextel yırtılma katmanı',
      guc_W: 680,
      sicaklik_C: [18, 27],
      hacim_m3: 186,
      koruma_gcm2: 1.6,
      baglanti: 'Düğüme basınçlı geçiş; zar merkezi çekirdeğe kuşaklarla bağlı',
      isiYolu: 'Çekirdek içi kanal → soğutucu ilmeği',
      detay: 'Ø7,2 m toroid, 186 m³ — sert modülün iki katı hacim, %60 kütle. Kuşaklar yükü taşır, zar yalnız sızdırmaz; tersi olsaydı tek delik modülü bitirirdi',
      kalite: 'Kalkan katmanı mikrometeorit için; zar tek başına yeterli değil',
    },
    why: 'Katlanıp fırlatılır, yörüngede/yüzeyde şişer: hacim/kütle oranı sert modülün üç katı. Dikiş şeritleri ve bombe, zarın gerilme dağılımının görünür hâlidir.' },
  { id: 'sera', ad: 'Sera modülü', sistem: 'basincli', step: 4, mountsTo: 'dugum', arayuz: 'basincli',
    massKg: 1650, pos: [9.2, 0, 1.9], size: [5.6, 3.2, 3.2], sekil: 'silindir-yatay',
    tech: {
      kesilebilir: true,
      no: 'HB-BIO-041',
      malzeme: 'Al kabuk, iç LED paneller, hidroponik raf',
      guc_W: 2400,
      sicaklik_C: [20, 26],
      hacim_m3: 44,
      baglanti: 'Düğüme basınçlı geçiş, 32 × M12',
      isiYolu: 'LED ısısı → su ilmeği → radyatör (bitkiye giden ısı zaten kullanılıyor)',
      detay: '36 m² ekim alanı; 2400 W LED\'in %38\'i fotosentetik, gerisi ısı. Şeffaf DEĞİL: cam hem radyasyon geçirir hem gece ısı kaybettirir',
      uretim: { gida_kg_gun: 1.9, O2_kg_gun: 2.4 },
      kalite: 'Bitki ışığı pencereden değil prizden gelir',
    },
    why: 'Şeffaf DEĞİL: cam hem radyasyon geçirir hem ısı kaybettirir. İçeride LED ve kontrollü spektrum; bitki ışığı pencereden değil prizden gelir.' },

  /* ADIM 5 — güç */
  { id: 'panel-tarlasi', ad: 'Güneş paneli tarlası', sistem: 'guc', step: 5, qty: 4, mountsTo: 'platform', arayuz: 'ayirma',
    massKg: 310, pos: [-9.5, 6.0, 0.9], size: [5.0, 3.0, 1.6], sekil: 'panel-tarla',
    tech: {
      no: 'HB-PWR-050',
      malzeme: 'IMM üçlü bileşim hücre, Al kafes taşıyıcı',
      guc_W: -662,
      sicaklik_C: [-130, 95],
      baglanti: 'Platforma regolit vidası 4 × Ø60 mm; panel açısı elle ayarlı',
      detay: 'Dizi başına 15 m² ⇒ 662 W; dört dizi 2650 W. Mars\'ta 590 W/m² × %28 verim × %75 toz/açı kaybı. Eğik durur: toz kayar, temizlik kolaylaşır',
      kalite: 'Toz fırtınasında üretim %20\'ye düşer — fisyon bu yüzden var',
    },
    why: 'Mars\'ta toz birikir: paneller EĞİK durur ki toz kaysın ve temizleme kolay olsun. Ay kutbunda aynı tarla DİKEY olurdu çünkü Güneş ufukta dolaşır.' },
  { id: 'batarya-kabini', ad: 'Batarya kabini', sistem: 'guc', step: 5, mountsTo: 'platform', arayuz: 'ayirma',
    massKg: 780, pos: [-8.0, 2.2, 0.8], size: [2.6, 1.8, 1.6], sekil: 'kutu',
    tech: {
      no: 'HB-PWR-051',
      malzeme: 'Li-ion NMC hücre, yalıtımlı kabin',
      guc_W: 140,
      sicaklik_C: [5, 30],
      baglanti: 'Platforma 8 × M12; kabin ısıl olarak ayrık',
      isiYolu: 'Kabin içi yerel radyatör; şarj ısısı dışarı',
      detay: '120 kWh; gece 12,3 saat × 8,5 kW üs yükü = 105 kWh ⇒ %88 boşalma derinliği gerekir. Isıtıcı 140 W: soğukta kapasite kaybı, sıcakta ömür kaybı',
      kalite: 'Fisyon varken batarya yalnız köprü — tek başına gece geçiremez',
    },
    why: 'Gece ve toz fırtınası için. Yalıtımlı: batarya soğukta kapasitesini kaybeder, sıcakta ömrünü.' },
  { id: 'reaktor', ad: 'Fisyon güç ünitesi', sistem: 'guc', step: 5, mountsTo: 'platform', arayuz: 'ayirma',
    massKg: 1520, pos: [11.5, -7.5, 1.4], size: [2.2, 2.2, 2.8], sekil: 'reaktor',
    tech: {
      no: 'HB-PWR-060',
      malzeme: 'UO₂ yakıt, Na ısı borusu, Stirling dönüştürücü',
      guc_W: -10000,
      sicaklik_C: [-40, 80],
      baglanti: 'Platforma 6 × M20; gömme yatak, üsten 14 m uzakta',
      isiYolu: 'Stirling atık ısısı → şemsiye radyatör (reaktor-radyator)',
      detay: '10 kWe; ısıl güç 43 kWt, dönüşüm verimi %23. Doz mesafenin karesiyle düşer: 14 m + gölge kalkanı üs tarafında yıllık 5 mSv\'in altında tutar',
      kalite: 'Toz fırtınası güneşi kesse de üs yaşar',
    },
    why: 'Toz fırtınasında güneş yetmez. Üsten uzağa konur ve arasına gölge kalkanı girer: doz mesafenin karesiyle düşer, kalkan gerisini alır.' },
  { id: 'reaktor-radyator', ad: 'Reaktör radyatör şemsiyesi', sistem: 'isil', step: 5, mountsTo: 'reaktor', arayuz: 'civata',
    massKg: 340, pos: [11.5, -7.5, 3.4], size: [5.2, 5.2, 0.4], sekil: 'semsiye',
    tech: {
      no: 'HB-THR-061',
      malzeme: 'Karbon-karbon kanat, Na-K ilmeği',
      guc_W: 0,
      sicaklik_C: [-120, 480],
      baglanti: 'Reaktöre 8 × M16 yüksek sıcaklık cıvatası',
      detay: '8 dilim × 2,6 m², 21 m² ışıma alanı @ 480 K ⇒ 21 × 0,85 × σ × 480⁴ = 53 kW. Stirling\'in atacağı 33 kW\'ı payla karşılar',
      kalite: 'Fisyon ısısının atılacağı tek yer uzaydır',
    },
    why: 'Fisyon ısısının atılacağı tek yer uzaydır. Şemsiye biçimi ışıma alanını kütleye bölen en verimli açılımdır.' },

  /* ADIM 6 — ısıl ve ISRU */
  { id: 'radyator-dizisi', ad: 'Üs radyatör dizisi', sistem: 'isil', step: 6, qty: 2, mountsTo: 'platform', arayuz: 'ayirma',
    massKg: 290, pos: [-1.0, 7.6, 1.6], size: [6.0, 0.3, 2.6], sekil: 'radyator',
    tech: {
      no: 'HB-THR-070',
      malzeme: 'Al kanat, OSR kaplama, amonyak ilmeği',
      kanat: 2,
      guc_W: 310,
      sicaklik_C: [-100, 50],
      baglanti: 'Platforma 6 × M12; güneşe SIRT dönük sabit yönelim',
      isiYolu: 'Pompa ısısı bastığı akışkanın içinde kalır ve aynı kanatlardan ışır — ayrı bir yol gerekmez',
      detay: '2 dizi × 2 kanat × 6,0 × 2,6 m = 62,4 m². NET atım, ortamın geri ışıması düşülerek hesaplanır: εσ(T⁴ − F_zemin·T_zemin⁴ − F_gök·T_gök⁴). Pompa 310 W',
      kalite: 'Yüzü güneş görürse net atım sıfırlanır',
    },
    why: 'Habitatın attığı ısı buradan ışır. Güneşe SIRT dönük durur; yüzeyi güneş görürse net ısı atımı sıfırlanır.' },
  { id: 'moxie', ad: 'MOXIE (CO₂ → O₂)', sistem: 'isru', step: 6, mountsTo: 'platform', arayuz: 'ayirma',
    massKg: 420, pos: [6.5, -6.2, 1.0], size: [2.2, 1.8, 1.8], sekil: 'kutu',
    tech: {
      kesilebilir: true,
      no: 'HB-ISR-080',
      malzeme: 'Katı oksit elektroliz yığını (skandiyum kararlı zirkonya)',
      guc_W: 1900,
      sicaklik_C: [-60, 50],
      baglanti: 'Platforma 6 × M12; CO₂ girişi filtreli',
      isiYolu: 'Yığın 800 °C çalışır — yalıtım içinde, atık ısı yerel radyatöre',
      detay: '2CO₂ → 2CO + O₂. 1900 W ile 2,8 kg/gün O₂. Mürettebat 4 kişi × 0,84 kg/gün = 3,4 kg/gün solur; fark sera ve geri kazanımdan kapanır',
      uretim: { O2_kg_gun: 2.8 },
      kalite: 'Yalnız atmosferi olan gezegende gerçek',
    },
    why: 'Mars atmosferinin %95\'i CO₂. Katı oksit elektrolizi oksijeni yerinde üretir; solunan ve yakılan oksijen Dünya\'dan taşınmaz.' },
  { id: 'sabatier', ad: 'Sabatier reaktörü', sistem: 'isru', step: 6, mountsTo: 'platform', arayuz: 'ayirma',
    massKg: 380, pos: [8.6, -6.2, 1.0], size: [2.0, 1.6, 1.8], sekil: 'kutu',
    tech: {
      kesilebilir: true,
      no: 'HB-ISR-081',
      malzeme: 'Ni katalizör yatağı, paslanmaz reaktör',
      guc_W: 850,
      sicaklik_C: [-60, 50],
      baglanti: 'Platforma 6 × M12; O₂ ve CH₄ çıkışları AYRI hatlara',
      isiYolu: 'Reaksiyon EKZOTERMİK (−165 kJ/mol) — ısı su ısıtmaya geri verilir',
      detay: 'CO₂ + 4H₂ → CH₄ + 2H₂O. 850 W ile 1,6 kg/gün CH₄ ve 3,6 kg/gün H₂O. Su elektrolizle bölünüp hidrojen geri döner: hidrojen taşınmaz, döner',
      uretim: { CH4_kg_gun: 1.6, H2O_kg_gun: 3.6 },
      kalite: 'Dönüş yakıtı ve su aynı reaksiyondan',
    },
    why: 'CO₂ + H₂ → CH₄ + H₂O. Dönüş yakıtı ve su aynı reaksiyondan çıkar; suyu elektrolizle bölüp hidrojeni geri verirsin.' },
  { id: 'tank-o2', ad: 'O₂ tankı', sistem: 'isru', step: 6, mountsTo: 'platform', arayuz: 'ayirma',
    massKg: 260, pos: [5.2, -9.4, 1.6], size: [2.4, 2.4, 3.0], sekil: 'tank-dikey',
    tech: {
      no: 'HB-ISR-090',
      malzeme: 'Ti liner + karbon sargı, 30 katmanlı MLI',
      guc_W: 180,
      sicaklik_C: [-196, 40],
      baglanti: 'Platforma 4 × M16 kulak; kuru akışkan bağlantısı, kesme valfi',
      isiYolu: 'Aktif soğutucu 180 W — kaynama kaybını sıfırlar',
      detay: 'Ø2,4 × 3,0 m, 11,2 m³ ⇒ 12 800 kg LOX. MLI\'siz günlük kaynama %2,4; MLI + soğutucu ile <%0,05',
      kalite: 'Oksitleyici ile yakıt 4,6 m ayrı: tek arıza yangına dönüşmesin',
    },
    why: 'Kriyojenik; MLI ile sarılı. Yakıt tankından AYRI ve mesafeli durur: oksitleyici ile yakıtı yan yana koymak tek arızayı yangına çevirir.' },
  { id: 'tank-ch4', ad: 'CH₄ tankı', sistem: 'isru', step: 6, mountsTo: 'platform', arayuz: 'ayirma',
    massKg: 240, pos: [9.8, -9.4, 1.6], size: [2.4, 2.4, 3.0], sekil: 'tank-dikey',
    tech: {
      no: 'HB-ISR-091',
      malzeme: 'Ti liner + karbon sargı, 30 katmanlı MLI',
      guc_W: 160,
      sicaklik_C: [-182, 40],
      baglanti: 'Platforma 4 × M16 kulak; kuru akışkan bağlantısı, kesme valfi',
      isiYolu: 'Aktif soğutucu 160 W',
      detay: 'Ø2,4 × 3,0 m, 11,2 m³ ⇒ 4740 kg LCH₄. Sabatier 1,6 kg/gün üretir ⇒ dolum 8,1 yıl; gerçek görevde çoklu üretim ünitesi gerekir',
      kalite: 'Bu sayı ISRU\'nun asıl kısıtını gösterir: zaman',
    },
    why: 'Sabatier\'in ürünü. O₂ tankından ayrı; aradaki mesafe bir tasarım kararıdır, yerleşim planının kuralıdır.' },

  /* ADIM 7 — hatlar, iletişim, saha */
  { id: 'hat-o2', ad: 'O₂ hattı', sistem: 'hat', step: 7, mountsTo: 'tank-o2', arayuz: 'akiskan',
    massKg: 75, pos: [0.8, -4.8, 0.9], size: [9.0, 0.24, 0.24], sekil: 'hat', akiskan: 'O2',
    boru: { odM: 0.08, wallM: 0.002, malzeme: 'paslanmaz', ucNoktalar: ['tank-o2', 'hab-silindir'] },
    tech: {
      no: 'HB-FLU-100',
      malzeme: '316L paslanmaz, Ø80 × 2 mm',
      guc_W: 90,
      sicaklik_C: [-120, 60],
      baglanti: 'Tankta ve habitatta kuru bağlantı; ara bağlantı kaynaklı',
      detay: '12,9 m; iz ısıtıcı 90 W donmaya karşı. 4 mesnet (4,30 m arayla), sarkma 0,93 mm, 1 genleşme ilmeği (ΔT=110 K ⇒ 22,7 mm)',
      kalite: 'Renk bandı bilgi taşır, süs değil',
    },
    why: 'Tanktan habitata. Yerden yükseltilir (toz), her 4 m beşiğe oturur ve her 30 m\'de genleşme ilmeği yapar: gündüz-gece farkı 100 K\'yi geçer, düz boru çeker ve kopar.' },
  { id: 'hat-guc', ad: 'Güç hattı', sistem: 'hat', step: 7, mountsTo: 'reaktor', arayuz: 'elektrik',
    massKg: 154, pos: [4.0, -4.0, 0.7], size: [14.0, 0.18, 0.18], sekil: 'hat', akiskan: 'DC',
    boru: { odM: 0.06, wallM: 0.004, malzeme: 'bakir', ucNoktalar: ['reaktor', 'hab-silindir'] },
    tech: {
      no: 'HB-ELE-101',
      malzeme: 'Bakır iletken Ø60 × 4 mm, PTFE yalıtım',
      guc_W: 0,
      sicaklik_C: [-140, 90],
      baglanti: 'Reaktörde ve habitatta konnektör; kablo tavasında sarkmalı',
      detay: '16,9 m; 10 kWe @ 600 V DC ⇒ 16,7 A, iletken kaybı 42 W (%0,4). 7 mesnet (4,22 m), 1 genleşme ilmeği',
      kalite: 'Gergin çekilen kablo ısıl daralmada kopar — sarkma o payı taşır',
    },
    why: 'Reaktörden üsse. Kablo tavasında ve sarkmalı: gergin çekilen kablo ısıl daralmada kopar, sarkma o payı taşır.' },
  { id: 'anten-direk', ad: 'İletişim direği', sistem: 'iletisim', step: 7, mountsTo: 'platform', arayuz: 'ayirma',
    massKg: 210, pos: [-0.5, -8.4, 3.6], size: [0.5, 0.5, 7.2], sekil: 'direk',
    tech: {
      no: 'HB-COM-110',
      malzeme: 'CFRP tüp, Ti taban mafsalı',
      guc_W: 0,
      sicaklik_C: [-140, 80],
      baglanti: 'Platforma 4 × M16 taban plakası; üç gergi teli',
      detay: '7,2 m. Ufuk mesafesi √(2Rh) = √(2 × 3 389 500 × 7,2) = 6,99 km — direksiz (1,7 m göz) 3,4 km',
      kalite: 'Yükseklik doğrudan ufuk mesafesidir',
    },
    why: 'Yükseklik doğrudan ufuk mesafesidir; 7 m\'lik direk düz arazide görüş çizgisini birkaç kilometre uzatır.',
    ports: [{ ad: 'tepe', pos: [0, 0, 3.6], dir: [0, 0, 1], tur: 'DATA' }] },
  { id: 'anten-canak', ad: 'Dünya çanağı (2,4 m)', sistem: 'iletisim', step: 7, mountsTo: 'anten-direk', arayuz: 'mentese',
    massKg: 95, pos: [-0.5, -8.4, 7.6], size: [2.4, 2.4, 0.7], sekil: 'canak',
    tech: {
      no: 'HB-COM-111',
      malzeme: 'CFRP kabuk, ağ yansıtıcı',
      guc_W: 310,
      sicaklik_C: [-140, 90],
      veri_Mbps: 4.2,
      baglanti: 'Direk tepesine iki eksenli gimbal, 4 × M10',
      isiYolu: 'TWTA ısısı gövde radyatörüne',
      detay: 'Ø2,4 m, X bant, kazanç 46,5 dBi, huzme 0,9°. Dünya 2,7 AU\'da 4,2 Mbps; en yakın konumda 24 Mbps',
      kalite: 'Gimbal gezegen döndükçe kilidi korur',
    },
    why: 'Dünya\'yı izler; iki eksenli gimbal gezegen döndükçe kilidi korur. Dar huzme yüksek veri hızı demektir.' },
  { id: 'ruzgar-olcer', ad: 'Rüzgâr ölçer', sistem: 'iletisim', step: 7, mountsTo: 'anten-direk', arayuz: 'civata',
    massKg: 8, pos: [-0.5, -8.9, 6.2], size: [0.6, 0.6, 0.5], sekil: 'ruzgar',
    tech: {
      no: 'HB-MET-112',
      malzeme: 'Isıl telli anemometre, seramik gövde',
      guc_W: 6,
      sicaklik_C: [-120, 40],
      baglanti: 'Direğe kelepçe yatak, 2 × M6',
      detay: '0–40 m/s, ±0,3 m/s. Toz fırtınası uyarısı ve iniş penceresi için',
      kalite: 'Yalnız atmosferi olan gezegende gerçek — Ay\'da reddedilir',
    },
    why: 'Toz fırtınası uyarısı ve iniş penceresi için. Yalnız atmosferi olan gezegende gerçektir; Ay\'da ölçülecek rüzgâr yoktur.' },
  { id: 'garaj', ad: 'Gezgin tentesi', sistem: 'yapi', step: 7, mountsTo: 'platform', arayuz: 'ayirma',
    massKg: 520, pos: [-9.8, -4.6, 1.8], size: [6.0, 4.4, 3.4], sekil: 'tente',
    tech: {
      no: 'HB-STR-120',
      malzeme: 'Al kafes, kumaş örtü, Ø0,12 m ayaklar',
      guc_W: 0,
      sicaklik_C: [-140, 60],
      baglanti: 'Platforma 4 × regolit vidası; örtü gergili',
      detay: '6,0 × 4,4 × 3,4 m. Basınçlı DEĞİL: basınçlı garaj hem pahalı hem gereksiz. Örtü tozu ve gece ışımasını keser, şarj kablosu altından gelir',
      kalite: 'Kapatmadan korumak — en ucuz çözüm',
    },
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

/* ── teknik bütçeler ──────────────────────────────────────────────────
   Künyedeki sayılar toplandıklarında kapanmak ZORUNDA. Kapanmıyorsa ya
   tasarım ya beyan yanlıştır; denetim ikisini ayırt edemez ama sessiz
   kalmaz. */

/** Kesilebilir yükler: fırtınada ve gecede kapatılabilenler. */
export const KESILEBILIR = Object.freeze(
  PARTS.filter(p => p.tech?.kesilebilir).map(p => p.id));

/**
 * Güç bütçesi, ÜÇ durum için. Negatif `guc_W` üretim, pozitif tüketimdir.
 *
 * Asıl mühendislik sorusu "gündüz yetiyor mu" değil: Mars'ta toz fırtınası
 * haftalarca güneşi keser. Üssün yaşaması, PANELLER SIFIRKEN kritik yükün
 * yalnız fisyonla karşılanmasına bağlıdır. Kesilebilir yükler (sera, ISRU,
 * toz temizleme) o sırada kapanır — üretim durur, mürettebat yaşar.
 */
export function powerBudget() {
  let uretimGunes = 0, uretimFisyon = 0, kritik = 0, kesilebilir = 0;
  const kalemler = [];
  for (const q of PARTS) {
    const g = q.tech?.guc_W ?? 0;
    if (!g) continue;
    const n = q.qty ?? 1;
    const W = g * n;
    if (W < 0) {
      if (q.sistem === 'guc' && q.id.startsWith('panel')) uretimGunes += -W;
      else uretimFisyon += -W;
    } else if (q.tech.kesilebilir) kesilebilir += W;
    else kritik += W;
    kalemler.push({ id: q.id, ad: q.ad, W, adet: n, kesilebilir: Boolean(q.tech.kesilebilir) });
  }
  const uretim = uretimGunes + uretimFisyon;
  const tuketim = kritik + kesilebilir;
  return {
    uretimGunesW: uretimGunes, uretimFisyonW: uretimFisyon, uretimW: uretim,
    kritikW: kritik, kesilebilirW: kesilebilir, tuketimW: tuketim,
    /* gündüz: her şey açık */
    gunduz: { uretimW: uretim, yukW: tuketim, payW: uretim - tuketim, pay: (uretim - tuketim) / uretim },
    /* gece: güneş yok, ISRU ve sera kapalı, fisyon sürüyor */
    gece: { uretimW: uretimFisyon, yukW: kritik, payW: uretimFisyon - kritik, pay: (uretimFisyon - kritik) / uretimFisyon },
    /* fırtına: panel %20'ye düşer, kesilebilir yük kapanır */
    firtina: {
      uretimW: uretimFisyon + uretimGunes * 0.2, yukW: kritik,
      payW: uretimFisyon + uretimGunes * 0.2 - kritik,
      pay: (uretimFisyon + uretimGunes * 0.2 - kritik) / (uretimFisyon + uretimGunes * 0.2),
    },
    kalemler: kalemler.sort((a, b) => Math.abs(b.W) - Math.abs(a.W)),
  };
}

/** Mürettebat varsayımı — bütün yaşam bütçeleri buna göre. */
export const MURETTEBAT = 4;

/**
 * Basınçlı hacim. Yaşanabilir hacim, geçiş ve üretim hacimlerini İÇERMEZ:
 * hava kilidinde yaşanmaz, tünelde oturulmaz, serada uyunmaz.
 */
export function volumeBudget(kisi = MURETTEBAT) {
  const gecis = new Set(['hava-kilidi', 'tunel']);
  const uretimHacmi = new Set(['sera']);
  let toplam = 0, yasanabilir = 0;
  const kalemler = [];
  for (const q of PARTS) {
    const v = q.tech?.hacim_m3;
    if (!v) continue;
    toplam += v;
    const sinif = gecis.has(q.id) ? 'geçiş' : uretimHacmi.has(q.id) ? 'üretim' : 'yaşanabilir';
    if (sinif === 'yaşanabilir') yasanabilir += v;
    kalemler.push({ id: q.id, ad: q.ad, m3: v, sinif });
  }
  return {
    toplamM3: Number(toplam.toFixed(1)),
    yasanabilirM3: Number(yasanabilir.toFixed(1)),
    kisiBasiM3: Number((yasanabilir / kisi).toFixed(1)),
    kisi,
    kalemler: kalemler.sort((a, b) => b.m3 - a.m3),
  };
}

/**
 * ISRU: yerinde üretilen oksijen mürettebatın solumasını karşılıyor mu?
 * Solunum 0,84 kg O₂/kişi-gün (ağır iş dahil).
 */
export const O2_KISI_GUN = 0.84;
export function isruBudget(kisi = MURETTEBAT) {
  let o2 = 0, ch4 = 0, h2o = 0, gida = 0;
  const kaynaklar = [];
  for (const q of PARTS) {
    const u = q.tech?.uretim;
    if (!u) continue;
    const n = q.qty ?? 1;
    o2 += (u.O2_kg_gun ?? 0) * n;
    ch4 += (u.CH4_kg_gun ?? 0) * n;
    h2o += (u.H2O_kg_gun ?? 0) * n;
    gida += (u.gida_kg_gun ?? 0) * n;
    kaynaklar.push({ id: q.id, ad: q.ad, ...u });
  }
  const solunum = kisi * O2_KISI_GUN;
  return {
    kisi, kaynaklar,
    O2UretimKgGun: Number(o2.toFixed(2)),
    O2SolunumKgGun: Number(solunum.toFixed(2)),
    O2PayKgGun: Number((o2 - solunum).toFixed(2)),
    O2Yeterli: o2 >= solunum,
    CH4KgGun: Number(ch4.toFixed(2)),
    H2OKgGun: Number(h2o.toFixed(2)),
    gidaKgGun: Number(gida.toFixed(2)),
  };
}

/**
 * Isıl kapanış. Radyatör kapasitesi BEYAN EDİLEN geometriden hesaplanır
 * (εσT⁴ × alan), künyeye yazılan bir sayıdan değil. Atılacak ısı, kritik
 * ve kesilebilir bütün elektrik yükünün toplamıdır: elektrik eninde
 * sonunda ısıya döner.
 */
export const SIGMA = 5.670374419e-8;
export function thermalBudget({ T_C = 27, eps = 0.85, env = 'mars' } = {}) {
  const T = T_C + 273.15;
  const d = partById('radyator-dizisi');
  const n = d.qty ?? 1;
  /* Kanat sayısı KÜNYEDEN gelir; çizim de aynı sayıyı okur, ayrışamazlar. */
  const kanat = d.tech?.kanat ?? 2;
  const alan = d.size[0] * d.size[2] * kanat * n;
  /* Radyatör yalnız ışımaz, ışıma da ALIR. Düşey duran bir kanat yarı
     görüşüyle zemini, yarısıyla gökyüzünü görür; ikisi de geri ışır ve
     NET atımı düşürür. Bu terimi atlamak kapasiteyi %20 fazla gösteriyordu
     (124,8 m² için 48,7 kW yazmıştım; ortam düşülünce 37,9 kW). */
  const ortam = env === 'mars'
    ? { zemin: 230, gok: 170 }        // Mars: ince atmosfer, ılık regolit
    : { zemin: 250, gok: 3 };         // Ay: gündüz sıcak regolit, gök = uzay
  const geri = 0.5 * Math.pow(ortam.zemin, 4) + 0.5 * Math.pow(ortam.gok, 4);
  const kapasite = eps * SIGMA * (Math.pow(T, 4) - geri) * alan;
  const guc = powerBudget();
  /* Reaktörün kendi atık ısısı kendi şemsiyesine gider, üs ilmeğine değil. */
  const atilacak = guc.tuketimW;
  return {
    T_C, eps, env, kanatSayisi: kanat * n, alanM2: Number(alan.toFixed(1)),
    ortamGeriIsimaK: Number(Math.pow(geri, 0.25).toFixed(1)),
    kapasiteW: Math.round(kapasite),
    atilacakW: Math.round(atilacak),
    payW: Math.round(kapasite - atilacak),
    pay: (kapasite - atilacak) / kapasite,
    kapaniyor: kapasite >= atilacak,
  };
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
