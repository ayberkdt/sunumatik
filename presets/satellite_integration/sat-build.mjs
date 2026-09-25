/* sat-build.mjs — parça kataloğunu GÖVDEYE çevirir.
 *
 * Her parça kendi satırındaki `sekil`, `size` ve `pos` ile kurulur; burada
 * tek bir ölçü elle yazılmaz. Böylece kataloğu değiştirmek modeli de
 * değiştirir ve kütle bütçesiyle çizim asla ayrışmaz.
 *
 * Eksen sözleşmesi: çıplak CylinderGeometry/ConeGeometry kullanılmaz,
 * `core/geometry-axis.mjs` yardımcıları kullanılır (eksen ratchet'i sınar).
 */

import { PARTS, SUBSYSTEMS, partById, depth } from './sat-parts.mjs';
import { cylGeoY, cylGeoX, cylGeoZ, coneGeoZ, latheZ } from '../core/geometry-axis.mjs';
import * as D from './sat-detail.mjs';
import { buildShape, knowsKind } from '../core/hardware-shapes.mjs';

const renkler = (THREE, tk = {}) => ({
  yapi: new THREE.MeshStandardMaterial({ color: tk.yapi ?? 0x9aa0aa, roughness: .55, metalness: .65 }),
  itki: new THREE.MeshStandardMaterial({ color: tk.itki ?? 0xc98a5c, roughness: .5, metalness: .55 }),
  guc: new THREE.MeshStandardMaterial({ color: tk.guc ?? 0xe0b25a, roughness: .45, metalness: .35 }),
  adcs: new THREE.MeshStandardMaterial({ color: tk.adcs ?? 0x7fb0c9, roughness: .4, metalness: .5 }),
  haberlesme: new THREE.MeshStandardMaterial({ color: tk.haberlesme ?? 0xb4a8c9, roughness: .4, metalness: .5 }),
  isil: new THREE.MeshStandardMaterial({ color: tk.isil ?? 0x8fa2b4, roughness: .7, metalness: .3 }),
  faydali: new THREE.MeshStandardMaterial({ color: tk.faydali ?? 0x9ec98a, roughness: .35, metalness: .45 }),
  kablaj: new THREE.MeshStandardMaterial({ color: tk.kablaj ?? 0x6f7688, roughness: .8, metalness: .2,
    transparent: true, opacity: .34 }),
});

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
function cikarBoltSayisi(p, varsayilan) {
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
  'bafil', 'cubuk', 'boru', 'kanat', 'canak', 'kabuk', 'gizli',
]));

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
      const can = ekle(new THREE.Mesh(coneGeoZ(sx / 2, sz * 0.7, 28, true), canMat));
      can.rotation.x = Math.PI;
      can.position.z = -sz * 0.1;
      /* Stiffening hoops on the bell: a thin radiatively cooled skirt
         needs them or it flutters. */
      for (let i = 1; i <= 3; i++) {
        const t = i / 4;
        const hoop = ekle(new THREE.Mesh(
          new THREE.TorusGeometry((sx / 2) * t * 1.02, sx * 0.012, 5, 26), KIT.aluDark));
        hoop.position.z = -sz * 0.1 - (t - 0.5) * sz * 0.7;
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
      const pan = D.honeycombPanel(THREE, KIT, w, h, Math.max(t, 0.02), {
        inserts: !radyator,
        osrMap: radyator ? dokular.osr.clone() : null,
      });
      if (sy < sx && sy < sz) pan.rotation.x = Math.PI / 2;
      pan.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      g.add(pan);
      if (radyator) {
        /* Embedded heat-pipe headers: the reason the panel can move heat
           at all. They run along the long edge. */
        for (const e of [-1, 1]) {
          const hdr = ekle(new THREE.Mesh(cylGeoX(0.016, 0.016, w * 0.96, 10), KIT.aluDark));
          hdr.position.set(0, e * h * 0.42, t * 0.6);
          if (sy < sx && sy < sz) { hdr.position.set(0, t * 0.6, e * h * 0.42); }
        }
      }
      break;
    }
    case 'kutu': {
      /* Chassis, machined lid, standoff feet, a keyed connector bank and
         the part number painted on the face. Fins only where the unit has
         to reject its own heat locally. */
      const kutu = D.equipmentBox(THREE, KIT, sx, sy, sz, {
        connectors: konnektorSayisi(p),
        decal: p.tech?.no ? dokular.decal(p.tech.no) : null,
        fins: (p.tech?.guc_W ?? 0) >= 200,
      });
      kutu.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      g.add(kutu);
      break;
    }
    case 'tekerlek': {
      /* Housing, rim-weighted rotor, bearing hub, the isolator feet that
         keep wheel vibration out of the optics, and its connector. */
      const r = sx / 2;
      const m = ekle(new THREE.Mesh(cylGeoY(r, r, sz, 30), mat));
      m.rotation.x = Math.PI / 2;
      const rim = ekle(new THREE.Mesh(new THREE.TorusGeometry(r * 0.96, r * 0.07, 8, 30), KIT.aluDark));
      const hub = ekle(new THREE.Mesh(cylGeoZ(r * 0.16, r * 0.16, sz * 1.3, 16), KIT.alu));
      const kapak = ekle(new THREE.Mesh(cylGeoZ(r * 0.62, r * 0.62, sz * 0.18, 24), KIT.aluDark));
      kapak.position.z = sz * 0.5;
      for (let i = 0; i < 3; i++) {
        const a = i * 2 * Math.PI / 3;
        /* Vibration isolators, not rigid feet: a wheel bolted hard to the
           panel writes its own imbalance straight into the payload. */
        const iso = ekle(new THREE.Mesh(cylGeoZ(r * 0.09, r * 0.11, sz * 0.5, 10), KIT.black));
        iso.position.set(Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78, -sz * 0.6);
      }
      const kon = ekle(new THREE.Mesh(cylGeoX(r * 0.1, r * 0.09, r * 0.16, 10), KIT.connector));
      kon.position.set(r * 1.02, 0, 0);
      break;
    }
    case 'bafil': {
      /* Optics head on an isostatic three-point mount, behind a stepped
         baffle whose internal vanes each kill one stray-light path. */
      const head = ekle(new THREE.Mesh(new THREE.BoxGeometry(sx * .8, sy * .8, sz * .5), mat));
      const baf = D.baffle(THREE, KIT, sx * 0.5, sz * 0.62);
      baf.position.z = sz * 0.5;
      g.add(baf);
      for (let i = 0; i < 3; i++) {
        const a = i * 2 * Math.PI / 3 + 0.4;
        const bipod = ekle(new THREE.Mesh(cylGeoZ(sx * 0.035, sx * 0.035, sz * 0.4, 8), KIT.alu));
        bipod.position.set(Math.cos(a) * sx * 0.36, Math.sin(a) * sy * 0.36, -sz * 0.4);
        bipod.rotation.set(Math.sin(a) * 0.3, -Math.cos(a) * 0.3, 0);
      }
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
      /* Two welded runs with support clamps, an expansion loop and an
         isolation valve on each. Straight bare rods said none of that. */
      for (const e of [-1, 1]) {
        const m = ekle(new THREE.Mesh(cylGeoX(0.016, 0.016, sx * .9, 12), KIT.mliSilver));
        m.position.set(0, e * sy * 0.22, 0);
        for (let i = 0; i < 4; i++) {
          const cl = ekle(new THREE.Mesh(new THREE.TorusGeometry(0.023, 0.006, 5, 12), KIT.alu));
          cl.position.set((i / 3 - 0.5) * sx * 0.8, e * sy * 0.22, 0);
          cl.rotation.y = Math.PI / 2;
        }
        const valf = ekle(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.034), KIT.aluDark));
        valf.position.set(sx * 0.3, e * sy * 0.22, 0);
        /* Expansion loop: the run cannot be straight across a 100 K swing. */
        const loop = ekle(new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.016, 6, 18, Math.PI * 1.4), KIT.mliSilver));
        loop.position.set(-sx * 0.25, e * sy * 0.22, 0.03);
        loop.rotation.set(0, Math.PI / 2, 0);
      }
      break;
    }
    case 'kanat': {
      /* Three panels with the cell grid on the sunward face only - the back
         is substrate, and a wing lit identically on both sides reads as a
         sheet of blue card. Hinges between panels, a yoke to the drive. */
      const tex = dokular.hucreKit.clone();
      tex.needsUpdate = true;
      tex.repeat.set(2.6, 2.2);
      const on = new THREE.MeshStandardMaterial({ map: tex, roughness: .32, metalness: .42 });
      const arka = KIT.aluDark;
      const w = sx / 3;
      for (let i = 0; i < 3; i++) {
        /* Front face carries the cells, the rest is the CFRP substrate. */
        const yuz = [arka, arka, arka, arka, on, arka];
        const m = ekle(new THREE.Mesh(new THREE.BoxGeometry(w * .97, sy, sz), yuz));
        m.position.x = (i - 1) * w;
        /* Substrate frame: the panel edge is a stiffener, not a raw cut. */
        for (const e of [-1, 1]) {
          const kenar = ekle(new THREE.Mesh(new THREE.BoxGeometry(w * .97, sy * 0.06, sz * 1.5), arka));
          kenar.position.set((i - 1) * w, e * sy * 0.47, 0);
        }
        if (i < 2) {
          const men = D.hingeLatch(THREE, KIT, 0.7);
          men.position.set((i - 0.5) * w, 0, sz * 0.9);
          g.add(men);
        }
      }
      const boyunduruk = ekle(new THREE.Mesh(cylGeoX(0.03, 0.03, sx * 0.14, 10), KIT.alu));
      boyunduruk.position.x = -sx / 2 - sx * 0.07;
      /* Harness down the back of the wing to the drive. */
      const kablo = D.harnessRun(THREE, KIT, sx * 0.92, { r: 0.012, axis: 'x' });
      kablo.position.set(0, -sy * 0.42, -sz * 1.6);
      g.add(kablo);
      break;
    }
    case 'canak': {
      const pts = [];
      for (let i = 0; i <= 14; i++) {
        const u = i / 14, r = (sx / 2) * u;
        pts.push(new THREE.Vector2(r, (r * r) / (sx * 0.55)));
      }
      /* Çanak: eksen yardımcısıyla (+Z) — çıplak LatheGeometry eksen
         ratchet'ine takılır ve lathe normalleri profil sırasına duyarlıdır. */
      const canakMat = mat.clone(); canakMat.side = THREE.DoubleSide;
      const m = ekle(latheZ(pts, 40, canakMat));
      /* Rim stiffener, radial ribs on the back, a subreflector on three
         struts, and the waveguide that actually feeds it. A bare paraboloid
         with a stick in the middle says none of that. */
      const R = sx / 2;
      const kenar = ekle(new THREE.Mesh(new THREE.TorusGeometry(R * 0.995, R * 0.03, 6, 44), KIT.alu));
      kenar.position.z = (R * R) / (sx * 0.55);
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        const kaburga = ekle(new THREE.Mesh(new THREE.BoxGeometry(R * 0.92, R * 0.03, R * 0.05), KIT.aluDark));
        kaburga.position.set(Math.cos(a) * R * 0.48, Math.sin(a) * R * 0.48, -R * 0.06);
        kaburga.rotation.z = a;
      }
      const besleme = ekle(new THREE.Mesh(cylGeoZ(0.032, 0.026, sz * 0.5, 14), KIT.gold));
      besleme.position.z = sz * 0.62;
      const alt = ekle(new THREE.Mesh(cylGeoZ(R * 0.13, R * 0.06, sz * 0.14, 16), KIT.alu));
      alt.position.z = sz * 0.9;
      for (let i = 0; i < 3; i++) {
        const a = i * 2 * Math.PI / 3;
        const ayak = ekle(new THREE.Mesh(cylGeoZ(0.014, 0.014, sz * 0.95, 8), KIT.aluDark));
        ayak.position.set(Math.cos(a) * R * 0.42, Math.sin(a) * R * 0.42, sz * 0.5);
        ayak.rotation.set(Math.sin(a) * 0.42, -Math.cos(a) * 0.42, 0);
      }
      const dalga = D.waveguide(THREE, KIT, sz * 0.7, { w: 0.04, h: 0.02, axis: 'z' });
      dalga.position.set(R * 0.2, 0, -sz * 0.2);
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
