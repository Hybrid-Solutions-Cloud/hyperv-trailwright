# Standalone Hyper-V Configurator architecture

Version: 0.34.0
Project schema: 31

The Hyper-V Configurator is an independent React/Vite browser application in the Configurators npm workspace. It owns its project schema, field catalog, validation, calculations and reports. Hyper-V Surveyor is an optional file-import source. No Surveyor, ProductLabs or deployment-tool runtime is required.

## Product boundary

The application designs and documents Hyper-V environments. It does not deploy, configure or inventory infrastructure. The user supplies observations from existing tools and uses the exported configuration with an implementation process outside this application.

The source and generated packages contain no deployment scripts, inventory collectors, executable adapter plans, execution requests or runner code. References to PowerShell, VMM, Ansible, Terraform, DSC and other tools are retained only as selected ownership or implementation metadata. Dell OME appliance installation remains a manual task.

## Project model and workflow

`src/project.ts` owns the project discriminator, schema, migrations, limits, identity, revisions and strict parsing. `src/catalog.ts` owns the conditional fields and repeatable collections. Unsupported fields, malformed types, invalid enum choices, oversized imports, embedded credentials and future schemas are rejected before replacing the current draft.

`src/App.tsx` provides project creation, autosave, recovery of unreadable browser drafts, project download/open, optional Surveyor import and scoped navigation. Inactive conditional answers remain in the canonical project so a user can change a choice without losing prior work. Lifecycle values distinguish preserve, adopt, configure, expand, replace and new resources where applicable.

## Configuration domains

The owned model covers project context, management requirements, component hosting and availability, sites, physical hosts, clusters and witnesses, VMM profiles, storage, networks and IP allocation, SDN architecture and tenant services, identity and media, product settings, licensing, operations, recovery and implementation stages.

Domain planners derive findings and report data without mutating the project. Calculations keep physical capacity, virtual demand, externally supplied capacity, licensing quantities and recurring/perpetual costs separate. Imported observations retain source bytes, timestamps, hashes and review decisions; adoption updates only the selected design value.

## Validation and readiness

`src/validation.ts` combines field, reference, lifecycle, support, capacity, address, ownership, HA, bootstrap, licensing and cross-domain rules. Findings link back to their owning record and field.

`src/projectReadiness.ts` reports `draft` or `design-complete` from required inputs, errors and outstanding reviews. It separately reports user-entered observation state. Configuration completeness does not depend on a bundled automation consumer, deployment lab or runner qualification, and the application never claims deployment success.

## Outputs

`src/exports.ts` creates:

- reopenable canonical `project.json`;
- configuration YAML for hardware, storage, networking, SDN, identity, management, availability, OME, licensing and operations;
- high-level design, low-level design, implementation, domain and validation Markdown;
- a design PDF;
- a bill of materials CSV and Excel workbook with per-domain CSV schedules;
- editable draw.io topology plus rendered PNG views;
- a manifest containing the exact byte size and SHA-256 of every packaged file.

Normal exports retain the complete design. Shareable exports sanitize private names, native identifiers, evidence and discovery history while preserving architecture and quantities. Spreadsheet formula prefixes are escaped. ZIP timestamps are fixed for deterministic content except the manifest generation time.

## Verification and publication

Vitest covers schema migrations, strict parsing, configuration rules, calculations, deterministic exports and all eight reference scenarios. Playwright covers scoped workflows, validation navigation, save/open, imports, configuration editing, mobile layouts and downloaded ZIP integrity. Configuration-boundary tests reject executable files and `adapters/` or `execution/` directories in generated packages.

GitLab CI runs secret detection, unit tests, browser tests and the repository build. Pages publication depends on those checks. The generated `version.json` records the application version and CI commit SHA for exact live verification. Existing Pages access controls remain unchanged.
