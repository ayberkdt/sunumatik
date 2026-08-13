# Primitives motion preset

Premium micro-motion adapted from motion-primitives (MIT, © ibelick,
github.com/ibelick/motion-primitives). All durations, easings, and spring
constants are taken from the library source, not invented. Files:
`/presets/motion_core/primitives-motion.css` + `/presets/motion_core/primitives-motion.js`.
No dependencies. Pages must set `document.documentElement.classList.add('js')`
in an inline head script (same contract as core-motion).

## What is in it

| Piece | Markup / call | Use for |
|---|---|---|
| Shimmer sweep | `.px-shimmer` | Section titles on dark stage; one per slide |
| Staggered text | `.px-text data-preset="fade-in-blur"` + `Primitives.reveal(slide)` | The cinematic title/bullet reveal (char .03 / word .05 / line .1 s stagger, 0.3 s items, blur 12px + y 20px) |
| In-view reveal | `.px-inview` + `is-visible` | Single cards/figures entering |
| Scramble decode | `data-scramble` or `Primitives.scramble(el)` | Telemetry/code/ID strings — 0.8 s decode, Turkish charset included |
| Headline morph | `Primitives.textMorph(el, "new text")` | Related terms transforming (shared letters glide) |
| Animated number | `Primitives.animatedNumber(el).set(v)` | Stats that count with spring physics, tr-TR formatting |
| Odometer | `Primitives.slidingNumber(el, v)` | Premium counters — digits roll shortest-path |
| Spotlight | `data-spotlight` | Literal stage light following the cursor on dark slides |
| Tilt | `data-tilt` | 3D card tilt ±15°, springs back on leave |
| Magnetic | `data-magnetic` | Hotspots attracted to cursor (deliberately wobbly spring) |
| Border trail | `data-border-trail` | Glowing comet circling a hero card frame |
| Glow layer | `.px-glow-host > .px-glow` | Conic glow behind hero elements — palette tokens, never AI-gradient colors |
| Marquee | `.px-marquee > .px-marquee-track` | Era rails, instrument/logo strips |
| Progressive blur | `Primitives.progressiveBlur(host, {direction})` | Depth-of-field edge fade over imagery — strip only, 4-6 layers (GPU cost) |

## Signature numbers (do not retune casually)

- Stagger: char 0.03 s · word 0.05 s · line 0.1 s; item 0.3 s.
- fade-in-blur: opacity + translateY(20px) + blur(12px).
- Shimmer: 2 s linear, band spread = 2px × character count.
- Springs: 280/18/0.3 crisp (~350 ms, ζ≈0.98) · 26.7/4.1/0.2 wobbly (the
  magnetic wobble IS the effect) · 170/26/1 critically-damped follow.

## Deck integration

Call `Primitives.init()` once after DOM ready, and `Primitives.reveal(slideEl)`
from the slide-change handler — it re-arms `.px-text`/`.px-inview` and fires
scrambles. In scrolling reading view, drive the same `is-visible` class from
IntersectionObserver instead (threshold 0.3).

## Discipline

- Hover pieces (tilt, magnetic, spotlight) are commentary — no information
  may exist only in them.
- One glow or trail per slide; they mark THE hero, not every card.
- Infinite loops run only under `prefers-reduced-motion: no-preference`;
  export mode freezes everything at final state (wired in the CSS).
- Scramble/marquee never carry load-bearing text that must be read instantly.
- Glow colors come from palette tokens; the purple-blue-cyan AI gradient ban
  from design-space-science-deck applies to glows too.
