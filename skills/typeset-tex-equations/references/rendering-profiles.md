# Math rendering profiles

## KaTeX

Choose for fast, deterministic rendering and common LaTeX. Pin the version, bundle CSS/fonts for offline delivery, define macros centrally, and test unsupported commands before production.

## MathJax

Choose when broad TeX compatibility, MathML generation, assistive output, or advanced extensions are required. Wait for `MathJax.typesetPromise()` before measurement or export.

## Pre-rendered SVG

Choose for locked artifacts, strict cross-browser fidelity, or export pipelines without a browser math runtime. Preserve source TeX, accessible text, IDs, and font/licensing information. Avoid outlining text unless portability requires it.

## Native HTML

Use only for simple symbols, superscripts, subscripts, or short relations. Do not reconstruct matrices, fractions, radicals, or aligned systems with nested spans.

## Decision tests

Check macro support, offline needs, accessibility, server/browser environment, export fidelity, and math font compatibility. Do not mix renderers within one deck without a documented reason.

