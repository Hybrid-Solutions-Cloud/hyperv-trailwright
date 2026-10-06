# Stage ordering and resume review

Version: 0.3.0. Updated: 2026-09-11.

The **Automation and handoff** section collects named implementation stages, explicit targets, prerequisites, executor, consumer version, runner, acceptance checks and observations. Its stage review shows what needs operator attention before each handoff. This version does not submit jobs, resolve credentials, independently verify runtime receipts or qualify deployment adapters.

## Entering targets and prerequisites

Use resource IDs shown in the component and inventory records. Target lists may contain comma-, semicolon- or whitespace-separated UUIDs. A JSON string array also works and preserves custom IDs containing spaces. `dependsOn` uses stage record IDs in the same format. A stage's order number is a display preference; explicit prerequisite links determine the computed waves.

Targets must resolve to active design resources. A deleted resource, inactive SDN target, missing prerequisite, duplicate reference, self-reference or dependency cycle creates a finding. Cycles and missing references block affected stages and their descendants while independently ordered stages remain visible.

## Review states

| Review state | Meaning |
| --- | --- |
| Blocked | Required details or target references are missing, ordering is unresolved, or a prerequisite lacks consistent reported completion |
| Reported passed | The entered stage status is passed, its evidence reference and timezone-bearing ISO timestamp are present, and its prerequisites satisfy the same consistency checks |
| In progress | The entered observation says running; the configurator neither polls nor restarts it |
| Review failure | Failure evidence and a recovery/resume procedure are recorded; the responsible operator must review the next action |
| Awaiting operator | Prerequisite observations are consistent and a manual task awaits its operator |
| Handoff candidate | Stage details include a named consumer, pinned version and runner; actual qualification and execution authorization remain separate |

Reported completion is not independently verified deployment success. An evidence URL or entered timestamp is not an authenticated runtime receipt. Stage plans always export `automationReady: false` and `executionState: not_executed_by_configurator` while the execution integration remains unfinished.

An entered passed/running state cannot skip an incomplete prerequisite. A failed stage never becomes an automatic retry. OME installation requires an operator even when the stage is labelled general management installation.

## Export and persistence

The package contains `plans/stage-plan.json`, with project identity/revision, deterministic prerequisite waves, target IDs, blocked stages, observations, next-review states and findings. The implementation Markdown report includes the same summary. Existing schema 2 stage answers remain compatible; no schema migration is required for this derived plan.

Sanitized exports remap stage and target IDs along with the rest of the design. Invalid or removed references are omitted from the sanitized copy; the original project is unchanged. Evidence descriptions and observations are replaced by sharing placeholders, so the sanitized plan may require renewed evidence review and must never be used as an execution authorization.

## Remaining execution work

The full goal still includes immutable reviewed execution requests, qualified named adapters, bounded runtime authorization, authenticated evidence import, job polling/resume integration and as-built/drift reconciliation. These consistency checks establish a useful handoff but do not substitute for those capabilities.
