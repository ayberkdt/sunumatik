# Typography and layout

## Font roles

- Display: distinctive but legible titles.
- Body: neutral, open counters, strong projector readability.
- Mono/numeric: telemetry, catalog IDs, code, aligned numbers.
- Math: STIX Two Math or Latin Modern Math when available.

Check Turkish `ç ğ ı İ ö ş ü`, Greek, mathematical operators, superscripts, and subscripts. Prefer self-hosted WOFF2 and document licenses.

Useful families include IBM Plex Sans/Mono, Source Sans 3, Source Serif 4, Atkinson Hyperlegible, STIX Two Text/Math, and carefully limited Oxanium or Space Mono accents.

## Stage grid

- Canvas: 1920x1080.
- Safe area: at least 96 px horizontal and 72 px vertical.
- Grid: 12 columns, 24–32 px gutters.
- Baseline: 8 px.
- Headline text: at least 48 px; normally 56–84 px on the authored stage.
- Body text: at least 30 px; 28 px only for a tested technical appendix.
- Labels and annotations: at least 24 px.
- Captions: at least 22 px.
- Citations and credits: at least 20 px; never make critical evidence unreadable.

Treat these as typography floors, not targets. Increase them for poor projectors, low x-height fonts, long viewing distances, or public venues. If copy does not fit, use the output of `$enforce-slide-copy-density`: shorten, move detail to notes or appendix, change the layout, or split the slide. Never solve density by reducing type below the floor.

## Layout archetypes

Cover, section, statement, question, method, evidence, equation, equation-plus-diagram, chart focus, annotated figure, comparison, process, mission timeline, architecture, risk matrix, conclusion, appendix, and sources.

Avoid repeating card grids on every slide. Use negative space as structure, not as empty decoration.
