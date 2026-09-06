# Three-Body States — Üç-Cisim Durumları (`/presets/three_body_states/`)

Siyah zeminde 5×4 pano; her panoda düzlemsel üç-cisim probleminin bir
periyodik çözümü canlı entegre edilir. Cisimler turuncu · krem · mavi ışıyan
noktalar, arkalarında sönen kuyruklu iz, altta tam periyodun soluk yolu.
Pisagor (Burrau) problemi kaotik karşıtlık olarak yer alır ve kaçışta
baştan başlar.

## Mount

```js
import { mountThreeBody } from './three-body.mjs';
const tb = await mountThreeBody(host, { t: undefined, speed: .8, labels: false, autoplay: true });
tb.timeline.scrub(12);      // t = 12 birim: her pano baştan yeniden entegre edilir (deterministik)
tb.labels = true;           // pano adları
tb.catalog;                 // CATALOG: { id, name, note, T, masses, src, state(), chaotic? }
tb.panels();                // [{ id, t, minDist }]
```

Saf (`three-body-model.mjs`): `CATALOG`, `accel`, `advance(state, m, dt, {hMax, k})`,
`energy`, `angularMomentum`, `minDistance`, `sampleOrbit(entry, {n})` →
`{ pts, returnError, energyDrift, momentumDrift, bbox }`.

## URL

`?t=<birim>&speed=<birim/s>&labels=1&export=1`

## Model ve dürüstlük

- G = 1, nokta kütleler, düzlemsel. Başlangıç koşulları literatürden:
  Šuvakov & Dmitrašinović 2013 (eşit kütle aileleri; r = (−1,0),(1,0),(0,0),
  v = (ẋ,ẏ),(ẋ,ẏ),(−2ẋ,−2ẏ)), Lagrange 1772 (ω² = 3G/d³, eşit kütle; genel
  kütle için ω² = GM/d³), Euler 1767 (ω² = 5G/(4a³)), Broucke 1975 (A2),
  Burrau 1913 (kütle 3·4·5, hızsız başlangıç).
- Periyodiklik iddiası DENETLENİR: `validate-astro` her çözümü bir periyot
  yayar ve başlangıca dönüşü ölçer (≤ 2e-3, yin-yang II ≤ 5e-2), enerji ve
  açısal momentum korunumunu kontrol eder. Butterfly IV bu denetimi
  geçmediği için katalogda değildir.
- İntegratör RK4 uyarlanır adım: h = min(h_max, k·d_min^1.5).

## Sınırlar

Panolar bağımsız ölçeklenir (uzunluklar karşılaştırılamaz); iz süresi
gösterim parametresi; Pisagor döngüsü fiziksel değildir; birimsiz sistem.

## Hareket

Giriş: panolar sırayla belirir (1,2 s). Sonra sürekli entegrasyon: hız
`speed` birim/s (varsayılan 0,8 → figure-8 periyodu ≈ 8 s, bumblebee ≈ 80 s).
Izler toplamsal karışımla çizilir (ışık kaynağı), dekor ışıması yok.
Statik/azaltılmış hareket: t = 4,5 tablosu.
