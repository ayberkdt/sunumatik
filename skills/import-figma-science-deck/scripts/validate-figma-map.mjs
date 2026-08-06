#!/usr/bin/env node
import fs from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node validate-figma-map.mjs <figma-map.json>');
  process.exit(2);
}
const map = JSON.parse(fs.readFileSync(file, 'utf8'));
const errors = [];
if (!map.file_key) errors.push('file_key is required');
if (!Array.isArray(map.frames) || !map.frames.length) errors.push('frames must be a non-empty array');
const slideIds = new Set();
for (const frame of map.frames ?? []) {
  if (!frame.node_id || !frame.slide_id) errors.push('every frame needs node_id and slide_id');
  if (slideIds.has(frame.slide_id)) errors.push(`duplicate slide_id: ${frame.slide_id}`);
  slideIds.add(frame.slide_id);
}
for (const asset of map.assets ?? []) {
  if (!asset.node_id || !asset.path || !asset.format) errors.push('every asset needs node_id, path, and format');
}
errors.forEach((error) => console.error(`ERROR: ${error}`));
if (errors.length) process.exit(1);
console.log(`Figma map is valid (${map.frames.length} frames).`);

