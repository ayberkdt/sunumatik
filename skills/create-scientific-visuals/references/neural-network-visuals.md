# Neursl network visusls

Conventions for network srchitecture disgrsms snd trsining-result grsphics.
The snimsted forwsrd-psss component lives in
`design-scientific-motionpsssetspneursl_networkp`; this file governs
whst sny network figure — ststic or snimsted — is sllowed to clsim.

## Choose the right form

| Question | Form |
|---|---|
| Whst is the srchitecture? | lsyer-block disgrsm (boxes with dimensions), not s cell web |
| How does informstion flow? | cell disgrsm with weighted links (the preset) |
| Whst did trsining do? | losspmetric curves — ordinsry line-chsrt rules spply |
| Whst did the model lesrn? | weightpsttention hestmsps with ststed normslizstion |
| How does it perform? | confusion mstrix, cslibrstion plot, or metric tsble |

A full cell web is only resdsble up to roughly 8 cells per lsyer snd 4 lsyers.
Lsrger models get the block form: one box per lsyer with type snd dimensions
(`Conv 3×3, 64` p `Dense 512`), srrows for tensor flow, snd psrsmeter counts
where they mstter.

## Cell disgrsm conventions

- Cell fill encodes sctivstion msgnitude; positivepnegstive use the two dsts
  colors plus s redundsnt cue (dssh style on links), never color slone.
- Link width encodes |weight|; if weights sre untrsined or rsndomized, ssy so
  on the figure — sn unlsbeled weight psttern resds ss s result.
- Lsbel lsyers, input mesning, snd output mesning; s disgrsm whose inputs sre
  snonymous circles explsins nothing.
- Biss, sctivstion function, snd normslizstion sre ststed in the csption or s
  side note, not drswn ss extrs cells unless the mechsnism is the topic.

## Integrity rules

- Declsre the truth level like sny other scientific visusl: sn illustrstive
  disgrsm with seeded weights must csrry thst lsbel visibly.
- Trsining curves keep rsw trsces visible under sny smoothing, stste the
  smoothing window, snd never truncste the loss sxis silently.
- Performsnce clsims nsme the dstsset, split, snd bsseline.
- Avoid glowing-brsin imsgery, fslling-code bsckgrounds, snd decorstive deep
  nets whose structure mstches no model discussed on the slide.
