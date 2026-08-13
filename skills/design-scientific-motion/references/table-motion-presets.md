# Table motion presets

Files: `/presets/motion_core/table-motion.css` + `/presets/motion_core/table-motion.js`.
Style comes from design-space-science-deck's `table-presets.css`; this
preset adds MOTION only. Demos:
`design-space-science-deck/presets/color_themes/components/component-preview.html`
(row cascade / flash / emphasis) and
`/presets/motion_core/table-motion-preview.html` (cell-level fills).

## Row cascade (entrance)

Mark the table `data-table-reveal` and call `observeTableReveal()` once
per page: rows rise+fade with a 70 ms stagger when the table scrolls
into view. Gated on `html.js`; reduced-motion and export render final
state; a 6 s watchdog reveals everything if IntersectionObserver never
fires (hidden panes).

The cascade is an ENTRANCE, not a data statement — appearance order is
document order. If order should carry meaning (ranking build-up), order
the rows in the DOM and say so in the talk.

## Row flash (attention)

`flashRow(tr)` — one-shot background sweep + accent left edge for
"this row just changed / look here" moments driven by the presenter.
One row at a time; flashing rows on a timer is decorative noise.

## Column emphasis (hover)

`enableColumnEmphasis(table)` — hovering a header dims the other
columns to 45% (recede, never hide — same language as legend-linked
chart dimming in interaction-presets). Comparison tables benefit;
data tables with units columns usually do not need it.

## Column cascade (entrance, column mode)

`data-table-reveal="columns"` is the column mirror of the row cascade:
every cell (headers included) enters with opacity + translateX(-8px)→0,
delayed by its column index × 90 ms via `--col-index`. Same
IntersectionObserver + 6 s watchdog + `html.js` gating as row mode;
default (`data-table-reveal` with no value or `"rows"`) stays row mode.
`columnCascade(table)` is the imperative form: it stamps the attribute
and observes that one table.

## Cell count-up — `countCells(scope?, {duration=900, stagger=60})`

Markup: `<td data-count>1.248</td>` — the FINAL value lives in the cell
text (visible without JS). Turkish formats are parsed: `.` thousands,
`,` decimals; any prefix/suffix around the number (`%`, `ms`, `≈`) and
the decimal count are preserved (`%96,4` counts 0,0 → 96,4). Cells
count 0→value with easeOutCubic over ~900 ms, staggered by column
position × 60 ms. `tabular-nums` (in the CSS) keeps digits from
jittering. Idempotent: the original text is kept in `data-count-final`,
so re-running (presenter re-trigger) restarts from 0. Reduced motion /
export: final text set immediately.

Discipline: count-up is for TOTALS and results the presenter lands on —
one row or one column of outcomes — not every cell. A table that counts
everywhere reads as a slot machine.

## In-cell data bars — `cellBars(scope?)`

Markup: `<td data-bar="0.62">%62</td>` — value is the 0..1 share; the
readable number stays as cell text. The helper injects an absolutely
positioned layer UNDER the text (cell gets its own stacking context;
the bar sits at z-index −1, so text and padding are untouched):
left-aligned, 62% of cell height, width = share × 100%. Duotone
discipline: body at 16% opacity + a solid 2 px end edge in the full
color. Color defaults to accent; `data-bar-slot="2"` →
`--color-data-2`. On reveal bars grow scaleX 0→1 (600 ms,
transform-origin left, row-staggered by `--row-index` × 70 ms).
Reduced/export render full bars. Re-runnable: an existing bar is
updated, never duplicated.

Discipline: bars encode ONE column's share — never mix units in a
single bar column, and keep one color per column (`data-bar-slot` picks
the column's color, not per-row colors).

## Heat fill — `heatFill(scope?)`

Markup: `<td data-heat="0.72">0,72</td>` — 0..1 normalized. With an
extended palette the background interpolates along the 5-stop
`--ramp-seq-1..5` ramp (nearest stop pair, linear `color-mix` between
them, computed once from `getComputedStyle`). Without ramp vars the
fallback is accent at heat × .3 opacity. Backgrounds fade in over
500 ms with the row cascade (column slot in columns mode).
Reduced/export render final backgrounds.

Ink flip: at `heat > .55` the cell text is set to `var(--color-canvas)`
so ink stays readable on deep ramp fills (threshold lives in JS as
`.55` and is mirrored by `.sci-cell--heat-deep` in the CSS; the flip is
skipped in fallback mode, where fills never exceed 30% opacity).

Discipline: heat needs a legend or caption stating the scale ("0–1
normalized X, dark → light") — an unlabeled ramp is decoration, not
data.

```js
import { observeTableReveal, flashRow, enableColumnEmphasis,
         countCells, cellBars, heatFill, columnCascade }
  from '.../presets/table-motion.js';
cellBars();          /* fills first, so the reveal animates them */
heatFill();
observeTableReveal();
countCells();        /* or call when the presenter lands on the slide */
enableColumnEmphasis(document.querySelector('.sci-table--comparison'));
```

Order matters: run `cellBars`/`heatFill` before `observeTableReveal` so
the fill transitions ride the same `.is-revealed` trigger. On tables
without `data-table-reveal` the fills arm themselves on the next frame.

For count-ups OUTSIDE tables (hero stats, KPI callouts) keep using
`animateCount` from core-motion.js; `countCells` exists for the
cell markup contract and Turkish number formats.
