import { describe, expect, it } from "vitest";
import { normalizeCardText } from "./cardText";

describe("Card text normalization", () => {
  it("normalizes Unicode and line endings while preserving intentional line breaks", () => {
    expect(normalizeCardText("  Cafe\u0301\r\n\r\n  xin   chào  ")).toBe("Café\n\nxin chào");
  });

  it("collapses horizontal whitespace inside each line", () => {
    expect(normalizeCardText("one\t \u00a0two\nthree")).toBe("one two\nthree");
  });

  it("rejects control characters other than line breaks and horizontal whitespace", () => {
    expect(() => normalizeCardText("unsafe\u0000value")).toThrow("control-character");
  });
});
