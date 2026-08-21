import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FailingAudioObjectStore,
  InMemoryAudioObjectStore,
  R2AudioObjectStore,
} from "./audioObjectStore.js";

afterEach(() => vi.unstubAllGlobals());

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

  it("validates private-store range metadata before trusting it", async () => {
    const store = new R2AudioObjectStore({
      environment: "preview",
      endpoint: "https://account.example",
      bucket: "preview-audio",
      accessKeyId: "access",
      secretAccessKey: "secret",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(new Uint8Array([20, 30]), {
          status: 206,
          headers: { "content-length": "2", "content-range": "bytes 1-2/4" },
        }),
      ),
    );

    await expect(store.read("audio/example", { start: 1, end: 2 })).resolves.toEqual({
      bytes: new Uint8Array([20, 30]),
      totalSize: 4,
      contentRange: "bytes 1-2/4",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(new Uint8Array([20, 30]), {
          status: 206,
          headers: { "content-length": "999", "content-range": "not-a-range" },
        }),
      ),
    );
    await expect(store.read("audio/example", { start: 1, end: 2 })).rejects.toThrow();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(new Uint8Array([20, 30]), {
          status: 206,
          headers: {
            "content-length": "2",
            "content-range": "bytes 1-2/9999999999999999999999999",
          },
        }),
      ),
    );
    await expect(store.read("audio/example", { start: 1, end: 2 })).rejects.toThrow();
  });

  it("provides deterministic failures without losing the underlying object", async () => {
    const store = new FailingAudioObjectStore();

    await store.put("audio/example", new Uint8Array([1]), "audio/wav");
    store.failures.add("delete");
    await expect(store.delete("audio/example")).rejects.toThrow("Injected audio delete failure");
    store.failures.delete("delete");
    await expect(store.read("audio/example")).resolves.toMatchObject({ totalSize: 1 });
  });
});
