import { describe, expect, it } from "vitest";
import { createCard, deleteCard, listCards } from "../../src/server/resources/cards.js";
import { getPool } from "../../src/server/database/client.js";
import { encodePassword } from "../../src/server/auth/password.js";
import { resetServerEnvironmentForTests } from "../../src/server/config/environment.js";
import { recordReview } from "../../src/server/resources/reviews.js";
import { login } from "../../src/server/resources/sessions.js";
import { getStats } from "../../src/server/resources/stats.js";
import { consumeKhunhphapAllowance } from "../../src/server/resources/khunhphap.js";

describe("PostgreSQL application behavior", () => {
  it("enforces active normalized-front uniqueness and releases it after soft deletion", async () => {
    const card = await createCard({ front: "Take care", back: "Pass auf" });
    await expect(createCard({ front: "take care", back: "Mach es gut" })).rejects.toMatchObject({
      status: 409,
    });
    await deleteCard(card.id);
    await expect(createCard({ front: "TAKE CARE", back: "Mach es gut" })).resolves.toMatchObject({
      front: "TAKE CARE",
    });
    expect(await listCards()).toHaveLength(1);
  });

  it("records exact replays once and serializes distinct concurrent Grades", async () => {
    const card = await createCard({ front: "steady", back: "stetig" });
    const reviewedAt = new Date().toISOString();
    const first = {
      id: crypto.randomUUID(),
      cardId: card.id,
      grade: "knew_it" as const,
      reviewedAt,
    };
    const result = await recordReview(first);
    await expect(recordReview(first)).resolves.toEqual(result);
    const second = {
      id: crypto.randomUUID(),
      cardId: card.id,
      grade: "knew_it" as const,
      reviewedAt: new Date(Date.now() + 1).toISOString(),
    };
    const third = {
      id: crypto.randomUUID(),
      cardId: card.id,
      grade: "almost" as const,
      reviewedAt: new Date(Date.now() + 2).toISOString(),
    };
    await Promise.all([recordReview(second), recordReview(third)]);
    const rows = await getPool().query(
      "SELECT box_before, box_after FROM reviews WHERE card_id=$1 ORDER BY recorded_at, id",
      [card.id],
    );
    expect(rows.rows).toHaveLength(3);
    expect(
      (await getPool().query<{ box: number }>("SELECT box FROM cards WHERE id=$1", [card.id]))
        .rows[0]?.box,
    ).toBe(2);
  });

  it("returns the original resulting Card for identical concurrent Review replays", async () => {
    const card = await createCard({ front: "immutable result", back: "unveränderlich" });
    const input = {
      id: crypto.randomUUID(),
      cardId: card.id,
      grade: "knew_it" as const,
      reviewedAt: new Date().toISOString(),
    };

    const [first, replay] = await Promise.all([recordReview(input), recordReview(input)]);
    expect(replay).toEqual(first);

    await getPool().query("UPDATE cards SET front=$1, normalized_front=$1 WHERE id=$2", [
      "changed later",
      card.id,
    ]);
    await expect(recordReview(input)).resolves.toEqual(first);
    await expect(recordReview({ ...input, grade: "almost" })).rejects.toMatchObject({
      status: 409,
      type: "/problems/review-replay-conflict",
    });
  });

  it("serializes concurrent Khunhphap allowance checks at both limits", async () => {
    const sessionHash = "session-boundary";
    await getPool().query(
      `INSERT INTO ai_usage (session_hash) SELECT $1 FROM generate_series(1, 29)`,
      [sessionHash],
    );
    const sessionBoundary = await Promise.allSettled([
      consumeKhunhphapAllowance(sessionHash),
      consumeKhunhphapAllowance(sessionHash),
    ]);
    expect(sessionBoundary.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(sessionBoundary.filter((result) => result.status === "rejected")).toHaveLength(1);

    await getPool().query("TRUNCATE ai_usage RESTART IDENTITY");
    await getPool().query(
      `INSERT INTO ai_usage (session_hash) SELECT 'daily-' || value FROM generate_series(1, 199) value`,
    );
    const dailyBoundary = await Promise.allSettled([
      consumeKhunhphapAllowance("daily-final-a"),
      consumeKhunhphapAllowance("daily-final-b"),
    ]);
    expect(dailyBoundary.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(dailyBoundary.filter((result) => result.status === "rejected")).toHaveLength(1);
  });

  it("serializes concurrent failed Login attempts at the tenth-attempt boundary", async () => {
    process.env.APP_PASSWORD_HASH = await encodePassword("correct household password");
    resetServerEnvironmentForTests();
    const request = new Request("http://localhost/api/session", {
      headers: { "x-forwarded-for": "203.0.113.42" },
    });

    const attempts = await Promise.allSettled(
      Array.from({ length: 11 }, () => login(request, { password: "incorrect password!" })),
    );
    const problems = attempts.flatMap((result) =>
      result.status === "rejected" ? [result.reason as { type?: string }] : [],
    );
    expect(problems.filter((problem) => problem.type === "/problems/wrong-password")).toHaveLength(
      10,
    );
    expect(
      problems.filter((problem) => problem.type === "/problems/login-rate-limit"),
    ).toHaveLength(1);
  });

  it("rejects Card text that bypasses stored normalization", async () => {
    await expect(
      getPool().query(
        `INSERT INTO cards (front, normalized_front, back) VALUES ('  spaced  ', '  spaced  ', 'valid')`,
      ),
    ).rejects.toThrow();
    await expect(
      getPool().query(
        `INSERT INTO cards (front, normalized_front, back) VALUES ('valid', 'different', 'valid')`,
      ),
    ).rejects.toThrow();
    await expect(
      getPool().query(
        `INSERT INTO cards (front, normalized_front, back) VALUES ('Café', 'Café', 'valid')`,
      ),
    ).rejects.toThrow();
    await expect(
      getPool().query(
        `INSERT INTO cards (front, normalized_front, back) VALUES ($1, $1, 'valid')`,
        ["multi\u00a0space"],
      ),
    ).rejects.toThrow();
    await expect(
      getPool().query(
        `INSERT INTO cards (front, normalized_front, back) VALUES ($1, $1, 'valid')`,
        ["wide\u2003space"],
      ),
    ).rejects.toThrow();
    await expect(
      getPool().query(
        `INSERT INTO cards (front, normalized_front, back) VALUES (E'\\nvalid\\n', E'\\nvalid\\n', 'valid')`,
      ),
    ).rejects.toThrow();
  });

  it("keeps Reviews and Points after a Card is deleted", async () => {
    const card = await createCard({ front: "remember", back: "sich erinnern" });
    await recordReview({
      id: crypto.randomUUID(),
      cardId: card.id,
      grade: "knew_it",
      reviewedAt: new Date().toISOString(),
    });
    await deleteCard(card.id);
    await expect(getStats()).resolves.toMatchObject({
      totalPoints: 10,
      activeCardCount: 0,
      reviewsThisWeek: 1,
    });
    await expect(getPool().query("DELETE FROM cards WHERE id=$1", [card.id])).rejects.toThrow(
      "Cards must be soft deleted",
    );
    await expect(
      getPool().query("UPDATE reviews SET points_awarded=1 WHERE card_id=$1", [card.id]),
    ).rejects.toThrow("Reviews are append-only");
  });

  it("calculates Berlin target midnight across both daylight-saving transitions", async () => {
    const spring = await getPool().query<{ due_at: Date }>(
      `SELECT ((date_trunc('day', $1::timestamptz AT TIME ZONE 'Europe/Berlin') + interval '1 day') AT TIME ZONE 'Europe/Berlin') AS due_at`,
      ["2026-03-28T12:00:00Z"],
    );
    const autumn = await getPool().query<{ due_at: Date }>(
      `SELECT ((date_trunc('day', $1::timestamptz AT TIME ZONE 'Europe/Berlin') + interval '1 day') AT TIME ZONE 'Europe/Berlin') AS due_at`,
      ["2026-10-24T12:00:00Z"],
    );
    expect(spring.rows[0]?.due_at.toISOString()).toBe("2026-03-28T23:00:00.000Z");
    expect(autumn.rows[0]?.due_at.toISOString()).toBe("2026-10-24T22:00:00.000Z");
  });
});
