import { useTranslation } from "react-i18next";
import { useOnlineStatus } from "../lib/browserState";
import { useReviewSubmissions } from "../state/ReviewSubmissionContext";
import styles from "./ConnectivityBanner.module.css";

/**
 * Two presentations for two very different situations. Being offline, or having Review Submissions
 * the server refused, is a standing state the Learner has to know about and may need to act on — it
 * earns the sticky bar. A sync in flight is neither: it resolves on its own within a second, so it
 * shows as a floating toast that reassures without taking a row of the layout and shifting the
 * Exercise she is in the middle of answering.
 */
export function ConnectivityBanner() {
  const { t } = useTranslation();
  const { submissionSync } = useReviewSubmissions();
  const online = useOnlineStatus();
  let message: string | undefined;

  if (!online && submissionSync.outstandingCount > 0)
    message = t("connectivity.offlinePending", {
      count: submissionSync.outstandingCount,
    });
  else if (!online) message = t("connectivity.offline");
  else if (submissionSync.failedCount > 0)
    message = t("connectivity.failed", { count: submissionSync.failedCount });

  // `aria-live` rather than `role="status"`, matching the bar below: the two announce the same way,
  // and a second `status` role floating over every screen made `getByRole("status")` ambiguous for
  // any Exercise that has one of its own, whenever a sync happened to still be in flight.
  if (!message)
    return submissionSync.syncing ? (
      <p className={styles.toast} aria-live="polite">
        {t("connectivity.syncing")}
      </p>
    ) : null;

  return (
    <aside className={styles.banner} aria-live="polite">
      <span>{message}</span>
      {submissionSync.failedCount > 0 && (
        <button type="button" onClick={submissionSync.retryFailedSubmissions}>
          {t("common.retry")}
        </button>
      )}
    </aside>
  );
}
