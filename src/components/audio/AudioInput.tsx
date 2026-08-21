import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AudioMetadata } from "../../contracts/card";
import { AudioPlayer } from "./AudioPlayer";
import { stopApplicationPlayback } from "./playbackCoordinator";
import styles from "./AudioInput.module.css";

export interface AudioDraft {
  blob: Blob;
  source: string;
  metadata: AudioMetadata;
}

const recorderTypes = [
  "audio/webm;codecs=opus",
  "audio/ogg;codecs=opus",
  "audio/mp4;codecs=mp4a.40.2",
];
const maximumAudioBytes = 2_000_000;
const maximumAudioDurationMs = 7_000;

function normalizeContentType(type: string): AudioMetadata["contentType"] | undefined {
  const base = type.split(";", 1)[0]!.toLowerCase();

  if (base === "audio/mpeg" || base === "audio/mp3") return "audio/mpeg";
  if (base === "audio/mp4" || base === "audio/x-m4a") return "audio/mp4";
  if (base === "audio/webm") return "audio/webm";
  if (base === "audio/ogg") return "audio/ogg";
  if (base === "audio/wav" || base === "audio/x-wav") return "audio/wav";

  return undefined;
}

async function readDuration(source: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const timeout = window.setTimeout(() => reject(new Error("metadata-timeout")), 8_000);
    const finish = () => window.clearTimeout(timeout);

    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      finish();
      const duration = Math.round(audio.duration * 1_000);

      if (!Number.isFinite(duration) || duration <= 0) reject(new Error("invalid-duration"));
      else resolve(duration);
    };
    audio.onerror = () => {
      finish();
      reject(new Error("invalid-audio"));
    };
    audio.src = source;
  });
}

export function releaseAudioDraft(draft: AudioDraft | null): void {
  if (draft) URL.revokeObjectURL(draft.source);
}

export function AudioInput({
  face,
  draft,
  existing,
  existingRemoved,
  onDraftChange,
  onExistingRemovedChange,
}: {
  face: "front" | "back";
  draft: AudioDraft | null;
  existing: AudioMetadata | null;
  existingRemoved: boolean;
  onDraftChange: (draft: AudioDraft | null) => void;
  onExistingRemovedChange: (removed: boolean) => void;
}) {
  const { t } = useTranslation();
  const faceLabel = t(`audio.${face}`);
  const inputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | undefined>(undefined);
  const streamRef = useRef<MediaStream | undefined>(undefined);
  const timerRef = useRef<number | undefined>(undefined);
  const intervalRef = useRef<number | undefined>(undefined);
  const startedAtRef = useRef(0);
  const chunksRef = useRef<Blob[]>([]);
  const [recordingState, setRecordingState] = useState<
    "idle" | "requesting" | "recording" | "denied" | "missing" | "unsupported"
  >("idle");
  const [remainingMs, setRemainingMs] = useState(maximumAudioDurationMs);
  const [error, setError] = useState<string>();

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = undefined;
  };

  const clearTimers = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    timerRef.current = undefined;
    intervalRef.current = undefined;
  };

  useEffect(
    () => () => {
      clearTimers();
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      stopTracks();
    },
    [],
  );

  const setNewDraft = (value: AudioDraft | null) => {
    releaseAudioDraft(draft);
    onDraftChange(value);
    if (value) onExistingRemovedChange(true);
  };

  const acceptBlob = async (blob: Blob, knownDuration?: number) => {
    setError(undefined);
    if (blob.size <= 0) {
      setError(t("audio.empty"));

      return;
    }
    if (blob.size > maximumAudioBytes) {
      setError(t("audio.tooLarge"));

      return;
    }
    const contentType = normalizeContentType(blob.type);

    if (!contentType) {
      setError(t("audio.unsupportedFile"));

      return;
    }
    const normalizedBlob =
      blob.type === contentType ? blob : new Blob([blob], { type: contentType });
    const source = URL.createObjectURL(normalizedBlob);

    try {
      const durationMs = knownDuration ?? (await readDuration(source));

      if (durationMs > maximumAudioDurationMs) {
        URL.revokeObjectURL(source);
        setError(t("audio.tooLong"));

        return;
      }
      setNewDraft({
        blob: normalizedBlob,
        source,
        metadata: {
          id: crypto.randomUUID(),
          durationMs,
          contentType,
          byteSize: normalizedBlob.size,
        },
      });
      setRecordingState("idle");
    } catch {
      URL.revokeObjectURL(source);
      setError(t("audio.unreadable"));
    }
  };

  const chooseFile = async (file: File | undefined) => {
    if (file) await acceptBlob(file);
    if (inputRef.current) inputRef.current.value = "";
  };

  const stopRecording = () => {
    clearTimers();
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  };

  const startRecording = async () => {
    setError(undefined);
    stopApplicationPlayback();
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setRecordingState("unsupported");

      return;
    }
    const mimeType = recorderTypes.find((type) => MediaRecorder.isTypeSupported(type));

    if (!mimeType) {
      setRecordingState("unsupported");

      return;
    }
    setRecordingState("requesting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType });
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        clearTimers();
        stopTracks();
        const elapsed = Math.min(maximumAudioDurationMs, Date.now() - startedAtRef.current);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        void acceptBlob(blob, Math.max(1, elapsed));
      };
      startedAtRef.current = Date.now();
      setRemainingMs(maximumAudioDurationMs);
      setRecordingState("recording");
      recorder.start();
      intervalRef.current = window.setInterval(() => {
        setRemainingMs(Math.max(0, maximumAudioDurationMs - (Date.now() - startedAtRef.current)));
      }, 100);
      timerRef.current = window.setTimeout(stopRecording, maximumAudioDurationMs);
    } catch (value) {
      stopTracks();
      const name = value instanceof DOMException ? value.name : "";
      setRecordingState(name === "NotFoundError" ? "missing" : "denied");
    }
  };

  const visibleAudio = draft?.metadata ?? (!existingRemoved ? existing : null);
  const source = draft?.source;

  return (
    <fieldset className={styles.input}>
      <legend>{t("audio.inputLegend", { face: faceLabel })}</legend>
      {visibleAudio ? (
        <div className={styles.preview}>
          <AudioPlayer
            key={visibleAudio.id}
            audio={visibleAudio}
            {...(source ? { source } : {})}
            label={t(face === "front" ? "audio.frontLabel" : "audio.backLabel")}
          />
          <button
            type="button"
            onClick={() => {
              setNewDraft(null);
              onExistingRemovedChange(true);
            }}
          >
            {t("audio.remove")}
          </button>
        </div>
      ) : null}
      <div
        className={styles.dropZone}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void chooseFile(event.dataTransfer.files[0]);
        }}
      >
        <label htmlFor={`audio-${face}`}>{t("audio.select")}</label>
        <input
          ref={inputRef}
          id={`audio-${face}`}
          type="file"
          accept="audio/mpeg,audio/mp4,audio/webm,audio/ogg,audio/wav,.mp3,.m4a,.mp4,.webm,.ogg,.wav"
          onChange={(event) => void chooseFile(event.target.files?.[0])}
        />
        <span>{t("audio.limits")}</span>
      </div>
      {recordingState === "recording" ? (
        <div className={styles.recording} role="status">
          <span>{t("audio.recording", { seconds: (remainingMs / 1_000).toFixed(1) })}</span>
          <button type="button" onClick={stopRecording}>
            {t("audio.stop")}
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => void startRecording()}>
          {t(draft ? "audio.recordAgain" : "audio.record")}
        </button>
      )}
      <p className={styles.status} aria-live="polite">
        {recordingState === "requesting"
          ? t("audio.requesting")
          : recordingState === "denied"
            ? t("audio.denied")
            : recordingState === "missing"
              ? t("audio.missing")
              : recordingState === "unsupported"
                ? t("audio.unsupportedRecording")
                : ""}
      </p>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
