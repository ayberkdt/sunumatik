# craft_blocks — parametrik uzay aracı kütüphanesi

`/presets/craft_blocks/craft-blocks.mjs` — sahne bloklarının paylaştığı
araç KÜTÜPHANESİ. Saf kuruculardır: **mount yok, rAF yok, doku çekme yok** —
yalnızca geometri + malzeme. Sözleşme `references/scene-blocks.md` içinde
DONMUŞTUR; buradaki belge o sözleşmenin uygulama ayrıntısıdır.

## API

```js
import {
  buildOrbiter, buildLander, buildRocket, buildCubesat, buildCapsule,
  CRAFT_PALETTE,
} from '../craft_blocks/craft-blocks.mjs';

buildOrbiter({ scale = 1, palette })            // gövde + 2 güneş kanadı + HGA çanağı + motor
buildLander({ scale = 1, palette })             // iniş kademesi: 4 bacak, tanklar, motor çanı
buildRocket({ stages = 2, scale = 1, palette }) // kademeler + ara halkalar + ojiv başlık (stages: 1–3)
buildCubesat({ units = 3, scale = 1, palette }) // raylı nU gövde (units: 1–6), açılır paneller
buildCapsule({ scale = 1, palette })            // mürettebat kapsülü + servis modülü
```

Her kurucu bir `THREE.Group` döndürür.
`group.userData = { preset:'craft-blocks', kind, parts, designSize }` —
`parts` mesh sayısıdır, `designSize` normalizasyon öncesi tasarım boyutudur.

## Eksen sözleşmesi (sözcüklerle diyagram)

```
            +Z  (yukarı / çanak-kapak tarafı)
             |
  egzoz ←────O────→  +X (ileri / hız yönü; roket burnu, kapsül tepesi)
   (−X)      |
            −Z
```

- **+X ileri**: yörünge aracının umbilikal yüzü, roketin burnu, kapsülün tepe
  kapağı, iniş aracının üst güvertesi hep +X'tedir.
- **−X egzoz**: ana motor çanı her araçta −X'e açılır (iniş aracı dahil —
  iniş yönelimini TÜKETİCİ verir; sergide "dik" duruş için grubu
  `rotation.z = Math.PI/2` ile döndürmek yeterlidir).
- **+Z yukarı/çanak**: HGA çanağı, kapsül kapağı (hatch), iniş aracı anteni,
  küpsatın kamera-karşıtı yüzü +Z tarafındadır.
- **Orijin geometrik merkezde**, en uzun boyut ≈ `1 × scale` (kurucu, tasarım
  oranlarını koruyarak tüm grubu normalleştirir — yörünge aracının 2.4'lük
  kanat açıklığı 1'e iner, gövde orantısı korunur).

## Palet kuralları

```js
palette = { body, panel, accent, metal }   // hepsi isteğe bağlı; sayısal renk (0x…)
CRAFT_PALETTE = { body:0x23252c, panel:0x10151d, accent:0xc9a35c, metal:0x9aa0ab }
```

- Varsayılan obsidyen–şampanya ailesidir; eksik anahtarlar varsayılandan dolar.
- Malzeme disiplini (tüm araçlar aynı dili paylaşır):
  - gövde: `MeshStandardMaterial`, roughness 0.55 / metalness 0.35 (satin);
  - panel hücreleri: koyu `panel` rengi + ondan türetilmiş **ince açık çerçeve**
    (iki tonlu grup — doku yok);
  - metal parçalar (nozul, dikme, halkalar): metalness 0.85 / roughness 0.30;
  - **araç başına TEK vurgu (accent) öğesi**: yörünge aracında çanak jantı,
    iniş aracında kenetlenme halkası, rokette ilk ara-kademe bandı, küpsatta
    erişim kapağı, kapsülde kapak (hatch) halkası;
  - emissive yok, doku yok, `Math.random` yok — tamamen deterministik.

## Parça envanteri (kind → başlıca parçalar)

- **orbiter** — 1×0.7×0.6 gövde, ±X metal geçiş plakaları, 4 kenar rayı,
  −Z radyatörü, ±Y boyunduruk+menteşe+15 hücreli kanatlar (açıklık ≈ 2.4),
  +Z direk+parabolik çanak+**şampanya jant**+besleme anteni, −X çan (Lathe),
  greeble: yıldız izleyici, umbilikal panel, 2 RCS dörtlüsü.
- **lander** — sekizgen gövde (düz yüzeyler bacak aralarında), çerçeve güverte,
  **kenetlenme halkası**, alt etek halkası, gerçek çan profili, 4 yarı gömülü
  tank, ~35° açılı 4 bacak (ana+ikincil dikme, ayak tabanı), anten+mini çanak,
  umbilikal, 2 RCS dörtlüsü.
- **rocket** — incelik oranı ~8; motor eteği, merkez+4 çevre çanı, kademe
  silindirleri, **şampanya ara-kademe bandı**, 4 iki-tonlu kafes kanatçık,
  kablo kanalı, tanjant-ojiv başlık (LatheGeometry, gerçek ρ formülü).
- **cubesat** — nU gövde; 4 görünür ray (gövdeden taşkın), raylara göre gömülü
  1U-hücreli yüzey plakaları, ayrılma halkası, kamera açıklığı, 2 teyp anten,
  ±Y menteşeli iki bölmeli açılır paneller, **şampanya erişim kapağı**.
- **capsule** — 33° yan duvarlı kesik koni + küresel tepe kapağı + kenetlenme
  tüneli/halkası, R=0.72 küresel ısı kalkanı + dudak halkası, **kapak (hatch)
  halkası**, geçiş halkalı servis modülü + 4 radyatör plakası + umbilikal
  kaplama + 4 RCS dörtlüsü, −X ana motor çanı.

## Kompozisyon sözleşmesi (tüketiciler için)

- İçe aktarma **göreli yolla** yapılır; başarısızlıkta blok, basit bir yer
  tutucuya düşmek ZORUNDADIR — bloklar birbirine sert bağımlı olamaz:

```js
let buildOrbiter;
try {
  ({ buildOrbiter } = await import('../craft_blocks/craft-blocks.mjs'));
} catch {
  buildOrbiter = ({ scale = 1 } = {}) => {           // yer tutucu: gövde + kanat imasi
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x23252c, roughness: 0.55, metalness: 0.35 });
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.28, 0.24), mat));
    const kanat = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1, 0.01), mat);
    g.add(kanat);
    g.scale.setScalar(scale);
    return g;
  };
}
```

- Gölge/katman bayraklarını tüketici ayarlar (`traverse` ile `castShadow` vb.);
  kurucular bayrak dayatmaz.
- Sökerken `geometry.dispose()` + `material.dispose()` tüketicinin işidir
  (gösterim sayfasındaki `kur()` örnek desendir).
- Görünür araç asla yeniden kurulmaz (webgl-scene-contract §2); palet değişimi
  gibi ayrık kullanıcı eylemlerinde sök-tak serbesttir.

## Gösterim sayfası

`/presets/craft_blocks/index.html` — beş araç dönme sehpalarında, üç
noktalı ışık (sıcak anahtar + yarıküre dolgu + şampanya jant), palet menüsü,
tel kafes anahtarı, Duraklat düğmesi. `?focus=orbiter|lander|rocket|cubesat|capsule`
yakın çekim kamerası kurar. `window.__craft.advance(saniye)` deterministik
sürüş kancasıdır. Hareket kaydı `motion-manifest.json` içindedir
(`craft-turntable` + `craft-engine-ignition`, ikisi de illustrative).

## Motor ateşleme efekti (craft-effects.mjs)

`/presets/craft_blocks/craft-effects.mjs` — DONMUŞ API:

```js
import { buildEngineFX } from '../craft_blocks/craft-effects.mjs';
const fx = buildEngineFX({ scale = 1, tip = 'vakum', seed = 1, palette });
// → { group, update(dt, { gaz, atesle, zeminMesafe }), dispose() }
```

- `group` orijini MOTOR AĞZINDA; alev −X'e uzar (eksen sözleşmesiyle aynı).
  Tüketici grubu aracın çan çıkışına çocuk olarak ekler.
- `update(dt, { gaz, atesle })` her karede: `gaz` 0..1 throttle; `atesle`
  false→true ateşleme geçici rejimi (~0.3 sn flaş + halka + kıvılcım +
  basınçlanma aşımı), true→false ~0.5 sn sönüm kuyruğu.
  `zeminMesafe` OPSİYONELDİR (sahne birimi, motor ağzından çarpma düzlemine):
  verilmezse `hover` plüm ucunu zemin sayar, diğer tiplerde zemin etkisi
  yoktur — mevcut çağrılar birebir korunur.

### Plüm modeli (hacimsel, shader tabanlı)

Plüm TEK BufferGeometry + TEK ShaderMaterial'dır: q = r/R(u) oranında 7 eş
eksenli iç içe KABUK. Additive toplamları, görüş ışını boyunca yoğunluk
integralinin (Abel dönüşümünün) ayrıklaştırmasıdır — merkezde kalın, kenarda
ince optik yol kendiliğinden çıkar, plüm boyalı koni değil HACİM okunur.
Konum her karede vertex shader'da uniform'lardan kurulur; görünür geometri
hiç yeniden inşa edilmez (webgl-scene-contract §2).

- **Kesme katmanı**: yarıçap, aşağı akışa ADVEKTE eden seed'li periyodik değer
  gürültüsüyle bozulur (`faz = u·kx − t·v`); genlik u ile büyür ve q² ile dış
  kabuklarda yoğunlaşır (çekirdek = izentropik potansiyel koni, düzgün kalır).
  Büyük burgaçlar tüm kabuklarda ORTAKTIR — kabuklar birbirini kesmez; kesişen
  kabuklar moiré benzeri dikey lif bandı üretiyordu.
- **Burgaç frekansı geometriden gelir** (`nAci`/`nEks`): dar/uzun huzmede az
  açısal + çok eksenel, kısa/geniş huzmede tersi. Tek sabit çift kullanılırsa
  geniş plümler yelpaze gibi kırışır.
- **Sıcaklık rampası**: renk YALNIZ T(u,q)'dan analitik türetilir (doku yok).
  Additive katmanlar sRGB tamponda toplandığı ve ACESFilmic katman başına
  uygulandığı için renk durakları ÖLÇÜLEREK ön-telafi edilmiştir: kaynak
  renkler ekranda görünenden doygundur. Ölçülen eksen profili (atmosfer,
  gaz 0.9): boğaz beyaz (doygunluk 0.00) → sarı 0.33 → gövde turuncu
  0.63–0.67 → uç 0.46. Griye yıkanma yok.
- **Kenar (limb) katkısı** sonlu kalınlıklı kabuk için ANALİTİK integre edilir
  (`(√(f²+2δ+δ²) − √(f²−2δ+δ²))/2δ`). Noktasal `1/|N·V|` çekirdeği q=b'de
  ıraksar ve her kabuğun kenarına birer parlak dikey çizgi basar.
- `tip` farkları FİZİKTİR, stil değil:
  - `atmosfer`: eksen boyunca ŞOK HÜCRELERİ. Hücre içi faz p'den şok cephesi
    yarıçapı `rf=|1−2p|`; parlak bölgenin radyal genişliği hücre içinde şişip
    söner → dönel süpürmede ELMAS kesit (küre değil), kesme katmanıyla sınırlı.
    Aralık aşağı akışta genişler (`c=u/(1+0.85u)`) ve gazla UZAR
    (L≈1.3·D·√(Mj²−1)) → gaz 1.0'da az/uzun, gaz 0.25'te çok/kısa hücre.
    Hücreler ortalama etrafında ZITLIK yaratır (taban söner, hücre doyar).
  - `vakum`: şok hücresi YOK; boğazdan itibaren çok geniş açıyla genleşen,
    SOLUK ve SAYDAM plüm (seyrek gaz → zayıf karışım, düşük türbülans).
    Arka plan/gölge dış zarftan geçer.
  - `hover`: zemin etkisi — plüm çarpma düzlemine yaklaşırken yarıçap kabarır
    (durma bölgesi) ve ısınır; düzlemde dışa advekte eden IŞINSAL saçaklı
    duvar jeti tabakası. Saçak merkezde düzleştirilir (açısal koordinat r→0'da
    tekildir; düzleştirilmezse yıldız patlaması artefaktı doğar).
- Diğer katmanlar: ateşleme geçici rejimi (Sprite flaş + halka + Points
  kıvılcım), tek PointLight (decay 2), çan iç ağzına oturan emissive kor
  (craft-blocks malzemelerine DOKUNMAZ — ayrı mesh). **Bütçe (ölçüldü)**:
  3–4 mesh + tek Points + tek Sprite + tek PointLight; 2–3 çizim çağrısı,
  ~86k üçgen. **Maliyet**: `buildEngineFX` 13–20 ms (eski koni+CanvasTexture
  sürümü ~26 ms), ilk karede bir kerelik shader derlemesi 84–121 ms
  (SwiftShader/yazılım), `update()` 0.01–0.04 ms.
  Parlaklık titreşimi 12–30 Hz karışımı, ±%15 sınırlı; plüm, zemin jeti ve
  ışık AYNI titreşim değerini paylaşır (bileşik band büyümez).
- Fragment'ler `#include <tonemapping_fragment>` + `<colorspace_fragment>` ile
  biter; `pow` tabanları guard'lı, smoothstep kenarları asla çakışmaz (§3).
- Deterministik: seed'li mulberry32 + saf GLSL hash; zaman yalnız
  `update(dt)` toplamı. Math.random / Date.now yok.
- Vitrin: Ateşleme paneli (araç/tip/gaz/Ateşle-Kes);
  `?fx=1&arac=<id>&tip=<tip>&gaz=<0..1>[&t=<sn>]` deterministik açılış —
  `?t=` sabit-zaman modu sahneyi o âna sarıp DONDURUR (headless doğrulama);
  dışa aktarım / azaltılmış harekette tablo t=2.0 sn orta-yanmadır.
  Yumuşak bağımlılık: import başarısız olursa vitrin ateşlemesiz çalışır.


## İkinci dalga (2026-08-15) — dört yeni blok

`CRAFT_BUILDERS` / `CRAFT_LABELS` / `buildCraft(kind, opts)` kaydı da bu
dalgada eklendi; sahneler artık isimle araç kurabiliyor.

| Blok | Ne | Geometride görünen fizik |
|---|---|---|
| `buildStarship({booster})` | Paslanmaz gemi; `booster: true` ile tam yığın | Flapler KANAT DEĞİL: araç karnı önde, paraşütçü gibi iner; flapler kaldırma değil DURUŞ kontrolü yapar. Arka flapler büyüktür çünkü motor kütlesi ağırlık merkezini arkaya çeker. İki tür motor: vakum çanı büyük (yüksek genişleme oranı = yüksek özgül itki), deniz seviyesi çanı küçük (atmosferde akım ayrılmasın diye). Isıl karo YALNIZ bir yüzde — araç hep aynı yüzü akıma verir. |
| `buildRover({arm})` | Altı tekerlekli, rocker-bogie | **Yay yoktur.** Rocker (ön tekerlek + bogie ekseni) ve bogie (orta + arka), gövdeyi iki yanın ORTALAMASINDA tutan bir diferansiyele bağlıdır: bir tekerlek kendi çapına yakın bir kayaya tırmanırken diğer beşi yerde kalır. Tırmanma yeteneği tekerlek çapıyla ölçeklendiği için tekerlekler orantısız büyüktür. Çıtalar (grouser) gevşek regolitte kazır. RTG yukarı kanıktır: ışıma görüş açısını açar. |
| `buildMarsHelicopter()` | Eş eksenli, ters dönen çift rotor | İtki ≈ ρA(ΩR)², Mars'ta ρ Dünya'nınkinin ~%1,2'si. Hem alan hem uç hızı büyütülmüş (rotor devasa, ~2400 dev/dk) ama uç hızı ses hızının altında kalmak ZORUNDA olduğu için ikisi birbirini sınırlar — aracın boyutunu belirleyen denge budur. Ters dönme, kuyruk rotoru olmadan tepki torkunu sıfırlar. Güneş paneli en üstte, yoksa rotor gölgesinde kalır. |
| `buildProbe()` | Büyük çanak, RTG boomu, manyetometre boomu | Silueti üç kısıt belirler: alınan güç 1/r² düştüğü için çanak büyük; RTG'nin nötron/gama akısı aletleri kirlettiği için ayrı boomda; manyetometre aracın KENDİ alanından kaçmak zorunda olduğu için en uzun eleman odur. |

`buildMarsHelicopter` → `userData.rotors` (iki rotor, sahne ters yönde
döndürebilsin diye). Her yeni blok `userData.notes = { regime, why }` taşır.

### Vitrin sayfasında bulunan hata

Sıra yerleşimi `(i − 2) * ARALIK` diye SABİT yazılmıştı — beş araç varken
doğruydu, onuncu blok eklenince sıra kadrajın dışına taştı. Artık araç
sayısından türetiliyor (`KX(i)`), genel bakış mesafesi de sıranın yarı
genişliğinden hesaplanıyor. Bu hesapta ikinci bir hata daha çıktı: yatay
yarı görüş açısı **tan(vfov/2)·en-boy**'dur, `tan(vfov/2 · en-boy)` değil.
