# Launch Ascent — Fırlatma ve Tırmanış (`/presets/launch_ascent/`)

scene-blocks programının "wave 2" ORBITAL bloğu: rampadan dairesel yörüngeye
GERÇEK entegre tırmanış. Yerçekimi dönüşü, US76 atmosferi, hesaplanan Max-Q,
kademe ayrılması, kapak atma, kapalı-döngü 2. kademe, SECO. Sahnedeki hiçbir
sayı elle yazılmaz: olay rayı ve q(t) grafiği simülasyondan üretilir.
`craft_blocks` (buildRocket + buildEngineFX) ile birleşir; `webgl-scene-contract.md`
istisnasız geçerlidir.

Demo: `/presets/launch_ascent/index.html`. Manifest: `motion-manifest.json` (4 motion).
Bağımsız sayısal denetim: `node scripts/validate-astro.mjs`.

## Gerçek model (kısa) — ayrıntı `ascent-model.mjs` başlığında

| Parça | Model |
|---|---|
| Çerçeve | 2B Dünya-merkezli eylemsiz düzlem, nokta-kütle, μ/r² |
| Atmosfer | US76 (`presets/core/astro-atmosphere.mjs`), Dünya ile döner (v_hava = v − ω_e r cos φ) |
| Sürükleme | ½ρv²·C_D(M)·A, C_D(M) transonik tepeli parçalı-doğrusal |
| İtki | ṁ g₀ Isp(p), Isp basınçla doğrusal düşer |
| Kılavuz | dikey → pitch kick → yerçekimi dönüşü (α = 0) → 2. kademede irtifa-hız geri beslemeli pitch (PEG değil) |
| Entegrasyon | RK4 0,05 s; kayıplar (yerçekimi/sürükleme/yönlendirme) entegre |
| Varsayılan araç | iki kademeli orta sınıf, Falcon 9 sınıfı yuvarlatılmış kamu değerleri — illüstratif |

Varsayılan sonuç: Max-Q **36,4 kPa @ T+64 s, 11,0 km, M 1,52**; MECO T+153 s;
SECO T+518 s → 187 × 213 km. Yörüngeye ulaşılamazsa sahne bunu söyler
(`sim.ok === false`, "yörünge YOK" olayı) — uydurmaz.

## Mount

```js
import { mountLaunchAscent } from './launch-ascent.mjs';
const asc = await mountLaunchAscent(host, {
  vehicle: { payload: 15000 },            // simulateAscent'in araç girdisi (kısmi olabilir)
  profile: { targetAlt: 200e3, pitchKick: 3.2, latitude: 28.5 },
  seed: 7, warp: 2, autoplay: true, camera: 'auto',   // auto|pad|chase|wide|free
});
asc.sim.maxQ / asc.sim.events / asc.sim.losses / asc.sim.orbit
asc.timeline.play() .pause() .scrub(t) .setWarp(4) .t .duration
asc.camera.transitionTo('wide', { duration: 1400 })
asc.setScenario({ payload: 18000 }, { targetAlt: 300e3 })   // yeniden simüle eder
asc.advance(dt) · asc.setActive(false) · asc.hud(false) · asc.dispose()
```

Import map: `"three": "../moon_advanced/vendor/three.module.min.js"`. Kap
MOUNT'TAN ÖNCE boyutlandırılmış olmalı. Çıplak geometri kurucusu yoktur
(rampa kulesi `cylZ` ile).

Saf çözücü ayrı kullanılabilir (THREE'siz, Node'da çalışır):

```js
import { simulateAscent, sampleAt } from './ascent-model.mjs';
const sim = simulateAscent({ payload: 12000 }, { targetAlt: 250e3 });
sim.maxQ.q, sim.events.find(e => e.id === 'meco').t, sampleAt(sim, 120).alt
```

## Ölçek ve dürüstlük

1 sahne birimi = 100 km. Araç boyu görünürlük için abartılır (irtifayla
4 → 12 km) ve sahne notunda ilan edilir. Zaman sıkıştırma HUD'da yazılır.
Gökyüzü rengi kamera irtifasının tek-renkli fonksiyonudur (saçılma hacmi
çözülmez). Kademe ayrılması geometrisi illüstratiftir (atılan kademe balistik
izde solar). Kapak atma q ≤ 1 kPa sadeleştirmesidir.

## Export / reduced-motion

`?t=<s>&cam=<pad|chase|wide>` deterministik kare; varsayılan tablo Max-Q
ânı. Reduced-motion: otomatik oynatma yok, aynı tablo. Plüm durumu scrub'da
90 kare × 1/60 s ile deterministik hazırlanır.
