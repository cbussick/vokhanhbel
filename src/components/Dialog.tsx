import { useEffect, type ReactNode, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import styles from "./Dialog.module.css";

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <path d="m12 5-7 7 7 7M5 12h14" />
    </svg>
  );
}

function classNames(...values: (string | false | undefined)[]) {
  return values.filter(Boolean).join(" ");
}

/**
 * Every modal in the app: the native dialog element, its modal presentation, its cancel handling,
 * and the chrome around the content. A dialog fills a narrow viewport with a back arrow instead of
 * a close button, unless a destructive confirmation is showing.
 */
export function Dialog({
  dialogRef,
  initialFocusRef,
  titleId,
  title,
  busy = false,
  className,
  isConfirming = false,
  onDismissConfirmation,
  onClose,
  footer,
  children,
}: {
  /** The consumer keeps the element so it can close the dialog once its own work finishes. */
  dialogRef: RefObject<HTMLDialogElement | null>;
  /** The control that takes focus once the dialog is open. */
  initialFocusRef?: RefObject<HTMLElement | null> | undefined;
  titleId: string;
  title: string;
  /** Freezes the dialog while a request the Learner cannot interrupt is in flight. */
  busy?: boolean;
  /** Extra class for the dialog element, for a consumer that needs its own size. */
  className?: string | undefined;
  /**
   * A destructive confirmation is showing: the close affordances are suppressed so the Learner
   * answers it, and the dialog stays a sheet rather than taking over a narrow viewport.
   */
  isConfirming?: boolean;
  /** Escape while a confirmation is showing dismisses the confirmation, not the dialog. */
  onDismissConfirmation?: (() => void) | undefined;
  onClose: () => void;
  /** Stays pinned below the scrolling body. */
  footer?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation();

  useEffect(() => {
    dialogRef.current?.showModal();
    requestAnimationFrame(() => initialFocusRef?.current?.focus());
  }, [dialogRef, initialFocusRef]);

  return (
    <dialog
      ref={dialogRef}
      className={classNames(
        styles.dialog,
        !isConfirming && styles.mobileFullscreenDialog,
        className,
      )}
      onCancel={(event) => {
        // A nested dialog's cancel reaches this handler too; only the Learner's own Escape counts.
        if (event.target !== event.currentTarget) return;
        event.preventDefault();

        if (busy) return;

        if (isConfirming) {
          onDismissConfirmation?.();

          return;
        }

        onClose();
      }}
      aria-labelledby={titleId}
    >
      <section
        className={classNames(styles.sheet, !isConfirming && styles.mobileFullscreenSheet)}
        aria-busy={busy}
      >
        <header className={classNames(!isConfirming && styles.mobileFullscreenHeader)}>
          {!isConfirming && (
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
          {!isConfirming && (
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
        <div className={classNames(styles.body, Boolean(footer) && styles.bodyAboveFooter)}>
          {children}
        </div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </section>
    </dialog>
  );
}
