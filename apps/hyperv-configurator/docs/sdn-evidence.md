# Returned SDN acceptance evidence

Version 0.30.0 can import externally collected SDN observations and compare them with the exact design requested for testing. It never runs infrastructure commands or marks setup stages complete. A passed observation is unsigned operator evidence, not native adapter qualification or proof of ongoing health.

## Record and import results

1. Complete the SDN design and resolve its fabric findings. Open **SDN design and setup → SDN acceptance evidence**.
2. Download the acceptance request and result template. The request contains the scoped design, its SHA-256, required scenarios and exact target IDs. Keep this request with the external test records.
3. Run separately authorized tests in the intended environment. The Configurator does not provide that authorization or execute the template.
4. Fill in a unique run ID, actual UTC observation time, operator, runner name/version and source endpoint. Echo the request's project ID and scope hash unchanged.
5. For each result, record its scenario, unique result ID, covered target IDs, expected behavior, actual observation and an artifact reference. Use `passed`, `failed` or `not-run`. Results may split a scenario across multiple target subsets within one run. Every required target needs a passed observation for complete coverage. Never change the template's `not-run` values without corresponding observations.
6. Import the result JSON. Review coverage and provenance, save the project, and download the package to retain the original source bytes and reports.

Evidence references are identifiers or locations supplied by the operator. They are not fetched or independently authenticated. Keep passwords, tokens and signed access URLs out of the result file.

## Meaning of the review

| Status | Meaning |
|---|---|
| Missing | No imported result matches a currently requested observation |
| Partial | The latest matching run lacks scenarios, target coverage or completed tests |
| Failed | The latest matching run contains a failed result |
| Passed-observation | All required scenarios and targets have passed observations in one matching run, and the SDN fabric design has no blocking findings |
| Design-unresolved | Observations cover the request, but fabric findings still need correction |
| Stale | Design scope differs, the observation is more than seven days old, or the current assessment clock precedes the observation |
| Ambiguous | Multiple distinct matching runs have exactly the same observation timestamp; collect a newer unambiguous result |
| Inactive | SDN is disabled; retained history does not establish active acceptance |

Only the latest matching run contributes to coverage. Separate partial runs are not combined into a complete run. Older imports remain in history. Editing a design back to the exact tested scope can restore a matching observation while it remains within the seven-day review window. That does not establish the current state of the infrastructure.

## Scope and integrity

The scope includes active SDN choices, all SDN objects, forward resource references and relevant host/cluster/storage/identity child bindings. Record order is normalized. Inactive conditional answers, project revision/timestamps, evidence history, project title/customer notes and unrelated licensing or stage records do not change the scope hash. Referenced resource properties are deliberately included so a network, placement or prerequisite change requires renewed review.

Imports are limited to 512 KiB, 1–1000 result records and 1000 unique targets per result. A project may retain at most 20 imports within the existing 2 MiB project limit. Unknown fields, invalid UTC dates, future observations, mismatched project/scope, unexpected scenarios/targets and duplicate import IDs/hashes are rejected. Schema 26 upgrades older projects with empty evidence history.

The original UTF-8 text is retained, including a BOM and whitespace. Reopening a project checks its stored SHA-256 and compares the parsed source against the retained results. These checks detect inconsistencies; a hash is not a signature and does not authenticate the operator or runner. Sanitized sharing removes evidence and original files entirely.

## Package files

- `sdn/acceptance-request.json` and `sdn/result-template.json`: current request and unexecuted template.
- `sdn/evidence/source-N.json`: exact original imported files, addressed by package sequence rather than user-provided filenames.
- `reports/sdn-evidence.json` and `reports/sdn-evidence.md`: current coverage, history and review status.
- Design PDF: scope review, source provenance and expected/observed result details.
- Workbook: **SDN evidence coverage**, **SDN evidence history** and **SDN evidence results** sheets.

The [implementation checklist](plans/implementation.md) defines configuration-only completion. SDN execution and collection remain in the user's existing tools.

From 0.31.0, the request scope uses contract version 2 and includes active controller architecture decisions. Schema 27 retains earlier imported observations, but their earlier scope hashes are stale. Re-export a request after completing the new decisions; do not rewrite the source evidence hash.
