# Operations runbook

## Local development

For a fresh checkout:

```sh
npm install
npm run setup
npm run password:hash
```

`npm run setup` copies `.env.example` to the ignored `.env.local` file and never overwrites an
existing file. Enter the shared password twice when prompted by `npm run password:hash`; input is
hidden and never written to shell history. Copy the resulting `APP_PASSWORD_HASH=...` assignment
into `.env.local`. Never store the plaintext password.

Complete `.env.local` with these four values:

```dotenv
APP_PASSWORD_HASH=<output from npm run password:hash>
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/vokhanhbel
OPENAI_API_KEY=<OPENAI API KEY>
RATE_LIMIT_HMAC_SECRET=<output from openssl rand -hex 32>
```

Start PostgreSQL and apply the schema:

```sh
docker compose up -d postgres
npm run db:migrate
```

Start the complete local application (frontend + backend)

```sh
npm run dev:full
```

Open `http://localhost:3000`. `npm run dev:full` starts the complete application through Vercel's
local mode without linking a Vercel project; `npm run dev` starts only Vite. The database scripts
load `.env.local` automatically.

For preview or production, store the hash value as `APP_PASSWORD_HASH` in Vercel. Never put the
plaintext password in an environment file or pass it as a command-line argument.

Local development needs only `DATABASE_URL`; local migrations use it directly. Production migration,
backup, and restore operations instead require `DATABASE_URL_UNPOOLED` so they bypass the runtime
connection pool. `OPENAI_MODEL` is an optional deployment override: omit it to use the application
default.

## Production migration and encrypted backup

Install PostgreSQL 17 client tools and the reviewed `age` 1.3.1 binary. Set the production direct
URL, its expected hostname, the public age recipient, and a backup directory outside this checkout.
Then run `npm run db:migrate:production`. The command refuses a host mismatch or in-repository
backup path, creates a custom-format dump, validates it with `pg_restore --list`, encrypts it, and
only then applies committed Drizzle migrations. Any failed backup step aborts before migration and
removes partial output.

The weekly workflow uses a dedicated read-only Neon credential and a public age recipient. It
creates and validates a PostgreSQL 17 custom dump, verifies the published checksum for the pinned
official age release, uploads only the encrypted file, and retains it for 28 days. The private age
identity must remain offline and outside GitHub.

## Restore rehearsal

Create a disposable empty PostgreSQL 17 database that is not production. With the private identity
available locally, run:

```sh
AGE_IDENTITY_FILE=/secure/location/identity.txt \
RESTORE_DATABASE_URL=postgresql://.../disposable \
npm run db:restore:verify -- /outside/repository/vokhanhbel.dump.age
```

After restoration, sign in with test configuration and confirm Cards, retained Reviews, total
Points, weekly statistics, and soft-deleted Card history. Destroy the disposable database when the
rehearsal is recorded. Repeat this before launch and whenever the backup format or workflow changes.

## Release and recovery rehearsal

Before launch, record evidence that local, preview, and production use separate database branches
and secrets; a forced backup failure prevents migration; the real backup validates and restores;
and the migration and production build succeed. Follow the [deployment strategy](deployment-strategy.md)
to rehearse the release and application rollback in the correct order. That document is the
canonical source for schema-compatibility rules and accepted deployment risks.
