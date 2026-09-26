import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { queryKeys } from "../lib/queryKeys";
import { AuthProvider } from "../state/AuthContext";
import { ReviewSessionProvider } from "../state/ReviewSessionContext";
import { ReviewSubmissionProvider } from "../state/ReviewSubmissionContext";
import { SessionLifecycleProvider } from "../state/SessionLifecycleProvider";
import { collections, topics, stats } from "./fixtures";

/** A fresh cache and memory router per story; no application navigation or persisted review queue. */
export function Providers({
  children,
  authenticated = true,
}: {
  children: ReactNode;
  authenticated?: boolean;
}) {
  const [client] = useState(() => {
    const value = new QueryClient({
      defaultOptions: {
        queries: { retry: false, refetchOnWindowFocus: false },
        mutations: { retry: false },
      },
    });
    value.setQueryData(queryKeys.session, { authenticated });
    value.setQueryData(queryKeys.collections, collections);
    value.setQueryData(queryKeys.topics, topics);
    value.setQueryData(queryKeys.stats, stats);

    return value;
  });
  const [router] = useState(() => {
    const root = createRootRoute({ component: Outlet });
    const routes = ["/", "/review", "/cards", "/me", "/login"].map((path) =>
      createRoute({ getParentRoute: () => root, path }),
    );

    return createRouter({
      routeTree: root.addChildren(routes),
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });
  });
  useEffect(() => () => client.clear(), [client]);

  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <ReviewSubmissionProvider>
          <SessionLifecycleProvider>
            <ReviewSessionProvider>
              <RouterProvider router={router} defaultComponent={() => children} />
            </ReviewSessionProvider>
          </SessionLifecycleProvider>
        </ReviewSubmissionProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
