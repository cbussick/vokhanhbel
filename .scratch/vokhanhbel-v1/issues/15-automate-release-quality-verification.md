# 15 — Automate release-quality verification

**What to build:** Every proposed release receives repeatable automated evidence that the app is formatted, typed, secure enough to review, database-compatible, accessible, and functional in all supported browser engines.

**Blocked by:** 08 — Show Khanh's progress; 10 — Make Khunpap reliable and cost-bounded; 13 — Apply the settled visual and motion system; 14 — Harden and observe the production app.

**Status:** ready-for-agent

- [ ] One GitHub Actions workflow runs on pull requests and main, cancels superseded runs, uses clean npm installation, and never receives production secrets.
- [ ] The workflow checks Prettier, type-aware flat ESLint with React Hooks and JSX accessibility rules, Stylelint with the standard configuration, strict TypeScript, and the production build.
- [ ] Unit/frontend suites cover pure scheduling, Points, normalization, date validation, schemas, authentication, rate logic, rendered behavior, and network behavior using Vitest, Testing Library, user-event, and MSW.
- [ ] Database integration starts isolated PostgreSQL 17, applies committed migrations, clears the five application tables between cases, serializes shared writers, and covers constraints, transactions, statistics, and both Berlin daylight-saving transitions.
- [ ] Critical Playwright journeys run in Chromium, Firefox, and WebKit; no separate Edge run is required.
- [ ] Browser journeys cover Session/Login/Logout, Card management, normal/early/repeat Review, Grade replay/recovery, Me, Khunpap, offline/loading/expiry behavior, and cross-route security outcomes.
- [ ] Automated browser accessibility checks use axe plus interaction assertions; release documentation retains manual keyboard, 200% resize, forced-colors, screen-reader, and reduced-motion checks.
- [ ] Stable visual regression includes only approved Login, Review front/back/summary, Cards/editor, Me, and tutor states at one mobile viewport and 768px, never animation frames.
- [ ] OpenAI is mocked in every automated environment and no test can spend provider budget or transmit Card/tutor content externally.
- [ ] The npm lockfile is committed and cleanly reproducible; direct dependencies are limited to justified capabilities.
- [ ] Release checks run dependency audit and generate an SPDX SBOM; unresolved high/critical production vulnerabilities and missing, unclear, custom, dual, or unapproved licenses fail the gate pending explicit review.
- [ ] Failure output is useful for diagnosis but redacts secrets and private content.
- [ ] The complete workflow passes from a clean checkout using only development/test resources.

