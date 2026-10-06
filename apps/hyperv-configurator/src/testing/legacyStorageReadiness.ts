import {storageV20Fields} from '../storageReadinessFields'
import {removeNetworkV21} from './legacyNetwork'
export function removeStorageReadinessV20(project:any){removeNetworkV21(project);delete project.design.storageInterfaces;for(const [key,fields]of storageV20Fields)for(const row of project.design[key]||[])for(const field of fields)delete row.values[field.key]}
