import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "../AppShell";
import { RequireSession } from "../RequireSession";
import styles from "./reviewSession.module.css";

/**
 * The chrome every Exercise shares: the focused shell, the close control, the progress indicator
 * that counts Exercises, and the Review Submission issue banner. Each Exercise supplies only its
 * own body, so none of them restates the screen around it.
 *
 * `dialog` is a slot rather than part of `children` because the Tutor dialog belongs beside the
 * scrolling body, not inside it.
 *
 * `footer` is a slot for the same reason plus one of its own: the controls an Exercise reveals once
 * it has resolved — the verdict, Tutopher, "Weiter" — arrive all at once and used to shove the
 * Exercise upward at the exact moment the Learner was reading her answer. Reserving their height
 * from the start costs a band of empty space during the question and buys a screen that never moves
 * under her. It is reserved rather than overlaid because in multiple choice the options sit at the
 * bottom, and a panel sliding over them would cover the very answers she is checking.
 */
export function ExerciseScreen({
  position,
  total,
  issueKey,
  issueRequestId,
  onClose,
  children,
  dialog,
  footer,
}: {
  position: number;
  total: number;
  issueKey: string | undefined;
  issueRequestId: string | undefined;
  onClose: () => void;
  children: ReactNode;
  dialog?: ReactNode;
  footer: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <RequireSession>
      <AppShell title={t("review.title")} variant="focused">
        <section className={styles.session}>
          <header className={styles.sessionHeader}>
            <button type="button" aria-label={t("review.close")} onClick={onClose}>
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="m5 5 14 14M19 5 5 19" />
              </svg>
            </button>
            <div className={styles.progressWrap}>
              <span aria-hidden="true">
                {position} / {total}
              </span>
              <progress
                id="review-progress"
                aria-label={t("review.progress", { current: position, total })}
                value={position - 1}
                max={total}
              />
            </div>
          </header>
          <div className={styles.sessionBody}>
            {issueKey && (
              <p className={styles.issue} role="alert">
                {t(issueKey)}
                {issueRequestId && (
                  <span> {t("review.requestId", { requestId: issueRequestId })}</span>
                )}
              </p>
            )}
            {children}
            <div className={styles.resolutionFooter}>{footer}</div>
          </div>
          {dialog}
        </section>
      </AppShell>
    </RequireSession>
  );
}
