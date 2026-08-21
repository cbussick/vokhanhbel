# 09 — Prepare isolated R2 environments for operation

**What to build:** Make private Cloudflare R2 storage deployable and operable without exposing permanent credentials or mixing preview and production recordings. Validate server-only configuration and document provisioning, cleanup, observability, recovery limits, and the unchanged Postgres backup workflow.

**Blocked by:** 02 — Stage and play private audio through authenticated endpoints.

**Status:** ready-for-agent

- [ ] Runtime configuration requires the private bucket, EU endpoint, and narrowly scoped server credentials needed by the production audio-object-store adapter and fails safely when they are absent or malformed.
- [ ] Preview and production configuration use distinct buckets and credentials, with no default that can silently point preview traffic at production audio.
- [ ] Permanent Cloudflare credentials and object keys remain server-only and are absent from browser bundles, Card contracts, logs, problem details, and test snapshots.
- [ ] Structured operational logs make upload, range-read, live-object deletion, failed cleanup, retry, and staged-object expiry diagnosable without logging audio contents or secrets.
- [ ] Operations documentation covers R2 subscription enablement, private Standard buckets in the EU jurisdiction, production/preview isolation, bucket-scoped permissions, environment setup, temporary-object expiry, live deletion expectations, and cleanup retry procedures.
- [ ] Documentation states that R2 recordings have no backup or restore path in this version and confirms that the existing encrypted Postgres backup and restore process remains unchanged.
- [ ] Default automated tests use replaceable storage adapters and require neither live R2 access nor Cloudflare credentials.

