import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "../components/AppShell";
import { CollectionIcon } from "../components/CollectionIcon";
import { DelayedSkeleton } from "../components/DelayedSkeleton";
import { RequireSession } from "../components/RequireSession";
import { TopicIcon } from "../components/TopicIcon";
import type { Card } from "../contracts/card";
import { useDueTime } from "../lib/browserState";
import { cardsQuery, collectionsQuery, topicsQuery } from "../lib/queries";
import { ReviewSessionProvider, useReviewSession } from "../state/ReviewSessionContext";
import styles from "./review.module.css";

export const Route = createFileRoute("/review")({ component: ReviewRouteProvider });

function byDueDate(left: Card, right: Card): number {
  return new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime();
}

/** Due Cards when there are any, otherwise the ones coming up soonest. */
function selectQueue(cards: Card[], now: number): Card[] {
  const ordered = [...cards].sort(byDueDate);
  const due = ordered.filter((card) => new Date(card.dueAt).getTime() <= now);

  return due.length > 0 ? due : ordered;
}

function countDue(cards: Card[], now: number): number {
  return cards.filter((card) => new Date(card.dueAt).getTime() <= now).length;
}

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
  const collections = useQuery(collectionsQuery);
  const topics = useQuery(topicsQuery);
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

  if (cards.isPending || collections.isPending || topics.isPending) content = <DelayedSkeleton />;
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
    const collectionList = collections.data ?? [];
    const topicList = topics.data ?? [];
    const dueCount = countDue(active, now);
    const showGroups = collectionList.length > 1 || topicList.length > 0;

    content = (
      <div className={styles.landing}>
        {active.length === 0 ? (
          <>
            <p>{t("review.empty")}</p>
            <button type="button" onClick={() => void navigate({ to: "/cards" })}>
              {t("cards.add")}
            </button>
          </>
        ) : (
          <>
            {dueCount > 0 ? (
              <>
                <div className={styles.dueCount}>
                  <strong>{dueCount}</strong>
                  <span>{t("review.due", { count: dueCount })}</span>
                </div>
                <button type="button" onClick={() => begin(selectQueue(active, now))}>
                  {t("review.start")}
                </button>
              </>
            ) : (
              <>
                <p>{t("review.noneDue")}</p>
                <button type="button" onClick={() => begin(selectQueue(active, now))}>
                  {t("review.anyway")}
                </button>
              </>
            )}
            {showGroups && (
              <ul className={styles.collections}>
                {collectionList.map((collection) => {
                  const own = active.filter((card) => card.collectionId === collection.id);
                  const ownDueCount = countDue(own, now);
                  const ownTopics = topicList.filter(
                    (topic) => topic.collectionId === collection.id,
                  );

                  return (
                    <li key={collection.id} className={styles.collectionGroup}>
                      <button
                        type="button"
                        disabled={own.length === 0}
                        onClick={() => begin(selectQueue(own, now))}
                      >
                        <CollectionIcon icon={collection.icon} />
                        <strong>{collection.name}</strong>
                        <span className={styles.rowDetail}>
                          {ownDueCount > 0
                            ? t("review.due", { count: ownDueCount })
                            : t("review.collectionNoneDue")}
                        </span>
                      </button>
                      {ownTopics.length > 0 && (
                        <ul className={styles.topicRows}>
                          {ownTopics.map((topic) => {
                            const inTopic = own.filter((card) => card.topicIds.includes(topic.id));
                            const topicDueCount = countDue(inTopic, now);

                            return (
                              <li key={topic.id}>
                                <button
                                  type="button"
                                  disabled={inTopic.length === 0}
                                  onClick={() => begin(selectQueue(inTopic, now))}
                                >
                                  <TopicIcon icon={topic.icon} />
                                  <strong>{topic.name}</strong>
                                  <span className={styles.rowDetail}>
                                    {topicDueCount > 0
                                      ? t("review.due", { count: topicDueCount })
                                      : t("review.collectionNoneDue")}
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
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
