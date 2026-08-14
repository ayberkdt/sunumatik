# ML evrişimli görü (CNN) preseti

Dosyalar: `/presets/ml_conv_vision/` — `conv-vision.mjs` (matematik +
sahne, tek dosya), `index.html` (Türkçe demo, stiller gömülü),
`motion-manifest.json`.

Bir görüntünün bir CNN içinden geçişini yedi aşamalık tek bir **film** olarak
anlatır: görüntü doğar → çekirdek üzerinde kayar → öznitelik haritaları
doğar → havuzlama küçültür → ReLU keser → derin katman soyutlaşır →
sınıflandırıcı karar verir. Truth level: **numerical** (softmax ve ReLU
aşamaları analytic). Ekrandaki her sayı çalışma anında CPU'da hesaplanır;
önceden pişirilmiş görüntü, doku ya da değer yoktur.

## Neden 2B tuval (sunum tekniği gerekçesi)

Evrişim özünde bir **piksel ızgarası** işlemidir ve anlatının yükü
**sayılardır**: yamadaki 9 değer, çekirdeğin 9 katsayısı, dokuz çarpım,
toplam, çıktı boyutu formülü. Perspektif projeksiyon bu hücreleri kısaltır
ve rakamları okunmaz kılar — bu yüzden haritalar dik açıdan, 1:1 ölçekli
**2B Canvas** ile çizilir. Derinlik anlatısı yalnızca tek yerde (katman
yığını) gerekir; orada da **aynı tuval içinde aksonometrik kart yığını**
kullanılır. Karma çözüm: *haritalar 2B, yığın 2.5B*. Sonuç: three.js
bağımlılığı, shader, GLSL NaN riski ve WebGL bağlam yönetimi yok; export
karesi tek `draw(t)` çağrısıyla birebir yeniden üretilir.

## Boru hattı (birebir koddaki zincir)

```
girdi 28×28×1
  → evrişim 1: 6 × (3×3), adım 1, dolgu 0      → 26×26×6
  → ReLU                                        → 26×26×6
  → havuz 1: 2×2 maks, adım 2                   → 13×13×6
  → evrişim 2: 6 × (3×3×6), adım 1, dolgu 0     → 11×11×6   (kanal boyunca TOPLAR)
  → ReLU → havuz 2: 2×2 maks, adım 2            → 5×5×6
```

Alıcı alan (gerçek hesap, `rf ← rf + (ç−1)·atlama`, `atlama ← atlama·adım`):
**3 → 4 → 8 → 10 px** (atlama 1, 2, 2, 4). Son yığındaki tek hücre girdide
10×10 piksellik bölge görür; bu kutu 6. aşamada girdi üzerine çizilir.

## Evrişim kuralı

CNN'lerdeki gibi **çapraz-korelasyon** (çekirdek ÇEVRİLMEZ), sıfır dolgu:

```
çıktı[oy][ox] = ölçek · Σ_ky Σ_kx  girdi[oy·a − p + ky][ox·a − p + kx] · ç[ky][kx]
çıktı boyutu  = ⌊(g + 2p − ç) / a⌋ + 1
```

Kayan pencere panelindeki dokuz çarpım (`tapDetail`) ile haritayı üreten
hesap (`convolve`) **aynı kuralı** uygular; panel ile harita ayrışamaz.

## Görüntü (prosedürel, dış ağ yok)

- **`rakam`** — el yazısı "4" benzeri şekil. Üç darbe: dikey gövde
  (18,2; 2,4)→(18,2; 25,6) **22,8 px**, çapraz kol **17,7 px**, yatay çubuk
  **18,6 px**. Nokta-parça uzaklığına `smoothstep(2,15 → 0,55)` yumuşak eşiği
  (kenar yumuşatması şart: ikili maske Sobel yanıtını iki değere çökertirdi),
  üzerine mulberry32 (seed `0x4D07`) ile 0,05 genlikli gürültü.
- **`desen`** — dikey şerit + yatay şerit + halka + çapraz bant
  (seed `0x5A17`); dört yönelimi birden taşır.

**Darbe oranları neden bunlar:** dört oran denendi. Daha kısa gövdeyle karar
iki sınıf arasında beraberliğe düşüyordu (%45'e %45 — karar slaytı için
kırılgan); daha kısa çaprazla şekil artık 4'e benzemiyordu. Seçilen oranda
gövde **görünür biçimde** en uzun darbedir ve sınıflandırıcının "Dikey kenar"
kararı bu görünür olguyu yansıtır — kurgu değildir.

## Çekirdekler

Adı olanlar: **Sobel-x** (dikey kenar), **Sobel-y** (yatay kenar),
**Sobel-çapraz**, **Laplace** (nokta/halka), **Gauss** 1/16 (ağırlık toplamı
1 → parlaklığı korur), **keskinleştirme**, **köşe maskesi**. Ayrıca iki
**"öğrenilmiş gibi"** çekirdek: mulberry32 ile üretilir, ortalaması
sıfırlanır (gerçek eğitilmiş ilk katman filtreleri de büyük ölçüde sıfır
ortalamalıdır), `|w|` toplamı 4'e ölçeklenir. **Eğitilmiş değildir** —
yalnızca eğitilmiş filtre istatistiğini taklit eder, ekranda öyle yazar.

Öznitelik bankası (1. katman, 6 filtre): Sobel-x, Sobel-y, Sobel-çapraz,
Laplace, Gauss, Öğrenilmiş-gibi F1. Her harita **kendi** maksimum mutlak
değerine göre renklendirilir; ölçek her kartta `±x,xx` olarak yazılıdır —
kartların parlaklığı bu yüzden karşılaştırılamaz, karşılaştırılabilir
büyüklük ayrıca basılan `ort |yanıt|` değeridir.

## Karar: neden filtre enerjisi değil, yönelim histogramı

İlk tasarımda sınıflandırıcı dört filtrenin `ort |yanıt|` değerini okuyordu.
Ölçtük: **çapraz Sobel, dikey bir kenara da maksimumunun %75'i kadar yanıt
verir** — tek bir doğrusal filtre yönelime SEÇİCİ olamaz (çapraz Sobel,
Sobel-x ve Sobel-y'nin döndürülmüş bir bileşimidir). Sonuç: "çapraz" kutusu
her şeyi topluyor ve karar anlamını yitiriyordu.

Doğru büyüklük iki dik bileşenin **oranıdır**: klasik **gradyan yönelim
histogramı** (HOG ailesi, 4 kutu), 1. katmanın gerçek gx/gy haritalarından:

```
m = √(gx² + gy²)                     gx = Sobel-x haritası, gy = Sobel-y haritası
φ = atan2(gy, gx) + 90°  → [0°,180°)  (KENAR yönelimi; y aşağı yönlü)
m < 0,06·m_max olan piksel sayılmaz    (düz bölgede yönelim tanımsızdır)
her piksel en yakın kutuya m ağırlığıyla girer: 0°(yatay) 45°(⟍) 90°(dikey) 135°(⟋)
```

Sonra: normalize (toplam 1) → 4×4 köşegen baskın **elle kurulmuş** ağırlık
matrisi → ×7 sıcaklık → softmax. Doğrulama: dört sentetik çizgi (dikey,
yatay, `/`, `\`) dördü de **%100** kendi kutusuna düşer.

**Sınır:** başlık ağırlıkları eğitilmemiştir. Bu aşama bir sınıflandırıcının
*nasıl* karar verdiğini gösterir, bir modelin *ne öğrendiğini* değil. Karar
2. katman yığınından değil, okunabilirlik için 1. katmanın gx/gy çiftinden
okunur; sıcaklık 7 kalibre edilmiş bir güven değeri değildir.

## Aşamalar ve süreler (toplam 108 sn)

| # | id | süre | ne gösterir |
|---|---|---|---|
| 1 | `goruntu` | 8 sn | görüntü = 784 sayı; 6×6 yakınlaştırma gerçek değerlerle |
| 2 | `kaydir` | 30 sn | 3×3 pencere kayar; 9 çarpım, Σ, ölçek, çıktı pikseli; boyut formülü |
| 3 | `haritalar` | 16 sn | 6 filtre, 6 harita, her birinin yakaladığı yapı |
| 4 | `havuz` | 14 sn | maks vs ortalama havuzlama, aynı pencerede |
| 5 | `relu` | 12 sn | ÖNCE/SONRA harita + 25 kutuluk gerçek histogram |
| 6 | `derin` | 14 sn | 2.5B katman yığını, boyut zinciri, alıcı alan |
| 7 | `karar` | 14 sn | yönelim histogramı → doğrusal başlık → softmax |

**Tarama programı (2. aşama):** ilk 9 adım yavaş (1,15 adım/sn — sayılar
okunur), sonra ivmelenerek tarar; ivme, hangi (adım, dolgu) seçilirse
seçilsin taramanın aşamanın **%82**'sinde bitmesi için uyarlanır. Pencere
hücreler arasında süzülür (C0), doğan çıktı pikselinin arkasında hız ile
uzunluğu değişen bir kuyruk kalır. ~6 adım/sn üzerinde tek tek çarpım
listesi söner — **ama sahne duraklatılmışsa liste her zaman tam görünür**
(durmuş karede okunacak vakit vardır; `?adim=` kareleri bu yüzden okunur).

**Havuzlama gezisi:** pencere yalnızca **içi dolu** pencerelerde durur
(maks > global maksimumun %0,12'si). Okuma sırasıyla gezilseydi ilk onlarca
pencere boş arka plana düşer ve kare "0,000 / 0,000 / %100 kayıp" gösterirdi
— öğretmeyen bir kare. Çıktı haritaları yine okuma sırasında dolar.

## API

```js
import { mountConvVision } from './conv-vision.mjs';

const cv = mountConvVision(host, {
  active: true, autoplay: true,
  image: 'rakam' | 'desen', filter: 'sobel-x',
  stride: 1, pad: 0,
  stage: 'kaydir', adim: 120,     // adım verilirse kare DONDURULUR
  seekTo: 42.5,                    // ham saniye (doğrulama)
});
cv.play(); cv.pause(); cv.restart();
cv.advance(dt); cv.seek(saniye);   // dışarıdan deterministik sürüş
cv.setStage('havuz', 6);           // aşama + alt adım
cv.setFilter('laplacian'); cv.setStride(2); cv.setPad(1); cv.setImage('desen');
cv.renderNow();                    // gizli pencere/denetim senkron çizimi
cv.state;                          // {t, stage, adim, stride, pad, cikti, karar…}
cv.setActive(false); cv.dispose();
```

Matematik DOM'a dokunmaz ve ayrıca dışa aktarılır — Node'dan denetlenebilir:
`makeImage, KERNELS, BANK, DEEP_KERNELS, outSize, convolve, convolveMulti,
tapDetail, pool, relu, softmax, histogram, orientationEnergy, classify,
receptiveField, buildPipeline, mulberry32`.

## Deterministik parametreler (demo sayfası)

`?sahne=` (aşama id) · `?adim=` (aşama içi adım; verilirse **duraklatır**) ·
`?filtre=` · `?stride=` · `?dolgu=` · `?goruntu=rakam|desen` ·
`?t=` (ham saniye, **yalnız doğrulama**) · `?disaAktarim=1` (dışa aktarım
kipini mount'tan önce açar, **yalnız başsız doğrulama**).

**Demo gömme adreslerine dondurucu parametre KOYMA** — `?adim=`, `?t=` ve
`?disaAktarim=` yalnızca doğrulama komutlarında kullanılır.

Denetim kancası: `window.__convVision`.

## Azaltılmış hareket / dışa aktarım

`prefers-reduced-motion: reduce` ve `html[data-export="true"]`: sahne
**ilan edilmiş son kareye** oturur — karar aşamasının sonu (t = toplam
süre − 0,05 sn): yönelim histogramı, ağırlık matrisi, softmax çubukları,
kazanan sınıf, `Σ = 1,0000` ve "eğitilmemiştir" sınır notu birlikte görünür.
rAF hiç başlamaz. Denetimler `data-export-hide` ile gizlenir; oynat/duraklat
düğmeleri azaltılmış harekette de gizlenir (`data-motion-only`).

## Doğrulama (elle kontrol edilen sayılar)

`conv-vision.mjs` Node'dan içe aktarılıp bağımsız yolla yeniden hesaplanarak
denetlendi (22 kontrol, hepsi geçti):

| kontrol | sonuç |
|---|---|
| Sobel-x çıktı[10][10], a=1 p=0 | elle Σ = **−1,077043958**, ×¼ = **−0,269260989**; harita, panel ve elle hesap 1e-12 içinde aynı |
| Sobel-y çıktı[0][0], a=1 **p=1** (9 tapın 5'i sıfır dolgu) | elle = harita = **0,004138556** |
| Sobel-x çıktı[3][4], **a=2** (girdi penceresi 6,8) | elle = harita = **−0,013608533** |
| çok kanallı K2·3 çıktı[4][5] (54 çarpım) | elle = harita = **−0,178762706** |
| boyut formülü ⌊(28+2p−3)/a⌋+1 | 7 (a,p) durumunda formül = fonksiyon = **gerçek harita genişliği** (26, 28, 30, 13, 14, 10, 9) |
| Gauss (Σw·ölçek = 1) | sabit 0,37 bölgesi tam 0,37 kalır (en büyük sapma 0) |
| sıfır toplamlı 7 çekirdek | sabit bölgede tam 0 |
| Sobel dikliği | Sobel-x dikey kenarda 1,0 / yatay kenarda **tam 0**; Sobel-y tersi |
| havuzlama (4×4 sentetik) | maks [0,90 0,70 0,55 0,75], ort [0,475 0,450 0,300 0,500] — elle aynı |
| ReLU | her piksel max(0,x); **334 piksel (%49,4)** tam sıfır |
| softmax | elle exp/Σexp ile aynı; toplam **1,000000000000000** |
| skor[0] = (3,2f₀ − 0,9f₁ − 0,7f₂ − 0,7f₃)·7 | elle = model = **4,337222169** |
| yönelim kutuları | 4 sentetik çizgi (dikey, yatay, /, \) dördü de **%100** doğru kutuda |
| alıcı alan | **3 → 4 → 8 → 10** px (atlama 1,2,2,4) — elle aynı |

Sahnenin ürettiği sayılar Node'daki değerlerle **birebir** örtüşür (ekran
görüntülerinden: kutular %35,2 / %25,8 / %32,2 / %6,9 → karar **Dikey kenar
%66,6**; taban m ≥ 0,063; 318 piksel sayıldı).

Sonuçlar: `rakam` → **Dikey kenar %66,6**; `desen` → **Çapraz kenar \ %48,0**
(desen dört yönelimi de taşıdığı için karar bilinçli olarak kararsızdır —
iyi bir karşıtlık dersi).

## Entegrasyon kuralları

- Palet jetonları mount anında CSS'ten okunur: `--color-canvas/-surface/-ink/
  -muted/-accent/-rule`, `--color-data-1…4`, `--ramp-seq-1…5`,
  `--ramp-div-1…5`. Sıralı rampa girdi yoğunluğu, ıraksak rampa **işaretli**
  haritalar içindir (mavi = negatif, turuncu = pozitif); slayt başına renk
  anlamını değiştirme.
- Kap mount'tan **ÖNCE** boyutlandırılmalıdır (gizli sekmeler ResizeObserver
  teslim etmez); tuval iç koordinatı sabit **1920×1080**, gösterim `clientWidth`
  ile ölçeklenir, DPR 2 ile sınırlıdır. Kompozisyon her ölçekte aynıdır.
- three.js, import map ve vendor bağımlılığı **yoktur**.
- `Math.random` ve `Date.now` kullanılmaz; tek rastgelelik kaynağı tohumlu
  mulberry32'dir. Zaman yalnızca rAF damgasından gelir, çizim `t`'nin saf
  fonksiyonudur — `seek(t)` ve `advance(dt)` birebir aynı kareyi verir.
- Sekme gizlenince otomatik akış durur.
- Manifest her düzenlemeden sonra
  `node scripts/validate-motion-manifest.mjs /presets/ml_conv_vision/motion-manifest.json`
  ile doğrulanır (8 hareket, 0 hata, 0 uyarı).
- Dürüstlük rozeti ("SAYISAL · her sayı tarayıcıda gerçek evrişimle
  hesaplandı · eğitilmiş model yok") her karede görünür kalmalıdır. Aşama
  rayı 72..952 arasında, rozet onun sağındadır — ray genişliğini artırırsan
  rozetle çakışır.
