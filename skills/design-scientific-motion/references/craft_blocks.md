# craft_blocks — parametrik uzay aracı kütüphanesi

`/presets/craft_blocks/craft-blocks.mjs` — sahne bloklarının paylaştığı
araç KÜTÜPHANESİ. Saf kuruculardır: **mount yok, rAF yok, doku çekme yok** —
yalnızca geometri + malzeme. Sözleşme `references/scene-blocks.md` içinde
DONMUŞTUR; buradaki belge o sözleşmenin uygulama ayrıntısıdır.

## API

```js
import {
  buildOrbiter, buildLander, buildRocket, buildCubesat, buildCapsule,
  CRAFT_PALETTE,
} from '../craft_blocks/craft-blocks.mjs';

buildOrbiter({ scale = 1, palette })            // gövde + 2 güneş kanadı + HGA çanağı + motor
buildLander({ scale = 1, palette })             // iniş kademesi: 4 bacak, tanklar, motor çanı
buildRocket({ stages = 2, scale = 1, palette }) // kademeler + ara halkalar + ojiv başlık (stages: 1–3)
buildCubesat({ units = 3, scale = 1, palette }) // raylı nU gövde (units: 1–6), açılır paneller
buildCapsule({ scale = 1, palette })            // mürettebat kapsülü + servis modülü
```

Her kurucu bir `THREE.Group` döndürür.
`group.userData = { preset:'craft-blocks', kind, parts, designSize }` —
`parts` mesh sayısıdır, `designSize` normalizasyon öncesi tasarım boyutudur.

## Eksen sözleşmesi (sözcüklerle diyagram)

```
            +Z  (yukarı / çanak-kapak tarafı)
             |
  egzoz ←────O────→  +X (ileri / hız yönü; roket burnu, kapsül tepesi)
   (−X)      |
            −Z
```

- **+X ileri**: yörünge aracının umbilikal yüzü, roketin burnu, kapsülün tepe
  kapağı, iniş aracının üst güvertesi hep +X'tedir.
- **−X egzoz**: ana motor çanı her araçta −X'e açılır (iniş aracı dahil —
  iniş yönelimini TÜKETİCİ verir; sergide "dik" duruş için grubu
  `rotation.z = Math.PI/2` ile döndürmek yeterlidir).
- **+Z yukarı/çanak**: HGA çanağı, kapsül kapağı (hatch), iniş aracı anteni,
  küpsatın kamera-karşıtı yüzü +Z tarafındadır.
- **Orijin geometrik merkezde**, en uzun boyut ≈ `1 × scale` (kurucu, tasarım
  oranlarını koruyarak tüm grubu normalleştirir — yörünge aracının 2.4'lük
  kanat açıklığı 1'e iner, gövde orantısı korunur).

## Palet kuralları

```js
palette = { body, panel, accent, metal }   // hepsi isteğe bağlı; sayısal renk (0x…)
CRAFT_PALETTE = { body:0x23252c, panel:0x10151d, accent:0xc9a35c, metal:0x9aa0ab }
```

- Varsayılan obsidyen–şampanya ailesidir; eksik anahtarlar varsayılandan dolar.
- Malzeme disiplini (tüm araçlar aynı dili paylaşır):
  - gövde: `MeshStandardMaterial`, roughness 0.55 / metalness 0.35 (satin);
  - panel hücreleri: koyu `panel` rengi + ondan türetilmiş **ince açık çerçeve**
    (iki tonlu grup — doku yok);
  - metal parçalar (nozul, dikme, halkalar): metalness 0.85 / roughness 0.30;
  - **araç başına TEK vurgu (accent) öğesi**: yörünge aracında çanak jantı,
    iniş aracında kenetlenme halkası, rokette ilk ara-kademe bandı, küpsatta
    erişim kapağı, kapsülde kapak (hatch) halkası;
  - emissive yok, doku yok, `Math.random` yok — tamamen deterministik.

## Parça envanteri (kind → başlıca parçalar)

- **orbiter** — 1×0.7×0.6 gövde, ±X metal geçiş plakaları, 4 kenar rayı,
  −Z radyatörü, ±Y boyunduruk+menteşe+15 hücreli kanatlar (açıklık ≈ 2.4),
  +Z direk+parabolik çanak+**şampanya jant**+besleme anteni, −X çan (Lathe),
  greeble: yıldız izleyici, umbilikal panel, 2 RCS dörtlüsü.
- **lander** — sekizgen gövde (düz yüzeyler bacak aralarında), çerçeve güverte,
  **kenetlenme halkası**, alt etek halkası, gerçek çan profili, 4 yarı gömülü
  tank, ~35° açılı 4 bacak (ana+ikincil dikme, ayak tabanı), anten+mini çanak,
  umbilikal, 2 RCS dörtlüsü.
- **rocket** — incelik oranı ~8; motor eteği, merkez+4 çevre çanı, kademe
  silindirleri, **şampanya ara-kademe bandı**, 4 iki-tonlu kafes kanatçık,
  kablo kanalı, tanjant-ojiv başlık (LatheGeometry, gerçek ρ formülü).
- **cubesat** — nU gövde; 4 görünür ray (gövdeden taşkın), raylara göre gömülü
  1U-hücreli yüzey plakaları, ayrılma halkası, kamera açıklığı, 2 teyp anten,
  ±Y menteşeli iki bölmeli açılır paneller, **şampanya erişim kapağı**.
- **capsule** — 33° yan duvarlı kesik koni + küresel tepe kapağı + kenetlenme
  tüneli/halkası, R=0.72 küresel ısı kalkanı + dudak halkası, **kapak (hatch)
  halkası**, geçiş halkalı servis modülü + 4 radyatör plakası + umbilikal
  kaplama + 4 RCS dörtlüsü, −X ana motor çanı.

## Kompozisyon sözleşmesi (tüketiciler için)

- İçe aktarma **göreli yolla** yapılır; başarısızlıkta blok, basit bir yer
  tutucuya düşmek ZORUNDADIR — bloklar birbirine sert bağımlı olamaz:

```js
let buildOrbiter;
try {
  ({ buildOrbiter } = await import('../craft_blocks/craft-blocks.mjs'));
} catch {
  buildOrbiter = ({ scale = 1 } = {}) => {           // yer tutucu: gövde + kanat imasi
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x23252c, roughness: 0.55, metalness: 0.35 });
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.28, 0.24), mat));
    const kanat = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1, 0.01), mat);
    g.add(kanat);
    g.scale.setScalar(scale);
    return g;
  };
}
```

- Gölge/katman bayraklarını tüketici ayarlar (`traverse` ile `castShadow` vb.);
  kurucular bayrak dayatmaz.
- Sökerken `geometry.dispose()` + `material.dispose()` tüketicinin işidir
  (gösterim sayfasındaki `kur()` örnek desendir).
- Görünür araç asla yeniden kurulmaz (webgl-scene-contract §2); palet değişimi
  gibi ayrık kullanıcı eylemlerinde sök-tak serbesttir.

## Gösterim sayfası

`/presets/craft_blocks/index.html` — beş araç dönme sehpalarında, üç
noktalı ışık (sıcak anahtar + yarıküre dolgu + şampanya jant), palet menüsü,
tel kafes anahtarı, Duraklat düğmesi. `?focus=orbiter|lander|rocket|cubesat|capsule`
yakın çekim kamerası kurar. `window.__craft.advance(saniye)` deterministik
sürüş kancasıdır. Hareket kaydı `motion-manifest.json` içindedir
(`craft-turntable` + `craft-engine-ignition`, ikisi de illustrative).

## Motor ateşleme efekti (craft-effects.mjs)

`/presets/craft_blocks/craft-effects.mjs` — DONMUŞ API:

```js
import { buildEngineFX } from '../craft_blocks/craft-effects.mjs';
const fx = buildEngineFX({ scale = 1, tip = 'vakum', seed = 1, palette });
// → { group, update(dt, { gaz, atesle }), dispose() }
```

- `group` orijini MOTOR AĞZINDA; alev −X'e uzar (eksen sözleşmesiyle aynı).
  Tüketici grubu aracın çan çıkışına çocuk olarak ekler.
- `update(dt, { gaz, atesle })` her karede: `gaz` 0..1 throttle; `atesle`
  false→true ateşleme geçici rejimi (~0.3 sn flaş + halka + kıvılcım +
  basınçlanma aşımı), true→false ~0.5 sn sönüm kuyruğu.
- `tip`: `vakum` (geniş açılı seyrek genleşme şalı), `atmosfer` (dar huzme +
  mach elmasları — instanced hücreler), `hover` (kısa/küt iniş huzmesi).
- Katmanlar: gradyan dokulu additive çekirdek + iç dil, tip katmanı, ateşleme
  geçici rejimi, tek PointLight (decay 2), çan iç ağzına oturan emissive kor
  (craft-blocks malzemelerine DOKUNMAZ — ayrı mesh). Bütçe ≤ 8 mesh +
  tek Points + tek Sprite. Parlaklık titreşimi 12–30 Hz karışımı, ±%15 sınırlı.
- Deterministik: seed'li mulberry32; zaman yalnız `update(dt)` toplamı.
- Vitrin: Ateşleme paneli (araç/tip/gaz/Ateşle-Kes);
  `?fx=1&arac=<id>&tip=<tip>&gaz=<0..1>[&t=<sn>]` deterministik açılış —
  `?t=` sabit-zaman modu sahneyi o âna sarıp DONDURUR (headless doğrulama);
  dışa aktarım / azaltılmış harekette tablo t=2.0 sn orta-yanmadır.
  Yumuşak bağımlılık: import başarısız olursa vitrin ateşlemesiz çalışır.
