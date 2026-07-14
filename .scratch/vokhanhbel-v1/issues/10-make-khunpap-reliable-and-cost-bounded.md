# 10 — Make Khunpap reliable and cost-bounded

**What to build:** Khunpap fails predictably, stops consuming resources within firm limits, and keeps streamed answers readable without surprising retries or scrolling.

**Blocked by:** 09 — Ask Khunpap about a revealed Card.

**Status:** ready-for-agent

- [ ] A complete provider attempt has a 60-second timeout, and closing the tutor aborts it earlier where possible.
- [ ] A response truncated only by the 600-token limit remains visible with the settled truncation notice; other incomplete replies are discarded.
- [ ] Tutor requests never retry automatically; ordinary failures show the settled retry action and safe German copy.
- [ ] Khunpap is disabled offline with its settled explanation, and reconnect does not automatically resend a prior question.
- [ ] Database-backed limits allow 30 provider calls per authentication Session in rolling 15 minutes and 200 calls globally per Berlin day.
- [ ] Authentication, validation, origin, and rate-limit rejections do not consume allowance; allowance is consumed immediately before provider invocation and remains consumed after disconnect, timeout, or provider failure.
- [ ] Session and daily limits use distinct stable problem types and settled German messages; retry stays disabled until the applicable waiting period ends.
- [ ] `Khunpap denkt …` appears only after 300 ms with no response text, disappears on the first delta, and never becomes a typewriter effect.
- [ ] Streaming remains pinned only while Khanh is near the bottom; scrolling up stops following and exposes the latest-message action.
- [ ] The latest-message action is the app's only smooth scroll and becomes an immediate jump under reduced motion.
- [ ] Timeout, error, limit, thinking, retry, and latest-message states are keyboard accessible, correctly announced, and remain usable across supported screen sizes.
- [ ] Tests mock time, provider behavior, disconnects, and network state to prove timeouts, cancellation, truncation, counting boundaries, Berlin-day reset, no auto-retry, scroll-follow rules, and privacy-safe provider diagnostics.

