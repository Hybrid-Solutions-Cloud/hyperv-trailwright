import {licensePlanningFields} from '../licensingFields'
import {removeOmeV12} from './legacyManagement'

export function removeLicensingV9(project:{design:Record<string,any>;context?:unknown;managementPlan?:unknown;components?:{product:string;productDetails:Record<string,unknown>}[]}) {
  removeOmeV12(project)
  delete project.context
  delete project.managementPlan
  delete project.design.licenseAssignments
  for(const row of project.design.licenses)for(const field of licensePlanningFields)delete row.values[field.key]
}
