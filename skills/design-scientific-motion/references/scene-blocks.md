# Scene blocks — the composable 3D presentation program

GOAL (user directive, 2026-08-13): stop multiplying small presets; build a
small number of EXCELLENT ones — manim-grade, block-by-block composable —
until a deck can be assembled from blocks: aesthetic spacecraft, a stage
that accepts a TRAJECTORY and plays it (lunar landing, transfer maneuver),
and a matching family of ML scenes. Quality over count. Every block obeys
`webgl-scene-contract.md` without exception.

## Categories (call them by these names)

### ORBITAL — Yörünge Sahnesi (`assets/orbital-*`)

| Block | Status | What it is |
|---|---|---|
| `orbital_stage` | **wave 1** | THE core stage: central body (Earth/Moon, real textures), unit system, deterministic timeline (play/scrub/warp), trajectory tracks from Kepler elements, state arrays (data-driven!) or RK4 propagation with impulsive burns; fading trails, apsis markers, burn events with plume + ΔV arrow + pre/post orbit ghosts; camera director (chase/orbit/body/free with smooth transitions); telemetry HUD (t, alt, |v|, ΔV) in deck typography |
| `craft_blocks` | **wave 1** | Parametric aesthetic craft LIBRARY (no mount): orbiter, lander, 2-stage rocket, cubesat, capsule — pure builders returning THREE.Group, shared material language |
| `lunar_descent` | **wave 1** | Powered descent to the lunar surface: braking + vertical phases integrated against lunar gravity, throttle-scaled plume, touchdown dust, alt/vy/fuel HUD, chase/side/surface cameras |
| `launch-ascent-preset` | wave 2 | Gravity-turn ascent with staging, max-Q band, downrange camera |
| `rendezvous-docking-preset` | wave 2 | Chaser/target relative motion (CW equations), approach corridor, docking axis alignment |
| `groundtrack-3d-preset` | wave 2 | Rotating body + 3D orbit + unwrapping 2D ground track, side by side |
| `porkchop-preset` | wave 2 | Departure/arrival ΔV contour surface with window highlight |
| `constellation-coverage-preset` | wave 2 | Walker constellations, coverage cones painting the surface |
| `reentry-corridor-preset` | wave 2 | Entry interface, corridor bounds, heating band |
| `formation-flight-preset` | wave 2 | Multi-craft relative orbits (GRAIL-style pairs) |

### ML — Veri/Öğrenme Sahneleri (`assets/ml-*`)

| Block | Status | What it is |
|---|---|---|
| `ml_loss_landscape` | **wave 1** | 3D loss surface (analytic composite), REAL optimizer integration on its gradient: SGD vs momentum vs Adam trails racing to minima |
| `ml_attention_flow` | **wave 1** | Transformer attention as animated weighted arcs over token strips — real softmax over deterministic embeddings, layer stepping |
| `ml-embedding-projector-preset` | wave 2 | 3D point-cloud embedding space: cluster morph, semantic axis sweep |
| `ml-conv-vision-preset` | wave 2 | Image → sliding kernels → feature maps pipeline, stride/padding visible |
| `ml-graph-message-preset` | wave 2 | Graph neural net message passing: pulses along edges, node state updates |

(`neural_network` — feed-forward walkthrough — already exists and stays.)

## The frozen craft API (blocks compose against THIS)

`craft_blocks/craft-blocks.mjs` exports pure builders (no mount, no
rAF, no textures fetched — geometry + materials only):

```js
buildOrbiter({ scale=1, palette })   // bus + 2 solar wings + HGA dish + engine
buildLander({ scale=1, palette })    // descent stage: 4 legs, tanks, engine bell
buildRocket({ stages=2, scale=1, palette }) // stacked stages + interstage + fairing
buildCubesat({ units=3, scale=1, palette }) // rail-edged Nu, deployable panels
buildCapsule({ scale=1, palette })   // crew capsule + service module
```

- Return: `THREE.Group`, unit-ish size (longest dimension ≈ 1×scale), origin
  at geometric center, **+X = forward/velocity, +Z = up/dish side, main
  engine thrust exits −X**.
- `palette = { body:0x…, panel:0x…, accent:0x…, metal:0x… }` optional; the
  defaults are the obsidian-champagne family. MeshStandardMaterial, restrained
  metalness/roughness — premium satin, no toy plastic, no emissive gimmicks.
- Consumers import via relative path and MUST degrade to a simple placeholder
  group if the import fails — blocks never hard-depend on each other.

## Quality bar (what "manim-grade" means here)

- Physics honest at the stated truth level; the manifest names model AND
  limitations. A Hohmann arc is a real conic; a descent profile integrates
  real gravity; optimizer trails follow the real gradient.
- Deterministic: seeds in, same frames out; `advance(dt)` external drive;
  export/reduced freeze on a documented tableau.
- One light logic per scene, palette tokens for every UI element, deck
  typography for HUDs — a block must look native inside any saved theme.
- Cameras are directed, not free-floating: every mode has a purpose and a
  smooth transition; no camera motion without explanatory value.
- Verified by SCREENSHOT, not by assertion — headless renders reviewed
  before a block is called done.
