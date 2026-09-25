/* object-build.mjs — A CATALOGUE, AND NOTHING ELSE, BECOMES GEOMETRY.
 * docs/exploded-system-plan.md §4.
 *
 * This is the file that makes the plan's claim true. `sat-build.mjs` and
 * `hab-build.mjs` each carry a hand-written `switch` over shapes, which is
 * why adding an object used to mean writing a builder. This one has no
 * switch and knows nothing about any object: it reads `PARTS`, places the
 * bodies, and hands every shape to `core/hardware-shapes.mjs`.
 *
 * Adding a launch vehicle is therefore:
 *   1. write <object>-parts.mjs
 *   2. run scripts/validate-hardware.mjs, which lists what is still bare
 *   3. fill in `detay` until it passes
 *   4. register the object in exploded_view/index.html
 *
 * The return shape is the one `adapters/catalog.mjs` already consumes:
 * { root, parts: [{ id, part, group, taban, yon, derinlik }] }.
 *
 * three is passed in; this module never imports it.
 */

import { buildShape, knowsKind } from './hardware-shapes.mjs';
import { hardwareMaterials } from './hardware-kit.mjs';

const TAU = Math.PI * 2;

/**
 * One tinted material family per subsystem, built once and shared.
 *
 * Tinting rather than replacing: a part still looks like aluminium and MLI
 * and copper, it is just biased toward its subsystem's colour so the eye
 * can group 40 bodies without reading 40 labels. Cloning per PART instead
 * of per subsystem would have meant ~19 materials x 40 parts of draw calls
 * for no visual gain.
 */
function tintedKits(THREE, subsystems, tokens) {
  const taban = hardwareMaterials(THREE, tokens);
  const kits = new Map();
  /* Only the structural greys take the tint. Copper stays copper, gold
     stays gold, and a thermal blanket that turned blue would be a lie. */
  const BOYANAN = ['alu', 'aluDark', 'metal', 'koyuMetal', 'white'];
  for (const [key, s] of Object.entries(subsystems || {})) {
    const kit = { ...taban };
    const renk = new THREE.Color(s.renk || '#9aa0aa');
    for (const ad of BOYANAN) {
      if (!taban[ad]) continue;
      const m = taban[ad].clone();
      m.color = m.color.clone().lerp(renk, 0.55);
      kit[ad] = m;
    }
    kits.set(key, kit);
  }
  kits.set(null, taban);
  return kits;
}

/**
 * Where the copies of a `qty > 1` row go.
 *
 * A row declares the arrangement instead of the builder guessing it. The
 * guess used to be "2 means mirror on x, 4 means corners", which is right
 * for a spacecraft bus and wrong for nine engines on a thrust structure -
 * those fell through to "all nine at the same point".
 */
function yerlesim(p) {
  const n = p.qty ?? 1;
  const [x, y, z] = p.pos;
  const yer = (q, aci = null) => ({ pos: q, aci });
  if (n === 1) return [yer(p.pos)];
  const d = p.dizilim;

  if (d?.tip === 'halka') {
    /* A ring, optionally with one in the middle: an engine cluster, a set
       of RCS pods, four grid fins. `yonel` turns each copy to face out,
       which four identical fins all pointing the same way need and nine
       engines do not. */
    const cevre = d.merkez ? n - 1 : n;
    const yerler = d.merkez ? [yer([x, y, z], d.yonel ? 0 : null)] : [];
    for (let i = 0; i < cevre; i++) {
      const a = (d.faz ?? 0) + i * TAU / cevre;
      yerler.push(yer([x + Math.cos(a) * d.r, y + Math.sin(a) * d.r, z], d.yonel ? a : null));
    }
    return yerler;
  }
  if (d?.tip === 'dizi') {
    const ek = d.eksen === 'x' ? 0 : d.eksen === 'y' ? 1 : 2;
    return Array.from({ length: n }, (_, i) => {
      const q = [x, y, z];
      q[ek] += (i - (n - 1) / 2) * d.adim;
      return yer(q);
    });
  }
  if (d?.tip === 'ayna') {
    const ek = d.eksen === 'y' ? 1 : 0;
    return [-1, 1].map(s => { const q = [x, y, z]; q[ek] = s * Math.abs(q[ek]); return yer(q); });
  }
  /* No arrangement declared: the spacecraft-bus defaults. */
  if (n === 4) { const r = []; for (const sx of [1, -1]) for (const sy of [1, -1]) r.push(yer([sx * Math.abs(x), sy * Math.abs(y), z])); return r; }
  if (n === 2) return [yer([Math.abs(x), y, z]), yer([-Math.abs(x), y, z])];
  if (n === 3) return [0, 1, 2].map(i => yer([x, y + (i - 1) * 0.42, z]));
  return Array.from({ length: n }, () => yer([x, y, z]));
}

/** Depth from the root, for the explosion's stagger. */
function derinlik(p, indeks) {
  let d = 0, q = p;
  while (q && q.mountsTo && d < 32) { q = indeks.get(q.mountsTo); d++; }
  return d;
}

/**
 * Build a whole object from its catalogue.
 *
 * @param mod   a module exporting PARTS (and optionally SUBSYSTEMS)
 * @param opts  { tokens, scale, lod }
 */
export function buildObject(THREE, mod, { tokens = {}, scale = 1, lod = 'shop' } = {}) {
  const kits = tintedKits(THREE, mod.SUBSYSTEMS, tokens);
  const indeks = new Map(mod.PARTS.map(p => [p.id, p]));
  const root = new THREE.Group();
  const parts = [];
  const ekseni = new THREE.Vector3(0, 0, 1);

  for (const p of mod.PARTS) {
    if (!knowsKind(p.sekil)) {
      throw new Error(`object-build: '${p.sekil}' is not a grammar kind (part ${p.id}). `
        + 'Declare it in core/hardware-shapes.mjs - this builder has no per-object cases.');
    }
    const kit = kits.get(p.sistem) || kits.get(null);
    const yerler = yerlesim(p);
    const d = derinlik(p, indeks);

    yerler.forEach((konum, i) => {
      const yer = konum.pos;
      const { group } = buildShape(THREE, p, { kit, lod });
      /* A ring copy that declares an angle is turned about the vehicle
         axis first, so its own +Z is untouched and `eksenYonu` below still
         means what it says. */
      if (konum.aci !== null && konum.aci !== undefined) {
        group.rotateOnWorldAxis(ekseni, konum.aci);
      }
      /* A part's own axis is +Z by the grammar's contract. A row that needs
         it pointed elsewhere declares the DIRECTION, not Euler angles:
         rotation.set(a, b, c) composes Z first and is the single most
         reliable way to get this wrong. */
      if (p.eksenYonu) {
        const hedef = new THREE.Vector3(...p.eksenYonu).normalize();
        group.quaternion.setFromUnitVectors(ekseni, hedef);
      }
      group.position.set(yer[0] * scale, yer[1] * scale, yer[2] * scale);
      group.scale.setScalar(scale);
      group.userData.part = p;
      group.userData.kopya = i;
      root.add(group);

      /* Separation direction is the reverse of assembly: a part leaves the
         face it was mounted to. Derived from where it sits relative to its
         parent; on the axis, it opens along the vehicle's own axis. */
      const ust = p.mountsTo ? indeks.get(p.mountsTo) : null;
      const yon = new THREE.Vector3(
        yer[0] - (ust ? ust.pos[0] : 0),
        yer[1] - (ust ? ust.pos[1] : 0),
        yer[2] - (ust ? ust.pos[2] : 0));
      if (yon.lengthSq() < 1e-4) yon.set(0, 0, yer[2] >= (ust ? ust.pos[2] : 0) ? 1 : -1);
      yon.normalize();

      parts.push({
        id: p.id + (yerler.length > 1 ? `#${i + 1}` : ''),
        part: p, group,
        taban: group.position.clone(),
        yon, derinlik: d,
      });
    });
  }
  return { root, parts, dispose: () => { /* materials are shared per subsystem */ } };
}

export { yerlesim as placementsFor };
