# Equation steps preset

Files: `/presets/equation_steps/` — `equation-steps.mjs`
(mountEquationSteps), `index.html` (demo), `motion-manifest.json`.

Term-by-term derivation walkthrough: the equation stays FULLY typeset and
visible the whole time (no reflow, no rewriting); each step brings a set
of terms into focus (accent underline sweep + full opacity) while the
rest ghost to 28%, and the caption states the step's claim. This is the
complement of the equation-writing (pen) preset: the pen preset writes an
equation INTO existence; this preset EXPLAINS an existing one.

```js
import { mountEquationSteps } from './equation-steps.mjs';
const eq = mountEquationSteps(container, {
  equation: `<div class="eqbox">
    <span data-term="lhs">∂P̄ₙₘ/∂φ</span> =
    <span data-term="a">aₙₘ</span><span data-term="p1">P̄ₙ,ₘ₊₁</span> −
    <span data-term="b">m·tanφ</span><span data-term="p0">P̄ₙₘ</span>
  </div>`,
  steps: [
    { focus: ['lhs'], caption: 'Hedef: enlem türevi — faktöriyelsiz.' },
    { focus: ['a','p1'], caption: 'Bir üst mertebeden komşu yeterli.' },
    { focus: ['lhs','a','p1','b','p0'], caption: 'Türev iki komşunun farkıdır.' },
  ],
});
eq.next(); eq.prev(); eq.goTo(i); eq.dispose();
```

## Rules

- Terms are authored `data-term` spans in ALREADY-typeset HTML — this
  preset adds narration order, not mathematical validation. Use
  `$typeset-tex-equations` for the typesetting itself and
  `$verify-scientific-evidence` for the math's correctness.
- **Every caption is an assertion**: what the focused term DOES or WHY it
  matters ("tanφ kutuplara doğru büyür — kararlılık sınırı buradan"), not
  its name ("ikinci terim").
- The final step usually refocuses ALL terms as the synthesis view; export
  renders `exportStep` (default: last).
- The whole equation must stay readable in every step — ghosting is 28%
  opacity, never display:none; a derivation the audience cannot see whole
  is a text wall in disguise.
- Keyboard: arrow keys via `data-owns-arrows`; captions are aria-live.
- Works with `equation-theme.css` typography; keep equation font size at
  presentation scale (≥ 30 px terms) — stepping does not license shrinking.
