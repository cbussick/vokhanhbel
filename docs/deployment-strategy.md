# Deployment strategy

V1 uses a lightweight, human-enforced deployment process:

1. Create a feature branch. Do not intentionally work directly on `main`.
2. Open a pull request and wait for the GitHub Actions CI workflow to pass.
3. Merge the pull request into `main` only when CI is green.
4. Vercel automatically builds and deploys the commit on `main` to production.

## Releasing a database migration

Because merging into `main` starts the production deployment, apply a database
migration in this order:

1. Open the pull request containing the application change and its committed
   Drizzle migration.
2. Wait for all CI checks to pass.
3. From the feature branch, run `npm run db:migrate:production` locally. The
   command verifies the production target, creates and validates an encrypted
   backup, and aborts without migrating if the backup fails.
4. Confirm that the migration succeeded.
5. Merge the pull request into `main`.
6. Confirm that the Vercel production deployment succeeds.

Every migration must remain compatible with the version of the application
that is already running. Additive changes may be released before the new code.
Renaming or removing a field is a separate, later release after no deployed
code depends on it. Application rollback does not automatically roll back the
database.

If a migration succeeds but the pull request cannot be merged, leave the
backward-compatible schema change in place until the release can continue or a
separately reviewed migration can safely reverse it.

## Rolling back a production deployment

If a production deployment is broken:

1. In Vercel, use Instant Rollback to restore the last known-good production
   deployment.
2. Create a feature branch that reverts or fixes the faulty commit. Do not fix
   production by leaving `main` in a broken state.
3. Open a pull request, wait for CI to pass, and merge the correction into
   `main`.
4. Confirm that Vercel deploys the corrected `main` successfully.

Do not automatically reverse the associated database migration. Production
migrations are designed to remain compatible with both the old and new
application versions, so rolling back the application should be sufficient.
Any database reversal requires its own reviewed migration and a fresh backup.

GitHub branch protection and Vercel Deployment Checks are intentionally not
required for V1. The repository is private and uses a free GitHub account, so
the workflow is a documented convention rather than a platform-enforced rule.

An accidental direct push or a merge with failing checks can therefore reach
production. The maintainer accepts this risk and will correct or roll back the
deployment manually if it occurs.
