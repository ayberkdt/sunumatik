# Astronot — kusur tespiti, düzeltme ve SONUÇ

Sürüm 3 · 26.09.2026 · Başlangıç `1a2d171` → bitiş `d7f67c8`
Konu: `presets/astronaut_blocks/`

Sürüm 1 kusurları ölçtü, sürüm 2 boyun ve premium bölümlerini ekledi, bu
sürüm **uygulamanın sonucunu** kaydediyor: her maddenin ölçülen öncesi ve
sonrası, hangi kapının onu tuttuğu, ve **planın yanıldığı iki yer**.

---

## 0 · Özet

| | önce | sonra |
|---|---|---|
| `validate-astronaut` | 75 sınav | **118 sınav** |
| Kapı merdiveni | 22 yeşil | 22 yeşil |
| Çıplak (pahsız) kutu | 232 / 481 mesh (%48) | **0** |
| Doku taşıyan yüzey | 3 malzeme (hepsi yazı etiketi) | **mesh'lerin %89'u** |
| En büyük tek malzeme payı | %40 (krom) | **%28** |
| Boyun: göğse oran | %72 (yerel en küçük YOK) | **%50, gerçek en küçük** |
| Çizme | 0,657 × 0,343 m | **0,358 × 0,229 m** |
| Eldiven zarfı | beyanın 1,35 katı | **1,08** |
| Göğüs paneli teması | 27,0 mm (12 ışının hiçbiri değmiyor) | **0,9 mm** |
| Yürüyüşte taban batması | −15,7 mm | **−6,0 mm** |
| Toplam boy | 1,9233 m (beyan 1,95) | **1,9502 m** |

Yedi commit, hepsi ölçümle ve ters sınavla:
`dd91c84` · `cef7bc7` · `181d6a4` · `0dce436` · `a012a62` · `4554276` ·
`0601de6` · `e7f6da6` · `d7f67c8`

---

## 1 · Kök neden: kısmi kabuğun yönü — YAPILDI

`latheZ`'de phi = 0'ın **+X'e (öne)** baktığı yazıyordu. Node'da ölçüldü:

| phi | latheZ | latheX |
|---|---|---|
| 0 | **(0,−1,0)** sağ | (0,0,1) üst |
| +π/2 | **(1,0,0)** ön | (0,−1,0) sağ |

Altı kısmi kabuk bu yanlış inanca göre kurulmuştu ve altısı da 90° sağa
dönüktü. **İki yardımcı AYNI DEĞİL** — tek ortak `PHI` tablosu, kapatmaya
çalıştığımız tuzağın ikincisi olurdu; o yüzden `PHI_Z` ve `PHI_X` ayrı.

Sonuç ölçüldü: vizör merkezi y = −0,096 → **0,000**, göğüs dolgusu −0,221 →
**0,000**, yan vizörler ikisi de −0,090 iken **±0,153**.

**Kapı:** `eksen-denetimi.py` kural 3 — çıplak açılı kısmi lathe reddedilir.
Ters sınav: eski çağrı geri konunca çıkış 1 ve satırı adıyla söylüyor.
Kural iki komşu kusuru da buldu; `hab-build`'inki zaten doğruydu,
`craft-blocks`'unki **gerçek bir kusur** (yarım başlıklar üst/alt bölünüyor,
menteşe ekseni ise z) ve yerinde **adlandırıldı**, düzeltilmedi.

## 2 · Boyun — YAPILDI

Siluet taraması: göğüs 0,6163 m'den tepeye kadar **tek yönde** azalıyordu,
hiçbir yerde yerel en küçük yoktu, en dar nokta göğsün **%72'si**.

Üç sebep, üçü de ölçülmüş: (a) çap hiç beyan edilmemişti, (b) `govdeKesiti`
tepede omuzun %86'sında bitiyordu, (c) kaskın ekvatoru halkanın 25 mm
üstündeydi. Ayrıca kaskın lambaları kask 1,745'e taşınırken **1,660'ta
kalmış** ve boyun bandını 0,461 m genişliğinde tek başına doldurmuştu.

Kask nereye gideceğini küre denkleminden aldı: halkada genişliğin %55'in
altına inmesi için merkez ≥ 0,585·R yukarıda olmalı. Kask 0,42 → **0,36**,
yani kask+LEVA toplam boyun %22'sinden **%18'ine** indi — gerçek oran odur.

Sonuç: en dar **0,305 m @ z = 1,65**, göğsün **%50'si**, üstünde 0,407.
**Kapı:** bölüm 11, iki ters sınav.

## 3 · Ayna simetrisi — YAPILDI

481 mesh'in 48'inin eşi yoktu. İkisi gerçek kusurdu: iki yan vizör de sağda
(§1) ve **haberleşme beresi 33 mm kaymış** — kısmi `SphereGeometry`'nin
kutbu +Y'dedir ve çevrilmemişti; eksen mandalı yalnız silindir, lathe ve
koniyi izliyordu. `kureGeoZ` eklendi.

Asimetri yasak değil, **beyansız** asimetri yasak: yedi parça gerekçesiyle
birlikte beyan ediyor. **Kapı:** bölüm 9, iki ters sınav.

## 4 · Çizilen ölçü ≠ beyan — YAPILDI

`validate-astronaut`'ta tek bir `Box3` yoktu; `validate-geometry` yalnız
habitat ve uyduyu kuruyordu.

**Planın yanıldığı yer bir:** "beyanı çizilene uydur" denemesi yapıldı ve
ölçüm onu reddetti — `size`ı KURUCU okur, yani beyanı büyütmek çizimi de
büyüttü (kol 0,257 → 0,446, oran yerinde saydı). Sözleşme ters yönde işler.
Taşma artık **oran olarak, taşan şeyin adıyla** beyan ediliyor; varsayılan
0,12, tavan 0,85, 0,40 üstü **borç** diye işaretli.

Ölçüm **sıfır duruşta** yapılır: aynı kol dik duruşta ×2,17, eklemler
sıfırken ×1,80 — aradaki fark geometri değil poz, ve bu kendi ters sınavı.
**Kapı:** bölüm 10, iki ters sınav.

## 5 · Çizme — YAPILDI

Kayış `uz*0.8`i yarıçap yerine koyuyordu (çizmenin yarı uzunluğu `uz*0.5`):
0,36 m'lik çizmenin etrafında **0,657 m'lik, ayağa hiç değmeyen** bir çember.
Ölçülen determinant 2,3188 → **1,275**.

Katalog `AYAK_ON_M` ve `AYAK_ARKA_M`i beyan ediyordu ve kurucu **ikisini de
kullanmıyordu**. Biçim diline ayak kalıbı girdi (`AYAK_KALIP`: topuk, çukur,
bilye, burun) ve `cizmeGovdesi` onun boyunca tek yüzey süpürüyor — altı düz,
üstü yuvarlak, iki ayrı süperelips üssüyle. **0,657 × 0,343 → 0,358 × 0,229**:
artık boyundan geniş değil, ki bir ayağın yönünü söyleyen tek şey odur.

## 6 · Yürüyüş — YAPILDI, bir maddesi DÜZELTİLDİ

**Taban batması.** Profil eklemin aralığında örnekleniyor ama **dünya
eğimiyle** sorgulanıyordu; Ay'da 1,7 m/s'de kırpma kalıntısı 39,5° ve tablo
uca kırpılıp eksik düşme döndürüyordu. Aralık ±55° genişletildi:
**−15,7 mm → −6,0 mm**.

**Bilek doyumu.** Gerçek: basma karelerinin %19'unda bilek sınırda, en çok
40,8°. Bu bir kusur DEĞİL — basınçlı bilek itiş boyunca plantar fleksiyon
yapamaz ve mürettebatın sıçramasının sebebi tam budur. Kapıya alındı ki
**sessiz kalmasın**.

**Planın yanıldığı yer iki: basan diz donuk DEĞİLDİ.** "Sekiz fazın
sekizinde de 11,5°" demiştim; o ölçüm 8 fazlıydı, yani iki adımlık çevrimde
adım başına dört örnek, ve her seferinde çevrimin aynı yerine denk geldi.
120 fazda genlik **Ay'da 43,7°, Dünya'da 55,9°**. Düzeltilecek bir şey yoktu;
kapı artık genliği ölçüyor ki aynı dikkatsiz iddia bir daha kurulmasın.

## 7 · Eklem gövdesi — YAPILDI

Diz gövdesi 0,260 × 0,286, baldır 0,261 × 0,279: top uzuvdan **%2,5** kalın,
yani boyut hiç sorun değildi. Sorun yüzeydi — uzuv konvolütlü, eklem
pürüzsüz küre.

Süpürme denendi ve **süreklilik kapısını düşürdü**: sivri uçlu bir elipsoidin
uç bandında sarım dışa bakan bir yüzeyi tarif etmiyor (225 köşenin 22'si içe)
ve arkaya bakan üçgen ışına da kameraya da görünmez. Küre topolojisi korundu,
**yüzey** kumaş oldu: her köşe kendi yarıçapı boyunca kapitone/dikiş/kırışık
alanıyla itiliyor. **Kapı:** bölüm 13 — modüle edilmemiş küre geçemiyor.

## 8 · Uzuv incelmesi — GEREKSİZ ÇIKTI

Plan "bilek baldırdan geniş" diyordu (0,295 / 0,279). O ölçüm **eski
çizmenin manşetini** içeriyordu. Çizme yeniden kurulduktan sonra: baldır en
kalın yerinde **0,307**, bilek **0,220** — oran **0,72**, hedefin altında.
Uyluğun incelmemesi ise kasıtlı ve kaynağıyla birlikte kodda yazılı
(basınçlı giysi incelmez). Ayrı bir iş yapılmadı.

## 9 · Gövde donanımı — YAPILDI

Göğüs paneli 12 ışının hiçbirinde gövdeye değmiyordu. Panel ve çıkartmalar
artık **eğri arka yüz** alabiliyor; yarıçap ölçülmüş (gövde kesiti p = 2,2
süperelips, panelin yarı eninde 17,6 mm geri çekiliyor → 0,56 m'lik daire).
**27,0 mm → 0,9 mm.** Kapı: bölüm 14, ters sınavıyla.

## 10 · Eldiven — YAPILDI

Dört düz paralel parmak, hepsi aynı boyda, uçlarında parmaktan kalın siyah
küreler, avuç bir tuğla. Şimdi: üç boğum (her biri kısa, ince ve daha
kıvrık), her boğumda mafsal gövdesi, dört farklı parmak boyu, yay üzerinde
duran kökler, karşı duran başparmak, süpürülmüş avuç.

Kıvrım keyfî değil: 29,6 kPa'da kumaş silindir olmak ister, yani şişmiş bir
eldivenin **nötr duruşu kapalıdır**.

Bilek halkası eldivenden kurulunca 0,230 m çıkıyordu, ön kol ise 0,152 —
koldan %51 geniş bir kilit halkası. Koldan kuruldu. Zarf **1,35 → 1,08**, ve
kapı bunun üzerine katalogdaki 0,35'lik payı **gereksiz** diye reddetti.

## 11 · Premium — SEKİZ MADDENİN SEKİZİ DE YAPILDI

| # | madde | önce | sonra |
|---|---|---|---|
| 1 | keskin kenar | 232 çıplak kutu (%48) | **0** · `pahliKutuGeo`, sarımı ölçülerek doğrulanmış |
| 2 | yüzey dokusu | 0 normal, 0 pürüzlülük | yordamsal düz örgü · **%89 mesh** |
| 3 | krom tekeli | tek malzeme %40 | **%28** · eloksal ayrıldı |
| 4 | köşeli eğri | ölçüt yanlıştı (bkz. aşağı) | **kenar açısı ≤ 30°** |
| 5 | ayna vizör | 256×128 yordamsal harita | **küp kamera**, 20 karede bir |
| 6 | sert gölge | `shadowMap.type` atanmamış | **PCFSoft**, yarıçap güneşin 0,53°'sinden |
| 7 | uçan çıkartma | panel 17–46 mm havada | **eğri arka yüz**, 0,9 mm |
| 8 | fabrika çıkışı | hiç kullanım izi yok | **regolit tozu**, 0,62 m'de biten |

Üç ölçüm yol boyunca yanlış çıktı ve düzeltildi: **iplik aralığı** 2,2 mm
ile çuval bezi gibiydi (beta bezi 1,2–1,6 mm), **mipmap** yoktu ve tam figür
planında yüzey kaynıyordu, **segment sayısı** ölçüt olarak anlamsızdı — 12
segment bir vidada görünmez, kaskta görünür; ölçüt **kenar açısıdır** ve
yalnız yarıçapı 40 mm'yi geçen yerde sorulur.

Temas karartması: ilk deneme parça kutularını örtücü aldı ve ölçüm reddetti
(ortalama 0,55, köşelerin %83'ü karanlık, 1450 ms). **2 cm'lik doluluk
ızgarası** ve paketlenmiş tam sayı anahtar: ortalama **0,80**, pişirme
**70 ms**.

---

## 12 · Kapsam dışı kalanlar

* `craft-blocks`'un yarım başlığı üst/alt bölüyor (§1). Kendi sayfasında
  doğrulanmadan değişmez; kodda adıyla duruyor.
* Zemin dokusu ve ufuk/yıldız arka planı — istenmedi.
* `hat-o2` / `hat-guc` beyan-çizim uyuşmazlığı (habitat tarafı).
* Preset sayfalarının yalnız Türkçe olması.

## 13 · Açık kalan sayı — KAPANDI (ve yine ölçüm hatasıydı)

Bu bölüm "uyluk kalçadan incelmiyor (%1,5), oysa gerekçe %7 öngörüyor"
diyordu. Yanlıştı: o tarama z = 1,05 ve z = 0,66'da yapılmış, yani ikisi de
MAFSAL GÖVDELERİNİN hizası. Ölçülen şey uyluk değil, iki ucundaki eklemdi.

Uyluğun kendi süpürme gövdesi ayrı ölçüldü (z 0,724 … 1,026):
üst **0,3143 m**, alt **0,2874 m**, daralma **%8,6**. Beyan `ustW: sy*0.35`
ve `altW: sy*0.325`, yani %7,1; aradaki fark kapitone ve şişme payı.
Beyan ile çizim tutuyor, düzeltilecek bir şey yok.

Bu oturumda üç kez aynı hata yapıldı ve üçü de kapıya dönüştü: **8 fazlık
yürüyüş örneği** (basan dizi donuk sandı), **yanlış yükseklikte siluet
taraması** (uyluğu incelmiyor sandı), **segment sayısını ölçüt sanmak**
(vidayı kaskla bir tuttu). Üçünün ortak dersi aynı: bir sayı, NEREDEN
alındığı yazılmadan sayı değildir.
