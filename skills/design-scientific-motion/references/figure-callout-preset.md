# Figure callout preset

Files: `/presets/figure_callouts/` — `figure-callout.mjs`
(mountFigureStory), `index.html` (self-contained demo with a generated
SVG figure), `motion-manifest.json`.

Step-by-step guided attention ON a scientific figure (photo, plot,
mission image, schematic): each step draws a box/circle/arrow in percent
coordinates over the image, optionally dims everything outside the region
(spotlight scrim with an even-odd hole), optionally opens a magnifier
lens (scaled background-image crop — img/data-URI sources), and swaps the
caption. Steps navigate by arrow keys (`data-owns-arrows`), labelled
dots, or the API.

```js
import { mountFigureStory } from './figure-callout.mjs';
const fig = mountFigureStory(container, {
  src: 'figure.png',                    // veya { html: '<svg .../>' }
  alt: 'figür açıklaması',
  steps: [
    { caption: 'Kuzeydoğu çeyreğinde kümeleniyor', box: { x:62,y:14,w:28,h:30 }, dim: true },
    { caption: 'Üç nokta eşiğin iki katında', circle: { x:76,y:29,r:7 }, lens: { x:76,y:29,r:14,zoom:2.4 } },
    { caption: 'Sırt güneybatıya uzanıyor', arrow: { x1:70,y1:36,x2:32,y2:72 } },
  ],
  exportStep: 1,                        // varsayılan: son adım
});
fig.next(); fig.prev(); fig.goTo(i); fig.dispose();
```

## Rules

- **Every caption is an assertion** (write-assertive-slide-copy): the step
  states what the region SHOWS, not its topic. "Bölge 3" is not a caption.
- Marks are authored coordinates — they claim attention, not detection.
  If the claim depends on a measured feature, the measurement belongs in
  the caption with its number.
- The lens magnifies pixels only; never imply it reveals new data.
- One region per step. Competing regions = separate steps or a comparison
  layout.
- Percent coordinates map onto the image box; author against the same
  aspect ratio the deck will render (marks stretch with the image).
- Export renders `exportStep` (default last) fully, caption included;
  reduced motion drops trace/scale animation but keeps keyboard stepping.
- Deck runtimes: the figure carries `data-owns-arrows` — route arrows to
  it while focused; navigate slides with Space/PageDown.
