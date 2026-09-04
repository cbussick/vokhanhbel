import { TextToSpeechClient } from "@google-cloud/text-to-speech";
import type { CollectionLanguage } from "../../contracts/collection.js";
import { problemTypes } from "../../contracts/problem.js";
import type { PronunciationInput } from "../../contracts/pronunciation.js";
import type { GeneratedAudioProvenance } from "../audio/audioProvenance.js";
import { getGoogleSpeechEnvironment } from "../config/environment.js";
import { AppProblem } from "../http/problem.js";

export interface SpeechRequest {
  text: string;
  language: CollectionLanguage;
  voice: string;
}

export interface SynthesizedSpeech {
  bytes: Uint8Array;
  contentType: string;
}

/**
 * The whole surface a synthesizer exposes: text, a locale and a voice in, encoded bytes with their
 * content type out. It knows nothing about Cards, faces or Collections, and it is called only from
 * backend code so the credential never reaches the browser — the precedent ADR-0003 set for the
 * Tutor's AI provider.
 */
export interface SpeechProvider {
  /** Recorded on a generated clip, so an asset says which synthesizer produced it. */
  readonly name: string;
  synthesize: (request: SpeechRequest) => Promise<SynthesizedSpeech>;
}

/**
 * One voice per supported locale, pinned here rather than stored or chosen by the Learner. That
 * keeps the cost tier deliberate, keeps output reproducible, and makes an upgrade a single edit.
 * All three come from the same Chirp 3 HD family.
 */
const pronunciationVoices = {
  "vi-VN": "vi-VN-Chirp3-HD-Gacrux",
  "de-DE": "de-DE-Chirp3-HD-Achernar",
  "en-US": "en-US-Chirp3-HD-Despina",
} as const satisfies Record<CollectionLanguage, string>;

/** Encoded speech together with the provenance the generated audio asset records verbatim. */
export interface GeneratedClip extends SynthesizedSpeech {
  provenance: GeneratedAudioProvenance;
}

export async function synthesizePronunciation(
  provider: SpeechProvider,
  input: PronunciationInput,
): Promise<GeneratedClip> {
  const { text, language } = input;
  const voice = pronunciationVoices[language];

  let speech: SynthesizedSpeech;

  try {
    speech = await provider.synthesize({ text, language, voice });
  } catch {
    throw new AppProblem(
      502,
      problemTypes.pronunciationFailed,
      "Aussprache konnte nicht erzeugt werden",
    );
  }

  return {
    ...speech,
    provenance: {
      source: "generated",
      speechProvider: provider.name,
      speechVoice: voice,
      speechLanguage: language,
      synthesizedText: text,
    },
  };
}

export function createGoogleSpeechProvider(): SpeechProvider {
  const environment = getGoogleSpeechEnvironment();
  const client = new TextToSpeechClient({
    projectId: environment.projectId,
    credentials: { client_email: environment.clientEmail, private_key: environment.privateKey },
  });

  return {
    name: "google-cloud-text-to-speech",
    async synthesize({ text, language, voice }) {
      const [response] = await client.synthesizeSpeech({
        input: { text },
        voice: { languageCode: language, name: voice },
        // Chirp 3 HD answers with LINEAR16 unless MP3 is asked for explicitly. Synchronous
        // synthesis supports MP3; only streaming synthesis, which this feature does not use, does
        // not.
        audioConfig: { audioEncoding: "MP3" },
      });
      const content = response.audioContent;

      if (!content) throw new Error("Google Text-to-Speech returned no audio");

      return {
        bytes:
          typeof content === "string" ? Buffer.from(content, "base64") : Uint8Array.from(content),
        contentType: "audio/mpeg",
      };
    },
  };
}

let speechProvider: SpeechProvider | undefined;

export function getSpeechProvider(): SpeechProvider {
  speechProvider ??= createGoogleSpeechProvider();

  return speechProvider;
}

export function setSpeechProviderForTests(provider: SpeechProvider | undefined): void {
  speechProvider = provider;
}
