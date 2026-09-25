# light_physics — Işık Fiziği Alanı · Mühendislik Planı

> Durum: **F0 UYGULANDI (25 Eylül 2026)** — `presets/core/light-math.mjs`
> (§2 çekirdeği: planck, CIE 1931 renk eşleme, blackbodyRGB + Doppler/kızıla
> kayma (§14-R2), emissionLineRGB, reflectedRGB, flickerField, ortam etiketi
> ve olgu kuralı, birimler/pozlama/adaptasyon, oppositionSurge (§5.3),
> PROPELLANTS (§4.2)) ve `scripts/validate-light.mjs` (57 denetim, CI'da).
>
> ÖLÇÜLDÜ: renklilik koordinatları yayımlanmış Planck eğrisine T ≥ 2856 K
> için Δxy < 0,0016 oturuyor (CIE A aydınlatıcısı 0,4464/0,4085; yayımlanan
> 0,44758/0,40745). 1900 K'de sapma 0,0145 — kullanılan analitik uyumun
> derin kırmızıdaki bilinen zayıflığı, denetimde İLAN EDİLMİŞ sınır olarak
> duruyor. 6504 K ham hâlde (1, 0,945, 0,994) verir; (1,1,1) DEĞİLDİR,
> çünkü 6504 K Planck ışıması D65 değildir. "Beyaz görünsün" isteyen
> `normalize:'white'` seçer ve bunu bilerek seçmiş olur.
>
> DOĞRULAMA İKİ GERÇEK KUSUR YAKALADI: (1) pembe gürültüde genlik ∝ f^(−1/2)
> yazılmıştı; bileşenler LOGARİTMİK aralıklı olduğu için birim frekanstaki
> yoğunluk zaten ∝ 1/f'tir ve çarpım PSD'yi 1/f² yapıyordu (ölçülen eğim
> −2,70). Log aralıkta genlik SABİT olmalı; şimdi −1,018. (2) Adaptasyon
> durumsuz bir imzayla kritik sönüm yazılmıştı; kritik sönümün kapalı formu
> HIZI da taşır, durumsuz her karede sıfır hızdan başlayınca
> (1+ωΔt)e^(−ωΔt) ≈ 1 − (ωΔt)²/2 olur ve adım küçüldükçe sönüm kaybolur
> (12 saniyede 6,1 EV kalıyordu, 1/60 ile 1/120 farklı yere gidiyordu).
> Birinci dereceden üstel sönüm hem aşımsız hem kadanstan tam bağımsız.
> Ölçümün kendisi de ters sınava bağlandı: beyaz gürültüde eğim 0,031.
>
> **F1 UYGULANDI (25 Eylül 2026):** `presets/light_blocks/light-rig.mjs` —
> Güneş gerçek aydınlatmasıyla ve blackbodyRGB(5772) rengiyle kurulur;
> DOLGU HESAPLANIR (regolit sıçraması E·ρ·sin(irtifa)/π, Ay'da Dünya ışığı
> ~12 lux) ve AmbientLight HİÇ kurulmaz — fiziksel karşılığı yok. Far
> kandela ile (decay 2, distance 0; kesme yarıçapı eşik atlamasıdır), IES
> benzeri 1B profil tablosu. `addBeam` huzmeyi yalnız saçan ortamda kurar
> ve reddi nedeniyle birlikte döndürür. Vitrin `presets/light_blocks/`:
> aynı lamba dört ortamda, ışık tablosu, zemin aydınlatması E = I/d² ile
> ölçülü, reddedilen olgular gerekçe ve öneri kartlarıyla.
>
> HENÜZ YOK: heiligenschein parçasının arazi malzemesine bağlanması (§5.3
> matematiği çekirdekte hazır), sıcak metal (§5.5), plüm genişletmesi (§4),
> ateş (§3), lens katmanı (§7) — plan §12 F2–F4.
>
> `webgl-scene-contract.md` §1 ("olguyu
> adlandır"), §3 (GLSL güvenliği) ve §4 (ışık disiplini) bu planın anayasasıdır.
> Modül/API adları 16 Eylül 2026'da depodan doğrulandı.
>
> Kardeş planlar: [terrain-system-plan.md](terrain-system-plan.md) (regolit
> BRDF'yi tüketen arazi malzemesi), [physical-rigs-plan.md](physical-rigs-plan.md)
> (gaz → plüm, gimbal → plüm yönü, sürüş → far), [astronaut-figure-plan.md](astronaut-figure-plan.md)
> (vizör yansıması, kask lambaları, heiligenschein).

---

## 0. Kullanıcı talebi ve boşluklar

Talep: *"Işık fiziğiyle ilgili birçok şeyi araştırıp muhteşem tasarımlar
yaratabilecek bir alan. Meşale ateşi çok gerçekçi olsun, motordan çıkan ateş,
farlardan çıkan ışıklar vs."*

Talebin söylemediği, planın kapattığı boşluklar:

| Boşluk | Sonuç |
|---|---|
| **Vakumda alev yoktur.** Meşale (yanma) oksijen ister; Ay'da ve Mars'ta (%95 CO₂) açık alev olmaz. Işık huzmesi de vakumda **görünmez** (saçacak ortam yok) | Her ışık olgusu **ortam etiketi** taşır: `vacuum` / `mars` / `earth` / `interior`. Ay sahnesinde meşale istenirse sistem reddeder ve alternatif önerir (plazma/LED/kimyasal ışık). Bu, sözleşme §1'in doğrudan sonucu |
| Işıkların **birimi** yok: three.js r184'te ışık şiddeti fiziksel birimdedir (point/spot: kandela, directional: lux, `useLegacyLights` bayrağı bundle'da yok — doğrulandı) | §2 birim sistemi; tüm ışıklar gerçek çapalarla (Güneş 100 000 lux vb.), pozlama ile ekrana getirilir |
| Alev = ışık **kaynağı**: çevreyi aydınlatmalı, titreşimi ışığa geçmeli, gölge atmalı | §3.4 |
| **Renk = sıcaklık** (Planck) veya **renk = kimya** (emisyon bantları); doku/keyfî renk yok | §2.2 blackbody, §4.2 yakıt tablosu |
| Bloom/flare **fizik değil lens**: nerede kullanılacağı bildirilmeli | §7 |
| Pozlama: kokpit (karanlık) → yüzey (100 000 lux) geçişinde göz/kamera **adaptasyonu** | §6.3 |
| Ay gölgesi **simsiyah değil**: Dünya-ışığı ve regolit sıçraması dolgu verir; ama huzme yok | §5 |
| Sahnede tek ışık dili: her preset kendi ışığını elle kuruyor (surface-scene: DirectionalLight 3,0 + Ambient 0,34 + Hemisphere 0,5 + PointLight 1,1 — birimsiz, gözle) | §6 `light-rig` tokenları |

## 1. Bugün ne var (kaynağından okundu)

| Yer | Ne | Sınır |
|---|---|---|
| `craft_blocks/craft-effects.mjs` (831 satır) `buildEngineFX({scale, tip, seed, palette})` → `{group, update(dt,{gaz, atesle, zeminMesafe}), dispose}` | Hacimsel 7 kabuklu shader plüm (Abel integrali), kesme katmanı, şok hücreleri (`atmosfer`), `vakum`, `hover` zemin jeti; sıcaklık rampası T(u,q) → renk analitik; ateşleme flaşı + halka + kıvılcım; tek PointLight decay 2; titreşim 12–30 Hz ±%15, plüm/jet/ışık aynı değeri paylaşır; fragment `tonemapping_fragment`+`colorspace_fragment` ile biter | Yakıt türü yok (tek renk rampası); TVC yok; plümün gövdeyi/zemini aydınlatması tek PointLight; duman yok (SRB/kerolox isi) |
| `cinematic_space/surface-scene.mjs` | Farlar: 2× `SpotLight('#fff3d8', 0, .28, .32, .65)` + emissive lens (kapalı varsayılan, `setFarlar`); fener `emissiveIntensity .28+.3·sin`; Güneş 14° `DirectionalLight 3.0`, gölge 1024², ±40 m; `AmbientLight .34`, `HemisphereLight .5`, dolgu `PointLight 1.1` | Birimsiz; huzme yok (doğru: vakum); far zemin deseni yok |
| `cinematic_space/cinematic-space.mjs` satır 148–151 | `WebGLRenderer{alpha, antialias, preserveDrawingBuffer}`, `ACESFilmicToneMapping`, `toneMappingExposure 1.05`, `shadowMap.enabled` | Sabit pozlama |
| `orbital_stage/orbital-stage.mjs` satır 555 | `UnrealBloomPass(res, .5, .55, 1.35)` — güç 0,5, yarıçap 0,55, eşik 1,35 | Sözleşme §4: yumuşak diz ister; stok eşik sert |
| `core/lab-three.mjs` | `atmosphereMaterial` (fresnel), `glowSprite`, `sunGlow`, `starfield`; `lab-scene.mjs` `blackbody()` (2B, commit 789f8c3) | 3B tarafta blackbody yok |
| `moon_advanced/vendor/` | `postprocessing/{EffectComposer, RenderPass, ShaderPass, UnrealBloomPass, MaskPass}`, `shaders/{CopyShader, LuminosityHighPassShader}` | Lens flare, CSM, SSAO, volumetrik yok |
| `aurora/aurora-sky.mjs` | 557,7 nm/630 nm emisyon renkleri, perdeler | Emisyon-hattı renk yaklaşımı örneği |
| `reentry_corridor` | Plazma kılıfı, ısı kalkanı kara-cisim rengi (radyatif denge T) | Blackbody kullanımı örneği (2B/3B karışık) |

## 2. Ortak çekirdek: `presets/core/light-physics.mjs` (altyapı — sert bağımlılık serbest)

### 2.1 Birimler
- Directional: **lux** (Güneş, Ay yüzeyinde 1361 W/m² → ~127 000 lux; Mars
  ~590 W/m² → ~55 000 lux; Dünya deniz seviyesi ~100 000 lux).
- Point/Spot: **kandela** (`intensity`), `decay = 2` (ters kare) **her zaman**;
  `distance = 0` (sonsuz) — kesme yarıçapı yok, sözleşme §2 (eşik atlaması).
- Emissive: **nit** eşdeğeri (cd/m²); shader tarafında `emissiveIntensity`.
- Pozlama: `EV100 = log2(L_avg · 100 / K)`, `toneMappingExposure = 1/(1.2 · 2^EV100)`
  bileşimi — ACES korunur. Sahne bir **pozlama hedefi** bildirir (gri kart
  0,18), kamera adaptasyonu §6.3.

### 2.2 Renk kaynakları (üç meşru yol; dördüncüsü yok)
```js
blackbodyRGB(T_K)          // Planck → CIE 1931 → lineer sRGB; 1000–40000 K tablo + ara değer
emissionLineRGB(lines[])   // {nm, w}: dalga boyu → CIE eşleme (aurora ile aynı yol)
reflectedRGB(albedoRGB, illuminantRGB)
```
`blackbodyRGB` tablo doğrulaması `scripts/validate-light.mjs`: 6504 K →
(1,1,1)±0,02 (D65'e yakın), 1900 K mum ≈ (1, 0,55, 0,15) mertebesi, 5772 K
Güneş → hafif sıcak beyaz. Planck yerine "turuncu seçtim" YASAK.

### 2.3 Titreşim (flicker) modeli
Tek `flickerField(seed, t)`: 1/f (pembe) gürültü + ölçüşmez sinüs karışımı
(φ³ hilesi), bant 3–30 Hz, genlik sınırı parametre. Alev, plüm, kıvılcım,
ışık ve gölge **aynı alanı** paylaşır (craft-effects dersi: "plüm, zemin jeti
ve ışık aynı titreşim değerini paylaşır"). Saf f(t, seed).

### 2.4 Işık ortamı etiketi
```js
LightEnvironment = { medium:'vacuum'|'mars'|'earth'|'interior', 
                     scattering: 0 | betaRayleigh+betaMie, gravity, pressure, oxygen:boolean }
```
Her ışık bloğu kurulurken `env` alır; **uyumsuz olguları reddeder**
(`fire` + `vacuum` → hata mesajı ve öneri; `beam` + `vacuum` → huzme yok,
yalnız yüzey aydınlatması + toz varsa toz saçılması).

## 3. Ateş / meşale (`presets/light_blocks/fire.mjs`) — yalnız `earth` / `interior`(oksijenli)

### 3.1 Olgu
Difüzyon alevi: yakıt buharı + O₂, kaldırma kuvvetiyle yükselen sıcak gaz,
**is parçacıklarının** kara-cisim ışıması (sarı-turuncu bölge, ~1 400–1 900 K),
tabanda mavi CH/C₂ bandı (soot'suz ön karışım bölgesi, 431/516 nm). Kaldırma
kuvveti alevi yukarı **uzatır**; g küçükse (Ay 1,62 — ama oksijen yok; ISS
0 g — küresel mavi alev) biçim değişir: rig `env.gravity` okur.

### 3.2 Model (hacimsel, ray-march, tek mesh)
- Sınırlayıcı kutu içinde fragment ray-march (24–40 adım), yoğunluk
  `ρ(p,t) = zarf(p) · fbm(p·k − t·v_yukarı)`; zarf: tabanda geniş, üstte
  daralan; domain warp ile "dil" ayrılmaları. Kaldırma advekti: `v_yukarı ∝ √(g·L·ΔT/T)`.
- Sıcaklık `T(p) = T_max · ρ · yükseklik zarfı`, renk `blackbodyRGB(T)` **anlık
  hesaplanmaz** — 256 girişli 1D tablo dokusu (GLSL güvenliği, maliyet).
- Emisyon + soğurma (Beer-Lambert) birlikte: alev hem parlar hem arkasını
  hafif karartır (is). Additive-yalnız alev "tül perde" okunur (sözleşme §4).
- Meşale: yakıt kaynağı (bez/reçine) emissive kor + alev + **kıvılcım**
  (Points, balistik, rüzgâr sürüklenmeli, sönerek kararan blackbody 1 200→800 K)
  + **duman** (ayrı düşük-frekanslı ray-march katmanı, soğurma ağırlıklı,
  ışıkla aydınlanan — tek ışık yönü yeter).
- **Isı hazesi**: alev üstünde kırılma — ekran uzayı UV bozulması (ShaderPass,
  yalnız `earth` ortamında; maliyeti ölçülür, kapatılabilir).
- Ateşin **ışığı**: bir PointLight (kandela: meşale ≈ 50–150 cd), renk
  `blackbodyRGB(1850 K)`, şiddet `flickerField` ile ±%20; **gölge atar**
  (titreşen gölge, ateşi satan şeydir). İkinci, geniş ve zayıf bir dolgu
  (yansıma yaklaşımı) opsiyonel.
- Ölçek: meşale alevi 30–50 cm; kamp ateşi 0,6–1,2 m; parametre `size`.

### 3.3 Reduced / export
Tablo: `?t=` sabit; alev dokusu t'nin fonksiyonu → deterministik kare;
reduced'da alev **donuk ama parlak** (sönmez; yalnız titreşim durur).

## 4. Motor plümü (`craft-effects.mjs` — geriye uyumlu genişletme)

Mevcut model kalır; **üç ek**:

### 4.1 TVC ve ışık
Plüm grubu rig'in gimbal düğümüne çocuk olur (plan 2 §5.6); plüm ışığı
gövdeye **ve zemine** düşer: PointLight'a ek olarak `hover` tipinde zemin
üzerinde **ters-kare disk** (projeksiyonlu emissive decal değil, gerçek
ışık + gölge haritası). Bloom yalnız plümün çekirdeği için (eşik üstü).

### 4.2 Yakıt kimyası → renk (yeni `propellant` parametresi)
Renk artık yalnız T(u,q) değil, `T` + **emisyon karışımı**:

| `propellant` | Görünüm (gerçek) | Model |
|---|---|---|
| `kerolox` (RP-1/LOX; Falcon 9, Saturn V) | Parlak turuncu-sarı, isli, uzun alev | Blackbody 2 200–2 800 K, is emisyonu baskın, hafif duman |
| `hydrolox` (LH₂/LOX; RS-25, Centaur) | Neredeyse görünmez, soluk mavi-mor, şok elmasları belirgin | Düşük yayınırlık; OH 309 nm görünmez → zayıf 430–480 nm; saydamlık yüksek |
| `methalox` (Raptor, BE-4) | Mavi-mor çekirdek, açık turuncu dış | CH 431 nm + C₂ 516 nm + hafif blackbody |
| `hypergolic` (MMH/NTO; Apollo SPS/LM, RCS) | Saydam, soluk pembe-turuncu, kısa | Düşük yayınırlık, blackbody 2 000 K çok zayıf |
| `solid` (SRB) | Kör beyaz-sarı, Al₂O₃ parçacıkları, **yoğun beyaz duman** | Blackbody 3 000 K + parçacık saçılması; duman katmanı ZORUNLU |
| `ion` (Hall/gridded) | Soluk mavi ışıma (Xe 460–490 nm), huzme çok geniş | Emisyon hattı, additive çok düşük |
| `cold-gas` (N₂ RCS) | Görünmez; yalnız toz/buz varsa | Hiç plüm çizilmez (dürüst) — yalnız hafif kırılma |

`tip` (vakum/atmosfer/hover) **akış rejimi**, `propellant` **kimya**: iki
eksen bağımsız. Renk durakları craft-effects'in mevcut ön-telafi
yöntemiyle **ölçülerek** kalibre edilir (sRGB additive + ACES).

### 4.3 Duman
Yeni katman: `smoke.mjs` — SRB/kerolox için; büyük+soluk+üst üste
sprite'lar (sözleşme §5), Güneş yönünde aydınlanan (tek yön), yaşlandıkça
büyüyüp solan, rüzgâr sürüklenmeli. Vakumda YOK (plüm genleşip
kaybolur — mevcut `vakum` davranışı doğru).

## 5. Ay/Mars yüzeyi ışığı (arazi, gezgin, astronot)

### 5.1 Güneş
Tek yönlü, **127 000 lux** (Ay), renk `blackbodyRGB(5772)`; **gölge sert**
(açısal çap 0,53° → yumuşama yalnız uzak gölgede; PCF yarıçapı mesafeyle
büyür). Alçak Güneş dili: irtifa parametre (surface-scene 14°).

### 5.2 Dolgu (huzme yok!)
- **Dünya-ışığı**: Ay yakın yüzünde Dünya'nın aydınlatması ~10–15 lux
  (dolunay ışığının ~50 katı) — Güneş'in ~10⁻⁴'ü. Mavi-beyaz
  (Dünya albedosu + Rayleigh). Yalnız Dünya gökteyse (surface-scene'de
  Dünya var → geometrik olarak tutarlı yön).
- **Regolit sıçraması**: yatay yüzeyler birbirini besler — mevcut
  HemisphereLight yaklaşımı korunur ama şiddeti `albedo·E_güneş·cos(irtifa)/π`
  ile **hesaplanır** (gözle değil).
- Gök: uzay karası (0). AmbientLight **yok** (fiziksel karşılığı yok);
  bugünkü `.34` ambient kalkar, yerini hesaplanan dolgu alır — piksel
  karşılaştırmasıyla "kömür karanlık" geri gelmemesi doğrulanır.

### 5.3 Regolit BRDF: karşıtlık etkisi (opposition surge)
Faz açısı 0'a yaklaşırken parlaklık artışı (gölge gizlenme + tutarlı
geri saçılma): Hapke'nin sadeleştirilmiş formu
`f = Lambert · (1 + B0 / (1 + tan(g/2)/h))`, B0 ≈ 0,5–1, h ≈ 0,05 (Ay
ortalaması). Görünür sonuç: **astronotun/gezginin kendi gölgesinin başı
çevresinde ışık halesi** (heiligenschein) — Apollo fotoğraflarının imza
etkisi. `onBeforeCompile` parçası; arazi malzemesi (plan 1 §5) alır.

### 5.4 Farlar (gezgin) — vakum
- SpotLight kandela ile (Curiosity LED'leri mütevazı; sinematik: 2×
  2 000 cd), açı 30°, penumbra 0,4, **IES benzeri profil**: `cos^n` yerine
  tablo (1D doku) ile gerçek far dağılımı (merkez düz, kenar düşüş).
- **Huzme çizilmez** (vakum). Zeminde ışık deseni + tekerlek tozu varsa
  toz parçacıkları farla aydınlanır (toz Points malzemesi far yönünü okur).
- Lens: emissive + küçük glow sprite (mesafeyle ölçekli, `fitGlow`).
  Bloom yok; kamera direkt baktığında **lens flare** (§7) izinli.
- Mars/Earth ortamında `beam.mjs`: koni içinde ray-march saçılma
  (Mie ağırlıklı, faz fonksiyonu Henyey-Greenstein g≈0,6), gölge haritasıyla
  kesilmiş (ışık şaftları). Yalnız `scattering > 0` ortamlarda.

### 5.5 Sıcak metal
Motor çanı ateşleme sonrası 900–1 300 K → `blackbodyRGB` emissive, soğuma
üstel (τ ≈ 20–40 s) — mevcut "emissive kor" katmanı bu tabloya bağlanır.
RTG kanatları ~470 K: görünür ışıma **yok** (dürüst; altyazı ısıyı söyler).

## 6. `light-rig.mjs` — sahne ışık dili tokenları

```js
const rig = createLightRig(scene, { env:'vacuum', sun:{ elevDeg:14, azDeg:40, lux:127000 },
  fill:'auto', exposure:{ target:0.18, adapt:{ up:0.6, down:2.5 } }, shadows:{ cascades:3 } });
rig.update(dt, camera);   // pozlama adaptasyonu, gölge kaskadı, Dünya-ışığı yönü
rig.describe();           // manifest ve altyazı için ışık tablosu (lux, cd, K)
```

- **Tek Güneş** her sahnede aynı yön (cinematic-space-plan §8 kuralı) —
  rig, alt sahnelere (cockpit, surface, orbital) aynı `sunDir`'i verir.
- Tema tokenları: sıcak dolgu/soğuk dolgu renkleri paletten
  (`palette-library.json` obsidyen-şampanya) değil **fizikten**; palet yalnız
  UI/HUD'a. (Sözleşme: "one light logic per scene".)
- **6.3 Adaptasyon**: log-ortalama parlaklık 1/4 çözünürlükte readback yerine
  **bilinen sahne parlaklığından analitik** (kokpit ↔ yüzey EV tablosu) —
  readback pahalı ve deterministik değil. Geçiş kritik sönümlü, hızlı
  karanlıkta yavaş (gerçek göz: ışığa 0,6 s, karanlığa dakikalar → sinematik
  2,5 s; bildirilir).

## 7. Lens katmanı (fizik değil, kamera — ayrı ve ilan edilmiş)

- **Bloom**: yumuşak diz (sözleşme §4) — `UnrealBloomPass` eşiği yerine
  `LuminosityHighPassShader` türevi `SoftKneeHighPass` (knee 0,5) vendor
  yanına yazılır; küçük parlak nokta yasak (sprite minimum boyutu).
- **Lens flare**: gerçek olgu (açıklık kırınımı + eleman yansımaları):
  Güneş/far için starburst (açıklık kanat sayısı 6–9 → 6–9 ışın) + ghost
  dizisi (optik eksen üstünde ters konumlar). Yalnız kaynak kadrajdaysa,
  örtülme testi (raycast/derinlik) ile ramp. r184 `examples/jsm/objects/Lensflare.js`
  vendor'a alınabilir; ancak ghost yerleşimi için kendi hafif sürümümüz
  daha kontrol edilebilir — karar §12.
- **Işın kanamaları/anamorfik çizgi**: YASAK (belgesel dili, oyun değil).
- Her lens efekti manifest'te `truthLevel: illustrative`, "kamera olgusu"
  notuyla.

## 8. Modül mimarisi

```
presets/core/light-physics.mjs      # birimler, blackbodyRGB, emissionLineRGB, flickerField, LightEnvironment (three'siz saf kısım ayrı: light-math.mjs)
presets/light_blocks/
├── light-rig.mjs                   # §6
├── fire.mjs                        # §3 (earth/interior)
├── smoke.mjs                       # §4.3
├── beam.mjs                        # §5.4 (yalnız saçılan ortam)
├── headlamp.mjs                    # far/kask lambası: IES profili, lens glow, ortam kuralı
├── hot-metal.mjs                   # §5.5 soğuma eğrisi
├── lens/ soft-knee-bloom.mjs, flare.mjs
├── index.html                      # vitrin: ortam menüsü (vacuum/mars/earth/interior) × olgu; ?export=1&t=
└── motion-manifest.json
craft_blocks/craft-effects.mjs      # propellant + gimbal + zemin ışığı (geriye uyumlu)
```

Bağımlılık: `light_blocks → core/light-physics`; `terrain_blocks`, `craft_blocks`,
`astronaut_blocks` → `core/light-physics` (altyapı, sert bağımlılık serbest);
bloklar `light_blocks`'a **yumuşak** bağlanır (yoksa bugünkü basit ışıklar).

## 9. Doğrulama

`scripts/validate-light.mjs` (Node, three'siz):
1. `blackbodyRGB` çapaları (§2.2); monotonluk (T ↑ → mavi oran ↑).
2. Ters kare: kandela → lux hesabı `E = I/d²` ±1e-6.
3. Ortam kuralı: `fire@vacuum`, `beam@vacuum` reddedilir; `fire@earth` kabul.
4. Flicker: spektrum 1/f eğimi −0,8…−1,2; genlik sınırı aşılmaz.
5. Adaptasyon: EV geçişi kritik sönümlü, aşım yok.
6. Yakıt tablosu: her `propellant` için renk durağı tanımlı, NaN yok.

Headless piksel ölçümü (sözleşme §6): far zemininde parlaklık **d⁻²**
düşüyor mu (üç noktadan okuma); heiligenschein: faz açısı 0 piksellerde
parlaklık artışı ≥ %20; bloom: küçük parlak noktada titreme yok
(deterministik `advance` + piksel-diff izole tepe dedektörü).

Ekran görüntüsü tabloları: `docs/media/light-*.jpg` — meşale (earth),
Raptor vs RS-25 vs SRB yan yana, gezgin farları gece vakum, Apollo
heiligenschein, kokpit→yüzey adaptasyon dizisi.

## 10. Manifest kayıtları (özet)

| id | type | truthLevel | Not |
|---|---|---|---|
| `light-torch-fire` | simulation | illustrative | difüzyon alevi stilize; renk Planck; yalnız oksijenli ortam |
| `light-propellant-color` | simulation | real (renk kimyası) / illustrative (akış) | yakıt tablosu kaynaklı |
| `light-headlamp-vacuum` | focus | real | huzme yok; zemin deseni IES |
| `light-headlamp-beam` | simulation | illustrative | HG faz fonksiyonu, tek saçılma |
| `light-opposition-surge` | focus | real (sadeleştirilmiş Hapke) | heiligenschein |
| `light-earthshine-fill` | focus | real | ~12 lux, Dünya yönü geometrik |
| `light-exposure-adapt` | state-transition | illustrative | 2,5 s sinematik |
| `light-lens-flare` | focus | illustrative | kamera olgusu |

## 11. Riskler

| # | Risk | Azaltma |
|---|---|---|
| L1 | Ray-march alev/duman mobilde pahalı | Adım sayısı kalite yöneticisiyle (three_body_states deseni: kare süresine göre kademe); `?perf=1` |
| L2 | Ambient kaldırınca eski sahneler kararır | Geçiş bayrağı `lighting:'physical'`; piksel karşılaştırma; kullanıcı onayı |
| L3 | Fiziksel birimlerde `intensity` değerleri mevcut sahnelerle çelişir | light-rig **yeni** sahnelerde; eski sahneler dokunulmaz, isteğe bağlı geçer |
| L4 | Bloom yumuşak diz için vendor'a dokunmak | Yeni pass ayrı dosya; UnrealBloomPass değişmez |
| L5 | "Muhteşem" beklentisi ile "dürüst" (huzmesiz vakum) çatışır | Vitrin, aynı farı vacuum/mars/earth'te yan yana gösterir; farkın kendisi içeriktir |

## 12. Uygulama fazları

- **F0 — çekirdek**: `light-physics.mjs` (+ `light-math.mjs` saf), blackbody
  tablosu, flicker, ortam etiketi, `validate-light.mjs`. ~1 gün.
- **F1 — light-rig + yüzey ışığı**: Güneş/Dünya-ışığı/sıçrama hesaplı,
  opposition surge parçası, adaptasyon; surface-scene'de bayrakla deneme. ~1,5 gün.
- **F2 — far + hot-metal + lens**: headlamp IES, glow, soft-knee bloom,
  flare; gezgin gece tablosu. ~1,5 gün.
- **F3 — plüm genişletmesi**: `propellant`, gimbal, zemin ışığı, duman. ~2 gün.
- **F4 — ateş**: fire.mjs (earth/interior), kıvılcım, ısı hazesi, titreşen
  gölge; vitrin tamam; manifest/KATALOG/README/`docs/media`. ~2 gün.

## 13. Açık kararlar

1. Meşale hangi sahnede kullanılacak? Depoda Dünya-yüzeyi sahnesi yok; ilk tüketici vitrin + ileride "habitat/iç mekân" olabilir. (Öneri: F4 en sona, kullanım sahnesi netleşince.)
2. Lensflare: three örneğini vendor'a mı, kendi hafif sürümümüz mü? (Öneri: kendi — ghost kontrolü + determinizm.)
3. Pozlama adaptasyonu cinematic_space rayına bağlansın mı (kokpit→yüzey)? (Öneri: evet, `p`'nin fonksiyonu olarak — deterministik.)

---

## 14. Revizyon (16 Eylül 2026, ikinci tur) — eksikler ve yeni planlarla bağlar

| # | Eksik | Karar |
|---|---|---|
| R1 | **Alan çizgileri ışıması**: field planı çizgi/şerit çizer; "spectacle" stilinde bloom ister. Kural yoktu. | §7 bloom kuralı alan çizgilerine de uygulanır: opak gövde + yumuşak dizli bloom yalnız yıldız/kara delik sahnelerinde; documentary/instrument stillerinde bloom yok. Renk = büyüklük (sıralı palet), additive beyaz yasak (§4). |
| R2 | **Kara delik/akresyon ışığı**: disk sıcaklığı ∝ r^−3/4 → `blackbodyRGB`; Doppler ışıması ve gravitasyonel kızıla kayma renk kaymasıdır; çekirdekte "kaydırmalı blackbody" yoktu. | `light-physics.mjs`: `blackbodyRGB(T, { dopplerFactor, gravRedshift })` — spektrum sıcaklık ölçeğinde kaydırılır (T_gözlenen = T·δ/(1+z)); sky planı 4.6 tüketir. |
| R3 | **Yıldız fotometrisi**: kadir → ekran parlaklığı pozlamaya bağlı; sky planı §3.4 bunu light'tan bekler. | `light-rig` `exposure` API'si `luxToScreen(E)` ve `magnitudeToScreen(m)` verir; tek pozlama, tek dönüşüm. Güneş kadrajdayken m > 3 yıldızlar sönük (dürüst). |
| R4 | **Mars gök rengi** (gündüz tereyağı, mavi gün batımı) ışık ortamının parçasıdır: gök = dolgu ışığı kaynağı. | `LightEnvironment.mars`: gök renk/şiddet eğrisi Güneş irtifasının fonksiyonu (sky planı §3.3 ile ortak model, tek kaynak `core/sky-radiance.mjs`); HemisphereLight gök kanalı buradan. |
| R5 | **İç mekân (`interior`)** ortamı tanımlıydı ama ışık türü yoktu: habitat içi LED paneller `RectAreaLight` ister; `RectAreaLightUniformsLib` vendor'da **yok** (kontrol: `vendor/` yalnız controls/lines/postprocessing/shaders). | Habitat iç mekân dalgasında `RectAreaLightUniformsLib` vendor'a alınır (tek kopya kuralı); o zamana kadar `interior` = geniş penumbralı Spot yaklaşımı, manifest'te ilan. Dış habitat ışıkları (kapı lambası, uyarı feneri, yol lambası) `headlamp.mjs` + `hot-metal` tablosuyla. |
| R6 | **Astronot vizörü** ve kask lambaları: astronot planı §3.3–3.4 envMap ve headlamp ister; light'ta "tek kare envMap" kuralı yoktu. | `light-rig.captureEnvironment(pos)` — kurulumda bir kez, 256², deterministik; vizör ve MLI tankları (habitat) aynı haritayı paylaşır. |
| R7 | **Nefes bağlantısı**: flicker alanı (§2.3) breathing katalogunda `flameFlicker`/LED nabızları olarak görünür; iki kütüphane aynı işi yapmasın. | Titreşim üreteci `core/life-signs.mjs`'e taşınır (1/f + φ³ karışımı orada); `light-physics` onu **içe aktarır**. Tek kaynak. |
| R8 | **Kalıcı gölge kraterleri** (Ay kutbu): Güneş hiç girmez; tek ışık kask/gezgin lambaları + yıldız ışığı (~2·10⁻⁴ lux); Dünya-ışığı ufuk altı. | `moon-polar-rim` profili için `light-rig` önayarı `permanentShadow`: Güneş sıyırma açısı 1–2°, dolgu ≈ 0, adaptasyon karanlığa (2,5 s ilanlı); imza kare Artemis. |

Bağlar: [field-visualization-plan.md](field-visualization-plan.md) §4.4/§7, [sky-objects-plan.md](sky-objects-plan.md) §3.3–3.4/§4.6,
[habitat-blocks-plan.md](habitat-blocks-plan.md) §4.4/§4.9, [astronaut-figure-plan.md](astronaut-figure-plan.md) §3.3–3.4,
[breathing-motion-plan.md](breathing-motion-plan.md) §5.
