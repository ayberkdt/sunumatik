# Astronot — ileri plan (ikinci tur)

Tarih: 26.09.2026 · Ölçülen sürüm: `82dbfb8` · Konu: `presets/astronaut_blocks/`

Birinci turda kusurlar tek tek ölçülüp tek tek onarıldı ve 118 sınavlık bir
kapı bıraktı. Bu turda bildirilen dört şikâyetin **üçü aynı kökten geliyor** ve
o kök, tek tek onarımla kapanmaz — mimari.

Her satır ya tarayıcıda ölçüldü ya kaynaktan okundu. Ölçüm yordamı §0'da.

---

## 0 · Nasıl ölçüldü

`scratchpad/dort.mjs` — node içinde figürü kurar, yürüyüş çözümünü koşturur ve
dört şikâyeti ayrı ayrı sayıya çevirir: kalça süreklilik ışınları, kask/gövde
örtüşmesi, omuz mafsalının gövdeye göre yeri, diz ekseni boyunca yarıçap
profili, ve yürüyüş çevriminde el köşelerinin gövde ızgarasına düşüp düşmediği.
Görsel teyit için `_inceleme.html` tezgâhı (dört ortografik görünüm + serbest
yakınlaştırma) taze bir portta koşuldu.

---

## 1 · KÖK NEDEN: figür KATI PARÇALARDAN kurulu, DERİLİ bir ağ değil

Şu an her uzuv, mafsal düğümüne bağlanmış **ayrı ve katı** bir gövdedir:
uyluk `kalca` grubunun, baldır `diz` grubunun çocuğudur. Mafsal döndüğünde
uyluk bütün olarak döner, baldır bütün olarak döner, **ve aralarındaki yüzey
hiçbir şey yapmaz** — çünkü ortak bir yüzey yoktur.

Bu mimaride üç şey kaçınılmazdır ve üçü de bildirilen şikâyetlerdir:

* **İki silindir birleşiyor gibi durur** (şikâyet 3), çünkü gerçekten iki ayrı
  silindir birleşiyordur. Mafsal gövdesi araya konan üçüncü bir cisimdir;
  boşluğu kapatır ama GEÇİŞ üretmez.
* **Bacak belden kopar** (şikâyet 1), çünkü leğen kabuğu ile uyluk ayrı
  nesnelerdir ve kalça 68° büküldüğünde aralarındaki ilişki yalnız "üst üste
  binme"dir.
* **Omuz sıkışık görünür** (şikâyet 2), çünkü kol gövdeye GİRER; deri olsaydı
  gövde omuz üstünde gerilir, kol o gerilmeden çıkardı.

Blender'da (ya da herhangi bir DCC'de) bu iş şöyle yapılır ve şikâyet 4'ün
cevabı da budur: **tek bir sürekli ağ, kemiklere AĞIRLIKLA bağlanır** (skinned
mesh / linear blend skinning). Bir köşe birden çok kemiğin etkisinde kalır,
mafsalda iki kemiğin ağırlığı yumuşak geçer, yüzey kopmaz ve bükülürken
GERİLİR. Kaliteli figürlerin "yumuşak" görünmesinin tek sebebi budur; malzeme
ya da ışık değil.

**Bu depoda aynısı yapılabilir ve üçüncü parti bir şey gerekmez.** three.js'in
`SkinnedMesh` + `Skeleton` + `Bone` sınıfları tam bu içindir, vendor'da zaten
var, ve figürün gövdeleri zaten `supur` ile köşe köşe üretiliyor — yani
ağırlıkları üretirken elimizde hem köşe hem de o köşenin hangi uzuv üzerinde,
mafsala ne kadar uzakta olduğu bilgisi VAR. Ağırlık boyamak gerekmez, ağırlık
ÖLÇÜLÜR.

Bu, bu planın en büyük ve en riskli maddesi; §6'da ayrı bir bölüm olarak
duruyor ve öteki maddelerin bir kısmı ondan ÖNCE, bir kısmı SONRA yapılmalı.

---

## 2 · Şikâyet 1 — kask/boyun eki ve belden kopan bacak

### 2.1 Kask ile gövde 127 mm iç içe

| ölçülen | değer |
|---|---|
| kask düğümünün z aralığı | 1,560 … 1,927 |
| üst gövde z aralığı | 1,142 … **1,687** |
| **örtüşme** | **0,127 m** |
| beyan edilen boyun çizgisi | 1,66 |

Kaskın alt kenarı beyan edilen boyun çizgisinin **100 mm ALTINDA**, gövdenin
tepesi ise **27 mm ÜSTÜNDE**. İkisi 127 mm boyunca birbirinin içinden geçiyor
ve buluştukları yerde — görsel teyit edildi — **tırtıklı, yırtık görünümlü bir
kenar** var: iki ayrı dönel yüzeyin kesişme çizgisi, hiçbiri ötekini bilmeden.

Birinci turda siluet daralması düzeltildi (göğsün %50'si) ama o ölçüm
SİLUETİ ölçüyordu; iki kabuğun birbirinin içinden geçmesini ölçmüyordu.

**Düzeltme.** Boyun bir EK YERİDİR ve ek yerinin üç parçası olur: gövdenin
boyun halkası, kaskın kilit bileziği, ve ikisinin arasındaki körük. Şu an
üçü de var ama **konumları birbirinden habersiz**. Yapılacak:

1. `DIKEY.boyun` tek gerçek referans olsun: gövde kabuğu orada **biter**
   (şu an 27 mm aşıyor), kask kabuğu orada **başlar** (şu an 100 mm altına
   iniyor).
2. Kaskın LEVA profili boyun çizgisinin altına inmesin; inmesi gereken tek
   şey ARKA etek (Apollo'da LEVA arkada omza doğru uzar) ve o da ayrı bir
   parça olarak, gövdeyle ÇAKIŞMADAN.
3. Körük iki halkanın arasını doldursun ve boyu `kaskTaban − gövdeTepe`
   farkından TÜRETİLSİN, sabit bir sayıdan değil.

**Kapı.** İki parçanın hacimsel örtüşmesi ≤ 15 mm (birbirine değen iki kabuk
biraz gömülür, 127 mm gömülmez). Ters sınav: kask 60 mm indirildiğinde kapı
düşmeli. Ölçüm ızgara tabanlı — iki parçanın 1 cm'lik hücrelerde paylaştığı
hücre sayısı.

### 2.2 Bacak belden kopuyor

Süreklilik ışınları (144 yön, 40 faz, iki bacak) **0 boşluk** buluyor — yani
kama boşluğu YOK. Ama görsel teyit şikâyeti doğruluyor: yürürken belin
altında sert bir kademe ve gölge çizgisi oluşuyor, leğen kütlesi üstteki
gövdeden ayrı bir cisim gibi okunuyor.

Sebep boşluk değil **SÜREKSİZLİK**: leğen kabuğu ile uyluk ayrı yüzeylerdir,
aralarında ortak bir kenar yoktur ve kalça büküldüğünde uyluk leğenin içinden
ÇIKAR. Işın sınavı "bir şeye çarptım" der; göz "iki ayrı şeye çarptım" der.

Bu, §1'deki kök nedenin doğrudan sonucudur ve **gerçek çözümü §6'dır**.
Deri gelene kadar yapılabilecek ara iyileştirme:

* Leğen kabuğunun alt kenarı, uyluğun kesitini İZLEYEN bir etek olsun
  (şu an düz kesilmiş bir kabuk). Etek uyluğun üstünde 60-80 mm örtüşsün ve
  kalça açısıyla birlikte hafifçe kaysın — katı parçalarla yapılabilecek en
  iyi taklit budur.
* Kalça mafsalının konvolütü 2 halkadan 4'e çıksın ve leğene kadar uzansın.

**Kapı.** Kalça ekseni boyunca yarıçap profilinde ikinci fark ≤ 25 mm
(§4'teki diz ölçümünün aynısı). Ters sınav: eteği kaldırınca kapı düşmeli.

---

## 3 · Şikâyet 2 — üst gövde sıkışık, kıyafet fazla basit

### 3.1 Omuz mafsalı gövdenin İÇİNDE

| ölçülen | değer |
|---|---|
| omuz mafsalının y'si | **0,300 m** |
| üst gövdenin yarı eni | **0,308 m** |
| fark | **−0,008 m (mafsal İÇERİDE)** |
| kol ile gövdenin y örtüşmesi | 0,187 m |

İnsanda omuz mafsalı (glenohumeral) göğüs kafesinin **DIŞINDADIR**: göğüs
yarı eni ~0,16 m iken mafsal ~0,20 m'dedir, yani 4 cm dışarıda. Burada 8 mm
içeride. Kol bu yüzden omuzdan değil **gövdenin içinden** çıkıyor ve üst gövde
sıkışık görünüyor: omuz diye bir yapı yok, gövde ile kol doğrudan birbirine
giriyor.

**Düzeltme.** Omuz bir MAFSAL DEĞİL bir YAPIDIR ve üç parçası vardır:
göğüs kafesinin üstündeki omuz kuşağı (klavikula + skapula karşılığı: giyside
sert üst gövdenin omuz boyunduruğu), yatak halkası, ve deltoid dolgusu.

1. `DIKEY` tablosuna **omuz genişliği** beyan edilsin (`OMUZ_MAFSAL_Y`), göğüs
   yarı eninin en az 1,15 katı olsun ve builder onu okusun.
2. Omuz boyunduruğu gövdenin üstüne BİNSİN ve dışa doğru uzansın — şu an
   gövdenin kesitiyle aynı yerde bitiyor.
3. Yatak halkası boyunduruğun ucunda, mafsal onun merkezinde olsun.

**Kapı.** Omuz mafsalının |y|'si, göğüs yarı eninin ≥ 1,12 katı. Ters sınav:
mafsalı 40 mm içeri alınca kapı düşmeli. Ayrıca kol ile gövdenin y örtüşmesi
≤ 0,10 m.

### 3.2 Kıyafet "basic" — doku var ama YAPI yok

Ölçüldü: gövde yüzeyleri **dokuludur** (`f6f7f9` ve `d6d9df`, ikisi de normal
+ pürüzlülük haritalı, toplam ~14 m²). Yani "kumaş deseni yok" ölçüm olarak
doğru değil — dokuma var ama **çok sığ** (normalScale 0,30, güç 0,22) ve
1,5 m'den bakınca ton olarak bile zor okunuyor.

Asıl eksik desen değil **KONSTRÜKSİYON**: gerçek bir basınç giysisinin
gövdesinde panel dikiş hatları, omuz boyunduruğu, göğüs fermuarı kapağı,
bel kuşağı, kol/gövde birleşim dikişi, dirsek ve diz takviye yamaları,
tutamak halkaları ve etiket cepleri vardır. Şu an gövde **tek parça düz bir
kabuk** ve üstündeki tek ayrıntı kapitone bantları.

Ayrıca soğutma tulumunun kırmızı serpantini (`c23b3b`, ~2,9 m²) **düz** —
dokusu olmayan tek büyük yüzey o.

**Düzeltme.**
1. `astro-body.mjs`'e **panel hattı** katmanı: kesit fonksiyonuna ek olarak,
   yüzeyde beyan edilen yerlerde 2-3 mm'lik oluk. Kapitone enine, dikiş
   boyuna, panel hattı ise PARÇA SINIRI boyunca gider — üçü farklı şeylerdir.
2. Gövdeye beyan edilmiş bir **panel şeması**: kaç panel, nerede birleşiyor.
   Kataloğa yazılır, kapı sayar.
3. Dokuma gücü 1,5 m mesafede ölçülerek ayarlansın (şu an gözle seçildi):
   ekran görüntüsünde kontrast ölçülüp eşik konsun.
4. Serpantin de doku alsın (ince kauçuk boru dokusu).

**Kapı.** Gövdenin görünen yüzeyinde en az N panel hattı; dokusuz büyük yüzey
(> 0,5 m²) sayısı 0. Ters sınav: panel şemasından bir sınır silinince kapı
düşmeli.

---

## 4 · Şikâyet 3 — eklem geçişi sert

Diz ekseni boyunca yarıçap profili ölçüldü (dz = −0,20 … +0,20, 1 cm adım):

```
dz    -0.20  -0.13  -0.09  -0.05  -0.01   0.03   0.07   0.11   0.15
r(m)  0.133  0.042  0.150  0.154  0.158  0.162  0.163  0.145  0.149
```

**dz = −0,13'te yarıçap 0,042'ye düşüyor** ve hemen ardından 0,150'ye çıkıyor.
En büyük ikinci fark **113,7 mm**. Pürüzsüz bir geçişte bu sayı milimetrelerde
olur.

Görsel teyit sebebi gösterdi: **konvolüt halkaları ayrı ayrı duran simitler**
ve aralarından geçilebiliyor. Körük gibi değil, üst üste dizilmiş halkalar
gibi. Işın halkaların ARASINDAN girip içerideki ince kola çarpıyor — 0,042 m
o.

**Düzeltme.** Konvolüt bir HALKA YIĞINI değil, **tek bir dalgalı yüzeydir**.

1. `konvolut` yeniden yazılsın: ayrı torus'lar yerine `supur` ile tek gövde,
   kesit yarıçapı eksen boyunca sinüzoidal dalgalansın. Böylece halkalar
   arasında delik kalmaz ve yüzey gerçekten süreklidir.
2. Dalga derinliği ve sayısı katalogdan gelsin (uzva göre değişir: dirsekte
   sık ve sığ, dizde seyrek ve derin).
3. Mafsal gövdesi ile konvolüt tek yüzeyde birleşsin.

**Kapı.** Her mafsal ekseninde yarıçap profilinin ikinci farkı ≤ 20 mm.
Ters sınav: konvolüt ayrı halkalara döndürülünce kapı düşmeli (ölçülen 113,7
mm onu düşürür).

---

## 5 · Şikâyet 4 — yürüyüş mekanik, eller gövdeden geçiyor

### 5.1 El gövdenin içinden geçiyor — ölçüldü

| ölçülen | değer |
|---|---|
| çakışan faz sayısı | **60 fazın 32'si (%53)** |
| en kötü faz | 0,933 |
| gövde ızgarasına düşen el köşesi | **3.486** |
| omuz salınımı | ±42,0° |
| gövde dönmesi | 11,0° |
| gövde eğimi | 10,4° |

Yani çevrimin yarısından fazlasında el gövdenin içinde. Sebep: kol salınımı
**açı olarak** üretiliyor ve kolun nereye gittiği hiç kontrol edilmiyor.
±42° omuz salınımı, 0,88 m'lik bir kolda eli gövde merkez düzlemine yaklaştırır
ve gövde 11° ters döndüğünde el gövdeyle buluşur.

### 5.2 Mekanik görünmesinin ölçülebilir sebepleri

1. **Çarpışma yok.** Hiçbir yerde "bu uzuv şuraya giremez" diye bir kural yok.
2. **Kol salınımı tek eksenli.** Gerçek kol salınırken omuz hafifçe abdüksiyon
   yapar ve dirsek salınımın ucunda biraz açılır; burada yalnız tek eksende
   ileri-geri gidiyor.
3. **Faz gürültüsü yok.** Her adım öncekinin birebir aynısı. Gerçek yürüyüşte
   adım uzunluğu ve süresi %2-4 dalgalanır ve bir yürüyüşü canlı yapan şey o
   küçük düzensizliktir.
4. **İkincil hareket az.** Hortum ve halat gecikmeli izliyor (birinci turda
   yapıldı) ama giysinin kendi kumaşı hiç sallanmıyor.
5. **Ayak yere ÇARPMIYOR.** Temas anında ne gövdede bir sarsıntı var, ne
   dizde bir yaylanma. Ay'da bile temas darbesi vardır.

### 5.3 "Blender versiyonu" ne demek, ve burada karşılığı ne

Blender'ın verdiği üç şey var ve üçünün de bu depoda karşılığı kurulabilir:

| Blender | burada karşılığı | maliyet |
|---|---|---|
| Skinned mesh + weight paint | `THREE.SkinnedMesh`, ağırlıklar süpürmeden **ölçülerek** üretilir | büyük, §6 |
| IK + constraint (çarpışma, limit) | mevcut IK'ya **çarpışma itmesi** eklenir | orta |
| Action/NLA, gürültü modifier | `astro-motion.mjs` zaten klip harmanlıyor; üstüne faz gürültüsü | küçük |
| Subdivision surface | süpürmelerde `dilim`/`halka` zaten ayarlanabilir | küçük |

Yani "Blender kalitesi" tek bir düğme değil, üç ayrı şey — ve en büyüğü
deridir.

**Düzeltmeler.**
1. **Çarpışma itmesi.** Yürüyüş çözümü elin dünya konumunu zaten biliyor.
   Gövde için basit bir **kapsül** beyan edilsin (eksen + yarıçap) ve el o
   kapsülün içine girerse omuz/dirsek açısı dışarı itilsin. Kapsül katalogda
   beyan edilir, kapı ölçer.
2. **Kol salınımına ikinci eksen**: salınımın ucunda 4-6° abdüksiyon.
3. **Adım gürültüsü**: adım boyu ve süresi için ±%3 deterministik dalgalanma
   (tohumlu, yoksa figür her karede titrer).
4. **Temas tepkisi**: ayak yere değdiği karede kalçada 8-12 mm'lik bir çökme
   ve dizde küçük bir yaylanma; Ay'da Dünya'nın üçte biri kadar.

**Kapı.** Çevrimin HİÇBİR fazında el gövde kapsülünün içinde olmayacak
(şu an %53). Ters sınav: kapsül yarıçapı 40 mm büyütülünce kapı düşmeli.
Ayrıca ardışık iki adımın boyu birebir aynı OLMAYACAK (gürültü gerçekten
var mı).

---

## 6 · DERİ (skinning) — en büyük madde, ayrı tutuldu

Şikâyet 1, 2 ve 3'ün ortak kökü. Yapılacak iş:

1. **Tek gövde ağı.** Bacak (kalça→bilek) ve kol (omuz→bilek) için `supur`
   tek bir sürekli yüzey üretsin; mafsalda kesilmesin. Kesit fonksiyonu
   şimdiki üç ayrı çağrının birleşimi olur ve mafsal hizasında şişme
   (mafsal gövdesinin yaptığı iş) kesitin kendisine girer.
2. **Kemikler.** Mevcut `eklem` düğümleri zaten kemik hiyerarşisi; `Bone`'a
   dönüştürülmesi mekanik bir iş.
3. **Ağırlıklar ÖLÇÜLEREK.** Her köşe süpürme sırasında hangi `t`de üretildiği
   BİLİNİR. Mafsala olan eksen boyu uzaklık `d` ve geçiş yarıçapı `w` ile
   ağırlık `smoothstep(-w, +w, d)` — boyamaya gerek yok, çünkü parametrik
   yüzeyde konum zaten analitik.
4. **Geçiş yarıçapı beyan edilsin** (`GECIS_M`, uzva göre): dizde ~0,09 m,
   bilekte ~0,04 m. Bu sayı "yumuşaklığın" ta kendisidir ve katalogda durması
   gerekir.
5. Mafsal gövdesi ve konvolüt deriye TAŞINIR (ayrı nesne olarak kalmaz);
   kapitone ve dikiş katmanları aynı yüzeyde sürer.

**Riskler ve ölçütler.**
* Süreklilik kapısı (bölüm 6) deri sonrası da geçmeli — ama artık başka bir
  şeyi ölçecek: tek yüzeyde boşluk zaten olamaz, o yüzden kapı **hacim
  kaybına** dönmeli (bükülürken mafsalda hacmin %X'inden fazlası kaybolmasın —
  "candy wrapper" kusuru).
* Zarf kapısı (bölüm 10) parça başına ölçüyor; deri sonrası uzuvlar tek parça
  olacağı için **parça → bölge** tanımı gerekir.
* AO pişirme köşe rengine yazıyor; derili ağda köşe sayısı artar, süre
  yeniden ölçülmeli (şu an 70 ms).

**Sıra.** Deri, §3.1 (omuz yapısı) ve §4 (konvolüt) ile birlikte yapılmalı;
ikisi de deride kesitin parçası olacak. §5 (yürüyüş) deriden SONRA, çünkü
çarpışma kapsülü derinin gerçek yüzeyinden türemeli.

---

## 7 · Sıra ve tahmini büyüklük

| # | iş | bağımlılık | büyüklük |
|---|---|---|---|
| 1 | Kask/gövde örtüşmesi (§2.1) | yok | küçük |
| 2 | Omuz yapısı ve beyanı (§3.1) | yok | orta |
| 3 | Konvolüt tek yüzey (§4) | yok | orta |
| 4 | Panel hatları ve konstrüksiyon (§3.2) | 2 | orta |
| 5 | **Deri / skinning (§6)** | 2, 3 | **büyük** |
| 6 | Leğen-uyluk sürekliliği (§2.2) | 5 | 5'in içinde |
| 7 | Çarpışma kapsülü ve el (§5.1) | 5 | orta |
| 8 | Yürüyüş canlılığı (§5.2) | 7 | küçük |

1-4 arası deriden bağımsız ve hemen yapılabilir; görünür kazancın yarısını
onlar verir. 5 tek başına en büyük iş ve 6 ile 7'yi de o çözer.

---

## 8 · Ölçülmüş ama bu plana girmeyenler

* Soğutma tulumunun serpantini (`c23b3b`, 2,9 m²) dokusuz — §3.2'ye iliştirildi.
* `craft-blocks` yarım başlığı hâlâ üst/alt bölüyor (birinci turdan kalan,
  kendi sayfasında doğrulanmadan değişmez).
* Habitat sayfasında "gündüz payı %0" görünüyor; astronot işinin dışında.
