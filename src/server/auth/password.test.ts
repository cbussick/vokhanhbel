import { describe, expect, it } from "vitest";
import { encodePassword, verifyPassword } from "./password.js";

describe("shared password hashing", () => {
  it("round-trips the exact submitted Unicode password", async () => {
    const password = "  Ein sehr langes Pässwort 🔐  ";
    const encoded = await encodePassword(password);
    await expect(verifyPassword(password, encoded)).resolves.toBe(true);
    await expect(verifyPassword(password.trim(), encoded)).resolves.toBe(false);
  });

  it("rejects malformed hashes and out-of-range input safely", async () => {
    await expect(verifyPassword("123456", "scrypt$v1$bad")).resolves.toBe(false);
    await expect(encodePassword("12345")).rejects.toThrow("password-length");
  });

  it("accepts a six-character password", async () => {
    const password = "123456";
    const encoded = await encodePassword(password);
    await expect(verifyPassword(password, encoded)).resolves.toBe(true);
  });
});
