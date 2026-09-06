# Low-Thrust Transfer — Düşük İtkili Transfer Laboratuvarı (`/presets/low_thrust_transfer/`)

Sürekli teğetsel itki spirali (RK4, değişken kütle, yörünge büyüdükçe büyüyen adım),
Edelbaum analitik ΔV (eş-düzlem ve eğiklik değişimli), Hohmann karşılaştırması,
Tsiolkovsky yakıt, silindirik gölge görev çevrimi. Sol: spiral (itki açık/kapalı
renkli), sağ: a(t)/i(t), birikimli ΔV(t) ile Edelbaum/Hohmann referansları, m(t).
HUD: sayısal/Edelbaum/Hohmann ΔV, süre, tur, yakıt (elektrikli vs kimyasal), e_max, T/W.

## Mount

```js
import { mountLowThrust } from './low-thrust.mjs';
const lt = await mountLowThrust(host, { scenario: 'leoGeoIncl', warp: 172800 });
lt.set('gtoLikeLeoGeo', { vehicle: { m0: 5000, thrust: .6, isp: 1800, label: 'özel' }, di: 10, shadow: true });
lt.run   // { samples:[{t,x,y,r,v,a,e,m,dv,thrustOn,inc,beta}], dvTotal, tof, mp, edelbaum, hohmann, revs, eMax, dutyCycle, thrustToWeight }
```

Saf (`low-thrust-model.mjs`): `simulateSpiral(cfg)`, `edelbaumDv(r0, r1, diDeg)`, `hohmann(r0, r1)`, `propellant(m0, dv, isp)`,
`vCirc`, `VEHICLES` (hallGeo, ionSmall, cubesat, cargo), `SCENARIOS` (gtoLikeLeoGeo, leoGeoIncl, leoGeoShadow, leoRaise, meoIon, cargoGeo).

## URL

`?s=<senaryo>&t=<gün>&warp=&export=1`

## Model ve dürüstlük

- Sayısal spiral ΔV Edelbaum limitine ±0,5 % (T/W ≈ 1e−5); yüksek T/W'de e_max büyür, spiral ≈ dairesel varsayımı
  zorlanır (HUD ve altyazı bunu adlandırır).
- Eğiklik değişimi düzlemsel simülasyona Edelbaum yaw kanunuyla eklenir (3B integrasyon değil) — ΔV toplamı doğru,
  anlık eğiklik analitik paydır.
- Gölge: tek yanlı itki eksantriklik biriktirir (e_max ~0,2), süre uzar; ΔV Edelbaum'dan ~2 % sapar.
- Denetim: `scripts/validate-astro.mjs` "lowthrust" grubu.
