/* astro-body.mjs — giysinin BİÇİM dili (üç parçalı: kesit, süpürme, kapitone).
 *
 * NEDEN VAR
 * ─────────
 * Giysi ikinci kez çizildiğinde konvolüt mafsalları, yatakları ve sert üst
 * gövdesi vardı ama hâlâ bir SİLİNDİR YIĞINI gibi duruyordu, çünkü her gövde
 * bir DÖNEL YÜZEYDİ: `latheZ` bir profili eksen etrafında çevirir ve ne
 * çevirirsen çevir kesiti DAİREDİR.
 *
 * İnsan vücudunda hiçbir yerde daire kesit yoktur. Göğüs kafesi enine geniş,
 * önden arkaya sığdır. Uyluk kalçada yanlara yassı, dizde yuvarlaktır.
 * Ayak bileği enine basıktır. Bir giysi bu kesitleri KAPATIR, yuvarlamaz.
 *
 * İKİ GİYSİDEN ÇIKAN DERSLER
 * ──────────────────────────
 * Apollo A7L (yüzey giysisi, yumuşak gövde):
 *   · Silueti yapan şey basınç katmanı değil, üstündeki ITMG'nin ÇEVRESEL
 *     KAPİTONE bantlarıdır. Uzaktan bile kumaş okunur: düz bir tüp asla
 *     kumaş gibi görünmez, bantlı bir tüp hemen görünür.
 *   · Gövde yumuşaktır ve bele doğru toplanır; omuzdan aşağı düşen kumaş
 *     kolun üstünde KIRIŞIR - bu yüzden omuz bölgesi uzvun en kalın yeri.
 *   · Göğüste RCU (kumanda kutusu) ve ondan gövdeye giren İKİ hortum; sırtta
 *     köşeleri yuvarlatılmış dikdörtgen PLSS ve üstünde OPS.
 *   · Ay botu ayrı bir OVERSHOE'dur: giysinin botunun üstüne geçer, bu yüzden
 *     bilekten aşağısı belirgin şekilde daha KALINDIR ve tabanı geniştir.
 *
 * Interstellar Ranger EVA (kurgu, ama biçim dili tutarlı):
 *   · Gövde kesiti dar ve SÜPERELİPTİK - köşeleri yuvarlatılmış dikdörtgen.
 *     Bu, giysiyi zırh gibi değil GİYSİ gibi gösteren şey.
 *   · Panel dikişleri uzvu boyuna böler; kapitone enine, dikiş boyuna gider
 *     ve ikisinin kesişmesi yüzeye ölçek verir.
 *   · Kask dar bir kutu, geniş ön pencereli; kabarcık değil.
 *
 * NE SUNAR
 * ────────
 *   kesitNokta   süpereliptik kesit üzerinde bir nokta (p=2 elips, p→∞ kutu)
 *   supur        kesiti bir eksen boyunca değiştirerek YÜZEY üretir
 *   kapitoneKat  çevresel kapitone modülasyonu (A7L dersi)
 *   dikisKat     boyuna panel dikişi modülasyonu (Ranger dersi)
 *
 * Eksen sözleşmesi: yerel +Z YUKARI, süpürme t = 0 (tepe) → t = 1 (dip),
 * yani uzuv aşağı doğru kurulur - kalan kodun kullandığı sözleşmenin aynısı.
 */

/**
 * Süpereliptik kesit üzerinde bir nokta.
 * |x/w|^p + |y/d|^p = 1 eğrisi: p = 2 tam elips, p = 4 yuvarlatılmış
 * dikdörtgen, p = 1 baklava. Bir giysi gövdesi p ≈ 2,6'dır - ne boru ne kutu.
 */
export function kesitNokta(aci, w, d, p = 2) {
  const c = Math.cos(aci), s = Math.sin(aci);
  const k = 2 / p;
  return [
    Math.sign(c) * Math.abs(c) ** k * w,
    Math.sign(s) * Math.abs(s) ** k * d,
  ];
}

/**
 * ÇEVRESEL KAPİTONE — A7L'nin siluetini yapan şey.
 * `n` bant, `derinlik` kadar kabarık. Üçgen dalga kullanılır, kosinüs değil:
 * kapitone yumuşak bir dalgalanma değil, aralarında KIRIK olan düz panellerdir.
 */
export function kapitoneKat(t, n, derinlik) {
  if (!n || !derinlik) return 1;
  const u = (t * n) % 1;
  return 1 + derinlik * (1 - Math.abs(2 * u - 1) - 0.5);
}

/**
 * BOYUNA PANEL DİKİŞİ — Ranger'ın biçim dili.
 * Kesitin çevresinde `n` yerde içeri çeken ince oluk. Kapitone enine,
 * dikiş boyuna gider; ikisinin kesişmesi yüzeye ölçek verir ve bir uzvun
 * ne kadar kalın olduğu ancak o zaman okunur.
 */
export function dikisKat(aci, n, derinlik) {
  if (!n || !derinlik) return 1;
  const u = (aci * n / (Math.PI * 2)) % 1;
  const d = Math.abs(2 * ((u + 1) % 1) - 1);
  return 1 - derinlik * Math.max(0, 1 - d * 6);
}

/**
 * KUMAŞ KIRIŞIĞI. Kapitone bantları DÜZENLİDİR; gerçek kumaş değildir.
 * Basınçlı bir giysinin yüzeyinde bantların arasında küçük, düzensiz
 * buruşmalar olur ve bir yüzeyi "kumaş" yapan şey o düzensizliktir -
 * kusursuz tekrar, plastik görünür. Gürültü DETERMİNİSTİK: aynı giysi her
 * karede aynı kırışıkları taşır, yoksa yüzey titrer.
 */
export function kirisikKat(t, aci, frekans, genlik) {
  if (!frekans || !genlik) return 1;
  const a = Math.sin(t * frekans * 7.13 + aci * 3.0) * 0.6;
  const b = Math.sin(t * frekans * 11.7 - aci * 5.0 + 1.7) * 0.3;
  const c = Math.sin(t * frekans * 23.1 + aci * 2.0 + 0.4) * 0.15;
  return 1 + genlik * (a + b + c);
}

/**
 * SÜPÜRME GÖVDESİ — kesiti eksen boyunca değişen yüzey.
 *
 * `kesit(t)` her yükseklikte şunu döndürür:
 *   { w, d, p, ox, oy, kapitone, dikis }
 * w yarı-genişlik (y), d yarı-derinlik (x), p süpereliptik üs, ox/oy eksenin
 * o yükseklikteki KAYMASI (bir uzuv düz değildir: uyluk dışa, baldır içe
 * gider ve bacağın valgus açısı buradan çıkar).
 *
 * Dönen: THREE.BufferGeometry — normaller hesaplanmış, iki uç kapalı.
 */
export function supur(THREE, {
  boy, kesit, dilim = 16, halka = 22, kapakUst = true, kapakAlt = true,
}) {
  const poz = [], idx = [];
  const satir = dilim + 1;
  for (let i = 0; i <= dilim; i++) {
    const t = i / dilim;
    const k = kesit(t) || {};
    const w = Math.max(k.w ?? 0.01, 1e-4);
    const d = Math.max(k.d ?? w, 1e-4);
    const p = k.p ?? 2;
    const z = -t * boy;
    for (let j = 0; j < halka; j++) {
      const a = (j / halka) * Math.PI * 2;
      const kap = kapitoneKat(t, k.kapitone?.[0], k.kapitone?.[1]);
      const dik = dikisKat(a, k.dikis?.[0], k.dikis?.[1]);
      const kir = kirisikKat(t, a, k.kirisik?.[0], k.kirisik?.[1]);
      const [py, px] = kesitNokta(a, w * kap * dik * kir, d * kap * dik * kir, p);
      /* kesitNokta ilk bileşeni w ekseninde verir; giyside w = y (en),
         d = x (derinlik), çünkü bir gövde enine geniş önden sığdır. */
      poz.push((k.oy ?? 0) + px, (k.ox ?? 0) + py, z);
    }
  }
  for (let i = 0; i < dilim; i++) {
    for (let j = 0; j < halka; j++) {
      const a = i * halka + j;
      const b = i * halka + (j + 1) % halka;
      const c = (i + 1) * halka + j;
      const e = (i + 1) * halka + (j + 1) % halka;
      /* SARIM YÖNÜ. İlk yazışta `(a, c, b)` idi ve ölçüm normallerin
         tamamının İÇE baktığını gösterdi (144 içe, 0 dışa, iç çarpım -0,996):
         her süpürme gövdesi içeriden aydınlanıyor, yani BEYAZ giysi siyah
         çıkıyordu. Bu, deponun `latheZ` yardımcısının belgelediği tuzağın
         aynısı - nasel kaportası, Starship burnu ve sonda çanağı da aynı
         sebeple siyah çıkmıştı. Kapaklar da aynı yönü izler. */
      idx.push(a, b, c, b, e, c);
    }
  }
  /* Kapaklar: açık uçlu bir uzuv içi görünen bir boru olur. */
  const kapa = (satirIdx, z, ters) => {
    const merkez = poz.length / 3;
    const k = kesit(ters ? 1 : 0) || {};
    poz.push(k.oy ?? 0, k.ox ?? 0, z);
    for (let j = 0; j < halka; j++) {
      const a = satirIdx * halka + j;
      const b = satirIdx * halka + (j + 1) % halka;
      if (ters) idx.push(merkez, b, a); else idx.push(merkez, a, b);
    }
  };
  if (kapakUst) kapa(0, 0, false);
  if (kapakAlt) kapa(dilim, -boy, true);
  void satir;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(poz, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Bir uzvun kesit tarifini kısa yoldan kurar.
 * Uçlardaki ölçüler ve ortadaki ŞİŞME verilir; basınç kumaşı şişirir, bu
 * yüzden hiçbir uzuv iki ucu arasında doğrusal daralmaz.
 */
export function uzuvKesiti({
  ustW, ustD, altW, altD, p = 2.4, sis = 0.07, sisT = 0.5,
  kapitone = null, dikis = null, kirisik = null, egri = null,
}) {
  return (t) => {
    /* ŞİŞMENİN YERİ. Kas, uzvun ortasında değildir: baldırın kütlesi dizin
       hemen altında, uyluğunki kalçaya yakındır. Şişmeyi hep ortaya koymak
       her uzvu aynı fıçıya çevirir, ve bir silueti insan yapan şey tam bu
       asimetridir. `sisT` tepe noktasını söyler. */
    const u = t < sisT ? t / Math.max(sisT, 1e-6) : (1 - t) / Math.max(1 - sisT, 1e-6);
    const k = 1 + sis * Math.sin(Math.PI * 0.5 * Math.max(0, Math.min(1, u)) ** 0.8) ** 1.4;
    const e = egri ? egri(t) : null;
    return {
      w: (ustW + (altW - ustW) * t) * k,
      d: (ustD + (altD - ustD) * t) * k,
      p, kapitone, dikis, kirisik,
      ox: e ? e[0] : 0, oy: e ? e[1] : 0,
    };
  };
}

/**
 * Gövde kesiti: omuzda geniş, belde dar, önden arkaya HER ZAMAN daha sığ.
 * `omuzT` en geniş yerin nerede olduğunu söyler (0 = tepe).
 */
export function govdeKesiti({
  omuzW, omuzD, belW, belD, omuzT = 0.18, p = 2.7,
  boyunW = null, boyunD = null, boyunT = 0.20,
  kapitone = null, dikis = null, kirisik = null,
}) {
  return (t) => {
    /* BOYUN GİRİNTİSİ. Bunsuz kesit tepede omuzun %86'sı kadar kalıyordu ve
       gövde, boyun hizasında 0,56 m genişliğinde DÜZ bitiyordu: bir insan
       siluetini insan yapan daralma hiç oluşmuyordu. Geçiş smoothstep'tir,
       doğrusal değil - omuzla boyun arasındaki geçiş bir koni değil bir
       yamuktur ve köşeli bir omuz çizgisi figürü zırh gibi gösterir. */
    if (boyunW !== null && t < boyunT) {
      const u = t / boyunT;
      const k = u * u * (3 - 2 * u);
      return {
        w: boyunW + (omuzW - boyunW) * k,
        d: (boyunD ?? boyunW) + (omuzD - (boyunD ?? boyunW)) * k,
        p, kapitone, dikis, kirisik,
      };
    }
    /* Omuzdan bele geçiş: omuz hizasına kadar açılır, sonra kapanır. */
    const t2 = boyunW !== null ? (t - boyunT) / (1 - boyunT) : t;
    const u = t2 < omuzT ? t2 / omuzT : 1;
    const g = t2 < omuzT ? 0.86 + 0.14 * u : 1 - (t2 - omuzT) / (1 - omuzT);
    const gen = belW + (omuzW - belW) * Math.max(0, Math.min(1, g));
    const der = belD + (omuzD - belD) * Math.max(0, Math.min(1, g));
    return { w: gen, d: der, p, kapitone, dikis, kirisik };
  };
}
