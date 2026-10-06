import {licenseCoverageKeys} from '../licenseCoverageFields'
import {removeLicenseDependenciesV30} from './legacyLicenseDependencies'
export function removeLicenseCoverageV29(project:any){removeLicenseDependenciesV30(project);for(const key of licenseCoverageKeys)delete project.design[key]}
