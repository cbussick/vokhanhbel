import type { AudioMetadata, Card } from "../contracts/card";
import type { Collection } from "../contracts/collection";
import type { Topic } from "../contracts/topic";
import type { MultipleChoiceOptionView, TutorExerciseContext } from "../state/ReviewSessionContext";

export const timestamp = "2026-09-01T12:00:00.000Z";
export const collection: Collection = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Vietnamesisch",
  icon: "flag-vn",
  frontLanguage: "vi-VN",
  backLanguage: "de-DE",
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: null,
};
export const collections: Collection[] = [
  collection,
  {
    ...collection,
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    name: "Englisch",
    icon: "flag-gb",
    frontLanguage: "en-US",
  },
];
export const topic: Topic = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  collectionId: collection.id,
  name: "Begrüßungen",
  icon: "people",
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: null,
};
export const topics: Topic[] = [
  topic,
  { ...topic, id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", name: "Unterwegs", icon: "travel" },
];
export const audio: AudioMetadata = {
  id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  durationMs: 2400,
  contentType: "audio/wav",
  byteSize: 38444,
  source: "recorded",
  synthesizedText: null,
};
export const generatedAudio: AudioMetadata = {
  ...audio,
  source: "generated",
  synthesizedText: "xin chào",
};
export const card: Card = {
  id: "11111111-1111-4111-8111-111111111111",
  collectionId: collection.id,
  topicIds: [topic.id],
  front: { text: "xin chào", audio: null },
  back: { text: "Hallo", audio: null },
  box: 0,
  dueAt: timestamp,
  lastReviewedAt: null,
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: null,
};
export const cards: Card[] = [
  card,
  ...[
    ["22222222-2222-4222-8222-222222222222", "cảm ơn", "Danke"],
    ["33333333-3333-4333-8333-333333333333", "tạm biệt", "Auf Wiedersehen"],
    ["44444444-4444-4444-8444-444444444444", "xin lỗi", "Entschuldigung"],
  ].map(([id, front, back]) => ({
    ...card,
    id: id!,
    front: { text: front!, audio: null },
    back: { text: back!, audio: null },
  })),
];
export const options: MultipleChoiceOptionView[] = cards.map((entry) => ({
  id: entry.id,
  text: entry.back.text,
  audio: null,
  dead: false,
  revealedCorrect: false,
}));
export const tutorExercise: TutorExerciseContext = {
  cards: [{ cardId: card.id, outcome: null }],
  chosenOptionText: null,
};
export const stats = {
  totalPoints: 120,
  activeCardCount: 4,
  reviewsThisWeek: 12,
  currentStreak: 3,
  bestDay: null,
  dailyRecap: null,
};
