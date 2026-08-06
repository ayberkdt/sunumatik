# Sol preset

Files: `/presets/sun_advanced/` — `sol-sun.mjs` (mountSol),
`sol-decor.mjs` (mountSolDecor — 2B tuvale kompozit), `index.html`
(demo, exposes `window.__sol`), `motion-manifest.json`. Fully procedural: no
textures, works offline. Shares vendor and stylesheet with the Lunaris
vanilla preset (same import-map requirement).

An ACTIVE Sun modeled on SDO/SOHO/eclipse imagery, grounded in documented
solar physics — every element maps to a real phenomenon, nothing is a
free-floating effect. Tuned over ~20 user-feedback rounds; the architecture
below is the approved final state. Do not casually rewrite pieces of it —
the continuity rules at the bottom are load-bearing.

- **Photosphere** — domain-warped ridged-noise plasma (three churn channels
  boiling in different directions — no net drift), MAX-blended dual strand
  fields under a patch mask, dark filament lanes, macro activity patches,
  polar coronal-hole dimming, real linear limb darkening
  I(μ) = I₀(1 − 0.56(1 − μ)). Geometry is displaced by the same field
  (low-frequency relief ±.006R, gentle dFdx emboss) so the limb undulates.
- **Differential rotation** — the flow field drifts equator-fast,
  ω(lat) = .028(1 − .8 sin²φ); the SAMPLE coords rotate by −dphi (sample
  rotation is always opposite to apparent pattern motion). Spots ride the
  SAME law plus a small proper motion (lead ahead, trail behind).
  The differential part goes through a **FLOW MAP** (two phases, 44 s
  triangle crossfade, each field's twist bounded and reset only while
  invisible): applying shear as dphi ∝ t distorts the sampling map
  without bound and combs the chaos into latitude streaks within minutes.
  The rigid part stays unbounded (rigid rotation never distorts). Vertex
  relief drifts rigid-only for the same reason. Never reintroduce
  time-linear shear on sample coordinates.
- **Sunspots** — seeded bipolar pairs in the real ±8–32° belts obeying
  **Joy's law** (trailing spot poleward, tilt grows with latitude).
  Longitudes use **best-candidate placement** (10 seeded candidates, pick
  the farthest from existing regions; rebirths avoid the others' CURRENT
  positions) — independent uniform draws clump badly (all 6 regions once
  landed in a 128° arc). Spots have dark
  umbra (Wilson-depression pit in the vertex shader), Evershed-flow
  penumbra striae, limb-strengthened facular ring. Regions live
  emerge/hold/decay cycles (42–76 s) and are reborn at new seeded
  longitudes. All spot effects fade in over `smoothstep(.012,.05,w)` and
  every spot loop skips `w < .012` (see continuity rules).
- **Coronal loops** — 6 additive tube arcs per region connecting the pair's
  polarities. The tubes are **parametric**: a shared `makeArcStrip`
  geometry (aT/aC attributes) whose vertex shader builds the arc from the
  region's two footpoint uniforms (uA/uB) EVERY frame — footpoints are
  glued to the drifting spots, geometry is never rebuilt. Twist-free frame:
  W = normalize(cross(uA,uB)) (constant arc-plane normal), T by finite
  difference, N2 = cross(W,T). Arc radius clamped ≥ 1.016 to stay above
  the photosphere displacement band. **Heights are LOW-SKEWED random**:
  apex = pairSeparation × (.5 + 1.6·seed^2.2) — most loops squat, tall
  arches rare, refreshed each region rebirth; jitter scales with the
  loop's own height. Never add a deterministic per-loop height ladder
  (k·const) — it guarantees every region a max-height loop and the
  arcade reads as uniformly tall/artificial.
- **Flares** — a seeded deterministic scheduler fires at LIVING regions
  (strength ≥ .35) with the real impulsive profile. Flares are an
  accumulating **energy field** per region: `flareEnergy` decays
  exp(−dt/2.4), `flareDisplay` follows with a .32 s attack, capped 1.05.
  What reaches the screen is `flareShown = display × min(1, strength×4)`
  so a dying region's glow, sprites and filament fade WITH the region.
  The VISUAL is real flare anatomy, not a bright blob: **two ragged
  RIBBONS** flanking the pair's neutral line (uFlareInfo: separation grows
  with flare age — ribbons drift apart as reconnection proceeds), a weak
  texture-preserving warm heating (texKeep × heat), faint warm sprites
  (never white-cored), and an **arcade cascade** — each loop eases toward
  the flare level with τ = .3 + k·.5, so low loops light first and high
  loops linger (post-flare arcade).
- **Eruptions/CMEs** — big flares (power > 1.05) lift the region's
  parametric filament (uLift over 5.5 s; only started if the region has
  > 7 s of life left) and launch the particle splash: 240 000 droplets in
  flat Float32Arrays, 8–10 coherent staggered jets, gravity with
  v_esc(1) = 1 so slow plasma rains back (fading INTO the surface) while
  the fast fraction escapes; corona sector surge eases via cmePulseTarget.
  Rendering is a FLUID FILM, not dots: fresh droplets are small bright
  cores, aging droplets grow into large faint soft puffs
  (size = (3+10·(1−fade))/z, kernel pow 2.4, alpha .12) so neighbors
  overlap and merge. Never shrink points below ~2px with high alpha —
  sub-pixel sparse dots read as grain ("partikül partikül"), especially
  after decor-scale downsampling.
- **Corona** — eclipse anatomy on a camera-facing quad sampling WORLD
  direction (space-fixed under orbiting): soft spherical base glow
  (pow(rr,−3.3)) + broad petal streamers whose one lobe field drives both
  brightness AND length + sector asymmetry (quiet vs busy sides) + fine
  polar plumes; reveal starts inside the limb so there is no dark moat.
  Thin chromosphere spicule fringe with sector modulation at the limb.
- **Stars** fade to fully invisible in a wide band around the disc
  (smoothstep .78–.92 on screen proximity). **Bloom**: UnrealBloomPass
  (.3/.55/.4) with `highPassUniforms.smoothWidth.value = .5` (soft knee).
- Collapsible UI panels (chips), truth headline always visible, activity
  slider scales flare frequency + granulation contrast + corona together.

## Truth split — keep it visible

Real: limb-darkening law, differential-rotation law, umbra/penumbra
structure with Wilson depression and Evershed flow, activity belts, bipolar
grouping + Joy's law, loop-connects-polarities geometry, rise-then-decay
flare profile, failed-eruption/coronal-rain ballistics, CME-follows-major-
flare ordering, equatorial streamer belt + polar plumes. Illustrative: ALL
timing (~1000× fast), sizes, colors beyond rough temperature ordering, and
the seeded layout (not an observed magnetogram). For claims about actual
solar events use observed imagery via `$verify-scientific-evidence`.

## API

```js
import { mountSol } from './sol-sun.mjs';
const sol = await mountSol(container, { activity: 1.4, seed: 20260805 });
sol.triggerFlare(); sol.pause(); sol.play(); sol.resetView();
sol.setActive(bool); sol.dispose();
sol.advance(seconds);   // deterministic stepping — exports & hidden-pane tests
sol.regions;            // seeded active regions (strength, cycle, spots)
sol._state;             // debug: per-layer kill switches (showFilament, …)
```

Export/reduced-motion freeze a declared tableau (flare on region 1, splash
mid-flight, noise time 26.4). The figure carries `data-owns-keys`. Validate
`motion-manifest.json` (3 motions) after changing behavior.

## Decor use — the Sun in a 2D-canvas deck (NEVER redraw a sun by hand)

```js
import { mountSolDecor } from '.../sun_advanced/sol-decor.mjs';
const decor = await mountSolDecor();          // once (options: size,
                                              // cameraDistance, activity, seed)
decor.draw(ctx, x, y, r, alpha);              // every frame; r = disc radius px
decor.sol;                                    // full preset API if needed
decor.dispose();
```

`draw()` returns false when the preset is unavailable — keep a plain 2D
fallback behind it. The module owns everything decks used to hand-wire:
off-screen host **sized via CSS before mount** (hidden tabs never deliver
ResizeObserver), UI/star taming, camera pulled to `cameraDistance` 6.2
(disc fraction derives as 1.2071/distance — no synthetic wheel events; use
the `cameraDistance` mountSol option, never wheel hacks), a LATE corner
feather (featherStart .8 — an early mask eats the corona's sector
asymmetry and reads as canned radial blur), `screen` blending to swallow
the preset's dark background, and a calm decor tempo (activity .85: one
arch at a time, sparse short flares, corona ~16% dimmer than default).
Never apply blur/desaturate "distance" filters to the composite — they
erase granulation (learned in the Harmonikler deck). Live example:
`Harmonikler/index.html` + `js/engine/ambient.js` (drawSolPreset).

## Continuity rules (hard-won — breaking any of these brings the glitches back)

1. **No fractional pow of raw noise.** Ashima snoise can exceed ±1; use the
   `ridge()` helper (`max(0., 1.-abs(n))`) before any `pow(·, fractional)`.
   One NaN pixel floods the bloom mip chain and the WHOLE bloom blinks off
   for 2–3 frames (the historic "simultaneous glitch").
2. **Never let smoothstep edges collapse** (smoothstep(0,0,x) is undefined
   → returns 1 on hardware): keep the `w < .012 continue` guards AND the
   `smoothstep(.012,.05,w)` fades in all three spot loops.
3. **Never rebuild geometry on anything visible.** Loops/filament are
   parametric for this reason; keep footpoints in uniforms.
4. **No hard visibility thresholds at finite opacity** — sprites/effects
   must ramp from zero at their threshold.
5. **Events are energy fields, not swapped objects** (flare energy model);
   never zero anything still on screen (that is what `flareShown`'s
   strength gate is for).
6. Every fragment shader ends with `#include <tonemapping_fragment>` +
   `#include <colorspace_fragment>`; check the console for VALIDATE errors
   after shader edits (GLSL ES 3.0 reserved words — `patch` bit us).
7. Verification method that actually finds blinks: deterministic
   `advance()` stepping + per-frame pixel diff; cadence test (1/120 vs
   1/60) separates sim-time events from frame-count events; measuring the
   bloom layer alone (bloomOn − bloomOff per step) isolates post-process
   causes; feature toggles can mislead — confirm the mechanism before
   fixing.
