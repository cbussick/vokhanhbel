import { describe, expect, it } from "vitest";
import { isAllowedUnsafeRequest } from "./origin.js";

describe("unsafe same-origin requests", () => {
  it("accepts the exact target origin", () => {
    const request = new Request("https://cards.example/api/cards", {
      method: "POST",
      headers: { origin: "https://cards.example", "sec-fetch-site": "same-origin" },
    });
    expect(isAllowedUnsafeRequest(request)).toBe(true);
  });

  it("rejects missing, mismatched, and cross-site origins", () => {
    expect(
      isAllowedUnsafeRequest(new Request("https://cards.example/api/cards", { method: "POST" })),
    ).toBe(false);
    expect(
      isAllowedUnsafeRequest(
        new Request("https://cards.example/api/cards", {
          method: "POST",
          headers: { origin: "https://evil.example" },
        }),
      ),
    ).toBe(false);
    expect(
      isAllowedUnsafeRequest(
        new Request("https://cards.example/api/cards", {
          method: "POST",
          headers: { origin: "https://cards.example", "sec-fetch-site": "cross-site" },
        }),
      ),
    ).toBe(false);
  });
});
