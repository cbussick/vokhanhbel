import styles from "./ErrorScreen.module.css";

interface ErrorScreenProps {
  actionLabel: string;
  message: string;
  onAction: () => void;
  title: string;
}

export function ErrorScreen({ actionLabel, message, onAction, title }: ErrorScreenProps) {
  return (
    <main className={styles.screen}>
      <div className={styles.card}>
        <h1>{title}</h1>
        <p role="alert">{message}</p>
        <button type="button" onClick={onAction}>
          {actionLabel}
        </button>
      </div>
    </main>
  );
}
