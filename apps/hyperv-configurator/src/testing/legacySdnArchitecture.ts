import {sdnArchitectureKeys} from '../sdnArchitectureFields'
import {removeLicensingRightsV28} from './legacyLicensingRights'
export function removeSdnArchitectureV27(project:any){removeLicensingRightsV28(project);for(const key of sdnArchitectureKeys)delete project.sdn.details?.[key]}
