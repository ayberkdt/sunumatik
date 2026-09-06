# Gravity Assist — Yerçekimi Yardımı ve B-Düzlemi (`/presets/gravity_assist/`)

Görev tasarımı bloğu. Gezegen-göreli hiperbol (asimptotlar, enberi, δ dönme
açısı, B-düzlemi çizgisi ve B vektörü, hareket eden araç), heliosantrik
çerçeve (önce/sonra yörüngeler, gezegen, hız üçgeni V = V_p + v∞ — |v∞|
çemberi), B-düzlemi hedef görünümü (T̂–R̂, çarpma dairesi, B·T / B·R).
Çerçeve ayrımı görsel olarak açıktır: gezegen aracı "öne çekmez", göreli
hız büyüklüğü korunur, heliosantrik büyüklük çerçeve değişimiyle değişir.
Çözücü: `flyby-model.mjs` (saf). Denetim: `node scripts/validate-astro.mjs`.

## Mount

```js
import { mountGravityAssist } from './gravity-assist.mjs';
const ga = await mountGravityAssist(host, { body: 'jupiter', vinf: 6, alpha: 120, rpRatio: 6, theta: 0, warp: 20000 });
ga.flyby   // { e, delta, b, bImpact, impact, BT, BR, vinfIn, vinfOut, Vin, Vout, dV, dEnergy, before, after, tisserandIn/Out … }
ga.set({ body: 'venus', vinf: 4, alpha: 60, rpRatio: 1.3, theta: 180 })
ga.timeline.play()/.scrub(t) · ga.dispose()
```

Saf: `solveFlyby({...})`, `hyperbolaPath(fb)`, `heliocentricPath(fb, path)`, `helioOrbitPoints(r, V)`, `tisserand(el, a_p)`.

## Dürüstlük

Yama-konik, anlık; gezegen dairesel ve ekliptikte; geliş yönü ekliptikte
(α), θ ile düzlem-dışı çıkış. Tisserand parametresi dairesel gezegen
yörüngesinde korunur (bağımsız denetimde). Navigasyon belirsizliği yok.
