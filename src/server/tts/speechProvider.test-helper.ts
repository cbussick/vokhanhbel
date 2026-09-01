import { createMp3Fixture } from "../audio/audioFixture.test-helper.js";
import type { SpeechProvider, SpeechRequest, SynthesizedSpeech } from "./speechProvider.js";

/**
 * Records every request it is asked for, so a test can prove which locale, voice and text reached
 * the synthesizer. Substituting it also guarantees no suite ever calls Google.
 */
export class RecordingSpeechProvider implements SpeechProvider {
  readonly name = "recording-speech-provider";
  readonly requests: SpeechRequest[] = [];
  speech: SynthesizedSpeech = { bytes: createMp3Fixture(), contentType: "audio/mpeg" };
  failure: Error | undefined;

  synthesize(request: SpeechRequest): Promise<SynthesizedSpeech> {
    this.requests.push(request);

    return this.failure ? Promise.reject(this.failure) : Promise.resolve(this.speech);
  }
}
