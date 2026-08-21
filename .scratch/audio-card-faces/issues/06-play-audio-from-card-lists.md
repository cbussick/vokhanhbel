# 06 — Play audio from Collection Card lists

**What to build:** Let the Learner identify and play either face's recording directly in a Collection while keeping Card navigation separate. Present text before matching audio, show a useful duration label for audio-only faces, fetch bytes only on explicit Play, and preserve text-only search semantics.

**Blocked by:** 03 — Create Cards from imported audio.

**Status:** done

- [ ] A Card row renders normalized text before the matching compact player and labels front and back controls separately with their actual duration.
- [ ] An audio-only front has a dynamic `Audio · m:ss` management label instead of appearing blank, and duplicate audio-only fronts are allowed.
- [ ] Card navigation and playback are sibling actions with no nested interactive controls; playing, pausing, or replaying audio never opens the editor.
- [ ] The shared coordinator pauses the current clip when another list or application player begins.
- [ ] List audio is not prefetched, playback starts only from an explicit action, the first Play starts the fetch, and subsequent playback can reuse normal private browser caching.
- [ ] Loading and playback failures are announced and offer Retry without breaking Card navigation or accompanying text.
- [ ] Search continues to match normalized front and back text only and ignores audio metadata and contents.
- [ ] Component and route tests prove separate navigation, face labels, duration rendering, audio-only management, one-at-a-time playback, Retry, lazy fetch, cache-compatible requests, and text-only search.
- [ ] Automated accessibility, explicit keyboard, touch-target, and stable mobile, tablet, and desktop screenshot checks cover text-plus-audio and audio-only rows.

## Comments

Implemented sibling list navigation/player actions, text-first face rendering, audio-only labels, face-specific lazy playback, shared coordination, Retry, and text-only search. Component tests and inspected mobile/tablet/desktop baselines cover the resulting list UI.
