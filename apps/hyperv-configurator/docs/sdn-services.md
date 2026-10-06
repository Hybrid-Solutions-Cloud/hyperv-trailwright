# SDN tenant services

Version 0.29.0 adds structured service design to the [SDN fabric workflow](sdn-design.md). The designer collects security rules, load balancing, NAT and tenant gateway connections. Generated packages remain design and setup handoffs; no native SDN execution or returned acceptance result is implied.

## Design sequence

1. Define the fabric, participating hosts and controller/MUX/gateway resources. Select exact versions, one setup owner and existing-object preservation requirements.
2. Create tenant-purpose network records and tenant services. Reuse the exact tenant identifier for its subnets; separate network records and routing scopes allow isolated tenants to reuse address ranges.
3. For security policy, add subnet/interface attachments, direction, action, protocol, priority, source/destination prefixes, port ranges, logging and expected traffic results.
4. For load balancing or NAT, create frontend records, backend pools and exact interface/IP-configuration members. Add probes before load-balancing rules. A shared frontend supports multiple distinct listener ports. Inbound NAT targets one member; outbound NAT requires a public VIP frontend.
5. Create gateway pools and map their gateway VMs. Add IPsec, GRE or L3 connections owned by tenant gateway services, then their static routes or BGP requirements. IPsec/BGP authentication inputs contain secret references only.
6. Review validation findings, gateway capacity and ordered setup targets. Save the project and export the package for review.

## Choices and checks

| Area | Collected inputs and review |
|---|---|
| ACL | Subnet or interface attachment; inbound/outbound; allow/deny; TCP/UDP/ICMP/all; unique priority within policy and direction; canonical IPv4 prefixes and port ranges |
| Frontend | Public VIP or internal tenant VIP, explicit network and usable address; collision checks respect routing scope |
| Backend | Pool, exact native interface IP-configuration identifier, tenant network, address and preservation evidence |
| Probe | TCP or HTTP, port, interval, threshold; HTTP request path and probe-source reachability |
| Traffic rule | Load balance, inbound NAT or outbound NAT; shared frontend; pool or single member; probe; protocol, ports, idle timeout and applicable distribution/direct-server-return choices |
| Gateway pool | Connection type, lifecycle, single configuration owner, native identity/baseline, member allocations and unavailable-member reserve |
| Connection | IPsec/GRE/L3, mapped tenant and gateway pool, remote address, directional demand, applicable tunnel or transport details, static/BGP routing and route acceptance |

Tenant service children inherit the parent's lifecycle and native configuration owner. Gateway pools declare their own lifecycle and owner; membership records refer to those pools. Existing children and pools require native identities and baselines. New records cannot claim existing identities. Backend/probe/frontend references must belong to the same owning service. The editor preserves inactive answers when a rule or connection type changes, while active validation and the service plan omit those fields.

## Gateway capacity

Enter each VM's declared total throughput and its allocation to each pool. Shared VM allocations must fit that total. Within a pool, the capacity calculation removes the largest allocations according to the unavailable-member reserve. Demand is the sum of the greater of inbound and outbound Mbps for each connection. Headroom is remaining capacity minus demand. This is a conservative planning budget based on supplied evidence, not measured failover or throughput.

Missing member capacity evidence or invalid reserve values leave available capacity and headroom **Unknown**. They do not become zero or a successful sizing result. Review physical failure domains separately; a member-count reserve alone does not establish site resilience.

## Outputs and migration

- `plans/sdn-services.json`: active typed objects, findings, gateway budgets, source references and explicit unqualified/unexecuted status.
- `plans/sdn-design.json`: fabric assessment and ordered stages, including gateway pools/membership, tenant-service objects and acceptance targets.
- `environment/sdn.yml`: saved design inputs for a downstream consumer contract, including preserved inactive answers.
- `reports/sdn-services.md`, design PDF, workbook and CSV schedules: reviewable service details. The workbook includes SDN fabric parameters and gateway capacity.
- Topology and package manifest: linked records and file hashes. A valid hash verifies package integrity, not operational acceptance.

Schema 25 adds ten empty service collections when opening schema 24 projects. Previous notes stay intact; migration invents no tenant rules, native identities or evidence. Newer projects must be opened with a version supporting schema 25. Returned SDN evidence import is described in [the evidence guide](sdn-evidence.md). Exact tool-specific constraints, native adapters and infrastructure qualification remain tracked in the [implementation checklist](plans/implementation.md).

## Sources

The model separates frontends, backend pools, probes and traffic rules following [Microsoft's SLB and NAT guidance](https://learn.microsoft.com/en-us/windows-server/networking/sdn/manage/configure-slb-and-nat). ACL fields follow the [Network Controller ACL cmdlet](https://learn.microsoft.com/en-us/powershell/module/networkcontroller/new-networkcontrolleraccesscontrollist?view=windowsserver2025-ps). Tenant connections and pools follow the [virtual gateway guidance](https://learn.microsoft.com/en-us/windows-server/networking/sdn/manage/add-a-virtual-gateway-to-a-tenant-virtual-network). The VMM path retains its [SLB-before-gateway prerequisite](https://learn.microsoft.com/en-us/system-center/vmm/sdn-gateway?view=sc-vmm-2025). The implementation team must confirm exact-version compatibility in its existing tooling.
