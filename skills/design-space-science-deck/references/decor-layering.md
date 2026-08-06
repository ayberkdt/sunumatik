# Scene decor layering

Rules for background decoration — ambient WebGL composites (sun, moon,
planets via decor modules), motif sprites, canvas scenes — living BEHIND
slide content. Distilled from a 40-slide deck's live iterations.

## Decor yields

- Decor is BACKGROUND: it never competes with the slide's one job.
  Full presence (alpha ≈ .8–1, larger scale) is allowed only on cover
  and section-divider slides; behind content it drops to alpha ≈ .5 and
  a small footprint in a quiet corner.
- During content-critical scenes (a measurement canvas, a dense table,
  a camera "cockpit/surface" moment) the decor HIDES entirely rather
  than dimming — half-visible decor under precise content reads as a
  rendering mistake.
- Body text never sits directly on decor: a scrim (directional veil,
  darker on the content side) separates them, or the layout keeps text
  off the decor's region entirely.

## Decor is honest

- Use the REAL scene presets through their decor modules (sol-decor
  pattern) instead of hand-drawing imitations — hand-drawn suns grow
  cartoon petals under iteration pressure; the preset already solved
  realism. Keep the 2D fallback plain (no ornament), only for when the
  module cannot load.
- Distance comes from SCALE and POSITION, never blur/desaturate filters
  — filters erase the texture detail that makes the preset worth
  compositing.
- Decor is never data: a decorative planet must not be placeable as a
  figure. If the audience could mistake it for evidence, caption it or
  remove it.
- One decor family per deck (one sky, one set of celestial bodies with
  consistent lighting), moving with slow eased targets per slide pose —
  decor that jumps between slides breaks the single-world illusion.

## Budget

- Decor obeys the 70/20/10 distribution as part of the ~20% structural
  field, not in addition to it.
- Decor animation is calm: slow drift and breathing only; scheduled
  events (flares, transits) stay rare enough that two never overlap
  behind content slides. Pause decor when its slide is inactive.
