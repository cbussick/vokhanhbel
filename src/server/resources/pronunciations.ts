import type { AudioMetadata } from "../../contracts/card.js";
import type { PronunciationInput } from "../../contracts/pronunciation.js";
import { synthesizePronunciation, type SpeechProvider } from "../speech/speechProvider.js";
import { stageAudio } from "./audio.js";

/**
 * Synchronous by design: synthesis happens before anything is written, so a provider failure
 * leaves no asset record, no stored object and no changed Card behind. The clip then goes through
 * the same staging the Card form claims an upload from, so generation adds no second path onto a
 * Card face.
 */
export async function generatePronunciation(
  sessionHash: string,
  input: PronunciationInput,
  provider: SpeechProvider,
  requestId?: string,
): Promise<AudioMetadata> {
  const { bytes, contentType, provenance } = await synthesizePronunciation(provider, input);

  return stageAudio(sessionHash, bytes, provenance, contentType, requestId);
}
