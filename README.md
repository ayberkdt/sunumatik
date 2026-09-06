# Sunumatik

**Bilim sunumları için preset kütüphanesi** — gerçek fizikten türetilmiş WebGL gök cismi sahneleri, sayısal akışkan/yörünge/ML simülasyonları, bildirimsel grafik motoru, hareket/geçiş presetleri, renk temaları ve bunları üreten 18 yapay zekâ becerisi. Tamamı bağımsız HTML/CSS/JS: derleme adımı yok, internet bağımlılığı yok, `file://` dışında her yerel sunucuda çalışır.

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

Bir sayfaya gömme (çalışan şablon: [`demo/sol-tek-basina.html`](demo/sol-tek-basina.html)):

```html
<script type="importmap">{ "imports": { "three": "presets/moon_advanced/vendor/three.module.min.js" } }</script>
<link rel="stylesheet" href="presets/moon_react_source/components/moon_react_source.css">
<script type="module">
  import { mountSol } from './presets/sun_advanced/sol-sun.mjs';
  const sol = await mountSol(document.querySelector('#host'));
  // sol.triggerFlare() · sol.advance(sn) · 2B tuvale gömmek için: sol-decor.mjs
</script>
```

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

Her biri saf bir model modülü (`*-model.mjs` ya da `presets/core/astro-*.mjs`), sahne, deterministik URL (`?t=` / `export=1`), `motion-manifest.json` ve `skills/design-scientific-motion/references/<ad>.md` ile gelir; hepsi `node scripts/validate-astro.mjs` ile bağımsız sayısal denetimden geçer (CI adımı). Hiçbir sayı elle yerleştirilmez; model, varsayım ve sınırlar sahnede yazılıdır.

| Klasör | İçerik |
|---|---|
| [`launch_ascent/`](presets/launch_ascent) | **Fırlatma ve tırmanış**: 2B tırmanış (RK4, US76 atmosfer, yerçekimi dönüşü + kapalı-çevrim 2. kademe güdümü), olay rayı (max-q türetilir, MECO/ayrılma/SECO), kayıplar; craft_blocks roket + motor efekti |
| [`rendezvous_docking/`](presets/rendezvous_docking) | **Randevu ve kenetlenme**: Clohessy–Wiltshire STM ile V-bar/R-bar/itme yaklaşmaları, KOS küresi, yaklaşma koridoru, LOS metrikleri; LVLH sahnesi |
| [`ground_track_3d/`](presets/ground_track_3d) | **3B yörünge + yer izi**: Kepler + J2 seküler oranlar, ECI→ECEF, düğüm kayması; 3B küre ve eşdikdörtgen harita eşzamanlı |
| [`porkchop_explorer/`](presets/porkchop_explorer) | **Porkchop kâşifi**: Evrensel-değişken Lambert + Standish gezegen elemanları; C3 / v∞ / ΔV ısı haritası, TOF eş-çizgileri, minimum, güneş-merkezli yan panel |
| [`constellation_coverage/`](presets/constellation_coverage) | **Takımyıldız kapsama**: Walker Delta/Star, ayak izi λ = acos(R/(R+h)cos ε) − ε, kapsama boyama, yeniden ziyaret taraması; GPS/Galileo/Iridium/LEO kabuk/GEO |
| [`reentry_corridor/`](presets/reentry_corridor) | **Giriş koridoru**: Düzlemsel giriş dinamiği + Sutton–Graves ısı akısı; koridor aşma/altında kalma sınırları bisection ile (Ay dönüşü ≈ Apollo), eş-g ve eş-ısı eğrileri |
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
| [`soi_explorer/`](presets/soi_explorer) | **Etki küresi kâşifi**: Laplace r_SOI = a(m/M)^(2/5) ve Hill küresi gerçek ölçekte (three.js, dokulu Dünya/Ay, fresnel kabuklar), park yörüngesinden v∞ hedefli kalkış hiperbolü, SOI kabuğunda Dünya → Güneş çerçevesi el değiştirmesi, yamalı-konik artığı, Laplace oran paneli, gezegen SOI ölçeği |

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
  GLSL güvenliği, ışık disiplini, prosedürel dağılımlar), hizalama/grid
  disiplini, nötr renk disiplini, dekor katmanlama.
- **Uçtan uca akış** — orkestratör + anlatı + kanıt doğrulama + tema +
  denklem + görselleştirme + kurulum + denetim/export becerileri.

Beceri dokümanlarındaki `/presets/...` yolları bu deponun köküne göredir.

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

## Lisans ve atıf

- Kod ve tasarım: © Ayberk — tüm hakları saklıdır (izin için iletişime geçin).
- `presets/moon_advanced/vendor/` — [three.js](https://threejs.org) (MIT).
- `presets/planets_advanced/textures/` — [Solar System Scope](https://www.solarsystemscope.com/textures/) (CC BY 4.0; kullanımda atıf zorunludur, ayrıntı `asset-provenance.json` içinde).
- Dünya/Ay dokuları — NASA görüntüleri (three.js örnek deposu üzerinden).
- `presets/jwst_explorer/images/` — resmi James Webb / Hubble yayın görüntüleri, [esawebb.org](https://esawebb.org) ve [esahubble.org](https://esahubble.org) (CC BY 4.0; her görüntünün zorunlu kredi satırı `images/manifest.json` ve `images/LICENSE-NOTES.md` içinde — preset krediyi görüntü üstünde kalıcı gösterir, kaldırmayın).
- `presets/cosmos_advanced/textures/milkyway-eso0932a.jpg` — ESO GigaGalaxy Zoom 360° Samanyolu panoraması, **ESO/S. Brunier** (CC BY 4.0; fotoğrafik bandı kullanan her destede bu kredi görünür olmalıdır, ayrıntı `textures/CREDITS.md`).
- `presets/charts_icons/icon-library/` — [Lucide](https://lucide.dev) (ISC), [Tabler Icons](https://tabler.io/icons) (MIT), [Phosphor](https://phosphoricons.com) (MIT); lisans metinleri `icon-library/licenses/` altında.
- `presets/motion_core/primitives-motion.*` — [motion-primitives](https://github.com/ibelick/motion-primitives)'ten uyarlanmıştır (MIT, © ibelick).
