# 05 — Record Card audio with the default microphone

**What to build:** Let the Learner record one continuous short clip for either Card face with the device's default microphone. Ask for permission only after an explicit Record action, show the remaining allowance, stop manually or automatically, and let the Learner preview, record again, remove, or save through the same draft flow as imported audio.

**Blocked by:** 03 — Create Cards from imported audio.

**Status:** done

- [ ] Microphone permission is requested only from an explicit Learner action and uses the default input device without offering device selection.
- [ ] Recording selects a supported `MediaRecorder` output at runtime, prefers a compressed format, and supports the compatible MP4/AAC fallback needed by iOS browsers.
- [ ] The editor shows understandable requesting, recording, stopped-preview, denied-permission, missing-device, and unsupported-recording states in German.
- [ ] A visible countdown tracks the seven-second allowance, Stop ends a take early, and recording stops automatically at the limit.
- [ ] The recording flow has no pause/resume, waveform editing, trimming, transcoding, silence detection, or loudness processing.
- [ ] Starting a recording stops current application playback so the app does not contaminate the captured audio.
- [ ] The Learner can preview the result, Record Again, remove it, or save it through the established staged upload and compensation flow.
- [ ] Denied, missing, or unsupported microphone access does not disable file selection or dropping.
- [ ] MediaRecorder and media-stream tests cover permission success and failure, default-device use, manual and automatic stop, output selection, countdown, Record Again, removal, object-URL revocation, playback coordination, and stopping every device track.
- [ ] Keyboard, screen-reader state, touch-target, reduced-motion, and responsive editor journeys pass at the supported viewport sizes.

## Comments

Implemented explicit default-microphone capture with Opus preference and MP4/AAC fallback, visible countdown, manual/automatic stop, preview/re-record/remove, playback coordination, and complete track cleanup. Deterministic MediaRecorder tests and supported responsive/accessibility browser journeys pass.
