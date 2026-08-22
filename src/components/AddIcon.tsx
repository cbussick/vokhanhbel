import styles from "./CollectionIcon.module.css";

export function AddIcon() {
  return (
    <span className={`${styles.frame} ${styles.compact}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" className={styles.glyph} focusable="false">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </span>
  );
}
