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
 *  0,84 m. Tasarım niyeti 0,78 idi ve aradaki fark kolların kalınlığıydı —
 *  bir kapı açıklığı niyete göre değil, geçecek şeye göre ölçülür. */
export const OMUZ_M = 0.84;
/** Çalışma basıncı (kPa) ve karşılık gelen oksijen kısmi basıncı. */
export const BASINC_KPA = 29.6;

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
    pos: [0, 0, 0.98], size: [0.52, 0.32, 1.15], sekil: 'tulum',
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
    pos: [0, 0, 0.52], size: [0.46, 0.34, 1.02], sekil: 'altGovde',
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
    pos: [0.11, 0, 0.09], size: [0.16, 0.30, 0.18], sekil: 'cizme',
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
    pos: [0, 0, 1.30], size: [0.56, 0.38, 0.52], sekil: 'ustGovde',
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
    pos: [0.27, 0, 1.44], size: [0.13, 0.13, 0.09], sekil: 'yatak',
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
    pos: [0.30, 0, 1.16], size: [0.14, 0.14, 0.60], sekil: 'kol',
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
    pos: [0.32, 0, 0.84], size: [0.12, 0.10, 0.24], sekil: 'eldiven',
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
    pos: [0, -0.26, 1.30], size: [0.46, 0.22, 0.64], sekil: 'paket',
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
    pos: [0, -0.40, 1.12], size: [0.28, 0.12, 0.26], sekil: 'kutu',
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
    pos: [0, 0, 1.75], size: [0.30, 0.32, 0.30], sekil: 'kask',
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
    pos: [0, 0.02, 1.90], size: [0.34, 0.20, 0.10], sekil: 'lamba',
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
    pos: [0, 0.22, 1.34], size: [0.26, 0.10, 0.18], sekil: 'panel',
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
    pos: [0, 0.18, 1.06], size: [0.34, 0.14, 0.22], sekil: 'halat',
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
