# Development workflow

## Branching

Work on a feature branch. Never commit directly to `main`. GitHub rejects
direct pushes to `main`.

Vercel deploys every commit on `main` to production, so a commit on `main` is a release.
See the [deployment strategy](deployment-strategy.md) for how a branch reaches production.

## End-to-end visuals

Chromium for Playwright is installed at `~/.cache/ms-playwright`. When Card, Collection, or Topic UI changes, run `npm run test:e2e` or the Chromium visual journeys and update those baselines if the change is intentional. A Cursor sandbox may set `PLAYWRIGHT_BROWSERS_PATH` to an empty cache; point it back at that directory. Do not skip the suite.
