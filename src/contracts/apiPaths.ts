export const apiPaths = {
  session: "/api/session",
  cards: "/api/cards",
  reviews: "/api/reviews",
  stats: "/api/stats",
  card: (cardId: string) => `/api/cards/${cardId}`,
  tutorReplies: (cardId: string) => `/api/cards/${cardId}/tutor-replies`,
} as const;
