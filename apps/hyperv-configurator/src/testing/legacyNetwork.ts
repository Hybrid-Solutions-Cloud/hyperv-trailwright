import {networkV21Fields,networkCollections} from '../networkDesignFields'
import {removeOperationsV22} from './legacyOperations'
export function removeNetworkV21(project:any){removeOperationsV22(project);for(const c of networkCollections)delete project.design[c.key];for(const [key,fields]of networkV21Fields)for(const row of project.design[key]||[])for(const field of fields)delete row.values[field.key]}
