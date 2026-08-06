# Figma mapping

| Figma concept | Deck target |
|---|---|
| Variable collection | Theme token group |
| Color variable | Semantic or data-series token |
| Text style | Display/body/mono/numeric/math role |
| Auto Layout row/column | Flex or Grid container |
| Component | Reusable deck component |
| Variant | Typed component variant |
| Frame | Slide or visual region |
| Layout grid | Stage grid and safe area |
| Prototype action | Presentation navigation or reveal intent |
| Export setting | SVG/PNG/WebP asset rule |

## Mapping rules

1. Preserve names when they express semantics; normalize opaque names.
2. Map repeated values to tokens instead of copying raw CSS values.
3. Keep content separate from reusable component structure.
4. Preserve 1920x1080 stage coordinates for the live deck.
5. Translate Auto Layout constraints to semantic Flex/Grid behavior.
6. Use absolute positioning only for fixed diagrams and annotations.
7. Record source file key, node ID, and transformation for traceability.

## Required mapping JSON

```json
{
  "file_key": "",
  "frames": [{"node_id":"", "slide_id":"", "layout":""}],
  "tokens": {},
  "components": [{"figma":"", "code":""}],
  "assets": [{"node_id":"", "path":"", "format":"svg"}],
  "unresolved": []
}
```

