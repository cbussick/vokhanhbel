# Development-tool security

This follow-up addresses the 50 development-tool findings left by the earlier
[Knip and dependency audit](knip-audit.md). Counts are npm vulnerable-package and
metavulnerability entries, not distinct CVEs or proof of deployed-app exposure.

## Dependency changes

| Tool or dependency          | Change                                        | Reason                                                                                                                                        |
| --------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Oxfmt                       | 0.64.0 → 0.67.0; minimum `^0.67.0`            | This release pins patched Tinypool 2.1.2.                                                                                                     |
| Drizzle Kit's legacy loader | Override only core-utils' Esbuild to 0.25.12  | Removes the vulnerable 0.18.x compiler without adopting prerelease Drizzle or changing schema/migration formats.                              |
| Braces                      | Exact alias to `@franciscosolis/braces@3.1.1` | Upstream 3.0.3 has no fixed release for the deep-nesting crash. The fork guards both parsing and AST walkers.                                 |
| Vercel CLI                  | Remove the development dependency             | Its published bundles contain vulnerable copies that npm overrides cannot update, including in the inspected 65.1.0 release.                  |
| Node HTTP adapter           | Development-only `@hono/node-server@2.1.5`    | Bridges the existing Fetch handlers to Vite without implementing a custom HTTP/stream/cookie adapter. Its Hono peer is also development-only. |

These are code/dependency replacements, not advisory exclusions. There is no
`npm audit fix --force`, renamed copy of unchanged vulnerable code, falsified
version, or altered package integrity. The two explicit overrides have narrow
purposes; review them when their owning tools change rather than keeping them
indefinitely.

Application dependency constraints and retained production package versions are
unchanged, including Drizzle ORM and Seroval 1.7.0. Removing the CLI also removes
`ws`, formerly supplied by its Sandbox dependency and available as OpenAI's
optional Realtime peer. The application uses OpenAI's HTTP Responses API, not
Realtime/WebSockets; no application dependency or API was removed. Node remains
`>=24.22.1 <25`.

## Why replace the local CLI?

Vercel 56.2.0 imports some vulnerable dependencies normally, but also embeds older
implementations inside its distributed JavaScript. Examples include
path-to-regexp 6.1.0 in its routing wrapper and smol-toml 1.5.2 in build-utils.
The inspected Vercel 65.1.0 still includes vulnerable bundles and even embeds
Undici 5.29.0 in its proxy implementation. A zero npm audit after overrides would
not establish that those embedded copies had changed.

Only the **local** development runtime changes. Vite serves the frontend and the
existing `api/` Fetch handlers. Production still uses Vercel Functions and Neon;
no production API, deployment configuration, schema, or migration is changed.
The launcher retains isolated loopback ports, migration-before-start ordering,
worktree-local PostgreSQL and audio, and explicit cleanup. See the
[operations runbook](operations.md#local-development).

## Braces provenance and regression coverage

The fork introduces a new upstream maintainer. Its exact version is pinned and
its registry integrity is locked. Before adoption, the published runtime files
were compared with Braces 3.0.3. The changes add bounded recursion, fix two
upstream parsing bugs, remove a debug log, and add an ESM/types entry point. The
runtime dependency remains `fill-range`; there are no installation hooks.

`npm audit signatures` against an isolated installation verified all four
registry signatures and the fork's publication attestation. This establishes
publication provenance, not a general security guarantee. The source review
and regression tests are separate checks.

`scripts/dependencySecurity.test.ts` follows Stylelint's actual Micromatch →
Braces dependency path. It checks deep strings below the old character limit,
externally constructed ASTs, and ordinary nested/range glob behavior. The first
seven security assertions fail with the original package and pass with the
replacement; the ordinary-behavior assertion passes with both.

The same suite starts the actual Esbuild resolved through Drizzle's legacy
loader. It verifies real TypeScript enum/import transformation with Node's
native type stripping disabled, plus a loopback compiler server request from
an untrusted Origin. The original compiler sends `Access-Control-Allow-Origin:
*`; the patched compiler does not. This checks the actual vulnerable behavior,
not merely a version string.

## Ongoing checks

The Quality workflow retains the existing production audit and adds a full
`npm audit --audit-level=low`. Development findings now fail CI too; no severity
is suppressed. Existing formatting, lint, type, Knip, unit, local-development,
database, build, browser, and license checks remain required.

When updating either override, rerun the regression suite, real local-development
integration, and the complete existing verification suite. Replace the Braces
fork with an upstream release only after confirming that it guards direct AST
inputs as well as strings. Track upstream Braces advisories as well as the fork:
scanners do not necessarily map a new upstream advisory onto the fork's package
name. Remove the Esbuild override only when the stable Drizzle loader resolves
a patched compiler without it.

## Sources

- [Braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
- [Fork source and release history](https://github.com/Im-Fran/braces)
- [Esbuild development-server advisory](https://github.com/advisories/GHSA-67mh-4wv8-2f99)
- [Vercel 56.2.0 published metadata](https://registry.npmjs.org/vercel/56.2.0)
- [Vercel 65.1.0 published metadata](https://registry.npmjs.org/vercel/65.1.0)
- [Node HTTP adapter](https://github.com/honojs/node-server)
