# Knip audit

Knip **6.42.1** is pinned as a local devDependency. Run `npm run knip` and
`npm run knip:production`; both pass and are included in the Quality workflow.

## Scope and configuration

- `knip.jsonc` declares `api/**/*.ts` as runtime entries: Vercel calls HTTP method
  exports by filename, including dynamic parameter routes and the audio cleanup
  cron route. Vite/TanStack plugins discover browser and generated route roots.
- The password hashing, preview/production migration, migration-container, and
  restore CLIs are genuine operational production entries, not test roots.
  Other npm scripts and the Oxlint plugin are normal-mode tooling roots.
- Production project scope is `src` and `api`. Test setup and `*.test-helper.ts`
  fixtures are explicitly excluded from production, not runtime modules.
  Tests, scripts, tools, and root configuration remain in the normal audit.
- Drizzle's Knip plugin is disabled because importing `drizzle.config.ts` requires
  migration credentials. The config is instead a statically read normal entry;
  its schema is also reachable through runtime database imports. Neither audit
  needs credentials or runs migrations.
- The only dependency exception is `vercel`: `scripts/localDevelopment.ts`
  explicitly spawns `node_modules/vercel/dist/index.js` using an absolute path.
- `ignoreExportsUsedInFile` retains schemas and helpers with same-file callers.
  There are no nested packages/workspaces or externally published library APIs.

## Findings, cleanup, and retained test APIs

The initial audit failed loading Drizzle configuration. Its partial output also
missed Vercel roots (72 unused files in production) and the dynamically invoked
Vercel CLI dependency. Correct roots and configuration resolve these false positives.

Removed three unused type aliases (`CreateCardFaceInput`, `UpdateCardFaceInput`,
`CardRow`), retaining all runtime schemas. Removed the uncalled vendored
`isPopulatedObjectExpression` helper; no retained rule or same-file caller uses
it. The vendored README records this local change. No tests were removed.

Production initially flagged `encodePassword`; it is required by the operational
password CLI, now included as a production entry. Four intentional test APIs are
marked individually with explanatory `@internal` comments, which Knip excludes
only in production:

- `FailingAudioObjectStore`: inject storage failures for compensation tests.
- `setAudioObjectStoreForTests`: replace live storage with isolated test storage.
- `resetServerEnvironmentForTests`: reset cached test configuration.
- `setSpeechProviderForTests`: substitute the paid speech provider in tests.

Normal mode still checks their test consumers. No broad export/file exceptions
or issue-count/exit-code suppression is used.

## Seroval security follow-up

The production audit initially failed with Seroval 1.5.5, reached through
`@tanstack/react-router@1.170.18 -> @tanstack/router-core@1.171.15 -> seroval`.
The development Router plugin/generator shares the same core. Router Core requests
`seroval@^1.5.4`; `seroval-plugins@1.5.5` accepts the peer range `seroval@^1.0`.
There is only one installed Seroval version.

- [GHSA-p6vx-979v-rg4c](https://github.com/advisories/GHSA-p6vx-979v-rg4c):
  critical unintended plugin-callable invocation through Promise thenable
  assimilation in `fromJSON()`. GitHub's reviewed advisory identifies 1.6.2 as
  the first patched version; the upstream fix guards deserialized thenables.
- [GHSA-jp82-f5mq-hwhp](https://github.com/advisories/GHSA-jp82-f5mq-hwhp):
  high-severity memory/CPU exhaustion from unchecked TypedArray input/length in
  JSON deserialization. Versions through 1.6.2 are affected; 1.6.3 is patched.

The original follow-up selected **1.6.3**, the smallest published release patched
for both advisories and compatible with the existing dependency/peer ranges.
Only Seroval's version, registry tarball URL, and registry-provided integrity
changed in that patch. Before integration, newer main independently selected
**1.7.0**. The combined branch preserves that exact newer entry, including its
Node requirement, rather than downgrading it. Main's Node 24.22.1 floor is retained.
No direct dependency, override, audit suppression, or unrelated security upgrade
is needed. Application code does not directly call Seroval's deserializers; the
existing production audit gate is the regression check for this dependency
finding, while Router compatibility is covered by the build and browser journeys.

The broader audit includes development tools and remains failing: **64 findings
(1 low, 13 moderate, 47 high, 3 critical)**. Comparing JSON audit reports against
`f710cd5` shows the sole removed entry is Seroval (65 findings before); every
remaining entry is unchanged. These include Vercel tooling, Vitest, Vite,
Stylelint, and Oxfmt dependencies. They are not suppressed or treated as passing;
remediation requires a separate scoped dependency review. The committed Quality
workflow's production-only audit policy is unchanged.

## Original integration verification (superseded by follow-up below)

- `npm run knip`, `npm run knip:production`: pass, no findings.
- Temporary `src/domain/knipProbe.ts` imported only by a colocated test: normal
  passed (0), production failed (1) on the unused source file. Removed both
  probes and reran both clean audits.
- `npm run format:check`: passed after formatting only the new Knip config and
  audit document. `npm run lint`, `npm run typecheck`, `npm run build`, and
  `npm run licenses`: pass.
- `npm test -- --maxWorkers=2 --exclude scripts/localDevelopment.integration.test.ts`:
  29 files, 257 tests passed. Concurrency was capped for memory. The excluded
  integration test starts Docker databases; it was not run. Existing jsdom
  media-method warnings do not fail the tests.
- `npm run test:db` was not run: its setup drops/recreates a database and applies
  migrations, outside this task's no-migrations constraint. No live database or
  environment files were accessed.
- `npm run test:e2e -- --project=chromium --workers=2`: blocked before tests,
  because `http://127.0.0.1:4173` was already in use. The config deliberately
  refuses server reuse; the existing process was not stopped. Firefox/WebKit
  journeys were not run under the resource limits.
- `npm audit --omit=dev --audit-level=high`: fails on the existing Seroval critical
  advisory group (GHSA-p6vx-979v-rg4c, GHSA-jp82-f5mq-hwhp). Seroval 1.5.5 is
  unchanged from main. No unrelated security upgrade was made.

Installs and heavy checks used `/tmp/fernblick-knip-heavy.lock`. No live servers,
paid evaluations, deployments, or migrations were run. Task-created dependencies
and generated build outputs were removed after verification; existing main and
other worktree files were preserved.

## Security follow-up verification

- `npm ci --no-audit --no-fund` and `npm ls seroval seroval-plugins`: pass;
  installed Seroval is 1.6.3 with compatible dependency and peer ranges.
- `npm audit --omit=dev --audit-level=high`: pass, zero production findings.
  Full `npm audit` still reports the 64 unchanged development-tool findings above.
- Formatting, lint, typecheck, both Knip modes, production build and license
  checks: pass.
- `npm test -- --maxWorkers=2`: 258 tests pass across 30 files.
- `npm run test:local-development`: its integration test passes.
- `npm run test:db`: 30 tests pass against a dedicated temporary PostgreSQL
  container. That container and its volumes were removed afterward.
- Browser checks use an ignored local config with an explicit repository working
  directory and isolated preview port 44173, preserving the existing server on
  port 4173. An initial temporary-config attempt served the wrong directory and
  timed out; fixing that config resolved the environment failure.
- `npm run test:e2e -- --config .scratch/knip-verification/playwright.config.ts --workers=2 --max-failures=3`:
  89 passed, 46 skipped by existing browser-specific test annotations, no failures.
  No application tests, assertions, skips or timeouts were changed.

These results record the original security follow-up. Verification of the
combined branch and integration status are tracked in
[PR #64](https://github.com/cbussick/vokhanhbel/pull/64). Publishing uses ordinary
Git over SSH. Verification did not run a production migration or manual deployment.
