# 11 — Handle loading, stale data, and expired Sessions

**What to build:** The app remains understandable during startup, refresh, transient read failures, authentication expiry, and Logout, without flashing private state or discarding pending work silently.

**Blocked by:** 07 — Keep Review working through connection trouble; 10 — Make Khunhphap reliable and cost-bounded.

**Status:** done

- [x] The initial Session check uses the full-screen static mascot/loading state and never flashes Login or authenticated content incorrectly.
- [x] Authenticated first loads retain the header/tab shell and add content skeletons only after 200 ms; reduced-motion skeletons remain static.
- [x] Background refresh keeps existing Card/statistics content visible and never substitutes skeletons.
- [x] Initial read failure retains the shell, shows the settled German failure and retry action, and applies the two-temporary-retry policy.
- [x] A background failure with stale data retains that data and shows a nonblocking warning.
- [x] Session, Card reads, and statistics retry only temporary failures twice; Card writes never auto-retry; Grades and Khunhphap retain their dedicated policies; other 4xx responses never auto-retry.
- [x] Any protected-request 401 cancels reads and Khunhphap streaming, clears private query/offline/memory state and the Review queue, and redirects to Login with the settled expiry copy.
- [x] Login after expiry always returns to normal Review rather than reconstructing an interrupted route, editor, Khunhphap, or Review Session.
- [x] Logout revokes the current server Session, expires its cookie, clears all private client state, and uses browser-level site-data clearing; pending Grades use Ticket 07's warning before this occurs.
- [x] Login success transitions into the authenticated shell without revealing stale private state.
- [x] Loading, error, retry, expiry, and Logout feedback have correct focus/status announcements, work by keyboard and screen reader, fit supported screens, and remain clear without motion.
- [x] Tests exercise delayed loading, refresh, stale failure, retry classification, 401 during reads/Grade/Khunhphap, full cleanup, post-expiry Login destination, and Logout through observable UI/cache/server outcomes.

## Comments

Implemented and reviewed in the V1 batch. Evidence includes rendered loading, stale-data, retry,
Khunhphap 401, shared Session-expiry, and cleanup journeys passing on 2026-07-14.
