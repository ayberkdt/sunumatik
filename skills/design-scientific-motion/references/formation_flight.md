# Formation Flight — Formasyon Uçuşu (`/presets/formation_flight/`)

scene-blocks "wave 2" ORBITAL bloğu. Şef merkezli LVLH çerçevede
Clohessy–Wiltshire göreli yörüngeler: PCO, GCO, düzlem-içi 2:1 elips,
lider–takipçi (GRACE tarzı), sürüklenmesiz koşul ihlali; çok deputy, kapalı
izler, üç ortogonal izdüşüm, ayrım tablosu (ρ, R/V/H, min–max, sürüklenme).
`rendezvous_docking` ile aynı paylaşılan çözücüyü kullanır
(`presets/core/astro-relative.mjs`: `pcoInitialState`, `gcoInitialState`,
`leaderFollowerState`, `inPlaneEllipseState`, `alongTrackDrift`, `cwPropagate`).

## Mount

```js
import { mountFormation } from './formation-flight.mjs';
const ff = await mountFormation(host, {
  scenario: 'pco',                 // pco | gco | inPlane | leaderFollower | drift | custom
  scenarioOptions: { count: 3, rho: 1000, altitude: 500e3, orbits: 2,
                     deputies: [{ state: [x, y, z, vx, vy, vz], label }] },   // custom
  warp: 60, camera: 'overview',   // overview | along | top | free
});
ff.form.deputies[i].drift   // sekülar iz-boyu sürüklenme (m/s)
ff.stats.chief / ff.stats.pairs   // min–max ayrımlar
ff.setScenario('drift', { rho: 2000 }) · ff.timeline.play()/.scrub(t) · ff.dispose()
```

Saf kullanım: `buildFormation(id, opts)`, `statesAt(form, t)`, `trace(form, deputy, t0, t1)`, `separationStats(form)`.

## Dürüstlük

Doğrusal CW: J2 ve diferansiyel sürükleme yok (gerçek formasyonlar bakım
manevrası ister); itki yok; araç boyları ölçeklenir, ölçek çubuğu sahnede.
Sürüklenmesiz koşul ẏ₀ = −2n x₀; ihlalde sürüklenme −(6n x₀ + 3ẏ₀) — tabloda.

## Sahne notu (Dünya)

Dünya gerçek ölçek ve konumdadır: merkez LVLH orijininden −R yönünde R_E + h uzakta (h = senaryo irtifası), logaritmik derinlik tamponu ile çizilir; ufuk dalımı acos(R_E/(R_E + h)) (500 km için ≈ 22°). Kamera alçak bakışla ufku karenin üst üçte birinde tutar; −R ekseni Dünya merkezine bakar. Fresnel atmosfer ve uzak Güneş ışıması `core/lab-three.mjs` yardımcılarından.
