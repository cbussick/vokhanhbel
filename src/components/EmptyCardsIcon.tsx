import styles from "./EmptyStateIcons.module.css";

export function EmptyCardsIcon() {
  return (
    <svg viewBox="0 0 96 96" focusable="false">
      <path className={styles.back} d="M24 22h42a8 8 0 0 1 8 8v42H32a8 8 0 0 1-8-8Z" />
      <rect className={styles.front} x="18" y="16" width="56" height="56" rx="8" />
      <path className={styles.line} d="M30 32h32M30 44h22" />
      <circle className={styles.badge} cx="70" cy="70" r="15" />
      <path className={styles.add} d="M70 63v14M63 70h14" />
    </svg>
  );
}

export function EmptyCollectionsIcon() {
  return (
    <svg viewBox="0 0 96 96" focusable="false">
      <rect className={styles.back} x="8" y="22" width="52" height="50" rx="7" />
      <rect className={styles.back} x="32" y="14" width="52" height="50" rx="7" />
      <rect className={styles.front} x="19" y="28" width="58" height="48" rx="8" />
      <path className={styles.line} d="M33 44h30M33 56h21" />
      <circle className={styles.badge} cx="70" cy="70" r="15" />
      <path className={styles.add} d="M70 63v14M63 70h14" />
    </svg>
  );
}
