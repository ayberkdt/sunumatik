# Neural network preset

Files: `/presets/neural_network/` — `neural_network.mjs` (model +
renderer), `neural_network.css`, `index.html` (demo), `motion-manifest.json`.

An honest feed-forward network diagram with an animated forward pass, for
machine-learning method slides. Truth level: **illustrative** — activations are
computed with real arithmetic (weights · input + bias through tanh) but weights
are seeded pseudo-random values. Keep the truth badge visible; never present it
as a trained model's behavior.

## Cell (neuron) anatomy

- **ring** — constant outline; dashed while idle, accent-colored while firing,
  solid ink when settled. The cell stays visible at activation 0.
- **core** — theme-colored disc; `fill-opacity` encodes |activation| in [0, 1].
- **sign** — positive activations fill with `--color-data-1`, negative with
  `--color-data-2`; links repeat the sign with color plus dash style, so sign
  never depends on color alone.
- **value** — optional monospace readout (`showValues: true`).
- **states** — `.is-idle` → `.is-firing` → `.is-settled`, driven layer by layer.

Links encode weight magnitude with stroke width and weight sign with
color + dash. No glow, no neon, no particle effects.

## API

```js
import { mountNeuralNetwork, createNetwork, forward } from './neural_network.mjs';

const nn = mountNeuralNetwork(container, {
  layers: [{ size: 4, label: 'input' }, { size: 7, label: 'hidden 1', activation: 'tanh' }],
  seed: 42,            // deterministic weights — same seed, same figure, same export
  showValues: true,
  layerInterval: 640,  // ms between layer settles
});
nn.play(); nn.step(); nn.reset(); nn.settle(); nn.setInput([...]); nn.stop();
container.addEventListener('nn:settled', ...);
```

`createNetwork` / `forward` are exported separately so a slide can show real
numbers in a table next to the figure.

## Integration rules

- Inherit deck palette tokens; do not restyle sign colors per slide.
- Controls (play, step, reset, input slider) are native elements outside the
  SVG; Escape stops the sequence.
- Reduced motion and export render the fully settled pass — deterministic
  because weights are seeded.
- Validate `motion-manifest.json` with `scripts/validate-motion-manifest.mjs`
  after editing.
- For diagram conventions (when to show a network at all, layer counts,
  what to label), read `create-scientific-visuals/references/neural-network-visuals.md`.
