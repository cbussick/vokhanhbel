import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import styles from "./Dialog.module.css";

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <path d="m12 5-7 7 7 7M5 12h14" />
    </svg>
  );
}

export function getFormDialogClassName(compact: boolean) {
  return compact ? styles.dialog : `${styles.dialog} ${styles.mobileFullscreenDialog}`;
}

export function FormDialogContent({
  titleId,
  title,
  busy,
  compact,
  onClose,
  children,
}: {
  titleId: string;
  title: string;
  busy: boolean;
  compact: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const sheetClassName = compact ? styles.sheet : `${styles.sheet} ${styles.mobileFullscreenSheet}`;

  return (
    <section className={sheetClassName} aria-busy={busy}>
      <header className={compact ? undefined : styles.mobileFullscreenHeader}>
        {!compact && (
          <button
            type="button"
            className={`${styles.iconButton} ${styles.backButton}`}
            disabled={busy}
            onClick={onClose}
            aria-label={t("common.back")}
          >
            <BackIcon />
          </button>
        )}
        <h2 id={titleId}>{title}</h2>
        {!compact && (
          <button
            type="button"
            className={`${styles.iconButton} ${styles.closeButton}`}
            disabled={busy}
            onClick={onClose}
            aria-label={t("common.close")}
          >
            ×
          </button>
        )}
      </header>
      <div className={styles.body}>{children}</div>
    </section>
  );
}
