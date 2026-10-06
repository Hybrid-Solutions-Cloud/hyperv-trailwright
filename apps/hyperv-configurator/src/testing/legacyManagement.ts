import {managementProductFields,managementSystemFields} from '../managementProductFields'
import {omePlanningFields} from '../omeFields'
import {removeHostingV14} from './legacyHosting'
export function removeManagementV13(project:{design?:Record<string,unknown>;components?:{product:string;productDetails:Record<string,unknown>;hostingDetails?:Record<string,unknown>}[]}){
  removeHostingV14(project)
  for(const c of project.components||[])if(c.product!=='ome')for(const f of [...managementSystemFields,...(managementProductFields[c.product]||[])])delete c.productDetails[f.key]
}
export function removeOmeV12(project:{components?:{product:string;productDetails:Record<string,unknown>}[]}){
  removeManagementV13(project)
  for(const c of project.components||[])if(c.product==='ome')for(const f of omePlanningFields)delete c.productDetails[f.key]
}
