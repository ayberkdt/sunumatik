# Cosmos preset

Files: `/presets/cosmos_advanced/` — `cosmos-sky.mjs` (mountCosmos),
`cosmos-decor.mjs` (mountCosmosDecor — 2B tuvale dikdörtgen fon kompoziti),
`index.html` (demo, exposes `window.__cosmos`), `motion-manifest.json`,
`textures/milkyway-eso0932a.jpg` + `textures/CREDITS.md` (photographic
Milky Way, see Attribution below). Works offline WITHOUT the texture too:
every layer has a procedural path, and the photographic band falls back
silently. Shares vendor and stylesheet with the Lunaris vanilla preset
(same import-map requirement).

A DEEP-SPACE BACKDROP for title/closing slides — a skybox, not an object:
the camera sits at the origin looking out, so there is no `cameraDistance`
option (use `fov` if you need a wider or tighter framing). Everything is
seeded and deterministic; `advance(seconds)` steps the whole sky.

- **Starfield** — 12 000 points built once; a `density` option gates them
  through a `smoothstep(±.06)` band on a per-star seeded cut value, so the
  slider fades stars in/out instead of popping them and geometry is NEVER
  rebuilt. Magnitudes are inverse-CDF sampled from the truncated
  luminosity law **N(m) ∝ 10^(0.35m)**, m ∈ [−1.2, 6.8] — many faint,
  few bright. Colors come from a **black-body ramp** (2600 K M-red →
  15 000 K A/B blue-white, Tanner Helland), never a rainbow palette;
  bright stars get a mild hot bias (stylistic, not an HR diagram).
  Point size floors at 1.7 px — no sub-2px high-alpha grain.
- **Scintillation** — twinkle amplitude is nonzero ONLY on the brightest
  ~2% (two incommensurate sinusoids, seeded phase, scaled by `activity`).
  Honest note kept in caption + manifest: scintillation is atmospheric;
  a space camera would see none. It stays because a perfectly static sky
  reads as a frozen image.
- **Photographic Milky Way** (default when the texture is present) —
  the REAL sky: the ESO GigaGalaxy Zoom 360° panorama (`eso0932a`,
  ESO/S. Brunier, CC BY 4.0, 4000×2000 equirect) wrapped on a separate
  inward-facing dome. The sphere's OWN UVs are used (no `atan` seam in
  the fragment → no derivative discontinuity, clean mip chain); the mesh
  quaternion aligns the equator to the band plane (`milkyWayTilt`) and
  the image center (galactic core) to the preset's core longitude.
  `milkyWayIntensity` multiplies brightness via a shader uniform with a
  soft Reinhard shoulder (`uTone`) so the band never clips to white at
  1× and the star layer stays readable on top (additive sum). The
  procedural fBm dome AND the 8 000-point star-dust layer switch OFF in
  photo mode — fake grain must not sit on a real photograph. Loading is
  awaited inside `mountCosmos` (the mode is decided before the first
  frame — no mid-flight layer swap); on failure (missing file, `file://`
  CORS) ONE `console.info` and the procedural band takes over.
  Orientation/tilt is presentational, not equatorial-coordinate-accurate.
- **Procedural Milky Way (fallback)** — three cooperating layers on a
  configurable tilt
  (`milkyWayTilt`, default 63°): (1) an inward-facing dome shader
  (BackSide sphere — the geometrically correct form of a "billboard glow"
  when the camera is at the center: one sample per view direction, no
  parallax error) with a Gaussian latitude envelope × layered STATIC fBm
  (macro patches × fine fibrils), (2) a narrow **negative-density dust
  lane** just below the band midline with fBm-torn edges (Great Rift
  analogue), (3) a seeded 8 000-point "star dust" layer, accept-reject
  sampled to clump along the band and thin inside the dust lane. A warm
  ivory brightening toward one in-band core longitude breaks uniformity
  (uniformity reads as canned). The dome shader has NO time input — the
  structure is static, so its per-frame cost is pure sampling.
- **Nebulae** — OFF by default (`nebulae: true` to enable). 2–3 origin-
  facing shader billboards, fBm alpha inside a squared radial falloff,
  palette restricted to H-alpha rose + O-III teal. Free composition —
  the manifest says so.
- **Meteors** — a pool of 3 stretched quads glued to the sky sphere.
  Each streak is ONE quad whose shader slides the head along it
  (`uP` uniform); while visible nothing is repositioned — quads are
  placed only while invisible (rebuild-at-zero-opacity rule). Brightness
  envelope `sin(π·p)` grows from and returns to exactly zero. Warm-white
  head, faint green-blue trail (magnesium tint gesture). Seeded schedule
  paced by `activity`; `triggerMeteor()` fires one manually (M key).
- **Drift** — very slow yaw of the sky group (`drift`, default 0.1°/s).
  OrbitControls at a 0.02-radius orbit gives manual look-around
  (rotateSpeed negative: dragging "grabs" the sky); zoom/pan disabled.
- **Reduced motion** — static frame: no drift, no twinkle, no meteors.
  **Export** — declared tableau at t = 12 with one meteor frozen at 45%
  progress (Sol convention); reduced-motion wins over export (no meteor).
- **No bloom, no composer** — a single render pass keeps the backdrop
  cheap. Measured advance(1/60): ~0.13 ms/frame CPU-side at 1280×800
  (hidden-pane method, 200 frames); decor `draw()` with feathering
  ~0.5 ms/frame (see the header comment in `cosmos-sky.mjs`). Photo
  mode measured equal-or-cheaper than procedural (0.02–0.07 ms vs
  0.03–0.05 ms, difference within noise): it swaps the fBm dome +
  8 000-point layer for ONE textured dome — one fewer draw call, and
  per-pixel cost drops from layered fBm to a single texture fetch.

## Truth split — keep it visible

Data-driven WHEN the photograph loads: the Milky Way band is a real
observed panorama (ESO/S. Brunier) — its structure, dust lanes, and
clouds are the actual sky. Realistic at the DISTRIBUTION level: the
magnitude law (many faint, few bright), black-body color ordering,
twinkle confined to the brightest stars. Illustrative: star POSITIONS
are seeded random (no real constellations — never point at this sky and
name one), the FALLBACK Milky Way is procedural fBm not the real
structure, the photo dome's orientation/tilt is a compositional choice
(not equatorial coordinates), nebulae are free compositions, meteor
timing is a seeded schedule, and scintillation itself is an atmospheric
effect kept for legibility.

## Attribution — CC BY 4.0 (mandatory)

The photographic band is the ESO GigaGalaxy Zoom panorama, image id
`eso0932a`, licensed CC BY 4.0 (https://www.eso.org/public/copyright/).
The credit **"ESO/S. Brunier"** MUST appear visibly in any deck (and any
export) that shows the photographic band — put it on the deck's credits
slide, e.g. `Samanyolu: ESO/S. Brunier (CC BY 4.0)`. The preset bakes the
credit into its truth caption, and the demo shows a fixed credit line
while the texture is on; decks that hide the preset UI must carry the
credit themselves. `textures/CREDITS.md` records source URL, license
pointer, and download provenance. Purely procedural use
(`galaxyTexture: false` or missing texture) needs no credit.

## API

```js
import { mountCosmos } from './cosmos-sky.mjs';
const cosmos = await mountCosmos(container, {
  seed: 20260813,        // yerleşim + program tohumu
  activity: 1,           // göktaşı sıklığı + parıldama genliği (0–2.5)
  density: .75,          // yıldız yoğunluğu 0–1 (gate, rebuild yok)
  milkyWayIntensity: 1,  // bant + nokta katmanı parlaklığı (foto modda
                         // doku parlaklığını uniform çarpımıyla ölçekler)
  milkyWayTilt: 63,      // bandın eğimi (derece; foto kubbe de buna hizalanır)
  galaxyTexture: 'auto', // "auto" → textures/milkyway-eso0932a.jpg (modüle
                         // göreli, import.meta.url); false → hep prosedürel;
                         // URL string → özel eşirekt doku. Yükleme mount'ta
                         // await edilir; başarısızlıkta sessiz prosedürel
                         // fallback (tek console.info). KREDİ: ESO/S. Brunier
  nebulae: false,        // bulutsu lekeleri (varsayılan kapalı)
  drift: .1,             // kamera kayması, derece/sn
  fov: 62,               // kadraj (cameraDistance YOK — skybox)
  active: true,          // false → rAF kurulmaz, advance(dt) sürer
});
cosmos.triggerMeteor(); cosmos.pause(); cosmos.play(); cosmos.resetView();
cosmos.setOptions({ activity: .5, nebulae: true });   // canlı, pop'suz
cosmos.setOptions({ galaxyTexture: false });   // yüklü fotoyu kapat/aç
                                               // (yeni URL = yeniden mount)
cosmos.galaxyPhotoActive();  // fotoğrafik bant görünür mü — kredi satırı
                             // gösterme kararı bununla verilir
cosmos.setActive(bool); cosmos.dispose();
cosmos.advance(seconds);   // deterministic stepping — exports & tests
cosmos._state;             // debug: katman anahtarları (showMilky, …)
```

The figure carries `data-owns-keys` (Space pause, M meteor, R reset).
Validate `motion-manifest.json` (5 motions) after changing behavior.

## Decor use — the backdrop in a 2D-canvas deck

```js
import { mountCosmosDecor } from '.../cosmos_advanced/cosmos-decor.mjs';
const decor = await mountCosmosDecor();       // once (options: width, height,
                                              // activity, seed, density,
                                              // milkyWayIntensity, nebulae,
                                              // drift, featherPx, galaxyTexture
                                              // — foto bant kullanılırsa deste
                                              // "ESO/S. Brunier" kredisini
                                              // taşımak ZORUNDA)
decor.draw(ctx, x, y, w, h, alpha, dt);       // every frame; RECTANGULAR blit
decor.cosmos;                                 // full preset API if needed
decor.dispose();
```

`draw()` returns false when the preset is unavailable — keep a plain 2D
fallback (dark gradient + a few dots) behind it. The module owns the
sol-decor conventions: off-screen host **sized via CSS before mount**
(hidden tabs never deliver ResizeObserver), UI hidden, `active: false`
(the deck's rAF drives via `advance`), `screen` blending to swallow the
preset's near-black background, calm tempo (activity .7) and drift OFF by
default so the deck's own camera language stays in charge. Edge feathering
is optional (`featherPx`, default 26; 0 disables) and runs as two
`destination-in` linear-gradient passes so all four edges soften. Never
apply blur/desaturate "distance" filters to the composite.

## Continuity rules honored (see webgl-scene-contract.md)

1. Density/visibility changes ramp through smoothstep bands — nothing
   pops at finite opacity.
2. Meteor quads are repositioned ONLY while invisible; in flight only
   uniforms change; the envelope is exactly zero at both ends.
3. All fragments end with `#include <tonemapping_fragment>` +
   `#include <colorspace_fragment>`; every square is a multiplication
   (no `pow(x, 2.)`), every `1-|noise|` goes through `ridge()`.
4. Seeded layouts + schedule; `advance(seconds)` is the only clock the
   sim needs; export/reduced-motion render a declared tableau.
5. No bloom — the "tiny bright dots alias in the bloom mips" class of
   bugs cannot occur; star cores stay ≥ 1.7 px regardless.
