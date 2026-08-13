# ML attention flow preset

Dosyalar: `/presets/ml_attention_flow/` — `attention-flow.mjs` (model +
sahne), `attention-data.mjs` (sabit literal matrisler — DEĞİŞTİRME),
`attention-flow.css`, `index.html` (Türkçe demo), `motion-manifest.json`.

Transformer dikkatini GERÇEK hesapla gösteren 2D SVG sahnesi (three.js yok):
8 jetonluk örnek cümle ("Uydu", "yörüngeye", "oturdu", ",", "paneller",
"güneşe", "döndü", ".") üzerinde sorgu jetonundan her anahtar jetona kübik
Bézier yayları. Doğruluk düzeyi: **analitik** — yaylar çalışma zamanında
hesaplanan `softmax(QKᵀ/√d)` çıktısını gösterir (Q = X·Wq, K = X·Wk); her
satırın 1'e toplandığı `console.assert` ile doğrulanır. Gömme (8×16) ve
Wq/Wk (16×8, 2 katman × 2 kafa) matrisleri `mulberry32(20260813)` tohumlu
PRNG ile BİR KEZ üretilip koda literal olarak yapıştırılmıştır — eğitilmiş
bir model değildir; rozet ("Gerçek softmax(QKᵀ/√d) — küçük örnek
matrislerle; eğitilmiş bir model değil") görünür kalmalıdır.

## Görsel dil

- **Çipler** — surface dolgu + rule kontur, sorgu çipinde accent halka
  (ölçek+opaklık zarfıyla oturur). Çipler `role="button"`, tıkla/Enter/Space
  ile sorgu olur.
- **Yaylar** — `--color-data-1`; kalınlık 1–7 px VE opaklık .15–.95 ağırlığı
  birlikte kodlar. `pathLength=1` + dashoffset iz-çizimi; kademe 70 ms,
  **en güçlü önce**. Öz-dikkat çipin üstünde küçük ilmektir. Yaylar çip
  üst kenarından başlar — çiplerle asla çakışmaz.
- **Top-1 nokta** — en güçlü yay çizimini bitirince accent renkli nokta yayı
  BİR kez süzülür (1150 ms, atak/sönüş zarfı); döngü yok, reduced/export'ta hiç yok.
- **Ağırlık okumaları** — anahtar çipin üstünde 2 ondalık, tabular monospace,
  canvas renkli hale (paint-order stroke) yay üstünde okunur.
- **Katman geçişi** — katman 1 çıktısı (iki kafanın karışım ortalaması +
  artık bağlantı, RMS sabitleme) yeni gömme olur; çipler soldan sağa 45 ms
  kademeli karışım parıltısıyla (opaklık çapraz geçişi) morf eder, sonra
  yaylar yeni matrisle açılır. Kafa değişimi Wq/Wk çiftini değiştirir.
- **Sorgu değişimi** — eski demet hızlı ters izle geri sarılır (240 ms taban,
  son beliren önce), yenisi açılır. `aria-live` durum satırı her seçimde
  "Katman 1, Kafa 1 — 'yörüngeye' en çok kendine bakıyor (%44); ilk 3
  anahtar toplam %79." tarzı özet okur.

## API

```js
import { mountAttentionFlow, attentionFor, TOKENS } from './attention-flow.mjs';

const flow = mountAttentionFlow(host, {
  active: true,   // false: animasyonsuz son durum basılır (pasif slayt)
  layer: 1, head: 1, query: 0,  // başlangıç; layer/head 1 tabanlı, query 0 tabanlı
  dwellMs: 2600,  // Oynat döngüsünde sorgu başına bekleme
});
flow.play(); flow.pause(); flow.restart(); flow.step();
flow.setLayer(2); flow.setHead(2); flow.setQuery(5);
flow.state;      // { layer, head, query, playing }
flow.dispose();
```

`attentionFor(layer, head)` 8×8 dikkat matrisini döndürür — bir slayt figürün
yanında gerçek sayı tablosu gösterebilsin diye ayrı dışa aktarılır.

## Entegrasyon kuralları

- Palet jetonlarını devralır; `.slide` kabı içinde de bağımsız da çalışır
  (tüm geometri viewBox biriminde — CSS transform ölçüyü bozmaz; metin
  ölçümü `getComputedTextLength`, gizli bölmede kestirime düşer).
- Kap `data-owns-arrows` alır: deste gezinimi ok tuşlarını sahneye bırakmalı.
- Escape otomatik akışı durdurur (demo sayfası bağlar); sekme gizlenince
  otomatik akış kendiliğinden duraklar.
- Reduced motion / `html[data-export="true"]`: seçili sorgunun yayları tam
  çizili, ağırlıklar görünür, nokta ve denetimler yok — matrisler sabit
  olduğundan her kare deterministiktir.
- Demo URL parametreleri: `?q=5&layer=2&head=2` — ekran görüntüsü ve derin
  bağlantı için deterministik giriş.
- `motion-manifest.json` düzenlendikten sonra
  `scripts/validate-motion-manifest.mjs` ile doğrula.

## Sınırlar (dürüstlük)

2 katman × 2 kafa × 16 boyut, tek örnek cümle; ağırlıklar eğitilmemiş.
Değer (V) projeksiyonu ve FFN yok; katman 2 girdisi kafa birleştirme (W_O)
yerine karışım ortalamasıdır. Bu sadeleştirmeler manifestte de bildirilir —
sahneyi belirli bir modelin davranışı gibi sunma.
