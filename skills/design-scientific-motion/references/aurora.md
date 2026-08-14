# Aurora preset

Files: `/presets/aurora/` — `aurora-sky.mjs` (`mountAurora`),
`index.html` (kâşif sayfası, `window.__aurora`), `motion-manifest.json`
(7 motion, doğrulandı: 0 hata / 0 uyarı). Kozmosun KARDEŞİ: aynı mount
deseni, aynı seçenek dili (`seed`, `activity`, `density`, `active`,
`exportMode`), aynı vendor + stil sayfası (`moon_advanced/vendor`
import map, `moon_react_source.css`). Palet: `aurora-boreal-dark`
(`design-space-science-deck/presets/color_themes/palette-library.css`).

Kozmos bir SKYBOX'tur (kamera merkezde, nesne yok); aurora bir SAHNEDİR —
ufuk, yükseklik ekseni ve gerçek km ölçeği vardır. Ortak olan: tohumlu
determinizm, `advance(dt)`, donmuş export tablosu, `active:false` iken
rAF kurulmaması.

## Fizik — sahnenin omurgası

Auroral renk keyfî değildir; TÜRE ve YÜKSEKLİĞE bağlıdır. Dört emisyon
her fragmentte, o fragmentin **yüksekliğinden** hesaplanır:

| çizgi | tür | ömür | yükseklik | mekanizma |
|---|---|---|---|---|
| **557,7 nm** | O(¹S) | ~0,7 s | ~100–150 km | altta O₂ ile sönümleme (n_kr ≈ 3,6×10¹² cm⁻³ toplam-eşdeğer) |
| **630,0 nm** | O(¹D) | ~110 s | **yalnız ≳200 km** | n_kr = A/k = (1/110)/(2×10⁻¹¹) ≈ **4,5×10⁸ cm⁻³** |
| **427,8 nm** | N₂⁺ 1NG | ani (~60 ns) | ≲110 km | sönümleme YOK, iyonlaşmayı birebir izler |
| **N₂ 1PG** | N₂ | ani | 90–110 km | 427,8 ile toplanınca **PEMBE alt kenar** |

Pembe ayrı bir "çizgi" değildir: 1PG kırmızısı + 427,8 moru. Bu yüzden
sahnede pembe ancak sert çökelme alt kenara indiğinde belirir — elle
boyanmaz.

**Atmosfer** (tek kaynak: `P` nesnesi; GLSL bu nesneden ÜRETİLİR, bu
yüzden yazı ile piksel ayrışamaz):
- `log10 n(h)`: taban eğim + 4 softplus eğim kırılması. C∞ — düğüm
  noktalı tablo interpolasyonu ekranda tam o yükseklikte YATAY BANT
  gösteriyordu (ilk denemede görüldü, düzeltildi). 100–400 km hedeflerine
  rms 0,031 dex.
- `fO(h)`: O/N₂ oranı yükseklikle üstel artar (difüzif ayrışma).
- Çökelme: alt kenar KESKİN (Gauss σ=7,5 km — nüfuz derinliği), üst
  kuyruk dağınık (üstel, 42 km). Tepe: `h ≈ 86 + 130/(1+(E₀/2,2)^1,1)` km
  → 1 keV≈180 km, 10 keV≈106 km, 20 keV≈97 km. Spektrum tek enerjili
  değil: sert bileşen E₀(Kp) + **sabit yumuşak kuyruk 0,7 keV (~187 km)**
  — kırmızı tacın kaynağı odur.

**Renk**: dört dalga boyunun sRGB'si CIE 1931 renk eşleme
fonksiyonlarından (Wyman–Sloan–Shirley çok-loblu uyum) hesaplanır; gamut
dışı negatif bileşen beyaza doğru doygunluk azaltılarak kapatılır. Elle
girilmiş hex YOK. 557,7'nin fotopik karşılığı gerçekten sarı-yeşildir;
okunabilirlik için %17 beyazlatma uygulanır ve bu bir sunum kararı olarak
altyazıda yazılıdır.

## Kumandalar — üçü de fiziği sürer

1. **Aktivite (Kp 0–9)** → `E₀ = 3,5 + 1,9·Kp` keV (sertleşme → alt kenar
   135 km'den 97 km'ye iner), akı `0,30 + 0,42·Kp`, yumuşak pay
   `0,42 − 0,030·Kp`, ve oval ekvatora genişledikçe yay yaklaşır
   (`d = 130 + 340·e^(−0,30·Kp)` km). Morfoloji sırası GERÇEK: homojen yay
   (Kp<1,6) → ışınlı yay → katlanan perde → alt fırtına başlangıcı →
   kopma (Kp>7,4; yerel sarmal çıkıntı batıya ilerler).
2. **Atom yoğunluğu (×0,35–2,6)** → `n(h)` çarpanı. İKİ sonuç aynı
   sayıdan: (a) 630,0'ın sönümleme tabanı yükselir → **kırmızı taç
   fiziksel olarak söner**; (b) yoğun havada elektronlar daha YUKARIDA
   durur (`h_tepe += 8·ln(n)`) → perde bütünüyle yükselir. Ekranda kısa
   bir satır NEDENİ yazar ve eksende `630,0 tabanı` işareti kayar.
3. **Emisyon çizgisi şiddetleri** (ham RGB değil): her biri dalga boyu +
   tür + yükseklik aralığı etiketli, yanında o dalga boyunun CIE rengi.
   Ayrıca **serbest renk (sanatsal)** kipi: fiziksel eşlemeyi bırakır,
   katmanlanma (yapısal olduğu için) kalır, ve "RENKLER FİZİKSEL DEĞİL"
   uyarısı hep-görünür telemetri satırına + not kutusuna + altyazı
   vurgusuna yazılır.

**Yükseklik ekseni** (SVG bindirmesi): 100–350 km çentikleri sahnenin
GERÇEK kamerasından, birincil perdenin uzaklığında ve vertex shader'ın
kullandığı alan çizgisi yönünde izdüşürülür — kamera kaydıkça doğru
kalır. İki türetilmiş işaret aynı eksende: `çökelme tepesi` (Kp + yoğunluk)
ve `630,0 tabanı` (yoğunluk). İkisi de JS'te, GLSL'e derlenen AYNI
sabitlerden hesaplanır.

## Görsel gövde

Perde = alan çizgisine hizalı şerit ağı (PlaneGeometry 200×76, vertex
shader parametrik: yay + katlar + sarmal + alan çizgisi kayması).
Geometri **82–360 km arası SABİT**, asla yeniden kurulmaz; neyin görüneceğine
yalnız emisyon modeli karar verir → alt kenar keskinliği bir eşik değil,
fiziğin sonucudur. 3 perde × (1–2 paralel yaprak) = 5 additive mesh,
uzak perdeler daha kısa ve sönük (uçları kadraj içinde biter → derinlik);
uç sönümü uzakta DAHA GENİŞ (`envW` 0,20 → 0,44) — dar sönüm kadrajda
görünür bir DİKDÖRTGEN kenarı bırakıyordu, chrome kapalıyken yakalandı.
Işın demetleri yay boyunca yapılı, yükseklik boyunca neredeyse değişmez;
**ömre göre yumuşatılır**: 427,8/1PG yapıyı birebir izler, 557,7 %88,
630,0 yalnız %16 — 110 s'lik durum yapıyı siler, taç bu yüzden dağınıktır.
Ayrıca yıldız alanı (kozmosun ışıklılık yasası + kara cisim rampası +
ufka doğru sönüm), 97 km'lik 557,7 hava parıltısı (van Rhijn ufka doğru
~6×) ve tohumlu ufuk sırtı.

**Işık bütçesi**: `col/(1+0,85·col)` yumuşak omuz + ACES. Gösterilen
parlaklık akının KAREKÖKÜYLE ölçeklenir (`exposure · akı^−0,62`) — gerçek
akı Kp ile bir kat mertebesinden fazla değişir, ham hâliyle ya beyaza
kırpar ya sakin yayı yok ederdi. **Sıra korunur, mutlak fotometri
korunmaz** ve bu manifestte yazılıdır.

**Epilepsi güvenliği**: küresel parlaklık salınımı ±%12 (`uPulse ≤ 0.12`),
sürekli parlama/neon yok. Gerçek *pulsating aurora* (2–20 s, yüksek
kontrast) bilerek YAPILMADI; manifest bu ödünü açıkça yazar.

## API

```js
import { mountAurora } from './aurora-sky.mjs';
const aurora = mountAurora(container, {
  seed: 20260814,
  kp: 4,                 // 0–9 aktivite (activity: 0–1 ya da 0–9 da kabul edilir)
  activity: .45,         // kozmosla ortak ad: ≤1 ise 0–1 ölçeği, >1 ise Kp
  density: 1,            // ATOM YOĞUNLUĞU çarpanı 0,35–2,6 (sönümleme sürücüsü)
  lines: { green: 1, red: 1, blue: 1, pink: 1 },   // emisyon çizgisi şiddetleri 0–1,6
  drift: .28,            // perde ilerleme hızı çarpanı
  artistic: false,       // serbest renk (sanatsal) — altyazıda İLAN EDİLİR
  artHue: .55,           // serbest kip tonu 0–1
  exposure: 1.35,        // gösterim pozlaması (akı ile sıkıştırılır)
  stars: true, horizon: true, axis: true, airglow: true,
  fov: 74,
  chrome: 'full',        // 'none' → başlık/kontrol/altyazı YOK (deste fonu)
  active: true,          // false → rAF kurulmaz, advance(dt) sürer
  exportMode: undefined, // undefined → ?export=1 / html[data-export=true]
});
aurora.setParams({ kp: 8, density: .5, lines: { red: 1.4 } });  // = setOptions
aurora.advance(seconds);        // deterministik zaman sürüşü (export, test, dekor)
aurora.setActive(bool); aurora.pause(); aurora.play(); aurora.resetView();
aurora.physics.emission(h, kp, density);      // shader'ın JS ikizi
aurora.physics.redBaseAltitude(kp, density);  // 630,0 yarı-tepe tabanı (km)
aurora.lineColors();            // o anki dört renk (fiziksel ya da sanatsal)
aurora.canvas;                  // deste kompoziti için ham tuval
aurora._state; aurora.dispose();
```

`mountAurora` senkrondur (doku yüklemesi yok); `await` zararsızdır.
Klavye: Boşluk durdur · R sıfırla · A sanatsal renk. Sürükle = bakış.

### Deste fonu olarak

```js
const aurora = mountAurora(offscreenHost, {
  chrome: 'none', active: false, axis: false, kp: 2.5, drift: .15,
});
// deste kendi rAF'ında:
aurora.advance(dt);
ctx.drawImage(aurora.canvas, x, y, w, h);
```
Host'u mount'tan ÖNCE CSS ile boyutlandır (gizli sekmeler ResizeObserver
teslim etmez — sol/kozmos dekor sözleşmesinin aynısı).

## Deterministik açılış (kâşif sayfası)

`?kp=6&yogunluk=0.4&cizgi=yesil,kirmizi&t=3` — `t` verilirse rAF hiç
kurulmaz ve sahne 1/60'lık adımlarla tam `t` saniyeye ilerletilir
(kare kare karşılaştırılabilir). Ek: `sanatsal=1`, `ton=0..1`,
`tohum=…`, `export=1`. **`t` yalnız doğrulama/ekran görüntüsü içindir —
deste gömme adresine KOYMA, sahneyi dondurur ve "bug" gibi okunur.**

## Doğrulama (yapıldı)

Headless: `--allow-file-access-from-files --enable-unsafe-swiftshader
--virtual-time-budget=6000 --enable-logging=stderr --v=0`, 1920×1080,
5 tur × 4–8 kare. Konsol INFO:CONSOLE satırı: 0.
Manifest: `node scripts/validate-motion-manifest.mjs
/presets/aurora/motion-manifest.json` → 7 motion, 0 hata, 0 uyarı.

## Sözleşme uyumu (webgl-scene-contract.md)

1. Her katman adlandırılmış bir olgu; adlandıramadığın efekt yok.
2. Geometri PARAMETRİK ve sabit — 82–360 km ağı hiç yeniden kurulmaz;
   yoğunluk/Kp/çizgi değişimleri uniform üzerinden sürekli.
   `smoothstep` kenarları hep `a<b` yönünde (ters yön UB'dir; burada
   `1.-smoothstep(a,b,x)` kullanıldı).
3. Her fragment `#include <tonemapping_fragment>` + `<colorspace_fragment>`
   ile biter; kareler çarpımla alınır; `pow(max(o,1e-4),.45)` ile negatif
   taban yok; `aurPow10` üstel taşmaya karşı kırpılır; softplus içindeki
   `exp` 30'da sınırlanır.
4. Additive ışık HUE'ya doyar (dalga boyu renkleri), beyaza değil; bloom
   yok → alt-piksel nokta kaynaklı mip titremesi sınıfı hata imkânsız.
5. Tohumlu dağılımlar (yıldız ışıklılık yasası, ufuk Fourier silueti).
6. `advance(dt)` tek saat; `Math.random`/`Date.now` yok; export ve
   reduced-motion aynı deklare tabloyu (t=16 s) verir.
7. Vendored three (import map), DPR ≤ 1,5, `preserveDrawingBuffer`,
   sekme gizlenince rAF durur, `active:false` iken hiç kurulmaz.
