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

/* ── küçük ikonlar ────────────────────────────────────────────────────
   Altmış beş kart, her biri üç satır metin ve tek bir resim yok: ızgara bir
   ad duvarı gibi okunuyordu. İkonlar 16x16 bir viewBox'ta, konturlu ve
   `currentColor` ile çizilir - tek renk, tek kalınlık, ayrı bir palet yok.
   Amaç süslemek değil, tararken satır okumadan ayırt edebilmek. */
const ICONS = {
  yorunge: '<ellipse cx="8" cy="8" rx="7" ry="3.4"/><circle cx="8" cy="8" r="1.7"/>',
  aktarim: '<path d="M2 11a6 6 0 0 1 12-3"/><path d="M11 5l3 0 0 3"/><circle cx="2.5" cy="11" r="1.2"/>',
  lagrange: '<circle cx="4" cy="11" r="1.5"/><circle cx="12" cy="11" r="1.5"/><circle cx="8" cy="4" r="1.5"/><path d="M4 11h8M4 11l4-7M12 11l-4-7"/>',
  firlatma: '<path d="M8 2c2.2 2 3.2 4.4 3.2 7L8 12 4.8 9c0-2.6 1-5 3.2-7z"/><path d="M5.6 12.4L4 14.6M10.4 12.4L12 14.6"/>',
  giris: '<path d="M2 4c4 4 8 6 12 6"/><path d="M4 12l2-2M7 13.5l2-2M10 14.5l2-2"/>',
  uydu: '<rect x="6" y="6" width="4" height="4" rx="0.6"/><path d="M6 8H1.5M10 8H14.5M1.5 6.2v3.6M14.5 6.2v3.6"/>',
  habitat: '<path d="M2.5 12V8.5a5.5 5.5 0 0 1 11 0V12z"/><path d="M2.5 12h11M8 8.5V12"/>',
  anten: '<path d="M3 12a6 6 0 0 1 9.4-7"/><path d="M7.5 9.2L13 3.2"/><path d="M3 12h4"/>',
  arazi: '<path d="M1.5 12.5l4-6 3 4 2-2.6 4 4.6z"/>',
  gunes: '<circle cx="8" cy="8" r="3.2"/><path d="M8 1.5v1.8M8 12.7v1.8M1.5 8h1.8M12.7 8h1.8M3.4 3.4l1.3 1.3M11.3 11.3l1.3 1.3M12.6 3.4l-1.3 1.3M4.7 11.3l-1.3 1.3"/>',
  gezegen: '<circle cx="8" cy="8" r="4"/><ellipse cx="8" cy="8" rx="7" ry="2.4" transform="rotate(-20 8 8)"/>',
  yildiz: '<path d="M8 1.5l1.7 4.4 4.8.3-3.7 3 1.2 4.6L8 11.2 4 13.8l1.2-4.6-3.7-3 4.8-.3z"/>',
  aurora: '<path d="M2 13c1.5-5 3-8 4.5-8S8 11 9.5 11 12 6 14 3"/><path d="M4 13.5V10M7 13.5V8M10 13.5V9.5"/>',
  sok: '<path d="M2 8h3l2-4 2 8 2-4h3"/>',
  kanat: '<path d="M1.5 9.5c4-4 9-5.5 13-4-3 3-8 5-13 4z"/><path d="M4 9l6-2"/>',
  girdap: '<path d="M8 8a2 2 0 1 1-2-2 4 4 0 1 1 4 4 6 6 0 1 1-6-6"/>',
  ag: '<circle cx="3" cy="4" r="1.4"/><circle cx="3" cy="12" r="1.4"/><circle cx="13" cy="8" r="1.4"/><circle cx="8" cy="4" r="1.4"/><circle cx="8" cy="12" r="1.4"/><path d="M4.4 4H6.6M4.4 12H6.6M9.3 4.6l2.5 2.6M9.3 11.4l2.5-2.6"/>',
  katman: '<rect x="2" y="3" width="12" height="2.6" rx="0.6"/><rect x="2" y="6.7" width="12" height="2.6" rx="0.6"/><rect x="2" y="10.4" width="12" height="2.6" rx="0.6"/>',
  egri: '<path d="M2 13c3 0 3-9 6-9s3 9 6 9"/><path d="M2 13h12"/>',
  denklem: '<path d="M3 3h7l-4 5 4 5H3"/><path d="M12.5 6.5v5"/>',
  zaman: '<path d="M1.5 8h13"/><path d="M4 5.5v5M8 4.5v7M12 5.5v5"/>',
  isik: '<path d="M8 1.8v2M8 9.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M5 12.5h6l-1.5 2h-3z"/>',
  deste: '<rect x="1.8" y="3" width="12.4" height="8" rx="0.8"/><path d="M4.5 13.4h7"/>',
  mekanizma: '<circle cx="8" cy="8" r="2.4"/><path d="M8 1.6v2M8 12.4v2M1.6 8h2M12.4 8h2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M12.5 3.5l-1.4 1.4M4.9 11.1l-1.4 1.4"/>',
  gezgin: '<rect x="3" y="6" width="10" height="3.4" rx="0.8"/><circle cx="5" cy="11.6" r="1.6"/><circle cx="11" cy="11.6" r="1.6"/><path d="M6 6V4h4v2"/>',
  dunya: '<circle cx="8" cy="8" r="6.2"/><path d="M1.8 8h12.4"/><ellipse cx="8" cy="8" rx="2.8" ry="6.2"/>',
  izgara: '<rect x="2" y="2" width="12" height="12" rx="1"/><path d="M2 6h12M2 10h12M6 2v12M10 2v12"/>',
  teleskop: '<path d="M2.5 10.5l8-6 3 3-8 6z"/><path d="M4.5 12.5l-2 2M9.5 7.5l2.2 2.2"/>',
  hedef: '<circle cx="8" cy="8" r="5.6"/><circle cx="8" cy="8" r="2"/><path d="M8 0.8v2.6M8 12.6v2.6M0.8 8h2.6M12.6 8h2.6"/>',
  ayrilma: '<rect x="5" y="1.8" width="6" height="5" rx="1"/><rect x="5" y="9.2" width="6" height="5" rx="1"/><path d="M2.5 8h11"/>',
  kutu: '<path d="M8 1.8l6 3.1v6.2l-6 3.1-6-3.1V4.9z"/><path d="M2 4.9l6 3.1 6-3.1M8 8v6.2"/>',
};

/* ── tür ──────────────────────────────────────────────────────────────
   Katalog iki ayrı şeyi karıştırıyordu ve bunu hiçbir yerde söylemiyordu.
   Kimi sahnenin arkasında bir model KOŞAR, bütçeler kapanır ve bir
   doğrulayıcı sayıları ispatlar; kimi sahne DOĞRU GÖRÜNSÜN diye kurulmuştur
   ve fizik orada resmin hizmetindedir; kimi de ötekilerin içe aktardığı
   ortak takımdır. Izgarada hangisinin hangisi olduğu okunamıyordu. */
const KINDS = {
  olcum: { en: 'instrument', tr: 'ölçüm',
    aciklamaEn: 'a model runs behind it and the numbers are checked',
    aciklamaTr: 'arkasında bir model koşar ve sayılar denetlenir' },
  gorsel: { en: 'visual', tr: 'görsel',
    aciklamaEn: 'built to look right; the physics serves the picture',
    aciklamaTr: 'doğru görünsün diye kurulmuş; fizik resmin hizmetinde' },
  arac: { en: 'toolkit', tr: 'araç',
    aciklamaEn: 'shared machinery the other scenes import',
    aciklamaTr: 'öteki sahnelerin içe aktardığı ortak takım' },
};

/* Sahne başına tür ve ikon. Ikisi de ZORUNLU: eksik olan yapıyı düşürür,
   böylece yeni bir sahne sınıflandırılmadan katalogda görünemez. */
const SCENE = {
  aero_airfoil_flow: ['olcum', 'kanat'],
  aero_shock_waves: ['olcum', 'sok'],
  aero_vortex_street: ['olcum', 'girdap'],
  aircraft_blocks: ['arac', 'kanat'],
  attitude_gnc: ['olcum', 'hedef'],
  aurora: ['gorsel', 'aurora'],
  cinematic_space: ['gorsel', 'yildiz'],
  comms_antenna: ['olcum', 'anten'],
  comms_link_budget: ['olcum', 'anten'],
  conjunction_covariance: ['olcum', 'hedef'],
  constellation_coverage: ['olcum', 'izgara'],
  cosmos_advanced: ['gorsel', 'yildiz'],
  cr3bp_lagrange: ['olcum', 'lagrange'],
  craft_blocks: ['arac', 'kutu'],
  deck_starter: ['arac', 'deste'],
  earth_advanced: ['gorsel', 'dunya'],
  eclipse_geometry: ['olcum', 'gunes'],
  entry_dispersion: ['olcum', 'giris'],
  equation_pen: ['arac', 'denklem'],
  equation_steps: ['arac', 'denklem'],
  exploded_view: ['olcum', 'kutu'],
  figure_callouts: ['arac', 'hedef'],
  formation_flight: ['olcum', 'uydu'],
  free_return: ['olcum', 'aktarim'],
  geo_stationkeeping: ['olcum', 'yorunge'],
  gravity_assist: ['olcum', 'aktarim'],
  gravity_field: ['olcum', 'izgara'],
  ground_track_3d: ['olcum', 'dunya'],
  habitat_blocks: ['olcum', 'habitat'],
  halo_manifolds: ['olcum', 'lagrange'],
  jwst_explorer: ['olcum', 'teleskop'],
  launch_ascent: ['olcum', 'firlatma'],
  launch_window: ['olcum', 'zaman'],
  life_signs: ['arac', 'mekanizma'],
  light_blocks: ['olcum', 'isik'],
  low_thrust_transfer: ['olcum', 'aktarim'],
  lunar_descent: ['olcum', 'firlatma'],
  lunar_orbit: ['olcum', 'yorunge'],
  mechanism_lab: ['olcum', 'mekanizma'],
  ml_attention_flow: ['olcum', 'ag'],
  ml_conv_vision: ['olcum', 'izgara'],
  ml_layer_blocks: ['olcum', 'katman'],
  ml_loss_functions: ['olcum', 'egri'],
  ml_loss_landscape: ['olcum', 'egri'],
  ml_net_builder: ['olcum', 'ag'],
  moon_advanced: ['gorsel', 'gezegen'],
  neural_network: ['olcum', 'ag'],
  orbit_determination: ['olcum', 'hedef'],
  orbit_perturbations: ['olcum', 'yorunge'],
  orbital_stage: ['olcum', 'ayrilma'],
  physical_rigs: ['olcum', 'mekanizma'],
  planets_advanced: ['gorsel', 'gezegen'],
  porkchop_explorer: ['olcum', 'izgara'],
  reentry_corridor: ['olcum', 'giris'],
  rendezvous_docking: ['olcum', 'uydu'],
  satellite_integration: ['olcum', 'uydu'],
  site_plan: ['olcum', 'izgara'],
  soi_explorer: ['olcum', 'yorunge'],
  stage_separation: ['olcum', 'ayrilma'],
  sun_advanced: ['gorsel', 'gunes'],
  terrain_blocks: ['olcum', 'arazi'],
  three_body_states: ['olcum', 'lagrange'],
  timeline_tree: ['arac', 'zaman'],
  tisserand_graph: ['olcum', 'egri'],
  transfer_explorer: ['olcum', 'aktarim'],
};

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
  aero_vortex_street: 'Karman Vortex Street',
  cinematic_space: 'Cinematic Space Scene',
  cosmos_advanced: 'Deep Sky - stars, nebulae, galaxies',
  earth_advanced: 'Earth - terrain, atmosphere, city lights',
  equation_pen: 'Equation Pen - writing a formula out',
  exploded_view: 'Exploded View',
  habitat_blocks: 'Habitat Blocks',
  jwst_explorer: 'JWST Explorer',
  lunar_orbit: 'Analytic Lunar Orbit',
  ml_loss_landscape: 'Loss Landscape',
  ml_net_builder: 'Architecture Builder',
  moon_advanced: 'The Moon - surface, relief, orbit',
  neural_network: 'Neural Network',
  physical_rigs: 'Physical Rigs',
  planets_advanced: 'The Planets - orbits and surfaces',
  rendezvous_docking: 'Rendezvous and Docking',
  satellite_integration: 'Satellite Integration',
  sun_advanced: 'The Sun - granulation, flares, corona',
  timeline_tree: 'Chronology Timeline',
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
/* This used to test for Turkish DIACRITICS and only demand a translation
   when it found one. "Sinematik Uzay Sahnesi", "Mimari Kurucu", "Fiziksel
   Aksam", "Randevu ve Kenetlenme" and "Karman Vorteks Caddesi" contain none,
   so five scenes shipped their Turkish titles inside the English catalogue
   and the check reported clean. Spelling is the wrong thing to detect. Every
   scene DECLARES an English name; that is a rule and it cannot be spelled
   around. */
/* Tür ve ikon da eksiksiz olmak zorunda: sınıflandırılmamış bir sahne,
   okuyucunun ayırt edemediği bir sahnedir. */
const tursuz = withPage.filter(p => !SCENE[p.name]).map(p => p.name);
if (tursuz.length) {
  console.error(`build-home: ${tursuz.length} scene(s) have no kind/icon: ${tursuz.join(', ')}`);
  console.error('Add them to SCENE in scripts/build-home.mjs.');
  process.exit(2);
}
const kotuTur = withPage.filter(p => !KINDS[SCENE[p.name][0]] || !ICONS[SCENE[p.name][1]]).map(p => p.name);
if (kotuTur.length) {
  console.error(`build-home: unknown kind or icon: ${kotuTur.join(', ')}`);
  process.exit(2);
}
const ceviriYok = withPage.filter(p => !TITLE_EN[p.name]).map(p => p.name);
if (ceviriYok.length) {
  console.error(`build-home: ${ceviriYok.length} scene(s) have no declared English name: ${ceviriYok.join(', ')}`);
  console.error('Add them to TITLE_EN in scripts/build-home.mjs.');
  process.exit(2);
}
/* And a declared English name that is still Turkish helps nobody. */
const trHarf = /[\u011f\u011e\u015f\u015e\u0131\u0130\u00e7\u00c7\u00f6\u00d6\u00fc\u00dc]/;
const trKalan = Object.entries(TITLE_EN).filter(([, v]) => trHarf.test(v)).map(([k]) => k);
if (trKalan.length) {
  console.error(`build-home: English name still contains Turkish letters: ${trKalan.join(', ')}`);
  process.exit(2);
}

const cards = (g) => g.members.map(name => {
  const p = byName.get(name);
  const tags = [p.animated ? 'animated' : 'static'];
  const tr = cleanTitle(p.title, name);
  const en = TITLE_EN[name] || tr;
  /* The filter searches BOTH, so a reader typing in either language finds
     the scene whichever way the page happens to be showing it. */
  const [tur, ikon] = SCENE[name];
  const K = KINDS[tur];
  /* The kind is one badge style for all three: the WORD carries the meaning.
     Three colours would have spent the accent tone on decoration, and the
     accent belongs to the active state and nothing else. */
  return `        <a class="card" href="presets/${name}/index.html" data-kind="${tur}" data-find="${esc((tr + ' ' + en + ' ' + name).toLowerCase())}">
          <svg class="card__i" viewBox="0 0 16 16" aria-hidden="true">${ICONS[ikon]}</svg>
          <span class="card__t" data-en="${esc(en)}" data-tr="${esc(tr)}">${esc(en)}</span>
          <span class="card__n">${esc(name)}</span>
          <span class="card__m"><span class="kind" data-en="${esc(K.en)}" data-tr="${esc(K.tr)}">${esc(K.en)}</span> · ${tags.join(' · ')}</span>
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
    /* Tür süzgeci tek bir denetim: dört düğme, dil anahtarıyla birlikte
       eylem bütçesini şişirirdi ve bu bir eylem değil, bir ayar. */
    #kind { min-height: 44px; padding: 0 10px; border: 1px solid #272d39; border-radius: 7px;
      background: #0a0d14; color: #c8cede; font: inherit; font-size: 12.5px; cursor: pointer; }
    .lang { display: inline-flex; border: 1px solid #272d39; border-radius: 7px; overflow: hidden; }
    .lang button { min-height: 44px; min-width: 52px; padding: 0 14px; border: 0; cursor: pointer;
      background: transparent; color: #9aa2b1; font: inherit; font-size: 12.5px; letter-spacing: .04em; }
    .lang button[aria-pressed="true"] { background: rgba(201,163,92,.14); color: #f0e2c4; }
    .lang button + button { border-left: 1px solid #272d39; }
    .cards { display: grid; gap: 10px; margin: 16px 0 0;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); }
    /* Ikon solda, metin sağda: kart üç satır metinden ibaretken ızgara bir
       ad duvarı gibi okunuyordu. Tek kontur kalınlığı, tek renk, ayrı palet
       yok - amaç süslemek değil, satır okumadan ayırt edebilmek. */
    .card__i { grid-row: 1 / span 3; width: 22px; height: 22px; margin-top: 2px;
      fill: none; stroke: currentColor; stroke-width: 1.35;
      stroke-linecap: round; stroke-linejoin: round; color: #79818f; }
    .card:hover .card__i { color: #c9a35c; }
    .kind { display: inline-block; padding: 1px 6px; border: 1px solid #2b3240;
      border-radius: 4px; color: #8a92a2; letter-spacing: .03em; }
    .card { display: grid; grid-template-columns: 22px 1fr; column-gap: 11px;
      align-content: start; min-height: 44px; padding: 13px 15px 14px; border-radius: 7px;
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
      /* Grup gezintisi telefonda 21 px yuksekligindeydi. core/mobile.css
         bunu kapatiyor ama o dosya YALNIZ preset sayfalarina uygulaniyor;
         kok sayfa kendi medya sorgusunu tasiyor, dolayisiyla kural burada
         da yazilmak zorunda. Olculen: 7 baglantinin 7'si esigin altinda. */
      nav a { min-height: 44px; display: inline-flex; align-items: center; }
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
      <select id="kind" aria-label="Scene kind">
        <option value="">All kinds</option>
        <option value="olcum">Instrument</option>
        <option value="gorsel">Visual</option>
        <option value="arac">Toolkit</option>
      </select>
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
    var kindSel = document.getElementById('kind');
    /* Metin ve tur BIRLIKTE suzer: ikisi ayri ayri yazildiginda biri otekini
       geri aliyor ve kullanici neyin gizlendigini anlamiyor. Bos sonuc
       ekrani her iki sebep icin de ayni yerden gelir. */
    function uygulaSuzgec() {
      var q = find.value.trim().toLowerCase();
      var k = kindSel ? kindSel.value : '';
      var etkin = q.length > 0 || k.length > 0;
      document.body.classList.toggle('filtering', etkin);
      var shown = 0;
      cards.forEach(function (c) {
        var hit = (!q || c.dataset.find.indexOf(q) !== -1)
          && (!k || c.dataset.kind === k);
        c.hidden = !hit;
        if (hit) shown++;
      });
      groups.forEach(function (g) {
        g.hidden = etkin && !g.querySelector('.card:not([hidden])');
      });
      empty.style.display = etkin && shown === 0 ? 'block' : 'none';
    }
    find.addEventListener('input', uygulaSuzgec);
    if (kindSel) kindSel.addEventListener('change', uygulaSuzgec);
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
