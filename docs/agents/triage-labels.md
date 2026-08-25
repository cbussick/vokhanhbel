# Matt Pocock triage roles in Linear

Matt Pocock's skills speak in canonical triage roles. In this repository, translate those roles into Linear's native fields using the table below. The role names are skill vocabulary, not additional tracker states.

Linear status is the sole issue lifecycle. Assignment records ownership, native relations record blockers and duplicates, and labels classify the work.

## Triage role mapping

| Canonical role | Linear representation |
| --- | --- |
| `needs-triage` | Keep the issue in Linear's native Triage inbox. If native Triage is unavailable, use Backlog. |
| `needs-info` | Backlog, with one specific unanswered question in the newest comment. |
| `ready-for-agent` | Todo, unassigned, and unblocked. Parent specs and Wayfinder maps are never implementation-frontier issues. |
| `ready-for-human` | Todo and assigned to the responsible human. |
| `wontfix` | Canceled, with the reason recorded in a comment. |

When a Matt Pocock skill says to apply, remove, or inspect a triage role, read or update the corresponding Linear fields above. Do not apply a `triage-state` label.

Linear's `In Progress`, `Done`, and `Duplicate` statuses retain their native meanings. Claiming agent work means assigning the current Linear user and moving the issue from Todo to In Progress. Native blocking and duplicate relations remain authoritative.

## Work-kind labels

Apply exactly one stable classification label when triaging a raw request:

| Canonical category | Linear label | Meaning |
| --- | --- | --- |
| `bug` | `defect` | Existing behaviour is broken |
| `enhancement` | `enhancement` | New behaviour or an improvement |

The workspace-default `Bug`, `Feature`, and `Improvement` labels are outside this project workflow.

## Wayfinder labels

Wayfinder labels identify the purpose of an issue; they do not represent lifecycle state:

- `wayfinder:map`
- `wayfinder:research`
- `wayfinder:prototype`
- `wayfinder:grilling`
- `wayfinder:task`

The four decision-ticket labels are mutually exclusive. `wayfinder:map` applies only to the parent map issue.
