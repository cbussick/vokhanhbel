# ADR-001: Use Vercel Functions And Neon Postgres

## Status

Accepted

## Date

2026-07-11

## Context

V1 needs a cheap, low-ops deployment for a private app with:

- A React frontend.
- Server-side API routes for auth, cards, reviews, and AI calls.
- A relational database for cards, review history, points, and stats.
- Secure server-side environment variables for AI and database credentials.

The expected traffic is tiny. The app should be easy to deploy and cheap to run while staying portable enough to move later if Vercel or Neon becomes limiting.

## Decision

Use Vercel Node Functions for backend routes and Neon Postgres for persistence.

The frontend is deployed on Vercel, API routes live under `/api`, and database access uses Neon Postgres through Drizzle. Use Node Functions, not Edge Functions, for V1 backend behavior.

Use Neon's Free plan with its restore window set to the maximum currently available. Add two complementary logical-backup paths:

- A scheduled weekly GitHub Actions workflow uses a dedicated read-only Neon credential to create a PostgreSQL 17 custom-format dump, validates the archive, encrypts it with `age` before upload, and retains roughly four weekly encrypted artifacts. The workflow downloads a pinned official `age` release, verifies its published checksum, and pins GitHub-owned actions by commit SHA. The public encryption recipient is a repository variable; the decryption identity never enters GitHub.
- The operator runs `npm run db:migrate:production` locally for production schema changes. The command verifies its production target, creates and validates a timestamped custom-format dump outside the repository, encrypts it with the same `age` recipient, aborts if any backup step fails, and only then applies committed Drizzle migrations through the direct production connection. Ordinary Vercel deployments never migrate the database automatically.

Document and successfully exercise a restore into a disposable PostgreSQL 17 database before launch and whenever the backup format or workflow changes.

## Alternatives Considered

### Hetzner VPS + Postgres

- Pros: predictable paid infrastructure cost, full control, easy to run a conventional Node server.
- Cons: more server administration, backups, patching, monitoring, and deployment setup.
- Rejected for V1 because the product loop is not proven yet and free managed hosting is sufficient.

### Supabase

- Pros: hosted Postgres, auth, storage, dashboard, and useful all-in-one product surface.
- Cons: Free projects can pause after inactivity; built-in auth is less valuable because V1 uses shared-password auth.
- Rejected for V1 in favor of Neon because the app currently needs plain Postgres more than Supabase's broader platform.

### Firebase

- Pros: generous free tier, easy auth/mobile story, fast setup.
- Cons: Firestore is document-oriented while review history, scheduling, points, and stats are naturally relational.
- Rejected because Postgres is a better fit for the data model.

### Cloudflare Workers + D1

- Pros: very cheap, strong edge platform, generous free tier.
- Cons: D1 is SQLite, Workers are not a normal Node runtime, and the stack is less portable to a conventional Node/Postgres backend.
- Rejected because standard Node tooling and Postgres fit this project better.

### Express On Vercel

- Pros: familiar routing and middleware, easier migration to a traditional Node server later.
- Cons: unnecessary framework layer for a small API; Vercel deploys the Express app as one function bundle.
- Rejected for V1 in favor of small route-level Vercel Functions.

## Consequences

- Infrastructure can be free for V1, excluding AI provider usage and any custom domain.
- Neon Free cold starts are acceptable during V1 testing.
- Backend code should avoid Vercel-specific coupling outside route wrappers so it can move later.
- API routes must not rely on in-memory state.
- Database migrations and schema remain standard Postgres via Drizzle.
- GitHub receives only a read-only production backup credential; the production migration credential remains outside the workflow.
- The `age` decryption identity is kept only on the operator's machine and in the password manager; losing it makes all backups unusable.
- Unencrypted backup archives, decryption identities, and database credentials must never be committed, uploaded as artifacts, or written to logs.
- Weekly backups consume GitHub Actions minutes and artifact storage, expected to remain well within GitHub Free allowances at V1 scale.
