# Eclipse / Occultation / Visibility — Tutulma ve Görünürlük Geometrisi (`/presets/eclipse_geometry/`)

Tek geometri modeli, üç soru: uydu ne zaman gölgede (umbra/penumbra, sonlu
Güneş diski — Montenbruck & Gill konik gölge fonksiyonu), yer istasyonu ne
zaman görür (AOS/LOS, dönen Dünya, maske açısı), sensör hedefi ve röle
bağlantısı ne zaman Dünya arkasında kalır (doğru parçası–küre / ışın–küre,
atmosfer teğet eşiği). Bütün geçişler tarama + bisection ile TÜRETİLİR.
3B: Güneş yönü, umbra/penumbra konileri, ν ile renklenen uydu, istasyon ve
röle çizgileri, sensör ışını. 2B: olay bantları + ν(t) ve ε(t). Çözücü
`eclipse-model.mjs` (saf). Denetim: `node scripts/validate-astro.mjs`.

## Mount

```js
import { mountEclipse } from './eclipse-geometry.mjs';
const ec = await mountEclipse(host, {
  preset: 'iss', elements: { a, e, i, raan, argp, M0 },   // km, rad
  dayOfYear: 80, revs: 2, station: { lat: 39.9, lon: 32.9, maskDeg: 5 },
  relayPreset: 'geo', star: [0, 0, 1], hAtm: 100, warp: 60,
});
ec.analysis    // { samples, events:[{t,id,label}], beta, betaStar, noEclipseByBeta, stats:{ umbraPerRev, penumbraFrac, visFrac, passes } }
ec.set({ dayOfYear: 172 }) · ec.timeline.play()/.scrub(t) · ec.dispose()
```

Saf: `analyze(cfg)`, `shadowFunction(r, sunDir)`, `betaAngle(el, sunDir)`, `elevationFrom(stationU, r, θ)`,
`segmentBlocked(p, q, hAtm)`, `rayBlocked(p, u, hAtm)`, `sunDirection(dayOfYear)`.

## Dürüstlük

Küresel Dünya, kırılma yok, Ay gölgesi yok, basit Güneş efemerisi, tek
maske açısı. Denetim: β = 0'da konik umbra ≈ silindirik asin(R/r)/π;
|β| > β* → tutulma yok; ISS umbra 30–37 dk; tepe ε = 90°.
