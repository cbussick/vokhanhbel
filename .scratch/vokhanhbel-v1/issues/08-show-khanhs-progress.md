# 08 — Show Khanh's progress

**What to build:** Khanh can open Me and see a trustworthy, friendly summary of her accumulated Points, active learning material, current week, best day, and most recent daily recap.

**Blocked by:** 03 — Edit and remove Cards safely; 04 — Complete a first Review Session.

**Status:** done

- [x] The statistics API returns exactly total Points, active Card count, Reviews this week, nullable best day, and nullable daily recap in the settled shapes.
- [x] Total Points are derived from the append-only Review log and are never stored as a counter.
- [x] Reviews and Points belonging to soft-deleted Cards remain included, while active Card count excludes deleted Cards.
- [x] Reviews this week begins Monday at 00:00 Europe/Berlin.
- [x] Best day uses the all-time highest Berlin-calendar-day Review count and resolves ties in favor of the most recent date.
- [x] Daily recap shows today when present, otherwise yesterday when present, otherwise remains absent; all Grades count as Reviews and only `knew_it` contributes to its known count.
- [x] UTC timestamps and Berlin dates use their settled wire formats; PostgreSQL owns Berlin aggregation and browser `Intl` is display-only.
- [x] The empty Me state shows zero totals, the settled no-best-day copy, and no recap.
- [x] Statistics remain fresh for 30 seconds without polling, refresh after relevant Grade/Card actions, and keep visible data during background refresh.
- [x] Me is semantically structured, readable by screen reader, usable at 200% text and all supported widths, and does not communicate meaning through decoration alone.
- [x] Tests cover empty and populated states, deletion retention, Point sums, Monday boundaries, both Berlin daylight-saving changes, best-day ties, recap fallback, response shape, and rendered accessibility.

## Comments

Implemented and reviewed in the V1 batch. Evidence includes PostgreSQL statistics/date-boundary
coverage, rendered Me journeys, and all local quality gates passing on 2026-07-14.
