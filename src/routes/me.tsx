import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "../components/AppShell";
import { DelayedSkeleton } from "../components/DelayedSkeleton";
import { RequireSession } from "../components/RequireSession";
import { berlinTimeZone } from "../domain/time";
import { useOnlineStatus } from "../lib/browserState";
import { statsQuery } from "../lib/queries";
import { useReviewSubmissions } from "../state/ReviewSubmissionContext";
import { useSessionLifecycle } from "../state/SessionLifecycleProvider";
import styles from "./me.module.css";

export const Route = createFileRoute("/me")({ component: MeRoute });

function MeRoute() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { submissionSync } = useReviewSubmissions();
  const sessionLifecycle = useSessionLifecycle();
  const online = useOnlineStatus();
  const stats = useQuery(statsQuery);

  useEffect(() => {
    document.title = `${t("me.title")} | ${t("appName")}`;
  }, [t]);

  const logout = async () => {
    if (
      submissionSync.outstandingCount > 0 &&
      !window.confirm(t("shell.logoutPending", { count: submissionSync.outstandingCount }))
    )
      return;

    await sessionLifecycle.logout();
    await navigate({ to: "/login" });
  };

  let content;

  if (stats.isPending) content = <DelayedSkeleton />;
  else if (stats.isError && !stats.data)
    content = (
      <div className={styles.error}>
        <p>{t("errors.load")}</p>
        <button type="button" onClick={() => void stats.refetch()}>
          {t("common.retry")}
        </button>
      </div>
    );
  else {
    const data = stats.data;
    const formatDate = (date: string) =>
      new Intl.DateTimeFormat(i18n.language, {
        dateStyle: "medium",
        timeZone: berlinTimeZone,
      }).format(new Date(`${date}T12:00:00Z`));
    content = (
      <>
        <dl className={styles.stats}>
          <div className={styles.hero}>
            <dt>{t("me.totalPoints")}</dt>
            <dd>{data.totalPoints}</dd>
          </div>
          <div>
            <dt>{t("me.activeCards")}</dt>
            <dd>{data.activeCardCount}</dd>
          </div>
          <div>
            <dt>{t("me.week")}</dt>
            <dd>{data.reviewsThisWeek}</dd>
          </div>
          <div>
            <dt>{t("me.bestDay")}</dt>
            <dd>
              {data.bestDay ? (
                <>
                  <strong>{data.bestDay.reviewCount}</strong>
                  <span>{formatDate(data.bestDay.date)}</span>
                </>
              ) : (
                <span>{t("me.noBestDay")}</span>
              )}
            </dd>
          </div>
        </dl>
        {data.dailyRecap && (
          <section className={styles.recap}>
            <h2>{t(data.dailyRecap.period === "today" ? "me.recapToday" : "me.recapYesterday")}</h2>
            <p>
              {t("me.recap", {
                reviews: data.dailyRecap.reviewCount,
                known: data.dailyRecap.knewItCount,
              })}
            </p>
          </section>
        )}
        {stats.isError && <p className={styles.warning}>{t("errors.stale")}</p>}
      </>
    );
  }

  return (
    <RequireSession>
      <AppShell title={t("me.title")}>
        {content}
        <section className={styles.account}>
          <h2>{t("me.account")}</h2>
          <button
            type="button"
            disabled={!online}
            title={!online ? t("shell.offlineLogout") : undefined}
            onClick={() => void logout()}
          >
            {t("shell.logout")}
          </button>
        </section>
      </AppShell>
    </RequireSession>
  );
}
