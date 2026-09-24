# Scene blocks — the composable 3D presentation program

GOAL (user directive, 2026-08-13): stop multiplying small presets; build a
small number of EXCELLENT ones — manim-grade, block-by-block composable —
until a deck can be assembled from blocks: aesthetic spacecraft, a stage
that accepts a TRAJECTORY and plays it (lunar landing, transfer maneuver),
and a matching family of ML scenes. Quality over count. Every block obeys
`webgl-scene-contract.md` without exception.

## Categories (call them by these names)

### ORBITAL — Yörünge Sahnesi (`assets/orbital-*`)

| Block | Status | What it is |
|---|---|---|
| `cinematic_space` | **wave 2** | Cinematic spatial-journey SHELL (composes, never forks): exterior hero (cosmos sky + buildMoonMesh Moon + buildOrbiter in φ³ station-keeping idle with seeded RCS puffs) → canopy threshold (two-pass render; the Moon in the cockpit window IS the world pass) → data-driven chapter console → window-masked pass-through hand-off to orbital_stage, or the signature dive: sphere-to-terrain handoff behind a full-regolith frame, arriving at a buildRover documentary vista on a terrain DERIVED from lunar_descent's published recipe. One deterministic rail (wheel = slider = goTo API = same rail); every motion a pure function of (t, seed). Design doc: docs/cinematic-space-plan.md |
| `orbital_stage` | **wave 1** | THE core stage: central body (Earth/Moon, real textures), unit system, deterministic timeline (play/scrub/warp), trajectory tracks from Kepler elements, state arrays (data-driven!) or RK4 propagation with impulsive burns; fading trails, apsis markers, burn events with plume + ΔV arrow + pre/post orbit ghosts; camera director (chase/orbit/body/free with smooth transitions); telemetry HUD (t, alt, |v|, ΔV) in deck typography |
| `craft_blocks` | **wave 1** | Parametric aesthetic craft LIBRARY (no mount): orbiter, lander, 2-stage rocket, cubesat, capsule — pure builders returning THREE.Group, shared material language |
| `mechanism_lab` | **wave 2** | MECHANISM INSPECTOR over the parts contract: `physical_rigs/mechanism-index.mjs` names 16 assemblies across the craft library (rocker-bogie, Ackermann steering, cleated wheel, arm chain, pan-tilt mast, az-el dish, honeycomb leg stroke, TVC gimbal, grid fin, fairing hinge, SRB jettison, spring deploy, hatch, coaxial rotors, Starship flaps, SADA drum) and gives each a TYPE, the GOVERNING RELATION, the engineering WHY and the VALIDATION STEP that proves it. The page shows an exploded view (parts pushed along their assembly direction), a kinematic skeleton (pivot spheres, rotation-axis arrows coloured x/y/z, linkage polyline) and the MOTION ENVELOPE — the real path swept by the driven node's outermost part, sampled through the joint's declared range, not a drawn arc. Per-joint sliders drive the rig by hand; DOF is DERIVED from the rig map (two-axis gimbal 2, others 1), never hand-written. `scripts/validate-rigs.mjs` §11 checks every indexed joint name is actually produced by the builder source |
| `satellite_integration` | **wave 2** | INTEGRATION view, not a mechanism view. `mechanism_lab` explodes a mechanism to show how it MOVES; this one explodes a spacecraft to show how it is BUILT. `sat-parts.mjs` (three-less) declares 33 part types / 43 units across 8 subsystems, each with the part it mounts to, the interface class (bolted, slide, separation, fluid, thermal, electrical, hinge), the integration step, the mass and the REASON IT EXISTS. The assembly order is a physical constraint, not a narrative one: the tank goes in before the panels close, equipment is integrated at PANEL level on a bench, and the MLI is last because it seals access to every bolt underneath. Explosion direction is the reverse of assembly and is derived from each part's position relative to its parent, with depth setting the distance — parts never scatter randomly. Geometry in `sat-build.mjs` is generated FROM the catalogue fields, so the mass budget and the drawing cannot drift apart. `scripts/validate-satellite.mjs` (40 checks) proves the claims: the budget sums (709.4 kg dry + 415 kg propellant = 1124.4 kg launch), the mount tree is closed and acyclic, no part is installed before its parent, the centre of mass sits 32.7 mm off the separation-ring axis (inside the launcher interface limit), and the written reasons match the geometry — radiators are on ±Y BECAUSE the Sun sweeps the ±X axis, heat-producing boxes mount to radiator panels, the tank fits inside the thrust tube |
| `core/light-math` | **wave 2 · F0** | LIGHT PHYSICS core (three-less, pure). Colour has exactly three legal sources and no fourth: TEMPERATURE (`blackbodyRGB` — Planck → CIE 1931 via the published Wyman/Sloan/Shirley analytic fit → linear sRGB; measured against the published Planckian locus, Δxy < 0.0016 for T ≥ 2856 K, and a 6504 K body is deliberately NOT (1,1,1) because a 6504 K Planckian is not D65 — the white-balanced variant is opt-in and declared), CHEMISTRY (`emissionLineRGB`, e.g. CH 431 nm, C₂ 516 nm, Xe 462 nm, the aurora's 557.7 nm) and REFLECTION (`reflectedRGB`). `blackbodyRGB` also takes a Doppler factor and a gravitational redshift, so an accretion disc's approaching edge goes blue by the same formula that makes its receding edge red. ENVIRONMENT is enforced, not advisory: `envAllows(phenomenon, env)` refuses an open flame in vacuum or on Mars (no oxygen), a visible beam in vacuum (nothing to scatter from) and smoke in vacuum — and every refusal carries a REASON and a SUGGESTION, because a silent drop misrepresents the scene. Units are physical throughout (lux for directional, candela with decay 2 for point/spot, EV100 exposure, `illuminanceAt` = I/d²); the eye/camera adaptation is a first-order exponential, which is cadence-exact and cannot overshoot — the stateless critically damped form was measured to lose its damping entirely as the step shrank. `flickerField` is the ONE shared flicker: flame, plume, sparks, light and shadow read the same value, pink (1/f) by construction with log-spaced components at constant amplitude. `PROPELLANTS` gives seven real chemistries their colour, opacity and smoke (cold gas draws NO plume at all). Validated by `scripts/validate-light.mjs` (57 checks, including a white-noise control on the spectrum measurement itself) |
| `life_signs` | **wave 2 · F0–F2** | BREATHING library — the shared answer to "make it feel alive" that does NOT add motion. `core/life-signs.mjs` (three-less, pure f(t, seed)): φ-derived oscillator bank, a roughness envelope that is the product of two incommensurable sines in [0.55, 1] (**never a single sine**), a pre-generated Poisson event schedule, a CLOSED-FORM critically damped saccade whose rate limit comes from actuator physics (ω = min(ωMax, rateMax·e/|e₀|), so a bigger step simply takes longer), `segmentChain` (a segment starts where the previous one ACTUALLY ended — treating it as "the previous target" produced a 39 000°/s jump), gaze program, event envelope, counter-breath, and `stationKeeping` — the migration of `cinematic_space/spatial-idle.mjs`, reproducing it to 1e-12 so a scene can switch library without a single pixel moving. `life_signs/catalog.mjs` names 22 behaviours with the REASON each one is a real idle behaviour; `roverArmTwitch` is a REJECTED row (a real rover's arm is braked when idle). `budget.mjs` enforces the attention budget (Σ salience ≤ 1.0, at most 3 noticeable, proximity raises salience so a close-up affords FEWER breathing things) and refuses the forbidden classes (terrain, field lines, orbit trails, shadow under fixed light, idle HUD). `bind.mjs` writes channels as SECONDARY offsets over a base pose. `scripts/validate-life-signs.mjs` (34 checks) tests the repeat period with continued-fraction convergents (> 120 s), amplitude and scene budgets, rate limits, forbidden binding, determinism/cadence, discontinuity by delta-vs-step-size scaling, and the spatial-idle equality |
| `physical_rigs` | **wave 2 · F0–F2** | Mechanism DRIVER + terrain-coupled drive SHOWCASE (three-less core): `rig-core.mjs` reads `userData.rig`, drives every named joint like a real actuator — closed-form critically-damped step (cadence-independent), rate limit, range clamp, one-way (honeycomb stroke, burn-wire deploy), spring deploy (ζ 0.25, stops on the hard stop), spin with rpm ramp + stroboscope rule (spoke frequency > 0.4·fps → blur disc), translate (stroke, stage separation); pure solvers `solveRockerBogie` (differential pitch = mean), `ackermann` (turn-in-place), `wheelAdvance` (ω = v/r, slip). `choreography.mjs`: per-craft programs as pure f(t). Consumed by the craft showcase (Mekanizma/Etiketler). **F2 (2026-09-23):** `rover-drive.mjs` seats the rover on a REAL heightfield in one closed-form pass (measured contact residual 1.9 mm on a 4.2-unit rover); `terrain-treadmill.mjs` is a seamless periodic ground — height AND slope match at the tile seam (1.8e−15 / 1.6e−14), and the loop closes on an integer number of wheel revolutions (travel = 2π·r_outer·N) so cleats never jump; `ground-treadmill.mjs` builds the tiled mesh, periodic procedural colour+bump texture, seeded rock field, wheel-rut ribbon and contact shadow. Own showcase at `physical_rigs/index.html`. `scripts/validate-rigs.mjs` (64 checks) in CI. Not yet: dust, arm IK, tracker, route following (plan F3–F4). **Lesson ported from the Night Traverse deck scene:** the rolling radius is the CLEAT OUTER CORNER, not the nominal rim — an 8 % error reads on screen as "the wheel is slipping" |
| `stage_separation` | **wave 2** | Two-stage launch WITH SOLID BOOSTERS, staged for CINEMATIC CAPTURE: the whole timeline (Max-Q, MECO, separation, SES, fairing, SECO) is DERIVED from `launch_ascent/ascent-model.mjs`, never authored. Staging is a hand-off, not an animation — `stage1` is released into the scene and lives its own ballistics via `physical_rigs/jettison.mjs` (closed form, so any t is reachable without stepping: the time slider and `?t=` are exact); grid fins deploy on the discarded booster; the fairing leaves as two tumbling halves. A director cuts on the derived events and the separation framing DERIVES its distance from the required half-height so both bodies stay in frame. `?sinema=1` strips the UI and drops a 2.39:1 matte. Two strap-on SRBs burn out at 69 s and are jettisoned at 71 s (solids cannot be throttled or shut down, so they are sized to finish early and leave). The ascent model gained an optional `boosters` band (thrust, mass, added frontal area, burnout, jettison) and a SEPARATE pitch program `SRB_PROFILE` — a higher T/W launcher needs an earlier, larger kick, and the default 3.2° leaves the boosted vehicle climbing at γ = 69° at MECO with no orbit (measured). Declared: 1 unit = 20 m, relative-frame jettison with constant −a₂, dawn sky is a cinematic choice |
| `lunar_descent` | **wave 1** | Powered descent to the lunar surface: braking + vertical phases integrated against lunar gravity, throttle-scaled plume, touchdown dust, alt/vy/fuel HUD, chase/side/surface cameras |
| `site_plan` | **wave 2** | SITE LAYOUT SOLVER over the terrain library: `terrain_blocks/site-plan.mjs` (three-less, DOM-less, deterministic) names 11 siting RULES with the accident each one prevents — reactor ≥ 1 km, landing pad ≥ 500 m with a ±30° ejecta cone kept clear, fuel ↔ O₂ ≥ 50 m, radiator backing the Sun, solar field out of shadow, garage ≤ 150 m for walk time, ISRU upwind (Mars only), slope threshold, no overlap. Hard rules ELIMINATE candidates, soft rules SCORE them by weight; a module that no candidate satisfies is still placed but reported as `zorlandi` — never silently dropped. Per-module preferred radius bands keep the soft rules from being left to chance. The page shows the measured value beside every target, modules can be dragged to override the solver, and the resulting `clearings` feed straight into `createTerrainField({ clearings })` so the graded site is visible on real terrain. Each clearing levels to its OWN local datum (a single global datum carved a module 1 km out down to the origin's elevation). Slope is measured on NATURAL ground, before grading is written back. Validated by `scripts/validate-site.mjs` (28 checks) |
| `terrain_blocks` | **wave 2 · F0–F3** | Terrain LIBRARY (no mount; the terrain twin of craft_blocks): `createTerrainField` composes NAMED phenomena — Pareto (b = 2) crater population with erosion age, complex craters (central peak, terraces) and overlap; basin-ring massifs (ridged multifractal, domain-warped); asymmetric wrinkle ridges; canyon (wall, floor channel, landslide fans); barchan dunes (Mars only — the planet gate rejects them on the Moon); layered mesa; sinuous rille; pit crater; fBm; cm-scale micro-relief; sampled Lunaris relief as base. Real-radius sagitta (1 unit = 100 m), clearings (rover pad, drivable corridor ≤ 15°, site polygon), thermal-erosion slope clamp to the 35° angle of repose with hard rock exempt — and the clamp is written BACK into the analytic field so mesh and query agree (< 1 mm, validated). Polar mesh with static LOD, Lambert regolith material (slope/height albedo, four-tap detail ladder, region albedo with crater rays, overlay hook), blue-noise rock/pebble scatter tilted to the local normal, and the query API `height / normal / slopeDeg / contact / raycastDown / nearestRocks / rockAt` that rigs, figures and shadows consume. Profiles: moon-mare, moon-highland, moon-polar-rim, mars-plain, mars-canyon, generic-rocky. Validated by `scripts/validate-terrain.mjs`. Not yet (plan §13 F4 + open decisions): CSM cascades, corridor strip mesh, surface-scene migration flag. Design doc: docs/terrain-system-plan.md |
| `launch_ascent` | **wave 2** | REAL integrated ascent: US76 atmosphere (co-rotating), C_D(M) drag, pressure-dependent Isp, vertical → pitch kick → gravity turn (α = 0) → closed-loop 2nd-stage pitch → SECO; Max-Q/MECO/SECO DERIVED from the trajectory, q(t) chart + event rail, loss budget, pad/chase/wide director, craft_blocks rocket + plume. Solver pure (`ascent-model.mjs`), validated by `scripts/validate-astro.mjs` |
| `rendezvous_docking` | **wave 2** | Clohessy–Wiltshire relative motion in target-centred LVLH: V-bar / R-bar approaches, hold points (V-bar natural, R-bar thrusted), CW two-impulse hop (Φ_rv⁻¹ targeting), KOS, ±10° corridor, Hablani glideslope, LOS/closing-rate HUD, contact; the "push toward target" lesson. Shared solver `core/astro-relative.mjs` |
| `ground_track_3d` | **wave 2** | Same orbit in two synchronized views: inertial Kepler orbit over a rotating Earth (sub-satellite point, nadir line, track painted on the sphere) + unwrapped equirectangular ground track with clean longitude wrapping; element sliders change the track through the real ECI→ECEF→lat/lon transform; optional J2 secular rates; presets ISS/SSO/polar/Molniya/GPS/GEO/Tundra. Shared solver `core/astro-orbit.mjs` |
| `porkchop_explorer` | **wave 2** | REAL mission analysis: every departure×arrival cell is a Lambert solve (universal variables, short/long way) on JPL approximate planetary elements (Standish); C3 / v∞ / ΔV surfaces, marching-squares contours, TOF isolines, grid minimum, crosshair selection, side panel with the selected heliocentric transfer arc (Kepler propagation) and v∞ arrows. Shared solver `core/astro-lambert.mjs` |
| `constellation_coverage` | **wave 2** | Walker Delta/Star generated from i:T/P/F parameters: orbital planes, satellites (InstancedMesh), coverage cones, surface footprints, multiplicity painting (uncovered / 1 / 2 / 3+), 2D map, instantaneous coverage + mean multiplicity + station visibility, time-scan revisit statistics (max gap, continuous fraction). Footprint λ = acos(R/(R+h)·cos ε) − ε validated (GPS 71,2°, Iridium 19,9°) |
| `reentry_corridor` | **wave 2** | Planar entry dynamics (RK4, US76, L/D, bank) with Sutton–Graves heating; corridor bounds FOUND by γ sweep + bisection (overshoot = shallowest capture with lift down, undershoot = steepest within n_max/q̇_max with lift up); (h,v) plane with closed-form iso-g / iso-heat curves and boundary trajectories, corridor bar with sweep outcomes, altitude–range profile, event rail. Lunar-return capsule corridor ≈ Apollo (2,3°) in validation |
| `cr3bp_lagrange` | **wave 2** | Circular restricted three-body problem in the rotating frame: L1–L5 SOLVED from ∇Ω = 0 (residuals shown), effective potential field, zero-velocity curves + forbidden regions for a chosen Jacobi constant (neck opening order L1→L2→L3→L4/5 on a slider), RK4 test particle with live Jacobi conservation, L1/L2 planar Lyapunov families (STM differential correction + amplitude continuation), rotating ↔ inertial comparison. Halo families not yet (declared). Solver `core/astro-cr3bp.mjs` |
| `gravity_assist` | **wave 2** | Patched-conic gravity assist with the two frames kept visually separate: planet-relative hyperbola (asymptotes, periapsis, δ = 2 asin(1/e), B-plane line + B vector, moving craft), heliocentric view (before/after orbits, velocity triangle V = V_p + v∞ on the |v∞| circle, ΔV = 2v∞ sin(δ/2), ΔE = V_p·Δv∞), B-plane target view (T̂/R̂, impact circle, B·T/B·R). Tisserand conservation validated |
| `attitude_gnc` | **wave 2** | REAL rigid-body attitude dynamics: Euler equations with reaction wheels (τ_max, h_max saturation), quaternion kinematics (RK4, unit norm), quaternion-feedback PD (K_p = Iω_n², K_d = 2ζω_n I); modes: slew, free tumble (Dzhanibekov intermediate-axis instability with T/|H| conservation), wheel saturation under external torque, gimbal lock (3-2-1 rate matrix 1/cos θ), SLERP vs Euler interpolation; body/inertial triads, target ghost, boresight cone, wheel bars, rate/error/Euler plots |
| `orbit_perturbations` | **wave 2** | Numerical perturbation comparison against two-body: RK4 with J2 (nodal regression, apsidal rotation, SSO, critical inclination), drag (exponential-table thermosphere, rotating atmosphere), SRP (cannonball, cylindrical shadow), lunar+solar third body (GEO inclination drift); osculating vs running-mean vs analytic secular curves, orbit fan + node line in 3D, numerical/analytic rates in the HUD |
| `eclipse_geometry` | **wave 2** | Eclipse / occultation / visibility from geometry only: conical shadow function with finite Sun disk (umbra/penumbra entry & exit by bisection), β angle and cylindrical limit, ground-station AOS/LOS on a rotating Earth, sensor (star) and relay-link occultation via segment–sphere tests with an atmosphere tangent threshold; 3D shadow cones + event bands + ν(t)/ε(t) |
| `conjunction_covariance` | **wave 2** | Conjunction assessment where the uncertainty geometry is the content: TCA found by range minimisation, encounter frame ⊥ v_rel, RTN covariances rotated, summed and projected to the encounter plane (1/2/3σ ellipses, Mahalanobis), 2D collision probability over the hard-body disc (short-encounter Gaussian model, limits validated), dilution curve P_c(k), decision threshold |
| `free_return` | **wave 2** | Lunar free-return trajectory in the Earth–Moon CR3BP: LEO departure with TLI ΔV and phase angle, adaptive-step propagation, perilune and return perigee measured, (ΔV, θ₀) scan plus per-row bisection to the 100 km return-perigee solutions, rotating and inertial views, corridor sensitivity (0.3° → > 500 km); Apollo-scale numbers validated |
| `core/lab-three.mjs` · `core/lab-scene.mjs` | **shared** | Scene imagery helpers used by every wave-2 lab: 2D `planet()` (sun-offset shading, night side, lit limb, atmosphere halo, rings), `sun()`, `starfield()`, `glow()`, `colorLine()` with `heat`/`speed`/`cold` ramps, `band()`, `shadowBand()`; three.js `atmosphereShell()` (fresnel), `glowSprite()`/`fitGlow()`, `sunGlow()`, `addEarth()` (textured + atmosphere), `starfield()`. Rule: every helper encodes a phenomenon (terminator from the Sun vector, colour from a physical quantity) — never decor |
| `three_body_states` | **wave 2** | Gallery of periodic planar three-body solutions (Šuvakov–Dmitrašinović 2013 families, Lagrange equal/unequal masses, Euler, Broucke A2) plus the chaotic Pythagorean problem, each integrated live (RK4, adaptive step ∝ d_min^1.5); glowing bodies with fading comet trails over the faint full-period path, black ground, additive light; periodicity (return error), energy and angular-momentum conservation validated per orbit |
| `soi_explorer` | **wave 2** | Sphere of influence explorer: Laplace r_SOI = a(m/M)^(2/5) and Hill sphere computed from GM/a and drawn to scale in three.js (textured Earth/Moon, fresnel shells, dashed Hill ring, distance-scaled glow points), park-orbit departure hyperbola to a target v∞ (progressive Line2, probe on the timeline), frame hand-off pulse at the SOI shell, patched-conic residual |v(r_SOI)| − v∞, log–log Laplace acceleration-ratio panel with numerical crossing (≈ 0.87 r_SOI), planetary SOI scale bars; literature radii, energy and monotonicity validated |
| `launch_window` | **wave 2** | Launch window and azimuth geometry: inertial azimuth from sin β = cos i / cos φ (ascending/descending), Earth-rotation correction and ΔV saving, local-sidereal-time launch opportunities (two per day, UTC), range-safety sector check, delay → nodal shift → plane-change ΔV → window width for a ΔV budget; infeasible (i < φ) cases flagged as dogleg; Vallado example values validated |
| `geo_stationkeeping` | **wave 2** | GEO station-keeping budget: east–west drift from the real EGM96 C̄22/S̄22 (gravity_field) with equilibrium longitudes found as roots (stable 75.1°E / 104.9°W), annual ΔV(λ), libration period and free-drift trajectory; north–south from a one-year Moon+Sun RK4 propagation (orbit_perturbations) → inclination-vector trace, Δi ≈ 0.86°/yr, ΔV ≈ 46 m/s/yr; SRP eccentricity circle; lifetime propellant chemical vs electric |
| `entry_dispersion` | **wave 2** | Entry Monte Carlo on the reentry_corridor core: seeded Gaussian dispersions in flight-path angle, velocity, density scale, L/D, mass and bank → downrange histogram (p05/p50/p95, ±3σ), peak-g and heat-load statistics, trajectory fan with landing points, one-at-a-time sensitivities and linear-RSS vs Monte-Carlo σ (linearity ratio validated 0.7–1.3), skip-out counting |
| `tisserand_graph` | **wave 2** | Tisserand graph for multi-flyby design: planet constant-v∞ contours in the (r_a, r_p) plane, planet lines, Earth resonance curves, flyby = slide along the contour bounded by δ_max from a minimum altitude; greedy sequence planner (VEEGA, VVEJGA, direct Jupiter, Mars free return, Jupiter–Saturn) with per-leg v∞/α/Δα table and heliocentric leg ellipses; no phasing (qualitative tool, dates via porkchop_explorer) |
| `low_thrust_transfer` | **wave 2** | Low-thrust (electric) transfer lab: continuous tangential-thrust spiral with variable mass (RK4, step grows with the orbit), Edelbaum analytic ΔV (coplanar and with inclination change via the Edelbaum yaw law), Hohmann and Tsiolkovsky comparison, cylindrical-shadow duty cycle; numerical spiral matches Edelbaum within 0.5 % in validation, e_max and T/W flag where the near-circular assumption strains |
| `orbit_determination` | **wave 2** | Orbit-determination lab: truth (two-body + J2, RK4) tracked by rotating ground stations with range / range-rate (elevation mask, seeded Gaussian noise); extended Kalman filter with finite-difference STM, continuous white-acceleration Q, analytic H, Joseph update; consistency statistics NEES / NIS validated, scenarios for observability (range-only, rate-only, GEO single station), model error (filter without J2 → divergence) and large a-priori error (EKF overconfidence); ECI view with 3σ ellipse, error/3σ envelopes, normalised innovations |
| `halo_manifolds` | **wave 2** | Halo orbits and invariant manifolds in the CR3BP rotating frame (3D): Richardson third-order guess + 6×6 STM differential correction, Az-continued family with step halving, planar Lyapunov comparison, monodromy eigenvectors → stable/unstable manifold bundles (forward / time-reversal backward), spacecraft marker on the halo, x–y and x–z projections; Sun–Earth L2 halo (Az 110 000 km) matches literature x₀/period, det Φ = 1 and ε-growth ≈ λ_u validated |
| `transfer_explorer` | **wave 2** | Lambert transfer explorer on the shared universal-variable solver: r1, r2, Δθ, TOF → transfer arc (Kepler-propagated, endpoint residual ~1e−7 km), v1/v2 and ΔV vectors from circular orbits, a/e/r_p/r_a; log-TOF sweep of short/long-way ΔV with the closed-form Hohmann reference (Δθ → 180° limit matched to 1e−4 in validation); presets LEO→GEO, Earth→Mars/Jupiter/Venus |
| `gravity_field` | **wave 2** | Spherical-harmonic gravity field: fully normalised P̄_lm (stable recursion, orthonormality validated), degree/order, truncation and single-degree contribution, geoid height (Bruns, GRS80 normal field removed) and free-air anomaly painted on the sphere with exaggerated displacement, 2D map, degree-variance spectrum vs Kaula; low-degree coefficients real (EGM96 rounded), the rest explicitly SYNTHETIC; C̄20-only node drift cross-checked against the J2 rate |
| `formation_flight` | **wave 2** | Chief/deputy CW relative orbits in LVLH: PCO / GCO / in-plane 2:1 ellipse / leader–follower (GRACE-style) / drift-free-condition violation; multi-deputy, closed traces, three orthogonal projections, separation table (ρ, R/V/H, min–max, secular drift). Shares `core/astro-relative.mjs` with rendezvous_docking |

### ML — Veri/Öğrenme Sahneleri (`assets/ml-*`)

| Block | Status | What it is |
|---|---|---|
| `ml_loss_landscape` | **wave 1** | 3D loss surface (analytic composite), REAL optimizer integration on its gradient: SGD vs momentum vs Adam trails racing to minima |
| `ml_attention_flow` | **wave 1** | Transformer attention as animated weighted arcs over token strips — real softmax over deterministic embeddings, layer stepping |
| `ml_layer_blocks` | **wave 3** | THE layer LIBRARY (no mount, frozen API — the ML twin of craft-blocks): conv/pool/dense/flatten/norm/activation/attention/residual/input/output builders; type readable from GEOMETRY not colour; every block carries its own in→out shape and parameter count |
| `ml_net_builder` | **wave 3** | THE core ML stage (the ML twin of orbital-stage): give it a declarative architecture, it assembles the net BLOCK BY BLOCK; real shape inference `out=⌊(in+2p−k)/s⌋+1`, verified parameter counts (small CNN = 225,034, matches Keras MNIST exactly), user-editable architecture, forward-pass pulse, camera director |
| `ml_conv_vision` | **wave 3** | Image → sliding kernel → feature maps → pooling → ReLU → decision, with the convolution ACTUALLY computed: the 3×3 patch, all nine products, their sum and the born output pixel are on screen; stride/padding change and the size formula is verified live |
| `ml_loss_functions` | **wave 3** | Loss gallery + comparison: MSE/MAE/Huber/log-cosh, cross-entropy/hinge/focal — curve AND derivative, outlier drag showing MSE blowing up while Huber holds, same data trained under different losses |
| `ml-embedding-projector-preset` | wave 4 | 3D point-cloud embedding space: cluster morph, semantic axis sweep |
| `ml-graph-message-preset` | wave 4 | Graph neural net message passing: pulses along edges, node state updates |

(`neural_network` — feed-forward walkthrough — already exists and stays.)

**Wave 3 was user-driven** (2026-08-14): "ML animasyonlarını beğenmedim. Katmanlama, loss
fonksiyonları ekleme blok blok istenen yapı getirme. CNN gibi görüntü işleme şeylerini
ekleme yok." The lesson generalises: a category is only finished when you can COMPOSE with
it (declare a structure, get it built), not when it has a few standalone scenes. The
frozen-API + placeholder-fallback contract that made the ORBITAL wave parallelisable was
reused verbatim here and worked again — net-builder was coded and verified against a
placeholder while layer-blocks was still being written.

## The frozen craft API (blocks compose against THIS)

`craft_blocks/craft-blocks.mjs` exports pure builders (no mount, no
rAF, no textures fetched — geometry + materials only):

```js
buildOrbiter({ scale=1, palette })   // bus + 2 solar wings + HGA dish + engine
buildLander({ scale=1, palette })    // descent stage: 4 legs, tanks, engine bell
buildRocket({ stages=2, scale=1, palette }) // stacked stages + interstage + fairing
buildCubesat({ units=3, scale=1, palette }) // rail-edged Nu, deployable panels
buildCapsule({ scale=1, palette })   // crew capsule + service module
```

- Return: `THREE.Group`, unit-ish size (longest dimension ≈ 1×scale), origin
  at geometric center, **+X = forward/velocity, +Z = up/dish side, main
  engine thrust exits −X**.
- **Surfaces (2026-09-24):** textures are never FETCHED, but `craft-surface.mjs`
  may GENERATE them on a canvas (seeded, offline) — ring welds, stringer
  shadows, cryo insulation/frost band, roll pattern, hatch frames, and the
  segment joints of a solid booster. Writing those as geometry explodes the
  mesh; a launcher body is not a plain white cylinder. `buildRocket({ boosters,
  surface })` takes 0–4 strap-on solids; each is a named jettisonable group
  `srb{i}` listed in `root.userData.jettison`.
- `palette = { body:0x…, panel:0x…, accent:0x…, metal:0x… }` optional; the
  defaults are the obsidian-champagne family. MeshStandardMaterial, restrained
  metalness/roughness — premium satin, no toy plastic, no emissive gimmicks.
- Consumers import via relative path and MUST degrade to a simple placeholder
  group if the import fails — blocks never hard-depend on each other.
- **Parts contract (2026-09-23, physical_rigs F0 — `docs/physical-rigs-plan.md` §2).**
  Every moving part is a NAMED `THREE.Group`; `root.userData.rig` carries
  `{ kind, units:'design', scaleToRoot, joints, contacts, massClass }` where
  `joints[name] = { node, axis:'x'|'y'|'z'|['y','z'], range:[lo,hi], deg:true,
  rateDegS?, mode?:'translate', dir?, oneWay?, spin?, radius?, rpm?, spokes?, found }`.
  A joint group has identity rotation at zero angle and its local axes coincide
  with the design axes; if an orientation is needed an OUTER orientation group
  carries it and the joint stays inside. `found:false` means the node name is
  missing (a bug, never silent). Consumers that cannot find a node fall back to
  static (surface-scene behaviour). Every builder also sets
  `root.userData.notes = { regime, why }` — the engineering reason for each
  visible mechanism; the showcase prints it for the focused craft.
  Rover: `rockerL/R → bogieL/R → wheel*`, corner `steer*`, `mastPan/mastTilt`,
  `armJ1..J3/armTurret`, `hgaAz/El`, `differential`. Orbiter: `wingL/R` (SADA),
  `hgaAz/El`, `engineGimbal`, `louvers`. Lander: `leg{i}Stroke` (one-way
  translate), `engineGimbal`, `sbandAz/El`. Rocket: `engineGimbal`, `gridFin{i}`,
  `leg{i}`, `stage2` (translate), `fairingL/R`. Capsule: `hatch`, `smWing{i}`,
  `engineGimbal`. Cubesat: `wingL/R`. Starship: `flapF*/R*`, `engineSL{i}`.
  Helicopter: `rotorAlt/rotorUst` (spin, rpm, spokes). Rocket also exposes
  `root.userData.jettison = ['stage1','fairingL','fairingR']` — the named
  groups a consumer may hand to the scene at staging.
  **Driving the contract:** `physical_rigs/rig-core.mjs` → `createRig(root.userData.rig)`,
  `rig.set(name, target)`, `rig.advance(dt)`, `rig.apply(root)`; consumers never
  touch `node.rotation` by hand. surface-scene now finds the rover mast by name
  (`mastPan`) instead of position matching (the F0 lesson).

## Quality bar (what "manim-grade" means here)

- Physics honest at the stated truth level; the manifest names model AND
  limitations. A Hohmann arc is a real conic; a descent profile integrates
  real gravity; optimizer trails follow the real gradient.
- Deterministic: seeds in, same frames out; `advance(dt)` external drive;
  export/reduced freeze on a documented tableau.
- One light logic per scene, palette tokens for every UI element, deck
  typography for HUDs — a block must look native inside any saved theme.
- Cameras are directed, not free-floating: every mode has a purpose and a
  smooth transition; no camera motion without explanatory value.
- Verified by SCREENSHOT, not by assertion — headless renders reviewed
  before a block is called done.


## Eksen kuralı (2026-08-15) — beş hatanın ardından konuldu

three.js'te `CylinderGeometry`, `LatheGeometry` ve `ConeGeometry`'nin ekseni
**her zaman +Y**'dir. Blok sözleşmesi ise +X ileri, +Z yukarı der. Bu çeviriyi
her çağrı yerinde elle yazmak tek bir oturumda **beş** ayrı hataya yol açtı:

| Nerede | Ne oldu |
|---|---|
| uçak dikey kuyrukları | beş araçta birden aşağı sarktı |
| Starship burnu | yarıçap ters yönde büyüdü, kâseye döndü |
| Mars helikopteri mili | döndürülmediği için yatay durdu |
| derin uzay sondası çanağı | R_x(−90°) ile aşağı baktı |
| gezgin tekerlekleri | aks yukarı gidip tabak gibi yattılar |

**Beşini de kullanıcı ekran görüntüsüyle buldu.** Kod hiçbir yerde şikâyet
etmedi, çünkü ters bir dönüşüm sözdizimsel olarak kusursuzdur.

`LatheGeometry`'de ikinci bir tuzak var: normaller profilin **sırasına**
bağlıdır. y azalarak giden bir profil, normalleri içe bakan bir yüzey üretir
ve yüzey ters aydınlanır — nasel kaportası, Starship burnu ve sonda çanağı
bu yüzden siyah çıkmıştı, üçünde de palet açık renkti.

### Kural

Çıplak kurucu **yasak**. Adlandırılmış eksen yardımcıları kullanılır;
tek kaynakları **`presets/core/geometry-axis.mjs`** (önce craft/aircraft
içinde iki kopya yaşadılar; ayrışmasınlar diye core'a taşındılar —
`presets/core/`, `moon_advanced/vendor/` gibi paylaşılan ALTYAPIDIR ve
bloklar ona sert bağımlı olabilir; blok-bloka sert bağımlılık yasağı
altyapıyı kapsamaz):

```js
import { cylX, coneZ, latheZ } from '../core/geometry-axis.mjs';

cylX / cylY / cylZ      // silindir — adında hangi eksen yazıyorsa o
coneX / coneZ           // koni — tepe eksenin POZİTİF ucunda
latheZ / latheX         // lathe — profil sırası İÇERİDE düzeltilir
```

`latheZ`/`latheX` profili gerekirse kendisi çevirir; çağıran sırayı düşünmez.
Böylece ters normal **üretilemez hâle gelir** — belgelenmiş bir uyarı değil,
yapısal bir imkânsızlık.

### Denetim

```
python scripts/eksen-denetimi.py           # özet
python scripts/eksen-denetimi.py --liste   # satır satır
```

Yardımcıların kendi gövdeleri muaftır. **Kuralın konduğu andaki envanter:
65 çıplak kurucu, 11 dosyada.** Bu sayı bilerek sıfırlanmadı: çalıştığı
doğrulanmış geometriyi toplu hâlde yeniden yazmak, kapatmaya çalıştığımız
hatanın ta kendisini üretir. Kural **yeni** kod için bağlayıcıdır; mevcut
çağrı yerleri ancak o dosyaya zaten dokunulduğunda taşınır. Sayının zamanla
düşmesi beklenir, sıçraması ise yeni kodun kuralı atladığı anlamına gelir.
