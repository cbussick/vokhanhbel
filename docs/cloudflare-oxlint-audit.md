# Cloudflare defaults migration — local validation report

## Status

**Default adoption implemented; independent review gate still pending.**
No temporary disables remain. This is not permission to integrate: the full
browser suite is not green, and final independent reviewers have not yet run.

Worktree `.worktrees/cloudflare-oxlint-defaults`, branch
`chore/cloudflare-oxlint-defaults`, exact base `192638b`. Local only: no push,
PR, review posting, merge, main edit, production operation or deployment.

## Versions and preserved coverage

Node **24.22.1**, npm **11.19.1**, Oxlint **1.94.0** unchanged.
`@cloudflare/oxlint-config` **0.1.0** exact inherits nkzw **3.0.0**.
`tsrs` changed from **7.1.0-beta.tsrs3** to exact
**0.25.0-ts7.1.0-beta**. Installed backend reports TypeScript 7.1.0-beta,
compiler commit **3e9236361fa9**. Registry peers require Oxlint ^1.94.0,
tsrs >=0.25.0-ts7.1.0-beta; engines ^22.18.0 || >=24.0.0.
Fresh npm ci, valid npm ls, actual lint and compiler probes establish runtime
compatibility rather than guessing from unusual semver names. Lockfile committed.
Evidence: `/tmp/vok-cf-final-{install,deps,registry}.log` (registry uses .json).

Root-spread preset preserves inherited plugins/options/environments/overrides,
then original project rules, category coverage, anti-slop/style plugins, ignores,
and existing test safety exceptions. Old interface-only style preference is
removed; compiler rules previously warning now follow preset errors. Stock
no-empty is stronger than the original permissive catch option.

Resolved original/current config comparison found two inherited root relaxations:
unused variables and mixed promise arrays. Original strict settings are restored.
Original no-explicit-any, unsafe-argument, only-throw-error and unbound-method
checks are explicitly restored after inherited test overrides; existing intentional
test unsafe-assignment/member-access and require-await exceptions remain unchanged.
No compiler/build/test script is removed. Knip no longer needs its tsrs dependency
ignore because the preset exposes that dependency.

Browser callbacks now have a **separate DOM-enabled tests/e2e/tsconfig.json**,
referenced by root tsc -b. The original Node project excludes only those E2E files
and stays Node-only; shared contracts/domain remain checked in both projects.
Playwright config remains Node-owned. Final probes confirm E2E discovery.

## Initial inventory and adoption

Authoritative first root-config inventory: **969 diagnostics in 185 files**,
not a count of bugs. All 29 newly failing rules have been adopted.

| Rule                                       | Findings |
| ------------------------------------------ | -------: |
| curly                                      |      429 |
| typescript/array-type                      |      144 |
| typescript/no-unsafe-type-assertion        |       86 |
| unicorn/numeric-separators-style           |       79 |
| typescript/no-non-null-assertion           |       61 |
| import/consistent-type-specifier-style     |       50 |
| vitest/require-mock-type-parameters        |       20 |
| unicorn/consistent-function-scoping        |       15 |
| vitest/require-to-throw-message            |       11 |
| vitest/no-conditional-expect               |       10 |
| no-console                                 |        9 |
| unicorn/no-array-sort                      |        6 |
| unicorn/prefer-top-level-await             |        6 |
| react/button-has-type                      |        5 |
| @nkzw/no-instanceof                        |        5 |
| quality/no-chained-type-assertions         |        5 |
| unicorn/prefer-string-replace-all          |        4 |
| quality/no-conditional-empty-object-spread |        4 |
| unicorn/no-useless-promise-resolve-reject  |        3 |
| unicorn/catch-error-name                   |        3 |
| quality/no-known-value-widening            |        2 |
| unicorn/prefer-string-raw                  |        2 |
| unicorn/prefer-add-event-listener          |        2 |
| unicorn/prefer-at                          |        2 |
| quality/no-array-filter-map                |        2 |
| no-promise-executor-return                 |        1 |
| quality/no-unsafe-dictionary-type          |        1 |
| import/no-namespace                        |        1 |
| typescript/return-await                    |        1 |

`04d954a` is the passing staged adoption with temporary disables. Focused commits
then enabled each rule. Large crosscutting assertion work was deliberately split
into checked domain, HTTP, API, UI, storage and test-boundary commits before removing
the final two assertion disables in `4d2fac7`. `0509533` preserves stronger coverage;
`287b30e` formats the mechanical migration. No broad convenience exclusions added.

## Behavioral and type-boundary work

- **Malformed audio:** bounded WebM TimecodeScale/duration and Ogg segment/page
  reads reject invalid audio rather than accepting NaN duration/truncated pages.
  Red 2 failures / 3 passes, then green; exact logs
  `/tmp/vok-cf-audio-bounds-{red,green,lint,types}.log`. Bounded DataView reads and
  checked MP3 bitrate replace non-null indexing; native header name/value entries
  retain signing order without nullable lookups.
- **Transactions:** createCard releases its committed connection before starting
  the separate read. Explicit writer dependencies make the real ordering testable
  without module mocking. Old ordering fails; new ordering passes; read rejection
  does not roll back committed work; failed write rolls back/releases without read.
  `/tmp/vok-cf-card-return-{di-red,green,lint,types}.log`.
- **Planner/domain:** literal Box schema and promotion tuple; single-Card Exercise
  tuples; checked shuffle indices and elements preserve valid RNG call order.
  Three invalid-RNG cases fail with old shuffle and pass with checked shuffle;
  planner/reducer 67 tests pass (`/tmp/vok-cf-planner-{red,green}.log`).
  Calendar parts and required configuration values narrow before use.
- **HTTP:** bodyless and schema-backed callbacks are separate; authenticated
  variants guarantee sessionHash via an actual runtime guard. Auth/origin checks
  still precede body parsing. Full isolated HTTP/database suites pass.
- **Client API:** data-returning operations require endpoint schemas; commands
  return void and preserve JSON syntax checking for intentionally ignored bodies,
  including Review Submission. Unexpected 204 JSON responses reject explicitly.
  Schema-bypass red probe rejects unchecked JSON; final 91 API/journey/dialog tests
  pass. An exploratory validation of ignored Review response bodies produced nine
  test failures against minimal mocks; the final void command contract preserves
  prior semantics without weakening those fixtures or expectations.
- **UI:** deletion guards require an owned entity, listbox carries labels rather
  than unchecked count/index callbacks, native target identity checked before
  contains; reducer binds its first remaining Card. Confetti keeps exactly 90
  pieces, original palette order and random-call order. Metadata subscriptions
  use native addEventListener with once semantics.
- **Tests/tools:** checked Exercise discriminants replace casts. Intercepted wire
  schemas preserve whitespace, unknown keys, and omission (including nested keys)
  rather than normalizing away evidence; two regressions lock this down. Mock
  arguments/results are typed. JSON tool inputs and HTTP responses are parsed.
  Transitive braces resolution remains actual Stylelint→micromatch resolution,
  with callable-surface and result validation.
- **Normalization test preconditions:** Card SQL fixtures omitted required
  collection_id, so old toThrow passed on an unrelated not-null error. Supplying
  the seeded Collection now exercises/asserts the intended constraints; all 26
  core database tests pass. A premature hypothesis based on migration 0003 was
  disproved by the migrated-DB probe: migration 0007 preserves normalization.
  Escalation was explicitly withdrawn; no schema change was needed.

No microtask workaround, unsupported assertion substitution, removed diagnostics,
weakened timeout/expectation, new test skip, or production migration was used.

## Every new necessary exception

All are one source line, with adjacent rationale; no entire file/rule is exempted.

- **9 no-console:** AppErrorBoundary.componentDidCatch (browser error and component
  stack, explicitly authorized); HTTP request logger (structured severity and
  correlation); audio storage logger (structured operation diagnostics); six
  local-development CLI output/error boundaries (application/database/volume,
  inspect/start identity, stderr inspection). Logs were not redirected through
  raw streams merely to evade the rule.
- **3 @nkzw/no-instanceof:** SwipeExercise Element identity before closest;
  useListbox Node identity before contains; audioObjectStore Uint8Array identity
  selects a byte copy for WebCrypto while preserving raw ArrayBuffer behavior.
- **1 react/button-has-type:** IconButton native ButtonHTMLAttributes union
  constrains the variable to button/submit/reset and defaults to button; syntax
  rule cannot prove the variable. No duplicated form-behavior branches.
- **2 unicorn/prefer-top-level-await:** Collection/Topic Zod icon .catch calls
  supply synchronous schema fallbacks, not Promise rejection handlers.

Original exceptions remain original policy; `oxlint --report-unused-disable-directives`
passes without diagnostics. No assertion-rule exceptions were needed.

## Validation and baseline evidence

Fresh **npm ci** passes. After that installation:

| Check                                       | Result                                         |
| ------------------------------------------- | ---------------------------------------------- |
| format:check, lint, typecheck, build        | pass                                           |
| Knip normal/production                      | pass (obsolete tsrs hint subsequently removed) |
| npm audit --omit=dev --audit-level=high     | 0 vulnerabilities                              |
| licenses                                    | pass, 15 approved forms                        |
| unit suite, maxWorkers=1                    | **272 passed / 33 files**                      |
| isolated database suite, maxWorkers=1       | **30 passed / 2 files**                        |
| local-development integration, maxWorkers=1 | **1 passed / 1 file**                          |
| complete browser suite, one worker          | **69 passed, 20 failed, 46 existing skipped**  |

Logs: `/tmp/vok-cf-final-*.log`. Temporary JSX/client/server/test/E2E probes
detected floating promises (including JSX body), await-thenable, test unbound methods,
test non-Error throws and TS2322 in client/server/E2E. Probes were removed; lint and
typecheck pass afterward. `/tmp/vok-cf-final-probe-{lint,types}.log`,
`/tmp/vok-cf-probes-removed-{lint,types}.log`.

The browser result is **not green**. A clean archive of exact original **192638b**
at `/tmp/vok-cf-original-checkout`, with its own fresh npm ci and production build,
reproduces the **same 20 Chromium screenshot failures**, 69 passes and 46 skips.
All three browser projects were exercised; Firefox/WebKit exclusions are existing.
19/20 failing actual screenshots are byte-identical between setups; one differs
between captures. Failures are small screenshot differences (often 1 pixel), not
claimed fixed. No screenshot baseline or tolerance was updated.
Logs `/tmp/vok-cf-original-fresh-{install,browser}.log`,
`/tmp/vok-cf-final-browser2.log`; artifacts `/tmp/vok-cf-{original-browser-results,browser-results}`.
An earlier isolated browser launcher timed out because its temporary config did
not set root cwd; fixing the launcher allowed the real suite. That is not called
a baseline product failure.

Database checks use a disposable PostgreSQL17 container `vok-cf-defaults-tests`,
loopback 32776, DB `cf_defaults_test`, not shared host port5433. Browser setups
use isolated loopback 42781/42782 and separate artifact directories. Builds,
browsers, tests and timings were serialized. No production data accessed.

## Warmed lint timing

Two discarded warmups per setup, then seven interleaved `npm run lint` samples,
alternating order, same Node/host/default threads. Both installations are fresh;
this includes npm startup, Oxlint and Stylelint, not just the executable.

| Setup            | Seconds                                         | Median     |
| ---------------- | ----------------------------------------------- | ---------- |
| Original 192638b | 5.152, 4.681, 6.491, 4.899, 5.096, 4.347, 4.951 | **4.951s** |
| Passing defaults | 5.731, 5.700, 5.389, 5.587, 5.374, 4.983, 5.918 | **5.587s** |

Every sample exits0. Median adds **0.636s (~12.8%)** for complete configurations,
source coverage and toolchains, not isolated backend performance. No speedup claim.
Shared-host load remains uncontrolled; this is not a formal benchmark.
`/tmp/vok-cf-final-timings.json`. Original coordinator single cold9.937s is not
comparable to this warmed series.

## Independent reviews / recommendation

Two fresh LOCAL read-only Pi reviewers must inspect the full exact
`192638b...<review-tip>` diff independently (standards/spec and behavior/coverage).
**Pending.** Do not treat this report as completion before that gate, affected
re-reviews, final cleanup and final validation refresh.

Defaults are implemented, but do not integrate yet: review remains and full
browsers have reproduced original failures. All work stays local pending explicit
integration authorization.

## Changed files

Before this final audit/Knip refresh: **142 files, +3413/-1507**. Final exact Git
diff is authoritative. Most breadth is mechanical braces/arrays/imports/formatting.

```text
api/audio/[audioId].ts
api/audio/index.ts
api/cards/[cardId].ts
api/cards/index.ts
api/collections/[collectionId].ts
api/collections/index.ts
api/internal/audio-cleanup.ts
api/reviews.ts
api/session.ts
api/topics/index.ts
api/tutor-replies.ts
docs/cloudflare-oxlint-audit.md
oxlint.config.ts
package-lock.json
package.json
scripts/checkLicenses.ts
scripts/dependencySecurity.test.ts
scripts/hashPassword.ts
scripts/localDevelopment.integration.test.ts
scripts/localDevelopment.ts
scripts/migratePreview.ts
scripts/migrateProduction.ts
scripts/process.ts
scripts/runMigrationContainer.ts
scripts/setupEnvironment.test.ts
scripts/setupEnvironment.ts
scripts/verifyRestore.ts
src/components/AppErrorBoundary.tsx
src/components/AppShell.tsx
src/components/CardFormDialog.tsx
src/components/CollectionFormDialog.tsx
src/components/CollectionSelect.test.tsx
src/components/CollectionSelect.tsx
src/components/ConnectivityBanner.tsx
src/components/Dialog.tsx
src/components/IconButton.tsx
src/components/LanguageSelect.tsx
src/components/RequireSession.tsx
src/components/TopicFormDialog.tsx
src/components/TopicSelect.test.tsx
src/components/TopicSelect.tsx
src/components/TutorDialog.tsx
src/components/audio/AudioInput.test.tsx
src/components/audio/AudioInput.tsx
src/components/audio/AudioPlayer.test.tsx
src/components/audio/AudioPlayer.tsx
src/components/audio/PronunciationGenerator.tsx
src/components/audio/audioApi.ts
src/components/audio/playbackCoordinator.ts
src/components/review/MatchingExercise.tsx
src/components/review/MultipleChoiceOptions.tsx
src/components/review/SessionSummary.tsx
src/components/review/SwipeExercise.tsx
src/components/review/optionAppearance.tsx
src/contracts/card.ts
src/contracts/collection.ts
src/contracts/contracts.test.ts
src/contracts/pronunciation.ts
src/contracts/topic.ts
src/contracts/tutor.ts
src/domain/cardText.ts
src/domain/exercisePlanner.test.ts
src/domain/exercisePlanner.ts
src/domain/review.ts
src/domain/streak.test.ts
src/domain/streak.ts
src/domain/time.ts
src/lib/apiClient.test.ts
src/lib/apiClient.ts
src/lib/browserState.ts
src/lib/queries.ts
src/main.tsx
src/routes/appJourneys.test.tsx
src/routes/cards.$collectionId.$cardId.tsx
src/routes/cards.$collectionId.tsx
src/routes/cards.index.tsx
src/routes/dialogPendingActions.test.tsx
src/routes/index.tsx
src/routes/login.tsx
src/routes/me.tsx
src/routes/review.session.tsx
src/routes/review.tsx
src/server/ai/aiProvider.test.ts
src/server/ai/aiProvider.ts
src/server/audio/audioFixture.test-helper.ts
src/server/audio/audioObjectStore.test.ts
src/server/audio/audioObjectStore.ts
src/server/audio/inspectAudio.test.ts
src/server/audio/inspectAudio.ts
src/server/auth/password.ts
src/server/auth/session.ts
src/server/config/environment.ts
src/server/database/client.ts
src/server/database/errors.ts
src/server/http/cookies.ts
src/server/http/handler.test.ts
src/server/http/handler.ts
src/server/http/origin.ts
src/server/http/problem.ts
src/server/resources/audio.ts
src/server/resources/cardMapper.ts
src/server/resources/cards.test.ts
src/server/resources/cards.ts
src/server/resources/collectionMapper.ts
src/server/resources/collections.ts
src/server/resources/pronunciations.ts
src/server/resources/reviews.ts
src/server/resources/sessions.ts
src/server/resources/stats.ts
src/server/resources/topicMapper.ts
src/server/resources/topics.ts
src/server/resources/tutor.test.ts
src/server/resources/tutor.ts
src/server/speech/speechProvider.test-helper.ts
src/server/speech/speechProvider.test.ts
src/server/speech/speechProvider.ts
src/shared/ui/ListboxOption.tsx
src/shared/ui/ListboxRoot.test.tsx
src/shared/ui/ListboxRoot.tsx
src/shared/ui/useListbox.ts
src/state/AuthContext.tsx
src/state/ReviewSessionContext.tsx
src/state/ReviewSubmissionContext.tsx
src/state/SessionLifecycleProvider.tsx
src/state/review/reviewSessionReducer.test.ts
src/state/review/reviewSessionReducer.ts
src/state/review/useReviewSubmissionQueue.ts
src/test/renderApp.tsx
src/test/server.ts
src/test/setup.ts
src/test/wireSchemas.test.ts
src/test/wireSchemas.ts
tests/database/core.test.ts
tests/database/globalSetup.ts
tests/database/httpStack.test.ts
tests/e2e/criticalJourneys.spec.ts
tests/e2e/tsconfig.json
tools/oxlint/anti-slop/rules/no-known-value-widening.ts
tools/oxlint/anti-slop/rules/no-unsafe-dictionary-type.ts
tsconfig.json
tsconfig.node.json
vite.config.ts
```

## Sources

- Official current [Cloudflare README](https://github.com/cloudflare/oxlint-config).
- Full [migration skill](https://github.com/cloudflare/oxlint-config/blob/main/skills/migrate-oxlint-config/SKILL.md).
- Installed preset/nkzw sources, npm registry peers/engines and runtime version.
- Repository workflow/domain/operations/GLOSSARY/ADRs; Shelf audit read-only context.
