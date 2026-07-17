import { queryOptions } from "@tanstack/react-query";
import { cardListSchema } from "../contracts/card";
import { apiPaths } from "../contracts/apiPaths";
import { sessionStatusSchema } from "../contracts/session";
import { statsSchema } from "../contracts/stats";
import { apiRequest, ApiError } from "./apiClient";
import { queryKeys } from "./queryKeys";

function retryRead(failureCount: number, error: unknown): boolean {
  return failureCount < 2 && (!(error instanceof ApiError) || error.problem.status >= 500);
}

export const sessionQuery = queryOptions({
  queryKey: queryKeys.session,
  queryFn: async () => sessionStatusSchema.parse(await apiRequest(apiPaths.session)),
  retry: retryRead,
  staleTime: 30_000,
});
export const cardsQuery = queryOptions({
  queryKey: queryKeys.cards,
  queryFn: async () => cardListSchema.parse(await apiRequest(apiPaths.cards)),
  retry: retryRead,
  staleTime: 30_000,
});
export const statsQuery = queryOptions({
  queryKey: queryKeys.stats,
  queryFn: async () => statsSchema.parse(await apiRequest(apiPaths.stats)),
  retry: retryRead,
  staleTime: 30_000,
});
