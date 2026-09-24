# exploded_view — Patlatılmış Görünüm Sistemi · Mühendislik Planı

> Durum: TASARIM. 25 Eylül 2026'da depodan doğrulandı. `scene-blocks.md`
> (donmuş kurucu API'si, eksen kuralı, `userData` sözleşmeleri) ve
> `webgl-scene-contract.md` §2 (süreklilik), §6 (determinizm) bağlayıcıdır.
>
> Kardeş planlar: [physical-rigs-plan.md](physical-rigs-plan.md) (parça
> sözleşmesi ve eklem haritası — patlatma onun üstüne oturur),
> [habitat-blocks-plan.md](habitat-blocks-plan.md) (`ports`/`footprint`
> alanları buradaki arayüz kaydının özel hâlidir),
> [light-physics-plan.md](light-physics-plan.md) (kesit ve çağrı
> kutularında okunurluk için ışık dili).

---

## 0. Talep ve boşluklar

Talep: *"Exploded view ile alakalı çok detaylı bir plan çıkar, uygula ve
sonuçta BİRÇOK CİSME uygulayabileceğim bir şey olsun."*

Bugün depoda patlatma iki yerde var ve ikisi de **tek kullanımlık**:

| Nerede | Ne yapıyor | Neden yetmiyor |
|---|---|---|
| `mechanism_lab/index.html` `patlamaHazirla/patlamaUygula` | Parçaları kapsam grubunun MERKEZİNDEN dışa iter; yön parçanın merkeze göre konumundan gelir | Montaj bilgisi yok: neyin neye bağlandığını bilmez. Bir mekanizmanın hareketini göstermek için doğru, bir aracın NASIL KURULDUĞUNU göstermek için yanlış. Sayfaya gömülü, tekrar kullanılamaz |
| `satellite_integration/sat-parts.mjs` + sayfası | Montaj ağacı, arayüz, adım, kütle — hepsi doğru | Yalnız O uyduya ait. Kataloğu da patlatma mantığı da tek cisme bağlı; gezgine, roketе, habitata uygulanamaz |
| `craft_blocks` `userData.parts` | Parça ADLARI var | Kim kime bağlı, hangi sırada takılır, hangi arayüz — yok |

Boşluk tek cümleyle: **patlatma bir ÇİZİM EFEKTİ olarak yazılmış, bir
MONTAJ MODELİ olarak değil.** Bu plan onu modele çevirir ve modeli
cisimden bağımsızlaştırır.

| Talebin söylemediği | Nerede kapanıyor |
|---|---|
| "Birçok cisim" demek, her cismin kendi kataloğunu yazması demek değildir; ortak bir SÖZLEŞME ve cisim başına ince bir ADAPTÖR gerekir | §3 sözleşme, §9 adaptörler |
| Patlatma yönü "dışa doğru" değildir; montajın TERSİDİR ve parçanın bağlandığı yüzeyin normalinden gelir | §4.1 |
| Parçalar üst üste binerse patlatma okunmaz; aralık çakışma çözülerek verilmeli | §4.3 |
| Etiket olmadan patlatma yalnız bir dağılmadır; etiket seçimi bir BİLGİ kuralıdır | §5 |
| Bir alt grubu incelemek için tüm cismi patlatmak gerekmez: çağrı kutusu (callout) ve kesit | §6 |
| Sıra göstermek animasyon değil, DURUM makinesidir: her adım bir öncekinin erişimini kapatır | §7 |
| Patlatma bir iddia üretir: kütle toplamı, kütle merkezi, arayüz sayımı — hepsi sınanabilir | §8, §10 |

## 1. Bugün ne var (kaynağından okundu, 25 Eylül 2026)

| Yer | İlgili çıktı |
|---|---|
| `presets/craft_blocks/craft-blocks.mjs` (1697+ satır) | `buildCraft(kind)`, `userData = { preset, kind, parts, designSize }`, `userData.rig.joints` (ad, eksen, sınır, hız, `found`), `userData.notes {regime, why}`, `finalize()` ölçek normalizasyonu |
| `presets/physical_rigs/mechanism-index.mjs` | 16 mekanizma, `kapsam` (hangi düğümler), `odak`; DOF rig haritasından türetilir |
| `presets/satellite_integration/sat-parts.mjs` | 33 parça, `mountsTo`, `arayuz`, `step`, `massKg`, `pos`, `size`, `why`; `massBudget`, `centerOfMass`, `mountChain`, `depth`, `integrationOrder` |
| `presets/core/geometry-axis.mjs` | `eksenX/Y/Z`, `cylGeoX/Y`, `coneGeoX/Z`, `latheX/Z` — eksen ratchet'i çıplak kurucuyu yasaklar |
| `presets/core/life-signs.mjs` | `saccadeSettle` kapalı form kritik sönüm — patlatma geçişi de bunu kullanır (aşımsız, kadanstan bağımsız) |
| `scripts/eksen-denetimi.py`, `validate-rigs.mjs`, `validate-satellite.mjs` | Denetim deseni: iddia → ölçüm → çıkış kodu |

## 2. Mimari

```
presets/core/assembly.mjs         # SAF: montaj grafiği, patlatma çözücüsü, sıra, bütçe, arayüz sayımı
presets/core/exploded-view.mjs    # three bağlayıcı: patlatmayı uygular, etiket/kılavuz/çağrı kutusu, kesit
presets/exploded_view/
├── adapters/craft.mjs            # craft_blocks araçları → montaj grafiği (rig + parts + heuristik)
├── adapters/catalog.mjs          # sat-parts benzeri BEYAN EDİLMİŞ kataloglar → grafik (uydu, habitat)
├── index.html                    # vitrin: cisim seçici (uydu, habitat, gezgin, iniş aracı, roket…)
└── motion-manifest.json
```

İki katman ayrımı sert: `assembly.mjs` üç.js görmez (Node'da sınanır),
`exploded-view.mjs` yalnız onu uygular. Böylece patlatma mantığı
ekran görüntüsü olmadan doğrulanabilir.

## 3. Sözleşme: montaj beyanı (`userData.assembly`)

Bir cisim patlatılabilir olmak için şunu beyan eder:

```js
root.userData.assembly = {
  units: 'design'|'m',           // ölçek; 'design' ise finalize ölçeği uygulanır
  axis: [0,0,1],                 // birincil montaj/fırlatma ekseni
  parts: [{
    id, ad,                      // kimlik ve okunur ad
    node,                        // THREE.Object3D (ya da adapter'ın bulacağı ad)
    parent,                      // bağlandığı parçanın id'si (kök: null)
    iface,                       // 'civata'|'kizak'|'ayirma'|'akiskan'|'isil'|'elektrik'|'mentese'|'kaynak'
    step,                        // montaj adımı (1..N)
    group,                       // alt sistem/aile kimliği (renk ve süzgeç)
    massKg,                      // kütle (adet başına)
    qty,                         // adet (varsayılan 1)
    pos, size,                   // merkez ve kaba gabari (üç.js yoksa da hesap yapılabilsin)
    dir,                         // AYRILMA doğrultusu (verilmezse §4.1 türetir)
    why,                         // NEDEN var — zorunlu, boş geçilemez
    ports,                       // [{ad, pos, dir, tur}] arayüz noktaları (habitat `ports` ile aynı)
    tech,                        // { malzeme, guc_W, veri_Mbps, sicaklik_C:[min,max], parcaNo }
  }],
  steps: [{ no, ad, aciklama }],
};
```

Zorunlu alanlar: `id`, `parent`, `iface`, `step`, `why`. Geri kalanı
adaptör doldurabilir. **`why` zorunludur**: gerekçesiz parça, planın
tamamının reddettiği şeydir.

## 4. Patlatma çözücüsü (`assembly.mjs`)

### 4.1 Yön: montajın tersi
Bir parçanın ayrılma doğrultusu şu sırayla belirlenir:
1. `part.dir` beyan edilmişse o.
2. Parçayı ebeveynine bağlayan arayüzün normali (`ports` varsa).
3. Parçanın merkezinin EBEVEYNİNİN merkezine göre konumu (normalize).
4. İkisi çakışıksa (iç içe parça: tank ↔ tüp) birincil eksen (`axis`).

Bu sıra `mechanism_lab`'in "merkezden dışa" kuralını genelleştirir ve
düzeltir: referans artık kapsamın merkezi değil, **ebeveyn**.

### 4.2 Mesafe: derinlik kademesi
`d(part) = taban + derinlik(part) · kademe`, `derinlik` montaj ağacındaki
seviye. Böylece kök yerinde durur, yapraklar en uzağa gider ve montaj
hiyerarşisi görüntüden okunur. Kademe cismin gabarisine göre
normalize edilir (`bbox.length()`), yani 1 m'lik uyduyla 12 m'lik
habitat aynı `k` değerinde aynı görünür.

### 4.3 Çakışma: eksen kovaları
Aynı doğrultuda ayrılan parçalar üst üste biner. Çözüm: yön vektörü 26
yöne (3×3×3 − 1) kovalanır; aynı kovadaki parçalar mesafeye göre
sıralanır ve aralarında en az `maxGabari · 1,15` boşluk bırakılacak
şekilde ötelenir. Deterministik, sıralama kimliğe göre kararlı.

### 4.4 Geçiş: aşımsız
`k` değişimi `life-signs.saccadeSettle`'ın kapalı formuyla sürülür:
kritik sönüm, aşım yok, kadanstan bağımsız. Sıçrama yok (sözleşme §2).

### 4.5 Kipler
| Kip | Ne yapar | Ne zaman |
|---|---|---|
| `assembly` | §4.1–4.3 (varsayılan) | "Nasıl kurulur" |
| `axial` | Herkes birincil eksende, adım sırasına göre dizilir | Fırlatma yığını, kademe ayrımı |
| `radial` | Merkezden dışa (mechanism_lab uyumu) | Mekanizma incelemesi |
| `layered` | Alt sisteme göre katmanlar | "Hangi sistem nerede" |

## 5. Etiket katmanı

- **Seçim kuralı** (bilgi kuralı, süs değil): adım kipindeyken YALNIZ o
  adımın parçaları; tam görünümde kütle/gabari eşiğinin üstündekiler;
  seçili parça her zaman. (satellite_integration'da ölçüldü: 43 etiketin
  hepsi basılınca hiçbiri okunmuyor.)
- **Çakışma çözümü**: ekran uzayında dikey itme (site_plan'daki yöntem),
  sonra kılavuz çizgisi parçadan etikete.
- **İçerik**: ad + (isteğe bağlı) kütle/arayüz rozetleri. Seçilince künye
  panelde açılır: neden var, neye bağlanır, hangi arayüz, zincir, teknik.

## 6. Çağrı kutusu ve kesit

- **Çağrı kutusu (callout)**: bir alt grubu seçip yalnız onu patlatmak;
  gerisi sönük kalır. `assembly.subtree(id)` saf tarafta hesaplanır.
- **Kesit (section)**: bir düzlemle kesme — `clippingPlanes` ile gövdeyi
  açıp iç parçaları göstermek (tank tüpün içinde). Kesit düzlemi birincil
  eksene dik ya da paralel, sürgüyle.

## 7. Montaj sırası oynatımı

Durum makinesi: `step ∈ 1..N`. `step ≤ n` görünür, `step = n` vurgulu,
`step > n` gizli. Geçişte yeni parçalar KENDİ ayrılma doğrultusundan
gelir (patlatma k'sı 1 → 0). Oynatım duraklatılabilir, adım seçilebilir,
`?adim=` ile dondurulur.

## 8. Bütçeler ve sayımlar (patlatmanın ürettiği İDDİALAR)

- Kütle bütçesi: alt sistem payları, kuru/ıslak ayrımı.
- Kütle merkezi: birincil eksene göre yanal sapma.
- Arayüz sayımı: kaç cıvatalı, kaç ısıl, kaç akışkan arayüz — montaj
  karmaşıklığının okunur ölçüsü.
- Parça sayısı ve ağaç derinliği.
- Adım başına kütle ve parça (AIT planlaması).

## 9. Adaptörler

- **`adapters/catalog.mjs`**: `sat-parts.mjs` biçimindeki BEYAN EDİLMİŞ
  katalogları doğrudan sözleşmeye çevirir (uydu, habitat).
- **`adapters/craft.mjs`**: `craft_blocks` araçları için. `userData.rig.joints`
  bir eklem ağacı verir; eklem ağacı ile sahne grafiği birleştirilip
  montaj grafiği ÜRETİLİR: eklem düğümleri parça sınırı sayılır, geri
  kalan mesh'ler en yakın eklem düğümüne atanır. Kütle beyan edilmemişse
  gabari hacmiyle orantılı TAHMİN edilir ve bu **ilan edilir** (bütçe
  "tahmini" damgası taşır; uydurma kesin sayı yazılmaz).

## 10. Doğrulama (`scripts/validate-assembly.mjs`)

1. Sözleşme: zorunlu alanlar dolu; `why` boş değil; `iface` bilinen sınıf.
2. Ağaç: tek kök, döngü yok, her `parent` çözülüyor.
3. Sıra: hiçbir parça ebeveyninden önce takılmıyor; adımlar kesintisiz.
4. Patlatma: k=0'da her parça taban konumunda (±1e-9); k arttıkça parçalar
   arası en küçük mesafe MONOTON artar; çakışma kovası sonrası hiçbir
   parça çifti gabari toplamının %85'inden yakın değil.
5. Yön: her parçanın ayrılma doğrultusu birim; ebeveyniyle çakışık
   olanlarda birincil eksene düşülmüş.
6. Determinizm: aynı girdi → aynı çıktı; kadans bağımsız geçiş.
7. Bütçe: kütle toplamı, kütle merkezi, arayüz sayımı tutarlı.
8. Adaptör: craft aracı için üretilen grafik ağaç kurallarını geçiyor ve
   tahmini kütleler `tahmini: true` damgası taşıyor.

## 11. Fazlar

- **F0 — çekirdek**: `assembly.mjs` (grafik, yön, derinlik, kova, bütçe),
  `validate-assembly.mjs`. ~0,5 gün.
- **F1 — bağlayıcı ve vitrin**: `exploded-view.mjs` (uygulama, etiket,
  kılavuz, çağrı kutusu, kesit), `exploded_view/index.html` çok cisimli
  vitrin. ~1 gün.
- **F2 — adaptörler**: catalog + craft; uydu kataloğunun sözleşmeye
  taşınması; gezgin/iniş aracı/roket patlatması. ~1 gün.
- **F3 — teknik derinlik**: parça alt detayları (bağlantı elemanları,
  konnektörler, braketler, etiket plakaları), `tech` alanları, arayüz
  sayımı paneli. ~1 gün.

## 12. Açık kararlar

1. Kütle tahmini yapılan araçlarda bütçe gösterilsin mi? (Öneri: evet ama
   "TAHMİNİ" damgasıyla ve gerçek kütle beyan edilince damga düşsün.)
2. Kesit düzlemi tek mi, çift mi? (Öneri: tek — iki düzlem okunurluğu
   düşürüyor ve `clippingPlanes` maliyeti artıyor.)
3. Patlatma sırasında gölge açık kalsın mı? (Öneri: hayır; dağılmış
   parçaların gölgesi zemini okunmaz yapıyor.)
