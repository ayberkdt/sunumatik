# terrain_blocks — Arazi Sistemi · Mühendislik Planı

> Durum: F0–F3 UYGULANDI (23 Eylül 2026) — `presets/terrain_blocks/`
> (terrain-noise · terrain-features · terrain-field · terrain-mesh ·
> terrain-material · terrain-scatter · terrain-query · profiles/ · index.html ·
> motion-manifest.json) ve `scripts/validate-terrain.mjs` (CI). Bu turda
> BİLEREK dışarıda kalanlar: kaskad gölge (§8.3, vendor CSM kararı §14-3
> bekliyor — tek gölge haritası seçilebilir alanla), koridor şerit örgüsü
> (§7, koridor kapıyla güvence altında), tri-planar ve iz dokusu (§5),
> karşıtlık etkisi (light-physics planı), F4 geçişi (§10 G2–G3: surface-scene
> `terrain:'blocks'` bayrağı kullanıcı ekran onayı ister). Bu belge
> `scene-blocks.md` programının ve `webgl-scene-contract.md`'nin uzantısıdır.
> Buradaki her modül/API adı 16 Eylül 2026'da depodan okunarak doğrulandı;
> "varsayılan" bağımlılık yok.
>
> **SAHA YERLEŞİMİ (24 Eylül 2026):** §13 R2'nin `site` kapısı artık bir
> ÇÖZÜCÜYLE besleniyor: `presets/terrain_blocks/site-plan.mjs` (three'siz,
> deterministik) 11 adlandırılmış yerleşim kuralını — reaktör ≥ 1 km,
> iniş pisti ≥ 500 m ve ±30° ejecta konisi, yakıt ↔ O₂ ≥ 50 m, radyatör
> Güneş'e sırt, garaj ≤ 150 m, ISRU rüzgâr üstü (Mars), eğim eşiği,
> çakışma — sert/yumuşak diye ayırıp yerleşimi çözer ve ürettiği
> `clearings` listesini doğrudan `createTerrainField`'a verir. Vitrin:
> `presets/site_plan/`. Doğrulama: `scripts/validate-site.mjs` (28 denetim,
> CI). Bu tur `terrain-field.mjs`'de bir KUSURU da düzeltti: kapılar tek
> genel datuma tesviye ediyordu, bu yüzden orijinden 1 km ötedeki bir
> modül orijinin kotasına kazınıyor, koridorlar 30 m derin kanyon
> açıyordu (ölçüldü, moon-highland). Artık her kapı KENDİ referans
> noktasına tesviye eder; koridorun referansı en yakın eksen noktasıdır,
> yani yol araziyi takip eder.
>
> Kardeş planlar: [physical-rigs-plan.md](physical-rigs-plan.md) (arazi
> sorgusunu tüketen tekerlek/süspansiyon), [light-physics-plan.md](light-physics-plan.md)
> (regolit BRDF, gölge, far ışığının zemine düşüşü),
> [astronaut-figure-plan.md](astronaut-figure-plan.md) (ayak yerleşimi).

---

## 0. Kullanıcı talebi ve boşlukların doldurulması

Talep: *"Presetlere terrain yapısı; yüzeyde dağlar, çukurlar olsun ki rover
için alelade düz zemin yerine canlı dokulu, ilgi çekici bir görüntü çıksın."*

Talebin söylemediği ama planın karşılamak zorunda olduğu şeyler:

| Boşluk | Neden kritik | Nerede çözülüyor |
|---|---|---|
| Arazi yalnız GÖRÜNTÜ değil, **sorgulanabilir yüzey** olmalı | Tekerlek teması, gezgin duruşu, astronot ayağı, gölge — hepsi `h(x,z)` ve `n(x,z)` ister | §6 sorgu API'si |
| Dağlar Ay'da tektonik değil, **krater kenarı ve masif**tir; Mars'ta rüzgâr/su erozyonu vardır | Sözleşme §1: her biçim adlandırılmış bir olguya gider | §4 gezegen profilleri |
| **Ölçek dürüstlüğü**: 1 birim = 100 m, ufuk eğriliği gerçek yarıçapla | lunar_descent ve surface-scene bu sözleşmeyle yazıldı; yeni sistem bozamaz | §3 birim sistemi |
| Görünen geometri **yeniden kurulmaz** (sözleşme §2) | Sürüş sırasında "arazi çiğ olarak yeniden örülüyor" görüntüsü kabul edilemez | §7 LOD stratejisi |
| **Determinizm**: aynı seed → aynı arazi, aynı kare | Export, CI piksel-diff, deste tekrar üretimi | §9 |
| **Performans bütçesi** — arazi tek başına kareyi yemez | cinematic_space dalışı zaten doku+arazi zirvesi (R8) | §8 |
| Mevcut iki arazi (surface-scene, lunar_descent) **kırılmadan** yaşamaya devam eder | Eksen dersi: çalışan geometriyi toplu yeniden yazma hatası | §10 geçiş stratejisi |
| Gölge haritası frustumu arazide **çalışmaz** (tek 1024² harita ±40 m'ye sıkılmış) | Dağların uzun gölgesi görünmezse "alçak güneş" dili yalan olur | §8.3 kaskad gölge |

## 1. Bugün ne var (kaynağından okundu)

| Yer | Ne | Sınır |
|---|---|---|
| `presets/cinematic_space/surface-scene.mjs` (563 satır) | `buildSurfaceScene({seed, assetBaseUrl})` → kutupsal ızgara (320 açısal × ~380 halka, oran 1,025, dış yarıçap 3 600 km), analitik `araziYukseklik(x,z)`: sagitta + güç-yasalı krater alanı (4 halka) + mare sırtları + 3 oktav değer-gürültüsü + saha kraterleri + mikro kabartma; `MeshLambertMaterial` (Lunaris albedo 9×, disp bump 220×); 46 kaya + 160 çakıl (InstancedMesh); alçak Güneş 14° + yarımküre dolgu; vista kamerası | Tek malzeme, tek `computeVertexNormals`, gölge yalnız gezgin çevresinde; "dağ" yok — sırtlar en çok 9 birim (900 m) |
| `presets/lunar_descent/lunar-descent.mjs` (2 198 satır) | Kapanışa gömülü `araziYukseklik` (satır 1202), `bolgeAlbedosu(seed, kraterler, kapsam, 2048)` bölge albedo dokusu (satır 406), `onBeforeCompile` dört-tap detay shader'ı (satır 475/539), kaya etek izleri, toz süpürmeleri | Sökülemez (plan R2); premium katman burada ama yeniden kullanılamaz durumda |
| `presets/moon_advanced/lunaris-moon.mjs` + `moon_react_source/public/lunaris/textures/` | `aesthetic_moon_real.webp` albedo, `moon_disp_real.webp` yükseklik | Küre için; arazide tekrar dokusu olarak kullanılıyor |
| `presets/core/lab-three.mjs` | `mulberry32`, `starfield`, `glowSprite`, `atmosphereShell` | Arazi yardımcısı yok |
| `presets/core/geometry-axis.mjs` | `cylX/Z`, `coneX/Z`, `latheX/Z` | Arazi geometrisi BufferGeometry'dir, kural kapsamı dışı; kaya/işaret dikmeleri kapsam içi |

Sonuç: arazi bugün **iki kopya reçete** (biri sökülemez, biri kompakt) ve
**yalnız Ay**. Kullanıcının istediği "dağlı, çukurlu, canlı" yüzey için ne
yükseklik alanı ne malzeme ne LOD yeterli.

## 2. Hedef: `presets/terrain_blocks/` — mount'suz arazi KÜTÜPHANESİ

craft_blocks felsefesinin arazi ikizi: **saf kurucular**, rAF yok, sahne
yok; sahneler (cinematic_space, lunar_descent, ileride mars/astronot
sahneleri) bunu tüketir. Bloklar arası sert bağımlılık yasağı gereği
tüketici, import başarısızlığında **düz plaka + sagitta** yer tutucusuna
düşer.

```
presets/terrain_blocks/
├── terrain-field.mjs        # yükseklik alanı KOMPOZİTÖRÜ: katmanlar → h(x,z)
├── terrain-features.mjs     # olgu kütüphanesi: krater, masif, sırt, kanyon, kumul, vadi, dayk
├── terrain-mesh.mjs         # örgü: kutupsal + halka LOD; analitik normal; tangent
├── terrain-material.mjs     # regolit/bazalt/kum malzemeleri: eğim-albedo, tri-planar, detay merdiveni
├── terrain-scatter.mjs      # kaya/çakıl/ejecta bloğu: mavi-gürültü yerleşim, InstancedMesh
├── terrain-query.mjs        # h, ∇h, n, eğim, en yakın kaya — fizik ve figürler için (plan 2/4)
├── profiles/
│   ├── moon-mare.mjs        # Mare Tranquillitatis dili: düz, sırtlı, seyrek büyük krater
│   ├── moon-highland.mjs    # Güney yaylası: doygun krater alanı, masifler
│   ├── moon-polar-rim.mjs   # Shackleton kenarı: dik yamaç, kalıcı gölge
│   ├── mars-plain.mjs       # Gale/Jezero: yumuşak tepeler, kumul alanları, katmanlı mesa
│   ├── mars-canyon.mjs      # Valles Marineris kenarı: kanyon duvarı + heyelan yelpazesi
│   └── generic-rocky.mjs    # gezegen bağımsız kayalık (ML/soyut sahneler için)
├── index.html               # vitrin: profil menüsü, seed, eğim/yükseklik haritası, ?export=1
└── motion-manifest.json     # arazi hareketsizdir ama gölge süpürmesi + vitrin turu kayıtlıdır
```

## 3. Birim sistemi ve ölçek dürüstlüğü

- **1 birim = 100 m** (lunar_descent ve surface-scene ile aynı). Değişmez.
- Ay yarıçapı `R_AY_BIRIM = 17 374`; Mars `R_MARS_BIRIM = 33 895`. Sagitta
  `−d²/(2R)` her profilde taban katmandır; ufuk eğriliği gerçek.
- Yükseklik abartısı (`exaggeration`) profil parametresidir, **varsayılan 1**;
  1'den farklıysa manifest ve altyazıda İLAN edilir (cinematic ölçek
  ilkesi, cinematic-space-plan §11).
- Gerçek referans yükseklikler (plan tasarımında kullanılacak çapalar):

| Biçim | Gerçek ölçü | Birim |
|---|---|---|
| Mare sırtı (wrinkle ridge) | yükseklik 50–300 m, genişlik 1–10 km, uzunluk 10–100 km | H 0,5–3, w 10–100 |
| Küçük krater (basit) | derinlik/çap ≈ 0,2 (taze) → 0,05 (aşınmış); kenar yüksekliği ≈ 0,04·D | mevcut reçete uyumlu |
| Karmaşık krater (D > 15–20 km Ay'da) | merkez tepe, teraslı duvar, d/D ≈ 0,1 | §4.1 yeni |
| Havza masifi (Montes Apenninus) | 3–5 km yükseklik, 30–60 km taban | H 30–50 |
| Mars kumulu (barchan) | 5–30 m yükseklik, 100–300 m genişlik, kayma yüzü 30–34° | H 0,05–0,3 |
| Mars mesa | 50–500 m, dik duvar + talus 30–35° | H 0,5–5 |

Regolit için **durma açısı** (angle of repose) 30–35°: gevşek örtü katmanı
bundan dik yamaçta durmaz; §4.4 "eğim kırpma" bu fiziği uygular.

## 4. Yükseklik alanı: olgu katmanları

### 4.1 Katman modeli

`h(x,z) = sagitta + Σ katman_i(x,z) · kapı_i(x,z)`. Her katman:

```js
// terrain-field.mjs
export function createTerrainField({ seed, radiusUnits, layers, clearings }) 
// → { height(x,z), gradient(x,z,out), normal(x,z,out), slope(x,z), bounds, describe() }
```

Katman türleri (`terrain-features.mjs`), her biri **adlandırılmış olgu**:

| Katman | Model | Not |
|---|---|---|
| `craterField` | Güç-yasalı boy dağılımı (Neukum üretim fonksiyonu eğimine yakın kümülatif N ∝ D^−2 benzeri; mevcut `pow(rnd, 2.6)` reçetesi korunur), basit çanak `−d + (d+rim)·s^k`, ejecta `rim/s²` | Mevcut reçete. Yeni: **aşınma yaşı** parametresi (kenar yumuşatma + dolgu) ve **üst üste binme** (genç krater yaşlının kenarını keser: max değil TOPLAM, ama yaşlı kenar gencin çanağı içinde bastırılır) |
| `complexCrater` | D > eşik: merkez tepe (Gauss), teraslı duvar (kademeli smoothstep), düz taban | Havza ölçeğinde "dağ" hissini bu verir |
| `massif` | Ridged multifractal (1 − |noise|)^p, domain warping ile kırık silüet; taban yarıçapı ve tepe yüksekliği çapalı | Ay'da havza halka dağları: **halka boyunca** yerleşir (`ringMassif`: merkez, R, açısal aralık) |
| `wrinkleRidge` | Mevcut sırt reçetesi + sinüzoidal kıvrım + asimetrik kesit (bir yamaç dik) | Mare profilleri |
| `canyon` | Çizgisel çukur: derinlik profili, duvar eğimi, tabanda ikincil kanal, kenarda heyelan yelpazesi | Mars |
| `dune` | Barchan yerleşimi (rüzgâr yönü parametre): hilal şekli, yumuşak rüzgâr üstü, 32° kayma yüzü | Mars; Ay'da YASAK (atmosfer yok — kapı hata verir) |
| `mesa` | Katmanlı plato: sert tabaka üstte, altta talus konisi | Mars |
| `fbm` | 3–5 oktav değer gürültüsü (mevcut `deger2`) — genel kabarma | Her profil |
| `microRelief` | 30–80 cm dalga boyu ±3–4 cm (mevcut) | Yalnız kamera yakın alanında |

### 4.2 Kapılar (clearings)

Mevcut sistemdeki "vista temiz / ped temiz" mantığı genelleştirilir:

```js
clearings: [
  { at:[0,0], r:3.5, flatten:'large', keep:['microRelief','fieldCraters'] }, // gezgin pedi
  { path:[[0,0],[12,-4],[30,-9]], w:1.2, flatten:'drivable', maxSlopeDeg:15 },  // sürüş koridoru (plan 2)
]
```

`drivable` kapısı: koridor boyunca büyük biçimler bastırılır, eğim 15°'ye
kırpılır, kayalar yerleşmez — gezgin sürüşü **arazi tasarımı** ile güvence
altına alınır, çarpışma çözücüyle değil.

### 4.3 Domain warping ve tekrar kırma

Tek gürültü tekrarı gözle sayılır (sözleşme §5). Her profil iki ölçekli
domain warp (`p' = p + A·noise(p/λ)`) kullanır; frekans oranları
ölçüşmez (φ³ hilesi, lunar_descent'ten). Vitrin, 5 farklı seed'in
yükseklik haritasını yan yana basar; gözle "aynı desen" çıkmamalı.

### 4.4 Eğim kırpma (fiziksel)

Gevşek regolit 35°'yi aşan yamaçta akar. `slopeClamp` son katmanı:
eğim > 35° olan hücrelerde yükseklik yerel olarak "dökülür" (tek geçişli
termal erozyon yaklaşımı, CPU'da örgü kurulurken; analitik `height()`
bu düzeltmeyi bir düzeltme dokusundan (`slopeFixTex`) okur). Mars'ta
sert kaya duvarlar (`mesa`, `canyon`) kırpmadan MUAF — kaya akmaz.

## 5. Malzeme: "canlı doku" bu katmanda kazanılır

Kullanıcının "alelade düz zemin" şikâyetinin yarısı geometri, yarısı
malzemedir. lunar_descent'in premium katmanı (dört-tap detay + bölge
albedosu) burada **yeniden ve paylaşılabilir** yazılır.

- **Temel BRDF**: regolit için Lambert + **karşıtlık etkisi** (opposition
  surge, Hapke; faz açısı → 0'da parlaklık artışı). light-physics-plan
  §5'te tanımlanır; arazi malzemesi bu shader parçasını `onBeforeCompile`
  ile alır. Mars kumu: Lambert + hafif ileri saçılma. Bazalt kaya: Standard,
  roughness 0,9.
- **Eğim-albedo**: yamaçlar taze (daha açık) — kayalık; düzlükler tozlu
  (daha koyu, daha kırmızı Mars'ta). `albedo = mix(dust, rock, smoothstep(20°,35°,slope))`.
- **Yükseklik-albedo**: Ay yaylası mare'den açık (0,16 vs 0,07 albedo);
  profil parametresi.
- **Detay merdiveni** (dört-tap): albedo tekrarı 9× / 60× / 220× / 900×,
  ağırlıklar kamera mesafesine göre — tekrar hiçbir mesafede okunmaz.
  lunar_descent satır 475/539'daki yaklaşımın belgeli yeniden yazımı.
- **Tri-planar** yalnız dik yamaçlarda (eğim > 40°): UV gerilmesi kanyon
  duvarında görünmez.
- **Bölge albedosu**: kraterlerin ışın sistemleri (ray systems — taze
  ejecta açık), sırt üstlerinde koyulaşma; `bolgeAlbedosu` reçetesi
  2048² CanvasTexture olarak profil kurulumunda bir kez üretilir.
- **Tekerlek izleri / ayak izleri**: ayrı bir "iz dokusu" (RenderTarget,
  dünya-uzayında sabit karo); rig'ler (plan 2/4) iz basar. Malzeme bu
  dokuyu koyulaştırma + normal bozma olarak okur. Vakumda iz KALICIDIR.

## 6. Sorgu API'si (fizik ve figürler bunu tüketir)

```js
// terrain-query.mjs — hepsi saf ve tahsissiz (out parametreli)
q.height(x, z)                    // birim
q.normal(x, z, outVec3)           // analitik gradyan (merkezi fark, adım = yerel çözünürlük)
q.slopeDeg(x, z)
q.contact(x, z, rWheel, outHit)   // tekerlek yarıçaplı temas: silindir–yükseklik alanı (plan 2)
q.raycastDown(x, y, z, outHit)    // dikey ışın; kaya instance'larını da tarar
q.nearestRocks(x, z, r, outList)  // engel kaçınma / ayak yerleşimi
q.isClear(x, z)                   // kapı içinde mi
```

Kural: `height` **analitik**tir (örgüden okunmaz); örgü zaten bu
fonksiyondan örülür, dolayısıyla tekerlek asla "örgü ile analitik arası
boşlukta" havada kalmaz. LOD seyreldiği uzak halkalarda görsel örgü
analitikten sapar ama orada temas sorgusu yapılmaz (koridor kapısı
yakın halkalarda kalır).

## 7. Örgü ve LOD

- **Taban**: mevcut kutupsal geometrik ızgara korunur (merkez sık, ufka
  seyrek; 320 açısal). Kanıtlı ve bütçesi bilinen çözüm.
- **Sürüş için**: sürüş koridoru boyunca ikinci bir **yüksek çözünürlüklü
  şerit örgüsü** (koridor genişliği × 20 cm hücre) kutupsal örgünün
  ÜSTÜNE değil, kutupsal örgüde koridor bölgesi **delinerek** (index
  buffer'da üçgenler atlanır) yerleştirilir. Görünür yeniden kurma yok:
  ikisi de kurulumda üretilir.
- **Uzak halkalar**: normal haritası yerine vertex normal + ufuk siluet
  gürültüsü; 36 000 birim dış yarıçap surface-scene'den (Samanyolu
  sızması dersi).
- Kamera hareketli sahnelerde (dalış) "geometri kayması" yok; LOD
  **statik**tir. Dinamik clipmap bilinçli olarak **reddedildi**: sözleşme
  §2 (görünür geometri yeniden kurulmaz) ve determinizm.

## 8. Performans ve gölge

### 8.1 Bütçe (çıkış kriteri, `?perf=1`)
| Öğe | Hedef |
|---|---|
| Arazi üçgen sayısı | ≤ 400 k (kutupsal ~250 k + koridor ≤ 150 k) |
| Çizim çağrısı (arazi + kaya + çakıl) | ≤ 6 |
| Kurulum süresi (height alanı + örgü + dokular) | ≤ 400 ms masaüstü; kurulum kokpit idle'ında gizli yapılır (chapter-router deseni) |
| Kare maliyeti (arazi kısmı) | ≤ 2,5 ms @1080p |

### 8.2 Kaya/çakıl
`terrain-scatter.mjs`: mavi-gürültü (best-candidate) yerleşim, boy
dağılımı düşük-eğik nadir büyük (sözleşme §5), eğime göre yoğunluk
(krater ejecta halkalarında ve masif eteklerinde daha çok), tek
InstancedMesh/boy sınıfı (3 sınıf: blok, kaya, çakıl). Kayalar yarı
gömülü ve **yerel normale** yatırılır.

### 8.3 Kaskad gölge (CSM)
Tek 1024² gölge haritası dağ gölgesini taşıyamaz. Vendor'da CSM yok
(`presets/moon_advanced/vendor/` içeriği: controls, lines,
postprocessing, shaders). Plan: three.js r184 `examples/jsm/csm/CSM.js`
**vendor'a eklenir** (tek kopya kuralı, `vendor/csm/`). 3 kaskad: 0–60 m
(gezgin, 4 cm/texel), 60–600 m, 600–6 km. Üzeri: gölge yok, vertex
normal aydınlatması yeter (alçak Güneş'te uzak dağ gölgesi zaten silüet
olarak okunur). Reduced/export tablolarında kaskad sınırları sabit.

## 9. Determinizm ve doğrulama

- Her şey `seed`'in saf fonksiyonu; `Math.random`/`Date.now` yok.
- `scripts/validate-terrain.mjs` (CI'a eklenir), Node'da three'siz çalışır
  (`terrain-field.mjs` DOM/three bağımsız yazılır — `terrain-mesh.mjs` three'yi alır):
  1. Determinizm: aynı seed → 4 096 örnek noktada yükseklik hash'i sabit.
  2. NaN/sonsuz yok; sagitta ufukta beklenen değer (±%1).
  3. Kapılar: ped bölgesinde |h − h₀| < 2 cm; koridor eğimi ≤ bildirilen.
  4. Eğim kırpma: kırpma sonrası regolit hücrelerinde eğim ≤ 36°.
  5. Krater istatistiği: kümülatif boy dağılımı log-log eğimi −1,8…−2,2.
  6. Profil kısıtları: Ay profilinde `dune` katmanı reddedilir.
- Ekran görüntüsüyle onay: her profil için `?export=1&profil=…&seed=…`
  tablo kareleri `docs/media/terrain-*.jpg`; kabul kriteri sözleşme §1
  ("olguyu adlandır") ve kullanıcı incelemesi.

## 10. Mevcut sahnelere geçiş (kırmadan)

| Adım | Ne | Güvence |
|---|---|---|
| G1 | `terrain_blocks` sıfırdan, vitriniyle birlikte yayınlanır; hiçbir sahne henüz tüketmez | CI: registry, manifest, eksen ratchet (kaya dikmeleri yardımcıyla) |
| G2 | `surface-scene.mjs` **opsiyonel** `terrain:'blocks'` bayrağıyla yeni kütüphaneye geçer; varsayılan eski yol. Piksel-diff: eski/yeni vista tablosu yan yana | R1 deseni (lunaris piksel-diff) |
| G3 | Kullanıcı ekran görüntüsüyle onaylayınca varsayılan `blocks` olur; eski reçete bir sürüm daha kalır, sonra silinir | Manifest "derived → blocks" güncellenir |
| G4 | lunar_descent DOKUNULMAZ (plan R2). Ancak `terrain-query` ile iniş sahasının eğim/kaya sorgusu isteğe bağlı bağlanabilir | Ayrı karar, bu planın kapsamı dışı |

## 11. Vitrin (`terrain_blocks/index.html`)

- Profil menüsü, seed, `exaggeration` (1 kilitli, açılırsa altyazı uyarır),
  Güneş irtifası kaydırıcısı (0–60°; gölge dilinin nasıl değiştiği burada
  öğretilir), eğim haritası / yükseklik haritası / albedo katmanı görünümü.
- Küçük ölçek referansı: 3 m'lik `buildRover` ve 1,9 m'lik astronot
  (plan 4 hazır olunca) vista noktasında — ölçeği satan şey referans
  nesnesidir.
- URL sözleşmesi: `?profil=moon-highland&seed=…&sun=14&export=1&t=…`.
- Manifest kayıtları: `terrain-showcase-orbit` (vitrin kamera turu,
  illustrative), `terrain-shadow-sweep` (Güneş irtifa süpürmesi, real —
  gölge uzunluğu tan(irtifa) ile), `terrain-static` (arazi hareketsiz; reduced
  aynı tablo).

## 12. Riskler

| # | Risk | Azaltma |
|---|---|---|
| T1 | "Dağ" eklemek ufuk siluetini ve dalış teslim karesini (R3) değiştirir | Dalış teslim noktası profil başına ölçülür; masifler vista ufkuna nişanlı, kamera hattında değil |
| T2 | Eğim kırpma CPU'da pahalı | Yalnız örgü hücrelerinde, tek geçiş; ölçülür; > 150 ms ise kırpma düzeltme dokusu Worker'da |
| T3 | CSM vendor eklemesi bloom/composer zinciriyle çakışır | orbital_stage composer düzeni referans; CSM yalnız arazi sahnelerinde |
| T4 | İki arazi kütüphanesi bir süre yan yana yaşar (surface-scene eski yol + blocks) | G2 bayrağı; sürüm notunda son tarih; validate-invariants "kopya reçete" uyarısı |
| T5 | Mars profili için doku yok (yalnız Lunaris albedosu var) | Prosedürel albedo (bölge dokusu üreteci) + renk tokenları; harici doku eklenirse `asset-provenance.json` deseniyle lisans kaydı |

## 13. Uygulama fazları (her fazın çıkışı: ekran görüntüsü + CI yeşil)

- **F0 — çekirdek**: `terrain-field` + `terrain-features` (krater, fbm,
  sırt, masif) + `validate-terrain.mjs`. three'siz test edilebilir. ~1 gün.
- **F1 — örgü + malzeme**: kutupsal örgü, analitik normal, eğim-albedo,
  detay merdiveni, vitrin ilk hâli (moon-mare, moon-highland). ~1,5 gün.
- **F2 — sorgu + kapılar + koridor**: `terrain-query`, drivable kapı, koridor
  şeridi; plan 2'nin ilk tüketicisi (tekerlek teması) buna bağlanır. ~1 gün.
- **F3 — CSM + kaya/çakıl + Mars**: vendor CSM, scatter, mars-plain/canyon,
  dune/mesa katmanları, eğim kırpma. ~2 gün.
- **F4 — geçiş**: surface-scene `terrain:'blocks'` bayrağı, piksel-diff,
  kullanıcı onayı, manifest/KATALOG/README satırları, `docs/media`. ~0,5 gün.

## 14. Açık kararlar (kullanıcıya)

1. Mars profilleri bu dalgada mı, yoksa Ay tamamlanınca mı? (Plan F3'te; ayrılabilir.)
2. `exaggeration` kaydırıcısı vitrinde açık mı kalsın? (Öneri: kilitli, altyazı ilanlı.)
3. CSM için vendor genişletmesi kabul mü? (Alternatif: 2 kademeli el yapımı gölge kamerası — daha az kod, daha az kalite.)

---

## 15. Revizyon (16 Eylül 2026, ikinci tur) — eksikler ve yeni planlarla bağlar

İkinci inceleme depodan yeniden okunarak yapıldı; aşağıdakiler ilk sürümde yoktu.

| # | Eksik | Karar |
|---|---|---|
| R1 | **Küre ↔ arazi bağıntısı** (cinematic dalış teslimi R3): surface-scene arazisi Lunaris dokusuyla özellik-özellik uyuşmuyor. `lunar_descent` ise yükseklik dokusunu (`moon_disp_real.webp`) düşük frekanslı katman olarak örnekliyor (`dispOrnek`, satır ~1210: `a += (dispOrnek(...) − .5)·6.5`). | `terrain-features` yeni katman `displacementSample` (doku örnekleme, coğrafi): dalış noktasının altındaki gerçek Lunaris kabartması taban katmanı olur; kraterler/fBm üstüne biner. Teslim karesinde silüet sürekliliği ölçülür. |
| R2 | **Saha kapısı** (`site` tipi) yoktu: habitat planı §6 üsleri araziye "geri yazar" (düzleştirme + sıkıştırılmış regolit dokusu + yol şeridi). | `clearings` türlerine `site` eklenir: `{polygon, flatten:'graded', compaction:0..1, roads:[path]}`; iz dokusuna sıkıştırma damgası. |
| R3 | **Rille ve lav tüpü çukurları** (skylight): habitat sahneleri ve Ay bilim anlatısı için gerçek ve ilgi çekici; ilk listede yoktu. | `terrain-features`: `sinuousRille` (kıvrımlı kanal, 100–300 m derin, 1–3 km geniş), `pitCrater` (dik duvarlı çökme çukuru, 50–100 m; Marius Hills tipi). Eğim kırpmadan muaf (sert kaya). |
| R4 | **Alan boyama** entegrasyonu: field-visualization planı §5.3 skaler alanı (yerçekimi anomalisi, alan şiddeti) yüzeye boyar. | `terrain-material` `overlay` kanalı: harici skaler doku + kontur; `field_blocks/surface-paint` bunu hedefler. |
| R5 | **Gök ve Güneş yönü paylaşımı**: sky planı Ay/Mars göğünü, light planı `light-rig`'i verir; arazi kendi Güneş'ini kurmamalı. | Arazi sahnesi Güneş'i `light-rig`'den alır (`sunDir` tek kaynak); vitrin Güneş kaydırıcısı rig üzerinden çalışır. Mars profillerinde gök rengi sky planı `mars-sky` şablonundan. |
| R6 | **Nefes**: arazi nefes almaz (breathing planı §3.3 yasak listesi); ama Mars'ta **toz şeytanı** gerçek bir yaşam belirtisidir. | Breathing katalogu `marsDustDevil` (Points sütunu, rüzgâr yönlü, Poisson programlı, illustrative); arazi yalnız yüzey sorgusu sağlar. |
| R7 | Kaya **çarpışma/oturma** sorgusu: rigs planı `nearestRocks` ister, astronot ayak yerleşimi kayaya basmamalı. | `terrain-query` `rockAt(x,z)` (instance dizininden, hücre ızgarası) eklenir; iz dokusu kayalarda basılmaz. |
| R8 | "three'siz test" iddiası: `terrain-field` DOM'suz yazılır demiştik, ama `displacementSample` (R1) doku ister. | Node tarafında doku `Float32Array` olarak önceden dönüştürülmüş `.bin` (build betiği), tarayıcıda WebP; ikisi aynı örnekleyiciyi besler. |

Bağlar: [physical-rigs-plan.md](physical-rigs-plan.md) §3.2/§3.4, [light-physics-plan.md](light-physics-plan.md) §5–6,
[sky-objects-plan.md](sky-objects-plan.md) §3.3/§6, [habitat-blocks-plan.md](habitat-blocks-plan.md) §5–6,
[field-visualization-plan.md](field-visualization-plan.md) §5.3, [breathing-motion-plan.md](breathing-motion-plan.md) §3.3.
