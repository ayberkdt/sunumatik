# Transfer Explorer — Lambert Transfer Kâşifi (`/presets/transfer_explorer/`)

r1, r2, Δθ ve TOF verilir; paylaşılan evrensel-değişken Lambert çözücüsü
(`core/astro-lambert.mjs`, porkchop ile aynı) v1, v2'yi bulur. Sol tuval:
merkezi cisim, dairesel kalkış/varış yörüngeleri, transfer yayı (Kepler
yayılımı — uç noktası r2'ye ~1e−7 km oturur), v_c1/v1/ΔV₁ ve v2/v_c2/ΔV₂
okları, Δθ yayı. Sağ: log-TOF taraması boyunca kısa/uzun yol ΔV toplamı,
Hohmann kapalı-biçim referansı (kesikli), seçili TOF imleci. HUD: ΔV₁, ΔV₂,
toplam, Hohmann, a, e, r_p/r_a, |v1|, |v2|, tarama minimumu.

## Mount

```js
import { mountTransfer } from './transfer-explorer.mjs';
const tx = await mountTransfer(host, { preset: 'earthMars2', tof: 180 * 86400, dth: 120, direction: 'prograde' });
tx.set({ tof: 200 * 86400, direction: 'retrograde' });   // kısa/uzun yol: 'prograde' | 'retrograde'
tx.setPreset('leoGeo');
tx.solution   // { v1, v2, dv1, dv2, dvTotal, a, e, rp, ra, dtheta, arc, iterations }
tx.sweep      // { points: [{ tof, short, long }], best: { tof, dv, way } }
tx.hohmann    // { dv1, dv2, dvTotal, tof, a }
```

Saf (THREE gerekmez, 2B tuval): `solveTransfer(cfg)`, `hohmann(mu, r1, r2)`, `tofSweep(cfg, [t0, t1], n)`;
`PRESETS` (leoGeo, leoGeoPhased, earthMars, earthMars2, earthJupiter, earthVenus), `CENTRAL` (sun, earth).

## URL

`?p=<preset>&tof=<saat>&dth=<derece>&dir=prograde|retrograde&export=1`

## Model ve dürüstlük

- İki-cisim, impulsif, eş-düzlem; kalkış/varış dairesel: ΔV₁ = |v1 − v_c1|, ΔV₂ = |v_c2 − v2|.
- Tek-tur Lambert; Δθ = 180° tam tekilliği (A → 0) 0,01° kaydırılarak çözülür (Hohmann'a 1e−4 bağıl).
- Efemeris yok (tarih tabanlı sürüm `porkchop_explorer`); kaçış/yakalama hiperbolleri, düzlem değişimi ve çok-tur çözümler yok.
- Denetim: `scripts/validate-astro.mjs` "transfer" grubu — Hohmann eşleşmesi, elips elemanları, yay uç artığı,
  enerji korunumu, tarama minimumu, kısa/uzun yol açıları, içe transfer işareti, kısa-TOF enerji.
