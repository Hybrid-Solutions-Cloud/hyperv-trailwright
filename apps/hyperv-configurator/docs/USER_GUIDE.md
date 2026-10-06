# Using the Hyper-V Configurator

The Hyper-V Configurator turns platform decisions into a complete, reviewable Hyper-V design: management services, hosts and clusters, storage, networking, SDN, identity, licensing, operations and the implementation handoff. It is a configuration designer. Packages contain design data and reports only — no deployment scripts or automation code — and nothing runs against infrastructure.

## Start a design

| Action | Use it when |
|---|---|
| New blank project | You are starting from scratch |
| **Load example** | You want to explore one of the eight fictional reference designs |
| **Open project** | You have a saved Configurator project (JSON, up to 2 MiB). Older project schemas are migrated with new answers left unset; files from a newer version are rejected. |
| **Import Hyper-V Surveyor plan** | You sized the platform in Hyper-V Surveyor. Workload requirements and management selections come across with their source hash and original workload IDs, so nothing is retyped. |

## Save and recover

- Changes autosave in this browser.
- **Download project** saves the complete design as JSON. Use it to move between devices or keep a record.
- If a saved browser draft cannot be read, it is kept rather than overwritten, and **Download recovery copy** lets you take it away.
- If a section ever fails to display, a recovery screen confirms the draft is still saved and offers a reload.

## Choose the scope

Project scope sets the suggested order of sections. It never deletes records or authorises deployment.

| Scope | What it focuses on |
|---|---|
| Management plane only | Management requirements, hosting, availability and products. Host provisioning is skipped when management runs on an external platform. |
| Cluster only | Sites, clusters, hosts, storage and networking, plus how management is supplied: existing, another team, not required, or deferred |
| Management and cluster | All fourteen sections in sequence |
| Document an existing environment | Inventory for management services, host platforms or both, without inventing a workload cluster |

Select **Show all 14 sections** to reach any section regardless of scope. Sections that already contain records always stay in the sequence.

## The fourteen sections

| Section | Purpose |
|---|---|
| Project | Define the scope and ownership of this design |
| Management requirements | Choose capabilities and the components that provide them |
| Hosting and availability | Place each component and record independent availability and recovery decisions |
| Sites and clusters | Define the estate you will build, expand or adopt |
| Hosts and provisioning | Collect physical identities and complete provisioning profiles |
| Storage | Define storage systems, disks, volumes and ownership |
| Networking and IP plan | Map adapters, traffic, addresses and network ownership |
| SDN design and setup | Choose SDN architecture, services, placement and setup ownership |
| Identity, security and media | Record prerequisites, identities, certificate ownership and installation media |
| Product configuration | Complete the selected products' configuration and integration details |
| Licensing and costs | Record entitlements, applicable rights, quote assumptions and purchase gaps |
| Operations and recovery | Assign maintenance, monitoring, backup and recovery responsibilities |
| Automation and handoff | Assign each stage, its inputs, acceptance checks and evidence |
| Review and exports | Review completeness and download the design and implementation handoff |

## Component decisions

Each infrastructure component starts with a question: is it used in this design, and if so, what kind? The answer decides which follow-up questions appear. The **Networking and IP plan** section opens with a **Network components in this design** panel, and **Operations and recovery** opens with **Backup and monitoring decisions**.

Every gate starts unanswered. There are three states:

- **Unanswered** — the follow-up questions stay visible, Review and exports shows an error asking you to decide, and the component is left out of the exports.
- **Not used** — the follow-up questions and the component's record collections are hidden. Your earlier answers and records stay in the project and return if you change the answer. The component is left out of the exports.
- **Used** — the follow-up questions appear. Required follow-ups that are empty show as errors.

| Question | Answers | What the answer shows next |
|---|---|---|
| Firewall in this design | TierPoint-managed Fortinet FortiGate, customer-owned firewall, or no firewall | FortiGate: model, HA mode, FortiOS version, WAN / public IPs and VDOMs, plus the Firewall units, Firewall interfaces and Firewall VLAN gateways and DHCP collections. Customer firewall: vendor and model, gateway IPs, and owner and contact. |
| Azure site-to-site VPN | Used or not used | On-premises public IP and VPN device, Azure VPN gateway SKU, mode and GatewaySubnet, address spaces on both sides, IKE version, IPsec policy (custom parameters for a custom policy), shared key reference, and routing. BGP asks for both ASNs and peer IPs. |
| Point-to-site VPN | Used or not used | Client address pool, tunnel type and authentication. Entra ID asks for the tenant URL and audience; certificate asks for the root certificate; RADIUS asks for the servers and a secret reference. The gateway SKU, mode and subnet are asked once for either VPN. |
| ExpressRoute / private connectivity | Used or not used | Provider, circuit name, peering location, bandwidth, SKU, private peering subnets, VLAN, customer ASN and MD5 key reference. |
| Top-of-rack switches | Dell PowerSwitch (TierPoint-supplied), customer-owned switches, or none | Model, OS and version, pairing (VLT or MLAG asks for the domain ID and peer-link ports), uplinks and MTU, plus the Top-of-rack switches collection and the ToR switch and port on each adapter. Customer switches also ask for vendor and owner. Storage VLANs, RDMA, PFC priorities and ETS shares appear only when an S2D storage system is switched. |
| Out-of-band management | Standard OOB management switch, Opengear with Lighthouse, or none | OOB VLAN and network, the Out-of-band devices collection, and the BMC OOB device and port on each host. Opengear adds the Lighthouse instance, address, port, enrollment token reference and bundle, serial port count, cellular failover and the Console port map. |
| Backup in this design | Used or not used | Backup product, level, server location, dedicated network and owner. **Not used** also hides the backup fields on operations plans and targets and the Recovery tests collection. |
| Monitoring in this design | Used or not used | Monitoring platform (Azure Monitor asks for the Log Analytics workspace), owner, and the syslog / SNMP destination for network devices. **Not used** also hides the monitoring fields on operations plans and targets and the Capacity alerts collection. |

For backup and monitoring, the existing operations fields stay visible while the gate is unanswered; they hide only after an explicit **Not used**.

Two related choices are made on records rather than in a panel:

- **S2D storage connectivity** (each S2D storage system) — switched, or switchless with one or two direct links per node pair. A switchless design needs a direct link from every node to every other node: the review flags a node with too few storage adapters, and warns above four nodes.
- **Witness** (each cluster) — none, file share, cloud or disk. Anything other than none asks for a reference; a file share asks for the UNC path and share identity.

Credentials in these panels are references only (`keyvault://` or `secret-ref://`), never the secret itself.

### Where the decisions appear

- `infrastructure.yml` starts with a `decisions` section: every gate, its answer (or `unanswered`) and whether the component is used, plus storage, SDN and witness choices. The rest of the file holds data only for components in use.
- `environment/network-devices.yml` holds the firewall, switch, out-of-band and console port records for components in use.
- The design report, PDF and workbook list the decisions that apply.

## How choices change the screens

Answers hidden by a later choice are kept in the project, so switching back restores them.

- **Storage system kind** — Fibre Channel shows fabric, zoning, WWPN and MPIO fields; iSCSI shows target portals, initiator IQNs, MPIO and an authentication reference; S2D shows disk eligibility; SMB shows share permissions and authentication; local storage asks for the owning host.
- **SAN I/O paths** appear once the design has a Fibre Channel or iSCSI storage system, and stay visible while any path is recorded.
- **SDN scope** of none hides every SDN section and produces no SDN files.
- **VMM provisioning profile** — using an existing profile asks for its reference; defining a new profile asks for image, Run As, NIC, disk and driver details.
- **Dell OpenManage Enterprise** is designed here and installed manually; its installer and guest configuration controls are not offered.

The configurator page's **Decision map** lists every key choice, what it shows, what it hides and what it produces.

## Help and corrections

- Fields with extra guidance have an **i** button. Hover over it, tab to it, or tap it to read the help; press Escape to close it.
- **Review and exports** lists required inputs by section and every finding. Select a finding — or tab to it and press Enter — to open its record and focus the exact field.
- Completing required inputs is separate from product support review and from runtime acceptance. An empty error count is not deployment readiness.

## Export the design

A package includes the project JSON, the master `infrastructure.yml`, configuration YAML per domain (including `environment/network-devices.yml`), high-level and low-level design, implementation and validation reports in Markdown, a design PDF, an Excel workbook with CSV schedules, a bill of materials, editable draw.io and PNG topology views, and a manifest with every file's size and SHA-256.

- A **normal** package keeps the complete design, including private names and identifiers.
- A **shareable** package removes private names, native identifiers, evidence and discovery history while keeping the architecture and quantities.

## Returned evidence

- **SDN acceptance evidence** — export a scoped request, run tests with your own tooling, and import the results. See [SDN acceptance evidence](sdn-evidence.md).
- **Discovery snapshots** — import inventory collected by your existing tools and review drift field by field. See [discovery and drift](discovery-and-drift.md).

Imported observations are unsigned operator evidence; they never mark a stage deployed or qualify automation.

## Related documentation

- [Architecture](architecture.md), [project scope](project-scope.md) and [review workflow](review-workflow.md)
- [Storage planning](storage-planning.md), [network design](network-design.md) and [SDN design](sdn-design.md)
- [Licensing and quotes](licensing-and-quotes.md) and [OME planning](ome-planning.md)
- [Changelog](../CHANGELOG.md)
