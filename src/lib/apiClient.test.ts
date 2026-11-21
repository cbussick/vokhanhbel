import { afterEach, expect, it, vi } from "vitest";
import { z } from "zod";
import { apiCommand, apiRequest } from "./apiClient";

afterEach(() => vi.unstubAllGlobals());

it("validates JSON responses at the endpoint boundary", async () => {
  vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(Response.json({ name: 42 })));
  await expect(apiRequest("/api/example", z.object({ name: z.string() }))).rejects.toThrow("Invalid input: expected string");
});

it("does not accept a missing body for a JSON endpoint", async () => {
  vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 })));
  await expect(apiRequest("/api/example", z.object({ name: z.string() }))).rejects.toThrow("Expected a JSON response");
});

it("accepts no-content commands and rejects malformed JSON command responses", async () => {
  const fetchResponse = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(new Response("not JSON", { status: 200 }));
  vi.stubGlobal("fetch", fetchResponse);
  await expect(apiCommand("/api/example", { method: "DELETE" })).resolves.toBeUndefined();
  await expect(apiCommand("/api/example", { method: "DELETE" })).rejects.toThrow(/Unexpected token/);
});
