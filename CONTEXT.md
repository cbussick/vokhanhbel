# Flashcard App

A private flashcard web app for spaced-repetition vocabulary study, used by a single household via a shared password.

## Language

**Learner**:
The single person whose Cards, Reviews, schedule, and Points the app represents. The Learner is Khanh even if another household member can access the app.
_Avoid_: User, account, profile

**Card**:
A fixed-direction pair of faces to be learned. Each face contains normalized text, one Clip, or both. A Card is created manually and is always reviewed from front to back.
_Avoid_: Flashcard, word

**Collection**:
A named group of Cards. Every Card belongs to exactly one Collection, which scopes the Card list,
front uniqueness, and a Review Session. Usually one Collection per learned language, but any grouping
the Learner wants. A Collection may declare a Face Language for each side of its Cards.
_Avoid_: Deck, set, category, folder

**Face Language**:
The language a Collection declares for one side of its Cards: one for the front, one for the back.
The Learner declares either, both, or neither, and changes them whenever she wants. A Face Language
is a full locale (`vi-VN`, `de-DE`, `en-US`), never a bare language code, so regional variants stay
distinguishable and map onto a spoken voice. It is chosen explicitly rather than derived from the
UI language, which would write a German-only assumption into stored data. Null means none declared;
nothing else stands for that, and a Collection declaring neither behaves exactly like a Collection
from before Face Languages existed. A locale the running build does not offer is kept as declared
rather than rewritten — whether it can be spoken is decided where it is used.
_Avoid_: Locale (the representation, not the concept), language code, TTS language, card language

**Clip**:
The short audio on a Card face: whatever the Learner wants to hear for it — the word, an
explanation, a mnemonic, a whole sentence. The app never learns what a Clip contains, which is why
no Clip is ever marked as mismatched with the face text. A face holds at most one, and every Clip is
either a Recording or a Generated Clip.
_Avoid_: Pronunciation (a Clip need not be one), sample, track, sound file, attachment

**Recording**:
A Clip that came from the Learner, whether recorded with the microphone or picked as a file. Nothing
is stored about what it says. Stored as `source: recorded`.
_Avoid_: Upload, voice memo, human audio, own audio

**Generated Clip**:
A Clip the app synthesized on the Learner's request, through the `SpeechProvider`. It additionally
records the Synthesized Text, provider, voice, and locale it was made from, so it can say what it
says and be made again. Stored as `source: generated`.
_Avoid_: TTS audio, AI audio, synthetic recording (it is not a Recording), robot voice

**Synthesized Text**:
The exact text a Generated Clip was made from, kept with the Clip and shown on the Card form. German
UI: Gesprochen. It may deliberately differ from the face text — a face reading `chào (hello)` can be
synthesized as `chào` — so it states a fact about the Clip and never claims that Clip and face still
agree. A Recording has none.
_Avoid_: Spoken text (that is what the Learner asks for, before there is a Clip), transcript,
caption, subtitle, stale (no Clip is ever stale)

**Topic**:
A named grouping of Cards inside one Collection. A Card may belong to many Topics in its Collection,
or to none. A Topic never spans Collections. German UI: Thema.
_Avoid_: Playlist, folder, tag, category, set, subcollection

**Box**:
A card's current position (0–5) in the Leitner scheduling ladder, determining how soon it becomes due again.
_Avoid_: Level, stage, interval

**Grade**:
The self-assessed recall outcome recorded when reviewing a card: `forgot`, `almost`, or `knew_it`.
_Avoid_: Rating, score, result

**Due**:
A card whose scheduled due time has passed, making it eligible for review.
_Avoid_: Pending, ready

**Review**:
A single append-only log entry recording one grading event for a card, including the grade, points awarded, and box before/after.
_Avoid_: Attempt, grading event

Retained Review snapshots preserve Card text and earned Points. They do not retain playable audio after a Clip is replaced, removed, or its Card is deleted.

**Review Submission**:
A client request to record a Grade as a Review. It may be pending, retried, or rejected; only an accepted Review Submission creates a Review.
_Avoid_: Pending Review, rejected Review, rejected Grade

**Session**:
A server-side authentication record created after the shared password is accepted, identified in the browser by an opaque cookie and valid for at most 30 days.
_Avoid_: JWT, access token, signed session

**Review Session**:
The client-side, non-persisted queue of due cards being studied in one sitting, ending at a session
summary. Covers one Collection, one Topic, or all Collections.
_Avoid_: Session (reserved for the auth session), study session

**Exercise**:
One task presented inside a Review Session. An Exercise covers one or more Cards and produces one
Review for each Card it grades. A retry stays part of the same Exercise. The Learner grades some
Exercises; the app grades others.
_Avoid_: Question, task, activity, drill, quiz

**Streak**:
The number of consecutive days on which the Learner completed at least one Exercise. A day on which
no Card was due neither extends nor breaks the Streak. Always derived, never stored as its own
counter.
_Avoid_: Series, chain, combo

**Points**:
The household's total score, always derived as the sum of points awarded across all Reviews, never stored as its own counter.
_Avoid_: Score, total

**Tutor**:
The AI explanation capability a Learner reaches from a Card or from a resolved Exercise: German-language, rate-limited, tool-free, and never retained outside the browser. Names the capability itself — its endpoint, contracts, problem types, and server code.
_Avoid_: Assistant, bot, chatbot

**Tutor Conversation**:
The messages exchanged between the Learner and Tutopher about one Card or one resolved Exercise, held only in the browser and discarded once the Learner leaves that Card. Bounded in length, so the Learner cannot continue past the limit without starting over.
_Avoid_: Chat, thread, history, session

**Tutopher**:
The Tutor's persona name. Belongs in user-facing copy, the mascot, and the system prompt — not in paths, identifiers, or contracts, which name the Tutor concept so the persona can be renamed without touching them.
