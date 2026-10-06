# Identity, media and Arc prerequisite review

Version 0.21.0 · schema 18 · primary references reviewed 2026-09-11.

In **Identity, security and media**, record the prerequisite first, then add a resource assignment. Assignments link stable design IDs; removing or omitting a consumer leaves the assignment visible with a finding. No identity, certificate, artifact or remote endpoint is created, retrieved or tested by the browser.

## Directory, service accounts and certificates

Domain records distinguish the domain lifecycle from use of an existing, new or external forest. Record DNS authority, resolver/time ownership, named trust directions, OU/pre-staging permissions, recovery and acceptance. Preserving a domain cannot imply creating a new forest.

Service accounts distinguish domain, local, virtual and Local System authority. gMSAs retain their forest/domain, KDS readiness, permitted retrieval principals and service eligibility. Assign one unambiguous logon identity to a VMM service; an assigned gMSA does not additionally require password credentials. A clustered VMM service cannot use Local System. Other product identities and exact-build permissions still need their own qualification. [VMM installation requirements](https://learn.microsoft.com/en-us/system-center/vmm/plan-install?view=sc-vmm-2025), [gMSA management](https://learn.microsoft.com/en-us/windows-server/identity/ad-ds/manage/group-managed-service-accounts/group-managed-service-accounts/manage-group-managed-service-accounts).

PKI records retain root/issuing/external authority, template, subject/SAN, expiration, enrollment/private-key ownership, trust/revocation review and renewal/recovery. Expired or invalid UTC dates are findings. Choose planned or operator-observed review; observations need an owner, UTC time and evidence. The plan preserves this assertion without certifying its authenticity or current reachability.

## Installation and automation artifacts

Record exact build/edition, original source, expected SHA-256, publisher policy and acquisition/cache ownership. Offline designs need a cache or external delivery contract. Keep the expected digest separate from the observed digest; a mismatch remains an error even when verification is described as complete. An observed verification requires its UTC time, reviewer and evidence. Merely entering a hash remains a plan.

Assign each artifact to a consumer and installation/update/driver/automation use. Driver injection requires a driver artifact. Product installations missing an explicit artifact assignment receive a review finding. A URI is provenance, not a download instruction; private source access uses a runtime credential reference. Proxy/source URLs containing embedded credentials or signed access tokens cannot be saved or reopened, including archived Arc records. Use an unsigned artifact location and a separate `keyvault://` or `secret-ref://` reference.

## Arc-enabled VMM

Select the actual VMM service and design/native VM network, cloud/host group and IP pool references. Keep tenant, subscription, resource group, region, bridge/extension builds, RBAC, onboarding/paid-service scope and dated support review explicit. Unknown VMM releases retain a support review.

The current VMM baseline uses static addresses and public endpoint connectivity, directly or through an explicit proxy. Collect separate appliance, upgrade and control-plane IPv4 addresses and review the full free-pool reservation. Duplicate, out-of-subnet and gateway assignments are rejected. Private-link-only deployment and DHCP remain conflicts. Free host-pool capacity and vendor units are reviewed separately from a bridge VM's allocated resources. [Arc-enabled VMM support matrix](https://learn.microsoft.com/en-us/azure/azure-arc/system-center-virtual-machine-manager/support-matrix-for-system-center-virtual-machine-manager).

Proxy inputs include an endpoint, runtime authentication reference, single X509 certificate/trust review and local endpoint/subnet exclusions. The current resource-bridge documentation allows explicit SSL terminating and passthrough proxies; do not reuse an obsolete blanket prohibition on TLS interception. VMM does not inherit VMware's Arc gateway preview exceptions. [Resource bridge network requirements](https://learn.microsoft.com/en-us/azure/azure-arc/resource-bridge/network-requirements).

## Persistence and reports

Schema 17 migration adds empty readiness fields and assignment collections to active and archived records. It does not invent observations or resource bindings. Old schema labels cannot carry new fields. Sanitized sharing removes free-text evidence, identities and source locations while remapping relationships.

The prerequisite panel, `plans/prerequisites.json`, `reports/prerequisites.md`, main Markdown/PDF report and **Prerequisite evidence** workbook/CSV retain the same assessment. `environment/identity.yml` and ordinary inventory schedules preserve all records. Editable topology links consumers, assignments and prerequisites. These states describe operator evidence and design review; runtime qualification remains pending.
