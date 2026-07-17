import { useTranslation } from "react-i18next";
import { useOnlineStatus } from "../lib/browserState";
import { useReviewSubmissions } from "../state/ReviewSubmissionContext";
import styles from "./ConnectivityBanner.module.css";

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
  else if (submissionSync.syncing) message = t("connectivity.syncing");
  if (!message) return null;

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
