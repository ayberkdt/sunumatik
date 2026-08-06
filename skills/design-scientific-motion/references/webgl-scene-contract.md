# WebGL scene contract

The quality laws every WebGL scene preset (Sol, Terra, Lunaris, Planetae
and ANY future scene) must obey. These were each paid for with a live
debugging round — breaking one reintroduces a bug we already fixed once.
Scene-specific detail lives in each preset's reference; this file is the
general law.

## 1. Physically grounded, never an effect pile

Every visual element maps to a NAMED real phenomenon (limb darkening,
Evershed flow, ring shadow…). If you cannot name the phenomenon, delete
the effect. The caption keeps the real/illustrative split visible, and
the motion manifest records model + limitations per motion. Reference
imagery (SDO, eclipse photos, mission shots) is the ground truth for
look decisions — pixel metrics support, screenshots decide.

## 2. Continuity laws (the anti-glitch constitution)

- Everything the eye tracks must be C0-continuous. No visible value,
  position, or brightness may step between frames.
- NEVER rebuild geometry that is visible. Make geometry PARAMETRIC:
  vertex shaders build shapes from uniforms updated every frame
  (arc strips glued to moving footpoints). Rebuilds are legal only for
  objects at zero opacity.
- Events are ENERGY FIELDS, not swapped objects: new events ADD energy,
  fields decay exponentially, displayed values follow with a short
  attack. One-shot objects that replace each other always pop.
- Every threshold ramps from zero: no `visible = value > k` at finite
  opacity, no spot/marker popping in at full strength — fade over the
  threshold band.
- Anything dying on screen fades WITH its parent (a region's glow,
  sprite, and filament fade with the region's strength gate); teardown
  resets state only when nothing is visible.
- Interleaved/strided updates of VISIBLE elements strobe. Interleave
  only invisible bookkeeping (gravity), never displayed position.
- Coordinate-map distortions must not grow with time: differential
  shear combs chaos into streaks within minutes. Advect through a
  bounded two-phase flow map (same family as the texture-seam wrapU).

## 3. GLSL safety (NaN and undefined behavior)

- Custom fragments END with `#include <tonemapping_fragment>` +
  `#include <colorspace_fragment>` — or output bypasses ACES and clips.
- `pow(x, fractional)` with x possibly < 0 is NaN: wrap every
  `1-|noise|` in `ridge()` (max(0,·)); square by multiplication, not
  `pow(x, 2.)`. ONE NaN pixel floods the bloom mip chain and blinks the
  whole frame dark.
- smoothstep edges must never collapse to equality (undefined → 1 on
  real GPUs): guard zero-size masks and skip near-zero radii.
- GLSL ES 3.0 reserved words (`patch`…) silently kill compilation on
  WebGL2 — check the console for VALIDATE after every shader edit, and
  match source lines: stale errors from earlier pages persist in the
  tab console.

## 4. Light discipline

- Additive WHITE over a textured surface reads as cheap transparency.
  Brighten by saturating toward a HUE (warm gold for the Sun), cap the
  mix, keep the texture visible underneath.
- Bloom: soft knee (never the stock hard threshold), and no tiny
  bright dots as dominant sources — sub-pixel specks alias in the bloom
  mip pyramid and the whole halo flickers. Spread footpoint/pulse energy
  over wider, dimmer features.
- Uniformity reads as canned ("hazır radial blur"); controlled
  asymmetry reads as real: sector fields, breathing envelopes, lobe
  fields that modulate both brightness AND reach.

## 5. Procedural distributions (the eye counts)

- Small populations placed uniform-random ALWAYS clump. Use
  best-candidate (blue-noise) placement against the population's
  CURRENT positions, including at rebirth.
- Scale distributions skew LOW with rare large members, tied to a
  physical scale (loop height ∝ footpoint separation). Never add a
  deterministic per-index ramp to a visible dimension — it guarantees
  "everything at max".
- Point-sprite fluids: gas is big+faint+overlapping kernels (aging
  particles grow and fade), never sub-2px high-alpha dots — those read
  as grain, worse after decor-scale downsampling.

## 6. Determinism and testability

- Seeded layouts and schedules; `advance(seconds)` steps the whole scene
  deterministically (exports, tests, decor compositing).
- Export/reduced-motion render a declared tableau; `window.__<scene>`
  debug hook in the demo page; per-layer kill switches for bug hunts.
- Hidden-pane verification method: deterministic advance + pixel-diff
  scans (isolated-spike detector), cadence test (1/120 vs 1/60 separates
  sim-time from frame-count causes), feature-toggle isolation, and
  CONFIRM THE MECHANISM before fixing — toggles can mislead (a toggle
  can hide the trigger without being the cause).

## 7. Embedding

- Vendored three.js (import map; the split min build needs
  three.core.min.js beside three.module.min.js); preserveDrawingBuffer
  for readback; DPR capped; rAF paused when inactive/hidden.
- 2D decks composite scenes through decor modules (sol-decor pattern):
  off-screen host SIZED BEFORE MOUNT (hidden tabs never deliver
  ResizeObserver), camera distance option instead of synthetic wheel
  events, late feather, screen blend, calm activity defaults. Distance
  comes from scale/position — never blur/desaturate filters (they erase
  the texture the preset paid for).
