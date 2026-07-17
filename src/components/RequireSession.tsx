import { Navigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useAuth } from "../state/AuthContext";
import { LoadingScreen } from "./LoadingScreen";
import { SessionErrorScreen } from "./SessionErrorScreen";

export function RequireSession({ children }: { children: ReactNode }) {
  const auth = useAuth();

  if (auth.status === "checking") return <LoadingScreen />;
  if (auth.status === "error") return <SessionErrorScreen />;
  if (auth.status === "unauthenticated") return <Navigate to="/login" />;

  return children;
}
