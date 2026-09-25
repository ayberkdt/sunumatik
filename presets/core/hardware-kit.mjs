/* hardware-kit.mjs — THE SHARED AEROSPACE HARDWARE VOCABULARY.
 * docs/exploded-system-plan.md §2.1.
 *
 * A bolt circle is a bolt circle on a satellite, a surface habitat and a
 * launch vehicle. Before this file there were two kits with overlapping
 * ideas under different names, and anything new would have grown a third -
 * which is also why "some sections are still basic" was possible at all:
 * there was no one place that said what a finished part is made of.
 *
 * Nine families live here: fastening, structure, thermal, fluid,
 * electrical, RF, propulsion, mechanism and marking.
 *
 * Contract for every builder:
 *   - takes (THREE, kit, ...dimensions, opts)
 *   - returns a Group at its own origin; the caller places it
 *   - carries userData.notes.why - what requirement it answers
 *   - obeys the axis contract: no bare CylinderGeometry / ConeGeometry /
 *     LatheGeometry, only core/geometry-axis.mjs
 *
 * three is passed in; this module never imports it.
 */

import { cylGeoX, cylGeoY, cylGeoZ, coneGeoZ, latheX, latheZ } from './geometry-axis.mjs';

const TAU = Math.PI * 2;

/**
 * One material family for every object.
 *
 * Kept in one place because a shared vocabulary that renders differently
 * per preset is not shared. Tokens override individual entries so a scene
 * can still carry its own palette.
 */
export function hardwareMaterials(THREE, tokens = {}) {
  const std = (c, r, m, ek = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...ek });
  return {
    /* -- metals and structure -- */
    alu: std(tokens.alu ?? 0xa8aeb8, .44, .72),
    aluDark: std(tokens.aluDark ?? 0x5a6068, .58, .66),
    metal: std(tokens.metal ?? 0x9aa2ad, .48, .72),
    koyuMetal: std(tokens.koyuMetal ?? 0x454b55, .62, .68),
    black: std(0x22262c, .86, .16),
    white: std(0xd8dae0, .72, .12),
    /* -- thermal -- */
    /* Gold MLI: not an arbitrary colour. The outer layer is aluminised
       Kapton, and Kapton is amber. */
    mli: std(tokens.mli ?? 0xc9a24a, .62, .55),
    mliSilver: std(0xb9bec6, .38, .78),
    /* OSR tiles are second-surface mirrors: near white, very low alpha. */
    osr: std(0xe6ecf2, .10, .30),
    /* -- interfaces -- */
    connector: std(0x8f6a3a, .42, .82),
    bakir: std(0xa86b3c, .40, .85),
    gold: std(0xd0a84e, .34, .88),
    conta: std(0x2a2e35, .88, .10),
    kablo: std(0x23262c, .92, .05),
    cam: std(0x8fb4c9, .06, .0, { transparent: true, opacity: .34 }),
    cell: std(0x1b2b3f, .28, .52),
    /* -- crew-facing -- */
    /* Handrail yellow is a standard: the gloved hand does not look for it,
       it finds it. */
    korkuluk: std(tokens.korkuluk ?? 0xd8b24a, .42, .55),
    ikaz: std(0xc9563f, .70, .10),
    regolit: std(tokens.regolit ?? 0x6b5a48, .96, .02),
  };
}

/* ══ from the satellite kit ═══════════════════════════════════════ */

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
export function equipmentBox(THREE, M, w, h, d, opts = {}) {
  const {
    connectors = 4, decal = null, fins = false, tip = 'genel',
    kapakVida = 14, flans = true, dolgu = true,
  } = opts;
  const g = new THREE.Group();
  const ek = (m) => { m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };

  /* The housing is three plates, not one block. A milled shell has a
     shoulder where the lid lands and a flange where it bolts down, and
     those two steps are most of what tells the eye it was machined
     rather than extruded. One BoxGeometry cannot say any of it. */
  const govdeY = h * 0.78;
  const govde = ek(new THREE.Mesh(new THREE.BoxGeometry(w, govdeY, d), M.alu));
  govde.position.y = -h * 0.06;

  /* Shoulder: a thin proud band at the lid joint. This is the chamfer
     substitute - a real bevel would cost a custom geometry per box, and
     the step reads the same at every distance that matters here. */
  const omuz = ek(new THREE.Mesh(new THREE.BoxGeometry(w * 1.02, h * 0.05, d * 1.02), M.aluDark));
  omuz.position.y = govdeY / 2 - h * 0.06;

  /* Lid, inset, with the gap that says it comes off. */
  const kapak = ek(new THREE.Mesh(new THREE.BoxGeometry(w * 0.94, h * 0.1, d * 0.94), M.metal));
  kapak.position.y = govdeY / 2 + h * 0.02;

  /* Closure screws right round the lid. On real hardware this line is the
     single most recognisable feature of an equipment box. */
  const cevre = 2 * (w * 0.94 + d * 0.94);
  const n = Math.max(6, kapakVida);
  for (let i = 0; i < n; i++) {
    const t = (i / n) * cevre;
    let x, z;
    const a = w * 0.94, b = d * 0.94;
    if (t < a) { x = -a / 2 + t; z = -b / 2; }
    else if (t < a + b) { x = a / 2; z = -b / 2 + (t - a); }
    else if (t < 2 * a + b) { x = a / 2 - (t - a - b); z = b / 2; }
    else { x = -a / 2; z = b / 2 - (t - 2 * a - b); }
    const v = ek(new THREE.Mesh(cylGeoY(Math.min(w, d) * 0.018, Math.min(w, d) * 0.018, h * 0.03, 6), M.koyuMetal));
    v.position.set(x * 0.94, govdeY / 2 + h * 0.07, z * 0.94);
  }

  if (flans) {
    /* Mounting flange: wider than the body, because the bolts have to go
       somewhere that is not the pressure shell of the box. */
    const fl = ek(new THREE.Mesh(new THREE.BoxGeometry(w * 1.18, h * 0.06, d * 1.06), M.aluDark));
    fl.position.y = -h * 0.45;
    for (const ex of [-1, 1]) for (const ez of [-1, 0, 1]) {
      const boss = ek(new THREE.Mesh(cylGeoY(Math.min(w, d) * 0.055, Math.min(w, d) * 0.06, h * 0.09, 10), M.alu));
      boss.position.set(ex * w * 0.55, -h * 0.43, ez * d * 0.4);
      const bas = ek(new THREE.Mesh(cylGeoY(Math.min(w, d) * 0.035, Math.min(w, d) * 0.035, h * 0.025, 6), M.gold));
      bas.position.set(ex * w * 0.55, -h * 0.37, ez * d * 0.4);
    }
  }
  if (dolgu) {
    /* Thermal gap filler. The box does not touch the panel; this does, and
       it is why the flange stands off at all. */
    const pad = ek(new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, h * 0.02, d * 0.9), M.conta));
    pad.position.y = -h * 0.5;
  }

  /* Lightening pockets on the two large faces. A milled housing has mass
     taken out wherever the load does not need it, and the ribs left
     between the pockets are the structure. A large face with nothing on it
     is the single strongest "this is a primitive" signal a box can send,
     and both long walls were bare. */
  {
    const sut = Math.max(2, Math.round(w / 0.085));
    const sir = Math.max(1, Math.round(govdeY / 0.075));
    const px = (w * 0.86) / sut, py = (govdeY * 0.72) / sir;
    for (const ez of [-1, 1]) {
      for (let i = 0; i < sut; i++) {
        for (let j = 0; j < sir; j++) {
          const cep = ek(new THREE.Mesh(
            new THREE.BoxGeometry(px * 0.76, py * 0.72, d * 0.03), M.koyuMetal));
          cep.position.set((i - (sut - 1) / 2) * px,
            -h * 0.06 + (j - (sir - 1) / 2) * py,
            ez * (d / 2 - d * 0.012));
        }
      }
    }
  }

  /* Connector bezel: a raised lip around the shells, not a panel over the
     face. The first attempt filled most of the front with a dark plate and
     the box read as a screen - the protection a connector bank actually
     has is a rim standing proud of it, so that is what is drawn. */
  {
    const bw = w * 0.82, bh = govdeY * 0.30, kal = Math.min(w, d) * 0.022;
    for (const [sw, sh, px, py] of [
      [bw, kal, 0, bh / 2], [bw, kal, 0, -bh / 2],
      [kal, bh + kal, -bw / 2, 0], [kal, bh + kal, bw / 2, 0],
    ]) {
      const cer = ek(new THREE.Mesh(new THREE.BoxGeometry(sw, sh, d * 0.05), M.aluDark));
      cer.position.set(px, -h * 0.08 + py, d / 2 + d * 0.012);
    }
  }
  const nk = Math.max(1, connectors);
  for (let i = 0; i < nk; i++) {
    const r = 0.012 + (i % 3) * 0.004;
    const x = (nk === 1 ? 0 : (i / (nk - 1) - 0.5)) * w * 0.68;
    const c = ek(new THREE.Mesh(cylGeoZ(r, r * 0.9, 0.022, 12), M.connector));
    c.position.set(x, -h * 0.08, d / 2 + 0.011);
    const shell = ek(new THREE.Mesh(new THREE.TorusGeometry(r * 1.25, r * 0.22, 6, 14), M.aluDark));
    shell.position.copy(c.position);
    /* Backshell and its strain relief: the harness does not hang off the
       pins, it hangs off this. */
    const arka = ek(new THREE.Mesh(cylGeoZ(r * 1.15, r * 1.3, 0.016, 10), M.aluDark));
    arka.position.set(x, -h * 0.08, d / 2 + 0.028);
    /* Keyway: the notch that stops the wrong plug going in. */
    const anahtar = ek(new THREE.Mesh(new THREE.BoxGeometry(r * 0.5, r * 0.5, 0.006), M.gold));
    anahtar.position.set(x, -h * 0.08 + r * 1.2, d / 2 + 0.02);
  }

  /* Identification: the big decal, plus the small plate every flight box
     carries with its serial on it. */
  if (decal) {
    const m = ek(new THREE.Mesh(new THREE.PlaneGeometry(w * 0.6, w * 0.6 * 96 / 256),
      new THREE.MeshStandardMaterial({ map: decal, roughness: .8, metalness: .05 })));
    m.position.set(0, govdeY / 2 + h * 0.075, 0);
    m.rotation.x = -Math.PI / 2;
  }
  const kunye = ek(new THREE.Mesh(new THREE.BoxGeometry(w * 0.2, h * 0.008, d * 0.12), M.white));
  kunye.position.set(-w * 0.3, govdeY / 2 + h * 0.075, d * 0.3);

  if (fins) {
    for (let i = 0; i < 7; i++) {
      const fin = ek(new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, govdeY * 0.5, 0.004), M.aluDark));
      fin.position.set(0, -h * 0.02, (i / 6 - 0.5) * d * 0.82);
    }
  }

  /* What the box IS. Three machines were rendering identically because
     nothing distinguished them; these are the features you would use to
     tell them apart on a bench. */
  if (tip === 'guc') {
    /* Heavy power connectors and the fuse bank behind them. */
    for (const e of [-1, 1]) {
      const agir = ek(new THREE.Mesh(cylGeoZ(0.026, 0.024, 0.03, 14), M.bakir));
      agir.position.set(e * w * 0.3, h * 0.12, d / 2 + 0.015);
      const kelep = ek(new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 6, 16), M.aluDark));
      kelep.position.copy(agir.position);
    }
    for (let i = 0; i < 6; i++) {
      const sig = ek(new THREE.Mesh(new THREE.BoxGeometry(w * 0.07, h * 0.05, d * 0.14), M.ikaz));
      sig.position.set((i / 5 - 0.5) * w * 0.7, govdeY / 2 + h * 0.065, -d * 0.28);
    }
    /* Bus bar: the only thing in the box that carries the whole load. */
    const bara = ek(new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, h * 0.03, d * 0.05), M.bakir));
    bara.position.set(0, -h * 0.28, d * 0.36);
  } else if (tip === 'batarya') {
    /* Cells, seen through a cut-away wall. A battery is a box full of
       cylinders and nothing else about it matters as much. */
    const pencere = ek(new THREE.Mesh(new THREE.BoxGeometry(w * 0.86, govdeY * 0.7, d * 0.02),
      new THREE.MeshStandardMaterial({ color: 0x8aa0b4, roughness: .3, metalness: .2,
        transparent: true, opacity: .26, depthWrite: false })));
    pencere.position.set(0, -h * 0.06, -d / 2 + d * 0.01);
    const sut = Math.max(3, Math.round(w / 0.055));
    for (let i = 0; i < sut; i++) {
      for (const sy of [-1, 1]) {
        const hucre = ek(new THREE.Mesh(cylGeoY(0.017, 0.017, govdeY * 0.6, 12), M.koyuMetal));
        hucre.position.set((i / (sut - 1) - 0.5) * w * 0.78, -h * 0.06, sy * d * 0.2);
      }
    }
    /* Vent port: a cell that goes runaway has to have somewhere to go. */
    const vent = ek(new THREE.Mesh(cylGeoY(0.014, 0.014, h * 0.06, 12), M.koyuMetal));
    vent.position.set(w * 0.33, govdeY / 2 + h * 0.05, d * 0.25);
    const izgara = ek(new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.004, 6, 14), M.alu));
    izgara.position.set(w * 0.33, govdeY / 2 + h * 0.08, d * 0.25);
  } else if (tip === 'rf') {
    /* Waveguide flange: the output does not leave on a coax, it leaves on
       a rectangular pipe with a bolt pattern around it. */
    const bayrak = ek(new THREE.Mesh(new THREE.BoxGeometry(w * 0.22, h * 0.22, d * 0.04), M.gold));
    bayrak.position.set(w * 0.28, h * 0.1, -d / 2 - d * 0.02);
    for (let i = 0; i < 4; i++) {
      const a = i * TAU / 4 + Math.PI / 4;
      const c = ek(new THREE.Mesh(cylGeoZ(0.004, 0.004, d * 0.05, 6), M.koyuMetal));
      c.position.set(w * 0.28 + Math.cos(a) * w * 0.085, h * 0.1 + Math.sin(a) * h * 0.085, -d / 2 - d * 0.02);
    }
    const agiz = ek(new THREE.Mesh(new THREE.BoxGeometry(w * 0.1, h * 0.05, d * 0.03), M.koyuMetal));
    agiz.position.set(w * 0.28, h * 0.1, -d / 2 - d * 0.035);
    /* Heat spreader: a TWTA is 38% efficient and the rest leaves here. */
    for (let i = 0; i < 5; i++) {
      const kaburga = ek(new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, govdeY * 0.14, d * 0.035), M.metal));
      kaburga.position.set(0, -h * 0.3 + i * govdeY * 0.14, -d * 0.35);
    }
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
  /* The texture is optional: a caller that has no canvas (a Node-side gate)
     or a row that just says `blanket: true` still gets a blanket. Passing
     `map: undefined` into a material and then setting map.repeat threw, so
     `blanket: true` without a texture used to be a crash rather than a
     plainer blanket. */
  const mat = map
    ? new THREE.MeshStandardMaterial({ map, roughness: .6, metalness: .5 })
    : new THREE.MeshStandardMaterial({ color: M.mli.color, roughness: .62, metalness: .5 });
  if (map) map.repeat.set(4, 2);
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
  /* A stray-light baffle is a STEPPED tube: each section is wider than the
     one behind it so the vane edges are the only thing a grazing ray can
     see. Drawn as one smooth cone it read as a length of pipe. */
  const kademe = 3;
  for (let i = 0; i < kademe; i++) {
    const t0 = i / kademe, t1 = (i + 1) / kademe;
    const r0 = r * (0.86 + t0 * 0.26), r1 = r * (0.86 + t1 * 0.26);
    const boy = len / kademe;
    const bolum = new THREE.Mesh(cylGeoZ(r1, r0, boy, 26, true), M.aluDark);
    bolum.material.side = THREE.DoubleSide;
    bolum.position.z = (t0 + t1) / 2 * len - len / 2;
    g.add(bolum);
    /* Joint ring at every step, with its fastener line. */
    const bilezik = new THREE.Mesh(new THREE.TorusGeometry(r1 * 1.03, r * 0.035, 6, 24), M.alu);
    bilezik.position.z = t1 * len - len / 2;
    g.add(bilezik);
  }
  /* External stiffening: the tube is long and thin and it carries the
     alignment of the optic behind it. */
  for (let i = 0; i < 4; i++) {
    const a = i * TAU / 4 + Math.PI / 4;
    const kaburga = new THREE.Mesh(new THREE.BoxGeometry(r * 0.05, r * 0.03, len * 0.92), M.metal);
    kaburga.position.set(Math.cos(a) * r * 1.06, Math.sin(a) * r * 1.06, 0);
    kaburga.rotation.z = a;
    g.add(kaburga);
  }
  const n = 5;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    /* Knife-edged vanes, narrowing toward the aperture. */
    const vane = new THREE.Mesh(new THREE.TorusGeometry(r * (0.94 - t * 0.3), r * 0.04, 5, 22), M.black);
    vane.position.z = (t - 0.5) * len * 0.9;
    g.add(vane);
  }
  const lip = new THREE.Mesh(new THREE.TorusGeometry(r * 1.13, r * 0.05, 8, 26), M.alu);
  lip.position.z = len / 2;
  g.add(lip);
  /* The aperture cover's hinge bracket: it comes off on orbit and the
     bracket stays. */
  const mentese = new THREE.Mesh(new THREE.BoxGeometry(r * 0.3, r * 0.12, r * 0.16), M.koyuMetal);
  mentese.position.set(r * 1.1, 0, len / 2 - r * 0.1);
  g.add(mentese);
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


/** CFRP facesheet: a 2x2 twill weave with the tow lines over it.
 *
 * The back of a solar wing is the largest single surface on a spacecraft of
 * this class - two wings at 5.11 x 1.70 m - and it was being drawn as one
 * flat grey fill, which is what made the whole vehicle read as cardboard from
 * the usual viewing angle. A weave reads as structure at a glance; the
 * diagonal is the part that makes carbon look like carbon rather than paint.
 */
export function cfrpTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#4c515b'; g.fillRect(0, 0, 256, 256);
  const s = 16;
  for (let y = 0; y < 256; y += s) {
    for (let x = 0; x < 256; x += s) {
      /* 2x2 twill: two over, two under, stepped one each row. */
      const ust = ((x / s + y / s) % 4) < 2;
      g.fillStyle = ust ? 'rgba(255,255,255,.085)' : 'rgba(0,0,0,.12)';
      g.fillRect(x, y, s, s);
    }
  }
  g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 1;
  for (let i = 0; i <= 256; i += s) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
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

/* ══ from the habitat kit ═════════════════════════════════════════ */

/* ── dokular ─────────────────────────────────────────────────────────── */

/** Uyarı/künye levhası: metin prosedürel çizilir, dosya çekilmez. */
export function levhaDokusu(THREE, satirlar, { zemin = '#d8d4cc', yazi = '#23262c', seritRenk = null } = {}) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = zemin; g.fillRect(0, 0, 256, 128);
  if (seritRenk) { g.fillStyle = seritRenk; g.fillRect(0, 0, 256, 16); g.fillRect(0, 112, 256, 16); }
  g.fillStyle = yazi;
  g.textAlign = 'center';
  const n = satirlar.length;
  satirlar.forEach((t, i) => {
    g.font = `${i === 0 ? 'bold ' : ''}${i === 0 ? 26 : 19}px "Segoe UI", sans-serif`;
    g.fillText(t, 128, 64 + (i - (n - 1) / 2) * 30 + 8);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Regolit yüzey kabartması. Düz bir kutu yüzey gerçek toprağa benzemez;
 * bump haritası ışığı kırar ve yüzeyi taneli gösterir. Değer-gürültü
 * kullanılır: rastgele piksel çok keskin, iki ölçekli değer-gürültü
 * doğal taneyi verir.
 */
export function regolitKabartma(THREE, boyut = 256, seed = 11) {
  const c = document.createElement('canvas');
  c.width = c.height = boyut;
  const g = c.getContext('2d');
  const im = g.createImageData(boyut, boyut);
  let s = seed >>> 0;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  /* iki ölçek: kaba blok + ince tane */
  const kaba = 16, kabaN = new Float32Array(kaba * kaba);
  for (let i = 0; i < kabaN.length; i++) kabaN[i] = rnd();
  for (let y = 0; y < boyut; y++) {
    for (let x = 0; x < boyut; x++) {
      const gx = (x / boyut) * kaba, gy = (y / boyut) * kaba;
      const x0 = Math.floor(gx) % kaba, y0 = Math.floor(gy) % kaba;
      const x1 = (x0 + 1) % kaba, y1 = (y0 + 1) % kaba;
      const fx = gx - Math.floor(gx), fy = gy - Math.floor(gy);
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const a = kabaN[y0 * kaba + x0], b = kabaN[y0 * kaba + x1];
      const cc = kabaN[y1 * kaba + x0], d = kabaN[y1 * kaba + x1];
      const buyuk = (a + (b - a) * sx) + ((cc + (d - cc) * sx) - (a + (b - a) * sx)) * sy;
      const v = Math.round(255 * (0.55 * buyuk + 0.45 * rnd()));
      const i = (y * boyut + x) * 4;
      im.data[i] = im.data[i + 1] = im.data[i + 2] = v;
      im.data[i + 3] = 255;
    }
  }
  g.putImageData(im, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/* ── parçalar ─────────────────────────────────────────────────────────
   Her işlev bir Group döndürür ve kendi orijininde oturur; çağıran yerine
   koyar. Ölçüler metre. */

/**
 * EVA korkuluğu. Gerçek uzay donanımında el rayı standarttır: Ø19 mm,
 * yüzeyden 57 mm açıklık — eldivenli el parmaklarını geçirebilsin diye.
 * Bu iki sayı biçimi tamamen belirler.
 */
export function korkuluk(THREE, M, uzunluk, { ayakSayisi = null } = {}) {
  const g = new THREE.Group();
  const R = 0.0095, ACIKLIK = 0.057;
  const bar = new THREE.Mesh(cylGeoX(R, R, uzunluk, 10), M.korkuluk);
  bar.position.z = ACIKLIK;
  bar.castShadow = true;
  g.add(bar);
  const n = ayakSayisi ?? Math.max(2, Math.round(uzunluk / 0.55));
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const ayak = new THREE.Mesh(cylGeoZ(R * 0.8, R * 1.3, ACIKLIK, 8), M.korkuluk);
    ayak.position.set((t - 0.5) * uzunluk * 0.92, 0, ACIKLIK / 2);
    ayak.castShadow = true;
    g.add(ayak);
  }
  g.userData.notes = { regime: 'EVA', why: 'Ø19 mm el rayı, yüzeyden 57 mm açıklık: eldivenli el parmağını geçirebilsin.' };
  return g;
}

/**
 * Basınçlı kapak. Çark, kilit dilleri ve conta halkası görünür; kapak
 * İÇE açılır çünkü basınç onu contaya bastırır. Dışa açılan kapıyı
 * 101 kPa × kapak alanı koparırdı — Ø0,8 m kapakta 51 kN.
 */
export function kapak(THREE, M, r, { cark = true, pencere = true } = {}) {
  const g = new THREE.Group();
  const flans = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.13, 10, 28), M.metal);
  g.add(flans);
  const contaH = new THREE.Mesh(new THREE.TorusGeometry(r * 0.93, r * 0.05, 8, 26), M.conta);
  g.add(contaH);
  const govde = new THREE.Mesh(cylGeoZ(r * 0.88, r * 0.88, r * 0.22, 26), M.koyuMetal);
  govde.position.z = r * 0.06;
  govde.castShadow = true;
  g.add(govde);
  /* kilit dilleri: çevrede eşit, çark döndükçe dışa iter */
  for (let i = 0; i < 8; i++) {
    const a = i * TAU / 8;
    const dil = new THREE.Mesh(new THREE.BoxGeometry(r * 0.17, r * 0.09, r * 0.3), M.metal);
    dil.position.set(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9, r * 0.06);
    dil.rotation.z = a;
    g.add(dil);
  }
  if (cark) {
    const c = new THREE.Mesh(new THREE.TorusGeometry(r * 0.42, r * 0.045, 8, 22), M.korkuluk);
    c.position.z = r * 0.2;
    g.add(c);
    for (let i = 0; i < 4; i++) {
      const a = i * TAU / 4 + Math.PI / 8;
      const kol = new THREE.Mesh(cylGeoX(r * 0.03, r * 0.03, r * 0.42, 8), M.korkuluk);
      kol.position.set(Math.cos(a) * r * 0.21, Math.sin(a) * r * 0.21, r * 0.2);
      kol.rotation.z = a;
      g.add(kol);
    }
  }
  if (pencere) {
    const p = new THREE.Mesh(cylGeoZ(r * 0.2, r * 0.2, r * 0.1, 18), M.cam);
    p.position.z = r * 0.2;
    g.add(p);
  }
  g.userData.notes = { regime: 'basınçlı', why: 'Kapak İÇE açılır: basınç onu contaya bastırır. Dışa açsaydı Ø0,8 m\'de 51 kN onu koparırdı.' };
  return g;
}

/**
 * Gözlem penceresi. Tek cam değil: üç kat (basınç camı, yedek basınç
 * camı, çizilme camı) ve dışta kapak. Çerçeve kalın çünkü pencere
 * kabuğun en zayıf yeridir ve yükü etrafına dağıtmak gerekir.
 */
export function pencere(THREE, M, r) {
  const g = new THREE.Group();
  const cerceve = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.26, 10, 26), M.metal);
  g.add(cerceve);
  for (let i = 0; i < 3; i++) {
    const cam = new THREE.Mesh(cylGeoZ(r * 0.82, r * 0.82, r * 0.035, 22), M.cam);
    cam.position.z = r * 0.06 * (i - 1);
    g.add(cam);
  }
  /* Koruma kapağı SÜRGÜLÜdür, menteşeli değil. Menteşeli kapağı açık
     çizdiğimde kabuğun önünde havada duran koyu bir leke oluyordu; gerçek
     yüzey donanımında da menteşe tercih edilmez, çünkü açık kapak toz
     tutar ve EVA yolunu keser. Sürgü çerçevenin kendi oluğunda kayar. */
  const oluk = new THREE.Mesh(new THREE.TorusGeometry(r * 1.2, r * 0.1, 8, 26, Math.PI), M.koyuMetal);
  oluk.position.z = -r * 0.02;
  oluk.rotation.z = -Math.PI / 2;
  g.add(oluk);
  const surgu = new THREE.Mesh(
    new THREE.CircleGeometry(r * 1.04, 24, Math.PI * 0.62, Math.PI * 0.76), M.metal);
  surgu.position.z = r * 0.1;
  g.add(surgu);
  /* sürgü kolu — eldivenli elle çekilir */
  const kol = new THREE.Mesh(cylGeoY(r * 0.045, r * 0.045, r * 0.44, 8), M.korkuluk);
  kol.position.set(-r * 0.86, 0, r * 0.15);
  g.add(kol);

  g.userData.notes = { regime: 'basınçlı', why: 'Üç cam: iki basınç katı yedekli, dıştaki çizilme kurbanı. Kapak mikrometeorit ve güneş için.' };
  return g;
}

/**
 * Göbek bağı paneli: akışkan ve elektrik arayüzlerinin toplandığı yer.
 * Konnektörler farklı çapta ve ANAHTARLI olur — yanlış hattı yanlış
 * yuvaya takmak fiziksel olarak mümkün olmamalıdır.
 */
export function konnektorPaneli(THREE, M, w = 0.42, h = 0.3) {
  const g = new THREE.Group();
  const taban = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.035), M.koyuMetal);
  g.add(taban);
  const capi = [0.055, 0.042, 0.042, 0.03, 0.03, 0.03];
  capi.forEach((r, i) => {
    const cx = (-0.5 + ((i % 3) + 0.5) / 3) * w * 0.88;
    const cy = (i < 3 ? 0.22 : -0.22) * h;
    const k = new THREE.Mesh(cylGeoZ(r, r * 0.9, 0.05, 12), i < 3 ? M.bakir : M.metal);
    k.position.set(cx, cy, 0.04);
    g.add(k);
    const kilit = new THREE.Mesh(new THREE.TorusGeometry(r * 1.2, r * 0.18, 6, 14), M.metal);
    kilit.position.set(cx, cy, 0.05);
    g.add(kilit);
  });
  const kap = new THREE.Mesh(new THREE.BoxGeometry(w * 1.04, h * 0.1, 0.02), M.korkuluk);
  kap.position.set(0, -h * 0.55, 0.03);
  g.add(kap);
  g.userData.notes = { regime: 'arayüz', why: 'Konnektörler farklı çapta ve anahtarlı: yanlış hat yanlış yuvaya FİZİKSEL olarak girmez.' };
  return g;
}

/**
 * Kablo tavası. Kablo serbest bırakılmaz: tava onu tozdan, ayaktan ve
 * ısıl daralmadan korur; P kelepçeler belirli aralıkla tutar ve
 * aralarında sarkma payı bırakılır.
 */
export function kabloTavasi(THREE, M, uzunluk, { kablo = 3 } = {}) {
  const g = new THREE.Group();
  const w = 0.13;
  const taban = new THREE.Mesh(new THREE.BoxGeometry(uzunluk, w, 0.012), M.metal);
  g.add(taban);
  for (const s of [-1, 1]) {
    const yan = new THREE.Mesh(new THREE.BoxGeometry(uzunluk, 0.012, 0.05), M.metal);
    yan.position.set(0, s * w / 2, 0.025);
    g.add(yan);
  }
  for (let i = 0; i < kablo; i++) {
    const r = 0.014 - i * 0.002;
    const k = new THREE.Mesh(cylGeoX(r, r, uzunluk * 0.99, 8), M.kablo);
    k.position.set(0, (i - (kablo - 1) / 2) * 0.035, 0.018 + r);
    g.add(k);
  }
  const n = Math.max(2, Math.round(uzunluk / 0.8));
  for (let i = 0; i < n; i++) {
    const kel = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.005, 6, 12), M.metal);
    kel.position.set((i / (n - 1) - 0.5) * uzunluk * 0.95, 0, 0.03);
    kel.rotation.y = Math.PI / 2;
    g.add(kel);
  }
  g.userData.notes = { regime: 'kablaj', why: 'Tava kabloyu tozdan, ayaktan ve ısıl daralmadan korur; kelepçeler arasında sarkma payı kalır.' };
  return g;
}

/** Uyarı/künye levhası. */
export function levha(THREE, M, satirlar, { w = 0.3, h = 0.15, seritRenk = null, zemin, yazi } = {}) {
  const t = levhaDokusu(THREE, satirlar, { seritRenk, zemin, yazi });
  const mat = new THREE.MeshStandardMaterial({ map: t, roughness: .78, metalness: .05 });
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.006), mat);
  m.userData.notes = { regime: 'işletme', why: 'Levha bir süs değil: bakımcı hangi hattın ne taşıdığını gövdenin üstünden okur.' };
  return m;
}

/**
 * Basamaklı merdiven — hava kilidine iniş. Basamak aralığı 0,3 m:
 * basınçlı giysiyle diz açısı sınırlıdır, Dünya merdiveni işe yaramaz.
 */
export function merdiven(THREE, M, yukseklik, { genislik = 0.46 } = {}) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const dikme = new THREE.Mesh(cylGeoZ(0.016, 0.016, yukseklik, 8), M.korkuluk);
    dikme.position.set(s * genislik / 2, 0, yukseklik / 2);
    dikme.castShadow = true;
    g.add(dikme);
  }
  const n = Math.max(2, Math.round(yukseklik / 0.3));
  for (let i = 0; i < n; i++) {
    const z = (i + 0.5) * (yukseklik / n);
    const bas = new THREE.Mesh(cylGeoX(0.013, 0.013, genislik, 8), M.korkuluk);
    bas.position.set(0, 0, z);
    bas.castShadow = true;
    g.add(bas);
  }
  g.userData.notes = { regime: 'EVA', why: 'Basamak aralığı 0,30 m: basınçlı giyside diz açısı sınırlı, Dünya merdiveni tırmanılamaz.' };
  return g;
}

/**
 * İniş/oturma pabucu. Tabak biçimi yükü yayar; altındaki regolit halka
 * çökmeyi gösterir. Küresel mafsal oturma farkını yutar.
 */
export function ayakPabucu(THREE, M, r = 0.3, { regolitMat = null } = {}) {
  const g = new THREE.Group();
  const tabak = new THREE.Mesh(coneGeoZ(r, r * 0.34, 20), M.metal);
  tabak.position.z = r * 0.17;
  tabak.castShadow = true;
  g.add(tabak);
  const mafsal = new THREE.Mesh(new THREE.SphereGeometry(r * 0.22, 12, 10), M.koyuMetal);
  mafsal.position.z = r * 0.4;
  g.add(mafsal);
  if (regolitMat) {
    const halka = new THREE.Mesh(new THREE.TorusGeometry(r * 1.25, r * 0.16, 6, 20), regolitMat);
    halka.position.z = r * 0.03;
    halka.scale.z = 0.4;
    halka.receiveShadow = true;
    g.add(halka);
  }
  g.userData.notes = { regime: 'yapı', why: 'Tabak yükü yayar, küresel mafsal oturma farkını yutar; etrafındaki halka çöken regolittir.' };
  return g;
}

/** Seyrüsefer feneri — gece ve toz fırtınasında modülü işaretler. */
export function fener(THREE, M, { renk = 0xffc65a } = {}) {
  const g = new THREE.Group();
  const govde = new THREE.Mesh(cylGeoZ(0.035, 0.045, 0.07, 10), M.koyuMetal);
  g.add(govde);
  const cam = new THREE.Mesh(new THREE.SphereGeometry(0.036, 12, 8, 0, TAU, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: renk, emissive: renk, emissiveIntensity: 1.6, roughness: .3 }));
  cam.position.z = 0.035;
  g.add(cam);
  g.userData.notes = { regime: 'işletme', why: 'Toz fırtınasında görüş metrelerle ölçülür; fener modülün nerede bittiğini söyler.' };
  return g;
}

/**
 * MLI dikiş şeridi ve ayırıcı. Battaniye kabuğa yapışmaz: aradaki hava
 * boşluğu yalıtımın kendisidir, temas ısı köprüsü olur.
 */
export function mliSeridi(THREE, M, uzunluk, { n = null } = {}) {
  const g = new THREE.Group();
  const serit = new THREE.Mesh(new THREE.BoxGeometry(uzunluk, 0.05, 0.004),
    new THREE.MeshStandardMaterial({ color: 0xb9a878, roughness: .85, metalness: .2 }));
  g.add(serit);
  const adet = n ?? Math.max(2, Math.round(uzunluk / 0.45));
  for (let i = 0; i < adet; i++) {
    const d = new THREE.Mesh(cylGeoZ(0.008, 0.008, 0.03, 6), M.metal);
    d.position.set((i / (adet - 1) - 0.5) * uzunluk * 0.94, 0, -0.016);
    g.add(d);
  }
  g.userData.notes = { regime: 'ısıl', why: 'Ayırıcılar battaniyeyi kabuktan uzak tutar: temas eden yalıtım ısı köprüsüdür.' };
  return g;
}

/** Tutamak — tek elle kavranan kısa ray (kapak yanı, panel kenarı). */
export function tutamak(THREE, M, { uzunluk = 0.22 } = {}) {
  const g = new THREE.Group();
  const bar = new THREE.Mesh(cylGeoX(0.0095, 0.0095, uzunluk, 8), M.korkuluk);
  bar.position.z = 0.05;
  g.add(bar);
  for (const s of [-1, 1]) {
    const ayak = new THREE.Mesh(cylGeoZ(0.008, 0.012, 0.05, 6), M.korkuluk);
    ayak.position.set(s * uzunluk * 0.42, 0, 0.025);
    g.add(ayak);
  }
  return g;
}

/* ══ propulsion and sensing, added for the electric-propulsion pod ══ */

/**
 * Hall-effect thruster — the annular discharge channel IS the thruster.
 *
 * This is not a small chemical engine and it has no bell. Xenon is ionised
 * inside a ceramic annulus; a radial magnetic field traps electrons so that
 * the axial field can accelerate ions out at 15-20 km/s. What the geometry
 * therefore has to show is the annulus, the inner and outer magnetic poles
 * that shape the field, the coils that make it, and the hollow cathode off
 * to one side that supplies neutralising electrons.
 *
 * Exit plane at +z, mounting flange at -z.
 */
export function hallThruster(THREE, kit, rOut, len, opts = {}) {
  const { coils = 4, bolts = 12, cathode = true, feed = true } = opts;
  const g = new THREE.Group();
  const rCh = rOut * 0.74;                 // channel outer wall
  const rIn = rOut * 0.40;                 // channel inner wall / inner pole
  const zEx = len / 2;

  /* Boron nitride: the channel walls are a pale ceramic, and they are the
     brightest thing on the unit. They erode - that is what ends the life. */
  /* DoubleSide is not cosmetic here: an open cylinder shows only its outer
     face, so with single-sided walls the channel interior - the one feature
     that makes this a Hall thruster - renders as nothing at all. */
  const bn = new THREE.MeshStandardMaterial({ color: 0xe9e3d2, roughness: 0.82, metalness: 0.04,
    side: THREE.DoubleSide });
  const disarge = new THREE.MeshStandardMaterial({ color: 0x3d5f86, roughness: 0.4, metalness: 0.2,
    emissive: 0x1b3557, emissiveIntensity: 0.6 });

  const housing = new THREE.Mesh(cylGeoZ(rOut, rOut, len * 0.58, 28, true), kit.aluDark);
  housing.position.z = -len * 0.14;
  g.add(housing);

  for (const r of [rCh, rIn]) {
    const wall = new THREE.Mesh(cylGeoZ(r, r, len * 0.4, 28, true), bn);
    wall.position.z = zEx - len * 0.2;
    g.add(wall);
  }
  /* The plasma itself, as a flattened annulus just inside the exit plane.
     Flattened rather than modelled: a torus scaled on z reads as a ring of
     glow without pretending to be a plume. */
  const plasma = new THREE.Mesh(
    new THREE.TorusGeometry((rCh + rIn) / 2, (rCh - rIn) / 2 * 0.34, 6, 28), disarge);
  plasma.scale.z = 0.2;
  plasma.position.z = zEx - len * 0.13;
  g.add(plasma);
  /* Channel floor, so the annulus reads as a groove with a bottom rather
     than a hole straight through the unit. */
  const taban = new THREE.Mesh(
    new THREE.RingGeometry(rIn, rCh, 26), new THREE.MeshStandardMaterial({
      color: 0x8d8778, roughness: 0.9, metalness: 0.05, side: THREE.DoubleSide }));
  taban.position.z = zEx - len * 0.4;
  g.add(taban);

  /* Anode / gas distributor closes the back of the annulus. */
  const anode = new THREE.Mesh(
    new THREE.TorusGeometry((rCh + rIn) / 2, (rCh - rIn) / 2, 6, 24), kit.bakir);
  anode.scale.z = 0.3;
  anode.position.z = zEx - len * 0.44;
  g.add(anode);

  /* Magnetic poles: the inner pole piece caps the centre column, the outer
     pole is the front ring. Without both there is no radial field and the
     device is a leaky gas valve. */
  const icKutup = new THREE.Mesh(cylGeoZ(rIn * 0.92, rIn * 0.92, len * 0.14, 20), kit.metal);
  icKutup.position.z = zEx - len * 0.06;
  g.add(icKutup);
  const disKutup = new THREE.Mesh(new THREE.TorusGeometry(rOut * 0.92, rOut * 0.065, 8, 30), kit.metal);
  disKutup.position.z = zEx - len * 0.04;
  g.add(disKutup);

  for (let i = 0; i < coils; i++) {
    const a = i * TAU / coils + Math.PI / coils;
    /* Outer solenoids sit in the gap between the channel and the housing,
       tucked just under the outer pole so the pole ring stays the top. */
    const coil = new THREE.Mesh(cylGeoZ(rOut * 0.12, rOut * 0.12, len * 0.3, 14), kit.bakir);
    coil.position.set(Math.cos(a) * (rCh + rOut) / 2, Math.sin(a) * (rCh + rOut) / 2, zEx - len * 0.42);
    g.add(coil);
    const cap = new THREE.Mesh(cylGeoZ(rOut * 0.14, rOut * 0.14, len * 0.04, 14), kit.koyuMetal);
    cap.position.set(Math.cos(a) * (rCh + rOut) / 2, Math.sin(a) * (rCh + rOut) / 2, zEx - len * 0.26);
    g.add(cap);
  }

  /* Hollow cathode: mounted outboard and canted in so its electron cloud
     reaches the beam. Built by tilting about a WORLD axis - rotation.set
     would apply z first and point it somewhere else entirely. */
  if (cathode) {
    const kat = new THREE.Group();
    const tube = new THREE.Mesh(cylGeoZ(rOut * 0.09, rOut * 0.09, len * 0.5, 14), kit.koyuMetal);
    kat.add(tube);
    const tip = new THREE.Mesh(cylGeoZ(rOut * 0.05, rOut * 0.05, len * 0.08, 12), kit.gold);
    tip.position.z = len * 0.28;
    kat.add(tip);
    kat.position.set(rOut * 1.02, 0, zEx - len * 0.3);
    kat.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), -0.22);
    g.add(kat);
  }

  const flange = new THREE.Mesh(cylGeoZ(rOut * 1.1, rOut * 1.1, len * 0.07, 26), kit.alu);
  flange.position.z = -zEx + len * 0.035;
  g.add(flange);
  const bc = boltCircle(THREE, kit, rOut * 0.98, bolts);
  bc.position.z = -zEx + len * 0.07;
  g.add(bc);

  /* Xenon feed: a thin line to the anode, with a clamp. If it is not drawn
     the unit looks self-contained, which is the one thing it is not. */
  if (feed) {
    const line = new THREE.Mesh(cylGeoX(rOut * 0.05, rOut * 0.05, rOut * 0.8, 10), kit.mliSilver);
    line.position.set(-rOut * 0.8, 0, -zEx + len * 0.16);
    g.add(line);
    const clamp = new THREE.Mesh(new THREE.TorusGeometry(rOut * 0.07, rOut * 0.02, 6, 12), kit.alu);
    clamp.position.set(-rOut * 0.9, 0, -zEx + len * 0.16);
    clamp.rotation.y = Math.PI / 2;
    g.add(clamp);
  }

  g.userData.notes = { regime: 'propulsion',
    why: 'Ions are accelerated out of a ceramic annulus by crossed E and B fields; the poles and coils that make that field are the hardware.' };
  return g;
}

/**
 * Fluxgate magnetometer head — a triad, and everything about it is about
 * NOT disturbing what it measures.
 *
 * Three orthogonal ring cores read the three field components. The housing
 * is non-magnetic composite, the mount is three-point kinematic so thermal
 * strain cannot twist the alignment, and an optical alignment cube on top
 * is how the triad's axes are tied to the spacecraft's frame on the ground.
 */
export function magnetometerHead(THREE, kit, s, opts = {}) {
  const { shade = true, pigtail = true, cube = true, bolts = false, windings = 8 } = opts;
  const g = new THREE.Group();
  /* Non-magnetic housing: pale composite, not aluminium - a steel screw
     near the sensor is a bias error nobody can calibrate out in flight. */
  /* Cut away: the three ring cores are the whole instrument, and a solid
     housing hides them completely - which is what the first render showed.
     A technical view earns the cutaway; a photograph would not. */
  const kompozit = new THREE.MeshStandardMaterial({ color: 0xd9d4c6, roughness: 0.74, metalness: 0.02,
    transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide });
  const kutu = new THREE.Mesh(new THREE.BoxGeometry(s, s, s * 0.9), kompozit);
  g.add(kutu);
  /* The edges stay solid so the housing still reads as a box. */
  for (const [w, h, d, px, py, pz] of [
    [s, s * 0.06, s * 0.06, 0, s * 0.47, s * 0.45], [s, s * 0.06, s * 0.06, 0, -s * 0.47, s * 0.45],
    [s, s * 0.06, s * 0.06, 0, s * 0.47, -s * 0.45], [s, s * 0.06, s * 0.06, 0, -s * 0.47, -s * 0.45],
    [s * 0.06, s, s * 0.06, s * 0.47, 0, s * 0.45], [s * 0.06, s, s * 0.06, -s * 0.47, 0, s * 0.45],
    [s * 0.06, s, s * 0.06, s * 0.47, 0, -s * 0.45], [s * 0.06, s, s * 0.06, -s * 0.47, 0, -s * 0.45],
  ]) {
    const kenar = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), kit.white);
    kenar.position.set(px, py, pz);
    g.add(kenar);
  }

  /* Three ring cores, one per axis. Single-axis rotations only. */
  const cekirdek = new THREE.MeshStandardMaterial({ color: 0x6f7d8c, roughness: 0.38, metalness: 0.8 });
  const rc = s * 0.3;
  for (const [ekseni, rx, ry] of [['z', 0, 0], ['y', Math.PI / 2, 0], ['x', 0, Math.PI / 2]]) {
    const core = new THREE.Mesh(new THREE.TorusGeometry(rc, s * 0.05, 8, 24), cekirdek);
    core.rotation.set(rx, ry, 0);
    g.add(core);
    /* Sense winding: eight turns of copper, so a core reads as wound rather
       than as a plain ring. */
    for (let i = 0; i < windings; i++) {
      const a = i * TAU / windings;
      const turn = new THREE.Mesh(new THREE.TorusGeometry(s * 0.062, s * 0.014, 5, 10), kit.bakir);
      turn.position.set(Math.cos(a) * rc, Math.sin(a) * rc, 0);
      turn.rotation.y = Math.PI / 2;
      turn.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), a);
      const hold = new THREE.Group();
      hold.rotation.set(rx, ry, 0);
      hold.add(turn);
      g.add(hold);
    }
    void ekseni;
  }

  /* Three-point kinematic mount: three feet, not four. A fourth foot makes
     the mount statically indeterminate and the housing carries the strain. */
  for (let i = 0; i < 3; i++) {
    const a = i * TAU / 3;
    const foot = new THREE.Mesh(cylGeoZ(s * 0.07, s * 0.09, s * 0.16, 10), kit.alu);
    foot.position.set(Math.cos(a) * s * 0.34, Math.sin(a) * s * 0.34, -s * 0.53);
    g.add(foot);
    if (bolts) {
      const bolt = new THREE.Mesh(cylGeoZ(s * 0.025, s * 0.025, s * 0.05, 8), kit.gold);
      bolt.position.set(Math.cos(a) * s * 0.34, Math.sin(a) * s * 0.34, -s * 0.62);
      g.add(bolt);
    }
  }

  if (cube) {
    const ac = new THREE.Mesh(new THREE.BoxGeometry(s * 0.2, s * 0.2, s * 0.2), kit.gold);
    ac.position.z = s * 0.56;
    g.add(ac);
  }
  if (shade) {
    /* Sun shade on stand-offs: the sensor's bias drifts with temperature,
       so the cheapest fix is to keep the Sun off it. */
    const sh = new THREE.Mesh(new THREE.BoxGeometry(s * 1.3, s * 1.3, s * 0.04), kit.mliSilver);
    sh.position.z = s * 0.74;
    g.add(sh);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const post = new THREE.Mesh(cylGeoZ(s * 0.03, s * 0.03, s * 0.3, 8), kit.alu);
      post.position.set(sx * s * 0.5, sy * s * 0.5, s * 0.6);
      g.add(post);
    }
  }
  if (pigtail) {
    const con = new THREE.Mesh(cylGeoX(s * 0.08, s * 0.08, s * 0.16, 10), kit.connector);
    con.position.set(-s * 0.55, 0, -s * 0.2);
    g.add(con);
  }
  g.userData.notes = { regime: 'sensing',
    why: 'Three orthogonal ring cores give the field vector; the composite housing and three-point mount exist so the instrument does not corrupt its own measurement.' };
  return g;
}

/**
 * Liquid rocket engine — bell, throat, chamber, and the machinery that
 * feeds it.
 *
 * Drawn as a cone, an engine loses everything that makes it one. The
 * nozzle is a BELL, not a cone: the contour turns over so the flow leaves
 * axially instead of spreading, and the difference is a few per cent of
 * thrust. Above the throat sit the chamber and the injector; beside it the
 * turbopump, which is the part that actually makes a pump-fed engine hard;
 * and underneath the gimbal block, because the engine has to steer.
 *
 * Exit plane at -z, mount at +z.
 */
export function rocketEngine(THREE, kit, rExit, len, opts = {}) {
  const { hoops = 5, turbopump = true, gimbal = true, feedLines = 2, rThroat = null } = opts;
  const g = new THREE.Group();
  const rT = rThroat ?? rExit * 0.28;
  const yari = len / 2;

  /* Bell contour, sampled as a lathe profile. A parabolic approximation is
     what a real bell is: fast expansion after the throat, then a turn-over
     so the exhaust leaves nearly axial. A straight cone would spread it. */
  const nokta = [];
  const N = 14;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    /* r grows as sqrt(u) - steep at the throat, flattening toward the exit. */
    const r = rT + (rExit - rT) * Math.sqrt(u);
    nokta.push(new THREE.Vector2(r, -yari + u * len * 0.78));
  }
  const bellMat = (kit.koyuMetal || kit.aluDark).clone();
  bellMat.side = THREE.DoubleSide;
  /* latheZ, not a bare LatheGeometry: it puts the axis on +Z and, more to
     the point, it reverses a descending profile so the normals face out.
     That reversal is why three earlier surfaces rendered black. */
  const bell = latheZ(nokta, 30, bellMat);
  bell.castShadow = true;
  g.add(bell);

  /* Regenerative cooling tubes read as stiffening hoops down the bell. */
  for (let i = 1; i <= hoops; i++) {
    const u = i / (hoops + 1);
    const r = rT + (rExit - rT) * Math.sqrt(u);
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(r * 1.01, rExit * 0.022, 6, 26), kit.metal);
    hoop.position.z = -yari + u * len * 0.78;
    g.add(hoop);
  }
  /* Exit lip: the one edge of an engine that is always visible. */
  const lip = new THREE.Mesh(new THREE.TorusGeometry(rExit, rExit * 0.035, 8, 30), kit.alu);
  lip.position.z = -yari + len * 0.78;
  g.add(lip);

  /* Throat and combustion chamber. */
  const bogaz = new THREE.Mesh(cylGeoZ(rT, rT * 1.18, len * 0.06, 20), kit.metal);
  bogaz.position.z = -yari - len * 0.03;
  g.add(bogaz);
  const oda = new THREE.Mesh(cylGeoZ(rT * 1.45, rT * 1.45, len * 0.14, 22), kit.alu);
  oda.position.z = -yari - len * 0.13;
  g.add(oda);
  const enjektor = new THREE.Mesh(cylGeoZ(rT * 1.6, rT * 1.6, len * 0.05, 22), kit.koyuMetal);
  enjektor.position.z = -yari - len * 0.22;
  g.add(enjektor);

  if (turbopump) {
    /* Two volutes on a common shaft: one for each propellant, which is why
       an engine of this class has one pump and two inlets. */
    for (const [e, mat] of [[1, kit.alu], [-1, kit.aluDark]]) {
      const volut = new THREE.Mesh(new THREE.TorusGeometry(rT * 0.52, rT * 0.3, 8, 18), mat);
      volut.position.set(e * rT * 1.5, 0, -yari - len * 0.3);
      volut.rotation.y = Math.PI / 2;
      g.add(volut);
    }
    const mil = new THREE.Mesh(cylGeoX(rT * 0.2, rT * 0.2, rT * 3.4, 12), kit.metal);
    mil.position.z = -yari - len * 0.3;
    g.add(mil);
  }
  for (let i = 0; i < feedLines; i++) {
    const a = i * Math.PI + Math.PI / 2;
    const hat = new THREE.Mesh(cylGeoZ(rT * 0.18, rT * 0.18, len * 0.3, 10), kit.mliSilver);
    hat.position.set(Math.cos(a) * rT * 1.7, Math.sin(a) * rT * 1.7, -yari - len * 0.2);
    g.add(hat);
  }
  if (gimbal) {
    /* The gimbal block is the single point the whole stage's thrust passes
       through, and it is the reason the engine can steer at all. */
    const blok = new THREE.Mesh(new THREE.BoxGeometry(rT * 1.5, rT * 1.5, len * 0.08), kit.alu);
    blok.position.z = yari - len * 0.06;
    g.add(blok);
    for (const e of [-1, 1]) {
      const boss = new THREE.Mesh(cylGeoX(rT * 0.3, rT * 0.3, rT * 2.0, 12), kit.koyuMetal);
      boss.position.set(0, e * rT * 0.75, yari - len * 0.06);
      g.add(boss);
    }
    const boyun = new THREE.Mesh(cylGeoZ(rT * 1.0, rT * 1.3, len * 0.2, 16), kit.aluDark);
    boyun.position.z = yari - len * 0.2;
    g.add(boyun);
  }
  g.userData.notes = { regime: 'propulsion',
    why: 'The bell turns over so the exhaust leaves axially; a straight cone would spread it and lose several per cent of the thrust.' };
  return g;
}

/* ══ attitude hardware and panel interfaces ═══════════════════════ */

/**
 * Reaction wheel assembly — a flywheel is the least of it.
 *
 * The wheel stores angular momentum, so the mass belongs at the RIM; the
 * centre of a reaction wheel is empty on purpose. Everything else exists
 * because the rotor spins at six thousand rpm a metre from an optical
 * bench: two bearing cartridges in a preloaded pair, a brushless stator
 * whose windings are the only thing that touches the rotor magnetically,
 * a hall sensor to know where it is, a launch lock so it does not brinell
 * its own bearings on the pad, and isolator feet so its residual imbalance
 * does not get written straight into the payload.
 *
 * Spin axis is +Z; the mounting feet are at -Z.
 */
export function reactionWheel(THREE, kit, r, h, opts = {}) {
  const { isolators = 3, bolts = 8, launchLock = true, cutaway = true } = opts;
  const g = new THREE.Group();

  /* Housing: also the vacuum enclosure, because a rotor spinning in air
     would cook its own bearings. Drawn as a 300-degree wall with the last
     60 cut away, NOT as a translucent shell: fogging the whole can made
     every internal part grey and unreadable, where an opened sector lets
     the rotor be seen sharply and still says "there is a wall here". */
  const acik = cutaway ? Math.PI * 1.68 : TAU;
  const kasa = new THREE.Mesh(cylGeoZ(r, r, h, 34, true, -acik / 2, acik), kit.alu.clone());
  kasa.material.side = THREE.DoubleSide;
  g.add(kasa);
  /* Stiffening ribs down the wall: a thin can this size would oil-can. */
  for (let i = 0; i < 8; i++) {
    const a = -acik / 2 + (i + 0.5) * acik / 8;
    const kaburga = new THREE.Mesh(new THREE.BoxGeometry(r * 0.05, r * 0.03, h * 0.88), kit.aluDark);
    kaburga.position.set(Math.cos(a) * r * 1.02, Math.sin(a) * r * 1.02, 0);
    kaburga.rotation.z = a;
    g.add(kaburga);
  }
  /* Top cover with its own fastener line, and the mounting face below. */
  const ust = new THREE.Mesh(cylGeoZ(r * 0.94, r * 0.94, h * 0.07, 30), kit.metal);
  ust.position.z = h * 0.47;
  g.add(ust);
  const ustVida = boltCircle(THREE, kit, r * 0.82, 12);
  ustVida.position.z = h * 0.52;
  g.add(ustVida);
  /* Mounting flange, proud of the can so the bolts have metal to sit on. */
  const flans = new THREE.Mesh(cylGeoZ(r * 1.16, r * 1.16, h * 0.07, 32), kit.aluDark);
  flans.position.z = -h * 0.5;
  g.add(flans);
  for (let i = 0; i < bolts; i++) {
    const a = i * TAU / bolts;
    const boss = new THREE.Mesh(cylGeoZ(r * 0.1, r * 0.11, h * 0.1, 10), kit.alu);
    boss.position.set(Math.cos(a) * r * 1.02, Math.sin(a) * r * 1.02, -h * 0.48);
    g.add(boss);
  }
  const bc = boltCircle(THREE, kit, r * 1.02, bolts);
  bc.position.z = -h * 0.42;
  g.add(bc);

  /* Rotor: a thin web carrying a heavy rim. Momentum goes as m*r^2, so
     the same mass out at the rim stores several times what it would at
     the hub - which is why the middle is empty. */
  /* The spinning parts go in their OWN group, exposed as userData.rotor, so a
     scene can turn them. A wheel drawn stationary is the one part of an
     attitude system whose whole job is visible motion, and the row declares a
     speed - 6000 rpm - that nothing on the page was using. */
  const rotor = new THREE.Group();
  g.add(rotor);
  g.userData.rotor = rotor;
  const web = new THREE.Mesh(cylGeoZ(r * 0.74, r * 0.74, h * 0.1, 26), kit.white);
  rotor.add(web);
  const jant = new THREE.Mesh(new THREE.TorusGeometry(r * 0.76, r * 0.13, 10, 34), kit.koyuMetal);
  jant.scale.z = 0.72;
  rotor.add(jant);
  /* Lightening holes in the web: mass that is not at the rim is wasted. They
     are also what makes the spin READABLE - a featureless disc turning about
     its own axis looks identical to a disc standing still. */
  for (let i = 0; i < 6; i++) {
    const a = i * TAU / 6;
    const delik = new THREE.Mesh(cylGeoZ(r * 0.13, r * 0.13, h * 0.12, 12), kit.black);
    delik.position.set(Math.cos(a) * r * 0.44, Math.sin(a) * r * 0.44, 0);
    rotor.add(delik);
  }
  /* A balance mark on the rim: how a spinning wheel shows its speed. */
  const isaret = new THREE.Mesh(new THREE.BoxGeometry(r * 0.1, r * 0.05, h * 0.16), kit.gold);
  isaret.position.set(r * 0.76, 0, h * 0.06);
  rotor.add(isaret);

  /* Shaft and a preloaded pair of bearing cartridges. A single bearing
     cannot take axial load in both directions; the pair is the reason the
     rotor stays where it is under launch. */
  const mil = new THREE.Mesh(cylGeoZ(r * 0.09, r * 0.09, h * 0.86, 16), kit.metal);
  g.add(mil);
  for (const e of [-1, 1]) {
    const yatak = new THREE.Mesh(cylGeoZ(r * 0.18, r * 0.18, h * 0.14, 18), kit.aluDark);
    yatak.position.z = e * h * 0.3;
    g.add(yatak);
    const bilezik = new THREE.Mesh(new THREE.TorusGeometry(r * 0.185, r * 0.022, 6, 18), kit.gold);
    bilezik.position.z = e * h * 0.3;
    g.add(bilezik);
  }

  /* Brushless stator: the windings are what actually turn the wheel. */
  for (let i = 0; i < 8; i++) {
    const a = i * TAU / 8;
    const sargi = new THREE.Mesh(new THREE.TorusGeometry(r * 0.055, r * 0.028, 5, 10), kit.bakir);
    sargi.position.set(Math.cos(a) * r * 0.26, Math.sin(a) * r * 0.26, -h * 0.08);
    sargi.rotation.y = Math.PI / 2;
    sargi.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), a);
    g.add(sargi);
  }
  /* Hall sensor: without it the drive does not know where the rotor is. */
  const hall = new THREE.Mesh(new THREE.BoxGeometry(r * 0.12, r * 0.08, h * 0.08), kit.black);
  hall.position.set(r * 0.42, 0, -h * 0.12);
  g.add(hall);

  if (launchLock) {
    /* Launch lock: it clamps the rotor for the ride up. A wheel free to
       rattle brinells its own races before it ever spins. */
    const kilit = new THREE.Mesh(cylGeoZ(r * 0.1, r * 0.1, h * 0.3, 10), kit.gold);
    kilit.position.set(-r * 0.5, 0, h * 0.28);
    g.add(kilit);
    const pim = new THREE.Mesh(cylGeoZ(r * 0.04, r * 0.04, h * 0.5, 8), kit.koyuMetal);
    pim.position.set(-r * 0.5, 0, h * 0.1);
    g.add(pim);
  }

  for (let i = 0; i < isolators; i++) {
    const a = i * TAU / isolators + 0.4;
    const iso = new THREE.Mesh(cylGeoZ(r * 0.1, r * 0.13, h * 0.34, 12), kit.black);
    iso.position.set(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8, -h * 0.62);
    g.add(iso);
    const pabuc = new THREE.Mesh(new THREE.BoxGeometry(r * 0.26, r * 0.26, h * 0.06), kit.alu);
    pabuc.position.set(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8, -h * 0.8);
    g.add(pabuc);
  }

  const kon = new THREE.Mesh(cylGeoX(r * 0.1, r * 0.09, r * 0.18, 10), kit.connector);
  kon.position.set(r * 1.05, 0, -h * 0.2);
  g.add(kon);

  g.userData.notes = { regime: 'attitude',
    why: 'Momentum goes as mass times radius squared, so the rotor is a heavy rim on a light web and the middle is deliberately empty.' };
  return g;
}

/**
 * Inertial measurement unit — the gyros have to be visible or it is a box.
 *
 * Three ring laser gyros in a block, each sensing one axis, plus an
 * optical alignment cube that ties their axes to the spacecraft's frame
 * on the ground. The housing is hermetic because a ring laser gyro is a
 * sealed optical cavity and a leak ends it.
 */
export function gyroBlock(THREE, kit, sx, sy, sz, opts = {}) {
  const { cube = true, connectors = 2, cutaway = true } = opts;
  const g = new THREE.Group();
  const govdeMat = cutaway ? kit.alu.clone() : kit.alu;
  if (cutaway) { govdeMat.transparent = true; govdeMat.opacity = 0.4; govdeMat.depthWrite = false; }
  g.add(new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), govdeMat));

  /* Three cavities, one per axis. A ring laser gyro is a closed triangular
     light path; drawn as a ring because that is what the block shows. */
  const yol = new THREE.MeshStandardMaterial({ color: 0x7a5fd0, roughness: 0.3, metalness: 0.2,
    emissive: 0x3a2870, emissiveIntensity: 0.7 });
  const r = Math.min(sx, sy, sz) * 0.3;
  for (const [rx, ry] of [[0, 0], [Math.PI / 2, 0], [0, Math.PI / 2]]) {
    const eksen = new THREE.Group();
    eksen.rotation.set(rx, ry, 0);
    /* The cavity is a triangular light path, so it is drawn as three
       BORES between three mirrors rather than as a three-segment torus -
       the torus rendered as a wireframe star and read as a symbol, not as
       a block of glass-ceramic with holes in it. */
    for (let i = 0; i < 3; i++) {
      const a0 = i * TAU / 3, a1 = (i + 1) * TAU / 3;
      const p0 = new THREE.Vector3(Math.cos(a0) * r, Math.sin(a0) * r, 0);
      const p1 = new THREE.Vector3(Math.cos(a1) * r, Math.sin(a1) * r, 0);
      const boy = p0.distanceTo(p1);
      const bore = new THREE.Mesh(cylGeoZ(r * 0.1, r * 0.1, boy, 10), yol);
      bore.position.copy(p0).add(p1).multiplyScalar(0.5);
      bore.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1),
        p1.clone().sub(p0).normalize());
      eksen.add(bore);
      /* Corner mirror: the precision part, and the one that ages. */
      const ayna = new THREE.Mesh(cylGeoZ(r * 0.18, r * 0.18, r * 0.12, 10), kit.mliSilver);
      ayna.position.copy(p0);
      eksen.add(ayna);
    }
    g.add(eksen);
  }
  if (cube) {
    const kup = new THREE.Mesh(new THREE.BoxGeometry(sx * 0.16, sx * 0.16, sx * 0.16), kit.gold);
    kup.position.set(0, 0, sz * 0.58);
    g.add(kup);
  }
  for (let i = 0; i < connectors; i++) {
    const k = new THREE.Mesh(cylGeoX(sx * 0.07, sx * 0.06, sx * 0.14, 10), kit.connector);
    k.position.set(sx * 0.56, (i - (connectors - 1) / 2) * sy * 0.34, -sz * 0.18);
    g.add(k);
  }
  /* Hard-mounted, not isolated: an IMU on soft feet measures the feet. */
  for (const ex of [-1, 1]) for (const ey of [-1, 1]) {
    const ayak = new THREE.Mesh(new THREE.BoxGeometry(sx * 0.14, sy * 0.14, sz * 0.1), kit.aluDark);
    ayak.position.set(ex * sx * 0.42, ey * sy * 0.42, -sz * 0.52);
    g.add(ayak);
  }
  g.userData.notes = { regime: 'attitude',
    why: 'Three sealed optical cavities, one per axis, and an alignment cube that ties them to the spacecraft frame.' };
  return g;
}

/**
 * Slide rail and its lock.
 *
 * Four panels in this catalogue declare a `kizak` interface - they slide
 * onto the bus at panel level and then lock - and nothing was drawn. A rail
 * is a pair of guides and a latch at the end of the travel; without it the
 * interface exists only in the text.
 */
export function slideRail(THREE, kit, uzunluk, opts = {}) {
  const { locks = 2, en = 0.05 } = opts;
  const g = new THREE.Group();
  for (const e of [-1, 1]) {
    const kanal = new THREE.Mesh(new THREE.BoxGeometry(en, en * 0.55, uzunluk), kit.metal);
    kanal.position.set(0, e * en * 0.9, 0);
    g.add(kanal);
  }
  for (let i = 0; i < locks; i++) {
    const z = (i / Math.max(1, locks - 1) - 0.5) * uzunluk * 0.72;
    const kilit = new THREE.Mesh(new THREE.BoxGeometry(en * 1.5, en * 2.4, en * 1.6), kit.aluDark);
    kilit.position.set(0, 0, z);
    g.add(kilit);
    const kol = new THREE.Mesh(cylGeoY(en * 0.22, en * 0.22, en * 3.0, 8), kit.gold);
    kol.position.set(en * 0.5, 0, z);
    g.add(kol);
  }
  g.userData.notes = { regime: 'mechanism',
    why: 'The panel is built and tested on a bench, then slides on and locks; working inside a closed satellite is what this avoids.' };
  return g;
}

export { TAU };
