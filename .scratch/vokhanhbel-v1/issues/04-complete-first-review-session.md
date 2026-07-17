# 04 — Complete a first Review Session

**What to build:** Khanh can start with Due Cards, reveal each answer, choose a Grade, receive Points and a new Due date, advance through a fixed queue, and finish at a meaningful summary.

**Blocked by:** 02 — Create and find Cards.

**Status:** done

- [x] Review shows the number of Due active Cards and offers Card creation when none exist.
- [x] Starting Review snapshots up to ten Due Cards into a client-only queue; a Card created or refreshed afterward cannot enter that active queue.
- [x] The queue selects longest-overdue Cards first and leaves additional Due Cards available for another Review Session.
- [x] A direct Review Session URL without in-memory queue state redirects safely to Review.
- [x] Each Card initially shows only its front; Khanh deliberately reveals the back before Grade controls become available.
- [x] Long front/back content stays at the settled 3xl/2xl sizes, centers when short, and becomes top-aligned and internally scrollable when needed rather than shrinking.
- [x] Khanh can Grade the revealed Card as `forgot`, `almost`, or `knew_it`, awarding exactly 1, 5, or 10 Points.
- [x] Recording a Grade appends a Review and updates the Card atomically; the server, never the client, determines Points, Box, and due time.
- [x] `forgot` moves to Box 0, `almost` keeps the Box, and `knew_it` advances one Box up to 5, using 1/3/7/14/30/90 Berlin calendar-day intervals.
- [x] Box transitions and interval lookup are pure TypeScript, while PostgreSQL calculates the Europe/Berlin target midnight inside the Grade transaction.
- [x] The active Card advances promptly after Grade, visible session Points update, and Card/statistics queries invalidate without changing the fixed queue.
- [x] Completing the queue shows a cumulative Review/Points summary with Finish available; closing early keeps saved Grades and shows no partial summary.
- [x] Review reveal, Grade controls, progress, queue navigation, close action, and summary work by keyboard and screen reader, at supported sizes, and with an initial reduced-motion alternative.
- [x] Tests complete the core journey through browser, API, and real PostgreSQL and separately cover pure Box/Points logic, Berlin scheduling, atomic writes, and deleted-Card exclusion.

## Comments

Implemented and reviewed in the V1 batch. Evidence includes scheduling/Points tests, rendered and
Playwright Review journeys, atomic PostgreSQL Review coverage, and all local quality gates passing
on 2026-07-14.
