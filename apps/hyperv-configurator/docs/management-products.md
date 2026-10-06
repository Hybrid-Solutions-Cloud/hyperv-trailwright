# Management product configuration contracts

Schema 13 adds unanswered role and OS fields to schema 12 projects while preserving earlier product configuration and component identities. Unknown keys/choices and future-field smuggling are rejected. Inactive role inputs remain saved for review when the role changes.

Each selected component owns its product role, exact build, OS/edition/install type, dependencies and acceptance criteria. Existing generic product notes remain intact. Empty new fields do not select a role or create a new SQL, directory, PKI or other service. Product installation and integration remain separate hosting choices.

VMM service and console roles are distinct. Service design includes the service topology/endpoint, clustered address, DKM permissions, runtime identity, Run As scope, SQL and library contracts, ADK/WinPE and fabric delegation. The reviewed 2025 management-server OS baseline applies to the service role; it is not a generic console or managed-host OS rule. See [VMM requirements](https://learn.microsoft.com/en-us/system-center/vmm/system-requirements?view=sc-vmm-2025) and [service HA](https://learn.microsoft.com/en-us/system-center/vmm/plan-ha-install?view=sc-vmm-2025).

SCOM primary role controls the required dependencies. Management servers, gateways, web, reporting, console and ACS have separate inputs; additional co-located roles require review. The 2025 matrix permits Server Core for management/gateway roles. The Operations console additionally has Windows client support. Agent OS support does not establish server-role support. See [SCOM requirements](https://learn.microsoft.com/en-us/system-center/scom/system-requirements?view=sc-om-2025), reviewed 2026-09-11.

SQL design retains instance, collation, paths, topology and database mapping while adding authentication, service identities, build/CU, per-database storage, replica placement and acceptance. Standard-edition AG limits and external SQL services remain explicit product-specific reviews. The form does not certify an edition feature, SQL PaaS compatibility or included licensing rights. See [SCOM database design](https://learn.microsoft.com/en-us/system-center/scom/plan-sqlserver-design?view=sc-om-2025).

WAC mode and deployment topology must agree. Virtualization Mode has a dedicated gateway, reviewed OS and resource prerequisites; allocated disk and free disk are collected separately. It remains preview even when accepted. See [WAC Virtualization Mode installation](https://learn.microsoft.com/en-us/windows-server/manage/windows-admin-center/install-virtualization-mode).

Identity/PKI, library/PXE, Arc and implementation-runner references retain support, access, artifact integrity and recovery ownership. Azure resource IDs and versions describe intended or existing resources; supplying text does not create or authenticate them. Runtime secrets use references. The user's external implementation process owns execution and authentication.

The website, validation and `plans/management-products.json` share `managementProductPlan.ts`. The package includes a product Markdown report, all product inputs in design PDF/YAML, and Management roles / Product configuration workbook and CSV schedules. Existing free-text configuration remains visible and exported. Sharing copies remove identities, endpoints and evidence while retaining role/OS selections.
