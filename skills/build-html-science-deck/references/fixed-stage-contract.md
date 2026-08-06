# Fixed-stage contract

Author each live slide at 1920x1080. Scale the complete stage with:

```js
const scale = Math.min(innerWidth / 1920, innerHeight / 1080);
const x = (innerWidth - 1920 * scale) / 2;
const y = (innerHeight - 1080 * scale) / 2;
stage.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
```

## Invariants

- Keep stage origin at top-left and use `transform-origin: 0 0`.
- Keep slides absolutely stacked inside the stage.
- Switch slides with visibility, opacity, pointer-events, and an active class.
- Never depend on viewport reflow for live slide composition.
- Keep controls outside the scaled stage when they must stay screen-sized.
- Provide print rules that expose every slide.
- Provide `prefers-reduced-motion` behavior.
- Wait for fonts, images, and math before measuring.

## Reading mode

Generate a separate semantic document flow. Do not turn the fixed live slide DOM into a narrow responsive page through ad hoc breakpoints.

