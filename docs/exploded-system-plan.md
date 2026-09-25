# Exploded-view system plan

Third document in the set. `exploded-view-plan.md` defines WHERE parts go,
`exploded-motion-plan.md` defines HOW they travel; this one defines what a
part is made of, and how a NEW object reaches the same level without
rewriting any of it.

## 0. The gap

Three of the four layers are already object-agnostic:

| layer | file | agnostic? |
|---|---|---|
| model — where parts go | `core/assembly.mjs` | yes |
| motion — how they travel | `core/exploded-motion.mjs` | yes |
| presentation — labels, leaders, section, picking | `core/exploded-view.mjs` | yes |
| **geometry — what a part looks like** | `*-build.mjs` per preset | **no** |

The fourth is the one that decides whether the result looks premium, and it
is the one that is copied by hand every time. The habitat grew a detail kit,
the satellite grew a second one with overlapping ideas under different
names, and anything new would grow a third. That is also why "some sections
are still basic" is a thing that can happen at all: nothing checks.

## 1. What has to be true

1. **A new object is a CATALOGUE, not a builder.** Adding a rocket should
   mean writing rows, not writing a `switch`.
2. **Detail is declared, not hand-placed.** A row says the tube has three
   ring frames and eight longerons; nobody positions a longeron.
3. **Nothing ships bare.** A part that is one primitive is a defect the
   gate catches, not something a reviewer has to notice.
4. **One vocabulary.** A bolt circle is a bolt circle on a satellite, a
   habitat and a launch vehicle.
5. **Cost is bounded.** Detail multiplies geometry, so the budget is
   measured and enforced rather than hoped for.

## 2. Architecture

```
core/hardware-kit.mjs      the shared vocabulary: ~40 items in 9 families
core/hardware-shapes.mjs   declarative shape builder: spec -> Group
core/assembly.mjs          unchanged
core/exploded-motion.mjs   unchanged
core/exploded-view.mjs     unchanged
<object>/<name>-parts.mjs  the catalogue: rows with geometry AND detail specs
```

`hab-detail.mjs` and `sat-detail.mjs` are absorbed into the kit and become
thin re-exports, so nothing that already works has to be touched twice.

### 2.1 The kit, by family

- **Fastening** — bolt circle, bolt pattern, clamp band, pyro cutter,
  separation spring, insert grid, isostatic bipod, vibration isolator
- **Structure** — honeycomb panel with edge close-out, ring frame,
  longeron, strut, truss bay, gusset, shear web
- **Thermal** — MLI blanket with tape seams and vent scallops, OSR tiles,
  radiator fins, heat-pipe header, louvre, heater patch
- **Fluid** — pipe run with clamps, expansion loop, valve, dry-break
  coupling, tank saddle, fill and drain port
- **Electrical** — connector bank, harness run with P-clamps and lacing,
  cable tray, grounding strap
- **RF** — parabolic dish with rim and ribs, feed horn, subreflector on
  struts, waveguide with flanges, patch array, helical antenna
- **Propulsion** — thruster pod, nozzle bell with stiffening hoops,
  injector head, gimbal actuator, propellant manifold
- **Mechanism** — hinge line, deployment spring, two-axis gimbal, slip-ring
  drive, launch latch
- **Marking** — part-number decal, caution placard, alignment target

Every item: takes `(THREE, kit, ...dims, opts)`, returns a `Group` at its
own origin, carries `userData.notes.why`, and obeys the axis contract.

### 2.2 The shape grammar

A catalogue row declares geometry and the detail that belongs on it:

```js
{ id: 'itki-tupu', sekil: 'tube',
  size: [0.86, 0.86, 1.96],
  detay: { endRings: true, bolts: 24, ringFrames: 3, longerons: 8,
           passThroughs: 2, blanket: false } }
```

`buildShape` reads that and assembles kit items. A rocket interstage is the
same `tube` with different numbers. When a row needs something the grammar
does not have, the grammar gains a key — once — and every object can use it.

### 2.3 Levels of detail

`lod: 'block' | 'shop' | 'flight'`, chosen per scene rather than per part:

- **block** — silhouette only, for a wide establishing shot or a thumbnail
- **shop** — structure and interfaces, the default for an exploded view
- **flight** — everything, including fastener heads and decals, for a hero
  close-up

The same declaration serves all three. This is what keeps a 43-part
spacecraft affordable at `flight` and a 200-part launch vehicle affordable
at `shop`.

## 3. The density gate

`scripts/validate-hardware.mjs` runs against any object that exposes a
catalogue and a builder, and fails on:

1. **Bare primitive** — a part whose group has fewer than 3 meshes and uses
   no kit item. This is the check that makes "still basic" impossible to
   ship.
2. **Undeclared detail** — a part with a `sekil` the grammar knows but no
   `detay` block, i.e. someone took the default and moved on.
3. **Missing rationale** — a kit item without `userData.notes.why`.
4. **Budget** — triangles per part above the declared ceiling for its LOD,
   and total scene triangles above the scene ceiling.
5. **Determinism** — building twice gives identical vertex counts.
6. **Axis contract** — no bare `CylinderGeometry` / `ConeGeometry` /
   `LatheGeometry` outside `core/geometry-axis.mjs` (already enforced
   globally; restated here because the kit is where it would slip).

Reverse test: a deliberately bare part must fail check 1, or the check is
decoration.

## 4. Adding an object — the whole procedure

1. Write `<object>-parts.mjs`: rows with `id`, `ad`, `mountsTo`, `arayuz`,
   `step`, `massKg`, `pos`, `size`, `sekil`, `detay`, `why`, `tech`.
2. Run `validate-hardware.mjs`. It lists every row that is still bare.
3. Fill in `detay` until it passes.
4. Register the object in `exploded_view/index.html` — one entry.

No builder. No `switch`. That is the test of whether this plan worked: a
launch vehicle should be step 1 to 4 and nothing else.

## 5. Phases

- **F0** — promote the two kits into `core/hardware-kit.mjs`; old modules
  re-export so nothing breaks. Density gate with the bare-primitive check.
- **F1** — `hardware-shapes.mjs` grammar, satellite migrated onto it, and
  the parts the gate flags get their `detay`.
- **F2** — new satellite hardware the catalogue does not yet carry: Hall
  thruster pod, magnetometer boom, and a real bus primary structure
  (shear panels, corner posts and struts) instead of a box.
- **F3** — habitat migrated onto the grammar; LOD switch; launch vehicle
  as the proof that steps 1 to 4 are the whole procedure.
