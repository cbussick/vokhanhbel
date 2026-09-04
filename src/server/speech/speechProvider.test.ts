import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CollectionLanguage } from "../../contracts/collection.js";
import { resetServerEnvironmentForTests } from "../config/environment.js";
import { createGoogleSpeechProvider, synthesizePronunciation } from "./speechProvider.js";
import { RecordingSpeechProvider } from "./speechProvider.test-helper.js";

const { synthesizeSpeech } = vi.hoisted(() => ({ synthesizeSpeech: vi.fn() }));

// These tests cover the Google adapter itself, which constructs the client. Injecting a seam here
// would only move the boundary and leave the adapter untested. Consumers use SpeechProvider.
// oxlint-disable-next-line anti-slop/no-module-mocking -- adapter test needs the real SDK faked
vi.mock("@google-cloud/text-to-speech", () => ({
  TextToSpeechClient: class TextToSpeechClientMock {
    synthesizeSpeech = synthesizeSpeech;
  },
}));

const pinnedVoices: [CollectionLanguage, string][] = [
  ["vi-VN", "vi-VN-Chirp3-HD-Gacrux"],
  ["de-DE", "de-DE-Chirp3-HD-Achernar"],
  ["en-US", "en-US-Chirp3-HD-Despina"],
];

describe("pronunciation synthesis", () => {
  it.each(pinnedVoices)(
    "asks for the voice pinned to %s with the caller's text",
    async (language, voice) => {
      const provider = new RecordingSpeechProvider();

      const pronunciation = await synthesizePronunciation(provider, { text: "xin chào", language });

      expect(provider.requests).toEqual([{ text: "xin chào", language, voice }]);
      expect(pronunciation).toMatchObject({
        contentType: "audio/mpeg",
        provenance: {
          source: "generated",
          speechProvider: provider.name,
          speechVoice: voice,
          speechLanguage: language,
          synthesizedText: "xin chào",
        },
      });
      expect(pronunciation.bytes).toBe(provider.speech.bytes);
    },
  );

  it("reports a synthesizer failure as a pronunciation problem", async () => {
    const provider = new RecordingSpeechProvider();
    provider.failure = new Error("upstream is down");

    await expect(
      synthesizePronunciation(provider, { text: "xin chào", language: "vi-VN" }),
    ).rejects.toMatchObject({ status: 502, type: "/problems/pronunciation-failed" });
  });
});

describe("Google Text-to-Speech adapter", () => {
  beforeEach(() => {
    Object.assign(process.env, {
      APP_PASSWORD_HASH: "test",
      DATABASE_URL: "postgresql://localhost/test",
      OPENAI_API_KEY: "test",
      OPENAI_MODEL: "test-model",
      RATE_LIMIT_HMAC_SECRET: "test-only-secret-at-least-thirty-two-characters",
      GOOGLE_TTS_PROJECT_ID: "test-project",
      GOOGLE_TTS_CLIENT_EMAIL: "tts@test-project.iam.gserviceaccount.com",
      GOOGLE_TTS_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\ntest\\n-----END PRIVATE KEY-----\\n",
    });
    resetServerEnvironmentForTests();
    synthesizeSpeech.mockReset();
  });

  it("requests MP3 explicitly, because the pinned voice family answers with LINEAR16", async () => {
    synthesizeSpeech.mockResolvedValue([{ audioContent: Buffer.from([1, 2, 3]) }]);

    const speech = await createGoogleSpeechProvider().synthesize({
      text: "xin chào",
      language: "vi-VN",
      voice: "vi-VN-Chirp3-HD-Gacrux",
    });

    expect(synthesizeSpeech).toHaveBeenCalledWith({
      input: { text: "xin chào" },
      voice: { languageCode: "vi-VN", name: "vi-VN-Chirp3-HD-Gacrux" },
      audioConfig: { audioEncoding: "MP3" },
    });
    expect(speech).toEqual({ bytes: Uint8Array.from([1, 2, 3]), contentType: "audio/mpeg" });
  });

  it("decodes audio the client returned as base64 text", async () => {
    synthesizeSpeech.mockResolvedValue([{ audioContent: Buffer.from([4, 5]).toString("base64") }]);

    const speech = await createGoogleSpeechProvider().synthesize({
      text: "hallo",
      language: "de-DE",
      voice: "de-DE-Chirp3-HD-Achernar",
    });

    expect(Uint8Array.from(speech.bytes)).toEqual(Uint8Array.from([4, 5]));
  });

  it("fails when the client answers without audio", async () => {
    synthesizeSpeech.mockResolvedValue([{ audioContent: null }]);

    await expect(
      createGoogleSpeechProvider().synthesize({
        text: "hello",
        language: "en-US",
        voice: "en-US-Chirp3-HD-Despina",
      }),
    ).rejects.toThrow("Google Text-to-Speech returned no audio");
  });
});
