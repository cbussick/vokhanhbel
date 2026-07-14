# ADR-011: Keep Reviews When A Card Is Deleted

## Status

Accepted

## Date

2026-07-13

## Context

Points are derived as `SUM(reviews.points_awarded)` over the append-only `reviews` log (ADR-008). Cards can be deleted from the Cards tab. The obvious schema is a plain foreign key from `reviews` to `cards` with `ON DELETE CASCADE` — but then deleting a mastered card silently erases its review history and drops the household points total, punishing exactly the behavior (finishing a card) the app wants to reward.

## Decision

Deleting a Card never removes its Reviews or the Points they awarded. Cards are soft-deleted (a `deleted_at` timestamp) rather than removed; deleted cards disappear from study queues and listings, but their rows — and every referencing review — remain.

## Alternatives Considered

### Hard delete with `ON DELETE CASCADE`

- Pros: simplest schema, no soft-delete filtering in queries.
- Cons: deleting a card retroactively changes the points total and destroys review history, contradicting the append-only framing of ADR-008.
- Rejected because the review log is the system of record for points and stats; it must survive card lifecycle events.

### Hard delete with `ON DELETE SET NULL`

- Pros: reviews and points survive without soft-delete filtering.
- Cons: orphaned reviews lose which card they were about, so history and per-card stats degrade permanently.
- Rejected because keeping the card row costs one nullable column and preserves full history.

## Consequences

- Every query that lists or schedules cards must filter `deleted_at IS NULL`; forgetting the filter is the main bug risk of this design.
- The points total is stable under all card operations — only grading a review can change it.
- "Delete" in the UI is a domain-level hide, not a data purge; genuinely purging data (e.g. a mistyped card with no reviews) is not a V1 operation.
