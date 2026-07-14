# ADR-002: Use Shared-Password Session Auth

## Status

Accepted

## Date

2026-07-11

## Context

V1 is a private household app with Khanh as its only Learner. The developer may also access the app, but the product does not distinguish who is operating it: all Cards, Reviews, scheduling, and Points represent Khanh's learning. It needs protection because the app stores private learning data and exposes server-side AI endpoints with real cost. It does not need public signup, profiles, password reset, invitations, roles, or simultaneous independent Review Sessions.

## Decision

Use a single shared household password verified on the server. On successful login, create a server-side Session and set a secure HTTP-only cookie containing its opaque identifier.

The password is stored only as an encoded scrypt hash in `APP_PASSWORD_HASH`; there is no plaintext password environment variable or password-change screen. Use Node's built-in asynchronous `crypto.scrypt` implementation with OWASP's baseline parameters (`N=2^17`, `r=8`, `p=1`), a random 16-byte salt, a 32-byte derived key, and a sufficient explicit `maxmem` setting. Store the algorithm, parameters, salt, and derived key in a versioned encoded string, and compare derived keys with `crypto.timingSafeEqual`. This avoids a password-hashing dependency while retaining a modern memory-hard algorithm.

The configured shared password must be 16–128 characters. Accept spaces and Unicode, preserve the submitted value exactly without trimming, normalization, or truncation, and allow paste and password-manager autofill. Reject inputs outside the length bound before invoking scrypt, and never include submitted passwords in logs or error details. V1 needs no composition rules or client-side strength meter because the password is configured by the operator rather than chosen through a public signup flow.

Generate each Session identifier from 32 cryptographically random bytes, put only the raw identifier in the cookie, and store only its SHA-256 hash in the database. The Session record contains the identifier hash, creation time, and expiry time.

Sessions have a fixed 30-day expiry enforced both by the cookie `Max-Age` and by the server-side record; ordinary API use does not extend them. The cookie is named `__Host-session` and is `HttpOnly`, `SameSite=Strict`, `Path=/`, and `Secure`. Logout deletes the Session record before clearing the cookie, so that browser's identifier immediately stops working. Expired records are removed opportunistically during related requests. There is no `users` table, ownership field, or multi-Learner concurrency model in V1.

Allow multiple active Sessions so the household can use the app on more than
one device. Normal logout revokes only the current browser's Session. If the
shared password is compromised, replace `APP_PASSWORD_HASH` and delete every
Session record as one recovery procedure, forcing every device to authenticate
again. V1 has no Session-management or "log out all devices" screen.

Successful logout and detection of an expired Session clear private browser state completely: delete the server-side Session, expire the cookie, clear the client query cache and offline storage, discard in-memory Review Session state, and send `Clear-Site-Data: "cache", "cookies", "storage"` as a browser-level safety net. The next login may redownload static assets.

Keep the browser API same-origin and do not send CORS allow headers. For every state-changing request, including login, reject `Sec-Fetch-Site: cross-site` and require the `Origin` header to match the request's target origin. Endpoints with request bodies accept only `application/json`, and safe methods such as `GET` never change state. These checks provide CSRF protection without a separate CSRF token.

Throttle failed login attempts in shared database-backed storage: allow at most 10 failures per IP address in a rolling 15-minute window, return HTTP `429` while blocked, and clear that IP's failures after a successful login. Key records by a server-secret HMAC of the IP rather than storing the raw address. Do not use function memory for throttling because Vercel Functions are stateless.

## Alternatives Considered

### No Auth Or Client-Side Gate

- Pros: simplest to build.
- Cons: does not protect API routes or AI costs; anyone with the URL could use the app.
- Rejected because the deployed app needs real server-side protection.

### Full User Accounts

- Pros: supports multiple users, roles, invitations, and user-specific progress.
- Cons: adds product and implementation surface before V1 needs it.
- Rejected because V1 is private and single-household.

### Supabase/Firebase Auth

- Pros: mature auth flows and future account support.
- Cons: unnecessary for shared-password V1; adds provider coupling and account UX.
- Rejected because a secure session cookie is sufficient for the current scope.

### Stateless Signed Cookie Or JWT

- Pros: avoids a database lookup on protected requests and needs no Session table.
- Cons: a copied token remains usable after logout until it expires unless the server also maintains a revocation list.
- Rejected because the app already depends on PostgreSQL and immediate server-side invalidation is worth one small lookup per protected request.

### Bcrypt Or A Third-Party Argon2 Package

- Pros: both are established password-hashing approaches; Argon2id is OWASP's first recommendation for new systems.
- Cons: Node does not provide stable built-in bcrypt, and Node 24's built-in Argon2 API is not yet stable; production-ready choices therefore add a native or JavaScript dependency. Bcrypt also has a 72-byte input limit and is not memory-hard.
- Rejected because built-in scrypt is an OWASP-recommended memory-hard alternative with no additional dependency or native package supply chain.

## Consequences

- There is no `users` table in V1.
- A Session table and cleanup path are required in addition to the previously planned tables.
- Every protected API route must hash the presented identifier and verify the matching unexpired Session record.
- Logout can immediately revoke the current browser's Session.
- Emergency password rotation includes a manual database operation to revoke
  all existing Sessions.
- The shared password must never be stored in plaintext or sent back to the client.
- Supporting multiple Learners or simultaneous independent Review Sessions later requires real accounts, a new ADR, and a migration plan that assigns existing data to Khanh.
- Login throttling adds a small database table and cleanup path; raw IP values must not be stored or appear in application logs.
