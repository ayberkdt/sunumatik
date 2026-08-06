---
name: structure-scientific-narrative
description: Turn papers, research notes, experiment results, mission concepts, thesis material, or technical reports into a rigorous slide-by-slide scientific narrative. Use for outlines, slide roles, pacing, speaker notes, appendix planning, and selecting a density profile; do not use for final copy compression, source verification, equation rendering, visual design, or HTML implementation.
---

# Structure Scientific Narrative

Transform a ranked insight brief into a presentation argument before composing final copy. Use `$distill-scientific-insights` first when the source does not clearly reveal what is essential.

## Choose the narrative model

Read `references/narrative-models.md` and choose the closest model: conference research talk, thesis defense, mission concept or review, technical tutorial, scientific proposal, or public outreach. Prefer the source's real logic over an artificial story arc.

## Separate claim types

Label statements as observation, inference, hypothesis, projection, recommendation, or limitation. Preserve uncertainty and negative results. Never turn correlation into causation or a preliminary result into a conclusion.

## Build the slide manifest

For every slide define:

```yaml
id: transit-depth
role: evidence
headline: "The repeated 1.4% dip is consistent with a planetary transit"
takeaway: "Three events share depth and duration within uncertainty"
evidence_ids: [obs-03, obs-04]
visual_intent: "Aligned light curves with uncertainty band"
equation_ids: []
speaker_notes: "Explain detrending before interpreting the dip."
estimated_seconds: 55
```

Write conclusion-style headlines when evidence supports them. Use neutral topic headings when the result is unresolved.

## Control density

Choose `speaker-led`, `reading-first`, or `technical-review`. Read `references/density-and-pacing.md` for planning limits, not final line-editing rules. Define one primary job per slide and distinguish visible copy from note-bound explanation. Route final copy through `$enforce-slide-copy-density`; that skill owns compression and rendered copy checks. Split a slide instead of shrinking text, compressing equations, or stacking unrelated charts.

## Plan notes and appendix

For each slide provide an opening sentence, explanation, evidence cue, relevant limitation, transition, and estimated time. Move derivations, parameter tables, robustness checks, and secondary figures to a linked appendix.

## Review the story

Confirm that the research question precedes the result; methods are sufficient to trust it; every visual answers a question; each conclusion traces to evidence; limitations precede recommendations; and the ending states what is known, unknown, and next.

Return a slide manifest and notes outline, not finished visual design or HTML. Use `$craft-scientific-storytelling` when the correct sequence still lacks tension, transitions, or rhythm. Use the appropriate Turkish or English copy skill before density enforcement.
