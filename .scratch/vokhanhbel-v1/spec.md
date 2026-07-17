# Vokhanhbel V1

Status: ready-for-agent

## Problem Statement

Khanh encounters English words and phrases that she wants to remember, but she does not have a private, focused way to capture them, revisit them at useful intervals, and get help when a meaning or usage is unclear. General-purpose study tools add unnecessary setup, while simple notes do not schedule practice or make progress visible. The household also needs Khanh's learning data and paid AI access protected without introducing accounts, profiles, or administration that a one-Learner app does not need.

## Solution

Build a private, responsive German-language web app for Khanh. The Learner manually creates Cards with an English prompt and a free-form meaning or explanation, studies Due Cards in short Review Sessions, reveals each answer, and records a self-assessed Grade. A deterministic Leitner-lite schedule decides when each Card becomes Due again, while every Review awards Points and contributes to a simple progress recap.

When an answer needs more explanation, Khanh can open Khunhphap after revealing the Card and ask a focused question. Khunhphap explains at approximately CEFR B1–B2 level in German, uses the Card as its only study context, and cannot alter Cards or Grades. A shared household password protects the app, and the system keeps authentication, learning data, AI credentials, and AI costs on trusted server boundaries.

The experience is mobile-first, calm, playful, accessible, and deliberately small. V1 centers the core loop of creating Cards, reviewing them, seeing progress, and optionally asking Khunhphap for help.

## User Stories

1. As the Learner, I want to unlock the app with the household password, so that my learning data stays private.
2. As the Learner, I want the app to remember an authenticated device for up to 30 days, so that I do not need to log in on every visit.
3. As the Learner, I want to use the app on more than one device, so that I can study wherever it is convenient.
4. As the Learner, I want a clear German error after entering the wrong password, so that I know how to recover.
5. As the Learner, I want login throttling to show when I can try again, so that the temporary block is understandable.
6. As the Learner, I want network trouble during login to keep my typed password only in the current screen, so that I can retry without the password being stored.
7. As the Learner, I want the app to verify my Session before showing private screens, so that the Login screen never flashes during startup.
8. As the Learner, I want an expired Session to return me to Login with a clear explanation, so that an unexpected redirect makes sense.
9. As the Learner, I want to log out of the current device, so that someone else using it cannot access my Cards.
10. As the Learner, I want a warning before logging out while Grades are still waiting to be saved, so that I can avoid losing recent work.
11. As the Learner, I want the app interface to be in German, so that studying and navigation feel natural.
12. As the Learner, I want a simple tab structure for Review, Cards, and Me, so that the main areas are easy to find.
13. As the Learner, I want the app to work comfortably on a phone and in a centered column on larger screens, so that it remains focused at any supported size.
14. As the Learner, I want to create a Card with a front and back, so that I can capture an English word or phrase and its meaning.
15. As the Learner, I want both sides of a Card to support multiple lines, so that explanations keep their intended structure.
16. As the Learner, I want Vietnamese and other free-form text to render correctly, so that my Card content is not restricted to one language pair.
17. As the Learner, I want clear field limits and validation, so that I can correct invalid Card content before saving.
18. As the Learner, I want accidental spacing and line-ending differences normalized safely, so that equivalent Card content stays consistent.
19. As the Learner, I want active Card fronts to be unique regardless of capitalization, so that I do not create confusing duplicates.
20. As the Learner, I want to add a short context cue to distinguish different senses, so that related Cards can coexist without ambiguity.
21. As the Learner, I want a new Card to be Due immediately, so that I can begin learning it in my next Review Session.
22. As the Learner, I want a Card created during an active Review Session to wait until the next Session, so that my current queue does not change underneath me.
23. As the Learner, I want Cards listed newest first, so that recently added material is easy to find.
24. As the Learner, I want to search Card fronts and backs without worrying about capitalization, so that I can quickly find known text.
25. As the Learner, I want search to preserve meaningful diacritics, so that distinct text is not silently treated as identical.
26. As the Learner, I want a useful no-results state that shows my query and lets me reset it, so that I can recover quickly.
27. As the Learner, I want to edit a Card's front or back, so that I can fix mistakes and improve explanations.
28. As the Learner, I want editing a Card to preserve its Box, due date, and Reviews, so that a wording fix does not erase progress.
29. As the Learner, I want unsaved Card edits protected by a discard confirmation, so that I do not lose work accidentally.
30. As the Learner, I want unchanged Card editors to close immediately, so that routine navigation stays quick.
31. As the Learner, I want failed Card saves to retain my input and show safe field errors, so that I can fix the problem without retyping.
32. As the Learner, I want Card changes to appear in the list only after the server accepts them, so that the screen reflects durable data.
33. As the Learner, I want to delete a Card with an explicit confirmation, so that removal is intentional.
34. As the Learner, I want deletion copy to explain that prior Reviews and Points remain, so that I understand what deletion means.
35. As the Learner, I want a deleted Card to disappear from lists and future queues, so that I no longer study it.
36. As the Learner, I want a deleted Card's front to become available for a new Card, so that I can replace old material cleanly.
37. As the Learner, I want empty Cards and Review screens to offer Card creation, so that I always have a clear next step.
38. As the Learner, I want to see how many Cards are Due, so that I know whether it is time to study.
39. As the Learner, I want a Review Session capped at ten Cards, so that a sitting feels manageable.
40. As the Learner, I want the longest-overdue Cards chosen first, so that the most urgent material receives attention.
41. As the Learner, I want Cards beyond the ten-Card limit to remain Due, so that they wait safely for another Session.
42. As the Learner, I want an optional early Review only when nothing is Due, so that I can study ahead without obscuring normal priorities.
43. As the Learner, I want early Review to choose the ten Cards due soonest, so that extra practice remains relevant.
44. As the Learner, I want an active Review Session to keep a fixed queue, so that background refreshes do not interrupt my flow.
45. As the Learner, I want a direct visit to an empty Review Session route to return me to Review, so that I never land on a broken session.
46. As the Learner, I want to see the Card front before its back, so that I can practice recall honestly.
47. As the Learner, I want to reveal the back manually, so that I control when I check my answer.
48. As the Learner, I want long Card content to scroll without shrinking to unreadable text, so that every answer remains legible.
49. As the Learner, I want to Grade myself as forgot, almost, or knew it after revealing the answer, so that the app can schedule the Card deterministically.
50. As the Learner, I want each Grade to advance promptly to the next Card, so that Review feels fast.
51. As the Learner, I want forgot, almost, and knew it to award 1, 5, and 10 Points respectively, so that effort and recall produce visible progress.
52. As the Learner, I want my displayed Points to update immediately after grading, so that feedback feels responsive.
53. As the Learner, I want the Grade to save exactly once even if a request is retried, so that Points and scheduling cannot be duplicated.
54. As the Learner, I want temporary Grade failures retried automatically without interrupting the queue, so that brief connectivity problems do not stop study.
55. As the Learner, I want a persistent warning and manual retry after automatic Grade retries fail, so that unsaved work remains visible.
56. As the Learner, I want offline Grades to resume saving when the still-open app reconnects, so that a short outage does not immediately end a Session.
57. As the Learner, I want the app to explain that pending offline changes require the app to remain open, so that V1's limits are honest.
58. As the Learner, I want an over-seven-day pending Grade returned to the queue for regrading, so that stale client data cannot corrupt scheduling.
59. As the Learner, I want Review paused when my device clock is too far ahead, so that I can correct it before saving incorrect dates.
60. As the Learner, I want a Card deleted on another device removed safely from my queue, so that Review can continue without a dead end.
61. As the Learner, I want closing a Review Session early to keep confirmed Grades without showing a misleading summary, so that I can stop at any time.
62. As the Learner, I want a cumulative summary after completing a round, so that I can see all Reviews and Points from the whole Session.
63. As the Learner, I want the first completed round to feel celebratory without blocking me, so that progress feels rewarding.
64. As the Learner, I want to repeat Cards I forgot in the latest round, so that I can reinforce weak material immediately.
65. As the Learner, I want repeated Cards to create ordinary Reviews and scheduling updates, so that repeat practice counts consistently.
66. As the Learner, I want to repeat forgotten Cards until none remain, so that I can choose to finish strongly.
67. As the Learner, I want a Finish option on every summary, so that repetition is always optional.
68. As the Learner, I want Due dates based on Berlin calendar days, so that Cards become available at predictable local midnights.
69. As the Learner, I want forgot to return a Card to Box 0, almost to keep its Box, and knew it to advance it by one Box, so that scheduling is easy to understand.
70. As the Learner, I want Box intervals of 1, 3, 7, 14, 30, and 90 days, so that successful recall gradually spaces practice farther apart.
71. As the Learner, I want deleted Cards' prior Reviews to keep contributing to Points and statistics, so that completed work is never taken away.
72. As the Learner, I want to see total Points, active Card count, Reviews this week, and my best day, so that I can understand my progress at a glance.
73. As the Learner, I want the current week to begin on Monday in Berlin time, so that weekly progress matches my local calendar.
74. As the Learner, I want ties for best day resolved in favor of the most recent day, so that the displayed achievement feels current.
75. As the Learner, I want a recap of today, or yesterday when today is empty, so that recent study is visible without a full history screen.
76. As the Learner, I want empty progress values to have friendly zero states, so that a new app does not look broken.
77. As the Learner, I want to open Khunhphap only after revealing an answer, so that help supports recall rather than replacing it.
78. As the Learner, I want quick prompts for a simple explanation, an example sentence, and a memory trick, so that common questions take one tap.
79. As the Learner, I want to ask Khunhphap a focused free-form question about the current Card, so that I can resolve confusion.
80. As the Learner, I want Khunhphap to explain in German at an approachable B1–B2 level, so that answers are useful and understandable.
81. As the Learner, I want Khunhphap to infer the studied language from the current Card, so that examples fit the material without extra setup.
82. As the Learner, I want Khunhphap to ask one brief clarification only when needed, so that conversations stay focused.
83. As the Learner, I want streamed Khunhphap responses rendered as plain text, so that untrusted output cannot inject rich content or links.
84. As the Learner, I want an explicit disclosure that messages are sent to OpenAI, so that I understand the privacy boundary before asking.
85. As the Learner, I want each Khunhphap conversation limited to the current Card and current sheet opening, so that unrelated or old context is not retained.
86. As the Learner, I want closing Khunhphap, reloading, or logging out to erase its conversation, so that chats remain temporary.
87. As the Learner, I want a long Khunhphap answer capped and clearly marked if truncated, so that replies stay concise without hiding truncation.
88. As the Learner, I want a stalled or failed Khunhphap request to end with a clear retry option, so that I am not left waiting indefinitely.
89. As the Learner, I want Khunhphap disabled with a clear explanation while offline, so that unavailable help is not confusing.
90. As the Learner, I want Khunhphap rate-limit messages to distinguish a temporary wait from the daily limit, so that I know whether to retry later or tomorrow.
91. As the Learner, I want scrolling up in a Khunhphap conversation to stop automatic following, so that incoming text does not pull me away from what I am reading.
92. As the Learner, I want a control to jump to Khunhphap's newest message, so that I can resume following when ready.
93. As the Learner, I want cached Cards to remain readable and searchable during a connection loss in an already-open app, so that temporary outages do not hide my material.
94. As the Learner, I want connectivity messages to distinguish offline, pending, syncing, saved, and failed states, so that I know whether work is durable.
95. As the Learner, I want existing content to stay visible during background refreshes, so that the app does not flicker or interrupt me.
96. As the Learner, I want clear retryable initial-load and stale-data errors, so that failures do not strand me.
97. As a keyboard user, I want every action reachable with visible focus and predictable focus movement, so that I can operate the app without touch or a mouse.
98. As a screen-reader user, I want semantic controls, dialogs, announcements, and status updates, so that the full study flow is understandable.
99. As a Learner with reduced-motion enabled, I want spatial effects, shaking, bouncing, confetti, and flying Points removed, so that the app remains comfortable.
100. As a Learner who enlarges text, I want the app to remain usable at 200% text size, so that content and controls do not become inaccessible.
101. As a Learner using forced colors, I want controls, focus, and meaning to remain visible, so that the interface works with my system settings.
102. As a touch user, I want comfortably sized controls and safe-area support, so that the app is easy to use on a phone.
103. As the household operator, I want server secrets validated without printing their values, so that configuration failures do not expose credentials.
104. As the household operator, I want AI calls and login attempts rate-limited in shared storage, so that stateless server instances cannot bypass cost and abuse controls.
105. As the household operator, I want structured request diagnostics without passwords, Sessions, Card content, or Khunhphap content, so that failures are diagnosable without leaking private data.
106. As the household operator, I want repeatable migrations, encrypted backups, and a tested restore process, so that Khanh's learning history can survive operational mistakes.
107. As the household operator, I want preview and production data and secrets separated, so that testing cannot alter Khanh's real progress.
108. As the household operator, I want automated checks across supported browsers, PostgreSQL behavior, accessibility, security, and production builds, so that releases are trustworthy.

## Implementation Decisions

### Product and domain

- V1 represents one Learner, Khanh, even when another household member operates the app. There are no user accounts, profiles, ownership fields, roles, or per-person progress.
- The domain terms Learner, Card, Box, Grade, Due, Review, Session, Review Session, Points, and Khunhphap are canonical. In particular, Session means authentication state; Review Session means the client-side study queue.
- The canonical study direction is an English prompt toward a German meaning or explanation. Card text remains free-form and may contain Vietnamese; V1 adds no language field or language-specific behavior.
- The app is a responsive web application. The interface ships in German only, with all user-facing copy routed through translation keys and an allowlisted application locale fixed to German.

### Cards

- A Card contains required `front` and `back` text plus scheduling and lifecycle metadata. Front length is 1–200 characters; back length is 1–1,000 characters. Both are multiline and preserve intentional line breaks.
- Card text uses the accepted Unicode normalization, converts line endings to LF, trims surrounding whitespace, collapses repeated horizontal whitespace within each line, preserves line breaks, and rejects other control characters. The client and server enforce the same rules, and database constraints protect stored invariants.
- Active Card fronts are unique after normalization and case-insensitive comparison. Display capitalization is preserved. The database enforces uniqueness only for non-deleted Cards.
- Cards are created manually. New Cards begin in Box 0, are Due immediately, and can enter only Review Sessions created after the Card.
- Editing preserves Box, due time, and Review history. Card editing is last-write-wins across devices; there is no version field or progress reset.
- Card writes are non-optimistic. Submission controls are disabled while saving; input remains in place on error; safe field-level errors are shown; lists change only after success.
- A dirty Card editor requires explicit discard confirmation. There are no drafts or autosave.
- Deletion is soft deletion. It hides the Card from active reads and Review queues but retains the Card row and all Reviews. Deletion is idempotent, releases the normalized front for reuse, has no undo or restore interface, and requires an in-sheet explanation before confirmation.
- Card search is client-side over the complete active Card list. It trims the query and performs case-insensitive substring matching across front and back while treating diacritics as significant. Results preserve newest-first creation order.
- The active Card list is intentionally unpaginated for V1.

### Review Sessions, Grades, and Points

- A Review Session is a fixed, memory-only queue snapshot and is never persisted or exposed through an API. The shared `reviewSessionSize` constant is 10.
- A normal queue contains the ten longest-overdue active Cards. Review anyway is available only when no Card is Due and contains the ten active Cards due soonest. Early Reviews are ordinary Reviews.
- Creating or refreshing Cards does not mutate an active Review queue. A direct Review Session route without in-memory queue state redirects to the Review landing screen.
- Review follows manual reveal and self-grading. The three Grades are `forgot`, `almost`, and `knew_it`; Khunhphap cannot influence or submit a Grade.
- Each Grade request carries a client-generated UUID, Card ID, Grade, and client-captured `reviewedAt`. The server calculates awarded Points, the new Box, and the new due time.
- Grade Point values are fixed: `forgot` awards 1, `almost` awards 5, and `knew_it` awards 10.
- A Review is append-only. Total Points are always derived from the sum of Review `pointsAwarded`; no Points counter is stored. Reviews belonging to deleted Cards continue to count.
- Recording a Review and updating its Card occur in one READ COMMITTED database transaction after locking the Card row for update.
- Review UUIDs are idempotency keys. Exact replay returns the original Review and Card without another effect. Reuse with a different payload returns a reload-required conflict, preserves the original Review, stops retries, ends the Review Session, and shows the correlated request ID.
- Temporary Grade failures retry the identical UUID three times after approximately 1, 2, and 4 seconds. Exhausted retries leave a persistent unsaved state with manual retry while the Review Session may continue.
- The UI may update session Points and outcome immediately, but it must reverse that optimistic feedback when a Grade is definitively rejected.
- `reviewedAt` may be at most seven days old or five minutes in the future. Too-old pending Grades stop retrying, reverse optimistic feedback, explain the problem, and put the Card at the queue end for regrading. A device-clock-ahead rejection reverses feedback and pauses Review until the Learner corrects the clock. A Card deleted elsewhere is removed from the queue and Review continues.
- Leaving a Review Session early needs no confirmation unless pending Grades affect logout or navigation safety. Saved Grades remain, unreviewed Cards remain unchanged, and no partial summary appears.
- A completed round shows a summary cumulative across the whole Review Session. Review count can exceed unique Card count because repeat rounds are ordinary Reviews.
- The summary may start a new round from Cards graded `forgot` in the latest round. This may repeat until none are forgotten. Finish is always available.
- There is no Grade undo, correction, or deletion.

### Scheduling and time

- Boxes 0–5 map to Berlin calendar-day intervals of 1, 3, 7, 14, 30, and 90 days.
- `forgot` moves the Card to Box 0; `almost` leaves the Box unchanged; `knew_it` advances one Box up to the Box 5 cap.
- Box transition and interval selection are pure TypeScript domain logic.
- PostgreSQL computes the target Europe/Berlin local midnight inside the Grade transaction and performs Berlin day/week aggregation. Browser `Intl` is display-only, and V1 adds no date library.
- Scheduling and statistics use client `reviewedAt`; server `recordedAt` records receipt time.
- Independent simultaneous Review Sessions are outside the concurrency model. Multiple authenticated devices are supported.

### Statistics

- The statistics response contains exactly total Points, active Card count, Reviews this week, nullable best day, and nullable daily recap.
- Reviews this week begins Monday at 00:00 Europe/Berlin.
- Best day is the all-time Berlin calendar day with the most Reviews; the most recent day wins ties.
- Daily recap uses today when Reviews exist, otherwise yesterday when Reviews exist, otherwise it is absent. It includes every Review type; only `knew_it` contributes to the known count.
- Empty progress shows zero totals, no best day yet, and no daily recap.

### Khunhphap

- Khunhphap is available only after the Card back is revealed. It has no pre-reveal hint and cannot create, translate, edit, delete, or Grade Cards.
- Each Khunhphap sheet starts a fresh memory-only conversation for one Card. Closing the sheet, reloading, or logging out discards it. Editor and Khunhphap state are not URL-persisted.
- The request includes only the active Card's front and back, the current 1–500-character message, and no more than eight prior role/content messages from that conversation. It excludes password, Session, other Cards, Reviews, Points, and device details.
- The interface discloses that messages are sent to OpenAI. The Learner is an adult; no under-18 provider flow is required.
- Khunhphap targets CEFR B1–B2, teaches in German, infers the studied language from Card content, supplies examples in that language, and asks one short clarification only when necessary.
- Quick prompts cover a simple explanation, an example sentence, and a memory trick.
- Khunhphap output is plain text with paragraphs. The client never interprets HTML or Markdown and never linkifies URLs. No Markdown renderer or output-sanitizer dependency is added.
- Khunhphap receives no tools, web access, code execution, files, database access, or actions. Card and message content are treated as untrusted and separated from server-owned instructions.
- The backend uses OpenAI's Responses API through the official TypeScript SDK behind a small provider interface. The configured default model is `gpt-5.6-luna` with low reasoning effort, `store: false`, no tools, and a server-configurable model name.
- Output is capped at 600 tokens. A response truncated only by the output limit remains visible with a truncation notice; other incomplete responses are discarded.
- The complete Khunhphap request times out after 60 seconds. Closing the sheet aborts earlier where possible. There is no automatic Khunhphap retry.
- Rate limits are 30 provider calls per authentication Session in a rolling 15-minute window and 200 provider calls globally per Berlin day, plus the provider project spending limit. Allowance is consumed immediately before provider invocation and remains consumed once the call begins.
- Provider responses stream through the backend using a POST fetch response with server-sent `delta`, `done`, and `error` events. There are no event IDs, heartbeats, resume behavior, EventSource usage, or automatic reconnect.
- Khunhphap is unavailable offline. Temporary Session limits, daily limits, and ordinary failures have distinct settled German messages and retry behavior.

### Frontend architecture and behavior

- The frontend is a strict-TypeScript Vite React single-page application using file-based TanStack Router, normal paths, and a hosting rewrite. It does not use React Router or TanStack Start.
- Routes cover Login, Review, active Review Session, Cards, individual Card detail, and Me.
- TanStack Query owns server state. Card and statistics data remain fresh for 30 seconds, without polling; stale data refreshes on focus, reconnect, or relevant invalidation while visible data remains in place.
- Shared Zod contracts are the runtime source of truth for API input and output, with inferred TypeScript types where practical.
- The client retries temporary Session, Card-read, and statistics-read failures twice; Card mutations never auto-retry; Grades use their dedicated three-retry policy; Khunhphap never auto-retries. Other 4xx responses are not auto-retried.
- Only an already-open application offers limited offline behavior. Cached Cards remain readable/searchable and queued Grades are best-effort in-memory work. Offline startup, refresh, durable mutation persistence, and guaranteed offline delivery are unsupported.
- Card mutations, Login, Logout, and Khunhphap are disabled offline with an explanation. Connectivity status distinguishes offline with and without pending Grades, reconnecting/syncing, briefly saved, and failed/manual-retry states.
- On an authentication 401, the client cancels requests and Khunhphap streaming, clears query, offline, and memory state including the Review queue, then redirects to Login with the settled expiry message. A new Login begins at normal Review.
- Initial authentication uses a full-screen static mascot and loading message. Authenticated content skeletons appear only after 200 ms; background refresh never replaces existing content. Initial failures retain the shell and offer retry; stale-data failures retain data and show a nonblocking banner.

### API, data, and errors

- The backend is a small same-origin JSON REST API plus the POST streaming Khunhphap endpoint. It uses direct Vercel Web Request/Response handlers with shared helpers, not Express or Hono.
- Session operations provide authentication status, password login with cookie creation, and current-Session logout.
- Card operations list all active Cards, create a Card, fetch an active Card, partially update it, and soft-delete it.
- Review creation accepts the idempotent Grade payload and returns the resulting Review and Card.
- Statistics are returned directly in the exact settled shape. There is no Review history, queue, or Review Session endpoint.
- Successful JSON responses return resources directly without a data envelope. UTC timestamps use RFC 3339 with `Z`; Berlin dates use `YYYY-MM-DD`.
- Built-in browser and Node cryptography generate UUID v4 identifiers. Review IDs are client-generated; Card and error occurrence IDs are server-generated. No UUID dependency is added.
- The five application tables are Cards, Reviews, Sessions, temporary login attempts, and temporary AI usage. There are no user, Points, Review Session, chat, language, collection, or settings tables.
- The database enforces active-front uniqueness, Card text length, Box, Grade, Points, timezone-aware timestamp, and Review/Card referential invariants. Permanent Card deletion is restricted.
- Expired or obsolete temporary rows are cleaned opportunistically during related requests; there is no cleanup cron.
- Errors use RFC 9457 `application/problem+json`. Each problem has a stable relative type and a unique UUID occurrence instance correlated with the request ID. Validation errors expose safe pointer/code entries and never raw validation internals.
- The API distinguishes unreadable input, unauthenticated requests, invalid origin, missing resources, conflicts, oversized bodies, unsupported content types, semantic validation, rate limits, and unexpected/dependency failures using the settled HTTP status mapping.
- JSON request bodies are capped at 32 KiB and body endpoints require `application/json`. Rate-limit responses include an integer-seconds `Retry-After` and stable problem types.

### Authentication, security, and privacy

- The app uses one shared household password and server-side opaque Sessions. There is no signup, password reset, password-change screen, role system, or Session-management interface.
- The configured password is stored only as a versioned scrypt hash. Verification uses Node's asynchronous built-in scrypt with the accepted OWASP baseline parameters, an explicit memory allowance, a random salt, and timing-safe comparison.
- Password input accepts exactly 6–128 characters, including Unicode and spaces, without trimming, normalization, or truncation. It supports paste and password-manager autofill and is never logged or returned. Login does not disclose the numeric requirement and uses the generic wrong-password response for out-of-range input.
- A Session identifier uses 32 cryptographically random bytes. Only its SHA-256 hash is stored; the raw value exists only in the secure `__Host-session` cookie.
- Sessions expire after a fixed 30 days without sliding renewal. The cookie is HttpOnly, Secure, SameSite Strict, scoped to the root path, and has matching maximum age.
- Logout deletes the current Session before clearing the cookie. Logout and expiry clear private client state and send `Clear-Site-Data` for cache, cookies, and storage. Password-compromise recovery rotates the configured hash and deletes all Sessions manually.
- Failed logins are limited to 10 per IP in a rolling 15-minute window using shared database storage keyed by a server-secret HMAC of the IP. Success clears that IP's failures. Raw IP addresses are not stored or logged.
- The API is same-origin and sends no CORS allowances. Every unsafe request, including Login, rejects cross-site Fetch Metadata and requires an exact Origin match. Safe GET requests never mutate state. No separate CSRF token is used.
- Protected assets include Card and Review data, the password and Sessions, database credentials, and OpenAI spend. Card/message prompt injection, oversized requests, Grade replay/tampering, brute force, cross-site mutation, secret leakage, and AI cost abuse are explicit threat cases.
- Preview and production apply the settled Content Security Policy, security headers, and cache policy. The policy blocks inline style attributes, external runtime fonts, framing, object content, unneeded permissions, and the hosting preview toolbar. HTTPS and HSTS are hosting responsibilities.
- Real environment files are ignored. Only empty configuration placeholders are committed. Development, preview, and production secrets are separate; server secrets never use client-exposed naming. Configuration validation never prints secret values.
- Logs never include passwords, Session data, credentials, Card content, or Khunhphap content. Structured request logs contain a random request ID, route, status, duration, and safe error category. Provider logs contain only timing, status, and token usage.

### Visual design, interaction, and accessibility

- Styling uses project-owned plain CSS custom-property tokens, a small targeted reset/base, and per-component CSS Modules. It does not use Tailwind, Sass, CSS-in-JS, a component library, or a third-party reset.
- Global CSS layers are reset, theme, and base; component modules remain unlayered. Global/local escapes and composition are avoided unless a narrow need is documented.
- The visual system is light-only with the accepted blue primary palette, semantic success/warning/danger colors, spacing, radii, shadows, type scale, motion durations, easing curves, layer order, focus ring, border, and icon-size tokens from the design decision source.
- Be Vietnam Pro is the UI typeface and Baloo 2 the display typeface. Production self-hosts WOFF2 assets and retains complete SIL Open Font License provenance and notices.
- Below 48rem the app uses the viewport; at and above 48rem it centers a 30rem column without a shadow. It supports dynamic viewport height and safe-area insets on all edges.
- Controls have at least 44px targets, with prominent actions at 56px. Focus uses a high-visibility `:focus-visible` ring and forced-colors adaptation.
- Native dialogs implement sheets. Detail and Khunhphap sheets support close control, backdrop, and Escape. The editor supports controls and Escape plus dirty-state confirmation. Sheets are not draggable and have no drag handle.
- The app supports keyboard use, screen readers, forced colors, 200% text resize, reduced motion, and system safe areas. Core support targets Baseline Widely Available plus current and previous Chrome, Firefox, desktop Safari, and iOS Safari.
- Main tab content changes immediately; only active-tab color transitions. Buttons use a subtle press scale unless disabled or reduced motion is active.
- Answer reveal uses the accepted 250 ms Card flip, blocks repeated reveal input until complete, and then fades in Grade controls. Reduced motion uses a short crossfade.
- Grade advancement uses one consistent shared-axis transition, independent of Grade. A nonblocking Points chip travels toward the header while the total updates immediately; reduced motion omits the chip and announces the number change.
- The first completed round alone receives one short nonblocking confetti burst. Summary appearance is a fade. Reduced motion removes confetti and spatial transitions.
- Sheets, informational toasts, persistent retry states, connectivity banners, progress, Login success, wrong-password feedback, and loading skeletons follow the settled timing and reduced-motion behavior.
- Khunhphap thinking appears only after 300 ms without response text and disappears on the first delta. Streaming has no typewriter animation. Automatic scroll-follow occurs only while the Learner is near the bottom; a latest-message action is the only smooth scrolling in the app.
- Card search/create/edit/delete/list changes have no row or layout animation. There is no global smooth scrolling, automatic Points/star pulse, tab bounce, page transition, scheduling flash, Grade-specific fly-off, or global near-zero animation override.

### Platform, delivery, and operations

- The application uses npm with a committed lockfile, clean installs in automation, Node 24.x in project metadata, strict TypeScript, named inline exports, and repository naming conventions.
- Backend runtime is Vercel Node Functions on the free Hobby plan. Persistence is Neon PostgreSQL 17 through Drizzle and `pg`, using a pooled runtime URL and a direct migration URL.
- Each warm function instance uses one pool with at most two connections, a 10-second connection timeout, and a 30-second idle timeout.
- Drizzle migrations are generated, committed, and reviewed. Shared and production schemas use migrations, never schema push.
- Local development uses Docker PostgreSQL 17. Preview uses separate nonproduction Neon data and secrets. Production uses production data and secrets. There is no permanent staging environment.
- One GitHub Actions workflow runs on pull requests and the main branch, cancels superseded runs, installs cleanly, and checks formatting, linting, styles, types, unit/frontend behavior, isolated database migrations/integration behavior, the production build, and critical browser journeys. OpenAI is always mocked.
- Releases are human-enforced: feature branch, green pull-request checks, backward-compatible production migration with validated encrypted backup when needed, merge to main, then automatic hosting deployment. Branch protection and hosting Deployment Checks are intentionally absent for V1.
- Application rollback uses the hosting provider's last known-good deployment followed by a reviewed correction. Database migrations are not rolled back automatically and must remain compatible with both deployed application versions.
- Weekly automation produces a validated PostgreSQL 17 custom-format dump using read-only credentials, encrypts it with a pinned and checksummed `age` binary, and keeps roughly four encrypted artifacts. The private identity never enters automation.
- Production migration tooling verifies the target, creates and validates a local encrypted backup outside the repository, and aborts before migration if backup fails. Restore into disposable PostgreSQL 17 must be exercised before launch and after backup changes.
- Direct dependencies are added only when the platform cannot safely provide the capability. Release checks include dependency audit and license-policy review. Unresolved high/critical production vulnerabilities and unknown or unapproved licenses block release.

## Testing Decisions

- A good test asserts externally visible behavior at the highest practical seam: what the Learner sees and can do, the HTTP contract a client receives, or the durable database state after an operation. Tests must not depend on component internals, private helper calls, CSS implementation details, ORM query shape, or provider implementation details.
- The primary acceptance seam is the complete application through browser-visible behavior, exercising the React interface, same-origin API, and real PostgreSQL 17 database together. OpenAI is mocked at the provider boundary so tests remain deterministic, private, and free of real provider calls.
- Critical end-to-end journeys cover initial Session checking, Login success/failure/rate limiting, navigation, Card creation/editing/search/deletion, normal and early Review Sessions, reveal and each Grade, idempotent Grade retry behavior, offline/pending feedback, repeat-forgotten rounds, summary, Me statistics, Khunhphap streaming/errors/limits, expiry cleanup, and Logout.
- Critical end-to-end tests run in current Playwright Chromium, Firefox, and WebKit. A separate Edge run is unnecessary.
- Stable visual regression covers Login; Review front, back, and summary states; Cards and editor; Me; and Khunhphap at one representative mobile viewport and 768px. It captures settled states, not animation frames.
- Accessibility checks use automated browser scanning plus semantic behavior assertions for names, roles, focus trapping/restoration, announcements, error association, and keyboard flows. Manual release checks cover keyboard-only use, 200% text resize, forced colors, a screen reader, and reduced motion.
- Frontend integration tests use React Testing Library, user-event, and MSW to exercise behavior through rendered screens and network contracts. They cover loading delays, retained stale content, validation, dirty-editor confirmation, fixed queues, retry states, 401 cleanup, offline restrictions, reduced-motion alternatives, and Khunhphap scrolling without inspecting hook or component internals.
- Shared contract tests prove that client and server agree on successful resource shapes, Grade values, timestamps, Berlin dates, problem details, safe validation pointers/codes, content-type enforcement, body limits, and every settled status class.
- Direct API integration tests use real PostgreSQL for authentication, origin enforcement, Card normalization and uniqueness, CRUD/soft deletion, Grade transactions and idempotency, deleted-Card conflicts, statistics, login and Khunhphap rate limits, cleanup, cache headers, security headers, and request-ID correlation.
- Database tests apply committed migrations to an isolated PostgreSQL 17 database, clear all five application tables between cases, and serialize tests that write shared database state. They assert constraints and durable outcomes rather than generated SQL.
- PostgreSQL scheduling tests explicitly cover target local midnight across both Europe/Berlin daylight-saving transitions, Monday week boundaries, day aggregation, best-day tie breaking, today/yesterday recap selection, and accepted/rejected `reviewedAt` boundaries.
- Pure unit tests cover Card normalization, Box transitions, interval lookup, Point mapping, date-input validation, Zod contracts, password-hash encoding/verification, Session identifier hashing, origin checks, retry classification, and rate-limit calculations. Pure tests are used where the outcome is fully defined without browser or database behavior.
- Concurrency tests prove the Card row lock and transaction prevent inconsistent simultaneous Grade writes, exact UUID replay has one effect, mismatched UUID reuse has no second effect, and Review/Card updates cannot partially commit.
- Khunhphap tests mock the provider interface and cover minimized context, prompt-injection separation, German teaching instructions, model configuration, `store: false`, no tools, token cap, streaming event parsing, truncation, abort, timeout, disconnect accounting, and each rate-limit response. No automated test contacts OpenAI.
- Security tests cover password length without normalization, timing-safe verification behavior at the public seam, opaque cookie attributes, fixed expiry, immediate logout revocation, cross-site and bad-Origin rejection, no CORS, 32 KiB limits, safe problem output, CSP/header presence, secret/config failure behavior, and absence of sensitive content in captured logs.
- Offline tests acknowledge V1's best-effort boundary: they verify in-memory pause/resume while the app stays open and do not promise persistence across reload, tab closure, browser eviction, or offline startup.
- Operational checks validate clean install, formatting, ESLint with type awareness and React/accessibility rules, Stylelint, strict type checking, unit/frontend tests, database migration/integration tests, production build, browser tests, dependency audit, license review, encrypted backup validation, and disposable restore.
- There is no existing application test suite to reuse because implementation has not begun. The accepted ADRs, domain glossary, canonical decision source, and visual prototype provide behavior and design precedent; the prototype's demo data, stale copy, 12-Card queue, and prototype-only interactions are explicitly not test expectations.

## Out of Scope

- Multiple Learners, user accounts, profiles, roles, invitations, signup, password reset, password change, Session management, or independent simultaneous Review Sessions.
- Native mobile or desktop apps, PWA installation, service workers, offline startup, durable offline Grade storage, guaranteed background sync, or full offline Card mutation.
- Card decks, sets, collections, tags, folders, language fields, owners, filtering by language, persisted examples, sources, notes, pronunciation, attachments, images, audio, or import/export.
- Typed answers, spelling evaluation, fuzzy answer matching, multiple choice, AI grading, automatic Card generation, AI translation, or Khunhphap Card mutations.
- Review history screens, Grade undo/correction/deletion, progress reset on edit, Card restore, deletion undo, permanent data purge, or draft/autosave support.
- Persisted Review Sessions, server-generated Review queues, queue endpoints, queue changes during an active Session, or more than ten Cards per round.
- A stored Points counter, achievements beyond the settled Points/summary feedback, leaderboards, social features, reminders, notifications, streaks, or proactive alerts.
- General-purpose Khunhphap chat, chats spanning Cards, persisted chat history, Markdown/rich output, linkification, tools, web search, code execution, files, database access, automatic retry, or pre-reveal hints.
- Additional UI locales, learner-selectable locale or timezone, dark mode, custom themes, runtime Google Fonts, third-party component systems, or broad animation beyond the settled behaviors.
- Review history analytics, charts, arbitrary date-range reports, Card-level statistics, or statistics beyond total Points, active Cards, current-week Reviews, best day, and daily recap.
- Pagination, server-side search, fuzzy search, stemming, diacritic-insensitive search, or a dedicated search dependency.
- Edge Functions, Express, Hono, React Router, TanStack Start, non-PostgreSQL persistence, automatic production migrations, permanent staging, GitHub branch protection, Vercel Deployment Checks, Sentry, external logging services, CSP reporting, or Dependabot.
- Automatic database rollback, destructive migration patterns in a single release, unencrypted backups, or storage of backup decryption identities in GitHub or the app runtime.

## Further Notes

- The design interview is complete. This spec synthesizes its settled product, architecture, security, UI, accessibility, and operational decisions and should not be treated as an invitation to reopen them during implementation.
- The accepted ADRs remain authoritative for rationale and operational detail. If implementation requires contradicting one, write a superseding decision rather than silently diverging.
- The existing HTML prototype is a visual reference only. Its English demo copy, mocked data, 12-Card queue, Google Fonts loading, and prototype-only interactions do not override this spec.
- Superseded ideas include bcrypt, Argon2, stateless signed cookies, JWTs, four application tables, a 400-token Khunhphap cap, runtime Google Fonts, 12-Card Review Sessions, draggable sheets, bouncing tabs, Grade-specific fly-offs, next-due flash messages, star bursts, and hosting Deployment Checks.
- The repository is still pre-implementation. This specification changes no application code and creates no commit.
