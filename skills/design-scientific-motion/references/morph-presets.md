# Morph transition presets

Files: `/presets/motion_core/morph-transition.css`, `/presets/motion_core/morph-transition.js`.

A morph asserts identity: the element on screen after the transition *is* the
element that was there before, in a new state. Use it only when that claim is
true — a bar chart re-sorting, a compact equation expanding into its annotated
form, a diagram node opening into a detail panel, layout A of the same data
becoming layout B. Never morph between unrelated content; a crossfade between
different things implies a false equivalence.

## Techniques

- `morphState(container, mutate, options?)` — FLIP morph. Tag persistent
  elements with a stable `data-morph-key`; run all DOM changes inside `mutate`.
  Elements that keep their key glide to their new geometry; new keys enter with
  `.morph-enter`; removed keys are the caller's responsibility (add
  `.morph-leave` before removal when the exit should be visible). Works in
  every browser.
- `viewMorph(mutate, options?)` — whole-view morph through the View Transitions
  API with an instant fallback where unsupported. Prefer `morphState` for
  scoped, per-figure morphs; reserve `viewMorph` for full slide-state changes.

## Rules

- Duration token `--morph-duration: 460ms` (content-reveal scale); use linear
  or standard ease, no spring or overshoot on quantitative graphics.
- One morph at a time per slide; a second identity change must wait.
- Reduced motion and export mode apply the mutation instantly — final DOM state
  must be complete and self-explanatory on its own.
- Morphing a chart axis or scale requires the axis labels to morph visibly too;
  silently rescaling under a morph misrepresents the data.
- Declare morphs in the motion manifest as `type: "state-transition"`.
