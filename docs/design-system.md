# Design system and Storybook (VOK-32)

The current app is the design system. Storybook catalogs it; it does not introduce a new visual
language, UI package, or token build pipeline. Production component markup, CSS, and token values
are unchanged by this ticket.

## Run and verify

```sh
npm ci
npm run storybook           # http://localhost:6006
npm run build-storybook    # static output: storybook-static/
npx playwright install chromium
npm run test:storybook     # builds, then checks every story at desktop and narrow/reduced-motion sizes
```

No database, password, `.env`, speech credentials, or Tutor provider is needed. Fonts are served
from `public/`; the MSW worker and a quiet, generated audio test tone live in `.storybook/public/`
and are **not** shipped with the app. API fixtures are fictional. An explicit catch-all responds
with an error to unmodelled `/api/*` requests rather than forwarding them to a backend. File picking
and microphone recording remain real, opt-in browser capabilities. Do not host this catalog on the
production app's origin: its mock service worker is scoped to its own origin.

The setup follows the local `FeBOp-design-system` reference: foundations pages, colocated component
stories, controls, accessibility inspection, and pseudo-state stories. Unlike that repository, it
uses this app's CSS Modules and existing global tokens directly, with no nested packages.

## Token contract

`src/styles/global.css` is the sole source of token values, consumed unchanged by both applications.
The foundation stories read that CSS rather than maintaining a second list of values:

| Namespace                     | Contract                                               | Catalog                  |
| ----------------------------- | ------------------------------------------------------ | ------------------------ |
| `--color-*`                   | Existing semantic UI colors and derived hover surfaces | Foundations / Colors     |
| `--space-*`                   | Padding, margin, gap scale in rem                      | Foundations / Spacing    |
| `--radius-*`                  | Small, medium, large, full corner radii                | Foundations / Radii      |
| `--font-ui`, `--font-display` | Self-hosted font families, per ADR-0010                | Foundations / Typography |
| Other `--font-*`              | Existing font-size scale                               | Foundations / Typography |

Shadow, motion, easing and layer tokens already exist too; they are not redefined here. Weights
and line heights do **not** yet have agreed semantic tokens. Adding those, a 12px radius, or new
color roles requires a design decision rather than mechanically standardizing existing differences.

`Colors / Local Colors And Artwork` scans component CSS, route CSS, and inline SVGs for literals.
It shows where they occur, including the mascot and flags. `Colors / Derived Surfaces` catalogs
component-local `color-mix()` expressions too. Expressions relying on a local custom property or
`currentColor` are explicitly marked context-dependent instead of showing a misleading swatch.
The scanner is not an exhaustive CSS parser; verify each pairing in its component story. Do not automatically map
artwork to semantic UI colors, or map white foregrounds to a token whose meaning is surface.

## Catalog and coverage

- **Foundations:** live color swatches, foreground/background pairings, local literal colors,
  spacing bars, radius samples, font families/sizes/weights and Vietnamese/German samples.
- **Components:** IconButton; Collection/Topic/Language selects; Dialog and Card/Collection/Topic
  form dialogs; empty/error/loading/pending states; Collection/Topic icons; Tutopher; Tutor dialog;
  Clip player/input/generation; CardFace; review options/footer/Tutor action/audio-unavailable notice;
  connectivity states.
- **Patterns:** actual dialog action and Grade button CSS compositions. These deliberately do not
  pretend a shared text Button already exists.
- **Screens:** AppShell variants; Card/Collection pages with real tiles, rows and detail content;
  review overview; points/statistics; flip, matching, multiple-choice and swipe Exercises; summary.
- **Composition-only coverage:** AddIcon is exercised by IconButton; EmptyCardsIcon and
  EmptyCollectionsIcon by EmptyState; VisualCardFace by CardFace; ListboxRoot/ListboxOption by all
  selects; OptionOutcome by review options; ExerciseScreen by all four Exercises. Their private
  internals are not exported just for Storybook.
- **Nonvisual infrastructure:** Auth/Review providers, RequireSession and AppErrorBoundary remain
  integration/unit-test responsibilities. SessionErrorScreen is also cataloged independently.

Named stories cover applicable default/disabled/hover/pressed/focus states, selection/empty/long
content, form create/edit/delete-confirmation/saving/failure/offline states, audio modalities and
playback outcomes, and unresolved/resolved Exercise outcomes. Hardware-specific recording states
(permission denied, missing device, live recording) still require manual browser testing; they are
not faked as reliable cross-browser examples. Audio playback state stories dispatch media events,
while the Ready story supports actual playback of the local tone.

Review screen fixtures are view snapshots, not a live Review Session. Explicit Interactive stories
support reveal, swipe and multiple-choice selection. Matching permits local selection/mismatch
feedback but does not advance a fixed fixture. Form writes return disposable fixture responses,
not a persisted in-memory application. Replay a story to reset it.

## Reported differences — no automatic fixes

The detailed, source-linked findings are maintained in `src/storybook/audit.ts` and rendered under
**Foundations / Audit / Decisions Needed**:

1. Text button rules are repeated, with different sizing/weights and pending/hover behavior.
2. White foregrounds, the modal scrim, the neutral Grade surface and derived state mixes lack
   shared color roles in some places.
3. A 12px radius is expressed through spacing or a calculation rather than a radius token.
4. Font weights and line heights remain local; families and sizes are already tokens.
5. Spacing, geometry, target sizes, borders and breakpoints need separate decisions—not one bulk
   numeric replacement.
6. Fields, Card rows and tiles are compositions, not a generic Input/Field/Card library.
7. Disabled and aria-disabled states have intentionally different interaction semantics; contrast
   must be assessed on real pairings. White on success green is not a suitable normal-text pairing.
8. Artwork colors are separate from semantic UI colors.

## Adding stories

Colocate `Component.stories.tsx` beside the component. Use typed CSF3 `Meta` / `StoryObj`, realistic
German/Vietnamese content, the actual component, and `storybook/test` spies/assertions. Add named
states rather than relying on controls to make hidden behavior discoverable. Dialogs should be
shown alone in Canvas: multiple open native modal dialogs in a docs page would compete for focus.
Autodocs examples use isolated iframes to prevent fixed app field IDs and mock request state from
colliding. Use **Canvas** for live controls; Storybook does not synchronize Docs controls into
iframe stories.

The preview creates a fresh query cache and memory router per story ID. Mock handler groups use
`parameters.msw.handlers.app`; override it with `[stateHandler, ...handlers]` so the state handler
wins. Browser-global overrides must return cleanup from `beforeEach`, as `offline()` does.
Keep fixture/schema validation in `src/storybook/fixtures.test.ts` current.

`test:storybook` discovers the built story index and checks every Canvas story for rendering,
JavaScript/console errors and play-function failures at two viewport configurations. It uses
Storybook 10's render phase to wait for completed play functions; review that small adapter when
upgrading Storybook. It also checks live palette values. This is smoke/interaction coverage, not
pixel-baseline or full WCAG certification. The a11y addon reports existing findings as `todo`;
manual keyboard, forced-colors, reduced-motion and assistive-technology review is still needed.

## Documentation sources

- React/Vite framework: https://storybook.js.org/docs/get-started/frameworks/react-vite
- Isolated Vite configuration: https://storybook.js.org/docs/builders/vite#override-the-default-configuration
- Typed stories: https://storybook.js.org/docs/writing-stories/typescript
- Play functions: https://storybook.js.org/docs/writing-stories/play-function
- Docs iframe isolation: https://storybook.js.org/docs/api/doc-blocks/doc-block-story#inline
- MSW addon **v2** (the installed API, not v3): https://storybook.js.org/docs/9/writing-stories/mocking-data-and-modules/mocking-network-requests

## Dependency audit baseline

The native `npm audit` check on 2026-09-26 reported the same 45 advisories on `main` and this branch
(1 low, 15 moderate, 28 high, 1 critical), with no newly named vulnerable dependency introduced by
Storybook. This is an existing repository security follow-up, not a clean audit result and not an
approved exception. Review the existing high/critical findings before release; no unrelated forced
upgrades or advisory suppression were applied here. Dependency license verification passes.
