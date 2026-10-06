# Physical placement and SQL/library availability

Version 0.20.0 · schema 17 · assessment 0.2.0 · source review 2026-09-11.

## Physical placement

Availability membership records specify current or desired placement, pinned/dynamic/provider-managed/physical mode, a design host reference or native physical-host identity and provider scope. Current placement requires UTC observation evidence. Preserved components cannot claim a desired relocation; change their explicit lifecycle scope first.

The Configurator merges declared failure domains when pinned mappings reveal a shared physical host. For example, two VMs labelled Rack A and Rack B but mapped to the same native host lose service together. Both generic service-survival and SCOM voting calculations use this correlation. This is conservative design arithmetic; it does not observe a host or enforce placement.

Dynamic or provider-managed placement uses separation-policy identity, applicability and admission/failover-capacity evidence. Retained fixed host answers are not used for that mode's arithmetic. An external provider does not need a fictional physical-host record. Provider restart assurance remains separate from application/SQL quorum and cold-start recovery. Review missing/contradictory identities, host/site mappings, timestamps and evidence in the ordinary findings list.

## SQL topology and database assignments

For each SQL AG or FCI, record its cluster identity/platform, listener addresses and port, endpoint authentication/SPNs/encryption, storage ownership, consuming-product review and synchronization/failover/reconnect/restore acceptance. AGs additionally select basic/full/other topology and automatic seeding or backup/restore initialization. Each member records commit and failover modes plus secondary read and backup intent. Inactive AG answers are retained if the strategy changes.

Add one **Availability database assignment** for each exact database, its owner, SQL group, purpose, consuming component and support/storage/recovery evidence. A database assignment adds no SQL server capacity or license quantity. Duplicate names within a group are reviewed case-insensitively; separate basic groups may reuse the same SQL instance. Reconcile this design rule with any case-sensitive database naming policy during support review.

The dated Windows SQL 2022/2025 Standard baseline permits two-node FCI and basic AGs with two replicas and one database. Enterprise FCI allows up to sixteen nodes, and full AGs up to eight secondaries plus a primary. Unknown editions, platforms and releases do not inherit these limits automatically. [SQL 2022 feature matrix](https://learn.microsoft.com/en-us/sql/sql-server/editions-and-components-of-sql-server-2022?view=sql-server-ver17), [SQL 2025 feature matrix](https://learn.microsoft.com/en-us/sql/sql-server/editions-and-components-of-sql-server-2025?view=sql-server-ver17).

Basic AG secondary reads and backups are rejected. Automatic failover needs at least two configured synchronous/automatic candidates; configured modes alone never establish synchronized runtime health or WSFC quorum. Larger synchronous configurations retain an exact-release review because the vendor feature-table and availability-mode explanations use different count wording. [Basic AG limits](https://learn.microsoft.com/en-us/sql/database-engine/availability-groups/windows/basic-availability-groups-always-on-availability-groups?view=sql-server-ver17), [commit/failover modes](https://learn.microsoft.com/en-us/sql/database-engine/availability-groups/windows/availability-modes-always-on-availability-groups?view=sql-server-ver17).

SCOM database assignments retain the Windows SQL engine requirement; arbitrary PaaS/external SQL cannot substitute for it. SSRS database availability receives a separate review from operational/warehouse AGs. Exact CU/UR, collation, performance, licensing and application-specific support remain independent requirements. [SCOM SQL design](https://learn.microsoft.com/en-us/system-center/scom/plan-sqlserver-design?view=sc-om-2025).

## VMM library availability

Use the clustered library strategy for an HA library-server group. Its general-use file-server role, cluster identity, UNC share, consuming VMM service, permissions/registration, backing storage and content recovery are separate inputs. SOFS cannot itself be the library-server role; an independently described backing SOFS share is a different contract. The library role cannot share the VMM service cluster. HA VMM services also need a separate library availability dependency; VM restart protection alone does not satisfy it. [VMM HA planning](https://learn.microsoft.com/en-us/system-center/vmm/plan-ha-install?view=sc-vmm-2025), [HA library deployment](https://learn.microsoft.com/en-us/system-center/vmm/ha-library?view=sc-vmm-2025).

## Files and verification boundary

Schema 16 projects migrate with empty new fields and database assignments. Old schema labels cannot carry future fields or the new library-cluster strategy. The parser validates the new collection and references; sharing redacts native identities/evidence and remaps design links. Current and inactive answers remain in canonical JSON/YAML and workbook records.

`plans/availability-assessment.json` includes placement inputs/correlation, SQL summaries and database assignments. Markdown/PDF and SQL availability worksheets/CSV expose the same results. Editable topology includes database/group/consumer links. SQL status remains review or conflict and runtime synchronization remains false: native product installation, quorum, failover, recovery and authorization are separate execution gates.
