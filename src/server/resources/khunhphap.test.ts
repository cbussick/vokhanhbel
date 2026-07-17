import { describe, expect, it, vi } from "vitest";
import type { Card } from "../../contracts/card";
import type { KhunhphapInput } from "../../contracts/khunhphap";
import type { AiProvider, KhunhphapProviderRequest } from "../ai/aiProvider";
import { createKhunhphapResponse } from "./khunhphap";

const card: Card = {
  id: "019c52a9-50e8-7000-8000-000000000001",
  front: "der Apfel",
  back: "the apple",
  box: 0,
  dueAt: "2026-07-14T00:00:00.000Z",
  lastReviewedAt: null,
  createdAt: "2026-07-14T00:00:00.000Z",
  updatedAt: "2026-07-14T00:00:00.000Z",
  deletedAt: null,
};

describe("Khunhphap provider boundary", () => {
  it("passes only the current Card, bounded conversation, question, and signal", async () => {
    const input: KhunhphapInput = {
      message: "Bitte erklären",
      messages: [{ role: "user", content: "Ein Beispiel?" }],
    };
    let received: KhunhphapProviderRequest | undefined;
    const provider: AiProvider = {
      async *streamKhunhphapReply(request) {
        received = request;
        yield { type: "delta", text: "Ein Apfel ist eine Frucht." };
        yield { type: "done", truncated: false };
      },
    };

    const response = createKhunhphapResponse(card, input, provider, new AbortController().signal);
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
      async *streamKhunhphapReply() {
        throw new Error("secret provider diagnostics");
      },
    };
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = createKhunhphapResponse(
      card,
      { message: "Warum?", messages: [] },
      provider,
      new AbortController().signal,
    );

    expect(await response.text()).toBe(
      'event: error\ndata: {"type":"/problems/khunhphap-failed"}\n\n',
    );
    expect(consoleSpy).not.toHaveBeenCalled();
  });
});
