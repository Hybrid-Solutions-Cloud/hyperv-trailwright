import {sdnRecordFields,sdnCollections} from '../sdnFields'
import {removeSdnServicesV25} from './legacySdnServices'
export function removeSdnV24(project:any){removeSdnServicesV25(project);delete project.sdn.details;for(const c of sdnCollections)delete project.design[c.key];for(const [key,fields]of sdnRecordFields)for(const row of project.design[key]||[])for(const f of fields)delete row.values[f.key]}
