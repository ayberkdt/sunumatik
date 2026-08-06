---
name: orchestrate-science-presentation
description: Plan and coordinate end-to-end academic, astronomy, space-science, engineering, thesis, conference, mission-review, or outreach presentations. Use when a request spans several stages such as evidence gathering, narrative design, visual direction, equations, data visualization, Figma, HTML implementation, conversion, quality review, or export; do not use for a single narrowly scoped equation, chart, citation, or styling edit.
---

# Orchestrate Science Presentation

Coordinate the presentation workflow without absorbing specialist work into this skill.

## Establish the contract

Infer safe defaults when the brief is clear. Ask only for missing information that would materially change the result. Capture purpose, venue, audience expertise, density, duration, source artifacts, output formats, language, notation, branding, rights, offline use, projector conditions, and accessibility needs.

Classify the job as new deck, paper-to-deck, PPTX conversion, Figma implementation, existing-deck enhancement, or data/notebook-to-deck.

## Route the workflow

Use the smallest necessary set of specialist skills:

1. Use `$distill-scientific-insights` to decide which ideas are essential, supporting, appendix-bound, or removable.
2. Use `$structure-scientific-narrative` for slide roles, argument order, pacing, and notes.
3. Use `$craft-scientific-storytelling` for evidence-led tension, transitions, rhythm, and closing synthesis.
4. Use `$write-turkish-slide-copy` or `$write-english-slide-copy` for language-specific visible copy and notes.
5. Use `$enforce-slide-copy-density` to protect one-glance reading and large typography.
6. Use `$verify-scientific-evidence` for claims, sources, provenance, and uncertainty.
7. Use `$design-space-science-deck` for art direction, typography, layouts, and previews.
8. Use `$import-figma-science-deck` only when a Figma source is in scope.
9. Use `$typeset-tex-equations` for TeX, notation, math typography, and equation QA.
10. Use `$create-scientific-visuals` for charts, mission diagrams, or data graphics.
11. Use `$design-scientific-motion` for explanatory animation, simulations, and reusable motion presets.
12. Use `$build-html-science-deck` for implementation.
13. Use `$convert-science-presentation` for PPTX, PDF, or existing-deck preservation.
14. Use `$audit-export-science-deck` for rendered QA and deliverables.

Do not prescribe React, Reveal, Next.js, or a static runtime before classifying interaction and delivery needs.

## Produce the plan

Create a compact plan containing the presentation contract, source-of-truth files, evidence risks, slide and density strategy, preview strategy, runtime decision, equation and visualization needs, validation matrix, deliverables, and completion criteria.

Read `references/workflow-contract.md` for the planning schema. Read `references/routing-matrix.md` when the runtime or specialist boundary is ambiguous. Run `scripts/validate-deck-plan.mjs` when the plan is represented as structured JSON.

## Coordinate checkpoints

Require explicit approval only for decisions that materially change the deck: selected visual direction, disputed interpretation, destructive conversion, external publication, or restricted assets. Continue through reversible implementation and validation work.

Treat these as mandatory gates:

1. Evidence gate before strong scientific claims.
2. Style gate after three authentic previews when art direction is not fixed.
3. Render gate after HTML generation.
4. Export gate after fonts, equations, figures, and notes are stable.

## Define completion

Do not mark the deck complete until every slide has one primary job; visible copy can be understood at a glance; type stays above the agreed floors; notes carry detail that does not belong on screen; epistemic status is clear; citations and credits resolve; equations and units are consistent; screenshots show no clipping or overlap; keyboard and reduced-motion behavior work; and all requested deliverables are verified.
