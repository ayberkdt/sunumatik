# Conversion matrix

| Source | Preserve directly | Inspect manually |
|---|---|---|
| PPTX | text, notes, images, basic tables, dimensions | charts, SmartArt, equations, groups, theme effects |
| PDF paper | selectable text, metadata, figures | reading order, equations, multi-column flow |
| Scanned PDF | page images | OCR, equations, figures, confidence |
| Legacy HTML | semantic text, assets, links | hidden state, runtime behavior, CSS assumptions |
| Slide images | visual appearance | all semantics, notes, citations, equations |

## Preservation rules

1. Keep the source unchanged.
2. Assign stable IDs to pages, slides, figures, equations, and notes.
3. Record extraction confidence and unsupported objects.
4. Preserve original coordinates as evidence, not as mandatory target layout.
5. Do not OCR an equation silently; flag reconstructed math for review.
6. Keep source credits and citations attached to the corresponding asset.

## Handoff

Return `extraction-manifest.json`, an asset folder, unsupported-item report, and target slide-role mapping.

