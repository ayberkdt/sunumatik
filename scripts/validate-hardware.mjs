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

/* Built bodies by catalogue id, kept so a later check can ask for one
   instead of rebuilding the object. */
const __govdeler = new Map();
function nodesOf(ad) {
  const n = __govdeler.get(ad);
  if (!n) throw new Error(`validate-hardware: '${ad}' not built yet`);
  return n;
}

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

/* Grammar kinds that are legitimately one mesh. Named rather than handled by
   lowering the threshold, and the kind must ALSO declare itself a volume in
   `userData.notes.regime` - so the exemption is a property of the thing, not
   of its name, and cannot be claimed by a kind that is merely unfinished. */
const SEKILSIZ = new Set(['volume']);

/* Minimum meshes for a part to count as built rather than blocked out.
   Three is deliberate: a body, a feature and an interface. */
const EN_AZ_MESH = 3;

const OBJECTS = [
  { ad: 'satellite', parts: 'presets/satellite_integration/sat-parts.mjs',
    build: 'presets/satellite_integration/sat-build.mjs', fn: 'buildSatellite', opts: { scale: 1 } },
  { ad: 'habitat', parts: 'presets/habitat_blocks/hab-parts.mjs',
    build: 'presets/habitat_blocks/hab-build.mjs', fn: 'buildHabitat', opts: { env: 'mars' } },
  /* The launch vehicle has NO builder of its own. It goes through
     core/object-build.mjs, which is the whole point of it being here: the
     same density gate that measures two hand-written objects measures one
     that is only a catalogue. */
  { ad: 'launch vehicle', parts: 'presets/launch_vehicle/lv-parts.mjs',
    build: 'presets/core/object-build.mjs', fn: 'buildObject', genel: true, opts: { scale: 1 } },
];

const ozet = [];
for (const o of OBJECTS) {
  section(`${o.ad}`);
  const P = await load(o.parts);
  const B = await load(o.build);
  /* The generic builder takes the catalogue MODULE; a per-object builder
     already knows its own catalogue. */
  const built = o.genel ? B[o.fn](THREE, P, o.opts) : B[o.fn](THREE, o.opts);

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
  __govdeler.set(o.ad, nodes);
  ok(nodes.size > 0, 'bodies were built', `${nodes.size} parts`);

  const sayim = [];
  for (const [id, n] of nodes) sayim.push({ id, ...census(n) });
  sayim.sort((a, b) => a.meshes - b.meshes);

  /* 1. Nothing ships as a bare primitive. */
  const sekli = new Map(P.PARTS.map(q => [q.id, q.sekil]));
  const bagisik = (id) => MUAF.has(id) || SEKILSIZ.has(sekli.get(id));
  const ciplak = sayim.filter(x => x.meshes < EN_AZ_MESH && !bagisik(x.id));
  ok(ciplak.length === 0, `no part is a bare primitive (>= ${EN_AZ_MESH} meshes)`,
    ciplak.length ? ciplak.map(x => `${x.id}(${x.meshes})`).join(', ')
      : `thinnest: ${sayim.filter(x => !bagisik(x.id)).slice(0, 3).map(x => `${x.id} ${x.meshes}`).join(', ')}`);

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
  const ikinci = o.genel ? B[o.fn](THREE, P, o.opts) : B[o.fn](THREE, o.opts);
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
    enInce: sayim.filter(x => !bagisik(x.id))[0] });
}

/* ── the shape grammar ───────────────────────────────────────────────
   This is the part that decides whether a NEW object is cheap. If a kind
   only works for the one row that happened to use it, the grammar is a
   switch with extra steps, so every kind is built at every LOD here. */
section('shape grammar');
{
  const S = await load('presets/core/hardware-shapes.mjs');
  const KIT = (await load('presets/core/hardware-kit.mjs')).hardwareMaterials(THREE);
  /* One size for all kinds on purpose: a kind that needs a particular
     aspect ratio to produce anything is not reusable. */
  const OLCU = [0.6, 0.6, 0.9];

  ok(S.KINDS_AVAILABLE.length >= 8, 'grammar carries a usable vocabulary',
    S.KINDS_AVAILABLE.join(', '));

  const tablo = [];
  let hepsiKuruldu = true, artan = true, gerekce = 0;
  for (const kind of S.KINDS_AVAILABLE) {
    const row = { kind };
    for (const lod of S.LODS) {
      try {
        const { group } = S.buildShape(THREE, { id: `t-${kind}`, sekil: kind, size: OLCU },
          { kit: KIT, lod });
        const c = census(group);
        row[lod] = c.meshes;
        row[lod + 'T'] = c.tris;
        if (lod === 'shop') {
          const muaf = SEKILSIZ.has(kind) && group.userData?.notes?.regime === 'volume';
          if (row[lod] < EN_AZ_MESH && !muaf) hepsiKuruldu = false;
          row.muaf = muaf;
          if (group.userData?.notes?.why) gerekce++;
        }
      } catch (e) {
        row[lod] = `ERR ${e.message.slice(0, 40)}`;
        row[lod + 'T'] = Infinity;
        hepsiKuruldu = false;
      }
    }
    /* Monotone in TRIANGLES, not mesh count: mesh count is what a reader
       sees, triangles are what the GPU pays, and only the second one is the
       claim LOD makes. Measuring meshes passed trivially for seven kinds
       whose 'flight' level added nothing at all. */
    if (!(row.blockT <= row.shopT && row.shopT <= row.flightT)) artan = false;
    tablo.push(row);
  }
  ok(hepsiKuruldu, `every kind builds at 'shop' with >= ${EN_AZ_MESH} meshes`,
    tablo.filter(r => !r.muaf && (typeof r.shop !== 'number' || r.shop < EN_AZ_MESH)).map(r => r.kind).join(', ')
      || `all (${[...SEKILSIZ].join(', ')} exempt as declared volumes)`);
  ok(artan, 'LOD is monotone in triangles (block <= shop <= flight)',
    tablo.map(r => `${r.kind} ${r.blockT}/${r.shopT}/${r.flightT}`).join('  '));

  /* The whole point of 'block' is that a wide shot costs less. If the
     vocabulary as a whole does not get materially cheaper, the level is
     decoration and a 200-part vehicle is still unaffordable. */
  const topla = (lod) => tablo.reduce((a, r) => a + (r[lod + 'T'] || 0), 0);
  const [bl, sh, fl] = ['block', 'shop', 'flight'].map(topla);
  ok(bl <= sh * 0.6, "'block' costs at most 60% of 'shop' across the vocabulary",
    `${bl} / ${sh} = ${(100 * bl / sh).toFixed(0)}%`);
  ok(fl >= sh * 1.2, "'flight' adds at least 20% over 'shop'",
    `${fl} / ${sh} = ${(100 * fl / sh).toFixed(0)}%`);
  ok(gerekce >= 5, 'kinds carry a rationale (userData.notes.why)', `${gerekce}/${S.KINDS_AVAILABLE.length}`);

  /* Reverse test: an unknown kind must FAIL, or the dispatch is silently
     falling back to something and "basic" can ship again. */
  let attı = false;
  try { S.buildShape(THREE, { sekil: 'hicbiri', size: OLCU }, { kit: KIT }); }
  catch { attı = true; }
  ok(attı, 'an unknown kind throws instead of falling back to a box');

  /* Determinism at the grammar level, independent of any one object. */
  const a = census(S.buildShape(THREE, { sekil: 'tube', size: OLCU }, { kit: KIT }).group);
  const b = census(S.buildShape(THREE, { sekil: 'tube', size: OLCU }, { kit: KIT }).group);
  ok(a.meshes === b.meshes && a.tris === b.tris, 'the grammar is deterministic',
    `${a.meshes} meshes, ${a.tris} tris`);

  /* Plan check 2 - undeclared detail. A row that names a grammar kind and
     leaves `detay` out took whatever the default was and moved on, which is
     how a part ends up looking generic while the catalogue looks full.
     It only applies to rows that ACTUALLY route to the grammar: an object
     may keep a richer local case under the same name, and asking those rows
     for `detay` was the wrong criterion (it flagged seven healthy panels). */
  const BEKLENEN_GOLGE = { satellite: ['panel', 'tank'], habitat: [], 'launch vehicle': [] };
  for (const o of OBJECTS) {
    const P = await load(o.parts);
    const B = await load(o.build);
    const yerel = B.LOCAL_KINDS instanceof Set ? B.LOCAL_KINDS : new Set();
    if (o.genel) {
      ok(yerel.size === 0, `${o.ad}: pure catalogue - the builder has no local shapes`,
        `${new Set(P.PARTS.map(q => q.sekil)).size} distinct kinds, all from the grammar`);
    }

    /* Names an object handles itself AND the grammar also knows. Declared,
       bounded, and checked - so a new collision is a failure, not a
       surprise about which geometry a row gets. */
    const golge = [...yerel].filter(k => S.knowsKind(k)).sort();
    const beklenen = (BEKLENEN_GOLGE[o.ad] || []).slice().sort();
    ok(golge.join(',') === beklenen.join(','), `${o.ad}: shadowed kind list is the declared one`,
      golge.length ? golge.join(', ') : 'none');

    /* Every shape a row names must be buildable by one path or the other. */
    const yetim = P.PARTS.filter(p => !yerel.has(p.sekil) && !S.knowsKind(p.sekil)).map(p => p.id);
    ok(yetim.length === 0, `${o.ad}: every row's shape has a builder`, yetim.join(', ') || 'all');

    const bildirimsiz = P.PARTS
      .filter(p => !yerel.has(p.sekil) && S.knowsKind(p.sekil) && !p.detay).map(p => p.id);
    ok(bildirimsiz.length === 0, `${o.ad}: grammar rows declare their detail`,
      bildirimsiz.join(', ') || 'all declared');
  }
}

/* ── the spec drives the drawing ─────────────────────────────────────── */
section('spec drives geometry');
{
  /* Four times now a part's spec line has declared hardware the geometry
     did not have: insert grids under equipment that the catalogue bolts to
     a radiator, "8 runs" of heat pipe drawn as two, a `kizak` slide-rail
     interface with no rail anywhere, and a grounding tab at every seam of a
     blanket that had none. A number in the text that the drawing
     contradicts is worse than no number, so the numbers are now READ. */
  const SB = await load('presets/satellite_integration/sat-build.mjs');
  const SP = await load('presets/satellite_integration/sat-parts.mjs');

  ok(typeof SB.cikarHatSayisi === 'function' && typeof SB.cikarBoltSayisi === 'function',
    'the builder exposes its spec readers');
  ok(SB.cikarHatSayisi({ tech: { detay: '8 runs; 120 W.m capacity each' } }, 2) === 8,
    'run count comes out of the spec line', '"8 runs" -> 8');
  ok(SB.cikarHatSayisi({ tech: { detay: 'no count here' } }, 2) === 2,
    'a spec with no count falls back to the default');
  ok(SB.cikarBoltSayisi({ tech: { baglanti: '24 x M8 A286 bolts' } }, 8) === 24,
    'bolt count comes out of the fastening line', '"24 x M8" -> 24');

  /* And the drawing has to follow it. The heat-pipe row declares 8 runs;
     the body must carry at least that many pieces. */
  const hp = SP.partById('isi-borulari');
  const beyanHat = SB.cikarHatSayisi(hp, 2);
  const govde = nodesOf('satellite').get('isi-borulari');
  const sayim = census(govde);
  ok(beyanHat === 8, 'heat-pipe row still declares 8 runs', `${beyanHat}`);
  ok(sayim.meshes >= beyanHat, 'the heat-pipe body has at least as many pieces as runs declared',
    `${sayim.meshes} meshes / ${beyanHat} runs`);

  /* Every panel that declares a slide-rail interface must carry rails. A
     panel with no rail has 37 meshes; one with them has more, and the
     check is that the two groups differ in the right direction. */
  const rayli = SP.PARTS.filter(q => q.arayuz === 'kizak');
  ok(rayli.length === 4, 'four panels declare a slide-rail interface', `${rayli.length}`);
  /* Comparing mesh counts between panels was the wrong question: the lower
     deck is four times the area of a side panel and carries a bigger insert
     grid, so it wins on count while having no rail at all. Ask whether the
     RAIL IS THERE - the kit marks it as a mechanism - not whether the part
     is busy. */
  const rayVar = (id) => {
    let bulundu = false;
    nodesOf('satellite').get(id)?.traverse(o => {
      if (o.userData?.notes?.regime === 'mechanism') bulundu = true;
    });
    return bulundu;
  };
  const raysiz = rayli.filter(q => !rayVar(q.id)).map(q => q.id);
  ok(raysiz.length === 0, 'every panel that declares a slide rail has one',
    raysiz.join(', ') || rayli.map(q => q.id).join(', '));
  const civatali = SP.PARTS.filter(q => q.sekil === 'panel' && q.arayuz === 'civata');
  const fazladan = civatali.filter(q => rayVar(q.id)).map(q => q.id);
  ok(fazladan.length === 0, 'a bolted panel does NOT get a rail it never declared',
    fazladan.join(', ') || `${civatali.length} bolted panels`);
}

/* ── the ground is painted with its albedo ───────────────────────────── */
section('surface albedo');
{
  const H = await load('presets/habitat_blocks/hab-build.mjs');
  const SL = await load('presets/core/scene-lighting.mjs');
  const zeminRengi = (env) => {
    const built = H.buildHabitat(THREE, { env });
    let c = null;
    built.nodes.get('platform').traverse(o => { if (!c && o.isMesh && o.material?.color) c = o.material.color; });
    return c;
  };
  const ay = zeminRengi('moon'), mars = zeminRengi('mars');
  /* Two bodies whose surfaces differ by a factor of two in albedo were
     drawn in exactly the same brown, because the material ignored its own
     token. The colour IS the albedo, so it has to follow it. */
  ok(ay.getHexString() !== mars.getHexString(), 'Moon and Mars ground are not the same colour',
    `#${ay.getHexString()} vs #${mars.getHexString()}`);
  ok(mars.r > ay.r, 'Mars ground is brighter (albedo 0.25 vs 0.13)',
    `${mars.r.toFixed(3)} vs ${ay.r.toFixed(3)}`);
  /* Lunar regolith is very nearly neutral; Mars is strongly red. */
  const kanalFark = (c) => (c.r - c.b) / Math.max(c.r, 1e-6);
  ok(kanalFark(ay) < kanalFark(mars), 'Mars ground is redder than lunar regolith',
    `Ay ${kanalFark(ay).toFixed(2)} · Mars ${kanalFark(mars).toFixed(2)}`);
  ok(kanalFark(ay) < 0.30, 'lunar regolith stays close to neutral',
    `${kanalFark(ay).toFixed(2)}`);
  ok(typeof SL.yuzeyAlbedoRGB === 'function'
    && SL.yuzeyAlbedoRGB('vacuum')[0] < SL.yuzeyAlbedoRGB('mars')[0],
    'the albedo the lighting reflects off is the one the ground is painted with',
    `${SL.yuzeyAlbedoRGB('vacuum')[0].toFixed(2)} vs ${SL.yuzeyAlbedoRGB('mars')[0].toFixed(2)}`);
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
