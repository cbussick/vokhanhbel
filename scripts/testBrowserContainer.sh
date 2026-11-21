#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Keep each worktree's image tag independent, just like its build and result directories.
identity=$(printf '%s' "$PWD" | sha256sum | cut -c 1-16)
image="vokhanhbel-browser:$identity"
docker build --tag "$image" tools/browser
npm run build
mkdir -p test-results/container
# No published ports, shared database, host credentials, or host browser cache. Source is read-only;
# only this worktree's browser artifacts are writable. Docker forwards signals to the foreground run.
docker run --rm --init --ipc=private --shm-size=1g \
  --user "$(id -u):$(id -g)" \
  --mount "type=bind,src=$PWD/dist,dst=/work/dist,readonly" \
  --mount "type=bind,src=$PWD/node_modules,dst=/work/node_modules,readonly" \
  --mount "type=bind,src=$PWD/tests,dst=/work/tests,readonly" \
  --mount "type=bind,src=$PWD/src,dst=/work/src,readonly" \
  --mount "type=bind,src=$PWD/tools/previewHeaders.ts,dst=/work/tools/previewHeaders.ts,readonly" \
  --mount "type=bind,src=$PWD/vercel.json,dst=/work/vercel.json,readonly" \
  --mount "type=bind,src=$PWD/package.json,dst=/work/package.json,readonly" \
  --mount "type=bind,src=$PWD/playwright.config.ts,dst=/work/playwright.config.ts,readonly" \
  --mount "type=bind,src=$PWD/playwright.container.config.ts,dst=/work/playwright.container.config.ts,readonly" \
  --mount "type=bind,src=$PWD/test-results/container,dst=/work/test-results/container" \
  --workdir /work "$image" \
  node node_modules/playwright/cli.js test --config playwright.container.config.ts "$@"
