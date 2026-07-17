const sessionExpiredEventName = "session-expired";

export function publishSessionExpired(): void {
  window.dispatchEvent(new Event(sessionExpiredEventName));
}

export function subscribeToSessionExpiry(listener: () => void): () => void {
  window.addEventListener(sessionExpiredEventName, listener);

  return () => window.removeEventListener(sessionExpiredEventName, listener);
}
