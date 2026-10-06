# Availability and prerequisite design

Version: 0.19.0. Reference review: 2026-09-11.

## Role, voting and recovery review

VMM service-cluster members select the management-service role and clustered topology; console records do not acquire service/database prerequisites. The service cluster has its own identity, separate from its VM hosting cluster and SQL cluster. The reviewed VMM design excludes stretched service clusters and limits membership to sixteen nodes. SQL and library availability remain separate prerequisites. See [Microsoft's VMM planning guidance](https://learn.microsoft.com/en-us/system-center/vmm/plan-ha-install?view=sc-vmm-2025).

SCOM pool participants select management or gateway roles. Workload participants are active; explicit observers vote without running pool workloads. Database default-observer enablement is recorded explicitly because creation methods have different defaults. The database observer needs its SQL service, site, correlated failure domain and dependency evidence. Gateway use of that observer leaves this calculation unresolved. Record workload/certificate qualification and inter-member latency; Windows agent reporting is not a resource-pool workload. Member sites are checked against the reviewed single-datacenter pool design. Sources: [pool design](https://learn.microsoft.com/en-us/system-center/scom/plan-resource-pool-design?view=sc-om-2025) and [explicit observer contract](https://learn.microsoft.com/en-us/powershell/module/operationsmanager/new-scomresourcepool?view=systemcenter-ps-2025).

The Configurator computes a static majority as `floor(votes / 2) + 1`. It subtracts the largest declared correlated vote losses and independently subtracts the largest workload-member losses. Both resulting bounds must satisfy the requested tolerance. For example, two workload members plus one independent observer provide three votes: two remain after one independent domain loss. Placing that observer in the same failure domain as a worker leaves only one vote in the worst case. Neither membership nor observer selection adds capacity; the original component records own that demand.

Unresolved versions/roles, duplicate membership or native server identity, missing domains and unreviewed default-observer inputs return unknown voting capacity. A consistent result assumes the entered memberships, identities and failure dependencies are accurate. It does not establish runtime quorum, product support, database availability or failover performance. Pool-specific findings coexist with general HA and prerequisite checks.

Every availability group records a separate site recovery decision: none, backup/rebuild, warm standby, replication or external commitment. Selected recovery has a target site, activation dependencies and failover/failback acceptance. RTO/RPO require an evidence owner; zero-valued numeric defaults are not accepted objectives by themselves. Different WAC modes are not an HA pair, and duplicated OME appliances do not establish application HA.

Schema 16 adds these group inputs, member site references and the explicit observer role. Actual schema 15 files migrate with empty new fields; future fields and observer roles cannot be smuggled into an old version. Inactive inputs remain saved. Sharing remaps site and database references and scrubs evidence. The package includes `plans/availability-assessment.json`, `reports/availability-assessment.md`, an Availability voting worksheet/CSV and the same PDF summary. Native adapter and recovery acceptance remain open in the full implementation plan.

In **Hosting and availability**, add an availability group for each protected service, link its component records, and record its dependencies. A component continues to represent one VM, physical server or external service. Adding group membership does not add capacity or another license requirement.

## Choices and workflow

1. Add individual management components, including peers, existing shared services and externally supplied dependencies. Give each its own hosting platform, lifecycle, capacity and failure domain.
2. Choose a group strategy: clustered VMM service, SCOM resource pool, SQL FCI, SQL availability group, infrastructure restart protection, external availability or a separately reviewed custom strategy.
3. Link members. For a redundant application/database group, specify the minimum members needed after failure and how many failure domains may be lost simultaneously. Record quorum or observer behavior, enforced placement, RTO/RPO, recovery acceptance and a dated support review.
4. Link each dependent resource to its required resource. Choose initial deployment, normal operation or cold-start recovery. Existing services keep their identity and lifecycle; the tool never creates a replacement because a dependency was selected.
5. Review prerequisite waves. Resources in a wave have their declared prerequisites in earlier waves. A cycle blocks the affected resources and their downstream dependants. An existing resource is still checked for cold-start recovery cycles.

For example, a new VMM service that requires a hosting cluster, while that cluster requires the same VMM service for provisioning, has a bootstrap cycle. Model an independently available bootstrap service and its actual placement. A note saying “bootstrap” does not clear a structured cycle.

## Checks

- References must resolve to current resources. SQL, directory, library and placement links must point to the corresponding resource type.
- VMM service records require SQL, directory and library prerequisites. SCOM management-server records require operational database, warehouse and directory prerequisites; reporting requires the warehouse. Unknown roles retain the broader questions until selected. Other roles retain their specific product configuration contracts. New installations need applicable prerequisites in the initial deployment graph.
- Application HA text and VM restart protection are checked independently. An HA management application also needs a separate SQL HA dependency design.
- Member products and selected HA strategies must agree. VMM members must share service name, service account and DKM configuration. SCOM pool members must share a management group. SQL members must agree with the selected FCI/AG topology and record recovery behavior.
- Worst-case failure capacity subtracts the largest requested failure domains, not just one arbitrary member. Missing failure domains, fractional tolerances, duplicated members and differing member versions remain findings.
- External availability requires an owner commitment and evidence; it does not invent external replicas. Custom or unreviewed support combinations remain flagged.

These checks assess entered design consistency. They do not establish provider admission-control capacity, database quorum, automatic failover eligibility, SQL edition rights or production support for every product/build combination. Those exact support and runtime gates remain part of the full implementation plan.

## Files and backward compatibility

Project schema 2 adds `availabilityGroups`, `availabilityMembers` and `dependencies` under `design`. Valid schema 1 projects are migrated on open with empty new collections. IDs, answers, revisions and timestamps are preserved; no HA design is inferred from old text. Other unknown fields, malformed inventories and unsupported future schemas are rejected. Save the upgraded project for use with version 0.2.0 or later; older Configurator versions cannot open schema 2.

The package adds `environment/availability.yml` and `plans/dependency-order.json`. The latter records deterministic waves by phase and blocked resource IDs; it is a design dependency plan, not a runnable job. Markdown/PDF reports and workbook/CSV schedules include the new records. Draw.io and PNG topology include availability membership and declared dependencies where the linked resources are shown. Sanitized packages remap these references along with component identities.

## Primary-source basis

- Microsoft describes VMM management-service clustering, separate highly available SQL and library services, and DKM prerequisites: [VMM high availability](https://learn.microsoft.com/en-us/system-center/vmm/high-availability?view=sc-vmm-2025), [HA VMM deployment](https://learn.microsoft.com/en-us/system-center/vmm/ha-server?view=sc-vmm-2025), [VMM SQL availability](https://learn.microsoft.com/en-us/system-center/vmm/ha-sql?view=sc-vmm-2025).
- SCOM resource pools use multiple management/gateway members and observer/quorum behavior; database availability needs its own plan: [SCOM resource-pool design](https://learn.microsoft.com/en-us/system-center/scom/plan-resource-pool-design?view=sc-om-2025), [SCOM HA and recovery](https://learn.microsoft.com/en-us/system-center/scom/plan-hadr-design?view=sc-om-2025).

The fault-domain arithmetic, typed dependency model and phase ordering are Configurator design rules derived from the requested workflow. The linked articles are guidance, not a blanket qualification of every selectable version or provider.
