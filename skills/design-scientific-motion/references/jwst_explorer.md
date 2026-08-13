# JWST explorer preset

Interactive exploration of REAL James Webb Space Telescope release imagery:
a spring camera pans/zooms across the published JPEG, numbered points of
interest carry assertion captions sourced from official release text, and a
draggable curtain compares Webb against Hubble (or NIRCam against MIRI) on
the same target with one shared camera. Files:
`/presets/jwst_explorer/` — `jwst-explorer.mjs` (module, no deps),
`images/` (downloaded releases + `manifest.json` + license notes),
`index.html` (gallery demo), `motion-manifest.json`.

## Truth level

Data-driven: these are the official representative-color release JPEGs, not
calibrated FITS. Point-of-interest notes quote release captions (each has a
`src` field in the manifest); never add a science claim that is not in the
release text — route new claims through verify-scientific-evidence.

## Use

```js
import { mountJwstExplorer } from '.../jwst-explorer.mjs';
const ex = await mountJwstExplorer(host, { entry });  // entry = manifest kaydı
ex.goTo(2);          // 2. ilgi noktasına süzül; 0/overview() = genel bakış
await ex.compare(pairEntry);  // perdeyi aç; compare(null) kapatır
```

- Pointer: drag pans, wheel zooms toward the cursor, double-click zooms 2.4×.
- Keyboard (figure focused): ←/→ steps points of interest, `0`/Esc overview.
- In a deck, drive `goTo(n)` from the slide's stage machine — one point per
  presenter step, exactly like figure-callout stages.

## Rules

- **Credit is not optional.** The manifest `credit` line renders permanently
  bottom-right; CC BY 4.0 (ESA/Webb) requires it. Keep it in exports too.
- Comparison pairs share ONE camera so structures stay locked under the
  curtain; markers hide while the curtain is open (two attention systems
  may not compete).
- Reduced motion: camera jumps, no inertia. Export: overview frame, all
  markers visible, HUD hidden (wired in module CSS + STATIC gate).
- The explorer is a FIGURE, not a background — it sits in the content
  region with a visible border, never behind text.
- Choosing an image: match the target to the argument (deep field for
  cosmology, Pillars for star formation); never use a JWST image as generic
  decoration on an unrelated slide — that is the decor-discipline rule.
