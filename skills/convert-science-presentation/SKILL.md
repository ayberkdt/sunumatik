---
name: convert-science-presentation
description: Extract and migrate scientific content from PPTX, PDF, papers, legacy HTML, or slide images into the science presentation schema while preserving text, order, notes, figures, citations, equations, and provenance. Use for conversion or modernization; do not use for a new deck from a topic, independent scientific verification, or final visual QA.
---

# Convert Science Presentation

Preserve information first, then redesign. Never overwrite the source artifact.

## Classify the source

Read `references/conversion-matrix.md` and choose the extraction path for PPTX, PDF, paper, legacy HTML, or image-only slides. Record what can be preserved structurally and what requires visual or manual interpretation.

## Extract an inventory

Capture slide or page order, titles, text, notes, images, tables, charts, equations, links, credits, dimensions, and layout relationships. Assign stable IDs to extracted items. Keep original coordinates and styles as evidence even when the final design will change.

For PPTX, use `scripts/extract-pptx.py` as a baseline extractor and add `--assets-dir <folder>` when picture blobs must be preserved. Report unsupported shapes, charts, SmartArt, equations, groups, or theme features rather than silently discarding them.

## Reconstruct meaning

Separate semantic content from source layout. Detect repeated headers, footers, citations, and decorative elements. Keep equations in source TeX when available; otherwise flag OCR or reconstruction for `$typeset-tex-equations`.

## Map to the deck schema

Map each source slide to a target slide role, content blocks, evidence IDs, equation IDs, figure assets, notes, and appendix links. Preserve order unless an approved narrative redesign changes it.

## Report fidelity

Return an extraction manifest, asset inventory, preservation map, unsupported-item list, and proposed redesign plan. Require review when scientific meaning is ambiguous or when OCR confidence is low. Hand the mapped content to the narrative, design, build, and audit skills as needed.
