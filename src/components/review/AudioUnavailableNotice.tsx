import { useTranslation } from "react-i18next";
import styles from "./reviewSession.module.css";

/**
 * Shown while a recording the Exercise depends on has failed to load. Grading stays blocked
 * meanwhile — guessing between options she cannot hear would record a Grade the Learner never
 * gave — so Skip Card is offered instead, which leaves Box and due date untouched.
 */
export function AudioUnavailableNotice({ onSkip }: { onSkip: () => void }) {
  const { t } = useTranslation();

  return (
    <div className={styles.audioUnavailable} role="alert">
      <p>{t("review.audioRequiredUnavailable")}</p>
      <button type="button" onClick={onSkip}>
        {t("review.skipCard")}
      </button>
    </div>
  );
}
