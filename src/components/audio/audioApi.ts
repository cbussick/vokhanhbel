import { apiPaths } from "../../contracts/apiPaths";
import { audioMetadataSchema, type AudioMetadata } from "../../contracts/card";
import { throwApiError } from "../../lib/apiClient";

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
