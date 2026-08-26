import { useTranslation } from "react-i18next";
import styles from "./reviewSession.module.css";

/** Opens Tutopher from a revealed flip Card or a resolved Exercise. */
export function TutorButton({
  onClick,
  disabled,
  hidden = false,
}: {
  onClick: () => void;
  disabled: boolean;
  /** Held in the layout but out of the accessibility tree until the Exercise has resolved. */
  hidden?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      className={styles.tutorButton}
      onClick={onClick}
      disabled={disabled}
      hidden={hidden}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M12 2.5c.7 4.5 2.9 6.7 7.4 7.4-4.5.7-6.7 2.9-7.4 7.4-.7-4.5-2.9-6.7-7.4-7.4 4.5-.7 6.7-2.9 7.4-7.4Z" />
        <path
          d="M19 15.5c.35 2.2 1.45 3.3 3.65 3.65-2.2.35-3.3 1.45-3.65 3.65-.35-2.2-1.45-3.3-3.65-3.65 2.2-.35 3.3-1.45 3.65-3.65Z"
          opacity=".65"
        />
      </svg>
      {t("tutor.open")}
    </button>
  );
}
