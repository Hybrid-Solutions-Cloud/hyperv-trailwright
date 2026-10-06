# Support source review

Reviewed 2026-09-11 for the initial support catalog. These source findings supply reference baselines; complete per-field validation and native runtime qualification remain separate. Initial baselines are System Center 2025, current WAC modes, OME 4.7 and Windows Server 2025 SDN. Other versions need separate entries; no substring match may certify an entire configuration.

## Microsoft management products

VMM 2025 distinguishes management-server OS from managed-host OS: its server/library rows list Windows Server 2025 Core and Desktop Experience; managed Hyper-V hosts include Windows Server 2019, 2022 and 2025, while standalone Hyper-V Server 2019 is explicitly excluded. SQL dependencies list 2019, 2022 and 2025. VMM requires domain membership and cannot install in the Hyper-V parent OS. [VMM 2025 requirements](https://learn.microsoft.com/en-us/system-center/vmm/system-requirements?view=sc-vmm-2025).

VMM service, SQL and library HA are separate. The service cluster requires DKM and its service account; stretched VMM management clusters are unsupported. SQL and clustered library shares do not belong on the VMM service cluster. [VMM HA planning](https://learn.microsoft.com/en-us/system-center/vmm/plan-ha-install?view=sc-vmm-2025).

SCOM 2025 management and gateway roles support Windows Server 2022/2025, including Core. Web console, ACS collector, operations console and reporting have different Core restrictions. VM pause/save-state and snapshot-style recovery have restrictions and cannot be treated as application recovery. [SCOM role requirements](https://learn.microsoft.com/en-us/system-center/scom/system-requirements?view=sc-om-2025).

SCOM SQL requirements include update-rollup gates; SQL Server 2025 support begins at SCOM 2025 UR1. Supported SQL engine/SSRS versions and updates, Windows authentication, Full Text Search, collation and database HA need separate checks. Ordinary SCOM does not support SQL PaaS such as Azure SQL MI or RDS; Azure Monitor SCOM Managed Instance is a distinct exception. Shared instances are discouraged for performance; that is not itself a licensing prohibition. [SCOM SQL design](https://learn.microsoft.com/en-us/system-center/scom/plan-sqlserver-design?view=sc-om-2025). Learn's rendered extraction includes multiple product-version sections; use the exact 2025 moniker before encoding all version rows.

SCOM DR includes separate management-group or recovery-site patterns. Existing examples contain older SQL versions; use them for topology reasoning only and verify versions against the current SQL matrix. [SCOM HA/DR](https://learn.microsoft.com/en-us/system-center/scom/plan-hadr-design?view=sc-om-2025).

WAC Administration Mode lists Windows Server 2016/2019/2022/2025 gateway, managed-server and failover-cluster installations. [WAC installation options](https://learn.microsoft.com/en-us/windows-server/manage/windows-admin-center/plan/installation-options). Virtualization Mode is preview, uses a separate dedicated system from Administration Mode, and lists Windows Server 2025+ Standard/Datacenter, domain/FQDN and same-domain managed-host requirements. Its baseline is 4 CPU, 8 GB RAM and 10 GB free disk. [Virtualization Mode installation](https://learn.microsoft.com/en-us/windows-server/manage/windows-admin-center/install-virtualization-mode). Managed compute hosts separately require Windows Server 2025+ Datacenter; do not apply the gateway's Standard allowance to compute hosts. [Virtualization Mode resources](https://learn.microsoft.com/en-us/windows-server/manage/windows-admin-center/add-virtualization-mode-resources).

Arc-enabled VMM is additive to VMM and requires its subscription/RBAC, resource bridge and ongoing outbound connectivity. Server/console rollups must match; direct guest-agent installation has its own version gates. [Arc-enabled VMM matrix](https://learn.microsoft.com/en-us/azure/azure-arc/system-center-virtual-machine-manager/support-matrix-for-system-center-virtual-machine-manager).

## Dell OME 4.7

The release matrix lists Hyper-V on Windows Server 2022/2025 and ESXi 8.0/U1/U2/U3, 9.0 and 9.1, with additional KVM/AHV/Proxmox/OpenShift platforms. It separately lists managed-device OS support. Its general guide is broader, so use the release matrix and retain any discrepancy for review. [OME 4.7 matrix](https://www.dell.com/support/kbdoc/en-uk/000423997/openmanage-enterprise-4-7-support-matrix?lang=en), [appliance host guide](https://www.dell.com/support/manuals/en-us/dell-openmanage-enterprise/ome_p_4_7_online_help_user_guide/host-system-requirements?guid=guid-54cbd632-cf9e-40b1-8420-085d49196e10&lang=en-us).

Sizing bands: below 1,000 devices, base 19 GB/4 cores; 1,000–8,000, base 40 GB/16 cores. Plug-in RAM increments differ by band. The matrix's 25,000-device tier requires 256 GB/64 cores and excludes plug-ins. Generic storage is two 415-GB drives; the large-scale metric configuration expands the primary to 600 GB, total 1,015 GB. Preserve decimal vendor GB separately from Configurator GiB; do not silently treat them as identical. Confirm the 8,001–24,999 transition and enabled metrics before emitting an exact profile. Manual installation remains required by the user's scope. [OME sizing tables](https://www.dell.com/support/kbdoc/en-uk/000423997/openmanage-enterprise-4-7-support-matrix?lang=en).

The plug-in matrix pins Services 4.7, AIOps 2.7, Update Manager 2.1, OMEVV 1.10, VMM/MCM 1.9 and SCOM 1.8. Device/model/firmware support and feature entitlements remain separate. [OME plug-in table](https://www.dell.com/support/kbdoc/en-uk/000423997/openmanage-enterprise-4-7-support-matrix?lang=en).

## SDN and execution

Windows Server 2025 supports Network Controller as a host failover-cluster service while continuing Service Fabric-based support. SLB and gateways remain VMs. Host-controller support does not establish compatibility with every VMM/SDN Express version. [Network Controller architecture](https://learn.microsoft.com/en-us/windows-server/networking/sdn/technologies/network-controller/network-controller-failover-clustering).

VMM documents deployment/management of controllers, SLB and gateways through its own fabric contracts. The overview is insufficient to qualify the host-cluster-role architecture or a specific automation consumer. [VMM SDN](https://learn.microsoft.com/en-us/system-center/vmm/deploy-sdn?view=sc-vmm-2025). The website's existing candidate VMM, cluster and quorum adapters remain runtime-unqualified. No provider, DSC, installation or SDN path gains execution support from this source review.

## Questionnaire source

Read-only reference: `apps/hyperv-surveyor/src/data/managementPlane.ts` and `managementWorkbook.generated.ts`. The reference has additional Azure readiness/portal, prepared-cluster, optimization, integration, migration, scale, support and automation questions. Its preferred-preview scoring is not a Configurator requirement; the Configurator needs explicit capability rationale, owner selection and version gates. Surveyor remains a reference, not a runtime dependency.
