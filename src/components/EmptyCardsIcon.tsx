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
      <path className={styles.back} d="M20 24h22l7 8h27a7 7 0 0 1 7 7v34H20Z" />
      <path className={styles.front} d="M13 38a7 7 0 0 1 7-7h56a7 7 0 0 1 7 7v35H13Z" />
      <path className={styles.line} d="M29 48h38M29 59h25" />
      <circle className={styles.badge} cx="70" cy="70" r="15" />
      <path className={styles.add} d="M70 63v14M63 70h14" />
    </svg>
  );
}
