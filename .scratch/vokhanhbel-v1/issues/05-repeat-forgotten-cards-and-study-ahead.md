# 05 — Repeat forgotten Cards and study ahead

**What to build:** Khanh can choose useful extra practice when nothing is Due and can repeat only the Cards forgotten in the latest completed round until she is satisfied.

**Blocked by:** 04 — Complete a first Review Session.

**Status:** ready-for-agent

- [ ] The single Review Session size constant is 10 everywhere; no stale 12-Card behavior remains.
- [ ] Review anyway appears only when no active Card is Due and snapshots the ten Cards due soonest.
- [ ] An early Review is an ordinary Review whose Points, Box transition, statistics, and scheduling use that Review's captured date.
- [ ] Every completed round adds to one cumulative Review Session summary, so Review count can exceed unique Card count.
- [ ] The summary offers the settled repeat-forgotten action only when the latest round contains `forgot` Cards.
- [ ] Repeating snapshots those forgotten Cards into the next round; every repeat Grade creates a normal Review and can itself become eligible for another repeat.
- [ ] Khanh can repeat until the latest round has no forgotten Cards and can choose Finish from every summary.
- [ ] Only the first completed round is eligible for the settled nonblocking celebration; repeat rounds do not retrigger it.
- [ ] Closing an active or repeat round early preserves confirmed Grades, leaves current/remaining Cards unchanged, and does not show a partial summary.
- [ ] Queue, early-Review, repeat, Finish, and close states remain keyboard/screen-reader accessible, responsive, and understandable without animation.
- [ ] Tests cover zero-Due eligibility, due-soonest ordering, the ten-Card cap, early scheduling, multiple repeat rounds, cumulative totals, optional Finish, first-round-only celebration state, and early closing.

