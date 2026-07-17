const queryRoots = {
  session: "session",
  cards: "cards",
  stats: "stats",
} as const;

export const queryKeys = {
  session: [queryRoots.session] as const,
  cards: [queryRoots.cards] as const,
  stats: [queryRoots.stats] as const,
};
