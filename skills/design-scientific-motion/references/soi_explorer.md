# SOI Explorer — Etki Küresi Kâşifi (`/presets/soi_explorer/`)

Laplace etki küresi r_SOI = a(m/M)^(2/5) ve Hill küresi a(m/3M)^(1/3) gerçek
ölçekte (1 birim = 10 000 km); park yörüngesinden v∞ hedefli kalkış hiperbolü SOI
kabuğuna kadar izlenir; kabukta Dünya → Güneş çerçevesi el değiştirmesi nabızla
işaretlenir; yamalı-konik artığı |v(r_SOI)| − v∞ sayıyla verilir. Sol: three.js
sahne (dokulu Dünya/Ay, fresnel kabuklar, Hill halkası, ilerleyen hiperbol,
sonda, gün işaretleri, SOI geçiş halkası); sağ: kahraman HUD, Laplace log–log oran paneli, Güneş çerçevesi paneli (transfer elipsi, afel, hedef gezegen yörüngesi), gezegen SOI ölçeği.

## Mount

```js
import { mountSoi } from './soi-explorer.mjs';
const so = await mountSoi(host, { case: 'mars', vinf: null, hPark: 200, camera: 'soi', autoplay: true, t: undefined });
so.set({ case: 'jupiter' }); so.set({ vinf: 5, hPark: 300 });
so.model     // departure(): { rp, rSoi, a, e, p, nuSoi, nuInf, turnDeg, pts[{nu,r,x,y,t,v}], tSoiDays, vAtSoi, residual, residualPct, dvInject, helio:{V,v,a,e,aphelion,perihelion,hyperbolic} }
so.timeline  // { t (s), duration, playing, warp (saat / gerçek saniye), play(), pause(), scrub(t) }
so.camera    // current · mode(m) · transitionTo(m): 'soi' | 'moon' | 'earth' | 'follow' | 'free'
so.replay(); so.dispose();
```

Saf (`soi-model.mjs`): `BODIES` (GM, a, R — Merkür…Neptün, Ay), `MU_SUN`, `AU`,
`soiRadius(id)`, `hillRadius(id)`, `orbitalSpeed(id)`, `accelRatios(id, r)`,
`laplaceCrossing(id)`, `departure(id, {hPark, vinf, n})`, `CASES`.

## URL

`?case=mars|moonTli|jupiter|escape&vinf=<km/s>&hpark=<km>&cam=soi|moon|earth|follow|free&t=<gün>&export=1`

## Model ve dürüstlük

- r_SOI ve Hill GM/yarı-büyük eksenden HESAPLANIR; literatür değerleri (Dünya
  924 000 km, Ay 66 100 km, Jüpiter 48,2 milyon km, Hill 1,5 milyon km) yalnızca
  denetimde karşılaştırılır.
- Laplace ölçütü: Dünya çerçevesinde Güneş gelgiti / Dünya çekimi, Güneş
  çerçevesinde Dünya çekimi / Güneş çekimi; iki eğri log–log panelde, kesişim
  bisection ile ≈ 0,87 r_SOI (kapalı biçim birinci mertebe yaklaşımdır — fark
  panelde görünür bırakılır).
- Hiperbol: a = −μ/v∞², e = 1 + r_p v∞²/μ; t(ν) hiperbolik anomaliyle; SOI'de
  |v| > v∞ (Mars için ≈ 4,8 %) — yamalı-konik el değiştirmenin kabul edilen artığı.
- Güneş çerçevesi: V_⊕ + v∞ prograd/paralel → afel (Mars ≈ 1,52 AU) ya da kaçış.

## Sınırlar

Ay dairesel yörüngesinde ortalama hareketle ilerler ama hiperbol Ay çekimini içermez; hiperbol Ay yörünge düzleminde gösterim amaçlı
yönlendirildi; dairesel Dünya yörüngesi; SOI dışı iz asimptot boyunca
(Güneş çekimi eklenmez); Laplace gelgiti radyal birinci mertebe.

## Hareket

Giriş kaskadı `Entrance`: cisimler (0–0,7 s) → kabuklar (0,4–1,4 s, ölçek
büyür) → hiperbol (1,1–2,3 s, ilerleyen Line2 `instanceCount`) → sonda (2,0 s) →
Laplace paneli (0,8–2,0 s). Sonda zaman çizgisinde ilerler (warp saat/s);
SOI geçişinde kabuk nabzı (sönümlü, `pulse *= e^(−1,6 dt)`) ve el değiştirme
etiketi. Kameralar üstel yumuşatma ile geçer; statik/azaltılmış hareket modunda
anında. Işıma noktaları Dünya/Ay'ı SOI ölçeğinde okunur tutar (kamera
uzaklığıyla ölçek).
