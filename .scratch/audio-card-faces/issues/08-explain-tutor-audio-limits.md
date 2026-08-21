# 08 — Explain Tutor limits for audio-only Cards

**What to build:** Keep the Tutor entry point available for every Card. When either face is audio-only, show a dedicated German explanation instead of making an AI request. When both faces contain text, preserve current Tutor behavior and send only the text even if audio accompanies it.

**Blocked by:** 03 — Create Cards from imported audio.

**Status:** ready-for-agent

- [ ] The Tutor button remains visible in its normal Review Session location for every valid face-media combination.
- [ ] Opening Tutor for a Card with either audio-only face shows a clear dedicated explanation and usable dialog focus behavior.
- [ ] The audio-only explanation performs no provider request and creates no Tutor allowance row.
- [ ] A Card with text on both faces keeps the existing Tutor conversation and rate-limit behavior when one or both faces also contain audio.
- [ ] Tutor provider input contains normalized front and back text only and never contains audio bytes, audio identifiers, storage keys, metadata, or transcription.
- [ ] Resource, provider, route, and accessibility tests cover audio-only front, audio-only back, audio on both faces, text-plus-audio, no-request/no-allowance behavior, and text-only regression behavior.

