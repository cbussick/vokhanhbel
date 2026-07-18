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

The production migration and restore tools run in a repository-owned Docker image containing Node
24, PostgreSQL 17 client tools, and the checksum-verified `age` 1.3.1 binaries. The host needs Docker
but does not need PostgreSQL or `age` installed.

Copy `.env.production-migration.example` to the ignored `.env.production-migration.local`, fill in
the production direct URL and an absolute backup directory outside this checkout, then restrict the
file to its owner:

```sh
cp .env.production-migration.example .env.production-migration.local
chmod 600 .env.production-migration.local
```

Generate the private backup identity once:

```sh
npm run backup:identity:generate
```

This creates `.secrets/age-identity.txt` with owner-only permissions. The directory is ignored by
Git and excluded from the Docker build context; the file is only bind-mounted into a running tool
container. Save a second copy in the password manager. Losing both copies makes every encrypted
backup unrecoverable. To print the corresponding public recipient, run
`npm run backup:identity:recipient`; store that public value in the GitHub repository variable
`BACKUP_AGE_RECIPIENT` for the weekly backup workflow.

Run `npm run db:migrate:production`. The wrapper builds the migration image, loads the dedicated
production migration file, validates the host backup path, and mounts the backup directory and
identity into the container. The container derives the public recipient from the private identity,
creates a PostgreSQL custom-format dump, validates it with `pg_restore --list`, encrypts it,
decrypts and validates it again, and only then applies committed Drizzle migrations. Any failed
backup step aborts before migration and removes partial output. Never put the production direct URL
in `.env.local`; ordinary local migration commands load that file and prefer
`DATABASE_URL_UNPOOLED` when it is present.

Logical backups and restores omit ownership and access-control metadata. Neon manages provider
roles such as `cloud_admin` separately on every branch, while the application schema and data remain
fully included in the backup.

The weekly workflow uses a dedicated read-only Neon credential and a public age recipient. It
creates and validates a PostgreSQL 17 custom dump, verifies the published checksum for the pinned
official age release, uploads only the encrypted file, and retains it for 28 days. The private age
identity must remain offline and outside GitHub.

## Restore rehearsal

Create a disposable empty PostgreSQL 17 database that is not production. The same Docker image
contains the restore dependencies. Run:

```sh
RESTORE_DATABASE_URL=postgresql://.../disposable \
npm run db:restore:verify -- /absolute/path/vokhanhbel.dump.age
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
