import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LoadingScreen } from "../components/LoadingScreen";
import { KhunhphapAvatar } from "../components/KhunhphapAvatar";
import { SessionErrorScreen } from "../components/SessionErrorScreen";
import { apiPaths } from "../contracts/apiPaths";
import { problemTypes } from "../contracts/problem";
import { apiRequest, ApiError } from "../lib/apiClient";
import { useOnlineStatus } from "../lib/browserState";
import { useAuth } from "../state/AuthContext";
import styles from "./login.module.css";

export const Route = createFileRoute("/login")({ component: LoginRoute });
const loginRateLimitFallbackSeconds = 15 * 60;

function LoginRoute() {
  const { t } = useTranslation();
  const auth = useAuth();
  const navigate = useNavigate();
  const online = useOnlineStatus();

  const inputRef = useRef<HTMLInputElement>(null);

  const [password, setPassword] = useState("");
  const [errorKey, setErrorKey] = useState<string>();
  const [seconds, setSeconds] = useState(0);

  const mutation = useMutation({
    mutationFn: async () =>
      apiRequest<void>(apiPaths.session, { method: "POST", body: JSON.stringify({ password }) }),
    onSuccess: async () => {
      auth.markAuthenticated();
      setPassword("");
      await navigate({ to: "/review" });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.problem.type === problemTypes.wrongPassword) {
        setPassword("");
        setErrorKey("login.wrong");
        requestAnimationFrame(() => inputRef.current?.focus());
      } else if (error instanceof ApiError && error.problem.status === 429) {
        setSeconds(error.retryAfter ?? loginRateLimitFallbackSeconds);
        setErrorKey("login.throttled");
      } else setErrorKey("login.network");
    },
  });

  useEffect(() => {
    if (seconds <= 0) return;

    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1_000);

    return () => window.clearInterval(timer);
  }, [seconds]);

  useEffect(() => {
    document.title = `${t("login.title")} | ${t("appName")}`;
  }, [t]);

  if (auth.status === "checking") return <LoadingScreen />;
  if (auth.status === "error") return <SessionErrorScreen />;
  if (auth.status === "authenticated") return <Navigate to="/review" />;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setErrorKey(undefined);

    const passwordLength = Array.from(password).length;

    if (passwordLength < 6 || passwordLength > 128) {
      setPassword("");
      setErrorKey("login.wrong");
      requestAnimationFrame(() => inputRef.current?.focus());

      return;
    }

    if (!online) {
      setErrorKey("login.offline");

      return;
    }

    mutation.mutate();
  };

  return (
    <main className={styles.screen}>
      <section className={styles.card}>
        <KhunhphapAvatar />
        <div>
          <h1>{t("login.title")}</h1>
          <p>{t("login.intro")}</p>
        </div>
        {auth.sessionExpired && (
          <p className={styles.notice} role="status">
            {t("login.expired")}
          </p>
        )}
        <form onSubmit={submit} noValidate>
          <label htmlFor="password">{t("login.password")}</label>
          <input
            ref={inputRef}
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={errorKey ? true : undefined}
            aria-describedby={errorKey ? "login-error" : undefined}
          />
          <button
            type="submit"
            disabled={mutation.isPending || seconds > 0 || password.length === 0}
          >
            {seconds > 0 ? t("login.throttled", { seconds }) : t("login.submit")}
          </button>
          {errorKey && (
            <p id="login-error" className={styles.error} role="alert">
              {t(errorKey, { seconds })}
            </p>
          )}
        </form>
      </section>
    </main>
  );
}
