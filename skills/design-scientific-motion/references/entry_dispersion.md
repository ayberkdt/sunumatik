# Entry Dispersion — Giriş Dağılımı, Monte Carlo (`/presets/entry_dispersion/`)

`reentry_corridor` çekirdeği (`simulateEntry`) üstünde tohumlu Gauss sapmalar:
Δγ, Δv, ρ ölçeği, L/D, kütle, yatış → menzil / tepe g / ısı yükü istatistikleri,
yörünge yelpazesi ve iniş noktaları, histogram (p05/p50/p95, ±3σ), tek-değişken
duyarlılık çubukları (σ_s payları) ve doğrusal RSS ↔ Monte Carlo oranı, menzil–γ
saçılımı. Atlama/kaçış örnekleri sayılır ve istatistik dışı bırakılır.

## Mount

```js
import { mountDispersion } from './entry-dispersion.mjs';
const ed = await mountDispersion(host, { scenario: 'leoNominal', n: 200, seed: 20260907 });
ed.set({ scenario: 'atmo', sigmas: { rhoScale: .3 } });
ed.result   // { nominal, runs, stats:{s,peakG,Q,peakQ}, sens:[{key,label,sigma,dsdx,contrib,share}], rssSigma, mcSigma, linearity, skipouts }
```

Saf (`dispersion-model.mjs`): `runDispersion(id, {n, seed, sigmas, keepTraj})`, `SCENARIOS` (leoNominal, leoSteep, lunar, nav, atmo,
ballistic), `PARAMS` (sapma tanımları ve uygulama kuralları). `reentry-model.mjs` artık `entry.rhoScale` kabul eder.

## URL

`?s=<senaryo>&n=<örnek>&seed=<1–50>&export=1`

## Model ve dürüstlük

- Yalnız menzil dağılımı (düzlemsel); sabit yatış; bağımsız Gauss sapmalar; tek çalıştırma istatistiği.
- Doğrusallık oranı 0,7–1,3 dışına çıkarsa altyazı "doğrusal değil" der (atlama/kaçış ya da etkileşim).
- Ay dönüşü senaryosu yatış 60° ile sabit-yatışta inen bir nokta seçer; güdümsüz olduğu belirtilir.
- Denetim: `scripts/validate-astro.mjs` "dispersion" grubu.
