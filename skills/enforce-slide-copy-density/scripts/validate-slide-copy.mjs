#!/usr/bin/env node
import fs from 'node:fs';

const file = process.argv[2];
if (!file || file === '--help') {
  console.log('Usage: node validate-slide-copy.mjs <copy-manifest.json>');
  process.exit(file ? 0 : 2);
}

const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
const profiles = {
  'speaker-led': { reviewWords: 40, bullets: 3, bodyMin: 30 },
  'reading-first': { reviewWords: 65, bullets: 4, bodyMin: 30 },
  'technical-review': { reviewWords: 70, bullets: 5, bodyMin: 28 },
};
const profile = profiles[manifest.profile];
const errors = [];
const warnings = [];
const slides = Array.isArray(manifest.slides) ? manifest.slides : [];
const ids = new Set();

function strings(value) {
  if (Array.isArray(value)) return value.filter(item => typeof item === 'string');
  return typeof value === 'string' && value.trim() ? [value] : [];
}

function words(value) {
  return strings(value)
    .flatMap(text => text.match(/\p{L}[\p{L}\p{N}'’.-]*|\p{N}+(?:[.,]\p{N}+)*/gu) ?? []);
}

if (!profile) errors.push('profile must be speaker-led, reading-first, or technical-review');
if (!slides.length) errors.push('slides must be a non-empty array');

for (const [index, slide] of slides.entries()) {
  const label = slide.id || `slide ${index + 1}`;
  if (!slide.id) errors.push(`${label}: id is required`);
  if (ids.has(slide.id)) errors.push(`${label}: duplicate id`);
  ids.add(slide.id);
  if (!slide.headline?.trim()) errors.push(`${label}: headline is required`);

  const headlineWords = words(slide.headline).length;
  const body = strings(slide.body);
  const bullets = strings(slide.bullets);
  const visibleWords = words([
    slide.kicker ?? '',
    slide.headline ?? '',
    ...body,
    ...bullets,
    ...strings(slide.labels),
    ...strings(slide.callouts),
  ]).length;

  if (headlineWords > 12) warnings.push(`${label}: headline has ${headlineWords} words; review for one-glance reading`);
  if (profile && visibleWords > profile.reviewWords) warnings.push(`${label}: ${visibleWords} visible words exceeds the ${manifest.profile} review threshold of ${profile.reviewWords}`);
  if (profile && bullets.length > profile.bullets) warnings.push(`${label}: ${bullets.length} bullets exceeds the ${manifest.profile} review threshold of ${profile.bullets}`);
  body.forEach((text, item) => {
    const count = words(text).length;
    if (count > 24) warnings.push(`${label}: body item ${item + 1} has ${count} words and reads like a paragraph`);
  });
  bullets.forEach((text, item) => {
    const count = words(text).length;
    if (count > 14) warnings.push(`${label}: bullet ${item + 1} has ${count} words`);
  });

  const font = slide.font_px;
  if (!font) {
    warnings.push(`${label}: font_px is missing; typography floors were not checked`);
  } else {
    const floors = {
      headline: 48,
      body: slide.role === 'appendix' && manifest.profile === 'technical-review' ? 28 : (profile?.bodyMin ?? 30),
      label: 24,
      caption: 22,
      citation: 20,
    };
    for (const [role, floor] of Object.entries(floors)) {
      if (font[role] != null && Number(font[role]) < floor) errors.push(`${label}: ${role} font ${font[role]}px is below the ${floor}px floor`);
    }
    if (font.headline == null) warnings.push(`${label}: headline font size is not declared`);
    if ((body.length || bullets.length) && font.body == null) warnings.push(`${label}: body font size is not declared`);
  }

  if (slide.notes && body.length === 1 && slide.notes.trim() === body[0].trim()) {
    warnings.push(`${label}: speaker notes duplicate the visible body`);
  }
}

warnings.forEach(message => console.warn(`WARN: ${message}`));
errors.forEach(message => console.error(`ERROR: ${message}`));
if (errors.length) process.exit(1);
console.log(`Slide copy manifest is valid (${slides.length} slides, ${warnings.length} warnings).`);
