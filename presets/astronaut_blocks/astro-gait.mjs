/* astro-gait.mjs — YÜRÜYÜŞ: açılar elle değil, yerden ve yerçekiminden çıkar.
 *
 * NEDEN BÖYLE
 * ───────────
 * Bir yürüyüşü kare kare açı yazarak kurmak iki hatayı garanti eder: ayak
 * yere girer, ve basma evresinde ayak yerde KAYAR (buz üstünde yürüyormuş
 * gibi). İkisi de elle düzeltilemez, çünkü sebep açının kendisidir.
 *
 * Burada ters yönde çalışılır. Önce AYAĞIN nerede olduğu söylenir - basma
 * evresinde yere çivilidir, salınımda bir yay çizer - sonra kalça ve diz
 * açıları iki uzuvlu ters kinematikle ÇÖZÜLÜR. Ayak kaymaz çünkü kaymaması
 * varsayım değil, girdi.
 *
 * Gövdenin yüksekliği de serbest değil: basan bacak ters sarkaç gibi
 * çalışır ve gövde onun üstünden AŞAR. Kalça yüksekliği basan ayaktan
 * çıkar, o yüzden düşey salınım bir süs değil sonuçtur - basma ortasında
 * en yüksek, çift destekte en alçak.
 *
 * NEDEN APOLLO EKİBİ SIÇRAYARAK YÜRÜDÜ
 * ────────────────────────────────────
 * Sarkaç yürüyüşünün sınırı Froude sayısıdır:  Fr = v² / (g·L)
 * L bacak boyu. Basan bacak bir ters sarkaçtır ve gövde onun üstünden
 * dönerken gereken merkezcil ivme v²/L'dir; bu yerçekiminin sağlayabildiğini
 * aşınca ayak yerden kesilir. Geçiş Fr ≈ 0,5'te olur.
 *
 *   Dünya  g = 9,807   geçiş hızı 2,12 m/s   kendiliğinden seçilen 1,50 m/s
 *   Mars   g = 3,721   geçiş hızı 1,31 m/s   kendiliğinden seçilen 0,92 m/s
 *   Ay     g = 1,624   geçiş hızı 0,86 m/s   kendiliğinden seçilen 0,61 m/s
 *
 * Modelin Dünya için verdiği 1,50 m/s, insanların gerçekten seçtiği
 * 1,4 m/s ile aynı büyüklüktedir - model bu yüzden uydurma değil.
 * Ay'da 0,86 m/s eşiği o kadar düşüktür ki normal yürüme hızı ZATEN geçişin
 * üstündedir: mürettebat yürüyemez, sıçrar. Apollo kayıtlarındaki "loping"
 * budur ve burada bir animasyon tercihi değil, bu eşiğin sonucudur.
 *
 * SINIR
 * ─────
 * Bu kinematik bir modeldir, dinamik değil: kas kuvveti, giysi mafsalının
 * direnci ve dengenin kendisi çözülmez. Uçuş evresinde gövde parabol çizer
 * ve parabolün başlangıç hızı süreklilikten alınır; basma yayının gerçek
 * düşey hızıyla tam eşleşmez.
 */

import { EKLEMLER, POZ_EKLEM, sinirla, AYAK_ON_M, AYAK_ARKA_M,
         GOVDE_KAPSULU } from './astro-parts.mjs';

/** Yüzey yerçekimi (m/s²). Kaynak: standart gezegen değerleri. */
export const YERCEKIMI = Object.freeze({
  ay: 1.624, mars: 3.721, dunya: 9.807,
});
export const ORTAM_ADI = Object.freeze({
  ay: 'the Moon', mars: 'Mars', dunya: 'Earth',
});

/** Yürüyüş → koşu/sıçrama geçişinin Froude sayısı. */
export const GECIS_FROUDE = 0.5;
/** İnsanın kendiliğinden seçtiği hızın Froude sayısı. */
export const DOGAL_FROUDE = 0.25;

/** Froude sayısı: boyutsuz hız. */
export const froude = (hizMs, g, bacakM) => (hizMs * hizMs) / (g * bacakM);
/** Verilen Froude sayısına karşılık gelen hız. */
export const froudeHizi = (fr, g, bacakM) => Math.sqrt(fr * g * bacakM);

/**
 * Bir ortam ve hız için yürüyüşün bütün sayıları.
 * Hız verilmezse kendiliğinden seçilen hız kullanılır.
 */
export function yuruyusFizigi(ortam, bacakM, hizMs = null, olcu = null) {
  const g = YERCEKIMI[ortam] ?? YERCEKIMI.dunya;
  const gecisHiz = froudeHizi(GECIS_FROUDE, g, bacakM);
  const dogalHiz = froudeHizi(DOGAL_FROUDE, g, bacakM);
  const hiz = hizMs == null ? dogalHiz : hizMs;
  const fr = froude(hiz, g, bacakM);

  /* BOYUTSUZ ADIM BOYU: adım / bacak boyu. Adım süresini sarkaç yarım
     periyodundan (pi*sqrt(L/g)) almak Dünya'da 1,73 m'lik bir adım veriyordu -
     1,10 m'lik bir bacakla geometrik olarak imkânsız, ve cadans gerçeğin
     yarısı (57/dk, gerçeği ~110) çıkıyordu. Sınırlayan şey sarkacın periyodu
     değil, bacağın AÇILABİLDİĞİ kadar açılması: adım boyu Froude ile artar
     ve geometriyle sınırlanır.

     SINAMA: Dünya'da kendiliğinden seçilen hızda model 0,91 m adım ve
     109 adım/dk verir; ölçülen insan değerleri 0,76 m ve 105-115/dk. */
  const adimOrani = Math.min(1.15, 0.55 + 0.55 * Math.sqrt(fr));
  const adimBoyu = adimOrani * bacakM;
  const adimSure = adimBoyu / Math.max(hiz, 1e-3);
  const dogalAdimSure = Math.PI * Math.sqrt(bacakM / g);

  /* Görev oranı (bir ayağın yerde kaldığı kesir). Yürüyüşte > 0,5 - iki ayak
     da bir süre yerdedir. Fr geçişi aşınca uçuş başlar ve oran 0,5'in altına
     iner; sıçrama budur. */
  const tip = fr < GECIS_FROUDE ? 'yuruyus' : 'sicrama';
  const gorevOrani = tip === 'yuruyus'
    ? 0.62 - 0.12 * (fr / GECIS_FROUDE)
    : Math.max(0.3, 0.5 - 0.35 * (fr - GECIS_FROUDE));
  /* Uçuş süresi: iki basma evresi arasında kalan boşluk. */
  const ucusSure = Math.max(0, (0.5 - gorevOrani)) * 2 * adimSure;
  /* Uçuşta gövdenin yükselmesi: v0 = g*t/2, tepe = g*t²/8. */
  const ucusYukselme = g * ucusSure * ucusSure / 8;

  const F = {
    ortam, ad: ORTAM_ADI[ortam] ?? ortam, g, bacakM,
    hiz, froude: fr, gecisHiz, dogalHiz, tip,
    adimSure, adimBoyu, cadans: 60 / adimSure, gorevOrani,
    ucusSure, ucusYukselme,
    /* Ayak yerden ne kadar kalkar: düşük yerçekiminde salınan bacağı
       indirmek uzun sürer, o yüzden mürettebat ayağını daha yükseğe atar. */
    adimOrani,
    /* Ayak yerden ne kadar kalkar: uzun adım yüksek kaldırma ister, ve
       düşük yerçekiminde salınan bacağı indirmek uzun sürdüğü için
       mürettebat ayağını daha yükseğe atar. */
    ayakAcikligi: Math.min(0.30, 0.04 + 0.16 * adimOrani + 0.4 * ucusYukselme),
  };
  /* GİYSİ YÜRÜYÜŞÜ SINIRLAR. Ölçüler verilirse, çözümün istediği açıların
     beyan edilen mafsal açıklığına SIĞDIĞI doğrulanır ve sığmıyorsa ayak
     açıklığı düşürülür. Sığdırmadan bırakmak, kırpılan dizin bileği
     çözümün söylediği yerden 90-177 mm ayırmasına yol açıyordu - ve o
     sapma, salınan ayağın burnunu yere sokuyordu. Gerçekte olan da budur:
     basınçlı bir giyside mürettebat ayağını o kadar yükseğe atamaz. */
  if (olcu && olcu.uylukM && olcu.baldirM) {
    /* GİYSİ YÜRÜYÜŞÜ SINIRLAR. Çözümün istediği açılar beyan edilen mafsal
       açıklığına sığmak ZORUNDA; sığmayınca ters kinematik kırpılıyor ve
       bilek çözümün söylediği yerden 90-177 mm ayrılıyordu - salınan ayağın
       burnu da o sapmayla yere giriyordu.
       İlk sığdırma yalnız DİZE bakıyordu ve diz zaten sınırın altındaydı
       (70-96° / 104°); kısıtlayan eklem KALÇAYDI - Ay'da 1,2 m/s'de çözüm
       -34..+88° istiyor, giysi -28..+72 veriyor. Kalça salınımını belirleyen
       şey adım boyu, dizi belirleyen şey ayak açıklığıdır, o yüzden hangisi
       taşıyorsa o küçülür.
       Sonuç fiziksel olarak doğru ve ilginç: aynı hızda giysili mürettebat
       daha KISA ve daha SIK adım atar, çünkü kalçası o kadar açılmaz. */
    const kSin = EKLEMLER['kalca.L'].range, dSin = EKLEMLER['diz.L'].range;
    const ihlal = (Fx) => {
      let kalca = 0, diz = 0;
      for (let i = 0; i < 48; i++) {
        const faz = i / 48;
        const hz = kalcaYuksekligi(faz, Fx, olcu.uylukM + olcu.baldirM);
        for (const of2 of [0, 0.5]) {
          const a = ayakKonumu(faz + of2, Fx);
          const c = bacakIK(a.x, a.z - hz, olcu.uylukM, olcu.baldirM);
          kalca = Math.max(kalca, c.kalca - kSin[1], kSin[0] - c.kalca);
          diz = Math.max(diz, c.diz - dSin[1], dSin[0] - c.diz);
        }
      }
      return { kalca, diz, en: Math.max(kalca, diz) };
    };
    for (let n = 0; n < 60; n++) {
      const iz = ihlal(F);
      if (iz.en <= 0.05) break;
      if (iz.diz > iz.kalca && F.ayakAcikligi > 0.05) {
        F.ayakAcikligi *= 0.92;
      } else if (F.adimBoyu > 0.25) {
        F.adimBoyu *= 0.955;
        F.adimSure = F.adimBoyu / Math.max(F.hiz, 1e-3);
        F.cadans = 60 / F.adimSure;
        F.adimOrani = F.adimBoyu / bacakM;
        F.ayakAcikligi = Math.min(F.ayakAcikligi, 0.04 + 0.16 * F.adimOrani);
      } else break;
    }
    const son = ihlal(F);
    F.mafsalTasma = son.en;
    F.sigdirildi = son.en <= 0.05;
  }
  return F;
}

/**
 * İKİ UZUVLU TERS KİNEMATİK (yan düzlem).
 * Kalçadan ayak bileğine olan vektör verilir, kalça ve diz FLEKSİYONU
 * derece olarak döner. `FLEKS` sözleşmesiyle uyumludur: ikisi de pozitif.
 *
 * @param dx  ileri (+x) fark, m
 * @param dz  düşey fark (ayak kalçanın altındadır, yani negatif), m
 */
export function bacakIK(dx, dz, uylukM, baldirM) {
  const enUzun = (uylukM + baldirM) * 0.995;
  let d = Math.hypot(dx, dz);
  /* Erişilemeyen hedef bacağı kopartır; kırpmak, dizi tam açmak demektir. */
  const enKisa = Math.abs(uylukM - baldirM) + 1e-4;
  d = Math.max(enKisa, Math.min(enUzun, d));
  const cosG = (uylukM * uylukM + baldirM * baldirM - d * d) / (2 * uylukM * baldirM);
  const g = Math.acos(Math.max(-1, Math.min(1, cosG)));
  const diz = Math.PI - g;                       // düz bacak = 0
  const alfa = Math.atan2(dx, -dz);              // kalça→ayak çizgisinin düşeyle açısı
  const cosB = (uylukM * uylukM + d * d - baldirM * baldirM) / (2 * uylukM * d);
  const beta = Math.acos(Math.max(-1, Math.min(1, cosB)));
  const kalca = alfa + beta;                     // uyluk çizginin ÖNÜNDE
  const DER = 180 / Math.PI;
  return { kalca: kalca * DER, diz: diz * DER };
}

/**
 * Bir bacağın FAZINDAKİ ayak konumu (kalçaya göre, gövde x = 0'da sabit).
 * Basma evresinde ayak yere çivilidir ve geriye kayar - gövde ilerler,
 * ayak durur. Salınımda bir yay çizer.
 */
export function ayakKonumu(faz, F) {
  const D = F.gorevOrani, A = F.adimBoyu;
  const u = ((faz % 1) + 1) % 1;
  if (u < D) {
    /* BASMA: ayak yerde. Öne basılır, gövde üstünden geçer, arkada kalkar. */
    const s = u / D;
    /* `basmaFaz`: basma evresinin NERESİNDE olduğumuz (0 temas, 1 kalkış).
       Temas tepkisi buna ihtiyaç duyar ve onu yeniden hesaplamak, aynı
       sayıyı iki yerde tutmak olurdu. */
    return { x: A * (0.5 - s), z: 0, basiyor: true, basmaFaz: s };
  }
  /* SALINIM: ayak kalkar, öne gider, iner. */
  const s = (u - D) / (1 - D);
  const yumusak = 0.5 - 0.5 * Math.cos(Math.PI * s);   // uçlarda yavaş
  return {
    x: A * (-0.5 + yumusak),
    z: F.ayakAcikligi * Math.sin(Math.PI * s),
    basiyor: false, basmaFaz: -1,
  };
}

/**
 * Kalçanın YÜKSEKLİĞİ. Basan bacak bir ters sarkaçtır: gövde onun üstünden
 * aşar, o yüzden yükseklik basan ayaktan ÇIKAR - basma ortasında en yüksek,
 * çift destekte en alçak. Uçuş evresinde parabol.
 */
export function kalcaYuksekligi(faz, F, erisimM) {
  const enUzun = erisimM * 0.995;
  const ayaklar = [ayakKonumu(faz, F), ayakKonumu(faz + 0.5, F)];
  /* KISIT HER AYAK İÇİN GEÇERLİ. Kalça, hiçbir ayaktan bacak boyundan uzak
     olamaz; havadaki ayak için kısıt yükseldiği kadar gevşer:
         hz <= z_i + sqrt(L² - x_i²)
     İlk yazışta yalnız BASAN ayaklar bakılıyor ve en büyüğü alınıyordu.
     Ayağın yere değdiği ANDA kalça hâlâ arkadaki bacağın yayındaydı ve
     öndeki bacak yetişemiyordu: ters kinematik kırpılıyor, bilek çözümün
     söylediği yerden 47 mm sapıyordu. En küçüğe geçmek de yetmedi, çünkü
     kısıtlayan ayak o anda henüz BASMIYORDU - havadaki ayağın kısıtını da
     saymak gerekiyordu. */
  const kisit = Math.min(...ayaklar.map(a =>
    a.z + Math.sqrt(Math.max(0, enUzun * enUzun - a.x * a.x))));
  if (ayaklar.some(a => a.basiyor)) return kisit;
  /* UÇUŞ: iki ayak da havada, gövde balistiktir. Kalkışta ve inişte
     yükseklik aynıdır (simetri), o yüzden v0 = g*t/2 ve tepe g*t²/8 kadar
     yukarıdadır. Kısıt yine de aşılamaz: bacak uzamaz. */
  const D = F.gorevOrani;
  const u = ((faz % 1) + 1) % 1;
  const basla = u < 0.5 ? D : 0.5 + D;
  const sure = 0.5 - D;
  const tau = sure > 1e-6 ? (u - basla) / sure : 0;
  const taban = Math.sqrt(Math.max(0, enUzun * enUzun - (F.adimBoyu / 2) ** 2));
  return Math.min(kisit, taban + F.ucusYukselme * 4 * tau * (1 - tau));
}

/**
 * Bir andaki BÜTÜN mafsal açıları. `POZLAR` ile aynı biçimde döner, yani
 * duran duruşlarla aynı yoldan uygulanır - animasyon ayrı bir kod yolu değil.
 *
 * @param faz   0..1 çevrim içindeki yer
 * @param F     yuruyusFizigi çıktısı
 * @param olcu  { uylukM, baldirM, bacakM }
 */
/**
 * AYAĞIN YUVARLANMASI. Bilek en dar mafsaldır ve tabanı yere düz tutmak için
 * gereken açı (kalça - diz) ona her zaman sığmaz. Sığmadığında gerçek ayak
 * düz kalmaz: hâlâ yerde olan ucu (burun ya da topuk) etrafında DÖNER ve
 * bilek o kadar yükselir. Kırpıp bırakmak tabanı yere gömüyordu - ölçülen
 * 12 ile 124 mm arası.
 *
 * @returns { aci, yukselme } bilek açısı (derece) ve bileğin yükselmesi (m)
 */
export function ayakYuvarlanma(ad, gerekenDeg) {
  const aci = sinirla(ad, gerekenDeg);
  const fark = (aci - gerekenDeg) * Math.PI / 180;
  if (Math.abs(fark) < 1e-9) return { aci, yukselme: 0 };
  /* Pozitif fark burnu aşağı çevirir: yerde kalan uç BURUNDUR, bilek
     burun mesafesi kadar yükselir. Negatifte topuk kalır. */
  const kol = fark > 0 ? AYAK_ON_M : AYAK_ARKA_M;
  return { aci, yukselme: kol * Math.abs(Math.sin(fark)) };
}

/**
 * ADIM GÜRÜLTÜSÜ — iki adım birbirinin aynı değildir.
 *
 * Ölçülen: çevrim birebir tekrar ediyordu. Gerçek yürüyüşte adım boyu ve
 * süresi %2-4 dalgalanır ve bir yürüyüşü CANLI yapan şey o küçük
 * düzensizliktir; tam tekrar, koşu bandındaki bir manken verir.
 *
 * DETERMİNİSTİK: aynı faz her zaman aynı gürültüyü verir. Her karede yeniden
 * çekilen bir sayı figürü yürütmez, TİTRETİR - ve kare hızına da bağlı
 * olurdu.
 *
 * Dalga birkaç asal periyodun toplamıdır: tek bir sinüs, gürültü değil ikinci
 * bir ritim olurdu ve göz onu hemen yakalar.
 */
export function adimGurultusu(faz, genlik = 0.03) {
  const a = Math.sin(faz * Math.PI * 2 * 1.0 + 0.7);
  const b = Math.sin(faz * Math.PI * 2 * 2.7 + 2.1) * 0.55;
  const c = Math.sin(faz * Math.PI * 2 * 4.3 + 4.9) * 0.3;
  return 1 + genlik * (a + b + c) / 1.85;
}

export function yuruyusPozu(faz, F, olcu) {
  const { uylukM, baldirM } = olcu;
  /* Erişim uzunluğu BURADA türetilir. Önce ayrıca verilen bir `bacakM`
     alanına bakılıyordu ve verilmediğinde kol genliği sessizce NaN oluyordu -
     figürün tamamı NaN'a dönüyor, ama ayak konumları doğru olduğu için
     denetimlerin çoğu bunu görmüyordu. Zaten elde olan sayıdan hesaplanan
     şey, girdi olarak istenmez. */
  const erisim = uylukM + baldirM;
  /* GÜRÜLTÜ VE TEMAS ÇÖKMESİ ÇÖZÜMÜN İÇİNDE. Bunlar `kalcaZ`ye SONRADAN
     eklenmişti ve ölçüm reddetti: bilek çözümün söylediği yerden 21-29 mm
     ayrıldı ve taban yere 29 mm girdi. `kalcaZ` yürüyüş çözümünün ÇIKTISIDIR;
     onu çözümden sonra oynatmak, bacakları başka bir yükseklik için çözüp
     figürü başka bir yüksekliğe koymaktır.
     Gürültü yalnız AŞAĞI yönde: kalçayı yükseltmek bacağın erişemeyeceği bir
     hedef üretir ve ters kinematik kırpılır. */
  const gurultuKat = Math.min(1, adimGurultusu(faz, 0.03));
  const g2 = adimGurultusu(faz + 0.37, 0.05);
  const onAyaklar = [0, 0.5].map((o) => ayakKonumu(faz + o, F));
  /* TEMAS TEPKİSİ. Ayak yere değdiğinde gövde biraz ÇÖKER; bunsuz figür yere
     konar gibi değil, yere değer gibi görünür. Ay'da yerçekimi Dünya'nın
     altıda biri, yani çökme de o oranda küçüktür - sayı ORTAMDAN gelir. */
  let temasCokme = 0;
  for (const a of onAyaklar) {
    const u = a.basmaFaz ?? -1;
    if (u >= 0 && u < 0.18) {
      temasCokme = Math.max(temasCokme,
        0.014 * Math.sqrt(Math.min(1, F.g / 9.807)) * Math.sin(Math.PI * u / 0.18));
    }
  }
  const hz = kalcaYuksekligi(faz, F, erisim) * gurultuKat - temasCokme;
  /* İki geçiş: önce açılar çözülür, sonra bileğin SINIRI uygulanır ve ayak
     yuvarlanarak bileği yükseltir; hedef o kadar yükselince kinematik bir
     kez daha çözülür. Tek geçiş, tabanı yere gömer. */
  const ayaklar = [0, 0.5].map((ofset) => ayakKonumu(faz + ofset, F));
  const bacak = [], bilek = [];
  for (let i = 0; i < 2; i++) {
    const a = ayaklar[i];
    /* YAY YÜKSEKLİĞİ ayrı tutulur: `a.z` bundan sonra BİLEĞİN yüksekliği
       olacak ve tabanın nerede olduğu profilden gelecek. */
    const yay = a.z;
    let c = bacakIK(a.x, a.z - hz, uylukM, baldirM);
    /* SABİT NOKTA. Bilek açısı bileğin yüksekliğini, yükseklik de açıyı
       belirler; ikisi birbirine bağlı. Sabit sayıda geçiş yapmak, `a.z` ile
       ona karşılık gelen açıyı tutarsız bırakıyordu - taban 12 mm gömülü ya
       da bilek çözümden 12 mm ayrı kalıyordu. Yakınsayana kadar dönülür. */
    let aci = 0;
    for (let gec = 0; gec < 8; gec++) {
      c.kalca = sinirla(POZ_EKLEM.kalca[i], c.kalca);
      c.diz = sinirla(POZ_EKLEM.diz[i], c.diz);
      const gereken = c.kalca - c.diz;
      aci = sinirla(POZ_EKLEM.ayak[i], gereken);
      /* ANAHTAR, EKLEM AÇISI DEĞİL DÜNYA EĞİMİDİR: tabanın ne kadar düştüğünü
         belirleyen şey ayağın YERE göre eğimi, yani kırpmanın bıraktığı
         farktır. Kırpma yokken sapma sıfırdır ve taban düzdür. */
      const zYeni = yay + (olcu.tabanDusme
        ? olcu.tabanDusme(aci - gereken) - olcu.botOfsetM : 0);
      if (Math.abs(zYeni - a.z) < 1e-7) break;
      a.z = zYeni;
      c = bacakIK(a.x, a.z - hz, uylukM, baldirM);
    }
    c.kalca = sinirla(POZ_EKLEM.kalca[i], c.kalca);
    c.diz = sinirla(POZ_EKLEM.diz[i], c.diz);
    bilek.push(aci);
    bacak.push(c);
  }
  /* Kol salınımı bacağın TERSİ fazdadır ve genliği adım boyuyla artar:
     kollar dengeyi tutar, süs değildir. */
  const genlik = Math.min(42, 14 + 60 * F.adimBoyu / erisim);
  const kolFaz = (o) => Math.sin(2 * Math.PI * (faz + o));
  /* Gövde hıza göre öne yatar; düşük yerçekiminde daha az, çünkü itme
     kuvveti küçüktür. */
  const egim = 4 + 8 * F.froude;
  /* GÖVDE TERS DÖNER. Yürürken omuzlar ve leğen düşey eksen etrafında
     BİRBİRİNE TERS döner; kol salınımının dengelediği açısal momentumu üreten
     şey budur ve bir yürüyüşü "gerçek" yapan en güçlü işaret odur. Yalnız
     bacakları sallamak, koşu bandındaki bir manken verir.

     Dönme yalnız ÜST gövdeye uygulanır, leğene değil: göreli hareket aynıdır
     ama ayak konumları bozulmaz - leğeni döndürmek basan ayağı yanlara
     kaydırır ve ters kinematiğin çözdüğü noktadan ayırır. */
  const donme = Math.min(11, 3 + 9 * F.adimOrani) * Math.sin(2 * Math.PI * faz);
  /* İKİNCİL HAREKET: hortum ve halat gövdeyi GECİKMELİ izler. Sönümlü bir
     takipçinin bir sinüse yanıtı, faz kaymış ve zayıflamış bir sinüstür -
     durum tutmaya gerek yok, doğrudan yazılır. Böylece kare hızından da
     bağımsızdır. */
  const gecikme = (kat, kayma) => kat * Math.min(11, 3 + 9 * F.adimOrani)
    * Math.sin(2 * Math.PI * (faz - kayma));
  /* ÇARPIŞMA TABLOSU ÖLÇÜMDEN GELİR, hesaptan değil.
     İlk deneme gövdeyi bir kapsülle modelleyip açılmayı geometriden
     türetiyordu ve ölçüm onu reddetti: çakışan faz sayısı 32'den 34'e ÇIKTI.
     Sebep açık - çözüm göremediği bir gövde hakkında akıl yürütüyordu.
     Deponun bu iş için zaten bir deseni var: taban profili kurulumda bir kez
     süpürülüp ölçülüyor ve yürüyüş o tabloyu okuyor. Burada da öyle:
     `olcu.omuzAcilma(fleks)` her omuz açısı için eli gövdeden çıkaran EN
     KÜÇÜK açılmayı verir ve o sayı figürün kendi geometrisinden ölçülmüştür. */
  const acilmaGerek = olcu.omuzAcilma ?? (() => 0);
  const omuzL = genlik * kolFaz(0.5), omuzR = genlik * kolFaz(0);
  const dirsekL = 26 + 14 * kolFaz(0.5), dirsekR = 26 + 14 * kolFaz(0);

  return {
    ad: F.tip === 'sicrama' ? 'Loping' : 'Walking',
    kalca: [bacak[0].kalca, bacak[1].kalca],
    diz: [bacak[0].diz, bacak[1].diz],
    omuz: [omuzL * g2, omuzR * g2],
    omuzAcilma: [acilmaGerek(omuzL, dirsekL), acilmaGerek(omuzR, dirsekR)],
    /* SALINIMIN UCUNDA DÖNME. Gerçek bir kol ileri giderken hafifçe içe,
       geri giderken dışa döner; tek eksende gidip gelen bir kol, bir
       sarkaçtır. */
    omuzDonme: [-10 * kolFaz(0.5), -10 * kolFaz(0)],
    onkolDonme: [-16 + 10 * kolFaz(0.5), -16 + 10 * kolFaz(0)],
    dirsek: [dirsekL, dirsekR],
    govdeEgim: egim,
    govdeDonme: donme,
    /* Baş SABİTLENİR: gövde dönerken bakış ileride kalır. Bir insan yürürken
       başını gövdesiyle birlikte sallamaz, gözü ufku takip eder. */
    basDonme: -donme * 0.85,
    ikincil: { hortum: gecikme(0.55, 0.09), halat: gecikme(0.8, 0.13) },
    /* Kalça yüksekliği: kök bu kadar yukarıdadır, ölçümle değil hesapla. */
    kalcaZ: hz,
    /* Ayak KONUMLARI - `ayak` DEĞİL. Bir duruş nesnesinde `ayak` alanı
       bilek AÇISIDIR (sayı); buraya ayak konumu (nesne) yazılınca
       `uygulaPoz` onu açı sanıp nesne * RAD yapıyor ve bütün figür NaN'a
       dönüyordu. Aynı addaki iki şey, aynı nesnede duramaz. */
    ayak: bilek,
    ayakKonum: ayaklar,
  };
}
