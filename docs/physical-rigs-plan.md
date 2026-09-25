# physical_rigs — Fiziksel Aksam ve Mekanizma Animasyonları · Mühendislik Planı

> Durum: **F0 UYGULANDI (23 Eylül 2026)** — parça sözleşmesi (§2) bütün
> kuruculara işlendi: adlı eklem grupları, `userData.rig` haritası (eksen, sınır,
> hız, `found` denetimi), gezginde gerçek rocker→bogie→tekerlek pivot ağacı,
> `userData.notes {regime, why}` her araçta; vitrin odaklanan aracın notunu ve
> eklem listesini basar. Aynı turda beş birinci-dalga araç mekanizma odaklı
> detaylandırıldı (SADA, iki eksenli çanak gimbali, panjur, bal peteği strok'lu
> bacak + temas probu + merdiven, TVC aktüatörleri, kafes kanatçık/bacak
> eklemleri, iki yarım başlık, X-düzeni SM kanatları, pencereler, kapsül RCS'i,
> P-POD anahtarları). Piksel-diff YAPILMADI: detaylandırma görünür değişiklik
> istediği için "birebir aynı" hedefi bu turda geçerli değildi; ekran
> görüntüleriyle doğrulandı. F1 KISMEN UYGULANDI (23 Eylül 2026, ikinci tur):
> `presets/physical_rigs/rig-core.mjs` (three'siz eklem sürücüsü: kapalı form
> kritik sönüm, hız sınırı, sınır, tek yön, yay, spin + stroboskop, translate;
> saf çözücüler solveRockerBogie / ackermann / wheelAdvance / slipRatio),
> `choreography.mjs` (araç başına saf f(t) programlar), `scripts/validate-rigs.mjs`
> (44 denetim, CI'da) ve craft vitrininde Mekanizma/Etiketler anahtarları +
> rotor bulanıklık diski. surface-scene direği artık adla (`mastPan`) sürüyor;
> kopya HGA kaldırıldı.
>
> **F2 UYGULANDI (23 Eylül 2026, üçüncü tur — kaynak: Masaüstü/Sunumlar/rover-sahnesi
> "Night Traverse" sahnesinden çıkarılan teknikler):** `terrain-treadmill.mjs`
> (three'siz, KESİNTİSİZ periyodik zemin: z farkı (P/π)·sin(π(z−cz)/P) vekiline
> çevrilir, döşeme sınırında yükseklik ve eğim birebir eşleşir; döngü kapanışı
> travel = 2π·r_dış·N), `ground-treadmill.mjs` (5 döşemeli örgü, periyodik
> prosedürel renk+tümsek dokusu, tohumlu kaya alanı, tekerlek izi şeridi, temas
> gölgesi), `rover-drive.mjs` (§3.2 tek geçişli çözüm + §3.1 kayma/patinaj),
> `presets/physical_rigs/index.html` vitrini ve motion-manifest. Ölçülen temas
> artığı **1,9 mm** (4,2 birimlik gezgin) — §7.2 ölçütü karşılanıyor.
> craft-blocks tarafında tekerlek AÇIK çıtalı tekerleğe yükseltildi ve
> `WHEEL_OUTER_RADIUS` dışa açıldı; rig haritasındaki `radius` artık çıta dış
> köşesidir (nominal jantla %8 fark, ekranda "tekerlek kayıyor" diye okunuyordu).
>
> İKİ GERÇEK HATA doğrulamayla yakalandı ve kayda geçti: (1) `Lrocker`, rocker
> pivotundan ön tekerleğe mesafe (0,42) sanılmıştı; solveSide eğimi ön tekerlek
> ile BOGIE PİVOTU arasından çözdüğü için doğru açıklık 0,695'tir — 8°'lik bir
> düzlemde gövde 13,1° yunusluyordu. (2) `wrapZ` periyodik değil ANTİ-periyodiktir
> (wrapZ(z+P) = −wrapZ(z)); dikişin kapanması biçimlerin dz'de ÇİFT olmasından
> gelir, bu artık modülde yazılı ve sınanıyor.
>
> **§5.11 (kademe ayrılması) UYGULANDI (24 Eylül 2026):** `jettison.mjs`
> (bırakılan gövde: ayrılma itkisi, takla, balistik; `poseAt` ile KAPALI
> FORM çözüm — herhangi bir t'ye adım atmadan gidilir) ve yeni
> `presets/stage_separation/` vitrini: iki kademeli fırlatma, olaylar
> `launch_ascent/ascent-model.mjs` yörüngesinden türer, itici sahneye
> devredilir, kapak iki yarım hâlinde atılır, kamera yönetmeni olaylardan
> keser. `buildRocket` artık `stage1`/`stage2` ADLI gruplar ve
> `userData.jettison` listesi verir — tüketicinin kütüphaneyi çatallaması
> gerekmez.
>
> **AKSAM DİZİNİ ve LABORATUVARI (24 Eylül 2026):** `mechanism-index.mjs`
> parça sözleşmesindeki eklemleri 16 MEKANİZMA olarak adlandırır (tür,
> yöneten bağıntı, mühendislik gerekçesi, kanıt); `presets/mechanism_lab/`
> bunları patlatılmış görünüm, kinematik iskelet ve hareket zarfıyla
> inceletir. Serbestlik derecesi rig haritasından türetilir; validate-rigs
> §11 her eklem adının kurucuda gerçekten üretildiğini sınar (yanlış
> yazılmış tek ad laboratuvarda sessizce boş satır olurdu).
>
> HENÜZ YOK: toz (§3.4 ikinci yarısı), rota takibi (§4 `follow(path)`),
> kol IK (§5.2), tracker/HGA takibi (§5.3–5.4), cinematic sürüş beat'i (F4),
> terrain_blocks köprüsü (vitrin kendi treadmill alanını kullanıyor).
> `scene-blocks.md` programına ve `webgl-scene-contract.md`'ye bağlıdır. Modül
> ve API adları 16 Eylül 2026'da depodan doğrulandı.
>
> Kardeş planlar: [terrain-system-plan.md](terrain-system-plan.md) (bu plan
> onun `terrain-query` API'sini tüketir), [light-physics-plan.md](light-physics-plan.md)
> (motor gazı → plüm, far açma), [astronaut-figure-plan.md](astronaut-figure-plan.md)
> (aynı eklem/kinematik omurga).

---

## 0. Kullanıcı talebi ve boşluklar

Talep: *"Tekerleklerin dönme animasyonu gibi fiziksel aksamların gerçek fizikle
uyumlu olması; gerekebilecek sistemleri düşün ve geliştir."*

Bugün depoda **hiçbir mekanizma hareket etmiyor** (doğrulandı: cinematic_space
ve lunar_descent'te tekerlek/wheel için rotation araması boş; craft-blocks'ta
yalnız Mars helikopteri rotorları `name` taşıyor, gerisi adsız). surface-scene,
gezgin kafasını **konumdan eşleştirerek** bulmak zorunda kalmış — yani araç
kurucuları hareketli parça sözleşmesi vermiyor. Bu planın ilk işi o
sözleşmeyi kurmak; ikinci işi her mekanizmayı **adlandırılmış fizikle**
sürmek.

Talebin söylemediği, planın kapattığı boşluklar:

| Boşluk | Nerede |
|---|---|
| Tekerlek dönmesi tek başına anlamsız: **araç ilerlemeli** ve arazi üstünde **oturmalı** (rocker-bogie kinematiği), yoksa dönen tekerlek "yerinde patinaj" okunur | §3, §4 |
| Dönme hızı ile ilerleme hızı **bağlı** olmalı: ω = v/r; kayma varsa kayma oranı bildirilir | §3.1 |
| Kurucuların parçaları **adsız** — rig kurulamaz | §2 parça sözleşmesi |
| **Stroboskopik** etki: 18 çıtalı tekerlek 60 fps'te belli hızlarda geri döner gibi görünür | §3.3 |
| Determinizm: her mekanizma `advance(dt)` ile sürülmeli, duvar saati yok | §8 |
| Tekerlek **iz** bırakmalı (vakumda kalıcı), toz kaldırmalı (balistik) — yoksa hareket "kayan model" okunur | §3.4 |
| Gezginden başka aksamlar: direksiyon, kol, çanak, direk, güneş paneli, iniş bacağı, TVC, rotor, flap, kapak | §5 |

## 1. Bugün ne var (kaynağından okundu)

| Yer | Ne | Rig için sınır |
|---|---|---|
| `craft_blocks/craft-blocks.mjs` `buildRover({scale, palette, arm})` (satır 857) | Kasa 0,86×0,44×0,26; tekerlek yarıçapı **0,135**, genişlik 0,095 (tasarım birimi); rocker pivotu (0,02, ±0,245, −0,02), bogie pivotu (−0,22, ±0,245, −0,13); tekerlekler ön (0,44), orta (−0,07), arka (−0,44) x'te, y=±0,31, z=−0,30; diferansiyel çubuğu; direk (0,28,0,0,42) + kafa (0,30,0,0,66); RTG; 3 eklemli kol (arm) | Tekerlek `tekerlek()` grubu **düz `g.add`** ile eklenir: rocker/bogie **hiyerarşisi yok** (strut'lar sabit mesh). Rig için grup ağacı kurulmalı |
| `tekerlek(m,{r,w,cita:18})` (satır 636) | Jant `CylinderGeometry` (+Y aks), 18 çıta, göbek | Aks +Y: dönme `rotation.y` ile |
| `finalize()` (satır 159) | İç grubu `scale/longest` ile ölçekler, merkezler; `userData = {kind, parts, designSize}` | Tasarım koordinatları iç grupta kalır — rig iç grupta çalışır (surface-scene bunu `rover.children[0]` ile yapıyor) |
| `buildMarsHelicopter` | `rotorAlt`/`rotorUst` adlı, `userData.rotors` | Tek adlandırılmış hareketli parça örneği |
| `craft-effects.mjs buildEngineFX` | `update(dt,{gaz, atesle, zeminMesafe})` | Gaz kanalı hazır; TVC (gimbal) yok |
| `cinematic_space/surface-scene.mjs` | Farlar (SpotLight, kapalı), fener nabzı, kafa taraması `kafa.rotation.z = .5·sin(2πt/26)` | Kinematik değil, kozmetik |
| `attitude_gnc/attitude-model.mjs` | Gerçek rijit cisim + tepki tekeri modeli | Uzay aracı yönelimi için yeniden kullanılır (§5.7) |
| `lunar_descent` toz süpürmeleri (satır 1684–1716) | Balistik toz: `LineSegments`, altın açı yerleşim, hız 8–38 m/s, eğim 0,05–0,17 rad | Tekerlek tozu aynı reçete, küçük ölçek |
| `core/geometry-axis.mjs` | `cylX/Y/Z`, `coneX/Z`, `latheX/Z` | Yeni geometri bunlarla |

## 2. Parça sözleşmesi (kurucu tarafı — geriye uyumlu genişletme)

Kurucular `THREE.Group` döndürmeye devam eder; **ek olarak** hareketli
parçaları adlandırır ve bir rig haritası bırakır:

```js
root.userData.rig = {
  kind: 'rover',
  units: 'design',                 // tasarım koordinatları (finalize ölçeğinden önce)
  scaleToRoot: s,                  // finalize'ın uyguladığı ölçek
  joints: {
    'rocker.L': { node: 'rockerL', axis: 'y', range: [-25, 25], deg: true },
    'bogie.L':  { node: 'bogieL',  axis: 'y', range: [-30, 30] },
    'wheel.FL': { node: 'wheelFL', axis: 'y', radius: 0.135, steer: 'steerFL' },
    'steer.FL': { node: 'steerFL', axis: 'z', range: [-90, 90] },  // köşe tekerlekleri
    'mast.pan': { node: 'mastPan', axis: 'z', range: [-180, 180], rateDegS: 12 },
    'mast.tilt':{ node: 'mastTilt',axis: 'y', range: [-87, 91],   rateDegS: 12 },
    'arm.j1' … 'arm.j5', 'hga.az', 'hga.el', 'differential'
  },
  contacts: ['wheel.FL','wheel.FR','wheel.ML','wheel.MR','wheel.RL','wheel.RR'],
  mass: { kg: 899, comDesign: [x, y, z] },        // Curiosity sınıfı; altyazıda bildirilir
};
```

- **Hiyerarşi düzeltmesi**: `buildRover` içinde tekerlekler artık
  `rockerL → bogieL → wheelML` gibi gerçek pivot ağacına çocuk olur; strut'lar
  ilgili grupta yaşar. Görsel sonuç **birebir aynı** (piksel-diff ile
  doğrulanır: rig açıları sıfırken eski/yeni render aynı).
- Diğer kurucular için aynı desen: `buildLander` (bacak dikmeleri:
  `leg.i.stroke`), `buildOrbiter` (`hga.az/el`, `wing.L/R.hinge`,
  `engine.gimbal`), `buildStarship` (`flap.FL/FR/RL/RR`, `engine.i.gimbal`),
  `buildMarsHelicopter` (mevcut rotorlar sözleşmeye taşınır),
  `buildRocket` (`engine.gimbal`, `stage.sep`), `buildCapsule` (`hatch`).
- Adlandırma `node.name`; rig haritası `userData`. Tüketici parça
  bulamazsa **sessizce devre dışı** (surface-scene'in mevcut davranışı).

## 3. Gezgin sürüş rig'i (imza sistem)

`presets/physical_rigs/rover-rig.mjs`:

```js
const rig = createRoverRig(roverRoot, { terrain: terrainQuery, gravity: 1.62, seed });
rig.setCommand({ v: 0.04, steerDeg: 0, arcRadius: null });   // m/s, Curiosity 4 cm/s tipik
rig.update(dt);                                              // saf: durum(t+dt) = f(durum(t), dt)
rig.state  // { pos, yaw, wheelAngles[6], rockerL/R, bogieL/R, bodyPitch, bodyRoll, slip[6], odometer }
```

### 3.1 Tekerlek dönmesi — ω = v/r ve kayma

- Her tekerlek için **yol hızı** `v_i` (dönüş yarıçapına göre iç/dış tekerlek
  farklı: `v_i = ω_yaw · R_i`, Ackermann). Açı: `θ_i += v_i / r · dt`.
- Yarıçap `r` **kurucudan okunur** (`rig.joints['wheel.*'].radius ×
  scaleToRoot × sahne ölçeği`), elle yazılmaz. Gerçek çapalar: Curiosity
  tekerlek çapı 0,50 m; LRV 0,81 m; Lunokhod 0,51 m.
- **Kayma oranı** `s = (ωr − v)/max(ωr, v)`: gevşek regolitte tırmanışta
  s > 0 (tekerlek yerden hızlı döner). Model: `s = s0 + k·tan(eğim)`,
  düzlükte s0 ≈ 0,05, 20° yamaçta ≈ 0,3 (Curiosity/MER gözlemleri bu
  mertebede; manifest "illustrative, eğim-kayma ilişkisi kalitatif"). Kayma,
  görsel dönmeyi ilerlemeden ayırır — **bunu görmek** izleyiciye "gerçek"
  hissini verir; tekerlek daima yol hızından biraz hızlı döner.
- Hız sınırı: `v ≤ v_max(eğim)`; > 25° yamaçta rig ilerlemeyi reddeder (araç
  "durur", tekerlek patinaj: s → 1, toz artar).

### 3.2 Rocker-bogie kinematiği (arazi takibi)

Her kare, 6 temas noktası için `terrain.contact(x, z, r)` sorgusu (silindir
altı yükseklik). Çözüm sıralı, kapalı formlu:

1. Her yan için bogie açısı: orta–arka tekerlek temas yüksekliklerinden
   `β = atan2(h_R − h_M, L_bogie)`.
2. Rocker açısı: ön tekerlek ile bogie pivot yüksekliğinden `ρ`.
3. **Diferansiyel**: gövde yunuslaması `pitch = (ρ_L + ρ_R)/2` — buildRover
   notundaki fizik ("gövde iki yanın ORTALAMASINDA") kodda gerçekleşir;
   differential çubuğu `(ρ_L − ρ_R)/2` kadar döner.
4. Gövde yalpası: sol/sağ ortalama temas yüksekliği farkından
   `roll = atan2(Δh, iz genişliği)`.
5. Gövde yüksekliği: temas noktalarının ortalama yükseklik + geometrik ofset.

Tek geçiş (iterasyon yok): sahne ölçeğinde 6 sorgu + trigonometri, < 0,05 ms.
Kural: **hiçbir tekerlek havada kalmaz** — kinematik çözüm zaten 6 teması
kapatır; `validate-rigs.mjs` temas artığını (tekerlek altı ile zemin
arası) < 1 cm eşdeğerinde denetler.

Yay/sönüm yok (gerçekte de yok). Ama gövde açıları **C0-sürekli** olmalı:
arazi analitik ve pürüzsüz olduğundan açı sürekli; kaya kenarına tırmanışta
ani eğim için 0,15 s'lik kritik sönümlü düzleştirme (görsel, manifest'te
"tekerlek esnemesi ve sürücü hız kısma yerine geçer" diye bildirilir).

### 3.3 Stroboskop (wagon-wheel) etkisi

18 çıtalı tekerlek, çıta geçiş frekansı `f_çıta = 18·ω/2π`, kare hızı 60 Hz.
`f_çıta` 60'ın katlarına yaklaşınca tekerlek durur/geri döner gibi görünür.
Gerçek hızda sorun yok (4 cm/s, r=0,25 → ω=0,16 rad/s → f_çıta=0,46 Hz).
Sinematik hızlandırmada (örn. 10×) 4,6 Hz — hâlâ güvenli; 100× (4 m/s)
46 Hz **tehlikeli**. Kural: rig, `f_çıta > 0,4·fps` olduğunda **çıta hareket
bulanıklığı** açar (jant üstünde açısal bulanıklık dokusu; çıtalar 0'a
kararır, silindir yüzeyinde dönen bant görünür). Export/reduced tablolarında
bulanıklık kapalı, hız düşürülmüş.

### 3.4 İz ve toz

- **İz (rut)**: her tekerlek her 5 cm yolda bir iz damgası basar (grouser
  deseni: kurucudaki 18 çıta aralığından türetilir). Arazi malzemesinin iz
  dokusuna (terrain-plan §5) RenderTarget'a çizim; damga koyulaştırma +
  hafif normal çukuru. Vakumda kalıcı; Mars'ta rüzgâr silmesi YOK (zaman
  ölçeği saat, gün değil — manifest'te bildirilir). Zemin dokusu `?export=1`
  için deterministik: iz, odometre'nin fonksiyonu.
- **Toz**: lunar_descent toz reçetesinin küçük kopyası — kayma oranıyla
  orantılı miktar, balistik, tekerlek arkasından, hız 0,5–2 m/s, uçuş
  0,3–0,8 s. Vakumda parabol, Mars'ta hafif sürüklenme yok (ρ küçük;
  ihmal bildirilir). Kayma yoksa toz az; patinajda çok — toz **kaymanın
  görünür kanıtı**dır.

## 4. Direksiyon ve rota

- Curiosity düzeni: 4 köşe tekerleği döner, 2 orta sabit. **Ackermann**:
  dönüş merkezi orta aks hattında; iç/dış köşe açıları `tan δ_i = L/(R ∓ w/2)`.
- Yerinde dönüş (`arcRadius: 0`): köşeler ±45–90°'ye çevrilir, tekerlekler
  zıt yönlerde döner (gerçek Curiosity "turn-in-place" manevrası).
- Direksiyon aktüatörü hız sınırlı (rateDegS), C0.
- Rota: `rig.follow(path, {v})` — `path` terrain-plan §4.2 sürüş koridoru;
  Catmull-Rom, yay uzunluğu parametreli; yaw yol teğetinden, ama gövde yaw'ı
  teğete **1. dereceden gecikmeli** yaklaşır (araç anında dönmez).
- Bu, cinematic_space vista'sının bir uzantısı olur: `chapter:surface`
  varışından sonra "gezgin 20 m ilerler" beat'i (§9 entegrasyon).

## 5. Diğer mekanizmalar (her biri adlandırılmış fizikle)

| # | Mekanizma | Fizik / kural | Rig API |
|---|---|---|---|
| 5.1 | **Direk pan-tilt** (Mastcam) | Hız sınırlı (≈ 12°/s), hedefe bakma; tarama deseni mozaik (sıra sıra, gerçek panorama alımı gibi) | `mast.lookAt(target)`, `mast.panorama({rows, cols, dwell})` |
| 5.2 | **Robot kol** (5 eklem: azimut, omuz, dirsek, bilek, turet) | CCD veya analitik 3-eklem düzlemsel IK + azimut; eklem sınırları; hız sınırı; "stow" ve "ready" pozları; tureti hedef normale hizala | `arm.reach(point, normal)`, `arm.stow()` |
| 5.3 | **HGA çanağı** (gezgin ve orbiter) | Dünya yönüne 2 eksenli takip: Dünya'nın gök konumu sahne ışık dilinden (surface-scene'deki Dünya konumu) okunur; kör bölge (zenit) | `hga.track(earthDir)` |
| 5.4 | **Güneş panelleri** (orbiter/probe kanatları, Mars gezgini paneli) | Güneş yönüne tek eksenli takip (SADA), yavaş; gölgelenme: panel gövdeyi gölgeler mi (yalnız gölge haritası) | `wing.track(sunDir)` |
| 5.5 | **İniş bacağı strok'u** (lander) | Alüminyum bal peteği ezilmesi **tek yönlü** ve **kalıcı** (Apollo LM): temas hızına göre strok = min(max, E_k/F_ezme) | `leg.i.stroke` — lunar_descent temas olayına bağlanabilir |
| 5.6 | **TVC (motor gimbal)** | ±6–8° iki eksen; plüm yönü gimbal ile döner (craft-effects grubu gimbal düğümüne çocuk); attitude_gnc'den tork komutu alabilir | `engine.gimbal(pitch, yaw)` |
| 5.7 | **Tepki tekerleri / RCS** | attitude_gnc modeli (gerçek Euler + tekerlek doygunluğu) uzay aracı yönelimine bağlanır; RCS pufu craft-effects `vakum` kısa darbe | `attitude.bind(model)` |
| 5.8 | **Helikopter rotorları** | Ters dönen çift rotor, ~2 400 dev/dk → 40 Hz: her kare bulanıklık diski ZORUNLU (§3.3 kuralı), rotor yalnız kalkış/iniş rampasında çıta olarak görünür | `rotor.rpm(n)` |
| 5.9 | **Starship flapleri** | Karın-önde düşüşte duruş kontrolü: yunuslama/yalpa komutu → ön/arka flap açıları, ±15°; flip manevrasında sıra | `flap.command(pitch, roll)` |
| 5.10 | **Kapaklar/mekanizmalar** | Kapsül hatch menteşe, cubesat panel açılması (yaylı, tek yön, sönümlü salınım 2–3 periyot), anten açılımı | `deploy.i(progress)` |
| 5.11 | **Kademe ayrılması** | Roket kademesi: ayrılma hızı 1–3 m/s + hafif yunuslama (piroteknik/yaylı itme), ikinci kademe ateşleme gecikmesi | launch_ascent olay rayına bağlanır |

Her mekanizma **hız sınırlı**, **sınır açılı**, **C0** — gerçek aktüatörler
sıçramaz. Rig, komut değişince hedefe **kritik sönümlü** yaklaşır (ζ = 1);
salınım yalnız yaylı açılımlarda (5.10) ve orada da bildirilir.

## 6. Ortak omurga: `presets/physical_rigs/`

```
presets/physical_rigs/
├── rig-core.mjs         # eklem ağacı, sınırlar, hız limiti, kritik sönüm, advance(dt)
├── rover-rig.mjs        # §3–4
├── arm-ik.mjs           # §5.2 (astronot kolu da bunu kullanır — plan 4)
├── tracker.mjs          # 2 eksenli hedef takibi (HGA, panel, direk)
├── wheel-fx.mjs         # iz damgası + toz (terrain iz dokusuna yazar)
├── deploy.mjs           # tek-yönlü açılım + yaylı salınım
├── index.html           # vitrin: gezgin koridorda sürer; kol/direk/çanak paneli; ?export=1&t=
└── motion-manifest.json
```

- `rig-core` three'ye bağımlıdır (Object3D döndürür) ama **çözücüler
  three'siz** yazılır (`solveRockerBogie(h[6], geom)`, `ackermann(R, geom)`,
  `armIK(...)`) → `scripts/validate-rigs.mjs` Node'da çalışır.
- Blok kuralı: tüketici `physical_rigs` importu başarısız olursa araç
  **statik** kalır (bugünkü davranış) — sert bağımlılık yok.

## 7. Doğrulama (`scripts/validate-rigs.mjs`, CI'a eklenir)

1. **Odometre = ∫v dt**; tekerlek açısı = odometre/r (kayma 0'da) ±1e-9.
2. Rocker-bogie: sentetik arazi (basamak, rampa, tek kaya) üstünde 6 temas
   artığı < 1 cm; diferansiyel eşitliği `pitch = (ρ_L+ρ_R)/2` tam.
3. Ackermann: iç/dış açıların dönüş merkezi aynı nokta (±1 cm).
4. Hız limiti ve sınır açısı ihlali yok (rastgele komut fuzz, 10⁴ adım).
5. Determinizm: aynı seed + aynı komut dizisi → aynı durum hash'i;
   `advance(1/60)×120` = `advance(1/120)×240` (cadence testi, sözleşme §6).
6. Stroboskop kuralı: `f_çıta > 0,4·fps` iken bulanıklık bayrağı açık.
7. Kol IK: hedef erişim hatası < 1 mm eşdeğeri; erişilemez hedefte
   "en yakın" ve bayrak.

Ekran görüntüsü: vitrin tabloları (`?t=0`, `?t=8` tırmanış, `?t=14`
yerinde dönüş) `docs/media/rigs-*.jpg`; eski/yeni buildRover piksel-diff
(sıfır açı) **sıfır fark**.

## 8. Determinizm ve export

- Tüm durum `advance(dt)` toplamı; duvar saati yalnız canlı modda dt kaynağı.
- URL: `?t=<sn>&path=<id>&v=<m/s>&export=1` → `data-frozen-at`.
- Manifest kayıtları: `rig-wheel-rolling` (real: ω = v/r, kayma illustrative),
  `rig-rocker-bogie` (real: kinematik çözüm; sönüm illustrative),
  `rig-ackermann-steer` (real), `rig-wheel-dust` (illustrative, lunar_descent
  toz modeli), `rig-mast-panorama` (real: hız sınırı), `rig-arm-ik`
  (illustrative), `rig-hga-track` (real geometri), `rig-rotor-blur` (real:
  stroboskop kuralı). Reduced motion: gezgin **durur**, tablo t sabit;
  mekanizma pozları donuk.

## 9. cinematic_space entegrasyonu

- `surface-scene.mjs`: `buildRover` → `createRoverRig(rover, {terrain:
  surface.araziYukseklik tabanlı sorgu})`. Bugünkü `etkilesim.guncelle(t)`
  kozmetik taraması `mast.panorama`'ya devredilir (geriye uyumlu: rig yoksa
  eski davranış).
- Yeni beat (opsiyonel, chapter verisi): `destination:{type:'rover',
  drive:{path:'vista-20m', v:0.04}}` — varıştan sonra gezgin 20 m sürer,
  kamera belgesel yayı devam eder. Ölçek dürüstlüğü: 4 cm/s'de 20 m = 500 s;
  sinematik hızlandırma (10×) manifest ve altyazıda ilan edilir.
- Farlar (plan 3) rig durumuna bağlanır: sürüşte açık.

## 10. Riskler

| # | Risk | Azaltma |
|---|---|---|
| P1 | buildRover hiyerarşi düzeltmesi görünümü değiştirir | Sıfır açıda piksel-diff = 0 zorunlu; kurucu dokunulan dosya olduğu için eksen ratchet'i bu dosyada çıplak kurucuları da taşır (kural: dokunulan dosya taşınır) |
| P2 | Terrain-query hazır olmadan rig test edilemez | rig-core'da `flatTerrain`/`rampTerrain` sentetik sorgular; plan 1 F2'ye kadar bunlarla |
| P3 | İz dokusu RenderTarget'ı export determinizmini bozar | İz = odometrenin fonksiyonu; export'ta iz dokusu t'ye kadar tek seferde yeniden çizilir |
| P4 | Sinematik hızlandırma fiziği "yalan" gösterir | Hız çarpanı ayrı kanal; tekerlek/ toz/ kayma **gerçek hızda** hesaplanır, yalnız sim-zaman hızlanır (sözleşme: t'nin fonksiyonu) |
| P5 | Kol IK tekillikleri (dirsek düz) | Sınır açıları 5° payla; tekil yakınında hız düşürme |

## 11. Uygulama fazları

- **F0 — parça sözleşmesi**: buildRover hiyerarşisi + `userData.rig`;
  diğer kurucularda yalnız adlandırma. Piksel-diff. ~0,5 gün.
- **F1 — rig-core + tekerlek + rocker-bogie**: sentetik arazi, vitrin ilk
  hâli, `validate-rigs.mjs`. ~1,5 gün.
- **F2 — direksiyon + rota + iz/toz**: Ackermann, `follow(path)`, wheel-fx,
  stroboskop kuralı. ~1,5 gün.
- **F3 — tracker + kol + açılım + TVC**: HGA/panel/direk, arm-ik, deploy,
  gimbal (plüm grubu gimbal'a taşınır). ~2 gün.
- **F4 — entegrasyon**: surface-scene rig'i, sürüş beat'i, manifest/KATALOG/
  README, `docs/media`. ~1 gün.

## 12. Açık kararlar

1. Sürüş beat'i cinematic_space'e mi, ayrı bir `rover_drive` preset'ine mi? (Öneri: rig vitrini + cinematic opsiyonel beat; ayrı preset çoğaltma olur.)
2. Kütle/COM verisi (Curiosity 899 kg) altyazıda gösterilsin mi? (Görsel etkisi yok; dürüstlük için "sınıf" yeter.)
3. Astronot kolu IK'sı bu modülde mi (arm-ik paylaşımı) — plan 4 evet diyor.

---

## 13. Revizyon (16 Eylül 2026, ikinci tur) — eksikler ve yeni planlarla bağlar

| # | Eksik | Karar |
|---|---|---|
| R1 | §5.7 "tepki tekerleri/RCS" ve §5.3 HGA takibi yönelim matematiğini burada yeniden icat ediyordu. | Gövde yönelimi ve gimbal çözümü **attitude-kit planına** taşındı: `tracker.mjs` = `attitude_blocks/gimbal.mjs` ince sarmalayıcısı; keyhole tekilliği, kablo sarımı sınırı, eigenaxis slew orada. `physical_rigs` yalnız mekanik sınır ve düğüm bağlama yapar. |
| R2 | "Gezginin arada bir sağa sola dönmesi" (kullanıcı) rigs'te bakış davranışı olarak yoktu; surface-scene'in tek-sinüs taraması kalıyordu. | `mast.panorama`/`mast.lookAt` mekanik API kalır; **davranış** (hedef seçimi, dwell, saccade+settle) breathing planı `roverGaze`'den gelir. Rig yalnız hız/ivme sınırını uygular. |
| R3 | Habitat mekanizmaları (hava kilidi kapısı içe açılır, el çarkı, körük) listede yoktu. | `deploy.mjs` genelleşir: `hinge` (menteşe, sınır, içe/dışa), `wheelValve` (çark, tur sayısı), `bellows` (körük uzama). Habitat planı §4.4 tüketir. |
| R4 | Astronot–gezgin etkileşimi: astronot koluyla gezgin panelini açma, kabloyu takma gibi "iki rig'li" hareketler. | `arm-ik` hedefi başka bir rig'in `ports`/düğümü olabilir (habitat `ports`, gezgin `joints`); tek çözücü, iki ağaç. |
| R5 | Stroboskop kuralı yalnız tekerlek/rotor içindi; **pervane/fan** (habitat vent, Mars helikopteri) aynı sınıf. | Kural `rig-core` düzeyine: dönen her düğüm `spokes` sayısını bildirir; `f_çıta > 0,4·fps` → bulanıklık diski. |
| R6 | Toz ortam etiketi: Mars'ta tekerlek tozu "ihmal" demiştik; ρ 0,02 kg/m³ ile sürüklenme küçük ama ince toz **asılı kalır**. | `wheel-fx`: Mars'ta ikinci, uzun ömürlü (3–8 s) asılı toz katmanı (Points, çok soluk), rüzgâr yönlü; Ay'da yalnız balistik. Ortam etiketi light planı `LightEnvironment` ile aynı nesne. |
| R7 | **Devrilme** kontrolü yoktu: yamaçta statik devrilme açısı (COM yüksekliği / iz genişliği). | `rover-rig` `tipMargin` hesaplar (COM izdüşümü ile tekerlek poligonu kenarı arası); altyazıda uyarı bandı; sürüş koridoru kapısı bunu da sınırlar. |

Bağlar: [attitude-kit-plan.md](attitude-kit-plan.md) §6–7, [breathing-motion-plan.md](breathing-motion-plan.md) §6 (`roverGaze`,
`roverHgaTrack`), [habitat-blocks-plan.md](habitat-blocks-plan.md) §4.4, [astronaut-figure-plan.md](astronaut-figure-plan.md) §4.
