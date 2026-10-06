# Component hosting and ownership

Each component retains its independent hosting choice: management/workload/existing Hyper-V, vSphere, Cloud Director, a dedicated physical Windows server, or an externally supplied service. Existing resources have an immutable provider ID, observed-state reference and timestamp. Provider names remain descriptive; IDs and reviewed contracts define the handoff target. These inputs do not qualify or execute a provider adapter.

Select infrastructure creation, guest configuration, product installation and integration configuration separately. Every selected action needs its own owner. Guest-only work on an existing VMware VM does not select VM creation or product installation. Preserve/use-existing cannot contain mutation actions; choose Configure existing for an explicit change. External service contracts cannot create a guest or install its OS/product. OME appliance import, first boot and installation remain manual.

Hypervisor contracts collect endpoint/version, credential reference, native organization/datacenter, pool/cluster/Org VDC, folder/vApp, datastore/policy and template identities as applicable. Pin the consuming tool and its qualification/target-boundary evidence. Physical server contracts collect hardware identity, OOB references, firmware, boot/storage/NIC inventory and existing-state preservation without inventing Hyper-V host or cluster membership. Administration, backup, patching and generic integration categories can be selected explicitly; none is created automatically.

## Component network attachments

Add one attachment per VM/server NIC in Networking and IP plan. Link the component and design network, then collect its lifecycle, existing adapter identity, provider network ID, guest adapter/MAC, address assignment, VLAN/isolation mapping, owner and acceptance. Existing/configured adapters need an immutable ID; changes to a preserved component are rejected.

Static IPv4 addresses require a prefix matching the selected design subnet, usable host/gateway addresses and valid IPv4 DNS servers. Duplicate addresses are checked only within an explicit routing scope. MAC duplication is checked within a design network. Isolated networks may reuse addresses. These checks do not discover current assignments or perform network operations. Retained static inputs are inactive when DHCP is selected.

## Migration and outputs

Schema 14 adds empty hosting contracts and network attachments to prior projects, retaining existing action flags and identities. Migration does not infer owners or provider IDs. Unknown fields and schema-inappropriate component categories are rejected. Sharing copies scrub provider identity, credentials and observation evidence while preserving internal component/network links.

The website, validation and `plans/component-hosting.json` share the same plan. The package adds hosting Markdown, component-network YAML and action-owner/network worksheets and CSVs; generic PDF, inventory and topology retain the complete design. Every component plan has `executionReady: false`. Provider execution, scoped authorization and authenticated runtime acceptance remain separate requirements.
