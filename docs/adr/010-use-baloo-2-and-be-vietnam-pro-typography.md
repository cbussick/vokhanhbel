# ADR-010: Use Baloo 2 And Be Vietnam Pro For Typography

## Status

Accepted

## Date

2026-07-12

## Context

The UI language is German (ADR-005), and V1 primarily teaches English words and phrases
through German meanings or explanations. Cards remain free-form and may contain Vietnamese
now or in future, which needs full Vietnamese diacritic support (stacked tone marks over
accented Latin letters) to render legibly. This rules out relying on the system font stack
alone, since diacritic rendering quality varies across OS/browser combinations, and rules
out many popular display/UI webfonts that only cover Latin Extended without full Vietnamese
glyph coverage.

## Decision

Use `Be Vietnam Pro` as the UI face (body text, buttons) with system fallbacks, and
`Baloo 2` as the display face (screen titles, celebratory headings) with `Be Vietnam Pro`
as its fallback. Self-host the production WOFF2 assets with the app instead of loading
them from Google Fonts at runtime.

Both families are distributed under the SIL Open Font License 1.1. Keep the applicable
copyright notices and complete license text with the redistributed font assets, preserve
their license provenance, and verify those notices as part of the release check. Do not
rename or modify the fonts in a way that conflicts with any Reserved Font Name restriction.

## Alternatives Considered

### System font stack only, no webfonts

- Pros: zero network dependency, fastest paint, no Google Fonts request.
- Cons: Vietnamese diacritic rendering quality is inconsistent across OS/browser
  combinations, and there's no distinct playful display face for celebratory moments
  (session summary, points).
- Rejected because card content legibility for Vietnamese text is core to the app's
  purpose.

### Load the fonts from Google Fonts at runtime

- Pros: no font assets to manage in the repository; Google serves optimized font files.
- Cons: adds a third-party runtime request, weakens the Content Security Policy, and makes
  the intended typography depend on an external service being reachable.
- Rejected because the small asset-size increase from self-hosting is acceptable and local
  assets make rendering and deployment behavior more predictable.

### Single font for both UI and display

- Pros: fewer self-hosted font assets, simpler loading, more visual consistency.
- Cons: loses the intentional playful/celebratory feel Baloo 2 gives screen titles and
  confetti moments.
- Rejected in favor of the two-face system the design prototype already validated.

## Consequences

- Production makes no runtime request to Google Fonts; font assets deploy with the app.
- The repository and distribution must retain the SIL Open Font License 1.1 text and
  applicable copyright notices for both font families.
- Any future additional UI locale must be checked against both fonts' glyph coverage
  before shipping, not just assumed from their Latin coverage.
- Card content sizing/auto-shrink logic must be tuned against these two fonts' specific
  metrics, not swapped casually without re-validating flip/sizing behavior.
