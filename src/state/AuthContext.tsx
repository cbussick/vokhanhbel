import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext, useState } from "react";
import { ApiError } from "../lib/apiClient";
import { sessionQuery } from "../lib/queries";
import { queryKeys } from "../lib/queryKeys";

export type AuthStatus = "checking" | "authenticated" | "unauthenticated" | "error";

interface AuthState {
  status: AuthStatus;
  sessionExpired: boolean;
  errorRequestId: string | undefined;
  markAuthenticated: () => void;
  discardSession: (expired: boolean) => Promise<void>;
  retrySession: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const session = useQuery(sessionQuery);
  const [sessionExpired, setSessionExpired] = useState(false);

  const discardSession = async (expired: boolean) => {
    await queryClient.cancelQueries();
    queryClient.removeQueries({
      predicate: (query) => query.queryKey[0] !== queryKeys.session[0],
    });
    queryClient.setQueryData(queryKeys.session, { authenticated: false });
    setSessionExpired(expired);
  };

  let status: AuthStatus;

  if (session.data) status = session.data.authenticated ? "authenticated" : "unauthenticated";
  else if (session.isPending || session.isFetching) status = "checking";
  else status = "error";

  const value: AuthState = {
    status,
    sessionExpired,
    errorRequestId: session.error instanceof ApiError ? session.error.requestId : undefined,
    markAuthenticated: () => {
      setSessionExpired(false);
      queryClient.setQueryData(queryKeys.session, { authenticated: true });
    },
    discardSession,
    retrySession: async () => {
      await session.refetch();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);

  if (!value) throw new Error("AuthProvider missing");

  return value;
}
