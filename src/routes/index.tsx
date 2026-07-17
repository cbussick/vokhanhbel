import { createFileRoute, Navigate } from "@tanstack/react-router";
import { LoadingScreen } from "../components/LoadingScreen";
import { SessionErrorScreen } from "../components/SessionErrorScreen";
import { useAuth } from "../state/AuthContext";

export const Route = createFileRoute("/")({ component: IndexRoute });

function IndexRoute() {
  const auth = useAuth();

  if (auth.status === "checking") return <LoadingScreen />;
  if (auth.status === "error") return <SessionErrorScreen />;

  return <Navigate to={auth.status === "authenticated" ? "/review" : "/login"} />;
}
