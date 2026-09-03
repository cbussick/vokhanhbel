/* eslint-disable jsx-a11y/media-has-caption -- these learner recordings have no transcript by design */
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiPaths } from "../../contracts/apiPaths";
import type { AudioMetadata } from "../../contracts/card";
import { beginPlayback, endPlayback } from "./playbackCoordinator";
import styles from "./AudioPlayer.module.css";

export function formatAudioDuration(durationMs: number): string {
  const seconds = Math.max(0, Math.ceil(durationMs / 1_000));

  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function AudioPlayer({
  audio,
  source,
  label,
  describedBy,
  compact = false,
  onAvailabilityChange,
}: {
  audio: AudioMetadata;
  source?: string | undefined;
  label: string;
  /**
   * What is written about this clip elsewhere on the page. The playback control carries it, so a
   * screen reader reads it where the Learner already is instead of only in browse mode.
   */
  describedBy?: string | undefined;
  compact?: boolean;
  onAvailabilityChange?: ((available: boolean) => void) | undefined;
}) {
  const { t } = useTranslation();
  const elementRef = useRef<HTMLAudioElement>(null);
  const participantRef = useRef({ stop: () => elementRef.current?.pause() });
  const [loadedSource, setLoadedSource] = useState<string>();
  const [state, setState] = useState<"idle" | "loading" | "playing" | "paused" | "ended" | "error">(
    "idle",
  );
  const [currentTime, setCurrentTime] = useState(0);
  const resolvedSource = source ?? apiPaths.audio(audio.id);
  const previousSourceRef = useRef(resolvedSource);

  useEffect(() => {
    if (previousSourceRef.current === resolvedSource) return;
    previousSourceRef.current = resolvedSource;
    const element = elementRef.current;

    endPlayback(participantRef.current);
    element?.pause();
    element?.removeAttribute("src");
    element?.load();
    setLoadedSource(undefined);
    setCurrentTime(0);
    setState("idle");
    onAvailabilityChange?.(true);
  }, [resolvedSource, onAvailabilityChange]);

  useEffect(() => {
    const element = elementRef.current;
    const participant = participantRef.current;

    return () => {
      endPlayback(participant);
      element?.pause();
      element?.removeAttribute("src");
      element?.load();
    };
  }, []);

  const play = async (reload = false) => {
    const element = elementRef.current;

    if (!element) return;
    beginPlayback(participantRef.current);
    if (!loadedSource || reload) {
      setLoadedSource(resolvedSource);
      element.src = resolvedSource;
      element.load();
    }
    if (state === "ended") element.currentTime = 0;
    setState("loading");

    try {
      await element.play();
    } catch {
      setState("error");
      onAvailabilityChange?.(false);
      endPlayback(participantRef.current);
    }
  };

  const pause = () => {
    elementRef.current?.pause();
    setState("paused");
    endPlayback(participantRef.current);
  };

  const retry = () => {
    setLoadedSource(undefined);
    setState("idle");
    onAvailabilityChange?.(true);
    void play(true);
  };

  return (
    <div className={`${styles.player} ${compact ? styles.compact : ""}`}>
      <audio
        ref={elementRef}
        preload="none"
        onPlaying={() => {
          setState("playing");
          onAvailabilityChange?.(true);
        }}
        onPause={() => setState((value) => (value === "ended" ? value : "paused"))}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime * 1_000)}
        onEnded={() => {
          setState("ended");
          endPlayback(participantRef.current);
        }}
        onError={() => {
          setState("error");
          onAvailabilityChange?.(false);
          endPlayback(participantRef.current);
        }}
      />
      {state === "loading" ? (
        <button
          type="button"
          aria-busy="true"
          aria-disabled="true"
          aria-label={`${label}: ${t("audio.loading")}`}
          aria-describedby={describedBy}
        >
          <span className={styles.spinner} aria-hidden="true" />
        </button>
      ) : state === "playing" ? (
        <button
          type="button"
          onClick={pause}
          aria-label={`${label}: ${t("audio.pause")}`}
          aria-describedby={describedBy}
        >
          <span aria-hidden="true">Ⅱ</span>
        </button>
      ) : state === "error" ? (
        <button
          type="button"
          onClick={retry}
          aria-label={`${label}: ${t("audio.retry")}`}
          aria-describedby={describedBy}
        >
          ↻
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void play()}
          aria-label={`${label}: ${state === "ended" ? t("audio.replay") : t("audio.play")}`}
          aria-describedby={describedBy}
        >
          <span aria-hidden="true">{state === "ended" ? "↻" : "▶"}</span>
        </button>
      )}
      <progress
        aria-label={`${label}: ${t("audio.progress")}`}
        value={Math.min(currentTime, audio.durationMs)}
        max={audio.durationMs}
      />
      <span className={styles.time}>{formatAudioDuration(audio.durationMs)}</span>
      <span
        className={state === "error" ? styles.status : styles.visuallyHidden}
        aria-live="polite"
      >
        {state === "loading" ? t("audio.loading") : state === "error" ? t("audio.unavailable") : ""}
      </span>
    </div>
  );
}
