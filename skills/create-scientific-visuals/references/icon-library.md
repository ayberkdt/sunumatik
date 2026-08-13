# Icon library

Two tiers, two jobs — do not mix their visual languages in one list:

1. **Duotone science set** (`/presets/charts_icons/icons/science-icons.svg`, 23 icons): the
   hand-drawn hero tier for section tags, agenda rows, and title-adjacent
   marks. Rules below.
2. **Domain set** (`/presets/charts_icons/domain-icons/`, 172 icons, added 2026-08): the
   SUBJECT tier, drawn in the same duotone hand as tier 1, covering the topics
   these decks actually argue about — mathematics (28), signals & control (30),
   physics (24), astrodynamics (30), rockets & satellites (30), machine
   learning (18), astronomical objects (12). Sprite `domain-icons.svg`
   (`<use href="...#i-hohmann-transfer">`), searchable TR+EN `manifest.json`
   with a `family` per icon, and `preview.html` with family chips + live filter.
   These icons make SCIENTIFIC CLAIMS: an elliptical orbit puts the primary at
   a focus, a hyperbolic trajectory does not close, prograde and retrograde use
   the real nav-ball markers, a Bode magnitude falls after the corner. If you
   extend the set, keep that contract — a pretty lie is worse than a plain box.
   Reviewed icon-by-icon in a rendered collage (2026-08-13); nine were redrawn
   after reading wrong at 24px (a contour integral that looked like a dollar
   sign, nested sets that looked like a camera, transfers that looked like an
   eye chart).

3. **Utility library** (`/presets/charts_icons/icon-library/`, 168 icons, added 2026-08):
   curated from Lucide (159, ISC), Tabler (8, MIT), Phosphor (1, MIT) —
   coherent 24x24 stroke-2 outline grammar, normalized to `currentColor`,
   no fixed width/height. Use for arrows, chevrons, status (check/alert/info),
   time, navigation, charts, data, and everything the duotone set lacks.
   - `sprite.svg` — `<use href="...#i-rocket">`; inline the sprite for file://.
   - `manifest.json` — searchable Turkish+English tags per icon.
   - `preview.html` — dark-stage grid with live filter and click-to-copy.
   - `licenses/` — verbatim license texts; keep them when redistributing.
   Utility icons take the same sizing/aria rules as the duotone set. In one
   context (a card row, a rail) use ONE tier only. Tier 1 and 2 share a hand
   and may be mixed freely; tier 3 is a different language — keep it for
   plumbing (arrows, status, navigation) and never next to a domain icon
   inside the same list.


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
