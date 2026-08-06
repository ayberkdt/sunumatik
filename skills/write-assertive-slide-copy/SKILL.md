---
name: write-assertive-slide-copy
description: Turn slide content into text that asserts something specific - full-claim headlines, evidence-bearing support lines, and fragments that keep their predicate through visual structure. Use when slide text is a wall of transplanted prose, a pile of decorative keywords, generic bullets that could fit any deck, topic-only headlines, or when compression has stripped the meaning out of the copy; do not use for language-specific style and idiom (Turkish/English copy skills), word budgets and typography floors (density skill), story order, or fact checking.
---

# Write Assertive Slide Copy

Every visible text element must SAY something — a claim, a relation, a
quantity with a comparison, or an instruction. Text that only NAMES a topic
is decoration, and decoration is not communication.

## Name the enemy: two failure modes

Slide text dies in one of two ways. Diagnose before writing:

- **Text wall** (duvar metin): paragraph prose transplanted from a paper or
  a report. Symptoms: sentences with subordinate clauses, hedging chains,
  references mid-line, type shrunk to fit. The audience reads OR listens —
  never both. The prose belongs in speaker notes; the slide gets its claim.
- **Word confetti** (kelime konfetisi): bare noun phrases with no predicate
  and no relation — "Optimizasyon · Verimlilik · Entegrasyon",
  "Key challenges", "Sonuçlar ve öneriler". Symptoms: bullets of 1–3
  nouns, headlines that are topic labels, lines that survive the Swap Test
  (below). Confetti feels dense and "premium" while carrying nothing;
  it is the more dangerous failure because it LOOKS edited.

The target form between them is the **assertion**: the shortest string
that still makes a checkable statement.

## Run the four tests on every line

1. **Swap Test** — could this line appear unchanged in an unrelated deck?
   ("Sonuçlar", "Genel bakış", "Önemli bulgular") → rewrite until it could
   only belong to THIS slide.
2. **So-What Test** — after reading the line, can the audience answer
   "what is being claimed?" If the answer is only "the slide is about X",
   there is no assertion.
3. **Cover Test** — cover the visuals: does the text still state the
   slide's one job? Cover the text: do the visuals lose their meaning?
   Text and visual must divide labor, not duplicate or orphan each other.
4. **Read-Aloud Test** — a headline should survive being spoken as a
   natural sentence. If no presenter would ever say it, it is a label,
   not a claim.

Read references/assertion-craft.md for worked before/after examples in
Turkish and English, the filler lexicon, and number/parallelism rules.

## Write headlines that claim

The headline is a COMPLETE assertion in sentence case — subject and
predicate, one or two lines: "Kalibrasyon hatayı yarıya indiriyor", not
"Kalibrasyon sonuçları". A topic label is acceptable only for section
dividers and when evidence genuinely does not support a conclusion yet —
then label the epistemic state, not just the noun ("Kalibrasyon: henüz
yargı yok, üç test sürüyor").

## Write support lines that carry evidence

Each support line adds ONE of: the number behind the claim (with its
comparison base and unit), the mechanism, the condition/limit, or the
consequence. One idea per line; parallel lines share grammatical shape.
Never restate the headline in different words — that is duplicated,
not supported.

## Fragments need a structural predicate

A fragment is legitimate when its predicate is carried by structure:
a table cell (column header completes it), a labeled axis or arrow, a
kicker above a number ("Medyan hata" over "0.42→0.21 px"), a diagram
node. Free-floating fragments in body copy are confetti. Test: can the
reader reconstruct the full sentence from position alone?

## Compress without losing the claim

Cut in this order: throat-clearing and meta-talk → adjectives and
intensifiers → hedging doubles (keep ONE calibrated hedge) →
nominalizations back into verbs ("iyileştirme sağlandı" → "iyileşti") →
subordinate detail into notes. STOP before cutting subject, verb, object,
number, unit, comparison base, negation, or condition. If the budget still
does not fit, split the slide or move material to notes — never strip the
predicate to fit the box.

## Validate and hand off

Run scripts/validate-assertions.mjs on the copy manifest; treat findings
as review prompts, not gates. Hand the assertion spec (claim, support
lines, note-bound material) to `write-turkish-slide-copy` or
`write-english-slide-copy` for language surface, then to
`enforce-slide-copy-density` for budget and typography. When density
pressure and assertion completeness conflict, split the slide.
