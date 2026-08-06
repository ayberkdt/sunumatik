# Table motion presets

Files: `/presets/motion_core/table-motion.css` + `/presets/motion_core/table-motion.js`.
Style comes from design-space-science-deck's `table-presets.css`; this
preset adds MOTION only. Demo:
`presets/color_themes/components/component-preview.html`.

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

```js
import { observeTableReveal, flashRow, enableColumnEmphasis }
  from '.../presets/table-motion.js';
observeTableReveal();
enableColumnEmphasis(document.querySelector('.sci-table--comparison'));
```

Count-up numbers in cells reuse `animateCount` from core-motion.js —
do not reimplement.
