# aircraft_blocks — parametrik hava aracı kütüphanesi

`craft-blocks`'un havacılık ikizi. Aynı sözleşme, aynı palet anahtarları,
aynı eksen düzeni — bir sahnede uzay aracı ile uçak yan yana durabilsin diye.

## Donmuş API

```js
import { buildAirliner, buildFighter, buildDelta, buildWaverider,
         buildGlider, buildFlyingWing, buildAircraft,
         AIRCRAFT_BUILDERS, AIRCRAFT_ENVELOPE, AIRCRAFT_PALETTE,
         applyAircraftPalette, nacaSection } from './aircraft-blocks.mjs';

const ucak = buildAirliner({ scale: 2, palette });      // → THREE.Group
buildAircraft('fighter', { scale: 2 });                 // isimle; bilinmeyen ad → yer tutucu
```

- Dönen değer: `THREE.Group`, en uzun boyut ≈ `1 × scale`, orijin geometrik merkezde.
- **Eksenler: +X ileri (uçuş yönü), −X egzoz, +Z yukarı, ±Y kanat açıklığı.**
  craft-blocks ile birebir aynı — sahneler buna güvenir.
- `palette = { body, panel, accent, metal }`; `applyAircraftPalette(root, p)`
  görünür aracı YENİDEN KURMADAN renkleri tazeler (webgl-scene-contract §2).
- `buildDelta({ droopNose: 12 })` burnu eğer (düşük hızda görüş mekanizması).
- `buildAirliner({ gear: true })` iniş takımını açar.

### userData

```js
root.userData = {
  preset: 'aircraft-blocks', kind, parts,
  designSize: [x, y, z],     // normalize ÖNCESİ kutu
  modelScale: s,             // tasarım birimi → model birimi
  metrics: { span, area, aspectRatio, areaRef, aspectRatioRef, mac,
             taper, taperRef, sweepQC, sweepLE, sweepLEPanels, sweepLEOuter,
             dihedral, twistTip, rootChord, tipChord,
             spanModel,       // normalize edilmiş modelde açıklık
             stations: [...]  // metrikleri ÜRETEN tablo
           },
  notes: { regime, why },
};
```

`spanModel` ve `stations` bilerek açık: uç vorteksi sahnesi vorteksi TAM uca
koyabilsin, kesit sahnesi kanadı doğru yerden kesebilsin diye.

## Ölçülen değerler (tasarım birimi; AR/λ/süpürme ölçekten bağımsız)

| Araç | AR | AR(ref) | λ | Λ_c/4 | Λ_LE | Uçta burulma | Rejim |
|---|---|---|---|---|---|---|---|
| `airliner` | 9,42 | — | 0,20 | 31,3° | 22°→36° | −3,0° | M 0,20–0,89 |
| `fighter` | 2,08 | **2,42** | 0,10 | 54,0° | 78°→42° | −1,5° | M 0,30–2,00 |
| `delta` | 1,76 | — | 0,06 | 63,4° | **76°→56°** | −2,4° | M 0,30–2,04 |
| `waverider` | 0,37 | — | 0,00 | 82,4° | 82° | 0° | M 4,5–10 |
| `glider` | 31,26 | — | 0,35 | 1,3° | 2°→4° | −2,6° | M 0,05–0,20 |
| `flyingwing` | 5,99 | — | 0,07 | 26,5° | 33,0° | −4,6° | M 0,20–0,85 |

AR 0,37'den 31,3'e: kütüphane açıklık oranının iki ucunu de gösterir, çünkü
bu tek sayı uçağın ne işe yaradığını neredeyse tek başına anlatır.

## İki karar, iki hata pahasına

**1. Sarımı elle tutturmaya çalışma — hacme sor.** Süpürme ya da dihedral
işareti değişince üçgen sarımı sessizce ters dönüyor ve kanat içten
aydınlanıyordu. `finalizeGeo` kapalı meshin İŞARETLİ HACMİNİ hesaplıyor;
negatifse bütün üçgenleri çeviriyor. Bir daha bakmaya gerek kalmadı.

**2. Referans trapezi otomatik türetme.** İlk sürüm "en dıştaki iki
istasyonu merkeze uzat" diyordu. Savaş uçağında doğru çalıştı (LERX dışarıda
kaldı, AR_ref 2,42 çıktı — yayımlanan 2,36'ya çok yakın), ama planörde uç
yuvarlaması küçücük bir panel olduğu için AR_ref 19,5 çıkardı; gerçek AR
31,3 iken. Artık ana paneli KURUCU bildiriyor, bildirmezse alan `null` ve
arayüz "—" yazıyor. Uydurma sayı üretmemek, sayı üretmemekten daha iyidir.

**3. Dikey yüzey işareti — İKİ KEZ.** R_x(θ)·(0,1,0) = (0, cosθ, sinθ).
θ = −90° ⇒ (0,0,−1), yani açıklık AŞAĞI gider.

Bu hata önce kanatçıkta yakalandı (sağ yukarı, sol aşağı bakıyordu) ve orada
düzeltildi — ama **dikey kuyruklarda aynen kaldı**, çünkü onlar ayrı satırlardı
ve tek tek bakılmamıştı. Kullanıcı bildirdi: "uçakların kuyruklarındaki
yapılar yukarı bakması gerekirken aşağıya bakıyorlar." Beş araçta birden.

Ders: bir işaret hatası bulunduğunda **aynı dönüşümün geçtiği bütün yerleri
tara**, yalnız bulunduğu yeri düzeltme. `grep -n "rotation.x = -Math.PI / 2"`
altı satır gösteriyordu.

Kanık çiftlerde ikinci bir işaret daha var: sağ kuyruğun (y>0) TEPESİ dışa
yatmalı, bunun için R_x(**−**side·φ) gerekir.

## Kesit düzlemi: dünya uzayı tuzağı

three.js'te kırpma düzlemleri **DÜNYA uzayındadır**. Düzlemin sabitini bir
kez hesaplayıp bırakmak, torna dönerken düzlemin uçağın içinden testere gibi
geçmesi demek: kesit bazen kanadı, bazen gövdeyi buluyor, çoğu açıda hiçbir
şey kesmiyordu. "Kesit bozuk çalışıyor" şikâyetinin sebebi buydu.

Doğrusu: kesim istasyonunu **yerel** birimde tutmak ve düzlemi her karede iç
grubun dünya matrisinden kurmak —

```js
_kn.set(0, 1, 0).transformDirection(inner.matrixWorld).normalize().negate();
_kp.set(0, sonKesitY, 0).applyMatrix4(inner.matrixWorld);
clipPlane.setFromNormalAndCoplanarPoint(_kn, _kp);
```

Ölçek, merkezleme ötelemesi ve torna dönmesi matrisin içinde zaten var.

Kırpma geometriyi keser ama **kapatmaz**: mesh kabuk olduğu için kesim
yerinde delik kalır. Kapatmanın standart yolu stencil'dir; burada daha
doğrudan bir yol var — kesitin poligonu zaten panelde çizilmek üzere
hesaplanıyor. Aynı noktalarla dolu bir yüz kurulup tam o istasyona konuyor,
böylece paneldeki çizim ile 3B'deki kesim yüzü aynı sayılardan gelir.

## Sahne: karanlık zeminde uçak okunmaz

İlk sürümde araç düz #05070b üstünde duruyordu ve neredeyse siyah bir siluet
gibi görünüyordu. Sebep malzeme değil **ortam eksikliğiydi**: saten boya ve
çıplak metal görüntüsünü YANSITTIKLARI şeyden alır; yansıyacak bir şey yoksa
geriye yalnız bir yönlü ışığın difüz terimi kalır.

Çözüm iki degrade doku: biri fon (gece mavisi, ufuk hizası açık), biri PMREM
ile ön işlenip `scene.environment`'a verilen ortam haritası. Yarımküre ışığı
kaldırıldı — ortam haritası aynı işi hem daha doğru hem yöne bağlı yapıyor,
ikisi birlikte kalınca gövde düz ve donuk çıkıyordu.

Sayfanın varsayılan paleti **havayolu livresi** (açık gövde, lacivert vurgu).
Modülün varsayılanı yine obsidyen–şampanya: craft-blocks ile aynı sahnede
durabilsin diye. Bir yolcu uçağı obsidyende siyah okunuyor ve şekil kayboluyor.

## Sayfa (index.html)

- OrbitControls + tam ekran; araç ve palet seçici; torna anahtarı.
- **Kesit düzlemi**: kanadı gerçekten keser (`renderer.localClippingEnabled`),
  kesme düzleminin sabiti panelin gösterdiği istasyonun dünya y'sidir.
- Çerçeveleme sınır küresinden: planörün açıklığı 3,8 birim, waverider'ınki
  0,54 — sabit mesafede biri taşıyor, öteki kayboluyordu.
- `?arac=&pal=&eta=&kesit=1&burun=&t=&export=1`.
  **`t` sahneyi dondurur** — demo kartına koyma.

**Donmuş kip zamanı durdurur, çizimi değil.** Tek kare çizip rAF'ı hiç
kurmamak tuvali bayatlatıyor: pencere yeniden boyutlanınca ve headless kare
yakalarken tuval SİYAH geliyordu. rAF her zaman döner, donmuş kipte yalnız
`dt = 0`.

## Zemin ve gölge

Gölge yakalayıcı (`ShadowMaterial`) kondu ve gölge hiç görünmedi. Sebep
aliasing ya da gölge kamerası değildi: **%42 koyultulmuş siyah, siyahtır.**
Arkasında zaten neredeyse siyah bir arka plan vardı. Zemin artık gerçekten
aydınlanan, düşük albedolu, yarıçapla sönen alfa haritalı bir disk — gölgenin
koyultacağı bir şey var.

## Kimler kullanıyor

- `aero_airfoil_flow` — aynı `nacaSection` fonksiyonu, aynı kosinüs
  aralığı; panel yöntemine giren geometri ile kanadın kesiti aynı kesittir.
- `aero-flight-regimes-preset` — `AIRCRAFT_ENVELOPE` hangi bloğun hangi
  Mach'ta gösterileceğine karar verir.
- `aero-wake-vortex-preset` — `metrics.spanModel` ve `stations` ile uç
  vorteksleri TAM uca oturur, yükleme dağılımı gerçek veterden gelir.
