# Equation layouts

## Hero equation

One display equation centered with a short interpretation, symbol strip, and source or equation ID. Keep decoration quiet.

## Staged derivation

Reveal one logically meaningful line at a time. Keep previous lines visible in muted form when they provide context. Do not animate individual glyphs.

## Annotated equation

Use one or two accent colors to connect terms to labels or a diagram. Repeat the color with shape, underline, bracket, or callout so meaning is not color-only.

## Equation plus diagram

Place math and diagram on a shared grid. Align terms and diagram labels semantically. Keep both large enough to read independently.

## Matrices and cases

Increase line spacing and surrounding whitespace. Break large matrices into block structure or appendix detail. Never reduce them until indices become indistinguishable.

## Aesthetic treatment (the "premium equation" checklist)

- The display equation is a DESIGN OBJECT: `.equation-block` (accent side
  bar + quiet surface) or an equivalent card from card-presets — never a
  bare formula floating on canvas between unrelated content.
- Whitespace does the luxury work: at least 40 px clear space around the
  block; the equation never touches card edges or competes with body text
  for the same column.
- Term color carries MEANING only (annotated-equation pattern above);
  decorative multicolor math reads as a textbook scan. One accent + one
  muted tone suffice.
- Stacked lines align equals signs (see alignment-and-grid.md); fraction
  bars and radicals at display size need the serif/math font declared by
  the theme, not the UI font's fallbacks.
- Interpretation line under the block (`.equation-explanation`) states
  what the equation CLAIMS in words — assertion rules apply.
- For motion: token-by-token writing = equation-writing preset; term-by-
  term explanation of a finished equation = equation-steps preset. Choose
  one; both on the same equation is noise.

## Projector checks

- Main equation normally 48–78 px equivalent at 1920x1080.
- Supporting math normally 34–52 px equivalent.
- Avoid thin low-contrast glyphs.
- Confirm subscripts, primes, hats, bars, and Greek letters survive PDF rendering.

