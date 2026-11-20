# Cloudflare defaults migration — continuation checkpoint

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

| Rule | Findings |
| --- | ---: |
| curly | 429 |
| typescript/array-type | 144 |
| typescript/no-unsafe-type-assertion | 86 |
| unicorn/numeric-separators-style | 79 |
| typescript/no-non-null-assertion | 61 |
| import/consistent-type-specifier-style | 50 |
| vitest/require-mock-type-parameters | 20 |
| unicorn/consistent-function-scoping | 15 |
| vitest/require-to-throw-message | 11 |
| vitest/no-conditional-expect | 10 |
| no-console | 9 |
| unicorn/no-array-sort | 6 |
| unicorn/prefer-top-level-await | 6 |
| react/button-has-type | 5 |
| @nkzw/no-instanceof | 5 |
| quality/no-chained-type-assertions | 5 |
| unicorn/prefer-string-replace-all | 4 |
| quality/no-conditional-empty-object-spread | 4 |
| unicorn/no-useless-promise-resolve-reject | 3 |
| unicorn/catch-error-name | 3 |
| quality/no-known-value-widening | 2 |
| unicorn/prefer-string-raw | 2 |
| unicorn/prefer-add-event-listener | 2 |
| unicorn/prefer-at | 2 |
| quality/no-array-filter-map | 2 |
| no-promise-executor-return | 1 |
| quality/no-unsafe-dictionary-type | 1 |
| import/no-namespace | 1 |
| typescript/return-await | 1 |

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
