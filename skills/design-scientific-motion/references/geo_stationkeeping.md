# GEO Station-Keeping — GEO İstasyon Tutma Bütçesi (`/presets/geo_stationkeeping/`)

Doğu–batı sürüklenme `gravity_field` modülündeki GERÇEK C̄22/S̄22'den (teğetsel ivme,
denge boylamları kök olarak, yıllık ΔV(λ), libration periyodu, serbest sürüklenme);
kuzey–güney `orbit_perturbations` üçüncü-cisim modeliyle 1 yıllık RK4 (eğiklik
vektörü izi, Δi/yıl, ΔV_KG = V_geo·Δi); SRP eksantriklik çemberi; ömür yakıtı
(Tsiolkovsky, kimyasal vs elektrikli). Beş panel + HUD.

## Mount

```js
import { mountGeoSk } from './geo-stationkeeping.mjs';
const gk = await mountGeoSk(host, { lonDeg: 42, years: 15, m0: 3000 });
gk.set({ lonDeg: -105 });
gk.model   // { budget, equilibria:[{lonDeg, stable, residual}], libration, ns:{trace, diPerYear, dvPerYear}, srp:{eMax, trace}, drift }
```

Saf (`geo-sk-model.mjs`): `eastAccel(λ)`, `lonAccel(λ)`, `dvEastWestPerYear(λ°)`, `equilibria()`, `librationPeriodYears()`,
`driftTrajectory(λ0, years)`, `northSouth({days, dt, raan0})`, `srpEccentricity({crAm})`, `budget({lonDeg, years, m0, ispChem, ispEp})`.

## URL

`?lon=<°, doğu +>&years=&m0=&export=1`

## Model ve dürüstlük

- Denge boylamları hesaplanır, yerleştirilmez: 75,1° D / 104,9° B kararlı, 14,9° B / 165,1° D kararsız (yalnız J22;
  J31/J33 kararsızları literatürdeki 11,5° B / 161,9° D'ye kaydırır — altyazı söyler).
- Δi/yıl sayısal (dairesel Ay/Güneş); gerçek 0,75–0,95 aralığı 18,6 yıllık Ay düğüm çevriminden gelir (modellenmez).
- Denetim: `scripts/validate-astro.mjs` "geosk" grubu.
