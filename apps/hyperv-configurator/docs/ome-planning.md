# OME appliance planning and manual acceptance

OME remains a manually installed appliance. Choose an existing instance or a new manual deployment, pin the appliance image and hash, and record its actual provider, placement, addressing, certificate, RBAC and recovery design. The generic Windows installer and guest configuration controls are unavailable. Supported underlying ESXi does not establish a Cloud Director deployment contract.

## Reviewed capacity

The initial calculator uses the [Dell OME 4.7 matrix](https://www.dell.com/support/kbdoc/en-uk/000423997/openmanage-enterprise-4-7-support-matrix?lang=en), reviewed 2026-09-11. Choose a sizing profile and explicitly enable or disable each plug-in. Unanswered selections retain an unresolved result, including Services and AIOps, which Dell lists as defaults. Pin enabled plug-in versions separately.

Small and large profiles add the selected plug-in memory increments without multiplying CPU. For all plug-ins, the calculator uses Dell's higher explicit total recommendation: the individual increments do not sum to that total. Extra-large excludes plug-ins and includes primary-disk expansion for metric collection. Review extra-large applicability below 25,000 devices independently. Other releases or platform exceptions require independently reviewed sizing.

Dell labels capacity in GB; this application records allocations in GiB. Choose the reviewed interpretation explicitly. Decimal conversion rounds each memory/disk allocation up to whole GiB. The calculator does not overwrite allocations. Both disk sizes must reconcile with the component total; datastore snapshot/expansion headroom is a separate input. The generic profile expects matching disks, with the documented extra-large expansion exception.

## Discovery and operational handoff

Discovery expressions accept one IPv4 address, DNS name, IPv4 CIDR or start-end range per line, up to 1,000 expressions. The planner merges overlapping IPv4 ranges arithmetically; it never enumerates or contacts devices. CIDR counts include all addresses. DNS can overlap IPv4 ranges, so neither count is an inventory or licensing quantity. Retain the managed-device count as a separate reviewed input.

Collect a runtime secret reference, protocols and network paths, device/firmware feature support, catalog/baseline ownership, integration contracts and device/plug-in entitlements. Link commercial assumptions to the existing license worksheet. No credential value or license right is inferred.

Eight independently owned milestones cover import/instance identification, first boot, licensing, certificates, discovery, integration, restore and operational handover. Reported acceptance requires evidence and a valid non-future UTC observation; exclusions require a reason. These are operator observations, not authenticated receipts. An accessible HTTPS endpoint cannot mark the appliance deployed or accepted.

## Data and exports

Schema 12 migrates previous OME records with unanswered new fields. It preserves existing free-text scope, plug-in notes and evidence; it does not infer structured choices from them. Unknown choices and future-field smuggling are rejected. Sharing copies scrub addresses, identities and evidence.

The UI and `plans/ome-manual.json` share one calculation. The package also includes OME YAML, Markdown/PDF, capacity and manual acceptance worksheets/CSVs, component capacity/BOM and topology. Every plan retains `runtimeQualified: false`. This increment implements C08–C10's planning and manual-handoff requirements; it does not qualify any infrastructure consumer.
