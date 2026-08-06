#!/usr/bin/env node
import fs from 'node:fs';

const file = process.argv[2];
if (!file || file === '--help') {
  console.log('Usage: node validate-palette-library.mjs <palette-library.json>');
  process.exit(file ? 0 : 2);
}

const library = JSON.parse(fs.readFileSync(file, 'utf8'));
const palettes = Array.isArray(library.palettes) ? library.palettes : [];
const errors = [];
const warnings = [];
const ids = new Set();
const requiredTokens = ['canvas', 'surface', 'ink', 'muted', 'accent', 'accentInk', 'data1', 'data2', 'rule'];
const hexPattern = /^#[0-9A-F]{6}$/i;

function luminance(hex) {
  const channels = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
  const linear = channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(a, b) {
  const first = luminance(a);
  const second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

if (!palettes.length) errors.push('palettes must be a non-empty array');

for (const palette of palettes) {
  const label = palette.id || '<missing-id>';
  if (!palette.id) errors.push('palette id is required');
  if (ids.has(palette.id)) errors.push(`${label}: duplicate id`);
  ids.add(palette.id);
  if (!palette.name) errors.push(`${label}: name is required`);
  if (!palette.pair?.primary || !palette.pair?.secondary) errors.push(`${label}: pair.primary and pair.secondary are required`);
  if (!Array.isArray(palette.character) || !palette.character.length) warnings.push(`${label}: character tags are missing`);

  for (const [name, value] of Object.entries(palette.pair ?? {})) {
    if (!hexPattern.test(value)) errors.push(`${label}: pair.${name} is not a six-digit hex color`);
  }
  for (const token of requiredTokens) {
    const value = palette.tokens?.[token];
    if (!value) errors.push(`${label}: tokens.${token} is required`);
    else if (!hexPattern.test(value)) errors.push(`${label}: tokens.${token} is not a six-digit hex color`);
  }

  const tokenValues = Object.values(palette.tokens ?? {}).map(value => String(value).toUpperCase());
  for (const [name, value] of Object.entries(palette.pair ?? {})) {
    if (hexPattern.test(value) && !tokenValues.includes(value.toUpperCase())) warnings.push(`${label}: original ${name} color ${value} is not used by a semantic token`);
  }

  for (const pair of palette.textPairs ?? []) {
    const foreground = palette.tokens?.[pair.foreground];
    const background = palette.tokens?.[pair.background];
    if (!foreground || !background) {
      errors.push(`${label}: unknown text pair ${pair.foreground}/${pair.background}`);
      continue;
    }
    const ratio = contrast(foreground, background);
    const minimum = Number(pair.minimum ?? library.defaults?.contrastTarget ?? 4.5);
    if (ratio < minimum) errors.push(`${label}: ${pair.foreground} on ${pair.background} is ${ratio.toFixed(2)}:1, below ${minimum}:1`);
    else console.log(`${label}: ${pair.foreground} on ${pair.background} = ${ratio.toFixed(2)}:1`);
  }
}

warnings.forEach(message => console.warn(`WARN: ${message}`));
errors.forEach(message => console.error(`ERROR: ${message}`));
if (errors.length) process.exit(1);
console.log(`Palette library is valid (${palettes.length} palettes, ${warnings.length} warnings).`);
