# Constellation Coverage — Takımyıldızı Kapsaması (`/presets/constellation_coverage/`)

scene-blocks "wave 2" ORBITAL bloğu. Walker Delta/Star takımyıldızı
i:T/P/F PARAMETRELERİNDEN üretilir (uydu rastgele konmaz): yörünge
düzlemleri, uydular, kapsama konileri, yüzey ayak izleri, katlılık boyaması
(kapsanmayan / 1 / 2 / 3+), 2B harita, anlık kapsama oranı, ortalama
katlılık, yer istasyonundan görünen uydu sayısı ve zaman taramasıyla en uzun
boşluk / sürekli kapsanan alan. Çözücü: `constellation-model.mjs` (saf).
Denetim: `node scripts/validate-astro.mjs` (T = P·S, RAAN aralığı, λ GPS
71,2° / Iridium 19,9°, ε = 0 limiti, Iridium ≥ 99 %, GEO kutup boşluğu…).

## Mount

```js
import { mountConstellation } from './constellation.mjs';
const cc = await mountConstellation(host, {
  preset: 'iridium',              // ya da config: { planes, perPlane, phasing, inc, alt, minElev, kind:'delta'|'star' }
  station: { lat: 39.9, lon: 32.9 }, warp: 60,
});
cc.setConfig({ planes: 8, perPlane: 9, inc: 60 }) · cc.setPreset('gps') · cc.setStation(lat, lon)
cc.stats.instant   // { fraction, meanMultiplicity, uncovered }  · cc.stats.scan { meanFraction, minFraction, maxGap, continuousFraction }
cc.constellation   // { T, P, S, r, n, period, lambda, sats[] }
cc.timeline.play()/.pause()/.setWarp(300) · cc.advance(dt) · cc.dispose()
```

Saf kullanım: `buildConstellation(cfg)`, `positionsAt(con, t, θ₀)`, `coverageAt(con, grid, t)`,
`visibleFrom(con, lat, lon, t)`, `revisitScan(con, { dt, nLon, nLat })`, `footprintAngle(alt, ε)`.

## Geometri

Ω_k = k·(ΔΩ/P) (Delta 360°, Star 180°), u_kj = j·360°/S + k·F·360°/T.
λ = acos(R/(R+h)·cos ε) − ε; kapsama ⇔ merkez açı ≤ λ. Koniler
`coneGeoX` yardımcısıyla (çıplak kurucu yok), InstancedMesh; boyama
CanvasTexture olarak Dünya'nın çocuğu (ECEF ızgarası).

## Dürüstlük

J2 yok, küresel Dünya, tek ε eşiği, dairesel yörüngeler; preset sayıları
nominal tasarım değerleridir, gerçek efemeris değildir. Büyük takımyıldızda
(T > 200) boyama/tarama daha kaba ve seyrek güncellenir.
