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

## Verification and limitations

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
