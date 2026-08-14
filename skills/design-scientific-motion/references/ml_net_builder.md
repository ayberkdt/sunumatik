# Mimari Kurucu — Net Builder (`/presets/ml_net_builder/`)

Bir ağ mimarisi TARİFİ ver, sahne onu **blok blok kursun ve anlatsın**.
`orbital-stage`'in ML karşılığı: oraya yörünge verilir uçurur, buraya mimari
verilir kurar. `ml_layer_blocks` bloklarını (donmuş API) tüketir,
`webgl-scene-contract.md`'ye istisnasız uyar.

Demo: `/presets/ml_net_builder/index.html` (dört sekme: Küçük ESA · ÇKA ·
Artık bloklu · Dönüştürücü + kendi mimarini yazabileceğin düzenleyici).
Manifest: `motion-manifest.json` (4 hareket, doğrulandı: 0 hata / 0 uyarı).

## Mount

```js
import { mountNetBuilder, cikarim, netMath, ORNEK_MIMARILER } from './net-builder.mjs';
const net = await mountNetBuilder(host, {
  mimari: ORNEK_MIMARILER.cnn.mimari,   // bildirimsel tarif (aşağıda)
  seed: 7,                              // softmax çubukları deterministik
  autoplay: true, hud: true, bloom: true,
  cam: 'yonetmen',                      // yonetmen|genel|katman|akis|cikis|serbest
  adimSure: 1.5, ileriSure: 7.2,        // blok başına kurulum · ileri geçiş süresi
  bloklarUrl: '../ml_layer_blocks/ml-layer-blocks.mjs',
});
```

Sayfa import haritası ister: `"three": "../moon_advanced/vendor/three.module.min.js"`.
Kap MOUNT'TAN ÖNCE boyutlanmış olmalı (gizli sekmede `visibility:hidden`,
asla `display:none`).

## Mimari tarifi — bildirimsel dizi

```js
[{ tur:'input', sekil:[28,28,1] },
 { tur:'conv', filtre:32, cekirdek:[3,3], adim:1, dolgu:'gecerli'|'ayni'|2 },
 { tur:'activation', tip:'relu' },
 { tur:'pool', tip:'max'|'ort', boyut:[2,2], adim:[2,2] },
 { tur:'norm', tip:'yigin'|'katman' },
 { tur:'attention', kafa:8 },
 { tur:'residual', atlama:5 },          // ATLANAN katman sayısı
 { tur:'flatten' },
 { tur:'dense', birim:128 },
 { tur:'output', birim:10, tip:'softmax' }]
```

`bias:false` her ağırlıklı katmanda desteklenir. İlk katman `input` olmak
ZORUNDA. `residual` kaynağı `i − atlama − 1`. katmanın çıkışıdır ve şekiller
birebir uyuşmazsa mimari REDDEDİLİR (sessiz izdüşüm yok).

## Şekil çıkarımı — sunumun can damarı

`cikarim(mimari)` saf bir fonksiyondur (THREE'ye dokunmaz) ve tek doğruluk
kaynağıdır; sahne de HUD da kartlar da ondan beslenir.

```
out = floor((in + 2p − k)/s) + 1        // konv ve havuz, iki eksen ayrı ayrı
dolgu 'ayni'  → out = ceil(in/s), toplam dolgu (out−1)·s + k − in
konv          → kh·kw·Cin·F + F
tam bağlı/çıkış → Din·U + U             // 2B girişte konum-bazlı ([T,D]→[T,U])
yığın norm.   → 2C eğitilebilir  (+2C DURGUN: hareketli ortalama/varyans)
katman norm.  → 2C
dikkat (kafa) → 4d² + 4d                // d % kafa ≠ 0 ise hata
havuz/düzleştir/etkinleştirme/artık → 0
```

Dönüş: `{ katmanlar:[{ dizin, tur, ad, detay, girisSekli, cikisSekli,
parametre, durgun, formulSekil, formulParam, kaynak }], toplamParametre,
toplamDurgun, girisSekli, cikisSekli }`.

**Doğrulama (elle hesaplanıp koda karşı sınandı; `?test=1` sayfada koşar):**

| mimari | anahtar sayılar | toplam |
|---|---|---|
| cnn (MNIST) | konv1 26×26×32 / 320 · konv2 11×11×64 / 18.496 · havuz2 5×5×64 · düzleştir 1.600 · dense 204.928 · çıkış 1.290 | **225.034** |
| mlp | 200.960 · 16.448 · 650 | **218.058** |
| resnet | konv1 (dolgu aynı) 32×32×64 / 1.792 · norm 128 (+128 durgun) · artık kaynağı 4. katman · dense 524.416 | **601.738** (+384 durgun) |
| trafo | katman norm. 256 · dikkat 66.048 · FFN 66.048 + 65.664 | **198.272** |

Kenar durumları: `28,k5,s2,gecerli → 12` · `28,k5,s2,ayni → 14` ·
`7,k3,p1 → 7` · `11 havuz2 → 5` · `32,k7,s3,p2 → 10`. Keras'ın `Param #`
sütunuyla birebir aynıdır (yığın norm. hariç: Keras 4C'yi tek sayıda birleştirir,
biz eğitilebilir 2C ile durgun 2C'yi AYRI raporlarız).

Geçersiz tarif ANLAŞILIR hata verir ve **mevcut ağ ekranda kalır**:
> `4. katman (tam bağlı): giriş 13×13×32 — tam bağlı katman vektör bekler. Önce {tur:'flatten'} ekleyin.`

## Sahne dili

- **Kurulum**: her blok yukarıdan/derinden süzülüp raya oturur (yükseklik +
  derinlik + yalpa + ölçek + opaklık aynı anda), iniş halkası rayda yayılır,
  kartı açılır: ad · giriş→çıkış · KULLANILAN FORMÜL · parametre. HUD sayaçları
  blok geldikçe artar.
- **Katmanlama**: iki blok arasındaki **aktivasyon hacmi** çıkarılan şekildir —
  alan `sqrt` ile küçülür, kanal derinliği `log2` ile kalınlaşır, kanal dilimleri
  görünür. 28×28×1 → 26×26×32 → 13×13×32 … zinciri gözle okunur.
- **Artık kemer**: kaynak bloğun üstünden hedefe çizilen yay, hedef blok
  yerleşirken çizilir (`dashSize` uniform'u — parametrik, yeniden inşa yok).
- **İleri geçiş**: darbe girişten çıkışa akar, **her bloğun içinde yavaşlar**
  (o blok parlar, kartı yeniden açılır), boşlukta hacmi süpürür, sonunda çıkış
  çubukları yükselir ve kazanan sınıf etiketlenir. Döngü diktir: darbe opaklığı
  ve çubuk yükseklikleri iki uçta da sıfırdan rampalanır (C0).
- **Kamera yönetmeni** (`yonetmen`): kurulumda geniş çerçeve (ağ büyüdükçe
  GERİ ÇEKİLİR) → darbe akarken omuz üstü `akis` → varışta dizinin ötesine geçip
  geriye bakan `cikis` çekimi (çubuklar tam karşıdan). Geçişler yumuşar; ara
  katman kartları varış çekiminde geri çekilir. Objektif bilinçli olarak DAR
  (33°): 16 bloklu dizide perspektif kısalması azalır.

## API

```js
await net.kur(mimari)   // yeniden inşa; cikarim sonucunu döner, hatada fırlatır
net.adim()              // sonraki bloğu getir (animasyonlu, hedefte durur)
net.git(i)              // i. bloğun kurulduğu ana ışınlan (deterministik)
net.ileri()             // ileri geçişi başlat
net.odakla(i) · net.hud(bool) · net.advance(dt) · net.setActive(b) · net.dispose()
net.timeline = { play, pause, scrub, t, duration, kurulumSonu, playing }
net.camera   = { mode, transitionTo, current }
net.sonuc · net.blokKaynak · net.adimSayisi · net.stats.advanceMs
```

Klavye: `Boşluk` oynat · `N` sonraki blok · `F` ileri geçiş · `←/→` blok
odağı · `0–5` kamera · `H` HUD.

## Blok bağımlılığı YUMUŞAKTIR

`ml_layer_blocks/ml-layer-blocks.mjs` dinamik `import()` + try/catch ile
bağlanır; her kurucuya donmuş imzası (`{ filtre, cekirdek, adim, scale, palette }`
…) artı `girisSekli`/`dolgu` geçilir. Modül yoksa, kırıksa ya da bir kurucu
Object3D döndürmezse sahne **etiketli yer tutucu bloklarla aynen çalışır**;
HUD ve kenar çubuğu kaynağı ilan eder (`ml-layer-blocks` / `yer tutucu`).
Kanıt: `?bloklar=../ml_layer_blocks/OLMAYAN-DOSYA.mjs` — ağ, şekiller,
sayılar ve ileri geçiş değişmez.

Blok paleti deste token'larından türetilir (`body/panel/accent/metal`).
Blokların "sıfır emissive" sözleşmesi korunur: siyah emissive vurgu rengine
çevrilir ama TABAN ŞİDDET 0'dır — boştayken görüntü değişmez, "işleniyor"
vurgusu yalnız şiddet rampasıyla gelir.

## Determinizm ve yakalama

Her görsel sim zamanı `t`'nin saf fonksiyonudur. Demo sorguları:
`?mimari=cnn|mlp|resnet|trafo` · `?adim=N` · `?t=<saniye>` ·
`?cam=yonetmen|genel|katman|akis|cikis|serbest` · `?export=1` · `?bloklar=<url>` ·
`?bloom=0` · `?test=1` (şekil çıkarımı sınaması, konsola `NETTEST` satırları) ·
`?senaryo=yeniden|hata|dongu` (yeniden inşa yolu · hata paneli · ileri geçiş
döngü dikişi) · `?perf=1`. Azaltılmış hareket ve `?export=1`: otomatik oynatma
YOK, **kurulmuş tam ağın** karesi tutulur. Hata ayıklama kancası:
`window.__netBuilder = { stage, cikarim, ORNEK_MIMARILER, netMath }`.

Ölçüm (bu makine, headless SwiftShader — GPU YOK, yani üst sınır): 16 katmanlı
resnet `advance()` 47,5 ms; bloom kapalı 27,8 ms. Maliyet çizim tarafındadır;
şekil çıkarımı `kur()` başına bir kez koşar. Zayıf donanımda `bloom:false`.

## Dürüstlük kuralları

- İleri geçiş bir HESAP DEĞİLDİR: ağırlık yok, girdi örneği yok. Çıkış
  çubukları seed'li **örnekleyici** logitlerin softmax'ıdır; asla model
  tahmini gibi sunulmaz (manifest bunu `illustrative` olarak ilan eder).
- Akış hızı anlatım içindir; gerçek çıkarım süresini temsil etmez — altyazı
  bunu her sekmede söyler.
- Hacim boyutları monotondur (`sqrt`/`log2`), oran okunmaz; oranlar HUD ve
  kartlardaki SAYILARDAN okunur.
- Parametre sayıları bias'lı varsayılır; ağırlık paylaşımı, kuantalama ve
  füzyon modellenmez.
