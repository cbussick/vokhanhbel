export const apiPaths = {
  session: "/api/session",
  cards: "/api/cards",
  reviews: "/api/reviews",
  stats: "/api/stats",
  card: (cardId: string) => `/api/cards/${cardId}`,
  khunhphapReplies: (cardId: string) => `/api/cards/${cardId}/khunhphap-replies`,
} as const;
