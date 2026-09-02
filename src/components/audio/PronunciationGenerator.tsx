import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { AudioMetadata } from "../../contracts/card";
import type { CollectionLanguage } from "../../contracts/collection";
import { problemTypes } from "../../contracts/problem";
import { maximumPronunciationTextLength } from "../../contracts/pronunciation";
import { ApiError } from "../../lib/apiClient";
import { mutationKeys } from "../../lib/queryKeys";
import { PendingActionContent } from "../PendingActionContent";
import { generatePronunciation } from "./audioApi";
import styles from "./PronunciationGenerator.module.css";

function SpeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" focusable="false">
      <path d="M4 9h4l5-4v14l-5-4H4zM17 9a4 4 0 0 1 0 6M20 6a8 8 0 0 1 0 12" />
    </svg>
  );
}

/**
 * The Learner asks for a clip and waits for it. Nothing here runs on its own: no Card, no face and
 * no text change ever triggers synthesis, and a rejected request leaves the face untouched.
 *
 * The spoken text follows the face until the Learner types her own, so written and spoken form can
 * differ where they should — a face reading "chào (hello)" can still be spoken as "chào".
 */
export function PronunciationGenerator({
  face,
  language,
  faceText,
  onGenerated,
}: {
  face: "front" | "back";
  language: CollectionLanguage;
  faceText: string;
  onGenerated: (audio: AudioMetadata) => void;
}) {
  const { t } = useTranslation();
  const [editedText, setEditedText] = useState<string>();
  const [error, setError] = useState<string>();

  const textId = `pronunciation-${face}`;
  const hintId = `${textId}-hint`;
  const errorId = `${textId}-error`;
  const text = editedText ?? faceText;
  const spokenText = text.trim();
  // Whitespace only collapses on the way out, so a bound met here is met by the request too.
  const isTooLong = spokenText.length > maximumPronunciationTextLength;

  const generate = useMutation({
    mutationKey: mutationKeys.pronunciation,
    mutationFn: async () => generatePronunciation({ text: spokenText, language }),
    onSuccess: onGenerated,
    onError: (value) => {
      const type = value instanceof ApiError ? value.problem.type : undefined;

      setError(
        type === problemTypes.audioUploadRateLimit
          ? t("audio.generateRateLimit")
          : type === problemTypes.invalidRequest
            ? t("audio.generateRejected")
            : t("audio.generateFailed"),
      );
    },
  });

  // Every reason the button will not act says so in the hint, which describes both the field and
  // the button. A reason the Learner cannot reach is no reason at all, so the button keeps its
  // place in the tab order and refuses in `onClick` rather than going natively disabled.
  const hint = isTooLong
    ? "audio.pronunciationTooLong"
    : spokenText
      ? "audio.pronunciationHint"
      : "audio.pronunciationEmpty";
  const isBlocked = !spokenText || isTooLong || generate.isPending;

  return (
    <div className={styles.generator}>
      <label className={styles.label} htmlFor={textId}>
        <span className={styles.icon} aria-hidden="true">
          <SpeakerIcon />
        </span>
        {t("audio.pronunciationText")}
      </label>
      <input
        id={textId}
        className={styles.text}
        aria-describedby={hintId}
        {...(isTooLong ? { "aria-invalid": true } : {})}
        value={text}
        onChange={(event) => setEditedText(event.target.value)}
      />
      <p id={hintId} className={isTooLong ? styles.warning : styles.hint}>
        {t(hint, {
          language: t(`collections.languages.${language}`),
          max: maximumPronunciationTextLength,
        })}
      </p>
      <button
        type="button"
        className={styles.generateButton}
        aria-busy={generate.isPending}
        aria-describedby={error ? `${hintId} ${errorId}` : hintId}
        // Set only while the button will not act: a literal "false" would claim this control is
        // available even when the form around it is not.
        {...(isBlocked ? { "aria-disabled": true } : {})}
        onClick={() => {
          if (isBlocked) return;

          setError(undefined);
          generate.mutate();
        }}
      >
        <PendingActionContent
          pending={generate.isPending}
          label={t("audio.generate")}
          pendingLabel={t("audio.generating")}
        />
      </button>
      {error ? (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
