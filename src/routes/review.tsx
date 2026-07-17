import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "../components/AppShell";
import { DelayedSkeleton } from "../components/DelayedSkeleton";
import { RequireSession } from "../components/RequireSession";
import type { Card } from "../contracts/card";
import { useDueTime } from "../lib/browserState";
import { cardsQuery } from "../lib/queries";
import { ReviewSessionProvider, useReviewSession } from "../state/ReviewSessionContext";
import styles from "./review.module.css";

export const Route = createFileRoute("/review")({ component: ReviewRouteProvider });

function ReviewRouteProvider() {
  return (
    <ReviewSessionProvider>
      <ReviewRoute />
    </ReviewSessionProvider>
  );
}

function ReviewRoute() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const cards = useQuery(cardsQuery);
  const reviewSession = useReviewSession();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const now = useDueTime((cards.data ?? []).map((card) => card.dueAt));

  useEffect(() => {
    document.title = `${t("review.title")} | ${t("appName")}`;
  }, [t]);

  const begin = (selected: Card[]) => {
    reviewSession.startReviewSession(selected);
    window.setTimeout(() => void navigate({ to: "/review/session" }), 0);
  };

  if (pathname === "/review/session") return <Outlet />;

  let content;

  if (cards.isPending) content = <DelayedSkeleton />;
  else if (cards.isError && !cards.data)
    content = (
      <div className={styles.landing}>
        <p>{t("errors.load")}</p>
        <button type="button" onClick={() => void cards.refetch()}>
          {t("common.retry")}
        </button>
      </div>
    );
  else {
    const active = cards.data ?? [];
    const due = active
      .filter((card) => new Date(card.dueAt).getTime() <= now)
      .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
    const soonest = [...active].sort(
      (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime(),
    );
    content = (
      <div className={styles.landing}>
        {active.length === 0 ? (
          <>
            <p>{t("review.empty")}</p>
            <button type="button" onClick={() => void navigate({ to: "/cards" })}>
              {t("cards.add")}
            </button>
          </>
        ) : due.length > 0 ? (
          <>
            <div className={styles.dueCount}>
              <strong>{due.length}</strong>
              <span>{t("review.due", { count: due.length })}</span>
            </div>
            <button type="button" onClick={() => begin(due)}>
              {t("review.start")}
            </button>
          </>
        ) : (
          <>
            <p>{t("review.noneDue")}</p>
            <button type="button" onClick={() => begin(soonest)}>
              {t("review.anyway")}
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <RequireSession>
      <AppShell title={t("review.title")}>{content}</AppShell>
    </RequireSession>
  );
}
