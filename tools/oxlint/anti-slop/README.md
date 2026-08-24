# anti-slop (vendored)

Oxlint rules that reject low-evidence TypeScript patterns. Registered as a JS plugin in
`oxlint.config.ts`.

## Provenance

- Source: <https://github.com/dmmulroy/anti-slop>
- Copyright 2026 Dillon Mulroy, MIT. See `LICENSE`, which is the upstream licence file.
- Vendored from commit `6d538555cb151d4121ed51a27db81890eacf8ae9` (2026-08-18).

Upstream intends this project to be vendored rather than installed, so these files are ours to
maintain. There is no npm package and no automatic update.

## What we changed

Copied `src/`, then removed:

- **The 12 `*.test.ts` files.** Vitest has no `include` in `vite.config.ts`, so its default glob
  would collect them, and they target a different test runner.
- **`effect/`.** We do not use Effect. It is a separate plugin entry point upstream, so dropping it
  leaves `index.ts` intact.
- **Four rules**, deleted here and removed from `index.ts`:
  - `no-shape-in-symbol-names` — fired on Zod's `.shape` API and Lucide's `shapes` icon name.
  - `no-conditional-empty-object-spread` — the pattern it rejects is required by our
    `exactOptionalPropertyTypes` setting.
  - `no-unknown-parameters` — flagged `error: unknown`, which is correct for caught errors. It
    exempts only a parameter named `cause` and has no options.
  - `no-runtime-typeof` — its `allowInTypeGuards` option cleared none of our cases, which are
    feature detection and union discrimination rather than ad hoc narrowing.

Two further rules are switched off for test files in `oxlint.config.ts` rather than deleted, because
they still apply to production code: `no-chained-type-assertions` and `no-known-value-widening`.

## Updating

Clone upstream, diff `src/` against this directory, and reapply the removals above. The plugin runs
on Oxlint's `jsPlugins` API, which is alpha and not covered by semver, so re-check after an Oxlint
upgrade.
