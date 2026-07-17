import { z } from "zod";

export const problemTypes = {
  cardFrontConflict: "/problems/card-front-conflict",
  cardNotFound: "/problems/card-not-found",
  deviceClockAhead: "/problems/device-clock-ahead",
  invalidOrigin: "/problems/invalid-origin",
  invalidRequest: "/problems/invalid-request",
  khunhphapDailyLimit: "/problems/khunhphap-daily-limit",
  khunhphapFailed: "/problems/khunhphap-failed",
  khunhphapSessionLimit: "/problems/khunhphap-session-limit",
  loginRateLimit: "/problems/login-rate-limit",
  requestTooLarge: "/problems/request-too-large",
  reviewReplayConflict: "/problems/review-replay-conflict",
  reviewTooOld: "/problems/review-too-old",
  unauthenticated: "/problems/unauthenticated",
  unexpected: "/problems/unexpected",
  unreadableRequest: "/problems/unreadable-request",
  unsupportedContentType: "/problems/unsupported-content-type",
  wrongPassword: "/problems/wrong-password",
} as const;

export const problemSchema = z.object({
  type: z.string().startsWith("/problems/"),
  title: z.string().min(1),
  status: z.number().int().min(400).max(599),
  instance: z.string().startsWith("urn:uuid:"),
  detail: z.string().optional(),
  errors: z.array(z.object({ pointer: z.string(), code: z.string() })).optional(),
});
export type Problem = z.infer<typeof problemSchema>;
