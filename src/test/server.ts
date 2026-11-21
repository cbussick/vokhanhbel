import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { pronunciationWireSchema, reviewWireSchema } from "./wireSchemas";

const now = new Date().toISOString();
const vietnameseCollection = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    name: "Vietnamesisch",
    icon: "flag-vn",
    frontLanguage: "vi-VN",
    backLanguage: "de-DE",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
const englishCollection = {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    name: "Englisch",
    icon: "flag-gb",
    frontLanguage: null,
    backLanguage: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
export const testCollections = [vietnameseCollection, englishCollection];
export const testTopics = [
  {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    collectionId: vietnameseCollection.id,
    name: "Tiere",
    icon: "animal" as const,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  },
];
export const testCards = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    collectionId: vietnameseCollection.id,
    topicIds: ["cccccccc-cccc-4ccc-8ccc-cccccccccccc"],
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
    collectionId: englishCollection.id,
    topicIds: [],
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

/**
 * What the pronunciation endpoint answers with: staged audio, in the shape an upload returns. The
 * synthesized text is the text the journeys below speak; the handler replaces it with whatever was
 * actually requested, exactly as the server stores what it was given.
 */
export const testGeneratedAudio = {
  id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
  durationMs: 1200,
  contentType: "audio/mpeg",
  byteSize: 9600,
  synthesizedText: "xin chào",
};

export const mockServer = setupServer(
  http.get("/api/session", () => HttpResponse.json({ authenticated: true })),
  http.get("/api/cards", () => HttpResponse.json(testCards)),
  http.get("/api/collections", () => HttpResponse.json(testCollections)),
  http.get("/api/topics", () => HttpResponse.json(testTopics)),
  http.get("/api/stats", () =>
    HttpResponse.json({
      totalPoints: 0,
      activeCardCount: 2,
      reviewsThisWeek: 0,
      currentStreak: 0,
      bestDay: null,
      dailyRecap: null,
    }),
  ),
  http.post("/api/pronunciations", async ({ request }) => {
    const { text } = pronunciationWireSchema.parse(await request.json());

    return HttpResponse.json({ ...testGeneratedAudio, synthesizedText: text }, { status: 201 });
  }),
  http.post("/api/reviews", async ({ request }) => {
    const input = reviewWireSchema.parse(await request.json());

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
