#!/usr/bin/env node
import fs from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node validate-visual-spec.mjs <visual-spec.json>');
  process.exit(2);
}
const spec = JSON.parse(fs.readFileSync(file, 'utf8'));
const visuals = Array.isArray(spec.visuals) ? spec.visuals : [];
const errors = [];
const warnings = [];
for (const [index, visual] of visuals.entries()) {
  const id = visual.id || `visual ${index + 1}`;
  if (!visual.id) errors.push(`${id}: id is required`);
  if (!visual.question) errors.push(`${id}: scientific question is required`);
  if (!visual.type) errors.push(`${id}: type is required`);
  if (!visual.alt) errors.push(`${id}: accessible description is required`);
  if (!Array.isArray(visual.data_sources) || !visual.data_sources.length) warnings.push(`${id}: no data_sources`);
  if (visual.type !== 'diagram' && !visual.units && !visual.unitless) warnings.push(`${id}: units or unitless=true should be declared`);
  if (visual.scale === 'log' && !visual.log_base) warnings.push(`${id}: logarithmic scale has no base`);
}
if (!visuals.length) errors.push('visuals must be a non-empty array');
warnings.forEach((warning) => console.warn(`WARN: ${warning}`));
errors.forEach((error) => console.error(`ERROR: ${error}`));
if (errors.length) process.exit(1);
console.log(`Visual specification is valid (${visuals.length} visuals).`);

