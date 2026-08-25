import { useTranslation } from "react-i18next";
import type { MultipleChoiceOptionView } from "../../state/ReviewSessionContext";
import { AudioPlayer } from "../audio/AudioPlayer";
import { OptionOutcome, optionModifierClassName } from "./optionAppearance";
import styles from "./reviewSession.module.css";

/**
 * An audio option is a play control plus a separate "choose" button rather than one clickable
 * button, because AudioPlayer's own play/pause/retry control must keep working — including the
 * retry a Learner needs precisely while `audioUnavailable` blocks every choose button — regardless
 * of whether grading is currently blocked.
 */
export function MultipleChoiceOptions({
  options,
  resolved,
  disabled,
  audioUnavailable,
  onOptionAvailabilityChange,
  onChoose,
}: {
  options: MultipleChoiceOptionView[];
  resolved: boolean;
  disabled: boolean;
  audioUnavailable: boolean;
  onOptionAvailabilityChange: (optionId: string, available: boolean) => void;
  onChoose: (optionId: string) => void;
}) {
  const { t } = useTranslation();
  const audioMode = options.some((option) => option.audio);

  return (
    <fieldset className={styles.options} disabled={disabled}>
      <legend className={styles.optionsLegend}>
        {t(audioMode ? "review.multipleChoiceAudioLegend" : "review.multipleChoiceLegend")}
      </legend>
      <div className={styles.optionsGrid}>
        {options.map((option, index) =>
          option.audio ? (
            <div
              key={option.id}
              className={`${styles.audioOption} ${optionModifierClassName(option)}`}
            >
              <AudioPlayer
                audio={option.audio}
                label={t("review.audioOptionLabel", { index: index + 1 })}
                compact
                onAvailabilityChange={(available) =>
                  onOptionAvailabilityChange(option.id, available)
                }
              />
              <button
                type="button"
                className={styles.chooseOption}
                disabled={resolved || option.dead || audioUnavailable}
                onClick={() => onChoose(option.id)}
              >
                {t("review.chooseOption", { index: index + 1 })}
                <OptionOutcome verdict={option} />
              </button>
            </div>
          ) : (
            <button
              key={option.id}
              type="button"
              className={`${styles.option} ${optionModifierClassName(option)}`}
              disabled={resolved || option.dead}
              onClick={() => onChoose(option.id)}
            >
              {option.text}
              <OptionOutcome verdict={option} />
            </button>
          ),
        )}
      </div>
    </fieldset>
  );
}
