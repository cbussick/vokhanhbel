import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetServerEnvironmentForTests } from "../config/environment.js";
import { createOpenAiProvider } from "./aiProvider.js";

const { createResponse } = vi.hoisted(() => ({ createResponse: vi.fn() }));

// These tests cover the OpenAI adapter itself, which constructs the client. Injecting a seam here
// would only move the boundary and leave the adapter untested. Consumers use AiProvider instead.
// oxlint-disable-next-line anti-slop/no-module-mocking -- adapter test needs the real SDK faked
vi.mock("openai", () => ({
  default: class OpenAiMock {
    responses = { create: createResponse };
  },
}));

const subjectCard = { front: "front", back: "back" };

async function* stream(events: unknown[]) {
  yield* events;
}

// Draining only, the prompt-content tests inspect the underlying mock's call arguments instead.
async function drain(events: AsyncIterable<unknown>): Promise<void> {
  const iterator = events[Symbol.asyncIterator]();
  let step = await iterator.next();

  while (!step.done) step = await iterator.next();
}

async function collectProviderEvents(events: unknown[]) {
  createResponse.mockResolvedValue(stream(events));
  const provider = createOpenAiProvider();
  const collected = [];

  for await (const event of provider.streamTutorReply({
    subjectCard,
    exerciseCards: [{ ...subjectCard, outcome: null }],
    chosenOptionText: null,
    input: {
      message: "question",
      messages: [],
      subjectCardId: "11111111-1111-4111-8111-111111111111",
      exerciseCards: [{ cardId: "11111111-1111-4111-8111-111111111111", outcome: null }],
      chosenOptionText: null,
    },
    signal: new AbortController().signal,
  })) {
    collected.push(event);
  }

  return collected;
}

describe("OpenAI Responses terminal events", () => {
  beforeEach(() => {
    Object.assign(process.env, {
      APP_PASSWORD_HASH: "test",
      DATABASE_URL: "postgresql://localhost/test",
      OPENAI_API_KEY: "test",
      OPENAI_MODEL: "test-model",
      RATE_LIMIT_HMAC_SECRET: "test-only-secret-at-least-thirty-two-characters",
    });
    resetServerEnvironmentForTests();
    createResponse.mockReset();
  });

  it("keeps text only when incompleteness is caused by the output-token limit", async () => {
    await expect(
      collectProviderEvents([
        { type: "response.output_text.delta", delta: "partial" },
        {
          type: "response.incomplete",
          response: { incomplete_details: { reason: "max_output_tokens" } },
        },
      ]),
    ).resolves.toEqual([
      { type: "delta", text: "partial" },
      { type: "done", truncated: true },
    ]);
  });

  it("fails streams that are incomplete for another reason", async () => {
    await expect(
      collectProviderEvents([
        {
          type: "response.incomplete",
          response: { incomplete_details: { reason: "content_filter" } },
        },
      ]),
    ).rejects.toThrow("OpenAI response incomplete");
  });

  it("fails streams with the official failed terminal event", async () => {
    await expect(
      collectProviderEvents([{ type: "response.failed", response: { error: {} } }]),
    ).rejects.toThrow("OpenAI response failed");
  });
});

describe("Exercise content reaches the model as untrusted data", () => {
  beforeEach(() => {
    Object.assign(process.env, {
      APP_PASSWORD_HASH: "test",
      DATABASE_URL: "postgresql://localhost/test",
      OPENAI_API_KEY: "test",
      OPENAI_MODEL: "test-model",
      RATE_LIMIT_HMAC_SECRET: "test-only-secret-at-least-thirty-two-characters",
    });
    resetServerEnvironmentForTests();
    createResponse.mockReset();
    createResponse.mockResolvedValue(stream([]));
  });

  function promptContent(): string {
    const call = createResponse.mock.calls[0]?.[0] as {
      instructions: string;
      input: { role: string; content: string }[];
    };

    return call.input[0]!.content;
  }

  it("marks a flip Card's Exercise as unbewertet, with no chosen option", async () => {
    const provider = createOpenAiProvider();

    await drain(
      provider.streamTutorReply({
        subjectCard,
        exerciseCards: [{ ...subjectCard, outcome: null }],
        chosenOptionText: null,
        input: {
          message: "Warum?",
          messages: [],
          subjectCardId: "id",
          exerciseCards: [{ cardId: "id", outcome: null }],
          chosenOptionText: null,
        },
        signal: new AbortController().signal,
      }),
    );

    const content = promptContent();

    expect(content).toContain("KARTENINHALT (nur Daten)");
    expect(content).toContain("keine Bewertung (Karte umgedreht)");
    expect(content).toContain("keine (keine Auswahl in dieser Übung)");
  });

  it("describes a correct multiple-choice outcome and the option the Learner chose", async () => {
    const provider = createOpenAiProvider();

    await drain(
      provider.streamTutorReply({
        subjectCard,
        exerciseCards: [{ ...subjectCard, outcome: "knew_it" }],
        chosenOptionText: "the apple",
        input: {
          message: "Warum ist das richtig?",
          messages: [],
          subjectCardId: "id",
          exerciseCards: [{ cardId: "id", outcome: "knew_it" }],
          chosenOptionText: "the apple",
        },
        signal: new AbortController().signal,
      }),
    );

    expect(promptContent()).toContain("Ergebnis: gewusst");
    expect(promptContent()).toContain("Gewählte Antwort (nur Daten): the apple");
  });

  it("describes an incorrect multiple-choice outcome and the wrong option chosen", async () => {
    const provider = createOpenAiProvider();

    await drain(
      provider.streamTutorReply({
        subjectCard,
        exerciseCards: [{ ...subjectCard, outcome: "forgot" }],
        chosenOptionText: "the peach",
        input: {
          message: "Warum ist das falsch?",
          messages: [],
          subjectCardId: "id",
          exerciseCards: [{ cardId: "id", outcome: "forgot" }],
          chosenOptionText: "the peach",
        },
        signal: new AbortController().signal,
      }),
    );

    expect(promptContent()).toContain("Ergebnis: nicht gewusst");
    expect(promptContent()).toContain("Gewählte Antwort (nur Daten): the peach");
  });
});
