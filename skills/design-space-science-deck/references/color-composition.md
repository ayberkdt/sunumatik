# Color composition

Build hierarchy with opaque color, value, scale, spacing, and geometry. Do not use transparency as a substitute for composition.

## Palette construction

Start from one anchor pair. Expand it into semantic roles: canvas, surface, ink, muted text, accent, accent ink, data colors, warning, and rules. Keep the original pair recognizable.

Use color harmony deliberately:

- monochromatic for quiet scholarly material;
- analogous for continuous phenomena and calm progression;
- complementary or split-complementary for decisive contrast;
- triadic only when three data categories genuinely need equal presence.

The Figma color-combination guide notes that harmony should support visual hierarchy, mood, brand recognition, and accessibility. Color Hunt is useful for discovering pastel, cream, vintage, earth, space, and other palette families, but popularity is not evidence that a palette suits a scientific deck.

Sources:

- https://colorhunt.co/palettes/popular
- https://www.figma.com/resource-library/color-combinations/

## Recommended distribution

Use a flexible 70/20/10 starting distribution:

- about 70% canvas and quiet negative space;
- about 20% structural surface, image, or secondary field;
- about 10% accent and emphasis.

For a vibrant statement slide, invert the balance with one full-bleed accent field and a contrasting ink color. Do not distribute every palette color equally.

## Matte premium language

Prefer:

- opaque cream, paper, mineral, sky, wine, cocoa, sage, navy, and citrus planes;
- thin solid rules;
- crisp color blocking;
- restrained grain or paper texture away from small type;
- duotone scientific imagery;
- oversized typography;
- asymmetrical editorial grids;
- one memorable geometric gesture per theme.

Avoid:

- glassmorphism and frosted cards;
- backdrop blur as a default;
- stacked translucent panels;
- purple-blue-cyan AI gradients;
- neon glow and luminous borders;
- gradient blobs with no scientific meaning;
- a dashboard card grid on every slide.

## Neutral discipline (the "dirty deck" diagnostic)

When a deck reads dirty or muddy without an obvious cause, audit the
NEUTRALS, not the accents (learned in a live retheme):

- Canvas, surfaces, rules, and text grays sit on ONE temperature family.
  Green- or blue-tinted grays next to a warm accent read as grime;
  temperature belongs to accents and data colors, neutrals stay neutral.
- Every color literal comes from the palette tokens. Hand-picked hexes
  drift: a deck accumulates five near-identical greenish surfaces that
  no one chose deliberately. Fixing a dirty deck = sweeping ALL literals
  back to tokens, not adjusting one background.
- Accent washes over surfaces (radial color-mix tints) read as mud on
  projectors — surfaces stay flat; the accent lives in bars, titles,
  and data ink.

## Light discipline

- Glow and brightening SATURATE TOWARD A HUE and cap before white:
  additive white over textured content reads as cheap transparency
  (the "glass" failure). This applies to CSS glows, canvas decors, and
  WebGL alike.
- Uniform halos and evenly spaced rays read as canned filters;
  controlled asymmetry (sector variation, uneven reach) reads as real.
- One light logic per deck: if the theme says light comes from the
  upper left, every shadow, terminator, and highlight agrees.

## Vibrancy without visual noise

Vibrant means decisive chroma and contrast, not maximum saturation everywhere. Put saturated color on a large simple field or one precise accent. Keep charts and equations on stable, high-contrast surfaces.

## Accessibility

Validate every text/background pair. Target WCAG 4.5:1 for ordinary text and prefer 7:1 for small citations or difficult projectors. Never encode a scientific category only by hue; add shape, line style, label, or texture.
