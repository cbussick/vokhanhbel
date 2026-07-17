# 06 — Make Grade recording replay-safe

**What to build:** Every confirmed Grade has exactly one durable effect even when requests are repeated, overlap across devices, arrive late, or target a Card deleted elsewhere.

**Blocked by:** 03 — Edit and remove Cards safely; 04 — Complete a first Review Session.

**Status:** done

- [x] Each Grade uses a browser-generated UUID, Card ID, Grade, and browser-captured `reviewedAt`; server receipt is stored separately as `recordedAt`.
- [x] Review insertion and Card update run in one READ COMMITTED transaction after locking the Card row for update.
- [x] Exact UUID replay returns the original Review and resulting Card with no duplicate Review, Points, or schedule change.
- [x] Reusing a UUID with different payload returns the stable reload-required conflict, leaves the original Review unchanged, ends the active Review Session, and displays its correlated request ID.
- [x] Concurrent distinct Grades serialize against current Card state and each stored Review accurately records Box before/after.
- [x] `reviewedAt` is accepted up to seven days old and five minutes in the future, inclusive at the settled boundaries; scheduling/statistics use it.
- [x] A definitively too-old Grade is not stored and can be returned to the queue end for explicit regrading without retaining optimistic Points.
- [x] A Grade from a device more than five minutes ahead is not stored, reverses optimistic feedback, pauses Review, and explains that the device clock must be corrected.
- [x] A Grade targeting a Card soft-deleted elsewhere is not stored, removes that Card from the active queue, reverses optimistic feedback, shows a brief message, and lets Review continue.
- [x] There is no Grade undo, correction, deletion, or mutation endpoint.
- [x] Conflict and recovery states are announced accessibly, preserve useful context, remain usable on mobile, and do not rely on animation alone.
- [x] Real PostgreSQL tests prove atomicity, row-lock concurrency, exact replay, mismatched replay, timestamp boundaries, soft-delete races, and no partial effects.

## Comments

Implemented and reviewed in the V1 batch. Evidence includes UUID advisory locking, immutable stored
result Cards, and real PostgreSQL replay, concurrency, timestamp, and soft-delete tests passing on
2026-07-14.
