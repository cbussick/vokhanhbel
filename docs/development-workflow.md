# Development workflow

## Branching

Work on a feature branch. Never commit directly to `main`. GitHub rejects
direct pushes to `main`.

Vercel deploys every commit on `main` to production, so a commit on `main` is a release.
See the [deployment strategy](deployment-strategy.md) for how a branch reaches production.
