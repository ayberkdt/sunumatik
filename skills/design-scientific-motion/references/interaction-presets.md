# Interaction presets (hover + focus)

Files: `/presets/motion_core/interaction-motion.css`, `/presets/motion_core/interaction-motion.js`.

Hover is commentary, never content: nothing essential may exist only behind a hover.
Every hover state has a keyboard twin, a touch fallback, and a deterministic export
state, so slides pass the audit without special cases.

## Presets

| Preset | Markup | Use for | Avoid for |
|---|---|---|---|
| `data-hover="lift"` | on a card/panel | signaling that a panel is interactive | static evidence panels |
| `data-hover="underline"` | on a term/link | glossary terms, deep links | whole sentences |
| `data-hover-group` + `data-hover-member` | container + members | dimming sibling series, rows, timeline events | groups of fewer than 3 members |
| `data-hover="annotate"` + `.hover-note` | element + note child | units, provenance, uncertainty detail | conclusions or claims |

## Linked highlight (legend ↔ chart)

When trigger and target live in different DOM regions, give both containers
`data-hover-group`, tag members with matching `data-series` values, point the
follower at the source with `data-hover-link="#legend-id"`, and call
`initInteractions()` from `interaction-motion.js`.

## Rules

- Timing stays at micro-feedback scale (160–260 ms); the default token is
  `--interaction-duration: 200ms`.
- Dim siblings to `--interaction-dim` (0.35); never hide them.
- Touch (`hover: none`): annotations render statically, dimming is disabled.
- Export (`html[data-export="true"]`): annotations visible, nothing dimmed or lifted.
- Reduced motion: state changes remain but apply instantly.
- Do not attach hover motion to axes, uncertainty bounds, or instrument readings
  while they are being read.
