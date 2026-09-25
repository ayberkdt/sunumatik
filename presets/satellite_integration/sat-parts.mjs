/* sat-parts.mjs — UYDU PARÇA KATALOĞU ve ENTEGRASYON AĞACI
 * (three'siz, DOM'suz, saf).
 *
 * Bu dosya bir uydunun neye benzediğini değil, NASIL KURULDUĞUNU anlatır.
 * Patlatılmış görünüm bir süs değildir: her parçanın nereye cıvatalandığı,
 * hangi arayüzle bağlandığı, montaj sırasında kaçıncı adımda geldiği ve
 * ne kadar kütle getirdiği yazılıdır. Bunlar ölçülebilir iddialardır ve
 * `scripts/validate-satellite.mjs` hepsini sınar:
 *
 *   · kütle bütçesi TOPLANIR ve ilan edilen kuru kütleye eşit çıkar,
 *   · her parçanın bağlandığı arayüz GERÇEKTEN vardır (ağaç kapalıdır),
 *   · montaj sırası bağımlılıkları çiğnemez (ebeveyn önce gelir),
 *   · kütle merkezi ayırma halkası ekseninden ilan edilen paydan sapmaz.
 *
 * Birim: metre ve kilogram. Konumlar gövde koordinatında (+Z fırlatma
 * ekseni yukarı, +X güneş kanatları ekseni, +Y radyatör ekseni).
 *
 * Sınıf: ~1250 kg fırlatma kütleli, kimyasal itkili, üç eksen dengeli
 * bir haberleşme/gözlem otobüsü. Sayılar bu sınıfın tipik büyüklükleridir
 * ve BİR TASARIM ÖRNEĞİDİR; belirli bir uydunun veri sayfası değildir.
 */

/** Alt sistemler — panelde renk ve süzgeç bunlardan gelir. */
export const SUBSYSTEMS = Object.freeze({
  yapi: { ad: 'Structure', renk: '#9aa0aa', neden: 'Carries launch loads and provides the datum everything else is mounted to.' },
  itki: { ad: 'Propulsion', renk: '#c98a5c', neden: 'Orbit raising and station keeping; half the launch mass lives here.' },
  guc: { ad: 'Power', renk: '#e0b25a', neden: 'Energy from the Sun, batteries in eclipse, distribution and protection.' },
  adcs: { ad: 'Attitude (ADCS)', renk: '#7fb0c9', neden: 'Knowing where it points, and turning it there.' },
  haberlesme: { ad: 'Communications', renk: '#b4a8c9', neden: 'Getting the data down and the commands up.' },
  isil: { ad: 'Thermal', renk: '#8fa2b4', neden: 'Keeping every box inside its band; in vacuum radiation is the only way out.' },
  faydali: { ad: 'Payload', renk: '#9ec98a', neden: 'The REASON the satellite exists; everything else keeps it alive.' },
  kablaj: { ad: 'Harness', renk: '#6f7688', neden: 'Ties the boxes together; always underestimated, always 3-4% of dry mass.' },
});

/** Arayüz türleri — "nasıl bağlı" sorusunun cevabı. */
export const INTERFACES = Object.freeze({
  civata: 'Cıvatalı arayüz (tork değerli, gömlekli)',
  kizak: 'Kızak/ray arayüzü (panel seviyesinde kayar, sonra kilitlenir)',
  ayirma: 'Ayırma arayüzü (kelepçe bandı ya da piroteknik; fırlatıcıya bakan tek yüzey)',
  akiskan: 'Akışkan arayüzü (kaynaklı boru, kesme valfi)',
  isil: 'Isıl arayüz (macun/gaz aralığı, ısı borusu gömme)',
  elektrik: 'Elektrik arayüzü (konnektör, kablaj demeti)',
  mentese: 'Menteşe + kilit (fırlatmada katlı, yörüngede açılır)',
});

/* ── PARÇALAR ─────────────────────────────────────────────────────────
   step: montaj adımı (AIT akışı). Aynı adımdaki parçalar birlikte gelir.
   mountsTo: bağlandığı parçanın kimliği (kök = null).
   axis: patlatmada AYRILMA doğrultusu — montaj doğrultusunun tersidir.
   pos: gövde koordinatında parça merkezi [x, y, z] (m).
   size: kaba gabari [x, y, z] (m) — çizim ve kütle merkezi için.
*/
export const PARTS = Object.freeze([
  /* ADIM 1 — birincil yapı */
  { id: 'ayirma-halkasi', ad: 'Separation ring (937 mm)', sistem: 'yapi', step: 1,
    mountsTo: null, arayuz: 'ayirma', massKg: 24, pos: [0, 0, -1.12], size: [0.94, 0.94, 0.09], sekil: 'halka',
    tech: { no: 'SD-STR-001', malzeme: '7075-T73 aluminium, hard anodised', guc_W: 0, sicaklik_C: [-120, 120], baglanti: 'Clamp band, 937 mm interface; 28 kN preload', detay: '24 x M8 A286 bolts, torqued to 24 N.m, lockwired', kalite: 'Flight heritage: >40 launches' },
    why: 'The ONE structural face that looks at the launch vehicle. The clamp band releases here; the whole satellite load passes through this hoop.' },
  { id: 'itki-tupu', ad: 'Thrust tube (centre cylinder)', sistem: 'yapi', step: 1,
    mountsTo: 'ayirma-halkasi', arayuz: 'civata', massKg: 62, pos: [0, 0, -0.1], size: [0.86, 0.86, 1.96], sekil: 'silindir',
    tech: { no: 'SD-STR-002', malzeme: 'M55J/cyanate ester CFRP layup, aluminium honeycomb end rings', guc_W: 0, sicaklik_C: [-150, 130], baglanti: '48 x M6 Ti rivet-bolts into the end rings', detay: '2.4 mm wall; axial load path 6.2 g x 1124 kg = 68 kN', kalite: 'Buckling margin 1.8' },
    why: 'The main load path down to the separation ring. The tank sits inside it; every panel hangs off it.' },
  { id: 'govde-iskeleti', ad: 'Bus primary structure (shear webs + corner posts)', sistem: 'yapi', step: 1,
    mountsTo: 'itki-tupu', arayuz: 'civata', massKg: 46, pos: [0, 0, -0.1], size: [1.7, 1.7, 1.9],
    sekil: 'busFrame', detay: { webs: 4, struts: 4, tubeR: 0.43 },
    tech: { no: 'SD-STR-004', malzeme: 'CFRP shear webs on 7075-T73 posts, bonded and bolted', guc_W: 0, sicaklik_C: [-120, 120], baglanti: '32 x M6 to tube flanges and deck frames', detay: '4 radial shear webs, 4 corner posts, 4 base struts', kalite: 'Static-tested to 1.25 x limit load' },
    why: 'The tube alone carries axial load. These webs carry the LATERAL load and stop the equipment panels racking - the reason a bus is not a box.' },
  { id: 'alt-panel', ad: 'Lower panel (thrust deck)', sistem: 'yapi', step: 1,
    mountsTo: 'itki-tupu', arayuz: 'civata', massKg: 31, pos: [0, 0, -1.04], size: [1.72, 1.72, 0.03], sekil: 'panel',
    tech: { no: 'SD-STR-010', malzeme: '25 mm Al honeycomb core, 0.5 mm CFRP facesheets', guc_W: 0, sicaklik_C: [-140, 150], baglanti: '32 x M5 into the thrust tube, with corner brackets', detay: 'Inserts are clustered under the engine and thruster footprints', kalite: 'Plume-compatible aluminium finish' },
    why: 'The apogee engine and the thrusters face out through here; exhaust points away from the spacecraft.' },

  /* ADIM 2 — itki: yapı kapanmadan ÖNCE girer */
  { id: 'yakit-tanki', ad: 'Propellant tank (MMH/NTO)', sistem: 'itki', step: 2,
    mountsTo: 'itki-tupu', arayuz: 'civata', massKg: 46, pos: [0, 0, -0.05], size: [0.74, 0.74, 1.3], sekil: 'tank',
    tech: { no: 'SD-PRP-020', malzeme: 'Ti-6Al-4V, diaphragm type', guc_W: 45, sicaklik_C: [10, 50], baglanti: '4 lugs, M10 Ti bolts; dry-break fluid coupling', detay: 'Heaters: 3 x 15 W patches, redundant thermostats; MMH freezes at -52 C', kalite: 'Burst margin 2.0' },
    why: 'It goes INSIDE the tube, because once the panels close there is no room left. It has to sit near the centre of mass so the CoM does not walk as propellant burns off.' },
  { id: 'itici-yakit', ad: 'Propellant load', sistem: 'itki', step: 2,
    mountsTo: 'yakit-tanki', arayuz: 'akiskan', massKg: 415, pos: [0, 0, -0.1], size: [0.7, 0.7, 1.15], sekil: 'gizli',
    tech: { no: 'SD-PRP-021', malzeme: 'MMH / NTO, mixture ratio 1.65', guc_W: 0, sicaklik_C: [10, 50], baglanti: 'Fill and drain valve, dual seal', detay: '415 kg; Isp 318 s gives dv ~ 1180 m/s at 1124 kg wet', kalite: 'Hypergolic: no igniter' },
    why: 'Half the launch mass. It is declared as its own line so the dry and wet budgets never get mixed up.' },
  { id: 'basinc-tanki', ad: 'Pressurant tank (helium)', sistem: 'itki', step: 2,
    mountsTo: 'itki-tupu', arayuz: 'civata', massKg: 14, pos: [0.0, 0.0, 0.72], size: [0.42, 0.42, 0.42], sekil: 'kure',
    tech: { no: 'SD-PRP-022', malzeme: 'Ti liner with carbon overwrap (COPV), helium', guc_W: 0, sicaklik_C: [-20, 60], baglanti: '2 clamp saddles, M8', detay: '310 bar; regulated down to 17 bar', kalite: 'Cycle life 4x mission' },
    why: 'Keeps the propellant tank at feed pressure as it empties. Without it thrust would fall off through the burn.' },
  { id: 'apogee-motoru', ad: 'Apogee engine', sistem: 'itki', step: 2,
    mountsTo: 'alt-panel', arayuz: 'civata', massKg: 11, pos: [0, 0, -1.28], size: [0.3, 0.3, 0.45], sekil: 'nozul',
    tech: { no: 'SD-PRP-030', malzeme: 'Nb-C103 nozzle extension, Ir/Re chamber', guc_W: 15, sicaklik_C: [-30, 60], baglanti: '8 x M6 into the lower panel, thermally isolating washers', detay: '490 N thrust; nozzle area ratio 300; valve heaters 2 x 7.5 W', kalite: 'Qualified for 6000 s total burn' },
    why: 'Circularises the orbit. Its thrust axis must pass through the centre of mass, or every burn spends propellant fighting a torque.' },
  { id: 'iticiler', ad: 'Thrusters (4 x 10 N)', sistem: 'itki', step: 2, qty: 4,
    mountsTo: 'alt-panel', arayuz: 'civata', massKg: 1.2, pos: [0.72, 0.72, -1.16], size: [0.1, 0.1, 0.22], sekil: 'nozul',
    tech: { no: 'SD-PRP-040', malzeme: 'Catalyst bed, stainless body', guc_W: 30, sicaklik_C: [-20, 80], baglanti: 'Corner bracket, 4 x M4; dry-break fluid coupling', detay: '4 off, 10 N each; bed heater 7.5 W per unit, preheated to 120 C before firing', kalite: 'Rated for >5x10^5 pulses' },
    why: 'Attitude control and station keeping. Mounted at the corners so a pair gives pure torque about each axis.' },
  { id: 'besleme-hatlari', ad: 'Feed lines', sistem: 'itki', step: 2,
    mountsTo: 'yakit-tanki', arayuz: 'akiskan', massKg: 9, pos: [0, 0, -0.6], size: [0.8, 0.8, 0.5], sekil: 'boru',
    tech: { no: 'SD-PRP-050', malzeme: '6.35 mm Ti tubing, orbital welded', guc_W: 24, sicaklik_C: [10, 60], baglanti: 'Welded; not separable - leak checks happen during integration', detay: 'Trace heaters 24 W; helium leak limit 1x10^-6 scc/s', kalite: '100% radiography on every weld' },
    why: 'Welded rather than bolted: a fitting that can be undone is a fitting that can leak, and nobody is going up there to retorque it.' },

  /* ADIM 3 — yan paneller (ekipman panele ÖNCEDEN entegre edilir) */
  { id: 'yan-panel-xp', ad: 'Side panel +X', sistem: 'yapi', step: 3,
    mountsTo: 'itki-tupu', arayuz: 'kizak', massKg: 18, pos: [0.86, 0, -0.1], size: [0.03, 1.72, 1.9], sekil: 'panel',
    tech: { no: 'SD-STR-011', malzeme: '25 mm Al honeycomb with embedded heat pipes', guc_W: 0, sicaklik_C: [-100, 90], baglanti: 'Corner brackets, 24 x M5', detay: 'Delivered as a tested subassembly, not as a bare panel', kalite: 'Flatness 0.3 mm' },
    why: 'Equipment is built up on the panel at a bench, then the panel slides onto the spacecraft. Working inside the satellite is expensive.' },
  { id: 'yan-panel-xn', ad: 'Side panel -X', sistem: 'yapi', step: 3,
    mountsTo: 'itki-tupu', arayuz: 'kizak', massKg: 18, pos: [-0.86, 0, -0.1], size: [0.03, 1.72, 1.9], sekil: 'panel',
    tech: { no: 'SD-STR-012', malzeme: '25 mm Al honeycomb with embedded heat pipes', guc_W: 0, sicaklik_C: [-100, 90], baglanti: 'Corner brackets, 24 x M5', detay: 'Harness routes through a relieved edge channel', kalite: 'Flatness 0.3 mm' },
    why: 'The opposite face, built the same way. Symmetry is what lets one bench procedure serve both.' },
  { id: 'radyator-yp', ad: 'Radiator panel +Y', sistem: 'isil', step: 3,
    mountsTo: 'itki-tupu', arayuz: 'kizak', massKg: 22, pos: [0, 0.86, -0.1], size: [1.72, 0.03, 1.9], sekil: 'panel',
    tech: { no: 'SD-THR-060', malzeme: 'OSR mirror coating (a=0.08, e=0.80) on aluminium', guc_W: 0, sicaklik_C: [-120, 80], baglanti: '16 x M4 into the panel, thermal gap filler interface', detay: 'Rejects 1252 W at 30 C - 3.27 m2 x e.sigma.T^4 (e=0.80); the +Y face never sees the Sun, so absorbed flux is taken as zero', kalite: 'OSR end-of-life degradation <10%' },
    why: 'It faces +Y BECAUSE the Sun sweeps the +/-X axis: this face never sees direct sunlight, so everything it radiates is net loss.' },
  { id: 'radyator-yn', ad: 'Radiator panel -Y', sistem: 'isil', step: 3,
    mountsTo: 'itki-tupu', arayuz: 'kizak', massKg: 22, pos: [0, -0.86, -0.1], size: [1.72, 0.03, 1.9], sekil: 'panel',
    tech: { no: 'SD-THR-061', malzeme: 'OSR mirror coating (a=0.08, e=0.80) on aluminium', guc_W: 0, sicaklik_C: [-120, 80], baglanti: '16 x M4 into the panel, thermal gap filler interface', detay: 'Rejects 1252 W at 30 C - 3.27 m2 x e.sigma.T^4 (e=0.80); the -Y face never sees the Sun, so absorbed flux is taken as zero', kalite: 'OSR end-of-life degradation <10%' },
    why: 'The matching face. Two radiators on opposite sides means attitude changes never leave the spacecraft without a cold side.' },

  /* ADIM 4 — panel üstü ekipman */
  { id: 'batarya', ad: 'Battery pack (Li-ion)', sistem: 'guc', step: 4,
    mountsTo: 'radyator-yn', arayuz: 'isil', massKg: 38, pos: [0.3, -0.72, -0.45], size: [0.44, 0.2, 0.34], sekil: 'kutu',
    tech: { no: 'SD-PWR-070', malzeme: 'Li-ion 18650 cells, 8s12p', guc_W: 380, sicaklik_C: [0, 35], baglanti: '8 x M5 into the panel, isolating shim', detay: '28.8 V, 78 Ah, 2.2 kWh; eclipse depth of discharge 55%', kalite: 'Redundant cell balancing' },
    why: 'Carries the spacecraft through eclipse. It mounts to a radiator panel because a hot battery loses life and a cold one loses capacity.' },
  { id: 'pcdu', ad: 'Power control unit (PCDU)', sistem: 'guc', step: 4,
    mountsTo: 'radyator-yp', arayuz: 'civata', massKg: 21, pos: [-0.3, 0.72, -0.45], size: [0.4, 0.2, 0.3], sekil: 'kutu',
    tech: { no: 'SD-PWR-071', malzeme: 'Al 6061 housing, iridite finish', guc_W: 85, sicaklik_C: [-25, 60], baglanti: '6 x M5 onto a radiator panel, gap filler', detay: '93% efficient, so 85 W of waste heat; 42 switched outputs with overcurrent protection', kalite: 'Dual bus, cross-strapped' },
    why: 'Every watt on the spacecraft passes through it, so its 7% loss becomes 85 W of heat that has to go somewhere.' },
  { id: 'tepki-tekerlekleri', ad: 'Reaction wheels (4)', sistem: 'adcs', step: 4, qty: 4,
    mountsTo: 'alt-panel', arayuz: 'civata', massKg: 7.5, pos: [0.45, 0.45, -0.85], size: [0.26, 0.26, 0.16], sekil: 'tekerlek',
    tech: { no: 'SD-ACS-080', malzeme: 'Steel rotor, ceramic bearings, aluminium housing', guc_W: 22, sicaklik_C: [-15, 50], baglanti: 'Pyramid bracket, 4 x M6; vibration isolated', detay: '4 off, 0.2 N.m torque, 30 N.m.s storage; 6000 rpm maximum', kalite: 'Pyramid layout survives one wheel failure' },
    why: 'Four wheels in a pyramid, not three on the axes: with a pyramid any single failure still leaves three-axis control.' },
  { id: 'yildiz-izleyici', ad: 'Star trackers (2)', sistem: 'adcs', step: 4, qty: 2,
    mountsTo: 'yan-panel-xn', arayuz: 'civata', massKg: 5.5, pos: [-0.92, 0.3, 0.55], size: [0.18, 0.18, 0.34], sekil: 'bafil',
    tech: { no: 'SD-ACS-081', malzeme: 'Ti optical bench, aluminium baffle', guc_W: 12, sicaklik_C: [-30, 45], baglanti: 'Isostatic three-point, M4 - panel bending must not reach the optics', detay: '2 off, boresights 90 deg apart; 2 arcsec cross-axis, 12 arcsec about roll', kalite: '30 deg Sun exclusion angle' },
    why: 'Two heads 90 degrees apart, so a Sun or Earth intrusion into one never blinds both at once.' },
  { id: 'imu', ad: 'Inertial measurement unit', sistem: 'adcs', step: 4,
    mountsTo: 'itki-tupu', arayuz: 'civata', massKg: 4.2, pos: [0.25, 0.25, 0.1], size: [0.2, 0.2, 0.16], sekil: 'kutu',
    tech: { no: 'SD-ACS-082', malzeme: 'Ring laser gyro block', guc_W: 18, sicaklik_C: [-20, 55], baglanti: 'Near the centre of mass, 4 x M5', detay: 'Drift 0.003 deg/hour; carries attitude while the trackers are out', kalite: 'Redundant dual block' },
    why: 'Bridges the gaps when the star trackers are blinded. Mounted near the centre of mass so rotation and translation stay separable.' },
  { id: 'manyetik-cubuk', ad: 'Magnetorquers (3)', sistem: 'adcs', step: 4, qty: 3,
    mountsTo: 'yan-panel-xp', arayuz: 'civata', massKg: 2.4, pos: [0.9, -0.4, 0.2], size: [0.06, 0.06, 0.5], sekil: 'cubuk',
    tech: { no: 'SD-ACS-083', malzeme: 'Permalloy core, copper winding', guc_W: 9, sicaklik_C: [-40, 70], baglanti: 'Saddle clamps on the panel edge, 2 x M4', detay: '3 off, 150 A.m2; desaturates the wheels without spending propellant', kalite: 'Residual magnetisation <0.5 A.m2' },
    why: 'Dumps wheel momentum against the Earth field. It costs power instead of propellant, and power comes back every orbit.' },
  { id: 'transponder', ad: 'Transponder and TWTA', sistem: 'haberlesme', step: 4,
    mountsTo: 'radyator-yp', arayuz: 'isil', massKg: 16, pos: [0.3, 0.72, 0.3], size: [0.36, 0.2, 0.34], sekil: 'kutu',
    tech: { no: 'SD-TTC-090', malzeme: 'Aluminium housing, waveguide output', guc_W: 210, sicaklik_C: [-15, 55], baglanti: '6 x M5 onto a radiator panel, waveguide flange', detay: 'TWTA 120 W RF output, 62% efficient; X band', veri_Mbps: 150, kalite: 'Fully redundant behind a switch matrix' },
    why: 'The link home. Its travelling wave tube is 62% efficient, which makes it the second largest heat source on the spacecraft.' },

  /* ADIM 5 — üst güverte ve faydalı yük */
  { id: 'ust-panel', ad: 'Upper panel (payload deck)', sistem: 'yapi', step: 5,
    mountsTo: 'itki-tupu', arayuz: 'civata', massKg: 26, pos: [0, 0, 0.86], size: [1.72, 1.72, 0.03], sekil: 'panel',
    tech: { no: 'SD-STR-013', malzeme: '25 mm Al honeycomb, CFRP facesheets', guc_W: 0, sicaklik_C: [-130, 120], baglanti: '28 x M5 into the side panels', detay: 'Carries the payload; the optical alignment pins live here', kalite: 'Alignment repeatability 0.05 mm' },
    why: 'The payload deck. Its alignment pins are the reference the optics are set to, so it is machined to a tighter tolerance than the rest.' },
  { id: 'faydali-yuk', ad: 'Payload (optical bench)', sistem: 'faydali', step: 5,
    mountsTo: 'ust-panel', arayuz: 'civata', massKg: 96, pos: [0, 0, 1.28], size: [0.7, 0.7, 0.8], sekil: 'silindir',
    tech: { no: 'SD-PLD-100', malzeme: 'Zerodur mirror, Invar bench', guc_W: 620, sicaklik_C: [18, 22], baglanti: 'Isostatic three-point bipods, M8 - structural strain never reaches the optics', isiYolu: 'Detector cooler -> heat pipe -> radiator +Y (heat pipes); body heaters run closed loop', detay: '3.2 m focal length; needs +/-0.5 K stability, held by closed-loop heaters', veri_Mbps: 420, kalite: 'The narrow band is what sets the whole thermal design' },
    why: 'The reason the spacecraft exists. Its 4 K temperature band is the tightest requirement on board and it drives the entire thermal design.' },
  { id: 'faydali-elektronik', ad: 'Payload electronics', sistem: 'faydali', step: 5,
    mountsTo: 'ust-panel', arayuz: 'civata', massKg: 18, pos: [-0.45, 0.35, 0.98], size: [0.34, 0.26, 0.2], sekil: 'kutu',
    tech: { no: 'SD-PLD-101', malzeme: 'Aluminium housing, multilayer backplane', guc_W: 340, sicaklik_C: [-20, 55], baglanti: '8 x M5 onto the upper panel, gap filler interface', isiYolu: 'Embedded heat pipe -> side panel -> radiator -Y (heat pipes)', detay: 'Short cable run to the detector but thermally SEPARATE: its 340 W is carried out by heat pipe. 420 Mbps raw, compressed 4:1 to 105 Mbps', veri_Mbps: 105, sikistirma: 4, kalite: 'Hot-redundant signal chain' },
    why: 'Close to the detector for a short cable run, but thermally decoupled from it: 340 W next to a bench that needs half a kelvin would be fatal.' },

  /* ADIM 6 — ısıl kapanış */
  { id: 'isi-borulari', ad: 'Heat pipes', sistem: 'isil', step: 6,
    mountsTo: 'radyator-yp', arayuz: 'isil', massKg: 8, pos: [0, 0.8, -0.1], size: [1.6, 0.04, 1.7], sekil: 'boru',
    tech: { no: 'SD-THR-062', malzeme: 'Grooved aluminium pipe, ammonia working fluid', guc_W: 0, sicaklik_C: [-40, 70], baglanti: 'Embedded in the panel with gap filler; not separable', detay: '8 runs; 120 W.m capacity each; capillary return, no gravity needed', kalite: '>200 freeze-thaw cycles' },
    why: 'Moves heat from the boxes to the radiators with no pump and no power. In zero g the wick does the returning.' },
  { id: 'mli', ad: 'MLI blankets', sistem: 'isil', step: 6,
    mountsTo: 'itki-tupu', arayuz: 'civata', massKg: 17, pos: [0, 0, -0.1], size: [1.8, 1.8, 2.0], sekil: 'kabuk',
    tech: { no: 'SD-THR-063', malzeme: '20-layer aluminised Kapton with Dacron netting', guc_W: 0, sicaklik_C: [-160, 150], baglanti: 'Hook-and-loop and tape; goes on LAST', detay: 'Effective emissivity 0.02; a grounding tab at every seam', kalite: 'Nothing underneath can be touched again' },
    why: 'Twenty layers of metallised film; it cuts radiative exchange. It goes on LAST because once it is on, every bolt underneath is unreachable.' },
  { id: 'kablaj', ad: 'Harness', sistem: 'kablaj', step: 6,
    mountsTo: 'itki-tupu', arayuz: 'elektrik', massKg: 38, pos: [0, 0, -0.2], size: [1.5, 1.5, 1.6], sekil: 'gizli',
    tech: { no: 'SD-HAR-110', malzeme: 'Silver-plated copper, PTFE insulation, Kapton lacing', guc_W: 0, sicaklik_C: [-60, 85], baglanti: 'D-sub and circular connectors; cable trays and P-clamps', detay: '1420 terminations; prime and redundant paths take PHYSICALLY separate routes', kalite: '100% continuity and insulation tested' },
    why: '1420 terminations. Prime and redundant runs go down PHYSICALLY separate routes, so one damaged bundle cannot take both.' },

  /* ADIM 7 — açılır elemanlar (fırlatmada katlı) */
  { id: 'sada-xp', ad: 'Solar array drive +X', sistem: 'guc', step: 7,
    mountsTo: 'yan-panel-xp', arayuz: 'civata', massKg: 9, pos: [1.0, 0, 0.35], size: [0.22, 0.22, 0.24], sekil: 'silindir',
    tech: { no: 'SD-PWR-072', malzeme: 'Slip ring, harmonic drive', guc_W: 14, sicaklik_C: [-45, 70], baglanti: '6 x M6 into the side panel; slide rail interface', detay: 'Continuous rotation; 2 power and 4 signal rings; 1 rev per day', kalite: 'Brush life 3x mission' },
    why: 'Lets the wing track the Sun while the body points at the target. The slip rings are what make continuous rotation possible.' },
  { id: 'sada-xn', ad: 'Solar array drive -X', sistem: 'guc', step: 7,
    mountsTo: 'yan-panel-xn', arayuz: 'civata', massKg: 9, pos: [-1.0, 0, 0.35], size: [0.22, 0.22, 0.24], sekil: 'silindir',
    tech: { no: 'SD-PWR-073', malzeme: 'Slip ring, harmonic drive', guc_W: 14, sicaklik_C: [-45, 70], baglanti: '6 x M6 into the side panel; slide rail interface', detay: 'Opposite wing; the two drives are independent', kalite: 'Brush life 3x mission' },
    why: 'The opposite drive, independently commanded, so one seized bearing does not cost both wings.' },
  { id: 'kanat-xp', ad: 'Solar wing +X (3 panels)', sistem: 'guc', step: 7,
    mountsTo: 'sada-xp', arayuz: 'mentese', massKg: 44, pos: [3.55, 0, 0.35], size: [4.5, 1.7, 0.03], sekil: 'kanat',
    tech: { no: 'SD-PWR-074', malzeme: 'GaAs triple-junction cells, CFRP substrate', guc_W: -2585, sicaklik_C: [-150, 110], baglanti: '4 x M6 to the SADA shaft; hinge and spring deployment', detay: '3 panels, 7.65 m2; 1361 W/m2 x 30% cells x 0.90 packing x 0.92 temperature derate = 338 W/m2, so 2585 W at BOL (26% at EOL); one-way latching deployment', kalite: 'Redundant pyro release' },
    why: 'Generates 1450 W at beginning of life. It launches folded because nothing this size fits inside a fairing deployed.' },
  { id: 'kanat-xn', ad: 'Solar wing -X (3 panels)', sistem: 'guc', step: 7,
    mountsTo: 'sada-xn', arayuz: 'mentese', massKg: 44, pos: [-3.55, 0, 0.35], size: [4.5, 1.7, 0.03], sekil: 'kanat',
    tech: { no: 'SD-PWR-075', malzeme: 'GaAs triple-junction cells, CFRP substrate', guc_W: -2585, sicaklik_C: [-150, 110], baglanti: '4 x M6 to the SADA shaft; hinge and spring deployment', detay: 'Opposite wing; 5170 W generated in total at BOL, which is what electric propulsion costs', kalite: 'Redundant pyro release' },
    why: 'The matching wing. Two wings balance the solar pressure torque that a single one would impose.' },
  { id: 'hga-boom', ad: 'HGA boom', sistem: 'haberlesme', step: 7,
    mountsTo: 'ust-panel', arayuz: 'mentese', massKg: 6, pos: [0.55, -0.55, 1.1], size: [0.08, 0.08, 0.7], sekil: 'cubuk',
    tech: { no: 'SD-TTC-091', malzeme: 'CFRP tube, Ti end fittings', guc_W: 0, sicaklik_C: [-140, 120], baglanti: 'Hinge and latch; stowed for launch', detay: '1.8 m; first mode 12 Hz, deliberately above the reaction wheel band', kalite: 'Dual latch sensors' },
    why: 'Holds the dish clear of the body so the beam is never blocked. Its first mode is placed above the wheel speed band so the two never couple.' },
  { id: 'hga', ad: 'High-gain antenna (1.2 m)', sistem: 'haberlesme', step: 7,
    mountsTo: 'hga-boom', arayuz: 'mentese', massKg: 13, pos: [0.85, -0.85, 1.5], size: [1.2, 1.2, 0.3], sekil: 'canak',
    tech: { no: 'SD-TTC-092', malzeme: 'CFRP shell, mesh reflector', guc_W: 26, sicaklik_C: [-140, 120], baglanti: 'Two-axis gimbal, M5; rotary waveguide joint', detay: '1.2 m dish; 43 dBi at X band; 1.6 deg beamwidth', veri_Mbps: 150, kalite: 'If the gimbal seizes, telemetry continues through the LGA' },
    why: 'A 1.6 degree beam is what makes 150 Mbps possible, and a beam that narrow has to be pointed, which is why it sits on a two-axis gimbal.' },
  { id: 'lga', ad: 'Low-gain antenna', sistem: 'haberlesme', step: 7, qty: 2,
    mountsTo: 'yan-panel-xp', arayuz: 'civata', massKg: 1.1, pos: [0.9, 0.5, 0.75], size: [0.08, 0.08, 0.26], sekil: 'cubuk',
    tech: { no: 'SD-TTC-093', malzeme: 'Helical antenna under a radome', guc_W: 2, sicaklik_C: [-120, 110], baglanti: '3 x M4 into the panel', detay: 'Near-hemispherical coverage; commandable even with the HGA lost', veri_Mbps: 0.064, kalite: 'The always-available command path - recovery mode' },
    why: 'Near-hemispherical coverage at a trickle rate. It is the reason a tumbling spacecraft can still be commanded.' },

  /* ADIM 6 — elektrikli itki ve manyetik ölçüm */
  { id: 'hall-itici', ad: 'Hall thruster (1.5 kW, xenon)', sistem: 'itki', step: 6, qty: 2,
    mountsTo: 'alt-panel', arayuz: 'civata', massKg: 5.6, pos: [0.52, 0, -0.96], size: [0.26, 0.26, 0.22],
    sekil: 'hall', detay: { coils: 4, bolts: 12, cathode: true, feed: true },
    tech: { no: 'SD-EPS-001', malzeme: 'Boron nitride discharge channel, ferromagnetic poles', guc_W: 0, sicaklik_C: [-30, 300], baglanti: '12 x M5 through a titanium thermal standoff', detay: 'Isp 1600 s, thrust 90 mN, 300 V discharge, hollow LaB6 cathode. Its 1500 W is drawn THROUGH the PPU, so the bus load is declared there and not here', kalite: 'Life-tested to 9000 h; channel erosion is the end of life' },
    why: 'Sixteen times the exhaust speed of the chemical engine, so station keeping for a 15-year life costs tens of kilograms of xenon instead of hundreds of kilograms of bipropellant.' },
  { id: 'ppu', ad: 'Power processing unit (PPU)', sistem: 'itki', step: 6,
    mountsTo: 'radyator-yn', arayuz: 'isil', massKg: 12.5, pos: [-0.3, -0.72, 0.3], size: [0.38, 0.2, 0.3],
    sekil: 'kutu',
    tech: { no: 'SD-EPS-002', malzeme: 'Aluminium housing, conduction-cooled', guc_W: 1600, uzayaW: 1500, sicaklik_C: [-20, 60], baglanti: '8 x M5 with thermal filler', detay: '1500 W to the thruster at 94% efficiency, so 1596 W in and 96 W of waste heat on the radiator. One string fires at a time', kalite: 'Qualified with the thruster as one string' },
    why: 'A Hall thruster needs 300 V and a regulated cathode supply; the bus gives 100 V. The 6% that does not become thrust becomes heat on a radiator.' },
  { id: 'manyetometre-cubugu', ad: 'Magnetometer boom (1.2 m, stowed)', sistem: 'yapi', step: 7,
    mountsTo: 'yan-panel-xn', arayuz: 'mentese', massKg: 2.2, pos: [-1.05, -0.45, 0.6], size: [0.07, 0.07, 1.2],
    sekil: 'cubuk',
    tech: { no: 'SD-STR-005', malzeme: 'CFRP tube, titanium end fittings, no ferrous parts', guc_W: 0, sicaklik_C: [-150, 120], baglanti: 'Hinge with a launch latch; released by a pyro cutter', detay: '1.2 m deployed; residual bus field falls as 1/r^3' },
    why: 'Distance is the only cheap magnetic shield. A metre of boom cuts the spacecraft\u2019s own field at the sensor by roughly a thousandfold.' },
  { id: 'manyetometre', ad: 'Fluxgate magnetometer (triad)', sistem: 'adcs', step: 7,
    mountsTo: 'manyetometre-cubugu', arayuz: 'civata', massKg: 1.2, pos: [-1.05, -0.45, 1.35], size: [0.14, 0.14, 0.14],
    sekil: 'magnetometer', detay: { shade: true, pigtail: true, cube: true },
    tech: { no: 'SD-ACS-084', malzeme: 'Non-magnetic composite housing, three ring cores', guc_W: 1.1, sicaklik_C: [-40, 60], baglanti: '3-point kinematic mount, 3 x M4 titanium', detay: 'Range +/-64000 nT, resolution 0.1 nT, 16 Hz; optical alignment cube', kalite: 'Calibrated in a Helmholtz coil facility; bias re-fitted in flight' },
    why: 'Three orthogonal ring cores give the field vector, which feeds the magnetorquers and gives a coarse attitude reference when the star trackers are blinded.' },
]);

/* ── ENTEGRASYON AKIŞI ───────────────────────────────────────────────── */
export const STEPS = Object.freeze([
  { no: 1, ad: 'Primary structure', aciklama: 'Separation ring, thrust tube and lower panel come together. Every dimension after this is measured from that datum.' },
  { no: 2, ad: 'Propulsion', aciklama: 'The tank goes down inside the tube, lines are welded, leak checks run. Once the panels close, nobody gets back in here.' },
  { no: 3, ad: 'Side panels', aciklama: 'Panels are built up and tested on a bench with their equipment, then slide onto the spacecraft. Working inside the satellite is expensive.' },
  { no: 4, ad: 'Panel-mounted equipment', aciklama: 'Battery, PCDU, wheels, star trackers, transponder. Anything that makes heat sits on a radiator panel.' },
  { no: 5, ad: 'Upper deck and payload', aciklama: 'The payload is mounted on an isostatic three-point interface; the top panel closes.' },
  { no: 6, ad: 'Thermal close-out and harness', aciklama: 'Heat pipes, harness, and MLI last. Once the blankets are on, the bolts underneath are unreachable.' },
  { no: 7, ad: 'Deployables', aciklama: 'Wings, SADAs, the HGA boom and the antennas go on stowed; they open on orbit.' },
]);

/* ── SORGULAR (saf) ──────────────────────────────────────────────────── */

const say = p => p.qty ?? 1;

/** Parçanın toplam kütlesi (adet × birim). */
export const partMass = p => say(p) * p.massKg;

/** Kimliğe göre parça. */
export function partById(id) { return PARTS.find(p => p.id === id) || null; }

/**
 * Kütle bütçesi. Kuru kütle itici YAKITI hariçtir — bu ayrım bütçenin
 * en sık karıştırılan yeridir ve burada ayrı satırdır.
 */
export function massBudget() {
  const sistem = {};
  let kuru = 0, itici = 0;
  for (const p of PARTS) {
    const m = partMass(p);
    if (p.id === 'itici-yakit') { itici += m; continue; }
    kuru += m;
    sistem[p.sistem] = (sistem[p.sistem] || 0) + m;
  }
  const siralı = Object.entries(sistem)
    .map(([k, v]) => ({ sistem: k, ad: SUBSYSTEMS[k].ad, kg: Number(v.toFixed(1)), pay: v / kuru }))
    .sort((a, b) => b.kg - a.kg);
  return {
    kuruKg: Number(kuru.toFixed(1)),
    iticiKg: Number(itici.toFixed(1)),
    firlatmaKg: Number((kuru + itici).toFixed(1)),
    sistemler: siralı,
    parcaSayisi: PARTS.reduce((s, p) => s + say(p), 0),
  };
}

/**
 * Kütle merkezi (gövde koordinatı, metre). Ayırma halkası ekseni x=y=0'dır;
 * merkez bu eksenden kayarsa apogee yakışı uyduyu döndürür.
 */
export function centerOfMass({ yakitli = true } = {}) {
  let M = 0, x = 0, y = 0, z = 0;
  for (const p of PARTS) {
    if (!yakitli && p.id === 'itici-yakit') continue;
    const m = partMass(p);
    M += m; x += m * p.pos[0]; y += m * p.pos[1]; z += m * p.pos[2];
  }
  return { x: x / M, y: y / M, z: z / M, kg: Number(M.toFixed(1)) };
}

/** Montaj ağacı: her parçanın çocukları. */
export function tree() {
  const cocuk = new Map();
  for (const p of PARTS) {
    const k = p.mountsTo;
    if (!cocuk.has(k)) cocuk.set(k, []);
    cocuk.get(k).push(p);
  }
  return cocuk;
}

/** Bir parçanın köke kadar bağlanma zinciri — "bu neyin üstünde duruyor". */
export function mountChain(id) {
  const zincir = [];
  let p = partById(id);
  while (p) { zincir.push(p); p = p.mountsTo ? partById(p.mountsTo) : null; }
  return zincir;
}

/** Montaj derinliği: patlatmada ne kadar uzağa gideceğini belirler. */
export function depth(id) { return mountChain(id).length - 1; }

/** Adım adım entegrasyon listesi. */
export function integrationOrder() {
  return STEPS.map(s => ({ ...s, parcalar: PARTS.filter(p => p.step === s.no) }));
}

/** Manifest ve altyazı için özet. */
/* ── teknik bütçeler ──────────────────────────────────────────────────
   Künyedeki sayılar bir süs değil: toplandıklarında kapanmak ZORUNDA.
   Kapanmıyorsa ya tasarım ya da beyan yanlıştır ve denetim ikisini de
   ayırt edemez — bu yüzden hatayı yüksek sesle bildirir. */

/** Güç bütçesi. Negatif `guc_W` ÜRETİM, pozitif TÜKETİMdir. */
export function powerBudget() {
  let uretim = 0, tuketim = 0;
  const kalemler = [];
  for (const p of PARTS) {
    const g = p.tech?.guc_W ?? 0;
    if (!g) continue;
    const n = p.qty ?? 1;
    const w = g * n;
    if (w < 0) uretim += -w; else tuketim += w;
    kalemler.push({ id: p.id, ad: p.ad, W: w, adet: n });
  }
  return {
    uretimW: uretim, tuketimW: tuketim,
    payW: uretim - tuketim,
    pay: uretim ? (uretim - tuketim) / uretim : 0,
    kalemler: kalemler.sort((a, b) => Math.abs(b.W) - Math.abs(a.W)),
  };
}

/**
 * Veri zinciri: faydalı yük HAM üretir, elektronik sıkıştırır, verici
 * indirir. Sıkıştırılmış hız indirme kapasitesini aşarsa veri birikir;
 * bu sessiz bir tasarım hatasıdır, denetim onu yakalar.
 */
export function dataBudget() {
  const ham = partById('faydali-yuk')?.tech?.veri_Mbps ?? 0;
  const elektronik = partById('faydali-elektronik')?.tech ?? {};
  const sikisik = elektronik.veri_Mbps ?? ham;
  const oran = elektronik.sikistirma ?? 1;
  const indirme = partById('hga')?.tech?.veri_Mbps ?? 0;
  const kurtarma = partById('lga')?.tech?.veri_Mbps ?? 0;
  return {
    hamMbps: ham, sikistirma: oran, sikisikMbps: sikisik,
    indirmeMbps: indirme, kurtarmaMbps: kurtarma,
    tutarli: Math.abs(sikisik - ham / oran) < 0.5,
    payMbps: indirme - sikisik,
    yeterli: indirme >= sikisik,
  };
}

/** Radyatör görevi gören parçalar — ısı yolunun bittiği yer. */
export const RADYATORLER = Object.freeze(['radyator-yp', 'radyator-yn']);

/**
 * Isıl yol denetimi. Anlamlı ısı üreten her kutu ya doğrudan bir radyatör
 * paneline bağlıdır ya da ısısının oraya NASIL gittiğini beyan eder. Beyan
 * yoksa ısı bir yere gitmiyor demektir: çizimde görünmeyen ama gerçekte
 * uyduyu pişiren türden bir hata. Denetim ilk koşumda faydalı yük
 * elektroniğini yakaladı — künyesi "radyatör paneline" diyordu ama katalog
 * onu üst panele bağlıyordu.
 */
export function thermalPaths(esikW = 50) {
  return heatSources(esikW).map(k => {
    const p = partById(k.id);
    const dogrudan = RADYATORLER.includes(p.mountsTo);
    const beyan = p.tech?.isiYolu || null;
    return { ...k, dogrudan, beyan, ok: dogrudan || Boolean(beyan) };
  });
}

/** Stefan–Boltzmann sabiti (W·m⁻²·K⁻⁴). */
export const SIGMA = 5.670374419e-8;

/**
 * Isıl kapanış: radyatörlerin atabildiği güç, atılması gereken güçten
 * büyük olmalı. Atılması gereken = elektrik tüketimi − RF olarak YAYILAN
 * güç (o ısıya dönmez, uzaya gider).
 *
 * Kapasite radyatörün BEYAN EDİLEN geometrisinden hesaplanır, künyeye
 * elle yazılan bir sayıdan değil. İlk künyede 340 W yazıyordu; aynı
 * panelin alanı ve kaplaması 1252 W veriyor — dört kat fark, ve o fark
 * yalnızca hesap yapılınca görünüyor.
 */
export function thermalClosure({ T_C = 30, rfW = 120 } = {}) {
  const T = T_C + 273.15;
  let kapasite = 0;
  const paneller = [];
  for (const id of RADYATORLER) {
    const p = partById(id);
    if (!p) continue;
    /* Panelin ışıyan yüzü en büyük iki boyutun çarpımıdır; üçüncüsü kalınlık. */
    const [a, b, c] = [...p.size].sort((x, y) => y - x);
    const alan = a * b;
    const eps = 0.80;                                   // OSR kaplama
    const W = eps * SIGMA * Math.pow(T, 4) * alan;
    kapasite += W;
    paneller.push({ id: p.id, alanM2: Number(alan.toFixed(3)), kalinlikM: c, W: Math.round(W) });
  }
  const guc = powerBudget();
  /* Power a part declares as leaving the spacecraft WITHOUT passing through
     a radiator: the ion beam's kinetic energy and the thruster's own
     300 C surface. RF was already handled this way; adding electric
     propulsion without the same term made the margin read -163%. */
  const uzaya = PARTS.reduce((a, q) => a + (q.tech?.uzayaW ?? 0) * (q.qty ?? 1), 0);
  const atilacak = guc.tuketimW - rfW - uzaya;
  return {
    T_C, rfW, uzayaW: uzaya, paneller,
    kapasiteW: Math.round(kapasite),
    atilacakW: Math.round(atilacak),
    payW: Math.round(kapasite - atilacak),
    pay: (kapasite - atilacak) / kapasite,
    kapaniyor: kapasite >= atilacak,
  };
}

/** Isıl künye: sıcaklık bandı en DAR olan bileşen ısıl tasarımı belirler. */
export function thermalDriver() {
  let enDar = null;
  for (const p of PARTS) {
    const t = p.tech?.sicaklik_C;
    if (!t) continue;
    const genislik = t[1] - t[0];
    if (!enDar || genislik < enDar.genislik) enDar = { id: p.id, ad: p.ad, bant: t, genislik };
  }
  return enDar;
}

/** Isı üreten kutular: nereye bağlılar? */
export function heatSources(esikW = 50) {
  return PARTS.filter(p => (p.tech?.guc_W ?? 0) >= esikW)
    .map(p => ({ id: p.id, ad: p.ad, W: (p.tech.guc_W) * (p.qty ?? 1), baglandigi: p.mountsTo }))
    .sort((a, b) => b.W - a.W);
}

export function describe() {
  const b = massBudget();
  const c = centerOfMass();
  const ck = centerOfMass({ yakitli: false });
  return {
    parca: PARTS.length, adet: b.parcaSayisi, adim: STEPS.length,
    kuruKg: b.kuruKg, iticiKg: b.iticiKg, firlatmaKg: b.firlatmaKg,
    kutleMerkeziYakitli: [c.x, c.y, c.z].map(v => Number(v.toFixed(3))),
    kutleMerkeziKuru: [ck.x, ck.y, ck.z].map(v => Number(v.toFixed(3))),
    eksendenSapmaMm: Number((Math.hypot(c.x, c.y) * 1000).toFixed(1)),
  };
}
