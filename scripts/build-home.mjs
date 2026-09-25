#!/usr/bin/env node
/* build-home.mjs — generates the root index.html from presets/registry.json.
 *
 * Why generated: the landing page is the only way into 65 scenes once the
 * repo is served from a host with no directory listing. A hand-written list
 * drifts the first time a preset is added and nobody notices, because the
 * page still looks fine - it is just missing a scene. Here the list comes
 * from the same inventory the rest of the repo is checked against, and
 * `--check` fails CI when the committed page no longer matches.
 *
 *   node scripts/build-home.mjs            write index.html
 *   node scripts/build-home.mjs --check    exit 1 if it is stale
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registry = JSON.parse(fs.readFileSync(path.join(root, 'presets/registry.json'), 'utf8'));

/* Seven groups, declared. Not derived from the name prefix: `gravity_field`
   and `gravity_assist` share a prefix and belong in different places, and a
   taxonomy that is wrong is worse than one that is explicit. Every preset
   that has a page must appear exactly once - asserted below, so adding a
   preset without filing it fails the build instead of silently vanishing
   from the page. */
const GROUPS = [
  { id: 'orbits', title: 'Orbits and trajectories',
    blurb: 'Transfers, perturbations, three-body structure, determination and conjunction.',
    members: ['conjunction_covariance', 'constellation_coverage', 'cr3bp_lagrange', 'eclipse_geometry',
      'formation_flight', 'free_return', 'geo_stationkeeping', 'gravity_assist', 'gravity_field',
      'ground_track_3d', 'halo_manifolds', 'launch_window', 'low_thrust_transfer', 'lunar_orbit',
      'orbit_determination', 'orbit_perturbations', 'porkchop_explorer', 'rendezvous_docking',
      'soi_explorer', 'three_body_states', 'tisserand_graph', 'transfer_explorer'] },
  { id: 'flight', title: 'Launch, entry and staging',
    blurb: 'Getting off a surface, getting back onto one, and what separates in between.',
    members: ['attitude_gnc', 'entry_dispersion', 'launch_ascent', 'lunar_descent', 'orbital_stage',
      'reentry_corridor', 'stage_separation'] },
  { id: 'vehicles', title: 'Vehicles and assemblies',
    blurb: 'Hardware: how it is built, what it mounts to, and what it is made of.',
    members: ['aircraft_blocks', 'comms_antenna', 'comms_link_budget', 'craft_blocks', 'exploded_view',
      'habitat_blocks', 'mechanism_lab', 'physical_rigs', 'satellite_integration', 'site_plan'] },
  { id: 'worlds', title: 'Worlds and environments',
    blurb: 'Surfaces, atmospheres, skies and the light that falls on them.',
    members: ['aurora', 'cinematic_space', 'cosmos_advanced', 'earth_advanced', 'jwst_explorer',
      'moon_advanced', 'planets_advanced', 'sun_advanced', 'terrain_blocks'] },
  { id: 'aero', title: 'Aerodynamics',
    blurb: 'Flow that can be drawn because it can be computed.',
    members: ['aero_airfoil_flow', 'aero_shock_waves', 'aero_vortex_street'] },
  { id: 'ml', title: 'Machine learning',
    blurb: 'Architectures and loss surfaces, shown rather than asserted.',
    members: ['ml_attention_flow', 'ml_conv_vision', 'ml_layer_blocks', 'ml_loss_functions',
      'ml_loss_landscape', 'ml_net_builder', 'neural_network'] },
  { id: 'craftwork', title: 'Motion, light and layout',
    blurb: 'The shared machinery: idle behaviour, physical light, equations, callouts, decks.',
    members: ['deck_starter', 'equation_pen', 'equation_steps', 'figure_callouts', 'life_signs',
      'light_blocks', 'timeline_tree'] },
];

const withPage = registry.presets.filter(p => p.hasIndex);
const byName = new Map(withPage.map(p => [p.name, p]));

/* Completeness, both ways. */
/* ── English titles ───────────────────────────────────────────────────
   Forty-six scenes carry a Turkish <title>, so the catalogue read in one
   language while its own chrome read in another. The English name is
   declared here, beside the grouping, and the page ships BOTH: the reader
   picks. A scene with a page and no entry here fails the build, so a new
   one cannot arrive half-translated.
   Scenes already named in English are absent and fall through to their
   own title. */
const TITLE_EN = {
  aero_airfoil_flow: 'Flow Around an Aerofoil',
  aero_shock_waves: 'Shock and Expansion Waves',
  aircraft_blocks: 'Aircraft Blocks',
  attitude_gnc: 'Attitude and GNC Laboratory',
  aurora: 'Aurora - emission lines, altitude, activity',
  comms_antenna: 'Antenna and Ground Station',
  comms_link_budget: 'Link Budget and Bands',
  conjunction_covariance: 'Conjunction and Covariance',
  constellation_coverage: 'Constellation Coverage',
  cr3bp_lagrange: 'CR3BP and Lagrange Points',
  craft_blocks: 'Spacecraft Blocks',
  deck_starter: 'Science Deck Starter',
  eclipse_geometry: 'Eclipse, Occultation and Visibility',
  entry_dispersion: 'Entry Dispersion',
  equation_steps: 'Equation Steps - term by term',
  figure_callouts: 'Figure Callouts - step by step on a figure',
  formation_flight: 'Formation Flight',
  free_return: 'Lunar Free-Return Trajectory',
  geo_stationkeeping: 'GEO Station-Keeping Budget',
  gravity_assist: 'Gravity Assist and the B-Plane',
  gravity_field: 'Spherical-Harmonic Gravity Field',
  ground_track_3d: '3D Orbit and 2D Ground Track',
  halo_manifolds: 'Halo Orbits and Invariant Manifolds',
  launch_ascent: 'Launch and Ascent',
  launch_window: 'Launch Window and Azimuth',
  life_signs: 'Breathing Library',
  light_blocks: 'Light Physics',
  low_thrust_transfer: 'Low-Thrust Transfer Laboratory',
  lunar_descent: 'Powered Lunar Descent',
  mechanism_lab: 'Mechanism Laboratory',
  ml_attention_flow: 'Attention Flow',
  ml_conv_vision: 'Convolutional Vision',
  ml_layer_blocks: 'Layer Blocks',
  ml_loss_functions: 'Loss Functions',
  orbit_determination: 'Orbit Determination (EKF) Laboratory',
  orbit_perturbations: 'Orbit Perturbations',
  orbital_stage: 'Orbital Stage',
  porkchop_explorer: 'Porkchop and Launch Window',
  reentry_corridor: 'Re-entry Corridor',
  site_plan: 'Site Layout',
  soi_explorer: 'Sphere-of-Influence Explorer',
  stage_separation: 'Stage Separation',
  terrain_blocks: 'Terrain Blocks',
  three_body_states: 'Three-Body States',
  tisserand_graph: 'Tisserand Graph',
  transfer_explorer: 'Lambert Transfer Explorer',
};

const filed = GROUPS.flatMap(g => g.members);
const dupes = filed.filter((x, i) => filed.indexOf(x) !== i);
if (dupes.length) { console.error(`build-home: filed twice: ${dupes.join(', ')}`); process.exit(2); }
const missing = withPage.map(p => p.name).filter(n => !filed.includes(n));
if (missing.length) {
  console.error(`build-home: ${missing.length} preset(s) have a page but no group: ${missing.join(', ')}`);
  console.error('Add them to GROUPS in scripts/build-home.mjs.');
  process.exit(2);
}
const ghosts = filed.filter(n => !byName.has(n));
if (ghosts.length) { console.error(`build-home: grouped but no page: ${ghosts.join(', ')}`); process.exit(2); }

/* The registry title is "Human title — preset_name"; the tail repeats the
   folder we already print, so it is dropped. */
const cleanTitle = (t, name) => String(t).replace(new RegExp(`\\s*[—-]\\s*${name}\\s*$`), '').trim();
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* A scene whose own title is Turkish must declare an English one, or the
   catalogue goes out half-translated and nobody notices until a reader
   does. */
const trHarf = /[\u011f\u011e\u015f\u015e\u0131\u0130\u00e7\u00c7\u00f6\u00d6\u00fc\u00dc]/;
const ceviriYok = withPage
  .filter(p => trHarf.test(cleanTitle(p.title, p.name)) && !TITLE_EN[p.name])
  .map(p => p.name);
if (ceviriYok.length) {
  console.error(`build-home: ${ceviriYok.length} Turkish-titled scene(s) have no English name: ${ceviriYok.join(', ')}`);
  console.error('Add them to TITLE_EN in scripts/build-home.mjs.');
  process.exit(2);
}

const cards = (g) => g.members.map(name => {
  const p = byName.get(name);
  const tags = [p.animated ? 'animated' : 'static'];
  const tr = cleanTitle(p.title, name);
  const en = TITLE_EN[name] || tr;
  /* The filter searches BOTH, so a reader typing in either language finds
     the scene whichever way the page happens to be showing it. */
  return `        <a class="card" href="presets/${name}/index.html" data-find="${esc((tr + ' ' + en + ' ' + name).toLowerCase())}">
          <span class="card__t" data-en="${esc(en)}" data-tr="${esc(tr)}">${esc(en)}</span>
          <span class="card__n">${esc(name)}</span>
          <span class="card__m">${tags.join(' · ')}</span>
        </a>`;
}).join('\n');

const sections = GROUPS.map(g => `      <section class="grp" id="${g.id}" data-group>
        <h2>${esc(g.title)} <span class="grp__n">${g.members.length}</span></h2>
        <p class="grp__b">${esc(g.blurb)}</p>
        <div class="cards">
${cards(g)}
        </div>
      </section>`).join('\n');

const nav = GROUPS.map(g => `<a href="#${g.id}">${esc(g.title)}</a>`).join('\n        ');

const c = registry.counts;
const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Sunumatik — scene catalogue</title>
  <meta name="description" content="${c.presetsWithIndex} browser-native scenes for space, flight and machine-learning explanation. No build step, no tracking.">
  <link rel="icon" href="data:image/gif;base64,R0lGODlhAQABAAAAACw=">
  <style>
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body { margin: 0; background: #05070b; color: #dfe3ea; line-height: 1.6;
      font-family: "Segoe UI", system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
    a { color: inherit; text-decoration: none; }
    .wrap { max-width: 1120px; margin: 0 auto; padding: 0 20px 72px; }
    header { padding: 56px 0 8px; }
    h1 { margin: 0; font-size: 13px; letter-spacing: .16em; text-transform: uppercase;
      color: #c9a35c; font-weight: 600; }
    .lead { margin: 14px 0 0; font-size: 17px; line-height: 1.55; color: #eef1f6; max-width: 46em; }
    .sub { margin: 10px 0 0; font-size: 13px; color: #767d8c; max-width: 46em; }
    .bar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin: 26px 0 0; }
    .btn { display: inline-flex; align-items: center; min-height: 44px; padding: 0 16px;
      border-radius: 7px; font-size: 13px; font-weight: 600; border: 1px solid #272d39;
      background: rgba(14,17,24,.9); }
    .btn:hover { border-color: #c9a35c; }
    .btn--go { background: #c9a35c; border-color: #c9a35c; color: #10131a; }
    .btn--go:hover { background: #d9b978; }
    input[type=search] { min-height: 44px; min-width: 240px; flex: 1 1 240px; padding: 0 14px;
      border-radius: 7px; border: 1px solid #272d39; background: rgba(14,17,24,.9);
      color: #dfe3ea; font-size: 13px; font-family: inherit; }
    input[type=search]:focus { outline: none; border-color: #c9a35c; }
    nav { display: flex; flex-wrap: wrap; gap: 8px 18px; margin: 30px 0 0;
      font-size: 13px; color: #767d8c; }
    nav a:hover { color: #c9a35c; }
    .grp { margin: 52px 0 0; }
    h2 { margin: 0; font-size: 13px; letter-spacing: .14em; text-transform: uppercase;
      color: #c9a35c; font-weight: 600; }
    .grp__n { color: #767d8c; letter-spacing: 0; font-weight: 400; }
    .grp__b { margin: 6px 0 0; font-size: 13px; color: #767d8c; }
    /* Language switch. Two segments, one accent, 44 px targets - it is a
       setting, not an action, so it does not compete with the filter. */
    .lang { display: inline-flex; border: 1px solid #272d39; border-radius: 7px; overflow: hidden; }
    .lang button { min-height: 44px; min-width: 52px; padding: 0 14px; border: 0; cursor: pointer;
      background: transparent; color: #9aa2b1; font: inherit; font-size: 12.5px; letter-spacing: .04em; }
    .lang button[aria-pressed="true"] { background: rgba(201,163,92,.14); color: #f0e2c4; }
    .lang button + button { border-left: 1px solid #272d39; }
    .cards { display: grid; gap: 10px; margin: 16px 0 0;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); }
    .card { display: block; min-height: 44px; padding: 13px 15px 14px; border-radius: 7px;
      border: 1px solid #1b202a; background: #080a0f; }
    .card:hover { border-color: #c9a35c; background: #0c0f16; }
    .card__t { display: block; font-size: 13px; font-weight: 600; color: #eef1f6; }
    .card__n { display: block; margin-top: 3px; font-size: 12px; color: #767d8c;
      font-variant-numeric: tabular-nums; }
    .card__m { display: block; margin-top: 6px; font-size: 12px; color: #5d6472;
      letter-spacing: .04em; }
    .empty { display: none; margin: 40px 0 0; font-size: 13px; color: #767d8c; }
    body.filtering .grp[hidden], body.filtering .card[hidden] { display: none; }
    footer { margin: 64px 0 0; padding-top: 22px; border-top: 1px solid #1b202a;
      font-size: 12px; color: #5d6472; }
    @media (max-width: 640px) {
      header { padding-top: 34px; }
      .lead { font-size: 15px; }
      .cards { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <h1>Sunumatik</h1>
      <p class="lead">${c.presetsWithIndex} self-contained scenes for explaining space, flight and machine learning &mdash; each one a plain HTML page that runs in the browser with no build step, no framework and no tracking.</p>
      <p class="sub">Every scene states what it models and, just as plainly, what it does not. Numbers come from declared catalogues or from computation, never from a picture; where a value is estimated, the page says so.</p>
      <div class="bar">
        <a class="btn btn--go" href="demo/index.html">Open the live deck</a>
        <a class="btn" href="https://github.com/ayberkdt/sunumatik">Source on GitHub</a>
        <input type="search" id="find" placeholder="Filter ${c.presetsWithIndex} scenes&hellip;" aria-label="Filter scenes">
      <div class="lang" role="group" aria-label="Catalogue language">
        <button type="button" data-lang="en" aria-pressed="true">EN</button>
        <button type="button" data-lang="tr" aria-pressed="false">TR</button>
      </div>
      </div>
      <nav>
        ${nav}
      </nav>
    </header>

    <main>
${sections}
      <p class="empty" id="empty">Nothing matches that. Clear the filter to see all ${c.presetsWithIndex} scenes.</p>
    </main>

    <footer>
      ${c.presetsWithIndex} scenes with a page &middot; ${c.animatedPresets} animated &middot; ${c.skills} skills &middot; deck of ${c.demoSlides} slides.
      Generated by <code>scripts/build-home.mjs</code> from <code>presets/registry.json</code>.
    </footer>
  </div>

  <script>
    /* Local filter. No network, no framework: the only thing it does is
       hide cards whose declared search text does not contain the query,
       and hide a group once every card inside it is hidden. */
    var find = document.getElementById('find');
    var cards = Array.prototype.slice.call(document.querySelectorAll('.card'));
    var groups = Array.prototype.slice.call(document.querySelectorAll('[data-group]'));
    var empty = document.getElementById('empty');
    find.addEventListener('input', function () {
      var q = find.value.trim().toLowerCase();
      document.body.classList.toggle('filtering', q.length > 0);
      var shown = 0;
      cards.forEach(function (c) {
        var hit = !q || c.dataset.find.indexOf(q) !== -1;
        c.hidden = !hit;
        if (hit) shown++;
      });
      groups.forEach(function (g) {
        g.hidden = !!q && !g.querySelector('.card:not([hidden])');
      });
      empty.style.display = q && shown === 0 ? 'block' : 'none';
    });
  </script>
  <script>
    /* Scene titles ship in both languages; this only chooses which one is
       shown. Forty-six of them were Turkish while the catalogue's own
       chrome was English, so the page read as two pages stapled together.
       The choice is remembered, and it is read back defensively because a
       private window can refuse storage entirely. */
    (() => {
      const dugmeler = [...document.querySelectorAll('.lang button')];
      const uygula = (dil) => {
        for (const n of document.querySelectorAll('[data-en]')) {
          const t = n.getAttribute('data-' + dil);
          if (t) n.textContent = t;
        }
        for (const b of dugmeler) b.setAttribute('aria-pressed', String(b.dataset.lang === dil));
        document.documentElement.lang = dil;
        try { localStorage.setItem('sunumatik.lang', dil); } catch { /* storage kapali */ }
      };
      let baslangic = 'en';
      try { const v = localStorage.getItem('sunumatik.lang'); if (v === 'tr' || v === 'en') baslangic = v; } catch { /* storage kapali */ }
      for (const b of dugmeler) b.addEventListener('click', () => uygula(b.dataset.lang));
      uygula(baslangic);
    })();
  </script>
</body>
</html>
`;

const out = path.join(root, 'index.html');
const check = process.argv.includes('--check');
if (check) {
  const have = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
  if (have !== html) {
    console.error('index.html is stale - run `node scripts/build-home.mjs` and commit the result.');
    process.exit(1);
  }
  console.log(`index.html matches the registry (${withPage.length} scenes, ${GROUPS.length} groups).`);
} else {
  fs.writeFileSync(out, html, 'utf8');
  console.log(`index.html written: ${withPage.length} scenes in ${GROUPS.length} groups.`);
}
