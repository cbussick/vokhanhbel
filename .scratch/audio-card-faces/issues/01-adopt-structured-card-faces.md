# 01 — Adopt structured Card faces for existing text Cards

**What to build:** Migrate every Card to symmetric structured front and back faces while preserving all existing text-only behavior. Each face exposes optional normalized text and safe optional audio metadata, but existing Cards migrate as text-only Cards without changing identity, Collection, Box, due date, timestamps, Reviews, or Points. Both faces accept up to 1,000 normalized text characters. Establish a low-level visual Card that accepts arbitrary face content and a domain-aware Card-face renderer that keeps text first. Record the new Card definition and retained Review-history behavior in the domain documentation.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Card contracts represent front and back as symmetric faces with nullable normalized text and nullable safe audio metadata; responses never expose audio bytes or provider object keys.
- [ ] The database migration preserves all existing Card identities, Collections, scheduling fields, timestamps, Reviews, and derived Points while converting current Cards and compatible Review snapshots to text-only structured faces.
- [ ] Postgres and request validation enforce normalized nullable text, a 1,000-character limit on both faces, at most one audio reference per face, and at least text or audio on each face.
- [ ] Active textual fronts remain case-insensitively unique within their Collection through a partial SHA-256 expression index; audio-only fronts do not participate, and soft deletion releases uniqueness.
- [ ] Existing create, update, list, search, Review Session, and Tutor journeys remain functional for text-only Cards, including concurrent duplicate rejection.
- [ ] Card edits continue to preserve Box and due date.
- [ ] The visual Card accepts arbitrary React content for each face, while the domain renderer displays normalized text before any matching audio slot and persists only the supported face structure.
- [ ] Domain documentation defines a Card as a fixed-direction pair of faces containing text, audio, or both, and confirms that retained Reviews do not retain playable deleted audio.

