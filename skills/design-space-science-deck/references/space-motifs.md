# Space motif kit

File: `assets/space-motifs/space-motifs.svg` (symbol sprite).
Preview: `assets/space-motifs/motif-preview.html`.

Reusable line-art motifs for slide art direction: structural decoration that
echoes the subject without pretending to be data. They follow the deck's
avoid-list — no glow, no gradients, no dense star wallpaper.

## Symbols

| id | motif | typical placement |
|---|---|---|
| `orbit-arc` | single elliptical orbit + direction node | section titles, corner accents |
| `orbit-system` | two-body system with nested orbits | agenda/overview slides |
| `planet-ring` | ringed planet | title slide seal, divider |
| `moon-terminator` | moon disc with terminator + craters | lunar topics |
| `graticule` | globe grid | coordinate/geodesy topics |
| `starfield-sparse` | ten stars + two cross sparkles | one large empty region, ≤ 2 uses per deck |
| `reticle` | instrument crosshair | observation/pointing topics, callout anchors |
| `trajectory` | ascent arc with burn tick | mission phases, transitions |
| `spectral-band` | baseline + data-colored bands | spectroscopy topics |
| `ground-station` | dish antenna | comms/link topics |

## Usage

```html
<svg class="motif" viewBox="0 0 240 240" aria-hidden="true">
  <use href="assets/space-motifs/space-motifs.svg#orbit-system"/>
</svg>
```

Motifs draw with `currentColor`; accents pick up `--color-accent`,
`--color-data-1`, `--color-data-2` from the active palette. Set `color` on the
wrapper (usually the muted token) and keep opacity between .5 and .9 for
background placement. Inline the sprite once per document when the deck must
work from `file://`, since external `<use>` references require http(s).

## Rules

- Motifs are decoration: always `aria-hidden="true"`, never load-bearing.
- One motif per slide region; a motif never sits behind body text or charts.
- Do not present a motif as data — an `orbit-arc` next to a real trajectory
  plot must be visually distinct from the plot itself (weight, color, scale).
- Respect the subject: lunar motifs on lunar decks; no generic rocket clip art
  on an observation deck.
