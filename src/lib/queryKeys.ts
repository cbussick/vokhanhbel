const queryRoots = {
  session: "session",
  cards: "cards",
  collections: "collections",
  topics: "topics",
  stats: "stats",
} as const;

export const queryKeys = {
  session: [queryRoots.session] as const,
  cards: [queryRoots.cards] as const,
  collections: [queryRoots.collections] as const,
  topics: [queryRoots.topics] as const,
  stats: [queryRoots.stats] as const,
};
