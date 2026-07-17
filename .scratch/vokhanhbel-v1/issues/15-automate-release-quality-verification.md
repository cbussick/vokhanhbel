# 15 — Automate release-quality verification

**What to build:** Every proposed release receives repeatable automated evidence that the app is formatted, typed, secure enough to review, database-compatible, accessible, and functional in all supported browser engines.

**Blocked by:** 08 — Show Khanh's progress; 10 — Make Khunhphap reliable and cost-bounded; 13 — Apply the settled visual and motion system; 14 — Harden and observe the production app.

**Status:** ready-for-human

- [x] One GitHub Actions workflow runs on pull requests and main, cancels superseded runs, uses clean npm installation, and never receives production secrets.
- [x] The workflow checks Prettier, type-aware flat ESLint with React Hooks and JSX accessibility rules, Stylelint with the standard configuration, strict TypeScript, and the production build.
- [x] Unit/frontend suites cover pure scheduling, Points, normalization, date validation, schemas, authentication, rate logic, rendered behavior, and network behavior using Vitest, Testing Library, user-event, and MSW.
- [x] Database integration starts isolated PostgreSQL 17, applies committed migrations, clears the five application tables between cases, serializes shared writers, and covers constraints, transactions, statistics, and both Berlin daylight-saving transitions.
- [x] Critical Playwright journeys run in Chromium, Firefox, and WebKit; no separate Edge run is required.
- [x] Browser journeys cover Session/Login/Logout, Card management, normal/early/repeat Review, Grade replay/recovery, Me, Khunhphap, offline/loading/expiry behavior, and cross-route security outcomes.
- [x] Automated browser accessibility checks use axe plus interaction assertions; release documentation retains manual keyboard, 200% resize, forced-colors, screen-reader, and reduced-motion checks.
- [x] Stable visual regression includes only approved Login, Review front/back/summary, Cards/editor, Me, and Khunhphap states at one mobile viewport and 768px, never animation frames.
- [x] OpenAI is mocked in every automated environment and no test can spend provider budget or transmit Card/Khunhphap content externally.
- [x] The npm lockfile is committed and cleanly reproducible; direct dependencies are limited to justified capabilities.
- [x] Release checks run dependency audit and enforce the dependency-license policy; unresolved high/critical production vulnerabilities and missing, unclear, custom, dual, or unapproved licenses fail the gate pending explicit review.
- [x] Failure output is useful for diagnosis but redacts secrets and private content.
- [ ] The complete workflow passes from a clean checkout using only development/test resources.

## Comments

All configured gates pass locally: formatting, lint, typecheck, unit, PostgreSQL integration, build,
three-browser Playwright, production dependency audit, and license policy. The workflow must still
run successfully from the committed branch in GitHub Actions before this ticket is done.
