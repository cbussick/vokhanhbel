import { useTranslation } from "react-i18next";
import type { CardFace as CardFaceValue } from "../../contracts/card";
import { AudioPlayer } from "./AudioPlayer";
import { VisualCardFace } from "./VisualCardFace";

export function CardFace({
  face,
  label,
  compact = false,
  onAudioAvailabilityChange,
}: {
  face: CardFaceValue;
  label: "front" | "back";
  compact?: boolean;
  onAudioAvailabilityChange?: ((available: boolean) => void) | undefined;
}) {
  const { t } = useTranslation();

  return (
    <VisualCardFace>
      {face.text ? <span data-card-face-text>{face.text}</span> : null}
      {face.audio ? (
        <AudioPlayer
          key={face.audio.id}
          audio={face.audio}
          label={t(label === "front" ? "audio.frontLabel" : "audio.backLabel")}
          compact={compact}
          onAvailabilityChange={onAudioAvailabilityChange}
        />
      ) : null}
    </VisualCardFace>
  );
}
