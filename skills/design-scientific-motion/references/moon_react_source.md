# Lunaris Interactive Preset

Use `/presets/moon_react_source/` when a lunar presentation needs the strongest interactive visual option. The folder is a runnable Next.js example and a portable React component set.

## What is preserved

The preset carries over the defining pieces of the local `lunaris-web` simulator:

- aesthetic and gravity texture modes;
- lunar displacement mapping and relief control;
- high-segment Three.js Moon geometry;
- orbit camera drag and zoom;
- optional automatic camera rotation;
- star field and post-processing bloom;
- 1200-sample trajectory playback;
- fading historical trail and predicted future path;
- modeled spacecraft body, solar panels, antenna, and engine bell;
- prograde/retrograde attitude slews;
- animated burn plume, hot core, and point light.

The port improves the original frame loop by updating React trail and prediction state only when the trajectory sample changes, while keeping spacecraft interpolation and attitude motion on render-object refs.

## Vanilla port (no React required)

`/presets/moon_advanced/` carries the same experience on plain Three.js
for static HTML decks: `lunaris-moon.mjs` (mountLunaris), vendored
three@0.184 + OrbitControls + fat-line + UnrealBloom modules under `vendor/`,
and a standalone `index.html` demo. Full feature parity: both texture modes,
relief control, halo, seeded stars, bloom, orbit camera with auto-rotate and
reset, 1200-sample playback, fading trail, per-sample prediction, the complete
spacecraft model, retrograde attitude slews, flickering burn plume and light,
telemetry, controls, Space/R/Esc, fullscreen, loading/error states, and the
same export/reduced-motion freezes. The consuming page must define the import
map `{"imports": {"three": ".../vendor/three.module.min.js"}}` before any
module script, link `components/moon_react_source.css` from the React
preset, and point `assetBaseUrl` at `public/lunaris`. `setActive(false)` when
the slide is not visible; the module also pauses itself while the document is
hidden. The figure carries `data-owns-keys` so deck runtimes can leave Space
to the scene.

## Integrate

Copy the whole preset folder when a runnable example is useful. Run `npm install`, then `npm run dev`, `npm run typecheck`, or `npm run build` from that folder.

For an existing React, Vite, or Next.js deck:

1. Copy `components/` into the project.
2. Copy `public/lunaris/` into the project public directory.
3. Install `three`, `@react-three/fiber`, `@react-three/drei`, `postprocessing`, and `@react-three/postprocessing`.
4. Render `LunarisInteractivePreset` inside a fixed-size slide region.

```tsx
import LunarisInteractivePreset from './components/LunarisInteractivePreset';

export function LunarSimulationSlide() {
  return <LunarisInteractivePreset
    title="A spacecraft does not follow one lunar gravity field"
    visualStyle="cinematic"
    accent="#00e5ff"
    active
  />;
}
```

Set `active={false}` when the slide is not visible. Use `visualStyle="matte"` and a theme accent when the cinematic cyan treatment does not fit the deck.

## Controls and export

The visible controls cover surface mode, relief, playback speed, pause, restart, camera reset, automatic camera, prediction, trail, stars, bloom, and fullscreen. Keyboard controls are Space, R, and Escape.

The component detects `?export=1` or `html[data-export="true"]`. Export mode freezes progress at 0.18, hides controls and stars, and preserves the model-status caption. `prefers-reduced-motion` uses the same fixed trajectory state and stops Moon and camera rotation.

## Scientific status

Always retain the visible label “Illustrative trajectory playback.” The imported path and burn windows are the visual prototype from the user’s local Lunaris project. They are not a mission ephemeris, NRHO solution, navigation product, or high-fidelity lunar force-model propagation.

Use the lightweight analytic preset for parameter-driven Keplerian explanation. Use verified ephemerides or a documented numerical solver when the slide makes claims about a real mission trajectory, perilune timing, stability, station keeping, or maneuver magnitude.

## Provenance

Read `/presets/moon_react_source/asset-provenance.json` for source paths, byte counts, and SHA-256 hashes. Validate `/presets/moon_react_source/motion-manifest.json` before changing the truth label, export state, or control behavior.
