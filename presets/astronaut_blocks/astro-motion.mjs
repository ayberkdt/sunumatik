/* astro-motion.mjs — HAREKET PARÇALARI: birleştirilebilir poz farkları.
 *
 * NEDEN VAR
 * ─────────
 * Duruşlar (`POZLAR`) tek karedir, yürüyüş (`astro-gait.mjs`) tek bir bütün
 * çevrimdir. Aradaki her şey - nefes, etrafa bakınma, eldivenini inceleme,
 * bir şeye uzanıp geri çekilme - tek tek yazılırsa her biri ayrı bir kod
 * yolu olur ve hiçbiri ötekiyle BİRLEŞMEZ. Oysa gerçek hareket üst üste
 * biner: mürettebat nefes alırken etrafına bakar, bakarken elini kaldırır.
 *
 * Burada her hareket bir POZ FARKI döndürür - mutlak bir duruş değil. Farklar
 * TOPLANIR (`harmanla`), sonuç `uygulaPoz`'a verilir ve orada her açı zaten
 * kendi ekleminin beyan edilen sınırından geçer. Böylece yeni bir birleşik
 * hareket yazmak, iki parçayı listeye koymaktan ibaret.
 *
 * GİYSİNİN DAYATTIĞI ŞEY
 * ──────────────────────
 * A7L'de kask GÖVDEYE SABİTTİR. Bir mürettebat sola bakmak için boynunu
 * değil ÜST GÖVDESİNİ çevirir; kask onunla birlikte döner. "Etrafa bakınma"
 * bu yüzden bir boyun eklemi değil, bel dönüşüdür - ve bu, giysinin en çok
 * hissedilen kısıtlarından biridir. Kaskın içindeki baş kendi içinde biraz
 * döner, ama vizör inikken bu dışarıdan görünmez.
 *
 * ZAMAN
 * ─────
 * Her parça `t` saniyeyi alır ve kendi süresine göre ilerler. Döngüsel
 * olanlar (nefes) sonsuza kadar sürer; tek seferlikler (bakınma, el
 * inceleme) 0'dan başlayıp 0'a DÖNER, yoksa iki hareket arasında görünür
 * bir sıçrama olur.
 */

/* Yumuşak giriş-çıkış: 0 → 1 → 0, uçlarda türevi sıfır. Bir hareketin
   başlaması ve bitmesi, ortasından daha çok belli eder. */
const zarf = (u) => {
  const k = Math.max(0, Math.min(1, u));
  return 0.5 - 0.5 * Math.cos(2 * Math.PI * k) >= 0 ? Math.sin(Math.PI * k) ** 2 : 0;
};
/* Yumuşak basamak: 0'dan 1'e, uçlarda türevi sıfır. */
const basamak = (u) => {
  const k = Math.max(0, Math.min(1, u));
  return k * k * (3 - 2 * k);
};

/**
 * NEFES HIZI METABOLİK HIZDAN ÇIKAR, uydurulmaz.
 *
 * Oksijen tüketimi V̇O2 = P / 20,5 kJ/L (oksijenin kalorik eşdeğeri).
 * Dakika ventilasyonu V̇E ≈ 20 · V̇O2 (dinlenme ve orta iş için geçerli
 * yaklaşım). Soluk hacmi giyside ~1,2 L'dir; basınçlı bir giyside göğüs
 * genişlemesi 5 mm'yi geçmez, o yüzden GÖRÜNEN şey göğsün şişmesi değil,
 * bütün gövdenin hafifçe yükselip omuzların açılmasıdır.
 *
 * 350 W'ta: V̇O2 ≈ 1,02 L/dk · V̇E ≈ 20,5 L/dk · ~17 soluk/dk.
 */
export const OKSIJEN_KJ_L = 20.5;
export const VENT_ORANI = 20;
export const SOLUK_HACMI_L = 1.2;
export function nefesHizi(metabolikW = 350) {
  const vo2 = (metabolikW * 60) / (OKSIJEN_KJ_L * 1000);   // L/dk
  const ve = VENT_ORANI * vo2;                              // L/dk
  return {
    vo2, ve, soluk: ve / SOLUK_HACMI_L,                     // soluk/dk
    periyot: 60 / (ve / SOLUK_HACMI_L),                     // s
  };
}

/**
 * HAREKET PARÇALARI.
 * Her biri `{ ad, sure, dongu, uygula(t, opt) → fark }`.
 * `fark` bir POZ FARKIDIR: alanları temel duruşa EKLENİR.
 */
export const HAREKETLER = Object.freeze({
  nefes: {
    ad: 'Breathing', dongu: true, sure: null,
    neden: 'Duran bir figür tamamen kıpırdamazsa ölü görünür. Basınçlı giyside göğüs 5 mm\'den fazla şişmez; görünen şey gövdenin hafif yükselmesi ve omuzların açılmasıdır. Hız metabolik hızdan çıkar.',
    uygula(t, { metabolikW = 350 } = {}) {
      const T = nefesHizi(metabolikW).periyot;
      const s = Math.sin(2 * Math.PI * t / T);
      /* Soluk alırken omuzlar hafif açılır, gövde milimetrik yükselir. */
      return {
        omuz: [-1.1 * s, -1.1 * s],
        govdeEgim: -0.55 * s,
        kalcaZOfset: 0.004 * s,
      };
    },
  },

  bakin: {
    ad: 'Looking around', dongu: false, sure: 5.2,
    neden: 'A7L kaskı GÖVDEYE SABİTTİR: mürettebat sola bakmak için boynunu değil üst gövdesini çevirir. Giysinin en çok hissedilen kısıtlarından biri budur ve bir boyun eklemiyle modellenemez.',
    uygula(t, { yon = 1 } = {}) {
      const u = t / this.sure;
      if (u >= 1) return {};
      /* İki yana bakış: önce bir yana, sonra ötekine, sonra öne. */
      const a = Math.sin(2 * Math.PI * u) * zarf(u);
      return {
        govdeDonme: 26 * a * yon,
        basDonme: -6 * a * yon,
        omuz: [3 * a * yon, -3 * a * yon],
      };
    },
  },

  elIncele: {
    ad: 'Inspecting a glove', dongu: false, sure: 6.4,
    neden: 'EVA sırasında eldiven en sık denetlenen parçadır: kesik ya da aşınma, görevin bittiği andır. Mürettebat elini göz hizasına kaldırır ve gövdesini ona çevirir - kask sabit olduğu için başka türlü bakamaz.',
    uygula(t, { el = 0 } = {}) {
      const u = t / this.sure;
      if (u >= 1) return {};
      const g = zarf(u);
      const omuz = [0, 0], dirsek = [0, 0];
      omuz[el] = 52 * g;
      dirsek[el] = 66 * g;
      return {
        omuz, dirsek,
        govdeDonme: (el === 0 ? 16 : -16) * g,
        govdeEgim: 5 * g,
        basDonme: (el === 0 ? -4 : 4) * g,
      };
    },
  },

  gogsuneBak: {
    ad: 'Checking the chest panel', dongu: false, sure: 5.0,
    neden: 'Basınç göstergesi göğüstedir ve mürettebat onu doğrudan göremez: kask sabittir, bakış açısı yetmez. Bilek aynasıyla okunur - o yüzden bir kol kalkar ve gövde hafifçe öne eğilir.',
    uygula(t) {
      const u = t / this.sure;
      if (u >= 1) return {};
      const g = zarf(u);
      return {
        omuz: [0, 44 * g], dirsek: [0, 88 * g],
        govdeEgim: 9 * g, govdeDonme: -8 * g,
      };
    },
  },

  selamla: {
    ad: 'Waving', dongu: false, sure: 4.6,
    neden: 'Kamera için el sallamak Apollo\'dan beri yapılan şey; omuz 100°\'nin üstüne çıkmaz çünkü giysi oraya kadar açılır.',
    uygula(t, { el = 0 } = {}) {
      const u = t / this.sure;
      if (u >= 1) return {};
      const g = basamak(Math.min(1, u * 3)) * (1 - basamak(Math.max(0, (u - 0.75) * 4)));
      const sallan = Math.sin(2 * Math.PI * u * 3) * g;
      const omuz = [0, 0], dirsek = [0, 0];
      omuz[el] = 98 * g;
      dirsek[el] = 24 * g + 16 * sallan;
      return { omuz, dirsek, govdeDonme: (el === 0 ? 6 : -6) * g };
    },
  },
});

export const HAREKET_IDLER = Object.freeze(Object.keys(HAREKETLER));

/**
 * FARKLARI TOPLAR. Temel duruşun üstüne, sırayla verilen parçaların farkları
 * eklenir. Dizi alanları (omuz, dirsek, kalca, diz) eleman eleman toplanır.
 *
 * Toplama SINIRLAMAZ: her açı zaten `uygulaPoz` içinde kendi ekleminin beyan
 * edilen açıklığından geçiyor, ve sınırı tek yerde tutmak iki yerde tutmaktan
 * güvenlidir.
 */
export function harmanla(temel, ...farklar) {
  const sonuc = { ...temel };
  for (const k of ['omuz', 'dirsek', 'kalca', 'diz', 'ayak']) {
    if (Array.isArray(temel[k])) sonuc[k] = temel[k].slice();
  }
  for (const f of farklar) {
    if (!f) continue;
    for (const [k, v] of Object.entries(f)) {
      if (Array.isArray(v)) {
        const t = sonuc[k] ?? [0, 0];
        sonuc[k] = t.map((x, i) => x + (v[i] ?? 0));
      } else if (typeof v === 'number') {
        sonuc[k] = (sonuc[k] ?? 0) + v;
      }
    }
  }
  return sonuc;
}

/**
 * BOŞTA DURMA ZAMANLAYICISI.
 *
 * Nefes hep çalar; arada bir jest seçilir. Jestler ARKA ARKAYA gelmez:
 * bitenle başlayan arasında en az `araMin` saniye durulur, yoksa figür
 * sürekli kıpırdayan bir şeye döner ki bu da ölü durmak kadar yanlıştır.
 *
 * Seçim deterministik bir sıradan gelir (tohumlu), böylece aynı sahne her
 * açılışta aynı şeyi yapar ve bir kusur tekrar üretilebilir.
 */
export function bostaZamanlayici({ tohum = 7, araMin = 3.5, araMaks = 9 } = {}) {
  let durum = 0;          // xorshift
  let s = tohum >>> 0 || 1;
  const rast = () => {
    s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
  const jestler = HAREKET_IDLER.filter((k) => !HAREKETLER[k].dongu);
  let aktif = null, baslangic = 0, sonrakiT = araMin + rast() * (araMaks - araMin);
  return {
    /** @returns { fark, aktif } */
    kare(t, opt = {}) {
      if (aktif) {
        const yerel = t - baslangic;
        if (yerel >= HAREKETLER[aktif].sure) {
          aktif = null;
          sonrakiT = t + araMin + rast() * (araMaks - araMin);
        } else {
          return { fark: HAREKETLER[aktif].uygula(yerel, opt), aktif };
        }
      } else if (t >= sonrakiT) {
        aktif = jestler[Math.floor(rast() * jestler.length) % jestler.length];
        baslangic = t;
        return { fark: HAREKETLER[aktif].uygula(0, opt), aktif };
      }
      void durum;
      return { fark: null, aktif: null };
    },
    /** Elle bir jest başlatır (düğmeden). */
    baslat(id, t) {
      if (!HAREKETLER[id] || HAREKETLER[id].dongu) return false;
      aktif = id; baslangic = t;
      return true;
    },
    get calan() { return aktif; },
  };
}
