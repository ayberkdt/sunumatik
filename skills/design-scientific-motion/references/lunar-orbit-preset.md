# Lunar Orbit Preset

Use `/presets/lunar_orbit/index.html` for a dependency-free 2.5D presentation preset. Use `/presets/lunar_orbit/LunarOrbitPreset.tsx` with `lunar-orbit-model.mjs` when the deck already uses React Three Fiber.

## Scientific model

The preset is an analytic two-body Keplerian model centered on the Moon. It uses:

- lunar mean radius: 1737.4 km;
- lunar gravitational parameter: 4902.800 km³/s²;
- linearly increasing mean anomaly;
- Newton iteration for eccentric anomaly;
- rotations for inclination and longitude of ascending node.

Authoritative constants:

- JPL Planetary Satellite Physical Parameters: https://ssd.jpl.nasa.gov/sats/phys_par/sep.html
- JPL Lunar Constants and Models: https://ssd.jpl.nasa.gov/doc/lunar_constants_and_models.html

Always display the label “Analytic two-body model” and retain a limitation note. This is not a high-fidelity NRHO, mission design, or navigation propagator. It omits lunar mascons and high-degree gravity, Earth and solar perturbations, station keeping, finite burns, spacecraft attitude, and terrain collision.

## Parameters

- `meanAltitudeKm`: semimajor axis minus the mean lunar radius.
- `eccentricity`: constrained to 0–0.7 in the reusable preset.
- `inclinationDeg`: orbital inclination.
- `ascendingNodeDeg`: longitude of ascending node.
- `timeScale`: simulated seconds per real second.
- `exportProgress`: fixed phase from 0 to 1 for export.

Use a numerical or mission-ephemeris preset instead when a claim depends on real trajectory geometry, perilune timing, frozen-orbit behavior, eclipse windows, or operational maneuver design.

## Relationship to the full Lunaris preset

This lightweight preset is the dependency-free analytic option. It does not replace the high-fidelity visual treatment. Use `references/moon_react_source.md` when the presentation needs the original Lunaris textures, displacement map, bloom, star field, interactive camera, spacecraft model, prediction trail, or burn animation.

Its Moon texture remains procedural and explicitly illustrative; its orbit geometry is analytic. Keep it when portability and scientific parameter control matter more than cinematic detail.

## Integration

Keep the simulation as one slide component, not the deck’s navigation runtime. Pause it when the slide is inactive. Hide controls marked `data-export-hide` during export. Pair the interactive view with a static caption that states the selected altitude, eccentricity, inclination, period, and model limitations.
