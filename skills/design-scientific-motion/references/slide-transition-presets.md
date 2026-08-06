# Slide transition presets

Files: `/presets/motion_core/slide-transitions.css`, `/presets/motion_core/slide-transitions.js`.
Demo: `/presets/motion_core/slide-transition-preview.html`.

Between-slide motion for fixed-stage decks. Premium here means calm: long
curves (`--slide-ease: cubic-bezier(.32,.72,.16,1)`), small distances (≤6% of
stage), opaque surfaces. No blur, no zoom bounce, no 3D flips, no per-slide
variety — a deck picks its transition grammar once.

## Kinds

| Kind | Motion | Use for |
|---|---|---|
| `fade-through` | outgoing settles down, incoming rises in | default between ordinary slides |
| `push` | directional 6% glide, `direction: 1/-1` | sequence with meaning: next phase, later in time; keep direction consistent with that meaning |
| `wipe-mask` | opaque accent panel sweeps the stage across the cut | major section breaks — a few per deck |
| `zoom-into` | camera dives toward an anchor in the outgoing slide, planting a marker that survives the cut | the next slide examines a detail of the current visual (a body, a region, a data point) |
| `morph` | View Transitions shared-element continuation (falls back to fade-through) | consecutive slides sharing a persistent element |

### zoom-into contract

```js
await transitionSlides(from, to, { kind: 'zoom-into', stage, anchor: '#moon' });
```

`anchor` is a selector resolved inside the outgoing slide (or an element); the
zoom's transform-origin is its center. Unless `marker: false`, an accent
ring-and-core marker is planted at the anchor point, rides above the cut, then
glides to the incoming slide's `[data-marker-dock]` element (override with
`dock`) — the "we came from here" residue. Without a dock it fades after
arrival. One marker exists at a time; any non-zoom transition retires it.
A camera move needs explanatory value: zoom into the thing the next slide is
about, never into empty decoration. Reduced motion and export place the marker
directly at the dock with no dive.

## Integration

```js
import { transitionSlides } from './slide-transitions.js';
await transitionSlides(slides[current], slides[next], { kind: 'push', direction: 1, stage });
```

The driver owns the active-class swap per the fixed-stage contract
(visibility/opacity/pointer-events), so replace the runtime's bare class
toggle with this call — do not run both.

## Rules

- One grammar per deck: `fade-through` everywhere, `push` for its meaningful
  axis, `wipe-mask` reserved for declared section breaks.
- Back-navigation mirrors forward (`direction: -1`); a deck that pushes
  forward and fades backward feels broken.
- Keep charts, equations, and running simulations stable across a transition;
  if content must survive the cut, use `morph`, not a re-render.
- Reduced motion and export swap instantly — the transition is never the only
  signal that the slide changed (progress indicator stays mandatory).
- Slide-internal reveals (`revealStage`) start after the transition resolves,
  not during it.
