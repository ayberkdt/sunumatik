# Table motion presets

Files: `/presets/motion_core/table-motion.css` + `/presets/motion_core/table-motion.js`.
Style comes from design-space-science-deck's `table-presets.css`; this
preset adds MOTION only. Demos:
`design-space-science-deck/presets/color_themes/components/component-preview.html`
(row cascade / flash / emphasis) and
`/presets/motion_core/table-motion-preview.html` (tüm yetenek vitrini; her
bölümde Tekrar düğmesi; `?demo=<ad>&t=0..1` sabit-zaman senkron kare —
headless doğrulama için, gizli sekmede rAF donsa bile deterministik).

## Tek çağrılık kurulum — `initTableMotion(scope?)`

Deste yazarı için tek satır: bar + heat + spark dolgularını kurar,
reveal/enter gözlemcisini açar, sayaçları başlatır, `data-duel` ve
`data-total-of` tablolarını görünürlükte (giriş bittikten sonra)
tetikler. Tüm yetenekler data-özniteliğiyle bildirilir:

| Öznitelik | Nerede | Ne yapar |
| --- | --- | --- |
| `data-table-reveal` / `="columns"` | table | satır / sütun kaskadı girişi |
| `data-table-enter="cascade\|wipe\|rows"` | table | yönetmenli giriş (başlık çizgisi → gövde) |
| `data-count` / `data-count="odometer"` | td | 0→değer sayacı / rakam silindirleri |
| `data-bar="0..1"` (+`data-bar-slot`) | td | metin altı oran çubuğu |
| `data-heat="0..1"` | td | rampa arka planı |
| `data-spark="3,5,4,8"` (+`data-spark-slot`) | td/span | kendini çizen mini çizgi |
| `data-total-of="sütun"` | tfoot td | akış izi + odometre dolumu |
| `data-duel="colA,colB"` | table | ikili sütun düellosu + fark çipi |
| `data-not="..."` | tr | spotlight adımının iddia notu |
| `data-sort` | td | tabloSirala için açık sıralama değeri |

Sütun anahtarı (`data-total-of`, `data-duel`) sayı (0 tabanlı indeks) ya
da başlık metni olabilir. Hepsi `prefers-reduced-motion` ve
`html[data-export="true"]` altında SON DURUMU basar (dolu sayılar,
çizili sparkline, görünür çipler); `?export=1` sorgusu JS tarafından
`data-export` özniteliğine damgalanır, CSS de aynı yolu izler.

## Row cascade (entrance)

Mark the table `data-table-reveal` and call `observeTableReveal()` once
per page: rows rise+fade with a 70 ms stagger when the table scrolls
into view. Gated on `html.js`; reduced-motion and export render final
state; a 6 s watchdog reveals everything if IntersectionObserver never
fires (hidden panes).

The cascade is an ENTRANCE, not a data statement — appearance order is
document order. If order should carry meaning (ranking build-up), order
the rows in the DOM and say so in the talk.

## Row flash (attention)

`flashRow(tr)` — one-shot background sweep + accent left edge for
"this row just changed / look here" moments driven by the presenter.
One row at a time; flashing rows on a timer is decorative noise.

## Column emphasis (hover)

`enableColumnEmphasis(table)` — hovering a header dims the other
columns to 45% (recede, never hide — same language as legend-linked
chart dimming in interaction-presets). Comparison tables benefit;
data tables with units columns usually do not need it.

## Column cascade (entrance, column mode)

`data-table-reveal="columns"` is the column mirror of the row cascade:
every cell (headers included) enters with opacity + translateX(-8px)→0,
delayed by its column index × 90 ms via `--col-index`. Same
IntersectionObserver + 6 s watchdog + `html.js` gating as row mode;
default (`data-table-reveal` with no value or `"rows"`) stays row mode.
`columnCascade(table)` is the imperative form: it stamps the attribute
and observes that one table.

## Yönetmenli giriş — `data-table-enter="cascade|wipe|rows"`

TEK zaman çizgisi: başlık hücreleri iner (sütun×50 ms), başlık altı
vurgu çizgisi soldan sağa çizilir (200 ms + sütun×70 ms,
`background-size` ile — `background-clip: padding-box` sayesinde rule
çizgisinin hemen üstünde), gövde 550 ms'de akmaya başlar.
Üç gövde dili: `cascade` satır+hücre kademesi (satır×100 + sütun×50 ms),
`wipe` hücre başına soldan sağa `clip-path` süpürmesi (satır×120 +
sütun×60 ms), `rows` klasik satır kaskadı (satır×90 ms). tfoot gövdenin
devamı gibi indekslenir. Aynı IO + 6 sn bekçi + `html.js` kapısı.
Değersiz `data-table-enter` `cascade`'e normalize edilir.
`renderTableEnterAt(table, p)` aynı zaman çizgisinin p∈[0,1] anındaki
karesini senkron basar (headless QA); süreler CSS ile eştir — birini
değiştirirsen ikisini de değiştir.

## Odometre — `data-count="odometer"`

`countCells` aynı hücre sözleşmesiyle (son değer hücre metninde, Türkçe
biçim) rakamları gerçek silindirlere çevirir: her rakam 0–9+0 şeridi,
değer v(t) sürekli akar ve silindir konumu basamak değerinden türetilir
— ara kareler GERÇEK ara değerlerdir, rastgele takırdama yoktur.
Ayraç/önek/sonek (`.` `,` `%` `ms` boşluk dahil — `white-space: pre`)
sabit durur. Bitişte `.is-settle` tek mikro ölçek (%5, 280 ms) —
sürekli vurgu yok. Silindir yüksekliği: CSS `1.16em` = JS `ODO_H`.
Reduced/export: düz son metin. `opts.progress` tek kare basar.

## Toplam satırı akışı — `totalFlow(table)` / `data-total-of`

`<td data-total-of="1">4.302</td>` (tfoot): o sütunun gövde
hücrelerinden toplam hücresine parlak noktalar süzülür (150 ms arayla,
620 ms yol, hafif sola kavisli quadratic bézier); her varış toplam
hücresinde kısa şarj parlaması, ilk varışla toplam odometreye başlar ve
son varıştan az sonra oturur. Toplamın NEREDEN geldiğini gösteren TEK
SEFERLİK olaydır (`data-flow-done` bekçisi; `{repeat:true}` yeniden
oynatır). Noktalar tablo üstündeki `.sci-table-layer` katmanında yaşar
(ebeveyn gerekirse `position:relative` yapılır); eşzamanlı akışlar kendi
`data-flow-col` etiketli noktalarını temizler, birbirininkini silmez.
Dürüstlük: toplam metni yazarın verdiği değerdir — iz kaynak gösterir,
değer üretmez. `initTableMotion` görünürlükte, giriş bittikten sonra
otomatik tetikler. Reduced/export: düz son metin, iz yok.

## FLIP sıralama — `tabloSirala(table, colIdx, {yon})`

`yon: "azalan"` (varsayılan — "en iyiden en kötüye" ânı) | `"artan"`.
Değer önceliği: `data-sort` → `data-count-final` → hücre metni (Türkçe
sayı; ikisi de sayı değilse `localeCompare('tr')`). FLIP: first →
reorder → invert → play; satırlar yalnız `transform: translateY` ile
süzülür (layout thrash yok), süzülen satır `.is-flip` ile kendi zeminini
ve katmanını alır (uzun yol üstte), 30 ms satır kademesi. Bitişte
anahtar sütun hücreleri `.is-sort-key` tek seferlik parlar.
`--row-index` yeniden yazılır (kaskad gecikmeleri tutarlı kalır).
Reduced/export: anında yeniden sıralı, animasyonsuz.

## İkili sütun düellosu — `data-duel="colA,colB"` / `cellDuel(table)`

İki sütunun oran çubukları karşılıklı büyür: A sağdan sola (kenar çizgisi
solda), B soldan sağa — değer `data-bar` (0..1) ya da `%..` metninden.
Dürüstlük: iki çubuk AYNI piksel ölçeğindedir (dar hücrenin genişliği
baz alınır) — sütun genişlikleri farklıyken yüzde tabanı yanıltıcı
olurdu. Her satırda kazanan hücre TEK nabız atar (`.is-duel-win`, 1×)
ve fark çipi belirir: `+%12` = puan farkı (kazanan − kaybeden) × 100;
berabere (<0,5 puan) çipsiz. Çip mutlak konumludur (hücrenin boş
tarafında), düzeni itmez. Renkler: A → `--color-data-1`,
B → `--color-data-2`, hücre `data-bar-slot` ile ezilir. Normal
`cellBars` düello sütunlarını atlar. Tekrar çağrılabilir.

## Satır spotlight — `tabloAdimlari(table, adimlar)`

`adimlar`: satır indeksi ya da `{satir, not}` (not verilmezse
`tr[data-not]`). Denetleyici döner: `ileri() geri() git(n) sifirla()
indeks() uzunluk kapat()` — global keydown EKLENMEZ, tuşları deste
yazarı bağlar; her adımda tablodan `tabloadim` CustomEvent'i yayınlanır.
Adımda hedef satır hafif büyür-yaklaşır (scale 1.015, sol kenarda vurgu
çizgisi), diğerleri kısılır (opacity .3 + desatürasyon — kısılır, asla
gizlenmez). İddia notu katmanda satır hizasında belirir: tablonun
sağında yer varsa (>220 px) dışarıda, yoksa iç kenarda
(`width: max-content`, 240 px tavan). Reduced: ölçek yok, anında
dim/undim. Export: not çizilmez, satırlar normal.

## Mini-sparkline — `data-spark="3,5,4,8"` / `cellSparks(scope?)`

Hücre içinde 72×20 viewBox'lı satır içi SVG: çizgi kendini çizerek girer
(`stroke-dasharray/offset`, tablonun `.is-revealed` tetikleyicisine
bağlı, satır×70 ms + 250 ms gecikme), uçta minik nokta ~950 ms'de
belirir. `vertical-align: middle`, satır yüksekliğini bozmaz. Değerler
virgülle ayrılır (ondalık için nokta: `data-spark="3,5.5,4"`). Renk
`--color-data-2`; `data-spark-slot="1"` → `--color-data-1`. Min–max
normalize edilir — eğilim gösterir, ölçek göstermez; eksenli karşılaştırma
gerekiyorsa chart-preset kullan. Reduced/export: tam çizili + nokta.

## Cell count-up — `countCells(scope?, {duration=900, stagger=60})`

Markup: `<td data-count>1.248</td>` — the FINAL value lives in the cell
text (visible without JS). Turkish formats are parsed: `.` thousands,
`,` decimals; any prefix/suffix around the number (`%`, `ms`, `≈`) and
the decimal count are preserved (`%96,4` counts 0,0 → 96,4). Cells
count 0→value with easeOutCubic over ~900 ms, staggered by column
position × 60 ms. `tabular-nums` (in the CSS) keeps digits from
jittering. Idempotent: the original text is kept in `data-count-final`,
so re-running (presenter re-trigger) restarts from 0. Reduced motion /
export: final text set immediately.

Discipline: count-up is for TOTALS and results the presenter lands on —
one row or one column of outcomes — not every cell. A table that counts
everywhere reads as a slot machine.

## In-cell data bars — `cellBars(scope?)`

Markup: `<td data-bar="0.62">%62</td>` — value is the 0..1 share; the
readable number stays as cell text. The helper injects an absolutely
positioned layer UNDER the text (cell gets its own stacking context;
the bar sits at z-index −1, so text and padding are untouched):
left-aligned, 62% of cell height, width = share × 100%. Duotone
discipline: body at 16% opacity + a solid 2 px end edge in the full
color. Color defaults to accent; `data-bar-slot="2"` →
`--color-data-2`. On reveal bars grow scaleX 0→1 (600 ms,
transform-origin left, row-staggered by `--row-index` × 70 ms).
Reduced/export render full bars. Re-runnable: an existing bar is
updated, never duplicated.

Discipline: bars encode ONE column's share — never mix units in a
single bar column, and keep one color per column (`data-bar-slot` picks
the column's color, not per-row colors).

## Heat fill — `heatFill(scope?)`

Markup: `<td data-heat="0.72">0,72</td>` — 0..1 normalized. With an
extended palette the background interpolates along the 5-stop
`--ramp-seq-1..5` ramp (nearest stop pair, linear `color-mix` between
them, computed once from `getComputedStyle`). Without ramp vars the
fallback is accent at heat × .3 opacity. Backgrounds fade in over
500 ms with the row cascade (column slot in columns mode).
Reduced/export render final backgrounds.

Ink flip: at `heat > .55` the cell text is set to `var(--color-canvas)`
so ink stays readable on deep ramp fills (threshold lives in JS as
`.55` and is mirrored by `.sci-cell--heat-deep` in the CSS; the flip is
skipped in fallback mode, where fills never exceed 30% opacity).

Discipline: heat needs a legend or caption stating the scale ("0–1
normalized X, dark → light") — an unlabeled ramp is decoration, not
data.

```js
import { initTableMotion, tabloSirala, tabloAdimlari, totalFlow, cellDuel,
         flashRow, enableColumnEmphasis }
  from '.../presets/table-motion.js';

initTableMotion();   /* data-öznitelikli her şey: dolgular + giriş +
                        sayaçlar + düello + toplam akışı */

/* sunum ânları (deste yazarının tuşlarına/adımlarına bağlanır): */
tabloSirala(tablo, 2, { yon: 'azalan' });      /* "en iyiden en kötüye" */
const adim = tabloAdimlari(tablo, [0, 2, 3]);  /* adim.ileri() / geri() */
```

Eski tekil çağrılar (`cellBars` → `heatFill` → `observeTableReveal` →
`countCells`) aynen çalışır; sıra önemlidir — dolgular gözlemciden önce
kurulur ki geçişler aynı `.is-revealed` tetikleyicisine binsin.
`data-table-reveal`/`data-table-enter` taşımayan tablolarda dolgular bir
sonraki karede kendiliğinden kurulur. `countCells` `data-total-of`
hücrelerini atlar (onlar totalFlow'undur). Tüm zaman çizgisi alan
API'ler `opts.progress ∈ [0,1]` ile senkron tek kare basabilir
(headless/QA).

For count-ups OUTSIDE tables (hero stats, KPI callouts) keep using
`animateCount` from core-motion.js; `countCells` exists for the
cell markup contract and Turkish number formats.
