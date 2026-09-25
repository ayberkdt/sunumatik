/* hardware-shapes.mjs — THE DECLARATIVE SHAPE GRAMMAR.
 * docs/exploded-system-plan.md §2.2.
 *
 * A catalogue row says what a part IS and what is on it; this turns that
 * into geometry. The point is that adding an object stops being a coding
 * job: a launch vehicle interstage is the same `tube` as a spacecraft
 * thrust tube with different numbers, and neither one needs a new switch
 * case in a new builder.
 *
 *   { sekil: 'tube', size: [0.86, 0.86, 1.96],
 *     detay: { endRings: true, bolts: 24, ringFrames: 3, longerons: 8 } }
 *
 * Nobody positions a longeron. The row says there are eight.
 *
 * LOD. The same declaration serves three levels, chosen per scene:
 *   block  - silhouette only, for a wide shot or a thumbnail
 *   shop   - structure and interfaces; the default for an exploded view
 *   flight - everything, down to fastener heads; for a hero close-up
 *
 * three is passed in; this module never imports it. Axis contract via
 * core/geometry-axis.mjs only.
 */

import { cylGeoX, cylGeoZ, coneGeoZ } from './geometry-axis.mjs';
import * as K from './hardware-kit.mjs';

const TAU = Math.PI * 2;
export const LODS = Object.freeze(['block', 'shop', 'flight']);
const rank = (lod) => Math.max(0, LODS.indexOf(lod));
/** Is this detail worth drawing at the requested level? */
const at = (lod, need) => rank(lod) >= rank(need);

/** Segment counts fall with LOD; this is most of the triangle budget. */
function segments(lod, base) {
  if (lod === 'block') return Math.max(6, Math.round(base * 0.4));
  if (lod === 'flight') return Math.round(base * 1.25);
  return base;
}

/* ── kinds ────────────────────────────────────────────────────────────
   Each takes (THREE, kit, size, d, lod, ctx) and returns a Group.
   `d` is the row's `detay` block, already defaulted by the caller. */

const KINDS = {
  /**
   * Structural barrel: a spacecraft thrust tube, a rocket interstage, a
   * stage barrel. Its detail keys are the things that make a barrel a
   * structure rather than a pipe.
   */
  tube(THREE, kit, [sx, , sz], d, lod) {
    const g = new THREE.Group();
    const r = sx / 2;
    const skin = new THREE.Mesh(cylGeoZ(r, r, sz, segments(lod, 40), true), d.mat || kit.alu);
    skin.castShadow = skin.receiveShadow = true;
    g.add(skin);
    if (d.endRings && at(lod, 'shop')) {
      for (const e of [-1, 1]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.03, r * 0.05, 8, segments(lod, 36)), kit.alu);
        ring.position.z = e * sz / 2;
        g.add(ring);
        if (d.bolts && at(lod, 'flight')) {
          const b = K.boltCircle(THREE, kit, r * 1.03, d.bolts);
          b.position.z = e * sz / 2;
          g.add(b);
        }
      }
    }
    /* Ring frames carry the buckling load; without them a thin barrel
       under axial compression folds long before it yields. */
    for (let i = 0; i < (at(lod, 'shop') ? d.ringFrames | 0 : 0); i++) {
      const fr = new THREE.Mesh(new THREE.TorusGeometry(r * 1.015, r * 0.022, 6, segments(lod, 32)), kit.aluDark);
      fr.position.z = ((i + 1) / (d.ringFrames + 1) - 0.5) * sz;
      g.add(fr);
    }
    for (let i = 0; i < (at(lod, 'shop') ? d.longerons | 0 : 0); i++) {
      const a = i * TAU / d.longerons;
      const lg = new THREE.Mesh(new THREE.BoxGeometry(r * 0.05, r * 0.03, sz * 0.94), kit.aluDark);
      lg.position.set(Math.cos(a) * r * 1.01, Math.sin(a) * r * 1.01, 0);
      lg.rotation.z = a;
      g.add(lg);
    }
    /* Harness pass-throughs: without them the cables have no legal route
       between decks and the integration order stops making sense. */
    for (let i = 0; i < (at(lod, 'flight') ? d.passThroughs | 0 : 0); i++) {
      const a = 0.6 + i * Math.PI;
      const h = new THREE.Mesh(new THREE.TorusGeometry(r * 0.13, r * 0.022, 6, 16), kit.alu);
      h.position.set(Math.cos(a) * r, Math.sin(a) * r, sz * 0.22);
      h.rotation.y = Math.PI / 2;
      h.rotation.z = a;
      g.add(h);
    }
    g.userData.notes = { regime: 'structure',
      why: 'Ring frames stop the barrel buckling; longerons tie them together and carry axial load.' };
    return g;
  },

  /** Cylindrical tank with domed ends, optionally blanketed. */
  tank(THREE, kit, [sx, , sz], d, lod) {
    const g = new THREE.Group();
    const r = sx / 2;
    const mat = d.mat || kit.alu;
    /* Dome depth as a fraction of the radius. 1.0 is a hemisphere, which is
       what a pressurant sphere wants; a launch vehicle's tank uses an
       ellipsoidal dome at about 0.7, and the difference is not cosmetic -
       hemispherical domes made a 411 t kerolox stage 4.5 m longer than the
       propellant actually needs. `size[2]` is the OVERALL length either
       way, so a row states the tank's envelope and the geometry fits
       inside it. */
    const dr = d.domeRatio ?? 1;
    const govde = Math.max(sz * 0.05, sz - 2 * r * dr);
    const barrel = new THREE.Mesh(cylGeoZ(r, r, govde, segments(lod, 32)), mat);
    barrel.castShadow = true;
    g.add(barrel);
    for (const e of [1, -1]) {
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(r, segments(lod, 28), segments(lod, 14), 0, TAU, 0, Math.PI / 2), mat);
      dome.position.z = e * govde / 2;
      dome.scale.z = dr;
      dome.rotation.x = e > 0 ? 0 : Math.PI;
      dome.castShadow = true;
      g.add(dome);
      if (at(lod, 'shop')) {
        /* Girth weld: on a flight tank this is the most inspected line on
           the vehicle, and it is visible. */
        const weld = new THREE.Mesh(new THREE.TorusGeometry(r * 1.004, r * 0.018, 6, segments(lod, 32)), kit.mliSilver);
        weld.position.z = e * govde / 2;
        g.add(weld);
      }
    }
    for (let i = 0; i < (at(lod, 'shop') ? d.lugs | 0 : 0); i++) {
      const a = i * TAU / d.lugs + Math.PI / 4;
      const lug = new THREE.Mesh(new THREE.BoxGeometry(r * 0.22, r * 0.1, r * 0.3), kit.alu);
      lug.position.set(Math.cos(a) * r * 1.05, Math.sin(a) * r * 1.05, 0);
      lug.rotation.z = a;
      g.add(lug);
    }
    if (d.lugs && at(lod, 'flight')) {
      /* 'flight' is where fasteners appear: the lug ring's bolt heads. */
      g.add(K.boltCircle(THREE, kit, r * 1.05, d.lugs * 2));
    }
    if (d.valve && at(lod, 'shop')) {
      const v = new THREE.Mesh(cylGeoZ(r * 0.1, r * 0.1, r * 0.3, 12), kit.aluDark);
      v.position.z = -sz * 0.52;
      g.add(v);
    }
    if (d.blanket && at(lod, 'shop')) {
      g.add(K.blanketWrap(THREE, kit, r * 1.03, sz * 0.66, d.blanketMap, { seams: 5 }));
    }
    g.userData.notes = { regime: 'fluid',
      why: 'Domed ends turn pressure into membrane tension; a flat end would work in bending.' };
    return g;
  },

  /** Overwrapped pressure vessel. */
  sphere(THREE, kit, [sx], d, lod) {
    const g = new THREE.Group();
    const r = sx / 2;
    g.add(new THREE.Mesh(new THREE.SphereGeometry(r, segments(lod, 28), segments(lod, 20)), d.mat || kit.alu));
    const up = new THREE.Vector3(0, 0, 1);
    for (let i = 0; i < (at(lod, 'shop') ? (d.bands ?? 5) : 0); i++) {
      /* Meridional overwrap. Built by tilting then turning about the WORLD
         axis: rotation.set(PI/2, 0, a) applies Z first and stacks every
         band into one plane. */
      const band = new THREE.Mesh(new THREE.TorusGeometry(r * 1.004, r * 0.028, 6, segments(lod, 30)), kit.aluDark);
      band.rotation.x = Math.PI / 2;
      band.rotateOnWorldAxis(up, i * Math.PI / (d.bands ?? 5));
      g.add(band);
    }
    if (d.boss !== false && at(lod, 'shop')) {
      const boss = new THREE.Mesh(cylGeoZ(r * 0.2, r * 0.2, r * 0.26, 14), kit.alu);
      boss.position.z = r * 0.95;
      g.add(boss);
    }
    if (d.boss !== false && at(lod, 'flight')) {
      const bc = K.boltCircle(THREE, kit, r * 0.26, 8);
      bc.position.z = r * 1.08;
      g.add(bc);
    }
    if (d.saddle && at(lod, 'shop')) g.add(K.tankSaddle(THREE, kit, r));
    g.userData.notes = { regime: 'fluid',
      why: 'A sphere holds a given volume at the least shell mass, which is why pressurant is stored in one.' };
    return g;
  },

  /** Honeycomb panel; radiator variant carries OSR tiles and headers. */
  panel(THREE, kit, size, d, lod) {
    const g = new THREE.Group();
    const [sx, sy, sz] = size;
    const thin = sy < sx && sy < sz;
    const [w, h, t] = thin ? [sx, sz, sy] : [sx, sy, sz];
    const pan = K.honeycombPanel(THREE, kit, w, h, Math.max(t, 0.02), {
      inserts: at(lod, 'flight') && d.inserts !== false,
      osrMap: d.osrMap || null,
    });
    if (thin) pan.rotation.x = Math.PI / 2;
    g.add(pan);
    if (d.lattice && at(lod, 'shop')) {
      /* Grid-fin cells. A lattice keeps working at hypersonic speed where a
         flat fin of the same area stalls, so drawing it as a slab throws
         away the only interesting thing about the part. */
      const n = d.lattice;
      for (let i = 0; i <= n; i++) {
        for (const [uzun, kisa, ex, ey] of [[w, t * 0.9, 0, 1], [h, t * 0.9, 1, 0]]) {
          const c = (i / n - 0.5) * (ey ? h : w);
          const bar = new THREE.Mesh(
            new THREE.BoxGeometry(ex ? kisa : uzun, ex ? uzun : kisa, t * 1.4),
            kit.aluDark);
          bar.position.set(ex ? c : 0, ex ? 0 : c, 0);
          if (thin) { bar.position.set(bar.position.x, 0, bar.position.y); bar.rotation.x = Math.PI / 2; }
          g.add(bar);
        }
      }
    }
    if (d.headers && at(lod, 'shop')) {
      for (const e of [-1, 1]) {
        const hdr = new THREE.Mesh(cylGeoX(0.016, 0.016, w * 0.96, 10), kit.aluDark);
        if (thin) hdr.position.set(0, t * 0.6, e * h * 0.42);
        else hdr.position.set(0, e * h * 0.42, t * 0.6);
        g.add(hdr);
      }
    }
    g.userData.notes = { regime: 'structure',
      why: 'Honeycomb: two thin face sheets far apart carry bending that a solid sheet of the same mass cannot.' };
    return g;
  },

  /** Equipment box; connector count and fins follow the declared spec. */
  box(THREE, kit, [sx, sy, sz], d, lod) {
    const g = new THREE.Group();
    g.add(K.equipmentBox(THREE, kit, sx, sy, sz, {
      connectors: at(lod, 'shop') ? (d.connectors ?? 4) : 0,
      decal: at(lod, 'flight') ? (d.decal || null) : null,
      fins: Boolean(d.fins) && at(lod, 'shop'),
    }));
    g.userData.notes = { regime: 'avionics',
      why: 'Feet stand the box off the panel so the thermal interface filler has somewhere to be.' };
    return g;
  },

  /** Slender rod: magnetorquer, boom, strut. */
  rod(THREE, kit, [sx, , sz], d, lod) {
    const g = new THREE.Group();
    const r = sx / 2;
    g.add(new THREE.Mesh(cylGeoZ(r * (d.coreRatio ?? 0.55), r * (d.coreRatio ?? 0.55), sz, segments(lod, 14)), kit.aluDark));
    for (let i = 0; i < (at(lod, 'shop') ? (d.turns ?? 0) : 0); i++) {
      const turn = new THREE.Mesh(new THREE.TorusGeometry(r * 1.01, r * 0.035, 4, 14), kit.bakir);
      turn.position.z = ((i + 0.5) / d.turns - 0.5) * sz * 0.74;
      g.add(turn);
    }
    for (const e of [-1, 1]) {
      const cap = new THREE.Mesh(cylGeoZ(r * 0.8, r * 0.8, sz * 0.09, 14), kit.alu);
      cap.position.z = e * sz * 0.45;
      g.add(cap);
    }
    if (at(lod, 'flight')) {
      for (const e of [-1, 1]) {
        const bc = K.boltCircle(THREE, kit, r * 0.6, 4);
        bc.position.z = e * sz * 0.49;
        g.add(bc);
      }
    }
    for (let i = 0; i < (at(lod, 'shop') ? (d.clamps ?? 0) : 0); i++) {
      const cl = new THREE.Mesh(new THREE.TorusGeometry(r * 1.1, r * 0.09, 6, 16), kit.alu);
      cl.position.z = (i / Math.max(1, d.clamps - 1) - 0.5) * sz * 0.52;
      g.add(cl);
    }
    return g;
  },

  /** Truss bay: longerons with diagonal bracing. Rockets are made of these. */
  truss(THREE, kit, [sx, sy, sz], d, lod) {
    const g = new THREE.Group();
    const bays = d.bays ?? 3;
    const posts = d.posts ?? 4;
    const r = Math.min(sx, sy) / 2;
    for (let i = 0; i < posts; i++) {
      const a = i * TAU / posts + Math.PI / posts;
      const post = new THREE.Mesh(cylGeoZ(r * 0.06, r * 0.06, sz, segments(lod, 8)), kit.alu);
      post.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
      g.add(post);
      if (!at(lod, 'shop')) continue;
      for (let b = 0; b < bays; b++) {
        /* Diagonals are what make a frame a truss: without them the bay is
           a mechanism and folds under shear. */
        const z0 = (b / bays - 0.5) * sz, z1 = ((b + 1) / bays - 0.5) * sz;
        const a2 = (i + 1) * TAU / posts + Math.PI / posts;
        const p0 = new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, z0);
        const p1 = new THREE.Vector3(Math.cos(a2) * r, Math.sin(a2) * r, z1);
        const mid = p0.clone().add(p1).multiplyScalar(0.5);
        const len = p0.distanceTo(p1);
        const diag = new THREE.Mesh(cylGeoZ(r * 0.03, r * 0.03, len, 6), kit.aluDark);
        diag.position.copy(mid);
        diag.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1),
          p1.clone().sub(p0).normalize());
        g.add(diag);
      }
    }
    for (let b = 0; b <= bays; b++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.04, 6, segments(lod, 24)), kit.alu);
      ring.position.z = (b / bays - 0.5) * sz;
      g.add(ring);
      /* Gussets at the nodes: the joint is where a truss fails, so at
         'flight' the joint is drawn rather than implied. */
      for (let i = 0; i < (at(lod, 'flight') ? posts : 0); i++) {
        const a = i * TAU / posts + Math.PI / posts;
        const gus = new THREE.Mesh(new THREE.BoxGeometry(r * 0.16, r * 0.02, r * 0.16), kit.aluDark);
        gus.position.set(Math.cos(a) * r * 0.94, Math.sin(a) * r * 0.94, (b / bays - 0.5) * sz);
        gus.rotation.z = a;
        g.add(gus);
      }
    }
    g.userData.notes = { regime: 'structure',
      why: 'The diagonals carry shear; posts and rings alone are a mechanism, not a structure.' };
    return g;
  },

  /** Cone: fairing, payload adapter, nose. */
  cone(THREE, kit, [sx, , sz], d, lod) {
    const g = new THREE.Group();
    const mat = (d.mat || kit.alu).clone();
    mat.side = THREE.DoubleSide;
    const c = new THREE.Mesh(coneGeoZ(sx / 2, sz, segments(lod, 28), Boolean(d.open)), mat);
    c.castShadow = true;
    g.add(c);
    for (let i = 1; i <= (at(lod, 'shop') ? (d.hoops ?? 0) : 0); i++) {
      const t = i / ((d.hoops ?? 1) + 1);
      const hoop = new THREE.Mesh(
        new THREE.TorusGeometry((sx / 2) * (1 - t) * 1.02, sx * 0.012, 5, segments(lod, 26)), kit.aluDark);
      hoop.position.z = (t - 0.5) * sz;
      g.add(hoop);
    }
    if (at(lod, 'flight')) {
      const bc = K.boltCircle(THREE, kit, sx / 2 * 0.92, 20);
      bc.position.z = -sz / 2;
      g.add(bc);
    }
    if (d.splitLine && at(lod, 'shop')) {
      /* A fairing separates in halves, and the split line is where. */
      for (const e of [-1, 1]) {
        const seam = new THREE.Mesh(new THREE.BoxGeometry(sx * 0.02, sx * 0.02, sz * 0.98), kit.gold);
        seam.position.set(e * sx * 0.5 * 0.5, 0, 0);
        g.add(seam);
      }
    }
    return g;
  },
  /**
   * Bus primary structure: what actually carries the load between the
   * central tube and the equipment panels.
   *
   * A spacecraft bus is not a box. The tube takes the axial launch load;
   * the SHEAR WEBS between the tube and the corners take the lateral load
   * and stop the panels racking. Corner posts tie the decks together and
   * the panels bolt to them. Draw the box and none of that is visible -
   * which is exactly the complaint this answers.
   */
  busFrame(THREE, kit, [sx, sy, sz], d, lod) {
    const g = new THREE.Group();
    const tubeR = d.tubeR ?? Math.min(sx, sy) * 0.25;
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const up = new THREE.Vector3(0, 0, 1);

    /* Corner posts. */
    for (const ex of [-1, 1]) for (const ey of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(sx * 0.05, sy * 0.05, sz), kit.alu);
      post.position.set(ex * hx * 0.96, ey * hy * 0.96, 0);
      g.add(post);
    }
    /* Perimeter frames close the deck edges into a ring; without them the
       posts are four sticks. */
    for (const ez of [-1, 1]) {
      for (const [w, h, px, py] of [[sx * 0.98, sy * 0.05, 0, hy * 0.96],
        [sx * 0.98, sy * 0.05, 0, -hy * 0.96],
        [sx * 0.05, sy * 0.98, hx * 0.96, 0],
        [sx * 0.05, sy * 0.98, -hx * 0.96, 0]]) {
        const beam = new THREE.Mesh(new THREE.BoxGeometry(w, h, sz * 0.05), kit.aluDark);
        beam.position.set(px, py, ez * hz * 0.96);
        g.add(beam);
      }
    }
    /* Shear webs, radial, tube to corner. Oriented with makeBasis so the
       panel's own axes land on (radial, up, tangential) - composing Euler
       angles here puts every web in the same plane. */
    const webs = d.webs ?? 4;
    for (let i = 0; i < (at(lod, 'shop') ? webs : 0); i++) {
      const a = Math.PI / 4 + i * TAU / webs;
      const kose = Math.min(hx, hy) * 0.96 * Math.SQRT2;
      const genislik = kose - tubeR;
      if (genislik <= 0) continue;
      const web = K.honeycombPanel(THREE, kit, genislik, sz * 0.9, sz * 0.02, {
        inserts: at(lod, 'flight'),
      });
      const radial = new THREE.Vector3(Math.cos(a), Math.sin(a), 0);
      const tan = new THREE.Vector3(Math.sin(a), -Math.cos(a), 0);
      const m = new THREE.Matrix4().makeBasis(radial, up, tan);
      web.quaternion.setFromRotationMatrix(m);
      web.position.copy(radial).multiplyScalar(tubeR + genislik / 2);
      g.add(web);
    }
    /* Struts brace the tube base against the corner posts: the lateral
       load path at the separation plane, where it is highest. */
    for (let i = 0; i < (at(lod, 'shop') ? (d.struts ?? 4) : 0); i++) {
      const a = Math.PI / 4 + i * TAU / (d.struts ?? 4);
      const p0 = new THREE.Vector3(Math.cos(a) * tubeR, Math.sin(a) * tubeR, -hz * 0.9);
      const p1 = new THREE.Vector3(Math.cos(a) * hx * 0.94, Math.sin(a) * hy * 0.94, -hz * 0.1);
      const len = p0.distanceTo(p1);
      const strut = new THREE.Mesh(cylGeoZ(sx * 0.016, sx * 0.016, len, 8), kit.metal);
      strut.position.copy(p0).add(p1).multiplyScalar(0.5);
      strut.quaternion.setFromUnitVectors(up, p1.clone().sub(p0).normalize());
      g.add(strut);
    }
    g.userData.notes = { regime: 'structure',
      why: 'Shear webs between the central tube and the corner posts carry the lateral launch load; the tube alone only carries axial.' };
    return g;
  },

  /**
   * A declared VOLUME rather than a piece of hardware: propellant inside a
   * tank, a pressurised bay, a harness envelope. It is translucent and
   * writes no depth, so it never hides the hardware around it.
   */
  volume(THREE, kit, [sx, sy, sz], d, lod) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: d.renk ?? 0x6f8fb4, roughness: 0.6, metalness: 0.1,
      transparent: true, opacity: d.opacity ?? 0.24, depthWrite: false });
    const m = d.silindir
      ? new THREE.Mesh(cylGeoZ(sx / 2, sx / 2, sz, segments(lod, 24)), mat)
      : new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    g.add(m);
    g.userData.notes = { regime: 'volume',
      why: 'What occupies the space, drawn so the layout can be read without pretending it is hardware.' };
    return g;
  },

  /** Liquid rocket engine. Geometry lives in the kit. */
  engine(THREE, kit, [sx, , sz], d, lod) {
    const g = new THREE.Group();
    g.add(K.rocketEngine(THREE, kit, sx / 2, sz, {
      hoops: at(lod, 'shop') ? (d.hoops ?? 5) : 0,
      turbopump: d.turbopump !== false && at(lod, 'shop'),
      gimbal: d.gimbal !== false && at(lod, 'shop'),
      feedLines: at(lod, 'flight') ? (d.feedLines ?? 2) : 0,
      rThroat: d.rThroat ?? null,
    }));
    return g;
  },

  /** Hall-effect thruster pod. Geometry lives in the kit. */
  hall(THREE, kit, [sx, , sz], d, lod) {
    const g = new THREE.Group();
    g.add(K.hallThruster(THREE, kit, sx / 2, sz, {
      coils: at(lod, 'shop') ? (d.coils ?? 4) : 0,
      bolts: at(lod, 'flight') ? (d.bolts ?? 12) : 0,
      cathode: d.cathode !== false && at(lod, 'shop'),
      feed: Boolean(d.feed) && at(lod, 'shop'),
    }));
    return g;
  },

  /** Fluxgate magnetometer head. */
  magnetometer(THREE, kit, [sx], d, lod) {
    const g = new THREE.Group();
    g.add(K.magnetometerHead(THREE, kit, sx, {
      shade: d.shade !== false && at(lod, 'shop'),
      pigtail: d.pigtail !== false && at(lod, 'shop'),
      cube: d.cube !== false && at(lod, 'shop'),
      bolts: at(lod, 'flight'),
      /* The windings are most of this part's triangles, so 'block' - a wide
         shot or a thumbnail - drops them. */
      windings: at(lod, 'shop') ? 8 : 0,
    }));
    return g;
  },
};

/** Defaults per kind, so a row can declare only what differs. */
const VARSAYILAN = {
  tube: { endRings: true, bolts: 24, ringFrames: 3, longerons: 8, passThroughs: 2 },
  tank: { lugs: 4, valve: true, blanket: false, domeRatio: 1 },
  sphere: { bands: 5, boss: true, saddle: true },
  panel: { inserts: true, headers: false, lattice: 0 },
  box: { connectors: 4, fins: false },
  rod: { turns: 14, clamps: 2, coreRatio: 0.55 },
  truss: { bays: 3, posts: 4 },
  cone: { hoops: 3, open: true, splitLine: false },
  busFrame: { webs: 4, struts: 4 },
  volume: { silindir: false, opacity: 0.24 },
  engine: { hoops: 5, turbopump: true, gimbal: true, feedLines: 2 },
  hall: { coils: 4, bolts: 12, cathode: true, feed: true },
  magnetometer: { shade: true, pigtail: true, cube: true },
};

export const KINDS_AVAILABLE = Object.freeze(Object.keys(KINDS));

/**
 * Build one part from its declaration.
 *
 * @param spec { sekil, size, detay, tech }  a catalogue row
 * @param opts { lod, kit }
 * @returns { group, kind, applied }  `applied` is the resolved detail, which
 *          the density gate reads to tell a declared default from a row that
 *          nobody filled in.
 */
export function buildShape(THREE, spec, { lod = 'shop', kit } = {}) {
  const kind = spec.sekil;
  const fn = KINDS[kind];
  if (!fn) {
    throw new Error(`hardware-shapes: unknown kind '${kind}'. Known: ${KINDS_AVAILABLE.join(', ')}`);
  }
  const applied = { ...(VARSAYILAN[kind] || {}), ...(spec.detay || {}) };
  const group = fn(THREE, kit, spec.size, applied, lod, spec);
  group.name = spec.id || kind;
  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { group, kind, applied };
}

/** Does the grammar know this kind? Used by the catalogue gate. */
export const knowsKind = (k) => Object.prototype.hasOwnProperty.call(KINDS, k);

export { TAU };
