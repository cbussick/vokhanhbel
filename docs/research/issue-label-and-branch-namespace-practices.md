# Issue-label taxonomies and Git branch namespaces

**Accessed:** 2026-09-05

**Source policy:** Primary sources only: official product documentation and first-party project repositories/governance guides. Product behavior can change. Statements labelled **synthesis** or **recommendation** are conclusions across sources rather than rules stated by one vendor.

## Scope and evidence boundary

This report researches public practice. The Linear MCP server is unavailable in this session, so no private Linear workspace, team, label list, label group, template, or automation was inspected. The Vokhanhbel-specific inventory below comes only from this repository's checked-in workflow documents: they say the project uses `defect` and `enhancement`, treats Linear status as the sole lifecycle, and uses parent specs with implementation sub-tickets. References here to Linear product behavior come from public Linear documentation, not from the private workspace.

## Executive conclusions

1. **Work kind should be one stable answer to “what class of work is this?”** Products increasingly provide a native single-valued type: GitHub defaults to `task`, `bug`, and `feature`; Jira provides Bug, Task, and Story; Azure Boards provides process-specific work-item types; and GitLab separates hierarchical work-item types from labels. Where labels carry type, Linear label groups and GitLab scoped labels can enforce one value per group. [GitHub issue types](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/managing-issue-types-in-an-organization), [Jira work types](https://support.atlassian.com/jira-software-cloud/docs/set-up-issue-types-in-team-managed-projects/), [Azure work-item types](https://learn.microsoft.com/en-us/azure/devops/boards/work-items/about-work-items?view=azure-devops), [GitLab work items](https://docs.gitlab.com/user/work_items/), [Linear label groups](https://linear.app/docs/labels)
2. **Do not overload type with lifecycle, priority, area, ownership, effort, or process.** Mature systems expose these as separate fields or visibly namespaced facets. Kubernetes explicitly separates `kind/`, `priority/`, `sig/`, `area/`, `lifecycle/`, and merge-process labels; Rust separates category (`C-*`), team (`T-*`), area (`A-*`), priority (`P-*`), status (`S-*`), and calls for participation/estimated difficulty (`E-*`). [Kubernetes triage guide](https://www.kubernetes.dev/docs/guide/issue-triage/), [Kubernetes label source](https://github.com/kubernetes/test-infra/blob/master/label_sync/labels.yaml), [Rust issue triage](https://forge.rust-lang.org/release/issue-triaging.html)
3. **Branch names should encode stable work identity and a small operational namespace, not mirror every tracker field.** Linear and Jira parse issue keys from branch names; GitLab's native issue linking requires the numeric issue number at the beginning. GitHub and Azure Boards can persist explicit issue-to-branch links without a type token in the name. [Linear GitHub integration](https://linear.app/docs/github#linking-linear-issues-to-github-prs), [Jira development references](https://support.atlassian.com/jira-software-cloud/docs/reference-issues-in-your-development-work/), [GitLab branches](https://docs.gitlab.com/user/project/repository/branches/#prefix-branch-names-with-a-number), [GitHub issue branches](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-a-branch-for-an-issue), [Azure Boards development links](https://learn.microsoft.com/en-us/azure/devops/boards/backlogs/connect-work-items-to-git-dev-ops?view=azure-devops)
4. **For Vokhanhbel, retain the two existing work-kind labels and the four existing branch prefixes.** Make `defect` and `enhancement` a mutually exclusive `Type` group if the private inventory confirms that this can be done without duplication. Keep `feature/`, `fix/`, `docs/`, and `chore/` as a deliberately richer projection of the branch's deliverable. Do not add `refactor/`, `security/`, `hotfix/`, `release/`, or `spike/` now.

## Keep the taxonomy dimensional

| Dimension             | Question answered                              | Preferred representation                          | Stability/cardinality                            |
| --------------------- | ---------------------------------------------- | ------------------------------------------------- | ------------------------------------------------ |
| **Work kind/type**    | What class of outcome is requested?            | Native type, or one grouped label                 | Stable; exactly one for ordinary delivery work   |
| **Lifecycle status**  | Where is it in the workflow?                   | Native status/state                               | Mutable; exactly one                             |
| **Priority/severity** | How urgently/impactfully should it be handled? | Native priority; severity field if needed         | Mutable; one value per scale                     |
| **Area/component**    | What product/code area is affected?            | Component/team field or namespaced labels         | Usually stable enough; often multi-valued        |
| **Ownership**         | Who is accountable?                            | Assignee/team/component owner                     | Mutable; never inferred from type or branch name |
| **Effort**            | How large or uncertain is it?                  | Estimate/weight/effort field                      | Mutable as knowledge improves                    |
| **Special process**   | Does an exceptional workflow apply?            | Explicit, narrowly defined label/relation/process | Often temporary; may be multi-valued             |

This separation is reflected directly in current products. Linear reserves label names such as `assignee`, `effort`, `estimate`, `priority`, `state`, and `status` because those duplicate native features. GitHub now offers structured single-select issue fields and creates Priority and Effort fields by default when issue fields are enabled. Azure's common fields include Assigned To, State, Area, and Iteration, while tags remain custom filtering categories. Jira's work type is separate from free-form labels and components; components may have owners and auto-assignment. [Linear labels](https://linear.app/docs/labels), [GitHub issue fields](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/managing-issue-fields-in-your-organization), [Azure work items](https://learn.microsoft.com/en-us/azure/devops/boards/work-items/about-work-items?view=azure-devops), [Jira label fields](https://support.atlassian.com/jira-software-cloud/docs/available-custom-fields-for-team-managed-projects/), [Jira components](https://support.atlassian.com/jira-software-cloud/docs/what-are-jira-components/)

## Product defaults and guidance

### Linear

Public Linear docs describe labels as issue categories and recommend workspace-level labels for concepts shared by all teams, using “Bug” as the example. Label groups provide one nesting level, and **only one label from a group can be applied to an issue at a time**. Labels have descriptions; obsolete labels can be archived while remaining on historical issues and in filters. Linear's public page does not enumerate a universal default work-kind set, so this report does not claim one. [Linear labels](https://linear.app/docs/labels)

Linear distinguishes the issue's team workflow, assignment, project, cycle, labels, and priority. Its GitHub integration links a pull request when the Linear issue ID appears in the branch name; the copied branch format is configurable. Thus the stable issue key is the integration-bearing token, while a type prefix is a team convention. [Linear concepts](https://linear.app/docs/conceptual-model), [Linear GitHub integration](https://linear.app/docs/github#linking-linear-issues-to-github-prs)

For hierarchy, Linear explicitly says sub-issues inherit team, priority, and project (and sometimes cycle), but **labels are not inherited**. Creating repeated sub-issues with the same values is an explicit shortcut, not automatic parent inheritance. Parent and sub-issue status propagation is separately configurable. [Linear parent and sub-issues](https://linear.app/docs/parent-and-sub-issues)

### GitHub

GitHub now has organization-level issue types, with defaults `task`, `bug`, and `feature`; one issue type is applied to an issue. Types may be edited, disabled, or deleted. This is the strongest current signal that work kind belongs in a single structured field rather than an open-ended pile of labels. [GitHub issue types](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/managing-issue-types-in-an-organization)

GitHub also still creates repository labels by default: `accessibility`, `bug`, `documentation`, `duplicate`, `enhancement`, `good first issue`, `help wanted`, `invalid`, `question`, and `wontfix`. This list mixes dimensions: `bug`/`enhancement`/`documentation` are kinds, `accessibility` is a concern, `good first issue` and `help wanted` are contributor process, and `duplicate`/`invalid`/`wontfix` are dispositions. Labels are repository-scoped and freely combinable; the label system itself does not create mutually exclusive groups. [GitHub labels](https://docs.github.com/en/issues/using-labels-and-milestones-to-track-work/managing-labels)

When issue fields are enabled, GitHub creates Priority (`Urgent`, `High`, `Medium`, `Low`) and Effort (`High`, `Medium`, `Low`) as separate single-select fields. This avoids duplicating those concepts in labels. [GitHub issue fields](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/managing-issue-fields-in-your-organization)

GitHub sub-issue creation asks the author to set type, assignees, labels, projects, and milestones on the child; the cited page documents no automatic label/type inheritance. Its issue-branch feature stores an explicit relationship, permits multiple branches per issue, and lets the author edit the branch name; no issue-number or type prefix is required by that feature. [GitHub sub-issues](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/adding-sub-issues), [GitHub issue branches](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-a-branch-for-an-issue)

### GitLab

GitLab's generated default label set is `bug`, `confirmed`, `critical`, `discussion`, `documentation`, `enhancement`, `suggestion`, and `support`. Like GitHub's legacy defaults, it mixes work kind, validation state, priority, and intake/disposition. GitLab's modern work-item model separately represents Issue, Incident, Task, Epic, Objective, Key Result, and Test case; ordinary Issues may track tasks, features, and bugs. [GitLab labels](https://docs.gitlab.com/user/project/labels/#generate-default-project-labels), [GitLab work items](https://docs.gitlab.com/user/work_items/)

Scoped labels use `key::value`; adding a second value for the same key replaces the first. GitLab explicitly demonstrates `priority::low` versus `priority::high` and `workflow::*`, making scoped labels suitable where no native field exists and exclusivity matters. Labels may be archived to preserve historical use. [GitLab scoped labels](https://docs.gitlab.com/user/project/labels/#scoped-labels)

GitLab's issue-branch default is `%{id}-%{title}`. Native cross-linking requires the same-project branch to **start** with the numeric issue/task number followed by a hyphen (`123-...`). A generic `feature/123-...` convention would break this particular integration path. Type-oriented examples (`feature/*`, `bug/*`, `release/*`) appear in target-branch workflow configuration, but are optional routing conventions rather than a reflection of issue labels. [GitLab branches](https://docs.gitlab.com/user/project/repository/branches/)

### Jira / Atlassian

Jira uses native work types. Team-managed software spaces offer Epic, Bug, Task, Story, and Subtask: Bug is software trouble; Story captures feature requests/development expressed as user goals; Task covers miscellaneous work such as technical investigations or administration. Work types support distinct fields, workflow, search, reporting, and hierarchy. Jira labels, by contrast, are reusable free-form snippets for filtering and reporting. [Jira work types](https://support.atlassian.com/jira-software-cloud/docs/set-up-issue-types-in-team-managed-projects/), [Jira label fields](https://support.atlassian.com/jira-software-cloud/docs/available-custom-fields-for-team-managed-projects/)

Components are a separate area/workstream dimension and may carry a component owner and auto-assignment. This is direct evidence against encoding component or ownership in the work type. [Jira components](https://support.atlassian.com/jira-software-cloud/docs/what-are-jira-components/)

For development linking, Jira instructs teams to include the canonical, correctly capitalized key in the branch name, e.g. `JRA-123-<branch-name>`, and also in commit messages and pull-request titles. It does **not** require a work-type prefix. [Jira development references](https://support.atlassian.com/jira-software-cloud/docs/reference-issues-in-your-development-work/)

### Azure DevOps

Azure Boards uses native work-item types determined by the chosen process. In the Agile process, User Stories and Tasks track work, Bugs track defects, and Features/Epics group larger scenarios. The hierarchy is Epic → Feature → Requirement/User Story → Task, with Bugs configurable at requirement or task level. Assignment, State, Area, Iteration, and tags are distinct fields. [Azure work items](https://learn.microsoft.com/en-us/azure/devops/boards/work-items/about-work-items?view=azure-devops), [Azure Agile process](https://learn.microsoft.com/en-us/azure/devops/boards/work-items/guidance/agile-process?view=azure-devops)

Azure tags are project-wide custom labels and are multi-valued; Microsoft presents them as filtering categories (for example `regression`, `payment-flow`, `mobile`, `accessibility`), not as a replacement for work-item type. [Azure tags](https://learn.microsoft.com/en-us/azure/devops/boards/queries/add-tags-to-work-items?view=azure-devops)

Azure Repos recommends a simple branching strategy and calls all short-lived topic branches “feature branches,” including branches for fixes. Suggested names include `bugfix/description`, `feature/feature-name`, and `hotfix/description`. Azure Boards can explicitly link a named branch to one or several work items, so embedding either work-item ID or kind is not required for that flow. [Azure Git branching guidance](https://learn.microsoft.com/en-us/azure/devops/repos/git/git-branching-guidance?view=azure-devops), [Azure Boards development links](https://learn.microsoft.com/en-us/azure/devops/boards/backlogs/connect-work-items-to-git-dev-ops?view=azure-devops)

## Mature public project taxonomies

### Kubernetes

Kubernetes uses visible namespaces as facets rather than one flat vocabulary:

- `kind/bug`, `kind/feature`, `kind/documentation`, `kind/cleanup`, `kind/api-change`, `kind/regression`, and others classify nature;
- `priority/*` carries urgency;
- `sig/*`, `wg/*`, and `area/*` carry organizational ownership/relevance and component scope;
- `lifecycle/*` tracks activity/staleness;
- `triage/*`, `needs-*`, `do-not-merge/*`, `approved`, `lgtm`, `release-note*`, and `size/*` drive special triage, review, release-note, merge, or measured-size processes.

The source-controlled label registry also records descriptions, targets (issue/PR/both), automation, who can apply a label, previous names, and deprecation dates. The registry shows `kind/feature` replaced both plain `enhancement` and `kind/enhancement`, and `kind/cleanup` absorbed technical-debt variants—evidence that mature taxonomies evolve through explicit aliases/migrations rather than casual deletion. [Kubernetes label registry](https://github.com/kubernetes/test-infra/blob/master/label_sync/labels.yaml)

The triage guide treats issue kind, priority, and SIG ownership as separate triage steps. It requires a kind on PRs through automation, but the namespace itself is not a mechanical mutual-exclusion feature comparable to Linear groups or GitLab scopes; multiple relevant SIG/area labels are expected. [Kubernetes triage guide](https://www.kubernetes.dev/docs/guide/issue-triage/)

Kubernetes's public contribution guidance discusses small topic branches/PRs and uses kind or area words in commit subjects, but it does not establish a repository-wide rule that branch prefixes mirror `kind/*`. That absence matters: a detailed issue taxonomy need not become a detailed branch taxonomy. [Kubernetes pull-request guide](https://www.kubernetes.dev/docs/guide/pull-requests/)

### Rust

Rust's `rust-lang/rust` triage guide explicitly describes a multi-axis vocabulary: category `C-*` (for example `C-bug`, `C-discussion`, `C-tracking-issue`), team `T-*`, area `A-*`, target/platform `O-*`, priority `P-*`, status `S-*`, issue nature `I-*`, calls for participation and rough difficulty `E-*`, plus regression, feature-gate, backport, release-note, and decision-process labels. It says `T-*` and `C-*` are the most important initial triage labels and acknowledges that the set changes according to project needs. [Rust issue triage](https://forge.rust-lang.org/release/issue-triaging.html)

Rust automation illustrates selective exclusivity rather than a claim that every prefix is exclusive. Triagebot swaps `S-waiting-on-author` and `S-waiting-on-review`, and its regression shortcuts remove competing regression-range labels. At the same time, the guide expects multiple team and area labels when an issue crosses concerns. [Rust triagebot configuration](https://github.com/rust-lang/rust/blob/master/triagebot.toml), [Rustbot guide](https://rustc-dev-guide.rust-lang.org/rustbot.html)

Rust's taxonomy is effective for a huge, multi-team compiler project, but its roughly thousand labels and specialized automation are not evidence that a small private application should copy that breadth. The transferable practice is explicit namespaces, descriptions, and automation for dimensions that genuinely need them.

## Vocabulary comparison

| Vocabulary                | Best interpretation                                                                                                      | Recommendation for a small team                                                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `feature` / `enhancement` | New capability versus broader improvement; often used interchangeably (`kind/feature` replaced Kubernetes `enhancement`) | Choose one tracker term. Keep Vokhanhbel's `enhancement`; use `feature/` only as the branch namespace.                                                                        |
| `bug` / `defect` / `fix`  | Bug/defect names the problem; fix names the change                                                                       | Keep tracker `defect`; use branch `fix/`. Do not add synonym labels.                                                                                                          |
| `docs` / `documentation`  | A deliverable/content surface, sometimes a work kind                                                                     | Keep `docs/` as a branch scope. With only two tracker kinds, classify wrong docs as `defect` and additive/improved docs as `enhancement`.                                     |
| `chore` / `maintenance`   | Internal upkeep with no intended product behavior change                                                                 | Keep `chore/` as a branch scope; treat the tracked improvement as `enhancement` unless it repairs broken behavior (`defect`).                                                 |
| `refactor`                | Implementation technique: structural change intended to preserve behavior                                                | Do not make it a top-level work kind or branch prefix. Use `chore/` when standalone; otherwise keep the outcome prefix (`feature/` or `fix/`).                                |
| `security`                | Cross-cutting risk/process concern, not an outcome type                                                                  | Do not encode in public labels/branch names by default. Use the security reporting/remediation process; once safe to track, choose `defect`/`fix` or `enhancement`/`feature`. |
| `release` / `hotfix`      | Delivery lane and urgency; useful only when release branches or emergency routing exist                                  | Vokhanhbel deploys `main`; do not add either namespace now. Use `fix/` plus native priority for urgent defects.                                                               |
| `research` / `spike`      | Time-bounded uncertainty reduction; often produces a decision rather than shipped behavior                               | Keep in the existing `wayfinder:*` process labels. A durable report uses `docs/`; a mergeable prototype uses the eventual outcome prefix or `chore/`.                         |

## Cross-cutting answers

### Should work-kind labels be mutually exclusive or grouped?

**Yes, if they claim to be the canonical work kind.** Linear label groups and GitLab scoped labels enforce this directly, while GitHub issue type, Jira work type, and Azure work-item type are naturally single-valued. Multiple kinds such as `bug` + `feature` make reporting and branch mapping ambiguous. If work genuinely contains two outcomes, split it or select the dominant acceptance outcome. Keep orthogonal concern/process labels multi-selectable. [Linear labels](https://linear.app/docs/labels), [GitLab scoped labels](https://docs.gitlab.com/user/project/labels/#scoped-labels)

### Should they be stable?

**Yes.** A kind may be corrected during triage, but it should not change merely because work moved from Todo to In Progress or became urgent. Use native lifecycle and priority for those changes. Prefer archive/disable over destructive deletion: Linear and GitLab preserve archived labels on historical items; GitHub disabling an issue type preserves its display if later re-enabled, whereas deletion is permanent. [Linear labels](https://linear.app/docs/labels#archive-labels), [GitLab archived labels](https://docs.gitlab.com/user/project/labels/#archived-labels), [GitHub issue types](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/managing-issue-types-in-an-organization#making-changes-to-issue-types)

### Should children inherit the parent's kind?

**Do not assume inheritance; classify each ticket explicitly.** Linear specifically does not inherit labels. GitHub's documented child creator exposes child metadata for explicit selection and does not promise inheritance. The reviewed Jira, GitLab, and Azure sources do not establish automatic label/type inheritance as a general rule. A child often shares its parent's outcome, but a docs-only or maintenance child can have a different implementation scope. Inheritance automation, if introduced, should prefill rather than silently lock the value. [Linear parent and sub-issues](https://linear.app/docs/parent-and-sub-issues), [GitHub sub-issues](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/adding-sub-issues)

### Should kind be encoded in branch names?

**Encode a small, stable projection only when it helps humans or automation.** The issue key is more important for traceability: Linear and Jira parse it, and GitLab has its own stricter ID-first grammar. Branch names should not encode status, priority, assignee, estimate, component lists, or temporary process labels because those change while a branch remains. Type prefixes are useful when they route CI/protection/targets or make lists scannable, but vendor practice is not uniform: Azure calls fixes feature/topic branches, while GitHub and Azure can link branches explicitly. [Linear GitHub integration](https://linear.app/docs/github#linking-linear-issues-to-github-prs), [Jira development references](https://support.atlassian.com/jira-software-cloud/docs/reference-issues-in-your-development-work/), [GitLab branches](https://docs.gitlab.com/user/project/repository/branches/), [Azure Git branching guidance](https://learn.microsoft.com/en-us/azure/devops/repos/git/git-branching-guidance?view=azure-devops)

## Recommendation for Vokhanhbel

### 1. Minimal tracker taxonomy

Retain exactly two canonical work-kind labels:

| Linear label  | Definition                                                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `defect`      | An observed or specified existing behavior, contract, or documentation statement is wrong, missing when already promised, unsafe, or regressed.         |
| `enhancement` | An intentional new capability or improvement, including planned maintenance and additive documentation, where existing promised behavior is not broken. |

This preserves the repository's established vocabulary and avoids synonyms (`bug`, `fix`, `feature`, `improvement`) in the tracker. If private inspection later confirms that the labels are ungrouped, put them in a Linear `Type` label group so exactly one can apply. Do not create duplicates merely to achieve grouping; use Linear's supported move/merge controls after inventory. Give both labels precise descriptions.

Apply a kind explicitly to each ordinary parent spec and each implementation ticket; Linear will not inherit it. Normally children share the parent's acceptance outcome. Reclassify only when the child's independently reviewable outcome differs—not because its implementation happens to refactor code or edit docs. Parent specs remain planning structures, not implementation tickets; their kind describes the overall requested outcome.

Do **not** force these two labels onto Wayfinder maps/decision tickets. Their existing mutually exclusive `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`, and `wayfinder:task` labels describe a pre-delivery decision process. Classify the resulting spec and implementation tickets when the delivery outcome is known.

Continue to represent:

- lifecycle with Linear status only;
- ownership with assignment;
- blockers/duplicates with native relations and status;
- priority and effort with native fields;
- area/component only if repeated filtering needs justify a small separate group;
- special process with narrowly defined labels such as `wayfinder:*`.

### 2. Branch-prefix policy

Keep the checked-in branch shape:

```text
<type>/<issue-key>-<short-slug>
```

and its four-prefix allowlist:

| Prefix     | Use                                                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `feature/` | New or improved product behavior; also every parent-spec integration branch                                                                |
| `fix/`     | Repair of broken promised behavior                                                                                                         |
| `docs/`    | Documentation-only deliverable                                                                                                             |
| `chore/`   | Internal maintenance with no product behavior or documentation deliverable: refactors, dependency/CI/tooling upkeep, mergeable experiments |

This is intentionally **not** a one-to-one copy of the two-label tracker taxonomy. It gives branches enough operational information without expanding the canonical tracker kind:

- `defect` normally maps to `fix/`, but a documentation-only correction maps to `docs/`;
- `enhancement` normally maps to `feature/`, while docs-only work maps to `docs/` and internal maintenance maps to `chore/`;
- a parent spec's integration branch remains `feature/` because it is the assembly lane for the outcome, regardless of the mix of child branches;
- every child ticket uses its **own** `VOK-*` key on its branch, not only the parent's key, and targets the parent integration branch under the checked-in workflow.

Do not add:

- `refactor/`: technique, covered by `chore/` or the enclosing outcome;
- `security/`: leaks a concern into durable operational metadata and does not say whether the change fixes or adds behavior;
- `hotfix/`: urgency belongs in priority and expedited process; use `fix/`;
- `release/`: unnecessary without a release-branch model;
- `research/` or `spike/`: Wayfinder records the process; use `docs/` for a durable report, `chore/` for a mergeable internal prototype, or no durable branch for disposable exploration.

Examples:

```text
feature/vok-120-add-review-filter
fix/vok-121-reject-expired-session
docs/vok-122-document-restore-drill
chore/vok-123-refactor-speech-provider
```

Keep the lowercase issue key form already accepted by the Linear integration and repository policy, preserve the full key, validate with `git check-ref-format --branch`, and continue treating names as non-sensitive operational metadata. The evidence for those mechanics is covered in the existing [branch-naming research](branch-naming-best-practices.md).

### 3. Governance and migration

1. Inventory the private Linear team when MCP access returns; do not infer its labels from vendor defaults.
2. Confirm `defect` and `enhancement` IDs, descriptions, scope, use counts, and whether they already belong to a group.
3. Merge/archive synonyms instead of deleting history. Avoid introducing GitHub/Linear defaults such as `Bug`, `Feature`, or `Improvement` into this project workflow.
4. Add a validation view/query for ordinary delivery issues with zero or more than one work-kind label. Exclude Wayfinder decision structures deliberately.
5. Review the taxonomy after real ambiguous cases accumulate. Add a third kind only when it changes routing/reporting often enough to justify migration; do not add labels merely because a word is familiar from commit conventions.

## Bottom line

Contemporary trackers converge on a small single-valued type plus separate structured dimensions. Large public projects add many labels because they need cross-team routing and automation, but they namespace those facets instead of treating every label as a work kind. For Vokhanhbel, the minimal defensible policy is therefore: **one of `defect` or `enhancement` on ordinary specs/tickets; explicit classification on every child; native fields for status, priority, ownership, and effort; and the existing four branch prefixes as a small operational projection rather than a mirror of the label set.**
