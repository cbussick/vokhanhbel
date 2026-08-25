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

/** One row of the group list: an icon beside the name, with the group's own due count below it. */
function GroupRow({
  icon,
  name,
  cards,
  now,
  onStart,
}: {
  icon: React.ReactNode;
  name: string;
  cards: Card[];
  now: number;
  onStart: () => void;
}) {
  const { t } = useTranslation();
  const dueCount = countDue(cards, now);

  return (
    <button type="button" disabled={cards.length === 0} onClick={onStart}>
      {icon}
      <span className={styles.rowText}>
        <strong>{name}</strong>
        <span className={styles.rowDetail}>
          {dueCount > 0 ? t("review.due", { count: dueCount }) : t("review.collectionNoneDue")}
        </span>
      </span>
    </button>
  );
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
    // The distractor pool is every Card the Learner has, not just the ones due today: VOK-15 draws
    // wrong options from a Card's Thema and then the rest of its Sammlung, which is wider than the
    // due queue.
    reviewSession.startReviewSession(selected, cards.data ?? []);
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
                  const ownTopics = topicList.filter(
                    (topic) => topic.collectionId === collection.id,
                  );

                  return (
                    <li key={collection.id} className={styles.collectionGroup}>
                      <GroupRow
                        icon={<CollectionIcon icon={collection.icon} />}
                        name={collection.name}
                        cards={own}
                        now={now}
                        onStart={() => begin(selectQueue(own, now))}
                      />
                      {ownTopics.length > 0 && (
                        <ul className={styles.topicRows}>
                          {ownTopics.map((topic) => {
                            const inTopic = own.filter((card) => card.topicIds.includes(topic.id));

                            return (
                              <li key={topic.id}>
                                <GroupRow
                                  icon={<TopicIcon icon={topic.icon} />}
                                  name={topic.name}
                                  cards={inTopic}
                                  now={now}
                                  onStart={() => begin(selectQueue(inTopic, now))}
                                />
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
