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

function AudioWaveIcon() {
  return (
    <svg viewBox="0 0 24 24" focusable="false">
      <path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" focusable="false">
      <path d="M12 16V4m0 0L8 8m4-4 4 4M5 15v4h14v-4" />
    </svg>
  );
}

function MicrophoneIcon() {
  return (
    <svg viewBox="0 0 24 24" focusable="false">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" focusable="false">
      <rect x="7" y="7" width="10" height="10" rx="1" />
    </svg>
  );
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
  const dragDepthRef = useRef(0);
  const [recordingState, setRecordingState] = useState<
    "idle" | "requesting" | "recording" | "denied" | "missing" | "unsupported"
  >("idle");
  const [remainingMs, setRemainingMs] = useState(maximumAudioDurationMs);
  const [error, setError] = useState<string>();
  const [dragging, setDragging] = useState(false);

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

  const hasDraggedFiles = (event: React.DragEvent) =>
    Array.from(event.dataTransfer.types).includes("Files");

  const resetDragState = () => {
    dragDepthRef.current = 0;
    setDragging(false);
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
  const isRecording = recordingState === "recording";
  const isRequesting = recordingState === "requesting";
  const selectLabel = t("audio.selectForFace", { face: faceLabel });

  return (
    <fieldset
      className={styles.input}
      data-dragging={dragging ? "true" : undefined}
      onDragEnter={(event) => {
        if (!hasDraggedFiles(event)) return;
        event.preventDefault();
        dragDepthRef.current += 1;
        setDragging(true);
      }}
      onDragOver={(event) => {
        if (!hasDraggedFiles(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={(event) => {
        if (!hasDraggedFiles(event)) return;
        event.preventDefault();
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
        if (dragDepthRef.current === 0) setDragging(false);
      }}
      onDrop={(event) => {
        if (!hasDraggedFiles(event)) return;
        event.preventDefault();
        resetDragState();
        void chooseFile(event.dataTransfer.files[0]);
      }}
    >
      <legend className={styles.visuallyHidden}>
        {t("audio.inputLegend", { face: faceLabel })}
      </legend>
      <div className={`${styles.rail} ${isRecording ? styles.recordingRail : ""}`}>
        <div className={styles.header}>
          <span className={styles.label}>
            <span className={styles.icon} aria-hidden="true">
              <AudioWaveIcon />
            </span>
            {t("audio.label")}
          </span>
          <span className={styles.recordingIndicator} aria-hidden="true">
            {isRecording ? (
              <>
                <span className={styles.recordingDot} />
                {t("audio.recording", { seconds: (remainingMs / 1_000).toFixed(1) })}
              </>
            ) : null}
          </span>
        </div>
        {visibleAudio ? (
          <div className={styles.preview}>
            <AudioPlayer
              key={visibleAudio.id}
              audio={visibleAudio}
              {...(source ? { source } : {})}
              label={t(face === "front" ? "audio.frontLabel" : "audio.backLabel")}
              compact
            />
            <button
              className={styles.removeButton}
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
        <input
          ref={inputRef}
          id={`audio-${face}`}
          type="file"
          hidden
          accept="audio/mpeg,audio/mp4,audio/webm,audio/ogg,audio/wav,.mp3,.m4a,.mp4,.webm,.ogg,.wav"
          onChange={(event) => void chooseFile(event.target.files?.[0])}
        />
        <button
          type="button"
          className={`${styles.actionButton} ${isRecording ? styles.stopButton : styles.recordButton}`}
          aria-label={
            isRecording ? t("audio.stop") : t(visibleAudio ? "audio.recordAgain" : "audio.record")
          }
          disabled={isRequesting}
          onClick={isRecording ? stopRecording : () => void startRecording()}
        >
          <span className={styles.icon} aria-hidden="true">
            {isRecording ? <StopIcon /> : <MicrophoneIcon />}
          </span>
          <span>
            {isRecording
              ? t("audio.stopShort")
              : isRequesting
                ? t("audio.requestingShort")
                : t(visibleAudio ? "audio.recordAgain" : "audio.recordShort")}
          </span>
        </button>
        <div className={styles.separator}>
          <span>{t("audio.or")}</span>
        </div>
        <div className={styles.dropZone}>
          <span className={`${styles.icon} ${styles.dropIcon}`} aria-hidden="true">
            <UploadIcon />
          </span>
          <span className={styles.dropCopy}>
            <strong>{t(dragging ? "audio.drop" : "audio.dropIdle")}</strong>
            <span>{t("audio.formats")}</span>
          </span>
          <button
            type="button"
            className={`${styles.actionButton} ${styles.fileButton}`}
            aria-label={selectLabel}
            disabled={isRecording || isRequesting}
            onClick={() => inputRef.current?.click()}
          >
            <span>{visibleAudio ? t("audio.replaceFile") : t("audio.select")}</span>
          </button>
        </div>
        <span className={styles.limits}>{t("audio.limits")}</span>
        <p className={isRecording ? styles.visuallyHidden : styles.status} aria-live="polite">
          {isRecording
            ? t("audio.recordingActive")
            : recordingState === "requesting"
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
      </div>
    </fieldset>
  );
}
