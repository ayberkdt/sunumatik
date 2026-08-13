# ML loss landscape preset

Files: `/presets/ml_loss_landscape/` — `ml-loss-landscape.mjs`
(analitik model + sahne), `ml-loss-landscape.css`, `index.html` (Türkçe demo),
`motion-manifest.json`.

3B kayıp yüzeyi üzerinde **gerçek optimizatör yarışı**: SGD, Momentum ve Adam
aynı başlangıç noktasından, gerçek gradyanla, adım adım canlı entegre edilir.
Önceden pişirilmiş yörünge yoktur. Truth level: **analytic** — yüzey bir test
fonksiyonudur (gerçek bir modelin kayıp yüzeyi değildir) ama güncelleme
kuralları ve gradyan gerçektir. Dürüstlük şeridi her modda görünür kalır.

## Yüzey (birebir formül — koddaki sabitlerle aynı)

```
G(x,y; cx,cy,σ) = exp(−((x−cx)² + (y−cy)²) / (2σ²))
v(x,y) = y − (0.28x² − 1.55)                      ← vadi merkez eğrisi

f(x,y) = 0.058(x² + y²)                            hafif çanak
       + 0.42·x·y·exp(−(x² + y²)/3.4)              nazik eyer (orijinde)
       − 0.85·G(x,y; −1.9,  1.7,  0.55)            kuyu K1 (kuzeybatı)
       − 0.75·G(x,y; −1.6, −1.8,  0.52)            kuyu K2 (güneybatı)
       − 0.65·G(x,y;  2.2,  1.8,  0.50)            kuyu K3 (kuzeydoğu)
       − 1.10·G(x,y;  1.85, −0.59, 0.45)           kuyu K4 — küresel minimum
       − 0.20·G(x,y; −0.35, −1.516, 0.20)          kuyu K5 — sığ tuzak (vadi girişi)
       − 0.78·exp(−v²/(2·0.20²))·exp(−(x−0.8)²/(2·1.55²))   dar vadi (ravine)
```

Tanım bölgesi [−3,3]². 129² ızgarada f ∈ [−1.675, 1.062]; küresel minimum
≈ (1.78, −0.66), L ≈ −1.675. K4 genişliği 0.45 görsel gerekçeyle seçildi:
daha dar kuyu (σ 0.33) 40°lik sinematik kameradan içi görünmeyen bir
yarık veriyordu; genişletme sonrası ayrışma yeniden doğrulandı. ∇f **kapalı formda** kodlanmıştır (`gradAt`);
sayısal türevle doğrulandı (en kötü fark 3.4e-9). Çalışma zamanında hiçbir
rastgelelik yoktur — bütün sabitler literal, restart birebir aynı yolları
oynatır.

## Optimizatörler (adım başına; 12 adım/sn, 360 adımda donar)

| | Kural | Hiperparametreler | Slot |
|---|---|---|---|
| SGD | `x ← x − η∇f` | η = 0.045 | `--color-data-1` |
| Momentum | `v ← βv − η∇f; x ← x + v` | β = 0.9, η = 0.012 | `--color-data-2` |
| Adam | standart bias-düzeltmeli m̂/√û | η = 0.09, β₁ = 0.9, β₂ = 0.999, ε = 1e-8 | `--color-data-3` |

**Başlangıç noktası (−1.05, −1.30)** — eyer havzasının vadiye bakan yamacı,
deneyle seçildi (saf eyer-kenarı adayları üç izi de aynı kuyuya götürüyordu).
Buradan üç kader gerçekten ayrışır:

- **SGD** vadi duvarlarında zikzaklar, ~63. adımda sığ tuzak kuyusuna (K5)
  yakalanır ve orada kalır → son kayıp **−0.601** (−0.24, −1.52).
- **Momentum** atalatiyle tuzağın üzerinden geçer, geniş salınımlarla
  ~87. adımda küresel minimuma varır → son kayıp **−1.675**.
- **Adam** normalize adımlarla sığ boyuna gradyanda bile hızla ilerler,
  vadiyi izleyip ~43. adımda küresel minimuma iner → son kayıp **−1.675**.

Tuzak kuyusu K5 bu ayrışma için kalibre edildi (derinlik 0.20, σ 0.20):
0.16'da SGD de kaçıyor, 0.30'da hikâye kabalaşıyor.

## Sahne bileşenleri

- **Yüzey**: 128² hücreli ağ, MeshStandard + köşe rengi yükseklik rampası
  (derin = canvas koyusu, yüksek = ılık nötr `--color-muted`; gökkuşağı yok),
  üstünde 0.05 opaklıkta ince tel kafes.
- **Konturlar**: 8 GERÇEK iso-çizgi (marching squares, seviyeler −1.5 … 0.7),
  yüzeyin altında y = −1.30 düzlemine düz projeksiyon.
- **Toplar**: yüzeyin ÜZERİNDE yuvarlanır (y = f·ölçek + r); görünen konum
  sim konumuna üstel süzgeçle yaklaşır (adım atlaması gözükmez, C0).
- **İzler**: önceden ayrılmış kurdele tamponu (görünür geometri asla yeniden
  kurulmaz, genişletme kameraya dönük olarak vertex shader'da yapılır);
  yaşla solar ama taban 0.45 — tüm yol okunur kalır. Export/reduced
  modda solma kapatılır (iz tam çizili).
- **Işık**: tek anahtar ışık + sönük dolgu. Bloom yok, glow yok.
- **Kamera turu**: 100 sn/devir yavaş orbit (varsayılan açık) — dar vadinin
  derinliğini okutur; sürükleme turu duraksatır, bırakınca kaldığı açıdan sürer.

## API

```js
import { mountLossLandscape, lossAt, gradAt, START } from './ml-loss-landscape.mjs';

const lls = mountLossLandscape(host, { active: true, seed: 1 });
// seed kabul edilir ama sahne tamamen deterministiktir — şu an etkisizdir.
lls.play(); lls.pause(); lls.restart();      // restart = birebir aynı yollar
lls.toggle('sgd');                            // optimizatör göster/gizle
lls.setTrails(false); lls.setOrbit(false);
lls.advance(dt);                              // dışarıdan deterministik sürüş
lls.seek(120);                                // n adımı senkron koş (?step=N bunu çağırır)
lls.topView();                                // tepeden kontur görünümü (?view=top)
lls.renderNow();                              // gizli pencere/denetim senkron çizimi
lls.state;                                    // {step, sgd, momentum, adam, losses…}
lls.setActive(false); lls.dispose();
```

Demo sayfası `?step=N` ile deterministik sıçrar (sim duraklatılır, kamera
sabitlenir) ve `?view=top` ile tepeden bakar; `window.__lossLandscape` denetim
kancası. Kilit kareler: adım 0 (başlangıç), ~60 (SGD tuzağa yaklaşırken Adam
vadide), 360 (yakınsamış).

## Entegrasyon kuralları

- Palet tokenları mount anında CSS'ten okunur (`--color-data-1/2/3`,
  `--color-canvas/-muted/-rule`); slot renklerini slayt başına değiştirme.
- Import map şart: `{ "three": "../moon_advanced/vendor/three.module.min.js" }`
  (three.core.min.js yanında olmalı — bölünmüş min build).
- Kap mount'tan ÖNCE boyutlandırılmalı (gizli sekmeler ResizeObserver
  teslim etmez); `offsetWidth/Height` kullanılır.
- Reduced-motion/export: `seek(360)` donuk karesi — izler tam, kamera sabit,
  kontroller gizli (`data-export-hide`).
- Manifest her düzenlemeden sonra `scripts/validate-motion-manifest.mjs` ile
  doğrulanır.
- Hiperparametreler hikâyenin parçasıdır: η'ları değiştirirsen ayrışma bozulur
  — değiştirmeden önce bu dosyanın deney bölümünü yeniden üret.
