# Hyper-V Configurator

Version: 0.35.0

Component decisions (schema 31) start every firewall, VPN, ExpressRoute, ToR, OOB, backup and monitoring component with a used / not-used question. Not-used answers hide their follow-up questions, stay in the saved project and are left out of `infrastructure.yml`, the master design file in the Azure Local Toolkit shape.

[Licensing coverage and quotes](docs/licensing-and-quotes.md) separate entitlement rights from activation, map physical/virtual and managed-estate coverage, and review shared supporting SQL. Access audiences, Azure service meters and OME/SDN/third-party dependencies credit existing coverage before purchase gaps. Schemas28–30 preserve the prior SDN architecture and introduce no inferred entitlements. Missing scope, rights or quote evidence remains unresolved.

[Returned SDN acceptance evidence](docs/sdn-evidence.md) imports externally collected observations, preserves and verifies original source files, and checks exact scope, target coverage, failures, age and ambiguity. Schema 26 retains older projects with empty evidence history. Imported observations never execute infrastructure or qualify native adapters.

[SDN tenant services](docs/sdn-services.md) add typed ACLs, frontends, backend pools/members, probes, NAT rules, gateway pools/connections and routes. Schema 25 preserves earlier notes and introduces no inferred configuration. Gateway budgets, active-field validation, setup targets and shared reports support design review; native execution remains unqualified; returned SDN evidence is documented in the acceptance-evidence guide.

[Operations and recovery](docs/operations.md) bind exact resources to monitoring, CAU/patch, backup and security policies. Recovery comparisons require explicit objectives, confirmed measurements and matching evidence identities. Thresholds retain units and trigger direction. Schema 22 preserves prior plans without inventing assignments or successful tests.

[Host network design](docs/network-design.md) links switches/ATC intents, physical members, host interfaces and scoped IP assignments. Ownership, VLAN/MTU/RDMA and address-pool checks share the same assessment across the editor and exports. Schema 21 retains old network notes without inventing typed mappings. Declared availability does not establish runtime connectivity or native qualification.

[Physical storage and SAN readiness](docs/storage-readiness.md) link physical device eligibility, backend actions, FC/iSCSI interfaces, SAN routes and exact host/cluster attachments. Invalid pool devices leave inventory headroom unknown. Hardware capacity limits and S2D cache metadata memory retain explicit units. Schema 20 migrates new answers as unset; shared reports and schedules preserve observations without claiming runtime qualification.

[Host deployment contracts](docs/host-deployment.md) separate each machine's observed state, OS/role/membership actions and stage owners. Mixed expansion and explicit replacement retain prior identities and preservation evidence. Physical site, boot/PXE, firmware/profile and migration checks feed the editor, native handoff gates and shared reports. Schema 19 adds unanswered inputs to older projects; it never infers a current observation or authorization.

[Identity, artifact and Arc prerequisites](docs/prerequisites.md) link exact resources to directory/service/certificate identities and installation media. Planned checks remain distinct from operator observations; digest mismatches, expired certificates, conflicting forest/account intent and Arc addressing/connectivity choices stay visible. Schema 18 preserves existing and archived records without inventing assignments or evidence. The panel, reports and schedules share the same review.

[Availability placement and SQL/library contracts](docs/availability-details.md) connect declared failure domains to physical hosts, retain current/desired placement evidence, validate explicit SQL databases/replicas and separate HA library roles from backing storage. Schema 17 migrates prior projects without inventing placement or database assignments. The same contracts feed UI, validation, reports, schedules and topology; SQL synchronization and native failover remain unqualified.

[Availability and dependencies](docs/availability-and-dependencies.md) now distinguish product roles, SCOM voting/workload members, default database observers and correlated failures. Member sites, application cluster identities and site recovery contracts are separate from VM hosting. Schema 16 preserves prior values with these new answers unset. The website and exports show declared voting capacity with its assumptions; this is not runtime quorum or recovery evidence.

[Component omission](docs/component-omissions.md) preserves excluded instances, their complete configuration, reason and review owner. Omitted records are excluded from active totals and handoffs; retained dependencies and stages remain visible for review. Restoration returns the same identity without executing anything. Schema 15 migrates prior designs with no omissions and validates archived records as strictly as active ones.

[Component hosting and ownership](docs/component-hosting.md) adds observed provider identities, separate action owners, physical Windows server contracts and component network attachments. Schema 14 retains existing flags with new ownership/identity answers unset. Administration, backup, patching and other integration categories are available explicitly. Network and preservation rules feed the website and all design exports; no provider execution is implied.

[Management product contracts](docs/management-products.md) collect explicit roles, reviewed OS inputs, VMM/SCOM/SQL dependencies, WAC topology and supporting-service acceptance. Validation distinguishes role-specific support and installed/configured scope; existing services are not created implicitly. Schema 13 preserves older product notes and adds unanswered role inputs. Role and configuration schedules accompany the design package.

[OME planning](docs/ome-planning.md) adds release-specific device/plug-in sizing, explicit capacity-unit review, two-disk reconciliation, bounded discovery targets and eight manual acceptance milestones. Schema 12 retains unanswered decisions when migrating old OME records. Capacity and operator evidence are included in the website, package, PDF and workbook; no appliance installation or runtime acceptance is inferred.

[Management decisions](docs/management-decisions.md) explain capability-led candidates, deployment ownership, offline/Azure conflicts, preview gates and separate commercial reviews. The [dated support catalog](docs/support-catalog.md) retains vendor baselines, sources and limits across the website and reports. Schema 11 adds unanswered decisions to older projects without changing their inventories or requirements.

[Project scope and management dependencies](docs/project-scope.md) tailor the editor sequence while preserving records, collect a reviewed cluster management boundary and retain scenario/customer/support context in every design format. Schema 10 adds empty context to older projects. All fourteen editors remain available.

[Licensing assignments and quotes](docs/licensing-and-quotes.md) connect physical/per-VM core quantities to exact hosts or server VMs, entitlement allocations, quote evidence and separate currency/period estimates. Per-host peaks include maintenance/failover destinations. Unreviewed zero prices do not imply free licensing. Schema 9 preserves old quantities as manual/unquoted and introduces no entitlement assignment.

The [VMM physical-profile creation handoff](docs/vmm-profile-creation.md) collects exact image/Run As/NIC object identities, runtime credential references, membership, disk and driver decisions, and returned-profile acceptance. Desired profiles stay separate from existing profile references. Schema 8 adds empty creation inputs to older projects without implying authorization or a created object.

The [review workflow](docs/review-workflow.md) shows required-input progress by section and takes validation messages directly to their record and field. Keyboard focus and accessible labels stay consistent through edits. Input completion remains separate from support and runtime acceptance.

Storage review in 0.9.0 adds volume lifecycle and baselines, storage directories, workload/component/SDN disk allocations, SAN I/O routes and reviewed parity/nested layouts. Disk demand is reconciled within per-backend volume budgets, without double counting. The same assessment feeds JSON, Markdown, PDF and workbook/CSV exports. Read [storage planning](docs/storage-planning.md) for units, assumptions and qualification work. Storage schema 7 migration leaves new lifecycle intent and placement unset before upgrading to schema 8.

Quorum configuration collects file-share, cloud and disk witness settings, placement and acceptance criteria. The package contains a configuration record; implementation uses your existing tools.

Prepared-host cluster designs retain node, domain, management-network and desired cluster configuration. The configurator exports these settings without cluster-creation scripts.
Status: Development preview; full implementation goal remains active.

This is the standalone Hyper-V Configurator tool in the Configurators workspace. It is a separate website tool alongside Hyper-V Surveyor, Azure Local Surveyor and POC Configurator. It is not a section of Surveyor or an extension of the ProductLabs designer.

The implementation covers management-plane design, component placement and HA, cluster provisioning and VMM bare-metal collection, storage/network/identity, licensing, Dell OME appliance design and manual handoff, optional SDN design/setup, and reports and configuration exports.

Surveyor and the supplied Toolkit/environment repositories provide research material and interoperability examples. The Configurator owns its project model and workflow. Generating files does not deploy infrastructure; OME appliance installation remains manual.

- [Implementation tasks](docs/plans/implementation.md)
- [Design proposal](docs/plans/hyperv-configurator-design/outline.md)
- [Editable workflow diagrams](docs/plans/hyperv-configurator-design/flows.drawio)
- [Availability groups, prerequisites and schema migration](docs/availability-and-dependencies.md)
- [Stage ordering and resume review](docs/stage-plans.md)
- [VMM bare-metal configuration handoff](docs/vmm-bare-metal.md)
- [Discovery, provenance and drift review](docs/discovery-and-drift.md)

The parent repository uses npm workspaces and GitLab CI/Pages. Publication must use that repository's delivery path, with a green pipeline for the final commit and the published tool verified. Earlier goal wording referring to the external Surveyor repository and GitHub Pages is superseded by the user's explicit repository location.

## Test the designer

From the repository root, use native PowerShell:

```powershell
npm ci
npm run dev --workspace apps/hyperv-configurator
```

Open the local URL printed by Vite. The tool has fourteen navigation sections and eight fictional reference scenarios. Choose a scope, enter management and infrastructure records, review findings, then save the project or download a design package. Browser storage is separate from all other tools. A saved file can reopen the complete design.

```powershell
npm run check --workspace apps/hyperv-configurator
npm run test --workspace apps/hyperv-configurator
npm run test:browser --workspace apps/hyperv-configurator
```

Browser tests use installed Chrome on Windows. CI installs Chromium. Set `E2E_BASE_URL` to test an already served deployment; otherwise Playwright starts and stops a local Vite server. GitLab CI builds and publishes the website.

For the restricted TierPoint Pages site, authorized verification may supply `E2E_PAGES_TOKEN` through the process environment. It is accepted only with the TierPoint Pages origin; traces are disabled for these authenticated runs. Never place a token in a project, source file or test artifact.

## Implemented design capabilities

- Owned project schema, typed import validation, autosave, download/open and optional Hyper-V Surveyor import with source hash and original workload IDs.
- Management requirements; individual VMM, SCOM, SQL, WAC, identity/PKI, library/PXE, Arc, runner and Dell OME records; per-component lifecycle, hosting, resources, HA and product configuration.
- Structured service/database availability groups, component memberships, typed prerequisites, failure-domain tolerance and bootstrap/recovery ordering; schema 1 projects migrate without losing answers.
- Sites/clusters, host/BMC/PXE inventory and VMM provisioning profiles, storage systems, physical drive layout, thin/fixed volumes, network/address pools and NIC ownership.
- VMM profile configuration with image, Run As, BMC and network references, desired versus existing profile choices and an operator handoff.
- SDN scope, controller architectures, MUX/gateways, BGP peers, tenant services and setup handoff; host-resident controller resource accounting.
- Identity/media, licensing purchase gaps, operations/recovery, stage ownership and evidence records.
- Target-scoped stage plans, prerequisite ordering, cycle/missing-reference checks and operator resume review, with explicit distinction between entered observations and verified runtime evidence.
- Scoped discovery snapshots with source identities/times/file hashes, freshness and identity-conflict checks, explicit mapping review, preserve/adopt/reconcile decisions and retained history. Adoption changes the local design only. Inventory collection is performed by your existing tools; imported observations retain their provenance.
- JSON, environment YAML, Markdown/PDF reports, XLSX/CSV schedules, draw.io/PNG topology, validation and hashed ZIP manifest. Sharing exports replace free-text inventory and identifiers; normal project downloads preserve the full design.

## Configuration boundary

This is a configuration designer. It exports the Configurator-owned JSON/YAML model and design documents for your existing implementation process. It includes no deployment or inventory-collection scripts and requires no automation qualification. Existing environment observations may be imported as files.

OME installation remains manual in every phase. No private environment defaults or resolved secrets belong in source/examples. Normal user projects retain entered inventory; sharing mode sanitizes it and removes discovery source/history entirely. Reference examples deliberately leave version qualification and site-specific prerequisites for review.

The [SDN fabric and setup contract](docs/sdn-design.md) separates design intent, existing preservation, native ownership and architecture prerequisites. Schema 24 adds exact host/network/identity bindings, separate controller-host and NFV capacity, ordered handoff stages and conditional acceptance scenarios. Returned observations can be imported through the acceptance-evidence workflow; implementation uses the user's existing tools.
