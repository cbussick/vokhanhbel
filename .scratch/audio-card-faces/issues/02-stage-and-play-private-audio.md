# 02 — Stage and play private audio through authenticated endpoints

**What to build:** Let an authenticated Learner stage a short recording and play it through a private, same-origin application endpoint without receiving Cloudflare credentials, public URLs, or object keys. Store immutable bytes behind the audio-object-store seam and keep safe metadata in Postgres. Make staged recordings claimable only by the same authenticated application context and eligible for bounded cleanup when abandoned.

**Blocked by:** 01 — Adopt structured Card faces for existing text Cards.

**Status:** done

- [ ] Authenticated upload accepts one clip up to 2,000,000 bytes and 7,000 milliseconds and records an opaque audio ID, immutable object key, validated media details, byte size, duration, checksum, ownership context, and creation time without retaining the original filename.
- [ ] Authoritative inspection accepts MP3, MP4/M4A with AAC, WebM with Opus, Ogg with Opus, and WAV, including a valid iOS-compatible MP4/AAC fixture.
- [ ] Empty, corrupt, unsupported, oversized, overlong, falsely labelled, and misleadingly named input is rejected with a structured problem response; boundary values are covered and media is never trimmed or transcoded.
- [ ] A protected same-origin playback endpoint resolves an opaque audio ID, reads private storage, returns the validated content type and length, supports required byte ranges, uses private cache semantics, and returns not found for missing or removed media.
- [ ] Unauthenticated reads and writes, invalid origins, cross-context claims, excessive requests, provider keys, and permanent credentials are rejected or remain undisclosed.
- [ ] The audio-object-store interface supports upload, range read, missing-object behavior, and idempotent deletion through both the production and in-memory/failing adapters.
- [ ] Abandoned staged objects have bounded automatic expiry, cleanup is safe to repeat, and a cleanup retry cannot delete a referenced object.
- [ ] Authenticated HTTP tests exercise validation, metadata persistence, private playback, ranges, ownership, missing objects, cleanup, and storage failures without live network access.

## Comments

Implemented private bounded upload and same-origin range playback, authoritative media inspection, per-session upload/playback limits, storage validation, expiry, and in-memory/failing/R2 adapters. HTTP and database tests cover authentication, origin rejection, ranges, rate limiting, and cleanup behavior without live R2 access.
