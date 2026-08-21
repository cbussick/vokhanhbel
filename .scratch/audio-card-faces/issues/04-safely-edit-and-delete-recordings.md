# 04 — Safely edit and delete Card recordings

**What to build:** Let the Learner retain, replace, or remove the recording on either Card face without risking the current Card. Changes take effect only after a successful Save. Successful replacement, removal, and Card deletion clear playable references and remove obsolete live bytes, while failed cleanup remains visible and retryable.

**Blocked by:** 03 — Create Cards from imported audio.

**Status:** done

- [ ] Update contracts distinguish unchanged audio, replacement by an owned staged audio ID, and explicit removal independently for each face.
- [ ] Cancelling the editor preserves existing recordings and discards local replacement intent.
- [ ] A failed upload or Card mutation leaves all existing text, audio, Box, due date, and other Card state unchanged and compensates for newly uploaded objects.
- [ ] A successful replacement switches the Card to a new immutable audio asset before deleting the obsolete object.
- [ ] A successful removal deletes obsolete live audio and rejects any result that would leave the face without text or audio.
- [ ] Soft-deleting a Card removes both face recordings from live storage while retaining existing Reviews and Points without historical audio playback.
- [ ] Database failure after upload removes new objects; first- and second-upload failures are covered independently.
- [ ] Failed obsolete-object deletion creates an observable retryable cleanup record, repeated cleanup is idempotent, and retries never delete an object currently referenced by a Card.
- [ ] Editor, authenticated HTTP-stack, database, and failure-adapter tests cover retaining, replacing, removing, deleting, compensation, missing objects, cleanup retry, and stable scheduling fields.

## Comments

Implemented atomic retain/replace/remove semantics, post-switch obsolete deletion, Card-delete cleanup, upload compensation, and reference-safe retry jobs. Regression tests include replacement source invalidation, stable scheduling, deterministic deletion failure, and idempotent retry.
