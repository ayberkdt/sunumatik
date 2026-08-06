# Audit checklist

## Scientific integrity

- [ ] Every consequential claim traces to evidence.
- [ ] Observation, inference, hypothesis, and projection are distinguishable.
- [ ] Units, uncertainty, sample sizes, scales, and transformations are shown.
- [ ] Figures and media have valid credits and reuse status.
- [ ] Equation IDs, notation, and symbol definitions are consistent.

## Visual rendering

- [ ] No clipped text, equations, legends, labels, or citations.
- [ ] No panel, annotation, or absolutely positioned overlap.
- [ ] Images use intentional crop and adequate resolution.
- [ ] Fonts load before measurement and export.
- [ ] Charts and math remain legible at 1366x768 display scaling.
- [ ] Projector contrast remains acceptable.
- [ ] Every slide has one primary reading path and can be understood at a glance.
- [ ] Headlines, body text, labels, captions, and citations respect the agreed typography floors.
- [ ] Paragraph-like explanation lives in notes unless the reading-first profile explicitly requires it.

## Alignment (see design-space-science-deck/references/alignment-and-grid.md)

- [ ] Text blocks, cards, plot areas, and table rules share the slide's grid left edge (y-tick labels hang outside it).
- [ ] Gaps come from the 8/16/24/40/64 spacing scale; near-equal-but-different gaps do not appear.
- [ ] Peer cards share top edge and height; side-by-side panels share their top edge.
- [ ] Numeric columns right-align on tabular figures with consistent unit placement.
- [ ] Stacked display equations align their equals signs; icons sit on optical center.
- [ ] Every visible text element passes the assertion tests (no prose walls, no predicate-less keyword piles).

## Interaction and accessibility

- [ ] Keyboard navigation, Home/End, and focus visibility work.
- [ ] Reduced-motion behavior removes nonessential movement.
- [ ] Slide and reading-view order are semantic.
- [ ] Equations, diagrams, charts, and media have alternatives.
- [ ] Language and titles are set.
- [ ] Touch behavior does not block normal browser controls.

## Resilience and export

- [ ] Offline mode has no unintended external dependency.
- [ ] Console contains no uncaught errors.
- [ ] PDF page count equals slide count.
- [ ] PNG dimensions and names are deterministic.
- [ ] Backgrounds, credits, and final animation states appear.
- [ ] Reproduction commands and tool versions are recorded.

Blocking failures include missing scientific content, unresolved figure rights, unreadable equations, type below the agreed floor, clipped evidence, broken navigation, incorrect page count, or missing required assets.
