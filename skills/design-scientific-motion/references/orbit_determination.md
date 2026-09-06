# Orbit Determination — Yörünge Belirleme (EKF) Laboratuvarı (`/presets/orbit_determination/`)

Gerçek yörünge (iki-cisim + J2, RK4) dönen yer istasyonlarından menzil ve
menzil-hızı ile izlenir (yükseklik maskesi, tohumlu Gauss gürültü); genişletilmiş
Kalman filtresi durumu [r; v] kestirir. Sol: ECI x–y izdüşümü (gerçek, kestirim
izi, istasyonlar, görüş çizgileri, 3σ kovaryans elipsi — ölçekte görünmezse
büyütme çarpanı yazılır). Sağ: konum ve hız hatası ile filtre 3σ zarfı (log),
normalize yenilikler ν/σ (geçişler gölgeli), NEES/NIS serisi. HUD: t, |Δr|, |Δv|,
3σ, NEES, NIS, RMS, 3σ içinde kalma, filtre ayarları.

## Mount

```js
import { mountOd } from './orbit-determination.mjs';
const od = await mountOd(host, { scenario: 'leoThree', warp: 900 });
od.setScenario('badModel', { sigA: 1e-7, err0Pos: 1, err0Vel: 1e-3, filterJ2: false, meas: ['range'], maskDeg: 10 });
od.run.stats      // { rmsPosFinal, rmsVelFinal, neesMean, nisMean, inside3sigFrac, nMeas, nPasses, converged }
od.run.samples    // [{ t, truth, est, errPos, errVel, sig3Pos, sig3Vel, nees, Prr }]
od.run.meas       // [{ t, station, type, z, pred, innov, sigInnov, nis, elDeg }]
od.timeline.scrub(t)   // saniye
```

Saf (`od-model.mjs`): `runOd(id, overrides)`, `accel`, `rk4Step`, `stmStep` (sonlu-fark Φ), `stationEci`, `measure`
(ρ, ρ̇, yükseklik, analitik H satırları), `inv`, `SCENARIOS` (leoOne, leoThree, ssoPolar, rangeOnly, rateOnly,
badModel, meoBadModel, geo, lostInSpace, molniya), `STATIONS`.

## URL

`?s=<senaryo>&t=<saat>&warp=&export=1`

## Model ve dürüstlük

- Filtre ve gerçek aynı entegratörü kullanır; fark yalnız J2 anahtarı, gürültü ve başlangıç hatasıdır.
- P₀ başlangıç hatasıyla aynı ölçekte: NEES/NIS tutarlılığı adil ölçülür (tutarlı senaryolarda NEES 1–6, NIS ≈ 0,9–1).
- "Filtre J2'yi bilmiyor" LEO'da saatte onlarca km model hatası üretir; beyaz süreç gürültüsü bir yanlılığı
  örtemez → sapma ve aşırı güven (3σ içinde kalma %≈7). MEO'da J2 küçük olduğundan büyütülmüş σ_a yeterli olur.
- Büyük başlangıç hatası (10 km / 10 m/s) doğrusallaştırmayı bozar: P ilk geçişte çöker, hata dışarıda kalır.
- Denetim: `scripts/validate-astro.mjs` "od" grubu.
