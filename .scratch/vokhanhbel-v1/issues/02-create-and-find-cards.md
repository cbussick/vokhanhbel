# 02 — Create and find Cards

**What to build:** Khanh can add a Card, see it in the newest-first Cards list, and find it again by searching either side. This is the first complete learning-content path through database, API, cache, and accessible UI.

**Blocked by:** 01 — Unlock the secure app shell.

**Status:** ready-for-agent

- [ ] The Card record and public contract contain the settled identity, front/back, Box, due, review, creation, update, and deletion fields with database-enforced invariants.
- [ ] Khanh can create a Card using multiline front and back text with limits of 1–200 and 1–1,000 characters respectively.
- [ ] Client, server, and stored data apply the same accepted Unicode, line-ending, surrounding-whitespace, horizontal-whitespace, line-break, and control-character rules.
- [ ] A new Card begins in Box 0, is Due immediately, and appears only after the server confirms creation.
- [ ] Active Card fronts are unique after normalization and case-insensitive comparison while preserving display capitalization; a conflict produces a safe, useful field error.
- [ ] The database—not only prechecks—enforces active-front uniqueness under concurrent creation.
- [ ] The Cards screen lists every active Card in descending creation order and deliberately performs no pagination.
- [ ] Search trims its query and performs case-insensitive substring matching over front and back, keeps diacritics significant, and preserves list order.
- [ ] Empty and no-results states show the settled next actions, query feedback, and reset behavior.
- [ ] Card creation is disabled with an explanation while offline, does not auto-retry, retains submitted input on failure, and disables duplicate submission while pending.
- [ ] Card reads remain fresh for 30 seconds without polling and keep visible content during background refresh.
- [ ] The create sheet, fields, errors, list, search, and empty states are keyboard accessible, screen-reader understandable, usable at 200% text, and responsive at supported widths.
- [ ] Tests exercise creation, normalization, database constraints, duplicate races, validation, ordering, search, cache behavior, offline behavior, and accessible interaction through public seams.

