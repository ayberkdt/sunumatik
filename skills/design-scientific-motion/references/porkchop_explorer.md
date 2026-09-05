# Porkchop Explorer — Fırlatma Penceresi Kâşifi (`/presets/porkchop_explorer/`)

scene-blocks "wave 2" ORBITAL bloğu — gerçek görev analizi. Kalkış × varış
tarih ızgarasının her hücresi bir Lambert çözümüdür; gezegen konumları JPL
yaklaşık Kepler elemanlarından (Standish, 1800–2050) gelir. C3 / v∞ varış /
ΔV toplam yüzeyi, konturlar, TOF eş-eğrileri, ızgara minimumu, çapraz-kıl
imleç, seçili transferin sayısal özeti ve heliosantrik geometrisi (transfer
yayı Kepler yayılımıyla). Hazır ısı haritası YOKTUR.

Paylaşılan çözücü: `presets/core/astro-lambert.mjs` — `lambert(r1, r2, dt, mu, 'prograde'|'retrograde')`,
`propagateKepler`, `planetState(name, jd)`, `evaluateTransfer`, `porkchopGrid`,
`julianDay/fmtJd`. `gravity_assist` ve transfer sahneleri de bunu kullanır.
Denetim: `node scripts/validate-astro.mjs` (uç-nokta artığı, Hohmann limiti,
tekillik, efemeris, 2020 Mars minimumu).

## Mount

```js
import { mountPorkchop } from './porkchop.mjs';
const pc = await mountPorkchop(host, {
  origin: 'earth', target: 'mars',
  depStart: '2026-09-01', depEnd: '2027-03-01', arrStart: '2027-04-01', arrEnd: '2028-03-01',
  n: 60, metric: 'c3',                      // 'c3' | 'vinfArr' | 'dvTotal'
  parkAltDep: 200, parkAltArr: 300,         // km — ΔV dönüşümleri için park yörüngeleri
});
pc.grid.min                 // { jdDep, jdArr, c3, vinfArr, tof, dvDep, dvArr }
pc.select(jdDep, jdArr) · pc.selectMin() · pc.selected.transfer   // { c3, vinfDep, vinfArr, type, lambert, r1, r2 … }
pc.setBodies('earth', 'venus') · pc.setRange({ depStart, … }) · pc.setMetric('dvTotal') · pc.setResolution(80)
pc.dispose()
```

THREE gerekmez (2B tuval). Saf kullanım Node'da çalışır:

```js
import { evaluateTransfer, julianDay } from '../core/astro-lambert.mjs';
evaluateTransfer('earth', 'mars', julianDay(2020, 7, 30), julianDay(2021, 2, 18)).c3   // ≈ 14,4 km²/s²
```

## Dürüstlük

Yaklaşık efemeris (~10⁻⁴ AU), yama-konik, tek-tur Lambert; fırlatma
azimutu/deklinasyon kısıtları yok. Pencerenin anatomisini gösterir; gerçek
görev tasarımı DE4xx efemerisi ister — altyazı bunu söyler. Varsayılan
Mars 2020 penceresi ızgara minimumu 2020-07-17 / C3 13,2 km²/s² (Perseverance
30 Temmuz'da 14,4 ile fırlatıldı) — bağımsız doğrulama.
