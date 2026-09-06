# Orbit Perturbations — Yörünge Pertürbasyonları (`/presets/orbit_perturbations/`)

İki-cisim referansına karşı sayısal pertürbasyon karşılaştırması: J2 (düğüm
gerilemesi, perigee kayması, SSO, kritik eğiklik), sürükleme (üstel-tablo
termosferi ile bozunma), SRP (top modeli, silindirik gölge), Ay–Güneş
üçüncü cisim (GEO eğiklik sürüklenmesi). 3B yörünge yelpazesi + düğüm
çizgisi; Ω(t), ω(t), irtifa/a, i/e grafiklerinde oskülatör sayısal eğri,
ortalama eğri ve analitik sekülar doğru üst üste; HUD'da sayısal vs
analitik oranlar. Çözücü `perturbation-model.mjs` (saf; `core/astro-orbit.mjs`
j2Rates ve `core/astro-atmosphere.mjs` densityBlend paylaşılır).

## Mount

```js
import { mountPerturbations } from './orbit-perturbations.mjs';
const op = await mountPerturbations(host, { scenario: 'j2leo', warp: 21600 });   // j2leo | sso | molniya | molniyaOff | drag | srpGeo | moonGeo | twoBody
op.setScenario('drag', { el: { a: 6678, e: .001, i: 51.6 }, days: 30, dt: 10, forces: { j2: true, drag: true }, cdAm: .01 });
op.rates      // { raanNum, raanAn, argpNum, argpAn } (rad/s)
op.sim        // { samples:[{t, r, v, el, alt}], secular, period, decayed, events }
op.timeline.play()/.scrub(t) · op.dispose()
```

Saf: `propagatePerturbed(id, overrides)`, `acceleration(r, v, t, forces, cfg)`, `rvToElements`, `elementsToRv`, `unwrap`, `runningMean`, `fitRate`.

## Dürüstlük

Yalnız J2; termosfer ortalama aktivite; Ay/Güneş dairesel basit efemeris;
SRP sabit A/m. e ≈ 0'da ω tanımsızdır — sahne enlem argümanını gösterir.
Denetim: Ω̇ sayısal/analitik ±2 %, Molniya ω̇ ≈ 0, H_z korunumu, sürükleme
tek yönlü, GEO eğiklik sürüklenmesi 0,7–1,0°/yıl.
