# Equation writing preset

Files: `/presets/equation_pen/` — `equation-writing.mjs`,
`equation-writing.css`, `index.html` (demo), `motion-manifest.json`.

Reveals an equation the way a lecturer writes it: token by token in reading
order, with a pen that behaves like a hand — it lifts off the paper and arcs
between tokens (pen-up), touches down with a forward tilt, rides across each
token in sync with the ink while bobbing and tilting (pen-down sweep), and on
`data-stroke` paths physically traces the stroke via `getPointAtLength`. Ink
appears as a stepped, slightly uneven wipe with a fresh-ink opacity settle,
and wider tokens take proportionally longer — writing speed follows ink, not
token count. The effect paces the audience through mathematics; it never
reorders, generates, or emphasizes mathematics on its own.

## Ink units

Tag the atoms of writing with `data-ink` inside a `.eq-write` root:

- **HTML tokens** — spans wrapping meaningful chunks (`T²`, `=`, `4π²`). For
  KaTeX/MathJax output, wrap at the term level you would speak aloud; do not
  split below what a hand would write in one motion.
- **SVG text/paths** — `<text data-ink>` reveals like a token; a path with
  `data-ink data-stroke` draws its stroke with dashoffset (integral signs,
  annotation arrows, underlines).
- Document order is the default; explicit `data-ink="3"` numbering overrides.

## API

```js
import { writeEquation, writeSequence } from './equation-writing.mjs';
const run = writeEquation(root, { unitDuration: 240, gap: 70, pen: true });
const seq = writeSequence([step1, step2, step3], { stepGap: 420 });
run.finished; run.cancel(); run.settle();   // settle = jump to complete state
```

## Rules

- Chunk at speech level: one `data-ink` per spoken phrase of the equation.
  Writing letter-by-letter reads as a typewriter gimmick, not a hand.
- Write one equation at a time; the audience reads at writing speed, so
  narrate while it writes and pause (`stepGap`) between derivation steps.
- The root keeps a complete spoken-language `aria-label`; the animation never
  carries meaning that the settled equation lacks.
- Escape (wire it) and `settle()` must always be available to the presenter.
- Export and reduced motion render the finished equation with no pen and no
  partial ink — verified by the audit's deterministic screenshot.
- Get the TeX itself from `$typeset-tex-equations`; this preset only animates
  approved, rendered output. Declared as `type: "reveal"` in the manifest.
