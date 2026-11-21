import { queryOptions } from "@tanstack/react-query";
import { apiPaths } from "../contracts/apiPaths";
import { cardListSchema } from "../contracts/card";
import { collectionListSchema } from "../contracts/collection";
import { sessionStatusSchema } from "../contracts/session";
import { statsSchema } from "../contracts/stats";
import { topicListSchema } from "../contracts/topic";
import { apiRequest, ApiError } from "./apiClient";
import { queryKeys } from "./queryKeys";

function retryRead(failureCount: number, error: unknown): boolean {
  return failureCount < 2 && (!(error instanceof ApiError) || error.problem.status >= 500);
}

export const sessionQuery = queryOptions({
  queryKey: queryKeys.session,
  queryFn: async () => await apiRequest(apiPaths.session, sessionStatusSchema),
  retry: retryRead,
  staleTime: 30_000,
});
export const cardsQuery = queryOptions({
  queryKey: queryKeys.cards,
  queryFn: async () => await apiRequest(apiPaths.cards, cardListSchema),
  retry: retryRead,
  staleTime: 30_000,
});
export const collectionsQuery = queryOptions({
  queryKey: queryKeys.collections,
  queryFn: async () => await apiRequest(apiPaths.collections, collectionListSchema),
  retry: retryRead,
  staleTime: 30_000,
});
export const topicsQuery = queryOptions({
  queryKey: queryKeys.topics,
  queryFn: async () => await apiRequest(apiPaths.topics, topicListSchema),
  retry: retryRead,
  staleTime: 30_000,
});
export const statsQuery = queryOptions({
  queryKey: queryKeys.stats,
  queryFn: async () => await apiRequest(apiPaths.stats, statsSchema),
  retry: retryRead,
  staleTime: 30_000,
});
