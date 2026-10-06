# Host deployment contracts

Version 0.22.0 · project schema 19 · host plan 0.1.0. Primary references reviewed 2026-09-11.

Each host records its observed state, native cluster identity, observation time and evidence separately from selected OS, Hyper-V role and cluster-membership actions. Each action has its own owner. Missing observations remain unanswered; migration does not infer readiness from an older cluster-level choice.

A mixed expansion can preserve existing members while identifying new admissions. Existing cluster identity and membership/storage evidence remain explicit. Replacement records the prior machine, evacuation/data preservation, approved reimage scope and change window. Preserve/adopt cannot request changing actions. Foreign-cluster membership, duplicate physical identities and contradictory owners remain errors.

The VMM existing-profile consumer handles initial bare-metal host provisioning. The prepared-cluster consumer handles new single-site AD/DNS cluster formation from prepared hosts. Both consume the shared host errors and reject conflicting exported plans before operation. Expansion, replacement, other access points, complex networking and the remaining installation/acceptance stages need separately qualified consumers. A valid candidate remains runtime unqualified.

## Proposal sections 6–7 coverage

| Requirement group | Collected records and checks |
| --- | --- |
| Intent, state and owner | Cluster intent/lifecycle/authority; per-host observed state, OS/role/membership actions and owners; stage boundaries; mixed baseline and replacement scope |
| Cluster design | Site/rack and host identities; release/edition/build; AD/DNS access point, directory/OU, address; witness, reserve, VM/VHD paths, migration authentication/transport/concurrency/networks/delegation, security; multi-site RTO/RPO and recovery acceptance |
| VMM fabric | Management VMM service record; profile endpoint/version/module/host group/cloud/delegation; component capacity |
| Physical identity | One host per stable ID; vendor/model/serial/UUID/FQDN/site/rack; physical observation; duplicate identity and single-site correlation |
| BMC | Host address/protocol/port/firmware/certificate policy; scoped Run As ID or runtime secret reference; profile preflight |
| Boot/network | BIOS/UEFI and Secure Boot capability/policy; physical PXE adapter/MAC, boot order, DHCP reservation, PXE service/network/readiness; owning adapter and subnet checks |
| Deployment services | PXE/WDS component, registration, ADK/WinPE, boot drivers and endpoint/preflight readiness |
| OS image | Generalized media VHD/VHDX, version/hash and assignment acceptance; profile OS/install type/library/image edition-build-servicing review |
| Physical profile | Existing native profile ID/readback/time or desired definition; firmware and hardware applicability; boot/partition/OS/domain conflict checks |
| OS installation | Host boot disk identity and owning inventory reference, controller/RAID/layout; profile partition/disk configuration, locale/time zone/activation/domain/OU/answer-file inputs |
| Drivers/firmware | Driver media identity/hash and qualified hardware assignment; profile PnP/tags/readback; host firmware baseline/owner and hardware-support evidence |
| Host network profile | Physical management/PXE adapters; logical switch/uplink, host vNICs/classifications, physical profile IDs, network sites/pools; separate network records |
| Storage | Per-host boot/cache/capacity drives, inventory ownership, SAN/MPIO/S2D prerequisites and storage systems/volumes/allocations |
| Credentials | Distinct BMC/domain/computer-access Run As IDs and runtime credential references; no resolved credentials in the project |
| Safeguards and completion | Stable target IDs and existing workload inventory; preflight, replacement scope/window/stage owners; host/profile acceptance and separate native execution receipts |

Existing profile readback is editable without enabling profile creation. The generalization, exact image edition/build, hardware support and returned acceptance are reviewed inputs; entered text is not a verified external observation.

`hostDeploymentPlan.ts` supplies UI findings, `plans/host-deployment.json`, `reports/host-deployment.md`, the **Host deployment** workbook/CSV and PDF summary. Generic inventory sheets retain complete field values. Profiles, adapters and disks appear in the editable topology and raster export, linked by their actual references. Sanitized sharing remaps resource IDs and removes native identities/evidence.

`hostDeploymentPlan.test.ts` covers migrations, mixed expansion, preservation/replacement, physical/profile conflicts, export consistency and actual blocked consumer fixtures. `Test-HostDeploymentGuards.ps1` verifies those exports fail native offline validation. `e2e/host-deployment.spec.ts` exercises correction focus, mixed membership, save/open, mobile review and downloads. Native provisioning, failover, evacuation and runtime acceptance remain implementation-plan H tasks.

## Dated product rules

[VMM bare-metal guidance](https://learn.microsoft.com/en-us/system-center/vmm/hyper-v-bare-metal?view=sc-vmm-2025) distinguishes physical profile firmware, generalized library images, BMC/domain Run As scopes and deployment PXE prerequisites. The ordinary bare-metal path requires a reviewed same-subnet PXE design and non-disjoint namespace. Do not infer support from unrelated moniker rows or from an existing profile GUID alone.

[Hyper-V hardware requirements](https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/host-hardware-requirements) distinguish SLAT, firmware virtualization and DEP. Unknown observations are review findings; explicit unavailable capabilities are errors. A running hypervisor can hide individual capability output, so absence of that output does not mean unsupported hardware.

[New-Cluster](https://learn.microsoft.com/en-us/powershell/module/failoverclusters/new-cluster?view=windowsserver2025-ps) access-point choices have different role/management implications. [Add-ClusterNode](https://learn.microsoft.com/en-us/powershell/module/failoverclusters/add-clusternode?view=windowsserver2025-ps) requires admission validation across existing and proposed nodes. Neither design choice implies that the current new-cluster consumer implements expansion.

[Standalone live-migration guidance](https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/deploy/set-up-hosts-for-live-migration-without-failover-clustering) identifies the Windows Server 2025 Credential Guard/CredSSP interaction. This review distinguishes standalone migration errors from clustered policy review and does not confuse migration authentication with PowerShell remoting setup.
