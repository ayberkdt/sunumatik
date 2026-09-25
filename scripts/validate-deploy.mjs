#!/usr/bin/env node
/* validate-deploy.mjs — proves the site still works once .vercelignore has
 * thrown things away.
 *
 * `.vercelignore` is the dangerous kind of file: everything keeps working
 * locally, and the first sign that a needed asset was excluded is a broken
 * page on the live site. So this does not trust the ignore list - it BUILDS
 * the deployed file set from it and then resolves every reference every
 * served page makes, exactly the way a browser would.
 *
 *   node scripts/validate-deploy.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const section = (t) => console.log(`\n-- ${t} ${'-'.repeat(Math.max(0, 56 - t.length))}`);
function ok(cond, name, detail = '') {
  if (cond) { pass++; console.log(`  ok   ${name}${detail ? '  ' + detail : ''}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? '  ' + detail : ''}`); }
}

/* ── 1. the deployed file set ───────────────────────────────────────── */
section('1. Deployed file set');

const ignoreText = fs.readFileSync(path.join(root, '.vercelignore'), 'utf8');
const patterns = ignoreText.split(/\r?\n/)
  .map(l => l.trim())
  .filter(l => l && !l.startsWith('#'));

/* Vercel's ignore syntax follows .gitignore. Only the forms this file
   actually uses are implemented, and anything else is reported rather than
   quietly treated as "keeps everything" - a silently over-permissive
   matcher would make this whole check meaningless. */
function toMatcher(p) {
  if (p.endsWith('/')) { const d = p.slice(0, -1); return (f) => f === d || f.startsWith(d + '/'); }
  if (p.includes('*')) {
    const re = new RegExp('^' + p.split('*').map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*') + '$');
    return (f) => re.test(f);
  }
  return (f) => f === p;
}
const unsupported = patterns.filter(p => p.includes('**') || p.startsWith('!'));
ok(unsupported.length === 0, 'every ignore pattern is one this checker understands',
  unsupported.join(', ') || `${patterns.length} patterns`);
const matchers = patterns.map(toMatcher);
const ignored = (rel) => matchers.some(m => m(rel));

const SKIP_DIR = new Set(['.git', 'node_modules']);
const all = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIR.has(e.name)) continue;
    const abs = path.join(dir, e.name);
    const rel = path.relative(root, abs).split(path.sep).join('/');
    if (e.isDirectory()) walk(abs); else all.push(rel);
  }
})(root);

const deployed = new Set(all.filter(f => !ignored(f)));
const dropped = all.filter(f => ignored(f));
ok(deployed.size > 0 && dropped.length > 0, 'the ignore list both keeps and drops files',
  `${deployed.size} deployed, ${dropped.length} dropped`);

/* ── 2. entry points ────────────────────────────────────────────────── */
section('2. Entry points');
ok(deployed.has('index.html'), 'a root index.html is deployed (otherwise / is a 404)');
ok(deployed.has('demo/index.html'), 'the deck is deployed');
ok(deployed.has('vercel.json'), 'vercel.json is deployed');

const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
ok(!vercel.buildCommand, 'no build command: the repo is served as static files',
  String(vercel.buildCommand));
ok(vercel.outputDirectory === '.', 'output directory is the repo root', String(vercel.outputDirectory));
ok(vercel.cleanUrls === false,
  'cleanUrls is OFF - stripping /index.html would re-root every relative path in a scene');
const mjs = (vercel.headers || []).find(h => h.source.includes('.mjs'));
ok(mjs && mjs.headers.some(x => x.key === 'Content-Type' && /javascript/.test(x.value)),
  '.mjs is served with a JavaScript content type');

/* ── 3. every reference a served page makes ─────────────────────────── */
section('3. References from served pages');

const HREF = /(?:href|src)\s*=\s*"([^"]+)"/g;
const IMPORT = /(?:^|[^\w.])import\s*(?:[^'"]*?from\s*)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
const CSSURL = /url\(\s*['"]?([^'")]+)['"]?\s*\)/g;

const external = (u) => /^(https?:|data:|mailto:|blob:|#|javascript:)/i.test(u);

/* Comments are stripped before scanning. Without this the checker reads
   USAGE EXAMPLES in doc comments as real references: cosmos-decor.mjs and
   sol-decor.mjs both document themselves with an elided path
   ('.../cosmos_advanced/cosmos-decor.mjs'), and both were reported as
   broken links. check-imports.mjs learned the same lesson; the rule is
   that a path inside a comment is prose, not a dependency. */
function stripComments(src, isHtml) {
  let out = '', i = 0;
  const n = src.length;
  if (isHtml) {
    while (i < n) {
      if (src.startsWith('<!--', i)) { const k = src.indexOf('-->', i + 4); i = k < 0 ? n : k + 3; out += ' '; continue; }
      out += src[i++];
    }
    return out;
  }
  const NL = String.fromCharCode(10);
  const BACKSLASH = String.fromCharCode(92);
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '*') { const k = src.indexOf('*/', i + 2); i = k < 0 ? n : k + 2; out += ' '; continue; }
    if (c === '/' && d === '/') { const k = src.indexOf(NL, i); i = k < 0 ? n : k; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const q = c; out += c; i++;
      while (i < n) {
        if (src[i] === BACKSLASH) { out += src[i] + (src[i + 1] ?? ''); i += 2; continue; }
        out += src[i];
        if (src[i] === q) { i++; break; }
        i++;
      }
      continue;
    }
    out += c; i++;
  }
  return out;
}
const pages = [...deployed].filter(f => /\.(html|mjs|js|css)$/.test(f));

const broken = [];
let checked = 0;
for (const file of pages) {
  const src = stripComments(fs.readFileSync(path.join(root, file), 'utf8'), file.endsWith('.html'));
  const dir = path.posix.dirname(file);
  const refs = [];
  for (const m of src.matchAll(HREF)) refs.push(m[1]);
  for (const m of src.matchAll(IMPORT)) refs.push(m[1] ?? m[2]);
  for (const m of src.matchAll(CSSURL)) refs.push(m[1]);
  for (let u of refs) {
    if (!u || external(u)) continue;
    u = u.split('#')[0].split('?')[0];
    if (!u) continue;
    /* Bare specifiers are resolved by the page's own importmap, which the
       browser handles; only real paths are checked here. */
    if (!u.startsWith('.') && !u.startsWith('/')) continue;
    checked++;
    const target = u.startsWith('/')
      ? u.slice(1)
      : path.posix.normalize(path.posix.join(dir, u));
    const candidates = [target, `${target}/index.html`, target.replace(/\/$/, '/index.html')];
    if (!candidates.some(c => deployed.has(c))) {
      broken.push({ file, u, target, droppedByIgnore: dropped.includes(target) });
    }
  }
}
ok(checked > 500, 'enough references were actually resolved for this to mean something',
  `${checked} references across ${pages.length} files`);
const byIgnore = broken.filter(b => b.droppedByIgnore);
ok(byIgnore.length === 0, 'NOTHING a served page needs was dropped by .vercelignore',
  byIgnore.slice(0, 5).map(b => `${b.file} -> ${b.u}`).join(' | ') || 'none');
ok(broken.length === 0, 'every relative reference from a served page resolves',
  broken.slice(0, 5).map(b => `${b.file} -> ${b.u}`).join(' | ') || `${checked} references`);

/* ── 4. the landing page reaches the catalogue ──────────────────────── */
section('4. Landing page coverage');
const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const linked = [...home.matchAll(/href="presets\/([^/"]+)\/index\.html"/g)].map(m => m[1]);
const registry = JSON.parse(fs.readFileSync(path.join(root, 'presets/registry.json'), 'utf8'));
const withPage = registry.presets.filter(p => p.hasIndex).map(p => p.name);
const notLinked = withPage.filter(n => !linked.includes(n));
ok(notLinked.length === 0, 'every preset that has a page is linked from the landing page',
  notLinked.join(', ') || `${linked.length} linked`);
ok(new Set(linked).size === linked.length, 'no preset is listed twice');
const deadLinks = linked.filter(n => !deployed.has(`presets/${n}/index.html`));
ok(deadLinks.length === 0, 'every link on the landing page points at a deployed page',
  deadLinks.join(', '));

/* ── 5. reverse test ────────────────────────────────────────────────── */
section('5. Reverse test');
/* If this checker cannot notice a needed file going missing, it is
   decoration. Pretend the vendored three.js was ignored and confirm the
   resolver fails. */
const victim = [...deployed].find(f => /vendor\/three\.module\.min\.js$/.test(f));
ok(Boolean(victim), 'the vendored three build is in the deployed set', victim || 'not found');
if (victim) {
  const pretend = new Set(deployed);
  pretend.delete(victim);
  let wouldBreak = 0;
  for (const file of pages.filter(f => f.endsWith('.html'))) {
    const src = fs.readFileSync(path.join(root, file), 'utf8');
    const im = /<script\s+type="importmap"[^>]*>([\s\S]*?)<\/script>/.exec(src);
    if (!im) continue;
    let map;
    try { map = JSON.parse(im[1]).imports || {}; } catch { continue; }
    const dir = path.posix.dirname(file);
    for (const v of Object.values(map)) {
      const t = path.posix.normalize(path.posix.join(dir, v));
      if (!pretend.has(t)) wouldBreak++;
    }
  }
  ok(wouldBreak > 0, 'REVERSE TEST: dropping the three build would be caught',
    `${wouldBreak} importmap entries would dangle`);
}

/* Importmap targets must be deployed too - they are not href or import. */
let mapChecked = 0;
const mapBroken = [];
for (const file of pages.filter(f => f.endsWith('.html'))) {
  const src = fs.readFileSync(path.join(root, file), 'utf8');
  const im = /<script\s+type="importmap"[^>]*>([\s\S]*?)<\/script>/.exec(src);
  if (!im) continue;
  let map;
  try { map = JSON.parse(im[1]).imports || {}; } catch { mapBroken.push(`${file}: bad JSON`); continue; }
  const dir = path.posix.dirname(file);
  for (const [k, v] of Object.entries(map)) {
    if (external(v)) continue;
    mapChecked++;
    const t = path.posix.normalize(path.posix.join(dir, v));
    if (!deployed.has(t)) mapBroken.push(`${file} [${k}] -> ${v}`);
  }
}
ok(mapBroken.length === 0, 'every importmap target is deployed',
  mapBroken.slice(0, 4).join(' | ') || `${mapChecked} entries`);

console.log(`\n${'='.repeat(60)}`);
console.log(fail === 0 ? `DEPLOY SURFACE: ${pass}/${pass} passed` : `DEPLOY SURFACE: ${pass} passed, ${fail} FAILED`);
process.exit(fail ? 1 : 0);
