# ADR-006: Defer Card Collections/Sets

## Status

Accepted

## Date

2026-07-11

## Context

The original motivation for this app was helping German speakers study English
vocabulary. Khanh may also want to use it to study Vietnamese, meaning a single account
could realistically hold cards spanning more than one language pair (e.g. English-facing
cards alongside Vietnamese-facing cards) at the same time. This raises the question of
whether cards need to be grouped — by language, by deck, or by some other "set" concept —
so the Review and Cards tabs could filter or organize by group.

## Decision

V1 keeps a single flat list of cards with no grouping, set, collection, or language field.
The `cards` table and all API routes stay a flat structure — `front`/`back` are free-form
text with no language metadata. Review queues and the Cards tab list operate over the
full card list regardless of what language(s) any individual card happens to mix.

This is deferred, not decided against: if mixed-language use becomes a real pattern
(rather than a hypothetical), the most likely extension point is a nullable
`collection_id`-style column on `cards` plus a lightweight collections table, added as a
new migration and a new ADR superseding this one — not a V1 concern.

## Alternatives Considered

### Add a `language` or `collection` field to `cards` now

- Pros: would let Review/Cards tabs filter by set immediately if mixed-language use
  starts right away.
- Cons: the target use case (single language vs. mixed-language use) isn't settled yet —
  building grouping UI/schema now risks designing around the wrong shape once actual
  usage patterns emerge.
- Rejected for V1: adds schema and UX surface area before there's a concrete need driving
  its design.

### Separate accounts/deployments per language

- Pros: total isolation, no schema change at all.
- Cons: contradicts the single shared-household-password auth model
  (`002-use-shared-password-session-auth.md`) and would duplicate the whole app per
  language.
- Rejected as disproportionate to the problem.

## Consequences

- Cards tab and Review tab show all cards together in V1, regardless of language mix.
- If/when grouping is needed, expect a schema migration (`collection_id` or similar) and
  UI changes to Cards tab (grouping/filtering) and Review tab (queue scoped to a
  collection) — tracked as future scope, not implied by anything currently decided for V1.
