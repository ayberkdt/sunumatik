---
name: design-space-science-deck
description: Create distinctive visual directions, semantic color systems, matte pastel or vibrant themes, typography, layouts, projector-safe palettes, and authentic HTML previews for academic, astronomy, aerospace, planetary-science, and engineering presentations. Use when a deck needs art direction, premium color combinations, a non-glass visual language, or a coherent theme; do not use to verify claims, typeset detailed equations, map Figma files, or implement the final runtime.
---

# Design Space Science Deck

Design a disciplined scientific visual system that supports meaning instead of decorating every slide with generic stars or neon.

## Read the brief

Determine venue, audience, density, projector conditions, institutional constraints, subject domain, and whether the tone should be scholarly, mission-oriented, observational, archival, or public-facing.

## Choose the color language

Read `references/color-composition.md` before proposing palettes. When the user requests the saved combinations, read `references/user-palette-pairs.md` and use `/presets/color_themes/palette-library.json` as the source of truth.

Expand one anchor pair into semantic roles rather than distributing all colors equally. Validate ordinary text at 4.5:1 or better and prefer stronger contrast for citations and difficult projectors. Keep scientific categories distinguishable without color alone.

## Generate visual previews

When direction is not fixed, generate three authentic 1920x1080 title-slide previews: one restrained matte or cream direction, one domain-specific direction, and one vibrant but feasible wildcard.

Do not render internal labels such as option, preset, preview, safe, wildcard, or template. Use actual deck title, author, institution, date, and content.

Read `references/theme-selection.md` to shortlist candidates. Then read only the selected theme file named by that index. Do not combine unrelated signature elements into a theme collage.

Use `/presets/color_themes/palette-preview.html` to inspect the saved library in a browser and `/presets/color_themes/theme-tokens.example.json` as the implementation handoff shape. The indexed theme profiles are `theme-arctic-mulberry.md`, `theme-botanical-signal.md`, `theme-cosmic-scholar.md`, `theme-cream-observatory.md`, `theme-deep-space-observatory.md`, `theme-graphite-ember.md`, `theme-lunar-archive.md`, `theme-mission-review.md`, `theme-obsidian-champagne.md`, `theme-orbital-blueprint.md`, `theme-porcelain-ink.md`, `theme-space-outreach.md`, `theme-spectral-analysis.md`, `theme-tangerine-orbit.md`, and `theme-verdigris-slate.md` under `references/`.

## Build the design system

Define tokens for surfaces, projector-safe contrast, semantic and data colors, display/body/mono/numeric/math typography, fixed-stage spacing, safe areas, panels, annotations, credits, citations, motion, and reduced-motion behavior.

Use `/presets/color_themes/palette-library.css` for implementation-ready variables. Run `scripts/validate-palette-library.mjs /presets/color_themes/palette-library.json` after editing a saved palette.

Read `references/typography-and-layout.md` for font roles, Turkish glyphs, scientific symbols, density, and layout archetypes. Prefer self-hosted WOFF2 fonts for offline delivery.

Read `references/alignment-and-grid.md` and enforce it on every layout: the 12-column grid with 64 px margins and 24 px gutters, the 8/16/24/40/64 spacing scale, shared left edges (chart PLOT AREAS align to the grid, tick labels hang outside), peer-card equal heights, and the optical corrections for icons, equations, and circular elements. Misalignment is the loudest amateur signal a slide sends.

For cards, stat tiles, definition blocks, and keyword lines, read `references/card-treatments.md` and use `/presets/color_themes/components/card-presets.css` (base/accent/stat/definition/icon variants, `.sci-panel`, `.kws`, CSS-only entrance cascade); preview with `/presets/color_themes/components/component-preview.html`.

For slide tables, read `references/table-treatments.md` and use `/presets/color_themes/components/table-presets.css` (data, comparison, matrix, and spec variants bound to the palette tokens). For reusable line-art decoration, read `references/space-motifs.md` and use the `/presets/color_themes/space-motifs/space-motifs.svg` sprite; preview it with `/presets/color_themes/space-motifs/motif-preview.html`.

For background scene decoration (ambient WebGL composites, motif fields, canvas skies), read `references/decor-layering.md`: decor yields to content (alpha and footprint budgets, hides during content-critical scenes, scrim between decor and text), uses the real scene presets through their decor modules instead of hand-drawn imitations, and gets distance from scale/position — never blur filters.

## Apply scientific art direction

Use grid lines, orbital arcs, spectral accents, instrument marks, catalog labels, archival paper, or mission chrome only when they fit the subject. Keep decorative stars sparse. Prefer opaque color planes, editorial grids, large typography, hard-edged image crops, thin rules, duotone imagery, and restrained paper texture.

Avoid glassmorphism, backdrop blur, stacked translucent cards, purple-blue-cyan AI gradients, gradient blobs, dashboard-card repetition, fake HUD clutter, neon borders, and glow that reduces legibility. Use a gradient only when it represents data, illumination, depth, or another meaningful phenomenon.

Specify motion intent only at the art-direction level. Route reusable animation or simulation behavior to `$design-scientific-motion`. Keep charts, equations, and methods stable while they are read.

## Deliver the direction

Return tokens, layout grammar, component treatments, example title/content/data/equation/closing slides, font and license notes, and an avoid-list. Do not generate the entire deck unless the build skill is also in scope.
