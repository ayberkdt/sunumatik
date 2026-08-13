# Orbital Stage — Yörünge Sahnesi (`/presets/orbital_stage/`)

THE core ORBITAL block of the scene-blocks program: feed it a trajectory,
get a cinematic, physically honest animation — transfer maneuvers, arrivals,
burns with pre/post orbit ghosts. Composes with `craft_blocks` (frozen
craft API) and obeys `webgl-scene-contract.md` without exception.

Demo: `/presets/orbital_stage/index.html` (two tabs: Hohmann LEO→GEO,
lunar arrival). Manifest: `motion-manifest.json` (3 motions, validated).

## Mount

```js
import { mountOrbitalStage, orbitMath } from './orbital-stage.mjs';
const stage = await mountOrbitalStage(host, {
  central: 'earth' | 'moon' | 'none',   // gövde + doku + gerçek dönme hızı
  active: true,                          // false → rAF yok, dışarıdan advance(dt)
  seed: 42,                              // yıldız fonu deterministik
  warp: 300,                             // varsayılan zaman sıkıştırma (HUD ilan eder)
  bloom: true, autoplay: true,           // isteğe bağlı
});
```

Page needs an import map: `"three": "../moon_advanced/vendor/three.module.min.js"`
(all vendor paths — lines/, controls/, postprocessing/ — resolve relative to the
module via `import.meta.url`). Host must be SIZED BEFORE MOUNT (hidden tabs:
use `visibility:hidden`, never `display:none`).

## Units — honest by construction

Internally km and seconds; `mu_earth = 398600.4418`, `mu_moon = 4902.800066`
km³/s². Display scale is normalized: 1 scene unit = central body radius
(6378.137 km Earth, 1737.4 km Moon). Central body rotates at its REAL sidereal
rate as a function of sim time (GEO craft visibly hovers over one longitude).
Timewarp is DISPLAY ONLY (`timeline.setWarp`), always declared in the HUD;
LEO period ~90 min plays in ~18 s at the default 300×. Craft size is
exaggerated for visibility — say so in captions when it matters.

## Trajectories — the three spec forms

```js
// a) analitik Kepler koniği (e>1 → hiperbol; span açık yay sınırı, rad)
stage.addTrajectory({ kepler: { a, e, i, raan, argp, nu0, mu }, span: 'full' | rad, color? });

// b) VERİ GÜDÜMLÜ oynatma — [t,x,y,z] km; Catmull-Rom, zaman senkron
stage.addTrajectory({ states: [[0, 6678, 0, 0], [60, 6644, 462, 0], ...], mu });

// c) RK4 yayılımı + impulsif yanmalar (dv tam t'de uygulanır, km/s)
stage.addTrajectory({ propagate: { r0:[x,y,z], v0:[vx,vy,vz], mu, tMax,
  burns: [{ t, dv: [0, 2.43, 0] }] } });
```

Each returns a handle `{ show(), hide(), focus() }`. The focused track feeds
the HUD and the chase camera. Propagate/states paths draw progressively as
flown (dashSize uniform — parametric, never a rebuild); kepler paths render
whole at low opacity (they ARE an orbit, not a journey).

`orbitMath` exports the setup math so demos never hand-type numbers:
`stateFromKepler(el, nu)`, `elementsFromState(r, v, mu)`,
`timeFromPeriapsis(a, e, mu, nu)`, `circularSpeed(mu, r)`, `periodOf(mu, a)`,
plus `MU_EARTH/MU_MOON/R_EARTH/R_MOON`.

## Craft, burns, camera, HUD

```js
await stage.setCraft(track, 'orbiter'|'lander'|'cubesat'|'capsule'|THREE.Group);
stage.addBurnMarker(track, { t, dv: [..], label: 'ΔV₁ 2,43 km/s' });
stage.timeline.play(); .pause(); .scrub(t); .setWarp(x); .t; .duration;
stage.camera.mode('chase'); stage.camera.transitionTo('orbit', { duration: 1400 });
stage.hud(true); stage.setGrid(false);
stage.advance(dtRealSeconds);   // dış sürüş (dekor deseni); setActive(false) ile
stage.dispose();
```

- Craft rides with **+X aligned to velocity** (frame from tangent + radial),
  imported from `../craft_blocks/craft-blocks.mjs`; if that import
  fails the stage silently degrades to a box+panel placeholder (contract:
  blocks never hard-depend on each other).
- `addBurnMarker` is the manim moment: plume cone from −X, ΔV arrow + label,
  and pre/post orbit GHOSTS — the pre-burn conic fades while the post-burn
  conic draws itself in from the burn point. Ghost timing is a sim-time
  envelope (`ghostDuration` option, default 900 sim s) so scrubbing and
  screenshots are deterministic.
- Camera modes: `chase` (behind craft, looking along velocity), `orbit`
  (slow cinematic tour; azimuth is a function of sim time — deterministic),
  `body` (fixed high vantage), `free` (OrbitControls). Transitions ease;
  scrub snaps.
- HUD (deck typography, palette tokens `--color-*`): smart-unit t
  (dk/sa/gün), altitude km, |v| km/s, cumulative ΣΔV of the focused track,
  and the warp declaration. Apsis markers label enberi/enöte with true
  altitudes for elliptic segments (skipped when e < 0.01 — a circle has no
  apsides).

## Determinism and capture

Every visual is a pure function of sim time t (body rotation is an absolute
angle, ghost/plume windows are t-envelopes, orbit-camera azimuth derives from
t). The demo supports `?tab=1|2&t=<sim seconds>&cam=chase|orbit|body` for
headless screenshots; `prefers-reduced-motion` and `?export=1` disable
autoplay and hold a declared tableau. Debug hook: `window.__orbitalStage`.
`stage.stats.advanceMs` reports the EMA cost of `advance()`.

## Honest-use rules

- NEVER present two-body arcs as mission ephemerides. Real missions (with
  perturbations, finite burns, third bodies) must be routed through the
  `states` form with the real data, and the caption must say where the data
  came from. The `kepler`/`propagate` forms are for teaching geometry and
  maneuver arithmetic.
- Always let the module compute ΔV magnitudes from mu and radii (see the
  demo's Hohmann setup) — never hand-type a ΔV that the drawn orbit doesn't
  actually produce.
- State the warp and the craft-size exaggeration whenever a viewer could
  mistake pacing or scale for reality.
- One scene, one light logic; track colors come from palette tokens
  (data-1/data-2/accent) so the stage looks native in any saved theme.
