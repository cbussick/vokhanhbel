import { describe, expect, it } from "vitest";
import { POST as createCard } from "../../api/cards/index";
import { POST as createReview } from "../../api/reviews";
import { POST as createSession } from "../../api/session";
import { GET as readStats } from "../../api/stats";
import { encodePassword } from "../../src/server/auth/password";
import { resetServerEnvironmentForTests } from "../../src/server/config/environment";

const origin = "http://localhost:4173";

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

    const cardResponse = await createCard(
      request("/api/cards", "POST", { front: "real stack", back: "echter Stack" }, cookie),
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
});
