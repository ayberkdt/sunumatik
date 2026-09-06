# Launch Window — Fırlatma Penceresi ve Azimut (`/presets/launch_window/`)

Saha enlemi ve hedef düzlemden (i, Ω) eylemsiz azimut (çıkan/inen), Dünya dönmesi
düzeltmesi ve hız tasarrufu, yerel yıldız zamanıyla günde iki fırsat (UTC),
menzil güvenliği sektörü, gecikme → düğüm kayması → düzlem değişimi ΔV → pencere
genişliği. Sol: azimut pusulası + gün çizelgesi; sağ: ceza eğrisi + HUD.

## Mount

```js
import { mountLaunchWindow } from './launch-window.mjs';
const lw = await mountLaunchWindow(host, { site: 'ksc', target: 'iss', raan: 0, doy: 80, dvBudget: .1 });
lw.set({ site: 'kourou', target: 'gto' });
lw.analysis   // { site, target, v, az:{betaAsc, betaDesc, rotAsc:{beta, vRel, saving}, ...}, opp:{asc:{lst, utcHours}, desc}, half, windowSec, curve, ascAllowed, descAllowed }
```

Saf (`launch-window-model.mjs`): `azimuths(lat, inc, vBo)`, `opportunities({lat, lon, inc, raan, doy})`, `planePenalty(inc, dt, v)`,
`windowHalfWidth(inc, v, dvBudget)`, `azimuthAllowed(site, beta)`, `analyze(cfg)`, `SITES`, `TARGETS`, `gmst0(doy)`.

## URL

`?site=<ksc|vandenberg|baikonur|kourou|tanegashima|sinop>&target=<iss|sso|gto|polar|equatorial>&raan=&doy=&dv=<m/s>&export=1`

## Model ve dürüstlük

- Vallado 6.4 örneği denetimde (KSC → 51,6°: 44,98° / 135,02°, düzeltmeli 42,8°, ~280 m/s tasarruf).
- Anlık giriş varsayımı: gerçek tırmanış süresi ve kazanılan boylam pencereyi birkaç dakika kaydırır (belirtilir).
- i < φ: doğrudan çıkış yok; dogleg maliyeti yörüngede düzlem değişimi eşdeğeriyle verilir.
- Denetim: `scripts/validate-astro.mjs` "launchwindow" grubu.
