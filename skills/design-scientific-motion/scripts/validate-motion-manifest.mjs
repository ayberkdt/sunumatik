#!/usr/bin/env node
import fs from 'node:fs';

const [file, jsonFlag] = process.argv.slice(2);
if (!file || file === '--help') {
  console.log('Usage: node validate-motion-manifest.mjs <motion-manifest.json> [--json]');
  process.exit(file ? 0 : 2);
}

const allowedTypes = new Set(['reveal', 'trace', 'comparison', 'focus', 'count', 'parameter-sweep', 'state-transition', 'simulation']);
const allowedTruth = new Set(['illustrative', 'analytic', 'numerical', 'data-driven']);
const errors = [];
const warnings = [];
const add = (list, id, message) => list.push({ id, message });

let data;
try {
  data = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (error) {
  console.error(`Invalid JSON: ${error.message}`);
  process.exit(2);
}

if (!Array.isArray(data.motions) || data.motions.length === 0) add(errors, 'motions', 'motions must be a non-empty array.');
const ids = new Set();
for (const [index, motion] of (data.motions || []).entries()) {
  const at = `motions[${index}]`;
  if (!motion.id || typeof motion.id !== 'string') add(errors, `${at}.id`, 'A stable id is required.');
  else if (ids.has(motion.id)) add(errors, `${at}.id`, `Duplicate id: ${motion.id}`);
  else ids.add(motion.id);
  if (!allowedTypes.has(motion.type)) add(errors, `${at}.type`, `Unknown type: ${motion.type}`);
  if (!allowedTruth.has(motion.truthLevel)) add(errors, `${at}.truthLevel`, `Unknown truth level: ${motion.truthLevel}`);
  for (const field of ['purpose', 'reducedMotion', 'exportState', 'accessibility']) {
    if (!motion[field]) add(errors, `${at}.${field}`, `${field} is required.`);
  }
  if (motion.loop && !motion.pauseControl) add(errors, `${at}.pauseControl`, 'Looping motion requires an explicit pause control.');
  if (motion.durationMs > 5000 && !motion.pauseControl) add(warnings, `${at}.durationMs`, 'Long motion should provide pause/replay controls.');
  if (motion.loop && motion.purpose === 'decorative') add(warnings, `${at}.purpose`, 'Remove nonessential decorative loops from scientific slides.');
  if (['analytic', 'numerical'].includes(motion.truthLevel)) {
    if (!motion.model) add(errors, `${at}.model`, 'Model-driven motion requires a model description.');
    if (!motion.limitations) add(errors, `${at}.limitations`, 'Model-driven motion requires limitations.');
  }
  if (motion.truthLevel === 'numerical' && !motion.solver) add(errors, `${at}.solver`, 'Numerical motion requires solver details.');
  if (motion.truthLevel === 'data-driven' && (!Array.isArray(motion.sourceIds) || !motion.sourceIds.length)) {
    add(errors, `${at}.sourceIds`, 'Data-driven motion requires sourceIds.');
  }
}

const result = { file, motions: (data.motions || []).length, errors, warnings };
if (jsonFlag === '--json') console.log(JSON.stringify(result, null, 2));
else {
  console.log(`Motions: ${result.motions} | Errors: ${errors.length} | Warnings: ${warnings.length}`);
  for (const item of errors) console.log(`ERROR ${item.id}: ${item.message}`);
  for (const item of warnings) console.log(`WARNING ${item.id}: ${item.message}`);
}
process.exit(errors.length ? 1 : 0);
