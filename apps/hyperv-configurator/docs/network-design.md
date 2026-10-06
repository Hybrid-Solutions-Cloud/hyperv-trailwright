# Host network design

The Configurator owns explicit per-host switch/ATC intent records, physical member links, host interfaces and IP assignments. Legacy adapter switch names, team-member text and vNIC notes remain intact on schema20 migration; new mappings are empty until supplied by the operator.

Each physical adapter belongs to one switch or intent. Switch and adapter configuration ownership must agree. Preserved networks retain the existing owner; creation cannot reuse native identity; replacement requires explicit scope, recovery and a window. A typed mapping that contradicts the old switch name is flagged for reconciliation.

Network ATC on this Windows Server path requires Windows Server2025 and qualified physical hardware. Each intent is represented on every intended cluster node. The assessment compares traffic/address ownership, member adapter names, make, model, speed, driver, firmware, RDMA and MTU. Missing observations remain review findings. An automatic ATC storage address owner cannot also have operator static or DHCP assignments. These checks do not execute ATC or certify physical hardware.

Host interfaces retain their exact host, switch/intent or direct physical adapter and traffic-network references. VLAN, allowed-list, MTU and RDMA mismatches are rejected. RoCE requires tagged traffic and reviewed PFC/ETS; iWARP does not inherit a blanket PFC requirement. Physical Ethernet frame overhead is a separate acceptance item from interface IP MTU.

IP assignments and DHCP reservations are single addresses; exclusions are inclusive ranges. Pool accounting uses merged intervals, so overlapping exclusions and gateway reservations are counted once, including for large subnets. Collision checks use the network routing scope and allow isolated tenant reuse. Network/broadcast addresses are reserved in this managed LAN pool model; /31 point-to-point links require separate design review. Unknown or invalid boundaries yield unknown capacity. Remaining addresses describe only declared allocation, never discovered availability.

The shared assessment feeds review, JSON, Markdown, PDF, workbook/CSV and linked topology. Generic inventories retain all individual port/interface/address inputs. A successful export remains a design artifact; it does not execute infrastructure changes or establish runtime acceptance.

## Sources reviewed2026-09-11

- [Windows Server Network ATC prerequisites, intent ownership and configuration](https://learn.microsoft.com/en-us/windows-server/networking/network-atc/network-atc)
- [Windows Server physical S2D and SET hardware requirements](https://learn.microsoft.com/en-us/windows-server/storage/storage-spaces/storage-spaces-direct-hardware-requirements)

## Host QoS and VMM controls (schema 23)

Define each host DCB traffic class once and reference it from the host interfaces. Record its priorities, ETS or Strict algorithm, reservation, PFC state, configuration owner and physical acceptance. The budget counts unique classes rather than multiplying reservations by interface count. Review includes one default class, exclusive priority mappings, total ETS reservations, NIC class limits and DCBX ownership. Strict classes carry no ETS reservation. SET membership is limited to eight physical adapters; changes to management networking require an independent recovery plan.

VMM controls distinguish existing object GUIDs from new definitions for logical switches, logical networks, sites and address pools. Host-group scope, uplink profile/set selection and virtual port classifications remain separate inputs. A new definition cannot carry an existing native object identity. These records are detailed handoffs; they do not create VMM objects or qualify a network deployment consumer.

Existing host, cluster, management-component and active SDN management addresses participate in the same scoped collision and capacity checks as typed assignments. A matching typed assignment and legacy declaration for the same resource/address count once. Duplicate typed allocations and different resource owners still conflict. DHCP-only exclusions permit static allocations while preventing dynamic leasing; blank legacy exclusions retain the older unavailable-to-all meaning. Static addresses inside a DHCP pool require explicit DHCP-only exclusion or reservation treatment.

Host, cluster and VMM configuration reviews include errors affecting their selected hosts and shared address scopes. The exported network assessment retains those findings for the user's implementation process. Schema 22 migration creates no traffic classes or observed identities and preserves the old exclusion behavior.

The UI, network JSON/Markdown report, PDF, workbook, CSV and topology use the same assessment. `plans/network-controls.json` preserves the exact traffic classes and per-host totals; the Host QoS budget schedule shows class count, reserved ETS bandwidth and assigned priorities.

Additional primary sources reviewed 2026-09-11:

- [VMM logical switch configuration](https://learn.microsoft.com/en-us/system-center/vmm/network-switch?view=sc-vmm-2025)
- [VMM uplink and virtual port profiles](https://learn.microsoft.com/en-us/system-center/vmm/network-port-profile?view=sc-vmm-2025)
- [Windows DCB traffic classes](https://learn.microsoft.com/en-us/powershell/module/dcbqos/new-netqostrafficclass?view=windowsserver2025-ps)
- [Windows Server SET capabilities](https://learn.microsoft.com/en-us/windows-server/networking/sdn/technologies/hyper-v-network-virtualization/whats-new-hyperv-network-virtualization-windows-server)

D07 design collection/review and the joined schedules and differentiated topology views are implemented. Network implementation remains outside this configuration application.
