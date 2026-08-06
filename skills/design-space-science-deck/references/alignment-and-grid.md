# Alignment and grid discipline

Misalignment is the loudest "amateur" signal a slide can send — louder
than any palette or animation choice. These rules make alignment
systematic instead of eyeballed. They bind every layout this skill
produces and everything build-html-science-deck implements.

## The grid

- 12-column grid on the 1920×1080 stage: 64 px outer margins, 24 px
  gutters. Content spans whole columns; two content blocks on one slide
  share column edges, not approximate positions.
- Vertical rhythm uses a fixed spacing scale — 8 / 16 / 24 / 40 / 64 px.
  No 13 px here and 17 px there: if two gaps look similar they must BE
  identical; if different, differ by at least one scale step (obvious on
  purpose).
- One alignment axis per slide dominates. Default: strong shared LEFT
  edge for text, top edge for side-by-side panels. Centering is for hero
  moments (title, lone equation, lone figure) — never for bullet groups
  or mixed content.

## Shared-edge rules

- Headline, body, cards, chart plot area (not the axis labels' outer
  box), and table left rule all sit on the same left grid line.
- Side-by-side cards: identical top edge, identical height when they are
  peers (grid `align-items: stretch`, equal rows). A shorter "peer" card
  reads as a mistake, not as economy.
- Captions align to the LEFT EDGE OF THE VISUAL they describe, not the
  slide margin, when the visual is inset.
- Numbers in tables and stat groups right-align on tabular figures;
  units live in the header or after the number consistently, never mixed.

## Optical corrections (where mathematical alignment looks wrong)

- Icons and triangles: align by optical center, not bounding box —
  nudge 1–3 px toward the heavy side.
- Display equations: align on the BASELINE of the main line (equals
  signs of stacked equations share one x-position; `align` environments,
  not manual spaces).
- Text next to a card edge needs more inset than text under text
  (the card border adds visual weight): minimum 24 px card padding.
- Circular elements (dots, moon/planet decors) overshoot the grid line
  by ~2% of their diameter to LOOK aligned.

## Common misalignments and their fixes

| Symptom | Fix |
|---|---|
| Ragged left edges across sections | one grid line for all text blocks; kickers/titles/body share it |
| Chart looks indented vs its headline | align the PLOT AREA's left edge to the grid (the y-tick labels hang OUTSIDE the line, like hanging punctuation) |
| Cards almost-equal height | same grid row + stretch; move overflow to notes |
| Labels drifting from targets | anchor labels to the target coordinate, not absolute stage positions |
| Two columns whose gutters differ | 24 px gutter token everywhere |
| Vertically "floating" content | the content block's vertical center sits at 46–50% of the stage; footers pin to the bottom margin line |

## Validation

Before shipping, run the audit's alignment pass (audit-checklist.md):
screenshot at 100%, overlay the 12-column grid (any grid bookmarklet or
the deck's debug grid if present), and check every left edge, gutter,
and peer-height pair. Alignment bugs found rendered are STILL layout
bugs — fix the layout rule, not the instance, so the fix holds for the
next slide.
