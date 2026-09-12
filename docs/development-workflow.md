# Development workflow

## Protected `main`

Treat the primary checkout and its `main` branch as a clean, read-only integration checkout. Create
a dedicated branch before changing code, configuration, or documentation. Deliver changes through
reviewed pull requests; never commit or push directly to `main`, or merge locally into `main` and
push the result. GitHub rejects direct pushes, and every commit on `main` is a Vercel production
release.

Before starting a task, fetch the relevant remote branches and fast-forward the primary checkout's
`main`. If `main` has local changes or cannot fast-forward, preserve its state and ask how to proceed.
If task work already exists there, ask how to move it to a branch before committing.

See the [deployment strategy](deployment-strategy.md) for release and migration ordering.

## Resolve the unit of work

For Linear work, read the issue and its parent, children, and blocking relations as required by the
[issue-tracker workflow](agents/issue-tracker.md) before choosing a base or pull-request target.
Linear structure is authoritative:

- A parent issue with implementation sub-issues is the canonical specification and planning
  structure, not an implementation ticket.
- Each sub-issue is one implementation ticket.
- A leaf issue outside a parent spec is one standalone implementation ticket.

Keep one task on one dedicated branch in one in-repository worktree. A spec integration branch is
only the assembly branch for its parent spec; implementation happens on its child branches. Do not
combine sibling tickets on one branch or worktree.

## Create the worktree and branch

Store every task worktree under `.worktrees/` in this repository. Run implementation,
verification, commit, push, and pull-request commands from that worktree, not from the primary
checkout. Continue in an existing worktree only when its branch is the requested task's branch.
Never place two concurrent write-capable agents or sessions in one worktree or on one branch.

### Name the branch

Branch names encode the work, not its current executor. For Linear work, use
`<type>/<issue-key>-<short-slug>`, lowercased, and keep the issue key intact for automatic linking.
Use these types:

- `feature/` for new behavior and parent spec integration branches;
- `fix/` for defects;
- `docs/` for documentation-only changes; and
- `chore/` for maintenance that fits none of the above.

Examples are `feature/vok-6-shared-dialog-primitive`, `fix/vok-42-session-expiry`, and
`docs/vok-51-review-runbook`. Without a Linear issue, omit the issue key, as in
`docs/worktree-workflow`.

Do not add a username, agent name, model, or session ID merely to show ownership. Linear assignment,
the connected GitHub actor, and pull-request metadata are authoritative. Prefer separate Linear
sub-issues when work needs multiple branches. If the user explicitly requests parallel alternatives
for one issue, add a stable semantic qualifier such as `-api`, `-ui`, or `-alt-2`; never force-reuse
or reset another session's branch.

Keep the slug concise, descriptive, ASCII, and non-sensitive. Branch names can appear in URLs, logs,
CI, and tracker linkbacks: never include secrets, customer data, or private description text. Treat
the branch name as untrusted input in scripts. Before creating it, validate it with
`git check-ref-format --branch <branch-name>` and fail safely if the ref already exists.

See the [branch-naming research](research/branch-naming-best-practices.md) for the evidence behind
this convention.

### Choose the base and pull-request target

Choose the base and pull-request target from the issue structure:

| Work                                     | Branch from                        | Pull request targets                                                   |
| ---------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------- |
| Standalone leaf issue or non-Linear task | `main`                             | `main`                                                                 |
| Parent spec integration branch           | `main`                             | `main`, after every child is integrated and the whole spec is verified |
| Implementation sub-issue                 | its parent spec integration branch | that integration branch                                                |

Create the parent spec integration branch and worktree before any child branch. Name the worktree
directory with the issue key or task slug.

From the clean primary checkout, after fetching and fast-forwarding the required base:

```sh
git worktree add .worktrees/VOK-6 -b feature/vok-6-shared-dialog-primitive <base-branch>
```

If the branch already exists, attach it without `-b`:

```sh
git worktree add .worktrees/VOK-6 feature/vok-6-shared-dialog-primitive
```

For a sub-issue, `<base-branch>` is the local, up-to-date parent integration branch. For standalone
work or a parent integration branch, it is `main`.

Incomplete intermediate slices belong on the spec integration branch, not on `main`. As sibling
sub-issues merge, rebase each remaining child branch onto the updated integration branch before
opening or updating its pull request. Resolve and re-run verification on the child branch after a
rebase; never rewrite the shared integration branch.

## Verify and prepare the pull request

Commit only files that belong to the task. Run every applicable repository check and review the
complete branch diff against the implementation ticket or request before opening a pull request.
For the final integration pull request, verify the assembled branch against the parent spec's full
acceptance criteria, not merely the individual child diffs.

The Quality workflow runs on every pull request. It executes formatting, linting, type checking,
unit and database tests, the production build, end-to-end tests, dependency audit, and license
checks. Run the applicable local equivalents; explain any check that cannot be run. When Card,
Collection, or Topic UI changes, run `npm run test:e2e` or the Chromium visual journeys and update
intentional baselines. Chromium is installed at `~/.cache/ms-playwright`; if a sandbox supplies an
empty `PLAYWRIGHT_BROWSERS_PATH`, point it to that cache.

Open a child ticket's pull request against its parent integration branch. Open a standalone task's
pull request against `main`. Open the integration branch's single final pull request against `main`
only after all child pull requests have merged and full-spec verification passes. Confirm the base
explicitly when creating each pull request rather than relying on a CLI default.

Include:

- purpose and scope;
- verification evidence;
- the Linear identifier or link when one exists; and
- known risks or follow-up work.

Address review findings on the same branch. A pull request into `main` is mergeable only when the
required `verify` check passes, required reviews approve it, and the branch is up to date with
`main`.

## Merge and clean up

Merge only through GitHub's pull-request controls and let the GitHub integration update linked
Linear issues.

After a child pull request merges:

1. update the parent integration branch in its worktree;
2. remove the child's worktree;
3. prune stale worktree records; and
4. delete the merged child branch locally and remotely if it still exists.

Keep the parent integration worktree and branch until all children have merged and its final pull
request has reached `main`.

After a standalone or final integration pull request merges:

1. remove its worktree;
2. prune stale worktree records;
3. delete the merged local and remote branch if it still exists; and
4. fetch and fast-forward the clean primary checkout's `main`.

Start the next task only after the primary checkout is clean and current.
