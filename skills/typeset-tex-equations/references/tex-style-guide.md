# TeX style guide

## Semantics

- Use `$...$` for short inline math and `\[...\]` or renderer-specific display blocks for display math.
- Use `\operatorname{}` for named operators such as `diag`, `rank`, and `argmin` when no standard command exists.
- Use `\mathrm{d}` for differentials when that convention is adopted: `\int f(x)\,\mathrm{d}x`.
- Use `\mathsf T` consistently for transpose when chosen.
- Use `\boldsymbol{x}` or one declared macro for vectors; do not switch between arrow and bold conventions.
- Use `\mathbf{A}` or a declared macro for matrices.
- Use `\text{}` for short prose inside math.

## Units and uncertainty

Keep units upright: `42\,\mathrm{km}`. Prefer a consistent SI macro layer when supported. Write uncertainty explicitly, for example `1.42 \pm 0.08\,\%`, and state whether it is standard deviation, standard error, or confidence interval.

## Punctuation

Treat display equations as part of the sentence. Add commas or periods when grammatically required, unless the deck's visual system places punctuation in the accompanying prose.

## Macros

Declare a small deck-wide macro set. Avoid package-specific macros unsupported by the chosen renderer. Keep macro names semantic and stable.

## Avoid

- manual spacing used to fake alignment;
- raw Unicode lookalikes mixed unpredictably with TeX glyphs;
- unexplained symbol changes;
- color as the only distinction;
- long derivations squeezed onto one slide;
- `\displaystyle` everywhere without layout review;
- **raw TeX markup leaking into HTML copy** — "K_N", "V_nm", "10^-8" as
  literal card/table text (it happened in a live deck). Outside typeset
  blocks use Unicode sub/superscripts consistently (Kₙ, Vₙₘ, 10⁻⁸) or
  typeset the fragment; inside one deck pick ONE mechanism and stay with
  it.

