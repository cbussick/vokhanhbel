import { apiPaths } from "../../contracts/apiPaths";
import { audioMetadataSchema, type AudioMetadata } from "../../contracts/card";
import { pronunciationInputSchema, type PronunciationInput } from "../../contracts/pronunciation";
import { apiRequest, throwApiError } from "../../lib/apiClient";

export async function stageAudioDraft(blob: Blob): Promise<AudioMetadata> {
  const response = await fetch(apiPaths.stageAudio, {
    method: "POST",
    body: blob,
    headers: { "Content-Type": blob.type },
    credentials: "same-origin",
  });

  if (!response.ok) await throwApiError(response);

  return audioMetadataSchema.parse(await response.json());
}

/**
 * Answers with staged audio, exactly as an upload does, so a generated clip reaches a Card face
 * through the claiming path a recording already uses. Nothing is written when this rejects.
 */
export async function generatePronunciation(input: PronunciationInput): Promise<AudioMetadata> {
  return audioMetadataSchema.parse(
    await apiRequest(apiPaths.pronunciations, {
      method: "POST",
      body: JSON.stringify(pronunciationInputSchema.parse(input)),
    }),
  );
}
