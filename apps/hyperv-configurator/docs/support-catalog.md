# Dated support catalog

The Configurator owns `src/supportCatalog.ts`, catalog 0.1.0 reviewed 2026-09-11. Its nineteen entries establish initial product/OS, HA, OME appliance, SDN architecture and deployment-tool baselines. Sources and version limits are retained in each entry. The [source review](support-source-review.md) explains the reviewed evidence and unresolved details.

Status applies to the named baseline and conditions, not to the entire saved design:

| Status | Meaning |
| --- | --- |
| Supported | The vendor documents the stated baseline; the conditions still require review. |
| Preview | The vendor labels the baseline preview. Accepting evaluation does not change this status. |
| Unknown | The combination, exact version or Configurator consumer has not been established. |
| Unavailable | The stated use is vendor-prohibited or explicitly outside the Configurator execution scope; `basis` distinguishes these cases. |

Explicit VMM/SCOM 2025 and OME 4.7 release labels select corresponding reference entries. Arbitrary build strings, other releases and ambiguous text stay unknown. WAC uses its explicit mode. SDN requires an explicit 2025 OS baseline; host-controller deployment-tool compatibility remains separately unknown. This matching locates reference baselines. It does not perform complete OS/role/build/HA validation or remove the component's support-evidence review.

The Product configuration and SDN screens show applicable references and conditions. Every package carries the full catalog, selected support-baselines JSON, support Markdown and a Support references workbook/CSV sheet. The PDF includes selected entries and their source URLs. Unselected catalog entries describe available research; they are not claims about the user's design.

To extend the catalog, verify the exact primary source and version section, add a dated baseline with its limits, test ambiguous/unlisted matching and preserve unknown consumer/runtime status until separately qualified. Do not carry a generic host OS matrix into a management-server role, a gateway edition allowance into compute hosts, or underlying hypervisor support into an unreviewed provider wrapper.

`src/supportCatalog.test.ts` verifies status/provenance separation, conservative release matching, provider wrappers and preview/SDN unknowns. `e2e/advisor.spec.ts` verifies visible source links, preview status and exported catalog/plan identities. A06 establishes this initial catalog; detailed product validation, broader versions, deployment adapters and native acceptance remain under their own plan tasks.
