# Copy and typography budget

These are review thresholds for a 1920x1080 authored stage. A lower count is not automatically better; preserve the words needed for scientific accuracy.

| Profile | Preferred visible words | Review above | Bullets | Typical body size |
|---|---:|---:|---:|---:|
| Speaker-led | 8–30 | 40 | 0–3 | 32–40 px |
| Reading-first | 20–50 | 65 | 0–4 | 30–36 px |
| Technical-review | 20–55 | 70 | 0–5 | 28–34 px |

Count headline, kicker, body, bullets, labels, and callouts. Treat citations separately but keep them readable.

## Typography floors

- Headline: 48 px minimum; normally 56–84 px.
- Body: 30 px minimum; 28 px only for technical appendix material.
- Labels and annotations: 24 px minimum.
- Captions: 22 px minimum.
- Citations and credits: 20 px minimum.
- Equations: follow the equation skill; supporting math normally begins near 34 px.

Projector conditions, font x-height, contrast, and viewing distance can require larger values.

## Rewrite triggers

Rewrite or split when:

- the headline exceeds two lines;
- the headline needs more than about 12 words;
- a paragraph exceeds about 24 words;
- a bullet exceeds about 14 words;
- more than five bullets appear;
- two claims or two visual anchors compete;
- labels overlap or detach from their visual targets;
- the layout proposes smaller type to preserve copy.

## Exceptions

Source slides, regulatory statements, code, tables, and appendices may need specialized layouts. Exceptions must still be readable at presentation distance and should not redefine the main-deck typography system.

## Copy manifest

Use this shape with the validator:

    {
      "profile": "speaker-led",
      "slides": [{
        "id": "slide-001",
        "role": "evidence",
        "headline": "Calibration halves the retrieval error",
        "body": ["The improvement holds across three test sets."],
        "bullets": [],
        "labels": ["Median error"],
        "font_px": {
          "headline": 64,
          "body": 34,
          "label": 26,
          "caption": 22,
          "citation": 20
        }
      }]
    }
