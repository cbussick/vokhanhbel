import { useEffect, useState, useSyncExternalStore } from "react";

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
