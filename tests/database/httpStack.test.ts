import { afterEach, describe, expect, it } from "vitest";
import { POST as createCard } from "../../api/cards/index.js";
import { GET as playAudio } from "../../api/audio/[audioId].js";
import { POST as uploadAudio } from "../../api/audio/index.js";
import { POST as createCollection } from "../../api/collections/index.js";
import { POST as createReview } from "../../api/reviews.js";
import { POST as createSession } from "../../api/session.js";
import { GET as readStats } from "../../api/stats.js";
import { encodePassword } from "../../src/server/auth/password.js";
import { resetServerEnvironmentForTests } from "../../src/server/config/environment.js";
import {
  InMemoryAudioObjectStore,
  setAudioObjectStoreForTests,
} from "../../src/server/audio/audioObjectStore.js";

const origin = "http://localhost:4173";

afterEach(() => setAudioObjectStoreForTests(undefined));

function request(path: string, method: "GET" | "POST", body?: unknown, cookie?: string): Request {
  const headers = new Headers({ origin, "sec-fetch-site": "same-origin" });

  if (body !== undefined) headers.set("content-type", "application/json");
  if (cookie) headers.set("cookie", cookie);
  const init: RequestInit = { method, headers };

  if (body !== undefined) init.body = JSON.stringify(body);

  return new Request(`${origin}${path}`, init);
}

describe("real API handler stack", () => {
  it("authenticates, creates and Grades a Card, then returns durable statistics", async () => {
    const password = "real stack password";
    process.env.APP_PASSWORD_HASH = await encodePassword(password);
    resetServerEnvironmentForTests();

    const loginResponse = await createSession(request("/api/session", "POST", { password }));
    expect(loginResponse.status).toBe(204);
    const cookie = loginResponse.headers.get("set-cookie")?.split(";", 1)[0];
    expect(cookie).toMatch(/^__Host-session=/u);

    const collectionResponse = await createCollection(
      request("/api/collections", "POST", { name: "Echter Stack", icon: "book" }, cookie),
    );
    expect(collectionResponse.status).toBe(201);
    const collection = (await collectionResponse.json()) as { id: string };

    const cardResponse = await createCard(
      request(
        "/api/cards",
        "POST",
        {
          collectionId: collection.id,
          front: { text: "real stack", audioId: null },
          back: { text: "echter Stack", audioId: null },
        },
        cookie,
      ),
    );
    expect(cardResponse.status).toBe(201);
    const card = (await cardResponse.json()) as { id: string };

    const reviewResponse = await createReview(
      request(
        "/api/reviews",
        "POST",
        {
          id: crypto.randomUUID(),
          cardId: card.id,
          grade: "knew_it",
          reviewedAt: new Date().toISOString(),
        },
        cookie,
      ),
    );
    expect(reviewResponse.status).toBe(200);
    await expect(reviewResponse.json()).resolves.toMatchObject({
      review: { pointsAwarded: 10, boxBefore: 0, boxAfter: 1 },
      card: { id: card.id, box: 1 },
    });

    const statsResponse = await readStats(request("/api/stats", "GET", undefined, cookie));
    expect(statsResponse.status).toBe(200);
    await expect(statsResponse.json()).resolves.toMatchObject({
      totalPoints: 10,
      activeCardCount: 1,
      reviewsThisWeek: 1,
    });
  });

  it("stages, claims, and range-plays private audio without exposing its object key", async () => {
    const password = "private audio password";
    process.env.APP_PASSWORD_HASH = await encodePassword(password);
    resetServerEnvironmentForTests();
    setAudioObjectStoreForTests(new InMemoryAudioObjectStore());
    const loginResponse = await createSession(request("/api/session", "POST", { password }));
    const cookie = loginResponse.headers.get("set-cookie")?.split(";", 1)[0];
    const bytes = wavFixture();
    const uploadRequest = new Request(`${origin}/api/audio`, {
      method: "POST",
      headers: {
        origin,
        "sec-fetch-site": "same-origin",
        cookie: cookie!,
        "content-type": "audio/wav",
      },
      body: bytes,
    });
    const uploadResponse = await uploadAudio(uploadRequest);

    expect(uploadResponse.status).toBe(201);
    const audio = (await uploadResponse.json()) as { id: string; durationMs: number };
    expect(audio).toMatchObject({ durationMs: 1_000 });
    expect(JSON.stringify(audio)).not.toContain("objectKey");
    const cardResponse = await createCard(
      request(
        "/api/cards",
        "POST",
        {
          collectionId: "00000000-0000-4000-8000-000000000001",
          front: { text: null, audioId: audio.id },
          back: { text: "Antwort", audioId: null },
        },
        cookie,
      ),
    );

    expect(cardResponse.status).toBe(201);
    const playbackResponse = await playAudio(
      new Request(`${origin}/api/audio/${audio.id}`, {
        headers: { cookie: cookie!, range: "bytes=0-9" },
      }),
    );
    expect(playbackResponse.status).toBe(206);
    expect(playbackResponse.headers.get("content-range")).toBe(`bytes 0-9/${bytes.byteLength}`);
    expect(new Uint8Array(await playbackResponse.arrayBuffer())).toEqual(bytes.slice(0, 10));
  });
});

function wavFixture(): Uint8Array {
  const bytes = new Uint8Array(8_044);
  const view = new DataView(bytes.buffer);
  const write = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1)
      bytes[offset + index] = value.charCodeAt(index);
  };

  write(0, "RIFF");
  view.setUint32(4, bytes.byteLength - 8, true);
  write(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8_000, true);
  view.setUint32(28, 8_000, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  write(36, "data");
  view.setUint32(40, 8_000, true);

  return bytes;
}
