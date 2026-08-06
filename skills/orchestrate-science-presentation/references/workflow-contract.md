# Presentation workflow contract

Use this schema as the compact handoff between skills.

```yaml
presentation:
  title: ""
  purpose: inform|teach|defend|review|propose|outreach
  venue: ""
  audience: ""
  expertise: general|mixed|specialist
  duration_minutes: 20
  density: speaker-led|reading-first|technical-review
  language: tr
  aspect_ratio: 16:9
sources:
  authoritative_files: []
  external_research_required: false
design:
  source: generated|figma|existing
  theme: undecided
runtime:
  profile: undecided
  offline_required: true
content:
  equations: false
  data_visuals: false
  speaker_notes: true
deliverables: [html, pdf]
validation:
  projector: true
  accessibility: WCAG-2.2-AA
  evidence_traceability: true
risks: []
```

Record assumptions beside the field they affect. Do not hide assumptions inside prose.

## Required handoffs

- Narrative: slide manifest with evidence, equation, and visual IDs.
- Evidence: ledger and unresolved claims.
- Design: tokens, selected theme, and layout grammar.
- Build: source files and reproduction commands.
- Audit: blocking issues, warnings, and verified deliverables.

