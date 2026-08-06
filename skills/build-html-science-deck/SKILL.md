---
name: build-html-science-deck
description: Implement approved scientific presentation content and visual systems as fixed-stage HTML, CSS, JavaScript, Reveal.js, or React plus TypeScript decks. Use when producing or modifying the actual browser presentation, runtime, components, navigation, offline package, or reading view; do not use for source verification, initial narrative planning, Figma analysis, or final independent audit.
---

# Build HTML Science Deck

Implement the approved slide manifest, copy-density contract, evidence ledger, theme, equations, and visuals without silently changing their meaning.

## Choose the runtime

Read `references/runtime-profiles.md` and select:

- static single-file for simple, durable, offline decks;
- Reveal.js for conventional navigation, fragments, and speaker notes;
- React, TypeScript, and Vite for reusable components, simulations, or complex interactivity;
- Next.js only for a multi-deck portal, authentication, CMS, or server-side services.

Keep the canonical content separate from rendering when practical. Use MDX, JSON, or typed objects rather than hard-coding scientific content into generic components.

## Preserve the stage contract

Author live slides at 1920x1080 and scale the complete stage uniformly. Do not reflow live slide content on phones. Provide a separate linear reading view when requested.

Use visibility, opacity, and pointer-events for slide switching. Do not let later layout declarations accidentally reveal every slide. Read `references/fixed-stage-contract.md` before implementing a custom runtime.

## Build semantic components

Prefer components such as `EvidenceSlide`, `EquationSlide`, `ChartSlide`, `MissionTimeline`, `OrbitDiagram`, `ComparisonSlide`, `MethodSlide`, and `AppendixSlide`. Keep theme values in tokens. Keep content, animation, and export behavior separable.

Keep visible copy separate from speaker notes. Enforce the typography floors supplied by `$enforce-slide-copy-density`. When content overflows, report the conflict and shorten, restructure, or split the slide; do not apply an automatic smaller-font fallback. Refuse to implement copy that fails the `write-assertive-slide-copy` tests — transplanted prose walls and predicate-less keyword piles are build blockers, not style preferences; send them back to the copy pipeline instead of rendering them.

## Integrate equations and visuals

Use outputs from `$typeset-tex-equations`, `$create-scientific-visuals`, and `$design-scientific-motion`. Wait for fonts and math rendering before measuring or exporting. Provide text alternatives for equations, diagrams, nontrivial charts, and interactive simulations.

## Implement interaction conservatively

For between-slide motion, integrate `presets/motion_core/slide-transitions.js` in place of a bare active-class toggle and keep one transition grammar per deck.

Support keyboard navigation, touch, progress, fullscreen, notes, deep links, and reduced motion. Use animation only to explain sequence, causality, scale, orbit, propagation, or transformation. Require pause/replay controls for loops and deterministic progress for export. Disable or settle animations in export mode.

## Package safely

Prefer relative asset paths. Self-host required fonts for offline delivery. Do not expose secrets in frontend code. Run `scripts/validate-deck-manifest.mjs` for structured manifests and use `/presets/deck_starter/index.html` as the minimal runtime reference.

Hand the rendered deck to `$audit-export-science-deck` before final delivery.
