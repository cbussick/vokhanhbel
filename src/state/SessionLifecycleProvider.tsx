import { createContext, type ReactNode, useContext, useEffect } from "react";
import { apiPaths } from "../contracts/apiPaths";
import { apiRequest } from "../lib/apiClient";
import { subscribeToSessionExpiry } from "../lib/sessionEvents";
import { useAuth } from "./AuthContext";
import { useReviewSubmissions } from "./ReviewSubmissionContext";

interface SessionLifecycleState {
  logout: () => Promise<void>;
}

const SessionLifecycleContext = createContext<SessionLifecycleState | undefined>(undefined);

// Coordinates auth and pending-review cleanup when the user session ends.
export function SessionLifecycleProvider({ children }: { children: ReactNode }) {
  const { discardSession } = useAuth();
  const { discardAllSubmissions } = useReviewSubmissions();

  useEffect(
    () =>
      subscribeToSessionExpiry(() => {
        discardAllSubmissions();
        void discardSession(true);
      }),
    [discardAllSubmissions, discardSession],
  );

  const logout = async () => {
    await apiRequest(apiPaths.session, { method: "DELETE" });
    discardAllSubmissions();
    await discardSession(false);
  };

  const value = { logout };

  return (
    <SessionLifecycleContext.Provider value={value}>{children}</SessionLifecycleContext.Provider>
  );
}

export function useSessionLifecycle(): SessionLifecycleState {
  const value = useContext(SessionLifecycleContext);

  if (!value) throw new Error("SessionLifecycleProvider missing");

  return value;
}
