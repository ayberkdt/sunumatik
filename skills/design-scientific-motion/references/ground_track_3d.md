# Ground Track 3D — 3B Yörünge + 2B Yer İzi (`/presets/ground_track_3d/`)

scene-blocks "wave 2" ORBITAL bloğu. AYNI yörünge iki eşzamanlı görünümde:
dönen Dünya etrafında eylemsiz yörünge, alt-uydu noktası, nadir çizgisi ve
küre üstüne işlenen iz (3B) + açılmış eşdikdörtgen haritada yer izi (2B).
İz çizilmez, TÜRETİLİR: ECI Kepler durumu → θ = θ₀ + ω_e t dönmesiyle ECEF →
lat = asin(z/r), lon = atan2(y,x) − θ, sarım kesilir. Eğiklik/RAAN/irtifa/e
değişince iz gerçekten değişir. Çözücü: `presets/core/astro-orbit.mjs`
(saf; Kepler + isteğe bağlı J2 seküler oranları; presetler ISS, SSO,
kutupsal, Molniya, GPS, GEO, Tundra). Denetim: `node scripts/validate-astro.mjs`
(GEO sabit nokta, kutupsal ±90°, max enlem = i, düğüm kayması = −ω_e T,
vis-viva, SSO J2 düğüm oranı ≈ 0,986°/gün, Molniya ω̇ ≈ 0, sarım sayısı).

## Mount

```js
import { mountGroundTrack } from './ground-track.mjs';
const gt = await mountGroundTrack(host, {
  preset: 'iss',                          // ya da elements: { a, e, i, raan, argp, M0 } (km, rad)
  revs: 3, j2: false, warp: 60, camera: 'orbit',   // orbit | pole | free
});
gt.setPreset('molniya', { revs: 2, j2: true });
gt.setElements({ a: 7078, e: .001, i: 98.2 * Math.PI / 180, raan: 1.9, argp: 0, M0: 0 });
gt.info   // { period, lonShiftPerRev, maxLat, j2Rates, revs }
gt.track  // [{ t, lat, lon, alt, r, v, brk }]
gt.timeline.play() .scrub(t) .setWarp(300) · gt.camera.mode('pole') · gt.advance(dt) · gt.dispose()
```

Saf kullanım: `import { groundTrack, stateAt, j2Rates, ORBIT_PRESETS } from '../core/astro-orbit.mjs'`.

## Dürüstlük

Küresel Dünya, jeosantrik enlem; J2 yalnız seküler ortalama elemanlar
(kısa-periyot yok); θ₀ keyfi — gerçek geçiş tahmini için TLE/SGP4 gerekir,
bu blok onu yapmaz. Uydu boyu abartılıdır; zaman sıkıştırma HUD'da.

## Export / reduced-motion

`?preset=&t=&cam=&j2=1&revs=` deterministik kare; tablo sürenin %45'i.
