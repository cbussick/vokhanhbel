import { maximumCardTextLength, type AudioMetadata } from "../../contracts/card";
import { createNormalizedTextSchema } from "../../contracts/common";

/** The same gate the face's text passes through on its way to storage, so both sides compare equal. */
const faceTextSchema = createNormalizedTextSchema(maximumCardTextLength);

/**
 * Whether a clip no longer says what its face says. Derived from the two texts every time, never
 * stored, so it cannot drift away from either of them.
 *
 * Only a generated clip knows what it says, and a face without text says nothing a clip could
 * contradict, so a Learner's recording and an audio-only face are never marked — not by exception,
 * but because there is nothing to compare.
 */
export function isAudioStale(audio: AudioMetadata | null, faceText: string): boolean {
  const spokenText = audio?.synthesizedText;
  const writtenText = faceTextSchema.safeParse(faceText).data;

  if (!spokenText || !writtenText) return false;

  return spokenText !== writtenText;
}
