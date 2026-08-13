# Icon style card — Sunumlar duotone science set (v2 language)

You are drawing icons for a scientific presentation library. Every icon you
produce MUST look like it came from the same hand as the exemplars below.
This is the binding contract. Deviations get rejected in collage review.

## The language (non-negotiable)

- `<symbol id="i-<kebab-name>" viewBox="0 0 24 24">` — 24×24 grid.
- **Safety margin 2px**: all geometry lives inside x,y ∈ [2, 22]. Nothing touches the edge.
- **DUOTONE**: each icon pairs
  1. a soft mass layer — `fill="currentColor" opacity=".16"` (the "body" of the object), and
  2. crisp outlines — `fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"`.
  Dense curve work (orbit ellipses, field lines) may drop to `stroke-width="1.6"`.
- **Exactly ONE solid focal detail** per icon: a small `fill="currentColor"` circle
  (r 1.1–2.0) or tiny solid shape — the nucleus, the antenna dot, the needle hub,
  the burn point. It is the icon's visual anchor. Never two competing focals.
- De-emphasize secondary geometry with `opacity=".5"` or `".7"` on the stroke.
- Order inside the symbol: duotone fill layer(s) → stroke `<g>` → solid focal.
- `currentColor` ONLY. No hex, no rgb, no `fill="black"`, no gradients, no filters.
- NO `id` attributes inside a symbol (sprite-wide collisions). No `<style>`, no classes.
- No text glyphs as the whole icon — a formula icon must be a DRAWING, not a font
  character. (Exception: a single Greek/mathematical mark drawn as vector paths is
  fine when it IS the concept — e.g. the ∫ hook, the ∇ triangle, the Σ zigzag —
  but draw it with paths and pair it with a duotone plate or object so it reads
  as an icon, not as typed text.)
- Legibility at 24px is the test: max ~6 distinct strokes; kill detail that dies
  when small. A recognizable silhouette beats an accurate schematic.

## Exemplars — copy this feel exactly

```svg
<symbol id="i-satellite" viewBox="0 0 24 24">
  <rect x="2" y="9.7" width="4.8" height="4.6" rx=".9" fill="currentColor" opacity=".16"/>
  <rect x="17.2" y="9.7" width="4.8" height="4.6" rx=".9" fill="currentColor" opacity=".16"/>
  <g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="9.7" width="4.8" height="4.6" rx=".9"/>
    <rect x="17.2" y="9.7" width="4.8" height="4.6" rx=".9"/>
    <path d="M6.8 12 H8.6 M15.4 12 H17.2"/>
    <rect x="8.6" y="8.6" width="6.8" height="6.8" rx="1.5"/>
    <path d="M12 8.6 V5.8"/>
  </g>
  <circle cx="12" cy="4.4" r="1.2" fill="currentColor"/>
</symbol>

<symbol id="i-atom" viewBox="0 0 24 24">
  <ellipse cx="12" cy="12" rx="9.2" ry="3.6" fill="none" stroke="currentColor" stroke-width="1.6"/>
  <ellipse cx="12" cy="12" rx="9.2" ry="3.6" fill="none" stroke="currentColor" stroke-width="1.6" transform="rotate(62 12 12)"/>
  <ellipse cx="12" cy="12" rx="9.2" ry="3.6" fill="none" stroke="currentColor" stroke-width="1.6" transform="rotate(-62 12 12)" opacity=".5"/>
  <circle cx="12" cy="12" r="2" fill="currentColor"/>
  <circle cx="19.2" cy="8.2" r="1.2" fill="currentColor" opacity=".7"/>
</symbol>

<symbol id="i-gauge" viewBox="0 0 24 24">
  <path d="M6.3 17.2 A6.6 6.6 0 0 1 17.7 17.2" fill="none" stroke="currentColor" stroke-width="3.4" opacity=".16"/>
  <g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
    <path d="M3.4 17.2 A9.4 9.4 0 0 1 20.6 17.2"/>
    <path d="M4.4 13.2 5.9 14 M12 7.8 V9.6 M19.6 13.2 18.1 14"/>
    <path d="M12 17 15.7 11.4"/>
  </g>
  <circle cx="12" cy="17.2" r="1.8" fill="currentColor"/>
</symbol>
```

Note the three duotone techniques on show: (1) a filled rect echoed by its own
outline, (2) opacity-graded strokes for depth, (3) a fat low-opacity stroke used
as a "mass" band under a thin outline. Use all three across your set.

## Scientific honesty

These icons label real concepts. Draw the concept CORRECTLY:
- an ellipse orbit has the primary at a FOCUS, not the center;
- a hyperbolic trajectory does not close;
- a Bode plot is log-magnitude falling with a corner, not a random curve;
- a transformer attention icon shows connections between tokens, not a robot;
- prograde and retrograde burns point opposite ways along the velocity vector.
If you cannot draw a concept honestly at 24px, choose a simpler true metaphor
rather than a pretty lie.

## Deliverable format (exact)

Write TWO files into your assigned output folder:

1. `<family>.svg` — a plain text file containing ONLY your `<symbol>` blocks,
   one after another, no wrapper `<svg>`, no XML declaration. Two-space indent.
   Precede each symbol with a one-line comment: `<!-- <name> · <what it shows> -->`

2. `<family>.json` — an array:
   `[{"name":"orbit-elliptical","family":"astrodynamics","label_tr":"Eliptik yörünge","label_en":"Elliptical orbit","tags":["yörünge","elips","orbit","ellipse","kepler"]}, ...]`
   `name` matches the symbol id WITHOUT the `i-` prefix. Turkish label first —
   this is a Turkish-language deck library. Tags: 4–8, Turkish AND English.

## Self-check before you finish (do it, report the numbers)

- Count symbols; must equal your assigned list exactly (no extras, no omissions).
- Parse the SVG: wrap your file in `<svg xmlns="http://www.w3.org/2000/svg">…</svg>`
  and parse with python `xml.etree.ElementTree` — must be well-formed.
- grep for forbidden content: `#`, `rgb(`, `id="` (inside symbols), `<style`,
  `fill="black"`, `stroke="black"`, `url(` — must be zero hits.
- Every symbol has ≥1 `opacity=".16"` (or a fat low-opacity mass stroke) AND
  exactly one solid `fill="currentColor"` focal element.
- Coordinate bounds: no number outside [1.5, 22.5] in path/shape coordinates.
