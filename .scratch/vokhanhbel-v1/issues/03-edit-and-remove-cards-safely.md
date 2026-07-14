# 03 — Edit and remove Cards safely

**What to build:** Khanh can inspect, correct, and remove an existing Card without accidentally losing edits, learning history, Points, or database integrity.

**Blocked by:** 02 — Create and find Cards.

**Status:** ready-for-agent

- [ ] Opening a Card presents its current front and back in a detail sheet and supports a direct browser route without persisting transient editor state in the URL.
- [ ] Khanh can partially update front or back under the same normalization, validation, and active-front uniqueness rules as creation.
- [ ] Editing preserves Box, due time, last review time, and all Reviews; no progress reset is offered.
- [ ] Concurrent device edits use documented last-write-wins behavior without a version field.
- [ ] An unchanged editor closes immediately; a dirty editor requires the settled discard confirmation through controls or Escape.
- [ ] A failed edit keeps the sheet and input open, displays safe field feedback, disables duplicate submission, and updates the Card list only after success.
- [ ] Deletion requires the in-sheet confirmation explaining that the Card disappears while prior Reviews and Points remain.
- [ ] Confirmed deletion is idempotent soft deletion, removes the Card from active reads/search/future queues, releases its normalized front for reuse, and shows the settled success feedback.
- [ ] Soft deletion retains the Card row and every Review; the database restricts permanent deletion and no restore, undo, or purge interface exists.
- [ ] The detail, edit, discard, and delete dialogs use semantic native dialog behavior with correct focus placement/restoration, keyboard controls, readable errors, and responsive layouts.
- [ ] Card list changes happen immediately after confirmed server success without row/reorder animation.
- [ ] Tests cover direct detail loading, editing, normalization conflicts, dirty-state decisions, last-write-wins behavior, failed writes, repeated deletion, front reuse, and retained history at UI/API/database seams.

