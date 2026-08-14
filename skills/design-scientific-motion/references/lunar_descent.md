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
  `?export=1`, `?kapat=arac,iz,toz,zemin,yakin,kaya,iziz,plum` katman anahtarları
  (`yakin` = çok ölçekli detay katmanını kapatır, `iziz` = yer izleri)
  (sözleşme §6 hata avı).

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
  | A | ≈ 5 m | ≈ 1,0 cm | temas planı greni |
  | B | ≈ 22 m | ≈ 4,3 cm | ön alan |
  | C | ≈ 95 m | ≈ 19 cm | orta alan |
  | D | ≈ 435 m | ≈ 85 cm | ufka kadar |

  Pockmark alanı güç yasalı + kraterleşme maskelidir (bazı yamalar kraterli,
  bazıları pürüzsüz regolit) ve kenarları iki harmonikle düzensizleştirilir;
  aynı alan her ölçekte tutarlı kaldığı için kraterler 1,5 cm'den ~17 m'ye
  kesintisiz sürer. Tekrar deseni İKİ bağımsız doku + dört ayrı döndürme ve
  kaydırma ile kırılır. **Mesafeye göre detay bedava gelir:** mip zinciri
  uzakta ortalamayı nötre çeker, yani ince taplar kendiliğinden söner
  (aliasing/moiré yok), yakında tam açılır. Anizotropi max (16×) — sıyırma
  açısı asıl kullanım. Eski `bumpMap` KALDIRILDI: three'nin bump türevi ekran
  uzayındadır, yörünge irtifasında normal sapmasını kontrolsüz büyütüyordu
  (üstelik aynı yükseklik zaten geometride).
- **Albedo gerçekçiliği:** ayrı bölge haritası (`bolgeAlbedosu`, 2048²,
  ±800 km): mare/highland tonlaması, koyu bazalt havzaları, seyrek piroklastik
  lekeler ve KRATER ALANIYLA aynı seed'i kullanan taze krater ejecta örtüsü +
  ışın demetleri (ışınlar gerçek krater kenarlarından çıkar).
- **Kayalar:** rastgele yarı-uzayların kesişimi olan DIŞBÜKEY ÇOK YÜZLÜ
  (`kayaGeometrisi`) — çarpma kırılmasının gerçek biçim ailesi; üzerine üç
  oktav yön tabanlı çentik pürüzü, `flatShading` ile keskin kırık yüzeyler.
  Boy dağılımı güç yasalı (N(>D) ∝ D^-2,1: çok küçük çok, iri nadir),
  yerleşim krater kenarı / ejecta hattı yoğunluk alanına göre REDDETME
  ÖRNEKLEMESİYLE kümelenir (düzlükler seyrek, kenarlar kalabalık — tekdüze
  serpme değil), her blok boyunun %22–77'si kadar gömülüdür ve oturduğu yerde
  toz halkası + temas karanlığı (etek izi) bırakır. Görünen boya
  (boy ÷ min(sahaya, yüzey kamerasına uzaklık)) göre dört kalite kademesi:
  1280 / 320 / 80 / 20 yüz; ~1300 blok tek malzemede 4 çizim çağrısına
  kaynaklanır. Yüzey kamerasının 5 m'lik dibine iri blok düşmez (kamera
  platosu), 24 m'ye kadar boy sürekli sınırlanır.
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
- Işık: ~11° elevasyonlu sıcak anahtar güneş (uzun gölgeler; gölge
  yarı-gölgeli, intensity .62), zayıf gökyüzü dolgusu (mikro rölyefin
  güneşten kaçan yüzleri jilet siyahı olmasın) + dünya-ışığı. Plum: gaz koluyla
  ölçeklenen iki iç içe koni + nokta ışık — doygun sıcak ton, beyaz patlama
  yok (ışık disiplini).
- **Pozlama rampası:** `toneMappingExposure` irtifayla sürekli rampalanır
  (13,7 km'de 0,30 → yüzeyde 1,62). Gerekçe fiziktir: araç frenlemede sahanın
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
