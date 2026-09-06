# CR3BP / Lagrange — Üç-Cisim Dinamiği (`/presets/cr3bp_lagrange/`)

Dairesel kısıtlı üç-cisim problemi, dönen çerçeve. L1–L5 ∇Ω = 0'dan
ÇÖZÜLÜR (Newton; artık ‖∇Ω‖ ~ 1e−16, HUD'da), etkin potansiyel alanı,
seçilen Jacobi sabiti için sıfır-hız eğrileri ve yasak bölgeler (C
kaydırıcısıyla boyunların L1 → L2 → L3 → L4/L5 açılışı), test parçacığı
(RK4, Jacobi korunumu canlı), L1/L2 düzlemsel Lyapunov aileleri
(diferansiyel düzeltme + süreklilik), dönen ↔ eylemsiz karşılaştırma.
Çözücü: `presets/core/astro-cr3bp.mjs` (saf). Denetim:
`node scripts/validate-astro.mjs`.

## Mount

```js
import { mountCr3bp } from './cr3bp.mjs';
const cr = await mountCr3bp(host, {
  system: 'earthMoon',                 // earthMoon | sunEarth | sunJupiter
  lyapunov: { L: 'L1', Ax: .025 },     // seçili Lyapunov (parçacık bu yörüngede başlar)
  particle: { x, y, vx, vy }, span,    // ya da özel test parçacığı
  warp: .25,                           // TU/s
});
cr.lagrange.L1        // { x, y, C, residual }
cr.setJacobi(3.17) · cr.setLyapunov('L2', .05) · cr.setParticle([x,y,0,vx,vy,0], 8*Math.PI) · cr.setSystem('sunEarth')
cr.families.L1        // [{ Ax, x0, ydot0, period, C, states }]
cr.timeline.play()/.scrub(t) · cr.dispose()
```

Saf kullanım: `lagrangePoints(mu)`, `jacobi(mu, s)`, `propagate(mu, s0, tEnd, dt, { stm })`,
`lyapunovOrbit(mu, 'L1', Ax)`, `lyapunovFamily(mu, 'L2', [..])`, `zeroVelocityCurves(mu, C)`, `rotatingToInertial(s, t)`.

## Dürüstlük

Düzlemsel gösterim; halo aileleri `halo_manifolds` presetinde, Lissajous yok; dairesel
birincil yörünge, ek pertürbasyon yok. Dünya–Ay L1 = 0,836915 (literatür),
Güneş–Dünya L1 ≈ 1,49 milyon km — bağımsız doğrulamada.
