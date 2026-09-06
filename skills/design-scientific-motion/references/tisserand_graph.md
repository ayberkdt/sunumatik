# Tisserand Graph — Tisserand Grafiği (`/presets/tisserand_graph/`)

(r_a, r_p) düzleminde (AU, log-log) gezegenlerin sabit-v∞ eğrileri, gezegen
çizgileri, Dünya rezonans eğrileri, seçilen dizinin bacakları ve her geçişte
erişilebilir yay (|Δα| ≤ δ_max). Sağ: güneş-merkezli bacak elipsleri ve bacak
tablosu (v∞ giriş/varış, α → α′, |Δα|/δ_max, r_p/r_a, periyot). Diziler: VEEGA,
Venüs–Venüs–Dünya–Jüpiter, doğrudan Jüpiter, Mars serbest dönüş, Jüpiter–Satürn.

## Mount

```js
import { mountTisserand } from './tisserand.mjs';
const tg = await mountTisserand(host, { sequence: 'veega', vinf0: 3.6, hMin: 300, vinfLevels: [3, 5, 7, 9, 12] });
tg.set({ sequence: 'jupSat', vinf0: 9 });
tg.plan   // { legs:[{from,to,vinf,alpha,alphaNew,delta,used,orbit,vinfNext,reachable}], feasible, final }
```

Saf (`tisserand-model.mjs`): `orbitFromVinf(planet, vinf, alpha)`, `vinfAt(planet, rp, ra)`, `contour(planet, vinf)`,
`maxTurn(planet, vinf, hMin)`, `resonances(planet)`, `planSequence(seq, opts)`, `tisserandOf`, `PLANETS`, `SEQUENCES`.

## URL

`?seq=<dizi>&vinf0=<km/s>&hmin=<km>&export=1`

## Model ve dürüstlük

- T geçişte korunur, α değişir: sabit-v∞ eğrisi boyunca kayış; δ_max minimum yükseklikten.
- Fazlama yok: dizi geometrik erişilebilirliği gösterir, gerçek tarihler için `porkchop_explorer`.
- Açgözlü planlayıcı; VEEGA'da Dünya–Dünya bacağı 2:1 rezonansı hedefler.
- Denetim: `scripts/validate-astro.mjs` "tisserand" grubu.
