# Vokhanhbel V1 — canonical decision source

Updated: 2026-07-14 (Europe/Berlin)

## Purpose

This is the durable, canonical input for producing the V1 specification with
`to-spec`. It replaces the deleted temporary handoff chain. The design interview
is complete: product, architecture, data, API, security, deployment, UI states,
design tokens, accessibility, and component animation behavior are settled.

Do not implement the application during specification synthesis. Do not commit
unless the user asks.

The `main` branch has no commits yet and the current project artifacts are
untracked. Preserve that state and all unrelated user work unless explicitly
asked to change it.

## Authoritative project artifacts

Read these together with this file. Where they own a decision, reference them
rather than silently replacing their terminology or rationale:

- `AGENTS.md`
- `CONTEXT.md` — domain glossary only
- `docs/adr/001-use-vercel-functions-and-neon-postgres.md`
- `docs/adr/002-use-shared-password-session-auth.md`
- `docs/adr/003-use-hosted-ai-api-behind-provider-interface.md`
- `docs/adr/004-use-manual-flashcard-grading.md`
- `docs/adr/005-use-react-i18next-for-i18n.md`
- `docs/adr/006-defer-card-collections.md`
- `docs/adr/007-use-leitner-lite-scheduling.md`
- `docs/adr/008-derive-points-from-review-log.md`
- `docs/adr/009-offline-grading-is-best-effort.md`
- `docs/adr/010-use-baloo-2-and-be-vietnam-pro-typography.md`
- `docs/adr/011-keep-reviews-when-a-card-is-deleted.md`
- `docs/deployment-strategy.md`
- `docs/design/README.md`
- `docs/design/prototype.html` — visual reference only; its stale English copy,
  12-Card queue, demo data, and prototype-only behavior are not requirements

## Scope and Card behavior

- Responsive web application only. No PWA, service worker, install flow, native
  app, or offline startup.
- Canonical study direction is an English prompt to a German meaning or
  explanation. Card content is free-form and may contain Vietnamese, but V1 has
  no language-specific schema or behavior.
- A Card has only required `front` and `back` text. No persisted examples,
  source, notes, pronunciation, tags, language, collection, owner, or AI fields.
- Cards are created manually. Khunpap never creates, translates, edits, or
  deletes them.
- Both fields use multiline textareas and preserve intentional line breaks.
  Front is 1–200 characters; back is 1–1,000.
- Apply the accepted Unicode normalization, normalize line endings to LF, trim
  surrounding whitespace, collapse repeated horizontal whitespace within each
  line, preserve line breaks, and reject other control characters. Enforce this
  on both client and server, with database constraints for stored invariants.
- New Cards start in Box 0, are Due immediately, and enter only Review Sessions
  started after creation.
- Editing preserves Box, due date, and Review history. There is no progress reset;
  materially different content should be a new Card.
- Active fronts are unique after normalization and case-insensitive comparison.
  Preserve capitalization for display. Capitalization alone cannot distinguish
  Cards; distinct senses use short context cues.
- Soft deletion releases the front for reuse. A replacement has a new ID and
  fresh progress; old Reviews remain attached to the deleted Card.
- Deletion uses an in-sheet confirmation explaining that the Card disappears
  while Points and prior Reviews remain. Success closes the sheet and shows
  `Karte gelöscht.` There is no undo or restore UI.
- A dirty editor asks `Änderungen verwerfen?` with `Weiter bearbeiten` and
  `Verwerfen`. An unchanged editor closes immediately. No drafts or autosave.
- Card mutations are not optimistic: disable controls during submission, retain
  input, keep the editor open on failure, show safe field errors, and update the
  list only on success.
- Search trims the query and performs case-insensitive substring matching over
  front and back. Diacritics remain significant. No fuzzy search, stemming, or
  added search dependency. No results shows the query and `Suche zurücksetzen`.
- Card list ordering is `createdAt` descending; search preserves that order.

## Review Sessions and grading

- A Review Session is a fixed, client-only queue snapshot capped by one
  `reviewSessionSize = 10` constant. It is not persisted and has no API endpoint.
- Normal sessions use the ten longest-overdue active Cards. `Review anyway`
  appears only when none is Due and uses the ten Cards due soonest.
- Due Cards beyond the first ten remain Due and wait for another Review Session.
- Early Reviews are ordinary Reviews: Points and scheduling use that Review date.
- Closing early needs no confirmation. Confirmed Grades remain; the current and
  remaining Cards stay unchanged/Due. Do not show a partial summary.
- No Grade undo, correction, or deletion.
- Grade input is a client UUID, Card ID, Grade, and client-captured `reviewedAt`.
  The server computes Points, Box, and due time.
- Review insert and Card update are one READ COMMITTED transaction after
  `SELECT FOR UPDATE` on the Card.
- Exact UUID replay returns the original `{ review, card }` without duplicate
  effects. Reusing a UUID with a different payload returns a reload-required
  conflict and leaves the existing Review unchanged. Stop retrying, end the
  Review Session, and show a reload-required error containing the request ID.
- Temporary Grade failures retry the same UUID three times at about 1, 2, and 4
  seconds. Then show a persistent unsaved banner with manual retry while allowing
  the Session to continue.
- Grades award: `forgot` 1, `almost` 5, `knew_it` 10 Points.
- The summary offers `Vergessene wiederholen` for Cards graded `forgot` in the
  latest round. It can repeat until none were forgotten; `Fertig` is always
  available. Repeats create normal Reviews, scheduling, and Points.
- Every summary is cumulative across the whole Review Session, including repeat
  attempts, so Review count may exceed unique Card count.
- Review front uses `3xl`, back uses `2xl`. Short content is vertically centered;
  overflow becomes top-aligned and scrolls inside the Card. Never shrink based
  on character count.

## Scheduling, time, and concurrency

- Boxes 0–5 map to 1/3/7/14/30/90 Berlin calendar days. `forgot` -> Box 0;
  `almost` -> unchanged; `knew_it` -> +1 capped at 5.
- Box transition and interval lookup are pure TypeScript. PostgreSQL calculates
  target Europe/Berlin local midnight in the Grade transaction and handles
  Berlin day/week aggregation. Browser `Intl` is display-only; no date library.
- Test PostgreSQL 17 behavior across both Berlin daylight-saving transitions.
- Accept `reviewedAt` up to seven days old and five minutes future. Scheduling
  and stats use it; server `recordedAt` records receipt.
- A pending Grade older than seven days stops retrying, reverses optimistic
  Points/result, explains it is too old, and puts the Card at the queue end for
  regrading.
- A Grade rejected because the device is over five minutes ahead is discarded;
  reverse Points, pause Review, and ask the Learner to correct date/time.
- If a Card was deleted elsewhere before sync, remove it from the queue, reverse
  optimistic Points, show a brief message, and continue.
- Independent simultaneous Review Sessions are out of scope. Multiple logged-in
  devices are allowed. Card edits are last-write-wins because there is no version.

## Statistics and recap

- `GET /api/stats` returns exactly `totalPoints`, `activeCardCount`,
  `reviewsThisWeek`, nullable `bestDay: { date, reviewCount }`, and nullable
  `dailyRecap: { period: "today" | "yesterday", date, reviewCount, knewItCount }`.
- Reviews this week begins Monday 00:00 Europe/Berlin.
- Best day is the all-time highest Berlin-day Review count; most recent wins ties.
- Recap shows today if present, otherwise yesterday, otherwise hides. Include all
  Review types; only `knew_it` contributes to `knewItCount`.
- Reviews for deleted Cards still count in Points and statistics.
- Empty Me shows zero values, `Noch kein bester Tag`, and no recap.

## Frontend architecture and routes

- Vite React SPA with file-based TanStack Router—not React Router or TanStack
  Start—using normal paths and a Vercel SPA rewrite.
- Routes: `/login`, `/review`, `/review/session`, `/cards`, `/cards/:cardId`,
  `/me`. A direct Session URL without a queue redirects to `/review`. Editor and
  tutor state are not URL-persisted.
- TanStack Query owns server state. Shared Zod contracts under `src/contracts/`
  are runtime sources of truth; infer TypeScript types where practical.
- Strict TypeScript throughout. Follow repository export, declaration, and file
  naming rules.
- Cards/stats stay fresh 30 seconds. This is not polling. Once stale, refresh on
  focus, reconnect, or invalidating action. Keep visible data and a fixed active
  Review queue during refresh.

## API inventory

- Small same-origin JSON REST API under `/api`, plus one POST fetch-based SSE
  tutor endpoint. Direct Vercel Web `Request`/`Response` handlers with shared
  helpers; no Express or Hono.
- `GET /api/session` -> `200 { authenticated: boolean }`.
- `POST /api/session` accepts password, sets cookie -> `204`.
- `DELETE /api/session` revokes current Session -> `204`.
- Protected routes return `401` when unauthenticated.
- `GET /api/cards` -> all active Cards, `createdAt DESC`, intentionally
  unpaginated. Filtering/search are client-side.
- `POST /api/cards` accepts `{ front, back }` -> `201` Card.
- `GET /api/cards/:cardId` -> active Card or `404`.
- `PATCH /api/cards/:cardId` accepts partial front/back -> Card.
- `DELETE /api/cards/:cardId` soft-deletes -> `204`; repeat -> `204`.
- `POST /api/reviews` accepts `id`, `cardId`, `grade`, `reviewedAt`. Initial and
  exact replay -> `200 { review, card }`; client invalidates Card/stats queries.
- `GET /api/stats` directly returns the exact shape defined under Statistics.
- No Review history, queue, or Review Session endpoint.
- `POST /api/cards/:cardId/tutor-replies` accepts current `message` plus at most
  eight previous `{ role, content }` messages. Server loads the active Card.
- Tutor response is `text/event-stream` over POST `fetch` with `delta`, `done`,
  and `error`. No event IDs, heartbeat, resume, EventSource, or auto reconnect.
- Successful JSON returns the resource directly without a `data` envelope.
- UTC timestamps are RFC 3339 with `Z`; Berlin dates are `YYYY-MM-DD`.
- UUID v4 identifies Cards, Reviews, and error occurrences, using built-in
  browser/Node cryptography. Review IDs are client-generated; Card/error IDs are
  server-generated. No UUID dependency.

### Data records and tables

- Card: `id`, `front`, `back`, `box`, `dueAt`, nullable `lastReviewedAt`,
  `createdAt`, `updatedAt`, nullable `deletedAt`.
- Review: client UUID `id`, `cardId`, `grade`, `pointsAwarded`, `boxBefore`,
  `boxAfter`, client `reviewedAt`, server `recordedAt`. Reviews are append-only.
- Five application tables: Cards, Reviews, Sessions, temporary login attempts,
  and temporary AI usage. No user, Points, Review Session, chat, language,
  collection, or settings table.
- PostgreSQL enforces active-front uniqueness, Box/Grade/Points/length
  constraints, timezone-aware timestamps, and Review foreign keys that restrict
  permanent Card deletion.
- Active-front uniqueness is a partial, case-insensitive database rule applying
  only where `deletedAt` is null; it is not merely a client/server pre-check.
- Clean temporary and expired rows opportunistically during related requests;
  no cleanup cron.

## Errors and request handling

- Errors use RFC 9457 `application/problem+json`.
- `type` is a stable relative URI such as `/problems/card-front-conflict`.
- `instance` is `urn:uuid:<uuid>` for the occurrence and correlates with request ID.
- Validation errors contain safe `{ pointer, code }` entries, never raw Zod.
- Status mapping: 400 unreadable request, 401 unauthenticated, 403 invalid origin,
  404 missing, 409 conflict, 413 oversized, 415 wrong content type, 422 invalid,
  429 rate limit, 500 unexpected/dependency failure.
- 429 includes integer-seconds `Retry-After`; separate stable types identify
  login, tutor-Session, and tutor-daily limits.
- JSON bodies are limited to 32 KiB. Body endpoints require `application/json`.

## Authentication, security, and privacy

- Protected assets are Card/Review data, the shared password and Sessions,
  database credentials, and OpenAI spend. Trust boundaries are browser/API,
  API/PostgreSQL, API/OpenAI, and CI/deployment. Primary V1 threats are password
  brute force, cross-site mutation, Card/message prompt injection, oversized
  requests, Grade replay or tampering, secret exposure, and AI cost abuse.
- Follow ADR-002 for opaque database Sessions, scrypt, cookie attributes, CSRF,
  throttling, expiry, and clearing behavior.
- Multiple devices may be logged in. Normal logout revokes current browser only.
  Password compromise recovery replaces `APP_PASSWORD_HASH` and deletes all
  Sessions. No Session-management UI.
- Initial Session check shows full-screen static mascot and `Wird geladen …`;
  never flash Login.
- On 401 cancel requests/tutor, clear private query/offline/memory state and
  Review queue, then redirect with the settled German expiry copy. After Login,
  return to normal Review rather than the interrupted route.
- Wrong password clears and focuses the field, shows a German error, and uses
  the accepted reduced-motion-aware shake. Login 429 disables submit through
  `Retry-After` with countdown. Network failure retains password only in memory.
- Logout is normally immediate. Pending Grades trigger a count-specific warning;
  use a best-effort leave-page warning only while Grades are pending.
- Same-origin API, no CORS. Unsafe requests including Login reject
  `Sec-Fetch-Site: cross-site` and require exact `Origin`; GET never mutates.
- Request bodies are JSON. No CSRF token.
- CSP applies in preview/production via root `vercel.json`, not local Vite. It
  intentionally blocks the Vercel preview toolbar and has no report endpoint:
  `default-src 'none'; script-src 'self'; style-src-elem 'self'; style-src-attr 'none'; font-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`.
- Also send `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`,
  legacy frame denial, and Permissions Policy disabling unused camera,
  microphone, location, payment, and USB. Skip cross-origin isolation. Vercel
  handles HTTPS/HSTS.
- Cache: Session/Login/mutations/tutor/errors `no-store`; Card/stats reads
  `private, no-cache`; HTML `no-cache`; hashed assets
  `public, max-age=31536000, immutable`; non-versioned assets not immutable.
- Ignore all real `.env`, `.env.local`, `.env.*`; commit only empty-placeholder
  `.env.example`. Separate development, preview, and production secrets. Server
  secrets never use `VITE_`. The example includes empty placeholders for
  `APP_PASSWORD_HASH`, `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `OPENAI_API_KEY`,
  `OPENAI_MODEL`, and the rate-limit HMAC secret. Validate without printing values.
- The strict CSP means React components must not use inline `style` attributes.
  Use CSS classes or stylesheet-defined custom properties instead.
- Never log password, Session, keys, Card content, or tutor content.

## Khunpap

- Follow ADR-003 for OpenAI Responses API, provider adapter, model/configuration,
  `store:false`, privacy boundary, plain text, no tools, token cap, timeout, and
  safe logging.
- The Learner is an adult; no under-18 OpenAI flow is required for V1.
- Available only after answer reveal; no pre-reveal hint and no effect on Grade.
- Conversation starts fresh on every sheet opening, stays scoped to one Card and
  browser memory, and clears on close/reload/logout.
- Send only current Card front/back, current 1–500-character question, and at most
  eight prior messages. Never send password, Session, other Cards, Reviews,
  Points, or device details.
- UI disclosure: `Nachrichten werden zur Beantwortung an OpenAI gesendet.`
- Quick prompts are German equivalents of explain simply, example sentence, and
  memory trick.
- Tutor targets CEFR B1–B2, explains in German, infers studied language from Card
  text, gives examples in that language, and asks one brief clarification only
  when needed.
- Plain text with paragraphs only. Never interpret HTML/Markdown or linkify URLs.
- Do not add a Markdown renderer or output-sanitizer dependency.
- No web, tools, code execution, files, database access, or Card mutation.
- Output max 600 tokens. Preserve a limit-truncated response and show
  `Antwort wurde gekürzt.` Other incomplete replies are discarded.
- Overall timeout 60 seconds; closing aborts earlier where possible.
- No automatic tutor retry. Offline: `Khunpap ist offline nicht verfügbar.`
  Session limit includes wait minutes. Daily limit:
  `Khunpap hat für heute Feierabend. Morgen geht’s weiter.` Other failure uses
  `Da ist etwas schiefgegangen. Versuch es noch einmal.` and
  `Erneut versuchen`.
- After a tutor 429, keep retry disabled until the applicable wait period ends.
- Limits: 30 provider calls per Session per rolling 15 minutes and 200 globally
  per Berlin day, plus OpenAI project spending limit. Count immediately before
  calling OpenAI. Once begun it counts despite disconnect, timeout, or failure.
- Automated tests always mock OpenAI.

## Offline, loading, and failure states

- Only an already-open app remains usable after connectivity loss. Cached Cards
  stay readable/searchable. Grade replay is best-effort, memory-only, and may be
  lost on close/reload.
- Refreshing or reopening while offline is explicitly unsupported.
- Card mutations, Login, Logout, and Khunpap are disabled offline with explanation.
- Connectivity banner distinguishes offline/no pending, offline with pending
  count, reconnecting/syncing, briefly all saved, and failed/manual retry.
- Authenticated initial load keeps header/tab bar and shows content skeletons only
  after 200ms. Reduced-motion skeletons are static. Background refresh retains
  content.
- Initial data failure retains shell and shows `Daten konnten nicht geladen
  werden` plus `Erneut versuchen`. With stale data, retain it and show a
  nonblocking banner.
- Empty Review/Cards offers `Karte hinzufügen`; no-search and Me behavior are as
  above; hide recap when absent.
- Retry policy: reads/session/Cards/stats two temporary retries; Card mutations
  none; Grades three; tutor none. Never auto-retry other 4xx. User may retry after
  a 429 wait.

## Styling, tokens, layout, and accessibility

- Plain CSS custom-property tokens in `tokens.css`, small project-owned reset/base,
  and per-component CSS Modules. No Tailwind, Sass, CSS-in-JS, component library,
  or third-party reset.
- The reset is targeted rather than a broad universal-star reset. CSS Modules
  need no special parser or syntax dependency.
- Global layers: `reset`, `theme`, `base`; CSS Modules remain unlayered. Avoid
  `:global`, `:local`, and `composes` unless a real need gets a narrow exception.
- Light-only with `color-scheme: light`; support forced colors, 200% text resize,
  reduced motion, safe areas, and keyboard use.
- Colors: primary `#ADD8E6`, primary text `#1D3A4A`, success `#2FBF71`, warning
  `#FFB020`, warning text `#4A3200`, danger `#D53250`, bg `#F4FAFD`, surface
  `#FFFFFF`, text `#243642`, secondary text `#586B76`, border `#D6E6EE`, divider
  `#EEF5F8`; success action text `#243642`. One-tier semantic colors only.
- Spacing rem scale: 1 `.25`, 2 `.5`, 3 `.75`, 4 `1`, 6 `1.5`, 8 `2`, 12 `3`.
  Page inline spacing uses 4.
- Radius: small `.25rem`, medium `1rem`, large `1.5rem`, full `999px`.
- Shadows: small `0 1px 4px rgb(36 54 66 / 6%)`; medium
  `0 8px 24px rgb(36 54 66 / 10%)`; sheet
  `0 -8px 32px rgb(36 54 66 / 16%)`.
- Type sizes: xs `.75rem`, sm `.875rem`, md `1rem`, lg `1.125rem`, xl
  `1.375rem`, 2xl `1.625rem`, 3xl `2rem`, 4xl `3rem`; body 1rem. Line heights
  1.2/1.5/1.65. Weights 400/500/600/700/800. No tracking scale; one local
  uppercase detail label uses `.04em`.
- Self-host Baloo 2 and Be Vietnam Pro WOFF2 with OFL provenance/notices.
- Durations: 120/250/400/600/800ms for fast/normal/slow/emphasis/celebration.
  Easings: standard `cubic-bezier(.2,0,0,1)`, enter
  `cubic-bezier(.2,.8,.2,1)`, exit `cubic-bezier(.4,0,1,1)`, overshoot
  `cubic-bezier(.35,1.4,.4,1)`. Points arc easing remains local.
- Reduced motion removes 3D/spatial transitions, shake, bounce, pulse, confetti,
  and Points arc; Card changes crossfade. Opacity fades max 120ms. Do not use a
  global near-zero-duration override.
- Minimum control 44px; prominent control 56px. Layers: nav 10, floating 20,
  celebration 30, feedback 40; dialogs use browser top layer.
- Overlay `rgb(36 54 66 / 45%)`, no blur.
- Below 48rem use full viewport; at/above center a 30rem app column. Outside uses
  same app background, no column shadow. `100vh` fallback plus `100dvh`; safe-area
  insets on all edges.
- Focus: 3px primary-text, 2px offset, `:focus-visible`; forced colors uses
  `Highlight`. Borders 1px/2px. Icons 1rem/1.5rem/2.25rem; mascot sizes local.
- Native `<dialog>` sheets. Newer dismiss/animation features enhance progressively.
- Browser support: Baseline Widely Available core plus current and previous
  Chrome, Firefox, desktop Safari, and iOS Safari. Test current Playwright
  Chromium/Firefox/WebKit; no separate Edge run.

## Component animation and transition behavior

- Main tab content switches immediately; active tab color transitions 120ms.
  No tab bounce, page slide, or page crossfade.
- Primary, secondary, Grade, and icon buttons scale to `.98` over 120ms while
  pressed. Disabled buttons and nav tabs do not move. Reduced motion uses color.
- Sheets enter from 1rem below with fade over 250ms and exit down/fade over 120ms;
  backdrop follows. No overshoot. Reduced motion uses fade max 120ms.
- Sheets are not draggable and have no drag handle. Detail/tutor allow close,
  backdrop, Escape. Editor uses controls/Escape and dirty confirmation.
- Reveal uses a 250ms 3D Card flip with standard easing, no bounce. Ignore repeat
  input during flip; show Grades after completion. Reduced motion crossfades 120ms.
- After Grade, use one consistent 250ms shared-axis transition: old Card slightly
  left/fades, next slightly right-to-center/fades. No Grade-specific fly-offs.
  Reduced motion crossfades 120ms.
- Each Grade launches `+1`/`+5`/`+10` toward header Points over 600ms without
  delaying advancement. Total updates immediately and does not pulse. Reduced
  motion removes chip and uses number update plus screen-reader announcement.
- Do not show transient next-due scheduling copy after Grade.
- First completed round gets one nonblocking 800ms confetti burst. No star burst,
  no confetti after redo rounds, none under reduced motion.
- Successful Login crossfades to shell over 250ms, no scale/slide; reduced motion
  switches immediately.
- Wrong password shakes only input: three small horizontal movements over 250ms,
  once per submission. Reduced motion uses error/focus only.
- Initial-load skeletons shimmer subtly every 1.5s after 200ms delay; reduced
  motion static. Never replace existing content during refresh.
- Review progress animates width only over 250ms; no color/bounce/pulse; reduced
  motion immediate.
- Informational toasts enter from .5rem below/fade over 250ms, remain 3 seconds,
  exit fade 120ms. Retry toasts persist. Reduced motion uses fades only.
- Connectivity/unsaved banners enter down from header 250ms, exit up 120ms, and
  crossfade state text 120ms. Problems persist; `Alles gespeichert` hides after
  two seconds. Reduced motion updates container immediately with text crossfade.
- Show `Khunpap denkt …` only after 300ms without response text; animate dots
  subtly, static under reduced motion. Remove on first delta. No typewriter or
  per-word animation.
- Keep tutor stream pinned only while Learner is near bottom. If she scrolls up,
  stop following and show `Zur neuesten Nachricht`; smooth scroll on action,
  immediate jump under reduced motion.
- Never pulse Points or Me star automatically. Initial Session mascot is static.
- Grade controls fade in 120ms after flip; no slide/bounce; reduced motion instant.
- Summary fades in 250ms with initial confetti; no scale/slide; reduced instant.
- Cards list search/create/edit/delete/reorder changes immediately; no row or
  layout animation.
- No global smooth scrolling. Navigation, focus, validation, and restoration are
  immediate. Only tutor latest-message action is smooth (unless reduced motion).

## Platform, quality, delivery, and operations

- npm with committed lockfile and `npm ci`; Node 24.x in engines and `.nvmrc`.
- Vercel Node Functions, Neon PostgreSQL 17, Drizzle SQL migrations, `pg`. Runtime
  pooled URL; direct migration URL. One pool/warm instance, max two connections,
  10s connect timeout, 30s idle timeout.
- Use Vercel's free Hobby plan for V1.
- Generate/commit/review Drizzle migrations; never `push` shared/production schema.
- Generate with `drizzle-kit generate` and apply with `drizzle-kit migrate`.
- Local uses Docker PostgreSQL 17. Preview uses separate nonproduction Neon branch
  and secrets. Production uses production data/secrets. No permanent staging.
- One GitHub Actions CI workflow on PR and `main`, cancelling superseded runs:
  npm ci, Prettier, ESLint, Stylelint, TypeScript, unit/frontend tests, isolated
  PostgreSQL migrations/integration tests, production build, critical Playwright
  Chromium/Firefox/WebKit. Failure diagnostics only; no production secrets;
  OpenAI mocked. Vercel previews separately.
- Tooling: ESLint flat/type-aware typescript-eslint, React Hooks, jsx-a11y;
  separate Prettier; Stylelint with `stylelint-config-standard`; Vitest, React
  Testing Library, user-event, MSW, real PostgreSQL tests, Playwright, and
  `@axe-core/playwright`.
- Unit: scheduling/Points/normalization/date/schema/auth/rate logic. Frontend with
  MSW. DB tests apply migrations, clear five tables, serialize writers. Critical
  E2E all three engines. OpenAI always mocked.
- Visual regression only stable Login, Review states/front/back/summary,
  Cards/editor, Me, tutor at one mobile viewport and 768px; no animation frames.
- Manual accessibility: keyboard, 200% resize, forced colors, screen reader,
  reduced motion.
- No Dependabot. Add direct dependencies only where platform cannot safely do the
  job. Commit lockfile. Default allowed licenses MIT/ISC/BSD/Apache-2.0/CC0/OFL;
  copyleft/custom/dual/missing/unclear requires explicit review and notices.
  `npm audit` plus SPDX `npm sbom` are release checks. Unresolved high/critical
  production vulnerabilities or unknown/unapproved licenses block release.
- ADR-001 owns Neon Free, weekly GitHub backup, read-only credential, PostgreSQL
  17 custom dump validation, pinned/checksummed `age`, encrypted private artifact,
  about four backups, local migration backup, and restore testing.
- `age` is a BSD-3-Clause-licensed system/CI tool, not an npm or runtime
  dependency. Both backup paths use the same public recipient; the private
  identity remains only on the operator's machine and in the password manager.
- Structured Vercel logs include random request ID exposed as `X-Request-ID`,
  route/status/duration/error category. OpenAI logs timing/status/token usage only.
  No Sentry, external logger, CSP reporting, or proactive alerts.
- Deployment is intentionally human-enforced: feature branch, green PR CI,
  production migration when required, merge to `main`, automatic Vercel deploy.
  No GitHub branch protection or Vercel Deployment Check. Direct-push risk is
  accepted. Follow `docs/deployment-strategy.md` for migration and rollback.

## Superseded choices

Ignore stale references to bcrypt, Argon2, stateless signed cookies, JWTs, four
tables, a 400-token tutor cap, Google Fonts in production, 12-Card queues,
Vercel Deployment Checks, draggable sheets, bouncing tabs, Grade-specific
fly-offs, next-due flash messages, and star bursts.

## Next step

Use `to-spec` to synthesize `.scratch/vokhanhbel-v1/spec.md` from this file and
the referenced artifacts. Do not restart grilling unless the user changes a
settled decision or synthesis exposes a genuine contradiction.
