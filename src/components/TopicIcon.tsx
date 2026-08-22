import type { TopicIconKey } from "../contracts/topic";
import styles from "./CollectionIcon.module.css";

function ShapesIcon() {
  return (
    <svg viewBox="0 0 24 24" className={styles.glyph} focusable="false">
      <path d="M8.3 10a.7.7 0 0 1-.626-1.079L11.4 3a.7.7 0 0 1 1.198-.043L16.3 8.9a.7.7 0 0 1-.572 1.1Z" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <circle cx="17.5" cy="17.5" r="3.5" />
    </svg>
  );
}

function AnimalIcon() {
  return (
    <svg viewBox="0 0 24 24" className={styles.glyph} focusable="false">
      <circle cx="11" cy="4" r="2" />
      <circle cx="18" cy="8" r="2" />
      <circle cx="20" cy="16" r="2" />
      <path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z" />
    </svg>
  );
}

function FoodIcon() {
  return (
    <svg viewBox="0 0 24 24" className={styles.glyph} focusable="false">
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
      <path d="M7 2v20" />
      <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
    </svg>
  );
}

function TravelIcon() {
  return (
    <svg viewBox="0 0 24 24" className={styles.glyph} focusable="false">
      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5.1 1 .6 1.2L13 12l-2 3H4l-1 1 3 2 2 3 1-1v-7l3-2 5.2 10.2c.3.4.8.5 1.1.6l.6-.3c.4-.2.6-.6.5-1.1z" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" className={styles.glyph} focusable="false">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

const iconsByKey = {
  shapes: ShapesIcon,
  animal: AnimalIcon,
  food: FoodIcon,
  travel: TravelIcon,
  people: PeopleIcon,
} as const satisfies Record<TopicIconKey, () => React.ReactElement>;

export function TopicIcon({
  icon,
  size = "default",
}: {
  icon: TopicIconKey;
  size?: "default" | "compact";
}) {
  const Icon = iconsByKey[icon];

  return (
    <span
      className={`${styles.frame} ${size === "compact" ? styles.compact : ""}`}
      aria-hidden="true"
    >
      <Icon />
    </span>
  );
}
