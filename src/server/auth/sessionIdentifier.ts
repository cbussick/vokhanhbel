import { createHash, randomBytes } from "node:crypto";

export function createSessionIdentifier(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionIdentifier(identifier: string): string {
  return createHash("sha256").update(identifier, "utf8").digest("base64url");
}
