#!/usr/bin/env node
import fs from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node validate-deck-manifest.mjs <deck.json>');
  process.exit(2);
}
const deck = JSON.parse(fs.readFileSync(file, 'utf8'));
const errors = [];
if (!deck.metadata?.title) errors.push('metadata.title is required');
if (!Array.isArray(deck.slides) || !deck.slides.length) errors.push('slides must be a non-empty array');
const ids = new Set();
for (const [index, slide] of (deck.slides ?? []).entries()) {
  const label = slide.id || `slide ${index + 1}`;
  if (!slide.id) errors.push(`slide ${index + 1}: id is required`);
  if (ids.has(slide.id)) errors.push(`${label}: duplicate id`);
  ids.add(slide.id);
  if (!slide.role) errors.push(`${label}: role is required`);
  if (!slide.headline) errors.push(`${label}: headline is required`);
  for (const key of ['evidence_ids', 'equation_ids', 'visual_ids']) {
    if (slide[key] != null && !Array.isArray(slide[key])) errors.push(`${label}: ${key} must be an array`);
  }
}
errors.forEach((error) => console.error(`ERROR: ${error}`));
if (errors.length) process.exit(1);
console.log(`Deck manifest is valid (${deck.slides.length} slides).`);

