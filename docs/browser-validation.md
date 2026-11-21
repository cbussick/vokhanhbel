# Reproducible browser validation

Run `npm ci` with the repository's Node version, then:

```sh
npm run test:e2e:container
# Fast existing visual regression, repeated without updating any baseline:
npm run test:e2e:container -- --project chromium -g 'stable visual states at mobile width' --repeat-each 3
```

Docker is required. The runner builds on the host and executes the locked Playwright release in
its official Ubuntu Noble image, pinned by digest, plus version-pinned DejaVu packages matching
Ubuntu CI's arrow fallback. The Docker build context contains only the browser Dockerfile.
It uses one worker, private IPC/shared memory,
no published ports, and a disposable container. Each worktree owns its build and
`test-results/container`; do not run concurrent build/browser writers in one worktree.
Only required code/dependencies/assets are mounted read-only; environment files and credentials
are not mounted or forwarded. The browser image includes Node 24.17.0; installation, typechecking
and production building still use the repository-required host Node 24.22.1. Revisit the image and
digest together when upgrading Playwright. Baseline updates require separately reviewing intended
visual changes; the container deliberately mounts snapshots read-only.

`npm run test:e2e` remains useful for native functional checks, including CI's Ubuntu runner.
Native screenshot comparison on a different distribution is not a canonical visual verdict.
Do not increase screenshot tolerance or regenerate baselines to accommodate host rasterization.

## Baseline investigation (2026-11-21)

Base: `df5a0bcb1427b78129c6740ea41ab453f94326ef`. The migration audit reported 20 native
Chromium failures, also present before migration; remote Ubuntu CI was green.

The tight repro was the existing mobile visual journey. It fails at its first screenshot,
`login-mobile`, before login or any Review interaction. The load-bearing minimal scenario is
390×844 Chromium, the mocked unauthenticated Session, the production login page and its existing
screenshot assertion. No database or later journey state is involved in that first failure. The wider suite subsequently
revealed a separate arrow fallback mismatch, described below. The first screenshot is
already a regression assertion; no synthetic unit test can substitute for this rendering seam.

Native invocation (temporary config only changed the isolated server port to 42861):
`PLAYWRIGHT_BROWSERS_PATH=/root/.cache/ms-playwright npx playwright test -c playwright.local.config.ts --project chromium -g 'stable visual states at mobile width'`.
It reports one comparator-significant differing pixel. PNG inspection found 6,085 raw changed
pixels in the text region (x=41..332, y=338..594), illustrating why the comparator's count alone
is misleading. Expected/actual/diff images were inspected; the difference is text rasterization,
not an intended layout redesign.

Both environments use lockfile Playwright 1.61.1, Chromium revision 1228 (149.0.7827.55), and
identical bundled Be Vietnam Pro/Baloo 2 WOFF2 assets (ADR-0010). The baseline's last update
also used Playwright 1.61.1. Host Debian 13 uses FreeType 2.13.3+dfsg-1+deb13u1,
Fontconfig 2.15.0-2.3 and HarfBuzz 10.2.0-1+deb13u1. The passing Ubuntu 24.04.4 image uses
FreeType 2.13.2+dfsg-1ubuntu0.1, Fontconfig 2.15.0-1.1ubuntu2 and HarfBuzz 8.3.0-2build2.
Changing the browser OS stack alone makes the original mobile journey pass, then pass three
consecutive times through the committed runner, with unchanged assertions and snapshots.
This identifies the rendering environment mismatch, not a particular library's internal defect.
Font-loading races/browser revision drift are not supported by the stable native capture and
same-revision Ubuntu pass. A first container probe with `--network none` passed the login
screenshot but correctly failed login because Chromium reports offline; the runner therefore
uses a private Docker bridge with no published ports, not an offline network.

The first broad run exposed a second mismatch after the tablet journey progressed beyond its
original login failure: 19 differing pixels on `collection-editor-tablet`, reproduced three times.
Expected/actual/diff crops localize it to the background Collection navigation arrow (`→`).
The stock Playwright image lacks DejaVu; adding only Ubuntu's `fonts-dejavu-core` 2.37-8
(and its mono package) makes that original tablet journey pass unchanged. The committed Dockerfile
therefore pins both packages. This is a missing fallback-font environment dependency, not permission
to replace the intended arrow or edit its snapshot. Neither bundled font assets nor licenses change.

Two independent read-only reviews found that the initial container preview omitted production
security headers. The final implementation extracts the existing validated `vercel.json` header
reader unchanged into `tools/previewHeaders.ts`, shared by native Vite and the container preview.
The final runner therefore retains CSP and other production headers without running build plugins
inside its read-only source mount. Final gates and re-review cover this correction.

The fix supplies a deterministic local validation environment rather than changing the app's
intended visuals. Existing snapshots and anti-slop rules are preserved. Temporary investigation
logs, traces, and actual/diff images are disposable after delivery; the diagnosis and results here
are the durable record.

## Reviewed validation result

Implementation `99ccbd87fc246de8ee40e4ab122fbfce6594ad2c` passed the complete isolated browser
suite: **89 passed, 46 pre-existing skips, zero failures**, across Chromium, Firefox and WebKit
with one worker. Original mobile and tablet multi-state visual journeys then passed three repeats
each (**6 passed**) with the final production headers and DejaVu fallback installed. No snapshots,
assertions, tolerances, bundled assets or app visuals changed.

Fresh installation, production build, formatting, lint, types, both Knip modes, production audit
(zero vulnerabilities) and license policy passed. Unit tests: **272 passed / 33 files**; isolated
database tests: **31 passed / 2 files**; isolated local-development integration: **1 passed**.
The unit run preceded the mechanical shared-header extraction; final type/build/browser gates
covered the extraction without duplicating the full unit suite. Disposable database validation
used a private container network namespace, not the shared host database port.

Two independent local read-only reviews identified the draft's omitted production headers.
After correction, two fresh independent full-diff reviews reported no actionable findings.
These are agent reviews, not human approvals. Native Debian remains noncanonical for exact
screenshot comparison; the pinned container is the reproducible local environment. No single
rendering-library internal defect or human design approval is claimed.
