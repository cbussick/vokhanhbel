# Flashcard App

A private flashcard web app for spaced-repetition vocabulary study, used by a single household via a shared password.

## Language

**Learner**:
The single person whose Cards, Reviews, schedule, and Points the app represents. The Learner is Khanh even if another household member can access the app.
_Avoid_: User, account, profile

**Card**:
A fixed-direction pair of faces to be learned. Each face contains normalized text, one short audio recording, or both. A Card is created manually and is always reviewed from front to back.
_Avoid_: Flashcard, word

**Collection**:
A named group of Cards. Every Card belongs to exactly one Collection, which scopes the Card list,
front uniqueness, and a Review Session. Usually one Collection per learned language, but any grouping
the Learner wants.
_Avoid_: Deck, set, category, folder

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

Retained Review snapshots preserve Card text and earned Points. They do not retain playable audio after a recording is replaced, removed, or its Card is deleted.

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

**Points**:
The household's total score, always derived as the sum of points awarded across all Reviews, never stored as its own counter.
_Avoid_: Score, total

**Tutor**:
The AI explanation capability a Learner reaches from a Card: German-language, rate-limited, tool-free, and never retained outside the browser. Names the capability itself — its endpoint, contracts, problem types, and server code.
_Avoid_: Assistant, bot, chatbot

**Tutor Conversation**:
The messages exchanged between the Learner and Tutopher about one Card, held only in the browser and discarded once the Learner leaves that Card. Bounded in length, so the Learner cannot continue past the limit without starting over.
_Avoid_: Chat, thread, history, session

**Tutopher**:
The Tutor's persona name. Belongs in user-facing copy, the mascot, and the system prompt — not in paths, identifiers, or contracts, which name the Tutor concept so the persona can be renamed without touching them.
