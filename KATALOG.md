# Sunum Kütüphanesi — Preset Kataloğu

> GitHub yayını: **https://github.com/ayberkdt/sunumatik** — preset'ler
> `presets/sun_advanced`, `presets/moon_advanced` gibi temiz adlarla, beceriler
> `skills/` altında, örnek deste `demo/` içinde (yollar o yapıya göre uyarlanmış
> ayrı bir kopyadır; buradaki çalışma ağacı değişmedi).
> GitHub'a bağlı yerel kopya: `Masaüstü\Custom Yetenekler\sunumatik`.

Bütün özellikler bu klasörün içinde, **`.agents\skills\`** altında saklanır
(adı nokta ile başladığı için gözden kaçabilir; Explorer'da görünür durumdadır).
Her beceri kendi klasöründe yaşar: `SKILL.md` (kullanım talimatı),
`references/` (kural ve rehberler), `assets/` (kopyalanabilir CSS/JS/SVG),
`scripts/` (doğrulayıcılar). Yeni bir sunum yaptırırken bu dosyaları ben
otomatik okurum; elle kullanmak istersen aşağıdaki yollar doğrudan bağlanabilir.

Önizlemeler için yerel sunucu gerekir: `preset-test\sunumu-baslat.cmd` çift
tıkla (port 8781) — örnek deste dahil her şey oradan açılır.

## Test destesi

| Ne | Yol |
|---|---|
| Tüm preset'leri kullanan **20 slaytlık** örnek deste (Kozmos · JWST Explorer · alan ikonları · veri animasyonları · Primitives dahil) | [preset-test/index.html](preset-test/index.html) → `http://localhost:8781/preset-test/index.html` |
| Sol'u kendi sayfana koymanın hazır şablonu (3 bağlantı: import map + CSS + mountSol) | [preset-test/sol-tek-basina.html](preset-test/sol-tek-basina.html) → `http://localhost:8781/preset-test/sol-tek-basina.html` |

## Renk temaları — `design-space-science-deck`

| Varlık | Yol |
|---|---|
| **17 palet**, CSS değişkenleri (`[data-palette="..."]`) — her palet renk-teorisi harmonisini bildirir; genişletilmiş olanlarda 6 veri rengi + sıralı/ıraksak rampalar + renk körlüğü notu | [palette-library.css](presets/color_themes/palette-library.css) |
| 2026 harmoni reçeteleri (tamamlayıcı/yarık-tamamlayıcı/analog/üçlü/tek renk) + premium disiplin kuralları | [color-composition.md](.agents/skills/design-space-science-deck/references/color-composition.md) |
| Palet verisi + kontrast kuralları | [palette-library.json](presets/color_themes/palette-library.json) |
| Palet önizleme (`?palette=graphite-ember` gibi) | [palette-preview.html](presets/color_themes/palette-preview.html) |
| 15 tema profili (Graphite Ember, Porcelain Ink, Obsidian Champagne, Verdigris Slate dahil) | `.agents/skills/design-space-science-deck/references/theme-*.md` |
| Tablo preset'leri (data/karşılaştırma/matris/spec) | [table-presets.css](presets/color_themes/components/table-presets.css) |
| **Kart preset'leri** — stat/tanım/ikon kartları, aksan çubuğu sistemi, `.kws` anahtar satırları, giriş kaskadı | [card-presets.css](presets/color_themes/components/card-presets.css) · [önizleme](presets/color_themes/components/component-preview.html) |
| **Hizalama disiplini** — 12 kolon grid, boşluk ölçeği, optik düzeltmeler, sık hata tablosu | [alignment-and-grid.md](.agents/skills/design-space-science-deck/references/alignment-and-grid.md) |
| Uzay motifleri SVG kiti (10 motif) + önizleme | [space-motifs/](presets/color_themes/space-motifs/motif-preview.html) |

## Sahne blokları — birleştirilebilir 3B sunum sistemi (`design-scientific-motion`)

> Manim ayarında, blok blok kurulabilir sahneler. Program ve donmuş API: [scene-blocks.md](.agents/skills/design-scientific-motion/references/scene-blocks.md)

| Kategori · Blok | Ne yapar |
|---|---|
| **ORBITAL** · [orbital-stage](presets/orbital_stage/index.html) | Yörünge ver → animasyon al: Kepler elemanları, durum vektörü dizisi (gerçek görev verisi) ya da RK4 + impulsif yakışlar; yakış hayaletleri, kamera yönetmeni, telemetri HUD. Demo: LEO→GEO Hohmann + Ay'a hiperbolik varış |
| **ORBITAL** · [craft-blocks](presets/craft_blocks/index.html) | Estetik parametrik araç kütüphanesi: orbiter, iniş aracı, 2 kademeli roket, CubeSat, kapsül — tüm bloklar bununla birleşir |
| **ORBITAL** · [lunar-descent](presets/lunar_descent/index.html) | Gerçek entegre üç fazlı Ay inişi: temas 0,90 m/s, ΔV 2,08 km/s; gaz kelebeği plums, toz, yüzey kamerası |
| **ML** · [ml-loss-landscape](presets/ml_loss_landscape/index.html) | Analitik kayıp yüzeyinde gerçek gradyanla SGD / momentum / Adam yarışı — SGD sığ tuzağa takılır |
| **ML** · [ml-attention-flow](presets/ml_attention_flow/index.html) | Gerçek softmax(QKᵀ/√d) dikkat yayları, Türkçe cümle, katman/kafa/sorgu değiştirme |

2\. dalga yol haritada: fırlatma-tırmanış, randevu-kenetlenme, yer izi 3B, porkchop, takımyıldız kapsama · embedding projektörü, konvolüsyon, çizge mesajlaşma.

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
| İkon kullanım denetimi — eksik `#i-` atfı (görünmez boş kutu) + katman karışımı | `node .agents/skills/create-scientific-visuals/scripts/validate-icon-usage.mjs preset-test/index.html` |
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
[sol-tek-basina.html](preset-test/sol-tek-basina.html) içinde çalışır halde
durur: import map + lunaris CSS + `mountSol(container)` — sayfayı taşırsan
sadece üç yolu güncelle. Şartlar: HTTP üzerinden sunulmalı (file:// olmaz)
ve `.agents\skills\...\assets\` ağacı olduğu gibi kalmalı (Sol, Lunaris'in
vendor ve CSS dosyalarını komşu klasörden kullanır).

En sağlam yol: bana "yeni sunum yap, şu paleti ve şu preset'leri kullan"
demek — bağlama işini `build-html-science-deck` becerisi kurallarına göre ben
yaparım. Örnek entegrasyonların tamamı [preset-test/index.html](preset-test/index.html)
içinde çalışır halde duruyor.
