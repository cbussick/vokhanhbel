import styles from "./CollectionIcon.module.css";

/** Framed create-option icon for CollectionSelect and TopicSelect, not an IconButton glyph. */
export function AddIcon() {
  return (
    <span className={`${styles.frame} ${styles.compact}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" className={styles.glyph} focusable="false">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </span>
  );
}
