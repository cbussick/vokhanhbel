# ADR-009: Offline Grading Is Best-Effort, Not Durable

## Status

Accepted

## Date

2026-07-12

## Context

Grading a card is optimistic — the UI advances to the next card immediately. V1 supports grading while offline via TanStack Query's default mutation pause/resume: mutations fired while offline pause and auto-replay on reconnect. This only works while the app instance stays alive — the queued mutation lives in memory, not in a persisted mutation cache.

## Decision

Scope offline grading to in-session, memory-only durability for V1: no mutation-cache persister. A grade taken while offline is lost if the app is closed (tab closed, browser killed, app backgrounded and evicted) before the connection returns and the mutation replays.

## Alternatives Considered

### Add a mutation-cache persister (e.g. localStorage-backed)

- Pros: grades would survive the app being closed while offline, closing the silent-data-loss gap.
- Cons: an extra dependency plus a persistence/hydration/invalidation mechanism to test correctly (e.g. across app version boundaries) — disproportionate to V1's single-household, low-traffic scope.
- Rejected for V1; revisit if offline use turns out common enough that silent loss becomes a real complaint rather than a theoretical edge case.

## Consequences

- Users reviewing offline should keep the app open until back online; there is no stronger guarantee.
- The offline banner ("changes will sync when you're back") is accurate only while the app instance stays alive.
- AI chat stays disabled entirely while offline, sidestepping the harder problem of offline streaming.
