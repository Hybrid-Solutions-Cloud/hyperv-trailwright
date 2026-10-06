# Changelog

## 0.35.0 — switchless cable map, device bill of materials and registry check

- Project schema 32: switchless S2D storage systems record each direct node-to-node cable; validation checks the full mesh, port reuse and self links.
- Design schedules gain decisions, network devices and storage links; the bill of materials lists firewalls, ToR switches and out-of-band devices only when their component is used.
- infrastructure.yml exports the cable map; a unit test fails on any key that is neither a Toolkit registry key nor a documented extension.

## 0.34.0 — component decisions and master infrastructure.yml

- Start every infrastructure component with an "is it used?" decision: TierPoint-managed FortiGate or customer firewall, Azure site-to-site VPN, point-to-site VPN, ExpressRoute, top-of-rack switches (Dell PowerSwitch or customer), out-of-band management (standard OOB switch or Opengear with Lighthouse), backup and monitoring. A used answer reveals only its follow-up questions; a not-used answer hides them, keeps earlier answers and removes the component from exports.
- Collect firewall units, interfaces to ToR ports, VLAN gateways and DHCP scopes; ToR switches with VLT/MLAG pairing and, when S2D storage is switched, storage VLANs, PFC priorities, ETS percentages and RDMA type; OOB devices, Lighthouse enrollment by keyvault:// reference, cellular failover and the console port map.
- Add port maps: host adapter to ToR switch port, BMC to OOB device port, firewall port to ToR port and console port to device.
- Record S2D switched or switchless connectivity with the Windows Server full-mesh rule, and Fibre Channel fabrics A/B, zoning and target WWPNs or iSCSI path A/B networks, VLANs, portals and target IQN.
- Add `infrastructure.yml` to the design package in the Azure Local Toolkit master shape (`networking.onprem.network_devices[]`, `networking.hybrid.vpn`, `compute.cluster_nodes`) with a `decisions` section. Only components in use appear. Data only.
- Hide witness placement and prerequisite notes when a cluster has no witness, and host storage interfaces when the design has no SAN.
- Project schema 31 migrates schema-30 designs with every gate unanswered and no inferred devices.

## 0.33.0 — configuration-only delivery

- Remove infrastructure deployment scripts, inventory collector, executable adapter plans, runner requests and consumer CI jobs.
- Keep VMM profile, host, cluster and witness configuration, saved schema-30 projects, SDN, licensing, reports, worksheets and diagrams.
- Make design completeness independent of automation qualification. External implementation references remain optional design data.
- Verify configuration packages contain no deployment code and preserve existing design choices.

## 0.32.0 — licensing rights, resource coverage and purchase gaps

- Separate commercial program, entitlement term, assignment/mobility and evidence ownership from activation prerequisites.
- Map external physical servers, normal/failover guest destinations and shared System Center estates without adding infrastructure demand or duplicate product charges.
- Review SQL OSEs, edition/HA and workloads before included, separate or provider purchase credit; supporting SQL depends on its reviewed System Center estate.
- Add access audiences and RDS base coverage, explicit Azure meters and covered benefits, and shared OME/SDN/third-party feature entitlements. Existing units reduce new purchase gaps; missing scope and overlapping allocations remain unresolved.
- Preserve SDN schema27, then migrate licensing rights28, resource/SQL coverage29 and dependency scope30. Reports, worksheets, saved projects and sanitized exports share the coverage model.
- Licensing design tasks F01–F05 are implemented. Native execution qualification and the remaining full Configurator scope stay open.

## 0.31.0 — controller architecture and tool decisions

- Separate controller-service redundancy from clustered VM hosting; support single, three-node and custom layouts, generation and placement checks.
- Collect structured controller release/build, deployment tool/version, VMM template provenance and Run As bindings; check documented FCNC tool prerequisites.
- Model one-subnet REST IP, multi-subnet DNS and single-controller address aliasing. Hide inactive fields across review, handoff and evidence scope while retaining project answers.
- Export controller mappings; schema 27 preserves existing notes and leaves new decisions unanswered. Evidence scope contract 2 makes older observations stale without deleting their provenance.
- Native SDN execution and runtime qualification remain unfinished.


## 0.30.0 — returned SDN acceptance evidence

- Export scoped acceptance requests and unexecuted result templates; import bounded external results with strict project, target and scope checks.
- Preserve original UTF-8 files and verify SHA-256 plus parsed-result consistency on project reopen.
- Distinguish partial, failed, stale, ambiguous and passed operator observations; require complete coverage in one matching run without qualifying execution.
- Include source files, coverage/history/results, PDF, Markdown and workbook reports. Sanitized sharing removes evidence history. Schema 26 migrates older designs with no evidence.


## 0.29.0 — structured SDN tenant services

- Add typed security rules, public/internal frontends, backend pools/members, health probes, load-balancing/NAT rules, gateway pools/members, IPsec/GRE/L3 connections and routes.
- Validate tenant/service ownership, native identity reuse, listener/priority conflicts, address scope and per-pool gateway allocations after unavailable-member reserve.
- Preserve inactive choices without blocking active NAT validation; include service objects in ordered setup and acceptance targets. Show missing gateway capacity as Unknown.
- Export shared service plans and Markdown, full service schedules, SDN fabric parameters and gateway capacity. Schema 25 migration leaves new collections empty. Native execution and returned acceptance-evidence import remain pending.


## 0.28.0 — SDN fabric and setup contracts

- Separate SDN delivery intent from fabric lifecycle and derive controller, MUX and gateway requirements from selected tenant capabilities.
- Derive the VMM gateway SLB dependency and order separate SLB, gateway and BGP stages.
- Bind controller identities, networks, REST address, MAC pool, media, FCNC storage and exact participating hosts. Validate single lifecycle owners, existing baselines, replacements, host placement, FCNC prerequisites and VMM architecture review.
- Preserve controller host overhead separately from controller and NFV VM demand. Include REST and correctly scoped SDN management declarations in address collision and pool-capacity review.
- Generate shared ordered handoff, capacity and acceptance-scenario contracts in the UI, JSON/YAML, Markdown/PDF and workbook/CSV. All stages remain unexecuted; native SDN execution and returned acceptance-evidence import remain pending.
- Schema 24 preserves previous notes and leaves new intent and bindings unanswered.

## 0.25.0 — resource operations and recovery evidence

- Open newly added inventory records and focus their name field, including second and later records.

- Assign exact resources to monitoring, patch, backup and security policies. Detect competing ownership, including CAU cluster/member scope, and validate remote coordinator placement.
- Retain backup/provider/repository contracts and explicit recovery objectives. Compare only complete operator-reported tests with confirmed measurements and matching resource/policy/backup identities; default zero values never establish recovery acceptance.
- Validate capacity threshold units, high/low ordering and percentages. Link privileged, runner and certificate identities to security controls.
- Schema 22 preserves old operations prose and adds empty mappings. Shared operations plans, recovery schedules, JSON/YAML/Markdown/PDF/workbook/CSV and topology retain evidence without asserting native qualification.

## 0.24.0 — typed host networking and scoped address pools

- Link per-host switches and ATC intents to exact physical members, host interfaces and address assignments. Validate ownership, preservation/replacement, member reuse and host scope.
- Review Windows Server ATC prerequisites, cross-node adapter and intent symmetry, VLAN lists, interface MTU and RDMA/PFC decisions.
- Calculate declared pool capacity after merged exclusions, allocations and gateway reservations. Detect same-scope collisions while allowing isolated tenant reuse.
- Schema 21 preserves legacy network notes and leaves new mappings unanswered. Shared JSON/YAML/Markdown/PDF/workbook/CSV and topology retain the network design; runtime qualification remains pending.
- Enforce declared numeric maxima in the shared field review.

## 0.23.0 — physical storage eligibility and SAN ownership

- Separate direct-attached S2D devices from SAN/shared/virtual media, RAID presentation, multipath and flash protection. Incompatible capacity/cache devices leave physical inventory headroom unknown; boot devices remain separate.
- Link FC/iSCSI initiators and SAN routes through physical interface identities. Validate protocol/host/transport, duplicate WWPNs, independent physical paths and dated observations.
- Record backend preservation/replacement and exact host/cluster storage attachment scope. Keep node-local disks on their owning host. Show decimal hardware limits and additional S2D cache metadata memory separately from GiB/TiB capacity inputs.
- Schema 20 adds unanswered inputs and no invented observations/interfaces. Shared eligibility and memory schedules, JSON/YAML/Markdown/PDF and topology retain the new relationships. Runtime qualification remains pending.
- Reject configuring an existing Hyper-V role when the selected host state or OS replacement leaves no role to configure.

## 0.22.0 — per-host deployment and physical readiness

- Separate observed host state from desired OS, Hyper-V role and cluster-membership actions and owners. Preserve mixed expansion baselines and explicit replacement identity, evacuation, scope and window.
- Correlate physical sites, UUIDs, boot disks and PXE adapters. Review hardware capabilities, profile firmware/partition/OS/domain, deployment subnets, administrative access points and migration policy.
- Expose existing VMM profile readback independently of creation choices. Export a host deployment plan, report and worksheet; add profiles, adapters and disks to topology.
- Schema 19 migrates new inputs as unanswered. Actual conflicting exports are rejected by native consumer offline tests; no runtime infrastructure qualification is implied.

## 0.21.0 — identity, artifact and Arc prerequisites

- Link directory, service/gMSA, certificate and runner identities to exact resources. Keep domain and forest intent distinct, retain KDS/retrieval and PKI lifecycle evidence, and reject Local System for clustered VMM services.
- Assign exact installation/update/driver/automation artifacts. Separate expected and observed hashes, preserve offline acquisition/cache ownership, and keep operator verification distinct from runtime qualification.
- Collect precise Arc VMM, Azure, provider, network, static appliance/upgrade/control-plane, proxy and support-review contracts. Flag invalid/duplicate/subnet addresses, DHCP and private-link-only choices against the dated baseline.
- Schema 18 migrates active and archived records with new answers unset. Source/proxy URLs cannot contain embedded credentials or signed access tokens. Shared prerequisite JSON/YAML/Markdown/PDF/workbook/CSV and topology preserve assignments.

## 0.20.0 — physical placement and SQL/library availability

- Correlate service and SCOM failures when members map to the same physical host, even if their entered rack labels differ. Preserve current/desired placement, provider-managed policies, observation time and failover-capacity evidence.
- Collect SQL AG kind, exact database assignments, listener/platform/storage contracts and per-replica commit/failover/secondary-use choices. Check reviewed Standard/Enterprise limits for Windows SQL 2022/2025; keep unknown platforms/releases under review.
- Model HA VMM library servers separately from backing storage and VMM service clusters. Require a separate library availability dependency for HA VMM services.
- Schema 17 and assessment 0.2.0 preserve inactive answers and add no runtime synchronization or failover claim. JSON/YAML/Markdown/PDF, SQL schedules and database topology use the same contracts.

## 0.19.0 — availability roles, voting and site recovery

- Separate VMM service members from consoles, SCOM pool workers from voting observers and other roles, and WAC modes from application HA pairs. Direct database prerequisites follow the selected management role.
- Calculate static SCOM voting majorities and surviving workers across declared correlated failure domains. Unknown versions, roles, missing observer evidence and duplicate native identities leave voting unresolved.
- Add explicit member sites, application/database cluster identities and independent site recovery contracts. Detect stretched VMM service clusters, cross-site SCOM pools and conflicting member sites.
- Schema 16 leaves new inputs unanswered during migration. Shared assessment, JSON/Markdown/PDF and voting workbook/CSV retain the same arithmetic. Support, native quorum health and recovery qualification remain separate.

## 0.18.0 — reversible component omission

- Replace destructive component removal with explicit omission, retaining the original identity, configuration, capacity and current decision rationale.
- Exclude omitted records from active totals, provider/product plans and active reference options. Preserve dependent records and block stages that still target an omitted component.
- Restore the complete component without executing it. Add omission Markdown/PDF/workbook/CSV and a separate configuration archive; redact archived identities in sharing copies.
- Schema 15 validates active and omitted records together, rejecting duplicates, invalid metadata and secret literals. C02 lifecycle/category collection is implemented; broader lifecycle/current-state and execution work remains open.

## 0.17.0 — component hosting and network ownership

- Collect existing provider identity/evidence, native placement IDs, four independent action owners, pinned consumer references and physical Windows hardware contracts.
- Add administration/jump, backup, patching and generic integration component categories. Selection never creates a supporting service automatically.
- Add per-component network attachments with existing adapter identity, provider network mapping and scoped IPv4/MAC validation; block mutations beneath preserved components.
- Share hosting plans, component network YAML, action-owner/network schedules and topology. Schema 14 preserves old flags without inventing provider identities or action owners; C03/C04 collection contracts are implemented, with provider execution qualification still open.

## 0.16.0 — management roles and dependency contracts

- Collect explicit VMM/SCOM roles, component OS release/edition/install type, service/SQL/library identities, Run As scope, agent/gateway/reporting settings, SQL HA/storage review and WAC topology.
- Add supporting identity/PKI, library/PXE, Arc and runner references and acceptance criteria. Runtime credentials remain references; dependencies are never created from a selection.
- Apply role-specific VMM/SCOM OS and WAC topology/resource rules. Keep unknown combinations, SQL Standard AG limitations and external services under explicit review.
- Preserve inactive role answers through schema 13 migration, save/open, shared exports and JSON/YAML/Markdown/PDF/workbook schedules. C06 data collection is implemented; broader hosting/integration/consumer qualification remains open.

## 0.15.0 — OME sizing and manual acceptance

- Add 4.7 device/plug-in profiles with explicit unknown selections, pinned plug-in versions, vendor-unit review and separate primary/secondary disks. Preserve Dell's higher explicit all-plug-in totals.
- Collect bounded discovery targets, runtime credential references, feature support, catalog/baseline ownership, integration and entitlement review.
- Add eight independently owned manual milestones with evidence and UTC observations. No entered state or HTTPS endpoint establishes runtime qualification.
- Share the calculation across UI, JSON/YAML, Markdown/PDF and capacity/acceptance workbook schedules. Schema 12 migration leaves new decisions unanswered and rejects future-field smuggling.
- C08–C10 planning and manual-handoff scope is implemented; infrastructure consumers and full acceptance remain open.

## 0.14.0 — management decisions and support baselines

- Add thirteen explicit unanswered/yes/no management decisions, OS deployment ownership, architecture evidence, tenant interfaces, vendor integration and migration requirements.
- Explain management candidates from selected requirements; retain OEM/operator ownership, separate SCOM monitoring, gate Azure/offline conflicts and keep accepted previews under review. Advice never changes inventory or grants licensing rights.
- Add a nineteen-entry primary-source support catalog for initial product/OS/HA, OME and SDN baselines. Preserve supported, preview, unknown and unavailable states separately from native consumer qualification.
- Include advice, source/condition evidence and support baselines in JSON/YAML, Markdown/PDF and workbook/CSV packages. Schema 11 preserves previous answers and adds unanswered decisions; shareable outputs scrub free-text context.

## 0.13.0 — project scope and management dependencies

- Tailor the editor sequence to management-only and cluster-only designs, retaining populated editors and access to all fourteen sections.
- Collect cluster management source, owner and acceptance notes; flag deferred decisions and conflicting “not required” choices. Existing-service documentation no longer requires an unrelated workload cluster.
- Preserve scenario, customer, naming and support context through JSON/YAML, design reports and a workbook/CSV schedule. Schema 10 migrates older projects without inventing management decisions; shared exports scrub private context.
- Align generic BMC validation with the existing VMM DNS-name/IPv4 contract while retaining strict IPv4 checks for management addresses.
- Map 318 proposal entries and 87 flowchart nodes/branches to tasks and acceptance definitions. Case-level implementation and native runtime evidence remain separate.

## 0.12.0 — licensing assignments and dated quotes

- Calculate Windows Server/System Center core quantities from explicit physical hosts or eligible server VMs, preserving per-host maintenance/failover peaks and the customer VM minimum.
- Separate core-license quantities from quote pack sizes and credit owned units through consistent entitlement pools; block duplicate assignments and over-allocated pools.
- Require dated quote/no-charge evidence and licensing review before showing a complete estimate. Unresolved quotes remain visible; currency and recurring/perpetual periods remain separate.
- Export a shared licensing assessment, detailed calculations, commercial evidence and totals to JSON, Markdown/PDF and workbook/CSV, plus a package guide.
- Schema 9 retains older quantities/rates as manual and unreviewed. Included SQL, access, hosted/provider and other unmodeled rights remain separate required reviews.

## 0.11.0 — desired VMM physical profiles

- Separate profile creation handoffs from existing-profile host submission, with exact library/Run As/NIC identities, membership, runtime credentials, disk layouts, paths, drivers and read-back acceptance.
- Validate firmware/disk mismatches, duplicate NIC/profile/path identities, artifact pins and retained domain/workgroup conflicts. New findings navigate directly to their fields.
- Include deterministic creation JSON, a parameter-mapping guide and a detailed Markdown handoff in packages. Generic PDF/workbook schedules retain the same creation answers.
- Schema 8 migrates older projects with empty creation inputs. No VMM object ID, profile creation, disk grammar qualification or runtime acceptance is inferred.

## 0.10.0 — required-input review and keyboard navigation

- Validation links now open the owning record and focus the relevant field, including collapsed records and cross-section storage findings.
- Added per-section counts of supplied required inputs, unresolved rules and support reviews. These counts do not imply runtime readiness.
- Explicitly associate input names with their visible labels so textarea contents cannot alter accessible names. Section changes move keyboard focus to the new heading.
- Required text fields reject whitespace-only answers. Project schema remains 7; validation exports retain optional field keys for actionable findings.

## 0.9.0 — structured storage placement and resiliency

- Added volume current/desired lifecycle, explicit replacement/migration review, storage directories, workload/component/SDN disk allocations and per-host SAN I/O routes.
- Reconcile disk demand within volume budgets without double counting. Separate volume, directory and multipath counts; validate path boundaries, duplicate disks, preservation and observed path evidence.
- Added reviewed dual-parity encodings, exact mirror/parity tier sizes and two-node nested mirror/parity estimates. Thin tier distribution remains unknown until observed.
- Schema 1–6 migrate to 7 without inventing lifecycle authorization or placement. UI, JSON/YAML, Markdown/PDF, workbook/CSV and topology retain the new records.
- Storage execution and live runtime qualification remain required; this release implements design and handoff semantics.

## 0.8.0 — storage allocation and presentation review

- Fixed capacity validation to account for a fixed volume's full allocation, even when expected data usage is low. Thin consumption and full-growth headroom remain separate per backend.
- Added S2D capacity-drive inventory, physical repair allowance and mirror-footprint estimates; incomplete drive inventory and unspecified parity/tier layouts remain unknown. Boot/cache capacity is excluded.
- Added physical node/edition/drive/cache checks, scoped duplicate CSV/LUN checks, SAN presentation requirements, SMB path/filesystem checks and filesystem support review notes.
- Added live storage review, assessment JSON, dedicated Markdown report, PDF tables and workbook/CSV schedule, with dated primary-source references and explicit assumptions.
- Preserved schema 6 answers. Clarified the existing logical reserve label; no resource provisioning or runtime qualification is implied.

## 0.7.0 — quorum configuration candidate

- Added preserve/configure intent, file-share/cloud/disk witness inputs, failure-domain and prerequisite/acceptance reviews. Schema 1–5 migrate to schema 6 with quorum preservation as the default.
- Added a named quorum candidate with offline validation, scoped node and witness preflight, immutable baseline files, exact plan/node/baseline authorization, drift/freshness checks, witness-removal opt-in and persistent journals. Cloud keys remain runtime SecureString inputs; observations never enumerate secret properties.
- Added dedicated SAN volume/resource mapping, CSV/application-role protection, public witness-property comparison and observation-only resume. Actual quorum validation, failure testing and runtime qualification remain required.
- Shared the strict PowerShell JSON/hash helpers between formation and quorum consumers. Formation adapter 0.2.0 requires the packaged common file; keep the adapter directories intact.
- Added four exported-plan PowerShell mock contracts, schema/negative/export cases and a browser preserve/switch/save/reopen/package journey. CI requires these checks before publication.

## 0.6.0 — prepared-host cluster formation candidate

- Added explicit cluster AD domain, site management network, local seed host and exact FailoverClusters version. Schema 1–4 migrate to schema 5 without inferring new deployment inputs.
- Added a deterministic prepared-cluster contract, staged follow-on requirements, PowerShell consumer, validation-review templates and package/report/UI integration.
- Blocked retained cluster-creation and VMM bare-metal choices when the project scope is Document an existing environment.
- Added offline validation, scoped identity/build/service/IP preflight, reviewed Test-Cluster report hash/freshness checks, exact plan/node authorization, NoStorage creation and persistent journals. Observation never resubmits or claims complete deployment.
- Added website-export-to-PowerShell mock tests and a browser field/edit/save/reopen/package journey. CI requires the cluster mock suite before Pages publication.
- This remains a runtime-unqualified candidate. Quorum, storage/CSV, networking, VMM cluster/profile and other execution/acceptance paths remain required under the full implementation plan.

## 0.5.0 — discovery provenance and drift review

- Added strict scoped snapshot import with original file hashes, source/collector identities, UTC times, explicit design/external IDs and unknown/unavailable handling; schema 1–3 migrate to schema 4.
- Added latest-by-collection-time comparisons, freshness/conflict gates, separate identity remapping review, field-level preserve/adopt/reconcile decisions and retained audit history. Adoption updates only the local design.
- Added a candidate read-only Hyper-V collector for explicit VM GUIDs and configured CPU/startup memory. CI feeds website-generated requests through mocked PowerShell collection and imports the actual returned snapshot.
- Added discovery JSON/Markdown/PDF/workbook/CSV reporting, sharing-mode source removal, import/review/browser coverage and artifact hash verification. Excluded temporary test downloads from the Vite watcher to prevent Windows file-lock crashes.
- Runtime collector qualification, other native providers, authenticated evidence and infrastructure reconciliation remain unfinished under the full implementation plan.

## 0.4.0 — VMM existing-profile consumer candidate

- Added schema 3 VMM object IDs, exact module version and an explicit deployment management adapter; schema 1/2 projects retain their answers during migration.
- Added deterministic VMM plan JSON, fixed PowerShell consumer code and operating instructions to selected design packages, with findings in review and reports.
- Added offline validation, object-reference preflight, plan-hash/host authorization checks, existing-host protection, physical identity verification and create-new job journals with observation-only resume.
- Added export-to-consumer CI coverage, mocked failure/recovery tests and a browser save/reopen/download journey. Runtime compatibility, physical provisioning, profile/cluster creation and full acceptance remain unqualified.

## 0.3.0 — stage ordering and resume review

- Added explicit target and prerequisite checks, deterministic stage waves, cycle detection and review states for manual, running, failed and reported-complete stages.
- Prevented passed/running stages from skipping incomplete prerequisites and preserved failed stages for operator review rather than automatic retry.
- Added stage-plan JSON and Markdown summaries, sanitized stage-reference remapping, and OME manual-install enforcement for general management stages.
- Added thirteen stage-plan unit cases and a browser resume-review journey. External execution integration and qualified adapters remain unfinished.

## 0.2.0 — management availability and dependencies

- Added structured availability groups, component memberships and bootstrap/runtime/recovery prerequisites.
- Added prerequisite ordering, cycle detection, failure-domain tolerance, product-specific HA consistency and separate database availability checks.
- Added schema 1-to-2 migration preserving existing project answers and identities.
- Included availability and dependency plans in YAML/JSON, reports, schedules and paired topology diagrams, including sanitized reference remapping.
- Added migration, negative-design, graph, export and browser acceptance checks. Qualified automation and runtime execution remain unfinished.

## 0.1.0 — development preview

- Added standalone Hyper-V Configurator workspace and fourteen-section design workflow.
- Added per-component hosting/HA and product configuration, manual OME design and optional SDN design/setup.
- Added host/VMM provisioning, storage/drive layout, networking, identity/media, licensing and operations inventories.
- Added versioned project persistence/import/export, Surveyor source evidence and eight fictional reference scenarios.
- Added validation, design reports, environment YAML, workbook/CSV schedules and draw.io/PNG topology in hashed ZIP packages.
- Added sanitized sharing exports and native/browser acceptance tests.
- Execution adapters and production qualification remain pending; this is not the completed implementation goal.
