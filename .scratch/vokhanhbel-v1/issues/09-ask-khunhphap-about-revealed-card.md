# 09 — Ask Khunhphap about a revealed Card

**What to build:** After revealing an answer, Khanh can open Khunhphap and receive a focused, streamed German explanation grounded only in the current Card and temporary conversation.

**Blocked by:** 04 — Complete a first Review Session.

**Status:** done

- [x] Khunhphap is unavailable before reveal, appears after reveal, and has no effect on Grade controls or scheduling.
- [x] Opening the Khunhphap sheet starts a new memory-only conversation scoped to the current Card; closing, reloading, or Logout erases it.
- [x] Khanh sees the OpenAI disclosure and can choose German quick prompts for a simple explanation, example sentence, or memory trick.
- [x] A free-form current question accepts 1–500 characters, and each request sends at most eight prior role/content messages from that Card's current conversation.
- [x] The server loads the active Card and sends only its front/back, the current question, permitted conversation messages, and server-owned teaching instructions.
- [x] Passwords, Sessions, other Cards, Reviews, Points, and device details never enter the provider request or Khunhphap logs.
- [x] The provider adapter uses the official OpenAI Responses API, the configured model with the settled default and low reasoning, `store: false`, plain text, no tools, and a 600-token output cap.
- [x] Khunhphap teaches in German around CEFR B1–B2, infers the studied language from Card content, gives examples in that language, and asks one short clarification only when necessary.
- [x] The backend streams `delta`, `done`, and `error` events over POST fetch; the client incrementally renders paragraphs as plain text without HTML, Markdown, links, or rich-output dependencies.
- [x] Card and message content are treated as untrusted and cannot grant web, tool, code, file, database, or Card-mutation capabilities.
- [x] The Khunhphap sheet and conversation are responsive native-dialog experiences with correct focus, keyboard access, semantic messages/status, disclosure accessibility, and a no-motion baseline.
- [x] Automated tests mock the provider at its interface, never contact OpenAI, and cover context minimization, instruction separation, model configuration, streaming, plain-text rendering, memory clearing, and reveal gating.

## Comments

Implemented and reviewed in the V1 batch. Evidence includes mocked provider-boundary tests,
rendered Khunhphap journeys, plain-text streaming behavior, and all local quality gates passing on
2026-07-14. Automated tests do not contact OpenAI.
