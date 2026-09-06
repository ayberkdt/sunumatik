# Gravity Field — Küresel Harmonik Yerçekimi Alanı (`/presets/gravity_field/`)

Tam normalize P̄_lm (kararlı özyineleme, ortonormallik denetimde), derece /
mertebe, kesme (L), l_min, yalnız zonal, tek derece katkısı; jeoit N (Bruns,
GRS80 normal alanı çıkarılmış — elipsoide göre; küre referansı seçilebilir)
ve serbest-hava anomalisi δg; küre üstü boyama + abartılı yer değiştirme,
2B harita, derece varyans spektrumu vs Kaula. KATSAYI DÜRÜSTLÜĞÜ: C̄20,
C̄22/S̄22, C̄30, C̄40 EGM96'dan yuvarlatılmış gerçek değerler; diğer her şey
tohumlu SENTETİK (Kaula 1e−5/l²) — sahne kalıcı uyarı yazar. Gerçek alan
için `coefficients: [{l, m, C, S}]` (tam normalize) verilir. Çapraz denetim:
yalnız-C̄20 alanında sayısal düğüm kayması ≈ J2 analitik.

## Mount

```js
import { mountGravityField } from './gravity-field.mjs';
const gf = await mountGravityField(host, { Lmax: 36, lMaxShow: 24, field: 'N', seed: 7, exaggeration: 6000, removeNormal: true });
gf.set({ lMaxShow: 8, onlyDegree: 3, zonalOnly: true, field: 'dg', coefficients: egm2008List });
gf.grid        // { N, dg, nLon, nLat, nMin, nMax, gMin, gMax }
gf.spectrum    // [{ l, sigma, kaula }]
gf.nodeCheck   // { raanDot, energyDrift }
```

Saf: `buildCoefficients(L, {seed})`, `loadCoefficients(list, L)`, `legendreNormalized(t, L)`,
`disturbance(cs, r, φ, λ, opts)`, `surfaceGrid`, `degreeSpectrum`, `acceleration`, `propagateNodeDrift`.

## Dürüstlük

Sentetik yüksek dereceler; küresel yaklaşım formülleri; L ≤ 36; yayılım
kısa ve ECI ≈ ECEF. Bu preset gerçek Dünya jeoidi DEĞİLDİR; yöntemi öğretir.
