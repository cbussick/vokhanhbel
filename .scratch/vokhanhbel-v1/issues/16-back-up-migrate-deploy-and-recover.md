# 16 — Back up, migrate, deploy, and recover

**What to build:** The household operator can release V1 and future compatible migrations with validated encrypted backups, separated environments, a tested restore, and a clear application rollback path.

**Blocked by:** 14 — Harden and observe the production app; 15 — Automate release-quality verification.

**Status:** ready-for-agent

- [ ] Runtime uses Vercel Node Functions on the Hobby plan and a pooled Neon PostgreSQL 17 URL; migrations use the direct URL and never run automatically during deployment.
- [ ] Each warm function instance uses one pool with at most two connections, a 10-second connection timeout, and a 30-second idle timeout.
- [ ] Local development uses Docker PostgreSQL 17, preview uses a separate nonproduction Neon branch and secrets, and production uses isolated production data/secrets with no permanent staging environment.
- [ ] Drizzle migrations are generated, committed, reviewed, and applied through migration commands; shared or production schema push is unavailable as a release path.
- [ ] The local production migration command verifies its target, creates a PostgreSQL 17 custom-format dump outside the repository, validates it, encrypts it with the configured `age` recipient, and aborts before migration if any backup step fails.
- [ ] A weekly GitHub workflow uses a dedicated read-only credential to make and validate the same dump format, downloads a pinned official `age` release, verifies its published checksum, encrypts before upload, and retains roughly four artifacts.
- [ ] GitHub receives only the read-only backup credential and public encryption recipient; unencrypted dumps, database credentials, and the private decryption identity never enter logs or artifacts.
- [ ] GitHub-owned actions are pinned by commit SHA and `age` remains a reviewed BSD-3-Clause system/CI tool rather than an npm/runtime dependency.
- [ ] A documented restore into disposable PostgreSQL 17 is successfully exercised before launch and can be repeated whenever the backup format or workflow changes.
- [ ] Release order is feature branch, green pull-request checks, backward-compatible production migration and validated backup when needed, merge to main, then automatic production deployment.
- [ ] Migrations use expand/contract-compatible sequencing so both old and new deployed application versions can operate during release and rollback.
- [ ] A broken deployment can use hosting Instant Rollback followed by a reviewed fix/revert; database migrations are never reversed automatically and any reversal requires a fresh backup and separately reviewed migration.
- [ ] The documented process acknowledges that branch protection and hosting Deployment Checks are absent, records the accepted direct-push risk, and gives the operator an actionable recovery procedure.
- [ ] A release rehearsal verifies environment separation, backup failure aborts, migration success, production build/deploy, rollback, restore, and preservation of Khanh's Reviews and Points.
