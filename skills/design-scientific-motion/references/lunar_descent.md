# Lunar Descent Preset — Ay'a motorlu iniş sahnesi

`/presets/lunar_descent/` — sinematik, fiziksel olarak dürüst üç fazlı
motorlu iniş. ORBITAL blok ailesindendir (`scene-blocks.md`), craft-blocks'un
dondurulmuş araç API'siyle birleşir ve `webgl-scene-contract.md`'ye bağlıdır.

Dosyalar: `descent-model.mjs` (saf fizik, three'siz — Node ile test edilebilir),
`lunar-descent.mjs` (sahne), `lunar-descent.css` (HUD), `index.html` (Türkçe
demo), `motion-manifest.json`.

## Kullanım

```html
<script type="importmap">
  { "imports": { "three": "../moon_advanced/vendor/three.module.min.js" } }
</script>
<script type="module">
  import { mountLunarDescent } from './lunar-descent.mjs';
  const inis = await mountLunarDescent(host, { active: true, seed: 20260813 });
  // inis.advance(dt) · play() · pause() · restart() · scrub(f 0..1) · setPhase(1|2|3)
  // inis.camera.mode → 'chase'|'side'|'surface'; inis.camera.transitionTo(mod)
  // inis.hud(bool) · setActive(bool) · dispose()
  // inis.oynatZamani / toplamOynat / faz / aracKaynak ('craft-blocks'|'yedek')
</script>
```

- Araç `../craft_blocks/craft-blocks.mjs` → `buildLander`'dan gelir;
  içe aktarım başarısız olursa otomatik olarak basit 4 bacaklı yedek araca düşer
  (blok asla bloğa sert bağımlı olmaz). Ayak tabanı craft-blocks'ta −0.46,
  yedekte −0.50 birimdir; modül bunu kendisi seçer.
- Motor alevi `../craft_blocks/craft-effects.mjs` → `buildEngineFX`
  (dondurulmuş API, tip `hover`) dinamik import + try/catch ile bağlanır;
  modül yoksa koni yer tutucu aynen kalır. FX ışıkları her karede araç
  ölçeğinin karesiyle (su²) çarpılır — alçak irtifada küçülen araçtan taşan
  zemin taşkını olmaz (ışık disiplini).
- Ay dokusu `../moon_react_source/public/lunaris/textures/`'tan
  yeniden kullanılır (aesthetic_moon_real.webp + moon_disp_real.webp);
  yüklenemezse en-iyi-aday yerleşimli prosedürel krater dokusuna düşer.
- Demo: `?f=0..1` deterministik kare (duraklatılmış scrub), `?cam=`,
  `?export=1`, `?kapat=arac,iz,toz,zemin,yakin,kaya,iziz,plum,dunya,ao,golge`
  katman anahtarları (`yakin` = çok ölçekli detay katmanı, `iziz` = yer izleri,
  `ao` = temas karartması, `golge` = gölge haritası) (sözleşme §6 hata avı).
- `api.hataAyikla = { sahne, kamera, renderer, gunes, aracSargi, kayaGrup,
  zeminUnif, kayaUnif }` — ölçüm kancası. Gölge kutusu, bias'ın DÜNYA
  karşılığı ve tap frekansları buradan okunur; tap genlikleri tek tek
  sıfırlanarak kusurun kaynağı izole edilir (moiré avı böyle yapıldı).

## Fizik — analitik gerçeklik düzeyi (ENTEGRE, keyframe değil)

Düşey düzlemde 2B durum (x menzil, y irtifa), yarı-örtük Euler, dt = 1/60 s
sim-zamanı; tüm iniş mount'ta bir kez entegre edilir (~40k adım, ~150 ms),
oynatma/scrub bu örnek dizisinden okunur — scrub her karede aynı pikseli verir.

Sabitler (`SABITLER`, descent-model.mjs):

| Sabit | Değer | Not |
|---|---|---|
| g_ay | 1,62 m/s² | sabit |
| v0 | 1673 m/s | 15 km'de dairesel yörünge hızı √(μ/r), μ = 4902,8 km³/s² |
| başlangıç | 15 km irtifa, −450 km menzil | |
| A_FREN | 3,48 m/s² (≈ 2,15 g_ay) | sabit büyüklük; 450 km'de vx→0 kapanışına göre ayarlandı |
| v_e | 3050 m/s (Isp ≈ 311 s) | yakıt Tsiolkovsky ile entegre, gösterge |
| dt | 1/60 s | yarı-örtük Euler |

1. **Frenleme** — itki retrograd + düşey-hız-referanslı destek
   (vyRef −21,6→−29 m/s, u = vx/v0 üzerinden); itki vektörü komutu 2,5 s'lik
   birinci dereceden gecikmeyle izler (C0 süreklilik + sinematik yunuslama).
   Ölçülen son: irtifa 1753 m, menzil −465 m, vy −28,8 m/s.
2. **Yaklaşma** — itki dikeye döner; vyRef −28→−12 m/s (1900→150 m),
   yatay PD sahaya süzülür (kx 9e-4, kvx .18, ±1,2 m/s²).
3. **Son iniş** — dikey; vyRef −12→−0,85 m/s (150→0 m); 30 m altında konum
   kovalama bırakılır, yalnız vx söndürülür (Apollo P66 mantığı). Temasta
   motor kesilir; %2 bacak oturması 1,4 s'de, sekmesiz (süreklilik yasası).

**Doğrulanan bütünlük** (mount'ta konsola yazılır): temas hızı **0,90 m/s**
(≤ 1), toplam ΔV **2083 m/s** (hedef 1,9–2,1 km/s), kalan yakıt **%14,7**,
656 s sim → **33,5 s** oynatma. Araç sahaya −260 m'de konar; sahne temas
noktasını orijine kaydırır (yüzey kamerası ve saha yaması oraya bakar).

Zaman büküm faz başına hedeflenir (frenleme ×33, yaklaşma ×11, son iniş ×4,2,
<40 m'de ×2 yavaş çekim, oturma ×1,25) ve OYNATMA-zamanı alanında yumuşatılır;
anlık çarpan HUD'da görünür.

## Görsel dil

- 1 birim = 100 m; ufuk eğriliği GERÇEK yarıçapla (R = 17374 birim) çizilir;
  düz-zemin fiziği `sagitta(x) = −x²/2R` ile eğri zemine oturtulur (araç, iz,
  gölge hedefi). 5000 birim ötesi ek yuvarlanmayla ufkun altına bastırılır
  (kare düzlem köşe artefaktı bırakmaz).
- **Ölçek abartısı bildirilir:** araç frenlemede ≈ ×65 (600 m görünür), 150 m
  altında sürekli rampayla gerçek boyuta (~9 m) iner; küçülme yaklaşma fazında
  kamera mesafesiyle örtülür (ekranda sabit görünür).
- Zemin: GERÇEK KABARTMALI arazi — paylaşılan yükseklik alanı `h(x,z)`
  (lunar-descent.mjs `araziYukseklik`): seed'li krater alanı (çukur çanak +
  yükseltilmiş kenar halkası + s⁻³ sönümlü ejecta; çap > 40 birimde merkez
  tepecik; güç yasalı boy dağılımı, en-iyi-aday yerleşim), 3 oktav fBm
  regoliti, mare kırışık sırtları (ufuk silueti — ilk üçü kamera ufuklarına
  nişanlı) ve moon_disp yükseklik dokusundan geniş ölçekli katkı (bump ile
  aynı 9× tekrar). Örgü TEK kutupsal ızgaradır: merkezde sık, ufka doğru
  geometrik seyrelen halkalar (~200k tepe, LOD dikişi/z-çatışması yok);
  `computeVertexNormals` alçak güneşle kraterleri okutur. İNİŞ SAHASI TEMİZ
  BÖLGESİ: orijin çevresi ~8 birim yumuşakça h≈0'a bastırılır — temas noktası
  y=0, ayak/gölge/toz mantığı düz zemine güvenmeyi sürdürür. Aynı h(x,z)
  kamera koruması, kaya oturtma ve toz zemin seviyesinde de kullanılır.
- **Yakın plan çözünürlüğü — çok ölçekli detay (üç şeffaf tonlama yaması
  KALDIRILDI).** Eski yakın/orta/mikro yamalar en iyi ihtimalle 54 cm/texel
  veriyordu ve yüzey kamerası bunları ~87 piksele büyütüyordu: "bulanık PNG"
  şikâyetinin kaynağı buydu. Yerine TEK döşenebilir prosedürel detay dokusu
  geldi (`detayDokusu`, 512²; R = albedo modülasyonu, G/B = mikro rölyefin
  yüzey eğimi) ve zemin malzemesine `zeminDetayiEkle` ile enjekte edilir.
  Doku DÖRT dünya frekansında toplanır:

  | tap | periyot | texel | rol |
  |---|---|---|---|
  | A | ≈ 5,0 m | ≈ 1,0 cm | temas planı greni |
  | B | ≈ 21,2 m | ≈ 4,1 cm | ön alan |
  | C | ≈ 89,7 m | ≈ 17,5 cm | orta alan |
  | D | ≈ 380 m | ≈ 74 cm | ufka kadar |

  Frekans adımı **φ³ = 4,236068** (altın oranın küpü): kanıtlanabilir biçimde
  irrasyonel, yani hiçbir tap çifti ortak periyoda oturamaz. Eski dizide
  4,55/1,05 = **13/3 tam rasyoneldi** — B ile C üç periyotta bir yeniden
  kayda giriyordu. Aynı düzeltme kayada da yapıldı (41,7 ↔ 139,0 oranı tam
  10/3'tü; şimdi 41,7 ↔ 41,7·π).

  Pockmark alanı güç yasalı + kraterleşme maskelidir (bazı yamalar kraterli,
  bazıları pürüzsüz regolit) ve kenarları iki harmonikle düzensizleştirilir;
  aynı alan her ölçekte tutarlı kaldığı için kraterler 1,5 cm'den ~17 m'ye
  kesintisiz sürer. Tekrar deseni İKİ bağımsız doku + dört ayrı döndürme ve
  kaydırma ile kırılır. **Mesafeye göre detay bedava gelir:** mip zinciri
  uzakta ortalamayı nötre çeker, yani ince taplar kendiliğinden söner,
  yakında tam açılır. Anizotropi max (16×) — sıyırma açısı asıl kullanım.
  Eski `bumpMap` KALDIRILDI: three'nin bump türevi ekran uzayındadır,
  yörünge irtifasında normal sapmasını kontrolsüz büyütüyordu (üstelik aynı
  yükseklik zaten geometride).
- **ZEMİN MOİRÉ'Sİ — kök neden ve onarım (ölçüldü).** Şikâyet edilen "çapraz
  moiré" bir ALIASING DEĞİLDİ. Ölçüm: ön alanda (kameradan 12–20 m, sıyırma
  açısı ~12,7°) pikselin arazi ayak izi 9,4 mm × 42,8 mm; tap B'nin texeli
  42,9 mm. Yani doku tam çözülüyor, mip/anizotropi doğru çalışıyor. Görünen
  şey dokunun KENDİ yapısıydı: `detayDokusu`'nun beş fBm oktavının değer
  kafesi de EKSENE HİZALI ve aynı yönlüydü, hücre köşeleri üst üste binerek
  düzenli bir NOKTA IZGARASI kuruyordu.
  Kanıt (seed 7, ön alan, yüksek geçirgen + FFT): λ = 6,75–6,96 px, açı
  60–72°; taplar tek tek kapatıldığında güç/medyan **yok 22,6 · A 27,1 ·
  B 152,2 · C 8,8 · D 10,1** — kaynak tek başına tap B. λ tahmini birebir
  tutuyor: per=78 oktavının hücresi 6,56 teksel = 281,6 mm, 42,8 mm/px ile
  6,58 px.
  **Onarım — Gauss tam sayısı kafes döndürmesi.** Her oktav (a,b) tam sayı
  çiftiyle tanımlı M = [[a,b],[−b,a]] matrisinden geçirilir: kafes
  atan(b/a) döner, 1/√(a²+b²) ölçeklenir, `K` bununla bölünerek oktavın
  frekansı korunur. Açılar 0° · 26,6° · 18,4° · 33,7° · 14,0° — hiçbir iki
  oktav artık aynı yönde değil. Üstüne 1-periyotlu, iki frekanslı ALAN
  BÜKMESİ (her oktav için ayrı açıyla döndürülür) düz sıraları da kırar.
  İkisi de DÖŞENEBİLİRLİĞİ birebir korur.
  İKİ TUZAK, ikisi de ölçümle yakalandı:
  1. Önce |det| = 1 olan KESME (shear) matrisleri denendi; ızgara hiç
     kıpırdamadı. Nedeni matematikseldir: **unimoduler tam sayı matrisi Z²'yi
     Z² ÜZERİNE eşler** — kafes kendine gider, yalnız hangi hash değerinin
     hangi düğümde durduğu değişir. Kafesi gerçekten döndürmek için
     det = a²+b² > 1 (alt-kafes) şarttır.
  2. Döndürülmüş kafesle birlikte hash MODÜLÜ de dönmelidir. Düz `% K`
     kullanmak alanı √(a²+b²) kat erken tekrarlatıp yeni bir desen doğuruyor.
     `hashD` düğümü (a·ix − b·iy, b·ix + a·iy) mod Q ile temsilciye indirir
     (Q = K·(a²+b²)); bu eşlemenin çekirdeği tam olarak değişmezlik kafesidir,
     yani doku bir tile'da BİR KEZ tekrarlanır.
  **Ölçülen sonuç** (sahneden bağımsız: dokunun EĞİM kanalının doğrudan
  FFT'si, `doku-olc.mjs`) — kafes tepesi/medyan:

  | oktav bandı | eski | yeni | kazanç |
  |---|---|---|---|
  | ~78 hücre (kusurun taşıyıcısı) | 99,1 | 23,6 | 4,2× |
  | ~180 hücre | 83,7 | 7,2 | 11,6× |
  | ~33 hücre | 72,4 | 48,3 | 1,5× |

  Döşenebilirlik denetimi (karşıt kenar farkı ÷ komşu piksel farkı):
  eski 0,435 · yeni 0,977 — ikisi de dikişsiz. Bükme alanı 128²'lik kaba
  ızgarada bir kez hesaplanıp iki doğrusal örneklenir (en ince bileşeni
  ~47 teksellik bir dalga): texel başına dört ek gürültü çağrısı yerine
  on altıda bir maliyet, kurulum bütçesi bozulmaz.
- **Albedo gerçekçiliği:** ayrı bölge haritası (`bolgeAlbedosu`, 2048²,
  ±800 km): mare/highland tonlaması, koyu bazalt havzaları, seyrek piroklastik
  lekeler ve KRATER ALANIYLA aynı seed'i kullanan taze krater ejecta örtüsü +
  ışın demetleri (ışınlar gerçek krater kenarlarından çıkar).
- **Kayalar:** rastgele yarı-uzayların kesişimi olan DIŞBÜKEY ÇOK YÜZLÜ
  (`kayaGeometrisi`) — çarpma kırılmasının gerçek biçim ailesi. Yüzeyler TAM
  DÜZLEMSELDİR: yarıçap yalnız yarı-uzayların minimumudur, üzerine hiçbir
  warp binmez. Boy dağılımı güç yasalı (N(>D) ∝ D^-2,1: çok küçük çok, iri
  nadir), yerleşim krater kenarı / ejecta hattı yoğunluk alanına göre REDDETME
  ÖRNEKLEMESİYLE kümelenir (düzlükler seyrek, kenarlar kalabalık — tekdüze
  serpme değil), her blok boyunun %22–77'si kadar gömülüdür ve oturduğu yerde
  toz halkası + temas karanlığı (etek izi) bırakır. Görünen boya
  (boy ÷ min(sahaya, yüzey kamerasına uzaklık)) göre dört kalite kademesi:
  2000 / 180 / 80 / 20 yüz; ~1300 blok tek malzemede 4 çizim çağrısına
  kaynaklanır. Kademeler EŞİKLE değil SIRALAMAYLA dağıtılır (eşik kuralında
  slotları ilk uyan blok kapıyordu): kota 12 + 90, üstelik ilk 5 slot yüzey
  kamerasının kadrajına ayrılır — kalanı genel görünürlüğe. NOT: three'de
  `IcosahedronGeometry(1, d)` bir yüzü (d+1)² parçaya böler, 4^d değil.
- **Konjuge eklem takımları (biçim):** kesme düzlemlerinin normalleri küreye
  SERBEST serpilmez. Her blok için bir ortonormal üçlü kurulur; ilk ekseni
  düşeye ≤25° yakındır (blok kırık bir yüzünün üstüne OTURUR), 18–30 düzlem bu
  üçlünün ±eksenleri çevresine saçılır — oturma takımı ≤8°, yan takımlar ≤22°
  koni içinde. Gerekçe ölçüldü: güneş 11° elevede olduğu için N·L normal yönüne
  aşırı duyarlıdır (yataya yakın bir faseti 8° eğmek parlaklığı ~6 kat
  değiştirir). Serbest saçılım ~25 ayrı normal yönü demekti ve blok birbirinden
  kopuk tonlu fasetlerden oluşan bir "kamuflaj deseni" gibi okuyordu. Düzlem
  SAYISI yüksek (zengin köşeli siluet), normal AİLESİ altı: büyük yüzeyler
  tutarlı tonlarda okur. Bloğun üstündeki yataya yakın geniş faset,
  regolitle aynı 11° sıyırma ışığını aldığı için çevresiyle uyumlu bir tonda
  okur — yüzey kamerası ışığın karşı yakasına baktığı (bakış ile ışık arası
  ≈97°) için bloğun okunurluğunu taşıyan yüzey budur.
- **Tepe normali = kesme düzlemi normali:** `computeVertexNormals` yerine her
  tepeye kazanan yarı-uzayın normali yazılır. Faset içinde hiçbir fark yoktur
  (bütün tepeler aynı düzleme aittir), fark yalnız dihedral kenara BİNEN üçgen
  sırasındadır: geometrik normal orada iki düzlemin arasında bir değer alıyor
  ve 11° güneşte kenar boyunca parlak bir TESTERE DİŞİ şeridi bırakıyordu
  (bölünmeyi 980'den 2000 yüze çıkarmak dişi inceltiyor ama yok etmiyordu).
  Düzlem normaliyle binen üçgen iki normal arasında yumuşak geçer: kenar
  aşınmış ince bir pah gibi okur.
- **Kaya yüzey dokusu — GEOMETRİ DEĞİL, TRİPLANAR:** kırık yüzeyin 5–30 cm'lik
  yonga/çentik dokusunu tümüyle `kayaDetayiEkle` taşır; kayalar zeminle AYNI
  detay dokusunu üç düzlemli (|n|³ ağırlıklı) izdüşümle örnekler. Her düzlem VE
  her tap ayrı bir 2×2 DÖNDÜRME ile örneklenir (eğim vektörü aynı döndürmeyle
  sağdan çarpılıp dünya eksenine geri çevrilir): detay dokusunun gürültüsü
  eksene hizalı bir değer kafesidir ve GB kanalları o kafesin merkezi farkıdır,
  ham eksen izdüşümü genlik yükselince doğrudan KARE yamalar bırakıyordu.
  Ölçek ölçülerek seçildi (yüzey kamerası, 1600×900, fov 32°, blok ~15 m'de →
  piksel ayak izi ≈13 mm): tap A ≈2,4 m periyot → 4,7 mm/texel → 2,8
  texel/piksel; tap B ≈0,72 m → 1,4 mm/texel → 9,4 texel/piksel. Hiçbir tap
  BÜYÜTÜLMEZ. Eski 38 cm'lik tap 17 texel/piksele düşüp mip'e gömülüyordu:
  bütün triplanar katkısını sıfırlamak aydınlık yüz parlaklığını 39,6'dan
  yalnız 38,9'a indiriyordu, yani hiç okunmuyordu.
- **Geri alınan tur (kayıt):** "kristal/oyuncak" okumasını kırmak için bir tur
  boyunca en yakın kademe d=9'a çıkarılıp tepeler sırt (ridged) gürültüsüyle
  ötelenmişti. Ölçüm iki kusurun da buradan geldiğini gösterdi: (a) 2000 yüz,
  2,6 m'lik blokta ≈8 cm faset = ekranda 6–11 px; `flatShading` ile her faset
  tek ton, yani şikâyet edilen "JPEG bloğu" yamalar fasetlerin kendisiydi
  (triplanar katkısı tamamen sıfırlandığında yamalar aynen kalıyordu). (b) 11°
  güneşte komşudan 11–13° sapan normaller büyük tutarlı aydınlık düzlem
  bırakmıyor, her şey orta-koyu bulamaca iniyordu: aydınlık yüz / regolit
  parlaklık oranı 0,607'den 0,495'e düşmüştü. Politopu daha ince BÖLMEK yeni
  yüzey detayı üretmez (parçalı düzlemsel bir fonksiyon daha sık örneklenmiş
  olur); "kristal" okumasının çaresi daha çok KIRILMA DÜZLEMİ + yüzeyde gerçek
  doku. Onarım sonrası oran 0,655.
- **Ön plan kompozisyonu:** yüzey kamerasının 6,5 m'lik dibine blok düşmez, boy
  TAVANI 30 m'ye kadar doğrusal rampalanır (8 m'de 0,8 m, 15 m'de 2,6 m) ve
  10–20 m penceresindeki İLK blok deterministik olarak tavanın %58'ine çekilir.
  İki uçtan da kaçınılır: eski kural (5,5 m + boy serbest) ~22 m'deki 2,5 m'lik
  bir bloğun kadrajın köşesini kapatmasına izin veriyordu; bir sonraki tur bunu
  aşırı sıkıp ön planı 1,3 m'ye indirince ölçek duygusu kayboldu. Kahraman blok
  şansa bırakılmaz: bu halkada 20 m içine ortalama ~1,4 blok düşüyor.
- **Saha kraterleri + yakın alan dalgalanması:** uzak krater alanı sahanın
  1400 m çevresini boş bırakıyordu. `sahaKraterleri` (6–90 m çap, 0,15–9
  birim halkası) ve 7–21 m dalga boylu ±10–28 cm dalgalanma h(x,z)'ye eklenir;
  ikisi de temas noktasının 11 m çevresinde tam SIFIRDIR — ayak teması, gölge
  ve toz mantığı düz zemine dayanmayı sürdürür. Arazi örgüsünün ilk halkası
  150 m yerine 5 m'de başlar: ön alan artık dev üçgen dilimleri değil ~1,6 m
  örgüdür (~288k tepe).
- **Yer izleri:** motor plümünün süpürdüğü radyal desen (`plumIziDokusu`,
  1024², açısal kümelenmiş süpürme çizgileri — eşit dağılım "lens patlaması"
  gibi okuyordu) 25 m'de açılır, temasta kalıcılaşır; ayak pedi izleri
  (`pedIziDokusu`) oturmayla birlikte belirir. İkisi de sim-zamanının sürekli
  fonksiyonudur (scrub/dışa aktarım güvenli), vakumda süpürülen toz geri
  oturmadığı için iz KALICIDIR.
- Işık: ~11° elevasyonlu sıcak anahtar güneş (uzun gölgeler), zayıf gökyüzü
  dolgusu (mikro rölyefin güneşten kaçan yüzleri jilet siyahı olmasın) +
  dünya-ışığı. Plum: gaz koluyla ölçeklenen iki iç içe koni + nokta ışık —
  doygun sıcak ton, beyaz patlama yok (ışık disiplini).
- **Gölge: ölçeğe göre DİNAMİK, teksel ızgarasına kilitli kutu.** (Bir tur
  buna gitti; eski kurulum temas planında aracın gölgesini tamamen yok
  ediyordu.) Ölçülen iki kök neden:
  1. Kutu yarısı 2,5 birimde SABİT tabanlıydı → 2048'lik haritada 24,4 cm
     teksel; 9 m'lik araç yalnız 37 teksel, üstüne `radius = 6` PCF
     bulanıklığı (≈1,5 m) ve `intensity = .62` — gölge silik bir lekeye
     iniyordu.
  2. `near = 1, far = 400` → derinlik aralığı 399 birim; ortografik derinlik
     DOĞRUSAL olduğu için `bias = -0,0004` bunun **15,96 m** dünya
     ötelemesine denk geliyordu. 11° güneşte gölgenin derinlik farkı
     h/sin 11° = 5,24·h'dir: aracın 7 m'lik tepesinde 37 m, pedlerin
     dibinde SIFIR. 16 m'lik bias gölgeyi kökünden yiyordu.

  Yeni kurulum (`durumUygula`): kutu yarısı `max(1,7 · araç ölçeği/0,09 …)`
  ile büyür ama 1,25'lik GEOMETRİK bir merdivene yuvarlanır (teksel boyu
  kare içinde sabit kalsın), merkez ışık uzayının iki yanal ekseninde teksel
  ızgarasına yuvarlanır (gölge kenarı akmaz), derinlik aralığı ASİMETRİKTİR
  (ışığa doğru 1,6·yarım, arkaya doğru h/sin 11° + 3,5·yarım — simetrik
  kurulunca 297 m'de zemin `far`ın ötesine düşüp takip kamerasında gölgeyi
  siliyordu) ve bias/normalBias ÖLÇÜLEN teksel boyundan türetilir
  (`normalBias = 1,6·teksel`, `bias = −0,35·teksel/(far−near)`).
  Temas karesinde ölçülen: teksel **8,3 cm** (eski 24,4), dünya bias
  **3 cm** (eski 15,96 m). `PCFShadowMap` + `radius = 1` + `mapSize 4096`:
  vakumda penumbra yok denecek kadar dardır (güneşin 0,53°'lik diski 46 m'lik
  gölgede ancak ~40 cm yarı-gölge bırakır). `intensity = 1` — güneş TAM
  kapanır, gölge içi karanlığı yalnız dolgu ışıkları belirler (0,62 dolguyu
  iki kez sayıyordu). `PCFSoftShadowMap` bu three sürümünde kullanımdan
  kaldırılmıştı ve konsola uyarı basıyordu; artık basmıyor.
  Ölçülen gölge kontrastı (temas karesi, araçlı/araçsız fark maskesi):
  gölge içi **21,9**/255, bitişik aydınlık zemin **94,5**/255 → 4,3×.
- **Temas karartması (ortam örtüşmesi):** `aracAoDokusu` — gövde altındaki
  yumuşak karartma + dört pedin dibinde keskinleşen çekirdek, çarpımsal
  harmanla (`ZeroFactor / OneMinusSrcAlpha`: ışık EKLEMEZ, yalnız kısar).
  Son 30 m'de sürekli açılır (eşik yok). Kayaların "etek izi" ile aynı dil:
  araç zemine yapıştırılmış değil OTURMUŞ okunur. Gölge haritasının
  çözemeyeceği bandı doldurur — güneş gölgesinin yerine değil ÜSTÜNE gelir.
- **Öz-gölge:** araç mesh'lerine `receiveShadow` da açıktır; alçak güneşte
  gövdenin bacaklara, ayak konsollarının pedlere düşürdüğü gölge aracın
  hacmini okutan asıl ipuçlarındandır.
- **Regolit sıçraması — İKİ deneme de ölçümle geri alındı, tekrar denemeyin.**
  (a) Aşağı bakan ayrı bir `DirectionalLight` (fizikle ölçeklenmiş 0,12
  şiddet) kareyi yalnız 365 pikselde (%0,03) değiştirdi: yönlü ışık sadece
  TAM AŞAĞI bakan normalleri aydınlatır, sahnede öyle görünür yüzey yok.
  (b) `HemisphereLight.groundColor`'ı 2,46× yükseltmek aracın gölgeli gövde
  yüzünü 10,6 → 10,6'da bıraktı; karenin %98'inde fark ≤ 2 seviye. Nedeni
  aynı: yarıküre ışığında yukarı bakan yüzeyler (zeminin tamamı) skyColor'ı
  görür. Sıçrama zaten skyColor + dünya-ışığı dolgusuyla temsil ediliyor;
  ölçülen gölge/aydınlık zemin oranı 0,23, Apollo bandında. **Görünür
  katkısı ölçülemeyen ışık eklenmez.**
- **Güneş elevasyonu GERÇEKTEN 11°.** Eski yön vektörü y bileşenine tan(11°)
  koyup normalize ediyordu; yatay bileşenin boyu 1 değil 0,717 olduğu için
  gerçek elevasyon asin(0,2617) = **15,2°** çıkıyordu (belge 11° diyordu —
  ölçüldü). Artık yatay yön ayrı normalize edilip cos/sin ile ölçekleniyor.
  Sonuç: gölgeler h/tan 11° = 5,14·h, yani **%38 daha uzun**; alçak güneşin
  krateri ve blokları okutan asıl aracı bu. Ölçülen yüzey parlaklığı
  93,7 → 79,0'a düştüğü için pozlama rampası yeniden ölçülüp ayarlandı.
- **Pozlama rampası:** `toneMappingExposure` irtifayla sürekli rampalanır
  (13,7 km'de 0,34 → yüzeyde 1,85). Gerekçe fiziktir: araç frenlemede sahanın
  450 km GÜNEŞ TARAFINDADIR, oradaki yerel güneş yüksekliği
  11° + menzil/R_ay ≈ 26–50°, yani sahne iniş boyunca gerçekten 2–4 kat
  kararır. Tek sabit pozlama ya yüzey karesini karartıyor (ort. 28/255) ya
  yörünge karesini patlatıyordu (ort. 235/255, std 9,5). Rampayla ölçülen:
  yüzey 86/255 (std 28), yörünge 150/255 (std 21).
- Toz: yalnız ~25 m altında, plum çarpma şiddetiyle büyüyen radyal, YATIK
  süpürme çizgileri; tamamen seed + sim-zamanı fonksiyonu (scrub güvenli);
  kesmede yeni parça doğmaz, kalanlar balistik çöker (vakumda süspansiyon
  yok — bulut çizilmez).
- İz: kat edilen yörünge yayı, araçtan 160 birimden geride penceresiz kesilir
  (sagitta ile ufkun altına dalan kuyruk "gökten inen çizgi" olarak okunuyordu)
  ve 600→90 m arasında söner.
- Gökyüzü: seeded statik yıldızlar + ufka alçak, küçük mavi Dünya (süsleme).

## Kameralar

| Mod | Kadraj | Otomatik öneri |
|---|---|---|
| `side` | dik açıdan, yörünge yayını gösterir | frenleme |
| `chase` | arkadan-üstten, aracı + ilerideki zemini | yaklaşma |
| `surface` | sahada sabit, yukarı bakan klasik iniş karesi (fov 32) | son iniş |

Geçişler 1,7 s yumuşatılır; kullanıcı seçimi otomatik öneriyi kalıcı olarak
ezer (restart sıfırlar). Duraklatılmışken geçiş ANINDA uygulanır (kare akmaz —
tween asla bitmezdi; deterministik yakalama için de şart).

## HUD ve erişilebilirlik

Deste tipografisi (Inter) + palet belirteçleri (`--color-ink/-muted/-accent/
-canvas/-rule`, koyu yedekli): İrtifa, Dikey hız, Yatay hız, Yakıt (% + çubuk),
Faz adı, zaman çarpanı. Faz geçişleri `aria-live=polite` ile duyurulur.
Gerçeklik altyazısı kalıcıdır: "Analitik rehberli iniş profili — görev
telemetrisi değil; ölçek ve süre sıkıştırılmış."

## İndirgenmiş hareket / dışa aktarım

`prefers-reduced-motion`, `?export=1` veya `html[data-export="true"]` →
son iniş fazında 30 m irtifadaki karede donar (yüzey kamerası, toz karesi
deterministik), kontroller gizlenir, HUD ve altyazı kalır.

## Sınırlar (manifest'te de)

2B düşey düzlem; sabit g (merkezkaç rahatlaması yok); FİZİK düz arazide
çalışır — 3B görsel kabartma yalnız sunumdur (gerçek bölgenin yükseklik
modeli değildir) ve iniş sahası çevresi düzleştirilir; dinamikte sabit kütle;
araç ölçeği ve süre sıkıştırılmış. Gerçek görev
telemetrisi, rehberlik doğrulaması veya iniş güvenliği analizi için KULLANMA —
o iş sayısal/veri-güdümlü ayrı bir preset ister.
