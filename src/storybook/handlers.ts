import { delay, http, HttpResponse } from "msw";
import { apiPaths } from "../contracts/apiPaths";
import { reviewSubmissionInputSchema } from "../contracts/review";
import {
  card,
  cards,
  collection,
  collections,
  generatedAudio,
  stats,
  timestamp,
  topic,
  topics,
} from "./fixtures";

export const pendingRequest = http.all("/api/*", async () => {
  await delay("infinite");
});
export const failedMutation = http.post("/api/*", () =>
  HttpResponse.json(
    {
      type: "about:blank",
      title: "Storybook example failure",
      status: 503,
    },
    { status: 503 },
  ),
);

// Fictional, disposable responses only. No backend, credentials or paid providers are used.
// An explicit final handler blocks any app API route not modelled here.
export const handlers = [
  http.get(apiPaths.session, () => HttpResponse.json({ authenticated: true })),
  http.get(apiPaths.collections, () => HttpResponse.json(collections)),
  http.get(apiPaths.topics, () => HttpResponse.json(topics)),
  http.get(apiPaths.cards, () => HttpResponse.json(cards)),
  http.get(apiPaths.stats, () => HttpResponse.json(stats)),
  http.get("/api/audio/:id", () => HttpResponse.redirect("/storybook-tone.wav")),
  http.post(apiPaths.pronunciations, () => HttpResponse.json(generatedAudio, { status: 201 })),
  http.post(apiPaths.stageAudio, () => HttpResponse.json(generatedAudio, { status: 201 })),
  http.post(apiPaths.collections, () => HttpResponse.json(collection, { status: 201 })),
  http.patch("/api/collections/:id", () => HttpResponse.json(collection)),
  http.post(apiPaths.topics, () => HttpResponse.json(topic, { status: 201 })),
  http.patch("/api/topics/:id", () => HttpResponse.json(topic)),
  http.post(apiPaths.cards, () => HttpResponse.json(card, { status: 201 })),
  http.patch("/api/cards/:id", () => HttpResponse.json(card)),
  http.delete("/api/:resource/:id", () => new HttpResponse(null, { status: 204 })),
  http.post(apiPaths.reviews, async ({ request }) => {
    const input = reviewSubmissionInputSchema.parse(await request.json());

    return HttpResponse.json({
      review: { ...input, pointsAwarded: 10, boxBefore: 0, boxAfter: 1, recordedAt: timestamp },
      card,
    });
  }),
  http.post(
    apiPaths.tutorReplies,
    () =>
      new HttpResponse(
        'event: delta\ndata: {"text":"Xin chào ist eine freundliche Begrüßung."}\n\nevent: done\ndata: {"truncated":false}\n\n',
        {
          headers: { "Content-Type": "text/event-stream" },
        },
      ),
  ),
  http.all("/api/*", () =>
    HttpResponse.json(
      { type: "about:blank", title: "Unmodelled Storybook request", status: 501 },
      { status: 501 },
    ),
  ),
];
