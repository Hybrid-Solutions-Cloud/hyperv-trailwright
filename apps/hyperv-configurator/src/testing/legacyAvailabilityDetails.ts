import {availabilityDetailFields,availabilityPlacementFields} from '../availabilityDetailFields'
import {removeReadinessV18} from './legacyReadiness'
export function removeAvailabilityV17(project:{design?:Record<string,unknown>}){
  removeReadinessV18(project)
  if(project.design)delete project.design.availabilityDatabases
  for(const [key,fields]of [['availabilityGroups',availabilityDetailFields],['availabilityMembers',availabilityPlacementFields]]as const){const rows=project.design?.[key];if(Array.isArray(rows))for(const row of rows)for(const f of fields)delete row.values[f.key]}
}
