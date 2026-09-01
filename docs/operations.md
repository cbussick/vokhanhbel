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

Audio development also needs a private Cloudflare R2 Standard bucket in the EU jurisdiction. Add
the R2 values documented below.

Start PostgreSQL and apply the schema:

```sh
docker compose up -d postgres
npm run db:migrate
```

`DATABASE_URL` above is the development database. The database test suite never touches it:
`npm run test:db` creates a separate `vokhanhbel_test` database in the same container, migrates it,
and drops it again when the run ends. It needs no setup of its own — if nothing answers on the
database port it starts the Compose service first, and it leaves an already running server alone.

Inspect the local database with Drizzle Studio. It starts Docker Postgres if needed, waits until
it is healthy, then loads `DATABASE_URL` from `.env.local` the same way local generate and migrate
do. It does not target production:

```sh
npm run db:studio
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

## Preview migration

Preview uses a separate Neon database branch. Copy the preview migration template to its ignored
local file, then restrict it to its owner:

```sh
cp .env.preview-migration.example .env.preview-migration.local
chmod 600 .env.preview-migration.local
```

Add the direct, unpooled connection string for the separate preview branch to
`.env.preview-migration.local`, then run:

```sh
npm run db:migrate:preview
```

The command accepts only a direct PostgreSQL connection string and displays the host, database, and
user without the password or connection options. If `.env.production-migration.local` exists, it
refuses a preview target that points to the same host, port, and database as production. It then
applies the committed Drizzle migrations. Preview data is disposable, so this command does not
create the encrypted backup required by the production migration flow. Do not use
`npm run db:migrate` for preview; that command loads `.env.local` and targets local development.

## Private R2 audio storage

Enable R2 in Cloudflare. Create two private Standard buckets in the EU jurisdiction: one for
preview and one for production. Do not enable public access or a custom public domain. Create a
separate API token for each environment. Restrict each token to object read, write, and delete
operations on only its bucket. Store credentials only in the matching Vercel server environment.
Never expose them through `VITE_*` variables.

```dotenv
R2_ENVIRONMENT=preview # or production
R2_ACCOUNT_ID=<Cloudflare account ID>
R2_BUCKET=<bucket for this environment>
R2_ACCESS_KEY_ID=<bucket-scoped access key>
R2_SECRET_ACCESS_KEY=<bucket-scoped secret>
CRON_SECRET=<output from openssl rand -hex 32>
```

The adapter always uses the account's `.eu.r2.cloudflarestorage.com` S3 endpoint. Upload, range
read, deletion, expiry, and retry logs contain the opaque application audio ID and outcome. They do
not contain bytes, credentials, or R2 object keys. Search for `"area":"audio-storage"` in runtime
logs.

Staged uploads become eligible for deletion after one hour. Vercel calls the authenticated cleanup
route once per day with `CRON_SECRET`; uploads also trigger opportunistic expiry. Upload and
Card-save failures compensate immediately.
Replacing or removing a recording and soft-deleting a Card clear the database reference before
deleting the live object. A deletion failure creates an `audio_cleanup_jobs` row. Run the cleanup
maintenance task that calls `retryAudioCleanup` until the row has `completed_at`. Each retry first
checks that no active Card refers to the audio ID, so it is safe to repeat.

Cloudflare lifecycle rules can remove abandoned temporary objects as a second hygiene layer. They
are not a backup. R2 recordings have no backup, snapshot, replication, or restore path in this
version. Deleted or lost recordings are not recoverable. The encrypted Postgres workflow below is
unchanged. It backs up Card structure and audio metadata, not R2 bytes.

Before release, use preview to upload, range-play, replace, remove, and delete a non-personal test
recording. Confirm that direct public access and unauthenticated application playback fail. Confirm
that preview credentials cannot list, read, write, or delete production objects. Record the EU
endpoint, isolation result, lifecycle result, and accepted no-backup limitation without recording
credentials, object keys, or audio content.

## Google Cloud Text-to-Speech

Pronunciation audio is synthesized server-side behind the `SpeechProvider` interface. A human
prepares the credential; no automated step creates it.

1. Create a Google Cloud project and attach a billing account to it.
2. Enable the Cloud Text-to-Speech API in that project.
3. Create a service account and grant it only the Cloud Text-to-Speech role
   (`roles/cloudtts.user`). Grant no other role.
4. Create a JSON key for that service account and download it once.
5. Copy three values out of the key file into the matching Vercel server environment. Never put
   them into a `VITE_*` variable.

```dotenv
GOOGLE_TTS_PROJECT_ID=<project_id from the key file>
GOOGLE_TTS_CLIENT_EMAIL=<client_email from the key file>
GOOGLE_TTS_PRIVATE_KEY=<private_key from the key file>
```

`GOOGLE_TTS_PRIVATE_KEY` may keep the `\n` escapes the key file uses; the adapter restores the PEM
line breaks. The key is long-lived, so rotate it by hand: create a second key, replace the
environment values, confirm generation still works, then delete the old key.

One voice is pinned per supported locale in `src/server/tts/speechProvider.ts`. Changing a voice is
a code change, not a configuration change. No suite needs the credential: every test substitutes
the provider, so all checks pass with no Google configuration present.

The Card-face migration keeps the legacy `front` and `back` columns synchronized during the release
window. This lets the migration run before the application deploy and keeps an application rollback
readable. Remove those compatibility columns only in a later, separately reviewed migration after
no deployed version depends on them.

## Troubleshooting application errors

When the UI shows a `Fehler-ID`, that value is the backend request ID for the failed request. It
matches the `X-Request-ID` response header, the UUID portion of the problem response's `instance`,
and the structured log field `requestId`. Search the runtime logs for the complete UUID to find the
corresponding route, status, duration, and safe error category.

An HTTP status such as `500` describes a broad class of failures and is not the `Fehler-ID`. If the
UI shows no `Fehler-ID`, the browser did not receive a usable correlation ID from the backend. Check
backend availability and the browser's network request instead of searching for a client-generated
identifier.

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
