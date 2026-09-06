# Sunum Kütüphanesi — Preset Kataloğu

> Depo: **https://github.com/ayberkdt/sunumatik** — preset'ler `presets/`,
> beceriler `skills/`, örnek desteler `demo/` altında. Bu katalogdaki bütün
> yollar deponun köküne göredir. Envanter sayıları elle yazılmaz:
> `presets/registry.json` taramayla üretilir ve
> `scripts/validate-invariants.mjs` katalogdaki sayı/yol iddialarını ona
> karşı denetler.

Beceriler `skills/` altında saklanır. Her beceri kendi klasöründe yaşar:
`SKILL.md` (kullanım talimatı), `references/` (kural ve rehberler),
`assets/` (kopyalanabilir CSS/JS/SVG), `scripts/` (doğrulayıcılar).
Bir yapay zekâ ajanına vermek için klasörler ajanın beceri dizinine
kopyalanır (dizin adı ajana göre değişir); ajan deste kurarken bu
kuralları uygular.

Önizlemeler için yerel sunucu gerekir: `demo\sunumu-baslat.cmd` çift
tıkla (port 8790; doluysa 8795/8798'e kayar — tarayıcıda AÇILAN adresi
kullanın) — örnek deste dahil her şey oradan açılır.

## Desteler

| Ne | Yol |
|---|---|
| **Canlı katalog** — her preset'i canlı gömen gezilebilir deste (G ile dizin; slayt sayısı envanterle birlikte büyür, `build-demo.py` üretir) | [demo/index.html](demo/index.html) → `http://localhost:8790/demo/index.html` |
| Preset'lerin birlikte çalıştığı **20 slaytlık** örnek deste (Kozmos · JWST Explorer · alan ikonları · veri animasyonları · Primitives dahil) | [demo/ornek-deste.html](demo/ornek-deste.html) → `http://localhost:8790/demo/ornek-deste.html` |
| Sol'u kendi sayfana koymanın hazır şablonu (3 bağlantı: import map + CSS + mountSol) | [demo/sol-tek-basina.html](demo/sol-tek-basina.html) → `http://localhost:8790/demo/sol-tek-basina.html` |
| **Sinematik uzay yolculuğu** — dış uzay → kanopi → güverte → bölüm konsolu; `demo\sinematik-baslat.cmd` çift tıklamayla doğrudan açılır | [presets/cinematic_space/index.html](presets/cinematic_space/index.html) → `http://localhost:8790/presets/cinematic_space/index.html` |

## Renk temaları — `design-space-science-deck`

| Varlık | Yol |
|---|---|
| **37 palet**, CSS değişkenleri (`[data-palette="..."]`) — her palet renk-teorisi harmonisini bildirir; genişletilmiş olanlarda 6 veri rengi + sıralı/ıraksak rampalar + renk körlüğü notu | [palette-library.css](presets/color_themes/palette-library.css) |
| 2026 harmoni reçeteleri (tamamlayıcı/yarık-tamamlayıcı/analog/üçlü/tek renk) + premium disiplin kuralları | [color-composition.md](skills/design-space-science-deck/references/color-composition.md) |
| Palet verisi + kontrast kuralları | [palette-library.json](presets/color_themes/palette-library.json) |
| Palet önizleme (`?palette=graphite-ember` gibi) | [palette-preview.html](presets/color_themes/palette-preview.html) |
| 15 tema profili (Graphite Ember, Porcelain Ink, Obsidian Champagne, Verdigris Slate dahil) | `skills/design-space-science-deck/references/theme-*.md` |
| Tablo preset'leri (data/karşılaştırma/matris/spec) | [table-presets.css](presets/color_themes/components/table-presets.css) |
| **Kart preset'leri** — stat/tanım/ikon kartları, aksan çubuğu sistemi, `.kws` anahtar satırları, giriş kaskadı | [card-presets.css](presets/color_themes/components/card-presets.css) · [önizleme](presets/color_themes/components/component-preview.html) |
| **Hizalama disiplini** — 12 kolon grid, boşluk ölçeği, optik düzeltmeler, sık hata tablosu | [alignment-and-grid.md](skills/design-space-science-deck/references/alignment-and-grid.md) |
| Uzay motifleri SVG kiti (10 motif) + önizleme | [space-motifs/](presets/color_themes/space-motifs/motif-preview.html) |

## Sahne blokları — birleştirilebilir 3B sunum sistemi (`design-scientific-motion`)

> Manim ayarında, blok blok kurulabilir sahneler. Program ve donmuş API: [scene-blocks.md](skills/design-scientific-motion/references/scene-blocks.md)

| Kategori · Blok | Ne yapar |
|---|---|
| **SİNEMATİK** · [cinematic-space](presets/cinematic_space/index.html) | Uzamsal yolculuk kabuğu: dış uzay → kanopi eşiği → gözlem güvertesi → bölüm konsolu → orbital teslimi / gezgin dalışı. Cosmos + Lunaris Ay'ı + craft-blocks kompozisyonu; deterministik ray, `goTo/back` API'si |
| **ORBITAL** · [orbital-stage](presets/orbital_stage/index.html) | Yörünge ver → animasyon al: Kepler elemanları, durum vektörü dizisi (gerçek görev verisi) ya da RK4 + impulsif yakışlar; yakış hayaletleri, kamera yönetmeni, telemetri HUD. Demo: LEO→GEO Hohmann + Ay'a hiperbolik varış |
| **ORBITAL** · [craft-blocks](presets/craft_blocks/index.html) | Estetik parametrik araç kütüphanesi: orbiter, iniş aracı, 2 kademeli roket, CubeSat, kapsül — tüm bloklar bununla birleşir |
| **ORBITAL** · [lunar-descent](presets/lunar_descent/index.html) | Gerçek entegre üç fazlı Ay inişi: temas 0,90 m/s, ΔV 2,08 km/s; gaz kelebeği plums, toz, yüzey kamerası |
| **ML** · [ml-loss-landscape](presets/ml_loss_landscape/index.html) | Analitik kayıp yüzeyinde gerçek gradyanla SGD / momentum / Adam yarışı — SGD sığ tuzağa takılır |
| **ML** · [ml-attention-flow](presets/ml_attention_flow/index.html) | Gerçek softmax(QKᵀ/√d) dikkat yayları, Türkçe cümle, katman/kafa/sorgu değiştirme |

2\. dalga — astrodinamik ve GNC laboratuvarları (hepsi `scripts/validate-astro.mjs` ile denetlenir):

| Kategori · Blok | Ne yapar |
|---|---|
| **ORBITAL** · [launch-ascent](presets/launch_ascent/index.html) | Fırlatma ve tırmanış: 2B tırmanış (RK4, US76 atmosfer, yerçekimi dönüşü + kapalı-çevrim 2. kademe güdümü), olay rayı (max-q türetilir, MECO/ayrılma/SECO), kayıplar; craft_blocks roket + motor efekti |
| **ORBITAL** · [rendezvous-docking](presets/rendezvous_docking/index.html) | Randevu ve kenetlenme: Clohessy–Wiltshire STM ile V-bar/R-bar/itme yaklaşmaları, KOS küresi, yaklaşma koridoru, LOS metrikleri; LVLH sahnesi |
| **ORBITAL** · [ground-track-3d](presets/ground_track_3d/index.html) | 3B yörünge + yer izi: Kepler + J2 seküler oranlar, ECI→ECEF, düğüm kayması; 3B küre ve eşdikdörtgen harita eşzamanlı |
| **ORBITAL** · [porkchop-explorer](presets/porkchop_explorer/index.html) | Porkchop kâşifi: Evrensel-değişken Lambert + Standish gezegen elemanları; C3 / v∞ / ΔV ısı haritası, TOF eş-çizgileri, minimum, güneş-merkezli yan panel |
| **ORBITAL** · [constellation-coverage](presets/constellation_coverage/index.html) | Takımyıldız kapsama: Walker Delta/Star, ayak izi λ = acos(R/(R+h)cos ε) − ε, kapsama boyama, yeniden ziyaret taraması; GPS/Galileo/Iridium/LEO kabuk/GEO |
| **ORBITAL** · [reentry-corridor](presets/reentry_corridor/index.html) | Giriş koridoru: Düzlemsel giriş dinamiği + Sutton–Graves ısı akısı; koridor aşma/altında kalma sınırları bisection ile (Ay dönüşü ≈ Apollo), eş-g ve eş-ısı eğrileri |
| **ORBITAL** · [formation-flight](presets/formation_flight/index.html) | Formasyon uçuşu: CW göreli yörüngeler: PCO / GCO / düzlem-içi 2:1 elips / lider–takipçi; 3B + üç izdüşüm, ayrılma istatistikleri |
| **ORBITAL** · [cr3bp-lagrange](presets/cr3bp_lagrange/index.html) | CR3BP ve Lagrange noktaları: ∇Ω = 0 ile çözülen L1–L5, Jacobi sabiti, sıfır-hız eğrileri ve yasak bölgeler, Lyapunov aileleri (diferansiyel düzeltme + süreklilik), dönen ↔ eylemsiz |
| **ORBITAL** · [gravity-assist](presets/gravity_assist/index.html) | Kütleçekim yardımı ve B-düzlemi: Yamalı-konik geçiş: hiperbol, sapma açısı, B-düzlemi hedefleme, güneş-merkezli enerji değişimi, Tisserand |
| **ORBITAL** · [attitude-gnc](presets/attitude_gnc/index.html) | Yönelim ve GNC: Euler denklemleri + tepki tekerlekleri + kuaterniyon PD; dönüş, yuvarlanma, doyma, gimbal kilidi, slerp senaryoları |
| **ORBITAL** · [orbit-perturbations](presets/orbit_perturbations/index.html) | Yörünge pertürbasyonları: RK4 ile J2, sürükleme (Vallado termosfer), SRP, üçüncü cisim; eleman zaman serileri, analitik seküler oranlarla karşılaştırma |
| **ORBITAL** · [eclipse-geometry](presets/eclipse_geometry/index.html) | Tutulma ve görüş geometrisi: Sonlu Güneş diskli konik gölge (umbra/penumbra), β açısı, istasyon yükselme, örtülme; bantlar ve eğriler |
| **ORBITAL** · [conjunction-covariance](presets/conjunction_covariance/index.html) | Yakın geçiş ve kovaryans: TCA (altın oran), karşılaşma düzlemi kovaryansı, 2B çarpışma olasılığı integrali, seyrelme eğrisi, eşik kararı |
| **ORBITAL** · [gravity-field](presets/gravity_field/index.html) | Küresel harmonik yerçekimi alanı: Tam normalize Legendre (kararlı özyineleme), jeoit (Bruns, GRS80 çıkarılmış) ve serbest-hava anomalisi; düşük derece gerçek (EGM96), üstü açıkça SENTETİK; C̄20 düğüm kayması çapraz denetimi |
| **ORBITAL** · [transfer-explorer](presets/transfer_explorer/index.html) | Lambert transfer kâşifi: r1, r2, Δθ, TOF → transfer yayı, v1/v2, ΔV; kısa/uzun yol; TOF taraması ve Hohmann limiti (Δθ → 180° eşleşmesi denetimde) |
| **ORBITAL** · [halo-manifolds](presets/halo_manifolds/index.html) | Halo yörüngeleri ve değişmez manifoldlar: Richardson 3. mertebe + 6×6 STM düzeltmesi, Az sürekliliği; monodromi özvektörlerinden kararlı/kararsız manifold demetleri; kararlı demetten Dünya'ya transfer analizi; 3B dönen çerçeve |
| **ORBITAL** · [orbit-determination](presets/orbit_determination/index.html) | Yörünge belirleme (EKF): Yer istasyonu menzil/menzil-hızı ölçümleri, genişletilmiş Kalman filtresi (sonlu-fark STM, analitik H, Joseph), NEES/NIS tutarlılığı; gözlenebilirlik ve model hatası senaryoları |
| **ORBITAL** · [low-thrust-transfer](presets/low_thrust_transfer/index.html) | Düşük itkili transfer: Sürekli teğetsel itki spirali (değişken kütle RK4), Edelbaum analitik ΔV (eğiklik dahil), Hohmann ve Tsiolkovsky karşılaştırması, gölge görev çevrimi |
| **ORBITAL** · [tisserand-graph](presets/tisserand_graph/index.html) | Tisserand grafiği: Gezegen sabit-v∞ eğrileri, δ_max ile erişilebilir yaylar, Dünya rezonansları, açgözlü çoklu geçiş dizisi planlayıcı (VEEGA…); fazlama yok |
| **ORBITAL** · [entry-dispersion](presets/entry_dispersion/index.html) | Giriş dağılımı (Monte Carlo): reentry_corridor çekirdeği üstünde tohumlu sapmalar → menzil histogramı, 3σ, duyarlılık payları, doğrusal RSS ↔ Monte Carlo oranı |
| **ORBITAL** · [geo-stationkeeping](presets/geo_stationkeeping/index.html) | GEO istasyon tutma bütçesi: doğu–batı sürüklenme gerçek C̄22/S̄22'den, kuzey–güney Ay+Güneş 1 yıllık RK4, SRP eksantriklik, ömür yakıtı kimyasal vs elektrikli |
| **ORBITAL** · [launch-window](presets/launch_window/index.html) | Fırlatma penceresi ve azimut: küresel trigonometri, Dünya dönmesi düzeltmesi, günde iki fırsat, gecikme → düzlem değişimi ΔV → pencere |

ML yol haritası: embedding projektörü, konvolüsyon, çizge mesajlaşma.

## Hareket ve etkileşim — `design-scientific-motion`

| Varlık | Yol |
|---|---|
| Temel açılmalar: reveal/rise/wipe/focus, `revealStage` (kademeli), `observeReveal`, `tracePath`, `animateCount` | [core-motion.css](presets/motion_core/core-motion.css) + [.js](presets/motion_core/core-motion.js) — sayfa `<head>`'inde `document.documentElement.classList.add('js')` şart |
| Hover preset'leri: lift, underline, annotate, grup soluklaştırma, lejant↔grafik bağlantısı | [interaction-motion.css](presets/motion_core/interaction-motion.css) + [.js](presets/motion_core/interaction-motion.js) |
| **Primitives mikro-hareket** (motion-primitives uyarlaması, MIT) — ışıltı süpürmesi, kademeli fade-in-blur metin, telemetri çözülmesi, başlık morfu, yaylı sayı + kilometre sayacı, spot, eğim, mıknatıs, kenar kuyruğu, parıltı, sonsuz şerit, kademeli bulanıklık | [primitives-motion.css](presets/motion_core/primitives-motion.css) + [.js](presets/motion_core/primitives-motion.js) · demo: [primitives-preview.html](presets/motion_core/primitives-preview.html) |
| **JWST Explorer** — 10 resmi Webb görüntüsü (CC BY 4.0, krediler gömülü) üstünde yaylı kaydırma/yakınlaşma, kaynak açıklamalarından Türkçe ilgi noktaları, Webb↔Hubble / NIRCam↔MIRI tek-kameralı karşılaştırma perdesi | [jwst_explorer/](presets/jwst_explorer/index.html) |
| **Kozmos fonu (three.js)** — tohumlu prosedürel yıldız alanı (gerçekçi kadir dağılımı, kara-cisim renkleri) + **fotoğrafik Samanyolu: gerçek ESO GigaGalaxy 360° panoraması** (ESO/S. Brunier, CC BY 4.0 — kredi zorunlu; prosedürel bant yedek), opsiyonel bulutsu, deterministik meteorlar, dekor modülüyle gömülebilir | [cosmos_advanced/](presets/cosmos_advanced/index.html) |
| **Tablo hareketi** — satır kaskadı, sunucu güdümlü satır flaşı, başlıkta sütun vurgusu | [table-motion.css](presets/motion_core/table-motion.css) + [.js](presets/motion_core/table-motion.js) |
| Morph: FLIP `morphState`, View Transitions `viewMorph` | [morph-transition.css](presets/motion_core/morph-transition.css) + [.js](presets/motion_core/morph-transition.js) |
| Slayt geçişleri: fade-through, push, wipe-mask, **zoom-into (işaret bırakan)**, morph | [slide-transitions.css](presets/motion_core/slide-transitions.css) + [.js](presets/motion_core/slide-transitions.js) · demo: [slide-transition-preview.html](presets/motion_core/slide-transition-preview.html) |
| Hover+morph+stagger demo sayfası | [interaction-preview.html](presets/motion_core/interaction-preview.html) |
| Kronoloji ağacı (yatay/dikey, dal rayları, dönem bantları) | [timeline_tree/](presets/timeline_tree/index.html) |
| **Figür işaretleme** — görsel üzerinde adım adım kutu/ok/büyüteç + spot ışığı + iddia satırı | [figure_callouts/](presets/figure_callouts/index.html) |
| **Denklem adımlayıcı** — dizili denklemi terim terim anlatır (vurgu + hayalet + iddia satırı) | [equation_steps/](presets/equation_steps/index.html) |
| Elle yazılan denklem (kalem + gerçek çizgi takibi) | [equation_pen/](presets/equation_pen/index.html) |
| Sinir ağı hücreleri (ileri geçiş animasyonu) | [neural_network/](presets/neural_network/index.html) |
| **Lunaris** — WebGL Ay uçuşu (React'siz sürüm; three vendor'lı) | [moon_advanced/](presets/moon_advanced/index.html) |
| **Terra** — gerçekçi Dünya + şehir turu + gece ışıkları + fresnel atmosfer | [earth_advanced/](presets/earth_advanced/index.html) |
| **Sol** — prosedürel Güneş: granülasyon, gerçek kenar kararması, korona | [sun_advanced/](presets/sun_advanced/index.html) |
| **Sol dekor** — aynı Güneş'i herhangi bir 2B tuvale küçük "uzak yıldız" olarak basar (`mountSolDecor` → `decor.draw(ctx,x,y,r,a)`); canlı örnek: Harmonikler destesi | [sol-decor.mjs](presets/sun_advanced/sol-decor.mjs) |
| **Planetae** — Merkür→Neptün: gezegen değiştirici, gerçek eğiklikler, NASA veri paneli; gaz devlerinde canlı atmosferler (zıt kuşak rüzgârları, Büyük Kırmızı Leke, Satürn altıgeni + halka gölgeleri, Neptün karanlık lekesi), Galile uyduları + Titan ve geçiş gölgeleri | [planets_advanced/](presets/planets_advanced/index.html) |
| Lunaris React orijinali (Next.js örneği + dokular) | `presets/moon_react_source/` |

## Grafik ve görseller — `create-scientific-visuals`

| Varlık | Yol |
|---|---|
| Grafik teması: eksen/grid/6 seri rengi/belirsizlik bandı/tooltip | [chart-theme.css](presets/charts_icons/chart-theme.css) |
| **Grafik motoru** — spec ver, animasyonlu SVG grafik al (çizgi/sütun/saçılım + bant + eşik + fit stilleri) | [chart-preset/](presets/charts_icons/chart-preset/index.html) |
| 23 bilim ikonu (SVG sprite) + önizleme | [icons/](presets/charts_icons/icons/icons-preview.html) |
| İkon kullanım denetimi — eksik `#i-` atfı (görünmez boş kutu) + katman karışımı | `node skills/create-scientific-visuals/scripts/validate-icon-usage.mjs demo/index.html` |
| **224 ikonluk ALAN seti** (duotone, bilim setiyle aynı el) — matematik 28 · sinyal & kontrol 30 · fizik 24 · **astrodinamik 30** · **GNC 26** · **itki 26** · roket & uydu 30 · ML 18 · gökcisimleri 12; aile çipli canlı filtreli önizleme, TR+EN manifest. Bilimsel iddia taşır: odakta birincil cisim, kapanmayan hiperbol, gerçek nav-ball prograde/retrograde işaretçileri | [domain-icons/](presets/charts_icons/domain-icons/preview.html) |
| **168 ikonluk yardımcı kütüphane** (Lucide/Tabler/Phosphor; ISC/MIT) — oklar, grafikler, durum, zaman, uzay/bilim; TR+EN aranabilir manifest, sprite, canlı filtreli önizleme, lisans metinleri | [icon-library/](presets/charts_icons/icon-library/preview.html) |

## Denklemler — `typeset-tex-equations`

| Varlık | Yol |
|---|---|
| Denklem teması CSS | [equation-theme.css](presets/equation_theme/equation-theme.css) |

## Hızlı kullanım

Bir HTML desteye preset bağlamak:

```html
<script>document.documentElement.classList.add('js');</script>
<link rel="stylesheet" href="presets/color_themes/palette-library.css">
<link rel="stylesheet" href="presets/motion_core/core-motion.css">
<body data-palette="graphite-ember">
```

WebGL preset'leri (Lunaris/Terra/Sol/Planetae) için ek olarak modül
scriptlerinden önce import map gerekir:

```html
<script type="importmap">{ "imports": { "three": "presets/moon_advanced/vendor/three.module.min.js" } }</script>
```

Sol'un herhangi bir sayfada tam tarifi
[sol-tek-basina.html](demo/sol-tek-basina.html) içinde çalışır halde
durur: import map + lunaris CSS + `mountSol(container)` — sayfayı taşırsan
sadece üç yolu güncelle. Şartlar: HTTP üzerinden sunulmalı (file:// olmaz)
ve `presets/` altındaki kardeş klasör yapısı olduğu gibi kalmalı (Sol,
three.js'i `presets/moon_advanced/vendor/` içinden, ortak CSS'i
`presets/moon_react_source/` içinden kullanır).

En sağlam yol: bana "yeni sunum yap, şu paleti ve şu preset'leri kullan"
demek — bağlama işini `build-html-science-deck` becerisi kurallarına göre ben
yaparım. Örnek entegrasyonların tamamı [demo/index.html](demo/index.html)
içinde çalışır halde duruyor.
