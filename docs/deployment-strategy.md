# Deployment strategy

This project deploys through pull requests that GitHub enforces on `main`:

1. Open a pull request from your feature branch and wait for the Quality workflow's `verify` job to pass.
2. Merge the pull request after GitHub allows it: `verify` is green and the branch is up to date with `main`.
3. Vercel automatically builds and deploys the commit on `main` to production.

The `main-no-direct-push` ruleset blocks direct pushes, force-pushes, and deletion of `main`. It requires a pull request, the `verify` status check, and that the branch is up to date with `main`.

Vercel Deployment Checks are not required. Merging still starts the production deployment immediately.

## Serverless function budget

The Vercel plan allows 12 serverless functions, and `api/` already contains exactly 12 files. There
is no headroom: a new file under `api/` fails the production deployment. Add a route by rewriting it
onto an existing function in `vercel.json`, as `/api/topics/:topicId` already does, or by replacing a
function file rather than adding one.

## Releasing a database migration

Because merging into `main` starts the production deployment, apply a database
migration in this order:

1. Open the pull request containing the application change and its committed
   Drizzle migration.
2. Wait for all CI checks to pass.
3. From the feature branch, follow the
   [production migration and encrypted backup runbook](operations.md#production-migration-and-encrypted-backup).
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
