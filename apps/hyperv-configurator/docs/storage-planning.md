# Storage planning and capacity review

Version: 0.9.0

Assessment contract: 0.2.0, schema 2

Microsoft sources reviewed: 2026-09-11

The Storage section keeps backend definitions, physical drive layout and volume/CSV/LUN records together. Its capacity review updates as those records change. S2D, Fibre Channel, iSCSI, SMB and local storage have independent budgets; an S2D pool and SAN can be recorded separately for the same cluster.

## Workflow

1. Add the cluster and physical host inventory. Select the actual Windows Server edition and release.
2. Add each storage backend, its owner, capacity and logical reserve. For SAN, record array/target, firmware, fabrics or portals, MPIO and support/recovery details. For SMB, record endpoint, access and availability requirements.
3. For physical S2D, add boot, cache and capacity drive groups per host, including count, size, media, controller and firmware. Only capacity groups contribute to pool capacity. Review disk eligibility and hardware validation.
4. Add each volume once, with its logical size, expected consumption, provisioning, filesystem, resiliency and mount/share path. SAN volumes also need LUN identifiers and host-group/presentation mappings. Record growth and recovery ownership for thin volumes.
5. Review logical allocation, full-growth headroom, physical S2D estimates and findings. Correct required findings and record the remaining support decisions before deployment.
6. Download the design package. The saved project keeps all original inputs; computed assessments are separate artifacts.

## Capacity meanings

All inputs use binary units: 1024 GiB equals 1 TiB. Manufacturer decimal TB values must be converted before entry.

| Measure | Calculation / meaning |
| --- | --- |
| Available logical capacity | Entered usable TiB minus entered logical reserve TiB |
| Expected data | Sum of expected consumption for all recorded volumes |
| Committed logical demand | Full logical size of fixed volumes plus expected consumption of thin volumes |
| Remaining logical capacity | Available logical capacity minus committed demand |
| All volumes at full size | Sum of volume logical limits, including thin volumes |
| Full-growth headroom | Available logical capacity minus all logical limits |
| Capacity-drive inventory | Sum of count times drive size for capacity-role groups on member hosts |
| Physical repair allowance | Conservative planning allowance: largest capacity drive of each media type times the node count, capped at four nodes, summed across media types |
| Raw mirror commitment | Each volume's committed logical demand multiplied by its mirror copy count |
| Estimated raw headroom | Lower of declared pool raw capacity and inventory capacity, minus physical repair allowance and raw mirror commitment |

The entered reserve has always been subtracted from usable capacity; its label now explicitly says logical capacity. It is separate from the estimated physical repair allowance. These values must not be added together or subtracted from each other across unit bases. Raw footprint is a lower bound before metadata, allocation granularity and alignment. It does not prove performance, rebuild time or storage availability.

For example, a fixed 2 TiB volume with 0.5 TiB expected data and a thin 8 TiB volume with 1 TiB expected data commit 3 TiB of logical capacity. Three-way mirroring estimates a 9 TiB raw footprint. Full growth would require 10 TiB logical and an estimated 30 TiB raw. The tool reports both budgets, even when today's expected data fits.

Missing provisioning produces an unknown commitment. Missing or ambiguous drive inventory produces unknown physical headroom. Parity needs an explicit encoding, capacity media and reviewed tier evidence. Mirror/parity tier sizes must add up to the volume size. Thin tiered current raw footprint remains unknown because actual data distribution across tiers is not observed. Array/SMB protection overhead is not guessed.

Disk allocations link a workload, hosted management component or SDN VM to a storage directory. A disk key is unique within its resource. Mapped demand is checked against both the resource requirement and the volume budget without adding another capacity reservation. Fixed VHDX allocation consumes its full size even within a thin volume. Unmapped demand is visible in the resource coverage table.

## Platform and presentation checks

The physical S2D review targets Windows Server 2022/2025 Datacenter, 2–16 nodes. It checks four capacity drives per node, integer drive quantities, cache requirements, role/media/size symmetry and duplicate pool ownership. Boot and cache space cannot inflate pool capacity. Virtual S2D guest clusters still need separate qualification.

Nested mirror and nested mirror-accelerated parity require exactly two nodes. Nested mirror uses four copies. Nested parity records its reviewed server-local column count and capacity media; the selected drives must exist on both nodes. Its full footprint combines four-copy mirror space and two copies of the server-local parity footprint. For example, 10 GiB mirror and 90 GiB parity across six columns requires an estimated 256 GiB raw before alignment and metadata. Existing volumes cannot be converted between resiliency types in place. See [Microsoft nested resiliency](https://learn.microsoft.com/en-us/windows-server/storage/storage-spaces/nested-resiliency).

Ordinary parity supports explicitly selected RS 2+2, RS 4+2, all-flash RS 6+2, HDD LRC 8+2+1 and all-flash LRC 12+2+1 layouts. The model checks documented minimum node counts and media classes, then uses each encoding's data-to-total-symbol ratio. Selecting an encoding does not certify the actual layout on a cluster; retain exact tier metadata and support evidence. See [Microsoft fault tolerance and storage efficiency](https://learn.microsoft.com/en-us/windows-server/storage/storage-spaces/fault-tolerance).

Three-way mirror requires at least three nodes; ordinary parity and mirror-accelerated parity require at least four. Thin support needs exact OS/build/tool review. NTFS on S2D and ReFS on SAN CSVs produce filesystem review notes, not automatic filesystem changes. References: [S2D hardware](https://learn.microsoft.com/en-us/windows-server/storage/storage-spaces/storage-spaces-direct-hardware-requirements), [volume planning](https://learn.microsoft.com/en-us/windows-server/storage/storage-spaces/plan-volumes), [CSV guidance](https://learn.microsoft.com/en-us/windows-server/failover-clustering/failover-cluster-csvs).

CSV paths are recognized as a direct child of a Windows ClusterStorage directory. Path comparison ignores case, slash direction and trailing separators within the same cluster. LUN identifiers must be unique within a backend; independent arrays can reuse an identifier. SMB records use UNC paths and the external filesystem choice. Node-local storage cannot be represented as a shared CSV. Separate SAN and S2D records preserve their disk ownership; see [Windows Server storage architectures](https://learn.microsoft.com/en-us/windows-server/failover-clustering/storage-architectures).

## Reports and contract

The package adds `plans/storage-assessment.json`, `reports/storage.md` and the Storage capacity worksheet/CSV. The design Markdown and PDF include the same capacity results. Assessment output includes project ID/revision, dated references, assumptions, per-backend and per-volume values and findings. Unknown numeric values are JSON null and display as Unknown in schedules and reports. Stable IDs determine assessment order, so reordering inventory rows does not change the result.

Project schema 7 adds local-host ownership, volume current/desired state, tier layouts, storage directories, disk allocations and SAN I/O paths. Schema 1–6 migrate with new intent and mappings empty. Migration does not infer an authorization to create or replace storage. Existing answers, IDs and revisions remain intact.

## Lifecycle and path ownership

Existing volumes need an identity and baseline size, path, provisioning and resiliency. Preserve/adopt cannot change these values. Expansion cannot shrink a volume or change its resiliency. Replacement requires an explicit approval and data-migration plan; the website does not execute it.

Directories must remain inside their selected volume, using absolute Windows or UNC paths without traversal. A directory does not create another CSV or increase capacity. Local storage records name their owning node, so identical local paths on different nodes remain distinct.

The SAN I/O paths editor appears once the design has a Fibre Channel or iSCSI storage system, and stays visible while any path is recorded, so switching storage kinds never hides a saved route. SAN I/O routes record a volume, initiating host, initiator, target and independent fabric/network. Duplicate routes, mismatched cluster ownership and failed paths produce findings. Active/standby claims need dated evidence. Planned routes do not prove reachability or failover. The model reviews route diversity for every host independently; volume, directory and I/O path counts remain separate.

## Remaining implementation and qualification

This is a planning assessment. There is no storage provisioning consumer in this release. Disk eligibility discovery, qualified execution, vendor qualifications, actual tier placement, performance and failure testing remain required in the full implementation plan. The assessment never reports automation readiness or deployment success.
