/* sat-detail.mjs — SPACECRAFT HARDWARE DETAIL KIT.
 *
 * The habitat got a detail kit and the satellite did not, which is why its
 * thrust tube was one open cylinder, its pressurant tank a bare sphere and
 * every honeycomb panel a plain box. A spacecraft is not smooth: it is
 * blankets, bolt circles, connectors, brackets, standoffs and labels, and
 * those are what make the scale of it readable.
 *
 * Every item here answers a requirement, and the comment says which one.
 * Nothing is decoration.
 *
 * three is passed in; this module never imports it. Axis contract: no bare
 * CylinderGeometry / ConeGeometry / LatheGeometry - core/geometry-axis.mjs.
 */

import { cylGeoX, cylGeoY, cylGeoZ, coneGeoZ } from '../core/geometry-axis.mjs';

const TAU = Math.PI * 2;

/* ── materials ────────────────────────────────────────────────────────
   One family, built once and shared. A new material per greeble would
   multiply draw calls for no visual gain. */
export function detailMaterials(THREE, tokens = {}) {
  const std = (c, r, m, ek = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...ek });
  return {
    /* Gold MLI: the colour everyone recognises, and it is not arbitrary -
       the outer layer is aluminised Kapton and Kapton is amber. */
    mli: std(tokens.mli ?? 0xc9a24a, .62, .55),
    mliSilver: std(0xb9bec6, .38, .78),
    alu: std(0xa8aeb8, .44, .72),
    aluDark: std(0x5a6068, .58, .66),
    black: std(0x22262c, .86, .16),
    connector: std(0x8f6a3a, .42, .82),
    gold: std(0xd0a84e, .34, .88),
    white: std(0xd8dae0, .72, .12),
    /* OSR radiator tiles are second-surface mirrors: near-white to the eye,
       very low absorptance. */
    osr: std(0xe6ecf2, .10, .30),
    cell: std(0x1b2b3f, .28, .52),
  };
}

/* ── procedural textures ─────────────────────────────────────────────── */

/** MLI quilt: tape seams one way, layer joins the other, crinkle highlights. */
export function mliTexture(THREE, { tint = '#c9a24a' } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = tint; g.fillRect(0, 0, 256, 256);
  /* Tape seams run one way only. Equal lines both ways reads as woven
     fabric, which is what the habitat blanket looked like before it was
     fixed. */
  g.strokeStyle = 'rgba(60,44,18,.24)'; g.lineWidth = 2;
  for (let x = 0; x <= 256; x += 38) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
  g.strokeStyle = 'rgba(60,44,18,.08)'; g.lineWidth = 1;
  for (let y = 0; y <= 256; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
  /* Crinkle: a blanket is never flat, and the highlights are what say so. */
  g.fillStyle = 'rgba(255,240,205,.10)';
  for (let i = 0; i < 120; i++) {
    const x = (i * 71) % 256, y = (i * 113) % 256;
    g.fillRect(x, y, 10 + (i % 7), 3);
  }
  g.fillStyle = 'rgba(40,28,8,.08)';
  for (let i = 0; i < 90; i++) g.fillRect((i * 97) % 256, (i * 59) % 256, 7, 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** OSR tile grid: discrete quartz mirrors with visible grout lines. */
export function osrTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#e9eef4'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(120,134,150,.55)'; g.lineWidth = 2;
  for (let i = 0; i <= 256; i += 32) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke();
  }
  /* Tiles are individually bonded, so they are never perfectly uniform.
     The first version stepped the highlighted tile by (5, 3) per index,
     which walks a straight diagonal across the grid - the panel came out
     with visible stripes running corner to corner. A hashed index picks
     tiles that do not line up. */
  g.fillStyle = 'rgba(190,205,220,.30)';
  let h = 2166136261 >>> 0;
  for (let i = 0; i < 26; i++) {
    h ^= i + 0x9e37; h = Math.imul(h, 16777619) >>> 0;
    const tx = (h >>> 5) % 8, ty = (h >>> 17) % 8;
    g.fillRect(tx * 32 + 2, ty * 32 + 2, 28, 28);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Solar cell grid with interconnect fingers and bus bars. */
export function cellTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#16263a'; g.fillRect(0, 0, 256, 256);
  /* Cell boundaries. */
  g.strokeStyle = 'rgba(150,180,215,.40)'; g.lineWidth = 2;
  for (let i = 0; i <= 256; i += 42) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke();
  }
  /* Interconnect fingers: the fine lines that carry current off each cell. */
  g.strokeStyle = 'rgba(190,210,235,.22)'; g.lineWidth = 1;
  for (let i = 0; i <= 256; i += 6) { g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke(); }
  /* Bus bars, thicker, one per cell column. */
  g.strokeStyle = 'rgba(210,225,245,.55)'; g.lineWidth = 3;
  for (let i = 21; i <= 256; i += 42) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Identification decal: part number over a pale plate. */
export function decalTexture(THREE, lines, { bg = '#cfd4da', fg = '#23262c' } = {}) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 256, 96);
  g.fillStyle = fg; g.textAlign = 'center';
  lines.forEach((t, i) => {
    g.font = `${i === 0 ? 'bold 30' : '21'}px "Segoe UI", sans-serif`;
    g.fillText(t, 128, 48 + (i - (lines.length - 1) / 2) * 32 + 10);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ── parts ────────────────────────────────────────────────────────────
   Each returns a Group at its own origin; the caller places it. */

/**
 * Bolt circle on a flange.
 *
 * Count comes from the catalogue's fastening text where it is declared, so
 * the drawing and the spec cannot disagree about how many bolts hold a
 * part on.
 */
export function boltCircle(THREE, M, r, n = 12, { head = null } = {}) {
  const g = new THREE.Group();
  const rb = head ?? Math.max(r * 0.035, 0.006);
  for (let i = 0; i < n; i++) {
    const a = i * TAU / n;
    const b = new THREE.Mesh(cylGeoZ(rb, rb, rb * 1.5, 6), M.aluDark);
    b.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
    g.add(b);
  }
  return g;
}

/**
 * Honeycomb panel: face sheets, a visible core at the edge, and the insert
 * grid equipment actually bolts into. A plain box gives no sense that the
 * panel is 25 mm of structure rather than a sheet of card.
 */
export function honeycombPanel(THREE, M, w, h, t, { inserts = true, osrMap = null } = {}) {
  const g = new THREE.Group();
  const face = osrMap
    ? new THREE.MeshStandardMaterial({ map: osrMap, roughness: .12, metalness: .3 })
    : M.alu;
  if (osrMap) { osrMap.repeat.set(Math.max(2, w * 2.2), Math.max(2, h * 2.2)); }
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, t), face);
  body.castShadow = body.receiveShadow = true;
  g.add(body);
  /* Edge close-out: the aluminium channel that caps the core. Without it
     the panel reads as a solid slab. */
  for (const [dx, dy, ew, eh] of [[0, h / 2, w, t * 0.9], [0, -h / 2, w, t * 0.9],
    [w / 2, 0, t * 0.9, h], [-w / 2, 0, t * 0.9, h]]) {
    const e = new THREE.Mesh(new THREE.BoxGeometry(ew, eh, t * 1.06), M.aluDark);
    e.position.set(dx, dy, 0);
    g.add(e);
  }
  if (inserts) {
    /* Potted inserts on a regular pitch: this is where the equipment bolts
       go, and their spacing is why boxes sit where they sit. */
    const nx = Math.max(2, Math.round(w / 0.22)), ny = Math.max(2, Math.round(h / 0.22));
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny; j++) {
        if ((i + j) % 2) continue;
        const ins = new THREE.Mesh(cylGeoZ(0.008, 0.008, t * 1.12, 6), M.aluDark);
        ins.position.set((i / (nx - 1) - 0.5) * w * 0.9, (j / (ny - 1) - 0.5) * h * 0.9, 0);
        g.add(ins);
      }
    }
  }
  return g;
}

/**
 * Equipment box: chassis, mounting feet, a connector bank and a decal.
 *
 * The connector count follows the box's declared power and data: a unit
 * that draws 340 W and moves 420 Mbps does not leave the bench with two
 * plugs on it.
 */
export function equipmentBox(THREE, M, w, h, d, { connectors = 4, decal = null, fins = false } = {}) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M.alu);
  body.castShadow = body.receiveShadow = true;
  g.add(body);
  /* Machined lid with its own fastener line. */
  const lid = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, h * 0.05, d * 0.9), M.aluDark);
  lid.position.y = h / 2;
  g.add(lid);
  /* Mounting feet: the box stands off the panel so the interface gap
     filler has somewhere to be. */
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(w * 0.14, h * 0.1, d * 0.14), M.aluDark);
    f.position.set((i % 2 ? 1 : -1) * w * 0.42, -h / 2, (i < 2 ? 1 : -1) * d * 0.42);
    g.add(f);
  }
  /* Connector bank on one face, different diameters so a harness cannot be
     plugged into the wrong socket. */
  const n = Math.max(1, connectors);
  for (let i = 0; i < n; i++) {
    const r = 0.012 + (i % 3) * 0.004;
    const c = new THREE.Mesh(cylGeoZ(r, r * 0.9, 0.022, 10), M.connector);
    c.position.set((i / Math.max(1, n - 1) - 0.5) * w * 0.7, -h * 0.1, d / 2 + 0.011);
    g.add(c);
    const shell = new THREE.Mesh(new THREE.TorusGeometry(r * 1.25, r * 0.22, 6, 12), M.aluDark);
    shell.position.copy(c.position);
    g.add(shell);
  }
  if (fins) {
    /* Fins on a box that has to dump its own heat locally. */
    for (let i = 0; i < 5; i++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, h * 0.5, 0.004), M.aluDark);
      fin.position.set(0, h * 0.05, (i / 4 - 0.5) * d * 0.8);
      g.add(fin);
    }
  }
  if (decal) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.6, w * 0.6 * 96 / 256),
      new THREE.MeshStandardMaterial({ map: decal, roughness: .8, metalness: .05 }));
    m.position.set(0, h * 0.28, d / 2 + 0.002);
    g.add(m);
  }
  return g;
}

/**
 * Blanket wrap: MLI over a body, standing off it on spacers.
 *
 * The standoff is the point. A blanket touching the structure is a thermal
 * short, so it is held clear, and that gap is visible on real hardware.
 */
export function blanketWrap(THREE, M, r, len, map, { seams = 6, axis = 'z' } = {}) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ map, roughness: .6, metalness: .5 });
  map.repeat.set(4, 2);
  const geo = axis === 'x' ? cylGeoX(r, r, len, 28, true) : cylGeoZ(r, r, len, 28, true);
  const skin = new THREE.Mesh(geo, mat);
  skin.castShadow = true;
  g.add(skin);
  for (let i = 0; i < seams; i++) {
    const a = i * TAU / seams;
    const tape = new THREE.Mesh(new THREE.BoxGeometry(
      axis === 'x' ? len * 0.98 : r * 0.05, r * 0.05, axis === 'x' ? r * 0.05 : len * 0.98), M.mliSilver);
    if (axis === 'x') tape.position.set(0, Math.cos(a) * r * 1.02, Math.sin(a) * r * 1.02);
    else tape.position.set(Math.cos(a) * r * 1.02, Math.sin(a) * r * 1.02, 0);
    g.add(tape);
  }
  return g;
}

/**
 * Thruster: chamber, nozzle, propellant valve, catalyst-bed heater and the
 * bracket that carries the impulse into structure.
 */
export function thruster(THREE, M, scale = 1) {
  const g = new THREE.Group();
  const s = scale;
  const chamber = new THREE.Mesh(cylGeoZ(0.018 * s, 0.022 * s, 0.05 * s, 14), M.aluDark);
  g.add(chamber);
  const bell = new THREE.Mesh(coneGeoZ(0.045 * s, 0.07 * s, 18, true), M.black);
  bell.position.z = -0.055 * s;
  bell.rotation.x = Math.PI;
  g.add(bell);
  /* Two valves in series: no single valve failure opens a thruster. */
  for (let i = 0; i < 2; i++) {
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.028 * s, 0.028 * s, 0.026 * s), M.alu);
    v.position.set(0, 0.026 * s, 0.045 * s + i * 0.03 * s);
    g.add(v);
  }
  const line = new THREE.Mesh(cylGeoZ(0.006 * s, 0.006 * s, 0.09 * s, 8), M.mliSilver);
  line.position.set(0, 0.026 * s, 0.085 * s);
  g.add(line);
  /* Bracket. */
  const br = new THREE.Mesh(new THREE.BoxGeometry(0.07 * s, 0.012 * s, 0.05 * s), M.alu);
  br.position.z = 0.055 * s;
  g.add(br);
  g.userData.notes = { regime: 'propulsion',
    why: 'Two valves in series: no single valve failure can leave a thruster open.' };
  return g;
}

/**
 * Star tracker baffle: a stepped cone with internal vanes.
 *
 * The vanes are the instrument. Each one blocks a stray-light path, which
 * is why the baffle is longer than the optics behind it.
 */
export function baffle(THREE, M, r, len) {
  const g = new THREE.Group();
  const tube = new THREE.Mesh(cylGeoZ(r, r * 1.08, len, 22, true), M.aluDark);
  g.add(tube);
  const n = 4;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const vane = new THREE.Mesh(new THREE.TorusGeometry(r * (0.92 - t * 0.22), r * 0.05, 5, 20), M.black);
    vane.position.z = (t - 0.5) * len * 0.9;
    g.add(vane);
  }
  const lip = new THREE.Mesh(new THREE.TorusGeometry(r * 1.08, r * 0.06, 6, 22), M.alu);
  lip.position.z = len / 2;
  g.add(lip);
  g.userData.notes = { regime: 'attitude',
    why: 'Internal vanes each kill one stray-light path; that is why the baffle is longer than the optic.' };
  return g;
}

/**
 * Harness bundle: a laced cable run held by P-clamps, with slack between
 * them. A cable pulled tight fails when it contracts in the cold.
 */
export function harnessRun(THREE, M, len, { r = 0.012, clamps = null, axis = 'x' } = {}) {
  const g = new THREE.Group();
  const geo = axis === 'x' ? cylGeoX(r, r, len, 10) : cylGeoZ(r, r, len, 10);
  g.add(new THREE.Mesh(geo, M.black));
  const n = clamps ?? Math.max(2, Math.round(len / 0.3));
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1) - 0.5;
    const c = new THREE.Mesh(new THREE.TorusGeometry(r * 1.5, r * 0.3, 6, 12), M.alu);
    if (axis === 'x') { c.position.x = t * len * 0.94; c.rotation.y = Math.PI / 2; }
    else { c.position.z = t * len * 0.94; }
    g.add(c);
  }
  /* Lacing ties every few clamps. */
  for (let i = 0; i < n * 2; i++) {
    const t = i / (n * 2 - 1) - 0.5;
    const tie = new THREE.Mesh(new THREE.TorusGeometry(r * 1.15, r * 0.12, 4, 10), M.white);
    if (axis === 'x') { tie.position.x = t * len * 0.9; tie.rotation.y = Math.PI / 2; }
    else { tie.position.z = t * len * 0.9; }
    g.add(tie);
  }
  return g;
}

/** Rectangular waveguide with flanged joints — the RF path to the antenna. */
export function waveguide(THREE, M, len, { w = 0.05, h = 0.025, axis = 'x' } = {}) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    axis === 'x' ? new THREE.BoxGeometry(len, h, w) : new THREE.BoxGeometry(w, h, len), M.gold);
  g.add(body);
  const n = Math.max(2, Math.round(len / 0.35));
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1) - 0.5;
    const fl = new THREE.Mesh(new THREE.BoxGeometry(
      axis === 'x' ? 0.012 : w * 1.7, h * 1.7, axis === 'x' ? w * 1.7 : 0.012), M.alu);
    if (axis === 'x') fl.position.x = t * len * 0.95; else fl.position.z = t * len * 0.95;
    g.add(fl);
  }
  return g;
}

/** Deployment hinge with its launch latch. */
export function hingeLatch(THREE, M, s = 1) {
  const g = new THREE.Group();
  const knuckle = new THREE.Mesh(cylGeoX(0.02 * s, 0.02 * s, 0.09 * s, 12), M.alu);
  g.add(knuckle);
  for (const d of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.016 * s, 0.06 * s, 0.05 * s), M.aluDark);
    ear.position.set(d * 0.035 * s, 0.02 * s, 0);
    g.add(ear);
  }
  const latch = new THREE.Mesh(new THREE.BoxGeometry(0.03 * s, 0.03 * s, 0.05 * s), M.gold);
  latch.position.z = 0.045 * s;
  g.add(latch);
  return g;
}

/** Saddle mount for a spherical tank: two straps and a base. */
export function tankSaddle(THREE, M, r) {
  const g = new THREE.Group();
  /* Two straps at right angles, each a half turn around the tank, and four
     short legs down to the deck.

     The first version had a single plate the width of the tank hanging off
     one side - it read as a slab bolted to a ball, which is not what holds
     a pressurant tank. And its straps used rotation.set(PI/2, 0, a), which
     three applies in the wrong order, so both ended up in the same plane. */
  const up = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i < 2; i++) {
    const strap = new THREE.Mesh(
      new THREE.TorusGeometry(r * 1.02, r * 0.035, 6, 26, Math.PI), M.alu);
    strap.rotation.x = Math.PI / 2;
    strap.rotateOnWorldAxis(up, i * Math.PI / 2);
    g.add(strap);
  }
  /* Collar the straps land on. */
  const collar = new THREE.Mesh(new THREE.TorusGeometry(r * 0.52, r * 0.05, 6, 20), M.aluDark);
  collar.position.z = -r * 0.86;
  g.add(collar);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    const leg = new THREE.Mesh(cylGeoZ(r * 0.05, r * 0.06, r * 0.34, 8), M.alu);
    leg.position.set(Math.cos(a) * r * 0.46, Math.sin(a) * r * 0.46, -r * 1.02);
    g.add(leg);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(r * 0.16, r * 0.16, r * 0.05), M.aluDark);
    foot.position.set(Math.cos(a) * r * 0.46, Math.sin(a) * r * 0.46, -r * 1.2);
    g.add(foot);
  }
  return g;
}

export { TAU };
