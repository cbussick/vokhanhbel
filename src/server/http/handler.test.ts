import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { problemSchema } from "../../contracts/problem.js";
import { handleJsonRequest, handleRequest } from "./handler.js";

const createRequest = (headers: Record<string, string>, body: string) =>
      new Request("https://cards.example/api/test", {
        method: "POST",
        headers: { origin: "https://cards.example", "sec-fetch-site": "same-origin", ...headers },
        body,
      });

const schema = z.object({ name: z.string() });

afterEach(() => vi.restoreAllMocks());

describe("public HTTP envelope", () => {
  it("rejects an unsafe cross-site request before invoking its handler", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const callback = vi.fn<() => Promise<Response>>(async () => Response.json({ ok: true }));
    const request = new Request("https://cards.example/api/session", {
      method: "POST",
      headers: {
        origin: "https://evil.example",
        "sec-fetch-site": "cross-site",
        "content-type": "application/json",
      },
      body: '{"name":"Khanh"}',
    });

    const response = await handleJsonRequest(request, { unsafe: true, bodySchema: schema }, callback);
    const problem = problemSchema.parse(await response.json());

    expect(response.status).toBe(403);
    expect(problem.type).toBe("/problems/invalid-origin");
    expect(problem.instance).toBe(`urn:uuid:${response.headers.get("x-request-id")}`);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(callback).not.toHaveBeenCalled();
  });

  it("returns stable problems for wrong content type, oversized JSON, and bad fields", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const callback = vi.fn<() => Promise<Response>>(async () => Response.json({ ok: true }));
    

    const wrongType = await handleJsonRequest(
      createRequest({ "content-type": "text/plain" }, "{}"),
      { unsafe: true, bodySchema: schema },
      callback,
    );
    const oversized = await handleJsonRequest(
      createRequest({ "content-type": "application/json", "content-length": "32769" }, "{}"),
      { unsafe: true, bodySchema: schema },
      callback,
    );
    const invalid = await handleJsonRequest(
      createRequest({ "content-type": "application/json" }, '{"name":1}'),
      { unsafe: true, bodySchema: schema },
      callback,
    );

    await expect(wrongType.json()).resolves.toMatchObject({
      type: "/problems/unsupported-content-type",
      status: 415,
    });
    await expect(oversized.json()).resolves.toMatchObject({
      type: "/problems/request-too-large",
      status: 413,
    });
    await expect(invalid.json()).resolves.toMatchObject({
      type: "/problems/invalid-request",
      status: 422,
      errors: [{ pointer: "/name", code: "invalid_type" }],
    });
  });

  it("redacts unexpected dependency failures while logging only safe request metadata", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const request = new Request("https://cards.example/api/test");
    const response = await handleRequest(request, {}, async () => {
      throw new Error("database URL and private Card content");
    });

    expect(await response.json()).toMatchObject({
      type: "/problems/unexpected",
      status: 500,
    });
    const logged = String(log.mock.calls[0]?.[0]);
    expect(logged).toContain("/problems/unexpected");
    expect(logged).not.toContain("database URL");
    expect(logged).not.toContain("private Card");
  });
});
