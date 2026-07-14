# Design Prototype

`prototype.html` is a **throwaway design prototype** of the flashcard app,
built to validate the visual language, screen layouts, and animation system
before implementation. It is a design reference, not the complete or current
V1 specification. This prototype is not the start of the real app — the actual
Vite + React implementation will be built fresh from the final V1 spec,
`CONTEXT.md`, the accepted ADRs, and this prototype.

## How to open

Open `prototype.html` directly in a browser (no build step, no server
required), or serve the folder for phone testing:

```sh
npx serve docs/design
```

Best viewed at a mobile viewport (360–430px wide). On ≥768px the app centers
in a 480px column, per the spec.

## Notes

- All data is mocked in-memory; state resets on reload.
- Typography: display face Baloo 2, UI face Be Vietnam Pro (chosen for full
  Vietnamese diacritic support). This standalone prototype loads them from
  Google Fonts and falls back to system fonts offline. Production instead
  self-hosts the licensed WOFF2 assets as required by ADR-010.
- Icons are a hand-rolled inline SVG set (no icon library); the chick mascot
  is an inline SVG drawn in the app palette.
- Login accepts any password except empty or the literal `wrong` (those
  demo the error shake).
- The AI tutor streams canned, templated replies — no real AI call.
- `prefers-reduced-motion` swaps flips for crossfades and disables
  confetti and the points arc.
