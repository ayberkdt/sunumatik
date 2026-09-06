# Halo Manifolds — Halo Yörüngeleri ve Değişmez Manifoldlar (`/presets/halo_manifolds/`)

CR3BP dönen çerçevede 3B sahne: birincil/ikincil, ∇Ω = 0'dan çözülen L1/L2,
Richardson (1980) 3. mertebe tahmin + 6×6 STM diferansiyel düzeltmesiyle bulunan
HALO AİLESİ (Az sürekliliği, adım yarılamalı), seçilen halo, aynı L'nin düzlemsel
Lyapunov yörüngesi (karşılaştırma), monodromi matrisi Φ(T) özvektörlerinden
kararsız (Wᵘ, ileri) ve kararlı (Wˢ, zaman-tersleme simetrisiyle geri) manifold
demetleri, halo üzerinde hareket eden araç imi; yan panelde x–y / x–z izdüşümleri
ve HUD (Az/Ax km, periyot gün, C, λ_u, ν, det Φ, kapanış, düzeltici artığı,
Richardson → düzeltilmiş farkı, ε büyümesi vs λ_u).

## Mount

```js
import { mountHalo } from './halo-manifolds.mjs';
const hm = await mountHalo(host, { system: 'earthMoon', L: 'L1', AzKm: 45000, northern: true, tEnd: 4, camera: 'overview' });
hm.set({ L: 'L2', AzKm: 20000 });        // yeniden çözer (aile + manifoldlar, ~2 s)
hm.show('sMinus', false);                // Wᵘ±, Wˢ±, family, lyap
hm.camera.transitionTo('lpoint');        // overview | lpoint | top | side | free
hm.model   // { sys, mu, L, lagrange, family, orbit, mono, manifolds:{uPlus,uMinus,sPlus,sMinus}, lyap, growth, toKm, toDays }
hm.timeline.scrub(t)                     // boyutsuz zaman, 0…T
```

Saf çekirdek (`core/astro-cr3bp.mjs`): `richardsonHalo(mu, L, Az, {northern})`, `haloOrbit(mu, L, Az, {northern, dt, guess})`,
`haloFamily(mu, L, AzList, opts)`, `monodromy(mu, orbit)`, `manifold(mu, orbit, mono, {branch, sign, n, eps, tEnd})`,
`lyapunovOrbit/lyapunovFamily` (artık `periodRef` ve yarım-tur geçerlilik denetimiyle). Sarmalayıcı: `halo-model.mjs`
`buildHalo({system, L, Az, northern, manifold:{n, tEnd, eps}})`, `familyAzList(mu, L)`.

## URL

`?sys=earthMoon|sunEarth&L=L1|L2&az=<km>&south=1&tEnd=<birim>&cam=&t=<birim>&export=1`

## Model ve dürüstlük

- Halo: z₀ sabit, (x₀, ẏ₀) y = 0 geçişinde ẋ = ż = 0 olacak şekilde sönümlü Newton (STM 6×6); geçerlilik:
  yarım tur x'in öte ucunda bitmeli, yarım periyot tahminin 0,25–1 katı içinde.
- Aile: Az = γ·(0,08…1,4) listesi, süreklilik ilk başarısızlıkta durur (NRHO ucu ve ailenin katlanması yok).
- Monodromi: güç yinelemesi (Φ ve Φ⁻¹) — yalnız baskın gerçek özçift; merkez altuzayı hesaplanmaz.
- Manifold: ε = 50 km (doğrusal bölge), kesme yarıçapı 2,2 birim ya da cisme çarpma.
- Denetim: `scripts/validate-astro.mjs` "halo" grubu — Güneş–Dünya L2 literatür değeri (x₀ 1,00833, T 180 gün),
  periyodiklik, Jacobi, simetri, Richardson yakınlığı, güney aynası, aile monotonluğu, çatallanma limiti, det Φ = 1,
  λ_uλ_s = 1, özvektör artığı, iz kimliği, ε büyümesi ≈ λ_u, kararlı/kararsız manifold davranışı.
