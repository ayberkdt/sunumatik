# cinematic_space — Sinematik Uzay Geçiş Sistemi · Mühendislik Planı

> Durum: TASARIM (uygulama fazları §18'de). Bu belge `scene-blocks.md`
> programının bir uzantısıdır; her karar oradaki donmuş sözleşmelere ve
> `webgl-scene-contract.md`'ye bağlıdır. Buradaki tüm modül/API adları
> depodan doğrulanmıştır — hiçbir "varsayılan" bağımlılık yoktur.

---

## 1. Konsept özeti

Sunum, kopuk slaytlar yerine **tek ve sürekli bir uzamsal dünyada** geçer:

```
dış uzay kompozisyonu (Ay + sabit-tutunan uzay aracı)
  → kamera araca yaklaşır (Approach)
  → kanopi çerçevesi ekranı doldurur (Pass-through)
  → kokpit / gözlem güvertesi (bölüm konsolu)
  → bölüm seçimi = uzamsal yolculuk
  → örn. Ay yüzeyine dalış (Dive) → gezgin yanında belgesel planı
```

Teknik omurga: **tek dünya sahnesi + kokpit kabuk katmanı**. Kokpitten
görünen Ay, senkronlanmış bir kopya değil, dış sahnenin KENDİSİDİR
(iki geçişli render, §6). Süreklilik böylece bir "eşleme problemi" olmaktan
çıkar; yapısal olarak garantilenir.

Öncelik sırası (değişmez): süreklilik → uzamsal mantık → bilimsel
güvenilirlik → etkileşim → sinematik cila.

## 2. Yeniden kullanılan Sunumatik sistemleri

| İhtiyaç | Var olan modül | Kullanım biçimi |
|---|---|---|
| Yıldız alanı + Samanyolu | `cosmos_advanced/cosmos-sky.mjs` → `mountCosmos(container,{seed,density,drift,milkyWayTilt,galaxyTexture})` | Dünya sahnesinin gök kubbesi. `drift:0` ile; kamera hareketi paralaksı zaten üretir. ESO kredisi görünür kalır. |
| Ay (dokulu, kabartmalı) | `moon_advanced/lunaris-moon.mjs` | **Geriye uyumlu genişletme** (§17-R1): Ay mesh kurulumunu `export function buildMoonMesh({assetBaseUrl, ...})` olarak dışa aç; `mountLunaris` içeride aynı fonksiyonu kullanmaya devam eder. Dokular `moon_react_source/public/lunaris` içinden — kopya YOK. |
| Uzay aracı | `craft_blocks/craft-blocks.mjs` → `buildOrbiter({scale,palette})` | Kahraman araç. Donmuş sözleşme: +X ileri, +Z yukarı/çanak, en uzun boyut ≈ 1, orijin merkez. Kokpit kabuğu da AYNI aracın kanopi bölgesine hizalanır (§7). |
| Gezgin | `craft_blocks` → `buildRover({scale,palette,arm})` | Yüzey bölümünün finali. Yeni gezgin modeli YOK. |
| RCS/itki görseli | `craft_blocks/craft-effects.mjs` → `buildEngineFX({scale,tip,seed})` | Küçük ölçekte, kısa darbeli tetiklenir (§7 idle modeli); yeni alev sistemi yazılmaz. |
| Yörünge bölümü | `orbital_stage` → `mountOrbitalStage(host,{central,seed})` + `stage.camera.transitionTo(mode,{duration})` | Bölüm hedefi olarak TESLİM ALINIR (§10-A); cinematic_space yörünge çizmez. |
| Ay yüzeyi arazisi | `lunar_descent/lunar-descent.mjs` içindeki `araziYukseklik(x,z)` + arazi örgüsü | **Geriye uyumlu genişletme** (§17-R2): arazi bölümünü `export function buildLunarTerrain({seed})` olarak faktörle; `mountLunarDescent` içeride onu çağırır. Işık dili (alçak güneş, uzun gölge) aynen devralınır. |
| Kamera yönetmeni deseni | `orbital_stage` §"kamera yönetmeni" (C0-sürekli transitionTo, warpRef sabitleme) | Desen `camera-director.mjs`'e genelleştirilir; orbital_stage'inki YERİNDE kalır (dokunulmaz). |
| DOM geçiş yedeği | `motion_core/slide-transitions.js` → `transitionSlides` | Reduced-motion ve WebGL'siz düşüş yolu (§15). |
| Determinizm çekirdeği | `mulberry32` (orbital_stage, lunar_descent, cosmos'ta aynı) + `FI3 = φ³` frekans hilesi (lunar_descent) | Idle model §7 aynı reçeteyi kullanır. |
| Eksen güvenliği | `cylX/coneX/latheZ` yardımcıları + `scripts/eksen-denetimi.py` ratchet | Kokpit kabuğu dahil TÜM yeni geometri yardımcılarla yazılır (§17-R5). |

Kural: bu tabloda "genişletme" yazan iki dosya dışında mevcut hiçbir
modüle dokunulmaz; hiçbir geometri/şader kopyalanmaz.

## 3. Sahne sahne deneyim akışı

| Durum (`state`) | İçerik | Kaynak |
|---|---|---|
| `exterior` | Ay sağ-merkezde baskın, orbiter solda; katmanlı gök; idle tutunma | cosmos + buildMoonMesh + buildOrbiter |
| `approach` | Kamera yeniden kadrajlar, araca doğru ivmelenir | camera-director zaman çizelgesi |
| `threshold` | Kanopi çerçevesi ekran kenarlarını doldurur; kokpit katmanı devreye girer | iki geçişli render (§6) |
| `cockpit` | Gözlem güvertesi; Ay pencerede AYNI sahne olarak durur; bölüm konsolu aktif | cockpit-scene + chapter-console |
| `chapter:<id>` | Seçilen bölümün gramerine göre yolculuk (§10) | spatial-transitions |
| örn. `surface` | Pencere→dalış→arazi→gezgin yanında duruş | buildLunarTerrain + buildRover |

Her durum, tek deterministik `progress ∈ [0,1]` zaman çizelgesi üzerinde bir
aralıktır (§13). Scroll da, klavye de, `goTo()` da aynı çizelgeyi sürer.

## 4. Kamera koreografisi

Zaman çizelgesi (scroll progress ile bire bir; süreler `goTo()` için):

| p | An | Kamera |
|---|---|---|
| 0.00 | dış idle | konum sabit + nefes (§7); FOV 42° |
| 0.15 | yeniden kadraj | hedef Ay merkezinden araca kayar (slerp, 2 s eşdeğeri) |
| 0.30 | yaklaşma başlar | dolly-in başlar; ease `smoothstep²`; FOV 42°→48° |
| 0.50 | kanopi kadrajı doldurur | araç geometrisi ön planda; paralaks geçici olarak güçlenir |
| 0.62 | eşik | kanopi çerçevesi tam maske; kokpit katmanı açılır; araç dış gövdesi layer ile gizlenir |
| 0.78 | kokpit oturur | kamera koltuk hizasında durur; FOV 48°→44°; DOF: konsol yakın odak |
| 1.00 | konsol aktif | idle nefes kokpit genliğinde (dıştakinin ~%40'ı) |

Kurallar (orbital_stage'den devralınan):
- **C0 süreklilik**: hiçbir geçiş kamera konumunda adım üretmez;
  `transitionTo` mevcut konumdan tween başlatır.
- FOV animasyonu yalnız anlatı geçişlerinde; genlik ≤ 8°.
- Pointer paralaksı (§6) her durumda İKİNCİL offsettir; zaman çizelgesi
  kamerasının üstüne eklenir, asla çizelgeyi süremez.

```js
// camera-director.mjs — çekirdek kavram
const director = createCameraDirector(camera, {
  keyframes: EXTERIOR_TO_COCKPIT,   // [{p, pos, look, fov, ease}]
  seed: 20260816,
});
director.setProgress(0.42);          // deterministik: p'nin saf fonksiyonu
director.addSecondary(pointerOffset); // paralaks, toplanır — çizelgeyi bozmaz
```

## 5. Hareket grameri (beş sınıf)

| Sınıf | Nerede | Uygulama |
|---|---|---|
| **A. Approach** | dış→araç; konsol→panel | dolly + hedef takibi + FOV; asla CSS scale |
| **B. Pass-through** | kanopi; kaportalar; ekranlar | geometri maskeli katman değişimi (§6) |
| **C. Dive** | kokpit→Ay yüzeyi | pencere kadrajı → irtifa süpürmesi → arazi LOD teslimi (§11) |
| **D. Pull-out** | gezgin→Ay; bölüm→kokpit | Dive/Approach'un zaman-tersinmişi; AYNI keyframe'ler geri sarılır |
| **E. Lateral reveal** | bölümler arası; panel değişimi | kamera yanal ray + ön plan geometrisi perde görevi görür |

Her bölüm hedefi bu beş sınıftan birini BİLDİRİR (§9 veri modeli);
serbest/karma geçiş yok. Pull-out'un "geri sarma" olması bedava determinizm
ve bedava tutarlılık sağlar.

## 6. Paralaks mimarisi

Sahne gerçek 3B olduğundan paralaks FİZİKTEN gelir: pointer girdisi küçük
bir kamera offsetine çevrilir, katmanların farklı kayması perspektiften
kendiliğinden doğar. Katman başına el ayarı yapay değil, yalnız SINIRLAYICI
olarak vardır:

```js
// parallax-controller.mjs
const parallax = createParallax(camera, {
  pointer: { maxYawDeg: 0.6, maxPitchDeg: 0.4, easeSeconds: 1.2 },
  dolly:   { maxOffset: 0.03 },          // sahne birimi; kokpitte 0.012
});
// katman abartısı YALNIZ kokpit ön planı için (cam kenarı, çerçeve):
parallax.exaggerate(cockpitForeground, 1.6);
```

Doğal sonuç (ölçülmesi beklenen):
kokpit çerçevesi > araç gövdesi > Ay (≈0) > yıldız kubbesi (0 — sonsuzda).
Ay'ın araçtan çok kayması YAPISAL olarak imkânsızdır; bu, manifest'te
"paralaks fizikseldir" iddiası olarak belgelenir. Cihaz yönelimi
(deviceorientation) aynı offset kanalına düşük katsayıyla bağlanabilir;
pointer ile aynı sınırlara tabidir.

## 7. Uzay aracı idle modeli ("aktif tutunma")

Amaç cümlesi: *"Araç uzayda konumunu aktif olarak koruyor."* Zıplayan UI
nesnesi değil. Reçete — lunar_descent'in φ³ frekans hilesiyle:

```js
// spatial-idle.mjs — tüm frekans oranları irrasyonel (FI3 = φ³ ≈ 4.236)
const rnd = mulberry32(seed);
const F = 1 / (10 + rnd() * 8);          // öteleme  ~10–18 s
const katman = [
  { eksen:'x',   f:F,          A:0.010 },      // yavaş öteleme salınımı
  { eksen:'z',   f:F*FI3/3.1,  A:0.006 },      // dikey süzülme ~7–13 s
  { eksen:'yaw', f:F/1.55,     A:0.6*DEG },    // ~15–25 s
  { eksen:'roll',f:F/2.05,     A:0.4*DEG },    // ~18–30 s
];
// Her katmanda faz = rnd()*TAU; değer = A·sin(TAU·f·t + faz)·pürüz(t)
// pürüz(t): iki incommensurate sinüsün çarpımı — tek sinüs asla görünmez.
// Kamera nefesi: aynı yapı, ~12–20 s, araçla ZITLIK için negatif korelasyon.
```

- **RCS düzeltmesi**: yaw/roll sapması ölü banttan (0.5°) çıkınca 0.4 s'lik
  darbe — `buildEngineFX({scale:0.06, tip:'vakum'})` kısa parlatılır ve
  sapma 2 s'de sıfıra rampalanır. Darbe anları t'nin saf fonksiyonudur
  (tohumlu eşik geçişleri) → export deterministik.
- Bütün genlikler sahne biriminin %1'i mertebesinde; hiçbir katman
  senkronize değil; periyotlar ekranda 30 s izlenince bile tekrar okunmaz.

## 8. Kokpit tasarım stratejisi

- **Kabuk, aynı aracındır**: kokpit iç geometrisi `buildOrbiter`'ın gövde
  kesitine ve kanopi konumuna hizalanır (ölçüler koddan okunur, elle
  uydurulmaz). Kullanıcı "az önce dışından baktığım araçtayım" demeli.
- Malzeme dili craft-blocks paletinden: `CRAFT_PALETTE` + obsidyen-şampanya;
  MeshStandardMaterial, ölçülü metalness. Neon yok, oyun HUD'u yok.
- Pencere = gerçek delik (geometri), ekran değil. İki geçişli render:
  1. geçiş: dünya sahnesi (Ay+gök+dış) kokpit kamerasıyla çizilir;
  2. geçiş: `renderer.autoClear=false` ile kokpit kabuğu üstüne çizilir.
  Cam: çok düşük opaklıklı fresnel katmanı + Ay yönünden tek yansıma vurgusu.
- Aydınlatma: tek anahtar ışık (Güneş, dış sahneyle AYNI yön) + Ay'dan
  düşük soğuk dolgu + panellerden ölçülü sıcak aydınlatma. Ekran bloom'u
  varsa UnrealBloomPass eşik ÜSTÜ, düşük güç (orbital_stage değerleri).
- İçerik disiplini: her gösterge ya gerçek durumu gösterir (p, durum adı,
  seçili bölüm) ya da hiç yoktur. Anlamsız telemetri YASAK (mevcut
  başarısızlık-modu listesi §25 ile uyumlu).

## 9. Dinamik bölüm navigasyonu

Veri güdümlü; 2–4 bölüm:

```js
mountCinematicSpace(host, {
  seed: 20260816,
  chapters: [
    { id:'surface', label:'Ay Yüzeyi',        grammar:'dive',
      destination:{ type:'rover' } },
    { id:'orbit',   label:'Yörünge Dinamiği', grammar:'pass-through',
      destination:{ type:'orbital-stage', spec:{ central:'moon' } } },
    { id:'systems', label:'Araç Sistemleri',  grammar:'approach',
      destination:{ type:'craft', focus:'engine' } },
  ],
});
```

Konsol: gömme (recessed) alet paneli — kart başına: durum LED'i, etiket,
kısa alt satır. Mikro-etkileşimler: hover'da panel aydınlatması +1 kademe,
0.5 mm derinlik kayması, odak halkası (WCAG görünür), seçimde kısa
"arm→execute" iki aşamalı animasyon. Klavye: ↑↓/Tab dolaşır, Enter seçer,
Esc kokpite döner — `data-owns-keys` sözleşmesiyle deste çalıştırıcısına
bildirilir.

## 10. Bölüm geçiş stratejisi

Ortak iskelet: `chapter-router.mjs` hedef preset'i kokpit idle'ı sırasında
**gizli konteynerde `setActive(false)` ile önceden mount eder** (tembel ama
erken); geçiş anında yalnız kamera yolculuğu + katman teslimi kalır.

- **A. `orbital-stage` (pass-through)**: pencere kadrajı büyür; eşikte
  render hedefi orbital_stage konteynerine teslim edilir;
  `stage.camera.transitionTo('orbit',{duration})` ile DEVAM EDEN bir kamera
  hissi. Ay merkezli konfigürasyon (`central:'moon'`) dış sahnedeki Ay
  yöneliminden başlatılır.
- **B. `craft` (approach)**: kamera konsoldan aracın seçili alt sistemine
  (motor çanı, çanak, panel) yaklaşır — dünya sahnesindeki AYNI orbiter
  modeli kullanılır; alt sistem izole aydınlatmayla vurgulanır.
- **C. `rover` (dive)**: §11.

Dönüş her hedefte **D. Pull-out** = gidiş çizelgesinin geri sarımıdır.

## 11. Ay yüzeyi / gezgin varışı (imza geçiş)

```
kokpit (p=0)
→ pencere kadrajı Ay'ı merkezler (0.10)
→ pencere çerçevesi ekran dışına büyür — pass-through (0.20)
→ irtifa süpürmesi: buildMoonMesh küresi yaklaşır, sabit yönelim (0.20–0.55)
→ TESLİM NOKTASI (0.55): küre kadrajı doldurduğu anda buildLunarTerrain
  sahnesi devreye girer; teslim, ufkun ekranı kapladığı karede yapılır —
  iki temsili aynı anda görmek imkânsızdır (§17-R3)
→ arazi detayı büyür; alçak güneş + uzun gölgeler lunar_descent dili (0.55–0.85)
→ gezgin silüeti ufukta belirir (0.85)
→ kamera gezgin yanında alçak üç-çeyrek belgesel planına oturur (1.00)
```

- Gezgin: `buildRover({scale, arm:true})`, arazi yüksekliğine
  `araziYukseklik(x,z)` ile oturtulur (lander'la aynı desen).
- Ölçek dürüstlüğü lunar_descent kuralıyla: 1 birim = 100 m, ufuk eğriliği
  gerçek yarıçapla; sinematik ölçek abartısı varsa manifest'te İLAN edilir.
- Toz YOK (fiziksel olay yok); Dünya ufukta yalnız geometrik olarak doğru
  konumdaysa görünür.
- Kamera son planı: gezgin ön planda sol-altta, ufuk üst üçte-bir çizgisinde
  (composition preset'inin üçler kuralı ölçümüyle doğrulanır).

## 12. Modül / dosya mimarisi

```
presets/cinematic_space/
├── index.html                  # bağımsız önizleme (?p= &durum= &export=1)
├── cinematic-space.mjs         # mount + durum makinesi + zaman çizelgesi
├── camera-director.mjs         # keyframe rayı, C0 geçişler, ikincil offset
├── spatial-transitions.mjs     # beş gramer sınıfının uygulanışı
├── parallax-controller.mjs     # pointer/orientation → kamera offseti
├── spatial-idle.mjs            # §7 tutunma modeli (araç + kamera nefesi)
├── chapter-router.mjs          # veri güdümlü bölümler, tembel mount, dönüş
├── cockpit/
│   ├── cockpit-scene.mjs       # kabuk geometrisi (eksen yardımcılarıyla)
│   └── chapter-console.mjs     # konsol UI + klavye + odak yönetimi
└── motion-manifest.json        # tüm hareketler: model/limit/reduced/export
```

Bağımlılık yönü tek taraflı: cinematic_space → mevcut preset'ler.
Hiçbir mevcut preset cinematic_space'i bilmez. Demo kartı `build-demo.py`
KARTLAR listesine küratörlü olarak eklenir (keşif zaten jenerik kart basar).

## 13. Yeniden kullanılabilir API

```js
const cine = await mountCinematicSpace(host, { seed, chapters, palette });

cine.goTo('cockpit');            // durumlar: exterior|cockpit|chapter:<id>
cine.goTo('chapter:surface');
cine.back();                     // pull-out (geri sarım)
cine.setProgress(0.42);          // aktif segmentin çizelgesini sar
cine.advance(dt);                // deterministik kare sürme (test/export)
cine.setExportMode(true);        // donmuş tablo + kontroller gizli
cine.setActive(false);           // rAF durdurma sözleşmesi (diğer preset'lerle aynı)
cine.on('statechange', fn);      // deste çalıştırıcısı slayt eşlemesi için
cine.dispose();
```

Scroll modu: sayfa, pinlenmiş sahne + scroll→`setProgress` eşlemesi
(deterministik çizelge; DOM öğeleri bağımsız oynatılmaz). Aynı API deste
navigasyonundan da (ok tuşları) sürülür — iki giriş tek çizelgeye düşer.

## 14. Performans stratejisi

- Hedef: 60 FPS masaüstü. Tek `WebGLRenderer`; sahneler `THREE.Scene`
  olarak ayrık, ama SIRAYLA render (aktif olmayan durur — `setActive`
  sözleşmesi zaten tüm preset'lerde var).
- Bölüm hedefleri kokpit idle'ında gizli mount (iframe DEĞİL — WebGL
  bağlam limiti; in-process mount). `aktif: tam render · sıradaki: hazır,
  duraklatılmış · diğerleri: mount edilmemiş`.
- Ay dokusu ve craft malzemeleri paylaşılan loader'dan bir kez; dalış
  sırasında küre-arazi teslimi sayesinde ikisi aynı karede tam detayla
  ÇİZİLMEZ.
- Bloom opsiyonel (`options.bloom:false` en büyük tasarruf — orbital_stage
  ölçümüyle aynı). Parçacık yok denecek kadar az; DOM işi kare başına sıfır
  (konsol durumu event'le güncellenir).
- Ölçüm disiplini: `cine.stats.advanceMs` EMA + `?perf=1` DOM çıktısı
  (orbital_stage deseninin aynısı).

## 15. Reduced motion

`prefers-reduced-motion: reduce` altında anlatı korunur, yolculuk kısalır:

| Normal | Reduced |
|---|---|
| 3.5 s yaklaşma + eşik + oturma | tek 0.4 s çapraz kararma ile kokpit tablosu (`transitionSlides` 'fade-through') |
| dalış süpürmesi | pencere kadrajı → doğrudan gezgin tablosu |
| idle tutunma + kamera nefesi | tamamen donuk; RCS yok |
| pointer paralaksı | kapalı |

Konsol tamamen klavyeyle kullanılır; odak halkaları her temada görünür.
Her durum tablosu, normal moddaki son kareyle AYNIDIR (export tablolarıyla
ortak tanım — tek kaynaktan).

## 16. Deterministik export

- Tüm hareket `t`'nin ve `seed`'in saf fonksiyonu (idle dahil, §7).
  Duvar saati yalnız canlı modda dt kaynağıdır; `advance(dt)` aynı yoldan
  sürer.
- URL sözleşmesi (diğer preset'lerle aynı dil):
  `?durum=cockpit&p=0.78&seed=…&export=1` → `html[data-export="true"]`,
  kontroller gizli, `data-frozen-at` damgası.
- Manifest: her gramer sınıfı ayrı motion kaydı (type: `state-transition`
  /`simulation`, truthLevel: `illustrative` — Ay dokusu ve arazi kayıtları
  kaynaklarını `sourceIds` ile gösterir); reduced/export tabloları belgeli.
- CI: mevcut zincir otomatik kapsar — registry keşfi, manifest şema
  denetimi, eksen ratchet'i (yeni geometri yardımcılarla yazılacağı için
  taban SIÇRAYAMAZ), demo determinizmi.

## 17. Teknik riskler

| # | Risk | Azaltma |
|---|---|---|
| R1 | `buildMoonMesh` faktörlemesi lunaris'i bozabilir | Geriye uyumlu: mountLunaris davranışı birebir; mevcut demo kartı + ekran görüntüsü karşılaştırmasıyla doğrula (piksel diff) |
| R2 | `buildLunarTerrain` faktörlemesi — arazi kodu 115 KB dosyada kapanışlara gömülü | Faz 4 başında tek başına dene; sökülemezse YEDEK: cinematic_space kendi küçük yükseklik alanını lunar_descent'in belgelenmiş reçetesiyle kurar ve manifest'te "türetilmiş, kopya değil" diye bildirir |
| R3 | Küre→arazi teslimi görünür "atlama" üretebilir | Teslim yalnız ufuk ekranı tamamen kapladığında; iki temsil aynı karede asla; teslim karesi export tablosu olarak sabitlenir ve ekran görüntüsüyle denetlenir |
| R4 | İki geçişli render'da derinlik çakışması (kokpit vs dünya) | Kokpit geçişi kendi depth-clear'ı ile; cam katmanı depthWrite:false; near/far ayrık aralıklar |
| R5 | Eksen hatası sınıfının kokpit geometrisinde tekrarı | Yardımcılar zorunlu; ratchet CI'da; kokpit kabuğu ekran görüntüsüyle onaylanmadan "bitti" denmez (scene-blocks kalite çıtası) |
| R6 | Scroll kaçırma (hijack) erişilebilirliği bozar | Scroll yalnız pinli sahne bölgesinde; klavye/deste navigasyonu her zaman eşdeğer; reduced-motion scroll'u normal akışa döndürür |
| R7 | FOV animasyonu + OrbitControls çatışması | Sinematik durumlarda kontroller kapalı; serbest bakış yalnız kokpit idle'ında ve sınırlı gimbal ile |
| R8 | Performans: dalışta doku + arazi zirvesi | LOD teslimi (R3) + bloom kapatma seçeneği + `?perf=1` ölçümü fazın çıkış kriteri |

## 18. Uygulama fazları

Her fazın çıkış kriteri: ekran görüntüsüyle doğrulama + CI yeşil
(registry/manifest/eksen/demo-determinizm) — "çalışıyor demek" yetmez.

- **Faz 0 — ortak zemin** (küçük, riskli işler önce):
  `presets/core/geometry-axis.mjs` (yardımcıların tek kaynağa taşınması,
  craft/aircraft yeniden-import), lunaris'e `buildMoonMesh` dışa açımı (R1
  piksel-diff dahil). Kabaca yarım gün.
- **Faz 1 — dış sahne**: cosmos + Ay + orbiter kompozisyonu, idle modeli,
  paralaks denetleyicisi, `setProgress` rayı, index.html önizleme +
  manifest. İmza kare: §3 `exterior`.
- **Faz 2 — yaklaşma + kokpit**: kanopi eşiği, iki geçişli render, kokpit
  kabuğu + cam, kamera koreografisi 0→1, reduced-motion kısa yolu.
- **Faz 3 — konsol + yönlendirici**: veri güdümlü bölümler, klavye,
  orbital_stage teslimi (en ucuz hedef — pass-through), `back()` geri sarım.
- **Faz 4 — dalış + gezgin**: R2 denemesi, küre→arazi teslimi, buildRover
  vista, ışık dili, imza export karesi.
- **Faz 5 — cila + yayın**: DOF/bloom ölçülü, RCS darbeleri, `?perf=1`
  bütçe raporu, demo KARTLAR kaydı, KATALOG/README satırları, scene-blocks.md
  programına blok kaydı, motion-manifest son hali.

Fazlar 1–3 tek başına yayınlanabilir bir deneyim üretir; 4–5 imza bölümü
tamamlar. Hiçbir faz bir öncekini kırmadan birleşmez (CI bunu tutar).
