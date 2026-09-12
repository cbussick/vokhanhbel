# Git branch naming best practices: conventional and agent-concurrent work

**Accessed:** 2026-09-05

**Source policy:** Primary, first-party documentation only: Git, GitHub, GitLab, Atlassian, Microsoft/Azure DevOps, Linear, Anthropic, OpenAI, and Cognition. Product behavior can change; preview behavior is identified where the source does so.

## Executive summary

The strongest current practice is not one universal branch-name grammar. It is a short, documented, machine-valid convention adapted to the repository's integrations:

- Treat Git's ref-name grammar and the host's additional restrictions as **hard requirements**.
- Include an issue/work-item identifier when an integration actually parses it. Preserve the tracker's required form and position. GitLab's native issue linking is unusually positional; Jira requires the key's canonical uppercase form; Linear accepts its issue ID in the branch name. GitHub and Azure Boards can instead maintain an explicit issue-to-branch link.
- Use a concise task slug and, where useful, a small controlled type namespace. Lowercase ASCII kebab-case is the most interoperable default for ordinary words; preserve canonical uppercase issue keys when required.
- Branch from the repository's actual intended base/default branch, not from a hard-coded assumption that it is named `main`.
- Give each concurrent write-capable agent/session an isolated worktree or environment and, once work is retained as a branch, a distinct branch. Git itself normally refuses to check out one branch in two worktrees.
- Do not put an agent's model/persona name into every branch. Product-owned prefixes such as GitHub's `copilot/` are useful integration namespaces, but the reviewed sources do not establish agent identity as a general branch-naming best practice. Record accountable actor/session provenance in the pull request, commit/audit metadata, and agent-session system.
- Make the generator collision-aware. Prefer one canonical branch per independently reviewable unit; when one issue intentionally produces several branches, add a stable scope/layer/attempt discriminator rather than a long random UUID.
- Treat branch names as public or at least broadly operational metadata and as untrusted input. Do not place secrets or unnecessary personal/customer data in them, and never interpolate them unsafely into CI shell scripts.

The most defensible generic patterns are therefore:

```text
# Tracker whose key can occur after a type namespace
feature/ABC-123-short-task-slug
fix/ABC-456-short-task-slug

# GitLab native issue linkage (numeric issue number must lead)
123-short-task-slug
123-api-short-task-slug       # distinct branch/layer for the same issue

# No tracker
feature/short-task-slug
fix/short-task-slug
```

These are **synthesized recommendations**, not formats mandated by Git.

## Classification used in this report

- **Hard technical requirement:** rejected or unsafe at the Git/ref-storage level.
- **Host requirement:** an additional condition enforced by a hosting product.
- **Integration requirement:** necessary for a documented cross-link or automation behavior.
- **Convention/default:** a product-generated format or a commonly offered pattern, but configurable or optional.
- **Recommendation:** explicit first-party advice.
- **Synthesis:** a conclusion drawn across sources; not directly prescribed by one source.

# Part 1 — Traditional and recent software-development practice

## 1. The hard floor: valid and shell-safe Git refs

Git stores local branches under `refs/heads/`. Its ref rules allow `/` for hierarchy but prohibit, among other things, a slash component beginning with `.`, a component ending in `.lock`, `..`, ASCII controls, spaces, `~`, `^`, `:`, `?`, `*`, `[`, `\`, `@{`, leading/trailing or repeated `/`, a trailing `.`, and the single name `@`. `git check-ref-format --branch <name>` is the authoritative local validator and additionally rejects a leading dash for a branch name. These are **hard technical requirements**. [Git: `git-check-ref-format`](https://git-scm.com/docs/git-check-ref-format)

GitHub recommends avoiding special characters and gives a safe set of letters, digits, `.`, `-`, `_`, and `/`, with a letter as the first character. GitHub additionally refuses names that look like a 40-hex-character object ID and names beginning `refs/`. These are respectively a **recommendation** and **host requirements**. [GitHub: Dealing with special characters in branch and tag names](https://docs.github.com/en/get-started/using-git/dealing-with-special-characters-in-branch-and-tag-names)

GitLab adds **host requirements**: no spaces, no exactly 40 hexadecimal characters, and case-sensitive branch names. For compatibility with other packages it recommends lowercase ASCII letters, numbers, hyphens, and underscores; it separately recommends alphanumerics, hyphens, and underscores for maximum GitLab Runner/tool compatibility. [GitLab: Branches — Name your branch](https://docs.gitlab.com/user/project/repository/branches/#name-your-branch)

**Synthesis:** use a deliberately narrow alphabet. For ordinary words, prefer lowercase ASCII kebab-case; use `/` only for meaningful, shallow namespaces. Preserve a tracker token's canonical case when the integration requires it. Avoid spaces, shell metacharacters, emoji, and visually ambiguous punctuation even when a particular Git client accepts them. A practical grammar is:

```regex
^(feature|fix|docs|chore|hotfix|release)/[A-Za-z0-9][A-Za-z0-9-]*$
```

That example must be adapted for the project's issue-key and multi-branch rules; it is not a Git standard.

## 2. Descriptive task branches and type prefixes

Atlassian's Feature Branch Workflow recommends a separate branch for each feature or issue, based on the latest `main`, with a descriptive, highly focused name such as `animated-menu-items` or `issue-#1061`. It describes feature branches as reviewable via pull requests rather than direct work on `main`. [Atlassian: Git Feature Branch Workflow](https://www.atlassian.com/git/tutorials/comparing-workflows/feature-branch-workflow)

Bitbucket's configurable branching model offers the conventional prefixes `feature/`, `release/`, `bugfix/`, and `hotfix/`; its development branch may be `main` or `develop`. Atlassian characterizes these as typical, configurable conventions, not Git requirements. [Bitbucket Cloud: Configure a project's branching model](https://support.atlassian.com/bitbucket-cloud/docs/configure-a-projects-branching-model/)

Azure Repos recommends a simple strategy: feature branches for features and fixes, pull requests into a high-quality current main branch, and a consistent naming convention. Its examples include both owner-oriented forms (`users/username/description`, `users/username/workitem`) and purpose-oriented forms (`bugfix/description`, `feature/feature-name`, `feature/feature-area/feature-name`, `hotfix/description`). [Azure Repos: Git branching guidance](https://learn.microsoft.com/en-us/azure/devops/repos/git/git-branching-guidance?view=azure-devops)

**Evidence-based conclusion:** type prefixes are established and useful, especially where protections, target selection, or CI inspect branch patterns, but they are conventions rather than universal requirements. Keep the type vocabulary small and tied to behavior. GitLab, for example, can route `feature/*` and `bug/*` to `develop` and `release/*` to `main`; in such a repository the prefix has an actual integration meaning. [GitLab: Configure workflows for target branches](https://docs.gitlab.com/user/project/repository/branches/#configure-workflows-for-target-branches)

Do not confuse familiar type prefixes with a requirement to adopt the whole Gitflow model. Atlassian now labels Gitflow a **legacy** workflow that has fallen in popularity in favor of trunk-based workflows and can be challenging with CI/CD. Its historical defaults (`feature/`, `release/`, `hotfix/`, plus long-lived `develop`) remain evidence of conventional vocabulary, not a current recommendation to create those branch classes in every repository. [Atlassian: Gitflow Workflow](https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow)

## 3. Issue IDs: use them when they buy traceability or automation

The products do not agree on one issue-ID position:

| Product/integration            | Documented behavior                                                                                                                                                                                                                                                                                        | Classification                                                                                                                                                                                                                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GitLab issues/tasks**        | A same-project branch beginning with the numeric issue/task number followed by `-`, such as `123-`, links the item and merge request and can import metadata/enable closing behavior. GitLab's default issue-branch template is `%{id}-%{title}`; configurable variables also include `%{branch_creator}`. | **Integration requirement** for this branch-name linking path; template is a **default**. [GitLab](https://docs.gitlab.com/user/project/repository/branches/#prefix-branch-names-with-a-number)                                                                                         |
| **Jira**                       | Put the canonical work-item key in the branch, e.g. `JRA-123-<branch-name>`. Jira says the key must be correctly capitalized; creating from Jira adds it automatically.                                                                                                                                    | **Integration requirement** for branch-name linking. [Jira](https://support.atlassian.com/jira-software-cloud/docs/reference-issues-in-your-development-work/)                                                                                                                          |
| **Linear + GitHub/GitLab**     | Include the Linear issue ID in the branch name; Linear's “Copy git branch name” uses a configurable branch format. Linear also supports multiple PRs linked to one issue.                                                                                                                                  | **Integration requirement** for branch-name auto-linking; copied format is a **configurable default**. [Linear GitHub integration](https://linear.app/docs/github#linking-linear-issues-to-github-prs), [Linear GitLab integration](https://linear.app/docs/gitlab#create-a-new-branch) |
| **GitHub Issues**              | Creating from the issue page stores an explicit connection; the name is editable, multiple branches may link to one issue, and the new branch defaults to the current repository and default branch. The page does not state that an issue number is required in the name.                                 | Explicit link, **no naming requirement shown**. The feature is documented as public preview. [GitHub](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-a-branch-for-an-issue)                                                                     |
| **Azure Boards + Azure Repos** | Creating from a work item links the branch automatically; existing branches can be linked explicitly. The documented flow asks the user to name the branch but does not require that the work-item ID be embedded in that name.                                                                            | Explicit link, **no naming requirement shown**. [Azure Boards](https://learn.microsoft.com/en-us/azure/devops/boards/backlogs/connect-work-items-to-git-dev-ops?view=azure-devops)                                                                                                      |

**Synthesis:** put a stable issue key near the start when the tracker parses names, but obey that tracker's exact grammar before applying a generic type prefix. Thus `feature/JRA-123-slug` is compatible with Jira's documented “key in the name” behavior, while GitLab's native numeric linking calls for `123-slug`, not `feature/123-slug`. Do not duplicate issue title text verbatim: normalize it to a short slug.

Issue IDs are not a substitute for explicit PR references. Linear, for example, also supports IDs in PR titles and magic words in PR descriptions, and Jira asks for the key in commit messages and PR titles as well as branch names. [Linear GitHub integration](https://linear.app/docs/github#link-through-pull-requests), [Jira: Reference work items](https://support.atlassian.com/jira-software-cloud/docs/reference-issues-in-your-development-work/)

## 4. Usernames and owners

There is first-party support for owner namespaces, but not consensus that every branch should have one:

- Azure lists `users/username/description` and `users/username/workitem` among several suggestions, alongside owner-free `feature/` and `bugfix/` forms. [Azure Repos branching guidance](https://learn.microsoft.com/en-us/azure/devops/repos/git/git-branching-guidance?view=azure-devops#name-your-feature-branches-by-convention)
- Azure can enforce folder-level creation permissions, for example allowing contributors under `feature/` and `users/` while reserving `release/` for administrators. This gives a namespace operational meaning. [Azure Repos: Require branch folders](https://learn.microsoft.com/en-us/azure/devops/repos/git/require-branch-folders?view=azure-devops)
- GitLab makes `%{branch_creator}` available in issue-branch templates, but its default `%{id}-%{title}` omits the creator. [GitLab: Configure default pattern](https://docs.gitlab.com/user/project/repository/branches/#configure-default-pattern-for-branch-names-from-issues)

**Synthesis:** include an owner namespace only when it drives permissions, personal queues, fork-like organization, or collision avoidance. It is poor durable ownership metadata by itself: assignments and collaborators change, while the branch name remains. Prefer issue assignment and PR authorship for accountability.

## 5. Separators, case, slugs, and length

**Separators and case.** `/` is the established hierarchy separator; `-` is the clearest word separator inside a slug. `_` and `.` are valid in the conservative GitHub set but add little to a new convention. Lowercase normal words avoid case-only variants; canonical external identifiers are the exception. GitLab explicitly says branch names are case-sensitive, and Jira explicitly requires uppercase work-item keys for recognition. [GitLab branch naming](https://docs.gitlab.com/user/project/repository/branches/#name-your-branch), [Jira work-item references](https://support.atlassian.com/jira-software-cloud/docs/reference-issues-in-your-development-work/)

**Slug quality.** The evidence supports descriptive and focused names, not full issue titles. GitHub Copilot itself changed from UUID-heavy names such as `copilot/fix-<uuid>` to descriptive names such as `copilot/add-theme-switcher`, first-party evidence that human-readable task slugs are preferable to opaque randomness in an agent-generated namespace. [GitHub changelog: Copilot coding agent uses better branch names](https://github.blog/changelog/2025-10-16-copilot-coding-agent-uses-better-branch-names-and-pull-request-titles/)

**Length.** Git's documented ref-format rules do not prescribe a numeric branch-name limit, and the reviewed GitLab, Bitbucket, Azure Repos, and Linear naming pages do **not** establish one portable recommended maximum. GitHub, however, documents a **255-byte host limit** for a single Git ref; non-ASCII characters can consume more than one byte. Treat that as a **GitHub host requirement**, not as a universal Git limit or a recommended target length. [GitHub Enterprise Importer: Limitations of GitHub](https://docs.github.com/en/migrations/using-github-enterprise-importer/migrating-between-github-products/about-migrations-between-github-products#limitations-of-github)

**Synthesis:** stay well below every downstream limit by setting a repository-local practical cap; keep the issue token, type, and uniqueness suffix, then deterministically truncate only the descriptive slug. Count bytes where a host specifies bytes, and validate both locally and at the host. A number such as “50” or “100” may be a reasonable local policy, but the surveyed sources do not support presenting either as an industry standard.

## 6. Default-branch workflow

Do not equate “default branch” with a universal literal name. Git currently documents `master` as the fallback initial name, configurable through `init.defaultBranch`, with a planned change to `main` in Git 3.0. GitHub allows any existing branch to be configured as default and defines it as the base for pull requests and code commits. [Git: `git-init`](https://git-scm.com/docs/git-init#Documentation/git-init.txt---initial-branchltbranch-namegt), [GitHub: Changing the default branch](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-branches-in-your-repository/changing-the-default-branch)

The broad first-party recommendation is nevertheless consistent: create short-lived task/feature branches from the current intended base, merge through reviewed pull/merge requests, keep the main/default branch healthy and current, and delete merged topic branches where the team's retention policy permits. [Azure Repos branching guidance](https://learn.microsoft.com/en-us/azure/devops/repos/git/git-branching-guidance?view=azure-devops), [GitLab branch workflow](https://docs.gitlab.com/user/project/repository/branches/), [Atlassian Feature Branch Workflow](https://www.atlassian.com/git/tutorials/comparing-workflows/feature-branch-workflow)

**Synthesis:** automation should resolve the remote's default branch or receive an explicit base. Hard-coded `main` is only correct where repository policy guarantees it. For stacked/spec work, the correct base may intentionally be another task branch.

## 7. Enforce the convention where it matters

A prose convention alone is fragile. Current hosts provide enforcement:

- GitHub rulesets can restrict branch names with literal or regular-expression metadata restrictions and target branch namespaces using `fnmatch`; GitHub recommends evaluating restrictions before activating them. [GitHub: Creating rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository#adding-metadata-restrictions)
- GitLab push rules can validate branch names with RE2 regular expressions; its default branch is always allowed. [GitLab: Push rules — Validate branch names](https://docs.gitlab.com/user/project/repository/push_rules/#validate-branch-names)
- Azure Repos can enforce which hierarchical branch folders contributors may create. [Azure Repos: Require branch folders](https://learn.microsoft.com/en-us/azure/devops/repos/git/require-branch-folders?view=azure-devops)
- Bitbucket's branching model centralizes the available types and configurable prefixes. [Bitbucket Cloud branching model](https://support.atlassian.com/bitbucket-cloud/docs/configure-a-projects-branching-model/)

**Synthesis:** use one shared name generator for humans and agents, run `git check-ref-format --branch`, check remote existence, and create/push atomically. Align host rules, CI globbing, deployment environments, and tracker templates before enforcing. Reserve namespaces used by bots or releases rather than relying on names as authentication.

# Part 2 — Emerging practice for AI coding agents and concurrent work

## 8. Isolation is becoming the primary concern

The clearest new pattern is **session isolation**, not a new universal text grammar:

- Claude Code recommends separate Git worktrees for parallel sessions so edits do not collide. `claude --worktree <name>` defaults to `.claude/worktrees/<name>/` and branch `worktree-<name>`; an omitted name gets a generated phrase such as `bright-running-fox`. It branches from the remote default branch by default, or can be configured to use current `HEAD`. Subagents can also use isolated worktrees. [Claude Code: Run parallel sessions with worktrees](https://code.claude.com/docs/en/worktrees)
- OpenAI's Codex app gives parallel chats separate worktrees but defaults those managed worktrees to **detached HEAD**, deliberately avoiding branch pollution. A branch is created only when the user chooses “Create branch here”; users select the starting branch. [OpenAI Codex: Worktrees](https://developers.openai.com/codex/app/worktrees)
- The GitHub Copilot app documents multiple simultaneous isolated sessions, each with its own branch; a non-session chat does not create a branch or worktree. [GitHub Copilot app: Agent sessions](https://docs.github.com/en/copilot/how-tos/github-copilot-app/agent-sessions)
- GitHub Copilot cloud agent automates branch creation, commits, pushes, and optionally a PR in an ephemeral environment. A task can use only one branch and open exactly one PR. [GitHub: About Copilot cloud agent](https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-cloud-agent)

This is **product behavior**, not proof that every repository should adopt those products' generated names. It does show an emerging separation between (a) an ephemeral isolated workspace/session identifier and (b) a durable review branch. Codex makes that separation explicit through detached HEAD; Claude uses a temporary `worktree-` branch; Copilot uses a durable product namespace.

## 9. Worktrees impose concrete branch constraints

Git worktrees share repository history and most refs, but each has its own files, index, and `HEAD`. By default, `git worktree add` refuses a branch already checked out in another worktree. If no branch is supplied, Git derives a new branch from the final path component; `-b` also refuses if that branch already exists. These are **hard operational constraints** relevant to concurrent agents. [Git: `git-worktree`](https://git-scm.com/docs/git-worktree)

**Synthesis:**

1. Never send two write-capable agents into one working directory.
2. Do not assign the same branch to two simultaneous worktrees. Use separate branches or detached worktrees and integrate later.
3. Pass branch and worktree path explicitly. Git's path-basename default can accidentally turn two similarly named sessions into a branch collision.
4. Keep the worktree/session ID separate from the branch's semantic task identity where the tool permits it.
5. Before cleanup, distinguish disposable worktrees from branches with uncommitted or unpushed work. Both Git and Claude document safeguards around removing active/dirty worktrees. [Git worktree removal](https://git-scm.com/docs/git-worktree), [Claude Code cleanup](https://code.claude.com/docs/en/worktrees#clean-up-worktrees)

## 10. Multiple branches per issue and stacked work

One issue does not necessarily imply one branch across all products. GitHub explicitly allows multiple branches connected to an issue. Linear explicitly supports multiple PRs linked to one issue and waits for the final linked PR before applying the configured completion transition. [GitHub: Creating a branch for an issue](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-a-branch-for-an-issue), [Linear: Link multiple issues and PRs](https://linear.app/docs/github#link-multiple-issues)

Conversely, GitHub Copilot cloud agent currently limits each assigned task to one branch and exactly one PR. That is a **product limit**, not a general Git rule. [GitHub: Copilot cloud-agent limitations](https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-cloud-agent#limitations-of-copilot-cloud-agent)

Large work may also be deliberately stacked. Cognition documents Devin stacks as ordered PRs: the bottom targets trunk, each higher PR targets the branch below, and the stack lands bottom-up. Devin states that stack identity is a first-class GitHub object rather than a branch-naming convention. [Devin: Stacked PRs](https://docs.devin.ai/work-with-devin/stacked-prs)

**Synthesis:** prefer one branch per independently reviewable unit, not mechanically one branch per tracker issue. If a single issue legitimately fans out:

- create sub-issues and use their IDs where the tracker supports that;
- otherwise append a stable semantic discriminator, for example `ABC-123-api`, `ABC-123-ui`, or `ABC-123-migration`;
- for alternative attempts, append a short attempt discriminator only after the semantic core, for example `ABC-123-parser-alt-2`;
- for a stack, let base/head relations and PR metadata express order; a numeric branch suffix can aid humans but is not the source of truth.

This naming scheme is synthesis; the sources establish multi-branch and stacked workflows but do not prescribe these exact suffixes.

## 11. Collision avoidance for automated creation

Concurrent agents make deterministic names such as `feature/ABC-123-slug` likely to collide. Full random UUIDs avoid collision but reduce readability; GitHub's Copilot changelog documents a move away from random UUID-heavy names toward descriptive `copilot/<task-slug>` names. [GitHub Copilot branch-name changelog](https://github.blog/changelog/2025-10-16-copilot-coding-agent-uses-better-branch-names-and-pull-request-titles/)

**Synthesis:** use this order of preference:

1. Reuse the existing branch only when the system can prove it belongs to the same resumable task/session.
2. Otherwise create a semantic branch for a distinct unit of work.
3. If that exact name exists, append a short stable discriminator supplied by the orchestration system (scope, stack layer, attempt number, or shortened session ID).
4. Perform an atomic branch/ref creation and handle “already exists”; a prior list/check alone is race-prone.
5. Never silently reset or force-reuse another agent's branch. Git's `-b` worktree behavior refuses existing branches by default; preserve that safeguard rather than reaching for `-B` or `--force`. [Git: `git-worktree` options](https://git-scm.com/docs/git-worktree#Documentation/git-worktree.txt--bltnew-branchgt)

## 12. Does agent identity belong in the branch name?

The evidence is mixed at the **product-default** level and absent at the general-practice level:

- GitHub Copilot uses `copilot/<descriptive-slug>`, so a product identity can be a useful reserved namespace for routing, permissions, or recognition. [GitHub Copilot changelog](https://github.blog/changelog/2025-10-16-copilot-coding-agent-uses-better-branch-names-and-pull-request-titles/)
- Claude Code uses `worktree-<name>` for its managed temporary branch, identifying workspace type rather than model/persona. [Claude Code worktrees](https://code.claude.com/docs/en/worktrees#start-claude-in-a-worktree)
- Codex managed worktrees create no branch by default. [OpenAI Codex worktrees](https://developers.openai.com/codex/app/worktrees#how-codex-manages-worktrees-for-you)
- GitHub rulesets separately recognize GitHub Apps as actors and even have additional-review behavior for unattributed Copilot PRs. This demonstrates that governance can use authenticated PR/app identity rather than parsing a branch name. [GitHub: Available rules for rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets#additional-approval-for-unattributed-copilot-pull-requests)
- Linear explicitly separates delegation from accountability: an agent may work on an issue while the human assignee remains responsible, and Linear tracks assignee/agent state and history as structured metadata. [Linear: Assign and delegate issues](https://linear.app/docs/assigning-issues#delegating-to-agents)

**Conclusion (synthesis):** do not encode model names, persona names, or mutable agent versions in normal task branches. Use an `agent/` or vendor prefix only if it drives a real policy or integration, and still include the issue/task identity and readable slug. Agent authorship and human accountability belong in authenticated actor data, commits, PR/session links, reviews, and audit logs. A branch prefix is classification, not proof of identity.

## 13. Security and privacy

Branch names are **untrusted input**. GitHub explicitly warns that branch names can contain malicious shell fragments and that context values such as `head_ref` and `ref` must not flow directly into executable code. [GitHub Actions: Script injections](https://docs.github.com/en/actions/concepts/security/script-injections)

Therefore:

- Do not interpolate a branch name directly into a CI `run:` script. Pass it as data through a safely quoted environment variable or an action API and validate against the repository's allowlist grammar.
- Do not rely on a naming policy as the only defense. GitHub's own security guidance treats flexible branch names as attacker-controlled input.
- Reserve protected namespaces and enforce permissions/rules at the host. Names themselves do not authenticate their creator.

The reviewed sources contain **no branch-name-specific rule saying “do not put PII in branch names,” and no promise that deleting a branch erases every appearance of its name from logs, PRs, integrations, or caches**. The following is therefore conservative synthesis, not a quoted vendor mandate: treat branch names as durable operational metadata visible to everyone who can see repository activity and often copied into URLs, CI variables, PRs, and tracker linkbacks. Never include credentials, customer data, private issue titles, email addresses, or unnecessary personal names. Prefer an opaque issue ID plus a non-sensitive summary for confidential work.

## 14. Product defaults and absent evidence

| Product                          | Current documented default/relevant behavior                                                                                                            | What is not established by the cited source                                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Git                              | Validates ref grammar; `git worktree add <path>` can derive a branch from the path basename.                                                            | No universal semantic convention or numeric portable length cap.                                                                        |
| GitHub hosting / issue branch UI | GitHub documents a 255-byte ref limit; issue-created branches start from the default branch, permit an edited name, and allow multiple linked branches. | No documented required issue-number format on the cited issue-branch page, and 255 bytes is a ceiling rather than a recommended target. |
| GitLab issue branch UI           | `%{id}-%{title}` by default; configurable, including optional creator.                                                                                  | No general requirement for type or username prefixes.                                                                                   |
| Bitbucket branching model        | Suggested configurable type prefixes.                                                                                                                   | No universal mandate to enable Gitflow-style long-lived branches.                                                                       |
| Azure Repos                      | Recommends consistent conventions and offers owner- and type-based examples.                                                                            | No single preferred example and no issue-ID-in-name requirement for Azure Boards' explicit linking flow.                                |
| Linear                           | Configurable copied branch format; requires issue ID for branch-name auto-linking.                                                                      | The fetched text does not expose one universal default template or prescribe type/user prefixes.                                        |
| GitHub Copilot cloud agent       | Product prefix plus descriptive slug is documented; one branch/one PR per task.                                                                         | No claim that other agents should use `copilot/` or put model identity in names.                                                        |
| Claude Code                      | `.claude/worktrees/<name>` and `worktree-<name>`; random phrase if unnamed; remote default branch as fresh base.                                        | No issue-ID convention; the generated branch is a workspace default, not stated as a team-wide naming recommendation.                   |
| OpenAI Codex app                 | Managed worktrees use detached HEAD by default; user creates a branch when desired.                                                                     | No default durable branch-name grammar in the cited worktree documentation.                                                             |
| Devin                            | Supports multiple sessions/integrations and first-class stacked PRs.                                                                                    | The reviewed first-party pages do not prescribe a general Devin branch-name format.                                                     |

## Recommended policy template (synthesis)

A team adopting human and agent-concurrent work can use this policy as a starting point:

1. **Grammar:** ASCII letters/digits plus `-` and at most one or two `/` namespace separators; no spaces or shell metacharacters. Lowercase descriptive words; preserve canonical tracker-key case.
2. **Shape:** `[type/]<issue-id>-<short-slug>[-<scope-or-attempt>]`, modified where an integration requires the ID first.
3. **Types:** a small allowlist whose entries have defined workflow meaning, for example `feature`, `fix`, `docs`, `chore`, `hotfix`, `release`.
4. **Traceability:** require issue IDs only for tracked work or when an integration parses them; maintain explicit PR/issue links too.
5. **Ownership:** omit usernames and agent/model names unless a namespace drives permissions, routing, or collision control.
6. **Base:** resolve the repository's actual default/target branch; allow an explicitly declared integration or stack base.
7. **Concurrency:** one write-capable task/session per worktree and per branch. Use detached worktrees for disposable exploration.
8. **Fan-out:** prefer sub-issue IDs; otherwise add a stable scope/layer suffix. Use a short session/attempt suffix only when needed to avoid collision.
9. **Creation:** normalize deterministically, truncate only the slug under the team's documented local cap, validate with `git check-ref-format --branch`, enforce host rules, and fail safely on an existing ref.
10. **Security:** regard all branch names as attacker-controlled in CI and exclude secrets and sensitive personal/customer information.
11. **Lifecycle:** merge through reviewed PRs/MRs, retain agent/session provenance outside the branch name, then clean up merged branches and worktrees according to repository policy.

The decisive principle is: **encode stable work identity and workflow semantics, not incidental executor identity**. AI concurrency increases the need for isolation, unique refs, and automation-safe generation; it does not overturn the traditional value of short, descriptive, issue-linked topic branches.
