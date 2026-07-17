# 12 — Audit accessibility and responsive behavior

**What to build:** Every completed V1 journey works cohesively for keyboard, screen-reader, enlarged-text, forced-colors, touch, phone-safe-area, and desktop-column use. This is an integrated audit and correction pass over accessibility already required in each feature ticket.

**Blocked by:** 03 — Edit and remove Cards safely; 05 — Repeat forgotten Cards and study ahead; 07 — Keep Review working through connection trouble; 08 — Show Khanh's progress; 10 — Make Khunhphap reliable and cost-bounded; 11 — Handle loading, stale data, and expired Sessions.

**Status:** ready-for-human

- [ ] Complete Login, Card management, Review/repeat, Me, Khunhphap, failure, expiry, and Logout journeys are operable using only the keyboard.
- [ ] Native dialogs have consistent opening focus, focus containment, Escape/backdrop rules, dirty-editor exceptions, close controls, and focus restoration.
- [ ] Controls, fields, validation, progress, Points changes, connectivity, streaming, retries, and summaries expose meaningful names, roles, descriptions, and restrained live announcements.
- [ ] Focus is always visible with the settled 3px ring and 2px offset, adapts to forced colors, and follows logical order without hidden or obscured targets.
- [ ] Every target is at least 44px, prominent actions are 56px, and touch/keyboard behavior never depends on hover.
- [ ] All screens remain functional at 200% text zoom without clipped controls, lost content, two-dimensional page scrolling, or inaccessible internal scroll regions.
- [ ] Core and semantic meaning survives forced-colors mode; color is never the sole indicator of Grade, error, success, selection, progress, or connectivity.
- [ ] Below 48rem the app uses the safe viewport; from 48rem it centers a 30rem column without shadow, and all four safe-area edges are respected.
- [ ] Viewport sizing uses a compatible fallback plus dynamic viewport units and remains usable with mobile browser chrome and on-screen keyboards.
- [ ] Review Cards retain readable fixed typography with appropriately labeled internal scrolling when content overflows.
- [x] Automated accessibility scans and behavioral assertions pass in critical browser journeys without suppressing genuine violations.
- [ ] Manual verification records keyboard, 200% resize, forced colors, screen-reader, and representative iOS/desktop behavior, with any discovered regression fixed in scope.

## Comments

Automated interaction, axe, responsive, and Chromium visual checks pass. Human evidence is still
required for `docs/accessibility-verification.md`, especially screen readers, forced colors, 200%
text, keyboard-only completion, and representative iOS behavior. Do not close this ticket from
automated evidence alone.
