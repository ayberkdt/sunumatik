# Sunumatik

[![ci](https://github.com/ayberkdt/sunumatik/actions/workflows/ci.yml/badge.svg)](https://github.com/ayberkdt/sunumatik/actions/workflows/ci.yml)
![preset](https://img.shields.io/badge/preset-61-d9b877)
![beceri](https://img.shields.io/badge/yapay%20zek%C3%A2%20becerisi-18-8fb8dd)
![sayısal denetim](https://img.shields.io/badge/say%C4%B1sal%20denetim-296%20ge%C3%A7ti-8fd39a)
![bağımlılık](https://img.shields.io/badge/ba%C4%9F%C4%B1ml%C4%B1l%C4%B1k-yok-9a938a)

**Bilim sunumları için preset kütüphanesi** — gerçek fizikten türetilmiş WebGL gök cismi sahneleri, sayısal akışkan/yörünge/ML simülasyonları, astrodinamik ve GNC laboratuvarları, bildirimsel grafik motoru, hareket/geçiş presetleri, renk temaları ve bunları üreten 18 yapay zekâ becerisi. Tamamı bağımsız HTML/CSS/JS: derleme adımı yok, internet bağımlılığı yok, `file://` dışında her yerel sunucuda çalışır.

Üç ilke her preset'te geçerlidir:

- **Hiçbir sayı elle yerleştirilmez.** Yörünge, koridor, kapsama, ısı akısı, Lagrange noktası — hepsi sahnede çalışan bir modelden çıkar; literatür değerleri yalnızca denetimde karşılaştırılır (`node scripts/validate-astro.mjs`, 296 sayısal denetim, CI adımı).
- **Görsel öğe = adlandırılmış fenomen.** Plazma kılıfı Sutton–Graves ısı akısıyla, etki küresi Laplace ölçütüyle, Kármán caddesi kafes Boltzmann çözümüyle çizilir; altyazı gerçek/temsilî ayrımını açık tutar, model ve sınırlar sahnede yazılıdır.
- **Deterministik ve erişilebilir.** Her sahne tohumludur, `?t=` / `export=1` ile aynı kareyi üretir, `prefers-reduced-motion` altında son karede durur, klavye ve HUD metniyle okunur.

Envanter elle sayılmaz: `presets/registry.json` taramayla üretilir (`node scripts/build-registry.mjs`) ve `node scripts/validate-invariants.mjs` bu dosyadaki ve dokümanlardaki sayı/yol iddialarını denetler.

<p align="center">
  <img src="docs/media/sun.jpg" alt="Sol — prosedürel aktif Güneş: korona ışın demetleri, patlama kurdeleleri ve akışkan püskürmeler" width="820">
</p>

| | | |
|:---:|:---:|:---:|
| ![Satürn — halka gölgeleri ve canlı atmosfer](docs/media/saturn.jpg) | ![Jüpiter — kuşak rüzgârları ve Galile uyduları](docs/media/jupiter.jpg) | ![Dünya — gece ışıkları ve fresnel atmosfer](docs/media/earth.jpg) |
| **Satürn** — halka gölgeleriyle | **Jüpiter** — canlı kuşaklar, uydu geçişleri | **Terra** — şehir turlu Dünya |
| ![Ay — yörünge izli uydu uçuşu](docs/media/moon.jpg) | ![Grafik motoru — palet uyumlu seri renkleri, belirsizlik bandı, eşik](docs/media/chart.jpg) | ![23 bilim ikonu](docs/media/icons.jpg) |
| **Lunaris** — yörüngede uydu | **Chart** — spec ver, grafik al | **İkonlar** — 23 bilim ikonu |

## Laboratuvar galerisi

Astrodinamik ve GNC laboratuvarları: her biri saf bir model modülü, üstünde bir sahne. Görüntüler `?export=1` deterministik karesinden alınmıştır — sunumda göreceğiniz kare budur.

<p align="center">
  <img src="docs/media/lab-soi_explorer.jpg" alt="Etki Küresi Kâşifi — Dünya etki küresi ve Hill küresi gerçek ölçekte, Mars'a kalkış hiperbolü, gün işaretleri, Laplace oran paneli ve Güneş çerçevesi paneli" width="820">
</p>

| | | |
|:---:|:---:|:---:|
| ![Etki küresi — Dünya kamerası, kalkış hiperbolü ve sonda](docs/media/lab-soi_explorer_earth.jpg) | ![Giriş koridoru — katmanlı atmosfer, ısı akısıyla renklenen yörünge, plazma kılıfı](docs/media/lab-reentry_corridor.jpg) | ![Halo yörüngeleri ve değişmez manifoldlar](docs/media/lab-halo_manifolds.jpg) |
| **Etki küresi** — park yörüngesinden v∞ hedefli hiperbol | **Giriş koridoru** — plazma kılıfı, koridor bölgesi | **Halo + manifoldlar** — kararlı/kararsız demetler |
| ![Ay serbest dönüş yörüngesi](docs/media/lab-free_return.jpg) | ![CR3BP ve Lagrange noktaları](docs/media/lab-cr3bp_lagrange.jpg) | ![Kütleçekim yardımı ve B-düzlemi](docs/media/lab-gravity_assist.jpg) |
| **Serbest dönüş** — Apollo 13'ün "8" figürü | **CR3BP** — L1–L5, sıfır-hız eğrileri | **Kütleçekim yardımı** — B-düzlemi hedefleme |
| ![Porkchop kâşifi](docs/media/lab-porkchop_explorer.jpg) | ![Fırlatma ve tırmanış](docs/media/lab-launch_ascent.jpg) | ![Takımyıldız kapsama](docs/media/lab-constellation_coverage.jpg) |
| **Porkchop** — Lambert C3 / ΔV haritası | **Fırlatma** — yerçekimi dönüşü, max-q, MECO | **Kapsama** — Walker takımyıldızları |
| ![Tisserand grafiği](docs/media/lab-tisserand_graph.jpg) | ![Lambert transfer kâşifi](docs/media/lab-transfer_explorer.jpg) | ![Fırlatma penceresi ve azimut](docs/media/lab-launch_window.jpg) |
| **Tisserand** — çoklu geçiş planlayıcı | **Transfer** — Lambert yayı, TOF taraması | **Fırlatma penceresi** — azimut, LST, dogleg |
| ![Düşük itkili transfer](docs/media/lab-low_thrust_transfer.jpg) | ![Yörünge belirleme, EKF](docs/media/lab-orbit_determination.jpg) | ![Randevu ve kenetlenme](docs/media/lab-rendezvous_docking.jpg) |
| **Düşük itki** — spiral, Edelbaum | **Yörünge belirleme** — EKF, NEES/NIS | **Randevu** — CW yaklaşmaları, KOS |
| ![3B yörünge ve yer izi](docs/media/lab-ground_track_3d.jpg) | ![Yönelim ve GNC](docs/media/lab-attitude_gnc.jpg) | ![Tutulma ve görüş geometrisi](docs/media/lab-eclipse_geometry.jpg) |
| **Yer izi** — J2 düğüm kayması | **Yönelim** — tepki tekerlekleri, kuaterniyon PD | **Tutulma** — umbra/penumbra, β açısı |
| ![Küresel harmonik yerçekimi alanı](docs/media/lab-gravity_field.jpg) | ![Giriş dağılımı Monte Carlo](docs/media/lab-entry_dispersion.jpg) | ![GEO istasyon tutma bütçesi](docs/media/lab-geo_stationkeeping.jpg) |
| **Yerçekimi alanı** — jeoit, anomali | **Giriş dağılımı** — 3σ menzil, duyarlılık | **GEO** — doğu–batı/kuzey–güney bütçesi |

Sayısal simülasyon ve sinematik sahneler:

| | | |
|:---:|:---:|:---:|
| ![Kármán vorteks caddesi, kafes Boltzmann](docs/media/lab-aero_vortex_street.jpg) | ![Kanat profili etrafında panel yöntemi akımı](docs/media/lab-aero_airfoil_flow.jpg) | ![Süpersonik şok dalgaları](docs/media/lab-aero_shock_waves.jpg) |
| **Vorteks caddesi** — D2Q9 canlı çözüm | **Kanat profili** — Kutta koşulu, sınır tabakası | **Şok dalgaları** — eğik şok, Prandtl–Meyer |
| ![Kayıp yüzeyinde optimizasyon yarışı](docs/media/lab-ml_loss_landscape.jpg) | ![Sinematik uzay yolculuğu kabuğu](docs/media/lab-cinematic_space.jpg) | ![Üç fazlı Ay inişi](docs/media/lab-lunar_descent.jpg) |
| **Kayıp yüzeyi** — SGD / momentum / Adam | **Sinematik uzay** — dış uzay → güverte → konsol | **Ay inişi** — entegre üç faz, toz ve plum |

## Hızlı başlangıç

```
demo\sunumu-baslat.cmd
```

Sinematik uzay yolculuğunu (dış uzay → kanopi → güverte → bölüm konsolu)
doğrudan açmak için: `demo\sinematik-baslat.cmd` — aynı sunucu, farklı
açılış sayfası.

Yerel sunucu açılır ve tüm preset'leri kullanan örnek deste yüklenir
(`http://localhost:8790/demo/index.html`; 8790 doluysa 8795/8798'e kayar —
açılan adresi kullanın). Tarayıcılar `file://` altında ES
modüllerini engellediği için yerel sunucu şarttır — herhangi bir statik
sunucu (`python -m http.server`) yeterlidir.

İlk beş dakika için önerilen rota:

1. `http://localhost:8790/demo/index.html` — canlı katalog; **G** dizini açar, ok tuşları slayt değiştirir.
2. `http://localhost:8790/presets/soi_explorer/index.html` — bir laboratuvarı tek başına aç; sekmeler, kaydırıcılar ve kameralar canlı.
3. Aynı adrese `?export=1&t=2.5` ekle — deterministik kare; sunum çıktısı bu kareyi kullanır.
4. `node scripts/validate-astro.mjs` — sahnelerin dayandığı sayıların bağımsız denetimi.

## Örnekler

Her preset `mount…(host, options)` ile bir kaba takılır, bir API nesnesi döndürür ve `dispose()` ile kalkar. Tüm sahneler `three` importmap'ini `presets/moon_advanced/vendor/` altındaki gömülü kopyaya bağlar; CSS token'ları (`--color-ink`, `--color-accent`, `--color-data-1`…) sayfadan devralınır, bu yüzden bir palet değiştiğinde sahne de değişir.

**Etki küresi** — Laplace r_SOI, kalkış hiperbolü ve Güneş çerçevesi ([`presets/soi_explorer`](presets/soi_explorer)):

```html
<script type="importmap">{ "imports": { "three": "presets/moon_advanced/vendor/three.module.min.js" } }</script>
<link rel="stylesheet" href="presets/core/lab-scene.css">
<div id="host" style="height:70vh"></div>
<script type="module">
  import { mountSoi } from './presets/soi_explorer/soi-explorer.mjs';
  const so = await mountSoi(document.querySelector('#host'), { case: 'mars', hPark: 200, camera: 'soi' });
  so.model.tSoiDays;                       // 3,15 gün — hiperbolik anomaliden
  so.model.helio.aphelion / 149597870.7;   // 1,52 AU — Mars yörüngesine değer
  so.set({ vinf: 8.8 });                   // Jüpiter: yeniden kurulur, giriş kaskadı tekrar oynar
  so.camera.transitionTo('follow');        // sondayı izle
</script>
```

**Giriş koridoru** — Apollo sınıfı kapsül, koridor bisection ile bulunur ([`presets/reentry_corridor`](presets/reentry_corridor)):

```js
import { mountReentry } from './presets/reentry_corridor/reentry.mjs';
const re = await mountReentry(host, { vehicle: 'capsule', entry: { vEntry: 11000, gammaEntry: -6.2, bank: 60 }, warp: 4 });
re.corridor.width;        // ≈ 2,3° — aşma ve altında-kalma sınırları arasındaki açı
re.sim.peakQ.q / 1e6;     // tepe ısı akısı, MW/m² (Sutton–Graves)
re.timeline.scrub(120);   // 120. saniye: plazma kılıfı en parlak yerinde
```

**Yörünge ver → animasyon al** — Kepler elemanları ya da RK4 + impulsif yakışlar ([`presets/orbital_stage`](presets/orbital_stage)):

```js
import { mountOrbitalStage } from './presets/orbital_stage/orbital-stage.mjs';
const stage = await mountOrbitalStage(host, { central: 'earth', warp: 300 });
stage.addTrajectory({ kepler: { a: 42164, e: 0, i: 0, raan: 0, argp: 0, nu0: 0, mu: 398600.4418 }, span: 'full' });
const mission = stage.addTrajectory({ propagate: { r0: [6678, 0, 0], v0: [0, 7.73, 0], mu: 398600.4418, tMax: 40000,
  burns: [{ t: 0, dv: [0, 2.43, 0] }, { t: 19000, dv: [0, -1.47, 0] }] } });   // LEO → GEO Hohmann
await stage.setCraft(mission, 'orbiter'); mission.focus(); stage.hud(true);
```

**Grafik motoru** — spec ver, animasyonlu SVG al ([`presets/charts_icons/chart-preset`](presets/charts_icons/chart-preset)):

```js
import { mountChart } from './presets/charts_icons/chart-preset/chart.mjs';
mountChart(host, {
  type: 'line', title: 'Katsayı kaybı 60. derecede görev sınırını aşıyor',
  x: { label: 'Harmonik derecesi' }, y: { label: 'Yörünge sapması', unit: 'm' },
  series: [
    { name: 'Gözlem', slot: 1, markers: true, area: true, data: [[10, 2.1], [30, 3.2], [50, 6.8], [70, 15.5]],
      band: [[10, 1.7, 2.5], [30, 2.6, 3.8], [50, 5.6, 8.0], [70, 12.6, 18.4]] },
    { name: 'Projeksiyon', slot: 2, style: 'projected', data: [[50, 6.8], [70, 19.0], [80, 30.5]] },
  ],
  refLines: [{ y: 10, label: 'görev sınırı' }],
});
```

**URL parametreleri** — sahneler etkileşimli sayfalarında aynı seçenekleri adres çubuğundan alır; sunum çalıştırıcıları ve export bu yolu kullanır:

| Parametre | Anlamı | Örnek |
|---|---|---|
| `export=1` | Deterministik kare, alt bilgi gizli, hareket yok | `presets/reentry_corridor/index.html?export=1` |
| `t=` | Zaman çizgisi konumu (preset birimiyle: s, gün ya da TU) | `presets/soi_explorer/index.html?t=2.5` |
| `cam=` | Kamera (`soi`/`moon`/`earth`/`follow`/`free`, sahneye göre) | `presets/halo_manifolds/index.html?cam=top` |
| preset'e özgü | `case=`, `vinf=`, `veh=`, `gamma=`, `dv=`, `th=`, `site=`… | `presets/free_return/index.html?dv=3.14&th=229` |

Her preset'in tam parametre listesi `skills/design-scientific-motion/references/<ad>.md` içindedir.

## Ne var?

### WebGL sahneleri — `presets/`

Hepsi gerçek fizikten türetilmiş, "efekt yığını değil" ilkesiyle: her görsel
öğe adlandırılmış bir fenomene karşılık gelir ve altyazı gerçek/temsilî
ayrımını açık tutar.

| Klasör | İçerik |
|---|---|
| [`sun_advanced/`](presets/sun_advanced) | Prosedürel aktif Güneş: diferansiyel dönme, Joy yasalı benek çiftleri, patlama kurdeleleri, kademeli manyetik ilmek takımı, 240k parçacıklı akışkan püskürmeler, tutulma-anatomili korona. `sol-decor.mjs` ile herhangi bir 2B tuvale "uzak Güneş" olarak kompozitlenir. |
| [`moon_advanced/`](presets/moon_advanced) | Gerçek dokulu Ay + yörünge uçuşu. `vendor/` klasörü three.js'i barındırır — diğer sahneler buradan import eder, **kardeş klasör yapısını bozmayın**. |
| [`earth_advanced/`](presets/earth_advanced) | Dünya: gece ışıkları (terminatör maskeli), fresnel atmosfer, 8 gerçek şehirlik rehberli tur. |
| [`planets_advanced/`](presets/planets_advanced) | Merkür→Neptün: gaz devlerinde canlı atmosferler (zıt kuşak rüzgârları, Büyük Kırmızı Leke, Satürn altıgeni + halka gölgeleri), Galile uyduları ve geçiş gölgeleri, NASA veri paneli. |
| [`moon_react_source/`](presets/moon_react_source) | Lunaris'in React/Next.js orijinali + doku ve yörünge verileri + ortak CSS. |
| [`lunar_orbit/`](presets/lunar_orbit) | Hafif analitik iki-cisim Ay yörünge modeli. |
| [`cosmos_advanced/`](presets/cosmos_advanced) | Derin uzay fonu: tohumlu yıldız alanı (gerçekçi kadir dağılımı, kara-cisim renkleri, sintilasyon), **gerçek ESO GigaGalaxy Samanyolu panoraması** (prosedürel yedekli), opsiyonel bulutsu, deterministik meteorlar; dikdörtgen dekor modülüyle gömülür. |
| [`jwst_explorer/`](presets/jwst_explorer) | 10 resmi James Webb / Hubble görüntüsü üstünde etkileşimli keşif: yaylı pan/zoom, yayın metinlerinden ilgi noktaları, Webb↔Hubble / NIRCam↔MIRI tek-kameralı karşılaştırma perdesi. Krediler gömülü. |

### Sahne blokları — birleştirilebilir 3B sistem

Manim ayarında, blok blok kurulabilir sahneler; program ve donmuş API (eksen sözleşmesi dahil) `skills/design-scientific-motion/references/scene-blocks.md` içinde.

| Klasör | İçerik |
|---|---|
| [`cinematic_space/`](presets/cinematic_space) | **Sinematik uzamsal yolculuk kabuğu**: sunum tek ve sürekli bir dünyada geçer — dış uzay kompozisyonu (Ay + tutunan orbiter) → kanopi eşiği → gözlem güvertesi → veri güdümlü bölüm konsolu → pencere-maskeli `orbital_stage` teslimi ya da küre→arazi teslimli dalışla `buildRover` vistası. Kompozisyon, kopya değil: gök cosmos'tan, Ay `buildMoonMesh`'ten, araçlar craft-blocks'tan. Tüm hareket `(t, seed)`'in saf fonksiyonu; `goTo/back/setProgress/advance` API'si. |
| [`orbital_stage/`](presets/orbital_stage) | **Yörünge ver → animasyon al**: Kepler elemanları, durum vektörü dizisi (gerçek görev verisi) ya da RK4 + impulsif yakışlar; yakış hayaletleri, kamera yönetmeni, telemetri HUD. Demo: LEO→GEO Hohmann (ΔV 2,43+1,47 km/s) + Ay'a hiperbolik varış ve yakalama. |
| [`craft_blocks/`](presets/craft_blocks) | Estetik parametrik araç kütüphanesi: orbiter, iniş aracı, 2 kademeli roket, CubeSat, kapsül + 2. dalga: Starship, gezgin (rover), Mars helikopteri, derin uzay sondası — donmuş eksen/palet sözleşmesiyle tüm bloklar birleşir. `craft-effects.mjs` sinematik ateşleme sistemi (mach elmaslı alevler, ateşleme flaşı). |
| [`aircraft_blocks/`](presets/aircraft_blocks) | Parametrik uçak kütüphanesi: gerçek turbofan (burulmalı fan kanatçıkları, statör, çekirdek kesiti) dahil. |
| [`lunar_descent/`](presets/lunar_descent) | Gerçek entegre üç fazlı Ay inişi (temas 0,90 m/s, ΔV 2,08 km/s), gaz kelebeği plums, toz, klasik yüzey kamerası. |

### Sayısal simülasyon sahneleri

| Klasör | İçerik |
|---|---|
| [`aero_vortex_street/`](presets/aero_vortex_street) | **Kármán vorteks caddesi, kafes Boltzmann (D2Q9, TRT) ile canlı çözülür** — salınım hiçbir yerde programlanmadı; Strouhal, Cl(t) sıfır geçişlerinden ölçülür ve Roshko bağıntısıyla karşılaştırılır. |
| [`aero_airfoil_flow/`](presets/aero_airfoil_flow) | Kanat profili etrafında GERÇEKTEN çözülen akım: vorteks panel yöntemi (Kutta koşulu kapatılabilir — kaldırmanın nereden geldiğini gösterir), Thwaites→Michel→Head sınır tabakası (stall ayrılmadan doğar), Prandtl–Glauert düzeltmesi. |
| [`aero_shock_waves/`](presets/aero_shock_waves) | Süpersonik dalga sistemi: eğik şok bağıntıları, Prandtl–Meyer yelpazesi, Mach konisi, şok elmasları — hiçbir açı elle konmaz. |
| [`ml_loss_landscape/`](presets/ml_loss_landscape) | Analitik kayıp yüzeyinde gerçek gradyanla SGD / momentum / Adam yarışı — SGD sığ tuzağa takılır, farkı canlı okursunuz. |
| [`ml_attention_flow/`](presets/ml_attention_flow) | Gerçek softmax(QKᵀ/√d) dikkat yayları, Türkçe cümle, katman/kafa/sorgu değiştirme. |
| [`ml_loss_functions/`](presets/ml_loss_functions) · [`ml_conv_vision/`](presets/ml_conv_vision) · [`ml_layer_blocks/`](presets/ml_layer_blocks) · [`ml_net_builder/`](presets/ml_net_builder) | Kayıp fonksiyonları · evrişimli görü · katman blokları · mimari kurucu. |
| [`comms_antenna/`](presets/comms_antenna) · [`comms_link_budget/`](presets/comms_link_budget) | Anten/yer istasyonu geometrisi ve kazanç · bağlantı bütçesi şelalesi (FSPL, yağmur, gürültü sıcaklığı, Eb/N0). |
| [`aurora/`](presets/aurora) | Emisyon çizgisi tabanlı aurora: 630 nm sönümleme fiziği (O(1D) τ≈110 s), Kp 0–9 morfolojisi. |

### Astrodinamik ve GNC laboratuvarları — 2. dalga (24 preset)

Her biri saf bir model modülü (`*-model.mjs` ya da `presets/core/astro-*.mjs`), sahne, deterministik URL (`?t=` / `export=1`), `motion-manifest.json` ve `skills/design-scientific-motion/references/<ad>.md` ile gelir; hepsi `node scripts/validate-astro.mjs` ile bağımsız sayısal denetimden geçer (CI adımı). Hiçbir sayı elle yerleştirilmez; model, varsayım ve sınırlar sahnede yazılıdır. Ortak sunum katmanı `presets/core/lab-scene.{css,mjs}`: kahraman HUD, giriş kaskadı (`Entrance`), tuval yardımcıları, tipografi.

| Klasör | İçerik |
|---|---|
| [`soi_explorer/`](presets/soi_explorer) | **Etki küresi kâşifi**: Laplace r_SOI = a(m/M)^(2/5) ve Hill küresi gerçek ölçekte (three.js, dönen dokulu Dünya, ilerleyen Ay, fresnel + ızgara kabuklar), park yörüngesinden v∞ hedefli kalkış hiperbolü (hızla renklenir, gün işaretleri), SOI kabuğunda Dünya → Güneş çerçevesi el değiştirme halkası, yamalı-konik artığı, Laplace oran paneli, Güneş çerçevesi paneli (transfer elipsi → afel), gezegen SOI ölçeği |
| [`reentry_corridor/`](presets/reentry_corridor) | **Giriş koridoru**: Düzlemsel giriş dinamiği + Sutton–Graves ısı akısı; katmanlı atmosfer sahnesi, ısı akısıyla renklenen yörünge, plazma kılıfı, koridor bölgesi; aşma/altında kalma sınırları bisection ile (Ay dönüşü ≈ Apollo), eş-g ve eş-ısı eğrileri |
| [`launch_ascent/`](presets/launch_ascent) | **Fırlatma ve tırmanış**: 2B tırmanış (RK4, US76 atmosfer, yerçekimi dönüşü + kapalı-çevrim 2. kademe güdümü), olay rayı (max-q türetilir, MECO/ayrılma/SECO), kayıplar; craft_blocks roket + motor efekti |
| [`rendezvous_docking/`](presets/rendezvous_docking) | **Randevu ve kenetlenme**: Clohessy–Wiltshire STM ile V-bar/R-bar/itme yaklaşmaları, KOS küresi, yaklaşma koridoru, LOS metrikleri; LVLH sahnesi |
| [`ground_track_3d/`](presets/ground_track_3d) | **3B yörünge + yer izi**: Kepler + J2 seküler oranlar, ECI→ECEF, düğüm kayması; 3B küre ve eşdikdörtgen harita eşzamanlı |
| [`porkchop_explorer/`](presets/porkchop_explorer) | **Porkchop kâşifi**: Evrensel-değişken Lambert + Standish gezegen elemanları; C3 / v∞ / ΔV ısı haritası, TOF eş-çizgileri, minimum, güneş-merkezli yan panel |
| [`constellation_coverage/`](presets/constellation_coverage) | **Takımyıldız kapsama**: Walker Delta/Star, ayak izi λ = acos(R/(R+h)cos ε) − ε, kapsama boyama, yeniden ziyaret taraması; GPS/Galileo/Iridium/LEO kabuk/GEO |
| [`formation_flight/`](presets/formation_flight) | **Formasyon uçuşu**: CW göreli yörüngeler: PCO / GCO / düzlem-içi 2:1 elips / lider–takipçi; 3B + üç izdüşüm, ayrılma istatistikleri |
| [`cr3bp_lagrange/`](presets/cr3bp_lagrange) | **CR3BP ve Lagrange noktaları**: ∇Ω = 0 ile çözülen L1–L5, Jacobi sabiti, sıfır-hız eğrileri ve yasak bölgeler, Lyapunov aileleri (diferansiyel düzeltme + süreklilik), dönen ↔ eylemsiz |
| [`gravity_assist/`](presets/gravity_assist) | **Kütleçekim yardımı ve B-düzlemi**: Yamalı-konik geçiş: hiperbol, sapma açısı, B-düzlemi hedefleme, güneş-merkezli enerji değişimi, Tisserand |
| [`attitude_gnc/`](presets/attitude_gnc) | **Yönelim ve GNC**: Euler denklemleri + tepki tekerlekleri + kuaterniyon PD; dönüş, yuvarlanma, doyma, gimbal kilidi, slerp senaryoları |
| [`orbit_perturbations/`](presets/orbit_perturbations) | **Yörünge pertürbasyonları**: RK4 ile J2, sürükleme (Vallado termosfer), SRP, üçüncü cisim; eleman zaman serileri, analitik seküler oranlarla karşılaştırma |
| [`eclipse_geometry/`](presets/eclipse_geometry) | **Tutulma ve görüş geometrisi**: Sonlu Güneş diskli konik gölge (umbra/penumbra), β açısı, istasyon yükselme, örtülme; bantlar ve eğriler |
| [`conjunction_covariance/`](presets/conjunction_covariance) | **Yakın geçiş ve kovaryans**: TCA (altın oran), karşılaşma düzlemi kovaryansı, 2B çarpışma olasılığı integrali, seyrelme eğrisi, eşik kararı |
| [`gravity_field/`](presets/gravity_field) | **Küresel harmonik yerçekimi alanı**: Tam normalize Legendre (kararlı özyineleme), jeoit (Bruns, GRS80 çıkarılmış) ve serbest-hava anomalisi; düşük derece gerçek (EGM96), üstü açıkça SENTETİK; C̄20 düğüm kayması çapraz denetimi |
| [`transfer_explorer/`](presets/transfer_explorer) | **Lambert transfer kâşifi**: r1, r2, Δθ, TOF → transfer yayı, v1/v2, ΔV; kısa/uzun yol; TOF taraması ve Hohmann limiti (Δθ → 180° eşleşmesi denetimde) |
| [`halo_manifolds/`](presets/halo_manifolds) | **Halo yörüngeleri ve değişmez manifoldlar**: Richardson 3. mertebe + 6×6 STM düzeltmesi, Az sürekliliği; monodromi özvektörlerinden kararlı/kararsız manifold demetleri; kararlı demetten Dünya'ya transfer analizi; 3B dönen çerçeve |
| [`orbit_determination/`](presets/orbit_determination) | **Yörünge belirleme (EKF)**: Yer istasyonu menzil/menzil-hızı ölçümleri, genişletilmiş Kalman filtresi (sonlu-fark STM, analitik H, Joseph), NEES/NIS tutarlılığı; gözlenebilirlik ve model hatası senaryoları |
| [`low_thrust_transfer/`](presets/low_thrust_transfer) | **Düşük itkili transfer**: Sürekli teğetsel itki spirali (değişken kütle RK4), Edelbaum analitik ΔV (eğiklik dahil), Hohmann ve Tsiolkovsky karşılaştırması, gölge görev çevrimi |
| [`tisserand_graph/`](presets/tisserand_graph) | **Tisserand grafiği**: Gezegen sabit-v∞ eğrileri, δ_max ile erişilebilir yaylar, Dünya rezonansları, açgözlü çoklu geçiş dizisi planlayıcı (VEEGA…); fazlama yok |
| [`entry_dispersion/`](presets/entry_dispersion) | **Giriş dağılımı (Monte Carlo)**: reentry_corridor çekirdeği üstünde tohumlu sapmalar → menzil histogramı, 3σ, duyarlılık payları, doğrusal RSS ↔ Monte Carlo oranı |
| [`geo_stationkeeping/`](presets/geo_stationkeeping) | **GEO istasyon tutma bütçesi**: doğu–batı sürüklenme gerçek C̄22/S̄22'den (kararlı 75° D / 105° B kök olarak), kuzey–güney Ay+Güneş 1 yıllık RK4 (Δi ≈ 0,86°/yıl → ~46 m/s), SRP eksantriklik, ömür yakıtı kimyasal vs elektrikli |
| [`launch_window/`](presets/launch_window) | **Fırlatma penceresi ve azimut**: sin β = cos i / cos φ, Dünya dönmesi düzeltmesi, LST ile günde iki fırsat (UTC), menzil güvenliği sektörü, gecikme → düzlem değişimi ΔV → pencere genişliği; i < φ dogleg uyarısı |
| [`free_return/`](presets/free_return) | **Ay serbest dönüş yörüngesi**: Dünya–Ay CR3BP'de LEO'dan TLI ΔV ve faz taraması, bisection ile 100 km dönüş perigee çözümleri, perilune, süreler, dar koridor duyarlılığı; dönen ve eylemsiz görünümler |

### Bileşenler ve hareket

| Klasör | İçerik |
|---|---|
| [`charts_icons/chart-preset/`](presets/charts_icons/chart-preset) | **Bildirimsel grafik motoru**: spec ver → animasyonlu SVG al. Çizgi/sütun/saçılım + **keman (violin: Gauss KDE, çeyrekler, medyan, merkezden büyüme)**, belirsizlik bantları, etiketli eşikler, epistemik çizgi stilleri, **morphTo() veri geçişi, kademeli nokta doğuşu, tek atımlık sheen süpürmesi**. |
| [`motion_core/`](presets/motion_core) | Açılma/reveal, hover etkileşimleri, FLIP morph, premium slayt geçişleri (işaret bırakan zoom dahil), tablo hareketi (satır/sütun kaskadı, satır flaşı, sütun vurgusu, **hücre dolgusu: tr-TR sayaç, veri çubuğu, ısı rampası**), **primitives mikro-hareket seti** (ışıltı süpürmesi, kademeli fade-in-blur metin, telemetri çözülmesi, başlık morfu, yaylı sayaç + odometre, spot/eğim/mıknatıs, kenar kuyruğu, parıltı, sonsuz şerit). |
| [`color_themes/`](presets/color_themes) | **37 palet** (CSS token'ları; her biri renk-teorisi harmonisini bildirir, genişletilmişlerde 6 veri rengi + sıralı/ıraksak rampalar + renk körlüğü notları), kart preset'leri (stat/tanım/ikon, aksan çubuğu sistemi, giriş kaskadı), tablo preset'leri, 10 uzay motifi SVG kiti, **tipografi sistemi** (7 açık lisanslı aile, Türkçe glif desteği üç yolla doğrulandı, 6 görüntü muamelesi). |
| [`composition/`](presets/composition) | **Kompozisyon kılavuzu**: 14 ilke + kılavuz katmanı + `olcCompozisyon()` sayısal ölçüm; üçler çizgisi/grid çakışması ve altın oran 16:9'da dürüstçe ele alınır. |
| [`figure_callouts/`](presets/figure_callouts) | Figür üzerinde adım adım anlatım: kutu/daire/ok işaretleri, spot ışığı, büyüteç merceği, iddia satırları. |
| [`equation_steps/`](presets/equation_steps) · [`equation_pen/`](presets/equation_pen) · [`equation_theme/`](presets/equation_theme) | Denklemi terim terim anlatan adımlayıcı · kalemle yazma efekti · dizgi teması. |
| [`timeline_tree/`](presets/timeline_tree) · [`neural_network/`](presets/neural_network) | Kronoloji ağacı · sinir ağı ileri-geçiş animasyonu. |
| [`charts_icons/icons/`](presets/charts_icons/icons) | 23 duotone bilim ikonu (SVG sprite, kahraman katman). |
| [`charts_icons/icon-library/`](presets/charts_icons/icon-library) | 168 ikonluk yardımcı kütüphane (Lucide/Tabler/Phosphor): TR+EN aranabilir manifest, sprite, canlı filtreli önizleme, lisans metinleri. |
| [`charts_icons/domain-icons/`](presets/charts_icons/domain-icons) | **224 ikonluk alan seti** (duotone, bilim setiyle aynı el): matematik 28 · sinyal & kontrol 30 · fizik 24 · astrodinamik 30 · **GNC 26 · itki 26** · roket & uydu 30 · ML 18 · gökcisimleri 12. Bilimsel iddia taşır — odakta birincil cisim, kapanmayan hiperbol, gerçek nav-ball prograde/retrograde işaretçileri. Aile çipli önizleme + `STYLE-CARD.md` (seti genişletmek için çizim sözleşmesi). |
| [`charts_icons/domain-icons/`](presets/charts_icons/domain-icons) ikon denetimi | `node skills/create-scientific-visuals/scripts/validate-icon-usage.mjs demo/index.html` — eksik `#i-` atfı (görünmez boş kutu) ve çizim dili karışımı yakalar. |
| [`deck_starter/`](presets/deck_starter) | Yeni desteler için minimum iskelet (sabit sahne + klavye + export kancaları). |

### `skills/` — üretim talimatları

Bu kütüphaneyi üreten ve kullanan 18 yapay zekâ becerisi (SKILL.md +
references + scripts). Bir yapay zekâ ajanına (ör. Claude Code)
`.agents/skills/` altına kopyalanarak verilir; ajan deste kurarken bu
kuralları uygular. Öne çıkanlar:

- **Metin hattı** — dört katman: öz seçimi → *iddia zanaatı*
  (`write-assertive-slide-copy`: her görünür satır bir şey söyler; duvar
  metin, kelime konfetisi ve ok-zinciri yasak) → TR/EN dil yüzeyi →
  yoğunluk/punto tabanları. Türkçe-farkında doğrulayıcılarla.
- **Tasarım yasaları** — WebGL sahne sözleşmesi (süreklilik anayasası,
  GLSL güvenliği, ışık disiplini, prosedürel dağılımlar), hareket ilkeleri
  (eased zarflar, 60–120 ms kaskadlar, tek birincil olay, kesin niceliklerde
  yay/aşma yok, cam/neon/bloom dekor yok), hizalama/grid disiplini, nötr
  renk disiplini, dekor katmanlama.
- **Uçtan uca akış** — orkestratör + anlatı + kanıt doğrulama + tema +
  denklem + görselleştirme + kurulum + denetim/export becerileri.

| Beceri | Ne yapar |
|---|---|
| `orchestrate-science-presentation` | Konu → deste: anlatı, kanıt, tema, sahne ve denetim becerilerini sırayla çağırır |
| `structure-scientific-narrative` · `craft-scientific-storytelling` · `distill-scientific-insights` | Bilimsel anlatının omurgası, öykü kıvrımı, öz çıkarma |
| `write-assertive-slide-copy` · `write-turkish-slide-copy` · `write-english-slide-copy` · `enforce-slide-copy-density` | İddia satırları, TR/EN dil yüzeyi, yoğunluk ve punto tabanları (doğrulayıcılarla) |
| `design-space-science-deck` · `apply-design-tactics` | Palet kütüphanesi, tema profilleri, kart/tablo preset'leri, kompozisyon taktikleri |
| `design-scientific-motion` | Sahne blokları, hareket ilkeleri, WebGL sahne sözleşmesi, her laboratuvarın referans dokümanı, manifest şeması |
| `create-scientific-visuals` · `typeset-tex-equations` | Grafik motoru, ikon setleri ve kullanım denetimi; TeX denklem dizgisi |
| `verify-scientific-evidence` | Sayı, birim ve kaynak iddialarının doğrulanması |
| `build-html-science-deck` · `convert-science-presentation` · `import-figma-science-deck` | Deste iskeleti ve kurulum; mevcut sunumu dönüştürme; Figma içe aktarma |
| `audit-export-science-deck` | Erişilebilirlik, reduced-motion, export karesi ve depo değişmezleri denetimi |

Beceri dokümanlarındaki `/presets/...` yolları bu deponun köküne göredir.

## Doğrulama ve CI

Depo, "sahne güzel görünüyor" ile yetinmez; her push'ta [`.github/workflows/ci.yml`](.github/workflows/ci.yml) şu bekçileri çalıştırır:

| Betik | Ne yakalar |
|---|---|
| `node scripts/validate-astro.mjs` | 28 model grubu, 296 sayısal denetim: US76 atmosfer, tırmanış kayıpları, CW, Lambert ↔ Hohmann limiti, CR3BP L1–L5 ve Jacobi, halo kapanışı, EKF tutarlılığı, serbest dönüş Apollo ölçeği, SOI yarıçapları ve Laplace kesişimi… literatürle ±1 % |
| `node scripts/check-syntax.mjs` | Bütün `.mjs` dosyaları ve `index.html` modül blokları derlenir (kesme işareti hatası sınıfı) |
| `node scripts/check-imports.mjs` | Göreli ES-modül yolları ve importmap hedefleri var olmalı |
| `node scripts/build-registry.mjs` + `validate-invariants.mjs` | Envanter taramayla eşleşir; manifest varlığı, demo yolları, README/KATALOG sayı ve bağlantı iddiaları, port iddiaları |
| `python scripts/build-demo.py` (karşılaştırmalı) | Demo üreteci deterministiktir — üret ve committed sürümle karşılaştır |
| `python scripts/eksen-denetimi.py` | Eksen ratchet'i: çıplak geometri kurucuları tabanı aşamaz (sahne blokları eksen sözleşmesine uyar) |
| `validate-motion-manifest.mjs` | Her `motion-manifest.json` şemaya uyar (model, sınırlar, reduced-motion, export durumu) |
| `validate-palette-library.mjs` · `validate-icon-usage.mjs` | Palet kontrastları; demo'daki ikon atıfları ve çizim dili |

Yerelde hepsini çalıştırmak için:

```bash
node scripts/check-syntax.mjs && node scripts/check-imports.mjs && node scripts/validate-astro.mjs && node scripts/validate-invariants.mjs
```

## Depo yapısı

```
presets/
  core/                 astro-*.mjs ortak çözücüler (US76, RK4, Lambert, CR3BP…) + lab-scene.{css,mjs} sunum katmanı
  <preset>/             index.html · <ad>.mjs sahne · <ad>-model.mjs saf model · motion-manifest.json
  moon_advanced/vendor/ three.js ve eklentileri (tek kopya; importmap "three" buraya bağlanır)
  color_themes/         palet kütüphanesi, tipografi, kart/tablo bileşenleri
  charts_icons/         grafik motoru, ikon setleri
  registry.json         taramayla üretilen envanter (elle düzenlenmez)
skills/                 18 beceri: SKILL.md + references/ + scripts/
demo/                   canlı katalog (build-demo.py üretir), örnek deste, yerel sunucu betikleri
scripts/                CI bekçileri: registry, invariants, astro, syntax, imports, eksen ratchet'i
docs/media/             README görselleri (deterministik export karelerinden)
KATALOG.md              her varlığın yolu ve kullanım notu
```

## demo/

[`demo/index.html`](demo/index.html) — her preset'i canlı gömen, kategori
dizinli **canlı katalog** (G tuşu dizini açar; slayt sayısı envanterle
birlikte büyür). [`demo/ornek-deste.html`](demo/ornek-deste.html) —
preset'lerin birlikte çalıştığı 20 slaytlık örnek deste.
[`demo/sol-tek-basina.html`](demo/sol-tek-basina.html) — tek sahneyi
gömmenin asgari şablonu.

## Teknik notlar

- **Bağımlılık yok:** three.js `presets/moon_advanced/vendor/` altında
  gömülüdür; hiçbir CDN/font/ağ isteği yoktur, çevrimdışı çalışır.
- **Erişilebilirlik ve export:** tüm hareketli preset'ler
  `prefers-reduced-motion` altında son kareyi gösterir;
  `html[data-export="true"]` deterministik export karesi üretir; klavye
  gezinimi (`data-owns-arrows`/`data-owns-keys`) deste çalıştırıcılarıyla
  uyumludur. Her hareketli preset bir `motion-manifest.json` taşır
  (model, sınırlar, reduced-motion ve export durumu).
- **Determinizm:** sahneler tohumludur ve `advance(saniye)` API'siyle
  kare kare sürülebilir (test ve export için).
- **Ekran görüntüleri:** `docs/media/lab-*.jpg` dosyaları headless Chrome ile
  `?export=1` karesinden alınmıştır (`--headless=new --use-angle=swiftshader
  --screenshot`); sahneyi değiştiren bir değişiklik görselini de yeniler.

## Lisans ve atıf

- Kod ve tasarım: © Ayberk — tüm hakları saklıdır (izin için iletişime geçin).
- `presets/moon_advanced/vendor/` — [three.js](https://threejs.org) (MIT).
- `presets/planets_advanced/textures/` — [Solar System Scope](https://www.solarsystemscope.com/textures/) (CC BY 4.0; kullanımda atıf zorunludur, ayrıntı `asset-provenance.json` içinde).
- Dünya/Ay dokuları — NASA görüntüleri (three.js örnek deposu üzerinden).
- `presets/jwst_explorer/images/` — resmi James Webb / Hubble yayın görüntüleri, [esawebb.org](https://esawebb.org) ve [esahubble.org](https://esahubble.org) (CC BY 4.0; her görüntünün zorunlu kredi satırı `images/manifest.json` ve `images/LICENSE-NOTES.md` içinde — preset krediyi görüntü üstünde kalıcı gösterir, kaldırmayın).
- `presets/cosmos_advanced/textures/milkyway-eso0932a.jpg` — ESO GigaGalaxy Zoom 360° Samanyolu panoraması, **ESO/S. Brunier** (CC BY 4.0; fotoğrafik bandı kullanan her destede bu kredi görünür olmalıdır, ayrıntı `textures/CREDITS.md`).
- `presets/charts_icons/icon-library/` — [Lucide](https://lucide.dev) (ISC), [Tabler Icons](https://tabler.io/icons) (MIT), [Phosphor](https://phosphoricons.com) (MIT); lisans metinleri `icon-library/licenses/` altında.
- `presets/motion_core/primitives-motion.*` — [motion-primitives](https://github.com/ibelick/motion-primitives)'ten uyarlanmıştır (MIT, © ibelick).
