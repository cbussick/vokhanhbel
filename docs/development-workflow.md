# Development workflow

## Branching

Work on a feature branch. Never commit directly to `main`. GitHub rejects
direct pushes to `main`.

Vercel deploys every commit on `main` to production, so a commit on `main` is a release.
See the [deployment strategy](deployment-strategy.md) for how a branch reaches production.

Name a branch `feature/<issue-key>-<slug>`, lowercased, as in
`feature/vok-6-shared-dialog-primitive`.

### One branch per issue, one branch per sub-issue

An issue without sub-issues branches from `main` and merges back into `main`.

A spec issue that has sub-issues gets its own branch off `main`. Every sub-issue branches off
that spec branch and its pull request targets the spec branch, not `main`. Once every
sub-issue has merged, one pull request takes the spec branch into `main`.

`main` therefore only ever receives a whole feature. A spec passes through intermediate states
its sub-issues create — new chrome beside old copy, a control that arrives before the layout
that frames it — and those states stay on the spec branch instead of reaching the Learner one
deploy at a time.

Rebase a sub-issue branch onto its spec branch as siblings merge. The Quality workflow runs on
every pull request whatever it targets, but only `main` requires `verify` and an up-to-date
branch, so the pull request into `main` is the one GitHub gates.

## End-to-end visuals

Chromium for Playwright is installed at `~/.cache/ms-playwright`. When Card, Collection, or Topic UI changes, run `npm run test:e2e` or the Chromium visual journeys and update those baselines if the change is intentional. A Cursor sandbox may set `PLAYWRIGHT_BROWSERS_PATH` to an empty cache; point it back at that directory. Do not skip the suite.
