# Issue tracker: Linear

Issues and specs for this repository live in the Linear workspace `vokhanhbel` and team `Vokhanhbel`, whose key is `VOK`. Agents access Linear through the configured Linear MCP server. GitHub remains the source-code and pull-request host.

Before the first tracker mutation in a session, resolve the workspace and team through Linear rather than inventing an identifier. Resolve the team key before creating an issue branch.

## Required capability check

Before creating or updating tracker data, confirm that the loaded Linear tools support every required operation: reading and creating issues, setting parent relationships, applying labels and statuses, creating blocking relations, and adding comments.

If a required operation is unavailable, report the missing capability. Do not claim that an update succeeded, create duplicate objects, or silently replace native structure with prose.

## Reading issues

- Resolve a full Linear identifier or URL directly within the `vokhanhbel` team.
- Search the team when the user supplies a title or incomplete identifier; ask only when matches are genuinely ambiguous.
- Before acting, read the full description, comments, status, labels, assignee, parent and children, project, and blocking relations.
- Issue descriptions are the source of scope and acceptance criteria. Comments record discussion, decisions, blockers, and verification evidence; they do not silently replace the description.

## Specs and implementation tickets

- `/to-spec` creates one top-level spec issue in Todo. Its description is the canonical spec. The parent is planning structure, not an implementation ticket.
- `/to-tickets` creates one unassigned Todo child issue per approved tracer-bullet ticket.
- Create all child issues first, then add native blocking relations in a second pass after real issue identifiers exist.
- Do not invent dependencies that were not in the approved ticket breakdown.
- Do not close or otherwise modify the parent spec issue while publishing tickets.

Linear Projects are optional. Create or use a Project only when dates, milestones, progress reporting, documents, updates, multiple delivery waves, or cross-team coordination add real value. If a Project is used, add the canonical spec issue and its children to it; do not maintain a second independently edited copy of the spec.

## Implementation frontier and claiming

An implementation ticket is on the frontier when it is:

- in Todo;
- a leaf issue, not a parent spec or Wayfinder map;
- unblocked because every blocking issue is complete; and
- unassigned.

Prefer an issue explicitly named by the user. When selecting autonomously, claim a frontier ticket before changing code: assign the current Linear user, move it to In Progress, and create a branch containing the Linear issue key. Skip assigned or In Progress work unless the user explicitly names it.

## Completion

Add one concise final comment containing verification and review evidence plus the branch, commit, or pull-request reference.

- When work uses a pull request, let the Linear GitHub integration move the issue to Done on merge; the agent must not race that automation.
- When work lands through a direct commit, move the issue to Done only after acceptance criteria have evidence, verification passes, code review finishes, and the commit exists.
- Parent auto-close may be enabled if desired. Do not enable sub-issue auto-close: closing a parent must not mark unfinished tickets complete.

## Triage

Triage is only for raw incoming bugs and requests. Specs and tickets created by `/to-spec` and `/to-tickets` are already Todo and must not be triaged again.

Translate Matt Pocock's canonical triage roles through `triage-labels.md`. In this repository they map to Linear status and assignment, not to a second lifecycle made of labels. Apply exactly one work-kind label (`defect` or `enhancement`).

Pull requests are not an incoming triage surface.

## Wayfinding operations

Used by `/wayfinder`:

- **Map:** one Todo parent issue labelled `wayfinder:map`. Its description contains Destination, Notes, Decisions so far, Not yet specified, and Out of scope.
- **Decision ticket:** one unassigned Todo child issue of the map, labelled with exactly one of `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`, or `wayfinder:task`.
- **Blocking:** native Linear blocking relations between decision tickets.
- **Frontier:** open, unassigned child issues whose blockers are complete.
- **Claim:** assign the current Linear user and move the child issue to In Progress before doing any work.
- **Resolve:** add the full answer as a comment, move the child issue to Done, then add only a one-line gist and issue link under Decisions so far in the map description.

The map is an index, not a second copy of its decisions. Wayfinder produces decisions and hands off to `/to-spec`; it does not implement the resulting feature.
