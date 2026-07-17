# 03 — Edit and remove Cards safely

**What to build:** Khanh can inspect, correct, and remove an existing Card without accidentally losing edits, learning history, Points, or database integrity.

**Blocked by:** 02 — Create and find Cards.

**Status:** done

- [x] Opening a Card presents its current front and back in a detail sheet and supports a direct browser route without persisting transient editor state in the URL.
- [x] Khanh can partially update front or back under the same normalization, validation, and active-front uniqueness rules as creation.
- [x] Editing preserves Box, due time, last review time, and all Reviews; no progress reset is offered.
- [x] Concurrent device edits use documented last-write-wins behavior without a version field.
- [x] An unchanged editor closes immediately; a dirty editor requires the settled discard confirmation through controls or Escape.
- [x] A failed edit keeps the sheet and input open, displays safe field feedback, disables duplicate submission, and updates the Card list only after success.
- [x] Deletion requires the in-sheet confirmation explaining that the Card disappears while prior Reviews and Points remain.
- [x] Confirmed deletion is idempotent soft deletion, removes the Card from active reads/search/future queues, releases its normalized front for reuse, and shows the settled success feedback.
- [x] Soft deletion retains the Card row and every Review; the database restricts permanent deletion and no restore, undo, or purge interface exists.
- [x] The detail, edit, discard, and delete dialogs use semantic native dialog behavior with correct focus placement/restoration, keyboard controls, readable errors, and responsive layouts.
- [x] Card list changes happen immediately after confirmed server success without row/reorder animation.
- [x] Tests cover direct detail loading, editing, normalization conflicts, dirty-state decisions, last-write-wins behavior, failed writes, repeated deletion, front reuse, and retained history at UI/API/database seams.

## Comments

Implemented and reviewed in the V1 batch. Evidence includes rendered edit/delete journeys,
soft-delete and retained-review PostgreSQL coverage, and all local quality gates passing on
2026-07-14.
