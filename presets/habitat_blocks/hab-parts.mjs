/* hab-parts.mjs — HABİTAT BİLEŞEN KATALOĞU (three'siz, DOM'suz, saf).
 * docs/habitat-blocks-plan.md §3, §4, §6.
 *
 * Katalog `satellite_integration/sat-parts.mjs` ile AYNI biçimdedir; bu
 * bir tesadüf değil, sözleşmedir (exploded-view-plan §3): aynı alanları
 * beyan eden her cisim aynı patlatma, aynı bütçe ve aynı denetimden
 * geçer. Bir üs ile bir uydu arasındaki fark katalogda kalır.
 *
 * Birim: metre, kilogram. Konum saha koordinatında (+Z yukarı, +X doğu).
 * Ortam: 'mars' (varsayılan) ya da 'moon' — ortama uymayan bileşen
 * `envAllows` ile reddedilir ve gerekçesi yazılır.
 *
 * Örnek üs: dört mürettebatlı, ~90 gün özerk bir Mars yüzey üssü.
 * Sayılar bu sınıfın tipik büyüklükleridir; belirli bir görevin veri
 * sayfası DEĞİLDİR.
 */

export const HAB_ENV = Object.freeze({
  mars: { ad: 'Mars', gravity: 3.72, pressure: 610, atmosfer: true, ruzgar: true,
    toz: 'red, not strongly charged but clinging', gun: 88775 },
  moon: { ad: 'the Moon', gravity: 1.62, pressure: 0, atmosfer: false, ruzgar: false,
    toz: 'sharp and electrostatically charged - the enemy of seals and bearings', gun: 2551443 },
});

export const SUBSYSTEMS = Object.freeze({
  basincli: { ad: 'Pressurised volume', renk: '#d8d4cc', neden: 'Where the crew lives; everything else exists to keep it standing.' },
  gecis: { ad: 'Transit and airlock', renk: '#c9a35c', neden: 'Getting out and back in without losing the air.' },
  yapi: { ad: 'Structure and foundation', renk: '#9aa0aa', neden: 'Carries pressure load and dead weight into the regolith.' },
  guc: { ad: 'Power', renk: '#e0b25a', neden: 'Sun by day, batteries by night, fission throughout.' },
  isil: { ad: 'Thermal', renk: '#8fa2b4', neden: 'Heat only leaves by radiation; a radiator is not a comfort, it is a requirement.' },
  isru: { ad: 'ISRU and tanks', renk: '#9ec98a', neden: 'Make it here: every kilogram not shipped is a kilogram earned.' },
  hat: { ad: 'Lines', renk: '#7fb0c9', neden: 'The fluid, power and data runs that tie the modules together.' },
  iletisim: { ad: 'Communications', renk: '#b4a8c9', neden: 'The link home; height buys horizon.' },
});

export const INTERFACES = Object.freeze({
  basincli: 'Pressurised passage (seal and clamp, airtight)',
  civata: 'Bolted interface (torqued)',
  ayirma: 'Ground anchor (regolith screw / bearing plate)',
  akiskan: 'Fluid interface (dry-break coupling, shutoff valve)',
  elektrik: 'Electrical interface (connector, cable tray)',
  mentese: 'Hinge and latch',
  kaynak: 'Welded or seamed joint (not separable)',
});

/** Akışkan renk bandı standardı (plan §4.6) — bant BİLGİDİR, vurgu değil.
 * `yogunluk` hattın taşıdığı akışkanın çalışma yoğunluğudur (kg/m³) ve
 * boru birim kütlesine girer: gaz hattı ile kriyojenik hat aynı boruyla
 * aynı açıklığı geçemez. */
export const FLUID_BANDS = Object.freeze({
  O2: { ad: 'Oxygen (gas)', renk: '#5aa86a', yogunluk: 26, hal: 'gas, ~2 MPa' },
  LOX: { ad: 'Liquid oxygen', renk: '#3f8f57', yogunluk: 1141, hal: 'cryogenic liquid' },
  N2: { ad: 'Nitrogen (gas)', renk: '#c9b45a', yogunluk: 23, hal: 'gas, ~2 MPa' },
  H2O: { ad: 'Water', renk: '#5a8fc9', yogunluk: 1000, hal: 'liquid' },
  CO2: { ad: 'Carbon dioxide', renk: '#8a8f96', yogunluk: 40, hal: 'compressed gas' },
  CH4: { ad: 'Methane / fuel', renk: '#c95a5a', yogunluk: 423, hal: 'cryogenic liquid' },
  NH3: { ad: 'Coolant (ammonia)', renk: '#d68a4a', yogunluk: 610, hal: 'two-phase' },
  DC: { ad: 'Power (DC)', renk: '#2a2a2a', yogunluk: 0, hal: 'conductor - no fluid' },
  DATA: { ad: 'Data', renk: '#7f90a8', yogunluk: 0, hal: 'fibre - no fluid' },
});

/* Ortam kuralı: hangi bileşen nerede GERÇEK. */
const ENV_RULE = {
  'ruzgar-olcer': { gerek: e => e.ruzgar, neden: 'Rüzgâr ölçer atmosfer ister; Ay\'da ölçülecek rüzgâr yoktur.',
    oneri: 'Ay\'da yerine toz birikim sensörü ve mikrometeorit sayacı konur.' },
  'moxie': { gerek: e => e.atmosfer && e.pressure > 100, neden: 'MOXIE atmosferdeki CO₂\'yi ayrıştırır; Ay\'da hammadde yok.',
    oneri: 'Ay\'da oksijen regolit ilmenitinden ya da kutup buzundan çıkarılır.' },
  'toz-firca': { gerek: () => true, neden: '', oneri: '' },
};

/* ── BİLEŞENLER ───────────────────────────────────────────────────────
   Alan adları sat-parts ile birebir aynı: mountsTo, arayuz, step, massKg,
   pos, size, why — böylece assemblyFromCatalog hiçbir değişiklik
   istemeden çalışır.
   ports: hat yönlendirmenin bağlanacağı noktalar (plan §4.1).
*/
export const PARTS = Object.freeze([
  /* ADIM 1 — zemin hazırlığı ve temel */
  { id: 'platform', ad: 'Compacted pad', sistem: 'yapi', step: 1, mountsTo: null, arayuz: 'ayirma',
    massKg: 0, pos: [0, 0, -0.08], size: [40, 32, 0.16], sekil: 'platform',
    tech: {
      no: 'HB-CIV-001',
      malzeme: 'Compacted regolith with polyurethane binder infiltration',
      guc_W: 0,
      sicaklik_C: [-140, 30],
      baglanti: 'None - laid and compacted in place',
      detay: '26 x 20 m; compacted to 1.9 g/cm3, bearing capacity 180 kPa. Binder only soaks the top 40 mm: it fixes the dust without preventing excavation',
      kalite: 'Made on site - zero launched mass',
    },
    why: 'Regolith is compacted and levelled so modules sit true, dust stays down, and walking routes are obvious. It has no mass because it is made on site - the cheapest form of ISRU there is.' },
  { id: 'temel-hab', ad: 'Habitat bearing plates (6)', sistem: 'yapi', step: 1, qty: 6, mountsTo: 'platform', arayuz: 'ayirma',
    massKg: 42, pos: [-3.6, 0, 0.06], size: [1.1, 1.1, 0.12], sekil: 'plaka',
    tech: {
      no: 'HB-STR-010',
      malzeme: '6061-T6 aluminium plate, 12 mm',
      guc_W: 0,
      sicaklik_C: [-140, 60],
      baglanti: 'Regolith screw 6 x dia 90 mm, 600 mm deep; spherical joint on top',
      detay: '1.1 x 1.1 m per plate, so 4800 kg over 7.26 m2 is 6.6 kPa - 4% of the bearing capacity',
      kalite: 'The spherical joint absorbs settlement; a rigid mount would bend the plate',
    },
    why: 'Spreads the load into the regolith. Six points is not isostatic, but settlement differences have to be trimmed out at the bolt; three points would just sink into soft ground.' },

  /* ADIM 2 — basınçlı çekirdek */
  { id: 'hab-silindir', ad: 'Rigid habitat module', sistem: 'basincli', step: 2, mountsTo: 'temel-hab', arayuz: 'civata',
    massKg: 4800, pos: [-3.6, 0, 2.3], size: [7.6, 4.4, 4.4], sekil: 'silindir-yatay',
    tech: {
      no: 'HB-PRS-020',
      malzeme: '2219-T87 aluminium shell 4.8 mm, Nomex interior liner',
      guc_W: 1850,
      sicaklik_C: [18, 27],
      hacim_m3: 92,
      koruma_gcm2: 2.1,
      baglanti: '6 x M20 spherical joints onto the bearing plates; pressurised flanges at both ends',
      isiYolu: 'Cabin air -> coolant loop -> radiator array (radiator array)',
      detay: 'dia 4.4 x 7.6 m; at 101.3 kPa internal the hoop stress pr/t = 101300 x 2.2 / 0.0048 = 46.4 MPa, 13% of yield. The domed cap carries half that at the same pressure',
      kalite: 'Pressure margin 4.0 (crewed flight rule)',
    },
    why: 'Its diameter is set by the launch fairing (4.4 m). The ends are domed caps: pressure load turns into membrane tension, where a flat end would work in bending.',
    ports: [{ ad: 'kilit', pos: [0.5, -2.2, 0], dir: [0, -1, 0], tur: 'basincli' },
            { ad: 'tunel', pos: [3.8, 0, 0], dir: [1, 0, 0], tur: 'basincli' },
            { ad: 'O2', pos: [-3.8, 0.8, -1.2], dir: [-1, 0, 0], tur: 'O2' },
            { ad: 'guc', pos: [-3.8, -0.8, -1.2], dir: [-1, 0, 0], tur: 'DC' }] },
  { id: 'hab-ic-raf', ad: 'Interior rack wall', sistem: 'basincli', step: 2, mountsTo: 'hab-silindir', arayuz: 'civata',
    massKg: 620, pos: [-3.6, 1.2, 1.6], size: [6.4, 0.8, 2.0], sekil: 'raf',
    tech: {
      no: 'HB-ECL-021',
      malzeme: 'Aluminium honeycomb racks, quick-release mounts',
      guc_W: 1240,
      sicaklik_C: [15, 35],
      baglanti: '24 quarter-turn latches to the shell - one-handed access',
      isiYolu: 'Rack rear air channel -> coolant loop',
      detay: 'CO2 scrubbing 380 W, water recovery 430 W, air circulation 210 W, electronics 220 W. One wall means one maintenance point and one noise direction',
      veri_Mbps: 12,
      kalite: 'Every box dual-redundant',
    },
    why: 'Life support, water recovery and electronics collect on one wall: maintenance from one place, noise in one direction.' },
  { id: 'regolit-ortu', ad: 'Regolith shielding cover', sistem: 'yapi', step: 2, mountsTo: 'hab-silindir', arayuz: 'ayirma',
    massKg: 0, pos: [-3.6, 0, 3.4], size: [8.6, 5.4, 1.6], sekil: 'ortu',
    tech: {
      no: 'HB-RAD-022',
      malzeme: 'Excavated regolith in bags',
      guc_W: 0,
      sicaklik_C: [-140, 30],
      koruma_gcm2: 95,
      baglanti: 'Does not touch the shell - carried on its own arch so no load reaches the pressure vessel',
      detay: '0.6 m thick x 1.58 g/cm3 = 95 g/cm2 areal density. Cuts GCR dose by about half; secondary neutron production at this thickness is still a net win',
      kalite: 'Excavated on site - zero launched mass',
    },
    why: '0.5 to 1 m of regolith brings the galactic cosmic ray dose down to roughly what an atmosphere gives. It is dug on site, not shipped - which is why it shows as zero in the mass budget.' },

  /* ADIM 3 — geçişler */
  { id: 'kilit-boyun', ad: 'Airlock vestibule', sistem: 'gecis', step: 3, mountsTo: 'hab-silindir', arayuz: 'basincli',
    massKg: 210, pos: [-3.1, -2.9, 1.5], size: [1.6, 1.6, 1.8], sekil: 'tunel',
    tech: {
      no: 'HB-PRS-034',
      malzeme: 'Aluminium shell, double-seal hatch frame at each end',
      guc_W: 55,
      sicaklik_C: [5, 30],
      hacim_m3: 3.2,
      koruma_gcm2: 0.9,
      baglanti: 'Pressurised flange to the habitat and to the airlock',
      isiYolu: 'Local heaters; shares the habitat loop',
      detay: 'dia 1.6 x 1.6 m. Two hatches in series, so the airlock can be isolated without opening the habitat',
      kalite: 'Leak-checked as part of the habitat volume, not the airlock',
    },
    why: 'The airlock was drawn a metre off the habitat with nothing between. This is what joins them, and the second hatch is what lets the airlock be serviced while the crew stays pressurised.' },
  { id: 'hava-kilidi', ad: 'Airlock', sistem: 'gecis', step: 3, mountsTo: 'kilit-boyun', arayuz: 'basincli',
    massKg: 890, pos: [-3.1, -4.4, 1.5], size: [2.4, 2.4, 2.6], sekil: 'silindir-dikey',
    tech: {
      no: 'HB-EVA-030',
      malzeme: '2219-T87 shell, double door',
      guc_W: 310,
      sicaklik_C: [10, 30],
      hacim_m3: 8.4,
      koruma_gcm2: 1.4,
      baglanti: 'Pressurised flange, 32 x M12 clamp; doors open INWARD',
      isiYolu: 'Local radiator on the shell; the pump-down heat goes here',
      detay: '8.4 m3; the pump recovers 85% of the volume, so each egress costs 1.26 m3 of air instead of 8.4 m3',
      kalite: 'Pressure seats the door; an outward door would tear off',
    },
    why: 'Kept small because every exit loses that volume of air. The doors open INWARD: pressure seats them, and an outward door would be torn off.',
    ports: [{ ad: 'ic', pos: [0, 1.2, -0.4], dir: [0, 1, 0], tur: 'basincli' },
            { ad: 'dis', pos: [0, -1.2, -0.4], dir: [0, -1, 0], tur: 'basincli' }] },
  { id: 'toz-firca', ad: 'Dust removal station', sistem: 'gecis', step: 3, mountsTo: 'hava-kilidi', arayuz: 'civata',
    massKg: 65, pos: [-3.1, -6.1, 0.9], size: [1.6, 1.0, 1.8], sekil: 'kutu',
    tech: {
      kesilebilir: true,
      no: 'HB-EVA-031',
      malzeme: 'Stainless body, conductive brush filament',
      guc_W: 420,
      sicaklik_C: [-60, 40],
      baglanti: '8 x M8 onto the airlock outer hatch; stands OUTSIDE',
      isiYolu: 'Straight to ambient - the unit sits OUTSIDE the pressure shell, so its heat never enters the base loop',
      detay: 'Electrostatic dust shield plus rotating brush, used on the suit exterior. Lunar dust is sharp and charged: the enemy of seals, bearings and lungs',
      kalite: 'Dust getting in is irreversible - cleaning happens outside',
    },
    why: 'Dust that gets inside ruins seals, bearings and lungs. It stands OUTSIDE the outer door; cleaning happens with the suit still on.' },
  { id: 'tunel', ad: 'Connecting tunnel', sistem: 'gecis', step: 3, mountsTo: 'hab-silindir', arayuz: 'basincli',
    massKg: 410, pos: [1.4, 0, 2.0], size: [3.2, 1.9, 1.9], sekil: 'tunel',
    tech: {
      no: 'HB-PRS-032',
      malzeme: 'Aluminium shell with a stainless bellows section',
      guc_W: 85,
      sicaklik_C: [5, 30],
      hacim_m3: 9.1,
      koruma_gcm2: 0.9,
      baglanti: 'Pressurised flange at both ends; bellows in the middle',
      isiYolu: 'Local heaters; the bellows is the cold-bridge risk',
      detay: 'dia 1.9 x 3.2 m. The bellows takes +/-40 mm axial and +/-2 deg angular: 3.2 m of aluminium moves 8.2 mm over 110 K, and ground settlement moves more',
      kalite: 'The bellows carries no pressure load - the reinforcing rings do',
    },
    why: 'Joins two modules under pressure. The bellows section absorbs thermal growth and differential settlement; a rigid joint would crack the seal.',
    ports: [{ ad: 'bati', pos: [-1.6, 0, 0], dir: [-1, 0, 0], tur: 'basincli' },
            { ad: 'dogu', pos: [1.6, 0, 0], dir: [1, 0, 0], tur: 'basincli' }] },
  { id: 'dugum', ad: 'Node module', sistem: 'gecis', step: 3, mountsTo: 'tunel', arayuz: 'basincli',
    massKg: 1450, pos: [4.6, 0, 2.1], size: [3.4, 3.4, 3.4], sekil: 'dugum',
    tech: {
      no: 'HB-PRS-033',
      malzeme: '2219-T87 spherical shell, 5.2 mm',
      guc_W: 140,
      sicaklik_C: [18, 27],
      hacim_m3: 20.6,
      koruma_gcm2: 1.1,
      baglanti: 'Five pressurised hatches (4 lateral, 1 overhead), 32 x M12 each',
      isiYolu: 'The main coolant loop branches from here',
      detay: 'dia 3.4 m sphere; a sphere encloses a given volume with the least shell mass. The fifth hatch is spare: adding a module later is only cheap if the door is already there',
      kalite: 'Independent isolation valve per hatch',
    },
    why: 'A four-door junction. The cheapest way to extend a base later is to put the extra door in now.',
    ports: [{ ad: 'bati', pos: [-1.7, 0, 0], dir: [-1, 0, 0], tur: 'basincli' },
            { ad: 'dogu', pos: [1.7, 0, 0], dir: [1, 0, 0], tur: 'basincli' },
            { ad: 'kuzey', pos: [0, 1.7, 0], dir: [0, 1, 0], tur: 'basincli' }] },

  /* ADIM 4 — şişme hacim ve sera */
  { id: 'gecis-sisme', ad: 'Transfer tunnel, node to inflatable', sistem: 'gecis', step: 4, mountsTo: 'dugum', arayuz: 'basincli',
    massKg: 360, pos: [5.1, 2.75, 2.2], size: [1.9, 2.9, 1.9], sekil: 'tunel',
    tech: {
      no: 'HB-PRS-035',
      malzeme: 'Aluminium shell with a stainless bellows section',
      guc_W: 70,
      sicaklik_C: [5, 30],
      hacim_m3: 6.8,
      koruma_gcm2: 0.9,
      baglanti: 'Pressurised flange at both ends; bellows in the middle',
      isiYolu: 'Local heaters; the bellows is the cold-bridge risk',
      detay: 'dia 1.9 x 2.9 m, running north. The inflatable settles differently from the rigid node, so the bellows is doing real work here',
      kalite: 'Hatch at the node end; the inflatable end is a soft-goods interface ring',
    },
    why: 'Step 4 says the inflatable attaches to the node. It was sitting 2.1 m away with nothing in between, which is why the base looked like parts set down near each other rather than one pressurised volume.' },
  { id: 'gecis-sera', ad: 'Transfer tunnel, node to greenhouse', sistem: 'gecis', step: 4, mountsTo: 'dugum', arayuz: 'basincli',
    massKg: 290, pos: [7.05, 0.0, 2.0], size: [2.2, 1.8, 1.8], sekil: 'tunel',
    tech: {
      no: 'HB-PRS-036',
      malzeme: 'Aluminium shell, bellows section, light-tight sleeve',
      guc_W: 60,
      sicaklik_C: [5, 30],
      hacim_m3: 4.9,
      koruma_gcm2: 0.9,
      baglanti: 'Pressurised flange at both ends',
      isiYolu: 'Local heaters; the greenhouse runs warmer and wetter than the node',
      detay: 'dia 1.8 x 2.2 m. The sleeve keeps the greenhouse photoperiod out of the node - crop lighting on a 16 h cycle is not what a sleeping crew needs',
      kalite: 'Humidity barrier at the node end',
    },
    why: 'The greenhouse was 1.5 m off the node it declares as its parent. This closes the gap, and it is also where the humidity and the light get stopped.' },
  { id: 'sisme-modul', ad: 'Inflatable habitat (toroid)', sistem: 'basincli', step: 4, mountsTo: 'gecis-sisme', arayuz: 'basincli',
    massKg: 2900, pos: [5.6, 7.4, 2.4], size: [7.2, 7.2, 3.6], sekil: 'toroid',
    tech: {
      no: 'HB-PRS-040',
      malzeme: 'Vectran restraint webbing, urethane bladder, Nextel debris layer',
      guc_W: 680,
      sicaklik_C: [18, 27],
      hacim_m3: 186,
      koruma_gcm2: 1.6,
      baglanti: 'Pressurised passage to the node; the membrane ties to the core through the webbing',
      isiYolu: 'Core duct -> coolant loop',
      detay: 'dia 7.2 m toroid, 186 m3 - twice the volume of the rigid module at 60% of the mass. The webbing carries the load and the bladder only seals; the other way round, one puncture would end the module',
      kalite: 'The debris layer is for micrometeoroids; the bladder alone is not enough',
    },
    why: 'Folded for launch, inflated on site: three times the volume per kilogram of a rigid module. The webbing straps and the bulge are the stress path made visible.' },
  { id: 'sera', ad: 'Greenhouse module', sistem: 'basincli', step: 4, mountsTo: 'gecis-sera', arayuz: 'basincli',
    massKg: 1650, pos: [10.6, 0.0, 1.9], size: [5.6, 3.2, 3.2], sekil: 'silindir-yatay',
    tech: {
      kesilebilir: true,
      no: 'HB-BIO-041',
      malzeme: 'Aluminium shell, internal LED panels, hydroponic racks',
      guc_W: 2400,
      sicaklik_C: [20, 26],
      hacim_m3: 44,
      baglanti: 'Pressurised passage to the node, 32 x M12',
      isiYolu: 'LED heat -> water loop -> radiator (heat that reaches the plants is already doing work)',
      detay: '36 m2 of growing area; 38% of the 2400 W of LED is photosynthetic, the rest is heat. Not transparent: glass would let radiation in and night heat out',
      uretim: { gida_kg_gun: 1.9, O2_kg_gun: 2.4 },
      kalite: 'Plant light comes from a socket, not a window',
    },
    why: 'NOT transparent: glass lets radiation in and heat out. Lighting and spectrum are controlled inside; plant light comes from a socket, not a window.' },

  /* ADIM 5 — güç */
  { id: 'panel-tarlasi', ad: 'Solar array field', sistem: 'guc', step: 5, qty: 4, mountsTo: 'platform', arayuz: 'ayirma',
    massKg: 310, pos: [-11.8, 7.6, 0.8], size: [5.0, 3.0, 1.6], sekil: 'panel-tarla',
    tech: {
      no: 'HB-PWR-050',
      malzeme: 'IMM triple-junction cells, aluminium truss substrate',
      guc_W: -662,
      sicaklik_C: [-130, 95],
      baglanti: 'Regolith screws 4 x dia 60 mm into the pad; panel angle set by hand',
      detay: '15 m2 per array gives 662 W; four arrays 2650 W. On Mars 590 W/m2 x 28% efficiency x 75% dust and angle losses. Tilted so dust slides off and cleaning stays easy',
      kalite: 'Output falls to 20% in a dust storm - which is why the reactor exists',
    },
    why: 'Dust settles on Mars, so the panels are TILTED: dust slides off and cleaning is easier. The same field at a lunar pole would stand vertical, because there the Sun runs around the horizon.' },
  { id: 'batarya-kabini', ad: 'Battery cabin', sistem: 'guc', step: 5, mountsTo: 'platform', arayuz: 'ayirma',
    massKg: 780, pos: [-10.4, 3.4, 0.8], size: [2.6, 1.8, 1.6], sekil: 'kutu',
    tech: {
      no: 'HB-PWR-051',
      malzeme: 'Li-ion NMC cells in an insulated cabin',
      guc_W: 140,
      sicaklik_C: [5, 30],
      baglanti: '8 x M12 to the pad; the cabin is thermally isolated',
      isiYolu: 'Local radiator inside the cabin; charge heat goes out',
      detay: '120 kWh; a 12.3 hour night at 8.5 kW needs 105 kWh, so 88% depth of discharge. The 140 W heater exists because cold costs capacity and heat costs life',
      kalite: 'With fission present the battery is only a bridge - it cannot carry a night alone',
    },
    why: 'For night and dust storms. Insulated: a cold battery loses capacity, a hot one loses life.' },
  { id: 'reaktor', ad: 'Fission power unit', sistem: 'guc', step: 5, mountsTo: 'platform', arayuz: 'ayirma',
    massKg: 1520, pos: [13.6, -9.6, 1.4], size: [2.2, 2.2, 2.8], sekil: 'reaktor',
    tech: {
      no: 'HB-PWR-060',
      malzeme: 'UO2 fuel, Na heat pipes, Stirling convertors',
      guc_W: -10000,
      sicaklik_C: [-40, 80],
      baglanti: '6 x M20 to the pad; recessed emplacement 14 m from the base',
      isiYolu: 'Stirling reject heat -> umbrella radiator (reactor radiator)',
      detay: '10 kWe; 43 kWt thermal, 23% conversion efficiency. Dose falls with the square of distance: 14 m plus the shadow shield keeps the base side under 5 mSv a year',
      kalite: 'The base survives even when a dust storm takes the Sun',
    },
    why: 'Solar is not enough in a dust storm. It sits well away from the base with a shadow shield between: dose falls with the square of distance, and the shield takes the rest.' },
  { id: 'golge-kalkani', ad: 'Reactor shadow shield', sistem: 'guc', step: 5, mountsTo: 'platform', arayuz: 'ayirma',
    massKg: 420, pos: [12.1, -8.1, 1.5], size: [3.2, 0.6, 3.0], sekil: 'kalkan',
    tech: {
      no: 'HB-PWR-062',
      malzeme: 'Steel frame, borated polyethylene panels, regolith-filled on site',
      guc_W: 0,
      sicaklik_C: [-90, 60],
      baglanti: '8 x M16 into the pad; panels bolt on after the frame is levelled',
      detay: '3.2 x 3.0 m wall between the core and the base. Shipped as a 420 kg frame and filled with regolith on site - the fill is the shielding and it is free here',
      kalite: 'Dose rate at the habitat verified by survey before first criticality',
    },
    why: 'Step 5 already said the reactor sits behind its shadow shield, and there was no shield. Shielding a reactor all the way round costs mass that does not exist; shielding only the cone that points at the crew is why it is called a shadow shield.' },
  { id: 'radyator-direk', ad: 'Radiator mast', sistem: 'guc', step: 5, mountsTo: 'reaktor', arayuz: 'civata',
    massKg: 60, pos: [13.6, -9.6, 3.0], size: [0.4, 0.4, 0.6], sekil: 'direk',
    tech: {
      no: 'HB-PWR-063',
      malzeme: 'Titanium column with a thermally isolating collar',
      guc_W: 0,
      sicaklik_C: [-90, 120],
      baglanti: '6 x M12 to the reactor head; the umbrella bolts to the top plate',
      detay: '0.6 m. The collar is the point: it carries the radiator without carrying the reactor head\u2019s heat into it',
      kalite: 'Proof loaded with the umbrella deployed',
    },
    why: 'The umbrella radiator was floating 0.4 m above the reactor it declares as its parent. This is what holds it there, and the isolating collar is why the radiator radiates the loop heat rather than the reactor head.' },
  { id: 'reaktor-radyator', ad: 'Reactor umbrella radiator', sistem: 'isil', step: 5, mountsTo: 'radyator-direk', arayuz: 'civata',
    massKg: 340, pos: [13.6, -9.6, 3.4], size: [5.2, 5.2, 0.4], sekil: 'semsiye',
    tech: {
      no: 'HB-THR-061',
      malzeme: 'Carbon-carbon panels, Na-K loop',
      guc_W: 0,
      sicaklik_C: [-120, 480],
      baglanti: '8 x M16 high-temperature bolts to the reactor',
      detay: '8 segments x 2.6 m2, 21 m2 radiating at 480 K gives 21 x 0.85 x sigma x 480^4 = 53 kW, covering the 33 kW the Stirlings reject with margin',
      kalite: 'The only place fission heat can go is space',
    },
    why: 'Fission heat has only one place to go, and that is space. The umbrella is the highest radiating area per kilogram that will still deploy.' },

  /* ADIM 6 — ısıl ve ISRU */
  { id: 'radyator-dizisi', ad: 'Base radiator array', sistem: 'isil', step: 6, qty: 2, mountsTo: 'platform', arayuz: 'ayirma',
    massKg: 290, pos: [-3.6, 9.2, 1.3], size: [6.0, 0.3, 2.6], sekil: 'radyator',
    tech: {
      no: 'HB-THR-070',
      malzeme: 'Aluminium fins, OSR coating, ammonia loop',
      kanat: 2,
      guc_W: 310,
      sicaklik_C: [-100, 50],
      baglanti: '6 x M12 to the pad; fixed orientation, back to the Sun',
      isiYolu: 'Pump heat stays in the fluid it is pumping and radiates from the same fins - no separate path needed',
      detay: '2 arrays x 2 fins x 6.0 x 2.6 m = 62.4 m2. NET rejection is computed with the environment radiating back: e.sigma(T^4 - F_ground.T_ground^4 - F_sky.T_sky^4). Pump 310 W',
      kalite: 'A sunlit face zeroes the net rejection',
    },
    why: 'Where the habitat heat is radiated away. It stands with its BACK to the Sun; a sunlit face would zero out the net rejection.' },
  { id: 'moxie', ad: 'MOXIE (CO2 to O2)', sistem: 'isru', step: 6, mountsTo: 'platform', arayuz: 'ayirma',
    massKg: 420, pos: [6.8, -7.4, 0.9], size: [2.2, 1.8, 1.8], sekil: 'kutu',
    tech: {
      kesilebilir: true,
      no: 'HB-ISR-080',
      malzeme: 'Solid oxide electrolysis stack (scandia-stabilised zirconia)',
      guc_W: 1900,
      sicaklik_C: [-60, 50],
      baglanti: '6 x M12 to the pad; filtered CO2 intake',
      isiYolu: 'The stack runs at 800 C - insulated, waste heat to a local radiator',
      detay: '2CO2 -> 2CO + O2. 1900 W yields 2.8 kg/day of O2. Four crew breathe 4 x 0.84 = 3.4 kg/day; the greenhouse and recovery close the gap',
      uretim: { O2_kg_gun: 2.8 },
      kalite: 'Only real on a planet that has an atmosphere',
    },
    why: '95% of the Martian atmosphere is CO2. Solid oxide electrolysis makes oxygen on site, so breathing and burning oxygen never has to be shipped.' },
  { id: 'sabatier', ad: 'Sabatier reactor', sistem: 'isru', step: 6, mountsTo: 'platform', arayuz: 'ayirma',
    massKg: 380, pos: [9.4, -7.4, 0.9], size: [2.0, 1.6, 1.8], sekil: 'kutu',
    tech: {
      kesilebilir: true,
      no: 'HB-ISR-081',
      malzeme: 'Ni catalyst bed, stainless reactor',
      guc_W: 850,
      sicaklik_C: [-60, 50],
      baglanti: '6 x M12 to the pad; O2 and CH4 outputs on SEPARATE lines',
      isiYolu: 'The reaction is EXOTHERMIC (-165 kJ/mol) - that heat is fed back into water heating',
      detay: 'CO2 + 4H2 -> CH4 + 2H2O. 850 W yields 1.6 kg/day of CH4 and 3.6 kg/day of H2O. Electrolysing the water returns the hydrogen: hydrogen is not shipped, it cycles',
      uretim: { CH4_kg_gun: 1.6, H2O_kg_gun: 3.6 },
      kalite: 'Return propellant and water from one reaction',
    },
    why: 'CO2 + 4H2 gives CH4 + 2H2O. Return propellant and water come out of the same reaction, and electrolysing the water returns the hydrogen.' },
  { id: 'tank-o2', ad: 'O2 tank', sistem: 'isru', step: 6, mountsTo: 'platform', arayuz: 'ayirma',
    massKg: 260, pos: [4.6, -11.4, 1.5], size: [2.4, 2.4, 3.0], sekil: 'tank-dikey',
    tech: {
      no: 'HB-ISR-090',
      malzeme: 'Ti liner with carbon overwrap, 30-layer MLI',
      guc_W: 180,
      sicaklik_C: [-196, 40],
      baglanti: '4 x M16 lugs to the pad; dry-break coupling, shutoff valve',
      isiYolu: 'Active cooler, 180 W - drives the boil-off to zero',
      detay: 'dia 2.4 x 3.0 m, 11.2 m3, so 12 800 kg of LOX. Boil-off would be 2.4% a day bare; under MLI with the cooler it is below 0.05%',
      kalite: '4.6 m clear of the fuel tank so one failure does not become a fire',
    },
    why: 'Cryogenic and wrapped in MLI. It stands well clear of the fuel tank: putting oxidiser next to fuel turns one failure into a fire.' },
  { id: 'tank-ch4', ad: 'CH4 tank', sistem: 'isru', step: 6, mountsTo: 'platform', arayuz: 'ayirma',
    massKg: 240, pos: [9.8, -11.4, 1.5], size: [2.4, 2.4, 3.0], sekil: 'tank-dikey',
    tech: {
      no: 'HB-ISR-091',
      malzeme: 'Ti liner with carbon overwrap, 30-layer MLI',
      guc_W: 160,
      sicaklik_C: [-182, 40],
      baglanti: '4 x M16 lugs to the pad; dry-break coupling, shutoff valve',
      isiYolu: 'Active cooler, 160 W',
      detay: 'dia 2.4 x 3.0 m, 11.2 m3, so 4740 kg of LCH4. At 1.6 kg/day the Sabatier needs 8.1 years to fill it; a real mission runs several units',
      kalite: 'This number is what ISRU actually costs: time',
    },
    why: 'The Sabatier product. It sits apart from the O2 tank; the separation is a layout rule, not an accident.' },

  /* ADIM 7 — hatlar, iletişim, saha */
  { id: 'hat-o2', ad: 'O2 line', sistem: 'hat', step: 7, mountsTo: 'tank-o2', arayuz: 'akiskan',
    massKg: 75, pos: [2.4, -6.4, 0.9], size: [11.0, 0.24, 0.24], sekil: 'hat', akiskan: 'O2',
    boru: { odM: 0.08, wallM: 0.002, malzeme: 'paslanmaz', ucNoktalar: ['tank-o2', 'hab-silindir'] },
    tech: {
      no: 'HB-FLU-100',
      malzeme: '316L stainless, dia 80 x 2 mm',
      guc_W: 90,
      sicaklik_C: [-120, 60],
      baglanti: 'Dry-break couplings at tank and habitat; intermediate joints welded',
      detay: '12.9 m; 90 W of trace heating against freezing. 4 supports at 4.30 m, 0.93 mm sag, 1 expansion loop (110 K gives 22.7 mm)',
      kalite: 'The colour band is information, not decoration',
    },
    why: 'From the tank to the habitat. Raised off the ground (dust), cradled every 4 m, and looped every 30 m for expansion: the day-night swing exceeds 100 K and a straight run would pull itself apart.' },
  { id: 'hat-guc', ad: 'Power line', sistem: 'hat', step: 7, mountsTo: 'reaktor', arayuz: 'elektrik',
    massKg: 180, pos: [5.0, -5.2, 0.7], size: [17.0, 0.18, 0.18], sekil: 'hat', akiskan: 'DC',
    boru: { odM: 0.06, wallM: 0.004, malzeme: 'bakir', ucNoktalar: ['reaktor', 'hab-silindir'] },
    tech: {
      no: 'HB-ELE-101',
      malzeme: 'Copper conductor dia 60 x 4 mm, PTFE insulation',
      guc_W: 0,
      sicaklik_C: [-140, 90],
      baglanti: 'Connectors at reactor and habitat; slack in a cable tray',
      detay: '16.9 m; 10 kWe at 600 V DC is 16.7 A, 42 W of conductor loss (0.4%). 7 supports at 4.22 m, 1 expansion loop',
      kalite: 'A tight cable snaps when it contracts - the slack is the allowance',
    },
    why: 'From the reactor to the base. It runs in a tray with slack: a cable pulled tight snaps when it contracts in the cold.' },
  { id: 'anten-direk', ad: 'Communications mast', sistem: 'iletisim', step: 7, mountsTo: 'platform', arayuz: 'ayirma',
    massKg: 210, pos: [0.2, -10.2, 3.6], size: [0.5, 0.5, 7.2], sekil: 'direk',
    tech: {
      no: 'HB-COM-110',
      malzeme: 'CFRP tube, Ti base joint',
      guc_W: 0,
      sicaklik_C: [-140, 80],
      baglanti: '4 x M16 base plate to the pad; three guy lines',
      detay: '7.2 m. Horizon range sqrt(2Rh) = sqrt(2 x 3 389 500 x 7.2) = 6.99 km, against 3.4 km from eye height',
      kalite: 'Height is horizon range',
    },
    why: 'Height buys horizon directly: 7 m of mast pushes the line of sight out by kilometres on flat ground.',
    ports: [{ ad: 'tepe', pos: [0, 0, 3.6], dir: [0, 0, 1], tur: 'DATA' }] },
  { id: 'anten-canak', ad: 'Earth dish (2.4 m)', sistem: 'iletisim', step: 7, mountsTo: 'anten-direk', arayuz: 'mentese',
    massKg: 95, pos: [0.2, -10.2, 8.65], size: [2.9, 2.9, 2.9], sekil: 'canak',
    /* `size` is the ENVELOPE, and for a two-axis dish that envelope is the
       sphere it sweeps - so it is a cube of side 2 x canakGeo().erim centred
       on the elevation axis, not the aperture. The aperture lives here with
       the pointing, because `size` doing both jobs is what left the drawn
       dish 0.72 m inside its own mast with no honest number to declare.
       Angles in degrees: azimuth 0 is north and runs clockwise, elevation is
       from the horizon. */
    nis: { cap: 2.4, azimut: 205, yukseklik: 38, enAz: 25 },
    tech: {
      no: 'HB-COM-111',
      malzeme: 'CFRP shell, mesh reflector',
      guc_W: 310,
      sicaklik_C: [-140, 90],
      veri_Mbps: 4.2,
      baglanti: 'Two-axis gimbal on a yoke at the mast head, 4 x M10. Elevation 25 to 85 deg, azimuth continuous',
      isiYolu: 'TWTA heat to the body radiator',
      detay: 'dia 2.4 m, X band, 46.5 dBi, 0.9 deg beam. 4.2 Mbps with Earth at 2.7 AU; 24 Mbps at closest approach. Drawn at its nominal pointing, azimuth 205 deg and 38 deg up, not stowed. The envelope is the 2.9 m cube the dish sweeps about its elevation axis, which is what the yoke has to lift clear of the 7.2 m mast head',
      kalite: 'The gimbal holds lock as the planet turns, and it can complete its travel without the rim touching the mast',
    },
    why: 'Tracks Earth; a two-axis gimbal holds lock as the planet turns. A narrow beam is what buys the data rate.' },
  { id: 'ruzgar-olcer', ad: 'Anemometer', sistem: 'iletisim', step: 7, mountsTo: 'anten-direk', arayuz: 'civata',
    massKg: 8, pos: [0.2, -10.7, 6.2], size: [0.6, 0.6, 0.5], sekil: 'ruzgar',
    tech: {
      no: 'HB-MET-112',
      malzeme: 'Hot-wire anemometer, ceramic body',
      guc_W: 6,
      sicaklik_C: [-120, 40],
      baglanti: 'Saddle clamp to the mast, 2 x M6',
      detay: '0 to 40 m/s, +/-0.3 m/s. For dust storm warning and landing windows',
      kalite: 'Only real where there is an atmosphere - refused on the Moon',
    },
    why: 'For dust storm warning and landing windows. Only real on a planet with an atmosphere; on the Moon there is no wind to measure.' },
  { id: 'garaj', ad: 'Rover canopy', sistem: 'yapi', step: 7, mountsTo: 'platform', arayuz: 'ayirma',
    massKg: 520, pos: [-11.6, -5.8, 1.7], size: [6.0, 4.4, 3.4], sekil: 'tente',
    tech: {
      no: 'HB-STR-120',
      malzeme: 'Aluminium frame, fabric cover, dia 0.12 m legs',
      guc_W: 0,
      sicaklik_C: [-140, 60],
      baglanti: '4 regolith screws to the pad; the cover is tensioned',
      detay: '6.0 x 4.4 x 3.4 m. NOT pressurised: a pressurised garage is expensive and unnecessary. The cover stops dust and night radiation; the charge cable comes in underneath',
      kalite: 'Shelter without enclosure - the cheapest answer',
    },
    why: 'Not enclosed: a pressurised garage is both expensive and unnecessary. The canopy stops dust and night radiation, and the charging cable comes in underneath.' },
]);

export const STEPS = Object.freeze([
  { no: 1, ad: 'Ground and foundation', aciklama: 'Regolith is compacted and the bearing plates are laid. Every dimension from here on is measured off that plane.' },
  { no: 2, ad: 'Pressurised core', aciklama: 'The rigid habitat is set down, the equipment wall goes in, and regolith is piled over it. The cover is excavated on site.' },
  { no: 3, ad: 'Transits', aciklama: 'Airlock, dust removal, tunnel and node. The pressurised volume is only usable after this step.' },
  { no: 4, ad: 'Volume expansion', aciklama: 'The inflatable and the greenhouse attach to the node; the base can now carry four people for a long stay.' },
  { no: 5, ad: 'Power', aciklama: 'Array field, battery cabin and the fission unit. The reactor goes far out, behind its shadow shield.' },
  { no: 6, ad: 'Thermal and ISRU', aciklama: 'Radiators, MOXIE, Sabatier and the tanks. Oxygen and fuel start being made on site.' },
  { no: 7, ad: 'Lines and site', aciklama: 'Pipe and cable runs, the comms mast, the rover canopy. The base gets connected and becomes legible.' },
]);

/** Bağlantı katsayısı: çıplak borunun üstüne vana, flanş, yalıtım ve
 * askı gelir. Beyan edilen hat kütlesi = birim kütle × boy × bu katsayı;
 * denetim ikisinin ayrışmasına izin vermez. */
export const FITTINGS_FACTOR = 1.45;

/** Hat bileşenlerinin uç noktaları — yönlendirme buradan plan üretir. */
export function runEndpoints(id) {
  const p = partById(id);
  if (!p || !p.boru || !p.boru.ucNoktalar) return null;
  const [a, b] = p.boru.ucNoktalar.map(partById);
  if (!a || !b) return null;
  return { a: a.pos, b: b.pos, akiskan: p.akiskan, odM: p.boru.odM, wallM: p.boru.wallM, malzeme: p.boru.malzeme };
}

/* ── sorgular ─────────────────────────────────────────────────────────── */
const say = p => p.qty ?? 1;
export const partMass = p => say(p) * p.massKg;
export function partById(id) { return PARTS.find(p => p.id === id) || null; }

/** Bileşen bu ortamda gerçek mi? */
export function envAllows(id, envKey = 'mars') {
  const e = HAB_ENV[envKey];
  if (!e) throw new Error(`hab-parts: bilinmeyen ortam '${envKey}'`);
  const k = ENV_RULE[id];
  if (!k) return { ok: true, id, env: e };
  const ok = Boolean(k.gerek(e));
  return { ok, id, env: e, neden: ok ? null : k.neden, oneri: ok ? null : k.oneri };
}
export const ENV_RULED = Object.freeze(Object.keys(ENV_RULE));

/**
 * Bir kardanlı çanağın geometrisi — TEK türetme.
 *
 * Çanak iki eksende döndüğü için süpürdüğü hacim bir KÜREDİR: dolayısıyla
 * ilan edilmesi gereken zarf, dönüş ekseni merkezli kenar uzunluğu 2·erim
 * olan bir küptür. Bu sayı hem geometriyi kuran yerde hem de kapıda gerekli,
 * ve iki yerde ayrı yazıldığında biri sessizce yanlış olur: ilk denemede
 * çanağı düz bir plaka sayan kapalı form 1,24 m dedi, canlı sahnede ölçülen
 * 2,36 m çıktı ve çanak direğin 0,72 m içinde dönüyordu.
 *
 * `cap` açıklık ÇAPI (m). Yansıtıcı, yarıçapı 1,5·r olan bir küre kapağıdır;
 * odak küresel aynada R/2'dedir ve besleme oraya oturur.
 */
export function canakGeo(cap) {
  const r = cap / 2;
  const R = r * 1.5;                       // kapağın küre yarıçapı
  const alfa = Math.asin(r / R);            // kapağın yarım açısı
  const sehim = R * (1 - Math.cos(alfa));   // kapak derinliği (sagitta)
  const vTepe = r * 0.10;                   // tepe, dönüş ekseninin önünde
  const odak = vTepe + R / 2;               // küresel aynanın odağı
  const besleBoy = r * 0.24;                // besleme kutusunun uzunluğu
  const kenarEt = r * 0.045;                // kenar takviyesinin boru yarıçapı
  const kenarZ = vTepe + sehim;
  /* Erim: dönüş ekseninden en uzak nokta. İki aday var — kenar takviyesi ve
     beslemenin ucu — ve hangisinin kazandığı açıklık/derinlik oranına bağlı,
     bu yüzden ikisi de hesaplanır. En dış nokta kenar ÇEMBERİ değil, o çemberin
     etrafına sarılmış borunun dışıdır: et payı yazılmadığında canlı sahnede
     ölçülen 1,383 m, vaat edilen 1,332 m'yi aşıyordu. Zarf bir ÜST SINIR
     olmak zorunda, yoksa zarf değildir. */
  const erim = Math.max(
    Math.hypot(r + kenarEt, kenarZ + kenarEt),
    odak + besleBoy / 2);
  return { r, R, alfa, sehim, vTepe, odak, besleBoy, kenarEt, kenarZ, erim };
}

/**
 * Kütle bütçesi ORTAMA bağlıdır. Ortamsız çağrı bütün katalogu toplar ve
 * bu yanlıştı: Ay üssü 24 bileşenle kuruluyor ama bütçe 26 bileşenin
 * kütlesini gösteriyordu (MOXIE 420 kg + rüzgâr ölçer 8 kg, hiç
 * gönderilmeyecek 428 kg). Reddedilen bileşen fırlatılmaz; bütçede de
 * yoktur.
 */
export function massBudget(envKey = null) {
  const sistem = {};
  let toplam = 0;
  const kapsam = envKey ? PARTS.filter(p => envAllows(p.id, envKey).ok) : PARTS;
  for (const p of kapsam) {
    const m = partMass(p);
    toplam += m;
    sistem[p.sistem] = (sistem[p.sistem] || 0) + m;
  }
  return {
    ortam: envKey ? HAB_ENV[envKey].ad : 'ortamdan bağımsız (tam katalog)',
    kapsamParca: kapsam.length,
    disaridaKg: envKey ? Number(PARTS.filter(p => !envAllows(p.id, envKey).ok)
      .reduce((a, p) => a + partMass(p), 0).toFixed(1)) : 0,
    toplamKg: Number(toplam.toFixed(1)),
    /* Yerinde üretilen (kütlesi 0) bileşenler: taşınmayan her kilogram kazançtır. */
    yerindeUretilen: kapsam.filter(p => p.massKg === 0).map(p => p.id),
    sistemler: Object.entries(sistem).map(([k, v]) => ({ sistem: k, ad: SUBSYSTEMS[k].ad, kg: Number(v.toFixed(1)), pay: v / toplam }))
      .sort((a, b) => b.kg - a.kg),
    parcaSayisi: kapsam.reduce((s, p) => s + say(p), 0),
  };
}

/** Basınçlı hacim zinciri: hangi modüller havayı paylaşıyor. */
export function pressurizedChain() {
  const basincliler = PARTS.filter(p => p.sistem === 'basincli' || p.sistem === 'gecis');
  return basincliler.filter(p => p.arayuz === 'basincli' || p.sistem === 'basincli').map(p => p.id);
}

/** Bütün arayüz noktaları (hat yönlendirme buradan bağlanır). */
export function allPorts() {
  const out = [];
  for (const p of PARTS) for (const q of (p.ports || [])) {
    out.push({ parca: p.id, ad: q.ad, tur: q.tur,
      pos: [p.pos[0] + q.pos[0], p.pos[1] + q.pos[1], p.pos[2] + q.pos[2]], dir: q.dir });
  }
  return out;
}

/* ── teknik bütçeler ──────────────────────────────────────────────────
   Künyedeki sayılar toplandıklarında kapanmak ZORUNDA. Kapanmıyorsa ya
   tasarım ya beyan yanlıştır; denetim ikisini ayırt edemez ama sessiz
   kalmaz. */

/** Kesilebilir yükler: fırtınada ve gecede kapatılabilenler. */
export const KESILEBILIR = Object.freeze(
  PARTS.filter(p => p.tech?.kesilebilir).map(p => p.id));

/**
 * Güç bütçesi, ÜÇ durum için. Negatif `guc_W` üretim, pozitif tüketimdir.
 *
 * Asıl mühendislik sorusu "gündüz yetiyor mu" değil: Mars'ta toz fırtınası
 * haftalarca güneşi keser. Üssün yaşaması, PANELLER SIFIRKEN kritik yükün
 * yalnız fisyonla karşılanmasına bağlıdır. Kesilebilir yükler (sera, ISRU,
 * toz temizleme) o sırada kapanır — üretim durur, mürettebat yaşar.
 */
export function powerBudget() {
  let uretimGunes = 0, uretimFisyon = 0, kritik = 0, kesilebilir = 0;
  const kalemler = [];
  for (const q of PARTS) {
    const g = q.tech?.guc_W ?? 0;
    if (!g) continue;
    const n = q.qty ?? 1;
    const W = g * n;
    if (W < 0) {
      if (q.sistem === 'guc' && q.id.startsWith('panel')) uretimGunes += -W;
      else uretimFisyon += -W;
    } else if (q.tech.kesilebilir) kesilebilir += W;
    else kritik += W;
    kalemler.push({ id: q.id, ad: q.ad, W, adet: n, kesilebilir: Boolean(q.tech.kesilebilir) });
  }
  const uretim = uretimGunes + uretimFisyon;
  const tuketim = kritik + kesilebilir;
  return {
    uretimGunesW: uretimGunes, uretimFisyonW: uretimFisyon, uretimW: uretim,
    kritikW: kritik, kesilebilirW: kesilebilir, tuketimW: tuketim,
    /* gündüz: her şey açık */
    gunduz: { uretimW: uretim, yukW: tuketim, payW: uretim - tuketim, pay: (uretim - tuketim) / uretim },
    /* gece: güneş yok, ISRU ve sera kapalı, fisyon sürüyor */
    gece: { uretimW: uretimFisyon, yukW: kritik, payW: uretimFisyon - kritik, pay: (uretimFisyon - kritik) / uretimFisyon },
    /* fırtına: panel %20'ye düşer, kesilebilir yük kapanır */
    firtina: {
      uretimW: uretimFisyon + uretimGunes * 0.2, yukW: kritik,
      payW: uretimFisyon + uretimGunes * 0.2 - kritik,
      pay: (uretimFisyon + uretimGunes * 0.2 - kritik) / (uretimFisyon + uretimGunes * 0.2),
    },
    kalemler: kalemler.sort((a, b) => Math.abs(b.W) - Math.abs(a.W)),
  };
}

/** Mürettebat varsayımı — bütün yaşam bütçeleri buna göre. */
export const MURETTEBAT = 4;

/**
 * Basınçlı hacim. Yaşanabilir hacim, geçiş ve üretim hacimlerini İÇERMEZ:
 * hava kilidinde yaşanmaz, tünelde oturulmaz, serada uyunmaz.
 */
export function volumeBudget(kisi = MURETTEBAT) {
  const gecis = new Set(['hava-kilidi', 'tunel']);
  const uretimHacmi = new Set(['sera']);
  let toplam = 0, yasanabilir = 0;
  const kalemler = [];
  for (const q of PARTS) {
    const v = q.tech?.hacim_m3;
    if (!v) continue;
    toplam += v;
    const sinif = gecis.has(q.id) ? 'geçiş' : uretimHacmi.has(q.id) ? 'üretim' : 'yaşanabilir';
    if (sinif === 'yaşanabilir') yasanabilir += v;
    kalemler.push({ id: q.id, ad: q.ad, m3: v, sinif });
  }
  return {
    toplamM3: Number(toplam.toFixed(1)),
    yasanabilirM3: Number(yasanabilir.toFixed(1)),
    kisiBasiM3: Number((yasanabilir / kisi).toFixed(1)),
    kisi,
    kalemler: kalemler.sort((a, b) => b.m3 - a.m3),
  };
}

/**
 * ISRU: yerinde üretilen oksijen mürettebatın solumasını karşılıyor mu?
 * Solunum 0,84 kg O₂/kişi-gün (ağır iş dahil).
 */
export const O2_KISI_GUN = 0.84;
export function isruBudget(kisi = MURETTEBAT) {
  let o2 = 0, ch4 = 0, h2o = 0, gida = 0;
  const kaynaklar = [];
  for (const q of PARTS) {
    const u = q.tech?.uretim;
    if (!u) continue;
    const n = q.qty ?? 1;
    o2 += (u.O2_kg_gun ?? 0) * n;
    ch4 += (u.CH4_kg_gun ?? 0) * n;
    h2o += (u.H2O_kg_gun ?? 0) * n;
    gida += (u.gida_kg_gun ?? 0) * n;
    kaynaklar.push({ id: q.id, ad: q.ad, ...u });
  }
  const solunum = kisi * O2_KISI_GUN;
  return {
    kisi, kaynaklar,
    O2UretimKgGun: Number(o2.toFixed(2)),
    O2SolunumKgGun: Number(solunum.toFixed(2)),
    O2PayKgGun: Number((o2 - solunum).toFixed(2)),
    O2Yeterli: o2 >= solunum,
    CH4KgGun: Number(ch4.toFixed(2)),
    H2OKgGun: Number(h2o.toFixed(2)),
    gidaKgGun: Number(gida.toFixed(2)),
  };
}

/**
 * Isıl kapanış. Radyatör kapasitesi BEYAN EDİLEN geometriden hesaplanır
 * (εσT⁴ × alan), künyeye yazılan bir sayıdan değil. Atılacak ısı, kritik
 * ve kesilebilir bütün elektrik yükünün toplamıdır: elektrik eninde
 * sonunda ısıya döner.
 */
export const SIGMA = 5.670374419e-8;
export function thermalBudget({ T_C = 27, eps = 0.85, env = 'mars' } = {}) {
  const T = T_C + 273.15;
  const d = partById('radyator-dizisi');
  const n = d.qty ?? 1;
  /* Kanat sayısı KÜNYEDEN gelir; çizim de aynı sayıyı okur, ayrışamazlar. */
  const kanat = d.tech?.kanat ?? 2;
  const alan = d.size[0] * d.size[2] * kanat * n;
  /* Radyatör yalnız ışımaz, ışıma da ALIR. Düşey duran bir kanat yarı
     görüşüyle zemini, yarısıyla gökyüzünü görür; ikisi de geri ışır ve
     NET atımı düşürür. Bu terimi atlamak kapasiteyi %20 fazla gösteriyordu
     (124,8 m² için 48,7 kW yazmıştım; ortam düşülünce 37,9 kW). */
  const ortam = env === 'mars'
    ? { zemin: 230, gok: 170 }        // Mars: ince atmosfer, ılık regolit
    : { zemin: 250, gok: 3 };         // Ay: gündüz sıcak regolit, gök = uzay
  const geri = 0.5 * Math.pow(ortam.zemin, 4) + 0.5 * Math.pow(ortam.gok, 4);
  const kapasite = eps * SIGMA * (Math.pow(T, 4) - geri) * alan;
  const guc = powerBudget();
  /* Reaktörün kendi atık ısısı kendi şemsiyesine gider, üs ilmeğine değil. */
  const atilacak = guc.tuketimW;
  return {
    T_C, eps, env, kanatSayisi: kanat * n, alanM2: Number(alan.toFixed(1)),
    ortamGeriIsimaK: Number(Math.pow(geri, 0.25).toFixed(1)),
    kapasiteW: Math.round(kapasite),
    atilacakW: Math.round(atilacak),
    payW: Math.round(kapasite - atilacak),
    pay: (kapasite - atilacak) / kapasite,
    kapaniyor: kapasite >= atilacak,
  };
}

export function describe(envKey = 'mars') {
  const b = massBudget(envKey);
  const red = PARTS.filter(p => !envAllows(p.id, envKey).ok);
  return {
    ortam: HAB_ENV[envKey].ad,
    parca: PARTS.length, adet: b.parcaSayisi, adim: STEPS.length,
    toplamKg: b.toplamKg, yerindeUretilen: b.yerindeUretilen.length,
    reddedilen: red.map(p => p.id),
    basincliModul: pressurizedChain().length,
    arayuzNoktasi: allPorts().length,
  };
}
