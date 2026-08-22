import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { render, waitFor } from "@testing-library/react";
import "../i18n/config";
import { routeTree } from "../routeTree.gen";
import { queryKeys } from "../lib/queryKeys";
import { AuthProvider } from "../state/AuthContext";
import { ReviewSubmissionProvider } from "../state/ReviewSubmissionContext";
import { SessionLifecycleProvider } from "../state/SessionLifecycleProvider";

const readyTimeoutMs = 5_000;

export async function renderApp(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });

  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ReviewSubmissionProvider>
          <SessionLifecycleProvider>
            <RouterProvider router={router} />
          </SessionLifecycleProvider>
        </ReviewSubmissionProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );

  // Tests used to call findBy immediately on an empty tree. The Collection page now
  // loads enough modules and queries that a cold first visit can miss the 1s default.
  await waitFor(
    () => {
      if (router.state.isLoading) throw new Error("router is still loading");

      const session = queryClient.getQueryState(queryKeys.session);

      if (session?.fetchStatus !== "idle" || session.status === "pending")
        throw new Error("session is still checking");

      const authenticated = queryClient.getQueryData<{ authenticated: boolean }>(
        queryKeys.session,
      )?.authenticated;

      if (!authenticated) return;
      if (!document.getElementById("main-content")) throw new Error("app shell is not mounted");

      for (const key of [
        queryKeys.cards,
        queryKeys.collections,
        queryKeys.topics,
        queryKeys.stats,
      ]) {
        const query = queryClient.getQueryState(key);

        if (query && (query.status === "pending" || query.fetchStatus === "fetching"))
          throw new Error("app data is still loading");
      }
    },
    { timeout: readyTimeoutMs },
  );

  return { queryClient, router, ...rendered };
}
