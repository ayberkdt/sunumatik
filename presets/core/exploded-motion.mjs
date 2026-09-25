/* exploded-motion.mjs — HOW a part travels, as pure functions of k.
 * docs/exploded-motion-plan.md §2.
 *
 * No three, no DOM, no per-frame state: every quantity here is a closed
 * form of (k, part). That is what lets the whole motion model be proved
 * without a screen, and it is why scrubbing the slider backwards retraces
 * exactly instead of drifting.
 *
 * The one property everything else is built around: a part must ARRIVE at
 * its declared attitude. Whatever it does on the way, the exploded state
 * is a drawing, and a part left tilted there makes the drawing harder to
 * read.
 */

const TAU = Math.PI * 2;
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Default departure spread: the last part starts at 45% of the slider. */
export const SPREAD = 0.45;
/** Peak separation attitude for the smallest parts. */
export const A_MAX_DEG = 16;

/**
 * Deterministic per-part number in [0,1). No Math.random anywhere in this
 * module: two sessions, two machines and an export must produce the same
 * frame, and a random phase would quietly break that.
 */
export function hash01(id) {
  let h = 2166136261 >>> 0;
  const s = String(id);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  /* FNV-1a alone was NOT enough here. Its high bits barely move between
     short, similar strings, and taking the top 24 of them put 'panel-a',
     'panel-b' and 'bracket' within 0.01 of each other - so a row of
     similar parts all rolled the same way, which is the one thing this
     hash exists to prevent. Measured chi-square over 4000 ids was 128.9
     against a 1% threshold of 21.7.
     The MurmurHash3 finalizer mixes every bit into every other before the
     top bits are taken. */
  h ^= h >>> 16;
  h = Math.imul(h, 2246822507) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 3266489909) >>> 0;
  h ^= h >>> 16;
  return (h >>> 8) / 16777216;
}

/**
 * Smootherstep, 6p^5 - 15p^4 + 10p^3.
 *
 * Chosen over smoothstep because its SECOND derivative also vanishes at
 * both ends: a part does not jerk into motion and does not slam to a stop.
 * Endpoints are exactly 0 and 1, so the assembled and exploded poses stay
 * exact rather than nearly exact.
 */
export const ease = (p) => {
  const x = clamp01(p);
  return x * x * x * (x * (x * 6 - 15) + 10);
};
/** d(ease)/dp = 30p^2(1-p)^2. Zero at both ends, peak 1.875 at p = 0.5. */
export const easeSlope = (p) => {
  const x = clamp01(p);
  return 30 * x * x * (1 - x) * (1 - x);
};

/**
 * The part's own window inside the global k.
 *
 * Outermost parts leave first, which is the reverse of assembly order and
 * therefore the order somebody would actually take the machine apart.
 * `spread = 0` collapses this to the old lockstep behaviour exactly, which
 * is how the validator proves the change is a superset.
 */
export function startFraction(depth, maxDepth, spread = SPREAD) {
  if (spread <= 0 || maxDepth <= 0) return 0;
  return spread * (1 - depth / maxDepth);
}

/** Staggered, eased progress of one part at global k. */
export function partProgress(k, { depth = 0, maxDepth = 1, spread = SPREAD } = {}) {
  const s = startFraction(depth, maxDepth, spread);
  const span = 1 - s;
  const raw = span <= 1e-9 ? (k >= 1 ? 1 : 0) : clamp01((k - s) / span);
  return ease(raw);
}

/** dp/dk of the above. Feeds the travel glint; moves nothing itself. */
export function partSpeed(k, { depth = 0, maxDepth = 1, spread = SPREAD } = {}) {
  const s = startFraction(depth, maxDepth, spread);
  const span = 1 - s;
  if (span <= 1e-9) return 0;
  return easeSlope(clamp01((k - s) / span)) / span;
}

/**
 * Peak separation attitude for a part, in radians.
 *
 * Small parts turn more than large ones: a structural member that tips 15
 * degrees looks broken, and a bracket that does not turn at all looks
 * glued. The square makes the falloff sharp enough that the two biggest
 * parts of any body stay essentially rigid.
 */
export function attitudeAmplitude(sizeMax, gabari, aMaxDeg = A_MAX_DEG) {
  if (!(gabari > 0)) return 0;
  const rel = clamp01((sizeMax || 0) / gabari);
  return (aMaxDeg * Math.PI / 180) * (1 - rel) * (1 - rel);
}

/**
 * Separation attitude at global k.
 *
 * sin(pi*p) is zero at both ends and peaks at mid-travel, so the part
 * leaves its assembled attitude, turns as it withdraws, and returns to its
 * declared attitude EXACTLY as it arrives.
 */
export function attitudeAngle(k, opts) {
  const p = partProgress(k, opts);
  return (opts.amplitude ?? 0) * Math.sin(Math.PI * p);
}

/* ── vector helpers (three-free) ─────────────────────────────────────── */
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Rotate v about a unit axis by angle (Rodrigues). */
export function rotateAbout(v, axis, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  const k = cross(axis, v);
  const d = dot3(axis, v) * (1 - c);
  return [v[0] * c + k[0] * s + axis[0] * d,
    v[1] * c + k[1] * s + axis[1] * d,
    v[2] * c + k[2] * s + axis[2] * d];
}

/**
 * Rotation axis for a part: PERPENDICULAR to its travel.
 *
 * Perpendicular means the part turns as it withdraws. An axis along the
 * travel direction would make it spin on its own path, which reads as a
 * drill rather than a disassembly. The per-part roll about `dir` comes
 * from the id hash, so no two neighbours turn the same way and nothing is
 * random at runtime.
 */
export function attitudeAxis(dir, id, up = [0, 0, 1]) {
  const d = norm(dir && len(dir) > 1e-9 ? dir : [1, 0, 0]);
  let base = cross(d, up);
  if (len(base) < 1e-6) base = cross(d, [1, 0, 0]);
  if (len(base) < 1e-6) base = cross(d, [0, 1, 0]);
  base = norm(base);
  return norm(rotateAbout(base, d, hash01(id) * TAU));
}

/**
 * Everything the binder needs for one part, in one call.
 *
 * `dir` is the part's explosion direction (from core/assembly.mjs) and is
 * only used to place the rotation axis; the translation itself still comes
 * from the assembly, so the two models cannot disagree about WHERE a part
 * ends up.
 */
export function partMotion(k, part, {
  maxDepth = 1, gabari = 1, spread = SPREAD, aMaxDeg = A_MAX_DEG, dir = [0, 0, 1],
} = {}) {
  const depth = part.depth ?? 0;
  const opts = { depth, maxDepth, spread };
  const sizeMax = part.size ? Math.max(...part.size) : 0;
  const amplitude = attitudeAmplitude(sizeMax, gabari, aMaxDeg);
  const progress = partProgress(k, opts);
  return {
    progress,
    speed: partSpeed(k, opts),
    angle: amplitude * Math.sin(Math.PI * progress),
    axis: attitudeAxis(dir, part.id),
    amplitude,
    start: startFraction(depth, maxDepth, spread),
  };
}

/**
 * Selection pulse. One part only: two pulsing parts are two focal points,
 * which is none.
 */
export const PULSE_PERIOD = 2.2;
export const selectionPulse = (t, e0 = 1) =>
  e0 * (0.55 + 0.45 * Math.sin(TAU * t / PULSE_PERIOD));

export { TAU, clamp01 };
