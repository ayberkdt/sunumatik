/* sat-build.mjs — parça kataloğunu GÖVDEYE çevirir.
 *
 * Her parça kendi satırındaki `sekil`, `size` ve `pos` ile kurulur; burada
 * tek bir ölçü elle yazılmaz. Böylece kataloğu değiştirmek modeli de
 * değiştirir ve kütle bütçesiyle çizim asla ayrışmaz.
 *
 * Eksen sözleşmesi: çıplak CylinderGeometry/ConeGeometry kullanılmaz,
 * `core/geometry-axis.mjs` yardımcıları kullanılır (eksen ratchet'i sınar).
 */

import { PARTS, SUBSYSTEMS, partById, depth, GUNES_YONU, sadaAcisi, boresightYonu } from './sat-parts.mjs';
import { cylGeoY, cylGeoX, cylGeoZ, coneGeoZ, latheZ } from '../core/geometry-axis.mjs';
import * as D from './sat-detail.mjs';
import { buildShape, knowsKind } from '../core/hardware-shapes.mjs';

/* Subsystem colour is a LABEL, not a paint job.
 *
 * Every body was rendering in a fully saturated subsystem hue, so a star
 * tracker came out baby blue and a payload came out mint green, and the
 * whole spacecraft read as coloured plastic. Flight hardware is aluminium
 * with anodising, tape and blanket on it; the hue is still there to group
 * parts in the exploded view, but it is mixed most of the way back to
 * metal and the surface properties are a metal's.
 */
const METAL = 0xa8aeb8;
const TINT = 0.42;                    // how much subsystem hue survives
const renkler = (THREE, tk = {}) => {
  const mat = (hex, r, m, ek = {}) => {
    const c = new THREE.Color(hex).lerp(new THREE.Color(METAL), 1 - TINT);
    return new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...ek });
  };
  return {
    yapi: mat(tk.yapi ?? 0x9aa0aa, .52, .72),
    itki: mat(tk.itki ?? 0xc98a5c, .48, .68),
    guc: mat(tk.guc ?? 0xe0b25a, .46, .6),
    adcs: mat(tk.adcs ?? 0x7fb0c9, .44, .68),
    haberlesme: mat(tk.haberlesme ?? 0xb4a8c9, .44, .66),
    isil: mat(tk.isil ?? 0x8fa2b4, .62, .5),
    faydali: mat(tk.faydali ?? 0x9ec98a, .4, .62),
    /* The harness volume stays a declared volume, so it keeps its hue. */
    kablaj: new THREE.MeshStandardMaterial({ color: tk.kablaj ?? 0x6f7688, roughness: .8, metalness: .2,
      transparent: true, opacity: .34 }),
  };
};

/* Güneş paneli yüzü: hücre deseni prosedürel (doku ÇEKİLMEZ). */
function hucreDokusu(THREE, seed = 7) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#16283a'; g.fillRect(0, 0, 256, 128);
  g.strokeStyle = 'rgba(190,210,235,.30)'; g.lineWidth = 1;
  for (let x = 0; x <= 256; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 128); g.stroke(); }
  for (let y = 0; y <= 128; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
  g.fillStyle = 'rgba(255,255,255,.05)';
  for (let i = 0; i < 40; i++) g.fillRect((i * 37 + seed) % 256, (i * 53) % 128, 14, 14);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Tek parçanın gövdesi. Dönen grup parçanın MERKEZİNDE oturur. */
/* How many connectors a box gets is not a style choice: it follows the
   unit's declared power and data. A 340 W, 420 Mbps box does not leave the
   bench with two plugs on it. */
function konnektorSayisi(p) {
  const t = p.tech || {};
  let n = 2;
  if ((t.guc_W ?? 0) >= 80) n += 2;
  if ((t.guc_W ?? 0) >= 250) n += 2;
  if (t.veri_Mbps) n += 2;
  return Math.min(n, 8);
}

/* Bolt count is read out of the fastening text where the catalogue states
   one, so the drawing cannot disagree with the spec. */
export function cikarBoltSayisi(p, varsayilan) {
  const m = /(\d+)\s*[x\u00d7]\s*M\d/.exec(p.tech?.baglanti || '');
  return m ? Math.min(Number(m[1]), 48) : varsayilan;
}

/* Shapes the satellite builds ITSELF, before the shared grammar is asked.
 * Declared rather than inferred so the dispatch order is visible from
 * outside: these names SHADOW any grammar kind of the same name.
 * `scripts/validate-hardware.mjs` asserts the shadow list is exactly
 * {panel, tank}, so a new accidental collision fails the gate instead of
 * quietly changing which geometry a row gets. */
export const LOCAL_KINDS = Object.freeze(new Set([
  'halka', 'silindir', 'tank', 'kure', 'nozul', 'panel', 'kutu', 'tekerlek',
  'jiroskop',
  'bafil', 'cubuk', 'boru', 'kanat', 'canak', 'kabuk', 'gizli',
]));

/* Run count read out of the spec line, the same way the bolt count is.
   The heat-pipe row says "8 runs" and the drawing had two; a number in the
   text that the geometry contradicts is worse than no number. */
export function cikarHatSayisi(p, varsayilan) {
  const m = /(\d+)\s*runs?\b/i.exec(p.tech?.detay || '');
  return m ? Math.min(Number(m[1]), 16) : varsayilan;
}

function govde(THREE, p, mat, dokular) {
  /* The kit's material family, resolved once per body. */
  const KIT = dokular.kit;
  const [sx, sy, sz] = p.size;
  const g = new THREE.Group();
  const ekle = (m) => { m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };

  switch (p.sekil) {
    case 'halka': {
      const dis = ekle(new THREE.Mesh(cylGeoY(sx / 2, sx / 2, sz, 40, true), mat));
      dis.rotation.x = Math.PI / 2;
      const ic = ekle(new THREE.Mesh(cylGeoY(sx / 2 - 0.05, sx / 2 - 0.05, sz * 1.02, 40, true), mat));
      ic.rotation.x = Math.PI / 2;
      for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6;
        const c = ekle(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, sz * 1.4), mat));
        c.position.set(Math.cos(a) * (sx / 2 - 0.025), Math.sin(a) * (sx / 2 - 0.025), 0);
      }
      /* The V-band clamp itself, the two pyrotechnic bolt cutters that
         release it, and the separation springs that push the spacecraft
         off the adapter. This is the one interface the launch vehicle
         touches, so it is the one that should read unambiguously. */
      const rr = sx / 2;
      const band = ekle(new THREE.Mesh(new THREE.TorusGeometry(rr * 1.04, sz * 0.36, 8, 44), KIT.alu));
      for (const a of [0.35, Math.PI + 0.35]) {
        const kesici = ekle(new THREE.Mesh(new THREE.BoxGeometry(rr * 0.16, rr * 0.1, sz * 1.5), KIT.gold));
        kesici.position.set(Math.cos(a) * rr * 1.06, Math.sin(a) * rr * 1.06, 0);
        kesici.rotation.z = a;
      }
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + Math.PI / 4;
        const yay = ekle(new THREE.Mesh(cylGeoZ(rr * 0.045, rr * 0.045, sz * 1.6, 10), KIT.aluDark));
        yay.position.set(Math.cos(a) * rr * 0.86, Math.sin(a) * rr * 0.86, sz * 0.5);
      }
      g.add(D.boltCircle(THREE, KIT, rr * 0.9, cikarBoltSayisi(p, 24)));
      void band;
      break;
    }
    case 'silindir': {
      /* The thrust tube is the main load path, and it looks like one: a
         CFRP barrel with machined end rings, ring frames against buckling,
         longerons between them, and the harness pass-throughs that let
         cables get from the lower deck to the upper one. */
      const r = sx / 2;
      const m = ekle(new THREE.Mesh(cylGeoY(r, r, sz, 40, true), mat));
      m.rotation.x = Math.PI / 2;
      for (const e of [-1, 1]) {
        const ring = ekle(new THREE.Mesh(new THREE.TorusGeometry(r * 1.03, r * 0.05, 8, 40), KIT.alu));
        ring.position.z = e * sz / 2;
        const bolts = D.boltCircle(THREE, KIT, r * 1.03, cikarBoltSayisi(p, 24));
        bolts.position.z = e * sz / 2;
        g.add(bolts);
      }
      const nRing = 3;
      for (let i = 0; i < nRing; i++) {
        const fr = ekle(new THREE.Mesh(new THREE.TorusGeometry(r * 1.015, r * 0.022, 6, 36), KIT.aluDark));
        fr.position.z = ((i + 1) / (nRing + 1) - 0.5) * sz;
      }
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        const lg = ekle(new THREE.Mesh(new THREE.BoxGeometry(r * 0.05, r * 0.03, sz * 0.94), KIT.aluDark));
        lg.position.set(Math.cos(a) * r * 1.01, Math.sin(a) * r * 1.01, 0);
        lg.rotation.z = a;
      }
      /* Harness pass-throughs: without them the cables have no legal route
         and the whole integration order stops making sense. */
      for (const a of [0.6, Math.PI - 0.6]) {
        const hole = ekle(new THREE.Mesh(new THREE.TorusGeometry(r * 0.13, r * 0.022, 6, 16), KIT.alu));
        hole.position.set(Math.cos(a) * r, Math.sin(a) * r, sz * 0.22);
        hole.rotation.y = Math.PI / 2;
        hole.rotation.z = a;
      }
      break;
    }
    case 'tank': {
      const r = sx / 2;
      const m = ekle(new THREE.Mesh(cylGeoY(r, r, sz * 0.7, 32), mat));
      m.rotation.x = Math.PI / 2;
      for (const s2 of [1, -1]) {
        const kap = ekle(new THREE.Mesh(new THREE.SphereGeometry(r, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), mat));
        kap.position.z = s2 * sz * 0.35;
        kap.rotation.x = s2 > 0 ? -Math.PI / 2 : Math.PI / 2;
      }
      /* Girth weld where the two domes meet the barrel - on a titanium
         tank this is the most inspected line on the spacecraft. */
      for (const s2 of [1, -1]) {
        const weld = ekle(new THREE.Mesh(new THREE.TorusGeometry(r * 1.004, r * 0.018, 6, 36), KIT.mliSilver));
        weld.position.z = s2 * sz * 0.35;
      }
      /* Mounting lugs, fill/drain valve and the blanket that keeps the
         propellant above its freezing point. */
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + Math.PI / 4;
        const lug = ekle(new THREE.Mesh(new THREE.BoxGeometry(r * 0.22, r * 0.1, r * 0.3), KIT.alu));
        lug.position.set(Math.cos(a) * r * 1.05, Math.sin(a) * r * 1.05, 0);
        lug.rotation.z = a;
      }
      const valf = ekle(new THREE.Mesh(cylGeoZ(r * 0.1, r * 0.1, r * 0.3, 12), KIT.aluDark));
      valf.position.set(0, 0, -sz * 0.52);
      const kapak = ekle(new THREE.Mesh(new THREE.TorusGeometry(r * 0.13, r * 0.035, 6, 14), KIT.gold));
      kapak.position.set(0, 0, -sz * 0.62);
      const batt = D.blanketWrap(THREE, KIT, r * 1.03, sz * 0.66, dokular.mli.clone(), { seams: 5 });
      g.add(batt);
      break;
    }
    case 'kure': {
      /* A COPV is not a bare ball: the carbon overwrap runs in visible
         helical bands, it sits in a saddle, and it has a boss with a
         regulator on it. */
      const r = sx / 2;
      ekle(new THREE.Mesh(new THREE.SphereGeometry(r, 28, 20), mat));
      /* Meridional overwrap bands. Setting rotation.set(PI/2, 0, angle)
         did NOT work: three's XYZ order applies Z to the vector first, so
         all five bands came out in nearly the same plane and the tank
         looked like it had one strap. Tilt first, then turn about the
         WORLD axis. */
      const dikeyEksen = new THREE.Vector3(0, 0, 1);
      for (let i = 0; i < 5; i++) {
        const band = ekle(new THREE.Mesh(new THREE.TorusGeometry(r * 1.004, r * 0.028, 6, 30), KIT.aluDark));
        band.rotation.x = Math.PI / 2;
        band.rotateOnWorldAxis(dikeyEksen, i * Math.PI / 5);
      }
      const boss = ekle(new THREE.Mesh(cylGeoZ(r * 0.2, r * 0.2, r * 0.26, 14), KIT.alu));
      boss.position.z = r * 0.95;
      const reg = ekle(new THREE.Mesh(new THREE.BoxGeometry(r * 0.3, r * 0.3, r * 0.22), KIT.aluDark));
      reg.position.z = r * 1.2;
      g.add(D.tankSaddle(THREE, KIT, r));
      break;
    }
    case 'nozul': {
      /* Combustion chamber, throat, radiatively cooled bell, the injector
         head with its propellant inlets, and the thermal shield that stops
         the bell cooking the deck it is bolted to. The bell is DoubleSide
         because you can see into it. */
      const bogaz = ekle(new THREE.Mesh(cylGeoZ(sx * 0.22, sx * 0.3, sz * 0.4, 22), KIT.aluDark));
      bogaz.position.z = sz * 0.28;
      const canMat = mat.clone(); canMat.side = THREE.DoubleSide;
      /* A nozzle contour is not a straight cone: it expands fast after the
         throat and then turns over so the exhaust leaves nearly axial. The
         cone was throwing that away, and the turn-over is worth several
         per cent of thrust. */
      const rBogaz = sx * 0.22, rCikis = sx / 2, boyCan = sz * 0.7;
      const profil = [];
      for (let i = 0; i <= 14; i++) {
        const u = i / 14;
        profil.push(new THREE.Vector2(rBogaz + (rCikis - rBogaz) * Math.sqrt(u),
          sz * 0.25 - u * boyCan));
      }
      const can = latheZ(profil, 30, canMat);
      can.castShadow = true; can.receiveShadow = true;
      g.add(can);
      /* Stiffening hoops on the bell: a thin radiatively cooled skirt
         needs them or it flutters. */
      for (let i = 1; i <= 5; i++) {
        const u = i / 6;
        const rh = rBogaz + (rCikis - rBogaz) * Math.sqrt(u);
        const hoop = ekle(new THREE.Mesh(
          new THREE.TorusGeometry(rh * 1.02, sx * 0.012, 5, 26), KIT.aluDark));
        hoop.position.z = sz * 0.25 - u * boyCan;
      }
      /* Injector head and its two propellant inlets - fuel and oxidiser
         arrive separately and meet for the first time inside. */
      const kafa = ekle(new THREE.Mesh(cylGeoZ(sx * 0.32, sx * 0.32, sz * 0.18, 18), KIT.alu));
      kafa.position.z = sz * 0.5;
      for (const e of [-1, 1]) {
        const giris = ekle(new THREE.Mesh(cylGeoZ(sx * 0.07, sx * 0.07, sz * 0.26, 10), KIT.mliSilver));
        giris.position.set(e * sx * 0.24, 0, sz * 0.62);
        const valf = ekle(new THREE.Mesh(new THREE.BoxGeometry(sx * 0.16, sx * 0.16, sz * 0.14), KIT.aluDark));
        valf.position.set(e * sx * 0.24, 0, sz * 0.78);
      }
      /* Heat shield between the bell and the deck. */
      const kalkan = ekle(new THREE.Mesh(cylGeoZ(sx * 0.62, sx * 0.62, sz * 0.03, 22), KIT.mli));
      kalkan.position.z = sz * 0.42;
      break;
    }
    case 'panel': {
      /* Honeycomb, not cardboard: face sheets, a visible edge close-out and
         the insert grid equipment actually bolts into. Radiator panels get
         the OSR tile pattern instead of bare aluminium. */
      const radyator = p.sistem === 'isil' && /radyator/.test(p.id);
      const [w, h, t] = sy < sx && sy < sz ? [sx, sz, sy] : [sx, sy, sz];
      /* Inserts on the radiator too. The catalogue bolts the battery, the
         PCDU and the transponder onto radiator panels, and the panel was
         being drawn WITHOUT the insert grid those bolts go into - the
         drawing and the mounting tree disagreed. */
      const pan = D.honeycombPanel(THREE, KIT, w, h, Math.max(t, 0.02), {
        inserts: true,
        osrMap: radyator ? dokular.osr.clone() : null,
      });
      if (sy < sx && sy < sz) pan.rotation.x = Math.PI / 2;
      /* The rails this panel's declared interface is made of. Four panels
         say `kizak` - built on a bench, slid on, then locked - and not one
         rail was drawn anywhere, so the interface existed only in the
         text. Same defect the radiator inserts had. */
      if (p.arayuz === 'kizak') {
        for (const e of [-1, 1]) {
          const ray = D.slideRail(THREE, KIT, h * 0.92, { locks: 2, en: 0.05 });
          if (sy < sx && sy < sz) { ray.position.set(e * w * 0.44, -t * 0.7, 0); ray.rotation.x = Math.PI / 2; }
          else ray.position.set(e * w * 0.44, 0, -t * 0.7);
          g.add(ray);
        }
      }
      pan.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      g.add(pan);
      if (radyator) {
        const yatay = sy < sx && sy < sz;
        const koy = (m, a, b) => { m.position.set(0, yatay ? t * 0.6 : a, yatay ? a : t * 0.6); void b; };
        /* Two headers along the edges and the transport pipes between them.
           Two headers alone cannot move heat ACROSS a panel; the runs are
           what actually carry it from the box footprint to the radiating
           area, and on real hardware they are the visible feature. */
        for (const e of [-1, 1]) {
          const hdr = ekle(new THREE.Mesh(cylGeoX(0.016, 0.016, w * 0.96, 10), KIT.aluDark));
          koy(hdr, e * h * 0.42);
        }
        for (let i = 0; i < 6; i++) {
          const x = (i / 5 - 0.5) * w * 0.86;
          const boru = ekle(new THREE.Mesh(
            yatay ? cylGeoZ(0.009, 0.009, h * 0.84, 8) : cylGeoY(0.009, 0.009, h * 0.84, 8),
            KIT.mliSilver));
          boru.position.set(x, yatay ? t * 0.55 : 0, yatay ? 0 : t * 0.55);
        }
        /* Doubler plates under the equipment footprints: the panel is
           thickened where a box bolts on, because the insert alone would
           punch through a 25 mm core. */
        for (const [dx, dy] of [[-w * 0.22, h * 0.18], [w * 0.24, -h * 0.2]]) {
          const dbl = ekle(new THREE.Mesh(
            new THREE.BoxGeometry(w * 0.3, yatay ? t * 0.5 : h * 0.26, yatay ? h * 0.26 : t * 0.5),
            KIT.alu));
          dbl.position.set(dx, yatay ? -t * 0.5 : dy, yatay ? dy : -t * 0.5);
        }
      }
      break;
    }
    case 'jiroskop': {
      /* An IMU drawn as a box is a box. The gyros are the instrument. */
      g.add(D.gyroBlock(THREE, KIT, sx, sy, sz, { cube: true, connectors: 2 }));
      break;
    }
    case 'kutu': {
      /* Which machine this box IS. Power, battery and RF boxes were
         rendering identically because nothing said they were different. */
      const kutuTipi = /batarya/.test(p.id) ? 'batarya'
        : (p.sistem === 'guc' || /ppu|pcdu/.test(p.id)) ? 'guc'
          : (p.sistem === 'haberlesme' || /transponder/.test(p.id)) ? 'rf' : 'genel';
      /* Chassis, machined lid, standoff feet, a keyed connector bank and
         the part number painted on the face. Fins only where the unit has
         to reject its own heat locally. */
      const kutu = D.equipmentBox(THREE, KIT, sx, sy, sz, {
        connectors: konnektorSayisi(p),
        decal: p.tech?.no ? dokular.decal(p.tech.no) : null,
        fins: (p.tech?.guc_W ?? 0) >= 200,
        tip: kutuTipi,
      });
      kutu.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      g.add(kutu);
      break;
    }
    case 'tekerlek': {
      /* The whole assembly, from the kit: rim-weighted rotor on a light
         web, a preloaded bearing pair, the brushless stator that drives
         it, a hall sensor, the launch lock that stops it brinelling its
         own races on the pad, and isolator feet. The sketch this replaced
         was a housing, a rim and three feet - nothing in it explained why
         a reaction wheel is hard. */
      g.add(D.reactionWheel(THREE, KIT, sx / 2, sz, {
        isolators: 3, bolts: 8, launchLock: true, cutaway: true,
      }));
      /* Pyramid bracket. Four wheels on a pyramid is the layout the
         catalogue declares, and it is the reason one can fail. */
      const brk = ekle(new THREE.Mesh(
        new THREE.BoxGeometry(sx * 0.9, sy * 0.9, sz * 0.12), KIT.alu));
      brk.position.z = -sz * 0.9;
      brk.rotation.z = Math.PI / 4;
      break;
    }
    case 'bafil': {
      /* Optics head on an isostatic three-point mount, behind a stepped
         baffle whose internal vanes each kill one stray-light path. */
      /* The optics head is a machined housing, not a plain block: a lid
         with its fastener line, a shoulder, and the connector. It was one
         coloured box and it read as one. */
      const head = ekle(new THREE.Mesh(new THREE.BoxGeometry(sx * .8, sy * .8, sz * .44), mat));
      head.position.z = -sz * 0.04;
      const basKapak = ekle(new THREE.Mesh(
        new THREE.BoxGeometry(sx * 0.72, sy * 0.72, sz * 0.06), KIT.metal));
      basKapak.position.z = -sz * 0.28;
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        const v = ekle(new THREE.Mesh(cylGeoZ(sx * 0.018, sx * 0.018, sz * 0.03, 6), KIT.koyuMetal));
        v.position.set(Math.cos(a) * sx * 0.3, Math.sin(a) * sy * 0.3, -sz * 0.31);
      }
      const omuz = ekle(new THREE.Mesh(
        new THREE.BoxGeometry(sx * 0.84, sy * 0.84, sz * 0.04), KIT.aluDark));
      omuz.position.z = sz * 0.17;
      const baf = D.baffle(THREE, KIT, sx * 0.5, sz * 0.62);
      baf.position.z = sz * 0.5;
      g.add(baf);
      /* Isostatic three-point mount, built from the two endpoints. The
         legs used to be aimed with rotation.set(sin, -cos, 0), which
         composes Z first and therefore points at nothing in particular;
         they now actually run from the optics housing down to their
         footprints on the panel. */
      const ucNokta = new THREE.Vector3(0, 0, -sz * 0.18);
      for (let i = 0; i < 3; i++) {
        const a = i * 2 * Math.PI / 3 + 0.4;
        const ayakUcu = new THREE.Vector3(Math.cos(a) * sx * 0.52, Math.sin(a) * sy * 0.52, -sz * 0.62);
        const boy = ucNokta.distanceTo(ayakUcu);
        const bipod = ekle(new THREE.Mesh(cylGeoZ(sx * 0.035, sx * 0.035, boy, 8), KIT.alu));
        bipod.position.copy(ucNokta).add(ayakUcu).multiplyScalar(0.5);
        bipod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1),
          ayakUcu.clone().sub(ucNokta).normalize());
        /* Rod ends, not bare sticks: a kinematic leg carries load through a
           spherical joint at each end, and the pads bolt down. */
        for (const uc of [ucNokta, ayakUcu]) {
          const kure = ekle(new THREE.Mesh(
            new THREE.SphereGeometry(sx * 0.052, 12, 8), KIT.koyuMetal));
          kure.position.copy(uc);
        }
        const pabuc = ekle(new THREE.Mesh(
          new THREE.BoxGeometry(sx * 0.2, sy * 0.2, sz * 0.05), KIT.aluDark));
        pabuc.position.copy(ayakUcu);
        pabuc.position.z -= sz * 0.03;
        const civata = ekle(new THREE.Mesh(
          cylGeoZ(sx * 0.022, sx * 0.022, sz * 0.03, 6), KIT.gold));
        civata.position.copy(ayakUcu);
        civata.position.z -= sz * 0.055;
      }
      /* The detector needs to be cold and the baffle needs to be warm, so
         there is a strap to one and a heater on the other. Both are on
         every real star tracker and neither was drawn. */
      const serit = ekle(new THREE.Mesh(
        new THREE.BoxGeometry(sx * 0.1, sy * 0.5, sz * 0.02), KIT.bakir));
      serit.position.set(-sx * 0.3, 0, -sz * 0.22);
      /* Heater band at the baffle ROOT, thin and dark: on the lip it read
         as a bright toy ring, and a heater does not live at the aperture. */
      const isitici = ekle(new THREE.Mesh(
        new THREE.TorusGeometry(sx * 0.44, sx * 0.012, 5, 22), KIT.bakir));
      isitici.position.z = sz * 0.3;
      const kon = ekle(new THREE.Mesh(cylGeoX(sx * 0.07, sx * 0.06, sx * 0.14, 10), KIT.connector));
      kon.position.set(sx * 0.44, 0, -sz * 0.2);
      void head;
      break;
    }
    case 'cubuk': {
      /* A magnetorquer is a coil, and it reads as one: the winding pack is
         visible between two end caps, on saddle clamps, with its lead out
         of one end. */
      const r = sx / 2;
      const core = ekle(new THREE.Mesh(cylGeoZ(r * 0.55, r * 0.55, sz, 14), KIT.aluDark));
      const coil = ekle(new THREE.Mesh(cylGeoZ(r, r, sz * 0.74, 18), KIT.connector));
      for (let i = 0; i < 14; i++) {
        const turn = ekle(new THREE.Mesh(new THREE.TorusGeometry(r * 1.01, r * 0.035, 4, 14), KIT.connector));
        turn.position.z = ((i + 0.5) / 14 - 0.5) * sz * 0.74;
      }
      for (const e of [-1, 1]) {
        const cap = ekle(new THREE.Mesh(cylGeoZ(r * 0.8, r * 0.8, sz * 0.09, 14), KIT.alu));
        cap.position.z = e * sz * 0.45;
      }
      for (const e of [-1, 1]) {
        const clamp = ekle(new THREE.Mesh(new THREE.TorusGeometry(r * 1.1, r * 0.09, 6, 16), KIT.alu));
        clamp.position.z = e * sz * 0.26;
      }
      const lead = ekle(new THREE.Mesh(cylGeoZ(r * 0.12, r * 0.12, sz * 0.2, 8), KIT.black));
      lead.position.z = -sz * 0.58;
      void core; void coil;
      break;
    }
    case 'boru': {
      /* Two completely different things were sharing one drawing: titanium
         propellant tubing that is welded, valved and trace-heated, and
         grooved aluminium heat pipes that are embedded in a panel and have
         no valves at all. They now look like what they are. */
      const isiBorusu = p.sistem === 'isil';
      const hat = cikarHatSayisi(p, isiBorusu ? 8 : 2);
      const yayil = (i) => (hat === 1 ? 0 : (i / (hat - 1) - 0.5)) * sy * 0.62;

      if (isiBorusu) {
        for (let i = 0; i < hat; i++) {
          const y = yayil(i);
          /* Grooved, so flattened: a heat pipe is bonded into the panel
             face, not hung off it, and a round rod could not be. */
          const hp = ekle(new THREE.Mesh(cylGeoX(0.011, 0.011, sx * 0.94, 10), KIT.alu));
          hp.position.set(0, y, 0);
          hp.scale.z = 0.55;
          /* Saddle bond at each end: where the heat goes in and out. */
          for (const e of [-1, 1]) {
            const eyer = ekle(new THREE.Mesh(
              new THREE.BoxGeometry(sx * 0.07, 0.03, 0.016), KIT.aluDark));
            eyer.position.set(e * sx * 0.44, y, 0);
          }
        }
        /* The two manifolds the runs terminate into. */
        for (const e of [-1, 1]) {
          const man = ekle(new THREE.Mesh(cylGeoY(0.015, 0.015, sy * 0.72, 10), KIT.koyuMetal));
          man.position.set(e * sx * 0.47, 0, 0);
        }
        break;
      }

      for (let i = 0; i < hat; i++) {
        const y = yayil(i);
        const m = ekle(new THREE.Mesh(cylGeoX(0.016, 0.016, sx * .9, 12), KIT.mliSilver));
        m.position.set(0, y, 0);
        for (let j = 0; j < 4; j++) {
          const cl = ekle(new THREE.Mesh(new THREE.TorusGeometry(0.023, 0.006, 5, 12), KIT.alu));
          cl.position.set((j / 3 - 0.5) * sx * 0.8, y, 0);
          cl.rotation.y = Math.PI / 2;
        }
        const valf = ekle(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.034), KIT.aluDark));
        valf.position.set(sx * 0.3, y, 0);
        /* Filter upstream of the valve: one particle is enough to hold a
           thruster seat open, and that ends the mission slowly. */
        const filtre = ekle(new THREE.Mesh(cylGeoX(0.021, 0.021, 0.05, 10), KIT.metal));
        filtre.position.set(sx * 0.12, y, 0);
        /* Trace heaters. The row declares 24 W of them because MMH freezes
           at -52 C; nothing was drawn. */
        for (let j = 0; j < 3; j++) {
          const is = ekle(new THREE.Mesh(new THREE.TorusGeometry(0.019, 0.004, 4, 12), KIT.ikaz));
          is.position.set((j / 2 - 0.5) * sx * 0.5, y, 0);
          is.rotation.y = Math.PI / 2;
        }
        /* Orbital weld beads: the row says every one is radiographed. */
        for (const e of [-1, 1]) {
          const kaynak = ekle(new THREE.Mesh(new THREE.TorusGeometry(0.0175, 0.0035, 4, 12), KIT.white));
          kaynak.position.set(e * sx * 0.4, y, 0);
          kaynak.rotation.y = Math.PI / 2;
        }
        /* Expansion loop: the run cannot be straight across a 100 K swing. */
        const loop = ekle(new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.016, 6, 18, Math.PI * 1.4), KIT.mliSilver));
        loop.position.set(-sx * 0.25, y, 0.03);
        loop.rotation.set(0, Math.PI / 2, 0);
      }
      break;
    }
    case 'kanat': {
      /* The wing TRACKS, and it was drawn not tracking. Measured on the built
         scene, the cell face normal was (0, 0, 1) while the Sun sits at
         (5, 6, 7): 48.03 deg apart, cosine 0.667. The row above computes
         338 W/m2 x 7.65 m2 = 2585 W at NORMAL incidence, so the drawing was
         throwing away 547 W a wing - and the drive bolted right underneath it
         says what it is for in as many words: "lets the wing track the Sun
         while the body points at the target".
         A SADA has ONE axis. It can swing the normal onto the projection of
         the Sun into the plane square to its shaft and no further; the 28.5
         deg that remains is beta-angle loss, and drawing it away would make
         the power budget a lie. So the shaft goes to the single-axis optimum
         and the wing collects 0.879, not 1.000 and not 0.667. */
      const surucu = sadaAcisi(GUNES_YONU);
      g.rotation.x = surucu.aci;
      g.userData.sada = surucu;

      const tex = dokular.hucreKit.clone();
      tex.needsUpdate = true;
      tex.repeat.set(2.6, 2.2);
      const on = new THREE.MeshStandardMaterial({ map: tex, roughness: .32, metalness: .42 });
      /* The back is what you see from most angles and it was a flat fill.
         A substrate is a woven facesheet with the string harness taped down
         it, and those two things are the whole read. */
      const arkaDoku = dokular.cfrp.clone();
      arkaDoku.needsUpdate = true;
      arkaDoku.repeat.set(5, 2.4);
      const arka = new THREE.MeshStandardMaterial({
        map: arkaDoku, color: 0x9aa1ab, roughness: .82, metalness: .16 });
      const w = sx / 3;
      for (let i = 0; i < 3; i++) {
        /* Front face carries the cells, the rest is the CFRP substrate. */
        const yuz = [arka, arka, arka, arka, on, arka];
        const m = ekle(new THREE.Mesh(new THREE.BoxGeometry(w * .97, sy, sz), yuz));
        m.position.x = (i - 1) * w;
        /* Substrate frame: the panel edge is a stiffener, not a raw cut. */
        for (const e of [-1, 1]) {
          const kenar = ekle(new THREE.Mesh(new THREE.BoxGeometry(w * .97, sy * 0.06, sz * 1.5), KIT.aluDark));
          kenar.position.set((i - 1) * w, e * sy * 0.47, 0);
        }
        for (const e of [-1, 1]) {
          const dikme = ekle(new THREE.Mesh(new THREE.BoxGeometry(w * 0.022, sy * 0.94, sz * 1.5), KIT.aluDark));
          dikme.position.set((i - 1) * w + e * w * 0.475, 0, 0);
        }
        /* Cell STRINGS. A wing is wired in series strings and the gap between
           them is visible on the lit face; each string ends in a blocking
           diode, which is what stops one shadowed string draining the rest. */
        for (let j = 1; j < 4; j++) {
          const ayrim = ekle(new THREE.Mesh(
            new THREE.BoxGeometry(w * 0.94, sy * 0.014, sz * 0.25), KIT.aluDark));
          ayrim.position.set((i - 1) * w, (j / 4 - 0.5) * sy * 0.92, sz * 0.56);
        }
        for (let j = 0; j < 4; j++) {
          const diyot = ekle(new THREE.Mesh(
            new THREE.BoxGeometry(w * 0.04, sy * 0.05, sz * 0.5), KIT.gold));
          diyot.position.set((i - 1) * w - w * 0.44, (j / 4 - 0.375) * sy * 0.92, -sz * 0.6);
        }
        /* String harness on the BACK, clipped down every so often. Taped runs
           are the thing you actually see on the back of a real wing. */
        for (let j = 0; j < 2; j++) {
          const hat = ekle(new THREE.Mesh(
            cylGeoX(sz * 0.16, sz * 0.16, w * 0.9, 8), KIT.bakir));
          hat.position.set((i - 1) * w, (j - 0.5) * sy * 0.46, -sz * 0.74);
          for (let c2 = 0; c2 < 3; c2++) {
            const kelepce = ekle(new THREE.Mesh(
              new THREE.BoxGeometry(sz * 0.14, sz * 0.5, sz * 0.5), KIT.mliSilver));
            kelepce.position.set((i - 1) * w + (c2 - 1) * w * 0.3,
              (j - 0.5) * sy * 0.46, -sz * 0.74);
          }
        }
        /* Corner brackets: four per panel, where the frame members meet. */
        for (const ex of [-1, 1]) for (const ey of [-1, 1]) {
          const kose = ekle(new THREE.Mesh(
            new THREE.BoxGeometry(w * 0.07, sy * 0.07, sz * 1.6), KIT.alu));
          kose.position.set((i - 1) * w + ex * w * 0.44, ey * sy * 0.44, 0);
        }
        if (i < 2) {
          /* Hinges live on BOTH faces of the joint - one line of knuckles is
             a drawing, two is a hinge that could carry the panel. */
          for (const ez of [1, -1]) {
            const men = D.hingeLatch(THREE, KIT, 0.7);
            men.position.set((i - 0.5) * w, 0, ez * sz * 0.9);
            if (ez < 0) men.rotation.y = Math.PI;
            g.add(men);
          }
          for (const ey of [-1, 1]) {
            const yay = ekle(new THREE.Mesh(
              cylGeoX(sz * 0.5, sz * 0.5, w * 0.1, 10), KIT.aluDark));
            yay.position.set((i - 0.5) * w, ey * sy * 0.36, sz * 0.9);
          }
        }
        /* Tie-down cups: where the stack is clamped for launch and where the
           pyro cutter releases it. The row says "redundant pyro release" and
           there was nothing on the wing to release. */
        for (const ey of [-1, 1]) {
          const kup = ekle(new THREE.Mesh(
            cylGeoZ(sz * 0.9, sz * 1.2, sz * 1.1, 12), KIT.aluDark));
          kup.position.set((i - 1) * w + w * 0.3, ey * sy * 0.38, -sz * 1.1);
          const pim = ekle(new THREE.Mesh(
            cylGeoZ(sz * 0.3, sz * 0.3, sz * 2.2, 8), KIT.gold));
          pim.position.set((i - 1) * w + w * 0.3, ey * sy * 0.38, -sz * 1.1);
        }
      }
      const boyunduruk = ekle(new THREE.Mesh(cylGeoX(0.03, 0.03, sx * 0.14, 10), KIT.alu));
      boyunduruk.position.x = -sx / 2 - sx * 0.07;
      /* Yoke fork: two arms off the shaft, not a single stick. */
      for (const ey of [-1, 1]) {
        const kol = ekle(new THREE.Mesh(
          new THREE.BoxGeometry(sx * 0.1, sy * 0.05, sz * 1.6), KIT.alu));
        kol.position.set(-sx / 2 - sx * 0.02, ey * sy * 0.22, 0);
      }
      /* Harness down the back of the wing to the drive. */
      const kablo = D.harnessRun(THREE, KIT, sx * 0.92, { r: 0.012, axis: 'x' });
      kablo.position.set(0, -sy * 0.42, -sz * 1.6);
      g.add(kablo);
      break;
    }
    case 'canak': {
      /* An antenna is drawn POINTED. This one was built along +Z while the
         body frame puts nadir at -Z: measured 180.0 deg from the ground
         station, for the dish whose row says a 1.6 deg beam "has to be
         pointed". The pointing comes from the catalogue so the drawing and
         the spec cannot drift apart. */
      if (p.nis) {
        const yon = boresightYonu(p.nis);
        g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1),
          new THREE.Vector3(yon[0], yon[1], yon[2]));
        g.userData.boresight = yon;
      }
      /* f/D was 0.1375. A reflector that deep is not a spacecraft antenna, it
         is a wok: the rim curled 0.45 x its own diameter forward and the feed
         sat at sz * 0.62, which is nowhere near the focus. Spacecraft HGAs run
         f/D around 0.35, and the feed goes AT the focus because that is the
         one place a paraboloid brings the wavefront to. */
      const cap = sx, fD = 0.35, odak = fD * cap;
      const R = cap / 2;
      const derinlik = (R * R) / (4 * odak);     // sagitta at the rim
      const pts = [];
      for (let i = 0; i <= 16; i++) {
        const u = i / 16, r = R * u;
        pts.push(new THREE.Vector2(r, (r * r) / (4 * odak)));
      }
      /* Çanak: eksen yardımcısıyla (+Z) — çıplak LatheGeometry eksen
         ratchet'ine takılır ve lathe normalleri profil sırasına duyarlıdır. */
      const canakMat = mat.clone(); canakMat.side = THREE.DoubleSide;
      const m = ekle(latheZ(pts, 40, canakMat));
      /* Rim stiffener, radial ribs on the back, a subreflector on three
         struts, and the waveguide that actually feeds it. A bare paraboloid
         with a stick in the middle says none of that. */
      const kenar = ekle(new THREE.Mesh(new THREE.TorusGeometry(R * 0.995, R * 0.03, 6, 44), KIT.alu));
      kenar.position.z = derinlik;
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        const kaburga = ekle(new THREE.Mesh(new THREE.BoxGeometry(R * 0.92, R * 0.03, R * 0.05), KIT.aluDark));
        kaburga.position.set(Math.cos(a) * R * 0.48, Math.sin(a) * R * 0.48, -R * 0.06);
        kaburga.rotation.z = a;
      }
      /* Cassegrain: the sub-reflector sits just short of the prime focus and
         the feed horn looks up at it through the vertex. */
      const altZ = odak * 0.86;
      const besleme = ekle(new THREE.Mesh(cylGeoZ(R * 0.05, R * 0.09, odak * 0.34, 14), KIT.gold));
      besleme.position.z = odak * 0.17;
      const alt = ekle(new THREE.Mesh(cylGeoZ(R * 0.19, R * 0.07, odak * 0.16, 20), KIT.alu));
      alt.position.z = altZ;
      for (let i = 0; i < 3; i++) {
        const a = i * 2 * Math.PI / 3;
        const p0 = new THREE.Vector3(Math.cos(a) * R * 0.78, Math.sin(a) * R * 0.78,
          (R * 0.78) * (R * 0.78) / (4 * odak));
        const p1 = new THREE.Vector3(0, 0, altZ - odak * 0.09);
        const boy = p0.distanceTo(p1);
        const ayak = ekle(new THREE.Mesh(cylGeoZ(0.014, 0.014, boy, 8), KIT.aluDark));
        ayak.position.copy(p0).add(p1).multiplyScalar(0.5);
        /* Struts converge on the sub-reflector. Composing this from two Euler
           terms only works for small angles and these are not small. */
        ayak.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1),
          p1.clone().sub(p0).normalize());
      }
      const dalga = D.waveguide(THREE, KIT, R * 0.7, { w: 0.04, h: 0.02, axis: 'z' });
      dalga.position.set(R * 0.2, 0, -R * 0.25);
      g.add(dalga);
      void m;
      break;
    }
    case 'kabuk': {
      /* The blanket that closes the bus out. It stays translucent so the
         equipment underneath is still readable, but it now carries the
         quilt, the tape seams and the vent scallops that let trapped air
         out during ascent - without vents a sealed blanket balloons. */
      const kumas = dokular.mli.clone();
      kumas.needsUpdate = true;
      kumas.repeat.set(3, 3);
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz),
        new THREE.MeshStandardMaterial({
          map: kumas, color: 0xffffff, roughness: .72, metalness: .3,
          transparent: true, opacity: .34, side: THREE.DoubleSide,
        }));
      g.add(m);
      /* Tape seams along the box edges. */
      for (const [ax, w, h, d2, pos] of [
        ['x', sx, sy * 0.02, sz * 0.02, [0, sy / 2, sz / 2]],
        ['x', sx, sy * 0.02, sz * 0.02, [0, -sy / 2, sz / 2]],
        ['x', sx, sy * 0.02, sz * 0.02, [0, sy / 2, -sz / 2]],
        ['x', sx, sy * 0.02, sz * 0.02, [0, -sy / 2, -sz / 2]],
      ]) {
        const tape = ekle(new THREE.Mesh(new THREE.BoxGeometry(w, h, d2), KIT.mliSilver));
        tape.position.set(pos[0], pos[1], pos[2]);
        void ax;
      }
      /* Grounding tab at every seam. The row says so - an ungrounded
         blanket charges up and discharges into whatever it is lying on,
         which is how a spacecraft kills its own electronics - and not one
         was drawn. */
      for (const ex of [-1, 1]) for (const ey of [-1, 1]) for (const ez of [-1, 1]) {
        const tirnak = ekle(new THREE.Mesh(
          new THREE.BoxGeometry(sx * 0.05, sy * 0.05, sz * 0.012), KIT.bakir));
        tirnak.position.set(ex * sx * 0.42, ey * sy * 0.42, ez * sz * 0.5);
      }
      /* Vent scallops, four to a face. */
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + Math.PI / 4;
        const vent = ekle(new THREE.Mesh(new THREE.TorusGeometry(sx * 0.035, sx * 0.01, 5, 12), KIT.mliSilver));
        vent.position.set(Math.cos(a) * sx * 0.36, Math.sin(a) * sy * 0.36, sz / 2);
      }
      break;
    }
    case 'gizli': {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat.clone());
      m.material.transparent = true; m.material.opacity = .22; m.material.depthWrite = false;
      g.add(m);
      break;
    }
    /* Anything the satellite has no special case for goes to the shared
       shape grammar (core/hardware-shapes.mjs), so a new catalogue row can
       declare `sekil` + `detay` and need NO code here. This used to fall
       back to a plain box, which is how "some sections are still basic"
       became possible in the first place. */
    default: {
      if (!knowsKind(p.sekil)) {
        throw new Error(`sat-build: '${p.sekil}' is neither a satellite case `
          + `nor a grammar kind (part ${p.id}). Declare it in hardware-shapes.mjs.`);
      }
      const { group } = buildShape(THREE, p, { kit: KIT, lod: dokular.lod || 'shop' });
      g.add(group);
    }
  }
  return g;
}

/**
 * Bütün uyduyu kurar.
 * Dönen `parcalar`: { id, part, group, taban, yon, derinlik } — patlatma ve
 * entegrasyon sırası bu listeden sürülür.
 */
export function buildSatellite(THREE, { tokens = {}, scale = 1, lod = 'shop' } = {}) {
  const mats = renkler(THREE, tokens);
  /* Detail-kit materials and textures are built ONCE and shared. A fresh
     material per greeble would multiply draw calls for no visual gain. */
  const kit = D.detailMaterials(THREE, tokens);
  const dokular = {
    hucre: hucreDokusu(THREE),
    hucreKit: D.cellTexture(THREE),
    cfrp: D.cfrpTexture(THREE),
    mli: D.mliTexture(THREE),
    osr: D.osrTexture(THREE),
    kit,
    /* Level of detail for grammar-built parts: block | shop | flight. */
    lod,
    /* Part-number decals are cached: 33 parts, but only the boxes ask. */
    __decal: new Map(),
    decal(no) {
      if (!this.__decal.has(no)) this.__decal.set(no, D.decalTexture(THREE, [no]));
      return this.__decal.get(no);
    },
  };
  const kok = new THREE.Group();
  const parcalar = [];

  for (const p of PARTS) {
    const mat = mats[p.sistem];
    const yerler = [];
    const n = p.qty ?? 1;
    if (n === 1) yerler.push(p.pos);
    else {
      /* Çoklu parçalar simetrik dizilir: köşeler (4), zıt yönler (2),
         üç eksen (3). Konum kataloğdaki ÖRNEK konumun yansımalarıdır. */
      const [x, y, z] = p.pos;
      if (n === 4) for (const sx of [1, -1]) for (const sy of [1, -1]) yerler.push([sx * Math.abs(x), sy * Math.abs(y), z]);
      else if (n === 2) for (const sx of [1, -1]) yerler.push([sx * Math.abs(x), y, z]);
      else if (n === 3) for (let i = 0; i < 3; i++) yerler.push([x, y + (i - 1) * 0.42, z]);
      else for (let i = 0; i < n; i++) yerler.push([x, y, z]);
    }

    yerler.forEach((yer, i) => {
      const g = govde(THREE, p, mat, dokular);
      g.position.set(yer[0] * scale, yer[1] * scale, yer[2] * scale);
      g.scale.setScalar(scale);
      g.userData.part = p;
      g.userData.kopya = i;
      kok.add(g);

      /* PATLATMA YÖNÜ montajın tersidir: parça, bağlandığı yüzeyden
         DIŞARI çıkar. Yön, parçanın bağlandığı parçaya göre konumundan
         türetilir; eksene çok yakınsa fırlatma ekseni boyunca açılır. */
      const ust = p.mountsTo ? partById(p.mountsTo) : null;
      const yon = new THREE.Vector3(
        yer[0] - (ust ? ust.pos[0] : 0),
        yer[1] - (ust ? ust.pos[1] : 0),
        yer[2] - (ust ? ust.pos[2] : 0));
      if (yon.lengthSq() < 1e-4) yon.set(0, 0, p.step >= 5 ? 1 : -1);
      yon.normalize();
      parcalar.push({
        id: p.id + (n > 1 ? `#${i + 1}` : ''), part: p, group: g,
        taban: g.position.clone(), yon, derinlik: depth(p.id),
      });
    });
  }

  return {
    root: kok, parts: parcalar, materials: mats, textures: dokular,
    /** Patlatma: k = 0 montajlı, k = 1 tamamen ayrık. */
    explode(k, { mesafe = 1.15 } = {}) {
      for (const q of parcalar) {
        const d = 0.45 + q.derinlik * 0.42;            // derinde olan daha uzağa
        q.group.position.copy(q.taban).addScaledVector(q.yon, k * d * mesafe * scale);
      }
    },
    /** Entegrasyon adımı: adımdan sonrası gizli, o adım vurgulu. */
    showStep(step, { hepsi = false } = {}) {
      for (const q of parcalar) {
        const s = q.part.step;
        q.group.visible = hepsi || s <= step;
        q.group.traverse(o => { if (o.isMesh && o.material) o.material.needsUpdate = false; });
      }
    },
    dispose() {
      kok.traverse(o => { if (o.isMesh) { o.geometry?.dispose(); const mm = Array.isArray(o.material) ? o.material : [o.material]; for (const m of mm) m?.dispose?.(); } });
      for (const t of Object.values(dokular)) t.dispose?.();
    },
  };
}

export { SUBSYSTEMS };
