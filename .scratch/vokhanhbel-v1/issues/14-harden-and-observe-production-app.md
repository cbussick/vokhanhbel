# 14 — Harden and observe the production app

**What to build:** Every completed browser/API path receives one consistent production security, privacy, caching, error, and diagnostic envelope without leaking Khanh's content or operational secrets.

**Blocked by:** 03 — Edit and remove Cards safely; 08 — Show Khanh's progress; 10 — Make Khunpap reliable and cost-bounded; 11 — Handle loading, stale data, and expired Sessions.

**Status:** ready-for-agent

- [ ] Every API error uses RFC 9457 problem JSON with a stable relative type, unique UUID instance correlated with `X-Request-ID`, safe title/status, and no raw validation or dependency internals.
- [ ] Status behavior consistently distinguishes unreadable, unauthenticated, invalid-origin, missing, conflict, oversized, wrong-content-type, invalid, rate-limited, and unexpected/dependency cases.
- [ ] JSON bodies are capped at 32 KiB, body endpoints require `application/json`, and 429 responses include integer-seconds `Retry-After` with distinct stable limit types.
- [ ] All unsafe routes—including Login—reject cross-site Fetch Metadata and require exact Origin; safe GET routes never mutate and no CORS allowances or CSRF token are added.
- [ ] Preview/production apply the settled restrictive Content Security Policy without inline style exceptions, external runtime fonts, reporting, or hosting toolbar allowances.
- [ ] Responses include the settled content-type, referrer, frame, and permissions protections; unused camera, microphone, location, payment, and USB capabilities are disabled.
- [ ] Session/Login, mutation, tutor, error, Card/statistics read, HTML, hashed-asset, and non-versioned-asset responses each receive their settled cache policy.
- [ ] Environment loading validates all required server configuration without exposing values, client-exposed prefixes are absent from secrets, and only empty documented placeholders are suitable for version control.
- [ ] Structured logs contain request ID, route, status, duration, and safe error category; provider logs add only timing/status/token usage.
- [ ] Passwords, Session identifiers/hashes, keys, raw IPs, Card content, tutor content, database URLs, and environment values are absent from normal/error logs and tracing payloads.
- [ ] Temporary expired Session, Login-attempt, and AI-usage records are cleaned opportunistically during related requests without a cron.
- [ ] Security behavior remains compatible with accessible errors and the full responsive UI; hardening does not break Login, dialogs, streaming, fonts, or SPA navigation.
- [ ] Tests exercise every route family for origin, type/size, status/problem, header/cache, request-ID, cleanup, and log-redaction behavior, including unexpected dependency failures.

