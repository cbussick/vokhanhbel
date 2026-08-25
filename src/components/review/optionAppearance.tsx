import { useTranslation } from "react-i18next";
import type { MultipleChoiceOptionView } from "../../state/ReviewSessionContext";
import styles from "./reviewSession.module.css";

/**
 * How a chosen option looks once the Exercise has judged it. Shared by multiple choice and Swipe,
 * which present different Exercises but the same green/red verdict on an option.
 */
export function optionModifierClassName(option: MultipleChoiceOptionView): string {
  if (option.revealedCorrect) return styles.optionCorrect ?? "";
  if (option.dead) return styles.optionDead ?? "";

  return "";
}

/** Carries the verdict to a screen reader, so colour is never the only signal. */
export function OptionOutcome({ option }: { option: MultipleChoiceOptionView }) {
  const { t } = useTranslation();

  return (
    <>
      {option.dead && <span className={styles.visuallyHidden}> · {t("review.optionWrong")}</span>}
      {option.revealedCorrect && (
        <span className={styles.visuallyHidden}> · {t("review.optionCorrect")}</span>
      )}
    </>
  );
}
