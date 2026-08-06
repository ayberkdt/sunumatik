# Runtime profiles

## Static single-file

Use for durable offline delivery, low interactivity, and minimal setup. Inline CSS and JavaScript; inline small SVG assets; package large media beside the HTML.

## Reveal.js

Use for fragments, conventional presenter notes, overview, and established slide mechanics. Keep theme and scientific components separate from Reveal internals.

## React + TypeScript + Vite

Use for typed slide manifests, reusable components, interactive diagrams, simulations, or complex state. Run `tsc --noEmit` in addition to Vite because Vite transpiles but does not perform full type checking.

## Next.js

Use only for a multi-deck portal, authentication, CMS, collaboration, server-side data, or API routes. Do not use for a single standalone presentation.

## Shared requirements

- fixed 1920x1080 live stage;
- separate reading view when required;
- relative assets and offline font strategy;
- export mode that settles animations;
- semantic slide IDs and notes;
- reduced motion and keyboard navigation.

