# Kompozisyon — fotoğraf/sinema ilkelerinin bilim slaydına uyarlanmışı

Bu doküman kompozisyon ilkelerini **1920×1080 sabit sahneye** ve
kütüphanenin mevcut ızgara diline bağlar. Kompozisyon ızgaranın YERİNE
geçmez, ÜSTÜNE gelir: ızgara *nereye hizalanacağını*, kompozisyon
*neyin baskın olacağını* söyler.

Uygulama katmanı: `../assets/composition-guides.css` +
`composition-guides.js`, canlı örnekler `composition-demo.html`.
Bağlı olduğu kurallar: `design-space-science-deck/references/`
→ `alignment-and-grid.md`, `typography-and-layout.md`,
`card-treatments.md`, `decor-layering.md`.

---

## 0. Sahnenin sayıları (ezberlenecek altı sayı)

| Ne | Değer | Nereden |
|---|---|---|
| Üçler düşey çizgileri | **640 · 1280** | 1920 ÷ 3 |
| Üçler yatay çizgileri | **360 · 720** | 1080 ÷ 3 — ikisi de 8 px taban satırına TAM oturur (45×8, 90×8) |
| Optik merkez | **960 · 504** | geometrik merkezin (540) %3,3 üstü; 504 = 63×8 |
| Güvenli alan | **96 · 72** | `typography-and-layout.md` |
| Izgara kenarı / oluk | **64 / 24** | `alignment-and-grid.md` |
| Sütun genişliği | **127,33** | (1920 − 128 − 11×24) ÷ 12 |

### Üçler çizgisi ile sütun ızgarası aynı şey DEĞİLDİR

Bu, kütüphanede en çok karıştırılan nokta. Sayılar:

- 4. sütunun sağ kenarı **645,33** — üçler çizgisi 640'a **5,33 px** uzakta.
- 9. sütunun sol kenarı **1274,67** — üçler çizgisi 1280'e **5,33 px** uzakta.

Yani ikisi *neredeyse* aynı yerdedir ama eşit değildir. Kural:

> **Metin sütuna hizalanır, figür üçler çizgisine çapalanır.**
> Aynı öğede ikisini karıştırmayın; bir slaytta iki farklı "sol kenar"
> 5 px arayla durursa bu hizalama hatası olarak okunur
> (`alignment-and-grid.md` — "ragged left edges").

`.komp-sutun-4-sag` ve `.komp-sutun-9-sol` sınıfları, üçler çizgisi
yerine bilerek sütun kenarına oturmak isteyenler içindir.

---

## 1. Üçler kuralı

**Ne olduğu.** Kadrajı üçe bölen iki düşey, iki yatay çizgi; öznenin
kesişimlerden birine oturması. Merkezden kaçış, kadrajın geri kalanına
"olacak bir şey var" gerilimi verir.

**Bilim slaydında nerede işe yarar.** Tek figürlü kanıt slaytları
(figür sağ-üst kesişimde, iddia sol yarıda), açıklamalı görsel
(annotated figure), bölüm ayracı, tek istatistik + tabanı olan slaytlar.
En çok işe yaradığı yer: figürün doğal ilgi bölgesi (tepe nokta,
kırılma, kesişim) zaten merkez dışıysa — figürü kaydırıp o noktayı
kesişime getirmek.

**Nasıl kurulur.**
- Kesişimler: **(640,360) · (1280,360) · (640,720) · (1280,720)**.
- Çapalanan şey öğenin kutusu değil, **ilgi noktası**dır: bir grafikte
  tepe nokta, bir portrede göz, bir denklemde eşittir işareti.
- `.komp-ucler-sag-ust` + çapa sınıfı. Varsayılan çapa öğenin merkezidir
  (figür davranışı); metin bloğu için `.komp-capa-metin` ilk satırın
  başını kesişime getirir — metnin görsel çapası kutu merkezi değildir.
- Tolerans: ölçüm katmanı **120 px** yarıçapı içindekini "çapalı"
  sayar (`kesisimUzakligi.capali`). 120 px, 1920×1080'de gözün ayırt
  edemeyeceği kadar yakın, ama bir başlık yüksekliğinden az.
- Bir slaytta **en fazla iki** kesişim kullanılır; dördü birden
  doldurmak ızgaraya geri döner ve kuralı iptal eder.

**Ne zaman YANLIŞ olur.**
- **Otorite isteyen tek figür.** Bir teleskop görüntüsü, bir portre, tek
  bir sonuç görseli "işte bu" diyorsa merkeze/optik merkeze oturur.
  Kesişime kaydırılmış otorite figürü kararsız görünür.
- **Simetrik denklem.** Denklemin iki yanı zaten dengedir; kaydırmak
  eşitliğin görsel iddiasını bozar. Denklem optik merkeze gider.
- **Kapak ve bölüm başlığı.** Kapak duruş ister, gerilim değil.
- **Karşılaştırma (öncesi/sonrası).** İki panel eşit ağırlıklıdır;
  birini kesişime çekmek "bu daha önemli" der — karşılaştırmanın
  yalanı budur.

**Kütüphaneden örnek.** `create-scientific-visuals` figür kadrajları ve
`figure_callouts`: figürün ilgi bölgesi sağ-üst kesişime, iddia
cümlesi sol yarıda `.komp-olcu` ölçüsüyle. Harmonikler destesindeki
kapanış Güneşi ise tam tersi — hero, optik merkezde.

---

## 2. Çerçeve içinde çerçeve

**Ne olduğu.** Özneyi sahnenin İÇİNDEKİ bir açıklıktan (kapı, pencere,
dal, karanlık kenar) göstermek. Kadraj içinde ikinci bir kadraj hem
derinlik hem "buraya bak" verir.

**Bilim slaydında nerede işe yarar.**
- **ROI (ilgi bölgesi) vurgusu**: ana görselin üstünde bir pencere +
  onun büyütülmüş hâli. Bilim slaydının en dürüst çerçeve-içinde-çerçeve
  kullanımı budur; süs değil, kanıt.
- Bir spektrumun/zaman serisinin dar bir aralığını içeriden kadrajlama.
- Cihaz/aygıt görüntüsünde ölçüm penceresini işaretleme.
- Kalabalık bir figürde okuyucunun bakması gereken tek çeyreği ayırma.

**Nasıl kurulur.**
- `.komp-cerceve` içeriden **40 px** (`--komp-cerceve-ic`) bir kural
  dikdörtgeni çizer. Kart değildir: dış kenar yok, gölge yok
  (`card-treatments.md` — figürün etrafındaki kart chrome eklemektir,
  anlam değil).
- `.komp-cerceve--perde` çerçevenin dışını sahne rengiyle %72 karartır.
  Bu, `decor-layering.md`'deki scrim kuralının kadraj ölçeğindeki hâli.
- ROI için: kaynak görselin üstüne `.komp-cerceve-pencere` (2 px accent
  kenar + dışarıyı %42 karartan halka gölge), yanına
  `.komp-cerceve-detay`, aralarını `roiBagla(kok, pencere, detay)` iki
  sessiz izle bağlar. Detay paneli pencerenin **en az 3 katı** olmalı;
  1,5× büyütme "büyüttük mü?" sorusunu doğurur.
- Detay panelinde büyütme oranı **yazılır** (`__etiket`: "4×"). Ölçeksiz
  büyütme sahtekârlıktır.

**Ne zaman YANLIŞ olur.**
- Çerçeve, içindekinden daha ilgi çekiciyse (kalın süs kenarlar,
  gradyan halkalar) özneyi yer.
- Zaten kart içindeki bir görsele çerçeve eklemek: üç iç içe dikdörtgen,
  hiçbiri anlam taşımıyor.
- ROI penceresi görselin **kritik** bir parçasını kapatıyorsa — pencere
  bilgi saklamamalı, işaretlemeli.
- Perde metnin üstüne düşüyorsa: perde arka plan içindir, gövde
  metninin okunurluğunu düşüremez.

**Kütüphaneden örnek.** `figure_callouts` ve
`ml_conv_vision` — konvolüsyon penceresinin girdi görüntüsü
üzerinde gezinip yanda büyütülmesi tam bu ilkedir.

---

## 3. Yönlendiren çizgiler (leading lines)

**Ne olduğu.** Kadrajdaki gerçek veya ima edilen çizgilerin bakışı bir
noktaya taşıması. Yol, ray, gölge, ufuk — slaytta: eksen, ok, yörünge
izi, tablo kural çizgisi, bir dizinin hizası.

**Bilim slaydında nerede işe yarar.** Çizgi gözü **iddiaya** götürür:
grafiğin eğrisinden sonuç cümlesine, denklemin bir teriminden onu
açıklayan nota, akış şemasının son kutusundan "bu yüzden" satırına.
Zaten var olan çizgileri KULLANIN — bir grafiğin trend çizgisi ücretsiz
bir yönlendiren çizgidir; üstüne ikinci bir ok çizmek gürültüdür.

**Nasıl kurulur.**
- `izCiz(kok, {baslangic, bitis, egri, etiket})` iki çapadan SVG yol
  üretir. Çapa: CSS seçici, Element, `[x,y]` sahne koordinatı veya adlı
  nokta (`'sag-ust'`, `'optik'`, …).
- Çizgi öğelerin **kenarına** değer, içine girmez (`kenarNoktasi`).
- `egri` varsayılan **0,18**. Düz çizgi (`egri: 0`) teknik/ölçüm bağları
  için; hafif yay anlatı bağları için. **0,35 üstü** dekoratif olur.
- Kalınlık 3 px accent; ikincil bağlar `.komp-iz--sessiz` (2 px, muted).
  Bir slaytta **en fazla iki** iz.
- `ilerleme(p)` ile açığa çıkma; export ve reduced-motion'da **her
  zaman p=1** (son kare) basılır.

**Ne zaman YANLIŞ olur.**
- **Çizgi slayttan DIŞARI götürüyorsa.** Sol kenara veya alt kenara
  doğru sonlanan bir ok bakışı sahneden çıkarır. Kural: izin bitiş
  noktası güvenli alanın (96/72) **içinde** olmalı.
- Kesişen izler: iki ok birbirini kestiğinde ikisi de okunmaz olur.
- Ok, iki öğe arasındaki ilişkiyi *söyleyebiliyorken* çizilmişse. Bir
  cümle ("bu terim kutupsal sınırı üretir") bir oktan daha kesindir.
- Kart metni içinde "A → B → C" sözde-diyagramı — bu ayrıca
  `card-treatments.md` ile yasak.

**Kütüphaneden örnek.** `equation_steps` terim→açıklama bağları;
Harmonikler destesindeki dönem/boru rayı (era/pipe rail), slayttan
slayta süren tek bir yönlendiren çizgidir.

---

## 4. İniş noktası (entry point)

**Ne olduğu.** Bakışın slayda ilk indiği yer. Kompozisyon bunu seçmezse
göz kendi seçer — genellikle en büyük/en parlak/en yüksek kontrastlı
şeyi, ki o çoğu zaman süstür.

**Bilim slaydında nerede işe yarar.** Her slaytta. İniş noktası
belirsiz olan slayt, dinleyicinin konuşmacıyı kaçırdığı ilk 2 saniyeyi
üretir.

**Nasıl kurulur.**
- **Tek baskın öğe kuralı.** Bir slaytta bir tane "birinci" olur.
  Ölçüm katmanı bunu sayısallaştırır: `baskinlik` = en ağır öğenin
  ağırlığı ÷ ikincininki. **1,6 altı** → hiçbir şey açıkça birinci
  değil. Baskınlığı boyut, kontrast veya çevresindeki boşlukla kurun —
  üçüyle birden değil.
- İniş noktası ile **iddia** aynı yerde olmalı. Slaydın cümlesi
  (`write-assertive-slide-copy`) gözün indiği yerdeyse slayt kendini
  anlatır.
- Konum: soldan sağa okunan metin ağırlıklı yerleşimlerde sol-üst
  bölge; figür baskın yerleşimlerde figürün ilgi noktası.

**Z ve F desenlerinin GERÇEK sınırları.** Bunlar evrensel yasa değil,
dar koşullu gözlemlerdir:
- **Yalnız** soldan sağa okunan dillerde geçerlidir.
- **Yalnız** metin ağırlıklı, güçlü görsel hiyerarşisi OLMAYAN
  yerleşimlerde. Ekranda tek bir güçlü figür varsa göz Z'yi izlemez,
  doğrudan figüre iner — desen bozulur ve bu bir sorun değildir.
- F deseni web'de **tarama** davranışından ölçülmüştür (uzun metin
  blokları). Bir sunum slaydı taranmaz, izlenir; F deseni slayta
  doğrudan taşınmaz.
- Türkçe destelerde de soldan sağa geçerlidir, ama `write-turkish-slide-copy`
  ile üretilen kısa iddia cümleleri zaten tarama değil okuma üretir.

Pratik sonuç: Z/F'yi **yerleşim gerekçesi** olarak kullanmayın, sadece
"hiçbir şey baskın değilse göz muhtemelen sol-üstten başlar" varsayımı
olarak kullanın. Doğru çözüm deseni takip etmek değil, **baskın öğe
koymaktır**.

**Ne zaman YANLIŞ olur.** Üç eşit ağırlıklı kart + eşit ağırlıklı bir
başlık → iniş noktası yok. Kartları küçültmek yetmez; birini büyütmek
veya kart satırını tabloya çevirmek gerekir (`card-treatments.md`:
5'ten çok kart tablo ister).

**Kütüphaneden örnek.** `.sci-card--stat` yerleşimi: mono büyük değer
iniş noktasıdır, `__delta` satırı onu okunur kılar. Değer olmadan delta,
delta olmadan değer — ikisi de iniş noktasını dağıtır.

---

## 5. Karşıtlık (juxtaposition)

**Ne olduğu.** İki şeyi yan yana koyarak anlamı **ilişkiden** üretmek.
Karşıtlık bir şeyi göstermez, bir farkı gösterir.

**Bilim slaydında nerede işe yarar.**
- **Öncesi/sonrası**: eski yöntem ↔ yeni yöntem, düzeltmesiz ↔ düzeltmeli.
- **Ölçek karşıtlığı**: bir nesneyi tanıdık bir şeyle ölçekleme
  (dedektör ↔ insan boyu), veya 10⁻⁸ ↔ 10⁻⁶ mertebe farkı.
- **Aynı eksende iki rejim**: bir grafiğin bir kırılma noktasının iki
  yanı — lineer rejim ↔ doygunluk rejimi. Bu, bilimdeki en güçlü
  karşıtlıktır çünkü karşıtlık **veriden** gelir.
- **Beklenti kırma**: "bunu bekliyordunuz — bu çıktı".

**Nasıl kurulur.**
- **Bitişiklik zorunludur.** `.komp-karsit` iki paneli **0 oluk** ile
  yan yana koyar, aralarına tek saç teli kural çizgisi girer. Aradaki
  64 px'lik boşluk karşılaştırmayı öldürür: göz iki ayrı şey görür,
  bir fark görmez.
- **Eksenler aynı olmalı.** Aynı ölçek, aynı aralık, aynı renk kodu.
  Farklı y-ekseni ölçeğinde iki panel karşılaştırma değil, yanıltmadır.
- Ölçek karşıtlığında oran **en az 3:1** (`.komp-karsit--olcek`).
  "Biraz büyük" karşıtlık değil, hizalama hatasıdır.
- Rejim sınırı `.komp-karsit-sinir` ile işaretlenir (kesikli accent).
- Farkın **sayısı yazılır**: "6,8 sn — yarıdan az". Karşıtlık görsel,
  kanıt sayısaldır.

**Ne zaman YANLIŞ olur.**
- İki panel farklı ölçekte/renkte → karşılaştırma sahte.
- Üç ve daha fazla panel: karşıtlık ikilidir, üçlü artık bir tablodur.
- "Sonra" paneli daha büyük/daha parlak yapılmışsa — sonuç görselden
  değil, tasarımdan geliyor demektir.

**Kütüphaneden örnek.** `.sci-table--comparison` (GEODYN II ↔ MONTE) ve
`ml_loss_functions` — aynı eksende iki kayıp rejimi.

---

## 6. Negatif alan

**Ne olduğu.** Boşluğun kendisinin özne olması. Boşluk artık değildir;
neyin önemli olduğunu söyleyen aktif malzemedir.

**Bilim slaydında nerede işe yarar.** Kalabalık slaydın **en ucuz
çaresi**: bir şey eklemeden, sadece çıkararak. Tek denklem, tek sayı,
tek soru slaytlarında boşluk vurgu makinesidir.

**Nasıl kurulur.**
- Nefes ölçekleri: `.komp-negatif--xs/s/m/l/xl/xxl` → 24/40/64/96/144/216 px.
  Bunlar 8/16/24/40/64 skalasının üstüne oturur; ara değer üretmeyin
  (`alignment-and-grid.md`: benzer görünen iki boşluk AYNI olmalı).
- **Metin ölçüsü** boşluğun yarısıdır: `.komp-olcu` **940 px** (≈ 62
  karakter), `.komp-olcu--dar` **660 px** (≈ 44 karakter). 100 karakterlik
  satır, etrafında ne kadar boşluk olursa olsun duvar gibi okunur.
- **`ch` tuzağı:** `ch` birimi öğenin KENDİ `font-size`'ına göre çözülür.
  Sahne kabının font-size'ı küçüktür (16 px), gövde metni 30 px'tir; bir
  SARMALAYICIYA `62ch` verirseniz ~500 px'lik bir kutu elde edersiniz —
  metin ölçüsü değil, kaza. Bu yüzden ölçü px cinsindendir. `ch` ancak
  ölçüyü metnin KENDİSİNE verirken doğrudur: `.komp-olcu-ch`.
- Ölçüm hedefi: `bosAlanOrani`. **%30 altı** kalabalık uyarısı verir;
  hero slaytlarda %60–75 normaldir.
- Boşluk **kenarlara değil, içeriğin etrafına** dağıtılır. Dört kenardan
  eşit 96 px bırakıp ortayı tıka basa doldurmak negatif alan değildir.

**Ne zaman YANLIŞ olur.**
- `bosAlanOrani` %85 üstü ve içerik varsa: içerik sahneye tutunmuyor,
  yüzüyor. Kadrajı sıkın veya tipografiyi büyütün.
- Boşluğu "dengelemek" için süs eklemek — bu, negatif alanı öldürmenin
  standart yoludur.
- Punto düşürerek boşluk üretmek. `enforce-slide-copy-density` tabanları
  bağlayıcıdır: boşluk **metin kısaltarak** kazanılır, küçülterek değil.

**Kütüphaneden örnek.** `typography-and-layout.md`: "Use negative space
as structure, not as empty decoration." Uygulaması: statement ve
question arketipleri.

---

## 7. Görsel ağırlık ve denge

**Ne olduğu.** Her öğenin bir "ağırlığı" vardır (alan × yoğunluk:
büyüklük, koyuluk, doygunluk, detay). Kompozisyon bu ağırlıkların
sahnedeki dağılımıdır.

**Bilim slaydında nerede işe yarar.** Bir slaydın "yamuk duruyor" ama
her şey hizalı olduğu durumların açıklaması budur: hizalama doğru,
ağırlık dağılımı bozuk.

**Nasıl kurulur.**
- **Simetrik denge = otorite.** Kapak, bölüm ayracı, tek denklem, ana
  sonuç. Duruş verir, hareket vermez.
- **Asimetrik denge = hareket.** Süreç, kanıt, karşılaştırma slaytları.
  Büyük-hafif bir öğe ile küçük-yoğun bir öğe uzak koldan dengelenir
  (terazi mantığı).
- Ölçüm: `denge.agirlikMerkezi` ve `denge.sapma.px`. Sapma **≤ 64 px**
  (bir kenar boşluğu) ise yerleşim simetrik okunur; üstü asimetriktir.
  Asimetri hata değildir — **kasıtsız** asimetri hatadır.

**Optik merkez.** Geometrik merkez (540) ile optik merkez arasındaki
fark ölçülebilir: göz bir kutunun ortasını gerçek ortanın **%2–4
üstünde** görür. Sahnede bu **504** demektir (540 − 36 px = %3,3), ve
504 = 63×8 olduğu için taban satırına da oturur.

- Dikeyde ortalanan her şey — hero başlık, tek denklem, tek figür,
  kapak bloğu — 540'a değil **504'e** oturur (`.komp-optik-merkez`).
- 36 px küçük görünür ama 1920×1080 projeksiyonda fark edilir; 540'a
  ortalanan başlık "biraz aşağı kaymış" hissi verir ve kimse nedenini
  söyleyemez.
- Ölçüm bunu `optikMerkez.sapma.geometrikeGoreKazanc` ile raporlar.

**Ne zaman YANLIŞ olur.** Optik düzeltmeyi *her* öğeye uygulamak. Bu
kural **dikeyde ortalanan tek bir bloğa** aittir; ızgaraya oturan metin
blokları, kartlar, tablolar kendi hizalarında kalır. Optik merkezi
sistematik bir 36 px kaydırmaya çevirirseniz ızgarayı bozarsınız.

**Kütüphaneden örnek.** Harmonikler kapanış Güneşi: hero, optik
merkezde, tek baskın öğe, simetrik denge.

---

## 8. Derinlik katmanlama

**Ne olduğu.** Ön/orta/arka plan ayrımı. İki boyutlu bir yüzeyde mekân
hissi ve — daha önemlisi — **okuma sırası**.

**Bilim slaydında nerede işe yarar.** Ambient sahne (gökyüzü, gezegen,
Güneş) arkada, veri/figür ortada, iddia ve etiketler önde. Katman
karışırsa dinleyici neyin kanıt neyin dekor olduğunu ayıramaz.

**Nasıl kurulur.**
- `.komp-derinlik-arka` (z 0, alpha .5) · `--orta` (z 10, alpha .82) ·
  `--on` (z 20, alpha 1). Bu alfa değerleri `decor-layering.md` ile
  **aynıdır**, ayrı bir sistem değildir.
- Metin arka katmanın üstünde okunacaksa `.komp-derinlik-perde`
  **zorunludur** (yönlü veil, içerik tarafı koyu).
- Derinlik **ölçek ve konumdan** gelir, blur/desatürasyondan değil —
  `decor-layering.md`'nin sert kuralı: filtre, preset'i değerli kılan
  doku detayını siler.

**Ne zaman YANLIŞ olur.** İçerik-kritik sahnelerde (yoğun tablo, ölçüm
tuvali) arka katman **dimlenmez, tamamen gizlenir**. Yarı görünür dekor
hassas içeriğin altında render hatası gibi okunur.

**Kütüphaneden örnek.** `sun_advanced` / `cosmos-decor.mjs`
kompozitleri ve `decor-layering.md` bütçesi (70/20/10 içindeki %20).

---

## 9. Gestalt ilkeleri

Her biri için slayt karşılığı:

| İlke | Ne der | Slaytta karşılığı |
|---|---|---|
| **Yakınlık** | Yakın olanlar birlikte okunur | Grup **içi** boşluk, grup **arası** boşluğun en çok yarısı. `.komp-yakinlik` (16 px) + `.komp-yakinlik-kume` (64 px). Etiket ile ait olduğu veri arasındaki mesafe, komşu etikete olan mesafeden KÜÇÜK olmalı. |
| **Benzerlik** | Benzer görünenler aynı sınıftır | Aynı rolü paylaşan her şey aynı görünür: model A serisinin tüm kartları aynı `--card-accent`. Rol değişmeden görünüm değişirse yalan söylemiş olur. |
| **Süreklilik** | Göz kesintisiz yolu izler | Hizalanmış öğeler bir çizgi olarak okunur — bu, hizalama disiplininin *neden* çalıştığının açıklaması. Zaman çizelgesinde tek eksen, tüm olaylar üstünde. |
| **Kapanış** | Eksik biçimi göz tamamlar | Tablo kenarlıklarını çizmeye gerek yok: hizalanmış sütunlar ızgarayı zaten ima eder (`table-treatments.md` sessiz kural çizgileri). Çerçevenin dört köşesini çizmek yeter. |
| **Ortak bölge** | Ortak zemin ortak aidiyettir | `.komp-ortak-bolge` — kart chrome'u olmadan gruplama. Yakınlık yetmediğinde (öğeler zorunlu olarak uzaksa) kullanılır. |
| **Şekil–zemin** | Bir şey özne, kalanı zemin olmalı | Belirsiz kaldığında slayt "gürültülü" hissi verir. Perde ve negatif alan bu ilkenin araçlarıdır. |

**Ne zaman YANLIŞ olur.** İki ilkeyi çelişecek şekilde kullanmak: aynı
renkteki (benzerlik → aynı grup) ama uzak duran (yakınlık → farklı
grup) öğeler. Çelişkide göz **yakınlığı** kazandırır; renk uyarınız
kaybeder.

---

## 10. Ritim ve tekrar

**Ne olduğu.** Aynı öğenin seri boyunca aynı yerde tekrarlaması. Ritim,
dinleyicinin her slaytta yerleşimi baştan öğrenmesini engeller.

**Bilim slaydında nerede işe yarar.** 30+ slaytlık bir destede sabit
çapalar, dinleyicinin dikkatini yerleşimden içeriğe aktarır.

**Nasıl kurulur — "aynı yerde aynı şey" kuralı.**
- `.komp-capa-kicker` (64, 72) · `.komp-capa-baslik` (64, 132) ·
  `.komp-capa-altbilgi` (64→1856, alt 48) · `.komp-capa-sayac`
  (sağ 64, alt 48).
- Bir öğe seride yer değiştirecekse **anlam değiştirdiği için**
  değiştirmeli; slayt daraldığı için değil. Sığmıyorsa metin kısalır.
- Ritim **kırılmak için** vardır: 12 slayt aynı çapada, 13.'de hero.
  Kırılma ancak sabit bir zemin varsa okunur.

**Ne zaman YANLIŞ olur.** Ritmi ayrım yapmadan uygulamak: her slayda
kart ızgarası koymak ritim değil, monotonluktur
(`typography-and-layout.md`: "Avoid repeating card grids on every slide").

**Kütüphaneden örnek.** Harmonikler destesinin dönem rayı — 36 slayt
boyunca aynı yerde, aynı davranışta.

---

## 11. Kadraj kararı: taşma (bleed) mı, içeride mi?

**Ne olduğu.** Bir görselin sahne kenarına dayanması mı, güvenli alanın
içinde durması mı.

**Nasıl karar verilir.**

| Taşsın (`.komp-tasma-*`) | İçeride kalsın (`.komp-icerde`) |
|---|---|
| Görsel bir **ortam**dır (gökyüzü, yüzey, doku) — kenarı yok | Görsel bir **nesne**dir (cihaz, grafik, diyagram) — kenarı anlamlıdır |
| Sürekli devam ettiği ima ediliyor | Tamamı görünmeli |
| Kapak, bölüm ayracı, hero | Kanıt, karşılaştırma, veri |
| Sahne dolu ve nefes iç boşluktan geliyor | Görselin kendi beyaz alanı var |

**Sert kural.** Taşan öğe sahne kenarına **yapışır** — 0 px. 20 px'lik
"az taşma" kaza gibi görünür. Ya tam taşsın ya güvenli alanda dursun;
arası yoktur.

**Ne zaman YANLIŞ olur.** Eksen etiketli bir grafiği taşırmak: veri
kırpılır, hem de sessizce. Veri taşırılmaz.

---

## 12. Altın oran hakkında dürüst bölüm

**Bu kütüphanenin duruşu: altın orana yerleşim kararı verdirmeyin.**

Gerekçeler:

1. **Sahne zaten altın değil.** 16:9 = **1,778**; altın oran **1,618**.
   Sahneye sığan en büyük altın dikdörtgen **1747,4 × 1080**'dir ve
   sahnenin **172,6 px**'i dışarıda kalır. Yani 1920×1080'de "altın
   oran kompozisyonu" kurmak, kadrajın %9'unu yok saymakla başlar.
   Kılavuz katmanı bu dikdörtgeni çizerken bunu **etiketler**, gizlemez.

2. **Fark, fark edilemeyecek kadar küçük.** Yatayda phi noktaları
   733 ve 1187; üçler çizgileri 640 ve 1280. Aradaki fark yatayda
   **~93 px**, dikeyde **~52 px**. 200 px'ten büyük görsel ayak izi
   olan bir öğe için bu, öğenin kendi genişliğinin yarısından azdır —
   salondaki hiç kimse ayırt edemez.

3. **Çoğu zaman sonradan uydurulan bir gerekçedir.** İyi görünen bir
   yerleşimin üstüne spiral çizip "altın oran" demek, kararı açıklamaz;
   kararı **meşrulaştırır**. Spiral yeterince ölçeklenip döndürülürse
   her kompozisyona oturur — bu da onu sınanamaz kılar. Sınanamayan
   gerekçe, bilim sunumu yapan bir kütüphanede yeri olmayan tek şeydir.

**Pratik sonuç.** Üçler kuralı yeterlidir: sayıları tam (640/1280,
360/720), taban satırına oturur, ölçülebilir, öğretilebilir.
`enableCompositionGuides`'ta `spiral` katmanı **varsayılan olarak
kapalıdır** ve açıldığında "referans" etiketiyle çizilir. Altın oranı
bir *yerleşim aracı* olarak değil, yalnızca bir *tarihsel referans*
olarak taşıyoruz.

Altın oranın meşru kullanımı: **tipografik ölçek** üretmek (28 → 45 →
73 px gibi), yerleşim değil. Orada da kütüphane 8 px tabanlı kendi
skalasını kullanır.

---

## 13. Uygulama sırası (bir slaydı kompoze ederken)

1. **İddia nedir?** (`write-assertive-slide-copy`) — kompozisyon
   iddiayı taşır; iddia yoksa kompoze edilecek bir şey yok.
2. **Baskın öğe hangisi?** Bir tane seçin. Ölçüm `baskinlik ≥ 1,6`
   diyene kadar büyütün/etrafını boşaltın.
3. **Nereye iniyor?** Baskın öğenin ilgi noktasını bir kesişime
   (640/1280 × 360/720) ya da hero ise optik merkeze (960 · 504) çapalayın.
4. **Göz oradan nereye gidiyor?** Gerekiyorsa **tek** bir yönlendiren
   çizgi; bitişi güvenli alanın içinde.
5. **Ne çıkarılabilir?** `bosAlanOrani ≥ %30` olana kadar.
6. **Katmanlar ayrık mı?** Arka/orta/ön; metin dekorun üstündeyse perde.
7. **Seriye uyuyor mu?** Sabit çapalar yerinde mi; kırılma kasıtlı mı?
8. **Ölç:** `olcCompozisyon(sahne)` → `uyarilar` boş olmalı ya da her
   uyarının bilinçli bir gerekçesi olmalı.

---

## 14. Ölçüm katmanı — ne döndürür

`olcCompozisyon(kok, {secici, baslikSecici})`:

| Alan | Anlamı |
|---|---|
| `ogeler[].kesisimUzakligi.px` | öğe merkezinin en yakın üçler kesişimine uzaklığı |
| `ogeler[].kesisimUzakligi.capali` | ≤ 120 px mi |
| `ogeler[].agirlik` | alan × yoğunluk sezgiseli (görsel 1,0 · metin punto ile · zemin 0,3) |
| `optikMerkez.sapma.y` | başlık merkezinin 504'ten sapması (px) |
| `optikMerkez.sapma.geometrikeGoreKazanc` | pozitifse optik merkeze daha yakın |
| `bosAlanOrani` | 20 px ızgarada işgal edilmemiş hücre payı |
| `denge.agirlikMerkezi` | tüm mürekkebin ağırlık merkezi (sahne koordinatı) |
| `denge.tur` | `simetrik` (sapma ≤ 64 px) / `asimetrik` |
| `baskinlik` | en ağır öğe ÷ ikinci ağır öğe |
| `hero` | tek öğe + optik merkeze ≤ 60 px → hero yerleşimi |
| `uyarilar[]` | eşiği aşan ölçümlerin Türkçe açıklaması |

İç içe işaretlenmiş öğelerden yalnız **en dıştakiler** sayılır; bir başlık
işaretli bir iddia bloğunun içindeyse `ogeSayisi` ve `baskinlik` şişmez.

`hero === true` iken iki uyarı **bastırılır**: "kesişime çapalı değil" ve
"boş alan çok yüksek". Gerekçe §1 ve §7'de: kapak, bölüm ayracı ve tek
denklem üçler kesişimine çapalanmaz, optik merkeze oturur; ve boş olması
o yerleşimin amacıdır. Bastırma olmasaydı **doğru** yerleşim hatalı
raporlanırdı.

Ölçüm **görüş bildirmez, sayı verir**; eşikler yukarıda ve kodda
açıkça yazılıdır. Taktik doğrulayıcısı bu katmanı doğrudan tüketebilir.
