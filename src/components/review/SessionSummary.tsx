import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import type { SummaryView } from "../../state/ReviewSessionContext";
import { AppShell } from "../AppShell";
import { CollectionIcon } from "../CollectionIcon";
import { RequireSession } from "../RequireSession";
import { TopicIcon } from "../TopicIcon";
import { TutopherAvatar } from "../TutopherAvatar";
import styles from "./reviewSession.module.css";

const confettiColors = [
  "var(--color-primary)",
  "var(--color-success)",
  "var(--color-warning)",
  "var(--color-danger)",
];
const confettiPieceCount = 90;

interface ConfettiPiece {
  id: number;
  left: string;
  color: string;
  delay: string;
  duration: string;
  drift: string;
  spin: string;
  width: string;
  height: string;
}

/**
 * The shape of the celebration: every piece is thrown at once but lands over a spread of time, so it
 * reads as one burst that then settles rather than a single sheet sweeping past. Delays stay inside
 * the first ~0.7s (the burst) while durations run 2.2–3.4s (the settle), which puts the last piece
 * off screen a little over four seconds in.
 */
function createConfettiPieces(): ConfettiPiece[] {
  return Array.from({ length: confettiPieceCount }, (_, index) => ({
    id: index,
    left: `${Math.round(Math.random() * 100)}%`,
    color: confettiColors[index % confettiColors.length]!,
    delay: `${Math.round(Math.random() * 700)}ms`,
    duration: `${(2.2 + Math.random() * 1.2).toFixed(2)}s`,
    drift: (Math.random() * 2 - 1).toFixed(2),
    spin: (Math.random() * 2 - 1).toFixed(2),
    // A mix of sizes reads as depth, the near pieces falling faster than the far ones.
    width: `${(0.35 + Math.random() * 0.35).toFixed(2)}rem`,
    height: `${(0.6 + Math.random() * 0.5).toFixed(2)}rem`,
  }));
}

/**
 * Hand-rolled rather than pulled from a library: this project has no UI dependencies, and a
 * celebration is not the place to acquire the first one. Covers the whole viewport rather than only
 * the summary panel, so the fall has somewhere to happen. Hidden from assistive tech, and suppressed
 * entirely under reduced motion by the `.confetti` rule in reviewSession.module.css.
 */
function Confetti() {
  const [pieces] = useState(createConfettiPieces);

  return (
    <div className={styles.confetti} aria-hidden="true">
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className={styles.confettiPiece}
          // SAFETY: React's CSSProperties type has no slot for a custom property, but
          // `--confetti-drift` and `--confetti-spin` are plain style declarations a browser accepts
          // like any other.
          style={
            {
              left: piece.left,
              inlineSize: piece.width,
              blockSize: piece.height,
              background: piece.color,
              animationDelay: piece.delay,
              animationDuration: piece.duration,
              "--confetti-drift": piece.drift,
              "--confetti-spin": piece.spin,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

function AllCardsIcon() {
  return (
    <span className={styles.summaryScopeIcon} aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false">
        <rect x="4" y="3" width="14" height="17" rx="2" />
        <path d="M8 7h6M8 11h6M8 15h4M18 7h2v14a2 2 0 0 1-2 2H8" />
      </svg>
    </span>
  );
}

/** Where a Review Session ends: what it earned, the Streak it extended, and a small celebration. */
export function SessionSummary({
  view,
  currentStreak,
  onRepeatForgotten,
  onFinish,
}: {
  view: SummaryView;
  currentStreak: number;
  onRepeatForgotten: () => void;
  onFinish: () => void;
}) {
  const { t } = useTranslation();
  const headingRef = useRef<HTMLHeadingElement>(null);

  // The summary replaces the Exercise screen in place, so nothing else moves focus there for a
  // screen reader — move it to the heading ourselves, as Dialog and Login do for their own arrivals.
  useEffect(() => {
    requestAnimationFrame(() => headingRef.current?.focus());
  }, []);

  return (
    <RequireSession>
      <AppShell title={t("review.title")}>
        <section className={styles.summary}>
          {view.firstRound && <Confetti />}
          <div className={styles.summaryCard}>
            <div className={styles.summaryPortrait}>
              <TutopherAvatar size="large" />
            </div>
            <div className={styles.summaryContent}>
              <div className={styles.summaryScope}>
                {view.scope.kind === "all" ? (
                  <AllCardsIcon />
                ) : (
                  <span className={styles.summaryScopeIcons} aria-hidden="true">
                    <CollectionIcon icon={view.scope.collection.icon} />
                    {view.scope.topics[0] ? (
                      <TopicIcon icon={view.scope.topics[0].icon} size="compact" />
                    ) : null}
                    {view.scope.topics.length > 1 ? (
                      <span className={styles.summaryScopeMore}>
                        +{view.scope.topics.length - 1}
                      </span>
                    ) : null}
                  </span>
                )}
                <p>
                  {view.scope.kind === "all"
                    ? t("review.scopeAllCards")
                    : view.scope.topics.length === 0
                      ? view.scope.collection.name
                      : view.scope.topics.length === 1
                        ? `${view.scope.collection.name} · ${view.scope.topics[0]!.name}`
                        : t("review.scopeTopics", {
                            collection: view.scope.collection.name,
                            count: view.scope.topics.length,
                          })}
                </p>
              </div>
              <h2 ref={headingRef} tabIndex={-1}>
                {t("review.summary")}
              </h2>
              <dl className={styles.summaryStats}>
                <div>
                  <dt>{t("review.summaryReviews")}</dt>
                  <dd>{view.cumulativeReviewSubmissions}</dd>
                </div>
                <div>
                  <dt>{t("review.summaryPoints")}</dt>
                  <dd>{view.cumulativeOptimisticPoints}</dd>
                </div>
                <div>
                  <dt>{t("me.streak")}</dt>
                  <dd>{currentStreak}</dd>
                </div>
              </dl>
              <div className={styles.summaryActions}>
                {view.canRepeatForgotten && (
                  <button
                    type="button"
                    className={styles.summaryRepeat}
                    onClick={onRepeatForgotten}
                  >
                    {t("review.repeat")}
                  </button>
                )}
                <button type="button" className={styles.summaryFinish} onClick={onFinish}>
                  {t("common.finish")}
                </button>
              </div>
            </div>
          </div>
        </section>
      </AppShell>
    </RequireSession>
  );
}
