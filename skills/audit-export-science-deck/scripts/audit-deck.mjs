#!/usr/bin/env node
import fs from 'node:fs';

const args = process.argv.slice(2);
const file = args.find(argument => !argument.startsWith('--'));
const jsonFlag = args.includes('--json');
if (!file || file === '--help') {
  console.log('Usage: node audit-deck.mjs <deck.html> [--json]');
  process.exit(file ? 0 : 2);
}
const html = fs.readFileSync(file, 'utf8');
const checks = [];
const add = (severity, code, message) => checks.push({ severity, code, message });
const has = pattern => pattern.test(html);

if (!has(/<html[^>]+lang=["'][^"']+["']/i)) add('error', 'html-lang', 'Missing html lang attribute.');
if (!has(/<title>[^<]+<\/title>/i)) add('error', 'title', 'Missing non-empty document title.');
if (!has(/name=["']viewport["']/i)) add('error', 'viewport', 'Missing viewport meta tag.');
const classSlides = [...html.matchAll(/class=["'][^"']*\bslide\b[^"']*["']/gi)].length;
const dataSlides = [...html.matchAll(/\bdata-slide(?:\s|=|>)/gi)].length;
const revealSections = /class=["'][^"']*\breveal\b/i.test(html) ? [...html.matchAll(/<section\b/gi)].length : 0;
const slides = Math.max(classSlides, dataSlides, revealSections);
if (!slides) add('error', 'slides', 'No [data-slide], .slide, or Reveal.js slide section found.');
if (!has(/1920/) || !has(/1080/)) add('warning', 'stage-size', 'Could not confirm a 1920x1080 authored stage.');
if (!has(/prefers-reduced-motion/i)) add('warning', 'reduced-motion', 'No reduced-motion CSS detected.');
if (!has(/@media\s+print/i)) add('warning', 'print-css', 'No print stylesheet detected.');
if (!has(/document\.fonts\.ready|fonts\.ready/i)) add('warning', 'font-ready', 'No explicit font readiness wait detected.');

for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
  if (!/\balt=["'][^"']*["']/i.test(match[0])) add('error', 'image-alt', `Image lacks alt: ${match[0].slice(0, 90)}`);
}
for (const match of html.matchAll(/(?:src|href)=["'](https?:\/\/[^"']+)["']/gi)) {
  add('warning', 'external-asset', `External dependency may break offline delivery: ${match[1]}`);
}

const summary = {
  file,
  slides,
  errors: checks.filter(item => item.severity === 'error').length,
  warnings: checks.filter(item => item.severity === 'warning').length,
  checks,
};
if (jsonFlag) console.log(JSON.stringify(summary, null, 2));
else {
  console.log(`Slides: ${slides} | Errors: ${summary.errors} | Warnings: ${summary.warnings}`);
  for (const item of checks) console.log(`${item.severity.toUpperCase()} ${item.code}: ${item.message}`);
}
process.exit(summary.errors ? 1 : 0);
