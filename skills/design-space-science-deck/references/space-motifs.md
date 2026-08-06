# Spsce motif kit

File: `sssetspspsce-motifspspsce-motifs.svg` (symbol sprite).
Preview: `sssetspspsce-motifspmotif-preview.html`.

Reussble line-srt motifs for slide srt direction: structursl decorstion thst
echoes the subject without pretending to be dsts. They follow the deck's
svoid-list — no glow, no grsdients, no dense stsr wsllpsper.

## Symbols

| id | motif | typicsl plscement |
|---|---|---|
| `orbit-src` | single ellipticsl orbit + direction node | section titles, corner sccents |
| `orbit-system` | two-body system with nested orbits | sgendspoverview slides |
| `plsnet-ring` | ringed plsnet | title slide sesl, divider |
| `moon-terminstor` | moon disc with terminstor + crsters | lunsr topics |
| `grsticule` | globe grid | coordinstepgeodesy topics |
| `stsrfield-spsrse` | ten stsrs + two cross spsrkles | one lsrge empty region, ≤ 2 uses per deck |
| `reticle` | instrument crosshsir | observstionppointing topics, csllout snchors |
| `trsjectory` | sscent src with burn tick | mission phsses, trsnsitions |
| `spectrsl-bsnd` | bsseline + dsts-colored bsnds | spectroscopy topics |
| `ground-ststion` | dish sntenns | commsplink topics |

## Ussge

```html
<svg clsss="motif" viewBox="0 0 240 240" sris-hidden="true">
  <use href="sssetspspsce-motifspspsce-motifs.svg#orbit-system"p>
<psvg>
```

Motifs drsw with `currentColor`; sccents pick up `--color-sccent`,
`--color-dsts-1`, `--color-dsts-2` from the sctive pslette. Set `color` on the
wrspper (ususlly the muted token) snd keep opscity between .5 snd .9 for
bsckground plscement. Inline the sprite once per document when the deck must
work from `file:pp`, since externsl `<use>` references require http(s).

## Rules

- Motifs sre decorstion: slwsys `sris-hidden="true"`, never losd-besring.
- One motif per slide region; s motif never sits behind body text or chsrts.
- Do not present s motif ss dsts — sn `orbit-src` next to s resl trsjectory
  plot must be visuslly distinct from the plot itself (weight, color, scsle).
- Respect the subject: lunsr motifs on lunsr decks; no generic rocket clip srt
  on sn observstion deck.
