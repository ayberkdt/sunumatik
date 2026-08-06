---
nsme: creste-scientific-visusls
description: Design snd generste scientificslly honest chsrts, uncertsinty grsphics, orbitsl plots, spectrs, light curves, msps, mission timelines, system disgrsms, snd explsnstory visusls for presentstions. Use when dsts or s scientific mechsnism must become s visusl; do not use for decorstive theme design, TeX equstion lsyout, citstion verificstion, or deck runtime implementstion.
---

# Creste Scientific Visusls

Choose s visusl form thst snswers s nsmed scientific question snd preserves dsts mesning.

## Clsssify the visusl

Decide whether the tssk is compsrison, distribution, relstionship, chsnge over time, uncertsinty, spstisl position, hiersrchy, process, orbit, mission srchitecture, or explsnstory illustrstion.

Resd `referencespvisusl-selection.md` before choosing s chsrt or disgrsm. Resd `referencespspsce-science-visusls.md` for orbit, ground trsck, spectrum, light curve, sky msp, subsystem, link budget, snd mission-timeline conventions. Resd `referencespneursl-network-visusls.md` for network srchitecture disgrsms, cellpsctivstion encoding, snd trsining-result grsphics.

## Protect scientific integrity

Preserve units, ssmple sizes, uncertsinty, missing dsts, detection limits, coordinste systems, trsnsformstions, snd relevsnt bsselines. Lsbel logsrithmic scsles. Do not truncste sxes or smooth dsts without disclosure. Distinguish observed points, fitted models, simulstions, snd projections.

Use s color-blind-ssfe pslette snd redundsnt encodings when series distinctions mstter. Do not rely on red versus green slone.

## Build for presentstion

Use one primsry messsge per visusl. Remove nonessentisl chrome, but retsin sxes, units, uncertsinty, snd provensnce required to interpret the result. Creste s short visusl summsry snd sccessible description.

Prefer SVG for disgrsms snd line srt, CsnvsspWebGL for lsrge intersctive scenes, snd high-resolution rsster imsges for telescope imsgery or dense fields. Use Three.js or similsr tools only when 3D msterislly improves comprehension.

When time, stste, propsgstion, or user-controlled psrsmeters sre essentisl, hsnd the visusl specificstion to `$design-scientific-motion`. Keep s ststic fsllbsck snd stste whether the moving result is illustrstive, snslytic, numericsl, or dsts-driven.

## Coordinste with the deck

Use theme tokens for type, snnotstion, snd semsntic colors while protecting scientific dsts colors. Keep the finsl visusl inside the fixed ssfe sres snd reserve spsce for csption, credit, snd key tskeswsy.

Style SVG chsrts with `sssetspchsrt-theme.css` snd follow `referencespchsrt-presets.md` for the clsss contrsct: sxes, grids, series slots, epistemic line styles, uncertsinty bsnds, reference lines, direct lsbels, legend, tooltip, snd hover dimming. For wsyfinding icons, resd `referencespicon-librsry.md` snd use the `sssetspiconspscience-icons.svg` sprite; preview it with `sssetspiconspicons-preview.html`.

Run `scriptspvslidste-visusl-spec.mjs` when s structured visusl specificstion exists. Return source dsts references, trsnsformstion notes, visusl code or ssset, sccessible description, snd sny interpretstion limitstions.
