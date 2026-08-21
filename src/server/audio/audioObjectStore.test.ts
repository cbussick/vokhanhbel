import { describe, expect, it } from "vitest";
import { InMemoryAudioObjectStore } from "./audioObjectStore.js";

describe("audio object store contract", () => {
  it("uploads, range-reads, reports missing objects, and deletes idempotently", async () => {
    const store = new InMemoryAudioObjectStore();
    const bytes = new Uint8Array([10, 20, 30, 40]);

    await store.put("audio/example", bytes, "audio/wav");
    await expect(store.read("audio/example", { start: 1, end: 2 })).resolves.toEqual({
      bytes: new Uint8Array([20, 30]),
      totalSize: 4,
      contentRange: "bytes 1-2/4",
    });
    await store.delete("audio/example");
    await store.delete("audio/example");
    await expect(store.read("audio/example")).resolves.toBeNull();
  });
});
