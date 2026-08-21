# Text and Audio Card Faces

Status: ready-for-agent

## Problem Statement

Cards currently require text on the front and text on the back. This prevents the Learner from creating pronunciation exercises in which either face contains a short recording. It also prevents combining a written form with its pronunciation on the same face.

The Learner needs both Card faces to support text, audio, or both. Audio must be easy to record or import, private, small, playable throughout the existing Card and Review experiences, and removable without retaining historical recordings. The feature must preserve the current fixed front-to-back review model, scheduling behavior, authentication model, and text search semantics.

## Solution

Allow the front and back of every Card to contain optional normalized text and optional short audio. Require each face to contain at least one of those media types. Allow at most one audio recording per face.

The Learner can record one continuous clip with the device's default microphone or choose a clip through a file picker and drop zone. Each clip is limited to seven seconds and 2 MB. The app validates, previews, uploads, plays, replaces, and removes clips through authenticated application endpoints. Private Cloudflare R2 Standard buckets in the EU jurisdiction store the audio bytes. Neon Postgres stores Card data, audio metadata, and opaque object references.

Provide one styled, accessible audio-player module across Card lists, the Card editor, and Review Sessions. Audio loads on demand in Card lists and is prefetched in the background for active Review Sessions. Text search continues to search text only. The Tutor remains available but explains that it cannot help when either face is audio-only; it does not transcribe recordings or consume an AI allowance in that state.

## User Stories

1. As the Learner, I want to create a Card with text on both faces, so that all existing Cards and study habits continue to work.
2. As the Learner, I want to put text and audio together on the front, so that I can combine a written prompt with its pronunciation.
3. As the Learner, I want to put text and audio together on the back, so that I can reveal a written answer and its pronunciation together.
4. As the Learner, I want to create an audio-only front, so that I can identify a sound, spoken word, or pronunciation.
5. As the Learner, I want to create an audio-only back, so that I can recall and then hear the correct pronunciation.
6. As the Learner, I want both faces to support audio independently, so that a Card can compare two sounds or pronunciations.
7. As the Learner, I want each face to require text or audio, so that I cannot save an unusable blank face.
8. As the Learner, I want each face to accept up to 1,000 normalized text characters, so that the two faces have consistent text flexibility.
9. As the Learner, I want to record audio with my device's default microphone, so that I can create pronunciation Cards without another application.
10. As the Learner, I want microphone permission to be requested only after I choose to record, so that the app does not request unexpected device access.
11. As the Learner, I want a clear error when microphone permission is denied or no microphone is available, so that I understand why recording did not start.
12. As the Learner, I want file upload to remain available when microphone recording is unavailable, so that permission or device limitations do not block Card creation.
13. As the Learner, I want a visible recording countdown, so that I know how much of the seven-second allowance remains.
14. As the Learner, I want recording to stop automatically at seven seconds, so that I cannot accidentally create an invalid clip.
15. As the Learner, I want to stop a recording before seven seconds, so that short pronunciations do not contain unnecessary silence.
16. As the Learner, I want to play a recording before saving it, so that I can verify its content and quality.
17. As the Learner, I want to record again or remove an unsaved recording, so that I can correct mistakes before saving.
18. As the Learner, I want to click a drop zone to choose an audio file, so that ordinary file selection is available.
19. As the Learner, I want to drop an audio file onto the same input area, so that importing a clip is quick on supported devices.
20. As the Learner, I want common MP3, MP4/M4A AAC, WebM/Opus, Ogg/Opus, and WAV files to work, so that recordings from iPhone and other common devices are accepted.
21. As the Learner, I want an unsupported, corrupt, oversized, or overlong file rejected with a clear message, so that I know how to correct it.
22. As the Learner, I want an overlong imported clip rejected rather than silently trimmed or changed, so that the app does not alter my recording unexpectedly.
23. As the Learner, I want one recording per face, so that Card playback remains focused and simple.
24. As the Learner, I want front and back recordings uploaded only when I save the Card, so that cancelled edits do not intentionally publish drafts.
25. As the Learner, I want the existing Card left unchanged if a new recording or Card update fails, so that a failed save does not lose valid content.
26. As the Learner, I want removing existing audio to take effect only after a successful save, so that cancelling the editor preserves the recording.
27. As the Learner, I want replaced and removed recordings deleted from live storage immediately after a successful save, so that obsolete voice recordings are not retained.
28. As the Learner, I want a deleted Card's recordings removed from live storage, so that soft-deleted Cards do not preserve voice recordings.
29. As the Learner, I want a custom audio player that matches the app, so that audio feels like part of the existing interface.
30. As the Learner, I want Play, Pause, and Replay controls, so that I can control short pronunciation clips without excessive media controls.
31. As the Learner, I want to see playback progress and the clip duration, so that I know how much audio remains.
32. As the Learner, I want one clip to pause when another begins, so that recordings never speak over one another.
33. As the Learner, I want starting a microphone recording to stop current playback, so that captured audio is not contaminated by the app itself.
34. As the Learner, I want the device to control playback volume, so that the Card player stays simple.
35. As a keyboard or assistive-technology user, I want every custom playback control to have clear focus behavior, names, states, and announcements, so that I can operate audio without relying on sight or touch.
36. As the Learner, I want text displayed before the matching player when a face has both, so that written and spoken content have a consistent hierarchy.
37. As the Learner, I want audio playback to start only when I request it, so that revealing or opening a Card never produces unexpected sound.
38. As the Learner, I want to play front and back recordings directly from the Card list, so that I can identify and inspect Cards without opening each editor.
39. As the Learner, I want list playback controls to remain separate from the action that opens a Card, so that playing audio does not navigate unexpectedly.
40. As the Learner, I want each listed recording labelled by face and actual duration, so that I can distinguish front and back audio such as `Audio · 0:06`.
41. As the Learner, I want Card-list audio fetched only when I first play it, so that opening a large Collection does not download every recording.
42. As the Learner, I want previously fetched list audio reused when possible, so that repeated playback starts quickly and avoids unnecessary transfer.
43. As the Learner, I want text search to continue matching front and back text, so that existing search behavior remains familiar.
44. As the Learner, I accept that audio content is not searchable, so that transcription and audio indexing remain outside this feature.
45. As the Learner, I want audio-only fronts to appear with their duration instead of a blank label, so that I can still open and manage them.
46. As the Learner, I accept that separate audio-only Cards can be duplicates, so that the app does not need audio-content comparison.
47. As the Learner, I want Review Sessions to keep asking the front and revealing the back, so that media flexibility does not change review direction.
48. As the Learner, I want Review Sessions to prefetch their recordings in the background, so that upcoming clips are more likely to work during intermittent connectivity.
49. As the Learner, I want Review Sessions to start without waiting for every recording, so that one slow or unavailable clip does not block studying.
50. As the Learner, I want a failed player with accompanying text to offer Retry while leaving the Card usable, so that optional audio failure does not interrupt study.
51. As the Learner, I want an unavailable audio-only face to offer Retry and Skip Card, so that I do not grade a Card whose prompt or answer is missing.
52. As the Learner, I want skipping an unavailable audio-only Card to leave its schedule unchanged, so that infrastructure failures do not affect learning progress.
53. As the Learner, I want editing text or audio to preserve the Card's Box and due date, so that content maintenance does not reset progress unexpectedly.
54. As the Learner, I want the Tutor button to remain visible for every Card, so that Tutor availability is explained in its normal location.
55. As the Learner, I want the Tutor dialog to explain when an audio-only face prevents help, so that the limitation is clear.
56. As the Learner, I want that explanatory Tutor state to avoid an AI request and allowance charge, so that an unsupported Card does not consume limited Tutor use.
57. As the Learner, I want Cards with text on both faces to retain normal Tutor behavior even when audio accompanies the text, so that audio enhancement does not remove existing help.
58. As the household operator, I want recordings stored privately in the EU, so that personal voice data is not exposed through public object URLs.
59. As the household operator, I want production and preview recordings isolated, so that development and preview activity cannot alter production audio.
60. As the household operator, I want Cloudflare credentials restricted to the required buckets and kept on the server, so that the browser never receives permanent storage credentials.
61. As the household operator, I want the existing encrypted Postgres backup to continue unchanged, so that experimenting with audio does not disrupt current recovery procedures.
62. As the household operator, I accept that R2 audio is not backed up initially, so that the first implementation stays small and recordings are explicitly non-recoverable.

## Implementation Decisions

- Treat both Card faces symmetrically as structured content. Each face contains nullable normalized text and nullable audio metadata. A database constraint and request validation require at least one value per face.
- Allow at most one audio asset on the front and one on the back. Keep the Card UUID as the stable Card identity. Give each audio asset its own opaque UUID and immutable R2 object key.
- Keep the review direction fixed as front to back. Flexible face media does not introduce reverse review, separate directional scheduling, or shared-direction logic.
- Increase both face text limits to 1,000 normalized characters. Migrate every existing Card to structured text-only faces without changing its identity, Collection, Box, due date, or timestamps.
- Preserve case-insensitive front-text uniqueness within a Collection only when front text exists. Replace the direct long-text unique index with a partial unique expression index over the Collection ID and a database-computed SHA-256 digest of normalized, case-folded front text. The digest lives only in the index, is not a Card ID or contract field, and uses PostgreSQL's trusted cryptographic extension. Audio-only fronts do not participate in uniqueness checks.
- Preserve database enforcement of normalization for nullable face text. The client and server normalize and validate for feedback, while Postgres remains authoritative for normalization invariants and uniqueness under concurrent requests.
- Store audio bytes in private Cloudflare R2 Standard buckets under the EU jurisdiction. Use separate production and preview buckets. Use server-only, bucket-scoped read/write credentials. Do not expose permanent Cloudflare credentials or public object URLs to the browser.
- Put R2 behind one audio-object-store interface at the server resource seam. Its production adapter uploads, reads, and deletes R2 objects. Tests replace this adapter. Card, route, and UI modules depend on application audio identifiers and playback endpoints rather than Cloudflare keys.
- Store audio metadata in Neon Postgres. Metadata includes the opaque audio ID, owning Card and face, unique object key, validated content type and codec/container information, exact byte size, duration in milliseconds, integrity checksum, and creation time. Do not retain the original filename.
- Keep audio objects immutable. Replacing a recording creates a new audio ID and object key. A successful Card mutation switches the face to the new asset before the old object is deleted.
- Make deletion from live storage part of replacement, explicit removal, and Card deletion. Clear playable database references and delete obsolete R2 bytes immediately after a successful save. Failed R2 deletions must be observable and retryable so unreferenced personal recordings are not silently retained.
- Do not keep audio bytes alive for Review history. Existing append-only Reviews and Points remain intact when a Card is deleted, but historical Review data does not provide playable deleted recordings. Replay behavior must not reintroduce a deleted recording as current playable Card state.
- Preserve the existing Postgres backup workflow. Do not add R2 audio backup, snapshot, replication, or restore in this version. Document that R2 recordings are non-recoverable if deleted or lost. R2 lifecycle rules for temporary uploads or cleanup are operational hygiene, not backups.
- Accept one file of at most 2,000,000 bytes and at most 7,000 milliseconds per face. Apply the limit independently to front and back. Recording stops automatically at the duration limit. Imported files above either limit are rejected rather than trimmed or transcoded.
- Accept and validate MP3, MP4/M4A with AAC, WebM with Opus, Ogg with Opus, and WAV. Choose microphone recording output at runtime with `MediaRecorder.isTypeSupported`, preferring a supported compressed format and falling back to MP4/AAC for compatible iOS browsers. Trust neither filename extension nor caller-supplied MIME type; server validation inspects the actual media and duration.
- Validate at both client and server gates. Client checks provide immediate size, format, and duration feedback. The authenticated server performs authoritative byte-count, media-signature/container, codec, duration, and integrity validation before an object becomes claimable by a Card.
- Upload front and back drafts sequentially only after Save. Keep selected and recorded drafts in local browser memory before Save. If any upload or Card mutation fails, remove newly uploaded objects and leave the existing Card unchanged.
- Support staged authenticated uploads without exposing R2 credentials. Staged objects must be claimable only by the same authenticated application context and must have bounded automatic cleanup if the browser closes or compensation fails. A Card mutation atomically claims the staged metadata in Postgres.
- Serve playback through an authenticated, same-origin application endpoint keyed by the audio ID. The endpoint obtains the private R2 object, returns the validated content type and length, supports the range behavior needed by the underlying media element, uses private cache semantics, and returns not found after removal.
- Keep Card JSON free of audio bytes and provider-specific object keys. Card responses expose structured face text and safe audio metadata sufficient to label and request playback, including the audio ID, duration, content type, and byte size.
- Make create and update contracts explicit about each face. Updates distinguish unchanged audio, replacement by a staged audio ID, and removal. They reject an update that would leave either face without text or audio.
- Preserve Box and due-date state for every Card edit, including adding, replacing, or removing text or audio.
- Build a reusable styled audio-player module with an intentionally small interface. It owns an underlying audio element, Play, Pause, Replay, loading, progress, duration, and failure states. It omits seeking, volume, playback speed, download, and full native controls.
- Build a separate audio-input module for the Card editor. It owns the file input/drop zone, microphone permission, recording lifecycle, countdown, local preview, Record Again, replacement, removal, validation feedback, and cleanup. It reuses the audio-player module for preview.
- Use a shared playback coordinator so only one clip plays at a time across the current application view. Starting another clip or starting microphone recording stops current playback.
- Request microphone access only from an explicit recording action and use the browser's default input device. Provide understandable states for requesting permission, recording, stopped preview, denied permission, missing device, and unsupported recording.
- Record one continuous take. Provide Stop and automatic stop at seven seconds. Do not add pause/resume, waveform editing, silence detection, loudness normalization, trimming, or transcoding.
- Let the low-level visual Card module accept arbitrary React content for each face. Compose it with a domain-aware Card-face renderer that presents normalized text first and the matching audio player beneath it. Persist only the supported text/audio structure; never persist JSX or arbitrary rich content.
- Customize the audio UI to match the existing app and meet accessible interaction requirements. Controls require visible focus, keyboard operation, accurate accessible names per face, announced loading/error states, and reduced-motion-compatible progress presentation.
- Never autoplay. Playback begins only from an explicit Learner action on Card lists, editor previews, and Review faces.
- Restructure Card-list rows so navigation and playback are sibling actions rather than nested interactive controls. A face with text displays its text and any matching compact player. An audio-only face displays a dynamic `Audio · m:ss` label and compact player. If both faces have audio, expose separately labelled front and back controls.
- Keep Card-list audio lazy. Fetch it on first playback and reuse normal private browser caching afterward. Do not preload every Collection recording.
- Search normalized front and back text only. Ignore audio metadata and audio contents. Retain front-text uniqueness for textual fronts and allow indistinguishable duplicate audio-only fronts without introducing a required management title.
- Prefetch audio for the active Review Session in the background without delaying session start. This is best-effort caching, consistent with the existing offline policy; it does not promise persistent offline media across reloads.
- If audio fails but the same face has text, keep the Card usable and offer Retry. If an audio-only active face cannot load, prevent grading and offer Retry and Skip Card. Skipping advances within the client Review Session without creating a Review or changing the Card schedule.
- Keep the Tutor button visible. When either face is audio-only, opening the dialog shows a dedicated explanation and does not call the Tutor provider or consume allowance. When both faces have text, Tutor behavior remains unchanged and audio is not sent or transcribed.
- Preserve existing authentication, origin checks, structured problem responses, and request limits for every upload, playback, mutation, and cleanup endpoint. Reject unauthenticated reads as well as writes because recordings are private household data.
- Update German interface copy for optional text, audio limits, recording states, file validation, face-specific playback labels, retry/skip behavior, and the Tutor audio-only explanation. Keep domain identifiers and contracts named for Tutor rather than the Tutopher persona.
- Document Cloudflare provisioning and operations: R2 subscription, EU private Standard buckets, production/preview separation, narrowly scoped credentials, environment configuration, live-object deletion expectations, temporary-object expiry, and the explicit absence of audio backup.

## Testing Decisions

- Test external behavior through the highest practical seam. Prefer authenticated HTTP/resource tests that exercise validation, Postgres, storage coordination, and returned contracts together. Use focused module tests only where browser media APIs or the R2 adapter cannot be exercised reliably through that seam.
- Treat the audio-object-store interface as the single new server test seam. Use an in-memory/failing adapter to verify application behavior without network calls. Add a small adapter contract suite so the R2 adapter and test adapter agree on upload, range read, missing object, and idempotent deletion semantics.
- Extend public-contract tests for all valid text/audio combinations, the requirement that each face contain something, 1,000-character limits, explicit audio update semantics, safe response metadata, and rejection of provider keys or audio bytes.
- Extend database tests, following the existing Card normalization and uniqueness tests, to prove migration of existing Cards, nullable text constraints, per-face presence, one audio per face, metadata ownership, SHA-256 case-insensitive uniqueness within a Collection, duplicate audio-only fronts, uniqueness release after soft deletion, and concurrent duplicate rejection.
- Test migration compatibility for existing Review JSON snapshots. Old text-only Review rows must continue to parse or be migrated without changing Points. Replay must not expose removed audio as current playable state.
- Extend authenticated HTTP-stack tests, following the existing create-and-Grade journey, to cover staged upload, Card creation with every supported face combination, sequential two-face claims, playback authorization, response headers/ranges, replacement, removal, Card deletion, cleanup compensation, missing objects, and stable Box/due dates after edits.
- Verify that all upload limits and accepted formats are enforced by authoritative server inspection. Cover false MIME types, misleading extensions, empty/corrupt input, unsupported codecs, exact boundary values, overlong duration, oversized bytes, and a valid iOS-compatible MP4/AAC recording fixture.
- Verify cross-system failure behavior: first or second upload failure leaves the Card unchanged; database failure deletes new objects; failed obsolete-object deletion records a retryable cleanup; abandoned staged uploads expire; repeated cleanup is safe; and retries never delete a currently referenced object.
- Extend route-level journey tests, following the existing Card create/search and reveal-and-Grade journeys, for optional text, two independent audio inputs, microphone states, file/drop selection, previews, Save compensation, list playback, one-at-a-time coordination, Review prefetch, Retry/Skip, and Tutor explanation without a network request.
- Test the audio-player module's observable states with a controllable media-element test double: loading, playing, paused, ended/replay, progress, error, source replacement, cleanup on unmount, and coordination with another player. Do not assert internal hooks, timers, or CSS implementation.
- Test the audio-input module's observable behavior with MediaRecorder and media-stream test doubles: permission success and denial, default microphone use, countdown, manual stop, automatic seven-second stop, Record Again, Remove, file validation, object-URL revocation, and stopping device tracks.
- Extend Card-list tests to prove that playback does not navigate, Card links still navigate, both face players are labelled correctly, dynamic durations render, audio-only Cards remain manageable, text search ignores audio, and audio fetch begins only on Play.
- Extend Review Session tests to prove fixed front-to-back direction for every media combination, no autoplay, text-first composition, background prefetch without start blocking, normal grading when optional audio fails, blocked grading for an unavailable audio-only face, and schedule-neutral Skip Card behavior.
- Extend Tutor resource and route tests to prove that text/text Cards retain current behavior, audio accompanying text is not sent to the provider, audio-only faces show the explanation, and the explanation consumes neither provider calls nor allowance rows.
- Extend Playwright critical journeys and stable responsive screenshots for the editor, Collection list, front Review face, and back Review face at the existing mobile, tablet, and desktop widths. Include text-plus-audio and audio-only fixtures.
- Run automated accessibility checks and explicit keyboard tests for the custom players, list-row sibling actions, recording controls, loading/error announcements, dialog focus behavior, and Retry/Skip actions. Check touch-target size and layout at the narrowest supported viewport.
- Keep R2 credentials and live network access out of the default test suite. Production verification requires a human-provisioned preview bucket and should prove upload, playback, replacement, deletion, EU endpoint configuration, and bucket isolation before release.
- Use the project's existing test, database-test, end-to-end, type-check, lint, format-check, and build commands as the completion gate. New fixtures must be small, license-safe, and free of personal recordings.

## Out of Scope

- More than one recording per Card face.
- Audio longer than seven seconds or larger than 2 MB per face.
- Reverse review, automatic two-direction Cards, or separate scheduling by direction.
- Audio transcription, speech recognition, pronunciation scoring, Tutor audio understanding, or sending audio to the AI provider.
- Searching, deduplicating, indexing, or comparing audio content.
- A required title or hidden text label for audio-only Cards.
- Autoplay on list, editor, front, back, or reveal.
- Seekable playback, custom volume, playback speed, download controls, playlists, or simultaneous playback.
- Pause/resume recording, microphone selection, waveform editing, trimming, transcoding, silence detection, noise reduction, or loudness normalization.
- Arbitrary persisted JSX, HTML, rich-text blocks, images, video, or general attachment support.
- Public R2 buckets, direct permanent R2 URLs, permanent client credentials, or unauthenticated audio reads.
- R2 audio backup, bucket snapshots, cross-provider replication, audio restore tooling, or changes to the existing Postgres backup workflow.
- Historical playback of replaced or deleted recordings from Review data.
- A guarantee of persistent offline audio across closing or reloading the app.
- Resetting Card progress automatically after content edits.
- Retaining or displaying original uploaded filenames.

## Further Notes

- This feature changes the glossary definition of Card from a front/back text pair to a fixed-direction pair of faces, each containing text, audio, or both. Update the domain documentation when implementation records that decision.
- The existing decision to keep Reviews after Card deletion still applies. Audio bytes are explicitly excluded from that retained history.
- Cloudflare R2 itself is generally available. This design uses ordinary private R2 buckets and the S3-compatible interface, not a beta storage feature.
- The current R2 Standard free tier is expected to cover this household workload, but pricing is operational context rather than a product invariant. Confirm current limits when provisioning.
- Cloudflare account creation, R2 checkout/subscription enablement, EU bucket creation, and production secret entry require human action. The implementation agent can complete local and automated work against the storage interface before those credentials exist.
- The agreed primary testing seam is the authenticated application HTTP/resource surface with a replaceable audio-object-store adapter underneath it. The reusable audio-player and audio-input modules are narrower browser seams because media APIs require deterministic test doubles.
- No source implementation accompanies this specification.
