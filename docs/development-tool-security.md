# Development-tool security

## User-requested rollback

The Braces fork and custom Vite API adapter introduced in PR #66 were rejected
by the user and reverted. Local development again uses the official Vercel CLI
**56.2.0**, with the original `^56.2.0` constraint, through `vercel dev --local`.
Braces again resolves to upstream **3.0.3**, without a package alias or override.
The repository-owned API adapter, its dedicated transport tests, and the direct
`@hono/node-server` dependency are removed. Do not reintroduce a fork or replace
the development runtime without explicit approval.

The launcher, Vite configuration, and worktree-isolation integration configuration
are restored to their pre-replacement versions. Migration-before-serving,
loopback ports, isolated PostgreSQL/audio data, and cleanup remain in place.
See the [operations runbook](operations.md#local-development).

## Retained security updates

- Oxfmt remains **0.67.0**, with minimum `^0.67.0`, and patched Tinypool **2.1.2**.
- The scoped `@esbuild-kit/core-utils` override retains Esbuild **0.25.12** for
  Drizzle Kit's legacy loader. The real compiler regression still verifies
  TypeScript transformation and that an untrusted Origin receives no wildcard
  CORS permission. Remove this override only when stable Drizzle no longer
  resolves the vulnerable compiler without it.
- Previous Vite/Vitest/Seroval fixes and Node `>=24.22.1 <25` remain unchanged.
- Application dependency constraints and required production lock entries,
  application/API code, schema, migrations, and production hosting are unchanged.
  Restoring Vercel also restores its `ws` dependency, available as OpenAI's
  optional Realtime peer; the application still uses HTTP Responses, not Realtime.

## Known findings and checks

The rollback deliberately restores known development-tool findings rather than
substituting a different maintainer or maintaining a custom Vercel replacement.
On 2026-10-22, the full audit reports **45 vulnerable-package/metavulnerability
entries: 1 critical, 40 high, 2 moderate, 2 low**. The critical entry is `tar`.
These are not distinct CVEs, and audit presence alone does not establish deployed
application exploitability. The production audit reports **zero** findings.

The original production-only CI audit gate is restored. The full-audit gate
added by PR #66 is removed as part of this rollback; `npm audit --audit-level=low`
now fails and its findings must not be described as fixed. Continue to inspect
full audits when updating dependencies. Upstream Braces and Vercel toolchain
findings remain unresolved; embedded Vercel bundle dependencies also require
upstream fixes and cannot all be changed by npm overrides.

All original formatting, lint, types, Knip, unit, database, local-development,
browser, build, and license checks remain. Only assertions specific to the
removed fork's recursion guards and the removed custom server are withdrawn.
Ordinary Braces compatibility, compiler security, credential isolation, and the
original Vercel runtime environment regression remain covered.
