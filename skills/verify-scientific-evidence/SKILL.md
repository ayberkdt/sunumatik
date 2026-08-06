---
name: verify-scientific-evidence
description: Audit scientific presentation claims, citations, data provenance, uncertainty, figure credits, DOI or arXiv references, and source-to-slide traceability. Use when accuracy, current research, external sources, datasets, images, or institutional evidence matter; do not use for narrative pacing, theme design, equation layout, or deck implementation.
---

# Verify Scientific Evidence

Build an evidence ledger that traces every consequential statement and visual to its source.

## Inventory evidence

Extract claims, numbers, datasets, borrowed equations, figures, photographs, and mission facts. Classify each claim as observation, inference, hypothesis, projection, recommendation, or background fact.

Read `references/evidence-ledger.md` for the schema. Record title, authors or institution, DOI/arXiv/URL, publication and access dates, dataset version, figure identifier, license or credit, transformation, and confidence.

## Verify authoritative sources

Prefer papers, official mission pages, instrument documentation, standards, and primary datasets. Browse when facts may have changed, a paper or page is named, or precise attribution is needed. Do not cite search-result pages.

For every quantitative claim verify value, unit, population or sample, time range, uncertainty, preprocessing, derived calculations, and whether slide wording is stronger than the source.

## Preserve epistemic status

Flag unsupported causality, cherry-picked ranges, truncated axes, missing baselines, hidden exclusions, and projections presented as observations. Keep null and negative results visible when they constrain the conclusion.

## Audit figures and media

Record creator, source, license, credit line, modifications, and reuse status. Distinguish public-domain assets from assets that merely appear publicly. Never infer that an agency logo or third-party image is unrestricted.

## Produce outputs

Return a structured evidence ledger, slide-level short citations, bibliography entries, figure credits, unresolved-evidence report, and recommended wording changes.

Run `scripts/validate-evidence-ledger.mjs` when a JSON ledger is available. Do not fabricate missing bibliographic fields; mark them unresolved.

