# ADR-003: Use Hosted AI API Behind Provider Interface

## Status

Accepted

## Date

2026-07-11

## Context

V1 includes a focused Khunhphap conversation for each Card. The expected usage is small, quality matters for language learning, and API credentials must remain server-side. The app should not be coupled so tightly to one provider that future model changes require frontend or data-model rewrites.

## Decision

Start with OpenAI's Responses API through the official TypeScript SDK, called only from backend code. Wrap provider calls behind a small server-side `aiProvider` module. Use `gpt-5.6-luna` with low reasoning effort as the default, configurable through `OPENAI_MODEL`, and request `store: false`.

The frontend calls the app backend. The backend loads Card context, constructs the Khunhphap prompt, calls the provider, and streams the Khunhphap response back to the client. Automated tests mock the AI provider and never call the real API.

Minimize the data sent for each request to the current Card's front and back, the current 1–500-character question, and at most eight previous role/content messages from that Card's in-memory Khunhphap conversation. Never send the password, Session identifier, other Cards, Review history, Points, or device information. Do not opt API data into model training. Khunhphap conversations are never written to the app database or logs and disappear when the Khunhphap sheet closes, the page reloads, or the Learner logs out.

The Khunhphap interface discloses `Nachrichten werden zur Beantwortung an OpenAI gesendet.` OpenAI API storage remains disabled, while acknowledging that the standard API policy may retain prompts and responses in abuse-monitoring logs for up to 30 days.

Render streamed Khunhphap output as plain text, preserving paragraphs and line breaks but never interpreting HTML or Markdown and never automatically turning URLs into links. Prompt the model to write readable plain text without relying on rich formatting. V1 therefore needs no Markdown renderer or model-output sanitizer.

Give the model no tools or action capabilities: no web search, code execution, file access, database access, or Card mutation. Treat Card fields and conversation messages as untrusted content, clearly separate them from server-owned instructions, and constrain the provider adapter to text input and streamed text output.

Cap each provider response at 600 output tokens and instruct the model to stay concise. If the provider reaches the limit, preserve the received text and show `Antwort wurde gekürzt.` rather than treating the partial response as a failure; the Learner can ask a follow-up.

Apply a 60-second overall timeout to each Khunhphap request. When it expires, abort
the provider request, discard the incomplete assistant reply in the client,
and show the ordinary retryable Khunhphap error. Closing the Khunhphap sheet aborts the
request earlier where possible.

Consume the per-Session and daily Khunhphap rate-limit allowance immediately before
starting the OpenAI request. Requests rejected during authentication,
validation, origin checking, or rate-limit checking do not consume allowance.
Once the provider call starts, the attempt remains counted even if the client
disconnects, the timeout expires, or the provider fails, because cost may
already have been incurred.

## Alternatives Considered

### Browser Calls Provider Directly

- Pros: fewer backend lines.
- Cons: exposes provider credentials and bypasses server-side context, rate control, and tests.
- Rejected because AI keys must never reach the client.

### Ollama Or Other Self-Hosted Model

- Pros: local control and privacy.
- Cons: server/GPU operations, potentially weaker language-teaching quality, and more deployment complexity.
- Rejected for V1 because hosted APIs are simpler and likely better for the product loop.

### Hard-Code One Provider Everywhere

- Pros: simplest first implementation.
- Cons: makes provider changes invasive and encourages leaking provider-specific details into app code.
- Rejected because a small backend adapter is cheap and preserves optionality.

### AWS Bedrock

- Pros: managed access to multiple model providers.
- Cons: AWS complexity is unnecessary for a tiny private app.
- Rejected for V1.

## Consequences

- Provider API keys live only in server-side environment variables.
- The AI endpoint must validate inputs and include card context server-side.
- AI chat history is memory-only and scoped to the current Card in V1 unless the spec changes.
- Card and message content must not appear in application logs or tracing payloads.
- Model output streams through the backend; the frontend never calls OpenAI directly.
- A slow provider response cannot hold the Khunhphap stream open indefinitely.
- Tests must mock provider responses.
- Changing providers should mostly touch the `aiProvider` implementation and configuration.
