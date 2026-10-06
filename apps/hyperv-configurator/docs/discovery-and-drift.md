# Discovery and drift review

Configurator 0.34.0, project schema 31, discovery snapshot schema 1. Updated 2026-09-11.

## Inventory import

Use snapshots from your existing inventory process. The configurator validates and imports files only; no collector is bundled.

## Review decisions

The most recent collection time wins for each target, independent of import order. A partial newer snapshot does not silently reuse uncollected older fields. Equal collection times, changed external identity/source, deleted design targets, changed hosting providers, unavailable observations and evidence older than seven days block adoption. Preserve the original evidence and reconcile identity changes with the actual platform before preparing a correctly scoped design and fresh snapshot.

Every field decision records reviewer, reason, time, original design value, observed value and snapshot reference. Preserve keeps the design unchanged. Adopt copies only that field into an existing preserve/adopt/configure design target; it never changes lifecycle or provisions infrastructure. New/replacement/external targets cannot be silently adopted. Reconcile records requested review intent only. No infrastructure command or success receipt is generated from it.

For a legitimate identity/source change, the UI shows previous and latest mappings. After checking the real resource, supply reviewer/reason and choose **Confirm latest identity mapping**. This records a separate `remap` decision against the fresh snapshot, retaining both source histories and changing no design values. Each field still needs its own review. A later identity change blocks again; confirmation cannot bypass stale, unavailable or incompatible evidence. Networks, adapters and volumes currently support comparison/preserve/reconcile; adoption requires an explicit existing lifecycle, which those design collections do not yet carry.

Changing a desired value invalidates an earlier preserve/reconcile decision. A new snapshot requires a new decision even when values happen to match. Adopted values contribute to normal design capacity calculations and validation. Source claims remain unsigned after review; no action converts them into authenticated runtime evidence.

Saved projects retain snapshots and review history. Exports include source data, drift-plan JSON, Markdown/PDF summaries and a workbook/CSV comparison schedule. Sharing exports remove discovery source/history entirely, retaining the sanitized current design, so private IDs, source hashes, names and reviewer details cannot leak or be presented as valid shared evidence.

## Development and publication

Project schemas 1–3 migrate with empty discovery history; saving writes schema 4. Keep a pre-upgrade file for older releases. Unit tests cover provenance, strict import, ordering, stale/conflicting evidence, decisions, migration, secret rejection and sanitization. Browser coverage exercises actual import/review/save/reopen/download flows. CI builds and publishes the website; no local production build or WSL is needed.

The imported snapshot format is documented and validated by the application. Collection commands and infrastructure reconciliation remain the responsibility of the user's existing tools.
