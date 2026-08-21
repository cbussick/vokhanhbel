# 03 — Create Cards from imported audio

**What to build:** Let the Learner choose or drop one short audio clip for either Card face, preview each draft, and save Cards containing text, audio, or both on each face. Keep drafts in browser memory until Save, upload front and back sequentially, and atomically claim staged audio only when the Card is created successfully.

**Blocked by:** 02 — Stage and play private audio through authenticated endpoints.

**Status:** ready-for-agent

- [ ] The editor provides an accessible click-to-select and drop zone for each face, accepts only one draft clip per face, and keeps file import available regardless of microphone support.
- [ ] Client validation gives immediate German feedback for unsupported, corrupt, oversized, or overlong clips while the server remains authoritative.
- [ ] The reusable styled player previews local drafts with Play, Pause, Replay, loading, progress, duration, and failure states; it has no seek, volume, speed, download, or full native controls.
- [ ] Player controls have visible focus, keyboard operation, accurate face-specific names and states, announced loading and errors, reduced-motion-compatible progress, and no autoplay.
- [ ] A shared playback coordinator ensures that starting one preview stops any other playing clip.
- [ ] The Learner can create all valid front/back combinations of text-only, text-plus-audio, and audio-only faces, while a face containing neither is rejected.
- [ ] Save uploads front and back drafts sequentially and only after the Learner submits; cancelling before Save intentionally publishes no draft.
- [ ] If either upload or Card creation fails, newly staged objects are cleaned up and no partial Card or claimed recording remains.
- [ ] Successful responses expose only safe audio metadata needed for labelling and playback, and created Cards retain the standard initial scheduling state.
- [ ] Route, component, HTTP-stack, accessibility, and responsive journey tests cover file selection, dropping, previews, every media combination, compensation, and text-only regression behavior.

