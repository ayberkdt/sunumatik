# Chart presets

Files: `/presets/charts_icons/chart-theme.css` (class contract) + `/presets/charts_icons/chart-preset/chart.mjs`
(declarative engine that EMITS the contract). Consumes deck palette tokens,
defines series slots 1–6.

Choose the chart form with `visual-selection.md` first; this file governs how
the chosen form is dressed and generated.

## The engine — do not hand-build SVG charts anymore

`mountChart(container, spec)` renders line/bar/scatter/violin charts with nice-number
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

### Violin (distribution) charts

```js
mountChart(el, {
  type: 'violin',
  y: { label: 'Kalıntı', unit: 'mm' },
  series: [
    { name: 'Model A', slot: 1, values: [/* ham sayılar */] },
    { name: 'Model B', slot: 2, values: [...] },
  ],
});
```

One violin per series entry; the series `name` becomes the category label on
x, all violins share the y scale. The shape is a **Gaussian KDE** with
Silverman bandwidth `h = 0.9 · min(σ, IQR/1.34) · n^(-1/5)`, evaluated at 48
even y-points over `[min−h, max+h]` — deterministic, no randomness. Inside:
quartile box (Q1–Q3), whisker to the 5/95 percentiles, median as the solid
dot; percentiles use linear interpolation (R-7). Fill obeys the band law
(series hue ≤ .18 opacity), outline 1.5 px in the slot color.

**Honesty note — width normalization**: every violin is scaled to its own
maximum density, sharing only the cap (0.72 × slot width). Widths are NOT
comparable across violins; only shape and vertical position are. Say so in
the subtitle or caption when the comparison could be misread. Reveal: each
violin grows horizontally from its centerline (~90 ms stagger), then
box/whisker/median fade in; export/reduced-motion jump to the final frame.

### Scatter animations and `morphTo`

Scatter pop-in is data-order: each point appears ~14 ms after the previous
one (the step shrinks so the total stays ≤ 1.2 s), scaling 0→1 with a small
(~6%) overshoot.

```js
const chart = mountChart(el, { type: 'scatter', x: { min: 0, max: 13 },
  y: { min: 0, max: 11 }, series: [{ name: 'Koşu', slot: 1, data: A }] });
await chart.morphTo([{ data: B }], { duration: 650 });  // Promise
```

`morphTo(patch, {duration=650})` updates series data in place: `patch[si]`
(`{data}` or a plain array) applies to series `si`; omitted indices are left
alone. Existing points matched **by index** glide (cx/cy transition), removed
points fade out, added points pop in (`.pt` class). Bars glide via a height
scale; a line series redraws with a 300 ms opacity crossfade (a path `d`
cannot tween). Violin morph is not supported. **Axes never rescale during a
morph** — pin the domain with `x/y min/max`, or accept points sliding
off-plot. Index matching asserts identity: if old point *i* and new point *i*
are not the same entity, the glide fabricates continuity. Reduced-motion and
export apply the new data instantly.

### `sheen(seriesIndex)` — the legal "ışıltı"

Presenter-triggered ONE-SHOT attention sweep: on a line, a short bright
segment (`color-mix` of the slot color with 60% white) travels the path once
over ~900 ms and fades; on scatter, one expanding ring per point (20 ms
stagger); on a violin, a single outline brightness pulse. The overlay node is
removed when the animation ends. Discipline: **at most once per claim**,
always presenter-triggered (a click/keystroke, never a timer or loop); it is
a pointer, not evidence — if the emphasis IS the claim, use an annotation or
reference line instead. No-op under reduced motion and in export mode. This
parallels the table `flashRow` grammar; the no-continuous-glow law
(chart-aesthetics.md) still stands.

## Class contract

| Region | Classes |
|---|---|
| plot root | `.sci-chart`, optional `data-hover-dim` |
| axes | `.axis`, `.axis-title`, `.axis-unit`, `.tick` |
| grid | `.grid` (horizontal hairlines; vertical only when reading exact x positions matters) |
| series | `[data-series-slot="1..6"]` wrapper; `.series-line`, `.series-marker`, `.series-bar` |
| epistemic style | `.is-fitted` (dashed), `.is-projected` (dotted), `.is-simulated` (dash-dot) on the line |
| uncertainty | `.uncertainty-band`, `.error-bar` |
| violin | `.violin-shape` (band-law fill + 1.5px outline), `.violin-box`, `.violin-whisker`, `.violin-median` (on `.series-marker`) |
| morph/sheen | `.pt` (pop-in transition for added points), `.sheen-overlay`, `.sheen-outline`, `.sheen-ripple` (engine-created, self-removing) |
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
  `design-scientific-motion/presets/motion_core/core-motion.js`; do not reimplement.
- **Typography floors**: ticks 20px, labels 22px at stage scale — below that,
  simplify the chart instead of shrinking type.
- Axis color is mixed toward canvas so data ink dominates; grid uses the rule
  token. Do not draw both a dense grid and axis ticks at full strength.
