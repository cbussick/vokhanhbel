# Generate Pronunciation Audio Behind a Speech Provider Interface

A Card face needs a dependable spoken form, and the household records only some by hand. We call
Google Cloud Text-to-Speech only from backend code through a small `SpeechProvider` interface —
text, locale and voice in, encoded bytes with a content type out — so the credential never reaches
the browser, as [ADR-0003](0003-use-hosted-ai-api-behind-provider-interface.md) does for the Tutor.
Its service-account key is long-lived and rotated by hand; we accept that.

One voice is pinned per supported locale in application code, neither stored nor chosen by the
Learner, so the cost tier stays deliberate, output stays reproducible, and an upgrade is one edit.
Generation is Learner-triggered only — nothing on Card creation, nothing in the background, nothing
regenerated on its own — and a Generated Clip is synthesized once and stored through the staging and
claiming path a Recording already uses, with provenance on the audio asset separating the two.

Rejected: human-recorded datasets, whose coverage is partial and unpredictable, and a Card that
sometimes has a play button is worse than one that consistently has none; synthesis during a Review
Session, which would add latency to the grading loop and let a word sound different from session to
session; and letting the Learner choose a voice or a provider.

Nothing compares a Generated Clip's Synthesized Text with its face text, and no Clip is ever marked
stale: the two may deliberately differ, so the comparison would judge nothing.
