# ml_layer_blocks — sinir ağı katman blokları kütüphanesi

`/presets/ml_layer_blocks/ml-layer-blocks.mjs` — ML sahnelerinin paylaştığı
KATMAN kütüphanesi; craft-blocks'un ML karşılığıdır. Saf kuruculardır:
**mount yok, rAF yok, doku yok, zaman yok** — yalnızca geometri + malzeme.
Amaç kullanıcının istediği şey: mimariyi **blok blok** kurabilmek, katmanı
katman olarak gösterebilmek. (CNN'e özgü görüntü işleme gösterileri, kayıp
yüzeyi, gradyan iniş: BAŞKA presetlerin işi.)

## Donmuş API

```js
import {
  buildInput, buildConv, buildPool, buildDense, buildFlatten, buildNorm,
  buildActivation, buildAttention, buildResidual, buildOutput,
  ML_PALETTE, ML_OLCU, ML_VARSAYILAN_GIRIS,
  applyLayerPalette, zincirle, diz, katmanOzeti,
} from '../ml_layer_blocks/ml-layer-blocks.mjs';

buildInput({ sekil, scale = 1, palette })                  // sekil: [H,W,C] düzlem | [N] vektör
buildConv({ filtre, cekirdek = [3,3], adim = 1, scale = 1, palette })
buildPool({ tip = 'max', boyut = [2,2], scale = 1, palette })
buildDense({ birim, scale = 1, palette })
buildFlatten({ scale = 1, palette })
buildNorm({ tip = 'batch', scale = 1, palette })
buildActivation({ tip = 'relu', scale = 1, palette })
buildAttention({ kafa = 4, scale = 1, palette })
buildResidual({ atlama = 2, scale = 1, palette })
buildOutput({ birim, tip = 'softmax', scale = 1, palette })
```

Her kurucu bir `THREE.Group` döndürür.

```js
group.userData = {
  ad,            // Türkçe etiket: "Evrişim 32@3×3"
  tur,           // API adı: 'input' | 'conv' | 'pool' | 'dense' | 'flatten'
                 //        | 'norm' | 'activation' | 'attention' | 'residual' | 'output'
  girisSekli,    // dizi, ör. [32,32,3]
  cikisSekli,    // dizi, ör. [32,32,32]
  parametre,     // TAM SAYI, doğru hesaplanmış (formüller aşağıda)
  preset: 'ml-layer-blocks', parca, olcu: { x, y, z },   // ek bilgi
};
```

### İsteğe bağlı ek anahtarlar (donmuş imzayı BOZMAZ)

Yukarıdaki anahtarlarla yapılan her çağrı aynen çalışır; şunlar ekstradır:

- `girisSekli` — parametre sayısı `Cin`'e bağlıdır ve imzada yoktur. Verilirse
  şekil/parametre TAM olarak o girişe göre hesaplanır; verilmezse belgelenen
  varsayılan giriş `ML_VARSAYILAN_GIRIS = [32,32,3]` (dikkat/çıktı için `[64]`)
  kullanılır ve `userData.girisSekli` bu varsayımı bildirir. Gerçek mimaride
  sayıları `zincirle()` üretir.
- `buildConv({ dolgu })` — `'ayni'` (varsayılan, H' = ceil(H/adım)) | `'gecerli'`.
- `buildResidual({ aciklik })` — kemer açıklığı; varsayılan `0.25` (sözleşme
  kalınlığı). Kemer asıl işini birkaç bloğun ÜSTÜNDEN geçerken yapar; sahne
  bunu `aciklik: N×0.25 + boşluklar` vererek kurar (vitrin 0.95 kullanır).

## Eksen ve ölçü sözleşmesi

```
            +Y  (yukarı)
             |
   giriş ────O────→  +X  (İLERİ = veri akış yönü)
             |
            +Z  (derinlik / kafa ekseni)
```

- **Orijin blok MERKEZİNDE.**
- **X kalınlığı ≈ 0.25×scale** — bloklar +X ekseninde yan yana dizilebilir.
  Ölçülen değerler: conv 0.238 · pool 0.265 · flatten 0.264 · residual 0.250 ·
  input 0.208 · dense 0.203 · output 0.190 · attention 0.173 ·
  **norm 0.112 / activation 0.116** (bilinçli olarak İNCE: bunlar "ara plaka"
  katmanlarıdır, incelikleri bir bilgi taşır).
- **Y ve Z ≤ 1×scale** (ölçülen en büyük: 0.933). `finalize()` içinde güvenlik
  ağı vardır: sınırı aşan bir tasarım oranları korunarak küçültülür.
- Ölçüm nesne **ebeveyne EKLENMEDEN** yapılır — `Box3.setFromObject` DÜNYA
  uzayında ölçer; sahnedeyken ölçmek merkezlemeyi bozar (bu tuzak burada da,
  craft-blocks'ta da bir kez canımızı yaktı).

## Parametre formülleri (sunumda gösterilir — yanlış olamaz)

| tür | çıkış şekli | parametre |
|---|---|---|
| input | giriş | 0 |
| conv | `[ceil(H/adım), ceil(W/adım), filtre]` | `(kH·kW·Cin + 1)·filtre` |
| pool | `[ceil(H/bH), ceil(W/bW), C]` | 0 |
| dense | `[birim]` | `(Cin + 1)·birim` (3B giriş → örtük düzleştirme) |
| flatten | `[H·W·C]` | 0 |
| norm | giriş | `2·C` (öğrenilen γ ve β) |
| activation | giriş | 0 |
| attention | giriş | `4·(d² + d)` — Q,K,V,O izdüşümleri, bias'lı; `d` = son eksen |
| residual | giriş | 0 (özdeşlik atlaması) |
| output | `[birim]` | `(Cin + 1)·birim` |

Doğrulanmış örnek zincir (vitrinin "Ağ kur" modu, giriş 32×32×3):
896 → 64 → 0 → 0 → 18.496 → 0 → 262.208 → 650 = **282.314 parametre**.

## Görsel dil — tür GEOMETRİDEN okunur, renkten değil

Ortak kimlik: **tek plaka kurucusu** (`plakaGeo`, ortak köşe yarıçapı 0.045 ve
ortak pah), ortak kenar payı 0.035, ortak plaka/dilim kalınlıkları ve her bloğun
altındaki **ortak montaj dili** (gövde renginde ayak + metal kanal). Palet
craft-blocks ile AYNI ailedir; iki kütüphane bir sahnede yan yana durabilir.

- **input** — `[H,W,C]`: en-boy oranı korunan levhalar, C kadar (≤4) kaydırılmış
  düzlem, ÖN yüzde açık altlık + koyu 8×8 piksel ızgarası (ince dikişli),
  arkada metal sırt plakası. **Vurgu**: köşe köşebendi (kaynak görüntü işareti).
  `[N]`: sırt plakasına dizilmiş çubuklar, en büyük bileşen vurguda.
- **conv** — ÇAPRAZ kaydırılmış dilim yığını (kaydırılmış deste: cepheden de
  sayılabilir); dilim sayısı filtre ile logaritmik artar (8→3 … 128→7).
  Ön yüzde kH×kW hücreli **çekirdek penceresi** — çerçevesi bloğun tek vurgusu.
  Alt kenarda `adım` kadar çentik (adım mesafesi gerçek aralıkla).
- **pool** — +X'e doğru küçülen üç kademe + köşeleri bağlayan huni dikmeleri;
  ilk dilimin köşesinde bH×bW **pencere ızgarası**. `maks` → dörtgen tepe +
  seçilen hücre küpü (vurgu); `ort` → tüm yüzü kaplayan DÜZ ortalama kapağı
  (vurgu) + ortalama çizgisi. Fark biçimdedir, renkte değil.
- **dense** — omurga + nöron küreleri (bilezikli); birim > 7 ise 3 üst + 3 alt
  nöron ve ortada "…" kısaltması. Çıkışta toplayıcı ray. **Vurgu**: omurga
  başlıkları.
- **flatten** — MENTEŞE kenarı sabit kalarak dönen üç dilim (uzak kenar geriye
  süpürür; merkezden döndürülse simetrik bir "çiçek" çıkar, açılma okunmaz) ve
  hücreleri tek sıra olan **şerit**. **Vurgu**: kısa dikiş işareti.
- **norm** — ince ara plaka: gövde + metal kenar ÇERÇEVESİ + açık iç alan;
  oluk yönü tipi söyler (batch → yatay, layer → dikey, group → 2×2,
  instance → tek kare). **Vurgu**: olukları dik kesen sıfır-ortalama ekseni.
- **activation** — aynı ara plaka + eksen haçı + 17 örnekli **eğri kabartması**
  (relu/leaky/gelu/silu/tanh/sigmoid). Eğrinin artan x yönü blok −Z'sidir:
  vitrinin standart 3/4 duruşunda eksen ekranda soldan sağa artar (ters
  konursa ReLU aynalanmış okunur). **Vurgu**: eğrinin kendisi.
- **attention** — kafa sayısı kadar paralel şerit (dış şeritler X'te hafif
  geride: paralellik derinlikte okunur), her şeritte Q/K/V tırnakları, >8 kafada
  "…". **Vurgu**: hepsini toplayan birleştirme (concat) barası.
- **residual** — pabuç + dikme + tek parça Bézier **kemer** (yükseklik açıklıkla
  orantılı; dar açıklıkta yüksek kemer "iğne" gibi okunuyordu) + kemer üzerinde
  `atlama` kadar çentik. **Vurgu**: +X ucundaki toplama düğümü (halka + haç).
- **output** — sınıf çubukları; `softmax` → yükseklikler toplamı sabit + en
  yüksek çubuğun üstüne oturan Σ kirişi (iki dikmeyle tabana bağlı),
  `sigmoid` → her sınıf kendi 0..1 kafesinde + 0.5 eşiği rayı,
  `dogrusal` → çubuklar sıfır ekseninin iki yanına da uzar. **Vurgu**: kazanan.

Malzeme disiplini craft-blocks ile birebir aynıdır: `MeshStandardMaterial`,
gövde roughness 0.55 / metalness 0.35, metal 0.30 / 0.85, koyu hücreler +
ondan **türetilmiş** açık çerçeve, **blok başına TEK vurgu**, emissive YOK,
doku YOK, `Math.random` YOK (gerekirse seed'li mulberry32).

## Palet

```js
palette = { body, panel, accent, metal }     // hepsi isteğe bağlı
ML_PALETTE = { body:0x23252c, panel:0x10151d, accent:0xc9a35c, metal:0x9aa0ab }
applyLayerPalette(root, palette) → boolean   // YERİNDE renklendirme
```

Görünür blok asla yeniden kurulmaz (webgl-scene-contract §2): palet değişimi
yalnız malzeme renklerini tazeler — türetilmiş çerçeve ve ikincil gövde tonu
dahil. Kurucularla üretilmemiş bir kök verilirse `false` döner.

## Kompozisyon yardımcıları

```js
zincirle(gruplar, girisSekli)   // şekilleri blok blok ilerletir, userData'yı
                                // YERİNDE tazeler → { katmanlar, cikisSekli, toplamParametre }
diz(gruplar, { bosluk, x0 })    // ölçülmüş X kalınlıklarıyla +X'te dizer → toplam uzunluk
katmanOzeti(kok)                // "32×32×3 → 32×32×32 · 896 parametre"
```

Tüketici bu ikisini birlikte kullanır: önce blokları kur, sonra `zincirle` ile
sayıları gerçekle, sonra `diz` ile yerleştir. Elle konum ve elle parametre
yazmak YASAK — ikisi de kütüphaneden gelir.

## Kompozisyon sözleşmesi (tüketiciler için)

- İçe aktarma **göreli yolla**; başarısızlıkta blok basit bir yer tutucuya
  düşmek ZORUNDADIR (bloklar birbirine sert bağımlı olamaz):

```js
let buildConv;
try {
  ({ buildConv } = await import('../ml_layer_blocks/ml-layer-blocks.mjs'));
} catch {
  buildConv = ({ scale = 1 } = {}) => {                 // yer tutucu: dilim imasi
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x23252c, roughness: 0.55, metalness: 0.35 });
    for (let i = 0; i < 3; i++) {
      const d = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.74, 0.74), mat);
      d.position.x = (i - 1) * 0.09;
      g.add(d);
    }
    g.scale.setScalar(scale);
    g.userData = { ad: 'Evrişim', tur: 'conv', girisSekli: [], cikisSekli: [], parametre: 0 };
    return g;
  };
}
```

- Gölge bayraklarını tüketici ayarlar (`traverse` ile `castShadow` vb.).
- Sökerken `geometry.dispose()` + `material.dispose()` tüketicinin işidir ve
  malzemeler blok içinde ONLARCA mesh tarafından paylaşıldığı için mesh başına
  değil **benzersiz kaynak başına** bir kez yapılır (vitrinin `sok()` deseni).

## Gösterim sayfası

`/presets/ml_layer_blocks/index.html` — on blok 5×2 ızgarada, sehpalarında
salınır; her bloğun altında **adı, giriş→çıkış şekli ve parametre sayısı** DOM
etiketi olarak yazar (tuvale çizilmez: seçilebilir, erişilebilir metin).

- `?blok=conv|pool|dense|…` tek bloğa odaklanır (daha güçlü 3/4 açı).
- `?palet=obsidyen|gece|grafit|fildisi` paleti değiştirir — **yeniden kurmadan**.
- `?ag=1` "Ağ kur": dokuz bloğu bir CNN olarak `zincirle`+`diz` ile dizer ve
  blok blok oturtur; kamera zincir uzadıkça geri çekilir. Toplam parametre
  ekranda ve konsolda yazar.
- `?t=<sn>` sabit-zaman modu (headless doğrulama), `?export=1` dışa aktarım
  tablosu, `prefers-reduced-motion` desteklenir.
- OrbitControls vendor'dan gelir (`../moon_advanced/vendor/controls/OrbitControls.js`),
  **CDN yok**; yüklenemezse sayfa sabit kamerayla çalışır.
- `window.__mlblok` = `{ advance(sn), setPalette(ad), rebuild(), focus(id),
  ag(acik), kamera({poz,hedef}), bilgi(), ozet() }` — `bilgi()` her bloğun
  ad/şekil/parametre/ölçü kaydını döndürür (headless sayı doğrulaması bunu
  konsoldan okur).

Hareket kaydı `motion-manifest.json` içindedir: `mlblok-inceleme-salinimi`,
`mlblok-odak-gecisi`, `mlblok-ag-kurulumu` — üçü de illustrative, doğrulayıcı
0 hata / 0 uyarı.
