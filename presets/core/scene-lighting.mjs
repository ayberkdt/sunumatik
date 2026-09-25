/* scene-lighting.mjs — EVERY LIGHT HAS TO NAME ITS SOURCE.
 *
 * The repository already carries real photometry in `core/light-math.mjs`
 * (Planck curve, CIE integration, an ENVIRONMENTS table with measured
 * illuminances) and exactly one preset used it. Everywhere else the lights
 * were picked by eye, and the numbers said so:
 *
 *   scene            sky/sun used   physical
 *   habitat, Moon        0.065        0.000     a blue sky on an airless body
 *   habitat, Mars        0.327        0.076     4.3x too much diffuse
 *   satellite, orbit     0.423        0.000     42% of the light had no source
 *   exploded view        0.239 + rim  0.000     studio three-point
 *
 * and the Mars/Moon sun ratio was 0.765 where the inverse square law gives
 * 1/1.524^2 = 0.431 - Mars was lit 1.8x too brightly.
 *
 * This module builds a rig whose RATIOS come from illuminance and whose
 * colour comes from the blackbody curve. It does not make scenes prettier;
 * it makes them answerable. Each light carries `userData.source` naming
 * what emits it, and a gate checks that nothing in the rig is anonymous.
 *
 * three is passed in; this module never imports it.
 */

import { ENVIRONMENTS, blackbodyRGB, reflectedRGB } from './light-math.mjs';

/** Solar irradiance at 1 AU, W/m^2 (total solar irradiance, ~1361). */
export const SOLAR_CONSTANT_1AU = 1361;
/** Luminous efficacy of unfiltered sunlight (AM0), lm/W. */
export const AM0_EFFICACY = 93;
/** Effective photospheric temperature of the Sun, K. */
export const SUN_T = 5772;

/** Orbital radius in AU for the bodies these scenes sit at. */
export const AU = Object.freeze({ earth: 1.0, moon: 1.0, mars: 1.523679 });

/** Screen exposure is referenced to sunlight at 1 AU. */
export const REFERANS_LUX = (SOLAR_CONSTANT_1AU) * AM0_EFFICACY;

/** Direct-normal solar illuminance at a distance from the Sun, in lux. */
export function sunLuxAt(au) {
  return (SOLAR_CONSTANT_1AU / (au * au)) * AM0_EFFICACY;
}

/**
 * Illuminance a spacecraft receives from the planet it is orbiting.
 *
 * The planet reflects a fraction of the sunlight falling on it, and the
 * spacecraft sees that reflection over whatever solid angle the planet
 * subtends. In low Earth orbit the planet fills most of one hemisphere, so
 * the view factor is high and the contribution is NOT negligible - it is
 * the only fill a spacecraft has, and it comes from ONE direction: nadir.
 */
export function albedoLux(au, albedo, viewFactor) {
  return sunLuxAt(au) * albedo * viewFactor;
}

/* ── the scenes these presets actually sit in ─────────────────────────
   Each entry states where the light comes from, so a reader can check the
   ratio rather than trust it. `sky` is DIFFUSE light from an atmosphere;
   an airless body has none and the entry says 0, not "a little". */
export const SAHNELER = Object.freeze({
  /* Lunar surface. No atmosphere, so no sky: the only thing filling the
     shadows is sunlight bouncing off regolith, and regolith is dark
     (Bond albedo ~0.11, normal albedo ~0.13). Shadows on the Moon really
     are almost black, and a render that opens them is not describing the
     Moon. */
  vacuum: {
    ad: 'Lunar surface', au: AU.moon, gokYok: true,
    yerAlbedo: 0.13, yerGorusPayi: 0.5,
    /* Reflectance colour, not a hex guess: lunar regolith is nearly flat
       across the visible with a slight red slope. What bounces up is the
       illuminant times THIS. */
    gokAlbedo: [0, 0, 0], yerAlbedo3: [1.00, 0.92, 0.80],
    kaynak: { gunes: 'Sun at 1 AU', gok: 'none - vacuum', yer: 'regolith bounce, albedo 0.13' },
  },
  /* Mars. A thin, permanently dusty atmosphere scatters enough to be a
     real second source - butterscotch, because the suspended dust is
     iron-oxide rich and scatters long wavelengths forward. */
  mars: {
    ad: 'Mars surface', au: AU.mars, gokYok: false,
    yerAlbedo: 0.25, yerGorusPayi: 0.5,
    /* Suspended iron-oxide dust scatters the long end forward, which is
       why the Martian sky is butterscotch and the surface redder still. */
    gokAlbedo: [1.00, 0.79, 0.64], yerAlbedo3: [1.00, 0.66, 0.44],
    kaynak: { gunes: 'Sun at 1.524 AU', gok: 'dust-scattered skylight', yer: 'surface bounce, albedo 0.25' },
  },
  /* Low Earth orbit. No sky at all, and the fill is earthshine: sunlight
     reflected off a planet that fills most of one hemisphere. Cool and
     slightly blue, because that is what cloud and ocean return. */
  orbit: {
    ad: 'Low Earth orbit', au: AU.earth, gokYok: true,
    yerAlbedo: 0.30, yerGorusPayi: 0.70,
    /* Earthshine is cloud (near neutral) over ocean (blue) with Rayleigh
       on top, so it comes back COOLER than the sunlight that made it. */
    gokAlbedo: [0, 0, 0], yerAlbedo3: [0.78, 0.86, 1.00],
    kaynak: { gunes: 'Sun at 1 AU', gok: 'none - vacuum', yer: 'earthshine, albedo 0.30, view factor 0.70' },
  },
});

/**
 * The illuminance budget of a scene, in lux, with nothing hidden.
 *
 * `gok` comes from the measured ENVIRONMENTS table where that table has an
 * entry, so the two do not drift apart; otherwise it is zero because the
 * body has no atmosphere.
 */
export function isikButcesi(ad) {
  const s = SAHNELER[ad];
  if (!s) throw new Error(`scene-lighting: unknown scene '${ad}'`);
  const gunesLux = sunLuxAt(s.au);
  const olculen = ENVIRONMENTS[ad];
  const gokLux = s.gokYok ? 0 : (olculen ? olculen.skyLux : 0);
  const yerLux = albedoLux(s.au, s.yerAlbedo, s.yerGorusPayi);
  return {
    ad: s.ad, au: s.au,
    gunesLux: Math.round(gunesLux),
    gokLux: Math.round(gokLux),
    yerLux: Math.round(yerLux),
    gokPay: gokLux / gunesLux,
    yerPay: yerLux / gunesLux,
    kaynak: s.kaynak,
  };
}

/**
 * The Sun's colour.
 *
 * `blackbodyRGB` is referenced to a D65 display white, so a 5772 K Sun comes
 * out at (1.00, 0.88, 0.82) - visibly warm. That is its chromaticity
 * RELATIVE TO D65, and it is correct as such, but it is not what a camera
 * in sunlight records: the camera white-balances to the light it is in.
 * These scenes have exactly one illuminant, so white-balancing to it is
 * both what a camera does and what the eye does, and it is the choice that
 * leaves the SECONDARY sources carrying real colour information instead of
 * everything being orange.
 *
 * @param beyazDenge  true (default): the Sun is the white point.
 *                    false: its chromaticity against a D65 display.
 */
export function sunColorRGB(beyazDenge = true) {
  return beyazDenge ? [1, 1, 1] : blackbodyRGB(SUN_T, { normalize: 'peak' });
}

/**
 * What a surface of a given reflectance returns under this scene's Sun.
 *
 * With the rig white-balanced to the Sun this IS the albedo colour, which
 * is the honest way to say it: the fill is not "some blue", it is what
 * cloud and ocean give back.
 */
export function bounceColorRGB(albedo3, beyazDenge = true) {
  return reflectedRGB(albedo3, sunColorRGB(beyazDenge));
}

/**
 * The base colour of the ground in a scene.
 *
 * A material's `color` IS its albedo, so the ground should be painted with
 * the same number the lighting budget reflects light off. Lunar regolith is
 * dark and very nearly neutral - 0.13 with a slight red slope - and drawing
 * it in the same brown as Mars was making the Moon look like a desert. Mars
 * really is that red, and it is twice as bright.
 */
export function yuzeyAlbedoRGB(ad) {
  const s = SAHNELER[ad];
  if (!s) throw new Error(`scene-lighting: unknown scene '${ad}'`);
  return s.yerAlbedo3.map(v => v * s.yerAlbedo);
}

/**
 * Build the rig.
 *
 * `anahtarYogunluk` is the only free number: it sets how bright the SUN is
 * on screen, which is an exposure choice, not a physical one. Everything
 * else is that number times a measured ratio.
 *
 * @returns { gunes, gokYer, yansima, butce, uygula(ad) }
 */
export function sceneLighting(THREE, scene, ad = 'orbit', {
  anahtarYogunluk = 3.0, golge = true, golgeAlan = 16, golgeUzak = 60,
  beyazDenge = true,
} = {}) {
  const renk = sunColorRGB(beyazDenge);
  const gunes = new THREE.DirectionalLight(new THREE.Color(renk[0], renk[1], renk[2]), anahtarYogunluk);
  gunes.userData.source = 'Sun';
  if (golge) {
    gunes.castShadow = true;
    gunes.shadow.mapSize.set(2048, 2048);
    gunes.shadow.bias = -0.0009;
    Object.assign(gunes.shadow.camera, {
      left: -golgeAlan, right: golgeAlan, top: golgeAlan, bottom: -golgeAlan,
      near: 0.5, far: golgeUzak,
    });
  }
  scene.add(gunes);

  /* Sky above, surface below. On an airless body the sky half is BLACK -
     which is the whole difference between the Moon and Mars, and it is the
     one thing a hand-tuned rig always gets wrong, because a black sky
     makes the shadow side look broken until you accept that it is. */
  const gokYer = new THREE.HemisphereLight(0x000000, 0x000000, 0);
  gokYer.userData.source = 'sky + surface bounce';
  scene.add(gokYer);

  /* The planet below a spacecraft is a directional source, not an ambient
     one: earthshine arrives from nadir and leaves the anti-nadir side dark.
     Modelling it as ambient is what flattened the terminator. */
  const yansima = new THREE.DirectionalLight(0xffffff, 0);
  yansima.userData.source = 'planet albedo (nadir)';
  scene.add(yansima);

  let butce = null;

  function uygula(sahneAdi = ad) {
    const s = SAHNELER[sahneAdi];
    if (!s) throw new Error(`scene-lighting: unknown scene '${sahneAdi}'`);
    butce = isikButcesi(sahneAdi);
    /* Intensity follows the ILLUMINANCE, and the exposure compensates, so
       the sunlit face lands at the same screen value in every scene while
       the SHADOW side carries the real difference. Holding intensity fixed
       and changing exposure instead - which is what the habitat page did -
       is a camera run backwards: it rendered Mars brighter than the Moon,
       when Mars receives 43% of the light. */
    gunes.intensity = anahtarYogunluk * (butce.gunesLux / REFERANS_LUX);
    const gokR = bounceColorRGB(s.gokAlbedo, beyazDenge);
    const yerR = bounceColorRGB(s.yerAlbedo3, beyazDenge);
    gokYer.color.setRGB(gokR[0], gokR[1], gokR[2]);
    gokYer.groundColor.setRGB(yerR[0], yerR[1], yerR[2]);
    if (s.gokYok) {
      /* No atmosphere: the hemisphere light carries ONLY the surface
         bounce, and its sky half stays black. */
      gokYer.intensity = anahtarYogunluk * butce.yerPay;
      yansima.intensity = 0;
    } else {
      gokYer.intensity = anahtarYogunluk * (butce.gokPay + butce.yerPay);
      yansima.intensity = 0;
    }
    return butce;
  }

  /**
   * The tone-mapping exposure multiplier that keeps the sunlit face at a
   * constant screen value. Multiply the page's base exposure by this.
   */
  function pozlamaCarpani() {
    const b = butce || uygula(ad);
    return REFERANS_LUX / b.gunesLux;
  }

  /** Orbit scenes: the planet is a direction, not an ambience. */
  function yorungeyeAyarla(nadir = [0, 0, -1]) {
    const b = butce || uygula(ad);
    gokYer.intensity = 0;
    const yerR = bounceColorRGB(SAHNELER[ad].yerAlbedo3, beyazDenge);
    yansima.color.setRGB(yerR[0], yerR[1], yerR[2]);
    yansima.intensity = anahtarYogunluk * b.yerPay;
    yansima.position.set(-nadir[0], -nadir[1], -nadir[2]);
    return b;
  }

  uygula(ad);
  return { gunes, gokYer, yansima, uygula, yorungeyeAyarla, pozlamaCarpani, butce: () => butce };
}
