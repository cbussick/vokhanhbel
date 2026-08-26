import type { CardFace } from "../../contracts/card";

/**
 * Whether a face the Learner cannot read has also failed to play, leaving her nothing to go on.
 * A face carrying text stays usable when its recording fails, so only an audio-only one blocks —
 * grading past this point would record a Grade she never gave.
 */
export function audioOnlyFaceUnavailable(face: CardFace, available: boolean): boolean {
  return !face.text && Boolean(face.audio) && !available;
}
