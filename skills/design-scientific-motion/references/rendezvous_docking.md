# Rendezvous & Docking — Randevu ve Kenetlenme (`/presets/rendezvous_docking/`)

scene-blocks "wave 2" ORBITAL bloğu. Hedef merkezli LVLH çerçevede
Clohessy–Wiltshire göreli hareketi: V-bar / R-bar yaklaşması, bekleme
noktaları, CW iki-impuls hop, keep-out küresi (KOS), yaklaşma koridoru,
Hablani glideslope, kapanma hızı, LOS hizası, temas. "Hedefe doğru it"
hatasını da gösterir (araç yükselir ve GERİYE sürüklenir).

Çözücü paylaşılır: `presets/core/astro-relative.mjs` (CW STM, hedefleme,
PCO/GCO başlangıç durumları, glideslope) — `formation_flight` de aynı modülü
kullanır. Senaryo modeli: `rendezvous-model.mjs` (saf). Denetim:
`node scripts/validate-astro.mjs` (STM özdeşlikleri, RK4 karşılaştırması,
hedefleme artığı, sürüklenmesiz koşul, senaryo temas koşulları).

## Mount

```js
import { mountRendezvous } from './rendezvous-docking.mjs';
const rdv = await mountRendezvous(host, {
  scenario: 'vbar',                 // 'vbar' | 'rbar' | 'push' | 'custom'
  scenarioOptions: { altitude: 400e3, kosRadius: 200, corridorDeg: 10,
                     state: [x, y, z, vx, vy, vz], orbits: 2 },   // custom için
  warp: 30, camera: 'overview',     // overview | dock | chase | free
});
rdv.sim.events / rdv.sim.dvTotal / rdv.sim.contact / rdv.sim.geometry
rdv.timeline.play() .pause() .scrub(t) .setWarp(120)
rdv.camera.transitionTo('dock', { duration: 1400 })
rdv.setScenario('custom', { state: [100, -800, 50, 0, -.1, 0] })
rdv.advance(dt) · rdv.setActive(false) · rdv.hud(false) · rdv.dispose()
```

Saf kullanım (Node'da da çalışır):

```js
import { simulateRendezvous, losMetrics } from './rendezvous-model.mjs';
import { cwTargeting, cwPropagate, meanMotion } from '../core/astro-relative.mjs';
const sim = simulateRendezvous('vbar');          // samples, events, dvImpulsive, dvContinuous
const n = meanMotion(6778e3);
cwTargeting([0,-3000,0], [0,0,0], [0,-250,0], n, 2200)   // { v0, dv1, dv2, dvTotal }
```

## Çerçeve ve eşleme

LVLH: x radyal dışa (+R zenit, R-bar −x Dünya'ya), y iz boyu (+V-bar),
z çapraz-iz. Sahne: X = y, Y = x, Z = −z; 1 birim = 100 m. Port/kapak
yüzleri LVLH orijinine oturur: göreli durum port–kapak mesafesidir, temas
ρ = 0'da gövdeler çakışmaz. Araç boyları abartılıdır (not HUD'da).

## Dürüstlük

CW doğrusal modeldir (|r| ≪ a, dairesel referans; J2/sürükleme yok).
Bekleme V-bar'da doğal, R-bar'da sürekli itkili (a_x = −3n²x) — HUD itkiyi
mm/s² gösterir. Glideslope ideal zorlanmış harekettir; ADCS modellenmez
(hiza LOS açısından geometrik okunur). Varsayılan sonuçlar: vbar toplam
ΔV ≈ 3,49 m/s (2,77 impulsif + 0,72 sürekli), rbar ≈ 12,0 m/s (sürekli
ağırlıklı), temas 5 cm/s.

## Export / reduced-motion

`?sc=&t=&cam=` deterministik kare; tablo glideslope'un 10. dakikası.
