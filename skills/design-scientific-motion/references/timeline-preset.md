# Chronology timeline preset

Files: `/presets/timeline_tree/` — `timeline_tree.mjs`, `timeline_tree.css`,
`index.html` (demo), `motion-manifest.json`.

An interactive horizontal or vertical chronology "tree": one event holds focus,
the track glides to keep it centered, and branch tracks carry parallel threads
(missions above the axis, science results below, decisions left, outcomes
right). Use for exploration history, program phases, discovery sequences, and
review-board schedules. Click, arrow keys, Home/End, or one deliberate wheel
step move the focus — never free-scroll jitter.

## API

```js
import { mountTimeline } from './timeline_tree.mjs';

const tl = mountTimeline(container, {
  orientation: 'horizontal',        // or 'vertical'
  events: [{ id, date: '1969', title, detail?, track: 1 }],  // track: 1|-1|2|-2
  eras: [{ from: 0, to: 4, label: 'First era' }],            // index ranges
  scale: 'ordinal',                 // 'time' + numeric t for proportional gaps
  slotSize: 280,
  initialIndex: 0,
  exportIndex: 0,
});
tl.focus(i); tl.next(); tl.prev(); tl.index;
container.addEventListener('tl:focus', ...);
```

Give the container `tabindex="0"` so arrow keys work without clicking first.

## Rules

- **Ordinal spacing is the default** and must keep dates visible on every
  card; switch to `scale: 'time'` when the *gaps* are part of the argument —
  then unequal spacing may not be smoothed away.
- Focused card opens its detail; siblings recede to 55% opacity but stay
  legible — the audience must always see where in time they are.
- Branch tracks hold *kinds* of events, stated once (e.g. "missions above,
  results below"); do not scatter tracks decoratively.
- Deck integration: advance the timeline with the same keys as slides only if
  the timeline owns the whole slide; otherwise require an explicit click focus
  first. `tl:focus` events can drive linked panels (map, image, metric).
- Dates and claims are content — route them through
  `$verify-scientific-evidence`; the preset only presents them.
- Reduced motion: instant repositioning. Export: freeze at `exportIndex`, all
  events full opacity, focused card open. Declared in the motion manifest as
  `state-transition`.
