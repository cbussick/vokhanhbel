# 01 — Unlock the secure app shell

**What to build:** A deployable walking skeleton that lets Khanh authenticate with the shared household password, enter the German application shell, move among its primary areas, and log out safely. This slice establishes the smallest real browser-to-API-to-PostgreSQL path and the conventions later slices extend.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] A clean npm install on Node 24 can develop, type-check, test, and build the strict-TypeScript Vite React application and Vercel Node API.
- [x] File-based TanStack Router exposes Login and the authenticated Review, Cards, and Me areas using normal browser paths and a production SPA rewrite.
- [x] TanStack Query owns server state, shared Zod contracts validate public request/response shapes, and German translation keys provide all visible copy.
- [x] PostgreSQL 17 migrations create the Session and temporary login-attempt storage needed by this slice and can be applied to a clean local database.
- [x] The configured 6–128-character password is verified exactly as submitted using the accepted built-in asynchronous scrypt format and timing-safe comparison, without logging or returning it; Login does not disclose the numeric requirement.
- [x] Successful Login creates a 30-day, non-sliding, server-side Session, stores only a hash of its cryptographically random identifier, and sends the raw identifier only in the correctly attributed secure host cookie.
- [x] Multiple devices can hold Sessions; Logout revokes only the current Session before clearing browser state, the cookie, and site data.
- [x] The initial Session check shows the static mascot and German loading copy without flashing Login; an authenticated Learner reaches the shell and an unauthenticated Learner reaches Login.
- [x] Wrong-password, network, offline, and throttled Login states follow the settled focus, retention, countdown, and German-copy behavior.
- [x] Failed Logins are limited to 10 per HMAC-pseudonymized IP in a rolling 15-minute window using database state, and a successful Login clears that IP's failures.
- [x] Unsafe Session requests enforce exact same-origin checks, body endpoints require bounded JSON, and failures use safe problem responses with correlated request IDs.
- [x] The shell has baseline light-theme tokens, self-owned reset/base styles, CSS Modules, minimum target sizes, visible keyboard focus, safe-area handling, and a usable phone and centered desktop layout.
- [x] Automated tests prove the Login/Session/Logout path through rendered UI, API behavior, and real PostgreSQL without asserting private implementation details.
- [x] The app builds without inline style attributes or external runtime resources that would violate the settled production Content Security Policy.

## Comments

Implemented and reviewed in the V1 batch. Evidence includes rendered Login/Session journeys,
authentication and request-boundary tests, the real PostgreSQL HTTP-stack integration test, and all
local quality gates passing on 2026-07-14.
