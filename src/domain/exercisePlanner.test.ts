import { describe, expect, it } from "vitest";
import type { Card } from "../contracts/card.js";
import {
  leadingGroupedExerciseKind,
  planExercises,
  type MatchingExercise,
  type MultipleChoiceExercise,
  type SwipeExercise,
} from "./exercisePlanner.js";

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

  it("offers Swipe rather than multiple choice when fewer than three distinct sibling backs exist", () => {
    const target = card({ id: "1", back: text("die Katze") });
    const siblings = [
      card({ id: "2", back: text("der Hund") }),
      card({ id: "3", back: text("das Pferd") }),
    ];
    const pool = [target, ...siblings];

    // Two distractors: one short of multiple choice's three, and one more than Swipe needs. Swipe
    // takes it rather than letting it fall all the way to a flip Card.
    const plan = planExercises([target], pool, zero);

    expect(plan.map((exercise) => exercise.kind)).toEqual(["swipe"]);
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
    const exercise = plan[0] as SwipeExercise;

    // Two same-Sammlung siblings are one short of multiple choice, so this is Swipe — and its one
    // distractor still never reaches across into the other Sammlung.
    expect(exercise.kind).toBe("swipe");
    expect(exercise.options.map((option) => option.cardId)).not.toContain("4");
  });

  it("plans one Exercise per due Card, in the same order", () => {
    // Each in its own Sammlung, so none can supply another a distractor — nothing here is eligible
    // for multiple choice, Swipe, or matching, leaving plain per-Card flip planning to show through.
    const cards = [
      card({ id: "1", collectionId: collectionA, back: text("eins") }),
      card({ id: "2", collectionId: collectionB, back: text("zwei") }),
      card({ id: "3", collectionId: "ffffffff-ffff-4fff-8fff-ffffffffffff", back: text("drei") }),
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
    const pool = [target, ...siblings];

    // Only `target` is due, so nothing here competes for a grouped Exercise — this is purely about
    // whether the injected random source changes one multiple-choice Exercise's option order.
    const first = planExercises([target], pool, sequence([0, 0, 0, 0])) as [
      MultipleChoiceExercise,
      ...MultipleChoiceExercise[],
    ];
    const second = planExercises([target], pool, sequence([0.99, 0.5, 0.9, 0.1]));
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
    const exercise = plan[0] as SwipeExercise;

    // Only one text sibling is available, so three distractors can't be found and this falls to
    // Swipe — whose single distractor is that text sibling, never one of the audio-backed Cards.
    expect(exercise.kind).toBe("swipe");
    expect(exercise.options.map((option) => option.cardId).sort()).toEqual(["1", "4"]);
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

  it("still produces a complete Review Session, entirely of flip Cards, in a Sammlung too small even for Swipe", () => {
    // One shared back, so no Card here can find a distinct-text distractor: too little for matching
    // (needs four), for multiple choice (needs three distractors) and for Swipe (needs one).
    const cards = [
      card({ id: "1", back: text("gleich") }),
      card({ id: "2", back: text("gleich") }),
    ];

    const plan = planExercises(cards, cards, zero);

    expect(plan).toHaveLength(2);
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

  describe("matching", () => {
    function matchingReadyCard(id: string, front: string, back: string) {
      return card({ id, front: text(front), back: text(back) });
    }

    it("groups four eligible due Cards into one matching Exercise", () => {
      const cards = [
        matchingReadyCard("1", "eins", "one"),
        matchingReadyCard("2", "zwei", "two"),
        matchingReadyCard("3", "drei", "three"),
        matchingReadyCard("4", "vier", "four"),
      ];

      const plan = planExercises(cards, cards, zero);

      expect(plan).toHaveLength(1);
      const exercise = plan[0] as MatchingExercise;

      expect(exercise.kind).toBe("matching");
      expect(exercise.cards.map((matched) => matched.id)).toEqual(["1", "2", "3", "4"]);
      expect(new Set(exercise.frontOrder)).toEqual(new Set(["1", "2", "3", "4"]));
      expect(new Set(exercise.backOrder)).toEqual(new Set(["1", "2", "3", "4"]));
    });

    it("excludes a Card missing text on either face from matching eligibility", () => {
      const cards = [
        matchingReadyCard("1", "eins", "one"),
        matchingReadyCard("2", "zwei", "two"),
        matchingReadyCard("3", "drei", "three"),
        card({ id: "4", front: text("vier"), back: audio("audio-4") }),
        matchingReadyCard("5", "fuenf", "five"),
      ];

      const plan = planExercises(cards, cards, zero);
      const matching = plan.find((exercise) => exercise.kind === "matching");

      expect(matching?.cards.map((matched) => matched.id)).toEqual(["1", "2", "3", "5"]);
      // The audio-only-back Card is ineligible for matching and for multiple choice alike (both
      // need back text), so it falls back to its normal per-Card planning as a flip Card.
      expect(plan.find((exercise) => exercise.id === "4")?.kind).toBe("flip");
    });

    it("skips a Card that would duplicate another chosen Card's front or back within a column", () => {
      const cards = [
        matchingReadyCard("1", "eins", "one"),
        matchingReadyCard("2", "zwei", "two"),
        matchingReadyCard("3", "eins", "three"), // duplicate front, after normalization
        matchingReadyCard("4", "vier", "one"), // duplicate back, after normalization
        matchingReadyCard("5", "fuenf", "five"),
        matchingReadyCard("6", "sechs", "six"),
      ];

      const plan = planExercises(cards, cards, zero);
      const matching = plan.find((exercise) => exercise.kind === "matching") as MatchingExercise;

      expect(matching.cards.map((matched) => matched.id)).toEqual(["1", "2", "5", "6"]);
    });

    it("never draws a matching group across Sammlungen, even when four eligible Cards exist between them", () => {
      const cards = [
        card({
          id: "1",
          collectionId: collectionA,
          front: text("eins"),
          back: text("one"),
        }),
        card({
          id: "2",
          collectionId: collectionA,
          front: text("zwei"),
          back: text("two"),
        }),
        card({
          id: "3",
          collectionId: collectionB,
          front: text("drei"),
          back: text("three"),
        }),
        card({
          id: "4",
          collectionId: collectionB,
          front: text("vier"),
          back: text("four"),
        }),
      ];

      const plan = planExercises(cards, cards, zero);

      expect(plan.every((exercise) => exercise.kind !== "matching")).toBe(true);
    });

    it("falls back to per-Card planning entirely when fewer than four Cards are matching-eligible", () => {
      const cards = [
        matchingReadyCard("1", "eins", "one"),
        matchingReadyCard("2", "zwei", "two"),
        matchingReadyCard("3", "drei", "three"),
      ];

      const plan = planExercises(cards, cards, zero);

      expect(plan.every((exercise) => exercise.kind !== "matching")).toBe(true);
    });

    it("plans at most one matching Exercise per Session even with many eligible due Cards", () => {
      const cards = Array.from({ length: 8 }, (_, index) =>
        matchingReadyCard(`${index}`, `wort${index}`, `word${index}`),
      );

      const plan = planExercises(cards, cards, zero);

      expect(plan.filter((exercise) => exercise.kind === "matching")).toHaveLength(1);
    });

    it("places the matching Exercise at the position of the first Card it draws, preserving order", () => {
      // A back-audio-only Card is ineligible for both matching (needs text on both faces) and
      // multiple choice (needs back text), so it plans as a flip Card ahead of the matching group.
      const solo = card({ id: "solo", front: text("hallo"), back: audio("audio-solo") });
      const cards = [
        solo,
        matchingReadyCard("1", "eins", "one"),
        matchingReadyCard("2", "zwei", "two"),
        matchingReadyCard("3", "drei", "three"),
        matchingReadyCard("4", "vier", "four"),
      ];

      const plan = planExercises(cards, cards, zero);

      expect(plan.map((exercise) => exercise.kind)).toEqual(["flip", "matching"]);
    });
  });

  describe("swipe", () => {
    // Three Cards, isolated in their own Sammlung so each sees only the other two as distractor
    // candidates — exactly one short of multiple choice's three, and enough for Swipe's one.
    const swipeCollection = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

    function swipeReadyCard(id: string, back: string) {
      return card({ id, collectionId: swipeCollection, back: text(back) });
    }

    it("takes one Card that can supply a distractor but not three, and offers it two options", () => {
      const cards = [
        swipeReadyCard("1", "eins"),
        swipeReadyCard("2", "zwei"),
        swipeReadyCard("3", "drei"),
      ];

      const plan = planExercises(cards, cards, zero);
      const exercise = plan[0] as SwipeExercise;

      expect(exercise.kind).toBe("swipe");
      expect(exercise.cards.map((swiped) => swiped.id)).toEqual(["1"]);
      expect(exercise.options).toHaveLength(2);
      expect(exercise.options.filter((option) => option.correct)).toHaveLength(1);
      // One Swipe Exercise per Session, so the Cards behind it plan on their own.
      expect(plan.map((planned) => planned.kind)).toEqual(["swipe", "flip", "flip"]);
    });

    it("offers Swipe ahead of falling back to the flip Card", () => {
      const cards = [
        swipeReadyCard("1", "eins"),
        swipeReadyCard("2", "zwei"),
        swipeReadyCard("3", "drei"),
      ];

      const plan = planExercises(cards, cards, zero);

      expect(plan[0]!.kind).toBe("swipe");
    });

    it("falls back to a flip Card when no due Card can supply a distractor at all", () => {
      // One shared back, so neither Card has a distinct-text distractor to offer against.
      const cards = [swipeReadyCard("1", "gleich"), swipeReadyCard("2", "gleich")];

      const plan = planExercises(cards, cards, zero);

      expect(plan.map((exercise) => exercise.kind)).toEqual(["flip", "flip"]);
    });

    // Four Cards that can each supply three distinct distractors, so every one of them could have
    // been a multiple-choice Exercise. Whether Swipe is allowed to take them depends entirely on
    // whose turn it is — see `selectSwipeExercise`'s `leading` flag. Their shared front text keeps
    // matching from forming, so matching's turn genuinely falls through to Swipe.
    const multipleChoiceReadyCards = [
      card({ id: "1", back: text("die Katze") }),
      card({ id: "2", back: text("der Hund") }),
      card({ id: "3", back: text("das Pferd") }),
      card({ id: "4", back: text("die Kuh") }),
    ];

    it("leaves such a Card to multiple choice on matching's turn, when Swipe is only the fallback", () => {
      const plan = planExercises(multipleChoiceReadyCards, multipleChoiceReadyCards, zero);

      expect(plan.every((exercise) => exercise.kind !== "swipe")).toBe(true);
      expect(plan.find((exercise) => exercise.cards[0]!.id === "1")!.kind).toBe("multipleChoice");
    });

    it("claims such a Card on its own turn, leaving the rest of the queue to multiple choice", () => {
      const plan = planExercises(
        multipleChoiceReadyCards,
        multipleChoiceReadyCards,
        zero,
        "matching",
      );

      // The last is the third consecutive multiple choice, so the no-three-in-a-row rule demotes it.
      expect(plan.map((exercise) => exercise.kind)).toEqual([
        "swipe",
        "multipleChoice",
        "multipleChoice",
        "flip",
      ]);
      expect((plan[0] as SwipeExercise).cards.map((swiped) => swiped.id)).toEqual(["1"]);
    });

    it("never offers Swipe to a Card whose back is a recording", () => {
      const audioTarget = card({ id: "1", collectionId: swipeCollection, back: audio("audio-1") });
      const cards = [
        audioTarget,
        swipeReadyCard("2", "zwei"),
        swipeReadyCard("3", "drei"),
        swipeReadyCard("4", "vier"),
      ];

      const plan = planExercises(cards, cards, zero);

      expect(plan.find((exercise) => exercise.cards[0]!.id === "1")!.kind).not.toBe("swipe");
      const swipeExercise = plan.find((exercise) => exercise.kind === "swipe");

      expect(swipeExercise?.cards.some((swiped) => swiped.id === "1")).toBe(false);
    });

    describe("alternation with matching", () => {
      // Four Cards eligible for matching (text on both faces, distinct front and back) plus three
      // more, isolated in their own Sammlung and missing front text, so they can only ever be
      // Swipe's — never matching's, since matching requires front text too. Either grouped kind can
      // be planned from this due queue; which one actually is depends only on `previousGroupedKind`.
      const matchingCards = [
        card({ id: "m1", front: text("eins"), back: text("one") }),
        card({ id: "m2", front: text("zwei"), back: text("two") }),
        card({ id: "m3", front: text("drei"), back: text("three") }),
        card({ id: "m4", front: text("vier"), back: text("four") }),
      ];
      const swipeCards = [
        swipeReadyCard("s1", "fuenf"),
        swipeReadyCard("s2", "sechs"),
        swipeReadyCard("s3", "sieben"),
      ];
      const cards = [...matchingCards, ...swipeCards];

      it("plans matching when no previous Session's grouped kind is on record", () => {
        const plan = planExercises(cards, cards, zero);

        expect(plan.some((exercise) => exercise.kind === "matching")).toBe(true);
        expect(plan.some((exercise) => exercise.kind === "swipe")).toBe(false);
      });

      it("plans Swipe when the previous Session's grouped kind was matching", () => {
        const plan = planExercises(cards, cards, zero, "matching");

        expect(plan.some((exercise) => exercise.kind === "swipe")).toBe(true);
        expect(plan.some((exercise) => exercise.kind === "matching")).toBe(false);
      });

      it("plans matching when the previous Session's grouped kind was Swipe", () => {
        const plan = planExercises(cards, cards, zero, "swipe");

        expect(plan.some((exercise) => exercise.kind === "matching")).toBe(true);
        expect(plan.some((exercise) => exercise.kind === "swipe")).toBe(false);
      });

      it("still plans the only kind available even when it is not the preferred one", () => {
        // No matching-eligible Cards here at all, so matching can never win regardless of preference.
        const plan = planExercises(swipeCards, swipeCards, zero, "swipe");

        expect(plan.some((exercise) => exercise.kind === "swipe")).toBe(true);
      });

      it("names the kind leading the attempt for a given previous Session", () => {
        expect(leadingGroupedExerciseKind(undefined)).toBe("matching");
        expect(leadingGroupedExerciseKind("swipe")).toBe("matching");
        expect(leadingGroupedExerciseKind("matching")).toBe("swipe");
      });
    });
  });
});
