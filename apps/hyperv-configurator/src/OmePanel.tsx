import type {Component} from './project'
import {omeAppliancePlan,OME_CATALOG} from './omePlan'
import {DELL_OME} from './omeFields'
export function OmePanel({component}:{component:Component}){
  const plan=omeAppliancePlan(component),dell=component.productDetails.platform===DELL_OME
  return <section className="notice" aria-label="Hardware management capacity and manual acceptance">
    <h3>{plan.platformLabel||'Hardware management appliance'} sizing and operator handoff</h3>
    {!plan.platformLabel&&<p>Choose the hardware management platform first. Dell OpenManage Enterprise uses the built-in sizing catalog; HPE OneView, Lenovo XClarity Administrator and other appliances use the vendor's release-specific sizing guidance.</p>}
    {dell?<>
      <p>Catalog {OME_CATALOG.version}, reviewed {OME_CATALOG.reviewedAt}. Appliance installation and acceptance remain manual.</p>
      {plan.vendor?<p>Reviewed vendor requirement: <strong>{plan.vendor.cores} cores; {plan.vendor.memoryGB} GB memory; {plan.vendor.primaryGB} + {plan.vendor.secondaryGB} GB disks.</strong></p>:<p>Capacity requirement is unresolved. Review the release, profile and every plug-in selection.</p>}
      {plan.required&&<p>After the selected unit review: {plan.required.vCpu} vCPU, {plan.required.memoryGiB} GiB memory, {plan.required.primaryDiskGiB} + {plan.required.secondaryDiskGiB} GiB disks. Enter allocations in Hosting and availability; values are not changed automatically.</p>}
    </>:plan.platformLabel&&<p>Record the vendor's release-specific sizing review below and enter the allocations in Hosting and availability. Appliance installation and acceptance remain manual.</p>}
    <p>Discovery expressions are checked without contacting devices. Address ranges include every address; DNS may overlap those ranges. They are not a discovered-device count.</p>
    <p>Entered acceptance and HTTPS reachability do not establish deployment completion. All runtime qualification remains pending.</p>
    {dell&&<p><a href={OME_CATALOG.sources[0]} target="_blank" rel="noreferrer">Dell release-specific sizing and plug-in matrix</a></p>}
  </section>
}
