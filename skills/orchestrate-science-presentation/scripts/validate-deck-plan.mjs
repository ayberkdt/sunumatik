#!/usr/bin/env node
import fs from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node validate-deck-plan.mjs <plan.json>');
  process.exit(2);
}

const plan = JSON.parse(fs.readFileSync(file, 'utf8'));
const errors = [];
const allowedDensity = new Set(['speaker-led', 'reading-first', 'technical-review']);
const required = ['title', 'purpose', 'audience', 'density'];

for (const key of required) {
  if (!plan.presentation?.[key]) errors.push(`presentation.${key} is required`);
}
if (plan.presentation?.density && !allowedDensity.has(plan.presentation.density)) {
  errors.push(`presentation.density must be one of: ${[...allowedDensity].join(', ')}`);
}
if (!Array.isArray(plan.deliverables) || plan.deliverables.length === 0) {
  errors.push('deliverables must be a non-empty array');
}

if (errors.length) {
  errors.forEach((error) => console.error(`ERROR: ${error}`));
  process.exit(1);
}
console.log('Deck plan is valid.');

