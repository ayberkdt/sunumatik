# Planetae preset

Files: `/presets/planets_advanced/` — `planetae.mjs` (mountPlanetae +
PLANETS config), `textures/` (Solar System Scope CC BY 4.0 set),
`index.html` (demo), `motion-manifest.json`, `asset-provenance.json`.
Shares vendor and stylesheet with the Lunaris vanilla preset (same
import-map requirement).

The remaining seven planets — Mercury, Venus, Mars, Jupiter, Saturn,
Uranus, Neptune — in one scene with a planet switcher: a scale-and-fade
crossfade between planets, a facts panel with real NASA fact-sheet values
(radius, day, year, known moons, distance), fresnel atmosphere halos per
planet, Saturn's rings from the CC BY alpha strip, thin procedural Uranus
rings, seeded stars, sun glow on the light axis, ACES + bloom, orbit
camera, deterministic export (Mars).

## Gas-giant dynamics (Sol-quality layer)

Jupiter, Saturn, Uranus, and Neptune run a custom atmosphere shader with a
`dynamics` config per planet:

- **Counter-rotating zonal bands** (real jet organization: neighbouring
  belts stream in opposite directions) with shear turbulence concentrated
  at band boundaries; advection fades near the poles to avoid the
  UV-singularity shimmer.
- **Jupiter:** the Great Red Spot as a fixed-longitude anticyclonic swirl
  with a warm tint; four **Galilean moons** on the real 1:2:4:9.4 period
  ratios whose **shadows transit the disc** (exact sun-ray projection).
- **Saturn:** the north-polar **hexagon** jet; the **ring shadow** sweeps
  the globe and the **planet's shadow darkens the far ring sector** (both
  exact ray tests — note the planet shadow hides behind the disc from the
  default camera; orbit to see it). Titan orbits with its shadow.
- **Neptune:** the fastest winds in the preset, a **transient dark-spot
  storm** that grows and dissolves cyclically (real dark spots come and go
  over years), and fast bright methane cirrus streaks.
- **Uranus:** deliberately subtle banding — faithful to its bland disc.

`advance(seconds)` steps the whole scene deterministically (exports,
tests); `debugDynamics()` reports the active planet's shadow-transit count.
The moons toggle removes satellites and their shadows together.

## What is real — keep the caption's split visible

- **Real:** photographic textures; axial tilts (Venus 177.4° and Uranus
  97.8° are why those two spin retrograde — the preset derives retrograde
  from the tilt rather than faking it); the ordering of visual spin rates
  follows real day lengths (Jupiter visibly faster than Venus); every fact
  in the panel.
- **Illustrative:** absolute spin speed, lighting, atmosphere strength,
  and all scales — planets render at unit radius, so sizes are NOT
  comparable between planets. Never present two planets side by side from
  this preset as a size comparison; use `$create-scientific-visuals` for
  that.
- Moon counts are "known as of ~2025" and change with discoveries; verify
  any fact used as slide evidence through `$verify-scientific-evidence`.
- Attribution is mandatory (CC BY 4.0): keep the Solar System Scope credit
  in the caption.

## API

```js
import { mountPlanetae, PLANETS } from './planetae.mjs';
const planetae = await mountPlanetae(container, {
  assetBaseUrl: '.../planets_advanced',
  initialPlanet: 'mars',          // default
  planets: PLANETS,               // or a filtered subset
  onPlanet: config => { ... },    // fires on every switch
});
planetae.showPlanet('saturn'); planetae.nextPlanet(); planetae.prevPlanet();
planetae.setActive(bool); planetae.resetView(); planetae.dispose();
```

The figure carries `data-owns-keys` and `data-owns-arrows`: arrow keys
switch planets while the figure is focused, so deck runtimes route arrows
to the scene and navigate slides with Space/PageDown. Validate
`motion-manifest.json` after changing behavior.
