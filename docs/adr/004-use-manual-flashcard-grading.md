# ADR-004: Use Manual Flashcard Grading

## Status

Accepted

## Date

2026-07-11

## Context

V1 should help Khanh remember recurring English words and phrases with minimal friction. Flashcards need to work well on a phone while watching or reviewing casually. English phrases can have multiple valid German meanings, partial meanings, and context-dependent nuance.

## Decision

Use manual flip and self-grading for V1.

The review flow shows the card front, lets Khanh reveal the back, then asks her to grade herself as `Forgot`, `Almost`, or `Knew it`. Scheduling and points are based on that manual grade.

## Alternatives Considered

### Typed Answers

- Pros: more active recall and potentially stronger learning signal.
- Cons: requires fuzzy grading, spelling tolerance, synonym handling, and can frustrate phrase learning.
- Rejected for V1 because it adds complexity and friction.

### AI-Graded Answers

- Pros: could handle synonyms and nuance better than exact matching.
- Cons: non-deterministic, slower, costs money, and is harder to test.
- Rejected because scheduling should be deterministic and reliable.

### Multiple Choice

- Pros: easy to grade and gamify.
- Cons: weaker recall signal and requires generating plausible distractors.
- Rejected for V1 as the primary review mode.

## Consequences

- The scheduling algorithm remains deterministic and easy to test.
- Review UX can be fast and mobile-first.
- Points reward effort and self-assessed success.
- Typed answers or AI grading may be added later as optional modes only after a new spec update.
