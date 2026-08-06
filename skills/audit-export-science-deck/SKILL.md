---
name: audit-export-science-deck
description: Independently inspect rendered scientific HTML presentations for visual overflow, equation quality, evidence traceability, accessibility, interaction, performance, offline behavior, and export fidelity, then produce verified PDF, PNG, or offline deliverables. Use after implementation or for final QA; do not use to invent content, redesign the narrative, or silently alter scientific conclusions.
---

# Audit and Export Science Deck

Audit the rendered artifact, not only its source code. Treat export as a reproducible build.

## Establish the matrix

Read `references/audit-checklist.md`. Determine required viewports, browsers, presentation mode, reading mode, print profile, offline behavior, and deliverables.

## Inspect content integrity

Confirm slide count, order, titles, notes, citations, figure credits, equation IDs, notation, units, uncertainty, appendix links, and evidence references. Report scientific-content concerns without rewriting conclusions unless explicitly asked.

## Inspect rendered quality

At minimum test 1920x1080 and 1366x768. Check text clipping, panel overlap, image crop, font fallback, math baselines, equation overflow, chart labels, safe areas, focus visibility, keyboard navigation, touch behavior, reduced motion, and console errors.

Use both DOM measurements and screenshots. A passing `scrollHeight` check does not prove that grid panels or absolutely positioned annotations do not overlap.

## Inspect accessibility and resilience

Check semantic structure, language, contrast, alt text, equation descriptions, chart summaries, captions, focus order, motion controls, and reading-view order. Verify required assets and fonts load without external network access when offline delivery is requested.

## Export reproducibly

Wait for `document.fonts.ready`, math rendering, images, and animations to settle. Export each slide at the authored 16:9 size, then assemble PDF and image sets. Verify page count, dimensions, backgrounds, credits, links when supported, and final-state animation visibility.

Use `scripts/audit-deck.mjs` for static HTML checks. It recognizes `[data-slide]`, `.slide`, and Reveal.js section decks. Use `scripts/export-deck.mjs` when Playwright is available in the current project; override `--slide-selector` for a custom runtime and use `--browser-executable` when the project deliberately relies on an installed Chromium-family browser. Do not install dependencies silently during every export.

Return the audit report, blocking issues, warnings, generated files, dimensions, sizes, and reproduction commands. Do not declare success while blocking issues remain.
