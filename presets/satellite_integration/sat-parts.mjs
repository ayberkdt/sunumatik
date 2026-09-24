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
    tech: { no: 'SD-STR-001', malzeme: '7075-T73 alüminyum, sert eloksal', guc_W: 0, sicaklik_C: [-120, 120], baglanti: 'Kelepçe bandı, 937 mm arayüz; ön gerilme 28 kN', detay: '24 × M8 A286 cıvata, tork 24 N·m, tel emniyetli', kalite: 'Uçuş mirası: >40 fırlatma' },
    why: 'Fırlatıcıya bakan TEK yapısal yüzey. Kelepçe bandı burada açılır; uydunun bütün yükü bu çemberden geçer.' },
  { id: 'itki-tupu', ad: 'İtki tüpü (merkez silindir)', sistem: 'yapi', step: 1,
    mountsTo: 'ayirma-halkasi', arayuz: 'civata', massKg: 62, pos: [0, 0, -0.1], size: [0.86, 0.86, 1.96], sekil: 'silindir',
    tech: { no: 'SD-STR-002', malzeme: 'M55J/siyanat ester CFRP sargı, alüminyum petek uç halkalar', guc_W: 0, sicaklik_C: [-150, 130], baglanti: 'Uç halkalara 48 × M6 Ti perçin-cıvata', detay: 'Cidar 2,4 mm; eksenel yük yolu 6,2 g × 1124 kg = 68 kN', kalite: 'Burkulma emniyet payı 1,8' },
    why: 'Fırlatma yükünü ayırma halkasına indiren ana yol. Tank içine oturur; bütün paneller ona asılır.' },
  { id: 'alt-panel', ad: 'Alt panel (itki güvertesi)', sistem: 'yapi', step: 1,
    mountsTo: 'itki-tupu', arayuz: 'civata', massKg: 31, pos: [0, 0, -1.04], size: [1.72, 1.72, 0.03], sekil: 'panel',
    tech: { no: 'SD-STR-010', malzeme: 'Al petek çekirdek 25 mm, CFRP yüz levha 0,5 mm', guc_W: 0, sicaklik_C: [-140, 150], baglanti: 'İtki tüpüne 32 × M5, köşe braketleriyle', detay: 'Gömme ek parçalar (insert) motor ve itici ayak izlerinde yoğunlaştırılmış', kalite: 'Yanma ürünü dayanımı: Al kaplama' },
    why: 'Apogee motoru ve iticiler buraya bakar; egzoz yönü uydudan uzağa.' },

  /* ADIM 2 — itki: yapı kapanmadan ÖNCE girer */
  { id: 'yakit-tanki', ad: 'İtici tankı (MMH/NTO)', sistem: 'itki', step: 2,
    mountsTo: 'itki-tupu', arayuz: 'civata', massKg: 46, pos: [0, 0, -0.05], size: [0.74, 0.74, 1.3], sekil: 'tank',
    tech: { no: 'SD-PRP-020', malzeme: 'Ti-6Al-4V, diyaframlı', guc_W: 45, sicaklik_C: [10, 50], baglanti: '4 × kulak, M10 Ti cıvata; akışkan kuru bağlantı', detay: 'Isıtıcı: 3 × 15 W yama, yedekli termostat; MMH donma noktası −52 °C', kalite: 'Patlama emniyet payı 2,0' },
    why: 'Tüpün İÇİNE girer, çünkü sonra paneller kapanır ve bir daha yeri kalmaz. Kütle merkezine yakın olmalı: yakıt bittikçe merkez fazla kaymasın.' },
  { id: 'itici-yakit', ad: 'İtici (yakıt yükü)', sistem: 'itki', step: 2,
    mountsTo: 'yakit-tanki', arayuz: 'akiskan', massKg: 415, pos: [0, 0, -0.1], size: [0.7, 0.7, 1.15], sekil: 'gizli',
    tech: { no: 'SD-PRP-021', malzeme: 'MMH / NTO, karışım oranı 1,65', guc_W: 0, sicaklik_C: [10, 50], baglanti: 'Dolum-boşaltım valfi, çift conta', detay: '415 kg; Isp 318 s ⇒ Δv ≈ 1180 m/s (1124 kg yaş)', kalite: 'Hipergolik: ateşleyici yok' },
    why: 'Fırlatma kütlesinin üçte biri. Kuru kütleye DAHİL DEĞİLDİR; bütçede ayrı satırdır.' },
  { id: 'basinc-tanki', ad: 'Basınçlandırma tankı (He)', sistem: 'itki', step: 2,
    mountsTo: 'itki-tupu', arayuz: 'civata', massKg: 14, pos: [0.0, 0.0, 0.72], size: [0.42, 0.42, 0.42], sekil: 'kure',
    tech: { no: 'SD-PRP-022', malzeme: 'Ti liner + karbon sargı (COPV), helyum', guc_W: 0, sicaklik_C: [-20, 60], baglanti: '2 × kelepçe yatak, M8', detay: '310 bar; regülatör çıkışı 17 bar', kalite: 'Çevrim ömrü 4× görev' },
    why: 'Tank basıncını sabit tutar; yakıt aktıkça helyum yerini alır.' },
  { id: 'apogee-motoru', ad: 'Apogee motoru (490 N)', sistem: 'itki', step: 2,
    mountsTo: 'alt-panel', arayuz: 'civata', massKg: 11, pos: [0, 0, -1.28], size: [0.3, 0.3, 0.45], sekil: 'nozul',
    tech: { no: 'SD-PRP-030', malzeme: 'Nb-C103 lüle uzantısı, Ir/Re oda', guc_W: 15, sicaklik_C: [-30, 60], baglanti: 'Alt panele 8 × M6, ısıl yalıtım pulu', detay: '490 N itki; lüle genişleme oranı 300; ateşleme valfi 2 × 7,5 W', kalite: 'Toplam yanma 6000 s' },
    why: 'Transfer yörüngesinden hedef yörüngeye çıkaran tek büyük yakış. Ekseni kütle merkezinden geçmeli, yoksa her yakışta dönme momenti doğar.' },
  { id: 'iticiler', ad: 'İticiler (4 × 10 N)', sistem: 'itki', step: 2, qty: 4,
    mountsTo: 'alt-panel', arayuz: 'civata', massKg: 1.2, pos: [0.72, 0.72, -1.16], size: [0.1, 0.1, 0.22], sekil: 'nozul',
    tech: { no: 'SD-PRP-040', malzeme: 'Katalitik yatak, paslanmaz gövde', guc_W: 30, sicaklik_C: [-20, 80], baglanti: 'Köşe braketi, 4 × M4; kuru akışkan bağlantısı', detay: '4 × 10 N; yatak ısıtıcısı 7,5 W/adet, ateşlemeden önce 120 °C', kalite: 'Darbe sayısı >5×10⁵' },
    why: 'İstasyon tutma ve momentum boşaltma. Köşelerde çünkü kolu büyük olsun.' },
  { id: 'besleme-hatlari', ad: 'Besleme hatları ve valfler', sistem: 'itki', step: 2,
    mountsTo: 'yakit-tanki', arayuz: 'akiskan', massKg: 9, pos: [0, 0, -0.6], size: [0.8, 0.8, 0.5], sekil: 'boru',
    tech: { no: 'SD-PRP-050', malzeme: '6,35 mm Ti boru, orbital kaynak', guc_W: 24, sicaklik_C: [10, 60], baglanti: 'Kaynaklı; sökülmez — sızdırmazlık testi montajda', detay: 'İz ısıtıcı 24 W; helyum sızıntı sınırı 1×10⁻⁶ scc/s', kalite: 'Kaynak dikişi %100 radyografi' },
    why: 'Kaynaklı; sızdırmazlık testi bu adımda yapılır, panel kapandıktan sonra erişilemez.' },

  /* ADIM 3 — yan paneller (ekipman panele ÖNCEDEN entegre edilir) */
  { id: 'yan-panel-xp', ad: 'Yan panel +X', sistem: 'yapi', step: 3,
    mountsTo: 'itki-tupu', arayuz: 'kizak', massKg: 18, pos: [0.86, 0, -0.1], size: [0.03, 1.72, 1.9], sekil: 'panel',
    tech: { no: 'SD-STR-011', malzeme: 'Al petek 25 mm, gömülü ısı borusu', guc_W: 0, sicaklik_C: [-100, 90], baglanti: 'Köşe braketleri, 24 × M5', detay: 'Ekipman tezgâhta takılır; panel bir alt montaj olarak gelir', kalite: 'Düzlemsellik 0,3 mm' },
    why: 'Panel seviyesinde entegrasyon: kutular tezgâhta panele takılır, test edilir, sonra uyduya kayar. Uydunun içinde çalışmak pahalıdır.' },
  { id: 'yan-panel-xn', ad: 'Yan panel −X', sistem: 'yapi', step: 3,
    mountsTo: 'itki-tupu', arayuz: 'kizak', massKg: 18, pos: [-0.86, 0, -0.1], size: [0.03, 1.72, 1.9], sekil: 'panel',
    tech: { no: 'SD-STR-012', malzeme: 'Al petek 25 mm, gömülü ısı borusu', guc_W: 0, sicaklik_C: [-100, 90], baglanti: 'Köşe braketleri, 24 × M5', detay: 'Karşı yüz; kablaj geçişi için kenarda oluk', kalite: 'Düzlemsellik 0,3 mm' },
    why: 'Karşı panel; kanat ve SADA yükünü taşır.' },
  { id: 'radyator-yp', ad: 'Radyatör paneli +Y', sistem: 'isil', step: 3,
    mountsTo: 'itki-tupu', arayuz: 'kizak', massKg: 22, pos: [0, 0.86, -0.1], size: [1.72, 0.03, 1.9], sekil: 'panel',
    tech: { no: 'SD-THR-060', malzeme: 'OSR ayna kaplama (α=0,08 ε=0,80), Al taban', guc_W: 0, sicaklik_C: [-120, 80], baglanti: 'Panele 16 × M4, ısıl macun arayüzü', detay: 'Atım kapasitesi 1252 W @ 30 °C — 3,27 m² × εσT⁴ (ε=0,80); +Y yüzü Güneş görmez, bu yüzden emilen yük sıfır sayılır', kalite: 'OSR ömür bozunması <%10' },
    why: 'Uzayda soğutmanın tek yolu ışımadır. ±Y seçilir çünkü Güneş +X ekseninde döner; bu yüzeyler Güneş görmez.' },
  { id: 'radyator-yn', ad: 'Radyatör paneli −Y', sistem: 'isil', step: 3,
    mountsTo: 'itki-tupu', arayuz: 'kizak', massKg: 22, pos: [0, -0.86, -0.1], size: [1.72, 0.03, 1.9], sekil: 'panel',
    tech: { no: 'SD-THR-061', malzeme: 'OSR ayna kaplama (α=0,08 ε=0,80), Al taban', guc_W: 0, sicaklik_C: [-120, 80], baglanti: 'Panele 16 × M4, ısıl macun arayüzü', detay: 'Atım kapasitesi 1252 W @ 30 °C — 3,27 m² × εσT⁴ (ε=0,80); −Y yüzü Güneş görmez, bu yüzden emilen yük sıfır sayılır', kalite: 'OSR ömür bozunması <%10' },
    why: 'Çift radyatör: ısı yükü iki yüze bölünür ve biri Güneş görse bile diğeri çalışır.' },

  /* ADIM 4 — panel üstü ekipman */
  { id: 'batarya', ad: 'Batarya paketi (Li-ion)', sistem: 'guc', step: 4,
    mountsTo: 'radyator-yn', arayuz: 'isil', massKg: 38, pos: [0.3, -0.72, -0.45], size: [0.44, 0.2, 0.34], sekil: 'kutu',
    tech: { no: 'SD-PWR-070', malzeme: 'Li-ion 18650 hücre, 8s12p', guc_W: 380, sicaklik_C: [0, 35], baglanti: 'Panele 8 × M5, yalıtım altlığı', detay: '28,8 V, 78 Ah, 2,2 kWh; tutulma boşalma derinliği %55', kalite: 'Hücre eşitleme yedekli' },
    why: 'Gölgede tek kaynak. Radyatör panelinde çünkü sıcaklığı dar bir bantta tutulmalı; ısıl arayüz macunla kurulur.' },
  { id: 'pcdu', ad: 'Güç dağıtım ünitesi (PCDU)', sistem: 'guc', step: 4,
    mountsTo: 'radyator-yp', arayuz: 'civata', massKg: 21, pos: [-0.3, 0.72, -0.45], size: [0.4, 0.2, 0.3], sekil: 'kutu',
    tech: { no: 'SD-PWR-071', malzeme: 'Al 6061 kutu, iridit kaplama', guc_W: 85, sicaklik_C: [-25, 60], baglanti: 'Radyatör paneline 6 × M5, ısıl macun', detay: 'Verim %93 ⇒ 85 W ısı; 42 anahtarlı çıkış, aşırı akım korumalı', kalite: 'Çift bara, çapraz bağlı' },
    why: 'Kanatlardan geleni düzenler, bataryayı şarj eder, her yükü ayrı korur. Tek arıza noktası olmasın diye kablajı ikiz.' },
  { id: 'tepki-tekerlekleri', ad: 'Tepki tekerlekleri (4, piramit)', sistem: 'adcs', step: 4, qty: 4,
    mountsTo: 'alt-panel', arayuz: 'civata', massKg: 7.5, pos: [0.45, 0.45, -0.85], size: [0.26, 0.26, 0.16], sekil: 'tekerlek',
    tech: { no: 'SD-ACS-080', malzeme: 'Çelik rotor, seramik yatak, Al gövde', guc_W: 22, sicaklik_C: [-15, 50], baglanti: 'Piramit braketi, 4 × M6; titreşim yalıtımlı', detay: '4 adet, 0,2 N·m tork, 30 N·m·s depolama; 6000 dev/dak azami', kalite: 'Piramit: biri arızalansa 3 eksen korunur' },
    why: 'Dördü PİRAMİT dizilir: üçü yeter, dördüncüsü yedektir ve herhangi biri bozulsa üç eksen hâlâ kapanır.' },
  { id: 'yildiz-izleyici', ad: 'Yıldız izleyici (2)', sistem: 'adcs', step: 4, qty: 2,
    mountsTo: 'yan-panel-xn', arayuz: 'civata', massKg: 5.5, pos: [-0.92, 0.3, 0.55], size: [0.18, 0.18, 0.34], sekil: 'bafil',
    tech: { no: 'SD-ACS-081', malzeme: 'Ti optik tezgâh, Al gölgelik', guc_W: 12, sicaklik_C: [-30, 45], baglanti: 'İzostatik 3 nokta, M4 — panel eğilmesi optiğe geçmesin', detay: '2 adet, eksenler arası 90°; doğruluk 2″ (çapraz), 12″ (yuvarlanma)', kalite: 'Güneş dışlama açısı 30°' },
    why: 'Mutlak yönelimi yıldız alanından okur. İkisi farklı yöne bakar ki Güneş ya da Dünya birini kör ettiğinde diğeri görsün; bafıl kaçak ışığı keser.' },
  { id: 'imu', ad: 'Eylemsizlik ölçüm birimi', sistem: 'adcs', step: 4,
    mountsTo: 'itki-tupu', arayuz: 'civata', massKg: 4.2, pos: [0.25, 0.25, 0.1], size: [0.2, 0.2, 0.16], sekil: 'kutu',
    tech: { no: 'SD-ACS-082', malzeme: 'Halka lazer jiroskop bloğu', guc_W: 18, sicaklik_C: [-20, 55], baglanti: 'Kütle merkezine yakın, 4 × M5', detay: 'Sapma 0,003°/saat; yıldız izleyici kesildiğinde köprü kurar', kalite: 'Yedekli çift blok' },
    why: 'Yıldız izleyici arasında dönme hızını taşır. Yapının EN RİJİT yerine konur: esneme doğrudan ölçüm hatasıdır.' },
  { id: 'manyetik-cubuk', ad: 'Manyetik çubuklar (3)', sistem: 'adcs', step: 4, qty: 3,
    mountsTo: 'yan-panel-xp', arayuz: 'civata', massKg: 2.4, pos: [0.9, -0.4, 0.2], size: [0.06, 0.06, 0.5], sekil: 'cubuk',
    tech: { no: 'SD-ACS-083', malzeme: 'Permalloy çekirdek, bakır sargı', guc_W: 9, sicaklik_C: [-40, 70], baglanti: 'Panel kenarına kelepçe yatak, 2 × M4', detay: '3 adet, 150 A·m²; tekerlek doygunluğunu yakıtsız boşaltır', kalite: 'Artık mıknatıslanma <0,5 A·m²' },
    why: 'Tekerleklerin biriktirdiği momentumu Dünya manyetik alanına iterek boşaltır — yakıt harcamadan.' },
  { id: 'transponder', ad: 'Transponder ve TWTA', sistem: 'haberlesme', step: 4,
    mountsTo: 'radyator-yp', arayuz: 'isil', massKg: 16, pos: [0.3, 0.72, 0.3], size: [0.36, 0.2, 0.34], sekil: 'kutu',
    tech: { no: 'SD-TTC-090', malzeme: 'Al kutu, dalga kılavuzu çıkış', guc_W: 210, sicaklik_C: [-15, 55], baglanti: 'Radyatör paneline 6 × M5, dalga kılavuzu flanşı', detay: 'TWTA 120 W RF çıkış, verim %62; X bant', veri_Mbps: 150, kalite: 'Çift yedekli, anahtar matrisli' },
    why: 'Verici tüpü ısı üretir; doğrudan radyatöre oturur. Isıl arayüz olmadan kendi ısısında boğulur.' },

  /* ADIM 5 — üst güverte ve faydalı yük */
  { id: 'ust-panel', ad: 'Üst panel (faydalı yük güvertesi)', sistem: 'yapi', step: 5,
    mountsTo: 'itki-tupu', arayuz: 'civata', massKg: 26, pos: [0, 0, 0.86], size: [1.72, 1.72, 0.03], sekil: 'panel',
    tech: { no: 'SD-STR-013', malzeme: 'Al petek 25 mm, CFRP yüz levha', guc_W: 0, sicaklik_C: [-130, 120], baglanti: 'Yan panellere 28 × M5', detay: 'Faydalı yükün güvertesi; optik hizalama pimleri burada', kalite: 'Hizalama tekrarı 0,05 mm' },
    why: 'En son kapanan yapısal yüzey; altındaki her şeye erişim bu panel açıkken yapılır.' },
  { id: 'faydali-yuk', ad: 'Faydalı yük (optik gövde)', sistem: 'faydali', step: 5,
    mountsTo: 'ust-panel', arayuz: 'civata', massKg: 96, pos: [0, 0, 1.28], size: [0.7, 0.7, 0.8], sekil: 'silindir',
    tech: { no: 'SD-PLD-100', malzeme: 'Zerodur ayna, Invar tezgâh', guc_W: 620, sicaklik_C: [18, 22], baglanti: 'İzostatik 3 nokta bipod, M8 — yapı gerilmesi optiğe geçmez', isiYolu: 'Dedektör soğutucusu → ısı borusu → radyatör +Y (isi-borulari); gövde ısıtıcısı kapalı çevrim', detay: 'Odak 3,2 m; sıcaklık kararlılığı ±0,5 K gerekiyor, ısıtıcı kapalı çevrimli', veri_Mbps: 420, kalite: 'Dar sıcaklık bandı bütün ısıl tasarımı belirler' },
    why: 'Uydunun var olma nedeni. Üstte çünkü bakış yönü serbest kalmalı; yapıya üç noktadan izostatik bağlanır ki panel esnemesi optiği bozmasın.' },
  { id: 'faydali-elektronik', ad: 'Faydalı yük elektroniği', sistem: 'faydali', step: 5,
    mountsTo: 'ust-panel', arayuz: 'civata', massKg: 18, pos: [-0.45, 0.35, 0.98], size: [0.34, 0.26, 0.2], sekil: 'kutu',
    tech: { no: 'SD-PLD-101', malzeme: 'Al kutu, çok katlı arka pano', guc_W: 340, sicaklik_C: [-20, 55], baglanti: 'Üst panele 8 × M5, ısıl macun arayüzü', isiYolu: 'Gömülü ısı borusu → yan panel → radyatör −Y (isi-borulari)', detay: 'Kısa kablo için algılayıcının yanında ama ısıl olarak AYRIK: 340 W ısı borusuyla dışarı taşınır. 420 Mbps ham veri 4:1 sıkıştırılıp 105 Mbps olarak verilir', veri_Mbps: 105, sikistirma: 4, kalite: 'Sıcak yedekli sinyal işleme' },
    why: 'Algılayıcıdan gelen veriyi işler; kısa kablo için algılayıcının hemen yanında.' },

  /* ADIM 6 — ısıl kapanış */
  { id: 'isi-borulari', ad: 'Isı boruları', sistem: 'isil', step: 6,
    mountsTo: 'radyator-yp', arayuz: 'isil', massKg: 8, pos: [0, 0.8, -0.1], size: [1.6, 0.04, 1.7], sekil: 'boru',
    tech: { no: 'SD-THR-062', malzeme: 'Al oluklu boru, amonyak çalışma akışkanı', guc_W: 0, sicaklik_C: [-40, 70], baglanti: 'Panele gömülü, ısıl macunla; sökülmez', detay: '8 hat; taşıma kapasitesi 120 W·m/hat; yerçekimsiz kılcal dönüş', kalite: 'Donma-çözülme çevrimi >200' },
    why: 'Isıyı kutudan radyatöre TAŞIR. Pasiftir: içindeki akışkan buharlaşıp yoğuşur, pompa yoktur, bozulacak parçası yoktur.' },
  { id: 'mli', ad: 'MLI battaniyeleri', sistem: 'isil', step: 6,
    mountsTo: 'itki-tupu', arayuz: 'civata', massKg: 17, pos: [0, 0, -0.1], size: [1.8, 1.8, 2.0], sekil: 'kabuk',
    tech: { no: 'SD-THR-063', malzeme: '20 katmanlı aluminize Kapton + Dacron ağ', guc_W: 0, sicaklik_C: [-160, 150], baglanti: 'Cırt ve etiket bandı; EN SON takılır', detay: 'Efektif yayınım 0,02; her dikişte topraklama şeridi', kalite: 'Altındaki cıvatalara bir daha ulaşılamaz' },
    why: 'Yirmi kat metalize film; ışımayı keser. EN SON takılır çünkü altındaki her cıvataya erişim biter.' },
  { id: 'kablaj', ad: 'Kablaj demeti', sistem: 'kablaj', step: 6,
    mountsTo: 'itki-tupu', arayuz: 'elektrik', massKg: 34, pos: [0, 0, -0.2], size: [1.5, 1.5, 1.6], sekil: 'gizli',
    tech: { no: 'SD-HAR-110', malzeme: 'Gümüş kaplı bakır, PTFE yalıtım, Kapton bant', guc_W: 0, sicaklik_C: [-60, 85], baglanti: 'D-Sub ve dairesel konnektör; kablo tavası ve P kelepçe', detay: '1420 uç; yedek ve ana yollar FİZİKSEL olarak ayrı güzergâhta', kalite: 'Süreklilik ve yalıtım testi %100' },
    why: 'Kütlenin %3-4\'ü. Tek tek küçük, toplamı bir insan ağırlığı; bütçede unutulduğunda kuru kütle tutmaz.' },

  /* ADIM 7 — açılır elemanlar (fırlatmada katlı) */
  { id: 'sada-xp', ad: 'SADA tamburu +X', sistem: 'guc', step: 7,
    mountsTo: 'yan-panel-xp', arayuz: 'civata', massKg: 9, pos: [1.0, 0, 0.35], size: [0.22, 0.22, 0.24], sekil: 'silindir',
    tech: { no: 'SD-PWR-072', malzeme: 'Kayar halka, harmonik dişli', guc_W: 14, sicaklik_C: [-45, 70], baglanti: 'Yan panele 6 × M6; kızak arayüzü', detay: 'Sürekli dönüş; 2 güç + 4 sinyal halkası; 1 dev/gün', kalite: 'Fırça ömrü 3× görev' },
    why: 'Kanadı Güneş\'e dik tutan döner eklem; gücü ve veriyi kayar halkadan geçirir.' },
  { id: 'sada-xn', ad: 'SADA tamburu −X', sistem: 'guc', step: 7,
    mountsTo: 'yan-panel-xn', arayuz: 'civata', massKg: 9, pos: [-1.0, 0, 0.35], size: [0.22, 0.22, 0.24], sekil: 'silindir',
    tech: { no: 'SD-PWR-073', malzeme: 'Kayar halka, harmonik dişli', guc_W: 14, sicaklik_C: [-45, 70], baglanti: 'Yan panele 6 × M6; kızak arayüzü', detay: 'Karşı kanat; iki sürücü bağımsız', kalite: 'Fırça ömrü 3× görev' },
    why: 'Simetrik kanat; iki kanat birlikte döner ki uydu dengede kalsın.' },
  { id: 'kanat-xp', ad: 'Güneş kanadı +X (3 panel)', sistem: 'guc', step: 7,
    mountsTo: 'sada-xp', arayuz: 'menteşe', massKg: 31, pos: [3.0, 0, 0.35], size: [3.6, 1.5, 0.03], sekil: 'kanat',
    tech: { no: 'SD-PWR-074', malzeme: 'GaAs üçlü bileşim hücre, CFRP taşıyıcı', guc_W: -1450, sicaklik_C: [-150, 110], baglanti: 'SADA miline 4 × M6; menteşe + yay açılım', detay: '3 panel, 8,4 m²; verim %30 BOL, %26 EOL; açılım tek yönlü kilitli', kalite: 'Açılım yedekli pirotek' },
    why: 'Fırlatmada gövdeye katlı durur, yörüngede yanan tel serbest bırakır ve yay açar. Açılmazsa uydu birkaç saat içinde biter.' },
  { id: 'kanat-xn', ad: 'Güneş kanadı −X (3 panel)', sistem: 'guc', step: 7,
    mountsTo: 'sada-xn', arayuz: 'menteşe', massKg: 31, pos: [-3.0, 0, 0.35], size: [3.6, 1.5, 0.03], sekil: 'kanat',
    tech: { no: 'SD-PWR-075', malzeme: 'GaAs üçlü bileşim hücre, CFRP taşıyıcı', guc_W: -1450, sicaklik_C: [-150, 110], baglanti: 'SADA miline 4 × M6; menteşe + yay açılım', detay: 'Karşı kanat; toplam üretim 2900 W BOL', kalite: 'Açılım yedekli pirotek' },
    why: 'İkinci kanat; tek kanat açılırsa hem güç yarıya iner hem de güneş basıncı sürekli bir tork üretir.' },
  { id: 'hga-boom', ad: 'HGA kolu (boom)', sistem: 'haberlesme', step: 7,
    mountsTo: 'ust-panel', arayuz: 'menteşe', massKg: 6, pos: [0.55, -0.55, 1.1], size: [0.08, 0.08, 0.7], sekil: 'cubuk',
    tech: { no: 'SD-TTC-091', malzeme: 'CFRP tüp, Ti uç parçalar', guc_W: 0, sicaklik_C: [-140, 120], baglanti: 'Menteşe + kilit; fırlatmada katlı', detay: '1,8 m; ilk mod 12 Hz (tekerlek bandının dışında)', kalite: 'Kilit sensörü çift' },
    why: 'Çanağı gövdeden uzaklaştırır: hem gövde huzmeyi kesmesin hem de çanak serbest dönsün.' },
  { id: 'hga', ad: 'Yüksek kazançlı anten (1,2 m)', sistem: 'haberlesme', step: 7,
    mountsTo: 'hga-boom', arayuz: 'menteşe', massKg: 13, pos: [0.85, -0.85, 1.5], size: [1.2, 1.2, 0.3], sekil: 'canak',
    tech: { no: 'SD-TTC-092', malzeme: 'CFRP kabuk, ağ yansıtıcı', guc_W: 26, sicaklik_C: [-140, 120], baglanti: 'İki eksenli gimbal, M5; dalga kılavuzu döner bağlantı', detay: '1,2 m çanak; kazanç 43 dBi @ X bant; huzme 1,6°', veri_Mbps: 150, kalite: 'Gimbal kilitlenirse LGA üzerinden telemetri sürer' },
    why: 'Dar huzme, yüksek veri hızı — ama Dünya\'yı sürekli izlemek zorunda; iki eksenli gimbal bu yüzden var.' },
  { id: 'lga', ad: 'Düşük kazançlı antenler (2)', sistem: 'haberlesme', step: 7, qty: 2,
    mountsTo: 'yan-panel-xp', arayuz: 'civata', massKg: 1.1, pos: [0.9, 0.5, 0.75], size: [0.08, 0.08, 0.26], sekil: 'cubuk',
    tech: { no: 'SD-TTC-093', malzeme: 'Sarmal anten, radom', guc_W: 2, sicaklik_C: [-120, 110], baglanti: 'Panele 3 × M4', detay: 'Yarı küresel örtü; HGA kilidi kaybolsa da komut alınır', veri_Mbps: 0.064, kalite: 'Her durumda komut yolu — kurtarma kipi' },
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
/* ── teknik bütçeler ──────────────────────────────────────────────────
   Künyedeki sayılar bir süs değil: toplandıklarında kapanmak ZORUNDA.
   Kapanmıyorsa ya tasarım ya da beyan yanlıştır ve denetim ikisini de
   ayırt edemez — bu yüzden hatayı yüksek sesle bildirir. */

/** Güç bütçesi. Negatif `guc_W` ÜRETİM, pozitif TÜKETİMdir. */
export function powerBudget() {
  let uretim = 0, tuketim = 0;
  const kalemler = [];
  for (const p of PARTS) {
    const g = p.tech?.guc_W ?? 0;
    if (!g) continue;
    const n = p.qty ?? 1;
    const w = g * n;
    if (w < 0) uretim += -w; else tuketim += w;
    kalemler.push({ id: p.id, ad: p.ad, W: w, adet: n });
  }
  return {
    uretimW: uretim, tuketimW: tuketim,
    payW: uretim - tuketim,
    pay: uretim ? (uretim - tuketim) / uretim : 0,
    kalemler: kalemler.sort((a, b) => Math.abs(b.W) - Math.abs(a.W)),
  };
}

/**
 * Veri zinciri: faydalı yük HAM üretir, elektronik sıkıştırır, verici
 * indirir. Sıkıştırılmış hız indirme kapasitesini aşarsa veri birikir;
 * bu sessiz bir tasarım hatasıdır, denetim onu yakalar.
 */
export function dataBudget() {
  const ham = partById('faydali-yuk')?.tech?.veri_Mbps ?? 0;
  const elektronik = partById('faydali-elektronik')?.tech ?? {};
  const sikisik = elektronik.veri_Mbps ?? ham;
  const oran = elektronik.sikistirma ?? 1;
  const indirme = partById('hga')?.tech?.veri_Mbps ?? 0;
  const kurtarma = partById('lga')?.tech?.veri_Mbps ?? 0;
  return {
    hamMbps: ham, sikistirma: oran, sikisikMbps: sikisik,
    indirmeMbps: indirme, kurtarmaMbps: kurtarma,
    tutarli: Math.abs(sikisik - ham / oran) < 0.5,
    payMbps: indirme - sikisik,
    yeterli: indirme >= sikisik,
  };
}

/** Radyatör görevi gören parçalar — ısı yolunun bittiği yer. */
export const RADYATORLER = Object.freeze(['radyator-yp', 'radyator-yn']);

/**
 * Isıl yol denetimi. Anlamlı ısı üreten her kutu ya doğrudan bir radyatör
 * paneline bağlıdır ya da ısısının oraya NASIL gittiğini beyan eder. Beyan
 * yoksa ısı bir yere gitmiyor demektir: çizimde görünmeyen ama gerçekte
 * uyduyu pişiren türden bir hata. Denetim ilk koşumda faydalı yük
 * elektroniğini yakaladı — künyesi "radyatör paneline" diyordu ama katalog
 * onu üst panele bağlıyordu.
 */
export function thermalPaths(esikW = 50) {
  return heatSources(esikW).map(k => {
    const p = partById(k.id);
    const dogrudan = RADYATORLER.includes(p.mountsTo);
    const beyan = p.tech?.isiYolu || null;
    return { ...k, dogrudan, beyan, ok: dogrudan || Boolean(beyan) };
  });
}

/** Stefan–Boltzmann sabiti (W·m⁻²·K⁻⁴). */
export const SIGMA = 5.670374419e-8;

/**
 * Isıl kapanış: radyatörlerin atabildiği güç, atılması gereken güçten
 * büyük olmalı. Atılması gereken = elektrik tüketimi − RF olarak YAYILAN
 * güç (o ısıya dönmez, uzaya gider).
 *
 * Kapasite radyatörün BEYAN EDİLEN geometrisinden hesaplanır, künyeye
 * elle yazılan bir sayıdan değil. İlk künyede 340 W yazıyordu; aynı
 * panelin alanı ve kaplaması 1252 W veriyor — dört kat fark, ve o fark
 * yalnızca hesap yapılınca görünüyor.
 */
export function thermalClosure({ T_C = 30, rfW = 120 } = {}) {
  const T = T_C + 273.15;
  let kapasite = 0;
  const paneller = [];
  for (const id of RADYATORLER) {
    const p = partById(id);
    if (!p) continue;
    /* Panelin ışıyan yüzü en büyük iki boyutun çarpımıdır; üçüncüsü kalınlık. */
    const [a, b, c] = [...p.size].sort((x, y) => y - x);
    const alan = a * b;
    const eps = 0.80;                                   // OSR kaplama
    const W = eps * SIGMA * Math.pow(T, 4) * alan;
    kapasite += W;
    paneller.push({ id: p.id, alanM2: Number(alan.toFixed(3)), kalinlikM: c, W: Math.round(W) });
  }
  const guc = powerBudget();
  const atilacak = guc.tuketimW - rfW;
  return {
    T_C, rfW, paneller,
    kapasiteW: Math.round(kapasite),
    atilacakW: Math.round(atilacak),
    payW: Math.round(kapasite - atilacak),
    pay: (kapasite - atilacak) / kapasite,
    kapaniyor: kapasite >= atilacak,
  };
}

/** Isıl künye: sıcaklık bandı en DAR olan bileşen ısıl tasarımı belirler. */
export function thermalDriver() {
  let enDar = null;
  for (const p of PARTS) {
    const t = p.tech?.sicaklik_C;
    if (!t) continue;
    const genislik = t[1] - t[0];
    if (!enDar || genislik < enDar.genislik) enDar = { id: p.id, ad: p.ad, bant: t, genislik };
  }
  return enDar;
}

/** Isı üreten kutular: nereye bağlılar? */
export function heatSources(esikW = 50) {
  return PARTS.filter(p => (p.tech?.guc_W ?? 0) >= esikW)
    .map(p => ({ id: p.id, ad: p.ad, W: (p.tech.guc_W) * (p.qty ?? 1), baglandigi: p.mountsTo }))
    .sort((a, b) => b.W - a.W);
}

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
