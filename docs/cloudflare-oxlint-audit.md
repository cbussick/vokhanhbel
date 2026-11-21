# Cloudflare defaults migration — continuation checkpoint (second worker)

**INCOMPLETE. Not integration-ready.** This is a handoff, not a completion report.
Temporary rule disables remain in the clearly marked final override. No claim of
full default compliance, test correctness, or performance improvement is made.

## Scope and evidence

Worktree: `.worktrees/cloudflare-oxlint-defaults`; branch
`chore/cloudflare-oxlint-defaults`; exact base `192638b`.
All changes are local. No push, PR, review posting, main edits, merge, production
operation, or deployment was performed.

Read repository workflow/domain/operations instructions, GLOSSARY, applicable
hosting/auth/offline/speech ADRs, official current Cloudflare README and full
migration skill via webfetch, and Shelf audit for read-only context. Read review,
Pi-review, and spawning skills. Other ADRs still need reading if later changes
reach their domains.

Registry and runtime inspection:

- Node 24.22.1 (baseline supplied by coordinator).
- Oxlint 1.94.0, unchanged.
- `@cloudflare/oxlint-config` 0.1.0 exact; inherited nkzw config 3.0.0.
- `tsrs` changed from 7.1.0-beta.tsrs3 to exact 0.25.0-ts7.1.0-beta.
- Preset peers: Oxlint ^1.94.0, tsrs >=0.25.0-ts7.1.0-beta.
- Preset engines: ^22.18.0 || >=24.0.0.
- `npm ls @cloudflare/oxlint-config oxlint tsrs @nkzw/oxlint-config` passes.
- Installed backend reports Version 7.1.0-beta, tsrs 0.25.0-ts7.1.0-beta,
  microsoft/TypeScript@3e9236361fa9. Runtime lint succeeds; compatibility is not
  inferred solely from unusual semver names.
- Dependency install and lock changes were supplied by coordinator; no force or
  legacy-peer install was used by this worker.

Config uses root-spread preset, inherited plugins/JS plugins/options/environment
and overrides, then original project rules and ignores. Original anti-slop plugin,
style plugin, tsc/build/scripts, category checks and safety exceptions remain.
Old interface-only style policy was removed rather than overriding stock choices.
React compiler warnings overlapping preset are upgraded to preset errors.
`no-empty` now follows stock (no permissive catch option).

**Still audit config merging carefully:** original project overrides and preset
aliases need final comparison, including test-specific correctness rules and
whether inherited relaxations reduce pre-existing coverage. No final coverage
probe or independent review has yet been done.

## Inventory and staged commits

Initial actual root-config inventory: **969 diagnostics, 185 files**. This is
not a count of distinct bugs. Counts before fixes:

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

`04d954a` is the passing staged adoption commit (temporary disables).
Subsequent focused lint-passing commits implement curly, generic arrays, numeric
separators, top-level type imports, catch names, replaceAll, at, String.raw, and
unnecessary Promise.resolve/reject removal. Stock safe autofixes were used;
multiple passes were necessary for some nested fixes. Type-only import changes
also include two ignored custom-plugin implementation imports, mechanically
converted to the same style. No assertion or runtime guard redesign yet.

Evidence retained outside Git:

- `/tmp/vok-cf-baseline-install.log`, `/tmp/vok-cf-baseline-lint.log`
  (coordinator-provided original installation/lint).
- `/tmp/vok-cf-stock.json`: full root-config diagnostic inventory.
- `/tmp/vok-cf-inventory.json`: earlier exploratory overlay inventory; do not use
  its counts as authoritative (overlapping alias/config differences).
- `/tmp/vok-cf-adoption-lint.log` and per-rule `/tmp/vok-cf-*.log` files.
- Ignored `.scratch/cloudflare-inventory.config.ts` exploratory config, not used
  by npm lint. Remove before final validation but preserve evidence separately.

## Confirmed policy response

Coordinator supplied user authorization in `/tmp/vok-cf-policy-response.md`:
accept an explained single-line `no-console` exception at native browser
`AppErrorBoundary.componentDidCatch`, retaining error and component stack.
Do not hide console behind a wrapper or delete observability. Assess structured
server and CLI boundaries individually: narrow justified native-observability
exceptions are preferable to rewriting through raw process streams merely to
evade lint, especially if semantics/format change. No such exceptions have been
implemented yet; no-console currently remains temporarily disabled.

## Continuation notes

Next pending rule `typescript/return-await` exposes
`src/server/resources/cards.ts` createCard returning getCard after COMMIT inside
try/finally. Do not blindly insert await: it changes rejection handling and holds
the transaction connection while getCard acquires another pool connection.
Investigate moving the post-commit read after finally (released connection) with
behavior-sensitive red/green regression coverage. A trial edit was reverted;
worktree source is clean at this checkpoint.

Large remaining work: unsafe assertions and non-null guards, test mock contracts,
conditional expectations, native event lifecycle, typed error identity guards,
callback return contracts, hoisting, and all other temporary disables. No
microtask tricks, weakened tests, unsupported assertion substitutions, or broad
exceptions are authorized.

## Second-worker continuation (through `a1c04ba`)

Twelve additional focused rule commits passed root lint. **Eight temporary disables
remain**, not twenty: chained assertions, non-null assertions, unsafe assertions,
return-await, function scoping, native event listeners, typed mocks, and throw
messages. This remains incomplete and must not be integrated.

Implemented commits:

- `3c3efad`: void Promise executor in the intentionally pending playback test.
- `9da43a9`: explicit playback button types. `IconButton` retains one explained
  `react/button-has-type` line exception: React's native button attribute union
  admits only button/submit/reset and the component defaults to button. The
  syntax-only rule rejects that typed variable; duplicating branches solely for
  lint would obscure native form behavior.
- `7f1377a`: non-mutating sorting of derived arrays; deliberately mutating private
  Streak grouping is accepted by the stock rule and unchanged.
- `80c8f03`: named database schema imports and an explicit schema object containing
  exactly the same exported entries (including defaultCollectionId).
- `87369b5`: CLI entrypoints await main inside try/catch. Two exact
  `unicorn/prefer-top-level-await` exceptions on Zod icon `.catch` calls document
  the proven synchronous-schema false positive; those are not Promise chains.
- `e8cbc30`: no-console enabled. Nine line exceptions preserve native output:
  AppErrorBoundary componentDidCatch (authorized browser error and stack), audio
  operation logger and HTTP request logger (platform info severity, JSON, request
  correlation), and six CLI messages (allocated application/database/volume,
  selected Compose identity, startup identity, and stderr error inspection).
  No logs were removed or redirected through raw streams to evade the rule.
- `83b8f6b`: pure review projections use flatMap, preserving filtering, ordering,
  date conversion, invalid-date exclusion, and missing matching entries.
- `6921feb`: optional request body, stored Content-Range, log requestId, and parsed
  range end are assigned explicitly under the original conditions. Named native
  or owner contracts retain absent fields rather than present-undefined values.
- `06bea1b`: Card boundary preprocessing uses guarded `in` properties; no unknown
  dictionary or narrowing assertion remains there. Legacy strings, absent Topic
  IDs, spread preservation, and structured validation remain.
- `9503ad4`: inferred connection result and schema-parsed intercepted Card input
  replace anonymous known-evidence widening in tests.
- `08b9e13`: reducer assertions fail explicitly on wrong state instead of skipping
  checks; Tutor message-limit checks run unconditionally after exchanges four
  and five with the same eight real exchanges.
- `a1c04ba`: the actual application Error class is named AppProblemError throughout
  all consumers, preserving constructor identity and Error behavior. Two native
  `@nkzw/no-instanceof` line exceptions retain Element identity before closest and
  Uint8Array identity when copying signing keys for WebCrypto.

Validation evidence: `/tmp/vok-cf-{executor,player,buttons,sort,namespace,top-await,
console,filter-map,spread,dictionary,widening,conditional-expect,instanceof}.log`.
Every above commit passed npm lint. Typecheck passed after namespace, top-await,
filter-map, spread, dictionary, widening and instanceof changes. Focused suites
passed: AudioPlayer; exercisePlanner and Tutor; setupEnvironment/migratePreview;
appJourneys (repeated after later changes); reviewSessionReducer; all contracts;
all server audio and HTTP suites. A mistyped filter-map test path first reported
no test files; the actual planner/appJourneys suites then passed. This is not a
claimed baseline test failure. No builds, browser or shared database writers ran.
A scoping autofix trial changed no source and its config edit was reverted.

A fresh read-only Pi investigation examined unsafe/non-null assertions. Its full
plan is retained at `/tmp/vok-cf-assertion-plan.md`. In particular, inspectAudio
appears to lack WebM TimecodeScale payload and Ogg segment/page bounds checks;
verify with red/green malformed-audio regressions rather than calling those
findings false positives. Shared API/HTTP generic boundaries, browser typing,
planner tuple invariants and test-owned fake contracts need real redesign.

No final review or full validation gate has been run; all gates below still apply.
Second worker relinquishes write ownership only after committing this checkpoint.

## Third-worker progress (through `bd4bbc1`)

**Still incomplete. Three temporary rules remain:** unsafe assertions, non-null
assertions, and chained assertions. No final reviewer or integration claim.

- `e2baf33`: malformed WebM scale/duration and Ogg page bounds now produce
  invalid-audio errors instead of accepting NaN duration or truncated pages.
  Red: `/tmp/vok-cf-audio-bounds-red.log` (2 failed / 3 passed); green:
  `/tmp/vok-cf-audio-bounds-green.log`. Lint and typecheck passed.
- `e20a81b`: metadata/error subscriptions use native addEventListener, with once
  semantics; AudioInput suite, lint and typecheck passed.
- `663e710`: Card writer takes explicit connection/read dependencies; transaction
  releases before starting the independent post-commit read. Regression runs
  prove old ordering fails, new ordering passes, read rejection does not roll
  back a committed write, and failed writes roll back/release without reading.
  Tests use a faithful query contract, not module mocking. Evidence:
  `/tmp/vok-cf-card-return-{di-red,green,lint,types}.log`.
- `7602bdb`: mock argument/result contracts declared across UI/provider/HTTP/DB
  tests; model prompt helper now checks the required first input rather than
  asserting it. Seven focused suites, lint and typecheck passed.
- `3fc20f5`: pure helpers hoisted, including browser-evaluation wrapper (its
  serialized function remains inside evaluate); native dialog polyfills carry
  explicit this contracts. Six focused suites, lint and typecheck passed.
- `fcd741d`: bounded DataView reads replace byte assertions, bitrate checked;
  private-store rejection expectations identify actual validation errors.
- `497cc13`, `c3aabc4`: Box derives from a literal schema; promotion uses a fixed
  tuple. Configuration values narrow individually before use. Focused domain,
  speech and storage suites, lint and typecheck passed.
- `51ef195`: throw-message default enabled. Card normalization SQL fixtures now
  include the required Collection, so constraints rather than unrelated not-null
  errors are exercised. Exact constraint expectations pass all 26 core DB tests.
  An initial hypothesis based only on migration 0003 suggested trigger repair;
  the actual migrated-DB probe disproved it: migration 0007 preserves the check.
  The coordinator escalation was explicitly withdrawn. No schema change needed.
  Evidence `/tmp/vok-cf-{normalization-probe,throw-db,throw-db-green,throw-lint,throw-types}.log`.
- `160372a`: data-returning requests take endpoint schemas; commands return void
  and retain JSON-syntax checking when a response body is intentionally ignored.
  Missing JSON bodies reject explicitly. A preliminary attempt validated ignored
  Review responses and exposed intentionally minimal test fixtures; it was
  replaced with a void command contract preserving existing semantics, not test
  weakening. Final 91 API/journey/dialog tests pass. Schema-bypass red evidence
  exists in `/tmp/vok-cf-api-schema-red.log`; final evidence is
  `/tmp/vok-cf-api-schema-{tests,lint,types}.log`. The preliminary command-status
  expectation in that red run is not the final command policy.
- `e2858f0`, `bd4bbc1`: searchable label arrays replace unchecked index callbacks;
  native Node identity is checked before contains (one explained line exception).
  Deletion mutations guard missing entities; reducer binds its first remaining
  Card; MIME splitting has an explicit empty-string fallback. Six focused suites,
  lint and typecheck passed (`/tmp/vok-cf-ui-invariants-*.log`).

Intermediate full unit suite: **264 passed in 31 files**
(`/tmp/vok-cf-third-unit.log`), before the API schema tests were added. This does
not replace final full validation. Expected jsdom unimplemented media warnings
remain visible; no tests/timeouts were weakened.

Isolated DB evidence uses container `vok-cf-defaults-tests`, PostgreSQL 17 Alpine,
loopback port 32776, database `cf_defaults_test`; it never uses the shared 5433
service. Ignored `.scratch/cf-database.config.ts` disables the ordinary shared
DB lifecycle and overrides DATABASE_URL to this disposable container. Preserve
logs; remove the temporary config before final validation. No build/browser
artifact writers were run concurrently by this worker.

## Validation status / remaining release gate

Original lint passed with fresh baseline installation (coordinator evidence).
Every committed adoption/per-rule stage passed `npm run lint`. No test failures
have been observed or claimed pre-existing because tests have not yet run here.

**NOT YET RUN:** fresh final npm ci, final formatting, typecheck, build, Knip both
modes, unit/database/local-development/browser suites, full CI equivalents,
licenses/security checks, temporary JSX/server/test type-aware regression probes,
and fair interleaved warmed timings. Serialize artifact writers and use limited
workers and isolated ports/databases; the shared test database port is not an
isolated worktree database. Reproduce any baseline failures in a fresh original
checkout before claiming they predate migration.

No independent reviewers have yet run. Final gate requires at least two fresh
LOCAL read-only Pi reviewers covering the complete exact `192638b...<final-tip>`
diff, documented standards/spec and behavior/coverage; fix and re-review material
findings. Preserve evidence until integration authorization.

Only timing currently available is coordinator's original single cold lint run:
real 9.937 s, user 10.587 s, sys 2.026 s. This is not a benchmark and cannot support
speedup or overhead claims.

Recommendation: **continue implementation; do not integrate this checkpoint.**
