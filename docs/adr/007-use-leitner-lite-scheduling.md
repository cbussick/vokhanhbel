# ADR-007: Use Leitner-Lite Scheduling

## Status

Accepted

## Date

2026-07-12

## Context

V1 needs a spaced-repetition schedule that decides when a card comes back due after being graded. The obvious industry-standard approach is an SM-2-style scheme: a per-card ease factor that grows or shrinks continuously based on grade history (as used by Anki, SuperMemo).

## Decision

Use a Leitner-lite ladder instead: one integer `box` (0–5) per card, with a fixed due interval per box (1/3/7/14/30/90 days). Grading moves a card between boxes:

- `forgot` → box 0
- `almost` → box unchanged
- `knew_it` → box + 1 (capped at 5)

Due times are day-granular in a fixed household timezone (Europe/Berlin): `due_at = startOfDay(reviewed_at, Europe/Berlin) + interval(newBox)`. A card due "in 3 days" is due from midnight of the third day, so it is caught by any session that day regardless of the original review's time of day. Exact-timestamp arithmetic (`reviewed_at + N×24h`) was rejected because it lets intervals drift by review time — a card graded in the evening dodges the next morning's session, silently stretching every interval.

Keep Box transitions and interval selection as pure TypeScript. Inside the Grade
transaction, let PostgreSQL convert `reviewed_at` to the Europe/Berlin calendar,
add the selected number of calendar days, and convert the target local midnight
back to a timezone-aware timestamp. Use the same PostgreSQL timezone operations
for Berlin-based daily and weekly statistics. This handles daylight-saving
changes without an application date library; the browser uses built-in `Intl`
formatting only for display.

## Alternatives Considered

### SM-2-style ease factor

- Pros: adapts more finely to per-card difficulty over time; industry-standard, well-understood algorithm.
- Cons: a per-card floating-point ease factor is harder to unit test exhaustively and introduces tunable drift that's difficult to reason about — unnecessary complexity for V1's single-household use case.
- Rejected for V1 in favor of a fully deterministic, trivially testable integer ladder.

## Consequences

- The box-to-interval table (1/3/7/14/30/90 days) is a proposed default, not a validated one — it's isolated to one lookup table, so it's cheap to tune later if it feels wrong in practice.
- Box 5 is a hard cap; cards never graduate out of the review pool entirely in V1.
- Because the schedule is a pure function of `(box, grade, review date)`, the scheduling logic is trivially unit-testable without simulating review history.
- Database integration tests cover the Berlin-midnight conversion across both
  daylight-saving transitions.
- The household timezone is a hardcoded constant; supporting users in different timezones would require revisiting due-time computation.
