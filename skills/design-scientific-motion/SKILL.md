---
name: design-scientific-motion
description: Design, adapt, implement, and validate meaningful animation, staged reveals, orbital motion, physical demonstrations, and reusable simulation presets for scientific HTML presentations. Use when motion must explain sequence, causality, scale, transformation, uncertainty, orbit, propagation, or interaction, or when a deck needs reusable animation components; do not use for decorative autoplay, unrelated visual themes, static charts, or claims that require source verification.
---

# Design Scientific Motion

Use motion to change understanding, not merely to make a slide feel active.

## Classify the motion

Label each request as staged reveal, path trace, comparison wipe, state transition, time evolution, camera move, parameter exploration, analytic simulation, numerical simulation, or data playback.

Read references/motion-principles.md before choosing timing or easing. Use the lightest technique that communicates the intended relationship.

## Declare the truth level

Classify every animated scientific model as:

- illustrative: geometry or timing is conceptual;
- analytic: driven by a stated closed-form model;
- numerical: produced by a documented solver and assumptions;
- data-driven: replaying measured or externally computed data.

Show the classification and limitations near the interaction or in notes. Never label an illustrative orbit as a mission trajectory, NRHO, or high-fidelity propagation.

## Choose a preset

Use /presets/motion_core/core-motion.css and /presets/motion_core/core-motion.js for reveals, staged/staggered reveals (`revealStage`), scroll-triggered reveals in reading view (`observeReveal`), path tracing, comparison wipes, focus shifts, and deterministic export settling. Pages using core-motion.css must set `document.documentElement.classList.add('js')` in an inline head script: initial hidden states are gated on `html.js`, so content stays visible when JavaScript cannot run (file://, failed import, strict CSP).

Read `references/interaction-presets.md` and use `/presets/motion_core/interaction-motion.css` plus `/presets/motion_core/interaction-motion.js` for hover and focus micro-interactions: lift, underline trace, sibling dimming groups, on-demand annotations, and legend-to-chart linked highlighting. Hover is commentary, never content.

For premium micro-motion — shimmer titles, staggered fade-in-blur text, scramble decode, headline morph, spring counters and odometers, spotlight, tilt, magnetic, border trail, glow layers, marquees, progressive blur — read `references/primitives-motion.md` and use `/presets/motion_core/primitives-motion.css` plus `/presets/motion_core/primitives-motion.js` (adapted from motion-primitives, MIT; source-exact timing and spring constants). One glow or trail per slide; hover pieces stay commentary.

For table motion, read `references/table-motion-presets.md` and use `/presets/motion_core/table-motion.css` plus `/presets/motion_core/table-motion.js`: scroll-triggered row cascades (`data-table-reveal` + observeTableReveal), presenter-driven one-shot row flashes (flashRow), and header-hover column emphasis — styling stays in design-space-science-deck's table-presets.

Read `references/morph-presets.md` and use `/presets/motion_core/morph-transition.css` plus `/presets/motion_core/morph-transition.js` when an element must visibly become its next state: FLIP morphs via `morphState` for scoped figures and `viewMorph` for full slide-state changes. Morph only between states of the same thing.

For neural-network method slides, read `references/neural_network.md` and use `assets/neural_network/` for an illustrative feed-forward diagram with seeded weights, layer-by-layer forward-pass animation, and sign-safe cell encoding.

For chronological material, read `references/timeline_tree.md` and use `assets/timeline_tree/` for an interactive horizontal or vertical chronology with focus gliding, branch tracks, era bands, and keyboard/wheel navigation.

For equation reveals, read `references/equation_pen.md` and use `assets/equation_pen/` to write typeset equations token by token with a pen nib and optional true stroke drawing; the settled equation always stands alone.

For explaining an EXISTING equation term by term, read `references/equation-steps-preset.md` and use `assets/equation-steps-preset/`: the equation stays fully typeset while each step focuses a set of terms (accent underline, rest ghosted) with an assertion caption — the derivation-walkthrough complement of the pen preset.

For guided attention on a figure or image, read `references/figure-callout-preset.md` and use `assets/figure-callout-preset/`: percent-coordinate boxes/circles/arrows that trace in step by step, an optional spotlight scrim, a magnifier lens, and assertion captions with keyboard navigation.

For between-slide motion, read `references/slide-transition-presets.md` and use `/presets/motion_core/slide-transitions.css` plus `/presets/motion_core/slide-transitions.js`: fade-through by default, meaning-consistent push, sparing wipe-mask section breaks, and morph continuity. One transition grammar per deck.

For Earth material, read `references/terra-globe-preset.md` and use `assets/earth_advanced/`: a realistic WebGL globe (NASA-derived day/night/cloud textures, shader-masked night lights, fresnel scattering atmosphere, visible sun glow, illustrative satellite) with a guided real-coordinate city tour.

For solar material, read `references/sol-preset.md` and use `assets/sun_advanced/`: a fully procedural Sun with animated granulation, physically-correct limb darkening (u = 0.56), chromosphere rim, and streamer corona.

For REAL James Webb Space Telescope imagery, read `references/jwst_explorer.md` and use `/presets/jwst_explorer/`: official release JPEGs explored with a spring pan/zoom camera, numbered points of interest whose captions come from the release text, and a draggable one-camera curtain comparing Webb to Hubble (or NIRCam to MIRI) on the same target. Data-driven truth level; the CC BY credit line stays visible always.

For a deep-space backdrop behind title or closing slides, read `references/cosmos-preset.md` and use `/presets/cosmos_advanced/`: a seeded procedural starfield (realistic magnitude distribution, black-body star colors, scintillation on the brightest ~2%), a tilted Milky Way band with dust lane, optional nebula patches, deterministic meteors, and slow camera drift — embeddable through its rectangular decor module like the Sol preset.

Before creating a NEW WebGL scene or editing any existing one, read `references/webgl-scene-contract.md` — the general quality law (physical grounding, continuity laws, GLSL safety, light discipline, procedural distributions, determinism, embedding). Every rule in it was paid for with a live debugging round.

For the other planets, read `references/planetae-preset.md` and use `assets/planets_advanced/`: Mercury through Neptune in one switchable scene with CC BY photographic textures, real axial tilts (retrograde Venus/Uranus emerge from them), Saturn/Uranus rings, per-planet atmospheres, and a NASA fact-sheet data panel. Sizes are not comparable between planets.

For lunar orbit material, choose between two deliberately different presets:

- Read `references/lunar_orbit.md` and use `assets/lunar_orbit/` for a lightweight analytic two-body explanation.
- Read `references/moon_react_source.md` and use `assets/moon_react_source/` for the full cinematic React Three Fiber experience with original Lunaris textures, displacement, camera interaction, prediction trail, spacecraft attitude, and burn visuals. For decks without React, `assets/moon_advanced/` is the feature-parity plain Three.js port of the same scene (vendored dependencies, import-map based).

Never substitute the illustrative Lunaris playback for a mission ephemeris or numerical propagator.

## Coordinate design and implementation

Inherit theme tokens from design-space-science-deck. Keep controls opaque, readable, keyboard accessible, and outside the primary data region. Avoid glass panels, bloom, neon trails, continuous star-field motion, and camera movement without explanatory value.

Use build-html-science-deck for runtime integration. Keep animation state separate from content and scientific parameters.

## Make motion controllable

Provide play, pause, restart, and deterministic step or scrub behavior when time matters. Stop nonessential autoplay after one cycle. Do not advance slides automatically.

Respect prefers-reduced-motion. Provide a static state that preserves the full explanation. Freeze a documented frame in export mode and wait for WebGL, fonts, and labels before capture.

## Validate

Run scripts/validate-motion-manifest.mjs on the motion manifest. Test keyboard control, reduced motion, export state, frame rate, WebGL fallback, units, parameter bounds, and truth-level labels.

Return the preset ID, scientific model, parameters and units, motion purpose, controls, reduced-motion state, export frame, dependencies, accessible description, and limitations.
