import {STORAGE_LINKS_KEY} from '../componentDecisionFields'
/** Restore the actual schema-31 shape: no switchless storage cable map. */
export function removeStorageLinksV32(project:any){
  if(project.design)delete project.design[STORAGE_LINKS_KEY]
}
