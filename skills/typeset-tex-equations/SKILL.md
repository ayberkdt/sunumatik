---
name: typeset-tex-equations
description: Author, normalize, render, style, explain, and validate TeX or LaTeX equations for academic and scientific HTML presentations using KaTeX, MathJax, SVG, or accessible fallback text. Use when slides contain equations, derivations, matrices, aligned systems, symbols, units, uncertainty, or mathematical notation; do not use for general slide narrative, unrelated typography, charts, or source verification.
---

# Typeset TeX Equations

Make mathematical content accurate, elegant, readable from a projector, and accessible. Preserve mathematical meaning over decorative styling.

## Establish notation

Inventory every symbol, index, operator, vector, matrix, unit, and convention. Create a notation ledger when the deck contains more than a few equations. Do not reuse one symbol for different quantities without an explicit scope change.

Read `references/tex-style-guide.md` for notation, delimiters, operator names, vectors, tensors, derivatives, uncertainty, SI units, and punctuation.

## Choose the renderer

Read `references/rendering-profiles.md` and choose:

- KaTeX for fast deterministic browser rendering and common LaTeX;
- MathJax when broader TeX support, MathML, or advanced accessibility is required;
- pre-rendered SVG for locked offline artifacts or strict visual matching;
- native HTML only for very small inline expressions.

Do not assume every LaTeX package is supported. Keep a compatibility list for custom macros. Use `assets/macros.example.json` as the manifest shape when the project does not already define one.

## Compose for slides

Use inline math only for short symbols or relations. Use display math for equations that carry the slide. Break long derivations into meaningful stages instead of shrinking them.

Prefer semantic grouping:

```tex
\begin{aligned}
  r(\nu) &= y - Hx \\
  S(\nu) &= HPH^{\mathsf T} + R \\
  K(\nu) &= PH^{\mathsf T}S^{-1}
\end{aligned}
```

Use `\operatorname{}` for named operators, `\mathrm{}` for upright labels and units, `\boldsymbol{}` or an approved macro for vectors, and deliberate spacing around differentials. Use the same notation in equations, figures, and narration.

## Style the math system

Load a math font compatible with the text system. Prefer STIX Two Math or Latin Modern Math when available and licensed for packaging. Define tokens for equation color, accent, annotation, number, background, border, size, and line height.

Do not color every variable. Use one restrained accent to connect a term to a diagram or explanatory label. Maintain strong contrast and avoid glow around thin glyphs.

Read `references/equation-layouts.md` for hero equations, derivation steps, annotated equations, matrices, cases, and equation-plus-diagram layouts. Use `assets/equation-theme.css` as a starting point.

When an equation should appear stroke by stroke as if handwritten, hand the approved rendered output to `$design-scientific-motion` and its `assets/equation_pen/`; tag ink units at speech level and keep the settled equation self-sufficient.

## Add explanation and accessibility

For every important equation provide:

- a spoken-language interpretation;
- definitions and units for newly introduced symbols;
- assumptions and domain restrictions;
- equation number or stable ID when referenced later;
- accessible text or MathML output appropriate to the renderer.

Do not use an image of an equation when structured math can be rendered. If SVG is required, retain the source TeX and provide accessible text.

## Validate

Run `scripts/validate-tex-equations.mjs` on an equation manifest. Check balanced delimiters, forbidden presentation shortcuts, duplicate IDs, missing accessible text, unknown notation, and suspicious unit formatting. Then render at 1920x1080 and inspect clipping, baselines, font fallback, line breaks, projector legibility, and PDF output.

Return corrected TeX, macro definitions, notation ledger, rendering profile, explanatory text, and unresolved compatibility issues.
