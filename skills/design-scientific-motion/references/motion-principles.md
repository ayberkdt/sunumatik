# Scientific Motion Principles

## Start with the explanatory job

Every motion must answer a question: What changes, in which order, at what rate, or under which parameter? Remove motion that only makes the slide feel busy.

Choose one of these semantic roles: reveal, trace, comparison, focus, count, parameter sweep, state transition, or simulation. State that role in the motion manifest.

## Cinematic weight (the premium bar)

Flat single-property effects (a bare opacity fade, a lone translateX)
read as template motion and get rejected in review. Motion earns
"premium" through WEIGHT and INTENT, not through more effects:

- Envelopes: every event has an eased attack and a longer decay —
  nothing snaps to full strength or vanishes at full strength.
- Composed movement: the pen preset moves like a HAND (nib, pressure,
  path), not like a progress bar; a zoom transition dives INTO the
  target and leaves a marker behind, not a crossfade.
- Cascades: groups arrive as a stagger (60–120 ms steps, capped total),
  not simultaneously and not one property at a time.
- Camera/viewport moves are anchored: they start from and land on
  meaningful content positions, never drift decoratively.
- ONE primary event at a time. Two simultaneous "big moments" halve
  each other; schedule calm between peaks (a scene breathing quietly
  outperforms four concurrent eruptions).

## Continuity laws

Nothing the eye tracks may step between frames: entrances ramp from
zero, exits fade with their parent, thresholds have fade bands, events
are decaying energy fields rather than swapped objects. For WebGL
scenes the full constitution is `webgl-scene-contract.md` — read it
before creating or editing any scene preset.

## Use restrained timing

- Micro feedback: 160–260 ms.
- Content reveal: 260–480 ms.
- Wipe, trace, or path explanation: 500–1200 ms.
- Multi-step scientific process: 1–4 s with pause and replay.
- Simulation: use a documented physical-to-screen time scale.

Avoid spring, elastic, and overshoot easing for precise quantities, instrument readings, axes, or uncertainty bounds. Prefer smooth acceleration and deceleration or linear timing when elapsed time carries meaning.

## Preserve meaning in every mode

- Reduced motion must show the final state without losing labels, order, or conclusions.
- Export mode must be deterministic. Freeze each loop at a declared progress value and expose that value in the manifest.
- Speaker controls must include play/pause, restart, and a direct way to reach the final state. Add step or scrub controls when intermediate states matter.
- Keyboard focus must be visible. Escape stops a running sequence. Controls need accessible names.

Use an opaque, matte control surface. Do not default to glass panels, bloom, neon glows, generic star fields, or continuous parallax.

## Protect performance

Pause animation when its slide is inactive or the document is hidden. Cap device-pixel ratio for WebGL and canvas. Avoid React state updates on every frame; mutate render objects or use a dedicated animation clock. Precompute stable paths and textures.

## Hand off to build and audit

Give `$build-html-science-deck` the motion manifest, preset files, static fallback, and export progress. Give `$audit-export-science-deck` a short test sequence including reduced motion, keyboard operation, pause behavior, and a deterministic screenshot state.
