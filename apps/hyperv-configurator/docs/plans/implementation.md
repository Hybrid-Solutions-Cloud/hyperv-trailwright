# Hyper-V Configurator completion plan

Updated: 2026-09-11
Target release: 0.33.0
Project schema: 30
Tracking: [GitLab issue #1](https://gitlab.com/tierpoint/prodtech/hybrid-cloud/toolkits/configurators/-/work_items/1)

Configuration traceability: [current capability map](traceability.md)

## Completion contract

Deliver and publish the standalone Hyper-V Configurator as a configuration designer. The user already owns deployment automation. This application must not create, bundle, qualify or execute infrastructure automation. Azure Local is assigned to another AI and is outside this plan.

Completion requires the configuration-only source to be committed, all required GitLab checks and Pages publication to pass for the exact commit, and the live application and downloaded package to be independently verified.

## Product boundary

- [x] Remove PowerShell deployment and inventory scripts, executable adapter plans, execution requests/runners and their tests.
- [x] Remove consumer and collector jobs from GitLab CI while retaining unit, browser, build, secret and Pages gates.
- [x] Remove adapter qualification from configuration readiness and validation.
- [x] Preserve external tool, owner and stage references as optional configuration data.
- [x] Keep OME installation manual and never infer infrastructure execution from an export or observation.
- [x] Confirm the final source tree and actual downloaded ZIPs contain no executable deployment or inventory files.

## Configuration workflow

- [x] Provide new blank projects, eight fictional reference designs, strict project open, download, browser autosave and unreadable-draft recovery.
- [x] Preserve project IDs, revisions, timestamps, inactive answers and schema migrations through schema 30.
- [x] Import an optional Surveyor JSON file without mutating Surveyor or double-counting imported demand.
- [x] Provide scope-aware navigation for management-only, cluster-only, combined and existing-environment designs while keeping all editors reachable.
- [x] Show live project identity, component/SDN capacity, unresolved finding count, required-input progress and licensing calculations.
- [x] Support repeatable records with stable IDs and field-linked validation navigation.
- [x] Preserve explicit new, preserve, adopt, configure, expand and replace lifecycle choices where applicable; never infer replacement.

## Configuration domains

- [x] Management requirements, recommendations, support references, component selection/omission, hosting and separate infrastructure/product/integration ownership.
- [x] VMM, SCOM, SQL, WAC, identity/PKI, library/PXE, Arc, runner-reference and Dell OME configuration.
- [x] Application/database/infrastructure availability, failure domains, voting, placement, dependencies, bootstrap and recovery.
- [x] Sites, physical hosts, BMC/PXE inventory, cluster topology, desired/existing VMM profiles and quorum/witness configuration.
- [x] SAN, S2D, SMB and local storage; physical drives, volumes, directories, workload placement, SAN paths and capacity/readiness review.
- [x] Host switches/Network ATC intent, physical adapters, vNICs, VLAN/MTU/RDMA/QoS, address ownership, pools and scoped overlap checks.
- [x] SDN controller architectures, underlay/HNV/VIP/tenant networks, BGP, ACL/load-balancer/NAT/gateway services, capacity, lifecycle ownership and acceptance scenarios.
- [x] Identity, DNS, PKI, media hashes, security, monitoring, patching, backup, recovery, RTO/RPO and evidence records.
- [x] Windows/System Center/SQL/access/Azure/OME/SDN dependency licensing, existing entitlements, purchase gaps and dated price estimates.
- [x] External observation import, provenance, freshness, preserve/adopt/reconcile decisions and SDN acceptance evidence without collection or execution code.

## Validation and outputs

- [x] Validate required inputs, references, duplicate identities/addresses, pool capacity, lifecycle conflicts, ownership, support, HA/bootstrap, storage, SDN and licensing dependencies.
- [x] Separate configuration completeness from user-entered runtime observations and deployment status.
- [x] Export canonical project JSON and domain YAML for hardware, storage, networking, management, availability, OME, SDN, identity, licensing and operations.
- [x] Export design, high-level design, implementation, low-level design, domain and validation Markdown.
- [x] Export design PDF, bill-of-materials CSV, Excel workbook and per-sheet CSV schedules.
- [x] Export editable draw.io and rendered PNG topology views.
- [x] Generate a ZIP manifest with exact byte sizes and SHA-256 hashes.
- [x] Retain complete answers in internal exports and sanitize private data, native IDs and observation history in shareable exports.
- [x] Verify actual PDF layout, workbook contents, diagrams, BOM, HLD/LLD, sanitization and every manifest hash from downloaded packages.

## Regression and acceptance

- [x] Pass TypeScript after the final source changes.
- [x] Pass the complete Hyper-V unit suite, including migrations, malformed/oversized imports, secrets, conditional validation, lifecycle preservation, HA/dependency cycles, capacity, licensing and deterministic output.
- [x] Pass the complete native Chrome browser suite.
- [x] Verify all eight reference designs round-trip and export.
- [x] Verify management-only, cluster-only, combined, existing/adopted, VMM-profile, witness, OME and SDN journeys.
- [x] Verify mobile layout, keyboard/field navigation, save/reopen, Surveyor import and actual package downloads.
- [x] Verify configuration readiness succeeds independently of deployment tooling.

## Release and publication

- [x] Set application version 0.33.0 and repository version 0.36.0; update lockfile and changelog.
- [x] Reconcile README, architecture, user guides and this checklist with the configuration-only scope.
- [x] Review the final diff for secrets, private environment data, unintended changes and existing-user regressions.
- [x] Commit with GitLab issue #1, push the feature branch and verify its exact-SHA pipeline.
- [x] Merge through the existing GitLab workflow and verify the main-branch Pages pipeline.
- [x] Verify the live restricted Pages application reports version 0.33.0 and the exact deployed commit.
- [x] Run critical live configuration journeys and independently inspect actual live ZIP contents and hashes.
- [x] Record final commit, pipeline, URL, verification evidence, limitations and rollback reference in the handoff and issue.

## Verified pre-release evidence

- Final TypeScript check passed. The complete suite passed 37 files and 450 tests.
- All 42 native Chrome journeys passed, including configuration-only VMM, cluster and quorum packages, mobile layout, field navigation, save/reopen and downloads.
- Thirty-one actual browser-downloaded ZIPs passed required-file, schema-30, configuration-purpose, forbidden-executable, exact-size and SHA-256 checks. Every package contained HLD, LLD, BOM, validation, PDF, workbook and editable/rendered diagrams.
- The reference-design PDF rendered as 52 pages and its first page was visually inspected. The VMM mobile review screen and reference-design topology PNG were visually inspected. The reference workbook contained 102 sheets and 420 nonempty rows; required readiness, IP/VLAN, host and validation sheets were present.
- Shareable sanitization remains covered across project, discovery, topology, management, host, storage, networking, SDN, operations and licensing tests. No credential-like added text or generated artifact entered the worktree.
- No local production build or infrastructure action was run.

## Published release evidence

- Release content merged through MR !4 as `8ee6103fd4d9ab7e89866059c990664eb5105753`.
- Exact-source branch pipeline 2842409491 passed all seven jobs. Main publication pipeline 2842414724 passed secret detection, workspace tests, ARM/Terraform/Ansible contracts, both application browser suites and Pages job 16459207355.
- Restricted Pages URL: `https://tierpoint.gitlab.io/prodtech/hybrid-cloud/toolkits/configurators/hyperv-configurator/`. The catalog entry, application version 0.33.0 and deployed commit matched the release content.
- All eight live reference designs passed save, reopen, mobile-overflow and package-download checks with zero browser errors. All eight live packages passed required-content, schema-30, configuration-purpose, forbidden-executable, exact-size and SHA-256 checks.
- No infrastructure deployment was attempted or required. Runtime deployment qualification remains external to this configuration designer.
- Rollback reference: `fdb7ebf4bd099b35e5565674b9c6740c3f56f2a0` (the immediately preceding published `main`).
