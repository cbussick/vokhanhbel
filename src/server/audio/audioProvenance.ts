import type { CollectionLanguage } from "../../contracts/collection.js";

/** A clip the Learner recorded herself, which carries no synthesis detail. */
export interface RecordedAudioProvenance {
  source: "recorded";
}

/**
 * A clip a speech provider produced, down to the exact text it was given. The field names are the
 * `audio_assets` column names, so the synthesizer's answer is recorded without being renamed on
 * the way. The stored text is what lets the clip say what it says, and what makes it regenerable.
 */
export interface GeneratedAudioProvenance {
  source: "generated";
  speechProvider: string;
  speechVoice: string;
  speechLanguage: CollectionLanguage;
  synthesizedText: string;
}

export type AudioProvenance = RecordedAudioProvenance | GeneratedAudioProvenance;
