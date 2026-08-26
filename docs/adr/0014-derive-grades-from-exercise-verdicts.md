# Derive Grades from Exercise verdicts

[ADR-0004](0004-use-manual-flashcard-grading.md) chose manual grading because one word has several
valid German meanings, which makes free-text translation unsuitable for automatic judgement. That
reasoning holds for free text and nowhere else: choosing the right back out of four candidates, or
pairing four Cards on one screen, has an objectively correct answer. Exercises with such a verdict
are graded by the app, and the verdict maps onto the existing `forgot` / `almost` / `knew_it` Grade;
the flip Card stays self-graded. ADR-0004 is amended, not superseded — no Exercise asks the Learner
to type a translation, precisely because that is the case ADR-0004 rules out.

The verdict is final: there is no "I was actually right" override. An override would make every
machine Grade advisory and would hand the Learner a one-tap way to undo any mistake, which defeats
the point of letting the app grade at all. The cost is that a mis-tap costs Box progress, and the
retry absorbs it: a first wrong answer knocks out the chosen option and re-asks, so a slip yields
`almost` (which holds the Box) rather than `forgot` (which resets it). Two-option Exercises have no
meaningful retry and are therefore binary — right promotes, wrong resets.

Recognition Exercises are easier than recall, so they will occasionally promote a Card the Learner
could not have produced from memory. We accept that inflation rather than capping promotions by Box.
A capped Exercise would have to tell the Learner "correct — and you stay where you are", and an
undeserved promotion self-corrects at the next Review, when she blanks on the Card and it drops
straight to Box 0.
