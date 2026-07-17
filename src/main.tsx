import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import "./i18n/config";
import { routeTree } from "./routeTree.gen";
import { AuthProvider } from "./state/AuthContext";
import { ReviewSubmissionProvider } from "./state/ReviewSubmissionContext";
import { SessionLifecycleProvider } from "./state/SessionLifecycleProvider";
import "./styles/fonts.css";
import "./styles/global.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: true, refetchOnReconnect: true },
    mutations: { retry: false },
  },
});
const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  disableGlobalCatchBoundary: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const root = document.querySelector("#root");

if (!root) throw new Error("Root element missing");

createRoot(root).render(
  <StrictMode>
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ReviewSubmissionProvider>
            <SessionLifecycleProvider>
              <RouterProvider router={router} />
            </SessionLifecycleProvider>
          </ReviewSubmissionProvider>
        </AuthProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  </StrictMode>,
);
