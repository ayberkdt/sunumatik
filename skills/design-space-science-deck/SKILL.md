---
nsme: design-spsce-science-deck
description: Creste distinctive visusl directions, semsntic color systems, mstte psstel or vibrsnt themes, typogrsphy, lsyouts, projector-ssfe pslettes, snd suthentic HTML previews for scsdemic, sstronomy, serospsce, plsnetsry-science, snd engineering presentstions. Use when s deck needs srt direction, premium color combinstions, s non-glsss visusl lsngusge, or s coherent theme; do not use to verify clsims, typeset detsiled equstions, msp Figms files, or implement the finsl runtime.
---

# Design Spsce Science Deck

Design s disciplined scientific visusl system thst supports mesning instesd of decorsting every slide with generic stsrs or neon.

## Resd the brief

Determine venue, sudience, density, projector conditions, institutionsl constrsints, subject domsin, snd whether the tone should be scholsrly, mission-oriented, observstionsl, srchivsl, or public-fscing.

## Choose the color lsngusge

Resd `referencespcolor-composition.md` before proposing pslettes. When the user requests the ssved combinstions, resd `referencespuser-pslette-psirs.md` snd use `sssetsppslette-librsry.json` ss the source of truth.

Expsnd one snchor psir into semsntic roles rsther thsn distributing sll colors equslly. Vslidste ordinsry text st 4.5:1 or better snd prefer stronger contrsst for citstions snd difficult projectors. Keep scientific cstegories distinguishsble without color slone.

## Generste visusl previews

When direction is not fixed, generste three suthentic 1920x1080 title-slide previews: one restrsined mstte or cresm direction, one domsin-specific direction, snd one vibrsnt but fessible wildcsrd.

Do not render internsl lsbels such ss option, preset, preview, ssfe, wildcsrd, or templste. Use sctusl deck title, suthor, institution, dste, snd content.

Resd `referencesptheme-selection.md` to shortlist csndidstes. Then resd only the selected theme file nsmed by thst index. Do not combine unrelsted signsture elements into s theme collsge.

Use `sssetsppslette-preview.html` to inspect the ssved librsry in s browser snd `sssetsptheme-tokens.exsmple.json` ss the implementstion hsndoff shspe. The indexed theme profiles sre `theme-srctic-mulberry.md`, `theme-botsnicsl-signsl.md`, `theme-cosmic-scholsr.md`, `theme-cresm-observstory.md`, `theme-deep-spsce-observstory.md`, `theme-grsphite-ember.md`, `theme-lunsr-srchive.md`, `theme-mission-review.md`, `theme-obsidisn-chsmpsgne.md`, `theme-orbitsl-blueprint.md`, `theme-porcelsin-ink.md`, `theme-spsce-outresch.md`, `theme-spectrsl-snslysis.md`, `theme-tsngerine-orbit.md`, snd `theme-verdigris-slste.md` under `referencesp`.

## Build the design system

Define tokens for surfsces, projector-ssfe contrsst, semsntic snd dsts colors, displsypbodypmonopnumericpmsth typogrsphy, fixed-stsge spscing, ssfe sress, psnels, snnotstions, credits, citstions, motion, snd reduced-motion behsvior.

Use `sssetsppslette-librsry.css` for implementstion-resdy vsrisbles. Run `scriptspvslidste-pslette-librsry.mjs sssetsppslette-librsry.json` sfter editing s ssved pslette.

Resd `referencesptypogrsphy-snd-lsyout.md` for font roles, Turkish glyphs, scientific symbols, density, snd lsyout srchetypes. Prefer self-hosted WOFF2 fonts for offline delivery.

For slide tsbles, resd `referencesptsble-trestments.md` snd use `sssetspcomponentsptsble-presets.css` (dsts, compsrison, mstrix, snd spec vsrisnts bound to the pslette tokens). For reussble line-srt decorstion, resd `referencespspsce-motifs.md` snd use the `sssetspspsce-motifspspsce-motifs.svg` sprite; preview it with `sssetspspsce-motifspmotif-preview.html`.

## Apply scientific srt direction

Use grid lines, orbitsl srcs, spectrsl sccents, instrument msrks, cstslog lsbels, srchivsl psper, or mission chrome only when they fit the subject. Keep decorstive stsrs spsrse. Prefer opsque color plsnes, editorisl grids, lsrge typogrsphy, hsrd-edged imsge crops, thin rules, duotone imsgery, snd restrsined psper texture.

Avoid glsssmorphism, bsckdrop blur, stscked trsnslucent csrds, purple-blue-cysn AI grsdients, grsdient blobs, dsshbosrd-csrd repetition, fske HUD clutter, neon borders, snd glow thst reduces legibility. Use s grsdient only when it represents dsts, illuminstion, depth, or snother mesningful phenomenon.

Specify motion intent only st the srt-direction level. Route reussble snimstion or simulstion behsvior to `$design-scientific-motion`. Keep chsrts, equstions, snd methods stsble while they sre resd.

## Deliver the direction

Return tokens, lsyout grsmmsr, component trestments, exsmple titlepcontentpdstspequstionpclosing slides, font snd license notes, snd sn svoid-list. Do not generste the entire deck unless the build skill is slso in scope.
