import {hostDeploymentFields,clusterDeploymentFields,provisioningReadinessFields} from '../hostDeploymentFields'
import {removeStorageReadinessV20} from './legacyStorageReadiness'
export function removeHostDeploymentV19(project:any){removeStorageReadinessV20(project);for(const [key,fields]of [['hosts',hostDeploymentFields],['clusters',clusterDeploymentFields],['profiles',provisioningReadinessFields]]as const)for(const row of project.design?.[key]||[])for(const field of fields)delete row.values[field.key]}
