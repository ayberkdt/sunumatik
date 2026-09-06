# Conjunction & Covariance — Yakın Geçiş ve Kovaryans (`/presets/conjunction_covariance/`)

Belirsizlik geometrisi asıl içerik: iki Kepler yörüngesi, TCA menzil
minimizasyonuyla bulunur, karşılaşma çerçevesi v_rel'e dik kurulur, RTN
kovaryansları ECI'ye döndürülüp toplanır ve karşılaşma düzlemine izdüşürülür
(1/2/3σ elipsleri, Mahalanobis), 2B çarpışma olasılığı sert-gövde dairesi
üzerinde integre edilir, seyrelme eğrisi P_c(k) çizilir. 3B yörüngeler +
TCA işareti, karşılaşma düzlemi, menzil(t), seyrelme grafiği, eşik kararı.
Çözücü `conjunction-model.mjs` (saf). Denetim: `node scripts/validate-astro.mjs`.

## Mount

```js
import { mountConjunction } from './conjunction.mjs';
const cj = await mountConjunction(host, {
  miss: [120, 300, -80],        // nominal zamanda ıska (RTN, m) — TCA ve gerçek ıska BULUNUR
  crossAngle: 40, sigP: [50, 400, 60], sigS: [120, 900, 150], rHb: 20, tTca: 3600, threshold: 1e-4, warp: 20,
});
cj.analysis   // { tca:{tTca, miss, rRel, vRel}, geo:{missPlane, C2, dM, ellipse}, pc, dilution:{points, peak}, series }
cj.set({ sigS: [800, 6000, 900] }) · cj.timeline.play()/.scrub(t) · cj.dispose()
```

Saf: `analyzeConjunction(cfg)`, `findTca`, `encounterGeometry`, `collisionProbability(C2, miss, rHb)`, `dilutionCurve`, `covRtnToEci`, `eig2`.

## Dürüstlük

Kısa karşılaşma, Gauss, yalnız konum kovaryansı, kovaryans yayılımı yok,
Kepler. Limitler denetimde: küçük sert gövde πR²/(2π√|C|), kaplayan gövde → 1,
devasa kovaryans → 0, izotropikte d_M = ıska/σ.
