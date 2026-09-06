# Saved user palette pairs

These five pairs are authoritative references supplied by the user. Preserve their hex values exactly.

| ID | Dark or anchor | Light or accent | Character | Recommended use |
|---|---|---|---|---|
| berry-orchid | Berry Wine #5A2132 | Orchid Mist #EFE9E9 | warm editorial pastel | scholarly synthesis, biomedical or atmospheric topics |
| sage-buttercream | Sage Leaf #202B23 | Buttercream #FFD85F | botanical and vibrant | sustainability, systems, engineering decisions |
| arctic-mulberry | Arctic Sky #BCD3E7 | Mulberry Wine #391D30 | cool pastel contrast | climate, remote sensing, observation, astronomy |
| midnight-tangerine | Midnight Navy #1E223D | Burnt Tangerine #F54F1F | energetic complementary contrast | missions, propulsion, launches, decisive results |
| oat-cocoa | Oat Milk #F3EEC8 | Cocoa Bean #473835 | creamy, earthy, premium | archival science, geology, thesis defense, methods |

Use /presets/color_themes/palette-library.json for expanded semantic tokens and /presets/color_themes/palette-library.css for implementation-ready variables.

Do not treat a pair as two equal halves on every slide. Expand it with quiet surfaces and data colors, then choose one dominant field per slide.

## Second reference set (2026-08-14) — pairs delivered with BOTH directions

The user supplied five more pairs and asked for the partners to be at hand
("doğrudan eşleri elimde olsun"). Each therefore ships as **two** palette ids:
`<id>` (light ground) and `<id>-dark` (the same pair inverted). Reference hex
values are preserved exactly; every contrast below is MEASURED, not estimated.

| ID | Pair | Measured pair contrast | Verdict |
|---|---|---|---|
| butter-green | Butter #FFEFB3 / Deep Green #013E37 | **10.46:1** | body text both directions |
| vanilla-cherry | Cream Vanilla #EFE6DD / Cherry Cola #9A0002 | **7.17:1** | body text both directions |
| aureolin-bistre | Aureolin #FBE311 / Bistre #261606 | **13.42:1** | body text both directions |
| lime-vermilion | Lime #D3F00A / Vibrant Red #F9100C | **3.18:1** | DISPLAY ONLY — see below |
| violet-imperial | Violet #321847 / Imperial Red #F15153 | **4.45:1** | large display type only |

**The two risky ones are not silently "fixed".** Where the reference pair itself
fails the 4.5:1 body-text floor, the palette keeps the reference tone for display
type and fill, and carries a separately measured `ink` for body copy; the record
declares this in `displayPair` (and `displayAccent` where a chip needed it). The
gallery prints both numbers on the card. Never quote the reference pair as
body-safe just because it looks striking on a poster.

`lime-vermilion` additionally carries a **chromostereopsis** warning: both tones
sit near 92–95% saturation at nearly the same lightness (49 vs 51), so edges
between them vibrate. Legal use: poster-scale headline, fill, single accent —
never body text, never adjacent thin strokes, never small data marks.

## Gradients (fade palettes)

Five two-stop fades ship in `palette-library.json` under `gradients`, addressed
with `data-gradient="<id>"`. They do NOT relax the no-decorative-gradient rule;
they are defined for three legitimate grounds only: **title/section field, light
phenomenon (sky, plume, heat), and SEQUENTIAL data ramp** — never on a data mark,
never under body text without the scrim.

| ID | Stops | Best text | Worst point | Scrim needed |
|---|---|---|---|---|
| ocean-mint-fade | #085078 → #9AE4CB | black | 2.28:1 | α 0.27 |
| velvet-berry-glow | #4B0C37 → #C8005A | white | 5.83:1 | none |
| royal-sky | #292F91 → #4CA8DC | white | 2.64:1 | α 0.26 |
| dusky-orchid | #564A97 → #B75F67 | white | 4.33:1 | α 0.03 |
| midnight-steel | #141E30 → #3E5E96 | white | 6.47:1 | none |

**The rule that matters:** text safety on a gradient is decided by the WORST
point along the ramp, not the midpoint. A fade with a wide lightness span
(ocean-mint travels 25 → 75 in lightness) cannot carry one text colour at all;
a fade with a narrow span (midnight-steel) is the safest ground in the set.
Each record carries `scrim.alpha` — the minimum overlay opacity that lifts the
worst point to 4.5:1 — and `scrim.css` ready to paste.

## Third set (2026-08-14) — space and geodesy, designed to fill gaps

The user asked for more combinations: three space palettes + two space fades,
two geodesy palettes + one geodesy fade. These were designed against what the
library ALREADY had — it was long on dark+gold (obsidian-champagne) and
navy+orange (midnight-tangerine), so each new palette brings a different accent
family. All ten records (five pairs × light/dark) cleared 4.5:1 unaided.

| ID | Pair | Measured | Accent family it adds |
|---|---|---|---|
| aurora-boreal | Aurora #3FD98A / Polar Night #06202B | 9.21:1 | green (557.7 nm oxygen line) |
| neptune-methane | Methane #8FD9E8 / Deep Blue #0D2C4E | 8.91:1 | cyan, single cool arc |
| eclipse-corona | Corona Pearl #F2E8DC / Eclipse #171226 | 15.08:1 | pearl neutral + chromosphere rose |
| geoid-anomaly | Chart Paper #EDF1F2 / Deep Sea #0B2E3B | 12.58:1 | RdBu diverging axis |
| graticule-slate | Graticule #9FC4D4 / Slate #16222E | 8.69:1 | cyan grid + ellipsoid amber |

`geoid-anomaly` deliberately carries the RdBu (#2166AC ↔ #B2182B) axis as data1/
data2: it survives deuteranopia and protanopia, which is exactly why gravimetric
and geoid maps standardised on it.

| Fade | Stops | Best text | Worst point | Scrim |
|---|---|---|---|---|
| airglow-limb | #040B16 → #35C4B4 | white | 2.16:1 | α 0.33 |
| solar-photosphere | #4A1002 → #FFC24D | white | 1.61:1 | α 0.42 |
| geoid-undulation | #1B3A6B → #D98C3F | white | 2.70:1 | α 0.25 |

All three span a wide luminance range by nature (near-black to bright), so all
three need a scrim under text — that is the physics of the subject, not a design
flaw. Two honesty notes ride with them: `solar-photosphere` must never imply a
linear colour↔temperature mapping without a labelled scale, and
`geoid-undulation` is a DIVERGING quantity — a two-stop fade is only correct
across a single sign, so anchor the scale at zero and use the two half-ramps
separately when the map crosses the ellipsoid.

