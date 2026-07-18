import { describe, expect, it } from "vitest";
import { createSessionIdentifier, hashSessionIdentifier } from "./sessionIdentifier.js";

describe("opaque Session identifiers", () => {
  it("creates random browser identifiers and stable database hashes", () => {
    const first = createSessionIdentifier();
    const second = createSessionIdentifier();
    expect(first).not.toBe(second);
    expect(Buffer.from(first, "base64url")).toHaveLength(32);
    expect(hashSessionIdentifier(first)).toBe(hashSessionIdentifier(first));
    expect(hashSessionIdentifier(first)).not.toBe(hashSessionIdentifier(second));
  });
});
