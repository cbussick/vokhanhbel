import { describe, expect, it, vi } from "vitest";
import type { TutorInput } from "../../contracts/tutor.js";
import type { AiProvider, TutorProviderRequest } from "../ai/aiProvider.js";
import { createTutorResponse } from "./tutor.js";

const subjectCard = { front: "der Apfel", back: "the apple" };
const subjectCardId = "11111111-1111-4111-8111-111111111111";

function baseInput(overrides: Partial<TutorInput>): TutorInput {
  return {
    message: "Bitte erklären",
    messages: [{ role: "user", content: "Ein Beispiel?" }],
    subjectCardId,
    exerciseCards: [{ cardId: subjectCardId, outcome: null }],
    chosenOptionText: null,
    ...overrides,
  };
}

function captureProvider() {
  let received: TutorProviderRequest | undefined;
  const provider: AiProvider = {
    async *streamTutorReply(request) {
      received = request;
      yield { type: "delta", text: "Ein Apfel ist eine Frucht." };
      yield { type: "done", truncated: false };
    },
  };

  return { provider, requestRef: () => received };
}

describe("Tutor provider boundary", () => {
  it("passes a flip Card's Exercise with no outcome and no chosen option", async () => {
    const { provider, requestRef } = captureProvider();
    const input = baseInput({});
    const exercise = {
      subjectCard,
      exerciseCards: [{ ...subjectCard, outcome: null }],
      chosenOptionText: null,
    };

    const response = createTutorResponse(exercise, input, provider, new AbortController().signal);
    const body = await response.text();

    expect(requestRef()).toEqual({ ...exercise, input, signal: expect.any(AbortSignal) });
    expect(Object.keys(requestRef() ?? {}).sort()).toEqual(
      ["chosenOptionText", "exerciseCards", "input", "signal", "subjectCard"].sort(),
    );
    expect(body).toContain("event: delta");
    expect(body).toContain("Ein Apfel ist eine Frucht.");
    expect(body).toContain("event: done");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("passes a resolved multiple-choice Exercise's correct outcome and chosen option", async () => {
    const { provider, requestRef } = captureProvider();
    const input = baseInput({
      exerciseCards: [{ cardId: subjectCardId, outcome: "knew_it" }],
      chosenOptionText: "the apple",
    });
    const exercise = {
      subjectCard,
      exerciseCards: [{ ...subjectCard, outcome: "knew_it" as const }],
      chosenOptionText: "the apple",
    };

    const response = createTutorResponse(exercise, input, provider, new AbortController().signal);
    await response.text();

    expect(requestRef()).toEqual({ ...exercise, input, signal: expect.any(AbortSignal) });
  });

  it("passes an incorrect outcome together with the option the Learner chose", async () => {
    const { provider, requestRef } = captureProvider();
    const input = baseInput({
      exerciseCards: [{ cardId: subjectCardId, outcome: "forgot" }],
      chosenOptionText: "the peach",
    });
    const exercise = {
      subjectCard,
      exerciseCards: [{ ...subjectCard, outcome: "forgot" as const }],
      chosenOptionText: "the peach",
    };

    const response = createTutorResponse(exercise, input, provider, new AbortController().signal);
    await response.text();

    expect(requestRef()).toEqual({ ...exercise, input, signal: expect.any(AbortSignal) });
  });

  it("turns provider failures into a safe stream error without leaking details", async () => {
    const provider: AiProvider = {
      async *streamTutorReply() {
        throw new Error("secret provider diagnostics");
      },
    };
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = createTutorResponse(
      { subjectCard, exerciseCards: [{ ...subjectCard, outcome: null }], chosenOptionText: null },
      baseInput({ message: "Warum?" }),
      provider,
      new AbortController().signal,
    );

    expect(await response.text()).toBe('event: error\ndata: {"type":"/problems/tutor-failed"}\n\n');
    expect(consoleSpy).not.toHaveBeenCalled();
  });
});
