/* Neural network preset: an honest, token-themed feed-forward network
   diagram with an animated forward pass.

   Truth level: illustrative. Activations are computed with real matrix
   arithmetic (weights · inputs + bias through tanh), but weights are
   seeded pseudo-random values, not a trained model. Never present this
   as the behavior of a specific trained network.

   Cell (neuron) anatomy — see neural_network.css:
   - ring:  constant outline, keeps the cell visible at activation 0;
   - core:  accent-filled disc, fill-opacity encodes |activation|;
   - sign:  positive activations use --color-data-1, negative --color-data-2;
   - value: optional monospace readout of the activation;
   - states: .is-idle (not yet computed), .is-firing (this layer is
     computing now), .is-settled (activation final).

   Link anatomy: stroke width encodes |weight|, color encodes sign,
   .is-firing runs a single dash pulse from source to target layer. */

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const exporting = () => document.documentElement.dataset.export === 'true';

/* Deterministic PRNG so every render, export, and screenshot matches. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ACTIVATIONS = {
  tanh: x => Math.tanh(x),
  relu: x => Math.max(0, x) / (1 + Math.max(0, x)), // squashed for display in [0,1)
  linear: x => Math.max(-1, Math.min(1, x)),
};

export function createNetwork(spec = {}) {
  const layers = spec.layers || [
    { size: 4, label: 'input' },
    { size: 6, label: 'hidden 1', activation: 'tanh' },
    { size: 6, label: 'hidden 2', activation: 'tanh' },
    { size: 3, label: 'output', activation: 'tanh' },
  ];
  const random = mulberry32(spec.seed ?? 20260805);
  const weights = [];
  const biases = [];
  for (let l = 1; l < layers.length; l++) {
    const rows = layers[l].size, cols = layers[l - 1].size;
    weights.push(Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => (random() * 2 - 1))));
    biases.push(Array.from({ length: rows }, () => (random() * 2 - 1) * 0.4));
  }
  return { layers, weights, biases, seed: spec.seed ?? 20260805 };
}

export function forward(network, input) {
  const first = network.layers[0].size;
  const x = Array.from({ length: first }, (_, i) => input?.[i] ?? 0);
  const activations = [x];
  for (let l = 1; l < network.layers.length; l++) {
    const fn = ACTIVATIONS[network.layers[l].activation || 'tanh'] || ACTIVATIONS.tanh;
    const prev = activations[l - 1];
    activations.push(network.weights[l - 1].map((row, i) =>
      fn(row.reduce((sum, w, j) => sum + w * prev[j], network.biases[l - 1][i]))));
  }
  return activations;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const svgEl = (name, attrs = {}) => {
  const el = document.createElementNS(SVG_NS, name);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
};

export function mountNeuralNetwork(container, options = {}) {
  if (!container) throw new Error('mountNeuralNetwork requires a container element');
  const network = options.network || createNetwork(options);
  const showValues = options.showValues ?? false;
  const layerGap = options.layerGap ?? 260;
  const cellGap = options.cellGap ?? 96;
  const radius = options.cellRadius ?? 26;
  const pad = 70;

  const maxSize = Math.max(...network.layers.map(l => l.size));
  const width = pad * 2 + layerGap * (network.layers.length - 1);
  const height = pad * 2 + cellGap * (maxSize - 1) + 40;
  const yFor = (layer, i) =>
    pad + ((maxSize - network.layers[layer].size) * cellGap) / 2 + i * cellGap;
  const xFor = layer => pad + layer * layerGap;

  container.classList.add('nn-preset');
  const svg = svgEl('svg', {
    viewBox: `0 0 ${width} ${height}`,
    role: 'img',
    'aria-label': options.ariaLabel ||
      `Illustrative feed-forward neural network with layers of ${network.layers.map(l => l.size).join(', ')} cells. Link thickness encodes weight magnitude; cell fill encodes activation.`,
  });

  const linkGroups = [];
  for (let l = 1; l < network.layers.length; l++) {
    const group = svgEl('g', { class: 'nn-links', 'data-layer': l });
    for (let i = 0; i < network.layers[l].size; i++) {
      for (let j = 0; j < network.layers[l - 1].size; j++) {
        const w = network.weights[l - 1][i][j];
        const line = svgEl('line', {
          class: `nn-link ${w >= 0 ? 'is-positive' : 'is-negative'}`,
          x1: xFor(l - 1), y1: yFor(l - 1, j),
          x2: xFor(l), y2: yFor(l, i),
          'stroke-width': (0.4 + Math.abs(w) * 2.6).toFixed(2),
        });
        group.appendChild(line);
      }
    }
    linkGroups.push(group);
    svg.appendChild(group);
  }

  const cellGroups = [];
  network.layers.forEach((layer, l) => {
    const group = svgEl('g', { class: 'nn-layer', 'data-layer': l });
    const cells = [];
    for (let i = 0; i < layer.size; i++) {
      const cell = svgEl('g', { class: 'nn-cell is-idle', transform: `translate(${xFor(l)} ${yFor(l, i)})` });
      cell.appendChild(svgEl('circle', { class: 'nn-cell-ring', r: radius }));
      cell.appendChild(svgEl('circle', { class: 'nn-cell-core', r: radius - 5 }));
      if (showValues) {
        const value = svgEl('text', { class: 'nn-cell-value', y: 5, 'text-anchor': 'middle' });
        value.textContent = '·';
        cell.appendChild(value);
      }
      group.appendChild(cell);
      cells.push(cell);
    }
    const label = svgEl('text', {
      class: 'nn-layer-label', x: xFor(l), y: height - 26, 'text-anchor': 'middle',
    });
    label.textContent = layer.label || `layer ${l}`;
    group.appendChild(label);
    cellGroups.push(cells);
    svg.appendChild(group);
  });
  container.appendChild(svg);

  let input = options.input ||
    Array.from({ length: network.layers[0].size }, (_, i) =>
      Math.sin((i + 1) * 1.7) * 0.8);
  let activations = forward(network, input);
  let timer = null;
  let layerCursor = 0;

  const paintLayer = (l, settled) => {
    cellGroups[l].forEach((cell, i) => {
      const a = activations[l][i];
      cell.classList.remove('is-idle', 'is-firing');
      cell.classList.add(settled ? 'is-settled' : 'is-firing');
      cell.classList.toggle('is-negative', a < 0);
      const core = cell.querySelector('.nn-cell-core');
      core.style.fillOpacity = Math.min(1, Math.abs(a)).toFixed(3);
      const value = cell.querySelector('.nn-cell-value');
      if (value) value.textContent = a.toFixed(2);
    });
  };

  const clear = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    layerCursor = 0;
    cellGroups.forEach(cells => cells.forEach(cell => {
      cell.classList.remove('is-settled', 'is-firing', 'is-negative');
      cell.classList.add('is-idle');
      cell.querySelector('.nn-cell-core').style.fillOpacity = '0';
      const value = cell.querySelector('.nn-cell-value');
      if (value) value.textContent = '·';
    }));
    linkGroups.forEach(group => group.classList.remove('is-firing'));
  };

  const settleAllLayers = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    linkGroups.forEach(group => group.classList.remove('is-firing'));
    network.layers.forEach((_, l) => paintLayer(l, true));
    layerCursor = network.layers.length;
    container.dispatchEvent(new CustomEvent('nn:settled'));
  };

  const stepLayer = () => {
    if (layerCursor >= network.layers.length) return false;
    const l = layerCursor;
    if (l > 0) {
      linkGroups[l - 1].classList.add('is-firing');
      setTimeout(() => linkGroups[l - 1].classList.remove('is-firing'), 600);
    }
    paintLayer(l, false);
    setTimeout(() => cellGroups[l].forEach(cell => {
      cell.classList.remove('is-firing');
      cell.classList.add('is-settled');
    }), 420);
    layerCursor += 1;
    if (layerCursor === network.layers.length) container.dispatchEvent(new CustomEvent('nn:settled'));
    return true;
  };

  const play = () => {
    if (reduced() || exporting()) { settleAllLayers(); return; }
    clear();
    const tick = () => {
      if (stepLayer()) timer = setTimeout(tick, options.layerInterval ?? 640);
      else timer = null;
    };
    tick();
  };

  const setInput = nextInput => {
    input = nextInput;
    activations = forward(network, input);
    if (layerCursor > 0) settleAllLayers();
  };

  if (reduced() || exporting()) settleAllLayers();

  return {
    network,
    get activations() { return activations; },
    play,
    step: () => { if (!stepLayer()) { clear(); stepLayer(); } },
    reset: clear,
    settle: settleAllLayers,
    setInput,
    stop: () => { if (timer) { clearTimeout(timer); timer = null; } },
  };
}
