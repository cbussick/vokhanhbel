# Generate Pronunciation Audio Behind a Speech Provider Interface

A Card face needs a spoken form in the language it is written in, and the household records only
some of them by hand. We call Google Cloud Text-to-Speech only from backend code through a small
`SpeechProvider` interface — text, locale and voice in, encoded bytes with a content type out — so
the credential never reaches the browser, as
[ADR-0003](0003-use-hosted-ai-api-behind-provider-interface.md) does for the Tutor. Its
service-account key is long-lived and rotated by hand; we accept that.

One voice is pinned per supported locale in application code, neither stored nor chosen by the
Learner: the cost tier stays deliberate, output stays reproducible, and an upgrade is one edit.
Generation is Learner-triggered only — nothing on Card creation, nothing in the background, nothing
regenerated on its own — and a Generated Clip is synthesized once and stored through the staging and
claiming path a Recording already uses. Provenance on the audio asset separates the two.

Rejected: human-recorded datasets, because their coverage is partial and unpredictable, and a Card
that sometimes has a play button is worse than one that consistently has none; synthesis during a
Review Session, because of the latency it adds to the grading loop and because a word must sound
identical every session; and letting the Learner choose a voice or a provider.

Nothing compares a Generated Clip's Synthesized Text with the face text. An earlier plan to mark a Clip
stale on that comparison is retired: the two may deliberately differ, so the comparison judges
nothing.
