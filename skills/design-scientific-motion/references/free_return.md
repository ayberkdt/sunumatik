# Free Return — Ay Serbest Dönüş Yörüngesi (`/presets/free_return/`)

Dünya–Ay CR3BP'de (`core/astro-cr3bp.mjs`, adaptif adımlı RK4) LEO'dan TLI ΔV ve
faz açısı θ₀ ile kalkan aracın perilune ve dönüş perigee'si ölçülür; (ΔV, θ₀)
ızgarası + satır başına bisection 100 km dönüş perigee çözümlerini bulur. Sol:
dönen ve eylemsiz görünümler ("8" figürü); sağ: tarama haritası + HUD.

## Mount

```js
import { mountFreeReturn } from './free-return.mjs';
const fr = await mountFreeReturn(host, { dvKmS: 3.135, theta0: 229.6 });   // boş bırakılırsa en iyi aday
fr.set({ dvKmS: 3.14 });
fr.sim    // { states, times, perilune:{altKm, tDays}, returnPerigee:{altKm, tDays}, impactMoon, jacobiDrift, inertial }
fr.scan   // { cells:[{dv, th, hp, hr, ok}], refined:[{dv, th, hp, hr, tPeri, tRet}], best }
```

Saf (`free-return-model.mjs`): `initialState({h0, theta0, dvKmS})`, `simulate({...})`, `scan({h0, dvRange, thRange, nDv, nTh, hpMin, hrTarget, hrTol})`,
sabitler `SYS, MU, L, TU, VU, R_EARTH, R_MOON`.

## URL

`?dv=<km/s>&th=<°>&export=1`

## Model ve dürüstlük

- Çözümler Apollo ölçeğinde (ΔV_TLI ≈ 3,13–3,16 km/s, Ay'a ~3 gün, toplam ~6–7 gün); hepsi denetimde.
- θ₀'da 0,3° sapma dönüş perigee'sini > 500 km kaydırır — koridorun darlığı ölçülür, anlatılmaz.
- Düzlemsel, Güneşsiz, anlık TLI; atmosfer girişi için `reentry_corridor`.
- Denetim: `scripts/validate-astro.mjs` "freereturn" grubu.
