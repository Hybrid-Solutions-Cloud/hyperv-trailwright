import {networkDeviceKeys,networkDecisionV31Fields} from '../componentDecisionFields'
import {removeStorageLinksV32} from './legacyStorageLinks'
/** Restore the actual schema-30 shape: no component decisions, device records, port maps or storage connectivity. */
export function removeNetworkDecisionsV31(project:any){
  removeStorageLinksV32(project)
  delete project.decisions
  for(const key of networkDeviceKeys)delete project.design[key]
  for(const [key,fields]of networkDecisionV31Fields)for(const row of project.design[key]||[])for(const field of fields)delete row.values[field.key]
}
