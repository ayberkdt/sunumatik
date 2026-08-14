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

**3. Kanıklık işareti.** Kanatçık +Y'ye açılan yarım yüzey olarak kurulup
her iki tarafa aynı X dönmesiyle konunca sağ kanatçık yukarı, sol AŞAĞI
bakıyordu. Doğrusu solu doğrudan −Y istasyonlarıyla kurup dönmenin işaretini
de çevirmek: R_x(∓76°)·(0,±1,0) ikisinde de yukarı.

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
