# Reversible component omission

Schema 15 migrates previous projects with an empty omitted collection. Active and omitted components share one bounded identity namespace; archived configuration, metadata and secret references receive the same import checks as active configuration. Invalid or future omission times are rejected.

Omit from design moves the entire existing component record to an explicit omitted collection. It preserves its identity, lifecycle, product/hosting configuration, capacity and secret references. It does not remove or alter the actual VM/server/service.

Record an omission reason and review owner in Management requirements. Omitted components are excluded from active component capacity, product plans, provider actions and active component reference choices. Dependencies, network attachments, license assignments and stages are retained; references to an omitted component become unresolved and require review. An existing stage targeting that component is blocked by its missing active target.

Restore to active design returns the preserved component with the same identity and configuration. It does not create infrastructure or run a consumer. Review retained action flags and dependent records before any separately authorized execution. Restoration clears the current omission record; this is a current design decision, not an immutable audit log.

The owned project retains the complete omitted component. Omission summaries identify excluded instances, prior lifecycle, reason, review owner and timestamp in Markdown/PDF/workbook/CSV. A separate environment archive keeps complete omitted configurations apart from active component handoffs. Sharing exports scrub both active and omitted private identities while preserving internal references.
