import { useTranslation } from "react-i18next";
import styles from "./reviewSession.module.css";

/**
 * An Exercise's verdict on one option. Narrower than any single Exercise's option type on purpose:
 * multiple choice passes its own option straight in, and Swipe — whose options carry neither an id
 * nor a modality — describes its two targets without inventing the fields it doesn't have.
 */
export interface OptionVerdict {
  /** Chosen and wrong, so it is out of play. */
  dead: boolean;
  /** The right answer, shown green — never true before the Exercise has resolved. */
  revealedCorrect: boolean;
}

/**
 * How an option looks once the Exercise has judged it. Shared by multiple choice and Swipe, which
 * present different Exercises but the same green/red verdict on an option.
 */
export function optionModifierClassName(verdict: OptionVerdict): string {
  if (verdict.revealedCorrect) return styles.optionCorrect ?? "";
  if (verdict.dead) return styles.optionDead ?? "";

  return "";
}

/** Carries the verdict to a screen reader, so colour is never the only signal. */
export function OptionOutcome({ verdict }: { verdict: OptionVerdict }) {
  const { t } = useTranslation();

  return (
    <>
      {verdict.dead && <span className={styles.visuallyHidden}> · {t("review.optionWrong")}</span>}
      {verdict.revealedCorrect && (
        <span className={styles.visuallyHidden}> · {t("review.optionCorrect")}</span>
      )}
    </>
  );
}
