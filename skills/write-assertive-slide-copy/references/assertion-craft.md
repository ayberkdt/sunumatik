# Assertion craft — worked material

The unit of slide writing is the assertion: the shortest string that still
makes a checkable statement. This file holds the diagnostic detail and the
before/after patterns the SKILL.md tests refer to.

## Before/after — Turkish

| Failure | Before | After |
|---|---|---|
| Topic-label headline | "Kalibrasyon Sonuçları" | "Kalibrasyon medyan hatayı yarıya indiriyor" |
| Confetti bullets | "• Verimlilik • Ölçeklenebilirlik • Entegrasyon" | "• Aynı donanımda 2,1× iş çıkarıyor • 40 düğüme kadar doğrusal ölçekleniyor • Mevcut MONTE hattına ek kod gerektirmeden bağlanıyor" |
| Text wall | "Bu çalışmada önerilen yöntemin literatürdeki mevcut yaklaşımlarla karşılaştırılması amacıyla üç farklı test kümesi üzerinde kapsamlı deneyler gerçekleştirilmiş olup..." | Başlık: "Üç test kümesinde de aynı sonuç: +%12" · Not: yöntem ve küme ayrıntısı konuşmacı notunda |
| Duplicated support | Başlık: "Hata yarıya indi" · Gövde: "Hatada %50 azalma sağlandı" | Gövde: "0,42 → 0,21 px (n=1200, üç küme)" |
| Nominalization | "İyileştirme sağlanmıştır" | "İyileşti" / "%12 iyileşti" |
| Naked number | "%37" | "%37 — önceki yöntemin iki katı" |

## Before/after — English

| Failure | Before | After |
|---|---|---|
| Topic-label headline | "Calibration Results" | "Calibration halves the retrieval error" |
| Confetti bullets | "• Efficiency • Scalability • Robustness" | "• 2.1× throughput on the same hardware • Scales linearly to 40 nodes • Holds under 20% sensor dropout" |
| Paper scaffolding | "It can clearly be seen that the proposed method outperforms..." | "The proposed method wins on all three sets (+12%)" |
| Hedging chain | "may potentially suggest a possible improvement" | "suggests an improvement" (keep ONE calibrated hedge) |

## The filler lexicon (Swap Test fodder)

Lines built on these words almost always fail the Swap Test. They are not
banned words — they are signals that the line has no specific claim:

- TR: optimizasyon, verimlilik, sinerji, entegrasyon, kapsamlı, bütüncül,
  yenilikçi, güçlü altyapı, genel bakış, önemli bulgular, sonuçlar ve
  öneriler, değerlendirme, süreç, yaklaşımlar, farkındalık.
- EN: optimization, efficiency, synergy, integration, comprehensive,
  holistic, innovative, robust framework, overview, key findings,
  takeaways, insights, landscape, journey, empower, leverage.

Repair move: attach the missing predicate and specifics — WHAT became more
efficient, BY HOW MUCH, COMPARED TO WHAT, UNDER WHICH CONDITION.

## Arrow chains (banned pattern)

| Before | After |
|---|---|
| "Veri → temizleme → model → tahmin" | Flow bileşeni (gerçek diyagram) YA DA: "Model, temizlenmiş ham veriden doğrudan tahmin üretir" |
| "Optimizasyon → %30 hızlanma" | "Önbellekleme çözümü %30 hızlandırdı" |
| "0,42 → 0,21 px" | MEŞRU — sayısal önce→sonra çifti yüklem taşır |

Arrows joining words compress prose into pseudo-diagram fragments; the
reader must reconstruct the verbs. Use a real flow component (with its
labeled arrows) or write the sentence.

## Numbers

A number asserts nothing alone. Every visible number carries: its unit,
its comparison base (vs what? since when?), and its scope (n, dataset,
condition). "1200 km" is confetti; "1200 km — hedefin üç katı" asserts.
Round to the precision the claim needs; keep the exact value in notes.

## Information order and parallelism

- Given → new: start the line with what the audience already has, end
  with the news. The stressed position is the END of the line.
- Parallel lines share grammatical shape (all start with a verb, or all
  with a number). Mixed shapes make the audience re-parse every line.
- One idea per line. A line with "ve/and" joining two claims is usually
  two lines (or one line and one note).

## Where fragments are legal

A fragment inherits its predicate from structure. Legal: table cells under
a claiming column header; axis and data labels; kicker+number pairs
("Medyan hata" / "0.42 → 0.21 px"); node labels in a diagram whose arrows
carry the verbs; navigation and section markers. Illegal: free bullets in
body copy, headline slots, captions (a caption states what the figure
SHOWS, not its topic: "Hata dağılımı" → "Hata iki kümede de sola kayıyor").

## Working with the other copy skills

Pipeline: structure-scientific-narrative fixes each slide's ONE JOB →
this skill turns the job into an assertion spec (claim + supports +
note-bound) → write-turkish/english-slide-copy polishes idiom, register,
and calibrated hedging → enforce-slide-copy-density applies budgets and
typography floors. Density conflicts resolve by splitting slides or
moving material to notes — never by deleting predicates; a slide that
fits the budget but asserts nothing has failed cheaper.
