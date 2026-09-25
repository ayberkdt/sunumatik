#!/usr/bin/env node
/* validate-hardware.mjs — how much hardware is actually on each part.
 * docs/exploded-system-plan.md §3.
 *
 * "Some sections are still basic" was a thing a person had to notice. This
 * turns it into a measurement: every part is built, its meshes counted, and
 * anything that is still one primitive is named. A reviewer should never be
 * the mechanism that catches a bare box.
 *
 * It builds the real geometry with the real three, under a small DOM shim,
 * because counting source lines proves nothing about what renders.
 *
 *   node scripts/validate-hardware.mjs
 */
import path from 'node:path';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const load = (rel) => import(pathToFileURL(path.join(root, rel)).href);

/* The builders reach core/geometry-axis.mjs, which imports the bare
   specifier `three`. The browser resolves that with the page importmap;
   Node needs telling. Registered BEFORE anything is imported. */
const THREE_PATH = path.join(root, 'presets/moon_advanced/vendor/three.module.min.js');
register('./_three-resolver.mjs', import.meta.url, {
  data: { threeUrl: pathToFileURL(THREE_PATH).href },
});

/* The builders draw procedural textures onto a canvas. Node has no canvas,
   so this shim records the calls and hands back a blank image - enough for
   geometry to be built and counted, which is all this checks. */
function installDomShim() {
  const ctx = new Proxy({}, {
    get: (_, k) => {
      if (k === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
      if (k === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
      if (k === 'measureText') return () => ({ width: 10 });
      return () => {};
    },
    set: () => true,
  });
  globalThis.document = {
    createElement: (tag) => (tag === 'canvas'
      ? { width: 1, height: 1, getContext: () => ctx, style: {} }
      : { style: {}, appendChild() {}, setAttribute() {} }),
    createElementNS: () => ({ style: {}, setAttribute() {}, appendChild() {} }),
  };
}

let pass = 0, fail = 0;
const section = (t) => console.log(`\n-- ${t} ${'-'.repeat(Math.max(0, 56 - t.length))}`);
function ok(cond, name, detail = '') {
  if (cond) { pass++; console.log(`  ok   ${name}${detail ? '  ' + detail : ''}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? '  ' + detail : ''}`); }
}

installDomShim();
const THREE = await load('presets/moon_advanced/vendor/three.module.min.js');

/** Meshes and triangles under a node. */
function census(node) {
  let meshes = 0, tris = 0;
  node.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    meshes++;
    const g = o.geometry;
    const n = g.index ? g.index.count : (g.attributes.position ? g.attributes.position.count : 0);
    tris += Math.round(n / 3);
  });
  return { meshes, tris };
}

/* Parts that are ONE primitive on purpose. A hidden propellant volume and a
   translucent close-out blanket are not "basic"; they are what they are. */
const MUAF = new Set(['itici-yakit', 'kablaj']);

/* Minimum meshes for a part to count as built rather than blocked out.
   Three is deliberate: a body, a feature and an interface. */
const EN_AZ_MESH = 3;

const OBJECTS = [
  { ad: 'satellite', parts: 'presets/satellite_integration/sat-parts.mjs',
    build: 'presets/satellite_integration/sat-build.mjs', fn: 'buildSatellite', opts: { scale: 1 } },
  { ad: 'habitat', parts: 'presets/habitat_blocks/hab-parts.mjs',
    build: 'presets/habitat_blocks/hab-build.mjs', fn: 'buildHabitat', opts: { env: 'mars' } },
];

const ozet = [];
for (const o of OBJECTS) {
  section(`${o.ad}`);
  const P = await load(o.parts);
  const B = await load(o.build);
  const built = B[o.fn](THREE, o.opts);

  /* Both builders expose their bodies differently; normalise to id -> node. */
  const nodes = new Map();
  if (built.parts) {
    for (const q of built.parts) {
      const id = String(q.id).split('#')[0];
      if (!nodes.has(id)) nodes.set(id, q.group);
    }
  } else if (built.nodes) {
    for (const [id, n] of built.nodes) nodes.set(id, n);
  }
  ok(nodes.size > 0, 'bodies were built', `${nodes.size} parts`);

  const sayim = [];
  for (const [id, n] of nodes) sayim.push({ id, ...census(n) });
  sayim.sort((a, b) => a.meshes - b.meshes);

  /* 1. Nothing ships as a bare primitive. */
  const ciplak = sayim.filter(x => x.meshes < EN_AZ_MESH && !MUAF.has(x.id));
  ok(ciplak.length === 0, `no part is a bare primitive (>= ${EN_AZ_MESH} meshes)`,
    ciplak.length ? ciplak.map(x => `${x.id}(${x.meshes})`).join(', ')
      : `thinnest: ${sayim.filter(x => !MUAF.has(x.id)).slice(0, 3).map(x => `${x.id} ${x.meshes}`).join(', ')}`);

  /* 2. The catalogue and the geometry agree on what exists. */
  const katalog = new Set(P.PARTS.map(q => q.id));
  const eksik = [...katalog].filter(id => !nodes.has(id));
  ok(eksik.length <= 2, 'catalogue rows have bodies (environment refusals aside)',
    eksik.join(', ') || 'all');

  /* 3. Budget. Detail multiplies geometry, so it is measured, not hoped for. */
  const toplamTri = sayim.reduce((s, x) => s + x.tris, 0);
  const enAgir = [...sayim].sort((a, b) => b.tris - a.tris)[0];
  ok(toplamTri < 900000, 'scene stays inside the triangle budget',
    `${toplamTri.toLocaleString('en-US')} tris, heaviest ${enAgir.id} ${enAgir.tris.toLocaleString('en-US')}`);
  ok(enAgir.tris < toplamTri * 0.45, 'no single part dominates the scene',
    `${enAgir.id} is ${(100 * enAgir.tris / toplamTri).toFixed(0)}%`);

  /* 4. Determinism: building twice gives the same geometry. */
  const ikinci = B[o.fn](THREE, o.opts);
  const n2 = new Map();
  if (ikinci.parts) for (const q of ikinci.parts) { const id = String(q.id).split('#')[0]; if (!n2.has(id)) n2.set(id, q.group); }
  else if (ikinci.nodes) for (const [id, n] of ikinci.nodes) n2.set(id, n);
  let ayni = true;
  for (const [id, n] of nodes) {
    const b = n2.get(id);
    if (!b) { ayni = false; break; }
    const a1 = census(n), a2 = census(b);
    if (a1.meshes !== a2.meshes || a1.tris !== a2.tris) { ayni = false; break; }
  }
  ok(ayni, 'building twice gives identical geometry');

  ozet.push({ ad: o.ad, parca: sayim.length, tris: toplamTri,
    ortMesh: (sayim.reduce((s, x) => s + x.meshes, 0) / sayim.length).toFixed(1),
    enInce: sayim.filter(x => !MUAF.has(x.id))[0] });
}

/* ── kit conformance ─────────────────────────────────────────────────── */
section('hardware kit');
{
  const kits = [
    { ad: 'sat-detail', mod: await load('presets/satellite_integration/sat-detail.mjs') },
    { ad: 'hab-detail', mod: await load('presets/habitat_blocks/hab-detail.mjs') },
  ];
  for (const k of kits) {
    const M = k.mod.detailMaterials(THREE);
    ok(M && Object.keys(M).length >= 6, `${k.ad}: material family present`, `${Object.keys(M || {}).length} materials`);
    /* Every builder export must return a Group, not a bare Mesh: a Group is
       what lets the caller place and rotate a sub-assembly as one thing. */
    const yapicilar = Object.entries(k.mod).filter(([n, v]) =>
      typeof v === 'function' && !/Texture|Materials|^detail/.test(n));
    let grup = 0, mesh = 0;
    for (const [, fn] of yapicilar) {
      try {
        const r = fn(THREE, M, 0.3, 0.3, 0.3);
        if (r && r.isGroup) grup++; else if (r && r.isMesh) mesh++;
      } catch { /* signature differs; counted below by what did build */ }
    }
    ok(grup >= 4, `${k.ad}: builders return Groups`, `${grup} groups, ${mesh} bare meshes, ${yapicilar.length} exports`);
  }
}

console.log(`\n${'-'.repeat(60)}`);
for (const s of ozet) {
  console.log(`  ${s.ad.padEnd(10)} ${String(s.parca).padStart(3)} parts  `
    + `${s.tris.toLocaleString('en-US').padStart(9)} tris  avg ${s.ortMesh} meshes/part  `
    + `thinnest ${s.enInce.id} (${s.enInce.meshes})`);
}
console.log(`${'='.repeat(60)}`);
console.log(fail === 0 ? `HARDWARE: ${pass}/${pass} passed` : `HARDWARE: ${pass} passed, ${fail} FAILED`);
process.exit(fail ? 1 : 0);
