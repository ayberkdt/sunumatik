# habitat_blocks — Uzay Habitatı Bileşen Kütüphanesi · Mühendislik Planı

> Durum: TASARIM (uygulama yok). 16 Eylül 2026'da depodan doğrulandı: depoda
> habitat, hava kilidi, boru/kablo hattı için hiçbir kurucu yok. `scene-blocks.md`
> (saf kurucu, eksen yardımcıları, tek vurgu, yer tutucuya düşme) ve
> `webgl-scene-contract.md` bağlayıcıdır.
>
> Kardeş planlar: [terrain-system-plan.md](terrain-system-plan.md) (saha kapısı,
> boru hattının araziyi izlemesi), [light-physics-plan.md](light-physics-plan.md)
> (`interior` ortamı, dış aydınlatma, Mars gündüzü), [physical-rigs-plan.md](physical-rigs-plan.md)
> (kapı/açılım mekanizmaları), [astronaut-figure-plan.md](astronaut-figure-plan.md)
> (hava kilidi giriş/çıkış), [breathing-motion-plan.md](breathing-motion-plan.md)
> (vent, ışık, kablo salınımı), [sky-objects-plan.md](sky-objects-plan.md) (Mars göğü).

---

## 0. Talep ve boşluklar

Talep: *"Uzay habitatı kurulursa kullanılacak cisimler: Marslı filmindeki
gibi iglo benzeri yapılar (gerçekçi), kablo ve boru hatları; gezegen
üstünde sahne kurgularken gerçekçi bileşenler."*

| Talebin söylemediği | Nerede |
|---|---|
| "Gerçekçi" iki şeyi ister: **mühendislik nedenselliği** (neden bu şekil? — craft-blocks `userData.notes {regime, why}` deseni) ve **yerleşim mantığı** (reaktör uzakta, iniş pisti rüzgâr altında, boru hattı en kısa değil en güvenli yol) | §3 nedensellik tablosu, §6 saha planı |
| Yapılar **zemine oturur**: bağlantı noktaları (ayak, ankraj, regolit yığını) araziden yükseklik ister; boru/kablo **araziyi izler** ve **destek beşikleriyle** taşınır | §5 hat yönlendirme (terrain-query) |
| Basınçlı hacim **şişer**: şişme yapılar düz yüzey değil, gergin zar (toroid/silindir, dikiş şeritleri) | §4.2 şişme yapı geometrisi |
| Radyasyon: Mars'ta uzun süreli habitat regolitle **örtülür** (0,5–1 m) veya gömülür — "iglo" görünümünün gerçek sebebi bu (The Martian'ın Hab'ı geçici, örtüsüz) | §3, §4.3 |
| Ortam farkı: Ay (vakum, 14 gün gece, toz elektrostatik) ↔ Mars (6 mbar CO₂, rüzgâr, toz fırtınası, 24 s 39 dk sol) — kablo salınımı yalnız Mars'ta | §2 ortam etiketi |
| Boru hatları: **ısıl genleşme ilmekleri**, MLI izolasyon, vana kutuları, kablo tavası; içindeki akışkan (O₂, H₂O, CO₂, soğutucu) renk kodu (gerçek standart: NASA/ISS etiketleme) | §4.6 |
| Ölçek dürüstlüğü: modül çapı 3–8 m; astronot 2 m referans | §7 |
| Işık: iç mekân (`interior`) + dış (yol lambaları, kapı lambaları, uyarı fenerleri) | light planı |
| Determinizm, export, manifest (habitat hareketsiz; mekanizmalar ve yaşam belirtileri kayıtlı) | §9 |

## 1. Bugün ne var

craft_blocks (saf kurucu deseni, `makeMats`, `CRAFT_PALETTE`, `finalize`,
`CRAFT_BUILDERS/buildCraft(kind)`), `core/geometry-axis.mjs`, terrain
planı (`clearings` kapısı, `terrain-query`), light planı (`interior`,
`headlamp`), rigs planı (`deploy.mjs`, kapı menteşesi), astronot planı.
Doku: yok (prosedürel + tokenlar; harici doku girerse `asset-provenance.json`).

## 2. Mimari

```
presets/habitat_blocks/
├── habitat-blocks.mjs        # HABITAT_BUILDERS/buildHabitat(kind, opts), HAB_PALETTE, ortam etiketi
├── modules/                  # §4 yapılar: inflatable, rigid-cylinder, dome-igloo, printed-regolith, lander-hab, tunnel, airlock, node, greenhouse, garage
├── systems/                  # §4.5–4.8: power (solar, kilopower, RTG), isru (MOXIE, Sabatier, su çıkarma), tanks, radiators, comms mast/dish, weather station, landing pad, lights
├── routing.mjs               # §5: boru/kablo hatları — araziyi izleyen spline, beşikler, genleşme ilmekleri, kablo sarkması (catenary)
├── site-plan.mjs             # §6: yerleşim kuralları (mesafe, rüzgâr, güneş, sıra), otomatik yerleşim + elle düzeltme
├── details.mjs               # greeble: tutamaklar, etiketler, dikiş şeritleri, ayak pabuçları, ankrajlar, toz filmi
├── index.html                # vitrin: bileşen rafı + örnek üs (Ay/Mars)
└── motion-manifest.json
```

Ortam: `env:'moon'|'mars'` her kurucuya; ortama uymayan bileşen reddedilir
(Ay'da rüzgâr ölçer/kablo salınımı yok; Mars'ta MOXIE var, Ay'da su
buzu çıkarma).

## 3. Nedensellik tablosu (her bloğun `userData.notes.why`'ı buradan)

| Bileşen | Neden bu şekil/yer |
|---|---|
| Şişme habitat (toroid/silindir) | Basınçlı zar en verimli hacim/kütle; katlanıp fırlatılır (Bigelow/TransHab); zar gerginliği dikiş şeritlerini ve bombeyi doğurur |
| Sert silindir modülü | Fırlatıcı başlığına sığar (çap 4,5–8 m); uçlarda küresel/eliptik kapaklar (basınç) |
| Regolit örtülü kubbe / "iglo" | Radyasyon (GCR/SPE) ve mikrometeorit: 0,5–1 m regolit ~ Dünya atmosferi kadar kalkan; 3B baskı (sülfür/bazalt betonu) kubbe **basınç yükü** taşımaz — içte ayrı basınçlı zar |
| Hava kilidi (küçük silindir, iki kapı) | Kayıp hava minimum: hacim küçük; kapılar **içe** açılır (basınç kapıyı mühürler); dış kapı önünde toz temizleme (Ay tozu keskin ve elektrostatik) |
| Tünel/koridor (esnek veya sert) | Modülleri basınç altında bağlar; genleşme körükleri |
| Sera | Işık için şeffaf değil: radyasyon/ısı kaybı yüzünden **opak + LED**; kısmi pencere yalnız Mars'ta konsept |
| Güneş panelleri (tarla) | Mars'ta toz birikimi → eğik + temizleme; Ay kutbunda **dikey** paneller (Güneş ufukta) |
| Kilopower/fisyon reaktörü | ≥ 1 km uzakta, regolit tepeciği/gölge kalkanı arkasında; radyatör kanatları dik (ışıma) |
| RTG | Küçük güç; habitattan uzak, kanatlı |
| ISRU (MOXIE, Sabatier) | CO₂ alım borusu dışarıda, O₂/CH₄ tankları ayrı ve mesafeli (yakıt–oksitleyici ayrımı) |
| Tanklar (küresel/silindirik) | Küre: basınç/kütle optimum; kriyojenik → MLI ile sarılı gümüş/altın görünüm, buz/kırağı Mars'ta |
| Radyatörler | Işımayla ısı atma: büyük düz paneller, Güneş'ten uzağa bakan, habitat dışında |
| İletişim direği / çanak | Yükseklik = ufuk mesafesi; çanak Dünya'ya (attitude kit gimbal) |
| İniş pisti | Habitattan ≥ 500 m, **plüm ejecta** yönünde yapı yok; berm (toprak seti) |
| Rover garajı / şarj | Kapalı olmayan tente (toz ve termal), şarj kablosu |
| Kablo tavaları | Yerden yükseltilmiş (toz), U-cıvata beşikler, her 3–5 m destek; sarkma catenary |
| Boru hatları | MLI izolasyon (gümüş), **genleşme ilmekleri** (U/Ω) her 30–50 m (ΔT 100 K+), vana kutuları, akışkan renk bandı |

## 4. Kurucu kütüphanesi (saf, eksen yardımcılarıyla)

- **4.1 API**: `buildHabitat(kind, { scale=1, palette, env, variant, ... })`
  → `THREE.Group`; `userData = { preset:'habitat-blocks', kind, parts,
  designSize, ports:[{name, pos, dir, type:'hatch'|'pipe-O2'|'power'|'data'}],
  footprint:[{pos, type:'foot'|'anchor'|'berm'}], notes:{regime, why} }`.
  `ports` — hat yönlendirme buraya bağlanır; `footprint` — araziye oturma.
- **4.2 Şişme geometri**: toroid/silindir `latheZ` profilleri, zar bombesi
  (dikişler arası hafif dışa şişme: sinüs modülasyonlu yarıçap), dikiş
  şeritleri (ince kabartma), sert uç halkaları, pencere kapakları,
  koruyucu dış örtü (beta cloth, beyaz-krem, roughness 0,85).
- **4.3 Regolit kubbe**: `latheZ` kubbe + üstüne prosedürel regolit yığını
  (terrain planı `microRelief`/kaya scatter aynı reçete, yerel), 3B baskı
  katman çizgileri (yatay ince şeritler — gerçek görünüm).
- **4.4 Hava kilidi / node**: silindir + iki kapak (rigs `deploy` menteşe,
  içe açılır), el çarkı, basınç göstergesi (gerçek durum: HUD ile bağlı
  değilse yok), dış toz süpürme paspası, tutamaklar, kapı lambası (light).
- **4.5 Güç**: panel tarlası (tek InstancedMesh), Kilopower (silindir +
  radyatör şemsiyesi + gölge kalkanı), RTG (craft-blocks `rtg()` yardımcısı
  dışa aktarılır — kopya değil).
- **4.6 Hatlar** (`routing.mjs`, §5) — akışkan renk bandı standardı:
  O₂ yeşil, N₂ sarı-siyah, H₂O mavi, CO₂ gri, CH₄/yakıt kırmızı, soğutucu
  (amonyak) turuncu, güç (DC) siyah/kırmızı, veri mavi-gri. Bant küçük
  ve mat (tek vurgu kuralı ile çelişmez: bant **bilgi**, vurgu değil).
- **4.7 Tanklar/radyatörler/ISRU**: `latheZ` küre/silindir, MLI malzeme
  (metalness 0,9, roughness 0,35, hafif buruşuk normal), kırağı (Mars,
  gece), radyatör panelleri (beyaz, düz), MOXIE kutusu + alım borusu.
- **4.8 Saha donatısı**: iniş pisti (düz kapı + berm + işaret ışıkları),
  yol (sıkıştırılmış regolit şeridi = terrain iz dokusu), işaret direkleri,
  hava istasyonu (Mars: rüzgâr gülü, sıcaklık), kamera direkleri, tente.
- **4.9 İç mekân** (opsiyonel dalga): koridor kesiti, raflar, yaşam alanı —
  yalnız `interior` ışık ortamı hazırsa; kapsam dışı ilk dalgada.

Malzeme dili: beyaz/krem yumuşak örtü, gümüş MLI, koyu gri sert halkalar,
turuncu **tek vurgu** (kapı çerçevesi/uyarı) — HAB_PALETTE; CRAFT_PALETTE ile
uyumlu. Toz filmi: yükseklik-ağırlıklı kızıl (Mars)/gri (Ay) koyulaştırma
shader parçası (astronot `dust` ile aynı).

## 5. Hat yönlendirme (`routing.mjs`)

```js
routeLine({ from: portA, to: portB, kind:'pipe'|'cable'|'tray', terrain: q,
            fluid:'O2', diameter, supportSpacing: 4, expansionLoopEvery: 40, seed })
→ { group (TubeGeometry/InstancedMesh beşikler), length, describe() }
```
- Yol: A* değil, **kural tabanlı**: düz hat + arazi izleme (`q.height`),
  eğim > 15° ise sarkma yerine destek yüksekliği; kayadan kaçınma
  (`nearestRocks`); köşe yarıçapı ≥ 5·çap.
- **Boru**: yerden 0,3–0,5 m beşiklerde; her `expansionLoopEvery` m'de
  Ω ilmek; vana kutusu bağlantı noktalarında; MLI.
- **Kablo**: beşikler arası **catenary** sarkması (gerçek: `y = a cosh(x/a)`,
  a gerilimden; sahne: sarkma = %2–4 açıklık) — Mars'ta rüzgârda birinci mod
  salınımı (breathing `cableSway`).
- **Tava**: yükseltilmiş U profil, kapaklı, kablolar içinde.
- Geometri kurulumda bir kez (TubeGeometry), yeniden kurma yok.

## 6. Saha planı (`site-plan.mjs`)

- Girdi: modül listesi + ortam + arazi + Güneş azimutu + rüzgâr yönü (Mars).
- Kurallar: reaktör ≥ 1 km & gölge kalkanı habitat yönünde; iniş pisti
  ≥ 500 m & ejecta yönünde yapı yok; yakıt tankları ≠ O₂ tankları
  (≥ 50 m); paneller gölgede değil (Güneş azimutu); radyatörler Güneş'e
  sırt; hava kilidi rover garajına yakın; ISRU alım borusu rüzgâr üstü
  (Mars); hepsi terrain `clearings` (`site` tipi: düzleştirme + sıkıştırma
  dokusu) olarak araziye **geri yazılır** (terrain planı §4.2 genişletme).
- Otomatik yerleşim: kısıt-tatmin + mavi-gürültü; sonra `overrides`
  ile elle konum. Deterministik.
- Çıktı: `describe()` → altyazı/HUD için mesafeler ("reaktör 1,2 km").

## 7. Ölçek ve referans
1 birim = 100 m (terrain/lunar ile aynı); modüller gerçek boy (silindir
çap 4,5 m, uzunluk 8–12 m; şişme toroid 8–10 m; kubbe 6–12 m). Vitrinde
astronot (plan 4) ve gezgin (3 m) referans olarak durur.

## 8. Doğrulama (`scripts/validate-habitat.mjs`)
1. Her kurucu: `ports`/`footprint` dolu; footprint noktaları arazide
   penetrasyon < 2 cm (terrain-query, sentetik).
2. Hat: eğim sınırı, destek aralığı, ilmek sayısı = ⌊L/every⌋; catenary
   sarkma bandı.
3. Saha kuralları: mesafe kısıtları ihlalsiz; ejecta konisi boş.
4. Ortam: `windSensor@moon` reddedilir; `cableSway@moon` bağlanamaz.
5. Eksen ratchet sıçramaz; determinizm.
Ekran görüntüleri: Mars üssü (Hab + sera + tank çiftliği + panel tarlası +
Kilopower ufukta), Ay kutup üssü (dikey paneller, regolit kubbe, uzun
gölge), boru hattı yakın plan (ilmek + beşik + renk bandı), hava kilidi
kapısı + astronot.

## 9. Manifest ve yaşam belirtileri
Habitat hareketsizdir. Kayıtlar: `hab-airlock-cycle` (state-transition,
real sıra/hızlandırılmış), `hab-hatch-open` (rigs deploy), `hab-vent-dust`
(Mars, illustrative), `hab-cable-sway` (Mars, real 1. mod), `hab-beacon`
(real 1 Hz), `hab-panel-track` (real). Reduced: tablo; export `?site=mars&t=`.

## 10. Fazlar
- **F0 — çekirdek modüller**: rigid-cylinder, inflatable, airlock, node, tunnel + HAB_PALETTE + notes; vitrin rafı. ~1,5 gün.
- **F1 — routing + systems (tanklar, paneller, radyatör, Kilopower, RTG dışa aktarımı)**. ~1,5 gün.
- **F2 — dome-igloo/printed-regolith, greenhouse, garage, pad, weather; site-plan; terrain `site` kapısı**. ~2 gün.
- **F3 — ortam varyantları (Ay/Mars), toz filmi, ışıklar (light planı), yaşam belirtileri (breathing planı), astronot hava kilidi klibi; manifest/KATALOG/README/media**. ~1,5 gün.
- **F4 (ayrı dalga) — iç mekân**.

## 11. Açık kararlar
1. İlk üs Mars mı Ay mı? (Öneri: Mars — "Marslı" referansı; Ay kutup üssü F3'te.)
2. İç mekân bu pakette mi? (Öneri: hayır, ayrı dalga; `interior` ışık ortamı önce.)
3. Harici doku (beta cloth, MLI) alınacak mı yoksa prosedürel mi? (Öneri: prosedürel; lisans yükü yok.)
