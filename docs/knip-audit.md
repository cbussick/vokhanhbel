# Knip audit

Knip **6.42.1** is pinned as a local devDependency. Run `npm run knip` and
`npm run knip:production`; both pass and are included in the Quality workflow.

The later [development-tool security follow-up](development-tool-security.md)
records retained version fixes and the user-requested rollback of the Braces fork
and custom local server. The dated results below remain historical; the current
full audit has 45 findings and the original production-only CI audit gate is restored.

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
- The sole dependency exception is `vercel`: `scripts/localDevelopment.ts`
  invokes its CLI through an absolute path, which Knip does not infer.
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

At the Seroval integration, the full audit remained failing: **64 findings
(1 low, 13 moderate, 47 high, 3 critical)**. Comparing JSON audit reports against
`f710cd5` shows the sole removed entry is Seroval (65 findings before); every
remaining entry was unchanged. These included Vercel tooling, Vitest, Vite,
Stylelint, and Oxfmt dependencies. They were not suppressed or treated as passing;
remediation required a separate scoped dependency review (recorded below). The
committed Quality workflow's production-only audit policy is unchanged.

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

## Range-compatible development security follow-up

This separate maintenance follow-up starts from merged main `e81b378`. The earlier
results above remain historical. Only `package.json`, `package-lock.json`, and this
record change; application code, tests, assertions, skips, and the dedicated Docker
integration CI step are unchanged.

The manifest minima move from Vite `^8.1.4` to `^8.1.6` and from Vitest/coverage-v8
`^4.1.10` to `^4.1.12`. The lock selects **Vite 8.1.6** and the **Vitest 4.1.12**
family together, including `@vitest/mocker`. Ordinary npm installation and targeted
`npm update --package-lock-only` resolve the following additional fixes within
existing parent ranges:

| Dependency               | Selected version | Existing parent range                                               |
| ------------------------ | ---------------- | ------------------------------------------------------------------- |
| browserslist             | 4.29.4           | Babel helper: `^4.24.0`                                             |
| baseline-browser-mapping | 2.11.30          | Original Browserslist: `^2.10.42`                                   |
| colord                   | 2.10.0           | Stylelint: `^2.9.3`                                                 |
| fast-uri                 | 3.1.9            | Table's Ajv: `^3.0.1`                                               |
| ip-address               | 10.7.4           | Socks: `^10.1.1`                                                    |
| js-yaml                  | 4.3.2            | Cosmiconfig: `^4.1.0`                                               |
| nanoid                   | 3.3.20           | Original PostCSS: `^3.3.12`                                         |
| postcss                  | 8.5.31           | Original Vite: `^8.5.16`; Stylelint: `^8.5.15`                      |
| postcss-selector-parser  | 7.1.7            | Stylelint: `^7.1.4`                                                 |
| source-map-js            | 1.2.2            | PostCSS, CSS Tree, Magicast: `^1.2.1`                               |
| brace-expansion          | 1.1.21 / 5.0.12  | Minimatch copies: `^1.1.7` / `^5.0.5`                               |
| undici                   | 6.29.1 / 7.30.1  | Vercel Blob: `^6.23.0`; jsdom: `^7.25.0`; Vercel Sandbox: `^7.27.1` |

Npm also refreshes compatible Vitest/Browserslist dependencies, including Chai,
Picomatch, and browser-support data. All changed package entries are development-only;
all production package entries and versions are unchanged. **Seroval 1.7.0** and
**Node `>=24.22.1 <25`** remain unchanged. No override, fake integrity edit, forced
audit fix, dependency removal, or audit suppression is used.

### Audit delta and remaining blockers

| Audit                    | Total | Critical | High | Moderate | Low |
| ------------------------ | ----: | -------: | ---: | -------: | --: |
| Full, before             |    64 |        3 |   47 |       13 |   1 |
| Full, after              |    50 |        3 |   40 |        6 |   1 |
| Production, before/after |     0 |        0 |    0 |        0 |   0 |

These are npm vulnerable-package/metavulnerability counts, **not distinct CVEs**.
Fourteen package entries leave the report: Vite, Vitest, coverage-v8, mocker,
Browserslist, baseline-browser-mapping, colord, fast-uri, ip-address, nanoid,
PostCSS, postcss-selector-parser, source-map-js, and brace-expansion. No new entry
appears. The ranged js-yaml copy and two ranged Undici copies are also fixed, but
those report entries remain because Vercel's pinned copies are still vulnerable.

This is partial remediation. The full audit still fails with **50 findings**:

- **Oxfmt 0.64.0** pins `tinypool@2.1.0`. Its fix needs an Oxfmt release outside
  `^0.64.0`; that potentially breaking pre-1.0 change is not part of this work.
- **Braces 3.0.3** still has no published fixed release. Its Micromatch/Fast-glob
  chain keeps Stylelint and its configuration packages in the audit.
- **Drizzle Kit 0.31.10** retains the legacy `@esbuild-kit/esm-loader` → core-utils
  → `esbuild@~0.18.20` chain. The inspected stable 0.31.11 retains that loader;
  a patch bump alone does not remediate it.
- **Vercel 56.2.0** retains exact pins or incompatible ranges for vulnerable
  Undici 5.x, js-yaml, Ajv, Minimatch, path-to-regexp, tar, smol-toml, Once,
  Busboy, basic-ftp, and an affected Esbuild branch. The inspected in-range
  56.5.0 still has blocked chains. A separate ordinary targeted tar resolution
  probe made no lockfile change. No Vercel or major-tool upgrade is included.

The three critical npm entries (Oxfmt, Tinypool, tar) remain. Audit presence alone
does not establish application exploitability. The existing production-only CI
audit gate and dedicated local-development integration step are unchanged; no
finding is hidden by a policy change.

### Development follow-up verification

All checks use Node 24.22.1. Installs, builds, and browser runs are serialized with
`flock /tmp/fernblick-knip-heavy.lock`; existing test budgets are unchanged.

- `npm ci --no-audit --no-fund`, `npm ls --all`, and explicit version checks: pass.
  Lockfile comparison confirms unchanged production entries and compatible Node
  engines/ranges for the development updates.
- `npm run format:check`, `npm run lint`, `npm run typecheck`, both Knip modes,
  `npm run build`, and `npm run licenses`: pass.
- `npm test -- --maxWorkers=2`: **257 tests in 29 files pass**. Existing jsdom
  media-method warnings remain non-fatal. The Docker integration test stays in
  its dedicated suite rather than the unit suite.
- `npm test -- --coverage --maxWorkers=2`: the same **257 tests pass** with V8
  coverage enabled, exercising the upgraded coverage provider without changing
  coverage configuration or thresholds.
- `npm run test:local-development`: **1 integration test passes**, including
  isolated concurrent worktree databases and cleanup.
- `npm run test:db -- --maxWorkers=2`: **30 tests in 2 files pass** against a
  task-owned disposable PostgreSQL 17 container on the verified-free test port.
  That container and its volumes are removed afterward. No live database is used.
- `npm run test:e2e -- --config .scratch/knip-verification/playwright.config.ts --workers=2`:
  **89 passed, 46 existing skips, no failures**, across Chromium, Firefox, and
  WebKit. The ignored config has the explicit worktree cwd, isolated localhost
  port 44183, no server reuse, and all three original browser projects.
- The first browser run had 45 Chromium passes and 90 launch failures because
  the shared cache lacked the required Firefox/WebKit revisions. Installing
  matching revisions in a task-local cache resolved that environment failure;
  the complete unchanged suite then passed. Shared browsers were not removed.
- `npm audit --omit=dev --audit-level=high`: pass, zero findings. Full `npm audit`
  deliberately remains failing with the 50 residual findings documented above.

Audit JSON, dependency/range comparisons, test logs, the isolated browser config,
and both initial/final browser artifacts are preserved under
`/tmp/knip-dev-fixes.9OBwoW`. No production migration, deployment, paid evaluation,
or publication is part of this work.
