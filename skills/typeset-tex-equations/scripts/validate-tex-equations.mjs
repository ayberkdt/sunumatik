#!/usr/bin/env node
import fs from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node validate-tex-equations.mjs <equations.json>');
  process.exit(2);
}
const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
const equations = Array.isArray(manifest.equations) ? manifest.equations : [];
const errors = [];
const warnings = [];
const ids = new Set();

function balanced(tex, open, close) {
  let depth = 0;
  for (let i = 0; i < tex.length; i += 1) {
    if (tex[i] === '\\') { i += 1; continue; }
    if (tex[i] === open) depth += 1;
    if (tex[i] === close) depth -= 1;
    if (depth < 0) return false;
  }
  return depth === 0;
}

for (const [index, equation] of equations.entries()) {
  const id = equation.id || `equation ${index + 1}`;
  if (!equation.id) errors.push(`equation ${index + 1}: id is required`);
  if (ids.has(equation.id)) errors.push(`${id}: duplicate id`);
  ids.add(equation.id);
  if (!equation.tex?.trim()) errors.push(`${id}: tex is required`);
  if (!equation.alt?.trim()) errors.push(`${id}: accessible alt text is required`);
  const tex = equation.tex ?? '';
  if (!balanced(tex, '{', '}')) errors.push(`${id}: unbalanced braces`);
  const environmentStack = [];
  for (const token of tex.matchAll(/\\(begin|end)\{([^}]+)\}/g)) {
    if (token[1] === 'begin') environmentStack.push(token[2]);
    else if (environmentStack.pop() !== token[2]) {
      errors.push(`${id}: mismatched environment ${token[2]}`);
      break;
    }
  }
  if (environmentStack.length) errors.push(`${id}: unclosed environment ${environmentStack.at(-1)}`);
  if (/\d\s+(km|m|cm|mm|s|ms|kg|K|Hz|MHz|GHz)\b/.test(tex)) warnings.push(`${id}: units may need \\,\\mathrm{...}`);
  if (/\\hspace\*?\{|\\vspace\*?\{/.test(tex)) warnings.push(`${id}: manual spacing may hide a layout problem`);
}

if (!equations.length) errors.push('equations must be a non-empty array');
warnings.forEach((warning) => console.warn(`WARN: ${warning}`));
errors.forEach((error) => console.error(`ERROR: ${error}`));
if (errors.length) process.exit(1);
console.log(`Equation manifest is valid (${equations.length} equations).`);
