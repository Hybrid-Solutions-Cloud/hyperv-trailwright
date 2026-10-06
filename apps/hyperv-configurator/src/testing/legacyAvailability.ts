import {availabilityFields,availabilityMemberFields} from '../availabilityFields'
import {removeAvailabilityV17} from './legacyAvailabilityDetails'
export function removeAvailabilityV16(project:{design?:Record<string,unknown>}){
  removeAvailabilityV17(project)
  for(const [key,fields]of [['availabilityGroups',availabilityFields],['availabilityMembers',availabilityMemberFields]]as const){
    const rows=project.design?.[key]
    if(Array.isArray(rows))for(const row of rows)for(const f of fields)delete row.values[f.key]
  }
}
