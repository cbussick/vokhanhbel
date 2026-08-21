import { describe, expect, it, vi } from "vitest";
import type { TutorInput } from "../../contracts/tutor.js";
import type { AiProvider, TutorProviderRequest } from "../ai/aiProvider.js";
import { createTutorResponse } from "./tutor.js";

const card = { front: "der Apfel", back: "the apple" };

describe("Tutor provider boundary", () => {
  it("passes only the current Card, bounded conversation, question, and signal", async () => {
    const input: TutorInput = {
      message: "Bitte erklären",
      messages: [{ role: "user", content: "Ein Beispiel?" }],
    };
    let received: TutorProviderRequest | undefined;
    const provider: AiProvider = {
      async *streamTutorReply(request) {
        received = request;
        yield { type: "delta", text: "Ein Apfel ist eine Frucht." };
        yield { type: "done", truncated: false };
      },
    };

    const response = createTutorResponse(card, input, provider, new AbortController().signal);
    const body = await response.text();

    expect(received).toEqual({ card, input, signal: expect.any(AbortSignal) });
    expect(Object.keys(received ?? {})).toEqual(["card", "input", "signal"]);
    expect(body).toContain("event: delta");
    expect(body).toContain("Ein Apfel ist eine Frucht.");
    expect(body).toContain("event: done");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("turns provider failures into a safe stream error without leaking details", async () => {
    const provider: AiProvider = {
      async *streamTutorReply() {
        throw new Error("secret provider diagnostics");
      },
    };
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = createTutorResponse(
      card,
      { message: "Warum?", messages: [] },
      provider,
      new AbortController().signal,
    );

    expect(await response.text()).toBe('event: error\ndata: {"type":"/problems/tutor-failed"}\n\n');
    expect(consoleSpy).not.toHaveBeenCalled();
  });
});
