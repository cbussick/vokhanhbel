import type { ReactNode } from "react";
import styles from "./EmptyState.module.css";

interface EmptyStateProps {
  text: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ text, icon, action }: EmptyStateProps) {
  return (
    <div className={styles.root}>
      {icon ? (
        <div className={styles.icon} aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <p className={styles.text}>{text}</p>
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
