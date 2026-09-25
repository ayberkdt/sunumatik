/* exploded-view.mjs — applies an assembly graph TO THE SCENE.
 * docs/exploded-view-plan.md §4.4, §5, §6, §7.
 *
 * `core/assembly.mjs` holds the model and never touches three; this file
 * writes that model onto three objects. The split is deliberate: every
 * explosion decision stays verifiable without a screen, and this file
 * only applies what was already decided.
 *
 * Four things live here:
 *   1. EXPLOSION — the k transition is driven by critical damping (no
 *      overshoot, cadence independent; same closed form as life-signs).
 *   2. CALLOUT LABELS — selection is an INFORMATION rule (printing every
 *      label leaves none of them readable). Labels never sit on the body:
 *      they go to two gutters, are packed by their MEASURED height, and
 *      each one is tied to its part by a numbered balloon and a leader.
 *   3. SUBASSEMBLY FOCUS — explode one subtree alone; the rest dims out.
 *   4. SECTION — cut the body with a plane normal to a chosen axis.
 */

import * as MOTION from './exploded-motion.mjs';

const DEG = Math.PI / 180;

/** Critically damped approach: e(t) = e0(1+wt)e^(-wt). No overshoot. */
function approach(now, target, dt, omega = 6) {
  const e = now - target;
  if (Math.abs(e) < 1e-7) return target;
  return target + e * (1 + omega * dt) * Math.exp(-omega * dt);
}

/** Compact engineering mass: 1240 -> "1.24 t", 17 -> "17.0 kg", 0.42 -> "420 g". */
export function massText(kg, estimated = false) {
  if (!Number.isFinite(kg) || kg === 0) return estimated ? '~0 kg' : '0 kg';
  const pre = estimated ? '~' : '';
  if (kg >= 1000) return `${pre}${(kg / 1000).toFixed(kg >= 10000 ? 1 : 2)} t`;
  if (kg >= 1) return `${pre}${kg >= 100 ? Math.round(kg) : kg.toFixed(1)} kg`;
  return `${pre}${Math.round(kg * 1000)} g`;
}

/**
 * Binds an assembly to the scene.
 *
 * nodes: id -> THREE.Object3D (the part's own group; its position is the
 *        BASE pose that explosion offsets are added to)
 * opts.labelHost: DOM layer labels are drawn into (no layer -> no labels)
 */
/**
 * Subassembly focus: which parts stay lit when one is focused.
 *
 * The focused part, everything mounted ON it, and the chain it hangs from.
 * The chain is included deliberately - a sub-assembly shown with no context
 * is a part the reader cannot place on the object.
 *
 * Pure on purpose: the rule is the thing worth testing, and testing it
 * should not need a renderer.
 *
 * @returns Set of ids, or null when nothing is focused.
 */
export function focusSet(assembly, focusId) {
  if (!focusId || !assembly.byId?.(focusId)) return null;
  const lit = new Set(assembly.subtree(focusId).map(p => p.id));
  for (const p of assembly.chain(focusId)) lit.add(p.id);
  return lit;
}

export function createExplodedView(THREE, assembly, nodes, {
  labelHost = null, camera = null, renderer = null,
  labelRule = null, omega = 6, maxLabels = 12, inset = { top: 0, bottom: 0 },
  motion = {},
} = {}) {
  /* Motion settings. `spread: 0` and `aMaxDeg: 0` give the old lockstep,
     attitude-free behaviour, which is what the reduced-motion path uses. */
  const MO = {
    spread: motion.spread ?? MOTION.SPREAD,
    aMaxDeg: motion.aMaxDeg ?? MOTION.A_MAX_DEG,
    glint: motion.glint ?? 0.18,
    pulse: motion.pulse ?? 0.55,
  };

  const base = new Map();
  const baseQuat = new Map();
  for (const [id, n] of nodes) {
    if (!n) continue;
    base.set(id, n.position.clone());
    baseQuat.set(id, n.quaternion.clone());
  }

  /* The FULL offset is asked for once; each part then travels its own
     fraction of it. Scaling a single full offset (instead of calling
     explode(k) per frame) is what lets the per-part stagger exist at all,
     and it guarantees the k=1 pose is bit-identical to the un-staggered
     one - the assembly model stays the single source of WHERE. */
  let fullOffsets = null;
  let fullMode = null;
  const maxDepth = Math.max(1, ...assembly.parts.map(q => assembly.depth(q.id)));
  const motionOf = new Map();
  for (const q of assembly.parts) {
    const dir = assembly.direction(q.id)?.dir || [0, 0, 1];
    motionOf.set(q.id, { depth: assembly.depth(q.id), dir, part: q });
  }

  const scratchQ = new THREE.Quaternion();
  const scratchAxis = new THREE.Vector3();
  let clock = 0;

  /* Emissive is written through a LAZY per-mesh clone. Materials are
     shared between parts in every builder in this repo, so writing
     emissive straight onto them would light up unrelated parts - a bleed
     that is invisible until two parts happen to share one material. */
  function emissiveOf(node, colour, strength) {
    node.traverse(o => {
      if (!o.isMesh || !o.material || Array.isArray(o.material)) return;
      if (!o.userData.__xvMat) {
        o.userData.__xvMat = o.material.clone();
        o.userData.__xvBase = o.material;
        if (o.userData.__xvMat.emissive) o.userData.__xvEmissive = o.userData.__xvMat.emissive.clone();
      }
      const m = o.userData.__xvMat;
      if (!m.emissive) return;
      if (strength <= 0) { o.material = o.userData.__xvBase; return; }
      o.material = m;
      m.emissive.copy(o.userData.__xvEmissive).lerp(colour, 1);
      m.emissiveIntensity = strength;
    });
  }
  const GLOW = new THREE.Color(0xc9a35c);
  const SPEED = new THREE.Color(0x9fc4ef);
  const lit = new Set();

  const state = {
    k: 0, kTarget: 0, mode: 'assembly',
    step: null,              // null = show everything
    callout: null,           // subtree id to isolate
    selected: null,
    focus: null,
    hover: null,
    section: null,           // { axis:'x'|'y'|'z', at: m, side: 1|-1 }
  };

  const v = new THREE.Vector3();
  const labels = [];         // { el, num, name, spec }
  const leaders = [];        // one SVG group per label: line + dot + balloon
  /* Leaders live in one SVG layer: polylines there are cheap and stay
     crisp at any device pixel ratio, unlike canvas or DOM borders. */
  let svg = null;
  if (labelHost) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'xv-leaders');
    svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible';
    labelHost.appendChild(svg);
  }
  const leaderGroup = new THREE.Group();
  leaderGroup.name = 'exploded-leaders';

  /* -- section plane --------------------------------------------------- */
  const sectionPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
  function applySection() {
    if (!renderer) return;
    if (!state.section) { renderer.clippingPlanes = []; return; }
    const n = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }[state.section.axis] || [0, 0, 1];
    const side = state.section.side ?? -1;
    sectionPlane.normal.set(n[0] * side, n[1] * side, n[2] * side);
    sectionPlane.constant = state.section.at * (side > 0 ? -1 : 1);
    renderer.localClippingEnabled = true;
    renderer.clippingPlanes = [sectionPlane];
  }

  /* -- visibility ------------------------------------------------------ */
  function isVisible(p) {
    if (state.step !== null && (p.step ?? 1) > state.step) return false;
    if (state.callout) {
      const sub = new Set(assembly.subtree(state.callout).map(q => q.id));
      return sub.has(p.id);
    }
    return true;
  }
  /* The lit set is recomputed only when the focus changes, not per frame. */
  let odakKume = null;
  /* Dimmed by the step walk-through, or by being outside a focused
     subassembly. Dimmed rather than HIDDEN (which is what setCallout
     does): a part you cannot see teaches nothing about where the focused
     one sits. */
  const isDimmed = (p) => (state.step !== null && (p.step ?? 1) < state.step)
    || (odakKume ? !odakKume.has(p.id) : false);

  /* -- apply ----------------------------------------------------------- */
  function apply() {
    const source = state.callout ? assembly.subtree(state.callout) : assembly.parts;
    const set = new Set(source.map(p => p.id));
    if (fullMode !== state.mode) {
      fullOffsets = assembly.explode(1, { mode: state.mode });
      fullMode = state.mode;
    }
    for (const p of assembly.parts) {
      const n = nodes.get(p.id);
      if (!n) continue;
      const vis = isVisible(p) && (!state.callout || set.has(p.id));
      n.visible = vis;
      if (!vis) continue;
      const mo = motionOf.get(p.id);
      const m = MOTION.partMotion(state.k, { id: p.id, size: p.size, depth: mo.depth }, {
        maxDepth, gabari: assembly.gabari, spread: MO.spread,
        aMaxDeg: MO.aMaxDeg, dir: mo.dir,
      });
      const full = fullOffsets.get(p.id) || [0, 0, 0];
      const b = base.get(p.id);
      n.position.set(b.x + full[0] * m.progress,
        b.y + full[1] * m.progress,
        b.z + full[2] * m.progress);
      /* Separation attitude rides ON TOP of the declared pose as a
         quaternion. Never Euler: the order silently reinterprets which
         way "outward" means, which already cost a day in hab-build. */
      if (m.angle !== 0) {
        scratchAxis.set(m.axis[0], m.axis[1], m.axis[2]);
        scratchQ.setFromAxisAngle(scratchAxis, m.angle);
        n.quaternion.copy(baseQuat.get(p.id)).premultiply(scratchQ);
      } else if (!n.quaternion.equals(baseQuat.get(p.id))) {
        n.quaternion.copy(baseQuat.get(p.id));
      }
      /* Travel glint: brightness tracks the part's own speed, so it marks
         something real rather than running off a timer. Off at both ends
         where the speed is zero anyway. */
      const glint = MO.glint > 0 && p.id !== state.selected
        ? Math.min(1, m.speed / 2.2) * MO.glint : 0;
      if (glint > 0.002) { emissiveOf(n, SPEED, glint); lit.add(p.id); }
      else if (lit.has(p.id) && p.id !== state.selected) { emissiveOf(n, SPEED, 0); lit.delete(p.id); }
      const dim = isDimmed(p);
      n.traverse(o => {
        if (!o.isMesh || !o.material) return;
        const mm = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mm) {
          if (m.userData.__opacity === undefined) m.userData.__opacity = m.opacity ?? 1;
          const want = dim ? m.userData.__opacity * 0.22 : m.userData.__opacity;
          if (m.opacity !== want) { m.opacity = want; m.transparent = want < 1; }
        }
      });
    }
  }

  /* -- labels -----------------------------------------------------------
     Gutter width and label count are NOT fixed: on a narrow stage two
     128 px gutters ate two thirds of the width. Both fall out of the
     available box. */
  const gutterWidth = (w) => Math.max(92, Math.min(164, w * 0.26));
  /* A narrow stage cannot carry twelve two-line cards: at 364 px the
     gutters took both sides and names wrapped to four lines each. Below
     the threshold the layer switches to COMPACT - fewer labels, name
     only, no spec line - because a label that cannot be read is worse
     than no label. */
  const COMPACT_BELOW = 560;

  function pickLabels() {
    if (!labelHost) return [];
    if (labelRule) return assembly.parts.filter(p => nodes.get(p.id)?.visible && labelRule(p, state));
    /* Default rule. Printing every label leaves none of them readable, so
       this selects: the current step's parts in step mode, everything in
       a focused subassembly, otherwise the parts that carry the most of
       the object - by size or by mass. The selected part always wins. */
    const big = assembly.gabari * 0.09;
    return assembly.parts.filter(p => {
      const n = nodes.get(p.id);
      if (!n || !n.visible) return false;
      if (p.id === state.selected) return true;
      /* Inside a focus, the subassembly IS the subject: label all of it
         and nothing else, instead of ranking by size across the whole
         object and labelling parts the reader is not looking at. */
      if (odakKume) return odakKume.has(p.id);
      if (state.step !== null) return (p.step ?? 1) === state.step;
      if (state.callout) return true;
      const bySize = p.size ? Math.max(...p.size) >= big : false;
      const byMass = (p.massKg ?? 0) >= 12;
      return bySize || byMass;
    });
  }

  /** One label = a numbered balloon on the part + a card in the gutter. */
  function makeLabel() {
    const el = document.createElement('div');
    el.className = 'xv-label';
    const num = document.createElement('span');
    num.className = 'xv-label__num';
    const text = document.createElement('span');
    text.className = 'xv-label__text';
    const name = document.createElement('span');
    name.className = 'xv-label__name';
    const spec = document.createElement('span');
    spec.className = 'xv-label__spec';
    text.append(name, spec);
    el.append(num, text);
    labelHost.appendChild(el);
    return { el, num, name, spec };
  }

  function makeLeader() {
    const ns = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(ns, 'g');
    g.setAttribute('class', 'xv-leader');
    const line = document.createElementNS(ns, 'polyline');
    const dot = document.createElementNS(ns, 'circle');
    dot.setAttribute('r', '2.6');
    const ring = document.createElementNS(ns, 'circle');
    ring.setAttribute('r', '8.5');
    ring.setAttribute('class', 'xv-leader__balloon');
    const tag = document.createElementNS(ns, 'text');
    tag.setAttribute('class', 'xv-leader__tag');
    tag.setAttribute('text-anchor', 'middle');
    tag.setAttribute('dy', '3.4');
    g.append(line, dot, ring, tag);
    svg.appendChild(g);
    return { g, line, dot, ring, tag };
  }

  function drawLabels() {
    if (!labelHost || !camera || !svg) return;
    if (state.k < 0.16) {
      for (const l of labels) l.el.style.display = 'none';
      svg.style.display = 'none';
      return;
    }
    svg.style.display = '';

    const box = labelHost.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    const GUTTER = gutterWidth(box.width);
    const compact = box.width < COMPACT_BELOW;
    /* Usable band: the host may sit under a caption or a toolbar, and a
       label packed into that band would be unreadable. */
    const yTop = (inset.top ?? 0) + 10;
    const yBottom = box.height - (inset.bottom ?? 0) - 10;

    /* 1) Project candidates to screen. */
    const cand = [];
    for (const p of pickLabels()) {
      const n = nodes.get(p.id);
      n.getWorldPosition(v).project(camera);
      if (v.z >= 1) continue;
      const x = (v.x * .5 + .5) * box.width, y = (-v.y * .5 + .5) * box.height;
      if (x < -40 || x > box.width + 40 || y < -40 || y > box.height + 40) continue;
      cand.push({ p, hx: x, hy: y });
    }

    /* 2) Hard cap. This is a legibility rule, not a space one: the parts
          that explain the object are the big and heavy ones, plus
          whatever the reader just clicked. */
    const rowH = compact ? 30 : 46;
    const fits = Math.max(4, Math.floor((yBottom - yTop) / rowH) * 2);
    const cap = Math.min(compact ? 8 : maxLabels, fits);
    if (cand.length > cap) {
      const score = (a) => (a.p.id === state.selected ? 1e9 : 0)
        + (a.p.size ? Math.max(...a.p.size) : 0) * 1000 + (a.p.massKg ?? 0);
      cand.sort((a, b) => score(b) - score(a));
      cand.length = cap;
    }

    /* 3) Balance the gutters. "Whichever half of the screen the part is
          on" was a bad rule: when the body sat right of centre, sixteen
          labels piled into the right gutter and overflowed while the left
          stayed empty. Sorting by screen x and splitting down the middle
          keeps each gutter at half and each label on its own side. */
    cand.sort((a, b) => a.hx - b.hx);
    const cut = Math.ceil(cand.length / 2);
    const groups = [
      { list: cand.slice(0, cut), x: 12, left: true },
      { list: cand.slice(cut), x: box.width - GUTTER - 12, left: false },
    ];

    /* 4) Build the DOM pool BEFORE packing: vertical packing has to know
          each label's real height, and a label that wraps to two lines
          does not fit a one-line slot. */
    const flat = [...groups[0].list, ...groups[1].list];
    while (labels.length > flat.length) labels.pop().el.remove();
    while (labels.length < flat.length) labels.push(makeLabel());
    while (leaders.length > flat.length) leaders.pop().g.remove();
    while (leaders.length < flat.length) leaders.push(makeLeader());

    flat.forEach((q, i) => {
      const L = labels[i];
      const p = q.p;
      L.el.style.display = '';
      L.el.style.maxWidth = `${GUTTER}px`;
      L.el.classList.toggle('xv-label--right', i >= cut);
      L.el.classList.toggle('xv-label--selected', p.id === state.selected);
      L.el.classList.toggle('xv-label--estimated', Boolean(p.tahmini));
      L.el.classList.toggle('xv-label--compact', compact);
      const num = String(i + 1).padStart(2, '0');
      if (L.num.textContent !== num) L.num.textContent = num;
      const name = p.ad || p.id;
      if (L.name.textContent !== name) L.name.textContent = name;
      /* The spec line carries the one number that matters at a glance,
         and says out loud when that number is an estimate. */
      const bits = [];
      if (p.tech?.no) bits.push(p.tech.no);
      if (Number.isFinite(p.massKg)) bits.push(massText(p.massKg * (p.qty ?? 1), p.tahmini));
      if (p.qty > 1) bits.push(`x${p.qty}`);
      const spec = bits.join('   ');
      if (L.spec.textContent !== spec) L.spec.textContent = spec;
      q.__el = L.el;
      q.__num = num;
      q.__h = L.el.offsetHeight || 30;      // MEASURED height
    });

    /* 5) Vertical packing: start at the projected y, push overlaps down,
          lift the whole column if it runs off the bottom, then re-seat
          anything that ran off the top. */
    const GAP = 7;
    const placed = [];
    for (const g of groups) {
      const n = g.list.length;
      if (!n) continue;
      g.list.sort((a, b) => a.hy - b.hy);
      const y = g.list.map(a => a.hy);
      for (let i = 1; i < n; i++) {
        const min = y[i - 1] + (g.list[i - 1].__h + g.list[i].__h) / 2 + GAP;
        if (y[i] < min) y[i] = min;
      }
      const bottom = yBottom - g.list[n - 1].__h / 2;
      const over = y[n - 1] - bottom;
      if (over > 0) for (let i = 0; i < n; i++) y[i] -= over;
      let top = yTop + g.list[0].__h / 2;
      for (let i = 0; i < n; i++) {
        if (y[i] < top) y[i] = top;
        top = y[i] + (g.list[i].__h + (g.list[i + 1]?.__h ?? 0)) / 2 + GAP;
      }
      g.list.forEach((a, i) => placed.push({ ...a, x: g.x, y: y[i], left: g.left }));
    }

    /* 6) Place and draw. The leader leaves the label's INNER edge, makes
          a short shoulder, then runs to a dot on the part - the shoulder
          is what keeps crossing leaders readable, and the numbered
          balloon is what ties a line to its card when they do cross. */
    for (const q of placed) {
      const el = q.__el;
      el.style.left = `${q.x}px`;
      el.style.top = `${q.y}px`;
      const i = labels.findIndex(t => t.el === el);
      const ux = q.left ? q.x + el.offsetWidth + 3 : q.x - 3;
      const shoulder = q.left ? ux + 14 : ux - 14;
      const bx = q.hx + (q.left ? -13 : 13);
      const L = leaders[i];
      L.line.setAttribute('points', `${ux},${q.y} ${shoulder},${q.y} ${bx},${q.hy}`);
      L.dot.setAttribute('cx', String(q.hx));
      L.dot.setAttribute('cy', String(q.hy));
      L.ring.setAttribute('cx', String(bx));
      L.ring.setAttribute('cy', String(q.hy));
      L.tag.setAttribute('x', String(bx));
      L.tag.setAttribute('y', String(q.hy));
      if (L.tag.textContent !== q.__num) L.tag.textContent = q.__num;
      L.g.classList.toggle('xv-leader--selected', q.p.id === state.selected);
    }
    return placed;
  }

  return {
    assembly, nodes, state, leaders: leaderGroup,
    /** Target explosion ratio (0..1). The transition is critically damped. */
    setExplode(k) { state.kTarget = Math.max(0, Math.min(1, k)); },
    /** Jump straight there (export path, reduced motion). */
    jumpExplode(k) { state.k = state.kTarget = Math.max(0, Math.min(1, k)); apply(); },
    setMode(m) { state.mode = m; apply(); },
    setStep(n) { state.step = n; apply(); },
    setCallout(id) { state.callout = id; apply(); },
    setSelected(id) {
      if (state.selected && state.selected !== id) {
        const prev = nodes.get(state.selected);
        if (prev) emissiveOf(prev, GLOW, 0);
        lit.delete(state.selected);
      }
      state.selected = id;
    },
    /** Hover is a QUESTION, selection is an answer: steady, not pulsing. */
    setHover(id) {
      if (state.hover === id) return;
      if (state.hover && state.hover !== state.selected) {
        const prev = nodes.get(state.hover);
        if (prev) emissiveOf(prev, GLOW, 0);
      }
      state.hover = id;
      if (id && id !== state.selected) {
        const n = nodes.get(id);
        if (n && n.visible) emissiveOf(n, GLOW, 0.3);
      }
    },
    setSection(section) { state.section = section; applySection(); },
    /** Focus a subassembly; null clears it. */
    setFocus(id) {
      state.focus = id || null;
      odakKume = focusSet(assembly, state.focus);
      apply();
    },
    /** The lit ids, for a caller that needs to frame them. */
    focusIds() { return odakKume ? [...odakKume] : null; },
    /** The ANIMATED explode level, which is not the slider's value while
        the view is still easing toward it. */
    explodeK() { return state.k; },
    /** Called every frame. */
    update(dt) {
      clock += dt;
      const next = approach(state.k, state.kTarget, dt, omega);
      if (Math.abs(next - state.k) > 1e-7) { state.k = next; apply(); }
      /* Selection pulse. ONE part only: two pulsing parts are two focal
         points, which is none. */
      if (state.selected && MO.pulse > 0) {
        const n = nodes.get(state.selected);
        if (n && n.visible) {
          emissiveOf(n, GLOW, MOTION.selectionPulse(clock, MO.pulse));
          lit.add(state.selected);
        }
      }
      drawLabels();
      return state.k;
    },
    /** Ray pick -> part id, or null. */
    pick(raycaster) {
      const targets = [];
      for (const [, n] of nodes) if (n?.visible) targets.push(n);
      const hits = raycaster.intersectObjects(targets, true);
      const first = hits.find(x => x.object.visible);
      if (!first) return null;
      let o = first.object;
      while (o && !o.userData.partId) o = o.parent;
      return o?.userData?.partId ?? null;
    },
    refresh: apply,
    dispose() {
      for (const [, n] of nodes) {
        n?.traverse?.(o => {
          if (o.userData?.__xvBase) { o.material = o.userData.__xvBase; o.userData.__xvMat?.dispose?.(); }
        });
      }
      for (const l of labels) l.el.remove(); labels.length = 0;
      for (const l of leaders) l.g.remove(); leaders.length = 0;
      svg?.remove(); svg = null;
      if (renderer) renderer.clippingPlanes = [];
    },
  };
}

/** Shared label styling - every showcase gets the same drawing language. */
export const EXPLODED_CSS = `
.xv-label { position: absolute; transform: translateY(-50%); display: grid;
  grid-template-columns: auto 1fr; gap: 0 7px; align-items: start;
  padding: 4px 8px 5px; border-radius: 5px;
  background: rgba(8,10,15,.90); border: 1px solid #2b3240;
  font-size: 11px; line-height: 1.3; color: #d7dce6; }
.xv-label--right { direction: rtl; }
.xv-label--right > * { direction: ltr; }
.xv-label__num { font-size: 9.5px; font-weight: 700; letter-spacing: .04em;
  font-variant-numeric: tabular-nums; color: #8b93a3;
  border: 1px solid #39414f; border-radius: 3px; padding: 1px 3px; margin-top: 1px; }
.xv-label__text { display: block; min-width: 0; }
.xv-label__name { display: block; font-weight: 600; color: #eef1f6;
  overflow-wrap: break-word; hyphens: auto; }
.xv-label--compact { padding: 3px 7px 4px; font-size: 10.5px; }
.xv-label--compact .xv-label__spec { display: none; }
.xv-label__spec { display: block; margin-top: 1px; font-size: 9.5px;
  font-variant-numeric: tabular-nums; letter-spacing: .02em; color: #8b93a3; }
.xv-label--selected { border-color: #c9a35c; background: rgba(28,22,10,.94); }
.xv-label--selected .xv-label__name { color: #f6e7c6; }
.xv-label--selected .xv-label__num { color: #c9a35c; border-color: #7a5f2e; }
.xv-label--estimated .xv-label__spec { color: #b98a4e; }
.xv-leader polyline { fill: none; stroke: #3d4553; stroke-width: 1; }
.xv-leader circle { fill: #3d4553; stroke: none; }
.xv-leader__balloon { fill: rgba(8,10,15,.90); stroke: #3d4553; stroke-width: 1; }
.xv-leader__tag { fill: #8b93a3; font: 700 9px "Segoe UI", system-ui, sans-serif;
  letter-spacing: .03em; }
.xv-leader--selected polyline { stroke: #c9a35c; }
.xv-leader--selected circle { fill: #c9a35c; }
.xv-leader--selected .xv-leader__balloon { fill: rgba(28,22,10,.94); stroke: #c9a35c; }
.xv-leader--selected .xv-leader__tag { fill: #f6e7c6; }
`;

export { DEG };
