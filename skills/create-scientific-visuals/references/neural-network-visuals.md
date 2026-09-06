# Neural network visuals

Conventions for network architecture diagrams and training-result graphics.
The animated forward-pass component lives in
`design-scientific-motion/assets/neural_network/`; this file governs
what any network figure — static or animated — is allowed to claim.

## Choose the right form

| Question | Form |
|---|---|
| What is the architecture? | layer-block diagram (boxes with dimensions), not a cell web |
| How does information flow? | cell diagram with weighted links (the preset) |
| What did training do? | loss/metric curves — ordinary line-chart rules apply |
| What did the model learn? | weight/attention heatmaps with stated normalization |
| How does it perform? | confusion matrix, calibration plot, or metric table |

A full cell web is only readable up to roughly 8 cells per layer and 4 layers.
Larger models get the block form: one box per layer with type and dimensions
(`Conv 3×3, 64` / `Dense 512`), arrows for tensor flow, and parameter counts
where they matter.

## Cell diagram conventions

- Cell fill encodes activation magnitude; positive/negative use the two data
  colors plus a redundant cue (dash style on links), never color alone.
- Link width encodes |weight|; if weights are untrained or randomized, say so
  on the figure — an unlabeled weight pattern reads as a result.
- Label layers, input meaning, and output meaning; a diagram whose inputs are
  anonymous circles explains nothing.
- Bias, activation function, and normalization are stated in the caption or a
  side note, not drawn as extra cells unless the mechanism is the topic.

## Integrity rules

- Declare the truth level like any other scientific visual: an illustrative
  diagram with seeded weights must carry that label visibly.
- Training curves keep raw traces visible under any smoothing, state the
  smoothing window, and never truncate the loss axis silently.
- Performance claims name the dataset, split, and baseline.
- Avoid glowing-brain imagery, falling-code backgrounds, and decorative deep
  nets whose structure matches no model discussed on the slide.
