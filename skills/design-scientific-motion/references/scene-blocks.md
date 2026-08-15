# Scene blocks — the composable 3D presentation program

GOAL (user directive, 2026-08-13): stop multiplying small presets; build a
small number of EXCELLENT ones — manim-grade, block-by-block composable —
until a deck can be assembled from blocks: aesthetic spacecraft, a stage
that accepts a TRAJECTORY and plays it (lunar landing, transfer maneuver),
and a matching family of ML scenes. Quality over count. Every block obeys
`webgl-scene-contract.md` without exception.

## Categories (call them by these names)

### ORBITAL — Yörünge Sahnesi (`assets/orbital-*`)

| Block | Status | What it is |
|---|---|---|
| `orbital_stage` | **wave 1** | THE core stage: central body (Earth/Moon, real textures), unit system, deterministic timeline (play/scrub/warp), trajectory tracks from Kepler elements, state arrays (data-driven!) or RK4 propagation with impulsive burns; fading trails, apsis markers, burn events with plume + ΔV arrow + pre/post orbit ghosts; camera director (chase/orbit/body/free with smooth transitions); telemetry HUD (t, alt, |v|, ΔV) in deck typography |
| `craft_blocks` | **wave 1** | Parametric aesthetic craft LIBRARY (no mount): orbiter, lander, 2-stage rocket, cubesat, capsule — pure builders returning THREE.Group, shared material language |
| `lunar_descent` | **wave 1** | Powered descent to the lunar surface: braking + vertical phases integrated against lunar gravity, throttle-scaled plume, touchdown dust, alt/vy/fuel HUD, chase/side/surface cameras |
| `launch-ascent-preset` | wave 2 | Gravity-turn ascent with staging, max-Q band, downrange camera |
| `rendezvous-docking-preset` | wave 2 | Chaser/target relative motion (CW equations), approach corridor, docking axis alignment |
| `groundtrack-3d-preset` | wave 2 | Rotating body + 3D orbit + unwrapping 2D ground track, side by side |
| `porkchop-preset` | wave 2 | Departure/arrival ΔV contour surface with window highlight |
| `constellation-coverage-preset` | wave 2 | Walker constellations, coverage cones painting the surface |
| `reentry-corridor-preset` | wave 2 | Entry interface, corridor bounds, heating band |
| `formation-flight-preset` | wave 2 | Multi-craft relative orbits (GRAIL-style pairs) |

### ML — Veri/Öğrenme Sahneleri (`assets/ml-*`)

| Block | Status | What it is |
|---|---|---|
| `ml_loss_landscape` | **wave 1** | 3D loss surface (analytic composite), REAL optimizer integration on its gradient: SGD vs momentum vs Adam trails racing to minima |
| `ml_attention_flow` | **wave 1** | Transformer attention as animated weighted arcs over token strips — real softmax over deterministic embeddings, layer stepping |
| `ml_layer_blocks` | **wave 3** | THE layer LIBRARY (no mount, frozen API — the ML twin of craft-blocks): conv/pool/dense/flatten/norm/activation/attention/residual/input/output builders; type readable from GEOMETRY not colour; every block carries its own in→out shape and parameter count |
| `ml_net_builder` | **wave 3** | THE core ML stage (the ML twin of orbital-stage): give it a declarative architecture, it assembles the net BLOCK BY BLOCK; real shape inference `out=⌊(in+2p−k)/s⌋+1`, verified parameter counts (small CNN = 225,034, matches Keras MNIST exactly), user-editable architecture, forward-pass pulse, camera director |
| `ml_conv_vision` | **wave 3** | Image → sliding kernel → feature maps → pooling → ReLU → decision, with the convolution ACTUALLY computed: the 3×3 patch, all nine products, their sum and the born output pixel are on screen; stride/padding change and the size formula is verified live |
| `ml_loss_functions` | **wave 3** | Loss gallery + comparison: MSE/MAE/Huber/log-cosh, cross-entropy/hinge/focal — curve AND derivative, outlier drag showing MSE blowing up while Huber holds, same data trained under different losses |
| `ml-embedding-projector-preset` | wave 4 | 3D point-cloud embedding space: cluster morph, semantic axis sweep |
| `ml-graph-message-preset` | wave 4 | Graph neural net message passing: pulses along edges, node state updates |

(`neural_network` — feed-forward walkthrough — already exists and stays.)

**Wave 3 was user-driven** (2026-08-14): "ML animasyonlarını beğenmedim. Katmanlama, loss
fonksiyonları ekleme blok blok istenen yapı getirme. CNN gibi görüntü işleme şeylerini
ekleme yok." The lesson generalises: a category is only finished when you can COMPOSE with
it (declare a structure, get it built), not when it has a few standalone scenes. The
frozen-API + placeholder-fallback contract that made the ORBITAL wave parallelisable was
reused verbatim here and worked again — net-builder was coded and verified against a
placeholder while layer-blocks was still being written.

## The frozen craft API (blocks compose against THIS)

`craft_blocks/craft-blocks.mjs` exports pure builders (no mount, no
rAF, no textures fetched — geometry + materials only):

```js
buildOrbiter({ scale=1, palette })   // bus + 2 solar wings + HGA dish + engine
buildLander({ scale=1, palette })    // descent stage: 4 legs, tanks, engine bell
buildRocket({ stages=2, scale=1, palette }) // stacked stages + interstage + fairing
buildCubesat({ units=3, scale=1, palette }) // rail-edged Nu, deployable panels
buildCapsule({ scale=1, palette })   // crew capsule + service module
```

- Return: `THREE.Group`, unit-ish size (longest dimension ≈ 1×scale), origin
  at geometric center, **+X = forward/velocity, +Z = up/dish side, main
  engine thrust exits −X**.
- `palette = { body:0x…, panel:0x…, accent:0x…, metal:0x… }` optional; the
  defaults are the obsidian-champagne family. MeshStandardMaterial, restrained
  metalness/roughness — premium satin, no toy plastic, no emissive gimmicks.
- Consumers import via relative path and MUST degrade to a simple placeholder
  group if the import fails — blocks never hard-depend on each other.

## Quality bar (what "manim-grade" means here)

- Physics honest at the stated truth level; the manifest names model AND
  limitations. A Hohmann arc is a real conic; a descent profile integrates
  real gravity; optimizer trails follow the real gradient.
- Deterministic: seeds in, same frames out; `advance(dt)` external drive;
  export/reduced freeze on a documented tableau.
- One light logic per scene, palette tokens for every UI element, deck
  typography for HUDs — a block must look native inside any saved theme.
- Cameras are directed, not free-floating: every mode has a purpose and a
  smooth transition; no camera motion without explanatory value.
- Verified by SCREENSHOT, not by assertion — headless renders reviewed
  before a block is called done.


## Eksen kuralı (2026-08-15) — beş hatanın ardından konuldu

three.js'te `CylinderGeometry`, `LatheGeometry` ve `ConeGeometry`'nin ekseni
**her zaman +Y**'dir. Blok sözleşmesi ise +X ileri, +Z yukarı der. Bu çeviriyi
her çağrı yerinde elle yazmak tek bir oturumda **beş** ayrı hataya yol açtı:

| Nerede | Ne oldu |
|---|---|
| uçak dikey kuyrukları | beş araçta birden aşağı sarktı |
| Starship burnu | yarıçap ters yönde büyüdü, kâseye döndü |
| Mars helikopteri mili | döndürülmediği için yatay durdu |
| derin uzay sondası çanağı | R_x(−90°) ile aşağı baktı |
| gezgin tekerlekleri | aks yukarı gidip tabak gibi yattılar |

**Beşini de kullanıcı ekran görüntüsüyle buldu.** Kod hiçbir yerde şikâyet
etmedi, çünkü ters bir dönüşüm sözdizimsel olarak kusursuzdur.

`LatheGeometry`'de ikinci bir tuzak var: normaller profilin **sırasına**
bağlıdır. y azalarak giden bir profil, normalleri içe bakan bir yüzey üretir
ve yüzey ters aydınlanır — nasel kaportası, Starship burnu ve sonda çanağı
bu yüzden siyah çıkmıştı, üçünde de palet açık renkti.

### Kural

Çıplak kurucu **yasak**. Adlandırılmış eksen yardımcıları kullanılır:

```js
cylX / cylY / cylZ      // silindir — adında hangi eksen yazıyorsa o
coneX / coneZ           // koni — tepe eksenin POZİTİF ucunda
latheZ / latheX         // lathe — profil sırası İÇERİDE düzeltilir
```

`latheZ`/`latheX` profili gerekirse kendisi çevirir; çağıran sırayı düşünmez.
Böylece ters normal **üretilemez hâle gelir** — belgelenmiş bir uyarı değil,
yapısal bir imkânsızlık.

### Denetim

```
python scripts/eksen-denetimi.py           # özet
python scripts/eksen-denetimi.py --liste   # satır satır
```

Yardımcıların kendi gövdeleri muaftır. **Kuralın konduğu andaki envanter:
65 çıplak kurucu, 11 dosyada.** Bu sayı bilerek sıfırlanmadı: çalıştığı
doğrulanmış geometriyi toplu hâlde yeniden yazmak, kapatmaya çalıştığımız
hatanın ta kendisini üretir. Kural **yeni** kod için bağlayıcıdır; mevcut
çağrı yerleri ancak o dosyaya zaten dokunulduğunda taşınır. Sayının zamanla
düşmesi beklenir, sıçraması ise yeni kodun kuralı atladığı anlamına gelir.
