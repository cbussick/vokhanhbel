import { useEffect, useState, useSyncExternalStore } from "react";
import type { GroupedExerciseKind } from "../domain/exercisePlanner";

function subscribeToOnlineState(onChange: () => void): () => void {
  const update = () => onChange();
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  window.addEventListener("focus", update);
  document.addEventListener("visibilitychange", update);

  return () => {
    window.removeEventListener("online", update);
    window.removeEventListener("offline", update);
    window.removeEventListener("focus", update);
    document.removeEventListener("visibilitychange", update);
  };
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribeToOnlineState,
    () => navigator.onLine,
    () => true,
  );
}

export function useDueTime(dueTimes: string[]): number {
  const [now, setNow] = useState(Date.now);
  const nextBoundary = dueTimes
    .map((dueAt) => new Date(dueAt).getTime())
    .filter((dueAt) => dueAt > now)
    .sort((left, right) => left - right)[0];

  useEffect(() => {
    const update = () => setNow(Date.now());
    const delay =
      nextBoundary === undefined
        ? undefined
        : Math.min(2_147_483_647, Math.max(0, nextBoundary - Date.now() + 1));
    const timer = delay === undefined ? undefined : window.setTimeout(update, delay);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);

    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [nextBoundary]);

  return now;
}

const lastGroupedExerciseKindStorageKey = "review.lastGroupedExerciseKind";

/**
 * The grouped Exercise kind (matching or Swipe) the most recently *planned* Session used, read from
 * `localStorage` so it survives across Sessions the way the Review Session itself deliberately does
 * not (it's client-side and non-persisted — see CONTEXT.md). `planExercises` stays pure and takes
 * this as a plain argument rather than reaching for storage itself; this is the one place that reads
 * it, at the call site in `ReviewSessionContext`. Undefined the first time the Learner ever reviews,
 * or if storage is unavailable — the planner falls back to its original matching-first order either
 * way, so a private-browsing tab that blocks storage just never alternates.
 */
export function getLastGroupedExerciseKind(): GroupedExerciseKind | undefined {
  try {
    const value = window.localStorage.getItem(lastGroupedExerciseKindStorageKey);

    return value === "matching" || value === "swipe" ? value : undefined;
  } catch {
    return undefined;
  }
}

export function setLastGroupedExerciseKind(kind: GroupedExerciseKind): void {
  try {
    window.localStorage.setItem(lastGroupedExerciseKindStorageKey, kind);
  } catch {
    // Best-effort — the next Session just falls back to the matching-first order.
  }
}
