import {hostingContractFields} from '../hostingContractFields'
import {removeAvailabilityV16} from './legacyAvailability'
export function removeHostingV14(project:{omittedComponents?:unknown;design?:Record<string,unknown>;components?:{hostingDetails?:Record<string,unknown>}[]}){
  removeAvailabilityV16(project)
  delete project.omittedComponents
  if(project.design)delete project.design.managementNetworks
  for(const c of project.components||[])if(c.hostingDetails)for(const f of hostingContractFields)delete c.hostingDetails[f.key]
}
