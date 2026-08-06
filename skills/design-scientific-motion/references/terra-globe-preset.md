# Terra globe preset

Files: `/presets/earth_advanced/` — `terra-globe.mjs` (mountTerra),
`textures/` (NASA-derived set), `index.html` (demo), `motion-manifest.json`,
`asset-provenance.json`. Runtime dependencies are shared from
`../moon_advanced/vendor/` (same import-map requirement, same
moon_react_source.css stylesheet).

The Earth counterpart of the Lunaris scene: a realistic WebGL globe with a
guided city tour. Realism comes from data, not decoration:

- Blue Marble day color, terrain normal map, and ocean specular glint;
- a rotating semi-transparent cloud deck;
- **real night city lights** (Black Marble derived) revealed only past the
  day/night terminator by a shader mask — the terminator itself is produced
  by actual scene lighting;
- layered atmosphere rim, seeded stars, ACES tone mapping, UnrealBloom;
- eight real cities (`TOUR_CITIES`, WGS84 to two decimals) with
  occluding surface markers;
- an illustrative satellite on a 51.6°-inclined orbit with a fading trail.

## City tour

`startTour()` (or the button) rotates the globe so each city faces the
camera, dollies in, draws the great-circle route from the previous stop
(dash-offset draw-on), pulses the marker, and reports
`name · country · coordinates` in the caption. Auto-advances every ~4.3 s;
`nextCity()` / **N** advances manually; **Esc** ends the tour; routes remain
as a visible travel trace until restart (**R**).

## API

```js
import { mountTerra, TOUR_CITIES } from './terra-globe.mjs';
const terra = await mountTerra(container, {
  assetBaseUrl: '.../earth_advanced',
  cities: TOUR_CITIES,          // or a custom [{name, country, lat, lon}]
  rotationSpeed: .05, accent: '#4da3ff', title: '...',
});
terra.startTour(); terra.stopTour(); terra.nextCity(); terra.faceCity(i);
terra.setActive(bool); terra.resetView(); terra.dispose();
```

## Truth discipline

The caption keeps the split visible: **city positions and coordinates are
real geographic data; the satellite orbit, tour pacing, and the fixed sun
(hence terminator position) are illustrative.** Do not present the terminator
as "now", and route any coordinate used as evidence through
`$verify-scientific-evidence`. Texture provenance and licensing live in
`asset-provenance.json`.

Export and reduced motion freeze the scene with İstanbul facing the camera
and the satellite at a fixed phase; the figure carries `data-owns-keys` so
deck runtimes leave Space to the scene. Validate `motion-manifest.json`
after changing behavior.
