import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Card } from "../../contracts/card";
import { resetServerEnvironmentForTests } from "../config/environment";
import { createOpenAiProvider } from "./aiProvider";

const { createResponse } = vi.hoisted(() => ({ createResponse: vi.fn() }));

vi.mock("openai", () => ({
  default: class OpenAiMock {
    responses = { create: createResponse };
  },
}));

const card: Card = {
  id: "019c52a9-50e8-7000-8000-000000000001",
  front: "front",
  back: "back",
  box: 0,
  dueAt: "2026-07-14T00:00:00.000Z",
  lastReviewedAt: null,
  createdAt: "2026-07-14T00:00:00.000Z",
  updatedAt: "2026-07-14T00:00:00.000Z",
  deletedAt: null,
};

async function* stream(events: unknown[]) {
  yield* events;
}

async function collectProviderEvents(events: unknown[]) {
  createResponse.mockResolvedValue(stream(events));
  const provider = createOpenAiProvider();
  const collected = [];

  for await (const event of provider.streamKhunhphapReply({
    card,
    input: { message: "question", messages: [] },
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
