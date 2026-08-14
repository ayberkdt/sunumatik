# Taktik kataloğu — belirti · neden · çare

Her taktik beş alan taşır: **Belirti** (gözlenebilir, mümkünse ölçülebilir),
**Neden olur** (mekanizma — kişisel beceri değil), **Çare** (tek emir),
**Nasıl doğrularsın** (ölçüm ya da göz testi; otomatikse doğrulayıcı kuralının
adı), **Kod** (kütüphane jetonlarıyla; kod anlamsızsa "kod yok, karar").

Jetonlar: `--color-canvas/surface/ink/muted/accent/accent-ink/rule/data-1..6`,
`--ramp-seq-1..5`, `--ramp-div-1..5` (`design-space-science-deck/presets/color_themes/palette-library.css`);
boşluk `--space-xs/sm/md/lg/xl`, destenin ilan ettiği ölçeğe bağlanır
(düzenler için `alignment-and-grid.md`'nin 8/16/24/40/64 ölçeği).

Doğrulayıcı: `node scripts/validate-design-tactics.mjs <deste.html>`.
Kural adları aşağıda `[kural: ad]` biçiminde geçer. Kural adı yoksa taktik
**göz testidir** — doğrulayıcı onu uydurmaz, sadece kontrol listesine yazar.

---

## A. Hizalama ve iskelet

### T-01 · Kalabalık arayüz → hizalama eksenlerini azalt

- **Belirti** — Bir slaytta 5'ten fazla benzersiz dikey kenar (sol ya da sağ
  x-koordinatı). Sayarsın: her metin bloğunun, kartın, grafiğin, alt bilginin
  sol kenarı kaç ayrı x değerinde başlıyor? Kalabalıklık hissi genelde eleman
  SAYISINDAN değil, eksen sayısından gelir.
- **Neden olur** — Elemanlar tek tek yerleştirilir, her biri kendi bağlamında
  doğru görünür; kimse hepsini üst üste bindirip bakmaz. Ortalama, `auto`
  kenar boşluğu ve "biraz içeri alalım" düzeltmeleri her seferinde yeni bir
  eksen doğurur.
- **Çare** — Eksen sayısını üçe indir: bir ana sol ızgara çizgisi, bir içerik
  girintisi, bir sağ hizalanan sayı sütunu; fazlası birleştirilir.
- **Nasıl doğrularsın** — Ekran görüntüsüne 12 sütunluk ızgarayı bindir, sol
  kenarları işaretle; 3'ten fazla küme varsa kes. Otomatik ön eleme:
  `[kural: alignment-axes]` satır içi `left/margin-left/padding-left`
  koordinatlarını ve slayt içindeki farklı `text-align` değerlerini sayar.
- **Kod** —
  ```css
  /* önce: her blok kendi girintisini uyduruyor */
  .lede   { margin-left: 18px; }
  .agenda { padding-left: 26px; }
  /* sonra: tek ızgara çizgisi, girinti jetonla */
  .slide > *      { margin-left: 0; }
  .slide .indent  { padding-left: var(--space-lg); }
  ```

### T-02 · Dengesiz düğmeler → optik hizalama

- **Belirti** — İçinde üçgen/ok/ikon olan düğmede etiket sağa kaymış görünür;
  simetrik dolgu (`padding: 0 24px`) verilmiş olmasına rağmen düğme "sola
  yatıyor". Ölçüt: ikonun görsel kütlesi kutusunun bir kenarında yoğunlaşıyorsa
  (üçgen, ok, oynat işareti) geometrik merkez optik merkeze eşit değildir.
- **Neden olur** — Tarayıcı sınırlayıcı KUTUYU hizalar, göz KÜTLEYİ hizalar.
  Üçgenin alanı tabanına yığılır; sivri ucun tarafında boşluk artar. Aynı
  mekanizma metinde de çalışır: büyük harf gövdesi cap-height ile hizalanır,
  ikon ise kutu ortasıyla.
- **Çare** — Düğmenin dolgusunu kütleye göre asimetrik ver, ikonu 1–3 px ağır
  tarafa kaydır ve etiketi cap-height'a hizala.
- **Nasıl doğrularsın** — Göz testi: düğmeyi %400 büyüt, ikon+etiket grubunun
  mürekkep alanını kabaca ikiye böl; orta çizgi düğme ortasında mı? Bir de
  ters test: düğmeyi çevir (`scaleX(-1)`), denge bozuluyorsa geometrik
  hizalıydı.
- **Kod** —
  ```css
  .btn { display: inline-flex; align-items: center; gap: var(--space-sm);
         padding: 14px 26px 14px 22px;      /* sağ dolgu > sol: ok sağda */
         background: var(--color-accent); color: var(--color-accent-ink);
         border-radius: 10px; }
  .btn__label { line-height: 1; }            /* cap-height hizası için */
  .btn__icon  { flex: none; width: 24px; height: 24px;
                transform: translateX(2px); }/* üçgenin sivri ucunu telafi et */
  .btn--play .btn__icon { transform: translateX(1.5px); } /* ▶ kütlesi solda */
  ```

### T-03 · İkon + etiket kayması → sınırlayıcı kutu değil optik merkez

- **Belirti** — 40 px ikon 24 px metnin yanında hafifçe yukarıda ya da aşağıda
  duruyor; `align-items: center` verilmiş ama satır "titriyor". Ölçüt: ikonun
  gövdesi (dolu piksellerin dikey aralığı) SVG viewBox'ın ortasında değilse.
- **Neden olur** — `align-items: center` kutu ortalar; ikon çiziminin çevresinde
  eşit olmayan şeffaf pay vardır ve metnin optik ortası x-height ile cap-height
  arasındadır, kutu ortasında değil.
- **Çare** — İkonu cap-height'ın ortasına oturt: `align-items: baseline` yerine
  merkezi elle telafi et.
- **Nasıl doğrularsın** — Göz testi: satırın üstünden ve altından yatay çizgi
  geçir, ikon ile büyük harfin üstü aynı çizgide mi? Kaymayı 1 px adımlarla
  düzelt, ölçüp bırak.
- **Kod** —
  ```css
  .agenda-row .icon { flex: none; width: 40px; height: 40px;
                      transform: translateY(-1px); } /* cap-height telafisi */
  ```

### T-04 · Grafik başlıktan içeri kaymış → plot alanını ızgaraya oturt

- **Belirti** — Grafiğin sol kenarı başlığın sol kenarından 30–60 px içeride;
  slaytta iki "sol" var. Ölçüt: SVG'nin dış kutusu ızgaraya hizalıysa ama
  y-ekseni etiketleri içeride kalıyorsa yanlış şeyi hizalamışsındır.
- **Neden olur** — Grafik kütüphanesi tüm çizimi (etiketler dahil) tek kutu
  sayar; ızgaraya bu kutu oturtulur, plot alanı ise etiket genişliği kadar
  içeri kayar.
- **Çare** — Plot alanının sol kenarını ızgara çizgisine hizala; tick etiketleri
  asılı noktalama gibi çizginin dışına taşsın.
- **Nasıl doğrularsın** — `[kural: alignment-axes]` ön eleme yapar; kesin karar
  ekran görüntüsünde ızgara bindirmesiyle verilir (`alignment-and-grid.md`).
- **Kod** —
  ```css
  .chart-wrap { margin-left: calc(-1 * var(--chart-gutter, 56px)); }
  .chart-wrap svg { overflow: visible; } /* etiketler dışarı assın */
  ```

### T-05 · Eş kartlar farklı yükseklikte → ızgara satırı + stretch

- **Belirti** — Yan yana üç kartın alt kenarları 8–40 px farklı; en kısa kart
  "eksik" görünüyor.
- **Neden olur** — Kartlar içerik yüksekliğine göre büyür; kopyayı yazan kişi
  ile düzeni kuran kişi aynı anda bakmaz.
- **Çare** — Eş kartları tek ızgara satırına koy ve `align-items: stretch`
  bırak; taşan kopyayı nota taşı.
- **Nasıl doğrularsın** — Göz testi + `card-treatments.md` eş-kart kuralı.
- **Kod** —
  ```css
  .card-row { display: grid; grid-auto-flow: column;
              grid-auto-columns: 1fr; gap: var(--space-md);
              align-items: stretch; }
  ```

### T-06 · Bozuk dikey ritim → taban çizgisi ızgarasına oturt

- **Belirti** — Slaytta boşluklar 13 px, 17 px, 22 px gibi ölçek dışı
  değerlerde. Ölçüt: dikey boşluk değerleri kümesi 8/16/24/40/64 ölçeğinin
  alt kümesi değilse.
- **Neden olur** — Boşluk, düzen kuralından değil "biraz daha aç" hissinden
  gelir; her düzeltme yeni bir sayı bırakır.
- **Çare** — Her dikey boşluğu ölçek jetonuna bağla; benzer görünen iki boşluk
  ya aynı olur ya da bir tam adım ayrılır.
- **Nasıl doğrularsın** — Göz testi + kaynak taraması: ölçek dışı `margin`/`gap`
  değerlerini ara.
- **Kod** —
  ```css
  :root { --space-xs: 8px; --space-sm: 16px; --space-md: 24px;
          --space-lg: 40px; --space-xl: 64px; }
  .slide { gap: var(--space-lg); }
  .stack > * + * { margin-top: var(--space-md); }
  ```

### T-07 · Her yerde eşit boşluk → yakınlık gruplaması

- **Belirti** — Başlık, alt başlık, gövde ve alt bilgi arasındaki boşluklar
  birbirine 4 px'den yakın; slayt tek bir düz liste gibi okunuyor.
- **Neden olur** — Tek bir `gap` değeri tüm hiyerarşiye uygulanır; ilişkili
  olanla olmayan aynı mesafede durur, göz gruplayamaz.
- **Çare** — İlişkili elemanları bir adım yaklaştır, grup aralarını iki adım aç.
- **Nasıl doğrularsın** — Göz testi (gözü kıs: kaç blok görüyorsun? Slaytın
  mantıksal grup sayısıyla eşleşmeli).
- **Kod** —
  ```css
  .kicker + h2      { margin-top: var(--space-xs); }  /* aynı grup */
  h2 + .lede        { margin-top: var(--space-sm); }
  .lede + .card-row { margin-top: var(--space-xl); }  /* grup arası */
  ```

---

## B. Tipografi ve okuma

### T-08 · Zayıf hiyerarşi → TEK boyutta kontrastı artır

- **Belirti** — Başlık ile gövde arasındaki fark hem punto hem ağırlık hem
  renkle kurulmuş, yine de "yassı" görünüyor. Ölçüt: bir hiyerarşi
  basamağında ikiden fazla değişken aynı anda değişiyorsa.
- **Neden olur** — Her değişken ayrı ayrı zayıf uygulanır (1.15× punto, +100
  ağırlık, biraz açık renk); üçü birden ne kontrast yapar ne de sistem kurar.
- **Çare** — Basamak başına TEK değişkeni sert değiştir: punto YA DA ağırlık
  YA DA renk.
- **Nasıl doğrularsın** — Ekranı gri tonlamaya al: hiyerarşi hâlâ okunuyorsa
  boyut/ağırlık taşıyordur; kayboluyorsa yalnız renge yaslanmışsın.
- **Kod** —
  ```css
  /* önce: üç değişken birden, hepsi zayıf */
  h2   { font-size: 40px; font-weight: 620; color: var(--color-ink); }
  .lede{ font-size: 34px; font-weight: 560; color: #5c5450; }
  /* sonra: boyut taşır, ağırlık ve renk sabit kalır */
  h2   { font-size: 66px; font-weight: 650; color: var(--color-ink); }
  .lede{ font-size: 33px; font-weight: 400; color: var(--color-muted); }
  ```

### T-09 · Tipografi ölçeği şişmiş → modüler ölçeğe indir

- **Belirti** — Deste genelinde 12'den fazla farklı punto. Ölçüt:
  `[kural: font-scale]` benzersiz `font-size` sayısını verir.
- **Neden olur** — Her slayt kendi taşma sorununu 1–2 px kırparak çözer;
  ölçek yok, sadece geçmiş düzeltmelerin izi var.
- **Çare** — Puntoları 6–8 basamaklı bir ölçeğe yuvarla ve jetonla; taşmayı
  kopyayı keserek çöz, punto uydurarak değil.
- **Nasıl doğrularsın** — `[kural: font-scale]` uyarı sayısı düşene kadar
  yuvarla.
- **Kod** —
  ```css
  :root { --fs-hero: 96px; --fs-h2: 66px; --fs-lede: 33px;
          --fs-body: 27px; --fs-small: 23px; --fs-caption: 21px; }
  ```

### T-10 · Uzun satır → 45–75 karakter ölçüsü

- **Belirti** — Gövde satırı 75 karakteri aşıyor; göz satır başını kaybediyor.
  Ölçüt: `karakter ≈ genişlik_px / (0.5 × punto_px)`.
- **Neden olur** — Genişlik slayt sahnesinden miras alınır (1920 px), metin
  bloğuna ayrıca `max-width` verilmez.
- **Çare** — Her gövde bloğuna karakter ölçüsünden türetilmiş bir `max-width`
  ver.
- **Nasıl doğrularsın** — `[kural: line-measure]` aynı kuralda hem `font-size`
  hem `max-width/width` bulunan seçicileri hesaplar.
- **Kod** —
  ```css
  .lede { font-size: 33px; max-width: calc(66ch); }  /* ≈ 66 karakter */
  ```

### T-11 · Ortalanmış gövde metni → okuma için sola yasla

- **Belirti** — İki satırdan uzun bir metin bloğu `text-align: center`.
- **Neden olur** — Ortalama boş slaytta "dengeli" görünür; asıl bedel her
  satırda kayan sol kenar, yani her satır başında yeni bir arama.
- **Çare** — Gövdeyi sola yasla; ortalamayı yalnız kahraman anlara bırak
  (başlık slaydı, tek denklem, tek figür).
- **Nasıl doğrularsın** — `[kural: centered-body]` küçük puntolu (≤40 px)
  ortalanmış kuralları işaretler.
- **Kod** —
  ```css
  .lede { text-align: left; }
  .slide--title .lede { text-align: center; } /* istisna, kural değil */
  ```

### T-12 · Küçük harfte harf aralığı → yalnız BÜYÜK HARFTE aç

- **Belirti** — Küçük harfli gövde ya da başlıkta pozitif `letter-spacing`;
  kelimeler dağılıyor, okuma yavaşlıyor.
- **Neden olur** — Yazı tipi küçük harf için zaten düzgün aralıklandırılmıştır;
  aralık ihtiyacı sadece büyük harfin eşit gövde genişliğinden doğar.
- **Çare** — Pozitif aralığı `text-transform: uppercase` taşıyan öğelere
  (kicker, etiket, eksen başlığı) sınırla; büyük başlıkta hafif NEGATİF aralık
  kullan.
- **Nasıl doğrularsın** — `[kural: lowercase-tracking]` pozitif
  `letter-spacing` taşıyıp `uppercase` taşımayan kuralları listeler.
- **Kod** —
  ```css
  .kicker { text-transform: uppercase; letter-spacing: .15em; }
  h1      { letter-spacing: -.04em; }   /* büyük puntoda sıkılaştır */
  .lede   { letter-spacing: 0; }
  ```

### T-13 · Başlıkta dul/öksüz satır → elle kırılma

- **Belirti** — İki satırlık başlığın ikinci satırında tek kelime kalmış.
- **Neden olur** — Otomatik sarma kutu genişliğine bakar, anlam birimine
  bakmaz.
- **Çare** — Başlığı anlam birimine göre elle kır ve son iki kelimeyi bağla.
- **Nasıl doğrularsın** — Göz testi; sunum dilinde başlıklar kısa olduğu için
  otomatik kural gürültü üretir.
- **Kod** —
  ```html
  <h2>Kalibrasyon medyan hatayı<br>yarıya&nbsp;indiriyor</h2>
  ```
  ```css
  h2 { text-wrap: balance; }  /* elle kırma yoksa en azından bunu ver */
  ```

### T-14 · Kart metni punto tabanının altına düşmüş → kopyayı kes

- **Belirti** — Kart gövdesi 28 px, kws 26 px, delta 24 px tabanlarının altında
  (canlı destede 19 px görüldü). Ölçüt: kart/panel seçicisinde `font-size`
  tabanın altındaysa.
- **Neden olur** — Kart taşınca en kolay düzeltme puntoyu kırpmaktır; taban
  belgede yazılıdır ama düzenleme anında görünmez.
- **Çare** — Taşan kartta puntoyu değil kopyayı kes; sığmıyorsa kart satırını
  böl.
- **Nasıl doğrularsın** — `[kural: type-floor]` kart/panel bağlamındaki taban
  altı puntoları bildirir (`enforce-slide-copy-density` tabanları).
- **Kod** — kod yok, karar: kopya budanır, `--card-body-size` düşürülmez.

---

## C. Renk, degrade ve yüzey

### T-15 · Sert degrade kenarı → yumuşatılmış (eased) degrade

- **Belirti** — İki duraklı `linear-gradient`'in ortasında gözle görülür bir
  bant/şerit; özellikle geniş alanlarda ve projeksiyonda. Ölçüt: durak sayısı 2
  ve iki renk arasındaki fark büyükse (koyu→açık, doygun→nötr).
- **Neden olur** — İki mekanizma üst üste biner: (1) tarayıcı duraklar
  arasında DOĞRUSAL enterpolasyon yapar, insan gözü ise ışıklılığı
  logaritmik algılar — orta bölge olduğundan hızlı geçer ve Mach bandı doğar;
  (2) karışım varsayılan olarak sRGB'de yapılır, birbirine tamamlayıcı iki
  renk ortada gri/kirli bir ara ton üretir. 8-bit çıktıda bu ayrıca posterize
  olur.
- **Çare** — Degradeyi çok duraklı bir easing eğrisine çevir, karışımı algısal
  uzayda yap ve geniş alanlarda hafif dither ekle.
- **Nasıl doğrularsın** — `[kural: hard-gradient]` iki duraklı ve renk farkı
  büyük olan `linear-gradient` bildirimlerini işaretler. Gözle: degradeyi
  %300 büyütüp ekran görüntüsünde yatay kesit al, bant görünürse yeniden
  yumuşat.
- **Kod** —
  ```css
  /* önce: iki durak — ortada bant */
  .scrim { background: linear-gradient(180deg,
             rgba(0,0,0,.85) 0%, rgba(0,0,0,0) 100%); }

  /* sonra: easing eğrisi (ease-out'a yaklaşan durak dizisi) */
  .scrim { background: linear-gradient(180deg,
             rgba(0,0,0,.85)  0%,
             rgba(0,0,0,.78)  19%,
             rgba(0,0,0,.62)  34%,
             rgba(0,0,0,.44)  47%,
             rgba(0,0,0,.27)  60%,
             rgba(0,0,0,.14)  73%,
             rgba(0,0,0,.05)  86%,
             rgba(0,0,0,0)   100%); }

  /* renk→renk geçişinde karışımı algısal uzaya taşı (destekleyen motorlarda) */
  .band { background: linear-gradient(in oklab, 90deg,
             var(--color-data-1), var(--color-data-2)); }
  ```
  Veri degradesi gerekiyorsa uydurma: `--ramp-seq-1..5` / `--ramp-div-1..5`
  duraklarını kullan — bunlar zaten algısal olarak dengelenmiştir.

### T-16 · Saf siyah / saf beyaz → halasyonu azalt

- **Belirti** — `#000` zemin üstünde `#fff` metin; harflerin kenarı
  projeksiyonda titriyor, ince çizgiler kayboluyor.
- **Neden olur** — Maksimum ışıklılık farkı gözde halasyon (parlama taşması)
  yaratır; projektör ve kamera bunu ayrıca abartır.
- **Çare** — Uçları kır: zemini biraz aç, mürekkebi biraz kıs — palet
  jetonlarını kullan.
- **Nasıl doğrularsın** — `[kural: pure-extremes]` `#000`/`#fff` ve
  `rgb(0,0,0)`/`rgb(255,255,255)` kullanımını bildirir.
- **Kod** —
  ```css
  /* önce */ .stage { background: #000; color: #fff; }
  /* sonra */ .stage { background: var(--color-canvas); color: var(--color-ink); }
  ```

### T-17 · Veri rengi dekoratif kullanılıyor → hue veri kodlamasına ayrılır

- **Belirti** — `--color-data-1` bir başlıkta, ikon dolgusunda ya da süs
  şeridinde geçiyor; aynı renk grafikte "Model A" demek.
- **Neden olur** — Palette güzel bir renk vardır ve semantik rolü belgede
  kalır, kullanım anında görünmez.
- **Çare** — Veri renklerini yalnız veri işaretlerine ve onların doğrudan
  etiketlerine ayır; dekorasyon `--color-accent` ve `--color-rule` ile yapılır.
- **Nasıl doğrularsın** — `[kural: data-color-decor]` `--color-data-*`
  değerinin metin/kenarlık/süs bağlamında geçtiği bildirimleri listeler.
- **Kod** —
  ```css
  /* önce */ .kicker::before { background: var(--color-data-2); }
  /* sonra */ .kicker::before { background: var(--color-accent); }
  .legend .swatch--a { background: var(--color-data-1); } /* meşru: veri */
  ```

### T-18 · Kirli/çamurlu deste → nötrleri denetle

- **Belirti** — Deste "ucuz" görünüyor ama tek bir suçlu bulunamıyor; aksan
  renkleri paletten.
- **Neden olur** — Sorun aksanda değil nötrlerdedir: yüzey ile zemin arasında
  tonu kaymış (biri sıcak, biri soğuk) gri katmanlar birikmiştir.
- **Çare** — Nötrleri tek bir ton ailesine bağla; ara gri üretme, `--color-rule`
  ve `--color-surface` dışına çıkma.
- **Nasıl doğrularsın** — Göz testi + kaynak taraması: palet jetonu olmayan
  `#rrggbb` gri değerlerini ara (`color-composition.md`, "dirty deck").
- **Kod** — kod yok, karar: her yeni nötr paletten türetilir.

### T-19 · Vurgu aşırı kullanımı → slaytta TEK baskın alan

- **Belirti** — Bir slaytta ikiden fazla aksan renkli alan (dolu düğme, dolu
  kart, aksan başlık, aksan kenarlık) yarışıyor.
- **Neden olur** — Vurgu eleman eleman eklenir; hiçbir adımda "bu slaytın
  bakılacak yeri neresi?" sorusu sorulmaz.
- **Çare** — Slayt başına bir baskın aksan alanı bırak, kalanını `--color-rule`
  ve `--color-muted` ile yatıştır.
- **Nasıl doğrularsın** — Göz testi: ekran görüntüsünü bulanıklaştır, ilk göze
  çarpan tek bir yer mi?
- **Kod** — kod yok, karar (70/20/10 dağılımı, `color-composition.md`).

### T-20 · Cam/blur panel → opak düzlem

- **Belirti** — `backdrop-filter: blur(...)` ya da yarı saydam üst üste
  paneller; metin altındaki içerikten etkileniyor.
- **Neden olur** — Saydamlık kompozisyon kurmanın kısayolu sanılır; gerçekte
  kontrastı öngörülemez kılar ve projeksiyonda kirlenir.
- **Çare** — Saydam paneli opak `--color-surface` düzlemine çevir, ayrımı
  `--color-rule` hairline ile yap.
- **Nasıl doğrularsın** — `[kural: glass-blur]` `backdrop-filter`/`filter: blur`
  kullanımını bildirir.
- **Kod** —
  ```css
  /* önce */ .panel { background: rgba(255,255,255,.14);
                      backdrop-filter: blur(18px); }
  /* sonra */ .panel { background: var(--color-surface);
                       border: 1.5px solid var(--color-rule); }
  ```

### T-21 · Neon/glow → ışıma yerine değer kontrastı

- **Belirti** — `0 0 Npx <doygun renk>` biçiminde `box-shadow`/`text-shadow`
  ya da geniş `drop-shadow`; metnin kenarı yumuşuyor.
- **Neden olur** — Işıma "teknolojik" görünür ama harf kenarını bulanıklaştırıp
  okunabilirliği düşürür; projeksiyonda hâle yayılır.
- **Çare** — Işımayı sil, ayrımı değer (açıklık) farkıyla kur.
- **Nasıl doğrularsın** — `[kural: neon-glow]` — bu kural HATA üretir
  (`design-space-science-deck` yasak listesi).
- **Kod** —
  ```css
  /* önce */ .tag { box-shadow: 0 0 24px #4de3ff; color: #4de3ff; }
  /* sonra */ .tag { background: var(--color-accent);
                     color: var(--color-accent-ink); }
  ```

---

## D. Bileşenler: kart, tablo, grafik, ikon

### T-22 · Tutarsız köşe yarıçapı → iç yarıçap = dış − dolgu

- **Belirti** — Deste genelinde 4'ten fazla farklı `border-radius`; iç içe
  kutularda iç köşe dış köşeye paralel değil ("bindirilmiş" görünür).
- **Neden olur** — Yarıçap tek tek seçilir; iç içe geçmede geometri kuralı
  (eşmerkezli yaylar) bilinmez.
- **Çare** — Yarıçapları 2–3 basamağa indir ve iç kutuya `dış − dolgu` ver.
- **Nasıl doğrularsın** — `[kural: radius-scale]` benzersiz yarıçap sayısını
  verir.
- **Kod** —
  ```css
  :root { --radius-panel: 14px; --radius-inner: 8px; --card-pad: 24px; }
  .panel     { border-radius: var(--radius-panel); padding: var(--card-pad); }
  .panel > * { border-radius: calc(var(--radius-panel) - var(--card-pad)); }
  /* negatife düşerse 0 kullan, "biraz yuvarlak" uydurma */
  ```

### T-23 · Her yerde gölge → en fazla iki yükseklik kademesi

- **Belirti** — Destede 3'ten fazla farklı `box-shadow` değeri; her kart kendi
  yüksekliğini iddia ediyor, katman düzeni kayboluyor.
- **Neden olur** — Gölge "ayırmak" için eklenir; ayırma işi aslında boşluk ve
  hairline'ın işidir.
- **Çare** — İki kademe tanımla (durgun kart, kaldırılmış/hover) ve üçüncüyü
  yasakla.
- **Nasıl doğrularsın** — `[kural: shadow-tiers]` benzersiz gölge sayısını
  verir.
- **Kod** —
  ```css
  :root { --elev-1: 0 1px 2px rgba(20,16,14,.08);
          --elev-2: 0 8px 20px rgba(20,16,14,.14); }
  .sci-card       { box-shadow: var(--elev-1); }
  .sci-card:hover { box-shadow: var(--elev-2); }
  ```

### T-24 · Ağır tablo → dikey çizgileri kaldır, yatay kural bırak

- **Belirti** — Tablo tam ızgara çizgili; hücre içeriğinden çok çizgi mürekkebi
  var.
- **Neden olur** — Elektronik tablo alışkanlığı; hizalama zaten sütunu
  tanımlarken çizgi ikinci kez aynı işi yapar.
- **Çare** — Dikey çizgileri kaldır, başlık altına ve satır aralarına ince
  yatay kural bırak; sayıları sağa yasla.
- **Nasıl doğrularsın** — Göz testi (`table-treatments.md`).
- **Kod** —
  ```css
  .sci-table { border-collapse: collapse; }
  .sci-table td, .sci-table th { border: 0;
      border-bottom: 1px solid var(--color-rule); padding: 14px 18px; }
  .sci-table thead th { border-bottom: 2px solid var(--color-ink); }
  .sci-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
  ```

### T-25 · Uzak lejant → doğrudan etiketleme

- **Belirti** — Grafiğin üstünde/yanında renk kutucuklu lejant; okuyucu her
  seride bir gidip gelmek zorunda. Ölçüt: seri sayısı ≤ 5 ve seriler uçlarında
  ayrışıyorsa lejant gereksizdir.
- **Neden olur** — Grafik kütüphaneleri varsayılan olarak lejant çizer.
- **Çare** — Lejantı kaldır, seri adını serinin ucuna kendi renginde yaz.
- **Nasıl doğrularsın** — Göz testi; renk körlüğü kontrolü de burada yapılır
  (etiket varsa renk tek başına taşımaz).
- **Kod** —
  ```html
  <text x="1290" y="212" fill="var(--color-data-1)"
        font-size="24" font-weight="700">Model A</text>
  ```

### T-26 · Grafikte 3B / eğim süsü → düz kodlama

- **Belirti** — Çubukta degrade, pastada kalınlık, çizgide gölge; veriyle
  ilgisi olmayan derinlik.
- **Neden olur** — Varsayılan tema "zengin" görünsün diye süsler; süs, uzunluk
  algısını bozar ve alan/hacim yanılsaması yaratır.
- **Çare** — İşaretleri düz doldur; degradeyi yalnız gerçek bir sürekli
  değişken kodluyorsa (`--ramp-seq-*`) kullan.
- **Nasıl doğrularsın** — `[kural: hard-gradient]` grafik bağlamındaki iki
  duraklı degradeleri yakalar; kalanı göz testi.
- **Kod** —
  ```css
  .bar { fill: var(--color-data-1); }      /* düz */
  .heat-4 { fill: var(--ramp-seq-4); }     /* meşru: sürekli değişken */
  ```

### T-27 · İkon boyları tutarsız → görsel kütleyi eşitle

- **Belirti** — Hepsi 40×40 kutuda ama daire ikon küçük, kare ikon büyük
  görünüyor.
- **Neden olur** — Eşit KUTU eşit kütle demek değildir: daire aynı kutuda kare
  alanın ~%78'ini kaplar, ince çizgili ikon daha da azını.
- **Çare** — Kutuyu değil mürekkep alanını eşitle: daireyi %2–4 büyüt, dolu
  kareyi küçült, çizgi kalınlığını tek değerde sabitle.
- **Nasıl doğrularsın** — Göz testi: ikonları tek sıraya diz, gözü kıs;
  hiçbiri öne çıkmamalı.
- **Kod** —
  ```css
  .icon { width: 40px; height: 40px; }
  .icon--round { transform: scale(1.04); }  /* daire overshoot */
  .icon svg [stroke] { stroke-width: 1.75; } /* tek kalınlık */
  ```

### T-28 · Fotoğraf kenarı metne çarpıyor → çerçeve içinde çerçeve ya da taşma

- **Belirti** — Görselin kenarı gövde metnine 24 px'den yakın; iki farklı sol
  kenar aynı bölgede yarışıyor.
- **Neden olur** — Görsel içerik akışına konur, ama görselin kendi iç
  kompozisyonu (ufuk çizgisi, nesne kenarı) ikinci bir hizalama ekseni ekler.
- **Çare** — Karar ver: görseli ya ızgara içine çerçevele (metinden `--space-lg`
  ayır) ya da tam taşır (kenar boşluğu sıfır, metin üstüne binmez).
- **Nasıl doğrularsın** — Göz testi; arada kalan yarım çözüm (`8 px` pay)
  hatalıdır.
- **Kod** —
  ```css
  .figure--framed { margin-right: var(--space-lg);
                    border: 1.5px solid var(--color-rule); }
  .figure--bleed  { margin: 0 calc(-1 * var(--stage-pad)); width: auto; }
  ```

---

## E. Hareket

### T-29 · Animasyon her yerde → hareket bütçesi

- **Belirti** — Bir slaytta birden fazla anlatı hareketi (giriş geçişi + kart
  kaskadı + sayaç + kamera). Ölçüt: slayt başına `data-enter`, `data-anim`,
  `data-card-cascade` gibi hareket kancalarının toplamı > 1.
- **Neden olur** — Her hareket ayrı ayrı eklenir ve tek başına iyidir; bütçe
  tutulmadığı için toplam dikkat maliyeti görünmez.
- **Çare** — Slayt başına TEK anlatı hareketi bırak; kalanı ya sil ya da
  arka planda algılanmayacak kadar sessizleştir.
- **Nasıl doğrularsın** — `[kural: motion-budget]` slayt başına hareket
  kancalarını sayar.
- **Kod** —
  ```html
  <!-- önce --> <section class="slide" data-enter="zoom-into" data-card-cascade>
  <!-- sonra --> <section class="slide" data-enter="zoom-into">
  ```
  ```css
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
  ```

### T-30 · Hareket okumayı bölüyor → okunurken sabit kal

- **Belirti** — Grafik, denklem ya da tablo okunurken arka planda süren
  döngüsel animasyon var.
- **Neden olur** — Ortam animasyonu "canlılık" için sürekli bırakılır; göz
  hareketi istemsiz takip eder.
- **Çare** — İçerik-kritik sahnelerde ortam hareketini durdur ya da gizle
  (`decor-layering.md` bütçeleri).
- **Nasıl doğrularsın** — Göz testi: slaytı 10 saniye izle, gözün nereye
  kaydığını not et.
- **Kod** — kod yok, karar: dekor içeriğe yol verir.
