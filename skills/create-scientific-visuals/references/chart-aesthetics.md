# Chart aesthetics — harmony rules

The class contract (chart-presets.md) says WHAT exists; this file says how
it must LOOK TOGETHER. A chart that follows every structural rule can
still be ugly — these rules close that gap. They bind the engine's
output, hand-built SVG, and any future chart form.

## Color: every hue has a meaning, palette tokens only

- Colors come from the ACTIVE PALETTE's tokens, never from fallbacks or
  hand hexes. **Diagnostic: a muddy olive/steel chart on a themed deck
  means the palette tokens did not resolve** — the classic cause is
  defining `--chart-series-*` at `:root` while `data-palette` sits on
  body (custom properties resolve at their DEFINING element). The theme
  now declares them on `.sci-chart`; never regress this.
- Semantic assignment, fixed across the whole deck:
  - observed/measured data → `--color-data-1`
  - model/fit/projection → `--color-data-2`
  - thresholds, limits, "dikkat" → `--color-accent` (ref-lines own the
    accent; data series never use it)
  - context/baseline series → muted ink, not a new hue
- A hue may not appear without a meaning, and one meaning may not switch
  hues between slides. Two charts on one deck that both show
  observed-vs-model use the SAME two colors.
- An uncertainty band is THE SAME HUE as its parent series at ≤ .18
  fill-opacity, no stroke. A band in its own color reads as a third
  series (the "olive blob" failure).

## Marks

- The observed line is always visible ON TOP of its band: band renders
  first, line over it, markers over the line.
- Markers: series-color fill with a canvas-color rim (1.5 px) so they
  pop off both the line and the band; radius 5–6 px at stage scale.
  Marker-only scatter uses the same spec.
- Dash grammar is fixed (fitted 10-7, projected 2-7, simulated 16-6-3-6)
  and NEVER decorative — a dashed line always means an epistemic state,
  and dashed lines fade in rather than trace (tracing corrupts dashes).
- Reference lines are thinner than data lines (2 px vs 3.5 px), dashed
  7-6, always labelled at the right edge in the accent color.

## Text on the chart

- The chart TITLE is an assertion ("Kayıp 60. derecede başlıyor"), not a
  topic label; axis titles carry the unit in muted type.
- Direct labels replace legends whenever there is room: series color,
  bold, at the LINE'S END with 12 px offset, one per series. The legend
  block exists only for dense multi-series cases.
- Annotations are muted ink with a thin arrow to the exact point; at
  most two per chart — more means the chart is carrying prose.

## Motion harmony (parlama yok)

- Chart animation is DRAW-IN only: lines trace, bars grow from the
  baseline, markers pop, bands/labels fade — staggered ≤ 900 ms total,
  fired once when the chart enters view. No loops.
- NO glow, bloom, pulse, or shimmer on data marks — ever. Emphasis
  during the talk uses interaction (hover dimming, legend linking) or a
  one-shot flash, not ambient light. Glow on data implies signal that
  is not in the data.
- Reveal order is document order; if order should carry meaning, order
  the series in the spec.

## Layout

- The PLOT AREA left edge sits on the slide grid line (tick labels hang
  outside — alignment-and-grid.md). Right margin reserves ~150 px for
  direct labels and ref-labels so text never clips or overlaps marks.
- Horizontal gridlines only, rule-token hairlines; the y-axis line and
  ticks stay quiet (mixed toward canvas) so data ink dominates.
- One chart, one message: if two relationships compete, split the chart.
  Small-multiples share identical scales and color assignments.

## Light/dark behavior

The same chart must survive both palette families: bands stay ≤ .18
opacity (they darken on light canvases and lift on dark ones), marker
rims use the canvas token so they adapt, and title/ink text uses tokens
— check any new chart form against one dark (graphite-ember) and one
light (porcelain-ink) palette before shipping.
