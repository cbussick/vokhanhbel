# Flashcard App

A private flashcard web app for spaced-repetition vocabulary study, used by a single household via a shared password.

## Language

**Learner**:
The single person whose Cards, Reviews, schedule, and Points the app represents. In V1, the Learner is Khanh even if another household member can access the app.
_Avoid_: User, account, profile

**Card**:
A front/back text pair to be learned, created manually.
_Avoid_: Flashcard, word

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

**Review Submission**:
A client request to record a Grade as a Review. It may be pending, retried, or rejected; only an accepted Review Submission creates a Review.
_Avoid_: Pending Review, rejected Review, rejected Grade

**Session**:
A server-side authentication record created after the shared password is accepted, identified in the browser by an opaque cookie and valid for at most 30 days.
_Avoid_: JWT, access token, signed session

**Review Session**:
The client-side, non-persisted queue of due cards being studied in one sitting, ending at a session summary.
_Avoid_: Session (reserved for the auth session), study session

**Points**:
The household's total score, always derived as the sum of points awarded across all Reviews, never stored as its own counter.
_Avoid_: Score, total

**Khunhphap**:
The named AI tutor persona surfaced in UI copy when a user asks about a card.
_Avoid_: AI tutor, assistant
