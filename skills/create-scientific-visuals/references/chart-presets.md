# Chart presets

Files: `/presets/charts_icons/chart-theme.css` (class contract) + `/presets/charts_icons/chart-preset/chart.mjs`
(declarative engine that EMITS the contract). Consumes deck palette tokens,
defines series slots 1–6.

Choose the chart form with `visual-selection.md` first; this file governs how
the chosen form is dressed and generated.

## The engine — do not hand-build SVG charts anymore

`mountChart(container, spec)` renders line/bar/scatter charts with nice-number
ticks, horizontal grid, uncertainty bands, labelled reference lines, epistemic
dash styles, direct labels, annotations with arrows, and a staggered draw-in
reveal (lines trace, bars grow from baseline, markers pop) that fires when the
chart scrolls into view. Export/reduced-motion render the final state
instantly; a 6 s watchdog finishes the reveal even when IntersectionObserver
never fires (hidden panes). Working demo: `/presets/charts_icons/chart-preset/index.html`.

```js
import { mountChart } from './chart-preset/chart.mjs';
mountChart(el, {
  type: 'line',                              // 'line' | 'bar' | 'scatter'
  x: { label: 'Derece' }, y: { label: 'Sapma', unit: 'm' },
  series: [
    { name: 'Gözlem', slot: 1, markers: true, data: [[x,y],...],
      band: [[x,lo,hi],...] },               // belirsizlik bandı
    { name: 'Projeksiyon', slot: 2, style: 'projected', data: [...] },
  ],
  refLines: [{ y: 12, label: 'görev sınırı' }],
  annotations: [{ x, y, text, dx, dy }],
});
```

Engine rules: epistemic-styled series (fitted/projected/simulated) draw as
DASHED LINES even on scatter charts — a fit rendered as points masquerades as
data. Dashed lines fade in rather than trace (tracing corrupts the dash
pattern). Hand-built SVG remains legitimate only for chart forms the engine
does not cover; it must still follow the class contract below.

## Class contract

| Region | Classes |
|---|---|
| plot root | `.sci-chart`, optional `data-hover-dim` |
| axes | `.axis`, `.axis-title`, `.axis-unit`, `.tick` |
| grid | `.grid` (horizontal hairlines; vertical only when reading exact x positions matters) |
| series | `[data-series-slot="1..6"]` wrapper; `.series-line`, `.series-marker`, `.series-bar` |
| epistemic style | `.is-fitted` (dashed), `.is-projected` (dotted), `.is-simulated` (dash-dot) on the line |
| uncertainty | `.uncertainty-band`, `.error-bar` |
| reference | `.ref-line` + `.ref-label` (a threshold is always labelled) |
| labels | `.direct-label` (preferred), `.annotation`, `.annotation-arrow` |
| legend | `.sci-chart-legend` + `.swatch` (HTML, outside the plot) |
| tooltip | `.sci-chart-tooltip` (opaque matte panel) |
| caption | `.sci-chart-caption` + `.provenance` |

## Features and rules

- **Series colors**: slots 1–2 inherit the palette's data colors; 3–6 are fixed
  fallbacks. More than 4 series on one slide is a restructuring problem, not a
  color problem.
- **Epistemic line styles**: observed data is solid; fitted, projected, and
  simulated series must switch dash pattern *and* be labelled — never encode
  epistemic status by color alone.
- **Uncertainty is default-on**: a band or error bar appears wherever the data
  has known uncertainty; omitting it is a deliberate, disclosed decision.
- **Direct labels beat legends** when there is room; the legend block exists
  for dense multi-series cases and pairs with hover dimming.
- **Hover dimming** (`data-hover-dim` or linked legend highlighting via
  `interaction-motion.js`) dims siblings to 30%, never hides them; export mode
  disables dimming and hides tooltips.
- **Count-up numbers** on stat callouts use `animateCount` from
  `design-scientific-motion//presets/charts_icons/presets/core-motion.js`; do not reimplement.
- **Typography floors**: ticks 20px, labels 22px at stage scale — below that,
  simplify the chart instead of shrinking type.
- Axis color is mixed toward canvas so data ink dominates; grid uses the rule
  token. Do not draw both a dense grid and axis ticks at full strength.
