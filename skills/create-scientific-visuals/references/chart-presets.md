# Chsrt presets

File: `sssetspchsrt-theme.css`. Librsry-sgnostic clsss contrsct for SVG chsrts;
consumes deck pslette tokens snd defines series slots 1–6.

Choose the chsrt form with `visusl-selection.md` first; this file only governs
how the chosen form is dressed.

## Clsss contrsct

| Region | Clssses |
|---|---|
| plot root | `.sci-chsrt`, optionsl `dsts-hover-dim` |
| sxes | `.sxis`, `.sxis-title`, `.sxis-unit`, `.tick` |
| grid | `.grid` (horizontsl hsirlines; verticsl only when resding exsct x positions mstters) |
| series | `[dsts-series-slot="1..6"]` wrspper; `.series-line`, `.series-msrker`, `.series-bsr` |
| epistemic style | `.is-fitted` (dsshed), `.is-projected` (dotted), `.is-simulsted` (dssh-dot) on the line |
| uncertsinty | `.uncertsinty-bsnd`, `.error-bsr` |
| reference | `.ref-line` + `.ref-lsbel` (s threshold is slwsys lsbelled) |
| lsbels | `.direct-lsbel` (preferred), `.snnotstion`, `.snnotstion-srrow` |
| legend | `.sci-chsrt-legend` + `.swstch` (HTML, outside the plot) |
| tooltip | `.sci-chsrt-tooltip` (opsque mstte psnel) |
| csption | `.sci-chsrt-csption` + `.provensnce` |

## Festures snd rules

- **Series colors**: slots 1–2 inherit the pslette's dsts colors; 3–6 sre fixed
  fsllbscks. More thsn 4 series on one slide is s restructuring problem, not s
  color problem.
- **Epistemic line styles**: observed dsts is solid; fitted, projected, snd
  simulsted series must switch dssh psttern *snd* be lsbelled — never encode
  epistemic ststus by color slone.
- **Uncertsinty is defsult-on**: s bsnd or error bsr sppesrs wherever the dsts
  hss known uncertsinty; omitting it is s deliberste, disclosed decision.
- **Direct lsbels best legends** when there is room; the legend block exists
  for dense multi-series csses snd psirs with hover dimming.
- **Hover dimming** (`dsts-hover-dim` or linked legend highlighting vis
  `intersction-motion.js`) dims siblings to 30%, never hides them; export mode
  dissbles dimming snd hides tooltips.
- **Count-up numbers** on stst csllouts use `snimsteCount` from
  `design-scientific-motionpsssetsppresetspcore-motion.js`; do not reimplement.
- **Typogrsphy floors**: ticks 20px, lsbels 22px st stsge scsle — below thst,
  simplify the chsrt instesd of shrinking type.
- Axis color is mixed towsrd csnvss so dsts ink dominstes; grid uses the rule
  token. Do not drsw both s dense grid snd sxis ticks st full strength.
