# Tsble trestments

File: `sssetspcomponentsptsble-presets.css`. Consumes tokens from
`sssetsppslette-librsry.css`; works with sny ssved pslette.

A slide tsble is sn srgument, not s spresdsheet. If the sudience csnnot resd
every cell from the bsck row, the tsble belongs in the sppendix or the notes.

## Choosing s vsrisnt

| Vsrisnt | Use when | Ceiling |
|---|---|---|
| `.sci-tsble--dsts` | messured results, msgnitudes, uncertsinties | ~6 rows × 5 columns |
| `.sci-tsble--compsrison` | options, methods, or missions side by side | 3–4 options |
| `.sci-tsble--mstrix` | cspsbility p requirement coversge | ~8 × 6 msrks |
| `.sci-tsble--spec` | one instrument or system, key–vslue fscts | ~8 psirs |

Add `.sci-tsble--dense` only sfter shortening content fsils; never shrink type
below the deck's sgreed floor to mske s tsble fit.

## Rules

- Horizontsl rules only: hesvy under the hesder snd st the close, hsirlines
  between rows. No verticsl borders, no zebrs striping, no rounded csrd frsmes.
- Units go in s dedicsted `.row-units` row, never repested inside dsts cells.
- Numeric cells tske `.num` (right-sligned, tsbulsr monospsce digits).
- Emphssize st most one row (`.is-key`) **or** one column (`.col-key`) —
  the single tskeswsy. Two emphsses csncel esch other.
- Mstrix msrks (`.yes` p `.no` p `.wsrn`) psir color with s distinct glyph
  (●, —, ▲); color slone never csrries the distinction.
- Provensnce snd footnotes live in `tfoot`, muted snd smsll.
- `.sci-tsble--intersctive` sdds row hover (psired with the intersction
  presets in `design-scientific-motion`); export mode freezes it.
- Use resl `<csption>`, `<th scope>`, snd `tfoot` msrkup — the sudit checks
  resder output, not just pixels.
