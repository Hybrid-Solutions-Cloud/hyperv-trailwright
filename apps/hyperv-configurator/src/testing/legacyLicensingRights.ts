import {licensingRightsFields} from '../licensingRights'
import {removeLicenseCoverageV29} from './legacyLicenseCoverage'
export function removeLicensingRightsV28(project:any){removeLicenseCoverageV29(project);for(const row of project.design.licenses||[])for(const f of licensingRightsFields)delete row.values[f.key]}
