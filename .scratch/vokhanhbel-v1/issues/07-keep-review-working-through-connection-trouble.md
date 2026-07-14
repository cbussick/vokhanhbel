# 07 — Keep Review working through connection trouble

**What to build:** Khanh can continue a Review through short connection failures while always seeing which Grades are saved, pending, syncing, rejected, or require her attention.

**Blocked by:** 05 — Repeat forgotten Cards and study ahead; 06 — Make Grade recording replay-safe.

**Status:** ready-for-agent

- [ ] Grade feedback and session Points update immediately without delaying Card advancement, while server state remains authoritative.
- [ ] Temporary Grade failures retry the identical UUID three times after approximately 1, 2, and 4 seconds.
- [ ] After automatic retries fail, a persistent unsaved state shows the pending count and manual retry while allowing the Review Session to continue.
- [ ] An already-open app can queue Grades in memory while offline and resume them on reconnect using their original UUIDs.
- [ ] The app clearly states that pending offline Grades require it to remain open; reload, tab closure, browser eviction, offline startup, and durable background delivery are not promised.
- [ ] Connectivity feedback distinguishes offline without pending work, offline with a count, reconnecting/syncing, briefly all saved, and failed/manual-retry states.
- [ ] A pending Grade that becomes older than seven days stops retrying, reverses its Points/outcome, explains the expiry, and moves the Card to the queue end for regrading.
- [ ] Definitive clock, deleted-Card, and replay-conflict failures stop inappropriate retry and apply their settled recovery behavior.
- [ ] Logout with pending Grades presents count-specific confirmation, and best-effort leave-page protection is active only while Grades remain pending.
- [ ] Informational saved feedback dismisses after the settled interval; problems persist until resolved.
- [ ] Connectivity and pending states are screen-reader announced without noise, remain visible at supported sizes, support keyboard retry, and use non-spatial reduced-motion behavior.
- [ ] Tests simulate offline/reconnect and temporary/permanent failures through public network seams, prove UUID reuse and state reversal, and explicitly verify that persistence across reload is unsupported.

