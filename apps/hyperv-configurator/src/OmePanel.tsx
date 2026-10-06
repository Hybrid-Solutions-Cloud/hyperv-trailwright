import type {Component} from './project'
import {omeAppliancePlan,OME_CATALOG} from './omePlan'
export function OmePanel({component}:{component:Component}){
  const plan=omeAppliancePlan(component)
  return <section className="notice" aria-label="OME capacity and manual acceptance">
    <h3>OME sizing and operator handoff</h3>
    <p>Catalog {OME_CATALOG.version}, reviewed {OME_CATALOG.reviewedAt}. Appliance installation and acceptance remain manual.</p>
    {plan.vendor?<p>Reviewed vendor requirement: <strong>{plan.vendor.cores} cores; {plan.vendor.memoryGB} GB memory; {plan.vendor.primaryGB} + {plan.vendor.secondaryGB} GB disks.</strong></p>:<p>Capacity requirement is unresolved. Review the release, profile and every plug-in selection.</p>}
    {plan.required&&<p>After the selected unit review: {plan.required.vCpu} vCPU, {plan.required.memoryGiB} GiB memory, {plan.required.primaryDiskGiB} + {plan.required.secondaryDiskGiB} GiB disks. Enter allocations in Hosting and availability; values are not changed automatically.</p>}
    <p>Discovery expressions are checked without contacting devices. Address ranges include every address; DNS may overlap those ranges. They are not a discovered-device count.</p>
    <p>Entered acceptance and HTTPS reachability do not establish deployment completion. All runtime qualification remains pending.</p>
    <p><a href={OME_CATALOG.sources[0]} target="_blank" rel="noreferrer">Dell release-specific sizing and plug-in matrix</a></p>
  </section>
}
