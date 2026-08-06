# Sunumatik — Bilim Sunumu Preset Kütüphanesi

Bilimsel sunumlar için tasarlanmış, kendi kendine yeten HTML/CSS/JS preset
koleksiyonu: WebGL gök cismi sahneleri, hareket/geçiş presetleri, renk
temaları, grafik-ikon kiti ve bunları üreten yapay zekâ becerileri (skills).

Hızlı başlangıç: `demo\sunumu-baslat.cmd` çift tıkla — yerel sunucu açılır
ve tüm preset'leri kullanan örnek deste yüklenir
(`http://localhost:8781/demo/index.html`). Tarayıcılar `file://` altında ES
modüllerini engellediği için yerel sunucu şarttır.

## presets/ — kullanılabilir varlıklar

### WebGL sahneleri (three.js gömülü — internet gerekmez)

| Klasör | İçerik |
|---|---|
| [`sun_advanced/`](presets/sun_advanced) | Prosedürel aktif Güneş: diferansiyel dönme (flow-map'li), Joy yasalı benek çiftleri, patlama kurdeleleri, kademeli manyetik ilmek takımı, 240k parçacıklı akışkan püskürmeler, tutulma-anatomili korona. `sol-decor.mjs` ile herhangi bir 2B tuvale küçük "uzak Güneş" olarak da basılır. |
| [`moon_advanced/`](presets/moon_advanced) | Gerçek dokulu Ay + yörünge uçuşu (vanilla port). `vendor/` klasörü three.js'i barındırır — diğer sahneler de buradan import eder, **kardeş klasör yapısını bozmayın**. |
| [`earth_advanced/`](presets/earth_advanced) | Gerçekçi Dünya: gece ışıkları, fresnel atmosfer, 8 şehirlik tur. |
| [`planets_advanced/`](presets/planets_advanced) | Merkür→Neptün: gaz devlerinde canlı atmosferler (zıt kuşak rüzgârları, Büyük Kırmızı Leke, Satürn altıgeni + halka gölgeleri), Galile uyduları ve geçiş gölgeleri, NASA veri paneli. |
| [`moon_react_source/`](presets/moon_react_source) | Lunaris'in React/Next.js orijinali + doku ve yörünge verileri + ortak CSS (`components/moon_react_source.css`) — vanilla sahneler bu klasörün verilerini kullanır. |
| [`lunar_orbit/`](presets/lunar_orbit) | Ay yörünge modeli (mjs + React sarmalayıcı). |

Bir sayfaya gömme tarifi (çalışan örnek: [`demo/sol-tek-basina.html`](demo/sol-tek-basina.html)):

```html
<script type="importmap">{ "imports": { "three": "presets/moon_advanced/vendor/three.module.min.js" } }</script>
<link rel="stylesheet" href="presets/moon_react_source/components/moon_react_source.css">
<script type="module">
  import { mountSol } from './presets/sun_advanced/sol-sun.mjs';
  const sol = await mountSol(document.querySelector('#host'));
</script>
```

### Hareket ve bileşen presetleri

| Klasör | İçerik |
|---|---|
| [`motion_core/`](presets/motion_core) | Açılma/reveal, hover etkileşimleri, FLIP morph, premium slayt geçişleri (zoom-into dahil) + önizleme sayfaları. |
| [`timeline_tree/`](presets/timeline_tree) | Yatay/dikey kronoloji ağacı (dal rayları, dönem bantları). |
| [`equation_pen/`](presets/equation_pen) | Elle yazılan denklem (kalem ucu + gerçek çizgi takibi). |
| [`neural_network/`](presets/neural_network) | Sinir ağı hücreleri, ileri geçiş animasyonu. |
| [`color_themes/`](presets/color_themes) | 9 palet (CSS değişkenleri, `[data-palette]`), tablo presetleri, 10 uzay motifi SVG kiti. |
| [`charts_icons/`](presets/charts_icons) | Grafik teması (eksen/grid/6 seri/belirsizlik bandı) + 23 bilim ikonu sprite. |
| [`equation_theme/`](presets/equation_theme) | Denklem dizgi teması. |

## demo/ — örnek deste

Tüm preset'leri bir arada kullanan slayt destesi (`index.html`) ve Güneş'i
tek başına gömme şablonu (`sol-tek-basina.html`).

## skills/ — üretim talimatları

Bu preset'leri üreten/kullanan 16 yapay zekâ becerisi (SKILL.md +
references + scripts). Bir yapay zekâ ajanına (ör. Claude Code)
`.agents/skills/` altına kopyalanarak verilir; ajan yeni desteler kurarken
bu kuralları uygular. Beceri dokümanlarındaki `/presets/...` yolları bu
deponun köküne göredir (varlıklar beceri klasörlerinden çıkarılıp
`presets/` altında toplandı).

## Lisans ve atıf notları

- `presets/moon_advanced/vendor/` — [three.js](https://threejs.org) (MIT).
- `presets/planets_advanced/textures/` — [Solar System Scope](https://www.solarsystemscope.com/textures/) (CC BY 4.0): gezegen dokuları kullanılırken atıf zorunludur; ayrıntı `asset-provenance.json` içinde.
- `presets/earth_advanced/` ve `presets/moon_react_source/public/` dokuları — NASA görüntüleri (three.js örnek deposu üzerinden; kamu malı/serbest kullanım).
- Kalan tüm kod ve tasarım: bu deponun sahibine aittir.
