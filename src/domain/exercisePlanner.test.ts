import { describe, expect, it } from "vitest";
import type { Card } from "../contracts/card.js";
import { planExercises, type MultipleChoiceExercise } from "./exercisePlanner.js";

function card(overrides: Partial<Card> & { id: string; back: Card["back"] }): Card {
  const now = new Date().toISOString();

  return {
    collectionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
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

/** Deterministic random source: cycles through the given sequence, repeating the last value. */
function sequence(values: number[]) {
  let index = 0;

  return () => values[Math.min(index++, values.length - 1)]!;
}

const zero = () => 0;

describe("planExercises", () => {
  it("plans a multiple-choice Exercise for a Card with three sibling backs in its Collection", () => {
    const target = card({ id: "1", back: text("die Katze") });
    const siblings = [
      card({ id: "2", back: text("der Hund") }),
      card({ id: "3", back: text("das Pferd") }),
      card({ id: "4", back: text("die Kuh") }),
    ];

    const plan = planExercises([target, ...siblings], zero);

    expect(plan).toHaveLength(4);
    const exercise = plan.find((planned) => planned.cards[0]!.id === "1")!;

    expect(exercise.kind).toBe("multipleChoice");
    const multipleChoice = exercise as MultipleChoiceExercise;

    expect(multipleChoice.options).toHaveLength(4);
    expect(multipleChoice.options.filter((option) => option.correct)).toEqual([
      { cardId: "1", text: "die Katze", correct: true },
    ]);
    expect(new Set(multipleChoice.options.map((option) => option.cardId)).size).toBe(4);
  });

  it("falls back to a flip Card when fewer than three distinct sibling backs are available", () => {
    const target = card({ id: "1", back: text("die Katze") });
    const siblings = [
      card({ id: "2", back: text("der Hund") }),
      card({ id: "3", back: text("das Pferd") }),
    ];

    const plan = planExercises([target, ...siblings], zero);
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

    const plan = planExercises([target, ...siblings], zero);
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

    const plan = planExercises([target, ...siblings], zero);
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

    const plan = planExercises([target, ...siblings], zero);
    const exercise = plan.find(
      (planned) => planned.cards[0]!.id === "1",
    )! as MultipleChoiceExercise;
    const backs = exercise.options.map((option) => option.text.trim().toLowerCase());

    expect(new Set(backs).size).toBe(backs.length);
  });

  it("draws distractors only from the same Collection", () => {
    const target = card({
      id: "1",
      collectionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      back: text("die Katze"),
    });
    const sameCollection = [
      card({ id: "2", collectionId: target.collectionId, back: text("der Hund") }),
      card({ id: "3", collectionId: target.collectionId, back: text("das Pferd") }),
    ];
    const otherCollection = [
      card({
        id: "4",
        collectionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        back: text("die Kuh"),
      }),
    ];

    const plan = planExercises([target, ...sameCollection, ...otherCollection], zero);
    const exercise = plan.find((planned) => planned.cards[0]!.id === "1")!;

    expect(exercise.kind).toBe("flip");
  });

  it("plans one Exercise per due Card, in the same order", () => {
    const cards = [
      card({ id: "1", back: text("eins") }),
      card({ id: "2", back: text("zwei") }),
      card({ id: "3", back: text("drei") }),
    ];

    const plan = planExercises(cards, zero);

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

    const first = planExercises(cards, sequence([0, 0, 0, 0])) as [
      MultipleChoiceExercise,
      ...MultipleChoiceExercise[],
    ];
    const second = planExercises(cards, sequence([0.99, 0.5, 0.9, 0.1]));
    const secondExercise = second.find(
      (planned) => planned.cards[0]!.id === "1",
    )! as MultipleChoiceExercise;
    const firstExercise = first.find((planned) => planned.cards[0]!.id === "1")!;

    expect(secondExercise.options.map((option) => option.cardId)).not.toEqual(
      firstExercise.options.map((option) => option.cardId),
    );
  });

  it("returns an empty plan for an empty due Card list", () => {
    expect(planExercises([], zero)).toEqual([]);
  });
});
