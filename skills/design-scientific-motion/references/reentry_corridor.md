# Reentry Corridor — Giriş Koridoru (`/presets/reentry_corridor/`)

scene-blocks "wave 2" ORBITAL bloğu. Düzlemsel giriş dinamiği (RK4, US76,
L/D, yatış), Sutton–Graves ısınma, ve koridorun NEDEN var olduğu: sınırlar
γ_E taraması + bisection ile BULUNUR — aşma sınırı tam kaldırma aşağıyla
yakalanan en sığ γ, altında-kalma sınırı tam kaldırma yukarıyla n_max /
q̇_max içinde kalan en dik γ. (h, v) düzleminde kapalı biçim eş-yavaşlama /
eş-ısı-akısı eğrileri ve sınır yörüngeleri; koridor çubuğu; irtifa–menzil
profili; olay rayı (arayüz, tepe q̇, tepe g, son). Çözücü `reentry-model.mjs`
(saf; `../core/astro-atmosphere.mjs` paylaşılır). Denetim:
`node scripts/validate-astro.mjs` (tanım tutarlılığı, enerji korunumu, tepe
q̇ < tepe g, Apollo koridoru, L/D ile genişleme).

## Mount

```js
import { mountReentry } from './reentry.mjs';
const re = await mountReentry(host, {
  vehicle: 'capsule',                    // capsule | capsuleLeo | lifting | ballistic
  entry: { vEntry: 11000, gammaEntry: -6.2, bank: 60, nMax: 10, qMax: 5e6, hEntry: 120e3, hEnd: 10e3 },
  warp: 4,
});
re.sim        // { samples, events, peakG, peakQ, heatLoad, outcome, downrange, beta }
re.corridor   // { gammaOvershoot, gammaUndershoot, width, sweep, overshootSim, undershootSim }
re.setEntry({ gammaEntry: -7 }) · re.setVehicle('lifting') · re.timeline.play()/.scrub(t) · re.dispose()
```

THREE gerekmez. Saf kullanım: `simulateEntry(vehicle, entry)`, `findCorridor(vehicle, entry)`,
`isoDecelCurve(β, n)`, `isoHeatCurve(r_n, q̇)`.

## Dürüstlük

Düzlemsel, dönmeyen Dünya; sabit yatış (kılavuz yok); sabit C_D, L/D;
yalnız konvektif ısınma (Ay dönüşünde radyatif ısınma MODELLENMEZ);
paraşüt fazı yok. Varsayılan Ay dönüşü koridoru [−7,13°, −4,86°] ≈ Apollo
[−7,7°, −5,3°] — sınırların fizikten çıktığının bağımsız kanıtı.

## Hipersonik akış yakın planı

Sahne tuvalinin sol altında, zaman çizgisiyle canlı: yay şoku (duruş mesafesi Billig 1967: Δ/R_n = 0,143·exp(3,24/M²), çizimde 2,2× büyütülmüş, oran HUD'da), şok katmanı ve plazma kuyruğu parlaklığı q̇/q̇_max ile, ısı kalkanı rengi radyatif denge sıcaklığından T = (q̇/εσ)^¼ (ε = 0,85; `blackbody(T)` kara-cisim rengi), ablasyon kıvılcımları kalkan kenarından koparak akışla sürüklenir (sayı ∝ q̇), serbest akım çizgileri hızla kayar. Titreşim deterministik (`flicker(i, t)`, 30 Hz hash); statik modda sabit kare. Bu bir CFD değildir: yalnız Δ/R_n, T_duvar, q̇ ve M ölçekleri bağıntıdan gelir; şok biçimi, türbülans dokusu ve kıvılcımlar temsilîdir (etiket sahnede yazılı). Ana sahnedeki kapsülün ardında da q̇ ile ölçekli kıvılcımlar vardır.
