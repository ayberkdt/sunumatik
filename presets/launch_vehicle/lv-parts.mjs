/* lv-parts.mjs — LAUNCH VEHICLE PART CATALOGUE AND STACKING ORDER
 * (no three, no DOM, pure).
 *
 * This file is the whole object. There is NO lv-build.mjs: the bodies come
 * from `core/object-build.mjs`, which has no cases and knows nothing about
 * rockets, and the shapes come from the grammar in `core/hardware-shapes.mjs`.
 * That was the test the exploded-view plan set for itself
 * (docs/exploded-system-plan.md §4) and this is the answer to it.
 *
 * Units: metres and kilograms. Positions are in vehicle coordinates with
 * +Z along the flight axis and z = 0 at the gimbal plane, so a part's z is
 * its height above the engine mounts.
 *
 * Class: a two-stage kerolox medium-lift launcher, ~562 t at liftoff,
 * ~15.6 t to low Earth orbit, 3.7 m core diameter. The numbers are the
 * typical magnitudes for that class and are A DESIGN EXAMPLE; this is not
 * any particular vehicle's data sheet. They are also CHECKED against each
 * other by `scripts/validate-launch-vehicle.mjs`: the ideal delta-v,
 * liftoff thrust-to-weight, burn times, mixture ratio and tank volumes all
 * have to close, or the gate fails.
 */

/** Subsystems — panel colour and filtering come from these. */
export const SUBSYSTEMS = Object.freeze({
  yapi: { ad: 'Structure', renk: '#9aa0aa', neden: 'Carries thrust, aerodynamic and inertial loads, and holds the stack straight.' },
  itki: { ad: 'Propulsion', renk: '#c98a5c', neden: 'Turns propellant into momentum; almost all of the vehicle exists to feed it.' },
  akiskan: { ad: 'Tanks and feed', renk: '#7fb0c9', neden: 'The vessels, the pressurant and the plumbing - the hardware that holds the propellant, not the propellant itself.' },
  yakit: { ad: 'Propellant', renk: '#5f7f9a', neden: 'The consumable. 92% of what leaves the pad is thrown out of the nozzles on the way up.' },
  aviyonik: { ad: 'Avionics', renk: '#b4a8c9', neden: 'Knows where it is, decides where to point, and ends the flight safely if it cannot.' },
  kurtarma: { ad: 'Recovery', renk: '#9ec98a', neden: 'Brings the first stage back. It costs performance and buys the stage again.' },
  faydali: { ad: 'Payload', renk: '#e0b25a', neden: 'The REASON the vehicle exists; the other 97% of the mass is delivery.' },
});

/** Interface kinds — the answer to "how is it attached". */
export const INTERFACES = Object.freeze({
  civata: 'Bolted joint (torqued, shimmed)',
  kaynak: 'Welded joint (not separable after build)',
  ayirma: 'Separation plane (pneumatic pushers or pyrotechnic)',
  akiskan: 'Fluid interface (welded line, shutoff valve)',
  elektrik: 'Electrical interface (connector, raceway harness)',
  mentese: 'Hinge and latch (stowed for ascent, deployed in flight)',
  kardan: 'Gimbal mount (thrust vector control)',
});

/* ── PARTS ────────────────────────────────────────────────────────────
   step     : stacking step. Parts in the same step go on together.
   mountsTo : the part this is attached to (root = null).
   pos      : centre of the part in vehicle coordinates [x, y, z] (m).
   size     : envelope [x, y, z] (m).
   sekil    : a kind in core/hardware-shapes.mjs. There is no other kind.
   detay    : what is ON it. Nobody positions a longeron.
   propKg   : propellant INSIDE this tank; excluded from dry mass.
   dizilim  : how copies of a qty > 1 row are arranged.
*/
export const PARTS = Object.freeze([
  /* STEP 1 — stage 1 tank section */
  { id: 'itki-yapisi', ad: 'Thrust structure', sistem: 'yapi', step: 1,
    mountsTo: null, arayuz: 'civata', massKg: 2600, pos: [0, 0, 1.4], size: [3.7, 3.7, 2.8],
    sekil: 'truss', detay: { bays: 3, posts: 8 },
    tech: { no: 'LV-STR-001', malzeme: '2195 Al-Li machined frames, Ti-6Al-4V engine fittings', baglanti: '9 gimbal blocks; 8 outer engines on a 2.20 m circle, which keeps the bells inside the 3.7 m core', detay: 'Carries 7605 kN into a 3.7 m barrel; the outer engines also take the gimbal side loads', kalite: 'Proof loaded to 1.25 x limit' },
    why: 'Nine engines push here and one barrel has to receive it. This is the only part of the vehicle where the load path is a point pattern rather than a shell.' },

  { id: 's1-rp1-tank', ad: 'Stage 1 RP-1 tank', sistem: 'akiskan', step: 1,
    mountsTo: 'itki-yapisi', arayuz: 'kaynak', massKg: 3400,
    pos: [0, 0, 10.51], size: [3.7, 3.7, 15.42],
    sekil: 'tank', detay: { domeRatio: 0.7, lugs: 0, valve: true, blanket: false },
    tech: { no: 'LV-FLU-010', malzeme: '2195 Al-Li, friction stir welded barrel', baglanti: 'Welded to the thrust structure ring; 8 feed lines to the engines', detay: '151.9 m3 of RP-1 at 810 kg/m3 in a 156.5 m3 tank (3% ullage); ellipsoidal domes at 0.7 r', kalite: 'Every weld radiographed; proof to 1.4 x MEOP' },
    why: 'The denser propellant goes aft, where its mass helps damp the stack rather than driving the bending mode.' },

  { id: 'ara-tank', ad: 'Intertank', sistem: 'yapi', step: 1,
    mountsTo: 's1-rp1-tank', arayuz: 'civata', massKg: 900, pos: [0, 0, 18.97], size: [3.7, 3.7, 1.5],
    sekil: 'tube', detay: { endRings: true, bolts: 36, ringFrames: 2, longerons: 12, passThroughs: 2 },
    tech: { no: 'LV-STR-002', malzeme: 'Skin-stringer 2219 aluminium', baglanti: '36 x M10 at each end ring', detay: 'Unpressurised; carries the LOX tank load past the RP-1 tank dome', kalite: 'Buckling margin 1.6' },
    why: 'Two domes cannot touch. The intertank is the dry bay between them, and it is where the feed line and the harness cross.' },

  { id: 's1-lox-tank', ad: 'Stage 1 LOX tank', sistem: 'akiskan', step: 1,
    mountsTo: 'ara-tank', arayuz: 'kaynak', massKg: 5200,
    pos: [0, 0, 32.24], size: [3.7, 3.7, 25.03],
    sekil: 'tank', detay: { domeRatio: 0.7, lugs: 0, valve: true, blanket: false },
    tech: { no: 'LV-FLU-011', malzeme: '2195 Al-Li, friction stir welded barrel', baglanti: 'Welded; a single 0.30 m downcomer runs through the RP-1 tank', detay: '252.4 m3 of liquid oxygen at 1141 kg/m3 and 90 K, in a 260 m3 tank (3% ullage)', kalite: 'Cleaned for oxygen service; no hydrocarbon may remain' },
    why: 'Oxidiser is 70% of the propellant mass by itself. Putting it forward keeps the centre of mass high early, which is what makes the vehicle stable as it empties.' },

  /* The consumable, declared where it can be counted and seen. Drawn as a
     translucent volume inside its tank: it is not hardware, and the one
     thing the drawing must not do is pretend that it is. */
  { id: 's1-rp1', ad: 'Stage 1 RP-1 load', sistem: 'yakit', step: 1,
    mountsTo: 's1-rp1-tank', arayuz: 'akiskan', massKg: 123054, pos: [0, 0, 10.51], size: [3.5, 3.5, 12.4],
    sekil: 'volume', detay: { silindir: true, renk: 0x8a6a48, opacity: 0.32 },
    tech: { no: 'LV-FLU-016', malzeme: 'RP-1 refined kerosene', baglanti: 'Loaded through the fill and drain valve, T-45 min', detay: '151.9 m3 at 810 kg/m3, chilled to 266 K to gain density' },
    why: 'Chilling the kerosene below ambient buys a few per cent more mass in the same tank, which on an upper stage is worth its weight in payload.' },
  { id: 's1-lox', ad: 'Stage 1 LOX load', sistem: 'yakit', step: 1,
    mountsTo: 's1-lox-tank', arayuz: 'akiskan', massKg: 287946, pos: [0, 0, 32.24], size: [3.5, 3.5, 22.44],
    sekil: 'volume', detay: { silindir: true, renk: 0x6f9fc9, opacity: 0.3 },
    tech: { no: 'LV-FLU-017', malzeme: 'Liquid oxygen at 90 K', baglanti: 'Loaded from T-35 min; topped continuously until T-2 min', detay: '252.4 m3 at 1141 kg/m3; boil-off is replaced right up to launch' },
    why: 'It boils the whole time it sits on the pad, so the tank is being refilled until two minutes before liftoff. This is why a hold late in the count is expensive.' },
  { id: 's2-rp1', ad: 'Stage 2 RP-1 load', sistem: 'yakit', step: 5,
    mountsTo: 's2-rp1-tank', arayuz: 'akiskan', massKg: 32036, pos: [0, 0, 51.48], size: [3.5, 3.5, 2.06],
    sekil: 'volume', detay: { silindir: true, renk: 0x8a6a48, opacity: 0.32 },
    tech: { no: 'LV-FLU-018', malzeme: 'RP-1 refined kerosene', baglanti: 'Loaded through the stage 1 umbilical', detay: '39.6 m3; enough for two burns plus a deorbit' },
    why: 'The upper stage carries reserve for a deorbit burn it hopes not to need, because a spent stage left in orbit is debris.' },
  { id: 's2-lox', ad: 'Stage 2 LOX load', sistem: 'yakit', step: 5,
    mountsTo: 's2-lox-tank', arayuz: 'akiskan', massKg: 74964, pos: [0, 0, 57.38], size: [3.5, 3.5, 4.57],
    sekil: 'volume', detay: { silindir: true, renk: 0x6f9fc9, opacity: 0.3 },
    tech: { no: 'LV-FLU-019', malzeme: 'Liquid oxygen at 90 K', baglanti: 'Loaded through the stage 1 umbilical', detay: '65.7 m3; the O/F ratio is held by the engine mixture valve' },
    why: 'Running out of either propellant first wastes the other, so the mixture valve trims the ratio through the burn to empty both tanks together.' },

  /* STEP 2 — stage 1 propulsion */
  { id: 's1-motor', ad: 'Stage 1 engine (kerolox, gimballed)', sistem: 'itki', step: 2, qty: 9,
    dizilim: { tip: 'halka', r: 1.10, merkez: true },
    mountsTo: 'itki-yapisi', arayuz: 'kardan', massKg: 470, pos: [0, 0, -1.2], size: [1.35, 1.35, 2.4],
    sekil: 'engine', detay: { hoops: 6, turbopump: true, gimbal: true, feedLines: 2 },
    tech: { no: 'LV-PRP-020', malzeme: 'Inconel 718 chamber, regeneratively cooled nozzle', baglanti: 'Two-axis gimbal, +/-6 deg; the centre engine is fixed', detay: '845 kN sea level, Isp 282 s SL / 311 s vacuum; 305.6 kg/s each, 149 s burn', kalite: 'Each unit hot-fire accepted before installation' },
    why: 'Nine small engines instead of one large one: the vehicle can lose one and still fly, and the same engine flies on both stages with a different nozzle.' },

  /* STEP 3 — recovery hardware */
  { id: 'inis-ayagi', ad: 'Landing leg (stowed)', sistem: 'kurtarma', step: 3, qty: 4,
    dizilim: { tip: 'halka', r: 1.95 },
    mountsTo: 's1-rp1-tank', arayuz: 'mentese', massKg: 480, pos: [0, 0, 7.5], size: [0.34, 0.34, 9.0],
    sekil: 'rod', detay: { turns: 0, clamps: 3, coreRatio: 0.72 },
    tech: { no: 'LV-REC-030', malzeme: 'Carbon fibre and aluminium honeycomb, helium actuated', baglanti: 'Hinge at the base, latch at the top; released 15 s before touchdown', detay: '9 m stowed; 18 m deployed span; absorbs 2.4 MJ in crush cores', kalite: 'Deployment tested at 1.2 x qualification rate' },
    why: 'Two tonnes of leg buys the stage back. This is the clearest place in the vehicle where performance is deliberately traded for cost.' },

  { id: 'izgara-kanat', ad: 'Grid fin', sistem: 'kurtarma', step: 3, qty: 4,
    dizilim: { tip: 'halka', r: 1.95, faz: 0.785, yonel: true },
    mountsTo: 's1-lox-tank', arayuz: 'mentese', massKg: 210, pos: [0, 0, 43.0], size: [1.3, 0.16, 1.5],
    sekil: 'panel', detay: { inserts: true, headers: false, lattice: 5 },
    tech: { no: 'LV-REC-031', malzeme: 'Forged and machined titanium, uncooled', baglanti: 'Hinged; folds flat against the tank for ascent', detay: 'Lattice aerofoil; works from Mach 5 down to subsonic without stalling' },
    why: 'A grid fin gives control authority at hypersonic speed where a flat fin would stall, and it folds flat, which a flat fin of the same area could not.' },

  /* STEP 4 — stage 1 close-out */
  { id: 'helyum-copv', ad: 'Helium pressurant COPV', sistem: 'akiskan', step: 4, qty: 4,
    dizilim: { tip: 'halka', r: 1.2 },
    mountsTo: 's1-lox-tank', arayuz: 'akiskan', massKg: 95, pos: [0, 0, 23.0], size: [1.0, 1.0, 1.0],
    sekil: 'sphere', detay: { bands: 6, boss: true, saddle: true },
    tech: { no: 'LV-FLU-012', malzeme: 'Aluminium liner with carbon overwrap', baglanti: '2 saddles inside the LOX tank; submerged in liquid oxygen', detay: '350 bar; regulated to 6 bar ullage pressure' },
    why: 'Submerging the bottles in the LOX keeps the helium cold and dense, so the same pressurant mass fits in a smaller vessel.' },

  { id: 's1-kablo-yolu', ad: 'Stage 1 raceway', sistem: 'aviyonik', step: 4,
    mountsTo: 's1-rp1-tank', arayuz: 'elektrik', massKg: 730, pos: [1.95, 0, 22.0], size: [0.42, 0.42, 38.0],
    sekil: 'rod', detay: { turns: 0, clamps: 8, coreRatio: 0.8 },
    tech: { no: 'LV-AVI-040', malzeme: 'Aluminium trough with an aerodynamic fairing', baglanti: 'P-clamps every 1.2 m; separable at the stage interface', detay: 'Power, engine commands and pneumatics from the top of the stack to the engines' },
    why: 'The computer is at the top and the engines are at the bottom, 45 m apart. Every command they exchange goes along this one channel.' },

  /* STEP 5 — interstage and stage 2 */
  { id: 'ara-kademe', ad: 'Interstage', sistem: 'yapi', step: 5,
    mountsTo: 's1-lox-tank', arayuz: 'ayirma', massKg: 1800, pos: [0, 0, 46.95], size: [3.7, 3.7, 4.4],
    sekil: 'tube', detay: { endRings: true, bolts: 40, ringFrames: 3, longerons: 16, passThroughs: 2 },
    tech: { no: 'LV-STR-003', malzeme: 'Carbon fibre composite with an aluminium honeycomb core', baglanti: 'Pneumatic pushers at separation; no pyrotechnics', detay: 'Houses the second stage nozzle; stays with the first stage at separation', kalite: 'Separation tested at flight-like temperature' },
    why: 'The vacuum nozzle is too wide to sit outside the vehicle, so the interstage is the hollow that carries it. At separation the stages push apart here.' },

  { id: 's2-itki-konisi', ad: 'Stage 2 thrust cone', sistem: 'yapi', step: 5,
    mountsTo: 's2-rp1-tank', arayuz: 'civata', massKg: 380, pos: [0, 0, 48.45], size: [2.6, 2.6, 1.4],
    sekil: 'cone', detay: { hoops: 7, open: true, splitLine: false },
    tech: { no: 'LV-STR-004', malzeme: 'Machined 2219 aluminium cone', baglanti: '24 x M8 to the aft dome ring; single gimbal block', detay: 'Spreads 981 kN from one engine mount into the tank dome ring' },
    why: 'The thrust of one engine has to reach a 3.7 m dome. A cone is the shortest structure that turns a point load into a ring load.' },

  { id: 's2-motor', ad: 'Stage 2 engine (vacuum nozzle)', sistem: 'itki', step: 5,
    mountsTo: 's2-itki-konisi', arayuz: 'kardan', massKg: 520, pos: [0, 0, 46.05], size: [2.45, 2.45, 3.4],
    sekil: 'engine', detay: { hoops: 9, turbopump: true, gimbal: true, feedLines: 2, rThroat: 0.2 },
    tech: { no: 'LV-PRP-021', malzeme: 'Niobium alloy radiatively cooled nozzle extension', baglanti: 'Two-axis gimbal, +/-3 deg', detay: '981 kN vacuum, Isp 348 s; 287.5 kg/s, 372 s burn; area ratio 165', kalite: 'Restartable; two ignitions minimum per flight' },
    why: 'The same engine as stage 1 with a nozzle five times wider. In vacuum there is no back pressure to separate the flow, so the extra expansion is free specific impulse.' },

  { id: 's2-rp1-tank', ad: 'Stage 2 RP-1 tank', sistem: 'akiskan', step: 5,
    mountsTo: 'ara-kademe', arayuz: 'ayirma', massKg: 900,
    pos: [0, 0, 51.48], size: [3.7, 3.7, 4.65],
    sekil: 'tank', detay: { domeRatio: 0.7, lugs: 0, valve: true, blanket: true },
    tech: { no: 'LV-FLU-013', malzeme: '2195 Al-Li', baglanti: 'Welded; the separation ring is its aft skirt', detay: '39.6 m3 of RP-1; blanketed because a coast can last hours' },
    why: 'The stage may coast for hours between burns, so unlike stage 1 this tank has to keep its propellant in the temperature band on its own.' },

  { id: 's2-lox-tank', ad: 'Stage 2 LOX tank', sistem: 'akiskan', step: 5,
    mountsTo: 's2-rp1-tank', arayuz: 'kaynak', massKg: 1350,
    pos: [0, 0, 57.38], size: [3.7, 3.7, 7.16],
    sekil: 'tank', detay: { domeRatio: 0.7, lugs: 0, valve: true, blanket: true },
    tech: { no: 'LV-FLU-014', malzeme: '2195 Al-Li', baglanti: 'Common aft dome with the RP-1 tank', detay: '65.7 m3 of liquid oxygen; boil-off is made up from the pressurant' },
    why: 'A common bulkhead between the two tanks removes a metre of structure, which on an upper stage is worth roughly its own mass in payload.' },

  { id: 's2-copv', ad: 'Stage 2 helium COPV', sistem: 'akiskan', step: 5, qty: 2,
    dizilim: { tip: 'ayna', eksen: 'x' },
    mountsTo: 's2-rp1-tank', arayuz: 'akiskan', massKg: 65, pos: [1.4, 0, 50.5], size: [0.72, 0.72, 0.72],
    sekil: 'sphere', detay: { bands: 5, boss: true, saddle: true },
    tech: { no: 'LV-FLU-015', malzeme: 'Aluminium liner, carbon overwrap', baglanti: 'Saddle clamps on the tank skirt', detay: '350 bar; also feeds the attitude thrusters' },
    why: 'A restartable stage has to re-pressurise after every coast, so it carries its pressurant outside the cold tank where it stays usable.' },

  /* STEP 6 — avionics */
  { id: 's2-aviyonik', ad: 'Flight computer and IMU', sistem: 'aviyonik', step: 6,
    mountsTo: 's2-lox-tank', arayuz: 'civata', massKg: 190, pos: [1.9, 0, 59.0], size: [1.1, 0.5, 0.4],
    sekil: 'box', detay: { connectors: 8, fins: true, decal: null },
    tech: { no: 'LV-AVI-041', malzeme: 'Aluminium housing, conduction cooled', baglanti: '10 x M6 into the tank skirt; gap filler interface', detay: 'Triple-redundant computers voting on every command; ring laser IMU with GNSS aiding' },
    why: 'Ascent lasts nine minutes and there is no second attempt, so the avionics are voted rather than switched: a failure has to be outvoted, not detected.' },

  { id: 's2-batarya', ad: 'Stage 2 battery', sistem: 'aviyonik', step: 6,
    mountsTo: 's2-lox-tank', arayuz: 'civata', massKg: 120, pos: [-1.9, 0, 59.0], size: [0.6, 0.45, 0.4],
    sekil: 'box', detay: { connectors: 4, fins: false },
    tech: { no: 'LV-AVI-042', malzeme: 'Lithium-ion, hermetic case', baglanti: '6 x M6; isolated from the tank thermally', detay: '2.4 kWh; sized for a six-hour coast plus deorbit' },
    why: 'The upper stage has no solar array. Everything it will ever do has to fit inside the charge it left the ground with.' },

  { id: 's2-rcs', ad: 'Attitude thruster pod', sistem: 'aviyonik', step: 6, qty: 4,
    dizilim: { tip: 'halka', r: 1.9, faz: 0.785, yonel: true },
    mountsTo: 's2-lox-tank', arayuz: 'akiskan', massKg: 42.5, pos: [0, 0, 58.0], size: [0.36, 0.36, 0.3],
    sekil: 'box', detay: { connectors: 2, fins: false },
    tech: { no: 'LV-AVI-043', malzeme: 'Cold gas helium thrusters', baglanti: 'Fed from the stage 2 COPVs', detay: '4 pods, 220 N total; settles the propellant before every restart' },
    why: 'In free fall the propellant floats away from the outlet. These fire first to push it back against the dome so the engine has something to draw.' },

  { id: 's2-kablo-yolu', ad: 'Stage 2 raceway', sistem: 'aviyonik', step: 6,
    mountsTo: 's2-rp1-tank', arayuz: 'elektrik', massKg: 240, pos: [0, 1.95, 52.5], size: [0.3, 0.3, 9.0],
    sekil: 'rod', detay: { turns: 0, clamps: 5, coreRatio: 0.8 },
    tech: { no: 'LV-AVI-044', malzeme: 'Aluminium trough', baglanti: 'P-clamps; crosses the separation plane on a breakaway connector', detay: 'Engine commands, tank sensors and the flight termination line' },
    why: 'It also carries the flight termination line, which is the one circuit on the vehicle that has to work when everything else has stopped.' },

  /* STEP 7 — payload and fairing */
  { id: 'yuk-adaptoru', ad: 'Payload adapter', sistem: 'yapi', step: 7,
    mountsTo: 's2-lox-tank', arayuz: 'ayirma', massKg: 500, pos: [0, 0, 61.91], size: [3.0, 3.0, 1.9],
    sekil: 'cone', detay: { hoops: 6, open: true, splitLine: false },
    tech: { no: 'LV-STR-005', malzeme: 'Aluminium cone with a clamp band interface', baglanti: '937 mm clamp band; separation springs give 0.4 m/s', detay: 'Tapers 3.0 m to 0.94 m; the satellite never sees the 3.7 m diameter' },
    why: 'The spacecraft interface is under a metre across and the vehicle is nearly four. The adapter is the whole of that transition, and it is the last piece of the rocket the payload touches.' },

  { id: 'faydali-yuk', ad: 'Payload (spacecraft)', sistem: 'faydali', step: 7,
    mountsTo: 'yuk-adaptoru', arayuz: 'ayirma', massKg: 15600, pos: [0, 0, 64.66], size: [2.6, 2.6, 3.6],
    sekil: 'volume', detay: { renk: 0xe0b25a, opacity: 0.3 },
    tech: { no: 'LV-PLD-050', malzeme: 'Customer supplied', baglanti: '937 mm clamp band on the adapter', detay: '15 600 kg to a 200 km x 28.5 deg parking orbit' },
    why: 'Drawn as a volume rather than as hardware because it IS a volume to the launch vehicle: a mass and an envelope, and nothing else about it is the rocket’s business.' },

  { id: 'baslik-govde', ad: 'Fairing barrel', sistem: 'yapi', step: 7,
    mountsTo: 's2-lox-tank', arayuz: 'ayirma', massKg: 1100, pos: [0, 0, 64.06], size: [5.2, 5.2, 6.2],
    sekil: 'tube', detay: { endRings: true, bolts: 0, ringFrames: 2, longerons: 0, passThroughs: 0 },
    tech: { no: 'LV-PLD-051', malzeme: 'Carbon fibre face sheets on aluminium honeycomb', baglanti: 'Split along two lines; pneumatic pushers open the halves', detay: '4.6 m usable diameter; acoustic blankets inside', kalite: 'Separation tested in vacuum' },
    why: 'It exists for about three minutes. Everything above 110 km has no use for it, so it is thrown away as soon as the air is thin enough.' },

  { id: 'baslik-burun', ad: 'Fairing nose', sistem: 'yapi', step: 7,
    mountsTo: 'baslik-govde', arayuz: 'civata', massKg: 800, pos: [0, 0, 69.36], size: [5.2, 5.2, 4.4],
    sekil: 'cone', detay: { hoops: 4, open: false, splitLine: true },
    tech: { no: 'LV-PLD-052', malzeme: 'Carbon fibre, cork ablative on the tip', baglanti: 'Continuous with the barrel halves; one split line each side', detay: 'Ogive profile; peak stagnation heating 120 kW/m2 near max q' },
    why: 'The split line runs the full height of both pieces, which is why the nose and the barrel are one structure that happens to be drawn as two.' },
]);

/* ── STACKING ORDER ──────────────────────────────────────────────────── */
export const STEPS = Object.freeze([
  { no: 1, ad: 'Stage 1 tank section', aciklama: 'Thrust structure, RP-1 tank, intertank and LOX tank are welded and bolted into one 45 m barrel, horizontally, in a building the length of a runway.' },
  { no: 2, ad: 'Stage 1 propulsion', aciklama: 'Nine engines go onto the thrust structure. Each one is hot-fire accepted before it is installed, because the stack is never fired complete before flight.' },
  { no: 3, ad: 'Recovery hardware', aciklama: 'Legs and grid fins go on last of the stage 1 items: they are the parts most likely to be swapped between flights.' },
  { no: 4, ad: 'Stage 1 close-out', aciklama: 'Pressurant bottles go inside the LOX tank and the raceway closes the side. After this nothing inside the stage is reachable.' },
  { no: 5, ad: 'Interstage and stage 2', aciklama: 'The second stage is built as a separate vehicle and mated whole. The interstage stays with stage 1 when they part.' },
  { no: 6, ad: 'Avionics', aciklama: 'Computers, battery and attitude pods go on the upper stage, where they are close to the payload and far from the engine vibration.' },
  { no: 7, ad: 'Payload and fairing', aciklama: 'The spacecraft is mated on its adapter in a clean room, the fairing closes around it, and the whole encapsulated assembly is lifted onto the rocket.' },
]);

/* ── QUERIES (pure) ──────────────────────────────────────────────────── */

const say = p => p.qty ?? 1;

/** Total mass of a row (count x unit), dry only. */
export const partMass = p => say(p) * p.massKg;

/** Rows that are consumable rather than hardware. */
export const ITICI_IDS = Object.freeze(['s1-rp1', 's1-lox', 's2-rp1', 's2-lox']);
const iticiMi = p => ITICI_IDS.includes(p.id);

/** Propellant carried by a row (zero unless the row IS propellant). */
export const partProp = p => (iticiMi(p) ? say(p) * p.massKg : 0);

/** Row by id. */
export function partById(id) { return PARTS.find(p => p.id === id) || null; }

/** Physical constants used by the budgets (SI). */
export const G0 = 9.80665;                 // standard gravity, m/s^2
export const RHO_LOX = 1141;               // kg/m^3 at 90 K
export const RHO_RP1 = 810;                // kg/m^3
export const OF_ORANI = 2.34;              // oxidiser-to-fuel mass ratio

/** Declared stage definition — which rows belong to which stage. */
export const STAGES = Object.freeze([
  { no: 1, ad: 'Stage 1',
    ids: ['itki-yapisi', 's1-rp1-tank', 'ara-tank', 's1-lox-tank', 's1-motor',
      'inis-ayagi', 'izgara-kanat', 'helyum-copv', 's1-kablo-yolu', 'ara-kademe',
      's1-rp1', 's1-lox'],
    motor: 's1-motor', motorAdet: 9, itkiN: 845000, IspSL: 282, IspVac: 311, IspOrt: 290 },
  { no: 2, ad: 'Stage 2',
    ids: ['s2-itki-konisi', 's2-motor', 's2-rp1-tank', 's2-lox-tank', 's2-copv',
      's2-aviyonik', 's2-batarya', 's2-rcs', 's2-kablo-yolu', 'yuk-adaptoru',
      's2-rp1', 's2-lox'],
    motor: 's2-motor', motorAdet: 1, itkiN: 981000, IspVac: 348, IspOrt: 348 },
]);

const BASLIK = ['baslik-govde', 'baslik-burun'];
const YUK = ['faydali-yuk'];

/**
 * Mass budget. Propellant is kept OUT of dry mass — the same separation the
 * satellite catalogue makes, and the same one that is most often blurred.
 */
export function massBudget() {
  const sistem = {};
  let kuru = 0, itici = 0;
  for (const p of PARTS) {
    const m = partMass(p);
    if (iticiMi(p)) { itici += m; } else { kuru += m; }
    sistem[p.sistem] = (sistem[p.sistem] || 0) + m;
  }
  const kademe = STAGES.map(s => ({
    no: s.no, ad: s.ad,
    kuruKg: s.ids.filter(id => !ITICI_IDS.includes(id))
      .reduce((a, id) => a + partMass(partById(id)), 0),
    iticiKg: s.ids.filter(id => ITICI_IDS.includes(id))
      .reduce((a, id) => a + partMass(partById(id)), 0),
  }));
  const baslikKg = BASLIK.reduce((a, id) => a + partMass(partById(id)), 0);
  const yukKg = YUK.reduce((a, id) => a + partMass(partById(id)), 0);
  return {
    kuruKg: Number(kuru.toFixed(1)),
    iticiKg: Number(itici.toFixed(1)),
    firlatmaKg: Number((kuru + itici).toFixed(1)),
    baslikKg, yukKg, kademe,
    sistemler: Object.entries(sistem)
      .map(([k, v]) => ({ sistem: k, ad: SUBSYSTEMS[k].ad, kg: Number(v.toFixed(1)), pay: v / kuru }))
      .sort((a, b) => b.kg - a.kg),
    parcaSayisi: PARTS.reduce((s, p) => s + say(p), 0),
  };
}

/**
 * Ideal delta-v by the rocket equation, stage by stage.
 *
 * dv = Isp * g0 * ln(m0 / mf). The fairing is jettisoned at stage
 * separation here, which is a simplification: in flight it goes a little
 * later, which HELPS. Taking it off early therefore keeps the number
 * conservative rather than flattering.
 */
export function deltaV() {
  const b = massBudget();
  const glow = b.firlatmaKg;
  const kademeler = [];
  let m0 = glow;
  for (const s of STAGES) {
    const k = b.kademe.find(x => x.no === s.no);
    const mf = m0 - k.iticiKg;
    const dv = s.IspOrt * G0 * Math.log(m0 / mf);
    kademeler.push({ no: s.no, ad: s.ad, m0Kg: Math.round(m0), mfKg: Math.round(mf),
      kutleOrani: Number((m0 / mf).toFixed(4)), dv: Math.round(dv) });
    /* What leaves with this stage: its own dry mass, and at stage 1 the
       fairing as well. */
    m0 = mf - k.kuruKg - (s.no === 1 ? b.baslikKg : 0);
  }
  const toplam = kademeler.reduce((a, x) => a + x.dv, 0);
  return { glowKg: glow, kademeler, toplamDv: toplam };
}

/** Liftoff thrust-to-weight, and per-stage burn time from mass flow. */
export function itkiButcesi() {
  const b = massBudget();
  const s1 = STAGES[0];
  const itkiN = s1.itkiN * s1.motorAdet;
  const agirlikN = b.firlatmaKg * G0;
  const kademeler = STAGES.map(s => {
    const k = b.kademe.find(x => x.no === s.no);
    const Isp = s.IspSL ?? s.IspVac;
    const debi = (s.itkiN / (Isp * G0)) * s.motorAdet;
    return { no: s.no, ad: s.ad, motorAdet: s.motorAdet, itkiN: s.itkiN * s.motorAdet,
      debiKgS: Number(debi.toFixed(1)), yanmaS: Math.round(k.iticiKg / debi) };
  });
  return { kalkisItkiN: itkiN, kalkisAgirlikN: Math.round(agirlikN),
    itkiAgirlik: Number((itkiN / agirlikN).toFixed(3)), kademeler };
}

/**
 * Do the tanks actually hold what the rows say they hold?
 *
 * Volume is computed from the geometry that is DRAWN — a barrel of
 * (L - 2 r domeRatio) plus two ellipsoidal domes — not from a nominal
 * cylinder. If the drawing and the propellant mass disagree, one of them
 * is wrong and this is where it shows.
 */
export function tankHacimleri() {
  return PARTS.filter(p => p.sekil === 'tank').map(p => {
    const r = p.size[0] / 2;
    const dr = p.detay?.domeRatio ?? 1;
    const govde = p.size[2] - 2 * r * dr;
    const hacim = Math.PI * r * r * govde + 2 * (2 / 3) * Math.PI * r * r * (r * dr);
    /* Which propellant: the row says so in its name and its material line. */
    const lox = /LOX|oxygen/i.test(p.ad + ' ' + (p.tech?.detay || ''));
    const yogunluk = lox ? RHO_LOX : RHO_RP1;
    /* The propellant is the row mounted INSIDE this tank. */
    const dolgu = PARTS.find(q => ITICI_IDS.includes(q.id) && q.mountsTo === p.id);
    const gereken = (dolgu ? dolgu.massKg : 0) / yogunluk;
    return { id: p.id, ad: p.ad, akiskan: lox ? 'LOX' : 'RP-1',
      hacimM3: Number(hacim.toFixed(1)), gerekenM3: Number(gereken.toFixed(1)),
      govdeM: Number(govde.toFixed(2)),
      pay: (hacim - gereken) / hacim };
  });
}

/** Oxidiser-to-fuel ratio, per stage, from the declared propellant loads. */
export function karisimOrani() {
  return STAGES.map(s => {
    let lox = 0, rp = 0;
    for (const id of s.ids) {
      const p = partById(id);
      if (!p || !ITICI_IDS.includes(id)) continue;
      if (/LOX|oxygen/i.test(p.ad + ' ' + (p.tech?.detay || ''))) lox += p.massKg; else rp += p.massKg;
    }
    return { no: s.no, ad: s.ad, loxKg: lox, rp1Kg: rp, oran: rp ? Number((lox / rp).toFixed(3)) : 0 };
  });
}

/** Overall height, from the engine exit plane to the tip of the nose. */
export function boy() {
  let alt = Infinity, ust = -Infinity;
  for (const p of PARTS) {
    if (ITICI_IDS.includes(p.id)) continue;   // inside a tank, not part of the envelope
    alt = Math.min(alt, p.pos[2] - p.size[2] / 2);
    ust = Math.max(ust, p.pos[2] + p.size[2] / 2);
  }
  return { altM: Number(alt.toFixed(2)), ustM: Number(ust.toFixed(2)), boyM: Number((ust - alt).toFixed(2)) };
}

/** Assembly tree: each part's children. */
export function tree() {
  const cocuk = new Map();
  for (const p of PARTS) {
    const k = p.mountsTo;
    if (!cocuk.has(k)) cocuk.set(k, []);
    cocuk.get(k).push(p);
  }
  return cocuk;
}

/** The chain from a part up to the root. */
export function mountChain(id) {
  const zincir = [];
  let p = partById(id);
  while (p) { zincir.push(p); p = p.mountsTo ? partById(p.mountsTo) : null; }
  return zincir;
}

/** Assembly depth — how far a part travels in the explosion. */
export function depth(id) { return mountChain(id).length - 1; }

/** Step-by-step stacking list. */
export function integrationOrder() {
  return STEPS.map(s => ({ ...s, parcalar: PARTS.filter(p => p.step === s.no) }));
}

/** Summary for the manifest and the caption. */
export function describe() {
  const b = massBudget();
  const d = deltaV();
  const t = itkiButcesi();
  return {
    parca: PARTS.length, adet: b.parcaSayisi, adim: STEPS.length,
    kuruKg: b.kuruKg, iticiKg: b.iticiKg, firlatmaKg: b.firlatmaKg,
    yukKg: b.yukKg, boyM: boy().boyM, capM: 3.7,
    toplamDv: d.toplamDv, itkiAgirlik: t.itkiAgirlik,
  };
}
