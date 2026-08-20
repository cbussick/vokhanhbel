import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const now = new Date().toISOString();
export const testCollections = [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    name: "Vietnamesisch",
    icon: "flag-vn",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    name: "Englisch",
    icon: "flag-gb",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  },
];
export const testCards = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    collectionId: testCollections[0]!.id,
    front: "Take care",
    back: "Pass auf",
    box: 0,
    dueAt: now,
    lastReviewedAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    collectionId: testCollections[1]!.id,
    front: "Café",
    back: "Kaffeehaus",
    box: 1,
    dueAt: "2099-01-01T00:00:00.000Z",
    lastReviewedAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  },
];

export const mockServer = setupServer(
  http.get("/api/session", () => HttpResponse.json({ authenticated: true })),
  http.get("/api/cards", () => HttpResponse.json(testCards)),
  http.get("/api/collections", () => HttpResponse.json(testCollections)),
  http.get("/api/stats", () =>
    HttpResponse.json({
      totalPoints: 0,
      activeCardCount: 2,
      reviewsThisWeek: 0,
      bestDay: null,
      dailyRecap: null,
    }),
  ),
  http.post("/api/reviews", async ({ request }) => {
    const input = (await request.json()) as {
      id: string;
      cardId: string;
      grade: string;
      reviewedAt: string;
    };

    return HttpResponse.json({
      review: { ...input, pointsAwarded: 10, boxBefore: 0, boxAfter: 1, recordedAt: now },
      card: {
        ...testCards[0],
        box: 1,
        dueAt: "2099-01-01T00:00:00.000Z",
        lastReviewedAt: input.reviewedAt,
        updatedAt: now,
      },
    });
  }),
);
