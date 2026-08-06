# Icon library

v2 (2026-08): the set is DUOTONE — every icon pairs a soft currentColor fill layer (opacity .16) with 1.8 px rounded strokes on a 24 px grid, plus one solid-fill focal detail (antenna dot, nucleus, needle hub). New icons must follow this language; single-weight thin liners read weak next to the set.

File: `/presets/charts_icons/icons/science-icons.svg` (symbol sprite).
Preview: `/presets/charts_icons/icons/icons-preview.html`.

Functional wayfinding marks for agenda rows, section tags, callouts, method
badges, and footers. Icons are not illustrations and never replace a chart,
diagram, or number.

## Set

v2 (2026-08): the set is DUOTONE — every icon pairs a soft currentColor fill layer (opacity .16) with 1.8 px rounded strokes on a 24 px grid, plus one solid-fill focal detail (antenna dot, nucleus, needle hub). New icons must follow this language; single-weight thin liners read weak next to the set.

`i-telescope` `i-satellite` `i-rocket` `i-orbit` `i-planet` `i-moon` `i-star`
`i-spectrum` `i-wave` `i-atom` `i-molecule` `i-microscope` `i-flask`
`i-chart-bars` `i-chart-scatter` `i-database` `i-chip` `i-neural-net`
`i-gauge` `i-milestone` `i-warning` `i-info` `i-citation`

## Usage

v2 (2026-08): the set is DUOTONE — every icon pairs a soft currentColor fill layer (opacity .16) with 1.8 px rounded strokes on a 24 px grid, plus one solid-fill focal detail (antenna dot, nucleus, needle hub). New icons must follow this language; single-weight thin liners read weak next to the set.

```html
<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
  <use href="/presets/charts_icons/icons/science-icons.svg#i-atom"/>
</svg>
```

- 24×24 grid, 1.8px stroke, round caps, `currentColor` — icons inherit the
  text color next to them and stay legible on any saved palette.
- Render at 24–48px. One size per context; do not mix scales in a list.
- Decorative placements take `aria-hidden="true"`. A load-bearing icon (the
  only carrier of a meaning, e.g. `i-warning` on a caveat) needs a text label
  or `<title>` inside the referencing `<svg>`.
- Inline the sprite once per document for `file://` delivery; external `<use>`
  needs http(s).
- Extending the set: same grid, same stroke, geometric construction, no fills
  except sub-2px dots; add the id here and to the preview page.
