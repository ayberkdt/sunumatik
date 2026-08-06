---
name: enforce-slide-copy-density
description: Reduce and validate visible presentation text so slides remain glanceable, projector-readable, and compatible with large typography while preserving the central scientific meaning. Use when slides contain paragraphs, long bullets, excessive labels, multi-line titles, tiny fonts, or copy that competes with charts and equations; do not use to choose the scientific conclusions, translate languages, invent a story arc, or perform final rendered QA.
---

# Enforce Slide Copy Density

Treat the screen as a visual aid, not a page. Protect meaning by moving explanation to speech and notes instead of shrinking it.

## Choose the density profile

Use speaker-led, reading-first, or technical-review. Read references/copy-budget.md for role-specific budgets and typography floors. Treat budgets as split-or-rewrite triggers, not permission to fill every available word.

## Identify the one job

State the single thing the audience should notice or understand. Remove content that does not support that job. Split the slide when two independent claims, visuals, or reasoning steps compete.

## Compress in the right order

1. Delete repetition and throat-clearing.
2. Convert prose into a claim, relationship, number, or short explanation.
3. Move caveats, transitions, and derivation detail to notes.
4. Move robustness checks and reference material to the appendix.
5. Split the slide if the remaining ideas still compete.

Do not remove uncertainty, conditions, units, negation, comparison bases, or evidence qualifications merely to save space.

Never compress past the predicate: a slide reduced to bare noun phrases ("keyword confetti") fails this skill's contract even when it fits the budget. If the assertion cannot survive the budget, split the slide or move material to notes — see `write-assertive-slide-copy` for what must survive compression.

## Protect typography

At a 1920x1080 authored stage, normally keep headlines at least 48 px, body copy at least 30 px, labels at least 24 px, and citations at least 20 px. A technical appendix may use 28 px body text only when tested from presentation distance.

Never reduce type below the floor to make content fit. Shorten, restructure, enlarge the visual, split the slide, or move detail to notes.

## Validate the copy contract

Run scripts/validate-slide-copy.mjs against a copy manifest. Review warnings manually because equations, proper nouns, source lines, and tables require context.

Return the revised headline, visible copy, note-bound material, appendix-bound material, split recommendation, word counts, and minimum font sizes. Hand the contract to design-space-science-deck and build-html-science-deck.
