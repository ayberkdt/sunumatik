---
name: create-scientific-visuals
description: Design and generate scientifically honest charts, uncertainty graphics, orbital plots, spectra, light curves, maps, mission timelines, system diagrams, and explanatory visuals for presentations. Use when data or a scientific mechanism must become a visual; do not use for decorative theme design, TeX equation layout, citation verification, or deck runtime implementation.
---

# Create Scientific Visuals

Choose a visual form that answers a named scientific question and preserves data meaning.

## Classify the visual

Decide whether the task is comparison, distribution, relationship, change over time, uncertainty, spatial position, hierarchy, process, orbit, mission architecture, or explanatory illustration.

Read `references/visual-selection.md` before choosing a chart or diagram. Read `references/space-science-visuals.md` for orbit, ground track, spectrum, light curve, sky map, subsystem, link budget, and mission-timeline conventions. Read `references/neural-network-visuals.md` for network architecture diagrams, cell/activation encoding, and training-result graphics.

## Protect scientific integrity

Preserve units, sample sizes, uncertainty, missing data, detection limits, coordinate systems, transformations, and relevant baselines. Label logarithmic scales. Do not truncate axes or smooth data without disclosure. Distinguish observed points, fitted models, simulations, and projections.

Use a color-blind-safe palette and redundant encodings when series distinctions matter. Do not rely on red versus green alone.

## Build for presentation

Use one primary message per visual. Remove nonessential chrome, but retain axes, units, uncertainty, and provenance required to interpret the result. Create a short visual summary and accessible description.

Prefer SVG for diagrams and line art, Canvas/WebGL for large interactive scenes, and high-resolution raster images for telescope imagery or dense fields. Use Three.js or similar tools only when 3D materially improves comprehension.

When time, state, propagation, or user-controlled parameters are essential, hand the visual specification to `$design-scientific-motion`. Keep a static fallback and state whether the moving result is illustrative, analytic, numerical, or data-driven.

## Coordinate with the deck

Use theme tokens for type, annotation, and semantic colors while protecting scientific data colors. Keep the final visual inside the fixed safe area and reserve space for caption, credit, and key takeaway.

Style SVG charts with `/presets/charts_icons/chart-theme.css` and follow `references/chart-presets.md` for the class contract: axes, grids, series slots, epistemic line styles, uncertainty bands, reference lines, direct labels, legend, tooltip, and hover dimming. Then apply `references/chart-aesthetics.md` — the HARMONY rules that make charts look designed, not assembled: palette-token color semantics (observed=data-1, model=data-2, thresholds=accent; a hue never appears without a meaning), band styling (parent hue ≤ .18 opacity), mark and dash specs, assertion titles, direct-label placement, draw-in-only motion (no glow on data marks), and light/dark palette verification. For wayfinding icons, read `references/icon-library.md` and use the `/presets/charts_icons/icons/science-icons.svg` sprite; preview it with `/presets/charts_icons/icons/icons-preview.html`.

Run `scripts/validate-visual-spec.mjs` when a structured visual specification exists. Return source data references, transformation notes, visual code or asset, accessible description, and any interpretation limitations.
