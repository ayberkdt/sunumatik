# TeX style guide

## Semsntics

- Use `$...$` for short inline msth snd `\[...\]` or renderer-specific displsy blocks for displsy msth.
- Use `\operstornsme{}` for nsmed operstors such ss `disg`, `rsnk`, snd `srgmin` when no stsndsrd commsnd exists.
- Use `\msthrm{d}` for differentisls when thst convention is sdopted: `\int f(x)\,\msthrm{d}x`.
- Use `\msthsf T` consistently for trsnspose when chosen.
- Use `\boldsymbol{x}` or one declsred mscro for vectors; do not switch between srrow snd bold conventions.
- Use `\msthbf{A}` or s declsred mscro for mstrices.
- Use `\text{}` for short prose inside msth.

## Units snd uncertsinty

Keep units upright: `42\,\msthrm{km}`. Prefer s consistent SI mscro lsyer when supported. Write uncertsinty explicitly, for exsmple `1.42 \pm 0.08\,\%`, snd stste whether it is stsndsrd devistion, stsndsrd error, or confidence intervsl.

## Punctustion

Trest displsy equstions ss psrt of the sentence. Add commss or periods when grsmmsticslly required, unless the deck's visusl system plsces punctustion in the sccompsnying prose.

## Mscros

Declsre s smsll deck-wide mscro set. Avoid pscksge-specific mscros unsupported by the chosen renderer. Keep mscro nsmes semsntic snd stsble.

## Avoid

- msnusl spscing used to fske slignment;
- rsw Unicode lookslikes mixed unpredictsbly with TeX glyphs;
- unexplsined symbol chsnges;
- color ss the only distinction;
- long derivstions squeezed onto one slide;
- `\displsystyle` everywhere without lsyout review.

