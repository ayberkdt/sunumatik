# ML kayıp fonksiyonları preseti

Dosyalar: `/presets/ml_loss_functions/` — `loss-functions.mjs` (tek
dosya: mini TeX→MathML dizgisi + kayıp tanımları + veri + eğitim + sahne;
stil modülden enjekte edilir, ayrı CSS yok), `index.html` (Türkçe demo),
`motion-manifest.json`.

**"Hangi kaybı neden seçersin" filmi.** Sekiz kayıp fonksiyonu formülü,
eğrisi ve TÜREVİYLE tanıtılır; sonra üst üste bindirilip farkları canlı
gösterilir; sonunda aynı veri farklı kayıplarla GERÇEKTEN eğitilir.
Truth level: **numerical** — bütün sayılar çalışma anında kapalı biçim
türevlerle koşturulan tam yığın gradyan inişinden gelir. WebGL yok,
bağımlılık yok, ağ isteği yok. `ml_loss_landscape` ile karışmaz:
o 3B yüzeyde İYİLEŞTİRİCİLERİ (SGD/Momentum/Adam) yarıştırır, bu preset
KAYIP FONKSİYONLARININ KENDİSİNİ anlatır.

## Kayıplar (birebir formüller — koddaki `KAYIPLAR` ile aynı)

Regresyon kayıpları artığın `r = ŷ − y`, sınıflandırma kayıpları doğru
sınıfın olasılığının `p` (hinge: marjın `m = y·f(x)`, `y ∈ {−1,+1}`)
fonksiyonudur. **Logaritma tabanı e'dir (nat)**; tabloda bit sütunu log₂
dönüşümüdür.

| | ℓ | ∂ℓ/∂· | Slot |
|---|---|---|---|
| MSE | ½r² | r | `--color-data-1` |
| MAE | \|r\| | sign(r), r ≠ 0 | `--color-data-2` |
| Huber(δ) | ½r² (\|r\| ≤ δ); δ(\|r\| − ½δ) (\|r\| > δ) | clamp(r, −δ, δ) | `--color-data-3` |
| Log-cosh | ln cosh r | tanh r | `--color-data-4` |
| BCE | −[y ln p + (1−y) ln(1−p)] | ∂/∂p = −1/p (y=1); **∂/∂z = p − y** | `--color-data-1` |
| CCE | −Σ_k y_k ln p_k = −ln p_c | ∂/∂z_k = p_k − y_k | `--color-data-5` |
| Hinge | max(0, 1−m) | −1 (m<1); 0 (m>1) | `--color-data-6` |
| Focal(γ) | −(1−p)^γ ln p | γ(1−p)^{γ−1} ln p − (1−p)^γ/p | `--color-data-2` |
| α-Focal | −α_t(1−p)^γ ln p | yukarıdakinin α_t katı | `--color-data-4` |

α-Focal galeride yer ALMAZ; 8. adımda "γ neyi yapmaz" kanıtı olarak girer.

### Doğrulanan özdeşlikler

Bütün kapalı biçim türevleri merkezî farkla karşılaştırıldı — en kötü
sapma **4,3e−6** (türevlenemez noktalar hariç). Ayrıca:

- Huber'in kırılma noktası `|r| = δ`: iki kol orada hem DEĞERDE (½δ²) hem
  EĞİMDE (δ) buluşur → C¹ süreklidir, ikinci türev orada sıçrar. δ → ∞
  limitinde MSE'ye döner.
- log-cosh: küçük r'de ½r² − r⁴/12 + …, büyük |r|'de |r| − ln 2.
  Kararlı hesap: `|r| + log1p(e^{−2|r|}) − ln 2`.
- focal γ = 0'da TAM OLARAK çapraz entropidir (hem değer hem türev).
- MAE r = 0'da, hinge m = 1'de türevlenemez — eğri orada KOPARILIR
  (sahte dikey çizgi çizilmez), MAE'nin kırılması işaretlenir.
- **MSE ½r² ölçeğiyle çizilir** ki Huber'in içteki koluyla aynı eksene
  otursun. Sabit çarpan gradyanı ölçekler, biçimini değiştirmez; bu not
  hem galeri kartında hem dürüstlük şeridinde görünür kalır.

## Sekiz adımlık anlatı

| # | id | Ne gösterir |
|---|---|---|
| 1 | `galeri` | 8 kart: formül (MathML) + eğri + türev + tek cümlelik "ne zaman" iddiası |
| 2 | `ustuste` | Dört regresyon kaybı tek eksende; sıfırda aynı parabol, kuyrukta ayrışma |
| 3 | `gradyan` | Türev paneli vurgulu + \|∂ℓ/∂r\| tablosu (r = 0,1 / 0,5 / 1 / 3 / 8) |
| 4 | `aykiri` | Sürüklenebilir aykırı değer; kayıp ve gradyan barları + y taraması |
| 5 | `egitim` | Aynı veri, dört kayıp, gerçek gradyan inişi; w–adım yörüngeleri |
| 6 | `ce` | −ln p vs (1−p)²; kalibrasyon (düzgün skor) paneli |
| 7 | `focal` | γ ailesi + modülasyon çarpanı (log ölçek) + ölçülmüş gradyan payı |
| 8 | `sinif` | BCE / Focal / α-Focal / Hinge karar sınırları, dengesiz veride |

## Karşılaştırmalı anlatının kurulumu

**Aykırı değer (4. adım).** 12 noktalı doğrusal veri; **indeks 10**
sürüklenebilir (x = 0,818 — merkezden uzak, yani YÜKSEK KALDIRAÇ; indeks 8
denendi, eğim sapması %25'te kalıyordu, burada %40). Barlar ve tarama
eğrisi **ORTAK bir referans doğrusunda** ölçülür — aykırı değersiz kapalı
form EKK (w = 2,260, b = 2,952). Bu, elmaları elmalarla karşılaştırmak
içindir ve ekranda yazılıdır. Alt grafik yalnız **|∂ℓ/∂r|** çizer (kayıp
da çizilince MSE'nin ölçeği diğerlerini eziyordu): MSE doğrusal tırmanır,
MAE/Huber/log-cosh tavanda düz kalır.

**Eğitim (5. adım).** ŷ = w·x + b, w = b = 0'dan, tam yığın gradyan inişi,
`∂L/∂w = (1/n)Σψ(r_i)x_i`, `∂L/∂b = (1/n)Σψ(r_i)`. Varsayılan η = 0,08,
200 adım (η = 0,25'te yakınsama ~40 adımda bitiyor ve yörünge grafiği
okunmaz oluyordu). Aykırı y = 10,0'da ölçülen sonuç:

| | w | aykırısız EKK'ten sapma |
|---|---|---|
| aykırısız EKK | 2,260 | — |
| MSE | 3,155 | %40 |
| MAE | 2,202 | %3 |
| Huber (δ=1) | 2,456 | %9 |
| Log-cosh | 2,455 | %9 |

Aykırı değerin toplam gradyandaki payı: MSE %37,6 · Huber %22,8 ·
log-cosh %23,7 · **MAE %8,3 = tam olarak 1/n** (MAE'de bir örnek asla
1/n'den fazla söz sahibi olamaz). Sabit η ile MAE optimumun çevresinde
±η mertebesinde SALINIR — kuyruktaki titreme gerçektir, çizim gürültüsü
değildir, ve MAE ile eğitirken adım küçültmenin neden gerektiğini gösterir.
Aykırı değer temiz konumuna çekilirse MSE koşusu kapalı form EKK'yle
1e−4'ten iyi örtüşür (doğrulandı).

**Çapraz entropi (6. adım).** p = 0,001'de −ln p = 6,91 nat = 9,97 bit;
aynı noktada kare hata yalnız 0,998 — **tavanı 1'dir**. İkinci panel CE'nin
düzgün (proper) skor olduğunu gösterir: q = 0,70 iken beklenen kayıp yalnız
p = q'da en küçüktür. Galeri kartı ayrıca kritik ayrımı taşır: olasılığa
göre gradyan patlar (−1/p) ama **logite göre gradyan p − y ile sınırlıdır**
— sigmoid+BCE bu yüzden birlikte türetilir.

**Focal (7. adım).** Oran ℓ_γ/ℓ_CE = (1−p)^γ. γ = 2'de kolay örnek
(p = 0,9) **100 kat**, zor örnek (p = 0,1) yalnız 1,23 kat kısılır — fark
81 kat. Buna ek olarak **gerçek bir eğitilmiş model üzerinde** ölçüm
yapılır (model SABİT tutulup yalnız γ değiştirilir): p_t > 0,9 olan kolay
örneklerin toplam gradyandaki payı γ = 0'da %12,7, γ = 0,5'te %4,2,
γ = 1'de %1,4, γ = 2'de **%0,2**.

**Dengesiz sınıflar (8. adım) — bu presetin en dürüst kısmı.** 160
çoğunluk / 10 azınlık (%5,9), sabit tohumlu (20240813) iki Gauss kümesi;
2 özellikli lojistik model, tam yığın, 800 adım, η = 0,30, γ = 2:

| | TP/10 | FP | duyarlılık | F1 | kolay örnek gradyan payı | w₁/w₂ |
|---|---|---|---|---|---|---|
| BCE | 7 | 3 | 0,70 | 0,70 | %12,7 | 1,512 |
| Focal | 6 | 3 | 0,60 | 0,63 | %1,0 | **1,522** |
| α-Focal (α=0,941) | 10 | 11 | 1,00 | 0,65 | %0,2 | 1,329 |
| Hinge | 9 | 3 | 0,90 | 0,82 | %0,0 | 1,358 |

**Bulgu: γ tek başına sınıfları dengelemez.** BCE ile focal'ın sınır YÖNÜ
neredeyse birebir aynıdır (w₁/w₂ = 1,512 ve 1,522) — γ örnekleri yeniden
ağırlıklandırır, sınırı kaydırmaz. Sınıf dengelemesini **α** yapar ve
bedeli yanlış alarmdır (FP 3 → 11). Bu, bu kurulumun bulgusudur: yakınsamış
DOĞRUSAL bir modelde kolay negatiflerin çapraz entropi gradyanı zaten
sönmüştür. Lin ve ark. (2017) γ'yı ~10⁵ aday kutulu derin bir dedektörde
ölçer; oradaki katkı buradan okunamaz — bu uyarı ekranda da yazılıdır.
Sahte bir "focal kazandı" tablosu üretmek yerine gerçek ölçüm gösterilir.

## Mini TeX → MathML dizgisi

Deste'de vendor'lanmış KaTeX/MathJax yok; `typeset-tex-equations`
profillerinden **native MathML** seçilir — çevrimdışı, deterministik,
ekran okuyucuya açık, Chrome 109+ ve Firefox'ta yerel. `texToMathML(tex,
{display, okunus})` dışa aktarılır. Kaynak TeX her `<math>` öğesinin
`data-tex` niteliğinde SAKLANIR, `okunus` `aria-label`'a yazılır.

Desteklenen altküme (bu presetin formülleri için yeterli):
`^ _ {}`, `\frac \tfrac \dfrac \sqrt`, `\left…\right`, `\lvert \rvert
\lVert \rVert \langle \rangle`, `\hat \bar \overline \tilde`,
`\text \mathrm \mathbf \boldsymbol \mathbb \operatorname`,
`\sum \prod \int` (munderover), `\begin{cases} \begin{aligned}
\begin{array}`, Yunan harfleri, ikili/karşılaştırma operatörleri,
adlandırılmış işlevler (`\ln \log \exp \max \min \tanh \cosh \sign`…),
boşluk komutları (`\, \; \! \quad \qquad`).

**Desteklenmez** (eklenirse `<mtext>` olarak düşer, sessizce bozulmaz):
`\textstyle`, `\substack`, matris ortamları dışındaki hizalama, makro
tanımı, renk komutları. Yeni formül eklerken çıktıya BAK — ayrıştırıcı
bilinmeyen komutu metin olarak basar, hata fırlatmaz.

## API

```js
import { mountLossFunctions } from './loss-functions.mjs';

const lf = mountLossFunctions(host, { adim: 4, delta: 1.2, gama: 2, kayip: 'huber' });

const anlati = lf.anlati();          // deste ok tuşlarına BAĞLANABİLİR denetleyici
anlati.ileri(); anlati.geri(); anlati.git(3);   // git() 1 tabanlıdır
anlati.adim; anlati.uzunluk; anlati.basliklar;

lf.setDelta(1.5); lf.setGama(3); lf.setEta(0.12);
lf.setAykiri(12.5); lf.setP(0.02); lf.setKosu(80);
lf.setVurgu('mae');                  // bir kaybı öne çıkar, gerisini kıs
lf.setGorunur('logcosh', false);
lf.advance(dt); lf.finish(); lf.renderNow();    // deterministik sürüş
lf.setActive(false); lf.dispose();
```

Saf matematik de dışa aktarılır ve DOM'suz (Node'da) çağrılabilir:
`KAYIPLAR`, `REGRESYON`, `SINIF`, `huber`, `huberTurev`, `focal`,
`focalTurev`, `logcosh`, `sinifTurevZ`, `egitRegresyon`,
`egitSiniflandirma`, `ekkTemiz`, `kolayOrnekPayi`, `texToMathML`.
Modülün üst düzeyinde DOM erişimi YOKTUR — testler doğrudan import eder.

## Deterministik açılış parametreleri

Demo sayfası: `?adim=` (1 tabanlı), `?kayip=`, `?delta=`, `?gama=`,
`?eta=`, `?aykiri=`, `?p=`, `?kosu=`, `?export=1`.
Örnek: `?kayip=huber&delta=1.2&adim=4`.

Bunlar **başsız doğrulama** ve slayt açılış durumu içindir. Deste gömme
adreslerine dondurucu parametre (`?t=` gibi) KOYMA; anlatı kontrolü
`anlati()` üzerinden yapılır.

## Entegrasyon kuralları

- Palet tokenları mount anında CSS'ten okunur: `--color-canvas/-surface/
  -ink/-muted/-accent/-rule/-data-1..6`. Slot renklerini slayt başına
  değiştirme; galeri ve karşılaştırma panelleri aynı kaybı aynı renkle
  gösterir.
- **Veri işaretlerinde glow yoktur.** Sürüklenen aykırı değer bir HALKA
  ile işaretlenir (gölge/parıltı değil). Cam panel, neon, bloom yok.
- Kap mount'tan ÖNCE boyutlandırılmalı (gizli sekmeler ResizeObserver
  teslim etmez); `clientWidth/Height` okunur, DPR 2'de sınırlanır.
- **Global keydown EKLENMEZ.** Klavye yalnız presetin kendi kök öğesinde
  (tabindex=0) dinlenir: ←/→ adım, Boşluk eğitim koşusunu duraklatır.
  Deste kendi navigasyonuna `anlati()`yi bağlar.
- `prefers-reduced-motion: reduce` veya `html[data-export="true"]` veya
  `?export=1` → giriş taraması atlanır, eğitim son adımına oturur,
  kontroller gizlenir (`[data-export-hide]`), anlamlı SON KARE kalır.
- Stil modülden `#lfp-stil` kimliğiyle bir kez enjekte edilir; deste ayrı
  bir `<link>` eklemez.
- Manifest her düzenlemeden sonra
  `scripts/validate-motion-manifest.mjs` ile doğrulanır (7 motion, 0 hata).

## Bu dosyayı bozmadan değiştirilemeyecek sayılar

Aşağıdakiler deneyle seçildi; değiştirirsen bu belgenin ilgili bölümünü
yeniden üret:

- Aykırı değer **indeksi 10** (kaldıraç) ve varsayılan **y = 10,0**.
- Regresyon **η = 0,08**, **200 adım** (yörünge grafiğinin okunurluğu).
- Sınıflandırma verisi **160/10**, tohum **20240813**, **800 adım**,
  η = `clamp(3,2·η_regresyon, 0,3, 2,0)`.
- MSE'nin **½** ölçeği (Huber'le ortak eksen).
