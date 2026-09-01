import type { AudioMetadata } from "../../contracts/card.js";
import type { PronunciationInput } from "../../contracts/pronunciation.js";
import { synthesizePronunciation, type SpeechProvider } from "../tts/speechProvider.js";
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
  const pronunciation = await synthesizePronunciation(provider, input);

  return stageAudio(
    sessionHash,
    pronunciation.bytes,
    {
      source: "generated",
      speechProvider: pronunciation.provider,
      speechVoice: pronunciation.voice,
      speechLanguage: pronunciation.language,
      synthesizedText: pronunciation.text,
    },
    pronunciation.contentType,
    requestId,
  );
}
