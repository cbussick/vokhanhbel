import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { render } from "@testing-library/react";
import "../i18n/config";
import { routeTree } from "../routeTree.gen";
import { AuthProvider } from "../state/AuthContext";
import { ReviewSubmissionProvider } from "../state/ReviewSubmissionContext";
import { SessionLifecycleProvider } from "../state/SessionLifecycleProvider";

export function renderApp(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });

  return {
    queryClient,
    router,
    ...render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ReviewSubmissionProvider>
            <SessionLifecycleProvider>
              <RouterProvider router={router} />
            </SessionLifecycleProvider>
          </ReviewSubmissionProvider>
        </AuthProvider>
      </QueryClientProvider>,
    ),
  };
}
