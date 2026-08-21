export const apiPaths = {
  session: "/api/session",
  cards: "/api/cards",
  collections: "/api/collections",
  reviews: "/api/reviews",
  stats: "/api/stats",
  card: (cardId: string) => `/api/cards/${cardId}`,
  collection: (collectionId: string) => `/api/collections/${collectionId}`,
  tutorReplies: (cardId: string) => `/api/cards/${cardId}/tutor-replies`,
  audio: (audioId: string) => `/api/audio/${audioId}`,
  stageAudio: "/api/audio",
} as const;
