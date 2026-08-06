# Card and container treatments

File: `/presets/color_themes/components/card-presets.css`. Consumes palette tokens;
works on light and dark palettes. Demo: `/presets/color_themes/components/component-preview.html`.

## When a card, when not

A card GROUPS one self-contained unit: a stat with its base, a
definition, one option in a comparison, one pipeline stage. Do NOT card
things that are really a list (use `.kws` lines), body prose (plain
text on canvas), or a lone visual (cards around figures add chrome, not
meaning). More than ~5 cards on a slide means the content wants a table.

## Anatomy and variants

- `.sci-card` — base: flat vertical surface gradient, hairline border,
  radius 12, hover border+shadow lift.
- `.sci-card--accent` + `--card-accent` — ONE accent signature: the
  gradient side bar. Set `--card-accent` to a palette data color to
  build families (e.g. model A cards vs model B cards).
- `.sci-card--stat` — `.sci-card__value` (mono, tabular), `__unit`,
  `__delta`. The delta line is MANDATORY copy: a number without its
  comparison base fails the assertion tests.
- `.sci-card--definition` — `__term` (accent) + `__body`.
- `.sci-card--icon` — 56 px icon slot; icons come from
  create-scientific-visuals' sprite.
- `.sci-panel` — quiet grouping without card chrome (use when the group
  needs a boundary but not emphasis).
- `.kws` — keyword LINES with predicates ("· " separated short clauses).
  This is the anti-confetti form: `write-assertive-slide-copy` rules
  apply to every line.

## Hard rules (learned; do not regress)

- Flat vertical gradient only. Radial accent-tinted washes read as mud
  on projectors (removed after live review — keep it removed).
- The accent appears in ONE feature per card (side bar OR icon tint OR
  term color as the variant defines) plus hover. Accent backgrounds +
  accent borders + accent text together are noise.
- Hover lifts border/shadow only — never scale a text container.
- Peer cards share top edge and height (`alignment-and-grid.md`).
- Entrance: wrap the card group in `data-card-cascade` — CSS-only
  stagger, gated on `html.js`, disabled for reduced-motion/export.
- Card copy budget: kicker ≤ 3 words, title ≤ 8, body ≤ 2 lines at
  22 px. Longer content is not a card.
