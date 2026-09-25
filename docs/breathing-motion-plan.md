# life_signs — Nefes (Breathing) Animasyonları Kütüphanesi · Mühendislik Planı

> Durum: **F0–F2 UYGULANDI (24 Eylül 2026)** — `presets/core/life-signs.mjs`
> (§5 primitifleri: oscBank, roughness, poissonSchedule, saccadeSettle,
> segmentChain, gazeProgram, envelope, counterBreath, stationKeeping),
> `presets/life_signs/` (catalog · budget · bind · vitrin · manifest) ve
> `scripts/validate-life-signs.mjs` (34 denetim, CI'da). §6 tablosunun
> tamamı katalogda: 14 satır çalışır, `roverArmTwitch` REDDEDİLMİŞ satır
> olarak durur, 7 satır bağlanacağı kütüphaneyi bekler (astronaut_blocks,
> habitat_blocks, sky_blocks, core/light-physics — §9 F3).
>
> **F2:** surface-scene'in iki TEK SİNÜSÜ (fener `.28+.3·sin(1,5t)`, kafa
> `.5·sin(2πt/26)`) kataloğa geçti; eski davranış `?nefes=0` ile geri gelir.
> §7.7'nin istediği piksel-diff yerine SAYISAL eşitlik kuruldu:
> `stationKeeping`, `cinematic_space/spatial-idle.mjs` ile aynı tohumda
> 1e-12'den yakın aynı kareleri üretir (3 tohum × 1300 kare) — sahne
> kütüphaneye geçtiğinde tek piksel oynamaz.
>
> DOĞRULAMA ÜÇ GERÇEK KUSUR YAKALADI: (1) bakış programında segmentin
> başlangıcını "bir önceki hedef" saymak, bekleme oturma süresinden kısa
> olduğunda 39 000°/s'lik sıçrama üretiyordu — segment zinciri artık bir
> öncekinin ULAŞILMIŞ değerinden başlar; (2) HGA ve panel takibinde
> düzeltme adımının işareti ters yazılmıştı, çevrim başında 2160°/s'lik
> atlama vardı; (3) LED nabzının `sin^p` kalkışının sıfırda eğimi
> SONSUZdur ve 240 Hz'de bile tek karede %70 sıçrar — smoothstep'e geçti,
> durum geçişleri de 0,35 s harmanlanır.
>
> BİLEREK DIŞARIDA: astronot/habitat/gökyüzü davranışları (F3, ilgili
> planlar yazılmadan bağlanamaz), `flameFlicker` (light-physics planının
> alanı; iki yerde tanımlanırsa iki farklı titreşim doğar).
>
> 16 Eylül 2026'da depodan doğrulandı.
> `motion-principles.md` ("bir sahne sessizce nefes alıyor, dört eşzamanlı
> patlamadan iyidir"; süreklilik yasaları; reduced-motion son durumu korur)
> ve `webgl-scene-contract.md` §2/§6 bağlayıcıdır.
>
> Kardeş planlar: her plan bu kütüphaneden **tüketir** —
> [physical-rigs-plan.md](physical-rigs-plan.md) (direk bakışı, anten mikro-takip),
> [attitude-kit-plan.md](attitude-kit-plan.md) (`hold` modunun mikro kanalı),
> [astronaut-figure-plan.md](astronaut-figure-plan.md) (solunum, ağırlık aktarımı),
> [light-physics-plan.md](light-physics-plan.md) (titreşim alanı),
> [sky-objects-plan.md](sky-objects-plan.md) (parıldama, pulsasyon),
> [habitat-blocks-plan.md](habitat-blocks-plan.md) (fan, hava kilidi ışığı).

---

## 0. Talep ve boşluklar

Talep: *"Rover sahnesinde gezginin arada bir sağa sola dönmesi gibi
birçok breathing animasyonu."*

| Talebin söylemediği | Nerede |
|---|---|
| "Sağa sola dönmek" gezginde iki ayrı şeydir: **direk/kafa** çevirir (gerçek: Mastcam panorama, hızı sınırlı) ya da **araç** döner (gerçek: yalnız sürerken). Duran gezginin kendi etrafında salınması **yalan**dır | §3 "gerçek hayat belirtisi" ilkesi; gezgin için kafa/anten/lamba katalogu |
| Nefes = **ölçülmüş genlik ve periyot**: fark edilir ama dikkat çekmez eşiği tanımlanmalı, yoksa her preset kendi "titremesini" icat eder | §4 bütçe kuralları |
| Bir sahnede **kaç şey** nefes alır? Hepsi alırsa "akvaryum" olur | §4.3 dikkat bütçesi |
| Tekrar okunmamalı (φ³ hilesi), kamera ile **negatif korelasyon** — `spatial-idle` bunları çözmüş ama **cinematic_space'e gömülü**, paylaşılmıyor | §2 `core/life-signs.mjs`'e taşıma |
| Fizik nefes almaz: arazi, alan çizgileri, yörünge — bunlara "canlılık" eklemek sözleşme §1 ihlali | §3.3 yasaklar |
| Reduced motion, export, determinizm | §7 |
| Nefes bir **duygu** üretir (feeling-curve: "dinginlik", "yakınlık") — hangi nefes hangi duyguya | §6 katalog duygu sütunu |

## 1. Bugün ne var (kaynağından)

`cinematic_space/spatial-idle.mjs` `createIdleModel(seed,{amplitude, aft, yan})`:
katmanlı salınım (x, z, yaw, roll, pitch) φ³ ölçüşmez oranlarla, `puruz(t)`
iki-sinüs çarpımı zarfı (0,55–1 bandı, sıfıra inmez), kamera nefesi
(negatif korelasyon −0,55), araç solunumu ±%1,3 @ 5,5–8 s, tutunma halkası
(15–19 s sürüklenme + yanma), hepsi saf f(t, seed). Manifest:
`cine-craft-breathing`, `cine-station-keeping-idle`.
`surface-scene.mjs`: fener nabzı `.28+.3·sin(1.5t)` (tek sinüs — kendi
kuralımıza aykırı), kafa taraması `.5·sin(2πt/26)` (tek sinüs, sınırsız hız).
`cosmos-sky.mjs`: parıldama yalnız en parlak %2 (doğru), göktaşı tohumlu program.
`sun_advanced`: benek doğma/sönme, parlama zarfları. `three_body_states`:
kalite yöneticisi.

## 2. Mimari: `presets/core/life-signs.mjs` (altyapı, saf) + katalog

```
presets/core/life-signs.mjs        # SAF: osilatör bankası (φ³), pürüz zarfı, Poisson-olay programı, saccade+settle, kritik sönümlü hedef, korelasyon bağlayıcı
presets/life_signs/
├── catalog.mjs                    # §6 adlandırılmış nefes davranışları (builder'lar): craftIdle, roverGaze, beaconPulse, …
├── budget.mjs                     # §4 sahne dikkat bütçesi: kaç davranış, hangi genlik, çakışma denetimi
├── bind.mjs                       # three.js bağlayıcı: Object3D/ malzeme/ ışık kanallarına yazma (toplamsal, rayı sürmez)
├── index.html                     # vitrin: her davranış izole + "sahne bütçesi" demo
└── motion-manifest.json
```

- `spatial-idle.mjs` **dokunulmaz**; cinematic_space isteğe bağlı bayrakla
  `life-signs` üstüne geçer (aynı seed, aynı kareler — piksel-diff).
- Tüm davranışlar **ikincil kanaldır**: rayı/simülasyonu asla sürmez,
  toplanır (cinematic-space-plan §4 "ikincil offset" kuralı genelleşir).

## 3. İlke: gerçek hayat belirtisi

Her nefes davranışı **gerçek bir mekanizmanın gerçek boşta davranışıdır**;
"canlı görünsün" diye eklenen hareket yok (sözleşme §1'in nefes karşılığı).

| Nesne | Gerçek boşta davranış | Yalan olan |
|---|---|---|
| Duran gezgin | Direk/kafa panorama ve hedef bakışı (hız sınırlı), HGA Dünya'yı izler (yavaş), durum LED'i, RTG yok (görünmez), rüzgâr sensörü yok (Ay) | Aracın yerinde yaw salınımı, süspansiyon "zıplaması" |
| Uzay aracı | Tutunma (mevcut), panel Güneş takibi (yavaş), yıldız izleyici kapağı, RCS pufu | Sürekli sallanma |
| Astronot | Solunum, ağırlık aktarımı, baş/gövde bakış, el mikro-hareketi | Ayakta durup "dans" |
| Habitat | Fan/vent (Mars: dış toz), hava kilidi ışığı, anten mikro-düzeltme, kablo titreşimi (yalnız rüzgârlı ortam) | Yapının "nefes alması" |
| Gökyüzü | Parıldama (yalnız Dünya'dan; uzaydan **yok** — cosmos bunu ilan ediyor), pulsar/değişen yıldız pulsasyonu, göktaşı | Yıldızların sürüklenmesi (drift) — cosmos'ta var, "temsilî" ilanlıdır; yeni sahnelerde kapalı |
| Işık | Alev/LED titreşimi (light planı flicker alanı) | Güneş'in "nabzı" |
| Kamera | El kamerası nefesi (negatif korelasyonlu, mevcut), belgesel yayı | Sürekli paralaks (kullanıcı kaldırttı) |

**3.3 Yasak listesi**: arazi, alan çizgileri, yörünge izleri, HUD sayıları
(gerçek değer değişmiyorsa), gölge (ışık sabitse) nefes almaz. `budget.mjs`
bu sınıflara bağlanmayı reddeder.

## 4. Bütçe kuralları (ölçülmüş)

- **4.1 Genlik**: konum ≤ %1–1,5 nesne boyu; ölçek ≤ %1,3; açı ≤ 0,6°
  (spatial-idle çapaları); ışık ±%15 (craft-effects titreşim sınırı); LED
  nabzı 0,3–1,0 arası emissive.
- **4.2 Periyot**: 5–30 s bandı; hiçbir iki kanal ortak katta (φ³);
  **tek sinüs asla** — pürüz zarfı zorunlu (surface-scene'deki iki tek
  sinüs bu kütüphaneye geçince düzelir).
- **4.3 Dikkat bütçesi**: sahnede aynı anda en çok **3 fark edilir**
  davranış (1 birincil + 2 ikincil); geri kalanı eşik altı. `budget.mjs`
  davranışlara `salience` (0–1) atar, toplam ≤ 1,0; kamera yakınlığı
  salience'ı büyütür (yakın plan gezginde kafa bakışı birincil, fener ikincil).
- **4.4 Olaylar**: seyrek, Poisson-programlı (seed'li; ortalama aralık
  20–60 s): RCS pufu, panorama başlangıcı, göktaşı, LED durum değişimi.
  Her olay zarf (attack kısa, decay uzun).
- **4.5 Korelasyon**: kamera nefesi nesneye negatif (−0,55, mevcut);
  aynı nesnedeki kanallar bağımsız.
- **4.6 Hız sınırı**: mekanik davranışlar (direk, çanak) `physical_rigs`
  hız/ivme sınırıyla (12°/s direk) — nefes bile aktüatör fiziğine uyar.

## 5. Çekirdek primitifler (`core/life-signs.mjs`, saf)

```js
oscBank(seed, { base:[10,18], channels:{ x:{ratio:1, A}, yaw:{ratio:1/1.55, A} } })   // φ³ türevli oranlar, faz tohumlu
roughness(seed, tBase)                       // puruz(t) — iki ölçüşmez sinüs, [0.55,1]
poissonSchedule(seed, meanGapS, jitter)      // olay anları: t'nin saf fonksiyonu (önceden üretilmiş dizi)
saccadeSettle({ rateMax, accelMax })         // hedefe bakış: hızlı kalkış + kritik sönümlü oturma (göz/gimbal)
gazeProgram(seed, targets, dwell:[4,12])     // bakış hedefi seçimi + dwell (rover kafası, astronot başı)
envelope(attack, decay)                      // olay zarfı
counterBreath(model, k=-0.55)                // kamera için negatif korelasyon
```
Hepsi `sample(t)` döndürür (saf); `bind.mjs` three kanallarına yazar.

## 6. Katalog (`catalog.mjs`) — adlandırılmış davranışlar

| Davranış | Nesne | Model | Duygu (feeling-curve) | Salience |
|---|---|---|---|---|
| `craftStationKeeping` | uzay aracı | spatial-idle modeli (taşınır) | dinginlik, güven | 0,4 |
| `craftBreath` | araç | ölçek ±%1,3 @ 5,5–8 s | yakınlık | 0,2 |
| `roverGaze` | gezgin direği | `gazeProgram` (ufuk noktaları, kaya, Dünya, kamera) + `saccadeSettle` 12°/s; ara sıra `panorama` olayı (sıra sıra tarama, 40–90 s'de bir) | merak | 0,5 |
| `roverBeacon` | fener | 3 durumlu LED (nominal yavaş nabız 0,8 Hz / veri iletimi hızlı 3 Hz kısa / uyku) — olay programlı | tanıma | 0,15 |
| `roverHgaTrack` | çanak | Dünya yönüne 0,05°/s sürüklenme + 20 dk'da bir küçük düzeltme (hızlandırılmış: ilan) | yetkinlik | 0,1 |
| `roverArmTwitch` | kol | **yok** — kol boşta kilitli (gerçek). Katalogda "reddedildi" satırı olarak kalır | — | — |
| `panelSunTrack` | güneş kanadı | Güneş yönüne yavaş; gün doğumunda hızlı slew olayı | dinginlik | 0,15 |
| `rcsPuff` | araç | Poisson, craft-effects vakum darbesi 0,4 s (mevcut reçete) | tanıma | 0,3 (olay) |
| `astroBreath` | astronot göğsü | %1 @ 14–18/dk; yürüyüşte 22–28 | yakınlık | 0,2 |
| `astroWeightShift` | astronot | ağırlık bacaktan bacağa 8–14 s, kalça ±1,5 cm | dinginlik | 0,25 |
| `astroLook` | astronot gövde | `gazeProgram` — kask sabit, gövde yaw ±20° | merak | 0,4 |
| `beaconAviation` | habitat/kule | kırmızı engel lambası 1 Hz (gerçek: 20–40 fpm) | tanıma | 0,15 |
| `habitatVent` | habitat | Mars'ta vent tozu (Points, rüzgâr yönlü), Ay'da **yok** | yakınlık | 0,2 |
| `airlockCycle` | hava kilidi | 3 dakikalık döngü ışığı (hızlandırılmış ilan): sarı → yeşil | hazırlık | 0,3 (olay) |
| `cableSway` | kablo/anten | yalnız `env.wind>0`; birinci mod salınımı, rüzgâr gürültüsü | tedirginlik | 0,2 |
| `flameFlicker` | alev/LED | light-physics `flickerField` | — | light planı |
| `starTwinkle` | gökyüzü (Dünya'dan) | cosmos parıldaması (en parlak %2) | dinginlik | 0,1 |
| `variableStar` | kızıl dev/Cepheid | sky planı: gerçek periyot hızlandırılmış (ilan) | hayranlık | 0,3 |
| `meteor` | gökyüzü | cosmos programı | keyif | 0,3 (olay) |
| `cameraBreath` | kamera | `counterBreath` | yakınlık | 0,2 |
| `documentaryArc` | kamera | çok yavaş yay (surface-scene'de var) | hayranlık | 0,3 |
| `hudSettle` | HUD | sayılar **yalnız değer değişince** kısa oturma; boşta sabit | yetkinlik | 0 |

Her davranış `describe()` ile manifest satırını üretir (model, sınır,
reduced, export).

## 7. Reduced motion, export, determinizm

- Reduced: tüm davranışlar **donuk** (tablo t değeri); olaylar yok; LED
  sabit "nominal"; `budget` bunu tek yerden uygular.
- Export: `?t=` tablosu — davranışlar saf f(t, seed) olduğundan kare
  deterministik; olay programı önceden üretilmiş dizi (Poisson tohumlu).
- `advance(dt)` = canlı; cadence testi (1/60 vs 1/120).

## 8. Doğrulama (`scripts/validate-life-signs.mjs`)

1. Spektrum: her davranışın en güçlü iki bileşeni ölçüşmez (oran irrasyonel
   yaklaşımı: |p/q| ile 1e-3 içinde eşleşme yok, q ≤ 12).
2. Genlik bütçesi (§4.1) aşılmaz (10⁴ örnek).
3. Sahne bütçesi: Σ salience ≤ 1,0; fark edilir ≤ 3.
4. Hız sınırı: mekanik davranışlar rateMax'i aşmaz.
5. Yasak sınıf bağlanamaz (arazi vb.) — `bind` hata verir.
6. Determinizm + cadence.
7. cinematic_space geçişi: spatial-idle ↔ life-signs aynı seed, aynı kare (piksel-diff 0).

## 9. Fazlar

- **F0 — core/life-signs** (spatial-idle'ın genelleşmesi) + validate. ~0,5 gün.
- **F1 — catalog (craft, rover, kamera, LED) + bind + budget + vitrin**. ~1,5 gün.
- **F2 — surface-scene geçişi**: fener/kafa tek sinüsleri → `roverBeacon`/`roverGaze` (bayrak, piksel-diff), HGA takibi. ~0,5 gün.
- **F3 — astronot/habitat/gökyüzü davranışları** ilgili planların fazlarıyla birlikte.

## 10. Açık kararlar
1. `roverGaze` bakış hedefleri arasında **kamera** olsun mu (gezgin "bize bakar" — belgesel kırılması)? (Öneri: düşük olasılık, 1/8; etkileyici ama ölçülü.)
2. Salience sayıları vitrinde görünür olsun mu (tasarım aracı olarak)? (Öneri: `?debug=1`.)
