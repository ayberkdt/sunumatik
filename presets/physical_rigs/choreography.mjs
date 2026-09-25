/* choreography.mjs — MEKANİZMA GÖSTERİLERİ: her araç türü için, zamanın SAF
   fonksiyonu olan bir komut programı (webgl-scene-contract: her hareket
   f(t, seed); duvar saati yok). Program eklem HEDEFLERİNİ verir; hedefe
   gitme dinamiği rig-core'dadır (hız sınırı, kritik sönüm, tek yön).

   Her program { period, apply(rig, t, ctx) } döndürür. ctx: { fps } .
   Programlar üst üste binmez: bir anda BİR mekanizma anlatılır (ux: tek
   vurgu). Süreler gerçek aktüatör hızlarına göre seçildi (spec.rateDegS). */

import { solveRockerBogie, ackermann, wheelAdvance, slipRatio, DEG } from './rig-core.mjs';
import { ROVER_GEOM } from './rover-drive.mjs';

const seg = (t, a, b) => t >= a && t < b;                     // [a, b)
const lerp = (a, b, u) => a + (b - a) * Math.min(1, Math.max(0, u));

/* Gezgin geometrisi TEK KAYNAKTAN (rover-drive.ROVER_GEOM); burada ikinci
   bir kopya tutmak, Lrocker düzeltmesinin yalnız bir yerde uygulanmasına
   ve iki modülün sessizce ayrışmasına yol açardı. */
const ROVER = { wR: ROVER_GEOM.wheelRadius, Lrocker: ROVER_GEOM.Lrocker,
  Lbogie: ROVER_GEOM.Lbogie, track: ROVER_GEOM.track, wheelbase: ROVER_GEOM.wheelbase };

/* Sentetik arazi: iki kayanın üstünden geçiş (düz + iki Gauss tümsek). Yol
   koordinatı s (tasarım birimi). Sahne arazisine bağlı değil: vitrin. */
function bump(s) {
  const g = (c, w, h) => h * Math.exp(-((s - c) * (s - c)) / (2 * w * w));
  return g(1.4, 0.18, 0.09) + g(3.1, 0.25, 0.06);
}

export const PROGRAMS = {
  /* Gezgin: sürüş (tekerlek ω = v/r, kayma, rocker-bogie arazi takibi) →
     yerinde dönüş → direk panoraması → kol uzanması → çanak takibi. */
  rover: () => {
    const wheels = {};
    for (const n of ['FL', 'ML', 'RL', 'FR', 'MR', 'RR']) wheels[n] = { theta: 0, odometer: 0 };
    let sL = 0, sR = 0;                                       // yol koordinatı (yan başına)
    let lastT = 0;
    return {
      period: 34,
      reset() { for (const w of Object.values(wheels)) { w.theta = 0; w.odometer = 0; } sL = sR = 0; lastT = 0; },
      apply(rig, t) {
        const dt = Math.max(0, t - lastT); lastT = t;
        const v = seg(t, 0, 9) ? 0.45 : 0;                     // tasarım birimi/s (~4,5 cm/s gerçek ölçekte ×10 sinematik)
        /* sürüş: yol koordinatı, tümsek → temas yükseklikleri → kinematik */
        if (v > 0) {
          const slope = Math.atan2(bump(sL + 0.02) - bump(sL), 0.02);
          const s = slipRatio(slope);
          sL += v * dt; sR += v * dt;
          for (const [n, off] of [['F', 0.44], ['M', -0.07], ['R', -0.44]]) {
            wheelAdvance(wheels[`${n}L`], { v, r: ROVER.wR, slip: s, dt });
            wheelAdvance(wheels[`${n}R`], { v, r: ROVER.wR, slip: s * 0.6, dt });
            void off;
          }
        }
        const hs = (s0, gain) => ({ hF: bump(s0 + 0.44) * gain, hM: bump(s0 - 0.07) * gain, hR: bump(s0 - 0.44) * gain });
        const kin = solveRockerBogie(hs(sL, 1), hs(sR, 0.35), { Lbogie: ROVER.Lbogie, Lrocker: ROVER.Lrocker, track: ROVER.track });
        /* işaret: +Y dönüşü +X'i −Z'ye (aşağı) götürür; ρ>0 = ön tekerlek alçakta → burun aşağı */
        rig.set('rocker.L', kin.rockerL / DEG); rig.set('rocker.R', kin.rockerR / DEG);
        rig.set('bogie.L', kin.bogieL / DEG); rig.set('bogie.R', kin.bogieR / DEG);
        rig.set('differential', kin.differential / DEG);
        /* yerinde dönüş 9–15 s: köşeler Ackermann R=0, tekerlekler zıt yönde */
        const yd = ackermann(seg(t, 9, 15) ? 0 : Infinity, { L: ROVER.wheelbase, w: ROVER.track });
        rig.set('steer.FL', yd.innerFront / DEG); rig.set('steer.FR', yd.outerFront / DEG);
        rig.set('steer.RL', yd.innerRear / DEG); rig.set('steer.RR', yd.outerRear / DEG);
        if (seg(t, 10.5, 14.5)) {
          const w = 0.35 / ROVER.wR;                           // yavaş yerinde dönüş
          for (const n of ['FL', 'ML', 'RL']) wheels[n].theta += w * dt;
          for (const n of ['FR', 'MR', 'RR']) wheels[n].theta -= w * dt;
        }
        for (const [n, w] of Object.entries(wheels)) rig.setSpinAngle(`wheel.${n}`, w.theta, w.omega || 0);
        /* direk panoraması 14–21 s: 3 sıra × 5 sütun mozaik (gerçek panorama alımı) */
        if (seg(t, 14, 21)) {
          const u = (t - 14) / 7, row = Math.floor(u * 3), col = Math.floor((u * 3 - row) * 5);
          rig.set('mast.pan', -60 + col * 30);
          rig.set('mast.tilt', 10 - row * 15);
        } else { rig.set('mast.pan', 0); rig.set('mast.tilt', 0); }
        /* kol 21–32 s: stow → hazır → hedef → stow (aktüatör 10°/s: gerçek kol yavaştır) */
        if (seg(t, 21, 24)) { rig.set('arm.j1', -30); rig.set('arm.j2', 40); rig.set('arm.j3', -50); }
        else if (seg(t, 24, 29)) { rig.set('arm.j1', -50); rig.set('arm.j2', 60); rig.set('arm.j3', -90); rig.set('arm.turret', 90); }
        else { rig.set('arm.j1', 0); rig.set('arm.j2', 0); rig.set('arm.j3', 0); rig.set('arm.turret', 0); }
        /* çanak: Dünya'yı izle (yavaş sabit sürüklenme) */
        rig.set('hga.az', 40 + 20 * Math.sin(t * 0.3)); rig.set('hga.el', 50);
        return { wheels, kin, drive: v > 0, turnInPlace: seg(t, 9, 15), slip: v > 0 ? slipRatio(Math.atan2(bump(sL + 0.02) - bump(sL), 0.02)) : 0 };
      },
    };
  },

  /* Yörünge aracı: SADA Güneş takibi (sürekli, yavaş) · çanak yeniden
     yönlendirme (8 s'de bir yeni Dünya yönü) · panjur açılıp kapanma · ana
     yanmada gimbal dairesi (ağırlık merkezi kayması). */
  orbiter: () => ({
    period: 32,
    apply(rig, t) {
      rig.set('wing.L.sada', -20 + t * 0.9); rig.set('wing.R.sada', -20 + t * 0.9);
      const k = Math.floor(t / 8) % 4;
      rig.set('hga.az', [-40, 30, 110, -100][k]); rig.set('hga.el', [20, 70, 45, 10][k]);
      rig.set('radiator.louvers', seg(t, 12, 24) ? 70 : 8);
      const burn = seg(t, 20, 26);
      rig.set('engine.gimbal', burn ? [3 * Math.sin(t * 1.5), 3 * Math.cos(t * 1.5)] : [0, 0]);
      return { burn, louversOpen: seg(t, 12, 24) };
    },
  }),

  /* İniş aracı: yaklaşma (gimbal düzeltmeleri, çanak Dünya'da) → temas (t=6):
     dört bacak farklı zamanda ezilir (yamaç), tek yönlü ve kalıcı → sessizlik. */
  lander: () => ({
    period: 20,
    apply(rig, t) {
      const approach = t < 6;
      rig.set('engine.gimbal', approach ? [2.5 * Math.sin(t * 2.2), 1.5 * Math.cos(t * 1.7)] : [0, 0]);
      const touch = [6.0, 6.08, 6.2, 6.3], stroke = [0.07, 0.05, 0.03, 0.06];
      for (let i = 0; i < 4; i++) rig.set(`leg.${i}.stroke`, t >= touch[i] ? stroke[i] : 0);
      rig.set('sband.az', 60 + 25 * Math.sin(t * 0.25)); rig.set('sband.el', 45);
      return { approach, touchdown: t >= 6 };
    },
  }),

  /* Roket: kalkış TVC dairesi → kafes kanatçıklar açılır (geri dönüş) →
     bacaklar açılır → başlık ayrılır → kademe ayrılması. */
  rocket: () => ({
    period: 26,
    prime(rig) { for (let k = 0; k < 4; k++) rig.jump(`gridFin.${k}.fold`, 85); },
    apply(rig, t) {
      rig.set('engine.gimbal', seg(t, 0, 5) ? [4 * Math.sin(t * 2), 4 * Math.cos(t * 2)] : [0, 0]);
      /* kanatçıklar kalkışta KATLI (prime), geri dönüşte açılır (0°) */
      for (let k = 0; k < 4; k++) rig.set(`gridFin.${k}.fold`, seg(t, 5, 26) ? 0 : 85);
      for (let k = 0; k < 4; k++) rig.set(`leg.${k}.deploy`, seg(t, 9, 26) ? 65 : 0);
      rig.set('fairing.L.open', seg(t, 13, 26) ? 55 : 0); rig.set('fairing.R.open', seg(t, 13, 26) ? -55 : 0);
      rig.set('stage.sep', seg(t, 17, 26) ? 1.6 : 0);
      return { phase: t < 5 ? 'tvc' : t < 9 ? 'gridfin' : t < 13 ? 'legs' : t < 17 ? 'fairing' : 'stagesep' };
    },
  }),

  /* Küpsat: kapta katlı (−88°) → yanan-tel (t=2) → yaylı açılım, dayanakta durur. */
  cubesat: () => ({
    period: 12,
    prime(rig) { rig.jump('wing.L.deploy', 85); rig.jump('wing.R.deploy', -85); },   // kapta katlı
    apply(rig, t) {
      const open = t >= 2;
      rig.set('wing.L.deploy', open ? 0 : 85); rig.set('wing.R.deploy', open ? 0 : -85);
      return { deployed: open };
    },
  }),

  /* Kapsül: SM kanatları açılır (fırlatma sonrası) → kapak açılır/kapanır → SM
     gimbal düzeltmesi. */
  capsule: () => ({
    period: 20,
    prime(rig) { for (let k = 0; k < 4; k++) rig.jump(`smWing.${k}.deploy`, -85); },   // fırlatmada SM boyunca katlı
    apply(rig, t) {
      for (let k = 0; k < 4; k++) rig.set(`smWing.${k}.deploy`, t >= 1 ? 0 : -85);
      rig.set('hatch.open', seg(t, 6, 12) ? 95 : 0);
      rig.set('engine.gimbal', seg(t, 14, 19) ? [3 * Math.sin(t * 1.3), 2 * Math.cos(t * 1.1)] : [0, 0]);
      return { hatchOpen: seg(t, 6, 12) };
    },
  }),

  /* Starship: karın-önde düşüşte duruş kontrolü — yunuslama ve yalpa komutu
     ön/arka flaplere ters işaretle dağılır; deniz seviyesi motorları gimbal. */
  starship: () => ({
    period: 24,
    apply(rig, t) {
      const pitch = 10 * Math.sin(t * 0.7), roll = 6 * Math.sin(t * 0.45 + 1);
      rig.set('flap.FL', pitch + roll); rig.set('flap.FR', pitch - roll);
      rig.set('flap.RL', -pitch + roll); rig.set('flap.RR', -pitch - roll);
      for (let i = 0; i < 3; i++) rig.set(`engine.${i}.gimbal`, seg(t, 14, 22) ? [6 * Math.sin(t * 1.8 + i), 6 * Math.cos(t * 1.8 + i)] : [0, 0]);
      return { pitch, roll, landingBurn: seg(t, 14, 22) };
    },
  }),

  /* Mars helikopteri: kalkış rampası 0 → 2400 dev/dk (4 s), uçuş, iniş rampası.
     Çıta frekansı 80 Hz > 0,4·60 → bulanıklık diski (rig.blur). */
  marshelicopter: () => ({
    period: 20,
    apply(rig, t) {
      const rpm = seg(t, 1, 13) ? 2400 : 0;
      rig.set('rotor.lower', rpm); rig.set('rotor.upper', rpm);
      return { rpm };
    },
  }),

  probe: () => ({ period: 1, apply() { return {}; } }),
};
PROGRAMS['starship-stack'] = PROGRAMS.starship;

/** Program örneği; bilinmeyen tür → boş program (sessiz). */
export function createProgram(kind) {
  const f = PROGRAMS[kind];
  const p = f ? f() : { period: 1, apply() { return {}; } };
  return p;
}

/** Etiket sözlüğü: düğüm adı → kısa teknik ad (vitrin etiketleri). */
export const LABELS = {
  wingL: 'SADA kanat', wingR: 'SADA kanat', hgaAz: 'çanak azimut', hgaEl: 'çanak yükseliş', engineGimbal: 'TVC gimbal',
  louvers: 'radyatör panjuru', leg0Stroke: 'bal peteği strok', leg1Stroke: 'bal peteği strok', leg2Stroke: 'bal peteği strok', leg3Stroke: 'bal peteği strok',
  sbandAz: 'S-bant azimut', sbandEl: 'S-bant yükseliş', gridFin0: 'kafes kanatçık', leg0: 'iniş bacağı', stage2: 'üst kademe', fairingL: 'başlık yarımı', fairingR: 'başlık yarımı',
  hatch: 'kapak menteşesi', smWing0: 'SM kanadı', smWing1: 'SM kanadı', smWing2: 'SM kanadı', smWing3: 'SM kanadı',
  rockerL: 'rocker', rockerR: 'rocker', bogieL: 'bogie', bogieR: 'bogie', differential: 'diferansiyel', steerFL: 'direksiyon', steerFR: 'direksiyon', steerRL: 'direksiyon', steerRR: 'direksiyon',
  wheelFL: 'tekerlek', wheelML: 'tekerlek', wheelRL: 'tekerlek', wheelFR: 'tekerlek', wheelMR: 'tekerlek', wheelRR: 'tekerlek',
  mastPan: 'direk pan', mastTilt: 'direk tilt', armJ1: 'kol azimut', armJ2: 'omuz', armJ3: 'dirsek', armTurret: 'turet',
  flapFL: 'ön flap', flapFR: 'ön flap', flapRL: 'arka flap', flapRR: 'arka flap', engineSL0: 'deniz seviyesi motor', engineSL1: 'deniz seviyesi motor', engineSL2: 'deniz seviyesi motor',
  rotorAlt: 'alt rotor', rotorUst: 'üst rotor', hga: 'yüksek kazançlı çanak',
};

/** Vitrinde gösterilecek etiketlerin ÖNCELİK sırası (≤ 8; Hick/Miller). */
export const LABEL_PRIORITY = {
  orbiter: ['hgaEl', 'wingL', 'louvers', 'engineGimbal'],
  lander: ['leg0Stroke', 'engineGimbal', 'sbandEl', 'leg2Stroke'],
  rocket: ['engineGimbal', 'gridFin0', 'leg0', 'fairingL', 'stage2'],
  cubesat: ['wingL', 'wingR'],
  capsule: ['hatch', 'smWing0', 'engineGimbal'],
  starship: ['flapFL', 'flapRL', 'engineSL0'],
  'starship-stack': ['flapFL', 'flapRL', 'engineSL0'],
  rover: ['rockerL', 'bogieL', 'differential', 'steerFL', 'mastTilt', 'armJ3', 'hgaEl'],
  marshelicopter: ['rotorUst', 'rotorAlt'],
  probe: ['hga'],
};
