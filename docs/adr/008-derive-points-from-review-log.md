# ADR-008: Derive Points From The Review Log

## Status

Accepted

## Date

2026-07-12

## Context

The app awards points on every graded review (`forgot` +1, `almost` +5, `knew_it` +10) and displays a running total in three places (Review tab header, session header, Me tab). The obvious implementation is a stored counter column that increments on each grade.

## Decision

Never store points as a running counter. The total is always computed as `SUM(reviews.points_awarded)` over the append-only `reviews` log.

## Alternatives Considered

### Stored running counter (increment on each grade)

- Pros: O(1) read, simpler query.
- Cons: can drift from the review log if a write fails partway through, requires careful transactional consistency between the `reviews` insert and the counter increment, and gives no way to recompute or audit the total if it ever goes wrong.
- Rejected because the review log already has to be durable and append-only for stats/history; deriving points from it for free removes an entire class of consistency bugs.

## Consequences

- Points can never drift out of sync with review history — there's no counter and log to reconcile.
- Every points read is a SUM aggregation rather than a single-row read; acceptable at V1's traffic scale, would need revisiting (e.g. a cached/materialized total) if the review log grows very large.
- Correcting or backfilling review history automatically corrects the points total, with no separate step to fix a counter.
