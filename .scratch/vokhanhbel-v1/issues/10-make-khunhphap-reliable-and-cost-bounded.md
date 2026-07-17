# 10 — Make Khunhphap reliable and cost-bounded

**What to build:** Khunhphap fails predictably, stops consuming resources within firm limits, and keeps streamed answers readable without surprising retries or scrolling.

**Blocked by:** 09 — Ask Khunhphap about a revealed Card.

**Status:** done

- [x] A complete provider attempt has a 60-second timeout, and closing the Khunhphap sheet aborts it earlier where possible.
- [x] A response truncated only by the 600-token limit remains visible with the settled truncation notice; other incomplete replies are discarded.
- [x] Khunhphap requests never retry automatically; ordinary failures show the settled retry action and safe German copy.
- [x] Khunhphap is disabled offline with its settled explanation, and reconnect does not automatically resend a prior question.
- [x] Database-backed limits allow 30 provider calls per authentication Session in rolling 15 minutes and 200 calls globally per Berlin day.
- [x] Authentication, validation, origin, and rate-limit rejections do not consume allowance; allowance is consumed immediately before provider invocation and remains consumed after disconnect, timeout, or provider failure.
- [x] Session and daily limits use distinct stable problem types and settled German messages; retry stays disabled until the applicable waiting period ends.
- [x] `Khunhphap denkt …` appears only after 300 ms with no response text, disappears on the first delta, and never becomes a typewriter effect.
- [x] Streaming remains pinned only while Khanh is near the bottom; scrolling up stops following and exposes the latest-message action.
- [x] The latest-message action is the app's only smooth scroll and becomes an immediate jump under reduced motion.
- [x] Timeout, error, limit, thinking, retry, and latest-message states are keyboard accessible, correctly announced, and remain usable across supported screen sizes.
- [x] Tests mock time, provider behavior, disconnects, and network state to prove timeouts, cancellation, truncation, counting boundaries, Berlin-day reset, no auto-retry, scroll-follow rules, and privacy-safe provider diagnostics.

## Comments

Implemented and reviewed in the V1 batch. Evidence includes provider terminal-state tests,
Khunhphap failure/retry/expiry journeys, database-backed rate-limit coverage, and all local quality gates
passing on 2026-07-14.
