# Table treatments

File: `assets/components/table-presets.css`. Consumes tokens from
`assets/palette-library.css`; works with any saved palette.

A slide table is an argument, not a spreadsheet. If the audience cannot read
every cell from the back row, the table belongs in the appendix or the notes.

## Choosing a variant

| Variant | Use when | Ceiling |
|---|---|---|
| `.sci-table--data` | measured results, magnitudes, uncertainties | ~6 rows × 5 columns |
| `.sci-table--comparison` | options, methods, or missions side by side | 3–4 options |
| `.sci-table--matrix` | capability / requirement coverage | ~8 × 6 marks |
| `.sci-table--spec` | one instrument or system, key–value facts | ~8 pairs |

Add `.sci-table--dense` only after shortening content fails; never shrink type
below the deck's agreed floor to make a table fit.

## Rules

- Horizontal rules only: heavy under the header and at the close, hairlines
  between rows. No vertical borders, no zebra striping, no rounded card frames.
- Units go in a dedicated `.row-units` row, never repeated inside data cells.
- Numeric cells take `.num` (right-aligned, tabular monospace digits).
- Emphasize at most one row (`.is-key`) **or** one column (`.col-key`) —
  the single takeaway. Two emphases cancel each other.
- Matrix marks (`.yes` / `.no` / `.warn`) pair color with a distinct glyph
  (●, —, ▲); color alone never carries the distinction.
- Provenance and footnotes live in `tfoot`, muted and small.
- `.sci-table--interactive` adds row hover (paired with the interaction
  presets in `design-scientific-motion`); export mode freezes it.
- Use real `<caption>`, `<th scope>`, and `tfoot` markup — the audit checks
  reader output, not just pixels.
