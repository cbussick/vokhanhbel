import styles from "./PendingActionContent.module.css";

export function PendingActionContent({
  pending,
  label,
  pendingLabel,
}: {
  pending: boolean;
  label: string;
  pendingLabel: string;
}) {
  return (
    <span className={styles.content} aria-live="polite">
      {pending ? <span className={styles.spinner} aria-hidden="true" /> : null}
      <span>{pending ? pendingLabel : label}</span>
    </span>
  );
}
