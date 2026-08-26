import { useTranslation } from "react-i18next";
import { TutorButton } from "./TutorButton";
import styles from "./reviewSession.module.css";

/**
 * What an Exercise shows once it has been answered: how it went, Tutopher, and the way on. Fills
 * `ExerciseScreen`'s `footer` slot, which reserves this height from the first frame — so every
 * control here carries `hidden` until the Exercise resolves rather than being conditionally
 * rendered. That is the invariant the whole no-layout-shift behaviour rests on, and keeping it in
 * one place is why this is a component rather than three copies of the same fragment.
 */
export function ResolutionFooter({
  resolved,
  verdict,
  onAdvance,
  tutor,
}: {
  resolved: boolean;
  /** The line saying how the Exercise went, shown once it has resolved. */
  verdict: string;
  onAdvance: () => void;
  /** Left out by matching, which opens Tutopher from a matched pair instead of from here. */
  tutor?: { onOpen: () => void; disabled: boolean };
}) {
  const { t } = useTranslation();

  return (
    <>
      <p className={styles.outcome} role="status">
        {resolved && verdict}
      </p>
      {tutor && <TutorButton onClick={tutor.onOpen} disabled={tutor.disabled} hidden={!resolved} />}
      <button type="button" className={styles.revealButton} onClick={onAdvance} hidden={!resolved}>
        {t("review.continue")}
      </button>
    </>
  );
}
