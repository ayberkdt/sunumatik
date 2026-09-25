# Exploded-view motion plan

Companion to `exploded-view-plan.md`. That document defines WHERE parts go;
this one defines HOW they get there, and what the viewer is allowed to read
from the way they move.

## 0. What exists, what is missing

Today a part travels along a straight line from its assembled pose to its
exploded pose, and the whole body moves as one: every part starts at the
same instant, arrives at the same instant, and keeps a fixed orientation
throughout. That is correct but inert. Three things are missing.

1. **Order.** A real disassembly has one — blankets and deployables come off
   before the bolts they cover. Moving everything at once throws that away.
2. **Separation attitude.** A part that is being taken off a machine turns a
   little as it leaves. Pure translation reads like a diagram, not a body.
3. **Attention.** Nothing tells the eye which part it is looking at, or that
   a part is moving fastest right now.

And one interaction is missing: the object can be dragged, but it will not
turn on its own, so a still viewer sees one side of it forever.

## 1. Principles

- **Motion may not imply physics that is not there.** These parts are not
  falling, not thrusting and not floating in a current. Any rotation is a
  reading aid, and the manifest says so (`truthLevel: illustrative`).
- **Every state is reachable and stable.** k is a position, not a playback.
  Scrubbing backwards must retrace exactly; leaving the slider anywhere must
  leave a still image that is worth looking at.
- **The exploded state is a DRAWING.** Whatever a part does on the way, it
  must arrive at its declared attitude. A part left tilted at k = 1 makes the
  final view harder to read, which defeats the whole feature.
- **Reduced motion is not a degraded mode.** Under
  `prefers-reduced-motion: reduce` the view jumps to the same state, with the
  same geometry and the same labels. Nothing is lost except the transit.
- **Determinism.** No `Math.random()` anywhere. Per-part variation comes from
  a hash of the part id, so two sessions, two machines and an export all
  produce the same frame.

## 2. Motion model

All of it is a pure function of `k` and the part; there is no integrator and
no per-frame state, which is what makes the whole model testable without a
screen (`core/exploded-motion.mjs`, no three import).

### 2.1 Stagger — the order of departure

A single global `k` drives every part, but each part has its own window
inside it:

```
p_i(k) = clamp01( (k - s_i) / (1 - s_i - e_i) )
```

`s_i` is the part's start fraction and `e_i` its tail margin. Outermost
parts leave first, which is the reverse of the assembly order and therefore
the order a technician would actually take them off:

```
s_i = SPREAD * (1 - depth_i / maxDepth)
```

`SPREAD` is 0.45 by default: the last part starts at 45% of the slider and
everything still finishes together at k = 1. Setting `SPREAD = 0` restores
the old lockstep behaviour exactly, which is how the validator proves the
change is a superset of what was there.

### 2.2 Easing

`p_i` is passed through smootherstep, `6p⁵ − 15p⁴ + 10p³`. Its first AND
second derivatives vanish at both ends, so a part does not jerk into motion
and does not slam to a stop — and, because the endpoints are exactly 0 and
1, the assembled and exploded poses stay exact.

The slider itself keeps the existing critically damped follower. The two
compose: damping smooths what the user does, easing smooths what each part
does.

### 2.3 Separation attitude

Each part rotates about an axis perpendicular to its travel:

```
angle_i(k) = A_i * sin(pi * p_i(k))
```

`sin(pi·p)` is zero at both ends and peaks at mid-travel. The part therefore
leaves its assembled attitude, turns as it withdraws, and **returns to its
declared attitude exactly** as it arrives. This is the property that keeps
the exploded state a drawing, and it is the first thing the validator
checks.

**Axis.** `axis_i = normalize(dir_i × up)`, rotated about `dir_i` by a
deterministic per-part angle from `hash(id)`. Perpendicular to travel means
the part turns as it withdraws rather than spinning on its own path, which
would read as a drill rather than a disassembly.

**Amplitude.** Small parts turn more than large ones, because a large
structural member that tips 15° looks broken while a bracket that does not
turn at all looks glued:

```
A_i = A_MAX * (1 - clamp01( size_i / gabari ))^2     A_MAX = 16 deg
```

### 2.4 Speed, for the highlight layer

`v_i(k) = dp_i/dk` is available in closed form (the smootherstep
derivative). It is not used to move anything — it feeds the glint in §3.3,
so brightness tracks something real rather than a timer.

## 3. Highlight

### 3.1 Selection

The selected part gets an emissive pulse:
`e(t) = E0 * (0.55 + 0.45 * sin(2*pi*t/T))`, `T = 2.2 s`. One part only.
Two pulsing parts is two focal points, which is none.

### 3.2 Hover

Hover raises emissive to a constant, no pulse. Hover is a question; selection
is an answer, and they should not look alike.

### 3.3 Travel glint

While a part is moving, its emissive rises with `v_i`, normalised so the
peak is a fraction of the selection pulse. The eye follows what is moving;
this makes that legible without inventing a light source. It is off under
reduced motion, and off at k = 0 and k = 1 where `v_i` is zero anyway.

## 4. Turntable

- Toggle in the toolbar. When on, the camera orbits at 0.08 rad/s — slow
  enough to read a label, fast enough to show the far side in under a minute.
- Auto-start after 12 s of no pointer input, so an unattended screen keeps
  showing the object. An idle-started turntable stops on the first drag,
  wheel or click. One the reader turned on by hand does NOT: switching it
  off because they clicked a part would fight the person using it.
- Off under reduced motion, and off while the assembly playback runs, which
  already moves the reader's attention.

## 5. Camera transitions

Switching objects or framing a step re-aims the camera with the same
critically damped follower as the slider (position and target both), instead
of cutting. A cut between two bodies of different size costs the viewer the
sense of scale that the exploded view is supposed to give.

## 6. Budget

- No allocation inside the frame loop: quaternion, vector and matrix scratch
  objects are created once.
- Rotation is applied as a quaternion on top of the part's base quaternion,
  never as Euler, for the reason recorded in `hab-build.mjs`: Euler order
  silently reinterprets what "outward" means.
- The motion module never imports three. The binder does.

## 7. Validation (`scripts/validate-exploded-motion.mjs`)

Analytic identities, each one a property that must hold for every part:

1. `p_i(0) = 0` and `p_i(1) = 1` exactly, for every stagger setting.
2. `p_i` is monotone non-decreasing in k (sampled at 2000 points).
3. `angle_i(0) = angle_i(1) = 0` to within 1e-12 — the drawing property.
4. `angle_i` is continuous: max per-sample jump scales with the sample
   spacing, not with a fixed tolerance.
5. Easing endpoints: `ease'(0) = ease'(1) = 0` (numerically, < 1e-6).
6. `axis_i` is a unit vector and `axis_i · dir_i = 0` to 1e-12.
7. Determinism: two independent calls give bitwise identical output.
8. `SPREAD = 0` reproduces the un-staggered result exactly.
9. Stagger order: a deeper part starts no earlier than a shallower one.
10. Reverse test: a deliberately broken amplitude law (constant A) is caught
    by the size-scaling assertion.
11. Reduced-motion path equals the k = 1 endpoint exactly.
12. `v_i(k) >= 0` and peaks strictly inside the window.

## 8. Phases

- **F0** — `core/exploded-motion.mjs` (pure), validator, and stagger +
  easing + separation attitude wired into `core/exploded-view.mjs`.
- **F1** — highlight layer (selection pulse, hover, travel glint) and the
  turntable.
- **F2** — camera transitions, and a motion-manifest entry describing all of
  it with its limitations.
