# Three-Body States — Üç-Cisim Durumları (`/presets/three_body_states/`)

Siyah zeminde 5×4 pano; her panoda düzlemsel üç-cisim probleminin bir
periyodik çözümü canlı entegre edilir. Cisimler turuncu · krem · mavi ışıyan
noktalar, arkalarında sönen kuyruklu iz, altta tam periyodun soluk yolu.
Pisagor (Burrau) problemi kaotik karşıtlık olarak yer alır ve kaçışta
baştan başlar.

## Mount

```js
import { mountThreeBody } from './three-body.mjs';
const tb = await mountThreeBody(host, { t: undefined, speed: .8, labels: false, autoplay: true });
tb.timeline.scrub(12);      // t = 12 birim: her pano baştan yeniden entegre edilir (deterministik)
tb.labels = true;           // pano adları
tb.catalog;                 // CATALOG: { id, name, note, T, masses, src, state(), chaotic? }
tb.panels();                // [{ id, t, minDist }]
```

Saf (`three-body-model.mjs`): `CATALOG`, `accel`, `advance(state, m, dt, {hMax, k})`,
`energy`, `angularMomentum`, `minDistance`, `sampleOrbit(entry, {n})` →
`{ pts, returnError, energyDrift, momentumDrift, bbox }`.

## Sinema ve ekran koruyucu

`tb.cinema(true, i)` tek çözümü kadraja büyütür (pano ızgaradan 0,9 s morf ile
büyür, iz yeniden birikir; vuruş ve hale kadrajla ölçeklenir, iz ömrü 1,7×);
alt yazı ad · kaynak · T · kütleler, sağ üstte sıra. `dwell` saniyesinde bir
sonraki çözüme 0,55 s sönme + 0,8 s açılma ile geçer; `next()/prev()`, tuşlar
← → C Esc. Ekran koruyucu: `index.html?sinema=1&tam=1&sure=30` — alt bilgi
gizli, imleç 2 s'de gizlenir, ilk tıklama tam ekrana alır (tarayıcı jesti).

## URL

`?t=<birim>&speed=<birim/s>&labels=1&sinema=1&secim=<0–19>&sure=<s>&tam=1&export=1`

## Model ve dürüstlük

- G = 1, nokta kütleler, düzlemsel. Başlangıç koşulları literatürden:
  Šuvakov & Dmitrašinović 2013 (eşit kütle aileleri; r = (−1,0),(1,0),(0,0),
  v = (ẋ,ẏ),(ẋ,ẏ),(−2ẋ,−2ẏ)), Lagrange 1772 (ω² = 3G/d³, eşit kütle; genel
  kütle için ω² = GM/d³), Euler 1767 (ω² = 5G/(4a³)), Broucke 1975 (A2),
  Burrau 1913 (kütle 3·4·5, hızsız başlangıç).
- Periyodiklik iddiası DENETLENİR: `validate-astro` her çözümü bir periyot
  yayar ve başlangıca dönüşü ölçer (≤ 2e-3, yin-yang II ≤ 5e-2), enerji ve
  açısal momentum korunumunu kontrol eder. Butterfly IV bu denetimi
  geçmediği için katalogda değildir.
- İntegratör RK4 uyarlanır adım: h = min(h_max, k·d_min^1.5).

## Renk ve solma (GIF kalibrasyonu)

Kaynak GIF'in kareleri ölçüldü (ton kümeleri): kızıl-turuncu ton 0,047, sıcak
krem/ten ton 0,10 düşük doygunluk, lavanta-periwinkle ton 0,68. Cisim renkleri
`BODY_COLORS = ['#ff6226', '#f4dcb4', '#7f8cff']`, baş çekirdekleri cisme göre
sıcak-beyaz `HOT_COLORS` (sarı-beyaz, krem-beyaz, buz-beyaz; τ_h = 0,07 τ —
yalnız başta beyaz, kuyruk doygun renk, uç koyu). Toplam parlaklık GIF'in
piksel dağılımına göre ayarlandı (>150 parlaklık ~%1 kare payı): keskin gövde
0,62 + dar ışıma 0,5 + geniş ışıma 0,42 toplamsal; beyaza kırpma yok. İz ömrü
τ = clamp(0,45 T, 3, 14): yörüngenin büyük kısmı görünür kalır ve e^(−yaş/τ)
ile yumuşakça söner.

## Sınırlar

Panolar bağımsız ölçeklenir (uzunluklar karşılaştırılamaz); iz süresi
gösterim parametresi; Pisagor döngüsü fiziksel değildir; birimsiz sistem.

## Hareket

İz YAŞA BAĞLI solar ve sabit SANİYE sürer (`tail`, varsayılan 5,5 s gerçek
zaman; pano zamanında tail·speed·k, sinemada 1,35×): en eski uç ilk andan
itibaren silinir, büyüme ile silinme dengelenince uzunluk kararlı kalır — GIF
davranışı. Her karede iz geçmiş tamponunun TÜM alt adım noktalarıyla (yakın geçişlerdeki
hızlı dönüşler kırılmaz), yaşa göre 16 kovaya bölünerek en eskiden başa doğru
OPAK, sönükleştirilmiş renkle çizilir
(w = (1 − yaş/T)^0,6 — uzun süre parlak, sonda belirgin biter; baş %7'de cisme özgü sıcak-beyaza karışır; kova başına tek yol, 960 vuruş). Opak vuruşlar üst üste bindiğinde boncuk bırakmaz;
ışıma (bloom) birleştirmede iki bulanık kopya + keskin gövde olarak toplamsal
biner. Hayalet iz kalmaz (kalıcı tuvalin 8-bit alfa takılması yok).

Giriş: panolar sırayla belirir (1,2 s). Sonra sürekli entegrasyon: hız
`speed` birim/s (varsayılan 0,8 → figure-8 periyodu ≈ 8 s, bumblebee ≈ 80 s).
Izler toplamsal karışımla çizilir (ışık kaynağı), dekor ışıması yok.
Statik/azaltılmış hareket: t = 6 tablosu.
