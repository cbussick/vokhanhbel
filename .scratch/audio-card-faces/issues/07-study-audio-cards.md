# 07 — Study audio Cards in fixed-direction Review Sessions

**What to build:** Let the Learner study every valid media combination while preserving fixed front-to-back review and existing scheduling. Prefetch active Review Session audio in the background without delaying startup. Keep Cards with usable text gradable after optional-audio failure, but prevent grading when an audio-only active face is unavailable and provide a schedule-neutral Skip Card action.

**Blocked by:** 03 — Create Cards from imported audio.

**Status:** ready-for-agent

- [ ] Review Sessions always present the front and reveal the back for text-only, text-plus-audio, and audio-only faces; media never changes scheduling direction.
- [ ] Each active face renders text before its matching player, exposes accurate face-specific accessible labels, and never autoplays on session start or reveal.
- [ ] Session audio prefetch begins in the background, does not delay navigation or session start, tolerates individual failures, and makes no persistent-offline guarantee across reloads.
- [ ] A failed recording with accompanying text offers Retry while leaving reveal and grading usable.
- [ ] An unavailable audio-only front or revealed back offers Retry and Skip Card and prevents grading while required face content is unavailable.
- [ ] Skip Card advances within the client Review Session without creating a Review, changing Box or due date, awarding Points, or entering the repeat-forgotten queue.
- [ ] Shared playback coordination works across front, back, and any other player in the current view.
- [ ] Review reducer, route, and authenticated journey tests cover fixed direction, no autoplay, text-first layout, non-blocking prefetch, both failure modes, grading prevention, schedule-neutral Skip Card, and ordinary grading regression behavior.
- [ ] Automated accessibility, explicit keyboard, touch-target, and stable mobile, tablet, and desktop screenshots cover front and revealed back faces with text-plus-audio and audio-only fixtures.

