import { describe, expect, it } from "vitest";
import type { Card } from "../contracts/card.js";
import { planExercises, type MultipleChoiceExercise } from "./exercisePlanner.js";

const collectionA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const collectionB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const topicAnimals = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const topicFood = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function card(overrides: Partial<Card> & { id: string; back: Card["back"] }): Card {
  const now = new Date().toISOString();

  return {
    collectionId: collectionA,
    topicIds: [],
    front: { text: "front", audio: null },
    box: 0,
    dueAt: now,
    lastReviewedAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

function text(value: string) {
  return { text: value, audio: null };
}

function audio(id: string) {
  return {
    text: null,
    audio: { id, durationMs: 1_000, contentType: "audio/wav" as const, byteSize: 8_044 },
  };
}

/** Deterministic random source: cycles through the given sequence, repeating the last value. */
function sequence(values: number[]) {
  let index = 0;

  return () => values[Math.min(index++, values.length - 1)]!;
}

const zero = () => 0;

describe("planExercises", () => {
  it("plans a multiple-choice Exercise for a Card with three sibling backs in its Sammlung", () => {
    const target = card({ id: "1", back: text("die Katze") });
    const siblings = [
      card({ id: "2", back: text("der Hund") }),
      card({ id: "3", back: text("das Pferd") }),
      card({ id: "4", back: text("die Kuh") }),
    ];
    const pool = [target, ...siblings];

    const plan = planExercises(pool, pool, zero);

    expect(plan).toHaveLength(4);
    const exercise = plan.find((planned) => planned.cards[0]!.id === "1")!;

    expect(exercise.kind).toBe("multipleChoice");
    const multipleChoice = exercise as MultipleChoiceExercise;

    expect(multipleChoice.options).toHaveLength(4);
    expect(multipleChoice.options.filter((option) => option.correct)).toEqual([
      { cardId: "1", text: "die Katze", audio: null, correct: true },
    ]);
    expect(new Set(multipleChoice.options.map((option) => option.cardId)).size).toBe(4);
  });

  it("falls back to a flip Card when fewer than three distinct sibling backs are available", () => {
    const target = card({ id: "1", back: text("die Katze") });
    const siblings = [
      card({ id: "2", back: text("der Hund") }),
      card({ id: "3", back: text("das Pferd") }),
    ];
    const pool = [target, ...siblings];

    const plan = planExercises(pool, pool, zero);
    const exercise = plan.find((planned) => planned.cards[0]!.id === "1")!;

    expect(exercise).toEqual({ kind: "flip", id: "1", cards: [target] });
  });

  it("falls back to a flip Card when a Card's back has no text", () => {
    const target = card({ id: "1", back: { text: null, audio: null } });
    const siblings = [
      card({ id: "2", back: text("der Hund") }),
      card({ id: "3", back: text("das Pferd") }),
      card({ id: "4", back: text("die Kuh") }),
    ];
    const pool = [target, ...siblings];

    const plan = planExercises(pool, pool, zero);
    const exercise = plan.find((planned) => planned.cards[0]!.id === "1")!;

    expect(exercise).toEqual({ kind: "flip", id: "1", cards: [target] });
  });

  it("never draws a distractor whose back normalizes to the same text as the correct back", () => {
    const target = card({ id: "1", back: text("die Katze") });
    const siblings = [
      card({ id: "2", back: text("die   Katze") }), // same after whitespace normalization
      card({ id: "3", back: text("der Hund") }),
      card({ id: "4", back: text("das Pferd") }),
      card({ id: "5", back: text("die Kuh") }),
    ];
    const pool = [target, ...siblings];

    const plan = planExercises(pool, pool, zero);
    const exercise = plan.find(
      (planned) => planned.cards[0]!.id === "1",
    )! as MultipleChoiceExercise;

    expect(exercise.kind).toBe("multipleChoice");
    expect(exercise.options.some((option) => option.cardId === "2")).toBe(false);
  });

  it("never draws two distractors with the same normalized back text", () => {
    const target = card({ id: "1", back: text("die Katze") });
    const siblings = [
      card({ id: "2", back: text("der Hund") }),
      card({ id: "3", back: text("der Hund") }),
      card({ id: "4", back: text("das Pferd") }),
      card({ id: "5", back: text("die Kuh") }),
    ];
    const pool = [target, ...siblings];

    const plan = planExercises(pool, pool, zero);
    const exercise = plan.find(
      (planned) => planned.cards[0]!.id === "1",
    )! as MultipleChoiceExercise;
    const backs = exercise.options.map((option) => option.text!.trim().toLowerCase());

    expect(new Set(backs).size).toBe(backs.length);
  });

  it("draws distractors only from the same Sammlung, never across Sammlungen", () => {
    const target = card({ id: "1", collectionId: collectionA, back: text("die Katze") });
    const sameCollection = [
      card({ id: "2", collectionId: collectionA, back: text("der Hund") }),
      card({ id: "3", collectionId: collectionA, back: text("das Pferd") }),
    ];
    const otherCollection = [card({ id: "4", collectionId: collectionB, back: text("die Kuh") })];
    const pool = [target, ...sameCollection, ...otherCollection];

    const plan = planExercises([target], pool, zero);
    const exercise = plan.find((planned) => planned.cards[0]!.id === "1")!;

    expect(exercise.kind).toBe("flip");
  });

  it("plans one Exercise per due Card, in the same order", () => {
    const cards = [
      card({ id: "1", back: text("eins") }),
      card({ id: "2", back: text("zwei") }),
      card({ id: "3", back: text("drei") }),
    ];

    const plan = planExercises(cards, cards, zero);

    expect(plan.map((exercise) => exercise.cards[0]!.id)).toEqual(["1", "2", "3"]);
  });

  it("shuffles the option order using the injected random source", () => {
    const target = card({ id: "1", back: text("die Katze") });
    const siblings = [
      card({ id: "2", back: text("der Hund") }),
      card({ id: "3", back: text("das Pferd") }),
      card({ id: "4", back: text("die Kuh") }),
    ];
    const cards = [target, ...siblings];

    const first = planExercises(cards, cards, sequence([0, 0, 0, 0])) as [
      MultipleChoiceExercise,
      ...MultipleChoiceExercise[],
    ];
    const second = planExercises(cards, cards, sequence([0.99, 0.5, 0.9, 0.1]));
    const secondExercise = second.find(
      (planned) => planned.cards[0]!.id === "1",
    )! as MultipleChoiceExercise;
    const firstExercise = first.find((planned) => planned.cards[0]!.id === "1")!;

    expect(secondExercise.options.map((option) => option.cardId)).not.toEqual(
      firstExercise.options.map((option) => option.cardId),
    );
  });

  it("returns an empty plan for an empty due Card list", () => {
    expect(planExercises([], [], zero)).toEqual([]);
  });

  describe("Thema-then-Sammlung pool", () => {
    it("draws distractors from the Card's own Thema before the rest of the Sammlung", () => {
      const target = card({
        id: "1",
        topicIds: [topicAnimals],
        back: text("die Katze"),
      });
      const inThema = [
        card({ id: "2", topicIds: [topicAnimals], back: text("der Hund") }),
        card({ id: "3", topicIds: [topicAnimals], back: text("das Pferd") }),
        card({ id: "4", topicIds: [topicAnimals], back: text("die Kuh") }),
      ];
      // Elsewhere in the Sammlung, no Thema in common with the target.
      const restOfSammlung = [
        card({ id: "5", topicIds: [topicFood], back: text("das Brot") }),
        card({ id: "6", topicIds: [topicFood], back: text("der Kaese") }),
      ];
      const pool = [target, ...inThema, ...restOfSammlung];

      const plan = planExercises([target], pool, zero);
      const exercise = plan[0] as MultipleChoiceExercise;

      expect(exercise.kind).toBe("multipleChoice");
      const distractorIds = exercise.options
        .filter((option) => !option.correct)
        .map((option) => option.cardId);

      expect(new Set(distractorIds)).toEqual(new Set(["2", "3", "4"]));
    });

    it("widens to the rest of the Sammlung when the Thema cannot supply three distractors", () => {
      const target = card({
        id: "1",
        topicIds: [topicAnimals],
        back: text("die Katze"),
      });
      const inThema = [card({ id: "2", topicIds: [topicAnimals], back: text("der Hund") })];
      const restOfSammlung = [
        card({ id: "3", topicIds: [topicFood], back: text("das Brot") }),
        card({ id: "4", topicIds: [], back: text("der Kaese") }),
      ];
      const pool = [target, ...inThema, ...restOfSammlung];

      const plan = planExercises([target], pool, zero);
      const exercise = plan[0] as MultipleChoiceExercise;

      expect(exercise.kind).toBe("multipleChoice");
      const distractorIds = exercise.options
        .filter((option) => !option.correct)
        .map((option) => option.cardId);

      expect(new Set(distractorIds)).toEqual(new Set(["2", "3", "4"]));
    });

    it("draws from every Thema a Card belongs to before widening to the Sammlung", () => {
      const target = card({
        id: "1",
        topicIds: [topicAnimals, topicFood],
        back: text("die Katze"),
      });
      const inAnimals = card({ id: "2", topicIds: [topicAnimals], back: text("der Hund") });
      const inFood = card({ id: "3", topicIds: [topicFood], back: text("das Brot") });
      const inBoth = card({
        id: "4",
        topicIds: [topicAnimals, topicFood],
        back: text("die Kuh"),
      });
      // Belongs to neither Thema the target is in — only reachable by widening to the Sammlung.
      const outsideThema = card({ id: "5", topicIds: [], back: text("der Tisch") });
      const pool = [target, inAnimals, inFood, inBoth, outsideThema];

      const plan = planExercises([target], pool, zero);
      const exercise = plan[0] as MultipleChoiceExercise;

      const distractorIds = exercise.options
        .filter((option) => !option.correct)
        .map((option) => option.cardId);

      expect(new Set(distractorIds)).toEqual(new Set(["2", "3", "4"]));
    });

    it("never crosses into another Sammlung even when the pool is wider than the due queue", () => {
      const target = card({ id: "1", collectionId: collectionA, back: text("die Katze") });
      const otherCollection = [
        card({ id: "2", collectionId: collectionB, back: text("der Hund") }),
        card({ id: "3", collectionId: collectionB, back: text("das Pferd") }),
        card({ id: "4", collectionId: collectionB, back: text("die Kuh") }),
      ];
      const pool = [target, ...otherCollection];

      const plan = planExercises([target], pool, zero);

      expect(plan[0]!.kind).toBe("flip");
    });
  });

  it("excludes distractor candidates whose back is audio-only, matching the correct back's modality", () => {
    const target = card({ id: "1", back: text("die Katze") });
    const audioOnly = [
      card({ id: "2", back: audio("audio-2") }),
      card({ id: "3", back: audio("audio-3") }),
    ];
    const textSiblings = [card({ id: "4", back: text("das Pferd") })];
    const pool = [target, ...audioOnly, ...textSiblings];

    const plan = planExercises([target], pool, zero);

    // Only one text sibling is available, so three distractors can't be found.
    expect(plan[0]!.kind).toBe("flip");
  });

  it("excludes deleted Cards from the distractor pool", () => {
    const target = card({ id: "1", back: text("die Katze") });
    const siblings = [
      card({ id: "2", back: text("der Hund") }),
      card({ id: "3", back: text("das Pferd") }),
      card({ id: "4", back: text("die Kuh"), deletedAt: new Date().toISOString() }),
      card({ id: "5", back: text("die Ente") }),
    ];
    const pool = [target, ...siblings];

    const plan = planExercises([target], pool, zero);
    const exercise = plan[0] as MultipleChoiceExercise;

    expect(exercise.kind).toBe("multipleChoice");
    const distractorIds = exercise.options
      .filter((option) => !option.correct)
      .map((option) => option.cardId);

    expect(distractorIds).not.toContain("4");
  });

  it("still produces a complete Review Session, entirely of flip Cards, in a Sammlung with fewer than four text Cards", () => {
    const cards = [
      card({ id: "1", back: text("eins") }),
      card({ id: "2", back: text("zwei") }),
      card({ id: "3", back: text("drei") }),
    ];

    const plan = planExercises(cards, cards, zero);

    expect(plan).toHaveLength(3);
    expect(plan.every((exercise) => exercise.kind === "flip")).toBe(true);
  });

  it("plans audio multiple-choice Exercises in a Sammlung where most Cards carry recordings, still completing the Session", () => {
    const cards = [
      card({ id: "1", back: text("eins") }),
      card({ id: "2", back: audio("audio-2") }),
      card({ id: "3", back: audio("audio-3") }),
      card({ id: "4", back: audio("audio-4") }),
      card({ id: "5", back: audio("audio-5") }),
    ];

    const plan = planExercises(cards, cards, zero);

    expect(plan).toHaveLength(5);
    // The lone text Card has no text sibling at all, so it falls back to flip; every audio-backed
    // Card has three audio siblings and is offered audio options instead of also falling back.
    expect(plan.find((exercise) => exercise.cards[0]!.id === "1")!.kind).toBe("flip");
    expect(plan.some((exercise) => exercise.kind === "multipleChoice")).toBe(true);
  });

  describe("audio distractor pool", () => {
    it("plans an audio multiple-choice Exercise for a Card with three sibling recordings in its Sammlung", () => {
      const target = card({ id: "1", back: audio("audio-1") });
      const siblings = [
        card({ id: "2", back: audio("audio-2") }),
        card({ id: "3", back: audio("audio-3") }),
        card({ id: "4", back: audio("audio-4") }),
      ];
      const pool = [target, ...siblings];

      const plan = planExercises(pool, pool, zero);
      const exercise = plan.find(
        (planned) => planned.cards[0]!.id === "1",
      )! as MultipleChoiceExercise;

      expect(exercise.kind).toBe("multipleChoice");
      expect(exercise.options).toHaveLength(4);
      expect(exercise.options.every((option) => option.text === null && option.audio)).toBe(true);
      expect(exercise.options.filter((option) => option.correct)).toEqual([
        {
          cardId: "1",
          text: null,
          audio: { id: "audio-1", durationMs: 1_000, contentType: "audio/wav", byteSize: 8_044 },
          correct: true,
        },
      ]);
      expect(new Set(exercise.options.map((option) => option.cardId)).size).toBe(4);
    });

    it("falls back to a flip Card when fewer than three sibling recordings are available", () => {
      const target = card({ id: "1", back: audio("audio-1") });
      const siblings = [
        card({ id: "2", back: audio("audio-2") }),
        card({ id: "3", back: audio("audio-3") }),
      ];
      const pool = [target, ...siblings];

      const plan = planExercises(pool, pool, zero);
      const exercise = plan.find((planned) => planned.cards[0]!.id === "1")!;

      expect(exercise).toEqual({ kind: "flip", id: "1", cards: [target] });
    });

    it("excludes distractor candidates whose back is text-only, matching the correct back's audio modality", () => {
      const target = card({ id: "1", back: audio("audio-1") });
      const textOnly = [card({ id: "2", back: text("Text") })];
      const audioSiblings = [
        card({ id: "3", back: audio("audio-3") }),
        card({ id: "4", back: audio("audio-4") }),
      ];
      const pool = [target, ...textOnly, ...audioSiblings];

      const plan = planExercises([target], pool, zero);

      // Only two audio siblings are available, so three distractors can't be found.
      expect(plan[0]!.kind).toBe("flip");
    });

    it("falls back rather than repeating an option when two siblings share the same recording", () => {
      const target = card({ id: "1", back: audio("audio-1") });
      const siblings = [
        card({ id: "2", back: audio("audio-2") }),
        card({ id: "3", back: audio("audio-2") }), // the same recording as "2"
        card({ id: "4", back: audio("audio-4") }),
      ];
      const pool = [target, ...siblings];

      const plan = planExercises([target], pool, zero);

      // Only two distinct recordings ("audio-2" and "audio-4") are available among the siblings.
      expect(plan[0]!.kind).toBe("flip");
    });

    it("never offers text and audio options in the same Exercise", () => {
      const audioTarget = card({ id: "1", back: audio("audio-1") });
      const audioSiblings = [
        card({ id: "2", back: audio("audio-2") }),
        card({ id: "3", back: audio("audio-3") }),
        card({ id: "4", back: audio("audio-4") }),
      ];
      const textTarget = card({ id: "5", back: text("fünf") });
      const textSiblings = [
        card({ id: "6", back: text("sechs") }),
        card({ id: "7", back: text("sieben") }),
        card({ id: "8", back: text("acht") }),
      ];
      const pool = [audioTarget, ...audioSiblings, textTarget, ...textSiblings];

      // Each planned on its own, so the no-three-in-a-row rule (covered separately below) cannot
      // demote either — this test is only about modality never mixing within one Exercise's pool.
      const audioExercise = planExercises([audioTarget], pool, zero)[0] as MultipleChoiceExercise;
      const textExercise = planExercises([textTarget], pool, zero)[0] as MultipleChoiceExercise;

      expect(audioExercise.kind).toBe("multipleChoice");
      expect(textExercise.kind).toBe("multipleChoice");
      expect(
        audioExercise.options.every((option) => option.audio !== null && option.text === null),
      ).toBe(true);
      expect(
        textExercise.options.every((option) => option.text !== null && option.audio === null),
      ).toBe(true);
    });
  });

  describe("no-three-in-a-row", () => {
    function multipleChoiceReadyCards(count: number): Card[] {
      const siblings = [
        card({ id: "s1", back: text("der Hund") }),
        card({ id: "s2", back: text("das Pferd") }),
        card({ id: "s3", back: text("die Kuh") }),
      ];

      const targets = Array.from({ length: count }, (_, index) =>
        card({ id: `t${index}`, back: text(`Wort ${index}`) }),
      );

      return [...targets, ...siblings];
    }

    it("demotes a would-be third consecutive multiple-choice Exercise to a flip Card", () => {
      const cards = multipleChoiceReadyCards(4);
      const dueCards = cards.filter((c) => c.id.startsWith("t"));

      const plan = planExercises(dueCards, cards, zero);

      expect(plan.map((exercise) => exercise.kind)).toEqual([
        "multipleChoice",
        "multipleChoice",
        "flip",
        "multipleChoice",
      ]);
    });

    it("lets a run of flip Cards stand when nothing is multiple-choice eligible, rather than inventing eligibility to satisfy variety", () => {
      // All four Cards share one back, so no Card can find a distinct-back distractor at all —
      // there is no multiple-choice Exercise here to demote in the first place.
      const cards = [
        card({ id: "1", back: text("gleich") }),
        card({ id: "2", back: text("gleich") }),
        card({ id: "3", back: text("gleich") }),
        card({ id: "4", back: text("gleich") }),
      ];

      const plan = planExercises(cards, cards, zero);

      expect(plan.map((exercise) => exercise.kind)).toEqual(["flip", "flip", "flip", "flip"]);
    });
  });
});
