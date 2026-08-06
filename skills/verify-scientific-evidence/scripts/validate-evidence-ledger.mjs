#!/usr/bin/env node
import fs from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node validate-evidence-ledger.mjs <ledger.json>');
  process.exit(2);
}

const ledger = JSON.parse(fs.readFileSync(file, 'utf8'));
const errors = [];
const warnings = [];
const claims = Array.isArray(ledger.claims) ? ledger.claims : [];
const sources = Array.isArray(ledger.sources) ? ledger.sources : [];
const figures = Array.isArray(ledger.figures) ? ledger.figures : [];
const sourceIds = new Set(sources.map((source) => source.id));

if (!claims.length) errors.push('claims must contain at least one claim');
if (!sources.length) errors.push('sources must contain at least one source');

const duplicateIds = (items) => items.map((item) => item.id).filter((id, index, ids) => !id || ids.indexOf(id) !== index);
for (const id of duplicateIds([...claims, ...sources, ...figures])) errors.push(`missing or duplicate id: ${id ?? '<empty>'}`);

for (const claim of claims) {
  if (!claim.statement) errors.push(`${claim.id}: statement is required`);
  if (!claim.type) errors.push(`${claim.id}: type is required`);
  if (!Array.isArray(claim.source_ids) || claim.source_ids.length === 0) warnings.push(`${claim.id}: no source_ids`);
  for (const id of claim.source_ids ?? []) if (!sourceIds.has(id)) errors.push(`${claim.id}: unknown source ${id}`);
  if (claim.status === 'verified' && !(claim.source_ids ?? []).length) errors.push(`${claim.id}: verified claim has no source`);
}

for (const source of sources) {
  if (!source.title) errors.push(`${source.id}: title is required`);
  if (!source.url && !source.doi && !source.arxiv) warnings.push(`${source.id}: no URL, DOI, or arXiv identifier`);
}

for (const figure of figures) {
  if (figure.source_id && !sourceIds.has(figure.source_id)) errors.push(`${figure.id}: unknown source ${figure.source_id}`);
  if (figure.reuse_status === 'verified' && !figure.license) warnings.push(`${figure.id}: verified reuse has no license field`);
}

warnings.forEach((warning) => console.warn(`WARN: ${warning}`));
errors.forEach((error) => console.error(`ERROR: ${error}`));
if (errors.length) process.exit(1);
console.log(`Evidence ledger is valid (${claims.length} claims, ${sources.length} sources, ${figures.length} figures).`);

