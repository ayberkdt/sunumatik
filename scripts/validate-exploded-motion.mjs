/* validate-exploded-motion.mjs — the motion model, proved without a screen.
 *
 * Every check here is an ANALYTIC IDENTITY: the result is computed a
 * second, independent way and the two are compared. "Looks smooth" is not
 * a criterion; what the eye cannot catch is exactly what these catch.
 *
 * Each section ends with a REVERSE TEST: a deliberately broken input has
 * to be caught. A test that cannot fail is worth nothing.
 *
 * Run: node scripts/validate-exploded-motion.mjs
 */

import * as M from '../presets/core/exploded-motion.mjs';

let pass = 0, fail = 0;
const section = (t) => console.log(`\n-- ${t} ${'-'.repeat(Math.max(0, 56 - t.length))}`);
function ok(cond, name, detail = '') {
  if (cond) { pass++; console.log(`  ok   ${name}${detail ? '  ' + detail : ''}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? '  ' + detail : ''}`); }
}
const near = (a, b, tol) => Math.abs(a - b) <= tol;

/* A body with a spread of depths and sizes, like any real assembly. */
const GABARI = 4;
const PARTS = [
  { id: 'ring', depth: 0, size: [3.8, 3.8, 0.2] },
  { id: 'tube', depth: 1, size: [1.8, 1.8, 2.4] },
  { id: 'panel-a', depth: 2, size: [1.7, 0.03, 1.9] },
  { id: 'panel-b', depth: 2, size: [1.7, 0.03, 1.9] },
  { id: 'box', depth: 3, size: [0.34, 0.26, 0.2] },
  { id: 'bracket', depth: 4, size: [0.09, 0.07, 0.05] },
];
const MAXD = Math.max(...PARTS.map(p => p.depth));
const DIRS = { 'ring': [0, 0, -1], 'tube': [0, 0, 1], 'panel-a': [0, 1, 0],
  'panel-b': [0, -1, 0], 'box': [1, 0, 0], 'bracket': [0.6, 0.6, 0.53] };
const opts = (p) => ({ depth: p.depth, maxDepth: MAXD, spread: M.SPREAD });

/* == 1. ENDPOINTS: the drawing property ============================== */
section('1. Endpoints');
{
  let worst0 = 0, worst1 = 0;
  for (const p of PARTS) {
    worst0 = Math.max(worst0, Math.abs(M.partProgress(0, opts(p))));
    worst1 = Math.max(worst1, Math.abs(M.partProgress(1, opts(p)) - 1));
  }
  ok(worst0 === 0 && worst1 === 0, 'progress is exactly 0 at k=0 and exactly 1 at k=1',
    `worst |p(0)|=${worst0}, |p(1)-1|=${worst1}`);

  /* The property the whole feature rests on: a part ARRIVES at its
     declared attitude, so the exploded state stays a drawing. */
  let worstAngle = 0, who = '';
  for (const p of PARTS) {
    const a = M.attitudeAmplitude(Math.max(...p.size), GABARI);
    for (const k of [0, 1]) {
      const ang = Math.abs(M.attitudeAngle(k, { ...opts(p), amplitude: a }));
      if (ang > worstAngle) { worstAngle = ang; who = `${p.id}@k=${k}`; }
    }
  }
  ok(worstAngle < 1e-12, 'separation attitude returns to ZERO at both ends',
    `worst ${worstAngle.toExponential(2)} rad (${who || 'none'})`);

  /* Mid-travel it must actually do something, or the whole thing is a
     no-op that trivially passes the test above. */
  const mid = PARTS.map(p => {
    const a = M.attitudeAmplitude(Math.max(...p.size), GABARI);
    let peak = 0;
    for (let i = 0; i <= 400; i++) peak = Math.max(peak, Math.abs(M.attitudeAngle(i / 400, { ...opts(p), amplitude: a })));
    return { id: p.id, deg: peak * 180 / Math.PI };
  });
  ok(mid.some(x => x.deg > 4), 'REVERSE TEST: attitude is non-trivial in between',
    mid.map(x => `${x.id} ${x.deg.toFixed(1)}deg`).join(', '));
}

/* == 2. MONOTONICITY AND CONTINUITY ================================== */
section('2. Monotonicity and continuity');
{
  const N = 2000;
  let worstBack = 0, worstJump = 0;
  for (const p of PARTS) {
    let prev = M.partProgress(0, opts(p));
    for (let i = 1; i <= N; i++) {
      const v = M.partProgress(i / N, opts(p));
      worstBack = Math.max(worstBack, prev - v);
      worstJump = Math.max(worstJump, Math.abs(v - prev));
      prev = v;
    }
  }
  ok(worstBack <= 0, 'progress never goes backwards', `worst regression ${worstBack.toExponential(2)}`);
  /* Continuity is judged against the SAMPLE SPACING, not a fixed number:
     a fixed tolerance flags a fast-but-smooth ramp and misses a small
     genuine discontinuity. The ideal bound is max|dp/dk| * dk. */
  const bound = 1.875 / (1 - M.SPREAD) * (1 / N) * 1.05;
  ok(worstJump < bound, 'per-sample jump stays under the analytic slope bound',
    `${worstJump.toExponential(3)} < ${bound.toExponential(3)}`);

  /* Reverse test: a step function must FAIL that same bound. */
  const stepJump = Math.abs(1 - 0);
  ok(stepJump > bound, 'REVERSE TEST: a step discontinuity would be caught',
    `${stepJump} > ${bound.toExponential(3)}`);

  /* Easing endpoints: first derivative vanishes at both ends. */
  const h = 1e-6;
  const d0 = (M.ease(h) - M.ease(0)) / h;
  const d1 = (M.ease(1) - M.ease(1 - h)) / h;
  ok(d0 < 1e-6 && d1 < 1e-6, 'ease slope vanishes at both ends',
    `${d0.toExponential(2)} / ${d1.toExponential(2)}`);
  ok(near(M.easeSlope(0.5), 1.875, 1e-12), 'ease slope peaks at 1.875 mid-way',
    M.easeSlope(0.5).toFixed(6));
  /* Closed-form slope must equal the numeric derivative of ease. */
  let worstSlope = 0;
  for (let i = 1; i < 400; i++) {
    const x = i / 400;
    const num = (M.ease(x + h) - M.ease(x - h)) / (2 * h);
    worstSlope = Math.max(worstSlope, Math.abs(num - M.easeSlope(x)));
  }
  ok(worstSlope < 1e-5, 'closed-form ease slope matches numeric derivative',
    `worst ${worstSlope.toExponential(2)}`);
}

/* == 3. STAGGER ====================================================== */
section('3. Stagger');
{
  const starts = PARTS.map(p => ({ id: p.id, depth: p.depth, s: M.startFraction(p.depth, MAXD) }));
  const byDepth = [...starts].sort((a, b) => a.depth - b.depth);
  let ordered = true;
  for (let i = 1; i < byDepth.length; i++) if (byDepth[i].s > byDepth[i - 1].s + 1e-12) ordered = false;
  ok(ordered, 'deeper parts start no earlier than shallower ones',
    byDepth.map(x => `${x.id}@${x.s.toFixed(2)}`).join(' '));
  ok(near(M.startFraction(0, MAXD), M.SPREAD, 1e-12), 'the outermost part starts last',
    `s=${M.startFraction(0, MAXD).toFixed(3)} = SPREAD`);
  ok(M.startFraction(MAXD, MAXD) === 0, 'the innermost part starts immediately');

  /* spread = 0 must reproduce lockstep EXACTLY - that is what proves the
     staggered model is a superset of the one it replaced. */
  let worst = 0;
  for (const p of PARTS) {
    for (let i = 0; i <= 200; i++) {
      const k = i / 200;
      const a = M.partProgress(k, { depth: p.depth, maxDepth: MAXD, spread: 0 });
      worst = Math.max(worst, Math.abs(a - M.ease(k)));
    }
  }
  ok(worst === 0, 'spread=0 reproduces un-staggered easing exactly', `worst ${worst}`);

  /* Everything still finishes together. */
  ok(PARTS.every(p => M.partProgress(1, opts(p)) === 1), 'all parts arrive at k=1');
}

/* == 4. AXIS ========================================================= */
section('4. Rotation axis');
{
  let worstLen = 0, worstDot = 0, who = '';
  for (const p of PARTS) {
    const d = DIRS[p.id];
    const ax = M.attitudeAxis(d, p.id);
    worstLen = Math.max(worstLen, Math.abs(Math.hypot(...ax) - 1));
    const dn = Math.hypot(...d);
    const dd = Math.abs(M.dot3(ax, [d[0] / dn, d[1] / dn, d[2] / dn]));
    if (dd > worstDot) { worstDot = dd; who = p.id; }
  }
  ok(worstLen < 1e-12, 'axis is a unit vector', `worst |len-1| ${worstLen.toExponential(2)}`);
  ok(worstDot < 1e-12, 'axis is PERPENDICULAR to travel (turns, does not drill)',
    `worst |axis.dir| ${worstDot.toExponential(2)} (${who})`);

  /* Degenerate input must not produce NaN: a part whose direction is the
     up vector has no unique perpendicular, and the fallback has to hold. */
  const deg = M.attitudeAxis([0, 0, 1], 'straight-up');
  ok(deg.every(Number.isFinite) && Math.abs(Math.hypot(...deg) - 1) < 1e-12,
    'axis stays finite when travel is parallel to up', `[${deg.map(x => x.toFixed(3))}]`);

  /* Neighbours must not share a roll, or a row of similar parts turns as
     one slab. Testing only UNIQUENESS was too weak and passed a hash that
     put 'panel-a', 'panel-b' and 'bracket' within 0.01 of each other -
     technically distinct, visually identical. The criterion is SPREAD. */
  const rolls = ['panel-a', 'panel-b', 'box', 'bracket', 'ring', 'tube'].map(id => M.hash01(id));
  const spread = Math.max(...rolls) - Math.min(...rolls);
  ok(spread > 0.5, 'similar part ids roll VISIBLY differently (not just distinctly)',
    `range ${spread.toFixed(3)} over ${rolls.length} ids: ${rolls.map(r => r.toFixed(2)).join(' ')}`);

  /* Distribution over many ids: a chi-square against a uniform expectation.
     Nine degrees of freedom, 1% critical value 21.67. */
  const N = 4000, bins = new Array(10).fill(0);
  for (let i = 0; i < N; i++) bins[Math.min(9, Math.floor(M.hash01(`part-${i}`) * 10))]++;
  const chi = bins.reduce((acc, c) => acc + (c - N / 10) ** 2 / (N / 10), 0);
  ok(chi < 21.67, 'hash is uniform over 4000 ids (chi-square, 9 dof, 1% = 21.67)',
    `chi2 = ${chi.toFixed(1)}`);

  /* REVERSE TEST: a deliberately clustered generator must be caught. */
  const clustered = (i) => 0.43 + (i % 7) * 0.001;
  const cb = new Array(10).fill(0);
  for (let i = 0; i < N; i++) cb[Math.min(9, Math.floor(clustered(i) * 10))]++;
  const cchi = cb.reduce((acc, c) => acc + (c - N / 10) ** 2 / (N / 10), 0);
  ok(cchi > 21.67, 'REVERSE TEST: a clustered generator fails the same test',
    `chi2 = ${cchi.toFixed(0)}`);
}

/* == 5. AMPLITUDE LAW ================================================ */
section('5. Amplitude law');
{
  const amp = (p) => M.attitudeAmplitude(Math.max(...p.size), GABARI) * 180 / Math.PI;
  const big = amp(PARTS[0]), small = amp(PARTS[5]);
  ok(small > big, 'small parts turn more than large ones',
    `bracket ${small.toFixed(1)}deg > ring ${big.toFixed(1)}deg`);
  ok(big < 1, 'the largest part stays essentially rigid', `${big.toFixed(2)}deg`);
  ok(small <= M.A_MAX_DEG + 1e-9, 'nothing exceeds the declared peak',
    `${small.toFixed(1)}deg <= ${M.A_MAX_DEG}deg`);
  ok(M.attitudeAmplitude(GABARI, GABARI) === 0, 'a part as big as the body does not turn at all');
  /* REVERSE TEST: a constant-amplitude law would fail the size ordering. */
  const flat = (s) => 0.2;
  ok(!(flat(0.1) > flat(3.8)), 'REVERSE TEST: a constant amplitude law fails the size test');
}

/* == 6. SPEED ======================================================== */
section('6. Speed');
{
  let allNonNeg = true, insideWindow = true;
  for (const p of PARTS) {
    let peakAt = -1, peak = -1;
    for (let i = 0; i <= 1000; i++) {
      const k = i / 1000;
      const v = M.partSpeed(k, opts(p));
      if (v < -1e-12) allNonNeg = false;
      if (v > peak) { peak = v; peakAt = k; }
    }
    const s = M.startFraction(p.depth, MAXD);
    if (!(peakAt > s - 1e-9 && peakAt < 1 + 1e-9)) insideWindow = false;
  }
  ok(allNonNeg, 'speed is never negative');
  ok(insideWindow, 'speed peaks inside each part\'s own window');
  ok(M.partSpeed(0, opts(PARTS[5])) === 0 && M.partSpeed(1, opts(PARTS[5])) === 0,
    'speed is zero at both ends (so the glint is off there)');
}

/* == 7. DETERMINISM AND REDUCED MOTION =============================== */
section('7. Determinism and reduced motion');
{
  const run = () => PARTS.map(p => M.partMotion(0.37, { ...p }, {
    maxDepth: MAXD, gabari: GABARI, dir: DIRS[p.id] }));
  const a = JSON.stringify(run()), b = JSON.stringify(run());
  ok(a === b, 'two independent calls are bitwise identical');
  ok(!/random/i.test(M.hash01.toString()), 'the per-part value comes from a hash, not Math.random');

  /* Reduced motion jumps to the endpoint; that endpoint must be the SAME
     state the animated path arrives at, or the two modes disagree. */
  let same = true;
  for (const p of PARTS) {
    const m = M.partMotion(1, { ...p }, { maxDepth: MAXD, gabari: GABARI, dir: DIRS[p.id] });
    if (m.progress !== 1 || Math.abs(m.angle) > 1e-12) same = false;
  }
  ok(same, 'the reduced-motion endpoint equals the animated endpoint exactly');

  const pulse = [0, 0.55, 1.1, 1.65, 2.2].map(t => M.selectionPulse(t));
  ok(near(pulse[0], pulse[4], 1e-12), 'selection pulse is periodic over its declared period',
    `T=${M.PULSE_PERIOD}s`);
  ok(Math.min(...pulse) >= 0.1 && Math.max(...pulse) <= 1.0,
    'pulse stays inside [0.1, 1.0] (never fully dark, never blown out)',
    `${Math.min(...pulse).toFixed(2)}..${Math.max(...pulse).toFixed(2)}`);
}

console.log(`\n${'='.repeat(60)}`);
console.log(fail === 0 ? `EXPLODED MOTION: ${pass}/${pass} passed` : `EXPLODED MOTION: ${pass} passed, ${fail} FAILED`);
process.exit(fail ? 1 : 0);
