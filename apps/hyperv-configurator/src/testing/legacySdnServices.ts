import {removeSdnArchitectureV27} from './legacySdnArchitecture'
import {sdnServiceCollections} from '../sdnServiceFields'
export function removeSdnServicesV25(project:any){removeSdnArchitectureV27(project);delete project.sdnEvidence;for(const c of sdnServiceCollections)delete project.design[c.key]}
