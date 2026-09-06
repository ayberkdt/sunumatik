# Attitude / GNC Lab — Yönelim Laboratuvarı (`/presets/attitude_gnc/`)

Gerçek katı-gövde yönelim dinamiği: Euler denklemleri + üç tepki tekerleği
(τ_max, h_max doyma), kuaterniyon kinematiği (RK4, |q| = 1), kuaterniyon
geri beslemeli PD (K_p = Iω_n², K_d = 2ζω_n I). Modlar: slew (kontrolcü
tepkisi), serbest dönme (Dzhanibekov ara-eksen kararsızlığı; T ve |H|
korunumu), tekerlek doyması (sabit dış tork → h_max/τ sürede doyma →
kontrol kaybı), gimbal kilidi (3-2-1 hız matrisi 1/cos θ), SLERP ↔ Euler
doğrusal interpolasyon. 3B: eylemsiz ve gövde eksen üçlüleri, hedef hayaleti,
boresight konisi, tekerlek momentum çubukları; grafikler: ω, hata/|h_w|
(ya da T/|H|), Euler açıları. Çözücü `attitude-model.mjs` (saf). Denetim:
`node scripts/validate-astro.mjs`.

## Mount

```js
import { mountAttitude } from './attitude-gnc.mjs';
const gnc = await mountAttitude(host, {
  mode: 'slew',                       // slew | tumble | saturation | gimbal | slerp
  craft: 'small',                     // small | observatory | cubesat | tumbler
  wn: .2, zeta: 1, target: { psi, theta, phi },   // rad, 3-2-1
  w0: [0, 0, 0], tauExt: [0, 0, 0], duration: 60, wheels: true, warp: 1,
});
gnc.sim.stats   // { settledAt, satAt, maxRate, finalErr, energyDrift, HDrift }
gnc.set({ mode: 'tumble', craft: 'tumbler', w0: [.01, 2, 0], wheels: false })
gnc.timeline.play()/.scrub(t) · gnc.dispose()
```

Saf: `simulateAttitude(cfg)`, `qFromEuler321/123`, `euler321FromQ`, `qSlerp`, `eulerRateMatrix321`, `qMul/qConj/qRotate`.

## Dürüstlük

Rijit gövde, ideal tekerlekler (üç dik; piramit/sürtünme yok), tam durum
bilgisi, basit PD. SLERP/Euler/gimbal modları kinematik gösterimdir.
Araç geometrisi semboliktir (craft-blocks orbiter).
