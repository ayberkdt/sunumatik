---
name: apply-design-tactics
description: Diagnose a slide or deck by symptom and apply the matching design remedy - busy interface to fewer alignment axes, unbalanced buttons to optical alignment, abrupt gradient edge to eased gradients, weak hierarchy to single-variable contrast, shadow sprawl to two elevation tiers. Use when a layout looks off but the cause is unnamed, when reviewing a rendered deck for craft defects, or when a fix must be justified by a rule instead of taste; do not use to invent a palette or theme, to write slide copy, or to build the runtime.
---

# Apply Design Tactics

Design problems arrive as feelings — "kalabalık", "ucuz duruyor", "bir tuhaf".
This skill converts the feeling into a NAMED symptom, the symptom into a
mechanism, and the mechanism into one instruction. Never fix what you cannot
name; never name what you have not observed.

## Work symptom-first

The loop is fixed and short:

1. **Gözlemle** — look at the rendered slide, not the source. Say what you see
   in observable terms ("üç ayrı sol kenar var"), not in verdicts ("dağınık").
2. **Ölç** — turn the observation into a number wherever a number exists:
   benzersiz x-ekseni sayısı, farklı punto sayısı, gölge kademesi, satır
   başına karakter, slayt başına hareket kancası.
3. **Taktiği bul** — `references/tactics-catalog.md` gives the matching
   Belirti → Neden → Çare → Doğrulama → Kod block. Use its wording; do not
   improvise a parallel vocabulary.
4. **Kök nedene uygula** — fix the RULE (token, class, layout constraint), not
   the instance. A fix that only repairs one slide will be re-broken by the
   next slide.
5. **Yeniden ölç** — the same measurement must move. If it does not, the
   diagnosis was wrong; go back to step 1 instead of stacking a second fix.

One symptom, one remedy, one measurement. Two remedies applied together hide
which one worked.

## Read the catalog

`references/tactics-catalog.md` holds 30 tactics in five families: hizalama ve
iskelet (T-01…T-07), tipografi ve okuma (T-08…T-14), renk/degrade/yüzey
(T-15…T-21), bileşenler (T-22…T-28), hareket (T-29…T-30). Every tactic carries
five fields — Belirti, Neden olur, Çare, Nasıl doğrularsın, Kod — and every
code sample is written in library tokens (`--color-*`, `--ramp-*`,
`--space-*`), so a remedy can be pasted into a deck without inventing values.

The three tactics the deck owner named explicitly are T-01 (kalabalık arayüz →
hizalama eksenlerini azalt), T-02 (dengesiz düğmeler → optik hizalama) and
T-15 (sert degrade kenarı → eased gradient). Read those first; they teach the
catalog's reasoning style — a mechanism, not a preference.

For composition-level diagnosis (what the slide is doing as a whole rather
than which detail is broken), read `references/composition.md` alongside the
catalog, with its overlay layer `assets/composition-guides.css` +
`composition-guides.js` and the worked examples in `composition-demo.html`.
The division of labor: composition decides whether the slide's structure
deserved those elements at all, the catalog repairs the elements that stay.
Diagnose composition first — a beautifully aligned wrong layout is still
wrong, and every catalog fix applied to it is wasted.

## Validate before and after

Run the checker on the deck HTML:

```
node scripts/validate-design-tactics.mjs <deste.html> [...] [--strict] [--json]
```

It reports `dosya · slayt · kural · öneri` and detects fifteen symptoms
automatically: `alignment-axes`, `font-scale`, `radius-scale`, `shadow-tiers`,
`hard-gradient`, `data-color-decor`, `pure-extremes`, `line-measure`,
`lowercase-tracking`, `centered-body`, `type-floor`, `motion-budget`,
`caps-run`, plus the two banned-by-policy rules `neon-glow` and `glass-blur`.
Those two exit with code 1; everything else is a warning that leaves the exit
code alone, because most craft defects need a human to confirm the context.
`--strict` promotes warnings to errors for a release gate.

The checker also prints the tactics it CANNOT see — optical alignment, peer
card heights, proximity grouping, widow lines, legend distance, icon mass.
Those are göz testleri: measure them on a screenshot, never assert them from
source. The script does not guess, and neither should the report.

Turkish text is split Unicode-aware (`\p{L}`) and cased with
`toLocaleUpperCase('tr')`: JS `\b` and `toUpperCase()` both break on ç/ı/ğ/ş/İ,
the same trap documented in `write-assertive-slide-copy/scripts/validate-assertions.mjs`.

Warnings are review prompts, not verdicts. A catalog identifier in capitals, a
centered hero line, a deliberate two-stop scrim on a 2 px rule — each can be
correct. Suppress a warning only with a written reason.

## Apply to new design, not just to review

When designing rather than auditing, run the catalog forward: pick the
layout, then walk the five families and pre-empt each family's most common
failure. In practice this means declaring, before any slide exists, the three
alignment axes, the 6–8 step type scale, the two shadow tiers, the two corner
radii, which hues are reserved for data, and the one narrative motion per
slide. Tactics chosen up front are constraints; tactics chosen afterwards are
repairs.

Take the visual system itself — palette, theme, typography, grid — from
`$design-space-science-deck`. This skill does not create a design language; it
keeps one honest.

## Hand off

Return the symptom list with measurements, the tactic id applied to each, the
diff at the rule level, the before/after measurement, and the göz-testi items
still open. Route palette or theme changes to `$design-space-science-deck`,
copy problems to `$write-assertive-slide-copy`, type floors to
`$enforce-slide-copy-density`, motion behavior to `$design-scientific-motion`,
and rendered-QA sign-off to `$audit-export-science-deck`.

**Orchestrator binding (öneri — `orchestrate-science-presentation` bu ajan
tarafından DÜZENLENMEDİ).** Add to its "Route the workflow" list, immediately
after `$design-space-science-deck` (step 8), and reference it again in the
render gate:

> 8b. Use `$apply-design-tactics` to diagnose craft defects by symptom and
> apply the matching remedy — before implementation as a constraint list
> (alignment axes, type scale, elevation tiers, reserved data hues, motion
> budget), and after the render gate as a measured pass over the built deck.

The natural gate is gate 3 (render): `validate-design-tactics.mjs` runs on the
generated HTML there, and its two error rules (`neon-glow`, `glass-blur`)
already encode the design skill's own avoid-list, so the gate fails on exactly
the violations that deck owner has banned.
