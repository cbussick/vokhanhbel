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

/**
 * Keyed so the Card form can see a synthesis it does not own still running, and refuse to save a
 * face the clip has not reached yet.
 */
export const mutationKeys = {
  pronunciation: ["pronunciation"] as const,
};
