/* rover-drive.mjs — ARAZİYE BAĞLI SÜRÜŞ (three'siz, DOM'suz, saf).
 * docs/physical-rigs-plan.md §3.2–3.3 · F2.
 *
 * F1'deki koreografi sentetik bir tümsek diziyordu; burada gezgin GERÇEK
 * araziye oturur. Girdi tek bir örnekleme fonksiyonudur:
 *
 *     sample(lx, lz) → o noktadaki zemin yüksekliği (tasarım birimi)
 *
 * `lx` aracın ileri ekseni (+X), `lz` yanal eksen (aracın +Y'si) boyunca
 * ölçülür; dünya dönüşümü ÇAĞIRANIN işidir (treadmill kayması, yaw, ölçek).
 * Böylece çözücü hem vitrinde hem sinematik sahnede aynı kodla çalışır.
 *
 * ÇÖZÜM TEK GEÇİŞTİR (iterasyon yok, §3.2):
 *   1. Altı tekerleğin altında zemin örneklenir.
 *   2. Her yan için bogie eğimi β = atan2(h_arka − h_orta, L_bogie),
 *      rocker eğimi ρ = atan2(h_pivot − h_ön, L_rocker)   — YATAYA göre.
 *   3. Diferansiyel: gövde yunuslaması = (ρ_sol + ρ_sağ)/2.
 *      Bu, buildRover notundaki "gövde iki yanın ORTALAMASINDA" cümlesinin
 *      koddaki karşılığıdır.
 *   4. EKLEM açıları GÖVDEYE GÖRE yazılır: rocker_eklem = ρ − pitch,
 *      bogie_eklem = β − ρ. Hiyerarşi (rocker → bogie → tekerlek) zaten
 *      kurulu olduğu için tekerlekler doğru yere gider; "her tekerleği tek
 *      tek zemine itmek" gerekmez.
 *   5. Gövde yüksekliği: temas ortalaması + tekerlek yarıçapı.
 *
 * KAYMA: gevşek regolitte tekerlek yol hızından hızlı döner,
 *   ω r = v / (1 − s),  s = s0 + k·tan(eğim).
 * Kayma GÖRÜNÜR kanıttır: tırmanışta çıtalar hızlanır ama araç yavaşlar.
 *
 * YUVARLANMA YARIÇAPI nominal jant değil, ÇITA DIŞ KÖŞESİDİR
 * (craft-blocks `WHEEL_OUTER_RADIUS`). Yanlış yarıçap, "tekerlek kayıyor"
 * hissinin bir numaralı sebebidir.
 *
 * API:
 *   createRoverDrive({ geom, wheelRadius, slip }) → drive
 *     drive.update(rig, { sample, v, dt, steerDeg | arcRadius })
 *       → { pitch, roll, height, contacts, slip, odometer, wheelAngle }
 *     drive.reset()
 *   ROVER_GEOM — buildRover tasarım ölçüleri (tek doğruluk kaynağı)
 */

import { solveRockerBogie, ackermann, slipRatio, DEG } from './rig-core.mjs';

/** buildRover tasarım koordinatları (craft-blocks.mjs'ten okundu):
    ön tekerlek x=+0.44, orta −0.07, arka −0.44; yanal ±0.31; rocker pivotu
    x=+0.02, bogie pivotu x=−0.22; tekerlek yarıçapı 0.135. */
export const ROVER_GEOM = Object.freeze({
  wheelX: Object.freeze({ F: 0.44, M: -0.07, R: -0.44 }),
  halfTrack: 0.31,
  track: 0.62,
  /* DİKKAT — Lrocker, rocker PİVOTUNDAN ön tekerleğe olan mesafe DEĞİLDİR.
     solveSide, rocker eğimini ön tekerlek ile BOGIE PİVOTU arasından çözer
     (hPivot = (hM + hR)/2). Dolayısıyla kullanılacak yatay açıklık
     x_ön − (x_orta + x_arka)/2 = 0,44 − (−0,255) = 0,695'tir.
     İlk yazımda 0,42 (pivot → ön tekerlek) girilmişti ve 8°'lik bir düzlemde
     gövde 13,1° yunusluyordu — doğrulama yakaladı (§10). */
  Lrocker: 0.695,         // ön tekerlek ↔ bogie pivotu (yatay açıklık)
  Lbogie: 0.37,           // orta ↔ arka tekerlek (yatay açıklık)
  wheelbase: 0.51,        // ön aks → orta aks (Ackermann kolu)
  wheelRadius: 0.135,     // nominal jant; gerçek yuvarlanma yarıçapı dışarıdan
});

const SIDES = [['L', 1], ['R', -1]];
const NAMES = ['F', 'M', 'R'];

export function createRoverDrive({ geom = ROVER_GEOM, wheelRadius = ROVER_GEOM.wheelRadius,
  slip = {}, maxSlopeDeg = 25 } = {}) {
  const wheelAngle = {};
  for (const [s] of SIDES) for (const n of NAMES) wheelAngle[`${n}${s}`] = 0;
  let odometer = 0, lastSlip = 0, stalled = false;

  /** Altı temas yüksekliği: { L:{hF,hM,hR}, R:{...} } */
  const contactsOf = (sample) => {
    const out = {};
    for (const [s, sgn] of SIDES) {
      const y = sgn * geom.halfTrack;
      out[s] = { hF: sample(geom.wheelX.F, y), hM: sample(geom.wheelX.M, y), hR: sample(geom.wheelX.R, y) };
    }
    return out;
  };

  return {
    geom, wheelRadius,
    get state() { return { odometer, slip: lastSlip, stalled, wheelAngle: { ...wheelAngle } }; },
    reset() { for (const k of Object.keys(wheelAngle)) wheelAngle[k] = 0; odometer = 0; lastSlip = 0; stalled = false; },

    /** Tek adım. rig verilmezse yalnız çözüm döner (Node'da sınanabilir). */
    update(rig, { sample, v = 0, dt = 0, steerDeg = null, arcRadius = Infinity } = {}) {
      const c = contactsOf(sample);
      const kin = solveRockerBogie(c.L, c.R, { Lbogie: geom.Lbogie, Lrocker: geom.Lrocker, track: geom.track });

      /* eğim: ön–arka temas farkından (kayma modelinin girdisi) */
      const meanF = 0.5 * (c.L.hF + c.R.hF), meanR = 0.5 * (c.L.hR + c.R.hR);
      const slopeRad = Math.atan2(meanF - meanR, geom.wheelX.F - geom.wheelX.R);
      const s = slipRatio(Math.abs(slopeRad), slip);
      lastSlip = s;
      /* dik yamaçta rig ilerlemeyi REDDEDER: araç durur, tekerlek patinaj yapar */
      stalled = Math.abs(slopeRad) * 180 / Math.PI > maxSlopeDeg;
      const sEff = stalled ? 0.95 : s;                     // patinajda tekerlek döner, araç gitmez
      const vGround = stalled ? 0 : v * (1 - 0);
      const omega = v / (wheelRadius * Math.max(1e-6, 1 - sEff));
      odometer += vGround * dt;
      for (const k of Object.keys(wheelAngle)) wheelAngle[k] += omega * dt;

      /* direksiyon: açık komut ya da dönüş yarıçapı (Ackermann) */
      const ack = steerDeg === null
        ? ackermann(arcRadius, { L: geom.wheelbase, w: geom.track })
        : null;

      if (rig) {
        /* EKLEM açıları gövdeye göre (yukarıdaki 4. adım) */
        rig.set('rocker.L', (kin.rockerL - kin.pitch) / DEG);
        rig.set('rocker.R', (kin.rockerR - kin.pitch) / DEG);
        rig.set('bogie.L', (kin.bogieL - kin.rockerL) / DEG);
        rig.set('bogie.R', (kin.bogieR - kin.rockerR) / DEG);
        rig.set('differential', kin.differential / DEG);
        for (const [sd] of SIDES) for (const n of NAMES) rig.setSpinAngle(`wheel.${n}${sd}`, wheelAngle[`${n}${sd}`], omega);
        if (ack) {
          rig.set('steer.FL', ack.innerFront / DEG); rig.set('steer.FR', ack.outerFront / DEG);
          rig.set('steer.RL', ack.innerRear / DEG); rig.set('steer.RR', ack.outerRear / DEG);
        } else {
          for (const k of ['steer.FL', 'steer.FR', 'steer.RL', 'steer.RR']) rig.set(k, steerDeg);
        }
      }

      return {
        pitch: kin.pitch, roll: kin.roll, differential: kin.differential,
        height: kin.height + wheelRadius,
        rocker: { L: kin.rockerL, R: kin.rockerR }, bogie: { L: kin.bogieL, R: kin.bogieR },
        contacts: c, slip: s, slopeRad, stalled, odometer, omega, wheelAngle: { ...wheelAngle },
        steer: ack,
      };
    },
  };
}

/** Eklem açılarından MUTLAK eğimleri geri kurar (doğrulama için).
    rocker_eklem = ρ − pitch ve bogie_eklem = β − ρ yazıldığına göre, zincir
    toplandığında ρ ve β aynen geri gelmelidir; gelmiyorsa açı türetmesi
    yanlıştır ve tekerlekler zeminden kopar. */
export function reconstructInclinations(rig, pitchRad) {
  const j = (name) => (rig.value(name) ?? 0) * DEG;   // derece → rad
  return {
    rockerL: j('rocker.L') + pitchRad, rockerR: j('rocker.R') + pitchRad,
    bogieL: j('bogie.L') + j('rocker.L') + pitchRad,
    bogieR: j('bogie.R') + j('rocker.R') + pitchRad,
  };
}
