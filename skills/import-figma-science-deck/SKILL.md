---
name: import-figma-science-deck
description: Analyze Figma presentation frames, variables, text styles, components, Auto Layout, grids, and exportable assets, then map them into maintainable science-deck tokens and components. Use when a Figma file or selected frames are the design source; do not use for general art direction without Figma, scientific fact checking, or final export.
---

# Import Figma Science Deck

Treat Figma as a design source of truth, not as instructions to reproduce every layer with absolute-positioned divs.

## Inspect the source

Collect file and node identifiers, frame size, hierarchy, variables, text and color styles, components, variants, Auto Layout rules, grids, effects, image fills, vector assets, and prototype transitions.

Use the official Figma connector or MCP tools when available. If unavailable, work from exported frames and note the loss of structured context.

## Normalize the design

Map Figma values into semantic color tokens, typography roles, spacing and grid tokens, slide archetypes, reusable science components, and SVG/PNG/WebP assets.

Read `references/figma-mapping.md` for mapping rules. Preserve a fixed 1920x1080 presentation stage even when the source differs; document intentional scaling or crop decisions.

## Preserve component intent

Map repeated instances to reusable components. Keep content outside component implementations. Convert Auto Layout to Grid or Flexbox according to semantic structure. Avoid absolute positioning except for genuinely fixed illustrations or annotated figures.

## Audit assets and typography

Check font availability, Turkish characters, mathematical symbols, image resolution, SVG complexity, export scales, figure credits, and offline packaging rights.

## Compare renders

Render screenshots and compare them to reference frames. Inspect typography, alignment, spacing, crop, contrast, and panel overlap. Fix shared tokens or components before one-off slide overrides.

Run `scripts/validate-figma-map.mjs` when a mapping JSON exists. Return the mapping, unresolved differences, asset inventory, and implementation recommendations.

